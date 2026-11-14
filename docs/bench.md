# Banco de dibujado

Resultados de `npm run bench`: tiempo de dibujado de las escenas de prueba con 100, 500 y 2000 símbolos al azar (siempre la misma semilla, así las corridas se pueden comparar). Se corre al final de cada fase, en esta PC y en la netbook.

## Cómo se mide

- Lienzo de 1366×768 (pantalla típica de netbook), dpr 1.
- El navegador es un Chrome, Chromium o Edge headless, que dibuja con el mismo código de la app (`src/render/capas.ts`). Sin GPU (`--disable-gpu`): rasterizado por software, más parecido a una netbook.
- Cada escenario es un **gesto** que se repite (más una repetición de calentamiento): los cuadros del gesto, uno cada 16,7 ms, y después la **cola**, los cuadros que la app sigue pidiendo sola hasta quedar nítida (mosaicos pendientes, o la espera de 150 ms después del zoom). El reloj es simulado: las esperas se saltan, no se duermen.
- Cada cuadro fuerza el rasterizado de la pantalla (`getImageData` de un píxel), así se mide el dibujo real y no solo el registro de las órdenes. Los mosaicos los rasteriza `Capas` al terminar cada uno (ver abajo).
- Columnas: mediana, p95 y máximo por cuadro; **Lentos** = cuadros de más de 16 ms (⚠ si hay alguno); **Por gesto** = suma de todos los cuadros del gesto, hasta quedar nítido.
- Escenarios:
  - *Rehacer al 100 %* y *Rehacer al 31 %*: con la vista quieta, se invalida la capa estática (contenido o colores nuevos). Al 31 % se dibujan textos y bornes (6,2 px por unidad): es el peor caso medido en la netbook.
  - *Encuadrar (F)*: salto del 100 % al encuadre de toda la escena.
  - *Zoom con la rueda*: ocho pasos de rueda seguidos, del 100 % al 30 %.
  - *Desplazar al 100 %*: ida y vuelta de a 6 px, sin salir de lo dibujado.
  - *Arrastre al 31 %*: 100 cuadros de 16 px (960 px/s), saliendo una y otra vez de lo dibujado.
- `npm run bench -- --comparar` mide además sin caché de textos y sin ninguna optimización.
- `npm run bench -- --escena-012` arma las escenas de 100, 500 y 2000 con los 5 símbolos de 0.1.2 (ver T15 abajo). Las comparaciones contra 0.1.2 usan esta opción.

## Referencias cruzadas (fase 3b, T18 etapa 3) — 2026-11-14

**Resultado:**
- **Escenarios nuevos: pasan.** *Rehacer al 31 % con referencias* y *Mover 1 contacto con referencias al 31 %*, con 0 lentos.
- **Pegar 500 y Duplicar todo: pasan** contra `234b7e6`, el cierre de T17b medido en la misma sesión.
- **El atlas de textos no se llena** en la escena de 2000 con referencias: 0 textos caen a `fillText` en las 12 corridas de HEAD de cada escenario nuevo.
- **Celdas comunes:** 2 de 71 suben más de 10 % en las dos tandas. Un diagnóstico con 10 veces más cuadros, con su regla fijada antes de medir, las dio como ruido y **Bruno las aceptó** (abajo).
- Lentos: 0 en las 24 corridas, de las dos versiones.
- Netbook: no hace falta. Ningún paso pasa la mitad de su tope y no apareció ningún lento (`docs/plan-T18.md`, sección 5).

**Cómo se midió:**
- HEAD es la etapa 3 sobre `4420832`, sin commit al medir.
- La base es `234b7e6`, en un worktree con su propio `npm ci` y el `tests/bench/pagina.ts` de HEAD copiado sin commit. Así corre los mismos escenarios, pero su escena no dibuja listas. El `pagina.ts` era idéntico en los dos árboles (mismo sha256).
- ABBA ×3 en dos tandas: 6 corridas por versión en cada tanda y, por celda, la mediana de las 6. Fue de 19:59:49 a 20:07:05 (hora de Argentina), unos 18 s por corrida.
- Condiciones, anotadas por el script antes de cada corrida (las 24 iguales): Edge 157 headless; PC enchufada y cargando (79 %); modo "Mejor rendimiento"; sin Opera, Gemini ni ChatGPT abiertos.
- El sha256 de `ESCENA_ACTUAL` no cambia (`banco.test.ts`, en `npm test`).

### Escenarios nuevos (escena con cables, al 31 %)

Antes de medir, los 277 auxiliares de la escena pasan a seguir a las bobinas, fuera de lo medido y en un solo `CambiarEtiquetas`. En el orden de la hoja, el auxiliar i recibe la etiqueta de la bobina floor(i / 3) (decisión de Bruno). Quedan **93 bobinas con lista y 277 filas**: en la escena de HEAD hay 93 con lista y en la de la base, 0. Al terminar se deshace.

| Escenario | Medida | Base T1 / T2 | HEAD T1 / T2 | Criterio | Resultado |
|---|---|---:|---:|---|---|
| Rehacer al 31 % con referencias | por gesto (ms) | 21,75 / 21,42 | 22,58 / 22,26 | ≤ base × 1,15: 25,01 / 24,63; 0 lentos | pasa |
| ″ | cuadro: mediana / p95 | 8,25 / 8,70 · 8,20 / 8,70 | 8,30 / 8,70 · 8,30 / 8,60 | – | – |
| Mover 1 contacto con referencias al 31 % | paso (ms) | 0,80 / 0,75 | 1,10 / 1,10 | ≤ base + 1 ms: 1,80 / 1,75; 0 lentos | pasa |
| ″ | deshacer (ms) | 0,20 / 0,25 | 0,60 / 0,50 | se informa | – |

- *Rehacer con referencias*: 12 veces `invalidarEstatica`, como *Rehacer al 31 %*. Las listas suman unos 0,8 ms por gesto (+4 %).
- *Mover 1 contacto*: en los pasos pares se aprieta, se mueve y se suelta (un `Mover`, que recalcula la lista de la bobina); en los impares se deshace. El contacto es el auxiliar con bobina más cercano al centro de la vista cuyo movimiento se acepta, elegido fuera de lo medido: K96 (`c916`), una unidad a la derecha, el mismo en las dos versiones. Lo que suma T18, unos 0,3 ms por paso, es el recálculo de las referencias de la hoja.
- **Atlas:** en las dos corridas de cada escenario y en las 12 corridas de HEAD, 0 textos con `fillText` por atlas lleno y 0 veces lleno. Guarda hasta 793 textos (678 en la base, sin listas).

### Pegar 500 y Duplicar todo

Paso en ms, T1 / T2: mediana de las 6 corridas de cada tanda.

| Escenario | `234b7e6` | HEAD | Criterio | Deshacer HEAD: medianas / máx. | Resultado |
|---|---:|---:|---|---:|---|
| Pegar 500 | 4,50 / 4,45 | 4,85 / 4,70 | ≤ base + max(10 %, 1 ms): 5,50 / 5,45 | 1,2 / 3,6 | pasa |
| Duplicar todo (2000) | 46,25 / 44,70 | 45,70 / 45,25 | ≤ base × 1,10: 50,88 / 49,17; máx. ≤ 300 (54,9) | 7,7–7,75 / 9,7 | pasa |

### Celdas comunes con suba repetida: aceptadas como ruido

En las dos tandas (mediana / p95 por cuadro en ms, mediana de las 6 corridas):

| Celda | Base T1 | HEAD T1 | Base T2 | HEAD T2 | Sube en las dos |
|---|---:|---:|---:|---:|---|
| 2000 · Editar al 100 % | 0,40 / 0,50 | 0,45 / 0,60 | 0,40 / 0,65 | 0,45 / 0,85 | mediana y p95 |
| 500 · Mover todo al 31 % | 1,50 / 3,40 | 1,55 / 3,75 | 1,45 / 3,50 | 1,50 / 3,85 | p95 |

Las dos escenas son sin cables y sin editor: ningún componente tiene lista. Para ellas, T18 solo suma en `cajaDibujo` una llamada que vuelve null enseguida y en `dibujarSimbolo` una propiedad más.

**Diagnóstico** (opción de Bruno): ABBA ×5 contra la misma base, con las repeticiones de esas dos celdas multiplicadas por 10 (de 3 a 30). Son 10 pares; en cada bloque ABBA, (1.ª A, 1.ª B) y (2.ª B, 2.ª A).
- **Regla, fijada antes de medir:** si en una celda HEAD supera a la base en más de 0,05 ms de mediana, o en más de 10 % de p95, en al menos 7 de los 10 pares, se saltea lo de referencias en el camino sin lista y se repiten las dos tandas. Si no, se acepta como ruido.
- **Duración real:** de 20:13:47 a 20:15:07 (hora de Argentina), **80 s para las 20 corridas**, con un arranque cada 4 s.
- **Por qué entran ~1500 cuadros por corrida en 4 s:** son 600 cuadros de *Editar* y 931 de *Mover todo*, más la repetición de calentamiento. Cada uno dibuja en 0,5 a 1,7 ms y el reloj del banco es simulado: los 16,7 ms entre cuadros no se esperan. Son unos 2 s de dibujo, más abrir el navegador headless y armar las escenas de 500 y 2000. La corrida completa del banco, con todas las escenas, tarda unos 18 s.
- **Condiciones:** las mismas que en las tandas, anotadas en las 20 corridas. Un primer intento con ChatGPT abierto se frenó y se descartó sin mirarlo.
- La opción `--diag-t18` fue un parche temporal en los dos árboles y no quedó en el repo.

| Celda | Base: mediana / p95 | HEAD: mediana / p95 | HEAD arriba (mediana / p95) | Pares con > 0,05 ms de mediana | Pares con > 10 % de p95 | Pares con alguna |
|---|---:|---:|---|---:|---:|---:|
| 2000 · Editar al 100 % | 0,50 / 0,80 | 0,50 / 0,80 | 0 / 2 de 10 | 0 | 1 | **1 de 10** |
| 500 · Mover todo al 31 % | 1,65 / 4,60 | 1,70 / 4,55 | 4 / 5 de 10 | 4 | 0 | **4 de 10** |

