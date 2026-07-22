import { afterEach, describe, expect, it } from 'vitest';

import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { MAIN_DATABASE_NAME, MAIN_DATABASE_STORES, MAIN_DATABASE_VERSION } from '@/storage/main-schema';

let database: NutrIAstaMainDatabase | null = null;

afterEach(async () => {
  if (database) {
    database.close();
    await database.delete();
    database = null;
  }
});

describe('base paralela del MVP 1', () => {
  it('usa un nombre distinto y un esquema inicial independiente', async () => {
    expect(MAIN_DATABASE_NAME).toBe('nutriasta-main');
    expect(MAIN_DATABASE_VERSION).toBe(1);
    expect(Object.keys(MAIN_DATABASE_STORES).sort()).toEqual([
      'datasets',
      'legacyViabilityPhotos',
      'legacyViabilityRecords',
      'metadata',
      'migrationRuns',
    ]);
    database = new NutrIAstaMainDatabase(`main-schema-${crypto.randomUUID()}`);
    await database.open();
    expect(database.verno).toBe(1);
    expect(database.tables.map(({ name }) => name).sort()).toEqual(Object.keys(MAIN_DATABASE_STORES).sort());
  });
});
