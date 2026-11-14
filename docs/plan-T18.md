# Plan T18 — Referencias cruzadas

**Aprobado el 2026-11-14** con las decisiones de la tabla de abajo. Cuarta tarea de la fase 3b (`docs/plan-fase3b.md`), después de T17b y antes de T19.

**Estado de git al planear (verificado):** `main` en `234b7e6` (cierre de T17b), árbol limpio, 14 commits por delante de `origin/main`, sin push.

**Qué es:** debajo de cada bobina de contactor, la lista de sus contactos (los que tienen su misma etiqueta): si es NA o NC, sus bornes y dónde está cada uno.

## Decisiones (Bruno, 2026-11-14)

| D | Elegida | Qué |
|---|---|---|
| D0 número de orden | **A, bornes fijos** | T18 muestra 13-14 y 21-22 como están. El número de orden (13-14, 23-24, 31-32…) sigue como tarea aparte y no hace falta para T18. Los bornes de cada fila se leen por una sola función, así el número de orden entra después sin rehacer la lista. |
| D-qué se muestra | **A, solo bajo la bobina** | La lista de contactos de cada bobina. Nada junto a los contactos. |
| D-ubicación | **coordenadas de grilla** | Cada fila dice dónde está el contacto con `(x, y)`, en la convención de la barra de estado (ajuste 2). El núcleo devuelve la posición (hoja, x, y) y una función aparte la pasa a texto: con marco o varias hojas cambia solo esa función. |
| D-cuándo | **A, por comando** | Se recalcula la hoja en cada comando que toca una bobina o un contacto seguidor, nunca al mover el mouse. Núcleo puro y caché en el editor. |
| D-dibujo | **capa estática, sin interruptor** | La lista es parte del dibujo de la bobina. No se puede ocultar aparte: se apaga con los demás textos al alejar. No se guarda en el `.brn`: se deriva. |
| D-casos | **como la tabla de la sección 2** | Sin naranja: todo aviso es de T19. |
| D-interacción | **fuera de T18** | Sin clic en la lista. Queda como opcional (`docs/plan-fase3b.md`). |
| Topes nuevos del banco | **× 1,15 y + 1 ms** | *Rehacer con referencias*: por gesto hasta base × 1,15. *Mover 1 contacto con referencias*: paso hasta base + 1 ms. La base es `234b7e6` con el escenario copiado a su worktree. |

**Ajustes de Bruno al aprobar:**
1. **Ctrl+D contra el ancho de la lista.** Antes de programar el dibujo (primer paso de la etapa 2), verificar con un test que duplicar la rama de K1 no deja la lista de K1 encima de la rama de K2. Es el flujo del criterio de la fase 3b. Si choca, frenar y presentar opciones (fila más corta, lista en otro lado, otro desplazamiento).
2. **Misma convención que la barra de estado.** Las coordenadas de la lista usan el mismo origen y el mismo punto del componente. Un test lo fija.
3. **Sin restos.** Al cambiar la lista se invalidan la caja vieja y la nueva de la bobina: si la lista se achica o desaparece, no queda nada dibujado. Un test lo fija.
4. **Qué es "referencias cruzadas correctas"** para el criterio de la fase 3b: sección 3.
5. **Opcionales para después**, anotados en `docs/plan-fase3b.md`: la línea en el panel al seleccionar un contacto («Bobina K1 en (x, y)») y el clic para ir.

## 1. Estado verificado (2026-11-14, sobre `234b7e6`)

