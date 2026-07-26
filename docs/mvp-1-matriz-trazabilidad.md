# NutrIAsta — Matriz de trazabilidad del MVP 1 garantizado

Fecha de revisión: 26 de julio de 2026
Versión propuesta sin desplegar: `0.2.0`
Especificación de referencia: `docs/mvp-1-perfil-nutricion.md`

Estados:

- **Verificado**: existe interfaz utilizable y prueba automatizada.
- **Verificado local / pendiente iPhone**: la implementación y las pruebas reproducibles locales son correctas, pero la aceptación exige Safari/iPhone.
- **Condicionado**: la propia especificación supedita la función a disponibilidad o prueba física; existe alternativa manual.
- **Excluido**: fuera del MVP 1 aprobado y no implementado.

Un requisito que solo tenga modelo de datos no se considera completado.

## Perfil, orientación y objetivos

| ID | Criterio garantizado | Implementación utilizable | Prueba | Estado |
|---|---|---|---|---|
| P-01 | Crear y editar alias, edad adulta, sexo de fórmula, altura y peso | `mvp-screen.web.tsx`, `profile-repository.web.ts` | `profile-repository.test.ts`, `profile-settings.spec.ts` | Verificado |
| P-02 | Registrar gimnasio, pasos, deportes y descripción | Editor de perfil y validación del repositorio | `profile-repository.test.ts` y recorrido E2E de creación | Verificado |
| P-03 | Elegir PAL manualmente, sin sugerencia automática | Selector PAL del perfil | `nutrition-calculations.test.ts`, `profile-settings.spec.ts` | Verificado |
| P-04 | Mostrar Mifflin–St Jeor, entradas, PAL, fecha y etiqueta `Estimación` | Tarjeta de orientación energética | `nutrition-calculations.test.ts`, `profile-settings.spec.ts` | Verificado |
| P-05 | Mostrar reposo, mantenimiento y diferencia con objetivo manual vigente | Tarjeta de orientación y resolución del periodo vigente | `profile-settings.spec.ts` | Verificado |
| P-06 | Separar ejemplos ±5 %/±10 % de objetivos manuales | Recuadro ilustrativo independiente | `nutrition-calculations.test.ts`, `profile-settings.spec.ts` | Verificado |
| P-07 | No copiar una estimación sin acción y confirmación explícitas | Botón de copia a borrador con `confirm`; nunca guarda por sí solo | `profile-settings.spec.ts` prueba cancelar y aceptar | Verificado |
| P-08 | Objetivos manuales de kcal, macros y agua con fecha de vigencia | Periodos inmutables `nutritionTargetPeriods` | `profile-repository.test.ts`, `profile-settings.spec.ts` | Verificado |
| P-09 | Conservar el objetivo histórico del día | Snapshot en `diaryDays` | `diary-repository.test.ts` | Verificado |
| P-10 | Diferenciar orientación de consejo médico | Textos explícitos de estimación, referencia general y no diagnóstico | `profile-settings.spec.ts`; revisión de interfaz | Verificado |

## Catálogo, porciones, fotografías y EAN

| ID | Criterio garantizado | Implementación utilizable | Prueba | Estado |
|---|---|---|---|---|
| A-01 | Alta, consulta, edición y archivado de alimentos | Catálogo local y `FoodRepository` | `food-repository.test.ts`, `foods.spec.ts` | Verificado |
| A-02 | Datos por 100 g o 100 ml, marca, supermercado y notas | Editor de alimento | `foods.spec.ts`, `diary.spec.ts` | Verificado |
| A-03 | Varias porciones: crear, consultar, editar y eliminar | Editor de lista de porciones y persistencia separada | `food-repository.test.ts`, `foods.spec.ts` | Verificado |
| A-04 | Editar sin borrar porciones o fotografía | Opciones `undefined` conservan; UI carga ambos recursos antes de editar | `food-repository.test.ts`, `foods.spec.ts` | Verificado |
| A-05 | Mostrar fotografía/miniatura tras guardar y recargar | `PhotoPreview` desde el `Blob` persistido | `photo.spec.ts` en Chromium | Verificado local / pendiente iPhone |
| A-06 | Sustituir o eliminar foto con confirmación sin borrar alimento | Acciones independientes del editor | `food-repository.test.ts`, `photo.spec.ts` en Chromium | Verificado local / pendiente iPhone |
| A-07 | JPEG local, checksum, máximo 2.048 px y 4 MB | `food-photo-processing.web.ts`, `FoodPhoto` | pruebas de fotografía y backup; validación física pendiente | Verificado local / pendiente iPhone |
| A-08 | Seleccionar energía declarada o calculada 4/4/9 | Selector real; el repositorio calcula y etiqueta la segunda opción | `food-repository.test.ts`, `foods.spec.ts` | Verificado |
| A-09 | EAN-8/EAN-13 manual y prevención de duplicados | Campo manual, normalización e índice local | `ean.test.ts`, `foods.spec.ts` crea un segundo alimento real | Verificado |
| A-10 | Detector EAN local solo si el navegador lo ofrece | `BarcodeDetector` condicionado; formulario manual permanente | comprobación de ausencia de red; prueba física requerida | Condicionado |
| A-11 | Buscar por nombre, marca, supermercado o EAN; favoritos y recientes | Filtros del catálogo y `lastUsedAt` | `foods.spec.ts`, `diary.spec.ts` | Verificado |

