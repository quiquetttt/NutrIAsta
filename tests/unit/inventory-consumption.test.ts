import { afterEach, describe, expect, it } from 'vitest';

import { FoodRepository } from '@/storage/food-repository.web';
import { InventoryConsumptionService } from '@/storage/inventory-consumption-service.web';
import { InventoryRepository } from '@/storage/inventory-repository.web';
import { NutrIAstaMainDatabase } from '@/storage/main-database.web';

let database: NutrIAstaMainDatabase | null = null;

async function setup() {
  database = new NutrIAstaMainDatabase(`inventory-${crypto.randomUUID()}`);
  await database.open();
  await database.metadata.bulkPut([
    { key: 'activeSource', value: 'main' },
    { key: 'activeMainDatasetId', value: 'dataset-ficticio' },
  ]);
  const foods = new FoodRepository(database);
  const food = await foods.save({
    name: 'Arroz ficticio', brand: '', supermarket: '',
    baseUnit: 'g', energyKcal: 350, energyKj: null, proteinG: 8,
    carbohydratesG: 75, fatG: 2, energySource: 'declared',
    dataOrigin: 'manual', notes: '', favorite: false,
  }, [{ name: 'Envase ficticio', amount: 125 }]);
  return {
    food,
    inventory: new InventoryRepository(database),
    consumption: new InventoryConsumptionService(database),
  };
}

afterEach(async () => {
  if (database) {
    database.close();
    await database.delete();
    database = null;
  }
});

describe('inventario y consumo atómico', () => {
  it('descuenta una vez con clave idempotente y conserva nutrición completa', async () => {
    const { food, inventory, consumption } = await setup();
    await inventory.addStock(food.id, 200, 'stock-1');
    const input = {
      date: '2026-07-26', mealType: 'lunch' as const, foodId: food.id,
      quantity: 100, quantityUnit: 'g' as const, baseAmount: 100,
      note: '', operationId: 'consume-1',
      choice: { foodId: food.id, decision: 'full' as const, addToShopping: false },
    };
    await consumption.addFood(input);
    await consumption.addFood(input);
    expect((await inventory.list())[0]).toMatchObject({ derivedMilliBase: 100_000, reconciled: true });
    expect(await database!.mealItems.count()).toBe(1);
    expect(await database!.inventoryMovements.where('[datasetId+operationId]').equals(['dataset-ficticio', 'consume-1']).count()).toBe(1);
    expect((await database!.mealItems.toArray())[0]!.calculated.energyKcal).toBe(350);
  });

  it('edita solo la diferencia, revierte al planificar y usa una operación nueva al reconsumir', async () => {
    const { food, inventory, consumption } = await setup();
    await inventory.addStock(food.id, 300, 'stock-2');
    const item = await consumption.addFood({
      date: '2026-07-26', mealType: 'lunch', foodId: food.id,
      quantity: 100, quantityUnit: 'g', baseAmount: 100, note: '',
      operationId: 'consume-2',
      choice: { foodId: food.id, decision: 'full', addToShopping: false },
    });
    const plan = await consumption.prepareItemUpdate(item.id, 150);
    await consumption.updateConsumedItem({
      plan, quantity: 150, baseAmount: 150, note: 'Editado ficticio',
      mealType: 'lunch', operationId: 'edit-2',
      choices: [{ foodId: food.id, decision: 'full', addToShopping: false }],
    });
    expect((await inventory.list())[0]!.derivedMilliBase).toBe(150_000);
    const entryId = (await database!.mealItems.get([item.datasetId, item.id]))!.mealEntryId;
    await consumption.returnMealToPlanned(entryId, 'planned-2');
    expect((await inventory.list())[0]!.derivedMilliBase).toBe(300_000);
    const reconsume = await consumption.preparePlannedMeal(entryId);
    await consumption.consumePlannedMeal(reconsume, [{ foodId: food.id, decision: 'full', addToShopping: false }], 'reconsume-2');
    expect((await inventory.list())[0]!.derivedMilliBase).toBe(150_000);
    expect(new Set((await database!.inventoryMovements.toArray()).map(({ operationId }) => operationId)))
      .toEqual(new Set(['stock-2', 'consume-2', 'edit-2', 'planned-2', 'reconsume-2']));
  });

  it('elimina mediante movimiento inverso sin borrar el historial', async () => {
    const { food, inventory, consumption } = await setup();
    await inventory.addStock(food.id, 100, 'stock-3');
    const item = await consumption.addFood({
      date: '2026-07-26', mealType: 'dinner', foodId: food.id,
      quantity: 80, quantityUnit: 'g', baseAmount: 80, note: '',
      operationId: 'consume-3',
      choice: { foodId: food.id, decision: 'full', addToShopping: false },
    });
    await consumption.deleteConsumedItem(item.id, 'delete-3');
    expect((await inventory.list())[0]!.derivedMilliBase).toBe(100_000);
    expect(await database!.mealItems.count()).toBe(0);
    expect(await database!.inventoryMovements.where('[datasetId+sourceRef]').equals(['dataset-ficticio', item.id]).count()).toBe(2);
  });

  it('permite descontar solo lo disponible sin recortar la nutrición y registra la diferencia', async () => {
    const { food, inventory, consumption } = await setup();
    await inventory.addStock(food.id, 40, 'stock-4');
    const item = await consumption.addFood({
      date: '2026-07-26', mealType: 'snack', foodId: food.id,
      quantity: 100, quantityUnit: 'g', baseAmount: 100, note: '',
      operationId: 'consume-4',
      choice: { foodId: food.id, decision: 'available-only', addToShopping: true },
    });
    expect((await inventory.list())[0]).toMatchObject({ derivedMilliBase: 0, reconciled: true });
    expect(item.calculated.energyKcal).toBe(350);
    expect(await database!.inventoryConsumptionDecisions.get(['dataset-ficticio', (await database!.inventoryConsumptionDecisions.toArray())[0]!.id]))
      .toMatchObject({ requestedMilliBase: 100_000, deductedMilliBase: 40_000, missingMilliBase: 60_000, inventoryDifference: true });
    expect(await database!.shoppingListItems.count()).toBe(1);
  });

  it('bloquea movimientos cuando el saldo materializado diverge y no escribe parcialmente', async () => {
    const { food, inventory } = await setup();
    await inventory.addStock(food.id, 100, 'stock-5');
    const item = (await database!.inventoryItems.toArray())[0]!;
    await database!.inventoryItems.update([item.datasetId, item.id], { balanceMilliBase: 99_000 });
    await expect(inventory.removeStock(food.id, 10, 'remove-5')).rejects.toThrow(/no coincide/);
    expect(await database!.inventoryMovements.count()).toBe(1);
    expect((await database!.inventoryItems.toArray())[0]!.balanceMilliBase).toBe(99_000);
  });
});
