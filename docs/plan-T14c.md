# Plan T14c — Reconectar extremos libres

Aprobado por Bruno el 2026-11-11, con las decisiones D1 a D10 de abajo. Tarea de la fase 3 (ver `docs/plan-fase3.md`, T14c). Base: commit `56b5a9a`. La implementación la hace otra sesión.

- **Qué:** arrastrar el extremo libre de un cable hasta un borne o hasta otro cable (T) lo conecta, con un comando `CambiarExtremo` (un paso de deshacer).
- **Terminado cuando:** un cable con un extremo libre se conecta a un borne y a otro cable sin borrarlo ni redibujarlo.
- **Prueba:** reconectar a un borne y a una T; deshacer = igual; un destino inválido (mismo borne, conexión engañosa, ciclo de apoyos) no crea paso.

## Reglas para la implementación

- No hacer nada fuera de lo que pide este plan. Lo que aparezca de más se anota como pendiente y se le avisa a Bruno.
- Una etapa por vez, con commit local por etapa y **sin push**.
- **El primer test de la etapa 1 es `Uniones.actualizar` con cambio de tipo de extremo** (ver Etapa 1). Si falla: frenar y avisar a Bruno, sin tocar `Uniones`.
- Valen las reglas de `CLAUDE.md`: `src/core` sin DOM ni otras capas, todo cambio por Comando, coordenadas en unidades de grilla, sin dependencias nuevas, redibujar solo ante cambios, código y comentarios en español, identificadores sin ñ ni tildes.

## Palabras

- **Extremo libre:** extremo de tipo `libre`; se dibuja como un círculo hueco (radio `RADIO_LIBRE`, 0,25 u).
- **Anfitrión:** el cable sobre el que termina una T. **Cable apoyado:** el que termina en T sobre el anfitrión.
- **Extremo fijo:** el otro extremo del cable que se reconecta (el que no se agarró).
- **Última T apoyada:** recorriendo el cable desde el extremo fijo hacia el extremo agarrado, el último punto donde otro cable termina en T sobre él.

## Decisiones (Bruno, 2026-11-11)

| | Elegida | Qué significa |
|---|---|---|
| D1 | **A** | Solo se agarran extremos libres. Los extremos en T o en borne no se agarran (desconectar no es de T14c). |
| D2 | **A** | En la herramienta Seleccionar: apretar sobre el extremo libre y arrastrar, siempre, esté o no seleccionado el cable. Con tolerancia mínima en px. **Sobre un extremo libre, reconectar gana a mover la selección.** |
| D3 | **A** | Soltar en vacío no vale: el cable vuelve a como estaba, sin paso. |
| D4 | **B** | Si el cable agarrado es anfitrión de otras T, su dibujo se conserva hasta la última T apoyada. Las T apoyadas nunca se mueven: cambia un solo cable. |
| D5 | **B, limitada** | Ruteo como el parcial de T14a (estirar; rutear desde el codo j, del último al primero; el fresco si tiene menos codos), **solo sobre los tramos que están después de la última T apoyada. Nunca toca lo anterior.** |
| D6 | **A** | "Duplicada" es del mismo cable: los dos extremos en el mismo borne, o los dos en T sobre el mismo anfitrión. Dos cables distintos entre los mismos dos bornes se permiten. |
| D7 | **C** | La detección de ciclos es una función compartida en `src/core/model/cables.ts`, usada ahora por `CambiarExtremo`. Si entra a `validarHoja` se decide en T15a. |
| D8 | **A** | Previa completa en cada punto de grilla: ruteo y validación con la misma cuenta que el soltar. |
| D9 | **A** | Mientras se arrastra, el cable original se oculta de la capa estática con sus uniones, como en T14a. |
| D10 | **C** | En la netbook se miden las dos cosas: que la prueba actual no empeore y el gesto nuevo. |

