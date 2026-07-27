import { useEffect, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';

import { AccessibleDialog } from '@/components/accessible-dialog.web';
import { ActionButton, Card, SectionTitle, palette } from '@/components/ui';
import type { ExerciseCatalogItem, TrainingSet, TrainingType } from '@/mvp/training-types';
import {
  trainingDetailRepository,
  type SessionExerciseView,
  type TrainingSetInput,
} from '@/storage/training-detail-repository.web';
import { trainingRepository } from '@/storage/training-repository.web';

const EMPTY_CATALOG = {
  id: '',
  name: '',
  note: '',
  primaryTrainingTypeId: '',
  secondaryTrainingTypeIds: [] as string[],
};

export function SessionDetails({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [details, setDetails] = useState<SessionExerciseView[]>([]);
  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>([]);
  const [types, setTypes] = useState<TrainingType[]>([]);
  const [catalogId, setCatalogId] = useState('');
  const [sessionNote, setSessionNote] = useState('');
  const [catalogDraft, setCatalogDraft] = useState(EMPTY_CATALOG);
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleteExercise, setDeleteExercise] = useState<SessionExerciseView | null>(null);

  async function refresh() {
    const [nextDetails, nextCatalog, nextTypes] = await Promise.all([
      trainingDetailRepository.sessionDetails(sessionId),
      trainingDetailRepository.listCatalog(showArchived),
      trainingRepository.listTypes(true),
    ]);
    setDetails(nextDetails);
    setCatalog(nextCatalog);
    setTypes(nextTypes);
    const active = nextCatalog.filter(({ archived }) => !archived);
    setCatalogId((current) => current && active.some(({ id }) => id === current) ? current : active[0]?.id ?? '');
  }
  useEffect(() => { void refresh().catch((caught) => setError(errorMessage(caught))); }, [sessionId, showArchived]);

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

  function editCatalog(item: ExerciseCatalogItem) {
    setCatalogDraft({
      id: item.id,
      name: item.name,
      note: item.note,
      primaryTrainingTypeId: item.primaryTrainingTypeId ?? '',
      secondaryTrainingTypeIds: item.secondaryTrainingTypeIds,
    });
  }

  async function saveCatalog() {
    const saved = await trainingDetailRepository.saveCatalogExercise({
      name: catalogDraft.name,
      note: catalogDraft.note,
      primaryTrainingTypeId: catalogDraft.primaryTrainingTypeId || undefined,
      secondaryTrainingTypeIds: catalogDraft.secondaryTrainingTypeIds,
    }, catalogDraft.id || undefined);
    setCatalogDraft(EMPTY_CATALOG);
    setCatalogId(saved.id);
  }

  return (
    <>
      <Card>
        <SectionTitle eyebrow="DETALLE OPCIONAL">Ejercicios y series</SectionTitle>
        <Text selectable style={{ color: palette.muted }}>Puedes dejar la sesión sin ejercicios, añadir ejercicios sin series o anotar solo las series que quieras.</Text>
        {error ? <Notice danger text={error} /> : message ? <Notice text={message} /> : null}
        {catalog.filter(({ archived }) => !archived).length ? (
          <ChoiceGroup
            label="Ejercicio guardado"
            options={catalog.filter(({ archived }) => !archived).map(({ id, name }) => [id, name])}
            selected={catalogId}
            onSelect={setCatalogId}
          />
        ) : <Text selectable style={{ color: palette.muted }}>Crea un ejercicio en el catálogo para añadirlo.</Text>}
        <Field label="Nota para este ejercicio en la sesión" value={sessionNote} onChange={setSessionNote} />
        <ActionButton
          disabled={!catalogId}
          label="Añadir ejercicio a la sesión"
          onPress={() => void run('Ejercicio añadido con una instantánea independiente.', async () => {
            const selected = catalog.find(({ id }) => id === catalogId);
            if (!selected) throw new Error('Selecciona un ejercicio activo.');
            await trainingDetailRepository.addExercise(sessionId, {
              catalogExerciseId: selected.id,
              name: selected.name,
              note: sessionNote,
            });
            setSessionNote('');
          })}
        />
        <ActionButton label="Cerrar ejercicios y series" tone="secondary" onPress={onClose} />
      </Card>

      {details.map((detail) => (
        <ExerciseCard
          detail={detail}
          key={detail.exercise.id}
          onDelete={() => setDeleteExercise(detail)}
          onChanged={refresh}
        />
      ))}

      <Card>
        <SectionTitle eyebrow="CATÁLOGO LOCAL">Ejercicios reutilizables</SectionTitle>
        <Text selectable style={{ color: palette.muted }}>Nombre, tipos y nota pueden cambiar; las sesiones anteriores conservan sus nombres y notas guardados.</Text>
        <Field label="Nombre del ejercicio" value={catalogDraft.name} onChange={(name) => setCatalogDraft({ ...catalogDraft, name })} />
        <ChoiceGroup
          label="Tipo principal opcional"
          options={[['', 'Sin tipo principal'], ...types.filter(({ archived }) => !archived).map(({ id, name }) => [id, name])]}
          selected={catalogDraft.primaryTrainingTypeId}
          onSelect={(primaryTrainingTypeId) => setCatalogDraft({ ...catalogDraft, primaryTrainingTypeId })}
        />
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Tipos secundarios opcionales</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {types.filter(({ archived }) => !archived).map((type) => (
              <Choice
                key={type.id}
                label={type.name}
                selected={catalogDraft.secondaryTrainingTypeIds.includes(type.id)}
                onPress={() => setCatalogDraft({
                  ...catalogDraft,
                  secondaryTrainingTypeIds: catalogDraft.secondaryTrainingTypeIds.includes(type.id)
                    ? catalogDraft.secondaryTrainingTypeIds.filter((id) => id !== type.id)
                    : [...catalogDraft.secondaryTrainingTypeIds, type.id],
                })}
              />
            ))}
          </View>
        </View>
        <Field label="Nota del catálogo" value={catalogDraft.note} onChange={(note) => setCatalogDraft({ ...catalogDraft, note })} />
        <ActionButton label={catalogDraft.id ? 'Guardar ejercicio del catálogo' : 'Crear ejercicio del catálogo'} onPress={() => void run('Catálogo actualizado.', saveCatalog)} />
        {catalogDraft.id ? <ActionButton label="Cancelar edición del catálogo" tone="secondary" onPress={() => setCatalogDraft(EMPTY_CATALOG)} /> : null}
        <label style={{ alignItems: 'center', color: palette.ink, display: 'flex', gap: 9 }}>
          <input checked={showArchived} onChange={(event) => setShowArchived(event.currentTarget.checked)} type="checkbox" />
          Mostrar ejercicios archivados
        </label>
        {catalog.map((item) => (
          <View key={item.id} style={{ borderTopColor: palette.border, borderTopWidth: 1, gap: 8, paddingTop: 10 }}>
            <Text selectable style={{ color: palette.ink, fontWeight: '900' }}>{item.name}{item.archived ? ' · Archivado' : ''}</Text>
            <Text selectable style={{ color: palette.muted }}>{catalogTypeText(item, types)}{item.note ? ` · ${item.note}` : ''}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {!item.archived ? <ActionButton label={`Editar catálogo ${item.name}`} tone="secondary" onPress={() => editCatalog(item)} /> : null}
              <ActionButton
                label={item.archived ? `Restaurar catálogo ${item.name}` : `Archivar catálogo ${item.name}`}
                tone="secondary"
                onPress={() => void run(item.archived ? 'Ejercicio restaurado.' : 'Ejercicio archivado.', () => trainingDetailRepository.setCatalogExerciseArchived(item.id, !item.archived))}
              />
            </View>
          </View>
        ))}
      </Card>

      <AccessibleDialog
        confirmLabel="Eliminar ejercicio"
        danger
        description={deleteExercise ? `Se eliminarán ${deleteExercise.exercise.nameSnapshot} y sus series solo de esta sesión. El catálogo y otras sesiones no cambiarán.` : ''}
        onCancel={() => setDeleteExercise(null)}
        onConfirm={() => {
          if (!deleteExercise) return;
          void run('Ejercicio eliminado de la sesión.', () => trainingDetailRepository.deleteExercise(deleteExercise.exercise.id))
            .then(() => setDeleteExercise(null));
        }}
        open={Boolean(deleteExercise)}
        title="Eliminar ejercicio de la sesión"
      />
    </>
  );
}

function ExerciseCard({ detail, onChanged, onDelete }: { detail: SessionExerciseView; onChanged: () => Promise<void>; onDelete: () => void }) {
  const [draft, setDraft] = useState<SetDraft>(EMPTY_SET);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<Array<{ sessionDate: string; sets: TrainingSet[] }>>([]);

  function editSet(set: TrainingSet) {
    setEditingId(set.id);
    setDraft({
      plannedRepetitions: textValue(set.plannedRepetitions ?? set.repetitions),
      plannedLoadKg: textValue(set.plannedLoadKg ?? set.loadKg),
      actualRepetitions: textValue(set.actualRepetitions ?? (set.completed ? set.repetitions : null)),
      actualLoadKg: textValue(set.actualLoadKg ?? (set.completed ? set.loadKg : null)),
      completed: set.completed,
      note: set.note,
    });
  }

  async function saveSet() {
    const input = setInput(draft);
    if (editingId) await trainingDetailRepository.updateSet(editingId, input);
    else await trainingDetailRepository.addSet(detail.exercise.id, input);
    setEditingId(null);
    setDraft(EMPTY_SET);
    await onChanged();
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <SectionTitle eyebrow="EJERCICIO">{detail.exercise.nameSnapshot}</SectionTitle>
        <ActionButton accessibilityLabel={`Eliminar ejercicio ${detail.exercise.nameSnapshot}`} label="Eliminar" tone="danger" onPress={onDelete} />
      </View>
      {detail.exercise.note ? <Text selectable style={{ color: palette.muted }}>{detail.exercise.note}</Text> : null}
      {detail.sets.length === 0 ? <Text selectable style={{ color: palette.muted }}>Sin series anotadas. Esto es válido.</Text> : detail.sets.map((set, index) => (
        <View key={set.id} style={{ borderBottomColor: palette.border, borderBottomWidth: 1, gap: 8, paddingVertical: 9 }}>
          <Text selectable style={{ color: palette.ink, fontWeight: '900' }}>Serie {index + 1} · {set.completed ? 'Realizada' : 'Planificada'}</Text>
          <Text selectable style={{ color: palette.muted }}>
            Plan: {displaySetValue(set.plannedRepetitions ?? set.repetitions, 'rep')} / {displaySetValue(set.plannedLoadKg ?? set.loadKg, 'kg')}
            {' · '}Real: {displaySetValue(set.actualRepetitions ?? (set.completed ? set.repetitions : null), 'rep')} / {displaySetValue(set.actualLoadKg ?? (set.completed ? set.loadKg : null), 'kg')}
          </Text>
          {set.note ? <Text selectable style={{ color: palette.ink }}>{set.note}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <ActionButton label={`Editar serie ${index + 1} de ${detail.exercise.nameSnapshot}`} tone="secondary" onPress={() => editSet(set)} />
            <ActionButton label={`Eliminar serie ${index + 1} de ${detail.exercise.nameSnapshot}`} tone="danger" onPress={() => void trainingDetailRepository.deleteSet(set.id).then(onChanged)} />
          </View>
        </View>
      ))}
      <Text selectable style={{ color: palette.ink, fontWeight: '900' }}>{editingId ? 'Editar serie' : 'Nueva serie opcional'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <CompactField label="Repeticiones planificadas" value={draft.plannedRepetitions} onChange={(value) => setDraft({ ...draft, plannedRepetitions: value })} />
        <CompactField label="Carga planificada (kg)" value={draft.plannedLoadKg} onChange={(value) => setDraft({ ...draft, plannedLoadKg: value })} />
        <CompactField label="Repeticiones realizadas" value={draft.actualRepetitions} onChange={(value) => setDraft({ ...draft, actualRepetitions: value })} />
        <CompactField label="Carga realizada (kg)" value={draft.actualLoadKg} onChange={(value) => setDraft({ ...draft, actualLoadKg: value })} />
      </View>
      <Field label="Nota de la serie" value={draft.note} onChange={(note) => setDraft({ ...draft, note })} />
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
        <Switch accessibilityLabel="Serie realizada" value={draft.completed} onValueChange={(completed) => setDraft({ ...draft, completed })} />
        <Text selectable style={{ color: palette.ink }}>Serie realizada</Text>
      </View>
      <ActionButton label={editingId ? 'Guardar cambios de serie' : `Añadir serie a ${detail.exercise.nameSnapshot}`} onPress={() => void saveSet()} />
      {editingId ? <ActionButton label="Cancelar edición de serie" tone="secondary" onPress={() => { setEditingId(null); setDraft(EMPTY_SET); }} /> : null}
      {detail.exercise.catalogExerciseId ? <ActionButton label="Ver anotaciones anteriores" tone="secondary" onPress={() => void (async () => {
        if (!historyOpen) setHistory(await trainingDetailRepository.exerciseHistory(detail.exercise.catalogExerciseId!));
        setHistoryOpen((value) => !value);
      })()} /> : null}
      {historyOpen ? (
        <View style={{ backgroundColor: '#f7faf8', borderRadius: 14, gap: 7, padding: 12 }}>
          <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Historial descriptivo, sin interpretación</Text>
          {history.length ? history.map((entry) => (
            <Text key={`${entry.sessionDate}-${entry.sets.length}`} selectable style={{ color: palette.muted }}>
              {entry.sessionDate}: {entry.sets.map((set) => `${displaySetValue(set.actualRepetitions ?? set.repetitions, 'rep')} / ${displaySetValue(set.actualLoadKg ?? set.loadKg, 'kg')}`).join(' · ') || 'sin series'}
            </Text>
          )) : <Text selectable style={{ color: palette.muted }}>No hay anotaciones anteriores.</Text>}
        </View>
      ) : null}
    </Card>
  );
}

type SetDraft = {
  plannedRepetitions: string;
  plannedLoadKg: string;
  actualRepetitions: string;
  actualLoadKg: string;
  completed: boolean;
  note: string;
};
const EMPTY_SET: SetDraft = { plannedRepetitions: '', plannedLoadKg: '', actualRepetitions: '', actualLoadKg: '', completed: false, note: '' };

function setInput(value: SetDraft): TrainingSetInput {
  return {
    plannedRepetitions: numberOrNull(value.plannedRepetitions),
    plannedLoadKg: numberOrNull(value.plannedLoadKg),
    actualRepetitions: numberOrNull(value.actualRepetitions),
    actualLoadKg: numberOrNull(value.actualLoadKg),
    completed: value.completed,
    note: value.note,
  };
}
function numberOrNull(value: string) { return value.trim() === '' ? null : Number(value.replace(',', '.')); }
function textValue(value: number | null | undefined) { return value === null || value === undefined ? '' : String(value); }
function displaySetValue(value: number | null | undefined, unit: string) { return value === null || value === undefined ? '—' : `${value} ${unit}`; }
function catalogTypeText(item: ExerciseCatalogItem, types: TrainingType[]) {
  const names = [item.primaryTrainingTypeId, ...item.secondaryTrainingTypeIds]
    .map((id) => types.find((type) => type.id === id)?.name)
    .filter(Boolean);
  return names.length ? names.join(' · ') : 'Sin tipos';
}
function ChoiceGroup({ label, options, selected, onSelect }: { label: string; options: string[][]; selected: string; onSelect: (value: string) => void }) {
  return <View style={{ gap: 7 }}><Text selectable style={{ color: palette.ink, fontWeight: '800' }}>{label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.map(([value, text]) => <Choice key={value} label={text!} selected={selected === value} onPress={() => onSelect(value!)} />)}</View></View>;
}
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <button aria-pressed={selected} className="na-choice" onClick={onPress} type="button">{label}</button>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <View style={{ flexGrow: 1, gap: 6 }}><Text selectable style={{ color: palette.ink, fontWeight: '800' }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} style={input} /></View>;
}
function CompactField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return <View style={{ flexGrow: 1, minWidth: 150 }}><Field {...props} /></View>;
}
function Notice({ text, danger = false }: { text: string; danger?: boolean }) {
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: danger ? palette.dangerBackground : palette.mint, borderRadius: 14, padding: 12 }}><Text selectable style={{ color: danger ? palette.danger : palette.greenDark, fontWeight: '800' }}>{text}</Text></View>;
}
function errorMessage(value: unknown) { return value instanceof Error ? value.message : 'Error inesperado.'; }
const input = { backgroundColor: '#f9fbfa', borderColor: palette.border, borderRadius: 14, borderWidth: 1, color: palette.ink, fontSize: 16, minHeight: 48, padding: 13 } as const;
