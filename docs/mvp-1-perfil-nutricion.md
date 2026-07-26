# NutrIAsta — Especificación funcional del MVP 1

Estado: **aprobado e implementado localmente; pendiente de validación física y sin autorización de despliegue**
Fecha: 22 de julio de 2026  
Base aprobada: `viability-approved-0.1.1`

## 1. Definición del producto

NutrIAsta será una PWA privada y personal para registrar alimentación, agua y el cumplimiento de objetivos nutricionales definidos por su único usuario. Todo funcionará en español, con criterios y unidades habituales en España, sin cuentas propias, backend, sincronización ni almacenamiento remoto.

El MVP 1 no decidirá objetivos corporales ni sustituirá el criterio del usuario. Permitirá introducir objetivos diarios propios y compararlos con el consumo registrado. También mostrará estimaciones orientativas de mantenimiento y referencias generales, siempre separadas de los objetivos manuales.

### Usuario objetivo

- Una sola persona: el propietario de la aplicación.
- País: España.
- Idioma: español.
- Edad actual: 22 años; la edad será editable.
- Población soportada por las orientaciones: persona adulta. No se diseñará para menores ni para terceros.
- Dispositivo de producción: iPhone con iOS 17 o posterior, como PWA instalada.
- Uso esperado: diario, offline y sin ordenador encendido.

## 2. Objetivo y problemas que resolverá

### Objetivo principal

Ofrecer un registro privado y verificable de lo consumido cada día para conocer:

- calorías consumidas;
- proteínas, carbohidratos y grasas;
- distribución por comidas;
- diferencia frente a los objetivos manuales;
- agua registrada;
- si se ha entrenado ese día;
- comidas planificadas para fechas futuras.

### Problemas que resolverá

- Evitar depender de servicios con cuenta, suscripción o conexión permanente.
- Mantener un catálogo propio con los productos que realmente compra el usuario en España.
- Calcular cantidades consumidas a partir de datos por 100 g, 100 ml o porción.
- Reutilizar alimentos, comidas y recetas frecuentes sin introducirlos de nuevo.
- Separar objetivos personales de estimaciones orientativas.
- Conservar fotografías de etiquetas y backups exclusivamente en el dispositivo.
- Permitir revisar días anteriores y preparar comidas futuras.

### Resultado esperado

Al finalizar un día, la pantalla principal debe mostrar el total consumido, el objetivo manual vigente y la diferencia para calorías y cada macronutriente. No calificará el día como saludable o no saludable y no emitirá diagnósticos.

## 3. Principios funcionales

1. Los objetivos manuales siempre prevalecen sobre cualquier orientación.
2. Una estimación se mostrará como estimación, con fórmula, entradas utilizadas y fecha de cálculo.
3. Los datos declarados en una etiqueta prevalecen sobre cálculos derivados de macros.
4. Los registros históricos no cambiarán al editar posteriormente un alimento o un objetivo.
5. Ninguna fotografía se enviará a internet.
6. Las funciones automáticas nunca guardarán resultados sin revisión del usuario.
7. Todo dato funcional pertenecerá a un `datasetId`, respetando la restauración segura ya validada.

## 4. Alcance garantizado del MVP 1

### 4.1 Perfil

Datos del perfil:

| Campo | Obligatorio | Formato | Comportamiento |
|---|---:|---|---|
| Nombre o alias | Sí | Texto, 1–60 caracteres | Solo local |
| Edad | Sí | Años completos, entero | Editable manualmente; no se guardará fecha de nacimiento |
| Sexo de referencia para la fórmula | Sí para calcular | Masculino o femenino | Se explicará que es un parámetro de Mifflin–St Jeor, no un campo de identidad |
| Altura actual | Sí | cm | Editable; el MVP 1 conserva el valor actual y fecha de actualización |
| Peso actual | Sí | kg | Editable; el historial y sus gráficas se reservan para el MVP 2 |
| Días de gimnasio | Sí | 0–7 por semana | Descripción de actividad; no calcula por sí solo el gasto |
| Pasos diarios habituales | Sí | pasos/día | Media aproximada introducida manualmente |
| Otros deportes | Sí | 0–14 sesiones por semana | Con nombre o descripción opcional |
| Nivel PAL | Sí para calcular | 1,4; 1,6; 1,8 o 2,0 | Seleccionado conscientemente por el usuario |
| Objetivo diario de calorías | Sí | kcal/día | Manual, editable y efectivo desde una fecha |
| Objetivo diario de proteínas | Sí | g/día | Manual, editable y efectivo desde una fecha |
| Objetivo diario de carbohidratos | Sí | g/día | Manual, editable y efectivo desde una fecha |
| Objetivo diario de grasas | Sí | g/día | Manual, editable y efectivo desde una fecha |
| Objetivo diario de agua | Opcional | ml/día | Manual; no se impondrá un valor automático |

