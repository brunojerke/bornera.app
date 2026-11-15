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

**Cambios de Bruno al arrancar la etapa 1 (2026-11-15):**
6. **R4 se parte por casos.** Error solo si en el grupo hay algún titular que no es pulsador (con la biblioteca de hoy, bobinas y lámparas; un símbolo desconocido cuenta como "no pulsador"). Un pulsador NA y uno NC con la misma etiqueta se permiten: es un pulsador de doble contacto. Dos pulsadores del mismo tipo con la misma etiqueta dan aviso. Un pulsador "K1" con la bobina K1 es error. Resuelve S5.
7. **Un solo aviso por la misma equivocación:** un componente con un error R4 no recibe además R5. Pulsador "K1" con bobina K1: 2 errores R4 y 0 avisos R5.
8. **Anillo, opción C (después de la corrida de control, sección 9):** R7 y R8 van en la barra y en el panel. En el lienzo, los anillos se dibujan solo en la capa dinámica y solo para el único componente o cable seleccionado; con varios seleccionados, sin anillos. Descartadas: (A) los anillos en un solo trazo (no pasa), (B) solo barra y panel, (D) anillo solo al 100 % o más (*Rehacer al 100 %* ya sube de 8 a 20 %).
9. **Contorno de etiqueta, opción P (después de su corrida de control, sección 9):** el contorno a rayas va en la capa estática como se diseñó. Se acepta como costo la suba del p95 de *Encuadrar (F)* con 500, que se mide en la netbook al cierre de la fase 3b (pasa si no hay cuadros lentos).

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
- **S1.** `redes()` con 2000 componentes cuesta de 1 a 3 ms en la PC. Lo mide la etapa 1. Si da menos de 1 ms, se reconsidera R10 (ajuste 2). **Medido (sección 9): 1,1 a 1,6 ms con cables; R10 sigue en la fase 5.**
- **S2.** La escena del banco tiene muchos bornes sin cable, así que dibujar un anillo en cada uno encarece todos los escenarios. Lo mide la etapa 1 (ajuste 1). **Medido (sección 9): se confirma; anillo en la opción C (cambio 8).**
- **S3.** En la inversión de giro, el NC de enclavamiento va pegado a la bobina (su borne 22 en la red de A1). `inversion.brn` todavía no existe.
- **S4.** Una pasada por los componentes para las reglas de etiqueta cuesta menos de 1 ms con 2000, por analogía con T17 y T18. Lo mide el banco.
- **S5.** Que R4 sea *error* supone que la fase 5 no simula con titulares repetidos. Con dos bobinas K1 es claro: los contactos no saben a cuál siguen. Con dos pulsadores S1 lo decide la fase 5; si no la frenan, R4 se parte en dos. **Resuelto (cambio 6):** R4 se partió; los pulsadores repetidos no son error.

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
| R4 | Titulares repetidos | error o aviso (cambio 6) | los repetidos | «Otra bobina de contactor ya se llama K1.» (el texto de T17) |
| R5 | Prefijo de otro tipo | aviso | el titular | «K1 es nombre de bobina y esto es un pulsador NA.» |
| R6 | NC en la rama de su propia bobina | aviso | el NC | «El NC K2 corta a su propia bobina. ¿Es el enclavamiento de otro contactor?» |
| R7 | Borne sin conectar | aviso | el borne | «Borne 14 sin conectar.» |
| R8 | Cable con extremo suelto | aviso | el cable | «Cable con un extremo suelto.» |
| R9 | Alimentación sin nombre | aviso | la fuente | «Alimentación sin nombre de red.» |

Detalle de cada una:
- **R1.** Un seguidor (`esSeguidor`) con la etiqueta vacía.
- **R2.** Un contacto que sigue a bobina (`sigueABobina`), con etiqueta, sin ninguna bobina en la hoja con esa etiqueta normalizada. Cubre también el auxiliar "S1" de la tabla de casos de T18.
- **R3.** Un titular con prefijo (`prefijoDe` no nulo) y la etiqueta vacía. El símbolo desconocido no tiene prefijo y no se marca: ya avisa al abrir.
- **R4 (cambio 6).** Titulares con la misma etiqueta normalizada y no vacía (`etiquetasDeTitulares`), por grupo:

  | Grupo | Resultado |
  |---|---|
  | Algún titular que no es pulsador: dos bobinas, dos lámparas, bobina y lámpara, pulsador "K1" con bobina K1, desconocidos | **error** en todos |
  | Pulsador NA y pulsador NC | nada: pulsador de doble contacto |
  | Dos o más pulsadores del mismo tipo | **aviso** en los del mismo tipo (en NA, NA y NC se marcan las dos NA) |

  El texto nombra al otro: el primero del grupo en el orden de la hoja (del mismo tipo, en el aviso).
