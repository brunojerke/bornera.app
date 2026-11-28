# T40 — sensores, presostato, termostato, electroválvulas, motor DC y diferencial 3P

**Aprobado por Bruno el 2026-11-27**, con D-T40-1 a D-T40-5 en A y 4 ajustes (incluidos). Base `5aeec6a` (T39 cerrada, 38 símbolos). Sigue `docs/plan-biblioteca2.md` (D-B1 a D-B13; D-B3 A, D-B4 A, D-B5 A, D-B12 A). Sin push, tag ni publicación.

## Símbolos (38 → 49)
| # | tipo | Pref. | Subgrupo | Netlist |
|---|---|---|---|---|
| 39 | `proteccion.diferencial_tripolar` | Q | Protección | polos 1-2, 3-4, 5-6, siempre cerrados; sin «N» |
| 40–42 | `sensor.inductivo`, `.capacitivo`, `.fotoelectrico` (PNP) | B | Sensores | carga BN-BU + polo NA BN-BK, enclavado (D-B3 A) |
| 43–46 | `sensor.presostato_na`/`_nc`, `sensor.termostato_na`/`_nc` | B | Sensores | como el final de carrera (D-B4 A) |
| 47 | `valvula.monoestable` | Y | Actuadores | carga A1-A2; accionada con tensión |
| 48 | `valvula.biestable` | Y | Actuadores | cargas A1-A2 (14) y B1-B2 (12); memoria (D-B5 A) |
| 49 | `motor.continua` | M | Cargas | carga A1-A2 (giro y polaridad, 6b) |

## Pasos
1. `docs/plan-T40.md`; en `plan-biblioteca2.md`, avance y la nota de C1.
2. `symbols/tipos.ts`: `SUBGRUPOS` + `sensores`, `actuadores` (12); campo `valvula` (D-T40-2 A).
3. `symbols/validar.ts`: dibujo accionado también en válvula; `valvula` pide `carga`, 1 o 2 cargas y dibujo accionado; un borne de contacto fuera de polo, si está en una carga (BU).
4. `symbols/biblioteca.ts`: los 11 (`diferencial` con N opcional); `ui/paleta.ts`: Sensores tras Entradas, Actuadores tras Bobinas.
5. `sim/netlist.ts`: cargas también de contactos (sensor); `bornes` (el par de la definición, sin copiar) en polos y cargas, `enPolo` en cargas; `valvulas`.
6. `sim/motor.ts`: `posiciones` por válvula, aviso `dos_bobinas`; «otros» por borne (`enPolo`). `prueba-motor.ts`: lo mismo, escrito aparte (la serie por nombre de borne).
7. `model/validaciones.ts`: R5 suma B «sensor» e Y «electroválvula».
8. `editor/dibujoSimulacion.ts`: EV accionada según su posición, sin relleno (D-T40-1 A).
9. Tests, humo, banco, `arquitectura.md`, `bench.md`.

## Estado de la EV biestable
En `Simulacion.posiciones` (motor, no documento: sin Comando ni historial). Se toma del estado final de cada operación solo si es estable: **detenida (oscila, tope o corto) queda la última estable** (ajuste 2 pide oscila; tope y corto, por la misma regla). Con A sola pasa a 14; con B sola, a 12; sin ninguna o con las dos queda donde estaba, y con las dos avisa «Y1 con las dos bobinas» una vez por entrada (D-T40-4 A). Cada entrada arranca en 12 (D-T40-3 A). No entra en la clave de oscilación (no mueve contactos). Azar: el oráculo modela lo mismo; lote nuevo semilla 40. Corpus: sin cambios.

## Sin BU y sin etiqueta
- Sin BU: entra; el clic conmuta BN-BK (límite §3 del plan, 6b); la carga BN-BU no se enciende; en Editar R7 avisa el borne.
- Sin etiqueta: R3 avisa y entra; clic y posición por componente; «Electroválvula sin etiqueta con las dos bobinas».

