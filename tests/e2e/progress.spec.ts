import { expect, test } from '@playwright/test';

import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

const localToday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
const tomorrow = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date(Date.now() + 86_400_000));

test('mantiene las sesiones simples y permite copiarlas sin mostrar ejercicios ni series', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Entrenar');
  await page.getByRole('gridcell', { name: new RegExp(`^${localToday}:`) }).click();
  await page.getByLabel('Título opcional').fill('Sesión simple ficticia');
  await page.getByRole('button', { name: 'Pecho', exact: true }).first().click();
  await page.getByLabel('Notas de la sesión').fill('Nota interesante ficticia');
  await page.getByRole('button', { name: 'Guardar sesión' }).click();
  await expect(page.getByText('Sesión guardada.')).toBeVisible();
  await expect(page.getByText('Nota interesante ficticia')).toBeVisible();
  await expect(page.getByRole('button', { name: /Ejercicios y series/ })).toHaveCount(0);
  await expect(page.getByText('Ejercicios reutilizables')).toHaveCount(0);

  await page.getByRole('button', { name: 'Copiar sesión' }).click();
  await page.getByLabel('Nueva fecha de la copia (AAAA-MM-DD)').fill(tomorrow);
  await page.getByRole('button', { name: 'Crear copia independiente' }).click();
  await expect(page.getByText('Sesión copiada como planificada.')).toBeVisible();
  const copyState = await page.evaluate(() => new Promise<{ copies: number; note: string | null }>((resolve, reject) => {
    const request = indexedDB.open('nutriasta-main');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('trainingSessions', 'readonly');
      const sessionsRequest = tx.objectStore('trainingSessions').getAll();
      sessionsRequest.onerror = () => reject(sessionsRequest.error);
      sessionsRequest.onsuccess = () => {
        const copies = sessionsRequest.result.filter((session) => session.origin === 'copied');
        resolve({ copies: copies.length, note: copies[0]?.note ?? null });
      };
    };
  }));
  expect(copyState).toEqual({ copies: 1, note: 'Nota interesante ficticia' });
});

test('mantiene un historial de peso neutral, editable y con alternativa textual', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Historial de peso');
  await page.getByLabel('Peso registrado (kg)').fill('70,2');
  await page.getByLabel('Nota del peso').fill('Peso ficticio de mañana');
  await page.getByRole('button', { name: 'Añadir peso' }).click();
  await expect(page.getByText('Peso guardado localmente.')).toBeVisible();

  await page.getByLabel('Peso registrado (kg)').fill('70,4');
  await page.getByLabel('Hora del peso').fill('20:00');
  await page.getByRole('button', { name: 'Añadir peso' }).click();
  await expect(page.getByRole('img', { name: /Gráfica neutral con 2 pesos/ })).toBeVisible();
  await expect(page.locator('.na-weight-chart polyline')).toHaveAttribute('stroke', '#225e85');
  await expect(page.getByText(/70,2 kg/).first()).toBeVisible();
  await expect(page.getByText(/70,4 kg/).first()).toBeVisible();

  await page.getByRole('button', { name: new RegExp(`Editar peso ${localToday}`) }).first().click();
  await page.getByLabel('Peso registrado (kg)').fill('70,1');
  await page.getByRole('button', { name: 'Guardar edición de peso' }).click();
  await expect(page.getByText(/70,1 kg/).first()).toBeVisible();

  await page.getByRole('button', { name: new RegExp(`Eliminar peso ${localToday}`) }).first().click();
  await page.getByRole('button', { name: 'Eliminar entrada' }).click();
  await expect(page.getByText('Entrada de peso eliminada.')).toBeVisible();
  await openMvpSection(page, 'Perfil y objetivos');
  await expect(page.getByLabel('Peso (kg)')).toHaveValue('70');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
