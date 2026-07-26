# NutrIAsta — Especificación funcional del MVP 2

Estado: **aprobado como especificación funcional; implementación no autorizada**  
Fecha: 26 de julio de 2026  
Ámbito: entrenamiento, historial de peso, inventario doméstico y lista de la compra  
Versión propuesta: **`0.3.0` (no autorizada)**  
Implementación: **no autorizada**

## 1. Base inmutable

El MVP 2 partirá exclusivamente de la base aprobada físicamente:

- etiqueta local: `mvp-1-approved-0.2.1`;
- commit: `b0cb7620660677e3d166288811c58b0fa15a23cb`;
- versión desplegada y aprobada: `0.2.1`;
- base histórica `nutriasta`, versión 1, conservada sin escrituras;
- base principal `nutriasta-main` y todos sus datasets activos, de rollback o recuperación;
- backups aprobados de formatos 1 y 2.

No se podrá alterar silenciosamente ningún dato histórico. La aprobación de este
documento tampoco autorizará código, migraciones, dependencias, commits, cambios de
versión o despliegues. Cada fase técnica necesitará autorización expresa.

## 2. Definición del producto

El MVP 2 ampliará NutrIAsta con tres áreas locales y offline:

1. planificación y registro de entrenamientos;
2. historial manual de peso;
3. control de alimentos disponibles y lista de la compra.

La aplicación seguirá siendo personal, en español, para una persona adulta en
España, sin cuentas, backend, sincronización, analítica ni servicios de pago.

El objetivo no es entrenar ni diagnosticar al usuario, sino permitirle contestar:

- ¿Qué días pretendía entrenar y cuáles entrené realmente?
- ¿Qué grupos musculares trabajé?
- ¿Qué ejercicios, series, repeticiones y cargas quise anotar?
- ¿Estoy cumpliendo mi objetivo semanal elegido?
- ¿Cómo ha cambiado el peso que he registrado manualmente?
- ¿Qué alimentos tengo disponibles?
- ¿Qué se ha consumido y qué necesito comprar?
- ¿Puedo preparar una receta con las existencias actuales?

## 3. Decisiones funcionales aprobadas

Esta revisión registra expresamente:

1. El objetivo semanal será editable entre 1 y 7 días, con 4 como valor inicial,
   mediante periodos efectivos que siempre comienzan un lunes.
2. Se permitirán tipos de entrenamiento personalizados además de los tipos iniciales.
3. Anotar ejercicios, series, repeticiones y cargas será siempre opcional; no habrá
   un número mínimo de ejercicios o series.
4. El inventario se descontará automáticamente al confirmar un consumo vinculado.
   Antes de agotar un alimento se mostrará un aviso y se ofrecerá añadirlo a compra.
5. Una compra completada podrá deshacerse de forma segura.
6. El peso actual del perfil podrá copiarse al historial mediante una acción explícita.
7. Las fotografías corporales de progreso quedan retiradas completamente del MVP 2.
8. Los backups completos del MVP 2 utilizarán el formato 3 y se podrán importar los
   formatos 1, 2 y 3.
9. El icono esperado es la hoja verde con flecha clara sobre fondo azul, no una letra N.
10. No se incorporará ninguno de los extras planteados en la revisión anterior.
11. La unidad canónica de inventario será la unidad base del alimento: gramos o
    mililitros. Una unidad o envase solo se aceptará con equivalencia explícita.
12. Nutrición e inventario se modificarán de forma atómica para cualquier consumo.
13. `Eliminar todos mis datos` conservará la base histórica, el catálogo técnico,
    los datasets de rollback y recuperación, los backups externos y la PWA.

## 4. Alcance garantizado

### 4.1 Entrenamiento

- calendario mensual con navegación hacia meses anteriores y posteriores;
- vista y resumen de la semana seleccionada;
- objetivo semanal editable de 1 a 7 días, inicialmente 4, mediante periodos que
  comienzan un lunes;
- sesiones planificadas, realizadas, canceladas o en borrador;
- registro de una sesión realizada aunque no estuviera planificada;
- fecha, hora opcional, título, tipos, contenido y anotaciones;
- tipos iniciales y tipos personalizados;
- catálogo local de ejercicios creado por el usuario;
- ejercicios opcionales dentro de la sesión;
- series, repeticiones, carga y notas opcionales;
- copia de una sesión anterior a otra fecha;
- reutilización y edición sin modificar la sesión original;
- cumplimiento semanal e historial cronológico.

### 4.2 Progreso corporal

- historial manual de peso;
- copia explícita del peso actual del perfil como una entrada nueva;
- edición y eliminación individual;
- consulta cronológica sin interpretación médica.

Las fotografías corporales no formarán parte del MVP 2. Tampoco se crearán tablas,
límites, pantallas, permisos, procesado ni backup nuevos para ellas.

### 4.3 Inventario y compra

- inventario asociado al catálogo local de alimentos del MVP 1;
- cantidad disponible y unidad compatible;
- altas y ajustes manuales;
- movimientos de compra, consumo, ajuste y corrección;
- descuento automático al confirmar comidas o recetas vinculadas;
- modificación atómica de nutrición e inventario;
- aviso previo si el consumo agota la existencia;
- opción de añadir el alimento agotado a la lista de la compra;
- lista activa con entradas manuales o vinculadas a alimentos;
- completar la compra e incorporar sus cantidades al inventario;
- deshacer una compra mediante movimientos inversos seguros;
- alimentos disponibles al crear o consultar una receta;
- cálculo determinista de si una receta puede prepararse.

## 5. Exclusiones expresas

No se incluirán:

- IA generativa;
- análisis automático de imágenes;
- fotografías corporales de progreso;
- estimación de grasa corporal;
- consejos médicos, diagnósticos o interpretación clínica;
- Apple Health, relojes, sensores o podómetros;
- backend, cuentas o sincronización;
- compartir datos, redes sociales o entrenadores remotos;
- cambios en los cálculos nutricionales aprobados;
- OCR;
- Open Food Facts;
- sugerencia automática de PAL;
- escáner nuevo o dependencia nueva para códigos de barras;
- recomendaciones automáticas de entrenamiento;
- recomendaciones automáticas de cargas o progresión;
- funciones adicionales no descritas como garantizadas en este documento.

## 6. Experiencia visual e interacción

El MVP 2 debe mejorar la presentación sin sacrificar claridad, accesibilidad u
operación offline.

### 6.1 Navegación

La navegación principal propuesta será:

- `Hoy`;
- `Diario`;
- `Entrenar`;
- `Inventario`;
- `Perfil`.

La lista de la compra se abrirá desde `Inventario`. El historial de peso se abrirá
desde `Perfil`.

### 6.2 Inicio

La pantalla `Hoy` mostrará:

- progreso semanal de entrenamientos, por ejemplo `3 de 4`;
- próxima sesión planificada;
- acceso rápido para registrar un entrenamiento no planificado;
- resumen nutricional aprobado del día, sin cambiar sus cálculos;
- aviso de alimentos agotados añadidos a la compra;
- acceso a la lista de la compra.

### 6.3 Interacción visual