- **R5 (A).** Un titular con prefijo cuya etiqueta es letras y número, con letras distintas de su prefijo e iguales al prefijo de otro símbolo de la biblioteca. Hoy los prefijos son S, K y H: un pulsador "K1" o una lámpara "S2" avisan; una bobina "KM1" o un pulsador "MARCHA" no. Es el caso que confunde a `compararRedes` ("K1·13"). **No se suma a un error R4 del mismo componente (cambio 7).**
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
- **Borne sin conectar y extremo suelto (R7 y R8):** anillo hueco de 0,5 de radio alrededor de la marca, en `--aviso`. Al 31 % mide 6 px. **Opción C (cambio 8):** solo en la capa dinámica, para el único componente o cable seleccionado. La capa estática no dibuja anillos.
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
- **R4 (cambio 6):** pulsador NA y NC "S1": cero; dos pulsadores NA "S1": dos avisos R4; dos bobinas K1: dos errores R4. También dos lámparas, NA, NA y NC (aviso solo en las NA) y un desconocido repetido.
- **R5:** pulsador "K7" avisa solo R5; pulsador "K1" con bobina K1 da 2 errores R4 y 0 avisos R5 (cambio 7); bobina "KM1" y pulsador "MARCHA" no avisan.
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
Solo si en la PC un paso pasa la mitad de su tope o aparece un cuadro lento. Si no, va al cierre de la fase 3b, junto con lo vigente: *Duplicar todo (2000)*, *Pegar 500*, el tope 160 de la previa, *Rehacer al 31 % con referencias* y *Mover 1 contacto con referencias al 31 %*. **Suma de la etapa 1:** *Encuadrar (F)* con 500 y los contornos de etiqueta, que pasa si no hay cuadros lentos (sección 9, cambio 9).

## 6. Etapas
Cada una en una sesión, con commit local y `/bornera-cierre`. Sin push ni versión. En PowerShell, `npm.cmd`.

| Etapa | Qué | Modelo sugerido |
|---|---|---|
| 0 | Docs: este plan, `plan-fase3b.md` (T19 apunta acá y los opcionales) y Obsidian. Commit solo de docs. **Hecha el 2026-11-15.** | Sonnet |
| 1 | Núcleo: `src/core/model/validaciones.ts` y sus tests (por regla, R6 con el enclavamiento bien y mal hecho, al azar contra el cálculo lento, reglas anuladas, `.brn`). Mediciones S1 y S2 y la corrida de control del anillo (ajuste 1). `npm test` y `npm run check`. **Hecha el 2026-11-15** (abajo). | Opus xhigh (lógica del núcleo) |
| 2 | Dibujo y editor: `src/editor/avisosHoja.ts`, `reflejar`, contorno y anillo (según la etapa 1), `--conflicto`, contador de la barra y notas del panel, con sus tests. Prueba visual a 1024×600. **Hecha el 2026-11-15** (abajo). | Opus alto |
| 3 | Humo t19, ajuste de t16 y t18 si hace falta, y banco: el escenario nuevo, la comparación contra `926915d` y `docs/bench.md`. | Opus alto |
| 4 | Cierre: este plan, `plan-fase3b.md`, `arquitectura.md` (validaciones hechas y la definición de severidad) y Obsidian. `npm run humo` entero. | Sonnet |

### Etapa 1 hecha (2026-11-15)
- **`src/core/model/validaciones.ts`**, puro y sin DOM:
  - `validar(hoja, reglas = TODAS)`: los avisos en un orden fijo. Primero los componentes, en el orden de la hoja: en cada uno, por regla, y los de R7 por borne en el orden de su definición. Después los cables (R8). Con un subconjunto de reglas da lo mismo que filtrar el resultado completo, porque R5 mira la condición de R4 aunque R4 no se pida.
  - También `textoAviso`, `contarAvisos` y el tipo `Aviso`, una unión por regla con los datos de su texto.
