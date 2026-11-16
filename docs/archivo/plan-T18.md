# Plan T18 — Referencias cruzadas

**Aprobado el 2026-11-14** con las decisiones de la tabla de abajo. Cuarta tarea de la fase 3b (`docs/plan-fase3b.md`), después de T17b y antes de T19.

**T18 hecha el 2026-11-14** (etapa 4, cierre en `03d45d8` + docs). Lo que queda para el cierre de la fase 3b está al final: "Vigente para el cierre de la fase 3b".

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
1. **Ctrl+D contra el ancho de la lista.** Antes de programar el dibujo (primer paso de la etapa 2), verificar con un test que duplicar la rama de K1 no deja la lista de K1 encima de la rama de K2. Es el flujo del criterio de la fase 3b. Si choca, frenar y presentar opciones (fila más corta, lista en otro lado, otro desplazamiento). **Ampliado antes de la etapa 2:** el test se hace también con `marchaParada({ ramaNC: true })`, la rama más ancha (NC en x = 24). Ahí la lista de K1 no puede tocar ni la rama copiada ni el NC y la H2 propios.
2. **Misma convención que la barra de estado.** Las coordenadas de la lista usan el mismo origen y el mismo punto del componente. Un test lo fija.
3. **Sin restos.** Al cambiar la lista se invalidan la caja vieja y la nueva de la bobina: si la lista se achica o desaparece, no queda nada dibujado. Un test lo fija. **Ampliado antes de la etapa 2:** el test incluye borrar el último contacto: la lista desaparece y su caja vieja se redibuja.
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
- **S5.** Duplicar la rama de K1 de la marcha-parada no deja la lista de K1 sobre la copia (ajuste 1). Estimación, sin test todavía: la rama (S1, auxiliar K1, bobina K1, H1 y sus cables) ocupa de x = −2 a 17, así que dx = 21. La lista de K1 va de x ≈ 1,5 a 9,8 y la copia empieza en x ≈ 17. Lo confirma o lo niega el test del primer paso de la etapa 2. Con la rama NC, la rama ocupa de x ≈ −2 a 25, así que dx ≈ 29. La copia empieza en x ≈ 27. Lo más cerca de la lista de K1 es su propio NC y su H2, en x = 24, a unas 13 unidades del final de la lista. Los cables horizontales de esa rama van en y = 2 y en y = 30, lejos de la lista, que está a la altura de la bobina (y ≈ 22). También sin test todavía. **Confirmado el 2026-11-14:** dx = 21 y 29, sin choques (ver "Ctrl+D (ajuste 1)" en la sección 4).

## 2. Diseño

### Palabras
- **Bobina:** símbolo con `elemento: "bobina"`.
- **Contacto seguidor:** símbolo con `accionamiento: "bobina"` (hoy, los auxiliares NA y NC).
- **Lista de una bobina:** las filas de sus contactos seguidores, los de la misma hoja con su misma etiqueta normalizada y no vacía.
- **Fila:** un contacto: clase (NA o NC), sus dos bornes y su ubicación.

### Cómo se ve
Bajo K1, con un NA y un NC:

```
NA 13-14 (10, 11)
NC 21-22 (24, 11)
```

Con dos NA de la misma bobina (D0-A, bornes fijos), las dos filas dicen 13-14 y se distinguen por la ubicación:

```
NA 13-14 (10, 11)
NA 13-14 (24, 11)
```

La separación entre las partes de la fila es un espacio: la eligió Bruno en la etapa 2 con las capturas a 1024×600 (ver "Etapa 2").

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
  - **Borrar el último contacto**, pasando por el editor (comando `Borrar` y `reflejar`), con la marcha-parada: la bobina K1 queda sin lista y lo invalidado cubre la caja vieja entera de K1, la que tenía la lista. No alcanza con que se invalide la caja del contacto borrado, que está en otro lado. Con la invalidación de la bobina anulada a propósito, falla.
- En la marcha-parada y en la rama con NC, la caja de cada lista no toca ningún tramo de cable ni el dibujo de otro componente.
- Sin `referencias`, un componente hace las mismas llamadas al `Renderer` que hoy.
- El sha256 de `ESCENA_ACTUAL` (100, 500 y 2000) no cambia.

