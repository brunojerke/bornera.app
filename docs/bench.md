# Banco de dibujado

Resultados de `npm run bench`: tiempo de dibujado de las escenas de prueba con 100, 500 y 2000 símbolos al azar (siempre la misma semilla, así las corridas se pueden comparar). Se corre al final de cada fase, en esta PC y en la netbook.

## Cómo se mide

- Lienzo de 1366×768 (pantalla típica de netbook), dpr 1.
- El navegador es un Chrome, Chromium o Edge headless, que dibuja con el mismo código de la app (`src/render/capas.ts`). Sin GPU (`--disable-gpu`): rasterizado por software, más parecido a una netbook.
- Cada escenario es un **gesto** que se repite (más una repetición de calentamiento): los cuadros del gesto, uno cada 16,7 ms, y después la **cola**, los cuadros que la app sigue pidiendo sola hasta quedar nítida (mosaicos pendientes, o la espera de 150 ms después del zoom). El reloj es simulado: las esperas se saltan, no se duermen.
- Cada cuadro fuerza el rasterizado de la pantalla (`getImageData` de un píxel), así se mide el dibujo real y no solo el registro de las órdenes. Los mosaicos los rasteriza `Capas` al terminar cada uno (ver abajo).
- Columnas: mediana, p95 y máximo por cuadro; **Lentos** = cuadros de más de 16 ms (⚠ si hay alguno); **Por gesto** = suma de todos los cuadros del gesto, hasta quedar nítido.
- Escenarios:
  - *Rehacer al 100 %* y *Rehacer al 31 %*: con la vista quieta, se invalida la capa estática (contenido o colores nuevos). Al 31 % se dibujan textos y bornes (6,2 px por unidad): es el peor caso medido en la netbook.
  - *Encuadrar (F)*: salto del 100 % al encuadre de toda la escena.
  - *Zoom con la rueda*: ocho pasos de rueda seguidos, del 100 % al 30 %.
  - *Desplazar al 100 %*: ida y vuelta de a 6 px, sin salir de lo dibujado.
  - *Arrastre al 31 %*: 100 cuadros de 16 px (960 px/s), saliendo una y otra vez de lo dibujado.
- `npm run bench -- --comparar` mide además sin caché de textos y sin ninguna optimización.
- `npm run bench -- --escena-012` arma las escenas de 100, 500 y 2000 con los 5 símbolos de 0.1.2 (ver T15 en `docs/archivo/bench-historial.md`). Las comparaciones contra 0.1.2 usan esta opción.
- Al final, el banco mide la copia de recuperación con 2000 + 3030 cables (F1 de T23), con la misma medición que «Medir la copia (F1)». En Chrome es informativa: F1 se juzga en WebView2 (`tests/bench/f1-webview2.mjs`).
- **Escena oficial nueva desde `codosBanco` (2026-11-22).** La escena con cables (2000 + 3030) se tiende entera como W: 0 conexiones aparentes (antes 10 250) y ningún cable entra por el cuerpo (antes 1670). La usan B1–B14, B16, F1–F3 y S5, `npm run bench` (escenarios con cables), F1 de T23 y los `*-node.mjs`. **Un ABBA de un commit desde este contra uno anterior no compara la misma escena: se juzga con el criterio J-A** (`docs/plan-codosBanco.md`): B15 y S1–S4 con la regla de siempre (son el control); las filas con la escena, solo por su tope en A, y A − B informa.

## Cierre de la biblioteca 2 (C1): ABBA final contra 0.1.6 — 2026-11-28

**Criterio escrito antes de medir** (`docs/plan-C1-biblioteca2.md`, «Medición»; las reglas de `docs/plan-T40.md`, sin cambios): ABBA en WebView2 (`probar-webview2.mjs --fase6 --base-fase6`, 3 bloques, fría + caliente). B1–B16 con D6b-C (B2: decide 1.º); F por tope; S1–S6 por tope y no regresión (S1 y S4 solo tope); **P1 solo por tope** (mediana ≤ 9,1, máx. ≤ 10,1; B dibuja 32); P2 y `netlist-node`: A ≤ B + máx(1 ms, 10 %), el tope de 5 ms solo informa. Frías informan. Timeout o fila que falla: «no pasa» y se consulta, sin repetir.

**Cómo se midió:** A = `a4400f9` (biblioteca 2 completa: T39 + T40 + el plazo de la copia de una vez), `0.1.6-c1a.1` solo en `package.json` durante el build (`tauri build --no-bundle`), revertida y árbol limpio verificado antes de seguir; se midió antes de programar la base de C1 (D-C1-2 A). B = `5f8a529` (la 0.1.6 publicada) + cherry-pick de `8ad3886` (`6fe5600`, entró limpio), `0.1.6-c1b.1`, en un worktree temporal con `npm ci` (borrado después de medir). Así se mide la biblioteca 2 entera contra la 0.1.6, con el arreglo en los dos. Edge 158, de 07:14 a 07:23 (hora local). Condiciones confirmadas por Bruno antes de medir (enchufada, «Mejor rendimiento», LegionSpace en Performance; cerrados Administrador de tareas, Configuración y Edge; LegionSpace y el overlay de NVIDIA abiertos); antes de medir se leyó CA, el modo `ded574b5…` (Mejor rendimiento) y ninguna Bornera abierta. Las 12 aperturas terminaron (39–43 s), sin timeout ni repetición.

**Resultado: pasa.** B1–B16 «igual», salvo B2 2.º, que sube e informa (regla de B2: decide B2 1.º, igual); F, S1–S6, P1 y P2 pasan; `netlist-node` pasa la no regresión.

**El exe medido no incluye el ajuste de dibujo de C1**, hecho después de medir (Bruno, sin ABBA nuevo): motor de continua, EV biestable y monoestable (cables de la bobina corrida), conmutada y trafo trifásico, más el campo `ladoNombre` de un borne (`docs/plan-C1-biblioteca2.md`, «Ajuste de dibujo»). Toca primitivas y el lado de dos nombres; no la netlist ni el motor.

| Fila | Número | Tope PC | Mediana A | Máx. A | Mediana B | No regresión |
|---|---|---|---|---|---|---|
| P1 | máx. (49 miniaturas; B 32) | 9,1 (máx. 10,1) | **0,5** | 0,6 | 0,4 | solo tope (D-B13) |
| P2 | una por apertura | no regresión | **143,6** | 160,6 | 145,8 | pasa (≤ 160,3) |
| S6 | máx. | 54,5 (máx. 60,0) | 18,4 | 22,3 | 17,4 | pasa (≤ 19,2) |
| S1 | máx. | 54,5 | 17,3 | 18,9 | 17,3 | informa (R-A) |
| S2 | mediana / máx. | 1,7 / 5,3 | 0,2 / 0,3 | 0,3 / 0,4 | 0,3 / 0,4 | pasa |
| S3 | máx. | 16,7 | 3,2 | 3,4 | 3,0 | pasa (≤ 4,0) |
| S4 | cuadro / gesto | 6,0 / 18,2 | 2,0 / 2,3 | 2,1 / 2,4 | 2,2 / 2,5 | informa (R-A) |
| S5 | máx. | 100,0 | 48,3 | 50,5 | 48,0 | pasa (≤ 52,9) |

- **P1:** calientes 0,6 · 0,5 · 0,4 · 0,5 · 0,6 · 0,5 ms; frías 0,5–0,7.
- **P2:** A 160,6 · 143,7 · 144,8 · 142,4 · 143,5 · 142,2 ms (la primera apertura, la más alta).
- S1, desglose (mediana): R4 0,7 · netlist 2,8 · iniciar 1,1 · cuadro 13,3. S6: R4 0,8 · netlist 3,9 · iniciar 1,6 · cuadro 13,1. S5, pared 166,9 ms (informa).
- **B2 1.º (decide): 10,3 → 11,0, igual (+0,7 ms). B2 2.º (informa): 10,7 → 12,9, sube.** B1 53,0 → 54,0; B10 21,9 → 22,0. Frías fuera de rango: 6 en B, 3 en A (informan).
- F1 2,9–3,2 ms (≤ 9); F2 y F3 ≤ 95,1 ms (≤ 1 s). Medianas de las calientes: F1 2,7 · F2 43,3 · F3 53,4.
- **Copia de una vez (salida de emergencia de F1, informa):** 0 por plazo en las 24 corridas (A y B); máx. 8,9–13,2 ms. Las corridas tardaron 24–27 s (fría) y 8–9 s (caliente): no apareció la demora de T40.
- **`netlist-node`** (PC, Node v26.12.0, 3 procesos × 5 vueltas, orden A B B A; A en `a4400f9`, B en `6fe5600`): máx. de `armarNetlist` A 5,25 y 6,07 ms, B 5,44 y 5,55 ms; A 6,07 ≤ B 5,55 + 1 = 6,55: **pasa**. Medianas A 4,41 / 4,08, B 4,24 / 4,24; `redes()` máx. A 4,17 / 4,90, B 2,65 / 2,62. El tope de 5 ms (informa) no se cumple, tampoco en B.

## Sensores, presostato, termostato, EV, motor DC y diferencial 3P (biblioteca 2, T40) — 2026-11-27

**Criterio escrito antes de medir** (`docs/plan-T40.md`, «Medición»): ABBA en WebView2 (`probar-webview2.mjs --fase6 --base-fase6`, 3 bloques, fría + caliente). B1–B16 con D6b-C (B2 a mano: decide 1.º, `docs/plan-T37.md`); F por tope; S1–S6 por tope y no regresión (S1 y S4 solo tope); **P1 con 49 miniaturas solo por tope (D-B13):** mediana ≤ 9,1, máx. ≤ 10,1; P2 y `netlist-node`: A ≤ B + máx(1 ms, 10 %), el tope de 5 ms solo informa. Frías informan.

**Cómo se midió:** A = `8ad3886` (T40 + el plazo de la copia de una vez), `0.1.6-t40a.1` solo en `package.json` durante el build (`tauri build --no-bundle`), revertida. B = `5aeec6a` (T39) + cherry-pick de `8ad3886` (`c66ea57`, HEAD separado), `0.1.6-t40b.1`, en un worktree temporal con `npm ci` (borrado al cerrar). Así el arreglo está en los dos y se mide solo T40. Edge 158, de 21:16 a 21:34 (hora local). Condiciones confirmadas por Bruno antes de medir (enchufada, «Mejor rendimiento», LegionSpace en Performance, sin otras apps, ventana visible); al cerrar se leyó CA y el modo `ded574b5…` (Mejor rendimiento). Las 12 aperturas terminaron, sin repetición. Los dos intentos anteriores (checkpoint `34b5bf2`) se cortaron por el cuelgue de la copia de una vez, sin filas juzgadas.

**Resultado: pasa.** B1–B16 «igual», salvo B2 2.º, que sube e informa (regla de B2); F, S1–S6, P1 y P2 pasan; `netlist-node` pasa la no regresión.

| Fila | Número | Tope PC | Mediana A | Máx. A | Mediana B | No regresión |
|---|---|---|---|---|---|---|
| P1 | máx. (49 miniaturas) | 9,1 (máx. 10,1) | **0,5** | 0,7 | 0,4 | solo tope (D-B13) |
| P2 | una por apertura | no regresión | **143,4** | 155,5 | 141,4 | pasa (≤ 155,6) |
| S6 | máx. | 54,5 (máx. 60,0) | 18,1 | 18,5 | 17,5 | pasa (≤ 19,3) |
| S1 | máx. | 54,5 | 20,2 | 22,0 | 18,4 | informa (R-A) |
| S2 | mediana / máx. | 1,7 / 5,3 | 0,2 / 0,3 | 0,3 / 0,4 | 0,3 / 0,4 | pasa |
| S3 | máx. | 16,7 | 2,8 | 3,8 | 2,9 | pasa (≤ 3,9) |
| S4 | cuadro / gesto | 6,0 / 18,2 | 2,0 / 2,3 | 2,1 / 2,4 | 2,2 / 2,5 | informa (R-A) |
| S5 | máx. | 100,0 | 47,5 | 50,7 | 47,3 | pasa (≤ 52,0) |

- **P1:** calientes 0,7 · 0,5 · 0,6 · 0,5 · 0,4 · 0,4 ms; las 49 miniaturas siguen lejos del tope de la netbook (50 ms).
- **P2:** A 155,5 · 145,5 · 141,8 · 142,5 · 143,6 · 143,2 ms.
- S1, desglose (mediana): R4 0,9 · netlist 3,8 · iniciar 1,2 · cuadro 13,8. S6: R4 0,8 · netlist 4,6 · iniciar 1,6 · cuadro 12,3. S5, pared 162,4 ms (informa).
- **B2 1.º (decide): 10,2 → 11,1, igual (+0,9 ms). B2 2.º (informa): 10,6 → 11,9, sube.** B1 52,0 → 53,1; B10 22,1 → 22,0. Frías fuera de rango: 4 en B, 5 en A (informan).
- F1 3,0–3,2 ms (≤ 9); F2 y F3 ≤ 67,5 ms (≤ 1 s). Medianas de las calientes: F1 2,7 · F2 41,0 · F3 51,4.
- **Copia de una vez (salida de emergencia de F1, informa):** 0 por plazo en las 12 corridas de A; en B, 3 de 3 por plazo en las aperturas 2, 7 y 10, cuyas corridas tardaron 121–128 s y 95–101 s (las otras, 24 y 9 s). El plazo evitó el cuelgue; el resto de la demora no se explicó (anotado como pendiente).
- **`netlist-node`** (PC, Node v26.12.0 en los dos, 3 procesos × 5 vueltas, A en `8ad3886` y después B en `c66ea57`): máx. de `armarNetlist` A 6,31 ms, B 5,76 ms; A 6,31 ≤ B 5,76 + 1 = 6,76: **pasa**. Medianas A 4,48, B 4,60; `redes()` máx. A 2,72, B 3,23. El tope de 5 ms (informa) no se cumple, tampoco en B.

## Fuentes propias y trafos (biblioteca 2, T39) — 2026-11-27

**Criterio escrito antes de medir** (`docs/plan-T39.md`, «Medición»): ABBA en WebView2 (`probar-webview2.mjs --fase6 --base-fase6`, 3 bloques, fría + caliente) contra `8a1a695` (mismo código que `5f8a529`, solo docs encima), en una sesión. B1–B16 con D6b-C; F por tope; S1–S6 por tope y no regresión (S1 y S4 solo tope); **P1 solo por tope (D-B13):** mediana ≤ 9,1, máx. ≤ 10,1; P2: A ≤ B + máx(1 ms, 10 %). **`netlist-node` (ajuste 2):** no regresión del máximo, A ≤ B + máx(1 ms, 10 %); el tope de 5 ms solo informa. Si una fila falla, se frena sin volver a medir.

**Cómo se midió:** enchufada (CA), «Mejor rendimiento» (`ded574b5…`), sin Opera, Perplexity ni otra Bornera (verificado antes de medir). A `0.1.6-t39.0` (T39 sin commit, `tauri build --no-bundle`, versión solo en `package.json`, revertida); B `0.1.6-t39b.0`, de un worktree temporal en `8a1a695` con `npm ci` y `svelte-kit sync` (borrado al cerrar). Edge 158. **Primer intento cortado:** en la apertura 6 (B) una corrida pasó los 240 s y el script se detuvo («no terminó a tiempo»), sin ninguna fila juzgada; no quedó ninguna Bornera abierta. Se repitió el ABBA entero una vez: las 12 aperturas terminaron (38–41 s).

**Resultado: pasa.** B1–B16 «nada sube» (B5 2.º baja), F, S1–S6, P1 y P2 pasan; `netlist-node` pasa la no regresión.

| Fila | Número | Tope PC | Mediana A | Máx. A | Mediana B | No regresión |
|---|---|---|---|---|---|---|
| P1 | máx. (38 miniaturas) | 9,1 (máx. 10,1) | **0,5** | 0,6 | 0,4 | solo tope (D-B13) |
| P2 | una por apertura | no regresión | **143,3** | 155,0 | 141,6 | pasa (≤ 155,8) |
| S6 | máx. | 54,5 (máx. 60,0) | 18,3 | 20,2 | 18,0 | pasa (≤ 19,7) |
| S1 | máx. | 54,5 | 18,0 | 21,4 | 19,5 | informa (R-A) |
| S2 | mediana / máx. | 1,7 / 5,3 | 0,2 / 0,4 | 0,3 / 0,5 | 0,2 / 0,3 | pasa |
| S3 | máx. | 16,7 | 3,0 | 3,2 | 2,9 | pasa (≤ 3,9) |
| S4 | cuadro / gesto | 6,0 / 18,2 | 2,0 / 2,3 | 2,2 / 2,5 | 2,1 / 2,4 | informa (R-A) |
| S5 | máx. | 100,0 | 47,3 | 48,3 | 47,0 | pasa (≤ 51,8) |