- **R4 (cambios 6 y 7):** el "pulsador" se generaliza como *contacto a mano*, que es un titular con accionamiento: hoy, los pulsadores NA y NC. Un selector futuro entra igual.
  - El texto nombra al primer otro del grupo en el orden de la hoja; en el aviso, al primero del mismo tipo.
  - El símbolo desconocido se nombra «Símbolo desconocido», como en el editor (`SIMBOLO_DESCONOCIDO`).
- **R5:** los prefijos salen de la biblioteca, cada uno con la palabra que nombra: K «bobina», S «pulsador» y H «lámpara».
- **R6:** llama a `redes()` solo si hay un auxiliar NC con la etiqueta de una bobina.
- **`textoRepetida`** pasó de `src/ui/propiedades.ts` al núcleo, porque es el texto de R4. `propiedades.ts` la reexporta y el panel no cambia.
- **Tests:**
  - **`validaciones.test.ts`, 41 tests:**
    - La marcha-parada (con rama NC y con dos neutros), la hoja vacía y el mando de inversión con el enclavamiento bien hecho dan cero con todas las reglas.
    - Cada regla tiene un caso que la dispara y uno vecino que no. R4 cubre sus tres casos pedidos y R5 queda callado por un error R4.
    - El duplicado mal hecho da exactamente un R6, en el NC de la copia. El límite S3 queda fijado.
    - Orden, subconjuntos, textos y cuentas.
    - Que validar no cambie el documento ni el `.brn`.
  - **Al azar:** 600 operaciones, semilla 20261115. Colocar, mover, rotar, espejar, borrar, renombrar (también fuentes y con arrastre), cablear (de borne a borne, de NC a bobina, a un extremo libre y en T), copiar, pegar, duplicar, deshacer y rehacer.
    - Se compara contra un cálculo lento escrito aparte: normalización propia y búsqueda a lo ancho por los cables, sin `redes()`.
    - Cada regla sale, también R4 en sus dos severidades, el pulsador de doble contacto sin aviso y R5 callado por R4.
    - **Reglas anuladas:** sin cualquiera de las nueve, el recorrido da distinto. También con la normalización anulada y con las redes anuladas (R6 se apaga).
    - Unos 1,4 s en la PC.
  - **`tests/circuitos/marcha-parada.test.ts`:** con las validaciones calculadas, `serializar` da el mismo texto que el `.brn` congelado.
- **Verificación:** `npm test` 1711 en verde (1 saltado, `npm run circuito` sin `BORNERA_BRN`), `npm run check` 0 errores. Sin banco: la etapa no toca el dibujo; las corridas de control están en la sección 9.
- **Queda para la etapa 2:**
  - La nota de T17 en el panel (`repetida`) hoy avisa también a un NA y un NC con la misma etiqueta. Se reemplaza por el texto de R4, que los permite.
  - Contorno y anillo según los cambios 8 y 9: el contorno, sin crear objetos por componente al dibujar.

### Etapa 2 hecha (2026-11-15)
Aprobada con D1 a D4 como se propusieron y tres ajustes de Bruno: (a) R1 a R5 y R9 se recalculan solo si el comando agrega, borra o cambia etiqueta o tipo; (b) dejar preparado el escenario de banco «dibujar 1 cable con 2000 y un par NC+bobina»; (c) ajustar t18 paso 8 en esta etapa y cerrar con el humo completo en verde. Más los agregados del arranque: el umbral de 6 px/u antes de calcular nada, con test, y las validaciones solo por comando.

