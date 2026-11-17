# Plan fase 4 — Guardar y abrir

**Aprobado por Bruno el 2026-11-17** con las opciones D1-C (sin «Transformar re-rutea»), D2a-A, D2b-C, D2c-A, D2d-B, D2e-A, D3-A, D4-C, D5-A, D6a-B, D6b-C, D7-A y D8-A, más sus ajustes, ya incorporados abajo. Las decisiones están en la sección 3. Las descartadas van en una línea cada una.

**Orden:** T20 → T21 → T22 → T23 → T24 → T25 → T26 → T27 → cierre (sección 6). T26 es independiente y puede adelantarse. Este plan fija qué hace cada tarea. El detalle (pasos, archivos exactos, tests uno por uno) lo arma la sesión de cada tarea con la skill `bornera-inicio`, antes de programar.

**Reglas** (las de la 3b):
- Una tarea por sesión, con el plan aprobado antes de programar.
- Cada etapa cierra con `npm test`, `npm run check` y un commit local.
- Si algo se ve en la app, suma su humo `tests/humo/tNN-*.mjs`. Al cerrar la tarea, `npm run humo` entero.
- Si toca el dibujo o el guardar: banco con el criterio fijado antes de medir. En los escenarios que `v0.1.3` no tiene, contra el commit anterior a la tarea, con ABBA ×3.
- Sin push, tags ni dependencias sin autorización.

## 1. Estado al aprobar (2026-11-17, `9d8c710`, versión `0.1.4-alpha.1`)

**El criterio viejo ya estaba cumplido.** «Guardar → cerrar → abrir deja el circuito idéntico (test automático)» lo cubre T15a:
- Ida y vuelta sobre los 8 `documentosDePrueba()` y 2000 mutaciones al azar (`src/core/io`).
- Las escenas del banco hasta 2000 con cables (`banco-brn.test.ts`) y gzip (`brn.test.ts`).
- El humo `t15a-archivo.mjs`.
- Cortar el proceso real se probó solo a mano (A12 de la netbook 3b). Por eso el criterio cambia (D5, sección 2).

**Medido en la PC** (vitest en Node, 15 vueltas). Escena de 2000 símbolos con 3030 cables:

| Paso | Mediana | Máx. |
|---|---|---|
| Texto 638 KB; gzip 72 KB | — | — |
| `serializar` | 9,3 ms | 13,2 ms |
| `deserializar` | 15,2 ms | 29,2 ms |
| gzip | 9,6 ms | 36,0 ms |

En la netbook, con la alpha.1, guardar y abrir 2000 tardó 71 / 54 ms.

**Factor de la netbook** (netbook / PC, de las tablas de la 3b; la PC se midió otro día):
- Pasos sin dibujo: ×2,2 a ×3,4 (B1, B2, B4, B5, B7, B12).
- Gestos con dibujo: ×5,5 y ×5,6 (B10, B16).

**Hecho antes de la fase:**
- Formato v1 con gzip y validación estricta (T15a).
- Un formato futuro se rechaza.
- Abrir JSON sin comprimir.
- `redes(hoja, { unirPorNombre: true })`.
- Dos circuitos congelados en gzip: `marcha-parada.brn` e `inversion.brn`.

**No hay todavía:**
- Migraciones.
- Escribir `.brn.json`.
- Autoguardado: ni `localStorage`, IndexedDB ni `navigator.locks` en `src/`.
- `fileAssociations`.
- Recientes.

**Alcance de fs:** solo `**/*.brn.tmp`. La ruta que da el diálogo vale solo para esa sesión.

**Instalador:**
- `release.yml` crea la release como **borrador** (`draft=true`); se publica a mano.
- En Windows compila **solo el `.msi`** (`--bundles msi`). Las alphas publicadas son MSI.
- **`allowDowngrades` vale `true` por defecto**: lo dice el esquema de `@tauri-apps/cli`. Con `true`, la plantilla de WiX que trae la CLI genera `<MajorUpgrade … AllowDowngrades="yes" />`; con `false`, `AllowSameVersionUpgrades="yes"` y un error de downgrade.
- Según la documentación de WiX (no la releí hoy), `AllowDowngrades="yes"` también deja reemplazar la misma versión. Eso explica que la 0.1.3 (`0.1.3.0`) se instalara encima de la alpha.11 (`0.1.3.11`).

