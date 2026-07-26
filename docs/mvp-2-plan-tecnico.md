# NutrIAsta — Plan técnico del MVP 2

Estado: **aprobado como plan técnico del MVP 2**
Fecha: 26 de julio de 2026
Base inmutable del MVP 1: etiqueta `mvp-1-approved-0.2.1`, commit
`b0cb7620660677e3d166288811c58b0fa15a23cb`
Especificación funcional aprobada: commit
`0e6c5c0cc16e9fa6bfe6bc733e60ae2718acbbc7`
Diseño UX/UI aprobado: commit
`9d2353e7319db950dbafb87c9bdbb6c122e49b47`
Versión futura propuesta: **`0.3.0`**
La autorización de implementación local de las fases 0–6 se registra de forma
separada. El despliegue, la publicación y los pushes continúan **no autorizados**.

La implementación de la Fase 0 comenzará desde el commit local que apruebe este
plan técnico. El commit `9d2353e7319db950dbafb87c9bdbb6c122e49b47` se conserva
como línea base para revisar el diff completo del MVP 2.

## 1. Propósito, fuentes y límites

Este documento convierte las dos especificaciones aprobadas en un orden técnico
verificable. No implementa ninguna fase.

Se han utilizado obligatoriamente los recursos de `$nutriasta-ux-ui`:

- la referencia completa
  `references/diseno-ux-ui-nutriasta.md`;
- el prototipo navegable de `assets/ux-prototype/`;
- los siete mockups aprobados de `assets/mockups/`;
- los iconos de hoja verde y flecha clara de `assets/icons/`.

La planificación técnica debe preservar estas reglas:

- el MVP 1 y sus cálculos no se reinterpretan;
- `nutriasta` sigue exactamente en versión 1 y no recibe escrituras;
- `nutriasta-main` evoluciona solo de forma aditiva;
- toda fila funcional pertenece a un `datasetId`;
- no existen fotografías corporales, tablas, permisos ni entradas de backup para
  ellas;
- no hay backend, sincronización, analítica, telemetría ni tráfico de aplicación a
  terceros;
- se usan exclusivamente datos ficticios durante desarrollo y validación;
- no se realizará ningún despliegue intermedio;
- el cambio a `0.3.0` solo ocurrirá en la fase final y necesitará autorización;
- ninguna decisión visual puede cambiar una regla funcional, un cálculo o una
  transacción.

## 2. Decisión sobre dependencias

No se propone instalar ninguna dependencia.

El proyecto ya dispone de todo lo necesario:

- React, React Native Web y Expo Router para interfaz y navegación;
- Dexie `4.2.1` para IndexedDB, índices y transacciones;
- `@zip.js/zip.js` para ZIP cifrado y lectura limitada;
- Vitest y `fake-indexeddb` para pruebas unitarias y de migración;
- Playwright para E2E, service worker, offline, accesibilidad estructural y
  capturas deterministas;
- Workbox para generar el service worker controlado.

La gráfica de peso se resolverá con SVG o `canvas` local acompañado siempre de una
lista textual. Los iconos internos serán SVG locales. Las fechas se calcularán con
funciones puras e `Intl`. No se necesitan bibliotecas de gráficas, iconos, fechas,
estado global o peticiones de red.

Si durante una futura implementación apareciera una necesidad no cubierta, la fase
se detendrá antes de modificar `package.json` o `package-lock.json` y se solicitará
autorización independiente.

## 3. Arquitectura general

### 3.1 Capas

La aplicación se dividirá en cinco límites explícitos:

1. **Shell y navegación**
   - decide la composición inferior o lateral;
   - conserva destino, fecha seleccionada y retorno de foco;
   - no accede directamente a Dexie.
2. **Pantallas y componentes**
   - presentan datos y recogen decisiones;
   - no calculan saldos ni ejecutan transacciones;
   - mantienen el sistema visual aprobado.
3. **Servicios de aplicación**
   - coordinan casos de uso completos;
   - preparan decisiones sin escribir;
   - ejecutan confirmaciones atómicas;
   - registran operaciones idempotentes.
4. **Repositorios**
   - resuelven primero `activeMainDatasetId`;
   - filtran siempre por `datasetId`;
   - encapsulan consultas y primitivas transaccionales;
   - nunca exponen una tabla sin aislamiento.
5. **Dexie / IndexedDB**
   - `nutriasta` histórica en versión 1 y solo lectura;
   - `nutriasta-main` en esquema 6;
   - datasets activos, candidatos, rollback y recuperación.

La dirección de dependencia será:

`pantalla → servicio → repositorio → Dexie`.

Los cálculos puros de calendario, semana, cantidades canónicas, nutrición e
inventario no conocerán React ni Dexie.

### 3.2 Relación entre fases funcionales y visuales

| Fase técnica | Capacidad funcional | Aplicación visual |
|---|---|---|
| 0 | Esquema 6 y contrato de backup 3 | Sin nuevas pantallas; estados técnicos verificables |
| 1 | Sin reglas nuevas | Tokens, shell, cinco destinos, cabeceras y mensajes |
| 2 | Objetivos, calendario y sesiones | Mockup `02-calendario-390.png` y navegación Entrenar |
| 3 | Ejercicios, series, historial y peso | Editor de sesión y mockup `04-peso-390.png` |
| 4 | Inventario, compra, recetas disponibles | Mockup `03-inventario-aviso-390.png` |
| 5 | Backup 3 y restauración completa | Mockup `05-restauracion-390.png`, estados y endurecimiento |
| 6 | Preparación de la versión | Mockups `01-hoy-390.png`, `06-hoy-320.png` y `07-escritorio-1280.png` como conjunto final |

La Fase 1 construye el lenguaje visual una sola vez. Las fases 2–5 incorporan
funciones dentro de ese shell; no crearán interfaces paralelas.

### 3.3 Navegación adaptable aprobada

Los destinos son exactamente:

1. `Hoy`;
2. `Diario`;
3. `Entrenar`;
4. `Inventario`;
5. `Perfil`.

En 320–899 px:

- barra inferior persistente de cinco columnas;
- icono local y texto visible;
- altura adaptable al texto;
- contenido con relleno inferior igual a barra más safe area;
- editores en página completa;
- hojas inferiores solo para confirmaciones breves.

Desde 900 px:

- barra lateral de 216–232 px;
- los mismos nombres, orden y destinos;
- contenido máximo de 1.200 px;
- una o dos columnas según el contenido;
- nunca una funcionalidad distinta de la móvil.

Accesos secundarios:

- `Alimentos` y `Recetas` desde `Diario`;
- `Lista de la compra`, `Movimientos` y `Qué puedo preparar` desde `Inventario`;
- `Historial de peso`, `Backup y restauración`, `Almacenamiento`,
  `Privacidad y datos` y `Ajustes` desde `Perfil`;
- accesos contextuales desde `Hoy`, siempre duplicados por rutas visibles.

No se dependerá de deslizamientos, pulsaciones largas ni gestos ocultos.

### 3.4 Conservación íntegra del MVP 1

Antes de cada fase que toque almacenamiento se generará una fixture de una base
`nutriasta-main` versión 5 poblada con:

- las 14 tablas funcionales;
- dataset activo;
- dataset de rollback;
- dataset de recuperación;
- catálogo técnico de datasets;
- una restauración confirmada y otra situación sin restauración pendiente;
- fotografías ficticias con checksum;
- perfil, objetivos, alimentos, diario, agua, marca de entrenamiento mínimo,
  recetas y planificación ficticios.

Se calcularán recuentos y huellas estables de:

- todas las filas de las 14 tablas;
- blobs mediante tamaño, MIME y SHA-256;
- `metadata`, `datasets` y `migrationRuns`;
- `activeMainDatasetId`;
- estados de rollback y recuperación.

