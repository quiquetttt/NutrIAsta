import { assertBackupAppCompatibility, assertValidPassword, compareVersions, textByteLength } from '@/backup/backup-format';
import { FULL_DATA_TABLES, type FullBackupData, type FullBackupFileDescriptor, type FullBackupManifest } from '@/backup/full-backup-types';
import { APP_VERSION } from '@/storage/schema';

export const FULL_BACKUP_MANIFEST_PATH = 'manifest.json';
export const FULL_BACKUP_DATA_PATH = 'data.json';
export const FULL_BACKUP_MINIMUM_APP_VERSION = '0.2.0';
export const FULL_BACKUP_MIME = 'application/x-nutriasta-backup';
export const FULL_BACKUP_LIMITS = Object.freeze({
  archiveBytes: 128 * 1024 * 1024,
  manifestBytes: 512 * 1024,
  dataBytes: 16 * 1024 * 1024,
  mediaBytes: 8 * 1024 * 1024,
  thumbnailBytes: 1024 * 1024,
  expandedBytes: 160 * 1024 * 1024,
  maxEntries: 502,
  maxMediaPairs: 250,
  maxRowsPerTable: 100_000,
});

const SHA256 = /^[a-f0-9]{64}$/i;
function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function safePath(path: unknown): path is string { return typeof path === 'string' && path.length > 0 && path.length < 240 && !path.startsWith('/') && !path.includes('..') && !path.includes('\\'); }

export function assertFullBackupPassword(password: string) { assertValidPassword(password); }

export function parseFullBackupManifest(text: string, currentVersion = APP_VERSION): FullBackupManifest {
  if (textByteLength(text) > FULL_BACKUP_LIMITS.manifestBytes) throw new Error('El manifiesto del backup completo supera el límite.');
  const value: unknown = JSON.parse(text);
  if (!isObject(value) || value.format !== 'nutriasta-full-backup' || value.formatVersion !== 2 || !Array.isArray(value.files) || !isObject(value.entityCounts)) throw new Error('El manifiesto no es un backup completo compatible.');
  for (const key of ['backupId', 'sourceDatasetId', 'exportedAt', 'minimumAppVersion', 'appVersion', 'contentFingerprint']) if (typeof value[key] !== 'string') throw new Error(`El campo ${key} del manifiesto no es válido.`);
  if (!Number.isFinite(Date.parse(value.exportedAt as string))) throw new Error('La fecha del backup no es válida.');
  compareVersions(value.appVersion as string, value.appVersion as string);
  assertBackupAppCompatibility(value.minimumAppVersion as string, currentVersion);
  if (!SHA256.test(value.contentFingerprint as string)) throw new Error('La huella del backup no es válida.');
  const counts = value.entityCounts as Record<string, unknown>;
  if (Object.keys(counts).sort().join('|') !== [...FULL_DATA_TABLES].sort().join('|')) throw new Error('Los recuentos de entidades no son válidos.');
  for (const table of FULL_DATA_TABLES) if (!Number.isInteger(counts[table]) || (counts[table] as number) < 0 || (counts[table] as number) > FULL_BACKUP_LIMITS.maxRowsPerTable) throw new Error(`El recuento de ${table} no es válido.`);
  if (value.files.length < 1 || value.files.length > FULL_BACKUP_LIMITS.maxEntries - 1) throw new Error('El backup contiene demasiados archivos.');
  const paths = new Set<string>(); const photoKeys = new Set<string>(); const thumbnailKeys = new Set<string>(); let total = 0; let dataFiles = 0; let photos = 0; let thumbnails = 0;
  for (const raw of value.files) {
    if (!isObject(raw) || !safePath(raw.path) || !['data', 'photo', 'thumbnail'].includes(String(raw.kind)) || !Number.isSafeInteger(raw.size) || (raw.size as number) < 0 || !SHA256.test(String(raw.checksum)) || typeof raw.mimeType !== 'string') throw new Error('El backup contiene un descriptor no válido.');
    if (paths.has(raw.path)) throw new Error('El backup contiene rutas duplicadas.'); paths.add(raw.path); total += raw.size as number;
    const limit = raw.kind === 'data' ? FULL_BACKUP_LIMITS.dataBytes : raw.kind === 'photo' ? FULL_BACKUP_LIMITS.mediaBytes : FULL_BACKUP_LIMITS.thumbnailBytes;
    if ((raw.size as number) > limit) throw new Error(`El archivo ${raw.path} supera el límite.`);
    if (raw.kind === 'data') { dataFiles += 1; if (raw.path !== FULL_BACKUP_DATA_PATH || raw.mimeType !== 'application/json') throw new Error('El archivo de datos no es válido.'); }
    else { if (!['legacyViabilityPhotos', 'foodPhotos'].includes(String(raw.table)) || typeof raw.id !== 'string' || raw.id.length > 128 || raw.mimeType !== 'image/jpeg') throw new Error('Un descriptor multimedia no es válido.'); const key = `${raw.table}:${raw.id}`; const keys = raw.kind === 'photo' ? photoKeys : thumbnailKeys; if (keys.has(key)) throw new Error('El backup contiene fotografías duplicadas.'); keys.add(key); if (raw.kind === 'photo') photos += 1; else thumbnails += 1; }
  }
  const declaredMedia = (counts.legacyViabilityPhotos as number) + (counts.foodPhotos as number);
  if (dataFiles !== 1 || photos !== thumbnails || photos !== declaredMedia || [...photoKeys].some((key) => !thumbnailKeys.has(key)) || photos > FULL_BACKUP_LIMITS.maxMediaPairs || total > FULL_BACKUP_LIMITS.expandedBytes) throw new Error('La estructura o el tamaño total del backup no es válido.');
  return value as unknown as FullBackupManifest;
}

export function parseFullBackupData(text: string, manifest: FullBackupManifest): FullBackupData {
  if (textByteLength(text) > FULL_BACKUP_LIMITS.dataBytes) throw new Error('Los datos descomprimidos superan el límite.');
  const value: unknown = JSON.parse(text);
  if (!isObject(value) || Object.keys(value).sort().join('|') !== [...FULL_DATA_TABLES].sort().join('|')) throw new Error('El contenido de datos no tiene las tablas esperadas.');
  for (const table of FULL_DATA_TABLES) {
    const rows = value[table];
    if (!Array.isArray(rows) || rows.length !== manifest.entityCounts[table] || rows.length > FULL_BACKUP_LIMITS.maxRowsPerTable) throw new Error(`El contenido de ${table} no coincide con el manifiesto.`);
    const identities = new Set<string>();
    for (const row of rows) {
      if (!isObject(row) || 'datasetId' in row || typeof row.id !== 'string' && table !== 'diaryDays' && table !== 'trainingDayFlags') throw new Error(`Una fila de ${table} no es válida.`);
      const identity = String(row.id ?? row.date ?? '');
      if (!identity || identity.length > 160 || identities.has(identity)) throw new Error(`Hay identificadores duplicados o no válidos en ${table}.`);
      identities.add(identity);
      if ('blob' in row || 'thumbnail' in row) throw new Error('Los blobs no pueden incluirse dentro de data.json.');
    }
  }
  return value as FullBackupData;
}

export function dataDescriptor(manifest: FullBackupManifest): FullBackupFileDescriptor { const result = manifest.files.find((file) => file.kind === 'data'); if (!result) throw new Error('Falta data.json.'); return result; }