- **`src/editor/avisosHoja.ts`**, el caché. Se pone al día solo en `Editor.reflejar`. Cada parte, solo si el comando la puede mover:
  - **R1 a R5 y R9:** una pasada (`validar` con esas reglas) solo si algún componente del cambio se agregó, se borró o cambió de tipo o de etiqueta (ajuste (a)). Mover, girar y espejar no la recorren.
  - **R6:** `validar(h, ["R6"])` solo si hay un auxiliar NC con la etiqueta de una bobina (`hayCandidatosR6`, nueva en el núcleo, una pasada sin `redes()`) y cambió lo que une la hoja: los extremos de un cable (a qué borne, cable o nada llega; las coordenadas no cuentan) o las etiquetas.
  - **R7 y R8, incremental:** los bornes de los componentes agregados, borrados o de otro tipo, los de los componentes a los que llegaban o llegan los cables cuyos extremos cambiaron, y esos cables. Sale de `BornesConCable`, que ahora se pone al día antes.
  - Devuelve los contornos que cambiaron (la escena los rehace aunque el cambio no los nombre: R2 al aparecer la bobina), los ids cuyos avisos cambiaron (panel y anillo) y si cambió la cuenta (barra). Cuenta sus pasadas y los bornes revisados.
- **Contorno (opción P):** `ComponenteEscena.conAviso`, resuelto por el editor. En `dibujarComponentes`, **lo primero es `detalle.bornes`**: debajo de 6 px/u no se lee ni un campo (agregado 1). Encima, la caja del cuerpo se calcula en línea y las rayas (0,5 y 0,5, con 0,25 de margen; 16 en un símbolo de 2×4) van a un arreglo del módulo que se reusa, en un solo `lineas`, en `--aviso`.
- **Anillo (opción C):** `dibujarAnillos` en `resaltado.ts`, en la capa dinámica, con un único seleccionado, sin arrastre, a 6 px/u o más y solo los que tocan la pantalla. Los puntos salen del caché y se rearman solo con otro cambio o selección (`anillosSeleccion`).
- **`--conflicto`:** `#881337` en claro y `#e11d48` en oscuro (D4). Elegidos por luminancia para que se distingan de `--aviso` también en grises: 1,85:1 y 2,08:1 contra el naranja, 9,3:1 y 4,0:1 contra el lienzo. Pasan a él la previa de Colocar y de Pegar, el cable en curso inválido, el arrastre con conflicto y las ✕. `Colores.aviso` queda para las validaciones (`ColoresContenido`).
- **Barra:** `textoContador`, «Sin avisos», «1 error · 3 avisos». El texto de 4 s de una acción lo tapa. Con avisos, en `--aviso`. Llega por `Lienzo.cuentaAvisos` (`alCambiarAvisos`).
- **Panel:** `ResumenSeleccion` lleva `avisos` del caché, en el componente y en el cable. Se sacó `repetida` y `titularRepetido` (una pasada por la hoja menos). `notasAvisos`: el rótulo «Error» va aparte, delante, y el texto de la nota no cambia (D1); los bornes sueltos van en una línea, «Bornes A1 y A2 sin conectar.» (D2); R9 no se repite en la fuente (D3). La nota de T17 es ahora el texto de R4: un pulsador NA y uno NC con la misma etiqueta ya no la dan. Si un comando cambia los avisos de lo seleccionado sin nombrarlo (cablear la bobina seleccionada), el panel se entera.
- **Banco (ajuste (b)), al final de la lista, sin medir todavía:** *Rehacer al 31 % con avisos* y *Dibujar 1 cable con 2000 y un par NC+bobina al 31 %*. El par se arma colocando un auxiliar NC con la etiqueta de la primera bobina, fuera de lo medido (en la escena del banco no hay auxiliares NC). No dependen de `editor.avisos`: se pueden copiar a `926915d` como base. Corrida de prueba (una sola, no es medición): los dos corren; R6 se calculó 42 veces en el segundo, unos 2,3 ms por paso en la PC.
- **Humo t18, paso 8 (ajuste (c)):** decía «la segunda K1 no da ningún aviso». T18 no tenía validaciones: el aviso que miraba era el de una acción rechazada, y sigue igual. Se agregó que las dos K1 tienen un error R4 y la cuenta dice 2 errores.
- **Dos bobinas K1 dan «2 errores»**, uno por componente, como marca el núcleo. La sección 5 dice «1 error»: el humo t19 de la etapa 3 espera 2.
- **Tests:**
  - `avisosHoja.test.ts`, 22. Mover, girar y espejar 2000 (y mover todo en la escena con cables): 0 pasadas de validar y 0 bornes revisados (ajuste (a)). Cablear no recorre los componentes: solo los 4 bornes del cable. Mover el mouse, arrastrar y dibujar cuadros no recalculan (agregado 2). Lo que devuelve. Sin restos, con su prueba a propósito. Panel, anillo, color de la previa en conflicto. Recorrido al azar de 400 pasos (semilla 20261115) por el editor contra `validar` desde cero: caché, cuenta y contornos de la escena, con las 9 reglas y todas las operaciones. A propósito: con la puesta al día anulada, con R7 sin los bornes de los cables y con R6 sin recalcular, el recorrido lo nota.
  - `escena.test.ts`, 5. Debajo del umbral, 0 lecturas de `conAviso` y las mismas llamadas que sin avisos (agregado 1). Encima: un trazo, en el color de aviso, sobre el cuerpo más 0,25, girado, y el mismo arreglo entre cuadros. Sin avisos, nada nuevo. `cajaDibujo` cubre contorno y anillos en las 4 rotaciones y espejado.
  - `propiedades.test.ts`, 3, y los de `repetida` pasados a R4 (más el pulsador de doble contacto).