Tras abrir con el esquema 6:

- las doce tablas nuevas estarán vacías;
- las 14 tablas y las tres tablas técnicas conservarán exactamente sus huellas;
- `nutriasta` conservará versión, tablas, filas y blobs;
- ninguna inicialización añadirá tipos a un dataset distinto del activo;
- la creación idempotente de tipos iniciales ocurrirá después de abrir, en una
  transacción normal y nunca en `upgrade()`.

No se ejecutará ninguna prueba contra el origen privado desplegado. Las pruebas
usarán nombres de base y orígenes aislados.

### 3.5 Coordinación de operaciones

Las operaciones largas y las escrituras seguirán el contrato actual de
`write-tracker`:

- toda escritura incrementa el contador de escrituras pendientes;
- backup, restauración, reconciliación e importaciones bloquean actualización;
- la actualización espera ambos contadores en cero;
- la preparación de una fotografía de producto se registra como operación
  bloqueante antes de empezar su procesamiento;
- una animación nunca gobierna el final de una operación.

Se añadirá un coordinador de operaciones de dominio para evitar que restauración,
borrado total, consumo, compra o reconciliación compitan entre sí. El bloqueo será
local y visible; no será una espera silenciosa.

## 4. Archivos previstos

Esta lista es una propuesta de futura implementación. Ningún archivo se modifica en
esta fase documental.

### 4.1 Archivos existentes que se modificarían

| Archivo | Cambio previsto |
|---|---|
| `src/storage/main-schema.ts` | Añadir `MAIN_DATABASE_STORES_V6` y fijar esquema 6 |
| `src/storage/main-database.web.ts` | Declarar las doce tablas y registrar `version(6)` |
| `src/storage/main-dataset-types.ts` | Admitir origen/importación de formato 3 sin cambiar filas históricas |
| `src/storage/diary-repository.web.ts` | Delegar consumos que afecten inventario al servicio atómico |
| `src/mvp/diary-types.ts` | Mantener estados existentes y tipar los vínculos de operación sin migrar filas antiguas |
| `src/backup/full-backup-types.ts` | Conservar contrato 2; compartir únicamente tipos comunes inmutables |
| `src/features/backup/full-backup-panel.web.tsx` | Presentar el dispatcher 1/2/3 y los estados visuales aprobados |
| `src/privacy/data-erasure-service.web.ts` | Ampliar el borrado funcional a 26 tablas del dataset activo |
| `src/features/mvp/mvp-screen.web.tsx` | Convertirse en composición del nuevo shell, no en pantalla monolítica |
| `src/components/ui.tsx` | Reexportar los componentes del sistema visual para compatibilidad gradual |
| `src/app/index.tsx` | Montar el shell aprobado sin cambiar el origen ni añadir red |
| `tests/e2e/mvp-fixture.ts` | Ampliar fixtures ficticias y mantener casos del MVP 1 |
| `README.md` | Documentar validación, limitaciones y prueba física final |

Solo en la Fase 6 se modificarían:

- `package.json`, únicamente el campo de versión;
- `app.json`, únicamente la versión y textos PWA aprobados;
- `src/storage/schema.ts`, únicamente `APP_VERSION`, sin tocar
  `DATABASE_NAME`, `DATABASE_VERSION` ni `DATABASE_STORES`;
- `public/manifest.webmanifest`, para retirar el texto de viabilidad y conservar
  exactamente los iconos;
- artefactos generados de build, que no se versionarán salvo que la política actual
  ya lo exija.

`workbox-config.cjs` no necesita cambio funcional: debe conservar
`skipWaiting: false`, `clientsClaim: false` y exclusión de `sw.js` del precaché.

### 4.2 Archivos de dominio y almacenamiento que se crearían

- `src/mvp/training-types.ts`
- `src/mvp/training-calculations.ts`
- `src/mvp/weight-types.ts`
- `src/mvp/inventory-types.ts`
- `src/mvp/inventory-calculations.ts`
- `src/storage/training-repository.web.ts`
- `src/storage/weight-repository.web.ts`
- `src/storage/inventory-repository.web.ts`
- `src/storage/shopping-repository.web.ts`
- `src/services/training-service.web.ts`
- `src/services/inventory-consumption-service.web.ts`
- `src/services/inventory-reconciliation-service.web.ts`
- `src/services/shopping-service.web.ts`
- `src/services/domain-operation-coordinator.web.ts`

Los repositorios `.native.ts` solo devolverían fixtures o el estado
`Solo disponible en la PWA`; no implementarían persistencia de producción.

### 4.3 Archivos de backup que se crearían

- `src/backup/full-backup-v3-types.ts`
- `src/backup/full-backup-v3-format.ts`
- `src/backup/full-backup-v3-service.web.ts`
- `src/backup/full-backup-dispatcher.web.ts`
- `src/backup/backup-dataset-verifier.web.ts`

Los decodificadores de formatos 1 y 2 permanecerían disponibles y con sus contratos
congelados. El dispatcher elegiría el lector después de una inspección limitada, no
mediante intentos destructivos.

### 4.4 Archivos de sistema visual y navegación que se crearían

- `src/components/design-system/tokens.ts`
- `src/components/design-system/brand-icon.tsx`
- `src/components/design-system/local-icon.tsx`
- `src/components/design-system/buttons.tsx`
- `src/components/design-system/cards.tsx`
- `src/components/design-system/fields.tsx`
- `src/components/design-system/status.tsx`
- `src/components/design-system/dialog.tsx`
- `src/components/design-system/progress.tsx`
- `src/components/design-system/empty-state.tsx`
- `src/components/design-system/accessible-weight-chart.web.tsx`
- `src/features/shell/app-shell.web.tsx`
- `src/features/shell/app-shell.native.tsx`
- `src/features/shell/adaptive-navigation.web.tsx`
- `src/features/shell/screen-header.tsx`
- `src/features/today/today-screen.web.tsx`
- `src/features/training/training-calendar.web.tsx`
- `src/features/training/training-day.web.tsx`
- `src/features/training/training-session-editor.web.tsx`
- `src/features/training/training-history.web.tsx`
- `src/features/training/weekly-summary.web.tsx`
- `src/features/progress/weight-history.web.tsx`
- `src/features/inventory/inventory-screen.web.tsx`
- `src/features/inventory/inventory-movements.web.tsx`
- `src/features/inventory/shopping-list.web.tsx`
- `src/features/inventory/purchase-review.web.tsx`
- `src/features/inventory/recipe-availability.web.tsx`
- `src/features/inventory/consumption-review-dialog.web.tsx`

Los iconos instalables existentes de `public/icons/` se reutilizarían sin
regenerarlos. Los iconos de navegación serían SVG locales de trazo coherente; no se
usaría una fuente de iconos ni recursos remotos.

### 4.5 Archivos de prueba que se crearían

Pruebas unitarias:

- `tests/unit/main-schema-v6.test.ts`
- `tests/unit/mvp1-preservation-v6.test.ts`
- `tests/unit/training-calculations.test.ts`
- `tests/unit/training-repository.test.ts`
- `tests/unit/weight-repository.test.ts`
- `tests/unit/inventory-calculations.test.ts`
- `tests/unit/inventory-transactions.test.ts`
- `tests/unit/inventory-reconciliation.test.ts`
- `tests/unit/shopping-service.test.ts`
- `tests/unit/full-backup-v3-format.test.ts`
- `tests/unit/full-backup-v3-service.test.ts`
- `tests/unit/backup-version-dispatcher.test.ts`
- `tests/unit/data-erasure-v3.test.ts`

Pruebas E2E:

