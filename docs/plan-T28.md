# Plan T28 — Netlist (fase 5)

Aprobado por Bruno el 2026-11-20 con N1-A, N2-A, N3-A y N4-B. Manda `docs/plan-fase5.md` (sección 2, D7, D10-A).

## Alcance
`armarNetlist(hoja)` en `src/core/sim/`: redes por cables más etiquetas de red, borne → red, potencial de cada red (D7) y la lista de contactos y cargas que usa el motor de T30. Se arma una vez al entrar; no simula, no avisa y no cambia el documento. Solo la hoja que se ve (la primera).

## Pasos
1. Hecho: test temporal de aparentes en 18 documentos, 0 entre redes distintas (sección 6 del plan de fase).
2. Hecho: `unirPorNombre` de `redes()` une solo bornes de fuentes de un borne (Fase, Neutro) por etiqueta normalizada no vacía. Los cables no tienen etiqueta, no hay referencias entre hojas y `referencias.ts` es solo la lista visual. No hay otras uniones que perder.
3. `netlist.ts`: `redes(hoja)` **sin** `unirPorNombre` (juntaría Fase «N» con Neutro «N», D7).
4. Etiquetas de red: une las redes que comparten un potencial (papel + nombre), con union-find sobre índices de red.
5. Papel por `tipo`, tabla en `sim/` (N1-A). Fuente sin etiqueta: sin potencial (N2-A).
6. Potenciales ordenados (papel, nombre); por red, sus potenciales. Dos o más = corto por cables en reposo: se marca, sin error (D10-A, T30 se detiene).
7. Contactos: NA/NC, accionamiento, etiqueta y sus dos redes. Cargas (bobina, lámpara): etiqueta y sus dos redes. Desconocido: nada.
8. Bobinas por etiqueta en orden natural (N3-A); la repetida no se resuelve acá (R4 impide entrar).
9. Script de medición (N4-B), `npm test`, `npm run check`; cierre con `bornera-cierre`.

## Archivos
- Nuevos: `src/core/sim/netlist.ts`, `src/core/sim/netlist.test.ts`, `tests/circuitos/netlist-corpus.test.ts`, `tests/bench/netlist-node.mjs`.
- Docs: este plan, `plan-fase5.md` (T28 hecha) y `CLAUDE.md` (el comando del script). No se tocan `redes.ts`, `validaciones.ts`, el editor, el dibujo, el corpus ni los tests existentes.

## Tests (Vitest)
- **Mínimos (Bruno):** Fase «N» y Neutro «N», potenciales distintos; dos fases unidas solo por cables, una red con dos potenciales y sin error; misma partición que `redes()` salvo las uniones por papel + nombre; orden K1, K2, K10.
- `marchaParada()`, `({ dosNeutros })` e `inversion()`: red de cada borne, potenciales, contactos, cargas y bobinas en orden.
- D7: L1 y L2 distintos; dos Fase «L1» sin cable, una red; «l1 » da «L1».
- Bordes: desconocido, carga sin cables, hoja vacía, cable roto (no tira), fuente sin etiqueta.
- No muta: `serializar` igual antes y después.
- Corpus: los 11 de `formato-v1/` y los 2 `.brn` arman sin excepción, igual dos veces, con la partición del mínimo.

## Banco
T28 no tiene fila propia: la netlist es parte de S1, que se juzga en C1 y C3.
- **Presupuesto** (Bruno, fijado antes de medir): ≤ 5 ms en la PC y ≤ 27,5 ms en la netbook (K = 5,5), con `documentoBancoCables(2000)` (2000 + 3030 cables).
- **Medida juzgada:** máximo de 5 vueltas calientes (10 de calentamiento) en cada uno de 3 procesos, como S1; se informa también la mediana.
- **Regla:** si no entra, no pasa y se informa la causa; el tope no cambia.
- `node tests/bench/netlist-node.mjs` (`--procesos=N`, `--json`), con Vite como `abrir-node.mjs`. La PC se mide en T28; la netbook necesita Node y el repo (si no los tiene, se consulta).
- B1–B16 y F1–F3 no cambian: T28 no toca editor, dibujo ni guardado. Sin ABBA.

## Resultado (cierre, 2026-11-20)
- **Hecho** (`ced57c7`): `netlist.ts`, 17 tests en `netlist.test.ts` (los 4 mínimos incluidos), 14 en `netlist-corpus.test.ts`, `prueba-netlist.ts` y `tests/bench/netlist-node.mjs`. Mutaciones: unir sin papel, 2 fallos; romper el orden, 2; las dos juntas, 4 (el «4» del primer informe sumaba las dos por error).
- **PC, NO PASÓ:** máximo 5,64 ms (mediana 3,79) y, con la optimización, 6,71 ms (mediana 4,30). `redes()` sin cambios dio 2,49 y 3,89 ms de máximo: el ruido entre corridas es mayor que la parte propia. La optimización no mostró mejora medible y quedó en `git stash` («T28 optimizacion sin mejora medible»). No se cambia el tope ni se vuelve a medir.
- **Netbook (27,5 ms): PENDIENTE**, no corrida.
- **Sigue en T31:** la netlist se controla dentro de S1 con ABBA (`plan-fase5.md`, T31).

## Verificado y supuesto
- **Verificado:** pasos 1 y 2. 8 símbolos; las fuentes salen con «L» y «N» y el editor no las deja vacías (en un archivo, sí: R9). No hay orden natural en `src/core`.
- **Supuesto:** que la netlist de 2000 entra en 5 ms en la PC (T19 midió `redes()` en 1,1–1,6 ms).
