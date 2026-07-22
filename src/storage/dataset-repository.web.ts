import type { Transaction } from 'dexie';

import { database, type NutrIAstaDatabase } from '@/storage/database.web';
import { META_KEYS } from '@/storage/schema';
import type {
  DatasetMetadata,
  DatasetSnapshot,
  PhotoAsset,
  RestoreSession,
  ViabilityRecord,
} from '@/storage/dataset-types';
import { trackWrite } from '@/storage/write-tracker';
import { createId } from '@/utils/crypto';

const TEST_RECORD_ID = 'registro-prueba-001' as const;
const TEST_PHOTO_ID = 'foto-prueba-001' as const;

export class DatasetRepository {
  constructor(private readonly db: NutrIAstaDatabase = database) {}

  async initialize(): Promise<string> {
    await this.db.open();
    const activeId = await this.getMetadata<string>(META_KEYS.activeDatasetId);
    if (activeId && (await this.db.datasets.get(activeId))) {
      await this.discardInterruptedStaging(activeId);
      return activeId;
    }

    const dataset = this.createDataset('new', 'active');
    await trackWrite(() =>
      this.db.transaction('rw', this.db.datasets, this.db.metadata, async () => {
        await this.db.datasets.add(dataset);
        await this.db.metadata.put({ key: META_KEYS.activeDatasetId, value: dataset.id });
      }),
    );
    return dataset.id;
  }

  async getActiveDatasetId(): Promise<string> {
    const id = await this.getMetadata<string>(META_KEYS.activeDatasetId);
    if (!id) throw new Error('No existe un dataset activo.');
    return id;
  }

  async getActiveSnapshot(): Promise<DatasetSnapshot> {
    return this.getDatasetSnapshot(await this.getActiveDatasetId());
  }

  async getDatasetSnapshot(datasetId: string): Promise<DatasetSnapshot> {
    const dataset = await this.db.datasets.get(datasetId);
    if (!dataset) throw new Error('El dataset solicitado no existe.');
    const [records, photos] = await Promise.all([
      this.db.viabilityRecords.where('datasetId').equals(datasetId).toArray(),
      this.db.photos.where('datasetId').equals(datasetId).toArray(),
    ]);
    return { dataset, records, photos };
  }

