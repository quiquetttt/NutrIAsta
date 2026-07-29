import type { NutritionSnapshot, NutritionTotals } from '@/mvp/diary-types';

export const ZERO_TOTALS: NutritionTotals = { energyKcal: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 };
export function calculateFromSnapshot(snapshot: NutritionSnapshot, baseAmount: number): NutritionTotals {
  const factor = baseAmount / 100;
  return { energyKcal: snapshot.energyKcal * factor, proteinG: snapshot.proteinG * factor, carbohydratesG: snapshot.carbohydratesG * factor, fatG: snapshot.fatG === null ? null : snapshot.fatG * factor };
}
export function sumNutrition(values: NutritionTotals[]): NutritionTotals {
  return values.reduce((total, value) => ({
    energyKcal: total.energyKcal + value.energyKcal,
    proteinG: total.proteinG + value.proteinG,
    carbohydratesG: total.carbohydratesG + value.carbohydratesG,
    fatG: total.fatG === null || value.fatG === null ? null : total.fatG + value.fatG,
  }), { ...ZERO_TOTALS });
}
