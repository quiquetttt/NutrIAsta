import type { QuantityUnit } from '@/mvp/diary-types';
import type { Food, FoodBaseUnit } from '@/mvp/food-types';
import type {
  InventoryItem,
  InventoryMovement,
  ShoppingList,
  ShoppingListItem,
} from '@/mvp/inventory-types';
import {
  mainDatabase,
  type NutrIAstaMainDatabase,
} from '@/storage/main-database.web';
import { MAIN_META_KEYS } from '@/storage/main-schema';
import { trackWrite } from '@/storage/write-tracker';
import { createId } from '@/utils/crypto';

export interface InventoryViewItem {
  food: Food;
  inventory: InventoryItem | null;
  derivedMilliBase: number;
  reconciled: boolean;
}

export interface PurchaseReviewItem {
  itemId: string;
  itemUpdatedAt: string;
  text: string;
  purchased: boolean;
  linked: boolean;
  quantity: number;
  unit: QuantityUnit;
  canonicalAmountMilliBase: number | null;
  canonicalUnit: FoodBaseUnit | null;
  balanceBeforeMilliBase: number | null;
  balanceAfterMilliBase: number | null;
  outcome: 'add-to-inventory' | 'keep-active' | 'blocked';
  blockingReason?: string;
}

export interface PurchaseReview {
  datasetId: string;
  listId: string;
  listUpdatedAt: string;
  operationId: string;
  items: PurchaseReviewItem[];
}

export class InventoryRepository {
  constructor(private readonly db: NutrIAstaMainDatabase = mainDatabase) {}

  async list(): Promise<InventoryViewItem[]> {
    const datasetId = await this.activeDatasetId();
    const [foods, items, movements] = await Promise.all([
      this.db.foods.where('datasetId').equals(datasetId).toArray(),
      this.db.inventoryItems.where('datasetId').equals(datasetId).toArray(),
      this.db.inventoryMovements.where('datasetId').equals(datasetId).toArray(),
    ]);
    return foods.filter(({ archived }) => !archived).map((food) => {
      const inventory = items.find(({ foodId }) => foodId === food.id) ?? null;
      const derivedMilliBase = movements.filter(({ foodId }) => foodId === food.id)
        .reduce((sum, movement) => sum + movement.deltaMilliBase, 0);
      return {
        food,
        inventory,
        derivedMilliBase,
        reconciled: (inventory?.balanceMilliBase ?? 0) === derivedMilliBase,
      };
    }).sort((left, right) => left.food.name.localeCompare(right.food.name, 'es'));
  }

  async movements(): Promise<InventoryMovement[]> {
    const datasetId = await this.activeDatasetId();
    return (await this.db.inventoryMovements.where('datasetId').equals(datasetId).toArray())
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  }

  async addStock(
    foodId: string,
    amount: number,
    operationId = createId('inventory-operation'),
    sourceType = 'manual-adjustment',
    sourceRef = operationId,
  ): Promise<InventoryMovement> {
    const delta = toMilliBase(amount);
    if (delta <= 0) throw new Error('La cantidad añadida debe ser mayor que cero.');
    return this.applySingleMovement(foodId, delta, 'positive-adjustment', operationId, `${operationId}:positive:${foodId}`, sourceType, sourceRef);
  }

  async removeStock(
    foodId: string,
    amount: number,
    operationId = createId('inventory-operation'),
  ): Promise<InventoryMovement> {
    const delta = toMilliBase(amount);
    if (delta <= 0) throw new Error('La cantidad retirada debe ser mayor que cero.');
    return this.applySingleMovement(foodId, -delta, 'negative-adjustment', operationId, `${operationId}:negative:${foodId}`, 'manual-adjustment', operationId);
  }