- `tests/e2e/mvp2-fixture.ts`
- `tests/e2e/migration-v6.spec.ts`
- `tests/e2e/navigation-visual.spec.ts`
- `tests/e2e/training-calendar.spec.ts`
- `tests/e2e/training-session.spec.ts`
- `tests/e2e/weight-history.spec.ts`
- `tests/e2e/inventory-consumption.spec.ts`
- `tests/e2e/shopping-list.spec.ts`
- `tests/e2e/recipe-availability.spec.ts`
- `tests/e2e/full-backup-v3.spec.ts`
- `tests/e2e/mvp2-privacy-offline.spec.ts`
- `tests/e2e/update-021-to-030.spec.ts`
- `tests/e2e/mvp2-visual-regression.spec.ts`

Las capturas base quedarían en una carpeta de pruebas separada del prototipo
documental y solo se actualizarían tras revisar una diferencia.

## 5. Dexie: esquema 6 de `nutriasta-main`

### 5.1 Aclaración de versión

“Dexie 6” significa **versión 6 del esquema de IndexedDB gestionado por Dexie**.
No significa instalar Dexie major 6. Se conservará Dexie `4.2.1`, compatible con el
proyecto aprobado y suficiente para el esquema propuesto.

### 5.2 Bases

| Base | Estado previsto |
|---|---|
| `nutriasta` | Exactamente versión 1; mismas cuatro tablas; sin escritura, actualización, eliminación ni migración |
| `nutriasta-main` | Pasa de esquema 5 a 6 añadiendo doce tablas; conserva todas las anteriores |

La declaración futura será:

- versiones 1–5 exactamente como están;
- `version(6).stores(MAIN_DATABASE_STORES_V6)`;
- sin callback `upgrade()` que recorra o transforme filas.

### 5.3 Representación de cantidades

La unidad funcional seguirá siendo `g` o `ml`. Para evitar errores binarios y saldos
residuales, las cantidades de inventario se almacenarán como enteros en milésimas de
la unidad canónica:

- `1000` representa `1 g` o `1 ml`;
- la interfaz convierte de forma reversible;
- se admite una precisión máxima de `0,001 g` o `0,001 ml`;
- un valor con más precisión se rechaza antes de escribir;
- no se convierte nunca entre gramos y mililitros.

Los campos del modelo usan el sufijo `MilliBase` para que esta representación no se
confunda con gramos o mililitros directos.

### 5.4 Definición exacta de las doce tablas

En todas las cadenas, `&` significa índice único. Todos los índices funcionales
incluyen `datasetId`; el índice simple `datasetId` existe para backup, borrado y
verificación.

#### 1. `trainingSettings`

Finalidad: periodos efectivos del objetivo semanal.

Campos:

- `datasetId`, `id`;
- `effectiveFromMonday` en `AAAA-MM-DD`;
- `weeklyGoal` entero de 1 a 7;
- `createdAt`, `updatedAt` en UTC.

Store:

`&[datasetId+id],datasetId,&[datasetId+effectiveFromMonday]`

La segunda unicidad impide dos objetivos para el mismo lunes y dataset.

#### 2. `trainingTypes`

Finalidad: tipos iniciales y personalizados.

Campos:

- `datasetId`, `id`;
- `name`, `normalizedName`;
- `origin`: `initial` o `custom`;
- `initialKey` opcional;
- `archived`;
- `createdAt`, `updatedAt`.

Store:

`&[datasetId+id],datasetId,[datasetId+normalizedName],[datasetId+archived]`

El nombre normalizado es índice de búsqueda, no unicidad de base. El servicio
evitará duplicados accidentales y permitirá resolver conflictos de nombre de forma
visible.

#### 3. `exerciseCatalog`

Finalidad: ejercicios reutilizables.

Campos:

- `datasetId`, `id`;
- `name`, `normalizedName`;
- `primaryTrainingTypeId` opcional;
- `secondaryTrainingTypeIds`;
- `note`;
- `archived`;
- `createdAt`, `updatedAt`.

Store:

`&[datasetId+id],datasetId,[datasetId+normalizedName],[datasetId+archived]`

#### 4. `trainingSessions`

Finalidad: sesión, estado y resumen histórico.

Campos:

- `datasetId`, `id`;
- `status`: `draft`, `planned`, `completed` o `cancelled`;
- `localDate`;
- `startTime` opcional;
- `durationMinutes` opcional;
- `title`, `note`;
- `trainingTypes`: pares `trainingTypeId` y `nameSnapshot`;
- `origin`: `manual`, `copied` o `unplanned`;
- `sourceSessionId` opcional;
- `createdAt`, `updatedAt`.

Store:

`&[datasetId+id],datasetId,[datasetId+localDate],[datasetId+status]`

Los filtros por tipo se calculan después de obtener el intervalo del dataset; no se
crea un índice global que pueda mezclar datasets.

#### 5. `trainingSessionExercises`

Finalidad: ejercicios ordenados dentro de una sesión.

Campos:

- `datasetId`, `id`, `sessionId`;
- `catalogExerciseId` opcional;
- `nameSnapshot`;
- `order`;
- `note`;
- `createdAt`, `updatedAt`.

Store:

`&[datasetId+id],datasetId,[datasetId+sessionId]`

#### 6. `trainingSets`

Finalidad: series opcionales.

Campos:

- `datasetId`, `id`, `sessionExerciseId`;
- `order`;
- `repetitions` opcional;
- `loadKg` opcional;
- `completed`;
- `note`;
- `createdAt`, `updatedAt`.

Store:

`&[datasetId+id],datasetId,[datasetId+sessionExerciseId]`

Una carga ausente es `null`; cero es un valor explícito válido.

#### 7. `weightEntries`

Finalidad: historial manual y neutral de peso.

Campos:

- `datasetId`, `id`;
- `recordedAt` en UTC;
- `localDate` y `localTime` conservadas para presentación;
- `weightKg`;
- `note`;
- `origin`: `manual` o `profile-copy`;
- `createdAt`, `updatedAt`.

Store:

`&[datasetId+id],datasetId,[datasetId+recordedAt]`

#### 8. `inventoryItems`

Finalidad: saldo materializado por alimento.

Campos:

- `datasetId`, `id`, `foodId`;
- `canonicalUnit`: `g` o `ml`;
- `balanceMilliBase`;
- `revision`;
- `lastMovementId` opcional;
- `reconciledAt` opcional;
- `createdAt`, `updatedAt`.

Store:

`&[datasetId+id],datasetId,&[datasetId+foodId]`

Solo puede existir un saldo materializado por alimento y dataset.

#### 9. `inventoryMovements`

Finalidad: fuente de verdad inmutable del inventario.

Campos:

- `datasetId`, `id`, `foodId`;
- `kind`: `purchase`, `consumption`, `positive-adjustment`,
  `negative-adjustment` o `reversal`;
- `deltaMilliBase`, con signo;
- `canonicalUnit`;
- `balanceAfterMilliBase`;
- `operationId`, `idempotencyKey`;
- `sourceType`, `sourceRef`;
- `relatedMovementId` opcional;
- `inputQuantity`, `inputUnit` opcionales;
- instantánea opcional de equivalencia y resultado canónico;
- `occurredAt`, `createdAt`;
- motivo o nota.

Store:

`&[datasetId+id],datasetId,[datasetId+foodId],[datasetId+operationId],[datasetId+sourceRef],&[datasetId+idempotencyKey]`

Los movimientos aplicados no se editan ni eliminan.

#### 10. `inventoryConsumptionDecisions`

Finalidad: explicar cada ingrediente de una operación de consumo.

Campos:

- `datasetId`, `id`;
- `operationId`, `idempotencyKey`;
- `diaryItemId`, `foodId`;
- `requestedMilliBase`;
- `deductedMilliBase`;
- `missingMilliBase`;
- `canonicalUnit`;
- `decision`: `full`, `available-only` o `no-inventory-deduction`;
- instantánea de equivalencia opcional;
- `movementId` opcional;
- `shoppingListItemId` opcional;
- `inventoryDifference`;
- `createdAt`.

