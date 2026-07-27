import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { ActionButton, Card, SectionTitle, StatusPill, palette } from '@/components/ui';
import type { FullBackupStatus } from '@/backup/full-backup-types';
import { fullBackupService } from '@/backup/full-backup-service.web';

export function FullBackupPanel({ onChanged }: { onChanged: () => Promise<void> }) {
  const [password, setPassword] = useState(''); const passwordRef = useRef(''); const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<FullBackupStatus | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState<string | null>(null);
  async function refresh() { setStatus(await fullBackupService.status()); await onChanged(); }
  useEffect(() => { void refresh().catch((caught) => setError(messageFor(caught))); }, []);
  async function run(success: string, operation: () => Promise<unknown>) { setBusy(true); setError(null); try { await operation(); await refresh(); setMessage(success); } catch (caught) { setError(messageFor(caught)); } finally { setBusy(false); } }
  const prepared = status?.prepared; const session = status?.session;
  return <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><SectionTitle eyebrow="Copia local">Backup completo</SectionTitle><StatusPill label="AES-256 · formato 3" tone="good" /></View><Text selectable style={{ color: palette.muted, lineHeight: 20 }}>Incluye las 26 tablas: perfil, nutrición, entrenamientos, peso, inventario, compra, recetas y datos ficticios heredados. Puede restaurar los formatos 1, 2 y 3 mediante un candidato temporal, incluso cuando la base principal ya está activa. La contraseña no se guarda ni puede recuperarse.</Text>
    {error ? <Notice danger text={error} /> : message ? <Notice text={message} /> : null}
    <TextInput accessibilityLabel="Contraseña del backup completo" secureTextEntry value={password} onChangeText={(value) => { passwordRef.current = value; setPassword(value); }} autoCapitalize="none" autoCorrect={false} placeholder="Mínimo 8 caracteres" style={input} />
    <ActionButton label="Exportar backup completo" disabled={busy || password.length < 8 || Boolean(prepared) || Boolean(session) || Boolean(status?.blockedByOtherMigration)} onPress={() => void run('Backup completo generado. Guárdalo en “En mi iPhone”.', () => fullBackupService.download(passwordRef.current))} />
    <ActionButton tone="secondary" label="Seleccionar backup completo para restaurar" disabled={busy || password.length < 8 || Boolean(prepared) || Boolean(session) || Boolean(status?.blockedByOtherMigration)} onPress={() => fileRef.current?.click()} />
    <div style={{ display: 'none' }}><input ref={fileRef} aria-label="Archivo de backup completo" type="file" accept=".nutriasta,.zip,.nutriasta.zip,application/zip,application/x-nutriasta-backup" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void run('Candidato completo preparado y verificado. Los datos activos no han cambiado.', () => fullBackupService.prepare(file, passwordRef.current)); event.currentTarget.value = ''; }} /></div>
    <Text selectable style={{ color: status?.lastBackupAt ? palette.muted : palette.warning, fontWeight: '700' }}>Último backup completo: {status?.lastBackupAt ? new Date(status.lastBackupAt).toLocaleString('es-ES') : 'ninguno'}</Text>
    {status?.blockedByOtherMigration ? <Text selectable style={{ color: palette.warning, fontWeight: '700' }}>Confirma o revierte primero la migración de Fase 0.</Text> : null}
    {prepared ? <View style={box}>
      <Text selectable style={{ color: palette.greenDark, fontWeight: '900' }}>Paso 2 de 3 · Candidato temporal verificado</Text>
      <Text selectable style={check}>✓ Archivo descifrado localmente</Text>
      <Text selectable style={check}>✓ Formato {prepared.manifest.formatVersion} compatible</Text>
      <Text selectable style={check}>✓ Estructura, límites y checksums verificados</Text>
      <Text selectable style={{ color: palette.ink }}>{Object.values(prepared.manifest.entityCounts).reduce((sum, value) => sum + value, 0)} registros · {formatBytes(prepared.payloadBytes)} · {new Date(prepared.manifest.exportedAt).toLocaleString('es-ES')}</Text>
      <Text selectable style={{ color: palette.muted }}>{restoreSummary(prepared.manifest.entityCounts)}</Text>
      <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Tus datos actuales siguen activos y se conservarán para volver.</Text>
      <ActionButton label="Activar restauración completa" disabled={busy} onPress={() => void run('Candidato activado. El dataset anterior se conserva para rollback.', () => fullBackupService.activate(prepared))} />
      <ActionButton tone="danger" label="Cancelar candidato completo" disabled={busy} onPress={() => void run('Candidato descartado. Los datos activos no han cambiado.', () => fullBackupService.cancel(prepared))} />
    </View> : null}
    {session ? <View style={box}><Text selectable style={{ color: palette.warning, fontWeight: '900' }}>Restauración pendiente de confirmación</Text><Text selectable style={{ color: palette.ink }}>Estás viendo {session.phase === 'activated' ? 'el candidato restaurado' : 'los datos anteriores'}. El otro dataset continúa conservado.</Text>{session.phase === 'activated' ? <><ActionButton label="Confirmar restauración completa" disabled={busy} onPress={() => void run('Restauración confirmada. El dataset anterior se conserva como recuperación.', () => fullBackupService.confirm(session))} /><ActionButton tone="secondary" label="Volver a datos anteriores" disabled={busy} onPress={() => void run('Se ha vuelto atómicamente al dataset anterior.', () => fullBackupService.rollback(session))} /></> : <ActionButton label="Reactivar candidato completo" disabled={busy} onPress={() => void run('El candidato se ha reactivado.', () => fullBackupService.reactivate(session))} />}</View> : null}
  </Card>;
}
function Notice({ text, danger = false }: { text: string; danger?: boolean }) { return <View style={{ backgroundColor: danger ? palette.dangerBackground : '#eaf5ff', borderRadius: 14, padding: 12 }}><Text selectable style={{ color: danger ? palette.danger : palette.navySoft, fontWeight: '700' }}>{text}</Text></View>; }
function messageFor(value: unknown) { return value instanceof Error ? value.message : 'Se ha producido un error inesperado.'; }
function formatBytes(value: number) { return value < 1024 ? `${value} B` : `${(value / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 2 })} MB`; }
const box = { backgroundColor: palette.warningBackground, borderRadius: 16, padding: 14, gap: 9 } as const;
const check = { color: palette.greenDark, fontWeight: '800' } as const;
const input = { borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 13, color: palette.ink, backgroundColor: '#f9fbfa', fontSize: 16 } as const;
function restoreSummary(counts: Record<string, number>) {
  const meals = counts.mealEntries ?? 0;
  const sessions = counts.trainingSessions ?? 0;
  const foods = counts.foods ?? 0;
  const weights = counts.weightEntries ?? 0;
  return `${meals} comidas · ${sessions} sesiones · ${foods} alimentos · ${weights} pesos`;
}
