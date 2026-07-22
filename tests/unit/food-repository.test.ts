import { afterEach, describe, expect, it } from 'vitest';
import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { FoodRepository } from '@/storage/food-repository.web';

let database: NutrIAstaMainDatabase | null = null;
afterEach(async () => { if (database) { database.close(); await database.delete(); database = null; } });

describe('catálogo local', () => {
  it('guarda porciones, busca, marca favorito, reciente y evita EAN duplicados', async () => {
    database = new NutrIAstaMainDatabase(`foods-${crypto.randomUUID()}`); await database.open();
    await database.metadata.bulkPut([{ key: 'activeSource', value: 'main' }, { key: 'activeMainDatasetId', value: 'dataset-ficticio' }]);
    const repository = new FoodRepository(database);
    const draft = { name: 'Alimento ficticio', brand: 'Marca prueba', supermarket: 'Tienda prueba', barcode: '8412345678905', baseUnit: 'g' as const, energyKcal: 200, energyKj: null, proteinG: 10, carbohydratesG: 20, fatG: 5, energySource: 'declared' as const, dataOrigin: 'barcode-manual' as const, notes: '', favorite: false };
    const food = await repository.save(draft, [{ name: 'Unidad', amount: 35 }]);
    expect(await repository.portions(food.id)).toMatchObject([{ amount: 35, baseUnit: 'g' }]);
    expect((await repository.list({ search: 'marca' }))[0]?.id).toBe(food.id);
    await repository.setFavorite(food.id, true); await repository.markUsed(food.id);
    expect(await repository.list({ favorites: true })).toHaveLength(1);
    expect(await repository.list({ recent: true })).toHaveLength(1);
    await expect(repository.save({ ...draft, name: 'Duplicado ficticio' }, [])).rejects.toThrow(/Ya existe/);
    await repository.setArchived(food.id, true);
    expect(await repository.list()).toHaveLength(0);
    expect(await repository.list({ includeArchived: true })).toHaveLength(1);
  });
});