### Supuestos (se verifican en su tarea)
- **S1.** WebView2 serializa más o menos como Node. Se mide en T23 con la regla de F1 (sección 5).
- **S2.** Dos procesos de Bornera comparten el perfil de WebView2: se ven IndexedDB y Web Locks entre ellos, y el candado se suelta si el proceso muere. Se verifica en T23, etapa 1.
- **S3.** IndexedDB con `durability: "strict"` sobrevive a cortar el proceso (T23).
- **S4.** El humo puede tirar la página con CDP (`Page.crash`) y abrir otra con el mismo perfil (T23).
- **S5.** `fileAssociations` anda con el instalador de Windows, y la ruta llega en los argumentos del proceso (T25).
- **S6.** El MSI de `0.1.4` reemplaza al de `0.1.4-alpha.N` (misma versión para MSI) gracias a `AllowDowngrades`. Se prueba en la fila 6 de la checklist.
- **S7.** El EPERM del humo al borrar el perfil temporal puede seguir pasando (T20).
- **S8.** `requestIdleCallback` puede no estar en WebKitGTK (T23 usa `setTimeout` de respaldo).

## 2. Criterio de pasaje (D5-A)
**Pasa cuando**, con un circuito cambiado y sin guardar:
1. Se corta Bornera sin cerrarla (Administrador de tareas › Finalizar tarea).
2. Al abrirla, ofrece recuperarlo.
3. Lo recuperado es idéntico a la última copia, con el título con «•» y Deshacer desactivado.
4. Si pasaron 10 s sin comandos antes del corte, no se pierde nada.

Cómo se prueba:
- **Test automático:** el humo `t23-autoguardado.mjs` corta la página con CDP (sin `beforeunload`), abre otra con el mismo perfil, recupera y compara el documento campo por campo.
- **Netbook:** filas 2 y 3 de la checklist, y F1 ≤ 50 ms.
- La compatibilidad del formato (D5-B) no es criterio de la fase: queda como test obligatorio de T22.

## 3. Decisiones

| # | Elegida | Qué |
|---|---|---|
| D1 | C sin Transformar | Lo de arquitectura (autoguardado, migraciones, corpus, `.brn.json`), más abrir recientes, asociar `.brn` (solo Windows) y la T suelta. |
| D2a | A | La copia va en IndexedDB del webview, con `durability: "strict"`. Un solo camino para el navegador y el escritorio, que el humo puede probar. |
| D2b | C | Con cambios sin copiar, la copia sale a los 10 s sin comandos o a los 60 s del primer cambio sin copia, lo que llegue antes. Nunca durante un gesto: va en `requestIdleCallback`, con `setTimeout` de respaldo. La copia es solo `serializar` más una escritura asíncrona, sin la prueba D22-B ni gzip. Las escenas del banco no se copian. |
| D2c | A | Al arrancar, el diálogo «Bornera no se cerró bien» con Recuperar y Descartar. Esc deja la decisión para el próximo arranque. Ver «Detalle de D2c» abajo. |
| D2d | B | Una copia por instancia (id al azar). La instancia viva se marca con Web Locks y se ofrecen solo las copias sin dueño. Si S2 falla: un latido cada 10 s, y la copia queda sin dueño a los 30 s. |
| D2e | A | La copia se borra al guardar bien, al cerrar sin cambios o con «No guardar», al pasar a otro documento con Nuevo o Abrir (después de «¿Guardar los cambios?») y con Descartar. Nunca sola al arrancar. |
| D3 | A | Migraciones ya: funciones puras sobre el JSON leído, entre las etapas 3 y 4 de `deserializar`, con un test 1 → 2 de prueba. `VERSION_FORMATO` sigue en 1. Más un corpus congelado (T22). |
| D4 | C | Ítem «Exportar sin comprimir (.brn.json)…». Escribe una copia aparte, sin cambiar el archivo actual ni la marca «•». El formato lo da la extensión: Ctrl+S sobre un `.brn.json` abierto lo escribe sin comprimir. Un componente o cable por línea. |
| D5 | A | Recuperar después de un corte (sección 2). |
| D6a | B | Factores ×3 para pasos sin dibujo y ×5,5 para gestos con dibujo. Se recalculan al cierre con la PC y la netbook el mismo día, para la fase 5. |
| D6b | C | Probar `willReadFrequently` en la PC: se queda si las corridas frías quedan como las calientes y las calientes no se mueven más de ±10 %. Si no, calentamiento. |
| D7 | A | Borrar un cable borra en el mismo comando los cables en T que cuelgan de él, recursivamente. Aviso «Se borraron también N cables en T»; Ctrl+Z los trae. |
| D8 | A | Alcance de fs `**/*.brn` y `**/*.brn.json` (y sus `.tmp`), sin dependencias. |

