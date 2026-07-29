# NutrIAsta — MVP 2 local (versión 0.3.2)

NutrIAsta es una PWA personal en español para registrar nutrición, entrenamiento, peso, inventario doméstico y compra. Funciona con IndexedDB mediante Dexie y no tiene cuentas, backend, analítica, telemetría ni sincronización.

> Utiliza exclusivamente datos y fotografías ficticios hasta que el parche 0.3.2 supere su comprobación física en el iPhone. Después, antes de empezar el uso real, conserva un backup completo reciente. La persistencia de Safari no está garantizada.

## Alcance garantizado

- Perfil local con alias, edad adulta, sexo de referencia de la fórmula, altura, peso y actividad declarada.
- Mifflin–St Jeor, PAL elegido manualmente, mantenimiento y escenarios matemáticos de ±5 % y ±10 %. Son orientación general, no consejo médico.
- Objetivos manuales versionados de calorías, proteínas, carbohidratos, grasas y agua.
- Catálogo manual de alimentos con varias porciones editables, energía declarada o calculada 4/4/9, favoritos, recientes, supermercado, fotografía local sustituible y prueba técnica EAN sin red.
- Diario por fecha con comidas de varios elementos, desayuno, comida, cena y tentempié; unidades base seguras, snapshots nutricionales, notas, agua y entrenamiento mínimo sí/no.
- Recetas manuales, planificación futura, copia de comidas/días y conversión de planificado a consumido sin recalcular el histórico.
- Calendario mensual, objetivos semanales efectivos desde un lunes, sesiones simples con tipos y notas, copia e historial desplegable. La interfaz no incluye ejercicios, series, cargas ni ejercicios reutilizables.
- Historial y gráfica neutral de peso, sin fotografías corporales, análisis ni diagnóstico.
- Inventario canónico en gramos o mililitros, movimientos inmutables, lista de compra, completar/deshacer y disponibilidad de recetas. Nutrición e inventario se actualizan atómicamente.
- Backup completo formato 3 de las 26 tablas, ZIP cifrado con AES-256, y restauración mediante dataset temporal, verificación y cambio atómico del puntero activo.
- Importación de backups de formatos 1, 2 y 3. La base `nutriasta` 0.1.1 se mantiene en versión 1 y solo lectura; `nutriasta-main` usa una migración exclusivamente aditiva hasta Dexie 6.
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

Resultados locales del parche 0.3.2, ejecutados con Node 24.14.0:

- TypeScript: correcto.
- Vitest: 26 archivos y 79 pruebas correctas; el backup formato 3 se prueba con las 26 tablas pobladas.
- Exportación estática, manifiesto, iconos y service worker: correctos.
- Playwright: 63 pruebas correctas y 5 omisiones justificadas en WebKit para Windows. Incluye regresión visual, navegación adaptable, entrenamiento simplificado, agua desde Hoy, objetivos persistentes, peso, inventario, backup y una actualización real entre dos builds distintos (`mvp-1-approved-0.2.1` → `0.3.2`) bajo el mismo origen.
- Expo Doctor: 18/18 comprobaciones correctas.
- Privacidad: ninguna petición de producción a terceros y ninguna API remota.

Las cinco omisiones son dos reaperturas offline bajo service worker —la apertura general y la comprobación posterior a la actualización real— y tres recorridos que necesitan serializar fotografías `Blob` en IndexedDB: copia de la foto 0.1.1, edición de fotografía de alimento y backup completo. Playwright WebKit en Windows no reproduce esas capacidades de Safari de iPhone de forma fiable. Los mismos recorridos pasan en Chromium y quedan como pruebas físicas obligatorias en Safari/iPhone.

Playwright comprueba estructura accesible, teclado, foco visible, contraste, texto al 200 % y movimiento reducido, pero no sustituye VoiceOver ni Safari real. Lectura y orden con VoiceOver, anuncios de diálogos, captura/selección de fotografías, apertura offline y actualización desde la PWA instalada siguen pendientes de validación física en el iPhone.

## Backup formato 3 y restauración segura

El formato 3 usa la extensión `.nutriasta.zip`, cifra cada entrada con AES-256 y nunca guarda la contraseña. Incluye exactamente las 26 tablas del dataset activo y las fotografías de viabilidad/alimentos como entradas independientes. Las fotografías corporales continúan excluidas.

Antes de escribir en IndexedDB se verifica fuera de cualquier transacción:

