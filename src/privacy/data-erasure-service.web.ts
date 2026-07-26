import { FULL_DATA_TABLES } from '@/backup/full-backup-types';
import { mainDatabase, type NutrIAstaMainDatabase } from '@/storage/main-database.web';
import { mainDatasetRepository, type MainDatasetRepository } from '@/storage/main-dataset-repository.web';
import { MAIN_META_KEYS } from '@/storage/main-schema';
import { trackUpdateBlockingOperation, trackWrite } from '@/storage/write-tracker';

export interface ErasureSummary { datasetId: string; counts: Record<string, number>; totalRows: number; lastBackupAt: string | null; }

export class DataErasureService {
  constructor(private readonly db: NutrIAstaMainDatabase = mainDatabase, private readonly datasets: MainDatasetRepository = mainDatasetRepository) {}
  private async activeId() { await this.db.open(); const source = (await this.db.metadata.get(MAIN_META_KEYS.activeSource))?.value; const id = (await this.db.metadata.get(MAIN_META_KEYS.activeMainDatasetId))?.value; if (source !== 'main' || typeof id !== 'string') throw new Error('No existe un dataset principal activo.'); return id; }
  async summary(): Promise<ErasureSummary> { const datasetId = await this.activeId(); const counts: Record<string, number> = {}; for (const table of FULL_DATA_TABLES) counts[table] = await this.db.table(table).where('datasetId').equals(datasetId).count(); return { datasetId, counts, totalRows: Object.values(counts).reduce((sum, value) => sum + value, 0), lastBackupAt: ((await this.db.metadata.get(MAIN_META_KEYS.lastFullBackupAt))?.value as string | undefined) ?? null }; }
  async eraseActiveDataset(confirmation: string) { if (confirmation !== 'ELIMINAR') throw new Error('Escribe ELIMINAR exactamente para confirmar.'); return trackUpdateBlockingOperation(async () => { if (await this.datasets.getMigrationSession()) throw new Error('Confirma o revierte primero la restauración pendiente.'); const datasetId = await this.activeId(); const tables = FULL_DATA_TABLES.map((name) => this.db.table(name)); const now = new Date().toISOString(); await trackWrite(() => this.db.transaction('rw', [...tables, this.db.datasets], async () => { for (const table of tables) await table.where('datasetId').equals(datasetId).delete(); await this.db.datasets.update(datasetId, { recordCount: 0, photoCount: 0, payloadBytes: 0, entityCounts: Object.fromEntries(FULL_DATA_TABLES.map((table) => [table, 0])), updatedAt: now }); })); return this.summary(); }); }
}
export const dataErasureService = new DataErasureService();
