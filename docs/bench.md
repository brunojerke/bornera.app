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
- `npm run bench -- --escena-012` arma las escenas de 100, 500 y 2000 con los 5 símbolos de 0.1.2 (ver T15 en `docs/archivo/bench-historial.md`). Las comparaciones contra 0.1.2 usan esta opción.

## Validaciones en vivo (fase 3b, T19 etapa 3b) — 2026-11-16

**Resultado: pasa** contra `926915d` (sin validaciones), medido en la misma sesión con los criterios de `docs/archivo/plan-T19.md`, sección 5, fijados antes de medir.
- **R6 dentro del paso** (*Dibujar 1 cable con 2000 y un par NC+bobina*): p95 0,0 y 0,1 ms, máximo 0,1 ms, en 180 pasadas por tanda. Tope: p95 3 ms y ninguna de más de 8 ms. En la etapa 3a, con `redes()` sobre la hoja entera, había dado p95 3,20 ms y frenado la tarea.
- ***Pegar 500*, *Duplicar todo* y *Rehacer al 31 % con avisos*: pasan.** *Duplicar todo* pasa sin usar la tolerancia de 2 ms (abajo).
- ***Etiquetar los vacíos*** sube más de 10 % en las dos tandas, pero queda muy debajo de su tope de lote de T17 (40/80 ms): pasa por el ajuste (a) de Bruno.
- **Celdas comunes:** 2 de 71 suben de p95 en las dos tandas. Hubo 2 lentos de HEAD, los dos en la misma corrida. El diagnóstico, con sus reglas fijadas antes de medir, dio **las cuatro filas como ruido** (abajo).
- **Para la netbook**, al cierre de la fase 3b (`docs/plan-fase3b.md`): los cuadros que siguen a *Pegar 500* y a *Duplicar todo* (abajo) y *Dibujar 1 cable*.

**Cómo se midió:**
- **Versiones:**
  - HEAD es la etapa 3b sobre `c676f69` (`5f4e1d1` más un cambio solo en el README), sin commit al medir. Después, commit `edd2c03`.
  - La base es `926915d`, en un worktree con su propio `npm ci` y el `tests/bench/pagina.ts` de HEAD copiado sin commit. El `pagina.ts` era idéntico en los dos árboles (mismo sha256).
- **Corridas:** ABBA ×3 en dos tandas, 6 corridas por versión en cada tanda; por celda, la mediana de las 6. Fue de 12:11:02 a 12:19:05 (hora de Argentina), unos 20 s por corrida.
- **Condiciones**, anotadas por el script antes de cada una de las 24 corridas:
  - Edge 157 headless.
  - PC enchufada y cargando (del 69 al 76 %), modo "Mejor rendimiento".
  - Con ventana, solo Claude y Configuración (más el NVIDIA Overlay y la entrada de texto de Windows). Abiertos sin ventana: SpotifyLauncher, OneDrive Sync y el servicio sandbox de Codex.
- **Un ABBA anterior se descartó:** el del 2026-11-15 se cortó en 15 de 24 corridas, al terminar la sesión, y se descartó sin analizarlo.
- La primera medición de T19 (etapa 3a, frenada) y el desglose en Node de cada arreglo de la 3b están en `docs/archivo/plan-T19.md`, etapas 3a y 3b.

### Escenarios con criterio propio (escena con cables, al 31 %)

T1 / T2: mediana de las 6 corridas de cada tanda, en ms.

| Escenario | Medida | Base | HEAD | Criterio | Resultado |
|---|---|---:|---:|---|---|
| Dibujar 1 cable con 2000 y un par NC+bobina | R6: p95 / máx. | – | 0,0 / 0,1 · 0,1 / 0,1 | p95 ≤ 3, máx. ≤ 8; 0 lentos | pasa |
| ″ | paso / deshacer | 0,30 / 0,10 | 0,30 / 0,10 | se informa | – |
| Rehacer al 31 % con avisos | por gesto | 22,71 / 22,03 | 22,74 / 22,47 | ≤ base × 1,15: 26,11 / 25,33; 0 lentos | pasa |
| Pegar 500 | paso | 5,00 / 4,90 | 5,75 / 5,60 | ≤ base + max(10 %, 1 ms): 6,00 / 5,90 | pasa |
| ″ | deshacer | 1,20 / 1,20 | 1,70 / 1,70 | se informa (máx. 3,2) | – |
| Duplicar todo (2000) | paso | 48,55 / 47,50 | 49,05 / 50,45 | ≤ base × 1,10: 53,40 / 52,25; máx. ≤ 300 (91,2) | pasa |
| ″ | deshacer | 8,45 / 8,35 | 10,20 / 9,70 | ≤ 40, máx. ≤ 80 (17,3) | pasa |
| Etiquetar los vacíos (2000) | paso | 3,00 / 2,80 | 4,55 / 4,40 | > 10 %, pero debajo del tope de lote 40/80 (máx. 7,1) | pasa (ajuste (a)) |
| ″ | deshacer | 1,65 / 1,60 | 2,70 / 2,70 | ídem (máx. 5,6) | pasa (ajuste (a)) |

