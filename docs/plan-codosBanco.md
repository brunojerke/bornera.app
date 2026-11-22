# Plan codosBanco — escena oficial del banco con la regla de W (fase 5, antes de C3)

Aprobado por Bruno el 2026-11-22 con J-A, P-A, E12-A, H y 3 ajustes. Manda `docs/plan-fase5.md` (W-A).

## Estado (verificado antes de programar, test temporal ya borrado)
- Hoy: 3030 cables, **10 250 aparentes** (7440 con R11-A), 13 394 avisos R11 (toca 3127, cuerpo 2956, borne 1029, encimado 328); 1670 cables entran por el cuerpo.
- Relleno con la regla de W (prototipo): 3000 en 2 pasadas, **0 aparentes, 0 por el cuerpo**, ~150 ms en Node con índice por grilla.

## Alcance
Solo `src/editor/banco.ts`: el relleno de vecinos se tiende como W (`codos` + `problemasTrazado` vacío contra todo lo puesto) con un índice por grilla; se borra `codosBanco`. Grupo del centro, anillo, cruces y T como hoy. Sigue 2000 + 3000 + 30 T. Sin cambios en el núcleo.

## Decisiones
- **J-A:** ABBA `--fase5 --base-fase5`, A = esta tarea, B = `48c6048`. Controles (B15, S1–S4): la regla de siempre (D6b-C; S por tope y no regresión, R-A). Filas con la escena (B1–B14, B16, F1–F3, S5): solo por su tope en A (abajo); A − B informa.
- **P-A:** en `avisosHoja.test.ts` (R11 por partes, reloj falso), los 500 se pegan encimados para comparar con miles de aparentes.
- **E12-A:** la escena de T12 también con W.
- **H:** nuevo largo y sha256 de «banco de 2000 con cables» en `banco-brn.test.ts`.

## Topes de las filas que se juzgan solo en A (en la PC)
Cada tiempo: mediana de las calientes de A (6: una por apertura) ≤ tope y máx. ≤ tope + máx(1 ms, 10 %). Conteos (lentos, %): por la mediana. Frías informan. F1–F3 y S5, con su juicio de `compararB.mjs` (el de la tabla).

| Fila | Tope en la PC | De dónde sale |
|---|---|---|
| B1 | paso ≤ 150 / ≤ 300 ms | `fase3b.ts` (`pasoMedianaMaximo`, tope de la PC; la app muestra × 2,5) |
| B2 | deshacer ≤ 40 / ≤ 80 ms; 2.º informa (B-A) | ídem |
| B3, B6 | ≤ 1 lento por gesto y ninguno > 100 ms | `fase3b.ts` (`cuadrosDespuesDelGesto`, fijo) |
| B4, B5 | ≤ 40 / ≤ 80 ms | `fase3b.ts` |
| B7 | revisión p95 ≤ 5 ms | `fase3b.ts` (T16) |
| B8, B11, B14 | ninguno > 50 ms y < 1 % > 16,7 ms | `fase3b.ts` (meta 0.1.2, fija) |
| B9 | sin tope fijo: **informa** | `fase3b.ts` («se anota») |
| B10 | ≤ 25 ms por gesto | `fase3b.ts` (T18) |
| B12 | paso mediana ≤ 1,8 ms | `fase3b.ts` (T18) |
| B13 | R6 p95 ≤ 3 / máx. ≤ 8 ms | `fase3b.ts` (T19) |
| B16 | 0 lentos; por gesto **informa** | `fase3b.ts` |
| F1 | máx. ≤ 9 ms en cada caliente | `compararB.mjs` (`TOPES_F_PC`, C1 de fase 4) |
| F2, F3 | máx. ≤ 1000 ms en todas | ídem |
| S5 | máx. ≤ 100 ms (mediana; máx. ≤ 110) | `compararB.mjs` (`TOPES_S_PC`, 300 / K1) |

## Pasos
1. Node antes (informa): `abrir-node`, `netlist-node --maquina=pc`, `r11-tramos-node`.
2. Índice por grilla y relleno con W; hasta 6 pasadas para llegar a 3000 (el test exige 1,5 × n + 30 con 500 y 2000).
3. Tests contados, sin reloj: 0 aparentes, ninguno por el cuerpo, 3030, 30 T con 10 cadenas, reproducible; P-A; H.
4. `npm test`, `npm run check`, `cargo test`, `npm run humo` (PowerShell).
5. Node después (informa). ABBA J-A, 3 bloques × (fría + caliente), exes con `npm run tauri build -- --no-bundle`.
6. `bench.md`: desde este commit la escena oficial es la nueva; un ABBA contra un commit anterior se juzga con J-A.
7. `bornera-cierre`: commit local, sin push ni tag (el tag es de C3).

## Ruido y frenos (ajuste 3)
- El ABBA se repite una sola vez y solo si falla un control (B15, S1–S4). Si vuelve a fallar, se frena y se consulta.
- Si falla una fila con la escena nueva, se frena y se consulta sin repetir. Los topes no cambian.

## Riesgos
- Cambian los anfitriones de las T cerca del centro: si no salen 30 con 10 cadenas, se frena.
- Rechazos y acomodos de arrastrar, girar y reconectar cambian (bench, t14a, t14c): un umbral atado a la escena vieja se consulta antes de tocarlo.
- La netlist de T28 cambia (otras redes): informa.

## Cambios desde el plan aprobado (Bruno, 2026-11-22)
- `tests/portapapeles-banco.test.ts` falló con la escena nueva por una asimetría vieja de `problemasTrazado`: un tramo nuevo sobre el punto de una T existente no lo marca ahí (la T sí). Excepción angosta en el control de pegar (`cruceEnTExistente`), `it.fails` en `trazado.test.ts` y pendiente en `docs/ideas.md`.

## Resultados (2026-11-22)
- Escena: 0 aparentes, 0 por el cuerpo, 3030 cables. Tests 2351 (1 fallo esperado), check, `cargo test` y humo 989/989.
- ABBA J-A contra `48c6048`: **pasa**. Controles iguales; S5 93,3 → 48,5 ms; B, F y S5 bajo su tope (tabla en `docs/bench.md`). Sin repetir.
