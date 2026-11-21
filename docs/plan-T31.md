# Plan T31 — Banco de mando (fase 5)

Aprobado por Bruno el 2026-11-21 con E-A, S1-A, S4-A, S5-A, AB-A y N-A, más 3 ajustes. Manda `docs/plan-fase5.md` (sección 3). Parte de `6a4a7dd` (3 commits por delante de `origin/main`). Sin push.

## Reglas (fijadas antes de medir)
- `npm test` sin topes con reloj real: solo corrección (escena, motor, juicio, texto).
- ABBA en WebView2 con piso de 1 ms (D6b-C para B1–B16), en condiciones de banco: enchufada, «Mejor rendimiento», apps cerradas.
- **Juicio de S1–S5 (ajuste 1, cambio de regla autorizado):** pasa si la **mediana de las corridas calientes ≤ tope** y el **máximo ≤ tope + máx(1 ms, 10 %)**. Las frías solo informan. El número de cada corrida es el de la sección 3 (S1 y S3 máx.; S2 mediana y máx.; S5 máx.).
- Si una S falla: se frena y se consulta, sin volver a medir. S1 > 48 ms en la PC se avisa.
- **Si S1 no pasa (ajuste 2):** se frena, se muestra el desglose (R4, netlist, iniciar, cuadro) y recién ahí se propone una salida. El stash de T28 solo sirve si lo que se pasa es la netlist.

## Decisiones
- **E-A:** escena de mando 2000 = 100 marcha-paradas simples (7 símbolos) + 100 con rama NC (9) + cadena de 100 relés (4 por relé): 2000 justos, 2200 cables, 300 bobinas. Cada celda con su L y su N (D7 las une por nombre). Una celda se arma con comandos y W, y se copia corrida.
- **S1-A:** entrar (R4 + netlist + iniciar) más un repintado completo al 31 % hasta nítido, sustituto del dibujo de T33.
- **S4-A:** la fila dice «se mide en T33», sin número.
- **S5-A:** `msTrabajoR11` (suma de los tramos); el tiempo de pared hasta los avisos informa.
- **AB-A:** base `6a4a7dd` (su build es el de `195ea55`). C1 repite contra `7ed51e4`.
- **N-A:** la netlist sola informa dentro de S1, sin tope propio.

## Pasos
1. `documentoBancoMando()` en `src/editor/banco.ts` (E-A).
2. Tests de la escena: 2000 componentes, 0 aparentes, sin errores; cada marcha arranca, retiene y para; la cadena entra entera y cae al soltar; igual dos veces; `serializar` sin cambios.
3. `src/ui/fase5.ts`: topes S1–S5 de la netbook, filas y texto; `fase5.test.ts`.
4. `src/ui/probarFase5.ts`: «Probar la fase 4» más S1–S5, sin tocar la hoja. S2: 20 marchas medidas (la parada vuelve a reposo sin medir); S3: 5 vueltas.
5. Menú de desarrollo › «Probar la fase 5…».
6. `compararB.mjs` lee las filas S y juzga con el ajuste 1; `probar-webview2.mjs --fase5` (A fase 5, B fase 4); tests en `compararB.test.ts`.
7. Humo `t31-probar-fase5.mjs`: la tabla trae B, F y S; la hoja sin «•».
8. `npm test`, `npm run check`, `npm run humo`, `cargo test`.
9. ABBA: dos exes `--no-bundle` con `0.1.4-t31.0` local (revertida), base `6a4a7dd`, 3 bloques.
10. `bench.md`, `plan-fase5.md`, `CLAUDE.md`; cierre con `bornera-cierre`, commit local.

## Supuestos y riesgos
- Supuesto: S2 y S3 entran holgados (unas 800 redes).
- S3: 100 recálculos de cero con una clave de 300 bobinas. Si falla, se frena; la salida sería un recálculo incremental (cambio en `sim/`, otra tarea).
- S1: el cuadro pesa más que el resto (B10 ≈ 20 ms en la PC).
- Netbook fuera de T31 (C3).
