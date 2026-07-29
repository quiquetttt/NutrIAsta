import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Text, TextInput, View } from 'react-native';

import { AccessibleDialog } from '@/components/accessible-dialog.web';
import { ActionButton, Card, SectionTitle, StatusPill, palette } from '@/components/ui';
import { LabelPhotoCapture } from '@/features/foods/label-photo-capture.web';
import type { ProcessedFoodLabel } from '@/features/foods/food-photo-processing.web';
import {
  canSaveLabelReview,
  optionalNutritionNumber,
  parseNutritionNumber,
  type EditableNutritionValues,
} from '@/features/foods/label-review-validation';
import type { FoodDraft } from '@/mvp/food-types';
import { LocalNutritionOcr } from '@/ocr/local-ocr-engine.web';
import type { DetectionStatus, NutritionBasis, NutritionColumn, NutritionFieldKey, NutritionLabelResult, OcrProgress } from '@/ocr/nutrition-label-types';
import { foodRepository } from '@/storage/food-repository.web';

type Stage = 'capture' | 'processing' | 'result' | 'review';
type EditableValues = EditableNutritionValues;
const FIELD_ORDER: NutritionFieldKey[] = ['energyKj', 'energyKcal', 'fatG', 'carbohydratesG', 'proteinG'];
const LABELS: Record<NutritionFieldKey, string> = {
  energyKj: 'Energía (kJ) · opcional', energyKcal: 'Calorías (kcal) · obligatorio', fatG: 'Grasas (g) · opcional',
  carbohydratesG: 'Hidratos de carbono (g) · obligatorio', proteinG: 'Proteínas (g) · obligatorio',
};

