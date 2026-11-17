# Plan T23 — Autoguardado y recuperación (D2, D5-A)

**Aprobado por Bruno el 2026-11-17** con D1–D7 en la opción A (recomendadas) y 3 ajustes, ya incorporados abajo:
1. **F1 primero.** F1 se mide al principio de la etapa 1, con el exe de release y un arnés mínimo (`serializar` + `put`), antes de los relojes y el diálogo. Si pasa de 9 ms, la 1b va antes que el resto (etapa 1a).
2. **Dos caminos para la 1b, antes de programar:** (a) serializar por partes, cediendo cada N objetos y empezando de nuevo si cambia el historial; (b) caché del texto por objeto (`WeakMap` objeto → línea, con los escritores de `serializarPorLineas`), que solo sirve si el modelo es inmutable. Primero se verifica si lo es.
3. **«Finalizar tarea» se hace sobre la app Bornera**, no sobre los procesos «Microsoft Edge WebView2», en la prueba a mano y en la checklist. Se anota qué pasa con la segunda instancia al cortar la primera.

Sale de `docs/plan-fase4.md` (T23, D2a–D2e, D5-A, F1 y sección 7). Fija el esquema de IndexedDB, los relojes, los textos y la regla de F1 antes de medir.

## 0. Estado verificado

- `main` en `32c32b4`, árbol limpio, 10 commits sin push.
- **`npm run tauri dev` compila y abre** (Smart App Control desactivado): cargo terminó (`Finished dev`) y `bornera.exe` abrió la ventana con el título «Sin título.brn — Bornera», que pone el JS de la app. El único error de la consola fue la recarga de Vite al optimizar dependencias (`Failed to fetch dynamically imported module`), el mismo que el humo ya saltea en `calentar`. Después el proceso terminó solo, con código 0.
- Perfil de WebView2: `%LOCALAPPDATA%\com.bornera.app`, el mismo para `tauri dev`, el exe de release y la app instalada. El origen cambia: `http://localhost:1420` en desarrollo y `http://tauri.localhost` en release. IndexedDB y Web Locks van por origen, así que las copias de desarrollo y las de la app instalada no se ven entre sí.

**En el código (leído hoy):**
- Los avisos del `Editor` (`alCambiarHistorial`…) tienen **un solo oyente**, que pone el `Lienzo`. Mientras se ve una escena del banco, el editor del documento queda desconectado. `Lienzo.historial()` solo actualiza `modificado` si el editor es el del documento.
- `Editor.cambios` sube con cada comando, deshacer y rehacer. `Editor.modificado` viene de la marca del `Historial` (comando de arriba de la pila).
- `Editor.enGesto` cubre el rectángulo, el arrastre de la selección, el arrastre desde la paleta y el gesto de la herramienta cable. **No** cubre la previa de pegar (`pegando`), colocar en modo clic (previa flotante) ni el tramo de cable en curso (`enTramo`).
- `documentoNuevo()` tiene `meta.titulo = "Sin título"`, y `nombreDocumento` da «Sin título.brn».
- Guardar sin archivo actual llama `elegirDestino(sugerido)`. En Tauri, `sugerido` va a `save({ defaultPath })`.
- El humo usa **un solo Chrome, un perfil y una pestaña** para todas las pruebas, con 60 s de límite por prueba.
- El menú de desarrollo se ve en desarrollo y en las prereleases. El exe de release de `0.1.4-alpha.1` lo muestra.

**Supuesto (no verificado):** WebView2 trata a `tauri.localhost` como contexto seguro. `navigator.locks` lo necesita. Se ve en la etapa 1 con el exe de release.

## 1. Decisiones (elegidas: todas A)

