import { afterEach, describe, expect, it } from 'vitest';

import { LEGACY_NATIVE_DATABASE_VERSION, LegacySourceReader } from '@/migration/legacy-source-reader.web';
import { MigrationService, assertCandidateSpace } from '@/migration/migration-service.web';
import { NutrIAstaDatabase } from '@/storage/database.web';
import { DatasetRepository } from '@/storage/dataset-repository.web';
import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { MainDatasetRepository } from '@/storage/main-dataset-repository.web';
import { MAIN_DATABASE_STORES, MAIN_DATABASE_VERSION } from '@/storage/main-schema';
import { sha256Blob } from '@/utils/crypto';

const databases: Array<NutrIAstaDatabase | NutrIAstaMainDatabase> = [];

afterEach(async () => {
  for (const database of databases.splice(0)) {
    database.close();
    await database.delete();
  }
});

async function fixture() {
  const suffix = crypto.randomUUID();
  const legacyDatabase = new NutrIAstaDatabase(`legacy-${suffix}`);
  const legacyRepository = new DatasetRepository(legacyDatabase);
  databases.push(legacyDatabase);
  await legacyRepository.initialize();
  await legacyRepository.saveTestRecord('Texto ficticio de migración');
  const blob = new Blob(['fotografía ficticia'], { type: 'image/jpeg' });
  const thumbnail = new Blob(['miniatura ficticia'], { type: 'image/jpeg' });
  await legacyRepository.saveTestPhoto({
    blob,
    thumbnail,
    mimeType: 'image/jpeg',
    width: 640,
    height: 480,
    size: blob.size,
    checksum: await sha256Blob(blob),
    thumbnailChecksum: await sha256Blob(thumbnail),
    createdAt: '2026-07-22T12:00:00.000Z',
  });

  const mainDatabase = new NutrIAstaMainDatabase(`main-${suffix}`);
  const mainRepository = new MainDatasetRepository(mainDatabase);
  databases.push(mainDatabase);
  const reader = new LegacySourceReader(legacyDatabase.name);
  const estimate = async () => ({ usage: 2 * 1024 * 1024, quota: 1024 * 1024 * 1024 });
  const service = new MigrationService(mainRepository, reader, estimate);
  return { legacyDatabase, reader, mainDatabase, mainRepository, service };
}

