import type { FoodPhotoDraft } from '@/mvp/food-types';
import { trackUpdateBlockingOperation } from '@/storage/write-tracker';
import { sha256Blob } from '@/utils/crypto';

const MAX_BYTES = 4 * 1024 * 1024;
async function canvasJpeg(file: File, maxEdge: number, quality: number) {
  const url = URL.createObjectURL(file); const image = new Image(); image.src = url;
  try { await image.decode(); const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight)); const width = Math.max(1, Math.round(image.naturalWidth * scale)); const height = Math.max(1, Math.round(image.naturalHeight * scale)); const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d', { alpha: false }); if (!context) throw new Error('El navegador no permite procesar la fotografía.'); context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height); const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('No se pudo recodificar la fotografía.')), 'image/jpeg', quality)); return { blob: new Blob([await blob.arrayBuffer()], { type: 'image/jpeg' }), width, height }; } finally { URL.revokeObjectURL(url); }
}
export async function processFoodLabelPhoto(file: File): Promise<FoodPhotoDraft> {
  return trackUpdateBlockingOperation(async () => {
    if (!file.type.startsWith('image/')) throw new Error('Selecciona una imagen de etiqueta.');
    const main = await canvasJpeg(file, 2048, 0.84); if (main.blob.size > MAX_BYTES) throw new Error('La fotografía supera 4 MB después del procesamiento.');
    const thumb = await canvasJpeg(file, 360, 0.72);
    const [checksum, thumbnailChecksum] = await Promise.all([sha256Blob(main.blob), sha256Blob(thumb.blob)]);
    return { blob: main.blob, thumbnail: thumb.blob, mimeType: 'image/jpeg', width: main.width, height: main.height, size: main.blob.size, checksum, thumbnailChecksum, createdAt: new Date().toISOString() };
  });
}
