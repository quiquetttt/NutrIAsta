import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';

import { prepareFormat1BackupForMain } from '@/backup/import-format-1-to-main.web';
import { StorageStatusCard } from '@/components/storage-status-card';
import { Card, SectionTitle, StatusPill, palette } from '@/components/ui';
import { UpdateAvailableBanner } from '@/components/update-available-banner';
import { MigrationPanel } from '@/features/migration/migration-panel';
import { legacySourceReader } from '@/migration/legacy-source-reader.web';
import { migrationService } from '@/migration/migration-service.web';
import type {
  LegacySourceInspection,
  MainMigrationStatus,
  PreparedMainMigration,
} from '@/migration/migration-types';
import { pwaUpdateController } from '@/pwa/update-controller.web';
import { readStorageStatus, requestPersistentStorage } from '@/pwa/storage-status.web';
import { APP_VERSION } from '@/storage/schema';
import type { MainMigrationSession } from '@/storage/main-dataset-types';
import type { StorageStatus } from '@/storage/dataset-types';

const EMPTY_STORAGE_STATUS: StorageStatus = {
  persisted: null,
  usage: null,
  quota: null,
  lastBackupAt: null,
};

export function ViabilityScreen() {
  const [legacy, setLegacy] = useState<LegacySourceInspection | null>(null);
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<MainMigrationStatus | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState(EMPTY_STORAGE_STATUS);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Comprobando las dos bases IndexedDB…');
  const [error, setError] = useState<string | null>(null);
  const [updateWaiting, setUpdateWaiting] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  const refresh = useCallback(async () => {
    let nextLegacy: LegacySourceInspection | null = null;
    let nextLegacyError: string | null = null;
    try {
      nextLegacy = await legacySourceReader.inspect();
    } catch (caught) {
      nextLegacyError = errorMessage(caught);
    }
    let nextMigrationStatus: MainMigrationStatus | null = null;
    let nextMigrationError: string | null = null;
    try {
      nextMigrationStatus = await migrationService.getStatus();
    } catch (caught) {
      nextMigrationError = errorMessage(caught);
    }
    const nextStorageStatus = await readStorageStatus(nextLegacy?.lastBackupAt ?? null);
    setLegacy(nextLegacy);
    setLegacyError(nextLegacyError);
    setMigrationStatus(nextMigrationStatus);
    setMigrationError(nextMigrationError);
    setStorageStatus(nextStorageStatus);
  }, []);

  useEffect(() => {
    let alive = true;
    const unsubscribe = pwaUpdateController.subscribe((worker) => setUpdateWaiting(Boolean(worker)));
    const onlineListener = () => setOnline(navigator.onLine);
    window.addEventListener('online', onlineListener);
    window.addEventListener('offline', onlineListener);
    void (async () => {
      try {
        await refresh();
        if (!alive) return;
        await pwaUpdateController.register();
        setMessage('Fase 0 lista. La base nutriasta 0.1.1 permanece en modo de solo lectura.');
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
      unsubscribe();
      window.removeEventListener('online', onlineListener);
      window.removeEventListener('offline', onlineListener);
    };
  }, [refresh]);

  const visibleData = useMemo(() => {
    if (migrationStatus?.activeSource === 'main' && migrationStatus.activeMainSnapshot) {
      return {
        source: 'nutriasta-main',
        datasetId: migrationStatus.activeMainSnapshot.dataset.id,
        records: migrationStatus.activeMainSnapshot.records,
        photos: migrationStatus.activeMainSnapshot.photos,
      };
    }
    return legacy
      ? {
          source: 'nutriasta 0.1.1',
          datasetId: legacy.activeSnapshot.dataset.id,
          records: legacy.activeSnapshot.records,
          photos: legacy.activeSnapshot.photos,
        }
      : null;
  }, [legacy, migrationStatus]);

  useEffect(() => {
    const photo = visibleData?.photos[0];
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo.thumbnail);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [visibleData]);

  const run = async (successMessage: string, operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      await refresh();
      setMessage(successMessage);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 56 }}
    >
      <View testID="viability-content" style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: 16 }}>
        <View
          style={{
            backgroundColor: palette.navy,
            borderRadius: 28,
            padding: 24,
            gap: 14,
            overflow: 'hidden',
            boxShadow: '0 18px 50px rgba(7, 26, 47, 0.16)',
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <StatusPill label="FASE 0 · MIGRACIÓN" tone="good" />
            <StatusPill label={online ? 'Online' : 'Offline'} tone={online ? 'neutral' : 'warning'} />
          </View>
          <Text selectable style={{ color: '#ffffff', fontSize: 36, lineHeight: 42, fontWeight: '900' }}>
            NutrIAsta
          </Text>
          <Text selectable style={{ color: '#d7e5ee', fontSize: 16, lineHeight: 23 }}>
            Validación local de copia segura hacia una base paralela. Utiliza exclusivamente los datos ficticios de la prueba de viabilidad.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatusPill label={`Versión ${APP_VERSION} — prueba de actualización`} />
            <StatusPill label="nutriasta · solo lectura" />
            <StatusPill label="nutriasta-main · paralela" />
          </View>
        </View>

        <UpdateAvailableBanner
          visible={updateWaiting}
          onUpdate={() => void run('Activando la actualización…', () => pwaUpdateController.activateWaitingUpdate())}
        />

        {error ? (
          <View style={{ backgroundColor: palette.dangerBackground, borderRadius: 16, padding: 14 }}>
            <Text selectable style={{ color: palette.danger, fontWeight: '700', lineHeight: 20 }}>{error}</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: '#eaf5ff', borderRadius: 16, padding: 14 }}>
            <Text selectable style={{ color: palette.navySoft, fontWeight: '700', lineHeight: 20 }}>{message}</Text>
          </View>
        )}

        <StorageStatusCard
          status={storageStatus}
          onRequestPersistence={() => void run('Solicitud de persistencia completada.', async () => {
            await requestPersistentStorage();
          })}
        />

        <MigrationPanel
          busy={busy}
          status={migrationStatus}
          legacyAvailable={Boolean(legacy)}
          migrationAvailable={!migrationError}
          onPrepareLegacy={() => run('Candidato copiado y verificado. La fuente activa no ha cambiado.', async () => {
            await migrationService.prepareFromLegacy();
          })}
          onPrepareBackup={(file, password) => run('Backup de formato 1 preparado y verificado.', async () => {
            await prepareFormat1BackupForMain(file, password);
          })}
          onCancel={(prepared: PreparedMainMigration) => run('Candidato cancelado. La fuente activa no ha cambiado.', async () => {
            await migrationService.cancel(prepared);
          })}
          onActivate={(prepared: PreparedMainMigration) => run('Base paralela activada. La base 0.1.1 sigue intacta.', async () => {
            await migrationService.activate(prepared);
          })}
          onRollback={(session: MainMigrationSession) => run('Se ha vuelto a la fuente anterior.', async () => {
            await migrationService.rollback(session);
          })}
          onReactivate={(session: MainMigrationSession) => run('La base paralela vuelve a estar activa.', async () => {
            await migrationService.reactivate(session);
          })}
          onConfirm={(session: MainMigrationSession) => run('Migración confirmada. La base 0.1.1 se conserva intacta.', async () => {
            await migrationService.confirm(session);
          })}
        />

        {legacyError ? (
          <View style={{ backgroundColor: palette.warningBackground, borderRadius: 16, padding: 14 }}>
            <Text selectable style={{ color: palette.warning, fontWeight: '700', lineHeight: 20 }}>
              Recuperación: {legacyError}
            </Text>
          </View>
        ) : null}

        {migrationError ? (
          <View style={{ backgroundColor: palette.dangerBackground, borderRadius: 16, padding: 14 }}>
            <Text selectable style={{ color: palette.danger, fontWeight: '700', lineHeight: 20 }}>
              La base paralela no está disponible. Se muestran los datos 0.1.1 en modo de recuperación y no se realizará ninguna escritura: {migrationError}
            </Text>
          </View>
        ) : null}

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <SectionTitle eyebrow="Solo lectura">Datos visibles</SectionTitle>
            <StatusPill label={visibleData?.source ?? 'Comprobando…'} />
          </View>
          <Text selectable style={{ color: palette.muted, fontSize: 13 }}>
            Dataset: {visibleData?.datasetId ?? '—'}
          </Text>
          <Text accessibilityLabel="Texto del registro ficticio" selectable style={{ color: palette.ink, lineHeight: 22 }}>
            {visibleData?.records[0]?.text ?? 'Sin registro ficticio'}
          </Text>
          {photoUrl ? (
            <Image
              accessibilityLabel="Miniatura de la fotografía de prueba"
              source={{ uri: photoUrl }}
              resizeMode="cover"
              style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: 16, backgroundColor: '#e7ece9' }}
            />
          ) : (
            <Text selectable style={{ color: palette.muted }}>Sin fotografía ficticia.</Text>
          )}
          <Text selectable style={{ color: palette.warning, fontSize: 13, lineHeight: 19 }}>
            La edición está deshabilitada durante la Fase 0 para demostrar que la base nutriasta no recibe escrituras.
          </Text>
        </Card>

        <Card>
          <SectionTitle eyebrow="Límite de la fase">Sin funciones del MVP 1</SectionTitle>
          <Text selectable style={{ color: palette.muted, lineHeight: 21 }}>
            Esta compilación local no incluye perfil, nutrición, entrenamientos, recetas, OCR, consultas externas ni datos reales. No debe desplegarse sin una autorización independiente.
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}

function errorMessage(caught: unknown): string {
  if (caught instanceof Error) {
    const cause = caught.cause instanceof Error ? ` ${caught.cause.message}` : '';
    return `${caught.message}${cause}`;
  }
  return 'Se ha producido un error inesperado.';
}