- **Vínculo contacto-bobina:** por etiqueta normalizada (`normalizarEtiqueta`: sin espacios a los lados y en mayúsculas). `esBobina` (`elemento: "bobina"`) y `sigueABobina` (`accionamiento: "bobina"`) son funciones privadas de `src/core/model/etiquetado.ts`.
- **Bornes:** fijos por definición (`src/core/symbols/biblioteca.ts`): auxiliar NA 13-14, auxiliar NC 21-22, bobina A1-A2. La clase del contacto sale de `elemento` (`contacto_na` o `contacto_nc`).
- **Marco:** no existe. La grilla son puntos sin límite (`src/render/grilla.ts`) y `Hoja` solo tiene nombre, componentes y cables. El marco con columnas y filas está previsto para el PDF de la fase 7 (`docs/arquitectura.md`).
- **Barra de estado** (`src/ui/BarraEstado.svelte`): muestra `X n · Y n`, la posición del cursor en unidades de grilla, redondeada. El origen es el (0, 0) de la grilla y la Y crece hacia abajo.
- **Punto del componente:** `Componente.x` e `y` son el centro del símbolo, su pivote de rotación (`src/core/model/documento.ts`).
- **Debajo de la bobina sale el cable:** el borne A2 está en (0, +2) y apunta hacia abajo. La etiqueta va a la izquierda del símbolo derecho (0° o 180°) y arriba del acostado (90° o 270°) (`posicionEtiqueta`, `src/render/simbolo.ts`).
- **Dibujo:** cada componente tiene una `cajaDibujo` que no puede quedarse corta: es la del índice espacial y la que se invalida en los mosaicos. `EscenaEditable.actualizar` ya devuelve la caja vieja y la nueva por separado, o una sola si contiene a la otra (`src/render/escenaEditable.ts`).
- **Reflejo de los comandos:** `Editor.reflejar` recibe los ids que cambió cada comando, también en deshacer y rehacer, y ahí se invalida `EtiquetasHoja` (`src/editor/editor.ts`).
- **Textos:** se apagan por debajo de 6 px por unidad (`src/render/detalle.ts`); al 31 % (6,2 px por unidad) todavía se ven. Cada texto distinto ocupa lugar en un atlas de 8 páginas de 512 px (`src/render/textos.ts`).
- **Escena del banco:** bobinas y auxiliares comparten el contador de la K (`generarBanco`, `src/render/banco.ts`), así que ninguna bobina tiene contactos con su etiqueta. Si la bobina sin contactos no dibuja nada, la escena se dibuja igual que hoy.
- **Ctrl+D** (`Editor.duplicar`, T16): pega al lado con dx = ancho de la caja del recorte, redondeado para arriba, + 2, y dy = 0. La caja del recorte son los cuerpos de los componentes y los puntos de los cables: no cuenta etiquetas ni textos.
- **Simulación:** `src/core/sim/` sigue vacío. T18 no simula nada.

### Supuestos (a verificar)
- **S1.** La práctica IEC es el "espejo de contactos" bajo la bobina: clase, bornes y ubicación de cada contacto, con la ubicación por hoja y columna. Dicho de memoria, sin verificar contra IEC 61082.
- **S2.** En la inversión de giro, cada contactor usa un NA (retención) y un NC (enclavamiento), así que con bornes fijos no hay filas repetidas. `tests/circuitos/inversion.brn` todavía no existe.
- **S3.** Recalcular toda la hoja cuesta menos de 1 ms con 2000 componentes, por analogía con los 0,5–0,9 ms que suma T17 al juntar las etiquetas. Lo mide el banco.
- **S4.** Los nombres de los bornes de una bobina acostada no chocan con la lista. Se prueba en la etapa 2.
- **S5.** Duplicar la rama de K1 de la marcha-parada no deja la lista de K1 sobre la copia (ajuste 1). Estimación, sin test todavía: la rama (S1, auxiliar K1, bobina K1, H1 y sus cables) ocupa de x = −2 a 17, así que dx = 21. La lista de K1 va de x ≈ 1,5 a 9,8 y la copia empieza en x ≈ 17. Lo confirma o lo niega el test del primer paso de la etapa 2.

## 2. Diseño

### Palabras
- **Bobina:** símbolo con `elemento: "bobina"`.
- **Contacto seguidor:** símbolo con `accionamiento: "bobina"` (hoy, los auxiliares NA y NC).
- **Lista de una bobina:** las filas de sus contactos seguidores, los de la misma hoja con su misma etiqueta normalizada y no vacía.
- **Fila:** un contacto: clase (NA o NC), sus dos bornes y su ubicación.

### Cómo se ve
Bajo K1, con un NA y un NC:

```
NA 13-14  (10, 11)
NC 21-22  (24, 11)
```