Los cambios de objetivos crearán un nuevo periodo de vigencia. Los días anteriores conservarán los objetivos que tenían entonces. La altura y el peso actuales podrán modificarse, pero su historial visual se implementará en el MVP 2.

### 4.2 Orientación energética

La aplicación calculará una estimación de gasto energético en reposo mediante Mifflin–St Jeor y una estimación de mantenimiento mediante un nivel de actividad PAL elegido por el usuario.

Mostrará:

- energía estimada en reposo;
- mantenimiento estimado;
- ejemplos matemáticos de déficit y superávit;
- referencias de macronutrientes;
- diferencia entre la orientación y los objetivos manuales.

La orientación nunca reemplazará objetivos automáticamente. Copiar una cifra orientativa a los objetivos requerirá una acción explícita y una confirmación.

### 4.3 Catálogo local de alimentos

Cada alimento podrá incluir:

- nombre;
- marca opcional;
- supermercado opcional;
- código de barras opcional;
- tipo de referencia: por 100 g o por 100 ml;
- energía declarada en kcal y, opcionalmente, kJ;
- proteínas, carbohidratos y grasas en gramos;
- una o varias porciones personalizadas con nombre y cantidad;
- fotografía local de la etiqueta;
- origen del dato: manual, etiqueta fotografiada, código escrito o código escaneado;
- notas opcionales;
- favorito sí/no;
- fechas de creación, modificación y último uso.

Funciones garantizadas:

- alta, edición, archivado y consulta;
- introducción manual de datos;
- captura o selección de una fotografía de etiqueta;
- conservación local de la fotografía y miniatura;
- escritura manual del código de barras;
- lectura local de EAN-13 y EAN-8 con la cámara, condicionada a superar la prueba técnica en el iPhone y manteniendo siempre la entrada manual;
- búsqueda por nombre, marca, supermercado o código;
- lista de recientes y favoritos;
- prevención o aviso de posibles duplicados por código de barras.

### 4.4 Registro diario

Tipos de comida:

- desayuno;
- comida;
- cena;
- tentempié, permitiendo varios al día.

Cada elemento registrado guardará:

- alimento o receta de origen;
- cantidad y unidad;
- valores nutricionales calculados;
- copia de los valores usados en ese momento;
- fecha y hora;
- estado `planificado` o `consumido`;
- nota opcional.

Funciones:

- añadir, editar, mover y eliminar elementos;
- registrar gramos, mililitros, porciones o número de unidades;
- convertir una comida planificada en consumida;
- copiar una comida anterior a otra fecha y franja;
- consultar comidas recientes;
- mostrar subtotales por comida y total diario;
- mostrar consumido, objetivo y diferencia de calorías y macros;
- permitir cambios retroactivos sin alterar otros días.

### 4.5 Recetas y comidas compuestas

- Crear una receta a partir de alimentos del catálogo.
- Definir cantidad de cada ingrediente.
- Calcular totales de la receta.
- Definir número de porciones o peso final opcional.
- Registrar una porción o cantidad de la receta en una comida.
- Marcar recetas como favoritas.
- Editar una receta sin reescribir registros históricos ya consumidos.

No habrá generación automática de recetas ni recomendaciones basadas en IA en este MVP.

### 4.6 Agua

- Registrar vasos o cantidades personalizadas en ml.
- Añadir, editar o eliminar entradas.
- Mostrar total diario y diferencia frente al objetivo manual, si existe.
- Mantener accesos rápidos configurables, por ejemplo 250 ml y 500 ml.