**Detalle de D2c:**
- Recuperar abre la copia con el nombre del archivo («Sin título» si no tenía), marcada «•» y con el historial vacío.
- Guardar pide dónde, con la ruta original sugerida.
- Si la copia no abre, muestra los problemas y ofrece exportarla tal cual.
- Con varias copias, el diálogo las lista.

**Descartadas:**
- D1-A, solo arquitectura: deja la 0.1.4 sin recientes ni doble clic.
- D1-B, conexiones aparentes y aviso de L: van antes de simular, en la fase 5.
- D2a-B, archivo en la carpeta de la app: sin humo y con más permisos.
- D2a-C, los dos: dos caminos.
- D2b-A, 60 s fijos: pierde hasta 60 s aunque se haya parado.
- D2b-B, a los 3 s: demasiadas copias con 2000.
- D2c-B, recuperar sin preguntar: no se nota que es una copia.
- D2c-C, aviso no modal: recuperar pisaría el trabajo nuevo.
- D2d-A, una sola copia: dos instancias se pisan.
- D2d-C, single-instance: dependencia nueva.
- D2e-B, guardar 7 días lo descartado: más interfaz; queda fuera.
- D3-B, esperar al primer cambio real: ese cambio cargaría con el diseño.
- D3-C, solo el corpus: no prueba convertir.
- D4-A, no escribir `.brn.json`: no sirve para Git.
- D4-B, tipo en «Guardar como»: extensión de dos puntos dudosa en el diálogo de Windows, y el humo no lo prueba.
- D5-B y D5-C: B ya es test de T22.
- D6a-A, ×5 para todo: afloja los pasos sin dibujo.
- D6a-C, calibración dedicada: la fase casi no tiene topes por factor.
- D6b-A sin probar: puede cambiar lo que mide el banco.
- D6b-B directo: alarga «Probar» sin saber si hace falta.
- D7-B, como hoy con aviso: la traba sigue.
- D7-C, preguntar: un diálogo en un gesto frecuente.
- D8-B, persisted-scope: dependencia nueva.
- D8-C, comandos Rust propios: T15a ya los descartó.

## 4. Tareas

### T20. Banco listo para la netbook (D6b-C)
- **Qué:**
  - `willReadFrequently` en `contexto()` de `tests/bench/escenarios.ts`, con la regla de D6b-C fijada antes de medir: «Probar la fase 3b» en la PC, 2 corridas frías y 2 calientes, antes y después.
  - La línea base de la PC de la fase en `docs/bench.md`.
  - **`bundle.windows.allowDowngrades: true` explícito** en `tauri.conf.json`.
  - Si S7 se reproduce: el humo informa la limpieza fallida sin cortar el resumen.
- **Pruebas:** banco y `cierre3b-probar.mjs`. Sin humo nuevo.
- **Modelo:** Opus alto.

**Regla de D6b-C** (Bruno, 2026-11-17, fijada antes de medir):
- **Cómo se mide:**
  - «Probar la fase 3b» en la PC: enchufada, en «Mejor rendimiento», con las apps cerradas.
  - El mismo build para antes y después (`tauri build --no-bundle`, exe sin instalar).
  - Antes y después se miden en la misma sesión, sin reiniciar la PC.
  - Cada vez se hacen 2 aperturas de la app. En cada apertura, la 1.ª corrida es fría y la 2.ª caliente.
  - Si una corrida da un valor raro (por ejemplo, por Windows Update), se repite y se anota.
- **Qué se compara:** el valor de cada fila B1–B16 de «Copiar». En las filas de cuadros cuentan el máx. y los lentos.
- **Piso de ruido:**
  - Una diferencia de ≤ 1 ms es igual.
  - Los lentos, ±1.
  - B9, el mismo escalón.
- **(a) Frías como calientes:** con `willReadFrequently`, cada corrida fría queda a ±10 % (o dentro del piso) de la mediana de las calientes.
  - Si en la medición «antes» la fría ya da como la caliente, la PC no reproduce el problema y (a) no decide nada. En ese caso decide solo (b). La prueba real de (a) es la netbook en C4.