- **P1:** calientes 0,5 · 0,5 · 0,4 · 0,4 · 0,4 · 0,6 ms; las 38 miniaturas siguen lejos del tope de la netbook (50 ms).
- **P2:** A 155,0 · 145,0 · 142,0 · 140,0 · 144,5 · 138,6 ms; los 6 canvas nuevos se montan después del primer cuadro.
- S1, desglose (mediana): R4 0,8 · netlist 3,2 · iniciar 1,3 · cuadro 14,2. S6: R4 0,8 · netlist 4,4 · iniciar 1,7 · cuadro 12,5.
- **B2 1.º (decide): 10,6 → 9,9, igual. B2 2.º (informa): 10,9 → 10,3, igual.** B10 22,4 → 22,3.
- F1 2,9–3,2 ms (≤ 9); F2 y F3 ≤ 66,9 ms (≤ 1 s). Medianas de las calientes: F1 2,7 · F2 41,6 · F3 52,1.
- **`netlist-node`** (PC, 3 procesos × 5 vueltas, orden A B B A): máx. de `armarNetlist` A 7,6 y 5,4 ms, B 7,1 y 5,3 ms; A 7,6 ≤ B 7,1 + 1 = 8,1: **pasa**. Medianas A 4,1 / 4,5, B 4,8 / 4,3. El tope de 5 ms (informa) no se cumple, tampoco en B.

## Netbook y PC el mismo día (fase 6, C3) — 2026-11-27

**Criterio escrito antes de medir** (`docs/plan-fase6.md` §4 y §5; hoja `docs/netbook-fase6.md`): `.msi` de `v0.1.6-alpha.1` (tag sobre `f2e1e28`) en las dos máquinas, «Probar la fase 6», 3 aperturas × (fría + caliente). S2–S6 y P1: mediana de las 3 calientes ≤ tope y máx. ≤ tope + máx(1 ms, 10 %); netbook con sus topes, PC con los de C1. S1 informa (contra 300 / 54,5). F1–F3 por su tope. B1–B16 contra los topes de la 3b: por fila, la mediana de las calientes; las corridas sueltas que fallan informan; B10 informa (regla de C3 de la fase 5). P2 informa. Las frías informan (rango de las calientes + 1 ms). K no se recalcula (K1 = 3, K2 = 5,5).

**Cómo se midió:** Bruno, las dos el 27/11 por la mañana (netbook 7:57–8:15, PC 8:42–8:51), las 12 corridas «con disco» y `0.1.6-alpha.1`. **WebView2 distinto: netbook Edge 157, PC Edge 158** (el runtime es del sistema; la hoja no lo fijaba). Fila 0: una sola «Bornera» `0.1.6-alpha.1` en las dos (Bruno). Filas 2, 3 y 4 de la netbook: pasan (Bruno). Condiciones del banco de la PC ese día: enchufada, LegionSpace en Quiet (lo normal es Performance), causa probable de la PC más lenta y del timeout de `bancoPotencia.test.ts`. Textos con el nombre de la hoja (`netbook1-fria.txt` … `pc3-caliente.txt`).

**Resultado: pasa.** Ninguna fila juzgada falla, ni en la netbook ni en la PC.

| # | Netbook cal. 1 / 2 / 3 | Mediana | Tope netbook (máx. adm.) | PC cal. 1 / 2 / 3 | Mediana | Tope PC | Netbook / PC |
|---|---|---|---|---|---|---|---|
| S6 máx. | 116,2 / 103,5 / 110,2 | **110,2** | 300 (330) | 30,3 / 23,8 / 27,9 | **27,9** | 54,5 (60,0) | 3,9 (K2 5,5) |
| P1 máx. | 5,9 / 3,4 / 1,3 | **3,4** | 50 (55) | 0,6 / 0,6 / 0,6 | **0,6** | 9,1 (10,1) | resolución |
| S1 máx. (informa) | 117,2 / 105,6 / 104,6 | 105,6 | 300 | 28,2 / 23,0 / 24,9 | 24,9 | 54,5 | 4,2 (K2) |
| S2 med. / máx. | 0,6/0,7 · 0,5/0,6 · 0,5/0,6 | 0,5 / 0,6 | 5 / 16 | 0,4/0,6 · 0,4/0,6 · 0,4/0,6 | 0,4 / 0,6 | 1,7 / 5,3 | resolución |
| S3 máx. | 8,5 / 7,7 / 7,7 | 7,7 | 50 (55) | 5,9 / 4,2 / 4,1 | 4,2 | 16,7 | 1,8 (K1 3) |
| S4 cuadro / gesto | 6,1/6,6 · 5,6/6,1 · 5,1/5,6 | 5,6 / 6,1 | 33 / 100 | 2,7/2,9 · 2,3/2,9 · 2,3/2,8 | 2,3 / 2,9 | 6,0 / 18,2 | 2,4 / 2,1 (K2) |
| S5 máx. | 128,4 / 109,8 / 133,8 | 128,4 | 300 (330) | 56,1 / 74,4 / 76,1 | 74,4 | 100 | 1,7 (K1) |
| P2 (una por apertura) | 851,8 / 745,9 / 896,3 | **851,8** | informa | 159,4 / 150,4 / 160,4 | **159,4** | informa | 5,3 |
| F1 máx. | 3,9 / 3,7 / 4,0 | | 50 | 3,1 / 2,9 / 4,6 | | 9 | |
| F2 máx. | 152,9 / 98,1 / 110,0 | | 1000 | 76,0 / 72,5 / 71,3 | | 1000 | |
| F3 máx. | 215,0 / 168,3 / 168,6 | | 3000 | 84,7 / 76,9 / 78,3 | | 1000 | |

- **B en la netbook:** pasan todas por la mediana. Informan: B10 151,0 / 118,6 / 114,9 ms por gesto (mediana 118,6; fase 5: 121–128); corridas sueltas que fallan: caliente 1 con B12 4,8 ms (mediana 3,3 ≤ 4,5) y B16 1 lento (52,7 ms por gesto; mediana 0 lentos), caliente 3 con B15 1 lento (máx. 18,9 ms; mediana 0). B1 142,8–170,9 ms (mediana), B2 24,2–32,5, B6 1 lento en las calientes 1 y 3 (máx. 28,4; tope ≤ 1 por gesto), B16 por gesto 42,9–52,7. B9 N = 500 en las 6.
- **B en la PC:** las 6 corridas pasan todo; B10 29,1–35,6, B9 N = 500.
- **S6, desglose en la netbook (máx.):** netlist 10,5–34,5 ms (el 34,5 es la caliente 3; en las otras 5 corridas 8,7–12,5), cuadro 71–103 ms en 11–13 cuadros. PC: netlist 6,0–6,9, cuadro 16,8–20,9 en 4–5 cuadros.
- **S1, desglose en la netbook (máx.):** netlist 8,1–9,7 ms (T28: ≤ 27,5), cuadro 94–107 ms en 15–17 cuadros. S5 de pared (informa): 446–483 ms (fase 5: 391–436). Cadena de 100 de S4: gesto 72–95 ms.
- **P2 y el cambio de C1** (los canvas de la paleta, montados después del primer cuadro nítido): **la netbook no muestra nada, ni a favor ni en contra.** No hay P2 de la netbook sin el cambio (la marca nació en T37, después de la `0.1.5`), así que no hay base. Lo que se movió es chico frente a P2: dibujar las 32 miniaturas cuesta en la netbook 1,1–1,4 ms de mediana (máx. 5,9), menos del 1 % de 852 ms, y P2 varía 150 ms entre aperturas (746–896). El cociente netbook / PC de P2 (5,3) queda en la escala de K2 (5,5): nada indica que la paleta retrase el primer cuadro de la netbook más que el de la PC. P1 no mide montar los 32 canvas (solo el dibujo); ese costo no está medido aparte.
- **La PC salió más lenta que en C1** (mismas reglas, por tope: pasa igual). Mediana de las calientes contra C1 (exe `--no-bundle`, 2026-11-25): S6 27,9 / 17,9, S1 24,9 / 19,3, S5 74,4 / 46,4 (la caliente 1 dio 56,1), S3 4,2 / 3,0, P2 159,4 / 153,2. Por eso los cocientes de hoy quedan por debajo de los de la fase 5 (S1 4,2 / 4,6, S3 1,8 / 3,1, S5 1,7 / 2,4). No se volvió a medir; informa.
- **Frías fuera de su rango (informan):** netbook B1 (frías 1 y 2; máx. 259,9 en la 2), B3 fría 1 (máx. 23,9 ms, 1 lento), B4 máx. (frías 1 y 3), B8 fría 2 (37,5), B11 (frías 1 y 2), F1 fría 2 (5,3), F2 (fría 1 188,5; fría 2 mediana), S1 (frías 1 y 3: 121,3 y 143,4), S3 fría 1 (mediana 9,5), S5 fría 1 (141,2 / 134,9); PC S1 fría 1 (29,4), S3 fría 3 (mediana 4,7), S5 fría 1 (mediana 74,1).
- **Fila 3, `npm run circuito`** (`BORNERA_BASE=inversion-potencia`, `inversion-a-mano.brn` fuera del repo): **pasa a la tercera versión del archivo**, «misma partición que la base (20 redes, 58 bornes)». La 1.ª no tenía H1 ni H2, tenía F1 y F2 cambiados y la fase de mando en L0; la 2.ª tenía el fusible y el 95-96 con los bornes al revés (L1 → F1·2, F1·1 → F2·96, F2·95 → S0·11: equivale eléctricamente, pero la comparación es por borne). Bruno corrigió las dos; el criterio no cambió.
- **Timeout de `npm test` (informa; no se tocó el test ni su límite):** `src/editor/bancoPotencia.test.ts:64` («está tendida como W») tardó 22,1 s contra el límite de 20 s en dos corridas completas de `npm test` con la PC cargada (112 workers); solo, 10,8 s. Pasaba en C1 y no cambió código; `tests.yml` en verde (última corrida, 2026-11-25, `v0.1.6-alpha.1`). Pendiente.

## «Probar la fase 6» en la PC, contra `954f011` (fase 6, C1) — 2026-11-25

**Criterio escrito antes de medir** (`docs/plan-C1-fase6.md`, aprobado con 4 ajustes): ABBA en WebView2 (`probar-webview2.mjs --fase6`: A corre «Probar la fase 6» y B «Probar la fase 5», 3 bloques, fría + caliente) contra `954f011` (cierre de la fase 5), misma escena de B (sin J-A). B1–B16 con D6b-C (B2 por mediana de la 1.ª, a mano); F por tope; S1–S5 por tope, con no regresión en S2, S3 y S5 (S1 y S4 informan). **S6 y P1 solo por tope** (B no los tiene): mediana ≤ 54,5 / 9,1, máx. ≤ 60,0 / 10,1 aparte. **P2 informa** (B no tiene la marca) y se compara con 139,3 (`24090e0`) y 148,9 (`f9d3b10`). Una sola repetición, solo por un control (B13, B15, S4, o máx. de S6/P1 sobre el tope con la mediana dentro).

**Cómo se midió:** enchufada, «Mejor rendimiento», apps cerradas (Bruno), sin otra Bornera. A `0.1.5-c1.0` (`81a1c4b`, con los canvas de la paleta montados después del primer cuadro nítido); B `0.1.5-c1b.0`, de un worktree temporal en `954f011` (`npm ci`, `svelte-kit sync`), borrado con `git worktree remove` y `prune`. Los dos con `tauri build --no-bundle`, versión solo en `package.json` (revertida). Edge 158. Las 12 aperturas terminaron (39–43 s).

**Resultado: pasa en el primer ABBA.** Nada sube; no hizo falta repetir.

| Fila | Número | Tope PC | Mediana A | Máx. A | Mediana B | No regresión |
|---|---|---|---|---|---|---|
| S6 | máx. | 54,5 (máx. 60,0) | **17,9** | 20,5 | — | sin base |
| P1 | máx. | 9,1 (máx. 10,1) | **0,4** | 0,4 | — | sin base |
| P2 | una por apertura | informa | **153,2** | 186,5 | — | informa |
| S1 | máx. | 54,5 | 19,3 | 22,5 | 20,3 | informa (R-A) |
| S2 | mediana / máx. | 1,7 / 5,3 | 0,2 / 0,4 | 0,3 / 0,5 | 0,2 / 0,3 | pasa |
| S3 | máx. | 16,7 | 3,0 | 3,3 | 3,0 | pasa (≤ 4,0) |
| S4 | cuadro / gesto | 6,0 / 18,2 | 1,9 / 2,2 | 2,3 / 2,5 | 2,0 / 2,3 | informa (R-A) |
| S5 | máx. | 100,0 | 46,4 | 49,1 | 47,7 | pasa (≤ 52,4) |

- **P2 no bajó:** A 186,5 · 158,8 · 158,4 · 146,2 · 136,4 · 148,0 ms, mediana 153,2, contra 148,9 (`f9d3b10`, T38) y 139,3 (`24090e0`). Montar los canvas después del primer cuadro no se nota en P2 (la 1.ª apertura, fría del sistema, es la más alta, como en T37 y T38). Son sesiones distintas y aquí no hay B que lo mida en el mismo ABBA: se informa tal cual y el cambio no se agranda (ajuste 3). Se mira en C3.
- **S1, desglose (mediana de las calientes, ms):** A R4 0,8 · netlist 3,6 · iniciar 1,3 · cuadro 14,1; B R4 0,7 · netlist 3,3 · iniciar 1,4 · cuadro 14,6. Contra `954f011`, A queda 1,0 ms **por debajo** (19,3 / 20,3) y ninguna parte cambia más de 0,5 ms. La suba de T38 (17,8 → 20,5) no se ve contra la base de la fase 5: no está en ninguna parte del desglose; el 17,8 de `24090e0` fue el bajo de esa sesión (S1 varía ~2 ms entre sesiones).
- S6, desglose (mediana): R4 0,9 · netlist 4,3 · iniciar 1,5 · cuadro 12,2. Calientes 19,0 · 18,4 · 17,5 · 17,3 · 20,5 · 17,4; frías 16,6–19,1.
- P1: calientes 0,3–0,4; frías 0,3–0,6.
- **B2 1.º (decide): 10,3 → 10,3, igual. B2 2.º (informa): 10,7 → 11,7, igual (+1,0 ms).** B10 22,9 → 22,5. B13 y B15 (control) iguales. B9 500 / 500.
- F1 2,9–3,7 ms (≤ 9); F2 ≤ 68,3 y F3 ≤ 87,7 ms (≤ 1 s). Medianas de las calientes: F1 2,7 · F2 40,9 · F3 53,8.
- Frías fuera del rango de sus calientes (+1 ms, informan): B 8, A 2 (B6 máx. 10,5 y 11,0).
- S5 de pared (informa): 156,9 ms. Cadena de 100 de S4 (informa): 5,0 / 12,9 ms.

## Paleta con miniaturas: P1 y el juicio de P2 (fase 6, T38) — 2026-11-25

**Criterio escrito antes de medir** (`docs/plan-T38.md`): ABBA en WebView2 (`probar-webview2.mjs --fase6 --base-fase6`: A y B corren «Probar la fase 6», 3 bloques, fría + caliente) contra `24090e0`, misma escena de B (`TIPOS_ESCENA_013`; la paleta sigue en 200 px, sin J-A). **P1 (ajuste 4), la regla de S6:** decide la mediana de las calientes ≤ 9,1 ms; el máx. ≤ 10,1 aparte (un pico aislado: se repite el ABBA una vez); no regresión «sin base» (B no tiene P1). **P2 (D30-A):** mediana de las aperturas de A ≤ la de B del mismo ABBA + máx(1 ms, 10 %); 134,3 ms de T37 es referencia. **S6:** mediana ≤ 54,5, máx. ≤ 60,0 aparte, una sola repetición, y no regresión contra B. S1–S5, B1–B16 y F con las reglas de T35–T37 (B2 por mediana de la 1.ª, a mano).

**Cómo se midió:** enchufada (CA), «Mejor rendimiento» (`ded574b5…`), sin Opera, Perplexity ni otra Bornera (los WebView2 abiertos eran del buscador de Windows). A `0.1.5-t38.0` (`d6b0c07`, `tauri build --no-bundle`, versión solo en `package.json`, revertida); B `0.1.5-t37.0`, el exe de release de T37 (`29ffb86`, mismo `src/` que `24090e0`); la versión de cada uno, confirmada en el encabezado de sus 12 corridas. Edge 158. Las 12 aperturas terminaron (39–42 s cada una).

**Resultado: pasa.** P1, P2 y S6 pasan; S1–S5, B1–B16 y F pasan; nada sube. No hizo falta repetir.

| Fila | Número | Tope PC | Mediana A | Máx. A | Mediana B | No regresión |
|---|---|---|---|---|---|---|
| P1 | máx. | 9,1 (máx. 10,1) | **0,4** | 0,4 | — | sin base |
| P2 | una por apertura | no regresión | **148,9** | 173,6 | 139,3 | pasa (≤ 153,2) |
| S6 | máx. | 54,5 (máx. 60,0) | 19,5 | 23,5 | 20,1 | pasa (≤ 22,2) |
| S1 | máx. | 54,5 | 20,5 | 21,8 | 17,8 | informa (R-A) |
| S2 | mediana / máx. | 1,7 / 5,3 | 0,2 / 0,4 | 0,3 / 0,4 | 0,2 / 0,4 | pasa |
| S3 | máx. | 16,7 | 3,0 | 3,2 | 3,1 | pasa (≤ 4,2) |
| S4 | cuadro / gesto | 6,0 / 18,2 | 2,1 / 2,4 | 2,7 / 2,9 | 2,2 / 2,4 | informa (R-A) |
| S5 | máx. | 100,0 | 47,8 | 48,6 | 48,4 | pasa (≤ 53,2) |

