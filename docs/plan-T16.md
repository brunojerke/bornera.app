# Plan T16 — Copiar, cortar, pegar y duplicar

**Aprobado el 2026-11-13** con D1-A, D2a-A, D2b-A, D3-A, D4 (Ctrl+V A, Ctrl+D B), D5 (Ctrl+V A, Ctrl+D C), D6 confirmada y D7 con Ctrl+Insert y Mayús+Insert, más los ajustes 1 a 4 de Bruno (ya incorporados). Primera tarea de la fase 3b (`docs/plan-fase3b.md`).

**Estado de git al planear (verificado):** `main` en `c29886d` (Versión 0.1.3), igual a `origin/main`, árbol limpio. El tag `v0.1.3` está en origin y apunta a `c29886d` (`git ls-remote`), pero no está bajado en local.

> **Las skills de cuenta no se actualizan desde el repo.** La etapa 0 cambia `.claude/skills/bornera-inicio/SKILL.md` (el plan vigente pasa a ser `docs/plan-fase3b.md`). Eso no actualiza la skill de cuenta `bornera-inicio`: la sincroniza Bruno.

## Decisiones (Bruno, 2026-11-13)

| D | Elegida | Qué |
|---|---|---|
| D1 portapapeles | **A** | Interno, en memoria, fuera del `Editor`. Sobrevive a Ctrl+N y Ctrl+O, así que se puede pegar entre dos archivos en la misma ventana. No pasa entre dos instancias y se pierde al cerrar. Sin serializar ni validar texto ajeno. El `Recorte` se arma pensando en serializarlo después: el portapapeles del sistema (texto JSON con el formato de hoja del `.brn`) queda pendiente. |
| D2a cables entre copiados | **A** | Un cable **no** seleccionado cuyos dos extremos están conectados a lo copiado (borne de un componente copiado o T sobre un cable copiado) se copia igual. |
| D2b cable con un extremo afuera | **A** | Un cable seleccionado con un extremo conectado a algo que no se copia **no se copia**. Lo pegado nunca trae puntas sueltas nuevas. |
| D3 etiquetas | **A** | Lo pegado conserva la etiqueta tal cual, hasta T17. |
| D4 posición | **Ctrl+V A · Ctrl+D B** | Ctrl+V: previa flotante centrada bajo el mouse, que se suelta con un clic. Ctrl+D: al lado, con dx = ancho de la caja de la selección + 2 y dy = 0. |
| D5 conflictos | **Ctrl+V A · Ctrl+D C** | Ctrl+V: la previa en aviso con ✕ no se suelta, igual que Colocar. Ctrl+D: si choca al lado, pasa a la previa flotante en ese lugar para correrla. |
| D6 deshacer | **confirmada** | Pegar y duplicar son un solo comando `Pegar`. Cortar es copiar más un `Borrar`. Los ids se dan al construir. Deshacer no toca el portapapeles. |
| D7 atajos | **con Ctrl+Insert y Mayús+Insert** | Ctrl+C, Ctrl+X, Ctrl+V y Ctrl+D, Mayús+Supr (cortar), Ctrl+Insert (copiar) y Mayús+Insert (pegar). |

**Ajustes de Bruno:**
1. El tope de la previa ("revisar solo al soltar") se fija midiendo en la etapa 3. El tope es el N más grande con el que la revisión por punto da ≤ 8 ms en la PC. Si 500 queda por encima del tope, se saca del criterio la revisión por punto con 500 (sección 4).
2. Los tests de conflicto suman dos casos, con Ctrl+V y con Ctrl+D: un cable existente que pasa sobre un borne pegado, y un extremo suelto existente bajo un borne pegado.
3. Banco: `git fetch --tags` y comparar contra `v0.1.3`.
4. La nota de arriba sobre la skill de cuenta.

## 1. Estado verificado (2026-11-13, sobre `c29886d`)

- **Selección:**
  - Es un conjunto de ids de componentes y cables, `Editor._seleccion` (`src/editor/editor.ts:369`), y no pasa por el historial.
  - El rectángulo también elige cables: de izquierda a derecha lo que queda adentro, de derecha a izquierda lo que toca (`src/editor/herramientas/seleccionar.ts:16`).
  - `idsSeleccionados()` (`editor.ts:854`) da los ids en el orden del documento.