Ninguna celda llega a 7 pares: **las dos se aceptan como ruido** (decisión de Bruno, 2026-11-14, con la regla de arriba). En *Mover todo*, las diferencias son de un escalón de 0,1 ms para un lado o para el otro, y el p95 de HEAD sale menor. Ninguna versión tuvo lentos.

## Etiquetado automático (fase 3b, T17 etapa 3) — 2026-11-14

**Resultado:**
- **Escenario nuevo, *Etiquetar los vacíos (2000) y deshacer*: pasa** sus topes fijos, con 0 lentos.
- **Pegar 500 y Duplicar todo: pasan con el criterio relativo a `d969019`**, el cierre de T16 medido en la misma sesión. Con los topes fijos de T16 no pasaban, pero ese día tampoco los cumplía el código de T16. El cambio de criterio lo decidió Bruno (`docs/plan-T17.md`, sección 4), y desde ahora es regla de la fase (`docs/plan-fase3b.md`).
- **Contra `v0.1.3`:** 3 celdas suben en las dos tandas. Bruno las **aceptó como ruido** (abajo).
- Lentos: 0 en las 24 corridas de HEAD.

**Cómo se midió:**
- HEAD es la etapa 3 sobre `2b94228`, sin commit al medir.
- Dos comparaciones en la misma sesión, cada una con ABBA ×3 en dos tandas: 6 corridas por versión en cada tanda y, por celda, la mediana de las 6.
  - **Contra `v0.1.3`** (10:51 a 10:59): 62 celdas comunes, con la regla de T16.
  - **Diagnóstico contra `d969019`** (11:00 a 11:09): 70 celdas comunes, incluidos los escenarios de T16.
- En cada comparación, la otra versión corre desde un worktree con su propio `npm ci`, después de `git fetch --tags`.
- Condiciones de la PC, en las 48 corridas: Ryzen 7 170, Edge 157 headless, enchufada y cargando (79 %), modo "Mejor rendimiento", Opera y Gemini cerrados. Las anotó el script en cada corrida.
- Una corrida de prueba anterior, sin confirmar las condiciones, se descartó.

### Escenarios de T16 y T17 (escena con cables, al 31 %)

Paso en ms, T1 / T2: mediana de las 6 corridas de cada tanda. Deshacer de HEAD: el rango de las medianas de las 4 tandas y el máximo de las 24 corridas.

| Escenario | HEAD (contra `v0.1.3`) | HEAD (diagnóstico) | `d969019` | Criterio | Deshacer HEAD: medianas / máx. | Resultado |
|---|---:|---:|---:|---|---:|---|
| Pegar 500 | 5,05 / 5,15 | 6,05 / 5,30 | 5,15 / 4,75 | ≤ `d969019` + max(10 %, 1 ms): 6,15 / 5,75 | 1,0–1,1 / 2,9 | pasa |
| Duplicar todo (2000) | 51,4 / 54,8 | 59,35 / 59,20 | 54,35 / 57,30 | ≤ `d969019` × 1,10: 59,79 / 63,03; máx. ≤ 300 (74,6) | 9,7–11,9 / 21,6 | pasa |
| Etiquetar los vacíos (2000), nuevo | 2,60 / 2,85 | 3,10 / 2,85 | – | cada paso: mediana ≤ 40, máx. ≤ 80 (máx. 5,2) | 1,5–1,7 / 3,7 | pasa |
| Copiar 2000 (se informa) | 2,90 / 3,05 | 2,95 / 3,25 | 2,85 / 3,10 | – | – | – |

- *Etiquetar los vacíos*: antes de medir, se vacían los 1128 titulares de la escena con un `CambiarEtiquetas`, fuera de lo medido. Las fuentes y los contactos quedan como están. El paso es el botón del editor (un `CambiarEtiquetas` con los 1128) y después deshacer. Al terminar se deshace el vaciado. Cuadro: 8,5 / 9,0 / 10,0 ms (mediana / p95 / máximo).
- **Lo que suma T17:** en Pegar 500, de 0,55 a 0,9 ms (+12 % a +17 %), por renumerar los 224 componentes del lote y volver a juntar las etiquetas de la hoja. En Duplicar todo, de 3 % a 9 %.
- **El mismo código, otro día:** `d969019` dio 4,75–5,15 ms en Pegar y 54–57 ms en Duplicar. El 2026-11-13 había dado 3,8 y 42,5.

### Celdas comunes con suba repetida: aceptadas como ruido

Cada celda: mediana / p95 por cuadro en ms, mediana de las 6 corridas.

| Comparación · celda | Otra versión T1 | HEAD T1 | Otra versión T2 | HEAD T2 | Suba T1 | Suba T2 |
|---|---:|---:|---:|---:|---|---|
| `v0.1.3` · 100 · Mover todo al 31 % | 0,70 / 1,65 | 0,80 / 1,95 | 0,70 / 1,65 | 0,75 / 1,90 | mediana, p95 | p95 |
| `v0.1.3` · 100 · Arrastrar 40 completos al 58 % | 1,25 / 3,30 | 1,50 / 3,40 | 1,15 / 3,15 | 1,40 / 3,70 | mediana | mediana, p95 |
| `v0.1.3` · 500 · Arrastrar 40 en contornos al 58 % | 0,55 / 2,40 | 0,60 / 2,70 | 0,55 / 2,20 | 0,50 / 2,60 | p95 | p95 |
| `d969019` · 100 · Seleccionar al 31 % | 0,60 / 0,90 | 0,60 / 1,00 | 0,55 / 0,95 | 0,60 / 1,05 | p95 | p95 |
| `d969019` · 500 · Encuadrar (F) | 2,05 / 8,90 | 6,00 / 8,05 | 3,90 / 8,90 | 6,05 / 8,55 | mediana | mediana |

Por qué se aceptan como ruido (decisión de Bruno, 2026-11-14):
- `src/render` no cambió desde `v0.1.3`.
- Las escenas de 100 y 500 no usan el editor.
- Las celdas que suben no se repiten de una comparación a la otra. Ninguna de las 3 de `v0.1.3` sube en las dos tandas contra `d969019`, y las 2 de `d969019` no suben contra `v0.1.3`.
- HEAD tuvo 0 lentos en las 24 corridas. `v0.1.3` tuvo 1 y `d969019`, 2.

En *Encuadrar (F)* la mediana de la tanda salta entre dos valores (2 o 6 ms), según en qué cuadro cae la cola de mosaicos. El p95 no sube.

## Copiar, cortar, pegar y duplicar (fase 3b, T16 etapa 3) — 2026-11-13

**Resultado:**
- **Escenarios nuevos: pasan** todos, con 0 cuadros lentos en 16 corridas.
- **`TOPE_PREVIA_PEGAR` = 160.** Medido, toda la serie pasa, incluso 500, pero Bruno lo limitó a 160 hasta medir en la netbook al cerrar la fase 3b. En Mint, la previa fue unas 6 veces más lenta que en la PC (T14a).
- **Contra `v0.1.3`: pasa, salvo 2 celdas de 100 que no pasan por resolución del reloj,** como en T15:
  - *Seleccionar al 31 %*: la mediana sube de 0,40 a 0,50 y el p95 de 0,70 a 0,80.
  - *Mover 1 al 31 %*: la mediana sube de 0,30 a 0,35 y el p95 de 0,95 a 1,05.
  - Es un paso del reloj del banco, que mide de a 0,1 ms. Con 6 corridas, la mediana puede quedar a mitad de paso: de ahí los +0,05.
  - En esas escenas el código que corre es el mismo en las dos versiones: `src/render` no cambió desde `v0.1.3` y las escenas de 100, 500 y 2000 no usan el editor.
  - La primera corrida, con la PC inestable, había marcado otras celdas de 100 (*Desplazar al 100 %* y *Mover 1 al 31 %*, +0,05).
- Ningún lento en las 28 corridas de la repetición (16 de HEAD y 12 de `v0.1.3`).

**Cómo se midió** (criterio de `docs/plan-T16.md`, sección 4, y la regla de `docs/plan-T15.md`, sección 6):
- HEAD es la etapa 3 sobre `99e1ce2`, sin commit al medir. Se compara contra un worktree en `v0.1.3` con su propio `node_modules` (`npm ci`), después de `git fetch --tags`.
- Primero, 4 corridas de HEAD para la serie del tope. Después, dos tandas ABBA ×3: 6 corridas por versión en cada tanda y, por celda, la mediana de las 6.
- Cuentan la mediana y el p95 por cuadro, sin redondear, y los lentos sumados. Una suba (más de 10 %, o cualquier lento donde `v0.1.3` tiene 0) cuenta solo si se repite en la tanda 2.
- Escenarios comunes (62): los de 100, 500 y 2000 sin cables, y los de la escena con cables que ya existían en `v0.1.3`. Es la escena por defecto en las dos versiones, sin `--escena-012`: el banco y `src/render` no cambiaron.
- Los escenarios nuevos van al final de la escena con cables, así lo de antes corre igual. Se cuentan las 16 corridas de HEAD (4 de la serie y 12 de las tandas).

**Condiciones de la PC, corrida por corrida.** Ryzen 7 170, Edge 157.0.4341.46 headless, 1366×768, dpr 1, sin GPU.
- **Repetición (la que cuenta), 28 corridas entre las 14:50 y las 14:58:**
  - todas enchufadas y cargando, con la batería del 63 al 70 %;
  - todas en el modo "Mejor rendimiento";
  - en todas, Opera y Gemini cerrados;
  - VS Code y Claude abiertos, porque son la sesión que corre el banco.
  - El registro de cada corrida (hora, batería, modo y apps abiertas) se guardó al medir. En todas dio lo mismo.
- **Primera corrida, descartada (24 corridas entre las 14:09 y las 14:23):**
  - plan "Equilibrado", cargando con 36 % de batería, con Opera y Gemini abiertos;
  - el mismo paso varió hasta 3 veces entre corridas: *Soltar con todo seleccionado* de 13 a 43 ms y duplicar 2000 de 41 a 130 ms;
  - con esas corridas, el tope salía 160 o 500 según el momento.
  - Desde ahora, el banco se corre en las condiciones de T15 y se anotan.

