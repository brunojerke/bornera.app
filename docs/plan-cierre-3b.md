# Plan de cierre de la fase 3b — Inversión de giro, banco y netbook

**Aprobado el 2026-11-16** con D1-A, D2-A, D3-A y D4-B, más los ajustes 1 a 4 de Bruno (ya incorporados: 1 en la sección 6, 2 en la 7, 3 en `docs/netbook-fase3b.md` y 4 en `docs/ideas.md`).

**Estado de git al planear (verificado):** `main` en `9c8ca13` (T19 cerrada), árbol limpio, 6 commits sin push. `v0.1.3` ya está en `origin/main`; desde ahí hay 28 commits (T16 a T19). Versión en los tres archivos: `0.1.3`. Sin worktrees.

## Decisiones (Bruno, 2026-11-16)

| | Elegida | Qué |
|---|---|---|
| D1 | **A** | El enclavamiento es solo eléctrico, con los NC de K1 y K2: es lo que piden el criterio de la fase, T18 (sección 3: cada lista tiene un NA de retención y un NC de enclavamiento) y T19 (`inversion()` de `validaciones.test.ts`). |
| D2 | **A** | La referencia se arma por código, como `marchaParada.ts`, y se congela en `tests/circuitos/inversion.brn`. Un test aparte repite el procedimiento a mano (marcha-parada, NC, Ctrl+D, renombrar, cablear) y lo compara con la referencia. Bruno arma la suya siguiendo la lista de pasos de `docs/netbook-fase3b.md`, ensayada antes por el humo. |
| D3 | **A** | `0.1.4-alpha.1` para la netbook (las prereleases traen F3 y el menú de desarrollo; la 0.1.3 final no) y, si pasa, `0.1.4` al cerrar. Como T15 (alpha.11 → 0.1.3). Tag, push y release, con autorización de Bruno. |
| D4 | **B** | «Probar la fase 3b» en el menú de desarrollo: corre en la app real de la netbook los escenarios del banco de la lista de la fase y da una tabla para copiar. |

Descartadas:
- D1-B (también pulsadores de doble contacto). `compararRedes` no necesitaba arreglo (sección 1), pero Ctrl+D renumera los dos pulsadores de la copia (S3 y S4: "S2" ya es titular en la hoja), lo que suma 3 renombrados a mano y 15 componentes a 1024×600.
- D1-C (A a mano y B solo como variante en los tests).
- D2-B (referencia armada repitiendo Ctrl+D en el núcleo: un error de Ctrl+D quedaría congelado en la referencia).
- D2-C (referencia dibujada a mano: compararla con el propio dibujo no prueba nada).
- D3-B (sin versión: `.msi` local con un commit `0.1.4-alpha.1` sin tag, llevado por USB).
- D4-A (a mano con F3: no mide el paso de un comando, la revisión por punto de la previa ni el costo de R6).

## 1. Estado verificado (2026-11-16, sobre `9c8ca13`)
- No existen `tests/circuitos/inversion.brn` ni un armado de la inversión en `src/core/circuitos/`. Hay una `inversion()` local en `src/core/model/validaciones.test.ts:107`, sin lámparas.
- `npm run circuito` compara solo contra `marchaParada()` (`tests/circuitos/a-mano.test.ts:38`).
- **El pendiente de `compararRedes` (de T19) no frena el cierre.** Probado con un test temporal, ya borrado:
  - un pulsador NA y uno NC "S1" en la base no tiran y dan 0 diferencias contra sí mismos: `compararRedes` agrupa por etiqueta **y tipo** (`compararRedes.ts:49`);
  - dos NA "S1" sí tiran («la base tiene 2…»), pero R4 ya los marca como aviso: no pueden estar en una base «Sin avisos».
