import {
  FULL_BACKUP_V3_LIMITS,
  assertFullBackupV3Relationships,
  parseFullBackupV3Data,
  parseFullBackupV3Manifest,
} from '@/backup/full-backup-v3-format';
import type {
  FullBackupDataV3,
  FullBackupManifestV3,
} from '@/backup/full-backup-v3-types';
import type {
  FullBackupDataV4,
  FullBackupManifestV4,
} from '@/backup/full-backup-v4-types';
import { textByteLength } from '@/backup/backup-format';
import { APP_VERSION } from '@/storage/schema';

export const FULL_BACKUP_V4_MANIFEST_PATH = 'manifest.json';
export const FULL_BACKUP_V4_DATA_PATH = 'data.json';
export const FULL_BACKUP_V4_MINIMUM_APP_VERSION = '0.3.3';
export const FULL_BACKUP_V4_LIMITS = FULL_BACKUP_V3_LIMITS;

const CURRENT_ORIGINS = ['manual', 'label-photo'] as const;
const ACCEPTED_STORED_ORIGINS = new Set([
  ...CURRENT_ORIGINS,
  'barcode-manual',
  'barcode-scanned',
]);
const FORBIDDEN_OCR_TEXT_FIELDS = new Set([
  'recognizedText',
  'ocrText',
  'rawOcrText',
  'recognizedLabelText',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asV3Manifest(value: Record<string, unknown>): FullBackupManifestV3 {
  const { ocrProvenance: _ocrProvenance, ...common } = value;
  return { ...common, formatVersion: 3 } as unknown as FullBackupManifestV3;
}

export function parseFullBackupV4Manifest(
  text: string,
  currentVersion = APP_VERSION,
): FullBackupManifestV4 {
  if (textByteLength(text) > FULL_BACKUP_V4_LIMITS.manifestBytes) {
    throw new Error('El manifiesto del backup formato 4 supera el límite.');
  }
  const value: unknown = JSON.parse(text);
  if (!isObject(value)
    || value.format !== 'nutriasta-full-backup'
    || value.formatVersion !== 4
    || !isObject(value.ocrProvenance)) {
    throw new Error('El manifiesto no es un backup completo de formato 4 compatible.');
  }
  const provenance = value.ocrProvenance;
  if (provenance.field !== 'foods.dataOrigin'
    || provenance.recognizedTextIncluded !== false
    || provenance.legacyValuesPreserved !== true
    || !Array.isArray(provenance.currentValues)
    || provenance.currentValues.join('|') !== CURRENT_ORIGINS.join('|')) {
    throw new Error('La trazabilidad OCR del backup formato 4 no es válida.');
  }
  parseFullBackupV3Manifest(JSON.stringify(asV3Manifest(value)), currentVersion);
  return value as unknown as FullBackupManifestV4;
}

export function parseFullBackupV4Data(
  text: string,
  manifest: FullBackupManifestV4,
): FullBackupDataV4 {
  const data = parseFullBackupV3Data(
    text,
    asV3Manifest(manifest as unknown as Record<string, unknown>),
  ) as FullBackupDataV4;
  for (const food of data.foods) {
    if (typeof food.dataOrigin !== 'string'
      || !ACCEPTED_STORED_ORIGINS.has(food.dataOrigin)) {
      throw new Error('Un alimento contiene una procedencia no válida para el formato 4.');
    }
    if (Object.keys(food).some((key) => FORBIDDEN_OCR_TEXT_FIELDS.has(key))) {
      throw new Error('El texto OCR completo no puede incluirse en el backup.');
    }
  }
  return data;
}

export function assertFullBackupV4Relationships(data: FullBackupDataV4): void {
  assertFullBackupV3Relationships(data as FullBackupDataV3);
}
