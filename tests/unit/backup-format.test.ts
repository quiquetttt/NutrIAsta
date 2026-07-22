import { describe, expect, it } from 'vitest';

import {
  BACKUP_LIMITS,
  assertBackupAppCompatibility,
  assertValidPassword,
  compareVersions,
  parseBackupManifest,
  parseRecordsPayload,
} from '@/backup/backup-format';
import type { BackupManifest } from '@/storage/dataset-types';

function validManifest(overrides: Partial<BackupManifest> = {}): BackupManifest {
  return {
    format: 'nutriasta-backup',
    formatVersion: 1,
    minimumAppVersion: '0.1.0',
    backupId: 'backup-test',
    exportedAt: '2026-07-22T10:00:00.000Z',
    appVersion: '0.1.0',
    sourceDatasetId: 'dataset-test',
    recordCount: 0,
    photoCount: 0,
    files: [
      {
        path: 'records.json',
        kind: 'records',
        mimeType: 'application/json',
        size: 14,
        checksum: 'a'.repeat(64),
      },
    ],
    ...overrides,
  };
}

describe('formato de backup', () => {
  it('rechaza contraseñas demasiado cortas', () => {
    expect(() => assertValidPassword('corta')).toThrow(/8 caracteres/);
  });

  it('compara versiones numéricas sin exigir igualdad exacta', () => {
    expect(compareVersions('0.2.0', '0.1.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.9', '1.1.0')).toBe(-1);
    expect(() => assertBackupAppCompatibility('0.1.0', '0.2.0')).not.toThrow();
    expect(() => assertBackupAppCompatibility('0.2.0', '0.1.0')).toThrow(/necesita NutrIAsta 0.2.0/);
    expect(() => compareVersions('v1.0', '1.0.0')).toThrow(/mayor\.menor\.parche/);
  });

  it('acepta en una versión posterior un manifiesto cuyo mínimo es anterior', () => {
    const manifest = parseBackupManifest(JSON.stringify(validManifest()), '0.4.0');
    expect(manifest.backupId).toBe('backup-test');
  });

  it('rechaza tamaños declarados excesivos y rutas duplicadas', () => {
    const oversized = validManifest({
      files: [
        {
          path: 'records.json',
          kind: 'records',
          mimeType: 'application/json',
          size: BACKUP_LIMITS.recordsBytes + 1,
          checksum: 'a'.repeat(64),
        },
      ],
    });
    expect(() => parseBackupManifest(JSON.stringify(oversized))).toThrow(/tamaño declarado/);

    const duplicate = validManifest({ files: [...validManifest().files, ...validManifest().files] });
    expect(() => parseBackupManifest(JSON.stringify(duplicate))).toThrow(/rutas duplicadas/);
  });

  it('rechaza registros que no sean el fixture previsto o superen el límite', () => {
    expect(() => parseRecordsPayload(JSON.stringify({ records: [{ id: 'personal' }] }))).toThrow();
    expect(() => parseRecordsPayload(JSON.stringify({
      records: [{
        id: 'registro-prueba-001',
        text: 'x'.repeat(BACKUP_LIMITS.maxRecordTextCharacters + 1),
        createdAt: '2026-07-22T10:00:00.000Z',
        updatedAt: '2026-07-22T10:00:00.000Z',
      }],
    }))).toThrow(/registro no válido/);
  });
});
