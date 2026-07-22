import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ActionButton, Card, SectionTitle, StatusPill, palette } from '@/components/ui';
import type { DiaryView, MealType, QuantityUnit } from '@/mvp/diary-types';
import type { Food } from '@/mvp/food-types';
import type { RecipeWithTotals } from '@/mvp/recipe-types';
import { diaryRepository } from '@/storage/diary-repository.web';
import { foodRepository } from '@/storage/food-repository.web';
import { recipeRepository } from '@/storage/recipe-repository.web';

const madridToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
const shiftDate = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };

export function DiaryScreen() {
  const [date, setDate] = useState(madridToday());
  const [view, setView] = useState<DiaryView | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [recipes, setRecipes] = useState<RecipeWithTotals[]>([]);
  const [foodId, setFoodId] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [unit, setUnit] = useState<QuantityUnit>('g');
  const [quantity, setQuantity] = useState(100);
  const [recipeQuantity, setRecipeQuantity] = useState(1);
  const [unitBase, setUnitBase] = useState(100);
  const [water, setWater] = useState(250);
  const [trained, setTrained] = useState(false);
  const [trainingType, setTrainingType] = useState('');
  const [trainingNote, setTrainingNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const trainingTypeRef = useRef('');
  const trainingNoteRef = useRef('');

  async function refresh() {
    const [nextView, nextFoods, nextRecipes] = await Promise.all([
      diaryRepository.get(date), foodRepository.list(), recipeRepository.list(),
    ]);
    setView(nextView);
    setFoods(nextFoods);
    setRecipes(nextRecipes);
    setFoodId((current) => current || nextFoods[0]?.id || '');
    setRecipeId((current) => current || nextRecipes[0]?.id || '');
    setTrained(nextView.training?.trained ?? false);
    trainingTypeRef.current = nextView.training?.trainingType ?? '';
    trainingNoteRef.current = nextView.training?.note ?? '';
    setTrainingType(trainingTypeRef.current);
    setTrainingNote(trainingNoteRef.current);
  }
  useEffect(() => { void refresh().catch((caught) => setError(caught instanceof Error ? caught.message : 'Error inesperado.')); }, [date]);
  async function run(success: string, operation: () => Promise<void>) { setBusy(true); setError(null); try { await operation(); await refresh(); setMessage(success); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Error inesperado.'); } finally { setBusy(false); } }

  const baseAmount = unit === 'g' || unit === 'ml' ? quantity : quantity * unitBase;
  const waterTotal = view?.water.reduce((sum, item) => sum + item.amountMl, 0) ?? 0;
  const mealChoices = [['breakfast', 'Desayuno'], ['lunch', 'Comida'], ['dinner', 'Cena'], ['snack', 'Tentempié']];

  return <View style={{ gap: 16 }}>
    {error ? <Notice danger text={error} /> : message ? <Notice text={message} /> : null}
    <Card><SectionTitle eyebrow="Diario">Fecha</SectionTitle><View style={{ flexDirection: 'row', gap: 8 }}><ActionButton tone="secondary" label="Día anterior" onPress={() => setDate(shiftDate(date, -1))} /><ActionButton tone="secondary" label="Día siguiente" onPress={() => setDate(shiftDate(date, 1))} /></View><TextInput accessibilityLabel="Fecha del diario" value={date} onChangeText={setDate} style={input} /><StatusPill label={date === madridToday() ? 'Hoy' : date > madridToday() ? 'Futuro' : 'Histórico'} tone={date === madridToday() ? 'good' : 'neutral'} /><ActionButton tone="secondary" label="Copiar otro día a esta fecha" onPress={() => { const source = window.prompt('Fecha de origen (AAAA-MM-DD)'); if (source) void run('Día copiado con sus snapshots.', () => diaryRepository.copyDay(source, date)); }} /></Card>

    <Card><SectionTitle eyebrow="Resumen consumido">Totales del día</SectionTitle><NutritionLine label="Calorías" consumed={view?.totals.energyKcal ?? 0} target={view?.day.targetSnapshot.caloriesKcal ?? 0} unit="kcal" /><NutritionLine label="Proteínas" consumed={view?.totals.proteinG ?? 0} target={view?.day.targetSnapshot.proteinG ?? 0} unit="g" /><NutritionLine label="Carbohidratos" consumed={view?.totals.carbohydratesG ?? 0} target={view?.day.targetSnapshot.carbohydratesG ?? 0} unit="g" /><NutritionLine label="Grasas" consumed={view?.totals.fatG ?? 0} target={view?.day.targetSnapshot.fatG ?? 0} unit="g" /><Text selectable style={{ color: palette.muted, fontSize: 13 }}>Planificado aparte: {(view?.plannedTotals.energyKcal ?? 0).toFixed(1)} kcal · P {(view?.plannedTotals.proteinG ?? 0).toFixed(1)} · C {(view?.plannedTotals.carbohydratesG ?? 0).toFixed(1)} · G {(view?.plannedTotals.fatG ?? 0).toFixed(1)}.</Text><Text selectable style={{ color: palette.muted, fontSize: 13 }}>Los objetivos son el snapshot aplicable a esta fecha y no cambiarán al editar periodos posteriores.</Text></Card>

    <Card><SectionTitle eyebrow="Añadir alimento">Consumo o planificación</SectionTitle>{foods.length === 0 ? <Text selectable style={{ color: palette.warning }}>Crea primero un alimento en el catálogo.</Text> : <><Choice label="Alimento" values={foods.map((food) => [food.id, food.name])} selected={foodId} onSelect={setFoodId} /><Choice label="Franja" values={mealChoices} selected={mealType} onSelect={(value) => setMealType(value as MealType)} /><Choice label="Unidad" values={[['g', 'Gramos'], ['ml', 'Mililitros'], ['unit', 'Unidades'], ['portion', 'Porciones']]} selected={unit} onSelect={(value) => setUnit(value as QuantityUnit)} /><NumberField label="Cantidad" value={quantity} onChange={setQuantity} />{unit === 'unit' || unit === 'portion' ? <NumberField label={`Equivalencia por ${unit === 'unit' ? 'unidad' : 'porción'} (${foods.find((food) => food.id === foodId)?.baseUnit ?? 'g'})`} value={unitBase} onChange={setUnitBase} /> : null}<Text selectable style={{ color: palette.muted }}>Cantidad base calculada: {baseAmount.toFixed(1)} {foods.find((food) => food.id === foodId)?.baseUnit ?? 'g'}.</Text><ActionButton label="Añadir como consumido" disabled={busy || !foodId} onPress={() => void run('Consumo añadido con snapshot nutricional.', () => diaryRepository.addFood(date, mealType, foodId, quantity, unit, baseAmount).then(() => undefined))} /><ActionButton tone="secondary" label="Añadir como planificado" disabled={busy || !foodId} onPress={() => void run('Alimento añadido a la planificación.', () => diaryRepository.addFood(date, mealType, foodId, quantity, unit, baseAmount, '', 'planned').then(() => undefined))} /></>}</Card>

    <Card><SectionTitle eyebrow="Añadir receta">Comida compuesta</SectionTitle>{recipes.length === 0 ? <Text selectable style={{ color: palette.muted }}>Crea primero una receta en la pestaña Recetas.</Text> : <><Choice label="Receta" values={recipes.map((recipe) => [recipe.id, recipe.name])} selected={recipeId} onSelect={setRecipeId} /><Choice label="Franja de la receta" values={mealChoices} selected={mealType} onSelect={(value) => setMealType(value as MealType)} /><NumberField label="Porciones de receta" value={recipeQuantity} onChange={setRecipeQuantity} /><ActionButton label="Añadir receta consumida" disabled={busy || !recipeId} onPress={() => void run('Receta añadida con snapshot nutricional.', () => diaryRepository.addRecipe(date, mealType, recipeId, recipeQuantity, 'portion').then(() => undefined))} /><ActionButton tone="secondary" label="Planificar receta" disabled={busy || !recipeId} onPress={() => void run('Receta añadida a la planificación.', () => diaryRepository.addRecipe(date, mealType, recipeId, recipeQuantity, 'portion', 'planned').then(() => undefined))} /></>}</Card>

    {(view?.meals ?? []).map((meal) => <Card key={meal.id}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><SectionTitle>{meal.label}</SectionTitle><StatusPill label={meal.state === 'consumed' ? 'Consumido' : 'Planificado'} tone={meal.state === 'consumed' ? 'good' : 'warning'} /></View>{meal.items.map((item) => <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10, gap: 7 }}><Text selectable style={{ color: palette.ink, fontWeight: '800' }}>{item.nutritionSnapshot.name}</Text><Text selectable style={{ color: palette.muted }}>{item.quantity} {unitLabel(item.quantityUnit)} · {item.calculated.energyKcal.toFixed(1)} kcal · P {item.calculated.proteinG.toFixed(1)} · C {item.calculated.carbohydratesG.toFixed(1)} · G {item.calculated.fatG.toFixed(1)}</Text><View style={{ flexDirection: 'row', gap: 8 }}><ActionButton tone="secondary" label="Editar cantidad" onPress={() => { const next = window.prompt('Nueva cantidad', String(item.quantity)); if (next !== null) { const parsed = Number(next.replace(',', '.')); const factor = item.baseAmount / item.quantity; void run('Cantidad actualizada usando el snapshot histórico.', () => diaryRepository.updateItemQuantity(item.id, parsed, parsed * factor)); } }} /><ActionButton tone="danger" label="Eliminar" onPress={() => { if (window.confirm('¿Eliminar este consumo?')) void run('Consumo eliminado.', () => diaryRepository.deleteItem(item.id)); }} /></View></View>)}{meal.state === 'planned' ? <ActionButton label="Marcar como consumido" onPress={() => void run('Comida marcada como consumida sin recalcularla.', () => diaryRepository.convertMealToConsumed(meal.id))} /> : null}<ActionButton tone="secondary" label="Copiar comida" onPress={() => { const target = window.prompt('Fecha de destino (AAAA-MM-DD)', shiftDate(date, 1)); if (target) void run('Comida copiada con sus snapshots.', () => diaryRepository.copyMeal(meal.id, target)); }} /><Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Subtotal: {meal.totals.energyKcal.toFixed(1)} kcal</Text></Card>)}

    <Card><SectionTitle eyebrow="Hidratación">Agua</SectionTitle><Text selectable style={{ color: palette.ink, fontSize: 22, fontWeight: '800' }}>{waterTotal} ml {view?.day.targetSnapshot.waterMl ? `de ${view.day.targetSnapshot.waterMl} ml` : ''}</Text><View style={{ flexDirection: 'row', gap: 8 }}><ActionButton tone="secondary" label="+250 ml" onPress={() => void run('Agua añadida.', () => diaryRepository.addWater(date, 250).then(() => undefined))} /><ActionButton tone="secondary" label="+500 ml" onPress={() => void run('Agua añadida.', () => diaryRepository.addWater(date, 500).then(() => undefined))} /></View><NumberField label="Cantidad personalizada (ml)" value={water} onChange={setWater} /><ActionButton label="Añadir agua" onPress={() => void run('Agua añadida.', () => diaryRepository.addWater(date, water).then(() => undefined))} />{view?.water.map((entry) => <View key={entry.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><Text selectable style={{ color: palette.ink }}>{entry.amountMl} ml</Text><View style={{ flexDirection: 'row', gap: 6 }}><ActionButton tone="secondary" label="Editar agua" onPress={() => { const next = window.prompt('Nueva cantidad en ml', String(entry.amountMl)); if (next) void run('Agua actualizada.', () => diaryRepository.updateWater(entry.id, Number(next))); }} /><ActionButton tone="danger" label="Eliminar agua" onPress={() => { if (window.confirm('¿Eliminar esta entrada de agua?')) void run('Agua eliminada.', () => diaryRepository.deleteWater(entry.id)); }} /></View></View>)}</Card>

    <Card><SectionTitle eyebrow="Registro mínimo">Entrenamiento diario</SectionTitle><StatusPill label={trained ? 'Entrenamiento registrado' : 'Sin entrenamiento'} tone={trained ? 'good' : 'neutral'} /><WebField key={`type-${view?.training?.updatedAt ?? date}`} label="Tipo de entrenamiento (opcional)" initialValue={trainingType} onInput={(value) => { trainingTypeRef.current = value; }} /><WebField key={`note-${view?.training?.updatedAt ?? date}`} label="Nota de entrenamiento (opcional)" initialValue={trainingNote} onInput={(value) => { trainingNoteRef.current = value; }} /><ActionButton label="Guardar: sí he entrenado" onPress={() => void run('Entrenamiento diario guardado.', () => { const type = document.querySelector<HTMLInputElement>('[aria-label="Tipo de entrenamiento (opcional)"]')?.value ?? trainingTypeRef.current; const note = document.querySelector<HTMLInputElement>('[aria-label="Nota de entrenamiento (opcional)"]')?.value ?? trainingNoteRef.current; return diaryRepository.saveTraining(date, true, type, note).then(() => undefined); })} /><ActionButton tone="secondary" label="Guardar: no he entrenado" onPress={() => void run('Día marcado sin entrenamiento.', () => diaryRepository.saveTraining(date, false, '', '').then(() => undefined))} /></Card>
  </View>;
}

function NutritionLine({ label, consumed, target, unit }: { label: string; consumed: number; target: number; unit: string }) { return <View style={{ gap: 3 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{label}</Text><Text selectable style={{ color: palette.ink, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{consumed.toFixed(1)} / {target.toFixed(1)} {unit}</Text></View><Text selectable style={{ color: palette.muted, fontSize: 13 }}>Diferencia: {(consumed - target).toFixed(1)} {unit}</Text></View>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <View style={{ gap: 6 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} style={input} /></View>; }
function WebField({ label, initialValue, onInput }: { label: string; initialValue: string; onInput: (value: string) => void }) { return <View style={{ gap: 6 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{label}</Text><input aria-label={label} defaultValue={initialValue} onInput={(event) => onInput(event.currentTarget.value)} style={{ ...input, fontFamily: 'inherit' }} /></View>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Field label={label} value={String(value)} onChange={(next) => onChange(Number(next.replace(',', '.')) || 0)} />; }
function Choice({ label, values, selected, onSelect }: { label: string; values: string[][]; selected: string; onSelect: (value: string) => void }) { return <View style={{ gap: 7 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{values.map(([value = '', text = '']) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: value === selected }} onPress={() => onSelect(value)} style={{ borderWidth: 1, borderColor: value === selected ? palette.greenDark : palette.border, backgroundColor: value === selected ? palette.mint : '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{text}</Text></Pressable>)}</View></View>; }
function Notice({ text, danger = false }: { text: string; danger?: boolean }) { return <View style={{ backgroundColor: danger ? palette.dangerBackground : '#eaf5ff', borderRadius: 14, padding: 12 }}><Text selectable style={{ color: danger ? palette.danger : palette.navySoft, fontWeight: '700' }}>{text}</Text></View>; }
function unitLabel(unit: QuantityUnit) { return { g: 'g', ml: 'ml', unit: 'unidad(es)', portion: 'porción(es)' }[unit]; }
const input = { borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 13, color: palette.ink, backgroundColor: '#f9fbfa', fontSize: 16 } as const;