| # | Elegida | Descartada |
|---|---|---|
| D1 | **A.** No se copia durante un gesto, con la previa de pegar abierta, colocando en modo clic, con un tramo de cable en curso ni mientras corre «Probar» o el diagnóstico del arrastre. Las previas siguen al mouse y una pausa de 10–50 ms se nota; «Probar» mide cuadros. | B. Solo gestos y la previa de pegar, como dice el pedido. |
| D2 | **A.** Si `modificado` pasa a falso (se deshizo hasta lo guardado), se borra la copia. Si no, se ofrecería recuperar lo mismo que ya está en el archivo. | B. Solo los borrados de D2e. |
| D3 | **A.** Con varias copias, una fila por copia, cada una con Recuperar y Descartar. Recuperar una cierra el diálogo, y las demás quedan para el próximo arranque. | B. Elegir una (radio) y dos botones abajo. |
| D4 | **A.** S2 y S3 en la etapa 1 con dos lugares: `tauri dev` más un segundo `target\debug\bornera.exe`, y el exe de release (`npm run tauri build -- --no-bundle`) abierto dos veces, sin instalar. El de release usa el origen real (`tauri.localhost`) y el mismo perfil que la instalada. | B. Instalar el MSI, como decía el plan de fase: más lento y pisa la alpha.1 instalada. |
| D5 | **A.** F1 cuenta la primera copia de cada proceso (fría). Ver la sección 6. | B. Con 2 copias de calentamiento: más fácil de pasar, pero la fría es la que se nota. |
| D6 | **A.** En el humo, los relojes reales de 10 s solo en el caso del criterio D5-A. Los demás casos usan `bornera.autoguardado.copiarYa()` (solo en desarrollo), que pasa por el mismo camino (ocio y «ocupado») sin esperar los relojes. Los relojes se prueban en las unitarias, con reloj falso. Así `t23` entra en los 60 s. | B. Relojes reales en todo, repartido en varios `t23*-*.mjs`. |
| D7 | **A.** Recuperar arma el `Historial` con `{ modificado: true }`: la marca apunta a un centinela que nunca está en la pila. Toca el núcleo, con 4 líneas y un test. | B. Una bandera `recuperado` en el `Editor`, fuera del núcleo, que se apaga en `marcarGuardado`. |

## 2. Esquema de IndexedDB (fijo)

- Base `bornera`, versión 1, almacén `copias` con `keyPath: "id"`.
- Una copia por instancia. El `id` es el de la instancia: `crypto.randomUUID()` al arrancar, o un respaldo con `Math.random` si no está.
- **Registro** (`esquema: 1`):

| Campo | Tipo | Qué |
|---|---|---|
| `id` | string | Instancia dueña |
| `esquema` | 1 | Versión del registro (no es la del formato `.brn`) |
| `texto` | string | `serializar(documento)`: formato `.brn` en una línea, sin gzip y sin la prueba D22-B (D2b) |
| `archivo` | `{ nombre, ruta } \| null` | Archivo actual al copiar; `ruta` es null en el navegador |
| `titulo` | string | `meta.titulo`, para nombrar una copia sin archivo |
| `componentes` | number | Componentes de todas las hojas, para distinguir copias en la lista |
| `fecha` | number | `Date.now()` de la copia |
| `version` | string | Versión de Bornera que la escribió |

- Escritura: `transaction("copias", "readwrite", { durability: "strict" })` y `put`. La copia se da por hecha con `complete`.
- La conexión se abre una vez al arrancar y queda abierta. Con `onversionchange` (una versión futura sube el esquema), se cierra y la instancia deja de copiar, con el aviso único.
- **Dueño (D2d-B):** la instancia toma `navigator.locks.request("bornera-copia-<id>")` al arrancar y no lo suelta nunca. Una copia está «sin dueño» si `request(…, { ifAvailable: true })` consigue su candado. La instancia que la ofrece **retiene ese candado** mientras el diálogo está abierto, así otra instancia que arranca en ese momento no la ofrece también. Con Esc o al decidir, lo suelta.
- **Si S2 falla** (latido, D2d-B): se suma el almacén `latidos` (`{ id, ultimo }`) en la misma versión 1, porque nada salió publicado. Se escribe cada 10 s y una copia queda sin dueño a los 30 s sin latido.
- No se pide `navigator.storage.persist()`: la copia vive minutos. Si el disco se llena, sale el aviso de espacio.

## 3. Relojes (D2b-C, fijos)

- Al llegar un cambio (sube `cambios`): si no había cambios sin copiar, `pendienteDesde = ahora`. Un solo `setTimeout`, que se rearma a `min(ultimoCambio + 10 s, pendienteDesde + 60 s)`.
- Al vencer, se pide ocio: `requestIdleCallback(copiar, { timeout: 1000 })` o, si no existe (WebKitGTK, S8), `setTimeout(copiar, 0)`. El `timeout` hace que la copia salga aunque la ventana esté oculta.
- Si al entrar está «ocupado» (D1), se vuelve a mirar en 1 s. Ese reintento corre solo mientras hay cambios sin copiar y algo ocupado. No hay bucle sin cambios.
- **Parte síncrona:** `serializar` + `transaction` + `put`. En ese mismo instante, `copiado = cambios` y `pendienteDesde = null`. Lo que cambie durante la escritura arranca otro ciclo.
- Sin cambios sin copiar no corre ningún reloj.
- Solo se copia el editor del documento. Las escenas del banco y el editor de «Probar» no se copian nunca.