- calendario mensual limpio, legible y táctil;
- tarjetas diferenciadas para sesiones planificadas y completadas;
- indicador visual de cumplimiento semanal;
- confirmaciones claras para consumos, compras y eliminaciones;
- botones que se adapten al ancho del iPhone sin desbordarse;
- objetivos táctiles suficientemente grandes;
- texto además de color para comunicar estados;
- animaciones breves al completar una sesión o una compra;
- respeto a la preferencia de movimiento reducido;
- ausencia de gestos ocultos como única forma de ejecutar una acción.

No se seleccionará ninguna dependencia visual en esta especificación.

### 6.4 Icono instalado

La PWA debe usar los recursos existentes cuyo diseño es una hoja verde con una
flecha clara sobre fondo azul. No debe aparecer una N generada o un icono provisional.

La futura validación deberá comprobar:

- manifiesto y enlaces de iconos;
- tamaños de 192 y 512 píxeles;
- recurso `maskable`;
- icono mostrado tras una instalación limpia en el iPhone;
- comportamiento de la caché de iconos de iOS sin cambiar el diseño aprobado.

## 7. Calendario de entrenamiento

### 7.1 Vista mensual

- la semana comenzará en lunes;
- se mostrará el mes y el año;
- habrá controles `Mes anterior`, `Hoy` y `Mes siguiente`;
- se podrá avanzar o retroceder sin límite artificial;
- cada día mostrará su estado y los tipos de entrenamiento;
- al tocar un día se abrirán sus sesiones;
- se podrá planificar o registrar directamente desde ese día.

Estados visuales:

- sin sesión;
- planificada;
- completada;
- planificada y completada;
- cancelada;
- seleccionada o correspondiente a hoy.

Los estados usarán icono, texto o patrón además de color.

### 7.2 Vista semanal

Mostrará:

- intervalo de fechas;
- objetivo elegido;
- sesiones completadas;
- sesiones planificadas;
- sesiones canceladas;
- porcentaje de cumplimiento, limitado visualmente al 100 %;
- texto como `Objetivo cumplido` o `Faltan 2 entrenamientos`.

Entrenar más veces que el objetivo conservará el recuento real, por ejemplo `5 de 4`,
sin presentar más del 100 % como recomendación de salud.

### 7.3 Historial

- orden cronológico inverso;
- filtro por intervalo de fechas;
- filtro por uno o varios tipos;
- búsqueda local por título, ejercicio o nota;
- acceso al detalle original;
- resumen semanal derivado de las sesiones, no almacenado como una verdad duplicada.

## 8. Sesiones de entrenamiento

### 8.1 Estados

- `draft`: sesión empezada pero no planificada ni completada;
- `planned`: sesión futura o prevista;
- `completed`: sesión realizada;
- `cancelled`: sesión planificada que se decidió no realizar.

Una sesión no planificada podrá crearse directamente como completada.

### 8.2 Datos

- `datasetId`;
- identificador estable;
- estado;
- fecha local;
- hora de inicio opcional;
- duración opcional en minutos;
- título opcional;
- uno o varios tipos;
- nota general opcional;
- origen: manual, copiada o no planificada;
- identificador de la sesión origen, si fue copiada;
- fechas de creación y actualización.

### 8.3 Tipos iniciales

- pecho;
- hombro;
- bíceps;
- tríceps;
- espalda;
- core;
- pierna;
- culo;
- cardio.

Se podrán seleccionar varios tipos en una sesión. El usuario también podrá crear,
renombrar, archivar y reutilizar tipos personalizados. Archivar un tipo impedirá
seleccionarlo en sesiones nuevas, pero no alterará sesiones históricas.

Eliminar definitivamente un tipo que ya esté usado no estará permitido; se archivará.
Las sesiones conservarán además una instantánea del nombre mostrado para evitar que
un cambio posterior reescriba la historia.

## 9. Ejercicios, series y cargas

### 9.1 Registro completamente opcional

Una sesión podrá guardarse con:

- solo fecha y tipos;
- una nota general;
- ejercicios sin series;
- ejercicios con una o más series;
- cualquier combinación anterior.

No habrá un mínimo de ejercicios ni series. La interfaz no marcará una sesión como
incompleta por dejar estos campos vacíos.

### 9.2 Catálogo local de ejercicios

Cada ejercicio reutilizable tendrá:

- `datasetId`;
- nombre;
- tipo principal opcional;
- tipos secundarios opcionales;
- nota opcional;
- estado activo o archivado;
- fechas de creación y actualización.

El usuario podrá crear ejercicios al editar una sesión. No se descargará un catálogo
remoto ni se sugerirán ejercicios automáticamente.

### 9.3 Ejercicio dentro de una sesión

- referencia opcional al catálogo;
- instantánea del nombre;
- orden;
- nota opcional;
- cero o más series.

La instantánea impide que renombrar el catálogo cambie el historial.

### 9.4 Serie opcional

Cada serie que el usuario decida anotar podrá contener:

- número de orden;
- repeticiones opcionales;
- carga opcional en kilogramos;
- marca de realizada;
- nota opcional.

Reglas:

- una carga vacía significa que no se registró, no que sea cero;
- cero podrá usarse expresamente para peso corporal o ausencia de carga externa;
- se admitirán decimales positivos;
- no se admitirán repeticiones ni cargas negativas;
- una serie planificada podrá editarse con lo realmente realizado;
- no se generarán métricas o recomendaciones derivadas.

El progreso se podrá revisar consultando las anotaciones anteriores del mismo
ejercicio en orden cronológico, sin generar interpretaciones.

### 9.5 Copia

Al copiar una sesión:

- se elegirá una fecha nueva;
- se copiarán tipos, título, ejercicios, series previstas y notas;
- se generarán identificadores nuevos;
- la copia será editable;
- la sesión original permanecerá inmutable;
- las marcas de serie realizada se reiniciarán;
- la nueva sesión quedará `planned` salvo que el usuario elija registrarla como hecha.

## 10. Objetivo y resumen semanal

- valor editable entre 1 y 7;
- valor inicial de 4;
- cada objetivo pertenecerá a un periodo efectivo cuya fecha inicial será un lunes;
- al cambiarlo se elegirá entre `Aplicar esta semana` o `Aplicar la semana siguiente`;
- `Aplicar esta semana` usará el lunes de la semana local actual, aunque el cambio se
  realice después de ese lunes;
- `Aplicar la semana siguiente` usará el lunes inmediatamente posterior;
- antes de guardar se mostrará la fecha exacta de inicio;
- un nuevo periodo cerrará el anterior el domingo previo;
- las semanas anteriores a la fecha efectiva nunca se reinterpretarán;
- si ya existe un periodo para el lunes elegido, se sustituirá ese valor solo tras
  mostrar qué periodo se modifica;
- solo las sesiones `completed` contarán;
- una sesión contará una vez aunque tenga varios tipos;
- una sesión no planificada completada contará;
- borradores, planificadas y canceladas no contarán.

El resumen de cualquier semana resolverá el último periodo cuyo `effectiveFromMonday`
sea igual o anterior al lunes de esa semana. Cambiar el objetivo requerirá
confirmación y nunca modificará sesiones ni resúmenes de semanas anteriores.

## 11. Historial de peso

### 11.1 Entrada

- `datasetId`;
- identificador;
- fecha y hora local;
- peso en kilogramos;
- nota opcional;
- origen: manual o copia explícita del perfil;
- fechas de creación y actualización.

