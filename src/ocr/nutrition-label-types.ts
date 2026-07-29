export type NutritionBasis = 'per-100-g' | 'per-100-ml' | 'portion' | 'unknown';
export type NutritionFieldKey = 'energyKj' | 'energyKcal' | 'fatG' | 'carbohydratesG' | 'proteinG';
export type DetectionStatus = 'detected' | 'uncertain' | 'corrected' | 'missing' | 'conflict';

export interface NutritionColumn {
  id: string;
  label: string;
  basis: NutritionBasis;
  portionAmount: number | null;
  portionUnit: 'g' | 'ml' | null;
}

export interface DetectedNutritionValue {
  key: NutritionFieldKey;
  label: string;
  value: number | null;
  unit: 'kJ' | 'kcal' | 'g';
  columnId: string;
  columnLabel: string;
  raw: string;
  confidence: number;
  status: DetectionStatus;
  warnings: string[];
}

export interface NutritionLabelResult {
  columns: NutritionColumn[];
  values: DetectedNutritionValue[];
  recognizedText: string;
  confidence: number;
  warnings: string[];
}

export interface OcrProgress {
  status: string;
  progress: number | null;
}
