# Plan T15a — Guardar y abrir `.brn`

Aprobado por Bruno el 2026-11-12, con las decisiones D1 a D22 de abajo. Tarea de la fase 3 (ver `docs/plan-fase3.md`, T15a). Base: commit `17bf876`. La implementación la hace otra sesión.

- **Qué:** se adelanta lo básico de la fase 4. `serializar` y `deserializar` en `src/core/io` (sin DOM), gzip fuera de `core`, y en la interfaz Nuevo, Abrir, Guardar y Guardar como, con aviso de cambios sin guardar.
- **Terminado cuando:** un circuito con componentes y cables se guarda, se cierra la app, se abre y queda idéntico.
- **Prueba:** ida y vuelta con `toEqual` (vacío, rotados y espejados, cables y T), lo mismo pasando por gzip, archivos dañados que dan un error con mensaje y nunca una excepción, humo y netbook con Windows.

## Reglas para la implementación

- No hacer nada fuera de lo que pide este plan. Lo que aparezca de más se anota como pendiente y se le avisa a Bruno.
- Una etapa por vez, con commit local por etapa y **sin push**.
- **Dependencias aprobadas (D11-B), y solo estas:** `@tauri-apps/plugin-dialog` y `@tauri-apps/plugin-fs` (npm), `tauri-plugin-dialog` y `tauri-plugin-fs` (crates). Ninguna otra sin preguntar: ni `flate2`, ni una librería de esquemas.
- **Frenar y avisar a Bruno, sin buscar otra salida,** si falla alguno de los supuestos marcados con "(frenar)" en la sección Supuesto. El principal: el alcance de fs para el archivo temporal (etapa 4).
- Valen las reglas de `CLAUDE.md`: `src/core` sin DOM ni otras capas, todo cambio al documento por Comando, coordenadas en unidades de grilla, redibujar solo ante cambios, código y comentarios en español, identificadores y claves del `.brn` sin ñ ni tildes.
- En cada etapa: `npm test` y `npm run check`. Desde la etapa 3, `npm run humo` entero.
- Al cerrar cada etapa, buscar acentos rotos: `git grep -nP "\x{FFFD}"`.

## Palabras

- **Archivo actual:** el archivo donde Guardar escribe sin preguntar (nombre y, en el escritorio, ruta). Lo fijan Abrir y Guardar como. Un documento nuevo no tiene.
- **Modificado:** el documento difiere de lo último guardado o abierto.
- **Marca de guardado:** el último comando hecho en el historial en el momento de serializar (o "pila vacía").
- **Forma canónica:** el único texto que `serializar` da para un documento.
- **Error y aviso:** un error rechaza el archivo; un aviso deja abrir e informa.
- **Operación de archivo:** Nuevo, Abrir, Guardar o Guardar como, desde que empieza hasta que termina.
- **Anfitrión:** el cable sobre el que termina una T.

## Plataforma (Bruno, 2026-11-12)

- **Principal: Windows con WebView2.** Los criterios de cierre se prueban ahí: en la PC con `npm run tauri dev` y en la netbook (Intel Celeron N4020, 8 GB de RAM, 1024×600, Windows) con el `.msi`.
- **Secundario: Linux con WebKitGTK.** Lo que dependa de WebKitGTK va a Riesgos, se prueba aparte y **no bloquea el cierre de T15a**.
- **Línea base nueva.** Las mediciones anteriores de la netbook eran en Mint con WebKitGTK y no son comparables. En la prueba de la netbook de T15a se corre también el banco de control y sale una nota "Medición <versión> - netbook Windows".
- El objetivo de `CLAUDE.md` (fluido con 2 GB de RAM) sigue valiendo: el tope de tamaño se eligió contra 2 GB, no contra los 8 GB de la netbook de prueba.

## Decisiones (Bruno, 2026-11-12)

