# Plan T37 — Escena de potencia en el banco (fase 6)

**Aprobado por Bruno el 2026-11-25** con D21-A a D25-A y 5 ajustes (incluidos). Manda `docs/plan-fase6.md` (§1, §4; S6, P1 y P2 sin cambios). Parte de `0322b14`. Sin push ni tag.

## Alcance
- **Escena de potencia 2000** (`src/editor/bancoPotencia.ts`, D21-A): 95 copias de `inversionPotencia()` (21 símbolos, 37 cables, ya tendida por W) + 1 celda de 5 = 2000 justos (D22-A), como `bancoMando` copia `marchaParada()`. 10 columnas, paso 80×60, sin tocarse. Etiquetas por celda: K, S, F, Q, M, H.
- **Celda de 5** (ajuste 3): Fase «L1» → `proteccion.fusible` F → `pulsador.na` S → `senalizacion.lampara` H → Neutro «N», armada con comandos y W. Sin falso corto: entre L1 y N siempre está la lámpara (carga), el pulsador está abierto en reposo, y «L1» es la misma red que las L1 de las trifásicas (misma fase, no otra); con «L» avisaría R10.
- **«Probar la fase 6…»** = «Probar la fase 5» + **S6** + **P2**. P1, en T38 (D23-A).
- **S6:** como S1 (R4 + netlist + iniciar + cuadro al 31 % hasta nítido) en la escena de potencia; 5 vueltas + calentamiento; máx. por corrida; desglose informa. **El S6 de la netbook (≤ 300 ms) se mide en C3, no en T37** (ajuste 4).
- **P2:** `performance.mark` del Lienzo al primer cuadro sin mosaicos pendientes, desde `timeOrigin` (D24-A); se toma de la 1.ª corrida de cada apertura.
- **Script:** `--fase6` (A «Probar la fase 6», B «Probar la fase 5») y `--base-fase6` (las dos la 6, para T38; D25-A). S6 y P2 en tablas aparte: `--fase4`, `--fase5` y `--base-fase5` no cambian.

## Topes (antes de medir)
- **S6 (ajuste 1):** la mediana de las calientes ≤ 54,5 ms decide. El máx. ≤ 60,0 se juzga aparte: si se pasa en un pico aislado (una sola caliente), se repite el ABBA **una** vez; si vuelve a pasarse, «no pasa». Sin no regresión: `0322b14` no tiene S6.
- **P2:** informa (B no tiene la marca). T38 la juzga contra T37: mediana de 6, A ≤ B + máx(1 ms, 10 %).
- `npm test` y humo: sin topes de tiempo (reloj real con GC).

## ABBA contra `0322b14` (ajuste 5: reglas de T35/T36)
`probar-webview2.mjs --fase6 --exe=A,B`, 3 bloques, fría + caliente; escena de B igual (`TIPOS_ESCENA_013`, sin J-A).
- S1 ≤ 54,5 (máx. 60,0); S2 1,7 / 5,3, S3 16,7, S5 100,0: tope y no regresión; S4 6,0 / 18,2 por tope.
- B1–B16 con D6b-C (≤ 1 ms o 10 %, lentos ±1, B9 mismo escalón); **B10 se juzga**; F1 ≤ 9 ms, F2 y F3 ≤ 1 s; frías informan.
- **B2 a mano:** el script juzga B2 1.º (mediana) y 2.º (máx.) igual. Decide B2 1.º; si B2 2.º «sube», se anota «informa» y no cuenta. Si es la única en «Calientes: NO pasa», B pasa. Así en `bench.md`.
- Control: S4, B13, B15 (si falla una sola, se repite una vez). Si falla una juzgada, se frena y se consulta. Las reglas no cambian después de medir.

## Etapas
**0:** commit del plan. **1 → checkpoint** (`npm test`, `npm run check`): `bancoPotencia()`, `copiar` exportado de `bancoMando`. **2:** `fase6.ts`, `medirPotencia.ts`, marca P2, `probarFase6.ts`, menú, `compararB.mjs` y `probar-webview2.mjs`. **3:** humo, ABBA, cierre.

## Tests (ajuste 2, sin tiempos)
- `bancoPotencia.test`: 2000 justos y cuenta por tipo; dos llamadas dan lo mismo (`serializar`); `problemasTrazado` 0; 0 aparentes entre celdas; **la cantidad de redes de la netlist, fija**, y L1, L2 y L3 de las 95 trifásicas en una red cada una; entra a Simular sin errores; K1 de la 1.ª y la última celda: U V W = L1 L2 L3 (K2: L3 L2 L1).
- `fase6.test` (filas, texto); `compararS.test`: S6 y P2 se leen, un texto de fase 5 juzga igual que hoy.
- Humo `t37-probar-fase6.mjs`: texto con B1–B16, F1–F3, S1–S6 y P2; `t31` igual; `npm run humo` completo.

## Decisiones (Bruno)
D21-A copias de `inversionPotencia()` · D22-A 2000 justos con celda de 5 · D23-A P1 en T38 · D24-A marca en el Lienzo · D25-A `--base-fase6` en T37.

## Riesgos (supuestos)
- Red L1–L3 enorme: netlist de S6 mayor que la de S1 (S6 ≈ 25–35 ms en la PC).
- 31 % de 2000 con motores y Q de cuchilla: el cuadro pesa (B10 ≈ 23 ms).

## Resultado (2026-11-25)
- Commits: `c0496ec` (plan), `a4fcd6a` y `29ffb86` (checkpoints) y el de cierre. Todo el alcance hecho.
- Escena: 2000 justos, 3519 cables, 1526 redes (95 × 16 + 2 + 4); L1, L2, L3 y N, una red cada una. Ninguna expectativa vieja cambió.
- Humo `t37` 16/16; `npm run humo` 1108/1108.
- **ABBA contra `0322b14`: pasa.** S6 17,4 / 18,0 (mediana / máx.; ≤ 54,5 y ≤ 60,0); P2 134,3 ms (informa); S1–S5, B1–B16 (B2 1.º 10,1 → 10,7, igual; B10 igual) y F pasan. Detalle en `docs/bench.md`.
- **Pendiente:** S6 de la netbook en C3; P1 y el juicio de P2 en T38.
