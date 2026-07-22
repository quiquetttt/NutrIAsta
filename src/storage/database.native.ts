export const productionPersistenceAvailable = false;

export function assertProductionPersistenceUnavailable(): never {
  throw new Error('IndexedDB solo está disponible en la PWA. Expo Go es una previsualización.');
}
