# NutrIAsta — prueba de viabilidad PWA

Esta versión valida exclusivamente instalación PWA, apertura offline, IndexedDB/Dexie, una fotografía ficticia, backup cifrado, restauración por datasets y actualización controlada. No contiene nutrición, perfil, entrenamientos, inventario, OCR, escáner, Open Food Facts, recetas ni datos personales reales.

## Reglas y límites de esta fase

- El producto de uso diario es exclusivamente la PWA para iPhone con iOS 17 o posterior.
- Expo Go solo muestra una previsualización de interfaz sin almacenamiento de producción.
- No hay backend, cuentas, analítica, APIs, telemetría ni transmisión de fotografías.
- Se debe utilizar exclusivamente información ficticia y fotografías de objetos sin personas, etiquetas privadas ni datos identificables.
- La persistencia de Safari no está garantizada, incluso si `navigator.storage.persisted()` devuelve `true`.
- La versión 0.1.0 cuenta con autorización expresa para un único despliegue HTTPS temporal. Una segunda versión o cualquier cambio del contenido requiere una autorización nueva.

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

Resultados obtenidos el 22 de julio de 2026 en Windows:

- TypeScript: correcto.
- Vitest: 5 archivos y 12 pruebas correctas.
- Exportación PWA y verificación de `dist`: correctas.
- Playwright: 12 pruebas correctas; 2 omisiones justificadas en WebKit para Windows.
- Expo Doctor: 20/20 comprobaciones correctas.

Las dos omisiones son exclusivamente:

1. Reapertura offline: Playwright WebKit para Windows devuelve un error interno al navegar sin red bajo control de service worker.
2. Fotografía: Playwright WebKit para Windows no serializa de forma fiable un `Blob` en IndexedDB.

Estas mismas pruebas sí se ejecutan en Chromium. En macOS u otras plataformas no se omiten automáticamente, porque la condición está limitada a WebKit sobre Windows. Safari en el iPhone real sigue siendo la validación obligatoria.

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

`minimumAppVersion` representa una versión mínima, no una igualdad exacta. Las versiones se comparan numéricamente como `mayor.menor.parche`: una aplicación posterior puede abrir un backup anterior, mientras que una versión demasiado antigua rechaza el archivo antes de importarlo.

Tras validar el contenido, la restauración escribe un dataset temporal en lotes. Solo cambia `activeDatasetId` en una transacción breve y atómica. El dataset anterior se conserva para cancelación o rollback.

## Actualizaciones PWA

- El service worker no activa `skipWaiting` automáticamente.
- Una versión preparada espera la confirmación del usuario.
- Antes de activarse espera tanto las escrituras IndexedDB como el procesamiento local de una fotografía que todavía no haya llegado a la escritura.
- IndexedDB no forma parte del precaché y el service worker no contiene ninguna eliminación de la base.

## Riesgo pendiente de dependencias

`npm audit` informa actualmente de 10 vulnerabilidades moderadas transitivas en la cadena de herramientas de Expo 57: `expo` → `@expo/config-plugins` → `xcode` → `uuid`, además de paquetes de configuración relacionados. La corrección propuesta por npm rebajaría Expo a 46.0.21, lo que es incompatible con este proyecto.

`npx expo install --check` confirma que las dependencias son las compatibles con SDK 57 y `npx expo-doctor` termina correctamente. No se ha usado `npm audit fix --force`, no se ha aplicado un `override` inseguro y no se ha rebajado Expo. El riesgo queda documentado hasta que Expo publique una corrección compatible con SDK 57; la dependencia vulnerable pertenece a herramientas de configuración nativa y no al código ejecutado por la PWA en Safari.

## Pruebas obligatorias en Safari/iPhone

Cuando exista autorización para un despliegue HTTPS de prueba:

1. Abrir la URL en Safari y añadirla a la pantalla de inicio.
2. Confirmar el modo independiente y revisar persistencia, uso, cuota y aviso de backup.
3. Crear `registro-prueba-001` y fotografiar exclusivamente un objeto sin información personal.
4. Cerrar, forzar cierre y reiniciar el iPhone; verificar registro y fotografía.
5. Abrir y editar en modo avión; cerrar y volver a abrir todavía sin red.
6. Exportar un backup cifrado y guardarlo en “En mi iPhone”.
7. Probar contraseña incorrecta, archivo manipulado, cancelación, activación, rollback y confirmación.
8. Con una autorización adicional, publicar una segunda versión ficticia y comprobar que la actualización espera consentimiento.
9. Iniciar una fotografía y, mientras se procesa, solicitar la actualización; confirmar que espera y conserva la imagen.
10. Verificar que registro, fotografía, `activeDatasetId` y fecha del backup sobreviven a la actualización y a una nueva apertura offline.

La superación de estas pruebas solo demuestra el comportamiento del iPhone probado; iOS puede eliminar almacenamiento web posteriormente.

## Despliegue HTTPS

1. Obtener autorización expresa para cada versión que se vaya a publicar. La autorización actual se limita a la versión ficticia 0.1.0.
2. Ejecutar `npm ci`, la validación completa y `npm run build:hosting` en un entorno limpio.
3. Publicar exclusivamente el paquete estático generado bajo el mismo origen HTTPS estable.
4. Servir `manifest.webmanifest` con un tipo MIME apropiado y `sw.js` sin caché HTTP prolongada.
5. No añadir analítica, cabeceras que envíen datos a terceros, APIs ni transformación remota de fotografías.
6. Registrar la URL, versión, fecha y hash desplegado antes de comenzar las pruebas del iPhone.

No se publicará una segunda versión sin autorización expresa independiente.