| | Elegida | Qué significa |
|---|---|---|
| D1 | **B** | Guardar escribe gzip. Abrir acepta gzip o JSON en texto (se distinguen por los bytes `1f 8b`). "Guardar sin comprimir" queda para la fase 4. |
| D2 | **A** | JSON compacto, en una línea. |
| D3 | **A** | Una clave que el programa no conoce rechaza el archivo. Además de la lista blanca, hay un chequeo explícito de claves sobrantes en cada objeto. |
| D4 | **A** | `version` mayor que la del programa: se rechaza con "hecho con una versión más nueva de Bornera". |
| D5 | **A** | Símbolo desconocido sin cables: abre, se dibuja con "?" (como en T6) y da un aviso. Con cables en sus bornes: se rechaza el archivo. |
| D6 | **A** | Un cable roto (todo lo que da `validarHoja`) rechaza el archivo, con la lista de problemas. |
| D7 | **A** | Contadores atrasados (un id `c5` con `contadores.c` ≤ 5): se rechaza. |
| D8 | **A** | Ciclos de apoyos: se rechaza. |
| D9 | **A** | T en el extremo de su anfitrión (libre, en borne o en T): se rechaza. |
| D10 | **A** | Las conexiones aparentes no se chequean al abrir. Queda para la fase 4. |
| D11 | **B** | En el escritorio, plugins oficiales dialog y fs. El gzip va en el navegador (`CompressionStream`). |
| D12 | **B + C** | Además de Guardar y Abrir, entran Nuevo (Ctrl+N) y Guardar como (Ctrl+Mayús+S). |
| D13 | **A** | Con cambios sin guardar, Abrir y Nuevo muestran un diálogo propio "Guardar / No guardar / Cancelar". |
| D14 | **A** | Cerrar la ventana con cambios: `onCloseRequested` de `@tauri-apps/api` y el mismo diálogo. |
| D15 | **C** | Recarga accidental: se anulan las teclas en la app compilada y además hay `beforeunload`. |
| D16 | **A** | "Modificado" sale de una marca en `Historial`: deshacer hasta el punto guardado deja "sin cambios". |
| D17 | **Simular-A, Banco-B** | En Simular: Guardar sí, Abrir y Nuevo no. En una escena del banco: Guardar sí (siempre pregunta dónde), Abrir y Nuevo no. |
| D18 | **16 MB, hojas-A, título-B** | Tope de 16 MB, cortando mientras se lee. Un archivo con varias hojas abre, las conserva y avisa. El nombre y la marca de cambios van en el título de la ventana. |
| D19 | **A** | Abrir crea un Editor nuevo: historial vacío. Guardar no toca el historial. |
| D20 | **C** | En la netbook con Windows, guardar y abrir 2000 símbolos con cables tardan ≤ 1 s cada uno. Se anota además el tiempo real como línea base. |
| D21 | **A-a** | Rango de grilla de ±10 000 unidades (25 m). Se valida al abrir y al guardar. Exigirlo en los comandos queda como pendiente aparte. |
| D22 | **B** | Al guardar, el texto recién armado pasa por `deserializar`. Si no abriría, se avisa y no se escribe. |

Descartadas: D1-A/C (solo gzip / guardar sin comprimir ahora), D2-B (sangría), D3-B/C (ignorar la clave), D4-B (intentar abrir), D5-B/C (dejar o quitar los cables), D6-B/C (quitar o soltar), D7-B/C (subir el contador), D8-B/C/D, D9-B/C/D, D10-B/C, D11-A (solo navegador: D12-C y D13-A necesitan saber si se guardó), D11-C/C-rs/D/D-rs (comandos propios en Rust, gzip en Rust, carpeta fija), D12-A, D13-B/C, D14-B, D15-A/B/D, D16-B, D19-B/C, D20-A/B, D21-B y D21-b, D22-A/C.

## Comportamiento

### 1. Formato y forma canónica

Se guarda el `Documento` tal cual está en el modelo (`src/core/model/documento.ts`). La versión 1 se define acá: nunca hubo guardar, así que no existe ningún `.brn` anterior ni hace falta migrar.

```json
{"formato":"bornera","version":1,"meta":{"titulo":"Marcha-parada","autor":"","fecha":"2026-11-12"},"contadores":{"c":3,"w":3},"hojas":[{"nombre":"Hoja 1","componentes":[{"id":"c1","tipo":"pulsador.na","x":10,"y":8,"rot":90,"espejado":true,"etiqueta":"S1","params":{}}],"cables":[{"id":"w1","desde":{"tipo":"borne","comp":"c1","borne":"13"},"hasta":{"tipo":"cable","cable":"w2","x":10,"y":4},"codos":[[10,5]]}]}]}
```

Forma canónica (lo que escribe `serializar`):

- **Todos los campos se escriben siempre.** `espejado: false`, `params: {}`, `codos: []` y `etiqueta: ""` van explícitos. Al leer, un campo que falta se rechaza. Así cada documento tiene un solo texto.
- **Orden de claves fijo** por tipo de objeto:
  - raíz: `formato`, `version`, `meta`, `contadores`, `hojas`;
  - `meta`: `titulo`, `autor`, `fecha`;
  - hoja: `nombre`, `componentes`, `cables`;
  - componente: `id`, `tipo`, `x`, `y`, `rot`, `espejado`, `etiqueta`, `params`;
  - cable: `id`, `desde`, `hasta`, `codos`;
  - extremo: `tipo` y después `comp`, `borne` (borne); `cable`, `x`, `y` (T); `x`, `y` (libre).
- En `params` y `contadores`, las claves van ordenadas alfabéticamente.
- `hojas`, `componentes`, `cables` y `codos` van en el orden del documento, sin ordenar (es el orden de dibujo).
- Números enteros. `-0` se escribe `0`.
- Textos tal cual, en UTF-8, sin normalizar.
- JSON compacto (D2-A), sin BOM y sin salto de línea al final.
- `serializar` arma objetos nuevos con ese orden; no depende del orden de las claves en memoria.

El ejemplo de `docs/arquitectura.md` (sección "Formato de archivo propio") quedó viejo: no tiene `contadores` ni `espejado` y los cables llevan `puntos`. Se actualiza en la etapa 1.

### 2. `serializar` y `deserializar` (`src/core/io`)

```ts
serializar(doc: Documento): string
deserializar(texto: string): ResultadoAbrir

type ResultadoAbrir =
  | { ok: true; documento: Documento; avisos: ProblemaArchivo[] }
  | { ok: false; errores: ProblemaArchivo[] }

interface ProblemaArchivo {
  /** Ruta del campo ("hojas[0].cables[2].desde") o id del objeto. */
  donde: string;
  mensaje: string;
}
```

