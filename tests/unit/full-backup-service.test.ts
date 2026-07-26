import { afterEach, describe, expect, it } from 'vitest';
import { decodeFullBackup, FullBackupService } from '@/backup/full-backup-service.web';
import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { MainDatasetRepository } from '@/storage/main-dataset-repository.web';
import { sha256Blob } from '@/utils/crypto';

let database: NutrIAstaMainDatabase | null = null;
afterEach(async () => { if (database) { database.close(); await database.delete(); database = null; } });

async function fixture() {
  database = new NutrIAstaMainDatabase(`full-backup-${crypto.randomUUID()}`); await database.open();
  const now = '2026-07-22T12:00:00.000Z'; const datasetId = 'dataset-original';
  await database.metadata.bulkPut([{ key: 'activeSource', value: 'main' }, { key: 'activeMainDatasetId', value: datasetId }]);
  await database.datasets.add({ id: datasetId, state: 'active', source: 'legacy-copy', createdAt: now, updatedAt: now, recordCount: 1, photoCount: 1, payloadBytes: 10, sourceFingerprint: 'origen', contentFingerprint: 'origen', sourceDatasetId: 'legacy' });
  await database.legacyViabilityRecords.add({ datasetId, id: 'registro-prueba-001', text: 'Texto ficticio completo', createdAt: now, updatedAt: now });
  const blob = new Blob(['jpeg-ficticio'], { type: 'image/jpeg' }); const thumbnail = new Blob(['miniatura'], { type: 'image/jpeg' });
  await database.legacyViabilityPhotos.add({ datasetId, id: 'foto-prueba-001', blob, thumbnail, mimeType: 'image/jpeg', width: 100, height: 80, size: blob.size, checksum: await sha256Blob(blob), thumbnailChecksum: await sha256Blob(thumbnail), createdAt: now });
  await database.profiles.add({ datasetId, id: 'profile', alias: 'Perfil ficticio', age: 22, formulaSex: 'male', heightCm: 175, weightKg: 70, gymDaysPerWeek: 4, usualStepsPerDay: 8000, otherSportsPerWeek: 0, otherSportsDescription: '', pal: 1.6, waterQuickAmountsMl: [250, 500], privacyConsentAt: now, createdAt: now, updatedAt: now });
  await database.nutritionTargetPeriods.add({ datasetId, id: 'objetivo-ficticio', effectiveFrom: '2026-07-01', caloriesKcal: 2200, proteinG: 120, carbohydratesG: 260, fatG: 70, waterMl: 2000, createdAt: now });
  await database.foods.add({ datasetId, id: 'alimento-ficticio', name: 'Alimento ficticio', brand: 'Marca ficticia', supermarket: 'Tienda ficticia', barcode: '8412345678905', baseUnit: 'g', energyKcal: 100, energyKj: 418, proteinG: 10, carbohydratesG: 8, fatG: 3, energySource: 'declared', dataOrigin: 'manual', notes: '', favorite: true, archived: false, createdAt: now, updatedAt: now, lastUsedAt: now });
  await database.foodPortions.add({ datasetId, id: 'porcion-ficticia', foodId: 'alimento-ficticio', name: 'Bol ficticio', amount: 75, baseUnit: 'g' });
  const foodBlob = new Blob(['foto-alimento-ficticia'], { type: 'image/jpeg' }); const foodThumbnail = new Blob(['miniatura-alimento'], { type: 'image/jpeg' });
  await database.foodPhotos.add({ datasetId, id: 'foto-alimento-ficticia', foodId: 'alimento-ficticio', blob: foodBlob, thumbnail: foodThumbnail, mimeType: 'image/jpeg', width: 200, height: 120, size: foodBlob.size, checksum: await sha256Blob(foodBlob), thumbnailChecksum: await sha256Blob(foodThumbnail), createdAt: now });
  const snapshot = { name: 'Alimento ficticio', energyKcal: 100, proteinG: 10, carbohydratesG: 8, fatG: 3, baseUnit: 'g' as const, sourceUpdatedAt: now };
  const calculated = { energyKcal: 75, proteinG: 7.5, carbohydratesG: 6, fatG: 2.25 };
  await database.diaryDays.add({ datasetId, date: '2026-07-22', targetSnapshot: { targetPeriodId: 'objetivo-ficticio', caloriesKcal: 2200, proteinG: 120, carbohydratesG: 260, fatG: 70, waterMl: 2000 }, createdAt: now, updatedAt: now });
  await database.mealEntries.add({ datasetId, id: 'comida-ficticia', date: '2026-07-22', mealType: 'breakfast', label: 'Desayuno', state: 'consumed', occurredAt: now, createdAt: now, updatedAt: now });
  await database.mealItems.add({ datasetId, id: 'elemento-ficticio', mealEntryId: 'comida-ficticia', sourceType: 'food', sourceId: 'alimento-ficticio', quantity: 1, quantityUnit: 'portion', baseAmount: 75, portionId: 'porcion-ficticia', nutritionSnapshot: snapshot, calculated, note: 'Nota ficticia', createdAt: now, updatedAt: now });
  await database.waterEntries.add({ datasetId, id: 'agua-ficticia', date: '2026-07-22', amountMl: 250, createdAt: now, updatedAt: now });
  await database.trainingDayFlags.add({ datasetId, date: '2026-07-22', trained: true, trainingType: 'Fuerza ficticia', note: 'Nota ficticia', updatedAt: now });
  await database.recipes.add({ datasetId, id: 'receta-ficticia', name: 'Receta ficticia', servings: 2, finalWeightG: 300, favorite: true, archived: false, createdAt: now, updatedAt: now });
  await database.recipeItems.add({ datasetId, id: 'ingrediente-ficticio', recipeId: 'receta-ficticia', foodId: 'alimento-ficticio', amountBase: 75, foodSnapshot: snapshot, calculated });
  const repository = new MainDatasetRepository(database);
  return { datasetId, service: new FullBackupService(database, repository, async () => ({ usage: 1_000, quota: 500_000_000 })) };
}

