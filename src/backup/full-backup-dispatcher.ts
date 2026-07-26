import { textByteLength } from '@/backup/backup-format';
import { FULL_BACKUP_V3_LIMITS } from '@/backup/full-backup-v3-format';

export type SupportedBackupFormat = 1 | 2 | 3;

export function identifyBackupFormat(manifestText: string): SupportedBackupFormat {
  if (textByteLength(manifestText) > FULL_BACKUP_V3_LIMITS.manifestBytes) {
    throw new Error('El manifiesto supera el límite permitido.');
  }
  const value: unknown = JSON.parse(manifestText);
  if (!value || typeof value !== 'object') throw new Error('El manifiesto no es válido.');
  const candidate = value as Record<string, unknown>;
  if (candidate.format === 'nutriasta-backup' && candidate.formatVersion === 1) return 1;
  if (candidate.format === 'nutriasta-full-backup' && candidate.formatVersion === 2) return 2;
  if (candidate.format === 'nutriasta-full-backup' && candidate.formatVersion === 3) return 3;
  throw new Error('La versión del backup no es compatible.');
}
