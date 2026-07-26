import type {
  ExerciseCatalogItem,
  TrainingSessionExercise,
  TrainingSet,
} from '@/mvp/training-types';
import {
  mainDatabase,
  type NutrIAstaMainDatabase,
} from '@/storage/main-database.web';
import { MAIN_META_KEYS } from '@/storage/main-schema';
import { trackWrite } from '@/storage/write-tracker';
import { createId } from '@/utils/crypto';

export interface SessionExerciseView {
  exercise: TrainingSessionExercise;
  sets: TrainingSet[];
}

export class TrainingDetailRepository {
  constructor(private readonly db: NutrIAstaMainDatabase = mainDatabase) {}

  async listCatalog(): Promise<ExerciseCatalogItem[]> {
    const datasetId = await this.activeDatasetId();
    return (await this.db.exerciseCatalog.where('datasetId').equals(datasetId).toArray())
      .filter(({ archived }) => !archived)
      .sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }

  async createCatalogExercise(name: string, note = ''): Promise<ExerciseCatalogItem> {
    const datasetId = await this.activeDatasetId();
    const clean = cleanName(name);
    const normalizedName = normalizeName(clean);
    const now = new Date().toISOString();
    const value: ExerciseCatalogItem = {
      datasetId,
      id: createId('exercise'),
      name: clean,
      normalizedName,
      secondaryTrainingTypeIds: [],
      note: note.trim().slice(0, 500),
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.exerciseCatalog, async () => {
      await this.assertActive(datasetId);
      const duplicate = (await this.db.exerciseCatalog.where('datasetId').equals(datasetId).toArray())
        .some((item) => !item.archived && item.normalizedName === normalizedName);
      if (duplicate) throw new Error('Ya existe un ejercicio activo con ese nombre.');
      await this.db.exerciseCatalog.add(value);
    }));
    return value;
  }

  async sessionDetails(sessionId: string): Promise<SessionExerciseView[]> {
    const datasetId = await this.activeDatasetId();
    const session = await this.db.trainingSessions.get([datasetId, sessionId]);
    if (!session) throw new Error('La sesión no existe.');
    const exercises = await this.db.trainingSessionExercises
      .where('[datasetId+sessionId]')
      .equals([datasetId, sessionId])
      .sortBy('order');
    const result: SessionExerciseView[] = [];
    for (const exercise of exercises) {
      const sets = await this.db.trainingSets
        .where('[datasetId+sessionExerciseId]')
        .equals([datasetId, exercise.id])
        .sortBy('order');
      result.push({ exercise, sets });
    }
    return result;
  }

  async addExercise(
    sessionId: string,
    input: { catalogExerciseId?: string; name: string; note?: string },
  ): Promise<TrainingSessionExercise> {
    const datasetId = await this.activeDatasetId();
    const session = await this.db.trainingSessions.get([datasetId, sessionId]);
    if (!session) throw new Error('La sesión no existe.');
    const catalog = input.catalogExerciseId
      ? await this.db.exerciseCatalog.get([datasetId, input.catalogExerciseId])
      : undefined;
    if (input.catalogExerciseId && (!catalog || catalog.archived)) {
      throw new Error('El ejercicio del catálogo no está disponible.');
    }
    const nameSnapshot = cleanName(catalog?.name ?? input.name);
    const order = await this.db.trainingSessionExercises
      .where('[datasetId+sessionId]')
      .equals([datasetId, sessionId])
      .count();
    const now = new Date().toISOString();
    const value: TrainingSessionExercise = {
      datasetId,
      id: createId('session-exercise'),
      sessionId,
      catalogExerciseId: catalog?.id,
      nameSnapshot,
      order,
      note: (input.note ?? '').trim().slice(0, 500),
      createdAt: now,
      updatedAt: now,
    };
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.trainingSessionExercises, async () => {
      await this.assertActive(datasetId);
      await this.db.trainingSessionExercises.add(value);
    }));
    return value;
  }

  async deleteExercise(id: string): Promise<void> {
    const datasetId = await this.activeDatasetId();
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.trainingSessionExercises, this.db.trainingSets, async () => {
      await this.assertActive(datasetId);
      const exercise = await this.db.trainingSessionExercises.get([datasetId, id]);
      if (!exercise) throw new Error('El ejercicio de sesión no existe.');
      await this.db.trainingSets.where('[datasetId+sessionExerciseId]').equals([datasetId, id]).delete();
      await this.db.trainingSessionExercises.delete([datasetId, id]);
    }));
  }

  async addSet(
    sessionExerciseId: string,
    input: { repetitions: number | null; loadKg: number | null; completed: boolean; note?: string },
  ): Promise<TrainingSet> {
    validateSet(input.repetitions, input.loadKg);
    const datasetId = await this.activeDatasetId();
    const exercise = await this.db.trainingSessionExercises.get([datasetId, sessionExerciseId]);
    if (!exercise) throw new Error('El ejercicio de sesión no existe.');
    const order = await this.db.trainingSets
      .where('[datasetId+sessionExerciseId]')
      .equals([datasetId, sessionExerciseId])
      .count();
    const now = new Date().toISOString();
    const value: TrainingSet = {
      datasetId,
      id: createId('training-set'),
      sessionExerciseId,
      order,
      repetitions: input.repetitions,
      loadKg: input.loadKg,
      completed: input.completed,
      note: (input.note ?? '').trim().slice(0, 300),
      createdAt: now,
      updatedAt: now,
    };
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.trainingSets, async () => {
      await this.assertActive(datasetId);
      await this.db.trainingSets.add(value);
    }));
    return value;
  }

  async updateSet(
    id: string,
    input: { repetitions: number | null; loadKg: number | null; completed: boolean; note?: string },
  ): Promise<void> {
    validateSet(input.repetitions, input.loadKg);
    const datasetId = await this.activeDatasetId();
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.trainingSets, async () => {
      await this.assertActive(datasetId);
      if (!await this.db.trainingSets.get([datasetId, id])) throw new Error('La serie no existe.');
      await this.db.trainingSets.update([datasetId, id], {
        ...input,
        note: (input.note ?? '').trim().slice(0, 300),
        updatedAt: new Date().toISOString(),
      });
    }));
  }

  async deleteSet(id: string): Promise<void> {
    const datasetId = await this.activeDatasetId();
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.trainingSets, async () => {
      await this.assertActive(datasetId);
      await this.db.trainingSets.delete([datasetId, id]);
    }));
  }

  async exerciseHistory(catalogExerciseId: string): Promise<Array<{ sessionDate: string; exercise: TrainingSessionExercise; sets: TrainingSet[] }>> {
    const datasetId = await this.activeDatasetId();
    const exercises = (await this.db.trainingSessionExercises.where('datasetId').equals(datasetId).toArray())
      .filter((item) => item.catalogExerciseId === catalogExerciseId);
    const result = [];
    for (const exercise of exercises) {
      const session = await this.db.trainingSessions.get([datasetId, exercise.sessionId]);
      if (!session) continue;
      const sets = await this.db.trainingSets.where('[datasetId+sessionExerciseId]').equals([datasetId, exercise.id]).sortBy('order');
      result.push({ sessionDate: session.localDate, exercise, sets });
    }
    return result.sort((left, right) => right.sessionDate.localeCompare(left.sessionDate));
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

function cleanName(value: string) {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 80) throw new Error('El ejercicio debe tener entre 2 y 80 caracteres.');
  return clean;
}
function normalizeName(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
}
function validateSet(repetitions: number | null, loadKg: number | null) {
  if (repetitions !== null && (!Number.isInteger(repetitions) || repetitions < 0 || repetitions > 10_000)) {
    throw new Error('Las repeticiones deben ser un entero no negativo.');
  }
  if (loadKg !== null && (!Number.isFinite(loadKg) || loadKg < 0 || loadKg > 10_000)) {
    throw new Error('La carga debe ser un número no negativo.');
  }
}

export const trainingDetailRepository = new TrainingDetailRepository();
