import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { StorageStatusCard } from '@/components/storage-status-card';
import { UpdateAvailableBanner } from '@/components/update-available-banner';
import { ActionButton, Card, SectionTitle, StatusPill, palette } from '@/components/ui';
import { ViabilityScreen } from '@/features/viability/viability-screen.web';
import { FoodCatalog } from '@/features/foods/food-catalog.web';
import { DiaryScreen } from '@/features/diary/diary-screen.web';
import { RecipeManager } from '@/features/recipes/recipe-manager.web';
import { FullBackupPanel } from '@/features/backup/full-backup-panel.web';
import { SettingsPrivacy } from '@/features/settings/settings-privacy.web';
import { efsaGeneralReferences, energyScenarios, macroEnergy, maintenanceEstimate, restingEnergyEstimate } from '@/mvp/nutrition-calculations';
import type { FormulaSex, NutritionTargetDraft, NutritionTargetPeriod, PalValue, Profile, ProfileDraft } from '@/mvp/profile-types';
import { pwaUpdateController } from '@/pwa/update-controller.web';
import { readStorageStatus, requestPersistentStorage } from '@/pwa/storage-status.web';
import { mainDatasetRepository } from '@/storage/main-dataset-repository.web';
import { profileRepository } from '@/storage/profile-repository.web';
import { fullBackupService } from '@/backup/full-backup-service.web';
import { APP_VERSION } from '@/storage/schema';
import type { StorageStatus } from '@/storage/dataset-types';

type Tab = 'today' | 'foods' | 'recipes' | 'profile' | 'settings';
const todayMadrid = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
const EMPTY_STORAGE: StorageStatus = { persisted: null, usage: null, quota: null, lastBackupAt: null };

const EMPTY_PROFILE: ProfileDraft = {
  alias: '', age: 22, formulaSex: 'male', heightCm: 175, weightKg: 70,
  gymDaysPerWeek: 0, usualStepsPerDay: 0, otherSportsPerWeek: 0,
  otherSportsDescription: '', pal: 1.4, consent: false,
  waterQuickAmountsMl: [250, 500],
};
const EMPTY_TARGET: NutritionTargetDraft = {
  effectiveFrom: todayMadrid(), caloriesKcal: 0, proteinG: 0, carbohydratesG: 0, fatG: 0, waterMl: null,
};
function draftFromProfile(value: Profile, waterQuickAmountsMl = value.waterQuickAmountsMl ?? [250, 500]): ProfileDraft {
  return {
    alias: value.alias, age: value.age, formulaSex: value.formulaSex,
    heightCm: value.heightCm, weightKg: value.weightKg,
    gymDaysPerWeek: value.gymDaysPerWeek, usualStepsPerDay: value.usualStepsPerDay,
    otherSportsPerWeek: value.otherSportsPerWeek, otherSportsDescription: value.otherSportsDescription,
    pal: value.pal, waterQuickAmountsMl, consent: true,
  };
}

