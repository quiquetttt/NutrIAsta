import Dexie, { type Table } from 'dexie';

import { DATABASE_NAME, DATABASE_STORES, DATABASE_VERSION } from '@/storage/schema';
import type {
  DatasetMetadata,
  MetadataEntry,
  PhotoAsset,
  ViabilityRecord,
} from '@/storage/dataset-types';

export class NutrIAstaDatabase extends Dexie {
  metadata!: Table<MetadataEntry, string>;
  datasets!: Table<DatasetMetadata, string>;
  viabilityRecords!: Table<ViabilityRecord, [string, string]>;
  photos!: Table<PhotoAsset, [string, string]>;

  constructor(name = DATABASE_NAME) {
    super(name);
    this.version(DATABASE_VERSION).stores(DATABASE_STORES);
  }
}

export const database = new NutrIAstaDatabase();
