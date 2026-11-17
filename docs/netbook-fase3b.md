# Netbook con Windows — cierre de la fase 3b

Para imprimir. Plan: `docs/plan-cierre-3b.md`. Cada criterio lleva su **tope de netbook**, no el de la PC: la columna «PC» es solo referencia.

**Origen de los topes:**
- **Bruno:** fijado por Bruno para la netbook.
- **T15:** el criterio «sin trabas» de `docs/archivo/plan-T15.md`, sección 5.
- **0.1.2:** la meta de 0.1.2, ningún cuadro de más de 50 ms y menos de 1 % de más de 16,7 ms.
- **×2,5:** el tope absoluto de la PC por el factor de la netbook de T16 (`docs/archivo/plan-T16.md`, sección 4).
- **Confirmado:** sale de ×2,5 sobre un tope que no fijó otra tarea; Bruno lo confirmó el 2026-11-16 (cierre 3b, etapa 1).

Versión: `0.1.4-alpha.1` · Fecha: ________ · Hora de inicio: ________

## 0. Antes de empezar
- [ ] Netbook enchufada, modo de energía «Mejor rendimiento», sin otras apps abiertas.
- [ ] Instalar `0.1.4-alpha.1` encima de la 0.1.3, sin desinstalar.
- [ ] En Configuración › Aplicaciones hay una sola «Bornera». Versión que muestra la app: ________
- [ ] Ventana maximizada, barra de tareas como siempre, F3 a la vista.
- [ ] En el pendrive: `marcha-parada.brn` (de `tests/circuitos/`), esta hoja y la hoja 2.

## A. Inversión de giro a mano (criterio de pasaje)
Seguir la hoja 2. Cronometrar desde Abrir.

| # | Qué mirar | Tope netbook | Origen | ✓ / medido |
|---|---|---|---|---|
| A1 | Se termina sin consola, sin editar el archivo y sin reiniciar la app | completa | T15 | ☐ |
| A2 | W: cada cable sale en un gesto. Un rechazo es traba solo si el mensaje no explica por qué o no queda otra forma razonable | ninguna traba | T15 | ☐ |
| A3 | Paleta, panel, barra y diálogos (Guardar, Abrir, «¿Guardar los cambios?») se ven enteros | todo a la vista | T15 | ☐ |
| A4 | F3 al soltar cada cable y después de Ctrl+D, leído antes de 1 s | máx. del último segundo < 50 ms; lentos (> 16 ms) en 5 s: 0 o 1 | T15 | peor: ____ ms / ____ lentos |
| A5 | Después de Ctrl+D, la copia tiene S2, K2 (NA), K2 (bobina) y H2, y su NC dice «K2». La barra cuenta 5 avisos: el NC de la copia (R6) y sus 4 bornes sueltos (S2·13, K2·13, K2·A2 y H2·X2) | exacto | T17/T19 | ☐ |
| A6 | Al terminar, la barra dice «Sin avisos» | 0 avisos | Bruno | ☐ |
| A7 | Hay una sola bobina K1 y una sola bobina K2 | sin repetidas | Bruno | ☐ |
| A8 | Bajo K1, 2 filas: NA 13-14 (rama de K1) y NC 21-22 (rama de K2). Bajo K2, 2 filas: NA 13-14 (rama de K2) y NC 21-22 (rama de K1) | exacto | Bruno | ☐ |
| A9 | Con el mouse en el centro de cada uno de los 4 contactos, la barra muestra las coordenadas de su fila | iguales | Bruno | ☐ |
| A10 | Ninguna lista toca un símbolo, una etiqueta, un nombre de borne ni un cable, de ninguna rama | nada tapado | Bruno | ☐ |
| A11 | F: el circuito entero entra con los textos legibles | entra | T15 | ☐ |
| A12 | Ctrl+Mayús+S (Guardar como) `inversion.brn` (Ctrl+S pisaría `marcha-parada.brn`), cerrar con la X, abrir la app y Abrir el archivo | mismo dibujo, título sin «•», Deshacer desactivado | T15 | ☐ |
| A13 | Guardar y abrir | ≤ 1 s | D20 | ☐ |

