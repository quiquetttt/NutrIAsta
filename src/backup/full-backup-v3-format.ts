import {
  assertBackupAppCompatibility,
  compareVersions,
  textByteLength,
} from '@/backup/backup-format';
import {
  FULL_DATA_TABLES_V3,
  type FullBackupDataV3,
  type FullBackupManifestV3,
} from '@/backup/full-backup-v3-types';
import type { FullBackupFileDescriptor } from '@/backup/full-backup-types';
import { APP_VERSION } from '@/storage/schema';

export const FULL_BACKUP_V3_MANIFEST_PATH = 'manifest.json';
export const FULL_BACKUP_V3_DATA_PATH = 'data.json';
export const FULL_BACKUP_V3_MINIMUM_APP_VERSION = '0.3.0';
export const FULL_BACKUP_V3_LIMITS = Object.freeze({
  archiveBytes: 256 * 1024 * 1024,
  manifestBytes: 512 * 1024,
  dataBytes: 32 * 1024 * 1024,
  mediaBytes: 8 * 1024 * 1024,
  thumbnailBytes: 1024 * 1024,
  expandedBytes: 300 * 1024 * 1024,
  maxEntries: 502,
  maxMediaPairs: 250,
  maxRowsPerTable: 100_000,
  maxPathCharacters: 239,
});

const SHA256 = /^[a-f0-9]{64}$/i;
const PHOTO_TABLES = new Set(['legacyViabilityPhotos', 'foodPhotos']);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safePath(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= FULL_BACKUP_V3_LIMITS.maxPathCharacters
    && !value.startsWith('/')
    && !value.includes('..')
    && !value.includes('\\');
}

function sameKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join('|') === [...expected].sort().join('|');
}

function descriptorLimit(kind: FullBackupFileDescriptor['kind']): number {
  if (kind === 'data') return FULL_BACKUP_V3_LIMITS.dataBytes;
  if (kind === 'photo') return FULL_BACKUP_V3_LIMITS.mediaBytes;
  return FULL_BACKUP_V3_LIMITS.thumbnailBytes;
}

function assertDescriptor(raw: unknown): asserts raw is FullBackupFileDescriptor {
  if (!isObject(raw)
    || !safePath(raw.path)
    || !['data', 'photo', 'thumbnail'].includes(String(raw.kind))
    || !Number.isSafeInteger(raw.size)
    || (raw.size as number) < 0
    || (raw.size as number) > descriptorLimit(raw.kind as FullBackupFileDescriptor['kind'])
    || !SHA256.test(String(raw.checksum))
    || typeof raw.mimeType !== 'string') {
    throw new Error('El backup formato 3 contiene un descriptor no válido.');
  }
}

