import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ActionButton, Card, SectionTitle, StatusPill, palette } from '@/components/ui';
import type { DiaryView, MealItem, MealState, MealType, QuantityUnit } from '@/mvp/diary-types';
import type { Food, FoodPortion } from '@/mvp/food-types';
import type { RecipeWithTotals } from '@/mvp/recipe-types';
import type { Profile } from '@/mvp/profile-types';
import { diaryRepository } from '@/storage/diary-repository.web';
import { foodRepository } from '@/storage/food-repository.web';
import { profileRepository } from '@/storage/profile-repository.web';
import { recipeRepository } from '@/storage/recipe-repository.web';
import { inventoryConsumptionService, type ConsumptionChoice, type ConsumptionIngredientPlan, } from '@/storage/inventory-consumption-service.web';
import { createId } from '@/utils/crypto';
import { ConsumptionReviewDialog, defaultConsumptionChoices, } from '@/features/diary/consumption-review-dialog.web';
import { AccessibleDialog } from '@/components/accessible-dialog.web';
const madridToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
const shiftDate = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
type MealView = DiaryView['meals'][number];
type PendingConsumptionReview = {
    title: string;
    ingredients: ConsumptionIngredientPlan[];
    success: string;
    commit: (choices: ConsumptionChoice[]) => Promise<void>;
};
type PendingAction = {
    title: string;
    description: string;
    confirmLabel: string;
    success: string;
    danger?: boolean;
    commit: () => Promise<void>;
};
export function DiaryScreen() {
    const [date, setDate] = useState(madridToday());
    const [view, setView] = useState<DiaryView | null>(null);
    const [foods, setFoods] = useState<Food[]>([]);
    const [recipes, setRecipes] = useState<RecipeWithTotals[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [recentMeals, setRecentMeals] = useState<MealView[]>([]);
    const [recentSources, setRecentSources] = useState<MealItem[]>([]);
    const [foodId, setFoodId] = useState('');
    const [recipeId, setRecipeId] = useState('');
    const [portions, setPortions] = useState<FoodPortion[]>([]);
    const [portionId, setPortionId] = useState('');
    const [mealType, setMealType] = useState<MealType>('breakfast');
    const [addState, setAddState] = useState<MealState>('consumed');
    const [destinationId, setDestinationId] = useState('new');
    const [unit, setUnit] = useState<QuantityUnit>('g');
    const [quantity, setQuantity] = useState(100);
    const [unitBase, setUnitBase] = useState(100);
    const [recipeQuantity, setRecipeQuantity] = useState(1);
    const [recipeUnit, setRecipeUnit] = useState<'portion' | 'g'>('portion');
    const [itemNote, setItemNote] = useState('');
    const [water, setWater] = useState(250);
    const [trained, setTrained] = useState(false);
    const [trainingType, setTrainingType] = useState('');
    const [trainingNote, setTrainingNote] = useState('');
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editQuantity, setEditQuantity] = useState(0);
    const [editNote, setEditNote] = useState('');
    const [editMealType, setEditMealType] = useState<MealType>('breakfast');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const trainingTypeRef = useRef('');
    const trainingNoteRef = useRef('');
    const [pendingReview, setPendingReview] = useState<PendingConsumptionReview | null>(null);
    const [reviewChoices, setReviewChoices] = useState<ConsumptionChoice[]>([]);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [copyDaySource, setCopyDaySource] = useState<string | null>(null);
    const [copyMeal, setCopyMeal] = useState<MealView | null>(null);
    const [copyMealTarget, setCopyMealTarget] = useState('');
    const [waterEdit, setWaterEdit] = useState<{ id: string; amount: number } | null>(null);
    async function refresh() { const [nextView, nextFoods, nextRecipes, nextProfile, nextRecentMeals, nextSources] = await Promise.all([diaryRepository.get(date), foodRepository.list(), recipeRepository.list(), profileRepository.getProfile(), diaryRepository.recentMeals(), diaryRepository.recentSources()]); setView(nextView); setFoods(nextFoods); setRecipes(nextRecipes); setProfile(nextProfile); setRecentMeals(nextRecentMeals); setRecentSources(nextSources); setFoodId((current) => current && nextFoods.some((food) => food.id === current) ? current : nextFoods[0]?.id ?? ''); setRecipeId((current) => current && nextRecipes.some((recipe) => recipe.id === current) ? current : nextRecipes[0]?.id ?? ''); setTrained(nextView.training?.trained ?? false); trainingTypeRef.current = nextView.training?.trainingType ?? ''; trainingNoteRef.current = nextView.training?.note ?? ''; setTrainingType(trainingTypeRef.current); setTrainingNote(trainingNoteRef.current); }
    useEffect(() => { setAddState(date > madridToday() ? 'planned' : 'consumed'); setDestinationId('new'); void refresh().catch((caught) => setError(messageFor(caught))); }, [date]);
    useEffect(() => { const food = foods.find((value) => value.id === foodId); if (food)
        setUnit(food.baseUnit); void (foodId ? foodRepository.portions(foodId).then((values) => { setPortions(values); setPortionId(values[0]?.id ?? ''); }) : Promise.resolve()); }, [foodId, foods]);
    useEffect(() => { const recipe = recipes.find((value) => value.id === recipeId); if (!recipe?.finalWeightG)
        setRecipeUnit('portion'); }, [recipeId, recipes]);
    useEffect(() => { setDestinationId('new'); }, [addState]);
    async function run(success: string, operation: () => Promise<void>) { setBusy(true); setError(null); try {
        await operation();
        await refresh();
        setMessage(success);
    }
    catch (caught) {
        setError(messageFor(caught));
    }
    finally {
        setBusy(false);
    } }
    async function requestSelectedFood() {
        if (!food)
            throw new Error('Selecciona un alimento.');
        if (addState === 'planned') {
            await diaryRepository.addFood(date, mealType, food.id, quantity, unit, baseAmount, itemNote, addState, destinationId === 'new' ? undefined : destinationId, unit === 'portion' ? portionId : undefined);
            setItemNote('');
            return;
        }
        const plan = await inventoryConsumptionService.prepareFood(food.id, baseAmount);
        const operationId = createId('consume-food');
        openReview(`Consumir ${food.name}`, plan.ingredients, 'Alimento añadido con nutrición e inventario atómicos.', async (choices) => {
            await inventoryConsumptionService.addFood({ date, mealType, entryId: destinationId === 'new' ? undefined : destinationId, foodId: food.id, quantity, quantityUnit: unit, baseAmount, portionId: unit === 'portion' ? portionId : undefined, note: itemNote, operationId, choice: choices[0]! });
            setItemNote('');
        });
    }
    async function requestSelectedRecipe() {
        if (!recipeId)
            throw new Error('Selecciona una receta.');
        if (addState === 'planned') {
            await diaryRepository.addRecipe(date, mealType, recipeId, recipeQuantity, recipeUnit, addState, destinationId === 'new' ? undefined : destinationId, itemNote);
            setItemNote('');
            return;
        }
        const selectedRecipe = recipes.find(({ id }) => id === recipeId);
        const { plan } = await inventoryConsumptionService.prepareRecipe(recipeId, recipeQuantity, recipeUnit);
        const operationId = createId('consume-recipe');
        openReview(`Consumir ${selectedRecipe?.name ?? 'receta'}`, plan.ingredients, 'Receta añadida con nutrición e inventario atómicos.', async (choices) => {
            await inventoryConsumptionService.addRecipe({ date, mealType, entryId: destinationId === 'new' ? undefined : destinationId, recipeId, quantity: recipeQuantity, quantityUnit: recipeUnit, note: itemNote, operationId, choices });
            setItemNote('');
        });
    }
    function openReview(title: string, ingredients: ConsumptionIngredientPlan[], success: string, commit: (choices: ConsumptionChoice[]) => Promise<void>) {
        setReviewChoices(defaultConsumptionChoices(ingredients));
        setPendingReview({ title, ingredients, success, commit });
    }
    async function prepare(operation: () => Promise<void>) {
        setBusy(true);
        setError(null);
        try {
            await operation();
        }
        catch (caught) {
            setError(messageFor(caught));
        }
        finally {
            setBusy(false);
        }
    }
    async function confirmReview() {
        if (!pendingReview)
            return;
        setBusy(true);
        setError(null);
        try {
            await pendingReview.commit(reviewChoices);
            await refresh();
            setMessage(pendingReview.success);
            setPendingReview(null);
        }
        catch (caught) {
            setError(messageFor(caught));
        }
        finally {
            setBusy(false);
        }
    }
    function askAction(action: PendingAction) {
        setPendingAction(action);
    }
    async function confirmAction() {
        if (!pendingAction)
            return;
        setBusy(true);
        setError(null);
        try {
            await pendingAction.commit();
            await refresh();
            setMessage(pendingAction.success);
            setPendingAction(null);
        }
        catch (caught) {
            setError(messageFor(caught));
        }
        finally {
            setBusy(false);
        }
    }
    const food = foods.find((value) => value.id === foodId);
    const recipe = recipes.find((value) => value.id === recipeId);
    const selectedPortion = portions.find((value) => value.id === portionId);
    const baseAmount = unit === food?.baseUnit ? quantity : unit === 'portion' ? quantity * (selectedPortion?.amount ?? 0) : quantity * unitBase;
    const waterTotal = view?.water.reduce((sum, item) => sum + item.amountMl, 0) ?? 0;
    const quickWater = profile?.waterQuickAmountsMl?.length ? profile.waterQuickAmountsMl : [250, 500];
    const destinationMeals = (view?.meals ?? []).filter((meal) => meal.state === addState);
    const destinationChoices = [['new', `Nueva ${labelFor(mealType).toLocaleLowerCase('es-ES')}`], ...destinationMeals.map((meal) => [meal.id, `${meal.label} · ${meal.items.length} elementos · ${timeFor(meal)}`])];
    return <View style={{ gap: 16 }}>
    {error ? <Notice danger text={error}/> : message ? <Notice text={message}/> : null}
    <Card><SectionTitle eyebrow="Diario">Fecha</SectionTitle><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><ActionButton tone="secondary" label="Día anterior" onPress={() => setDate(shiftDate(date, -1))}/><ActionButton tone="secondary" label="Volver a hoy" onPress={() => setDate(madridToday())}/><ActionButton tone="secondary" label="Día siguiente" onPress={() => setDate(shiftDate(date, 1))}/></View><TextInput accessibilityLabel="Fecha del diario" value={date} onChangeText={setDate} style={input}/><StatusPill label={date === madridToday() ? 'Hoy' : date > madridToday() ? 'Futuro' : 'Histórico'} tone={date === madridToday() ? 'good' : 'neutral'}/><ActionButton tone="secondary" label="Copiar otro día a esta fecha" onPress={() => setCopyDaySource(shiftDate(date, -1))}/></Card>
    <Card><SectionTitle eyebrow="Resumen consumido">Totales del día</SectionTitle><NutritionLine label="Calorías" consumed={view?.totals.energyKcal ?? 0} target={view?.day.targetSnapshot.caloriesKcal ?? 0} unit="kcal"/><NutritionLine label="Proteínas" consumed={view?.totals.proteinG ?? 0} target={view?.day.targetSnapshot.proteinG ?? 0} unit="g"/><NutritionLine label="Hidratos de carbono" consumed={view?.totals.carbohydratesG ?? 0} target={view?.day.targetSnapshot.carbohydratesG ?? 0} unit="g"/><NutritionLine label="Grasas" consumed={view ? view.totals.fatG : 0} target={view?.day.targetSnapshot.fatG ?? 0} unit="g"/><Text selectable style={{ color: palette.muted }}>Planificado aparte: {(view?.plannedTotals.energyKcal ?? 0).toFixed(1)} kcal · P {(view?.plannedTotals.proteinG ?? 0).toFixed(1)} · HC {(view?.plannedTotals.carbohydratesG ?? 0).toFixed(1)} · G {formatOptional(view ? view.plannedTotals.fatG : 0)}.</Text></Card>
    {recentSources.length || recentMeals.length ? <Card><SectionTitle eyebrow="Acceso rápido">Recientes</SectionTitle><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{recentSources.map((item) => <ActionButton key={item.id} tone="secondary" label={`Usar reciente: ${item.nutritionSnapshot.name}`} onPress={() => { if (item.sourceType === 'food')
        setFoodId(item.sourceId);
    else
        setRecipeId(item.sourceId); }}/>)}</View>{recentMeals.map((meal) => <View key={meal.id} style={{ borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 8, gap: 6 }}><Text selectable style={{ color: palette.ink }}>{meal.date} · {meal.label} · {meal.items.map((item) => item.nutritionSnapshot.name).join(', ')}</Text><ActionButton tone="secondary" label={`Copiar comida reciente de ${meal.date}`} onPress={() => askAction({ title: 'Copiar comida reciente', description: `Se copiará esta comida a ${date} como una copia independiente.`, confirmLabel: 'Copiar comida', success: 'Comida reciente copiada.', commit: () => diaryRepository.copyMeal(meal.id, date, mealType) })}/></View>)}</Card> : null}
    <Card><SectionTitle eyebrow="Destino">Comida y estado</SectionTitle><Choice label="Estado" values={[["consumed", "Consumido"], ["planned", "Planificado"]]} selected={addState} onSelect={(value) => setAddState(value as MealState)}/><Choice label="Franja para una comida nueva" values={mealChoices} selected={mealType} onSelect={(value) => { setMealType(value as MealType); setDestinationId('new'); }}/><Choice label="Añadir a" values={destinationChoices} selected={destinationId} onSelect={setDestinationId}/><Field label="Nota del elemento (opcional)" value={itemNote} onChange={setItemNote}/></Card>
    <Card><SectionTitle eyebrow="Añadir alimento">Cantidad compatible</SectionTitle>{!food ? <Text selectable style={{ color: palette.warning }}>Crea primero un alimento en el catálogo.</Text> : <><Choice label="Alimento" values={foods.map((value) => [value.id, value.name])} selected={foodId} onSelect={setFoodId}/><Choice label="Unidad" values={[[food.baseUnit, food.baseUnit === 'g' ? 'Gramos' : 'Mililitros'], ['unit', `Unidades (equivalencia en ${food.baseUnit})`], ...(portions.length ? [['portion', 'Porción guardada']] : [])]} selected={unit} onSelect={(value) => setUnit(value as QuantityUnit)}/>{unit === 'portion' ? <Choice label="Porción" values={portions.map((portion) => [portion.id, `${portion.name} · ${portion.amount} ${portion.baseUnit}`])} selected={portionId} onSelect={setPortionId}/> : null}<NumberField label="Cantidad" value={quantity} onChange={setQuantity}/>{unit === 'unit' ? <NumberField label={`Equivalencia de una unidad (${food.baseUnit})`} value={unitBase} onChange={setUnitBase}/> : null}<Text selectable style={{ color: palette.muted }}>Cantidad base: {baseAmount.toFixed(1)} {food.baseUnit}. No se realizan conversiones g↔ml.</Text><ActionButton label="Añadir alimento a la comida" disabled={busy || baseAmount <= 0} onPress={() => { if (addState === 'planned')
        void run('Alimento planificado con snapshot nutricional.', requestSelectedFood);
    else
        void prepare(requestSelectedFood); }}/></>}</Card>
    <Card><SectionTitle eyebrow="Añadir receta">Comida compuesta</SectionTitle>{recipes.length === 0 ? <Text selectable style={{ color: palette.muted }}>Crea primero una receta.</Text> : <><Choice label="Receta" values={recipes.map((value) => [value.id, value.name])} selected={recipeId} onSelect={setRecipeId}/><Choice label="Unidad de receta" values={[['portion', 'Porciones'], ...(recipe?.finalWeightG ? [['g', `Gramos (peso final ${recipe.finalWeightG} g)`]] : [])]} selected={recipeUnit} onSelect={(value) => setRecipeUnit(value as 'portion' | 'g')}/><NumberField label={recipeUnit === 'portion' ? 'Porciones de receta' : 'Gramos de receta'} value={recipeQuantity} onChange={setRecipeQuantity}/>{!recipe?.finalWeightG ? <Text selectable style={{ color: palette.muted }}>Para registrar gramos, define antes el peso final de la receta.</Text> : null}<ActionButton label="Añadir receta a la comida" disabled={busy || !recipeId} onPress={() => { if (addState === 'planned')
        void run('Receta añadida con snapshot nutricional.', requestSelectedRecipe);
    else
        void prepare(requestSelectedRecipe); }}/></>}</Card>
    {(view?.meals ?? []).map((meal) => (
      <Card key={meal.id}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
          <SectionTitle>{meal.label}</SectionTitle>
          <StatusPill label={meal.state === 'consumed' ? 'Consumido' : 'Planificado'} tone={meal.state === 'consumed' ? 'good' : 'warning'}/>
        </View>
        <Text selectable style={{ color: palette.muted }}>{meal.date} · {timeFor(meal)} · {meal.items.length} elemento(s)</Text>
        {meal.items.map((item) => (
          <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10, gap: 7 }}>
            <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>{item.nutritionSnapshot.name}</Text>
            <Text selectable style={{ color: palette.muted }}>{item.quantity} {unitLabel(item.quantityUnit)} · base {item.baseAmount.toFixed(1)} {item.nutritionSnapshot.baseUnit} · {item.calculated.energyKcal.toFixed(1)} kcal</Text>
            {item.note ? <Text selectable style={{ color: palette.ink }}>Nota: {item.note}</Text> : null}
            {editingItemId === item.id ? (
              <View style={{ backgroundColor: '#f7faf8', borderRadius: 14, padding: 10, gap: 8 }}>
                <NumberField label={`Nueva cantidad de ${item.nutritionSnapshot.name}`} value={editQuantity} onChange={setEditQuantity}/>
                <Field label={`Nueva nota de ${item.nutritionSnapshot.name}`} value={editNote} onChange={setEditNote}/>
                <Choice label="Mover a franja" values={mealChoices} selected={editMealType} onSelect={(value) => setEditMealType(value as MealType)}/>
                <ActionButton label={`Guardar edición de ${item.nutritionSnapshot.name}`} onPress={() => {
                  const nextBase = editQuantity * item.baseAmount / item.quantity;
                  if (meal.state === 'planned') {
                    void run('Elemento planificado actualizado.', async () => {
                      await diaryRepository.updateItem(item.id, { quantity: editQuantity, baseAmount: nextBase, note: editNote, mealType: editMealType });
                      setEditingItemId(null);
                    });
                    return;
                  }
                  void prepare(async () => {
                    const plan = await inventoryConsumptionService.prepareItemUpdate(item.id, nextBase);
                    const ingredients = plan.ingredients.filter(({ requestedDeltaMilliBase }) => requestedDeltaMilliBase > 0);
                    const operationId = createId('edit-consumption');
                    if (ingredients.length === 0) {
                      await inventoryConsumptionService.updateConsumedItem({ plan, quantity: editQuantity, baseAmount: nextBase, note: editNote, mealType: editMealType, operationId, choices: [] });
                      setEditingItemId(null);
                      await refresh();
                      setMessage('Elemento e inventario actualizados por diferencia.');
                      return;
                    }
                    openReview(`Revisar edición de ${item.nutritionSnapshot.name}`, ingredients, 'Elemento e inventario actualizados por diferencia.', async (choices) => {
                      await inventoryConsumptionService.updateConsumedItem({ plan, quantity: editQuantity, baseAmount: nextBase, note: editNote, mealType: editMealType, operationId, choices });
                      setEditingItemId(null);
                    });
                  });
                }}/>
                <ActionButton tone="secondary" label="Cancelar edición" onPress={() => setEditingItemId(null)}/>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <ActionButton tone="secondary" label={`Editar ${item.nutritionSnapshot.name}`} onPress={() => { setEditingItemId(item.id); setEditQuantity(item.quantity); setEditNote(item.note); setEditMealType(meal.mealType); }}/>
                <ActionButton tone="danger" label={`Eliminar ${item.nutritionSnapshot.name}`} onPress={() => askAction({
                  title: `Eliminar ${item.nutritionSnapshot.name}`,
                  description: meal.state === 'consumed' ? 'Se eliminará del diario y se revertirá el inventario en una sola operación.' : 'Se eliminará este elemento planificado.',
                  confirmLabel: 'Eliminar elemento',
                  success: 'Elemento eliminado con la reversión necesaria.',
                  danger: true,
                  commit: () => meal.state === 'consumed' ? inventoryConsumptionService.deleteConsumedItem(item.id, createId('delete-consumption')) : diaryRepository.deleteItem(item.id),
                })}/>
              </View>
            )}
          </View>
        ))}
        {meal.state === 'planned' ? (
          <ActionButton label={`Marcar ${meal.label} como consumida`} onPress={() => void prepare(async () => {
            const plan = await inventoryConsumptionService.preparePlannedMeal(meal.id);
            const operationId = createId('reconsume-meal');
            openReview(`Consumir ${meal.label}`, plan.ingredients, 'Comida consumida e inventario actualizados juntos.', (choices) => inventoryConsumptionService.consumePlannedMeal(plan, choices, operationId));
          })}/>
        ) : (
          <ActionButton tone="secondary" label={`Volver ${meal.label} a planificada`} onPress={() => askAction({
            title: `Volver ${meal.label} a planificada`,
            description: 'Se crearán movimientos inversos y la nutrición pasará a planificada en una sola operación.',
            confirmLabel: 'Volver a planificada',
            success: 'Comida planificada e inventario revertido.',
            commit: () => inventoryConsumptionService.returnMealToPlanned(meal.id, createId('return-planned')),
          })}/>
        )}
        <ActionButton tone="secondary" label={`Copiar ${meal.label}`} onPress={() => { setCopyMeal(meal); setCopyMealTarget(shiftDate(date, 1)); }}/>
        <Text selectable style={{ color: palette.ink, fontWeight: '900' }}>Subtotal conjunto: {meal.totals.energyKcal.toFixed(1)} kcal · P {meal.totals.proteinG.toFixed(1)} · HC {meal.totals.carbohydratesG.toFixed(1)} · G {formatOptional(meal.totals.fatG)}</Text>
      </Card>
    ))}
    <Card><SectionTitle eyebrow="Hidratación">Agua</SectionTitle><Text selectable style={{ color: palette.ink, fontSize: 22, fontWeight: '800' }}>{waterTotal} ml {view?.day.targetSnapshot.waterMl ? `de ${view.day.targetSnapshot.waterMl} ml` : ''}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{quickWater.map((amount) => <ActionButton key={amount} tone="secondary" label={`+${amount} ml`} onPress={() => void run('Agua añadida.', () => diaryRepository.addWater(date, amount).then(() => undefined))}/>)}</View><NumberField label="Cantidad personalizada (ml)" value={water} onChange={setWater}/><ActionButton label="Añadir agua" onPress={() => void run('Agua añadida.', () => diaryRepository.addWater(date, water).then(() => undefined))}/>{view?.water.map((entry) => <View key={entry.id} style={{ borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10, gap: 8 }}><Text selectable style={{ color: palette.ink }}>{entry.amountMl} ml · {new Date(entry.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}><ActionButton tone="secondary" label="Editar" accessibilityLabel={`Editar agua ${entry.id}`} onPress={() => setWaterEdit({ id: entry.id, amount: entry.amountMl })}/><ActionButton tone="danger" label="Eliminar" accessibilityLabel={`Eliminar agua ${entry.id}`} onPress={() => askAction({ title: 'Eliminar entrada de agua', description: `Se eliminarán ${entry.amountMl} ml del diario.`, confirmLabel: 'Eliminar agua', success: 'Agua eliminada.', danger: true, commit: () => diaryRepository.deleteWater(entry.id) })}/></View></View>)}</Card>
    <Card><SectionTitle eyebrow="Registro mínimo">Entrenamiento diario</SectionTitle><StatusPill label={trained ? 'Entrenamiento registrado' : 'Sin entrenamiento'} tone={trained ? 'good' : 'neutral'}/><WebField key={`type-${view?.training?.updatedAt ?? date}`} label="Tipo de entrenamiento (opcional)" initialValue={trainingType} onInput={(value) => { trainingTypeRef.current = value; }}/><WebField key={`note-${view?.training?.updatedAt ?? date}`} label="Nota de entrenamiento (opcional)" initialValue={trainingNote} onInput={(value) => { trainingNoteRef.current = value; }}/><ActionButton label="Guardar: sí he entrenado" onPress={() => void run('Entrenamiento diario guardado.', () => { const type = document.querySelector<HTMLInputElement>('[aria-label="Tipo de entrenamiento (opcional)"]')?.value ?? trainingTypeRef.current; const note = document.querySelector<HTMLInputElement>('[aria-label="Nota de entrenamiento (opcional)"]')?.value ?? trainingNoteRef.current; return diaryRepository.saveTraining(date, true, type, note).then(() => undefined); })}/><ActionButton tone="secondary" label="Guardar: no he entrenado" onPress={() => void run('Día marcado sin entrenamiento.', () => diaryRepository.saveTraining(date, false, '', '').then(() => undefined))}/></Card>
    <AccessibleDialog
      confirmLabel="Copiar día"
      description={`Se copiarán todas las comidas de ${copyDaySource ?? ''} a ${date} con instantáneas independientes.`}
      onCancel={() => setCopyDaySource(null)}
      onConfirm={() => {
        if (!copyDaySource) return;
        void run('Día copiado con sus snapshots.', async () => {
          await diaryRepository.copyDay(copyDaySource, date);
          setCopyDaySource(null);
        });
      }}
      open={Boolean(copyDaySource)}
      title="Copiar día"
    >
      <Field label="Fecha de origen (AAAA-MM-DD)" value={copyDaySource ?? ''} onChange={setCopyDaySource}/>
    </AccessibleDialog>
    <AccessibleDialog
      confirmLabel="Copiar comida"
      description={`Se creará una copia independiente de ${copyMeal?.label ?? 'la comida'} en ${copyMealTarget}.`}
      onCancel={() => setCopyMeal(null)}
      onConfirm={() => {
        if (!copyMeal) return;
        void run('Comida copiada con sus snapshots.', async () => {
          await diaryRepository.copyMeal(copyMeal.id, copyMealTarget);
          setCopyMeal(null);
        });
      }}
      open={Boolean(copyMeal)}
      title="Copiar comida"
    >
      <Field label="Fecha de destino (AAAA-MM-DD)" value={copyMealTarget} onChange={setCopyMealTarget}/>
    </AccessibleDialog>
    <AccessibleDialog
      confirmLabel="Guardar cantidad"
      description="Solo se modificará esta entrada de agua."
      onCancel={() => setWaterEdit(null)}
      onConfirm={() => {
        if (!waterEdit) return;
        void run('Agua actualizada.', async () => {
          await diaryRepository.updateWater(waterEdit.id, waterEdit.amount);
          setWaterEdit(null);
        });
      }}
      open={Boolean(waterEdit)}
      title="Editar entrada de agua"
    >
      <NumberField label="Nueva cantidad en ml" value={waterEdit?.amount ?? 0} onChange={(amount) => setWaterEdit((current) => current ? { ...current, amount } : null)}/>
    </AccessibleDialog>
    <ConsumptionReviewDialog
      busy={busy}
      choices={reviewChoices}
      ingredients={pendingReview?.ingredients ?? []}
      onCancel={() => { if (!busy) setPendingReview(null); }}
      onChoicesChange={setReviewChoices}
      onConfirm={() => void confirmReview()}
      open={Boolean(pendingReview)}
      title={pendingReview?.title ?? 'Revisar consumo'}
    />
    <AccessibleDialog
      busy={busy}
      confirmLabel={pendingAction?.confirmLabel ?? 'Confirmar'}
      danger={pendingAction?.danger}
      description={pendingAction?.description}
      eyebrow="Confirmación"
      onCancel={() => { if (!busy) setPendingAction(null); }}
      onConfirm={() => void confirmAction()}
      open={Boolean(pendingAction)}
      title={pendingAction?.title ?? 'Confirmar operación'}
    />
  </View>;
}
const mealChoices = [['breakfast', 'Desayuno'], ['lunch', 'Comida'], ['dinner', 'Cena'], ['snack', 'Tentempié']];
function labelFor(type: MealType) { return { breakfast: 'Desayuno', lunch: 'Comida', dinner: 'Cena', snack: 'Tentempié' }[type]; }
function timeFor(meal: MealView) { return new Date(meal.occurredAt ?? meal.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
function NutritionLine({ label, consumed, target, unit }: {
    label: string;
    consumed: number | null;
    target: number;
    unit: string;
}) { return <View style={{ gap: 3 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{label}</Text><Text selectable style={{ color: palette.ink, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{consumed === null ? 'No disponible' : `${consumed.toFixed(1)} / ${target.toFixed(1)} ${unit}`}</Text></View><Text selectable style={{ color: palette.muted }}>{consumed === null ? 'Algún alimento no incluye este dato; no se presenta un total incompleto como exacto.' : `Diferencia: ${(consumed - target).toFixed(1)} ${unit}`}</Text></View>; }
function formatOptional(value: number | null) { return value === null ? 'No disponible' : value.toFixed(1); }
function Field({ label, value, onChange }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) { return <View style={{ gap: 6 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} style={input}/></View>; }
function WebField({ label, initialValue, onInput }: {
    label: string;
    initialValue: string;
    onInput: (value: string) => void;
}) { return <View style={{ gap: 6 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{label}</Text><input aria-label={label} defaultValue={initialValue} onInput={(event) => onInput(event.currentTarget.value)} style={{ ...input, fontFamily: 'inherit' }}/></View>; }
function NumberField({ label, value, onChange }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
}) { return <Field label={label} value={String(value)} onChange={(next) => onChange(Number(next.replace(',', '.')) || 0)}/>; }
function Choice({ label, values, selected, onSelect }: {
    label: string;
    values: string[][];
    selected: string;
    onSelect: (value: string) => void;
}) { return <View style={{ gap: 7 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{values.map(([value = '', text = '']) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: value === selected }} onPress={() => onSelect(value)} style={{ borderWidth: 1, borderColor: value === selected ? palette.greenDark : palette.border, backgroundColor: value === selected ? palette.mint : '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{text}</Text></Pressable>)}</View></View>; }
function Notice({ text, danger = false }: {
    text: string;
    danger?: boolean;
}) { return <View style={{ backgroundColor: danger ? palette.dangerBackground : '#eaf5ff', borderRadius: 14, padding: 12 }}><Text selectable style={{ color: danger ? palette.danger : palette.navySoft, fontWeight: '700' }}>{text}</Text></View>; }
function unitLabel(unit: QuantityUnit) { return { g: 'g', ml: 'ml', unit: 'unidad(es)', portion: 'porción(es)' }[unit]; }
function messageFor(value: unknown) { return value instanceof Error ? value.message : 'Error inesperado.'; }
const input = { borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 13, color: palette.ink, backgroundColor: '#f9fbfa', fontSize: 16 } as const;
