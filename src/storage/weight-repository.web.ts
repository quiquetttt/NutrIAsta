import type { WeightEntry } from '@/mvp/weight-types';
import {
  mainDatabase,
  type NutrIAstaMainDatabase,
} from '@/storage/main-database.web';
import { MAIN_META_KEYS } from '@/storage/main-schema';
import { trackWrite } from '@/storage/write-tracker';
import { createId } from '@/utils/crypto';

export interface WeightDraft {
  id?: string;
  localDate: string;
  localTime: string;
  weightKg: number;
  note: string;
  origin?: WeightEntry['origin'];
}

export class WeightRepository {
  constructor(private readonly db: NutrIAstaMainDatabase = mainDatabase) {}

  async list(): Promise<WeightEntry[]> {
    const datasetId = await this.activeDatasetId();
    return (await this.db.weightEntries.where('datasetId').equals(datasetId).toArray())
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  }

  async save(draft: WeightDraft): Promise<WeightEntry> {
    validateDraft(draft);
    const datasetId = await this.activeDatasetId();
    const recordedAt = new Date(`${draft.localDate}T${draft.localTime}:00`).toISOString();
    const now = new Date().toISOString();
    let result: WeightEntry | null = null;
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.weightEntries, async () => {
      await this.assertActive(datasetId);
      const previous = draft.id ? await this.db.weightEntries.get([datasetId, draft.id]) : undefined;
      result = {
        datasetId,
        id: previous?.id ?? createId('weight'),
        recordedAt,
        localDate: draft.localDate,
        localTime: draft.localTime,
        weightKg: Math.round(draft.weightKg * 100) / 100,
        note: draft.note.trim().slice(0, 500),
        origin: previous?.origin ?? draft.origin ?? 'manual',
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };
      await this.db.weightEntries.put(result);
    }));
    return result!;
  }

  async delete(id: string): Promise<void> {
    const datasetId = await this.activeDatasetId();
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.weightEntries, async () => {
      await this.assertActive(datasetId);
      await this.db.weightEntries.delete([datasetId, id]);
    }));
  }

  async copyFromProfile(localDate: string, localTime: string): Promise<WeightEntry> {
    const datasetId = await this.activeDatasetId();
    const profile = await this.db.profiles.where('datasetId').equals(datasetId).first();
    if (!profile) throw new Error('No existe un perfil activo.');
    return this.save({ localDate, localTime, weightKg: profile.weightKg, note: 'Copia manual desde el perfil', origin: 'profile-copy' });
  }

  private async activeDatasetId(): Promise<string> {
    await this.db.open();
    const source = (await this.db.metadata.get(MAIN_META_KEYS.activeSource))?.value;
    const id = (await this.db.metadata.get(MAIN_META_KEYS.activeMainDatasetId))?.value;
    if (source !== 'main' || typeof id !== 'string') throw new Error('No existe un dataset principal activo.');
    return id;
  }
  private async assertActive(datasetId: string) {
    if (await this.activeDatasetId() !== datasetId) throw new Error('El dataset activo cambió durante la operación.');
  }
}

function validateDraft(draft: WeightDraft) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.localDate) || !/^\d{2}:\d{2}$/.test(draft.localTime)) {
    throw new Error('La fecha y hora del peso no son válidas.');
  }
  if (!Number.isFinite(draft.weightKg) || draft.weightKg < 20 || draft.weightKg > 400) {
    throw new Error('El peso debe estar entre 20 y 400 kg.');
  }
  if (Number.isNaN(new Date(`${draft.localDate}T${draft.localTime}:00`).getTime())) {
    throw new Error('La fecha y hora del peso no existen.');
  }
}

export const weightRepository = new WeightRepository();
