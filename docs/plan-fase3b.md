# Plan fase 3b — Editor, segunda parte

Decidida el 2026-11-13 (Bruno): las cuatro funciones del editor que quedaron fuera del criterio de la fase 3 forman la fase 3b. Va después de la fase 3, cerrada con la versión 0.1.3, y antes de la fase 4.

Orden: T16 → T17 → T17b → T18 → T19. Hechas T16, T17, T17b y T18 (2026-11-14) y T19 (2026-11-16, `docs/archivo/plan-T19.md`). Sigue el cierre de la fase (armado de la inversión, `inversion.brn` y netbook): plan en `docs/plan-cierre-3b.md`, aprobado el 2026-11-16 (sección "Cierre de la fase 3b", abajo). El número de orden de los contactos auxiliares es una tarea aparte: se revisó al planear T18 y no hace falta para T18 (D0-A de `docs/archivo/plan-T18.md`).

## Contexto
La fase 3 pasó con la marcha-parada dibujada a mano (T15, `docs/archivo/plan-fase3.md`). Su sección "Fuera del criterio de pasaje" dejó para después cuatro funciones de la lista "Funciones del editor" de `docs/arquitectura.md`:
- copiar, cortar, pegar y duplicar (Ctrl+D);
- etiquetado automático (K2, S3…);
- referencias cruzadas bajo cada bobina;
- validaciones en vivo (bornes y cables sueltos en naranja).

**Pasa cuando** (confirmado por Bruno el 2026-11-13): a partir de la marcha-parada, se arma a mano a 1024×600 una inversión de giro con enclavamiento eléctrico entre K1 y K2. La rama de K2 se hace duplicando la de K1 con Ctrl+D, no dibujándola de nuevo. Al terminar:
- no hay bobinas repetidas y cada contacto queda vinculado a su bobina por la etiqueta;
- las referencias cruzadas bajo K1 y K2 son correctas: cada lista muestra exactamente sus NA y NC y ninguna tapa la otra rama (definición completa en `docs/archivo/plan-T18.md`, sección 3);
- nada queda en naranja;
- el `.brn` dibujado se compara por redes con el archivo congelado `tests/circuitos/inversion.brn` usando `npm run circuito`, como en T15;
- el banco no empeora contra `v0.1.3` en la PC, y la prueba a mano anda en la netbook con Windows.

El armado de referencia, el `inversion.brn` y la comparación se hacen al cerrar la fase, como T15, y se planean después de T19.

**En la netbook, al cerrar la fase, junto con la prueba de la inversión** (decisión de Bruno, 2026-11-13; T16 no espera por esto):
- *Duplicar todo (2000)*: en la PC, en las condiciones de T15, tarda 42,5 ms de mediana y 55,8 de máximo; el tope es 150/300 ms. En la primera corrida, con la PC inestable, dio ~116 ms (`docs/archivo/plan-T16.md`, sección 9).
- La previa de pegar con `TOPE_PREVIA_PEGAR = 160`: en la netbook con Mint, unas 6 veces más lenta que la PC según T14a, la revisión por punto podría pasar los 16 ms. Verificarlo ahí. En la PC, toda la serie hasta 500 da p95 ≤ 5 ms, y el tope se revisa con lo que dé la netbook.
- **Desde T17** (`docs/archivo/plan-T17.md`, "Vigente para el cierre de la fase 3b"): *Duplicar todo (2000)* pasó justo en la PC contra `d969019` (59,35 y 59,79 ms) y *Pegar 500* suma de 0,55 a 0,9 ms. Medir las dos en la netbook, junto con el tope 160.
- **Desde T18** (`docs/archivo/plan-T18.md`, "Vigente para el cierre de la fase 3b"): también *Rehacer al 31 % con referencias* y *Mover 1 contacto con referencias al 31 %*. En la PC pasaron sus topes con margen (por gesto, base × 1,04; paso, base + 0,3 ms).
- **Desde T19** (`docs/archivo/plan-T19.md`, sección 9): *Encuadrar (F)* con 500 y los contornos de etiqueta. **Pasa si no hay cuadros lentos.** En la PC, el p95 del cuadro sube de 1,6 a 2,9 ms y el gesto de 0,6 a 0,8 ms, porque la cola del gesto suma un cuadro de unos 9,5 ms en 4 de 6 corridas. La causa no está identificada: a ese zoom los contornos no se dibujan. Costo aceptado por Bruno (2026-11-15); se vuelve a medir en la etapa 3 de T19.
- **Desde T19, etapa 3** (`docs/archivo/plan-T19.md`, sección 5): *Dibujar 1 cable con 2000 y un par NC+bobina al 31 %*, con el costo de cada pasada de R6 (`redes()` sobre la hoja entera). Va a la netbook aunque pase en la PC (decisión de Bruno, 2026-11-15). Desde la etapa 3b, R6 recorre solo las redes que toca el cable: en la PC, p95 0,1 ms y máximo 0,1 ms.
- **Desde T19, etapa 3b** (`docs/archivo/plan-T19.md`, sección 5): los cuadros que siguen a *Pegar 500* y a *Duplicar todo*. El editor repinta además los componentes cuyo contorno de aviso cambia sin que el comando los nombre (77 y 277). En la PC, la mediana por cuadro sube de 0,7 a 6,45 ms y de 1,5 a 8,7 ms, sin lentos. **Pasa si hay como máximo 1 cuadro lento después del gesto y ninguno de más de 100 ms** (decisión de Bruno, 2026-11-16).