### Ctrl+D (ajuste 1), primer paso de la etapa 2
- Con el editor: armar la marcha-parada, seleccionar la rama de K1 (S1, auxiliar K1, bobina K1 y H1, con sus cables) y duplicar con Ctrl+D.
- La caja de la lista de K1 no toca ningún cuerpo, etiqueta, nombre de borne ni cable de la copia.
- La lista de K2 tampoco toca nada de la rama de K1.
- **Con la rama NC** (`marchaParada({ ramaNC: true })`), la rama más ancha: se selecciona la rama de K1 junto con el auxiliar NC "K1" en (24, 11), la H2 en (24, 22) y sus cables, así el ancho del recorte, y con él el dx de Ctrl+D, sale de la rama entera. El test anota el dx que dio.
  - La lista de K1 no toca nada de la rama copiada (cuerpos, etiquetas, nombres de bornes y cables, también su NC y su H2).
  - La lista de K1 tampoco toca su propio NC, su H2 ni los cables de esa rama (w9 a w11).
  - La lista de K2, lo mismo del otro lado: nada de la rama de K1 ni su propio NC y H2.
- **Si choca, se frena** antes de programar el dibujo y se presentan opciones: fila más corta, lista en otro lado, otro desplazamiento de Ctrl+D.
- **Hecho el 2026-11-14:** `src/editor/referenciasDuplicar.test.ts` (2 tests), **sin choques**. La caja de la lista es provisoria hasta que exista el dibujo: a la derecha del cuerpo con 0,5 de margen, letra de 0,7, ancho por exceso (`anchoTexto`) y 1 unidad por fila, centrada en la bobina. Los obstáculos son la `cajaDibujo` de cada componente (por exceso) y cada tramo de cable ± 0,1. Holguras medidas, en unidades:

| | Marcha-parada | Rama NC |
|---|---|---|
| dx real de Ctrl+D | **21** (recorte de −2 a 17) | **29** (recorte de −2 a 25) |
| Lista de K1 contra la copia | 6,58 (etiqueta de K2) | 13,58 (etiqueta de S2) |
| Lista de K1 contra su NC, su H2 y w9 a w11 | — | 6,9 (w11, en y = 30) |
| Lista de K2 contra la rama de K1 | 4,0 (H1) | 4,0 (la H2 original) |
| Lo más cerca de cada lista | 1,4 (w4 y w6, sus propios cables en x = 0) | 1,4 |
| Lámpara de la propia rama (H1; en la copia, H2 o H3) | 1,58 | 1,58 |

  - La copia renumera así: en la marcha-parada, S2, K2, K2 y H2. Con la rama NC, S2, tres K2, H3 y H4.
  - **Techo para la separación de `textoFila`:** la lámpara de la propia rama, a 1,58 de su `cajaDibujo` por exceso. Con la geometría provisoria, la fila puede crecer unas 3 letras como mucho (0,49 cada una). Contra la etiqueta real de H1 hay unas 2,8.
  - Prueba a propósito: con la lista 4,5 más a la derecha, los dos tests fallan.

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
- **El indicador de zoom de la barra se actualiza al cambiar el zoom con la rueda** (pedido de Bruno al elegir el separador: en las capturas de la etapa 2, con el zoom fijado por código, seguía diciendo "59 %").
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
| 2 | Dibujo y editor. Primero, el test de Ctrl+D (ajuste 1), con la marcha-parada y con la rama NC. Después: la lista en la bobina, `cajaDibujo`, `src/editor/referenciasHoja.ts`, `reflejar` y los tests del editor y del dibujo. Prueba visual a 1024×600. **Hecha el 2026-11-14** (ver "Etapa 2, hecha"). | Opus alto |
| 3 | Humo t18 (con el indicador de zoom al usar la rueda) y banco: los dos escenarios nuevos, la comparación contra `234b7e6` y `docs/bench.md`. **Hecha el 2026-11-14** (ver "Etapa 3, hecha"). | Opus alto |
| 4 | Cierre: este plan, `plan-fase3b.md`, `arquitectura.md` y Obsidian. `npm run humo` entero. **Hecha el 2026-11-14** (ver "Etapa 4, hecha"): solo docs, así que valen los tests y el humo entero de `03d45d8`. | Sonnet |

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