  async activeShoppingList(): Promise<{ list: ShoppingList; items: ShoppingListItem[] }> {
    const datasetId = await this.activeDatasetId();
    let list = (await this.db.shoppingLists.where('[datasetId+status]').equals([datasetId, 'active']).toArray())[0];
    if (!list) {
      const now = new Date().toISOString();
      list = { datasetId, id: createId('shopping-list'), status: 'active', createdAt: now, updatedAt: now };
      await trackWrite(() => this.db.shoppingLists.add(list!));
    }
    const items = await this.db.shoppingListItems.where('[datasetId+shoppingListId]').equals([datasetId, list.id]).toArray();
    return { list, items };
  }

  async addShoppingItem(input: { foodId?: string; text: string; quantity: number; unit: QuantityUnit; canonicalAmount?: number; note?: string; source?: ShoppingListItem['source']; sourceOperationId?: string }): Promise<ShoppingListItem> {
    if (!input.text.trim() || input.text.trim().length > 120) throw new Error('Introduce un texto de compra válido.');
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('La cantidad de compra debe ser mayor que cero.');
    const datasetId = await this.activeDatasetId();
    const { list } = await this.activeShoppingList();
    const now = new Date().toISOString();
    let result: ShoppingListItem | null = null;
    await trackWrite(() => this.db.transaction('rw', [
      this.db.metadata,
      this.db.foods,
      this.db.shoppingListItems,
    ], async () => {
      await this.assertActive(datasetId);
      const existing = input.foodId
        ? (await this.db.shoppingListItems.where('[datasetId+shoppingListId]').equals([datasetId, list.id]).toArray())
          .find((item) => item.foodId === input.foodId && item.status === 'pending')
        : undefined;
      if (existing) {
        result = { ...existing, quantity: existing.quantity + input.quantity, updatedAt: now };
        if (input.canonicalAmount !== undefined && existing.canonicalAmountMilliBase !== undefined) {
          result.canonicalAmountMilliBase = existing.canonicalAmountMilliBase + toMilliBase(input.canonicalAmount);
        }
        await this.db.shoppingListItems.put(result);
      } else {
        const food = input.foodId ? await this.db.foods.get([datasetId, input.foodId]) : undefined;
        result = {
          datasetId,
          id: createId('shopping-item'),
          shoppingListId: list.id,
          foodId: food?.id,
          text: input.text.trim(),
          quantity: input.quantity,
          unit: input.unit,
          canonicalAmountMilliBase: input.canonicalAmount === undefined ? undefined : toMilliBase(input.canonicalAmount),
          canonicalUnit: input.canonicalAmount === undefined ? undefined : food?.baseUnit,
          note: input.note?.trim() ?? '',
          status: 'pending',
          source: input.source ?? 'manual',
          sourceOperationId: input.sourceOperationId,
          createdAt: now,
          updatedAt: now,
        };
        await this.db.shoppingListItems.add(result);
      }
    }));
    return result!;
  }