### Escenarios nuevos (solo HEAD, 16 corridas)

Escena con cables (2000 componentes, 3000 cables y 30 T), al 31 %. Cuadro y paso en ms: mediana de las 16 corridas; el máximo es el mayor y los lentos, la suma.

| Escenario | Cuadro: mediana / p95 / máx. | Lentos | Paso: mediana / p95 / máx. | Deshacer: mediana / máx. | Criterio | Resultado |
|---|---:|---:|---:|---:|---|---|
| Pegar 500 y deshacer | 0,60 / 1,00 / 1,80 | 0 | 3,8 / 6,4 / 8,8 | 0,9 / 2,6 | cada paso: mediana ≤ 40, máx. ≤ 80; 0 lentos | pasa |
| Duplicar todo (2000) y deshacer | 1,30 / 1,60 / 2,00 | 0 | 42,5 / 45,6 / 55,8 | 8,0 / 14,0 | cada paso: mediana ≤ 150, máx. ≤ 300; 0 lentos | pasa |
| Copiar 2000 | 2,50 / 2,80 / 3,30 | 0 | 2,1 / 4,3 / 4,9 | – | se informa | – |
| Previa de pegar 40 | 0,80 / 1,20 / 2,70 | 0 | 0,1 / 0,3 / 1,8 | – | cuadro: mediana ≤ 4, p95 ≤ 8; 0 lentos | pasa |
| Previa de pegar 80 | 1,20 / 1,70 / 3,40 | 0 | 0,3 / 0,4 / 2,1 | – | ídem | pasa |
| Previa de pegar 160 | 2,10 / 3,00 / 5,90 | 0 | 0,5 / 0,9 / 2,4 | – | ídem | pasa |
| Previa de pegar 320 | 0,70 / 1,00 / 2,70 | 0 | 0,0 / 0,1 / 0,2 | – | ídem (revisa al soltar) | pasa |
| Previa de pegar 500 | 0,90 / 1,25 / 2,90 | 0 | 0,0 / 0,1 / 0,2 | – | ídem (revisa al soltar) | pasa |

- *Pegar 500*:
  - el recorte tiene 500 elementos (224 componentes y 276 cables) y se pega a la derecha de la escena, sin conflictos;
  - abrir la previa va fuera del paso: el paso es el clic que suelta (revisa, crea y ejecuta);
  - lo pegado cae fuera de la vista, como fija el plan.
- *Duplicar todo*: Ctrl+D con los 5030 elementos seleccionados, pegados al lado, y Ctrl+Z.
- **Previa**:
  - con 320 y 500 la herramienta no revisa en cada punto (se pasa del tope de 160), así que el paso no incluye la revisión y no hay ✕ que dibujar;
  - con 160 se revisa en cada punto y se dibujan hasta 796 ✕.

### Revisión por punto de la previa y el tope

La revisión (`problemasPegado` con la consulta y los contadores del editor) se mide aparte del paso y con cualquier tamaño, en los mismos 120 puntos por corrida.

**Por dónde pasa la previa:**
- El recorte son los componentes más cercanos a la zona densa: a un cuarto del ancho de la escena desde la izquierda, a media altura, lejos del anillo vacío alrededor del grupo del centro. Los cables entre ellos entran solos (D2a).
- La previa barre 60 puntos de grilla, de dx −30 a +29 con dy = 1, respecto del original. Pasa por encima del mismo grupo y de sus vecinos.
- Debajo siempre hay bornes y cables. El banco cuenta los conflictos de cada punto, y el mínimo nunca es 0.

| N (serie) | Elementos (comp. + cables) | Conflictos por punto | Revisión: mediana / p95 / máx. (ms) | p95 por corrida | ≤ 5 ms (p95) |
|---:|---|---|---:|---|---|
| 40 | 38 (17 + 21) | 10–147 | 0,20 / 0,30 / 1,80 | 0,3–0,4 | sí |
| 80 | 79 (33 + 46) | 33–373 | 0,30 / 0,50 / 2,00 | 0,4–0,7 | sí |
| 160 | 160 (74 + 86) | 48–796 | 0,60 / 0,90 / 7,90 | 0,8–1,2 | sí |
| 320 | 318 (146 + 172) | 113–1514 | 1,20 / 2,10 / 3,50 | 2,0–2,3 | sí |
| 500 | 500 (224 + 276) | 206–2520 | 1,90 / 3,20 / 5,40 | 2,9–3,5 | sí |

- Por el criterio (el mayor N con p95 ≤ 5 ms), el tope medido es 500. **Queda en 160** por el límite de Bruno. Se revisa en la netbook al cerrar la fase 3b, junto con duplicar 2000.
- Si 160 resulta caro allá, el primer cambio está en la etapa 1, sección 7 de `docs/plan-T16.md`: calcular una sola vez el traslado, el índice del lote y los recorridos.

### Contra `v0.1.3`: las celdas con alguna suba

Cada celda: mediana de las 6 corridas, en ms por cuadro. Las demás celdas, de las 62, no tienen suba en ninguna tanda.

| Escena · escenario | 0.1.3: mediana / p95 | HEAD: mediana / p95 (tanda 1) | Suba T1 | Suba T2 | Resultado |
|---|---:|---:|---|---|---|
| 100 · Seleccionar al 31 % | 0,40 / 0,70 | 0,50 / 0,80 | mediana, p95 | mediana, p95 | **no pasa por resolución del reloj** |
| 100 · Mover 1 al 31 % | 0,30 / 0,95 | 0,35 / 1,05 | mediana, p95 | mediana, p95 | **no pasa por resolución del reloj** |
| 100 · Arrastrar 40 en contornos al 58 % | 0,90 / 3,00 | 1,20 / 3,85 | mediana, p95 | – | pasa (no se repite) |
| 500 · Desplazar al 100 % | 0,25 / 0,45 | 0,30 / 0,50 | mediana, p95 | – | pasa (no se repite) |
| 500 · Arrastre al 31 % | 0,30 / 0,60 | 0,30 / 0,75 | p95 | mediana | pasa (otra métrica) |
| 500 · Editar al 31 % | 0,60 / 1,00 | 0,60 / 1,15 | p95 | – | pasa (no se repite) |
| 500 · Seleccionar al 31 % | 0,80 / 1,20 | 0,85 / 1,40 | p95 | – | pasa (no se repite) |
| 500 · Arrastre con todo seleccionado al 31 % | 0,60 / 1,10 | 0,75 / 1,30 | mediana, p95 | – | pasa (no se repite) |
| 500 · Mover 1 al 31 % | 0,30 / 0,80 | 0,35 / 0,85 | mediana | p95 | pasa (otra métrica) |
| 500 · Mover todo al 31 % | 1,55 / 4,00 | 1,75 / 4,35 | mediana | – | pasa (no se repite) |
| 500 · Editar al 100 % | 0,40 / 0,55 | 0,35 / 0,60 | – | mediana, p95 | pasa (no se repite) |
| 2000 · Desplazar al 100 % | 0,20 / 0,30 | 0,20 / 0,35 | p95 | – | pasa (no se repite) |
| 2000 · Mover 1 al 31 % | 0,30 / 0,70 | 0,35 / 0,70 | mediana | – | pasa (no se repite) |
| 2000 · Editar al 100 %, Editar al 31 %, Seleccionar al 31 % | – | – | – | mediana, p95 | pasa (no se repite) |
| 2000 + cables · Cable en curso al 58 % | 0,30 / 0,40 | 0,30 / 0,45 | p95 | – | pasa (no se repite) |
| 2000 + cables · Soltar reconectando al 58 % | 0,60 / 0,80 | 0,60 / 0,90 | p95 | – | pasa (no se repite) |
| 2000 + cables · Girar 1 cableado al 58 % | – | – | – | p95 | pasa (no se repite) |

Lentos: 0 en las dos versiones, en todas las celdas y las dos tandas.

## Contra 0.1.2 (fase 3, T15 etapa 4) — 2026-11-13

**Resultado: no pasa, con la causa conocida.**
- *Encuadrar (F)* con 2000: la mediana por cuadro sube en las dos tandas, con las dos escenas (+83 a +136 %). Causa: T14n (dos `setTransform` por símbolo) más lo acumulado desde T2 (ver "Curva por commit"). Queda como "no pasa: +20 % por gesto". Optimizarlo es una tarea aparte, después de T15; la medición en la netbook decide la urgencia (D16-A).
- *Arrastre al 31 %* con 500 y 2000, mediana, solo con `--escena-012`: **no pasa por resolución del reloj (0,05 ms)**. La suba es de 0,25 → 0,30 ms en tres casos y de 0,20 → 0,30 en el otro, medio paso y un paso del reloj del banco, que mide de a 0,1 ms. El criterio no tiene piso, así que cuenta igual.
- 0 cuadros lentos en las 48 corridas, también en la escena con cables.

**Cómo se midió** (criterio de `docs/plan-T15.md`, sección 6, fijado antes de medir):
- HEAD contra un worktree en `v0.1.2` con su propio banco y su propio `node_modules` (`npm ci`). Solo los escenarios comunes: 100, 500 y 2000 sin cables.
- Cada tanda, en orden ABBA ×3 (0.1.2, HEAD, HEAD, 0.1.2…): 6 corridas por versión y, por celda, la mediana de las 6.
- Cuentan la mediana y el p95 por cuadro, comparados sin redondear (D12-A), y los lentos sumados en las 6 corridas (D13-B). El tiempo por gesto solo se informa.
- Suba: más de 10 % en la mediana o el p95, o cualquier lento si 0.1.2 tiene 0. Solo cuenta si se repite en la tanda 2, en el mismo escenario y la misma métrica.
- PC de siempre (Ryzen 7 170, Edge 157 headless, 1366×768, dpr 1, sin GPU): enchufada, en "Mejor rendimiento", con Opera y Claude cerrados.

Cada celda: tanda 1 · tanda 2. Tiempos por cuadro en ms.

### Tabla oficial: cada versión con su escena

