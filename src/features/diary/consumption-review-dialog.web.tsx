import { Text, View } from 'react-native';

import { AccessibleDialog } from '@/components/accessible-dialog.web';
import { palette } from '@/components/ui';
import type {
  ConsumptionChoice,
  ConsumptionIngredientPlan,
} from '@/storage/inventory-consumption-service.web';

export function ConsumptionReviewDialog({
  open,
  title,
  ingredients,
  choices,
  busy,
  onChoicesChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  ingredients: ConsumptionIngredientPlan[];
  choices: ConsumptionChoice[];
  busy: boolean;
  onChoicesChange: (choices: ConsumptionChoice[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const update = (foodId: string, patch: Partial<ConsumptionChoice>) => {
    onChoicesChange(choices.map((choice) => choice.foodId === foodId ? { ...choice, ...patch } : choice));
  };

  return (
    <AccessibleDialog
      busy={busy}
      confirmLabel="Confirmar consumo"
      description="Revisa todos los ingredientes. Nutrición, inventario, decisiones y compra se escribirán juntos únicamente después de confirmar."
      eyebrow="Revisión antes de cambiar datos"
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={open}
      title={title}
    >
      <View style={{ gap: 12 }}>
        {ingredients.map((ingredient) => {
          const choice = choices.find(({ foodId }) => foodId === ingredient.foodId)!;
          const deducted = choice.decision === 'no-inventory-deduction'
            ? 0
            : choice.decision === 'available-only'
              ? Math.min(ingredient.availableMilliBase, ingredient.requestedMilliBase)
              : ingredient.requestedMilliBase;
          const missing = Math.max(0, ingredient.requestedMilliBase - deducted);
          const final = Math.max(0, ingredient.availableMilliBase - deducted);
          const unit = ingredient.canonicalUnit;
          return (
            <View key={ingredient.foodId} style={{ borderColor: palette.border, borderRadius: 16, borderWidth: 1, gap: 10, padding: 12 }}>
              <Text selectable style={{ color: palette.ink, fontSize: 17, fontWeight: '900' }}>{ingredient.foodName}</Text>
              <dl className="na-review-values">
                <div><dt>Disponible</dt><dd>{formatMilli(ingredient.availableMilliBase)} {unit}</dd></div>
                <div><dt>Solicitado</dt><dd>{formatMilli(ingredient.requestedMilliBase)} {unit}</dd></div>
                <div><dt>Se descontará</dt><dd>{formatMilli(deducted)} {unit}</dd></div>
                <div><dt>Faltante</dt><dd>{formatMilli(missing)} {unit}</dd></div>
                <div><dt>Saldo final</dt><dd>{formatMilli(final)} {unit}</dd></div>
              </dl>
              {ingredient.availableMilliBase < ingredient.requestedMilliBase ? (
                <fieldset className="na-review-options">
                  <legend>Decisión para cantidad insuficiente</legend>
                  <label>
                    <input
                      checked={choice.decision === 'available-only'}
                      name={`decision-${ingredient.foodId}`}
                      onChange={() => update(ingredient.foodId, { decision: 'available-only' })}
                      type="radio"
                    />
                    Descontar solo lo disponible
                  </label>
                  <label>
                    <input
                      checked={choice.decision === 'no-inventory-deduction'}
                      name={`decision-${ingredient.foodId}`}
                      onChange={() => update(ingredient.foodId, { decision: 'no-inventory-deduction' })}
                      type="radio"
                    />
                    No descontar inventario
                  </label>
                </fieldset>
              ) : final === 0 ? (
                <Text selectable style={{ color: palette.warning, fontWeight: '900' }}>⚠ Se va a acabar · el saldo final será 0 {unit}</Text>
              ) : (
                <Text selectable style={{ color: palette.greenDark, fontWeight: '800' }}>Inventario suficiente · descuento completo</Text>
              )}
              {missing > 0 ? (
                <Text selectable style={{ color: palette.warning, fontWeight: '800' }}>
                  La nutrición conservará la cantidad completa y el inventario mostrará una diferencia; no se presentará como saldo exacto.
                </Text>
              ) : null}
              <label className="na-review-shopping">
                <input
                  checked={choice.addToShopping}
                  onChange={(event) => update(ingredient.foodId, { addToShopping: event.currentTarget.checked })}
                  type="checkbox"
                />
                Añadir a la lista de la compra
              </label>
              <Text selectable style={{ color: palette.muted }}>
                Efecto en compra: {choice.addToShopping ? 'se añadirá o actualizará una entrada pendiente' : 'sin cambios'}
              </Text>
            </View>
          );
        })}
      </View>
    </AccessibleDialog>
  );
}

export function defaultConsumptionChoices(ingredients: ConsumptionIngredientPlan[]): ConsumptionChoice[] {
  return ingredients.map((ingredient) => ({
    foodId: ingredient.foodId,
    decision: ingredient.availableMilliBase >= ingredient.requestedMilliBase ? 'full' : 'available-only',
    addToShopping: false,
  }));
}

function formatMilli(value: number) {
  return (value / 1000).toLocaleString('es-ES', { maximumFractionDigits: 3 });
}