Con dos NA de la misma bobina (D0-A, bornes fijos), las dos filas dicen 13-14 y se distinguen por la ubicación:

```
NA 13-14  (10, 11)
NA 13-14  (24, 11)
```

La separación exacta entre las partes de la fila se ajusta en la etapa 2 con la captura a 1024×600.

### Núcleo: `src/core/model/referencias.ts` (puro, sin DOM)
- `referenciasCruzadas(hoja, indiceHoja = 0)`: id de bobina → sus filas. Solo trae las bobinas que tienen al menos una fila. Una pasada por la hoja, con un mapa por etiqueta.
- Cada fila: id del contacto, clase (`"NA"` o `"NC"`), los nombres de sus dos bornes y la ubicación `{ hoja, x, y }`, con `x` e `y` del componente.
- **Bornes de la fila:** salen de una sola función. Hoy devuelve los nombres de la definición; el número de orden cambia solo esa función.
- **Orden de las filas:** por el primer borne (13 antes que 21; como número si lo es), después por posición (y, x) y, a igualdad, en el orden de la hoja.
- `textoUbicacion(u)`: hoy `(10, 11)`. Con marco o varias hojas, cambia solo acá (`B3`, `2/B3`).
- `textoFila(fila)`: la línea que se dibuja.
- `esBobina` y `sigueABobina` se comparten con `etiquetado.ts` (se exportan o se mudan a `src/core/symbols/tipos.ts`, junto a `esSeguidor`), sin cambiar lo que hacen.
- **Por hoja**, como T17. La ubicación lleva el índice de hoja para cuando haya varias.

### Coordenadas (ajuste 2)
- La ubicación de una fila es `Componente.x` e `y` del contacto: el centro del símbolo.
- Es la misma convención que la barra de estado: con el cursor sobre el centro del contacto, la barra muestra los mismos dos números (origen en el (0, 0) de la grilla, Y hacia abajo, enteros).
- Los números se escriben igual que en la barra (un negativo, con su signo).
- **Verificado en la etapa 1:** la barra muestra el cursor, no un punto de un componente: `Math.round(camara.aGrilla(mouse))`, sin imán. `Componente.x` e `y` son el centro del símbolo (pivote, centro de `cajaCuerpo`, punto al que se traslada el dibujo) y siempre son enteros (`Colocar`, `Mover` y `deserializar` lo exigen). Con el cursor a menos de media unidad del centro, la barra muestra exactamente `x, y`. El plan no necesitó corrección.

### Editor: `src/editor/referenciasHoja.ts` (caché, sin vista)
- Guarda la lista de cada bobina de la hoja, ya como líneas de texto, y el id del contacto de cada fila.
- Se actualiza en `Editor.reflejar`, con cada comando (ejecutar, agrupar, deshacer, rehacer). Nunca con `pointermove` ni durante un arrastre: la lista muestra la ubicación vieja hasta soltar.
- **Se saltea** si el comando no toca ninguna bobina ni contacto seguidor (cablear, mover un pulsador): compara los ids del cambio con los de las bobinas y seguidores del último cálculo, y mira si alguno de los componentes que cambiaron lo es ahora.
- Al recalcular, compara con lo anterior y devuelve las bobinas cuya lista cambió. El editor actualiza en la escena solo esas, además de los componentes del cambio.
- Cuenta sus cálculos, como `EtiquetasHoja`, para el test de que mover el mouse no recalcula.
- Un documento nuevo es un editor nuevo, con su propio caché.