- **P1:** calientes 0,4 · 0,3 · 0,4 · 0,4 · 0,4 · 0,4 ms; frías 0,3–0,6. Las 32 miniaturas de cero (solo el dibujo en los canvas, sin pintar la pantalla) cuestan menos de medio milisegundo: el tope de la netbook (50 ms) queda lejos.
- **P2:** A 159,6 · 151,8 · 145,9 · 141,3 · 173,6 · 143,6 ms (mediana 148,9); B mediana 139,3; límite 153,2. Sube 9,6 ms (7 %): montar la paleta con 32 canvas, grupos y subgrupos antes del primer cuadro (las miniaturas se dibujan después y no entran). En T37, B daba 134,3.
- **S1 (informa, R-A):** 17,8 → 20,5 de mediana, sobre el límite de la no regresión (19,5), pero S1 se juzga solo por tope (54,5) y pasa. El desglose (R4 0,9 · netlist 4,1 · iniciar 1,4 · cuadro 13,9) es como el de T37 (1,0 · 3,5 · 1,3 · 14,1): T38 no toca ese camino. Se mira en C3.
- **B2 1.º (decide): 10,6 → 10,6, igual. B2 2.º (informa): 10,9 → 11,1, igual.** B10 23,1 → 23,1. B13 y B15 (control) iguales.
- S6, desglose (mediana): R4 0,8 · netlist 4,8 · iniciar 1,8 · cuadro 12,4. S5 de pared (informa): 162,4 ms. Cadena de 100 de S4 (informa): 5,0 / 12,3 ms.
- F1 2,9–4,9 ms (≤ 9); F2 y F3 ≤ 84,3 ms (≤ 1 s). Medianas de las calientes: F1 2,7 · F2 43,0 · F3 52,8.

## Escena de potencia y «Probar la fase 6» (fase 6, T37) — 2026-11-25

**Criterio escrito antes de medir** (`docs/plan-T37.md`): ABBA en WebView2 (`probar-webview2.mjs --fase6`: A corre «Probar la fase 6» y B «Probar la fase 5», 3 bloques, fría + caliente) contra `0322b14`, misma escena de B (`TIPOS_ESCENA_013`, sin J-A). **S6 (ajuste 1):** decide la mediana de las calientes ≤ 54,5 ms; el máx. ≤ 60,0 aparte (un pico aislado: se repite el ABBA una vez; si vuelve, no pasa); sin no regresión (la base no tiene S6). **P2** informa (la base no tiene la marca). S1–S5, B1–B16 y F con las reglas de T35/T36: S1 ≤ 54,5 (máx. 60,0); S2 1,7 / 5,3, S3 16,7, S5 100,0 con tope y no regresión; S4 6,0 / 18,2 por tope; B con D6b-C, **B10 se juzga** y **B2 por mediana, a mano** (B2 1.º decide, B2 2.º informa); F1 ≤ 9 ms, F2 y F3 ≤ 1 s. Control: S4, B13, B15.

**Cómo se midió:** enchufada (CA), «Mejor rendimiento» (`ded574b5…`), sin Opera, Perplexity ni otra Bornera (verificado antes de medir; los WebView2 abiertos eran del buscador de Windows). Dos exes `tauri build --no-bundle` con la versión solo en `package.json` (local, revertida): A `0.1.5-t37.0` (`29ffb86`); B `0.1.5-t37b.0`, de un worktree temporal en `0322b14` con `npm ci` y `svelte-kit sync` (ya borrado). Edge 158. Las 12 aperturas terminaron (38–41 s cada una). Escena de potencia: 2000 componentes, 3519 cables, 95 trifásicas, 1526 redes.

**Resultado: pasa.** S6 pasa por tope; S1–S5, B1–B16 y F pasan; nada sube.

| Fila | Número | Tope PC | Mediana A | Máx. A | Mediana B | No regresión |
|---|---|---|---|---|---|---|
| S6 | máx. | 54,5 (máx. 60,0) | **17,4** | 18,0 | — | no aplica |
| S1 | máx. | 54,5 | 19,1 | 21,8 | 18,9 | informa (R-A) |
| S2 | mediana / máx. | 1,7 / 5,3 | 0,2 / 0,3 | 0,3 / 0,4 | 0,2 / 0,3 | pasa |
| S3 | máx. | 16,7 | 3,0 | 3,5 | 2,8 | pasa (≤ 3,8) |
| S4 | cuadro / gesto | 6,0 / 18,2 | 2,0 / 2,3 | 2,3 / 2,6 | 2,0 / 2,3 | informa (control) |
| S5 | máx. | 100,0 | 47,6 | 50,5 | 47,5 | pasa (≤ 52,3) |

- **S6:** calientes 17,4 · 16,8 · 18,0 · 16,6 · 17,8 · 17,3; frías (informan) 17,2–20,7. Desglose (mediana): R4 0,8 · netlist 4,4 · iniciar 1,6 · cuadro 11,6. El supuesto del plan (25–35 ms) era alto: la netlist pesa poco más que en S1 (4,4 contra 3,5) y el cuadro al 31 % pesa menos (11,6 contra 14,1).
- **P2 (informa, base de T38):** 171,4 · 134,0 · 134,5 · 134,4 · 133,3 · 134,2 ms; mediana 134,3. La 1.ª apertura, fría del sistema, tardó más.
- **B2 1.º (decide): 10,1 → 10,7, igual. B2 2.º (informa): 10,3 → 11,1, igual para el script también**: la regla a mano no hizo falta.
- **B10 (juzgada): 21,8 → 21,9, igual.** B13 y B15 (control) iguales.
- S1, desglose (mediana): R4 1,0 · netlist 3,5 · iniciar 1,3 · cuadro 14,1. S5 de pared (informa): 167,8 ms. Cadena de 100 de S4 (informa): 5,0 / 12,3 ms.
- F1 2,9–3,0 ms (≤ 9); F2 y F3 ≤ 68,4 ms (≤ 1 s). Medianas de las calientes: F1 2,7 · F2 42,1 · F3 52,2.
- Frías fuera del rango de sus calientes (+1 ms, informan): 7 en A (B1, B5 2.º, B6) y 4 en B (B1 2.º, B3, B4 2.º, B11).
- Chrome headless (humo, informa): S6 28,4 / 20,4 ms (máx. / mediana); P2 324,0 ms.
- `npm run bench` no se corrió: el dibujo de Editar no cambia (el Lienzo solo suma un `if` por cuadro hasta la marca); decide el ABBA.

## Mando y protecciones que conducen (fase 6, T36) — 2026-11-25

**Criterio escrito antes de medir** (`docs/plan-T36.md`): ABBA en WebView2 (`probar-webview2.mjs --fase5 --base-fase5`, 3 bloques, fría + caliente) contra `80c82f9`, misma escena (`TIPOS_ESCENA_013`, sin J-A). S1 ≤ 54,5 (máx. 60,0) y no regresión; S2 1,7 / 5,3, S3 16,7, S5 100,0: tope y no regresión; S4 6,0 / 18,2 por tope. B1–B16 con D6b-C (**B2 por mediana**: B2 1.º decide y B2 2.º informa). **B10 se juzga.** F1 ≤ 9 ms, F2 y F3 ≤ 1 s. Control: S4, B13, B15.

**Cómo se midió:** enchufada (CA), «Mejor rendimiento» (`ded574b5…`), sin Opera, Perplexity ni otra Bornera (verificado antes de medir). Dos exes `tauri build --no-bundle` con la versión solo en `package.json` (local, revertida): A `0.1.5-t36.0` (`2d5ff12`); B `0.1.5-t36b.0`, de un worktree temporal en `80c82f9` con `npm ci` y `svelte-kit sync` (ya borrado). Edge 158. Las 12 aperturas terminaron (40–42 s cada una).

**Resultado: pasa.** S, B y F pasan; nada sube.

| Fila | Número | Tope PC | Mediana A | Máx. A | Mediana B | No regresión |
|---|---|---|---|---|---|---|
| S1 | máx. | 54,5 | 22,7 | 24,8 | 22,5 | pasa (≤ 24,8) |
| S2 | mediana | 1,7 | 0,2 | 0,2 | 0,2 | pasa (≤ 1,2) |
| S2 | máx. | 5,3 | 0,3 | 0,3 | 0,3 | pasa (≤ 1,3) |
| S3 | máx. | 16,7 | 3,0 | 3,3 | 2,8 | pasa (≤ 3,8) |
| S4 | cuadro | 6,0 | 1,8 | 3,1 | 1,8 | informa (control) |
| S4 | gesto | 18,2 | 2,0 | 3,3 | 2,0 | informa (control) |
| S5 | máx. | 100,0 | 46,1 | 49,4 | 45,8 | pasa (≤ 50,4) |

- **B10 (juzgada): 23,4 → 23,9 ms, igual** (calientes A 22,9–24,8 · B 22,4–24,2).
- **B2 1.º (decide): 10,6 → 10,6, igual. B2 2.º (informa): 11,8 → 11,1.**
- B13 y B15 (control) iguales; B1, B4 2.º, B8 y B16 suben menos de 1 ms o del 10 %: iguales.
- S1, desglose (mediana): R4 0,9 · netlist 4,8 · iniciar 1,6 · cuadro 15,5 (el desglose de B no se imprime: S1 de A y B son iguales, 22,7 y 22,5). S5 de pared (informa): 154,6 ms. Cadena de 100 de S4 (informa): 5,2 / 13,8 ms.
- F1 3,0–4,8 ms (≤ 9); F2 y F3 ≤ 68,0 ms (≤ 1 s). Medianas de las calientes: F1 2,8 · F2 40,4 · F3 52,5.
- Frías fuera del rango de sus calientes (+1 ms, informan): 8 en A (B1, B2 2.º, B3) y 5 en B (B1, B8, B10).
- `npm run bench` no se corrió: la escena del banco no tiene símbolos de T36 y el dibujo de los de T35 no cambia en Editar; decide el ABBA.

## Símbolos de potencia (fase 6, T35) — 2026-11-25

**Criterio escrito antes de medir** (`docs/plan-T35.md`): ABBA en WebView2 (`probar-webview2.mjs --fase5 --base-fase5`, 3 bloques, 6 aperturas por exe, fría + caliente) contra `446115a`, misma escena (`TIPOS_ESCENA_013`, sin J-A). S1 ≤ 54,5 (máx. 60,0) y no regresión; S2 1,7 / 5,3, S3 16,7, S5 100,0: tope y no regresión; S4 6,0 / 18,2 por tope. B1–B16 con D6b-C (**B2 por mediana**: B2 1.º decide y B2 2.º informa, regla vigente de `plan-fase6.md` §4). **B10 se juzga** (las referencias por polos tocan ese camino). F1 ≤ 9 ms, F2 y F3 ≤ 1 s. Control: S4, B13, B15 (si falla solo una, se repite una vez); si falla una juzgada, se frena y se consulta.

**Cómo se midió:** enchufada (CA), «Mejor rendimiento» (`ded574b5…`), sin Opera, Perplexity ni otra Bornera (verificado antes de medir). Dos exes `tauri build --no-bundle` con la versión solo en `package.json` (local, revertida): A `0.1.5-t35.0` (`b060cfb`); B `0.1.5-t35b.0`, de un worktree temporal en `446115a` con `npm ci` y `svelte-kit sync` (ya borrado). Edge 158. Las 12 aperturas terminaron (38–41 s cada una).

**Resultado: pasa.** S pasa (cierre «pasa»), F pasa, B1–B16 iguales salvo B2 2.º, que informa.

| Fila | Número | Tope PC | Mediana A | Máx. A | Mediana B | No regresión |
|---|---|---|---|---|---|---|
| S1 | máx. | 54,5 | 20,1 | 21,9 | 19,9 | pasa (≤ 21,9) |
| S2 | mediana | 1,7 | 0,2 | 0,2 | 0,2 | pasa (≤ 1,2) |
| S2 | máx. | 5,3 | 0,3 | 0,4 | 0,3 | pasa (≤ 1,3) |
| S3 | máx. | 16,7 | 3,0 | 3,3 | 3,0 | pasa (≤ 4,0) |
| S4 | cuadro | 6,0 | 2,0 | 2,7 | 2,2 | informa (control) |
| S4 | gesto | 18,2 | 2,3 | 3,2 | 2,4 | informa (control) |
| S5 | máx. | 100,0 | 47,9 | 50,4 | 48,0 | pasa (≤ 52,9) |

- **B10 (juzgada): 22,5 → 21,9 ms, igual** (calientes A 21,5–23,2 · B 21,8–23,0).
- **B2 1.º (decide): 10,1 → 10,6, igual. B2 2.º (máx. de deshacer «Duplicar todo», informa): 10,2 → 12,3 ms**; el script lo marca «NO pasa» porque aplica D6b-C sin la excepción B-A. Calientes A 10,3–13,5 · B 9,8–13,8: los rangos se pisan, como el máximo bimodal de T32. T35 no suma trabajo en ese camino salvo un `for…of` sobre un arreglo vacío fijo por componente (R10 en `avisosHoja`).
- B13 y B15 (control) iguales; B5 2.º 3,8 → 3,0; B1 1.º y 2.º, B4, B6, B11, B16 iguales.
- S1, desglose (mediana): R4 0,9 · netlist 2,8 · iniciar 1,3 · cuadro 14,1. S5 de pared (informa): 160,4 ms. Cadena de 100 de S4 (informa): 4,9 / 11,8 ms.
- F1 2,9–3,1 ms (≤ 9); F2 y F3 ≤ 63,8 ms (≤ 1 s). Medianas de las calientes: F1 2,7 · F2 38,2 · F3 51,7.
- Frías fuera del rango de sus calientes (+1 ms, informan): 10 en A (B1, B4 2.º, B5 2.º) y 7 en B (B1, B5 2.º, B6, B16).
- `npm run bench` no se corrió: la escena del banco no tiene símbolos de T35 y su texto de referencias no cambia (contactos de un polo); decide el ABBA.

## Polos y netlist multipolo (fase 6, T34) — 2026-11-24

**Criterio escrito antes de medir** (`docs/plan-T34.md`, aprobado con 4 ajustes): ABBA en WebView2 (`probar-webview2.mjs --fase5 --base-fase5`, 3 bloques, 6 aperturas por exe, fría + caliente) contra `954f011`, misma escena (sin J-A). S1 (arma la netlist): tope 54,5 (máx. 60,0) **y no regresión (ajuste 1)**. S2 1,7 / 5,3 (máx. 2,7 / 6,3), S3 16,7 (18,4), S5 100,0 (110,0): tope y no regresión (mediana A ≤ B + máx(1 ms, 10 %)). S4 6,0 / 18,2 (7,0 / 20,0): control, por tope. B1–B16 con D6b-C (B2 por mediana); F1–F3 por tope. **Ajuste 4:** si falla solo una fila de control (B13, B15, S4), se repite el ABBA una vez; si falla una que se juzga, se frena y se consulta sin volver a medir.

**Cómo se midió:** enchufada, «Mejor rendimiento» y apps cerradas (Bruno). Dos exes `tauri build --no-bundle` con la versión solo en `package.json` (local, revertida): A `0.1.5-t34.0` (`e904417`) y después `0.1.5-t34.1` (`3fa36a3`); B `0.1.5-t34b.0`, de un worktree temporal en `954f011` con `npm ci` y `svelte-kit sync`. Edge 158.

**Primer intento: cortado, sin juicio.** La apertura 1 (A) terminó en 44 s; en la 2, **el exe de B tardó más de 4 min en «Probar la fase 5»** (límite de `probar-webview2.mjs`) y la corrida se cortó sin tabla. Abierto solo después, el mismo exe la terminó en 24 s (primera apertura de un exe recién compilado; causa no confirmada). Se relanzó el ABBA entero.

**ABBA 1 (A = `e904417`): no pasa B5 2.º.** S1–S5 pasan (S1 20,6 / 25,6, sin regresión: B 21,5, límite 23,6); F pasa; B13 y B15 iguales; todo «igual» salvo **B5 2.º (máximo de deshacer «Pegar 500»): B 2,2 → A 3,9 ms** (calientes A 4,6 · 6,8 · 2,1 · 4,1 · 3,8 · 2,6; B 2,6 · 2,0 · 2,3 · 2,0 · 2,2 · 2,1). B5 1.º igual (1,9). Se frenó y consultó (ajuste 4).

**Diagnóstico (Bruno, opción A acotada, reglas fijadas antes de medir):**
1. *Asignaciones por llamada que sumó T34:* `polosDe` armaba `[[a, b]]` en cada llamada para un contacto de 2 bornes; `armarNetlist` creaba una clausura por contacto (`forEach`) y otra por armado (`sumarFuente`); `redes()` y la netlist normalizaban el nombre de cada borne de una fuente de varios bornes. `nombraRed`, R9 y R6 incremental no crean nada. **Ninguna está en el camino de deshacer «Pegar 500»** (se llaman al entrar a Simular o con una trifásica en la hoja).
2. *Node* (`deshacer` de «Pegar 500» con la escena 2000 + 3030 y el recorte de 500 del banco, 4 procesos por lado A B B A A B B A, 60 medidos + 10 de calentamiento): mediana de medianas A 2,13 · B 2,04 ms; mediana de máximos A 4,41 · B 3,90 ms. **A ≈ B** (dentro de máx(1 ms, 10 %)); el pico más alto fue de B (12,2).
3. *Una traza de A en WebView2* (corrida caliente, B5 1,9 / 3,7 ms): el escenario entero (preparar, 3 pegar, 3 deshacer y cuadros) es **una sola tarea de 471 ms** con 6 `MinorGC` de 0,9–2,0 ms; el exceso del máximo (1,8 ms) mide como un `MinorGC`, pero la traza no tiene marcas por paso: **no se puede atribuir** un GC a un deshacer.