HEAD = `e137ea8`. Desde `c638a35` (Fase y Neutro) la lista de símbolos tiene 7 y no 5, así que con la misma semilla la escena cambia de tipos: en HEAD, 595 de los 2000 son Fase o Neutro (876 círculos contra 395). Posiciones, rotaciones y zoom después de F son iguales.

| Símbolos | Escenario | 0.1.2: mediana / p95 | HEAD: mediana / p95 | Δ mediana | Δ p95 | Por gesto (ms) | Resultado |
|---:|---|---:|---:|---:|---:|---:|---|
| 100 | Rehacer al 100 % | 8,5 / 8,9 · 8,5 / 8,9 | 8,5 / 8,9 · 8,4 / 8,8 | +1 % · −2 % | +0 % · −1 % | 10,8 → 11,7 · 10,9 → 11,4 | pasa |
|  | Rehacer al 31 % | 8,5 / 9,0 · 8,5 / 8,9 | 8,6 / 8,9 · 8,5 / 8,9 | +1 % · +1 % | −2 % · +1 % | 9,0 → 8,9 · 8,9 → 9,5 | pasa |
|  | Encuadrar (F) | 6,3 / 7,4 · 6,4 / 7,9 | 7,2 / 8,9 · 6,1 / 8,3 | +14 % · −5 % | +20 % · +6 % | 8,8 → 9,9 · 9,0 → 9,9 | pasa (no se repite) |
|  | Zoom con la rueda | 2,7 / 7,9 · 2,7 / 7,8 | 2,8 / 8,1 · 2,8 / 8,0 | +2 % · +4 % | +3 % · +1 % | 27,7 → 27,8 · 27,6 → 28,4 | pasa |
|  | Desplazar al 100 % | 0,3 / 0,4 · 0,3 / 0,5 | 0,3 / 0,5 · 0,2 / 0,4 | +20 % · −20 % | +25 % · −22 % | 6,7 → 7,7 · 6,9 → 5,9 | pasa (no se repite) |
|  | Arrastre al 31 % | 0,4 / 0,8 · 0,3 / 0,6 | 0,3 / 0,7 · 0,3 / 0,6 | −25 % · +0 % | −13 % · +0 % | 41,5 → 33,4 · 33,0 → 31,8 | pasa |
| 500 | Rehacer al 100 % | 8,5 / 8,8 · 8,5 / 8,8 | 8,5 / 9,2 · 8,6 / 9,2 | +0 % · +2 % | +3 % · +4 % | 11,2 → 14,9 · 10,5 → 14,3 | pasa |
|  | Rehacer al 31 % | 8,6 / 9,1 · 8,4 / 9,0 | 8,2 / 8,8 · 8,5 / 8,8 | −4 % · +1 % | −4 % · −2 % | 19,0 → 15,6 · 16,5 → 16,5 | pasa |
|  | Encuadrar (F) | 5,5 / 6,7 · 5,3 / 6,8 | 5,6 / 6,6 · 6,0 / 7,2 | +1 % · +13 % | −1 % · +5 % | 7,3 → 6,8 · 7,0 → 7,5 | pasa (no se repite) |
|  | Zoom con la rueda | 2,7 / 8,6 · 2,7 / 8,7 | 2,6 / 8,7 · 2,8 / 8,7 | −2 % · +2 % | +1 % · −0 % | 34,6 → 35,1 · 35,8 → 36,5 | pasa |
|  | Desplazar al 100 % | 0,2 / 0,4 · 0,3 / 0,4 | 0,2 / 0,3 · 0,3 / 0,5 | +0 % · +0 % | −13 % · +43 % | 6,0 → 5,9 · 6,4 → 8,1 | pasa (no se repite) |
|  | Arrastre al 31 % | 0,2 / 0,5 · 0,6 / 1,0 | 0,3 / 0,6 · 0,2 / 0,5 | +50 % · −64 % | +30 % · −48 % | 25,2 → 33,6 · 59,7 → 26,2 | pasa (no se repite) |
| 2000 | Rehacer al 100 % | 8,5 / 9,0 · 8,6 / 9,1 | 8,4 / 8,7 · 8,3 / 8,7 | −1 % · −3 % | −3 % · −4 % | 13,7 → 9,5 · 14,7 → 9,8 | pasa |
|  | Rehacer al 31 % | 8,4 / 8,9 · 8,5 / 9,0 | 8,4 / 8,9 · 8,4 / 8,8 | +1 % · −1 % | +1 % · −2 % | 23,7 → 23,0 · 24,9 → 23,7 | pasa |
|  | **Encuadrar (F)** | 2,8 / 8,9 · 3,3 / 9,0 | 6,5 / 9,1 · 6,7 / 9,2 | **+136 % · +100 %** | +3 % · +3 % | 12,4 → 16,4 · 13,4 → 17,2 | **no pasa** (mediana) |
|  | Zoom con la rueda | 2,9 / 8,9 · 3,0 / 8,9 | 2,7 / 8,7 · 2,6 / 8,8 | −5 % · −12 % | −2 % · −2 % | 44,8 → 40,0 · 46,6 → 39,2 | pasa |
|  | Desplazar al 100 % | 0,3 / 0,4 · 0,3 / 0,5 | 0,2 / 0,3 · 0,2 / 0,4 | −33 % · −33 % | −25 % · −22 % | 6,8 → 5,1 · 7,9 → 5,6 | pasa |
|  | Arrastre al 31 % | 0,3 / 2,4 · 0,3 / 2,4 | 0,3 / 2,2 · 0,3 / 2,1 | +0 % · +20 % | −6 % · −11 % | 43,0 → 47,9 · 41,9 → 41,5 | pasa (no se repite) |

### Con `--escena-012`: la escena de 0.1.2 en las dos versiones

HEAD = `e137ea8` con la opción, el código que quedó en `2a2df4f`. Con la opción, `generarBanco` elige entre los 5 símbolos de 0.1.2, buscados por tipo y en el orden de esa versión. El test (`banco.test.ts`) compara las tres escenas, componente por componente, con un SHA-256 sacado de `v0.1.2`.

| Símbolos | Escenario | 0.1.2: mediana / p95 | HEAD: mediana / p95 | Δ mediana | Δ p95 | Por gesto (ms) | Resultado |
|---:|---|---:|---:|---:|---:|---:|---|
| 100 | Rehacer al 100 % | 8,4 / 8,9 · 8,4 / 8,9 | 8,5 / 8,9 · 8,5 / 8,9 | +1 % · +1 % | +1 % · −1 % | 11,0 → 11,4 · 11,0 → 11,2 | pasa |
|  | Rehacer al 31 % | 8,5 / 9,0 · 8,6 / 8,9 | 8,6 / 8,9 · 8,6 / 8,9 | +1 % · +0 % | −1 % · +1 % | 9,3 → 9,5 · 9,2 → 9,7 | pasa |
|  | Encuadrar (F) | 6,4 / 7,4 · 6,3 / 7,2 | 6,3 / 7,5 · 6,3 / 7,4 | −2 % · +0 % | +1 % · +3 % | 9,0 → 8,8 · 8,9 → 8,7 | pasa |
|  | Zoom con la rueda | 2,7 / 7,8 · 2,7 / 7,8 | 2,8 / 8,0 · 2,8 / 8,1 | +4 % · +2 % | +3 % · +5 % | 27,8 → 28,2 · 27,7 → 28,6 | pasa |
|  | Desplazar al 100 % | 0,2 / 0,4 · 0,3 / 0,4 | 0,3 / 0,4 · 0,2 / 0,5 | +50 % · −20 % | +0 % · +25 % | 6,2 → 7,5 · 6,4 → 6,7 | pasa (no se repite) |
|  | Arrastre al 31 % | 0,3 / 0,6 · 0,3 / 0,6 | 0,3 / 0,6 · 0,3 / 0,6 | +0 % · +0 % | +8 % · +0 % | 30,6 → 33,9 · 30,3 → 29,7 | pasa |
| 500 | Rehacer al 100 % | 8,5 / 8,9 · 8,5 / 8,8 | 8,5 / 9,0 · 8,5 / 8,9 | +0 % · +1 % | +2 % · +1 % | 10,4 → 13,1 · 10,3 → 10,9 | pasa |
|  | Rehacer al 31 % | 8,4 / 8,9 · 8,3 / 8,8 | 8,4 / 9,0 · 8,4 / 8,8 | +0 % · +0 % | +1 % · −0 % | 16,8 → 17,0 · 16,4 → 16,7 | pasa |
|  | Encuadrar (F) | 5,3 / 7,8 · 5,2 / 6,8 | 5,6 / 6,6 · 5,4 / 6,3 | +7 % · +4 % | −15 % · −8 % | 7,1 → 6,9 · 7,0 → 6,7 | pasa |
|  | Zoom con la rueda | 2,7 / 8,7 · 2,8 / 8,7 | 2,7 / 8,8 · 2,8 / 8,7 | +0 % · −2 % | +2 % · +1 % | 35,6 → 38,4 · 35,7 → 37,7 | pasa |
|  | Desplazar al 100 % | 0,2 / 0,3 · 0,3 / 0,4 | 0,3 / 0,4 · 0,3 / 0,4 | +50 % · +0 % | +33 % · +0 % | 5,8 → 7,0 · 6,2 → 6,5 | pasa (no se repite) |
|  | Arrastre al 31 % | 0,3 / 0,6 · 0,3 / 0,8 | 0,3 / 0,6 · 0,3 / 0,6 | +20 % · +20 % | +0 % · −25 % | 27,2 → 32,2 · 34,1 → 27,9 | **no pasa** por resolución del reloj (0,05 ms) |
| 2000 | Rehacer al 100 % | 8,6 / 9,4 · 8,6 / 9,2 | 8,3 / 8,8 · 8,4 / 8,7 | −3 % · −3 % | −7 % · −6 % | 18,1 → 9,6 · 17,6 → 9,6 | pasa |
|  | Rehacer al 31 % | 8,4 / 8,9 · 8,3 / 8,8 | 8,5 / 8,9 · 8,4 / 8,9 | +1 % · +1 % | +0 % · +1 % | 23,9 → 25,9 · 22,9 → 25,5 | pasa |
|  | **Encuadrar (F)** | 3,0 / 9,0 · 2,9 / 8,9 | 5,9 / 9,1 · 5,3 / 9,0 | **+100 % · +83 %** | +1 % · +1 % | 12,7 → 15,5 · 12,5 → 14,9 | **no pasa** (mediana) |
|  | Zoom con la rueda | 3,0 / 8,9 · 3,0 / 8,9 | 2,8 / 8,9 · 2,7 / 8,9 | −8 % · −10 % | −1 % · −0 % | 46,1 → 43,8 · 46,8 → 41,1 | pasa |
|  | Desplazar al 100 % | 0,3 / 0,5 · 0,3 / 0,5 | 0,2 / 0,4 · 0,2 / 0,4 | −17 % · −20 % | −11 % · −30 % | 7,1 → 6,7 · 6,7 → 5,2 | pasa |
|  | Arrastre al 31 % | 0,3 / 2,3 · 0,2 / 2,3 | 0,3 / 2,3 · 0,3 / 2,4 | +20 % · +50 % | −0 % · +4 % | 40,3 → 43,3 · 39,5 → 44,6 | **no pasa** por resolución del reloj (0,05 ms) |

