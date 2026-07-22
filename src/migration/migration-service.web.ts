import type { PreparedMainMigration, MainMigrationStatus, StorageSpaceCheck } from '@/migration/migration-types';
import { legacySourceReader, type LegacySourceReader } from '@/migration/legacy-source-reader.web';
import { mainDatasetRepository, type MainDatasetRepository } from '@/storage/main-dataset-repository.web';
import type {
  MainCandidatePayload,
  MainDatasetSnapshot,
  MainMigrationSession,
} from '@/storage/main-dataset-types';
import type { DatasetSnapshot, PhotoAsset, ViabilityRecord } from '@/storage/dataset-types';
import { trackUpdateBlockingOperation } from '@/storage/write-tracker';
import { sha256Blob, sha256Text } from '@/utils/crypto';

const SPACE_OVERHEAD_BYTES = 10 * 1024 * 1024;

type StorageEstimateProvider = () => Promise<StorageEstimate>;

function defaultStorageEstimate(): Promise<StorageEstimate> {
  if (!navigator.storage?.estimate) return Promise.resolve({});
  return navigator.storage.estimate();
}

function stripRecordDatasetId(record: ViabilityRecord) {
  const { datasetId: _datasetId, ...value } = record;
  return value;
}

function stripPhotoBlobs(photo: PhotoAsset) {
  const { datasetId: _datasetId, blob: _blob, thumbnail: _thumbnail, ...value } = photo;
  return value;
}

export async function fingerprintSnapshotContent(
  snapshot: Pick<DatasetSnapshot, 'records' | 'photos'>,
): Promise<string> {
  const photos = [];
  for (const photo of [...snapshot.photos].sort((left, right) => left.id.localeCompare(right.id))) {
    const [blobChecksum, thumbnailChecksum] = await Promise.all([
      sha256Blob(photo.blob),
      sha256Blob(photo.thumbnail),
    ]);
    photos.push({ ...stripPhotoBlobs(photo), blobChecksum, thumbnailChecksum });
  }
  return sha256Text(JSON.stringify({
    records: snapshot.records.map(stripRecordDatasetId).sort((left, right) => left.id.localeCompare(right.id)),
    photos,
  }));
}

export async function assertCandidateInternalIntegrity(candidate: MainDatasetSnapshot): Promise<void> {
  if (
    candidate.dataset.recordCount !== candidate.records.length
    || candidate.dataset.photoCount !== candidate.photos.length
  ) {
    throw new Error('Los recuentos internos del candidato no son válidos.');
  }
  const fingerprint = await fingerprintSnapshotContent(candidate);
  if (fingerprint !== candidate.dataset.contentFingerprint) {
    throw new Error('La huella interna del candidato no es válida.');
  }
}

export async function assertEquivalentSnapshots(
  source: DatasetSnapshot,
  candidate: MainDatasetSnapshot,
): Promise<void> {
  if (
    source.records.length !== candidate.records.length
    || source.photos.length !== candidate.photos.length
    || candidate.dataset.recordCount !== candidate.records.length
    || candidate.dataset.photoCount !== candidate.photos.length
  ) {
    throw new Error('Los recuentos del candidato no coinciden con el origen.');
  }

  const sourceRecords = source.records.map(stripRecordDatasetId).sort((left, right) => left.id.localeCompare(right.id));
  const candidateRecords = candidate.records.map(stripRecordDatasetId).sort((left, right) => left.id.localeCompare(right.id));
  if (JSON.stringify(sourceRecords) !== JSON.stringify(candidateRecords)) {
    throw new Error('Los registros del candidato no coinciden con el origen.');
  }

  const sourcePhotos = [...source.photos].sort((left, right) => left.id.localeCompare(right.id));
  const candidatePhotos = [...candidate.photos].sort((left, right) => left.id.localeCompare(right.id));
  for (let index = 0; index < sourcePhotos.length; index += 1) {
    const sourcePhoto = sourcePhotos[index];
    const candidatePhoto = candidatePhotos[index];
    if (!sourcePhoto || !candidatePhoto) throw new Error('Falta una fotografía en el candidato.');
    if (JSON.stringify(stripPhotoBlobs(sourcePhoto)) !== JSON.stringify(stripPhotoBlobs(candidatePhoto))) {
      throw new Error('Los metadatos de una fotografía no coinciden con el origen.');
    }
    const [sourceBlob, sourceThumbnail, candidateBlob, candidateThumbnail] = await Promise.all([
      sha256Blob(sourcePhoto.blob),
      sha256Blob(sourcePhoto.thumbnail),
      sha256Blob(candidatePhoto.blob),
      sha256Blob(candidatePhoto.thumbnail),
    ]);
    if (
      sourceBlob !== sourcePhoto.checksum
      || sourceThumbnail !== sourcePhoto.thumbnailChecksum
      || candidateBlob !== sourceBlob
      || candidateThumbnail !== sourceThumbnail
    ) {
      throw new Error('La verificación de una fotografía candidata ha fallado.');
    }
  }
}