export function LabelOcrFlow({ onCancel, onManual, onSaved }: {
  onCancel: () => void; onManual: () => void; onSaved: () => Promise<void>;
}) {
  const [stage, setStage] = useState<Stage>('capture');
  const [busy, setBusy] = useState(false);
  const [processed, setProcessed] = useState<ProcessedFoodLabel | null>(null);
  const [editablePhoto, setEditablePhoto] = useState<File | null>(null);
  const [result, setResult] = useState<NutritionLabelResult | null>(null);
  const [progress, setProgress] = useState<OcrProgress>({ status: 'Esperando fotografía', progress: null });
  const [error, setError] = useState<string | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState('');
  const [reviewBasis, setReviewBasis] = useState<NutritionBasis>('unknown');
  const [values, setValues] = useState<EditableValues>(emptyValues());
  const [corrected, setCorrected] = useState<Set<NutritionFieldKey>>(new Set());
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [supermarket, setSupermarket] = useState('');
  const [portionAmount, setPortionAmount] = useState('');
  const [portionUnit, setPortionUnit] = useState<'g' | 'ml'>('g');
  const [confirming, setConfirming] = useState(false);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ocrRef = useRef<LocalNutritionOcr | null>(null);
  useEffect(() => () => { abortRef.current?.abort(); ocrRef.current?.cancel(); }, []);
  const selectedColumn = result?.columns.find(({ id }) => id === selectedColumnId) ?? null;
  const photoUrl = useBlobUrl(processed?.photo.blob);
  const warnings = useMemo(() => reviewWarnings(result, selectedColumn, reviewBasis, values, portionAmount), [result, selectedColumn, reviewBasis, values, portionAmount]);

  async function recognize(next: ProcessedFoodLabel) {
    setProcessed(next); setStage('processing'); setBusy(true); setError(null);
    const controller = new AbortController(); const engine = new LocalNutritionOcr();
    abortRef.current = controller; ocrRef.current = engine;
    try {
      const detected = await engine.recognize(next.ocrBlob, setProgress, controller.signal);
      setResult(detected);
      const preferred = detected.columns.find(({ basis }) => basis === 'per-100-g' || basis === 'per-100-ml') ?? detected.columns[0]!;
      selectColumn(preferred, detected); setStage('result');
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setError('Procesamiento cancelado. No se ha guardado ningún dato.'); setStage('capture'); setProcessed(null);
      } else {
        setError(caught instanceof Error ? caught.message : 'No se pudo reconocer la etiqueta.'); setStage('result');
      }
    } finally {
      setBusy(false); abortRef.current = null; ocrRef.current = null;
    }
  }

  function selectColumn(column: NutritionColumn, source = result) {
    if (!source) return;
    const next = emptyValues();
    for (const key of FIELD_ORDER) {
      const detected = source.values.find((value) => value.columnId === column.id && value.key === key);
      next[key] = detected?.value === null || detected?.value === undefined ? '' : String(detected.value).replace('.', ',');
    }
    setSelectedColumnId(column.id); setValues(next); setCorrected(new Set());
    setReviewBasis(column.basis);
    setPortionAmount(column.portionAmount ? String(column.portionAmount).replace('.', ',') : '');
    setPortionUnit(column.portionUnit ?? 'g');
  }

  function cancelProcessing() {
    abortRef.current?.abort(); ocrRef.current?.cancel(); setProgress({ status: 'Cancelando', progress: null });
  }

  async function prepareConfirmation() {
    const normalized = normalizeName(name);
    const possible = (await foodRepository.list({ includeArchived: true })).find((food) => {
      const existing = normalizeName(food.name);
      return existing === normalized || (normalized.length >= 5 && (existing.includes(normalized) || normalized.includes(existing)));
    });
    setDuplicate(possible?.name ?? null); setConfirming(true);
  }

  async function save() {
    if (!processed || !selectedColumn) return;
    setBusy(true); setError(null);
    try {
      const scale = reviewBasis === 'portion' ? 100 / parseNutritionNumber(portionAmount) : 1;
      const draft: FoodDraft = {
        name: name.trim(), brand: brand.trim(), supermarket: supermarket.trim(),
        baseUnit: reviewBasis === 'per-100-ml' ? 'ml' : reviewBasis === 'portion' ? portionUnit : 'g',
        energyKcal: parseNutritionNumber(values.energyKcal) * scale,
        energyKj: optionalNutritionNumber(values.energyKj, scale),
        proteinG: parseNutritionNumber(values.proteinG) * scale,
        carbohydratesG: parseNutritionNumber(values.carbohydratesG) * scale,
        fatG: optionalNutritionNumber(values.fatG, scale),
        energySource: 'declared', dataOrigin: 'label-photo',
        notes: 'Valores revisados manualmente tras OCR local.', favorite: false,
      };
      const portions = reviewBasis === 'portion' ? [{ name: 'Porción de la etiqueta', amount: parseNutritionNumber(portionAmount) }] : [];
      await foodRepository.save(draft, { portions, photo: processed.photo });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el alimento.');
    } finally {
      setBusy(false); setConfirming(false);
    }
  }

  if (stage === 'capture') return <View style={{ gap: 12 }}>{error ? <Notice danger text={error} /> : null}<LabelPhotoCapture busy={busy} initialFile={editablePhoto} onBusyChange={setBusy} onCancel={onCancel} onPrepared={(value) => { setEditablePhoto(null); void recognize(value); }} /><ActionButton tone="secondary" label="Introducir manualmente" onPress={onManual} /></View>;
  if (stage === 'processing') return <Card><SectionTitle eyebrow="OCR sin conexión">Procesando etiqueta</SectionTitle><Text accessibilityLiveRegion="polite" selectable style={{ color: palette.ink, fontWeight: '800' }}>{progress.status}</Text><Text selectable style={{ color: palette.muted }}>{progress.progress === null ? 'El motor local se está preparando.' : `${Math.round(progress.progress * 100)} % completado`}</Text><progress aria-label="Progreso del OCR local" max="1" value={progress.progress ?? undefined} style={{ width: '100%', minHeight: 16 }} /><Text selectable style={{ color: palette.muted }}>La imagen y el texto reconocido permanecen en este dispositivo.</Text><ActionButton tone="danger" label="Cancelar procesamiento" onPress={cancelProcessing} /></Card>;
  if (!result || !selectedColumn) return <Card><SectionTitle eyebrow="Error recuperable">Etiqueta no reconocida</SectionTitle><Notice danger text={error ?? 'No se encontraron datos suficientes.'} /><ActionButton label="Volver a fotografiar" onPress={() => { setProcessed(null); setStage('capture'); }} /><ActionButton tone="secondary" label="Introducir manualmente" onPress={onManual} /><ActionButton tone="secondary" label="Cancelar" onPress={onCancel} /></Card>;
  if (stage === 'result') {
    const found = result.values.filter(({ columnId, value }) => columnId === selectedColumn.id && value !== null).length;
    return <Card><SectionTitle eyebrow="Resultado local">Etiqueta procesada</SectionTitle><StatusPill label={found === FIELD_ORDER.length ? 'Resultado completo' : `Resultado parcial · ${found} de ${FIELD_ORDER.length}`} tone={found === FIELD_ORDER.length ? 'good' : 'warning'} /><Text selectable style={{ color: palette.muted }}>Revisa cada dato antes de guardarlo. NutrIAsta no presenta el OCR como exacto.</Text><ActionButton label="Revisar etiqueta nutricional" onPress={() => setStage('review')} /><ActionButton tone="secondary" label="Volver a fotografiar" onPress={() => { setEditablePhoto(null); setProcessed(null); setResult(null); setStage('capture'); }} /><ActionButton tone="secondary" label="Introducir manualmente" onPress={onManual} /><ActionButton tone="secondary" label="Cancelar" onPress={onCancel} /></Card>;
  }

  return <View style={{ gap: 14 }}><Card>
    <SectionTitle eyebrow="Revisión obligatoria">Revisar etiqueta nutricional</SectionTitle>
    <Text selectable style={{ color: palette.muted }}>Nada se guardará hasta que revises los campos y confirmes la acción.</Text>
    {photoUrl ? <Image accessibilityLabel="Fotografía recodificada de la etiqueta" source={{ uri: photoUrl }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 18 }} /> : null}
    <Field label="Nombre del alimento" value={name} onChange={setName} /><Field label="Marca (opcional)" value={brand} onChange={setBrand} /><Field label="Supermercado (opcional)" value={supermarket} onChange={setSupermarket} />
    <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Columna que deseas guardar</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{result.columns.map((column) => <button aria-pressed={selectedColumnId === column.id} className="na-choice" key={column.id} onClick={() => selectColumn(column)} type="button">{column.label}</button>)}</View>
    <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Base nutricional</Text>
    <Text selectable style={{ color: palette.muted }}>Si el OCR no la reconoce, elígela manualmente. No se inventará ninguna conversión.</Text>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {([
        ['per-100-g', 'Por 100 g'],
        ['per-100-ml', 'Por 100 ml'],
        ['portion', 'Por porción'],
      ] as Array<[NutritionBasis, string]>).map(([basis, label]) => <button aria-checked={reviewBasis === basis} className="na-choice" key={basis} onClick={() => setReviewBasis(basis)} role="radio" type="button">{label}</button>)}
    </View>
    {reviewBasis === 'portion' ? <View style={{ gap: 8 }}><Field label="Tamaño de porción" value={portionAmount} onChange={setPortionAmount} inputMode="decimal" /><View style={{ flexDirection: 'row', gap: 8 }}>{(['g', 'ml'] as const).map((unit) => <button aria-pressed={portionUnit === unit} className="na-choice" key={unit} onClick={() => setPortionUnit(unit)} type="button">{unit}</button>)}</View><Text selectable style={{ color: palette.muted }}>La equivalencia declarada se usará para convertir matemáticamente a valores por 100 {portionUnit}.</Text></View> : null}
    {FIELD_ORDER.map((key) => {
      const detected = result.values.find((value) => value.columnId === selectedColumn.id && value.key === key);
      const status: DetectionStatus = corrected.has(key) ? 'corrected' : detected?.status ?? 'missing';
      return <View key={key} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 12, gap: 7 }}><Field label={LABELS[key]} value={values[key]} onChange={(next) => { setValues((current) => ({ ...current, [key]: next })); setCorrected((current) => new Set(current).add(key)); }} inputMode="decimal" /><DetectionBadge status={status} /><Text selectable style={{ color: palette.muted, fontSize: 13 }}>Origen: {selectedColumn.label}{detected?.raw ? ` · lectura “${detected.raw}”` : ' · no encontrado'}</Text>{detected?.warnings.map((warning) => <Text key={warning} selectable style={{ color: palette.warning, fontSize: 13 }}>⚠ {warning}</Text>)}</View>;
    })}
    {warnings.length ? <Notice text={warnings.join(' ')} /> : <Notice text="No se han detectado conflictos adicionales; revisa igualmente los valores." />}
    <details><summary style={{ minHeight: 44, cursor: 'pointer', color: palette.navy, fontWeight: 800 }}>Mostrar texto reconocido</summary><pre style={{ maxWidth: '100%', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', color: palette.muted }}>{result.recognizedText}</pre></details>
    {error ? <Notice danger text={error} /> : null}
    <Text selectable style={{ color: palette.muted }}>Para guardar solo son obligatorios el nombre, las calorías, las proteínas, los hidratos de carbono y una base nutricional. kJ y grasas son opcionales.</Text>
    <ActionButton label="Guardar alimento" disabled={busy || !canSaveLabelReview(name, reviewBasis, values, portionAmount)} onPress={() => void prepareConfirmation()} /><ActionButton tone="secondary" label="Volver a fotografiar" disabled={busy} onPress={() => { setEditablePhoto(null); setProcessed(null); setResult(null); setStage('capture'); }} /><ActionButton tone="secondary" label="Editar fotografía" disabled={busy} onPress={() => { if (processed) setEditablePhoto(new File([processed.ocrBlob], 'etiqueta-recodificada.jpg', { type: 'image/jpeg' })); setResult(null); setStage('capture'); }} /><ActionButton tone="secondary" label="Introducir manualmente" disabled={busy} onPress={onManual} /><ActionButton tone="secondary" label="Cancelar" disabled={busy} onPress={onCancel} />
  </Card><AccessibleDialog busy={busy} confirmLabel="Confirmar y guardar alimento" description={`${duplicate ? `Posible duplicado: “${duplicate}”. ` : ''}Se guardarán el alimento y la fotografía recodificada en una única operación local. Los resultados OCR han sido revisados, pero pueden contener errores.`} onCancel={() => setConfirming(false)} onConfirm={() => void save()} open={confirming} title="Confirmar alimento revisado" /></View>;
}

function emptyValues(): EditableValues { return { energyKj: '', energyKcal: '', fatG: '', carbohydratesG: '', proteinG: '' }; }
function reviewWarnings(result: NutritionLabelResult | null, column: NutritionColumn | null, basis: NutritionBasis, values: EditableValues, portionAmount: string) {
  if (!result || !column) return [];
  const warnings = [...result.warnings]; const kcal = parseNutritionNumber(values.energyKcal); const kj = parseNutritionNumber(values.energyKj);
  if (Number.isFinite(kcal) && kcal > 0 && Number.isFinite(kj) && kj > 0 && Math.abs(kj / kcal - 4.184) > 0.85) warnings.push('La energía en kcal y kJ no parece corresponder.');
  if (basis === 'portion' && !(parseNutritionNumber(portionAmount) > 0)) warnings.push('Falta una equivalencia válida para la porción.');
  if (basis === 'unknown') warnings.push('Selecciona una base nutricional clara antes de guardar.');
  return [...new Set(warnings)];
}
function normalizeName(value: string) { return value.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-ES').replace(/\s+/g, ' '); }
function Field({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (value: string) => void; inputMode?: 'decimal' }) { return <View style={{ gap: 6 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{label}</Text><TextInput accessibilityLabel={label} inputMode={inputMode} value={value} onChangeText={onChange} style={input} /></View>; }
function DetectionBadge({ status }: { status: DetectionStatus }) { const labels: Record<DetectionStatus, string> = { detected: '✓ Detectado con suficiente confianza', uncertain: '⚠ Lectura dudosa', corrected: '✎ Corregido manualmente', missing: '○ No encontrado', conflict: '! Conflicto entre valores' }; return <Text selectable style={{ color: status === 'detected' ? palette.greenDark : status === 'missing' ? palette.muted : palette.warning, fontWeight: '800' }}>{labels[status]}</Text>; }
function Notice({ text, danger = false }: { text: string; danger?: boolean }) { return <View accessibilityLiveRegion="polite" style={{ backgroundColor: danger ? palette.dangerBackground : palette.warningBackground, borderRadius: 14, padding: 12 }}><Text selectable style={{ color: danger ? palette.danger : palette.warning, fontWeight: '700' }}>{text}</Text></View>; }
function useBlobUrl(blob?: Blob) { const [url, setUrl] = useState<string | null>(null); useEffect(() => { if (!blob) { setUrl(null); return; } const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]); return url; }
const input = { borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 13, color: palette.ink, backgroundColor: '#f9fbfa', fontSize: 16 } as const;
