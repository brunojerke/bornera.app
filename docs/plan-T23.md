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

> **Cambió con la 1b (ajuste 1 de la 1b):** la copia se escribe por trozos, cada uno con su `put`, y un registro chico marca la generación completa. Ningún paso síncrono junta los 653 K.

- Base `bornera`, **versión 2**, con dos almacenes. La 1 la usó solo el arnés de la etapa 1a (sin publicar, el texto entero en `copias`), y quedó en el perfil de la PC. Al subir, `onupgradeneeded` vuelve a crear `copias` vacío y crea `trozos`.
  - `copias`, con `keyPath: "id"`: el **registro de copia completa**, uno por instancia. Es chico; al arrancar solo se leen estos.
  - `trozos`, con `keyPath: ["id", "generacion", "n"]`: los trozos del texto.
- Una copia por instancia. El `id` es el de la instancia: `crypto.randomUUID()` al arrancar, o un respaldo con `Math.random` si no está.
- **Generación:** un número que sube con cada intento de copia de la instancia, también al volver a empezar. Los trozos de un intento llevan su generación.
- **Trozo:** `{ id, generacion, n, texto }`, con `n` desde 0. Unidos en orden de `n` dan `serializar(documento)`: el formato `.brn` en una línea, sin gzip y sin la prueba D22-B (D2b).
- **Registro de copia completa** (`esquema: 1`):

| Campo | Tipo | Qué |
|---|---|---|
| `id` | string | Instancia dueña |
| `esquema` | 1 | Versión del registro (no es la del formato `.brn`) |
| `generacion` | number | La generación completa |
| `trozos` | number | Cuántos trozos tiene (de 0 a `trozos - 1`) |
| `caracteres` | number | Largo del texto unido, para comprobar al leer |
| `archivo` | `{ nombre, ruta } \| null` | Archivo actual al copiar; `ruta` es null en el navegador |
| `titulo` | string | `meta.titulo`, para nombrar una copia sin archivo |
| `componentes` | number | Componentes de todas las hojas, para distinguir copias en la lista |
| `fecha` | number | `Date.now()` de la copia |
| `version` | string | Versión de Bornera que la escribió |

- **Escritura:**
  - Cada trozo va en su transacción `readwrite` sobre `trozos`, con `durability: "strict"`.
  - Al final, una transacción sobre `copias` y `trozos`: `put` del registro y borrado de los trozos de las generaciones anteriores de ese `id` (`IDBKeyRange.bound([id, 0, 0], [id, g, 0], false, true)`). Es atómica: la copia completa anterior vale hasta que esta queda escrita.
  - Antes de esa transacción se esperan los `complete` de los trozos; si uno falló, la copia no se marca completa.
- **Lectura:** solo copias completas. Del registro se leen los trozos `[id, g, 0…trozos-1]`, se comprueban la cantidad y el largo, y se unen. Si falta algo, es una copia que no abre.
- **Las incompletas se borran:**
  - Los trozos de una generación mayor que la del registro son de un intento cortado.
  - Los de un `id` sin registro son de una instancia que se cortó antes de su primera copia completa.
  - Se borran al descartar o recuperar ese `id`, y al arrancar, solo para los `id` sin dueño. Nunca los de una instancia viva.
- La conexión se abre una vez al arrancar y queda abierta. Con `onversionchange` (una versión futura sube el esquema), se cierra y la instancia deja de copiar, con el aviso único.
- **Dueño (D2d-B):** la instancia toma `navigator.locks.request("bornera-copia-<id>")` al arrancar y no lo suelta nunca. Una copia está «sin dueño» si `request(…, { ifAvailable: true })` consigue su candado. La instancia que la ofrece **retiene ese candado** mientras el diálogo está abierto, así otra instancia que arranca en ese momento no la ofrece también. Con Esc o al decidir, lo suelta.
- **Si S2 falla** (latido, D2d-B): se suma el almacén `latidos` (`{ id, ultimo }`) en la misma versión 1, porque nada salió publicado. Se escribe cada 10 s y una copia queda sin dueño a los 30 s sin latido.
- No se pide `navigator.storage.persist()`: la copia vive minutos. Si el disco se llena, sale el aviso de espacio.

