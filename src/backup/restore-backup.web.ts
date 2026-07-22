import {
  BlobReader,
  BlobWriter,
  TextWriter,
  ZipReader,
  type Entry,
  type FileEntry,
} from '@zip.js/zip.js';

import {
  BACKUP_LIMITS,
  MANIFEST_PATH,
  RECORDS_PATH,
  assertValidPassword,
  parseBackupManifest,
  parseRecordsPayload,
  textByteLength,
} from '@/backup/backup-format';
import { datasetRepository } from '@/storage/dataset-repository.web';
import type {
  BackupManifest,
  DatasetSnapshot,
  PhotoAsset,
  RestoreSession,
  ViabilityRecord,
} from '@/storage/dataset-types';
import { sha256Blob, sha256Text } from '@/utils/crypto';

export interface PreparedRestore {
  candidateDatasetId: string;
  previousDatasetId: string;
  manifest: BackupManifest;
  totalBytes: number;
}

function entryLimit(path: string): number {
  if (path === MANIFEST_PATH) return BACKUP_LIMITS.manifestBytes;
  if (path === RECORDS_PATH) return BACKUP_LIMITS.recordsBytes;
  if (path === 'photos/foto-prueba-001.jpg') return BACKUP_LIMITS.photoBytes;
  if (path === 'photos/foto-prueba-001-thumbnail.jpg') return BACKUP_LIMITS.thumbnailBytes;
  throw new Error(`El backup contiene una ruta no permitida: ${path}.`);
}

function assertEntryMetadata(entry: Entry): void {
  if (entry.directory) throw new Error('El backup no puede contener directorios.');
  if (!entry.encrypted || entry.zipCrypto) {
    throw new Error('Todos los archivos del backup deben usar cifrado AES.');
  }
  const limit = entryLimit(entry.filename);
  if (
    !Number.isSafeInteger(entry.uncompressedSize) ||
    entry.uncompressedSize < 0 ||
    entry.uncompressedSize > limit ||
    !Number.isSafeInteger(entry.compressedSize) ||
    entry.compressedSize < 0 ||
    entry.compressedSize > BACKUP_LIMITS.archiveBytes
  ) {
    throw new Error(`El tamaño de ${entry.filename} no es válido.`);
  }
}

function requiredEntry(entries: Map<string, Entry>, path: string): FileEntry {
  const entry = entries.get(path);
  if (!entry || entry.directory || !('getData' in entry)) throw new Error(`Falta el archivo ${path}.`);
  return entry as FileEntry;
}

function boundedReadOptions(password: string, maximumBytes: number) {
  const assertWithinLimit = (value: number) => {
    if (!Number.isFinite(value) || value < 0 || value > maximumBytes) {
      throw new Error('La descompresión supera el límite permitido.');
    }
  };
  return {
    password,
    onstart: assertWithinLimit,
    onprogress: (progress: number, total: number) => {
      assertWithinLimit(progress);
      assertWithinLimit(total);
    },
    onend: assertWithinLimit,
  };
}

async function readText(entry: FileEntry, password: string, maximumBytes: number): Promise<string> {
  const value = await entry.getData(new TextWriter(), boundedReadOptions(password, maximumBytes));
  if (textByteLength(value) > maximumBytes) throw new Error('El texto descomprimido supera el límite permitido.');
  return value;
}

async function readBlob(
  entry: FileEntry,
  password: string,
  mimeType: string,
  maximumBytes: number,
): Promise<Blob> {
  const value = await entry.getData(
    new BlobWriter(mimeType),
    boundedReadOptions(password, maximumBytes),
  );
  if (value.size > maximumBytes) throw new Error('El archivo descomprimido supera el límite permitido.');
  return value;
}

async function assertCandidateSpace(requiredBytes: number): Promise<void> {
  if (!navigator.storage?.estimate) return;
  const estimate = await navigator.storage.estimate();
  if (typeof estimate.quota !== 'number' || typeof estimate.usage !== 'number') return;
  const available = Math.max(0, estimate.quota - estimate.usage);
  if (available < requiredBytes * 1.2) {
    throw new Error('No hay espacio suficiente para conservar el dataset actual y preparar el candidato.');
  }
}

