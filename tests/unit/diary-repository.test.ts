import { afterEach, describe, expect, it } from 'vitest';

import { DiaryRepository } from '@/storage/diary-repository.web';
import { FoodRepository } from '@/storage/food-repository.web';
import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { ProfileRepository } from '@/storage/profile-repository.web';

let database: NutrIAstaMainDatabase | null = null;

afterEach(async () => {
  if (database) {
    database.close();
    await database.delete();
    database = null;
  }
});

async function fixture() {
  database = new NutrIAstaMainDatabase(`diary-${crypto.randomUUID()}`);
  await database.open();
  await database.metadata.bulkPut([
    { key: 'activeSource', value: 'main' },
    { key: 'activeMainDatasetId', value: 'dataset-ficticio' },
  ]);
  return {
    profiles: new ProfileRepository(database),
    foods: new FoodRepository(database),
    diary: new DiaryRepository(database),
  };
}

const gramFood = {
  name: 'Alimento histórico', brand: '', supermarket: '', baseUnit: 'g' as const,
  energyKcal: 100, energyKj: null, proteinG: 10, carbohydratesG: 5, fatG: 2,
  energySource: 'declared' as const, dataOrigin: 'manual' as const, notes: '', favorite: false,
};

describe('diario estructurado con snapshots', () => {
  it('conserva alimento y objetivo históricos tras editar sus fuentes', async () => {
    const { profiles, foods, diary } = await fixture();
    await profiles.addTargetPeriod({ effectiveFrom: '2026-07-01', caloriesKcal: 2000, proteinG: 100, carbohydratesG: 250, fatG: 60, waterMl: 2000 });
    const food = await foods.save(gramFood, []);
    const item = await diary.addFood('2026-07-15', 'breakfast', food.id, 50, 'g', 50);

    await foods.save({ ...gramFood, energyKcal: 300, proteinG: 30 }, {}, food.id);
    await profiles.addTargetPeriod({ effectiveFrom: '2026-08-01', caloriesKcal: 3000, proteinG: 150, carbohydratesG: 350, fatG: 80, waterMl: null });
    const water = await diary.addWater('2026-07-15', 250);
    await diary.setSteps('2026-07-15', 8_765);
    await diary.saveTraining('2026-07-15', true, 'Fuerza ficticia', 'Nota ficticia');

    const view = await diary.get('2026-07-15');
    expect(view.day.targetSnapshot.caloriesKcal).toBe(2000);
    expect(view.meals[0]?.items[0]?.nutritionSnapshot.energyKcal).toBe(100);
    expect(view.meals[0]?.items[0]?.calculated.energyKcal).toBe(50);
    expect(view.water[0]?.amountMl).toBe(250);
    expect(view.day.steps).toBe(8_765);
    expect(view.training?.trained).toBe(true);

    await diary.updateItemQuantity(item.id, 100, 100);
    expect((await diary.get('2026-07-15')).totals.energyKcal).toBe(100);
    await diary.updateWater(water.id, 300);
    expect((await diary.get('2026-07-15')).water[0]?.amountMl).toBe(300);
    await diary.deleteWater(water.id);
    expect((await diary.get('2026-07-15')).water).toHaveLength(0);
    await expect(diary.setSteps('2026-07-15', 8_765.5)).rejects.toThrow('número entero');
  });

  it('rechaza g/ml incompatibles y valida porciones contra la unidad base', async () => {
    const { foods, diary } = await fixture();
    const grams = await foods.save(gramFood, [{ name: 'Bol ficticio', amount: 75 }]);
    const millilitres = await foods.save({ ...gramFood, name: 'Bebida ficticia', baseUnit: 'ml' }, []);
    const portion = (await foods.portions(grams.id))[0]!;

    await expect(diary.addFood('2026-07-15', 'breakfast', grams.id, 100, 'ml', 100)).rejects.toThrow('mililitros');
    await expect(diary.addFood('2026-07-15', 'breakfast', millilitres.id, 100, 'g', 100)).rejects.toThrow('gramos');
    await expect(diary.addFood('2026-07-15', 'breakfast', grams.id, 2, 'portion', 149, '', 'consumed', undefined, portion.id)).rejects.toThrow('equivalencia');

    const item = await diary.addFood('2026-07-15', 'breakfast', grams.id, 2, 'portion', 150, 'Porción ficticia', 'consumed', undefined, portion.id);
    expect(item.baseAmount).toBe(150);
    expect(item.portionId).toBe(portion.id);
    expect(item.calculated.energyKcal).toBe(150);
  });

  it('agrupa varios elementos, calcula subtotal, edita nota y mueve o elimina', async () => {
    const { foods, diary } = await fixture();
    const first = await foods.save(gramFood, []);
    const second = await foods.save({ ...gramFood, name: 'Segundo alimento', energyKcal: 200 }, []);
    const firstItem = await diary.addFood('2026-07-15', 'breakfast', first.id, 100, 'g', 100, 'Nota inicial');
    const breakfast = (await diary.get('2026-07-15')).meals[0]!;
    const secondItem = await diary.addFood('2026-07-15', 'breakfast', second.id, 50, 'g', 50, '', 'consumed', breakfast.id);

    let view = await diary.get('2026-07-15');
    expect(view.meals).toHaveLength(1);
    expect(view.meals[0]!.items).toHaveLength(2);
    expect(view.meals[0]!.totals.energyKcal).toBe(200);

    await diary.updateItem(firstItem.id, { quantity: 75, baseAmount: 75, note: 'Nota editada', mealType: 'dinner' });
    view = await diary.get('2026-07-15');
    expect(view.meals.find((meal) => meal.mealType === 'dinner')?.items[0]?.note).toBe('Nota editada');
    expect(view.meals.find((meal) => meal.mealType === 'breakfast')?.items.map((item) => item.id)).toEqual([secondItem.id]);

    await diary.deleteItem(secondItem.id);
    view = await diary.get('2026-07-15');
    expect(view.meals.find((meal) => meal.mealType === 'breakfast')).toBeUndefined();
    expect(view.meals.find((meal) => meal.mealType === 'dinner')?.items).toHaveLength(1);
    expect(await diary.recentSources()).toHaveLength(1);
    expect(await diary.recentMeals()).toHaveLength(1);
  });
});