- `deserializar` **nunca tira**. El único `try/catch` envuelve a `JSON.parse`; el resto son comprobaciones a mano.
- **Lista blanca:** arma el `Documento` campo por campo en objetos nuevos. Nunca devuelve ni reusa el objeto de `JSON.parse`.
- **Claves sobrantes (D3-A):** en cada objeto se comparan sus claves contra las esperadas; una de más se rechaza con su ruta. Una clave `__proto__` en la raíz, en un componente, en un cable o en un extremo cae acá.
- **Mapas abiertos (`params`, `contadores`):** las claves cumplen `^[a-z0-9_]+$`, y `__proto__`, `constructor` y `prototype` se rechazan por nombre. Los valores de `params` son textos; los de `contadores`, enteros seguros ≥ 1.
- Reusa `validarHoja`, `indexarHoja`, `recorridoCable`, `seApoyaEn` y `buscarSimbolo`.
- Las etiquetas no se validan al abrir: `etiquetas.ts` ya dice que el documento acepta cualquier texto. La forma de `meta.fecha` tampoco: es un texto.
- Los mensajes van en español con ortografía correcta y dicen dónde y qué: `hojas[0].componentes[3].rot: tiene que ser 0, 90, 180 o 270 (es 45)`.

**Orden del pipeline.** Corta en la primera etapa con errores, porque las siguientes suponen las anteriores. Dentro de una etapa lista todos los errores, hasta 20 ("y N más").

| # | Etapa | Qué mira | Si falla |
|---|---|---|---|
| 0 | Texto | largo ≤ 16 × 1024 × 1024 caracteres; quita un U+FEFF inicial | rechaza |
| 1 | Parse | `JSON.parse` en `try/catch`; el mensaje lleva la posición si la da | rechaza |
| 2 | Formato | la raíz es un objeto (no lista, no `null`) y `formato === "bornera"` | rechaza: "No es un archivo de Bornera" |
| 3 | Versión | entero seguro ≥ 1; mayor que `VERSION_FORMATO` es versión futura (D4-A) | rechaza |
| 4 | Estructura | lista blanca, tipos, claves sobrantes, enteros y rango, al menos 1 hoja (detalle abajo) | rechaza |
| 5 | Ids | no vacíos y únicos en todo el documento (componentes y cables de todas las hojas) | rechaza |
| 6 | Contadores | para cada id con forma `^([a-z]+)([1-9][0-9]*)$`, `(contadores[prefijo] ?? 1)` es mayor que el número (D7-A) | rechaza |
| 7 | Símbolos | tipo que no está en la biblioteca: sin cables en sus bornes, aviso; con cables (D5-A) | rechaza |
| 8 | Cables | `validarHoja` por hoja: referencias, bornes, T sobre su anfitrión, forma (D6-A) | rechaza |
| 9 | Apoyos y T | ciclo: `seApoyaEn(indice, id, id)` (D8-A); T cuyo punto es el primero o el último del recorrido de su anfitrión (D9-A) | rechaza |

Detalle de la etapa 4:

- Raíz, `meta`, hoja, componente, cable y extremo: exactamente las claves de la forma canónica.
- `meta.titulo`, `meta.autor`, `meta.fecha`, `hoja.nombre`, `id`, `tipo`, `etiqueta`, `comp`, `borne`, `cable`: textos.
- `x`, `y` (componentes, extremos libres y en T) y cada número de `codos`: `Number.isSafeInteger` y dentro de ±10 000 (D21-A). La constante vive en `src/core/io`.
- `rot`: 0, 90, 180 o 270. `espejado`: booleano.
- `codos`: lista de pares `[x, y]` de exactamente dos números.
- Extremo: se elige por `tipo` (`borne`, `cable`, `libre`); otro valor se rechaza.
- `hojas`, `componentes`, `cables`: listas (`Array.isArray`). `hojas` con al menos una.

Avisos (el archivo abre):

- símbolo desconocido sin cables: "El símbolo «tipo» de «id» no está en la biblioteca: se dibuja con «?»";
- más de una hoja (D18): "Tiene N hojas: solo se ve la primera". Las etapas 5 a 9 validan todas las hojas, y al guardar se escriben todas.

La detección de ciclos **no entra a `validarHoja`** (quedaba por decidir desde T14c, D7-C): va en la etapa 9 de `deserializar`. `validarHoja` y `validarCable` no cambian.

Las conexiones aparentes no se miran (D10-A).

### 3. Empaquetado: gzip y tope (`src/ui/brn.ts`)

- `TOPE_BYTES = 16 * 1024 * 1024` (D18).
- `empaquetar(texto): Promise<Uint8Array>`: UTF-8 con `TextEncoder` y `CompressionStream("gzip")`.
- `desempaquetar(bytes): Promise<{ ok: true; texto: string } | { ok: false; error: string }>`. No tira.
  - Si `bytes.length` pasa el tope, error sin leer nada.
  - Si empieza con `1f 8b`: `DecompressionStream("gzip")` leído de a trozos, sumando los bytes. **Al pasar el tope cancela la lectura** y devuelve el error, sin juntar el resto. Un gzip roto devuelve un error.
  - Si no, es texto (D1-B): `TextDecoder("utf-8", { fatal: true })`. UTF-8 inválido devuelve un error.