La tabla redondea a 0,1 ms: en *Arrastre* con 500, las dos tandas son 0,25 → 0,30 ms.

Control, una tanda en la que HEAD corre en las escenas de 100, 500 y 2000 solo los 6 escenarios de 0.1.2, como el banco de 0.1.2, con la PC más ruidosa (0.1.2 entre 3,2 y 5,7 ms): *Encuadrar* con 2000 sigue arriba, 5,1 → 6,1 ms (+21 %).

### Escena con cables (solo HEAD, informativa)

0.1.2 no la tiene. Mediana de las 12 corridas de HEAD de la tabla oficial; máximo y lentos, de todas.

| Escenario | Mediana | p95 | Máx. | Lentos | Por gesto |
|---|---:|---:|---:|---:|---:|
| Rehacer al 100 % | 8,4 | 8,9 | 9,0 | 0 | 9,4 |
| Rehacer al 31 % | 8,4 | 8,8 | 9,1 | 0 | 24,2 |
| Encuadrar (F) | 7,8 | 9,0 | 14,6 | 0 | 25,1 |
| Zoom con la rueda | 2,7 | 8,7 | 9,6 | 0 | 39,6 |
| Desplazar al 100 % | 0,2 | 0,3 | 0,7 | 0 | 4,9 |
| Arrastre al 31 % | 0,2 | 2,5 | 6,5 | 0 | 40,0 |
| Seleccionar todo al 31 % | 1,6 | 2,1 | 3,2 | 0 | 11,0 |
| Arrastre con todo seleccionado al 31 % | 1,8 | 4,0 | 14,9 | 0 | 204,4 |
| Arrastrar 40 cableados al 58 % | 1,3 | 2,2 | 6,9 | 0 | 86,0 |
| Arrastrar 40 cableados contra los vecinos (se rechaza) al 58 % | 1,1 | 1,8 | 5,5 | 0 | 75,6 |
| Girar 40 cableados (se rechaza) al 58 % | 0,6 | 0,8 | 1,1 | 0 | 5,7 |
| Girar 1 cableado al 58 % | 1,3 | 1,7 | 2,5 | 0 | 13,1 |
| Girar todo al 31 % | 10,5 | 11,0 | 13,4 | 0 | 53,7 |
| Soltar con todo seleccionado al 31 % | 7,1 | 11,0 | 14,8 | 0 | 33,5 |
| Arrastrar todo seleccionado al 31 % | 3,0 | 6,1 | 7,5 | 0 | 65,0 |
| Borrar y deshacer uno con cables al 31 % | 0,7 | 0,9 | 1,7 | 0 | 7,0 |
| Cable en curso al 58 % | 0,3 | 0,4 | 3,2 | 0 | 17,2 |
| Reconectar un extremo libre al 58 % | 0,4 | 0,7 | 2,0 | 0 | 19,9 |
| Reconectar, rechazos después de rutear, al 58 % | 0,4 | 0,6 | 1,5 | 0 | 18,7 |
| Soltar reconectando al 58 % | 0,6 | 1,0 | 1,2 | 0 | 1,9 |

Heap con la escena armada (HEAD): 3,9 · 5,0 · 6,2 MB y 13,8 MB con cables.

### Por qué la mediana sube más que el trabajo

Cada gesto de *Encuadrar* tiene 3 cuadros:
1. El salto: ~0,8 ms. Es zoom diferido: escala lo que hay.
2. Mosaicos hasta agotar el presupuesto: ~8,5 ms.
3. Los mosaicos que faltan, hasta quedar nítido.

La mediana de esos 3 cuadros es el último. Cuanto más cuesta cada mosaico, menos entran en el cuadro 2, y el último cuadro hereda los que no entraron. Un gesto de cada versión (traza por cuadro, escena de 0.1.2):

| | Cuadro 1 | Cuadro 2 | Cuadro 3 |
|---|---:|---:|---:|
| 0.1.2 | 0,8 ms | 8,9 ms, 16 mosaicos | 3,1 ms, 19 mosaicos |
| `e137ea8` | 0,8 ms | 8,3 ms, 8 mosaicos | 5,8 ms, 27 mosaicos |

Por eso un 20 % más de trabajo de la capa estática por gesto se ve como +83 a +136 % en la mediana. El p95 y el máximo los ataja el presupuesto (+1 a +3 %), y por gesto sube +19 a +32 %. Ya en T2 la mediana subía +31 % con solo +5 % de trabajo.

### Curva por commit (2000 · Encuadrar, escena de 0.1.2)

Worktree en cada commit, con la elección de símbolos de `--escena-012` aplicada a mano (la escena de 2000 verificada por hash contra `v0.1.2`) y una mini tanda ABBA ×2 contra `v0.1.2`: 4 corridas por versión. **Estática por gesto:** suma del tiempo de la capa estática en los 3 cuadros del gesto, de una traza por cuadro (solo en los pasos que la tienen).

| Commit | Tarea | Mediana 0.1.2 → commit | Δ mediana | Estática por gesto (ms) | Δ estática | Mosaicos del cuadro 2 |
|---|---|---:|---:|---:|---:|---:|
| 27a9bb8 | T1 | 3,5 → 3,1 | −13 % | – | – | – |
| 9e2a248 | T2 | 3,0 → 3,8 | +31 % | 10,2 → 10,7 | +5 % | 15 → 13 |
| fe9a97e | T6 | 3,3 → 4,3 | +30 % | 10,4 → 11,0 | +6 % | 14 → 11 |
| d48cbb1 | T7 | 2,9 → 4,5 | +58 % | – | – | – |
| 17b75b9 | T9 | 3,0 → 3,8 | +26 % | – | – | – |
| 44af41f | T10 | 3,2 → 3,7 | +17 % | – | – | – |
| 274d724 | T12 | 3,0 → 4,9 | +68 % | 10,2 → 11,4 | +12 % | 15 → 9 |
| 6a2b7fc | T13 | 2,7 → 3,7 | +35 % | 10,0 → 10,7 | +7 % | 15 → 11 |
| 7dace06 | T14a (2/3) | 3,2 → 4,4 | +40 % | 10,2 → 11,1 | +10 % | 15 → 10 |
| 4aee262 | T14a, cerrada | 3,2 → 4,4 | +40 % | 10,1 → 11,2 | +11 % | 15 → 9 |
| **51dfa90** | **T14n** | 3,3 → 5,2 | +60 % | 10,2 → 12,0 | **+18 %** | 14 → 8,5 |
| 80abe07 | T14n, cerrada (solo docs) | 3,1 → 8,3 | +172 % | – | – | – |
| ff9a68c | T14b (2/3) | 3,0 → 5,1 | +72 % | – | – | – |
| 7fa3dd1 | T14b (3/3) | 2,8 → 5,6 | +105 % | 9,9 → 12,2 | +24 % | 16 → 8 |
| cc3cd70 | T14c etapa 3 | 3,2 → 5,6 | +77 % | 10,3 → 12,1 | +18 % | 14 → 9 |
| e137ea8 | T15 etapa 3 | 2,9 → 5,2 | +76 % | 10,0 → 12,0 | +20 % | 16 → 9 |

- El trabajo crece de a poco desde T2 (+5 %) hasta T14a (+10–11 %). El escalón más grande es **T14n** (+11 → +18 %); después queda en +18 a +24 %. El ruido de la estática es de ±5 puntos.
- Los pasos de T1 a T13 se midieron con Opera abierto; 7dace06, medido de nuevo sin Opera, dio lo mismo.
- 80abe07 solo cambia docs: tiene el mismo código que 51dfa90. En esa mini tanda, los gestos de HEAD se partieron en 4 cuadros (29–32 cuadros en vez de 24–25) y la mediana pasó a ser un cuadro de presupuesto. Es ruido, y muestra cuánto salta la mediana con un cuadro de más.

### T14n: medición sin la alineación de `simbolo()`

En 51dfa90 (escena de 0.1.2 y traza, como la curva), con solo `RendererCanvas.simbolo()` vuelto a como era antes de T14n: sin los dos `setTransform` por símbolo. Lo demás de T14n quedó igual. Sin commit. Dos tandas con las tres variantes intercaladas (A S C C S A ×2: 4 corridas por variante).

| Estática por gesto (ms) | Tanda 1 | Tanda 2 |
|---|---:|---:|
| 0.1.2 | 17,3 | 12,9 |
| 51dfa90 sin alinear `simbolo()` | 19,1 (+10 %) | 13,5 (+5 %) |
| 51dfa90 sin tocar | 20,7 (+20 %) | 14,3 (+11 %) |

- **Sí:** sin alinear `simbolo()`, la estática vuelve al nivel de 4aee262 (+11 % en la curva) o queda por debajo. En las dos tandas baja entre 5 y 8 % respecto de 51dfa90 sin tocar.
- **El número exacto no es firme.** La PC estaba más lenta que a la mañana (0.1.2 entre 12,9 y 17,3 ms por gesto, contra ~10) y con más dispersión (51dfa90 sin tocar: de 19,0 a 29,7 ms entre corridas de la tanda 1). La dirección se repitió en las dos tandas.

