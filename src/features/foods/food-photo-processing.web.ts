import type { FoodPhotoDraft } from '@/mvp/food-types';
import { trackUpdateBlockingOperation } from '@/storage/write-tracker';
import { sha256Blob } from '@/utils/crypto';

export const FOOD_PHOTO_LIMITS = {
  inputBytes: 20 * 1024 * 1024,
  outputBytes: 4 * 1024 * 1024,
  maxEdge: 2048,
  thumbnailEdge: 360,
} as const;

export interface PhotoTransform {
  rotation: 0 | 90 | 180 | 270;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
}

export interface ProcessedFoodLabel {
  photo: FoodPhotoDraft;
  ocrBlob: Blob;
}

export const DEFAULT_PHOTO_TRANSFORM: PhotoTransform = {
  rotation: 0,
  cropTop: 0,
  cropRight: 0,
  cropBottom: 0,
  cropLeft: 0,
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

function validateTransform(transform: PhotoTransform) {
  const values = [transform.cropTop, transform.cropRight, transform.cropBottom, transform.cropLeft];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 45)) {
    throw new Error('El recorte debe estar entre 0 % y 45 % por lado.');
  }
  if (transform.cropLeft + transform.cropRight >= 90 || transform.cropTop + transform.cropBottom >= 90) {
    throw new Error('El recorte no puede eliminar toda la fotografía.');
  }
}

function validateInput(file: File) {
  const accepted = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
  if (!accepted.has(file.type.toLocaleLowerCase())) throw new Error('Selecciona una fotografía JPEG, PNG, WebP o HEIC compatible.');
  if (file.size < 1 || file.size > FOOD_PHOTO_LIMITS.inputBytes) throw new Error('La fotografía de entrada supera el límite de 20 MB.');
}

async function decode(file: Blob): Promise<DecodedImage> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file);
      if (bitmap.width < 1 || bitmap.height < 1) throw new Error('empty');
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Safari puede decodificar HEIC mediante <img> aunque createImageBitmap no lo haga.
    }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    if (image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error('empty');
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('La fotografía está dañada o el navegador no puede leerla.');
  }
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error('No se pudo recodificar la fotografía.')),
      'image/jpeg',
      quality,
    );
  });
}

async function renderJpeg(decoded: DecodedImage, transform: PhotoTransform, maxEdge: number, quality: number) {
  const sourceX = Math.round(decoded.width * transform.cropLeft / 100);
  const sourceY = Math.round(decoded.height * transform.cropTop / 100);
  const sourceWidth = Math.max(1, Math.round(decoded.width * (100 - transform.cropLeft - transform.cropRight) / 100));
  const sourceHeight = Math.max(1, Math.round(decoded.height * (100 - transform.cropTop - transform.cropBottom) / 100));
  const rotated = transform.rotation === 90 || transform.rotation === 270;
  const naturalWidth = rotated ? sourceHeight : sourceWidth;
  const naturalHeight = rotated ? sourceWidth : sourceHeight;
  const scale = Math.min(1, maxEdge / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('El navegador no permite procesar la fotografía.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.translate(width / 2, height / 2);
  context.rotate(transform.rotation * Math.PI / 180);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(decoded.source, sourceX, sourceY, sourceWidth, sourceHeight, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  const encoded = await canvasBlob(canvas, quality);
  return { blob: new Blob([await encoded.arrayBuffer()], { type: 'image/jpeg' }), width, height };
}

export async function prepareFoodLabelPhoto(file: File, transform = DEFAULT_PHOTO_TRANSFORM): Promise<ProcessedFoodLabel> {
  return trackUpdateBlockingOperation(async () => {
    validateInput(file);
    validateTransform(transform);
    const decoded = await decode(file);
    try {
      let main = await renderJpeg(decoded, transform, FOOD_PHOTO_LIMITS.maxEdge, 0.84);
      for (const quality of [0.72, 0.6, 0.48]) {
        if (main.blob.size <= FOOD_PHOTO_LIMITS.outputBytes) break;
        main = await renderJpeg(decoded, transform, FOOD_PHOTO_LIMITS.maxEdge, quality);
      }
      if (main.blob.size > FOOD_PHOTO_LIMITS.outputBytes) throw new Error('La fotografía supera 4 MB después del procesamiento.');
      const processed = await decode(main.blob);
      let thumb;
      try {
        thumb = await renderJpeg(processed, DEFAULT_PHOTO_TRANSFORM, FOOD_PHOTO_LIMITS.thumbnailEdge, 0.72);
      } finally {
        processed.close();
      }
      const [checksum, thumbnailChecksum] = await Promise.all([sha256Blob(main.blob), sha256Blob(thumb.blob)]);
      return {
        ocrBlob: main.blob,
        photo: {
          blob: main.blob,
          thumbnail: thumb.blob,
          mimeType: 'image/jpeg',
          width: main.width,
          height: main.height,
          size: main.blob.size,
          checksum,
          thumbnailChecksum,
          createdAt: new Date().toISOString(),
        },
      };
    } finally {
      decoded.close();
    }
  });
}

export async function processFoodLabelPhoto(file: File): Promise<FoodPhotoDraft> {
  return (await prepareFoodLabelPhoto(file)).photo;
}