## 4. Cuándo se borra (D2e) y cuándo no se copia

**Se borra la copia propia:**
- Al guardar bien, si quedó sin cambios.
- Cuando `modificado` pasa a falso (D2-A).
- Al reemplazar el documento con Nuevo o Abrir, después de «¿Guardar los cambios?».
- Al cerrar la ventana cuando `antesDeCerrar` da verdadero (sin cambios, «No guardar» o guardado). Se espera hasta 1 s antes de `destroy`, para que un IndexedDB colgado no trabe el cierre.
- **Nunca sola al arrancar.**

**Copias ajenas:** Descartar borra esa. Recuperar la **adopta**: en una sola transacción escribe el mismo `texto` con el `id` propio y borra el viejo, sin volver a serializar. Si se cortara justo después, la copia sigue estando.

**Orden:** IndexedDB ejecuta las transacciones `readwrite` de un mismo almacén en el orden en que se crean. Un borrado pedido después de una copia en curso queda después. Y la copia, al entrar, mira `modificado`: si ya se guardó, no escribe.

**En el navegador** (`npm run dev` y el humo) no hay cierre de ventana. Si se deja la página con cambios aceptando `beforeunload`, la copia queda y se ofrece al volver. Se acepta, porque es solo desarrollo.

## 5. Textos (fijos)

**Diálogo al arrancar** (modal, como los de archivo):
- Título: **«Bornera no se cerró bien»**.
- Con una copia: «Quedó una copia de recuperación de **marcha-parada.brn**, de hoy a las 11:32.» Botones **Recuperar** (el principal) y **Descartar**. Abajo: «Esc: decidir la próxima vez».
- Con varias (D3-A): «Quedaron 2 copias de recuperación:» y una fila por copia, la más nueva primero: «**marcha-parada.brn** · hoy 11:32 · 42 componentes», con [Recuperar] [Descartar].
- Sin archivo: el título del documento sin extensión, **«Sin título»** en uno nuevo, y «· nunca se guardó».
- Fechas: «hoy a las 11:32», «ayer a las 18:05», «el 12/11 a las 09:40».

**Copia que no abre:** título **«No se pudo recuperar»**, la lista de `lineasProblemas` y los botones **Exportar tal cual…** (escribe el `texto` crudo a un `.brn.json` elegido, sin validar), **Descartar** y **Cerrar** (Esc: queda para el próximo arranque).

**Barra de estado:**
- «Recuperado» (y « en N ms» donde Abrir dice el tiempo, D20).
- «Copia descartada».
- Fallo, **una vez por sesión**: «No se pudo hacer la copia de recuperación: no hay espacio en el disco» (`QuotaExceededError`), o el mensaje del error, o «IndexedDB no está disponible».
  - Fallo al escribir: reintenta con los mismos relojes, sin más avisos.
  - Fallo al abrir la base: el autoguardado se apaga hasta reiniciar.
- Las copias que salen bien no avisan nada.

**Después de Recuperar:**
- Título «• marcha-parada.brn — Bornera» (o «• Sin título.brn — Bornera»), Deshacer desactivado y el historial vacío.
- Sin archivo actual: Guardar pregunta dónde, sugiriendo la ruta original (D2c).

## 6. Regla de F1 (fijada antes de medir)