Store:

`&[datasetId+id],datasetId,[datasetId+operationId],[datasetId+diaryItemId],[datasetId+foodId],&[datasetId+idempotencyKey]`

Cancelar no crea esta fila porque la regla aprobada exige que cancelar no modifique
ninguna tabla.

#### 11. `shoppingLists`

Finalidad: lista activa e historial de compras.

Campos:

- `datasetId`, `id`;
- `status`: `active` o `completed`;
- `sourceOperationId` opcional;
- `completedAt` opcional;
- `reopenedFromListId` opcional;
- `createdAt`, `updatedAt`.

Store:

`&[datasetId+id],datasetId,[datasetId+status]`

La regla de una sola lista activa se valida dentro de la transacción. No se usa un
índice único sobre estado porque debe haber varias listas completadas.

#### 12. `shoppingListItems`

Finalidad: elementos pendientes, comprados o devueltos a edición.

Campos:

- `datasetId`, `id`, `shoppingListId`;
- `foodId` opcional;
- `text`;
- `quantity`, `unit`;
- `canonicalAmountMilliBase` y `canonicalUnit` opcionales;
- instantánea de equivalencia opcional;
- `note`;
- `status`: `pending` o `purchased`;
- `source`: `manual`, `depletion`, `shortage` o `recipe`;
- `sourceOperationId` opcional;
- `createdAt`, `updatedAt`.

Store:

`&[datasetId+id],datasetId,[datasetId+shoppingListId],[datasetId+foodId],[datasetId+status]`

### 5.5 Índices únicos

Los únicos índices adicionales a la clave primaria que serán únicos son:

- `[datasetId+effectiveFromMonday]` en `trainingSettings`;
- `[datasetId+foodId]` en `inventoryItems`;
- `[datasetId+idempotencyKey]` en `inventoryMovements`;
- `[datasetId+idempotencyKey]` en
  `inventoryConsumptionDecisions`.

Todas las tablas tienen clave primaria única `[datasetId+id]`.

No se añade unicidad no aprobada a nombres, fechas, sesiones, pesos, compras o
elementos de lista.

### 5.6 Aislamiento por dataset

- El `datasetId` nunca llega desde un campo editable de interfaz.
- Cada servicio obtiene el dataset activo al comenzar.
- Cada transacción vuelve a comprobar el puntero activo antes de escribir.
- Todas las relaciones validan que padre e hijo comparten dataset.
- Una fila de backup no conserva el `datasetId` de origen: el importador asigna el
  `candidateDatasetId`.
- Las consultas de borrado, backup y reconciliación usan el índice `datasetId`.
- Cualquier fila sin `datasetId` o relación cruzada detiene importación o escritura.

### 5.7 Migración aditiva y tipos iniciales

La apertura de la versión 6 solo crea object stores e índices. No:

- recorre filas;
- añade propiedades a filas históricas;
- cambia valores de cantidades;
- normaliza textos antiguos;
- elimina índices;
- renombra tablas;
- abre `nutriasta` para escritura.

Después de una apertura correcta, un inicializador idempotente crea los nueve tipos
iniciales únicamente si no existen:

`pecho`, `hombro`, `bíceps`, `tríceps`, `espalda`, `core`, `pierna`, `culo` y
`cardio`.

El inicializador:

- trabaja solo en el dataset activo;
- utiliza claves iniciales estables;
- no renombra ni reactiva silenciosamente un tipo modificado;
- puede ejecutarse varias veces sin duplicar;
- queda cubierto por rollback de la transacción.

### 5.8 Prueba desde 0.2.1 poblada

1. Crear `nutriasta` v1 ficticia y `nutriasta-main` v5 ficticia.
2. Poblar las 14 tablas y los estados técnicos.
3. Cerrar ambas bases.
4. Calcular huellas antes de migrar.
5. Abrir solo `nutriasta-main` con el esquema 6.
6. Comprobar que IndexedDB informa versión 6 y 29 stores totales:
   3 técnicas + 14 funcionales existentes + 12 nuevas.
7. Verificar que las doce nuevas están vacías antes del inicializador.
8. Comparar byte/tipo lógico, recuentos, relaciones y checksums del MVP 1.
9. Ejecutar el inicializador dos veces y comprobar nueve tipos, no dieciocho.
10. Comprobar activo, rollback y recuperación.
11. Abrir `nutriasta` con el lector histórico y comparar su huella.
12. Instrumentar IndexedDB para fallar si se solicita una transacción
    `readwrite` sobre `nutriasta`.

### 5.9 Imposibilidad de downgrade

Después de abrir `nutriasta-main` en versión 6, el código 0.2.1, que declara versión
5, puede recibir `VersionError`. No se intentará reducir la versión ni eliminar
stores.

Consecuencias:

- el rollback de datos no es un rollback de código;
- actualizar a 0.3.0 será una decisión controlada, pero no se prometerá volver a
  ejecutar 0.2.1 sobre la base migrada;
- antes de la actualización física se exigirá backup formato 2 reciente,
  contraseña comprobada y datos ficticios anotados;
- formatos 1 y 2 seguirán siendo importables por 0.3.0;
- si la migración falla, la transacción de cambio de versión de IndexedDB se aborta;
- si la base queda en versión 6 pero la interfaz no puede usarla, se detiene el
  despliegue y se utiliza recuperación mediante backup, nunca downgrade.

### 5.10 Condiciones de parada de esquema

Se detendrá la fase si:

- cambia una huella del MVP 1;
- se abre `nutriasta` en escritura;
- desaparece o cambia un índice anterior;
- se transforma una fila durante `upgrade`;
- se mezcla un dataset;
- un tipo inicial se duplica;
- un fallo de migración deja una versión parcial;
- no puede demostrarse el `VersionError` de downgrade;
- la migración requiere eliminar, renombrar o copiar tablas históricas.

## 6. Inventario y atomicidad

### 6.1 Fuente de verdad y saldo materializado

`inventoryMovements` será la fuente de verdad. `inventoryItems.balanceMilliBase`
será una proyección materializada para lectura rápida.

Reglas:

- ningún repositorio puede cambiar el saldo sin insertar movimientos en la misma
  transacción;
- el saldo nuevo es saldo anterior más la suma de deltas autorizados;
- `balanceAfterMilliBase` permite auditar la secuencia;
- el saldo nunca puede ser negativo;
- ajustes manuales crean movimientos;
- correcciones crean movimientos inversos;
- borrar o editar un movimiento aplicado está prohibido.

### 6.2 Reconciliación

La reconciliación:

1. obtiene todos los movimientos de un alimento y dataset;
2. los ordena por fecha de creación e identificador estable;
3. suma `deltaMilliBase`;
4. comprueba unidad canónica;
5. compara con el saldo materializado;
6. informa diferencias antes de permitir nuevas mutaciones.

Se ejecutará:

- al abrir el detalle de movimientos;
- antes de exportar un backup;
- después de una restauración candidata;
- en pruebas tras cada operación crítica.

Si hay discrepancia:

- se bloquean consumos, compras y ajustes del alimento afectado;
- se muestra el saldo derivado y el materializado;
- una reparación técnica, si se autoriza, solo recalcula la proyección desde los
  movimientos dentro de una transacción;
- no se inventa ni elimina un movimiento para ocultar la diferencia.

### 6.3 Claves idempotentes

Cada intención confirmada recibe un `operationId` estable antes de escribir. Cada
efecto dentro de ella recibe una clave determinista:

`tipo de acción + origen + revisión + alimento + efecto`.

Ejemplos conceptuales:

- consumo de un ingrediente;
- reversión de ese consumo;
- diferencia tras editar cantidad;
- movimiento de compra;
- reversión de compra;
- alta o incremento en lista.

