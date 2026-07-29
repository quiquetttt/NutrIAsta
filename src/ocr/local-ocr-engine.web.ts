import { createWorker, OEM, type Worker } from 'tesseract.js';

import { parseNutritionLabel } from '@/ocr/nutrition-label-parser';
import type { NutritionLabelResult, OcrProgress } from '@/ocr/nutrition-label-types';
import { trackUpdateBlockingOperation } from '@/storage/write-tracker';

const OCR_PATH = '/ocr';

export class LocalNutritionOcr {
  private worker: Worker | null = null;

  async recognize(blob: Blob, onProgress: (progress: OcrProgress) => void, signal?: AbortSignal): Promise<NutritionLabelResult> {
    return trackUpdateBlockingOperation(async () => {
      if (blob.size < 1 || blob.size > 4 * 1024 * 1024 || blob.type !== 'image/jpeg') throw new Error('La fotografía preparada no es válida para OCR.');
      if (signal?.aborted) throw new DOMException('Operación cancelada.', 'AbortError');
      let cancelled = false;
      const abort = () => {
        cancelled = true;
        if (this.worker) void this.worker.terminate();
      };
      signal?.addEventListener('abort', abort, { once: true });
      try {
        onProgress({ status: 'Cargando OCR local', progress: null });
        this.worker = await createWorker('spa', OEM.LSTM_ONLY, {
          workerPath: `${OCR_PATH}/worker.min.js`,
          corePath: `${OCR_PATH}/core`,
          langPath: `${OCR_PATH}/lang`,
          cacheMethod: 'none',
          workerBlobURL: false,
          logger: (message) => {
            if (cancelled) return;
            onProgress({
              status: translateStatus(message.status),
              progress: typeof message.progress === 'number' ? message.progress : null,
            });
          },
        });
        if (cancelled || signal?.aborted) throw new DOMException('Operación cancelada.', 'AbortError');
        const result = await this.worker.recognize(blob);
        if (cancelled || signal?.aborted) throw new DOMException('Operación cancelada.', 'AbortError');
        return parseNutritionLabel(result.data.text, result.data.confidence);
      } catch (error) {
        if (cancelled || signal?.aborted) throw new DOMException('Operación cancelada.', 'AbortError');
        throw new Error('No se pudo reconocer la etiqueta localmente. Puedes repetir la foto o introducir los datos manualmente.', { cause: error });
      } finally {
        signal?.removeEventListener('abort', abort);
        if (this.worker) await this.worker.terminate().catch(() => undefined);
        this.worker = null;
      }
    });
  }

  cancel() {
    if (this.worker) void this.worker.terminate();
    this.worker = null;
  }
}

function translateStatus(status: string) {
  const messages: Record<string, string> = {
    'loading tesseract core': 'Cargando motor local',
    'initializing tesseract': 'Preparando motor local',
    'loading language traineddata': 'Cargando idioma español',
    'initializing api': 'Preparando reconocimiento',
    'recognizing text': 'Leyendo etiqueta',
  };
  return messages[status] ?? 'Procesando localmente';
}
