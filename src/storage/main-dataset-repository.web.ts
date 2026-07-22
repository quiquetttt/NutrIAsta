import { mainDatabase, type NutrIAstaMainDatabase } from '@/storage/main-database.web';
import type {
  MainActiveSource,
  MainCandidatePayload,
  MainDatasetMetadata,
  MainDatasetSnapshot,
  MainMigrationSession,
  MigrationRun,
  MigrationSourceKind,
} from '@/storage/main-dataset-types';
import { MAIN_META_KEYS } from '@/storage/main-schema';
import { trackWrite } from '@/storage/write-tracker';
import { createId } from '@/utils/crypto';

export class MainDatasetRepository {
  constructor(private readonly db: NutrIAstaMainDatabase = mainDatabase) {}

  async initialize(): Promise<void> {
    await this.db.open();
    const source = await this.getMetadata<MainActiveSource>(MAIN_META_KEYS.activeSource);
    if (!source) {
      await trackWrite(() => this.db.metadata.put({ key: MAIN_META_KEYS.activeSource, value: 'legacy' }));
    }
    await this.recoverInterruptedStaging();
  }

  async getActiveSource(): Promise<MainActiveSource> {
    return (await this.getMetadata<MainActiveSource>(MAIN_META_KEYS.activeSource)) ?? 'legacy';
  }

  async getActiveMainDatasetId(): Promise<string | null> {
    return (await this.getMetadata<string>(MAIN_META_KEYS.activeMainDatasetId)) ?? null;
  }

  async getDatasetSnapshot(datasetId: string): Promise<MainDatasetSnapshot> {
    const dataset = await this.db.datasets.get(datasetId);
    if (!dataset) throw new Error('El dataset principal solicitado no existe.');
    const [records, photos] = await Promise.all([
      this.db.legacyViabilityRecords.where('datasetId').equals(datasetId).toArray(),
      this.db.legacyViabilityPhotos.where('datasetId').equals(datasetId).toArray(),
    ]);
    return { dataset, records, photos };
  }

  async getActiveMainSnapshot(): Promise<MainDatasetSnapshot | null> {
    const id = await this.getActiveMainDatasetId();
    return id ? this.getDatasetSnapshot(id) : null;
  }

  async getPreparedCandidate(): Promise<MainDatasetSnapshot | null> {
    const candidates = await this.db.datasets.where('state').equals('staging').toArray();
    for (const candidate of candidates.sort((left, right) => right.createdAt.localeCompare(left.createdAt))) {
      const run = await this.getRunByCandidate(candidate.id);
      if (run?.state === 'prepared') return this.getDatasetSnapshot(candidate.id);
    }
    return null;
  }

  async getRunForCandidate(candidateDatasetId: string): Promise<MigrationRun | undefined> {
    return this.getRunByCandidate(candidateDatasetId);
  }

  async stageCandidate(
    payload: MainCandidatePayload,
    sourceKind: MigrationSourceKind,
  ): Promise<{ datasetId: string; runId: string }> {
    if (await this.getMigrationSession()) {
      throw new Error('Existe una migración pendiente de confirmación o rollback.');
    }
    const now = new Date().toISOString();
    const datasetId = createId('main-dataset');
    const runId = createId('migration');
    const dataset: MainDatasetMetadata = {
      id: datasetId,
      state: 'staging',
      source: sourceKind === 'legacy-database' ? 'legacy-copy' : 'format-1-backup',
      createdAt: now,
      updatedAt: now,
      recordCount: payload.records.length,
      photoCount: payload.photos.length,
      payloadBytes: payload.payloadBytes,
      sourceFingerprint: payload.sourceFingerprint,
      contentFingerprint: payload.contentFingerprint,
      sourceDatasetId: payload.sourceDatasetId,
      sourceBackupId: payload.sourceBackupId,
    };
    const run: MigrationRun = {
      id: runId,
      state: 'staging',
      sourceKind,
      sourceFingerprint: payload.sourceFingerprint,
      contentFingerprint: payload.contentFingerprint,
      sourceDatasetId: payload.sourceDatasetId,
      candidateDatasetId: datasetId,
      createdAt: now,
      updatedAt: now,
    };

    await trackWrite(() => this.db.transaction('rw', this.db.datasets, this.db.migrationRuns, async () => {
      await this.db.datasets.add(dataset);
      await this.db.migrationRuns.add(run);
    }));

    try {
      for (let index = 0; index < payload.records.length; index += 100) {
        const batch = payload.records.slice(index, index + 100).map((record) => ({
          ...record,
          datasetId,
        }));
        await trackWrite(() => this.db.legacyViabilityRecords.bulkPut(batch));
      }
      for (let index = 0; index < payload.photos.length; index += 5) {
        const batch = payload.photos.slice(index, index + 5).map((photo) => ({
          ...photo,
          datasetId,
        }));
        await trackWrite(() => this.db.legacyViabilityPhotos.bulkPut(batch));
      }
      const verifiedAt = new Date().toISOString();
      await trackWrite(() => this.db.transaction('rw', this.db.datasets, this.db.migrationRuns, async () => {
        await this.db.datasets.update(datasetId, { updatedAt: verifiedAt });
        await this.db.migrationRuns.update(runId, {
          state: 'prepared',
          verifiedAt,
          updatedAt: verifiedAt,
        });
      }));
      return { datasetId, runId };
    } catch (error) {
      await this.abandonCandidate(datasetId, error instanceof Error ? error.message : 'Error de escritura');
      throw error;
    }
  }