**Salida (regla de Bruno):** había asignaciones evitables → se quitaron (`3fa36a3`: `polosDe` memorizado por definición, `for` en vez de `forEach`, `sumarFuente` fuera, nombres de borne tal cual), tests en verde, y **ABBA nuevo completo** con las mismas reglas.

**ABBA 2 (A = `3fa36a3`): pasa todo.** B1–B16 nada sube (**B5 2.º 2,4 → 2,2**); B13 y B15 iguales; F pasa; cierre de S: pasa.

| Fila | Número | Tope PC | Mediana A | Máx. A | Mediana B | No regresión |
|---|---|---|---|---|---|---|
| S1 | máx. | 54,5 | 17,3 | 20,9 | 19,4 | **pasa (≤ 21,3, ajuste 1)** |
| S2 | mediana | 1,7 | 0,2 | 0,2 | 0,2 | pasa (≤ 1,2) |
| S2 | máx. | 5,3 | 0,3 | 0,4 | 0,3 | pasa (≤ 1,3) |
| S3 | máx. | 16,7 | 2,9 | 3,8 | 2,9 | pasa (≤ 3,9) |
| S4 | cuadro | 6,0 | 2,0 | 2,4 | 2,0 | informa (control) |
| S4 | gesto | 18,2 | 2,3 | 2,7 | 2,3 | informa (control) |
| S5 | máx. | 100,0 | 48,3 | 53,5 | 47,8 | pasa (≤ 52,6) |

- S1, desglose (mediana): R4 0,8 · netlist 3,0 · iniciar 1,1 · cuadro 13,1 (ABBA 1: netlist 4,5). S5 de pared (informa): 164,4 ms. Cadena de 100 de S4 (informa): 5,0 / 12,1 ms.
- F1 2,9–3,2 ms (≤ 9); F2 y F3 ≤ 63,1 ms (≤ 1 s). Medianas de las calientes: F1 2,7 · F2 37,4 · F3 51,3.
- Frías fuera del rango de sus calientes (+1 ms, informan): 10 en A (B5 2.º 4,0 y 7,8 entre ellas) y 4 en B (B5 2.º 7,0).
- Lectura: el código del camino de B5 no cambió entre los dos ABBA y B5 2.º pasó de 3,9 a 2,2; junto con Node (A ≈ B), el pico de ABBA 1 es compatible con GC o ruido del máximo de 3 pasos, sin probarlo.
- `npm run bench` no se corrió: T34 no toca dibujo, arrastre ni mosaicos; decide el ABBA.

## Netbook y PC el mismo día (fase 5, C3) — 2026-11-22

**Criterio escrito antes de medir** (`docs/plan-fase5.md`, secciones 3 y 4; hoja `docs/netbook-fase5.md`): `.msi` de `v0.1.5-alpha.1` (tag sobre `845fe69`, del borrador de `release.yml`) en las dos máquinas, «Probar la fase 5», 3 aperturas × (fría + caliente). S1–S5: mediana de las 3 calientes ≤ tope y máx. ≤ tope + máx(1 ms, 10 %); netbook con sus topes, PC con los de C1. F1–F3 por su tope. B1–B16 contra los topes de la 3b: por fila, la mediana de las corridas; las corridas sueltas que fallan informan; B10 informa. Las frías informan (rango de las calientes + 1 ms). K no se recalcula.

**Cómo se midió:** Bruno, las dos el 22/11 por la tarde (PC 15:02–15:05, netbook 15:28–15:37), Edge 157, «con disco». Filas 0, 2, 2b, 3, 4 y 5 de la netbook: pasan (Bruno). Sin informar: la fila 0 de la PC y las condiciones del banco. Los textos se llaman `n1-…`–`n3-…` (PC) y `frio1`–`caliente3` (netbook), al revés de la hoja.

**Resultado: pasa.**

| # | Netbook cal. 1 / 2 / 3 | Mediana | Tope netbook (máx. adm.) | PC cal. 1 / 2 / 3 | Tope PC | Netbook / PC |
|---|---|---|---|---|---|---|
| S1 máx. | 97,3 / 100,3 / 122,4 | 100,3 | 300 (330) | 21,2 / 22,5 / 21,9 | 54,5 | 4,6 (K2 5,5) |
| S2 med. / máx. | 0,4/0,4 · 0,4/0,5 · 0,4/0,6 | 0,4 / 0,5 | 5 / 16 | 0,2/0,3 · 0,2/0,3 · 0,2/0,3 | 1,7 / 5,3 | resolución |
| S3 máx. | 7,8 / 8,0 / 8,3 | 8,0 | 50 (55) | 2,5 / 2,6 / 2,8 | 16,7 | 3,1 (K1 3) |
| S4 cuadro / gesto | 5,3/5,8 · 5,3/6,0 · 6,0/6,5 | 5,3 / 6,0 | 33 / 100 | 2,2/2,3 · 2,3/2,5 · 2,0/2,3 | 6,0 / 18,2 | 2,4 / 2,6 (K2) |
| S5 máx. | 122,5 / 119,0 / 121,2 | 121,2 | 300 (330) | 51,3 / 46,7 / 52,4 | 100 | 2,4 (K1) |
| F1 máx. | 3,7 / 3,5 / 5,5 | | 50 | 3,2 / 3,0 / 3,1 | 9 | |
| F2 máx. | 100,9 / 96,1 / 134,4 | | 1000 | 57,8 / 52,9 / 56,6 | 1000 | |
| F3 máx. | 249,0 / 175,5 / 191,1 | | 3000 | 61,9 / 62,9 / 64,9 | 1000 | |

- **B en la netbook:** pasan todas por la mediana. Informan: B10 121–128 ms por gesto (3b: 124,5); caliente 1 con B6 2 lentos en un gesto (máx. 22,6 ms) y B11 1,3 % (2 de 152); B12 4,9 ms en las frías 1 y 3 (calientes 3,3–3,9). B1 143–152 ms, B2 24,5–26,4, B16 por gesto 43–45. B9 N = 500.
- **S1, desglose en la netbook (máx.):** netlist 7,0–7,3 ms (T28: ≤ 27,5), cuadro 88–113 ms en 14–18 cuadros. S5 de pared (informa): 391–436 ms. Cadena de 100 de S4: gesto 72–86 ms (PC 11,5–12,2).
- **Frías fuera de su rango (informan):** netbook S3 en las 3 (9,4–10,7 contra 9,3), S5 fría 1 (134,9) y 3 (123,6), F2 fría 1 (138,8), F3 fría 1 (312,0); PC F2 fría 1 (69,8).
- **Arrastres de `npm run bench` (pendiente de C1):** las escenas de 100, 500 y 2000 sin cables no cambian en `845fe69` (`crearEscenaBanco`, sin diferencias contra `48c6048`), así que se midió A = `845fe69` contra B = `946589a`, Edge headless, 3 corridas por lado intercaladas (informa; Edge del usuario abierto). Con todo seleccionado, por gesto: de 100, A 58,4 / 28,6 / 28,4, B 28,6 / 30,8 / 31,6 (los dos grupos de C1 no aparecen); de 500, A 66,9 / 71,2 / 66,2, B 60,4 / 58,4 / 63,2 (mediana +6,5 ms, +11 %, rangos que no se pisan). «Mover todo» de 2000 máx.: A 9,8–9,9, B 9,7–10,1. Ningún cuadro > 10,4 ms ni lento en las 6. Las filas con cables cambian de escena (J-A): informan.

## Escena oficial con la regla de W (fase 5, `codosBanco`) — 2026-11-22

**Criterio escrito antes de medir** (Bruno, J-A y ajustes del plan): ABBA `probar-webview2.mjs --fase5 --base-fase5`, 3 bloques, 6 aperturas por exe (fría + caliente). A = esta tarea; B = `48c6048`. Controles (B15, S1–S4) con la regla de siempre; B1–B14, B16, F1–F3 y S5 solo por su tope en la PC (tabla en `docs/plan-codosBanco.md`; B9, B2 2.º y B16 por gesto informan). El ABBA se repite una vez solo si falla un control; si falla una fila con la escena, se frena sin repetir.

**Cómo se midió:** enchufada, «Mejor rendimiento» (Bruno), sin Opera ni otra Bornera. Dos exes `tauri build --no-bundle` con `0.1.5-alpha.1` (tiene menú de desarrollo): B compilado de `48c6048` antes de tocar el código; A del árbol de la tarea. Edge 157.

**Resultado: pasa.** Controles: B15 igual; S1 18,0 / 21,5, S2 0,2 / 0,3 y 0,3 / 0,3, S3 2,8 / 3,2, S4 2,3 / 2,6 y 2,5 / 2,8 (mediana / máx. de las calientes; todo bajo tope y sin regresión). Con la escena, todo bajo su tope:

| Fila | Tope PC | Mediana A | Máx. A | B (informa) |
|---|---|---|---|---|
| S5 máx. | 100 | **48,5** | 49,4 | 93,3 |
| B1 1.º / 2.º | 150 / 300 | 51,4 / 53,5 | 61,2 / 66,3 | 47,0 / 48,5 |
| B2 1.º (2.º informa) | 40 | 10,8 (12,5) | 12,4 (16,9) | 9,3 (9,3) |
| B4 1.º / 2.º | 40 / 80 | 5,8 / 7,9 | 6,1 / 8,3 | 5,2 / 8,6 |
| B5 1.º / 2.º | 40 / 80 | 1,8 / 2,2 | 1,9 / 3,7 | 1,5 / 1,9 |
| B7 | 5 | 0,9 | 1,5 | 0,9 |
| B10 | 25 | 21,2 | 24,3 | 20,9 |
| B12 | 1,8 | 1,6 | 2,2 (≤ 2,8) | 1,1 |
| B13 p95 / máx. | 3 / 8 | 0,0 / 0,1 | 0,1 / 0,1 | 0,0 / 0,0 |

- Cuadros: B3 y B6 sin lentos (máx. 9,9 y 12,4 ms); B8, B11 y B14 sin cuadros > 16,7 ms (máx. 4,3, 11,0 y 1,0); B16 sin lentos, por gesto 9,1 (B 9,5). B9 N = 500 en las dos.
- F1 2,8–3,1 ms (≤ 9); F2 y F3 ≤ 73,3 ms (≤ 1 s). S5 de pared (informa): 164,4 ms (C1: 285,9). Cadena de 100 de S4: 5,1 / 12,5 ms.
- A − B que sube (informa, no juzga en J-A): B1 47,0 → 51,4 y 48,5 → 53,5, B2 9,3 → 10,8, B12 1,1 → 1,6. La escena nueva tiene más codos (4702 contra 4430) y otras redes (579 contra 714, 51 en corto contra 31).
- **Node (informa, antes → después):** `.brn` 653 364 → 655 938 caracteres; abrir (mediana) 23,6 → 23,6 ms; netlist mediana / máx. 4,19 / 5,99 → 5,58 / 11,37 ms (un proceso suelto; 2.ª corrida 4,88 / 6,63); R11 en reposo al abrir 167–176 → 97–189 ms en total, tramo más largo 7,76 → 6,97 ms, todos los de > 4 ms con GC.

## Cierre de la fase 5 en la PC (C1) — 2026-11-21

**Criterio escrito antes de medir** (Bruno, plan de C1): ABBA en WebView2 (`probar-webview2.mjs --fase5`: A corre «Probar la fase 5» y B «Probar la fase 4», 3 bloques, 6 aperturas por exe, una fría y una caliente) contra `7ed51e4` (cierre de la fase 4). B1–B16 con D6b-C, salvo **B2, que se juzga por la mediana (B-A, Bruno, antes de medir)**: B2 1.º decide y B2 2.º informa. F1–F3 con los topes de la PC. S1–S5 solo por tope (la base no tiene «Probar la fase 5»): mediana de las calientes ≤ tope y máx. ≤ tope + máx(1 ms, 10 %). Si una fila falla, se frena y se consulta, sin volver a medir. `codosBanco` va después de C1 (W-A): cambiaría la escena de B2, B16, F y S5.

**Cómo se midió:** enchufada (CA), «Mejor rendimiento» (`ded574b5…`), sin Opera, Perplexity ni otra Bornera. Dos exes `tauri build --no-bundle` con `0.1.4-c1.0` solo en `package.json` (local, revertida; sin el guion, la base no tiene menú de desarrollo): A = `4e3632e` (HEAD con `--conflicto` en fucsia); B = `7ed51e4`, de un worktree temporal con `npm ci` y `svelte-kit sync` (ya borrado). Edge 157.

**Resultado: no pasa por B1 2.º, causa conocida: GC.** S, F y B2 pasan; B1–B16 iguales salvo **B1 2.º 50,0 → 55,3** (tope 55,0).

| Fila | Número | Tope PC | Mediana A | Máx. A | Juicio |
|---|---|---|---|---|---|
| S1 | máx. | 54,5 | 18,9 | 19,6 | pasa |
| S2 | mediana | 1,7 | 0,1 | 0,1 | pasa |
| S2 | máx. | 5,3 | 0,3 | 0,3 | pasa |
| S3 | máx. | 16,7 | 2,9 | 3,0 | pasa |
| S4 | cuadro | 6,0 | 2,1 | 2,2 | pasa |
| S4 | gesto | 18,2 | 2,4 | 2,6 | pasa |
| S5 | máx. | 100,0 | 86,0 | 100,0 | pasa (máx. ≤ 110) |

- S1, desglose (mediana): R4 0,4 · netlist 4,0 · iniciar 1,1 · cuadro 13,7. S5 de pared (informa): 285,9 ms. Cadena de 100 de S4 (informa): 5,1 / 12,6 ms.
- F1 2,8–3,1 ms (≤ 9); F2 y F3 ≤ 80,4 ms (≤ 1 s).
- B1 (Duplicar todo 2000, paso): 1.º 45,7 → 48,5 (igual), **2.º 50,0 → 55,3 (sube)**; rangos de las calientes 45,5–56,5 (B) y 47,3–62,3 (A). B2 1.º 9,1 → 9,4 y 2.º 9,3 → 9,9: pasa con B-A y con la regla vieja.
- Frías fuera del rango de sus calientes (+1 ms, informan): 6 en A y 4 en B.

**Diagnóstico de B1 2.º (R2, reglas de Bruno antes de diagnosticar: ≤ 3 trazas por exe, sin repetir el ABBA ni volver a juzgar).** Trazas de CDP en WebView2 de «Probar la fase 4» (GC y muestras de CPU cada ~0,5 ms, mapeadas con los sourcemaps del mismo código), 2 por exe: una fría y una caliente. Los pasos de duplicar se separan por las muestras con `duplicarYDeshacer` en la pila.
- En la caliente de A, los 4 pasos medidos tardan 53,4, 49,7, 51,0 y 52,5 ms, con MinorGC de 5,1, 1,6, 5,2 y 4,6 ms: el más largo es el de más GC, y lo que va del más corto al más largo (3,7 ms) es lo que va de la GC (3,6). En B pasa lo mismo (más una MajorGC de 5,1 ms en un paso de calentamiento).
- Las dos versiones recorren las mismas funciones con el mismo reparto (uniones, cables, índice espacial, mosaicos); A no suma trabajo nuevo en el paso (los avisos, R11 incluida, ~1 ms en las dos).
- **Veredicto: el máximo de B1 lo pone la GC que cae dentro del paso.** C1 cierra «no pasa, causa conocida: GC», sin tarea nueva (regla de Bruno).

**`npm run bench`, arrastres (Edge headless, 3 corridas por lado intercaladas, `d16e96a` contra `946589a`): sin resultado claro, pendiente para C3** (medido en C3: ver arriba). Ningún número sube en las 3 corridas. Arrastre con todo seleccionado de 100, por gesto: A 54,6 / 98,8 / 108,2 ms, B 65,3 / 49,0 / 65,3 ms (dos grupos, cerca de 50–65 y de 100, en los dos). De 500: A 71,4 / 93,9 / 117,0, B 85,8 / 75,7 / 116,0. «Mover todo» de 2000, máx.: A 9,6 / 10,1 / 10,0, B 11,0 / 10,4 / 10,0. Los máximos por cuadro no cambian (≤ 3 ms en 100). Decide el ABBA, que no ve nada en B3, B6 ni B16.

## Dibujo del estado (fase 5, T33) — 2026-11-21