### 11.2 Comportamiento

- introducir peso manualmente;
- editar o eliminar una entrada;
- ordenar cronológicamente;
- permitir varias entradas el mismo día;
- mostrar la unidad kg;
- no sustituir silenciosamente valores antiguos;
- no cambiar automáticamente el peso del perfil al editar el historial;
- ofrecer `Añadir el peso actual del perfil al historial`;
- pedir fecha y confirmación antes de copiarlo.

No se calcularán tendencias clínicas, peso ideal, diagnósticos ni cambios automáticos
de objetivos nutricionales.

## 12. Inventario doméstico

### 12.1 Relación con alimentos

Cada existencia se vinculará a un alimento del catálogo del MVP 1 mediante `foodId`.
No se duplicarán calorías, macros ni fotografías de producto.

Una entrada manual de la compra que sea texto libre deberá vincularse a un alimento
existente o crear uno manualmente antes de incorporarse al inventario.

### 12.2 Unidad canónica

Cada alimento tendrá una única unidad canónica de inventario, determinada por su base
nutricional:

- gramos cuando la base del alimento sea `g`;
- mililitros cuando la base del alimento sea `ml`.

El saldo, los movimientos y las comparaciones de disponibilidad se guardarán siempre
en esa unidad canónica.

Las unidades, piezas o envases solo podrán afectar al inventario cuando exista una
equivalencia explícita guardada para ese alimento. Podrá reutilizarse una porción ya
guardada, por ejemplo `1 envase = 125 g`. Antes de aplicar el movimiento se mostrará
la cantidad convertida a la unidad canónica.

Reglas:

- la equivalencia debe indicar una cantidad positiva y su unidad base;
- cambiar una equivalencia no reescribirá movimientos históricos;
- cada movimiento conservará la equivalencia utilizada y el resultado canónico;
- sin equivalencia, una cantidad expresada en unidades no modificará inventario;
- no habrá conversión automática entre gramos y mililitros;
- nunca se deducirán equivalencias a partir de calorías, densidad, nombre o fotografía;
- si receta e inventario no pueden expresarse en la misma unidad canónica, la
  aplicación lo indicará y no inventará una conversión.

### 12.3 Movimientos

El saldo se respaldará con movimientos:

- compra;
- consumo;
- ajuste positivo;
- ajuste negativo;
- corrección inversa.

Cada movimiento incluirá `datasetId`, alimento, cantidad canónica, unidad canónica,
fecha, motivo, operación, referencia de origen y, cuando proceda, identificador de
compra o elemento del diario. Si se utilizó una porción o envase, conservará también
la cantidad original, la equivalencia explícita aplicada y el resultado canónico.

No se editará un movimiento aplicado. Una corrección creará el movimiento inverso
correspondiente para conservar la trazabilidad.

### 12.4 Presentación

- disponible;
- agotado;
- cantidad y unidad;
- acceso a movimientos;
- acción manual de ajuste;
- acción para añadir a compra.

Los agotados podrán ocultarse de la vista principal, pero no se eliminarán
automáticamente ni se borrará el alimento del catálogo.

## 13. Descuento automático al consumir

El descuento se aplicará cuando el usuario confirme como consumida una comida o
receta cuyos elementos estén vinculados al inventario.

### 13.1 Preparación sin escrituras

Antes de modificar nutrición o inventario:

1. leer la versión actual del elemento del diario y de todos los saldos implicados;
2. convertir únicamente mediante equivalencias explícitas;
3. calcular cantidad solicitada, disponible, descontable y faltante por alimento;
4. reunir todos los avisos y decisiones necesarias;
5. mostrar un único resumen completo;
6. obtener la decisión del usuario;
7. volver a comprobar que las filas leídas no han cambiado.

Una comida planificada no descontará inventario hasta marcarse como consumida.

### 13.2 Confirmación atómica

Una vez resueltas todas las decisiones, una única transacción Dexie incluirá:

- creación o actualización del registro nutricional;
- cambio de estado del consumo;
- actualización de todos los saldos afectados;
- movimientos de inventario;
- decisiones de inventario por ingrediente;
- entradas de compra aceptadas;
- identificador idempotente de la operación.

La transacción aplicará todo o nada. Un error, cierre, conflicto o falta de cuota no
podrá dejar solo nutrición o solo inventario modificados.

### 13.3 Aviso de agotamiento

Si el saldo resultante es exactamente cero:

1. antes de iniciar la transacción se mostrará que el alimento se va a acabar;
2. se indicarán cantidad actual, cantidad solicitada y saldo final;
3. se ofrecerá:
   - `Consumir y añadir a la compra`;
   - `Consumir sin añadir`;
   - `Cancelar`;
4. al elegir la primera opción se creará o incrementará una entrada de compra;
5. al confirmar se aplicará el consumo automáticamente;
6. la existencia quedará a cero, no se eliminará el alimento.

Ejemplo: quedan 200 g de carne picada y la receta consume 200 g. NutrIAsta avisará
que se agotará y preguntará si debe añadirse a la compra.

### 13.4 Cantidad insuficiente

Si el consumo supera el saldo:

- se mostrará un aviso de cantidad insuficiente antes de modificar nada;
- no se permitirán saldos negativos;
- se ofrecerá añadir el alimento a la compra;
- el usuario deberá elegir entre descontar solo la cantidad disponible, no descontar
  inventario o cancelar y corregir la cantidad.

`Descontar solo lo disponible`:

- dejará el saldo del alimento en cero;
- conservará el registro nutricional completo con la cantidad realmente consumida;
- mostrará que existe una diferencia entre nutrición e inventario;
- nunca presentará el saldo de inventario como una medición exacta;
- podrá añadir el alimento a la compra si el usuario lo elige.

`No descontar inventario` conservará el registro nutricional completo y marcará
visiblemente que ese consumo no se reflejó en existencias.

`Cancelar y corregir` no modificará nutrición, inventario ni compra.

Por cada ingrediente se registrarán explícitamente:

- cantidad solicitada en unidad canónica;
- cantidad realmente descontada;
- cantidad faltante;
- decisión elegida;
- unidad y equivalencia aplicada, si existe;
- identificador común de operación;
- elemento del diario relacionado;
- alimento relacionado;
- movimiento resultante o ausencia justificada de movimiento.

### 13.5 Edición, eliminación y cambio de estado

Si un consumo ya descontó inventario:

- editar la cantidad calculará la diferencia respecto de la última operación aplicada;
- solo esa diferencia producirá movimientos nuevos y trazables;
- un aumento volverá a evaluar saldo, agotamiento e insuficiencia antes de escribir;
- una reducción creará el movimiento compensatorio correspondiente;
- eliminar el consumo creará movimientos inversos antes de retirar su fila funcional;
- devolverlo a `planned` creará movimientos inversos y conservará el registro
  planificado;
- volver a marcarlo como consumido generará una operación nueva;
- ninguna operación anterior se editará o borrará;
- nutrición, saldos, movimientos, decisiones y estado se actualizarán en una única
  transacción atómica.

Si la inversión no puede aplicarse con integridad, no se modificará ninguna parte y
se mostrará el conflicto para su corrección.

### 13.6 Idempotencia

