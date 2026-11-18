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
