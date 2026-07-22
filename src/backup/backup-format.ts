import { APP_VERSION, BACKUP_FORMAT_VERSION } from '@/storage/schema';
import type {
  BackupFileDescriptor,
  BackupManifest,
  ViabilityRecord,
} from '@/storage/dataset-types';

export const BACKUP_MIME_TYPE = 'application/x-nutriasta-backup';
export const MANIFEST_PATH = 'manifest.json';
export const RECORDS_PATH = 'records.json';
export const MINIMUM_BACKUP_APP_VERSION = '0.1.0';

export const BACKUP_LIMITS = Object.freeze({
  archiveBytes: 32 * 1024 * 1024,
  manifestBytes: 128 * 1024,
  recordsBytes: 256 * 1024,
  photoBytes: 16 * 1024 * 1024,
  thumbnailBytes: 1024 * 1024,
  totalPayloadBytes: 18 * 1024 * 1024,
  maxArchiveEntries: 4,
  maxRecords: 1,
  maxPhotos: 1,
  maxRecordTextCharacters: 10_000,
  maxImageDimension: 1600,
});

export interface BackupRecordsPayload {
  records: Array<Omit<ViabilityRecord, 'datasetId'>>;
}

type VersionTuple = readonly [major: number, minor: number, patch: number];

function parseVersion(value: string): VersionTuple {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) throw new Error(`La versión ${value} no tiene el formato mayor.menor.parche.`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(left: string, right: string): -1 | 0 | 1 {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }
  return 0;
}

export function assertBackupAppCompatibility(
  minimumAppVersion: string,
  currentAppVersion = APP_VERSION,
): void {
  if (compareVersions(currentAppVersion, minimumAppVersion) < 0) {
    throw new Error(
      `El backup necesita NutrIAsta ${minimumAppVersion} o posterior; esta versión es ${currentAppVersion}.`,
    );
  }
}

export function textByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function assertValidPassword(password: string): void {
  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }
}

function assertCount(value: unknown, maximum: number, label: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    throw new Error(`El ${label} del backup no es válido.`);
  }
}

function assertIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) {
    throw new Error(`El ${label} del backup no es válido.`);
  }
}

function assertIsoDate(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`La fecha ${label} del backup no es válida.`);
  }
}

function descriptorLimit(kind: BackupFileDescriptor['kind']): number {
  if (kind === 'records') return BACKUP_LIMITS.recordsBytes;
  if (kind === 'photo') return BACKUP_LIMITS.photoBytes;
  return BACKUP_LIMITS.thumbnailBytes;
}

function assertDescriptor(value: unknown): asserts value is BackupFileDescriptor {
  if (!value || typeof value !== 'object') throw new Error('El backup contiene un descriptor no válido.');
  const descriptor = value as Partial<BackupFileDescriptor>;
  if (!['records', 'photo', 'thumbnail'].includes(descriptor.kind ?? '')) {
    throw new Error('El backup contiene un tipo de archivo no permitido.');
  }
  if (
    typeof descriptor.path !== 'string' ||
    descriptor.path.startsWith('/') ||
    descriptor.path.includes('..') ||
    descriptor.path.includes('\\')
  ) {
    throw new Error('El backup contiene una ruta de archivo no permitida.');
  }
  if (
    !Number.isSafeInteger(descriptor.size) ||
    (descriptor.size ?? -1) < 0 ||
    (descriptor.size ?? 0) > descriptorLimit(descriptor.kind as BackupFileDescriptor['kind'])
  ) {
    throw new Error(`El tamaño declarado para ${descriptor.path} no es válido.`);
  }
  if (typeof descriptor.checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(descriptor.checksum)) {
    throw new Error(`El checksum declarado para ${descriptor.path} no es válido.`);
  }
  if (typeof descriptor.mimeType !== 'string' || descriptor.mimeType.length > 100) {
    throw new Error(`El tipo MIME declarado para ${descriptor.path} no es válido.`);
  }
}

