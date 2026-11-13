# Plan T15 — Aceptación: marcha-parada

**Aprobado el 2026-11-12** con D1-A, D2-B, D3-B, D4-B, D5-B, D6-B, D7-A y D8-B, más los ajustes 1 a 5 de Bruno (ya incorporados). D9-A (leer F3 como está) se eligió el mismo día; salió de verificar F3 para el ajuste 4.

> **Las redes por union-find no existían.** Al planear no había netlist ni función de redes de la hoja. Lo que había: `nodoExtremo` (a qué nodo conecta un extremo, `src/core/model/cables.ts:225`, anotado como "base de las redes (T15)") y un union-find **local a un punto** para los puntos de unión de T14b (`unionEnPunto`, `src/core/model/uniones.ts:57`), que no arma redes. `src/core/sim/` está vacía. La etapa 1a las escribe en `src/core/model/redes.ts` (D2-B).

**Estado de git al planear (verificado):** `main` en `4279fe4` (T15a cerrada), 8 commits sin push, árbol limpio.

## Decisiones (Bruno, 2026-11-12)

| | Elegida | Qué |
|---|---|---|
| D1 | **A** | El armado vive en `src/core/circuitos/marchaParada.ts`, un módulo de apoyo de tests como `prueba-documentos.ts` (solo lo importan los tests). Su test está en `src/core`. La fase 4 lo importa desde `tests/circuitos/`. |
| D2 | **B** | Las redes son una función del núcleo, en `src/core/model/redes.ts`: `redes(hoja, { unirPorNombre })` y `porNombre(lista)`, con `normalizarEtiqueta`. Es el paso 1 de la simulación, sin simular. |
| D3 | **B** | Codos fijos (los de la tabla de la sección 3), más la comprobación de que cada cable pasa `prepararCable` como en W. |
| D4 | **B** | La `docMarchaParada` de `seguir.test.ts` se deja como está. |
| D5 | **B** | Archivo congelado `tests/circuitos/marcha-parada.brn` (gzip, versión 1), generado con un script, y un test que lo abre y lo compara con el armado. |
| D6 | **B** | Lo relativo, en la PC: banco alternado contra `v0.1.2`, con el criterio de la sección 6 fijado antes de medir. Lo absoluto, en la netbook con Windows: la meta de 0.1.2 con F3. |
| D7 | **A** | Prerelease `v0.1.3-alpha.11` con T15 y los pendientes de T15a; después, 0.1.3. |
| D8 | **B** | Prueba a mano a la vista, y además se trae `marcha-parada.brn` a la PC y se comparan sus redes con un comando. |
| D9 | **A** | F3 se lee como está, justo al soltar cada cable. El criterio "Fluido" de la sección 5 es una aproximación a la meta de 0.1.2 (ver la sección D9 al final). |
| D10 | **A** | (2026-11-13, etapa 3) El humo calcula `redes` y `compararRedes` en Node con el código de la app: el runner le pasa `cargar` (el `ssrLoadModule` de su Vite). No se toca el global `bornera`. |
| D11 | **A** | (2026-11-13, etapa 3) Si a 1024×530 el circuito no entraba con F, se frenaba antes del commit para decidir. Entró: no hizo falta. |

Descartadas: D1-B (en `tests/circuitos/`), D2-A (ayudante de test), D3-A (ruteo de W al armar), D4-A (unificar con T14a), D5-A/C (solo código / JSON sin comprimir), D6-A/C (las dos versiones en la netbook / referencia en la alpha.11), D7-B/C (`.msi` local / directo 0.1.3), D8-A (solo a la vista), D9-B (acumulado nuevo en F3), D10-B (`redes` en el global `bornera`), D11-B (a 1024×530, solo medición informativa).

## 1. La tarea en `docs/plan-fase3.md` (cita textual)

> ### T15. Aceptación: marcha-parada
> - **Qué:**
>   - Test automático en `src/core`: armar la marcha-parada solo con comandos (Fase "L" arriba, S0 NC, S1 NA, K1 13-14 en paralelo con S1, bobina K1, lámpara H1 en paralelo con la bobina, Neutro "N" abajo) y verificar la conectividad esperada por bornes, por cables.
>   - La bobina y la lámpara pueden ir a dos Neutro "N" distintos sin cable entre ellos: el test anota qué redes se unirían por nombre (base para la fase 4), sin simular. Ese mismo documento queda como base para `tests/circuitos/` en la fase 4.
>   - El test también la guarda y la abre (T15a) y compara.
>   - Prueba manual: dibujarla a mano en la netbook, guardarla, cerrar la app y volver a abrirla.
>   - `npm run bench` y medición F3.
> - **Terminado cuando:** el test pasa, se dibuja a mano sin trabas en 1024×600 y el banco no empeora más de 10 % respecto de 0.1.2.
> - **Cierre:** versión 0.1.3, nota "Medición 0.1.3 - netbook.md" y fase 3 tildada en Bornera.md.

Relacionado: "En T8, T9 y T15: F3 en la netbook con la escena de 2000" (`docs/plan-fase3.md:525`) y "el banco de pruebas no puede empeorar más de un 10 % entre fases" (`docs/arquitectura.md:363`).

## 2. Qué existe hoy

### Verificado

**Comandos (`src/core/model/comandos.ts`)**
- `Colocar` :94 y `colocar(doc, datos)` :132: el id sale del contador al construir.
- `Cablear` :373 (valida con `validarCable` al aplicar) y `cablear(doc, datos)` :416 (id `w…` del contador).
- `CambiarEtiqueta` :672, `Grupo` :703, `Mover`/`Rotar`/`Espejar` :318/:341/:360, `CambiarExtremo` :451, `Borrar` :544.
- `Historial.ejecutar` (`historial.ts:65`) y `deshacer` (`historial.ts:84`).
- El editor coloca con `etiquetaInicial` (`src/editor/editor.ts:885`, `herramientas/colocar.ts:199`): "L" en Fase y "N" en Neutro (`biblioteca.ts:233`, `:246`).