export function MvpScreen() {
  const [ready, setReady] = useState(false);
  const [hasMain, setHasMain] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(EMPTY_PROFILE);
  const [targets, setTargets] = useState<NutritionTargetPeriod[]>([]);
  const [targetDraft, setTargetDraft] = useState<NutritionTargetDraft>(EMPTY_TARGET);
  const [tab, setTab] = useState<Tab>('today');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [updateWaiting, setUpdateWaiting] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [storage, setStorage] = useState<StorageStatus>(EMPTY_STORAGE);
  const [legacyText, setLegacyText] = useState<string | null>(null);
  const [legacyPhoto, setLegacyPhoto] = useState<Blob | null>(null);
  const [legacyPhotoUrl, setLegacyPhotoUrl] = useState<string | null>(null);

  async function refresh() {
    const source = await mainDatasetRepository.getActiveSource();
    const datasetId = await mainDatasetRepository.getActiveMainDatasetId();
    const active = source === 'main' && Boolean(datasetId);
    setHasMain(active);
    if (active) {
      const backupStatus = await fullBackupService.status();
      const [nextProfile, nextTargets, nextStorage, snapshot] = await Promise.all([
        profileRepository.getProfile(), profileRepository.listTargets(), readStorageStatus(backupStatus.lastBackupAt), mainDatasetRepository.getActiveMainSnapshot(),
      ]);
      setProfile(nextProfile);
      setTargets(nextTargets);
      setStorage(nextStorage);
      setLegacyText(snapshot?.records[0]?.text ?? null);
      setLegacyPhoto(snapshot?.photos[0]?.thumbnail ?? null);
      if (nextProfile) {
        setProfileDraft(draftFromProfile(nextProfile));
      }
    }
  }

  useEffect(() => {
    const unsubscribe = pwaUpdateController.subscribe((worker) => setUpdateWaiting(Boolean(worker)));
    const network = () => setOnline(navigator.onLine);
    window.addEventListener('online', network); window.addEventListener('offline', network);
    void (async () => {
      try { await refresh(); await pwaUpdateController.register(); }
      catch (caught) { setError(errorMessage(caught)); }
      finally { setReady(true); }
    })();
    return () => { unsubscribe(); window.removeEventListener('online', network); window.removeEventListener('offline', network); };
  }, []);

  useEffect(() => {
    if (!legacyPhoto) { setLegacyPhotoUrl(null); return; }
    const url = URL.createObjectURL(legacyPhoto); setLegacyPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [legacyPhoto]);

  const estimates = useMemo(() => {
    const input = { weightKg: profileDraft.weightKg, heightCm: profileDraft.heightCm, age: profileDraft.age, formulaSex: profileDraft.formulaSex, pal: profileDraft.pal };
    const resting = restingEnergyEstimate(input);
    const maintenance = maintenanceEstimate(input);
    return { resting, maintenance, scenarios: energyScenarios(maintenance), references: efsaGeneralReferences(profileDraft.weightKg) };
  }, [profileDraft]);
  const activeTarget = useMemo(
    () => [...targets].reverse().find((target) => target.effectiveFrom <= todayMadrid()) ?? null,
    [targets],
  );

  async function run(success: string, operation: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await operation(); await refresh(); setMessage(success); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  if (!ready) return <Loading />;
  if (!hasMain) return <ViabilityScreen />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 64 }}>
      <View testID="mvp-content" style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: 16 }}>
        <View style={{ backgroundColor: palette.navy, borderRadius: 28, padding: 22, gap: 12, boxShadow: '0 18px 50px rgba(7,26,47,.16)' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <StatusPill label="MVP 1 · LOCAL" tone="good"/><StatusPill label={online ? 'Online' : 'Offline'} tone={online ? 'neutral' : 'warning'}/>
          </View>
          <Text selectable style={{ color: '#fff', fontSize: 34, fontWeight: '900' }}>NutrIAsta</Text>
          <Text selectable style={{ color: '#d7e5ee', lineHeight: 22 }}>Registro personal de nutrición. Todos los datos permanecen en este dispositivo.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><StatusPill label={`Versión ${APP_VERSION} — MVP 1 local`} /><StatusPill label="nutriasta-main"/></View>
        </View>
        <UpdateAvailableBanner visible={updateWaiting} onUpdate={() => void run('Activando actualización…', () => pwaUpdateController.activateWaitingUpdate())}/>
        {error ? <Notice danger text={error}/> : message ? <Notice text={message}/> : null}
        {!profile ? (
          <ProfileEditor draft={profileDraft} setDraft={setProfileDraft} estimates={estimates} activeTarget={activeTarget} busy={busy} onboarding onSave={() => run('Perfil local guardado.', async () => { await profileRepository.saveProfile(profileDraft); setTab('profile'); })}/>
        ) : (
          <>
            <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TabButton label="Hoy" selected={tab === 'today'} onPress={() => setTab('today')}/>
              <TabButton label="Alimentos" selected={tab === 'foods'} onPress={() => setTab('foods')}/>
              <TabButton label="Recetas" selected={tab === 'recipes'} onPress={() => setTab('recipes')}/>
              <TabButton label="Perfil y objetivos" selected={tab === 'profile'} onPress={() => setTab('profile')}/>
              <TabButton label="Ajustes y privacidad" selected={tab === 'settings'} onPress={() => setTab('settings')}/>
            </View>
            {tab === 'today' ? <DiaryScreen/> : tab === 'foods' ? <FoodCatalog/> : tab === 'recipes' ? <RecipeManager/> : tab === 'profile' ? (
              <>
                <ProfileEditor draft={profileDraft} setDraft={setProfileDraft} estimates={estimates} activeTarget={activeTarget} busy={busy} onSave={() => run('Perfil actualizado.', () => profileRepository.saveProfile(profileDraft).then(() => undefined))}/>
                <TargetEditor draft={targetDraft} setDraft={setTargetDraft} targets={targets} estimates={estimates} busy={busy} onSave={() => run('Nuevo periodo de objetivos guardado.', async () => { await profileRepository.addTargetPeriod(targetDraft); })}/>
              </>
            ) : (
              <SettingsPrivacy
                waterQuickAmounts={profileDraft.waterQuickAmountsMl ?? [250, 500]}
                storage={storage}
                busy={busy}
                onSaveWater={async (values) => {
                  const persisted = await profileRepository.getProfile();
                  if (!persisted) throw new Error('No existe un perfil activo.');
                  const next = draftFromProfile(persisted, values);
                  await profileRepository.saveProfile(next);
                  setProfileDraft(next);
                  await refresh();
                }}
                onRequestPersistence={() => void run('Solicitud de persistencia completada.', async () => { await requestPersistentStorage(); })}
                onDeleted={async () => {
                  await refresh();
                  setProfileDraft(EMPTY_PROFILE);
                }}
              />
            )}
          </>
        )}
        <FullBackupPanel onChanged={refresh}/>
        {(legacyText || legacyPhotoUrl) ? <Card><SectionTitle eyebrow="Conservación Fase 0">Datos ficticios heredados</SectionTitle>{legacyText ? <Text accessibilityLabel="Texto del registro ficticio" selectable style={{ color: palette.ink }}>{legacyText}</Text> : null}{legacyPhotoUrl ? <Image accessibilityLabel="Miniatura de la fotografía de prueba" source={{ uri: legacyPhotoUrl }} style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: 16 }}/>: null}<Text selectable style={{ color: palette.muted, fontSize: 13 }}>Solo lectura dentro del dataset principal.</Text></Card> : null}
      </View>
    </ScrollView>
  );
}

