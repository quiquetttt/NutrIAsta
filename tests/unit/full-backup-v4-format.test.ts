import { describe, expect, it } from 'vitest';

import {
  FULL_BACKUP_V4_DATA_PATH,
  parseFullBackupV4Data,
  parseFullBackupV4Manifest,
} from '@/backup/full-backup-v4-format';
import {
  FULL_DATA_TABLES_V4,
  type FullBackupDataV4,
  type FullBackupManifestV4,
} from '@/backup/full-backup-v4-types';

const counts = Object.fromEntries(
  FULL_DATA_TABLES_V4.map((table) => [table, 0]),
) as FullBackupManifestV4['entityCounts'];

const manifest: FullBackupManifestV4 = {
  format: 'nutriasta-full-backup',
  formatVersion: 4,
  databaseSchemaVersion: 6,
  minimumAppVersion: '0.4.0',
  appVersion: '0.4.0',
  backupId: 'backup-formato-4-ficticio',
  sourceDatasetId: 'dataset-ficticio',
  exportedAt: '2026-07-29T12:00:00.000Z',
  entityCounts: counts,
  files: [{
    path: FULL_BACKUP_V4_DATA_PATH,
    kind: 'data',
    size: 2,
    checksum: 'a'.repeat(64),
    mimeType: 'application/json',
  }],
  contentFingerprint: 'b'.repeat(64),
  ocrProvenance: {
    field: 'foods.dataOrigin',
    recognizedTextIncluded: false,
    currentValues: ['manual', 'label-photo'],
    legacyValuesPreserved: true,
  },
};

const emptyData = Object.fromEntries(
  FULL_DATA_TABLES_V4.map((table) => [table, []]),
) as unknown as FullBackupDataV4;

describe('contrato del backup completo formato 4', () => {
  it('conserva las 26 tablas, procedencia OCR y compatibilidad semántica futura', () => {
    expect(FULL_DATA_TABLES_V4).toHaveLength(26);
    expect(parseFullBackupV4Manifest(JSON.stringify(manifest), '0.4.0').formatVersion).toBe(4);
    expect(parseFullBackupV4Manifest(JSON.stringify(manifest), '1.0.0').ocrProvenance)
      .toMatchObject({ recognizedTextIncluded: false });
    expect(() => parseFullBackupV4Manifest(JSON.stringify(manifest), '0.3.3'))
      .toThrow(/necesita NutrIAsta 0.4.0/);
  });

  it('rechaza un contrato que incluya texto OCR completo', () => {
    expect(() => parseFullBackupV4Manifest(JSON.stringify({
      ...manifest,
      ocrProvenance: { ...manifest.ocrProvenance, recognizedTextIncluded: true },
    }), '0.4.0')).toThrow(/trazabilidad OCR/);
  });

  it('acepta procedencia actual e histórica, pero no texto OCR ni orígenes desconocidos', () => {
    const valid = {
      ...emptyData,
      foods: [
        { id: 'manual', dataOrigin: 'manual' },
        { id: 'foto', dataOrigin: 'label-photo' },
        { id: 'legado', dataOrigin: 'barcode-manual' },
      ],
    };
    expect(parseFullBackupV4Data(
      JSON.stringify(valid),
      { ...manifest, entityCounts: { ...counts, foods: 3 } },
    ).foods).toHaveLength(3);

    const withText = { ...emptyData, foods: [{ id: 'foto', dataOrigin: 'label-photo', recognizedText: 'no guardar' }] };
    expect(() => parseFullBackupV4Data(
      JSON.stringify(withText),
      { ...manifest, entityCounts: { ...counts, foods: 1 } },
    )).toThrow(/texto OCR completo/);

    const unknown = { ...emptyData, foods: [{ id: 'otro', dataOrigin: 'remoto' }] };
    expect(() => parseFullBackupV4Data(
      JSON.stringify(unknown),
      { ...manifest, entityCounts: { ...counts, foods: 1 } },
    )).toThrow(/procedencia/);
  });
});
