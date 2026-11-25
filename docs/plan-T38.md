# Plan T38 — Paleta con miniaturas y subgrupos (fase 6)

**Aprobado por Bruno el 2026-11-25** con D26-A (modificada), D27-A a D30-A y 5 ajustes (incluidos). Manda `docs/plan-fase6.md` (§1 T38, §4 P1 y P2, D2-A, D10-A). Parte de `24090e0`. Sin push ni tag.

## Ubicación de los 32 (16 + 16)
- **Mando** · Alimentación: Fase, Neutro, Fusible · Entradas: Pulsador NA y NC, Selector NA, Seta NC, Final de carrera NA y NC · Contactos: auxiliar NA y NC, del térmico NC y NA · Bobinas: Bobina de contactor · Señalización: Lámpara, Bocina.
- **Potencia** · Protección: Termomagnética 1P–4P, Diferencial 2P y 4P, Guardamotor, Fusible tripolar, Relé térmico · Maniobra: Contactos principales, Seccionador · Cargas: Motor trifásico, Motor estrella-triángulo · Fuentes: Trifásica, Trifásica con N, Tierra (PE).

## Decisiones
- **D26-A (modificada, ajuste 2):** el core guarda solo `subgrupo` (tipo cerrado) en vez de `categoria`; el grupo sale de una tabla subgrupo → grupo en `ui/paleta.ts`, con nombres visibles y orden. `validarDefinicion` exige el subgrupo.
- **D27-A:** cada miniatura ajustada a su casilla, con escala tope (la Fase no la llena).
- **D28-A:** todo abierto al arrancar; plegado en memoria. Con búsqueda, lo que coincide se ve abierto; al borrarla vuelve el plegado anterior.
- **D29-A:** las 32 de una vez después de la marca de arranque, también las plegadas (`<details>` conserva el DOM).
- **D30-A:** P2 con B del mismo ABBA: mediana A ≤ B + máx(1 ms, 10 %). 134,3 ms (T37) es referencia.

## Pasos
1. Reproducir a 1024×600 por qué no se llega a la Lámpara. Si es CSS (p. ej. `min-height`), se arregla acá, con su comprobación en el humo, antes del paso 2 (ajuste 3).
2. `core`: `subgrupo` en los 32, `validarDefinicion` y sus tests.
3. `ui/paleta.ts`: tabla subgrupo → grupo; `agruparSimbolos` por grupo y subgrupo con el filtro; vacíos no van.
4. `render/miniatura.ts`: dibujo puro con el Renderer y el `Path2D` ya cacheado; escala (D27).
5. `ui/miniaturas.ts`: dibuja al salir la marca de arranque; `matchMedia` de `prefers-color-scheme` y `resolution`; redibuja solo con tema o dpr nuevo; marca `bornera:miniaturas`.
6. `Paleta.svelte`: grilla de miniaturas, `title` y `aria-label` con el nombre, grupos y subgrupos plegables; la búsqueda despliega. Arrastrar e insertar, iguales.
7. Banco: fila **P1** al final de «Probar la fase 6» (5 vueltas + calentamiento, las 32 de cero); juicio en `compararB.mjs` y `probar-webview2.mjs`.

## Ancho (ajuste 1)
Paleta 200 px (no cambia) − 1 de borde − 8 de padding de `.lista` − 17 de barra de scroll de WebView2 = 174 px útiles. 4 × 44 + 3 × 4 = 188 no entra: **casilla de 40 px, espacio de 4** (4 × 40 + 3 × 4 = 172). El humo verifica que no hay scroll horizontal a 1024×600.

## Sin costo por cuadro
Un canvas chico por ítem (D10-A), dibujado una vez; nada en el bucle del lienzo ni por cuadro. Solo tema o dpr nuevo lo rehacen.

## Tests
- `paleta.test.ts`: cada uno de los 32 en un solo subgrupo; orden; «lampara» encuentra la Lámpara; vacíos fuera; plegado y filtro.
- `validar.test.ts`: falta el subgrupo.
- `miniatura.test.ts`: escala y tope; con contexto falso, un dibujo por símbolo; sin tema/dpr nuevo no redibuja.
- `fase6.test.ts` y test de `compararB`: fila P1 y su juicio.
- Humo `t38-paleta.mjs` (1024×600): 32 miniaturas con `title` y `aria-label` = nombre (ajuste 5); sin scroll horizontal; llegar a la Lámpara (scroll y plegado) y colocarla; colocar arrastrando el Motor trifásico; plegar Mando deja ver Potencia; «motor» despliega los 2 motores y el guardamotor con Potencia plegada; marca de miniaturas después de la de arranque; el `.brn` guarda tipo y no categoría.

## Medición (fijada antes de medir; no se cambia)
- `npm test`, `npm run check`, `npm run humo`, `cargo test`.
- ABBA `--exe=A,B --fase6 --base-fase6`, B = exe de `24090e0` (el de T37 si sigue; si no, worktree):
  - B: D6b-C, B2 por mediana a mano según la 1.ª;
  - S6: mediana de las calientes ≤ 54,5 ms y máx. ≤ 60,0; una sola repetición si falla el máximo;
  - **P1 (ajuste 4), la misma regla que S6:** mediana ≤ 9,1 ms y máx. ≤ 10,1; una sola repetición si falla el máximo; no regresión «sin base» (B no tiene P1);
  - P2: D30-A.
- Si una fila falla, se frena y se consulta. Ancho de paleta igual: sin J-A. Netbook en C3.

## Riesgos
32 canvas montados antes del primer cuadro pueden mover P2 (se espera poco). `subgrupo` toca las 32 definiciones, no el `.brn`.