- Ctrl+D sobre la rama de K1 con el NC "K2", por las reglas 4 y 5 de T17 (`docs/archivo/plan-T17.md`, "Regla al pegar y duplicar"): la copia sale S2, K2 (NA), K2 (bobina) y H2, y el NC conserva "K2". R6 lo avisa hasta que se renombra a "K1" (`docs/plan-fase3b.md`, T19).
- Los escenarios de la lista de la netbook existen solo en el banco headless (`tests/bench/pagina.ts`). Ese archivo es un script: al importarlo corre `correr()`, que manda los resultados por `fetch`. El menú de desarrollo aparece en desarrollo y en las prereleases (`BarraSuperior.svelte:120`, `ES_PRERELEASE` de `src/ui/version.ts`) y hoy trae solo el diagnóstico de arrastre. Ctrl+Shift+B cicla las escenas del banco en cualquier build.
- Factor de la netbook con Windows: 2,5 respecto de la PC (`docs/archivo/plan-T16.md`, sección 4: «40 ms en la PC son unos 100 ms allá»).

### Supuestos (a verificar)
- Las listas de K1 y K2 no tapan la otra rama. T18 midió, sin el NC, holguras de 6,58 (lista de K1 contra la copia) y 4,0 (lista de K2 contra la rama de K1) con Ctrl+D a dx = 21 (`docs/archivo/plan-T18.md`, sección 4). El NC suma alto, no ancho. Lo verifican la etapa 1 (cajas) y la 2 (humo).
- La inversión entra con F a 1024×600 y a 1024×530 con los textos legibles.
- `svelte/server` puede renderizar `BarraSuperior` en Vitest con `vi.stubEnv` para el test de la sección 7. Si no, ver la alternativa ahí.
- `0.1.4` se instala encima de `0.1.4-alpha.1` sin desinstalar, como 0.1.3 sobre alpha.11.

## 2. El circuito de referencia (D1-A)

A partir de la marcha-parada (`docs/archivo/plan-T15.md`, sección 3): se intercala el NC "K2" entre S1/K1·14 y la bobina K1, con H1 en paralelo con la bobina, y la rama se duplica para K2, con el NC "K1".

| Rol | Tipo | Etiqueta | Bornes |
|---|---|---|---|
| Fase | `fuente.fase` | L | L |
| Parada | `pulsador.nc` | S0 | 11, 12 |
| Marcha K1 | `pulsador.na` | S1 | 13, 14 |
| Retención K1 | `contactor.auxiliar_na` | K1 | 13, 14 |
| Enclavamiento en la rama de K1 | `contactor.auxiliar_nc` | K2 | 21, 22 |
| Bobina K1 | `contactor.bobina` | K1 | A1, A2 |
| Lámpara K1 | `senalizacion.lampara` | H1 | X1, X2 |
| Marcha K2 | `pulsador.na` | S2 | 13, 14 |
| Retención K2 | `contactor.auxiliar_na` | K2 | 13, 14 |
| Enclavamiento en la rama de K2 | `contactor.auxiliar_nc` | K1 | 21, 22 |
| Bobina K2 | `contactor.bobina` | K2 | A1, A2 |
| Lámpara K2 | `senalizacion.lampara` | H2 | X1, X2 |
| Neutro | `fuente.neutro` | N | N |

**Redes esperadas: 7, con los 24 bornes** (como "etiqueta·borne", la convención de `compararRedes`):

| Red | Bornes | Nombre |
|---|---|---|
| R1 | L·L, S0·11 | "L" |
| R2 (común) | S0·12, S1·13, K1·13, S2·13, K2·13 | — |
| R3 (rama K1) | S1·14, K1·14, K2·21 | — |
| R4 (antes de K1) | K2·22, K1·A1, H1·X1 | — |
| R5 (rama K2) | S2·14, K2·14, K1·21 | — |
| R6 (antes de K2) | K1·22, K2·A1, H2·X1 | — |
| R7 | K1·A2, H1·X2, K2·A2, H2·X2, N·N | "N" |

