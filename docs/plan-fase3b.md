# Plan fase 3b — Editor, segunda parte

Decidida el 2026-11-13 (Bruno): las cuatro funciones del editor que quedaron fuera del criterio de la fase 3 forman la fase 3b. Va después de la fase 3, cerrada con la versión 0.1.3, y antes de la fase 4.

Orden: T16 → T17 → T17b → T18 → T19. Hechas T16, T17, T17b y T18 (2026-11-14); sigue T19, con el plan aprobado el 2026-11-15 (`docs/plan-T19.md`). El número de orden de los contactos auxiliares es una tarea aparte: se revisó al planear T18 y no hace falta para T18 (D0-A de `docs/plan-T18.md`).

## Contexto
La fase 3 pasó con la marcha-parada dibujada a mano (T15, `docs/plan-fase3.md`). Su sección "Fuera del criterio de pasaje" dejó para después cuatro funciones de la lista "Funciones del editor" de `docs/arquitectura.md`:
- copiar, cortar, pegar y duplicar (Ctrl+D);
- etiquetado automático (K2, S3…);
- referencias cruzadas bajo cada bobina;
- validaciones en vivo (bornes y cables sueltos en naranja).

**Pasa cuando** (confirmado por Bruno el 2026-11-13): a partir de la marcha-parada, se arma a mano a 1024×600 una inversión de giro con enclavamiento eléctrico entre K1 y K2. La rama de K2 se hace duplicando la de K1 con Ctrl+D, no dibujándola de nuevo. Al terminar:
- no hay bobinas repetidas y cada contacto queda vinculado a su bobina por la etiqueta;
- las referencias cruzadas bajo K1 y K2 son correctas: cada lista muestra exactamente sus NA y NC y ninguna tapa la otra rama (definición completa en `docs/plan-T18.md`, sección 3);
- nada queda en naranja;
- el `.brn` dibujado se compara por redes con el archivo congelado `tests/circuitos/inversion.brn` usando `npm run circuito`, como en T15;
- el banco no empeora contra `v0.1.3` en la PC, y la prueba a mano anda en la netbook con Windows.

El armado de referencia, el `inversion.brn` y la comparación se hacen al cerrar la fase, como T15, y se planean después de T19.

**En la netbook, al cerrar la fase, junto con la prueba de la inversión** (decisión de Bruno, 2026-11-13; T16 no espera por esto):
- *Duplicar todo (2000)*: en la PC, en las condiciones de T15, tarda 42,5 ms de mediana y 55,8 de máximo; el tope es 150/300 ms. En la primera corrida, con la PC inestable, dio ~116 ms (`docs/plan-T16.md`, sección 9).
- La previa de pegar con `TOPE_PREVIA_PEGAR = 160`: en la netbook con Mint, unas 6 veces más lenta que la PC según T14a, la revisión por punto podría pasar los 16 ms. Verificarlo ahí. En la PC, toda la serie hasta 500 da p95 ≤ 5 ms, y el tope se revisa con lo que dé la netbook.
- **Desde T17** (`docs/plan-T17.md`, "Vigente para el cierre de la fase 3b"): *Duplicar todo (2000)* pasó justo en la PC contra `d969019` (59,35 y 59,79 ms) y *Pegar 500* suma de 0,55 a 0,9 ms. Medir las dos en la netbook, junto con el tope 160.
- **Desde T18** (`docs/plan-T18.md`, "Vigente para el cierre de la fase 3b"): también *Rehacer al 31 % con referencias* y *Mover 1 contacto con referencias al 31 %*. En la PC pasaron sus topes con margen (por gesto, base × 1,04; paso, base + 0,3 ms).
- **Desde T19** (`docs/plan-T19.md`, sección 9): *Encuadrar (F)* con 500 y los contornos de etiqueta. **Pasa si no hay cuadros lentos.** En la PC, el p95 del cuadro sube de 1,6 a 2,9 ms y el gesto de 0,6 a 0,8 ms, porque la cola del gesto suma un cuadro de unos 9,5 ms en 4 de 6 corridas. La causa no está identificada: a ese zoom los contornos no se dibujan. Costo aceptado por Bruno (2026-11-15); se vuelve a medir en la etapa 3 de T19.
- **Desde T19, etapa 3** (`docs/plan-T19.md`, sección 5): *Dibujar 1 cable con 2000 y un par NC+bobina al 31 %*, con el costo de cada pasada de R6 (`redes()` sobre la hoja entera). Va a la netbook aunque pase en la PC (decisión de Bruno, 2026-11-15). Desde la etapa 3b, R6 recorre solo las redes que toca el cable: en la PC, p95 0,1 ms y máximo 0,1 ms.
- **Desde T19, etapa 3b** (`docs/plan-T19.md`, sección 5): los cuadros que siguen a *Pegar 500* y a *Duplicar todo*. El editor repinta además los componentes cuyo contorno de aviso cambia sin que el comando los nombre (77 y 277). En la PC, la mediana por cuadro sube de 0,7 a 6,45 ms y de 1,5 a 8,7 ms, sin lentos. **Pasa si hay como máximo 1 cuadro lento después del gesto y ninguno de más de 100 ms** (decisión de Bruno, 2026-11-16).

