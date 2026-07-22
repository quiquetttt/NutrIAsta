import type { FoodBaseUnit } from '@/mvp/food-types';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealState = 'consumed' | 'planned';
export type QuantityUnit = 'g' | 'ml' | 'unit' | 'portion';
export interface NutritionSnapshot { name: string; energyKcal: number; proteinG: number; carbohydratesG: number; fatG: number; baseUnit: FoodBaseUnit; sourceUpdatedAt: string; }
export interface TargetSnapshot { targetPeriodId: string | null; caloriesKcal: number; proteinG: number; carbohydratesG: number; fatG: number; waterMl: number | null; }
export interface DiaryDay { datasetId: string; date: string; targetSnapshot: TargetSnapshot; createdAt: string; updatedAt: string; }
export interface MealEntry { datasetId: string; id: string; date: string; mealType: MealType; label: string; state: MealState; createdAt: string; updatedAt: string; }
export interface MealItem { datasetId: string; id: string; mealEntryId: string; sourceType: 'food' | 'recipe'; sourceId: string; quantity: number; quantityUnit: QuantityUnit; baseAmount: number; nutritionSnapshot: NutritionSnapshot; calculated: NutritionTotals; note: string; createdAt: string; updatedAt: string; }
export interface NutritionTotals { energyKcal: number; proteinG: number; carbohydratesG: number; fatG: number; }
export interface WaterEntry { datasetId: string; id: string; date: string; amountMl: number; createdAt: string; updatedAt: string; }
export interface TrainingDayFlag { datasetId: string; date: string; trained: boolean; trainingType: string; note: string; updatedAt: string; }
export interface DiaryView { day: DiaryDay; meals: Array<MealEntry & { items: MealItem[]; totals: NutritionTotals }>; water: WaterEntry[]; training: TrainingDayFlag | null; totals: NutritionTotals; plannedTotals: NutritionTotals; }
