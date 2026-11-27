# Plan biblioteca 2 — 17 símbolos (antes de 6b)

**Aprobado por Bruno el 2026-11-27**, con cambios (incluidos). Parte de `5f8a529`. Sin push, tag ni publicación; sale con 6b en `0.1.7` (D-B6).

## 0. Alcance
- **Entran (17, total 49):** fuente continua 12/24 V, fuente conmutada AC/DC (de riel, tipo DR-120-24), fuente variable, trafo mono y trifásico, variac; diferencial 3P sin N; sensores inductivo, capacitivo y fotoeléctrico (PNP); presostato NA y NC; termostato NA y NC; EV monoestable y biestable; motor DC (A1-A2).
- **Fuera:** relés de control de fases y de sobrecorriente (6b). **Pendiente, fase de instrumentos:** voltímetro, amperímetro, multímetro, vatímetro, frecuencímetro, osciloscopio y telurímetro, en un apartado «Herramientas» de la paleta, aparte de los componentes. **Pendiente sin fecha:** regulador de continua (a `ideas.md` en C1).
- **Pasa cuando:** a mano, T1 (L1-N) da 24 V a B1 (PNP) → K1 → Y1, con presostato B2 NC; una continua G1 da M1 DC por un NA de K1. Clic en B1 enciende K1, Y1 y M1 sin avisos; `npm run circuito` (base `biblioteca2`) pasa; `formato-v1/` abre igual.

## 1. Tareas
Una por sesión; cierran con `bornera-cierre`, humo `tNN-*.mjs` y test de bornes.

| Tarea | Qué (netlist y motor) | Opus |
|---|---|---|
| T39 | 6 con salida propia: continua, variable y conmutada (G); trafo mono, trifásico y variac (T). **Definición (D-B7):** `cargas` (pares) y `salida` (borne → papel) junto a `elemento`; con `salida` es titular, no `esFuente`, y lleva prefijo. **Netlist:** potencial de salida = etiqueta + borne («T1.2U1», «G1.L+»; D-B8, D-B10); sin etiqueta no da potencial (R3 avisa); entrada L-N de conmutada, trafo mono y variac = carga; primario tri no es carga (D-B11); PE sin papel (D11). **Validación:** dos con la misma etiqueta no entran a Simular: R4 ya lo hace (no son contactos a mano); se suma el test. R5 suma G y T. **Motor:** sin cambios (D-B9 B). Subgrupo `transformacion`. ABBA contra `5f8a529` | xhigh |
| T40 | 11: diferencial 3P (polos 1-2, 3-4, 5-6, siempre cerrado), 3 sensores, presostato y termostato NA/NC (copia del final), EV mono y bi, motor DC. **Netlist:** sensor = carga BN-BU + polo NA BN-BK (`cargas` de T39); EV bi = dos cargas; motor DC = carga de 2 bornes. **Motor:** posición de la EV bi (la última con tensión; persiste entre pulsar y soltar) y aviso «Y1 con las dos bobinas»; sensor sin cambios (sección 3). **Dibujo (D-B12):** EV accionada; `primitivasAccionado` también en EV. R5 suma B e Y. Subgrupos `sensores` y `actuadores`. ABBA contra `5f8a529` | xhigh |
| C1 | Cierre: circuito de la sección 0 a mano y base `biblioteca2`; ABBA final contra `5f8a529`; `arquitectura.md`, `ideas.md` (Herramientas, regulador de continua, EV 3/2 como símbolo aparte; sistemas y secundario condicionado en 6b) y Obsidian. Sin `.msi`: la netbook mide con 6b. **Nota (T40):** 0.1.6 rechaza un `.brn` con G o T cableados; va en las notas de la 0.1.7. Supuesto: también los tipos de T40 cableados (verificado solo con G y T) | alto |

**Avance:** T39 hecha (2026-11-27; `docs/plan-T39.md`, decisiones D-T39-1 a D-T39-3 A y ajuste 4 B; ABBA contra `8a1a695` pasa). T40 en checkpoint (2026-11-27; `docs/plan-T40.md`, D-T40-1 a D-T40-5 A y ajustes 1 a 4; 49 símbolos; tests y check en verde). Falta el banco: ABBA contra `5aeec6a` (no contra `5f8a529`: esa fila de la tabla quedó vieja) y `netlist-node`; el ABBA se cortó por un cuelgue de la copia de una vez de `copiarPorPartes` (igual en A y en B, no de T40), que va como tarea aparte. Después, C1.

