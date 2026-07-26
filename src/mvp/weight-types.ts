export interface WeightEntry {
  datasetId: string;
  id: string;
  recordedAt: string;
  localDate: string;
  localTime: string;
  weightKg: number;
  note: string;
  origin: 'manual' | 'profile-copy';
  createdAt: string;
  updatedAt: string;
}
