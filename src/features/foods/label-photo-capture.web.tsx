import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Text, View } from 'react-native';

import { ActionButton, Card, SectionTitle, palette } from '@/components/ui';
import {
  DEFAULT_PHOTO_TRANSFORM,
  prepareFoodLabelPhoto,
  type PhotoTransform,
  type ProcessedFoodLabel,
} from '@/features/foods/food-photo-processing.web';
import {
  moveCropRect,
  orientedRectToTransform,
  resizeCropRect,
  transformToOrientedRect,
  type CropRect,
} from '@/features/foods/photo-crop-geometry';

export function LabelPhotoCapture({
  busy,
  initialFile = null,
  onBusyChange,
  onCancel,
  onPrepared,
}: {
  busy: boolean;
  initialFile?: File | null;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onPrepared: (value: ProcessedFoodLabel) => void;
}) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(initialFile);
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
          <Text selectable style={{ color: palette.ink, fontWeight: '800' }}>Ajustar imagen</Text>
          <Text selectable style={{ color: palette.muted }}>Gira la foto y ajusta el recorte con los dedos hasta dejar visible la tabla nutricional.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <ActionButton tone="secondary" label="Girar a la izquierda" disabled={busy} onPress={() => setTransform((value) => ({ ...value, rotation: ((value.rotation + 270) % 360) as PhotoTransform['rotation'] }))} />
            <ActionButton tone="secondary" label="Girar a la derecha" disabled={busy} onPress={() => setTransform((value) => ({ ...value, rotation: ((value.rotation + 90) % 360) as PhotoTransform['rotation'] }))} />
          </View>
          {preview ? <TouchCropEditor disabled={busy} preview={preview} value={transform} onChange={setTransform} /> : null}
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
  return <details><summary style={{ minHeight: 44, cursor: 'pointer', color: palette.navy, fontWeight: 800 }}>Ajuste numérico accesible</summary><Text selectable style={{ color: palette.muted, marginBottom: 8 }}>Alternativa a los gestos para teclado, VoiceOver o ajuste preciso.</Text><View style={{ display: 'grid' as never, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))' as never, gap: 10 }}>
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
  </View></details>;
}

type Point = { x: number; y: number };
type Gesture = { rect: CropRect; primary: Point; distance: number; center: Point };

function TouchCropEditor({ preview, value, onChange, disabled }: { preview: string; value: PhotoTransform; onChange: (value: PhotoTransform) => void; disabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const [ratio, setRatio] = useState(4 / 3);
  const rect = transformToOrientedRect(value);

  useEffect(() => {
    const image = new window.Image();
    image.src = preview;
    image.onload = () => {
      const rotated = value.rotation === 90 || value.rotation === 270;
      const naturalWidth = rotated ? image.naturalHeight : image.naturalWidth;
      const naturalHeight = rotated ? image.naturalWidth : image.naturalHeight;
      const scale = Math.min(1, 1200 / Math.max(naturalWidth, naturalHeight));
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = width;
      canvas.height = height;
      setRatio(width / height);
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.translate(width / 2, height / 2);
      context.rotate(value.rotation * Math.PI / 180);
      const drawWidth = (rotated ? height : width);
      const drawHeight = (rotated ? width : height);
      context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    };
  }, [preview, value.rotation]);

  function point(event: ReactPointerEvent<HTMLDivElement>): Point {
    const bounds = editorRef.current!.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width * 100, y: (event.clientY - bounds.top) / bounds.height * 100 };
  }
  function beginGesture() {
    const active = [...pointers.current.values()];
    if (!active.length) { gesture.current = null; return; }
    if (active.length === 1) {
      gesture.current = { rect, primary: active[0]!, distance: 0, center: active[0]! };
      return;
    }
    const [first, second] = active;
    gesture.current = { rect, primary: first!, distance: distance(first!, second!), center: midpoint(first!, second!) };
  }
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, point(event));
    beginGesture();
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, point(event));
    const active = [...pointers.current.values()];
    let next: CropRect;
    if (active.length >= 2) {
      const [first, second] = active;
      const center = midpoint(first!, second!);
      const currentDistance = Math.max(1, distance(first!, second!));
      next = resizeCropRect(gesture.current.rect, gesture.current.distance / currentDistance, gesture.current.center.x, gesture.current.center.y);
      next = moveCropRect(next, center.x - gesture.current.center.x, center.y - gesture.current.center.y);
    } else {
      next = moveCropRect(gesture.current.rect, active[0]!.x - gesture.current.primary.x, active[0]!.y - gesture.current.primary.y);
    }
    onChange(orientedRectToTransform(next, value.rotation));
  }
  function pointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    beginGesture();
  }
  function resize(scale: number) {
    onChange(orientedRectToTransform(resizeCropRect(rect, scale), value.rotation));
  }

  return <View style={{ gap: 9 }}>
    <Text selectable style={{ color: palette.muted }}>Arrastra con un dedo para mover el recorte. Separa dos dedos para acercar y júntalos para mostrar más imagen.</Text>
    <div
      ref={editorRef}
      aria-label="Editor táctil de recorte de la etiqueta"
      onPointerCancel={pointerEnd}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerEnd}
      role="img"
      style={{ aspectRatio: String(ratio), background: '#0d2438', borderRadius: 18, maxHeight: '64vh', overflow: 'hidden', position: 'relative', touchAction: 'none', width: '100%' }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', height: '100%', width: '100%' }} />
      <div aria-hidden style={{ border: '3px solid #fff', borderRadius: 10, boxShadow: '0 0 0 9999px rgba(7, 24, 39, .58)', left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.width}%`, height: `${rect.height}%`, position: 'absolute' }} />
    </div>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <ActionButton tone="secondary" label="Acercar recorte" disabled={disabled} onPress={() => resize(0.82)} />
      <ActionButton tone="secondary" label="Mostrar más imagen" disabled={disabled} onPress={() => resize(1.22)} />
      <ActionButton tone="secondary" label="Restablecer recorte" disabled={disabled} onPress={() => onChange({ ...DEFAULT_PHOTO_TRANSFORM, rotation: value.rotation })} />
    </View>
  </View>;
}

function distance(first: Point, second: Point) { return Math.hypot(second.x - first.x, second.y - first.y); }
function midpoint(first: Point, second: Point): Point { return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }; }

function Notice({ text }: { text: string }) {
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: palette.dangerBackground, borderRadius: 14, padding: 12 }}><Text selectable style={{ color: palette.danger, fontWeight: '800' }}>{text}</Text></View>;
}