**Validación como la herramienta W**
- `prepararCable` (`trazado.ts:631`): estructura más conexiones engañosas.
- `consultaHoja` (`trazado.ts:169`), `problemasTrazado` (`trazado.ts:274`) y el ruteo `codos` (`ruteo.ts:249`).
- `validarCable` (`cables.ts:118`) mira solo la estructura (referencias, puntos enteros, forma y los dos extremos en el mismo borne). No mira cruces ni tramos encimados con otros cables: un documento con tramos encimados abre y se puede armar con `Cablear`.

**Símbolos (`src/core/symbols/biblioteca.ts`)**

| Símbolo | Línea | Bornes |
|---|---|---|
| `pulsador.nc` | :114 | 11, 12 |
| `pulsador.na` | :97 | 13, 14 |
| `contactor.auxiliar_na` | :145 | 13, 14 |
| `contactor.bobina` | :131 | A1, A2 |
| `senalizacion.lampara` | :167 | X1, X2 |
| `fuente.fase` | :225 | L, en (0, 1), hacia abajo |
| `fuente.neutro` | :238 | N, en (0, 1), hacia abajo |

Fase y Neutro tienen `elemento: "fuente"` y un solo borne (`biblioteca.ts:229`, `:242`).

**Redes y nombres**
- Al planear, no había redes (ver el recuadro de arriba).
- `normalizarEtiqueta` (`etiquetas.ts:19`): sin espacios a los lados y en mayúsculas.
- Dos Neutro con la misma etiqueta están permitidos (`etiquetas.ts:3-4`).

**T15a**
- `serializar` (`src/core/io/serializar.ts:123`) y `deserializar` (`deserializar.ts:466`).
- Contadores atrasados: se rechaza el archivo (D7-A, `deserializar.ts:389`).
- `documentosDePrueba()` (`prueba-documentos.ts:142`) alimenta la ida y vuelta del núcleo (`serializar.test.ts:108-184`) y la de gzip (`src/ui/brn.test.ts:42`).
- `invariantes(doc)` (`prueba-invariantes.ts:7`).

**La marcha-parada de T14a.** `docMarchaParada` (`src/core/model/seguir.test.ts:867`) es privada de ese test y se tiende con el ruteo de W (`rutear`, :60). Es "la de T15" según `plan-fase3.md:343`. Pero:
- Los cables tienen ids fijos que no pasan por el contador (`tender`, :46). **Así no abre**: D7-A la rechaza.
- No tiene etiquetas (`datos`, :35, da `etiqueta: ""`).
- Queda como está (D4-B).

**Lugares**
- `tests/circuitos/` existe y está vacía.
- Vitest incluye `tests/**/*.test.ts` (`vite.config.js:14`).
- `src/core` solo puede importarse a sí mismo (`tests/arquitectura.test.ts:2`, `:42`): un test en `src/core` **no puede** importar nada de `tests/`.
- El global `bornera` de la consola existe solo en desarrollo (`src/ui/Lienzo.svelte:163`).

**Versión 0.1.2 y mediciones**
- El tag `v0.1.2` existe. Su release en GitHub tiene `Bornera_0.1.2_x64_en-US.msi`.
- Sus escenas de Ctrl+Shift+B están en `v0.1.2:src/ui/escenas.ts`.
- 0.1.2 tiene dos mediciones:
  - "Medición 0.1.2-dev - PC Ryzen 7": `npm run bench`, Edge headless, en Windows.
  - "Medición 0.1.2 - netbook": F3 a mano, en Mint con WebKitGTK. 20–65 %: máximo 7–16 ms, casi siempre 0 lentos. 11–14 %: 17–18 ms, 1–4 lentos. Meta: menos de 1 % de cuadros de más de 16,7 ms y ninguno de más de 50 ms.
- En T2 ya se corrió el banco alternado contra el tag `v0.1.2`, con su propio banco (`docs/bench.md:129`).
- Ruido del banco por gesto (`docs/bench.md:164`): con este ruido no se puede confirmar ni descartar un 10 %. Por cuadro, ±0,5 ms.

**F3 (`src/render/rendimiento.ts`, `src/ui/Rendimiento.svelte`)**
- "Prom. / máx." es el promedio y el máximo **del último segundo** (`VENTANA_MS = 1000`, :7). Con el programa quieto, a un segundo vuelve a 0.
- "> 16 ms (5 s)" cuenta los cuadros de **más de 16 ms** (`LIMITE_LENTO_MS = 16`, :10) en los últimos 5 s (`VENTANA_LENTOS_MS`, :13).
- "FPS" son los cuadros del último segundo. **F3 no muestra cuántos cuadros hubo en 5 s ni en un gesto entero**, así que el "1 %" no se puede calcular con lo que se ve (D9-A: se aproxima, sección 5).

**Instalador MSI (ajuste 3)**
- `tauri.conf.json` no fija `bundle.windows.allowDowngrades`.
- En tauri-utils 2.10.2 el valor por defecto es `true` (`config.rs:1068-1069` y `:1111`).
- La plantilla WiX que trae el CLI 2.12.4 (embebida en `cli.win32-x64-msvc.node`):
  ```
  {{#if allow_downgrades}}
      <MajorUpgrade Schedule="afterInstallInitialize" AllowDowngrades="yes" />
  {{else}}
      <MajorUpgrade Schedule="afterInstallInitialize" DowngradeErrorMessage="…" AllowSameVersionUpgrades="yes" />
  ```
  `Product Id="*"`: cada build tiene su propio ProductCode, con el mismo `UpgradeCode`.
