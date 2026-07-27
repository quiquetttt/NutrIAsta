import type { FoodBaseUnit } from '@/mvp/food-types';
import type { QuantityUnit } from '@/mvp/diary-types';

export type InventoryMovementKind =
  | 'purchase'
  | 'consumption'
  | 'positive-adjustment'
  | 'negative-adjustment'
  | 'reversal';
export type InventoryConsumptionDecisionKind =
  | 'full'
  | 'available-only'
  | 'no-inventory-deduction';

export interface InventoryEquivalenceSnapshot {
  inputQuantity: number;
  inputUnit: QuantityUnit;
  basePerInputMilliBase: number;
  canonicalUnit: FoodBaseUnit;
}

export interface InventoryItem {
  datasetId: string;
  id: string;
  foodId: string;
  canonicalUnit: FoodBaseUnit;
  balanceMilliBase: number;
  revision: number;
  lastMovementId?: string;
  reconciledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  datasetId: string;
  id: string;
  foodId: string;
  kind: InventoryMovementKind;
  deltaMilliBase: number;
  canonicalUnit: FoodBaseUnit;
  balanceAfterMilliBase: number;
  operationId: string;
  idempotencyKey: string;
  sourceType: string;
  sourceRef: string;
  relatedMovementId?: string;
  inputQuantity?: number;
  inputUnit?: QuantityUnit;
  equivalence?: InventoryEquivalenceSnapshot;
  occurredAt: string;
  createdAt: string;
  note: string;
}

export interface InventoryConsumptionDecision {
  datasetId: string;
  id: string;
  operationId: string;
  idempotencyKey: string;
  diaryItemId: string;
  foodId: string;
  requestedMilliBase: number;
  deductedMilliBase: number;
  missingMilliBase: number;
  canonicalUnit: FoodBaseUnit;
  decision: InventoryConsumptionDecisionKind;
  equivalence?: InventoryEquivalenceSnapshot;
  movementId?: string;
  shoppingListItemId?: string;
  inventoryDifference: boolean;
  action?: 'consume' | 'edit' | 'reverse' | 'reconsume';
  requestedDeltaMilliBase?: number;
  deductedDeltaMilliBase?: number;
  resultingRequestedMilliBase?: number;
  resultingDeductedMilliBase?: number;
  createdAt: string;
}

export interface ShoppingList {
  datasetId: string;
  id: string;
  status: 'active' | 'completed';
  sourceOperationId?: string;
  completedAt?: string;
  reopenedFromListId?: string;
  undoneAt?: string;
  undoOperationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingListItem {
  datasetId: string;
  id: string;
  shoppingListId: string;
  foodId?: string;
  text: string;
  quantity: number;
  unit: QuantityUnit;
  canonicalAmountMilliBase?: number;
  canonicalUnit?: FoodBaseUnit;
  equivalence?: InventoryEquivalenceSnapshot;
  note: string;
  status: 'pending' | 'purchased';
  source: 'manual' | 'depletion' | 'shortage' | 'recipe';
  sourceOperationId?: string;
  createdAt: string;
  updatedAt: string;
}