Descartadas: D1-B/C (agarrar T o bornes), D2-B (solo con el cable seleccionado), D2-C (retomar desde W), D3-B (dejar el extremo libre en otro punto), D4-A (rechazar si una T queda afuera), D4-C (T en cascada), D5-A (solo desde el último codo), D5-C (entero de cero), D6-B/C (otro cable o misma red), D7-A/B (solo en el comando / invariante en `validarCable`), D8-B/C (goma / tope), D9-B (original a la vista), D10-A/B (solo una de las dos medidas).

## Comportamiento

### 1. Qué se agarra y cómo

- **Qué:** solo extremos libres (D1-A). En el punto de una T el único extremo es el del cable apoyado, y no se agarra; el anfitrión no tiene extremo ahí.
- **Radio de agarre:** distancia de Chebyshev del cursor al centro del extremo ≤ `clamp(TOLERANCIA_EXTREMO_PX / escala, RADIO_LIBRE, 0,9)` unidades, con `TOLERANCIA_EXTREMO_PX = 8` (el mismo valor que `TOLERANCIA_BORNE_PX`).
  - A 58 % (11,6 px/u) el círculo mide 2,9 px de radio y se agarra a 8 px (0,69 u). A 73 % (14,6 px/u): 3,65 px de radio, se agarra a 8 px (0,55 u). Desde 160 % el radio de agarre es el del círculo.
  - Tope de 0,9 u, como `radioBorne`: dos puntos de grilla vecinos están a 1 u.
  - Con varios extremos libres dentro del radio gana el más cercano; con empate, el del cable que se dibuja arriba.
  - El valor de 8 px se confirma en la prueba a mano de la netbook.
- **Prioridad (D2-A):** dentro del radio, el extremo libre gana a cualquier otro elemento bajo el cursor y a mover la selección.
  - **Ajuste (Bruno, después de aprobado):** si un borne también queda dentro de su tolerancia (`radioBorne`, la de W), gana el más cercano de los dos al cursor (Chebyshev); con empate, el extremo libre. Si gana el borne, apretar hace lo de siempre sobre su componente.
  - Apretar y soltar sin pasar `UMBRAL_ARRASTRE_PX` sigue siendo un clic: elige el cable, como hoy.
  - Con Mayús no se reconecta: Mayús+clic sigue sumando o quitando de la selección.
  - Desde un extremo libre no se empieza un rectángulo de selección.
- **Cable con dos extremos libres:** cada extremo se agarra por separado; el otro queda quieto y es el extremo fijo. Se conecta de a un extremo por gesto (un paso cada uno). Soltar sobre el propio cable o sobre su otro extremo se rechaza ("El cable no puede terminar sobre sí mismo.").
  - Límite conocido: en un cable muy corto a zoom bajo los dos radios de agarre tapan el cuerpo y no se lo puede arrastrar entero desde ahí; se mueve acercando el zoom o arrastrando otro elemento de la selección.
- **Corte del gesto:** Esc, el botón derecho, un `pointerup` perdido (como en T14a) o un cambio del documento por otra vía cancelan: el cable vuelve, sin paso. Durante el gesto los atajos se ignoran (`enGesto`).

### 2. Destino y ruteo al soltar

- **Destino:** el objetivo bajo el cursor con la regla de W (`objetivoEn`: borne > cable > vacío), sin contar el cable agarrado.
  - Borne → el extremo pasa a `borne`. Cable → pasa a `cable` (T) en ese punto de grilla. Vacío → no vale (D3-A).
  - Los bloqueos de W valen igual: extremo suelto de otro cable (`MENSAJE_EXTREMO_SUELTO`, sin cambiar el texto), cruce sin unión (`MENSAJE_CRUCE`), borne sin salidas (`MENSAJE_SIN_SALIDAS`).
