import { afterEach, describe, expect, it } from 'vitest';

import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { TrainingInitializer } from '@/storage/training-initializer.web';
import { TrainingRepository } from '@/storage/training-repository.web';
import { TrainingDetailRepository } from '@/storage/training-detail-repository.web';

let database: NutrIAstaMainDatabase | null = null;

async function setup() {
  database = new NutrIAstaMainDatabase(`training-repository-${crypto.randomUUID()}`);
  await database.open();
  await database.metadata.bulkPut([
    { key: 'activeSource', value: 'main' },
    { key: 'activeMainDatasetId', value: 'dataset-training-ficticio' },
  ]);
  const repository = new TrainingRepository(database, new TrainingInitializer(database));
  await repository.initialize('2026-07-20');
  return repository;
}

afterEach(async () => {
  if (database) {
    database.close();
    await database.delete();
    database = null;
  }
});

describe('repositorio de entrenamientos', () => {
  it('inicia en cuatro y mantiene las semanas anteriores al crear periodos nuevos', async () => {
    const repository = await setup();
    expect((await repository.goalForWeek('2026-07-20'))?.weeklyGoal).toBe(4);

    await repository.setWeeklyGoal(5, 'current', '2026-07-29');
    await repository.setWeeklyGoal(6, 'next', '2026-07-29');

    expect((await repository.goalForWeek('2026-07-20'))?.weeklyGoal).toBe(4);
    expect((await repository.goalForWeek('2026-07-27'))?.weeklyGoal).toBe(5);
    expect((await repository.goalForWeek('2026-08-03'))?.weeklyGoal).toBe(6);
    expect((await repository.listGoalPeriods()).map(({ effectiveFromMonday }) => effectiveFromMonday))
      .toEqual(['2026-07-20', '2026-07-27', '2026-08-03']);
  });

  it('cuenta cada sesión completada una vez aunque tenga varios tipos', async () => {
    const repository = await setup();
    const types = await repository.listTypes();
    const completed = await repository.saveSession({
      status: 'completed',
      localDate: '2026-07-22',
      title: 'Sesión ficticia',
      note: '',
      trainingTypeIds: [types[0]!.id, types[1]!.id],
    });
    await repository.saveSession({
      status: 'planned',
      localDate: '2026-07-23',
      title: 'Sesión planificada ficticia',
      note: '',
      trainingTypeIds: [types[2]!.id],
    });

    expect(await repository.weeklySummary('2026-07-22')).toMatchObject({ completed: 1, goal: 4 });
    expect(completed.origin).toBe('unplanned');
  });

  it('copia con identificador nuevo y no modifica la sesión original', async () => {
    const repository = await setup();
    const details = new TrainingDetailRepository(database!);
    const type = (await repository.listTypes())[0]!;
    const original = await repository.saveSession({
      status: 'completed',
      localDate: '2026-07-21',
      title: 'Original ficticia',
      note: 'Nota original',
      trainingTypeIds: [type.id],
    });
    const catalog = await details.createCatalogExercise('Press ficticio');
    const exercise = await details.addExercise(original.id, { catalogExerciseId: catalog.id, name: catalog.name });
    await details.addSet(exercise.id, { repetitions: 10, loadKg: 0, completed: true, note: 'Serie ficticia' });
    const copy = await repository.copySession(original.id, '2026-07-28');

    expect(copy).toMatchObject({
      status: 'planned',
      localDate: '2026-07-28',
      origin: 'copied',
      sourceSessionId: original.id,
    });
    expect(copy.id).not.toBe(original.id);
    expect(await database!.trainingSessions.get([original.datasetId, original.id])).toEqual(original);
    const originalDetails = await details.sessionDetails(original.id);
    const copiedDetails = await details.sessionDetails(copy.id);
    expect(copiedDetails).toHaveLength(1);
    expect(copiedDetails[0]!.exercise.id).not.toBe(originalDetails[0]!.exercise.id);
    expect(copiedDetails[0]!.sets[0]).toMatchObject({ repetitions: 10, loadKg: 0, completed: false });
    expect(copiedDetails[0]!.sets[0]!.id).not.toBe(originalDetails[0]!.sets[0]!.id);
  });

  it('aísla datasets y evita duplicados visibles de tipos personalizados', async () => {
    const repository = await setup();
    await repository.addCustomType('Movilidad ficticia');
    await expect(repository.addCustomType(' movilidad   ficticia ')).rejects.toThrow(/Ya existe/);

    await database!.metadata.put({ key: 'activeMainDatasetId', value: 'dataset-otro' });
    await new TrainingRepository(database!, new TrainingInitializer(database!)).initialize('2026-07-20');
    expect(await new TrainingRepository(database!, new TrainingInitializer(database!)).listHistory()).toEqual([]);
    expect(await database!.trainingTypes.where('datasetId').equals('dataset-training-ficticio').count()).toBe(10);
    expect(await database!.trainingTypes.where('datasetId').equals('dataset-otro').count()).toBe(9);
  });
});