function assertManifestFiles(manifest: BackupManifest): void {
  if (manifest.files.length > BACKUP_LIMITS.maxArchiveEntries - 1) {
    throw new Error('El backup contiene demasiados archivos.');
  }
  const paths = new Set<string>();
  for (const descriptor of manifest.files) {
    assertDescriptor(descriptor);
    if (paths.has(descriptor.path)) throw new Error('El backup contiene rutas duplicadas.');
    paths.add(descriptor.path);
  }

  const records = manifest.files.filter((item) => item.kind === 'records');
  const photos = manifest.files.filter((item) => item.kind === 'photo');
  const thumbnails = manifest.files.filter((item) => item.kind === 'thumbnail');
  if (
    records.length !== 1 ||
    records[0]?.path !== RECORDS_PATH ||
    records[0]?.mimeType !== 'application/json'
  ) {
    throw new Error('El backup no declara correctamente los registros.');
  }
  if (photos.length !== manifest.photoCount || thumbnails.length !== manifest.photoCount) {
    throw new Error('El recuento de fotografías del manifiesto no coincide con sus archivos.');
  }
  for (const photo of photos) {
    if (
      photo.id !== 'foto-prueba-001' ||
      photo.path !== `photos/${photo.id}.jpg` ||
      photo.mimeType !== 'image/jpeg' ||
      !Number.isInteger(photo.width) ||
      !Number.isInteger(photo.height) ||
      (photo.width ?? 0) < 1 ||
      (photo.height ?? 0) < 1 ||
      (photo.width ?? 0) > BACKUP_LIMITS.maxImageDimension ||
      (photo.height ?? 0) > BACKUP_LIMITS.maxImageDimension ||
      typeof photo.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(photo.createdAt))
    ) {
      throw new Error('El descriptor de la fotografía no es válido.');
    }
    const thumbnail = thumbnails.find((item) => item.id === photo.id);
    if (
      !thumbnail ||
      thumbnail.path !== `photos/${photo.id}-thumbnail.jpg` ||
      thumbnail.mimeType !== 'image/jpeg'
    ) {
      throw new Error('El descriptor de la miniatura no es válido.');
    }
  }

  const totalBytes = manifest.files.reduce((total, descriptor) => total + descriptor.size, 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes > BACKUP_LIMITS.totalPayloadBytes) {
    throw new Error('El tamaño total declarado del backup supera el límite permitido.');
  }
}

export function parseBackupManifest(value: string, currentAppVersion = APP_VERSION): BackupManifest {
  if (textByteLength(value) > BACKUP_LIMITS.manifestBytes) {
    throw new Error('El manifiesto del backup supera el tamaño permitido.');
  }
  const candidate = JSON.parse(value) as Partial<BackupManifest>;
  if (
    candidate.format !== 'nutriasta-backup' ||
    candidate.formatVersion !== BACKUP_FORMAT_VERSION ||
    typeof candidate.minimumAppVersion !== 'string' ||
    typeof candidate.appVersion !== 'string' ||
    !Array.isArray(candidate.files)
  ) {
    throw new Error('El manifiesto del backup no es válido o no es compatible.');
  }
  assertIdentifier(candidate.backupId, 'identificador');
  assertIdentifier(candidate.sourceDatasetId, 'dataset de origen');
  assertIsoDate(candidate.exportedAt, 'de exportación');
  assertCount(candidate.recordCount, BACKUP_LIMITS.maxRecords, 'recuento de registros');
  assertCount(candidate.photoCount, BACKUP_LIMITS.maxPhotos, 'recuento de fotografías');
  compareVersions(candidate.appVersion, candidate.appVersion);
  assertBackupAppCompatibility(candidate.minimumAppVersion, currentAppVersion);

  const manifest = candidate as BackupManifest;
  assertManifestFiles(manifest);
  return manifest;
}

export function parseRecordsPayload(value: string): BackupRecordsPayload {
  if (textByteLength(value) > BACKUP_LIMITS.recordsBytes) {
    throw new Error('El archivo de registros supera el tamaño permitido.');
  }
  const candidate = JSON.parse(value) as Partial<BackupRecordsPayload>;
  if (!Array.isArray(candidate.records) || candidate.records.length > BACKUP_LIMITS.maxRecords) {
    throw new Error('El archivo de registros no es válido.');
  }
  for (const record of candidate.records) {
    if (
      record.id !== 'registro-prueba-001' ||
      typeof record.text !== 'string' ||
      record.text.length > BACKUP_LIMITS.maxRecordTextCharacters ||
      typeof record.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(record.createdAt)) ||
      typeof record.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(record.updatedAt))
    ) {
      throw new Error('El backup contiene un registro no válido.');
    }
  }
  return candidate as BackupRecordsPayload;
}