- **Qué se conserva (D4-B, D5-B limitada):** el recorrido se orienta del extremo fijo al agarrado.
  - Sin T apoyadas: se rehace con el parcial de T14a completo (estirar → rutear desde el codo j, de k−1 a 0 → fresco si tiene menos codos).
  - Con T apoyadas: todo lo que va del extremo fijo hasta la última T apoyada queda igual, punto por punto. El parcial se aplica al resto, con ancla en el punto de esa T (prohibido volver sobre lo conservado). No hay fresco del cable entero.
  - El borne de destino prefiere su dirección y prohíbe entrar al cuerpo, como en W. Una T de destino no tiene preferencias.
- **Candidatos:** se prueban en orden y gana el primero que pasa la validación. Si ninguno pasa, la previa muestra el primero con sus problemas y soltar no hace nada.

### 3. Validación

Una sola función del núcleo, la misma para la previa y para el comando. Rechaza, sin cambiar nada:

- **Estructura:** lo de `validarCable` (referencias, puntos enteros, tramos ortogonales, sin largo cero ni vuelta de 180°, los dos extremos en el mismo borne).
- **Largo cero:** destino igual al punto del extremo fijo; soltar donde estaba no da paso ni aviso.
- **Conexiones aparentes:** `problemasTrazado` con el `id` del cable y la consulta sin ese cable (así las T apoyadas en él cuentan como unidas). Bloquean solo los conflictos nuevos, por clave, como en T14a.
- **Duplicadas (D6-A):** los dos extremos en T sobre el mismo anfitrión. La regla vive en el planificador de reconectar; W no cambia.
- **Ciclos (punto 4).**
- **T apoyada en el extremo:** el extremo nuevo no puede caer sobre el punto de una T apoyada en el cable (quedaría una T sobre el extremo de su anfitrión).
- **T en el extremo de su anfitrión (agregado después de la etapa 1):** el extremo nuevo, en T sobre H, no puede caer en un extremo de H que es a su vez una T sobre otro cable. `problemasTrazado` la da por unida (la T de H sobre G) y la dejaba pasar; W nunca la pide (`objetivoEn` elige G ahí). Con el extremo de H suelto o en un borne ya la frena el trazado (`MENSAJE_EXTREMO_SUELTO` o "pasaría sobre el borne"), sin cambio.

### 4. Ciclos de apoyos (D7-C)

- Función nueva en `src/core/model/cables.ts`: dado el índice de la hoja, dice si un cable se apoya, directa o indirectamente, en otro. Sube por los anfitriones (cada cable tiene 2 como mucho), sin recursión y con conjunto de visitados; no recorre la hoja.
- Al soltar en T sobre H: si H es el cable agarrado o H se apoya en él, se rechaza con ✕ y aviso.
- `validarCable` y `validarHoja` no cambian. T15a decide si la suma al abrir un `.brn`.

### 5. Previa, capa estática y uniones (D8-A, D9-A)

- **Al pasar el umbral:** el cable sale de la capa estática (`ocultarCable`) con las uniones que lo tocan (`cajasUnionesDe`), una invalidación por caja. La selección pasa a ser solo ese cable.
- **En cada punto de grilla:** objetivo + planificador, con caché por (objetivo, contador de cambios), como W. La capa dinámica dibuja el recorrido entero con `dibujarCableEnCurso` (acento si vale; aviso, a rayas y ✕ si no) y las marcas de bornes de W. Solo pide cuadro si cambió el objetivo.
- **Al soltar con destino válido:** se ejecuta `CambiarExtremo` con el plan de la previa mientras el cable sigue oculto, y después vuelve a la estática (invalidación de las cajas nuevas).
- **Uniones:** las pone al día `reflejar` con `Uniones.actualizar` (de a poco: el cable cambiado y lo que depende de él). El punto nuevo aparece al soltar, no en la previa (heredado de T14b, D6-A). Al deshacer desaparece.
- **Rechazo, Esc o cancelación:** el cable vuelve a la estática como estaba (misma invalidación), sin paso.