- La página de MajorUpgrade de WiX 3 (docs.firegiant.com; leída como resumen, no textual entera) dice: con `AllowDowngrades="yes"`, "any version can be installed over any other version", y "AllowDowngrades already allows two products with the same version number to upgrade each other". MSI ignora el cuarto campo.
- **Conclusión:**
  - **0.1.3 (MSI 0.1.3.0) se instala encima de 0.1.3-alpha.10 (MSI 0.1.3.10) sin desinstalar.** Para MSI son la misma versión (0.1.3), y `AllowDowngrades` las deja reemplazarse.
  - Por lo mismo, **0.1.2 también se instala encima de 0.1.3 sin desinstalar** (corrige D6-A).
  - Sin probar en la netbook: en la etapa 6 se mira que quede una sola "Bornera" en Aplicaciones instaladas.

**Diagnóstico (test temporal, ya borrado; árbol limpio).** Armé el circuito de la sección 3 con `colocar`, `cablear` y el ruteo de W. Resultado:
- `validarHoja` sin problemas.
- 4 uniones donde se espera.
- Contadores `{c: 8, w: 9}`.
- `deserializar(serializar(doc))` abre.
- Las coordenadas y los codos de la sección 3 salen de esa corrida. Con D3-B quedan fijos.

### Supuesto (sin verificar)
- "Por bornes, por cables" = conectividad a través de un borne compartido (dos cables en un borne) y a través de un cable (T). El test cubre las dos y, además, lista cada red por sus bornes y por sus cables.
- A mano, el Neutro de abajo se gira 180° (borne arriba), como en `docMarchaParada`.
- ~~El humo puede dibujar el circuito a 1024×600 con el mouse sin desplazar la vista.~~ **No:** medido en la etapa 3 (2026-11-13). Una unidad ocupa 20 px al zoom inicial, y el circuito (38 unidades de alto, 760 px) no entra en el lienzo de 536 px. Hay que desplazar la vista (ver la sección 5).
- Los escenarios del banco de 0.1.2 se pueden comparar con los mismos de HEAD (T2 lo hizo; con el banco de hoy no lo revisé).
- `UpgradeCode` es el mismo en todas las versiones. Sale de la configuración de la app, no de la versión; no vi el cálculo en la fuente. Las alphas se fueron instalando una encima de otra, que es coherente con esto.

## 3. El circuito

Coordenadas en unidades de grilla, `y` hacia abajo. Etiquetas: "L" y "N" las pone `colocar`, como el editor (`etiquetaInicial`). S0, S1, K1, K1 y H1 se ponen con `CambiarEtiqueta`, como el panel.

### Base

| id | Tipo | Etiqueta | x, y | rot | Bornes en la hoja |
|---|---|---|---|---|---|
| c1 | `fuente.fase` | L | 0, 0 | 0 | L (0, 1) |
| c2 | `pulsador.nc` | S0 | 0, 5 | 0 | 11 (0, 3) · 12 (0, 7) |
| c3 | `pulsador.na` | S1 | 0, 11 | 0 | 13 (0, 9) · 14 (0, 13) |
| c4 | `contactor.auxiliar_na` | K1 | 10, 11 | 0 | 13 (10, 9) · 14 (10, 13) |
| c5 | `contactor.bobina` | K1 | 0, 22 | 0 | A1 (0, 20) · A2 (0, 24) |
| c6 | `senalizacion.lampara` | H1 | 16, 22 | 0 | X1 (16, 20) · X2 (16, 24) |
| c7 | `fuente.neutro` | N | 0, 33 | 180 | N (0, 32) |

| id | Desde | Hasta | Codos (fijos, D3-B) | Recorrido |
|---|---|---|---|---|
| w1 | L·L | S0·11 | — | (0,1)→(0,3) |
| w2 | S0·12 | S1·13 | — | (0,7)→(0,9) |
| w3 | S0·12 | K1·13 | (10, 7) | (0,7)→(10,7)→(10,9) |
| w4 | S1·14 | K1·A1 | — | (0,13)→(0,20) |
| w5 | K1·14 | S1·14 | — | (10,13)→(0,13) |
| w6 | K1·A2 | N·N | — | (0,24)→(0,32) |
| w7 | T en w4 (0, 16) | H1·X1 | (16, 16) | (0,16)→(16,16)→(16,20) |
| w8 | T en w6 (0, 28) | H1·X2 | (16, 28) | (0,28)→(16,28)→(16,24) |

```
          L  c1
          │ w1
       11 ┤ S0 (NC) c2
       12 ●──────w3──────┐            ● borne con dos cables (S0·12)
          │ w2           │
       13 ┤ S1 (NA) c3   ├ 13  K1 aux (NA) c4
       14 ●──────w5──────┘ 14         ● borne con dos cables (S1·14)
          │ w4
          ●──────w7──────────────┐    ● T sobre w4 en (0, 16)
       A1 ┤ K1 bobina c5      X1 ┤ H1 c6
       A2 ┤                   X2 ┤
          │ w6                   │
          ●──────w8──────────────┘    ● T sobre w6 en (0, 28)
          │
          N  c7
```

**Conectividad esperada:** 4 redes, que reúnen los 12 bornes y los 8 cables.

| Red | Bornes | Cables | Nombre (fuentes) | Cómo se une |
|---|---|---|---|---|
| R1 | L·L, S0·11 | w1 | "L" | — |
| R2 | S0·12, S1·13, K1·13 | w2, w3 | — | por borne (S0·12) |
| R3 | S1·14, K1·14, K1·A1, H1·X1 | w4, w5, w7 | — | por borne (S1·14) y por cable (T en w4) |
| R4 | K1·A2, H1·X2, N·N | w6, w8 | "N" | por cable (T en w6) |