## Reglas
Las mismas de la fase 3:
- Una tarea por sesión. Primero el plan (`docs/plan-TNN.md`) y, con el "aprobado" de Bruno, el código.
- Al cerrar cada etapa: `npm test`, `npm run check` y commit local. Si hay algo visible en la app, también su humo `tests/humo/tNN-*.mjs`, y al cerrar la tarea `npm run humo` entero.
- Si la tarea toca el editor o el dibujo: banco contra `v0.1.3` en la PC, con el criterio fijado en el plan antes de medir. A la netbook se va solo si el banco da algo dudoso.
- **Topes de los escenarios que `v0.1.3` no tiene** (regla nueva de Bruno, 2026-11-14, desde T17): se fijan contra el commit anterior a la tarea, medido en la misma sesión con ABBA ×3 y dos tandas, no contra números de otro día. Un día la PC midió el mismo código hasta un 30 % más lento (T17, sección 4). La netbook, al cierre de la fase, sigue siendo la que decide.
- Sin push ni versión sin autorización de Bruno.

## Tareas

### T16. Copiar, cortar, pegar y duplicar
- **Qué:** Ctrl+C, Ctrl+X, Ctrl+V y Ctrl+D (también Mayús+Supr, Ctrl+Insert y Mayús+Insert). Un solo paso de deshacer y conflictos con la misma regla que Colocar.
- **Plan:** `docs/plan-T16.md`, aprobado el 2026-11-13.
- **Etapa 0 (docs):** hecha.
- **Etapa 1 (núcleo, `src/core/model/portapapeles.ts`):** hecha el 2026-11-13. Detalle en `docs/plan-T16.md`, sección 7.
- **Etapa 2 (editor: atajos, `HerramientaPegar`, Ctrl+D):** hecha el 2026-11-13. Detalle en `docs/plan-T16.md`, sección 8.
- **Etapa 3 (humo t16 y banco):** hecha el 2026-11-13. `TOPE_PREVIA_PEGAR` = 160 (limitado hasta la netbook), contra `v0.1.3` pasa salvo 2 celdas de 100 por resolución del reloj. Detalle en `docs/plan-T16.md`, sección 9, y en `docs/bench.md`.
- **Etapa 4 (cierre, solo docs):** hecha el 2026-11-13. Detalle en `docs/plan-T16.md`, sección 10.
- **T16 hecha el 2026-11-13.** La medición en la netbook queda para el cierre de la fase (arriba).

### T17. Etiquetado automático
- **Qué:** el segundo contactor que se coloca es K2, el tercer pulsador S3, etc. Lo pegado y lo duplicado se renumera solo si choca con la hoja, la bobina junto con sus contactos (reemplaza a D3-A de `docs/plan-T16.md`). Comando "Etiquetar los vacíos" y renombrado de bobina que arrastra a sus contactos.
- **Plan:** `docs/plan-T17.md`, aprobado el 2026-11-14.
- **Etapa 0 (docs):** hecha el 2026-11-14.
- **Etapa 1 (núcleo):** `prefijoEtiqueta` en el catálogo, `src/core/model/etiquetado.ts` y `CambiarEtiquetas`, con tests. Hecha el 2026-11-14.
- **Etapa 2 (editor y panel):** `src/editor/armarEtiquetas.ts`, Colocar y su previa, pegar y duplicar, "Etiquetar los vacíos" (botón del panel sin selección), renombrado con arrastre y las notas del panel. Hecha el 2026-11-14.
- **Etapa 3 (humo t17 y banco):** hecha el 2026-11-14. Humo t17 con 32 comprobaciones. *Etiquetar los vacíos* pasa sus topes fijos. Pegar 500 y Duplicar todo pasan con el criterio relativo a `d969019` (cambio de criterio de Bruno). Contra `v0.1.3`, 3 celdas sin editor quedan aceptadas como ruido. Detalle en `docs/plan-T17.md` (sección 4 y etapa 3) y en `docs/bench.md`.
- **Etapa 4 (cierre, solo docs):** hecha el 2026-11-14. Detalle en `docs/plan-T17.md` (etapa 4 y "Vigente para el cierre de la fase 3b").
- **T17 hecha el 2026-11-14.** Sigue T17b. Para la netbook, al cierre de la fase: Duplicar todo (2000), que pasó justo en la PC (59,35 y 59,79 ms), Pegar 500 y el tope 160 de la previa.

