import { decodeFormat1Backup } from '@/backup/decode-format-1.web';
import { datasetRepository } from '@/storage/dataset-repository.web';
import type { BackupManifest, RestoreSession } from '@/storage/dataset-types';
import { sha256Blob } from '@/utils/crypto';

export interface PreparedRestore {
  candidateDatasetId: string;
  previousDatasetId: string;
  manifest: BackupManifest;
  totalBytes: number;
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
  let candidateDatasetId: string | null = null;
  try {
    const decoded = await decodeFormat1Backup(file, password);
    await assertCandidateSpace(decoded.totalBytes);
    const previousDatasetId = await datasetRepository.getActiveDatasetId();
    candidateDatasetId = await datasetRepository.stageSnapshot(decoded.snapshot, decoded.manifest.backupId);
    const staged = await datasetRepository.getDatasetSnapshot(candidateDatasetId);
    if (
      staged.records.length !== decoded.manifest.recordCount
      || staged.photos.length !== decoded.manifest.photoCount
    ) {
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
    return {
      candidateDatasetId,
      previousDatasetId,
      manifest: decoded.manifest,
      totalBytes: decoded.totalBytes,
    };
  } catch (error) {
    if (candidateDatasetId) await datasetRepository.discardCandidate(candidateDatasetId).catch(() => undefined);
    throw new Error('No se pudo preparar la restauración. El dataset activo no ha cambiado.', { cause: error });
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