Si una pulsación se repite, la transacción consulta primero las claves:

- si todas existen y coinciden, devuelve el resultado previo;
- si ninguna existe, aplica la operación;
- si solo existe una parte, se considera corrupción y se detiene;
- reconsumir después de volver a planificado crea un nuevo `operationId`.

La clave se conserva mientras el resultado sea incierto por cierre o error. No se
genera una clave nueva automáticamente al reintentar.

### 6.4 Preparación y confirmación de un consumo

Fase de preparación, fuera de una transacción de escritura:

1. leer `mealEntry`, `mealItems`, receta e ingredientes;
2. resolver porciones y equivalencias explícitas;
3. calcular solicitado, disponible, descontable y faltante;
4. detectar agotamiento, insuficiencia o unidad incompatible;
5. reunir todas las decisiones;
6. mostrar la revisión completa;
7. obtener una confirmación única.

Fase de confirmación:

- abrir una transacción Dexie breve con tablas nutricionales, inventario, decisiones,
  compra y metadatos necesarios;
- volver a leer `updatedAt`/`revision`, dataset activo, saldos y relaciones;
- abortar si algo cambió desde la vista previa;
- escribir consumo, movimientos, saldos, decisiones y entradas de compra;
- confirmar todo o nada.

Las lecturas pesadas, cálculos, renderizado y confirmación no se realizan dentro de
la transacción.

### 6.5 Edición, eliminación y reversión

Para un consumo aplicado:

- aumentar cantidad calcula solo el delta y vuelve a comprobar insuficiencia;
- reducir cantidad crea un movimiento compensatorio por la diferencia;
- eliminar crea movimientos inversos y después retira la fila funcional;
- volver a `planned` crea movimientos inversos y conserva la comida;
- volver a `consumed` usa una operación nueva;
- las decisiones y movimientos anteriores permanecen;
- nutrición, estado, saldo, movimiento y decisión cambian atómicamente.

La reversión utiliza las instantáneas guardadas en las decisiones originales, no la
receta o equivalencia actuales.

### 6.6 Recetas con varios ingredientes

Para una receta:

- se congela una vista de todos los ingredientes y porciones;
- se calculan todas las decisiones antes de escribir;
- los ingredientes incompatibles bloquean la confirmación hasta que el usuario
  corrija o elija una opción permitida;
- la revisión muestra disponible, solicitado, faltante y efecto en compra;
- un único botón inicia una única transacción;
- no existe un botón por ingrediente que escriba parcialmente;
- si falla un ingrediente, no cambia ninguna tabla.

### 6.7 Cantidad insuficiente

Nunca se permite saldo negativo.

Opciones:

1. **Descontar solo lo disponible**
   - saldo final cero;
   - nutrición conserva el consumo completo;
   - decisión registra solicitado, descontado y faltante;
   - `inventoryDifference` queda visible;
   - nunca se presenta el inventario como exacto.
2. **No descontar inventario**
   - nutrición completa;
   - saldo intacto;
   - decisión sin movimiento y diferencia visible.
3. **Cancelar y corregir**
   - no se escribe ninguna fila.

### 6.8 Compra y deshacer

Completar compra:

- exige vincular las entradas que deban pasar a inventario;
- calcula conversiones explícitas antes de escribir;
- crea movimientos positivos, actualiza saldos y completa la lista;
- conserva no comprados en la lista activa;
- es idempotente.

Deshacer:

- calcula todos los movimientos inversos;
- comprueba que ningún saldo quedará negativo;
- si uno falla, no se modifica ningún producto;
- si todos son válidos, crea inversos, reabre elementos y conserva referencia a la
  compra original en una sola transacción;
- nunca borra movimientos históricos.

### 6.9 Límites entre nutrición e inventario

Nutrición sigue siendo la fuente de calorías y macros. Inventario solo conoce:

- alimento vinculado;
- cantidad base;
- equivalencia explícita;
- estado y operación del consumo.

Inventario no recalcula calorías. Nutrición no modifica saldos directamente. El
servicio de consumo coordina ambos repositorios y es el único punto autorizado para
una operación conjunta.

## 7. Backup completo formato 3

### 7.1 Decisión de formato

Se crea formato 3. El formato 2 permanece inmutable porque el MVP 2 añade doce
tablas, nuevas relaciones e idempotencia.

La aplicación:

- exporta siempre formato 3;
- importa formatos 1, 2 y 3;
- rechaza formatos futuros;
- no promete que 0.2.1 pueda leer formato 3.

### 7.2 Las 26 tablas de datos

Las 14 tablas existentes:

1. `legacyViabilityRecords`
2. `legacyViabilityPhotos`
3. `profiles`
4. `nutritionTargetPeriods`
5. `foods`
6. `foodPortions`
7. `foodPhotos`
8. `diaryDays`
9. `mealEntries`
10. `mealItems`
11. `waterEntries`
12. `trainingDayFlags`
13. `recipes`
14. `recipeItems`

Las doce nuevas:

15. `trainingSettings`
16. `trainingTypes`
17. `exerciseCatalog`
18. `trainingSessions`
19. `trainingSessionExercises`
20. `trainingSets`
21. `weightEntries`
22. `inventoryItems`
23. `inventoryMovements`
24. `inventoryConsumptionDecisions`
25. `shoppingLists`
26. `shoppingListItems`

`metadata`, `datasets` y `migrationRuns` son catálogo técnico y no se exportan como
datos del usuario. Se reconstruyen de forma controlada para el candidato.

### 7.3 Contrato del manifiesto

El manifiesto formato 3 contendrá exactamente:

- `format: "nutriasta-full-backup"`;
- `formatVersion: 3`;
- `databaseSchemaVersion: 6`;
- `minimumAppVersion: "0.3.0"`;
- `appVersion`;
- `backupId`;
- `sourceDatasetId`;
- `exportedAt`;
- `entityCounts` con las 26 claves exactas;
- descriptores de archivos;
- `contentFingerprint`.

La compatibilidad usa comparación semántica numérica. Una aplicación posterior
puede restaurar el backup si su versión es igual o superior a
`minimumAppVersion`; no se exige igualdad exacta.

### 7.4 Contenido y rutas

- `manifest.json`: manifiesto cifrado;
- `data.json`: las 26 colecciones sin blobs y sin `datasetId` de origen;
- `media/legacyViabilityPhotos/{id}.jpg`;
- `media/legacyViabilityPhotos/{id}-thumbnail.jpg`;
- `media/foodPhotos/{id}.jpg`;
- `media/foodPhotos/{id}-thumbnail.jpg`.

No se crean rutas multimedia nuevas y no existen fotografías corporales.

Cada descriptor incluye:

- ruta relativa segura;
- tipo;
- tabla e identificador cuando proceda;
- tamaño real;
- MIME permitido;
- SHA-256.

El fingerprint global se calcula a partir del checksum de `data.json` y los
descriptores multimedia ordenados.

### 7.5 Límites de formato 3

Límites iniciales exactos que deberán superar pruebas reales antes de aprobarse:

| Límite | Valor |
|---|---:|
| Archivo cifrado | 256 MiB |
| Manifiesto | 512 KiB |
| `data.json` expandido | 32 MiB |
| Total expandido, incluido manifiesto | 300 MiB |
| Fotografía individual | 8 MiB |
| Miniatura individual | 1 MiB |
| Pares de fotografías | 250 |
| Entradas ZIP totales | 502 |
| Filas por tabla | 100.000 |
| Longitud de ruta | 239 caracteres |

Se rechaza antes de descomprimir por completo:

- archivo vacío o mayor al límite;
- entrada no cifrada con AES;
- ZipCrypto;
- rutas absolutas, `..`, barras inversas o duplicadas;
- número excesivo de entradas;
- tamaños comprimidos o expandidos inválidos;
- suma declarada excesiva;
- tablas o recuentos inesperados.