## 3. Relojes (D2b-C, fijos)

- Al llegar un cambio (sube `cambios`): si no había cambios sin copiar, `pendienteDesde = ahora`. Un solo `setTimeout`, que se rearma a `min(ultimoCambio + 10 s, pendienteDesde + 60 s)`.
- Al vencer, se pide ocio: `requestIdleCallback(copiar, { timeout: 1000 })` o, si no existe (WebKitGTK, S8), `setTimeout(copiar, 0)`. El `timeout` hace que la copia salga aunque la ventana esté oculta.
- Si al entrar está «ocupado» (D1), se vuelve a mirar en 1 s. Ese reintento corre solo mientras hay cambios sin copiar y algo ocupado. No hay bucle sin cambios.
- **La copia va por partes (1b):** cada ocio es **un paso**: escribe trozos con `serializarPorPartes` hasta 2 ms (o lo que quede de ocio, si es menos; al menos una pieza), los une y hace el `put` de **ese** trozo. Al final, un paso más escribe el registro de copia completa. Ver «Etapa 1b» en la sección 7.
- Al empezar el primer paso, se anota `cambios`. Si en un paso `cambios` ya es otro (o el documento es otro), la copia **vuelve a empezar** con otra generación. Al completarse: `copiado` = los `cambios` del comienzo y `pendienteDesde = null`. Lo que cambió durante la escritura del registro arranca otro ciclo.
- Sin cambios sin copiar no corre ningún reloj.
- Solo se copia el editor del documento. Las escenas del banco y el editor de «Probar» no se copian nunca.

## 4. Cuándo se borra (D2e) y cuándo no se copia

**Se borra la copia propia:**
- Al guardar bien, si quedó sin cambios.
- Cuando `modificado` pasa a falso (D2-A).
- Al reemplazar el documento con Nuevo o Abrir, después de «¿Guardar los cambios?».
- Al cerrar la ventana cuando `antesDeCerrar` da verdadero (sin cambios, «No guardar» o guardado). Se espera hasta 1 s antes de `destroy`, para que un IndexedDB colgado no trabe el cierre.
- **Nunca sola al arrancar.**

**Copias ajenas:** Descartar borra su registro y todos sus trozos. Recuperar ya no copia el texto en un paso: eso juntaría los 653 K (1b). Con el documento recuperado se pide una copia propia **ya**, por partes, como si vencieran los 60 s. Cuando queda completa, se borra la ajena y se suelta su candado. Si se cortara antes, la ajena sigue ahí y se ofrece de nuevo.

**Orden:** IndexedDB ejecuta las transacciones `readwrite` de un mismo almacén en el orden en que se crean. Un borrado pedido después de una copia en curso queda después. Y la copia, al entrar, mira `modificado`: si ya se guardó, no escribe.

**En el navegador** (`npm run dev` y el humo) no hay cierre de ventana. Si se deja la página con cambios aceptando `beforeunload`, la copia queda y se ofrece al volver. Se acepta, porque es solo desarrollo.

## 5. Textos (fijos)

**Diálogo al arrancar** (modal, como los de archivo):
- Título: **«Bornera no se cerró bien»**.
- Con una copia: «Quedó una copia de recuperación de **marcha-parada.brn**, de hoy a las 11:32.» Botones **Recuperar** (el principal) y **Descartar**. Abajo: «Esc: decidir la próxima vez».
- Con varias (D3-A): «Quedaron 2 copias de recuperación:» y una fila por copia, la más nueva primero: «**marcha-parada.brn** · hoy 11:32 · 42 componentes», con [Recuperar] [Descartar].
- Sin archivo: el título del documento sin extensión, **«Sin título»** en uno nuevo, y «(nunca se guardó)» en la frase de una copia, o «· nunca se guardó» en las filas.
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