### Dibujo (`src/render`)
- `ComponenteEscena` suma `referencias`: las líneas ya armadas. El dibujo no sabe qué es una bobina.
- **Capa estática:** la lista se dibuja con el símbolo, en `dibujarSimbolo`, con la letra de los bornes (0,7 unidades). Se apaga con los demás textos por debajo de 6 px por unidad.
- **Lugar:** del lado opuesto a la etiqueta. En la bobina derecha (0° o 180°), a la derecha del cuerpo; en la acostada (90° o 270°), debajo. Justo debajo de la bobina derecha no se puede: ahí sale el cable de A2.
- **`cajaDibujo`** incluye la lista entera, con el ancho de la letra más ancha (`ANCHO_LETRA_MAXIMO`), como la etiqueta.
- **Sin restos (ajuste 3):** al cambiar la lista, la bobina pasa por `EscenaEditable.actualizar`, que invalida la caja vieja y la nueva.
- **Elegir con el mouse:** la lista no es zona de selección ni cuenta para el rectángulo.
- **Previas:** las de Colocar y Pegar no muestran lista.
- **Qué se garantiza:**
  - No tapa el símbolo, la etiqueta ni los nombres y marcas de sus bornes, en las 4 rotaciones y espejado.
  - En la marcha-parada, en la rama con NC y al duplicar la rama de K1 no toca ningún cable ni otro símbolo.
  - En general no se puede garantizar: un cable puede pasar por cualquier lado.
- Para comprobar que no tapa se usa el ancho por exceso de `anchoTexto` (0,7 por letra), no la cota de `cajaDibujo`.

### Casos (sin naranja)

| Caso | T18 | T19 |
|---|---|---|
| Bobina sin contactos | No dibuja nada. | — |
| Contacto sin bobina | No aparece en ninguna lista. | Lo marca. |
| Dos bobinas con la misma etiqueta | Las dos muestran la misma lista. | Marca la repetida. |
| Contacto sin etiqueta | No aparece. | Lo marca. |
| Bobina sin etiqueta | Sin lista. | Lo marca. |
| Contacto con la etiqueta de algo que no es bobina (auxiliar "S1") | No aparece. | Pendiente del prefijo. |
| Símbolo desconocido | No cuenta. | — |

### `.brn`
No cambia. La lista no se guarda ni se lee: se calcula al abrir, como todo lo demás de la escena.

## 3. Qué es "referencias cruzadas correctas" (criterio de la fase 3b)

En la inversión de giro dibujada a mano (`docs/plan-fase3b.md`, "Pasa cuando"), las referencias cruzadas son correctas si se cumplen las cuatro:
1. **La lista de K1 muestra exactamente sus contactos:** una fila por cada contacto seguidor con etiqueta K1, sin que falte ni sobre ninguno y sin filas de K2. Con el armado esperado (S2), su NA 13-14 de retención y su NC 21-22 de enclavamiento, que está en la rama de K2.
2. **La lista de K2, lo mismo** con los suyos.
3. **Cada fila dice bien dónde:** la clase y los bornes son los del contacto, y las coordenadas son las de su centro, las que muestra la barra de estado.
4. **Ninguna lista tapa la otra rama:** la lista de K1 no toca ningún símbolo, etiqueta, nombre de borne ni cable de la rama de K2, ni la de K2 los de la rama de K1. Tampoco los de su propia rama.

Nadie más tiene lista. Se comprueba al cierre de la fase, con el armado de referencia de la inversión.

## 4. Tests (Vitest)

### Núcleo: `src/core/model/referencias.test.ts`
- **Marcha-parada** (`marchaParada()`): K1 tiene una fila, NA 13-14 en (10, 11), y nadie más tiene lista.
- **Rama con NC:** la marcha-parada más un auxiliar NC "K1" que prende una lámpara H2. K1 tiene dos filas, primero la NA y después la NC.
- **Casos** de la tabla de la sección 2, uno por fila.
- **Normalización:** un contacto "k1 " sigue a la bobina K1.
- **Orden:** dos NA de una bobina salen en orden (y, x); el orden no depende del lugar en la lista de la hoja.
- **Rotar o espejar** un contacto no cambia su fila.
- **Coordenadas (ajuste 2):** la ubicación de la fila es `x` e `y` del componente, y el texto lleva esos dos números.
  - **La barra real no se prueba en Vitest** (decisión de Bruno al aprobar la etapa 1: sin test de `BarraEstado` con `svelte/server`). La prueba el humo t18 (etapa 3): con el mouse sobre el centro del contacto, la barra muestra los mismos números que la fila.
  - En el núcleo: ubicación = `(x, y)` = centro de `cajaCuerpo`, en las 4 rotaciones y espejado, con negativos, y el texto da lo mismo que `Math.round` con el cursor corrido hasta 0,4.