### 4.7 Entrenamiento mínimo

El MVP 1 incluirá exclusivamente, por día:

- `He entrenado hoy`: sí/no;
- tipo de entrenamiento opcional;
- nota breve opcional;
- fecha y hora de modificación.

Estos registros se diseñarán para migrar al calendario del MVP 2. El MVP 2 añadirá el objetivo de cuatro días por semana, calendario, contenido de cada sesión, ejercicios, anotaciones y cumplimiento semanal. Nada de ese detalle formará parte del MVP 1.

### 4.8 Planificación futura

- Navegar a una fecha futura.
- Añadir comidas o recetas con estado `planificado`.
- Copiar días o comidas anteriores.
- Ver totales previstos separados de los consumidos.
- Al llegar el día, marcar elementos individualmente o por comida como consumidos.
- No reservar, comprar ni descontar inventario; esas funciones corresponden al MVP 3.

## 5. Funciones experimentales

Estas funciones no condicionan la aceptación del MVP 1 y siempre tendrán formulario manual:

1. OCR local de etiquetas nutricionales.
2. Propuesta automática de campos detectados en una fotografía.
3. Consulta opcional de Open Food Facts enviando únicamente el código de barras.
4. Sugerencia automática del nivel PAL a partir de pasos y sesiones.
5. Reconocimiento de formatos de códigos distintos de EAN-13 y EAN-8.

Ninguna función experimental se activará ni desarrollará sin una aprobación independiente. El OCR nunca subirá fotografías. Open Food Facts, si se autoriza en otra fase, mostrará la solicitud y requerirá confirmación antes de guardar datos.

## 6. Funciones expresamente excluidas

- Cuentas de usuario, autenticación propia o backend.
- Sincronización entre dispositivos o copias automáticas en la nube.
- Analítica, telemetría o publicidad.
- Datos de alergias, intolerancias, patologías, embarazo o trastornos alimentarios.
- Diagnósticos, tratamiento, objetivos clínicos o consejo médico.
- Micronutrientes, suplementos y límites terapéuticos.
- Fotografías de progreso, historial gráfico de peso y medidas; se reservan al MVP 2.
- Planificación semanal detallada de entrenamientos, ejercicios, series e hitos; se reserva al MVP 2.
- Inventario y lista de compra; se reservan al MVP 3.
- OCR garantizado, recomendaciones remotas o IA generativa.
- Recetas sugeridas automáticamente.
- Integración con Salud de Apple, básculas, relojes o sensores.
- Compartir públicamente perfiles, fotos, registros o resultados.
- Uso por menores, múltiples personas o profesionales con pacientes.

## 7. Flujo completo

### 7.1 Primera apertura después de actualizar desde 0.1.1

1. Verificar que existe un backup reciente de 0.1.1.
2. Preparar el nuevo almacenamiento sin borrar la base anterior.
3. Validar la migración o copia de datos.
4. Mostrar la explicación de privacidad y alcance.
5. Pedir confirmación para crear el perfil local.

### 7.2 Creación del perfil

1. Introducir alias, edad, sexo de fórmula, altura y peso.
2. Introducir días de gimnasio, pasos y otros deportes.
3. Elegir manualmente un nivel PAL con explicaciones sencillas.
4. Ver la estimación de reposo y mantenimiento.
5. Ver referencias de macros y ejemplos de déficit/superávit.
6. Introducir objetivos propios de calorías, proteínas, carbohidratos y grasas.
7. Introducir, opcionalmente, objetivo de agua.
8. Revisar un resumen y guardar.

### 7.3 Creación de alimentos

1. Abrir `Añadir alimento`.
2. Elegir entrada manual, fotografía o código de barras.
3. Si se usa fotografía, capturar la etiqueta y guardarla localmente.
4. Si se usa código, escanearlo o escribirlo.
5. Introducir nombre, marca, supermercado y referencia por 100 g/100 ml.
6. Introducir kcal, proteínas, carbohidratos y grasas.
7. Añadir porciones opcionales.
8. Revisar y guardar.

### 7.4 Registro diario