### Etapa 2, plan concreto (aprobado el 2026-11-14)

**`src/render/simbolo.ts`**
- `OpcionesSimbolo.referencias?: readonly string[]`: las líneas ya armadas. `dibujarSimbolo` las escribe dentro del bloque de textos, con `ALTO_BORNE` (0,7), así que se apagan con los demás textos.
- Una sola función decide dónde va la lista: `posicionReferencias(def, c, n)`, con punto de partida, paso entre filas y alineación. La usan `dibujarSimbolo`, `cajaDibujo` y `cajaReferencias`.
  - **Bobina derecha (0° o 180°):** a la derecha del cuerpo, con 0,5 de margen, alineada a la izquierda y centrada en la altura de la bobina. Paso de 0,9 por fila; el valor exacto sale de la captura.
  - **Nombres A1 y A2 del mismo lado** (180°, o 0° espejada, porque `ladoNombresBornes` "izquierda" queda a la derecha): la lista empieza después del nombre más ancho, por exceso, más 0,25. Si no, desde 3 filas chocaría con A1 y A2. Lo fija S4.
  - **Acostada (90° o 270°):** debajo del cuerpo, con 0,5 de margen y centrada en x. La etiqueta va arriba y los cables salen por los costados.
- `cajaReferencias(def, c, lineas, anchoLetra)`: la caja de la lista. Con `ANCHO_LETRA` sirve para "no tapa" y para el test de Ctrl+D, que deja la caja provisoria y pasa a usar esta. Con `ANCHO_LETRA_MAXIMO` sirve para `cajaDibujo`.
- `cajaDibujo(def, c, etiqueta?, referencias?)`: suma la caja de la lista con la letra más ancha y medio alto de letra de margen, como la etiqueta. Sin `referencias`, da lo mismo que hoy.

**`src/render/escena.ts` y `escenaEditable.ts`**
- `ComponenteEscena.referencias?: readonly string[]`. El dibujo no sabe qué es una bobina.
- Los 3 llamados a `cajaDibujo` (en `Escena`, y en `agregar` y `actualizar` de `EscenaEditable`) pasan `c.referencias`. `dibujarComponentes` las pasa a `dibujarSimbolo`.
- La forma para elegir (`formaComponente`) no cambia: la lista no es zona de clic ni cuenta para el rectángulo, que usa `formas`. Ya está verificado que el rectángulo no mira `cajaDibujo`.
- Las previas de Colocar (`editor.ts`) y Pegar (`dibujoPegar.ts`) no pasan `referencias`.

**`src/editor/referenciasHoja.ts`** (nuevo; caché sin vista, como `EtiquetasHoja`)
- Guarda `lineas(idBobina)`: un arreglo de `textoFila`, o `undefined` si no hay lista.
- `relevantes`: los ids de las bobinas y seguidores del último cálculo, con o sin etiqueta.
- `reflejar(idsCambio, componentesActuales)` devuelve las bobinas cuya lista cambió:
  - Se saltea si ningún id del cambio está en `relevantes` y ninguno de los componentes actuales es bobina o seguidor (`esBobina`, `sigueABobina`).
  - Si no, llama a `referenciasCruzadas(hoja)` y compara bobina por bobina, por las líneas unidas. Devuelve las que cambiaron, aparecieron o se quedaron sin lista.
- Cuenta sus cálculos (`calculos`) y se arma una vez en el constructor del editor.