- No hay bobinas repetidas. Cada contactor tiene un NA y un NC, así que `compararRedes` no tiene contactos repetidos que identificar (el límite de T17b no aplica).
- Listas esperadas: K1 tiene NA 13-14 (rama de K1) y NC 21-22 (rama de K2); K2, NA 13-14 (rama de K2) y NC 21-22 (rama de K1).
- `validar` da cero (R1 a R9).
- **Coordenadas, codos y uniones (fijadas en la etapa 1, `src/core/circuitos/inversion.ts`):** la rama de K1 es la marcha-parada con la bobina, H1 y N 6 unidades más abajo y el NC entre S1 y la bobina. La de K2 está donde la deja Ctrl+D: dx = 21, la misma que en T18.

| Componente | Lugar | Componente | Lugar |
|---|---|---|---|
| L | (0, 0) | S2 | (21, 11) |
| S0 | (0, 5) | K2 (NA) | (31, 11) |
| S1 | (0, 11) | K1 (NC) | (21, 17) |
| K1 (NA) | (10, 11) | K2 (bobina) | (21, 28) |
| K2 (NC) | (0, 17) | H2 | (37, 28) |
| K1 (bobina) | (0, 28) | N (rot. 180) | (0, 39) |
| H1 | (16, 28) | | |

| Cable | De → a | Codos |
|---|---|---|
| w1 a w3, w5 | como en la marcha-parada (L–S0·11, S0·12–S1·13, S0·12–K1·13 por (10, 7), K1·14–S1·14) | |
| w4 | S1·14 → K2·21 (NC) | |
| w6 | K2·22 (NC) → K1·A1 | |
| w7 | K1·A2 → N | |
| w8 | T sobre w6 en (0, 22) → H1·X1 | (16, 22) |
| w9 | T sobre w7 en (0, 34) → H1·X2 | (16, 34) |
| w10 a w13 | los de la copia: S2·14 → K1·21, K2·14 → S2·14, K1·22 → K2·A1, T en (21, 22) → H2·X1 por (37, 22) | |
| w14 | S2·13 → K2·13 | (21, 7), (31, 7) |
| w15 | T sobre w3 en (10, 8) → T sobre w14 en (21, 8) | |
| w16 | H2·X2 → T sobre w7 en (0, 36) | (37, 36) |
| w17 | K2·A2 → T sobre w16 en (21, 36) | |

  10 uniones: S0·12 y S1·14 (bornes con dos cables), S2·14, y las T en (10, 8), (21, 8), (0, 22), (21, 22), (0, 34), (0, 36) y (21, 36). Las listas tienen 1,4 de holgura mínima, contra los cables de su propia bobina, como la rama NC de T18 (mínimo: 1).

## 3. Núcleo y tests (etapa 1)
- **`src/core/circuitos/inversion.ts`**, con la misma forma que `marchaParada.ts`:
  - `inversion()` devuelve `{ doc, historial, comp, cables }` y tiene metadatos fijos («Inversión de giro», 2026-11-16).
  - Se arma solo con comandos (`colocar`, `CambiarEtiqueta`, `cablear`), con codos fijos, y cada cable pasa por `prepararCable`.
- **`inversion.test.ts`:**
  - Las tablas de la sección 2, las 7 redes (por id y como "etiqueta·borne") y las uniones.
  - `validar` vacío y `validarHoja` vacío.
  - Las listas de K1 y K2 (`referencias`), con clase, bornes y coordenadas.
  - La caja de cada lista no toca nada de la otra rama ni de la propia (condición 4 de `docs/archivo/plan-T18.md`, sección 3), con las cajas de `referenciasDuplicar.test.ts`.
  - Deshacer y rehacer todo, y guardar y abrir.
- **Test del procedimiento** (D2-A): desde `marchaParada()`, con los comandos del procedimiento: hacer lugar, intercalar el NC "K2", `recortar` y `pegar` con el etiquetado de Ctrl+D, `CambiarEtiqueta` del NC de la copia a "K1" y los cables de la copia.
  - Comprueba que la copia sale con S2, K2, K2 y H2, y el NC con "K2".
  - Antes de renombrar, R6 avisa ese NC.
  - Al final: `compararRedes` contra `inversion()` da 0 diferencias y `validar` da cero.
