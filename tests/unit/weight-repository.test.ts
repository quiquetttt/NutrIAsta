import { afterEach, describe, expect, it } from 'vitest';

import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { WeightRepository } from '@/storage/weight-repository.web';

let database: NutrIAstaMainDatabase | null = null;

afterEach(async () => {
  if (database) {
    database.close();
    await database.delete();
    database = null;
  }
});

describe('historial neutral de peso', () => {
  it('permite varias entradas diarias y editar historial no cambia el perfil', async () => {
    database = new NutrIAstaMainDatabase(`weight-${crypto.randomUUID()}`);
    await database.open();
    const datasetId = 'dataset-peso-ficticio';
    const now = '2026-07-26T10:00:00.000Z';
    await database.metadata.bulkPut([
      { key: 'activeSource', value: 'main' },
      { key: 'activeMainDatasetId', value: datasetId },
    ]);
    await database.profiles.put({
      datasetId,
      id: 'profile',
      alias: 'Perfil ficticio',
      age: 22,
      formulaSex: 'male',
      heightCm: 175,
      weightKg: 70,
      gymDaysPerWeek: 4,
      usualStepsPerDay: 8_000,
      otherSportsPerWeek: 0,
      otherSportsDescription: '',
      pal: 1.4,
      privacyConsentAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const repository = new WeightRepository(database);
    const first = await repository.save({ localDate: '2026-07-26', localTime: '08:00', weightKg: 70.2, note: 'Ficticio' });
    await repository.save({ localDate: '2026-07-26', localTime: '20:00', weightKg: 70.4, note: '' });
    expect(await repository.list()).toHaveLength(2);

    await repository.save({ id: first.id, localDate: first.localDate, localTime: first.localTime, weightKg: 69.9, note: 'Editado' });
    expect((await database.profiles.get([datasetId, 'profile']))?.weightKg).toBe(70);
    const copied = await repository.copyFromProfile('2026-07-27', '08:00');
    expect(copied).toMatchObject({ weightKg: 70, origin: 'profile-copy' });
  });
});
