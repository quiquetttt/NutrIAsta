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
  await database.profiles.add({ datasetId, id: 'profile', alias: 'Perfil ficticio', age: 22, formulaSex: 'male', heightCm: 175, weightKg: 70, gymDaysPerWeek: 4, usualStepsPerDay: 8000, otherSportsPerWeek: 0, otherSportsDescription: '', pal: 1.6, privacyConsentAt: now, createdAt: now, updatedAt: now });
  const repository = new MainDatasetRepository(database);
  return { datasetId, service: new FullBackupService(database, repository, async () => ({ usage: 1_000, quota: 500_000_000 })) };
}

describe('backup completo y restauración temporal', () => {
  it('cifra, verifica, activa, revierte, reactiva y confirma sin borrar el anterior', async () => {
    const { datasetId, service } = await fixture(); const exported = await service.create('clave-ficticia-segura');
    const file = new File([exported.blob], exported.filename, { type: exported.blob.type });
    const decoded = await decodeFullBackup(file, 'clave-ficticia-segura');
    expect(decoded.manifest.entityCounts.profiles).toBe(1); expect(decoded.manifest.entityCounts.legacyViabilityPhotos).toBe(1);
    const prepared = await service.prepare(file, 'clave-ficticia-segura');
    expect((await service.status()).prepared?.candidateDatasetId).toBe(prepared.candidateDatasetId);
    expect((await database!.metadata.get('activeMainDatasetId'))?.value).toBe(datasetId);
    const session = await service.activate(prepared); expect((await database!.metadata.get('activeMainDatasetId'))?.value).toBe(prepared.candidateDatasetId);
    const rolledBack = await service.rollback(session); expect((await database!.metadata.get('activeMainDatasetId'))?.value).toBe(datasetId);
    const reactivated = await service.reactivate(rolledBack); expect((await database!.metadata.get('activeMainDatasetId'))?.value).toBe(prepared.candidateDatasetId);
    await service.confirm(reactivated);
    expect(await database!.datasets.get(datasetId)).toBeTruthy();
    expect((await database!.profiles.where('datasetId').equals(prepared.candidateDatasetId).first())?.alias).toBe('Perfil ficticio');
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