Se anota, no es criterio: tiempo total ______ min · ¿Desplazaste o alejaste el zoom? ______ · Trabas o sorpresas: ____________________________

## B. «Probar la fase 3b» (menú de desarrollo)
El botón en la app instalada (la app de escritorio no se prueba en la PC: el humo corre en el navegador):

| # | Qué mirar | Tope netbook | Origen | ✓ |
|---|---|---|---|---|
| P1 | Menú de desarrollo (la llave) › «Cierre de fase» › «Probar la fase 3b…». Con la hoja sin cambios corre sin preguntar; arriba se lee qué mide; al final, el diálogo «Probar la fase 3b» con la tabla B1 a B16 y «Copiar» | anda | cierre 3b, etapa 4 | ☐ |
| P2 | Con un cambio sin guardar, antes pregunta («Probar igual» / «Cancelar») y Cancelar no corre nada. Después de «Probar igual», la hoja queda igual: mismo dibujo, título con «•», Deshacer como estaba | anda | cierre 3b, etapa 4 | ☐ |

- Menú de desarrollo › «Probar la fase 3b», 3 corridas seguidas.
- Después de cada una, «Copiar» y pegar la tabla en un `.txt` en el pendrive. La tabla trae, por fila, escenario, medida y tope de esta hoja, lo medido en la netbook y «pasa», «no pasa» o «se anota».
- Por fila cuenta la mediana de las 3 corridas; los lentos se suman en las 3.

| # | Escenario | Medida | Tope netbook | Origen | PC | Netbook |
|---|---|---|---|---|---:|---|
| B1 | Duplicar todo (2000) | paso: mediana / máx. | ≤ 375 / ≤ 750 ms | ×2,5 (T16: 150/300) | 49 / 91 | |
| B2 | ″ | deshacer: mediana / máx. | ≤ 100 / ≤ 200 ms | ×2,5 (T17: 40/80) | 10 / 17 | |
| B3 | ″ | cuadros después del gesto | ≤ 1 lento por gesto y ninguno > 100 ms | Bruno | 0 lentos | |
| B4 | Pegar 500 | paso: mediana / máx. | ≤ 100 / ≤ 200 ms | ×2,5 (T16: 40/80) | 5,8 / 8,8 | |
| B5 | ″ | deshacer: mediana / máx. | ≤ 100 / ≤ 200 ms | ×2,5 (T16: 40/80) | 1,7 / 3,6 | |
| B6 | ″ | cuadros después del gesto | ≤ 1 lento por gesto y ninguno > 100 ms | Bruno | 0 lentos | |
| B7 | Previa de pegar 160 | revisión por punto: p95 | ≤ 12,5 ms | confirmado (×2,5 de 5 ms) | 0,9 | |
| B8 | Previa de pegar, 40 a 500 | cuadros | ninguno > 50 ms y < 1 % > 16,7 ms | 0.1.2 | 0 lentos | |
| B9 | Previa de pegar, la serie | mayor N con revisión p95 ≤ 12,5 ms | se anota. Si da menos de 160, se baja `TOPE_PREVIA_PEGAR`; si da 320 o más, se puede subir (con Bruno) | T16 | 500 | N = ____ |
| B10 | Rehacer al 31 % con referencias | por gesto | ≤ 62,5 ms | confirmado (×2,5 de 25 ms) | 22,6 | |
| B11 | ″ | cuadros | ninguno > 50 ms y < 1 % > 16,7 ms | 0.1.2 | 0 lentos | |
| B12 | Mover 1 contacto con referencias al 31 % | paso: mediana | ≤ 4,5 ms | confirmado (×2,5 de 1,8 ms) | 1,1 | |
| B13 | Dibujar 1 cable con 2000 y un par NC+bobina al 31 % | R6: p95 / máx. | ≤ 7,5 / ≤ 20 ms | confirmado (×2,5 de 3/8 ms) | 0,1 / 0,1 | |
| B14 | ″ | cuadros | ninguno > 50 ms y < 1 % > 16,7 ms | 0.1.2 | 0 lentos | |
| B15 | Encuadrar (F) con 500 | cuadros | 0 lentos (> 16 ms) | Bruno (T19, cambio 9) | 0 lentos | |
| B16 | Borrar y deshacer uno con cables al 31 % (escena con cables) | cuadros; por gesto | 0 lentos; por gesto se informa | Bruno (cierre 3b, etapa 3: contornos de aviso, tope PC 11,10 ms) | 0 lentos; 8,25 | |

