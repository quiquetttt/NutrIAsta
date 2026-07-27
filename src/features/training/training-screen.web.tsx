import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { ActionButton, Card, SectionTitle, palette } from '@/components/ui';
import { AccessibleDialog } from '@/components/accessible-dialog.web';
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
  type WeeklyTrainingSummary,
} from '@/storage/training-repository.web';
import { SessionDetails } from '@/features/training/session-details.web';

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
  const [summary, setSummary] = useState<WeeklyTrainingSummary>({
    monday: '', sunday: '', completed: 0, planned: 0, cancelled: 0, goal: 4, percentage: 0, fulfillmentText: '',
  });
  const [draft, setDraft] = useState<TrainingSessionDraft>(EMPTY_DRAFT);
  const [goal, setGoal] = useState(4);
  const [goalChoice, setGoalChoice] = useState<'current' | 'next'>('next');
  const [customType, setCustomType] = useState('');
  const [editingTypeId, setEditingTypeId] = useState('');
  const [showArchivedTypes, setShowArchivedTypes] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyTypeId, setHistoryTypeId] = useState('');
  const [goalReviewOpen, setGoalReviewOpen] = useState(false);
  const [copySessionId, setCopySessionId] = useState('');
  const [copyDate, setCopyDate] = useState(TODAY);
  const [editing, setEditing] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
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
      trainingRepository.listTypes(true),
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
  const completion = summary.percentage;
  const filteredHistory = useMemo(() => {
    const query = normalizeSearch(historyQuery);
    return history
      .filter((session) => !historyFrom || session.localDate >= historyFrom)
      .filter((session) => !historyTo || session.localDate <= historyTo)
      .filter((session) => !historyTypeId || session.trainingTypes.some(({ trainingTypeId }) => trainingTypeId === historyTypeId))
      .filter((session) => !query || normalizeSearch([
        session.title,
        session.note,
        ...session.trainingTypes.map(({ nameSnapshot }) => nameSnapshot),
      ].join(' ')).includes(query));
  }, [history, historyFrom, historyQuery, historyTo, historyTypeId]);

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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Text selectable style={summaryMetric}>Realizadas: {summary.completed}</Text>
          <Text selectable style={summaryMetric}>Planificadas: {summary.planned}</Text>
          <Text selectable style={summaryMetric}>Canceladas: {summary.cancelled}</Text>
          <Text selectable style={summaryMetric}>{summary.percentage}%</Text>
        </View>
        <View accessibilityLabel={`${completion} por ciento del objetivo semanal`} style={{ height: 10, overflow: 'hidden', backgroundColor: '#29435c', borderRadius: 999 }}>
          <View style={{ width: `${completion}%`, height: '100%', backgroundColor: palette.green, borderRadius: 999 }} />
        </View>
        <Text selectable style={{ color: '#fff', fontWeight: '800' }}>{summary.fulfillmentText}</Text>
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
          onPress={() => setGoalReviewOpen(true)}
        />
      </Card>

      <Card>
        <ActionButton
          label="Volver a hoy"
          tone="secondary"
          onPress={() => {
            setMonth(TODAY.slice(0, 7));
            setSelectedDate(TODAY);
            setEditing(false);
          }}
        />
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
            const states = [...new Set(values.map(({ status }) => statusLabel(status)))];
            const dayTypes = [...new Set(values.flatMap(({ trainingTypes }) => trainingTypes.map(({ nameSnapshot }) => nameSnapshot)))];
            const details = values.length ? `${states.join(', ')}; tipos: ${dayTypes.join(', ') || 'sin tipo'}` : 'sin entrenamiento';
            return (
              <button
                aria-label={`${day.localDate}: ${details}`}
                aria-selected={selectedDate === day.localDate}
                className={`na-calendar-day is-${state} ${day.inMonth ? '' : 'is-outside'}`}
                key={day.localDate}
                onClick={() => selectDay(day.localDate)}
                role="gridcell"
                type="button"
              >
                <span>{day.dayNumber}</span>
                {values.length ? <i aria-hidden="true">{values.length}</i> : null}
                {dayTypes.length ? <small aria-hidden="true">{dayTypes.slice(0, 2).join(' + ')}</small> : null}
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
              <ActionButton label={`Ejercicios y series de ${session.title || 'la sesión'}`} tone="secondary" onPress={() => setDetailSessionId(session.id)} />
              {session.status !== 'completed' ? <ActionButton label="Marcar completada" onPress={() => void run('Sesión completada.', () => trainingRepository.changeStatus(session.id, 'completed'))} /> : null}
              {session.status === 'planned' ? <ActionButton label="Cancelar sesión" tone="secondary" onPress={() => void run('Sesión cancelada.', () => trainingRepository.changeStatus(session.id, 'cancelled'))} /> : null}
              <ActionButton label="Copiar sesión" tone="secondary" onPress={() => {
                setCopySessionId(session.id);
                setCopyDate(selectedDate);
              }} />
            </View>
          </View>
        ))}
        <ActionButton label={editing ? 'Cerrar editor' : 'Añadir sesión'} tone="secondary" onPress={() => {
          setDraft({ ...EMPTY_DRAFT(), localDate: selectedDate });
          setEditing((value) => !value);
        }} />
      </Card>

      {detailSessionId ? <SessionDetails sessionId={detailSessionId} onClose={() => setDetailSessionId(null)} /> : null}

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
              {types.filter(({ archived }) => !archived).map((type) => <ChoiceButton key={type.id} label={type.name} selected={draft.trainingTypeIds.includes(type.id)} onPress={() => toggleType(type.id)} />)}
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
        <Field label={editingTypeId ? 'Renombrar tipo personalizado' : 'Nuevo tipo personalizado'} value={customType} onChange={setCustomType} />
        <ActionButton label={editingTypeId ? 'Guardar nombre del tipo' : 'Añadir tipo'} tone="secondary" onPress={() => void run(editingTypeId ? 'Tipo personalizado renombrado.' : 'Tipo personalizado añadido.', async () => {
          if (editingTypeId) await trainingRepository.renameCustomType(editingTypeId, customType);
          else await trainingRepository.addCustomType(customType);
          setCustomType('');
          setEditingTypeId('');
        })} />
        {editingTypeId ? <ActionButton label="Cancelar cambio de nombre" tone="secondary" onPress={() => { setEditingTypeId(''); setCustomType(''); }} /> : null}
        <label style={{ alignItems: 'center', color: palette.ink, display: 'flex', gap: 9 }}>
          <input checked={showArchivedTypes} onChange={(event) => setShowArchivedTypes(event.currentTarget.checked)} type="checkbox" />
          Mostrar tipos personalizados archivados
        </label>
        {types.filter(({ origin, archived }) => origin === 'custom' && (showArchivedTypes || !archived)).map((type) => (
          <View key={type.id} style={{ borderTopColor: palette.border, borderTopWidth: 1, gap: 8, paddingTop: 10 }}>
            <Text selectable style={{ color: palette.ink, fontWeight: '900' }}>{type.name}{type.archived ? ' · Archivado' : ''}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {!type.archived ? <ActionButton label={`Renombrar tipo ${type.name}`} tone="secondary" onPress={() => { setEditingTypeId(type.id); setCustomType(type.name); }} /> : null}
              <ActionButton
                label={type.archived ? `Restaurar tipo ${type.name}` : `Archivar tipo ${type.name}`}
                tone="secondary"
                onPress={() => void run(type.archived ? 'Tipo restaurado.' : 'Tipo archivado.', () => trainingRepository.setCustomTypeArchived(type.id, !type.archived))}
              />
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle eyebrow="HISTORIAL">Buscar sesiones</SectionTitle>
        <Field label="Buscar por título, nota o tipo" value={historyQuery} onChange={setHistoryQuery} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <View style={{ flexGrow: 1, minWidth: 150 }}><Field label="Desde (AAAA-MM-DD)" value={historyFrom} onChange={setHistoryFrom} /></View>
          <View style={{ flexGrow: 1, minWidth: 150 }}><Field label="Hasta (AAAA-MM-DD)" value={historyTo} onChange={setHistoryTo} /></View>
        </View>
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Filtrar por tipo</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <ChoiceButton label="Todos" selected={!historyTypeId} onPress={() => setHistoryTypeId('')} />
            {types.map((type) => <ChoiceButton key={type.id} label={type.name} selected={historyTypeId === type.id} onPress={() => setHistoryTypeId(type.id)} />)}
          </View>
        </View>
        <Text selectable style={{ color: palette.muted }}>{filteredHistory.length} resultado(s). Los nombres son instantáneas históricas.</Text>
        {filteredHistory.length === 0 ? <Text selectable style={{ color: palette.muted }}>No hay sesiones que coincidan.</Text> : filteredHistory.slice(0, 50).map((session) => (
          <button className="na-history-row" key={session.id} onClick={() => editSession(session)} type="button">
            <span><strong>{session.localDate}</strong><small>{session.title || session.trainingTypes.map(({ nameSnapshot }) => nameSnapshot).join(' + ')}</small></span>
            <StatusLabel status={session.status} />
          </button>
        ))}
      </Card>

      <AccessibleDialog
        confirmLabel="Guardar objetivo"
        description={`El objetivo será ${goalRef.current} desde el lunes ${goalEffectiveMonday(TODAY, goalChoiceRef.current)}. Las semanas anteriores no cambiarán.`}
        onCancel={() => setGoalReviewOpen(false)}
        onConfirm={() => {
          const selectedGoal = goalRef.current;
          const selectedChoice = goalChoiceRef.current;
          void run('Objetivo semanal guardado.', async () => {
            await trainingRepository.setWeeklyGoal(selectedGoal, selectedChoice);
            setGoalReviewOpen(false);
          });
        }}
        open={goalReviewOpen}
        title="Revisar objetivo semanal"
      />
      <AccessibleDialog
        confirmDisabled={!copyDate}
        confirmLabel="Crear copia independiente"
        description="La copia conservará las instantáneas de tipos y ejercicios, quedará planificada y no compartirá series con la sesión original."
        onCancel={() => setCopySessionId('')}
        onConfirm={() => {
          const sessionId = copySessionId;
          void run('Sesión copiada como planificada.', async () => {
            await trainingRepository.copySession(sessionId, copyDate);
            setCopySessionId('');
          });
        }}
        open={Boolean(copySessionId)}
        title="Copiar sesión"
      >
        <Field label="Nueva fecha de la copia (AAAA-MM-DD)" value={copyDate} onChange={setCopyDate} />
      </AccessibleDialog>
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
  const label = statusLabel(status);
  return <Text selectable style={{ color: status === 'completed' ? palette.greenDark : status === 'cancelled' ? palette.danger : palette.navySoft, fontWeight: '800' }}>{label}</Text>;
}
function Notice({ text, danger = false }: { text: string; danger?: boolean }) {
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: danger ? palette.dangerBackground : palette.mint, borderRadius: 16, padding: 14 }}><Text selectable style={{ color: danger ? palette.danger : palette.greenDark, fontWeight: '800' }}>{text}</Text></View>;
}
function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year!, month! - 1, 1)));
}
function statusLabel(status: TrainingSessionStatus) {
  return { draft: 'Borrador', planned: 'Planificada', completed: 'Completada', cancelled: 'Cancelada' }[status];
}
function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
}
function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : 'Se ha producido un error inesperado.';
}
const summaryMetric = { backgroundColor: '#29435c', borderRadius: 999, color: '#fff', fontSize: 13, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 6 } as const;