- Si `CompressionStream` no existe (solo puede pasar en Linux), `empaquetar` devuelve el texto sin comprimir y la interfaz lo avisa. El archivo abre igual por D1-B.
- `nombreArchivo(titulo): string`, función pura: quita `/ \ : * ? " < > |`, los caracteres de control, los espacios de los lados y los puntos del final; agrega `.brn`. Si queda vacío, da `circuito.brn`. Las tildes se conservan.

### 4. Archivos (`src/ui/archivos.ts`)

```ts
interface ArchivoAbierto { bytes: Uint8Array; nombre: string; ruta: string | null }
interface Destino { nombre: string; ruta: string | null }

interface Archivos {
  /** Pide un archivo y lo lee. Null si se canceló. */
  abrir(): Promise<ArchivoAbierto | null>;
  /** Pide dónde guardar y escribe. Null si se canceló. */
  guardarComo(bytes: Uint8Array, sugerido: string): Promise<Destino | null>;
  /** Escribe en el archivo actual, sin preguntar. */
  guardar(destino: Destino, bytes: Uint8Array): Promise<void>;
}
```

**Escritorio (`archivosTauri`), el camino del usuario.** Se elige cuando la app corre dentro de Tauri.

- Abrir: `open` del plugin dialog (un archivo, filtro `brn`) y `readFile` del plugin fs.
- Guardar como: `save` del plugin dialog (nombre sugerido, filtro `brn`; si el nombre elegido no termina en `.brn`, se agrega) y escritura segura.
- Guardar: escritura segura sobre la ruta del archivo actual.
- **Escritura segura:** `writeFile` a `<ruta>.tmp` en la misma carpeta y después `rename` del temporal a la ruta. Si algo falla, se borra el temporal con `remove` y se informa el error; el archivo anterior queda como estaba.
- **Alcance de fs:**
  - La ruta que devuelve el diálogo **entra sola** al alcance del plugin fs: `open` y `save` llaman a `allow_file` sobre la ruta elegida cuando el plugin fs está registrado. Vale mientras dure la sesión, así que después de Abrir, Ctrl+S puede pisar ese archivo.
  - El temporal **no entra solo**: es otra ruta, y `rename` comprueba las dos (la vieja y la nueva). Hace falta una entrada de alcance para `*.brn.tmp`.

Permisos que se suman en `src-tauri/capabilities/default.json`:

```json
"core:window:allow-destroy",
"core:window:allow-set-title",
"dialog:allow-open",
"dialog:allow-save",
"fs:allow-read-file",
"fs:allow-write-file",
"fs:allow-rename",
"fs:allow-remove",
{ "identifier": "fs:scope", "allow": [{ "path": "**/*.brn.tmp" }] }
```

- `core:window:allow-destroy`: D14-A (`onCloseRequested` llama a `destroy()` si no se previno).
- `core:window:allow-set-title`: D18 (`setTitle`).
- Escuchar el evento de cierre ya está permitido: `core:default` trae `core:event:default`, con `allow-listen`. `allow-close` no hace falta.
- La entrada `**/*.brn.tmp` es un **supuesto (frenar)**: no está verificado que el alcance acepte un patrón sin carpeta base ni que coincida con rutas de Windows. Es lo primero que se prueba en la etapa 4. Si no anda, se frena y se le lleva a Bruno la elección (alcance más amplio, un comando propio en Rust para escribir, o escribir sin temporal).

En `src-tauri/src/lib.rs` se registran los dos plugins. El comando `greet` de la plantilla no se toca.

**Navegador (`archivosNavegador`), solo para `npm run dev` y el humo.**

- Abrir: `<input type="file" accept=".brn">`. Guardar y Guardar como: descarga con `<a download>`. La ruta es siempre `null`.
- Ahí se da por guardado al disparar la descarga. No es el camino del usuario.

### 5. `Historial`, `Editor` y el reemplazo del documento

- `Historial` guarda la marca de guardado: el último comando hecho al serializar, o `null` si la pila estaba vacía. `modificado` es verdadero si el tope actual es otro. Un historial nuevo arranca sin cambios.
- La marca **se toma** en el mismo instante que el texto (síncrono) y **se aplica** solo si la escritura salió bien. Si se edita mientras se escribe, el documento sigue modificado.
- Guardar, deshacer y ejecutar otro comando deja la marca fuera del historial: queda modificado hasta el próximo guardado, que es lo correcto.
- `Historial` no tiene tope. Queda un comentario: si algún día se agrega, descartar el comando marcado (o cualquiera, si se guardó con la pila vacía) tiene que dejar la marca como inalcanzable.
- `Editor` expone `modificado`, tomar la marca y marcar guardado, y avisa por `alCambiarHistorial`.
- La subida de `contadores` fuera de un Comando (`generarId`) no marca cambios. Es inofensivo: al reabrir, el historial está vacío.
- **Reemplazo (D19-A):** Abrir y Nuevo crean un `Editor` nuevo y lo conectan con `conectarEditor`, igual que las escenas del banco. En `src/ui/Lienzo.svelte`, `editorDocumento` deja de ser `const`, y el objeto de desarrollo `bornera.editor` pasa a leerse en el momento, para no retener el documento viejo. La vista nueva se dibuja encuadrada.
- Guardar no toca el historial: después de Ctrl+S se puede seguir deshaciendo.

### 6. Interfaz