- **Archivo congelado:** `tests/circuitos/inversion.mjs` genera `inversion.brn`, igual que `marcha-parada.mjs`, y `inversion.test.ts` lo abre y lo compara con `inversion()`. También fija «nada naranja» (`docs/archivo/plan-T19.md`, sección 3) y las listas (`docs/archivo/plan-T18.md`, sección 9) con el archivo.
- **`npm run circuito`:**
  - Nueva variable opcional `BORNERA_BASE` (`marcha-parada` o `inversion`). Sin ella compara contra la marcha-parada, como hasta ahora (`docs/archivo/plan-T15.md`, sección 5, sigue valiendo).
  - Con un valor desconocido, falla y dice cuáles hay.
  - El mensaje de «pasa» dice contra qué base comparó.
- `documentosDePrueba()` suma «inversión».
- `npm test` y `npm run check` (incluido `check:core`). Sin banco: no toca el dibujo.

## 4. Humo (etapa 2): `tests/humo/cierre3b-inversion.mjs` a 1024×600
- Sigue la lista de pasos de `docs/netbook-fase3b.md` (hoja 2) con mouse y teclado, desde abrir `marcha-parada.brn`. Ctrl+D se hace con la tecla, sobre la rama seleccionada.
- **Comprueba:**
  - La copia sale con S2, K2 y H2 y el NC con "K2", y la barra cuenta el aviso de R6. Después del renombrado, la barra dice «Sin avisos».
  - El `.brn` de Ctrl+S, en Node: `compararRedes` contra `inversion()` da 0 diferencias.
  - Listas de K1 y K2: dos filas cada una. Con el mouse sobre el centro de cada contacto, la barra muestra las mismas coordenadas que la fila. Ninguna caja de lista toca nada de las ramas.
  - F a 1024×600 y a 1024×530, con el panel plegado y abierto: entra entero.
  - Un paso de deshacer por gesto.
- Guarda capturas (`--capturas`) para que Bruno vea las listas.
- **Si aparece una traba** (W rechaza sin explicar, una lista tapa algo, no entra con F), se frena y se presentan opciones.
- Al cerrar: `npm run humo` entero.

## 5. Lista de pasos para Bruno
Está en `docs/netbook-fase3b.md`, hoja 2. Al planear es un borrador: la etapa 2 la confirma con el humo (orden, dónde hacer lugar, cómo reconectar H1) y la deja lista para imprimir.

## 6. Banco contra `v0.1.3` (etapa 3) — criterio fijado antes de medir (ajuste 1)

**Método** (el de T16 a T19):
- Worktree `..\bornera-base-v0.1.3` sobre `v0.1.3` (después de `git fetch --tags`), con su propio `npm ci` y **su propio banco**. Los escenarios nuevos solo existen en HEAD.
- PC enchufada, modo "Mejor rendimiento", sin apps con ventana salvo Claude. El script anota las condiciones en cada corrida.
- ABBA ×3 en dos tandas: 6 corridas por versión en cada tanda y, por celda, la mediana de las 6, sin redondear. Los lentos se suman (D13-B).
- Al terminar se borra el worktree (`git worktree remove` y `prune`).

**Cómo se juzga:**
1. **Las filas de las tablas 6.1 y 6.2 se juzgan por su tope absoluto, no por el 10 %.** Una fila no pasa si supera su tope en las dos tandas (la misma regla de repetición que las subas). Si lo supera en una sola, se informa.
2. **El resto de las celdas comunes, con la regla de siempre:** no pasa si sube más de 10 % en las dos tandas (mediana o p95 por cuadro), o si aparece un lento donde `v0.1.3` tiene 0.
3. **Frena solo una suba que no esté en esas listas**, o una fila de las listas que supere su tope. Se frena y se presentan opciones antes de optimizar.