  async saveTestRecord(text: string): Promise<ViabilityRecord> {
    const datasetId = await this.getActiveDatasetId();
    const existing = await this.db.viabilityRecords.get([datasetId, TEST_RECORD_ID]);
    const now = new Date().toISOString();
    const record: ViabilityRecord = {
      datasetId,
      id: TEST_RECORD_ID,
      text: text.trim() || 'Registro ficticio',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await trackWrite(async () => {
      await this.db.viabilityRecords.put(record);
      await this.refreshCounts(datasetId);
    });
    return record;
  }

  async saveTestPhoto(photo: Omit<PhotoAsset, 'datasetId' | 'id'>): Promise<PhotoAsset> {
    const datasetId = await this.getActiveDatasetId();
    const asset: PhotoAsset = { ...photo, datasetId, id: TEST_PHOTO_ID };
    await trackWrite(async () => {
      await this.db.photos.put(asset);
      await this.refreshCounts(datasetId);
    });
    return asset;
  }

  async setLastBackupAt(value: string): Promise<void> {
    await trackWrite(() => this.db.metadata.put({ key: META_KEYS.lastBackupAt, value }));
  }

  async getLastBackupAt(): Promise<string | null> {
    return (await this.getMetadata<string>(META_KEYS.lastBackupAt)) ?? null;
  }

  async stageSnapshot(
    snapshot: Omit<DatasetSnapshot, 'dataset'>,
    sourceBackupId: string,
  ): Promise<string> {
    const dataset = this.createDataset('backup', 'staging');
    dataset.sourceBackupId = sourceBackupId;
    dataset.recordCount = snapshot.records.length;
    dataset.photoCount = snapshot.photos.length;

    await trackWrite(() => this.db.datasets.add(dataset));
    try {
      for (let index = 0; index < snapshot.records.length; index += 100) {
        const batch = snapshot.records.slice(index, index + 100).map((record) => ({
          ...record,
          datasetId: dataset.id,
        }));
        await trackWrite(() => this.db.viabilityRecords.bulkPut(batch));
      }
      for (let index = 0; index < snapshot.photos.length; index += 10) {
        const batch = snapshot.photos.slice(index, index + 10).map((photo) => ({
          ...photo,
          datasetId: dataset.id,
        }));
        await trackWrite(() => this.db.photos.bulkPut(batch));
      }
      await this.refreshCounts(dataset.id);
      return dataset.id;
    } catch (error) {
      await this.db.datasets.update(dataset.id, { state: 'abandoned', updatedAt: new Date().toISOString() });
      throw error;
    }
  }

  async activateCandidate(candidateDatasetId: string): Promise<RestoreSession> {
    const previousDatasetId = await this.getActiveDatasetId();
    const session: RestoreSession = {
      candidateDatasetId,
      previousDatasetId,
      phase: 'activated',
    };
    await this.switchActiveDataset(candidateDatasetId, session);
    return session;
  }

  async rollbackRestoration(session: RestoreSession): Promise<RestoreSession> {
    const updated = { ...session, phase: 'rolledBack' as const };
    await this.switchActiveDataset(session.previousDatasetId, updated);
    return updated;
  }

  async reactivateRestoration(session: RestoreSession): Promise<RestoreSession> {
    const updated = { ...session, phase: 'activated' as const };
    await this.switchActiveDataset(session.candidateDatasetId, updated);
    return updated;
  }

  async confirmRestoration(session: RestoreSession): Promise<void> {
    if ((await this.getActiveDatasetId()) !== session.candidateDatasetId) {
      throw new Error('El candidato debe estar activo antes de confirmar.');
    }
    await trackWrite(() =>
      this.db.transaction('rw', this.db.metadata, this.db.datasets, async () => {
        await this.db.datasets.update(session.candidateDatasetId, {
          confirmedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await this.db.metadata.bulkDelete([
          META_KEYS.restoreCandidateId,
          META_KEYS.restorePreviousId,
          META_KEYS.restorePhase,
        ]);
      }),
    );
  }

  async getRestoreSession(): Promise<RestoreSession | null> {
    const [candidateDatasetId, previousDatasetId, phase] = await Promise.all([
      this.getMetadata<string>(META_KEYS.restoreCandidateId),
      this.getMetadata<string>(META_KEYS.restorePreviousId),
      this.getMetadata<RestoreSession['phase']>(META_KEYS.restorePhase),
    ]);
    if (!candidateDatasetId || !previousDatasetId || !phase) return null;
    return { candidateDatasetId, previousDatasetId, phase };
  }

  async discardCandidate(datasetId: string): Promise<void> {
    if ((await this.getActiveDatasetId()) === datasetId) {
      throw new Error('No se puede descartar el dataset activo.');
    }
    await trackWrite(async () => {
      await this.db.viabilityRecords.where('datasetId').equals(datasetId).delete();
      await this.db.photos.where('datasetId').equals(datasetId).delete();
      await this.db.datasets.delete(datasetId);
    });
  }

  private async switchActiveDataset(targetId: string, session: RestoreSession): Promise<void> {
    await trackWrite(() =>
      this.db.transaction('rw', this.db.metadata, this.db.datasets, async (transaction) => {
        const currentId = await this.metadataInTransaction<string>(transaction, META_KEYS.activeDatasetId);
        if (!currentId) throw new Error('No existe un dataset activo.');
        const [current, target] = await Promise.all([
          this.db.datasets.get(currentId),
          this.db.datasets.get(targetId),
        ]);
        if (!current || !target || target.state === 'abandoned') {
          throw new Error('No se puede activar el dataset solicitado.');
        }
        const now = new Date().toISOString();
        if (currentId !== targetId) {
          await this.db.datasets.update(currentId, { state: 'rollback', updatedAt: now });
          await this.db.datasets.update(targetId, { state: 'active', updatedAt: now });
        }
        await this.db.metadata.bulkPut([
          { key: META_KEYS.activeDatasetId, value: targetId },
          { key: META_KEYS.restoreCandidateId, value: session.candidateDatasetId },
          { key: META_KEYS.restorePreviousId, value: session.previousDatasetId },
          { key: META_KEYS.restorePhase, value: session.phase },
        ]);
      }),
    );
  }

  private async refreshCounts(datasetId: string): Promise<void> {
    const [recordCount, photoCount] = await Promise.all([
      this.db.viabilityRecords.where('datasetId').equals(datasetId).count(),
      this.db.photos.where('datasetId').equals(datasetId).count(),
    ]);
    await this.db.datasets.update(datasetId, {
      recordCount,
      photoCount,
      updatedAt: new Date().toISOString(),
    });
  }

  private createDataset(source: DatasetMetadata['source'], state: DatasetMetadata['state']): DatasetMetadata {
    const now = new Date().toISOString();
    return {
      id: createId('dataset'),
      state,
      source,
      createdAt: now,
      updatedAt: now,
      recordCount: 0,
      photoCount: 0,
    };
  }

  private async discardInterruptedStaging(activeId: string): Promise<void> {
    const staging = await this.db.datasets.where('state').anyOf('staging', 'abandoned').toArray();
    for (const dataset of staging) {
      if (dataset.id !== activeId) await this.discardCandidate(dataset.id);
    }
  }

  private async getMetadata<T>(key: string): Promise<T | undefined> {
    return (await this.db.metadata.get(key))?.value as T | undefined;
  }

  private async metadataInTransaction<T>(transaction: Transaction, key: string): Promise<T | undefined> {
    const table = transaction.table('metadata');
    const entry = (await table.get(key)) as { value?: T } | undefined;
    return entry?.value;
  }
}

export const datasetRepository = new DatasetRepository();
