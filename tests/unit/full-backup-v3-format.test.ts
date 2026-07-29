import { describe, expect, it } from 'vitest';

import { identifyBackupFormat } from '@/backup/full-backup-dispatcher';
import {
  FULL_BACKUP_V3_DATA_PATH,
  FULL_BACKUP_V3_LIMITS,
  parseFullBackupV3Data,
  parseFullBackupV3Manifest,
} from '@/backup/full-backup-v3-format';
import {
  FULL_DATA_TABLES_V3,
  type FullBackupDataV3,
  type FullBackupManifestV3,
} from '@/backup/full-backup-v3-types';

const counts = Object.fromEntries(
  FULL_DATA_TABLES_V3.map((table) => [table, 0]),
) as FullBackupManifestV3['entityCounts'];

const manifest: FullBackupManifestV3 = {
  format: 'nutriasta-full-backup',
  formatVersion: 3,
  databaseSchemaVersion: 6,
  minimumAppVersion: '0.3.0',
  appVersion: '0.3.0',
  backupId: 'backup-formato-3-ficticio',
  sourceDatasetId: 'dataset-ficticio',
  exportedAt: '2026-07-26T12:00:00.000Z',
  entityCounts: counts,
  files: [{
    path: FULL_BACKUP_V3_DATA_PATH,
    kind: 'data',
    size: 2,
    checksum: 'a'.repeat(64),
    mimeType: 'application/json',
  }],
  contentFingerprint: 'b'.repeat(64),
};

const emptyData = Object.fromEntries(
  FULL_DATA_TABLES_V3.map((table) => [table, []]),
) as unknown as FullBackupDataV3;

describe('contrato del backup completo formato 3', () => {
  it('enumera exactamente las 26 tablas y acepta versiones posteriores compatibles', () => {
    expect(FULL_DATA_TABLES_V3).toHaveLength(26);
    expect(parseFullBackupV3Manifest(JSON.stringify(manifest), '0.3.0').formatVersion).toBe(3);
    expect(parseFullBackupV3Manifest(JSON.stringify(manifest), '1.4.0').formatVersion).toBe(3);
    expect(() => parseFullBackupV3Manifest(JSON.stringify(manifest), '0.2.1'))
      .toThrow(/necesita NutrIAsta 0.3.0/);
  });

  it('rechaza tablas ausentes, inesperadas y filas con datos fuera del dataset portable', () => {
    const missing = { ...counts } as Record<string, number>;
    delete missing.trainingSets;
    expect(() => parseFullBackupV3Manifest(JSON.stringify({ ...manifest, entityCounts: missing }), '0.3.0'))
      .toThrow(/26 tablas exactas/);

    const unexpected = { ...emptyData, unexpected: [] };
    expect(() => parseFullBackupV3Data(JSON.stringify(unexpected), manifest))
      .toThrow(/26 tablas esperadas/);

    const withDataset = { ...emptyData, foods: [{ id: 'food', datasetId: 'prohibido' }] };
    expect(() => parseFullBackupV3Data(
      JSON.stringify(withDataset),
      { ...manifest, entityCounts: { ...counts, foods: 1 } },
    )).toThrow(/fila de foods/);
  });

  it('rechaza recuentos y tamaños declarados excesivos, rutas peligrosas y duplicadas', () => {
    expect(() => parseFullBackupV3Manifest(JSON.stringify({
      ...manifest,
      entityCounts: { ...counts, inventoryMovements: FULL_BACKUP_V3_LIMITS.maxRowsPerTable + 1 },
    }), '0.3.0')).toThrow(/recuento de inventoryMovements/);

    expect(() => parseFullBackupV3Manifest(JSON.stringify({
      ...manifest,
      files: [{ ...manifest.files[0], size: FULL_BACKUP_V3_LIMITS.dataBytes + 1 }],
    }), '0.3.0')).toThrow(/descriptor/);

    expect(() => parseFullBackupV3Manifest(JSON.stringify({
      ...manifest,
      files: [{ ...manifest.files[0], path: '../data.json' }],
    }), '0.3.0')).toThrow(/descriptor/);

    expect(() => parseFullBackupV3Manifest(JSON.stringify({
      ...manifest,
      files: [manifest.files[0], { ...manifest.files[0] }],
    }), '0.3.0')).toThrow(/duplicadas/);
  });

  it('rechaza identificadores duplicados y datos descomprimidos descontrolados', () => {
    const duplicate = {
      ...emptyData,
      weightEntries: [{ id: 'peso' }, { id: 'peso' }],
    };
    expect(() => parseFullBackupV3Data(
      JSON.stringify(duplicate),
      { ...manifest, entityCounts: { ...counts, weightEntries: 2 } },
    )).toThrow(/duplicados/);

    const oversizedText = 'x'.repeat(FULL_BACKUP_V3_LIMITS.dataBytes + 1);
    expect(() => parseFullBackupV3Data(oversizedText, manifest)).toThrow(/superan el límite/);
  });

  it('despacha los formatos 1, 2, 3 y 4 conocidos', () => {
    expect(identifyBackupFormat(JSON.stringify({ format: 'nutriasta-backup', formatVersion: 1 }))).toBe(1);
    expect(identifyBackupFormat(JSON.stringify({ format: 'nutriasta-full-backup', formatVersion: 2 }))).toBe(2);
    expect(identifyBackupFormat(JSON.stringify(manifest))).toBe(3);
    expect(identifyBackupFormat(JSON.stringify({
      format: 'nutriasta-full-backup',
      formatVersion: 4,
    }))).toBe(4);
    expect(() => identifyBackupFormat(JSON.stringify({
      format: 'nutriasta-full-backup',
      formatVersion: 5,
    }))).toThrow(/no es compatible/);
  });
});