export async function assertCandidateSpace(
  payloadBytes: number,
  estimateProvider: StorageEstimateProvider = defaultStorageEstimate,
): Promise<StorageSpaceCheck> {
  if (!Number.isSafeInteger(payloadBytes) || payloadBytes < 0) {
    throw new Error('El tamaño del candidato no es válido.');
  }
  const estimate = await estimateProvider();
  if (typeof estimate.usage !== 'number' || typeof estimate.quota !== 'number') {
    throw new Error('Safari no proporciona una estimación de espacio; la migración no puede prepararse con seguridad.');
  }
  const requiredAdditionalBytes = Math.ceil(payloadBytes * 1.5) + SPACE_OVERHEAD_BYTES;
  const available = Math.max(0, estimate.quota - estimate.usage);
  if (available < requiredAdditionalBytes) {
    throw new Error('No hay espacio suficiente para conservar la base 0.1.1 y preparar el candidato.');
  }
  return {
    payloadBytes,
    requiredAdditionalBytes,
    usage: estimate.usage,
    quota: estimate.quota,
    available,
  };
}

function toPrepared(
  snapshot: MainDatasetSnapshot,
  runId: string,
  sourceKind: PreparedMainMigration['sourceKind'],
): PreparedMainMigration {
  return {
    candidateDatasetId: snapshot.dataset.id,
    runId,
    sourceKind,
    sourceFingerprint: snapshot.dataset.sourceFingerprint,
    sourceDatasetId: snapshot.dataset.sourceDatasetId,
    payloadBytes: snapshot.dataset.payloadBytes,
    snapshot,
  };
}

export class MigrationService {
  constructor(
    private readonly repository: MainDatasetRepository = mainDatasetRepository,
    private readonly sourceReader: LegacySourceReader = legacySourceReader,
    private readonly estimateProvider: StorageEstimateProvider = defaultStorageEstimate,
  ) {}

  async initialize(): Promise<void> {
    await this.repository.initialize();
  }

  async getStatus(): Promise<MainMigrationStatus> {
    await this.repository.initialize();
    const preparedSnapshot = await this.repository.getPreparedCandidate();
    const preparedRun = preparedSnapshot
      ? await this.repository.getRunForCandidate(preparedSnapshot.dataset.id)
      : undefined;
    return {
      activeSource: await this.repository.getActiveSource(),
      activeMainSnapshot: await this.repository.getActiveMainSnapshot(),
      prepared: preparedSnapshot && preparedRun
        ? toPrepared(
            preparedSnapshot,
            preparedRun.id,
            preparedRun.sourceKind === 'legacy-database' ? 'legacy-database' : 'format-1-backup',
          )
        : null,
      session: await this.repository.getMigrationSession(),
    };
  }

