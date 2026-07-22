import { isValidEan } from '@/mvp/ean';

interface DetectedBarcode { rawValue: string; format: string }
interface BarcodeDetectorInstance { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
interface BarcodeDetectorConstructor { new(options: { formats: string[] }): BarcodeDetectorInstance; getSupportedFormats?: () => Promise<string[]> }

export async function barcodeDetectorStatus() {
  const Detector = (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (!Detector) return { available: false, formats: [] as string[], reason: 'El navegador no ofrece lector local. Usa la entrada manual.' };
  const formats = Detector.getSupportedFormats ? await Detector.getSupportedFormats() : ['ean_13', 'ean_8'];
  const available = formats.includes('ean_13') || formats.includes('ean_8');
  return { available, formats, reason: available ? null : 'El lector local no admite EAN-13/EAN-8.' };
}

export async function detectEanFromImage(file: File): Promise<string> {
  const Detector = (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (!Detector) throw new Error('El lector local no está disponible; introduce el código manualmente.');
  const bitmap = await createImageBitmap(file);
  try { const results = await new Detector({ formats: ['ean_13', 'ean_8'] }).detect(bitmap); const code = results.map((result) => result.rawValue).find(isValidEan); if (!code) throw new Error('No se ha detectado un EAN fiable. Repite la foto o introdúcelo manualmente.'); return code; } finally { bitmap.close(); }
}
