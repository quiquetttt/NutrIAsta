import { useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { ActionButton, Card, SectionTitle, palette } from '@/components/ui';
import {
  DEFAULT_PHOTO_TRANSFORM,
  prepareFoodLabelPhoto,
  type PhotoTransform,
  type ProcessedFoodLabel,
} from '@/features/foods/food-photo-processing.web';

export function LabelPhotoCapture({
  busy,
  onBusyChange,
  onCancel,
  onPrepared,
}: {
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onPrepared: (value: ProcessedFoodLabel) => void;
}) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [transform, setTransform] = useState<PhotoTransform>(DEFAULT_PHOTO_TRANSFORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(next: File | undefined) {
    if (!next) return;
    setFile(next);
    setTransform(DEFAULT_PHOTO_TRANSFORM);
    setError(null);
  }

  async function process() {
    if (!file) return;
    onBusyChange(true);
    setError(null);
    try {
      onPrepared(await prepareFoodLabelPhoto(file, transform));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo preparar la fotografía.');
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <Card>
      <SectionTitle eyebrow="Solo en este dispositivo">Fotografiar etiqueta nutricional</SectionTitle>
      <Text selectable style={{ color: palette.muted, lineHeight: 21 }}>
        Usa una etiqueta ficticia durante las pruebas. La fotografía se recodifica y pierde sus metadatos antes del OCR.
      </Text>
      {error ? <Notice text={error} /> : null}
      {!file ? (
        <View style={{ gap: 10 }}>
          <ActionButton label="Abrir cámara trasera" disabled={busy} onPress={() => cameraInput.current?.click()} />
          <ActionButton tone="secondary" label="Seleccionar de Fotos o Archivos" disabled={busy} onPress={() => libraryInput.current?.click()} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {preview ? (
            <Image
              accessibilityLabel="Vista previa antes de recodificar"
              source={{ uri: preview }}
              style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 18, transform: [{ rotate: `${transform.rotation}deg` }] }}
            />
          ) : null}
          <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Ajustar imagen</Text>
          <Text selectable style={{ color: palette.muted }}>Gira y recorta los bordes hasta dejar visible la tabla nutricional.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <ActionButton tone="secondary" label="Girar a la izquierda" disabled={busy} onPress={() => setTransform((value) => ({ ...value, rotation: ((value.rotation + 270) % 360) as PhotoTransform['rotation'] }))} />
            <ActionButton tone="secondary" label="Girar a la derecha" disabled={busy} onPress={() => setTransform((value) => ({ ...value, rotation: ((value.rotation + 90) % 360) as PhotoTransform['rotation'] }))} />
          </View>
          <CropFields value={transform} onChange={setTransform} disabled={busy} />
          <ActionButton label={busy ? 'Preparando fotografía…' : 'Usar esta fotografía'} disabled={busy} onPress={() => void process()} />
          <ActionButton tone="secondary" label="Elegir otra fotografía" disabled={busy} onPress={() => libraryInput.current?.click()} />
        </View>
      )}
      <ActionButton tone="secondary" label="Cancelar" disabled={busy} onPress={onCancel} />
      <div style={{ display: 'none' }}>
        <input ref={cameraInput} aria-label="Tomar fotografía de etiqueta" type="file" accept="image/*" capture="environment" onChange={(event) => { choose(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
        <input ref={libraryInput} aria-label="Seleccionar fotografía de etiqueta" type="file" accept="image/*" onChange={(event) => { choose(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
      </div>
    </Card>
  );
}

function CropFields({ value, onChange, disabled }: { value: PhotoTransform; onChange: (value: PhotoTransform) => void; disabled: boolean }) {
  const sides: Array<[keyof PhotoTransform, string]> = [
    ['cropTop', 'Recortar arriba (%)'],
    ['cropRight', 'Recortar derecha (%)'],
    ['cropBottom', 'Recortar abajo (%)'],
    ['cropLeft', 'Recortar izquierda (%)'],
  ];
  return (
    <View style={{ display: 'grid' as never, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' as never, gap: 10 }}>
      {sides.map(([key, label]) => (
        <label key={key} style={{ display: 'grid', gap: 5, color: palette.ink, fontWeight: 700 }}>
          {label}
          <input
            aria-label={label}
            disabled={disabled}
            inputMode="numeric"
            max="45"
            min="0"
            onChange={(event) => onChange({ ...value, [key]: Number(event.currentTarget.value) || 0 })}
            style={{ minWidth: 0, minHeight: 48, border: `1px solid ${palette.border}`, borderRadius: 14, padding: 12, fontSize: 16 }}
            type="number"
            value={value[key]}
          />
        </label>
      ))}
    </View>
  );
}

function Notice({ text }: { text: string }) {
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: palette.dangerBackground, borderRadius: 14, padding: 12 }}><Text selectable style={{ color: palette.danger, fontWeight: '800' }}>{text}</Text></View>;
}