### 6. Selección, pista y cursor

- **Selección:** al empezar el arrastre queda seleccionado solo el cable agarrado, y sigue así después de soltar (conectado, rechazado o cancelado).
  - **Ajuste (Bruno, después de aprobado):** con Esc, la selección vuelve a la que había antes del arrastre.
- **Pista (barra de estado):**
  - Sobre un extremo libre, sin gesto: "Extremo suelto: arrastralo hasta un borne o un cable para conectarlo".
  - Arrastrando sobre un borne válido: "Conecta con K1 · A1" (el texto de W).
  - Arrastrando sobre un cable válido: "Derivación (T) sobre un cable" (el texto de W).
  - Arrastrando sobre vacío: "Soltalo sobre un borne o un cable · Esc cancela".
  - Destino inválido: el mensaje del primer problema.
- **Mensajes nuevos:**
  - Ciclo: "Ese cable se apoya en el que estás conectando: no se pueden apoyar uno en otro."
  - Mismo anfitrión: "Los dos extremos quedarían sobre el mismo cable."
  - Sobre sí mismo: "El cable no puede terminar sobre sí mismo."
  - T apoyada en el extremo: "Ahí llega la derivación de otro cable: el extremo no puede quedar sobre ella."
  - Sin camino: "El cable no tiene por dónde llegar ahí."
  - T en el extremo de su anfitrión: "Ahí termina ese cable: la derivación no puede quedar en su extremo."
  - Se reusan sin cambios: `MENSAJE_MISMO_BORNE`, `MENSAJE_SIN_LARGO`, `MENSAJE_EXTREMO_SUELTO`, `MENSAJE_CRUCE`, `MENSAJE_SIN_SALIDAS` y los de `problemasTrazado`. Los dos primeros vivían en el editor (`herramientas/cable.ts`): pasaron a `trazado.ts` con el mismo texto y `cable.ts` los re-exporta.
- **Aviso al soltar en un destino inválido:** el mismo mensaje, por `alAvisar`, como en T14a.
- **Cursor** (`src/editor/punteros.ts`): `pointer` sobre un extremo libre agarrable sin gesto; `crosshair` mientras se reconecta. El resto no cambia.

### 7. Deshacer y rehacer

- `CambiarExtremo(id, lado, destino)` guarda la copia del cable de antes y el plan. `aplicar` valida todo antes de tocar el documento; `deshacer` repone la copia (exacto).
- **Rehacer (corregido después de la etapa 1):** nunca vuelve a rutear. Repite exactamente el resultado guardado si el cable sigue como entonces y ese resultado todavía pasa la validación (`revisarReconexion`, las mismas reglas sin rutear); si no, tira sin cambiar nada ("El cable cambió desde que se conectó: no se puede rehacer." o el motivo del problema). La primera vez, el resultado de la previa se usa si sigue valiendo; si no, se planea de nuevo.
- Un solo paso. No da ids nuevos (`generarId` no se llama). El `Cambio` es `{ componentes: [], cables: [id] }`, sin `hojaEntera`.

## Etapas

Cada etapa cierra con `npm test`, `npm run check` y su commit local ("Fase 3, T14c etapa N: …"), sin push.

### Etapa 1 — Núcleo

1. **Primero, antes de cualquier código:** test en `src/editor/uniones.test.ts` de `Uniones.actualizar` cuando un extremo cambia de tipo con solo el id del cable en el cambio: libre → T (aparece la unión), libre → borne con otro cable en ese borne (aparece), y la vuelta (desaparecen); siempre igual a `uniones(hoja)`. **Si falla, frenar y avisar.**
2. `src/core/model/cables.ts`: función de apoyos (D7-C) y su test (directo, cadena de 3, sin relación, anfitrión que no existe).
3. `src/core/model/seguir.ts`: exportar lo que se reusa del parcial (`candidatosParcial` y lo que necesite), sin cambiar su comportamiento.
4. `src/core/model/trazado.ts`: validación de un cable existente con su `id` (variante de `prepararCable`), sin cambiar la de W.
5. `src/core/model/reconectar.ts` (nuevo) y su test: el planificador (destino → cable nuevo o rechazo con conflictos), con D4-B, D5-B limitada, D6-A, ciclos y T apoyada en el extremo.
6. `src/core/model/comandos.ts`: `CambiarExtremo` y sus tests.

