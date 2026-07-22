import { useRef } from 'react';
import { Text, View } from 'react-native';

import { ActionButton, palette } from '@/components/ui';
import { processTestPhoto } from '@/features/viability/photo-processing.web';
import type { PhotoAsset } from '@/storage/dataset-types';
import { trackUpdateBlockingOperation } from '@/storage/write-tracker';

export function TestPhotoInput({
  disabled,
  onPhoto,
  onError,
}: {
  disabled?: boolean;
  onPhoto: (photo: Omit<PhotoAsset, 'datasetId' | 'id'>) => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const receiveFile = async (file?: File) => {
    if (!file) return;
    try {
      await trackUpdateBlockingOperation(async () => {
        const photo = await processTestPhoto(file);
        await onPhoto(photo);
      });
    } catch (error) {
      onError(error);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <Text selectable style={{ color: palette.muted, fontSize: 13, lineHeight: 19 }}>
        Usa solo una imagen sin personas, etiquetas ni información privada. Se recodifica localmente como JPEG y se eliminan sus metadatos.
      </Text>
      <div style={{ display: 'none' }}>
        <input
          ref={cameraRef}
          aria-label="Capturar fotografía de prueba"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled}
          onChange={(event) => {
            void receiveFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
        <input
          ref={libraryRef}
          aria-label="Seleccionar fotografía de prueba"
          type="file"
          accept="image/*"
          disabled={disabled}
          onChange={(event) => {
            void receiveFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
      </div>
      <View style={{ gap: 10 }}>
        <ActionButton label="Abrir cámara" disabled={disabled} onPress={() => cameraRef.current?.click()} />
        <ActionButton label="Elegir de Fotos" tone="secondary" disabled={disabled} onPress={() => libraryRef.current?.click()} />
      </View>
    </View>
  );
}