  async cancelCandidate(datasetId: string): Promise<void> {
    if (await this.isSelectedMainDataset(datasetId)) {
      throw new Error('No se puede cancelar el dataset principal seleccionado.');
    }
    await this.abandonCandidate(datasetId, 'Cancelado por el usuario');
  }

  async activateCandidate(candidateDatasetId: string): Promise<MainMigrationSession> {
    const previousSource = await this.getActiveSource();
    const previousMainDatasetId = await this.getActiveMainDatasetId();
    const run = await this.getRunByCandidate(candidateDatasetId);
    if (!run || run.state !== 'prepared') throw new Error('El candidato no está preparado.');
    const session: MainMigrationSession = {
      candidateDatasetId,
      previousSource,
      previousMainDatasetId,
      runId: run.id,
      phase: 'activated',
    };
    await this.switchToCandidate(session);
    return session;
  }

  async rollback(session: MainMigrationSession): Promise<MainMigrationSession> {
    const current = await this.getMigrationSession();
    if (!current || current.candidateDatasetId !== session.candidateDatasetId || current.phase !== 'activated') {
      throw new Error('No existe una migración activa que pueda revertirse.');
    }
    const updated: MainMigrationSession = { ...current, phase: 'rolledBack' };
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.datasets, this.db.migrationRuns, async () => {
      const candidate = await this.db.datasets.get(current.candidateDatasetId);
      if (!candidate) throw new Error('El candidato de migración no existe.');
      const now = new Date().toISOString();
      await this.db.datasets.update(candidate.id, { state: 'rollback', updatedAt: now });
      if (current.previousSource === 'main' && current.previousMainDatasetId) {
        await this.db.datasets.update(current.previousMainDatasetId, { state: 'active', updatedAt: now });
      }
      await this.db.metadata.bulkPut([
        { key: MAIN_META_KEYS.activeSource, value: current.previousSource },
        {
          key: MAIN_META_KEYS.activeMainDatasetId,
          value: current.previousSource === 'main' ? current.previousMainDatasetId : current.candidateDatasetId,
        },
        { key: MAIN_META_KEYS.migrationPhase, value: updated.phase },
      ]);
      await this.db.migrationRuns.update(current.runId, { state: 'rolledBack', updatedAt: now });
    }));
    return updated;
  }

  async reactivate(session: MainMigrationSession): Promise<MainMigrationSession> {
    const current = await this.getMigrationSession();
    if (!current || current.candidateDatasetId !== session.candidateDatasetId || current.phase !== 'rolledBack') {
      throw new Error('No existe una migración revertida que pueda reactivarse.');
    }
    const updated: MainMigrationSession = { ...current, phase: 'activated' };
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.datasets, this.db.migrationRuns, async () => {
      const candidate = await this.db.datasets.get(current.candidateDatasetId);
      if (!candidate || candidate.state === 'abandoned') throw new Error('El candidato no puede reactivarse.');
      const now = new Date().toISOString();
      if (current.previousSource === 'main' && current.previousMainDatasetId) {
        await this.db.datasets.update(current.previousMainDatasetId, { state: 'rollback', updatedAt: now });
      }
      await this.db.datasets.update(candidate.id, { state: 'active', updatedAt: now });
      await this.db.metadata.bulkPut([
        { key: MAIN_META_KEYS.activeSource, value: 'main' },
        { key: MAIN_META_KEYS.activeMainDatasetId, value: candidate.id },
        { key: MAIN_META_KEYS.migrationPhase, value: updated.phase },
      ]);
      await this.db.migrationRuns.update(current.runId, { state: 'activated', updatedAt: now });
    }));
    return updated;
  }

  async confirm(session: MainMigrationSession): Promise<void> {
    const current = await this.getMigrationSession();
    if (!current || current.candidateDatasetId !== session.candidateDatasetId || current.phase !== 'activated') {
      throw new Error('La migración debe estar activa antes de confirmarla.');
    }
    if (await this.getActiveSource() !== 'main') throw new Error('La base principal no está activa.');
    const now = new Date().toISOString();
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.datasets, this.db.migrationRuns, async () => {
      await this.db.datasets.update(current.candidateDatasetId, { confirmedAt: now, updatedAt: now });
      await this.db.migrationRuns.update(current.runId, { state: 'confirmed', confirmedAt: now, updatedAt: now });
      await this.db.metadata.bulkDelete([
        MAIN_META_KEYS.migrationCandidateId,
        MAIN_META_KEYS.migrationPreviousSource,
        MAIN_META_KEYS.migrationPreviousMainDatasetId,
        MAIN_META_KEYS.migrationRunId,
        MAIN_META_KEYS.migrationPhase,
      ]);
    }));
  }

  async getMigrationSession(): Promise<MainMigrationSession | null> {
    const [candidateDatasetId, previousSource, previousMainDatasetId, runId, phase] = await Promise.all([
      this.getMetadata<string>(MAIN_META_KEYS.migrationCandidateId),
      this.getMetadata<MainActiveSource>(MAIN_META_KEYS.migrationPreviousSource),
      this.getMetadata<string | null>(MAIN_META_KEYS.migrationPreviousMainDatasetId),
      this.getMetadata<string>(MAIN_META_KEYS.migrationRunId),
      this.getMetadata<MainMigrationSession['phase']>(MAIN_META_KEYS.migrationPhase),
    ]);
    if (!candidateDatasetId || !previousSource || !runId || !phase) return null;
    return { candidateDatasetId, previousSource, previousMainDatasetId: previousMainDatasetId ?? null, runId, phase };
  }

  private async switchToCandidate(session: MainMigrationSession): Promise<void> {
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.datasets, this.db.migrationRuns, async () => {
      const candidate = await this.db.datasets.get(session.candidateDatasetId);
      const run = await this.db.migrationRuns.get(session.runId);
      if (!candidate || candidate.state !== 'staging' || !run || run.state !== 'prepared') {
        throw new Error('El candidato no está listo para activarse.');
      }
      const now = new Date().toISOString();
      if (session.previousSource === 'main' && session.previousMainDatasetId) {
        await this.db.datasets.update(session.previousMainDatasetId, { state: 'rollback', updatedAt: now });
      }
      await this.db.datasets.update(candidate.id, { state: 'active', updatedAt: now });
      await this.db.metadata.bulkPut([
        { key: MAIN_META_KEYS.activeSource, value: 'main' },
        { key: MAIN_META_KEYS.activeMainDatasetId, value: candidate.id },
        { key: MAIN_META_KEYS.migrationCandidateId, value: candidate.id },
        { key: MAIN_META_KEYS.migrationPreviousSource, value: session.previousSource },
        { key: MAIN_META_KEYS.migrationPreviousMainDatasetId, value: session.previousMainDatasetId },
        { key: MAIN_META_KEYS.migrationRunId, value: session.runId },
        { key: MAIN_META_KEYS.migrationPhase, value: session.phase },
      ]);
      await this.db.migrationRuns.update(run.id, { state: 'activated', activatedAt: now, updatedAt: now });
    }));
  }

  private async recoverInterruptedStaging(): Promise<void> {
    const candidates = await this.db.datasets.where('state').equals('staging').toArray();
    for (const candidate of candidates) {
      const run = await this.getRunByCandidate(candidate.id);
      if (!run || run.state === 'staging') {
        await this.abandonCandidate(candidate.id, 'Preparación interrumpida');
      }
    }
  }

  private async abandonCandidate(datasetId: string, reason: string): Promise<void> {
    const run = await this.getRunByCandidate(datasetId);
    const now = new Date().toISOString();
    await trackWrite(async () => {
      const datasetTables = [
        this.db.legacyViabilityRecords, this.db.legacyViabilityPhotos, this.db.profiles,
        this.db.nutritionTargetPeriods, this.db.foods, this.db.foodPortions, this.db.foodPhotos,
        this.db.diaryDays, this.db.mealEntries, this.db.mealItems, this.db.waterEntries,
        this.db.trainingDayFlags, this.db.recipes, this.db.recipeItems,
      ];
      for (const table of datasetTables) await table.where('datasetId').equals(datasetId).delete();
      await this.db.transaction('rw', this.db.datasets, this.db.migrationRuns, async () => {
        await this.db.datasets.update(datasetId, {
          state: 'abandoned',
          recordCount: 0,
          photoCount: 0,
          payloadBytes: 0,
          updatedAt: now,
        });
        if (run) {
          await this.db.migrationRuns.update(run.id, {
            state: 'abandoned',
            abandonedReason: reason.slice(0, 500),
            updatedAt: now,
          });
        }
      });
    });
  }

  private async isSelectedMainDataset(datasetId: string): Promise<boolean> {
    return (await this.getActiveSource()) === 'main' && (await this.getActiveMainDatasetId()) === datasetId;
  }

  private async getRunByCandidate(candidateDatasetId: string): Promise<MigrationRun | undefined> {
    return this.db.migrationRuns.where('candidateDatasetId').equals(candidateDatasetId).first();
  }

  private async getMetadata<T>(key: string): Promise<T | undefined> {
    return (await this.db.metadata.get(key))?.value as T | undefined;
  }

}

export const mainDatasetRepository = new MainDatasetRepository();