- **(b) Las calientes no cambian:** la mediana de las calientes de después queda a ±10 % (o dentro del piso) de la de antes.
- **Resultado:**
  - Se queda si se cumplen (a) y (b), o solo (b) cuando (a) no decide.
  - Si no, se revierte y se hace una pasada de calentamiento, medida igual.
- **Resultado (2026-11-17):** no se queda. Falla (b): en caliente, B3, B6, B8, B11 y B16 suben entre 38 y 100 %. Detalle en `docs/bench.md`.
- **Pasada de calentamiento** (Bruno, 2026-11-17, fijada antes de medir):
  - Corre solo la 1.ª vez que se usa «Probar» después de abrir la app.
  - Recorre todos los escenarios B1–B16 sin medir, cada uno con **1 repetición** (más la de calentamiento propia del banco). Después viene la medición normal.
  - El encabezado dice «Con calentamiento (N s)». El banco y los escenarios no cambian.
  - Se juzga con la misma regla (a) contra el mismo exe «antes».
  - Si las frías no quedan como las calientes, se prueba la pasada entera (las repeticiones normales) y se anotan las dos.
- **Resultado del calentamiento (2026-11-17):** queda la **pasada entera**. Las dos pasadas tardan 13–14 s.
  - (a) **no pasa** con ninguna de las dos, por máximos sueltos de B1, B3 y B4.
  - La causa es conocida: esos máximos varían lo mismo entre corridas calientes. Por ejemplo, el máx. de B1 en caliente va de 46 a 57 ms.
  - Lo que se buscaba sí desaparece: B8, B15 y B16 en frío quedan como en caliente.
  - La prueba real es la netbook en C4. Detalle en `docs/bench.md`.
- **Regla de las frías en C4** (Bruno, 2026-11-17, fijada antes de medir en la netbook):
  - Una corrida fría pasa si cada fila queda dentro del rango de las calientes del mismo día (entre su mín. y su máx.), más un piso de 1 ms.
  - Los máximos sueltos no deciden solos.

### T21. Exportar sin comprimir `.brn.json` (D4-C)
- **Qué:**
  - La forma por líneas es **una función aparte** de `serializar`.
  - Exportar, con el formato según la extensión.
  - Abrir con los filtros `.brn` y `.brn.json`.
  - Capability `**/*.brn.json.tmp`.
- **Pruebas:**
  - **El `.brn` normal no cambia ni un byte:** el ejemplo del plan T15a sale idéntico y los sha256 del banco quedan iguales.
  - La forma por líneas es canónica, idempotente y vuelve igual.
  - Claves sin ñ ni tildes.
- **Humo `t21-exportar.mjs`:** la descarga `X.brn.json` abre igual; no cambia el archivo actual, la marca ni el historial; Ctrl+S sobre un `.brn.json` lo escribe sin comprimir.
- **Modelo:** Opus alto.
- **Hecho (2026-11-17), con D1 botón, D2 `*.brn.json -text`, D3 respetar `.brn.json` en Guardar como, D4 sin atajo, y los ajustes de Bruno:**
  - `66e2a9a` fija, solo y antes de tocar `serializar.ts`, el largo y el sha256 del `.brn` de las 4 escenas del banco (`banco-brn.test.ts`).
  - `serializarPorLineas` (`src/core/io/porLineas.ts`) usa los escritores de `serializar`. Quitando los `\n` da exactamente `serializar`. La forma exacta está en `docs/arquitectura.md`.
  - Exportar es un botón con el ícono `file-braces`: una copia que no toca `archivoActual`, la marca ni el historial, y respeta D22-B. Guardar empaqueta según el nombre del destino. Si el formato cambia en el diálogo, se escribe el documento validado del momento de la marca.
  - `conExtension`: en Exportar, `x`, `x.brn` y `x.json` pasan a `x.brn.json`. En Guardar y Guardar como, se respeta `.brn.json`.
  - Capability: `**/*.brn.json` y `**/*.brn.json.tmp` (adelanto de D8-A, aprobado). `archivosTauri.test.ts` comprueba, con los plugins de mentira, que el nombre corregido se escribe y entra en el alcance.
  - Resultados: 1891 tests, check sin errores, humo 771/771 (t21: 26). Sin banco.
  - **Sin prueba a mano en `tauri dev`:** Smart App Control de Windows quedó activado en la PC y bloquea las DLL de Rust recién compiladas (Code Integrity 3077, `phf_macros`). Bruno decidió no tocar la configuración de Windows. Lo que falta del diálogo nativo va en la fila 5b de la checklist de la netbook.
  - Pendiente (de T15a, no de T21): el alcance de fs distingue mayúsculas. Un nombre `X.BRN` da el temporal `X.BRN.tmp`, que queda fuera de `**/*.brn.tmp` (igual con `X.BRN.JSON`). Para T24.