## C. Línea base de Windows (informativo, sin tope)
Para comparar con la alpha.11 (nota «Medición 0.1.3-alpha.11 - netbook Windows»). No es criterio de pasaje.
- [ ] Menú de desarrollo › «Probar arrastre»: copiar la tabla. En la alpha.11: dibujo 1,3 / 5,7 ms (promedio / máximo), 0 lentos, soltar con todo 82 ms, nítida 148 ms, previa con 300 cables 56 ms.
- [ ] Ctrl+Shift+B hasta la escena de 2000 y F. F3: máx. ____ ms, lentos ____. En la alpha.11: 10 ms y 0.

## D. Archivo con la escena de 2000

| # | Qué | Tope netbook | Origen | Medido |
|---|---|---|---|---|
| D1 | Escena de 2000 (Ctrl+Shift+B) y Guardar como (el aviso dice el tiempo) | ≤ 1 s | D20 | ____ ms (alpha.11: 117) |
| D2 | Abrir ese archivo | ≤ 1 s | D20 | ____ ms (alpha.11: 200) |

## E. En la PC, con `inversion.brn` traído
En PowerShell, en la carpeta del repo:

```powershell
$env:BORNERA_BRN = "C:\Users\jerke\Downloads\inversion.brn"; $env:BORNERA_BASE = "inversion"; npm.cmd run circuito; Remove-Item Env:BORNERA_BRN, Env:BORNERA_BASE
```

- [ ] **Pasa:** «misma partición que la base (7 redes, 24 bornes)», comparado contra «inversion».
- Si falla, la lista de diferencias dice qué falta, qué sobra o qué red se partió o se unió. Anotarla tal cual.

## Resultados en la netbook (2026-11-16 y 2026-11-17) — criterio A + D1

Versión `0.1.4-alpha.1`, Edge 157, lienzo 1366×768 fuera de pantalla. Seis corridas de «Probar la fase 3b» (`prueba1` a `prueba6`). La 1 y la 4 son las primeras tras abrir la app (frías). La 2, 3, 5 y 6 son calientes.

**Criterio fijado por Bruno al cierre (A + D1), sin topes nuevos:**
- **B8, B15 y B16** se juzgan con las corridas calientes 2, 3, 5 y 6. La fría se informa. Causa: `getImageData` con el lienzo en GPU (verificado en la PC).
- **B10 por gesto** pasa a informativo. Decide **B11** (cuadros), con las 6 corridas.
- Para B8 y B11 cuenta la mediana de las corridas de máx. y de % de cuadros lentos (decisión de Bruno, 2026-11-17). Las corridas sueltas que fallan se informan.
- Los demás valores usan la mediana de las 6 corridas.

**A a E**
- A1 a A13: pasan (guardar / abrir `inversion.brn`: 53 / 36 ms).
- C: F con 2000 = 9,1 ms.
- D: escena de 2000, guardar / abrir 71 / 54 ms.
- E: pasa (7 redes, 24 bornes).
- P1 y P2: OK.

**B1 a B16** (ms; «mediana» sobre las corridas que cuentan):

