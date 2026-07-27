import { afterEach, describe, expect, it } from 'vitest';

import { FoodRepository } from '@/storage/food-repository.web';
import { InventoryRepository } from '@/storage/inventory-repository.web';
import { NutrIAstaMainDatabase } from '@/storage/main-database.web';

let database: NutrIAstaMainDatabase | null = null;

async function setup() {
  database = new NutrIAstaMainDatabase(`shopping-${crypto.randomUUID()}`);
  await database.open();
  await database.metadata.bulkPut([
    { key: 'activeSource', value: 'main' },
    { key: 'activeMainDatasetId', value: 'dataset-ficticio' },
  ]);
  const foods = new FoodRepository(database);
  const first = await foods.save({
    name: 'Arroz ficticio', brand: '', supermarket: '', barcode: null,
    baseUnit: 'g', energyKcal: 350, energyKj: null, proteinG: 8,
    carbohydratesG: 75, fatG: 2, energySource: 'declared',
    dataOrigin: 'manual', notes: '', favorite: false,
  }, []);
  const second = await foods.save({
    name: 'Leche ficticia', brand: '', supermarket: '', barcode: null,
    baseUnit: 'ml', energyKcal: 45, energyKj: null, proteinG: 3,
    carbohydratesG: 5, fatG: 2, energySource: 'declared',
    dataOrigin: 'manual', notes: '', favorite: false,
  }, []);
  return { first, second, inventory: new InventoryRepository(database) };
}

afterEach(async () => {
  if (database) {
    database.close();
    await database.delete();
    database = null;
  }
});