## Herramienta cable (fase 3, T13) — 2026-11-08

- **Escenario nuevo** en la escena de 2000 + 3000 cables: *Cable en curso al 58 %*. Con la herramienta W, el cable empieza en un borne del componente sin cables más cercano al centro, y el cursor recorre 3 filas de 20 puntos de grilla por encima, cruzando cables y bornes de los vecinos. Cada paso cambia el punto de grilla, así que en todos corren el ruteo y la validación (`prepararCable` con la consulta indexada). Se dibujan la previa, el objetivo y las marcas de los bornes visibles. Informa también lo que tarda el paso.
- El tramo va en la capa dinámica: no se rehace ningún mosaico mientras se dibuja (0 en *Mosaicos máx.*).

Misma PC, Edge 157, una corrida. Todos los escenarios, de las cuatro escenas, dieron 0 cuadros lentos.

| Escena | Escenario | Mediana | p95 | Máx. | Lentos | Por gesto | Mosaicos máx. |
|---|---|---:|---:|---:|---:|---:|---:|
| 2000 + 3000 cables | Rehacer al 100 % | 8,9 | 9,8 | 13,2 | 0 | 17,3 | 24 |
|  | Rehacer al 31 % | 8,6 | 9,5 | 10,2 | 0 | 41,8 | 13 |
|  | Encuadrar (F) | 8,2 | 10,3 | 10,4 | 0 | 31,0 | 27 |
|  | Zoom con la rueda | 4,3 | 9,4 | 9,9 | 0 | 63,5 | 12 |
|  | Desplazar al 100 % | 0,5 | 1,2 | 1,4 | 0 | 14,3 | 0 |
|  | Arrastre al 31 % | 0,6 | 2,7 | 8,0 | 0 | 84,3 | 12 |
|  | Seleccionar todo al 31 % | 4,2 | 7,9 | 8,3 | 0 | 38,2 | 0 |
|  | Arrastre con todo seleccionado al 31 % | 5,6 | 8,2 | 13,1 | 0 | 569,9 | 12 |
|  | Mover 40 sin cables al 58 % | 2,8 | 5,7 | 10,9 | 0 | 88,9 | 13 |
|  | Borrar y deshacer uno con cables al 31 % | 1,5 | 2,8 | 2,9 | 0 | 15,9 | 1 |
|  | **Cable en curso al 58 %** | 0,8 | 2,0 | 2,6 | 0 | 55,6 | 0 |

Paso del cable en curso (ruteo, validación y pista, fuera del cuadro): 0,1 ms de mediana y 0,4 ms de máximo. En otras dos corridas: 0,7–1,1 ms de mediana por cuadro, 2,0–2,6 ms de máximo y 0 lentos.

- **Criterio para la netbook** (próxima prerelease): F3 en la escena con cables (Ctrl+Shift+B), W y un cable en curso al 58 % pasando sobre cables y bornes. Casi 0 cuadros >16 ms.

## Cables (fase 3, T12) — 2026-11-08

- **Escena nueva:** los 2000 símbolos del banco con 3000 cables entre bornes de vecinos (0 a 3 codos), abierta en un `Editor` como en la app (Ctrl+Shift+B, después de la de 2000). Los 40 componentes más cercanos al centro quedan sin cables: es el grupo que se puede arrastrar mientras mover lo cableado está bloqueado (hasta T14a).
- **Escenarios nuevos** en esa escena: *Seleccionar todo al 31 %* (seleccionar los 5000 y el resumen del panel, alternando con nada), *Mover 40 sin cables al 58 %* (el caso del criterio de la netbook) y *Borrar y deshacer uno con cables al 31 %* (Supr y Ctrl+Z por el editor). Los dos que tienen paso informan también lo que tarda el paso, fuera del cuadro.
- Los cables van en un solo trazo por pasada, filtrados por tramo en cada mosaico.

Misma PC, Edge 157, una corrida. Todo lo demás dio 0 cuadros lentos, como en T9.

| Escena | Escenario | Mediana | p95 | Máx. | Lentos | Por gesto | Mosaicos máx. |
|---|---|---:|---:|---:|---:|---:|---:|
| 2000 | Rehacer al 31 % | 8,6 | 9,8 | 10,1 | 0 | 35,4 | 15 |
|  | Arrastre al 31 % | 0,4 | 2,5 | 8,8 | 0 | 63,4 | 12 |
|  | Arrastre con todo seleccionado al 31 % | 1,5 | 3,7 | 7,2 | 0 | 172,0 | 12 |
| 2000 + 3000 cables | Rehacer al 100 % | 8,5 | 9,4 | 9,6 | 0 | 14,6 | 25 |
|  | Rehacer al 31 % | 8,5 | 9,1 | 9,2 | 0 | 33,1 | 14 |
|  | Encuadrar (F) | 7,8 | 9,9 | 10,3 | 0 | 25,3 | 27 |
|  | Zoom con la rueda | 3,5 | 9,5 | 11,3 | 0 | 61,1 | 13 |
|  | Desplazar al 100 % | 0,2 | 0,4 | 0,6 | 0 | 6,3 | 0 |
|  | Arrastre al 31 % | 0,3 | 2,7 | 10,7 | 0 | 62,1 | 12 |
|  | Seleccionar todo al 31 % | 2,9 | 7,7 | 8,3 | 0 | 30,8 | 0 |
|  | Arrastre con todo seleccionado al 31 % | 5,2 | 8,7 | 12,1 | 0 | 542,5 | 12 |
|  | Mover 40 sin cables al 58 % | 2,7 | 6,2 | 12,3 | 0 | 92,3 | 13 |
|  | Borrar y deshacer uno con cables al 31 % | 1,6 | 2,5 | 2,9 | 0 | 16,3 | 1 |

Tiempo del paso (fuera del cuadro): seleccionar todo y el resumen, 0,8 ms de mediana y 2,8 ms de máximo; borrar o deshacer uno con cables, 0,8 y 2,2 ms. Heap con la escena armada: 9,2 MB (4,6 MB sin cables).

- Los cables no cambian rehacer, encuadrar, el zoom ni desplazar: lo mismo que la escena de 2000 sin cables.
- *Arrastre con todo seleccionado* pasa de 1,5 a 5,2 ms de mediana: es el resaltado de 3000 cables (sus tramos) en cada cuadro. Sin lentos.
- **Criterio para la netbook:** F3 en la escena con cables, desplazando y arrastrando los 40 del centro al 58 %: casi 0 cuadros >16 ms, como 0.1.2.

## Arrastrar 40 completos (diagnóstico, alpha.2) — 2026-11-08

Para reproducir los tirones de la netbook (40 arrastrados completos al 58–73 %):

- **Escenarios nuevos**: *Arrastrar 40 completos al 58 %* (los 40 más cercanos al centro, completos sin límite) y *Arrastrar 40 en contornos al 58 %* (referencia: la diferencia es lo que cuesta dibujarlos completos). El primero informa los aciertos y fallos del caché de textos de la capa dinámica, en el primer cuadro de cada gesto y en el resto.
- La capa dinámica puede copiar los textos del caché (`cacheTextosDinamica`). Quedó **prendido por defecto** después de medir en la netbook (40 completos con caché: 5–7 ms por cuadro, 0 lentos), con el tope de completos en 80. Desde ese cambio, *Mover todo* con 100 se dibuja en contornos (0,9 ms de mediana).

Dos corridas con `--comparar` en la PC (mediana por cuadro, ms), con el caché de la dinámica prendido a mano para comparar:

| Símbolos | Completos con caché | Completos sin caché | Contornos |
|---:|---:|---:|---:|
| 2000 | 1,9 · 2,2 | 1,8 · 2,4 | 0,8–1,2 |
| 500 | 1,9 · 1,7 | 2,2 · 2,3 | 0,7–1,4 |
| 100 | 1,9 · 2,6 | 2,3 · 2,9 | 0,7–1,1 |

- Dibujar los 40 completos cuesta 1–1,5 ms por cuadro; el caché de textos ahorra 0–0,4 ms de eso (dentro del ruido con 2000). En la PC los textos **no** son la causa principal.
- Caché: 260 aciertos y 0 fallos en el primer cuadro y 7487 aciertos y 0 fallos en el resto (unos 87 textos por cuadro).
- La PC no reproduce la netbook (2 ms contra 18–22 ms por cuadro): la medición que decide es la prueba automática del menú de desarrollo en la netbook.

## Mover arrastrando (fase 3, T9) — 2026-11-08

Cambios:

- Al arrastrar, los seleccionados salen de la capa estática (una invalidación por componente) y se dibujan corridos en la dinámica; al soltar vuelven (otra invalidación). Con más de 200 visibles, solo los contornos de los cuerpos.
- `EscenaEditable.actualizar` devuelve la caja vieja y la nueva por separado, no su unión.
- El presupuesto de mosaicos descuenta un estimado de la capa dinámica (`OBJETIVO_CUADRO_MS − composición − dinámica`).
- **Escenarios nuevos**: *Mover 1 al 31 %* (el componente del centro, 30 cuadros de una unidad, y se suelta) y *Mover todo al 31 %* (lo mismo con todo seleccionado). Una repetición va y la siguiente vuelve.

Misma PC, Edge 157, una corrida (los escenarios viejos dieron 0 cuadros lentos, como antes):

| Símbolos | Escenario | Mediana | p95 | Máx. | Lentos | Por gesto | Mosaicos máx. |
|---:|---|---:|---:|---:|---:|---:|---:|
| 100 | Mover 1 al 31 % | 0,5 | 2,0 | 4,7 | 0 | 22,2 | 4 |
|  | Mover todo al 31 % | 4,6 | 7,1 | 13,7 | 0 | 146,0 | 16 |
| 500 | Mover 1 al 31 % | 1,1 | 3,0 | 4,0 | 0 | 39,0 | 2 |
|  | Mover todo al 31 % | 3,8 | 8,7 | 11,7 | 0 | 137,8 | 30 |
| 2000 | Mover 1 al 31 % | 0,7 | 1,7 | 2,1 | 0 | 24,9 | 1 |
|  | Mover todo al 31 % | 3,7 | 10,4 | 11,0 | 0 | 140,1 | 40 |

