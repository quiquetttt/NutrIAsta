import type { TrainingType } from '@/mvp/training-types';
import {
  mainDatabase,
  type NutrIAstaMainDatabase,
} from '@/storage/main-database.web';
import { MAIN_META_KEYS } from '@/storage/main-schema';
import { trackWrite } from '@/storage/write-tracker';

export const INITIAL_TRAINING_TYPES = [
  { key: 'chest', name: 'Pecho' },
  { key: 'shoulders', name: 'Hombro' },
  { key: 'biceps', name: 'Bíceps' },
  { key: 'triceps', name: 'Tríceps' },
  { key: 'back', name: 'Espalda' },
  { key: 'core', name: 'Core' },
  { key: 'legs', name: 'Pierna' },
  { key: 'glutes', name: 'Culo' },
  { key: 'cardio', name: 'Cardio' },
] as const;

export class TrainingInitializer {
  constructor(private readonly db: NutrIAstaMainDatabase = mainDatabase) {}

  async ensureInitialTypes(): Promise<TrainingType[]> {
    await this.db.open();
    const datasetId = await this.activeDatasetId();
    const now = new Date().toISOString();

    await trackWrite(() => this.db.transaction(
      'rw',
      this.db.metadata,
      this.db.trainingTypes,
      async () => {
        if (await this.activeDatasetId() !== datasetId) {
          throw new Error('El dataset activo cambió durante la inicialización.');
        }
        const existing = await this.db.trainingTypes.where('datasetId').equals(datasetId).toArray();
        const existingKeys = new Set(
          existing
            .filter(({ origin, initialKey }) => origin === 'initial' && initialKey)
            .map(({ initialKey }) => initialKey),
        );
        const missing: TrainingType[] = INITIAL_TRAINING_TYPES
          .filter(({ key }) => !existingKeys.has(key))
          .map(({ key, name }) => ({
            datasetId,
            id: `training-type-initial-${key}`,
            name,
            normalizedName: name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es'),
            origin: 'initial',
            initialKey: key,
            archived: false,
            createdAt: now,
            updatedAt: now,
          }));
        if (missing.length > 0) await this.db.trainingTypes.bulkAdd(missing);
      },
    ));

    return this.db.trainingTypes.where('datasetId').equals(datasetId).sortBy('name');
  }

  private async activeDatasetId(): Promise<string> {
    const [source, entry] = await Promise.all([
      this.db.metadata.get(MAIN_META_KEYS.activeSource),
      this.db.metadata.get(MAIN_META_KEYS.activeMainDatasetId),
    ]);
    if (source?.value !== 'main' || typeof entry?.value !== 'string') {
      throw new Error('No existe un dataset principal activo.');
    }
    return entry.value;
  }
}

export const trainingInitializer = new TrainingInitializer();