Tests de núcleo:
- libre → borne y libre → T; deshacer y rehacer dejan el documento `toEqual` al de antes y al de después.
- Cada rechazo deja el documento igual: mismo borne, largo cero, extremo sobre un borne o un cable sin conectar, T sobre un extremo suelto, T sobre un cruce, borne sin salidas, ciclo directo y de 3, los dos extremos sobre el mismo anfitrión, sobre sí mismo, T apoyada en el extremo.
- Ruteo: sin T apoyadas se conserva el dibujo como en T14a; con T apoyadas, los puntos hasta la última T quedan idénticos y las T apoyadas no cambian.
- Cable con dos extremos libres: cada extremo por separado.
- Regla de imports de `src/core` (ya la corre `npm test`).

### Etapa 2 — Editor y humo

1. `objetivoEn` pasa de `HerramientaCable` a un módulo compartido del editor (`src/editor/objetivo.ts`), con una consulta que puede dejar afuera un cable. W lo usa igual que hoy (sus tests no cambian).
2. `src/editor/herramientas/seleccionar.ts`: gesto "extremo" (agarre con el radio, umbral, prioridad sobre mover, Mayús, Esc, botón derecho, `pointerup` perdido).
3. `src/editor/editor.ts`: empezar y terminar la reconexión (ocultar y mostrar el cable y sus uniones), previa en la capa dinámica, comando al soltar, cancelación si el documento cambia, selección, pista y avisos.
4. `src/editor/punteros.ts`: cursor.
5. `src/render/escenaEditable.ts`: buscar el extremo libre agarrable cerca de un punto, si hace falta (con el índice de cables que ya existe).

Tests del editor:
- El gesto completo a borne y a T; previa = resultado (la misma función).
- Radio de agarre a 58 %, 73 % y 100 %; el extremo gana a mover la selección; clic sin mover elige el cable; con Mayús no reconecta.
- Soltar en vacío, destino inválido, Esc y cambio del documento en medio: sin paso y todo como estaba.
- Uniones: aparecen al soltar y desaparecen al deshacer; cada caja de unión vieja y nueva cae en una región invalidada; durante el arrastre no hay punto viejo ni nuevo.
- Selección después de soltar; pista y avisos.
- `CambiarExtremo` sumado al test al azar de `src/editor/uniones.test.ts` (después de cada operación: igual a `uniones(hoja)`, `validarHoja` sin problemas, sin ciclos de apoyos y sin T en el extremo de su anfitrión).

Humo `tests/humo/t14c-reconectar.mjs` (1024×600):
- Reconectar a un borne: el círculo hueco desaparece y queda conectado.
- Reconectar a un cable: T con su punto, que aparece recién al soltar.
- Ctrl+Z y Ctrl+Y exactos al píxel.
- Destino inválido, ciclo y vacío: ✕ o vuelta, sin paso.
- Esc en medio del arrastre: igual al píxel que antes.
- Sin restos a 58 y 73 %; el extremo se agarra a 58 % a 8 px del centro.
- Cursor y pista sobre el extremo y durante el arrastre.

### Etapa 3 — Banco y cierre en la PC

