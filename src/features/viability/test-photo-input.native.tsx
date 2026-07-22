import { Text, View } from 'react-native';

import { ActionButton, palette } from '@/components/ui';

export function TestPhotoInput() {
  return (
    <View style={{ gap: 10 }}>
      <Text selectable style={{ color: palette.muted }}>
        Solo disponible en la PWA. Expo Go no guarda fotografías de producción.
      </Text>
      <ActionButton label="Previsualización sin cámara" disabled onPress={() => undefined} />
    </View>
  );
}
