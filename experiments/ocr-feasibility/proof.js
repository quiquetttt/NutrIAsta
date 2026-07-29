/* global Tesseract */
const statusNode = document.querySelector('#status');
const outputNode = document.querySelector('#output');
const canvas = document.querySelector('#label');
let worker = null;

function drawFictitiousLabel() {
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#101820';
  context.font = 'bold 68px Arial';
  context.fillText('INFORMACIÓN NUTRICIONAL', 100, 120);
  context.font = '42px Arial';
  const lines = [
    'Valores medios                 por 100 g    por porción 40 g',
    'Valor energético              1680 kJ      672 kJ',
    '                                400 kcal     160 kcal',
    'Grasas                         12,5 g        5,0 g',
    'de las cuales saturadas         3,0 g        1,2 g',
    'Hidratos de carbono            54,0 g       21,6 g',
    'de los cuales azúcares          7,5 g        3,0 g',
    'Fibra alimentaria               6,0 g        2,4 g',
    'Proteínas                      16,0 g        6,4 g',
    'Sal                             0,80 g       0,32 g',
  ];
  lines.forEach((line, index) => context.fillText(line, 100, 230 + index * 84));
}

function variantCanvas(kind) {
  drawFictitiousLabel();
  if (kind === 'vertical') return canvas;
  const result = document.createElement('canvas');
  if (kind === 'rotated') {
    result.width = canvas.height;
    result.height = canvas.width;
    const context = result.getContext('2d');
    context.translate(result.width, 0);
    context.rotate(Math.PI / 2);
    context.drawImage(canvas, 0, 0);
    return result;
  }
  result.width = canvas.width;
  result.height = canvas.height;
  const context = result.getContext('2d');
  context.fillStyle = kind === 'low-light' ? '#454545' : '#ffffff';
  context.fillRect(0, 0, result.width, result.height);
  if (kind === 'perspective') {
    context.setTransform(0.88, 0.08, -0.05, 0.92, 100, 10);
    context.drawImage(canvas, 0, 0);
  } else if (kind === 'small-text') {
    context.drawImage(canvas, 260, 200, 1080, 810);
  } else {
    context.globalAlpha = kind === 'low-light' ? 0.58 : 1;
    context.drawImage(canvas, 0, 0);
    context.globalAlpha = 1;
    if (kind === 'reflection') {
      const gradient = context.createLinearGradient(450, 0, 850, 0);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.82)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(300, 0, 700, result.height);
    }
  }
  return result;
}

async function createLocalWorker(logger) {
  return Tesseract.createWorker('spa', 1, {
    workerPath: new URL('./assets/worker.min.js', location.href).href,
    corePath: new URL('./assets/core', location.href).href,
    langPath: new URL('./assets/lang', location.href).href,
    logger,
    workerBlobURL: false,
  });
}

async function run() {
  drawFictitiousLabel();
  outputNode.textContent = '';
  const startedAt = performance.now();
  try {
    statusNode.textContent = 'Cargando motor local';
    worker = await createLocalWorker((event) => {
      const percent = typeof event.progress === 'number' ? ` ${Math.round(event.progress * 100)} %` : '';
      statusNode.textContent = `${event.status}${percent}`;
    });
    const result = await worker.recognize(canvas);
    const elapsedMs = Math.round(performance.now() - startedAt);
    outputNode.textContent = result.data.text;
    statusNode.textContent = `Terminada en ${elapsedMs} ms`;
    window.__ocrProofResult = {
      elapsedMs,
      confidence: result.data.confidence,
      text: result.data.text,
      memory: performance.memory
        ? {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
          }
        : null,
    };
  } catch (error) {
    statusNode.textContent = error instanceof Error ? error.message : 'Error local';
    window.__ocrProofResult = { error: statusNode.textContent };
  } finally {
    if (worker) await worker.terminate();
    worker = null;
  }
}

window.__runOcrVariants = async () => {
  const kinds = ['vertical', 'rotated', 'perspective', 'reflection', 'low-light', 'small-text'];
  const results = {};
  worker = await createLocalWorker(() => undefined);
  try {
    for (const kind of kinds) {
      const startedAt = performance.now();
      const recognized = await worker.recognize(variantCanvas(kind), { rotateAuto: true });
      const text = recognized.data.text;
      results[kind] = {
        elapsedMs: Math.round(performance.now() - startedAt),
        confidence: recognized.data.confidence,
        fields: ['energ', 'grasas', 'hidratos', 'prote'].filter((token) => text.toLocaleLowerCase('es').includes(token)),
      };
    }
  } finally {
    await worker.terminate();
    worker = null;
  }
  return results;
};

window.__testOcrCancellation = async () => {
  worker = await createLocalWorker(() => undefined);
  const activeWorker = worker;
  void activeWorker.recognize(variantCanvas('low-light')).catch(() => undefined);
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  const result = await Promise.race([
    activeWorker.terminate().then(() => ({ cancelled: true, terminationTimedOut: false })),
    new Promise((resolve) => window.setTimeout(() => resolve({ cancelled: true, terminationTimedOut: true }), 5000)),
  ]);
  worker = null;
  return result;
};

document.querySelector('#run').addEventListener('click', () => void run());
document.querySelector('#cancel').addEventListener('click', () => {
  if (worker) void worker.terminate();
  worker = null;
  statusNode.textContent = 'Cancelada sin guardar datos';
  window.__ocrProofResult = { cancelled: true };
});

drawFictitiousLabel();
