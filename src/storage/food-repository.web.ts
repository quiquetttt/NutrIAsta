import type { Food, FoodDraft, FoodPhotoDraft, FoodPortion } from '@/mvp/food-types';
import { mainDatabase, type NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { MAIN_META_KEYS } from '@/storage/main-schema';
import { trackWrite } from '@/storage/write-tracker';
import { createId } from '@/utils/crypto';
import { macroEnergy } from '@/mvp/nutrition-calculations';

export interface FoodPortionDraft { id?: string; name: string; amount: number; }
export interface FoodSaveOptions { portions?: FoodPortionDraft[]; photo?: FoodPhotoDraft | null; }

export class FoodRepository {
  constructor(private readonly db: NutrIAstaMainDatabase = mainDatabase) {}
  private async datasetId() {
    await this.db.open();
    const source = (await this.db.metadata.get(MAIN_META_KEYS.activeSource))?.value;
    const id = (await this.db.metadata.get(MAIN_META_KEYS.activeMainDatasetId))?.value;
    if (source !== 'main' || typeof id !== 'string') throw new Error('No existe un dataset principal activo.');
    return id;
  }
  async list(options: { search?: string; favorites?: boolean; recent?: boolean; includeArchived?: boolean } = {}) {
    const datasetId = await this.datasetId();
    let foods = await this.db.foods.where('datasetId').equals(datasetId).toArray();
    if (!options.includeArchived) foods = foods.filter((food) => !food.archived);
    if (options.favorites) foods = foods.filter((food) => food.favorite);
    const search = options.search?.trim().toLocaleLowerCase('es-ES');
    if (search) foods = foods.filter((food) => [food.name, food.brand, food.supermarket].some((value) => value.toLocaleLowerCase('es-ES').includes(search)));
    return foods.sort((a, b) => options.recent ? (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') : a.name.localeCompare(b.name, 'es'));
  }
  async get(id: string) { const datasetId = await this.datasetId(); return this.db.foods.get([datasetId, id]); }
  async save(draft: FoodDraft, portions: FoodPortionDraft[], photo?: FoodPhotoDraft, id?: string): Promise<Food>;
  async save(draft: FoodDraft, options: FoodSaveOptions, id?: string): Promise<Food>;
  async save(draft: FoodDraft, portionsOrOptions: FoodPortionDraft[] | FoodSaveOptions, photoOrId?: FoodPhotoDraft | string, legacyId?: string) {
    const legacy = Array.isArray(portionsOrOptions);
    const options: FoodSaveOptions = legacy ? { portions: portionsOrOptions, photo: typeof photoOrId === 'string' ? undefined : photoOrId } : portionsOrOptions;
    const id = legacy ? legacyId : typeof photoOrId === 'string' ? photoOrId : undefined;
    const fatG = draft.fatG;
    if (draft.energySource === 'calculated' && fatG === null) {
      throw new Error('Para calcular las calorías mediante 4/4/9 también debes indicar las grasas.');
    }
    const normalizedDraft = draft.energySource === 'calculated'
      ? { ...draft, energyKcal: macroEnergy(draft.proteinG, draft.carbohydratesG, fatG as number), energyKj: null }
      : draft;
    validateFood(normalizedDraft);
    const datasetId = await this.datasetId();
    const previous = id ? await this.db.foods.get([datasetId, id]) : undefined;
    const now = new Date().toISOString(); const foodId = id ?? createId('food');
    const food: Food = { ...normalizedDraft, barcode: previous?.barcode ?? null, datasetId, id: foodId, archived: previous?.archived ?? false, createdAt: previous?.createdAt ?? now, updatedAt: now, lastUsedAt: previous?.lastUsedAt ?? null };
    await trackWrite(() => this.db.transaction('rw', this.db.foods, this.db.foodPortions, this.db.foodPhotos, async () => {
      await this.db.foods.put(food);
      if (options.portions) {
        validatePortions(options.portions);
        await this.db.foodPortions.where('[datasetId+foodId]').equals([datasetId, foodId]).delete();
        await this.db.foodPortions.bulkAdd(options.portions.map((portion): FoodPortion => ({ datasetId, id: portion.id ?? createId('portion'), foodId, name: portion.name.trim(), amount: portion.amount, baseUnit: food.baseUnit })));
      }
      if (options.photo === null) {
        await this.db.foodPhotos.where('[datasetId+foodId]').equals([datasetId, foodId]).delete();
      } else if (options.photo) {
        await this.db.foodPhotos.where('[datasetId+foodId]').equals([datasetId, foodId]).delete();
        await this.db.foodPhotos.add({ ...options.photo, datasetId, id: createId('food-photo'), foodId });
      }
    }));
    return food;
  }
  async setFavorite(id: string, favorite: boolean) { const datasetId = await this.datasetId(); await trackWrite(() => this.db.foods.update([datasetId, id], { favorite, updatedAt: new Date().toISOString() })); }
  async setArchived(id: string, archived: boolean) { const datasetId = await this.datasetId(); await trackWrite(() => this.db.foods.update([datasetId, id], { archived, updatedAt: new Date().toISOString() })); }
  async markUsed(id: string) { const datasetId = await this.datasetId(); await trackWrite(() => this.db.foods.update([datasetId, id], { lastUsedAt: new Date().toISOString() })); }
  async portions(foodId: string) { const datasetId = await this.datasetId(); return this.db.foodPortions.where('[datasetId+foodId]').equals([datasetId, foodId]).toArray(); }
  async photo(foodId: string) { const datasetId = await this.datasetId(); return this.db.foodPhotos.where('[datasetId+foodId]').equals([datasetId, foodId]).first(); }
}

function validatePortions(portions: FoodPortionDraft[]) {
  if (portions.length > 50) throw new Error('Un alimento no puede tener más de 50 porciones.');
  const names = new Set<string>();
  for (const portion of portions) {
    const name = portion.name.trim().toLocaleLowerCase('es-ES');
    if (!name || portion.name.length > 80 || !Number.isFinite(portion.amount) || portion.amount <= 0 || portion.amount > 100000) throw new Error('Hay una porción personalizada no válida.');
    if (names.has(name)) throw new Error('No puede haber porciones con el mismo nombre.');
    names.add(name);
  }
}

function validateFood(draft: FoodDraft) {
  if (!draft.name.trim() || draft.name.length > 120) throw new Error('Introduce un nombre de alimento válido.');
  for (const [label, value] of Object.entries({ calorías: draft.energyKcal, proteínas: draft.proteinG, 'hidratos de carbono': draft.carbohydratesG })) if (!Number.isFinite(value) || value < 0 || value > 10000) throw new Error(`El valor de ${label} no es válido.`);
  if (draft.fatG !== null && (!Number.isFinite(draft.fatG) || draft.fatG < 0 || draft.fatG > 10000)) throw new Error('El valor de grasas no es válido.');
  if (draft.baseUnit === 'g' && [draft.proteinG, draft.carbohydratesG, draft.fatG].some((value) => value !== null && value > 100)) throw new Error('Los macronutrientes por 100 g no pueden superar 100 g individualmente.');
}
export const foodRepository = new FoodRepository();
