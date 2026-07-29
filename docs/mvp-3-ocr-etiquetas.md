# NutrIAsta MVP 3 — OCR local de etiquetas

Estado: **Fase 0 en validación técnica; versión 0.4.0 no desplegada**

## Alcance

El MVP 3 añade un alta asistida de alimentos a partir de una fotografía local de la
tabla nutricional. El nombre seguirá siendo obligatorio y manual; marca y
supermercado serán opcionales. El usuario revisará y confirmará todos los valores
antes de guardar. La entrada manual seguirá disponible.

Se excluyen códigos de barras, Open Food Facts, búsquedas o APIs externas, OCR
remoto, ingredientes, alérgenos, diagnósticos, analítica, backend y sincronización.

El modelo actual solo conserva energía, proteínas, carbohidratos y grasas. El OCR
puede distinguir filas auxiliares para evitar confusiones, pero no persistirá
grasas saturadas, azúcares, fibra, sal ni sodio. Los campos ausentes permanecerán
vacíos; nunca se estimarán.

## Auditoría de la base 0.3.3

- `nutriasta` permanece histórica, en versión 1 y sin escrituras.
- `nutriasta-main` está en esquema Dexie 6 con 26 tablas pertenecientes a
  `datasetId`.
- `foods` ya contiene los valores por 100 g/ml y procedencia; `foodPhotos` contiene
  JPEG recodificado, miniatura y checksums.
- El flujo actual recodifica localmente a JPEG, limita el lado mayor a 2.048 px y
  el resultado a 4 MB, eliminando metadatos al dibujar sobre canvas.
- El backup 3 exporta las 26 tablas, fotografías y miniaturas con AES-256,
  checksums, límites y restauración por candidato.
- El controlador de actualización espera escrituras y operaciones marcadas como
  bloqueantes; el service worker no usa `skipWaiting`.
- El esquema conserva un índice histórico de `barcode`. No se elimina porque Dexie
  solo admite migraciones aditivas y deben seguir abriendo los datos aprobados. La
  función, búsqueda, captura, validación y edición de códigos se retirarán.

## Candidatos OCR

| Candidato | Resultado |
|---|---|
| Tesseract.js 7 | Seleccionado para la prueba. Apache-2.0, WebAssembly, worker, cancelación por terminación y recursos configurables en el mismo origen. |
| Scribe.js | Descartado. Añade funciones de documentos/PDF innecesarias y usa AGPL-3.0. |
| OCRAD.js | Descartado. GPL-3.0, mantenimiento muy reducido y menor adecuación a tablas europeas. |
| `TextDetector` del navegador | Descartado. API experimental sin disponibilidad fiable en Safari/iPhone. |
| Modelos de visión generalistas | Descartados por tamaño, memoria, mantenimiento y falta de necesidad. |

Dependencias justificadas: `tesseract.js@7.0.0` y
`@tesseract.js-data/spa@1.0.0`. El segundo fija en el lockfile el modelo español
`best_int`; durante la compilación se copiarán únicamente los recursos necesarios
al propio origen. No habrá CDN ni descarga dinámica externa.

## Contrato de privacidad y operaciones

- La foto, el texto OCR y el candidato permanecen en memoria local hasta confirmar.
- Cancelar, recargar o cerrar elimina el candidato sin escrituras funcionales.
- No se registrará texto OCR ni contenido binario en consola o errores.
- Captura, recodificación, OCR, checksum y guardado bloquearán la activación del
  service worker desde antes de empezar.
- El worker podrá terminarse; la UI mostrará texto de progreso y un error
  recuperable.
- El guardado final será una única transacción existente sobre alimento, porciones
  y fotografía.

## Criterios de la prueba aislada

La solución se considera técnicamente razonable si:

1. ejecuta OCR en Chromium y Playwright WebKit con los recursos servidos desde
   `127.0.0.1`;
2. no produce solicitudes externas;
3. reconoce en la etiqueta ficticia al menos energía, grasas, hidratos y proteínas;
4. el worker puede finalizarse para cancelar;
5. el modelo español comprimido y el núcleo caben en el precaché sin superar el
   límite individual de 8 MB;
6. la interfaz permanece responsiva y la prueba de escritorio termina en menos de
   120 segundos;
7. una prueba física posterior confirma tiempos y memoria aceptables en el iPhone.

Playwright WebKit en Windows no equivale a Safari/iPhone. Antes de aprobar el MVP 3
será obligatoria una prueba física de captura, OCR, cancelación, offline, cierre,
actualización y persistencia con fotografías ficticias en el dispositivo.

## Resultado reproducible de la Fase 0

La prueba aislada se ejecutó con Node 24.14.0 en Chromium y Playwright WebKit:

- OCR inicial: 0,6–0,8 s en el equipo de desarrollo;
- confianza informada: 84 % en ambos motores;
- energía, grasas, hidratos y proteínas localizados en la etiqueta ficticia;
- perspectiva, reflejo, poca luz y texto reducido conservaron los cuatro campos;
- la fotografía girada no fue fiable sin corrección y confirma la necesidad del
  control manual de giro antes del OCR;
- la terminación del worker canceló la operación en ambos motores;
- solicitudes externas observadas: cero;
- modelo español `best_int`: 2.100.190 bytes;
- recursos aislados completos de motor, worker y modelo: 28.052.284 bytes;
- memoria JavaScript informada por Chromium: alrededor de 10 MB; WebKit no expone
  `performance.memory`, por lo que la memoria real queda pendiente del iPhone.

Los resultados completos ficticios quedan en
`experiments/ocr-feasibility/results.json`. La variación de tiempos entre rondas se
debe a la inicialización y compilación del núcleo WebAssembly; no se usará un
timeout mayor para ocultar bloqueos.

**Decisión:** la prueba de escritorio/WebKit es satisfactoria para continuar la
implementación local. La compatibilidad definitiva, el consumo de memoria y el
tiempo en Safari/iPhone siguen condicionados a la prueba física; no se presentan
como garantizados.

## Riesgos y parada

- Las fotografías con reflejos, perspectiva fuerte, poco contraste o texto pequeño
  pueden producir resultados parciales. La revisión manual es obligatoria.
- Safari puede finalizar el worker bajo presión de memoria. Se limita la entrada y
  se procesa una sola imagen a la vez.
- El primer OCR tras actualizar debe cargar recursos locales de varios megabytes.
- Si el OCR no funciona offline, produce tráfico externo, bloquea Safari o no
  permite corregir resultados de forma segura, se detendrá el MVP 3.
- La etiqueta `mvp-2-approved-0.3.0` no existe actualmente en el repositorio local;
  la revisión final usará como base técnica el commit de release 0.3.0 `b71a1ba` y
  lo señalará, sin crear ni modificar etiquetas.
