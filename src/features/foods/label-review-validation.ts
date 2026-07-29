import type { NutritionBasis, NutritionFieldKey } from '@/ocr/nutrition-label-types';

export type EditableNutritionValues = Record<NutritionFieldKey, string>;

export function parseNutritionNumber(value: string) {
  return Number(value.trim().replace(',', '.'));
}

export function optionalNutritionNumber(value: string, scale = 1) {
  return value.trim() ? parseNutritionNumber(value) * scale : null;
}

export function canSaveLabelReview(name: string, basis: NutritionBasis, values: EditableNutritionValues, portionAmount: string) {
  if (!name.trim() || basis === 'unknown' || (basis === 'portion' && !(parseNutritionNumber(portionAmount) > 0))) return false;
  const requiredValid = ['energyKcal', 'proteinG', 'carbohydratesG'].every((key) => {
    const raw = values[key as NutritionFieldKey];
    const value = parseNutritionNumber(raw);
    return raw.trim() !== '' && Number.isFinite(value) && value >= 0;
  });
  const optionalValid = ['energyKj', 'fatG'].every((key) => {
    const raw = values[key as NutritionFieldKey];
    const value = parseNutritionNumber(raw);
    return !raw.trim() || (Number.isFinite(value) && value >= 0);
  });
  return requiredValid && optionalValid;
}