## Diario, unidades, agua y entrenamiento

| ID | Criterio garantizado | Implementación utilizable | Prueba | Estado |
|---|---|---|---|---|
| D-01 | Desayuno, comida, cena y varios tentempiés | Comidas estructuradas por franja, sin clave única por franja | `diary-repository.test.ts`, `diary.spec.ts` | Verificado |
| D-02 | Prohibir g↔ml sin densidad | Repositorio rechaza combinaciones; UI solo ofrece la unidad base | `diary-repository.test.ts`, `diary.spec.ts` | Verificado |
| D-03 | Convertir unidades y porciones únicamente a la unidad base | Equivalencia explícita y porciones ligadas a alimento/unidad base | `diary-repository.test.ts`, `diary.spec.ts` | Verificado |
| D-04 | Seleccionar porciones guardadas con equivalencia correcta | Selector de porción y cálculo de `baseAmount` | `diary-repository.test.ts`, `diary.spec.ts` | Verificado |
| D-05 | Varios alimentos o recetas por comida y subtotal conjunto | Destino a comida existente y suma de elementos | `diary-repository.test.ts`, `diary.spec.ts` | Verificado |
| D-06 | Editar cantidad/nota/franja, mover y eliminar con confirmación | Editor por elemento y transacción de movimiento | `diary-repository.test.ts`, `diary.spec.ts` | Verificado |
| D-07 | Conservar fecha, hora, estado y nota | `MealEntry.occurredAt`, `state` y `MealItem.note` visibles | `diary.spec.ts`, `recipe-planning.test.ts` | Verificado |
| D-08 | Acceso a alimentos, recetas y comidas recientes | Panel `Recientes` y botones de reutilización/copia | `diary-repository.test.ts`, `diary.spec.ts` | Verificado |
| D-09 | Snapshots históricos de alimentos, recetas y objetivos | Snapshots en día y elemento; no se recalculan al editar fuentes | `diary-repository.test.ts`, `recipe-planning.test.ts` | Verificado |
| D-10 | Copiar comida/día, planificar futuro y convertir a consumido | Acciones del diario y repositorio | `recipe-planning.test.ts`, `recipes-planning.spec.ts` | Verificado |
| D-11 | Totales consumidos, planificados, objetivo y diferencia | Resumen diario separado por estado | `diary.spec.ts`, `recipes-planning.spec.ts` | Verificado |
| D-12 | Agua: altas, edición, borrado, total y objetivo opcional | Sección de hidratación | `diary-repository.test.ts`, `diary.spec.ts` | Verificado |
| D-13 | Accesos rápidos configurables, iniciales 250/500 ml | Ajustes persistidos en perfil | `profile-repository.test.ts`, `profile-settings.spec.ts` | Verificado |
| D-14 | Entrenamiento diario mínimo sí/no, tipo y nota | `trainingDayFlags` y sección diaria | `diary-repository.test.ts`, `diary.spec.ts` | Verificado |

## Recetas y planificación

| ID | Criterio garantizado | Implementación utilizable | Prueba | Estado |
|---|---|---|---|---|
| R-01 | Crear/editar receta con alimentos y cantidades | Editor de recetas y `RecipeRepository` | `recipe-planning.test.ts`, `recipes-planning.spec.ts` | Verificado |
| R-02 | Totales, número de porciones y peso final opcional | Cálculo local y presentación por porción | `recipe-planning.test.ts`, `recipes-planning.spec.ts` | Verificado |
| R-03 | Registrar porción o gramos cuando existe peso final | Alta de receta en diario con validación | `recipe-planning.test.ts` | Verificado |
| R-04 | Favoritos y archivado | Acciones de la lista de recetas | recorrido de interfaz y repositorio; pendiente ampliar E2E específica | Verificado |
| R-05 | Editar receta sin reescribir consumos históricos | Snapshot del total y nombre al registrar | `recipe-planning.test.ts` | Verificado |