Cada descuento quedará vinculado al elemento consumido. Volver a abrir, editar o
marcar otra vez la comida no podrá aplicar el mismo movimiento dos veces.

Cada intento tendrá un identificador de operación único y cada acción confirmada una
clave idempotente. Repetir una solicitud ya confirmada devolverá el resultado previo
sin duplicar nutrición, movimientos, saldos o entradas de compra.

## 14. Lista de la compra

### 14.1 Lista activa

- una lista activa;
- listas completadas conservadas como historial;
- entradas vinculadas a alimento o escritas manualmente;
- texto, cantidad, unidad y nota;
- estado pendiente o comprado;
- incorporación desde un aviso de agotamiento;
- suma de cantidades si el mismo alimento ya estaba pendiente;
- edición, marcado y eliminación individual.

### 14.2 Completar compra

Antes de completarla se revisarán:

- elementos marcados como comprados;
- alimentos vinculados;
- cantidades y unidades;
- entradas manuales todavía sin vincular.

Al confirmar:

1. se crearán movimientos de compra;
2. se incrementará el inventario;
3. se marcará la lista como completada;
4. la operación tendrá un identificador único;
5. reabrir o pulsar otra vez no duplicará cantidades.

Las entradas no compradas podrán mantenerse en la siguiente lista activa.

### 14.3 Deshacer compra

Se podrá deshacer una compra completada:

- mediante movimientos inversos, nunca borrando el historial;
- sin permitir saldos negativos;
- en una operación breve y atómica;
- devolviendo los elementos a una lista editable;
- conservando la referencia a la compra original.

Si ya se consumió parte de lo comprado y el movimiento inverso produciría un saldo
negativo, la aplicación bloqueará el deshacer completo y explicará qué alimentos
deben ajustarse manualmente. No alterará otros productos parcialmente.

## 15. Recetas e inventario

Al abrir o crear una receta se mostrarán primero los alimentos disponibles que tengan
saldo positivo.

Para cada receta se calculará localmente:

- ingredientes vinculados;
- cantidad necesaria para las porciones seleccionadas;
- cantidad disponible;
- cantidad que faltaría;
- unidad canónica y equivalencia utilizada;
- decisión necesaria para cada ingrediente;
- estado `Disponible`, `Falta cantidad` o `Unidad incompatible`.

El cálculo será determinista. No propondrá recetas, sustituciones ni equivalencias.

En una receta con varios ingredientes se calcularán y presentarán todas las
decisiones antes de escribir. El usuario resolverá en una sola revisión los
agotamientos, cantidades insuficientes, unidades incompatibles y altas en la compra.

La confirmación completa será atómica: o se actualizan el consumo nutricional, todos
los movimientos autorizados, los saldos, las decisiones y la compra, o no cambia
nada. No se aplicarán ingredientes parcialmente por un error técnico posterior a la
confirmación.

## 16. Código de barras y fotografías de productos

Se conservarán exactamente las capacidades aprobadas del MVP 1:

- EAN manual garantizado;
- fotografía local de etiqueta o producto;
- `BarcodeDetector` solo cuando el navegador lo ofrezca;
- formulario manual siempre disponible.

No se instalará un escáner, OCR ni servicio externo. Estas fotografías pertenecen a
alimentos del MVP 1 y no son fotografías corporales de progreso.

## 17. Pantallas

1. **Hoy**  
   Cumplimiento semanal, próxima sesión, accesos rápidos y resumen diario existente.

2. **Calendario de entrenamiento**  
   Mes navegable, estados diarios, tipos y selector de día.

3. **Día de entrenamiento**  
   Sesiones del día y acciones para planificar o registrar una no planificada.

4. **Editor de sesión**  
   Estado, fecha, tipos, título, ejercicios, series y notas opcionales.

5. **Historial de entrenamientos**  
   Búsqueda y filtros locales con acceso al detalle.

6. **Resumen semanal**  
   Objetivo editable y cumplimiento de la semana seleccionada.

7. **Historial de peso**  
   Lista de entradas, alta manual y copia explícita desde el perfil.

8. **Inventario**  
   Alimentos disponibles, cantidades, agotados y movimientos.

9. **Ajustar inventario**  
   Cantidad, unidad, motivo y confirmación.

10. **Lista de la compra**  
    Elementos pendientes, cantidades, vinculación y compra completada.

11. **Revisión de compra**  
    Confirmación antes de incorporar cantidades.

12. **Disponibilidad de receta**  
    Ingredientes disponibles, faltantes y unidades incompatibles.

13. **Aviso de consumo**  
    Resumen, alimentos que se agotarán y opción de añadirlos a compra.

14. **Ajustes y privacidad**  
    Backup formato 3, restauración, almacenamiento y eliminación.

## 18. Flujos principales

### 18.1 Planificar y completar

1. Abrir `Entrenar`.
2. Seleccionar un día.
3. Pulsar `Planificar`.
4. Elegir uno o varios tipos.
5. Añadir ejercicios, series o notas solo si se desea.
6. Guardar como planificada.
7. Abrir la sesión el día correspondiente.
8. Actualizar los valores realizados, si se anotan.
9. Marcar como completada.
10. Ver el calendario y resumen semanal actualizados.

### 18.2 Entrenamiento no planificado

1. Abrir el día o usar el acceso de `Hoy`.
2. Pulsar `Registrar entrenamiento realizado`.
3. Elegir tipos y datos opcionales.
4. Guardar como completado.
5. Comprobar que cuenta una sola vez en la semana.

### 18.3 Copiar sesión

1. Abrir una sesión anterior.
2. Pulsar `Copiar`.
3. Elegir fecha nueva.
4. Revisar y editar los datos.
5. Guardar como planificada o completada.
6. Verificar que la original no cambió.

### 18.4 Peso

1. Abrir `Perfil` y `Historial de peso`.
2. Añadir una entrada manual o copiar el peso actual.
3. Elegir la fecha y confirmar.
4. Editar o eliminar individualmente cuando sea necesario.

### 18.5 Compra e inventario

1. Añadir alimentos o texto libre a la compra.
2. Marcar lo realmente comprado.
3. Vincular entradas manuales.
4. Revisar cantidades y unidades.
5. Completar la compra.
6. Comprobar los movimientos y saldos.
7. Deshacerla si es necesario y seguro.

### 18.6 Consumo

1. Registrar una comida o receta.
2. Vincular sus alimentos al inventario.
3. Marcarla como consumida.
4. Calcular todos los ingredientes sin escribir.
5. Revisar cantidades solicitadas, disponibles y faltantes.
6. Resolver todos los avisos de agotamiento o insuficiencia.
7. Elegir, cuando proceda, si se añade el alimento a la compra.
8. Confirmar una sola operación.
9. Aplicar atómicamente nutrición, movimientos, saldos, decisiones y compra.
10. Comprobar el descuento automático y que no se duplica.

### 18.7 Editar o revertir un consumo

1. Abrir un consumo que ya afectó al inventario.
2. Editar su cantidad, eliminarlo o devolverlo a planificado.
3. Revisar la diferencia o los movimientos inversos calculados.
4. Resolver nuevos avisos si la cantidad aumenta.
5. Confirmar.
6. Aplicar todos los cambios en una única transacción.
7. Comprobar nutrición, saldo, trazabilidad y estado.
8. Si vuelve a consumirse, verificar que se crea una operación nueva.