"K1·13" es del contacto auxiliar y "K1·A1", de la bobina: etiqueta y borne no se repiten en el circuito.

**Uniones (T14b):** 4, en (0, 7), (0, 13), (0, 16) y (0, 28).

**Lo que no se une:** los cruces y los tramos encimados no unen redes (en este circuito no hay; lo prueban los tests de la etapa 1a). Un contacto no une sus dos bornes sin simular, así que S0 no une R1 con R2.

### Variante con dos Neutro "N"

Igual que la base, más **c8** `fuente.neutro` "N" en (16, 33), rot 180, con su borne en (16, 32). **w8** pasa a ser H1·X2 → c8·N, en recta (16,24)→(16,32), sin T en w6. No hay ningún cable entre c7 y c8.
- **Por cables:** 5 redes. R4 se parte en R4a {K1·A2, c7·N; w6} y R4b {H1·X2, c8·N; w8}.
- **Uniones:** 3 (se va la de (0, 28)).
- **Se unirían por nombre (anotado, sin simular):** `porNombre` da `{ L: [R1], N: [R4a, R4b] }`. R2 y R3 no tienen nombre.
- **Después de unir por nombre** (`unirPorNombre`), la partición de los bornes es igual a la de la base, con c8·N en la red de N.
- **Caso "n " (ajuste 1):** con `CambiarEtiqueta(c8, "n ")`, `porNombre` lo normaliza y lo junta igual con "N". El resultado es el mismo que con "N".

## 4. Tests

### Redes (etapa 1a): `src/core/model/redes.test.ts`
- Un cruce no une.
- Un tramo encimado no une. El test comprueba que los dos recorridos comparten tramo.
- Un extremo libre sobre un borne no une (ni sobre el tramo de otro cable).
- Un puente entre dos bornes del mismo componente los une.
- Una T une con su anfitrión, también en cadena (una T sobre una T).
- Un contacto no une sus dos bornes (tampoco una carga). Un componente sin cables da una red por borne.
- Dos cables en un mismo borne unen.
- Nombres:
  - Fase y Neutro dan su etiqueta normalizada ("l1 " → "L1").
  - Una fuente con la etiqueta vacía no da nombre.
  - Una red con L y N cableadas tiene los dos nombres.
  - `porNombre` y `unirPorNombre`, incluido el paso transitivo: una red con L y N junta las de L con las de N.
- Orden fijo: redes, bornes y cables en el orden de la hoja.
- Un documento roto (símbolo desconocido, cable hacia un componente o un cable que no existe) no tira excepción.

### Marcha-parada (etapa 1b): `src/core/circuitos/marchaParada.test.ts`

**Armado**
- Solo con comandos, a través de `Historial.ejecutar`: 7 (u 8) `colocar`, 5 `CambiarEtiqueta` y 8 `cablear`.
- Codos fijos (D3-B). Cada cable pasa antes por `prepararCable` contra la hoja de ese momento, sin problemas: es lo que W dejaría.

**Conectividad**
- Por cables: los nodos de cada extremo (`nodoExtremo`) son los de la tabla de cables.
- Por bornes: `redes(hoja)` tal cual la tabla de redes, con sus bornes, sus cables y sus nombres.
- Cada borne en exactamente una red. Ningún borne sin cable.

**Uniones:** 4 puntos en la base y 3 en la variante, con sus cables y componentes.

**Variante:** 5 redes por cables. `porNombre` da `{ L: [R1], N: [R4a, R4b] }`. Con `unirPorNombre`, la misma partición que la base. Caso "n " incluido.

**Deshacer:** deshacer todo deja el documento vacío (los contadores quedan arriba, por la excepción de `generarId`). Rehacer todo lo deja igual al armado.

**Guardar, abrir y comparar**
- `deserializar(serializar(doc))` `toEqual` `doc`, sin avisos.
- `invariantes` vacío.
- Las redes del documento reabierto, iguales.

### Ida y vuelta y documento base (etapa 2)
- "marcha-parada" y "marcha-parada con dos N" se suman a `documentosDePrueba()`. Así las cubren la ida y vuelta canónica del núcleo y la de gzip de `src/ui/brn.test.ts`.
- `tests/circuitos/marcha-parada.brn` (D5-B):
  - Gzip y versión 1, generado con el `serializar` y el `empaquetar` de la app por un script, como `tests/humo/datos/tildes.mjs`.
  - Un test en `tests/circuitos/` lo abre y lo compara con `marchaParada()`.
  - Es la semilla de "archivos viejos abren bien" para las migraciones de la fase 4. Si el armado cambia, el test falla y el archivo se regenera a mano, a propósito.
- **Comando de D8-B:** dado un `.brn` dibujado a mano, comparar la partición de sus bornes, con nombres, contra la de la base. No se comparan cables ni geometría. Quedó como `npm run circuito`, con la ruta en la variable de entorno `BORNERA_BRN` (paso exacto en la sección 5; detalle en la etapa 2 de la sección 9).

### Humo (etapa 3): `tests/humo/t15-marcha-parada.mjs`
A 1024×600:
1. Nuevo.
2. Colocar los 7 desde la paleta.
3. Poner las etiquetas en el panel.
4. Tender los 8 cables con W, con clics del mouse (las 2 T con un clic sobre el cable). Cada gesto da 1 paso de deshacer.
5. Comparar las redes del documento de la página con las de la sección 3. ~~Se usa `redes` a través de `bornera` (en desarrollo).~~ Se calculan en Node con el código de la app (D10-A).
6. Ctrl+S, leer la descarga en Node, Nuevo, Abrir ese archivo: documento igual, título sin "•", historial vacío.
7. F (encuadrar): el circuito entero queda dentro del lienzo que no tapan la paleta ni el panel.