### 6.1 Costos ya aceptados en celdas comunes
El tope de las celdas aceptadas como ruido es lo que Bruno aceptó: el valor más alto de HEAD en las tandas con que se aceptó, más max(10 %, 0,1 ms), redondeado hacia arriba a centésimos. Los valores están en `docs/bench.md`. Lo que no figura en la fila (otra métrica) sigue la regla de siempre.

| Celda | Tarea · commit | Qué se aceptó | Tope absoluto (PC) |
|---|---|---|---|
| 100 · Seleccionar al 31 % | T16 · `4b8d008`; T17 · `0b86506` | resolución del reloj (T16) y ruido contra `d969019` (T17): HEAD 0,60 / 1,05 | mediana ≤ 0,70, p95 ≤ 1,16; 0 lentos |
| 100 · Mover 1 al 31 % | T16 · `4b8d008` | resolución del reloj: HEAD 0,35 / 1,05 | mediana ≤ 0,45, p95 ≤ 1,16; 0 lentos |
| 100 · Mover todo al 31 % | T17 · `0b86506` | ruido contra `v0.1.3`: HEAD 0,80 / 1,95 | mediana ≤ 0,90, p95 ≤ 2,15; 0 lentos |
| 100 · Arrastrar 40 completos al 58 % | T17 · `0b86506` | ruido contra `v0.1.3`: HEAD 1,50 / 3,70 | mediana ≤ 1,65, p95 ≤ 4,07; 0 lentos |
| 500 · Arrastrar 40 en contornos al 58 % | T17 · `0b86506` | ruido contra `v0.1.3`: HEAD 0,60 / 2,70 | mediana ≤ 0,70, p95 ≤ 2,97; 0 lentos |
| 500 · Mover todo al 31 % | T18 · `03d45d8` | ruido (diagnóstico de 10 pares): HEAD 1,55 / 3,85 | mediana ≤ 1,71, p95 ≤ 4,24; 0 lentos |
| 2000 · Editar al 100 % | T18 · `03d45d8` | ruido (diagnóstico de 10 pares): HEAD 0,45 / 0,85 | mediana ≤ 0,55, p95 ≤ 0,95; 0 lentos |
| 500 · Encuadrar (F) | T17 · `0b86506` (mediana que salta entre ~2 y ~6 ms); T19 · `87de3a7`, dibujado desde `5beec87` (contornos de etiqueta, cambio 9) | mediana de HEAD hasta 6,05; p95 hasta 9,30 y +0,8 ms por gesto en la corrida de control | mediana ≤ 6,66, p95 ≤ 10,23, por gesto ≤ 8,74; 0 lentos |
| 2000 · Editar al 31 % | T19 · `edd2c03` | p95 de HEAD hasta 1,10 (diagnóstico: ruido) | p95 ≤ 1,21; 0 lentos |
| 2000 con cables · Desplazar al 100 % | T19 · `edd2c03` | p95 de HEAD 0,35 (diagnóstico: ruido) | p95 ≤ 0,45; 0 lentos |
| 2000 con cables · Arrastrar 40 cableados al 58 % | T19 · `edd2c03` | un lento de 39,1 ms en una corrida (diagnóstico: ruido) | lentos en como mucho 1 de las 6 corridas de cada tanda y ninguno de más de 50 ms |
| 2000 con cables · Girar todo al 31 % | T19 · `edd2c03` | un lento de 16,4 ms en una corrida; la base también los tiene | ídem |

### 6.2 Escenarios nuevos (no existen en `v0.1.3`)
Solo HEAD. Cada uno con el tope absoluto que fijó su tarea.