export function parseFullBackupV3Manifest(
  text: string,
  currentVersion = APP_VERSION,
): FullBackupManifestV3 {
  if (textByteLength(text) > FULL_BACKUP_V3_LIMITS.manifestBytes) {
    throw new Error('El manifiesto del backup formato 3 supera el límite.');
  }
  const value: unknown = JSON.parse(text);
  if (!isObject(value)
    || value.format !== 'nutriasta-full-backup'
    || value.formatVersion !== 3
    || value.databaseSchemaVersion !== 6
    || !Array.isArray(value.files)
    || !isObject(value.entityCounts)) {
    throw new Error('El manifiesto no es un backup completo de formato 3 compatible.');
  }
  for (const key of [
    'backupId',
    'sourceDatasetId',
    'exportedAt',
    'minimumAppVersion',
    'appVersion',
    'contentFingerprint',
  ]) {
    if (typeof value[key] !== 'string') throw new Error(`El campo ${key} no es válido.`);
  }
  if (!Number.isFinite(Date.parse(value.exportedAt as string))) {
    throw new Error('La fecha del backup formato 3 no es válida.');
  }
  compareVersions(value.appVersion as string, value.appVersion as string);
  assertBackupAppCompatibility(value.minimumAppVersion as string, currentVersion);
  if (!SHA256.test(value.contentFingerprint as string)) {
    throw new Error('La huella del backup formato 3 no es válida.');
  }
  if (!sameKeys(value.entityCounts, FULL_DATA_TABLES_V3)) {
    throw new Error('Los recuentos del backup formato 3 no contienen las 26 tablas exactas.');
  }
  for (const table of FULL_DATA_TABLES_V3) {
    const count = value.entityCounts[table];
    if (!Number.isInteger(count)
      || (count as number) < 0
      || (count as number) > FULL_BACKUP_V3_LIMITS.maxRowsPerTable) {
      throw new Error(`El recuento de ${table} no es válido.`);
    }
  }
  if (value.files.length < 1 || value.files.length > FULL_BACKUP_V3_LIMITS.maxEntries - 1) {
    throw new Error('El backup formato 3 contiene demasiados archivos.');
  }

  const paths = new Set<string>();
  const photos = new Set<string>();
  const thumbnails = new Set<string>();
  let dataFiles = 0;
  let totalBytes = textByteLength(text);
  for (const raw of value.files) {
    assertDescriptor(raw);
    if (paths.has(raw.path)) throw new Error('El backup formato 3 contiene rutas duplicadas.');
    paths.add(raw.path);
    totalBytes += raw.size;
    if (raw.kind === 'data') {
      dataFiles += 1;
      if (raw.path !== FULL_BACKUP_V3_DATA_PATH || raw.mimeType !== 'application/json') {
        throw new Error('El archivo de datos del formato 3 no es válido.');
      }
    } else {
      if (!raw.table || !PHOTO_TABLES.has(raw.table) || !raw.id || raw.mimeType !== 'image/jpeg') {
        throw new Error('Un descriptor multimedia del formato 3 no es válido.');
      }
      const key = `${raw.table}:${raw.id}`;
      const target = raw.kind === 'photo' ? photos : thumbnails;
      if (target.has(key)) throw new Error('El backup formato 3 contiene fotografías duplicadas.');
      target.add(key);
    }
  }
  const counts = value.entityCounts as Record<string, number>;
  const declaredPhotos = (counts.legacyViabilityPhotos ?? 0) + (counts.foodPhotos ?? 0);
  if (dataFiles !== 1
    || photos.size !== thumbnails.size
    || photos.size !== declaredPhotos
    || photos.size > FULL_BACKUP_V3_LIMITS.maxMediaPairs
    || [...photos].some((key) => !thumbnails.has(key))
    || totalBytes > FULL_BACKUP_V3_LIMITS.expandedBytes) {
    throw new Error('La estructura o el tamaño expandido del formato 3 no es válido.');
  }
  return value as unknown as FullBackupManifestV3;
}

export function parseFullBackupV3Data(
  text: string,
  manifest: FullBackupManifestV3,
): FullBackupDataV3 {
  if (textByteLength(text) > FULL_BACKUP_V3_LIMITS.dataBytes) {
    throw new Error('Los datos del backup formato 3 superan el límite.');
  }
  const value: unknown = JSON.parse(text);
  if (!isObject(value) || !sameKeys(value, FULL_DATA_TABLES_V3)) {
    throw new Error('El formato 3 no contiene las 26 tablas esperadas.');
  }
  for (const table of FULL_DATA_TABLES_V3) {
    const rows = value[table];
    if (!Array.isArray(rows)
      || rows.length !== manifest.entityCounts[table]
      || rows.length > FULL_BACKUP_V3_LIMITS.maxRowsPerTable) {
      throw new Error(`El contenido de ${table} no coincide con el manifiesto.`);
    }
    const identities = new Set<string>();
    for (const row of rows) {
      if (!isObject(row) || 'datasetId' in row || 'blob' in row || 'thumbnail' in row) {
        throw new Error(`Una fila de ${table} no es válida.`);
      }
      const identity = row.id ?? row.date;
      if (typeof identity !== 'string'
        || identity.length < 1
        || identity.length > 160
        || identities.has(identity)) {
        throw new Error(`Hay identificadores duplicados o no válidos en ${table}.`);
      }
      identities.add(identity);
    }
  }
  return value as FullBackupDataV3;
}