function ProfileEditor({ draft, setDraft, estimates, activeTarget, busy, onboarding = false, onSave }: { draft: ProfileDraft; setDraft: (value: ProfileDraft) => void; estimates: ReturnType<typeof estimatesForType>; activeTarget: NutritionTargetPeriod | null; busy: boolean; onboarding?: boolean; onSave: () => void }) {
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => setDraft({ ...draft, [key]: value });
  return <>
    {onboarding ? <Card><SectionTitle eyebrow="Bienvenida">Privacidad y consentimiento</SectionTitle><Text selectable style={{ color: palette.muted, lineHeight: 21 }}>NutrIAsta guarda perfil, objetivos y registros solo en IndexedDB de este iPhone. No hay cuenta, nube, analítica ni recuperación remota. Safari puede eliminar almacenamiento web: los backups locales siguen siendo necesarios.</Text><Text selectable style={{ color: palette.warning, lineHeight: 20 }}>No introduzcas alergias, patologías, embarazo ni datos de trastornos alimentarios. La aplicación no ofrece consejo médico.</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Switch accessibilityLabel="Aceptar almacenamiento local" value={draft.consent} onValueChange={(value) => set('consent', value)}/><Text selectable style={{ color: palette.ink, flex: 1 }}>Acepto guardar estos datos localmente en este dispositivo.</Text></View></Card> : null}
    <Card><SectionTitle eyebrow="Perfil">Datos y actividad</SectionTitle>
      <Field label="Alias" value={draft.alias} onChange={(v) => set('alias', v)} />
      <NumberField label="Edad" value={draft.age} onChange={(v) => set('age', v)} />
      <Choice label="Sexo de referencia para Mifflin–St Jeor" values={[['male','Masculino'],['female','Femenino']]} selected={draft.formulaSex} onSelect={(v) => set('formulaSex', v as FormulaSex)}/>
      <Text selectable style={{ color: palette.muted, fontSize: 13 }}>Este parámetro pertenece a la fórmula y no representa identidad de género.</Text>
      <NumberField label="Altura (cm)" value={draft.heightCm} onChange={(v) => set('heightCm', v)} decimal />
      <NumberField label="Peso (kg)" value={draft.weightKg} onChange={(v) => set('weightKg', v)} decimal />
      <NumberField label="Días de gimnasio por semana" value={draft.gymDaysPerWeek} onChange={(v) => set('gymDaysPerWeek', v)} />
      <NumberField label="Pasos habituales al día" value={draft.usualStepsPerDay} onChange={(v) => set('usualStepsPerDay', v)} />
      <NumberField label="Otros deportes por semana" value={draft.otherSportsPerWeek} onChange={(v) => set('otherSportsPerWeek', v)} />
      <Field label="Descripción de otros deportes (opcional)" value={draft.otherSportsDescription} onChange={(v) => set('otherSportsDescription', v)} />
      <Choice label="PAL elegido manualmente" values={[[1.4,'1,4'],[1.6,'1,6'],[1.8,'1,8'],[2,'2,0']]} selected={draft.pal} onSelect={(v) => set('pal', v as PalValue)}/>
      <ActionButton label={onboarding ? 'Crear perfil local' : 'Guardar cambios del perfil'} disabled={busy || !draft.consent} onPress={onSave}/>
    </Card>
    <Orientation estimates={estimates} draft={draft} activeTarget={activeTarget}/>
  </>;
}

