# NutrIAsta — Plan técnico de la Fase 0

Estado: **aprobado para implementación local**  
Fecha: 22 de julio de 2026  
Especificación funcional: commit `87bf003`  
Base de partida: `viability-approved-0.1.1`

## 1. Objetivo y límites

La Fase 0 demostrará que NutrIAsta puede pasar de la base de viabilidad 0.1.1 a una base paralela destinada al MVP 1 sin modificar, actualizar ni eliminar la base original. Implementará copia directa, huella, verificación, activación, cancelación, rollback, reactivación, recuperación e importación de backups de formato 1.

Esta fase no implementará perfil, nutrición, catálogo, entrenamientos, recetas, OCR, Open Food Facts ni funciones experimentales. Tampoco cambiará la versión de la aplicación ni autoriza despliegue.

## 2. Bases IndexedDB

| Nombre | Versión | Función | Regla de protección |
|---|---:|---|---|
| `nutriasta` | 1 | Base original de viabilidad 0.1.1 | Se abre con el esquema actual; no se escribe, actualiza, migra ni elimina |
| `nutriasta-main` | 1 | Base estable del MVP 1 y fases posteriores | Recibe candidatos temporales y controla la fuente seleccionada |

La base `nutriasta-main` comenzará con las tablas `metadata`, `datasets`, `migrationRuns`, `legacyViabilityRecords` y `legacyViabilityPhotos`. No se crearán todavía las entidades funcionales de las fases 1–5.

`metadata` conservará `activeSource`, `activeDatasetId`, la sesión de rollback, el estado de migración y la huella del origen. El código 0.1.1 continuará pudiendo abrir `nutriasta` porque su nombre, versión y esquema permanecerán intactos.

No existe una transacción atómica entre dos bases IndexedDB. La seguridad se obtiene dejando el origen inmutable, escribiendo primero un candidato completo y realizando el cambio de fuente mediante una transacción breve y atómica dentro de `nutriasta-main`.

## 3. Copia directa desde 0.1.1

1. Abrir `nutriasta` sin solicitar una versión superior.
2. Validar su versión, tablas, `activeDatasetId`, dataset, registro y fotografía ficticios.
3. Calcular una huella del origen con identificador, recuentos, contenido estructurado, checksums y tamaños de blobs.
4. Comprobar espacio disponible.
5. Crear en `nutriasta-main` un dataset `staging` y una ejecución de migración.
6. Copiar los datos en lotes y transacciones cortas exclusivamente sobre la base nueva.
7. Volver a leer el candidato y verificar recuentos, contenido, tamaños y checksums.
8. Recalcular la huella de `nutriasta`; si ha cambiado, abandonar el candidato.
9. Mostrar el candidato preparado sin activarlo.
10. Tras confirmación, cambiar `activeSource` a `main` y `activeDatasetId` en una transacción breve.

La preparación completa se registrará como operación bloqueante de actualizaciones. Un error o cierre antes de activar mantendrá `activeSource: legacy`.

## 4. Compatibilidad con backups de formato 1

Se conservarán el cifrado AES-256, la comparación semántica de `minimumAppVersion`, los checksums y todos los límites actuales:

- archivo cifrado: 32 MiB;
- manifiesto: 128 KiB;
- registros: 256 KiB;
- fotografía: 16 MiB;
- miniatura: 1 MiB;
- contenido total: 18 MiB;
- un registro y una fotografía ficticios.

Se aceptarán `.nutriasta`, `.zip` y `.nutriasta.zip`, validando el contenido en vez de confiar en la extensión o MIME. El límite futuro de 4 MB para fotografías del MVP 1 no se aplicará retroactivamente a un backup válido de formato 1.

El archivo se leerá, descifrará, descomprimirá y validará fuera de transacciones de IndexedDB. Después se normalizará, se escribirá como dataset `staging` en `nutriasta-main`, se verificará desde la base y se ofrecerá para cancelar o activar. Nunca se mezclará con datos existentes.

## 5. Rollback y recuperación

- Antes de activar, contraseña incorrecta, corrupción, cierre o falta de espacio no cambian la fuente activa.
- Los candidatos interrumpidos quedan `abandoned` y se limpian sin tocar el origen.
- `Volver a 0.1.1` cambia atómicamente `activeSource` a `legacy` y conserva el candidato principal.
- `Reactivar migración` vuelve a seleccionar `main`.
- Confirmar elimina la sesión temporal, pero no borra `nutriasta`.
- Si `nutriasta-main` no abre, se ofrece recuperación desde `nutriasta`.
- Si el origen no es válido, se permite preparar un candidato desde un backup de formato 1.
- Si ambas fuentes fallan, la aplicación se detiene sin crear datos vacíos ni sobrescribir nada.

