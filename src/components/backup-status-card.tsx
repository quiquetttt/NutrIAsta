import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import type { PreparedRestore } from '@/backup/restore-backup.web';
import { ActionButton, Card, SectionTitle, StatusPill, palette } from '@/components/ui';
import type { RestoreSession } from '@/storage/dataset-types';

export function BackupStatusCard({
  busy,
  prepared,
  session,
  onExport,
  onPrepare,
  onCancelPrepared,
  onActivate,
  onRollback,
  onReactivate,
  onConfirm,
}: {
  busy: boolean;
  prepared: PreparedRestore | null;
  session: RestoreSession | null;
  onExport: (password: string) => Promise<void>;
  onPrepare: (file: File, password: string) => Promise<void>;
  onCancelPrepared: () => Promise<void>;
  onActivate: () => Promise<void>;
  onRollback: () => Promise<void>;
  onReactivate: () => Promise<void>;
  onConfirm: () => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const passwordReady = password.length >= 8;

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <SectionTitle eyebrow="Recuperación">Backup cifrado</SectionTitle>
        <StatusPill label="AES-256" tone="good" />
      </View>
      <Text selectable style={{ color: palette.muted, lineHeight: 20 }}>
        La contraseña no se guarda ni puede recuperarse. En iPhone, conserva el archivo descargado en “En mi iPhone”.
      </Text>
      <TextInput
        accessibilityLabel="Contraseña del backup"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="Contraseña de al menos 8 caracteres"
        placeholderTextColor="#87939b"
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 14,
          padding: 14,
          color: palette.ink,
          backgroundColor: '#f9fbfa',
          fontSize: 16,
        }}
      />
      <ActionButton
        label="Exportar backup"
        disabled={busy || !passwordReady}
        onPress={() => void onExport(password)}
      />
      <ActionButton
        label="Seleccionar backup para restaurar"
        tone="secondary"
        disabled={busy || !passwordReady || Boolean(prepared) || Boolean(session)}
        onPress={() => fileRef.current?.click()}
      />
      <div style={{ display: 'none' }}>
        <input
          ref={fileRef}
          aria-label="Seleccionar archivo de backup"
          type="file"
          accept=".nutriasta,application/x-nutriasta-backup,application/zip"
          disabled={busy || !passwordReady || Boolean(prepared) || Boolean(session)}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void onPrepare(file, password);
            event.currentTarget.value = '';
          }}
        />
      </div>

      {prepared ? (
        <View style={{ backgroundColor: '#eef8f3', borderRadius: 16, padding: 14, gap: 9 }}>
          <Text selectable style={{ color: palette.greenDark, fontWeight: '800' }}>Candidato verificado</Text>
          <Text selectable style={{ color: palette.ink }}>
            {prepared.manifest.recordCount} registro · {prepared.manifest.photoCount} fotografía ·{' '}
            {new Date(prepared.manifest.exportedAt).toLocaleString('es-ES')}
          </Text>
          <Text selectable style={{ color: palette.muted, fontSize: 13 }}>
            El dataset activo todavía no ha cambiado.
          </Text>
          <ActionButton label="Activar candidato" disabled={busy} onPress={() => void onActivate()} />
          <ActionButton label="Cancelar y eliminar candidato" tone="danger" disabled={busy} onPress={() => void onCancelPrepared()} />
        </View>
      ) : null}

      {session ? (
        <View style={{ backgroundColor: palette.warningBackground, borderRadius: 16, padding: 14, gap: 9 }}>
          <Text selectable style={{ color: palette.warning, fontWeight: '800' }}>
            Restauración pendiente de confirmación
          </Text>
          <Text selectable style={{ color: palette.ink, lineHeight: 20 }}>
            {session.phase === 'activated'
              ? 'El candidato está activo y los datos anteriores continúan disponibles para rollback.'
              : 'Has vuelto a los datos anteriores. El candidato sigue disponible.'}
          </Text>
          {session.phase === 'activated' ? (
            <>
              <ActionButton label="Confirmar restauración" disabled={busy} onPress={() => void onConfirm()} />
              <ActionButton label="Volver a datos anteriores" tone="secondary" disabled={busy} onPress={() => void onRollback()} />
            </>
          ) : (
            <ActionButton label="Volver a activar el candidato" disabled={busy} onPress={() => void onReactivate()} />
          )}
        </View>
      ) : null}
    </Card>
  );
}