Observaciones:

- Mover 1 en 2000: 1 mosaico por cambio y máximo 2,1 ms. Moverse no rehace mosaicos, solo la capa dinámica.
- *Mover todo* con 100: los 100 entran en pantalla y quedan por debajo del límite de 200, así que se dibujan completos (con `fillText`, la dinámica no usa el caché de textos): 4–5 ms por cuadro. Antes de descontar la dinámica del presupuesto, el cuadro en que se rehacían mosaicos llegaba a 17–19 ms (1 lento en 2 de 2 corridas); después, 9–14 ms.
- Con 500 y 2000 pasan el límite y se dibujan solo los contornos.
- **Pendiente:** confirmar en la netbook con F3; si 200 completos dan tirones allá, bajar `LIMITE_ARRASTRE_COMPLETO`.

## Escena editable con índice espacial (fase 3, T2) — 2026-11-07

Cambios:

- **Escena editable** (`escenaEditable.ts`): componentes que se agregan, se quitan y se mueven por id; cada cambio devuelve la caja afectada para `Capas.invalidarRegion` (T1). El banco la usa en todos los escenarios: mide lo que va a dibujar el editor.
- **Índice espacial** (`indiceEspacial.ts`): grilla de hash de celdas de 16 unidades para el recorte (y, más adelante, para elegir bajo el mouse). Si la consulta abarca más celdas que elementos, barre todo.
- **Escenarios nuevos**: *Editar al 100 %* y *Editar al 31 %*: el componente del centro se corre una unidad, ida y vuelta, 20 cuadros seguidos, invalidando solo su región. Columna nueva **Mosaicos máx.**: mosaicos rehechos en un solo cuadro.

Misma PC y navegador que antes. **0.1.2** = tag `v0.1.2` (con su propio banco, sin los escenarios nuevos); **T2** = este cambio. Corridas intercaladas, **mediana de 5**.

| Símbolos | Escenario | 0.1.2: cuadro | Lentos | Por gesto | T2: cuadro | Lentos | Por gesto | Δ por gesto | Mosaicos máx. |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | Rehacer al 100 % | 8,4 / 9,0 / 9,0 | 0 | 11,7 | 8,6 / 9,3 / 9,8 | 0 | 12,9 | +10 % | 32 |
|  | Rehacer al 31 % | 8,6 / 9,2 / 9,4 | 0 | 12,0 | 8,6 / 9,2 / 9,7 | 0 | 10,9 | −9 % | 40 |
|  | Encuadrar (F) | 6,3 / 8,4 / 8,4 | 0 | 9,6 | 4,2 / 9,3 / 9,3 | 0 | 9,7 | +1 % | 35 |
|  | Zoom con la rueda | 2,8 / 8,3 / 9,4 | 0 | 29,3 | 3,0 / 8,4 / 9,3 | 0 | 31,9 | +9 % | 40 |
|  | Desplazar al 100 % | 0,3 / 0,4 / 0,5 | 0 | 6,7 | 0,3 / 0,5 / 0,5 | 0 | 8,2 | +22 % | 0 |
|  | Arrastre al 31 % | 0,3 / 0,7 / 1,1 | 0 | 38,2 | 0,3 / 0,7 / 1,4 | 0 | 35,0 | −8 % | 7 |
|  | Editar al 100 % | – | – | – | 0,9 / 1,4 / 1,8 | 0 | 18,5 | nuevo | 4 |
|  | Editar al 31 % | – | – | – | 2,0 / 3,2 / 3,7 | 0 | 42,6 | nuevo | 4 |
| 500 | Rehacer al 100 % | 8,5 / 8,9 / 9,0 | 0 | 11,6 | 8,5 / 9,0 / 9,2 | 0 | 12,3 | +6 % | 32 |
|  | Rehacer al 31 % | 8,6 / 9,1 / 9,3 | 0 | 18,9 | 8,6 / 9,4 / 9,8 | 0 | 21,5 | +14 % | 20 |
|  | Encuadrar (F) | 5,3 / 6,8 / 6,8 | 0 | 7,2 | 5,5 / 9,7 / 9,7 | 0 | 9,0 | +25 % | 35 |
|  | Zoom con la rueda | 3,3 / 9,3 / 10,0 | 0 | 53,6 | 3,0 / 9,1 / 9,6 | 0 | 40,5 | −24 % | 23 |
|  | Desplazar al 100 % | 0,4 / 0,7 / 0,9 | 0 | 9,5 | 0,5 / 1,2 / 1,6 | 0 | 13,8 | +45 % | 0 |
|  | Arrastre al 31 % | 0,3 / 0,6 / 1,2 | 0 | 34,3 | 0,4 / 0,9 / 1,5 | 0 | 44,4 | +29 % | 7 |
|  | Editar al 100 % | – | – | – | 0,7 / 1,0 / 1,7 | 0 | 13,5 | nuevo | 1 |
|  | Editar al 31 % | – | – | – | 0,9 / 1,5 / 2,2 | 0 | 17,9 | nuevo | 1 |
| 2000 | Rehacer al 100 % | 8,5 / 8,9 / 8,9 | 0 | 12,5 | 8,5 / 9,2 / 9,3 | 0 | 15,7 | +26 % | 30 |
|  | Rehacer al 31 % | 8,5 / 9,0 / 9,2 | 0 | 32,3 | 8,4 / 9,3 / 9,7 | 0 | 30,3 | −6 % | 16 |
|  | Encuadrar (F) | 5,4 / 9,4 / 9,6 | 0 | 16,0 | 5,3 / 9,0 / 9,3 | 0 | 15,2 | −5 % | 28 |
|  | Zoom con la rueda | 3,5 / 9,2 / 10,1 | 0 | 56,2 | 3,4 / 9,1 / 9,7 | 0 | 49,6 | −12 % | 14 |
|  | Desplazar al 100 % | 0,3 / 0,6 / 1,1 | 0 | 7,5 | 0,2 / 0,6 / 0,7 | 0 | 7,2 | −4 % | 0 |
|  | Arrastre al 31 % | 0,3 / 2,4 / 4,8 | 0 | 44,6 | 0,3 / 2,8 / 6,0 | 0 | 55,5 | +25 % | 8 |
|  | Editar al 100 % | – | – | – | 0,4 / 0,7 / 1,3 | 0 | 8,5 | nuevo | 1 |
|  | Editar al 31 % | – | – | – | 0,7 / 1,5 / 2,2 | 0 | 18,6 | nuevo | 1 |

Memoria: heap JS con la escena armada 1,6 · 2,4 · 2,8 MB (antes 1,5 · 2,1 · 2,3). Caché, máximo 13,5 MB (igual).

Observaciones:

- **Editar**: como mucho 4 mosaicos por cambio (con 100 símbolos los componentes del centro caen en una esquina de mosaicos; con 500 y 2000, 1), cuadro máximo 3,7 ms, ningún cuadro lento. Mover un símbolo cuesta 0,4–2 ms por cuadro, contra 8–9 ms de rehacer la vista.
- **Ningún cuadro lento** en ningún escenario; mediana y p95 por cuadro iguales a 0.1.2 (±0,5 ms).
- **Por gesto**, las diferencias van de −24 % a +45 % en las dos direcciones, y dentro de una misma celda las 5 corridas varían hasta 3 veces (arrastre con 2000: 0.1.2 42–80 ms, T2 39–146 ms). *Desplazar al 100 %* con 500 da +45 % y no dibuja ningún mosaico: lo único que cambió en ese camino es contar los visibles, que ahora es más rápido. Con este ruido, el banco no puede confirmar ni descartar un 10 %. Microbanco en Node: el recorte por índice tarda 0,3–1 µs por mosaico contra 5–8 µs barriendo, y contar la pantalla 5 µs en los dos.
- Primer intento: contar la pantalla en cada cuadro armaba y **ordenaba** la lista de visibles (cientos al 31 %). Se cambió por un conteo sin lista; el arrastre con 2000 había dado el doble en 3 de 3 corridas.
- **Pendiente:** confirmar en la netbook con F3 (Ctrl+Shift+B), donde el ruido es menor que el efecto que se busca.

## Mosaicos, zoom diferido y caché de textos — 2026-11-07

Motivo: medición en la netbook (WebKitGTK, versión compilada, escena de 2000):

- Desplazar: 46–53 FPS, 0,2 ms por cuadro. Bien.
- Zoom: la capa estática se rehacía en cada paso: 45–100 ms por cuadro.
- Capa estática al 31 % con textos: 99 ms; al 27 % sin textos ni bornes: 7 ms. Los textos son casi todo el costo.
- Al salir del margen del caché al desplazar: tirones de 72–79 ms.

Cambios:

- **Mosaicos** (`mosaicos.ts`): la capa estática se parte en mosaicos de 256×256 px, más un margen de 128 px alrededor de la pantalla que se dibuja de antemano. Se rehacen de a poco, los visibles primero, con un **presupuesto de 8 ms por cuadro** (menos si componer la pantalla ya tarda: el cuadro entero apunta a 14 ms). Mientras falta un mosaico se ve el del nivel de zoom anterior escalado o, si no hay, el fondo con la grilla.
- **Zoom diferido**: durante el zoom no se rehace nada, se escalan los mosaicos que hay (sin suavizado al agrandar, con suavizado al achicar). Se rehacen nítidos 150 ms después del último paso.
- **Caché de textos** (`textos.ts`): cada texto se dibuja una vez por tamaño en un atlas de páginas de 512×512 px y después se copia con `drawImage`. Se vacía al cambiar de nivel de zoom o si se llena (8 MB como máximo); no se vacía al invalidar la capa estática.
- **Rasterizado forzado por mosaico**: Chromium sin GPU solo anota las órdenes y las ejecuta al copiar el canvas, así que el presupuesto medía solo el anotado y el dibujo real caía todo junto en un cuadro (hasta 25 ms). Copiar un píxel del mosaico a un canvas de 1×1 obliga a dibujarlo en el momento.
- **F3**: nueva fila con los cuadros de más de 16 ms en los últimos 5 s.