- **F1 = máximo de la parte síncrona de la copia** (sección 3) con la escena de 2000 + 3030 cables, **en WebView2 de la PC**.
- **Herramienta:** menú de desarrollo › «Medir la copia (F1)». Hace 20 copias de esa escena, en memoria y sin tocar el documento, a una clave `medicion-<id>` que borra al final. Hay una por tarea, con ocio entre ellas. Muestra mediana, máximo y la primera, con «Copiar». Vive en `src/ui/medirCopia.ts` para que C1 la reuse. Se hace primero, en la etapa 1a (ajuste 1).
- **Cómo se mide:** con el exe de release, 3 aperturas, intercalando con el de desarrollo si hay que comparar. La PC varía de 24 a 36 ms entre procesos (T22). La primera copia de cada proceso cuenta (D5-A). **F1 = el mayor de las 60.**
- **Pasa si F1 ≤ 9 ms.** Si pasa de 9 ms, viene la etapa 1b antes de seguir, y en todo caso antes de la netbook.
- **Expectativa:** en Node, `serializar` dio 13,2 ms de máximo (fase 4, sección 1). **Lo más probable es que no pase y haga falta la 1b.**
- En la netbook (cierre de la fase), F1 ≤ 50 ms con «Probar la fase 4».

## 7. Etapas

Cada etapa cierra con `npm test`, `npm run check` y un commit local. El humo entero va en la 2 (por el cambio en `correr.mjs`) y al cerrar.