1. Abrir `Hoy`.
2. Elegir desayuno, comida, cena o tentempié.
3. Buscar alimento, favorito, reciente o receta.
4. Introducir cantidad.
5. Revisar el cálculo antes de guardar.
6. Repetir para el resto del día.
7. Registrar agua.
8. Marcar si se ha entrenado y añadir tipo/nota opcionales.
9. Revisar totales, objetivos y diferencias.

### 7.5 Planificación

1. Elegir una fecha futura.
2. Copiar una comida anterior o añadir alimentos/recetas.
3. Guardar como planificado.
4. Consultar totales previstos.
5. En el día correspondiente, confirmar lo realmente consumido y corregir cantidades.

## 8. Cálculos, unidades y precisión

### 8.1 Cantidad consumida

Para un nutriente declarado por 100 g o 100 ml:

`nutriente consumido = nutriente por 100 × cantidad consumida / 100`

Para una porción:

`cantidad consumida = número de porciones × tamaño de porción`

No se convertirán gramos en mililitros ni viceversa sin una densidad introducida explícitamente. En el MVP 1 no se solicitará densidad; cada alimento conservará su unidad base.

### 8.2 Recetas

`total receta = suma de los valores de todos los ingredientes`

`valor por porción = total receta / número de porciones`

Los cálculos mantendrán precisión interna y solo redondearán al presentar resultados.

### 8.3 Energía de alimentos

- Si la etiqueta declara kcal, se utilizará ese valor para el total energético.
- Los macros se sumarán de forma independiente.
- Si no existe energía declarada, podrá mostrarse una estimación mediante 4 kcal/g para carbohidratos, 4 kcal/g para proteínas y 9 kcal/g para grasas.
- La energía estimada se marcará como `Calculada`; la procedente de etiqueta, como `Declarada`.
- La aplicación explicará que pueden existir diferencias por redondeo, fibra, polialcoholes, alcohol u otros componentes no incluidos en el MVP.

Los factores 4/4/9 y las unidades de etiquetado se basan en los anexos XIV y XV del Reglamento (UE) 1169/2011.

### 8.4 Estimación de reposo

Ecuación de Mifflin–St Jeor para peso `W` en kg, altura `H` en cm y edad `A` en años:

- Referencia masculina: `RMR = 10W + 6,25H − 5A + 5`.
- Referencia femenina: `RMR = 10W + 6,25H − 5A − 161`.

La pantalla utilizará el término `gasto energético en reposo estimado`, no `metabolismo exacto`.

### 8.5 Mantenimiento

`mantenimiento estimado = RMR × PAL`

Niveles disponibles: 1,4; 1,6; 1,8 y 2,0. Los días de gimnasio, pasos y deportes servirán de contexto, pero no elegirán automáticamente el PAL en el alcance garantizado.

### 8.6 Ejemplos de déficit y superávit

Escenarios aprobados para mostrar como ejemplos:

- déficit ilustrativo del 5 % y 10 %;
- superávit ilustrativo del 5 % y 10 %.

`escenario = mantenimiento estimado × (1 ± porcentaje)`

Serán ejemplos matemáticos, no objetivos recomendados. Ninguno quedará seleccionado por defecto ni se copiará sin confirmación.

### 8.7 Referencias de macros

La orientación mostrará, sin convertirlas automáticamente en objetivos:

- carbohidratos: 45–60 % de la energía;
- grasas: 20–35 % de la energía;
- proteína de referencia para adultos: 0,83 g/kg/día.

La aplicación no recomendará objetivos específicos de culturismo o rendimiento deportivo en el MVP 1. Mostrará también las calorías implícitas en los objetivos manuales de macros mediante 4/4/9 y la diferencia frente al objetivo manual de kcal.

### 8.8 Agua

El registro mide bebidas introducidas por el usuario. La referencia EFSA de 2,0 L/día para mujeres y 2,5 L/día para hombres se refiere a agua total procedente de bebidas y alimentos; por ello se mostrará solo como información contextual y no como un objetivo automático de agua bebida.

### 8.9 Unidades y redondeo

