import { ScrollView, Text } from 'react-native';
import { Card, SectionTitle, StatusPill, palette } from '@/components/ui';

export function MvpScreen() {
  return <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ padding: 18, gap: 16 }}>
    <StatusPill label="PREVISUALIZACIÓN EXPO GO" tone="warning"/>
    <Card><SectionTitle>Perfil y nutrición</SectionTitle><Text selectable style={{ color: palette.muted, lineHeight: 21 }}>Previsualización con datos ficticios. IndexedDB y todos los datos de producción están disponibles exclusivamente en la PWA.</Text></Card>
  </ScrollView>;
}