Después de extraer cada entrada se compara tamaño real, tamaño declarado y checksum.
Un tamaño falso, checksum incorrecto o expansión fuera de límite cancela la
preparación.

### 7.6 Espacio necesario

Antes de crear candidato:

- obtener `navigator.storage.estimate()`;
- calcular bytes expandidos reales;
- exigir espacio libre mínimo de
  `ceil(payloadExpandido × 1,5) + 10 MiB`;
- mantener simultáneamente dataset activo y candidato;
- mostrar uso, cuota, tamaño del candidato y margen requerido.

Si Safari no informa de uso/cuota o el margen no se cumple, la restauración segura
no empieza. No se ofrece restauración destructiva.

### 7.7 Importación de formatos 1, 2 y 3

Formato 1:

- usar el decodificador histórico aprobado;
- poblar registros y fotografías de viabilidad;
- dejar vacías las otras 24 tablas;
- asignar el `candidateDatasetId`.

Formato 2:

- usar el parser y contrato 2 sin modificarlos;
- poblar sus 14 tablas;
- dejar vacías las doce nuevas;
- asignar el `candidateDatasetId`.

Formato 3:

- validar las 26 tablas y todas sus relaciones;
- poblar las 26;
- asignar el `candidateDatasetId`.

Los tres formatos pasan por el mismo verificador de candidato antes de activarse.

### 7.8 Restauración segura

Fuera de transacciones:

1. seleccionar archivo y contraseña;
2. identificar formato con lectura limitada;
3. descifrar y descomprimir con límites;
4. validar manifiesto, filas, relaciones, tamaños y checksums;
5. calcular espacio;
6. construir una representación candidata.

Preparación:

1. crear dataset y ejecución en estado `staging`;
2. escribir lotes de hasta 100 filas en transacciones cortas;
3. escribir blobs por lotes;
4. releer las 26 tablas;
5. comprobar recuentos, relaciones, checksums, saldos e idempotencia;
6. marcar `prepared`;
7. mostrar fecha, formato, tamaño y contenido.

Estados posteriores:

- **Cancelar**: elimina solo el candidato staging y deja el activo intacto.
- **Activar**: transacción breve sobre catálogo y metadatos que cambia
  `activeMainDatasetId`, marca anterior como rollback y candidato como activo.
- **Rollback**: devuelve atómicamente el puntero anterior.
- **Reactivar**: vuelve al candidato con otra transacción breve.
- **Confirmar**: marca la sesión confirmada y conserva recuperación según la
  política aprobada.

Descifrado, descompresión, JSON, checksums, reconciliación y validaciones largas nunca
ocurren dentro de la transacción de activación.

### 7.9 Fallos

- Contraseña incorrecta: cero filas candidatas y puntero intacto.
- Archivo corrupto: candidato no creado o abandonado de forma segura.
- Cierre durante lotes: activo intacto; staging detectable al arrancar.
- Cuota agotada: se cancela la preparación y se conserva el activo.
- Cierre tras activar: la sesión técnica permite confirmar o volver.
- Candidato incoherente: no se ofrece activación.
- Formato futuro: rechazo explícito.

## 8. UX/UI técnica

### 8.1 Correspondencia con los mockups

| Recurso aprobado | Implementación futura |
|---|---|
| `01-hoy-390.png` | Hoy poblado, jerarquía nutrición/agua/entreno/inventario |
| `02-calendario-390.png` | Calendario mensual, leyenda y semana |
| `03-inventario-aviso-390.png` | Hoja de revisión sin escrituras previas |
| `04-peso-390.png` | Gráfica azul neutral y periodos |
| `05-restauracion-390.png` | Candidato, activación, rollback y confirmación |
| `06-hoy-320.png` | Contrato mínimo sin desbordamiento |
| `07-escritorio-1280.png` | Barra lateral y cuadrícula de dos columnas |

El prototipo es referencia, no código para copiar literalmente. Los componentes de
producción mantendrán su apariencia y estados, pero recibirán datos únicamente de
servicios locales.

### 8.2 Tokens

Se conservarán:

- `brand-900 #071A2F`;
- `brand-700 #12304E`;
- `leaf-500 #24C978`;
- `leaf-700 #11784B`;
- `leaf-100 #DCF8EA`;
- `canvas #F4F7F5`;
- `surface #FFFFFF`;
- `ink #0D1F2D`;
- `muted #64727C`;
- `border #DCE5DF`;
- colores de información, advertencia y peligro aprobados.

La tipografía será exclusivamente la pila del sistema. No habrá descarga de fuentes.

### 8.3 Componentes reutilizables

- `AppShell`
- `AdaptiveNavigation`
- `ScreenHeader`
- `BrandIcon`
- `LocalIcon`
- `SummaryCard`
- `ListCard`
- `TechnicalCard`
- `TransactionCard`
- `ActionButton`
- `ActionGroup`
- `Field`
- `NumberField`
- `ChoiceGroup`
- `StatusPill`
- `InlineNotice`
- `LiveStatusRegion`
- `ProgressBar`
- `MacroProgress`
- `WeeklyProgress`
- `CalendarGrid`
- `EmptyState`
- `AccessibleDialog`
- `BottomSheet`
- `OperationPendingBar`
- `AccessibleWeightChart`

Cada componente tendrá estado normal, foco, pulsado, deshabilitado, ocupado y error
cuando corresponda.

### 8.4 Anchos y primer render

Viewports obligatorios:

- 320 px;
- 375 px;
- 390 px;
- 430 px;
- 1.280 px de escritorio;
- 1.440 px como comprobación adicional.

El primer render usa `width: 100%`, `minWidth: 0`, flexbox y `maxWidth`; nunca depende
de `useWindowDimensions` para producir un ancho inicial válido.

Reglas:

- 320–359: una columna y acciones apiladas;
- 360–430: una columna y dos acciones breves solo si caben;
- 431–899: contenido centrado hasta 720 px;
- desde 900: lateral y contenido hasta 1.200 px;
- `scrollWidth` nunca supera el viewport;
- ninguna etiqueta se trunca de forma que pierda significado.

### 8.5 Safe areas y teclado

- `viewport-fit=cover`;
- relleno superior, inferior, izquierdo y derecho mediante safe areas;
- barra inferior suma `safe-area-inset-bottom`;
- contenido nunca queda bajo navegación;
- campos activos se desplazan a la vista;
- acciones de guardado permanecen accesibles sobre el teclado;
- ningún alto fijo impide texto ampliado.

### 8.6 Accesibilidad

Texto al 200 %:

- cinco nombres siguen visibles;
- barra y tarjetas pueden crecer;
- acciones se apilan;
- calendario conserva acceso al detalle del día;
- no aparece desplazamiento horizontal.

VoiceOver:

- landmarks y encabezados;
- pestaña seleccionada;
- calendario anuncia fecha, hoy, selección, estado y tipos;
- cifras anuncian valor y unidad;
- mensajes usan regiones `status` o `alert`;
- diálogos contienen foco y lo devuelven al origen;
- gráfica tiene resumen y lista equivalente.

Teclado:

- orden igual al visual;
- foco visible;
- Escape cancela diálogos cuando es seguro;
- Enter/Espacio activan controles;
- no hay acciones solo por arrastre.

Contraste:

- WCAG AA mínimo;
- color nunca es la única señal;
- éxito, advertencia y error tienen texto e icono;
- peso permanece azul neutral.

Movimiento reducido:

- se respeta `prefers-reduced-motion`;
- no hay desplazamientos ni escalas;
- la lógica no espera animaciones;
- escrituras, backup, restauración y actualización son independientes.

### 8.7 Pruebas visuales deterministas

Cada captura usa:

