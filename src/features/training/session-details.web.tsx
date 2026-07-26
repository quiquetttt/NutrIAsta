import { useEffect, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';

import { ActionButton, Card, SectionTitle, palette } from '@/components/ui';
import type { ExerciseCatalogItem } from '@/mvp/training-types';
import {
  trainingDetailRepository,
  type SessionExerciseView,
} from '@/storage/training-detail-repository.web';

export function SessionDetails({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [details, setDetails] = useState<SessionExerciseView[]>([]);
  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>([]);
  const [catalogId, setCatalogId] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [nextDetails, nextCatalog] = await Promise.all([
      trainingDetailRepository.sessionDetails(sessionId),
      trainingDetailRepository.listCatalog(),
    ]);
    setDetails(nextDetails);
    setCatalog(nextCatalog);
    setCatalogId((current) => current || nextCatalog[0]?.id || '');
  }
  useEffect(() => { void refresh().catch((caught) => setError(errorMessage(caught))); }, [sessionId]);

  async function run(success: string, operation: () => Promise<void>) {
    setError(null);
    try {
      await operation();
      await refresh();
      setMessage(success);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <>
      <Card>
        <SectionTitle eyebrow="DETALLE OPCIONAL">Ejercicios y series</SectionTitle>
        <Text selectable style={{ color: palette.muted }}>Puedes dejar la sesión sin ejercicios, añadir ejercicios sin series o anotar solo las series que quieras.</Text>
        {error ? <Notice danger text={error} /> : message ? <Notice text={message} /> : null}
        {catalog.length ? (
          <View style={{ gap: 7 }}>
            <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Ejercicio guardado</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {catalog.map((item) => <Choice key={item.id} label={item.name} selected={catalogId === item.id} onPress={() => { setCatalogId(item.id); setName(''); }} />)}
            </View>
          </View>
        ) : null}
        <Field label="O crear ejercicio nuevo" value={name} onChange={(value) => { setName(value); if (value) setCatalogId(''); }} />
        <ActionButton label="Añadir ejercicio a la sesión" onPress={() => void run('Ejercicio añadido.', async () => {
          let selectedId = catalogId || undefined;
          let selectedName = name;
          if (!selectedId) {
            const created = await trainingDetailRepository.createCatalogExercise(name);
            selectedId = created.id;
            selectedName = created.name;
          }
          await trainingDetailRepository.addExercise(sessionId, { catalogExerciseId: selectedId, name: selectedName });
          setName('');
        })} />
        <ActionButton label="Cerrar ejercicios y series" tone="secondary" onPress={onClose} />
      </Card>
      {details.map((detail) => (
        <ExerciseCard detail={detail} key={detail.exercise.id} onChanged={refresh} />
      ))}
    </>
  );
}

function ExerciseCard({ detail, onChanged }: { detail: SessionExerciseView; onChanged: () => Promise<void> }) {
  const [repetitions, setRepetitions] = useState('');
  const [load, setLoad] = useState('');
  const [note, setNote] = useState('');
  const [completed, setCompleted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<Array<{ sessionDate: string; sets: Array<{ repetitions: number | null; loadKg: number | null }> }>>([]);

  async function addSet() {
    await trainingDetailRepository.addSet(detail.exercise.id, {
      repetitions: repetitions === '' ? null : Number(repetitions),
      loadKg: load === '' ? null : Number(load.replace(',', '.')),
      completed,
      note,
    });
    setRepetitions('');
    setLoad('');
    setNote('');
    setCompleted(false);
    await onChanged();
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <SectionTitle eyebrow="EJERCICIO">{detail.exercise.nameSnapshot}</SectionTitle>
        <ActionButton accessibilityLabel={`Eliminar ejercicio ${detail.exercise.nameSnapshot}`} label="Eliminar" tone="danger" onPress={() => {
          if (window.confirm(`¿Eliminar ${detail.exercise.nameSnapshot} y sus series de esta sesión?`)) {
            void trainingDetailRepository.deleteExercise(detail.exercise.id).then(onChanged);
          }
        }} />
      </View>
      {detail.sets.length === 0 ? <Text selectable style={{ color: palette.muted }}>Sin series anotadas. Esto es válido.</Text> : detail.sets.map((set, index) => (
        <View key={set.id} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <Text selectable style={{ color: palette.ink, fontWeight: '900' }}>Serie {index + 1}</Text>
          <Text selectable style={{ color: palette.muted }}>{set.repetitions ?? '—'} rep · {set.loadKg === null ? '—' : `${set.loadKg} kg`} · {set.completed ? 'Realizada' : 'Planificada'}</Text>
          <ActionButton accessibilityLabel={`Eliminar serie ${index + 1} de ${detail.exercise.nameSnapshot}`} label="Eliminar" tone="danger" onPress={() => void trainingDetailRepository.deleteSet(set.id).then(onChanged)} />
        </View>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <CompactField label="Repeticiones opcionales" value={repetitions} onChange={setRepetitions} />
        <CompactField label="Carga opcional (kg)" value={load} onChange={setLoad} />
      </View>
      <Field label="Nota de la serie" value={note} onChange={setNote} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Switch accessibilityLabel="Serie realizada" value={completed} onValueChange={setCompleted} />
        <Text selectable style={{ color: palette.ink }}>Serie realizada</Text>
      </View>
      <ActionButton label={`Añadir serie a ${detail.exercise.nameSnapshot}`} onPress={() => void addSet()} />
      {detail.exercise.catalogExerciseId ? <ActionButton label="Ver anotaciones anteriores" tone="secondary" onPress={() => void (async () => {
        if (!historyOpen) {
          const values = await trainingDetailRepository.exerciseHistory(detail.exercise.catalogExerciseId!);
          setHistory(values);
        }
        setHistoryOpen((value) => !value);
      })()} /> : null}
      {historyOpen ? (
        <View style={{ gap: 7, backgroundColor: '#f7faf8', borderRadius: 14, padding: 12 }}>
          <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Historial descriptivo, sin interpretación</Text>
          {history.length ? history.map((entry) => <Text key={`${entry.sessionDate}-${entry.sets.length}`} selectable style={{ color: palette.muted }}>{entry.sessionDate}: {entry.sets.map((set) => `${set.repetitions ?? '—'} rep / ${set.loadKg ?? '—'} kg`).join(' · ') || 'sin series'}</Text>) : <Text selectable style={{ color: palette.muted }}>No hay anotaciones anteriores.</Text>}
        </View>
      ) : null}
    </Card>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <button aria-pressed={selected} className="na-choice" onClick={onPress} type="button">{label}</button>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <View style={{ gap: 6, flexGrow: 1 }}><Text selectable style={{ color: palette.ink, fontWeight: '800' }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} style={input} /></View>;
}
function CompactField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return <View style={{ minWidth: 150, flexGrow: 1 }}><Field {...props} /></View>;
}
function Notice({ text, danger = false }: { text: string; danger?: boolean }) {
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: danger ? palette.dangerBackground : palette.mint, borderRadius: 14, padding: 12 }}><Text selectable style={{ color: danger ? palette.danger : palette.greenDark, fontWeight: '800' }}>{text}</Text></View>;
}
function errorMessage(value: unknown) { return value instanceof Error ? value.message : 'Error inesperado.'; }
const input = { minHeight: 48, borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 13, color: palette.ink, backgroundColor: '#f9fbfa', fontSize: 16 } as const;
