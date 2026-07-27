export type TrainingSessionStatus = 'draft' | 'planned' | 'completed' | 'cancelled';
export type TrainingSessionOrigin = 'manual' | 'copied' | 'unplanned';

export interface TrainingSettings {
  datasetId: string;
  id: string;
  effectiveFromMonday: string;
  weeklyGoal: number;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingType {
  datasetId: string;
  id: string;
  name: string;
  normalizedName: string;
  origin: 'initial' | 'custom';
  initialKey?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseCatalogItem {
  datasetId: string;
  id: string;
  name: string;
  normalizedName: string;
  primaryTrainingTypeId?: string;
  secondaryTrainingTypeIds: string[];
  note: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingTypeSnapshot {
  trainingTypeId: string;
  nameSnapshot: string;
}

export interface TrainingSession {
  datasetId: string;
  id: string;
  status: TrainingSessionStatus;
  localDate: string;
  startTime?: string;
  durationMinutes?: number;
  title: string;
  note: string;
  trainingTypes: TrainingTypeSnapshot[];
  origin: TrainingSessionOrigin;
  sourceSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSessionExercise {
  datasetId: string;
  id: string;
  sessionId: string;
  catalogExerciseId?: string;
  nameSnapshot: string;
  order: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSet {
  datasetId: string;
  id: string;
  sessionExerciseId: string;
  order: number;
  repetitions: number | null;
  loadKg: number | null;
  plannedRepetitions?: number | null;
  plannedLoadKg?: number | null;
  actualRepetitions?: number | null;
  actualLoadKg?: number | null;
  completed: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
}
