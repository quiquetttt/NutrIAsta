import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { ActionButton, Card, SectionTitle, palette } from '@/components/ui';
import type { ShoppingList, ShoppingListItem } from '@/mvp/inventory-types';
import type { QuantityUnit } from '@/mvp/diary-types';
import type { RecipeWithTotals } from '@/mvp/recipe-types';
import {
  fromMilliBase,
  inventoryRepository,
  type PurchaseReview,
  type InventoryViewItem,
} from '@/storage/inventory-repository.web';
import { recipeRepository } from '@/storage/recipe-repository.web';
import { AccessibleDialog } from '@/components/accessible-dialog.web';

type ViewName = 'stock' | 'shopping' | 'movements' | 'recipes';

export function InventoryScreen() {
  const [view, setView] = useState<ViewName>('stock');
  const [items, setItems] = useState<InventoryViewItem[]>([]);
  const [shopping, setShopping] = useState<{ list: ShoppingList; items: ShoppingListItem[] } | null>(null);
  const [completed, setCompleted] = useState<ShoppingList[]>([]);
  const [movements, setMovements] = useState<Awaited<ReturnType<typeof inventoryRepository.movements>>>([]);
  const [recipes, setRecipes] = useState<RecipeWithTotals[]>([]);
  const [foodId, setFoodId] = useState('');
  const [amount, setAmount] = useState('100');
  const [manualText, setManualText] = useState('');
  const [manualQuantity, setManualQuantity] = useState('1');
  const [manualUnit, setManualUnit] = useState<QuantityUnit>('unit');
  const [manualNote, setManualNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editUnit, setEditUnit] = useState<QuantityUnit>('unit');
  const [editNote, setEditNote] = useState('');
  const [editFoodId, setEditFoodId] = useState('');
  const [editCanonicalAmount, setEditCanonicalAmount] = useState('');
  const [purchaseReview, setPurchaseReview] = useState<PurchaseReview | null>(null);
  const [undoList, setUndoList] = useState<ShoppingList | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [nextItems, nextShopping, nextCompleted, nextMovements, nextRecipes] = await Promise.all([
      inventoryRepository.list(),
      inventoryRepository.activeShoppingList(),
      inventoryRepository.completedShoppingLists(),
      inventoryRepository.movements(),
      recipeRepository.list(),
    ]);
    setItems(nextItems);
    setShopping(nextShopping);
    setCompleted(nextCompleted);
    setMovements(nextMovements);
    setRecipes(nextRecipes);
    setFoodId((current) => current || nextItems[0]?.food.id || '');
  }
  useEffect(() => { void refresh().catch((caught) => setError(errorMessage(caught))); }, []);
  async function run(success: string, operation: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await operation(); await refresh(); setMessage(success); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }
  async function preparePurchase() {
    setBusy(true);
    setError(null);
    try { setPurchaseReview(await inventoryRepository.preparePurchaseReview()); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }
  function edit(item: ShoppingListItem) {
    setEditingId(item.id);
    setEditText(item.text);
    setEditQuantity(String(item.quantity));
    setEditUnit(item.unit);
    setEditNote(item.note);
    setEditFoodId(item.foodId ?? '');
    setEditCanonicalAmount(item.canonicalAmountMilliBase === undefined ? '' : String(fromMilliBase(item.canonicalAmountMilliBase)));
  }
  const selected = items.find(({ food }) => food.id === foodId);

  return (
    <>
      {error ? <Notice danger text={error} /> : message ? <Notice text={message} /> : null}
      <div aria-label="Secciones de inventario" className="na-section-nav" role="tablist">
        {([['stock', 'Disponibles'], ['shopping', 'Lista de la compra'], ['movements', 'Movimientos'], ['recipes', 'Recetas disponibles']] as Array<[ViewName, string]>).map(([id, label]) => (
          <button aria-selected={view === id} key={id} onClick={() => setView(id)} role="tab" type="button">{label}</button>
        ))}
      </div>

      {view === 'stock' ? (
        <>
          <Card>
            <SectionTitle eyebrow="INVENTARIO">Añadir o ajustar existencias</SectionTitle>
            <Text selectable style={{ color: palette.muted }}>Unidad canónica: gramos para alimentos por 100 g y mililitros para alimentos por 100 ml. Nunca se inventan conversiones.</Text>
            {items.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{items.map(({ food }) => <Choice key={food.id} label={food.name} selected={foodId === food.id} onPress={() => setFoodId(food.id)} />)}</View> : <Text selectable style={{ color: palette.warning }}>Crea primero alimentos en el catálogo.</Text>}
            <Field label={`Cantidad canónica${selected ? ` (${selected.food.baseUnit})` : ''}`} value={amount} onChange={setAmount} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <ActionButton label="Añadir al inventario" onPress={() => void run('Existencias añadidas mediante un movimiento.', async () => { await inventoryRepository.addStock(foodId, Number(amount.replace(',', '.'))); })} />
              <ActionButton label="Retirar del inventario" tone="secondary" onPress={() => void run('Existencias retiradas mediante un movimiento.', async () => { await inventoryRepository.removeStock(foodId, Number(amount.replace(',', '.'))); })} />
            </View>
          </Card>
          {items.map(({ food, inventory, derivedMilliBase, reconciled }) => (
            <Card key={food.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <SectionTitle eyebrow={food.baseUnit === 'g' ? 'GRAMOS' : 'MILILITROS'}>{food.name}</SectionTitle>
                <Text selectable style={{ color: inventory?.balanceMilliBase ? palette.greenDark : palette.muted, fontSize: 22, fontWeight: '900' }}>{fromMilliBase(inventory?.balanceMilliBase ?? 0).toLocaleString('es-ES')} {food.baseUnit}</Text>
              </View>
              <Text selectable style={{ color: palette.muted }}>Saldo derivado de movimientos: {fromMilliBase(derivedMilliBase).toLocaleString('es-ES')} {food.baseUnit}.</Text>
              {!reconciled ? <Notice danger text="El saldo materializado no coincide con los movimientos. Se bloquean operaciones hasta revisar." /> : null}
              <ActionButton label={`Añadir ${food.name} a la compra`} tone="secondary" onPress={() => void run('Alimento añadido a la lista.', () => inventoryRepository.addShoppingItem({ foodId: food.id, text: food.name, quantity: 1, unit: food.baseUnit, canonicalAmount: 100, source: 'manual' }).then(() => undefined))} />
            </Card>
          ))}
        </>
      ) : null}

      {view === 'shopping' && shopping ? (
        <>
          <Card>
            <SectionTitle eyebrow="LISTA ACTIVA">Añadir a mano</SectionTitle>
            <Field label="Texto del elemento de compra" value={manualText} onChange={setManualText} />
            <Field label="Cantidad del elemento manual" value={manualQuantity} onChange={setManualQuantity} />
            <ChoiceGroup label="Unidad del elemento manual" value={manualUnit} onChange={(value) => setManualUnit(value as QuantityUnit)} options={[['unit', 'Unidades'], ['portion', 'Envases o porciones'], ['g', 'Gramos'], ['ml', 'Mililitros']]} />
            <Field label="Nota del elemento manual" value={manualNote} onChange={setManualNote} />
            <ActionButton label="Añadir elemento manual" onPress={() => void run('Elemento manual añadido.', async () => {
              await inventoryRepository.addShoppingItem({ text: manualText, quantity: Number(manualQuantity.replace(',', '.')), unit: manualUnit, note: manualNote });
              setManualText('');
              setManualQuantity('1');
              setManualUnit('unit');
              setManualNote('');
            })} />
          </Card>
          <Card>
            <SectionTitle eyebrow="REVISIÓN">Elementos de compra</SectionTitle>
            {shopping.items.length === 0 ? <Text selectable style={{ color: palette.muted }}>La lista está vacía.</Text> : shopping.items.map((item) => (
              <View key={item.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, gap: 8 }}>
                <Text selectable style={{ color: palette.ink, fontWeight: '900' }}>{item.text}</Text>
                <Text selectable style={{ color: palette.muted }}>{item.quantity} {item.unit} · {item.foodId ? `vinculado · equivalencia ${item.canonicalAmountMilliBase === undefined ? 'pendiente' : `${fromMilliBase(item.canonicalAmountMilliBase)} ${item.canonicalUnit}`}` : 'entrada manual sin vincular'}</Text>
                {item.note ? <Text selectable style={{ color: palette.muted }}>Nota: {item.note}</Text> : null}
                {editingId === item.id ? (
                  <View style={{ backgroundColor: '#f7faf8', borderRadius: 14, padding: 12, gap: 9 }}>
                    <Field label={`Editar texto de ${item.text}`} value={editText} onChange={setEditText} />
                    <Field label={`Editar cantidad de ${item.text}`} value={editQuantity} onChange={setEditQuantity} />
                    <ChoiceGroup label="Unidad" value={editUnit} onChange={(value) => setEditUnit(value as QuantityUnit)} options={[['unit', 'Unidades'], ['portion', 'Envases o porciones'], ['g', 'Gramos'], ['ml', 'Mililitros']]} />
                    <Field label={`Editar nota de ${item.text}`} value={editNote} onChange={setEditNote} />
                    <ChoiceGroup label="Vincular a alimento" value={editFoodId} onChange={(value) => { setEditFoodId(value); setEditCanonicalAmount(''); }} options={[['', 'Sin vincular'], ...items.map(({ food }) => [food.id, food.name])]} />
                    {editFoodId ? <Field label={`Equivalencia total con ${items.find(({ food }) => food.id === editFoodId)?.food.baseUnit ?? 'unidad base'}`} value={editCanonicalAmount} onChange={setEditCanonicalAmount} /> : <Notice text="Una entrada sin vincular no puede completarse ni incorporarse silenciosamente al inventario." />}
                    <ActionButton label={`Guardar cambios de ${item.text}`} disabled={busy} onPress={() => void run('Elemento de compra actualizado.', () => inventoryRepository.updateShoppingItem(item.id, {
                      text: editText,
                      quantity: Number(editQuantity.replace(',', '.')),
                      unit: editUnit,
                      note: editNote,
                      foodId: editFoodId || undefined,
                      canonicalAmount: editFoodId ? Number(editCanonicalAmount.replace(',', '.')) : undefined,
                    }).then(() => { setEditingId(null); }))} />
                    <ActionButton label="Cancelar edición" tone="secondary" onPress={() => setEditingId(null)} />
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <ActionButton label={`Editar ${item.text}`} tone="secondary" onPress={() => edit(item)} />
                    <ActionButton label={item.status === 'purchased' ? 'Marcar pendiente' : 'Marcar comprado'} tone="secondary" onPress={() => void run('Estado de compra actualizado.', () => inventoryRepository.markShoppingItem(item.id, item.status !== 'purchased'))} />
                    <ActionButton label={`Eliminar ${item.text} de la compra`} tone="danger" onPress={() => void run('Elemento eliminado de la lista.', () => inventoryRepository.deleteShoppingItem(item.id))} />
                  </View>
                )}
              </View>
            ))}
            <ActionButton label="Revisar y completar compra" disabled={busy} onPress={() => void preparePurchase()} />
          </Card>
          {completed.map((list) => <Card key={list.id}><SectionTitle eyebrow={list.undoneAt ? 'COMPRA DESHECHA' : 'COMPRA COMPLETADA'}>{list.completedAt ? new Date(list.completedAt).toLocaleString('es-ES') : list.id}</SectionTitle>{list.undoneAt ? <Text selectable style={{ color: palette.muted }}>Deshecha el {new Date(list.undoneAt).toLocaleString('es-ES')} sin duplicar la lista activa.</Text> : <ActionButton label="Deshacer compra" tone="secondary" onPress={() => setUndoList(list)} />}</Card>)}
        </>
      ) : null}

      {view === 'movements' ? (
        <Card>
          <SectionTitle eyebrow="FUENTE DE VERDAD">Movimientos trazables</SectionTitle>
          {movements.length === 0 ? <Text selectable style={{ color: palette.muted }}>Todavía no hay movimientos.</Text> : movements.map((movement) => {
            const food = items.find(({ food: candidate }) => candidate.id === movement.foodId)?.food;
            return <View key={movement.id} style={{ paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: palette.border }}><Text selectable style={{ color: palette.ink, fontWeight: '800' }}>{food?.name ?? 'Alimento'} · {movement.deltaMilliBase > 0 ? '+' : ''}{fromMilliBase(movement.deltaMilliBase)} {movement.canonicalUnit}</Text><Text selectable style={{ color: palette.muted }}>{movement.kind} · saldo posterior {fromMilliBase(movement.balanceAfterMilliBase)} · {movement.occurredAt}</Text></View>;
          })}
        </Card>
      ) : null}

      {view === 'recipes' ? <RecipeAvailability recipes={recipes} inventory={items} /> : null}
      <AccessibleDialog
        busy={busy}
        confirmDisabled={Boolean(purchaseReview?.items.some(({ outcome }) => outcome === 'blocked'))}
        confirmLabel="Confirmar compra"
        description="Los elementos comprados se incorporarán al inventario y los no comprados permanecerán en la lista activa. Nada cambia hasta confirmar."
        eyebrow="Revisión completa"
        onCancel={() => { if (!busy) setPurchaseReview(null); }}
        onConfirm={() => {
          if (!purchaseReview) return;
          void run('Compra completada atómicamente.', async () => {
            await inventoryRepository.completeShopping(purchaseReview);
            setPurchaseReview(null);
          });
        }}
        open={Boolean(purchaseReview)}
        title="Revisar compra"
      >
        <View style={{ gap: 10 }}>
          {purchaseReview?.items.map((item) => (
            <View key={item.itemId} style={{ borderColor: palette.border, borderRadius: 14, borderWidth: 1, gap: 5, padding: 11 }}>
              <Text selectable style={{ color: palette.ink, fontWeight: '900' }}>{item.text}</Text>
              <Text selectable style={{ color: palette.muted }}>{item.quantity} {item.unit} · {item.purchased ? 'Comprado' : 'No comprado'}</Text>
              <Text selectable style={{ color: item.outcome === 'blocked' ? palette.danger : palette.greenDark, fontWeight: '800' }}>
                {item.outcome === 'blocked' ? item.blockingReason : item.outcome === 'keep-active' ? 'Permanecerá en la lista activa' : `Inventario: ${fromMilliBase(item.balanceBeforeMilliBase ?? 0)} → ${fromMilliBase(item.balanceAfterMilliBase ?? 0)} ${item.canonicalUnit}`}
              </Text>
            </View>
          ))}
        </View>
      </AccessibleDialog>
      <AccessibleDialog
        busy={busy}
        confirmLabel="Deshacer compra"
        danger
        description="Se crearán movimientos inversos. Si alguna existencia quedara negativa, la operación completa se cancelará sin cambios. Si ya existe otra lista activa, los elementos se reabrirán en ella sin duplicarla."
        eyebrow="Operación reversible"
        onCancel={() => { if (!busy) setUndoList(null); }}
        onConfirm={() => {
          if (!undoList) return;
          void run('Compra deshecha mediante movimientos inversos.', async () => {
            await inventoryRepository.undoShopping(undoList.id);
            setUndoList(null);
          });
        }}
        open={Boolean(undoList)}
        title="Deshacer compra"
      />
    </>
  );
}

