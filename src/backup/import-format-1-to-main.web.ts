import { decodeFormat1Backup } from '@/backup/decode-format-1.web';
import type { PreparedMainMigration } from '@/migration/migration-types';
import {
  assertCandidateInternalIntegrity,
  assertCandidateSpace,
  assertEquivalentSnapshots,
  fingerprintSnapshotContent,
} from '@/migration/migration-service.web';
import { mainDatasetRepository, type MainDatasetRepository } from '@/storage/main-dataset-repository.web';
import type { MainCandidatePayload } from '@/storage/main-dataset-types';
import { trackUpdateBlockingOperation } from '@/storage/write-tracker';

export async function prepareFormat1BackupForMain(
  file: File,
  password: string,
  repository: MainDatasetRepository = mainDatasetRepository,
  estimateProvider?: () => Promise<StorageEstimate>,
): Promise<PreparedMainMigration> {
  return trackUpdateBlockingOperation(async () => {
    await repository.initialize();
    const decoded = await decodeFormat1Backup(file, password);
    await assertCandidateSpace(decoded.totalBytes, estimateProvider);
    const existing = await repository.getPreparedCandidate();
    if (existing) await repository.cancelCandidate(existing.dataset.id);

    const payload: MainCandidatePayload = {
      records: decoded.snapshot.records,
      photos: decoded.snapshot.photos,
      sourceFingerprint: decoded.fingerprint,
      contentFingerprint: await fingerprintSnapshotContent(decoded.snapshot),
      sourceDatasetId: decoded.manifest.sourceDatasetId,
      sourceBackupId: decoded.manifest.backupId,
      payloadBytes: decoded.totalBytes,
    };
    let candidateDatasetId: string | null = null;
    try {
      const staged = await repository.stageCandidate(payload, 'format-1-backup');
      candidateDatasetId = staged.datasetId;
      const snapshot = await repository.getDatasetSnapshot(staged.datasetId);
      await assertEquivalentSnapshots(
        {
          dataset: {
            id: decoded.manifest.sourceDatasetId,
            state: 'active',
            source: 'backup',
            createdAt: decoded.manifest.exportedAt,
            updatedAt: decoded.manifest.exportedAt,
            recordCount: decoded.snapshot.records.length,
            photoCount: decoded.snapshot.photos.length,
          },
          records: decoded.snapshot.records,
          photos: decoded.snapshot.photos,
        },
        snapshot,
      );
      await assertCandidateInternalIntegrity(snapshot);
      return {
        candidateDatasetId: staged.datasetId,
        runId: staged.runId,
        sourceKind: 'format-1-backup',
        sourceFingerprint: decoded.fingerprint,
        sourceDatasetId: decoded.manifest.sourceDatasetId,
        payloadBytes: decoded.totalBytes,
        snapshot,
      };
    } catch (error) {
      if (candidateDatasetId) await repository.cancelCandidate(candidateDatasetId).catch(() => undefined);
      throw new Error('No se pudo preparar el backup en la base paralela. La fuente activa no ha cambiado.', {
        cause: error,
      });
    }
  });
}
