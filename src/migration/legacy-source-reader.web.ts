import { META_KEYS } from '@/storage/schema';
import type {
  DatasetMetadata,
  DatasetSnapshot,
  MetadataEntry,
  PhotoAsset,
  ViabilityRecord,
} from '@/storage/dataset-types';
import type { LegacySourceInspection } from '@/migration/migration-types';
import { sha256Blob, sha256Text } from '@/utils/crypto';

export const LEGACY_DATABASE_NAME = 'nutriasta' as const;
export const LEGACY_DATABASE_VERSION = 1 as const;
export const LEGACY_NATIVE_DATABASE_VERSION = LEGACY_DATABASE_VERSION * 10;
export const LEGACY_STORE_NAMES = ['datasets', 'metadata', 'photos', 'viabilityRecords'] as const;

interface LegacyInventory {
  metadata: MetadataEntry[];
  datasets: DatasetMetadata[];
  records: ViabilityRecord[];
  photos: PhotoAsset[];
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB no pudo completar una lectura.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('La lectura de IndexedDB ha fallado.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('La lectura de IndexedDB fue cancelada.'));
  });
}

async function openExistingLegacyDatabase(databaseName: string): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    let missing = false;
    request.onupgradeneeded = (event) => {
      missing = event.oldVersion === 0;
      request.transaction?.abort();
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      if (missing && request.error?.name === 'AbortError') resolve(null);
      else reject(request.error ?? new Error('No se pudo abrir la base 0.1.1.'));
    };
    request.onblocked = () => reject(new Error('La base 0.1.1 está bloqueada por otra pestaña.'));
  });
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object' && !(value instanceof Blob)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

async function fingerprintInventory(inventory: LegacyInventory): Promise<string> {
  const photos = [];
  for (const photo of [...inventory.photos].sort((left, right) =>
    `${left.datasetId}/${left.id}`.localeCompare(`${right.datasetId}/${right.id}`))) {
    const [blobChecksum, thumbnailChecksum] = await Promise.all([
      sha256Blob(photo.blob),
      sha256Blob(photo.thumbnail),
    ]);
    if (blobChecksum !== photo.checksum || thumbnailChecksum !== photo.thumbnailChecksum) {
      throw new Error('La base 0.1.1 contiene una fotografía cuya integridad no es válida.');
    }
    const { blob: _blob, thumbnail: _thumbnail, ...metadata } = photo;
    photos.push({ ...metadata, blobChecksum, thumbnailChecksum });
  }
  const canonical = {
    metadata: [...inventory.metadata].sort((left, right) => left.key.localeCompare(right.key)),
    datasets: [...inventory.datasets].sort((left, right) => left.id.localeCompare(right.id)),
    records: [...inventory.records].sort((left, right) =>
      `${left.datasetId}/${left.id}`.localeCompare(`${right.datasetId}/${right.id}`)),
    photos,
  };
  return sha256Text(JSON.stringify(stableValue(canonical)));
}

function payloadBytes(snapshot: DatasetSnapshot): number {
  const structured = JSON.stringify({ dataset: snapshot.dataset, records: snapshot.records });
  return new TextEncoder().encode(structured).byteLength
    + snapshot.photos.reduce((total, photo) => total + photo.blob.size + photo.thumbnail.size, 0);
}

export class LegacySourceReader {
  constructor(private readonly databaseName: string = LEGACY_DATABASE_NAME) {}

  async inspect(): Promise<LegacySourceInspection> {
    const database = await openExistingLegacyDatabase(this.databaseName);
    if (!database) throw new Error('No existe la base IndexedDB 0.1.1.');
    try {
      if (database.version !== LEGACY_NATIVE_DATABASE_VERSION) {
        throw new Error(
          `La base 0.1.1 tiene la versión nativa inesperada ${database.version}; se esperaba ${LEGACY_NATIVE_DATABASE_VERSION} (Dexie 1).`,
        );
      }
      const storeNames = Array.from(database.objectStoreNames).sort();
      if (JSON.stringify(storeNames) !== JSON.stringify([...LEGACY_STORE_NAMES])) {
        throw new Error('La base 0.1.1 no contiene exactamente las tablas aprobadas.');
      }

      const transaction = database.transaction([...LEGACY_STORE_NAMES], 'readonly');
      const completion = transactionComplete(transaction);
      const [metadata, datasets, records, photos] = await Promise.all([
        requestResult(transaction.objectStore('metadata').getAll()) as Promise<MetadataEntry[]>,
        requestResult(transaction.objectStore('datasets').getAll()) as Promise<DatasetMetadata[]>,
        requestResult(transaction.objectStore('viabilityRecords').getAll()) as Promise<ViabilityRecord[]>,
        requestResult(transaction.objectStore('photos').getAll()) as Promise<PhotoAsset[]>,
      ]);
      await completion;

      const activeDatasetId = metadata.find((entry) => entry.key === META_KEYS.activeDatasetId)?.value;
      if (typeof activeDatasetId !== 'string') throw new Error('La base 0.1.1 no declara un dataset activo.');
      const dataset = datasets.find((item) => item.id === activeDatasetId);
      if (!dataset) throw new Error('El dataset activo de 0.1.1 no existe.');
      const activeRecords = records.filter((record) => record.datasetId === activeDatasetId);
      const activePhotos = photos.filter((photo) => photo.datasetId === activeDatasetId);
      if (dataset.recordCount !== activeRecords.length || dataset.photoCount !== activePhotos.length) {
        throw new Error('Los recuentos del dataset 0.1.1 no coinciden con su contenido.');
      }
      const activeSnapshot = { dataset, records: activeRecords, photos: activePhotos };
      const inventory = { metadata, datasets, records, photos };
      return {
        databaseName: this.databaseName,
        databaseVersion: LEGACY_DATABASE_VERSION,
        storeNames,
        activeSnapshot,
        fingerprint: await fingerprintInventory(inventory),
        payloadBytes: payloadBytes(activeSnapshot),
        lastBackupAt: typeof metadata.find((entry) => entry.key === META_KEYS.lastBackupAt)?.value === 'string'
          ? metadata.find((entry) => entry.key === META_KEYS.lastBackupAt)?.value as string
          : null,
      };
    } finally {
      database.close();
    }
  }
}

export const legacySourceReader = new LegacySourceReader();
