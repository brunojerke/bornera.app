# Plan T35 — Símbolos de potencia (fase 6)

Aprobado por Bruno el 2026-11-24 con D13-A, D14-A, D15-A y D16-A, más 4 ajustes. Manda `docs/plan-fase6.md`. Parte de `b2ef3d0` (skill de cierre sobre `446115a`). Sin push ni tag.

## Alcance
- **14 símbolos nuevos** (los 16 de potencia menos los 2 pilotos de T34; total 24, con los 8 de mando de T36 da 32):
  - Q: `proteccion.termomagnetica_unipolar`/`_bipolar`/`_tripolar`/`_tetrapolar`, `proteccion.diferencial_bipolar`/`_tetrapolar`, `proteccion.guardamotor`, `maniobra.seccionador` (3P).
  - F: `proteccion.fusible_tripolar`, `proteccion.termico`. M: `motor.trifasico` (U V W), `motor.estrella_triangulo` (U1 V1 W1 / U2 V2 W2).
  - Fuentes: `fuente.trifasica_n` (8×4, L1 L2 L3 N), `fuente.tierra` (PE, forma red sin potencial, D11-B).
  - Polo N de las 4P y del diferencial 4P: bornes 7-8 con «N» dibujada (D8-A). Seccionador como los demás Q (ajuste 2).
- **R10 con la trifásica, R5 por prefijo, referencias por polos y motor sin falsos cortos.**

## Decisiones
- **D13-A:** protecciones y seccionador con `elemento: "proteccion"` y `polos` (`validarDefinicion` los admite en contactos y protecciones). En T35 no conducen (la netlist no lee `proteccion`, como en la fase 5); T36 las hace conducir siempre (D6-A).
- **D14-A:** motores con `elemento: "carga"` y 3 o 6 bornes: la netlist arma cargas solo de 2 bornes, así que no conducen ni son carga; 6b los habilita.
- **D15-A:** los bornes L1–L3 de una fuente de varios bornes cuentan como fases numeradas de R10 (de la definición, sin la tabla de `sim/`), en `validar` y en `avisosHoja`. Mismo texto; marca la Fase «L».
- **D16-A:** `FilaReferencia.polos` (el arreglo de `polosDe`, sin copiar); `textoFila` los une con «, »: «NA 1-2, 3-4, 5-6 (x, y)». Un polo, igual que hoy.
- **Ajuste 1 (R5):** nombre neutro por prefijo, no el del primer símbolo de la biblioteca: K «bobina», S «pulsador», H «lámpara» (textos de hoy), Q «protección o maniobra», F «protección», M «motor». Se descarta tomar el símbolo real de la hoja: el R5 de un componente dependería de otros grupos de etiqueta y `avisosHoja` lo recalcula por grupo. Test: todo prefijo de `SIMBOLOS` tiene nombre; guardamotor Q.

## Archivos
- Núcleo: `symbols/biblioteca.ts`, `symbols/validar.ts`, `symbols/tipos.ts` (comentarios), `model/validaciones.ts` (R5, R10), `model/referencias.ts`.
- Editor: `avisosHoja.ts` (R10 en vivo con la trifásica).
- Tests y humo (abajo); `io/deserializar.test.ts` cambia `motor.trifasico` como ejemplo de desconocido.
- Al cierre: `plan-fase6.md` (T35; T36 ya anotada, ajustes 2 y 3), `bench.md`.

## Tests nuevos
- `biblioteca.test`: test de bornes de los 14 (nombres, posiciones, polos, prefijo D9, `validarDefinicion`); 24 símbolos.
- `validar.test`: polos en protección sí; en carga, bobina y fuente no.
- `validaciones.test`: R10 con `fuente.trifasica` y `_n` (sin «L», nada); R5 con Q, F y M, guardamotor Q.
- `avisosHoja.test`: R10 al colocar, renombrar y borrar la trifásica.
- `referencias.test`: principal «NA 1-2, 3-4, 5-6»; auxiliar igual.
- `netlist.test` / `motor.test`: trifásica → Q1 → K1 → F2 → M1 (y M1 directo en L1 L2 L3): M1 fuera de cargas y contactos, sin corto ni «cargas en serie», K1 abierto y cerrado; N de la `_n` = red del Neutro «N».
- `etiquetado.test`: Q1, F1, M1 al colocar.
- Humo `t35-potencia.mjs`: colocar los 14 desde la paleta, referencia por polos visible, R10 en el panel. **Capturas en una sola carpeta, un archivo por símbolo con su tipo** (ajuste 4).

## Corte
- Etapa 1: núcleo, editor y tests → commit de checkpoint con `npm test` y `npm run check` en verde.
- Etapa 2: humo, ABBA, cierre.

## ABBA contra `446115a` (topes antes de medir)
`probar-webview2.mjs --fase5 --base-fase5`, 3 bloques, fría + caliente. Misma escena (`TIPOS_ESCENA_013`), sin J-A.
- S1 ≤ 54,5 (máx. 60,0) y no regresión; S2 1,7 / 5,3, S3 16,7, S5 100,0: tope y no regresión; S4 6,0 / 18,2 por tope.
- B1–B16 con D6b-C (B2 por mediana). **B10 se juzga:** mediana A ≤ B + máx(1 ms, 10 %).
- F1 ≤ 9 ms; F2 y F3 ≤ 1 s.
- Control: S4, B13, B15. Si falla solo una de control, se repite el ABBA una vez; si falla una juzgada, se frena y se consulta sin volver a medir.

## Riesgos
- La fila de 3 polos es más larga: puede pisar lo de su derecha (capturas).
- Dibujos IEC simplificados: los revisa Bruno en las capturas.

## Resultado (2026-11-25)
- Commits: `4a88e6c` (plan), `b010268` (checkpoint), `35f57ad` (humo y diferencial de 6 de alto), `b060cfb` (humos viejos con 24 ítems) y el de cierre.
- **Diferencial:** con 4 de alto la banda del toroide pisaba los nombres de los bornes de abajo (captura). Pasa a 6 de alto (bornes en ±3): el contacto sube 1 y el toroide queda en el tramo de abajo.
- **Expectativas de tests que cambiaron** (no relajan nada): cuentas de la biblioteca (10 → 24 en biblioteca, paleta, colocar, etiquetado, t07 y t17b); `comandos.test` con los ids derivados de `SIMBOLOS`; `deserializar.test` usa `motor.paso_a_paso` como desconocido; `armarEtiquetas.test` al azar con los 10 de T34 y 4 de potencia (con los 24 el auxiliar casi no salía); `uniones.test` suma el caso de T35 con 50 documentos y los mismos mínimos (con 25, los símbolos anchos dejaban 5 «anfitriones borrados» de 10).
- **ABBA contra `446115a`: pasa.** S y F pasan; B10 22,5 → 21,9 (igual); B2 1.º igual y B2 2.º 10,2 → 12,3 informa («B2 por mediana»). Detalle en `docs/bench.md`.
- **Pendiente para T36:** que conduzcan las protecciones (D13-A) y decidir el seccionador; el nombre de R5 para S cuando estén selector, seta y final («pulsador» hoy).