- Energía: kcal como unidad principal; kJ opcional.
- Peso corporal: kg, mostrado con una cifra decimal.
- Altura: cm.
- Alimentos: g o ml, con una cifra decimal cuando sea necesaria.
- Macronutrientes: g, mostrados con una cifra decimal.
- Agua: ml y conversión visual a litros.
- Pasos: entero por día.
- Fechas y cambio de día: zona horaria `Europe/Madrid`.
- No se redondearán cálculos intermedios; solo la presentación.

## 9. Información orientativa frente a consejo médico

La interfaz distinguirá:

- `Objetivo manual`: decidido por el usuario.
- `Estimación`: resultado de una fórmula, no una medición.
- `Referencia general`: valor poblacional de EFSA o etiquetado europeo.
- `Dato declarado`: copiado de una etiqueta.
- `Dato calculado`: derivado matemáticamente.

Texto permanente en la orientación:

> Estas cifras son estimaciones generales para registrar hábitos. No son una medición, diagnóstico ni recomendación médica. Tus objetivos manuales no son validados por NutrIAsta.

## 10. Alergias, patologías, embarazo y trastornos alimentarios

Por decisión del propietario:

- no se solicitarán;
- no se almacenarán;
- no se inferirán;
- no se utilizarán indicadores opcionales;
- no se emitirán alertas de alérgenos ni compatibilidad clínica.

La consecuencia se explicará claramente: NutrIAsta no puede advertir sobre ingredientes, contaminación cruzada, interacciones ni adecuación de un objetivo. Si la situación personal cambia, las orientaciones automáticas deben ignorarse y los objetivos manuales deben proceder de un profesional cualificado.

## 11. Modelo de datos local propuesto

Todas las entidades, salvo metadatos globales mínimos, incluirán `datasetId`.

| Entidad | Contenido principal |
|---|---|
| `metadata` | Dataset activo, última copia, versión de esquema y migración |
| `datasets` | Catálogo de datasets activos, staging y rollback |
| `profiles` | Perfil actual y parámetros de fórmula |
| `nutritionTargetPeriods` | Objetivos manuales con fecha de inicio |
| `foods` | Catálogo, macros por 100, origen, supermercado, código y favorito |
| `foodPortions` | Porciones personalizadas de cada alimento |
| `foodPhotos` | Blob local, miniatura, MIME, dimensiones y checksum |
| `recipes` | Nombre, porciones, peso final y favorito |
| `recipeItems` | Ingredientes y cantidades |
| `diaryDays` | Fecha local, snapshot de objetivos y estado diario |
| `mealEntries` | Franja, estado planificado/consumido, hora y nota |
| `mealItems` | Cantidad y snapshot nutricional inmutable |
| `waterEntries` | Cantidad en ml y hora |
| `trainingDayFlags` | Entrenó sí/no, tipo y nota |
| `legacyViabilityRecords` | Datos ficticios conservados desde 0.1.1 |
| `legacyViabilityPhotos` | Fotografía ficticia conservada desde 0.1.1 |

### Reglas de integridad

- Editar un alimento no cambia días históricos.
- Editar una receta no cambia registros históricos.
- Cada día conserva los objetivos aplicables a esa fecha.
- Borrar un alimento usado lo archiva; no rompe referencias históricas.
- No se mezclan datasets.
- Todas las fotografías incluyen checksum.
- Las eliminaciones materiales requieren confirmación.

## 12. Estimación de almacenamiento

Estimación para un año de uso:

- Perfil, objetivos y configuración: menos de 100 KB.
- 1.000 alimentos estructurados: aproximadamente 1–3 MB.
- 7.000–10.000 elementos de diario: aproximadamente 5–15 MB.
- 200 recetas: menos de 1 MB más sus referencias.
- Agua y marcas de entrenamiento: menos de 1 MB.
- Fotografías de etiquetas: principal consumo de espacio.

Tratamiento aprobado para fotografías:

- recodificación local a JPEG;
- dimensión máxima de 2.048 px;
- objetivo habitual de 0,5–1,5 MB por fotografía;
- límite duro de 4 MB después del procesamiento;
- miniatura separada.

