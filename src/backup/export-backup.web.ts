import {
  BlobReader,
  BlobWriter,
  TextReader,
  ZipWriter,
} from '@zip.js/zip.js';

import {
  BACKUP_MIME_TYPE,
  BACKUP_LIMITS,
  MANIFEST_PATH,
  MINIMUM_BACKUP_APP_VERSION,
  RECORDS_PATH,
  assertValidPassword,
  parseBackupManifest,
  parseRecordsPayload,
  textByteLength,
  type BackupRecordsPayload,
} from '@/backup/backup-format';
import { datasetRepository } from '@/storage/dataset-repository.web';
import { APP_VERSION, BACKUP_FORMAT_VERSION } from '@/storage/schema';
import type { BackupFileDescriptor, BackupManifest } from '@/storage/dataset-types';
import { createId, sha256Blob, sha256Text } from '@/utils/crypto';

export interface ExportedBackup {
  blob: Blob;
  filename: string;
  exportedAt: string;
  manifest: BackupManifest;
}

export async function createEncryptedBackup(password: string): Promise<ExportedBackup> {
  assertValidPassword(password);
  const snapshot = await datasetRepository.getActiveSnapshot();
  const exportedAt = new Date().toISOString();
  const recordsPayload: BackupRecordsPayload = {
    records: snapshot.records.map(({ datasetId: _datasetId, ...record }) => record),
  };
  const recordsJson = JSON.stringify(recordsPayload);
  parseRecordsPayload(recordsJson);
  const files: BackupFileDescriptor[] = [
    {
      path: RECORDS_PATH,
      kind: 'records',
      mimeType: 'application/json',
      size: textByteLength(recordsJson),
      checksum: await sha256Text(recordsJson),
    },
  ];

  for (const photo of snapshot.photos) {
    if (
      photo.mimeType !== 'image/jpeg' ||
      photo.blob.size > BACKUP_LIMITS.photoBytes ||
      photo.thumbnail.size > BACKUP_LIMITS.thumbnailBytes
    ) {
      throw new Error('La fotografía no cumple los límites del formato de backup.');
    }
    const photoPath = `photos/${photo.id}.jpg`;
    const thumbnailPath = `photos/${photo.id}-thumbnail.jpg`;
    files.push(
      {
        path: photoPath,
        kind: 'photo',
        id: photo.id,
        mimeType: photo.mimeType,
        size: photo.blob.size,
        checksum: await sha256Blob(photo.blob),
        width: photo.width,
        height: photo.height,
        createdAt: photo.createdAt,
      },
      {
        path: thumbnailPath,
        kind: 'thumbnail',
        id: photo.id,
        mimeType: photo.thumbnail.type || 'image/jpeg',
        size: photo.thumbnail.size,
        checksum: await sha256Blob(photo.thumbnail),
      },
    );
  }

  const manifest: BackupManifest = {
    format: 'nutriasta-backup',
    formatVersion: BACKUP_FORMAT_VERSION,
    minimumAppVersion: MINIMUM_BACKUP_APP_VERSION,
    backupId: createId('backup'),
    exportedAt,
    appVersion: APP_VERSION,
    sourceDatasetId: snapshot.dataset.id,
    recordCount: snapshot.records.length,
    photoCount: snapshot.photos.length,
    files,
  };
  parseBackupManifest(JSON.stringify(manifest));

  const writer = new ZipWriter(new BlobWriter(BACKUP_MIME_TYPE), {
    password,
    encryptionStrength: 3,
  });
  await writer.add(RECORDS_PATH, new TextReader(recordsJson));
  for (const photo of snapshot.photos) {
    await writer.add(`photos/${photo.id}.jpg`, new BlobReader(photo.blob));
    await writer.add(`photos/${photo.id}-thumbnail.jpg`, new BlobReader(photo.thumbnail));
  }
  await writer.add(MANIFEST_PATH, new TextReader(JSON.stringify(manifest)));
  const blob = await writer.close();
  if (blob.size > BACKUP_LIMITS.archiveBytes) {
    throw new Error('El backup cifrado supera el tamaño máximo permitido.');
  }
  const compactDate = exportedAt.replace(/[:.]/g, '-');
  return { blob, manifest, exportedAt, filename: `nutriasta-${compactDate}.nutriasta` };
}

export async function downloadEncryptedBackup(password: string): Promise<ExportedBackup> {
  const result = await createEncryptedBackup(password);
  const url = URL.createObjectURL(result.blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    await datasetRepository.setLastBackupAt(result.exportedAt);
    return result;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}