**`src/editor/editor.ts`: `reflejar` con caja vieja y caja nueva**
- `aEscena(c)` suma `referencias: this.referencias.lineas(c.id)`.
- En `reflejar`, después de poner al día `indiceHoja.componentes` y **antes** del recorrido por la escena: `const cambiadas = this.referencias.reflejar(ids, actuales)`.
- El recorrido pasa por `ids ∪ cambiadas`. Para cada bobina de `cambiadas`, `escena.actualizar(id, aEscena(c))` devuelve la caja vieja (con la lista anterior) y la nueva, o una sola si una contiene a la otra, y las dos van a `invalidarRegion`. Así no quedan restos. Ejemplo: al borrar el último contacto, el cambio solo nombra al contacto, pero K1 entra por `cambiadas` y se invalida su caja vieja, la que tenía la lista.
- Si la bobina está oculta, `actualizar` devuelve `[]`, porque la capa dinámica la dibuja con su `ComponenteEscena` ya actualizado. Al soltar, `mostrar` invalida su caja.
- Durante el arrastre no se llama a `reflejar` (no hay comando), así que no se recalcula. Al soltar hay un `Mover` y ahí sí.

**Tests del editor:** `src/editor/referenciasHoja.test.ts` y casos en `editor.test.ts`
- Recorrido al azar por el editor (colocar, mover, borrar, renombrar con y sin arrastre, pegar, duplicar, deshacer y rehacer): después de cada paso, el caché da igual que `referenciasCruzadas` hecho de nuevo, y la `ComponenteEscena` de cada bobina tiene esas líneas.
- No recalcula con `pointermove` ni durante un arrastre; sí al soltar.
- No recalcula al cablear ni al mover un pulsador (`calculos` sin cambio).
- Mover un contacto actualiza solo la bobina de su etiqueta: `cambiadas` = {K1}.
- Renombrar K1 a K5 con arrastre: la lista sigue completa. Sin arrastre, K5 queda sin lista.
- **Sin restos (ajuste 3, por el editor):** con la marcha-parada, borrar el último contacto deja a K1 sin lista, y lo que pasa por `invalidarRegion` cubre la caja vieja entera de K1. Lo mismo de 2 filas a 1 con la rama NC. Ctrl+Z la devuelve y se invalida la caja nueva.
- Pruebas a propósito: con la actualización del caché anulada fallan los tests de caché, y con `cambiadas` vacío falla el de sin restos.

**Tests del dibujo:** `simbolo.test.ts`, `escenaEditable.test.ts` y `escena.test.ts`
- `cajaDibujo` con lista cubre todas las líneas, también con "WWWW", en las 4 rotaciones y espejado.
- **S4:** la caja de la lista (con `ANCHO_LETRA`) no toca la etiqueta, el cuerpo ni los nombres y marcas de los bornes, en las 4 rotaciones, con y sin espejado, con 1, 2 y 5 filas.
- **Sin restos:** `actualizar` de 2 filas a 1 y de 1 a ninguna devuelve cajas que cubren la vieja entera.
- En la marcha-parada y en la rama NC, ninguna lista toca un tramo de cable ni la `cajaDibujo` de otro componente.
- Sin `referencias`, las mismas llamadas al `Renderer` que hoy (renderer falso que las registra).
- El sha256 de `ESCENA_ACTUAL` (100, 500 y 2000) no cambia.
- El test de Ctrl+D pasa a usar `cajaReferencias` real. Si las holguras se mueven por el paso o la separación nuevos, se vuelven a anotar.

**Captura a 1024×600 para ajustar `textoFila`**
- Un script temporal en la carpeta de trabajo de la sesión, no en el repo, con `tests/humo/cdp.mjs`: arma en Node la rama NC con Ctrl+D hecho, la guarda como `.brn`, la abre en la app con Abrir (como t15a) y captura con F (encuadrar), al 100 % y al 31 %.
- Tres variantes, cambiando solo `textoFila`: `NA 13-14  (10, 11)` (dos espacios, la de hoy), `NA 13-14 (10, 11)` y `NA 13-14 · (10, 11)`. Si hace falta, también dos valores de paso (0,9 y 1,0).
- Te muestro las capturas, elegís, y fijo la variante en `textoFila` y sus tests. Con la geometría de hoy, ninguna puede ser más de 3 letras más larga que la actual (techo de 1,58).
- **No se hace en esta etapa:** humo t18 y banco, que son de la etapa 3.