> **Redefinida para la 1b (ajuste 2 de la 1b, antes de medir):**
> - **F1 = máximo de UN paso síncrono de la copia:** un trozo más su `put`, o el registro final, con la escena de 2000 + 3030 cables.
> - **Pasa con ≤ 9 ms en la PC con WebView2** (objetivo ~3 ms) y **≤ 50 ms en la netbook**.
> - La duración total de la copia, la cantidad de pasos y los reinicios se informan, pero no deciden.
> - **Salida de emergencia** (Bruno, 2026-11-17): la copia de una vez, después de 5 reinicios (sección 7, etapa 1b), se informa **aparte** en F1, con su máximo y cuántas veces ocurrió. No entra en la mediana ni en el máximo de los pasos, y no decide.
> - **Límite conocido:** en la netbook, esa tarea puede pasar de 50 ms (la copia entera, ~80 ms estimados con ×5,5).
>
> Lo de abajo es la regla de la etapa 1a, con la copia entera en un paso. Esa medición queda como «antes».

- **F1 (1a) = máximo de la parte síncrona de la copia** (sección 3) con la escena de 2000 + 3030 cables, **en WebView2 de la PC**.
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

#### Propuesta para la 1b (ajuste 2)

**Elegida: (a)** (Bruno, 2026-11-17), con los 3 ajustes que están en la etapa 1b.

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
  - El almacén por trozos ya está (`AlmacenCopias`, 1b): `escribirTrozo`, `completar`, `leer`, `listar` y `borrar`, con `almacenIndexedDB()` y `almacenMemoria()`. Ya no hay `adoptar`: Recuperar hace una copia propia por partes (sección 4). Suma borrar los trozos incompletos de los `id` sin dueño.
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
- **Hecho el código (2026-11-17); faltan S2 y S3 a mano.**
  - `src/ui/autoguardado.ts` (clase `Autoguardado`):
    - Relojes de 10 s y 60 s, con un solo temporizador.
    - «Ocupado» (D1): reintenta a 1 s.
    - Copia por partes, con `copiarYa()` para desarrollo y humo.
    - Aviso único si falla y reintento a los 10 s. `apagar()` con `onversionchange`.
    - Cuenta aparte la salida de emergencia.
  - `copiaPorPartes` vuelve a mirar la fuente antes del registro: si en el medio se guardó o se cerró, no escribe la copia completa.
  - `respaldo.ts`:
    - `Candados` con Web Locks (`tomarPropio`; `conDueno` usa `locks.query()`, que mira sin tomar) y en memoria.
    - `motivoFallo` e `idInstancia`.
    - `listar` saltea las `medicion-…`.
  - `Lienzo` avisa `oncambiodocumento` (solo el editor del documento) y da `ocupadoParaCopia()` (gesto, previa de pegar o de colocar, tramo).
  - `Ventana`:
    - Id y candado al arrancar. Abre la base al montar; si falla, el aviso y la app sigue.
    - «Probar» y las mediciones cuentan como ocupado.
    - En desarrollo: `bornera.autoguardado`, `bornera.respaldo` y `bornera.idInstancia`.
  - Menú de desarrollo › «Copias de recuperación…» (`src/ui/listaCopias.ts`): esta instancia, si hay Web Locks, cómo viene el autoguardado y una fila por copia (dueño, nombre, hora, componentes, trozos, caracteres, si abre).
  - **Adelantado de la etapa 3** (sale solo y es poco):
    - Con `modificado` en falso se borra la copia propia. Eso cubre guardar, deshacer hasta lo guardado (D2-A), Nuevo y Abrir.
    - Cerrar la ventana bien la borra (`cerrar()` en `onCloseRequested`, hasta 1 s).
  - Tests:
    - `autoguardado.test.ts` (15) y `listaCopias.test.ts` (4).
    - Un test más en `copiaPorPartes`.
    - La emergencia aparte en `medirCopia.test.ts`.
    - En total, 2037 tests y check limpio.
  - Humo `t23-autoguardado.mjs` (13):
    - La copia es igual al documento.
    - No sale durante un arrastre ni con la previa de pegar, y sí al soltar o con Esc.
    - La lista la muestra.
    - Guardar la borra.
    - «Medir la copia (F1)» no deja nada en la base.
    - `t06` y `t15a` siguen bien (83).
  - **Comprobación previa de S2** (automática y sin cortar nada; exe de release ×2 abierto por el puerto de depuración; script temporal, ya borrado):
    - En `http://tauri.localhost` hay contexto seguro y `navigator.locks`. El supuesto de la sección 0 se cumple.
    - Cada instancia ve los candados de las dos, y la 1.ª lee en IndexedDB lo que escribió la 2.ª.
    - **El proceso de WebView2 (el «browser») es hijo de la 1.ª Bornera**, y el renderer de la 2.ª cuelga de él; la 2.ª no tiene proceso de WebView2 propio. Cortar el árbol de la 1.ª probablemente tira la página de la 2.ª. Lo decide la prueba a mano.
    - WebView2 deja compartir el perfil solo si las dos instancias tienen las mismas opciones: una 2.ª instancia sin el argumento de depuración no abrió su página. En el uso normal todas tienen las mismas. `f1-webview2.mjs` ya pide que no haya otra Bornera abierta.
  - **S2 y S3 a mano: pasan** (Bruno, 2026-11-17, PC, exe de release, «Finalizar tarea» sobre la app Bornera):
    - **S3:** una instancia y Finalizar tarea. La copia de `uno.brn` queda «sin dueño» y abre.
    - **S2:** con dos instancias, la copia de la que se corta queda «sin dueño».
    - **Cortar la 1.ª no tiró la 2.ª**, que siguió editable e hizo su copia (paso más largo 1,0 ms, 2 pasos, 12,9 ms en total). El riesgo de WebView2 compartido no se dio en la PC; **se repite en la netbook en C4** (fila 3b de la checklist de `plan-fase4.md`).
    - **Corte sin esperar:** queda la copia anterior («Sin título (nunca se guardó)», 2 componentes, abre) y se pierde solo el último cambio. Es lo esperado (D2b).
    - **Cerrar con la X** borró la copia propia (D2e, adelantado de la etapa 3).
    - S2 pasa, así que no hace falta el latido.
    - Quedaron 3 copias viejas de prueba en el perfil de la PC: se descartan con el diálogo de la etapa 2.