describe('backup completo y restauración temporal', () => {
  it('cifra, verifica, activa, revierte, reactiva y confirma sin borrar el anterior', async () => {
    const { datasetId, service } = await fixture(); const exported = await service.create('clave-ficticia-segura');
    const file = new File([exported.blob], exported.filename, { type: exported.blob.type });
    const decoded = await decodeFullBackup(file, 'clave-ficticia-segura');
    for (const count of Object.values(decoded.manifest.entityCounts)) expect(count).toBe(1);
    const prepared = await service.prepare(file, 'clave-ficticia-segura');
    expect((await service.status()).prepared?.candidateDatasetId).toBe(prepared.candidateDatasetId);
    expect((await database!.metadata.get('activeMainDatasetId'))?.value).toBe(datasetId);
    const session = await service.activate(prepared); expect((await database!.metadata.get('activeMainDatasetId'))?.value).toBe(prepared.candidateDatasetId);
    const rolledBack = await service.rollback(session); expect((await database!.metadata.get('activeMainDatasetId'))?.value).toBe(datasetId);
    const reactivated = await service.reactivate(rolledBack); expect((await database!.metadata.get('activeMainDatasetId'))?.value).toBe(prepared.candidateDatasetId);
    await service.confirm(reactivated);
    expect(await database!.datasets.get(datasetId)).toBeTruthy();
    expect((await database!.profiles.where('datasetId').equals(prepared.candidateDatasetId).first())?.alias).toBe('Perfil ficticio');
    expect((await database!.foodPortions.where('datasetId').equals(prepared.candidateDatasetId).first())?.name).toBe('Bol ficticio');
    const restoredPhoto = await database!.foodPhotos.where('datasetId').equals(prepared.candidateDatasetId).first();
    expect(restoredPhoto?.checksum).toBe(await sha256Blob(restoredPhoto!.blob));
  });
  it('una contraseña incorrecta y una cancelación no cambian el dataset activo', async () => {
    const { datasetId, service } = await fixture(); const exported = await service.create('clave-ficticia-segura'); const file = new File([exported.blob], exported.filename);
    await expect(service.prepare(file, 'clave-equivocada')).rejects.toThrow();
    expect((await database!.metadata.get('activeMainDatasetId'))?.value).toBe(datasetId);
    const prepared = await service.prepare(file, 'clave-ficticia-segura'); await service.cancel(prepared);
    expect((await database!.metadata.get('activeMainDatasetId'))?.value).toBe(datasetId);
    expect(await database!.profiles.where('datasetId').equals(prepared.candidateDatasetId).count()).toBe(0);
  });
});