### T22. Migraciones y corpus del formato (D3-A)
- **Qué:**
  - `src/core/io/migraciones.ts`.
  - Al abrir un formato viejo, el aviso «al guardarlo pasa al formato M».
  - El corpus `tests/circuitos/formato-v1/`, en `.brn.json`: todos los símbolos, rotaciones y espejos, T, libres, NC, textos raros y varias hojas.
- **Corpus congelado de verdad:**
  - Su script se corre **una sola vez**.
  - Ningún test lo regenera, y regenerarlo pide el OK de Bruno, como `inversion.brn`.
  - Se suma **un `.brn` real guardado por la `0.1.4-alpha.1` publicada** (gzip), no solo los generados por código.
- **Pruebas:**
  - Una migración 1 → 2 inyectada y una cadena 1 → 2 → 3.
  - El formato futuro se sigue rechazando.
  - Una migración que tira da error sin tirar.
  - Lo migrado pasa la validación estricta.
  - Cada archivo del corpus abre, es igual a su documento y se guarda igual.
- **Humo y banco:** no.
- **Modelo:** Opus xhigh (núcleo).

### T23. Autoguardado y recuperación (D2, D5-A)
- **Plan propio:** `docs/plan-T23.md` (Opus xhigh). Fija el esquema de IndexedDB, los relojes, los textos y la regla de F1 antes de medir.
- **Etapas:**
  1. Almacén (`src/ui/respaldo.ts`, con IndexedDB y una versión en memoria para los tests) y relojes (`src/ui/autoguardado.ts`). Verificar S2 y S3 con dos instancias instaladas.
  2. Diálogo de recuperar.
  3. Una copia por instancia y el borrado según D2e.
  4. Humo `t23-autoguardado.mjs`.
  5. Banco y prueba a mano en `tauri dev`.
- **Casos obligatorios:**
  - Documento sin nombre («Sin título» en el diálogo).
  - Si IndexedDB falla o no hay espacio: **un aviso, una vez, en la barra**, y la app sigue.
  - `requestIdleCallback` con `setTimeout` de respaldo.
  - Una copia que no abre.
  - Varias copias.
  - Las escenas del banco no se copian.
- **Humo:**
  - Cortar con CDP y recuperar idéntico.
  - Descartar.
  - Ninguna copia durante un gesto.
  - La copia se borra al guardar y al cerrar bien.
  - Dos páginas con el mismo perfil.
- **Banco:** escenario «Copia de recuperación con 2000 + 3030 cables», con la regla de F1.
- **Modelo:** plan Opus xhigh, código Opus alto, cierre Sonnet.

### T24. Alcance de archivos y Abrir recientes (D8-A)
- **Qué:**
  - Capability `**/*.brn` (`**/*.brn.json` ya lo sumó T21).
  - Temporales con extensión en mayúsculas (`X.BRN.tmp`) dentro del alcance (pendiente de T15a, ver T21).
  - `src/ui/recientes.ts`: hasta 8 en `localStorage`, con `try`. Los repetidos suben arriba, y las rutas se comparan sin distinguir mayúsculas.
  - Si un archivo ya no existe, aviso y se quita de la lista.
- **Pruebas:** unitarias de la lista. Humo: en el navegador (sin rutas) el menú no aparece.
- **A mano:** en `tauri dev` y en la netbook.
- **Modelo:** Opus alto.

### T25. Asociar `.brn` en Windows (solo Windows)
- **Qué:**
  - `bundle.fileAssociations` para `brn`.
  - Comando `archivo_inicial` en `lib.rs` con `std::env::args`, que reemplaza a `greet`.
  - Al arrancar, primero recuperar y después el archivo del argumento.
- **Pruebas:** unitaria de la elección del argumento. Sin humo (solo existe en el escritorio).
- **A mano:** solo con el instalador (S5).
- **Modelo:** Opus alto.

