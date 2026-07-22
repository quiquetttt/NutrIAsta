import type { FormulaSex, PalValue } from '@/mvp/profile-types';

export interface EnergyInputs {
  weightKg: number;
  heightCm: number;
  age: number;
  formulaSex: FormulaSex;
  pal: PalValue;
}

export function restingEnergyEstimate(input: Omit<EnergyInputs, 'pal'>): number {
  const constant = input.formulaSex === 'male' ? 5 : -161;
  return 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + constant;
}

export function maintenanceEstimate(input: EnergyInputs): number {
  return restingEnergyEstimate(input) * input.pal;
}

export function energyScenarios(maintenance: number) {
  return {
    deficit5: maintenance * 0.95,
    deficit10: maintenance * 0.9,
    surplus5: maintenance * 1.05,
    surplus10: maintenance * 1.1,
  };
}

export function macroEnergy(proteinG: number, carbohydratesG: number, fatG: number): number {
  return proteinG * 4 + carbohydratesG * 4 + fatG * 9;
}

export function efsaGeneralReferences(weightKg: number) {
  return {
    proteinG: weightKg * 0.83,
    carbohydrateEnergyPercent: [45, 60] as const,
    fatEnergyPercent: [20, 35] as const,
    totalWaterFemaleMl: 2000,
    totalWaterMaleMl: 2500,
  };
}