| Escenario (escena con cables, al 31 %) | Tarea · commit | Tope absoluto (PC) |
|---|---|---|
| Pegar 500 y deshacer | T16 · `4b8d008` | paso y deshacer: mediana ≤ 40 ms, máx. ≤ 80 ms; 0 lentos (también en los cuadros que siguen, T19 · `edd2c03`) |
| Duplicar todo (2000) y deshacer | T16 · `4b8d008` | paso: mediana ≤ 150 ms, máx. ≤ 300 ms; deshacer: mediana ≤ 40 ms, máx. ≤ 80 ms; 0 lentos (también en los cuadros que siguen) |
| Previa de pegar N (40 a 500) | T16 · `4b8d008` | cuadro: mediana ≤ 4 ms, p95 ≤ 8 ms; 0 lentos. Revisión por punto: p95 ≤ 5 ms hasta N = 160 (`TOPE_PREVIA_PEGAR`) |
| Copiar 2000 | T16 · `4b8d008` | se informa |
| Etiquetar los vacíos (2000) y deshacer | T17 · `0b86506` | cada paso: mediana ≤ 40 ms, máx. ≤ 80 ms; 0 lentos |
| Rehacer al 31 % con referencias | T18 · `03d45d8` | por gesto ≤ 25,01 ms (el tope de T18); 0 lentos |
| Mover 1 contacto con referencias al 31 % | T18 · `03d45d8` | paso ≤ 1,80 ms; 0 lentos |
| Rehacer al 31 % con avisos | T19 · `edd2c03` | por gesto ≤ 26,11 ms (el tope de T19); 0 lentos |
| Dibujar 1 cable con 2000 y un par NC+bobina | T19 · `edd2c03` | R6: p95 ≤ 3 ms, máx. ≤ 8 ms; 0 lentos |

- El sha256 de `ESCENA_ACTUAL` no cambia (`banco.test.ts`, en `npm test`).
- Resultado en `docs/bench.md` («Cierre de la fase 3b, contra `v0.1.3`») y en la nota de Obsidian «Medición 0.1.3-dev (cierre 3b) - PC Ryzen 7».

## 7. «Probar la fase 3b» (etapa 4, D4-B y ajuste 2)
- **Los escenarios se importan, no se copian:**
  - `tests/bench/pagina.ts` se parte en dos. Un módulo sin efectos al cargarse, `tests/bench/escenarios.ts`, con `medir`, la escena con cables en un `Editor` y las listas de escenarios. Y el arranque del banco (`correr()` y el envío por `fetch`), que se queda en `pagina.ts` y la importa.
  - El banco sigue midiendo lo mismo: los mismos escenarios, en el mismo orden y con los mismos nombres. Lo comprueba una corrida antes y después del cambio.
- **`src/ui/probarFase3b.ts`:**
  - Importa ese módulo con `import()` dinámico, así no se carga si no se usa.
  - Corre, en un lienzo fuera de pantalla de 1366×768, la lista de la netbook: Pegar 500, Duplicar todo (2000), la serie de la previa de pegar con su revisión por punto, Rehacer y Mover 1 contacto con referencias, Dibujar 1 cable con el par NC+bobina y Encuadrar (F) con 500.
  - Arma una tabla para copiar, con el tope de netbook de cada fila y «pasa» o «no pasa».
  - Para el criterio de los cuadros que siguen a pegar y duplicar, `medir` informa además el máximo de lentos por gesto: es un campo nuevo, que también ve el banco.
- **Menú de desarrollo:** botón «Probar la fase 3b», junto a «Probar arrastre». Aparece donde aparece el menú, en desarrollo y en las prereleases, y nunca en una versión final.
- **Tests:**
  - **Reusa, no copia:** las listas que corre «Probar la fase 3b» son los mismos objetos que exporta `tests/bench/escenarios.ts` (identidad, `toBe`), y los nombres coinciden con las filas de la tabla de la netbook. Ningún archivo de `src/` define funciones de escenario: un test busca en el código fuente los nombres de las funciones del módulo del banco.
  - **Solo en prereleases:** `BarraSuperior` renderizado con `svelte/server`, con `vi.stubEnv` de `DEV` en falso y la versión simulada. Con `0.1.4` no aparece el botón; con `0.1.4-alpha.1`, sí. Si `svelte/server` no anda en este Vitest, la condición pasa a una función pura (`mostrarMenuDesarrollo(version, dev)`), con su test, y el humo comprueba el botón en desarrollo.
  - **Humo:** en `npm run dev`, el botón existe y una corrida corta llena la tabla.
