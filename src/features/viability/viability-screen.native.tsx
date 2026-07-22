import { ScrollView, Text, View } from 'react-native';

import { ActionButton, Card, SectionTitle, StatusPill, palette } from '@/components/ui';
import { MigrationPanel } from '@/features/migration/migration-panel.native';
import { VIABILITY_FIXTURE } from '@/preview/viability-fixtures';

export function ViabilityScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={{ padding: 18, gap: 16 }}
    >
      <View style={{ backgroundColor: palette.navy, borderRadius: 28, padding: 24, gap: 12 }}>
        <StatusPill label="PREVISUALIZACIÓN EXPO GO" tone="warning" />
        <Text selectable style={{ color: '#ffffff', fontSize: 34, fontWeight: '900' }}>NutrIAsta</Text>
        <Text selectable style={{ color: '#d7e5ee', fontSize: 16, lineHeight: 23 }}>
          Esta vista permite revisar la interfaz. No usa IndexedDB y no guarda datos de producción.
        </Text>
      </View>
      <Card>
        <SectionTitle eyebrow="Fixture">Registro ficticio</SectionTitle>
        <Text selectable style={{ color: palette.ink, lineHeight: 21 }}>{VIABILITY_FIXTURE.text}</Text>
        <ActionButton label="Guardado no disponible en Expo Go" disabled onPress={() => undefined} />
      </Card>
      <MigrationPanel />
      <Card>
        <SectionTitle eyebrow="Fixture">Fotografía</SectionTitle>
        <Text selectable style={{ color: palette.muted }}>
          Solo disponible en la PWA. Expo Go no guarda fotografías de producción.
        </Text>
        <ActionButton label="Previsualización sin cámara" disabled onPress={() => undefined} />
      </Card>
      <Card>
        <SectionTitle eyebrow="Solo PWA">Capacidades deshabilitadas</SectionTitle>
        <Text selectable style={{ color: palette.muted, lineHeight: 21 }}>
          IndexedDB, persistencia, cuota, backup, restauración y service worker se validan exclusivamente en Safari y en la PWA instalada.
        </Text>
      </Card>
    </ScrollView>
  );
}
