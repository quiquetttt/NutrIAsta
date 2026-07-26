import { afterEach, describe, expect, it } from 'vitest';

import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { TrainingDetailRepository } from '@/storage/training-detail-repository.web';
import { TrainingInitializer } from '@/storage/training-initializer.web';
import { TrainingRepository } from '@/storage/training-repository.web';

let database: NutrIAstaMainDatabase | null = null;

afterEach(async () => {
  if (database) {
    database.close();
    await database.delete();
    database = null;
  }
});

describe('ejercicios y series opcionales', () => {
  it('admite ejercicio sin series, carga cero y rechaza valores negativos', async () => {
    database = new NutrIAstaMainDatabase(`training-detail-${crypto.randomUUID()}`);
    await database.open();
    await database.metadata.bulkPut([
      { key: 'activeSource', value: 'main' },
      { key: 'activeMainDatasetId', value: 'dataset-ficticio' },
    ]);
    const training = new TrainingRepository(database, new TrainingInitializer(database));
    const details = new TrainingDetailRepository(database);
    await training.initialize('2026-07-20');
    const type = (await training.listTypes())[0]!;
    const session = await training.saveSession({ status: 'completed', localDate: '2026-07-20', title: '', note: '', trainingTypeIds: [type.id] });
    const catalog = await details.createCatalogExercise('Ejercicio ficticio');
    const exercise = await details.addExercise(session.id, { catalogExerciseId: catalog.id, name: catalog.name });
    expect((await details.sessionDetails(session.id))[0]?.sets).toEqual([]);

    await details.addSet(exercise.id, { repetitions: null, loadKg: 0, completed: true });
    expect((await details.sessionDetails(session.id))[0]?.sets[0]).toMatchObject({ repetitions: null, loadKg: 0, completed: true });
    await expect(details.addSet(exercise.id, { repetitions: -1, loadKg: null, completed: false })).rejects.toThrow(/no negativo/);
    await expect(details.addSet(exercise.id, { repetitions: 8, loadKg: -2, completed: false })).rejects.toThrow(/no negativo/);
  });
});
