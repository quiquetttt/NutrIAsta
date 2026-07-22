# NutrIAsta — Fase 0 de migración segura

La prueba de viabilidad 0.1.1 está aprobada. El código local actual implementa exclusivamente la Fase 0 del MVP 1: copiar y verificar los datos ficticios de la base `nutriasta` en la base paralela `nutriasta-main`, con activación, cancelación, rollback, reactivación, recuperación e importación de backups de formato 1. No contiene todavía perfil, nutrición, entrenamientos, inventario, OCR, escáner, Open Food Facts, recetas ni datos personales reales.

## Reglas y límites de esta fase

- El producto de uso diario es exclusivamente la PWA para iPhone con iOS 17 o posterior.
- Expo Go solo muestra una previsualización de interfaz sin almacenamiento de producción.
- No hay backend, cuentas, analítica, APIs, telemetría ni transmisión de fotografías.
- Se debe utilizar exclusivamente información ficticia y fotografías de objetos sin personas, etiquetas privadas ni datos identificables.
- La persistencia de Safari no está garantizada, incluso si `navigator.storage.persisted()` devuelve `true`.
- `nutriasta` conserva la versión lógica Dexie 1 —versión nativa IndexedDB 10— y sus cuatro tablas originales. La Fase 0 solo la abre mediante transacciones nativas `readonly`.
- `nutriasta-main` es una base diferente, también iniciada en versión lógica 1, y recibe todos los candidatos de migración.
- La implementación local de la Fase 0 no tiene autorización de despliegue. Tampoco se autoriza cambiar la versión 0.1.1.

## Entorno requerido

- Node.js `>=22.13.0`; Expo SDK 57 usa React Native 0.86, React 19.2.3 y React Native Web 0.21.
- npm y las versiones fijadas en `package-lock.json`.
- Chromium y WebKit administrados por Playwright para las E2E locales.
- Expo Go es opcional y sirve solamente para revisar componentes y navegación ficticia.

Instalación reproducible desde una copia limpia:

```text
npm ci
npx playwright install chromium webkit
```

## Validación local reproducible

```text
npm run typecheck
npm test
npm run build:web
npm run test:e2e
npx expo-doctor
```

El paquete exacto para el hosting estático se genera con `npm run build:hosting`. Tras publicar una versión autorizada, `npm run verify:deployment -- https://URL` comprueba HTTPS, manifiesto, iconos, política de caché de `sw.js`, control del service worker, apertura offline y orígenes de las solicitudes.

`npm run build:web` elimina primero la carpeta `dist`, vuelve a exportar la web estática, genera el service worker y verifica automáticamente:

- ancho SSR inicial `width: 100%` y `max-width: 720px`, nunca `width: 0px` en el contenedor principal;
- manifiesto e iconos PWA;
- presencia del flujo `SKIP_WAITING` controlado;
- ausencia de instrucciones para eliminar IndexedDB.

`npm run test:e2e` siempre vuelve a ejecutar esa compilación. Después selecciona un puerto local libre, lo comparte con todos los workers y arranca un servidor exclusivo con `reuseExistingServer: false`. Nunca reutiliza el puerto 4173 ni un servidor anterior o ajeno.

Resultados obtenidos el 22 de julio de 2026 en Windows para la Fase 0:

- TypeScript: correcto.
- Vitest: 8 archivos y 26 pruebas correctas.
- Exportación PWA y verificación de `dist`: correctas.
- Playwright: 16 pruebas correctas; 2 omisiones justificadas en WebKit para Windows.
- Expo Doctor: 18/18 comprobaciones correctas con Node 24.14.0.
- Base 0.1.1: versión, tablas, índices, metadatos, datasets, registros y tamaños de blobs idénticos antes y después de copia, activación, rollback, reactivación y actualización.

Las dos omisiones son exclusivamente:

1. Reapertura offline: Playwright WebKit para Windows devuelve un error interno al navegar sin red bajo control de service worker.
2. Fotografía: Playwright WebKit para Windows no serializa de forma fiable un `Blob` en IndexedDB.

Estas mismas pruebas sí se ejecutan en Chromium. En macOS u otras plataformas no se omiten automáticamente, porque la condición está limitada a WebKit sobre Windows. Safari en el iPhone real sigue siendo la validación obligatoria.

Playwright WebKit para Windows tampoco implementa `navigator.storage.estimate()`. Las E2E que prueban la lógica de migración proporcionan únicamente en el entorno de prueba una estimación ficticia y acotada; el código de producción no incluye ese reemplazo. La disponibilidad y los valores reales de Storage API deben volver a comprobarse en el iPhone.

## Separación y migración de IndexedDB

- Origen: `nutriasta`, Dexie 1 / IndexedDB nativa 10, tablas `metadata`, `datasets`, `viabilityRecords` y `photos`.
- Destino: `nutriasta-main`, Dexie 1 / IndexedDB nativa 10, tablas `metadata`, `datasets`, `migrationRuns`, `legacyViabilityRecords` y `legacyViabilityPhotos`.
- La huella de origen cubre todos los datasets, metadatos, registros y checksums de fotografías, no solo el dataset activo.
- La huella se calcula antes y después de copiar. Un cambio concurrente abandona el candidato.
- La copia se escribe por lotes en `nutriasta-main` y se verifica volviendo a leer blobs y registros.
- La selección de fuente y dataset se cambia en una sola transacción breve de la base nueva.
- Confirmar una migración no elimina `nutriasta`.
- Se exige espacio disponible de `ceil(payload × 1,5) + 10 MiB`. Si la estimación no está disponible, la preparación se detiene.