## Almacenamiento, backup, privacidad y PWA

| ID | Criterio garantizado | Implementación utilizable | Prueba | Estado |
|---|---|---|---|---|
| S-01 | Toda entidad funcional pertenece a `datasetId` | 14 tablas de `nutriasta-main` filtradas por dataset activo | `main-schema.test.ts`, repositorios y backup integral | Verificado |
| S-02 | Mantener `nutriasta` 0.1.1 en versión 1 y solo lectura | Base separada; ningún flujo del MVP escribe en ella | pruebas de migración, persistencia y privacidad | Verificado local / pendiente iPhone |
| S-03 | Importar backup formato 1 sin cambiar el activo durante preparación | Flujo de Fase 0 preservado | `format-1-migration.test.ts`, `restore.spec.ts` | Verificado |
| S-04 | Backup formato 2 cifrado con las 14 tablas y fotografías | `FullBackupService` y panel de backup | `full-backup-service.test.ts` con 14 tablas; `full-backup.spec.ts` en Chromium | Verificado local / pendiente iPhone |
| S-05 | Validar versión, tamaños, entradas, expansión y checksums fuera de activación | Parser y decodificación acotados antes de staging | `backup-format.test.ts`, `full-backup-format.test.ts` | Verificado |
| S-06 | Candidato temporal, cancelación, activación atómica, rollback, reactivación y confirmación | Dataset `staging` y cambio corto del puntero activo | pruebas unitarias de integración y `full-backup.spec.ts` | Verificado local / pendiente iPhone |
| S-07 | Ajustes, privacidad y almacenamiento visible | Pestaña `Ajustes y privacidad`, Storage API y fecha de backup | `profile-settings.spec.ts` | Verificado local / pendiente iPhone para Storage API real |
| S-08 | Borrado reforzado y cancelable, mostrando último backup | Token `ELIMINAR` más segunda confirmación | `data-erasure.test.ts`, `profile-settings.spec.ts` | Verificado |
| S-09 | El borrado no elimina `nutriasta`, rollback, catálogo de datasets, backups ni PWA | Servicio borra solo filas del dataset activo en 14 tablas; texto exacto en UI | `data-erasure.test.ts`, `profile-settings.spec.ts` compara base histórica | Verificado |
| S-10 | Offline e instalación PWA | Manifiesto, iconos, precaché y service worker | `offline.spec.ts` Chromium; prueba física obligatoria | Verificado local / pendiente iPhone |
| S-11 | Actualización consentida, sin `skipWaiting` automático y sin tocar IndexedDB | Controlador espera escrituras y operaciones, incluida foto | `service-worker-update.spec.ts`, `write-tracker.test.ts` | Verificado local / pendiente iPhone |
| S-12 | Sin red de terceros, backend, analítica ni telemetría | Aplicación completamente local | `privacy.spec.ts` en Chromium y WebKit; búsqueda estática de código | Verificado |
| S-13 | Persistencia web no presentada como garantía | Advertencias y estado real de Storage API | recorrido de interfaz; prueba física obligatoria | Verificado local / pendiente iPhone |

## Exclusiones controladas

| ID | Exclusión aprobada | Evidencia | Estado |
|---|---|---|---|
| X-01 | OCR y análisis automático de etiquetas | No hay dependencia ni módulo OCR | Excluido |
| X-02 | Open Food Facts y otras APIs externas | No hay cliente de red de aplicación | Excluido |
| X-03 | Sugerencia automática de PAL | Solo selector manual | Excluido |
| X-04 | Backend, cuentas, nube, analítica y telemetría | Arquitectura local y prueba de solicitudes | Excluido |
| X-05 | Datos médicos, alergias, embarazo y trastornos alimentarios | No existen campos; aviso explícito | Excluido |
| X-06 | Fotos de progreso, gráficas, entrenamiento detallado e inventario | Reservados a MVP 2/MVP 3 | Excluido |

## Aceptación pendiente

La matriz no declara aceptadas físicamente las capacidades dependientes de Safari/iPhone. Antes de desplegar o aprobar el MVP 1 deben superarse en el dispositivo: fotografía desde cámara/Archivos, `BarcodeDetector` o su degradación manual, Storage API real, persistencia tras reinicio, apertura offline, actualización controlada y ciclo completo de backup/restauración con las 14 tablas.
