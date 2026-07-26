import type { Page } from '@playwright/test';
import { seedLegacyDatabase } from './legacy-fixture';

export async function openMvpWithProfile(page: Page, options: { withPhoto?: boolean } = {}) {
  await seedLegacyDatabase(page, { text: 'dato heredado ficticio', withPhoto: options.withPhoto });
  await page.goto('/');
  await page.getByRole('button', { name: 'Preparar copia desde 0.1.1' }).click();
  await page.getByRole('button', { name: 'Activar base paralela' }).click();
  await page.getByRole('button', { name: 'Confirmar migración' }).click();
  await page.getByText('Migración confirmada. La base 0.1.1 se conserva intacta.').waitFor();
  await page.reload();
  await page.getByLabel('Alias').fill('Persona ficticia');
  await page.getByLabel('Aceptar almacenamiento local').setChecked(true);
  await page.getByRole('button', { name: 'Crear perfil local' }).click();
  await page.locator('.na-nav-item:visible').filter({ hasText: /^Hoy$/ }).first().waitFor();
}

export async function openMvpSection(
  page: Page,
  section: 'Hoy' | 'Diario' | 'Alimentos' | 'Recetas' | 'Entrenar' | 'Inventario' | 'Perfil y objetivos' | 'Ajustes y privacidad',
) {
  const primary = section === 'Alimentos' || section === 'Recetas' || section === 'Diario'
    ? 'Diario'
    : section === 'Perfil y objetivos' || section === 'Ajustes y privacidad'
      ? 'Perfil'
      : section;
  await page.locator('.na-nav-item:visible').filter({ hasText: new RegExp(`^${primary}$`) }).first().click();
  if (section === 'Alimentos' || section === 'Recetas' || section === 'Diario'
    || section === 'Perfil y objetivos' || section === 'Ajustes y privacidad') {
    await page.getByRole('tab', { name: section, exact: true }).click();
  }
}
