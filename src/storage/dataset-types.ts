export type DatasetState = 'active' | 'staging' | 'rollback' | 'abandoned';

export type DatasetSource = 'new' | 'backup';

export interface MetadataEntry {
  key: string;
  value: unknown;
}

export interface DatasetMetadata {
  id: string;
  state: DatasetState;
  source: DatasetSource;
  createdAt: string;
  updatedAt: string;
  recordCount: number;
  photoCount: number;
  sourceBackupId?: string;
  confirmedAt?: string;
}

export interface ViabilityRecord {
  datasetId: string;
  id: 'registro-prueba-001';
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoAsset {
  datasetId: string;
  id: 'foto-prueba-001';
  blob: Blob;
  thumbnail: Blob;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  checksum: string;
  thumbnailChecksum: string;
  createdAt: string;
}

export interface DatasetSnapshot {
  dataset: DatasetMetadata;
  records: ViabilityRecord[];
  photos: PhotoAsset[];
}

export interface StorageStatus {
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
  lastBackupAt: string | null;
}

export interface RestoreSession {
  candidateDatasetId: string;
  previousDatasetId: string;
  phase: 'activated' | 'rolledBack';
}

export interface BackupFileDescriptor {
  path: string;
  kind: 'records' | 'photo' | 'thumbnail';
  id?: string;
  mimeType: string;
  size: number;
  checksum: string;
  width?: number;
  height?: number;
  createdAt?: string;
}

export interface BackupManifest {
  format: 'nutriasta-backup';
  formatVersion: 1;
  minimumAppVersion: string;
  backupId: string;
  exportedAt: string;
  appVersion: string;
  sourceDatasetId: string;
  recordCount: number;
  photoCount: number;
  files: BackupFileDescriptor[];
}
