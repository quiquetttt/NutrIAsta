import { describe, expect, it } from 'vitest';

import { DATABASE_STORES, DATABASE_VERSION, META_KEYS } from '@/storage/schema';

describe('esquema de viabilidad', () => {
  it('mantiene una base versionada y todas las tablas separadas por dataset', () => {
    expect(DATABASE_VERSION).toBe(1);
    expect(DATABASE_STORES.viabilityRecords).toContain('datasetId');
    expect(DATABASE_STORES.photos).toContain('datasetId');
    expect(META_KEYS.activeDatasetId).toBe('activeDatasetId');
  });
});
