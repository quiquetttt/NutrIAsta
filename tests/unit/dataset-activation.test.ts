import { afterEach, describe, expect, it } from 'vitest';

import { NutrIAstaDatabase } from '@/storage/database.web';
import { DatasetRepository } from '@/storage/dataset-repository.web';

let database: NutrIAstaDatabase | null = null;

afterEach(async () => {
  if (database) {
    database.close();
    await database.delete();
    database = null;
  }
});

describe('activación atómica por puntero', () => {
  it('activa, revierte y reactiva sin eliminar ninguno de los datasets', async () => {
    database = new NutrIAstaDatabase(`nutriasta-test-${Date.now()}`);
    const repository = new DatasetRepository(database);
    const previousDatasetId = await repository.initialize();
    const original = await repository.saveTestRecord('Original');
    const candidateDatasetId = await repository.stageSnapshot(
      {
        records: [{ ...original, datasetId: '', text: 'Restaurado' }],
        photos: [],
      },
      'backup-test',
    );

    const session = await repository.activateCandidate(candidateDatasetId);
    expect(await repository.getActiveDatasetId()).toBe(candidateDatasetId);
    expect((await database.datasets.get(previousDatasetId))?.state).toBe('rollback');

    const rolledBack = await repository.rollbackRestoration(session);
    expect(await repository.getActiveDatasetId()).toBe(previousDatasetId);
    expect((await database.datasets.get(candidateDatasetId))?.state).toBe('rollback');

    const reactivated = await repository.reactivateRestoration(rolledBack);
    expect(await repository.getActiveDatasetId()).toBe(candidateDatasetId);
    expect((await repository.getActiveSnapshot()).records[0]?.text).toBe('Restaurado');

    await repository.confirmRestoration(reactivated);
    expect(await repository.getRestoreSession()).toBeNull();
    expect(await database.datasets.get(previousDatasetId)).toBeDefined();
  });
});
