import type { FullBackupFileDescriptor } from '@/backup/full-backup-types';

export const FULL_DATA_TABLES_V3 = [
  'legacyViabilityRecords',
  'legacyViabilityPhotos',
  'profiles',
  'nutritionTargetPeriods',
  'foods',
  'foodPortions',
  'foodPhotos',
  'diaryDays',
  'mealEntries',
  'mealItems',
  'waterEntries',
  'trainingDayFlags',
  'recipes',
  'recipeItems',
  'trainingSettings',
  'trainingTypes',
  'exerciseCatalog',
  'trainingSessions',
  'trainingSessionExercises',
  'trainingSets',
  'weightEntries',
  'inventoryItems',
  'inventoryMovements',
  'inventoryConsumptionDecisions',
  'shoppingLists',
  'shoppingListItems',
] as const;

export type FullDataTableV3 = typeof FULL_DATA_TABLES_V3[number];
export type FullBackupDataV3 = Record<FullDataTableV3, Array<Record<string, unknown>>>;

export interface FullBackupManifestV3 {
  format: 'nutriasta-full-backup';
  formatVersion: 3;
  databaseSchemaVersion: 6;
  minimumAppVersion: string;
  appVersion: string;
  backupId: string;
  sourceDatasetId: string;
  exportedAt: string;
  entityCounts: Record<FullDataTableV3, number>;
  files: FullBackupFileDescriptor[];
  contentFingerprint: string;
}
