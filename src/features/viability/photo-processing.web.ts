import type { PhotoAsset } from '@/storage/dataset-types';
import { sha256Blob } from '@/utils/crypto';

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function loadImage(file: File): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (cause) {
    URL.revokeObjectURL(url);
    throw new Error('No se pudo abrir la imagen seleccionada.', { cause });
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la fotografía.'))),
      'image/jpeg',
      quality,
    );
  });
}

async function render(source: LoadedImage, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('El navegador no permite procesar la fotografía.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(source.source, 0, 0, width, height);
  return { blob: await canvasBlob(canvas, quality), width, height };
}

export async function processTestPhoto(file: File): Promise<Omit<PhotoAsset, 'datasetId' | 'id'>> {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen.');
  const source = await loadImage(file);
  try {
    const [main, preview] = await Promise.all([
      render(source, 1600, 0.85),
      render(source, 320, 0.75),
    ]);
    const [checksum, thumbnailChecksum] = await Promise.all([
      sha256Blob(main.blob),
      sha256Blob(preview.blob),
    ]);
    // WebKit can reject canvas-backed Blob instances when IndexedDB serializes them.
    // Rewrapping the bytes creates ordinary, detached blobs without changing content.
    const [blob, thumbnail] = await Promise.all([
      main.blob.arrayBuffer().then((bytes) => new Blob([bytes], { type: 'image/jpeg' })),
      preview.blob.arrayBuffer().then((bytes) => new Blob([bytes], { type: 'image/jpeg' })),
    ]);
    return {
      blob,
      thumbnail,
      mimeType: 'image/jpeg',
      width: main.width,
      height: main.height,
      size: blob.size,
      checksum,
      thumbnailChecksum,
      createdAt: new Date().toISOString(),
    };
  } finally {
    source.release();
  }
}