## Reglas
Las mismas de la fase 3:
- Una tarea por sesión. Primero el plan (`docs/plan-TNN.md`) y, con el "aprobado" de Bruno, el código.
- Al cerrar cada etapa: `npm test`, `npm run check` y commit local. Si hay algo visible en la app, también su humo `tests/humo/tNN-*.mjs`, y al cerrar la tarea `npm run humo` entero.
- Si la tarea toca el editor o el dibujo: banco contra `v0.1.3` en la PC, con el criterio fijado en el plan antes de medir. A la netbook se va solo si el banco da algo dudoso.
- **Topes de los escenarios que `v0.1.3` no tiene** (regla nueva de Bruno, 2026-11-14, desde T17): se fijan contra el commit anterior a la tarea, medido en la misma sesión con ABBA ×3 y dos tandas, no contra números de otro día. Un día la PC midió el mismo código hasta un 30 % más lento (T17, sección 4). La netbook, al cierre de la fase, sigue siendo la que decide.
- Sin push ni versión sin autorización de Bruno.

## Tareas

### T16. Copiar, cortar, pegar y duplicar — hecha el 2026-11-13
- **Qué:** Ctrl+C, Ctrl+X, Ctrl+V y Ctrl+D (también Mayús+Supr, Ctrl+Insert y Mayús+Insert). Un solo paso de deshacer; los conflictos siguen la misma regla que Colocar.
- **Hecho:** núcleo en `src/core/model/portapapeles.ts`, atajos y `HerramientaPegar` en el editor, humo t16 y banco.
- **Decisiones:** `TOPE_PREVIA_PEGAR` = 160 (limitado hasta medirlo en la netbook). Contra `v0.1.3` pasa salvo 2 celdas de 100 por resolución del reloj.
- **Pendientes:** medir en la netbook *Duplicar todo (2000)* y el tope 160 (lista de "Contexto", arriba). Resuelto después: la previa en conflicto usa `--conflicto` y las validaciones `--aviso` (T19). La renumeración al pegar la resolvió T17 (reemplaza a D3-A).
- **Detalle:** `docs/archivo/plan-T16.md` (secciones 7 a 10) y `docs/archivo/bench-historial.md`.

### T17. Etiquetado automático — hecha el 2026-11-14
- **Qué:** el segundo contactor que se coloca es K2, el tercer pulsador S3, etc. Lo pegado y lo duplicado se renumera solo si choca con la hoja, la bobina junto con sus contactos.
- **Hecho:** `prefijoEtiqueta` en el catálogo, `src/core/model/etiquetado.ts` y `CambiarEtiquetas`; `src/editor/armarEtiquetas.ts` (Colocar y su previa, pegar y duplicar); botón "Etiquetar los vacíos" en el panel sin selección; renombrado de bobina que arrastra a sus contactos. Humo t17 con 32 comprobaciones.
- **Decisiones:** *Pegar 500* y *Duplicar todo* se miden relativos a `d969019` (cambio de criterio de Bruno). Regla nueva: los topes de escenarios que `v0.1.3` no tiene se fijan contra el commit anterior a la tarea, ABBA ×3 y dos tandas (arriba, "Reglas"). Contra `v0.1.3`, 3 celdas sin editor quedan aceptadas como ruido.
- **Pendientes:** netbook, al cierre de la fase: *Duplicar todo (2000)*, que pasó justo en la PC (59,35 y 59,79 ms), *Pegar 500* y el tope 160.
- **Detalle:** `docs/archivo/plan-T17.md` (sección 4, etapa 4 y "Vigente para el cierre de la fase 3b").

