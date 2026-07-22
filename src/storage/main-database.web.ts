import Dexie, { type Table } from 'dexie';

import type {
  MainDatasetMetadata,
  MainLegacyViabilityPhoto,
  MainLegacyViabilityRecord,
  MainMetadataEntry,
  MigrationRun,
} from '@/storage/main-dataset-types';
import {
  MAIN_DATABASE_NAME,
  MAIN_DATABASE_STORES,
  MAIN_DATABASE_VERSION,
} from '@/storage/main-schema';

export class NutrIAstaMainDatabase extends Dexie {
  metadata!: Table<MainMetadataEntry, string>;
  datasets!: Table<MainDatasetMetadata, string>;
  migrationRuns!: Table<MigrationRun, string>;
  legacyViabilityRecords!: Table<MainLegacyViabilityRecord, [string, string]>;
  legacyViabilityPhotos!: Table<MainLegacyViabilityPhoto, [string, string]>;

  constructor(name = MAIN_DATABASE_NAME) {
    super(name);
    this.version(MAIN_DATABASE_VERSION).stores(MAIN_DATABASE_STORES);
  }
}

export const mainDatabase = new NutrIAstaMainDatabase();
