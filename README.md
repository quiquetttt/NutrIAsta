# NutrIAsta — MVP 1 local (versión 0.2.0)

NutrIAsta es una PWA personal en español para registrar perfil, objetivos manuales, alimentos, comidas, agua, planificación y un indicador diario de entrenamiento. Funciona con IndexedDB mediante Dexie y no tiene cuentas, backend, analítica, telemetría ni sincronización.

> Utiliza exclusivamente datos y fotografías ficticios hasta que la versión 0.2.0 supere la prueba física completa en el iPhone. La persistencia de Safari no está garantizada; conserva backups locales recientes.

## Alcance garantizado

- Perfil local con alias, edad adulta, sexo de referencia de la fórmula, altura, peso y actividad declarada.
- Mifflin–St Jeor, PAL elegido manualmente, mantenimiento y escenarios matemáticos de ±5 % y ±10 %. Son orientación general, no consejo médico.
- Objetivos manuales versionados de calorías, proteínas, carbohidratos, grasas y agua.
- Catálogo manual de alimentos, porciones, favoritos, recientes, supermercado, fotografía local y prueba técnica EAN sin red.
- Diario por fecha con desayuno, comida, cena y tentempié; snapshots nutricionales, agua y entrenamiento mínimo sí/no con nota.
- Recetas manuales, planificación futura, copia de comidas/días y conversión de planificado a consumido sin recalcular el histórico.
- Backup completo formato 2, ZIP cifrado con AES-256, y restauración mediante dataset temporal, verificación y cambio atómico del puntero activo.
- Importación de backups de viabilidad formato 1. La base `nutriasta` 0.1.1 se mantiene en versión 1 y solo lectura; el MVP usa `nutriasta-main` con migraciones aditivas hasta versión 5.
- PWA instalable, apertura offline y actualización controlada sin `skipWaiting` automático.

Quedan excluidos OCR, Open Food Facts, sugerencia automática de PAL, análisis de fotografías, recomendaciones médicas, nube y cualquier API remota. El lector EAN depende de `BarcodeDetector`: si Safari no lo ofrece, la introducción manual sigue disponible y debe validarse físicamente.

## Entorno y dependencias

- Node.js `>=22.13.0` (validado con Node 24.14.0).
- npm y las versiones fijadas en `package-lock.json`.
- Expo SDK 57, React 19.2.3, React Native 0.86 y React Native Web 0.21.
- Chromium y WebKit instalados por Playwright.

Instalación reproducible:

```text
npm ci
npx playwright install chromium webkit
```

No se añadieron dependencias nuevas durante las fases 1–5. Dexie gestiona IndexedDB y `@zip.js/zip.js` realiza ZIP y AES-256; ambas ya estaban justificadas en la prueba de viabilidad.

## Validación local reproducible

```text
npm run typecheck
npm test
npm run build:web
npm run test:e2e
npx expo-doctor
```

`npm run test:e2e` elimina y reconstruye `dist`, elige un puerto libre y arranca un servidor exclusivo con `reuseExistingServer: false`. No reutiliza el puerto 4173 ni servidores anteriores.

Resultados finales locales del 22 de julio de 2026:

- TypeScript: correcto.
- Vitest: 16 archivos y 39 pruebas correctas.
- Exportación estática, manifiesto, iconos y service worker: correctos.
- Playwright: 24 pruebas ejecutables correctas en Chromium/WebKit; 2 omisiones justificadas exclusivamente en WebKit para Windows.
- Expo Doctor: 18/18 comprobaciones correctas.
- Privacidad: ninguna petición de producción a terceros y ninguna API remota.

Las dos omisiones son la reapertura offline bajo service worker y la persistencia de un `Blob` fotográfico. Playwright WebKit en Windows no reproduce esas capacidades de Safari de iPhone de forma fiable. No se omiten las pruebas de backup completo, perfil, alimentos, diario, recetas, migración, actualización ni privacidad.

## Backup completo y restauración segura

El formato 2 usa la extensión `.nutriasta.zip`, cifra cada entrada con AES-256 y nunca guarda la contraseña. Incluye las 14 tablas de datos del dataset activo y las fotografías como entradas independientes.

Antes de escribir en IndexedDB se verifica fuera de cualquier transacción:

- archivo cifrado de hasta 128 MiB;
- máximo 502 entradas y 250 pares de fotografía/miniatura;
- manifiesto de hasta 512 KiB y `data.json` de hasta 16 MiB;
- cada fotografía hasta 8 MiB y miniatura hasta 1 MiB;
- contenido descomprimido total hasta 160 MiB;
- AES obligatorio, rutas permitidas, ausencia de duplicados y archivos no declarados;
- tamaños ZIP, tamaños del manifiesto, progreso real de descompresión y SHA-256;
- versión mínima compatible, tablas exactas, recuentos, identificadores y duplicados.