**Acciones.** Los botones Nuevo, Abrir y Guardar ya están en `src/ui/BarraSuperior.svelte`; se les conecta la acción y se suma Guardar como. Exportar PDF sigue sin hacer.

| Acción | Atajo | Qué hace |
|---|---|---|
| Guardar | Ctrl+S | Con archivo actual, lo pisa. Sin archivo actual, hace Guardar como. |
| Guardar como | Ctrl+Mayús+S | Pide dónde; ese pasa a ser el archivo actual. |
| Abrir | Ctrl+O | Pide un archivo, lo valida y reemplaza el documento. **Fija el archivo actual:** después, Ctrl+S pisa ese archivo. |
| Nuevo | Ctrl+N o el botón | Documento vacío, sin archivo actual. |

- Los atajos van en `alTecla` de `src/ui/Ventana.svelte`, como F5: andan con el foco en el campo del panel (antes confirman lo escrito con `panel.confirmar()`), siempre hacen `preventDefault`, y se ignoran con un modal abierto, en medio de un gesto, al mantener la tecla y con una operación de archivo en curso.
- Ctrl+N: Chrome lo reserva y la página no lo recibe. En el navegador, Nuevo va solo por el botón, y el humo usa el botón.

**Guardar, paso a paso**

1. Bloqueos y `panel.confirmar()`. Empieza la operación.
2. `texto = serializar(doc)` y se toma la marca, en el mismo instante.
3. `deserializar(texto)` (D22-B). Si no abriría: diálogo "No se puede guardar" con los problemas; no se escribe ni se marca. Los avisos solos no frenan.
4. `empaquetar(texto)`.
5. Con archivo actual, `guardar`; si no (o en Guardar como, o en una escena del banco), `guardarComo` con `nombreArchivo`. Cancelar el diálogo termina sin cambios.
6. Si la escritura salió bien: se fija el archivo actual, se aplica la marca y sale el aviso "Guardado". Si falló: diálogo con el error; nada cambia.
7. Termina la operación (siempre, también ante un error).

Devuelve si quedó guardado, para el diálogo de D13-A.

**Abrir, paso a paso**

1. Bloqueos. Si hay cambios, diálogo "Guardar / No guardar / Cancelar". "Guardar" corre Guardar; si no quedó guardado, termina.
2. Se recuerda el contador `cambios` del editor.
3. `archivos.abrir()`. Cancelar termina sin cambios.
4. `desempaquetar` y `deserializar`.
5. Con errores: diálogo "No se pudo abrir" con la lista (hasta 10 líneas y "y N más"). **El documento actual no se toca.**
6. Si `cambios` es otro que el recordado: se cancela con el aviso "El documento cambió: se canceló abrir".
7. Se reemplaza el editor, se fija el archivo actual y queda sin cambios. Si hubo avisos, se muestran una vez.

**Nuevo:** bloqueos, el mismo diálogo si hay cambios, y un documento vacío (`documentoNuevo`) sin archivo actual.

**Reentrada.** Una marca "operación de archivo en curso": mientras está, las cuatro acciones (teclas y botones) no hacen nada. En el camino del navegador se toma recién cuando el archivo ya está elegido: si se tomara al abrir el selector y el usuario cancelara, podría quedar trabada.

**Diálogos propios** (con `aria-modal="true"`, como `DialogoDiagnostico`, así `hayModal()` frena los atajos del editor):

- Sin guardar: "Guardar / No guardar / Cancelar". Esc es Cancelar.
- Archivo: título ("No se pudo abrir", "No se puede guardar", "Se abrió con avisos") y la lista de problemas.

**Título de la ventana (D18).** `<marca><nombre> — Bornera`: el nombre del archivo actual, o `meta.titulo` si no hay; la marca `• ` adelante cuando hay cambios. En el navegador va por `document.title`; en el escritorio, por `setTitle`.

**Cerrar con cambios (D14-A).** `getCurrentWindow().onCloseRequested` espera al manejador antes de destruir la ventana. Si hay cambios, el manejador muestra el diálogo y llama a `preventDefault` si se cancela o si no se pudo guardar. Con una operación de archivo en curso, el cierre se frena con un aviso. En el navegador, lo cubre `beforeunload`.

**Recarga accidental (D15-C).**

- En la app compilada se anulan Ctrl+R, Ctrl+Mayús+R, Ctrl+F5 y Mayús+F5. F5 ya es nuestra. En `npm run dev` se dejan para recargar.
- Además hay `beforeunload` mientras hay cambios.
- El humo navega entre pruebas con documentos modificados: `tests/humo/cdp.mjs` tiene que aceptar solo el diálogo de `beforeunload`, o las pruebas actuales se cuelgan. **Es lo primero de la etapa 3:** agregar `beforeunload` y correr el humo entero.

**Simular y banco (D17).**

- En Simular: Guardar y Guardar como andan; Abrir y Nuevo quedan desactivados.
- En una escena del banco: Guardar guarda esa escena, siempre pregunta dónde y no cambia el archivo actual ni la marca del documento. Abrir y Nuevo quedan desactivados.

**`meta`.** T15a no edita título, autor ni fecha: cambiar `meta` al guardar sería un cambio fuera de un Comando.

