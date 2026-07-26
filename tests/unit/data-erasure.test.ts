import { afterEach, describe, expect, it } from 'vitest';

import { FULL_DATA_TABLES, type FullDataTable } from '@/backup/full-backup-types';
import { DataErasureService } from '@/privacy/data-erasure-service.web';
import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { MainDatasetRepository } from '@/storage/main-dataset-repository.web';

let database: NutrIAstaMainDatabase | null = null;

afterEach(async () => {
  if (database) {
    database.close();
    await database.delete();
    database = null;
  }
});

function rowFor(table: FullDataTable, datasetId: string, suffix: string) {
  const shared = { datasetId, id: `${table}-${suffix}` };
  if (table === 'profiles') return { ...shared, id: 'profile' };
  if (table === 'diaryDays' || table === 'trainingDayFlags') return { datasetId, date: suffix === 'active' ? '2026-07-26' : '2026-07-25' };
  return shared;
}

describe('eliminación reforzada del dataset activo', () => {
  it('cancela con un token incorrecto sin cambiar ninguna tabla', async () => {
    database = await createFixture();
    const service = new DataErasureService(database, new MainDatasetRepository(database));
    const before = await service.summary();
    await expect(service.eraseActiveDataset('cancelar')).rejects.toThrow('ELIMINAR');
    expect((await service.summary()).counts).toEqual(before.counts);
  });

  it('vacía las 14 tablas solo para el dataset activo y conserva rollback y catálogo', async () => {
    database = await createFixture();
    const service = new DataErasureService(database, new MainDatasetRepository(database));
    const before = await service.summary();
    expect(before.totalRows).toBe(FULL_DATA_TABLES.length);
    expect(before.lastBackupAt).toBe('2026-07-26T10:00:00.000Z');

    const after = await service.eraseActiveDataset('ELIMINAR');
    expect(after.totalRows).toBe(0);
    for (const table of FULL_DATA_TABLES) {
      expect(await database.table(table).where('datasetId').equals('dataset-active').count()).toBe(0);
      expect(await database.table(table).where('datasetId').equals('dataset-rollback').count()).toBe(1);
    }
    expect(await database.datasets.get('dataset-active')).toMatchObject({ state: 'active', recordCount: 0, photoCount: 0 });
    expect(await database.datasets.get('dataset-rollback')).toMatchObject({ state: 'rollback' });
    expect((await database.metadata.get('activeMainDatasetId'))?.value).toBe('dataset-active');
  });
});

async function createFixture() {
  const db = new NutrIAstaMainDatabase(`erasure-${crypto.randomUUID()}`);
  await db.open();
  const now = '2026-07-26T10:00:00.000Z';
  await db.metadata.bulkPut([
    { key: 'activeSource', value: 'main' },
    { key: 'activeMainDatasetId', value: 'dataset-active' },
    { key: 'lastFullBackupAt', value: now },
  ]);
  await db.datasets.bulkAdd([
    { id: 'dataset-active', state: 'active', source: 'legacy-copy', createdAt: now, updatedAt: now, recordCount: 1, photoCount: 1, payloadBytes: 10, sourceFingerprint: 'active', contentFingerprint: 'active', sourceDatasetId: 'legacy' },
    { id: 'dataset-rollback', state: 'rollback', source: 'format-2-backup', createdAt: now, updatedAt: now, recordCount: 1, photoCount: 1, payloadBytes: 10, sourceFingerprint: 'rollback', contentFingerprint: 'rollback', sourceDatasetId: 'backup' },
  ]);
  for (const table of FULL_DATA_TABLES) {
    await db.table(table).add(rowFor(table, 'dataset-active', 'active'));
    await db.table(table).add(rowFor(table, 'dataset-rollback', 'rollback'));
  }
  return db;
}
