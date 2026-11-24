# Plan fase 6 — Biblioteca y potencia

**Aprobado por Bruno el 2026-11-24**, con 5 ajustes (ya incluidos). Decisiones: D1-A a D5-A (de antes) y D6–D12 (sección 7). Donde difiere de `docs/arquitectura.md`, manda este plan.

## 0. Estado y alcance
- `main` = `origin/main` = `954f011`, limpio; fase 5 cerrada. `src/` igual que en `845fe69`.
- **6a:** polos y netlist multipolo, 24 símbolos, paleta con grupos y miniaturas. **6b:** simular la potencia.
- **6a pasa cuando:** con la paleta nueva se dibuja a mano la inversión de giro completa (trifásica + N, Q1 3P, K1 y K2 principales, F2 térmico, M1; mando con F1, S0–S2, 95-96 y enclavamientos) sin avisos; `npm run circuito` la compara con `tests/circuitos/inversion-potencia.brn` (nuevo); `formato-v1/` abre igual; Simular según D6 y D7.

## 1. Tareas de 6a
Una por sesión; cierran con `bornera-cierre`, humo `tNN-*.mjs` y ABBA contra el commit anterior (sección 4).

| Tarea | Qué | Opus |
|---|---|---|
| T34 | `polos` en la definición y `validarDefinicion`; netlist y motor multipolo (sección 2); trifásica con potencial por borne en la netlist (sin R9). Pilotos: `fuente.trifasica` y `contactor.principal`. Cálculo lento y azar con polos; corpus y `sim.test` iguales. **ABBA contra `954f011`**, control fijado acá: S1–S5 (S1 arma la netlist; S2–S4, el motor) y B13 (R6 al cablear, recorre redes); ninguna B arma la netlist. Regla vigente. Plan aprobado: `docs/plan-T34.md` (D1-A, D2-A, D3-A y 4 ajustes). **Cerrada** (2026-11-24): `polos` y `polosDe`; `fuente.trifasica` (6×4, L1–L3) y `contactor.principal` (1-2, 3-4, 5-6); un contacto por polo en la netlist; potencial por borne (tabla por tipo y borne, D3-A); `nombraRed` para R9, la etiqueta obligatoria y el panel (D1-A); `redes()` y R6 con nombre por borne (D2-A). Azar con polos (semilla 34) y uniones con la biblioteca de T34 (semilla 20261132); humo `t34-polos.mjs`. ABBA 1 contra `954f011`: B5 2.º 2,2 → 3,9, no pasa; diagnóstico acotado (Bruno): asignaciones evitables quitadas (ninguna en ese camino), Node A ≈ B, traza sin atribución. **ABBA 2 pasa todo** (S1 17,3 / 20,9 sin regresión; B5 2.º 2,2); `docs/bench.md` | xhigh |
| T35 | 15 de potencia, prefijos (D9), test de bornes, referencias cruzadas con polos («NA 1-2, 3-4, 5-6»). **R10 con la trifásica:** una Fase «L» con una trifásica en la hoja avisa (test). **Motor:** test de que M1 entre L1, L2 y L3 no da corto ni «cargas en serie» | alto |
| T36 | 8 de mando; Simular según D6 y D7; R2 también para contactos del térmico sin su F | alto |
| T37 | Banco: escena de potencia 2000 (tendida como W), «Probar la fase 6» con S6, P1 y la marca de arranque (base de P2), `--fase6` | alto |
| T38 | Paleta: grupo + subgrupo (D2-A), miniaturas (D10) después del primer cuadro, nombre en tooltip, búsqueda igual, ancho 200 px | alto |
| C1–C4 | C1 «Probar la fase 6» en la PC (ABBA contra `954f011`). C2 `0.1.6-alpha.1` sin publicar (D12-A) y hoja de la netbook; **nota para el texto de la release (alpha y `0.1.6`): un `.brn` de 0.1.6 no abre en 0.1.5.** C3 netbook y PC el mismo día (Sonnet). C4 docs, `ideas.md` (temporizadores, D3-A) y Obsidian (Sonnet) | alto |

