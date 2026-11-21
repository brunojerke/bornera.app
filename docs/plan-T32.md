# Plan T32 — Modo Simular (fase 5)

Aprobado por Bruno el 2026-11-21 con E-A, P-A, V-A, S-A, M-A y AV-A, más 4 ajustes. Manda `docs/plan-fase5.md` (secciones 2 y 3). Parte de `93eb13e` (7 commits por delante de `origin/main`). Sin push.

## Reglas (fijadas antes de medir)
- `npm test` sin topes con reloj real: solo corrección.
- ABBA en WebView2 contra `93eb13e`, 3 bloques, en condiciones de banco. B1–B16 con D6b-C; F1–F3 con los topes de la PC.
- S1, S2, S3 y S5, dos juicios: **tope** (mediana de las calientes ≤ tope y máx. ≤ tope + máx(1 ms, 10 %)) y **no regresión** (mediana caliente de A ≤ la de B + máx(1 ms, 10 %)). S4 sin número (T33).
- **Ajuste 1:** si S5 no pasa el tope pero pasa la no regresión, se cierra como «no pasa, causa conocida» (aparentes de la escena del banco, pendiente `codosBanco`). Si falla la no regresión de cualquier S, una B o el tope de S1–S3, se frena y se consulta, sin volver a medir. S1 > 48 ms se avisa.

## Decisiones
- **E-A:** la sesión de Simular vive en `src/editor/simulacion.ts` y la tiene el Editor; Ventana pide entrar y salir.
- **P-A:** pulsa la caja de selección del pulsador (el mismo hit-test que Editar).
- **V-A:** el lienzo no cambia hasta T33; estado y avisos van en la barra; `bornera` expone la sesión para el humo.
- **S-A:** S1-A sigue igual, pero con la misma función de entrada que usa F5.
- **M-A:** al perder la ventana se sueltan los mantenidos; los fijados con Mayús siguen. **Ajuste 2:** la barra muestra «Fijados: S3» hasta que T33 los dibuje.
- **AV-A:** cada aviso nuevo de la simulación sale con `avisar`; la detención (D3) queda fija en la barra hasta salir.
- **Ajuste 3 (cambia la sección 2 de la fase):** en Simular, Guardar y Guardar como quedan bloqueados, como Abrir y Nuevo.
- **Ajuste 4:** el choque entre el mantener de D5 y `enGesto` se cubre con un test sin DOM.

## Pasos
1. Este plan; commit «T32: plan aprobado».
2. `simulacion.ts` (E-A): entrar, pulsar, soltar, fijar, soltar todo y salir sobre `entrarSimulacion`; tests sin DOM.
3. Puntero (D5-B, P-A, M-A): apretar sobre un pulsador lo aprieta; soltar el botón en cualquier lado o perder la ventana lo suelta; Mayús+clic lo fija hasta otro clic. Un pulsador mantenido no es gesto para F5 (ajuste 4).
4. F5 y «Simular»: con errores R4 avisa cuáles y queda en Editar (D4-A); salir descarta el estado, también con algo apretado.
5. Bloqueos en Simular: Ctrl+Mayús+B, «Probar la fase N», Guardar y Guardar como (ajuste 3); repaso de la lista de la sección 2.
6. Barra (AV-A, ajuste 2): avisos, detención y fijados.
7. `tests/circuitos/sim.test.ts`: pulsar y soltar sobre `marcha-parada.brn` e `inversion.brn` («Pasa cuando» de la fase).
8. S1 con la entrada de F5 (S-A).
9. `probar-webview2.mjs --fase5 --base-fase5`: B también corre la fase 5; no regresión de S y ajuste 1 en `compararB.mjs`; tests en `compararS.test.ts`. `--fase5` solo (A la 5, B la 4) queda para C1.
10. Humo `t32-simular.mjs` (criterio, bloqueos y byte a byte sin «•») y ajuste de `simular.mjs`.
11. `npm test`, `npm run check`, `npm run humo`, `cargo test`.
12. ABBA: dos exes `--no-bundle` con `0.1.4-t32.0` local (revertida), base `93eb13e`.
13. `bench.md`, `plan-fase5.md`, `CLAUDE.md`; cierre con `bornera-cierre`, commit local.

## Riesgos
- S5 en el borde (99,8 ms en T31): lo cubre el ajuste 1.
- Sin dibujo del estado, los pasos 2 y 3 de la netbook esperan a T33.

## Resultado (cierre, 2026-11-21)
- **Hecho:** `src/editor/simulacion.ts` (`SesionSimulacion`, `textoNoSimula`) con 14 tests sin DOM; Editor (`entrarSimulacion`, `salirSimulacion`, `presionarSimulacion`, `soltarSimulacion`, `perderVentanaSimulacion`, `sobrePulsador`); `componenteEnPunto` en la escena; puntero, F5 y barra en `punteros.ts`, `Lienzo.svelte`, `Ventana.svelte` y `BarraSuperior.svelte` (la barra de estado recibe el texto por `pista`); menú de desarrollo desactivado en Simular. En el núcleo, `pulsables()` y `marcar` en `entrarSimulacion` (S-A). `compararB.mjs`: `noRegresionS` y `cierreS`; `probar-webview2.mjs --base-fase5`. Humo `t32-simular.mjs` (31); `t15a` cambia «en Simular, Ctrl+S guarda» por el ajuste 3.
- **ABBA contra `93eb13e`:** S pasa (cierre «pasa»), F pasa, B1–B16 iguales salvo **B2 2.º 9,6 → 10,8 ms: no pasa, causa conocida** (decisión de Bruno; no es cambio de regla, no se volvió a medir). Detalle en `docs/bench.md`.
- **Pendiente:** C1 decide antes de medir si B2 se juzga por la mediana. El dibujo del estado (T33); netbook (C3).