**Ajustes de Bruno al aprobar la etapa 2:**
1. Test del peor caso de ancho: una fila con coordenadas largas y negativas («(-120, -345)») en la rama NC duplicada. Si choca con H1 no bloquea, pero se anota como límite conocido con el ancho exacto que entra.
2. Separador: tres capturas (dos espacios, un espacio y punto medio) al 100 % y al 31 % con la rama NC duplicada, con el margen contra H1 de cada una. Elige Bruno; hasta entonces queda el de hoy.
3. El test de Ctrl+D pasa a la caja real. Si el margen baja de 1 unidad contra cualquier cosa, se frena y se avisa.
4. Commit local y `/bornera-cierre` después de elegir el separador.

### Etapa 2, hecha (2026-11-14)
- **Dibujo** (`src/render/simbolo.ts`): `posicionReferencias`, `cajaReferencias` (ancho promedio por exceso), `cajaDibujo(def, c, etiqueta?, referencias?)` con la letra más ancha, y las líneas en `dibujarSimbolo` con `ALTO_BORNE`, paso `PASO_REFERENCIAS` = 0,9 y dentro del bloque de textos. Si A1 y A2 caen del lado de la lista (180°, o 0° espejado), la lista empieza en x = 1,97 en lugar de 1,5.
- **Escena:** `ComponenteEscena.referencias`, que se pasa a `cajaDibujo` (en `Escena` y en `agregar`/`actualizar` de `EscenaEditable`) y a `dibujarSimbolo`. `formaComponente` no cambia.
- **Editor:** `src/editor/referenciasHoja.ts` (caché, `reflejar` devuelve las bobinas cuya lista cambió) y `Editor.reflejar`, que actualiza en la escena esas bobinas antes que los ids del cambio. Así se invalidan su caja vieja y la nueva.
- **Ctrl+D con la caja real** (`referenciasDuplicar.test.ts`, 4 tests): sin choques, y la menor holgura contra cualquier cosa es **1,4** (≥ 1, no hizo falta frenar). Cambió respecto de la caja provisoria:
  - en la marcha-parada, contra sus propios cables: de 1,4 a 1,55 (una fila mide 0,7 de alto, no 1);
  - en la rama NC, contra w11: de 6,9 a 7,1;
  - todo lo demás, igual: la copia (6,58 y 13,58), la rama de K1 vista desde K2 (4,0) y la lámpara propia (1,58).
  - **Con el separador de un espacio** (elegido abajo), toda holgura medida hacia la derecha crece una letra (0,49): la copia, 7,07 y 14,07; la lámpara propia, **2,07**. Las demás no cambian (1,4; 1,55; 7,1; 4,0).
  - Sin duplicar, en la marcha-parada y en la rama NC, la lista de K1 tampoco toca nada (holgura ≥ 1) y nadie más tiene lista.
- **Límite conocido: el peor caso de ancho** (con el separador de un espacio). En la rama NC duplicada, la fila `NC 21-22 (-120, -345)` tiene **21 letras** y la lista termina en x = 11,79:
  - contra la `cajaDibujo` de H1 (por exceso), entra justo: **+0,11**;
  - contra la etiqueta de H1 como se dibuja, quedan **1,31**;
  - **lo que entra:** 21 letras sin tocar la `cajaDibujo` de H1 y 23 sin tocar su etiqueta. El peor caso ocupa ese tope: una letra más (por ejemplo `(-1200, -345)`) ya la toca. Una fila común como `NA 13-14 (10, 11)` (17 letras) tiene 4 letras de margen. En general no se garantiza (sección 2, "Qué se garantiza").
  - Con dos espacios, la misma fila tenía 22 letras y tocaba (−0,38). Lo fija el test "peor caso de ancho" de `referenciasDuplicar.test.ts`.