Con 100 fotografías se estiman 50–150 MB; con 500, 250–750 MB. Antes de importar o restaurar se comprobará espacio para conservar simultáneamente el dataset activo y el candidato. La interfaz mantendrá uso, cuota, persistencia y antigüedad del backup visibles.

## 13. Backups 0.1.1 y migraciones

### Compatibilidad

- El MVP 1 deberá importar backups de formato 1 generados por 0.1.1.
- Aceptará tanto el archivo original `.nutriasta` como una copia renombrada `.zip`.
- El backup del MVP 1 usará una nueva versión de formato porque incorpora perfil, alimentos, comidas, recetas, agua y entrenamiento.
- Una aplicación 0.1.1 no podrá abrir un backup del MVP 1; el manifiesto lo rechazará como versión futura.
- El contenido seguirá cifrado con AES-256, límites de tamaño, checksums y restauración por dataset temporal.

### Nombre del archivo

Para evitar el fallo confirmado del selector de iOS, se exportará como `nutriasta-AAAA-MM-DD.nutriasta.zip`. El contenido seguirá siendo el backup cifrado de NutrIAsta; el sufijo `.zip` permite seleccionarlo en Archivos.

### Migración desde 0.1.1

- No borrar ni transformar destructivamente la base aprobada.
- Crear una base IndexedDB paralela para el MVP 1 sin cambiar la versión ni el esquema de la base 0.1.1.
- Conservar el registro y fotografía ficticios como datos legado, separados de los datos reales.
- Ejecutar cualquier preparación larga fuera de una transacción.
- Validar recuentos y checksums antes de marcar la migración como completa.
- Mantener una copia 0.1.1 reciente antes de actualizar.
- No eliminar el conjunto anterior durante la primera versión del MVP.

La base paralela conservará una vía de recuperación física hasta aprobar el MVP 1. La base 0.1.1 no se actualizará, migrará ni eliminará durante esta transición.

## 14. Privacidad, consentimiento y eliminación

### Privacidad

- Datos, fotografías y backups permanecen en el iPhone.
- Sin backend, telemetría, analítica ni anuncios.
- Cámara y Fotos solo se solicitan al pulsar la acción correspondiente.
- La pantalla inicial explica el almacenamiento local y el riesgo de eliminación por iOS.
- No se introducen datos reales en pruebas automatizadas o despliegues de validación.

### Consentimiento

Antes de crear el perfil se confirmará que:

- la aplicación es personal y orientativa;
- Safari puede eliminar almacenamiento;
- el usuario es responsable de mantener backups;
- las fotografías no se suben;
- no existe recuperación remota de contraseña o datos.

### Eliminación

- Un registro individual podrá eliminarse con confirmación.
- Un alimento utilizado históricamente se archivará por defecto.
- Una fotografía podrá eliminarse sin borrar el alimento.
- `Eliminar todos mis datos` exigirá confirmación reforzada, mostrará la fecha del último backup y no se ejecutará si el usuario cancela.
- La aplicación nunca eliminará automáticamente datasets de rollback sin confirmación y backup reciente.

## 15. Comportamiento offline

Todas las funciones garantizadas deberán funcionar sin conexión:

- perfil y objetivos;
- orientación ya calculada y nuevos cálculos locales;
- catálogo y búsqueda;
- fotografía y procesamiento local;
- escaneo local de códigos;
- comidas, recetas, agua y entrenamiento;
- planificación;
- backup y restauración desde Archivos;
- cierre, reapertura y reinicio.

La autenticación privada de Sites seguirá requiriendo una sesión previa válida para la primera carga. Una PWA ya instalada y cacheada deberá continuar abriendo offline, sujeto a que iOS no haya eliminado su almacenamiento.

## 16. Pantallas necesarias

