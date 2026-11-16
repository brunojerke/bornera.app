# Netbook con Windows — cierre de la fase 3b

Para imprimir. Plan: `docs/plan-cierre-3b.md`. Cada criterio lleva su **tope de netbook**, no el de la PC: la columna «PC» es solo referencia.

**Origen de los topes:**
- **Bruno:** fijado por Bruno para la netbook.
- **T15:** el criterio «sin trabas» de `docs/plan-T15.md`, sección 5.
- **0.1.2:** la meta de 0.1.2, ningún cuadro de más de 50 ms y menos de 1 % de más de 16,7 ms.
- **×2,5:** el tope absoluto de la PC por el factor de la netbook de T16 (`docs/plan-T16.md`, sección 4).
- **Propuesto:** sale de ×2,5 y lo confirma Bruno antes de medir.

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
| A5 | Después de Ctrl+D, la copia tiene S2, K2 (NA), K2 (bobina) y H2, y su NC dice «K2». La barra cuenta un aviso (R6) | exacto | T17/T19 | ☐ |
| A6 | Al terminar, la barra dice «Sin avisos» | 0 avisos | Bruno | ☐ |
| A7 | Hay una sola bobina K1 y una sola bobina K2 | sin repetidas | Bruno | ☐ |
| A8 | Bajo K1, 2 filas: NA 13-14 (rama de K1) y NC 21-22 (rama de K2). Bajo K2, 2 filas: NA 13-14 (rama de K2) y NC 21-22 (rama de K1) | exacto | Bruno | ☐ |
| A9 | Con el mouse en el centro de cada uno de los 4 contactos, la barra muestra las coordenadas de su fila | iguales | Bruno | ☐ |
| A10 | Ninguna lista toca un símbolo, una etiqueta, un nombre de borne ni un cable, de ninguna rama | nada tapado | Bruno | ☐ |
| A11 | F: el circuito entero entra con los textos legibles | entra | T15 | ☐ |
| A12 | Ctrl+S como `inversion.brn`, cerrar con la X, abrir la app y Abrir el archivo | mismo dibujo, título sin «•», Deshacer desactivado | T15 | ☐ |
| A13 | Guardar y abrir | ≤ 1 s | D20 | ☐ |

Se anota, no es criterio: tiempo total ______ min · ¿Desplazaste o alejaste el zoom? ______ · Trabas o sorpresas: ____________________________

## B. «Probar la fase 3b» (menú de desarrollo)
- Menú de desarrollo › «Probar la fase 3b», 3 corridas seguidas.
- Después de cada una, copiar la tabla a un `.txt` en el pendrive.
- Por fila cuenta la mediana de las 3 corridas; los lentos se suman en las 3.

| # | Escenario | Medida | Tope netbook | Origen | PC | Netbook |
|---|---|---|---|---|---:|---|
| B1 | Duplicar todo (2000) | paso: mediana / máx. | ≤ 375 / ≤ 750 ms | ×2,5 (T16: 150/300) | 49 / 91 | |
| B2 | ″ | deshacer: mediana / máx. | ≤ 100 / ≤ 200 ms | ×2,5 (T17: 40/80) | 10 / 17 | |
| B3 | ″ | cuadros después del gesto | ≤ 1 lento por gesto y ninguno > 100 ms | Bruno | 0 lentos | |
| B4 | Pegar 500 | paso: mediana / máx. | ≤ 100 / ≤ 200 ms | ×2,5 (T16: 40/80) | 5,8 / 8,8 | |
| B5 | ″ | deshacer: mediana / máx. | ≤ 100 / ≤ 200 ms | ×2,5 (T16: 40/80) | 1,7 / 3,6 | |
| B6 | ″ | cuadros después del gesto | ≤ 1 lento por gesto y ninguno > 100 ms | Bruno | 0 lentos | |
| B7 | Previa de pegar 160 | revisión por punto: p95 | ≤ 12,5 ms | propuesto (5 ms) | 0,9 | |
| B8 | Previa de pegar, 40 a 500 | cuadros | ninguno > 50 ms y < 1 % > 16,7 ms | 0.1.2 | 0 lentos | |
| B9 | Previa de pegar, la serie | mayor N con revisión p95 ≤ 12,5 ms | se anota. Si da menos de 160, se baja `TOPE_PREVIA_PEGAR`; si da 320 o más, se puede subir (con Bruno) | T16 | 500 | N = ____ |
| B10 | Rehacer al 31 % con referencias | por gesto | ≤ 62,5 ms | propuesto (25 ms) | 22,6 | |
| B11 | ″ | cuadros | ninguno > 50 ms y < 1 % > 16,7 ms | 0.1.2 | 0 lentos | |
| B12 | Mover 1 contacto con referencias al 31 % | paso: mediana | ≤ 4,5 ms | propuesto (1,8 ms) | 1,1 | |
| B13 | Dibujar 1 cable con 2000 y un par NC+bobina al 31 % | R6: p95 / máx. | ≤ 7,5 / ≤ 20 ms | propuesto (3/8 ms) | 0,1 / 0,1 | |
| B14 | ″ | cuadros | ninguno > 50 ms y < 1 % > 16,7 ms | 0.1.2 | 0 lentos | |
| B15 | Encuadrar (F) con 500 | cuadros | 0 lentos (> 16 ms) | Bruno (T19, cambio 9) | 0 lentos | |

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

---

# Hoja 2 — Pasos para armar la inversión

> **Borrador:** lo confirma el humo de la etapa 2 (orden, dónde hacer lugar y cómo reconectar H1). Si algo no sale como dice, anotarlo como hallazgo y seguir de la forma más razonable.

Partimos de la marcha-parada: L, S0 (parada, NC), S1 (marcha, NA) con el NA de K1 en paralelo (retención), bobina K1 con H1 en paralelo y N. Hay que intercalar el NC de K2 antes de la bobina K1 y después duplicar la rama para K2.

1. **Abrir** `marcha-parada.brn`. La barra dice «Sin avisos».
2. **Hacer lugar para el NC:** seleccionar con un rectángulo la bobina K1, la lámpara H1 y el Neutro N, y bajarlos unas 6 unidades. Los cables los siguen.
3. **Borrar** el cable que va de S1·14 a K1·A1, el que lleva la T de H1.
4. **Colocar un contacto auxiliar NC** en el lugar libre entre S1 y la bobina, con la etiqueta **K2** (panel y Enter). La barra cuenta un aviso: todavía no hay bobina K2.
5. **Cablear con W:** S1·14 → NC·21 y NC·22 → K1·A1.
6. **Volver a poner H1 en paralelo con la bobina:** con W, de H1·X1 al cable NC·22–A1 (una T) o al borne A1.
7. **Seleccionar la rama de K1:** S1, el NA K1, el NC K2, la bobina K1, H1 y los cables entre ellos. No van L, S0 ni N.
8. **Ctrl+D.** La copia aparece al lado con S2, K2 (NA), K2 (bobina) y H2. Su NC dice «K2» y la barra avisa (R6). Ver el punto A5.
9. **En la copia, cambiar la etiqueta del NC a K1** (panel y Enter). El aviso se va.
10. **Cablear la copia arriba:** S2·13 y K2·13 a la red común (la de S0·12, S1·13 y K1·13).
11. **Cablear la copia abajo:** K2·A2 y H2·X2 al Neutro, con una T sobre el cable que baja al N o al borne N.
12. **Revisar** A6 a A11: «Sin avisos», las listas y F.
13. **Ctrl+S** como `inversion.brn` y seguir con A12.
