import Dexie, { type Table } from 'dexie';

import type {
  MainDatasetMetadata,
  MainLegacyViabilityPhoto,
  MainLegacyViabilityRecord,
  MainMetadataEntry,
  MigrationRun,
} from '@/storage/main-dataset-types';
import type { NutritionTargetPeriod, Profile } from '@/mvp/profile-types';
import type { Food, FoodPhoto, FoodPortion } from '@/mvp/food-types';
import type { DiaryDay, MealEntry, MealItem, TrainingDayFlag, WaterEntry } from '@/mvp/diary-types';
import type { Recipe, RecipeItem } from '@/mvp/recipe-types';
import type {
  ExerciseCatalogItem,
  TrainingSession,
  TrainingSessionExercise,
  TrainingSet,
  TrainingSettings,
  TrainingType,
} from '@/mvp/training-types';
import type { WeightEntry } from '@/mvp/weight-types';
import type {
  InventoryConsumptionDecision,
  InventoryItem,
  InventoryMovement,
  ShoppingList,
  ShoppingListItem,
} from '@/mvp/inventory-types';
import {
  MAIN_DATABASE_NAME,
  MAIN_DATABASE_STORES,
  MAIN_DATABASE_STORES_V1,
  MAIN_DATABASE_STORES_V2,
  MAIN_DATABASE_STORES_V3,
  MAIN_DATABASE_STORES_V4,
  MAIN_DATABASE_STORES_V5,
  MAIN_DATABASE_VERSION,
} from '@/storage/main-schema';

export class NutrIAstaMainDatabase extends Dexie {
  metadata!: Table<MainMetadataEntry, string>;
  datasets!: Table<MainDatasetMetadata, string>;
  migrationRuns!: Table<MigrationRun, string>;
  legacyViabilityRecords!: Table<MainLegacyViabilityRecord, [string, string]>;
  legacyViabilityPhotos!: Table<MainLegacyViabilityPhoto, [string, string]>;
  profiles!: Table<Profile, [string, string]>;
  nutritionTargetPeriods!: Table<NutritionTargetPeriod, [string, string]>;
  foods!: Table<Food, [string, string]>;
  foodPortions!: Table<FoodPortion, [string, string]>;
  foodPhotos!: Table<FoodPhoto, [string, string]>;
  diaryDays!: Table<DiaryDay, [string, string]>;
  mealEntries!: Table<MealEntry, [string, string]>;
  mealItems!: Table<MealItem, [string, string]>;
  waterEntries!: Table<WaterEntry, [string, string]>;
  trainingDayFlags!: Table<TrainingDayFlag, [string, string]>;
  recipes!: Table<Recipe, [string, string]>;
  recipeItems!: Table<RecipeItem, [string, string]>;
  trainingSettings!: Table<TrainingSettings, [string, string]>;
  trainingTypes!: Table<TrainingType, [string, string]>;
  exerciseCatalog!: Table<ExerciseCatalogItem, [string, string]>;
  trainingSessions!: Table<TrainingSession, [string, string]>;
  trainingSessionExercises!: Table<TrainingSessionExercise, [string, string]>;
  trainingSets!: Table<TrainingSet, [string, string]>;
  weightEntries!: Table<WeightEntry, [string, string]>;
  inventoryItems!: Table<InventoryItem, [string, string]>;
  inventoryMovements!: Table<InventoryMovement, [string, string]>;
  inventoryConsumptionDecisions!: Table<InventoryConsumptionDecision, [string, string]>;
  shoppingLists!: Table<ShoppingList, [string, string]>;
  shoppingListItems!: Table<ShoppingListItem, [string, string]>;

  constructor(name = MAIN_DATABASE_NAME) {
    super(name);
    this.version(1).stores(MAIN_DATABASE_STORES_V1);
    this.version(2).stores(MAIN_DATABASE_STORES_V2);
    this.version(3).stores(MAIN_DATABASE_STORES_V3);
    this.version(4).stores(MAIN_DATABASE_STORES_V4);
    this.version(5).stores(MAIN_DATABASE_STORES_V5);
    this.version(MAIN_DATABASE_VERSION).stores(MAIN_DATABASE_STORES);
  }
}

export const mainDatabase = new NutrIAstaMainDatabase();