**Símbolos** (tipos sin dígitos, como exige `biblioteca.test.ts`; quedan en el `.brn`):
- Potencia: `fuente.trifasica` (L1 L2 L3), `fuente.trifasica_n` (+ N), `fuente.tierra` (PE), `proteccion.fusible_tripolar`, `proteccion.termomagnetica_unipolar`/`_bipolar`/`_tripolar`/`_tetrapolar`, `proteccion.diferencial_bipolar`/`_tetrapolar`, `proteccion.guardamotor`, `proteccion.termico`, `maniobra.seccionador` (3P), `contactor.principal`, `motor.trifasico` (U V W), `motor.estrella_triangulo` (U1 V1 W1 U2 V2 W2).
- Mando: `mando.selector` (NA 13-14), `mando.seta` (NC 11-12), `termico.contacto_nc` (95-96), `termico.contacto_na` (97-98), `mando.final_na`, `mando.final_nc`, `proteccion.fusible` (mando), `senalizacion.bocina`.
- Fusible de potencia tripolar (D4-A) y de mando unipolar. Total: 32.

## 2. Netlist multipolo
- **Definición:** `polos?: [borne, borne][]`. Sin `polos`, un contacto de 2 bornes es un polo (lo de hoy). Cada borne en un solo polo.
- **Netlist:** un `ContactoNetlist` por polo (`comp`, `polo`, `a`, `b`), con la etiqueta y el accionamiento del símbolo. El motor pasa de comp → contacto a comp → polos: un clic o pulsar acciona todos.
- **Misma etiqueta:** los polos de K1 siguen a la bobina K1 como el auxiliar. Protecciones y seccionador conducen siempre en 6a; 6b suma «abierta» y «disparada». 95-96 y 97-98 siguen al térmico de su etiqueta (en 6a, en reposo).
- **Fuentes de 3 y 4 bornes:** potencial = papel + nombre del borne (L1–L3 fase, N neutro), como dice arquitectura. Dos trifásicas, o una trifásica y una Fase «L1», son la misma red; su N, la del Neutro «N». Su etiqueta no da nombre.
- **Motores en 6a:** no conducen ni son carga (como un símbolo desconocido): sus bornes forman red pero no unen nada, así que no dan falsos cortos ni «cargas en serie». 6b los hace carga.
- **Corto entre fases por contactos:** ya lo ve el motor de la fase 5 y se detiene (D3-A).

## 3. Qué simula 6a (D6-A y D7-A)
- **Un clic alterna:** el selector y la seta. El final de carrera, como el pulsador (mantener; Mayús+clic fija).
- **Siempre cerrados:** termomagnéticas, diferenciales, guardamotor, seccionador, fusibles y el térmico; un clic no hace nada. Abrirlos o dispararlos es de 6b.
- Conducen los polos principales por su bobina; la bocina se enciende como la lámpara; el motor, sección 2. El mando de la fase 5 no cambia.

## 4. Banco
Topes fijados acá, antes de medir. PC = netbook / K, K1 = 3 y K2 = 5,5 (D1-D de la fase 5); piso de 1 ms.

| # | Qué | Netbook | PC | Tarea |
|---|---|---|---|---|
| S1–S5 | Sin cambios de tope; los tocan T34 y T36 | los de la fase 5 | los de la fase 5 | T34, T36 |
| S6 | Entrar a Simular, escena de potencia 2000 al 31 %, hasta nítido; máx. de 5 | ≤ 300 ms | ≤ 54,5 (K2) | T37 |
| P1 | Dibujar todas las miniaturas de cero (tema o dpr nuevo); máx. de 5 | ≤ 50 ms | ≤ 9,1 (K2) | T38 |
| P2 | Arranque: de `timeOrigin` al primer cuadro nítido del lienzo, una por apertura | informa | no regresión | T37 base, T38 juzga |
| B1–B16, F1–F3 | Sin cambios | regla vigente | regla vigente | todas |

- **Regla vigente:** B con D6b-C (medianas calientes, ≤ 1 ms o ≤ 10 %, lentos ±1, B9 mismo escalón, B2 por mediana); F por tope; S y P1: mediana de las calientes ≤ tope y máx. ≤ tope + máx(1 ms, 10 %), y no regresión (mediana A ≤ B + máx(1 ms, 10 %)), salvo S1 y S4, solo por tope. P2: mediana de las 6 aperturas, A ≤ B + máx(1 ms, 10 %). Frías informan. Si una fila falla en la PC, se frena y se consulta, sin volver a medir.
- **Escena de B:** no cambia (`TIPOS_ESCENA_013`, por tipo). Si cambiara el ancho de la paleta, B se juzga con J-A.
- **Arranque en la netbook:** las miniaturas se dibujan después del primer cuadro del lienzo (el humo de T38 mira el orden); P1 acota su costo; P2 se juzga en la PC y se anota en C3.