### T17b. Contacto auxiliar NC y `compararRedes` — hecha el 2026-11-14
- **Qué:** tarea corta entre T17 y T18 (Bruno). Sale de dos hallazgos al planear T17: el NC no existía en la biblioteca y `compararRedes` confundía auxiliares repetidos de una misma bobina.
- **Hecho:** símbolo NC con bornes 21-22 fijos (NA 13-14) y su test de bornes; escena del banco fija en los 7 tipos de `v0.1.3` (sin banco nuevo); `compararRedes` con firma por redes para los contactos repetidos e informe de los vacíos. Humo t17b y `npm run humo` entero.
- **Decisiones:** bornes fijos por definición, sin número de orden (ver la tarea aparte, abajo).
- **Pendientes:** límite conocido: dos cadenas iguales en paralelo no se identifican (`docs/archivo/plan-T17b.md`, sección 2). El NC "K2" que queda al duplicar lo avisa R6 de T19, y su límite sigue fijado por el test (sección 3).
- **Detalle:** `docs/archivo/plan-T17b.md`.

### Número de orden de contactos auxiliares (tarea aparte)
- **Qué:** que los auxiliares de una misma bobina lleven el número de orden en sus bornes (13-14, 23-24, 31-32…), en lugar de 13-14 y 21-22 fijos.
- **De dónde sale:** D1 de `docs/archivo/plan-T17b.md` (Bruno, 2026-11-14). Hoy los nombres de los bornes son fijos por definición y los cables guardan `{comp, borne}`, así que cambiar el número toca los cables, el dibujo por componente, `redes`, el `.brn` y el panel.
- **Cuándo:** se revisó al planear T18 (Bruno, 2026-11-14, D0-A de `docs/archivo/plan-T18.md`): **no hace falta para T18**. En la inversión cada contactor usa un NA y un NC, así que no hay filas repetidas. Con dos NA de una misma bobina, la lista muestra dos filas 13-14 que se distinguen por la ubicación. T18 lee los bornes de cada fila por una sola función, así el número de orden entra después sin rehacer la lista. Sigue como tarea aparte, sin fecha.
- **Plan:** sin escribir.

### T18. Referencias cruzadas — hecha el 2026-11-14
- **Qué:** debajo de cada bobina, la lista de sus contactos (los que tienen su misma etiqueta): NA o NC, bornes y dónde está cada uno, en coordenadas de grilla. Se deriva: no se guarda en el `.brn`.
- **Hecho:** núcleo en `src/core/model/referencias.ts`; dibujo en la capa estática y editor. El test de Ctrl+D contra el ancho de la lista no dio choques (holgura mínima 1,4). Humo t18 con 31 comprobaciones.
- **Decisiones:** solo bajo la bobina, coordenadas con la convención de la barra de estado, cálculo por comando, capa estática sin interruptor, sin naranja y sin clic. Separador de un espacio (elegido por Bruno).
- **Banco:** *Pegar 500* y *Duplicar todo* pasan contra `234b7e6`; 2 celdas comunes aceptadas como ruido.
- **Pendientes:** límite conocido: el peor caso de 21 letras. Netbook, al cierre de la fase: *Rehacer al 31 % con referencias* y *Mover 1 contacto con referencias al 31 %* (`docs/archivo/plan-T18.md`, "Vigente para el cierre de la fase 3b").
- **Opcionales para después (Bruno, 2026-11-14, no van en T18):** al seleccionar un contacto, una línea en el panel con su bobina («Bobina K1 en (x, y)»); clic en una fila de la lista para ir al contacto, o en un contacto para ir a su bobina.
- **Detalle:** `docs/archivo/plan-T18.md` y `docs/archivo/bench-historial.md`.

