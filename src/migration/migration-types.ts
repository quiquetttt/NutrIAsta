import type { DatasetSnapshot } from '@/storage/dataset-types';
import type { MainDatasetSnapshot, MainMigrationSession } from '@/storage/main-dataset-types';

export interface LegacySourceInspection {
  databaseName: string;
  databaseVersion: number;
  storeNames: string[];
  activeSnapshot: DatasetSnapshot;
  fingerprint: string;
  payloadBytes: number;
  lastBackupAt: string | null;
}

export interface PreparedMainMigration {
  candidateDatasetId: string;
  runId: string;
  sourceKind: 'legacy-database' | 'format-1-backup';
  sourceFingerprint: string;
  sourceDatasetId: string;
  payloadBytes: number;
  snapshot: MainDatasetSnapshot;
}

export interface MainMigrationStatus {
  activeSource: 'legacy' | 'main';
  activeMainSnapshot: MainDatasetSnapshot | null;
  prepared: PreparedMainMigration | null;
  session: MainMigrationSession | null;
}

export interface StorageSpaceCheck {
  payloadBytes: number;
  requiredAdditionalBytes: number;
  usage: number;
  quota: number;
  available: number;
}