- fixtures ficticias fijas;
- reloj fijo;
- zona horaria `Europe/Madrid`;
- locale `es-ES`;
- animaciones desactivadas solo visualmente;
- almacenamiento presembrado en un origen aislado;
- fuentes e iconos locales;
- tamaño de viewport exacto.

Estados:

- Hoy vacío y poblado;
- Diario;
- calendario de cinco y seis semanas;
- sesión vacía y con muchas series;
- peso vacío, gráfico y alternativa textual;
- inventario normal, agotado, insuficiente y diferencia;
- compra, revisión y deshacer;
- receta multiingrediente;
- backup candidato, activado, rollback y confirmado;
- offline, error, operación pendiente y actualización disponible;
- borrado reforzado.

No se aprobará una diferencia aumentando tolerancias sin investigar su causa.

## 9. Fases locales y commits

No habrá despliegues entre fases. Todos los commits serán locales y cada fase se
detendrá para revisión según la autorización que se conceda en el futuro.

### Fase 0 — Migración y contrato de backup 3

Alcance:

- esquema 6 aditivo;
- doce tablas vacías;
- tipos y validadores;
- fixture v5 poblada;
- huellas del MVP 1 y protección de `nutriasta`;
- contrato, límites y parser de formato 3;
- dispatcher de formatos 1, 2 y 3;
- prueba de candidato sin UI funcional nueva.

Commit esperado:

`feat(storage): add MVP 2 schema and backup 3 contract`

Pruebas:

- `main-schema-v6`;
- preservación del MVP 1;
- aislamiento de datasets;
- inicializador idempotente;
- formato 3 válido e inválido;
- formatos 1 y 2 compatibles;
- tamaños falsos y expansión excesiva;
- downgrade rechazado.

Riesgos:

- alterar un índice existente;
- transformar filas durante apertura;
- confundir esquema 6 con una actualización de Dexie;
- cambiar sin querer el parser de formato 2.

Condición de parada:

- cualquier huella del MVP 1 cambia;
- `nutriasta` recibe una escritura;
- un formato 1 o 2 válido deja de importarse;
- el esquema no es exclusivamente aditivo.

Dependencias:

- parte del commit local que apruebe este plan técnico;
- conserva `9d2353e` como línea base del diff completo del MVP 2;
- no depende de ninguna fase posterior.

### Fase 1 — Sistema visual, shell y navegación

Alcance:

- tokens aprobados;
- componentes base;
- iconos locales;
- barra inferior y lateral;
- cabecera, mensajes, estados vacíos y operación pendiente;
- integración visual progresiva de Hoy, Diario y Perfil sin cambiar reglas.

Commit esperado:

`feat(ui): add approved responsive app shell`

Pruebas:

- navegación de cinco destinos;
- primer render con ancho válido;
- 320, 375, 390, 430 y escritorio;
- safe areas;
- texto al 200 %;
- foco, teclado, contraste y movimiento reducido;
- ausencia de solicitudes externas.

Riesgos:

- refactor visual que cambie una operación;
- ocultar funciones del MVP 1;
- barra inferior que tape contenido.

Condición de parada:

- cálculo, fila o transacción del MVP 1 cambia;
- aparece desbordamiento;
- una función solo es accesible mediante gesto;
- iconos o fuentes requieren red.

Dependencias:

- Fase 0 superada;
- utiliza los componentes y fixtures aprobados.

### Fase 2 — Calendario, sesiones y objetivos semanales

Alcance:

- periodos efectivos desde lunes;
- objetivo inicial 4 y rango 1–7;
- calendario mensual;
- resumen semanal;
- tipos iniciales y personalizados;
- sesiones y estados;
- copia de sesión;
- historial básico.

Commit esperado:

`feat(training): add calendar sessions and weekly goals`

Pruebas:

- lunes actual y siguiente;
- semanas anteriores inmutables;
- cambios de mes, año y horario;
- planificada, completada, cancelada y no planificada;
- varios tipos;
- copia con identificadores nuevos;
- conteo por sesión, no por tipo;
- calendario accesible y responsive.

Riesgos:

- fechas locales incorrectas;
- reinterpretar semanas pasadas;
- duplicar tipos iniciales.

Condición de parada:

- fecha efectiva distinta a la mostrada;
- una semana anterior cambia;
- calendario o cumplimiento cuentan incorrectamente.

Dependencias:

- Fases 0 y 1.

### Fase 3 — Ejercicios, series, historial y gráfica de peso

Alcance:

- catálogo de ejercicios;
- ejercicios y series opcionales;
- repeticiones, cargas y notas;
- revisión cronológica;
- historial de entrenamiento completo;
- entradas de peso;
- copia explícita desde perfil;
- gráfica neutral y alternativa textual.

Commit esperado:

`feat(progress): add exercises sets and weight history`

Pruebas:

- sesión sin ejercicios;
- ejercicio sin series;
- carga ausente frente a cero;
- valores negativos rechazados;
- copia no altera original;
- varias entradas de peso el mismo día;
- editar historial no cambia perfil;
- VoiceOver y teclado sobre gráfica/lista;
- ausencia de fotografías corporales.

Riesgos:

- presentar progreso como recomendación;
- gráfica inaccesible;
- formularios de series desbordados.

Condición de parada:

- aparece análisis médico o corporal;
- falta alternativa textual;
- una fotografía corporal entra en UI, base o backup.

Dependencias:

- Fases 0–2.

### Fase 4 — Inventario, compra y disponibilidad de recetas

Alcance:

- movimientos y saldo materializado;
- equivalencias explícitas;
- ajustes;
- lista activa e historial;
- completar y deshacer compra;
- consumo atómico con nutrición;
- edición, eliminación y reversión;
- agotamiento e insuficiencia;
- recetas multiingrediente y disponibilidad.

Commit esperado:

`feat(inventory): add stock shopping and recipe availability`

Pruebas:

- g y ml;
- porción explícita;
- unidad sin equivalencia;
- prohibición g↔ml;
- reconciliación;
- idempotencia;
- deltas de edición;
- reversión;
- tres decisiones de insuficiencia;
- receta todo o nada;
- compra y deshacer;
- fallos inyectados en cada punto transaccional.

Riesgos:

- saldo negativo;
- doble aplicación;
- nutrición e inventario divergentes;
- deshacer parcial.

Condición de parada:

- una operación modifica solo una parte;
- un retry duplica;
- se inventa una conversión;
- una receta queda parcialmente aplicada;
- una diferencia se presenta como exacta.

Dependencias:

- Fases 0–3;
- diarios, recetas y alimentos del MVP 1.

### Fase 5 — Backup 3, restauración, integración visual y endurecimiento

Alcance:

- exportación real de 26 tablas;
- importación 1/2/3;
- candidato, cancelación, activación, rollback, reactivación y confirmación;
- reconciliación del candidato;
- borrado funcional de 26 tablas;
- integración visual completa;
- offline, actualización y operaciones pendientes.

Commit esperado:

`feat(backup): integrate format 3 restore and harden MVP 2`

Pruebas:

- backup 3 cifrado;
- contraseña errónea;
- corrupción y límites;
- formatos 1/2 con tablas nuevas vacías;
- formato 3 completo;
- falta de cuota;
- cierre en cada estado;
- activación y rollback atómicos;
- eliminación total conserva catálogo, rollback, backups y PWA;
- todas las capturas deterministas.

Riesgos:

- memoria de Safari;
- candidato incompleto;
- borrar recuperación;
- actualización durante operación.

Condición de parada:

- validación larga dentro de transacción;
- activo alterado antes de confirmar;
- no hay espacio simultáneo;
- actualización se activa sola;
- backup no representa exactamente las 26 tablas.

Dependencias:

- Fases 0–4.

### Fase 6 — Versión 0.3.0 y validación final

Alcance:

