import { File } from 'node:buffer';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { afterEach, describe, expect, it } from 'vitest';

import { prepareFormat1BackupForMain } from '@/backup/import-format-1-to-main.web';
import { MINIMUM_BACKUP_APP_VERSION, textByteLength } from '@/backup/backup-format';
import { NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { MainDatasetRepository } from '@/storage/main-dataset-repository.web';
import type { BackupManifest } from '@/storage/dataset-types';
import { sha256Text } from '@/utils/crypto';

let database: NutrIAstaMainDatabase | null = null;

afterEach(async () => {
  if (database) {
    database.close();
    await database.delete();
    database = null;
  }
});

async function backupFile(filename: string) {
  const recordsJson = JSON.stringify({ records: [] });
  const manifest: BackupManifest = {
    format: 'nutriasta-backup',
    formatVersion: 1,
    minimumAppVersion: MINIMUM_BACKUP_APP_VERSION,
    backupId: 'backup-formato-1',
    exportedAt: '2026-07-22T12:00:00.000Z',
    appVersion: '0.1.1',
    sourceDatasetId: 'dataset-formato-1',
    recordCount: 0,
    photoCount: 0,
    files: [{
      path: 'records.json',
      kind: 'records',
      mimeType: 'application/json',
      size: textByteLength(recordsJson),
      checksum: await sha256Text(recordsJson),
    }],
  };
  const writer = new ZipWriter(new BlobWriter('application/x-nutriasta-backup'), {
    password: 'clave-formato-1',
    encryptionStrength: 3,
  });
  await writer.add('records.json', new TextReader(recordsJson));
  await writer.add('manifest.json', new TextReader(JSON.stringify(manifest)));
  const blob = await writer.close();
  return new File([new Uint8Array(await blob.arrayBuffer())], filename, { type: 'text/plain' }) as unknown as File;
}

describe('importación de backups de formato 1 a nutriasta-main', () => {
  it.each(['copia.nutriasta', 'copia.zip', 'copia.nutriasta.zip'])('acepta %s sin confiar en el MIME', async (name) => {
    database = new NutrIAstaMainDatabase(`format-main-${crypto.randomUUID()}`);
    const repository = new MainDatasetRepository(database);
    const prepared = await prepareFormat1BackupForMain(
      await backupFile(name) as unknown as globalThis.File,
      'clave-formato-1',
      repository,
      async () => ({ usage: 0, quota: 1024 * 1024 * 1024 }),
    );
    expect(prepared.sourceKind).toBe('format-1-backup');
    expect(prepared.snapshot.dataset.sourceBackupId).toBe('backup-formato-1');
    expect(await repository.getActiveSource()).toBe('legacy');
  });

  it('rechaza extensión y contraseña incorrectas sin activar datos', async () => {
    database = new NutrIAstaMainDatabase(`format-main-${crypto.randomUUID()}`);
    const repository = new MainDatasetRepository(database);
    await expect(prepareFormat1BackupForMain(
      await backupFile('copia.txt') as unknown as globalThis.File,
      'clave-formato-1',
      repository,
      async () => ({ usage: 0, quota: 1024 * 1024 * 1024 }),
    )).rejects.toThrow(/extensión/);
    await expect(prepareFormat1BackupForMain(
      await backupFile('copia.zip') as unknown as globalThis.File,
      'clave-incorrecta',
      repository,
      async () => ({ usage: 0, quota: 1024 * 1024 * 1024 }),
    )).rejects.toThrow();
    await repository.initialize();
    expect(await repository.getActiveSource()).toBe('legacy');
    expect(await database.datasets.count()).toBe(0);
  });
});
