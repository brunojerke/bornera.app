# Plan T36 — Mando y protecciones que conducen (fase 6)

**Aprobado por Bruno el 2026-11-25** con D17-A, D18-A, D19-A y D20-B, más 4 ajustes. Manda `docs/plan-fase6.md`. Parte de `80c82f9` (24 símbolos). Sin push ni tag.

## Alcance
- **8 de mando** (total 32): `mando.selector` (NA 13-14) y `mando.seta` (NC 11-12), `manual_enclavado`, S; `mando.final_na` (13-14) y `mando.final_nc` (11-12), `manual_momentaneo`, S; `termico.contacto_nc` (95-96) y `_na` (97-98), `termico`, siguen a F; `proteccion.fusible` (1-2, mando, F); `senalizacion.bocina` (carga, H).
- **Conducen** termomagnéticas, diferenciales (N del bipolar en 3-4), guardamotor, fusibles, térmico y seccionador, siempre (D6-A).
- **Simular (D7-A):** un clic alterna el selector; la seta, enclavada: un clic la acciona (abre su NC) y otro la libera (ajuste 3); final como pulsador; Q y F no responden. 95-96 y 97-98 se dibujan en su estado real: 95-96 cerrado y 97-98 abierto, F no dispara en T36 (ajuste 1). La bocina es carga como la lámpara: se enciende, entra en «cargas en serie» y entre fase y neutro no es corto (ajuste 2).
- **R2** también para 95-96 y 97-98 sin `proteccion.termico` de su etiqueta: «No hay ningún relé térmico F2 para este contacto.»
- **Fuera:** disparar o abrir una protección a mano en Simular (6b, sección 6); referencias cruzadas del térmico y renombrar F con arrastre (pendientes).

## Decisiones
- **D17, cómo conducen.** **A (recomendada):** cada polo es un `ContactoNetlist` con modo «cerrado» en el motor (y en `prueba-motor`). + 6b solo cambia el modo (abierta o disparada); «cargas en serie» y el dibujo ven el polo. − Más polos en cada recálculo (las escenas S y B no tienen protecciones). **B:** unir sus redes al armar la netlist, como un cable. + Costo cero en el motor. − 6b lo rehace; antes y después del fusible son la misma red; sus bornes cuentan como «otros» y tapan cargas en serie.
- **D18, seccionador.** **A (recomendada):** entra cerrado como las protecciones; un clic no hace nada; abrirlo va en 6b con los disparos. + Sin caso especial; 6b suma «abierta» a todos los Q juntos. − En 6a no se corta la potencia a mano. **B:** un clic lo abre y otro lo cierra. + Útil ya. − Una protección que se opera (caso especial en motor y editor); adelanta estado de 6b (lo que descartó D6-B).
- **D19, R5 para S.** **A (recomendada):** «aparato de mando» («S1 es nombre de aparato de mando y esto es una lámpara»). + Neutro y cubre los cuatro. − Menos concreto. **B:** «pulsador, selector o final de carrera». + Explícito. − Largo; la seta queda como pulsador.
- **D20, dibujo de Q en Simular.** **A:** como en el esquema (abiertas); el color de las redes muestra que conducen. + Nada que dibujar. − Se ven abiertas y conducen. **B (recomendada):** `primitivasAccionado` cerradas en termomagnéticas, diferenciales, guardamotor y seccionador (mecanismo de T33; con D17-A conducen y salen accionadas solas). + Se ve lo que pasa. − 7 dibujos más.

## Etapas
**Etapa 0:** commit del plan (ajuste 4).
**Etapa 1 (núcleo y editor) → checkpoint** con `npm test` y `npm run check` en verde.
1. `biblioteca.ts`: los 8 de mando; D20.
2. `netlist.ts`: polos de `proteccion` como contactos cerrados (D17).
3. `motor.ts` y `prueba-motor.ts`: modo «cerrado»; `enclavados(n)` para el editor.
4. `validaciones.ts`: R2 con el térmico; R5 de S (D19).
5. `editor/simulacion.ts`: clic sin Mayús fija o suelta un enclavado; el final sigue como el pulsador.
6. `tests/circuitos/inversion-potencia.brn` (sección 0 de la fase) armado por un script de test, y su test de redes.

**Etapa 2:** humo, ABBA, cierre (`plan-fase6.md`, `bench.md`, Obsidian).

## Tests nuevos
- `biblioteca.test`: bornes, prefijo y `validarDefinicion` de los 8; 32 símbolos; cuentas 24 → 32 donde cuentan.
- `netlist.test`: un polo por par en Q de 1 a 4 polos; diferencial bipolar con N en 3-4; fusible de mando.
- `motor.test`: trifásica → Q1 → K1 → F2 → M1: con K1, U V W toman L1 L2 L3; sin K1, nada; sin corto ni «cargas en serie». F1 en serie con S0 conduce; 95-96 conduce y 97-98 no, y se dibujan así (ajuste 1); selector y seta alternan; bocina: se enciende, «cargas en serie» con una lámpara, sin corto entre fase y neutro (ajuste 2).
- Azar motor contra `prueba-motor` con protecciones y los 8 (semilla 36).
- `validaciones.test`: R2 del térmico con y sin F; R5 de S. `simulacion.test`: clic alterna selector y seta; Q y F no responden.

## Humo `t36-mando.mjs`
Colocar los 8 (captura por símbolo, una carpeta); Simular: selector y seta alternan con un clic, Q1 y F2 no responden y se ven cerrados, la bocina se enciende, M1 sin corto. `npm run humo` completo.

## ABBA contra `80c82f9` (topes antes de medir)
`probar-webview2.mjs --fase5 --base-fase5`, 3 bloques, fría + caliente. Escena igual (`TIPOS_ESCENA_013`), sin J-A (el ancho de la paleta no cambia).
- S1 ≤ 54,5 (máx. 60,0) y no regresión; S2 1,7 / 5,3, S3 16,7, S5 100,0: tope y no regresión; S4 6,0 / 18,2 por tope.
- B1–B16 con D6b-C. **B2 por mediana:** se juzga la 1.ª; la 2.ª informa. **B10 se juzga:** mediana A ≤ B + máx(1 ms, 10 %).
- F1 ≤ 9 ms; F2 y F3 ≤ 1 s.
- Control: S4, B13, B15. Si falla solo una de control, se repite una vez; si falla una juzgada, se frena y se consulta sin volver a medir.

## Riesgos
- `preparar` y `calcular` cambian (S2–S4 sin protecciones).
- 32 ítems a 1024×600: la paleta desplaza; los humos viejos cuentan ítems.
- Dibujos IEC simplificados: Bruno los revisa en las capturas.