### Etapa 1b — Copia por partes (Opus xhigh, núcleo)
**Elegida (a) por partes** (Bruno, 2026-11-17), con 3 ajustes: el `put` también por partes, F1 por paso y la salida de los reinicios. Va antes que el resto de la etapa 1.

- **Núcleo:** `serializarPorPartes(doc)` en `src/core/io/porPartes.ts`. Es un generador de piezas cuya unión es `serializar(doc)`, carácter por carácter.
  - Las piezas son: la cabeza hasta `"hojas":[`, la apertura de cada hoja, cada componente, el paso a los cables, cada cable, el cierre de cada hoja y el cierre final.
  - Usa los mismos escritores (`valor`, `meta`, `mapa`, `componente`, `cable`). `serializar` no cambia: los sha256 del banco (T21) y el corpus (T22) lo cuidan.
  - Lee el documento vivo pieza por pieza. Si el documento cambia en el medio, la copia lo detecta por `cambios` y vuelve a empezar.
- **Copia (`src/ui/copiaPorPartes.ts`):** una función con todo inyectado (almacén, ocio, reloj y lectura del editor), que la usan el arnés de F1 y, desde la etapa 1, el autoguardado.
  - **Un paso por ocio:** saca piezas hasta 2 ms, mirando el reloj cada 8 piezas, o hasta lo que quede de ocio si es menos (siempre al menos una pieza). Las une y hace el `put` de ese trozo. El objetivo es ~3 ms por paso.
  - **Último paso:** el registro de copia completa y el borrado de las generaciones viejas (sección 2).
  - **Vuelve a empezar** con otra generación si en un paso `cambios` (o el documento) ya no es el del comienzo.
  - **Ajuste 3, reinicios:** después de **5 reinicios seguidos**, el intento siguiente es **de una vez**.
    - Espera un ocio largo (`timeRemaining() ≥ 40 ms`; con el respaldo de `setTimeout`, el próximo) y escribe todos los trozos y el registro en esa misma tarea, sin ceder.
    - Cada trozo sigue con su `put`, así que tampoco junta los 653 K.
    - Ningún comando puede caer en el medio de una tarea, así que esta copia siempre termina. No se queda sin copia mientras se edita sin parar: alcanza con una pausa de ~50 ms entre acciones, que en la edición normal siempre hay.
    - Tarda lo que la copia entera (~15 ms en la PC, ~80 ms estimados en la netbook). Por eso es la **salida de emergencia**: se informa aparte en F1 (máximo y cuántas veces ocurrió), no entra en la mediana y no decide (sección 6). Límite conocido: en la netbook puede pasar de 50 ms.
    - Si los comandos llegan cada menos de 40 ms (una tecla mantenida apretada), espera a que se suelte.
  - **Informa:** pasos por copia, duración total, reinicios y copias de una vez.