La preparación exige espacio adicional de `ceil(payload × 1,5) + 10 MiB`. Escribe un dataset `staging` en lotes cortos, vuelve a leer todos los datos y blobs y recalcula su huella. El dataset activo no cambia hasta la confirmación de activación, que solo actualiza metadatos y estados en una transacción breve. Cancelación, rollback y reactivación conservan el dataset anterior; confirmar no lo elimina automáticamente.

`minimumAppVersion` es un mínimo semántico `mayor.menor.parche`: una aplicación posterior puede abrir un backup anterior compatible. Los backups de formato 1 siguen importándose por el flujo heredado de Fase 0.

## Actualización y privacidad

- El service worker no usa `skipWaiting` automáticamente. Muestra un aviso y espera consentimiento.
- Antes de activar espera escrituras y procesamiento local de fotografías pendientes.
- El service worker no abre, migra ni elimina IndexedDB.
- No hay `fetch` de aplicación, CDN, fuentes externas, analítica ni telemetría.
- Las fotografías y backups se procesan en el dispositivo.
- Los datos pueden eliminarse en el futuro desde una función explícita; no se realizan limpiezas silenciosas de datasets de recuperación.

`npm audit` mantiene vulnerabilidades moderadas transitivas de las herramientas nativas de Expo SDK 57 (`@expo/config-plugins`/`xcode`/`uuid`). La solución automática propuesta exige una versión incompatible de Expo. No se ha usado `npm audit fix --force`, no se ha rebajado Expo y `expo-doctor` es correcto. Este riesgo no forma parte del JavaScript que ejecuta la PWA en Safari y queda pendiente de una corrección compatible de Expo.

## Pruebas físicas obligatorias en Safari/iPhone

Estas pruebas requieren un despliegue HTTPS autorizado por separado en el mismo origen. No hay ningún despliegue autorizado por este commit.

1. Antes de actualizar, guardar un backup completo de los datos ficticios actuales y conservar también el backup 0.1.1.
2. Abrir la PWA instalada y comprobar que la versión anterior no se actualiza sola; aceptar la actualización solo desde el aviso.
3. Confirmar `Versión 0.2.0 — MVP 1 local`, el texto y fotografía ficticios heredados y los valores de almacenamiento.
4. Crear un perfil totalmente ficticio y varios periodos de objetivos; cerrar, forzar cierre, reiniciar y comprobarlos.
5. Crear alimentos ficticios con g/ml, porción, supermercado, favorito, foto de objeto y EAN manual; comprobar duplicados, edición y archivo.
6. Probar `BarcodeDetector` con un código ficticio o de prueba. Registrar si Safari no lo ofrece y confirmar que el formulario manual funciona.
7. Registrar comidas, cantidades, agua y entrenamiento ficticio en fechas pasada, actual y futura. Editar después el alimento y los objetivos y confirmar que el histórico no cambia.
8. Crear una receta ficticia, planificarla, copiarla a otra fecha y convertirla a consumida. Reiniciar y repetir la lectura offline.
9. Exportar el backup completo con contraseña ficticia y guardarlo en “En mi iPhone”. Confirmar la fecha de último backup.
10. Modificar perfil, alimento, diario, agua, receta y fotografía. Intentar restaurar con contraseña incorrecta y comprobar que nada cambia.
11. Preparar con la contraseña correcta, cancelar y comprobar el dataset original. Repetir, activar y verificar el contenido exportado.
12. Hacer rollback y comprobar todos los cambios posteriores; reactivar el candidato y confirmar. Cerrar, reiniciar y abrir en modo avión.
13. Confirmar que la base `nutriasta` 0.1.1 sigue disponible e intacta y que no existe tráfico a terceros.

Si se pierde un dato, se activa una actualización sola, aparece tráfico externo, falla la huella, no hay espacio suficiente o el backup no puede mantener simultáneamente el dataset activo y el candidato, la prueba debe detenerse sin desplegar otra versión.

## Futuro despliegue HTTPS — no ejecutar sin autorización

1. Obtener autorización expresa para el commit y la versión exactos.
2. Verificar árbol limpio, Node compatible y ejecutar toda la validación anterior.
3. Ejecutar `npm run build:hosting` y publicar únicamente el contenido estático generado.
4. Mantener el mismo origen privado, servir `sw.js` sin caché HTTP prolongada y no añadir servicios externos.
5. Ejecutar `npm run verify:deployment -- https://URL` y registrar URL, hash y fecha.

No se debe crear repositorio remoto, hacer push ni desplegar una nueva versión sin una autorización independiente.
