import { afterEach, describe, expect, it } from 'vitest';
import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { ProfileRepository } from '@/storage/profile-repository.web';

let database: NutrIAstaMainDatabase | null = null;
afterEach(async () => { if (database) { database.close(); await database.delete(); database = null; } });

describe('perfil y periodos de objetivos', () => {
  it('guarda el perfil local y conserva periodos históricos separados', async () => {
    database = new NutrIAstaMainDatabase(`profile-${crypto.randomUUID()}`);
    await database.open();
    await database.metadata.bulkPut([
      { key: 'activeSource', value: 'main' },
      { key: 'activeMainDatasetId', value: 'dataset-ficticio' },
    ]);
    const repository = new ProfileRepository(database);
    const profile = await repository.saveProfile({ alias: 'Persona ficticia', age: 22, formulaSex: 'male', heightCm: 175, weightKg: 70, gymDaysPerWeek: 4, usualStepsPerDay: 8000, otherSportsPerWeek: 1, otherSportsDescription: 'Deporte ficticio', pal: 1.6, consent: true });
    expect(profile.datasetId).toBe('dataset-ficticio');
    expect(profile.privacyConsentAt).toBeTruthy();
    await repository.addTargetPeriod({ effectiveFrom: '2026-07-01', caloriesKcal: 2400, proteinG: 130, carbohydratesG: 300, fatG: 70, waterMl: 2500 });
    await repository.addTargetPeriod({ effectiveFrom: '2026-08-01', caloriesKcal: 2500, proteinG: 140, carbohydratesG: 310, fatG: 75, waterMl: null });
    expect((await repository.targetForDate('2026-07-15'))?.caloriesKcal).toBe(2400);
    expect((await repository.targetForDate('2026-08-15'))?.caloriesKcal).toBe(2500);
    expect(await repository.listTargets()).toHaveLength(2);
  });
});
