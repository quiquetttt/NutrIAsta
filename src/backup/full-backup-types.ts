import type { MainMigrationSession } from '@/storage/main-dataset-types';

export const FULL_DATA_TABLES = [
  'legacyViabilityRecords', 'legacyViabilityPhotos', 'profiles', 'nutritionTargetPeriods',
  'foods', 'foodPortions', 'foodPhotos', 'diaryDays', 'mealEntries', 'mealItems',
  'waterEntries', 'trainingDayFlags', 'recipes', 'recipeItems',
] as const;
export type FullDataTable = typeof FULL_DATA_TABLES[number];
export type FullBackupData = Record<FullDataTable, Array<Record<string, unknown>>>;

export interface FullBackupFileDescriptor {
  path: string;
  kind: 'data' | 'photo' | 'thumbnail';
  table?: 'legacyViabilityPhotos' | 'foodPhotos';
  id?: string;
  size: number;
  checksum: string;
  mimeType: string;
}

export interface FullBackupManifest {
  format: 'nutriasta-full-backup';
  formatVersion: 2;
  minimumAppVersion: string;
  appVersion: string;
  backupId: string;
  sourceDatasetId: string;
  exportedAt: string;
  entityCounts: Record<FullDataTable, number>;
  files: FullBackupFileDescriptor[];
  contentFingerprint: string;
}

export interface PreparedFullRestore {
  candidateDatasetId: string;
  runId: string;
  previousDatasetId: string;
  manifest: FullBackupManifest;
  payloadBytes: number;
}

export interface FullBackupStatus {
  lastBackupAt: string | null;
  prepared: PreparedFullRestore | null;
  session: MainMigrationSession | null;
  blockedByOtherMigration: boolean;
}
