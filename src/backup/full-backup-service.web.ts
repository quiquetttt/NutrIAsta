import { BlobReader, BlobWriter, TextReader, TextWriter, ZipReader, ZipWriter, type Entry, type FileEntry } from '@zip.js/zip.js';
import { textByteLength } from '@/backup/backup-format';
import {
  FULL_BACKUP_DATA_PATH, FULL_BACKUP_LIMITS, FULL_BACKUP_MANIFEST_PATH, FULL_BACKUP_MIME,
  FULL_BACKUP_MINIMUM_APP_VERSION, assertFullBackupPassword, dataDescriptor,
  parseFullBackupData, parseFullBackupManifest,
} from '@/backup/full-backup-format';
import { identifyBackupFormat } from '@/backup/full-backup-dispatcher';
import {
  FULL_BACKUP_V3_DATA_PATH,
  FULL_BACKUP_V3_LIMITS,
  FULL_BACKUP_V3_MANIFEST_PATH,
  FULL_BACKUP_V3_MINIMUM_APP_VERSION,
  assertFullBackupV3Relationships,
  parseFullBackupV3Data,
  parseFullBackupV3Manifest,
} from '@/backup/full-backup-v3-format';
import {
  FULL_DATA_TABLES_V3,
  type FullBackupDataV3,
  type FullBackupManifestV3,
} from '@/backup/full-backup-v3-types';
import { FULL_DATA_TABLES, type FullBackupData, type FullBackupFileDescriptor, type FullBackupManifest, type FullBackupStatus, type PreparedFullRestore } from '@/backup/full-backup-types';
import { mainDatabase, type NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { mainDatasetRepository, type MainDatasetRepository } from '@/storage/main-dataset-repository.web';
import type { MainDatasetMetadata, MainMigrationSession, MigrationRun } from '@/storage/main-dataset-types';
import { MAIN_META_KEYS } from '@/storage/main-schema';
import { APP_VERSION } from '@/storage/schema';
import { trackUpdateBlockingOperation, trackWrite } from '@/storage/write-tracker';
import { createId, sha256Blob, sha256Text } from '@/utils/crypto';

type EstimateProvider = () => Promise<StorageEstimate>;
const defaultEstimate = () => navigator.storage?.estimate ? navigator.storage.estimate() : Promise.resolve({});
type MediaValue = { table: 'legacyViabilityPhotos' | 'foodPhotos'; id: string; blob: Blob; thumbnail: Blob };

type AnyManifest = FullBackupManifest | FullBackupManifestV3;
type AnyData = FullBackupData | FullBackupDataV3;
interface BuiltSnapshot { data: AnyData; dataJson: string; media: MediaValue[]; files: FullBackupFileDescriptor[]; counts: Record<string, number>; payloadBytes: number; fingerprint: string; }
interface DecodedFullBackup { manifest: AnyManifest; data: AnyData; media: MediaValue[]; payloadBytes: number; tables: readonly string[]; }

function emptyData(tables: readonly string[]): AnyData { return Object.fromEntries(tables.map((table) => [table, []])) as unknown as AnyData; }
function sortRows(rows: Array<Record<string, unknown>>) { return rows.sort((a, b) => String(a.id ?? a.date).localeCompare(String(b.id ?? b.date))); }
function mediaPath(table: string, id: string, thumbnail = false) { return `media/${table}/${encodeURIComponent(id)}${thumbnail ? '-thumbnail' : ''}.jpg`; }
function manifestFingerprint(dataChecksum: string, files: FullBackupFileDescriptor[]) { return sha256Text(JSON.stringify({ dataChecksum, media: files.filter((file) => file.kind !== 'data').map(({ path, size, checksum }) => ({ path, size, checksum })).sort((a, b) => a.path.localeCompare(b.path)) })); }

async function buildSnapshot(db: NutrIAstaMainDatabase, datasetId: string, tables: readonly string[] = FULL_DATA_TABLES_V3): Promise<BuiltSnapshot> {
  const data = emptyData(tables); const media: MediaValue[] = []; const files: FullBackupFileDescriptor[] = [];
  for (const tableName of tables) {
    const rows = await db.table(tableName).where('datasetId').equals(datasetId).toArray() as Array<Record<string, unknown>>;
    for (const source of rows) {
      const { datasetId: _datasetId, ...row } = source;
      if (tableName === 'legacyViabilityPhotos' || tableName === 'foodPhotos') {
        const blob = row.blob; const thumbnail = row.thumbnail;
        if (!(blob instanceof Blob) || !(thumbnail instanceof Blob) || typeof row.id !== 'string') throw new Error('Una fotografía almacenada no es válida.');
        const [checksum, thumbnailChecksum] = await Promise.all([sha256Blob(blob), sha256Blob(thumbnail)]);
        if (checksum !== row.checksum || thumbnailChecksum !== row.thumbnailChecksum) throw new Error('Una fotografía local no supera la comprobación de integridad.');
        delete row.blob; delete row.thumbnail;
        const table = tableName as MediaValue['table']; media.push({ table, id: row.id, blob, thumbnail });
        files.push(
          { path: mediaPath(table, row.id), kind: 'photo', table, id: row.id, size: blob.size, checksum, mimeType: 'image/jpeg' },
          { path: mediaPath(table, row.id, true), kind: 'thumbnail', table, id: row.id, size: thumbnail.size, checksum: thumbnailChecksum, mimeType: 'image/jpeg' },
        );
      }
      data[tableName as keyof AnyData].push(row);
    }
    sortRows(data[tableName as keyof AnyData]);
  }
  const dataJson = JSON.stringify(data); const dataChecksum = await sha256Text(dataJson);
  files.unshift({ path: FULL_BACKUP_DATA_PATH, kind: 'data', size: textByteLength(dataJson), checksum: dataChecksum, mimeType: 'application/json' });
  const counts = Object.fromEntries(tables.map((table) => [table, data[table as keyof AnyData].length]));
  const payloadBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (payloadBytes > FULL_BACKUP_V3_LIMITS.expandedBytes) throw new Error('El contenido local supera el límite del backup completo.');
  return { data, dataJson, media, files, counts, payloadBytes, fingerprint: await manifestFingerprint(dataChecksum, files) };
}

function requiredEntry(entries: Map<string, Entry>, path: string): FileEntry { const entry = entries.get(path); if (!entry || entry.directory || !('getData' in entry)) throw new Error(`Falta el archivo ${path}.`); return entry as FileEntry; }
function boundedOptions(password: string, maximum: number) { const check = (value: number) => { if (!Number.isFinite(value) || value < 0 || value > maximum) throw new Error('La descompresión supera el límite permitido.'); }; return { password, onstart: check, onprogress: (progress: number, total: number) => { check(progress); check(total); }, onend: check }; }
async function readText(entry: FileEntry, password: string, maximum: number) { const value = await entry.getData(new TextWriter(), boundedOptions(password, maximum)); if (textByteLength(value) > maximum) throw new Error('El texto descomprimido supera el límite.'); return value; }
async function readBlob(entry: FileEntry, password: string, maximum: number) { const value = await entry.getData(new BlobWriter('image/jpeg'), boundedOptions(password, maximum)); if (value.size > maximum) throw new Error('La fotografía descomprimida supera el límite.'); return value; }

export async function decodeFullBackup(file: File, password: string): Promise<DecodedFullBackup> {
  assertFullBackupPassword(password);
  if (!/\.(nutriasta|zip)$/i.test(file.name) || file.size < 1 || file.size > FULL_BACKUP_V3_LIMITS.archiveBytes) throw new Error('Selecciona un backup completo válido dentro del límite de tamaño.');
  const reader = new ZipReader(new BlobReader(file));
  try {
    const all = await reader.getEntries();
    if (all.length < 2 || all.length > FULL_BACKUP_LIMITS.maxEntries) throw new Error('El número de archivos del backup no es válido.');
    const entries = new Map<string, Entry>(); let declared = 0;
    for (const entry of all) {
      if (entry.directory || !entry.encrypted || entry.zipCrypto || !Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0 || !Number.isSafeInteger(entry.compressedSize) || entry.compressedSize < 0 || entry.compressedSize > FULL_BACKUP_V3_LIMITS.archiveBytes || entries.has(entry.filename)) throw new Error('El ZIP contiene una entrada no válida, duplicada o sin AES.');
      declared += entry.uncompressedSize; if (declared > FULL_BACKUP_V3_LIMITS.expandedBytes + FULL_BACKUP_V3_LIMITS.manifestBytes) throw new Error('El tamaño descomprimido declarado supera el límite.'); entries.set(entry.filename, entry);
    }
    const manifestText = await readText(requiredEntry(entries, FULL_BACKUP_V3_MANIFEST_PATH), password, FULL_BACKUP_V3_LIMITS.manifestBytes);
    const format = identifyBackupFormat(manifestText);
    if (format === 1) throw new Error('Usa la importación de compatibilidad para el backup de formato 1.');
    const isV3 = format === 3;
    const manifest: AnyManifest = isV3
      ? parseFullBackupV3Manifest(manifestText, FULL_BACKUP_V3_MINIMUM_APP_VERSION)
      : parseFullBackupManifest(manifestText);
    const limits = isV3 ? FULL_BACKUP_V3_LIMITS : FULL_BACKUP_LIMITS;
    const tables: readonly string[] = isV3 ? FULL_DATA_TABLES_V3 : FULL_DATA_TABLES;
    const allowed = new Set([FULL_BACKUP_MANIFEST_PATH, ...manifest.files.map((file) => file.path)]);
    if (allowed.size !== all.length || all.some((entry) => !allowed.has(entry.filename))) throw new Error('El ZIP contiene archivos ausentes o no declarados.');
    for (const descriptor of manifest.files) if (requiredEntry(entries, descriptor.path).uncompressedSize !== descriptor.size) throw new Error(`El tamaño real de ${descriptor.path} no coincide con el manifiesto.`);
    const descriptor = manifest.files.find((file) => file.kind === 'data');
    if (!descriptor) throw new Error('Falta data.json.');
    const dataJson = await readText(requiredEntry(entries, descriptor.path), password, limits.dataBytes);
    if (textByteLength(dataJson) !== descriptor.size || await sha256Text(dataJson) !== descriptor.checksum) throw new Error('La integridad de data.json no es válida.');
    const data: AnyData = isV3
      ? parseFullBackupV3Data(dataJson, manifest as FullBackupManifestV3)
      : parseFullBackupData(dataJson, manifest as FullBackupManifest);
    if (isV3) assertFullBackupV3Relationships(data as FullBackupDataV3);
    const media: MediaValue[] = [];
    for (const photo of manifest.files.filter((item) => item.kind === 'photo')) {
      const thumbnail = manifest.files.find((item) => item.kind === 'thumbnail' && item.table === photo.table && item.id === photo.id);
      if (!thumbnail || !photo.table || !photo.id) throw new Error('Una fotografía no incluye su miniatura declarada.');
      const [blob, thumb] = await Promise.all([readBlob(requiredEntry(entries, photo.path), password, limits.mediaBytes), readBlob(requiredEntry(entries, thumbnail.path), password, limits.thumbnailBytes)]);
      if (blob.size !== photo.size || thumb.size !== thumbnail.size || await sha256Blob(blob) !== photo.checksum || await sha256Blob(thumb) !== thumbnail.checksum) throw new Error('La integridad de una fotografía no es válida.');
      media.push({ table: photo.table, id: photo.id, blob, thumbnail: thumb });
    }
    if (await manifestFingerprint(descriptor.checksum, manifest.files) !== manifest.contentFingerprint) throw new Error('La huella global del backup no es válida.');
    return { manifest, data, media, payloadBytes: manifest.files.reduce((sum, item) => sum + item.size, 0), tables };
  } finally { await reader.close(); }
}

export class FullBackupService {
  constructor(private readonly db: NutrIAstaMainDatabase = mainDatabase, private readonly repository: MainDatasetRepository = mainDatasetRepository, private readonly estimate: EstimateProvider = defaultEstimate) {}

  private async activeId() { await this.db.open(); const source = (await this.db.metadata.get(MAIN_META_KEYS.activeSource))?.value; const id = (await this.db.metadata.get(MAIN_META_KEYS.activeMainDatasetId))?.value; if (source !== 'main' || typeof id !== 'string') throw new Error('No existe un dataset principal activo.'); return id; }
  async status(): Promise<FullBackupStatus> {
    await this.repository.initialize(); const candidates = (await this.db.datasets.where('state').equals('staging').toArray()).filter((item) => item.source === 'format-2-backup' || item.source === 'format-3-backup').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const candidate = candidates[0]; const run = candidate ? await this.db.migrationRuns.where('candidateDatasetId').equals(candidate.id).first() : undefined;
    const manifest = candidate && run?.state === 'prepared' ? this.manifestFromDataset(candidate) : null;
    const rawSession = await this.repository.getMigrationSession();
    const sessionRun = rawSession ? await this.db.migrationRuns.get(rawSession.runId) : undefined;
    const fullSession = sessionRun?.sourceKind === 'format-2-backup' || sessionRun?.sourceKind === 'format-3-backup';
    return { lastBackupAt: ((await this.db.metadata.get(MAIN_META_KEYS.lastFullBackupAt))?.value as string | undefined) ?? null, prepared: candidate && run && manifest ? { candidateDatasetId: candidate.id, runId: run.id, previousDatasetId: await this.activeId(), manifest, payloadBytes: candidate.payloadBytes } : null, session: fullSession ? rawSession : null, blockedByOtherMigration: Boolean(rawSession && !fullSession) };
  }
  private manifestFromDataset(dataset: MainDatasetMetadata): AnyManifest | null {
    if (!dataset.sourceBackupId || !dataset.sourceExportedAt || !dataset.entityCounts) return null;
    const common = { format: 'nutriasta-full-backup' as const, appVersion: APP_VERSION, backupId: dataset.sourceBackupId, sourceDatasetId: dataset.sourceDatasetId, exportedAt: dataset.sourceExportedAt, files: [], contentFingerprint: dataset.contentFingerprint };
    return dataset.source === 'format-3-backup'
      ? { ...common, formatVersion: 3, databaseSchemaVersion: 6, minimumAppVersion: FULL_BACKUP_V3_MINIMUM_APP_VERSION, entityCounts: dataset.entityCounts as FullBackupManifestV3['entityCounts'] }
      : { ...common, formatVersion: 2, minimumAppVersion: FULL_BACKUP_MINIMUM_APP_VERSION, entityCounts: dataset.entityCounts as FullBackupManifest['entityCounts'] };
  }

  async create(password: string) {
    return trackUpdateBlockingOperation(async () => {
      assertFullBackupPassword(password); const datasetId = await this.activeId(); const built = await buildSnapshot(this.db, datasetId, FULL_DATA_TABLES_V3); const exportedAt = new Date().toISOString();
      const manifest: FullBackupManifestV3 = { format: 'nutriasta-full-backup', formatVersion: 3, databaseSchemaVersion: 6, minimumAppVersion: FULL_BACKUP_V3_MINIMUM_APP_VERSION, appVersion: APP_VERSION, backupId: createId('backup-full'), sourceDatasetId: datasetId, exportedAt, entityCounts: built.counts as FullBackupManifestV3['entityCounts'], files: built.files, contentFingerprint: built.fingerprint };
      parseFullBackupV3Manifest(JSON.stringify(manifest), FULL_BACKUP_V3_MINIMUM_APP_VERSION); const writer = new ZipWriter(new BlobWriter(FULL_BACKUP_MIME), { password, encryptionStrength: 3 });
      await writer.add(FULL_BACKUP_V3_DATA_PATH, new TextReader(built.dataJson));
      for (const media of built.media) { await writer.add(mediaPath(media.table, media.id), new BlobReader(media.blob)); await writer.add(mediaPath(media.table, media.id, true), new BlobReader(media.thumbnail)); }
      await writer.add(FULL_BACKUP_V3_MANIFEST_PATH, new TextReader(JSON.stringify(manifest))); const blob = await writer.close();
      if (blob.size > FULL_BACKUP_V3_LIMITS.archiveBytes) throw new Error('El backup cifrado supera el límite permitido.');
      return { blob, manifest, filename: `nutriasta-completo-${exportedAt.replace(/[:.]/g, '-')}.nutriasta.zip` };
    });
  }
  async download(password: string) { const result = await this.create(password); const url = URL.createObjectURL(result.blob); try { const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); await trackWrite(() => this.db.metadata.put({ key: MAIN_META_KEYS.lastFullBackupAt, value: result.manifest.exportedAt })); return result; } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); } }

  async prepare(file: File, password: string): Promise<PreparedFullRestore> {
    return trackUpdateBlockingOperation(async () => {
      if (await this.repository.getMigrationSession()) throw new Error('Hay una activación pendiente de confirmar o revertir.');
      const decoded = await decodeFullBackup(file, password); const previousDatasetId = await this.activeId(); const estimate = await this.estimate();
      if (typeof estimate.usage !== 'number' || typeof estimate.quota !== 'number') throw new Error('Safari no informa del espacio disponible; la restauración segura no puede prepararse.');
      const required = Math.ceil(decoded.payloadBytes * 1.5) + 10 * 1024 * 1024; if (estimate.quota - estimate.usage < required) throw new Error('No hay espacio suficiente para mantener el dataset actual y el candidato.');
      const id = createId('main-dataset'); const runId = createId('restore-full'); const now = new Date().toISOString();
      const isV3 = decoded.manifest.formatVersion === 3;
      const sourceKind = isV3 ? 'format-3-backup' : 'format-2-backup';
      const dataset: MainDatasetMetadata = { id, state: 'staging', source: sourceKind, createdAt: now, updatedAt: now, recordCount: decoded.manifest.entityCounts.legacyViabilityRecords, photoCount: decoded.manifest.entityCounts.legacyViabilityPhotos + decoded.manifest.entityCounts.foodPhotos, payloadBytes: decoded.payloadBytes, sourceFingerprint: decoded.manifest.contentFingerprint, contentFingerprint: decoded.manifest.contentFingerprint, sourceDatasetId: decoded.manifest.sourceDatasetId, sourceBackupId: decoded.manifest.backupId, sourceExportedAt: decoded.manifest.exportedAt, entityCounts: decoded.manifest.entityCounts };
      const run: MigrationRun = { id: runId, state: 'staging', sourceKind, sourceFingerprint: decoded.manifest.contentFingerprint, contentFingerprint: decoded.manifest.contentFingerprint, sourceDatasetId: decoded.manifest.sourceDatasetId, candidateDatasetId: id, createdAt: now, updatedAt: now };
      await trackWrite(() => this.db.transaction('rw', this.db.datasets, this.db.migrationRuns, async () => { await this.db.datasets.add(dataset); await this.db.migrationRuns.add(run); }));
      try {
        for (const tableName of decoded.tables) {
          const mediaById = new Map(decoded.media.filter((item) => item.table === tableName).map((item) => [item.id, item]));
          const rows = decoded.data[tableName as keyof AnyData].map((row) => { const media = mediaById.get(String(row.id)); return media ? { ...row, datasetId: id, blob: media.blob, thumbnail: media.thumbnail } : { ...row, datasetId: id }; });
          for (let index = 0; index < rows.length; index += 100) await trackWrite(() => this.db.table(tableName).bulkPut(rows.slice(index, index + 100)));
        }
        const built = await buildSnapshot(this.db, id, decoded.tables); if (built.fingerprint !== decoded.manifest.contentFingerprint || JSON.stringify(built.counts) !== JSON.stringify(decoded.manifest.entityCounts)) throw new Error('La verificación del dataset temporal ha fallado.');
        const verifiedAt = new Date().toISOString(); await trackWrite(() => this.db.transaction('rw', this.db.datasets, this.db.migrationRuns, async () => { await this.db.datasets.update(id, { updatedAt: verifiedAt }); await this.db.migrationRuns.update(runId, { state: 'prepared', verifiedAt, updatedAt: verifiedAt }); }));
        return { candidateDatasetId: id, runId, previousDatasetId, manifest: decoded.manifest, payloadBytes: decoded.payloadBytes };
      } catch (error) { await this.repository.cancelCandidate(id).catch(() => undefined); throw new Error('No se pudo preparar la restauración. El dataset activo sigue intacto.', { cause: error }); }
    });
  }
  async cancel(prepared: PreparedFullRestore) { await trackUpdateBlockingOperation(() => this.repository.cancelCandidate(prepared.candidateDatasetId)); }
  async activate(prepared: PreparedFullRestore) { return trackUpdateBlockingOperation(async () => { if (await this.activeId() !== prepared.previousDatasetId) throw new Error('El dataset activo cambió desde la preparación.'); const tables = prepared.manifest.formatVersion === 3 ? FULL_DATA_TABLES_V3 : FULL_DATA_TABLES; const built = await buildSnapshot(this.db, prepared.candidateDatasetId, tables); if (built.fingerprint !== prepared.manifest.contentFingerprint) throw new Error('El candidato ya no coincide con el backup.'); return this.repository.activateCandidate(prepared.candidateDatasetId); }); }
  async rollback(session: MainMigrationSession) { return trackUpdateBlockingOperation(() => this.repository.rollback(session)); }
  async reactivate(session: MainMigrationSession) { return trackUpdateBlockingOperation(() => this.repository.reactivate(session)); }
  async confirm(session: MainMigrationSession) { await trackUpdateBlockingOperation(() => this.repository.confirm(session)); }
}

export const fullBackupService = new FullBackupService();