Agregados de Bruno (2026-11-13, al aprobar la etapa 3):
- El .brn de Ctrl+S pasa por `compararRedes` contra `marchaParada()` con 0 diferencias (la misma cadena que `npm run circuito`).
- Las redes son las que deciden. "Hoja igual al armado" falla si cambian componentes, posiciones, etiquetas o extremos de cables; si cambian solo codos, imprime qué cables difieren y no falla.
- Segunda pasada a 1024×530 (Windows maximizado le quita unos 70 px, supuesto): solo F.
- Imprimir los px por unidad al zoom inicial y cuántas veces se desplazó la vista. Si un clic en S0·12 no alcanza para empezar en el borne (sin T sobre w2), es un hallazgo de "sin trabas".

### Lo que no se hace en T15
- Simular, el cortocircuito L-N y el aviso de L con L1.
- Las fuentes de varios bornes (trifásica: el nombre por borne). Hoy no hay ninguna: una fuente de varios bornes no da nombre hasta que se agregue.

## 5. Prueba a mano en la netbook (Windows, alpha.11 instalada)

**Pasos (Bruno)**
1. Abrir la app con la ventana maximizada, la barra de tareas como siempre y F3 visible.
2. Dibujar la marcha-parada base sin consola: 7 componentes, etiquetas, 8 cables (2 bornes con dos cables y 2 T). Las posiciones son libres, no hace falta copiar la tabla.
3. Ver los 4 puntos de unión.
4. Ctrl+S como `marcha-parada.brn`. Cerrar la app con la X.
5. Volver a abrir la app y Abrir el archivo: el mismo dibujo, el título sin "•" y Deshacer desactivado.
6. Traer `marcha-parada.brn` a la PC y correr el comando de D8-B: misma partición que la base. En PowerShell, en la carpeta del repo (la ruta, la del archivo traído):
   ```powershell
   $env:BORNERA_BRN = "C:\Users\jerke\Downloads\marcha-parada.brn"; npm run circuito; Remove-Item Env:BORNERA_BRN
   ```
   - **Pasa:** «✓ … misma partición de bornes que la base» y la línea «misma partición que la base (4 redes, 12 bornes)».
   - **Falla:** la lista de diferencias. Por ejemplo, «Falta "H1" (senalizacion.lampara).», «Sobra "L1" (fuente.fase, c9): fuente con un nombre de red nuevo.» o «Se partió la red {S1·14, K1·14, K1·A1, H1·X1}: quedó en {S1·14, K1·A1, H1·X1} y {K1·14}.».
   - Sin la variable, el test se saltea («1 skipped»). `Remove-Item` la borra para que no quede en la terminal.
   - Vale una T donde la base tiene dos cables en un borne, otro orden, otros ids u otras posiciones, y también dos Neutro "N" sin cable entre ellos (se unen por nombre).
7. Anotar cuánto tardó en dibujarla. Es referencia, no criterio.

**Dato del humo (etapa 3, Edge headless, 2026-11-13):**
- Al zoom inicial (100 %), una unidad ocupa 20 px. El lienzo mide 792×536 px (39,6×26,8 unidades) con el panel plegado y 604×536 px con el panel abierto.
- El circuito ocupa 23,6×38 unidades (472×760 px), así que **no entra a la vista: hay que desplazarla o alejar el zoom para dibujarlo**.
- El humo dibujó al 100 % y desplazó la vista 12 veces con el botón del medio. Su regla: llevar al centro lo que iba a tocar si quedaba a menos de 40 px del borde, en tres pasadas (colocar, etiquetar y cablear). Con el panel abierto, también hizo falta desplazarse en horizontal (K1 auxiliar y H1). En la netbook la cifra depende de cómo se dibuje; anotá si desplazaste o alejaste.
- Con F, el circuito entero entra: 12 px por unidad a 1024×600 y 10,2 px a 1024×530, con los textos dibujados (desde 6 px).

**Criterio "sin trabas en 1024×600"**
- **Completa:** se termina sin consola, sin editar el archivo y sin reiniciar la app.
- **W sin sorpresas:** cada cable sale en un gesto. Un rechazo cuenta como traba solo si el mensaje no explica por qué o no queda otra forma razonable de tenderlo.
- **Todo a la vista:** paleta, panel, barra y los diálogos (Guardar, Abrir, "¿Guardar los cambios?") se ven enteros, sin desplazar nada. Con F, el circuito entero entra con las etiquetas legibles.
- **Fluido (ajuste 4, con D9-A):**
  - Al terminar cada uno de los 8 cables, leer F3 enseguida, antes de que pase 1 s: "Prom. / máx." (el máximo del último segundo) y "> 16 ms (5 s)" (los lentos). Son 8 lecturas.
  - **Pasa si en cada una de las 8 lecturas** el máximo del último segundo es menor a 50 ms y los lentos (más de 16 ms) en 5 s son 0 o 1.
  - **Es una aproximación a la meta de 0.1.2** (menos de 1 % de cuadros de más de 16,7 ms y ninguno de más de 50 ms):
    - F3 no muestra el total de cuadros, así que el porcentaje no se calcula.
    - Un cable que tarda más de 1 s en tenderse no queda cubierto entero por el máximo, y uno que tarda más de 5 s, tampoco por los lentos.
    - El umbral de los lentos de F3 es 16 ms, algo más estricto que 16,7.
- **Guardar y abrir:** sin espera notable. D20 pide ≤ 1 s con 2000 símbolos; este circuito es mucho más chico.

## 6. Banco: comparar contra 0.1.2 (D6-B)

**El problema.** De 0.1.2 hay dos mediciones:
- La de la **PC** (`npm run bench`, Edge headless, en Windows). Se puede repetir hoy contra el tag.
- La de la **netbook** (F3 a mano en Mint con WebKitGTK). No es comparable con la netbook con Windows.