- **Tests nuevos:** `simbolo.test.ts` (S4 en las 4 rotaciones con y sin espejado, con 1, 2 y 5 filas; caja con «WWWW»; sin lista, las mismas llamadas al `Renderer`; con los textos apagados no se dibuja; no es zona para elegir), `escenaEditable.test.ts` (sin restos de 2 filas a 1 y de 1 a ninguna) y `referenciasHoja.test.ts` (11: no recalcula con el mouse, el arrastre, los cables ni los pulsadores; mover un contacto actualiza solo su bobina; renombrar con y sin arrastre; sin restos por el editor al borrar el último contacto y de 2 filas a 1; 600 operaciones al azar contra un cálculo nuevo).
- **Pruebas a propósito:** sin correr la lista después de A1 y A2, S4 falla. Sin mirar si los componentes actuales son bobina o contacto, fallan 5 tests del caché. Con las bobinas cambiadas sin pasar a la escena, la caja vieja no se invalida. Con el caché anulado, el recorrido al azar encuentra diferencias.
- **Separador:** un espacio, fijado en `textoFila` y en los textos esperados de los tests.
- **Resultado:** `npm test` con 1669 tests que pasan y 1 salteado; `npm run check` con 0 errores; `npm run humo` con 631 de 631 bien.
- **Banco, una corrida de control** (no es la comparación ABBA de la etapa 3): 0 cuadros lentos en todas las escenas. *Pegar 500* 5,1 ms (deshacer 1,3 ms) y *Duplicar todo (2000)* 49,2 ms (deshacer 8,2 ms), dentro de los topes absolutos (150 y 40 ms). La escena del banco no tiene listas: sus bobinas no tienen contactos con su etiqueta.
- **Pendiente para la etapa 3:** humo t18 (incluido el indicador de zoom al usar la rueda), los dos escenarios nuevos del banco y la comparación ABBA contra `234b7e6`.

**Separador de `textoFila`: un espacio**, elegido por Bruno el 2026-11-14 (capturas a 1024×600 de la rama NC duplicada, al 100 % = 20 px por unidad y al 31 % = 6,2 px por unidad; márgenes en unidades, por exceso):

| Variante | Fila | Letras | Fin de la lista | Contra la `cajaDibujo` de H1 | Contra la etiqueta de H1 |
|---|---|---|---|---|---|
| Dos espacios (la de antes) | `NA 13-14  (10, 11)` | 18 | 10,32 | 1,58 | 2,78 |
| **Un espacio (elegida)** | `NA 13-14 (10, 11)` | 17 | 9,83 | 2,07 | 3,27 |
| Punto medio | `NA 13-14 · (10, 11)` | 19 | 10,81 | 1,09 | 2,29 |

### Etapa 3, hecha (2026-11-14)

**Humo `tests/humo/t18-referencias.mjs`** (31 comprobaciones, a 1024×600)
- **Carga:** la marcha-parada se arma en Node y se abre con Ctrl+O. Las listas se leen de la escena del editor y se comparan con un cálculo nuevo.
- **Los 12 puntos de la sección 5:** lista de K1; barra de estado en el centro del contacto; mover el contacto; sumar un NC; renombrar K1 a K5; sin restos; Ctrl+D de la rama; dos bobinas K1; guardar y reabrir; textos apagados; indicador de zoom; `validarHoja` y errores.
- **Indicador de zoom:** ya seguía a la rueda (`alRueda` → `alCambiar` → `cambio()`), sin tocar `src`. El "59 %" de las capturas de la etapa 2 venía de fijar la cámara por código, que no pasa por `cambio()`.
- **Sin restos:**
  - Las fotos de referencia salen de documentos recién abiertos: sin lista (el NA sin etiqueta), con 1 fila y con 2 filas.
  - Desde el de sin lista, todo va por comandos: ni selección ni panel, así que solo se invalida lo que pide `reflejar`. Cada estado da los mismos píxeles que su referencia; al borrar el último contacto se compara en la caja de 2 filas.
  - Se hace **al 200 %**. Al 100 % un mosaico (256 px) mide 12,8 unidades y el del NA incluye la fila de K1: redibujarlo tapaba un resto.
  - **Probado a propósito:**
    - con `EscenaEditable.actualizar` devolviendo solo la caja nueva, al 100 % el humo pasaba igual y al 200 % falla «borrar el NA» (205 píxeles);
    - sin invalidar las bobinas cuya lista cambió, falla «crece a 2 filas».
  - De 2 filas a 1 no puede quedar resto: la caja nueva, con el cuerpo de la bobina, cubre la segunda fila.
- **Avisos:** con dos bobinas K1, lo que se comprueba es que no aparece ningún aviso nuevo. La barra ya tenía «Abierto en N ms».

