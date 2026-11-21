# Plan T33 — Dibujo del estado (fase 5)

Aprobado por Bruno el 2026-11-21 con I-A, S4-B, R-A, C-A, M-A, F-A y P-B, más 3 ajustes. Manda `docs/plan-fase5.md` (D8-A, D9-B; sección 3). Parte de `946589a` (9 commits por delante de `origin/main`). Sin push.

## Reglas (fijadas antes de medir)
- `npm test` sin topes con reloj real: solo corrección.
- ABBA en WebView2 `--fase5 --base-fase5` contra `946589a`, 3 bloques, fría + caliente, en condiciones de banco. B1–B16 con D6b-C (medianas calientes, ≤ 1 ms o ±10 %, lentos ±1, B9 mismo escalón); F1–F3 con los topes de la PC.
- **Tope de S1–S5:** mediana de las calientes ≤ tope y máx. ≤ tope + máx(1 ms, 10 %). S1 54,5 ms; S4 6,0 / 18,2 ms (cuadro / gesto), máx. 7,0 / 20,0.
- **No regresión** (mediana caliente de A ≤ la de B + máx(1 ms, 10 %)): S2, S3 y S5, como en T32 (S5 sobre el tope y sin regresión: «no pasa, causa conocida»). **R-A:** S1 y S4 solo por tope; su no regresión informa (S1 cambia de definición, S4 no tiene base).
- `npm run bench` informa contra `docs/bench.md`; decide el ABBA.
- Si una fila falla en la PC (S4 incluida), se frena y se consulta, sin volver a medir. S1 > 48 ms se avisa. B2 2.º con la regla vigente; si falla, se consulta.

## Decisiones
- **I-A:** entrar y salir de Simular invalidan la caja entera de la escena; cada gesto, solo las cajas que cambiaron (D8-A).
- **S4-B:** 20 gestos (pulsar y soltar, cada uno medido) sobre la marcha de una marcha-parada centrada en la pantalla al 31 %; la parada vuelve a reposo sin medir. Cada gesto, hasta nítido en cuadros seguidos (sin esperar el cuadro del navegador, como S1); cuenta motor + cuadros. La cadena de 100 relés se mide igual y **solo informa, no frena**.
- **C-A:** las fases (L, L1, L2, L3…) en un color, el neutro en otro y la red en corto en `--conflicto`. **Ajuste 3:** una red sin potencial se dibuja con el color de Editar.
- **M-A:** con la detención (D3-A), la red en corto en `--conflicto` y las bobinas que oscilan con el contorno a rayas.
- **F-A:** «Fijados» sale de la barra (ajuste 2 de T32): el pulsador fijado se ve accionado.
- **P-B:** en Simular, el presupuesto para rehacer mosaicos baja a 4 ms por cuadro; en Editar sigue en 8.
- **Ajuste 1:** Exportar en Simular sale sin estado de simulación, igual que en Editar. Test.
- **Ajuste 2:** al cambiar el estado se descartan los mosaicos guardados de otros niveles de zoom: nunca se muestra un estado viejo. Test sin DOM.

## Pasos
1. Este plan; commit «T33: plan aprobado».
2. Núcleo: `primitivasAccionado` en los 4 contactos (NA cerrado, NC abierto; el accionador sigue a la cuchilla); test: mismos bornes y dentro de la caja de dibujo.
3. Tema: `--sim-fase`, `--sim-neutro`, `--sim-encendida`, claro y oscuro.
4. Render: estado de dibujo en `EscenaEditable` (cable → color, componente → accionado y encendido); sin estado, el camino de Editar sin cambios.
5. Cables agrupados por color, uniones con el de su red, lámpara y bobina con relleno, contacto en su geometría accionada.
6. Capas: presupuesto de Simular (P-B) y descarte de los mosaicos de otros zoom al cambiar el estado (ajuste 2).
7. Editor: cable → red una vez al entrar; en cada gesto, diferencias antes/después y solo esas cajas (D8-A); entrar y salir, la caja entera (I-A); detención (M-A); fijados (F-A).
8. Exportar sin estado (ajuste 1), con test.
9. Banco: S1 completa (el Editor invalida sobre las capas fuera de pantalla) y S4-B; `fase5.ts`, `compararB.mjs` y sus tests.
10. Humo `t33-dibujo-estado.mjs` con capturas sobre `marcha-parada.brn`: entrar, S1, soltar, S0; píxeles de cable y lámpara; salir deja el lienzo como antes de entrar.
11. `npm test`, `npm run check`, `cargo test`, `npm run humo`, `npm run bench`.
12. ABBA contra `946589a`; `bench.md`, `plan-fase5.md`, `arquitectura.md`; cierre con `bornera-cierre`, commit local.

## Riesgos
- S1 sube por el mapa cable → red y los trazos por color (margen amplio contra 54,5).
- S4 cuadro con 4 ms de presupuesto más la copia a pantalla.
- B2 2.º puede repetir T32.