1. **Bienvenida y privacidad** — Explica alcance, almacenamiento local, backups y carácter orientativo.
2. **Crear/editar perfil** — Datos personales mínimos y actividad.
3. **Orientación y objetivos** — Fórmula, mantenimiento, escenarios y objetivos manuales.
4. **Hoy** — Resumen de calorías, macros, agua, comidas y entrenamiento.
5. **Selector de fecha** — Días anteriores y planificación futura.
6. **Detalle de comida** — Elementos de desayuno, comida, cena o tentempié y subtotales.
7. **Añadir alimento o receta** — Favoritos, recientes, búsqueda y cantidad.
8. **Catálogo de alimentos** — Buscar, filtrar, editar, archivar y añadir.
9. **Editor de alimento** — Etiqueta, código, supermercado, valores por 100 y porciones.
10. **Cámara/código** — Captura de etiqueta o lectura de EAN con alternativa manual.
11. **Recetas** — Lista, editor de ingredientes, porciones y totales.
12. **Copiar comida** — Origen, destino, estado y confirmación.
13. **Agua** — Accesos rápidos, historial diario y objetivo manual.
14. **Entrenamiento diario** — Marca sí/no, tipo y nota breve.
15. **Almacenamiento y backup** — Persistencia, cuota, última copia, exportación, restauración y rollback.
16. **Ajustes y eliminación** — Unidades, privacidad, datos legado y eliminación total.

## 17. Criterios objetivos de aceptación

### Perfil y orientación

- Crear y editar el perfil completamente offline.
- Calcular Mifflin–St Jeor con casos de prueba conocidos.
- Aplicar correctamente cada PAL.
- Mostrar fórmula, entradas y etiqueta `Estimación`.
- No sustituir objetivos manuales sin confirmación.
- Mantener días anteriores asociados a sus objetivos originales.

### Alimentos y cálculos

- Crear alimentos por 100 g y 100 ml.
- Calcular exactamente cantidades y porciones sin redondeos intermedios.
- Distinguir energía declarada y calculada.
- Fotografiar una etiqueta ficticia y conservarla tras cierre y reinicio.
- Leer EAN-13 y EAN-8 en el iPhone o detener esta función antes de aceptar el MVP; la escritura manual siempre debe funcionar.
- No transmitir fotografías ni realizar solicitudes no autorizadas.

### Diario

- Registrar las cuatro franjas y varios tentempiés.
- Mostrar subtotales y total diario correctos.
- Copiar una comida sin alterar el origen.
- Editar un alimento sin cambiar el pasado.
- Crear y registrar recetas con totales verificables.
- Planificar una fecha futura y convertirla en consumida.
- Registrar agua y entrenamiento offline.

### Backup y migración

- Actualizar desde la PWA 0.1.1 aprobada sin perder su registro ni fotografía.
- Importar un backup 0.1.1 con extensión original o `.zip`.
- Exportar el nuevo backup con un nombre seleccionable en iOS.
- Rechazar contraseña incorrecta, archivo corrupto, versión futura y tamaños falsos sin cambiar el dataset activo.
- Cancelar, activar, hacer rollback, reactivar y confirmar con resultados exactos.
- Conservar el dataset anterior hasta confirmación y backup reciente.

### Persistencia física

En el iPhone real:

1. Crear perfil, diez alimentos, una receta y un día completo ficticio.
2. Cerrar y reabrir.
3. Reiniciar el iPhone.
4. Repetir en modo avión.
5. Cambiar objetivos y comprobar que el día anterior no cambia.
6. Editar un alimento y comprobar que el consumo histórico no cambia.
7. Exportar, modificar datos, restaurar, cancelar, activar y hacer rollback.
8. Verificar que fotografías y códigos permanecen.
9. Comprobar uso y cuota.
10. Confirmar ausencia de tráfico inesperado.

## 18. Riesgos y condiciones de parada

- **Migración:** si el cambio de esquema pone en riesgo la reapertura de 0.1.1, detenerse y usar una base paralela.
- **Persistencia:** si desaparecen datos en cierres o reinicios normales, no continuar.
- **Fotografías:** si el procesamiento agota memoria o produce archivos excesivos, revisar límites antes de ampliar el catálogo.
- **Código de barras:** si la lectura local no es fiable en el iPhone, mantener solo entrada manual y no declarar completada la función.
- **Backup:** si no se puede conservar activo y candidato a la vez, cancelar; nunca restaurar destructivamente.
- **Precisión:** etiquetas redondeadas pueden no cuadrar con 4/4/9; mostrar la diferencia, no corregir silenciosamente.
- **Actividad:** pasos y sesiones no tienen una conversión oficial única a PAL; no automatizarla en el alcance garantizado.
- **Orientación:** Mifflin–St Jeor y PAL son estimaciones, no mediciones individuales.
- **Safari:** `persisted() === true` reduce riesgo, pero no garantiza conservación permanente.
- **Sites:** una sesión caducada puede retrasar la comprobación de actualizaciones hasta reautenticar.
- **Privacidad:** cualquier subida de foto, telemetría o dato personal detiene la prueba.
- **Alcance:** no adelantar calendario detallado de entrenamiento, progreso o inventario.

