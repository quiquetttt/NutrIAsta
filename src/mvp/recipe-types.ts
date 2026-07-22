import type { NutritionSnapshot, NutritionTotals } from '@/mvp/diary-types';
export interface Recipe { datasetId:string; id:string; name:string; servings:number; finalWeightG:number|null; favorite:boolean; archived:boolean; createdAt:string; updatedAt:string; }
export interface RecipeItem { datasetId:string; id:string; recipeId:string; foodId:string; amountBase:number; foodSnapshot:NutritionSnapshot; calculated:NutritionTotals; }
export interface RecipeWithTotals extends Recipe { items:RecipeItem[]; totals:NutritionTotals; perServing:NutritionTotals; }
