import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { ActionButton, Card, SectionTitle, palette } from '@/components/ui';
import type { ShoppingList, ShoppingListItem } from '@/mvp/inventory-types';
import type { RecipeWithTotals } from '@/mvp/recipe-types';
import {
  fromMilliBase,
  inventoryRepository,
  type InventoryViewItem,
} from '@/storage/inventory-repository.web';
import { recipeRepository } from '@/storage/recipe-repository.web';

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
    setError(null);
    try { await operation(); await refresh(); setMessage(success); }
    catch (caught) { setError(errorMessage(caught)); }
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
            <ActionButton label="Añadir elemento manual" onPress={() => void run('Elemento manual añadido.', async () => {
              await inventoryRepository.addShoppingItem({ text: manualText, quantity: 1, unit: 'unit' });
              setManualText('');
            })} />
          </Card>
          <Card>
            <SectionTitle eyebrow="REVISIÓN">Elementos de compra</SectionTitle>
            {shopping.items.length === 0 ? <Text selectable style={{ color: palette.muted }}>La lista está vacía.</Text> : shopping.items.map((item) => (
              <View key={item.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, gap: 8 }}>
                <Text selectable style={{ color: palette.ink, fontWeight: '900' }}>{item.text}</Text>
                <Text selectable style={{ color: palette.muted }}>{item.quantity} {item.unit} · {item.foodId ? 'vinculado a alimento' : 'entrada manual sin conversión'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <ActionButton label={item.status === 'purchased' ? 'Marcar pendiente' : 'Marcar comprado'} tone="secondary" onPress={() => void run('Estado de compra actualizado.', () => inventoryRepository.markShoppingItem(item.id, item.status !== 'purchased'))} />
                  <ActionButton label={`Eliminar ${item.text} de la compra`} tone="danger" onPress={() => void run('Elemento eliminado de la lista.', () => inventoryRepository.deleteShoppingItem(item.id))} />
                </View>
              </View>
            ))}
            <ActionButton label="Completar compra revisada" onPress={() => {
              if (window.confirm('Se añadirán al inventario únicamente los elementos comprados con equivalencia explícita. ¿Confirmar toda la operación?')) void run('Compra completada atómicamente.', () => inventoryRepository.completeShopping());
            }} />
          </Card>
          {completed.map((list) => <Card key={list.id}><SectionTitle eyebrow="COMPRA COMPLETADA">{list.completedAt ? new Date(list.completedAt).toLocaleString('es-ES') : list.id}</SectionTitle><ActionButton label="Deshacer compra" tone="secondary" onPress={() => { if (window.confirm('Se crearán movimientos inversos. Si algún saldo quedara negativo no cambiará nada.')) void run('Compra deshecha mediante movimientos inversos.', () => inventoryRepository.undoShopping(list.id)); }} /></Card>)}
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
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <View style={{ gap: 6 }}><Text selectable style={{ color: palette.ink, fontWeight: '800' }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} style={input} /></View>; }
function Notice({ text, danger = false }: { text: string; danger?: boolean }) { return <View accessibilityLiveRegion="polite" style={{ backgroundColor: danger ? palette.dangerBackground : palette.mint, borderRadius: 14, padding: 12 }}><Text selectable style={{ color: danger ? palette.danger : palette.greenDark, fontWeight: '800' }}>{text}</Text></View>; }
function errorMessage(value: unknown) { return value instanceof Error ? value.message : 'Error inesperado.'; }
const input = { minHeight: 48, borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 13, color: palette.ink, backgroundColor: '#f9fbfa', fontSize: 16 } as const;