**Lo relativo, en la PC. Criterio fijado antes de medir (ajuste 5); no se cambia con los números a la vista.**
- **Qué se compara:** HEAD contra un worktree en `v0.1.2` con su propio banco, en la misma PC. Solo los escenarios comunes (100/500/2000 sin cables: Rehacer al 100 % y al 31 %, Encuadrar, Zoom con la rueda, Desplazar al 100 % y Arrastre al 31 %).
- **Tanda:** 5 vueltas alternadas HEAD / 0.1.2. Por escenario y versión, la mediana de las 5 vueltas.
- **Qué cuenta:** la mediana por cuadro, el p95 por cuadro y los cuadros lentos (> 16 ms). El tiempo por gesto solo se informa: su ruido es mayor que el 10 % (`bench.md:164`).
- **Suba:**
  - Mediana o p95 de HEAD > 1,10 × la de 0.1.2.
  - Lentos de HEAD > 1,10 × los de 0.1.2. Si 0.1.2 tiene 0, cualquier lento cuenta como suba.
  - No hay piso absoluto: una mediana de 1,0 ms que pasa a 1,2 ms es suba.
- **Empeorar:** una suba de la primera tanda solo cuenta si se repite en una segunda tanda (otras 5 vueltas), con el mismo escenario y la misma métrica.
- **Pasa** si ninguna suba se repite.

**Lo absoluto, en la netbook con Windows (alpha.11):**
- F3 con la escena de 2000 (Ctrl+Shift+B), al 11–14 % y al 20–65 %, 3 corridas, como la nota de 0.1.2. Meta: menos de 1 % de cuadros de más de 16,7 ms y ninguno de más de 50 ms. Con F3 se lee igual que en la sección 5 (D9-A): es una aproximación.
- El bloque del menú de desarrollo.
- Es la línea base nueva de Windows: nota "Medición 0.1.3-alpha.11 - netbook Windows".

**D6-A corregida (ajuste 3, por si se retoma):** el `.msi` de 0.1.2 se instala encima de 0.1.3 sin desinstalar (`AllowDowngrades`), y 0.1.3 vuelve encima igual. Lo demás de D6-A no cambia: F3 a mano es grueso y en 0.1.2 solo hay escenas sin cables.

## 7. Cierre

**Se hace en esta tarea (local, sin pedir):**
- Código y tests de las etapas 1a–4, y un commit local por etapa.
- `npm test`, `npm run check`, `npm run humo` y `npm run bench`.
- Commits de versión: `0.1.3-alpha.11` (etapa 5) y `0.1.3` (etapa 7). En los tres archivos: `package.json`, `Cargo.toml` y `tauri.conf.json`, con la versión de WiX. Según la sección 2, 0.1.3.0 entra encima de 0.1.3.11 sin desinstalar; igual se revisa con la skill `bornera-release`.
- `docs/plan-fase3.md`: T15 cerrada y fase 3 cerrada. `docs/bench.md`: la sección del banco.
- `docs/arquitectura.md`: el texto de la sección 8.
- Obsidian:
  - Nota "Medición 0.1.3-dev (T15) - PC Ryzen 7" con la tabla del banco.
  - Nota de la netbook "Medición 0.1.3-alpha.11 - netbook Windows". Se mide la alpha.11 (D7-A); el plan de la fase 3 decía "Medición 0.1.3 - netbook.md", pero las notas de Windows llevan "netbook Windows" desde el 2026-11-12.
  - Bornera.md: "Fase 3: editor" tildada, una línea en Sesiones, errores resueltos si hay y pendientes.

**Necesita tu autorización:**
- Push de `main` (8 commits adelante al planear, más los de T15).
- Tag `v0.1.3-alpha.11` y su push (el workflow crea la prerelease).
- Tag `v0.1.3`, su push y la release en GitHub (notas y publicación).
- Dar T15 y la fase 3 por cerradas: depende de tu prueba en la netbook.
- Cualquier dependencia nueva. No espero ninguna.

## 8. `docs/arquitectura.md`, fase 4 (en el commit de cierre)

Se agrega una línea en "Hoja de ruta por fases", ítem 4 (`docs/arquitectura.md:262-263`):

```diff
 4. **Guardar y abrir:** formato `.brn`, validación, autoguardado.
+   - Lo básico (formato .brn y validación) se adelantó en la fase 3 (T15a). En esta fase quedan el autoguardado, las migraciones y los circuitos de referencia.
    - Pasa cuando: guardar → cerrar → abrir deja el circuito idéntico (test automático).
```

## 9. Etapas

Cada etapa cierra con `npm test` y `npm run check`, y con `npm run humo` si toca algo visible, más un commit local. Sin push.

**Etapa 1a — Redes.**
- `src/core/model/redes.ts` y `redes.test.ts` (sección 4).
- Commit: "Fase 3, T15 etapa 1a: redes por union-find".
- **Hecha (2026-11-12).**
  - `redes(hoja, { unirPorNombre })` y `porNombre(lista)`. Cada borne de un componente está en una red, aunque no tenga cables.
  - Orden fijo: las redes por su primer borne en la hoja; las que no tienen bornes (cables sueltos), al final. Los bornes, por componente y como en su definición; los cables, como en la hoja.
  - Lo que no existe (componente, borne o cable) no conecta y no tira excepción. Un símbolo desconocido no tiene bornes.
  - Las fuentes de varios bornes todavía no dan nombre.
  - 13 tests: los 6 del ajuste 2, más dos cables en un borne, una T sobre un cable que viene después en la lista, hoja vacía, nombres (normalizados, vacíos, L y N en una red, paso transitivo, sin nombres) y documento roto.
  - 1351 tests, check limpio, humo 513/513. Sin banco: no toca el dibujo.
  - `docs/arquitectura.md`: nota con fecha en el paso 1 de "Motor de simulación" (las redes ya están, sin simular).