describe('migración segura a la base paralela', () => {
  it('copia, verifica, activa, revierte y reactiva sin modificar la base de origen', async () => {
    const { legacyDatabase, reader, mainDatabase, service } = await fixture();
    const before = await reader.inspect();
    const sourceVersion = legacyDatabase.verno;
    const sourceStores = legacyDatabase.tables.map(({ name }) => name).sort();

    const prepared = await service.prepareFromLegacy();
    expect((await service.getStatus()).activeSource).toBe('legacy');
    expect(prepared.snapshot.records[0]?.text).toBe('Texto ficticio de migración');
    expect(await reader.inspect()).toMatchObject({ fingerprint: before.fingerprint });

    let session = await service.activate(prepared);
    expect((await service.getStatus()).activeSource).toBe('main');
    session = await service.rollback(session);
    expect((await service.getStatus()).activeSource).toBe('legacy');
    session = await service.reactivate(session);
    expect((await service.getStatus()).activeSource).toBe('main');
    await service.confirm(session);

    const after = await reader.inspect();
    expect(after.fingerprint).toBe(before.fingerprint);
    expect(before.databaseVersion).toBe(1);
    expect((await indexedDB.databases()).find(({ name }) => name === legacyDatabase.name)?.version)
      .toBe(LEGACY_NATIVE_DATABASE_VERSION);
    expect(legacyDatabase.verno).toBe(sourceVersion);
    expect(legacyDatabase.tables.map(({ name }) => name).sort()).toEqual(sourceStores);
    expect(mainDatabase.verno).toBe(MAIN_DATABASE_VERSION);
    expect(mainDatabase.tables.map(({ name }) => name).sort()).toEqual(Object.keys(MAIN_DATABASE_STORES).sort());
  });

  it('cancela el candidato sin cambiar la fuente activa', async () => {
    const { mainRepository, service } = await fixture();
    const prepared = await service.prepareFromLegacy();
    await service.cancel(prepared);
    expect(await mainRepository.getActiveSource()).toBe('legacy');
    expect((await mainRepository.getDatasetSnapshot(prepared.candidateDatasetId)).dataset.state).toBe('abandoned');
  });

  it('reutiliza de forma idempotente un candidato ya verificado', async () => {
    const { service } = await fixture();
    const first = await service.prepareFromLegacy();
    const second = await service.prepareFromLegacy();
    expect(second.candidateDatasetId).toBe(first.candidateDatasetId);
    expect(second.runId).toBe(first.runId);
  });

  it('rechaza un candidato alterado después de prepararlo', async () => {
    const { mainDatabase, mainRepository, service } = await fixture();
    const prepared = await service.prepareFromLegacy();
    const record = await mainDatabase.legacyViabilityRecords.get([
      prepared.candidateDatasetId,
      'registro-prueba-001',
    ]);
    expect(record).toBeDefined();
    await mainDatabase.legacyViabilityRecords.put({ ...record!, text: 'alteración no verificada' });
    await expect(service.activate(prepared)).rejects.toThrow(/huella interna/);
    expect(await mainRepository.getActiveSource()).toBe('legacy');
  });

  it('abandona un staging interrumpido al inicializar', async () => {
    const { mainDatabase, mainRepository } = await fixture();
    await mainDatabase.open();
    const now = new Date().toISOString();
    await mainDatabase.datasets.add({
      id: 'interrumpido',
      state: 'staging',
      source: 'legacy-copy',
      createdAt: now,
      updatedAt: now,
      recordCount: 0,
      photoCount: 0,
      payloadBytes: 0,
      sourceFingerprint: 'a'.repeat(64),
      contentFingerprint: 'b'.repeat(64),
      sourceDatasetId: 'legacy',
    });
    await mainDatabase.migrationRuns.add({
      id: 'run-interrumpido',
      state: 'staging',
      sourceKind: 'legacy-database',
      sourceFingerprint: 'a'.repeat(64),
      contentFingerprint: 'b'.repeat(64),
      sourceDatasetId: 'legacy',
      candidateDatasetId: 'interrumpido',
      createdAt: now,
      updatedAt: now,
    });
    await mainRepository.initialize();
    expect((await mainDatabase.datasets.get('interrumpido'))?.state).toBe('abandoned');
    expect((await mainDatabase.migrationRuns.get('run-interrumpido'))?.state).toBe('abandoned');
  });

  it('rechaza falta de cuota antes de escribir', async () => {
    await expect(assertCandidateSpace(1024, async () => ({ usage: 99, quota: 100 }))).rejects.toThrow(
      /espacio suficiente/,
    );
    await expect(assertCandidateSpace(1024, async () => ({}))).rejects.toThrow(/no proporciona/);
  });

  it('no crea un candidato cuando la cuota es insuficiente', async () => {
    const { reader, mainDatabase, mainRepository } = await fixture();
    const before = await reader.inspect();
    const service = new MigrationService(mainRepository, reader, async () => ({ usage: 99, quota: 100 }));
    await expect(service.prepareFromLegacy()).rejects.toThrow(/espacio suficiente/);
    expect(await mainDatabase.datasets.count()).toBe(0);
    expect((await reader.inspect()).fingerprint).toBe(before.fingerprint);
  });

  it('abandona el candidato si la huella del origen cambia durante la copia', async () => {
    const { reader, mainDatabase, mainRepository } = await fixture();
    class ChangedFingerprintReader extends LegacySourceReader {
      private calls = 0;

      override async inspect() {
        const inspection = await reader.inspect();
        this.calls += 1;
        return this.calls === 2 ? { ...inspection, fingerprint: 'f'.repeat(64) } : inspection;
      }
    }
    const service = new MigrationService(
      mainRepository,
      new ChangedFingerprintReader(),
      async () => ({ usage: 0, quota: 1024 * 1024 * 1024 }),
    );
    await expect(service.prepareFromLegacy()).rejects.toThrow(/cambió durante la copia/);
    expect((await mainDatabase.datasets.toArray()).every(({ state }) => state === 'abandoned')).toBe(true);
    expect(await mainRepository.getActiveSource()).toBe('legacy');
  });

  it('no crea una base de origen ausente al intentar leerla', async () => {
    const name = `ausente-${crypto.randomUUID()}`;
    const reader = new LegacySourceReader(name);
    await expect(reader.inspect()).rejects.toThrow(/No existe/);
    const entries = await indexedDB.databases();
    expect(entries.some((entry) => entry.name === name)).toBe(false);
  });
});