- **Comandos** (`src/core/model/comandos.ts`):
  - Los ids se fijan al construir, con `generarId`, así que rehacer usa los mismos.
  - `Colocar` coloca un solo componente.
  - `Cablear` arma `indexarHoja` en cada `aplicar` (l. 390). Un `Grupo` de N `Colocar` más M `Cablear` sería O(n·m), demasiado para 2000 componentes y 3000 cables. Por eso pegar lleva un comando propio.
  - `Grupo` deshace lo ya aplicado si uno falla.
  - `Borrar` (l. 544) suelta lo que colgaba de lo borrado: el extremo pasa a libre en su punto. Su deshacer es exacto.
- **Colocar** (`src/editor/herramientas/colocar.ts`):
  - La previa se revisa con `problemasComponente` contra la consulta indexada del editor (`editor.ts:877`).
  - Si hay conflicto, la previa se ve en `--aviso` con ✕ y el clic no coloca.
  - En modo clic se rehace la revisión al deshacer (`refrescarHerramienta`).
  - La etiqueta inicial es `def.etiquetaInicial ?? ""`. Solo Fase ("L") y Neutro ("N") tienen una.
- **Reglas de conflicto** (`src/core/model/trazado.ts`):
  - `problemasComponente` (l. 434): borne sobre borne, sobre cable o sobre extremo suelto; cuerpo sobre cuerpo; cable por el cuerpo.
  - `problemasTrazado` (l. 274): cable sobre borne o por un cuerpo, encimado, toque en un vértice, consigo mismo, T sobre un cruce o sobre un extremo suelto, borne sin salidas.
  - Las dos reciben una `ConsultaTrazado`. Cada `Conflicto` tiene una clave por par.
- **Uniones de T14b:** se calculan y no se guardan. El editor las pone al día en `reflejar` (`editor.ts:1473`) con `Uniones.actualizar`.
- **Etiquetas:**
  - No se exige que sean únicas (`src/core/model/etiquetas.ts:3`).
  - En Fase y Neutro no pueden quedar vacías (`validarEtiqueta`).
  - `nombreDeFuente` (`src/core/model/redes.ts:63`) da el nombre de red desde la etiqueta, y `redes(hoja, { unirPorNombre })` une por nombre.
- **Atajos** (`src/editor/atajos.ts`):
  - Con Ctrl, hoy solo hay Z e Y. Mayús+Supr devuelve `null`, reservado para cortar (l. 10–11).
  - El despachador (`src/editor/punteros.ts:201`) corta antes si el foco está en un campo (`esCampoEditable`: INPUT, TEXTAREA, SELECT, contentEditable). El buscador de la paleta es un `<input type="search">` y la etiqueta del panel es un input.
  - Tampoco actúan con un diálogo abierto (`hayModal`) ni en modo Simular (`atajosActivos`).
  - Ctrl+N, Ctrl+O y Ctrl+S están en `src/ui/Ventana.svelte` (letras n, o, s): no chocan.
- **Portapapeles:** no hay. Los plugins de Tauri son dialog, fs y opener; no hay `clipboard-manager`.
- **Banco:** `tests/bench/pagina.ts` tiene escenarios con `medirPaso` (por ejemplo "Borrar y deshacer uno con cables", l. 1037). *Soltar con todo* tarda 33,5 ms por gesto en la PC (`docs/bench.md:110`) y 82 ms en la netbook con Windows: la netbook es unas 2,5 veces más lenta.
- **Pendiente que toca a T16** (`docs/plan-fase3.md`, T14b): "para cuando llegue pegar", acelerar `Uniones` (~15 µs por unión, claves numéricas en `actualizar` y `transformar`, armado inicial ~23 ms con 2000).

### Supuestos (a verificar)
- **S2.** Ctrl+D no hace nada visible en WebView2. Igual se cancela con `preventDefault`.
- **S3.** Revisar la previa de 500 elementos en cada punto tarda más de 8 ms en la PC. Por eso hace falta el tope del ajuste 1.
- **S4.** Reflejar 5000 elementos nuevos cuesta parecido a *soltar con todo*. Si no, se invalida la caja total una sola vez.
- **S5.** Hay una ventana por proceso. Dos instancias no comparten el portapapeles interno (D1-A).