## 2. Bornes, prefijos y paleta
- Continua `L+` `M` (EN 60445); variable `V+` `V−`; conmutada `L N PE` / `+V −V` (un borne de cada uno; la real trae dos puenteados); trafo mono y variac `1U1 1U2` / `2U1 2U2`; trifásico `1U 1V 1W` / `2U 2V 2W 2N`; sensores `BN BU BK`; EV mono `A1 A2`, bi `A1 A2` (14) y `B1 B2` (12).
- Prefijos: G continua, variable y conmutada; T trafos y variac; Q diferencial; B sensores, presostato y termostato; Y EV; M motor DC.
- Paleta: Mando suma **Sensores** (7 ítems) y **Actuadores** (EV); Potencia suma **Transformación**; las G en Alimentación; diferencial en Protección; motor DC en Cargas. `SUBGRUPOS` pasa de 9 a 12.

## 3. Motor y sensor (D-B3)
- Con D-B3 A **el sensor no toca el motor**: pulsables y enclavados van por componente y BN-BU es una carga más (leído en `motor.ts`; supuesto: dibujo con encendido y accionado juntos).
- Límite: conmuta aunque BU no esté cableado. Conmutar solo alimentado pide un modo nuevo en el motor; queda para 6b.

## 4. Banco
- Regla vigente (`plan-fase6.md` §4); ABBA `--fase6 --base-fase6`, B = exe de `5f8a529`. Si una fila falla, se frena y se consulta.
- Escenas de B y S6 iguales. **P1** con 49 miniaturas: tope 9,1 ms PC (0,4 hoy), 50 netbook; solo por tope (D-B13). P2: 17 canvas más tras el primer cuadro.

## 5. Decisiones (Bruno, 2026-11-27)
| # | Elegida | Qué |
|---|---|---|
| D-B1 | A | Fuentes con + como fase y − como neutro, papel por borne; sin papel nuevo |
| D-B2 | A | Entrada = carga; salida = fuente propia siempre activa (condicionada a la entrada en 6b) |
| D-B3 | A | Sensor PNP: carga BN-BU + NA BN-BK, clic enclavado |
| D-B4 | A | Presostato y termostato NA y NC, copia del final de carrera |
| D-B5 | A | EV bi: dos bobinas y memoria (la última con tensión); aviso con las dos |
| D-B6 | — | T39, T40, C1; sin versión propia: sale con 6b en `0.1.7` |
| D-B7 | A | Campos `cargas` y `salida` junto a `elemento` |
| D-B8 | A + R4 | Potencial = etiqueta + borne; misma etiqueta no entra a Simular |
| D-B9 | B | Sin sistemas; pasan a 6b con la salida condicionada a la entrada |
| D-B10 | A, corregida | Bornes por tipo y nombre con etiqueta («G1.L+»): dos continuas no se unen |
| D-B11 | A | Primario trifásico sin carga hasta 6b, como M trifásico |
| D-B12 | A | EV con dibujo accionado (válvula corrida) |
| D-B13 | A | P1 solo por tope (B dibuja 32) |

**Descartadas:** D-B7 B, toca todo lo que lee `elemento`; D-B8 B, sin etiqueta de red; D-B9 A, va a 6b; D-B10 B, une 12 y 24 V; D-B11 B, cargas en serie raras; D-B12 B, la bi no muestra su posición; D-B13 B, regla nueva.

## 6. Verificado, límites y riesgos
- **Verificado (`5f8a529`):** un `elemento` por símbolo; cargas solo de 2 bornes; `PAPEL_POR_BORNE` por tipo, red = borne; un error R4 impide entrar (`motor.ts`) y R4 da error si hay un titular que no es contacto a mano; una fuente no lleva prefijo (`validar.ts`); `params` sin editor (12/24 V va dibujado); `SUBGRUPOS` cerrado.
- **Límite conocido (D-B9 B):** una carga entre L+ de una G (o un secundario) y N de la red enciende; no hay aislamiento entre fuentes. Se resuelve en 6b.
- **Riesgos:** carga + salida (T, G) o carga + contacto (sensor) en un símbolo: etiquetado (6 pasan de fuente a titular), referencias, `compararRedes`, R2/R3/R5 y dibujo; la EV bi es el primer estado que no sale de pulsados y bobinas (azar, corpus); validaciones sobre `SIMBOLOS` mueven B; humos con 49 ítems; un `.brn` nuevo no abre en 0.1.6.
- **Sesiones:** 3 o 4.
