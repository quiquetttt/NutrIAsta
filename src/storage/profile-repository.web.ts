import { mainDatabase, type NutrIAstaMainDatabase } from '@/storage/main-database.web';
import type { NutritionTargetDraft, NutritionTargetPeriod, Profile, ProfileDraft } from '@/mvp/profile-types';
import { MAIN_META_KEYS } from '@/storage/main-schema';
import { trackWrite } from '@/storage/write-tracker';
import { createId } from '@/utils/crypto';

export class ProfileRepository {
  constructor(private readonly db: NutrIAstaMainDatabase = mainDatabase) {}

  async activeDatasetId(): Promise<string> {
    await this.db.open();
    const source = (await this.db.metadata.get(MAIN_META_KEYS.activeSource))?.value;
    const datasetId = (await this.db.metadata.get(MAIN_META_KEYS.activeMainDatasetId))?.value;
    if (source !== 'main' || typeof datasetId !== 'string') {
      throw new Error('La migración segura debe estar confirmada antes de crear el perfil.');
    }
    return datasetId;
  }

  async getProfile(): Promise<Profile | null> {
    const datasetId = await this.activeDatasetId();
    const profile = await this.db.profiles.get([datasetId, 'profile']);
    return profile ? {
      ...profile,
      waterQuickAmountsMl: profile.waterQuickAmountsMl?.length ? profile.waterQuickAmountsMl : [250, 500],
      dailyStepsGoal: profile.dailyStepsGoal ?? 10_000,
    } : null;
  }

  async saveProfile(draft: ProfileDraft): Promise<Profile> {
    validateProfile(draft);
    const datasetId = await this.activeDatasetId();
    const previous = await this.db.profiles.get([datasetId, 'profile']);
    const now = new Date().toISOString();
    const profile: Profile = {
      ...draft,
      waterQuickAmountsMl: draft.waterQuickAmountsMl ?? previous?.waterQuickAmountsMl ?? [250, 500],
      dailyStepsGoal: draft.dailyStepsGoal ?? previous?.dailyStepsGoal ?? 10_000,
      datasetId,
      id: 'profile',
      privacyConsentAt: previous?.privacyConsentAt ?? now,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    delete (profile as Profile & { consent?: boolean }).consent;
    await trackWrite(() => this.db.profiles.put(profile));
    return profile;
  }

  async listTargets(): Promise<NutritionTargetPeriod[]> {
    const datasetId = await this.activeDatasetId();
    return this.db.nutritionTargetPeriods.where('datasetId').equals(datasetId).sortBy('effectiveFrom');
  }

  async targetForDate(date: string): Promise<NutritionTargetPeriod | null> {
    const periods = await this.listTargets();
    return [...periods].reverse().find((period) => period.effectiveFrom <= date) ?? null;
  }

  async addTargetPeriod(draft: NutritionTargetDraft): Promise<NutritionTargetPeriod> {
    validateTargets(draft);
    const datasetId = await this.activeDatasetId();
    const period: NutritionTargetPeriod = {
      ...draft,
      datasetId,
      id: createId('target'),
      createdAt: new Date().toISOString(),
    };
    await trackWrite(() => this.db.nutritionTargetPeriods.add(period));
    return period;
  }
}

function validateProfile(draft: ProfileDraft) {
  if (!draft.consent) throw new Error('Debes aceptar el almacenamiento local para continuar.');
  if (!draft.alias.trim() || draft.alias.trim().length > 60) throw new Error('El alias debe tener entre 1 y 60 caracteres.');
  if (!Number.isInteger(draft.age) || draft.age < 18 || draft.age > 120) throw new Error('La edad debe corresponder a una persona adulta.');
  if (draft.heightCm < 100 || draft.heightCm > 250) throw new Error('La altura no es válida.');
  if (draft.weightKg < 30 || draft.weightKg > 350) throw new Error('El peso no es válido.');
  if (!Number.isInteger(draft.gymDaysPerWeek) || draft.gymDaysPerWeek < 0 || draft.gymDaysPerWeek > 7) throw new Error('Los días de gimnasio deben estar entre 0 y 7.');
  if (!Number.isInteger(draft.usualStepsPerDay) || draft.usualStepsPerDay < 0 || draft.usualStepsPerDay > 100000) throw new Error('Los pasos habituales no son válidos.');
  if (!Number.isInteger(draft.otherSportsPerWeek) || draft.otherSportsPerWeek < 0 || draft.otherSportsPerWeek > 14) throw new Error('Las sesiones deportivas deben estar entre 0 y 14.');
  const quickWater = draft.waterQuickAmountsMl ?? [250, 500];
  if (quickWater.length < 1 || quickWater.length > 6 || quickWater.some((value) => !Number.isInteger(value) || value < 50 || value > 5000) || new Set(quickWater).size !== quickWater.length) throw new Error('Los accesos rápidos de agua deben contener entre 1 y 6 valores únicos de 50 a 5000 ml.');
  const stepsGoal = draft.dailyStepsGoal ?? 10_000;
  if (!Number.isInteger(stepsGoal) || stepsGoal < 1 || stepsGoal > 200_000) throw new Error('El objetivo diario de pasos debe ser un número entero entre 1 y 200.000.');
}

function validateTargets(draft: NutritionTargetDraft) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.effectiveFrom)) throw new Error('La fecha de inicio no es válida.');
  for (const [label, value] of Object.entries({ calorías: draft.caloriesKcal, proteínas: draft.proteinG, carbohidratos: draft.carbohydratesG, grasas: draft.fatG })) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`El objetivo de ${label} no es válido.`);
  }
  if (draft.waterMl !== null && (!Number.isFinite(draft.waterMl) || draft.waterMl < 0)) throw new Error('El objetivo de agua no es válido.');
}

export const profileRepository = new ProfileRepository();
