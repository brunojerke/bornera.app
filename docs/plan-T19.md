# Plan T19 — Validaciones en vivo

**Aprobado el 2026-11-15** con las decisiones de la tabla de abajo. Quinta y última tarea de la fase 3b (`docs/plan-fase3b.md`), después de T18. Después viene el cierre de la fase.

**Estado de git al planear (verificado):** `main` en `926915d` (cierre de T18), árbol limpio, 19 commits por delante de `origin/main`, sin push.

**Qué es:** mientras se dibuja, la app marca lo que le falta o le sobra al circuito: contactos sin bobina, etiquetas vacías o repetidas, bornes sin conectar y cables sueltos. Se ve en el lienzo, en la barra de estado y en el panel. No se guarda en el `.brn`: se deriva.

## Decisiones (Bruno, 2026-11-15)

| D | Elegida | Qué |
|---|---|---|
| D-reglas | **R1 a R9** | La tabla de la sección 2. R9 (alimentación sin nombre) entra. |
| R5, prefijo | **A** | Avisa solo si las letras de la etiqueta son el prefijo de otro tipo de la biblioteca (pulsador "K1"). "KM1" o "MARCHA" no avisan. |
| R6, NC contra su bobina | **A** | Un borne del NC "K" comparte una red sin nombre de alimentación con un borne de la bobina "K". |
| R10, Fase y Neutro en una red | **A, fase 5** | No va en T19. Se reconsidera si la etapa 1 mide `redes()` con 2000 por debajo de 1 ms en la PC (ajuste 2). |
| D-color | **A** | Las validaciones quedan en `--aviso` (naranja). Lo que no se puede hacer (previas en conflicto) pasa a un rojo nuevo, `--conflicto`, con su ✕. Las marcas normales de los bornes no cambian. |
| D-forma | **anillo y contorno** | Borne o extremo suelto: anillo. Aviso de etiqueta: contorno a rayas sobre el cuerpo. Misma forma para error y aviso. El anillo está condicionado (ajuste 1). |
| D-dónde | **A** | Lienzo, contador fijo en la barra y notas en el panel al seleccionar. La lista desplegable y el clic para ir quedan para después, junto con el opcional de T18. |
| D-cuándo | **por comando** | En `Editor.reflejar`, nunca al mover el mouse. Núcleo puro y caché en el editor. |
| D-"nada naranja" | **R1 a R9 en cero** | La barra dice "Sin avisos" en la inversión de giro. |
| Topes del banco | **como T18** | Sección 5. |

**Ajustes de Bruno al aprobar:**
1. **R7 y R8 entran en el núcleo, en la barra y en el panel. El anillo en el lienzo queda condicionado** a la medición de la etapa 1 (S2). Si los anillos suben más de 10 % algún escenario común en una corrida de control, se frena y se presentan opciones: solo barra y panel, solo con el componente seleccionado, o anillo solo al 100 % o más.
2. **R10 se reconsidera** si la etapa 1 mide `redes()` con 2000 componentes por debajo de 1 ms en la PC.
3. **Severidad:** *error* es lo que impedirá simular en la fase 5; *aviso*, lo que no. Se anota acá y en `docs/arquitectura.md` al cierre.
4. **Test de R6 con el enclavamiento bien hecho:** el NC "K2" en la rama de K1, junto a A1 de K1, da cero avisos. El duplicado mal hecho da exactamente uno.
5. **Cambio de color de la previa en conflicto:** revisar el humo t16 y ajustarlo si comprueba ese color. Se justifica en el cierre.

## 1. Estado verificado (2026-11-15, sobre `926915d`)

