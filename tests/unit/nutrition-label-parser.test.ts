import { describe, expect, it } from 'vitest';

import { parseNutritionLabel } from '@/ocr/nutrition-label-parser';

const TWO_COLUMNS = `INFORMACIÓN NUTRICIONAL
Valores medios por 100 g por porción 40 g
Valor energético 1680 kJ 672 kJ
400 kcal 160 kcal
Grasas 12,5 g 5,0 g
de las cuales saturadas 3,0 g 1,2 g
Hidratos de carbono 54,0 g 21,6 g
de los cuales azúcares 7,5 g 3,0 g
Fibra 6,0 g 2,4 g
Proteínas 16,0 g 6,4 g
Sal 0,8 g 0,32 g`;

describe('parser local de etiquetas nutricionales', () => {
  it('separa 100 g y porción sin mezclar saturadas, azúcares o sal', () => {
    const parsed = parseNutritionLabel(TWO_COLUMNS, 90);
    expect(parsed.columns.map(({ basis }) => basis)).toEqual(['per-100-g', 'portion']);
    expect(parsed.columns[1]).toMatchObject({ portionAmount: 40, portionUnit: 'g' });
    expect(value(parsed, 'per-100-g', 'fatG')).toBe(12.5);
    expect(value(parsed, 'portion', 'fatG')).toBe(5);
    expect(value(parsed, 'per-100-g', 'carbohydratesG')).toBe(54);
    expect(value(parsed, 'portion', 'proteinG')).toBe(6.4);
    expect(parsed.values.every(({ raw }) => !/saturad|azúcar|sal/i.test(raw))).toBe(true);
  });

  it('admite 100 ml, coma y punto decimal, kJ y kcal', () => {
    const parsed = parseNutritionLabel(`Por 100 ml
Energía 210 kJ
50 kcal
Grasas 1.5 g
Carbohidratos 8,2 g
Proteínas 3.0 g`, 88);
    expect(parsed.columns[0]?.basis).toBe('per-100-ml');
    expect(value(parsed, 'per-100-ml', 'energyKj')).toBe(210);
    expect(value(parsed, 'per-100-ml', 'energyKcal')).toBe(50);
    expect(value(parsed, 'per-100-ml', 'carbohydratesG')).toBe(8.2);
  });

  it('deja vacíos los campos ausentes y avisa de columna incompleta', () => {
    const parsed = parseNutritionLabel('Por 100 g\nProteínas 7 g', 91);
    expect(value(parsed, 'per-100-g', 'energyKcal')).toBeNull();
    expect(parsed.warnings.some((warning) => warning.includes('incompleta'))).toBe(true);
  });

  it('avisa de energía contradictoria, base desconocida y valores improbables', () => {
    const parsed = parseNutritionLabel('Energía 100 kJ\n900 kcal\nGrasas 150 g\nProteínas -2 g', 90);
    expect(parsed.warnings).toContain('La base nutricional no está clara.');
    expect(parsed.warnings.some((warning) => warning.includes('no parecen corresponder'))).toBe(true);
    expect(parsed.values.find(({ key }) => key === 'fatG')?.warnings).toContain('El valor por 100 parece improbable.');
    expect(parsed.values.find(({ key }) => key === 'proteinG')?.warnings).toContain('La cantidad es negativa.');
  });

  it('mantiene sal y sodio fuera del modelo y marca baja confianza', () => {
    const parsed = parseNutritionLabel('Por 100 g\nSodio 200 mg\nSal 0,5 g\nProteínas 8 g', 60);
    expect(parsed.values.some(({ key }) => !['energyKj', 'energyKcal', 'fatG', 'carbohydratesG', 'proteinG'].includes(key))).toBe(false);
    expect(parsed.values.find(({ key }) => key === 'proteinG')?.status).toBe('uncertain');
  });
});

function value(result: ReturnType<typeof parseNutritionLabel>, columnId: string, key: string) {
  return result.values.find((item) => item.columnId === columnId && item.key === key)?.value ?? null;
}
