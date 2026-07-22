export type FormulaSex = 'male' | 'female';
export type PalValue = 1.4 | 1.6 | 1.8 | 2;

export interface Profile {
  datasetId: string;
  id: 'profile';
  alias: string;
  age: number;
  formulaSex: FormulaSex;
  heightCm: number;
  weightKg: number;
  gymDaysPerWeek: number;
  usualStepsPerDay: number;
  otherSportsPerWeek: number;
  otherSportsDescription: string;
  pal: PalValue;
  privacyConsentAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionTargetPeriod {
  datasetId: string;
  id: string;
  effectiveFrom: string;
  caloriesKcal: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  waterMl: number | null;
  createdAt: string;
}

export interface ProfileDraft extends Omit<Profile, 'datasetId' | 'id' | 'privacyConsentAt' | 'createdAt' | 'updatedAt'> {
  consent: boolean;
}

export interface NutritionTargetDraft extends Omit<NutritionTargetPeriod, 'datasetId' | 'id' | 'createdAt'> {}