**Medición (D20).** En desarrollo y en las prereleases, los avisos dicen el tiempo: "Guardado en N ms" (de serializar al fin de la escritura, sin el diálogo) y "Abierto en N ms" (de la lectura al primer cuadro, sin el diálogo).

### 7. Límites conocidos

- Claves repetidas en el JSON: `JSON.parse` se queda con la última y no se puede detectar sin un parser propio.
- El editor no impide colocar algo fuera de ±10 000. Si pasa, D22-B lo dice al guardar ("no se puede guardar") y hay que traerlo de vuelta. Exigirlo en los comandos es un pendiente aparte.
- El alcance de fs que da el diálogo dura la sesión. No hay archivos recientes.

## Etapas

Cada etapa cierra con `npm test`, `npm run check`, commit local y sin push.

### Etapa 1 — Núcleo

Archivos:

- `src/core/io/serializar.ts`, `src/core/io/deserializar.ts`, `src/core/io/index.ts` (nuevos).
- `src/core/io/serializar.test.ts`, `src/core/io/deserializar.test.ts` (nuevos).
- `.gitattributes` (nuevo): `*.brn -text`.
- `docs/arquitectura.md`: el ejemplo del formato.

Tests:

- **Ida y vuelta con `toEqual`:** documento vacío; componentes en las 4 rotaciones, con y sin espejo; cables con codos, T, extremos libres y contadores; el documento del banco con cables (2000).
- **Rotados y espejados con comandos reales** (`Rotar` y `Espejar` alrededor del origen), para ver si el modelo produce `-0`. Si lo produce: frenar y avisar.
- **Idempotencia:** `serializar(deserializar(serializar(d)).documento) === serializar(d)` sobre todos los documentos de prueba. `serializar` dos veces da el mismo texto.
- **Claves sin ñ ni tildes:** se recorre toda la salida; cada clave, cada `tipo` de símbolo y cada `tipo` de extremo cumple `^[a-z0-9_.]+$`. Los textos del usuario (etiqueta, título) sí pueden llevar tildes.
- **Un test por caso dañado:** da `ok: false` (o el aviso), con mensaje y lugar, y no tira.
  - JSON roto, texto vacío, texto que pasa el largo máximo.
  - BOM al principio (abre).
  - Raíz que no es objeto; `formato` ajeno.
  - `version` 2, 0, 1.5 y texto.
  - Campo que falta (también los de valor por defecto: `espejado`, `params`, `codos`, `etiqueta`); campo de otro tipo; 0 hojas.
  - Clave sobrante en cada tipo de objeto; `__proto__` en la raíz, en un componente y en `params`.
  - `x` = 2^53, 1.5, `1e400` y 10 001; `rot` 45; codo de tres números.
  - Id vacío; id repetido en una hoja y entre dos hojas.
  - Contador atrasado; contador que falta con un `c1` adentro.
  - Símbolo desconocido sin cables (abre con aviso) y con cables (rechaza).
  - Cable hacia un componente inexistente, hacia un cable inexistente, a un borne que el símbolo no tiene; T fuera de su anfitrión; tramo diagonal.
  - Ciclo de apoyos.
  - T en el extremo de su anfitrión: libre, en borne y en T.
  - Varias hojas (abre con aviso y las conserva).
- **Nunca tira:** un archivo válido cortado en cada largo, y con valores cambiados al azar con semilla fija.
- **Invariante:** todo documento que abre pasa `validarHoja` vacío en cada hoja, no tiene ciclos y no tiene T en el extremo de su anfitrión. Sobre los documentos de prueba y sobre cada archivo mutado que dé `ok: true`.
- **Lo que Bornera guarda, abre:** los documentos del banco (100, 500, 2000 y cables) dan `ok: true`. Si alguno no abre: frenar y avisar.

### Etapa 2 — gzip, nombre y marca de guardado

Archivos:

- `src/ui/brn.ts`, `src/ui/brn.test.ts` (nuevos).
- `src/core/model/historial.ts`, `src/core/model/historial.test.ts`.
- `src/editor/editor.ts`, `src/editor/editor.test.ts`.

Tests:

- Los documentos de la etapa 1 pasando por `empaquetar` y `desempaquetar`: `toEqual`.
- Texto plano sin comprimir (abre); gzip roto; gzip cortado; UTF-8 inválido.
- Tope: un gzip que se expande más que el tope corta sin leer todo; un archivo comprimido más grande que el tope ni se lee.
- `nombreArchivo`: caracteres prohibidos, vacío, solo prohibidos, puntos al final, tildes.
- Marca: nuevo sin cambios; ejecutar; guardar; deshacer hasta la marca; rehacer; guardar, deshacer y ejecutar otro (queda modificado); marca tomada antes de un cambio y aplicada después (sigue modificado).

### Etapa 3 — Interfaz en el navegador y humo

Archivos:

- `src/ui/archivos.ts` (interfaz y `archivosNavegador`), `src/ui/archivo.ts` (la lógica de Guardar, Guardar como, Abrir y Nuevo, con sus dependencias inyectadas), `src/ui/archivo.test.ts` (nuevos).
- `src/ui/DialogoSinGuardar.svelte`, `src/ui/DialogoArchivo.svelte` (nuevos).
- `src/ui/BarraSuperior.svelte`, `src/ui/Ventana.svelte`, `src/ui/Lienzo.svelte`.
- `tests/humo/cdp.mjs`, `tests/humo/t15a-archivo.mjs` (nuevo).

