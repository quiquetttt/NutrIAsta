import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { ActionButton, Card, SectionTitle, palette } from '@/components/ui';
import type { DiaryView, NutritionTotals } from '@/mvp/diary-types';
import type { NutritionTargetPeriod } from '@/mvp/profile-types';
import { madridToday } from '@/mvp/training-date';
import { diaryRepository } from '@/storage/diary-repository.web';
import { inventoryRepository, type InventoryViewItem } from '@/storage/inventory-repository.web';
import { profileRepository } from '@/storage/profile-repository.web';
import { trainingRepository, type WeeklyTrainingSummary } from '@/storage/training-repository.web';
import type { StorageStatus } from '@/storage/dataset-types';

const EMPTY_TOTALS: NutritionTotals = { energyKcal: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 };

export function TodayDashboard({
  storage,
  onOpenDiary,
  onOpenTraining,
  onOpenInventory,
  onOpenSettings,
}: {
  storage: StorageStatus;
  onOpenDiary: () => void;
  onOpenTraining: () => void;
  onOpenInventory: () => void;
  onOpenSettings: () => void;
}) {
  const [diary, setDiary] = useState<DiaryView | null>(null);
  const [target, setTarget] = useState<NutritionTargetPeriod | null>(null);
  const [waterQuickAmounts, setWaterQuickAmounts] = useState([250, 500]);
  const [training, setTraining] = useState<WeeklyTrainingSummary | null>(null);
  const [inventory, setInventory] = useState<InventoryViewItem[]>([]);
  const [shoppingPending, setShoppingPending] = useState(0);
  const [waterBusy, setWaterBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await trainingRepository.initialize();
        const [day, activeTarget, profile, week, stock, list] = await Promise.all([
          diaryRepository.get(madridToday()),
          profileRepository.targetForDate(madridToday()),
          profileRepository.getProfile(),
          trainingRepository.weeklySummary(madridToday()),
          inventoryRepository.list(),
          inventoryRepository.readActiveShoppingList(),
        ]);
        setDiary(day);
        setTarget(activeTarget);
        setWaterQuickAmounts(profile?.waterQuickAmountsMl?.length ? profile.waterQuickAmountsMl : [250, 500]);
        setTraining(week);
        setInventory(stock);
        setShoppingPending(list?.items.filter(({ status }) => status === 'pending').length ?? 0);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No se pudo preparar el resumen local.');
      }
    })();
  }, []);

  const totals = diary?.totals ?? EMPTY_TOTALS;
  const energyPercent = percent(totals.energyKcal, target?.caloriesKcal ?? 0);
  const water = diary?.water.reduce((sum, item) => sum + item.amountMl, 0) ?? 0;
  const depleted = useMemo(() => inventory.filter(({ inventory: item, derivedMilliBase }) => item && derivedMilliBase <= 0), [inventory]);
  const available = useMemo(() => inventory.filter(({ derivedMilliBase }) => derivedMilliBase > 0).length, [inventory]);

  async function addWater(amountMl: number) {
    setWaterBusy(true);
    setError(null);
    setMessage('');
    try {
      await diaryRepository.addWater(madridToday(), amountMl);
      setDiary(await diaryRepository.get(madridToday()));
      setMessage(`${amountMl.toLocaleString('es-ES')} ml de agua añadidos.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo registrar el agua.');
    } finally {
      setWaterBusy(false);
    }
  }

  return (
    <div className="na-today-grid">
      {error ? <div className="na-today-wide"><Notice text={error} /></div> : null}
      {message ? <div className="na-today-wide"><SuccessNotice text={message} /></div> : null}
      <Card style={{ backgroundColor: palette.navy, borderColor: palette.navy }}>
        <SectionTitle eyebrow="TU DÍA"><Text style={{ color: '#fff' }}>{Math.round(totals.energyKcal).toLocaleString('es-ES')} / {Math.round(target?.caloriesKcal ?? 0).toLocaleString('es-ES')} kcal</Text></SectionTitle>
        <Text selectable style={{ color: '#d7e5ee' }}>{energyPercent}% del objetivo manual · valores registrados, no mediciones.</Text>
        <Progress value={energyPercent} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Macro label="P" value={totals.proteinG} target={target?.proteinG ?? 0} />
          <Macro label="C" value={totals.carbohydratesG} target={target?.carbohydratesG ?? 0} />
          <Macro label="G" value={totals.fatG} target={target?.fatG ?? 0} />
        </View>
        <ActionButton label="Ver diario" tone="secondary" onPress={onOpenDiary} />
      </Card>

      <div className="na-today-pair">
        <Card>
          <SectionTitle eyebrow="AGUA">Hoy</SectionTitle>
          <Text selectable style={{ color: palette.ink, fontSize: 25, fontWeight: '900' }}>{water.toLocaleString('es-ES')} ml</Text>
          <Text selectable style={{ color: palette.muted }}>{target?.waterMl ? `Objetivo manual: ${target.waterMl.toLocaleString('es-ES')} ml` : 'Sin objetivo manual'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {waterQuickAmounts.map((amountMl) => (
              <ActionButton
                key={amountMl}
                disabled={waterBusy}
                label={`+${amountMl.toLocaleString('es-ES')} ml`}
                tone="secondary"
                onPress={() => void addWater(amountMl)}
              />
            ))}
          </View>
          <ActionButton label="Abrir detalle del agua" tone="secondary" onPress={onOpenDiary} />
        </Card>
        <Card>
          <SectionTitle eyebrow="ENTRENOS">Esta semana</SectionTitle>
          <Text selectable style={{ color: palette.ink, fontSize: 25, fontWeight: '900' }}>{training?.completed ?? 0} de {training?.goal ?? 4}</Text>
          <Text selectable style={{ color: palette.muted }}>{training?.fulfillmentText ?? 'Preparando resumen local…'}</Text>
          <ActionButton label="Ver calendario" tone="secondary" onPress={onOpenTraining} />
        </Card>
      </div>

      <Card style={depleted.length ? { backgroundColor: palette.warningBackground, borderColor: '#efc979' } : undefined}>
        <SectionTitle eyebrow={depleted.length ? 'ATENCIÓN · INVENTARIO' : 'INVENTARIO'}>{depleted.length ? `${depleted.length} alimento(s) agotado(s)` : `${available} alimento(s) disponibles`}</SectionTitle>
        <Text selectable style={{ color: depleted.length ? palette.warning : palette.muted }}>{shoppingPending} pendiente(s) en la lista de la compra.</Text>
        <ActionButton label={shoppingPending ? 'Revisar lista' : 'Abrir inventario'} tone="secondary" onPress={onOpenInventory} />
      </Card>

      {backupNeedsAttention(storage.lastBackupAt) ? (
        <Card style={{ backgroundColor: palette.warningBackground, borderColor: '#efc979' }}>
          <SectionTitle eyebrow="BACKUP">Copia local pendiente</SectionTitle>
          <Text selectable style={{ color: palette.warning }}>{storage.lastBackupAt ? 'La última copia tiene más de siete días.' : 'Todavía no existe un backup completo.'}</Text>
          <ActionButton label="Abrir backup y restauración" tone="secondary" onPress={onOpenSettings} />
        </Card>
      ) : null}
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return <View accessibilityLabel={`${value} por ciento del objetivo de calorías`} style={{ backgroundColor: '#29435c', borderRadius: 999, height: 10, overflow: 'hidden' }}><View style={{ backgroundColor: palette.green, borderRadius: 999, height: '100%', width: `${Math.min(100, value)}%` }} /></View>;
}
function Macro({ label, value, target }: { label: string; value: number; target: number }) {
  return <Text selectable style={{ backgroundColor: '#17334d', borderRadius: 999, color: '#fff', fontSize: 13, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 7 }}>{label} {Math.round(value)}/{Math.round(target)} g</Text>;
}
function Notice({ text }: { text: string }) {
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: palette.dangerBackground, borderRadius: 16, padding: 14 }}><Text selectable style={{ color: palette.danger, fontWeight: '800' }}>{text}</Text></View>;
}
function SuccessNotice({ text }: { text: string }) {
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: palette.mint, borderRadius: 16, padding: 14 }}><Text selectable style={{ color: palette.greenDark, fontWeight: '800' }}>{text}</Text></View>;
}
function percent(value: number, target: number) { return target > 0 ? Math.max(0, Math.round((value / target) * 100)) : 0; }
function backupNeedsAttention(value: string | null) {
  if (!value) return true;
  return Date.now() - new Date(value).getTime() > 7 * 86_400_000;
}