1. `npm run bench`: escenario "Reconectar" en la escena de 2000 con cables (paso de la previa y soltar), alternado contra la base.
2. `src/ui/diagnosticoArrastre.ts` y `src/ui/diagnostico.ts` (D10-C): la prueba automática del menú de desarrollo suma "Paso de reconectar (mediana)" y "Soltar reconectando (comando + primer cuadro)". Las medidas actuales no cambian.
3. Cierre con la skill `bornera-cierre`: `npm test`, `npm run check`, `npm run humo`, `npm run bench`, `git grep -nP "\x{FFFD}"`, `docs/plan-fase3.md` (T14c hecha en la PC), Obsidian.

## Criterios de cierre

- **En la PC:** tests, check y humo enteros en verde; banco sin subas mayores al 10 % en los escenarios que ya existían, y 0 cuadros lentos nuevos.
- **En la netbook** (próxima prerelease, otra sesión; ahí se cierra T14c):
  - Prueba actual, sin empeorar: paso mediano (40 cableados) < 8 ms y soltar con todo seleccionado ≤ 200 ms.
  - Gesto nuevo: paso de reconectar (mediana) < 8 ms y soltar reconectando ≤ 200 ms.
  - A mano: reconectar a un borne y a una T, Ctrl+Z, agarrar el extremo a 58 % y 73 %, sin restos.

## Verificado en el código (2026-11-11, sobre `56b5a9a`)

- **Modelo:** un extremo es `borne`, `cable` (id del anfitrión + punto) o `libre` (`documento.ts`). El punto de una T es del cable apoyado.
- **`validarCable`** (`cables.ts`) rechaza T sobre sí mismo (solo directo), los dos extremos en el mismo borne, largo cero y vuelta de 180°. No rechaza ciclos indirectos, los dos extremos en T sobre el mismo anfitrión, ni dos cables entre los mismos dos bornes.
- **`problemasTrazado`** (`trazado.ts`) ya cubre: extremo libre sobre un borne o un cable, T sobre un extremo suelto o un cruce, encimados, cuerpos, borne sin salidas. Cada conflicto trae la clave del par.
- **`prepararCable`** valida sin `id`: sirve para un cable nuevo. Con un cable existente, las T apoyadas en él darían "tocaría otro cable sin conectarse".
- **`objetivoEn`** es un método de `HerramientaCable` (`herramientas/cable.ts`).
- **Ruteo:** W usa `rutas(ancla, destino)`. `candidatosParcial` y `componentesFuertes` son privadas en `seguir.ts`.
- **Arrastre actual:** el extremo libre de un cable que se acomoda queda fijo; arrastrar un cable atado solo da "mové los componentes". `idEnPunto` elige primero los cables.
- **`reflejar`** (`editor.ts`) pone al día índice, `bornesConCable`, `Uniones.actualizar` y la escena con un `Cambio { cables: [...] }`.
- **`Transformar`** (`comandos.ts`) guarda copias de antes y reaplica el plan si sigue vigente: es el modelo para `CambiarExtremo`.
- **Escala:** `PX_POR_UNIDAD` = 20; a 58 % son 11,6 px/u. `TOLERANCIA_PX` = 3, `TOLERANCIA_BORNE_PX` = 8, `UMBRAL_ARRASTRE_PX` = 4, `TOPE_TOLERANCIA_CABLE` = 0,4 u.
- **Cursor:** `punteros.ts` pone `crosshair` (W), `copy` (colocar) y `move` (arrastre).
- **T14a no deja una T en el extremo de su anfitrión.** No hay una regla que lo diga; lo impiden tres cosas:
  - `puntosParaT` nunca da los extremos del anfitrión cuando una T se corre;
  - si el extremo del anfitrión es un borne que se mueve hasta el punto de la T: "el borne … quedaría sobre un cable sin conectarse";
  - si el extremo del anfitrión es una T sobre otro cable que cambia y pasa por el punto de la T apoyada: "un cable tocaría otro cable sin conectarse" o "se encimaría".
  - Comprobado con un test temporal (borrado): 4 casos dirigidos con borne, 12 con cadena de T, y 360 documentos al azar con 5227 operaciones aceptadas y 6969 rechazadas (mover, girar, espejar), con 0 casos. Es una comprobación por lectura y por prueba, no una demostración: por eso T14c lleva su regla propia y la suma al test al azar.

