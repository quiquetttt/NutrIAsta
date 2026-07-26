import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { ActionButton, Card, SectionTitle, palette } from '@/components/ui';
import {
  calendarMonth,
  goalEffectiveMonday,
  madridToday,
  moveMonth,
} from '@/mvp/training-date';
import type {
  TrainingSession,
  TrainingSessionStatus,
  TrainingType,
} from '@/mvp/training-types';
import {
  trainingRepository,
  type TrainingSessionDraft,
} from '@/storage/training-repository.web';

const TODAY = madridToday();
const EMPTY_DRAFT = (): TrainingSessionDraft => ({
  status: 'planned',
  localDate: TODAY,
  title: '',
  note: '',
  trainingTypeIds: [],
});

export function TrainingScreen() {
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [history, setHistory] = useState<TrainingSession[]>([]);
  const [types, setTypes] = useState<TrainingType[]>([]);
  const [summary, setSummary] = useState({ monday: '', sunday: '', completed: 0, goal: 4 });
  const [draft, setDraft] = useState<TrainingSessionDraft>(EMPTY_DRAFT);
  const [goal, setGoal] = useState(4);
  const [goalChoice, setGoalChoice] = useState<'current' | 'next'>('next');
  const [customType, setCustomType] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const goalTouched = useRef(false);
  const goalRef = useRef(4);
  const goalChoiceRef = useRef<'current' | 'next'>('next');

  async function refresh() {
    await trainingRepository.initialize();
    const days = calendarMonth(month);
    const [nextSessions, nextHistory, nextTypes, nextSummary] = await Promise.all([
      trainingRepository.listSessions(days[0]!.localDate, days.at(-1)!.localDate),
      trainingRepository.listHistory(),
      trainingRepository.listTypes(),
      trainingRepository.weeklySummary(TODAY),
    ]);
    setSessions(nextSessions);
    setHistory(nextHistory);
    setTypes(nextTypes);
    setSummary(nextSummary);
    if (!goalTouched.current) {
      setGoal(nextSummary.goal);
      goalRef.current = nextSummary.goal;
    }
  }

  useEffect(() => {
    void refresh().catch((caught) => setError(errorMessage(caught)));
  }, [month]);

  async function run(success: string, operation: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await operation();
      await refresh();
      setMessage(success);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const days = useMemo(() => calendarMonth(month), [month]);
  const byDate = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();
    for (const session of sessions) map.set(session.localDate, [...(map.get(session.localDate) ?? []), session]);
    return map;
  }, [sessions]);
  const selectedSessions = byDate.get(selectedDate) ?? [];
  const effectiveDate = goalEffectiveMonday(TODAY, goalChoice);
  const completion = Math.min(100, Math.round((summary.completed / Math.max(1, summary.goal)) * 100));

  function selectDay(localDate: string) {
    setSelectedDate(localDate);
    setDraft({ ...EMPTY_DRAFT(), localDate });
    setEditing(true);
  }

  function editSession(session: TrainingSession) {
    setDraft({
      id: session.id,
      status: session.status,
      localDate: session.localDate,
      startTime: session.startTime,
      durationMinutes: session.durationMinutes,
      title: session.title,
      note: session.note,
      trainingTypeIds: session.trainingTypes.map(({ trainingTypeId }) => trainingTypeId),
    });
    setSelectedDate(session.localDate);
    setEditing(true);
  }

  function toggleType(id: string) {
    setDraft((current) => ({
      ...current,
      trainingTypeIds: current.trainingTypeIds.includes(id)
        ? current.trainingTypeIds.filter((candidate) => candidate !== id)
        : [...current.trainingTypeIds, id],
    }));
  }

  return (
    <>
      {error ? <Notice text={error} danger /> : message ? <Notice text={message} /> : null}
      <Card style={{ backgroundColor: palette.navy, borderColor: palette.navy }}>
        <SectionTitle eyebrow="SEMANA ACTUAL"><Text style={{ color: '#fff' }}>Objetivo: {summary.completed} de {summary.goal}</Text></SectionTitle>
        <Text selectable style={{ color: '#d7e5ee' }}>{summary.monday} a {summary.sunday} · cada sesión completada cuenta una vez.</Text>
        <View accessibilityLabel={`${completion} por ciento del objetivo semanal`} style={{ height: 10, overflow: 'hidden', backgroundColor: '#29435c', borderRadius: 999 }}>
          <View style={{ width: `${completion}%`, height: '100%', backgroundColor: palette.green, borderRadius: 999 }} />
        </View>
      </Card>

      <Card>
        <SectionTitle eyebrow="OBJETIVO SEMANAL">Cambiar desde un lunes</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((value) => (
            <ChoiceButton key={value} label={String(value)} selected={goal === value} onPress={() => {
              goalTouched.current = true;
              goalRef.current = value;
              setGoal(value);
            }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <ChoiceButton label="Esta semana" selected={goalChoice === 'current'} onPress={() => {
            goalChoiceRef.current = 'current';
            setGoalChoice('current');
          }} />
          <ChoiceButton label="Semana siguiente" selected={goalChoice === 'next'} onPress={() => {
            goalChoiceRef.current = 'next';
            setGoalChoice('next');
          }} />
        </View>
        <Text selectable style={{ color: palette.ink }}>Fecha efectiva exacta: <Text style={{ fontWeight: '900' }}>{effectiveDate}</Text></Text>
        <Text selectable style={{ color: palette.muted }}>Las semanas anteriores nunca se reinterpretan.</Text>
        <ActionButton
          disabled={busy}
          label="Guardar objetivo semanal"
          onPress={() => {
            const selectedGoal = goalRef.current;
            const selectedChoice = goalChoiceRef.current;
            const selectedDate = goalEffectiveMonday(TODAY, selectedChoice);
            if (!window.confirm(`El objetivo será ${selectedGoal} desde el lunes ${selectedDate}. Las semanas anteriores no cambiarán. ¿Continuar?`)) return;
            void run('Objetivo semanal guardado.', async () => { await trainingRepository.setWeeklyGoal(selectedGoal, selectedChoice); });
          }}
        />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <ActionButton accessibilityLabel="Mes anterior" label="‹" tone="secondary" onPress={() => setMonth((value) => moveMonth(value, -1))} />
          <SectionTitle eyebrow="CALENDARIO">{monthLabel(month)}</SectionTitle>
          <ActionButton accessibilityLabel="Mes siguiente" label="›" tone="secondary" onPress={() => setMonth((value) => moveMonth(value, 1))} />
        </View>
        <div className="na-calendar" role="grid">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label) => <span aria-hidden="true" className="na-calendar-weekday" key={label}>{label}</span>)}
          {days.map((day) => {
            const values = byDate.get(day.localDate) ?? [];
            const completed = values.some(({ status }) => status === 'completed');
            const planned = values.some(({ status }) => status === 'planned');
            const cancelled = values.some(({ status }) => status === 'cancelled');
            const state = completed ? 'completed' : planned ? 'planned' : cancelled ? 'cancelled' : 'empty';
            return (
              <button
                aria-label={`${day.localDate}: ${calendarStateLabel(state)}`}
                aria-selected={selectedDate === day.localDate}
                className={`na-calendar-day is-${state} ${day.inMonth ? '' : 'is-outside'}`}
                key={day.localDate}
                onClick={() => selectDay(day.localDate)}
                role="gridcell"
                type="button"
              >
                <span>{day.dayNumber}</span>
                {values.length ? <i aria-hidden="true">{values.length}</i> : null}
              </button>
            );
          })}
        </div>
        <div className="na-calendar-legend">
          <span><i className="is-completed" />Completada</span>
          <span><i className="is-planned" />Planificada</span>
          <span><i className="is-cancelled" />Cancelada</span>
        </div>
      </Card>

      <Card>
        <SectionTitle eyebrow={selectedDate}>Sesiones del día</SectionTitle>
        {selectedSessions.length === 0 ? <Text selectable style={{ color: palette.muted }}>No hay sesiones. Puedes planificar una o registrar un entrenamiento no planificado.</Text> : selectedSessions.map((session) => (
          <View key={session.id} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 16, padding: 14, gap: 9 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Text selectable style={{ color: palette.ink, fontSize: 17, fontWeight: '900' }}>{session.title || session.trainingTypes.map(({ nameSnapshot }) => nameSnapshot).join(' + ')}</Text>
              <StatusLabel status={session.status} />
            </View>
            <Text selectable style={{ color: palette.muted }}>{session.trainingTypes.map(({ nameSnapshot }) => nameSnapshot).join(' · ')}</Text>
            {session.note ? <Text selectable style={{ color: palette.ink }}>{session.note}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <ActionButton label="Editar sesión" tone="secondary" onPress={() => editSession(session)} />
              {session.status !== 'completed' ? <ActionButton label="Marcar completada" onPress={() => void run('Sesión completada.', () => trainingRepository.changeStatus(session.id, 'completed'))} /> : null}
              {session.status === 'planned' ? <ActionButton label="Cancelar sesión" tone="secondary" onPress={() => void run('Sesión cancelada.', () => trainingRepository.changeStatus(session.id, 'cancelled'))} /> : null}
              <ActionButton label="Copiar sesión" tone="secondary" onPress={() => {
                const date = window.prompt('Nueva fecha de la copia (AAAA-MM-DD)', selectedDate);
                if (date) void run('Sesión copiada como planificada.', async () => { await trainingRepository.copySession(session.id, date); });
              }} />
            </View>
          </View>
        ))}
        <ActionButton label={editing ? 'Cerrar editor' : 'Añadir sesión'} tone="secondary" onPress={() => {
          setDraft({ ...EMPTY_DRAFT(), localDate: selectedDate });
          setEditing((value) => !value);
        }} />
      </Card>

      {editing ? (
        <Card>
          <SectionTitle eyebrow={draft.id ? 'EDITAR' : 'NUEVA SESIÓN'}>Contenido de la sesión</SectionTitle>
          <Field label="Fecha de la sesión" value={draft.localDate} onChange={(value) => setDraft({ ...draft, localDate: value })} />
          <Field label="Título opcional" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} />
          <View style={{ gap: 8 }}>
            <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Estado</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <ChoiceButton label="Planificada" selected={draft.status === 'planned'} onPress={() => setDraft({ ...draft, status: 'planned' })} />
              <ChoiceButton label="Completada" selected={draft.status === 'completed'} onPress={() => setDraft({ ...draft, status: 'completed' })} />
              <ChoiceButton label="Borrador" selected={draft.status === 'draft'} onPress={() => setDraft({ ...draft, status: 'draft' })} />
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Tipos (puedes elegir varios)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {types.map((type) => <ChoiceButton key={type.id} label={type.name} selected={draft.trainingTypeIds.includes(type.id)} onPress={() => toggleType(type.id)} />)}
            </View>
          </View>
          <Field label="Hora opcional (HH:MM)" value={draft.startTime ?? ''} onChange={(value) => setDraft({ ...draft, startTime: value || undefined })} />
          <Field label="Duración opcional (minutos)" value={draft.durationMinutes ? String(draft.durationMinutes) : ''} onChange={(value) => setDraft({ ...draft, durationMinutes: value ? Number(value) : undefined })} />
          <Field label="Notas de la sesión" value={draft.note} onChange={(value) => setDraft({ ...draft, note: value })} multiline />
          <ActionButton disabled={busy} label="Guardar sesión" onPress={() => void run('Sesión guardada.', async () => {
            const saved = await trainingRepository.saveSession(draft);
            setSelectedDate(saved.localDate);
            setEditing(false);
          })} />
        </Card>
      ) : null}

      <Card>
        <SectionTitle eyebrow="PERSONALIZACIÓN">Tipos de entrenamiento</SectionTitle>
        <Text selectable style={{ color: palette.muted }}>Los nueve tipos iniciales se guardan localmente. Puedes añadir tipos propios; archivar no cambia sesiones anteriores.</Text>
        <Field label="Nuevo tipo personalizado" value={customType} onChange={setCustomType} />
        <ActionButton label="Añadir tipo" tone="secondary" onPress={() => void run('Tipo personalizado añadido.', async () => {
          await trainingRepository.addCustomType(customType);
          setCustomType('');
        })} />
      </Card>

      <Card>
        <SectionTitle eyebrow="HISTORIAL">Sesiones recientes</SectionTitle>
        {history.length === 0 ? <Text selectable style={{ color: palette.muted }}>Todavía no hay sesiones guardadas.</Text> : history.slice(0, 20).map((session) => (
          <button className="na-history-row" key={session.id} onClick={() => editSession(session)} type="button">
            <span><strong>{session.localDate}</strong><small>{session.title || session.trainingTypes.map(({ nameSnapshot }) => nameSnapshot).join(' + ')}</small></span>
            <StatusLabel status={session.status} />
          </button>
        ))}
      </Card>
    </>
  );
}