- **Límite:** en la versión final, el código del banco queda en el instalador como un archivo aparte que nunca se carga. Evitarlo pide una constante de compilación en `vite.config`; se deja así salvo que Bruno prefiera lo contrario.

## 8. Netbook (etapa 6)
- Checklist completa, con el tope de netbook de cada criterio: `docs/netbook-fase3b.md`.
- La hoja 2 (los pasos) se confirma en la etapa 2.
- Se imprime después de la etapa 4, cuando está la tabla de «Probar la fase 3b».
- Los topes que no fijó Bruno salen del factor 2,5 de T16. Los que estaban como «propuesto» (B7, B10, B12 y B13) los confirmó Bruno el 2026-11-16 y están como «confirmado».

## 9. Etapas
Cada etapa cierra con `npm test`, `npm run check` y commit local. Si toca algo visible, también con `npm run humo`. Sin push.

| Etapa | Qué | Modelo sugerido |
|---|---|---|
| 0 | Docs: este plan, `docs/netbook-fase3b.md`, `docs/ideas.md` y el puntero en `docs/plan-fase3b.md` | Sonnet |
| 1 | Núcleo y tests (sección 3) | Opus alto |
| 2 | Humo y lista de pasos final (sección 4) | Opus alto |
| 3 | Banco contra `v0.1.3` (sección 6) | Opus alto |
| 4 | «Probar la fase 3b» (sección 7) | Opus alto |
| 5 | Versión `0.1.4-alpha.1` con la skill `bornera-release`; tag y push con autorización | Opus alto |
| 6 | Netbook (Bruno), con la checklist; yo paso los números a la nota | Sonnet |
| 7 | Cierre: `0.1.4` (tag, push y release con autorización), `docs/plan-fase3b.md`, `docs/arquitectura.md` (fase 3b cerrada), Obsidian | Sonnet |

### Etapa 0 hecha (2026-11-16)
Este plan, `docs/netbook-fase3b.md` (checklist con topes de netbook y borrador de los pasos), `docs/ideas.md` y el puntero en `docs/plan-fase3b.md`. Sin código.

### Etapa 1 hecha (2026-11-16)
- **Commit aparte:** `testTimeout` de 20 s en `vite.config.js` y los topes B7, B10, B12 y B13 confirmados (B2 ya tenía origen propio). Causa probable del fallo intermitente de la etapa 0: el tope por defecto de Vitest (5 s) dejaba ×1,07 al recorrido de 1000 operaciones de `referencias.test.ts` (4,7 s). Otros 11 tests sin tope propio tenían menos de ×3. Los topes que se sospechaban tenían margen: `TOPE_COMPARAR_MS`, ×12, y `LIMITE_MS`, ×6,5.
- `src/core/circuitos/inversion.ts` y `inversion.test.ts`: tablas, 7 redes, 10 uniones, `validar` y `validarHoja` vacíos, listas con clase, bornes y centro, deshacer y rehacer, y guardar y abrir.
- **Cambio de lugar:** las cajas de las listas no están en `inversion.test.ts`, porque `src/core` no puede importar `render/`. Están en `src/editor/inversionProcedimiento.test.ts`, con las de `referenciasDuplicar.test.ts` pasadas a `src/editor/prueba-cajas.ts`, y se comprueban en la referencia y en lo que da el procedimiento.
- **Test del procedimiento** (`src/editor/inversionProcedimiento.test.ts`): Ctrl+D es `editor.accion("duplicar")`, la misma función que la tecla (pedido de Bruno al aprobar). Lo demás va por Mover, borrar, Colocar (con su revisión de lugar), `cambiarEtiqueta` del editor y W (`prepararCable`). La copia sale en el mismo lugar que la rama de K2 de `inversion()`.
- **Mutantes:** con `etiquetarLote` reemplazado (sin renumerar; el NA de la copia que no sigue a su bobina; la etiqueta del NC contada como usada, que da K3), las comprobaciones de la copia y `compararRedes` fallan, y lo anterior a Ctrl+D pasa igual. Probado además a mano con la copia sin renumerar en `ArmarEtiquetas.pegado`: fallan 3 tests. Se revirtió.
- **Hallazgos para la hoja 2** (ya corregidos ahí; la etapa 2 los confirma con el humo):
  - Borrar solo S1·14–A1 deja el cable de la T de H1 con un extremo suelto en (0, 16), donde va el NC: hay que borrar los dos.
  - Al colocar el NC, la barra cuenta 5 avisos, no 1: R2 del NC y R7 de A1, H1·X1, NC·21 y NC·22.
  - Después de Ctrl+D también son 5: R6 del NC de la copia y R7 de S2·13, K2·13, K2·A2 y H2·X2. Al renombrar el NC, R6 se va y quedan los 4 R7 hasta cablear.
