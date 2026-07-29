export const DATABASE_NAME = 'nutriasta';
export const DATABASE_VERSION = 1;

export const DATABASE_STORES = {
  metadata: '&key',
  datasets: '&id,state,createdAt',
  viabilityRecords: '&[datasetId+id],datasetId,updatedAt',
  photos: '&[datasetId+id],datasetId,createdAt',
} as const;

export const META_KEYS = {
  activeDatasetId: 'activeDatasetId',
  lastBackupAt: 'lastBackupAt',
  restoreCandidateId: 'restoreCandidateId',
  restorePreviousId: 'restorePreviousId',
  restorePhase: 'restorePhase',
} as const;

export const APP_VERSION = '0.3.2';
export const BACKUP_FORMAT_VERSION = 1;