**Criterio escrito antes de medir** (`docs/plan-T33.md`): ABBA en WebView2 (`probar-webview2.mjs --fase5 --base-fase5`: A y B corren «Probar la fase 5», 3 bloques, 6 aperturas por exe, una fría y una caliente) contra `946589a`. B1–B16 con D6b-C; F1–F3 con sus topes de la PC. Tope de S1–S5: mediana de las calientes ≤ tope y máx. ≤ tope + máx(1 ms, 10 %); S1 54,5 ms, S4 6,0 / 18,2 ms (cuadro / gesto; máx. 7,0 / 20,0). No regresión de S2, S3 y S5 como en T32 (S5 sobre el tope y sin regresión: «no pasa, causa conocida»). **R-A:** S1 y S4 solo por tope; su no regresión informa (S1 cambia de definición: la base mide el sustituto sin estado; S4 no tiene base). La cadena de 100 de S4 informa y no frena (S4-B). `npm run bench` informa. Si una fila falla en la PC (S4 incluida), se frena y se consulta, sin volver a medir; S1 > 48 ms se avisa; B2 2.º con la regla vigente.

**Cómo se midió:** enchufada (CA), «Mejor rendimiento» (`ded574b5…`), sin Opera, Perplexity ni otra Bornera. Dos exes `tauri build --no-bundle` con `0.1.4-t33.0` solo en `package.json` (local, revertida); la base, de un worktree temporal en `946589a` con `npm ci` y `svelte-kit sync` (ya borrado). Edge 157.

**Resultado: pasa todo.** B1–B16 nada sube (B2 2.º 11,6 → 9,5, baja); F pasa; cierre de S: **pasa**.

| Fila | Número | Tope PC | Mediana A | Máx. A | Mediana B | No regresión |
|---|---|---|---|---|---|---|
| S1 | máx. | 54,5 | 19,2 | 21,8 | 19,4 | informa (R-A) |
| S2 | mediana | 1,7 | 0,1 | 0,2 | 0,2 | pasa (≤ 1,2) |
| S2 | máx. | 5,3 | 0,3 | 0,3 | 0,3 | pasa (≤ 1,3) |
| S3 | máx. | 16,7 | 2,9 | 3,4 | 3,3 | pasa (≤ 4,3) |
| S4 | cuadro | 6,0 | 2,1 | 2,4 | — | informa (R-A, sin base) |
| S4 | gesto | 18,2 | 2,3 | 2,8 | — | informa (R-A, sin base) |
| S5 | máx. | 100,0 | 95,3 | 98,1 | 94,7 | pasa (≤ 104,1) |

- S1, desglose (mediana): R4 0,4 · netlist 2,2 · iniciar 1,1 (con el dibujo del estado) · cuadro 14,0. S1 completa queda igual que el sustituto de T32 (19,4 en B). S5 de pared (informa): 323,9 ms.
- S4 cadena de 100 (informa, no frena): cuadro máx. 5,2 · gesto máx. 12,8 ms (medianas de las calientes).
- F1 2,8–3,9 ms (≤ 9); F2 y F3 ≤ 79,9 ms (≤ 1 s).
- Frías fuera del rango de sus calientes (+1 ms, informan): 3 en A y 9 en B.
- **`npm run bench` (Edge headless, una corrida de HEAD y una de la base, informa):** ningún cuadro lento en ninguna de las dos. Contra la base, 25 de 225 números suben más de máx(1 ms, 10 %), casi todos en el gesto de los arrastres de 100 y 500 símbolos (p. ej. arrastre con todo seleccionado de 100: 33,6 → 76,6 ms por gesto) y «Mover todo» de 2000 máx. 10,3 → 12,7. El ABBA en WebView2, que decide, no ve ninguna subida en B1–B16.

## Modo Simular (fase 5, T32) — 2026-11-21

**Criterio escrito antes de medir** (`docs/plan-T32.md`): ABBA en WebView2 (`probar-webview2.mjs --base-fase5`: A y B corren «Probar la fase 5», 3 bloques, 6 aperturas por exe, una fría y una caliente) contra `93eb13e`. B1–B16 con D6b-C; F1–F3 con sus topes de la PC. S1, S2, S3 y S5: tope (ajuste 1 de T31) y no regresión (mediana de A ≤ la de B + máx(1 ms, 10 %)). **Ajuste 1 de T32:** S5 solo sobre el tope y sin regresión cierra como «no pasa, causa conocida»; cualquier otra falla frena y se consulta, sin volver a medir.

**Cómo se midió:** enchufada (CA), «Mejor rendimiento» (`ded574b5…`), sin Opera, Perplexity ni otra Bornera. Dos exes `tauri build --no-bundle` con `0.1.4-t32.0` solo en `package.json` (local, revertida); la base, de un worktree temporal en `93eb13e` con `npm ci` (ya borrado). Edge 157.

**Resultado:** S, F y 15 de las 16 B pasan. **B2 2.º (máx. de deshacer): no pasa, causa conocida** (Bruno, 2026-11-21).

| Fila | Número | Tope PC | Mediana A | Máx. A | Mediana B | Límite (B + máx(1, 10 %)) | Juicio |
|---|---|---|---|---|---|---|---|
| S1 | máx. | 54,5 | 18,8 | 19,7 | 17,9 | 19,6 | pasa |
| S2 | mediana | 1,7 | 0,1 | 0,2 | 0,2 | 1,2 | pasa |
| S2 | máx. | 5,3 | 0,3 | 0,4 | 0,3 | 1,3 | pasa |
| S3 | máx. | 16,7 | 3,0 | 3,4 | 3,2 | 4,2 | pasa |
| S5 | máx. | 100,0 | 95,5 | 99,0 | 92,2 | 101,4 | pasa |

- Cierre de S (ajuste 1): **pasa**. S1, desglose (mediana): R4 0,4 · netlist 4,0 · iniciar 0,6 · cuadro 14,8; ahora por `Editor.entrarSimulacion`, la entrada de F5 (S-A). S5 de pared (informa): 319,9 ms. Frías de S5 de A hasta 103,5 (informan).
- F1 2,8–3,0 ms (≤ 9); F2 y F3 ≤ 72,7 ms (≤ 1 s).
- **B2 2.º: 9,6 → 10,8 ms (+1,2 ms, +12,5 %), sube por D6b-C.** Calientes de B: 9,7 · 9,2 · 11,9 · 9,6 · 9,5 · 10,2; de A: 9,1 · 11,7 · 9,3 · 9,9 · 11,8 · 11,6. En los dos exes el máximo cae en dos grupos (cerca de 9 y de 11,7 ms): A tuvo 3 de 6 en el alto y B 1. Los rangos se pisan (B 9,2–11,9 · A 9,1–11,8) y la mediana de B2 (1.º) no sube (9,3 → 9,1). El mismo síntoma apareció en T29 (B2 máx. 9,3 → 11,1). El camino de deshacer no pasa por el código de T32 (lectura del diff). **Decisión de Bruno: «no pasa, causa conocida»; no es un cambio de regla y no se volvió a medir.** Pendiente para C1: decidir, antes de medir, si B2 se juzga por la mediana.
- Frías fuera del rango de sus calientes (+1 ms, informan): 12 en A y 12 en B.

## Banco de mando, «Probar la fase 5» (fase 5, T31) — 2026-11-21

**Criterio escrito antes de medir** (`docs/plan-T31.md`): ABBA en WebView2 (`probar-webview2.mjs --fase5`, 3 bloques, 6 aperturas por exe, una fría y una caliente) contra `6a4a7dd` (AB-A). B1–B16 con D6b-C; F1–F3 con sus topes de la PC. **S (ajuste 1, cambio de regla autorizado por Bruno):** mediana de las calientes ≤ tope y máximo ≤ tope + máx(1 ms, 10 %); las frías informan.

**Cómo se midió:** enchufada, «Mejor rendimiento» (`ded574b5…`), Opera y Perplexity cerrados, sin otra Bornera. Dos exes `tauri build --no-bundle` con `0.1.4-t31.0` solo en `package.json` (local, revertida); la base, de un worktree temporal en `6a4a7dd` con `npm ci` (ya borrado). Edge 157. Escena de mando 2000: 2000 componentes + 2200 cables, 300 bobinas (E-A). S5: escena de F1–F3 (2000 + 3030), 44 tramos y 13 394 avisos R11 por vuelta.

**Resultado: pasa todo.** B1–B16, nada sube; F1 2,8–3,1 ms (≤ 9), F2 y F3 ≤ 77,4 ms (≤ 1 s).

| Fila | Número | Tope PC | Máx. permitido | Mediana calientes | Máx. calientes | Calientes | Juicio |
|---|---|---|---|---|---|---|---|
| S1 | máx. | 54,5 | 60,0 | 18,4 | 19,6 | 18,3 · 16,7 · 17,4 · 18,7 · 19,6 · 18,4 | pasa |
| S2 | mediana | 1,7 | 2,7 | 0,2 | 0,2 | 0,2 (las 6) | pasa |
| S2 | máx. | 5,3 | 6,3 | 0,3 | 0,3 | 0,3 (las 6) | pasa |
| S3 | máx. | 16,7 | 18,4 | 3,1 | 5,9 | 3,2 · 3,1 · 5,9 · 3,1 · 2,9 · 3,1 | pasa |
| S4 | — | 6,0 / 18,2 | | | | se mide en T33 (S4-A) | |
| S5 | máx. | 100,0 | 110,0 | 93,4 | **99,8** | 88,4 · 95,4 · 91,7 · 99,8 · 95,1 · 91,3 | pasa |

- **S1, desglose** (mediana de las calientes, ms): R4 0,4 · netlist 1,8 · iniciar 0,5 · cuadro 15,3. La netlist sola (N-A, informa): 1,7–4,3 ms. S1 queda lejos del aviso de 48 ms.
- **S5 está en el borde:** máx. 99,8 contra 100 (frías hasta 101,8). Es R11 de la escena con 10 250 aparentes (resuelto en `codosBanco`: S5 48,5 / 49,4).
- **S5 de pared** (informa): 292–335 ms desde abrir hasta los avisos: cada `setTimeout(0)` encadenado espera ≥ 4 ms en Chromium (44 tramos).
- Frías fuera del rango de sus calientes (+1 ms, informan): 12 en A (B1, B10, B11) y 10 en B.
- Chrome headless (humo, informa): S1 36,3, S2 0,6, S3 4,0, S5 112,6 ms de máximo.

## Avisos R10 y R11 (fase 5, T29) — 2026-11-21

**Criterio escrito antes de medir** (`docs/plan-T29.md`, T-A): ABBA en WebView2 (`probar-webview2.mjs --exe=A,B`, 3 bloques, 6 aperturas por exe, una fría y una caliente por apertura) contra `b6dbeee`, en la misma sesión. En las calientes, A − B ≤ máx(1 ms, 10 %) en mediana y máximo de B1, B2, B4, B5, B10, B12, B13 y B16; cuadros (B3, B6, B11, B14), lentos ±1; B9, mismo escalón. B7, B8, B9 y B15 son de control: si una sale de la regla, se repite el ABBA entero una sola vez.

**Cómo se midió:**
- Enchufada, en «Mejor rendimiento» (`ded574b5…`), sin otra Bornera. Administrador de tareas cerrado; Configuración, suspendida (sin CPU). LegionSpace y el overlay de NVIDIA no se pueden cerrar y estuvieron en todos los ABBA: son parte de la base.
- Los dos exes salen de `tauri build --no-bundle` con la versión `0.1.4-t29.0` solo en `package.json` (local, revertida, sin tag): con `0.1.4` no hay menú de desarrollo. La base, de un worktree temporal en `b6dbeee` con `npm ci` y `svelte-kit sync`, ya borrado. Edge 157.

**Primer ABBA oficial (`14da3c9`): no pasa B2 máx. ni B4 máx.** (calientes, ms):

| Fila | B (`b6dbeee`) | A (`14da3c9`) | Juicio |
|---|---|---|---|
| B2 máx. | 9,3 | 11,1 | sube |
| B4 máx. | 7,0 | 8,6 | sube |

El diagnóstico (traza de CDP en WebView2) descartó tramos de R11 dentro de los pasos: el banco corre cada escenario sin ceder el hilo, así que el reposo no corre en el medio. La suba venía del trabajo síncrono por comando (juntar lo pendiente, poner al día los vecinos de R11-A) y de una GC mayor en un pegado. Arreglos F1–F4 en `a6519f6`.

**ABBA oficial de `a6519f6` contra `b6dbeee`: pasa, nada sube.** Medianas de las calientes, en ms:

| Fila | Métrica | B (`b6dbeee`) | A (`a6519f6`) | Rango de A | Juicio |
|---|---|---|---|---|---|
| B1 | mediana / máx. | 45,0 / 51,5 | 43,8 / 47,7 | 41,7–45,1 / 44,2–48,5 | igual |
| B2 | mediana / máx. | 8,9 / 11,3 | 9,2 / 10,8 | 8,9–9,6 / 9,1–**17,4** | igual |
| B3 | lentos / máx. | 0 / 9,6 | 0 / 9,8 | | igual |
| B4 | mediana / máx. | 5,0 / 6,7 | 5,0 / 7,0 | 4,9–5,1 / 6,8–7,5 | igual |
| B5 | mediana / máx. | 1,4 / 1,6 | 1,5 / 2,3 | 1,5 / 1,5–3,2 | igual |
| B6 | lentos / máx. | 0 / 8,1 | 0 / 8,1 | | igual |
| B10 | valor | 20,9 | 20,1 | | igual |
| B11 | máx. / lentos | 9,7 / 0 | 9,1 / 0 | | igual |
| B12 | valor | 1,0 | 1,0 | | igual |
| B13 | mediana / máx. | 0,0 / 0,1 | 0,0 / 0,0 | | igual |
| B14 | máx. / lentos | 0,5 / 0 | 0,5 / 0 | | igual |
| B16 | lentos / por gesto | 0 / 8,4 | 0 / 8,2 | | igual |
| B7, B8, B9, B15 | control | | | | iguales |

- **Picos sueltos de A:** B2 máx. 17,4 ms (una vez en 6 calientes), B5 máx. 3,2 ms. No mueven la mediana.
- Frías fuera del rango de sus calientes (+1 ms, informan): 13 en A y 8 en B (B1, B3, B10 y B11 en A).
- **Node (informa, `tests/bench/r11-tramos-node.mjs`):** la escena oficial tiene 10 250 conexiones aparentes (13 394 avisos R11, cables de `codosBanco` que entran por el cuerpo). Con reloj real, el tramo más largo fue de 5,57 ms, y los 6 de más de 4 ms tuvieron una GC adentro. En `npm test`, el corte a 2 ms se prueba con un reloj falso (cambio de regla de Bruno).

## Netbook y PC el mismo día, K1 y K2 (fase 4, C4) — 2026-11-18

**Cómo se midió:**
- Las dos máquinas con el `.msi` del borrador de `v0.1.4-alpha.2` (`33680e5`). Se usó «Probar la fase 4» (menú de desarrollo), con 3 aperturas × (1 fría con calentamiento + 1 caliente) y «Copiar» cada vez. Edge 157 (WebView2).
- Netbook de 2:57 a 3:15 p. m. PC de 3:50 a 3:53 p. m., en las condiciones del banco.
- Los 12 textos quedaron fuera del repo (`frio1–3`, `caliente1–3`, `pcfrio1–3` y `pccaliente1–3`), igual que en la 3b. Acá va solo la tabla.
- **Excluidas: `c1.txt` y `c2.txt`** (netbook, 2:41 y 2:45 p. m.). Son dos frías anteriores a la serie de 3 aperturas, que no forman parte del protocolo. Se usaron las seis de la serie.

**F en la netbook (máximos en ms): pasan las tres en las 6 corridas.**

| # | Tope netbook | Calientes | Frías |
|---|---|---|---|
| F1 | ≤ 50 (calientes) | 12,0 / 3,5 / 3,6 | 3,4 / 4,1 / 3,8 (informan) |
| F2 | ≤ 1000 (todas) | 127,8 / 115,5 / 133,3 | 125,3 / 105,0 / 123,6 |
| F3 | ≤ 3000 (todas) | 162,7 / 154,6 / 153,7 | 166,3 / 157,8 / 157,0 |

- F1 = 12,0 en la caliente 1. En esa misma corrida, B5 2.º (20,3), B6 (1 lento) y B11 también se van. Es una corrida ruidosa; las otras dos dan 3,5 y 3,6.

**B1–B16 en la netbook: pasan con la regla vigente de la 3b.**
- **B10** (rehacer por gesto, informativa desde la 3b): 118,2–138,8 ms en las 6, contra los 62,5 del tope. En la 3b la mediana había dado 124,5. No es una regresión.
- **B11** (cuadros del rehacer): decide la mediana de las corridas (3b). Máx. 18,3 ms y 0,6 % > 16,7 ms, así que **pasa**. Corrida suelta que falla, informada: caliente 1, máx. 27,2 ms y 1,9 % (3 de 162).
- B9: N = 500 en las 6. Las demás filas, dentro del tope en todas las corridas.

**PC el mismo día (máximos en ms; topes de PC de C1):** F1 3,4 / 2,7 / 2,8 en las calientes (≤ 9). F2 31,6–39,7 y F3 50,7–64,1 en las 6 (≤ 1000). B1–B16 dentro del tope en las 6.