- cambiar versión en los tres puntos aprobados;
- actualizar textos del manifiesto sin cambiar origen ni iconos;
- documentación final;
- dos rondas completas;
- revisión del diff desde `9d2353e`;
- preparar un único commit de versión;
- no desplegar.

Commit esperado:

`chore(release): prepare NutrIAsta 0.3.0`

Pruebas:

- suite completa descrita en el apartado 10;
- build limpio;
- actualización local 0.2.1→0.3.0;
- service worker controlado;
- offline;
- iconos y manifiesto;
- ausencia de tráfico externo.

Riesgos:

- versión incoherente;
- caché que activa automáticamente;
- diferencias no revisadas entre dos rondas.

Condición de parada:

- cualquier comando falla;
- el árbol no está limpio;
- el diff contiene un archivo fuera de alcance;
- las dos rondas no producen el mismo resultado;
- sería necesario desplegar para cerrar una prueba automatizable.

Dependencias:

- Fases 0–5 terminadas y aprobadas localmente.

## 10. Validación final

### 10.1 Entorno reproducible

- Node 24;
- árbol limpio;
- HEAD esperado de la implementación futura;
- sin remotos nuevos;
- `npm ci` desde `package-lock.json`;
- ninguna dependencia instalada manualmente;
- `dist` regenerado desde cero;
- puerto E2E efímero y servidor no reutilizable, mediante el script actual.

### 10.2 Comandos

En este orden:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build:web`
5. `npm run test:e2e -- --project=chromium`
6. `npm run test:e2e -- --project=webkit`
7. `npx expo-doctor`
8. `npm audit`
9. `npm audit --omit=dev`

No se ejecutará `npm audit fix --force`, no se rebajará Expo y no se cambiarán
versiones fuera de compatibilidad con SDK 57. Una vulnerabilidad transitiva sin
solución compatible se documentará como riesgo pendiente.

### 10.3 TypeScript y unitarias

TypeScript debe terminar sin errores.

Las unitarias cubrirán:

- esquema y preservación;
- fechas y periodos;
- sesiones, copias y conteos;
- peso;
- cantidades canónicas;
- idempotencia;
- reconciliación;
- transacciones y fallos inyectados;
- contratos 1, 2 y 3;
- límites, checksums y relaciones;
- borrado individual y total;
- espera de actualización.

### 10.4 E2E

Cada ejecución E2E:

- compila `dist` nuevamente;
- reserva un puerto exclusivo;
- no reutiliza un servidor;
- usa bases y datos ficticios;
- intercepta peticiones externas;
- prueba Chromium y WebKit ejecutable en Windows.

Solo se omitirán en WebKit para Windows las capacidades realmente exclusivas de
Safari/iPhone. La limitación se documentará con prueba física equivalente; no se
aumentarán esperas para ocultar una causa.

### 10.5 Build PWA

El build debe verificar:

- exportación estática;
- manifiesto;
- los tres iconos aprobados;
- rutas relativas;
- `sw.js`;
- precaché;
- `skipWaiting` desactivado;
- `clientsClaim` desactivado;
- `sw.js` no autocacheado;
- IndexedDB fuera del service worker;
- apertura offline;
- ninguna URL de terceros.

### 10.6 Privacidad y tráfico

Una prueba bloquea y falla ante cualquier solicitud cuyo origen no sea el servidor
local de prueba. Se revisarán:

- HTML, CSS, JavaScript y sourcemaps;
- manifiesto y service worker;
- fuentes, imágenes e iconos;
- `fetch`, XHR, WebSocket, beacon y formularios;
- analítica, telemetría y APIs externas.

Los únicos archivos usados serán recursos locales y datos ficticios.

### 10.7 Actualización 0.2.1 → 0.3.0

La prueba automatizada servirá dos compilaciones sucesivas bajo el mismo origen
local:

1. instalar/cargar la compilación exacta de `mvp-1-approved-0.2.1`;
2. sembrar una base v5 poblada;
3. cambiar el servidor a la compilación candidata 0.3.0;
4. comprobar que 0.2.1 no se recarga sola;
5. comprobar el banner;
6. iniciar una operación pendiente y verificar que Actualizar espera;
7. pulsar expresamente Actualizar;
8. comprobar service worker nuevo y esquema 6;
9. comparar las huellas del MVP 1;
10. verificar las doce tablas y la navegación;
11. cerrar, reabrir y probar offline.

La prueba física necesitará un único despliegue final posterior y autorización
independiente. No habrá despliegues por fase.

### 10.8 Pruebas visuales

En cada estado crítico se comprobarán:

- 320, 375, 390 y 430 px;
- 1.280 y 1.440 px;
- texto al 200 %;
- `scrollWidth`;
- controles dentro del viewport;
- safe areas;
- barra inferior o lateral;
- foco y orden de teclado;
- nombres accesibles;
- diálogos y retorno de foco;
- alternativa textual de peso;
- movimiento reducido;
- estados que no dependan solo de color.

### 10.9 Dos rondas finales

Ronda 1:

- borrar artefactos generados mediante los scripts seguros existentes;
- `npm ci`;
- ejecutar la secuencia completa;
- revisar resultados, capturas y auditoría.

Ronda 2:

- partir otra vez de build limpio;
- repetir todos los comandos;
- comparar número de pruebas, omisiones, capturas, hashes de build relevantes y
  resultados;
- no aceptar fallos intermitentes.

Una prueba flaky se investiga; no se resuelve elevando timeouts sin causa.

### 10.10 Revisión del diff

Antes de cualquier commit final:

- `git diff --check`;
- revisar cada commit por fase;
- revisar `git diff 9d2353e7319db950dbafb87c9bdbb6c122e49b47..HEAD`;
- confirmar que las fases solo contienen sus archivos;
- confirmar que `mvp-1-approved-0.2.1` sigue apuntando a
  `b0cb7620660677e3d166288811c58b0fa15a23cb`;
- confirmar que `nutriasta` continúa declarada en versión 1;
- confirmar que no hay remotos, pushes, hosting ni artefactos con datos;
- buscar secretos, URLs externas, backups y fotografías no ficticias.

## 11. Condiciones globales de parada

La implementación futura se detendrá si:

- se necesita una dependencia nueva;
- cambia el contrato funcional o visual aprobado;
- se modifica un cálculo nutricional;
- se altera una fila o blob del MVP 1 durante migración;
- `nutriasta` recibe una escritura;
- se pierde activo, rollback o recuperación;
- una consulta mezcla datasets;
- el downgrade se intenta mediante borrado o recreación;
- aparece saldo negativo;
- un movimiento o consumo se duplica;
- nutrición e inventario dejan de ser atómicos;
- una receta se aplica parcialmente;
- una compra se deshace parcialmente;
- se inventa una equivalencia o conversión g↔ml;
- un candidato afecta al activo antes de activarse;
- falta espacio para mantener ambos datasets;
- una validación larga ocurre dentro de una transacción;
- la actualización se activa sin consentimiento;
- `sw.js` queda cacheado de forma que impide avisar;
- aparece tráfico externo, analítica o telemetría;
- se usa un dato o fotografía real;
- aparece fotografía corporal o análisis médico;
- existe desplazamiento horizontal entre 320 y 430 px;
- texto al 200 % oculta una acción;
- una animación gobierna una escritura;
- VoiceOver o teclado no pueden completar un flujo;
- un comando final falla o una omisión carece de justificación;
- se pretende desplegar una fase intermedia.

## 12. Estado de aprobación

Este archivo queda **aprobado como plan técnico del MVP 2**.

La implementación local de sus fases 0–6 ha sido autorizada de forma expresa y
separada, con los límites y condiciones de parada descritos. Continúan sin
autorización:

- instalar o actualizar dependencias;
- desplegar o publicar;
- crear remotos o realizar pushes;
- modificar el acceso, la URL o el sitio privado.