(S1 era el portapapeles del sistema en WebKitGTK: con D1-A no aplica.)

## 2. Diseño

### Núcleo: `src/core/model/portapapeles.ts` (sin DOM)
- **`Recorte`:** copias de componentes y cables, con sus ids originales y su caja. No guarda referencias al documento: sirve aunque el documento cambie o se abra otro.
- **`recortar(hoja, ids): Recorte`**, en O(componentes + cables):
  - Entran los componentes de `ids`.
  - Entran los cables de `ids` con los dos extremos "adentro": un borne de un componente copiado, una T sobre un cable que se copia, o libre.
  - Entran también los cables no seleccionados con los dos extremos **conectados** a lo copiado (D2a-A). Uno no seleccionado con un extremo libre no entra.
  - El resto no entra (D2b-A). Como hay T que se apoyan en T, se itera hasta que no entra nada más. No puede haber ciclos: el documento valida los apoyos.
- **`pegar(doc, recorte, dx, dy, hoja = 0): Pegar`**:
  - Exige enteros.
  - Da los ids nuevos con `generarId`, primero los componentes (`c`) y después los cables (`w`), en el orden del recorte.
  - Remapea los extremos: borne al componente nuevo y T al cable nuevo.
  - Traslada coordenadas, codos y extremos libres.
  - Las etiquetas quedan iguales (D3-A).
- **Comando `Pegar`:**
  - `aplicar` valida todo antes de tocar el documento: ningún id repetido, y `validarCable` de cada cable nuevo contra un solo índice (la hoja más el lote). Recién entonces agrega todo al final de las listas.
  - `deshacer` quita los ids en una pasada, con un `Set`. Rehacer aplica de nuevo con los mismos ids.
  - El `Cambio` trae todos los ids.
- **`problemasPegado(recorte, dx, dy, consulta): Conflicto[]`**:
  - Corre `problemasComponente` de cada componente trasladado y `problemasTrazado` de cada cable trasladado contra la hoja existente.
  - Lo que choca dentro del recorte no cuenta, porque es la copia rígida de algo que ya está en la hoja: se ignora la clave "mismo" (un cable consigo mismo). Los bornes y las T de lo pegado no están en la consulta, así que no se revisan entre sí.
  - Los símbolos desconocidos ("?") no tienen geometría y no dan conflicto, igual que hoy.

### Editor
- **`src/editor/portapapeles.ts`:** el recorte guardado. Es de módulo, no del `Editor`: sobrevive a Ctrl+N y Ctrl+O.
- **`Accion`** suma `copiar`, `cortar`, `pegar` y `duplicar`.
- **Teclas que da `accionDeTecla`:**
  - Ctrl+C y Ctrl+Insert → copiar.
  - Ctrl+X y Mayús+Supr → cortar.
  - Ctrl+V y Mayús+Insert → pegar.
  - Ctrl+D → duplicar.
  - Con otra combinación (Ctrl+Mayús+C, por ejemplo), nada.
  - Ninguna se repite al mantener la tecla. Hoy las teclas con Ctrl se resuelven antes de mirar la repetición, así que estas lo miran aparte.
- **`Editor.accion`:**
  - **Copiar:** arma el recorte de la selección y lo guarda. Sin selección, avisa.
  - **Cortar:** copia y ejecuta `Borrar` con los ids seleccionados, en un solo paso. La selección queda vacía.
  - **Pegar:** si el portapapeles está vacío, avisa "No hay nada para pegar.". Si no, empieza la `HerramientaPegar` en modo Ctrl+V.
  - **Duplicar** (no toca el portapapeles):
    1. Arma el recorte de la selección y revisa una vez la posición al lado, sin tope: es una sola revisión.
    2. Si vale, ejecuta `Pegar` (un paso) y deja seleccionado lo pegado.
    3. Si choca, avisa y entra en la `HerramientaPegar` con ese recorte, ubicada al lado y con sus ✕ (D5-C). Desde ahí sigue al mouse sin saltar: su posición es la de al lado más lo que se movió el mouse desde Ctrl+D.
  - **Cuándo no hacen nada:**
    - Con la herramienta cable: nada. Con un tramo en curso, avisa "Esc cancela el cable en curso.".
    - Con Colocar activa: Ctrl+C, X y D no hacen nada; Ctrl+V termina Colocar y empieza a pegar.
    - Con la previa de pegar: copiar, cortar y duplicar no hacen nada; Ctrl+V vuelve a empezar con el portapapeles.
    - En medio de un gesto (arrastre, rectángulo, reconexión), en modo Simular o con un diálogo abierto: nada.
  - Después de pegar, la selección es lo pegado.