export async function prepareEncryptedRestore(file: File, password: string): Promise<PreparedRestore> {
  assertValidPassword(password);
  if (file.size < 1 || file.size > BACKUP_LIMITS.archiveBytes) {
    throw new Error('El archivo de backup supera el tamaño permitido.');
  }
  const reader = new ZipReader(new BlobReader(file));
  let candidateDatasetId: string | null = null;
  try {
    const allEntries = await reader.getEntries();
    if (allEntries.length < 2 || allEntries.length > BACKUP_LIMITS.maxArchiveEntries) {
      throw new Error('El backup contiene un número de archivos no permitido.');
    }
    const entries = new Map<string, Entry>();
    for (const entry of allEntries) {
      assertEntryMetadata(entry);
      if (entries.has(entry.filename)) throw new Error('El backup contiene nombres de archivo duplicados.');
      entries.set(entry.filename, entry);
    }
    const centralDirectoryBytes = allEntries.reduce(
      (total, entry) => total + entry.uncompressedSize,
      0,
    );
    if (
      !Number.isSafeInteger(centralDirectoryBytes) ||
      centralDirectoryBytes > BACKUP_LIMITS.totalPayloadBytes + BACKUP_LIMITS.manifestBytes
    ) {
      throw new Error('El contenido descomprimido declarado supera el límite permitido.');
    }

    const manifest = parseBackupManifest(
      await readText(requiredEntry(entries, MANIFEST_PATH), password, BACKUP_LIMITS.manifestBytes),
    );
    const describedPaths = new Set([MANIFEST_PATH, ...manifest.files.map((descriptor) => descriptor.path)]);
    if (
      describedPaths.size !== allEntries.length ||
      allEntries.some((entry) => !describedPaths.has(entry.filename))
    ) {
      throw new Error('El backup contiene archivos ausentes o no declarados.');
    }
    for (const descriptor of manifest.files) {
      const entry = requiredEntry(entries, descriptor.path);
      if (entry.uncompressedSize !== descriptor.size) {
        throw new Error(`El tamaño real de ${descriptor.path} no coincide con el manifiesto.`);
      }
    }

    const totalBytes = manifest.files.reduce((total, descriptor) => total + descriptor.size, 0);
    await assertCandidateSpace(totalBytes);

    const recordsDescriptor = manifest.files.find((item) => item.kind === 'records');
    if (!recordsDescriptor || recordsDescriptor.path !== RECORDS_PATH) {
      throw new Error('El backup no declara correctamente los registros.');
    }
    const recordsJson = await readText(
      requiredEntry(entries, RECORDS_PATH),
      password,
      BACKUP_LIMITS.recordsBytes,
    );
    if (textByteLength(recordsJson) !== recordsDescriptor.size) {
      throw new Error('El tamaño real de los registros no coincide con el manifiesto.');
    }
    if (await sha256Text(recordsJson) !== recordsDescriptor.checksum) {
      throw new Error('La comprobación de integridad de los registros ha fallado.');
    }
    const parsedRecords = parseRecordsPayload(recordsJson);
    if (parsedRecords.records.length !== manifest.recordCount) {
      throw new Error('El recuento de registros no coincide con el manifiesto.');
    }

    const photos: PhotoAsset[] = [];
    const photoDescriptors = manifest.files.filter((item) => item.kind === 'photo');
    for (const descriptor of photoDescriptors) {
      if (!descriptor.id) throw new Error('Una fotografía no tiene identificador.');
      const thumbnailDescriptor = manifest.files.find(
        (item) => item.kind === 'thumbnail' && item.id === descriptor.id,
      );
      if (!thumbnailDescriptor) throw new Error('Una fotografía no incluye miniatura.');
      const [blob, thumbnail] = await Promise.all([
        readBlob(
          requiredEntry(entries, descriptor.path),
          password,
          descriptor.mimeType,
          BACKUP_LIMITS.photoBytes,
        ),
        readBlob(
          requiredEntry(entries, thumbnailDescriptor.path),
          password,
          thumbnailDescriptor.mimeType,
          BACKUP_LIMITS.thumbnailBytes,
        ),
      ]);
      if (blob.size !== descriptor.size || thumbnail.size !== thumbnailDescriptor.size) {
        throw new Error('El tamaño real de una fotografía no coincide con el manifiesto.');
      }
      const [checksum, thumbnailChecksum] = await Promise.all([
        sha256Blob(blob),
        sha256Blob(thumbnail),
      ]);
      if (checksum !== descriptor.checksum || thumbnailChecksum !== thumbnailDescriptor.checksum) {
        throw new Error('La comprobación de integridad de una fotografía ha fallado.');
      }
      photos.push({
        datasetId: '',
        id: 'foto-prueba-001',
        blob,
        thumbnail,
        mimeType: descriptor.mimeType,
        width: descriptor.width ?? 0,
        height: descriptor.height ?? 0,
        size: blob.size,
        checksum,
        thumbnailChecksum,
        createdAt: descriptor.createdAt ?? manifest.exportedAt,
      });
    }
    if (photos.length !== manifest.photoCount) {
      throw new Error('El recuento de fotografías no coincide con el manifiesto.');
    }

    const previousDatasetId = await datasetRepository.getActiveDatasetId();
    const records: ViabilityRecord[] = parsedRecords.records.map((record) => ({
      ...record,
      datasetId: '',
    }));
    candidateDatasetId = await datasetRepository.stageSnapshot(
      { records, photos } as Omit<DatasetSnapshot, 'dataset'>,
      manifest.backupId,
    );

    const staged = await datasetRepository.getDatasetSnapshot(candidateDatasetId);
    if (staged.records.length !== manifest.recordCount || staged.photos.length !== manifest.photoCount) {
      throw new Error('El dataset temporal no coincide con el backup.');
    }
    for (const photo of staged.photos) {
      const [checksum, thumbnailChecksum] = await Promise.all([
        sha256Blob(photo.blob),
        sha256Blob(photo.thumbnail),
      ]);
      if (checksum !== photo.checksum || thumbnailChecksum !== photo.thumbnailChecksum) {
        throw new Error('La verificación del dataset temporal ha fallado.');
      }
    }
    return { candidateDatasetId, previousDatasetId, manifest, totalBytes };
  } catch (error) {
    if (candidateDatasetId) await datasetRepository.discardCandidate(candidateDatasetId).catch(() => undefined);
    throw new Error('No se pudo preparar la restauración. El dataset activo no ha cambiado.', { cause: error });
  } finally {
    await reader.close();
  }
}

export async function cancelPreparedRestore(prepared: PreparedRestore): Promise<void> {
  await datasetRepository.discardCandidate(prepared.candidateDatasetId);
}

export async function activatePreparedRestore(prepared: PreparedRestore): Promise<RestoreSession> {
  if ((await datasetRepository.getActiveDatasetId()) !== prepared.previousDatasetId) {
    throw new Error('El dataset activo cambió desde que se preparó la restauración.');
  }
  return datasetRepository.activateCandidate(prepared.candidateDatasetId);
}