### Etapa 1a — F1 primero (ajuste 1, Opus alto)
- Arnés mínimo en `src/ui/medirCopia.ts`: la parte síncrona de la copia (`serializar` + `transaction` + `put`) con el esquema de la sección 2, 20 veces, cada una en su tarea. Mide por separado `serializar` y `put`.
- Menú de desarrollo › «Medir la copia (F1)», con el resultado en `DialogoDiagnostico` y «Copiar».
- Exe de release con `npm run tauri build -- --no-bundle`, sin instalar. Se abre 3 veces y se mide F1 (sección 6).
- Si F1 ≤ 9 ms, sigue la etapa 1. Si no, se verifica si el modelo es inmutable y se le proponen a Bruno los dos caminos de la 1b (ajuste 2), antes de programar.
- **Hecho (2026-11-17): F1 = 25,1 ms, no pasa.**
  - Se midió con `node tests/bench/f1-webview2.mjs` (nuevo): abre el exe de release con el puerto de depuración de WebView2 (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`), toca «Medir la copia (F1)», lee el diálogo y corta el proceso.
  - Fueron 2 tandas de 3 procesos, 120 copias en total, con Edg/157.0.0.0 y un texto de 653 364 caracteres.

    | Por proceso | Mediana | Máx. |
    |---|---|---|
    | `serializar` | 9,3–11,5 ms | 11,7–15,7 ms |
    | Registro y `put` | 2,2–2,4 ms | 3,7–7,2 ms |
    | Parte síncrona | 11,7–14,4 ms | 16,4–25,1 ms |

  - **S1 se cumple más o menos:** en Node, `serializar` dio 9,3 ms de mediana y 13,2 ms de máximo.
  - **El `put` solo ya se lleva 2–7 ms.** Un diagnóstico aparte en WebView2 (2 procesos, 20 vueltas, borrado después) midió la parte síncrona del `put` según lo que se guarda:

    | Qué se guarda | Mediana | Máx. |
    |---|---|---|
    | Un string plano de 653 K | 0,8–1,3 ms | 1,5–2,5 ms |
    | 8 strings de 82 K, en 8 `put` de una transacción | 0,8–1,0 ms | 1,8–2,0 ms |
    | Un string de 82 K | 0,2 ms | 0,3–0,5 ms |
    | `Blob` | 1,9–2,1 ms | 2,7–4,5 ms |
    | `Uint8Array` | 2,4–2,9 ms | 2,9–3,7 ms |

    El texto real cuesta más que el plano porque `serializar` lo arma con una plantilla (`{…}` alrededor del `join`): queda una cadena «cons», y el clon la aplana dentro del `put`.
  - **El modelo no es inmutable** (ajuste 2): los comandos cambian los objetos en su lugar.
    - `Mover`, `Rotar` y `Espejar` hacen `Object.assign(componente, pose)` y reasignan `desde`, `hasta` y `codos` del mismo cable (`comandos.ts:256-261` y `282-291`).
    - `CambiarEtiqueta` y `Etiquetar` asignan `c.etiqueta` (`comandos.ts:686`, `748` y `757`).
    - Un `WeakMap` por identidad daría líneas viejas. Lo que sí hay: cada comando devuelve un `Cambio` con los ids de los componentes y cables que tocó.

#### Propuesta para la 1b (ajuste 2, para que elija Bruno)

| | (a) Por partes | (b) Caché por objeto |
|---|---|---|
| Cómo | `serializarPorPartes(doc)` en `src/core/io`: un generador que da el mismo texto que `serializar` en trozos. Cada tarea de ocio escribe trozos hasta ~3 ms y cede. Si `cambios` sube entre tareas, vuelve a empezar. El registro guarda `partes: string[]` en lugar de un `texto` (el esquema 1 todavía no salió), y recuperar las une con `join("")`. | Con el modelo mutable, el `WeakMap` por identidad no sirve. La variante posible es una caché **por id**, que se invalida con los ids del `Cambio` de cada comando, deshacer y rehacer. La copia vuelve a escribir solo lo tocado, une las ~5000 líneas y hace un `put`. |
| F1 esperado en la PC | El mayor entre un trozo (~3 ms, se ajusta) y el `put` final de las partes (~1–2 ms): **~3–5 ms**, más lo que meta el recolector de memoria. | Con caché llena, unir más el `put`: **~3–4 ms**. Pero la primera copia después de abrir, recuperar o «Mover todo» vuelve a escribir todo (~10–16 ms): **no pasa** sin calentar la caché por partes, o sea sin (a). |
| Riesgo | Bajo: el texto se compara entero contra `serializar`. Volver a empezar es raro (en el ocio no hay entradas). | Un `Cambio` al que le falte un id deja una línea vieja en la copia, **sin aviso**. Los contadores y `meta` cambian fuera de los comandos (se escriben siempre). Además, el autoguardado tiene que recibir cada `Cambio` del editor. |
| Toca | `src/core/io` (nuevo) y la copia. | El núcleo, el editor (un oyente más de los cambios) y la copia. |
| Tests | Igual a `serializar` en los 8 `documentosDePrueba`, el banco de 2000 + cables y las mutaciones al azar, con varios tamaños de trozo. | Lo mismo, después de **cada** comando, deshacer y rehacer de las mutaciones al azar. |
| Netbook (×5,5) | Trozo de ~3 ms → ~17 ms. Se puede achicar. | Copia llena ~20 ms, pero la primera ~70–90 ms. |

**Recomendada: (a)**, con el registro en `partes`. Alcanza sola, es la de menos riesgo y no depende de que todos los comandos informen bien sus ids. (b) queda para después, si la netbook lo pidiera. Hacer el modelo inmutable para usar el `WeakMap` sería una refactorización del núcleo y del editor (los índices guardan referencias a los objetos), fuera de T23.

### Etapa 1 — Almacén, candados, relojes y verificación (Opus alto)
- `src/ui/respaldo.ts`:
  - Interfaz `Almacen` (`abrir`, `listar`, `escribir`, `borrar`, `adoptar`), con `almacenIndexedDB()` y `almacenMemoria()` para los tests.
  - Interfaz `Candados` (`tomarPropio`, `probarAjeno`), con `candadosWebLocks()` y `candadosMemoria()`.
  - `motivoFallo(e)`.
  - `listar` saltea y borra los registros `medicion-…` que hayan quedado de «Medir la copia (F1)» (por ejemplo, si se cortó a la mitad): nunca se ofrecen para recuperar.
- `src/ui/autoguardado.ts`:
  - Clase `Autoguardado` con todo inyectado: reloj, ocio, «ocupado», el editor del documento, almacén y avisar.
  - Métodos `alCambiar()`, `documentoNuevo()`, `cerrar()` y `copiarYa()` (desarrollo).
  - `programarOcio()`.
- Conexión:
  - `Lienzo` suma `oncambiodocumento`, que se llama desde `historial()` cuando el editor es el del documento.
  - `Ventana` crea el autoguardado y le da «ocupado» según D1.
- En desarrollo, `bornera.respaldo` y `bornera.autoguardado` (cuenta de copias hechas, última en ms).
- Menú de desarrollo: «Copias de recuperación» (lista: id corto, propia, con dueño o sin dueño, nombre, fecha y tamaño, en `DialogoDiagnostico`) y «Medir la copia (F1)».
- **Verificación a mano, antes de seguir** (yo preparo, Bruno corta procesos). «Finalizar tarea» siempre sobre la app **Bornera** del Administrador de tareas, nunca sobre los procesos «Microsoft Edge WebView2» (ajuste 3):
  - **S2**, en los dos lugares de D4:
    - A modifica y copia.
    - B arranca y ve la copia de A como «con dueño».
    - Finalizar tarea sobre B; A ve la copia de B «sin dueño».
    - Al revés: cortar la primera instancia y **anotar qué pasa con la segunda**: si sigue viva y editable, si queda en blanco o si se cierra. Comparten el proceso de WebView2. Va al resultado de la etapa y a la checklist de la netbook.
  - **S3:** cambiar, esperar la copia, Finalizar tarea, reabrir: la copia está e igual. Una vez cortando enseguida de «copia hecha».
  - **F1** con la herramienta (sección 6).
- **Si S2 falla:** latido (D2d-B) en la etapa 3.
- **Si F1 > 9 ms:** etapa 1b.

### Etapa 1b — Solo si F1 > 9 ms (Opus xhigh, núcleo)
Va antes que el resto de la etapa 1 (ajuste 1). Antes de programar, se le proponen a Bruno dos caminos (ajuste 2), después de verificar si el modelo es inmutable:
- **(a) Por partes:** `serializarPorPartes(doc)` en `src/core/io`, un generador que devuelve el mismo texto que `serializar`, byte a byte. Cede cada N objetos. La copia corre las partes en ocios sucesivos y, si `cambios` sube en el medio, vuelve a empezar (fase 4, sección 7).
- **(b) Caché por objeto:** un `WeakMap` objeto → texto con los escritores de cada objeto (los de `serializar`, que también usa `serializarPorLineas`). La copia solo vuelve a escribir lo que cambió. Solo vale si los comandos reemplazan los componentes y cables en lugar de cambiarlos en su lugar.
- **Tests:** el texto es igual al de `serializar` en los 8 `documentosDePrueba`, el banco de 2000 + cables y las mutaciones al azar. En (b), también después de cada comando, deshacer y rehacer.
- **Medición:**
  - Una fila nueva en `abrir-node.mjs`, intercalada con `serializar`.
  - Repetir F1 en WebView2.

### Etapa 2 — Diálogo de recuperar (Opus alto)
- `src/ui/recuperar.ts`, puro:
  - `copiasSinDueno`, `nombreVisible` y `fechaVisible`.
  - `recuperar(registro)`, que da el documento con sus avisos o los problemas.
- `DialogoRecuperar.svelte` con los textos de la sección 5.
- D7: `Historial` con `{ modificado: true }`, pasado por el `Editor`.
- `OperacionesArchivo` suma `sugerido` (nombre y ruta originales): el título lo usa, Guardar pregunta dónde con esa ruta, y se limpia al guardar, Abrir o Nuevo.
- Recuperar adopta la copia. Una copia que no abre muestra los problemas y ofrece Exportar tal cual.
- `tests/humo/correr.mjs`:
  - Antes de cada prueba, `about:blank` y `Storage.clearDataForOrigin` (indexeddb), para que una copia de una prueba no abra el diálogo en la siguiente.
  - Les pasa a las pruebas `nuevaPestana()`.

### Etapa 3 — Una copia por instancia y los borrados de D2e (Opus alto)
- Solo se ofrecen copias sin dueño, reteniendo su candado mientras se decide.
- Los borrados de la sección 4, incluido `cerrar()` en `onCloseRequested`.
- Latido, si S2 falló.

### Etapa 4 — Humo `t23-autoguardado.mjs` (Opus alto)
- **Primero S4:** `Page.crash` y volver a navegar la misma pestaña (u otra) con el mismo perfil. Si no anda, `t23` mata ese Chrome y abre otro con el mismo perfil.
- **Casos:**
  1. **Criterio D5-A con relojes reales:**
     - Colocar y cablear, y esperar 11 s sin tocar.
     - `Page.crash` (sin `beforeunload`) y reabrir.
     - Sale el diálogo con «Sin título».
     - Recuperar: el documento es igual campo por campo, el título empieza con «• » y Deshacer está desactivado.
  2. **Descartar:** el diálogo no vuelve y no queda ninguna copia.
  3. **Esc:** el diálogo cierra y vuelve al recargar.
  4. **Ninguna copia durante:**
     - Un arrastre a medias: `copiarYa`, no sube la cuenta, y al soltar sí.
     - La previa de pegar abierta: igual, hasta Esc.
     - Colocando en modo clic y con un tramo de cable (D1-A).
  5. **Se borra:** guardar (descarga) y Nuevo con «No guardar» borran la copia.
  6. **Dos pestañas, mismo perfil:**
     - A copia y B abre sin diálogo.
     - Se corta A, abre C y ofrece la copia de A.
  7. **Varias copias:** dos cortadas, el diálogo lista dos. Una copia rota da «No se pudo recuperar».
  8. **Banco:** editar en una escena del banco y `copiarYa` no escribe nada.
- Cerrar la ventana solo existe en el escritorio: va en las unitarias y a mano (etapa 5).

### Etapa 5 — Banco y prueba a mano (Opus alto)
- **Banco:** el escenario «Copia de recuperación con 2000 + 3030 cables» en `tests/bench`. En Chrome es informativo; F1 se juzga en WebView2. No hay filas B que cambien: T23 no toca el dibujo.
- **F1 final** en WebView2 (sección 6), con el código final.
- **A mano en `tauri dev`:**
  - El criterio D5-A con Finalizar tarea sobre la app Bornera (filas 2 y 3 de la checklist de la fase, que suman la aclaración del ajuste 3).
  - Cerrar con «No guardar» borra la copia.
  - Recuperar y Guardar sugiere la ruta original.

**Cierre:** skill `bornera-cierre` (Sonnet), con el humo entero y las líneas «Hecho» en `plan-fase4.md`.

## 8. Tests unitarios (Vitest, sin DOM)

- **`autoguardado.test.ts`**, con reloj falso, ocio falso y almacén en memoria:
  - Relojes:
    - Copia a los 10 s sin comandos.
    - Copia a los 60 s con comandos cada 5 s.
    - Sin cambios no corre ningún reloj.
    - Cambios durante la escritura arrancan otro ciclo.
  - Ocio y «ocupado»:
    - Ocupado espera y reintenta a 1 s.
    - Sin `requestIdleCallback` usa `setTimeout`.
  - Borrados:
    - `modificado` falso borra la copia (D2).
    - Guardar, Nuevo, Abrir y cerrar borran la copia.
    - Una copia que empezó y después se guardó no escribe.
  - Fallos:
    - Al escribir: un aviso y sigue.
    - Al abrir: un aviso y se apaga.
    - `onversionchange`.
- **`respaldo.test.ts`:**
  - Memoria: `adoptar` es atómico.
  - Candados en memoria: dueño, sin dueño y retenido.
- **`recuperar.test.ts`:**
  - Nombre visible («Sin título», con archivo, con otro título).
  - Fechas: hoy, ayer y otro día.
  - Orden por fecha.
  - Una copia rota da problemas.
  - Lo recuperado sale con `modificado` y sin deshacer.
- **`archivo.test.ts`:** `sugerido` va al diálogo y al título, y se limpia.
- **`historial.test.ts`** (D7):
  - `{ modificado: true }` está modificado.
  - Ejecutar y deshacer siguen modificado.
  - `marcarGuardado` lo limpia.
- **IndexedDB y Web Locks reales** no corren en Node sin una dependencia (fake-indexeddb, que no se suma). Los cubren el humo en Chrome y la verificación a mano en WebView2.

## 9. Riesgos

- **F1 no pasa** (lo esperable): la etapa 1b. Si tampoco alcanza, se decide con Bruno entre caché por objeto y bajar el tope.
- **Cortar la primera instancia puede tirar el WebView2 de la segunda**, porque comparten proceso. Las dos copias quedan en disco y se ofrecen al volver. Se observa en S2.
- **`navigator.locks` en `tauri.localhost`:** si no es contexto seguro, no está, y queda el latido. Se ve en la etapa 1.
- **Una previa abierta mucho tiempo** posterga la copia todo ese tiempo, porque «nunca» durante una previa. Se acepta: hay alguien usando la app.
- **Humo:** con el perfil compartido, una copia de una prueba abriría el diálogo en la siguiente. Se limpia IndexedDB antes de cada prueba (etapa 2).
- **WebKitGTK (Mint):** puede faltar `requestIdleCallback` (está el respaldo), y `durability` puede no hacer nada. Es secundario.
- **Disco lleno o IndexedDB roto:** el aviso único y la app sigue.

## 10. Fuera de T23

- «Copias recientes» (D2e-B).
- Single-instance.
- Recuperar antes del archivo del argumento: es de T25.
- «Probar la fase 4» con F1: es C1, que reusa `medirCopia.ts`.
