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