### T26. Borrar un cable con T colgando (D7-A)
- **Qué:** la cascada en el comando de borrar (núcleo) y el aviso en la barra.
- **Pruebas:**
  - Cascada de varios niveles.
  - Deshacer y rehacer devuelven los ids y el orden.
  - Sin ciclos de apoyos.
  - Borrar a la vez el anfitrión y uno en T.
  - Las uniones y las referencias quedan al día.
- **Humo `t26-borrar-t.mjs`:** el paso 3 de la hoja 2 con un clic y Supr, y Ctrl+Z.
- **Banco:** B16 contra el commit anterior.
- **Modelo:** Opus xhigh (núcleo).

### T27. Etiquetado de pulsadores desde S0 (Bruno, 2026-11-17)
- **Qué:** última tarea antes del cierre.
  - Los pulsadores NC se numeran desde S0 (parada) y los NA desde S1.
  - K y H siguen numerándose desde 1.
- **Pruebas:**
  - Ajustar los tests de T17 y los humos que esperan S1.
  - Los `.brn` congelados no cambian.
- **Modelo:** Opus alto.

## 5. Topes

| # | Qué | PC | Netbook | Origen |
|---|---|---|---|---|
| F1 | Copia de recuperación con 2000 + 3030 cables: **máximo** de la parte síncrona | ≤ 9 ms en WebView2 (regla abajo) | ≤ 50 ms | 0.1.2 (ningún cuadro > 50 ms) y D6a |
| F2 | Guardar 2000, sin el diálogo | ≤ 1 s | ≤ 1 s | D20 |
| F3 | Abrir 2000, hasta el primer cuadro | ≤ 1 s | ≤ 1 s | D20 |
| B1–B16 | Filas de la 3b, sin cambios (no regresión) | las de la 3b | las de la 3b (B10 informativa) | cierre 3b |
| K1, K2 | Factor netbook / PC: pasos sin dibujo / gestos con dibujo | — | se anota | D6a-B |

**Regla de F1** (Bruno, 2026-11-17, fijada antes de medir):
- El tope de la netbook es sobre el máximo.
- En Node, `serializar` da 13,2 ms de máximo, que por ×5,5 son ~73 ms: no pasaría.
- Por eso, **si en WebView2 de la PC el máximo de la copia pasa de 9 ms (50 / 5,5), T23 hace `serializar` por partes o con caché por objeto antes de ir a la netbook.**

## 6. Cierre de la fase 4

| Etapa | Qué | Modelo |
|---|---|---|
| C1 | «Probar la fase 4» en el menú de desarrollo: «Probar la fase 3b» más F1, F2, F3, K1 y K2, con «Copiar» | Opus alto |
| C2 | `docs/netbook-fase4.md`: una hoja, la checklist de abajo | Sonnet |
| C3 | `0.1.4-alpha.N` con la skill `bornera-release`. Tag y push con autorización | Opus alto |
| C4 | Netbook (Bruno), y «Probar la fase 4» en la PC el mismo día para K1 y K2. Yo paso los números. Las frías se juzgan con la regla de C4 (T20) | Sonnet |
| C5 | `0.1.4`: probar lo que se publica. Ver los pasos abajo | Opus alto |
| C6 | Docs (arquitectura: fase 4 cerrada y factores para la fase 5) y Obsidian | Sonnet |

**Pasos de C5:**
1. Commit de versión `0.1.4`.
2. **Con autorización escrita de Bruno**, push del tag `v0.1.4`. `release.yml` arma el borrador, que no es público.
3. Se baja el instalador del borrador y se prueba en la netbook (fila 6).
4. Si pasa, Bruno publica el borrador. Si falla, se borran el tag (local y remoto) y el borrador, con el OK de Bruno.

**Checklist de la netbook** (una hoja). **Regla:** la `0.1.4` se instala con el mismo tipo de instalador que la alpha instalada. Mezclar MSI y NSIS deja dos «Bornera». `release.yml` arma solo el `.msi`, así que los pasos 0 y 6 usan el `.msi`. Bruno confirma que la alpha.1 se instaló con el `.msi`.

