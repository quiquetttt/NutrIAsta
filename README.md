# NutrIAsta — MVP 1 local (versión 0.2.0)

NutrIAsta es una PWA personal en español para registrar perfil, objetivos manuales, alimentos, comidas, agua, planificación y un indicador diario de entrenamiento. Funciona con IndexedDB mediante Dexie y no tiene cuentas, backend, analítica, telemetría ni sincronización.

> Utiliza exclusivamente datos y fotografías ficticios hasta que la versión 0.2.0 supere la prueba física completa en el iPhone. La persistencia de Safari no está garantizada; conserva backups locales recientes.

## Alcance garantizado

- Perfil local con alias, edad adulta, sexo de referencia de la fórmula, altura, peso y actividad declarada.
- Mifflin–St Jeor, PAL elegido manualmente, mantenimiento y escenarios matemáticos de ±5 % y ±10 %. Son orientación general, no consejo médico.
- Objetivos manuales versionados de calorías, proteínas, carbohidratos, grasas y agua.
- Catálogo manual de alimentos con varias porciones editables, energía declarada o calculada 4/4/9, favoritos, recientes, supermercado, fotografía local sustituible y prueba técnica EAN sin red.
- Diario por fecha con comidas de varios elementos, desayuno, comida, cena y tentempié; unidades base seguras, snapshots nutricionales, notas, agua y entrenamiento mínimo sí/no.
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

Resultados finales locales del 26 de julio de 2026:

- TypeScript: correcto.
- Vitest: 17 archivos y 44 pruebas correctas.
- Exportación estática, manifiesto, iconos y service worker: correctos.
- Playwright: 30 pruebas ejecutables correctas en Chromium/WebKit; 4 omisiones justificadas exclusivamente en WebKit para Windows.
- Expo Doctor: 18/18 comprobaciones correctas.
- Privacidad: ninguna petición de producción a terceros y ninguna API remota.

Las cuatro omisiones son la reapertura offline bajo service worker y tres recorridos que necesitan serializar fotografías `Blob` en IndexedDB: copia de la foto 0.1.1, edición de fotografía de alimento y backup completo con las 14 tablas pobladas. Playwright WebKit en Windows no reproduce esas capacidades de Safari de iPhone de forma fiable. Los mismos recorridos pasan en Chromium y quedan como pruebas físicas obligatorias en Safari/iPhone. No se omiten en WebKit las pruebas de perfil, porciones, energía 4/4/9, diario, unidades g/ml, recetas, migración sin foto, actualización ni privacidad.

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
- `Eliminar todos mis datos` exige escribir `ELIMINAR` y aceptar una segunda confirmación. Borra exclusivamente las filas del dataset activo en las 14 tablas del MVP 1, incluidas sus fotografías.
- Esa acción no elimina la base histórica `nutriasta`, el catálogo técnico de datasets, datasets de rollback, backups guardados en Archivos ni la PWA. No se realizan limpiezas silenciosas de recuperación.

La revisión de `npm audit` del 26 de julio de 2026 informa 17 avisos sin vulnerabilidades críticas: 7 altos y 10 moderados. Se actualizó de forma compatible `brace-expansion` 5.0.7 → 5.0.8 en el árbol de Expo. Permanece otra copia antigua dentro de la cadena de compilación `workbox-build` → plugin Rollup → EJS/Jake/Filelist/Minimatch, para la que la última versión directa compatible de Workbox todavía no ofrece una resolución limpia. Los avisos moderados proceden principalmente de herramientas de Expo SDK 57 (`@expo/config-plugins`/`xcode`/`uuid`); la propuesta automática de npm rebajaría Expo a SDK 46 y es incompatible.

No se ha usado `npm audit fix --force`, no se ha rebajado Expo y `expo-doctor` es correcto. Estas cadenas son herramientas de compilación y configuración, no forman parte del JavaScript funcional que ejecuta la PWA estática en Safari. Quedan documentadas como riesgo pendiente hasta que Expo/Workbox publiquen una corrección compatible.

## Pruebas físicas obligatorias en Safari/iPhone

Estas pruebas requieren un despliegue HTTPS autorizado por separado en el mismo origen. No hay ningún despliegue autorizado por este commit.