export function TrainingTodayCard({ onOpen }: { onOpen: () => void }) {
  const [summary, setSummary] = useState<{ completed: number; goal: number } | null>(null);
  const [todaySessions, setTodaySessions] = useState<TrainingSession[]>([]);
  useEffect(() => {
    void (async () => {
      await trainingRepository.initialize();
      const [nextSummary, nextSessions] = await Promise.all([
        trainingRepository.weeklySummary(TODAY),
        trainingRepository.listSessions(TODAY, TODAY),
      ]);
      setSummary(nextSummary);
      setTodaySessions(nextSessions);
    })();
  }, []);
  return (
    <Card>
      <SectionTitle eyebrow="ENTRENAMIENTO">Esta semana</SectionTitle>
      <Text selectable style={{ color: palette.ink, fontSize: 24, fontWeight: '900' }}>{summary?.completed ?? 0} de {summary?.goal ?? 4}</Text>
      <Text selectable style={{ color: palette.muted }}>{todaySessions.length ? `${todaySessions.length} sesión o sesiones hoy.` : 'Hoy no hay una sesión planificada. Puedes añadir una sin problema.'}</Text>
      <ActionButton label="Abrir entrenamiento" tone="secondary" onPress={onOpen} />
    </Card>
  );
}

function ChoiceButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <button aria-pressed={selected} className="na-choice" onClick={onPress} type="button">{label}</button>;
}
function Field({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <View style={{ gap: 6 }}><Text selectable style={{ color: palette.ink, fontWeight: '800' }}>{label}</Text><TextInput accessibilityLabel={label} multiline={multiline} value={value} onChangeText={onChange} style={{ minHeight: multiline ? 96 : 48, borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 13, color: palette.ink, backgroundColor: '#f9fbfa', fontSize: 16, textAlignVertical: multiline ? 'top' : 'center' }} /></View>;
}
function StatusLabel({ status }: { status: TrainingSessionStatus }) {
  const label = { draft: 'Borrador', planned: 'Planificada', completed: 'Completada', cancelled: 'Cancelada' }[status];
  return <Text selectable style={{ color: status === 'completed' ? palette.greenDark : status === 'cancelled' ? palette.danger : palette.navySoft, fontWeight: '800' }}>{label}</Text>;
}
function Notice({ text, danger = false }: { text: string; danger?: boolean }) {
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: danger ? palette.dangerBackground : palette.mint, borderRadius: 16, padding: 14 }}><Text selectable style={{ color: danger ? palette.danger : palette.greenDark, fontWeight: '800' }}>{text}</Text></View>;
}
function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year!, month! - 1, 1)));
}
function calendarStateLabel(value: string) {
  return value === 'completed' ? 'entrenamiento completado' : value === 'planned' ? 'entrenamiento planificado' : value === 'cancelled' ? 'entrenamiento cancelado' : 'sin entrenamiento';
}
function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : 'Se ha producido un error inesperado.';
}