- archivo cifrado de hasta 256 MiB;
- máximo 502 entradas y 250 pares de fotografía/miniatura;
- manifiesto de hasta 512 KiB y `data.json` de hasta 32 MiB;
- cada fotografía hasta 8 MiB y miniatura hasta 1 MiB;
- contenido descomprimido total hasta 300 MiB;
- AES obligatorio, rutas permitidas, ausencia de duplicados y archivos no declarados;
- tamaños ZIP, tamaños del manifiesto, progreso real de descompresión y SHA-256;
- versión mínima compatible, 26 tablas exactas, recuentos, identificadores, duplicados, relaciones y reconciliación de inventario.

La preparación exige espacio adicional de `ceil(payload × 1,5) + 10 MiB`. Escribe un dataset `staging` en lotes cortos, vuelve a leer todos los datos y blobs y recalcula su huella. El dataset activo no cambia hasta la confirmación de activación, que solo actualiza metadatos y estados en una transacción breve. Cancelación, rollback y reactivación conservan el dataset anterior; confirmar no lo elimina automáticamente.

`minimumAppVersion` es un mínimo semántico `mayor.menor.parche`: una aplicación posterior puede abrir un backup anterior compatible. Los backups de formato 1 siguen importándose por el flujo heredado de Fase 0.

## Actualización y privacidad

- El service worker no usa `skipWaiting` automáticamente. Muestra un aviso y espera consentimiento.
- Antes de activar espera escrituras y procesamiento local de fotografías pendientes.
- El service worker no abre, migra ni elimina IndexedDB.
- No hay `fetch` de aplicación, CDN, fuentes externas, analítica ni telemetría.
- Las fotografías y backups se procesan en el dispositivo.
- `Eliminar todos mis datos` exige escribir `ELIMINAR` y aceptar una segunda confirmación. Borra exclusivamente las filas funcionales del dataset activo en las 26 tablas.
- Esa acción no elimina la base histórica `nutriasta`, el catálogo técnico de datasets, datasets de rollback, backups guardados en Archivos ni la PWA. No se realizan limpiezas silenciosas de recuperación.

La revisión de producción `npm audit --omit=dev` del 29 de julio de 2026 informa 10 avisos moderados, sin vulnerabilidades críticas. Proceden de herramientas de Expo SDK 57 (`@expo/config-plugins`/`xcode`/`uuid`); la única propuesta automática completa de npm requiere `--force` y rebajaría Expo a SDK 46, por lo que es incompatible.

No se ha usado `npm audit fix --force`, no se ha rebajado Expo y `expo-doctor` es correcto. Estas cadenas son herramientas de compilación y configuración, no forman parte del JavaScript funcional que ejecuta la PWA estática en Safari. Quedan documentadas como riesgo pendiente hasta que Expo/Workbox publiquen una corrección compatible.

## Pruebas físicas obligatorias en Safari/iPhone

Estas pruebas requieren el despliegue HTTPS autorizado del commit exacto del parche 0.3.2 en el mismo origen privado. No debe publicarse ninguna versión adicional sin otra autorización.

1. Antes de actualizar, guardar un backup completo de los datos ficticios actuales y conservar también el backup 0.1.1.
2. Abrir la PWA instalada y comprobar que la versión anterior no se actualiza sola; aceptar la actualización solo desde el aviso.
3. Confirmar `Versión 0.3.2`, los datos ficticios heredados y los valores de almacenamiento.
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
    - Abrir `Entrenar`, recorrer meses anterior/siguiente, cambiar el objetivo para la semana actual y siguiente y confirmar que una semana pasada no se reinterpreta.
    - Planificar, completar, cancelar y copiar sesiones ficticias; comprobar tipos, notas, resumen semanal, eliminación de un tipo personalizado e historial desplegable.
    - Añadir, editar y eliminar pesos ficticios; comprobar gráfica y alternativa textual sin que cambie silenciosamente el peso del perfil.
    - Añadir inventario en g y ml, consumir con saldo suficiente, agotamiento e insuficiencia; comprobar diferencias, edición por delta, reversión al planificar y eliminación.
    - Completar una compra con equivalencias explícitas, deshacerla y comprobar que se bloquea sin cambios parciales si parte ya se consumió.
    - Revisar disponibilidad de una receta de varios ingredientes y confirmar que un fallo no deja movimientos parciales.
14. Exportar un backup completo con contraseña ficticia y guardarlo en “En mi iPhone”. Confirmar la fecha de último backup.
15. Modificar perfil, alimento, porciones, diario, agua, receta y fotografía. Intentar restaurar con contraseña incorrecta y comprobar que nada cambia.
16. Preparar con la contraseña correcta, revisar el candidato, cancelar y comprobar el dataset original. Repetir, activar y verificar las 26 tablas y fotografías permitidas.
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