  async prepareFromLegacy(): Promise<PreparedMainMigration> {
    return trackUpdateBlockingOperation(async () => {
      await this.repository.initialize();
      const before = await this.sourceReader.inspect();
      const existing = await this.repository.getPreparedCandidate();
      if (existing?.dataset.sourceFingerprint === before.fingerprint) {
        const runId = await this.runIdForPrepared(existing.dataset.id);
        await assertEquivalentSnapshots(before.activeSnapshot, existing);
        return toPrepared(existing, runId, 'legacy-database');
      }
      if (existing) await this.repository.cancelCandidate(existing.dataset.id);
      await assertCandidateSpace(before.payloadBytes, this.estimateProvider);

      const payload: MainCandidatePayload = {
        records: before.activeSnapshot.records,
        photos: before.activeSnapshot.photos,
        sourceFingerprint: before.fingerprint,
        contentFingerprint: await fingerprintSnapshotContent(before.activeSnapshot),
        sourceDatasetId: before.activeSnapshot.dataset.id,
        payloadBytes: before.payloadBytes,
      };
      let candidateDatasetId: string | null = null;
      try {
        const staged = await this.repository.stageCandidate(payload, 'legacy-database');
        candidateDatasetId = staged.datasetId;
        const candidate = await this.repository.getDatasetSnapshot(staged.datasetId);
        await assertEquivalentSnapshots(before.activeSnapshot, candidate);
        await assertCandidateInternalIntegrity(candidate);
        const after = await this.sourceReader.inspect();
        if (after.fingerprint !== before.fingerprint) {
          throw new Error('La base 0.1.1 cambió durante la copia; el candidato se ha descartado.');
        }
        return toPrepared(candidate, staged.runId, 'legacy-database');
      } catch (error) {
        if (candidateDatasetId) await this.repository.cancelCandidate(candidateDatasetId).catch(() => undefined);
        throw error;
      }
    });
  }

  async cancel(prepared: PreparedMainMigration): Promise<void> {
    await trackUpdateBlockingOperation(() => this.repository.cancelCandidate(prepared.candidateDatasetId));
  }

  async activate(prepared: PreparedMainMigration): Promise<MainMigrationSession> {
    return trackUpdateBlockingOperation(async () => {
      const candidate = await this.repository.getDatasetSnapshot(prepared.candidateDatasetId);
      if (
        candidate.dataset.sourceFingerprint !== prepared.sourceFingerprint
        || candidate.dataset.payloadBytes !== prepared.payloadBytes
      ) {
        throw new Error('El candidato preparado ha cambiado y no puede activarse.');
      }
      await assertCandidateInternalIntegrity(candidate);
      if (prepared.sourceKind === 'legacy-database') {
        const source = await this.sourceReader.inspect();
        if (source.fingerprint !== prepared.sourceFingerprint) {
          throw new Error('La base 0.1.1 cambió después de preparar el candidato.');
        }
        await assertEquivalentSnapshots(source.activeSnapshot, candidate);
      }
      return this.repository.activateCandidate(prepared.candidateDatasetId);
    });
  }

  async rollback(session: MainMigrationSession): Promise<MainMigrationSession> {
    return trackUpdateBlockingOperation(() => this.repository.rollback(session));
  }

  async reactivate(session: MainMigrationSession): Promise<MainMigrationSession> {
    return trackUpdateBlockingOperation(() => this.repository.reactivate(session));
  }

  async confirm(session: MainMigrationSession): Promise<void> {
    await trackUpdateBlockingOperation(() => this.repository.confirm(session));
  }

  async verifyLegacyUnchanged(expectedFingerprint: string): Promise<void> {
    const current = await this.sourceReader.inspect();
    if (current.fingerprint !== expectedFingerprint) {
      throw new Error('La base 0.1.1 ya no coincide con la huella original.');
    }
  }

  private async runIdForPrepared(datasetId: string): Promise<string> {
    const run = await this.repository.getRunForCandidate(datasetId);
    if (!run) throw new Error('No existe la ejecución asociada al candidato preparado.');
    return run.id;
  }
}

export const migrationService = new MigrationService();