**Frías (regla de C4: dentro del rango de las calientes del mismo exe, más 1 ms; informan).** Salen de `friasFuera`.
- **Netbook:**
  - **B1** 1.º: 138,3 y 133,3, debajo de 141,2–156,8. 2.º: 144,2 (debajo) y 223,6 (arriba de 157,1–214,1).
  - **B3 máx.**: 21,7, arriba de 12,4–12,6, con 1 lento en la fría 3.
  - **B2** 1.º: 22,1, debajo de 24,2–25,6. 2.º: 37,0, arriba de 26,8–34,0, y 23,4, debajo.
- **PC:**
  - B1 1.º: 56,9 y 50,4. B1 2.º: 79,7, 53,0 y 52,6.
  - B10: 28,1. B16 por gesto: 11,7.
  - Todas arriba del rango.
- **B1 y B3 máx. siguen en seguimiento** (T26, T27, C1 y ahora la netbook). B1 se repite en todas las mediciones. En la netbook, varias frías quedan **por debajo** de las calientes: la fría no es siempre la más lenta.

**K1 y K2** (`calcular-factores.mjs`, mediana de las 3 calientes de cada máquina; grupos fijados en C1, con B13 incluido):

| # | K | PC | Netbook | Netbook / PC |
|---|---|---|---|---|
| B1 | K1 | 45,5 | 151,4 | 3,33 |
| B2 | K1 | 9,6 | 25,5 | 2,66 |
| B4 | K1 | 5,3 | 16,1 | 3,04 |
| B5 | K1 | 1,6 | 3,8 | 2,37 |
| B7 | K1 | 0,9 | 2,8 | 3,11 |
| B10 | K1 | 22,2 | 137,6 | 6,20 |
| B12 | K1 | 1,1 | 3,3 | 3,00 |
| B13 | K1 | 0,1 | 0,1 | 1,00 |
| F1 | K1 | 2,6 | 3,0 | 1,15 |
| F2 | K1 | 24,0 | 69,3 | 2,89 |
| B3 | K2 | 9,8 | 12,5 | 1,28 |
| B6 | K2 | 8,4 | 11,8 | 1,40 |
| B11 | K2 | 9,2 | 23,9 | 2,60 |
| B14 | K2 | 0,6 | 5,2 | 8,67 |
| B16 | K2 | 9,4 | 46,7 | 4,97 |
| F3 | K2 | 45,9 | 128,5 | 2,80 |

- **K1 = 2,94** (2,94375, entre F2 y B12). **K2 = 2,70** (2,6987, entre B11 y F3). Ninguno pasa K1 > 3 ni K2 > 5,5, así que A–D no se activan.
- El «3,0 sin B13» no se usa: sacar B13 cambiaría el grupo después de medir.
- **Notas para la fase 5:**
  - **B10 ×6,2:** el rehacer al 31 % con referencias es mucho más caro en la netbook que en la PC. El tope de B10 salía de ×2,5 y ya era informativo desde la 3b.
  - **B14 ×8,7:** el valor de la PC (0,6 ms) está cerca de la resolución de 0,1 ms. El cociente no es confiable.
  - B12 y B13 también están cerca de la resolución.
  - La elección de K para los topes de la fase 5 (A o D) queda para el plan de la fase 5.

## «Probar la fase 4» en la PC (fase 4, C1) — 2026-11-18

**Criterio escrito antes de medir** (`docs/plan-fase4.md`, sección 6, C1; commit `7c40c8a`):
- B1–B16: D6b-C sobre las medianas calientes. Si una fila no pasa y el diff de C1 no pasa por su ruta, queda «no pasa, causa conocida», sin volver a medir.
- F1 ≤ 9 ms de máximo en cada caliente. F2 y F3 ≤ 1 s, sobre el máximo de 5 vueltas, en todas las corridas.
- Las frías se informan con la regla de C4. K se anota.

**Cómo se midió:**
- `probar-webview2.mjs --fase4 --bloques=3`: A es el exe de C1 (`bbf650b`), que corre «Probar la fase 4»; B es `6d3ac66`, que corre «Probar la fase 3b».
- 6 aperturas por exe, cada una con una fría y una caliente.
- Enchufada, en «Mejor rendimiento» (modo `ded574b5…`), sin otra Bornera abierta. Edge 157 (WebView2).
- Los dos exes salen de `tauri build --no-bundle`. La base, de un worktree temporal con `npx svelte-kit sync`, ya borrado.
- El exe de C1 es `0.1.4-alpha.1` de release y muestra «Probar la fase 4» en el menú de desarrollo: es el mismo exe que empaqueta el `.msi`.

**F en la PC (A; máximos en ms): pasan las tres.**

| # | Tope PC | Calientes | Frías | Mediana de las calientes |
|---|---|---|---|---|
| F1 | ≤ 9 (calientes) | 2,9–3,1 | 2,8–3,0 (informan) | 2,6 |
| F2 | ≤ 1000 (todas) | 31,4–34,7 en las 12 | | 23,7 |
| F3 | ≤ 1000 (todas) | 45,5–57,5 en las 12 | | 46,0 |

- F2 y F3 corrieron «con disco»: un `.brn` de 73 448 bytes en la carpeta temporal. Al terminar no queda ningún `bornera-medicion-*` en `%TEMP%`.
- Las capacidades no cambiaron.
- De F3, la parte hasta el documento (leer, desempaquetar y deserializar) da como máximo 17,9 ms.
- Lo abierto es igual al documento, y la copia de F1, releída, es igual a `serializar`.
- La salida de emergencia de F1 da como máximo 7,8 ms; no decide.

**B1–B16 (calientes, mediana de 6): todas iguales o bajan, salvo B5 2.º.**
- **B5 2.º** (el máximo de deshacer «Pegar 500») va de 1,9 a 3,0: **no pasa, causa conocida**.
  - La ruta de B5 (pegar y deshacer en el editor y el dibujo, medidos dentro de `medir()` del banco) no tiene cambios en C1.
  - El diff de C1 en el camino de «Probar» es `medirConCalentamiento`: mueve las mismas llamadas a `medirFase3b` a una función, fuera de lo que se cronometra.
  - El valor tiene dos niveles por apertura en los dos exes: ~1,6–1,9 o ~2,8–3,4. A cayó 4 veces en el alto y B, 1. Los rangos se superponen: base 1,8–2,9, C1 1,6–3,2.
  - En T27, el mismo código de `6d3ac66` había dado 3,0 de mediana. Hoy da 1,9.
- Bajan: B2 2.º (11,1 → 9,6), B6 máx. (8,1 → 7,0) y B11 máx. (10,6 → 8,9). B9 = 500 en las 12 aperturas.

**Frías (regla de C4, informan): seguimiento de B1 y B3 máx.**
- **B1 sigue fuera en los dos exes:** 1.º y 2.º, 3 + 3 valores en la base y 2 + 2 en C1. Ya no es solo en el exe nuevo: pasa también en `6d3ac66`.
- **B3 máx. frío queda en rango** en los dos (C1: 9,7 de mediana fría). Esta vez no se repite.
- Además, en C1: B2 1.º (1 valor), B2 2.º (3) y B10 (1, 26,1 ms).
- La prueba real de las frías es la netbook en C4.

**Valores K de la PC** (mediana de las calientes de A; el factor sale en C4):
- K1: B1 45,5 · B2 9,3 · B4 5,0 · B5 1,4 · B7 0,9 · B10 20,6 · B12 1,0 · B13 0,0 · F1 2,6 · F2 23,7.
- K2: B3 9,7 · B6 7,0 · B11 8,9 · B14 0,6 · B16 9,3 · F3 46,0.
- B13 da 0,0 en la PC: no da cociente (`factores.mjs` lo deja fuera).

## Pulsadores desde S0 (fase 4, T27) — 2026-11-18

**Criterio escrito antes de medir** (`docs/plan-fase4.md`, T27): headless (`npm run bench -- --json`) en ABBA ×3 contra `5cf70f2`. Deciden todas las filas con la regla D6b-C, sobre la mediana de las 6 corridas de cada lado:
- «Por gesto» y la mediana del paso: ±10 % o ≤ 1 ms.
- Lentos: ±1.

WebView2 (`probar-webview2.mjs`) se corre solo si alguna fila no pasa.

**Cómo se midió:**
- Enchufada, en «Mejor rendimiento» (modo `ded574b5…`), sin otra Bornera abierta.
- La base sale de un worktree temporal en `5cf70f2`, ya borrado. Hizo falta `svelte-kit sync`: sin `.svelte-kit/`, Vite no transforma la página del banco y cada corrida espera los 10 min del límite.
- Los dos exes de WebView2 salen de `tauri build --no-bundle`. Edge 157.

**Headless: 14 de 75 filas no pasan** (corregido el 2026-11-18, en C1; antes decía 11, con 5 que bajan y 6 que suben). Ninguna pasa por el `Numerador`, y van para los dos lados: 4 bajan y 10 suben. Las tres que pasan por el `Numerador` dan igual (ms, mediana de 6):

| Escenario (2000 + 3000 cables + 30 T, al 31 %) | Por gesto: base | Por gesto: T27 | Paso: base | Paso: T27 | Lentos | Juicio |
|---|---|---|---|---|---|---|
| Pegar 500 y deshacer | 63,9 | 64,8 | 5,55 | 5,55 | 0 / 0 | igual |
| Duplicar todo (2000) y deshacer | 43,9 | 43,9 | 50,05 | 49,85 | 0 / 0 | igual |
| Etiquetar los vacíos (2000) y deshacer | 42,4 | 42,6 | 4,45 | 4,55 | 0 / 0 | igual |

**Las 14 que no pasan** (revisión en C1, sin volver a medir: los mismos 12 JSON del ABBA y el mismo `comparar.mjs` de la sesión de T27). **El 11 no se reproduce con esos JSON**, y no se sabe de dónde salió. Por gesto, en ms, mediana de 6 (Δ de T27 contra la base):

| Escena | Escenario | T27 | Base | Δ |
|---|---|---|---|---|
| 100 | Rehacer al 100 % | 15,4 | 12,4 | +25 % |
| 100 | Seleccionar al 31 % | 10,3 | 8,4 | +22 % |
| 100 | Mover 1 al 31 % | 12,9 | 18,6 | −31 % |
| 100 | Mover todo al 31 % | 43,8 | 53,3 | −18 % |
| 100 | Arrastrar 40 completos al 58 % | 49,2 | 40,7 | +21 % |
| 500 | Editar al 100 % | 8,3 | 10,3 | −20 % |
| 500 | Arrastrar 40 en contornos al 58 % | 20,85 | 18,95 | +10,03 % |
| 2000 | Editar al 31 % | 13,3 | 11,2 | +18 % |
| 2000 | Mover 1 al 31 % | 10,0 | 11,2 | −11 % |
| cables | Soltar con todo seleccionado al 31 % | paso 17,3 | paso 15,7 | +10,2 % (por gesto, igual) |
| cables | Arrastrar todo seleccionado al 31 % | 78,3 | 70,1 | +12 % |
| cables | Cable en curso al 58 % | 22,9 | 20,3 | +13 % |
| cables | Reconectar un extremo libre al 58 % | 25,8 | 22,4 | +16 % |
| cables | Previa de pegar 320 al 31 % | 61,3 | 52,2 | +17 % |

**Causa de cada fila: no se sabe.** Lo verificado:
- **No es código de T27.** El diff contra `5cf70f2` solo toca el `Numerador` (`menorLibre`, `etiquetarLote`, `etiquetarVacios`) y una propiedad de la biblioteca. Ninguna de las 14 pasa por ahí: las etiquetas de la escena salen de la generación del banco y el dibujo no cambió.
- **La corrida `12-A` vino lenta en todo:** +17 % de mediana sobre las 75 filas, y la más lenta en 38 de ellas. La `01-A` es la más lenta en 14. En ABBA ×3, la 1.ª y la 12.ª caen las dos en T27. Por qué vino lenta la 12, no se sabe.
- **El conjunto no es estable:** sin la `12-A` quedan 12, y sin la `01-A` ni la `12-A` también 12, pero entran y salen filas distintas. Con 6 corridas, ±10 % queda por debajo del ruido del headless en estas filas. Algunas tienen dos niveles en los dos lados (Rehacer al 100 %: ~12 y ~16 en T27 y en la base).

**WebView2: `probar-webview2.mjs --bloques=3`.** Son 6 aperturas por exe, cada una con una fría y una caliente. Tabla caliente (mediana de 6, ms):

| # | Métrica | Base | T27 | Juicio |
|---|---|---|---|---|
| B1 | 1.º / 2.º | 44,5 / 51,6 | 44,9 / 48,4 | igual / igual |
| B2 | 1.º / 2.º | 8,9 / 10,4 | 9,3 / 10,4 | igual / igual |
| B3 | lentos por gesto / en total / máx. | 0 / 0 / 9,7 | 0 / 0 / 10,2 | igual |
| B4 | 1.º / 2.º | 5,0 / 6,8 | 5,0 / 6,9 | igual / igual |
| B5 | 1.º / 2.º | 1,4 / 1,6 | 1,5 / **3,0** | igual / **sube** |
| B6 | lentos por gesto / en total / máx. | 0 / 0 / 7,5 | 0 / 0 / 8,1 | igual |
| B7 | valor | 1,0 | 0,9 | igual |
| B8 | máx. / lentos | 4,7 / 0 | 4,5 / 0 | igual |
| B9 | N | 500 | 500 | igual |
| B10 | valor | 20,5 | 20,9 | igual |
| B11 | máx. / lentos | 9,1 / 0 | **10,2** / 0 | **sube** / igual |
| B12 | valor | 1,0 | 1,1 | igual |
| B13 | 1.º / 2.º | 0,1 / 0,1 | 0,1 / 0,1 | igual |
| B14 | máx. / lentos | 0,5 / 0 | 0,8 / 0 | igual |
| B15 | lentos / máx. | 0 / 6,1 | 0 / 5,8 | igual |
| B16 | lentos / por gesto | 0 / 8,4 | 0 / 8,4 | igual |

**Rangos de las calientes en las dos filas que suben:**
- B5 2.º (máximo de deshacer «Pegar 500»): base 1,6–2,3, T27 1,7–3,2. Se superponen.
- B11 máx. (cuadros de rehacer con referencias): base 8,8–10,3, T27 8,8–12,6. Se superponen.

**Frías** (regla de C4: cada una dentro del rango de las calientes del mismo exe, más 1 ms; informan):
- **T27, 4 fuera:** B1 1.º (51,6), B3 máx. (13,4), B8 máx. (7,9) y B16 por gesto (10,3).
- **Base, 9 fuera:**
  - B1 1.º, 3 valores (49,1, 55,2 y 61,4).
  - B1 2.º, 1 valor (65,5).
  - B2 1.º, 1 valor (11).
  - B2 2.º, 2 valores (13,1 y 19,5).
  - B4 2.º, 1 valor (8,4).
  - B10, 1 valor (25,8).
- **B1 y B3 máx. se repiten de T26** (B1 ×3, B3 máx. ×2, B5 2.º ×2, B15 máx. ×1). Quedan en seguimiento para la medición de cierre de la fase 4.

**Veredicto:**
- D6b-C no pasa en B5 2.º y B11 máx.
- Causa conocida: máximos sueltos en filas que no pasan por el `Numerador`. Deshacer un pegado solo saca componentes, y B11 es dibujo.
- B1 y B4, las que sí pasan por el `Numerador`, dan igual.
- Por la regla, no se vuelve a medir para que pase.

## Borrar con T colgando (fase 4, T26) — 2026-11-18

**Criterio escrito antes de medir** (`docs/plan-fase4.md`, T26): decide B16 en caliente, con la regla D6b-C contra la base (±10 % o ≤ 1 ms; lentos ±1) y además el tope absoluto (≤ 11,10 ms por gesto; 0 lentos). B1–B15 se informan. Las frías se informan con la regla de C4 (dentro del rango de las calientes del mismo exe, más 1 ms).

**Cómo se midió:** `probar-webview2.mjs --exe=<T26>,<67e9c4c> --bloques=3`, con 6 aperturas por exe y una corrida fría y una caliente en cada una. Los dos exes salen de `tauri build --no-bundle`; la base, de un worktree temporal en `67e9c4c`, ya borrado. Edge 157 (WebView2).

**1.ª corrida, no vale.** La PC estaba enchufada, pero no se comprobó que estuviera en «Mejor rendimiento»: solo se miró el plan base («Equilibrado»).
- B16 da 10,9 en la base y 11,6 en T26: +0,7 ms, igual por el piso, pero por encima del tope de 11,10.
- Se ve que la sesión vino lenta y dispersa:
  - La base misma va de 8,9 a 17,1 en B16.
  - B1 1.º da 58,5 contra 45,8 en T23.
- Se repitió con el OK de Bruno.

**2.ª corrida (la que vale):** enchufada, en «Mejor rendimiento» (modo `ded574b5…`), sin otra Bornera abierta.

| # | Métrica | Base | T26 | Juicio |
|---|---|---|---|---|
| B16 | por gesto | 8,3 | 8,3 | igual |
| B16 | lentos | 0 | 0 | igual |