- **`HerramientaPegar`** (`src/editor/herramientas/pegar.ts`), hecha como Colocar en modo clic:
  - La previa va centrada bajo el mouse, con el centro de la caja del recorte redondeado a la grilla. Si el mouse no está en el lienzo, aparece al entrar.
  - Pide redibujo solo cuando cambia el punto de grilla.
  - Con conflictos, la previa se ve en `--aviso` con ✕, la pista dice por qué y el clic no suelta.
  - Si se puede, el clic izquierdo da `Pegar` y termina la herramienta (una pegada por Ctrl+V). Esc y el botón derecho cancelan sin paso.
  - R, M y Supr no hacen nada sobre la previa: lo pegado queda seleccionado y se gira después.
  - Al deshacer o rehacer con la previa abierta, se revisa de nuevo (`revisarDeNuevo`).
- **Dibujo de la previa:** va en la capa dinámica (símbolos y cables trasladados). Con más de `LIMITE_ARRASTRE_COMPLETO` (80) elementos se dibujan solo los contornos, como el arrastre.
- **Tope de revisión** (ajuste 1): con más de `TOPE_PREVIA_PEGAR` elementos (componentes + cables del recorte), la previa no revisa en cada punto. Revisa al soltar, y la pista lo dice, como el arrastre con más de 40 cables. Arranca en 80, provisorio, y la etapa 3 lo fija midiendo. Al soltar se revisa siempre, con cualquier tamaño.
- **Atajos y campos de texto:** el despachador ya descarta los campos editables, así que en la etiqueta del panel o en el buscador Ctrl+C, X y V hacen lo normal sobre el texto. Fuera de los campos, la tecla es nuestra (`preventDefault`): con D1-A no hacen falta los eventos nativos `copy` y `paste`.
- **Sin botones en la barra:** no entran a 1024×600.

### Fase y Neutro (D3-A)
Una Fase "L1" copiada se pega como "L1", y por nombre es la misma red que la L1 que ya existe (`redes` con `unirPorNombre`). Está bien: Fase y Neutro son etiquetas de red, y poner otra L1 dice "este punto va a L1", igual que colocar hoy otra Fase. Si se renumerara, cambiaría el potencial: L1 → L2 es otra fase, con cortocircuito entre fases al simular o una rama sin alimentar. Vaciarla no se puede. Lo mismo con Neutro.

## 3. Tests (Vitest)

### Núcleo: `src/core/model/portapapeles.test.ts`
- **Ida y vuelta:** lo pegado es `toEqual` al original, salvo los ids (con su mapa) y el desplazamiento: componentes, cables, codos y extremos.
- **Qué entra en el recorte:**
  - cables internos seleccionados;
  - un cable no seleccionado entre dos copiados (D2a-A);
  - uno seleccionado con un extremo afuera, en un borne o en una T sobre un cable no copiado (D2b-A, no entra);
  - un extremo libre propio;
  - una cadena de T A ← B ← C, entera y cortada en el medio.
- **Uniones:** `uniones(hoja)` después de pegar son las de antes más las del recorte trasladadas.
- **Deshacer y rehacer:**
  - Deshacer deja el documento `toEqual` al de antes, salvo `contadores`, que no bajan.
  - Rehacer da `toEqual` al resultado del primer `aplicar`, con los mismos ids.
  - `validarHoja` da 0 problemas en los tres estados.
  - Un `aplicar` que falla (un id que ya existe) deja el documento igual.
- **Fuentes:** con Fase "L1" y Neutro "N" copiadas, `redes(hoja, { unirPorNombre: true })` da la misma cantidad de redes con nombre, y el borne copiado cae en la red L1.
- **Conflictos de `problemasPegado`:**
  - borne pegado sobre un borne existente;
  - **cable existente que pasa sobre un borne pegado** (ajuste 2);
  - **extremo suelto existente bajo un borne pegado** (ajuste 2);
  - cuerpo sobre cuerpo, cable existente por un cuerpo pegado y cable pegado por un cuerpo existente;
  - tramos encimados, toque en un vértice, T pegada sobre un cruce existente;
  - extremo libre pegado sobre un borne o un cable existente.
  - En un lugar libre da `[]`. Lo que choca dentro del recorte no cuenta, aunque el original lo tenga.