1. Antes de actualizar, guardar un backup completo de los datos ficticios actuales y conservar también el backup 0.1.1.
2. Abrir la PWA instalada y comprobar que la versión anterior no se actualiza sola; aceptar la actualización solo desde el aviso.
3. Confirmar `Versión 0.2.0 — MVP 1 local`, el texto y fotografía ficticios heredados y los valores de almacenamiento.
4. Crear un perfil totalmente ficticio, comprobar que se muestran fórmula, entradas, PAL, fecha y `Estimación`, y guardar dos periodos de objetivos. Verificar que copiar mantenimiento pide confirmación.
5. Configurar los accesos de agua como 300 y 600 ml, recargar y comprobar que sustituyen a 250 y 500 ml; después restaurar los valores que se prefieran para la prueba.
6. Crear un alimento ficticio por 100 g con dos porciones. Guardar, recargar, editar otro campo y comprobar que ambas porciones siguen; editar una porción y eliminar la otra con confirmación.
7. Añadir una fotografía ficticia sin información personal. Guardar, recargar, sustituirla por otra y eliminarla con confirmación, comprobando que el alimento permanece.
8. Crear un alimento con energía declarada y otro con energía calculada. Verificar la etiqueta 4/4/9 y el resultado. Crear un alimento por 100 ml y comprobar que el diario nunca ofrece gramos para él ni mililitros para el alimento en gramos.
9. Introducir un EAN manual y tratar de crear realmente un segundo alimento con el mismo código. Debe rechazarse. Probar `BarcodeDetector` con un código de prueba; si Safari no lo ofrece, registrar la limitación y confirmar que el campo manual funciona.
10. En una misma comida, añadir dos alimentos y una receta mediante una porción guardada y una unidad base. Comprobar el subtotal conjunto, la hora, el estado y la nota.
11. Editar cantidad y nota, mover un elemento a otra franja y eliminar otro con confirmación. Comprobar alimentos/recetas/comidas recientes, copiar comida y copiar día.
12. Registrar agua y entrenamiento ficticio. Planificar una fecha futura, verificar que sus totales están separados y convertirla a consumida.
13. Editar después el alimento, receta y objetivo. Volver al día histórico y confirmar que sus snapshots no cambian. Cerrar, forzar cierre, reiniciar el iPhone y repetir la lectura en modo avión.
14. Exportar un backup completo con contraseña ficticia y guardarlo en “En mi iPhone”. Confirmar la fecha de último backup.
15. Modificar perfil, alimento, porciones, diario, agua, receta y fotografía. Intentar restaurar con contraseña incorrecta y comprobar que nada cambia.
16. Preparar con la contraseña correcta, revisar el candidato, cancelar y comprobar el dataset original. Repetir, activar y verificar las 14 clases de datos y fotografías.
17. Hacer rollback y comprobar todos los cambios posteriores; reactivar el candidato y confirmar. Cerrar, reiniciar y abrir en modo avión.
18. En `Ajustes y privacidad`, escribir `ELIMINAR` y cancelar la segunda confirmación: nada debe cambiar. La ejecución real del borrado solo debe probarse después de conservar un backup reciente; debe dejar intactos `nutriasta`, rollback y el archivo guardado.
19. Confirmar que la base `nutriasta` 0.1.1 sigue disponible e intacta, que la actualización no se activa sola y que no existe tráfico a terceros.

Si se pierde un dato, se activa una actualización sola, aparece tráfico externo, falla la huella, no hay espacio suficiente o el backup no puede mantener simultáneamente el dataset activo y el candidato, la prueba debe detenerse sin desplegar otra versión.

## Futuro despliegue HTTPS — no ejecutar sin autorización

1. Obtener autorización expresa para el commit y la versión exactos.
2. Verificar árbol limpio, Node compatible y ejecutar toda la validación anterior.
3. Ejecutar `npm run build:hosting` y publicar únicamente el contenido estático generado.
4. Mantener el mismo origen privado, servir `sw.js` sin caché HTTP prolongada y no añadir servicios externos.
5. Ejecutar `npm run verify:deployment -- https://URL` y registrar URL, hash y fecha.

No se debe crear repositorio remoto, hacer push ni desplegar una nueva versión sin una autorización independiente.