  async updateShoppingItem(id: string, input: {
    text: string;
    quantity: number;
    unit: QuantityUnit;
    note: string;
    foodId?: string;
    canonicalAmount?: number;
  }): Promise<void> {
    if (!input.text.trim() || input.text.trim().length > 120) throw new Error('Introduce un texto de compra válido.');
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('La cantidad de compra debe ser mayor que cero.');
    const datasetId = await this.activeDatasetId();
    const item = await this.db.shoppingListItems.get([datasetId, id]);
    if (!item) throw new Error('El elemento de compra no existe.');
    const food = input.foodId ? await this.db.foods.get([datasetId, input.foodId]) : undefined;
    if (input.foodId && !food) throw new Error('El alimento vinculado no existe.');
    const canonicalAmountMilliBase = input.canonicalAmount === undefined
      ? undefined
      : toMilliBase(input.canonicalAmount);
    if (food && (!canonicalAmountMilliBase || canonicalAmountMilliBase <= 0)) {
      throw new Error('Indica una equivalencia explícita con la unidad base antes de incorporar al inventario.');
    }
    const equivalence = food && canonicalAmountMilliBase ? {
      inputQuantity: input.quantity,
      inputUnit: input.unit,
      basePerInputMilliBase: Math.round(canonicalAmountMilliBase / input.quantity),
      canonicalUnit: food.baseUnit,
    } : undefined;
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.shoppingLists, this.db.shoppingListItems, async () => {
      await this.assertActive(datasetId);
      const list = await this.db.shoppingLists.get([datasetId, item.shoppingListId]);
      if (!list || list.status !== 'active') throw new Error('Solo se editan elementos de la lista activa.');
      const now = new Date().toISOString();
      await this.db.shoppingListItems.update([datasetId, id], {
        text: input.text.trim(),
        quantity: input.quantity,
        unit: input.unit,
        note: input.note.trim(),
        foodId: food?.id,
        canonicalAmountMilliBase,
        canonicalUnit: food?.baseUnit,
        equivalence,
        updatedAt: now,
      });
      await this.db.shoppingLists.update([datasetId, list.id], { updatedAt: now });
    }));
  }

  async markShoppingItem(id: string, purchased: boolean): Promise<void> {
    const datasetId = await this.activeDatasetId();
    await trackWrite(() => this.db.shoppingListItems.update([datasetId, id], {
      status: purchased ? 'purchased' : 'pending',
      updatedAt: new Date().toISOString(),
    }));
  }

  async deleteShoppingItem(id: string): Promise<void> {
    const datasetId = await this.activeDatasetId();
    await trackWrite(() => this.db.shoppingListItems.delete([datasetId, id]));
  }

  async preparePurchaseReview(): Promise<PurchaseReview> {
    const datasetId = await this.activeDatasetId();
    const { list, items } = await this.activeShoppingList();
    const balances = new Map((await this.db.inventoryItems.where('datasetId').equals(datasetId).toArray())
      .map((item) => [item.foodId, item.balanceMilliBase]));
    return {
      datasetId,
      listId: list.id,
      listUpdatedAt: list.updatedAt,
      operationId: createId('purchase'),
      items: items.map((item) => {
        const purchased = item.status === 'purchased';
        const linked = Boolean(item.foodId);
        const canonicalAmount = item.canonicalAmountMilliBase ?? null;
        const canonicalUnit = item.canonicalUnit ?? null;
        const before = item.foodId ? balances.get(item.foodId) ?? 0 : null;
        const blockingReason = purchased && !linked
          ? 'Vincula esta entrada manual a un alimento.'
          : purchased && (!canonicalAmount || !canonicalUnit)
            ? 'Define una equivalencia explícita con la unidad base.'
            : undefined;
        return {
          itemId: item.id,
          itemUpdatedAt: item.updatedAt,
          text: item.text,
          purchased,
          linked,
          quantity: item.quantity,
          unit: item.unit,
          canonicalAmountMilliBase: canonicalAmount,
          canonicalUnit,
          balanceBeforeMilliBase: before,
          balanceAfterMilliBase: purchased && before !== null && canonicalAmount ? before + canonicalAmount : before,
          outcome: blockingReason ? 'blocked' : purchased ? 'add-to-inventory' : 'keep-active',
          blockingReason,
        };
      }),
    };
  }

  async completeShopping(review: PurchaseReview): Promise<void> {
    const datasetId = await this.activeDatasetId();
    if (review.datasetId !== datasetId) throw new Error('La revisión pertenece a otro dataset.');
    const list = await this.db.shoppingLists.get([datasetId, review.listId]);
    if (list?.status === 'completed' && list.sourceOperationId === review.operationId) return;
    if (!list || list.status !== 'active' || list.updatedAt !== review.listUpdatedAt) {
      throw new Error('La lista cambió; vuelve a revisar la compra.');
    }
    const items = await this.db.shoppingListItems.where('[datasetId+shoppingListId]').equals([datasetId, list.id]).toArray();
    const reviewedIds = new Set(review.items.map(({ itemId }) => itemId));
    if (items.length !== reviewedIds.size || items.some(({ id }) => !reviewedIds.has(id))) {
      throw new Error('Los elementos cambiaron; vuelve a revisar la compra.');
    }
    const reviewedById = new Map(review.items.map((item) => [item.itemId, item]));
    if (items.some((item) => reviewedById.get(item.id)?.itemUpdatedAt !== item.updatedAt)) {
      throw new Error('Un elemento cambió; vuelve a revisar la compra.');
    }
    const purchased = items.filter(({ status }) => status === 'purchased');
    if (purchased.length === 0) throw new Error('Marca al menos un elemento como comprado.');
    for (const item of purchased) {
      if (!item.foodId) throw new Error(`Vincula ${item.text} a un alimento antes de completar.`);
      if (!item.canonicalAmountMilliBase || !item.canonicalUnit) throw new Error(`Falta una equivalencia explícita para ${item.text}.`);
    }
    const now = new Date().toISOString();
    await trackWrite(() => this.db.transaction(
      'rw',
      this.db.metadata,
      this.db.inventoryItems,
      this.db.inventoryMovements,
      this.db.shoppingLists,
      this.db.shoppingListItems,
      async () => {
        await this.assertActive(datasetId);
        const currentList = await this.db.shoppingLists.get([datasetId, list.id]);
        if (!currentList || currentList.status !== 'active' || currentList.updatedAt !== review.listUpdatedAt) {
          throw new Error('La lista cambió durante la confirmación.');
        }
        const currentItems = await this.db.shoppingListItems.where('[datasetId+shoppingListId]').equals([datasetId, list.id]).toArray();
        if (currentItems.length !== items.length || currentItems.some((item) => reviewedById.get(item.id)?.itemUpdatedAt !== item.updatedAt)) {
          throw new Error('Los elementos cambiaron durante la confirmación.');
        }
        for (const reviewed of review.items.filter(({ outcome }) => outcome === 'add-to-inventory')) {
          const current = reviewed.linked
            ? await this.db.inventoryItems.where('[datasetId+foodId]').equals([datasetId, items.find(({ id }) => id === reviewed.itemId)!.foodId!]).first()
            : undefined;
          if ((current?.balanceMilliBase ?? 0) !== reviewed.balanceBeforeMilliBase) {
            throw new Error('El inventario cambió; vuelve a revisar la compra.');
          }
        }
        for (const item of purchased) {
          if (!item.foodId || !item.canonicalAmountMilliBase || !item.canonicalUnit) {
            throw new Error(`La revisión de ${item.text} ya no es válida.`);
          }
          const key = `${review.operationId}:purchase:${item.id}:${item.foodId}`;
          if (await this.db.inventoryMovements.where('[datasetId+idempotencyKey]').equals([datasetId, key]).first()) continue;
          await this.writeMovementInTransaction({
            datasetId,
            foodId: item.foodId,
            canonicalUnit: item.canonicalUnit,
            deltaMilliBase: item.canonicalAmountMilliBase,
            kind: 'purchase',
            operationId: review.operationId,
            idempotencyKey: key,
            sourceType: 'shopping-list',
            sourceRef: item.id,
            occurredAt: now,
            note: `Compra: ${item.text}`,
          });
        }
        await this.db.shoppingLists.update([datasetId, list.id], { status: 'completed', sourceOperationId: review.operationId, completedAt: now, updatedAt: now });
        const remaining = items.filter(({ status }) => status === 'pending');
        if (remaining.length) {
          const next: ShoppingList = { datasetId, id: createId('shopping-list'), status: 'active', reopenedFromListId: list.id, createdAt: now, updatedAt: now };
          await this.db.shoppingLists.add(next);
          await Promise.all(remaining.map((item) => this.db.shoppingListItems.update([datasetId, item.id], { shoppingListId: next.id, updatedAt: now })));
        }
      },
    ));
  }

  async undoShopping(listId: string, operationId = createId('undo-purchase')): Promise<void> {
    const datasetId = await this.activeDatasetId();
    const list = await this.db.shoppingLists.get([datasetId, listId]);
    if (!list || list.datasetId !== datasetId || list.status !== 'completed' || !list.sourceOperationId) throw new Error('La compra no puede deshacerse.');
    if (list.undoneAt) return;
    const movements = await this.db.inventoryMovements.where('[datasetId+operationId]').equals([datasetId, list.sourceOperationId]).toArray();
    const current = new Map((await this.db.inventoryItems.where('datasetId').equals(datasetId).toArray()).map((item) => [item.foodId, item]));
    for (const movement of movements) {
      if ((current.get(movement.foodId)?.balanceMilliBase ?? 0) < movement.deltaMilliBase) {
        throw new Error('No se puede deshacer: parte de la compra ya fue consumida.');
      }
    }
    const now = new Date().toISOString();
    await trackWrite(() => this.db.transaction('rw', [
      this.db.metadata,
      this.db.inventoryItems,
      this.db.inventoryMovements,
      this.db.shoppingLists,
      this.db.shoppingListItems,
    ], async () => {
      await this.assertActive(datasetId);
      for (const movement of movements) {
        await this.writeMovementInTransaction({
          datasetId,
          foodId: movement.foodId,
          canonicalUnit: movement.canonicalUnit,
          deltaMilliBase: -movement.deltaMilliBase,
          kind: 'reversal',
          operationId,
          idempotencyKey: `${operationId}:reverse:${movement.id}`,
          sourceType: 'shopping-undo',
          sourceRef: list.id,
          relatedMovementId: movement.id,
          occurredAt: now,
          note: 'Deshacer compra',
        });
      }
      const otherActive = (await this.db.shoppingLists.where('[datasetId+status]').equals([datasetId, 'active']).toArray())
        .find(({ id }) => id !== list.id);
      const items = await this.db.shoppingListItems.where('[datasetId+shoppingListId]').equals([datasetId, list.id]).toArray();
      if (!otherActive) {
        await this.db.shoppingLists.update([datasetId, list.id], {
          status: 'active',
          completedAt: undefined,
          undoneAt: now,
          undoOperationId: operationId,
          updatedAt: now,
        });
        await Promise.all(items.map((item) => this.db.shoppingListItems.update([datasetId, item.id], { status: 'pending', updatedAt: now })));
      } else {
        const activeItems = await this.db.shoppingListItems.where('[datasetId+shoppingListId]').equals([datasetId, otherActive.id]).toArray();
        for (const item of items) {
          const existing = activeItems.find((candidate) => candidate.status === 'pending' && (
            item.foodId ? candidate.foodId === item.foodId : !candidate.foodId && candidate.text === item.text && candidate.unit === item.unit
          ));
          if (existing) {
            await this.db.shoppingListItems.update([datasetId, existing.id], {
              quantity: existing.quantity + item.quantity,
              canonicalAmountMilliBase: existing.canonicalAmountMilliBase !== undefined && item.canonicalAmountMilliBase !== undefined
                ? existing.canonicalAmountMilliBase + item.canonicalAmountMilliBase
                : existing.canonicalAmountMilliBase,
              updatedAt: now,
            });
            await this.db.shoppingListItems.delete([datasetId, item.id]);
          } else {
            await this.db.shoppingListItems.update([datasetId, item.id], {
              shoppingListId: otherActive.id,
              status: 'pending',
              updatedAt: now,
            });
          }
        }
        await this.db.shoppingLists.update([datasetId, otherActive.id], {
          reopenedFromListId: list.id,
          updatedAt: now,
        });
        await this.db.shoppingLists.update([datasetId, list.id], {
          undoneAt: now,
          undoOperationId: operationId,
          updatedAt: now,
        });
      }
    }));
  }

  async completedShoppingLists(): Promise<ShoppingList[]> {
    const datasetId = await this.activeDatasetId();
    return (await this.db.shoppingLists.where('[datasetId+status]').equals([datasetId, 'completed']).toArray())
      .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''));
  }

  private async applySingleMovement(foodId: string, deltaMilliBase: number, kind: InventoryMovement['kind'], operationId: string, idempotencyKey: string, sourceType: string, sourceRef: string) {
    const datasetId = await this.activeDatasetId();
    const food = await this.db.foods.get([datasetId, foodId]);
    if (!food) throw new Error('El alimento no existe.');
    let result: InventoryMovement | null = null;
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.inventoryItems, this.db.inventoryMovements, async () => {
      await this.assertActive(datasetId);
      const duplicate = await this.db.inventoryMovements.where('[datasetId+idempotencyKey]').equals([datasetId, idempotencyKey]).first();
      if (duplicate) { result = duplicate; return; }
      result = await this.writeMovementInTransaction({
        datasetId,
        foodId,
        canonicalUnit: food.baseUnit,
        deltaMilliBase,
        kind,
        operationId,
        idempotencyKey,
        sourceType,
        sourceRef,
        occurredAt: new Date().toISOString(),
        note: '',
      });
    }));
    return result!;
  }

  async writeMovementInTransaction(input: Omit<InventoryMovement, 'id' | 'balanceAfterMilliBase' | 'createdAt'>): Promise<InventoryMovement> {
    const current = await this.db.inventoryItems.get([input.datasetId, `inventory-${input.foodId}`])
      ?? (await this.db.inventoryItems.where('[datasetId+foodId]').equals([input.datasetId, input.foodId]).first());
    if (current && current.canonicalUnit !== input.canonicalUnit) throw new Error('La unidad canónica del inventario no coincide.');
    const derivedMilliBase = (await this.db.inventoryMovements
      .where('[datasetId+foodId]')
      .equals([input.datasetId, input.foodId])
      .toArray())
      .reduce((sum, movement) => sum + movement.deltaMilliBase, 0);
    if ((current?.balanceMilliBase ?? 0) !== derivedMilliBase) {
      throw new Error('El saldo materializado no coincide con sus movimientos; se bloquea la operación.');
    }
    const balanceAfterMilliBase = derivedMilliBase + input.deltaMilliBase;
    if (balanceAfterMilliBase < 0) throw new Error('La operación dejaría un saldo negativo.');
    const now = new Date().toISOString();
    const movement: InventoryMovement = { ...input, id: createId('inventory-movement'), balanceAfterMilliBase, createdAt: now };
    await this.db.inventoryMovements.add(movement);
    const item: InventoryItem = {
      datasetId: input.datasetId,
      id: current?.id ?? `inventory-${input.foodId}`,
      foodId: input.foodId,
      canonicalUnit: input.canonicalUnit,
      balanceMilliBase: balanceAfterMilliBase,
      revision: (current?.revision ?? 0) + 1,
      lastMovementId: movement.id,
      reconciledAt: now,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    await this.db.inventoryItems.put(item);
    return movement;
  }

  private async activeDatasetId() {
    await this.db.open();
    const source = (await this.db.metadata.get(MAIN_META_KEYS.activeSource))?.value;
    const id = (await this.db.metadata.get(MAIN_META_KEYS.activeMainDatasetId))?.value;
    if (source !== 'main' || typeof id !== 'string') throw new Error('No existe un dataset principal activo.');
    return id;
  }
  private async assertActive(datasetId: string) {
    if (await this.activeDatasetId() !== datasetId) throw new Error('El dataset activo cambió durante la operación.');
  }
}

export function toMilliBase(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('La cantidad canónica no es válida.');
  const value = amount * 1_000;
  const rounded = Math.round(value);
  if (!Number.isSafeInteger(rounded) || Math.abs(value - rounded) > 0.0000001) {
    throw new Error('La cantidad admite como máximo tres decimales.');
  }
  return rounded;
}
export function fromMilliBase(value: number): number { return value / 1_000; }

export const inventoryRepository = new InventoryRepository();