| # | Medida | Tope | Mediana | Peor corrida | Corridas que cuentan | Resultado |
|---|---|---|---|---|---|---|
| B1 | paso: mediana / máx. | ≤ 375 / ≤ 750 | 143,0 / 153,6 | 216,9 / 243,5 | 1 a 6 | pasa |
| B2 | deshacer: mediana / máx. | ≤ 100 / ≤ 200 | 24,8 / 34,5 | 31,8 / 37,4 | 1 a 6 | pasa |
| B3 | cuadros tras el gesto | ≤ 1 lento por gesto, ninguno > 100 | 0,5 por gesto; máx. 16,1 | 1 por gesto; máx. 41,2 | 1 a 6 | pasa |
| B4 | paso: mediana / máx. | ≤ 100 / ≤ 200 | 15,8 / 24,4 | 18,4 / 39,5 | 1 a 6 | pasa |
| B5 | deshacer: mediana / máx. | ≤ 100 / ≤ 200 | 3,8 / 7,0 | 4,4 / 45,3 | 1 a 6 | pasa |
| B6 | cuadros tras el gesto | ≤ 1 lento por gesto, ninguno > 100 | 0 por gesto; máx. 12,3 | 1 por gesto; máx. 43,7 | 1 a 6 | pasa |
| B7 | revisión por punto p95 | ≤ 12,5 | 3,1 | 4,2 | 1 a 6 | pasa |
| B8 | cuadros de la previa | ninguno > 50 y < 1 % > 16,7 | máx. 18,9; 0,3 % | corrida 2: máx. 75,3; 4,0 % | 2, 3, 5, 6 (calientes) | pasa por mediana |
| B9 | mayor N con p95 ≤ 12,5 | se anota | 500 | 320 (corrida 2) | 1 a 6 | se anota |
| B10 | rehacer por gesto | ≤ 62,5 | 124,5 | 227,5 | 1 a 6 | informativo |
| B11 | cuadros del rehacer | ninguno > 50 y < 1 % > 16,7 | máx. 15,6; 0,3 % | corrida 2: máx. 139,6; 4,7 % | 1 a 6 | pasa por mediana |
| B12 | mover 1 contacto: mediana | ≤ 4,5 | 3,4 | 3,7 | 1 a 6 | pasa |
| B13 | R6 p95 / máx. | ≤ 7,5 / ≤ 20 | 0,1 / 0,1 | 0,1 / 0,2 | 1 a 6 | pasa |
| B14 | cuadros | ninguno > 50 y < 1 % > 16,7 | máx. 3,5; 0 % | máx. 3,6 | 1 a 6 | pasa |
| B15 | Encuadrar (F) con 500 | 0 lentos | 0 lentos; máx. 12,2 | 0 lentos; máx. 12,3 | 2, 3, 5, 6 (calientes) | pasa |
| B16 | borrar y deshacer con cables | 0 lentos | 0 lentos; 45,8 por gesto | 0 lentos; 46,2 | 2, 3, 5, 6 (calientes) | pasa |

**Corridas frías (informadas, no cuentan):** B15 dio 31 y 32 lentos (máx. 49,2 y 54,4 ms) y B16 dio 30 lentos (320,7 y 337,6 ms por gesto), solo en las corridas 1 y 4. B8 en frío: máx. 376,4 y 225,7 ms. Causa: `getImageData` con el lienzo en GPU.

**Corridas sueltas que fallan** (informadas, no cambian el resultado):
- B8 corrida 2: máx. 75,3 ms; 4,0 % (24 de 600).
- B11 corrida 2: máx. 139,6 ms; 4,7 % (11 de 235).
- B11 corrida 6: máx. 49,4 ms; 1,4 % (2 de 145).

**Si se sumaran los cuadros lentos de las corridas** en vez de usar la mediana, B8 daría 1,25 % (30 de 2400) y B11 1,4 % (14 de 984), y no pasarían. Bruno eligió la mediana.

**Resultado:** pasan todas las filas con tope menos B10, que es informativa. Se anota B9 (N = 500; se podría subir `TOPE_PREVIA_PEGAR`, pero no se toca sin Bruno).

---

# Hoja 2 — Pasos para armar la inversión

> **Confirmada** por el humo `tests/humo/cierre3b-inversion.mjs` (2026-11-16): estos pasos, con el mouse y el teclado a 1024×600, dan las redes de la referencia y «Sin avisos». Si algo no sale como dice, anotarlo como hallazgo y seguir de la forma más razonable. Las coordenadas entre paréntesis son las de la barra de estado (X · Y) con el mouse encima; sirven para ubicarse, no hace falta acertarlas.