## 5. Netbook (cierre de 6a, `.msi` de `0.1.6-alpha.1`)
| # | Paso | Pasa si |
|---|---|---|
| 0 | Instalar encima de la 0.1.5 | Una sola «Bornera», alpha.1 |
| 1 | «Probar la fase 6»: 3 aperturas × (fría + caliente); la PC el mismo día | S1–S6 y P1 por tope; B y F, regla vigente; P2 se anota |
| 2 | Paleta a 1024×600, claro y oscuro; buscar «termo» | Subgrupos; miniaturas nítidas; tooltip; quedan las 4 termomagnéticas |
| 3 | Dibujar la inversión de la sección 0, guardar y abrir | Sin avisos; abre igual |
| 4 | Simular ese circuito y `inversion.brn` | Selector y seta alternan; Q1 y F2 cerrados; M1 sin corto; `inversion.brn` como en la fase 5 |

## 6. 6b, en líneas generales
- **Motor gira** con tres fases distintas en U, V y W; sentido por la paridad de la secuencia; flecha fija, sin animación. 6 bornes: estrella o triángulo según los puentes.
- **Falta de fase:** no gira y avisa «Falta de fase en M1».
- **Disparo del térmico:** clic dispara y rearma (abre 95-96, cierra 97-98); también guardamotor y termomagnética; abrir el seccionador.
- **Corto entre fases:** dispara la protección aguas arriba (cuál, se decide en 6b); sin protección, se detiene como hoy.
- Diferencial y PE (D11), en 6b o después.

## 7. Decisiones (Bruno, 2026-11-24)
| # | Elegida | Qué |
|---|---|---|
| D6 | A | Conduce todo contacto o conductor (sección 3); motor y disparos, en 6b |
| D7 | A | Un clic alterna selector y seta; protecciones y seccionador entran cerrados y no se operan en 6a |
| D8 | A | Polo N de la 4P y los diferenciales: bornes 7-8 con «N» dibujada (en la trifásica «N» sí es red) |
| D9 | A | Q termomagnética, diferencial, guardamotor y seccionador; F fusibles y térmico; M motores; S selector, seta y final; H bocina |
| D10 | A | Miniaturas: un canvas chico por ítem con el Renderer Canvas y el Path2D del símbolo; se rehacen solo con tema o dpr nuevo |
| D11 | B | PE sin potencial en 6a: se dibuja y forma red; su papel, con el diferencial |
| D12 | A | `0.1.6-alpha.N` para la netbook, sin publicar; `0.1.6` al cerrar 6b |

**Descartadas:** D6-B, adelanta estado de 6b; D6-C, caso especial. D7-B, cerrar Q1 en cada entrada; D7-C, seta que se suelta sola. D8-B, «N1» parece red; D8-C, toca dibujo, panel y avisos. D9-B y C, menos usual. D10-B, otro camino de dibujo; D10-C, complica tema y filtro. D11-A, N con PE daría corto; D11-C, esconde ese error. D12-B, dos versiones por fase; D12-C, sin `.msi`.

## 8. Verificado, supuesto y riesgos
- **Verificado (`954f011`):** 8 símbolos; Potencia vacía; netlist solo fuentes de 1 borne y elementos de 2; el motor no lee reloj; `proteccion`, `manual_enclavado` y `termico` sin símbolo (el motor ya toma `manual_enclavado` como pulsador y `termico` en reposo). `categoria` no va al `.brn`: migrar la paleta no toca archivos. Nombres de borne únicos. Un símbolo desconocido cableado no abre (`deserializar`, etapa 7): un `.brn` de 0.1.6 con símbolos nuevos no abre en 0.1.5; el formato sigue en v1.
- **Supuesto:** dos fuentes (3 y 4 hilos); la netlist con polos entra en S1; 32 ítems caben a 1024×600 desplazando.
- **Riesgos:** «un contacto por componente» está en el motor, las referencias, `compararRedes` y el dibujo del estado (T34 los busca). Validaciones que recorren `SIMBOLOS` pueden mover B.
- **Sesiones:** 9 a 11 (T34 quizá 2). Push, tags, publicar y dependencias (ninguna), con autorización de Bruno.
