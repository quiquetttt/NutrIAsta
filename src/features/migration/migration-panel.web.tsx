import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { ActionButton, Card, SectionTitle, StatusPill, palette } from '@/components/ui';
import type { MainMigrationStatus, PreparedMainMigration } from '@/migration/migration-types';
import type { MainMigrationSession } from '@/storage/main-dataset-types';

export function MigrationPanel({
  busy,
  status,
  legacyAvailable,
  migrationAvailable,
  onPrepareLegacy,
  onPrepareBackup,
  onCancel,
  onActivate,
  onRollback,
  onReactivate,
  onConfirm,
}: {
  busy: boolean;
  status: MainMigrationStatus | null;
  legacyAvailable: boolean;
  migrationAvailable: boolean;
  onPrepareLegacy: () => Promise<void>;
  onPrepareBackup: (file: File, password: string) => Promise<void>;
  onCancel: (prepared: PreparedMainMigration) => Promise<void>;
  onActivate: (prepared: PreparedMainMigration) => Promise<void>;
  onRollback: (session: MainMigrationSession) => Promise<void>;
  onReactivate: (session: MainMigrationSession) => Promise<void>;
  onConfirm: (session: MainMigrationSession) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const passwordRef = useRef('');
  const fileRef = useRef<HTMLInputElement>(null);
  const prepared = status?.prepared ?? null;
  const session = status?.session ?? null;

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <SectionTitle eyebrow="Fase 0">Migración segura</SectionTitle>
        <StatusPill
          label={status?.activeSource === 'main' ? 'nutriasta-main' : 'nutriasta 0.1.1'}
          tone={status?.activeSource === 'main' ? 'good' : 'warning'}
        />
      </View>
      <Text selectable style={{ color: palette.muted, lineHeight: 20 }}>
        La base 0.1.1 es de solo lectura. La copia se prepara y verifica en una base paralela antes de activarla.
      </Text>
      <ActionButton
        label="Preparar copia desde 0.1.1"
        disabled={busy || !legacyAvailable || !migrationAvailable || Boolean(prepared) || Boolean(session)}
        onPress={() => void onPrepareLegacy()}
      />
      {!legacyAvailable ? (
        <Text selectable style={{ color: palette.warning, lineHeight: 19 }}>
          La base 0.1.1 no está disponible. La copia directa queda bloqueada, pero puedes preparar un backup válido sin crear una base origen vacía.
        </Text>
      ) : null}

      <View style={{ borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 14, gap: 10 }}>
        <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Recuperar desde backup de formato 1</Text>
        <TextInput
          accessibilityLabel="Contraseña del backup de migración"
          secureTextEntry
          value={password}
          onChangeText={(value) => {
            passwordRef.current = value;
            setPassword(value);
          }}
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
          label="Seleccionar backup de formato 1"
          tone="secondary"
          disabled={busy || !migrationAvailable || password.length < 8 || Boolean(prepared) || Boolean(session)}
          onPress={() => fileRef.current?.click()}
        />
        <div style={{ display: 'none' }}>
          <input
            ref={fileRef}
            aria-label="Seleccionar backup de formato 1"
            type="file"
            accept=".nutriasta,.zip,.nutriasta.zip,application/x-nutriasta-backup,application/zip"
            disabled={busy || !migrationAvailable || password.length < 8 || Boolean(prepared) || Boolean(session)}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              const passwordInput = document.querySelector<HTMLInputElement>(
                '[aria-label="Contraseña del backup de migración"]',
              );
              if (file) void onPrepareBackup(file, passwordInput?.value ?? passwordRef.current);
              event.currentTarget.value = '';
            }}
          />
        </div>
      </View>

      {prepared ? (
        <View style={{ backgroundColor: '#eef8f3', borderRadius: 16, padding: 14, gap: 9 }}>
          <Text selectable style={{ color: palette.greenDark, fontWeight: '800' }}>Candidato preparado y verificado</Text>
          <Text selectable style={{ color: palette.ink }}>
            {prepared.snapshot.records.length} registro · {prepared.snapshot.photos.length} fotografía ·{' '}
            {formatBytes(prepared.payloadBytes)}
          </Text>
          <Text selectable style={{ color: palette.muted, fontSize: 13 }}>
            Origen: {prepared.sourceKind === 'legacy-database' ? 'base 0.1.1' : 'backup formato 1'} · Huella{' '}
            {prepared.sourceFingerprint.slice(0, 12)}…
          </Text>
          <ActionButton label="Activar base paralela" disabled={busy} onPress={() => void onActivate(prepared)} />
          <ActionButton
            label="Cancelar candidato"
            tone="danger"
            disabled={busy}
            onPress={() => void onCancel(prepared)}
          />
        </View>
      ) : null}

      {session ? (
        <View style={{ backgroundColor: palette.warningBackground, borderRadius: 16, padding: 14, gap: 9 }}>
          <Text selectable style={{ color: palette.warning, fontWeight: '800' }}>
            Migración pendiente de confirmación
          </Text>
          <Text selectable style={{ color: palette.ink, lineHeight: 20 }}>
            {session.phase === 'activated'
              ? 'La base paralela está activa. La base 0.1.1 continúa intacta para rollback.'
              : 'Has vuelto a la fuente anterior. El candidato continúa disponible.'}
          </Text>
          {session.phase === 'activated' ? (
            <>
              <ActionButton label="Confirmar migración" disabled={busy} onPress={() => void onConfirm(session)} />
              <ActionButton
                label="Volver a 0.1.1"
                tone="secondary"
                disabled={busy}
                onPress={() => void onRollback(session)}
              />
            </>
          ) : (
            <ActionButton label="Reactivar base paralela" disabled={busy} onPress={() => void onReactivate(session)} />
          )}
        </View>
      ) : null}
    </Card>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  return `${(value / (1024 * 1024)).toLocaleString('es-ES', { maximumFractionDigits: 2 })} MB`;
}