Partimos de la marcha-parada: L, S0 (parada, NC), S1 (marcha, NA) con el NA de K1 en paralelo (retención), bobina K1 con H1 en paralelo y N. Hay que intercalar el NC de K2 antes de la bobina K1 y después duplicar la rama para K2. Al zoom inicial no entra todo: desplazar la vista con el botón del medio cuando haga falta (el humo lo hizo 4 veces).

1. **Abrir** `marcha-parada.brn`. La barra dice «Sin avisos».
2. **Hacer lugar para el NC:** rectángulo **de izquierda a derecha** (toma solo lo que queda entero adentro) desde la izquierda de la bobina K1, un poco debajo de A1, hasta la derecha de H1, debajo del Neutro N. Toma la bobina, H1, N y sus 2 cables de abajo; los 2 que cruzan el borde de arriba no. Arrastrar la bobina 6 unidades hacia abajo (de Y 22 a Y 28): los cables que cruzan el borde se estiran y siguen conectados. Sigue «Sin avisos».
3. **Borrar dos cables:** clic en el cable que baja de S1·14 a K1·A1 (entre la T y A1), **Mayús+clic** en el de la T de H1 (en su tramo horizontal) y **Supr**. Si se borra solo el primero, el de H1 queda con una punta suelta justo donde va el NC.
4. **Colocar el NC:** arrastrar «Contacto auxiliar NC» desde la paleta al lugar libre entre S1 y la bobina, en (0, 17). Clic en el NC, etiqueta **K2** en el panel y Enter. La barra cuenta **5 avisos**: el NC sin bobina K2 (R2) y 4 bornes sueltos (K1·A1, H1·X1 y los dos del NC).
5. **Cablear con W:** S1·14 → NC·21 y NC·22 → K1·A1 (un clic en cada borne).
6. **Volver a poner H1 en paralelo con la bobina:** con W, clic sobre el cable NC·22–A1 (una T), clic a la altura de esa T sobre H1 (codo) y clic en H1·X1. Esc. La barra queda en **1 aviso**: R2 del NC, hasta que exista la bobina K2.
7. **Seleccionar la rama de K1:** rectángulo **de izquierda a derecha** desde la izquierda de S1 (entre S0 y S1) hasta la derecha de H1 (entre H1 y N). Toma S1, el NA K1, el NC K2, la bobina K1, H1 y los 4 cables de adentro; no toma L, S0, N ni los cables que cruzan el borde.
8. **Ctrl+D.** La copia aparece a la derecha (21 unidades) con S2, K2 (NA), K2 (bobina) y H2. Su NC dice «K2» y la barra cuenta **5 avisos**: R6 por ese NC y 4 bornes de la copia todavía sueltos (S2·13, K2·13, K2·A2 y H2·X2). Ver el punto A5. Es un solo paso: Ctrl+Z la quita entera.
9. **En la copia, cambiar la etiqueta del NC a K1** (clic, panel y Enter). R6 se va; quedan **4 avisos** hasta los pasos 10 y 11.
10. **Cablear la copia arriba,** con W:
    - S2·13 → arriba (21, 7) → a la derecha (31, 7) → K2·13;
    - después una T: clic sobre el tramo vertical del cable S0·12–K1·13 (justo encima de K1·13, en (10, 8)) y clic sobre el cable recién hecho, justo encima de S2·13 (en (21, 8)).
11. **Cablear la copia abajo,** con W:
    - H2·X2 → abajo (37, 36) → clic sobre el cable que baja al N (una T en (0, 36));
    - K2·A2 → clic sobre ese cable nuevo, debajo de K2 (una T en (21, 36)). Esc.
12. **Revisar** A6 a A11: «Sin avisos», las listas y F.
13. **Ctrl+Mayús+S (Guardar como)** con el nombre `inversion.brn` y seguir con A12. **No usar Ctrl+S:** pisaría `marcha-parada.brn`, que es el archivo abierto.
