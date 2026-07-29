export type FoodBaseUnit = 'g' | 'ml';
export type FoodDataOrigin = 'manual' | 'label-photo';
export type FoodEnergySource = 'declared' | 'calculated';

export interface Food {
  datasetId: string;
  id: string;
  name: string;
  brand: string;
  supermarket: string;
  barcode: string | null;
  baseUnit: FoodBaseUnit;
  energyKcal: number;
  energyKj: number | null;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  energySource: FoodEnergySource;
  dataOrigin: FoodDataOrigin;
  notes: string;
  favorite: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface FoodPortion {
  datasetId: string;
  id: string;
  foodId: string;
  name: string;
  amount: number;
  baseUnit: FoodBaseUnit;
}

export interface FoodPhoto {
  datasetId: string;
  id: string;
  foodId: string;
  blob: Blob;
  thumbnail: Blob;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  size: number;
  checksum: string;
  thumbnailChecksum: string;
  createdAt: string;
}

export type FoodDraft = Omit<Food, 'datasetId' | 'id' | 'barcode' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'archived'>;
export type FoodPhotoDraft = Omit<FoodPhoto, 'datasetId' | 'id' | 'foodId'>;
