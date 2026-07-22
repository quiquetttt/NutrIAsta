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
import {
  MAIN_DATABASE_NAME,
  MAIN_DATABASE_STORES,
  MAIN_DATABASE_STORES_V1,
  MAIN_DATABASE_STORES_V2,
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

  constructor(name = MAIN_DATABASE_NAME) {
    super(name);
    this.version(1).stores(MAIN_DATABASE_STORES_V1);
    this.version(2).stores(MAIN_DATABASE_STORES_V2);
    this.version(MAIN_DATABASE_VERSION).stores(MAIN_DATABASE_STORES);
  }
}

export const mainDatabase = new NutrIAstaMainDatabase();
