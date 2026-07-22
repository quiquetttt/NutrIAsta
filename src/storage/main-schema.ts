export const MAIN_DATABASE_NAME = 'nutriasta-main';
export const MAIN_DATABASE_VERSION = 2;

export const MAIN_DATABASE_STORES_V1 = {
  metadata: '&key',
  datasets: '&id,state,source,createdAt',
  migrationRuns: '&id,state,sourceKind,createdAt,candidateDatasetId',
  legacyViabilityRecords: '&[datasetId+id],datasetId,updatedAt',
  legacyViabilityPhotos: '&[datasetId+id],datasetId,createdAt',
} as const;

export const MAIN_DATABASE_STORES = {
  ...MAIN_DATABASE_STORES_V1,
  profiles: '&[datasetId+id],datasetId,updatedAt',
  nutritionTargetPeriods: '&[datasetId+id],datasetId,[datasetId+effectiveFrom],effectiveFrom',
} as const;
export const MAIN_META_KEYS = {
  activeSource: 'activeSource',
  activeMainDatasetId: 'activeMainDatasetId',
  migrationCandidateId: 'migrationCandidateId',
  migrationPreviousSource: 'migrationPreviousSource',
  migrationPreviousMainDatasetId: 'migrationPreviousMainDatasetId',
  migrationRunId: 'migrationRunId',
  migrationPhase: 'migrationPhase',
} as const;
