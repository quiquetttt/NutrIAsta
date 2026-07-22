import { Text } from 'react-native';

import { Card, SectionTitle, palette } from '@/components/ui';

export function MigrationPanel() {
  return (
    <Card>
      <SectionTitle eyebrow="Solo PWA">Migración segura</SectionTitle>
      <Text selectable style={{ color: palette.muted, lineHeight: 20 }}>
        Expo Go no abre IndexedDB de producción. La copia entre nutriasta y nutriasta-main se valida únicamente en la PWA.
      </Text>
    </Card>
  );
}
