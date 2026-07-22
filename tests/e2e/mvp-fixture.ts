import type { Page } from '@playwright/test';
import { seedLegacyDatabase } from './legacy-fixture';

export async function openMvpWithProfile(page: Page) {
  await seedLegacyDatabase(page, { text: 'dato heredado ficticio' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Preparar copia desde 0.1.1' }).click();
  await page.getByRole('button', { name: 'Activar base paralela' }).click();
  await page.getByRole('button', { name: 'Confirmar migración' }).click();
  await page.getByText('Migración confirmada. La base 0.1.1 se conserva intacta.').waitFor();
  await page.reload();
  await page.getByLabel('Alias').fill('Persona ficticia');
  await page.getByLabel('Aceptar almacenamiento local').setChecked(true);
  await page.getByRole('button', { name: 'Crear perfil local' }).click();
}