function Orientation({ estimates, draft, activeTarget }: { estimates: ReturnType<typeof estimatesForType>; draft: ProfileDraft; activeTarget: NutritionTargetPeriod | null }) {
  const formula = draft.formulaSex === 'male'
    ? '10 × peso (kg) + 6,25 × altura (cm) − 5 × edad (años) + 5'
    : '10 × peso (kg) + 6,25 × altura (cm) − 5 × edad (años) − 161';
  const manualDifference = activeTarget ? activeTarget.caloriesKcal - estimates.maintenance : null;
  return <Card><SectionTitle eyebrow="Estimación">Orientación energética</SectionTitle>
    <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Fórmula de Mifflin–St Jeor</Text>
    <Text selectable style={{ color: palette.muted }}>{formula}</Text>
    <Metric label="Reposo estimado" value={`${Math.round(estimates.resting)} kcal/día`}/><Metric label="Mantenimiento estimado" value={`${Math.round(estimates.maintenance)} kcal/día`}/>
    <Text selectable style={{ color: palette.muted }}>Entradas usadas: {draft.weightKg} kg · {draft.heightCm} cm · {draft.age} años · PAL {draft.pal.toLocaleString('es-ES')}.</Text>
    <Text selectable style={{ color: palette.muted }}>Fecha del cálculo: {todayMadrid()}.</Text>
    {activeTarget ? <Text selectable style={{ color: palette.ink }}>Objetivo manual vigente: {activeTarget.caloriesKcal} kcal/día. Diferencia frente al mantenimiento orientativo: {manualDifference! >= 0 ? '+' : ''}{Math.round(manualDifference!)} kcal/día.</Text> : <Text selectable style={{ color: palette.warning }}>No existe un objetivo manual vigente. La estimación no se usa automáticamente como objetivo.</Text>}
    <View style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 12, gap: 6, backgroundColor: '#f9fbfa' }}>
      <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Ejemplos ilustrativos separados de tus objetivos</Text>
      <Text selectable style={{ color: palette.muted }}>−5 % {Math.round(estimates.scenarios.deficit5)} · −10 % {Math.round(estimates.scenarios.deficit10)} · +5 % {Math.round(estimates.scenarios.surplus5)} · +10 % {Math.round(estimates.scenarios.surplus10)} kcal/día.</Text>
      <Text selectable style={{ color: palette.muted, fontSize: 13 }}>Son cálculos matemáticos de ejemplo. No crean ni modifican objetivos manuales.</Text>
    </View>
    <Text selectable style={{ color: palette.muted }}>Referencia general EFSA: proteína {estimates.references.proteinG.toFixed(1)} g/día (0,83 g/kg), carbohidratos 45–60 % y grasas 20–35 % de la energía. Agua total de alimentos y bebidas: 2,0 L para mujeres y 2,5 L para hombres.</Text>
    <Text selectable style={{ color: palette.warning, lineHeight: 20 }}>Estas cifras son estimaciones generales para registrar hábitos. No son una medición, diagnóstico ni recomendación médica. Tus objetivos manuales no son validados por NutrIAsta.</Text>
  </Card>;
}

