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
import type { BackupManifest, DatasetSnapshot, PhotoAsset, ViabilityRecord } from '@/storage/dataset-types';
import { sha256Blob, sha256Text } from '@/utils/crypto';

export interface DecodedFormat1Backup {
  manifest: BackupManifest;
  snapshot: Omit<DatasetSnapshot, 'dataset'>;
  totalBytes: number;
  fingerprint: string;
}

function assertSupportedFilename(name: string): void {
  if (!/\.(nutriasta|zip)$/i.test(name)) {
    throw new Error('Selecciona un backup con extensión .nutriasta, .zip o .nutriasta.zip.');
  }
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
  if (!entry.encrypted || entry.zipCrypto) throw new Error('Todos los archivos del backup deben usar cifrado AES.');
  const limit = entryLimit(entry.filename);
  if (
    !Number.isSafeInteger(entry.uncompressedSize)
    || entry.uncompressedSize < 0
    || entry.uncompressedSize > limit
    || !Number.isSafeInteger(entry.compressedSize)
    || entry.compressedSize < 0
    || entry.compressedSize > BACKUP_LIMITS.archiveBytes
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

async function readBlob(entry: FileEntry, password: string, mimeType: string, maximumBytes: number) {
  const value = await entry.getData(new BlobWriter(mimeType), boundedReadOptions(password, maximumBytes));
  if (value.size > maximumBytes) throw new Error('El archivo descomprimido supera el límite permitido.');
  return value;
}

function backupFingerprint(manifest: BackupManifest): Promise<string> {
  return sha256Text(JSON.stringify({
    formatVersion: manifest.formatVersion,
    backupId: manifest.backupId,
    sourceDatasetId: manifest.sourceDatasetId,
    recordCount: manifest.recordCount,
    photoCount: manifest.photoCount,
    files: [...manifest.files]
      .sort((left, right) => left.path.localeCompare(right.path))
      .map(({ path, size, checksum }) => ({ path, size, checksum })),
  }));
}

export async function decodeFormat1Backup(file: File, password: string): Promise<DecodedFormat1Backup> {
  assertSupportedFilename(file.name);
  assertValidPassword(password);
  if (file.size < 1 || file.size > BACKUP_LIMITS.archiveBytes) {
    throw new Error('El archivo de backup supera el tamaño permitido.');
  }
  const reader = new ZipReader(new BlobReader(file));
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
    const declaredBytes = allEntries.reduce((total, entry) => total + entry.uncompressedSize, 0);
    if (
      !Number.isSafeInteger(declaredBytes)
      || declaredBytes > BACKUP_LIMITS.totalPayloadBytes + BACKUP_LIMITS.manifestBytes
    ) {
      throw new Error('El contenido descomprimido declarado supera el límite permitido.');
    }

    const manifest = parseBackupManifest(
      await readText(requiredEntry(entries, MANIFEST_PATH), password, BACKUP_LIMITS.manifestBytes),
    );
    const describedPaths = new Set([MANIFEST_PATH, ...manifest.files.map(({ path }) => path)]);
    if (describedPaths.size !== allEntries.length || allEntries.some(({ filename }) => !describedPaths.has(filename))) {
      throw new Error('El backup contiene archivos ausentes o no declarados.');
    }
    for (const descriptor of manifest.files) {
      if (requiredEntry(entries, descriptor.path).uncompressedSize !== descriptor.size) {
        throw new Error(`El tamaño real de ${descriptor.path} no coincide con el manifiesto.`);
      }
    }

    const recordsDescriptor = manifest.files.find(({ kind }) => kind === 'records');
    if (!recordsDescriptor || recordsDescriptor.path !== RECORDS_PATH) {
      throw new Error('El backup no declara correctamente los registros.');
    }
    const recordsJson = await readText(requiredEntry(entries, RECORDS_PATH), password, BACKUP_LIMITS.recordsBytes);
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
    const records: ViabilityRecord[] = parsedRecords.records.map((record) => ({ ...record, datasetId: '' }));

    const photos: PhotoAsset[] = [];
    for (const descriptor of manifest.files.filter(({ kind }) => kind === 'photo')) {
      if (!descriptor.id) throw new Error('Una fotografía no tiene identificador.');
      const thumbnailDescriptor = manifest.files.find(
        (item) => item.kind === 'thumbnail' && item.id === descriptor.id,
      );
      if (!thumbnailDescriptor) throw new Error('Una fotografía no incluye miniatura.');
      const blob = await readBlob(
        requiredEntry(entries, descriptor.path),
        password,
        descriptor.mimeType,
        BACKUP_LIMITS.photoBytes,
      );
      const thumbnail = await readBlob(
        requiredEntry(entries, thumbnailDescriptor.path),
        password,
        thumbnailDescriptor.mimeType,
        BACKUP_LIMITS.thumbnailBytes,
      );
      if (blob.size !== descriptor.size || thumbnail.size !== thumbnailDescriptor.size) {
        throw new Error('El tamaño real de una fotografía no coincide con el manifiesto.');
      }
      const checksum = await sha256Blob(blob);
      const thumbnailChecksum = await sha256Blob(thumbnail);
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
    return {
      manifest,
      snapshot: { records, photos },
      totalBytes: manifest.files.reduce((total, descriptor) => total + descriptor.size, 0),
      fingerprint: await backupFingerprint(manifest),
    };
  } finally {
    await reader.close();
  }
}
