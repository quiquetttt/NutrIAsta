import { describe, expect, it } from 'vitest';
import { FULL_BACKUP_DATA_PATH, parseFullBackupData, parseFullBackupManifest } from '@/backup/full-backup-format';
import { FULL_DATA_TABLES, type FullBackupManifest } from '@/backup/full-backup-types';

const counts = Object.fromEntries(FULL_DATA_TABLES.map((table) => [table, 0])) as FullBackupManifest['entityCounts'];
const manifest: FullBackupManifest = {
  format: 'nutriasta-full-backup', formatVersion: 2, minimumAppVersion: '0.2.0', appVersion: '0.2.0', backupId: 'backup-ficticio', sourceDatasetId: 'dataset-ficticio', exportedAt: '2026-07-22T12:00:00.000Z', entityCounts: counts,
  files: [{ path: FULL_BACKUP_DATA_PATH, kind: 'data', size: 2, checksum: 'a'.repeat(64), mimeType: 'application/json' }], contentFingerprint: 'b'.repeat(64),
};

describe('formato 2 de backup completo', () => {
  it('interpreta minimumAppVersion como mínimo y no como igualdad', () => {
    expect(parseFullBackupManifest(JSON.stringify(manifest), '0.3.0').formatVersion).toBe(2);
    expect(() => parseFullBackupManifest(JSON.stringify(manifest), '0.1.1')).toThrow(/necesita NutrIAsta 0.2.0/);
  });
  it('rechaza recuentos falsos, tablas inesperadas e identificadores duplicados', () => {
    expect(() => parseFullBackupManifest(JSON.stringify({ ...manifest, entityCounts: { ...counts, foods: 100_001 } }))).toThrow(/recuento de foods/);
    const data = Object.fromEntries(FULL_DATA_TABLES.map((table) => [table, []])) as Record<string, unknown>;
    data.foods = [{ id: 'duplicado' }, { id: 'duplicado' }];
    const declared = { ...manifest, entityCounts: { ...counts, foods: 2 } };
    expect(() => parseFullBackupData(JSON.stringify(data), declared)).toThrow(/duplicados/);
    data.unexpected = [];
    expect(() => parseFullBackupData(JSON.stringify(data), declared)).toThrow(/tablas esperadas/);
  });
  it('rechaza tamaños declarados excesivos y rutas duplicadas', () => {
    const huge = { ...manifest, files: [{ ...manifest.files[0]!, size: 17 * 1024 * 1024 }] };
    expect(() => parseFullBackupManifest(JSON.stringify(huge))).toThrow(/supera el límite/);
    const duplicate = { ...manifest, files: [manifest.files[0]!, { ...manifest.files[0]!, checksum: 'c'.repeat(64) }] };
    expect(() => parseFullBackupManifest(JSON.stringify(duplicate))).toThrow(/duplicadas/);
  });
});
