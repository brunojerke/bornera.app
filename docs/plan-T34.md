# Plan T34 — Polos y netlist multipolo (fase 6)

Aprobado por Bruno el 2026-11-24 con D1-A, D2-A y D3-A, más 4 ajustes. Manda `docs/plan-fase6.md` (sección 2). Parte de `e74bcfe` (plan de fase 6 sobre `954f011`). Sin push ni tag.

## Lo que asumía «un contacto por componente»
- `motor.ts` `preparar`: `contactoDeComp` (comp → un contacto) arma `contactosEnRed`; con polos contaría solo el último (cargas en serie mal). Se arma por extremos.
- `prueba-motor.ts` (lento): `findIndex` por comp. Se arregla aparte, escrito distinto.
- `dibujoSimulacion.ts`: marca el componente si un polo está accionado; todos se mueven juntos. Sin cambio (test).
- `referencias.ts`: la fila del principal sale «NA 1-2-3-4-5-6» hasta T35 (formato por polos en T35).
- `compararRedes.ts`: el principal es seguidor; «K1·1»… no choca con los auxiliares. Sin cambio.

## Decisiones
- **D1-A:** la trifásica es `elemento: "fuente"`, sin prefijo ni número; etiqueta libre y opcional (entra vacía). Lo de «la etiqueta es la red» (R9, etiqueta obligatoria, rótulo «Red (etiqueta)», «otras en red») pasa a `nombraRed(def)` = fuente de 1 borne. Etiquetado sin cambios.
- **D2-A:** `redes()` da nombre por borne en las fuentes de varios bornes (L1, L2, L3, N). R6 (completo e incremental) y `compararRedes` ven lo mismo que la netlist; B13 lo controla.
- **D3-A:** el papel por borne vive en una tabla de `netlist.ts` por tipo y borne, como `PAPEL` (N1-A). Incluye `fuente.trifasica_n` (N neutro) aunque el símbolo sea de T35.

## Archivos
- Núcleo: `symbols/tipos.ts` (`polos?`, `polosDe`, `nombraRed`), `symbols/validar.ts` (polos solo en contactos; 2 bornes distintos y existentes; cada borne en un solo polo; contacto de ≠ 2 bornes exige `polos` que los cubran), `symbols/biblioteca.ts` (`fuente.trifasica` en Fuentes, `contactor.principal` en Potencia con dibujo accionado), `sim/netlist.ts`, `sim/motor.ts`, `sim/prueba-motor.ts`, `sim/prueba-netlist.ts`, `model/redes.ts`, `model/validaciones.ts` (R9), `model/comandos.ts` (etiqueta obligatoria).
- Editor: `editor.ts` (rótulo y «otras en red» con `nombraRed`), `avisosHoja.ts` (R6 incremental: red nombrada por la trifásica).
- Al cierre: `plan-fase6.md` (T34) y nota de `arquitectura.md` (redes por borne).

## Tests
- `validar.test`: cada error de polos. `biblioteca.test`: test de bornes de los 2 pilotos, 10 símbolos, 5 contactos con dibujo accionado; `colocar.test` 8 → 10.
- `netlist.test`: 3 polos con etiqueta y accionamiento; trifásica da L1–L3 fase; con Fase «L1» y entre dos trifásicas, misma red; su etiqueta no nombra; L1 cableado a L2 → `enCorto`. **Ajuste 2:** fuente de 4 bornes (L1, L2, L3, N) armada en el test: N da neutro y L1–L3 fases (el símbolo, en T35).
- `motor.test`: K1 cierra los 3 polos (U V W toman L1 L2 L3); sin bobina, reposo; K1 y K2 cruzados → «Cortocircuito entre L1 y L2» y se detiene; cargas en serie a través de polos.
- `motor-azar.test`: el lote de hoy igual (semilla 30) + lote nuevo con trifásica y principal (semilla propia, 200) contra el lento, con cobertura (corto entre fases, estable con polos cerrados). Proporciones ajustadas antes de fijar la semilla.
- Dibujo de la simulación: principal accionado. D1/D2: R9 no avisa la trifásica; etiqueta vacía no tira; R6 no marca en su red; incremental = completo.
- Iguales sin tocar: `sim.test`, `netlist-corpus`, `formato-v1`.
- Humo `t34-polos.mjs` (1024×600); t07 pasa a 10.

## Banco (fijado antes de medir)
ABBA `probar-webview2.mjs --exe=A,B --fase5 --base-fase5`, 3 bloques, fría + caliente. A = árbol de T34, B = exe de `954f011`; misma escena, sin J-A.

| Fila | Tope PC (mediana calientes) | Máx. ≤ | No regresión |
|---|---|---|---|
| S1 (arma la netlist) | 54,5 | 60,0 | **se juzga (ajuste 1)**; > 48 se avisa |
| S2 | 1,7 / 5,3 | 2,7 / 6,3 | se juzga |
| S3 | 16,7 | 18,4 | se juzga |
| S4 cuadro / gesto (control) | 6,0 / 18,2 | 7,0 / 20,0 | informa |
| S5 | 100,0 | 110,0 | se juzga |
| B13, B15 (control) | D6b-C | | |
| B1–B16, F1–F3 | regla vigente (B2 por mediana, F por tope) | | |

- No regresión: mediana A ≤ mediana B + máx(1 ms, 10 %).
- **Ajuste 4:** si falla solo una fila de control (B13, B15, S4), se repite el ABBA una sola vez; si falla una fila que se juzga, se frena y se consulta sin volver a medir.
- Informan: `netlist-node.mjs` (A y B) y el desglose de S1.

## Sesiones
1 o 2. **Ajuste 3:** si se parte, la primera termina con commit local de checkpoint con `npm test` y `npm run check` en verde; el ABBA va en la segunda.
