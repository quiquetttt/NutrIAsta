import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { readLegacyState, seedLegacyDatabase } from './legacy-fixture';

async function createFormat1Backup(path: string) {
  const recordsJson = JSON.stringify({ records: [] });
  const checksum = createHash('sha256').update(recordsJson).digest('hex');
  const manifest = {
    format: 'nutriasta-backup',
    formatVersion: 1,
    minimumAppVersion: '0.1.0',
    backupId: 'backup-e2e-formato-1',
    exportedAt: '2026-07-22T12:00:00.000Z',
    appVersion: '0.1.1',
    sourceDatasetId: 'dataset-backup-e2e',
    recordCount: 0,
    photoCount: 0,
    files: [{
      path: 'records.json',
      kind: 'records',
      mimeType: 'application/json',
      size: Buffer.byteLength(recordsJson),
      checksum,
    }],
  };
  const writer = new ZipWriter(new BlobWriter('application/x-nutriasta-backup'), {
    password: 'prueba-segura-123',
    encryptionStrength: 3,
  });
  await writer.add('records.json', new TextReader(recordsJson));
  await writer.add('manifest.json', new TextReader(JSON.stringify(manifest)));
  const blob = await writer.close();
  await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

test('rechaza contraseña errónea y cancela un backup formato 1 sin cambiar el origen', async ({ page }, testInfo) => {
  await seedLegacyDatabase(page, { text: 'contenido original protegido' });
  const before = await readLegacyState(page);
  const path = testInfo.outputPath('copia-formato-1.nutriasta.zip');
  await createFormat1Backup(path);
  await page.goto('/');
  await expect(page.getByText(/Fase 0 lista/)).toBeVisible();

  await page.getByLabel('Contraseña del backup de migración').fill('clave-incorrecta');
  await expect(page.getByRole('button', { name: 'Seleccionar backup de formato 1' })).toBeEnabled();
  await page.getByLabel('Seleccionar backup de formato 1').setInputFiles(path);
  await expect(page.getByText(/No se pudo preparar la restauración|Invalid password|contraseña/i)).toBeVisible();
  expect(await readLegacyState(page)).toEqual(before);

  await page.getByLabel('Contraseña del backup de migración').fill('prueba-segura-123');
  await expect(page.getByRole('button', { name: 'Seleccionar backup de formato 1' })).toBeEnabled();
  await page.getByLabel('Seleccionar backup de formato 1').setInputFiles(path);
  await expect(page.getByText('Candidato preparado y verificado')).toBeVisible();
  await expect(page.getByLabel('Texto del registro ficticio')).toHaveText('contenido original protegido');
  await page.getByRole('button', { name: 'Cancelar candidato' }).click();
  await expect(page.getByText(/Candidato cancelado/i)).toBeVisible();
  expect(await readLegacyState(page)).toEqual(before);
});

test('permite recuperar desde formato 1 sin recrear una base 0.1.1 ausente', async ({ page }, testInfo) => {
  await seedLegacyDatabase(page);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('nutriasta');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }));
  const path = testInfo.outputPath('recuperacion-formato-1.zip');
  await createFormat1Backup(path);
  await page.goto('/');
  await expect(page.getByText(/Fase 0 lista/)).toBeVisible();
  await expect(page.getByText(/La base 0.1.1 no está disponible/)).toBeVisible();
  await page.getByLabel('Contraseña del backup de migración').fill('prueba-segura-123');
  await expect(page.getByRole('button', { name: 'Seleccionar backup de formato 1' })).toBeEnabled();
  await page.getByLabel('Seleccionar backup de formato 1').setInputFiles(path);
  await expect(page.getByText('Candidato preparado y verificado')).toBeVisible();
  await page.getByRole('button', { name: 'Activar base paralela' }).click();
  await expect(page.getByText('nutriasta-main', { exact: true }).first()).toBeVisible();
  const databases = await page.evaluate(() => indexedDB.databases());
  expect(databases.some(({ name }) => name === 'nutriasta')).toBe(false);
});
