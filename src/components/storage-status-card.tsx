import { Text, View } from 'react-native';

import { ActionButton, Card, SectionTitle, StatusPill, palette } from '@/components/ui';
import { formatBytes, isBackupRecent } from '@/pwa/storage-status.web';
import type { StorageStatus } from '@/storage/dataset-types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
      <Text selectable style={{ color: palette.muted, flex: 1 }}>{label}</Text>
      <Text selectable style={{ color: palette.ink, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'], flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  );
}

export function StorageStatusCard({
  status,
  onRequestPersistence,
}: {
  status: StorageStatus;
  onRequestPersistence: () => void;
}) {
  const recent = isBackupRecent(status.lastBackupAt);
  const persistenceLabel = status.persisted === null ? 'No disponible' : status.persisted ? 'Persistente' : 'No persistente';
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <SectionTitle eyebrow="Estado técnico">Almacenamiento</SectionTitle>
        <StatusPill
          label={persistenceLabel}
          tone={status.persisted ? 'good' : status.persisted === false ? 'warning' : 'neutral'}
        />
      </View>
      <Row label="Uso estimado" value={formatBytes(status.usage)} />
      <Row label="Cuota estimada" value={formatBytes(status.quota)} />
      <Row
        label="Último backup"
        value={status.lastBackupAt ? new Date(status.lastBackupAt).toLocaleString('es-ES') : 'Ninguno'}
      />
      {!recent ? (
        <View style={{ backgroundColor: palette.warningBackground, borderRadius: 14, padding: 12 }}>
          <Text selectable style={{ color: palette.warning, fontWeight: '700', lineHeight: 20 }}>
            No existe una copia reciente. Safari puede eliminar almacenamiento web; crea un backup y guárdalo en “En mi iPhone”.
          </Text>
        </View>
      ) : null}
      {status.persisted === false ? (
        <ActionButton label="Solicitar almacenamiento persistente" tone="secondary" onPress={onRequestPersistence} />
      ) : null}
    </Card>
  );
}
