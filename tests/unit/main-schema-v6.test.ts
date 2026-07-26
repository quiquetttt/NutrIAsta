import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { NutrIAstaDatabase } from '@/storage/database.web';
import {
  MAIN_DATABASE_STORES_V5,
  MAIN_DATABASE_STORES_V6,
} from '@/storage/main-schema';
import { DATABASE_STORES, DATABASE_VERSION } from '@/storage/schema';

const MVP1_DATA_TABLES = [
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
] as const;

const MVP2_DATA_TABLES = [
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

const openDatabases: Dexie[] = [];

async function comparable(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    return {
      type: value.type,
      bytes: Array.from(new Uint8Array(await value.arrayBuffer())),
    };
  }
  if (Array.isArray(value)) return Promise.all(value.map(comparable));
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) result[key] = await comparable(nested);
    return result;
  }
  return value;
}

async function snapshot(db: Dexie, tables: readonly string[]) {
  const result: Record<string, unknown> = {};
  for (const table of tables) result[table] = await comparable(await db.table(table).toArray());
  return result;
}

afterEach(async () => {
  for (const database of openDatabases.splice(0)) {
    const name = database.name;
    database.close();
    await Dexie.delete(name);
  }
});

describe('migración aditiva de nutriasta-main a Dexie 6', () => {
  it('conserva byte a byte las 14 tablas del MVP 1 y crea vacías las 12 nuevas', async () => {
    const name = `main-v5-populated-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    openDatabases.push(old);
    old.version(5).stores(MAIN_DATABASE_STORES_V5);
    await old.open();

    const datasetId = 'dataset-mvp1-ficticio';
    const now = '2026-07-26T12:00:00.000Z';
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
    const thumbnail = new Blob([new Uint8Array([0xff, 0xd8, 0x01, 0xd9])], { type: 'image/jpeg' });
    const rows: Record<(typeof MVP1_DATA_TABLES)[number], Record<string, unknown>> = {
      legacyViabilityRecords: { datasetId, id: 'legacy-record', text: 'Ficticio', updatedAt: now },
      legacyViabilityPhotos: { datasetId, id: 'legacy-photo', blob: jpeg, thumbnail, createdAt: now },
      profiles: { datasetId, id: 'profile', alias: 'Persona ficticia', updatedAt: now },
      nutritionTargetPeriods: { datasetId, id: 'target', effectiveFrom: '2026-07-21', caloriesKcal: 2_000 },
      foods: { datasetId, id: 'food', name: 'Alimento ficticio', barcode: '8412345678901', archived: 0, favorite: 1, updatedAt: now },
      foodPortions: { datasetId, id: 'portion', foodId: 'food', name: 'Envase ficticio', grams: 125 },
      foodPhotos: { datasetId, id: 'food-photo', foodId: 'food', blob: jpeg, thumbnail, createdAt: now },
      diaryDays: { datasetId, date: '2026-07-26', note: 'Día ficticio' },
      mealEntries: { datasetId, id: 'meal', date: '2026-07-26', mealType: 'breakfast', state: 'consumed' },
      mealItems: { datasetId, id: 'meal-item', mealEntryId: 'meal', sourceId: 'food', createdAt: now, quantity: 100 },
      waterEntries: { datasetId, id: 'water', date: '2026-07-26', amountMl: 250, createdAt: now },
      trainingDayFlags: { datasetId, date: '2026-07-26', completed: true, updatedAt: now },
      recipes: { datasetId, id: 'recipe', name: 'Receta ficticia', favorite: 1, archived: 0, updatedAt: now },
      recipeItems: { datasetId, id: 'recipe-item', recipeId: 'recipe', foodId: 'food', quantity: 100 },
    };

    await old.transaction('rw', old.tables, async () => {
      await old.table('metadata').bulkPut([
        { key: 'activeSource', value: 'main' },
        { key: 'activeMainDatasetId', value: datasetId },
      ]);
      await old.table('datasets').put({ id: datasetId, state: 'active', source: 'format-2-backup', createdAt: now });
      await old.table('migrationRuns').put({ id: 'run', state: 'confirmed', sourceKind: 'format-2-backup', createdAt: now, candidateDatasetId: datasetId });
      for (const table of MVP1_DATA_TABLES) await old.table(table).put(rows[table]);
    });

    const before = await snapshot(old, Object.keys(MAIN_DATABASE_STORES_V5));
    old.close();

    const upgraded = new NutrIAstaMainDatabase(name);
    openDatabases.push(upgraded);
    await upgraded.open();

    expect(upgraded.verno).toBe(6);
    expect(await snapshot(upgraded, Object.keys(MAIN_DATABASE_STORES_V5))).toEqual(before);
    for (const table of MVP2_DATA_TABLES) expect(await upgraded.table(table).count()).toBe(0);
    expect(upgraded.tables.map(({ name: table }) => table).sort())
      .toEqual(Object.keys(MAIN_DATABASE_STORES_V6).sort());
  });

  it('no toca nutriasta v1 y rechaza abrir la base 6 con el esquema 5', async () => {
    const legacyName = `legacy-v1-untouched-${crypto.randomUUID()}`;
    const legacy = new NutrIAstaDatabase(legacyName);
    openDatabases.push(legacy);
    await legacy.open();
    const legacyDatasetId = 'dataset-legacy-ficticio';
    await legacy.metadata.bulkPut([
      { key: 'activeDatasetId', value: legacyDatasetId },
      { key: 'lastBackupAt', value: '2026-07-26T11:00:00.000Z' },
    ]);
    await legacy.datasets.put({
      id: legacyDatasetId,
      state: 'active',
      source: 'new',
      createdAt: '2026-07-26T10:00:00.000Z',
      updatedAt: '2026-07-26T10:00:00.000Z',
      recordCount: 1,
      photoCount: 0,
    });
    await legacy.viabilityRecords.put({
      datasetId: legacyDatasetId,
      id: 'registro-prueba-001',
      text: 'Texto ficticio intacto',
      createdAt: '2026-07-26T10:00:00.000Z',
      updatedAt: '2026-07-26T10:00:00.000Z',
    });
    const legacyBefore = await snapshot(legacy, Object.keys(DATABASE_STORES));
    expect(legacy.verno).toBe(DATABASE_VERSION);

    const mainName = `main-v6-no-downgrade-${crypto.randomUUID()}`;
    const main = new NutrIAstaMainDatabase(mainName);
    openDatabases.push(main);
    await main.open();
    main.close();

    const downgradeError = await new Promise<DOMException>((resolve, reject) => {
      const request = indexedDB.open(mainName, 50);
      request.onerror = () => resolve(request.error as DOMException);
      request.onsuccess = () => {
        request.result.close();
        reject(new Error('IndexedDB permitió abrir la base física con una versión inferior.'));
      };
    });
    expect(downgradeError.name).toBe('VersionError');

    expect(await snapshot(legacy, Object.keys(DATABASE_STORES))).toEqual(legacyBefore);
    expect(legacy.verno).toBe(1);
  });
});