- **Al azar con semilla fija:** hojas con bobinas y contactos K1 a K5, vacíos y repetidos, y secuencias de colocar, mover, borrar, renombrar, pegar, duplicar, deshacer y rehacer. Después de cada paso, el cálculo es igual al de referencia lento: por cada bobina, filtrar toda la hoja.
  - El cálculo lento **no usa `normalizarEtiqueta`**: normaliza por su cuenta con `trim().toUpperCase()`, escrito en el test. Si no, el reemplazo de la prueba a propósito lo anularía en los dos y coincidirían.
- **Prueba a propósito:** con la normalización anulada (`vi.doMock` de `./etiquetas`, solo para un `referencias` cargado de nuevo), el mismo recorrido al azar tiene que encontrar al menos una diferencia.
- **`.brn`:** `serializar` de la marcha-parada da los mismos bytes que antes de T18.

### Editor: `src/editor/referenciasHoja.test.ts` y `editor.test.ts`
- Después de cada comando, deshacer y rehacer, el caché es igual a un cálculo nuevo. Va en el test al azar, pasando por el editor.
- No recalcula al mover el mouse ni durante un arrastre; sí al soltar.
- No recalcula con un comando que no toca bobinas ni seguidores (cablear, mover un pulsador).
- Mover un contacto actualiza solo la bobina de su etiqueta.
- Renombrar la bobina K1 a K5 con arrastre: la lista sigue completa. Sin arrastre, K5 queda sin lista.
- Borrar el último contacto: la bobina queda sin lista.
- Con la actualización del caché anulada a propósito, fallan.

### Dibujo: `src/render/simbolo.test.ts` y `escenaEditable.test.ts`
- `cajaDibujo` de una bobina con lista cubre todas las líneas, también con "WWWW", en las 4 rotaciones y espejado.
- La caja de la lista no toca la etiqueta, ni los nombres ni las marcas de los bornes de su bobina, en las 4 rotaciones y espejado (S4).
- **Sin restos (ajuste 3):** una bobina cuya lista pasa de dos filas a una, y de una a ninguna, devuelve cajas que cubren la caja vieja entera.
- En la marcha-parada y en la rama con NC, la caja de cada lista no toca ningún tramo de cable ni el dibujo de otro componente.
- Sin `referencias`, un componente hace las mismas llamadas al `Renderer` que hoy.
- El sha256 de `ESCENA_ACTUAL` (100, 500 y 2000) no cambia.

### Ctrl+D (ajuste 1), primer paso de la etapa 2
- Con el editor: armar la marcha-parada, seleccionar la rama de K1 (S1, auxiliar K1, bobina K1 y H1, con sus cables) y duplicar con Ctrl+D.
- La caja de la lista de K1 no toca ningún cuerpo, etiqueta, nombre de borne ni cable de la copia.
- La lista de K2 tampoco toca nada de la rama de K1.
- **Si choca, se frena** antes de programar el dibujo y se presentan opciones: fila más corta, lista en otro lado, otro desplazamiento de Ctrl+D.

## 5. Humo, banco y netbook (criterio fijado antes de medir)

### Humo: `tests/humo/t18-referencias.mjs` a 1024×600
- La marcha-parada muestra la lista de K1 con una fila.
- La barra de estado, con el cursor en el centro del contacto, muestra los mismos números que la fila (ajuste 2).
- Mover el contacto: la fila cambia al soltar, no antes. Ctrl+Z la devuelve.
- Sumar un NC "K1": segunda fila.
- Renombrar K1 a K5 en el panel: la lista sigue a la bobina.
- Borrar los contactos de a uno: la lista se achica y desaparece, sin restos en la captura (ajuste 3).
- Ctrl+D de la rama de K1: K2 con su lista, K1 con la suya, y ninguna tapa a la otra rama (ajuste 1).
- Dos bobinas K1: las dos con la misma lista, sin naranja.
- Guardar y reabrir: las mismas listas.
- Alejar hasta apagar los textos: la lista se apaga con ellos.
- `validarHoja` en 0 y ningún error de la página.
- Al cerrar la tarea, `npm run humo` entero.

