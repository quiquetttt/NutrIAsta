import { afterEach, describe, expect, it } from 'vitest';

import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { MAIN_DATABASE_NAME, MAIN_DATABASE_STORES, MAIN_DATABASE_STORES_V1, MAIN_DATABASE_VERSION } from '@/storage/main-schema';

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
    expect(MAIN_DATABASE_VERSION).toBe(3);
    expect(Object.keys(MAIN_DATABASE_STORES).sort()).toEqual([
      'datasets',
      'foodPhotos',
      'foodPortions',
      'foods',
      'legacyViabilityPhotos',
      'legacyViabilityRecords',
      'metadata',
      'migrationRuns',
      'nutritionTargetPeriods',
      'profiles',
    ]);
    database = new NutrIAstaMainDatabase(`main-schema-${crypto.randomUUID()}`);
    await database.open();
    expect(database.verno).toBe(MAIN_DATABASE_VERSION);
    expect(database.tables.map(({ name }) => name).sort()).toEqual(Object.keys(MAIN_DATABASE_STORES).sort());
  });

  it('migra aditivamente una base física de Fase 0 sin alterar sus tablas', async () => {
    const name = `main-v1-${crypto.randomUUID()}`;
    const legacy = new (await import('dexie')).default(name);
    legacy.version(1).stores(MAIN_DATABASE_STORES_V1);
    await legacy.open();
    await legacy.table('metadata').put({ key: 'activeSource', value: 'main' });
    await legacy.close();
    database = new NutrIAstaMainDatabase(name);
    await database.open();
    expect((await database.metadata.get('activeSource'))?.value).toBe('main');
    expect(database.tables.map(({ name: table }) => table)).toContain('profiles');
    expect(database.tables.map(({ name: table }) => table)).toContain('legacyViabilityPhotos');
  });
});