function TargetEditor({ draft, setDraft, targets, estimates, busy, onSave }: { draft: NutritionTargetDraft; setDraft: (v: NutritionTargetDraft) => void; targets: NutritionTargetPeriod[]; estimates: ReturnType<typeof estimatesForType>; busy: boolean; onSave: () => void }) {
  const set = <K extends keyof NutritionTargetDraft>(key: K, value: NutritionTargetDraft[K]) => setDraft({ ...draft, [key]: value });
  const implied = macroEnergy(draft.proteinG, draft.carbohydratesG, draft.fatG);
  return <Card><SectionTitle eyebrow="Objetivos manuales">Nuevo periodo de vigencia</SectionTitle>
    <Field label="Fecha efectiva (AAAA-MM-DD)" value={draft.effectiveFrom} onChange={(v) => set('effectiveFrom', v)}/>
    <NumberField label="Calorías (kcal/día)" value={draft.caloriesKcal} onChange={(v) => set('caloriesKcal', v)} decimal/>
    <NumberField label="Proteínas (g/día)" value={draft.proteinG} onChange={(v) => set('proteinG', v)} decimal/>
    <NumberField label="Carbohidratos (g/día)" value={draft.carbohydratesG} onChange={(v) => set('carbohydratesG', v)} decimal/>
    <NumberField label="Grasas (g/día)" value={draft.fatG} onChange={(v) => set('fatG', v)} decimal/>
    <NumberField label="Agua (ml/día; 0 significa sin objetivo)" value={draft.waterMl ?? 0} onChange={(v) => set('waterMl', v === 0 ? null : v)} decimal/>
    <Text selectable style={{ color: palette.muted }}>Los macros introducidos equivalen a {Math.round(implied)} kcal mediante 4/4/9; diferencia frente al objetivo: {Math.round(implied - draft.caloriesKcal)} kcal.</Text>
    <ActionButton tone="secondary" label="Usar mantenimiento estimado como borrador" onPress={() => { if (window.confirm('Esto solo copiará la estimación al formulario. Aún tendrás que guardar el objetivo manual.')) set('caloriesKcal', Math.round(estimates.maintenance)); }}/>
    <ActionButton label="Guardar nuevo periodo" disabled={busy} onPress={onSave}/>
    <Text selectable style={{ color: palette.muted }}>Periodos guardados: {targets.length}. Los anteriores no se sobrescriben.</Text>
  </Card>;
}

function TodayEmpty({ target }: { target: NutritionTargetPeriod | null }) { return <Card><SectionTitle eyebrow={todayMadrid()}>Hoy</SectionTitle><Text selectable style={{ color: palette.ink, fontSize: 24, fontWeight: '800' }}>Todavía no hay consumos</Text><Text selectable style={{ color: palette.muted }}>El diario de comidas se habilitará en la Fase 3.</Text>{target ? <Text selectable style={{ color: palette.ink }}>Objetivo vigente: {target.caloriesKcal} kcal · P {target.proteinG} g · C {target.carbohydratesG} g · G {target.fatG} g.</Text> : <Text selectable style={{ color: palette.warning }}>Aún no existe un periodo de objetivos.</Text>}</Card>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <View style={{ gap: 6 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} style={inputStyle}/></View>; }
function NumberField({ label, value, onChange, decimal = false }: { label: string; value: number; onChange: (v: number) => void; decimal?: boolean }) { return <Field label={label} value={String(value)} onChange={(text) => onChange(Number(text.replace(',', '.')) || 0)}/>; }
function Choice({ label, values, selected, onSelect }: { label: string; values: Array<[string | number,string]>; selected: string | number; onSelect: (v: string | number) => void }) { return <View style={{ gap: 8 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{values.map(([value,text]) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === selected }} key={String(value)} onPress={() => onSelect(value)} style={{ borderRadius: 12, borderWidth: 1, borderColor: value === selected ? palette.greenDark : palette.border, backgroundColor: value === selected ? palette.mint : '#fff', paddingHorizontal: 14, paddingVertical: 10 }}><Text selectable style={{ color: palette.ink, fontWeight: '700' }}>{text}</Text></Pressable>)}</View></View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text selectable style={{ color: palette.muted }}>{label}</Text><Text selectable style={{ color: palette.ink, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text></View>; }
function TabButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={{ minWidth: 112, flexGrow: 1, borderRadius: 14, padding: 13, backgroundColor: selected ? palette.navy : '#fff', borderWidth: 1, borderColor: selected ? palette.navy : palette.border }}><Text selectable style={{ textAlign: 'center', color: selected ? '#fff' : palette.navy, fontWeight: '800' }}>{label}</Text></Pressable>; }
function Notice({ text, danger = false }: { text: string; danger?: boolean }) { return <View style={{ backgroundColor: danger ? palette.dangerBackground : '#eaf5ff', borderRadius: 16, padding: 14 }}><Text selectable style={{ color: danger ? palette.danger : palette.navySoft, fontWeight: '700' }}>{text}</Text></View>; }
function Loading() { return <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ alignItems: 'center', padding: 16 }}><View testID="viability-content" style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: 12 }}><Text selectable style={{ color: palette.ink, fontSize: 28, fontWeight: '900' }}>NutrIAsta</Text><Text selectable>Abriendo almacenamiento local…</Text></View></ScrollView>; }
function estimatesForType() { return { resting: 0, maintenance: 0, scenarios: energyScenarios(0), references: efsaGeneralReferences(0) }; }
const inputStyle = { borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 13, color: palette.ink, backgroundColor: '#f9fbfa', fontSize: 16 } as const;
function errorMessage(value: unknown) { return value instanceof Error ? value.message : 'Se ha producido un error inesperado.'; }
