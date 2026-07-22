import { afterEach, describe, expect, it } from 'vitest';
import { DiaryRepository } from '@/storage/diary-repository.web';
import { FoodRepository } from '@/storage/food-repository.web';
import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { ProfileRepository } from '@/storage/profile-repository.web';

let database:NutrIAstaMainDatabase|null=null;
afterEach(async()=>{if(database){database.close();await database.delete();database=null;}});

describe('diario con snapshots',()=>{
 it('conserva alimento y objetivo históricos tras editar sus fuentes',async()=>{
  database=new NutrIAstaMainDatabase(`diary-${crypto.randomUUID()}`);await database.open();await database.metadata.bulkPut([{key:'activeSource',value:'main'},{key:'activeMainDatasetId',value:'dataset-ficticio'}]);
  const profiles=new ProfileRepository(database);const foods=new FoodRepository(database);const diary=new DiaryRepository(database);
  await profiles.addTargetPeriod({effectiveFrom:'2026-07-01',caloriesKcal:2000,proteinG:100,carbohydratesG:250,fatG:60,waterMl:2000});
  const base={name:'Alimento histórico',brand:'',supermarket:'',barcode:null,baseUnit:'g' as const,energyKcal:100,energyKj:null,proteinG:10,carbohydratesG:5,fatG:2,energySource:'declared' as const,dataOrigin:'manual' as const,notes:'',favorite:false};
  const food=await foods.save(base,[]);const item=await diary.addFood('2026-07-15','breakfast',food.id,50,'g',50);
  await foods.save({...base,energyKcal:300,proteinG:30},[],undefined,food.id);await profiles.addTargetPeriod({effectiveFrom:'2026-08-01',caloriesKcal:3000,proteinG:150,carbohydratesG:350,fatG:80,waterMl:null});
  await diary.addWater('2026-07-15',250);await diary.saveTraining('2026-07-15',true,'Fuerza ficticia','Nota ficticia');
  const view=await diary.get('2026-07-15');expect(view.day.targetSnapshot.caloriesKcal).toBe(2000);expect(view.meals[0]?.items[0]?.nutritionSnapshot.energyKcal).toBe(100);expect(view.meals[0]?.items[0]?.calculated.energyKcal).toBe(50);expect(view.water[0]?.amountMl).toBe(250);expect(view.training?.trained).toBe(true);
  await diary.updateItemQuantity(item.id,100,100);expect((await diary.get('2026-07-15')).totals.energyKcal).toBe(100);
 });
});
