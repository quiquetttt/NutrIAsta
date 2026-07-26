import { afterEach, describe, expect, it } from 'vitest';

import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import {
  INITIAL_TRAINING_TYPES,
  TrainingInitializer,
} from '@/storage/training-initializer.web';

let database: NutrIAstaMainDatabase | null = null;

afterEach(async () => {
  if (database) {
    database.close();
    await database.delete();
    database = null;
  }
});

describe('inicializador de tipos de entrenamiento', () => {
  it('crea nueve tipos por dataset y es idempotente', async () => {
    database = new NutrIAstaMainDatabase(`training-initializer-${crypto.randomUUID()}`);
    await database.open();
    await database.metadata.bulkPut([
      { key: 'activeSource', value: 'main' },
      { key: 'activeMainDatasetId', value: 'dataset-ficticio' },
    ]);
    const initializer = new TrainingInitializer(database);

    expect(await initializer.ensureInitialTypes()).toHaveLength(9);
    expect(await initializer.ensureInitialTypes()).toHaveLength(9);
    expect(await database.trainingTypes.count()).toBe(9);
    expect((await database.trainingTypes.toArray()).map(({ initialKey }) => initialKey).sort())
      .toEqual(INITIAL_TRAINING_TYPES.map(({ key }) => key).sort());
  });

  it('no renombra ni reactiva un tipo inicial editado', async () => {
    database = new NutrIAstaMainDatabase(`training-initializer-edited-${crypto.randomUUID()}`);
    await database.open();
    await database.metadata.bulkPut([
      { key: 'activeSource', value: 'main' },
      { key: 'activeMainDatasetId', value: 'dataset-ficticio' },
    ]);
    const initializer = new TrainingInitializer(database);
    await initializer.ensureInitialTypes();
    await database.trainingTypes.update(
      ['dataset-ficticio', 'training-type-initial-chest'],
      { name: 'Empuje ficticio', normalizedName: 'empuje ficticio', archived: true },
    );

    await initializer.ensureInitialTypes();
    const edited = await database.trainingTypes.get([
      'dataset-ficticio',
      'training-type-initial-chest',
    ]);
    expect(edited).toMatchObject({ name: 'Empuje ficticio', archived: true });
    expect(await database.trainingTypes.count()).toBe(9);
  });
});
