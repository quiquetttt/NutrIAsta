import type { FullBackupManifestV3 } from '@/backup/full-backup-v3-types';

export {
  FULL_DATA_TABLES_V3 as FULL_DATA_TABLES_V4,
} from '@/backup/full-backup-v3-types';
export type {
  FullBackupDataV3 as FullBackupDataV4,
  FullDataTableV3 as FullDataTableV4,
} from '@/backup/full-backup-v3-types';

export interface FullBackupManifestV4
  extends Omit<FullBackupManifestV3, 'formatVersion'> {
  formatVersion: 4;
  ocrProvenance: {
    field: 'foods.dataOrigin';
    recognizedTextIncluded: false;
    currentValues: readonly ['manual', 'label-photo'];
    legacyValuesPreserved: true;
  };
}