| # | Paso | Pasa si |
|---|---|---|
| 0 | Enchufada, en «Mejor rendimiento». Instalar el `.msi` de `0.1.4-alpha.N` encima de la alpha.1 | Una sola «Bornera», versión alpha.N |
| 1 | Menú de desarrollo › «Probar la fase 4», 3 veces seguidas, con «Copiar» cada vez | Las filas con tope pasan (mediana de las 3) |
| 2 | Abrir `marcha-parada.brn`, arrastrar S1 dos unidades a la derecha y esperar 15 s sin tocar nada. Administrador de tareas › Bornera › Finalizar tarea. Abrir Bornera › **Recuperar** | S1 corrido, título con «•», Deshacer desactivado |
| 3 | Repetir el paso 2 hasta Finalizar tarea. Abrir › **Descartar**. Cerrar y volver a abrir | No vuelve a preguntar |
| 4 | Explorador: doble clic en `marcha-parada.brn` | Bornera abre con ese archivo |
| 5 | «Abrir reciente» › `marcha-parada.brn` | Abre |
| 5b | T21 (no se probó a mano en la PC). «Exportar sin comprimir (.brn.json)…» cuatro veces, escribiendo en el diálogo `x`, `x.brn`, `x.json` y `x.brn.json`. Guardar como, escribiendo `x.brn.json`. Abrir ese `x.brn.json`, mover algo y Ctrl+S | Las cuatro exportaciones dejan `x.brn.json` (nunca `x.brn.json.brn`, `x.brn.brn.json` ni `x.json`) y sin «permiso». Guardar como no deja `x.brn.json.brn`. Abrir muestra los `.brn.json`; Ctrl+S quita la «•» y el archivo tiene un componente por línea (Bloc de notas) |
| 6 | Instalar el `.msi` de `0.1.4` (del borrador) encima de la alpha.N, sin desinstalar | Una sola «Bornera», versión 0.1.4, la lista de recientes sigue |

## 7. Riesgos
- **F1 no pasa en la PC:** `serializar` por partes (vuelve a empezar si el historial cambia en el medio) o caché por objeto, antes de la netbook.
- **S2 falla:** queda el latido. Single-instance sería una dependencia, a decidir con Bruno.
- **Una copia que no abre** (el editor deja colocar fuera de ±10 000, pendiente de T15a): se muestran los problemas y se ofrece exportarla tal cual.
- **S6 falla** (el MSI no reemplaza la alpha): se frena antes de publicar el borrador y se decide con Bruno.
- **La asociación de archivos** solo se prueba con la app instalada.
- **`csp: null` con el alcance amplio de D8:** no hay una vía conocida de inyección (lienzo y textos escapados por Svelte). La CSP queda como tarea aparte.
- **La cascada de T26 borra de más:** se ve en el aviso y se deshace con Ctrl+Z.
- **WebKitGTK (Mint):** secundario, no bloquea (S8).
- **Smart App Control en la PC (2026-11-17):** está activado y bloquea las DLL de Rust que se compilan, así que `tauri dev` no compila. T23 (S2, S3 y F1 en WebView2), T24 (a mano en `tauri dev`) y T25 lo necesitan. Desactivarlo no tiene vuelta atrás sin restablecer Windows: lo decide Bruno.

## 8. Fuera de la fase 4
- **Fase 5, antes de simular:** conexiones aparentes, etiquetas de red en la netlist y aviso de L con L1, L2 o L3.
- **Fase 6:** fuentes trifásicas.
- **Asociar `.brn` en Linux** (`.deb` y AppImage, tipo MIME): T25 es solo para Windows.
- **Tareas aparte, sin fecha:**
  - Transformar re-rutea al rehacer.
  - Número de orden de los auxiliares (probable primera migración real).
  - Cajas descentradas.
  - `referencias.reflejar`.
  - Optimizar *Encuadrar (F)*.
  - CSP.
  - «Copias recientes» (D2e-B).
  - PLC como símbolo (`docs/ideas.md`).
- **Descartado por dependencias:** single-instance y persisted-scope, salvo pedido de Bruno.

## 9. Necesita autorización de Bruno
- Push de `main`.
- Tags `v0.1.4-alpha.N` y su push.
- Tag `v0.1.4` y su push (con autorización escrita), publicar el borrador, y borrar el tag o el borrador si falla.
- Cualquier dependencia nueva. No se espera ninguna.

## Etapa 0 (docs) — hecha el 2026-11-17
Este plan, `docs/arquitectura.md` (fase 4 y formato), la skill `bornera-inicio`, la fila 7 de `docs/plan-cierre-3b.md`, `docs/ideas.md` y Obsidian. Commit local, sin push.
