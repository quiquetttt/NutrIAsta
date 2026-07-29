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

    expect(await repository.weeklySummary('2026-07-22')).toMatchObject({
      completed: 1,
      planned: 1,
      cancelled: 0,
      goal: 4,
      percentage: 25,
      fulfillmentText: 'Faltan 3 sesiones para el objetivo semanal.',
    });
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
    await details.addSet(exercise.id, {
      plannedRepetitions: 12,
      plannedLoadKg: 0,
      actualRepetitions: 10,
      actualLoadKg: 2.5,
      completed: true,
      note: 'Serie ficticia',
    });
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
    expect(copiedDetails[0]!.sets[0]).toMatchObject({
      plannedRepetitions: 12,
      plannedLoadKg: 0,
      actualRepetitions: null,
      actualLoadKg: null,
      repetitions: 12,
      loadKg: 0,
      completed: false,
    });
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

  it('renombra y archiva tipos personalizados conservando snapshots y filtra el historial', async () => {
    const repository = await setup();
    const custom = await repository.addCustomType('Movilidad ficticia');
    const session = await repository.saveSession({
      status: 'completed',
      localDate: '2026-07-22',
      title: 'Sesión de búsqueda ficticia',
      note: 'Nota única de historial',
      trainingTypeIds: [custom.id],
    });
    await repository.renameCustomType(custom.id, 'Movilidad renombrada');
    await repository.setCustomTypeArchived(custom.id, true);

    expect((await repository.listTypes()).some(({ id }) => id === custom.id)).toBe(false);
    expect((await repository.listTypes(true)).find(({ id }) => id === custom.id)).toMatchObject({ name: 'Movilidad renombrada', archived: true });
    expect((await repository.listHistory({ query: 'única', from: '2026-07-20', to: '2026-07-25', trainingTypeIds: [custom.id] }))[0]?.id).toBe(session.id);
    expect((await repository.listHistory())[0]?.trainingTypes[0]?.nameSnapshot).toBe('Movilidad ficticia');
  });

  it('elimina solo tipos personalizados y conserva las instantáneas históricas', async () => {
    const repository = await setup();
    const initialType = (await repository.listTypes())[0]!;
    const custom = await repository.addCustomType('Circuito ficticio');
    const session = await repository.saveSession({
      status: 'completed',
      localDate: '2026-07-22',
      title: 'Sesión con tipo eliminable',
      note: '',
      trainingTypeIds: [custom.id],
    });

    await repository.deleteCustomType(custom.id);

    expect((await repository.listTypes(true)).some(({ id }) => id === custom.id)).toBe(false);
    expect((await repository.listHistory()).find(({ id }) => id === session.id)?.trainingTypes)
      .toEqual([{ trainingTypeId: custom.id, nameSnapshot: 'Circuito ficticio' }]);
    await expect(repository.deleteCustomType(initialType.id)).rejects.toThrow(/iniciales no se pueden eliminar/);
  });
});