### T19. Validaciones en vivo — hecha el 2026-11-16
- **Qué:** mientras se dibuja, se marca lo que le falta o le sobra al circuito: contactos sin bobina, etiquetas vacías o repetidas, prefijos de otro tipo, bornes sin conectar y cables sueltos. En el lienzo, en la barra de estado (contador) y en el panel. Se deriva: no se guarda en el `.brn`.
- **Hecho:** `src/core/model/validaciones.ts` con R1 a R9 (probado al azar contra un cálculo lento y con las reglas anuladas); dibujo y editor; humo; `AvisosHoja` incremental (etapa 3b). El banco pasa contra `926915d` (`docs/bench.md`, "Validaciones en vivo").
- **Decisiones:** naranja `--aviso` para las validaciones y `--conflicto` para lo que no se puede hacer. *Error* es lo que impedirá simular en la fase 5; *aviso*, lo que no. R4 partida (Bruno, 2026-11-15): error solo para lo que no es pulsador; un pulsador NA y uno NC con la misma etiqueta se permiten, dos del mismo tipo dan aviso. El anillo de R7 y R8 va solo para el único seleccionado (subía más de 10 %). R10 (Fase y Neutro en la misma red) sigue en la fase 5: `redes()` con 2000 midió de 1,1 a 1,6 ms. R6 recorre solo las redes que toca el cable.
- **"Nada naranja" del criterio de la fase:** R1 a R9 dan cero en la inversión y la barra dice «Sin avisos» (`docs/archivo/plan-T19.md`, sección 3).
- **Pendientes:** netbook, la lista de "Contexto" (arriba), completa. Opcional para después (Bruno, 2026-11-15): lista desplegable de avisos desde el contador de la barra y clic para ir al componente; va junto con el clic de T18 (misma función). `compararRedes` tira con un pulsador repetido del mismo tipo en la base, que R4 ya avisa; un NA y un NC "S1" no tiran. Revisado al planear el cierre (2026-11-16): con D1-A no hace falta tocarlo; queda como límite conocido (`docs/plan-cierre-3b.md`, sección 1).
- **Detalle:** `docs/archivo/plan-T19.md` (secciones 3, 5, 6 y 9).

### Cierre de la fase 3b
- **Qué:** el criterio de "Pasa cuando" (arriba): inversión de giro a mano con Ctrl+D, `tests/circuitos/inversion.brn`, `npm run circuito`, banco contra `v0.1.3` y la netbook con Windows.
- **Plan:** `docs/plan-cierre-3b.md`, aprobado el 2026-11-16, con D1-A, D2-A, D3-A y D4-B y los ajustes 1 a 4 de Bruno:
  - D1-A: enclavamiento solo por los NC de K1 y K2.
  - D2-A: referencia por código, congelada.
  - D3-A: `0.1.4-alpha.1` para la netbook y después `0.1.4`.
  - D4-B: «Probar la fase 3b» en el menú de desarrollo.
- **Checklist de la netbook:** `docs/netbook-fase3b.md`, con el tope de netbook de cada criterio y la hoja de pasos.
- **Ideas para más adelante:** `docs/ideas.md`.
- **Etapa 0 (docs):** hecha el 2026-11-16.
- **Etapas 1 a 7:** núcleo y tests, humo, banco, «Probar la fase 3b», alpha, netbook y cierre (`docs/plan-cierre-3b.md`, sección 9).
- **Fase 3b cerrada el 2026-11-17** (criterio A + D1 de Bruno, con la netbook en `0.1.4-alpha.1`). Resultados por fila en `docs/netbook-fase3b.md`; decisión y causa en `docs/plan-cierre-3b.md`. Falta, con autorización de Bruno: push, tag `v0.1.4` y release.

## Pendientes que vienen de la fase 3
Siguen en `docs/archivo/plan-fase3.md`: los "Pendiente aparte" del principio y "UI y símbolos (después de T15)". Uno toca a T16: acelerar `Uniones` cuando llegue pegar (`docs/archivo/plan-fase3.md`, T14b). Está en los riesgos de `docs/archivo/plan-T16.md`.

## Pendientes de UI
- **Borrar un cable con una T colgando deja la T suelta.** El cable que salía en T queda con un extremo libre donde estaba el punto. Hoy hay que borrarlo aparte (hoja 2 de `docs/netbook-fase3b.md`, paso 3). Opciones a decidir: borrar también los cables en T, reconectarlos, o avisar al borrar. Encontrado en el cierre 3b, etapa 1.