describe('lista de la compra transaccional', () => {
  it('edita, vincula con equivalencia explícita y completa de forma idempotente', async () => {
    const { first, inventory } = await setup();
    const item = await inventory.addShoppingItem({ text: 'Envase ficticio', quantity: 1, unit: 'unit' });
    await inventory.updateShoppingItem(item.id, {
      text: 'Envase ficticio editado',
      quantity: 2,
      unit: 'unit',
      note: 'Nota ficticia',
      foodId: first.id,
      canonicalAmount: 250,
    });
    await inventory.markShoppingItem(item.id, true);
    const review = await inventory.preparePurchaseReview();
    expect(review.items[0]).toMatchObject({
      linked: true,
      canonicalAmountMilliBase: 250_000,
      balanceBeforeMilliBase: 0,
      balanceAfterMilliBase: 250_000,
      outcome: 'add-to-inventory',
    });

    await inventory.completeShopping(review);
    await inventory.completeShopping(review);

    expect((await inventory.list()).find(({ food }) => food.id === first.id)?.derivedMilliBase).toBe(250_000);
    expect(await database!.inventoryMovements.where('[datasetId+operationId]').equals(['dataset-ficticio', review.operationId]).count()).toBe(1);
  });

  it('bloquea una entrada manual sin vincular y no deja cambios parciales', async () => {
    const { inventory } = await setup();
    const item = await inventory.addShoppingItem({ text: 'Compra manual ficticia', quantity: 1, unit: 'unit' });
    await inventory.markShoppingItem(item.id, true);
    const review = await inventory.preparePurchaseReview();
    expect(review.items[0]).toMatchObject({ outcome: 'blocked' });

    await expect(inventory.completeShopping(review)).rejects.toThrow(/Vincula/);

    expect(await database!.inventoryMovements.count()).toBe(0);
    expect((await database!.shoppingLists.get(['dataset-ficticio', review.listId]))?.status).toBe('active');
    expect((await database!.shoppingListItems.get(['dataset-ficticio', item.id]))?.status).toBe('purchased');
  });

  it('cancela toda la compra si el inventario cambia después de la revisión', async () => {
    const { first, second, inventory } = await setup();
    const firstItem = await inventory.addShoppingItem({ foodId: first.id, text: first.name, quantity: 1, unit: 'g', canonicalAmount: 100 });
    const secondItem = await inventory.addShoppingItem({ foodId: second.id, text: second.name, quantity: 1, unit: 'ml', canonicalAmount: 200 });
    await inventory.markShoppingItem(firstItem.id, true);
    await inventory.markShoppingItem(secondItem.id, true);
    const review = await inventory.preparePurchaseReview();
    await inventory.addStock(second.id, 10, 'cambio-posterior');
    const movementsBefore = await database!.inventoryMovements.count();

    await expect(inventory.completeShopping(review)).rejects.toThrow(/inventario cambió/);

    expect(await database!.inventoryMovements.count()).toBe(movementsBefore);
    expect((await database!.shoppingLists.get(['dataset-ficticio', review.listId]))?.status).toBe('active');
    expect((await inventory.list()).find(({ food }) => food.id === first.id)?.derivedMilliBase).toBe(0);
  });

  it('revierte en la lista activa posterior sin duplicar listas ni movimientos', async () => {
    const { first, second, inventory } = await setup();
    const purchased = await inventory.addShoppingItem({ foodId: first.id, text: first.name, quantity: 1, unit: 'g', canonicalAmount: 100 });
    const pending = await inventory.addShoppingItem({ foodId: second.id, text: second.name, quantity: 1, unit: 'ml', canonicalAmount: 500 });
    await inventory.markShoppingItem(purchased.id, true);
    const review = await inventory.preparePurchaseReview();
    await inventory.completeShopping(review);
    const activeAfterPurchase = await inventory.activeShoppingList();
    expect(activeAfterPurchase.items.map(({ id }) => id)).toEqual([pending.id]);

    const completed = (await withContext('listar compras completadas', inventory.completedShoppingLists()))[0]!;
    await inventory.addShoppingItem({ foodId: first.id, text: first.name, quantity: 1, unit: 'g', canonicalAmount: 50 });
    await inventory.undoShopping(completed.id, 'undo-ficticio');
    await inventory.undoShopping(completed.id, 'undo-repetido');

    const activeLists = await database!.shoppingLists.where('[datasetId+status]').equals(['dataset-ficticio', 'active']).toArray();
    expect(activeLists).toHaveLength(1);
    const reopenedItems = await database!.shoppingListItems.where('[datasetId+shoppingListId]').equals(['dataset-ficticio', activeLists[0]!.id]).toArray();
    expect(reopenedItems.filter(({ foodId }) => foodId === first.id)).toHaveLength(1);
    expect(await database!.inventoryMovements.where('[datasetId+operationId]').equals(['dataset-ficticio', 'undo-ficticio']).count()).toBe(1);
    expect(await database!.inventoryMovements.where('[datasetId+operationId]').equals(['dataset-ficticio', 'undo-repetido']).count()).toBe(0);
    expect((await inventory.list()).find(({ food }) => food.id === first.id)?.derivedMilliBase).toBe(0);
  });

  it('bloquea el deshacer por saldo negativo sin escribir una reversión', async () => {
    const { first, inventory } = await setup();
    const item = await inventory.addShoppingItem({ foodId: first.id, text: first.name, quantity: 1, unit: 'g', canonicalAmount: 100 });
    await inventory.markShoppingItem(item.id, true);
    const review = await inventory.preparePurchaseReview();
    await inventory.completeShopping(review);
    const completed = (await withContext('listar compra para saldo negativo', inventory.completedShoppingLists()))[0]!;
    await inventory.removeStock(first.id, 60, 'consumo-ficticio');

    await expect(inventory.undoShopping(completed.id, 'undo-bloqueado')).rejects.toThrow(/ya fue consumida/);

    expect(await database!.inventoryMovements.where('[datasetId+operationId]').equals(['dataset-ficticio', 'undo-bloqueado']).count()).toBe(0);
    expect((await database!.shoppingLists.get(['dataset-ficticio', completed.id]))?.undoneAt).toBeUndefined();
  });
});

async function withContext<T>(label: string, promise: Promise<T>): Promise<T> {
  try { return await promise; }
  catch (error) { throw new Error(label, { cause: error }); }
}