Orden: primero `beforeunload` y `cdp.mjs`, y el humo entero; después el resto.

Tests (`archivo.test.ts`, con archivos y editor de mentira):

- Guardar sin archivo actual pide dónde; con archivo actual, no.
- Abrir fija el archivo actual: el Guardar siguiente lo pisa sin preguntar.
- D22-B: un documento que no abriría no se escribe ni se marca.
- Reentrada: una segunda acción durante la primera no hace nada.
- Cancelar el diálogo no cambia nada; un error de escritura no marca.
- El documento cambió entre confirmar y cargar: se cancela.
- Archivo rechazado: el documento actual no se toca.
- Atajos de archivo y teclas de recarga, como funciones puras.
- Título: con y sin archivo, con y sin cambios.

Humo (`t15a-archivo.mjs`):

- Armar un circuito, Ctrl+S, leer en Node el archivo descargado y compararlo.
- Abrirlo: queda igual, con el historial vacío y sin la marca.
- Con cambios, Abrir muestra el diálogo; los tres botones.
- Nuevo por el botón.
- Un archivo dañado muestra el error y el documento sigue.
- Ctrl+S con el foco en el campo del panel.
- D22-B con un documento que no abriría (armado por la consola).
- Abrir tres veces seguidas: una tecla dispara una sola acción.
- El título cambia con el nombre y con la marca.

### Etapa 4 — Escritorio (Windows)

Archivos:

- `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`: las cuatro dependencias.
- `src-tauri/src/lib.rs`: registrar los plugins.
- `src-tauri/capabilities/default.json`: los permisos de la sección 4.
- `src/ui/archivos.ts`: `archivosTauri`.
- `src/ui/Ventana.svelte`: `onCloseRequested` y `setTitle`.

Orden: primero la escritura segura con el temporal (supuesto con "frenar"); después el resto.

Prueba a mano en la PC con `npm run tauri dev`:

- Guardar, Guardar como, Abrir y Nuevo con el diálogo nativo.
- Después de Abrir, Ctrl+S pisa el archivo sin preguntar.
- No queda ningún `.brn.tmp` después de guardar.
- Guardar sobre un archivo abierto por otro programa: sale el error y el archivo queda como estaba.
- Cerrar con cambios: los tres botones.
- El título de la ventana.
- Ctrl+N.
- Las teclas de recarga y el menú contextual, en una versión compilada.

### Etapa 5 — Cierre en la PC

- `npm test`, `npm run check`, `npm run humo` entero y `npm run bench` de control (no se toca el dibujo).
- `docs/plan-fase3.md`: estado de T15a.
- Obsidian: sesión, pendientes, errores resueltos y las notas de decisión.
- Commit local, sin push. La prerelease la autoriza Bruno aparte.

## Criterios de cierre

**En la PC**

- `npm test` y `npm run check` limpios; humo entero bien; banco de control sin cuadros lentos nuevos.
- La prueba a mano de la etapa 4, completa.

**En la netbook con Windows (próxima prerelease)**

- Dibujar un circuito con componentes y cables, guardarlo, cerrar la app y abrirlo: idéntico.
- Guardar como; después de Abrir, Ctrl+S pisa ese archivo.
- Cerrar con cambios: los tres botones.
- Las teclas de recarga no pierden el documento.
- El título muestra el nombre y la marca.
- Un archivo dañado muestra el error y el documento sigue.
- Etiqueta y título con tildes sobreviven.
- **D20:** guardar y abrir la escena de 2000 con cables, ≤ 1 s cada uno. Se anota el tiempo real como línea base.
- Banco de control, para la línea base nueva en Windows. Nota "Medición <versión> - netbook Windows".

**Aparte, sin bloquear:** la misma lista en Linux con WebKitGTK.

## Verificado en el código (2026-11-12, sobre `b0c4cec` y `17bf876`)

- `Documento` ya tiene `formato: "bornera"`, `version` (`VERSION_FORMATO = 1`), `meta`, `contadores` y `hojas`. Todas las claves van sin ñ ni tildes.
- `Componente.params` es `Record<string, string>`. Todo el código lo crea vacío y las definiciones de símbolos no declaran parámetros.
- `validarHoja` y `validarCable` no tiran. Aceptan ciclos de apoyos (`puntoExtremo` usa el punto del extremo, no recorre) y la T en el extremo del anfitrión (`puntoSobreRecorrido` incluye los extremos).
- `seApoyaEn` termina aunque haya un ciclo. `src/editor/uniones.test.ts` ya comprueba al azar las tres invariantes (hoja válida, sin ciclos, sin T en el extremo).
- `generarId` usa `contadores[prefijo] ?? 1`. El banco (`src/editor/banco.ts`) usa `generarId`: sus contadores están al día.
- `Historial` no tiene tope ("sin límite") y está atado a un documento. `Editor.documento` es `readonly` y el Editor dibuja solo la hoja 0.
- Un cable sin resolver no se dibuja (`console.warn`); un símbolo desconocido va con "?" (`SIMBOLO_DESCONOCIDO`).
- `conectarEditor` no acumula listeners: `herramientas.desconectar()` quita los 9 que puso (7 del canvas y 2 de `window`) y los del arrastre desde la paleta, restaura `alCambiarHerramienta`, y después se anulan los 5 avisos del editor anterior. La navegación es de la Vista y no se vuelve a conectar.
- `editorDocumento` es `const` en `Lienzo.svelte`, y `bornera.editor` guarda esa referencia fija.
- No hay rango de grilla en el código y la cámara no limita el desplazamiento. El índice espacial anota cada elemento en todas las celdas de 16 unidades que toca.
- `src` no usa ninguna API de Tauri y no hay `beforeunload`. En Tauri solo están el plugin `opener` y los permisos `core:default` y `opener:default`.
- `onCloseRequested` (`@tauri-apps/api` 2.12.4) espera al manejador y llama a `destroy()` si no se previno. `core:window:default` no trae `allow-destroy` ni `allow-set-title`; los dos existen en el esquema generado. `core:event:default` trae `allow-listen`.
- `.github/workflows/release.yml` arma el instalador de Windows (`.msi`, en `windows-latest`) además de AppImage y deb. Corre al empujar un tag `v*`, corre `npm test` y sube todo a un Release en borrador.
- El humo corre contra Vite en Chrome o Edge por CDP, no contra Tauri. Vitest corre en entorno `node`, con Node 26. `src/core` compila con `lib: ES2023`, sin DOM.
- No existe `.gitattributes`, y el repo convierte LF a CRLF.