- **B16 pasa:** igual a la base y dentro del tope (8,3 ≤ 11,10; 0 lentos). Era lo esperado: B16 borra un componente, y por ese camino la cascada no arma el mapa de las T.
- **B1–B15 (informan):** nada sube; B9 = 500 en las 12 aperturas.
- **Frías (C4, informan):**
  - En la base, 0 valores fuera del rango.
  - En T26, 8 valores fuera, todos máximos sueltos de filas que no pasan por `Borrar`: B1 (3), B3 máx. (2), B5 2.º (2) y B15 máx. (1). Es lo mismo que se vio en T20, donde esos máximos varían igual entre corridas calientes.
  - Las frías de B16 quedan en rango en los dos exes.

## Autoguardado y costo de editar (fase 4, T23 etapa 5, D1) — 2026-11-17

En Node, escena 2000 + 3030 cables, `Editor` real. Cada vuelta hace Mover 1, deshacer, rehacer y Mover de vuelta, con el autoguardado conectado (relojes reales, almacén en memoria) o sin él, alternando. Son 3 procesos y 300 vueltas por modo (más 40 de calentamiento). Script temporal, no commiteado. En ms:

| Proceso | Comando | Mediana sin | Mediana con | Extra (mediana) | Máx. sin | Máx. con | Extra (máx.) |
|---|---|---|---|---|---|---|---|
| 1 | mover | 13,363 | 13,699 | 0,336 | 45,499 | 34,766 | −10,733 |
| 1 | deshacer | 0,416 | 0,429 | 0,012 | 3,208 | 2,452 | −0,756 |
| 1 | rehacer | 0,462 | 0,475 | 0,013 | 3,263 | 2,462 | −0,801 |
| 1 | volver | 10,920 | 10,941 | 0,021 | 34,945 | 25,001 | −9,944 |
| 2 | mover | 12,952 | 12,998 | 0,047 | 31,562 | 32,442 | 0,881 |
| 2 | deshacer | 0,431 | 0,437 | 0,006 | 3,707 | 2,947 | −0,759 |
| 2 | rehacer | 0,469 | 0,475 | 0,006 | 25,339 | 2,102 | −23,236 |
| 2 | volver | 10,412 | 10,469 | 0,057 | 55,657 | 51,702 | −3,956 |
| 3 | mover | 12,304 | 12,368 | 0,065 | 28,733 | 38,415 | 9,682 |
| 3 | deshacer | 0,435 | 0,443 | 0,008 | 5,518 | 2,764 | −2,754 |
| 3 | rehacer | 0,479 | 0,485 | 0,005 | 2,771 | 3,258 | 0,487 |
| 3 | volver | 9,972 | 10,047 | 0,075 | 28,673 | 27,308 | −1,365 |

- **`alCambiar` sola** (20 000 llamadas, rearma el reloj cada vez): mediana 0,001 ms, p99 0,002–0,003 ms y máx. 0,16–0,19 ms en los 3 procesos. Es lo único que el autoguardado suma a cada comando.
- **La resta con − sin no resuelve:** los máximos de Mover saltan de 25 a 55 ms en los dos modos, y la resta da de −23 a +9,7 ms.
- **Juicio (opción A de Bruno):** D1 se juzga con `alCambiar` sola, contra los topes fijados de 0,1 ms (mediana) y 1 ms (máx.): **pasa**. Detalle en `docs/plan-T23.md`, etapa 5.
- **Banco en Chrome** (`npm run bench`, informativo): F1 = 2,8 ms, mediana 2,5 ms, 10 pasos por copia; salida de emergencia (3 de una vez), máx. 16,9 ms.

## Copia de recuperación y ABBA en WebView2 (fase 4, T23 etapa 5) — 2026-11-18

PC enchufada, en «Mejor rendimiento», sin otras apps abiertas. WebView2 Edg/157, exes de release en la misma sesión: HEAD `fb11f65`, la 1b `85cd377` y la base `32c32b4` (antes de T23).

**F1 final** (`f1-webview2.mjs --exe=<1b>,<HEAD> --procesos=3`, intercalados, 20 copias por proceso con 2000 + 3030 cables). F1 es el paso síncrono más largo de la copia:

| Exe | Proceso | Mediana | Máx. | Primera | De una vez (aparte) |
|---|---|---|---|---|---|
| 1b | 1 | 2,8 | 3,0 | 2,8 | — |
| HEAD | 2 | 2,6 | 2,8 | 2,6 | 3 veces, máx. 8,3 |
| 1b | 3 | 2,6 | 3,1 | 2,8 | — |
| HEAD | 4 | 2,7 | 3,1 | 2,8 | 3 veces, máx. 8,1 |
| 1b | 5 | 2,6 | 2,9 | 2,7 | — |
| HEAD | 6 | 2,6 | 2,9 | 2,6 | 3 veces, máx. 8,4 |

- **F1 = 3,1 ms (el mayor de 60) en los dos exes, mediana 2,6 ms. Pasa (≤ 9 ms; objetivo ~3 ms).**
- Se informa, no decide: 5 pasos por copia, duración total con mediana de 20,4 ms y máximo de 130 ms, 0 reinicios.
- Salida de emergencia (D3-A, 3 copias forzadas de una vez por proceso, solo en HEAD): 9 veces, máx. 8,4 ms. Aparte; no decide. La 1b no las tiene.

**ABBA de «Probar la fase 3b»** (`probar-webview2.mjs --exe=<HEAD>,<base>`, 3 bloques, 6 aperturas por exe, una fría y una caliente por apertura). Juicio con la regla D6b-C, sobre la mediana de las 6 calientes. En ms, salvo B9:

| # | Métrica | Base | HEAD | Juicio |
|---|---|---|---|---|
| B1 | 1.º / 2.º | 45,8 / 50,2 | 44,5 / 48,3 | igual |
| B2 | 1.º / 2.º | 9,0 / 10,2 | 8,9 / 10,1 | igual |
| B3 | máx. | 9,7 | 9,8 | igual |
| B4 | 1.º / 2.º | 4,8 / 6,8 | 4,8 / 6,9 | igual |
| B5 | 1.º / 2.º | 1,5 / 2,4 | 1,4 / 1,7 | igual |
| B6 | máx. | 8,3 | 7,2 | baja |
| B7 | valor | 1,1 | 1,0 | igual |
| B8 | máx. | 4,4 | 4,4 | igual |
| B9 | N | 500 | 500 | igual (las 12 aperturas) |
| B10 | valor | 20,4 | 20,4 | igual |
| B11 | máx. | 9,0 | 9,1 | igual |
| B12 | valor | 1,0 | 1,0 | igual |
| B13 | 1.º / 2.º | 0,0 / 0,1 | 0,0 / 0,1 | igual |
| B14 | máx. | 0,6 | 0,5 | igual |
| B15 | máx. | 5,7 | 5,8 | igual |
| B16 | por gesto | 8,8 | 8,6 | igual |

- Los lentos dan 0 en todas las filas y en los dos exes. Los % y los cuadros de B8, B11 y B14 se informan: son iguales.
- **Calientes: pasa, nada sube.** No hizo falta el desglose en Node.
- La prueba corta previa (1 bloque, 2 calientes por exe) había marcado B2 1.º (+1,0 ms) y B6 máx. (+1,3 ms). Con las 6 calientes del ABBA ×3, ninguna de las dos sube: era ruido de pocas muestras.

## Línea base PC de «Probar la fase 3b» (fase 4, T20) — 2026-11-17

**Regla escrita y commiteada antes de medir** (`ac3fded`, `docs/plan-fase4.md`, regla de D6b-C): piso de 1 ms, lentos ±1, B9 en el mismo escalón.

**Cómo se midió:**
- PC enchufada, en «Mejor rendimiento», con las apps cerradas. Edge 157 (WebView2), lienzo 1366×768 fuera de pantalla.
- Todo en la misma sesión (8:05 a 8:26), sin reiniciar la PC.
- Cada variante es un exe de `tauri build --no-bundle` desde `ac3fded`, con su cambio.
- En cada variante, 2 aperturas de la app: la 1.ª corrida de cada apertura es fría (F) y la 2.ª caliente (C).
- **Base de la fase:** las calientes de la pasada entera.

**Variantes:**
- **antes:** `ac3fded`, sin cambios.
- **wRF:** `willReadFrequently: true` en `contexto()`.
- **corta:** calentamiento de 1 repetición por escenario.
- **entera:** calentamiento con las repeticiones normales (queda). Tiene una 3.ª caliente (C3).

Valores en ms (en B8, % de cuadros > 16,7 ms; en B15, lentos). Cada celda tiene el formato «F1 · F2 | C1 · C2».

| # | Medida | antes | wRF | corta | entera (C3) |
|---|---|---|---|---|---|
| B1 | paso: máx. | 43,6 · 48,0 \| 53,9 · 46,8 | 46,6 · 48,5 \| 47,0 · 44,9 | 55,8 · 55,2 \| 47,0 · 46,2 | 48,5 · 56,2 \| 50,7 · 46,0 (57,3) |
| B1 | paso: mediana | 42,9 · 46,6 \| 45,2 · 45,2 | 42,4 · 45,8 \| 45,9 · 44,5 | 46,2 · 46,4 \| 45,7 · 44,9 | 46,0 · 47,6 \| 44,4 · 44,8 (45,3) |
| B2 | deshacer: máx. | 11,9 · 9,9 \| 9,6 · 9,9 | 9,9 · 10,4 \| 9,9 · 9,7 | 8,9 · 12,1 \| 9,5 · 10,3 | 9,6 · 9,4 \| 9,5 · 9,4 (9,2) |
| B3 | cuadros: máx. | 9,9 · 9,8 \| 9,7 · 9,6 | 15,3 · 16,3 \| 23,6 · 15,3 | 12,6 · 9,8 \| 9,7 · 9,7 | 11,3 · 9,6 \| 9,7 · 9,6 (13,1) |
| B4 | paso: máx. | 6,6 · 6,4 \| 7,0 · 6,2 | 7,5 · 13,2 \| 7,1 · 6,6 | 6,8 · 6,9 \| 6,7 · 6,4 | 7,1 · 8,6 \| 6,7 · 6,7 (7,1) |
| B6 | cuadros: máx. | 8,5 · 6,9 \| 6,7 · 7,9 | 10,2 · 11,1 \| 9,8 · 10,9 | 9,0 · 8,2 \| 8,3 · 7,9 | 8,3 · 7,2 \| 6,9 · 8,4 (6,8) |
| B8 | cuadros: máx.; % | 68,3; 15,8 · 74,2; 15,8 \| 4,4 · 4,1 | 6,6 · 6,8 \| 5,9 · 5,8 | 4,3 · 4,4 \| 4,2 · 4,1 | 4,2 · 4,3 \| 4,3 · 4,2 (4,3) |
| B10 | por gesto | 22,5 · 22,5 \| 22,6 · 24,3 | 24,0 · 25,4 \| 24,0 · 25,2 | 21,8 · 22,0 \| 22,7 · 23,2 | 21,6 · 22,0 \| 22,0 · 23,3 (21,3) |
| B11 | cuadros: máx. | 9,0 · 9,0 \| 9,1 · 10,8 | 15,4 · 16,2 \| 15,3 · 15,6 | 9,3 · 9,0 \| 9,0 · 9,1 | 8,9 · 9,1 \| 9,0 · 11,2 (8,8) |
| B15 | lentos; máx. | 2; 17,6 · 0; 15,9 \| 0; 6,1 · 0; 7,2 | 0; 7,9 · 0; 7,6 \| 0; 7,2 · 0; 7,9 | 0; 5,9 · 0; 6,0 \| 0; 6,9 · 0; 6,3 | 0; 6,3 · 0; 5,7 \| 0; 6,5 · 0; 6,3 (0; 6,0) |
| B16 | por gesto | 98,0 · 96,1 \| 10,0 · 9,0 | 15,7 · 16,8 \| 14,8 · 15,1 | 9,1 · 8,7 \| 10,0 · 9,5 | 9,1 · 8,8 \| 8,8 · 8,8 (8,1) |

- **B5, B7, B9, B12, B13 y B14** quedan igual en todas las variantes, dentro del piso. B9 da N = 500 en todas.
- **Calentamiento:** 13 y 14 s con la corta, 14 y 13 s con la entera. El tiempo se va en armar las escenas, no en las repeticiones. En la netbook, con ×3 a ×5,5, serían unos 40 a 75 s más en la primera corrida.

**Resultado:**
- **wRF no se queda: falla (b).**
  - En caliente, B3, B6, B8, B11 y B16 suben entre 38 y 100 % contra «antes».
  - El lienzo pasa a la CPU y todos los cuadros se rasterizan más lento.
  - Saca el frío (B8 de 68–74 a 6,7 ms; B16 de 96–98 a 16 ms) a costa de alejarse de la app, que dibuja en GPU.
- **El calentamiento entero queda.** B8, B15 y B16 en frío ya dan como en caliente.
  - Según la regla tal como estaba escrita, (a) no pasa ni con la corta ni con la entera: fallan máximos sueltos de B1, B3 y B4 (+16 a +30 %).
  - La causa es conocida: esos máximos varían lo mismo sin frío de por medio.
- **Ruido de referencia:** el máx. de B1 en las 7 corridas calientes del día con el lienzo en GPU (antes, corta y entera; sin wRF) da 53,9, 46,8, 47,0, 46,2, 50,7, 46,0 y 57,3 ms. Va de 46 a 57 ms, un ±11 % alrededor de 51. Un máx. suelto no alcanza para decidir; por eso C4 juzga las frías por el rango de las calientes (`docs/plan-fase4.md`).

## Cierre de la fase 3b, contra `v0.1.3` — 2026-11-16

**Criterios escritos antes de la primera corrida (15:29)**: plan de cierre, sección 6, con los ajustes de Bruno al aprobar la etapa 3. No se cambian después de ver los números.

- **Versiones:** HEAD es `ef28cfd`. La base es `v0.1.3` (`c29886d`), en el worktree `..\bornera-base-v0.1.3` con su propio `npm ci` y **su propio** `tests/bench/pagina.ts`. Se comparan las 62 celdas con el mismo nombre en las dos; los 13 escenarios nuevos se corren solo en HEAD.
- **Corridas:** ABBA ×3 en dos tandas (A = HEAD), o sea 12 corridas por tanda, 6 por versión.
- **Agregado por tanda:** cada tanda tiene sus propias 6 corridas de cada versión, sin juntar las dos tandas. Para cada celda:
  - mediana, p95 y por gesto: la mediana de las 6, sin redondear;
  - lentos: la suma de las 6, con el número de corrida de cada uno;
  - «máx.» de los topes: el máximo de las 6;
  - R6: p95 y máximo de las 180 pasadas juntas (como en T19).
  - Se compara con una tolerancia de 0,000001 ms, solo por cómo se guardan los decimales del reloj.
- **Freno duro:** antes de cada corrida, el script anota en el JSON de esa corrida estos valores:
  - enchufada o no;
  - batería;
  - modo de energía, leído del registro;
  - procesos con ventana;
  - Opera o Gemini abiertos.
  
  Si la PC no está enchufada o el modo no es «Mejor rendimiento», no mide y la tanda se corta.
- **Celdas comunes, regla de siempre** (como en T15–T19):
  - No pasa si el **por gesto** de HEAD supera al de la base en más de 10 % en las dos tandas.
  - No pasa si aparece un **lento nuevo** en las dos tandas: HEAD con lentos y la base con 0 en esa misma tanda. Si aparece en una sola, se informa con la celda y la corrida.
  - La mediana y el p95 por cuadro se informan; no juzgan.
- **Celdas con tope absoluto** (sección 6.1): se juzgan por estos topes.
  - Una fila no pasa si supera su tope en las dos tandas. Si lo supera en una sola, se informa.
  - Para estas filas, los lentos se juzgan por el tope y no por la regla de siempre. El por gesto sigue la regla de siempre, salvo en *500 · Encuadrar (F)*, que tiene tope de por gesto.

| Celda | Tope (mediana / p95 por cuadro, en ms) | Lentos |
|---|---|---|
| 100 · Seleccionar al 31 % (T16, ruido) | ≤ 0,70 / ≤ 1,16 | 0 |
| 100 · Mover 1 al 31 % (T16, ruido) | ≤ 0,45 / ≤ 1,16 | 0 |
| 100 · Mover todo al 31 % (T17) | ≤ 0,90 / ≤ 2,15 | 0 |
| 100 · Arrastrar 40 completos al 58 % (T17) | ≤ 1,65 / ≤ 4,07 | 0 |
| 500 · Arrastrar 40 en contornos al 58 % (T17) | ≤ 0,70 / ≤ 2,97 | 0 |
| 500 · Mover todo al 31 % (T18, ruido de p95) | ≤ 1,71 / ≤ 4,24 | 0 |
| 2000 · Editar al 100 % (T18, ruido) | ≤ 0,55 / ≤ 0,95 | 0 |
| 500 · Encuadrar (F) (T17 y T19) | ≤ 6,66 / ≤ 10,23; por gesto ≤ 8,74 | 0 |
| 2000 · Editar al 31 % (T19) | p95 ≤ 1,21 | 0 |
| 2000 con cables · Desplazar al 100 % (T19) | p95 ≤ 0,45 | 0 |
| 2000 con cables · Arrastrar 40 cableados al 58 % (T19) | – | como mucho 1 corrida con lentos por tanda; ninguno de más de 50 ms |
| 2000 con cables · Girar todo al 31 % (T19) | – | ídem |

