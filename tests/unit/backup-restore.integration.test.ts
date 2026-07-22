import { File } from 'node:buffer';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createEncryptedBackup } from '@/backup/export-backup.web';
import {
  BACKUP_LIMITS,
  MINIMUM_BACKUP_APP_VERSION,
  textByteLength,
} from '@/backup/backup-format';
import {
  activatePreparedRestore,
  cancelPreparedRestore,
  prepareEncryptedRestore,
} from '@/backup/restore-backup.web';
import { database } from '@/storage/database.web';
import { datasetRepository } from '@/storage/dataset-repository.web';
import type { BackupManifest } from '@/storage/dataset-types';
import { sha256Text } from '@/utils/crypto';

async function createCustomBackup(recordsJson: string, declaredSize: number): Promise<globalThis.File> {
  const manifest: BackupManifest = {
    format: 'nutriasta-backup',
    formatVersion: 1,
    minimumAppVersion: MINIMUM_BACKUP_APP_VERSION,
    backupId: 'backup-manipulado',
    exportedAt: '2026-07-22T10:00:00.000Z',
    appVersion: '0.1.0',
    sourceDatasetId: 'dataset-manipulado',
    recordCount: 0,
    photoCount: 0,
    files: [{
      path: 'records.json',
      kind: 'records',
      mimeType: 'application/json',
      size: declaredSize,
      checksum: await sha256Text(recordsJson),
    }],
  };
  const writer = new ZipWriter(new BlobWriter('application/x-nutriasta-backup'), {
    password: 'clave-correcta-123',
    encryptionStrength: 3,
  });
  await writer.add('records.json', new TextReader(recordsJson));
  await writer.add('manifest.json', new TextReader(JSON.stringify(manifest)));
  const blob = await writer.close();
  return new File([new Uint8Array(await blob.arrayBuffer())], 'manipulado.nutriasta', {
    type: blob.type,
  }) as unknown as globalThis.File;
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      storage: {
        estimate: async () => ({ usage: 0, quota: 100 * 1024 * 1024 }),
      },
    },
  });
});

afterAll(async () => {
  database.close();
  await database.delete();
});

describe('backup y restauración temporal', () => {
  it('no cambia el activo con contraseña errónea ni durante la preparación', async () => {
    await datasetRepository.initialize();
    await datasetRepository.saveTestRecord('Contenido cifrado');
    const activeBefore = await datasetRepository.getActiveDatasetId();
    const exported = await createEncryptedBackup('clave-correcta-123');
    const file = new File([new Uint8Array(await exported.blob.arrayBuffer())], exported.filename, {
      type: exported.blob.type,
    });

    await expect(
      prepareEncryptedRestore(file as unknown as globalThis.File, 'clave-erronea-123'),
    ).rejects.toThrow(/dataset activo no ha cambiado/i);
    expect(await datasetRepository.getActiveDatasetId()).toBe(activeBefore);

    const prepared = await prepareEncryptedRestore(
      file as unknown as globalThis.File,
      'clave-correcta-123',
    );
    expect(await datasetRepository.getActiveDatasetId()).toBe(activeBefore);
    expect(prepared.manifest.recordCount).toBe(1);

    await cancelPreparedRestore(prepared);
    expect(await datasetRepository.getActiveDatasetId()).toBe(activeBefore);
  });

  it('cambia el puntero solo después de activar el candidato', async () => {
    const exported = await createEncryptedBackup('clave-correcta-123');
    const file = new File([new Uint8Array(await exported.blob.arrayBuffer())], exported.filename, {
      type: exported.blob.type,
    });
    const prepared = await prepareEncryptedRestore(
      file as unknown as globalThis.File,
      'clave-correcta-123',
    );
    const session = await activatePreparedRestore(prepared);
    expect(await datasetRepository.getActiveDatasetId()).toBe(prepared.candidateDatasetId);
    expect(session.previousDatasetId).toBe(prepared.previousDatasetId);
  });

  it('rechaza tamaños declarados falsos sin modificar el dataset activo', async () => {
    const activeBefore = await datasetRepository.getActiveDatasetId();
    const recordsJson = JSON.stringify({ records: [] });
    const file = await createCustomBackup(recordsJson, textByteLength(recordsJson) + 1);

    await expect(prepareEncryptedRestore(file, 'clave-correcta-123')).rejects.toThrow(
      /dataset activo no ha cambiado/i,
    );
    expect(await datasetRepository.getActiveDatasetId()).toBe(activeBefore);
  });

  it('rechaza una entrada descomprimida por encima del límite antes de importarla', async () => {
    const activeBefore = await datasetRepository.getActiveDatasetId();
    const recordsJson = 'x'.repeat(BACKUP_LIMITS.recordsBytes + 1);
    const file = await createCustomBackup(recordsJson, textByteLength(recordsJson));

    await expect(prepareEncryptedRestore(file, 'clave-correcta-123')).rejects.toThrow(
      /dataset activo no ha cambiado/i,
    );
    expect(await datasetRepository.getActiveDatasetId()).toBe(activeBefore);
  });
});