**Etapa 1b — Marcha-parada.**
- `src/core/circuitos/marchaParada.ts` y su test (sección 4), incluida la variante y el caso "n ".
- Commit: "Fase 3, T15 etapa 1b: marcha-parada armada con comandos".
- **Hecha (2026-11-12).**
  - `marchaParada({ dosNeutros })` devuelve `{ doc, historial, comp, cables }`: los ids por papel (`fase`, `s0`, `s1`, `k1Auxiliar`, `k1Bobina`, `h1`, `neutro`, `neutro2`) y w1 a w8.
  - `META_MARCHA_PARADA` es fija (título "Marcha-parada", fecha 2026-11-12): dos armados dan el mismo archivo, para el congelado de la etapa 2.
  - Codos fijos (D3-B). Si `prepararCable` encuentra problemas, el armado tira un error.
  - "Solo con comandos" se comprueba deshaciendo: 20 pasos en la base y 21 en la variante (colocar, `CambiarEtiqueta` y cablear), y queda la hoja vacía con los contadores arriba. `Historial` no expone su lista de comandos.
  - 17 tests, en `src/core/circuitos/marchaParada.test.ts`:
    - Las tablas de componentes y cables de la sección 3, con `nodoExtremo` y el recorrido.
    - La validación de W con la hoja terminada (`prepararCableExistente`).
    - Deshacer y rehacer todo.
    - Las 4 redes, por id y como "etiqueta·borne". Cada borne en una sola red.
    - Las 4 uniones.
    - La variante: 5 redes, `porNombre` `{ L: [0], N: [3, 4] }`, unidas como la base y el caso "n ".
    - Guardar y abrir de las dos, y dos armados iguales.
  - 1368 tests, check limpio, humo 513/513. Sin banco: no toca el dibujo.
  - `docs/arquitectura.md`: `src/core/circuitos/` en la estructura del repositorio.

**Etapa 2 — Ida y vuelta, documento base y comando de D8-B.**
- Las dos variantes en `documentosDePrueba()`.
- `tests/circuitos/marcha-parada.brn`, su generador y su test.
- El comando para comparar un `.brn` dibujado a mano.
- Commit: "Fase 3, T15 etapa 2: documento base para la fase 4".
- **Hecha (2026-11-13).**
  - Las dos variantes en `documentosDePrueba()`: las cubren los invariantes, la forma canónica y las dos idas y vueltas (núcleo y gzip).
  - **Archivo congelado (D5-B):**
    - `tests/circuitos/marcha-parada.mjs` escribe `marcha-parada.brn` (494 bytes) con el `serializar` y el `empaquetar` de la app, como `tildes.mjs`. Antes comprueba que sea versión 1, que abra sin avisos y que al guardarlo de nuevo dé el mismo texto.
    - `marcha-parada.test.ts` comprueba la marca de gzip y la versión 1, y que abra sin avisos `toEqual` a `marchaParada()`. Si no, falla con «El armado de marchaParada() cambió y marcha-parada.brn no. Si el cambio es a propósito, regeneralo con `node tests/circuitos/marcha-parada.mjs` y commitealo». Si falta el archivo, dice cómo generarlo. Se probaron los dos mensajes.
    - Se compara el modelo, no el texto: cuando el formato cambie (fase 4), el archivo v1 tiene que seguir abriendo igual.
  - **Comparar redes (D8-B):** `src/core/circuitos/compararRedes.ts`, `compararRedes(dibujado, base)`, devuelve las diferencias en texto.
    - Componentes por etiqueta normalizada y tipo: falta, sobra y repetido. Las dos K1 (auxiliar y bobina) no son repetidas: distinto tipo.
    - Fase y Neutro quedan fuera de "repetido" (varias "N" son la misma red). Se comparan por nombre de red y tipo. Una que sobra con un nombre que la base no tiene lo dice («fuente con un nombre de red nuevo»); una sin nombre, también.
    - Si los componentes no coinciden, las redes no se comparan.
    - Partición de los bornes en "etiqueta·borne" con `unirPorNombre` en los dos documentos; el borne de una fuente es su nombre de red ("N·N" aunque haya varias). Dice qué red se partió y qué redes se unieron. No mira cables, ids, orden ni geometría. Las redes sin bornes (cables sueltos) no cuentan.
    - `nombreDeFuente` sale de `redes.ts`: la misma regla que da los nombres de red.
  - 5 tests en `compararRedes.test.ts`: movido con `Mover`, renumerado y en otro orden (0 diferencias); sin w5 (dice qué red se partió); S0 puenteado (dice qué redes se unieron); la variante con dos N, también con "n " (0 diferencias); componentes (falta, sobra, repetido, fuentes).
  - **Comando:** `tests/circuitos/a-mano.test.ts` con `npm run circuito` (`vitest run … --silent=false --reporter=verbose`, para ver el resultado). Sin `BORNERA_BRN` se saltea, también en `npm test`. Falla si el archivo no se lee, no abre o abre con avisos. Probado en PowerShell con el congelado (pasa) y con uno sin w5 (falla y dice qué red se partió).
  - Los tests de `tests/` pasan por svelte-check, y sin `@types/node`. Los imports de Node llevan `// @ts-expect-error`, como `vite.config.js`.
  - 1378 tests (más el del comando, salteado), check limpio, humo 513/513. Sin banco: no toca el dibujo.
  - `docs/arquitectura.md`: `src/core/circuitos/` también tiene la comparación por redes. `CLAUDE.md`: `npm run circuito` en los comandos.

