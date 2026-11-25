# Plan C1 — «Probar la fase 6» en la PC (fase 6)

**Aprobado por Bruno el 2026-11-25** con 4 ajustes (incluidos). Manda `docs/plan-fase6.md` (§1 C1, §4). Parte de `f9d3b10`. Sin push, tag ni publicar.

## Paso 1 — Miniaturas montadas después del primer cuadro
- **Hoy:** los 32 `<canvas>` de la paleta se crean con el primer montaje de `Paleta.svelte`, antes del primer cuadro nítido; solo el dibujo espera (`despuesDelArranque`). En T38 P2 subió 9,6 ms.
- **Cambio:** en `Paleta.svelte`, un `$state` que pasa a `true` con `despuesDelArranque`; el `<canvas use:miniatura>` va dentro de un `{#if}`. Los botones (40 × 40 fijos) se montan como hoy: sin saltos de diseño, búsqueda, plegado, arrastrar e insertar iguales. `Miniaturas` no cambia: los canvas se registran ya arrancada y se dibujan juntos en la tarea siguiente, como hoy. Una marca `bornera:miniaturas-montadas` al registrar el primero (para el humo). Estimado: ~15 líneas, sin tocar `src/core`. Si pasa de ~40 líneas o toca el core, se frena y se avisa.
- **Humo `t38-paleta.mjs`:** siguen las 32 miniaturas dibujadas (con trazo, nombre en `title` y `aria-label`); nuevo: la marca de montadas es una sola y posterior a la de arranque, y la de miniaturas posterior a las dos. **Ajuste 2:** plegar y desplegar un subgrupo, y cambiar el tema, dejan las 32 dibujadas (con trazo); si plegar desmontara el canvas, se confirma que se redibuja.
- **P1 no cambia:** mide `rehacer()` con los mismos 32 canvas. Se mira en «Probar la fase 6» (humo `t37`) y en el ABBA (T38: 0,4 ms).
- `npm test`, `npm run check`, `npm run humo`, `cargo test`. **Commit checkpoint.**

## Paso 2 — ABBA en WebView2 contra `954f011`
**Reglas fijadas acá, antes de medir; no se cambian después.**
- **Cómo:** `probar-webview2.mjs --exe=A,B --fase6`, 3 bloques, 6 aperturas por exe (fría + caliente). A = exe de release de HEAD (con el paso 1); B = exe de un worktree temporal en `954f011` (`npm ci` y `svelte-kit sync`), que al final se borra con `git worktree remove` y `git worktree prune` (ajuste 4), no a mano. Versión solo en `package.json`, local y revertida (como T34). Condiciones de siempre: enchufada, «Mejor rendimiento», apps cerradas (Bruno), sin otra Bornera abierta. Misma escena de B (sin J-A: el ancho de la paleta no cambió).
- **B1–B16:** D6b-C (medianas calientes, ≤ 1 ms o ≤ 10 %, lentos ±1, B9 mismo escalón); B2 por mediana a mano (`docs/plan-T37.md`).
- **F1–F3:** por tope de la PC.
- **S1–S5:** mediana de las calientes ≤ tope y máx. ≤ tope + máx(1 ms, 10 %); no regresión (mediana A ≤ B + máx(1 ms, 10 %)) en S2, S3 y S5; S1 y S4 solo por tope (su no regresión informa).
- **S6 y P1:** solo tope de la PC, porque B no los tiene. S6: mediana ≤ 54,5 ms (máx. ≤ 60,0 aparte); P1: mediana ≤ 9,1 ms (máx. ≤ 10,1 aparte).
- **P2 (ajuste 3):** B (`954f011`) no tiene la marca de arranque, así que no lo mide: la mediana de A informa y se compara con 139,3 (`24090e0`) y 148,9 ms (`f9d3b10`, T38). Si no baja, se informa tal cual y no se agranda el cambio.
- **S1 (informa):** mediana y máx. de A y de B con el desglose (R4, netlist, iniciar, cuadro). En T38 subió 17,8 → 20,5: decir en qué parte del desglose está la suba.
- **Frías:** informan (regla de C4).
- **Ruido (ajuste 1):** se repite **una sola vez** solo si falla un control: B13, B15 o S4, o S6/P1 con el máx. sobre su tope y la mediana dentro (regla de T37/T38). Cualquier otra falla: se frena y se consulta, sin volver a medir.

## Al cerrar
`docs/bench.md` (tabla y juicio), §1 de `plan-fase6.md` (C1 cerrada), resultado acá, Obsidian (`Bornera.md` y «Medición … - PC»), con `bornera-cierre`. Commit local.

## Riesgos
- El cambio podría no bajar P2 si el costo está en los 32 botones y no en los canvas; se informa tal cual, no se agranda el cambio en C1.
- El worktree de `954f011` necesita `svelte-kit sync` (si no, la página del banco espera los 10 min).
