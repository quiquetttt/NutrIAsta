export async function unavailableMigrationOperation(): Promise<never> {
  throw new Error('La migración IndexedDB solo está disponible en la PWA.');
}