### T17b. Contacto auxiliar NC y `compararRedes`
Tarea corta, después de T17 y antes de T18 (decisión de Bruno, 2026-11-14). Sale de dos hallazgos al planear T17:
- **Contacto auxiliar NC:** no existe en la biblioteca, y el enclavamiento eléctrico del criterio de la fase lo necesita. Definición y test de bornes.
- **`compararRedes`:** hoy da por repetidos dos auxiliares NA de una misma bobina (misma etiqueta y mismo tipo), y con T17 un contacto nuevo queda sin etiqueta. Decidir cómo los compara.
- **Plan:** `docs/plan-T17b.md`, aprobado el 2026-11-14. NC 21-22 fijo (NA 13-14), `compararRedes` con firma por redes para los contactos repetidos e informe de los vacíos, escena del banco fija en los 7 tipos de `v0.1.3` (sin banco).
- **Etapa 0 (docs):** hecha el 2026-11-14.
- **Etapa 1 (símbolo NC, escena fija del banco, tests de símbolo, etiquetado, portapapeles y `.brn`):** hecha el 2026-11-14.
- **Etapa 2 (`compararRedes`):** hecha el 2026-11-14. Contactos repetidos por firma y vacíos informados. Límite conocido: dos cadenas iguales en paralelo no se identifican (`docs/plan-T17b.md`, sección 2).
- **Etapa 3 (humo t17b, `npm run humo` entero y cierre):** hecha el 2026-11-14. **T17b hecha.** Sigue T18 (antes, revisar el número de orden de los auxiliares).

### Número de orden de contactos auxiliares (tarea aparte)
- **Qué:** que los auxiliares de una misma bobina lleven el número de orden en sus bornes (13-14, 23-24, 31-32…), en lugar de 13-14 y 21-22 fijos.
- **De dónde sale:** D1 de `docs/plan-T17b.md` (Bruno, 2026-11-14). Hoy los nombres de los bornes son fijos por definición y los cables guardan `{comp, borne}`, así que cambiar el número toca los cables, el dibujo por componente, `redes`, el `.brn` y el panel.
- **Cuándo:** se revisó al planear T18 (Bruno, 2026-11-14, D0-A de `docs/plan-T18.md`): **no hace falta para T18**. En la inversión cada contactor usa un NA y un NC, así que no hay filas repetidas. Con dos NA de una misma bobina, la lista muestra dos filas 13-14 que se distinguen por la ubicación. T18 lee los bornes de cada fila por una sola función, así el número de orden entra después sin rehacer la lista. Sigue como tarea aparte, sin fecha.
- **Plan:** sin escribir.

### T18. Referencias cruzadas
- **Qué:** debajo de cada bobina, la lista de sus contactos (los que tienen su misma etiqueta): NA o NC, bornes y dónde está cada uno, en coordenadas de grilla. Se deriva: no se guarda en el `.brn`.
- **Plan:** `docs/plan-T18.md`, aprobado el 2026-11-14. Solo bajo la bobina, coordenadas con la convención de la barra de estado, cálculo por comando, capa estática sin interruptor, sin naranja y sin clic.
- **Etapa 0 (docs):** hecha el 2026-11-14.
- **Etapa 1 (núcleo, `src/core/model/referencias.ts`):** hecha el 2026-11-14.
- **Etapa 2 (dibujo y editor):** hecha el 2026-11-14. El test de Ctrl+D contra el ancho de la lista no dio choques (holgura mínima 1,4). Separador de un espacio, elegido por Bruno. Límite conocido: el peor caso de 21 letras.
- **Etapa 3 (humo t18 y banco):** hecha el 2026-11-14. Humo t18 con 31 comprobaciones; los dos escenarios nuevos, Pegar 500 y Duplicar todo pasan contra `234b7e6`; 2 celdas comunes aceptadas como ruido. Detalle en `docs/plan-T18.md` y en `docs/bench.md`.
- **Etapa 4 (cierre, solo docs):** hecha el 2026-11-14.
- **T18 hecha el 2026-11-14.** Sigue T19. Para la netbook, al cierre de la fase: también *Rehacer al 31 % con referencias* y *Mover 1 contacto con referencias al 31 %* (`docs/plan-T18.md`, "Vigente para el cierre de la fase 3b").
- **Opcional para después (Bruno, 2026-11-14, no va en T18):** al seleccionar un contacto, una línea en el panel con su bobina («Bobina K1 en (x, y)»).
- **Opcional para después (Bruno, 2026-11-14, no va en T18):** clic en una fila de la lista para ir al contacto, o en un contacto para ir a su bobina.