- **Escenarios nuevos** (sección 6.2, solo HEAD, escena con cables al 31 %): no pasan si superan el tope en las dos tandas.

| Escenario | Tope (ms) |
|---|---|
| Pegar 500 y deshacer | paso y deshacer: mediana ≤ 40, máx. ≤ 80; 0 lentos |
| Duplicar todo (2000) y deshacer | paso: mediana ≤ 150, máx. ≤ 300; deshacer: mediana ≤ 40, máx. ≤ 80; 0 lentos |
| Previa de pegar 40, 80, 160, 320 y 500 | cuadro: mediana ≤ 4, p95 ≤ 8; 0 lentos; revisión por punto: p95 ≤ 5 (40, 80 y 160) |
| Copiar 2000 | se informa |
| Etiquetar los vacíos (2000) y deshacer | paso y deshacer: mediana ≤ 40, máx. ≤ 80; 0 lentos |
| Rehacer al 31 % con referencias | por gesto ≤ 25,01; 0 lentos |
| Mover 1 contacto con referencias | paso: mediana ≤ 1,80; 0 lentos |
| Rehacer al 31 % con avisos | por gesto ≤ 26,11; 0 lentos |
| Dibujar 1 cable con 2000 y un par NC+bobina | R6: p95 ≤ 3, máx. ≤ 8; 0 lentos |

- **Si algo no pasa:** se frena, se dan opciones y el worktree base no se borra hasta que Bruno elija. Una de las opciones es el diagnóstico ×10: ABBA ×5 contra la misma base, solo en las filas que no pasaron, con estas reglas:
  - **Celda común:** la suba es real si HEAD supera a la base en más de 10 % en esa métrica en al menos **7 de los 10 pares**. Los pares son, en cada bloque ABBA, (1.ª A, 1.ª B) y (2.ª B, 2.ª A).
  - **Fila con tope:** el exceso es real si HEAD supera el tope en al menos 7 de sus 10 corridas.
  - **Lento:** es real si HEAD tiene lentos en 2 o más de sus 10 corridas y la base en ninguna (la regla de T19).
- **Antes de fijar los criterios** se corrió un par de prueba, una corrida de cada versión, para ver el formato del JSON. Se descartó: HEAD corrió primero, justo después del `npm ci` de la base, y con Bornera y el Administrador de tareas abiertos.

### Resultado: pasa, con un costo aceptado (opción A de Bruno)

**Corridas:**
- ABBA ×3 en dos tandas, de 15:29:56 a 15:37:33, unos 15 a 26 s por corrida. Ninguna frenó.
- Edge 157 headless. PC enchufada (79 %), modo «Mejor rendimiento» en las 24.
- Con ventana, solo Claude y Configuración (más el NVIDIA Overlay y la entrada de texto de Windows).
- En las corridas 6 a 9 de T1 había una ventana de `fontview` (el visor de fuentes de Windows). T1 salió más ruidosa que T2 en casi todas las celdas.

**Veredicto con los criterios de arriba:**
- Las 12 filas con tope pasan: ninguna lo supera en las dos tandas.
- Los 13 escenarios nuevos pasan, lejos de sus topes. Por ejemplo, *Duplicar todo* da un paso de 54,95 / 49,55 ms contra 150, y R6 da p95 0 contra 3.
- Ningún lento nuevo, ni en una tanda ni en las dos.
- **No pasaba una celda común:** *2000 con cables · Borrar y deshacer uno con cables al 31 %*. Por gesto, de 8,87 a 10,08 ms en T1 (+13,7 %) y de 6,80 a 7,88 ms en T2 (+15,9 %).

**Informado** (no juzga):
- Topes superados en una sola tanda, todos en T1:
  - 100 · Mover 1: mediana y p95;
  - 100 · Mover todo: mediana;
  - 500 · Mover todo: mediana y p95;
  - 500 · Arrastrar 40 en contornos: mediana y p95;
  - 2000 · Editar al 31 %: p95;
  - 2000 con cables · Desplazar al 100 %: p95;
  - *Rehacer al 31 % con referencias*: 26,40 contra 25,01 (en T2, 22,66).
- *2000 · Mover 1 al 31 %* sube la mediana por cuadro en las dos tandas: de 0,45 a 0,50 y de 0,40 a 0,50.
- Lentos: solo uno de la base, en *Girar todo al 31 %* (T1, corrida 3, 17,9 ms).

**Diagnóstico ×10 de *Borrar y deshacer uno con cables*** (reglas de arriba):
- ABBA ×5, de 15:39 a 15:47, en las mismas condiciones.
- La corrida 7 se cortó porque se abrió el Administrador de tareas, y se repitió. El script repite cualquier corrida con una ventana de más antes o después de medir.
- Resultado: **HEAD supera a la base en más de 10 % en 8 de los 10 pares: es real.** Por gesto, mediana de 10: base 7,10 ms y HEAD 8,25 ms (+1,15 ms). 0 lentos en las dos.

**Desglose en Node** (HEAD contra `v0.1.3`, ×10 alternado, 40 gestos de 10 pasos por proceso, el mismo componente `c916`; un test temporal, borrado):
- Los dos repintan los mismos 10 mosaicos por gesto, con 110 invalidaciones. HEAD da **+1480 órdenes de dibujo por gesto (+30 %)**: una poligonal de 72 rayas más por mosaico repintado. Sin contornos ni listas, HEAD da las mismas órdenes que la base: todas son del contorno de aviso de T19, ninguna de las listas.
- La poligonal de cada mosaico es **solo la de los componentes que lo tocan**:
  - toda la hoja tiene 277 componentes con contorno y 4432 rayas;
  - por mosaico de 41,3 unidades al 31 %, hay como mucho 192;
  - en los mosaicos sin avisos propios, hay 0 o hasta 32 (un vecino cuyo dibujo toca el borde).

| Suba del por gesto (1,15 ms en el navegador) | ms | % |
|---|---:|---:|
| Comando, Uniones, referencias y validaciones | 0 (son del paso, fuera del cuadro) | 0 |
| Dibujo en JS: contornos de aviso | +0,14 | 12 |
| Dibujo en JS: el resto | +0,11 | 9 |
| Rasterizado (navegador menos Node, estimado: Node no rasteriza) | ≈ +0,91 | ≈ 79 |

| Suba del paso (se informa; 3,92 ms por gesto, 0,39 por paso) | ms por gesto | % |
|---|---:|---:|
| Referencias (`ReferenciasHoja.reflejar`) | +3,43 | 87 |
| Validaciones (`AvisosHoja.reflejar`) | +0,21 | 5 |
| Comando | +0,05 | 1 |
| Uniones | +0,02 | 0 |
| Resto de reflejar | +0,23 | 6 |

**Decisión de Bruno (opción A):**
- Se acepta como costo de los contornos de aviso, con tope absoluto: el valor más alto de HEAD (10,08, en T1) más 10 %, o sea **por gesto ≤ 11,10 ms; 0 lentos**.
- Se suma a la lista 6.1 del plan de cierre y a la checklist de la netbook (B16).
- `referencias.reflejar` queda en `docs/ideas.md`.
- La escena del banco es el peor caso, porque casi todos los mosaicos tienen contornos. Un circuito «Sin avisos» no paga nada de esto.

## Validaciones en vivo (fase 3b, T19 etapa 3b) — 2026-11-16

**Resultado: pasa** contra `926915d` (sin validaciones), medido en la misma sesión con los criterios de `docs/archivo/plan-T19.md`, sección 5, fijados antes de medir.
- **R6 dentro del paso** (*Dibujar 1 cable con 2000 y un par NC+bobina*): p95 0,0 y 0,1 ms, máximo 0,1 ms, en 180 pasadas por tanda. Tope: p95 3 ms y ninguna de más de 8 ms. En la etapa 3a, con `redes()` sobre la hoja entera, había dado p95 3,20 ms y frenado la tarea.
- ***Pegar 500*, *Duplicar todo* y *Rehacer al 31 % con avisos*: pasan.** *Duplicar todo* pasa sin usar la tolerancia de 2 ms (abajo).
- ***Etiquetar los vacíos*** sube más de 10 % en las dos tandas, pero queda muy debajo de su tope de lote de T17 (40/80 ms): pasa por el ajuste (a) de Bruno.
- **Celdas comunes:** 2 de 71 suben de p95 en las dos tandas. Hubo 2 lentos de HEAD, los dos en la misma corrida. El diagnóstico, con sus reglas fijadas antes de medir, dio **las cuatro filas como ruido** (abajo).
- **Para la netbook**, al cierre de la fase 3b (`docs/plan-fase3b.md`): los cuadros que siguen a *Pegar 500* y a *Duplicar todo* (abajo) y *Dibujar 1 cable*.

**Cómo se midió:**
- **Versiones:**
  - HEAD es la etapa 3b sobre `c676f69` (`5f4e1d1` más un cambio solo en el README), sin commit al medir. Después, commit `edd2c03`.
  - La base es `926915d`, en un worktree con su propio `npm ci` y el `tests/bench/pagina.ts` de HEAD copiado sin commit. El `pagina.ts` era idéntico en los dos árboles (mismo sha256).
- **Corridas:** ABBA ×3 en dos tandas, 6 corridas por versión en cada tanda; por celda, la mediana de las 6. Fue de 12:11:02 a 12:19:05 (hora de Argentina), unos 20 s por corrida.
- **Condiciones**, anotadas por el script antes de cada una de las 24 corridas:
  - Edge 157 headless.
  - PC enchufada y cargando (del 69 al 76 %), modo "Mejor rendimiento".
  - Con ventana, solo Claude y Configuración (más el NVIDIA Overlay y la entrada de texto de Windows). Abiertos sin ventana: SpotifyLauncher, OneDrive Sync y el servicio sandbox de Codex.
- **Un ABBA anterior se descartó:** el del 2026-11-15 se cortó en 15 de 24 corridas, al terminar la sesión, y se descartó sin analizarlo.
- La primera medición de T19 (etapa 3a, frenada) y el desglose en Node de cada arreglo de la 3b están en `docs/archivo/plan-T19.md`, etapas 3a y 3b.

### Escenarios con criterio propio (escena con cables, al 31 %)

T1 / T2: mediana de las 6 corridas de cada tanda, en ms.

| Escenario | Medida | Base | HEAD | Criterio | Resultado |
|---|---|---:|---:|---|---|
| Dibujar 1 cable con 2000 y un par NC+bobina | R6: p95 / máx. | – | 0,0 / 0,1 · 0,1 / 0,1 | p95 ≤ 3, máx. ≤ 8; 0 lentos | pasa |
| ″ | paso / deshacer | 0,30 / 0,10 | 0,30 / 0,10 | se informa | – |
| Rehacer al 31 % con avisos | por gesto | 22,71 / 22,03 | 22,74 / 22,47 | ≤ base × 1,15: 26,11 / 25,33; 0 lentos | pasa |
| Pegar 500 | paso | 5,00 / 4,90 | 5,75 / 5,60 | ≤ base + max(10 %, 1 ms): 6,00 / 5,90 | pasa |
| ″ | deshacer | 1,20 / 1,20 | 1,70 / 1,70 | se informa (máx. 3,2) | – |
| Duplicar todo (2000) | paso | 48,55 / 47,50 | 49,05 / 50,45 | ≤ base × 1,10: 53,40 / 52,25; máx. ≤ 300 (91,2) | pasa |
| ″ | deshacer | 8,45 / 8,35 | 10,20 / 9,70 | ≤ 40, máx. ≤ 80 (17,3) | pasa |
| Etiquetar los vacíos (2000) | paso | 3,00 / 2,80 | 4,55 / 4,40 | > 10 %, pero debajo del tope de lote 40/80 (máx. 7,1) | pasa (ajuste (a)) |
| ″ | deshacer | 1,65 / 1,60 | 2,70 / 2,70 | ídem (máx. 5,6) | pasa (ajuste (a)) |

- **Dibujar 1 cable:** el NC del par se coloca fuera de lo medido y queda sin cablear. Por eso hay 0 avisos R6. Cada cable y cada deshacer recorren solo las redes que tocan: el borne del NC, el cable y el otro borne del NC. Avisos en la escena: R2 277, R7 529 y R8 30.
- **Tolerancia de *Duplicar todo*** (Bruno, anotada antes de abrir el análisis): si era lo único que no pasaba y quedaba a menos de 2 ms sobre su tope, se aceptaba. No hizo falta.
- **Los pasos que en la etapa 3a subían más de 10 % en las dos tandas** ya no suben así en las dos:
  - *Girar todo*: de 21,15 a 23,50 y de 22,25 a 22,30 ms.
  - *Soltar con todo seleccionado*: de 16,85 a 14,25 y de 14,90 a 16,65 ms.
  - *Borrar y deshacer uno con cables*: de 0,70 a 0,80 y de 0,70 a 0,75 ms.
  - Queda *Etiquetar los vacíos* (arriba).

### Cuadros después de Pegar 500 y Duplicar todo: a la netbook

En esos dos escenarios, los cuadros que siguen al paso cuestan más en HEAD:

| Escenario | Cuadro: mediana / p95, base | HEAD | Por gesto, base | HEAD | Lentos |
|---|---:|---:|---:|---:|---|
| Pegar 500 | 0,70 / 0,95 · 0,65 / 0,90 | 6,45 / 7,30 · 6,40 / 7,05 | 6,68 / 6,33 | 64,87 / 64,57 | 0 y 0 |
| Duplicar todo (2000) | 1,50 / 1,65 · 1,50 / 1,80 | 8,70 / 9,90 · 8,65 / 9,65 | 4,95 / 4,90 | 44,55 / 44,23 | 0 y 0 |

- **Por qué:** es «sin restos» de la etapa 2. Al pegar o duplicar, los titulares nuevos ocupan números que tenían contactos sin bobina (R2). Esos contactos pierden el contorno sin que el comando los nombre, y el editor repinta su caja: 77 al pegar 500 y 277 al duplicar todo.
- **No viene de la 3b:** se comprobó en Node que `5f4e1d1` y la 3b repintan los mismos componentes y las mismas 2278 y 11 692 regiones.
- **Antes no estaba a la vista:** la etapa 3a juzgaba esos escenarios solo por el paso.
- **Criterio en la netbook** (Bruno, 2026-11-16): pasa si hay como máximo 1 cuadro lento después del gesto y ninguno de más de 100 ms.

### Celdas comunes y lentos: diagnóstico, ruido

- **En las dos tandas** (mediana / p95 por cuadro en ms, mediana de las 6 corridas):
  - *2000 · Editar al 31 %*: p95 de 0,85 a 0,95 y de 0,85 a 1,10.
  - *2000 con cables · Desplazar al 100 %*: p95 de 0,30 a 0,35 en las dos.
- **Lentos de HEAD, en la misma corrida** (la 11.ª de T1, que tuvo también *Desplazar* alto):
  - *Arrastrar 40 cableados al 58 %*: un cuadro de 39,1 ms.
  - *Girar todo al 31 %*: un cuadro de 16,4 ms.
  - La base no tuvo ninguno.
- **Por qué podía ser ruido:** la 3b no toca el dibujo, y arrastrar y desplazar no ejecutan comandos.
- **Diagnóstico** (opción 1 de Bruno): ABBA ×5 contra la misma base, con 10 veces más repeticiones en esas cuatro filas. Son 10 pares; en cada bloque ABBA, (1.ª A, 1.ª B) y (2.ª B, 2.ª A).
  - **Reglas, fijadas antes de medir (12:57):**
    - una celda de p95 es real si HEAD supera a la base en más de 0,05 ms de mediana o en más de 10 % de p95 en al menos 7 de los 10 pares;
    - un lento es real si HEAD tiene lentos en 2 o más de sus 10 corridas y la base en ninguna.
  - **Corrida:** de 12:59:07 a 13:02:29, 20 corridas de unos 10 s, enchufada (79 %), con las mismas ventanas. La opción `--diag-t19b` fue un parche temporal en los dos árboles y no quedó en el repo.

| Fila | Base | HEAD | Resultado del diagnóstico | Veredicto |
|---|---:|---:|---|---|
| 2000 · Editar al 31 % (mediana / p95) | 0,70 / 1,10 | 0,70 / 1,10 | HEAD arriba en 2 de 10 pares | ruido |
| 2000 con cables · Desplazar al 100 % | 0,20 / 0,40 | 0,20 / 0,40 | 2 de 10 | ruido |
| Arrastrar 40 cableados al 58 % (1800 cuadros por corrida) | 0 corridas con lentos | 0 | máx. 10,1 / 9,8 ms | ruido |
| Girar todo al 31 % (114 cuadros por corrida) | 2 de 10 corridas con lentos | 1 de 10 | máx. 19,3 / 17,9 ms; la base también los tiene | ruido |

### Encuadrar (F) con 500

Corridas con un cuadro de 8,5 ms o más: base 1 de 6 en T1 (máx. 8,90) y 1 de 6 en T2 (máx. 10,30); HEAD 0 de 6 en las dos (máx. 8,00 y 6,90). Como en la etapa 3a, aparece también en la base. Costo aceptado (cambio 9); sigue en la lista de la netbook.


---
Mediciones anteriores (T18, T17, T16, fase 3 y banco anterior del 2026-11-07): `docs/archivo/bench-historial.md`.