## Backup y restauración

El archivo `.nutriasta` usa ZIP con cifrado AES-256. Su contraseña no se guarda ni puede recuperarse.

Antes de escribir en IndexedDB se comprueban, fuera de cualquier transacción:

- archivo cifrado de hasta 32 MiB;
- máximo cuatro entradas ZIP y ausencia de rutas desconocidas, duplicadas o inseguras;
- manifiesto de hasta 128 KiB;
- registros de hasta 256 KiB;
- fotografía JPEG de hasta 16 MiB y miniatura de hasta 1 MiB;
- carga declarada total de hasta 18 MiB;
- tamaños del directorio ZIP, tamaños declarados en el manifiesto, tamaños realmente extraídos y checksums SHA-256;
- límites durante el progreso de descompresión para detener contenido expansivo.

`minimumAppVersion` representa una versión mínima, no una igualdad exacta. Las versiones se comparan numéricamente como `mayor.menor.parche`: una aplicación posterior puede abrir un backup anterior, mientras que una versión demasiado antigua rechaza el archivo antes de importarlo. La Fase 0 admite nombres `.nutriasta`, `.zip` y `.nutriasta.zip` sin confiar en el MIME del archivo.

Tras validar el contenido, la restauración escribe un dataset temporal en lotes. Solo cambia `activeDatasetId` en una transacción breve y atómica. El dataset anterior se conserva para cancelación o rollback.

## Actualizaciones PWA

- El service worker no activa `skipWaiting` automáticamente.
- Una versión preparada espera la confirmación del usuario.
- Antes de activarse espera tanto las escrituras IndexedDB como el procesamiento local de una fotografía que todavía no haya llegado a la escritura.
- IndexedDB no forma parte del precaché y el service worker no contiene ninguna eliminación de la base.

## Riesgo pendiente de dependencias

`npm audit` informa actualmente de 10 vulnerabilidades moderadas transitivas en la cadena de herramientas de Expo 57: `expo` → `@expo/config-plugins` → `xcode` → `uuid`, además de paquetes de configuración relacionados. La corrección propuesta por npm rebajaría Expo a 46.0.21, lo que es incompatible con este proyecto.

Se actualizaron únicamente los parches esperados por SDK 57: Expo 57.0.8, expo-constants 57.0.7, expo-linking 57.0.4, expo-router 57.0.8 y react-native-screens 4.26.2. `npx expo-doctor` termina correctamente. No se ha usado `npm audit fix --force`, no se ha aplicado un `override` inseguro y no se ha rebajado Expo. El riesgo queda documentado hasta que Expo publique una corrección compatible con SDK 57; la dependencia vulnerable pertenece a herramientas de configuración nativa y no al código ejecutado por la PWA en Safari.

## Pruebas obligatorias de la Fase 0 en Safari/iPhone

Estas pruebas solo podrán comenzar después de autorizar separadamente un despliegue en el mismo origen HTTPS:

1. Antes de actualizar, abrir la 0.1.1 actual, confirmar el registro y fotografía ficticios y guardar un backup reciente como `.nutriasta.zip` en “En mi iPhone”.
2. Recibir la futura compilación de Fase 0 mediante el aviso controlado y comprobar que no se activa sola.
3. Tras pulsar actualizar, confirmar que aparecen `nutriasta · solo lectura` y `nutriasta-main · paralela` sin cambiar el texto ni la fotografía.
4. Revisar que persistencia, uso y cuota tienen valores reales. Si uso o cuota aparecen como no disponibles, detener la migración.
5. Pulsar `Preparar copia desde 0.1.1` y comprobar que la fuente sigue siendo `nutriasta 0.1.1`.
6. Cerrar y reabrir antes de activar; verificar que el candidato preparado y los datos siguen disponibles.
7. Activar la base paralela y comprobar que texto y fotografía son exactamente los mismos.
8. Cerrar, forzar cierre, reiniciar el iPhone y repetir la comprobación en modo avión.
9. Pulsar `Volver a 0.1.1`, comprobar los datos, reactivar la base paralela y confirmar la migración.
10. Importar el backup formato 1 con contraseña incorrecta; verificar que nada cambia.
11. Importarlo con contraseña correcta, cancelar y comprobar que la fuente activa no cambia.
12. Repetir la importación, activar, hacer rollback y reactivar.
13. Confirmar que no aparece tráfico externo y que la PWA continúa abriendo offline.

La superación de estas pruebas solo demuestra el comportamiento del iPhone probado; iOS puede eliminar almacenamiento web posteriormente.

## Despliegue HTTPS

1. Obtener autorización expresa para cada versión que se vaya a publicar. La Fase 0 local actual no está autorizada para despliegue.
2. Ejecutar `npm ci`, la validación completa y `npm run build:hosting` en un entorno limpio.
3. Publicar exclusivamente el paquete estático generado bajo el mismo origen HTTPS estable.
4. Servir `manifest.webmanifest` con un tipo MIME apropiado y `sw.js` sin caché HTTP prolongada.
5. No añadir analítica, cabeceras que envíen datos a terceros, APIs ni transformación remota de fotografías.
6. Registrar la URL, versión, fecha y hash desplegado antes de comenzar las pruebas del iPhone.

No se publicará una segunda versión sin autorización expresa independiente.
