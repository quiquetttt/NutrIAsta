import { describe, expect, it } from 'vitest';

import { canSaveLabelReview, type EditableNutritionValues } from '@/features/foods/label-review-validation';

const requiredOnly: EditableNutritionValues = {
  energyKj: '',
  energyKcal: '120',
  fatG: '',
  carbohydratesG: '18,5',
  proteinG: '7',
};

describe('revisión manual de una etiqueta parcial', () => {
  it('permite guardar al completar los tres valores obligatorios y elegir la base', () => {
    expect(canSaveLabelReview('Alimento ficticio', 'per-100-g', requiredOnly, '')).toBe(true);
  });

  it('mantiene bloqueado el guardado hasta elegir una base si el OCR no la detectó', () => {
    expect(canSaveLabelReview('Alimento ficticio', 'unknown', requiredOnly, '')).toBe(false);
    expect(canSaveLabelReview('Alimento ficticio', 'per-100-ml', requiredOnly, '')).toBe(true);
  });

  it('exige calorías, proteínas e hidratos, pero no kJ ni grasas', () => {
    expect(canSaveLabelReview('Alimento ficticio', 'per-100-g', { ...requiredOnly, proteinG: '' }, '')).toBe(false);
    expect(canSaveLabelReview('Alimento ficticio', 'per-100-g', { ...requiredOnly, energyKj: 'dato inválido' }, '')).toBe(false);
  });
});
