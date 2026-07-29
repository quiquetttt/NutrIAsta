# NutrIAsta MVP 3 — OCR local de etiquetas

Estado: **candidato local 0.4.0 implementado y validado automáticamente; no desplegado ni aprobado físicamente**

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

## Decisiones finales de implementación

- El esquema `nutriasta-main` permanece exactamente en Dexie 6 y conserva las 26
  tablas. No se necesitan campos, tablas ni índices nuevos.
- `foods.dataOrigin = "label-photo"` conserva únicamente la procedencia del alta.
  El texto OCR completo solo vive en memoria durante la revisión.
- `foodPhotos` reutiliza la fotografía JPEG recodificada, miniatura, dimensiones,
  tamaño y checksums ya aprobados.
- El formato 4 conserva las 26 tablas, fotografías y procedencia, pero excluye el
  texto OCR. Importa formatos 1, 2, 3 y 4 con el flujo de candidato seguro.
- El campo e índice histórico `barcode` se mantienen dormidos para no destruir
  datos ni cambiar el esquema. No existe captura, formulario, búsqueda, validación
  ni presentación de códigos de barras.
- Tesseract se ejecuta en Web Worker con worker, núcleos y modelo español servidos
  desde el mismo origen y precacheados. No existe fallback remoto.

## Matriz de trazabilidad

| Requisito | Implementación | Evidencia automática | Pendiente físico |
|---|---|---|---|
| Captura trasera o selección | Inputs locales separados, `capture="environment"` para cámara | E2E de selección en Chromium y WebKit | Selector real de Cámara/Fotos/Archivos en iPhone |
| Giro y recorte | Giro 0/90/180/270 y recorte porcentual por lado | E2E con etiqueta ficticia girada | Comodidad táctil y resultado con una foto real ficticia |
| Privacidad fotográfica | Canvas local, JPEG nuevo sin metadatos, 2.048 px, 4 MB, miniatura y checksums | E2E sin tráfico externo y pruebas de persistencia/backup | Confirmar permisos y ausencia de subidas en Safari |
| OCR local y offline | Tesseract.js 7, worker y recursos españoles propios | Chromium/WebKit, privacidad, build y service worker | Tiempo, memoria y apertura offline en el iPhone |
| Cancelación e interrupción | `AbortController`, terminación del worker y candidato solo en memoria | Cancelación y recarga con cero escrituras | Cancelar desde PWA y forzar cierre |
| Parser europeo | 100 g, 100 ml, porción, varias columnas, coma/punto, kJ/kcal y macros admitidos | Unitarias de columnas, ausencias, contradicciones, ambigüedades y unidades | Etiquetas ficticias variadas fotografiadas |
| Revisión obligatoria | Pantalla editable con origen, estado textual, avisos y texto desplegable | E2E de corrección, duplicado y confirmación | VoiceOver, teclado de iOS y zoom de texto |
| Persistencia atómica | Reutiliza transacción de alimento, porciones y fotografía | Unitarias del repositorio y E2E; WebKit/Windows no guarda Blob | Guardar, cerrar, reiniciar y abrir offline en iPhone |
| Backup 4 | AES-256, 26 tablas, fotos y procedencia; sin texto OCR | 26 tablas pobladas, checksums y restauración completa | Exportar a “En mi iPhone” y restaurar físicamente |
| Compatibilidad | Decodificadores 1–4 y datasets temporales | Unitarias de formatos 1, 2, 3 y 4 | Importar un backup 3 real de la versión instalada |
| Actualización controlada | Sin `skipWaiting` automático; espera foto/OCR/escrituras | Dos builds reales 0.3.0→0.4.0 bajo el mismo origen | Actualizar desde la 0.3.3 instalada |
| Responsive y accesibilidad | Sistema `$nutriasta-ux-ui`, safe areas y recursos locales | 320/375/390/430/1280/1440, 200 %, foco, contraste, reduced motion y capturas | VoiceOver y Safari físico |

## Prueba física única para iPhone

Usar exclusivamente una etiqueta creada para la prueba y objetos sin datos
personales. No introducir alimentos ni fotografías reales hasta aprobar toda la
lista.