- **Dibujar 1 cable:** el NC del par se coloca fuera de lo medido y queda sin cablear. Por eso hay 0 avisos R6. Cada cable y cada deshacer recorren solo las redes que tocan: el borne del NC, el cable y el otro borne del NC. Avisos en la escena: R2 277, R7 529 y R8 30.
- **Tolerancia de *Duplicar todo*** (Bruno, anotada antes de abrir el análisis): si era lo único que no pasaba y quedaba a menos de 2 ms sobre su tope, se aceptaba. No hizo falta.
- **Los pasos que en la etapa 3a subían más de 10 % en las dos tandas** ya no suben así en las dos:
  - *Girar todo*: de 21,15 a 23,50 y de 22,25 a 22,30 ms.
  - *Soltar con todo seleccionado*: de 16,85 a 14,25 y de 14,90 a 16,65 ms.
  - *Borrar y deshacer uno con cables*: de 0,70 a 0,80 y de 0,70 a 0,75 ms.
  - Queda *Etiquetar los vacíos* (arriba).

### Cuadros después de Pegar 500 y Duplicar todo: a la netbook

En esos dos escenarios, los cuadros que siguen al paso cuestan más en HEAD:

| Escenario | Cuadro: mediana / p95, base | HEAD | Por gesto, base | HEAD | Lentos |
|---|---:|---:|---:|---:|---|
| Pegar 500 | 0,70 / 0,95 · 0,65 / 0,90 | 6,45 / 7,30 · 6,40 / 7,05 | 6,68 / 6,33 | 64,87 / 64,57 | 0 y 0 |
| Duplicar todo (2000) | 1,50 / 1,65 · 1,50 / 1,80 | 8,70 / 9,90 · 8,65 / 9,65 | 4,95 / 4,90 | 44,55 / 44,23 | 0 y 0 |

- **Por qué:** es «sin restos» de la etapa 2. Al pegar o duplicar, los titulares nuevos ocupan números que tenían contactos sin bobina (R2). Esos contactos pierden el contorno sin que el comando los nombre, y el editor repinta su caja: 77 al pegar 500 y 277 al duplicar todo.
- **No viene de la 3b:** se comprobó en Node que `5f4e1d1` y la 3b repintan los mismos componentes y las mismas 2278 y 11 692 regiones.
- **Antes no estaba a la vista:** la etapa 3a juzgaba esos escenarios solo por el paso.
- **Criterio en la netbook** (Bruno, 2026-11-16): pasa si hay como máximo 1 cuadro lento después del gesto y ninguno de más de 100 ms.

### Celdas comunes y lentos: diagnóstico, ruido

- **En las dos tandas** (mediana / p95 por cuadro en ms, mediana de las 6 corridas):
  - *2000 · Editar al 31 %*: p95 de 0,85 a 0,95 y de 0,85 a 1,10.
  - *2000 con cables · Desplazar al 100 %*: p95 de 0,30 a 0,35 en las dos.
- **Lentos de HEAD, en la misma corrida** (la 11.ª de T1, que tuvo también *Desplazar* alto):
  - *Arrastrar 40 cableados al 58 %*: un cuadro de 39,1 ms.
  - *Girar todo al 31 %*: un cuadro de 16,4 ms.
  - La base no tuvo ninguno.
- **Por qué podía ser ruido:** la 3b no toca el dibujo, y arrastrar y desplazar no ejecutan comandos.
- **Diagnóstico** (opción 1 de Bruno): ABBA ×5 contra la misma base, con 10 veces más repeticiones en esas cuatro filas. Son 10 pares; en cada bloque ABBA, (1.ª A, 1.ª B) y (2.ª B, 2.ª A).
  - **Reglas, fijadas antes de medir (12:57):**
    - una celda de p95 es real si HEAD supera a la base en más de 0,05 ms de mediana o en más de 10 % de p95 en al menos 7 de los 10 pares;
    - un lento es real si HEAD tiene lentos en 2 o más de sus 10 corridas y la base en ninguna.
  - **Corrida:** de 12:59:07 a 13:02:29, 20 corridas de unos 10 s, enchufada (79 %), con las mismas ventanas. La opción `--diag-t19b` fue un parche temporal en los dos árboles y no quedó en el repo.

| Fila | Base | HEAD | Resultado del diagnóstico | Veredicto |
|---|---:|---:|---|---|
| 2000 · Editar al 31 % (mediana / p95) | 0,70 / 1,10 | 0,70 / 1,10 | HEAD arriba en 2 de 10 pares | ruido |
| 2000 con cables · Desplazar al 100 % | 0,20 / 0,40 | 0,20 / 0,40 | 2 de 10 | ruido |
| Arrastrar 40 cableados al 58 % (1800 cuadros por corrida) | 0 corridas con lentos | 0 | máx. 10,1 / 9,8 ms | ruido |
| Girar todo al 31 % (114 cuadros por corrida) | 2 de 10 corridas con lentos | 1 de 10 | máx. 19,3 / 17,9 ms; la base también los tiene | ruido |

### Encuadrar (F) con 500

Corridas con un cuadro de 8,5 ms o más: base 1 de 6 en T1 (máx. 8,90) y 1 de 6 en T2 (máx. 10,30); HEAD 0 de 6 en las dos (máx. 8,00 y 6,90). Como en la etapa 3a, aparece también en la base. Costo aceptado (cambio 9); sigue en la lista de la netbook.


---
Mediciones anteriores (T18, T17, T16, fase 3 y banco anterior del 2026-11-07): `docs/archivo/bench-historial.md`.
