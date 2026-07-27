import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { ActionButton, Card, SectionTitle, palette } from '@/components/ui';
import { AccessibleDialog } from '@/components/accessible-dialog.web';
import { madridToday } from '@/mvp/training-date';
import type { WeightEntry } from '@/mvp/weight-types';
import { weightRepository, type WeightDraft } from '@/storage/weight-repository.web';

const nowTime = () => new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' }).format(new Date());
const emptyDraft = (): WeightDraft => ({ localDate: madridToday(), localTime: nowTime(), weightKg: 70, note: '' });

export function WeightScreen() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [draft, setDraft] = useState<WeightDraft>(emptyDraft);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copyReviewOpen, setCopyReviewOpen] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<WeightEntry | null>(null);

  async function refresh() { setEntries(await weightRepository.list()); }
  useEffect(() => { void refresh().catch((caught) => setError(errorMessage(caught))); }, []);
  async function run(success: string, operation: () => Promise<void>) {
    setError(null);
    try { await operation(); await refresh(); setMessage(success); }
    catch (caught) { setError(errorMessage(caught)); }
  }
  const chronological = useMemo(() => [...entries].reverse(), [entries]);

  return (
    <>
      <Card>
        <SectionTitle eyebrow="PROGRESO CORPORAL">Historial de peso</SectionTitle>
        <Text selectable style={{ color: palette.muted }}>Registro descriptivo y local. La gráfica no interpreta tendencias, composición corporal ni estado de salud.</Text>
        {error ? <Notice danger text={error} /> : message ? <Notice text={message} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Field label="Fecha del peso" value={draft.localDate} onChange={(value) => setDraft({ ...draft, localDate: value })} />
          <Field label="Hora del peso" value={draft.localTime} onChange={(value) => setDraft({ ...draft, localTime: value })} />
        </View>
        <Field label="Peso registrado (kg)" value={String(draft.weightKg)} onChange={(value) => setDraft({ ...draft, weightKg: Number(value.replace(',', '.')) || 0 })} />
        <Field label="Nota del peso" value={draft.note} onChange={(value) => setDraft({ ...draft, note: value })} />
        <ActionButton label={draft.id ? 'Guardar edición de peso' : 'Añadir peso'} onPress={() => void run('Peso guardado localmente.', async () => {
          await weightRepository.save(draft);
          setDraft(emptyDraft());
        })} />
        <ActionButton label="Copiar el peso actual del perfil" tone="secondary" onPress={() => setCopyReviewOpen(true)} />
      </Card>

      <Card>
        <SectionTitle eyebrow="VISTA NEUTRAL">Gráfica de peso</SectionTitle>
        <WeightChart entries={chronological} />
        <Text selectable style={{ color: palette.muted }}>Alternativa textual:</Text>
        {chronological.length ? chronological.map((entry) => <Text key={entry.id} selectable style={{ color: palette.ink }}>{entry.localDate} a las {entry.localTime}: {entry.weightKg.toLocaleString('es-ES')} kg{entry.note ? ` · ${entry.note}` : ''}</Text>) : <Text selectable style={{ color: palette.muted }}>Todavía no hay pesos registrados.</Text>}
      </Card>

      <Card>
        <SectionTitle eyebrow="HISTORIAL">Entradas guardadas</SectionTitle>
        {entries.map((entry) => (
          <View key={entry.id} style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: 10, gap: 7 }}>
            <Text selectable style={{ color: palette.ink, fontWeight: '900' }}>{entry.weightKg.toLocaleString('es-ES')} kg</Text>
            <Text selectable style={{ color: palette.muted }}>{entry.localDate} · {entry.localTime} · {entry.origin === 'profile-copy' ? 'copia manual del perfil' : 'manual'}</Text>
            {entry.note ? <Text selectable style={{ color: palette.ink }}>{entry.note}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <ActionButton label={`Editar peso ${entry.localDate} ${entry.localTime}`} tone="secondary" onPress={() => setDraft({ id: entry.id, localDate: entry.localDate, localTime: entry.localTime, weightKg: entry.weightKg, note: entry.note, origin: entry.origin })} />
              <ActionButton label={`Eliminar peso ${entry.localDate} ${entry.localTime}`} tone="danger" onPress={() => setDeleteEntry(entry)} />
            </View>
          </View>
        ))}
      </Card>
      <AccessibleDialog
        confirmLabel="Copiar peso del perfil"
        description={`Se creará una entrada nueva para ${draft.localDate} a las ${draft.localTime}. El perfil no cambiará.`}
        onCancel={() => setCopyReviewOpen(false)}
        onConfirm={() => void run('Peso copiado manualmente desde el perfil.', async () => {
          await weightRepository.copyFromProfile(draft.localDate, draft.localTime);
          setCopyReviewOpen(false);
        })}
        open={copyReviewOpen}
        title="Revisar copia del peso"
      />
      <AccessibleDialog
        confirmLabel="Eliminar entrada"
        danger
        description={deleteEntry ? `Se eliminará la entrada de ${deleteEntry.weightKg.toLocaleString('es-ES')} kg del ${deleteEntry.localDate}. El perfil no cambiará.` : ''}
        onCancel={() => setDeleteEntry(null)}
        onConfirm={() => {
          if (!deleteEntry) return;
          void run('Entrada de peso eliminada.', async () => {
            await weightRepository.delete(deleteEntry.id);
            setDeleteEntry(null);
          });
        }}
        open={Boolean(deleteEntry)}
        title="Eliminar entrada de peso"
      />
    </>
  );
}

function WeightChart({ entries }: { entries: WeightEntry[] }) {
  if (entries.length < 2) return <div className="na-weight-empty">Añade al menos dos entradas para dibujar una línea.</div>;
  const values = entries.map(({ weightKg }) => weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = entries.map((entry, index) => {
    const x = 18 + (index / Math.max(1, entries.length - 1)) * 264;
    const y = 112 - ((entry.weightKg - min) / span) * 82;
    return { x, y, entry };
  });
  return (
    <svg aria-label={`Gráfica neutral con ${entries.length} pesos entre ${min} y ${max} kg`} className="na-weight-chart" role="img" viewBox="0 0 300 135">
      <path d="M18 112H282M18 30V112" stroke="#dce5df" strokeWidth="1" />
      <polyline fill="none" points={points.map(({ x, y }) => `${x},${y}`).join(' ')} stroke="#225e85" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      {points.map(({ x, y, entry }) => <circle key={entry.id} cx={x} cy={y} fill="#4d98c7" r="4" stroke="#071a2f" strokeWidth="1.5" />)}
    </svg>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <View style={{ gap: 6, minWidth: 140, flexGrow: 1 }}><Text selectable style={{ color: palette.ink, fontWeight: '800' }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} style={input} /></View>;
}
function Notice({ text, danger = false }: { text: string; danger?: boolean }) {
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: danger ? palette.dangerBackground : palette.mint, borderRadius: 14, padding: 12 }}><Text selectable style={{ color: danger ? palette.danger : palette.greenDark, fontWeight: '800' }}>{text}</Text></View>;
}
function errorMessage(value: unknown) { return value instanceof Error ? value.message : 'Error inesperado.'; }
const input = { minHeight: 48, borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 13, color: palette.ink, backgroundColor: '#f9fbfa', fontSize: 16 } as const;