- **Prueba visual a 1024×600**, claro y oscuro, con capturas en grises: el contorno y la previa de Pegar en conflicto juntos se distinguen por color y por forma. En oscuro y en grises, el conflicto queda más apagado que en claro, pero conserva sus ✕. Al 31 % se ven los contornos; al 25 % se apagan y el contador sigue.

## 7. Riesgos y límites

- **Anillos en la escena del banco (S2).** Si hay miles de bornes sueltos, cada mosaico dibuja más. Lo resuelve el ajuste 1.
- **Un componente recién colocado sale con todos sus bornes marcados.** Es lo que pide "en vivo", pero ensucia el dibujo a medio hacer. Se mira en la prueba visual de la etapa 2.
- **R6 no ve un NC alejado de la bobina** (S3). Límite conocido, con test.
- **R4 como error** depende de lo que decida la fase 5 (S5). Con el cambio 6, solo para lo que no es pulsador.
- **Contactos que se enganchan solos** (de T17): R2 se apaga cuando aparece una bobina con esa etiqueta, sea la buscada o no.
- **Hoja a medio dibujar:** el contador casi nunca dice «Sin avisos» hasta terminar. Es el sentido del criterio de la fase.

## 8. Fuera de T19

- La lista desplegable de avisos y el clic para ir al componente (opcionales, `docs/plan-fase3b.md`).
- R10 y las reglas de la tabla "Lo que no va en T19".
- Arreglar el etiquetado al duplicar el NC de enclavamiento: T19 solo avisa (R6).
- El armado de referencia de la inversión y `inversion.brn`: cierre de la fase 3b.

## 9. Mediciones de la etapa 1 (2026-11-15, PC)

### S1: `redes()` con 2000
En Node (el V8 de Edge y WebView2), sobre `877fd69`: 20 vueltas de calentamiento y la mediana de 50, en 4 corridas.

| Escena | Mediana | Bornes | Sin cable | Cables | Con extremo libre |
|---|---:|---:|---:|---:|---:|
| 2000 sin cables | 0,72 a 0,86 ms | 3405 | 3405 | 0 | 0 |
| 2000 con cables | 1,10 a 1,63 ms | 3405 | 529 | 3030 | 30 |

R10 se calcularía al cablear, así que decide la escena con cables: pasa de 1 ms. **R10 sigue en la fase 5.**

### S2: bornes sin cable en las escenas del banco

| Escena | 100 | 500 | 2000 |
|---|---:|---:|---:|
| Sin cables: bornes / sin cable | 171 / 171 | 858 / 858 | 3405 / 3405 |
| Con cables: sin cable / cables con extremo libre | 73 / 30 | 194 / 30 | 529 / 30 |

