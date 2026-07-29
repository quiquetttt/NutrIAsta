import { calculateFromSnapshot, sumNutrition } from '@/mvp/diary-calculations';
import type {
  MealEntry,
  MealItem,
  MealType,
  NutritionSnapshot,
  QuantityUnit,
} from '@/mvp/diary-types';
import type {
  InventoryConsumptionDecision,
  InventoryConsumptionDecisionKind,
  ShoppingList,
  ShoppingListItem,
} from '@/mvp/inventory-types';
import {
  mainDatabase,
  type NutrIAstaMainDatabase,
} from '@/storage/main-database.web';
import {
  InventoryRepository,
  toMilliBase,
} from '@/storage/inventory-repository.web';
import { MAIN_META_KEYS } from '@/storage/main-schema';
import { trackWrite } from '@/storage/write-tracker';
import { createId } from '@/utils/crypto';

export interface ConsumptionIngredientPlan {
  foodId: string;
  foodName: string;
  canonicalUnit: 'g' | 'ml';
  requestedMilliBase: number;
  availableMilliBase: number;
  revision: number;
  equivalence?: InventoryConsumptionDecision['equivalence'];
}

export interface ConsumptionPlan {
  datasetId: string;
  ingredients: ConsumptionIngredientPlan[];
}

export interface ConsumptionChoice {
  foodId: string;
  decision: InventoryConsumptionDecisionKind;
  addToShopping: boolean;
}

export interface DiaryFoodConsumptionInput {
  date: string;
  mealType: MealType;
  entryId?: string;
  foodId: string;
  quantity: number;
  quantityUnit: QuantityUnit;
  baseAmount: number;
  portionId?: string;
  note: string;
  operationId: string;
  choice: ConsumptionChoice;
}

export interface ItemUpdatePlan {
  datasetId: string;
  itemId: string;
  itemUpdatedAt: string;
  sourceEntryId: string;
  sourceEntryUpdatedAt: string;
  ingredients: Array<ConsumptionIngredientPlan & {
    currentRequestedMilliBase: number;
    currentDeductedMilliBase: number;
    targetRequestedMilliBase: number;
    requestedDeltaMilliBase: number;
  }>;
}

export interface PlannedMealConsumptionPlan {
  datasetId: string;
  entryId: string;
  entryUpdatedAt: string;
  ingredients: ConsumptionIngredientPlan[];
  itemIngredients: Array<{ itemId: string; ingredients: Array<{ foodId: string; requestedMilliBase: number; canonicalUnit: 'g' | 'ml' }> }>;
}

export class InventoryConsumptionService {
  private readonly inventory: InventoryRepository;
  constructor(private readonly db: NutrIAstaMainDatabase = mainDatabase) {
    this.inventory = new InventoryRepository(db);
  }

  async prepareFood(foodId: string, baseAmount: number): Promise<ConsumptionPlan> {
    return this.prepareIngredients([{ foodId, amountBase: baseAmount }]);
  }

  async prepareRecipe(recipeId: string, quantity: number, unit: 'portion' | 'g'): Promise<{ plan: ConsumptionPlan; factor: number }> {
    const datasetId = await this.activeDatasetId();
    const recipe = await this.db.recipes.get([datasetId, recipeId]);
    if (!recipe || recipe.archived) throw new Error('La receta no está disponible.');
    const factor = unit === 'portion' ? quantity / recipe.servings : recipe.finalWeightG ? quantity / recipe.finalWeightG : 0;
    if (!Number.isFinite(factor) || factor <= 0) throw new Error('La cantidad de receta no es válida.');
    const items = await this.db.recipeItems.where('[datasetId+recipeId]').equals([datasetId, recipeId]).toArray();
    return {
      plan: await this.prepareIngredients(items.map((item) => ({ foodId: item.foodId, amountBase: item.amountBase * factor }))),
      factor,
    };
  }