## Supuesto (sin verificar)

- `Uniones.actualizar` soporta el cambio de tipo de un extremo con solo el id del cable. Es el primer test de la etapa 1.
- La previa de un solo cable cuesta como la de W y queda muy por debajo de 8 ms en la netbook. No hay medición.
- Los 30 extremos libres del banco de 2000 sirven para el escenario "Reconectar" y para la prueba de la netbook. Si no, la prueba arma su propio cable y lo deshace.
- `dibujarCableEnCurso` sirve tal cual para dibujar el cable entero de la previa (se leyó su entrada, no todo su dibujo).
- 8 px de tolerancia alcanzan en la netbook a 58 %. Se confirma a mano.

## Riesgos

- Mover `objetivoEn` puede romper W: lo cubren `cable.test.ts` y el humo `t13-cable`.
- D2-A cambia qué hace apretar cerca de un extremo libre: ya no arrastra la selección ni empieza un rectángulo desde ahí.
- Con T apoyadas (D4-B) queda poco lugar para rutear: más destinos "sin camino".
- Buscar el extremo libre bajo el cursor en cada movimiento del mouse (pista y cursor) suma una consulta al índice por evento: tiene que pedir cuadro solo cuando cambia.
- El gesto nuevo suma estados a Seleccionar; un `pointerup` perdido no puede dejar el cable oculto.

## Cambios después de aprobado (Bruno, 2026-11-11)

- Etapa 1 hecha en `e244943`. Al verificarla salieron estos cambios, ya anotados arriba en su lugar:
  - **Rehacer** repetía el plan solo si el cable seguía igual y, si no, volvía a rutear: ahora repite el resultado guardado o tira sin cambios (`87d6321`).
  - **T en el extremo de su anfitrión:** regla nueva en el núcleo, con su mensaje y su test (Validación y Mensajes nuevos).
  - **Mensajes de W al núcleo:** `MENSAJE_MISMO_BORNE` y `MENSAJE_SIN_LARGO`, mismo texto.
- Para la etapa 2:
  - **Extremo libre y borne dentro de la tolerancia:** gana el más cercano (punto 1, Prioridad). Con su test.
  - **Esc** devuelve la selección de antes del arrastre (punto 6, Selección). Con su test.
- Detalles de la etapa 2 que el plan no fijaba (ninguno lo contradice):
  - "Antes del arrastre" es la selección de antes de **apretar** (apretar sobre el extremo ya elige el cable, como un clic). Solo Esc la devuelve; el botón derecho, un `pointerup` perdido y un cambio del documento dejan seleccionado el cable, como dice el punto 6.
  - Sobre vacío, y sobre algo bloqueado o un destino rechazado antes de rutear, la previa dibuja el cable como estaba, a rayas (lo que pasa si se suelta ahí); con un intento rechazado, el intento a rayas con la ✕.
  - Soltar en el punto donde estaba el extremo cuenta como vacío: sin paso ni aviso. En cualquier otro punto del mismo cable, "El cable no puede terminar sobre sí mismo." (el objetivo se busca sin ese cable y después se mira su recorrido).
  - El documento que cambia en medio avisa con el texto del arrastre de T14a ("El documento cambió: se canceló el arrastre.").

## Fuera de T14c (pendientes, no se hacen acá)

- Agarrar extremos en T o en borne (desconectar).
- Dejar un extremo libre en otro punto vacío.
- Unir dos extremos libres de cables distintos; el texto de W "todavía no se puede conectar a él" no cambia.
- Que W rechace los dos extremos en T sobre el mismo anfitrión.
- Ciclos de apoyos al abrir un `.brn` (T15a).