### Banco (PC enchufada, modo Mejor rendimiento, apps cerradas)
Obligatorio: T18 toca el dibujo y el editor.

- **Escenas sin cambios:** el sha256 de `ESCENA_ACTUAL` no cambia.
- **Escenarios que ya existen**, contra `234b7e6` medido en la misma sesión, ABBA ×3 y dos tandas (6 corridas por versión en cada tanda; por celda, la mediana de las 6). No pasa si:
  - sube más de 10 % en las dos tandas, o
  - aparece un cuadro lento donde la base tiene 0.
- **Pegar 500:** mediana del paso ≤ base + max(10 %, 1 ms), en las dos tandas.
- **Duplicar todo (2000):** mediana del paso ≤ base × 1,10, en las dos tandas. Siguen los topes absolutos (150/300 ms y 40/80 ms en deshacer).
- **Escenarios nuevos**, en la escena con cables de 2000 al 31 %, con los auxiliares renombrados para seguir a las bobinas. El renombrado va fuera de lo medido y la nota dice cuántas bobinas quedan con lista y cuántas filas.

| Escenario nuevo | Pasa si |
|---|---|
| *Rehacer al 31 % con referencias* | por gesto ≤ base × 1,15 en las dos tandas, y 0 cuadros lentos nuevos |
| *Mover 1 contacto con referencias al 31 %* | mediana del paso ≤ base + 1 ms en las dos tandas, y 0 cuadros lentos |

- **Base de los escenarios nuevos:** `234b7e6` con el escenario copiado a su worktree (solo `tests/bench/pagina.ts`, sin commit). Ahí la misma escena no dibuja listas.
- La otra versión corre desde un worktree con su propio `npm ci`.
- Si algo no pasa, se frena y se presentan opciones antes de optimizar. La primera salida prevista es el índice incremental por etiqueta (D-cuándo B).

### Netbook
Solo si en la PC un paso pasa la mitad de su tope o aparece un cuadro lento. Si no, va al cierre de la fase 3b, junto con lo vigente: *Duplicar todo (2000)*, *Pegar 500* y el tope 160 de la previa (`docs/plan-T17.md`, "Vigente para el cierre de la fase 3b").

## 6. Etapas
Cada una en una sesión, con commit local y `/bornera-cierre`. Sin push ni versión. En PowerShell, `npm.cmd`.

| Etapa | Qué | Modelo sugerido |
|---|---|---|
| 0 | Docs: este plan, `plan-fase3b.md` (T18 apunta acá, número de orden revisado, opcionales) y Obsidian. Commit solo de docs. **Hecha el 2026-11-14.** | Sonnet |
| 1 | Núcleo: `src/core/model/referencias.ts` y sus tests (marcha-parada, rama con NC, casos, al azar contra el cálculo lento, `.brn`). `npm test` y `npm run check`. **Hecha el 2026-11-14** (ver "Etapa 1, hecha"). | Opus xhigh (lógica del núcleo) |
| 2 | Dibujo y editor. Primero, el test de Ctrl+D (ajuste 1). Después: la lista en la bobina, `cajaDibujo`, `src/editor/referenciasHoja.ts`, `reflejar` y los tests del editor y del dibujo. Prueba visual a 1024×600. | Opus alto |
| 3 | Humo t18 y banco: los dos escenarios nuevos, la comparación contra `234b7e6` y `docs/bench.md`. | Opus alto |
| 4 | Cierre: este plan, `plan-fase3b.md`, `arquitectura.md` y Obsidian. `npm run humo` entero. | Sonnet |