1. Antes del futuro despliegue, abrir la 0.3.3 instalada, comprobar los datos
   ficticios y guardar un backup formato 3 reciente en “En mi iPhone”.
2. Tras el despliegue autorizado, abrir la PWA sin cerrarla y comprobar que sigue
   mostrando 0.3.3 y no se recarga sola.
3. Esperar el aviso de nueva versión. No pulsarlo todavía y confirmar que la app
   sigue operativa.
4. Iniciar la preparación de una fotografía ficticia y, mientras aparezca la
   operación pendiente, pulsar “Actualizar”. Confirmar que la actualización espera.
5. Cancelar o terminar la preparación y comprobar que solo entonces se activa la
   actualización consentida.
6. Confirmar `Versión 0.4.0`, perfil, diario, entrenamientos, peso, inventario,
   compra, recetas, datasets y fecha del backup anteriores.
7. Abrir Alimentos y comprobar que aparecen “Fotografiar etiqueta nutricional” e
   “Introducir alimento manualmente”, sin ninguna función de código de barras.
8. Abrir Cámara y fotografiar una etiqueta nutricional ficticia con la cámara
   trasera. Cancelar el selector una vez y comprobar que no se guarda nada.
9. Repetir desde Fotos o Archivos y comprobar la vista previa.
10. Girar a izquierda y derecha, ajustar los cuatro recortes y elegir otra imagen.
    Confirmar que ningún control se sale de la pantalla.
11. Procesar una foto nítida. Observar texto de progreso y porcentaje, sin que la
    interfaz quede bloqueada.
12. Cancelar el OCR durante otra ejecución y comprobar que vuelve a un estado
    recuperable y no aparece un alimento nuevo.
13. Iniciar otro OCR, forzar el cierre de la PWA, reabrirla y comprobar que no
    queda candidato ni alimento parcial.
14. Procesar una etiqueta vertical y otra inicialmente girada; corregir el giro
    antes del OCR.
15. Probar, siempre con material ficticio, perspectiva moderada, reflejo, poca luz
    y texto pequeño. Anotar el tiempo aproximado y cualquier cierre de Safari.
16. En “Revisar etiqueta nutricional”, comprobar fotografía, base, columna, valor,
    unidad, origen y estado textual de cada campo.
17. Abrir “Mostrar texto reconocido” y verificar que se puede cerrar y que ningún
    texto sale del dispositivo.
18. Corregir manualmente todos los campos, probar “Editar fotografía”, “Volver a
    fotografiar”, “Introducir manualmente” y “Cancelar”.
19. Crear antes un alimento ficticio con el mismo nombre y confirmar que aparece
    el aviso de posible duplicado.
20. Guardar únicamente tras la confirmación final. Cerrar, forzar cierre,
    reiniciar el iPhone y verificar alimento, valores y fotografía.
21. Activar modo avión, abrir la PWA, repetir un OCR y un alta manual, cerrar y
    reabrir todavía offline.
22. Aumentar el texto de iOS, recorrer el flujo con VoiceOver y confirmar orden de
    lectura, anuncios de progreso/errores, foco de diálogos y controles táctiles.
23. Probar en orientación vertical a 320–430 px equivalentes y confirmar que no
    existe desplazamiento horizontal ni botones fuera del viewport.
24. Exportar un backup formato 4 cifrado y guardarlo en “En mi iPhone”. Confirmar
    su fecha y conservarlo.
25. Modificar el alimento OCR y su fotografía. Restaurar primero con contraseña
    incorrecta y después preparar correctamente, cancelar, activar, hacer rollback,
    reactivar y confirmar.
26. Comprobar que el backup formato 4 recupera las 26 tablas, la fotografía y la
    procedencia, sin presentar ni necesitar el texto OCR original.
27. Importar como candidato el backup formato 3 del paso 1 y comprobar que
    cancelación, activación, rollback, reactivación y confirmación funcionan.
28. Cerrar, reiniciar, abrir offline y verificar los datos restaurados.

La prueba se detiene si hay tráfico externo, pérdida o modificación silenciosa de
datos, activación automática del service worker, escritura al cancelar, cierre por
memoria repetible, ausencia del OCR offline o imposibilidad de conservar a la vez
el dataset activo y el candidato de restauración.