## 19. Decisiones aprobadas

El 22 de julio de 2026 se aprobaron expresamente las cinco propuestas siguientes:

1. Los ejemplos orientativos de déficit y superávit serán del 5 % y 10 %.
2. Los backups futuros se exportarán con el sufijo `.nutriasta.zip` para facilitar su selección en Archivos de iOS.
3. Las fotografías procesadas tendrán una dimensión máxima de 2.048 px y un límite duro de 4 MB.
4. La migración se preparará mediante una base IndexedDB paralela, conservando intacta la base 0.1.1 hasta superar las pruebas físicas y confirmar la transición.
5. La lectura local de EAN-13 y EAN-8 se elegirá y justificará después de una prueba técnica; la entrada manual del código de barras seguirá estando siempre disponible.

## 20. Fases propuestas de implementación

### Fase 0 — Seguridad de migración

- Backup 0.1.1 obligatorio.
- Prototipo de nueva base o migración.
- Importación del formato 1.
- Prueba de rollback antes de desarrollar pantallas reales.

### Fase 1 — Perfil, actividad y objetivos

- Perfil local.
- Objetivos con vigencia.
- Mifflin–St Jeor, PAL y referencias.
- Pantalla `Hoy` vacía.

### Fase 2 — Catálogo

- Alimentos, porciones, favoritos y recientes.
- Fotografía local.
- Supermercado y código manual.
- Prueba y posterior integración del lector EAN local.

### Fase 3 — Diario

- Comidas, cantidades, snapshots y resumen.
- Agua.
- Marca diaria de entrenamiento.
- Días anteriores.

### Fase 4 — Recetas y planificación

- Recetas compuestas.
- Copiar comidas.
- Fechas futuras y estados planificado/consumido.

### Fase 5 — Backup y endurecimiento

- Formato de backup del MVP 1.
- Importación 0.1.1.
- Restauración atómica y rollback.
- Límites, rendimiento, privacidad y pruebas físicas completas.

### Fase experimental posterior

- OCR local.
- Open Food Facts opcional.
- Sugerencia automática de PAL.

Cada fase requerirá pruebas locales antes de pasar a la siguiente. No habrá despliegue hasta una autorización expresa independiente.

## 21. Fuentes

- Mifflin MD et al., ecuación original de gasto energético en reposo: https://pubmed.ncbi.nlm.nih.gov/2305711/
- EFSA, valores dietéticos de referencia y significado de sus rangos: https://www.efsa.europa.eu/en/topics/topic/dietary-reference-values
- EFSA, carbohidratos, grasas, fibra y agua: https://www.efsa.europa.eu/en/press/news/nda100326
- EFSA, proteína para adultos: https://www.efsa.europa.eu/en/press/news/120209
- EFSA, tablas resumidas de energía por niveles PAL: https://www.efsa.europa.eu/sites/default/files/assets/DRV_Summary_tables_jan_17.pdf
- Reglamento (UE) 1169/2011, etiquetado, unidades y factores energéticos: https://eur-lex.europa.eu/eli/reg/2011/1169/oj/?uri=CELEX%3A32011R1169
- AESAN, base española BEDCA: https://www.aesan.gob.es/AECOSAN/web/seguridad_alimentaria/subdetalle/composicion.htm

## 22. Aprobación

La especificación funcional y las cinco decisiones del apartado 19 fueron aprobadas expresamente por el propietario el 22 de julio de 2026.

La implementación local fue autorizada posteriormente y se mantiene en la versión propuesta `0.2.0`. La validación física y cualquier despliegue requieren una autorización expresa independiente.
