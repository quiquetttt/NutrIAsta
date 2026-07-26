import { afterEach, describe, expect, it } from 'vitest';
import { DiaryRepository } from '@/storage/diary-repository.web';
import { FoodRepository } from '@/storage/food-repository.web';
import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { RecipeRepository } from '@/storage/recipe-repository.web';

let database: NutrIAstaMainDatabase | null = null;
afterEach(async () => { if (database) { database.close(); await database.delete(); database = null; } });

describe('recetas y planificación con snapshots', () => {
  it('calcula, planifica, convierte y copia sin alterar el histórico', async () => {
    database = new NutrIAstaMainDatabase(`recipes-${crypto.randomUUID()}`);
    await database.open();
    await database.metadata.bulkPut([
      { key: 'activeSource', value: 'main' },
      { key: 'activeMainDatasetId', value: 'dataset-ficticio' },
    ]);
    const foods = new FoodRepository(database);
    const recipes = new RecipeRepository(database);
    const diary = new DiaryRepository(database);
    const base = { brand: '', supermarket: '', barcode: null, baseUnit: 'g' as const, energyKj: null, energySource: 'declared' as const, dataOrigin: 'manual' as const, notes: '', favorite: false };
    const oats = await foods.save({ ...base, name: 'Avena ficticia', energyKcal: 400, proteinG: 10, carbohydratesG: 70, fatG: 8 }, []);
    const milk = await foods.save({ ...base, name: 'Bebida ficticia', baseUnit: 'ml', energyKcal: 50, proteinG: 3, carbohydratesG: 5, fatG: 2 }, []);
    const recipe = await recipes.save('Desayuno ficticio', 2, null, [{ foodId: oats.id, amountBase: 100 }, { foodId: milk.id, amountBase: 200 }]);
    const prepared = await recipes.get(recipe.id);
    expect(prepared?.totals.energyKcal).toBe(500);
    expect(prepared?.perServing.energyKcal).toBe(250);

    await diary.addRecipe('2026-07-30', 'breakfast', recipe.id, 1, 'portion', 'planned');
    expect((await diary.get('2026-07-30')).plannedTotals.energyKcal).toBe(250);
    await foods.save({ ...base, name: 'Avena ficticia', energyKcal: 800, proteinG: 20, carbohydratesG: 70, fatG: 8 }, [], undefined, oats.id);
    await recipes.save('Desayuno ficticio editado', 2, 200, [{ foodId: oats.id, amountBase: 100 }], false, recipe.id);
    const planned = await diary.get('2026-07-30');
    expect(planned.plannedTotals.energyKcal).toBe(250);
    expect(planned.meals[0]?.items[0]?.nutritionSnapshot.name).toBe('Desayuno ficticio');

    await diary.convertMealToConsumed(planned.meals[0]!.id);
    expect((await diary.get('2026-07-30')).totals.energyKcal).toBe(250);
    await diary.copyMeal(planned.meals[0]!.id, '2026-08-01');
    expect((await diary.get('2026-08-01')).plannedTotals.energyKcal).toBe(250);
    await diary.copyDay('2026-07-30', '2026-07-31');
    expect((await diary.get('2026-07-31')).plannedTotals.energyKcal).toBe(250);
    await diary.addRecipe('2026-08-02', 'breakfast', recipe.id, 100, 'g');
    expect((await diary.get('2026-08-02')).totals.energyKcal).toBe(400);
    expect((await diary.recentSources())[0]).toMatchObject({ sourceType: 'recipe', sourceId: recipe.id });
  });
});