Misma PC y navegador que la línea base. **Antes** = commit «Atajo Ctrl+Shift+B…» (4d9e3ba) medido con este mismo banco; **después** = este cambio. Las corridas se intercalaron (antes, después, antes…) porque la PC varía ±30–50 % entre corridas; cada celda es la **mediana de 3 corridas**.

Tiempo por cuadro en ms (mediana / p95 / máximo), cuadros de más de 16 ms y ms por gesto:

| Símbolos | Escenario | Antes: cuadro | Lentos | Por gesto | Después: cuadro | Lentos | Por gesto |
|---:|---|---:|---:|---:|---:|---:|---:|
| 100 | Rehacer al 100 % | 7,8 / 10,3 / 10,3 | 0 | 7,7 | 9,2 / 11,1 / 11,6 | 0 | 24,0 |
|  | Rehacer al 31 % | 6,3 / 9,3 / 9,3 | 0 | 6,6 | 9,4 / 10,5 / 11,0 | 0 | 26,4 |
|  | Encuadrar (F) | 7,6 / 10,2 / 10,2 | 0 | 7,2 | 7,0 / 10,8 / 11,2 | 0 | 23,2 |
|  | Zoom con la rueda | 8,4 / 12,4 / 17,3 | 1 ⚠ | 69,9 | 7,3 / 10,4 / 11,7 | 0 | 75,7 |
|  | Desplazar al 100 % | 0,9 / 1,9 / 2,3 | 0 | 26,1 | 1,2 / 2,7 / 2,9 | 0 | 35,4 |
|  | Arrastre al 31 % | 1,2 / 2,9 / 10,4 | 0 | 144,7 | 1,1 / 2,6 / 3,7 | 0 | 125,9 |
| 500 | Rehacer al 100 % | 9,8 / 13,5 / 13,5 | 0 | 9,9 | 9,6 / 10,8 / 11,9 | 0 | 43,0 |
|  | Rehacer al 31 % | 26,7 / 35,4 / 35,4 | 12 ⚠ | 25,5 | 8,9 / 10,5 / 12,1 | 0 | 50,6 |
|  | Encuadrar (F) | 9,4 / 10,6 / 10,6 | 0 | 8,8 | 6,5 / 10,2 / 10,6 | 0 | 19,2 |
|  | Zoom con la rueda | 20,8 / 31,4 / 34,2 | 39 ⚠ | 165,6 | 6,9 / 10,6 / 11,7 | 0 | 99,3 |
|  | Desplazar al 100 % | 1,0 / 1,7 / 2,0 | 0 | 26,3 | 1,3 / 2,5 / 2,7 | 0 | 36,1 |
|  | Arrastre al 31 % | 0,7 / 2,1 / 22,9 | 4 ⚠ | 136,3 | 0,9 / 2,2 / 3,2 | 0 | 107,8 |
| 2000 | Rehacer al 100 % | 11,1 / 12,8 / 12,8 | 0 | 10,8 | 9,1 / 10,3 / 11,7 | 0 | 37,9 |
|  | Rehacer al 31 % | 33,5 / 59,0 / 59,0 | 12 ⚠ | 36,1 | 8,8 / 10,5 / 13,8 | 0 | 67,9 |
|  | Encuadrar (F) | 20,0 / 22,8 / 22,8 | 8 ⚠ | 20,0 | 9,2 / 11,6 / 13,0 | 0 | 40,1 |
|  | Zoom con la rueda | 27,9 / 49,9 / 57,3 | 43 ⚠ | 227,6 | 8,0 / 11,1 / 12,9 | 0 | 127,3 |
|  | Desplazar al 100 % | 1,1 / 1,9 / 2,1 | 0 | 29,7 | 0,9 / 1,9 / 4,1 | 0 | 25,8 |
|  | Arrastre al 31 % | 1,1 / 2,2 / 58,4 | 8 ⚠ | 276,1 | 0,8 / 6,0 / 9,7 | 0 | 128,5 |

Cuadros por gesto, después: rehacer, 3–8 (2000 al 31 %: 8, unos 130 ms hasta quedar nítido); encuadrar, 3–5; zoom con la rueda, los 8 pasos, la espera de 150 ms y 2–8 cuadros de mosaicos.

Caché de textos (después, con `--comparar`), ms por gesto con / sin caché, con 2000: rehacer al 31 %, 67,9 / 84,3; rehacer al 100 %, 37,9 / 45,6; arrastre al 31 %, 128,5 / 145,4. Sin caché de textos aparecen cuadros de 16,1–16,3 ms.

Memoria:

- Heap JS con la escena armada: 1,5 MB (100) · 2,0 MB (500) · 2,3 MB (2000). Antes: 1,4 · 1,6 · 1,9 MB.
- Caché (mosaicos y textos), máximo durante el banco: 13,5 MB. Antes: 9,0 MB fijos. En uso normal son los mosaicos de pantalla y margen (unos 10 MB a 1366×768, unos 7 MB a 1024×600) más 1–2 MB de textos; durante un cambio de zoom conviven dos niveles, hasta un 25 % por encima.

Observaciones:

- **Ningún cuadro pasa de 16 ms** en ningún escenario (máximo 13,8 ms). Antes había hasta 43 cuadros lentos por escenario y picos de 57–59 ms al hacer zoom, rehacer al 31 % y arrastrar.
- El zoom con la rueda bajó de 27,9 / 57,3 ms (mediana / máximo) a 8,0 / 12,9 ms con 2000, y su trabajo total casi a la mitad: ya no rehace la capa en cada paso.
- El arrastre largo ya no tiene tirones (máximo 9,7 ms contra 58,4 ms) y hace la mitad del trabajo: solo se dibujan los mosaicos que aparecen.
- **Costo:** rehacer toda la vista hace 2–4 veces más trabajo en total que antes, repartido en 3–8 cuadros. Cada mosaico tiene un costo fijo (fondo, grilla, rasterizado; unos 0,2 ms acá) y lo que cruza el borde entre dos mosaicos se dibuja en los dos. Es el precio de que ningún cuadro se trabe: la imagen tarda un poco más en quedar nítida (unos 130 ms en el peor caso de esta PC).
- Chromium dibuja texto mucho más rápido que WebKitGTK: acá el caché de textos ahorra un 15–20 %; en la netbook, donde los textos eran 92 de los 99 ms, debería pesar bastante más.
- **Pendiente: medir en la netbook** con F3 (fila «> 16 ms (5 s)») y Ctrl+Shift+B. Este banco corre en Chromium, no en WebKitGTK.

## Línea base — 2026-11-07 (banco anterior)

Medida con el banco anterior, de escenarios y columnas distintos a los de arriba; queda como historia. Entonces cada caso eran 3 cuadros de calentamiento y 25 medidos (mediana y p95). *Vista al 100 %*, *Acercado al 400 %* y *Encuadrado (F)* rehacían la capa estática entera en cada cuadro; *Desplazar al 100 %* movía la vista de a 6 px sin salir del margen del caché. **Optimizado:** caché de la capa estática, recorte por vista y nivel de detalle; **sin optimizar:** las tres apagadas. ⚠ = p95 sobre 16,7 ms.

Commit: «Capas, recorte y banco de pruebas».

- **PC:** notebook con AMD Ryzen 7 170 (gráficos Radeon integrados + NVIDIA GeForce RTX 5050 Laptop, sin usar: rasterizado por software), 15,2 GB de RAM, Windows 11 Home.
- **Navegador:** Microsoft Edge 157.0.4341.42 headless (Chromium 157).
- En esta máquina los tiempos varían ±30 % entre corridas, así que cada celda es la **mediana de 3 corridas** de `npm run bench`.

Tiempo por cuadro en ms (mediana / p95):

| Símbolos | Escenario | Dibujados | Optimizado | Sin optimizar | Mejora |
|---:|---|---:|---:|---:|---:|
| 100 | Vista al 100 % | 64 / 100 | 4,9 / 6,3 | 2,2 / 3,4 | 0,4× |
|  | Acercado al 400 % | 6 / 100 | 2,1 / 3,4 | 1,6 / 2,6 | 0,8× |
|  | Encuadrado (F) | 100 / 100 | 5,1 / 8,9 | 2,6 / 3,7 | 0,5× |
|  | Desplazar al 100 % | 64 / 100 | 0,5 / 0,7 | 2,6 / 3,8 | 5,2× |
| 500 | Vista al 100 % | 84 / 500 | 5,2 / 7,0 | 6,0 / 8,3 | 1,2× |
|  | Acercado al 400 % | 6 / 500 | 2,3 / 3,4 | 5,1 / 7,3 | 2,2× |
|  | Encuadrado (F) | 500 / 500 | 3,6 / 4,8 | 11,3 / 20,9 ⚠ | 3,1× |
|  | Desplazar al 100 % | 84 / 500 | 0,2 / 0,4 | 8,1 / 13,2 | 40,5× |
| 2000 | Vista al 100 % | 83 / 2000 | 5,8 / 8,6 | 18,8 / 27,0 ⚠ | 3,2× |
|  | Acercado al 400 % | 4 / 2000 | 1,8 / 2,7 | 16,9 / 26,5 ⚠ | 9,4× |
|  | Encuadrado (F) | 2000 / 2000 | 7,1 / 10,2 | 32,9 / 42,1 ⚠ | 4,6× |
|  | Desplazar al 100 % | 83 / 2000 | 0,2 / 0,3 | 17,4 / 24,8 ⚠ | 87,0× |

Memoria:

- Heap JS con la escena armada: 1,3 MB (100) · 1,6 MB (500) · 1,8 MB (2000).
- Caché de la capa estática: 9,0 MB (la pantalla más un 25 % de margen hacia cada lado).

Observaciones:

- Desplazar la vista solo copia el caché: menos de 1 ms con cualquier escena.
- Con escenas chicas, rehacer la capa estática cuesta unos 2–3 ms más que sin optimizar, porque el caché abarca 2,25 veces el área de la pantalla. Sigue muy por debajo de 16,7 ms, y se paga solo al hacer zoom o cambiar el contenido.
- Todo el banco tarda unos 8 s en esta PC.
- Pendiente: medir en la netbook. Allí la app corre en WebKitGTK (Linux), no en Chromium, así que este banco sirve sobre todo para comparar fases entre sí.
