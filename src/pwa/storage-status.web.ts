import type { StorageStatus } from '@/storage/dataset-types';
import { datasetRepository } from '@/storage/dataset-repository.web';

export async function readStorageStatus(): Promise<StorageStatus> {
  const storage = navigator.storage;
  const [persisted, estimate, lastBackupAt] = await Promise.all([
    storage?.persisted ? storage.persisted().catch(() => null) : Promise.resolve(null),
    storage?.estimate
      ? storage.estimate().catch((): StorageEstimate => ({}))
      : Promise.resolve<StorageEstimate>({}),
    datasetRepository.getLastBackupAt(),
  ]);
  return {
    persisted,
    usage: typeof estimate.usage === 'number' ? estimate.usage : null,
    quota: typeof estimate.quota === 'number' ? estimate.quota : null,
    lastBackupAt,
  };
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  return navigator.storage.persist().catch(() => false);
}

export function isBackupRecent(lastBackupAt: string | null, now = Date.now()): boolean {
  if (!lastBackupAt) return false;
  const age = now - new Date(lastBackupAt).getTime();
  return Number.isFinite(age) && age <= 7 * 24 * 60 * 60 * 1000;
}

export function formatBytes(value: number | null): string {
  if (value === null) return 'No disponible';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = value / 1024;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${units[index]}`;
}