- **Tests (sin DOM):**
  - `porPartes.test.ts`: la unión es igual a `serializar` en:
    - Los 8 `documentosDePrueba`.
    - El banco de 2000 + cables.
    - El corpus `formato-v1` (abierto).
    - Hojas sin componentes o sin cables.
    - Documentos armados al azar (semilla fija) con 0 a 3 hojas y textos raros.
  - `copiaPorPartes.test.ts`, con almacén en memoria, ocio y reloj falsos:
    - Con varios presupuestos, los trozos unidos dan `serializar`.
    - Ningún paso pasa del presupuesto más una pieza.
    - El registro llega al final y borra las generaciones viejas.
    - Un trozo que falla no marca la copia completa.
    - Un cambio en el medio hace volver a empezar con otra generación.
    - **Ediciones seguidas** (un comando entre cada paso): a los 5 reinicios la copia sale de una vez en el primer ocio largo y su texto es el del documento de ese momento. Con ocios cortos, espera.
  - `respaldo.test.ts`: lectura de una copia completa desde el almacén en memoria. Faltan trozos o el largo no da: es una copia que no abre.
- **Arnés de F1:** `medirCopia.ts` mide con la copia por partes. Informa el paso más largo de cada copia (F1), los pasos por copia, la duración total y el registro final. Al terminar, relee la última copia y comprueba que sea igual a `serializar`.
- **Medición** (ajuste 2 de la 1b, antes y después):
  - `node tests/bench/f1-webview2.mjs --exe=<exe de la 1a>,<exe de la 1b>` intercala procesos A B A B.
  - `abrir-node.mjs` suma la fila «por partes» (todas las piezas unidas), para ver cuánto cuesta en total frente a `serializar`.
- **Hecho (2026-11-17): F1 = 3,4 ms, pasa.**
  - Archivos:
    - `src/core/io/porPartes.ts`.
    - `src/ui/copiaPorPartes.ts`.
    - `src/ui/respaldo.ts`, por trozos: almacén de IndexedDB y en memoria, `unirTrozos`, base en versión 2.
    - `src/ui/medirCopia.ts`, que relee la última copia y la compara con `serializar`.
  - Tests:
    - `porPartes.test.ts`: los 8 documentos de prueba, hojas vacías y 300 documentos al azar.
    - El corpus `formato-v1` (en su test).
    - `copiaPorPartes.test.ts` (20), con las ediciones seguidas y los ocios cortos del ajuste 3.
    - `respaldo.test.ts`.
    - En total, 2016 tests y check limpio.
  - **Intercalado en WebView2** (Edg/157, exe de release; A = 1a, B = 1b; 3 + 3 procesos, 20 copias cada uno). `f1-webview2.mjs` suma `--borrar-base`, porque el exe de la 1a abre la base en versión 1 y no puede después de que la 1b la sube a 2.

    | Exe | Mediana por proceso | Máx. (F1) |
    |---|---|---|
    | A, copia entera | 8,8–9,3 ms | 13,4 ms |
    | B, paso más largo de cada copia | 2,6–2,7 ms | **3,4 ms** |

  - Lo que se informa (B): 5 pasos por copia (4 trozos de ~2,5 ms y el registro de 0,1–0,4 ms), duración total de ~23 ms de mediana (máximo 183–285 ms, por esperar los ocios) y 0 reinicios. La copia releída es igual a `serializar` en los 3 procesos.
  - **En Node** (`abrir-node.mjs`, 3 procesos): `serializar` 8,0 ms y por partes, todo unido, 8,4 ms (+5 %).
  - Netbook (×5,5 de D6a): un paso de ~3 ms daría ~17–19 ms, debajo de 50. Se confirma en el cierre de la fase.

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

