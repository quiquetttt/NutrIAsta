import type { PhotoAsset, ViabilityRecord } from '@/storage/dataset-types';

export type MainActiveSource = 'legacy' | 'main';
export type MainDatasetState = 'staging' | 'active' | 'rollback' | 'abandoned';
export type MainDatasetSource = 'legacy-copy' | 'format-1-backup' | 'format-2-backup';
export type MigrationRunState = 'staging' | 'prepared' | 'activated' | 'rolledBack' | 'confirmed' | 'abandoned';
export type MigrationSourceKind = 'legacy-database' | 'format-1-backup' | 'format-2-backup';

export interface MainMetadataEntry {
  key: string;
  value: unknown;
}

export interface MainDatasetMetadata {
  id: string;
  state: MainDatasetState;
  source: MainDatasetSource;
  createdAt: string;
  updatedAt: string;
  recordCount: number;
  photoCount: number;
  payloadBytes: number;
  sourceFingerprint: string;
  contentFingerprint: string;
  sourceDatasetId: string;
  sourceBackupId?: string;
  sourceExportedAt?: string;
  entityCounts?: Record<string, number>;
  confirmedAt?: string;
}

export interface MigrationRun {
  id: string;
  state: MigrationRunState;
  sourceKind: MigrationSourceKind;
  sourceFingerprint: string;
  contentFingerprint: string;
  sourceDatasetId: string;
  candidateDatasetId: string;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  activatedAt?: string;
  confirmedAt?: string;
  abandonedReason?: string;
}

export type MainLegacyViabilityRecord = ViabilityRecord;
export type MainLegacyViabilityPhoto = PhotoAsset;

export interface MainDatasetSnapshot {
  dataset: MainDatasetMetadata;
  records: MainLegacyViabilityRecord[];
  photos: MainLegacyViabilityPhoto[];
}

export interface MainCandidatePayload {
  records: MainLegacyViabilityRecord[];
  photos: MainLegacyViabilityPhoto[];
  sourceFingerprint: string;
  contentFingerprint: string;
  sourceDatasetId: string;
  payloadBytes: number;
  sourceBackupId?: string;
}

export interface MainMigrationSession {
  candidateDatasetId: string;
  previousSource: MainActiveSource;
  previousMainDatasetId: string | null;
  runId: string;
  phase: 'activated' | 'rolledBack';
}