## Tests nuevos
- **Ajuste 1, no regresión** (`tests/circuitos/no-regresion-T40.test.ts`): netlist (redes, potenciales, polos, cargas, bobinas) y motor (cada paso) de los 38 de antes, igual que en `5aeec6a`: corpus `formato-v1/` y `.brn` de referencia, un circuito con contactos y cargas en serie, 150 circuitos al azar con los 38 tipos (semilla 405) y los tres lotes de `motor-azar` (30, 34, 36). Instantáneas (una huella por circuito) escritas con `5aeec6a` antes de tocar el código.
- **Ajuste 3:** el diferencial 2P y el 4P dibujan igual que en `5aeec6a` (instantánea de primitivas, reposo y accionado, bornes, polos y caja).
- Bornes de los 11 + `validarDefinicion`; `valvula` y borne en polo y carga en `validar.test.ts`.
- `sim/sensoresValvulas.test.ts`: netlist de cada tipo; circuito de la sección 0 del plan; presostato NC; sin BU; serie con sensor (BN una vez); memoria de la biestable, las dos bobinas, reentrar, **ajuste 2 (oscila: queda la última estable)**, monoestable, sin etiqueta; R3, R4, R5.
- `editor/dibujoSimulacion.test.ts`: EV accionada sin relleno; sensor accionado y relleno.
- Azar T40 (semilla 40): sensores, presostato, termostato, EV, motor DC y diferencial 3P; cubre «vuelve a 12», «dos bobinas» y «quieta al detenerse».
- Humo `t40-sensores-actuadores.mjs`.

## Medición (fijada antes de medir)
- ABBA `--fase6 --base-fase6`, A = T40, B = exe de `5aeec6a` (worktree).
- Regla vigente de `plan-fase6.md` §4: B1–B16 D6b-C; F por tope; S por tope y no regresión (S1, S4 solo tope); P1 con 49 solo por tope (mediana ≤ 9,1; máx. ≤ 10,1; D-B13); P2 A ≤ B + máx(1 ms, 10 %).
- `netlist-node`: A ≤ B + máx(1 ms, 10 %) con B en `5aeec6a`; 5 ms solo informa.
- Frías informan. Una corrida cortada sin filas juzgadas se repite una vez; si una fila falla, freno y consulto.
- Pueden moverse: P1, P2, S1, S6.

## Decisiones (Bruno, 2026-11-27)
| # | Elegida | Qué |
|---|---|---|
| D-T40-1 | A | EV sin relleno: la posición la da el dibujo accionado |
| D-T40-2 | A | Campo `valvula: "monoestable" \| "biestable"` en la definición |
| D-T40-3 | A | Cada entrada arranca en 12 (reposo) |
| D-T40-4 | A | Con las dos bobinas queda donde estaba, más el aviso |
| D-T40-5 | A | Válvula 5/2 sin vías numeradas |
| Ajuste 1–4 | — | No regresión de los 38; biestable quieta al oscilar; diferenciales 2P/4P iguales; nota de C1 y EV 3/2 a `ideas.md` |

**Descartadas:** D-T40-1 B, un cuerpo por carga en la escena; D-T40-2 B, la netlist sabría de dibujo; D-T40-3 B, estado fuera del documento entre entradas; D-T40-4 B, la real no se mueve; D-T40-5 B, la 3/2 va aparte (`ideas.md`).

## Estado (2026-11-27)
Checkpoint sin banco: tests y check en verde. El ABBA se cortó dos veces («Probar la fase 6» no terminó a tiempo), sin filas juzgadas. Diagnóstico aparte (no es medición): de 23 corridas visibles, 4 quedaron en «F1: copia de una vez 1 de 3», en A y en B; `copiarPorPartes` espera un ocio ≥ 40 ms sin tope y los ratos de ocio eran de 0 a 7 ms (pantalla de 144 Hz). El arreglo va como tarea aparte; después, el ABBA y `netlist-node` con las reglas de arriba.

**Cerrada (2026-11-27).** Arreglo en `8ad3886` (plazo de 1 s). ABBA `--fase6 --base-fase6`: A = `8ad3886`, B = `5aeec6a` + cherry-pick del arreglo; las 12 aperturas terminaron sin repetición. **Pasa:** B1–B16 igual (B2 2.º sube e informa: decide B2 1.º, 10,2 → 11,1); F, S1–S6, P1 (mediana 0,5, máx. 0,7) y P2 (143,4 ≤ 155,6). `netlist-node`: máx. A 6,31 ≤ B 5,76 + 1. Detalle en `docs/bench.md`. Pendiente que informa: en 3 aperturas de B la copia de una vez salió por plazo y esas corridas tardaron unos 100 s más; no se explicó.
