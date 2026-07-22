import { Text, View } from 'react-native';

import { ActionButton, palette } from '@/components/ui';

export function UpdateAvailableBanner({ visible, onUpdate }: { visible: boolean; onUpdate: () => void }) {
  if (!visible) return null;
  return (
    <View style={{ backgroundColor: palette.navy, borderRadius: 18, padding: 16, gap: 10 }}>
      <Text selectable style={{ color: '#ffffff', fontWeight: '800', fontSize: 17 }}>Nueva versión disponible</Text>
      <Text selectable style={{ color: '#dbe8f2', lineHeight: 20 }}>
        La versión actual seguirá activa hasta que elijas actualizar. Se esperará a que terminen las escrituras pendientes.
      </Text>
      <ActionButton label="Actualizar ahora" tone="secondary" onPress={onUpdate} />
    </View>
  );
}