### Corrida de control del anillo (ajuste 1)
- Worktree en `877fd69` con su propio `npm ci`, sin commit. Anillo hueco de 0,5 en **todos** los bornes, en la capa estática, cuando se dibujan las marcas: es la cota superior, y en la escena sin cables, la real.
- Base: el árbol principal en `877fd69`, con el mismo código que `926915d`.
- ABBA ×3 por tanda: 6 corridas por versión y, por celda, la mediana de las 6. T1 de 15:11 a 15:16 y T2 de 15:17 a 15:21 (UTC). Las 24 corridas, con la PC enchufada (79 %), en "Mejor rendimiento" y sin apps abiertas, anotado por el script. Edge 157 headless.
- Por gesto en ms. ⚠ = sube más de 10 %.

**T1: un anillo por borne.** 16 de 73 celdas suben más de 10 % por gesto. Lentos: 1 en la base y 0 con el anillo.

| Escena | Escenario | Base | Anillo |
|---|---|---:|---:|
| 100 | Rehacer al 100 % | 11,96 | 13,50 (+13 %) ⚠ |
| 100 | Encuadrar (F) | 10,04 | 12,01 (+20 %) ⚠ |
| 100 | Editar al 31 % | 40,98 | 48,85 (+19 %) ⚠ |
| 500 | Rehacer al 31 % | 16,56 | 18,73 (+13 %) ⚠ |
| 500 | Arrastrar 40 completos al 58 % | 38,63 | 43,48 (+13 %) ⚠ |
| 2000 | Rehacer al 100 % | 10,53 | 11,38 (+8 %) |
| 2000 | Rehacer al 31 % | 23,14 | 26,15 (+13 %) ⚠ |
| Con cables | Rehacer al 31 % | 23,87 | 26,91 (+13 %) ⚠ |
| Con cables | Rehacer al 31 % con referencias | 24,08 | 27,15 (+13 %) ⚠ |
| Con cables | Arrastrar 40 cableados al 58 % | 97,33 | 109,00 (+12 %) ⚠ |

**T2: todos los anillos de un mosaico en un solo trazo** (un cambio de estilo y un `stroke`, con un `anillos()` de prueba en `RendererCanvas`; verificado con un contexto falso: un anillo por borne). 20 de 73 celdas suben más de 10 % por gesto. Lentos: 0 en la base y 1 con la variante (*Girar todo al 31 %*).

| Escena | Escenario | Base | Un trazo |
|---|---|---:|---:|
| 100 | Rehacer al 100 % | 12,05 | 14,34 (+19 %) ⚠ |
| 100 | Encuadrar (F) | 9,94 | 12,29 (+24 %) ⚠ |
| 100 | Editar al 31 % | 39,38 | 46,02 (+17 %) ⚠ |
| 500 | Rehacer al 100 % | 10,81 | 12,97 (+20 %) ⚠ |
| 500 | Rehacer al 31 % | 16,20 | 18,10 (+12 %) ⚠ |
| 500 | Arrastrar 40 completos al 58 % | 35,82 | 41,12 (+15 %) ⚠ |
| 2000 | Rehacer al 100 % | 10,38 | 12,15 (+17 %) ⚠ |
| 2000 | Rehacer al 31 % | 23,26 | 24,96 (+7 %) |
| Con cables | Rehacer al 31 % con referencias | 24,10 | 25,77 (+7 %) |
| Con cables | Arrastrar 40 cableados al 58 % | 93,33 | 103,67 (+11 %) ⚠ |

**Lectura:** la mediana por cuadro casi no cambia (8,4 ms en *Rehacer*); sube la cola, los mosaicos que se rehacen. Juntar el trazo no ayuda: el costo es rasterizar miles de círculos por software, no la cantidad de llamadas. Las subas son de 1 a 3 ms por gesto, y en la netbook serían mayores. **Decisión de Bruno: opción C (cambio 8).**

