# T39 — fuentes G y trafos T

**Aprobado por Bruno el 2026-11-27**, con ajustes (incluidos). Base `8a1a695` (= código de `5f8a529` + docs). Sigue `docs/plan-biblioteca2.md` (D-B1 a D-B13). Sin push, tag ni publicación.

## Símbolos (32 → 38)
| # | tipo | Pref. | Entrada (carga) | Salida (papel) |
|---|---|---|---|---|
| 33 | `fuente.continua` (12/24 V dibujado) | G | — | L+ fase, M neutro |
| 34 | `fuente.variable` | G | — | V+ fase, V- neutro |
| 35 | `fuente.conmutada` | G | L-N; PE sin papel | +V fase, -V neutro |
| 36 | `transformador.monofasico` | T | 1U1-1U2 | 2U1 fase, 2U2 neutro |
| 37 | `transformador.trifasico` | T | 1U 1V 1W: no (D-B11) | 2U 2V 2W fase, 2N neutro |
| 38 | `transformador.variac` (flecha) | T | 1U1-1U2 | 2U1 fase, 2U2 neutro |

G en Alimentación; T en Transformación (Potencia). Los 6: `elemento: "carga"`, `cargas` explícito (vacío en 33, 34, 37) y `salida`; titulares.

## Pasos
1. `docs/plan-T39.md` con este plan.
2. `symbols/tipos.ts`: `cargas?`, `salida?`, `cargasDe()`; `SUBGRUPOS` + `transformacion`.
3. `symbols/validar.ts`: bornes de `cargas`/`salida` existen y no se pisan; `salida` pide prefijo.
4. `symbols/biblioteca.ts`: los 6; `ui/paleta.ts`: Transformación tras Fuentes.
5. `sim/netlist.ts`: potencial = papel + «etiqueta.borne»; sin etiqueta, ninguno; `cargas` manda sobre la regla de 2 bornes.
6. `sim/prueba-netlist.ts` (oráculo del corpus): lo mismo.
7. `model/redes.ts`: red «G1.L+» (`compararRedes`, R6); `editor/avisosHoja.ts`: R6 en vivo igual.
8. `model/validaciones.ts`: R5 suma G «fuente» y T «transformador».
9. Tests, humo, banco; D-B9 a `arquitectura.md` como límite general (ajuste 1), sin test que lo fije.

## Tests nuevos
- Bornes de los 6 (nombre, grilla, papel); `validar` rechaza `salida` sin prefijo o con borne inexistente.
- Dos continuas G1 y G2: «G1.L+» y «G2.L+», dos potenciales y dos redes.
- T1 con primario en L/N: 2U1 no se une con L ni N; cablear 2U1 a L da corto.
- Carga en el secundario de T1, T2 (2U-2N), T3 y en la salida de G1, G2, G3 enciende sin tensión en la entrada (D-B2; ajuste 3).
- Entrada de 35, 36 y 38 es carga; 37 no; PE no da potencial.
- Sin etiqueta (ajuste 4, B): un G o un T entra a Simular, su salida no da potencial, la carga no enciende y R3 está presente. Sin reglas ni severidades nuevas.
- Renombrar G1 a G5: la red pasa a «G5.L+» y R6 en vivo se recalcula (ajuste 3).
- R4: dos G1 y dos T1 dan error y no entran a Simular.
- R5 con G y T; R6 con red nombrada por una salida; corpus del oráculo.
- Al cerrar: `npm test`, `npm run check`, `cargo test`.

## Medición (fijada antes de medir)
- ABBA `--fase6 --base-fase6` en una sesión; A = T39, B = exe de `8a1a695` (worktree).
- B1–B16: D6b-C (mediana caliente ≤ 1 ms o ≤ 10 %, lentos ±1, B9 mismo escalón, B2 por mediana). F por tope.
- S1–S6: mediana ≤ tope, máx ≤ tope + máx(1 ms, 10 %); no regresión A ≤ B + máx(1 ms, 10 %), salvo S1 y S4.
- P1 solo tope (D-B13): mediana ≤ 9,1, máx ≤ 10,1. P2: A ≤ B + máx(1 ms, 10 %).
- `netlist-node`: no regresión A ≤ B + máx(1 ms, 10 %); el tope de 5 ms solo informa (la base da hasta 6,6 ms; ajuste 2).
- Frías informan. Si una fila falla, freno y consulto sin volver a medir.
- Pueden moverse: P1 (6 más), P2 (6 canvas tras el primer cuadro), S1 y S6 (netlist). B, F, S2–S5: no.

## Humo
- `t39-fuentes-trafos.mjs`: los 6 desde la paleta (G1–G3, T1–T3); G1 → H1: enciende; T1 en L/N → H1 en 2U1/2U2: enciende; dos G1: no entra.
- t07, t17b, t37, t38: 32 → 38 (de `SIMBOLOS.length`). `npm run humo` completo.

## Decisiones (Bruno, 2026-11-27)
| # | Elegida | Qué |
|---|---|---|
| D-T39-1 | A | Borne negativo en ASCII: `V-`, `-V` (el `.brn` queda ASCII y se escribe en etiquetas) |
| D-T39-2 | A | Una Fase o Neutro «T1.2U1» se une a esa salida (clave papel + nombre, D7) |
| D-T39-3 | A | 2U2 y 2N son neutro, como N |
| Ajuste 4 | B | G o T sin etiqueta entra a Simular sin potencial; R3 avisa |

## Resultado (2026-11-27)
- **Hecho:** los 6 símbolos (38 en total, subgrupo Transformación), `cargas`/`salida`/`cargasDe`, netlist y oráculo, nombres de red en `redes()` y en R6 en vivo, R5 con G y T. Sin reglas nuevas ni severidades cambiadas.
- **Tests:** 2760 (`fuentesPropias.test.ts`, bornes de los 6, `validarDefinicion` de cargas y salida, R6 en vivo al renombrar G1 → G5). `npm run check` sin errores; `cargo test` 7/7.
- **Humo:** `t39-fuentes-trafos.mjs` 31/31. t07, t17b, t37 y t38 cuentan con `SIMBOLOS.length`; t38 y `paleta.test.ts` buscan «osciloscopio» para «sin coincidencias» (con T39, «transformador» coincide).
- **Banco:** ABBA contra `8a1a695` pasa (P1 0,5 ms, P2 143,3 contra 141,6, S6 18,3, B «nada sube», F pasa). `netlist-node` pasa la no regresión (7,6 contra 7,1 + 1). El primer ABBA se cortó por una corrida de B que pasó los 240 s, sin filas juzgadas; se repitió una vez. Detalle en `docs/bench.md`.
- **`.brn`:** el formato no cambia de versión (sigue en 1: los tipos nuevos son datos). La 0.1.6 abre un `.brn` con un G o un T sin cables con «?» y un aviso, y rechaza el archivo si alguno tiene cables en sus bornes («no está en la biblioteca y tiene cables en sus bornes»).
- **Pendiente:** T40 y C1. D-B9 sigue como límite conocido hasta 6b.

**Descartadas:** D-T39-1 B, no se tipea; D-T39-2 B, más código; D-T39-3 B, agranda D-B9; ajuste 4 A, R3 con dos severidades.