### Etapa 1, hecha (2026-11-14)
- **`src/core/model/referencias.ts`:** `referenciasCruzadas`, `bornesDeFila`, `textoUbicacion` y `textoFila`. Una pasada con un mapa por etiqueta. Las bobinas salen en el orden de la hoja y dos con la misma etiqueta comparten el mismo arreglo. `textoFila` da `NA 13-14  (10, 11)` y la separación se ajusta en la etapa 2.
- **`esBobina` y `sigueABobina`** pasaron a `src/core/symbols/tipos.ts`, sin cambiar lo que hacen. `etiquetado.ts` las importa de ahí.
- **Rama con NC:** opción `ramaNC` de `marchaParada()`: auxiliar NC "K1" en (24, 11) y lámpara H2 en (24, 22). De L sale una T en (0, 2) hasta el borne 21, del 22 se va a H2 X1, y H2 X2 vuelve con una T sobre w6 en (0, 30). Son 5 redes y todos los cables pasan la validación de W. No se combina con `dosNeutros`. La etapa 2 la reusa.
- **Tests:**
  - `referencias.test.ts` (25): marcha-parada, rama con NC, los casos de la tabla, normalización, orden, rotar y espejar, coordenadas, recorrido al azar y prueba a propósito.
  - El recorrido al azar: 1000 operaciones, semilla 20261114, partiendo de la marcha-parada con rama NC. Exige que cada operación salga al menos una vez y que se den las situaciones que prueban cada regla: lista de varias filas, bobinas repetidas, etiquetas que solo coinciden normalizadas, vacíos, contacto sin bobina, desconocido y pulsador con la etiqueta de una bobina, orden distinto del de la hoja y empate de borne y lugar.
  - Con la normalización anulada, el recorrido difiere en 777 pasos.
  - Probadas a mano y revertidas: sin la regla de etiqueta vacía, con el desempate invertido, sin orden por y, y con los pulsadores como seguidores. El recorrido las detecta todas (entre 660 y 779 pasos con diferencias).
  - `marchaParada.test.ts`: casos de la rama NC.
  - `tests/circuitos/marcha-parada.test.ts`: con las referencias calculadas, `serializar` da el mismo texto que el `.brn` congelado.
- **Resultado:** `npm test` con 1624 tests que pasan y 1 salteado; `npm run check` con 0 errores. No se tocó dibujo, editor ni interfaz.

## 7. Riesgos
- **Atlas de textos.** Con coordenadas, cada fila es un texto distinto. Con cientos de bobinas con lista, el atlas puede llenarse y el dibujo cae a `fillText`. Lo muestra *Rehacer con referencias*. Salida prevista: dibujar la fila en partes ("NA", "13-14" y la ubicación), que se repiten mucho más.
- **Ramas juntas.** La fila mide unas 8 unidades de ancho por exceso. Con menos de unas 12 unidades entre ramas, la lista de K1 toca la rama de K2. El ajuste 1 lo comprueba para Ctrl+D; para ramas acercadas a mano no hay garantía.
- **Cables sobre la lista.** Un cable tendido después puede pasar por encima de la lista. T18 no lo evita ni lo avisa.
- **Cajas más grandes.** La caja de dibujo de la bobina crece con la lista: tocarla rehace más mosaicos.
- **Costo por comando.** Cada comando que toca una bobina o un seguidor recorre la hoja (S3). Lo miden *Mover 1 contacto con referencias* y los escenarios de T16 y T17.
- **Dos NA con los mismos bornes.** Con D0-A, dos filas 13-14 de una misma bobina se leen como el mismo contacto usado dos veces. Se resuelve con el número de orden.
- **Arrastre.** Mientras se arrastra un contacto, la lista de su bobina muestra la ubicación vieja. Es lo elegido (D-cuándo).

## 8. Fuera de T18
- **Número de orden de los auxiliares:** tarea aparte (`docs/plan-fase3b.md`).
- **Junto a cada contacto, dónde está su bobina:** no se dibuja (D-qué A).
- **Opcionales para después** (`docs/plan-fase3b.md`): la línea en el panel al seleccionar un contacto y el clic para ir.
- **Interruptor para ocultar las listas:** no se hace.
- **Marco y zonas:** fase 7. Cuando llegue, cambia `textoUbicacion`.
- **Todo el naranja:** T19, con sus pendientes (el NC de enclavamiento que queda K2 al duplicar y la etiqueta con prefijo que no corresponde al tipo).
- **`tests/circuitos/inversion.brn`:** al cierre de la fase 3b.