- **Al azar con semilla fija** (mulberry32, como `seguir.test.ts:711`):
  - Documentos del banco con cables y T, selecciones y desplazamientos al azar.
  - Invariantes: `validarHoja` en 0, las cuentas, y deshacer y rehacer exactos.
  - Si `problemasPegado` da `[]`, **pegar no cambia las redes de lo que ya estaba** (`redes` sin unir por nombre, restringidas a los bornes existentes). Las redes de lo pegado son las del original, trasladadas.

### Editor
- **`atajos.test.ts`:** las 7 teclas nuevas, que no se repiten; combinaciones que no son atajo; Mayús+Supr ya no da `null`.
- **`editor.test.ts`, o uno nuevo:**
  - Copiar sin selección avisa.
  - Cortar es un solo paso y deshacer lo devuelve todo, con lo soltado reconectado.
  - Pegar deja seleccionado lo pegado. El portapapeles sobrevive a un `Editor` nuevo, como con Ctrl+N u Ctrl+O.
  - Lo que no hace nada: con W, con tramo, en medio de un gesto, y Ctrl+V con Colocar activa (la termina).
  - Ctrl+D al lado: un paso. Repetido, arma una fila. Si choca, pasa a la previa flotante (D5-C), Esc no deja paso y el clic en un lugar libre pega.
  - **Los dos casos del ajuste 2 con Ctrl+V** (la previa no se suelta) **y con Ctrl+D** (pasa a la previa flotante).
- **`herramientas/pegar.test.ts`:**
  - La previa se mueve por puntos de grilla y redibuja solo al cambiar.
  - Conflictos y ✕; Esc y botón derecho; clic que pega; revisar de nuevo después de deshacer.
  - Con más de `TOPE_PREVIA_PEGAR` revisa solo al soltar, y la pista lo dice.

## 4. Humo, banco y netbook (criterio fijado antes de medir)

### Humo: `tests/humo/t16-copiar-pegar.mjs` a 1024×600
- Dibujar y seleccionar con el rectángulo; Ctrl+C; Ctrl+V con la previa; clic. Comprobar los ids nuevos, lo seleccionado y `validarHoja` en 0.
- Ctrl+Z y Ctrl+Y: deshacen y rehacen exacto, con los mismos ids.
- Ctrl+X y pegar en otro lado. Mayús+Supr, Ctrl+Insert y Mayús+Insert.
- Ctrl+D al lado, y repetido.
- Ctrl+V sobre un conflicto: aviso, ✕ y sin paso. Uno de los casos del ajuste 2.
- Ctrl+D que choca: previa flotante, se mueve y se suelta. El otro caso del ajuste 2.
- Esc durante la previa.
- Foco en la etiqueta del panel y en el buscador: Ctrl+C y Ctrl+V trabajan sobre el texto.
- Modo Simular: Ctrl+V no hace nada.
- Fase "L1" copiada: sigue siendo "L1".
- Ctrl+N y pegar: el portapapeles sobrevive.
- Al cerrar la tarea, `npm run humo` entero.

### Banco: escena con cables (2000 componentes + 3000 cables), PC de siempre
Escenarios nuevos en `tests/bench/pagina.ts`, al 31 %. Pegan a la derecha de la caja de la escena, sin conflictos, y alternan con deshacer:

| Escenario | Qué mide | Pasa si |
|---|---|---|
| *Pegar 500 y deshacer* | paso de pegar y paso de deshacer (`medirPaso`), y los cuadros siguientes | cada paso: mediana ≤ 40 ms y máximo ≤ 80 ms; 0 cuadros lentos (> 16 ms) |
| *Duplicar todo (2000) y deshacer* | Ctrl+D con todo seleccionado; cada paso y los cuadros siguientes | cada paso: mediana ≤ 150 ms y máximo ≤ 300 ms; 0 lentos |
| *Previa de pegar N* (N = 40, 80, 160, 320, 500) | cuadros de la previa y revisión por punto | por cuadro: mediana ≤ 4 ms, p95 ≤ 8 ms y 0 lentos. **`TOPE_PREVIA_PEGAR` = el N más grande con revisión por punto ≤ 8 ms (mediana; el máximo se informa)**. Si 500 > tope, la revisión con 500 sale del criterio (ajuste 1); sus cuadros, con revisión al soltar, siguen contando |
| *Copiar 2000* | paso de Ctrl+C | solo se informa |