**Etapa 3 — Humo `t15-marcha-parada.mjs`** a 1024×600 (sección 4).
- Commit: "Fase 3, T15 etapa 3: humo de la marcha-parada".
- **Hecha (2026-11-13).**
  - `tests/humo/correr.mjs`: cada prueba recibe un tercer argumento, `{ cargar }`, para cargar módulos de la app en Node con el mismo Vite (D10-A).
  - `tests/humo/t15-marcha-parada.mjs`, 28 comprobaciones:
    - **Dibujo:** Nuevo; 6 símbolos arrastrados desde la paleta y el Neutro con clic, R, R y clic; las 5 etiquetas con clic en el símbolo, el campo del panel y Enter; los 8 cables con W y clics, con las 2 T con un clic sobre w4 y w6. Un paso por gesto, 20 en total (como `marchaParada()`), y todo al zoom inicial.
    - **Redes y hoja (en Node):** las redes de la página son iguales a las del armado. La hoja, igual en componentes y en extremos de cables. Los codos también salieron iguales en los 8 cables.
    - **Sin trabas:** un solo clic en S0·12 (que ya tiene a w2) empieza en el borne, con la pista «Empezar en S0 · 12». No hubo hallazgo.
    - **El .brn de Ctrl+S, en Node:** es gzip, abre sin avisos y `compararRedes` contra `marchaParada()` da 0 diferencias. Es el documento de la página.
    - **Nuevo y Abrir:** documento igual, «marcha-parada.brn — Bornera» sin «•» y sin historial.
    - **F:** a 1024×600 y a 1024×530, con el panel plegado y abierto, el circuito entero queda dentro del lienzo, sin tocar la paleta, el panel, la barra ni el pie.
    - **Mediciones** (las líneas con «·»): sección 5, "Dato del humo".
  - Prueba en negativo: sin w5, fallan las redes, los extremos y `compararRedes` («Se partió la red {S1·14, K1·14, K1·A1, H1·X1}…»). Se volvió a poner.
  - Comportamiento visto, no es error: si el panel de propiedades se plegó a mano, seleccionar no lo vuelve a abrir. El humo lo abre con «Mostrar propiedades».
  - 1378 tests (más el del comando, salteado), check limpio, humo 541/541 (513 de antes más 28). Sin banco: no toca el dibujo.

**Etapa 4 — Banco en la PC** con el criterio de la sección 6.
- Tabla en `docs/bench.md` y nota de medición de la PC.
- Commit: "Fase 3, T15 etapa 4: banco contra 0.1.2".

**Etapa 5 — Versión 0.1.3-alpha.11.**
- Commit de versión local. Tag y push solo con tu autorización.

**Etapa 6 — Prueba en la netbook (Bruno).**
- La sección 5, lo absoluto de la sección 6 y los pendientes de T15a.
- Mirar que quede una sola "Bornera" instalada.
- Yo paso tus números a la nota.

**Etapa 7 — Cierre.**
- Versión 0.1.3, `arquitectura.md` (sección 8), `plan-fase3.md`, Bornera.md y la nota de medición.
- Commit: "Fase 3, T15 cerrada (0.1.3)".
- Tag, push y release: con tu autorización.

## D9 (Bruno, 2026-11-12): **A**

**Cómo se miden el 1 % y el máximo del gesto entero (sale del ajuste 4).** F3 da el máximo del último segundo y los lentos de 5 s, sin total de cuadros (sección 2).
- **Elegida, A. Leer F3 como está**, justo al soltar cada cable. Criterio en la sección 5 ("Fluido").
  - Ventajas: nada que programar; F3 es igual que en 0.1.2.
  - Límite aceptado: es una aproximación. No da el porcentaje, y no cubre entero un cable que tarda más de 1 s (el máximo) o más de 5 s (los lentos).
- **Descartada, B. Sumar a F3 un acumulado reiniciable:** cuadros, más de 16,7 ms, más de 50 ms y máximo desde que se reinició. Era código de interfaz nuevo en una tarea de aceptación, y F3 dejaba de ser igual al de 0.1.2.

## Riesgos
- **1024×600 no es el lienzo útil.** En Windows maximizado, la barra de tareas y la de título le quitan unos 70 px (supuesto). El humo mide 1024×600 de viewport. En la netbook el lienzo es más bajo, y el circuito ocupa 34 unidades de alto.
  - Medido en la etapa 3: con la caja de dibujo (símbolos y etiquetas), son 38 unidades. A 1024×530, el lienzo mide 466 px de alto y con F el circuito entra entero a 10,2 px por unidad, con textos, también con el panel abierto. Al 100 % no entra ni a 1024×600 (sección 5).
- **El MSI, sin probar en la máquina.** La plantilla y WiX dicen que 0.1.3 se instala encima de la alpha (sección 2), pero no se probó. Si quedaran dos "Bornera" instaladas, se desinstala la vieja y se anota.
- **Ruido del banco.** Aunque el criterio está fijado (sección 6), una mediana chica (0,2–1 ms) sube más de 10 % con poco. Si eso se repite en las dos tandas, cuenta: no hay piso.
- **La alpha.11 sin probar.** Si los pendientes de T15a fallan en la netbook, el cierre de T15 espera.
- **El archivo congelado (D5-B).** Si `serializar` o el armado cambian a propósito, el test del archivo falla y hay que regenerarlo. Es el comportamiento buscado, pero hay que acordarse de por qué falla.
- **El dibujo a mano no es el del test.** El criterio compara redes, no geometría: Bruno puede usar una T donde el test usa un borne con dos cables.
- **WebKitGTK (Linux).** Es secundario: no bloquea el cierre. Si hay tiempo, la prueba de la sección 5 en Mint va aparte, como pendiente.
- **Alcance.** Copiar y pegar, etiquetado automático, referencias cruzadas y validaciones en vivo (T16–T19) no entran en T15.
