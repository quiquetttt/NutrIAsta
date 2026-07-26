import type {
  TrainingSession,
  TrainingSessionStatus,
  TrainingSettings,
  TrainingType,
} from '@/mvp/training-types';
import {
  addLocalDays,
  goalEffectiveMonday,
  madridToday,
  mondayOfLocalWeek,
  parseLocalDate,
} from '@/mvp/training-date';
import {
  mainDatabase,
  type NutrIAstaMainDatabase,
} from '@/storage/main-database.web';
import { MAIN_META_KEYS } from '@/storage/main-schema';
import { trainingInitializer, type TrainingInitializer } from '@/storage/training-initializer.web';
import { trackWrite } from '@/storage/write-tracker';
import { createId } from '@/utils/crypto';

export interface TrainingSessionDraft {
  id?: string;
  status: TrainingSessionStatus;
  localDate: string;
  startTime?: string;
  durationMinutes?: number;
  title: string;
  note: string;
  trainingTypeIds: string[];
}

export class TrainingRepository {
  constructor(
    private readonly db: NutrIAstaMainDatabase = mainDatabase,
    private readonly initializer: TrainingInitializer = trainingInitializer,
  ) {}

  async initialize(today = madridToday()): Promise<void> {
    parseLocalDate(today);
    await this.db.open();
    await this.initializer.ensureInitialTypes();
    const datasetId = await this.activeDatasetId();
    if (await this.db.trainingSettings.where('datasetId').equals(datasetId).count()) return;
    const monday = mondayOfLocalWeek(today);
    const now = new Date().toISOString();
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.trainingSettings, async () => {
      await this.assertActive(datasetId);
      if (await this.db.trainingSettings.where('datasetId').equals(datasetId).count()) return;
      await this.db.trainingSettings.add({
        datasetId,
        id: `training-setting-${monday}`,
        effectiveFromMonday: monday,
        weeklyGoal: 4,
        createdAt: now,
        updatedAt: now,
      });
    }));
  }

  async listTypes(includeArchived = false): Promise<TrainingType[]> {
    const datasetId = await this.activeDatasetId();
    const values = await this.db.trainingTypes.where('datasetId').equals(datasetId).toArray();
    return values
      .filter(({ archived }) => includeArchived || !archived)
      .sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }

  async addCustomType(name: string): Promise<TrainingType> {
    const datasetId = await this.activeDatasetId();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < 2 || clean.length > 40) throw new Error('El tipo debe tener entre 2 y 40 caracteres.');
    const normalizedName = normalizeName(clean);
    const now = new Date().toISOString();
    const value: TrainingType = {
      datasetId,
      id: createId('training-type'),
      name: clean,
      normalizedName,
      origin: 'custom',
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.trainingTypes, async () => {
      await this.assertActive(datasetId);
      const duplicate = (await this.db.trainingTypes.where('datasetId').equals(datasetId).toArray())
        .some((type) => !type.archived && type.normalizedName === normalizedName);
      if (duplicate) throw new Error('Ya existe un tipo activo con ese nombre.');
      await this.db.trainingTypes.add(value);
    }));
    return value;
  }

  async archiveType(id: string): Promise<void> {
    const datasetId = await this.activeDatasetId();
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.trainingTypes, async () => {
      await this.assertActive(datasetId);
      const value = await this.db.trainingTypes.get([datasetId, id]);
      if (!value) throw new Error('El tipo de entrenamiento no existe.');
      await this.db.trainingTypes.update([datasetId, id], {
        archived: true,
        updatedAt: new Date().toISOString(),
      });
    }));
  }

  async listGoalPeriods(): Promise<TrainingSettings[]> {
    const datasetId = await this.activeDatasetId();
    return this.db.trainingSettings.where('datasetId').equals(datasetId).sortBy('effectiveFromMonday');
  }

  async goalForWeek(localDate: string): Promise<TrainingSettings | null> {
    const monday = mondayOfLocalWeek(localDate);
    const periods = await this.listGoalPeriods();
    return [...periods].reverse().find(({ effectiveFromMonday }) => effectiveFromMonday <= monday) ?? null;
  }

  async setWeeklyGoal(
    weeklyGoal: number,
    choice: 'current' | 'next',
    today = madridToday(),
  ): Promise<TrainingSettings> {
    if (!Number.isInteger(weeklyGoal) || weeklyGoal < 1 || weeklyGoal > 7) {
      throw new Error('El objetivo semanal debe estar entre 1 y 7.');
    }
    const effectiveFromMonday = goalEffectiveMonday(today, choice);
    const datasetId = await this.activeDatasetId();
    const now = new Date().toISOString();
    let result: TrainingSettings | null = null;
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.trainingSettings, async () => {
      await this.assertActive(datasetId);
      const existing = await this.db.trainingSettings
        .where('[datasetId+effectiveFromMonday]')
        .equals([datasetId, effectiveFromMonday])
        .first();
      result = {
        datasetId,
        id: existing?.id ?? `training-setting-${effectiveFromMonday}`,
        effectiveFromMonday,
        weeklyGoal,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await this.db.trainingSettings.put(result);
    }));
    return result!;
  }

  async listSessions(start: string, end: string): Promise<TrainingSession[]> {
    parseLocalDate(start);
    parseLocalDate(end);
    if (end < start) throw new Error('El intervalo de sesiones no es válido.');
    const datasetId = await this.activeDatasetId();
    return this.db.trainingSessions
      .where('[datasetId+localDate]')
      .between([datasetId, start], [datasetId, end], true, true)
      .sortBy('localDate');
  }

  async listHistory(): Promise<TrainingSession[]> {
    const datasetId = await this.activeDatasetId();
    return (await this.db.trainingSessions.where('datasetId').equals(datasetId).toArray())
      .sort((left, right) => right.localDate.localeCompare(left.localDate) || right.updatedAt.localeCompare(left.updatedAt));
  }

  async saveSession(draft: TrainingSessionDraft): Promise<TrainingSession> {
    parseLocalDate(draft.localDate);
    if (draft.trainingTypeIds.length < 1) throw new Error('Selecciona al menos un tipo de entrenamiento.');
    if (draft.durationMinutes !== undefined
      && (!Number.isInteger(draft.durationMinutes) || draft.durationMinutes < 1 || draft.durationMinutes > 1_440)) {
      throw new Error('La duración debe estar entre 1 y 1.440 minutos.');
    }
    const datasetId = await this.activeDatasetId();
    const types = await this.db.trainingTypes.where('datasetId').equals(datasetId).toArray();
    const selected = draft.trainingTypeIds.map((id) => {
      const type = types.find((candidate) => candidate.id === id && !candidate.archived);
      if (!type) throw new Error('Uno de los tipos seleccionados no está disponible.');
      return { trainingTypeId: type.id, nameSnapshot: type.name };
    });
    const now = new Date().toISOString();
    let value: TrainingSession | null = null;
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.trainingSessions, async () => {
      await this.assertActive(datasetId);
      const previous = draft.id ? await this.db.trainingSessions.get([datasetId, draft.id]) : undefined;
      value = {
        datasetId,
        id: previous?.id ?? createId('training-session'),
        status: draft.status,
        localDate: draft.localDate,
        startTime: draft.startTime || undefined,
        durationMinutes: draft.durationMinutes,
        title: draft.title.trim().slice(0, 80),
        note: draft.note.trim().slice(0, 1_000),
        trainingTypes: selected,
        origin: previous?.origin ?? (draft.status === 'completed' ? 'unplanned' : 'manual'),
        sourceSessionId: previous?.sourceSessionId,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };
      await this.db.trainingSessions.put(value);
    }));
    return value!;
  }

  async changeStatus(id: string, status: TrainingSessionStatus): Promise<void> {
    const datasetId = await this.activeDatasetId();
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.trainingSessions, async () => {
      await this.assertActive(datasetId);
      const session = await this.db.trainingSessions.get([datasetId, id]);
      if (!session) throw new Error('La sesión no existe.');
      await this.db.trainingSessions.update([datasetId, id], { status, updatedAt: new Date().toISOString() });
    }));
  }

  async copySession(id: string, newDate: string): Promise<TrainingSession> {
    parseLocalDate(newDate);
    const datasetId = await this.activeDatasetId();
    const source = await this.db.trainingSessions.get([datasetId, id]);
    if (!source) throw new Error('La sesión de origen no existe.');
    const now = new Date().toISOString();
    const copy: TrainingSession = {
      ...source,
      id: createId('training-session'),
      status: 'planned',
      localDate: newDate,
      origin: 'copied',
      sourceSessionId: source.id,
      createdAt: now,
      updatedAt: now,
    };
    await trackWrite(() => this.db.transaction('rw', this.db.metadata, this.db.trainingSessions, async () => {
      await this.assertActive(datasetId);
      await this.db.trainingSessions.add(copy);
    }));
    return copy;
  }

  async weeklySummary(localDate: string): Promise<{ monday: string; sunday: string; completed: number; goal: number }> {
    const monday = mondayOfLocalWeek(localDate);
    const sunday = addLocalDays(monday, 6);
    const [sessions, setting] = await Promise.all([this.listSessions(monday, sunday), this.goalForWeek(monday)]);
    return {
      monday,
      sunday,
      completed: sessions.filter(({ status }) => status === 'completed').length,
      goal: setting?.weeklyGoal ?? 4,
    };
  }

  private async activeDatasetId(): Promise<string> {
    await this.db.open();
    const source = (await this.db.metadata.get(MAIN_META_KEYS.activeSource))?.value;
    const id = (await this.db.metadata.get(MAIN_META_KEYS.activeMainDatasetId))?.value;
    if (source !== 'main' || typeof id !== 'string') throw new Error('No existe un dataset principal activo.');
    return id;
  }

  private async assertActive(datasetId: string): Promise<void> {
    if (await this.activeDatasetId() !== datasetId) throw new Error('El dataset activo cambió durante la operación.');
  }
}

function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
}

export const trainingRepository = new TrainingRepository();