function RecipeAvailability({ recipes, inventory }: { recipes: RecipeWithTotals[]; inventory: InventoryViewItem[] }) {
  return <>{recipes.length === 0 ? <Card><Text selectable style={{ color: palette.muted }}>Todavía no hay recetas.</Text></Card> : recipes.map((recipe) => {
    const parts = recipe.items.map((ingredient) => {
      const stock = inventory.find(({ food }) => food.id === ingredient.foodId);
      if (!stock || stock.food.baseUnit !== ingredient.foodSnapshot.baseUnit) return { name: ingredient.foodSnapshot.name, state: 'Unidad incompatible' };
      const available = fromMilliBase(stock.inventory?.balanceMilliBase ?? 0);
      return { name: ingredient.foodSnapshot.name, state: available >= ingredient.amountBase ? 'Disponible' : `Faltan ${(ingredient.amountBase - available).toLocaleString('es-ES')} ${stock.food.baseUnit}` };
    });
    const available = parts.every(({ state }) => state === 'Disponible');
    return <Card key={recipe.id}><SectionTitle eyebrow={available ? 'DISPONIBLE' : 'REVISAR INVENTARIO'}>{recipe.name}</SectionTitle>{parts.map((part) => <Text key={part.name} selectable style={{ color: part.state === 'Disponible' ? palette.greenDark : palette.warning }}>{part.name}: {part.state}</Text>)}</Card>;
  })}</>;
}
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <button aria-pressed={selected} className="na-choice" onClick={onPress} type="button">{label}</button>; }
function ChoiceGroup({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <View style={{ gap: 7 }}><Text selectable style={{ color: palette.ink, fontWeight: '800' }}>{label}</Text><View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{options.map(([id = '', text = '']) => <button aria-pressed={value === id} className="na-choice" key={id || 'none'} onClick={() => onChange(id)} type="button">{text}</button>)}</View></View>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <View style={{ gap: 6 }}><Text selectable style={{ color: palette.ink, fontWeight: '800' }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} style={input} /></View>; }
function Notice({ text, danger = false }: { text: string; danger?: boolean }) { return <View accessibilityLiveRegion="polite" style={{ backgroundColor: danger ? palette.dangerBackground : palette.mint, borderRadius: 14, padding: 12 }}><Text selectable style={{ color: danger ? palette.danger : palette.greenDark, fontWeight: '800' }}>{text}</Text></View>; }
function errorMessage(value: unknown) { return value instanceof Error ? value.message : 'Error inesperado.'; }
const input = { minHeight: 48, borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 13, color: palette.ink, backgroundColor: '#f9fbfa', fontSize: 16 } as const;