- `tests/circuitos/inversion.mjs` e `inversion.brn` (704 bytes), y su test: abre igual, 0 diferencias, «nada naranja» y las listas. `marcha-parada.brn` regenerado sale idéntico.
- `npm run circuito` con `BORNERA_BASE`, probado: con las dos bases pasa, con la marcha-parada contra la inversión falla, y con `otra` dice cuáles hay. `documentosDePrueba()` suma «inversión».
- `npm test`: 1775 tests (1 salteado, el de `npm run circuito`). `npm run check` limpio. Sin humo ni banco: no cambia nada visible.

## 10. Necesita autorización de Bruno
- Push de `main` (6 commits adelante al planear, más los del cierre).
- Tag `v0.1.4-alpha.1` y su push (el workflow crea la prerelease).
- Tag `v0.1.4`, su push y la release.
- Dar la fase 3b por cerrada: depende de la prueba en la netbook.
- Cualquier dependencia nueva. No espero ninguna.

## 11. Riesgos
- **Listas que tapan la otra rama o W que rechaza un cable** en el procedimiento. El humo lo encuentra antes de la netbook. Si pasa, se frena con opciones: otro lugar para el NC, otro desplazamiento, otra separación.
- **El dibujo de Bruno no es el de la referencia.** Se comparan redes, no geometría: valen otras posiciones, T en vez de bornes con dos cables y otro orden.
- **Olvidarse de renombrar el NC de la copia.** Lo marcan dos cosas: R6 en la barra y `compararRedes` («Falta "K1" (contactor.auxiliar_nc)…» y «Hay 2 "K2"…»).
- **Ruido del banco.** Las celdas aceptadas tienen tope absoluto. Una suba nueva que se repita frena y se diagnostica como en T18 y T19 (ABBA ×5, reglas fijadas antes de medir).
- **El banco partido en dos (etapa 4)** podría cambiar lo que mide. Por eso la etapa 3 mide antes de partirlo, y la etapa 4 comprueba que salgan los mismos escenarios y nombres.
- **El tope 160 de la previa en la netbook.** Si la revisión por punto pasa su tope, `TOPE_PREVIA_PEGAR` se revisa con Bruno. La primera salida está en `docs/archivo/plan-T16.md`, sección 7.
- **WebKitGTK (Mint):** secundario, no bloquea.

## 12. Fuera de este cierre
- Pulsadores de doble contacto en la inversión (D1-B) y `compararRedes` con pulsadores repetidos del mismo tipo.
- Número de orden de los auxiliares (tarea aparte, `docs/plan-fase3b.md`).
- Optimizar *Encuadrar (F)* con 2000 (prioridad baja desde T15).
- Los opcionales de T18 y T19: clic para ir al contacto o a la bobina, lista de avisos desde la barra.