**Banco** (`tests/bench/pagina.ts`, al final de la escena con cables)
- **Escenarios nuevos:** *Rehacer al 31 % con referencias* y *Mover 1 contacto con referencias al 31 %*.
- **Reparto:** fuera de lo medido, el auxiliar i pasa a la bobina floor(i / 3). Quedan 93 bobinas con lista y 277 filas.
- **Atlas:** se cuenta en la nota del escenario (textos con `fillText` por atlas lleno, veces lleno y máximo de textos).
- **Resultado** (detalle en `docs/bench.md`, "Referencias cruzadas"): ABBA ×3 en dos tandas contra `234b7e6`.
  - Pasan los dos escenarios nuevos (por gesto, base × 1,04; paso, base + 0,3 ms) y Pegar 500 y Duplicar todo.
  - El atlas no se llena: 0 `fillText`, hasta 793 textos.
  - 0 lentos en las 24 corridas.
  - 2 de 71 celdas comunes subieron en las dos tandas: *2000 · Editar al 100 %* y *500 · Mover todo al 31 %*. El diagnóstico con 10 veces más cuadros (regla fijada antes de medir: 7 de 10 pares) dio 1 y 4 de 10, y Bruno las **aceptó como ruido**.
- **Netbook:** no hace falta (ningún paso pasa la mitad de su tope, sin lentos).

**Resultado:** `npm test` con 1669 tests que pasan y 1 salteado; `npm run check` con 0 errores; `npm run humo` entero con 662 de 662 bien. Sin cambios en `src`.

### Etapa 4, hecha (2026-11-14)
- **Solo docs:** este plan (tabla de etapas y "Vigente para el cierre de la fase 3b"), `docs/plan-fase3b.md` (T18 hecha; sigue T19), `docs/arquitectura.md` (referencias cruzadas: hecho en T18, con las reglas en resumen) y Obsidian.
- **Verificación:** sin cambios en `src` ni en los tests, así que valen los de `03d45d8`: `npm test` con 1669 tests que pasan y 1 salteado, `npm run check` con 0 errores y `npm run humo` entero con 662 de 662 bien. No se volvieron a correr.
- **T18 hecha.** Sigue T19.

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

## 9. Vigente para el cierre de la fase 3b
Lo que T18 deja fijado para el cierre de la fase (`docs/plan-fase3b.md`), junto con la prueba de la inversión:
- **Separador de `textoFila`: un espacio** (`NA 13-14 (10, 11)`), elegido por Bruno con las capturas a 1024×600 (etapa 2).
- **Límite conocido: el peor caso de 21 letras.** En la rama NC duplicada, `NC 21-22 (-120, -345)` entra justo contra la `cajaDibujo` de H1 (+0,11) y una letra más ya la toca. Una fila común (17 letras) tiene 4 de margen. No se garantiza en general: lo fija el test "peor caso de ancho" de `referenciasDuplicar.test.ts`.
- **Banco:** las 2 celdas comunes que subieron en las dos tandas (*2000 · Editar al 100 %* y *500 · Mover todo al 31 %*) quedan **aceptadas como ruido** por Bruno (`docs/bench.md`, "Referencias cruzadas").
- **Netbook con Windows, al cierre de la fase:** lo que ya venía de T16 y T17 (*Duplicar todo (2000)*, *Pegar 500* y el tope 160 de la previa de pegar, `docs/plan-T17.md`) y, desde T18, los dos escenarios nuevos:
  - *Rehacer al 31 % con referencias*: en la PC, 22,58 / 22,26 ms por gesto contra 21,75 / 21,42 de la base (tope base × 1,15).
  - *Mover 1 contacto con referencias al 31 %*: en la PC, 1,10 ms de paso contra 0,80 / 0,75 de la base (tope base + 1 ms).
  - En la PC no hizo falta la netbook (ningún paso pasó la mitad de su tope, sin lentos). Si en la netbook suben, la primera salida prevista es el índice incremental por etiqueta (D-cuándo B); si se llena el atlas, dibujar la fila en partes (sección 7).
- **Referencias cruzadas correctas** en la inversión: las cuatro condiciones de la sección 3, con el armado de referencia y `tests/circuitos/inversion.brn`.