**Verificado en la fuente de los plugins** (rama `v2` de `tauri-apps/plugins-workspace` y documentación de Tauri 2, leídas el 2026-11-12):

- `open` y `save` del plugin dialog llaman a `allow_file` sobre la ruta elegida si el plugin fs está registrado.
- `rename` del plugin fs comprueba las dos rutas contra el alcance. `read_file` y `write_file` comprueban la suya.
- Los permisos existen con estos nombres: `dialog:allow-open`, `dialog:allow-save`, `fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-rename`, `fs:allow-remove`. Un permiso solo no da acceso a ninguna ruta: hace falta el alcance.
- El alcance se configura con `{ "identifier": "fs:scope", "allow": [{ "path": "..." }] }` y acepta comodines.

## Supuesto (sin verificar)

- **(frenar)** El alcance de fs acepta `**/*.brn.tmp` sin carpeta base y coincide con rutas de Windows. Si no, el temporal queda prohibido.
- **(frenar)** El modelo no produce `-0` (rompería el `toEqual` de ida y vuelta).
- **(frenar)** Los documentos del banco pasan el paquete estricto (sin ciclos ni T en el extremo).
- `allow_file` vale para la ruta exacta, también con caracteres raros en el nombre (corchetes).
- `rename` en Windows reemplaza un archivo que ya existe.
- `CompressionStream` y `DecompressionStream` existen como globales en Vitest con entorno `node`.
- Hay una forma de saber desde el frontend si corre dentro de Tauri (`isTauri` de `@tauri-apps/api/core`).
- El diálogo nativo es modal sobre la ventana.
- En WebView2, F5 y Ctrl+R vienen activos y `preventDefault` en `keydown` los bloquea. El código ya lo hace con F5, pero no consta una prueba en WebView2.
- WebView2 muestra el aviso de `beforeunload`, y destruir la ventana desde `onCloseRequested` no lo dispara.
- El menú contextual del WebView no deja recargar por fuera de las teclas.
- Ctrl+N llega a la página en WebView2.
- CDP puede fijar la carpeta de descargas, cargar un archivo en el `<input>` y aceptar el diálogo de `beforeunload`.
- El pico de memoria al abrir 16 MB queda en unos cientos de MB (estimación: el árbol de objetos pesa varias veces el texto).

## Riesgos

- **El temporal y el alcance de fs.** Es el punto más incierto del camino de escritorio. Se prueba primero en la etapa 4.
- **`beforeunload` puede colgar el humo existente** si CDP no acepta el diálogo. Se prueba primero en la etapa 3.
- **Estricto en los dos sentidos.** Bornera podría armar un documento que no abre (coordenadas fuera de rango, un id puesto a mano por la consola sin subir el contador). D22-B lo frena al guardar, pero deja al usuario con un circuito que no puede guardar hasta arreglarlo.
- **El camino de escritorio no lo cubre el humo.** Queda en prueba a mano.
- **Transformar vuelve a rutear al rehacer** (pendiente anotado en T14a). Podría dejar "sin cambios" un documento que difiere en un recorrido.
- **Linux (aparte, no bloquea).** `CompressionStream` en WebKitGTK, el diálogo nativo en GTK, las teclas de recarga, el evento de cancelar del selector de archivos y el foco de los diálogos propios.
- **D20 sin línea base.** El criterio de 1 s se fijó sin mediciones en Windows.

## Fuera de T15a (pendientes, no se hacen acá)

- Exigir el rango de grilla en los comandos (`Colocar`, `Mover`, `Cablear`, `CambiarExtremo`).
- Conexiones aparentes al abrir, guardar sin comprimir (`.brn.json`), autoguardado y migraciones: fase 4.
- La prueba en Linux con WebKitGTK.
- Asociar los `.brn` a Bornera en Windows (doble clic) y archivos recientes.
- Editar título, autor y fecha del documento.
- Exportar PDF.
- Un tope en `Historial` (con la marca inalcanzable).