  async addFood(input: DiaryFoodConsumptionInput): Promise<MealItem> {
    const plan = await this.prepareFood(input.foodId, input.baseAmount);
    const ingredient = plan.ingredients[0]!;
    validateChoice(ingredient, input.choice);
    const datasetId = plan.datasetId;
    const food = await this.db.foods.get([datasetId, input.foodId]);
    if (!food || food.archived) throw new Error('El alimento no está disponible.');
    if (input.choice.foodId !== food.id) throw new Error('La decisión no corresponde al alimento.');
    const portion = input.quantityUnit === 'portion' && input.portionId
      ? await this.db.foodPortions.get([datasetId, input.portionId])
      : undefined;
    if (input.quantityUnit === 'portion' && (!portion || portion.foodId !== food.id || toMilliBase(input.quantity * portion.amount) !== ingredient.requestedMilliBase)) {
      throw new Error('La equivalencia de la porción no es válida.');
    }
    const now = new Date().toISOString();
    const entry = await this.makeEntry(datasetId, input.date, input.mealType, input.entryId, input.operationId, now);
    const snapshot: NutritionSnapshot = {
      name: food.name,
      energyKcal: food.energyKcal,
      proteinG: food.proteinG,
      carbohydratesG: food.carbohydratesG,
      fatG: food.fatG,
      baseUnit: food.baseUnit,
      sourceUpdatedAt: food.updatedAt,
    };
    const item: MealItem = {
      datasetId,
      id: `meal-item-${input.operationId}`,
      mealEntryId: entry.id,
      sourceType: 'food',
      sourceId: food.id,
      quantity: input.quantity,
      quantityUnit: input.quantityUnit,
      baseAmount: input.baseAmount,
      portionId: input.portionId,
      nutritionSnapshot: snapshot,
      calculated: calculateFromSnapshot(snapshot, input.baseAmount),
      note: input.note.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await this.commitConsumption({
      datasetId,
      operationId: input.operationId,
      entry,
      isNewEntry: !input.entryId,
      item,
      plans: [{
        ...ingredient,
        equivalence: input.quantityUnit === food.baseUnit ? undefined : {
          inputQuantity: input.quantity,
          inputUnit: input.quantityUnit,
          basePerInputMilliBase: Math.round(ingredient.requestedMilliBase / input.quantity),
          canonicalUnit: food.baseUnit,
        },
      }],
      choices: [input.choice],
      now,
    });
    return item;
  }

  async addRecipe(input: {
    date: string;
    mealType: MealType;
    entryId?: string;
    recipeId: string;
    quantity: number;
    quantityUnit: 'portion' | 'g';
    note: string;
    operationId: string;
    choices: ConsumptionChoice[];
  }): Promise<MealItem> {
    const { plan, factor } = await this.prepareRecipe(input.recipeId, input.quantity, input.quantityUnit);
    for (const ingredient of plan.ingredients) {
      const choice = input.choices.find(({ foodId }) => foodId === ingredient.foodId);
      if (!choice) throw new Error(`Falta la decisión de inventario para ${ingredient.foodName}.`);
      validateChoice(ingredient, choice);
    }
    const datasetId = plan.datasetId;
    const recipe = await this.db.recipes.get([datasetId, input.recipeId]);
    if (!recipe) throw new Error('La receta no existe.');
    const recipeItems = await this.db.recipeItems.where('[datasetId+recipeId]').equals([datasetId, recipe.id]).toArray();
    const totals = sumNutrition(recipeItems.map(({ calculated }) => calculated));
    const now = new Date().toISOString();
    const entry = await this.makeEntry(datasetId, input.date, input.mealType, input.entryId, input.operationId, now);
    const snapshot: NutritionSnapshot = {
      name: recipe.name,
      energyKcal: totals.energyKcal,
      proteinG: totals.proteinG,
      carbohydratesG: totals.carbohydratesG,
      fatG: totals.fatG,
      baseUnit: 'g',
      sourceUpdatedAt: recipe.updatedAt,
    };
    const item: MealItem = {
      datasetId,
      id: `meal-item-${input.operationId}`,
      mealEntryId: entry.id,
      sourceType: 'recipe',
      sourceId: recipe.id,
      quantity: input.quantity,
      quantityUnit: input.quantityUnit,
      baseAmount: input.quantityUnit === 'g' ? input.quantity : factor * 100,
      nutritionSnapshot: snapshot,
      calculated: {
        energyKcal: totals.energyKcal * factor,
        proteinG: totals.proteinG * factor,
        carbohydratesG: totals.carbohydratesG * factor,
        fatG: totals.fatG === null ? null : totals.fatG * factor,
      },
      note: input.note.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await this.commitConsumption({
      datasetId,
      operationId: input.operationId,
      entry,
      isNewEntry: !input.entryId,
      item,
      plans: plan.ingredients,
      choices: input.choices,
      now,
    });
    return item;
  }

  async prepareItemUpdate(itemId: string, nextBaseAmount: number): Promise<ItemUpdatePlan> {
    if (!Number.isFinite(nextBaseAmount) || nextBaseAmount <= 0) throw new Error('La cantidad debe ser mayor que cero.');
    const datasetId = await this.activeDatasetId();
    const item = await this.db.mealItems.get([datasetId, itemId]);
    if (!item) throw new Error('El elemento no existe.');
    const entry = await this.db.mealEntries.get([datasetId, item.mealEntryId]);
    if (!entry || entry.state !== 'consumed') throw new Error('Solo se ajusta inventario en comidas consumidas.');
    const decisions = (await this.db.inventoryConsumptionDecisions
      .where('[datasetId+diaryItemId]').equals([datasetId, itemId]).toArray())
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const latest = new Map<string, InventoryConsumptionDecision>();
    for (const decision of decisions) latest.set(decision.foodId, decision);
    const movements = await this.db.inventoryMovements
      .where('[datasetId+sourceRef]').equals([datasetId, itemId]).toArray();
    const deductedByFood = new Map<string, number>();
    for (const movement of movements) {
      deductedByFood.set(movement.foodId, (deductedByFood.get(movement.foodId) ?? 0) - movement.deltaMilliBase);
    }
    const ingredients = [];
    for (const decision of latest.values()) {
      const currentRequested = decision.resultingRequestedMilliBase ?? decision.requestedMilliBase;
      const targetRequested = Math.round(currentRequested * nextBaseAmount / item.baseAmount);
      const inventory = await this.db.inventoryItems.where('[datasetId+foodId]').equals([datasetId, decision.foodId]).first();
      const food = await this.db.foods.get([datasetId, decision.foodId]);
      if (!food) throw new Error('Un alimento relacionado ya no existe.');
      ingredients.push({
        foodId: food.id,
        foodName: food.name,
        canonicalUnit: food.baseUnit,
        requestedMilliBase: Math.max(0, targetRequested - currentRequested),
        availableMilliBase: inventory?.balanceMilliBase ?? 0,
        revision: inventory?.revision ?? 0,
        currentRequestedMilliBase: currentRequested,
        currentDeductedMilliBase: Math.max(0, deductedByFood.get(food.id) ?? 0),
        targetRequestedMilliBase: targetRequested,
        requestedDeltaMilliBase: targetRequested - currentRequested,
      });
    }
    return {
      datasetId,
      itemId,
      itemUpdatedAt: item.updatedAt,
      sourceEntryId: entry.id,
      sourceEntryUpdatedAt: entry.updatedAt,
      ingredients,
    };
  }

  async updateConsumedItem(input: {
    plan: ItemUpdatePlan;
    quantity: number;
    baseAmount: number;
    note: string;
    mealType: MealType;
    operationId: string;
    choices: ConsumptionChoice[];
  }): Promise<void> {
    if (!input.operationId) throw new Error('Falta el identificador estable de la operación.');
    for (const ingredient of input.plan.ingredients.filter(({ requestedDeltaMilliBase }) => requestedDeltaMilliBase > 0)) {
      const choice = input.choices.find(({ foodId }) => foodId === ingredient.foodId);
      if (!choice) throw new Error(`Falta la decisión para ${ingredient.foodName}.`);
      validateChoice(ingredient, choice);
    }
    const now = new Date().toISOString();
    await trackWrite(() => this.db.transaction('rw', [
      this.db.metadata, this.db.mealEntries, this.db.mealItems,
      this.db.inventoryItems, this.db.inventoryMovements,
      this.db.inventoryConsumptionDecisions, this.db.shoppingLists,
      this.db.shoppingListItems,
    ], async () => {
      await this.assertActive(input.plan.datasetId);
      if (await this.db.inventoryConsumptionDecisions.where('[datasetId+operationId]').equals([input.plan.datasetId, input.operationId]).count()) return;
      const item = await this.db.mealItems.get([input.plan.datasetId, input.plan.itemId]);
      const entry = await this.db.mealEntries.get([input.plan.datasetId, input.plan.sourceEntryId]);
      if (!item || !entry || item.updatedAt !== input.plan.itemUpdatedAt || entry.updatedAt !== input.plan.sourceEntryUpdatedAt) {
        throw new Error('El consumo cambió; vuelve a revisar la edición.');
      }
      for (const ingredient of input.plan.ingredients) {
        const current = await this.db.inventoryItems.where('[datasetId+foodId]').equals([input.plan.datasetId, ingredient.foodId]).first();
        if ((current?.revision ?? 0) !== ingredient.revision || (current?.balanceMilliBase ?? 0) !== ingredient.availableMilliBase) {
          throw new Error(`El inventario de ${ingredient.foodName} cambió; revisa de nuevo.`);
        }
      }
      let targetEntryId = entry.id;
      if (input.mealType !== entry.mealType) {
        const target = await this.db.mealEntries.where('[datasetId+date]').equals([input.plan.datasetId, entry.date])
          .filter((candidate) => candidate.mealType === input.mealType && candidate.state === 'consumed').first();
        if (target) targetEntryId = target.id;
        else {
          targetEntryId = createId('meal');
          await this.db.mealEntries.add({ ...entry, id: targetEntryId, mealType: input.mealType, label: mealLabel(input.mealType), occurredAt: now, createdAt: now, updatedAt: now });
        }
      }
      for (const ingredient of input.plan.ingredients) {
        const choice = input.choices.find(({ foodId }) => foodId === ingredient.foodId);
        let deductedDelta = 0;
        if (ingredient.requestedDeltaMilliBase < 0) {
          const requestedReduction = -ingredient.requestedDeltaMilliBase;
          deductedDelta = -Math.min(
            ingredient.currentDeductedMilliBase,
            Math.round(ingredient.currentDeductedMilliBase * requestedReduction / ingredient.currentRequestedMilliBase),
          );
        } else if (ingredient.requestedDeltaMilliBase > 0 && choice) {
          deductedDelta = choice.decision === 'no-inventory-deduction' ? 0
            : choice.decision === 'available-only'
              ? Math.min(ingredient.availableMilliBase, ingredient.requestedDeltaMilliBase)
              : ingredient.requestedDeltaMilliBase;
        }
        let movementId: string | undefined;
        if (deductedDelta !== 0) {
          const movement = await this.inventory.writeMovementInTransaction({
            datasetId: input.plan.datasetId,
            foodId: ingredient.foodId,
            canonicalUnit: ingredient.canonicalUnit,
            deltaMilliBase: -deductedDelta,
            kind: deductedDelta > 0 ? 'consumption' : 'reversal',
            operationId: input.operationId,
            idempotencyKey: `${input.operationId}:edit:${item.id}:${ingredient.foodId}`,
            sourceType: 'diary-edit',
            sourceRef: item.id,
            occurredAt: now,
            note: 'Diferencia por edición de consumo',
          });
          movementId = movement.id;
        }
        const resultingDeducted = ingredient.currentDeductedMilliBase + deductedDelta;
        const missing = Math.max(0, ingredient.targetRequestedMilliBase - resultingDeducted);
        const decision: InventoryConsumptionDecision = {
          datasetId: input.plan.datasetId,
          id: createId('inventory-decision'),
          operationId: input.operationId,
          idempotencyKey: `${input.operationId}:decision:${item.id}:${ingredient.foodId}`,
          diaryItemId: item.id,
          foodId: ingredient.foodId,
          requestedMilliBase: Math.abs(ingredient.requestedDeltaMilliBase),
          deductedMilliBase: Math.abs(deductedDelta),
          missingMilliBase: missing,
          canonicalUnit: ingredient.canonicalUnit,
          decision: choice?.decision ?? 'full',
          movementId,
          inventoryDifference: missing > 0,
          action: 'edit',
          requestedDeltaMilliBase: ingredient.requestedDeltaMilliBase,
          deductedDeltaMilliBase: deductedDelta,
          resultingRequestedMilliBase: ingredient.targetRequestedMilliBase,
          resultingDeductedMilliBase: resultingDeducted,
          createdAt: now,
        };
        await this.db.inventoryConsumptionDecisions.add(decision);
        if (choice?.addToShopping) await this.addShoppingInTransaction(input.plan.datasetId, ingredient, input.operationId, now);
      }
      await this.db.mealItems.update([input.plan.datasetId, item.id], {
        mealEntryId: targetEntryId,
        quantity: input.quantity,
        baseAmount: input.baseAmount,
        note: input.note.trim(),
        calculated: calculateFromSnapshot(item.nutritionSnapshot, input.baseAmount),
        updatedAt: now,
      });
      await this.db.mealEntries.update([input.plan.datasetId, targetEntryId], { updatedAt: now });
      if (targetEntryId !== entry.id && await this.db.mealItems.where('[datasetId+mealEntryId]').equals([input.plan.datasetId, entry.id]).count() === 0) {
        await this.db.mealEntries.delete([input.plan.datasetId, entry.id]);
      }
    }));
  }

  async deleteConsumedItem(itemId: string, operationId: string): Promise<void> {
    const datasetId = await this.activeDatasetId();
    await this.reverseItems(datasetId, [itemId], operationId, 'delete');
  }

  async returnMealToPlanned(entryId: string, operationId: string): Promise<void> {
    const datasetId = await this.activeDatasetId();
    const entry = await this.db.mealEntries.get([datasetId, entryId]);
    if (!entry || entry.state !== 'consumed') throw new Error('La comida consumida no existe.');
    const items = await this.db.mealItems.where('[datasetId+mealEntryId]').equals([datasetId, entryId]).toArray();
    await this.reverseItems(datasetId, items.map(({ id }) => id), operationId, 'planned', entryId);
  }

  async preparePlannedMeal(entryId: string): Promise<PlannedMealConsumptionPlan> {
    const datasetId = await this.activeDatasetId();
    const entry = await this.db.mealEntries.get([datasetId, entryId]);
    if (!entry || entry.state !== 'planned') throw new Error('La comida planificada no existe.');
    const items = await this.db.mealItems.where('[datasetId+mealEntryId]').equals([datasetId, entryId]).toArray();
    const itemIngredients: PlannedMealConsumptionPlan['itemIngredients'] = [];
    const aggregate = new Map<string, { foodId: string; foodName: string; canonicalUnit: 'g' | 'ml'; requestedMilliBase: number; availableMilliBase: number; revision: number }>();
    for (const item of items) {
      const prepared = item.sourceType === 'food'
        ? await this.prepareFood(item.sourceId, item.baseAmount)
        : (await this.prepareRecipe(item.sourceId, item.quantity, item.quantityUnit as 'portion' | 'g')).plan;
      itemIngredients.push({
        itemId: item.id,
        ingredients: prepared.ingredients.map(({ foodId, requestedMilliBase, canonicalUnit }) => ({ foodId, requestedMilliBase, canonicalUnit })),
      });
      for (const ingredient of prepared.ingredients) {
        const current = aggregate.get(ingredient.foodId);
        aggregate.set(ingredient.foodId, current
          ? { ...current, requestedMilliBase: current.requestedMilliBase + ingredient.requestedMilliBase }
          : { ...ingredient });
      }
    }
    return { datasetId, entryId, entryUpdatedAt: entry.updatedAt, ingredients: [...aggregate.values()], itemIngredients };
  }

  async consumePlannedMeal(plan: PlannedMealConsumptionPlan, choices: ConsumptionChoice[], operationId: string): Promise<void> {
    for (const ingredient of plan.ingredients) {
      const choice = choices.find(({ foodId }) => foodId === ingredient.foodId);
      if (!choice) throw new Error(`Falta la decisión para ${ingredient.foodName}.`);
      validateChoice(ingredient, choice);
    }
    const now = new Date().toISOString();
    await trackWrite(() => this.db.transaction('rw', [
      this.db.metadata, this.db.mealEntries, this.db.mealItems,
      this.db.inventoryItems, this.db.inventoryMovements,
      this.db.inventoryConsumptionDecisions, this.db.shoppingLists,
      this.db.shoppingListItems,
    ], async () => {
      await this.assertActive(plan.datasetId);
      if (await this.db.inventoryConsumptionDecisions.where('[datasetId+operationId]').equals([plan.datasetId, operationId]).count()) return;
      const entry = await this.db.mealEntries.get([plan.datasetId, plan.entryId]);
      if (!entry || entry.state !== 'planned' || entry.updatedAt !== plan.entryUpdatedAt) throw new Error('La comida planificada cambió; revísala de nuevo.');
      for (const ingredient of plan.ingredients) {
        const current = await this.db.inventoryItems.where('[datasetId+foodId]').equals([plan.datasetId, ingredient.foodId]).first();
        if ((current?.revision ?? 0) !== ingredient.revision || (current?.balanceMilliBase ?? 0) !== ingredient.availableMilliBase) throw new Error('El inventario cambió antes de confirmar.');
      }
      const remaining = new Map<string, number>();
      for (const ingredient of plan.ingredients) {
        const choice = choices.find(({ foodId }) => foodId === ingredient.foodId)!;
        remaining.set(ingredient.foodId, choice.decision === 'no-inventory-deduction' ? 0
          : choice.decision === 'available-only' ? Math.min(ingredient.availableMilliBase, ingredient.requestedMilliBase)
            : ingredient.requestedMilliBase);
        if (choice.addToShopping) await this.addShoppingInTransaction(plan.datasetId, ingredient, operationId, now);
      }
      for (const group of plan.itemIngredients) {
        for (const ingredient of group.ingredients) {
          const availableToDeduct = remaining.get(ingredient.foodId) ?? 0;
          const deducted = Math.min(availableToDeduct, ingredient.requestedMilliBase);
          remaining.set(ingredient.foodId, availableToDeduct - deducted);
          let movementId: string | undefined;
          if (deducted > 0) {
            const movement = await this.inventory.writeMovementInTransaction({
              datasetId: plan.datasetId,
              foodId: ingredient.foodId,
              canonicalUnit: ingredient.canonicalUnit,
              deltaMilliBase: -deducted,
              kind: 'consumption',
              operationId,
              idempotencyKey: `${operationId}:reconsume:${group.itemId}:${ingredient.foodId}`,
              sourceType: 'planned-meal',
              sourceRef: group.itemId,
              occurredAt: now,
              note: 'Consumo de comida planificada',
            });
            movementId = movement.id;
          }
          const missing = ingredient.requestedMilliBase - deducted;
          await this.db.inventoryConsumptionDecisions.add({
            datasetId: plan.datasetId,
            id: createId('inventory-decision'),
            operationId,
            idempotencyKey: `${operationId}:decision:${group.itemId}:${ingredient.foodId}`,
            diaryItemId: group.itemId,
            foodId: ingredient.foodId,
            requestedMilliBase: ingredient.requestedMilliBase,
            deductedMilliBase: deducted,
            missingMilliBase: missing,
            canonicalUnit: ingredient.canonicalUnit,
            decision: choices.find(({ foodId }) => foodId === ingredient.foodId)!.decision,
            movementId,
            inventoryDifference: missing > 0,
            action: 'reconsume',
            requestedDeltaMilliBase: ingredient.requestedMilliBase,
            deductedDeltaMilliBase: deducted,
            resultingRequestedMilliBase: ingredient.requestedMilliBase,
            resultingDeductedMilliBase: deducted,
            createdAt: now,
          });
        }
      }
      await this.db.mealEntries.update([plan.datasetId, plan.entryId], { state: 'consumed', occurredAt: now, updatedAt: now });
    }));
  }

  private async reverseItems(datasetId: string, itemIds: string[], operationId: string, action: 'delete' | 'planned', entryId?: string) {
    const now = new Date().toISOString();
    await trackWrite(() => this.db.transaction('rw', [
      this.db.metadata, this.db.mealEntries, this.db.mealItems,
      this.db.inventoryItems, this.db.inventoryMovements,
      this.db.inventoryConsumptionDecisions,
    ], async () => {
      await this.assertActive(datasetId);
      if (await this.db.inventoryConsumptionDecisions.where('[datasetId+operationId]').equals([datasetId, operationId]).count()) return;
      for (const itemId of itemIds) {
        const movements = await this.db.inventoryMovements.where('[datasetId+sourceRef]').equals([datasetId, itemId]).toArray();
        const net = new Map<string, { amount: number; unit: 'g' | 'ml' }>();
        for (const movement of movements) {
          const current = net.get(movement.foodId) ?? { amount: 0, unit: movement.canonicalUnit };
          current.amount -= movement.deltaMilliBase;
          net.set(movement.foodId, current);
        }
        for (const [foodId, value] of net) {
          if (value.amount <= 0) continue;
          const movement = await this.inventory.writeMovementInTransaction({
            datasetId, foodId, canonicalUnit: value.unit,
            deltaMilliBase: value.amount, kind: 'reversal',
            operationId, idempotencyKey: `${operationId}:reverse:${itemId}:${foodId}`,
            sourceType: action === 'delete' ? 'diary-delete' : 'diary-planned',
            sourceRef: itemId, occurredAt: now, note: 'Reversión de consumo',
          });
          await this.db.inventoryConsumptionDecisions.add({
            datasetId, id: createId('inventory-decision'), operationId,
            idempotencyKey: `${operationId}:decision:${itemId}:${foodId}`,
            diaryItemId: itemId, foodId, requestedMilliBase: 0,
            deductedMilliBase: value.amount, missingMilliBase: 0,
            canonicalUnit: value.unit, decision: 'full', movementId: movement.id,
            inventoryDifference: false, action: 'reverse',
            requestedDeltaMilliBase: 0, deductedDeltaMilliBase: -value.amount,
            resultingRequestedMilliBase: 0, resultingDeductedMilliBase: 0,
            createdAt: now,
          });
        }
      }
      if (action === 'planned' && entryId) {
        await this.db.mealEntries.update([datasetId, entryId], { state: 'planned', occurredAt: undefined, updatedAt: now });
      } else {
        const item = itemIds[0] ? await this.db.mealItems.get([datasetId, itemIds[0]]) : undefined;
        if (item) {
          await this.db.mealItems.delete([datasetId, item.id]);
          if (await this.db.mealItems.where('[datasetId+mealEntryId]').equals([datasetId, item.mealEntryId]).count() === 0) {
            await this.db.mealEntries.delete([datasetId, item.mealEntryId]);
          }
        }
      }
    }));
  }

  private async prepareIngredients(values: Array<{ foodId: string; amountBase: number }>): Promise<ConsumptionPlan> {
    const datasetId = await this.activeDatasetId();
    const ingredients: ConsumptionIngredientPlan[] = [];
    const totals = new Map<string, number>();
    for (const value of values) totals.set(value.foodId, (totals.get(value.foodId) ?? 0) + value.amountBase);
    for (const [foodId, amountBase] of totals) {
      const [food, item] = await Promise.all([
        this.db.foods.get([datasetId, foodId]),
        this.db.inventoryItems.where('[datasetId+foodId]').equals([datasetId, foodId]).first(),
      ]);
      if (!food || food.archived) throw new Error('Uno de los alimentos no está disponible.');
      ingredients.push({
        foodId: food.id,
        foodName: food.name,
        canonicalUnit: food.baseUnit,
        requestedMilliBase: toMilliBase(amountBase),
        availableMilliBase: item?.balanceMilliBase ?? 0,
        revision: item?.revision ?? 0,
      });
    }
    return { datasetId, ingredients };
  }

  private async commitConsumption(input: {
    datasetId: string;
    operationId: string;
    entry: MealEntry;
    isNewEntry: boolean;
    item: MealItem;
    plans: ConsumptionIngredientPlan[];
    choices: ConsumptionChoice[];
    now: string;
  }) {
    if (!input.operationId) throw new Error('Falta el identificador estable de la operación.');
    await trackWrite(() => this.db.transaction(
      'rw',
      [
        this.db.metadata,
        this.db.mealEntries,
        this.db.mealItems,
        this.db.foods,
        this.db.inventoryItems,
        this.db.inventoryMovements,
        this.db.inventoryConsumptionDecisions,
        this.db.shoppingLists,
        this.db.shoppingListItems,
      ],
      async () => {
        await this.assertActive(input.datasetId);
        const existingDecisions = await this.db.inventoryConsumptionDecisions
          .where('[datasetId+operationId]')
          .equals([input.datasetId, input.operationId])
          .toArray();
        if (existingDecisions.length) {
          if (existingDecisions.length !== input.plans.length) throw new Error('La operación idempotente está incompleta.');
          if (!await this.db.mealItems.get([input.datasetId, input.item.id])) {
            throw new Error('La operación idempotente no conserva su elemento del diario.');
          }
          return;
        }
        for (const plan of input.plans) {
          const current = await this.db.inventoryItems.where('[datasetId+foodId]').equals([input.datasetId, plan.foodId]).first();
          if ((current?.revision ?? 0) !== plan.revision || (current?.balanceMilliBase ?? 0) !== plan.availableMilliBase) {
            throw new Error(`El inventario de ${plan.foodName} cambió; revisa de nuevo antes de confirmar.`);
          }
        }
        if (input.isNewEntry) await this.db.mealEntries.add(input.entry);
        else await this.db.mealEntries.update([input.datasetId, input.entry.id], { updatedAt: input.now });
        await this.db.mealItems.add(input.item);

        for (const plan of input.plans) {
          const choice = input.choices.find(({ foodId }) => foodId === plan.foodId)!;
          const deducted = choice.decision === 'no-inventory-deduction'
            ? 0
            : choice.decision === 'available-only'
              ? Math.min(plan.availableMilliBase, plan.requestedMilliBase)
              : plan.requestedMilliBase;
          let movementId: string | undefined;
          if (deducted > 0) {
            const movement = await this.inventory.writeMovementInTransaction({
              datasetId: input.datasetId,
              foodId: plan.foodId,
              kind: 'consumption',
              deltaMilliBase: -deducted,
              canonicalUnit: plan.canonicalUnit,
              operationId: input.operationId,
              idempotencyKey: `${input.operationId}:consume:${input.item.id}:${plan.foodId}`,
              sourceType: input.item.sourceType,
              sourceRef: input.item.id,
              inputQuantity: plan.equivalence?.inputQuantity,
              inputUnit: plan.equivalence?.inputUnit,
              equivalence: plan.equivalence,
              occurredAt: input.now,
              note: `Consumo: ${plan.foodName}`,
            });
            movementId = movement.id;
          }
          const missing = Math.max(0, plan.requestedMilliBase - deducted);
          let shoppingListItemId: string | undefined;
          if (choice.addToShopping) {
            shoppingListItemId = await this.addShoppingInTransaction(input.datasetId, plan, input.operationId, input.now);
          }
          const decision: InventoryConsumptionDecision = {
            datasetId: input.datasetId,
            id: createId('inventory-decision'),
            operationId: input.operationId,
            idempotencyKey: `${input.operationId}:decision:${input.item.id}:${plan.foodId}`,
            diaryItemId: input.item.id,
            foodId: plan.foodId,
            requestedMilliBase: plan.requestedMilliBase,
            deductedMilliBase: deducted,
            missingMilliBase: missing,
            canonicalUnit: plan.canonicalUnit,
            decision: choice.decision,
            movementId,
            shoppingListItemId,
            inventoryDifference: missing > 0,
            equivalence: plan.equivalence,
            action: 'consume',
            requestedDeltaMilliBase: plan.requestedMilliBase,
            deductedDeltaMilliBase: deducted,
            resultingRequestedMilliBase: plan.requestedMilliBase,
            resultingDeductedMilliBase: deducted,
            createdAt: input.now,
          };
          await this.db.inventoryConsumptionDecisions.add(decision);
        }
      },
    ));
  }

  private async addShoppingInTransaction(datasetId: string, plan: ConsumptionIngredientPlan, operationId: string, now: string): Promise<string> {
    let list = (await this.db.shoppingLists.where('[datasetId+status]').equals([datasetId, 'active']).toArray())[0];
    if (!list) {
      list = { datasetId, id: createId('shopping-list'), status: 'active', createdAt: now, updatedAt: now } satisfies ShoppingList;
      await this.db.shoppingLists.add(list);
    }
    const existing = (await this.db.shoppingListItems.where('[datasetId+shoppingListId]').equals([datasetId, list.id]).toArray())
      .find((item) => item.foodId === plan.foodId && item.status === 'pending');
    if (existing) {
      await this.db.shoppingListItems.update([datasetId, existing.id], {
        quantity: existing.quantity + 1,
        canonicalAmountMilliBase: (existing.canonicalAmountMilliBase ?? 0) + plan.requestedMilliBase,
        updatedAt: now,
      });
      return existing.id;
    }
    const item: ShoppingListItem = {
      datasetId,
      id: createId('shopping-item'),
      shoppingListId: list.id,
      foodId: plan.foodId,
      text: plan.foodName,
      quantity: 1,
      unit: plan.canonicalUnit,
      canonicalAmountMilliBase: plan.requestedMilliBase,
      canonicalUnit: plan.canonicalUnit,
      note: '',
      status: 'pending',
      source: plan.availableMilliBase === plan.requestedMilliBase ? 'depletion' : 'shortage',
      sourceOperationId: operationId,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.shoppingListItems.add(item);
    return item.id;
  }

  private async makeEntry(datasetId: string, date: string, mealType: MealType, entryId: string | undefined, operationId: string, now: string): Promise<MealEntry> {
    if (entryId) {
      const entry = await this.db.mealEntries.get([datasetId, entryId]);
      if (!entry || entry.date !== date || entry.state !== 'consumed') throw new Error('La comida consumida de destino no es válida.');
      return entry;
    }
    return { datasetId, id: `meal-${operationId}`, date, mealType, label: mealLabel(mealType), state: 'consumed', occurredAt: now, createdAt: now, updatedAt: now };
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

function validateChoice(plan: ConsumptionIngredientPlan, choice: ConsumptionChoice) {
  if (choice.foodId !== plan.foodId) throw new Error('La decisión no corresponde al ingrediente.');
  if (plan.availableMilliBase >= plan.requestedMilliBase && choice.decision !== 'full') {
    throw new Error('Con inventario suficiente debe descontarse la cantidad completa.');
  }
  if (plan.availableMilliBase < plan.requestedMilliBase && choice.decision === 'full') {
    throw new Error('No se puede crear un saldo negativo.');
  }
}
function mealLabel(type: MealType) { return { breakfast: 'Desayuno', lunch: 'Comida', dinner: 'Cena', snack: 'Tentempié' }[type]; }

export const inventoryConsumptionService = new InventoryConsumptionService();
