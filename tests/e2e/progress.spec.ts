import { expect, test } from '@playwright/test';

import { openMvpSection, openMvpWithProfile } from './mvp-fixture';

const localToday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
const tomorrow = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date(Date.now() + 86_400_000));

test('registra ejercicios y series opcionales y copia con marcas reiniciadas', async ({ page }) => {
  await openMvpWithProfile(page);
  await openMvpSection(page, 'Entrenar');
  await page.getByRole('gridcell', { name: new RegExp(`^${localToday}:`) }).click();
  await page.getByLabel('Título opcional').fill('Sesión con series ficticia');
  await page.getByRole('button', { name: 'Pecho', exact: true }).first().click();
  await page.getByRole('button', { name: 'Guardar sesión' }).click();
  await expect(page.getByText('Sesión guardada.')).toBeVisible();

  await page.getByRole('button', { name: 'Ejercicios y series de Sesión con series ficticia' }).click();
  await page.getByLabel('Nombre del ejercicio').fill('Press ficticio');
  await page.getByRole('button', { name: 'Crear ejercicio del catálogo' }).click();
  await page.getByRole('button', { name: 'Añadir ejercicio a la sesión' }).click();
  await expect(page.getByText('Ejercicio añadido con una instantánea independiente.')).toBeVisible();
  await page.getByLabel('Repeticiones planificadas').fill('8');
  await page.getByLabel('Carga planificada (kg)').fill('0');
  await page.getByLabel('Repeticiones realizadas').fill('8');
  await page.getByLabel('Carga realizada (kg)').fill('0');
  await page.getByLabel('Serie realizada').setChecked(true);
  await page.getByRole('button', { name: 'Añadir serie a Press ficticio' }).click();
  await expect(page.getByText(/Plan: 8 rep \/ 0 kg · Real: 8 rep \/ 0 kg/)).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar ejercicios y series' }).click();

  await page.getByRole('button', { name: 'Copiar sesión' }).click();
  await page.getByLabel('Nueva fecha de la copia (AAAA-MM-DD)').fill(tomorrow);
  await page.getByRole('button', { name: 'Crear copia independiente' }).click();
  await expect(page.getByText('Sesión copiada como planificada.')).toBeVisible();
  const copyState = await page.evaluate(() => new Promise<{ copies: number; copiedCompleted: boolean | null }>((resolve, reject) => {
    const request = indexedDB.open('nutriasta-main');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['trainingSessions', 'trainingSessionExercises', 'trainingSets'], 'readonly');
      const sessionsRequest = tx.objectStore('trainingSessions').getAll();
      sessionsRequest.onerror = () => reject(sessionsRequest.error);
      sessionsRequest.onsuccess = () => {
        const copies = sessionsRequest.result.filter((session) => session.origin === 'copied');
        if (!copies[0]) return resolve({ copies: 0, copiedCompleted: null });
        const exercisesRequest = tx.objectStore('trainingSessionExercises').index('[datasetId+sessionId]').getAll([copies[0].datasetId, copies[0].id]);
        exercisesRequest.onerror = () => reject(exercisesRequest.error);
        exercisesRequest.onsuccess = () => {
          const exercise = exercisesRequest.result[0];
          if (!exercise) return resolve({ copies: copies.length, copiedCompleted: null });
          const setRequest = tx.objectStore('trainingSets').index('[datasetId+sessionExerciseId]').getAll([copies[0].datasetId, exercise.id]);
          setRequest.onerror = () => reject(setRequest.error);
          setRequest.onsuccess = () => resolve({ copies: copies.length, copiedCompleted: setRequest.result[0]?.completed ?? null });
        };
      };
    };
  }));
  expect(copyState).toEqual({ copies: 1, copiedCompleted: false });
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