- **Hecho (2026-11-17).**
  - **Núcleo (D7):** `Historial` con `{ modificado: true }`, con una marca `Symbol` que nunca está en la pila; el `Editor` lo pasa como tercer parámetro. Test en `historial.test.ts`.
  - **`src/ui/recuperar.ts`:**
    - `nombreVisible`, `fechaVisible` («hoy a las», «ayer a las», «el dd/mm a las») y `filaRecuperar`.
    - `copiasParaOfrecer`: las completas ajenas sin dueño, la más nueva primero, con su candado **retenido** (`Candados.retener`, con `ifAvailable`).
    - De paso borra los trozos sueltos de ids sin dueño y sin copia completa (sección 2; nunca una copia completa ni los de una instancia viva).
    - `abrirCopia`, con la validación estricta de Abrir, el esquema y el texto (o lo que haya) para exportarlo tal cual.
  - **`respaldo.ts`:** `retener`, `idsConTrozos` (solo las claves) y `parcial` en una lectura fallida.
  - **`OperacionesArchivo`:**
    - `sugerido` y `nombreVisible`: el título y el diálogo de cambios sin guardar usan el nombre original.
    - Guardar pregunta dónde con la ruta original (o el nombre) y respeta `.brn.json`.
    - El sugerido se limpia al guardar, con Abrir y con Nuevo.
    - `recuperar(documento, archivo)` devuelve `{ cuadro }`: envuelto, porque una función async que devuelve una promesa la espera, y el humo lo encontró.
    - `exportarTexto` escribe el texto crudo a «<nombre> (copia de recuperación).brn.json».
  - **`DialogoRecuperar.svelte`** con los textos de la sección 5.
    - En la frase de una sola copia, «(nunca se guardó)» va entre paréntesis; en las filas, «· nunca se guardó».
    - Esc o Cerrar sueltan los candados y dejan las copias para el próximo arranque.
  - **`Ventana`:**
    - Ofrece las copias al abrir la base.
    - Recuperar:
      - Abre la copia, suelta las demás y pide `copiarPronto()`.
      - La copia ajena se borra (y se suelta su candado) cuando la propia queda escrita o el documento se guarda.
      - Muestra los avisos de abrir y «Recuperado (en N ms)».
    - Una copia que no abre muestra «No se pudo recuperar» y ofrece Exportar tal cual.
  - **Humo:**
    - `Pagina.abrir` pasa por about:blank y borra IndexedDB del origen antes de cada carga; con `{ conservarCopias: true }` no borra. `correr.mjs` les pasa `url` a las pruebas.
    - `t23` suma 20 comprobaciones del diálogo: una copia, sin archivo, Descartar, Esc, varias y rota con Exportar tal cual. En total, 33.
  - **Adelantado de la etapa 3:** retener los candados mientras se decide y la limpieza de trozos sueltos al arrancar. **De la 4:** los casos del diálogo en el humo.
  - Resultados: 2060 tests, check limpio y **humo entero 804/804**.

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

- **F1 no pasa:** pasó, con la 1b (3,4 ms). Queda la netbook, en el cierre de la fase.
- **Editar sin parar con ocios cortos** (una tecla mantenida apretada, comandos cada < 40 ms): la copia de una vez espera a que se suelte. Se acepta.
- **Límite conocido de la salida de emergencia:** en la netbook, la copia de una vez puede pasar de 50 ms. Es rara (5 reinicios seguidos) y se informa aparte en F1, con su máximo y cuántas veces ocurrió.
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