### T19. Validaciones en vivo
- **Qué:** mientras se dibuja, se marca lo que le falta o le sobra al circuito: contactos sin bobina, etiquetas vacías o repetidas, prefijos de otro tipo, bornes sin conectar y cables sueltos. En el lienzo, en la barra de estado (contador) y en el panel. Se deriva: no se guarda en el `.brn`.
- **Plan:** `docs/plan-T19.md`, aprobado el 2026-11-15. Reglas R1 a R9, cálculo por comando, validaciones en naranja (`--aviso`) y lo que no se puede hacer en un rojo nuevo (`--conflicto`). *Error* es lo que impedirá simular en la fase 5; *aviso*, lo que no.
- **Etapa 0 (docs):** hecha el 2026-11-15.
- **Etapa 1 (núcleo):** hecha el 2026-11-15.
  - `src/core/model/validaciones.ts` con R1 a R9 y R4 partida (cambios 6 y 7). Probado al azar contra un cálculo lento y con las reglas anuladas.
  - Medido: `redes()` con 2000 tarda de 1,1 a 1,6 ms, así que R10 sigue en la fase 5.
  - Del banco salieron dos decisiones: el anillo de R7 y R8 solo para el único seleccionado (cambio 8) y el contorno de etiqueta como se diseñó (cambio 9).
  - Detalle en `docs/plan-T19.md`, secciones 6 y 9.
- **Etapas 2 (dibujo y editor), 3a (humo y primera medición, frenada) y 3b (`AvisosHoja` más incremental):** hechas el 2026-11-15 y el 2026-11-16. Con la 3b, el banco pasa contra `926915d` (`docs/bench.md`, "Validaciones en vivo"). Sigue la etapa 4, de cierre (`docs/plan-T19.md`, sección 6).
- **"Nada naranja" del criterio de la fase:** las reglas R1 a R9 dan cero en la inversión y la barra dice «Sin avisos» (`docs/plan-T19.md`, sección 3).
- **Condicionado a la etapa 1:** el anillo en los bornes sin conectar se dibuja solo si no sube más de 10 % ningún escenario común del banco. Fase y Neutro en la misma red (R10) va en la fase 5, salvo que `redes()` con 2000 mida menos de 1 ms en la PC. **Resuelto en la etapa 1:** el anillo subió más de 10 % y va solo para el único seleccionado; `redes()` midió de 1,1 a 1,6 ms y R10 sigue en la fase 5.
- **Pendiente (de T16), resuelto en el plan:** la previa en conflicto pasa a `--conflicto` y las validaciones quedan en `--aviso`, con formas distintas.
- **Pendiente (de T17b), resuelto en el plan:** el NC "K2" que queda en la rama de K2 al duplicar lo avisa R6 (el NC comparte una red sin nombre de alimentación con su propia bobina). El límite de T17b sigue fijado por su test (`docs/plan-T17b.md`, sección 3).
- **Pendiente (de T17b), resuelto en el plan:** el prefijo que no corresponde al tipo (pulsador K1) lo avisa R5.
- **Opcional para después (Bruno, 2026-11-15, no va en T19):** lista desplegable de avisos desde el contador de la barra y clic para ir al componente. Va junto con el clic para ir de T18: usan la misma función.
- **R4 partida (Bruno, 2026-11-15, al arrancar la etapa 1):** error solo para lo que no es pulsador (bobinas y lámparas). Un pulsador NA y uno NC con la misma etiqueta se permiten (doble contacto); dos del mismo tipo dan aviso (`docs/plan-T19.md`, cambios 6 y 7).
- **Pendiente (de T19, no va en T19):** `compararRedes` trata hoy un pulsador repetido en la base como error (tira: "ningún componente repetido"), aunque con R4 partida un NA y un NC "S1" son válidos y dos NA "S1" son solo aviso. Revisarlo cuando haga falta comparar un circuito con pulsadores de doble contacto (por ejemplo, la inversión al cierre de la fase).

## Pendientes que vienen de la fase 3
Siguen en `docs/plan-fase3.md`: los "Pendiente aparte" del principio y "UI y símbolos (después de T15)". Uno toca a T16: acelerar `Uniones` cuando llegue pegar (`docs/plan-fase3.md`, T14b). Está en los riesgos de `docs/plan-T16.md`.
