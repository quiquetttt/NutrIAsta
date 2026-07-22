import type { Page } from '@playwright/test';

export async function seedLegacyDatabase(
  page: Page,
  { text = 'registro ficticio E2E', withPhoto = false } = {},
) {
  await page.goto('/__e2e__/blank');
  await page.addInitScript(() => {
    const estimate = async () => ({ usage: 2 * 1024 * 1024, quota: 1024 * 1024 * 1024 });
    if (!navigator.storage) {
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { estimate, persisted: async () => false, persist: async () => false },
      });
    } else if (!navigator.storage.estimate) {
      Object.defineProperty(navigator.storage, 'estimate', { configurable: true, value: estimate });
    }
  });
  await page.evaluate(async ({ fixtureText, includePhoto }) => {
    const deleteDatabase = (name: string) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error(`No se pudo limpiar ${name}.`));
    });
    await deleteDatabase('nutriasta-main');
    await deleteDatabase('nutriasta');

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('nutriasta', 10);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('metadata', { keyPath: 'key' });
        const datasets = db.createObjectStore('datasets', { keyPath: 'id' });
        datasets.createIndex('state', 'state');
        datasets.createIndex('createdAt', 'createdAt');
        const records = db.createObjectStore('viabilityRecords', { keyPath: ['datasetId', 'id'] });
        records.createIndex('datasetId', 'datasetId');
        records.createIndex('updatedAt', 'updatedAt');
        const photos = db.createObjectStore('photos', { keyPath: ['datasetId', 'id'] });
        photos.createIndex('datasetId', 'datasetId');
        photos.createIndex('createdAt', 'createdAt');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const sha256 = async (blob: Blob) => {
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    };
    const datasetId = 'dataset-e2e-legacy';
    const now = '2026-07-22T12:00:00.000Z';
    const blob = includePhoto ? new Blob(['foto ficticia E2E'], { type: 'image/jpeg' }) : null;
    const thumbnail = includePhoto ? new Blob(['miniatura ficticia E2E'], { type: 'image/jpeg' }) : null;
    const checksum = blob ? await sha256(blob) : null;
    const thumbnailChecksum = thumbnail ? await sha256(thumbnail) : null;
    const transaction = database.transaction(['metadata', 'datasets', 'viabilityRecords', 'photos'], 'readwrite');
    transaction.objectStore('metadata').put({ key: 'activeDatasetId', value: datasetId });
    transaction.objectStore('metadata').put({ key: 'lastBackupAt', value: now });
    transaction.objectStore('datasets').put({
      id: datasetId,
      state: 'active',
      source: 'new',
      createdAt: now,
      updatedAt: now,
      recordCount: 1,
      photoCount: includePhoto ? 1 : 0,
    });
    transaction.objectStore('viabilityRecords').put({
      datasetId,
      id: 'registro-prueba-001',
      text: fixtureText,
      createdAt: now,
      updatedAt: now,
    });
    if (blob && thumbnail && checksum && thumbnailChecksum) {
      transaction.objectStore('photos').put({
        datasetId,
        id: 'foto-prueba-001',
        blob,
        thumbnail,
        mimeType: 'image/jpeg',
        width: 640,
        height: 480,
        size: blob.size,
        checksum,
        thumbnailChecksum,
        createdAt: now,
      });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { fixtureText: text, includePhoto: withPhoto });
}

export async function readLegacyState(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('nutriasta');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction(['metadata', 'datasets', 'viabilityRecords', 'photos'], 'readonly');
      const schema = Array.from(transaction.objectStoreNames).sort().map((storeName) => {
        const store = transaction.objectStore(storeName);
        return {
          name: store.name,
          keyPath: store.keyPath,
          autoIncrement: store.autoIncrement,
          indexes: Array.from(store.indexNames).sort().map((indexName) => {
            const index = store.index(indexName);
            return {
              name: index.name,
              keyPath: index.keyPath,
              unique: index.unique,
              multiEntry: index.multiEntry,
            };
          }),
        };
      });
      const readAll = <T>(store: string) => new Promise<T[]>((resolve, reject) => {
        const request = transaction.objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      });
      const [metadata, datasets, records, photos] = await Promise.all([
        readAll<Record<string, unknown>>('metadata'),
        readAll<Record<string, unknown>>('datasets'),
        readAll<Record<string, unknown>>('viabilityRecords'),
        readAll<Record<string, unknown>>('photos'),
      ]);
      return {
        nativeVersion: database.version,
        stores: Array.from(database.objectStoreNames).sort(),
        schema,
        metadata,
        datasets,
        records,
        photos: photos.map(({ blob, thumbnail, ...photo }) => ({
          ...photo,
          blobSize: (blob as Blob).size,
          thumbnailSize: (thumbnail as Blob).size,
        })),
      };
    } finally {
      database.close();
    }
  });
}