### 18.8 Eliminar todos mis datos

1. Abrir `Ajustes y privacidad`.
2. Revisar la fecha del último backup.
3. Leer exactamente qué filas se eliminarán y qué elementos se conservarán.
4. Confirmar mediante la protección reforzada del MVP 1.
5. Eliminar atómicamente solo las filas funcionales del dataset activo.
6. Conservar `nutriasta`, catálogo técnico, `activeDatasetId`, rollback, recuperación,
   backups de Archivos y PWA.
7. Volver a abrir la aplicación con el mismo dataset técnico, ahora vacío.

## 19. Modelo de datos local propuesto

Todas las filas nuevas pertenecerán obligatoriamente a un `datasetId`.

| Tabla nueva | Finalidad | Índices mínimos |
|---|---|---|
| `trainingSettings` | Periodos de objetivo semanal desde un lunes | `[datasetId+id]`, `[datasetId+effectiveFromMonday]` |
| `trainingTypes` | Tipos iniciales y personalizados | `[datasetId+id]`, `[datasetId+normalizedName]` |
| `exerciseCatalog` | Ejercicios reutilizables | `[datasetId+id]`, `[datasetId+normalizedName]` |
| `trainingSessions` | Sesiones y estados | `[datasetId+id]`, `[datasetId+localDate]`, `[datasetId+status]` |
| `trainingSessionExercises` | Ejercicios ordenados e instantáneas | `[datasetId+id]`, `[datasetId+sessionId]` |
| `trainingSets` | Series opcionales | `[datasetId+id]`, `[datasetId+sessionExerciseId]` |
| `weightEntries` | Historial manual de peso | `[datasetId+id]`, `[datasetId+recordedAt]` |
| `inventoryItems` | Saldo y unidad canónica por alimento | `[datasetId+id]`, `[datasetId+foodId]` |
| `inventoryMovements` | Compras, consumos y correcciones trazables | `[datasetId+id]`, `[datasetId+foodId]`, `[datasetId+operationId]`, `[datasetId+sourceRef]` |
| `inventoryConsumptionDecisions` | Solicitado, descontado, faltante y decisión por ingrediente | `[datasetId+id]`, `[datasetId+operationId]`, `[datasetId+diaryItemId]`, `[datasetId+foodId]` |
| `shoppingLists` | Lista activa e historial | `[datasetId+id]`, `[datasetId+status]` |
| `shoppingListItems` | Elementos de cada lista | `[datasetId+id]`, `[datasetId+shoppingListId]` |

No se añadirá una tabla de fotografías corporales.

### 19.1 Integridad

- todo repositorio resolverá primero `activeDatasetId`;
- ninguna consulta mezclará datasets;
- toda relación se comprobará dentro del mismo dataset;
- los identificadores serán estables y locales;
- fechas del calendario se guardarán como fechas locales explícitas;
- `effectiveFromMonday` deberá ser siempre un lunes local normalizado;
- instantes de auditoría se guardarán en UTC;
- cantidades serán números finitos, no negativos y con unidad canónica explícita;
- una equivalencia aplicada quedará congelada en el movimiento histórico;
- movimientos y operaciones tendrán claves idempotentes;
- cada decisión de consumo enlazará operación, elemento del diario y alimento;
- una transacción de consumo abarcará las tablas nutricionales existentes y todas
  las tablas de inventario afectadas;
- sesiones, compras y movimientos históricos no se reescribirán silenciosamente;
- los resúmenes se derivarán de las filas originales.

## 20. Migración Dexie

### 20.1 Separación de bases

- `nutriasta` permanecerá exactamente en versión 1, sin aperturas de escritura,
  migraciones, actualizaciones o eliminaciones;
- `nutriasta-main` conservará todas las versiones y tablas aprobadas del MVP 1;
- el MVP 2 añadirá una versión 6 exclusivamente aditiva;
- la versión 6 añadirá las doce tablas del apartado 19;
- no eliminará ni renombrará tablas o índices anteriores;
- no transformará filas históricas durante `upgrade`;
- los tipos iniciales podrán crearse después de abrir la base mediante una operación
  idempotente dentro del dataset activo.

### 20.2 Verificación obligatoria

Antes y después de la migración se compararán:

- versión, tablas y contenido íntegro de `nutriasta`;
- recuentos y huellas de las tablas del MVP 1;
- `activeDatasetId`;
- catálogo de datasets y estados;
- datasets de rollback y recuperación;
- fotografías de producto ya existentes;
- posibilidad de leer, exportar y restaurar los datos del MVP 1.

### 20.3 Compatibilidad hacia atrás

Abrir `nutriasta-main` con versión 6 puede impedir que el código antiguo 0.2.1 abra
esa base por `VersionError`. No se hará downgrade.

Antes de actualizar físicamente será obligatorio:

1. conservar un backup formato 2 reciente;
2. verificar su contraseña;
3. documentar el dataset activo;
4. comprobar espacio disponible;
5. mantener intacta la base `nutriasta`;
6. disponer de una recuperación controlada desde backup.

## 21. Estrategia de backup

### 21.1 Formato 3 aprobado

El MVP 2 exportará backups completos en formato 3. Se justifica una versión nueva
porque:

- aparecen doce tablas;
- el inventario necesita movimientos e idempotencia;
- entrenamiento incorpora relaciones ordenadas;
- el contrato exacto del formato 2 debe permanecer inmutable;
- una versión explícita evita interpretar silenciosamente datos desconocidos.

No se modificará el significado de los formatos 1 o 2.

### 21.2 Compatibilidad

La futura versión deberá:

- importar formato 1 mediante el procedimiento histórico aprobado;
- importar formato 2 completo;
- importar formato 3 completo;
- exportar siempre formato 3;
- restaurar un formato 1 o 2 dejando vacías las tablas del MVP 2;
- indicar claramente qué contenido contiene el candidato;
- rechazar versiones futuras desconocidas.

No se promete que NutrIAsta 0.2.1 pueda restaurar formato 3.

### 21.3 Contenido

El formato 3 incluirá:

- manifiesto versionado;
- versión mínima compatible mediante comparación semántica;
- las catorce tablas completas del formato 2;
- las doce tablas nuevas;
- blobs y fotografías de productos ya existentes;
- recuentos;
- tamaños declarados;
- checksums;
- fecha de creación;
- cifrado y compresión locales.

No contendrá fotografías corporales.

### 21.4 Límites

Los límites exactos deberán medirse antes de implementar. La propuesta inicial es:

- archivo cifrado máximo: 256 MiB;
- contenido expandido máximo: 300 MiB;
- JSON estructurado máximo: 32 MiB;
- límites de fotografías de producto ya aprobados sin cambios;
- suma de tamaños declarados verificada frente a tamaños reales;
- rechazo temprano ante entradas duplicadas, rutas inesperadas o expansión excesiva.

Descifrado, descompresión, análisis, checksums y validaciones largas se harán fuera
de cualquier transacción de IndexedDB.

## 22. Restauración segura

La restauración seguirá el modelo ya aprobado:

1. seleccionar archivo y contraseña;
2. descifrar, descomprimir y validar fuera de transacciones;
3. comprobar formato, versión, tamaños, checksums y espacio;
4. crear un `candidateDatasetId` en estado `staging`;
5. escribir en lotes y transacciones cortas;
6. volver a leer y verificar el candidato;
7. mostrar una vista previa sin cambiar los datos activos;
8. permitir cancelar y eliminar solo el candidato;
9. activar con una transacción breve que cambia atómicamente `activeDatasetId`;
10. conservar el dataset anterior como `rollback`;
11. comprobar el nuevo dataset tras recargar;
12. ofrecer rollback;
13. permitir reactivar el candidato;
14. confirmar definitivamente;
15. conservar recuperación hasta que exista backup reciente y confirmación adicional.

Un formato 1 o 2 generará un candidato válido con tablas del MVP 2 vacías. Un error,
cierre o falta de cuota antes de activar dejará intacto el dataset actual.

## 23. Almacenamiento estimado

Estimaciones conservadoras, sin fotografías corporales:

| Contenido | Supuesto | Estimación |
|---|---|---:|
| Peso | una entrada semanal durante 10 años | menos de 0,2 MiB |
| Entrenamientos | 4 sesiones por semana, 6 ejercicios y 4 series, 10 años | 15–30 MiB |
| Inventario y compra | movimientos diarios durante 10 años | 10–25 MiB |
| Índices y metadatos nuevos | margen operativo | 5–15 MiB |
| Total nuevo estimado | uso intensivo durante 10 años | 30–70 MiB |

Las fotografías de alimentos existentes seguirán siendo el mayor elemento variable
del MVP 1. Antes de backup o restauración se mostrará:

- uso estimado;
- cuota estimada;
- tamaño calculado del candidato;
- espacio adicional necesario para activo y candidato simultáneos;
- advertencia si `persisted()` devuelve `false`.

La persistencia de Safari no se describirá como garantizada.

## 24. Privacidad y salud

- todos los datos permanecerán en el dispositivo salvo el archivo que el usuario
  exporte manualmente;
- no habrá solicitudes de aplicación a terceros;
- no habrá analítica ni telemetría;
- peso y entrenamientos se tratarán como información corporal privada;
- la pantalla correspondiente explicará que no hay interpretación médica;
- no se usarán alergias, patologías, embarazo o trastornos alimentarios;
- la aplicación no sustituye asesoramiento sanitario;
- no se usarán datos reales durante desarrollo o validación;
- un backup olvidado o una contraseña perdida no podrá recuperarse remotamente;
- otra persona con acceso desbloqueado al iPhone podría ver la PWA.

## 25. Eliminación

### 25.1 Individual

Se podrá eliminar o archivar según el caso:

- entrada de peso;
- sesión de entrenamiento;
- ejercicio de una sesión;
- serie;
- ejercicio o tipo personalizado sin uso, o archivarlo si tiene historial;
- entrada de compra;
- lista que no tenga movimientos aplicados;
- existencia mediante ajuste, conservando movimientos.

Una eliminación con relaciones mostrará sus consecuencias y exigirá confirmación.
No se borrarán movimientos aplicados para ocultar la trazabilidad.

### 25.2 Total

`Eliminar todos mis datos` deberá:

- requerir confirmación reforzada;
- recomendar y comprobar la fecha del último backup;
- eliminar únicamente las filas funcionales pertenecientes al dataset activo;
- conservar la base histórica `nutriasta` íntegra;
- conservar el catálogo técnico de datasets;
- conservar los datasets de rollback y recuperación;
- conservar sus filas y blobs;
- conservar los backups guardados manualmente en la aplicación Archivos;
- conservar la aplicación instalable;
- conservar la PWA y su configuración técnica;
- no tocar cachés o datos de otros orígenes;
- comprobar después que no quedan filas funcionales del dataset activo;
- conservar `activeDatasetId` y su entrada técnica para que la aplicación continúe
  operativa con un dataset funcionalmente vacío.

Cualquier ampliación de este borrado —incluidos `nutriasta`, catálogo técnico,
datasets de rollback o recuperación, backups de Archivos o la PWA— requerirá una
autorización independiente y explícita.

## 26. Funcionamiento offline y actualización

Todas las funciones garantizadas deberán funcionar offline:

- calendario, sesiones y peso;
- inventario y compra;
- recetas y descuentos;
- backup y restauración local, sujeto al selector de archivos de iOS.

La actualización continuará siendo controlada:

- sin `skipWaiting` automático;
- aviso de versión disponible;
- activación solo tras pulsar el botón;
- espera de escrituras, procesamiento de fotografías de producto, backup,
  restauración y movimientos pendientes;
- IndexedDB fuera del precaché;
- comprobación del dataset activo tras actualizar;
- ninguna migración destructiva;
- rollback de datos independiente de la caché del service worker.

## 27. Criterios automatizados de aceptación

### 27.1 Base y migración

- `nutriasta` conserva versión, tablas, recuentos y huellas;
- la migración 6 solo añade las doce tablas;
- ninguna fila del MVP 1 cambia;
- todos los registros nuevos contienen `datasetId`;
- las consultas no mezclan datasets;
- migración repetida no duplica tipos iniciales;
- datasets activo y rollback continúan legibles.

### 27.2 Entrenamiento

- objetivo inicial 4 y valores válidos 1–7;
- cada periodo de objetivo empieza exactamente un lunes;
- cambiar permite escoger semana actual o siguiente y muestra la fecha exacta;
- semana actual resuelve su lunes incluso si el cambio se realiza otro día;
- semana siguiente resuelve el lunes inmediatamente posterior;
- cambio de objetivo no reinterpreta ninguna semana anterior;
- resolver una semana usa el periodo efectivo correcto;
- calendario correcto en cambios de mes, año y horario;
- sesión planificada, completada, cancelada y no planificada;
- varios tipos iniciales o personalizados;
- sesión válida sin ejercicios ni series;
- ejercicios con cero o más series;
- repeticiones y cargas opcionales;
- copia genera identificadores nuevos;
- la copia no modifica la original;
- cumplimiento cuenta sesiones, no tipos;
- tipos usados se archivan sin romper el historial.

### 27.3 Peso

- alta, edición y eliminación;
- varias entradas el mismo día;
- copia desde perfil únicamente tras acción y confirmación;
- editar historial no cambia silenciosamente el perfil;
- aislamiento por dataset.

### 27.4 Inventario y compra

- saldo derivado y movimiento coherentes;
- alimentos con base `g` usan gramos canónicos;
- alimentos con base `ml` usan mililitros canónicos;
- una unidad o envase sin equivalencia no modifica inventario;
- una porción guardada con equivalencia explícita se convierte correctamente;
- cada movimiento conserva equivalencia y resultado canónico históricos;
- nunca se convierte entre gramos y mililitros;
- no se permiten saldos negativos;
- consumo normal descuenta automáticamente una vez;
- reabrir una comida no duplica descuento;
- agotar muestra aviso antes de escribir;
- las tres opciones del aviso funcionan;
- añadir a compra suma una entrada existente compatible;
- insuficiencia no modifica nada antes de elegir;
- cada decisión registra solicitado, descontado, faltante, decisión, operación,
  elemento del diario y alimento;