La eliminación de la base original queda fuera de la Fase 0 y del primer despliegue del MVP 1.

## 6. Espacio y memoria

`payloadBytes` será la suma del JSON UTF-8, fotografía y miniatura. Antes de escribir se exigirá espacio adicional estimado de:

`ceil(payloadBytes × 1,5) + 10 MiB`

Durante una restauración pueden coexistir la base original, el dataset principal y el candidato. Si Safari no informa de cuota, la activación física se detendrá hasta revisar tamaño y backup. Cualquier `QuotaExceededError` debe dejar las fuentes anteriores utilizables.

El descifrado y la descompresión serán secuenciales y estarán fuera de transacciones largas. Los blobs se liberarán de memoria después de verificarlos y escribirlos.

## 7. Archivos previstos

### Nuevos

- `src/storage/main-schema.ts`
- `src/storage/main-database.web.ts`
- `src/storage/main-dataset-types.ts`
- `src/storage/main-dataset-repository.web.ts`
- `src/migration/legacy-source-reader.web.ts`
- `src/migration/migration-service.web.ts`
- `src/migration/migration-service.native.ts`
- `src/migration/migration-types.ts`
- `src/backup/decode-format-1.web.ts`
- `src/backup/import-format-1-to-main.web.ts`
- `src/features/migration/migration-panel.web.tsx`
- `src/features/migration/migration-panel.native.tsx`
- `tests/unit/main-schema.test.ts`
- `tests/unit/migration-service.test.ts`
- `tests/unit/format-1-migration.test.ts`
- `tests/e2e/migration.spec.ts`

### Modificados

- `src/backup/restore-backup.web.ts`
- `src/features/viability/viability-screen.web.tsx`
- `src/features/viability/viability-screen.native.tsx`
- `tests/e2e/restore.spec.ts`
- `tests/e2e/service-worker-update.spec.ts`
- `README.md`

La lista podrá reducirse si una separación no aporta seguridad, pero no se ampliará materialmente sin justificarlo. `src/storage/schema.ts` y la declaración actual de `nutriasta` permanecerán inalterados.

## 8. Dependencias

No se instalarán dependencias. Se reutilizarán Dexie, ZIP.js, Web Crypto, Vitest, fake-indexeddb, Playwright y el controlador actual de operaciones bloqueantes, todos ya presentes y compatibles con Expo SDK 57.

## 9. Pruebas

### Unitarias

- nombres, versiones y esquemas separados;
- ausencia de escrituras sobre `nutriasta`;
- copia exacta y huellas;
- cambio concurrente del origen;
- preparación idempotente e interrupciones;
- activación, cancelación, rollback y reactivación;
- errores de cuota;
- origen ausente, vacío o dañado;
- backups formato 1 válidos y extensiones admitidas;
- contraseña incorrecta, corrupción, tamaños falsos, descompresión excesiva y checksums inválidos.

### E2E

Cada ejecución generará un `dist` limpio y usará un servidor y puerto aislados. Chromium y WebKit comprobarán copia, activación, recarga, rollback, recuperación, backups, modo offline, actualización controlada y ausencia de `indexedDB.deleteDatabase`. No se prevén omisiones automatizadas específicas de esta fase.

### Físicas

Tras una autorización separada de despliegue, el iPhone comprobará actualización controlada, copia, activación, cierre, reinicio, modo avión, rollback, reactivación, importación de formato 1, uso/cuota y ausencia de tráfico externo. Solo se usarán registro y fotografía ficticios.

## 10. Criterios de parada

La implementación se detendrá si se modifica la versión o una tabla de `nutriasta`, se escribe o elimina el origen, cambia su huella durante la copia, la activación no es atómica dentro de `nutriasta-main`, un error afecta a la fuente activa, una actualización interrumpe el proceso, falla una comprobación obligatoria o aparece tráfico externo inesperado.

## 11. Orden exacto

1. Crear y probar esquema y repositorio de `nutriasta-main`.
2. Implementar lector estrictamente no modificador de `nutriasta`.
3. Implementar huellas y estimación de espacio.
4. Implementar copia directa, verificación y cancelación.
5. Implementar activación, rollback, reactivación y recuperación.
6. Extraer el decodificador puro de formato 1 y ejecutar regresión 0.1.1.
7. Implementar importación de formato 1 a candidato de la base nueva.
8. Añadir el panel técnico mínimo.
9. Ejecutar typecheck, unitarias, build, E2E y Expo Doctor.
10. Revisar diff y demostrar que `nutriasta` permanece intacta.
11. Crear un commit local específico si todo es correcto.
12. Detenerse antes de cambiar versión o desplegar.
