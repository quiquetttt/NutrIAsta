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

    await details.addSet(exercise.id, setInput(null, 0, null, 0, true));
    expect((await details.sessionDetails(session.id))[0]?.sets[0]).toMatchObject({
      plannedRepetitions: null,
      plannedLoadKg: 0,
      actualRepetitions: null,
      actualLoadKg: 0,
      completed: true,
    });
    await expect(details.addSet(exercise.id, setInput(-1, null, null, null, false))).rejects.toThrow(/no negativo/);
    await expect(details.addSet(exercise.id, setInput(8, -2, null, null, false))).rejects.toThrow(/no negativo/);
  });

  it('edita catálogo con tipos y nota, archiva sin alterar instantáneas y edita plan y resultado', async () => {
    database = new NutrIAstaMainDatabase(`training-detail-catalog-${crypto.randomUUID()}`);
    await database.open();
    await database.metadata.bulkPut([
      { key: 'activeSource', value: 'main' },
      { key: 'activeMainDatasetId', value: 'dataset-ficticio' },
    ]);
    const training = new TrainingRepository(database, new TrainingInitializer(database));
    const details = new TrainingDetailRepository(database);
    await training.initialize('2026-07-20');
    const [primary, secondary] = await training.listTypes();
    const catalog = await details.saveCatalogExercise({
      name: 'Press ficticio',
      note: 'Nota de catálogo ficticia',
      primaryTrainingTypeId: primary!.id,
      secondaryTrainingTypeIds: [secondary!.id],
    });
    const session = await training.saveSession({ status: 'planned', localDate: '2026-07-20', title: '', note: '', trainingTypeIds: [primary!.id] });
    const exercise = await details.addExercise(session.id, { catalogExerciseId: catalog.id, name: catalog.name, note: 'Instantánea ficticia' });
    const set = await details.addSet(exercise.id, setInput(10, 20, null, null, false));

    await details.updateSet(set.id, setInput(10, 20, 9, 22.5, true));
    await details.saveCatalogExercise({ name: 'Press renombrado', note: 'Nueva nota', primaryTrainingTypeId: secondary!.id }, catalog.id);
    await details.setCatalogExerciseArchived(catalog.id, true);

    expect(await details.listCatalog()).toEqual([]);
    expect((await details.listCatalog(true))[0]).toMatchObject({ name: 'Press renombrado', archived: true, primaryTrainingTypeId: secondary!.id });
    expect((await details.sessionDetails(session.id))[0]).toMatchObject({
      exercise: { nameSnapshot: 'Press ficticio', note: 'Instantánea ficticia' },
      sets: [{ plannedRepetitions: 10, plannedLoadKg: 20, actualRepetitions: 9, actualLoadKg: 22.5, completed: true }],
    });
  });
});

function setInput(
  plannedRepetitions: number | null,
  plannedLoadKg: number | null,
  actualRepetitions: number | null,
  actualLoadKg: number | null,
  completed: boolean,
) {
  return { plannedRepetitions, plannedLoadKg, actualRepetitions, actualLoadKg, completed };
}