- descontar solo lo disponible deja saldo cero y conserva la nutrición completa;
- esa diferencia queda visible y no se presenta como inventario exacto;
- no descontar conserva nutrición y registra la ausencia de movimiento;
- cancelar no modifica ninguna tabla;
- editar cantidad aplica solo la diferencia;
- reducir cantidad crea compensación trazable;
- eliminar o devolver a planificado crea movimientos inversos;
- volver a consumir genera una operación nueva;
- un fallo durante cualquiera de esas acciones revierte nutrición e inventario;
- una receta calcula todos sus ingredientes antes de escribir;
- una receta confirma consumo y movimientos como una sola transacción;
- fallar un ingrediente revierte la operación completa;
- completar compra incrementa una vez;
- repetir la acción no duplica;
- deshacer usa movimientos inversos;
- deshacer se bloquea sin cambios parciales si produciría saldo negativo;
- entradas manuales requieren vinculación antes de inventario;
- unidades incompatibles no se convierten.

### 27.5 Backup

- exportación formato 3 cifrada;
- importación de formatos 1, 2 y 3;
- formatos 1 y 2 producen tablas nuevas vacías;
- contraseña errónea o archivo corrupto no cambian `activeDatasetId`;
- límites declarados falsos se rechazan;
- expansión excesiva se detiene;
- candidato, cancelación, activación, rollback, reactivación y confirmación;
- activación y rollback cambian el puntero atómicamente;
- falta de cuota conserva el dataset anterior.

### 27.6 Eliminación y fotografías corporales

- `Eliminar todos mis datos` borra solo filas funcionales del dataset activo;
- conserva `nutriasta`;
- conserva catálogo técnico y `activeDatasetId`;
- conserva datasets de rollback y recuperación con sus datos;
- no afecta backups guardados en Archivos;
- la PWA continúa instalada y operativa con el dataset activo vacío;
- no existen tablas, campos, permisos, procesado ni entradas de backup para
  fotografías corporales.

### 27.7 PWA e interfaz

- primer render con ancho válido;
- botones sin desbordamiento en anchos de iPhone;
- icono aprobado en manifiesto y recursos;
- service worker sin activación automática;
- ninguna solicitud externa;
- apertura offline;
- actualización espera operaciones pendientes;
- datos intactos tras actualización.

Antes de desplegar cualquier futura versión deberán ejecutarse los controles vigentes:
TypeScript, unitarias, compilación web, E2E compatibles, Expo Doctor y revisión del
árbol Git. Una limitación real de Playwright WebKit en Windows deberá documentarse y
trasladarse a validación física, no ocultarse ni sustituirse por esperas mayores.

## 28. Prueba física guiada propuesta para iPhone

La prueba usará exclusivamente nombres, pesos, alimentos, fotografías de producto y
entrenamientos ficticios. Requerirá autorización separada para desplegar.

### A. Preparación y actualización

1. Guardar un backup formato 2 reciente y comprobar su contraseña.
2. Anotar el texto, alimento y fotografía ficticios existentes.
3. Abrir la PWA 0.2.1 instalada.
4. Comprobar que la versión propuesta 0.3.0 no se activa sola.
5. Esperar el aviso de actualización.
6. Pulsar `Actualizar`.
7. Confirmar que aparece 0.3.0 y el icono aprobado.
8. Comprobar que todos los datos del MVP 1 siguen presentes.

### B. Objetivo, calendario y sesiones

9. Abrir el calendario y navegar al mes anterior y siguiente.
10. Volver a hoy y verificar que cada semana comienza en lunes.
11. Confirmar el objetivo inicial de 4.
12. Anotar el lunes exacto de la semana actual.
13. Cambiar el objetivo y elegir `Aplicar esta semana`.
14. Confirmar que la aplicación muestra exactamente ese lunes antes de guardar.
15. Abrir una semana anterior y comprobar que conserva su objetivo previo.
16. Crear otro cambio eligiendo `Aplicar la semana siguiente`.
17. Confirmar que muestra el lunes inmediatamente posterior.
18. Comprobar que la semana actual no cambia.
19. Abrir la semana siguiente y comprobar el objetivo nuevo.
20. Dejar finalmente un periodo con objetivo 4.
21. Planificar una sesión futura con `pecho` y `tríceps`.
22. Guardarla sin ejercicios y comprobar que se acepta.
23. Crear un tipo personalizado ficticio y usarlo en otra sesión.
24. Añadir un ejercicio ficticio con varias series y alguna carga.
25. Dejar otra carga y otra repetición vacías.
26. Completar la sesión y comprobar el resumen semanal.
27. Registrar un entrenamiento no planificado en otro día.
28. Copiar una sesión a otra fecha y editar la copia.
29. Verificar que la original no cambió.
30. Cancelar una sesión planificada.
31. Buscar las sesiones en el historial.

### C. Peso y exclusión de fotografías corporales

32. Añadir dos pesos ficticios el mismo día.
33. Editar uno y eliminar el otro.
34. Copiar explícitamente el peso ficticio actual del perfil.
35. Comprobar que el perfil no cambia al editar el historial.
36. Confirmar que no existe pantalla, permiso ni acción para fotografías corporales.

### D. Unidad canónica, compra e inventario

37. Elegir un alimento ficticio cuya base sea gramos.
38. Guardar una porción ficticia `envase = 125 g`.
39. Comprar dos envases y comprobar que el inventario aumenta 250 g.
40. Abrir el movimiento y comprobar equivalencia y resultado canónico.
41. Elegir un alimento ficticio cuya base sea mililitros.
42. Comprobar que su saldo y movimientos se expresan en ml.
43. Intentar usar `una unidad` sin equivalencia explícita.
44. Confirmar que el inventario no se modifica.
45. Intentar convertir g a ml y confirmar que se bloquea sin inventar un valor.
46. Añadir una entrada manual y otra vinculada a la compra.
47. Completar la compra y comprobar los saldos.
48. Reabrir y verificar que no se duplican cantidades.
49. Deshacer la compra antes de consumir.
50. Comprobar movimientos inversos y lista editable.
51. Completarla nuevamente.

### E. Consumo, edición y atomicidad

52. Registrar un consumo ficticio que deje saldo positivo.
53. Comprobar que nutrición e inventario se actualizan juntos.
54. Reabrirlo y comprobar que no se descuenta otra vez.
55. Editar la cantidad de 100 g a 150 g.
56. Confirmar que aparece únicamente un movimiento adicional de 50 g.
57. Editarla de 150 g a 80 g.
58. Confirmar un movimiento compensatorio de 70 g.
59. Devolver el consumo a planificado.
60. Confirmar el movimiento inverso y la restauración del saldo.
61. Marcarlo otra vez como consumido.
62. Confirmar una operación nueva, sin reutilizar ni borrar la anterior.
63. Eliminar otro consumo aplicado y verificar su movimiento inverso.
64. Preparar un alimento con exactamente 200 g disponibles.
65. Registrar un consumo de esos 200 g.
66. Confirmar que el aviso aparece antes de modificar nutrición o inventario.
67. Elegir `Consumir y añadir a la compra`.
68. Comprobar saldo cero, nutrición completa y entrada de compra.
69. Preparar un consumo de 250 g con solo 200 g disponibles.
70. Elegir `Descontar solo lo disponible`.
71. Comprobar solicitado 250 g, descontado 200 g y faltante 50 g.
72. Confirmar saldo cero, nutrición completa y diferencia visible de inventario.
73. Repetir con datos nuevos y elegir `No descontar inventario`.
74. Confirmar nutrición completa, saldo intacto y decisión registrada.
75. Repetir con datos nuevos y elegir `Cancelar y corregir`.
76. Confirmar que ninguna tabla visible cambia.
77. Crear una receta ficticia con al menos dos ingredientes.
78. Dejar uno suficiente y otro que vaya a agotarse.
79. Revisar todas las decisiones reunidas en una sola pantalla.
80. Cancelar y comprobar que no cambian receta, diario, saldos ni compra.
81. Repetir y confirmar la operación completa.
82. Comprobar que ambos movimientos y el consumo aparecen juntos.
83. Intentar deshacer una compra ya consumida y comprobar el bloqueo seguro.