- **Barra de estado** (`src/ui/BarraEstado.svelte`): muestra `aviso ?? "Sin avisos"` en `.avisos`. El aviso es un texto que dura 4 s (`DURACION_AVISO_MS`) y dice que una acción no se pudo hacer. No hay contador ni lista.
- **`problemasComponente` y `problemasTrazado`** (`src/core/model/trazado.ts`): frenan una operación antes de hacerla (Colocar, W, Pegar, mover). No miran el documento quieto.
- **`validarHoja`** (`src/core/model/cables.ts`): integridad del archivo (ids repetidos, referencias, forma de los cables). Un documento hecho con comandos siempre da `[]`. La usan `deserializar` y los tests.
- **Notas del panel (T17):** «Otra bobina de contactor ya se llama K1.» (`textoRepetida`), la del renombrado y la de red. Solo con un componente seleccionado y sin naranja.
- **Naranja hoy, dos casi iguales** (`src/ui/tema.css`):
  - `--aviso` (#c2410c claro, #fb923c oscuro): previa de Colocar en conflicto (`editor.ts`), previa de Pegar en conflicto (`dibujoPegar.ts`), cable en curso inválido y arrastre con conflicto (`cableEnCurso.ts`), siempre con ✕. También un texto de `Rendimiento.svelte`.
  - `--borne` (#d9480f claro, #ff8a4c oscuro): la marca de **todos** los bornes, con cable o sin él (`dibujarMarcasBornes`, radio 0,18), y el círculo del extremo libre de un cable (`RADIO_LIBRE` = 0,25).
- **Zoom:** 20 px por unidad al 100 %. Al 31 % son 6,2 px por unidad: la marca de borne mide 2 px y el extremo libre 3 px. Debajo de 6 px por unidad se apagan textos y marcas (`src/render/detalle.ts`).
- **`cajaDibujo`** (`src/render/simbolo.ts`): la caja del símbolo más 1,5 unidades por lado (`MARGEN_TEXTOS`). Un contorno sobre el cuerpo y un anillo de 0,5 en un borne entran sin agrandarla.
- **El `Renderer` no tiene trazos punteados:** las rayas se hacen con líneas, como el rectángulo de selección (`src/render/resaltado.ts`).
- **Redes** (`src/core/model/redes.ts`): `redes(hoja)` agrupa bornes y cables con union-find, recorre la hoja entera y da los nombres de alimentación de cada red. Un contacto no une sus dos bornes.
- **Clases de símbolos** (`src/core/symbols/tipos.ts` y `src/core/model/etiquetado.ts`): `esFuente`, `esSeguidor`, `esBobina`, `sigueABobina`, `esTitular`, `prefijoDe`. Prefijos de hoy: S (pulsadores), K (bobina) y H (lámpara). La biblioteca tiene 8 símbolos, todos de mando, señalización o alimentación.
- **Cachés del editor que sirven de modelo:**
  - `BornesConCable` (`src/editor/bornesConCable.ts`): qué bornes tienen cable, incremental por cable.
  - `ReferenciasHoja` (`src/editor/referenciasHoja.ts`): por comando, se saltea si el comando no toca lo suyo, devuelve qué cambió y cuenta sus cálculos.
  - `EscenaEditable.actualizar` devuelve la caja vieja y la nueva.
- **Límite de T17b, fijado por tests** (`etiquetado.test.ts` y `armarEtiquetas.test.ts`): al duplicar la rama de K1 con su NC "K2" de enclavamiento, sin bobina K2 en la hoja, la copia queda con bobina K2, NA K2 y NC K2.
- **Humos que tocan lo que cambia:**
  - Ninguno compara el color de una previa: `t16-copiar-pegar.mjs` comprueba el estado (conflictos, pista y aviso), no píxeles. Ningún test nombra `--aviso` ni "Sin avisos".
  - Siete humos leen el texto de `.avisos` después de una acción (t12, t13, t14a, t14c, t15, t16, t17) y t18 lo lee en su paso 8.
- **Faltan:** `tests/circuitos/inversion.brn` y `tests/humo/t19-*.mjs`. `src/core/sim/` está vacío.

### Supuestos (a verificar)
- **S1.** `redes()` con 2000 componentes cuesta de 1 a 3 ms en la PC. Lo mide la etapa 1. Si da menos de 1 ms, se reconsidera R10 (ajuste 2).
- **S2.** La escena del banco tiene muchos bornes sin cable, así que dibujar un anillo en cada uno encarece todos los escenarios. Lo mide la etapa 1 (ajuste 1).
- **S3.** En la inversión de giro, el NC de enclavamiento va pegado a la bobina (su borne 22 en la red de A1). `inversion.brn` todavía no existe.
- **S4.** Una pasada por los componentes para las reglas de etiqueta cuesta menos de 1 ms con 2000, por analogía con T17 y T18. Lo mide el banco.
- **S5.** Que R4 sea *error* supone que la fase 5 no simula con titulares repetidos. Con dos bobinas K1 es claro: los contactos no saben a cuál siguen. Con dos pulsadores S1 lo decide la fase 5; si no la frenan, R4 se parte en dos.

## 2. Diseño

### Palabras
- **Aviso:** un resultado de una regla sobre un componente, un borne o un cable. Tiene regla, severidad y a quién marca.
- **Severidad (ajuste 3):** *error* es lo que impedirá simular en la fase 5. *Aviso* es lo que no: el circuito está incompleto o raro, pero se podrá simular.
- **Seguidor, titular y fuente:** como en T17 (`docs/plan-T17.md`, sección 2).

### Reglas

| # | Regla | Sev. | Marca a | Texto |
|---|---|---|---|---|
| R1 | Contacto sin etiqueta | aviso | el contacto | «Contacto sin etiqueta: no sigue a ninguna bobina.» |
| R2 | Contacto sin bobina | aviso | el contacto | «No hay ninguna bobina K2 para este contacto.» |
| R3 | Titular sin etiqueta | aviso | el titular | «Bobina de contactor sin etiqueta.» (con el nombre del símbolo) |
| R4 | Titulares repetidos | error | todos los repetidos | «Otra bobina de contactor ya se llama K1.» (el texto de T17) |
| R5 | Prefijo de otro tipo | aviso | el titular | «K1 es nombre de bobina y esto es un pulsador NA.» |
| R6 | NC en la rama de su propia bobina | aviso | el NC | «El NC K2 corta a su propia bobina. ¿Es el enclavamiento de otro contactor?» |
| R7 | Borne sin conectar | aviso | el borne | «Borne 14 sin conectar.» |
| R8 | Cable con extremo suelto | aviso | el cable | «Cable con un extremo suelto.» |
| R9 | Alimentación sin nombre | aviso | la fuente | «Alimentación sin nombre de red.» |

Detalle de cada una:
- **R1.** Un seguidor (`esSeguidor`) con la etiqueta vacía.
- **R2.** Un contacto que sigue a bobina (`sigueABobina`), con etiqueta, sin ninguna bobina en la hoja con esa etiqueta normalizada. Cubre también el auxiliar "S1" de la tabla de casos de T18.
- **R3.** Un titular con prefijo (`prefijoDe` no nulo) y la etiqueta vacía. El símbolo desconocido no tiene prefijo y no se marca: ya avisa al abrir.
- **R4.** Dos o más titulares con la misma etiqueta normalizada y no vacía, de cualquier tipo, como el choque de T17 (`etiquetasDeTitulares`). Se marcan todos.
- **R5 (A).** Un titular con prefijo cuya etiqueta es letras y número, con letras distintas de su prefijo e iguales al prefijo de otro símbolo de la biblioteca. Hoy los prefijos son S, K y H: un pulsador "K1" o una lámpara "S2" avisan; una bobina "KM1" o un pulsador "MARCHA" no. Es el caso que confunde a `compararRedes` ("K1·13").
- **R6 (A).** Un auxiliar NC con etiqueta E, una bobina con etiqueta E, y un borne del NC en la misma red que un borne de esa bobina, si esa red no tiene nombre de alimentación (`red.nombres` vacío).
  - **Por qué sin nombre:** todas las bobinas tienen A2 en la red N, y un NC que cuelga de L o de N comparte esa red sin estar en la rama.
  - **Falsos avisos conocidos:** un intermitente hecho a propósito (la bobina cortada por su propio NC). En la marcha-parada, en la rama NC y en el enclavamiento bien hecho da cero.
  - **Lo que no ve:** un NC con algo en el medio entre él y la bobina (S3). La salida, si hace falta, es seguir el camino por los contactos, que es media simulación: queda para la fase 5.
  - `redes()` se llama solo si en la hoja hay un NC y una bobina con la misma etiqueta.
- **R7.** Un borne de un símbolo conocido sin ningún extremo de cable. Un aviso por borne.
- **R8.** Un cable con un extremo `libre`. Un aviso por cable.
- **R9.** Una fuente (`esFuente`) con la etiqueta vacía: no da nombre de red.

### Lo que no va en T19

| Regla | Va en | Por qué |
|---|---|---|
| R10, Fase y Neutro (o dos fases) en la misma red | fase 5 | Obliga a correr `redes()` en cada comando que toca un cable. Se reconsidera con la medición de la etapa 1 (ajuste 2). Sería *error*. |
| Bobina sin alimentación | fase 5 | Es seguir caminos por los contactos: simular. |
| Hoja sin Fase o sin Neutro | fase 5 | Se ve al entrar a simular. |
| Conexiones aparentes (cruces y encimados) | fase 4 | Ya anotado en `docs/plan-fase3.md`. |
| Dos auxiliares con los mismos bornes (dos NA 13-14) | número de orden | Tarea aparte (`docs/plan-fase3b.md`). |

### Núcleo: `src/core/model/validaciones.ts` (puro, sin DOM)
- `validar(hoja, reglas = TODAS)`: los avisos de la hoja, en un orden fijo (el de la hoja y, a igualdad, el de las reglas). Se le puede pedir un subconjunto de reglas: el editor lleva R7 y R8 por su cuenta, y los tests anulan de a una.
- Reglas de etiqueta (R1 a R5 y R9): una pasada por los componentes, con un mapa por etiqueta.
- Reglas de conexión (R7 y R8): una pasada por los cables y otra por los componentes. Es la referencia contra la que se prueba el camino incremental del editor.
- R6: con `redes()`, con el salteo de arriba.
- Cada aviso: regla, severidad, id del componente o del cable, el borne si corresponde y los datos del texto (etiqueta, nombre del símbolo).
- `textoAviso(aviso)`: la línea que se muestra. `contarAvisos(avisos)`: errores y avisos.
- La nota de T17 (`textoRepetida`) pasa a ser el texto de R4: el panel muestra una sola.
- **Por hoja**, como T17 y T18.

### Editor: `src/editor/avisosHoja.ts` (caché, sin vista)
- Guarda los avisos por id y la cuenta por severidad.
- Se pone al día en `Editor.reflejar`, con cada comando (ejecutar, agrupar, deshacer, rehacer). Nunca con `pointermove` ni durante un arrastre: se ve lo viejo hasta soltar.
- **R7 y R8, incremental:** salen de `BornesConCable` y del propio cable. Solo se revisan los bornes de los cables y los componentes del cambio.
- **R1 a R5 y R9, hoja entera:** una pasada, solo si el comando toca componentes.
- **R6:** solo si hay un NC y una bobina con la misma etiqueta, y el comando toca cables o componentes.
- Compara con lo anterior y devuelve los ids cuyo aviso cambió. El editor pasa solo esos por la escena.
- Cuenta sus cálculos, para el test de que mover el mouse no recalcula.
- Un documento nuevo es un editor nuevo, con su propio caché.
- **Descartado:** todo incremental (un contador por etiqueta). Ahorra una pasada pero complica deshacer; queda como salida si el banco no pasa.

### Lienzo (`src/render`)
- **Capa estática**, como la lista de T18: `ComponenteEscena` suma lo que hay que marcar, ya resuelto. El dibujo no sabe de reglas.
- **Aviso de etiqueta (R1 a R6 y R9):** contorno a rayas sobre el cuerpo del símbolo, en `--aviso`. Al 31 % mide 12×25 px en un símbolo de 2×4.
- **Borne sin conectar y extremo suelto (R7 y R8):** anillo hueco de 0,5 de radio alrededor de la marca, en `--aviso`. Al 31 % mide 6 px. **Condicionado (ajuste 1).**
- **Error y aviso:** misma forma. La severidad se lee en la barra y en el panel.
- **Debajo de 6 px por unidad:** las marcas se apagan con los bornes. Queda el contador de la barra.
- **`cajaDibujo` no cambia:** contorno y anillo entran en el margen de 1,5. Lo fija un test.
- **Sin restos:** al cambiar el aviso de un componente, pasa por `EscenaEditable.actualizar`, que invalida su caja.
- **Previas:** las de Colocar y Pegar no muestran avisos. Lo que se arrastra tampoco, hasta soltar.

### Color (D-color A)
- `--aviso` queda para las validaciones.
- `--conflicto`, rojo nuevo, para lo que no se puede hacer: previa de Colocar, previa de Pegar, cable en curso inválido y arrastre con conflicto. Son todos los usos de hoy de `colores.aviso` en la capa dinámica, y pasan juntos para que Colocar y Pegar no queden de colores distintos. Cada uno conserva su ✕ y sus rayas.
- Los dos tonos de `--conflicto` (claro y oscuro) se eligen en la etapa 2, con capturas a 1024×600.
- La forma lleva el significado, por el daltonismo: lo que no se puede hacer es el símbolo o el cable entero teñido, con ✕; una validación es un anillo o un contorno sobre un símbolo en su color normal.
- Las marcas normales de los bornes siguen en `--borne`.

### Barra y panel (D-dónde A)
- **Barra:** contador fijo, «1 error · 3 avisos» o «Sin avisos». El texto de 4 s de una acción lo tapa y después vuelve el contador.
- **Panel, con un componente seleccionado:** sus avisos como notas bajo la etiqueta. Con un cable: «Cable con un extremo suelto.»
- **Para después** (`docs/plan-fase3b.md`): la lista desplegable desde el contador y el clic que lleva al componente, junto con el clic para ir de T18. Usan la misma función.

### `.brn`
No cambia. Los avisos no se guardan ni se leen: se calculan al abrir.

## 3. Qué es "nada naranja" (criterio de la fase 3b)

En la inversión de giro dibujada a mano (`docs/plan-fase3b.md`, "Pasa cuando"), nada queda en naranja si las reglas R1 a R9 dan cero: la barra dice «Sin avisos».

- Se mide por el contador, no a ojo: las marcas normales de los bornes siguen en un tono parecido.
- Un test del núcleo lo fija con `tests/circuitos/inversion.brn` cuando exista, al cierre de la fase.
- En T19 se fija con `marchaParada()` y `marchaParada({ ramaNC: true })`: las dos dan cero.

## 4. Tests (Vitest)

### Núcleo: `src/core/model/validaciones.test.ts`
- **Marcha-parada y rama NC:** cero avisos.
- **Por regla:** un caso que la dispara, con su cuenta exacta, y un caso vecino que no. Se arman con `marchaParada({ ramaNC })` más comandos, o con casos chicos armados con comandos.
- **R5:** pulsador "K7" avisa solo R5; pulsador "K1" con bobina K1 avisa R5 y R4; bobina "KM1" y pulsador "MARCHA" no avisan.
- **R6 (ajuste 4):**
  - Enclavamiento bien hecho: el NC "K2" en la rama de K1, junto a A1 de K1, con las dos bobinas. Cero avisos.
  - Duplicado mal hecho, el límite de T17b: la copia queda con el NC "K2" junto a A1 de K2. Exactamente un R6, en ese NC.
  - Rama NC (el NC K1 que prende H2 desde L): cero.
  - Un NC del lado del neutro, en la red N: cero.
- **Al azar con semilla fija:** secuencias de colocar, mover, borrar, renombrar, cablear, pegar, duplicar, deshacer y rehacer. Después de cada paso, `validar` da lo mismo que un cálculo lento escrito aparte en el test (por cada componente, filtrar toda la hoja). El recorrido exige que cada regla salga al menos una vez.
- **Reglas anuladas a propósito:** con cada regla sacada de `reglas`, su caso y el recorrido al azar tienen que dar una diferencia.
- **`.brn`:** `serializar` de la marcha-parada da los mismos bytes que antes de T19.
- **Mediciones de la etapa 1:** tiempo de `redes()` con 2000 (S1) y cuántos bornes sueltos tiene la escena del banco de 100, 500 y 2000 (S2).

### Editor: `src/editor/avisosHoja.test.ts` y `editor.test.ts`
- Después de cada comando, deshacer y rehacer, el caché es igual a `validar` desde cero. Va en el recorrido al azar, pasando por el editor.
- No recalcula al mover el mouse ni durante un arrastre; sí al soltar.
- Cablear no recorre los componentes; renombrar no recorre los cables.
- Devuelve solo los ids cuyo aviso cambió.
- Con la actualización del caché anulada a propósito, fallan.

### Dibujo: `src/render/simbolo.test.ts` y `escenaEditable.test.ts`
- `cajaDibujo` no cambia con avisos y cubre el contorno y los anillos, en las 4 rotaciones y espejado.
- **Sin restos:** al arreglar el último aviso de un componente, lo invalidado cubre su caja. Pasando por el editor, con la invalidación anulada a propósito, falla.
- Sin avisos, un componente hace las mismas llamadas al `Renderer` que hoy.
- El sha256 de `ESCENA_ACTUAL` (100, 500 y 2000) no cambia.

## 5. Humo, banco y netbook (criterio fijado antes de medir)

### Humo: `tests/humo/t19-validaciones.mjs` a 1024×600
- Un componente recién colocado: el contador sube y, si el anillo va, se ve en sus bornes. Al cablear, baja y el anillo se va.
- Deshacer y rehacer: el contador y las marcas siguen al documento.
- Un contacto sin etiqueta y uno sin bobina: contorno y nota en el panel. Dos bobinas K1: «1 error», y las dos marcadas.
- La marcha-parada completa: «Sin avisos».
- **La previa de Pegar en conflicto y un aviso se distinguen:** los dos en pantalla a la vez, cada uno con su color por píxel y con su forma en la captura.
- Se ve al 31 %. Alejando hasta apagar los bornes, las marcas se apagan y el contador sigue.
- Sin restos al arreglar el último aviso, medido como en t18 (al 200 %, con documentos recién abiertos).
- Mover el mouse no recalcula.
- Guardar y reabrir: los mismos avisos, y el `.brn` no los trae.
- `validarHoja` en 0 y ningún error de la página.
- **Humos que ya existen:**
  - t16 no compara el color de la previa (verificado). Se revisa igual al cambiar el color y, si hay que ajustarlo, se justifica en el cierre (ajuste 5).
  - t18, paso 8 («la segunda K1 no da ningún aviso»): con T19, dos bobinas K1 son un error. Se ajusta y se justifica en el cierre.
  - Los siete humos que leen `.avisos` después de una acción: se comprueba que el texto de 4 s sigue tapando al contador.
- Al cerrar la tarea, `npm run humo` entero.

### Banco (PC enchufada, modo Mejor rendimiento, apps cerradas)
Obligatorio: T19 toca el dibujo y el editor.

- **Corrida de control de la etapa 1 (ajuste 1):** con un anillo de prueba dibujado en un worktree aparte, sin commit, contra `926915d`. Si algún escenario común sube más de 10 %, se frena y se presentan las opciones: solo barra y panel, solo con el componente seleccionado, o anillo solo al 100 % o más.
- **Escenas sin cambios:** el sha256 de `ESCENA_ACTUAL` no cambia.
- **Escenarios que ya existen**, contra `926915d` medido en la misma sesión, ABBA ×3 y dos tandas (6 corridas por versión en cada tanda; por celda, la mediana de las 6). No pasa si:
  - sube más de 10 % en las dos tandas, o
  - aparece un cuadro lento donde la base tiene 0.
- **Pegar 500:** mediana del paso ≤ base + max(10 %, 1 ms), en las dos tandas.
- **Duplicar todo (2000):** mediana del paso ≤ base × 1,10, en las dos tandas. Siguen los topes absolutos (150/300 ms y 40/80 ms en deshacer).
- **Escenario nuevo**, en la escena con cables de 2000 al 31 %, con auxiliares NC renombrados para que haya pares de NC y bobina (el peor caso de R6). El renombrado va fuera de lo medido y la nota dice cuántos avisos hay de cada regla.

| Escenario nuevo | Pasa si |
|---|---|
| *Rehacer al 31 % con avisos* | por gesto ≤ base × 1,15 en las dos tandas, y 0 cuadros lentos nuevos |

- **Base del escenario nuevo:** `926915d` con el escenario copiado a su worktree (solo `tests/bench/pagina.ts`, sin commit).
- La otra versión corre desde un worktree con su propio `npm ci`.
- Las 2 celdas aceptadas como ruido en T18 siguen aceptadas (`docs/plan-T18.md`).
- Si algo no pasa, se frena y se presentan opciones antes de optimizar.

### Netbook
Solo si en la PC un paso pasa la mitad de su tope o aparece un cuadro lento. Si no, va al cierre de la fase 3b, junto con lo vigente: *Duplicar todo (2000)*, *Pegar 500*, el tope 160 de la previa, *Rehacer al 31 % con referencias* y *Mover 1 contacto con referencias al 31 %*.

## 6. Etapas
Cada una en una sesión, con commit local y `/bornera-cierre`. Sin push ni versión. En PowerShell, `npm.cmd`.

| Etapa | Qué | Modelo sugerido |
|---|---|---|
| 0 | Docs: este plan, `plan-fase3b.md` (T19 apunta acá y los opcionales) y Obsidian. Commit solo de docs. **Hecha el 2026-11-15.** | Sonnet |
| 1 | Núcleo: `src/core/model/validaciones.ts` y sus tests (por regla, R6 con el enclavamiento bien y mal hecho, al azar contra el cálculo lento, reglas anuladas, `.brn`). Mediciones S1 y S2 y la corrida de control del anillo (ajuste 1). `npm test` y `npm run check`. | Opus xhigh (lógica del núcleo) |
| 2 | Dibujo y editor: `src/editor/avisosHoja.ts`, `reflejar`, contorno y anillo (según la etapa 1), `--conflicto`, contador de la barra y notas del panel, con sus tests. Prueba visual a 1024×600. | Opus alto |
| 3 | Humo t19, ajuste de t16 y t18 si hace falta, y banco: el escenario nuevo, la comparación contra `926915d` y `docs/bench.md`. | Opus alto |
| 4 | Cierre: este plan, `plan-fase3b.md`, `arquitectura.md` (validaciones hechas y la definición de severidad) y Obsidian. `npm run humo` entero. | Sonnet |

## 7. Riesgos y límites

- **Anillos en la escena del banco (S2).** Si hay miles de bornes sueltos, cada mosaico dibuja más. Lo resuelve el ajuste 1.
- **Un componente recién colocado sale con todos sus bornes marcados.** Es lo que pide "en vivo", pero ensucia el dibujo a medio hacer. Se mira en la prueba visual de la etapa 2.
- **R6 no ve un NC alejado de la bobina** (S3). Límite conocido, con test.
- **R4 como error** depende de lo que decida la fase 5 (S5).
- **Contactos que se enganchan solos** (de T17): R2 se apaga cuando aparece una bobina con esa etiqueta, sea la buscada o no.
- **Hoja a medio dibujar:** el contador casi nunca dice «Sin avisos» hasta terminar. Es el sentido del criterio de la fase.

## 8. Fuera de T19

- La lista desplegable de avisos y el clic para ir al componente (opcionales, `docs/plan-fase3b.md`).
- R10 y las reglas de la tabla "Lo que no va en T19".
- Arreglar el etiquetado al duplicar el NC de enclavamiento: T19 solo avisa (R6).
- El armado de referencia de la inversión y `inversion.brn`: cierre de la fase 3b.