### Corrida de control del contorno de etiqueta (Bruno, después de elegir C)
- **Conteo:** en la escena del banco, los únicos avisos de etiqueta son R2, en todos los auxiliares NA: 12 de 100, 75 de 500 y 277 de 2000 (igual con cables), el 14 %. El banco numera bobinas y auxiliares con el mismo contador K, así que ningún auxiliar tiene la etiqueta de una bobina. R1, R3, R4, R5, R6 y R9 dan 0, y no hay auxiliares NC.
- **Contorno medido:** rayas de 0,5 (y huecos de 0,5) sobre la caja del cuerpo más 0,25 de margen, 16 rayas en un símbolo de 2×4. Solo en los auxiliares, solo con los bornes visibles (6 px por unidad o más), y todas las de un mosaico en un solo `lineas`, como lo haría la etapa 2. Verificado con un contexto falso: 12 auxiliares dan 192 rayas en una sola llamada. En los escenarios *con referencias* es cota superior: ahí los auxiliares siguen a una bobina y no darían R2.
- Mismo worktree vuelto a `877fd69`, misma base y mismo método que el anillo. Una primera tanda se descartó: Opera estuvo abierto en las 12 corridas (corridas de 32 s en vez de 20 y la base entre 22 y 98 % más lenta). Se repitió con Opera cerrado: T3 de 15:47 a 15:51 y T4 de 15:51 a 15:55 (UTC), las 24 corridas con la PC enchufada, en "Mejor rendimiento" y sin apps.

Por gesto en ms. ⚠ = sube más de 10 %.

| Escena | Escenario | Base T3 | Contorno T3 | Base T4 | Contorno T4 |
|---|---|---:|---:|---:|---:|
| 100 | Editar al 31 % | 39,53 | 42,68 (+8 %) | 40,40 | 42,63 (+6 %) |
| 500 | Rehacer al 31 % | 15,89 | 16,46 (+4 %) | 15,86 | 16,19 (+2 %) |
| 500 | Encuadrar (F) | 7,29 | 7,93 (+9 %) | 7,13 | 7,94 (+11 %) ⚠ |
| 500 | Mover 1 al 31 % | 11,42 | 13,52 (+18 %) ⚠ | 13,72 | 12,80 (−7 %) |
| 2000 | Rehacer al 31 % | 23,00 | 24,04 (+5 %) | 23,24 | 23,62 (+2 %) |
| Con cables | Rehacer al 31 % con referencias | 23,94 | 24,78 (+4 %) | 24,15 | 24,90 (+3 %) |
| Con cables | Arrastrar todo seleccionado al 31 % | 67,02 | 74,98 (+12 %) ⚠ | 69,02 | 74,50 (+8 %) |

- **Por gesto:** suben más de 10 % 2 celdas en T3 y 1 en T4; **ninguna en las dos**.
- **La misma métrica en las dos tandas:** solo dos p95.
  - *Seleccionar al 31 %* con 100: de 0,8 a 0,9 y de 0,7 a 0,8 ms, un paso del reloj del banco. Ruido.
  - ***Encuadrar (F)* con 500: de 6,70 a 8,35 y de 6,45 a 9,30 ms, y el gesto de +0,6 a +0,8 ms. Costo aceptado (cambio 9).**
    - **Qué pasa:** en 4 de las 6 corridas con contorno de cada tanda, la cola del gesto necesita 17 o 18 cuadros en vez de 16, con un cuadro de unos 9,5 ms. Ese cuadro es el p95. En la base pasa solo en la primera corrida de cada tanda, en frío, con 20 cuadros.
    - **Lo que no es:** dibujar los contornos en el encuadre. A 500, el encuadre queda en 3,3 px por unidad (688 px para unas 208 unidades), debajo de los 6 px por unidad del umbral, y ahí los contornos se apagan con los bornes. Con 2000 tampoco se dibujan, y no sube.
    - **Causa: sin identificar.** Los contornos solo se dibujan antes del gesto, al reiniciar al 100 %, fuera de lo medido. Con el anillo (T1 y T2), que se dibuja en el mismo lugar, no pasó (16 cuadros en las 24 corridas).
    - **Se vuelve a medir:** en la etapa 3, con el dibujo real, y en la netbook al cierre de la fase.
    - Al aceptarla, se creía que la suba venía de dibujar 75 contornos en el encuadre; se corrigió después, al revisar las corridas.
- **Cuadros lentos:** 0 con el contorno en las dos tandas (1 en la base de T4).
- Se mide en la netbook al cierre de la fase 3b: pasa si no hay cuadros lentos (sección 5, "Netbook", y `docs/plan-fase3b.md`).
- **Decisión de Bruno: opción P (cambio 9).** Descartadas: (E) un contorno solo en las esquinas, (B) solo barra y panel y (C) contorno solo con el componente seleccionado.