### F. Persistencia y offline

84. Cerrar completamente la PWA y abrirla de nuevo.
85. Reiniciar el iPhone.
86. Comprobar calendario, peso, inventario, decisiones y compra.
87. Activar modo avión.
88. Abrir desde el icono.
89. Crear y completar una sesión ficticia.
90. Registrar un consumo ficticio con inventario.
91. Cerrar y abrir todavía sin conexión.
92. Confirmar que todo persiste y no hay operaciones duplicadas.
93. Recuperar la conexión y verificar que los datos no cambian.

### G. Backup y restauración

94. Exportar un backup formato 3 con contraseña de prueba.
95. Guardarlo en `En mi iPhone`.
96. Confirmar fecha y advertencia de backup.
97. Modificar sesión, objetivo, peso, consumo y existencia.
98. Probar contraseña errónea y comprobar que nada cambia.
99. Preparar el candidato correcto y cancelarlo.
100. Confirmar que siguen los datos modificados.
101. Prepararlo otra vez y activarlo.
102. Confirmar que vuelven exactamente los datos exportados.
103. Volver a los datos anteriores.
104. Confirmar que reaparecen las modificaciones.
105. Reactivar el candidato.
106. Confirmar definitivamente.
107. Restaurar en otra prueba controlada un formato 2.
108. Comprobar que el MVP 1 aparece y las doce tablas del MVP 2 están vacías.
109. Volver mediante rollback al dataset formato 3.
110. Cerrar, reiniciar y abrir offline una última vez.

### H. Eliminación, siempre al final

111. Conservar y verificar el backup formato 3 en Archivos.
112. Anotar los datasets de rollback y recuperación visibles.
113. Eliminar individualmente datos ficticios y revisar sus confirmaciones.
114. Ejecutar `Eliminar todos mis datos` únicamente como última acción.
115. Confirmar que desaparecen solo las filas funcionales del dataset activo.
116. Confirmar que el dataset activo técnico continúa disponible pero vacío.
117. Confirmar que `nutriasta` y los datasets de rollback y recuperación se conservan.
118. Abrir Archivos y confirmar que el backup formato 3 sigue guardado.
119. Confirmar que la PWA continúa instalada, abre y no afecta otros datos del iPhone.

## 29. Condiciones de parada

La implementación o validación se detendrá si:

- cambia una fila, blob o huella del MVP 1 durante la migración;
- `nutriasta` deja de estar en versión 1 o recibe una escritura;
- se pierde un dataset activo o de rollback;
- una consulta mezcla datasets;
- la migración es destructiva;
- una actualización se activa sin consentimiento;
- el service worker borra o bloquea IndexedDB;
- el calendario calcula fechas incorrectas;
- un objetivo entra en vigor un día que no sea lunes;
- cambiar un objetivo reinterpreta una semana anterior;
- se aplica una fecha distinta de la mostrada al confirmar;
- se inventa una equivalencia de unidad o una conversión entre g y ml;
- una unidad sin equivalencia modifica el inventario;
- un movimiento se duplica;
- aparece un saldo negativo;
- se descuenta inventario antes del aviso requerido;
- nutrición cambia sin su operación de inventario, o al contrario;
- editar un consumo reaplica el total en lugar de la diferencia;
- eliminar o devolver a planificado no genera la inversión necesaria;
- una receta queda aplicada solo para algunos ingredientes;
- una cancelación modifica alguna tabla;
- falta cantidad solicitada, descontada, faltante, decisión, operación o vínculo al
  elemento del diario;
- un descuento parcial se presenta como saldo exacto;
- deshacer una compra causa cambios parciales o incoherentes;
- `Eliminar todos mis datos` borra `nutriasta`, catálogo técnico, rollback,
  recuperación, backups de Archivos o la PWA;
- se crea cualquier tabla, permiso, procesado o entrada de backup para fotografías
  corporales;
- una contraseña errónea modifica el dataset activo;
- un fallo de cuota afecta al dataset anterior;
- un backup válido de formato 1 o 2 deja de ser importable;
- aparece tráfico externo, telemetría o analítica;
- un dato o fotografía sale del dispositivo;
- la PWA no abre consistentemente offline;
- los controles se desbordan en el ancho real del iPhone;
- aparece un icono distinto al aprobado;
- se necesita una dependencia no justificada;
- la validación requiere datos personales reales.

## 30. Fases de implementación propuestas

Estas fases son únicamente una propuesta y no están autorizadas.

### Fase 0 — Seguridad de migración y formato 3

- contrato de versión 6 aditiva;
- protección comprobable de las dos bases;
- doce tablas nuevas vacías;
- compatibilidad de formatos 1 y 2;
- contrato, límites y pruebas del formato 3;
- restauración completa mediante candidato.

### Fase 1 — Calendario y sesiones

- diseño adaptable;
- periodos de objetivo semanal efectivos desde lunes;
- calendario mensual y resumen;
- sesiones, estados y tipos;
- historial y copia.

### Fase 2 — Ejercicios y series

- catálogo local;
- registro opcional;
- repeticiones, carga y notas;
- revisión cronológica del ejercicio.

### Fase 3 — Historial de peso

- entradas manuales;
- copia explícita desde perfil;
- edición y eliminación;
- privacidad.

### Fase 4 — Inventario y compra

- unidad canónica y equivalencias explícitas;
- saldos, decisiones y movimientos;
- lista y compra completada;
- deshacer seguro;
- descuento automático y correcciones por diferencia;
- atomicidad entre nutrición e inventario;
- confirmación integral de recetas;
- avisos de agotamiento e insuficiencia;
- disponibilidad de recetas.

### Fase 5 — Backup, interfaz y endurecimiento

- exportación formato 3;
- importación 1, 2 y 3;
- candidato, rollback, reactivación y confirmación;
- diseño final, iconos y accesibilidad;
- actualización controlada;
- validación automatizada y física completa.

## 31. Estado de aprobación

Las decisiones comunicadas por el usuario están incorporadas y este documento queda
**aprobado como especificación funcional**. Esta aprobación no autoriza implementar
código, modificar bases de datos, instalar dependencias, cambiar la versión ni
realizar despliegues.

No quedan extras propuestos ni pendientes dentro del alcance. Cualquier ampliación
futura deberá explicarse y consultarse antes de incorporarse.