Por qué esos números: con el factor de 2,5 de la netbook, 40 ms en la PC son unos 100 ms allá, la respuesta inmediata para una acción puntual. Duplicar 2000 es el caso extremo: 150 ms son unos 375 ms en la netbook, sin cuadros lentos después.

**Sin regresión** en los escenarios que ya existen, contra `v0.1.3`:
- `git fetch --tags` (ajuste 3) y un worktree en `v0.1.3` con su propio banco y `npm ci`.
- Regla de `docs/plan-T15.md` §6: ABBA ×3 y dos tandas. Cuentan la mediana y el p95 por cuadro, sin redondear, y los lentos sumados.
- No pasa si sube más de 10 % y se repite en la tanda 2, o si aparece cualquier lento donde `v0.1.3` tiene 0.
- Los escenarios nuevos no existen en `v0.1.3`: se miden solo en HEAD.

**Si no pasa duplicar 2000:** el primer sospechoso es `Uniones` (el pendiente de T14b, "para cuando llegue pegar"). Se perfila el paso y, si `Uniones` pesa, se acelera en T16 (claves numéricas). Si no, el pendiente sigue abierto. El segundo sospechoso es la invalidación de a una caja por elemento (S4).

### Netbook
Solo si en la PC algún paso pasa la mitad de su tope, si aparece un cuadro lento, o si el tope de la previa da menos de 40. Hace falta una alpha (la 0.1.3 final no tiene F3 ni menú de desarrollo), así que primero va la autorización de Bruno.

## 5. Etapas
Cada etapa es una sesión, cierra con `/bornera-cierre` y hace commit local. Sin push ni versión.

| Etapa | Qué | Modelo |
|---|---|---|
| 0 | Docs: `plan-fase3b.md`, este plan, `arquitectura.md` (fase 3b en la hoja de ruta y la nota de "Editor e interfaz"), `plan-fase3.md`, `SKILL.md` de bornera-inicio y Obsidian. Commit solo de docs. **Hecha.** | Opus (la sesión del plan) |
| 1 | Núcleo: `portapapeles.ts` (`Recorte`, `recortar`, `pegar`/`Pegar`, `problemasPegado`) con sus tests, los del ajuste 2 y los de al azar. `npm test`, `npm run check` (incluye `check:core`). | Opus xhigh |
| 2 | Editor: acciones y atajos, `src/editor/portapapeles.ts`, `HerramientaPegar` con previa dinámica, contornos y tope provisorio, y Ctrl+D con paso a la previa. Tests del editor. Prueba a mano en `npm run dev`. | Opus alto |
| 3 | Humo t16 y banco: escenarios nuevos, `TOPE_PREVIA_PEGAR` medido, regresión contra `v0.1.3`, `docs/bench.md`. Si duplicar 2000 no pasa, `Uniones` (sección 4). | Opus alto |
| 4 | Cierre: este plan y `plan-fase3b.md`, `arquitectura.md` si hace falta, Obsidian (Bornera.md, nota de medición), `npm run humo` entero. | Sonnet |

## 6. Riesgos
- **Cortar y pegar en el mismo lugar se rechaza.** Los cables externos quedaron con el extremo libre sobre los bornes viejos, y pegar ahí da "borne sobre el extremo suelto de un cable". Para volver atrás está Ctrl+Z. Pegar no reconecta.
- **Duplicar una selección grande al lado puede quedar fuera de la vista.** La cámara no se mueve; lo pegado queda seleccionado.
- **Dos bobinas K1 al duplicar una rama con su bobina** (D3-A). Se renombra a mano en el panel. T17 decide la numeración al pegar y T19 o la fase 5, el aviso.
- **Los contadores suben con cada pegado y no bajan al deshacer**, como manda la regla de ids. Con 2000 duplicados, los ids siguientes saltan 5000.
- **Costo de reflejar 5000 elementos de una vez** (S4) y de `Uniones` (sección 4).
