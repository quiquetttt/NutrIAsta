import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';

import {
  confirmRestoration,
  reactivateRestoration,
  rollbackRestoration,
} from '@/backup/dataset-activation.web';
import { downloadEncryptedBackup } from '@/backup/export-backup.web';
import {
  activatePreparedRestore,
  cancelPreparedRestore,
  prepareEncryptedRestore,
  type PreparedRestore,
} from '@/backup/restore-backup.web';
import { BackupStatusCard } from '@/components/backup-status-card';
import { StorageStatusCard } from '@/components/storage-status-card';
import { ActionButton, Card, SectionTitle, StatusPill, palette } from '@/components/ui';
import { UpdateAvailableBanner } from '@/components/update-available-banner';
import { TestPhotoInput } from '@/features/viability/test-photo-input';
import { TestRecordForm } from '@/features/viability/test-record-form';
import { pwaUpdateController } from '@/pwa/update-controller.web';
import { readStorageStatus, requestPersistentStorage } from '@/pwa/storage-status.web';
import { datasetRepository } from '@/storage/dataset-repository.web';
import { APP_VERSION } from '@/storage/schema';
import type { DatasetSnapshot, RestoreSession, StorageStatus } from '@/storage/dataset-types';

const EMPTY_STORAGE_STATUS: StorageStatus = {
  persisted: null,
  usage: null,
  quota: null,
  lastBackupAt: null,
};

export function ViabilityScreen() {
  const [snapshot, setSnapshot] = useState<DatasetSnapshot | null>(null);
  const [storageStatus, setStorageStatus] = useState(EMPTY_STORAGE_STATUS);
  const [prepared, setPrepared] = useState<PreparedRestore | null>(null);
  const [restoreSession, setRestoreSession] = useState<RestoreSession | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Inicializando IndexedDB…');
  const [error, setError] = useState<string | null>(null);
  const [updateWaiting, setUpdateWaiting] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  const refresh = useCallback(async () => {
    const [nextSnapshot, nextStatus, nextSession] = await Promise.all([
      datasetRepository.getActiveSnapshot(),
      readStorageStatus(),
      datasetRepository.getRestoreSession(),
    ]);
    setSnapshot(nextSnapshot);
    setStorageStatus(nextStatus);
    setRestoreSession(nextSession);
  }, []);

  useEffect(() => {
    let alive = true;
    const unsubscribe = pwaUpdateController.subscribe((worker) => setUpdateWaiting(Boolean(worker)));
    const onlineListener = () => setOnline(navigator.onLine);
    window.addEventListener('online', onlineListener);
    window.addEventListener('offline', onlineListener);
    void (async () => {
      try {
        await datasetRepository.initialize();
        if (!alive) return;
        await refresh();
        await pwaUpdateController.register();
        setMessage('Prueba lista. Usa únicamente datos ficticios.');
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

  useEffect(() => {
    const photo = snapshot?.photos[0];
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo.thumbnail);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [snapshot]);

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
            <StatusPill label="PRUEBA DE VIABILIDAD" tone="good" />
            <StatusPill label={online ? 'Online' : 'Offline'} tone={online ? 'neutral' : 'warning'} />
          </View>
          <Text selectable style={{ color: '#ffffff', fontSize: 36, lineHeight: 42, fontWeight: '900' }}>
            NutrIAsta
          </Text>
          <Text selectable style={{ color: '#d7e5ee', fontSize: 16, lineHeight: 23 }}>
            Validación local de instalación, persistencia, fotografía, backup y actualización. No introduzcas datos personales reales.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatusPill label={`Versión ${APP_VERSION} — prueba de actualización`} />
            <StatusPill label="IndexedDB · Dexie" />
            <StatusPill label="Sin backend" />
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

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <SectionTitle eyebrow="Dato ficticio">Registro local</SectionTitle>
            <StatusPill label={snapshot?.dataset.id.slice(-8) ?? '…'} />
          </View>
          <TestRecordForm
            record={snapshot?.records[0] ?? null}
            disabled={busy}
            onSave={(text) => run('Registro ficticio guardado en el dataset activo.', async () => {
              await datasetRepository.saveTestRecord(text);
            })}
          />
        </Card>

        <Card>
          <SectionTitle eyebrow="Dato ficticio">Fotografía de prueba</SectionTitle>
          {photoUrl ? (
            <View style={{ gap: 8 }}>
              <Image
                accessibilityLabel="Miniatura de la fotografía de prueba"
                source={{ uri: photoUrl }}
                resizeMode="cover"
                style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: 16, backgroundColor: '#e7ece9' }}
              />
              <Text selectable style={{ color: palette.greenDark, fontSize: 13 }}>
                Fotografía persistida · {snapshot?.photos[0]?.width} × {snapshot?.photos[0]?.height} px
              </Text>
            </View>
          ) : null}
          <TestPhotoInput
            disabled={busy}
            onError={(caught) => setError(errorMessage(caught))}
            onPhoto={(photo) => run('Fotografía procesada y guardada localmente.', async () => {
              await datasetRepository.saveTestPhoto(photo);
            })}
          />
        </Card>

        <BackupStatusCard
          busy={busy}
          prepared={prepared}
          session={restoreSession}
          onExport={(password) => run('Backup generado. Guárdalo en “En mi iPhone”.', async () => {
            await downloadEncryptedBackup(password);
          })}
          onPrepare={(file, password) => run('Candidato restaurado y verificado. El dataset activo no ha cambiado.', async () => {
            setPrepared(await prepareEncryptedRestore(file, password));
          })}
          onCancelPrepared={() => run('Candidato cancelado; el dataset activo no cambió.', async () => {
            if (!prepared) return;
            await cancelPreparedRestore(prepared);
            setPrepared(null);
          })}
          onActivate={() => run('Candidato activado. Los datos anteriores siguen disponibles.', async () => {
            if (!prepared) return;
            setRestoreSession(await activatePreparedRestore(prepared));
            setPrepared(null);
          })}
          onRollback={() => run('Se han reactivado los datos anteriores.', async () => {
            if (restoreSession) setRestoreSession(await rollbackRestoration(restoreSession));
          })}
          onReactivate={() => run('El candidato vuelve a estar activo.', async () => {
            if (restoreSession) setRestoreSession(await reactivateRestoration(restoreSession));
          })}
          onConfirm={() => run('Restauración confirmada. El dataset anterior se conserva como recuperación.', async () => {
            if (!restoreSession) return;
            await confirmRestoration(restoreSession);
            setRestoreSession(null);
          })}
        />

        <Card>
          <SectionTitle eyebrow="Límite de la prueba">Qué no valida esta versión</SectionTitle>
          <Text selectable style={{ color: palette.muted, lineHeight: 21 }}>
            No incluye nutrición, perfil, entrenamientos, progreso, inventario, compra, gráficas, OCR, escáner, consultas externas ni recetas. Safari puede eliminar almacenamiento web incluso si esta prueba resulta satisfactoria.
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
