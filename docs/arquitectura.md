# Plan: Bornera, simulador de automatismos eléctricos

Nov 6, 2026 · @Bruno · Última revisión: 2026-11-13

## Visión y objetivos

Un editor y simulador de automatismos eléctricos (estilo CADe\_SIMU) que funcione fluido en equipos de bajos recursos, guarde en un formato propio y exporte PDF vectorial. Nombre del programa: Bornera.

Objetivos medibles (metas propuestas, a validar en las pruebas):

- **Liviano:** menos de 150 MB de RAM con un circuito de 500 componentes.
- **Rápido:** arranque en menos de 3 s; zoom, desplazamiento y simulación sin trabas con 500 componentes.
- **Corre en todo:** Windows y Linux. Plataforma principal: Windows con WebView2; equipo de referencia: una netbook con Windows y pantalla de 1024×600. Linux con WebKitGTK sigue como plataforma secundaria. Meta: fluido con 4 GB de RAM.
- **Diseñar y simular en el mismo lugar:** se pasa de modo edición a modo simulación con una tecla.
- **Archivos propios y portables:** formato abierto, versionado y legible.
- **Salida profesional:** PDF vectorial con rótulo (cajetín), listo para entregar o imprimir.

## Alcance del MVP

La primera versión cubre circuitos de mando y potencia básicos: alcanza para marcha-parada con enclavamiento, inversión de giro y señalización. Símbolos según norma IEC 60617 (la que se usa en Argentina).

| Componente | Bornes | Comportamiento en simulación |
| --- | --- | --- |
| Fase (L) | L | Alimentación suelta; su etiqueta (L, L1, L2, L3) es el nombre de la red |
| Neutro (N) | N | Alimentación suelta; su etiqueta (N) es el nombre de la red |
| Fuente trifásica | L1, L2, L3 (variantes con N y con N y PE) | Tres fases con secuencia definida |
| Fuente de CC 24 V | +, − | Para mandos en baja tensión |
| Cable y unión | — | Conductor ideal; la unión (punto) se crea sola al empalmar |
| Pulsador NA | 13, 14 | Cierra mientras se mantiene apretado |
| Pulsador NC | 11, 12 | Abre mientras se mantiene apretado |
| Interruptor / selector | 1, 2 | Cambia de estado con un clic y queda |
| Bobina de contactor | A1, A2 | Al energizarse, cambia todos los contactos con su misma etiqueta (K1) |
| Contactos principales | 1-2, 3-4, 5-6 | NA, siguen a la bobina de su etiqueta |
| Contacto auxiliar NA | 13-14 | Sigue a la bobina de su etiqueta |
| Contacto auxiliar NC | 21-22 | Inverso a la bobina de su etiqueta |
| Relé térmico | 1-2, 3-4, 5-6 + 95-96 NC, 97-98 NA | Se dispara a mano en simulación; se rearma con clic |
| Fusible | 1, 2 | Conduce; se funde ante cortocircuito |
| Lámpara | X1, X2 | Se enciende si está energizada |
| Motor trifásico | U, V, W | Gira si recibe las 3 fases; el sentido depende de la secuencia |
| Motor monofásico | U1, U2 | Gira si recibe L y N |

> Nota (2026-11-25, fase 6, T35): la biblioteca tiene 24 símbolos. Potencia: termomagnéticas de 1 a 4 polos, diferenciales de 2 y 4 polos, guardamotor y seccionador (prefijo Q), fusible tripolar y relé térmico (F), motor trifásico y estrella-triángulo (M), más la trifásica con N y la tierra (PE) en Fuentes. El polo N va en 7-8 (3-4 en el diferencial bipolar) con una «N» dibujada. En 6a las protecciones no conducen hasta T36 y los motores no conducen ni son carga (6b). Plan en `docs/plan-T35.md`.
> Nota (2026-11-25, fase 6, T36): la biblioteca tiene 32 símbolos. Mando: selector NA y seta NC (enclavados: un clic acciona y otro libera), finales de carrera NA y NC (como el pulsador), contactos 95-96 y 97-98 del térmico (siguen al F de su etiqueta, sin prefijo), fusible de mando (F) y bocina (H, carga como la lámpara). Las protecciones y el seccionador conducen siempre: en la netlist cada polo es un contacto NA sin accionamiento (D17-A) y en Simular las de cuchilla se dibujan cerradas (D20-B). Abrir o disparar, en 6b. Plan en `docs/plan-T36.md`.

**Fuera del MVP** (fases posteriores): temporizadores, relés auxiliares, finales de carrera, sensores, múltiples hojas, estrella-triángulo automático, PLC/escalera e importador de archivos `.cad`.

## Stack tecnológico

Recomendación: **TypeScript + Canvas 2D**, empaquetado con **Tauri** para escritorio (prioridad de entrega) y más adelante como web instalable (PWA). Es liviano, multiplataforma y es el terreno donde Claude Code rinde mejor.

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Lenguaje | TypeScript | Tipado estricto: menos errores en un proyecto grande |
| Dibujo | Canvas 2D nativo | Sin librerías pesadas; rápido incluso con GPU débil |
| Interfaz (paneles, menús) | Svelte 5 | Se compila a JS puro: nada cargado en memoria y transiciones incorporadas |
| App de escritorio | Tauri | Usa el navegador del sistema: instalador de pocos MB y bajo consumo de RAM |
| Web / offline | PWA | Se abre desde el navegador sin instalar y funciona sin internet |
| PDF | jsPDF | Dibuja líneas, arcos y texto vectoriales |
| Build | Vite | Arranque y recompilación casi instantáneos |
| Tests | Vitest | Prueba el núcleo sin abrir la interfaz |

**Descartados:** Electron (cada app lleva su propio Chrome: 150 MB o más solo en vacío), Python con PyQt (empaquetado pesado y lento en equipos viejos) y C++ con Qt (lo más rápido, pero mucho más lento de desarrollar).

**Riesgo a probar temprano:** en Linux, Tauri usa WebKitGTK, que en hardware viejo puede rendir menos que Chrome. Por eso la fase 2 incluye una prueba de rendimiento en la netbook; si falla, el plan B es usarla como PWA en Chromium.

> Nota (2026-11-12): riesgo mitigado. La fase 2 cerró con la 0.1.2 medida en la netbook (casi 0 cuadros de más de 16 ms). Desde la fase 3 la plataforma principal es Windows con WebView2, todavía sin medir en la netbook.

## Arquitectura general

Tres niveles con dependencias en un solo sentido: interfaz y editor arriba, un núcleo puro en el medio y el renderer abajo.

```text
interfaz (src/ui, Svelte)  ·  editor (src/editor)
              │  Comandos            │  lee
              ▼                      ▼
        núcleo (src/core: modelo, símbolos, io, sim)
              │  lee
              ▼
        renderer (src/render: Canvas 2D; luego SVG y PDF)
```

El editor solo cambia el modelo mediante comandos; el simulador y el renderer lo leen. Por eso pantalla, SVG y PDF salen del mismo código de dibujo, y el núcleo se prueba entero sin abrir la interfaz.

## Modelo de datos

Todo el programa gira alrededor de un único **Documento**: el editor lo modifica, el simulador lo lee y el formato de archivo lo guarda tal cual. Separar los datos del dibujo es lo que después permite exportar a PDF sin reescribir nada.

**Entidades principales:**

- **Documento:** formato y versión, metadatos (título, autor, fecha), `contadores` de ids (solo suben: un id borrado no se vuelve a dar) y la lista de hojas. El editor trabaja en la primera; un archivo con varias hojas abre, las conserva y avisa.
- **Definición de símbolo:** se escribe una sola vez por tipo. Contiene el dibujo en coordenadas locales (líneas, arcos, círculos, texto), la posición y el nombre de cada borne, el tipo de comportamiento (contacto NA, bobina, carga, fuente…) y su subgrupo en la paleta (desde T38; no va al `.brn`).
- **Instancia de componente:** id, tipo de símbolo, posición en la grilla, rotación (0/90/180/270), espejado, etiqueta (K1, S2, H1) y parámetros (tensión, color de lámpara).
- **Cable:** id, extremos `desde` y `hasta` y los codos intermedios (tramos horizontales o verticales, en enteros). Cada extremo está en un borne, sobre otro cable (una T) o libre.
- **Unión:** punto donde llegan 3 o más brazos de una misma conexión (extremos de cable, bornes con cable y el anfitrión de una T); se calcula sola y no se guarda.

**Reglas clave:**

- Todas las coordenadas van en **unidades de grilla** (enteros), no en píxeles. Así el zoom y el PDF no cambian nada del modelo.
- Los contactos se vinculan a su bobina **por etiqueta**: todo lo que se llame K1 sigue a la bobina K1.
- Ningún cambio se aplica directo: todo pasa por un **comando** (colocar, mover, rotar, espejar, borrar, cablear, cambiar un extremo, pegar, cambiar una etiqueta o varias de una vez, y varios juntos en un grupo). Eso da deshacer/rehacer gratis y evita estados corruptos.
- El núcleo del modelo no depende del navegador: se puede probar entero con tests sin abrir la interfaz.

## Motor de simulación

Simulación **lógica por conectividad**, no analógica: alcanza para automatismos y es muchísimo más liviana que un SPICE. Solo recalcula cuando algo cambia (un clic, un timer), nunca en un bucle constante.

**Algoritmo de cada recálculo:**

1. **Armar la netlist:** se agrupan en "redes" todos los bornes unidos por cables (estructura union-find). Además, los bornes de alimentación con el mismo nombre de red (sin espacios a los lados y en mayúsculas) se unen aunque no haya cable, como etiquetas de red: en Fase y Neutro el nombre es la etiqueta del componente; en una fuente trifásica, el nombre de cada borne. Se hace una vez al entrar a simulación.
   > Nota (2026-11-12): las redes de este paso ya están en `src/core/model/redes.ts` (fase 3, T15), sin simular: `redes(hoja)` une por cables y, con `unirPorNombre`, por nombre. Falta el nombre por borne de la fuente trifásica, que se suma con los símbolos de potencia.
   > Nota (2026-11-24, T34): hecho. En `redes()` y en la netlist, cada borne de una fuente de varios bornes (la trifásica) nombra su red con su propio nombre (L1, L2, L3, N); su etiqueta es libre y no nombra (D1-A). Los contactos tienen `polos` (los principales: 1-2, 3-4 y 5-6) y la netlist da un contacto por polo; los polos de un componente se accionan juntos. Detalle en `docs/plan-T34.md`.
2. **Unir por contactos cerrados:** cada contacto, pulsador o fusible que conduce une sus dos redes. Las cargas (bobinas, lámparas, motores) nunca unen redes: son los "cortes" del circuito.
3. **Propagar potenciales:** cada red queda marcada con las fuentes que la alcanzan (L, N, L1, L2, L3, +, −).
4. **Detectar cortocircuito:** si una misma red recibe L y N, o dos fases distintas, se marca el cortocircuito, se funde el fusible aguas arriba (si hay) o se detiene la simulación con aviso.
5. **Evaluar cargas:** una bobina o lámpara se energiza si un borne está en fase y el otro en neutro (o + y −). Un motor trifásico gira si U, V y W reciben las tres fases; el sentido sale de la paridad de la secuencia (L1-L2-L3 vs L1-L3-L2).
6. **Actualizar contactos:** las bobinas energizadas cambian sus contactos asociados.
7. **Repetir hasta estabilizar:** se vuelve al paso 2 hasta que nada cambie. Si el estado de las bobinas se repite o se pasa el tope (en la implementación, 2 × bobinas + 50 cambios), es un circuito oscilante (un relé que se corta a sí mismo): se avisa en vez de colgar el programa.
   > Nota (2026-11-21, T30): el motor está en `src/core/sim/motor.ts` sobre la netlist de T28 (`netlist.ts`), con el criterio de `docs/plan-fase5.md` y `docs/plan-T30.md`. Difiere de este esquema: cambia una bobina por iteración (la de etiqueta menor, D2-B) y avisa carreras; un estado de bobinas repetido es oscilación; el tope es 2 × bobinas + 50 cambios («No se estabilizó en N pasos»); corto u oscilación detienen la simulación (D3-A), sin fusibles por ahora. Una carga se enciende con potenciales distintos y al menos uno fase. La app lo usa desde T32.

**Detalles importantes:**

- **Enclavamientos y realimentaciones** salen solos del punto fijo del paso 7.
- **Cargas en serie** (dos lámparas en serie): el modelo simplificado no las resuelve bien. En el MVP se detectan y se marca una advertencia.
- **Tensión incorrecta** (bobina de 24 V conectada a 220 V): se deja para una fase posterior, como advertencia.
- **Temporizadores** (fase posterior): se agregan como una cola de eventos con tiempo simulado; un timer que vence dispara un recálculo.
- **Interacción:** en modo simulación, mantener apretado un pulsador lo acciona; un clic en el térmico lo dispara o lo rearma.
  > Nota (2026-11-21, T32): en la app, F5 entra a Simular por `Editor.entrarSimulacion` (`src/editor/simulacion.ts`), que no es documento: sin Comandos, historial, «•» ni copia de recuperación. Solo R4 impide entrar (D4-A). Mantener el botón sobre un pulsador lo aprieta hasta soltarlo en cualquier lado o perder la ventana; Mayús+clic lo fija hasta otro clic (D5-B, M-A). En Simular no andan herramientas, panel, deshacer, Nuevo, Abrir, Guardar ni Guardar como, ni las escenas del banco; Exportar sí. Hasta T33 el estado no se dibuja: la barra muestra los avisos, la detención y los fijados. Plan en `docs/plan-T32.md`.
  > Nota (2026-11-21, T33): el estado se dibuja en la capa estática (D8-A, D9-B). `src/editor/dibujoSimulacion.ts` traduce la simulación a la escena: cada cable con la clase de su red (fase, neutro, en corto con la detención; sin potencial, el color de Editar), el contacto accionado con su dibujo accionado (`primitivasAccionado` de la biblioteca: NA cerrado, NC abierto), la lámpara encendida y la bobina con tensión rellenas, y las bobinas que oscilan con el contorno a rayas en `--conflicto`. Entrar y salir rehacen la escena entera; cada pulsar o soltar, solo las cajas que cambiaron. Los fijados ya no van en la barra (F-A). Plan en `docs/plan-T33.md`.
  > Nota (2026-11-25, T36): selector y seta no se mantienen: un clic, con Mayús o sin ella, los acciona y quedan; otro clic los libera. Protecciones, seccionador y térmico no responden al clic en 6a (D7-A, D18-A); dispararlos o abrirlos es de 6b. Los 95-96 y 97-98 se ven en reposo (F no dispara). Plan en `docs/plan-T36.md`.
- **Visual:** los conductores con tensión se pintan de un color por potencial (fase, neutro, CC); las lámparas se encienden y los motores muestran el giro con una flecha animada.

## Editor e interfaz

La interfaz tiene que ser cómoda en una pantalla de 1024×600: lienzo grande, paneles que se pliegan y atajos de teclado para todo lo frecuente.

**Distribución de pantalla:**

- **Arriba:** barra de herramientas (nuevo, abrir, guardar, exportar PDF, deshacer/rehacer, zoom) y el botón grande **Editar / Simular**.
- **Izquierda:** paleta de componentes en dos grupos plegables, Mando (alimentación, entradas, contactos, bobinas, señalización) y Potencia (protección, maniobra, cargas, fuentes), cada uno con sus subgrupos también plegables (T38). Cada símbolo es una miniatura dibujada con el mismo Renderer del lienzo, con el nombre en el tooltip; buscador que despliega lo que encuentra. Plegable.
- **Centro:** lienzo con grilla.
- **Derecha:** propiedades del elemento seleccionado (etiqueta, tensión, rotación). Plegable; se abre solo al seleccionar. Sin selección muestra el botón "Etiquetar los vacíos" (T17).
- **Abajo:** barra de estado (coordenadas, zoom, avisos de simulación).

**Funciones del editor:**

- Arrastrar desde la paleta y soltar con ajuste a la grilla.
- Seleccionar con clic o con rectángulo; mover, rotar (R), espejar (M) y borrar (Supr).
- Herramienta cable (W): clic en un borne, codos en ángulo recto automáticos, clic en el destino. Los bornes libres se resaltan al pasar el mouse.
- Al mover un componente, los cables conectados lo siguen.
- Copiar, cortar, pegar y duplicar (Ctrl+D; también Ctrl+Insert, Mayús+Insert y Mayús+Supr). Hecho en T16 (fase 3b), con portapapeles interno.
- Deshacer/rehacer ilimitado (Ctrl+Z / Ctrl+Y).
- Zoom con la rueda centrado en el mouse; desplazamiento con botón del medio o espacio + arrastrar; "encuadrar todo" (F).
- Etiquetado automático: el segundo contactor que se coloca es K2, el tercer pulsador S3, etc. Hecho en T17 (fase 3b, 2026-11-14): se numera al colocar con el menor libre (K bobina, S pulsadores, H lámpara; `prefijoEtiqueta` en la definición); al pegar y duplicar se renumera solo lo que choca con la hoja, la bobina junto con sus contactos; "Etiquetar los vacíos" y el renombrado de bobina, que arrastra a sus contactos, son un paso de deshacer cada uno. Fase y Neutro quedan fuera. Lo escrito a mano se respeta y, si repite otra etiqueta, el panel lo avisa con una nota. Plan en `docs/archivo/plan-T17.md`. **Desde T27 (fase 4, 2026-11-18):**
  - El pulsador NC se numera desde S0 (`primerNumero: 0` en la definición) y el NA desde S1: parada S0, marcha S1.
  - Comparten los números de la S. Cada uno recibe el menor libre desde su primer número, así que un NC y un NA nunca reciben el mismo.
  - K y H siguen desde 1.
  - `primerNumero` vive en la biblioteca: el formato `.brn` no cambia.
- Referencias cruzadas: debajo de cada bobina, la lista de dónde están sus contactos. Hecho en T18 (fase 3b, 2026-11-14): un contacto sigue a la bobina de su misma etiqueta normalizada en la misma hoja; cada fila dice NA o NC, sus bornes (hoy fijos, 13-14 y 21-22) y su ubicación en coordenadas de grilla, con la convención de la barra de estado (`NA 13-14 (10, 11)`). La lista va del lado opuesto a la etiqueta, es parte del dibujo de la bobina y se apaga con los demás textos. Se deriva: se recalcula en cada comando que toca una bobina o un contacto (no al mover el mouse ni durante un arrastre) y no se guarda en el `.brn`. Sin aviso ni clic: lo que está mal lo marca T19. Cuando haya marco (fase 7), la ubicación pasa a columna y fila cambiando solo `textoUbicacion`. Plan en `docs/archivo/plan-T18.md`.
- Validaciones en vivo: bornes sin conectar y cables sueltos marcados en naranja.
  - Hecho en T19 (fase 3b, 2026-11-16): son nueve reglas (R1 a R9), entre ellas contactos sin bobina, etiquetas vacías o repetidas, bornes sin conectar y cables sueltos. **Severidad:** *error* es lo que impedirá simular en la fase 5; *aviso*, lo que no (el circuito está incompleto o raro, pero se podrá simular). Hoy los errores son las bobinas y lámparas con etiqueta repetida (R4). El núcleo es `src/core/model/validaciones.ts`, puro; el caché `src/editor/avisosHoja.ts` se pone al día solo con cada comando y de forma incremental (nunca al mover el mouse). Se ve en un contador de la barra, en notas del panel y en un rojo aparte, `--conflicto`, para lo que no se puede hacer. Se deriva: no se guarda en el `.brn`.
  - Por el banco, los bornes sin conectar y los extremos sueltos van en la barra y en el panel, y en el lienzo solo se marcan con un anillo en el componente o cable seleccionado. Los avisos de etiqueta se marcan con un contorno a rayas.
  - Plan en `docs/archivo/plan-T19.md`.
  - Nota (2026-11-25, T35): R10 también cuenta los bornes L1–L3 de una fuente de varios bornes (la trifásica, con o sin N): una Fase «L» con una trifásica en la hoja avisa. R5 nombra lo que es cada prefijo con un nombre neutro por prefijo (K bobina, S pulsador, H lámpara, Q protección o maniobra, F protección, M motor), no con el primer símbolo de la biblioteca. (T36: S pasa a «aparato de mando», D19-A; R2 también avisa un 95-96 o 97-98 sin relé térmico de su etiqueta.) Las referencias escriben los polos: «NA 1-2, 3-4, 5-6».
  - Ampliado en T29 (fase 5, 2026-11-21): son once reglas. **R10**, una Fase «L» junto con alguna Fase L1, L2 o L3 (etiqueta normalizada), con contorno. **R11**, conexión aparente que ya está en la hoja (la misma regla que impide crearla al dibujar, `src/core/model/aparentes.ts`), marcada en los dos elementos del par, sin contorno (panel, barra y anillo de la selección); R11-A: no avisa un encimado entre cables de la misma red. Las dos son avisos. R11 va en vivo hasta 100 elementos en el cambio; arriba de eso, y al abrir, en reposo, en tramos de 2 ms que no bloquean el dibujo (D6-A). Plan en `docs/plan-T29.md`.

> Nota (2026-11-12; ubicación decidida por Bruno el 2026-11-13): copiar/pegar, etiquetado automático, referencias cruzadas y validaciones en vivo quedaron fuera del criterio de la fase 3. Forman la **fase 3b**, como T16–T19, después de la fase 3 y antes de la 4: ver `docs/plan-fase3b.md` (T16 en `docs/archivo/plan-T16.md`). T16 (copiar y pegar) está hecha desde el 2026-11-13 y T17 (etiquetado automático), T17b (contacto auxiliar NC) y T18 (referencias cruzadas) desde el 2026-11-14. T19 (validaciones en vivo) está hecha desde el 2026-11-16 (nota del 2026-11-16). La fase 3b quedó **cerrada el 2026-11-17**: inversión de giro a mano, banco y netbook con `0.1.4-alpha.1` pasan (`docs/plan-cierre-3b.md`, `docs/netbook-fase3b.md`). No hay release: `0.1.4` sale al cerrar la fase 4 (cambio de Bruno, 2026-11-17).

**Atajos principales:** F5 alterna editar/simular, Ctrl+N nuevo, Ctrl+O abre, Ctrl+S guarda, Ctrl+Mayús+S guarda como, Ctrl+P exporta PDF (con la exportación, fase 7), Esc cancela la herramienta actual. Tema claro y oscuro.

## Renderizado y rendimiento

La diferencia con CADe\_SIMU se gana acá: **dibujar solo lo necesario, solo cuando algo cambia**. Estas reglas se fijan desde el día uno porque agregarlas después cuesta el triple.

- **Interfaz de dibujo única:** un `Renderer` con operaciones básicas (línea, arco, círculo, texto) y tres implementaciones: Canvas (pantalla), SVG y PDF. Cada símbolo se dibuja una sola vez en código y sale igual en los tres.
- **Sin bucle constante:** se redibuja con `requestAnimationFrame` solo cuando hubo un cambio. Con el programa quieto, el consumo de CPU es cero.
- **Capas:** la grilla y los componentes van en una capa estática cacheada en un canvas fuera de pantalla; la selección, el cable en curso y el estado de simulación van en una capa dinámica encima.
  > Nota (2026-11-21, T33, D8-A): el estado de simulación va en la capa estática, no en la dinámica: cada cambio rehace solo los mosaicos que tocan lo que cambió. En Simular el presupuesto para rehacer mosaicos baja a 4 ms por cuadro (P-B) y, al cambiar el estado, se descartan los mosaicos de otros niveles de zoom (y, durante un zoom, no se muestran los sucios): nunca se ve un estado viejo.
- **Recorte por vista:** solo se dibuja lo que entra en pantalla.
- **Índice espacial:** grilla de hash para saber en tiempo constante qué hay bajo el mouse, sin recorrer todos los componentes.
- **Símbolos precompilados:** cada definición se convierte una vez en `Path2D`, que el navegador dibuja mucho más rápido.
- **Nivel de detalle:** con zoom muy alejado se omiten textos y bornes.
- **Simulación incremental:** la netlist se arma una vez; durante la simulación solo se recalculan los contactos que cambiaron.

**Banco de pruebas:** un script que genera circuitos de 100, 500 y 2000 componentes y mide fotogramas por segundo, tiempo de recálculo y RAM. Se corre en la netbook al final de cada fase.

> Nota (2026-11-22, fase 5): el banco tiene dos escenas oficiales nuevas. La escena con cables (2000 + 3030) se tiende entera como W (`codosBanco`): 0 conexiones aparentes, así que los avisos R10 y R11 se miden sobre un circuito sano. La **escena de mando** (`bancoMando.ts`: 2000 símbolos, 2200 cables y 300 bobinas) alimenta S1–S5 de «Probar la fase 5»: entrar a Simular (con la netlist dentro de S1), pulsar y soltar, el dibujo del estado y la salida. Topes de la netbook por la regla de la fase 4 (K1 = 3, K2 = 5,5, decisión D1-D); en C3 (2026-11-22) los cocientes netbook / PC salieron S1 4,6, S3 3,1, S4 2,4 / 2,6 y S5 2,4. Detalle en `docs/bench.md`.

> Nota (2026-11-25, fase 6, T37): tercera escena oficial, la **escena de potencia** (`bancoPotencia.ts`: 95 copias de la inversión de giro con potencia más una celda de lámpara, 2000 símbolos justos y 3519 cables, tendida por W y sin aparentes; L1, L2, L3 y N son una red cada una, 1526 redes). Alimenta S6 de «Probar la fase 6» (entrar a Simular hasta nítido al 31 %, como S1). El Lienzo deja una marca al primer cuadro nítido desde que abre la app (`arranque.ts`), base de P2. Plan en `docs/plan-T37.md`.

> Nota (2026-11-25, fase 6, T38): las miniaturas de la paleta son un canvas chico por símbolo, dibujado una sola vez después del primer cuadro nítido del lienzo, con el `Path2D` ya cacheado del símbolo. Solo un tema o un dpr nuevo las rehacen; la búsqueda y el plegado las ocultan sin redibujar. Rehacer las 32 (P1) cuesta 0,4 ms en la PC (tope 9,1). Plan en `docs/plan-T38.md`.

> Nota (2026-11-25, fase 6, C1): desde C1 los canvas de las miniaturas también se **montan** después del primer cuadro nítido (antes solo se dibujaban después); los botones de la paleta se montan desde el principio. Plan en `docs/plan-C1-fase6.md`.

## Formato de archivo propio

Sí es posible y conviene: un **JSON versionado y comprimido**, con extensión propia (`.brn`). Es fácil de leer, de depurar y de mantener compatible a futuro.

**Estructura (versión 1):**

```json
{
  "formato": "bornera",
  "version": 1,
  "meta": { "titulo": "Marcha-parada", "autor": "", "fecha": "2026-11-12" },
  "contadores": { "c": 3, "w": 3 },
  "hojas": [{
    "nombre": "Hoja 1",
    "componentes": [
      { "id": "c1", "tipo": "pulsador.na", "x": 10, "y": 8, "rot": 90, "espejado": true, "etiqueta": "S1", "params": {} }
    ],
    "cables": [
      { "id": "w1", "desde": { "tipo": "borne", "comp": "c1", "borne": "13" }, "hasta": { "tipo": "cable", "cable": "w2", "x": 10, "y": 4 }, "codos": [[10, 5]] }
    ]
  }]
}
```

Acá va con sangría para leerlo. En el archivo, `serializar` lo escribe en forma canónica: JSON compacto en una línea, todos los campos explícitos y las claves en orden fijo (ver `docs/archivo/plan-T15a.md`, §1).

**Reglas:**

- **Compresión:** Guardar escribe gzip con `CompressionStream` del navegador (sin librerías); si el sistema no lo tiene, guarda sin comprimir y lo avisa. Abrir acepta los dos (los distingue por los bytes `1f 8b`). Tope: 16 MB. Un circuito escolar pesa pocos KB.
- **Versión y migraciones** (fase 4, D3-A de `docs/plan-fase4.md`, T22): hoy hay una sola versión (1) y ninguna migración. Un archivo de una versión más nueva se rechaza ("hecho con una versión más nueva de Bornera"). Los archivos viejos siempre abren.
  - Cada cambio de estructura sube `VERSION_FORMATO` y agrega en `src/core/io/migraciones.ts` la función que pasa de la versión anterior a la nueva.
  - Una migración es pura: recibe el JSON leído (solo están revisados `formato` y `version`) y devuelve uno nuevo, con la versión siguiente. No valida: lo que no tiene la forma que espera lo deja, y lo informa la estructura.
  - `deserializar` las corre en cadena entre la versión y la estructura. Lo migrado pasa la misma lectura estricta. Si una migración tira o devuelve otra cosa, el archivo no abre ("No se pudo pasar del formato N al N+1: …") y el programa sigue.
  - Un archivo migrado abre con el aviso "El archivo es del formato N: al guardarlo pasa al formato M", primero en la lista y sin la marca «•». Guardar lo escribe en el formato nuevo.
  - Los tests inyectan migraciones de prueba con `deserializarCon`, que no sale por `index.ts`.
- **Corpus congelado** (`tests/circuitos/formato-v1/`, T22): diez `.brn.json` generados una sola vez por `formato-v1.mjs`, y un `.brn` real guardado por la 0.1.4-alpha.1 en la netbook. `formato-v1.test.ts` fija el largo y el sha256 de cada uno: cada archivo abre, es igual a su JSON y se guarda igual. No se regenera sin el OK de Bruno. Cuando el formato suba, tiene que seguir abriendo con sus migraciones.
- **Validación al abrir:** un archivo dañado se rechaza con la lista de problemas, sin cerrar el programa: claves desconocidas, cables rotos, contadores atrasados, ciclos de apoyos o una T sobre el extremo de su anfitrión. Un símbolo desconocido sin cables abre con "?" y un aviso.
- **Autoguardado** (fase 4, D2 de `docs/plan-fase4.md`):
  - La copia de recuperación va en IndexedDB del webview, una por instancia abierta.
  - Sale a los 10 s sin comandos o a los 60 s del primer cambio sin copia, nunca durante un gesto.
  - Se escribe por partes, en ocio: trozos de hasta 2 ms, cada uno con su `put`, y al final un registro de copia completa (`src/ui/autoguardado.ts`, `src/ui/respaldo.ts`). Si el documento cambia en el medio, la copia vuelve a empezar. Cada instancia retiene su copia con un candado de Web Locks.
  - Al arrancar después de un corte, Bornera ofrece Recuperar o Descartar («Bornera no se cerró bien»), una fila por copia si hay varias.
  - La copia se borra al guardar, al cerrar bien (también con «No guardar») y al reemplazar el documento con Nuevo o Abrir. Nunca sola al arrancar.
- **Alcance de archivos y Abrir reciente** (fase 4, D8-A de `docs/plan-fase4.md`, T24):
  - La capability deja usar sin el diálogo todo `.brn` y `.brn.json`, y sus `.tmp`, con `fs:allow-exists` además de los de T15a. El alcance de Tauri distingue mayúsculas también en Windows, así que los globs van con clases: `**/*.[bB][rR][nN]` y sus variantes. Así entran `X.BRN` y su temporal `X.BRN.tmp`.
  - La flecha junto a Abrir despliega las últimas 8 rutas abiertas o guardadas (`src/ui/recientes.ts`, `MenuRecientes.svelte`). Entran Abrir, Guardar y Guardar como; Exportar y Recuperar no. Solo en el escritorio: en el navegador no hay rutas y el menú no aparece.
  - Un repetido sube arriba. En Windows, dos rutas son la misma sin mirar mayúsculas y con `/` igual a `\`; en Linux, solo si son iguales letra por letra.
  - Abrir reciente mira primero `exists`: si el archivo ya no está, avisa y lo quita de la lista sin preguntar por los cambios. Otro error (permiso, archivo dañado) se muestra y la ruta queda. Después siguen los mismos pasos de Abrir.
  - La lista va en `localStorage`, con `try` en cada acceso. Es por origen: `tauri dev` (el servidor de Vite, http://127.0.0.1:1420) y la app compilada tienen listas separadas.
- **Asociación de `.brn` en Windows** (fase 4, T25 de `docs/plan-fase4.md`):
  - El `.msi` registra la extensión `.brn` con el tipo «Circuito de Bornera» (`bundle.fileAssociations`, `ProgId Bornera.brn`). El doble clic llama a `bornera.exe "%1"`. Desinstalar la quita. `.brn.json` no se asocia, porque Windows mira solo la última extensión y se quedaría con todos los `.json`.
  - `src-tauri/src/lib.rs` lee los argumentos con `args_os` (`args` hace panic con uno que no es Unicode). Toma el primero que termine en `.brn` o `.brn.json`, sin mirar mayúsculas, y completa una ruta relativa con la carpeta actual (`elegir_archivo`, probada con `cargo test`). El comando `archivo_inicial` la entrega una sola vez, así que recargar la página no la vuelve a abrir.
  - Al arrancar, primero se resuelve la recuperación (se leen las copias y, si hay, se espera a que se cierre el diálogo). Después se abre el archivo con los pasos de Abrir reciente: si no existe, «No se pudo abrir» y la lista no se toca. Si abre, sube en recientes. Si se recuperó una copia, antes pregunta por sus cambios.
  - Sin single-instance: con Bornera abierta, el doble clic abre otra ventana.
- **Biblioteca separada:** los símbolos no se guardan dentro de cada archivo; solo se referencia su tipo (`contactor.bobina`).
- **Exportación de respaldo:** «Exportar sin comprimir (.brn.json)…» (botón de la barra, sin atajo), para revisarlo o versionarlo con Git. Escribe una copia y no cambia el archivo actual, la marca «•» ni el historial. El formato lo da la extensión: Ctrl+S sobre un `.brn.json` abierto lo vuelve a escribir sin comprimir, y en Guardar como se puede escribir `.brn.json` a mano. El `.brn` normal no cambia ni un byte: lo fijan los sha256 del banco en `src/editor/banco-brn.test.ts` (fase 4, D4-C de `docs/plan-fase4.md`, T21).
- **Forma por líneas del `.brn.json`** (`serializarPorLineas`, `src/core/io/porLineas.ts`): UTF-8 sin BOM, cada línea termina en `\n` (también la última). Cada componente y cada cable es una línea con su JSON compacto canónico; una lista vacía va en la misma línea que su clave. Quitando todos los `\n` queda exactamente el texto de `serializar`. Al abrir se aceptan CRLF y BOM; al volver a guardar sale con `\n`. En Git, `*.brn.json -text` (`.gitattributes`). El ejemplo de arriba:

  ```
  {"formato":"bornera","version":1,
  "meta":{"titulo":"Marcha-parada","autor":"","fecha":"2026-11-12"},
  "contadores":{"c":3,"w":3},
  "hojas":[
  {"nombre":"Hoja 1",
  "componentes":[
  {"id":"c1","tipo":"pulsador.na","x":10,"y":8,"rot":90,"espejado":true,"etiqueta":"S1","params":{}}
  ],
  "cables":[
  {"id":"w1","desde":{"tipo":"borne","comp":"c1","borne":"13"},"hasta":{"tipo":"cable","cable":"w2","x":10,"y":4},"codos":[[10,5]]}
  ]}
  ]}
  ```

  Con más hojas, cada una cierra con `]},` salvo la última. Una hoja vacía queda en tres líneas: `{"nombre":…,`, `"componentes":[],` y `"cables":[]}`.

## Exportación a PDF vectorial

El PDF sale del mismo `Renderer` que dibuja la pantalla, con una implementación sobre jsPDF: líneas y arcos reales, no una captura. Se puede ampliar sin pixelarse e imprimir en cualquier tamaño.

- **Formatos de hoja:** A4 y A3, horizontal o vertical.
- **Escala:** "ajustar a la hoja" o escala fija.
- **Rótulo (cajetín):** título, autor, escuela o cliente, fecha, número de hoja y revisión, tomados de los metadatos del documento.
- **Marco y zonas:** marco con referencias de columnas (1, 2, 3…) y filas (A, B, C…), como en los planos industriales.
- **Impresión en blanco y negro:** sin colores de simulación; el PDF siempre muestra el esquema en reposo.
- **Fuentes:** Helvetica, incluida en todo lector de PDF, así no hay que embeber archivos.
- **Extras de bajo costo:** exportar SVG (sale del mismo renderer) y PNG (captura del canvas).

## Estructura del repositorio y CLAUDE.md

Carpetas separadas por responsabilidad, para que Claude Code trabaje en un módulo sin romper otro.

```text
/
├── CLAUDE.md              reglas del proyecto para Claude Code
├── docs/
│   ├── arquitectura.md    este plan, resumido
│   ├── plan-*.md          plan de cada fase y de las tareas grandes
│   ├── netbook-*.md       checklist para imprimir de la prueba en la netbook
│   ├── ideas.md           ideas para más adelante, sin plan
│   └── bench.md           resultados del banco de dibujado
├── src/
│   ├── core/              sin dependencias del navegador
│   │   ├── model/         tipos, documento, comandos, deshacer
│   │   ├── symbols/       definiciones de símbolos IEC
│   │   ├── sim/           netlist (`netlist.ts`) y motor de simulación (`motor.ts`); eventos y temporizadores, en una fase posterior
│   │   ├── io/            formato .brn, migraciones, validación
│   │   └── circuitos/     circuitos de referencia armados con comandos y su comparación por redes (solo los usan los tests)
│   ├── render/            Renderer: canvas, svg, pdf
│   ├── editor/            herramientas, selección, índice espacial; modo Simular (`simulacion.ts`) y su dibujo (`dibujoSimulacion.ts`); escenas del banco (`banco.ts`, `bancoMando.ts`, `bancoPotencia.ts`)
│   ├── ui/                paneles, barras, diálogos (Svelte)
│   └── routes/            punto de entrada de SvelteKit (+page.svelte)
├── tests/
│   ├── circuitos/         .brn de referencia con resultado esperado
│   ├── bench/             pruebas de rendimiento
│   └── humo/              pruebas de humo de la app real (Chrome/Edge headless)
└── src-tauri/             empaquetado de escritorio
```

**Contenido del CLAUDE.md:** ver CLAUDE.md en la raíz (es la versión vigente).

**Cómo trabajar con Claude Code:** una tarea chica por sesión ("agregar el contacto NC", no "hacer el simulador"), pedirle primero el plan y después el código, y no avanzar de fase sin que pasen los tests.

## Hoja de ruta por fases

Ocho fases en orden; cada una termina con algo que funciona y un criterio concreto para pasar a la siguiente. Lo más riesgoso (rendimiento en la netbook) se prueba en la fase 2.

1. **Base del proyecto:** repositorio, Vite, TypeScript estricto, Vitest y CLAUDE.md.
   - Pasa cuando: `npm run dev` y `npm test` funcionan.
2. **Dibujo y navegación:** Renderer Canvas, grilla, 5 símbolos dibujados, zoom y desplazamiento.
   - Pasa cuando: 2000 símbolos de prueba se mueven fluido en la netbook.
3. **Editor:** paleta, colocar, mover, rotar, borrar, cables con codos, selección, deshacer/rehacer.
   - Pasa cuando: se puede dibujar a mano una marcha-parada completa.
   - **3b. Editor, segunda parte** (decisión de Bruno, 2026-11-13; plan en `docs/plan-fase3b.md`): copiar, cortar, pegar y duplicar (T16), etiquetado automático (T17), referencias cruzadas (T18) y validaciones en vivo (T19). Va después de la fase 3, cerrada con la 0.1.3, y antes de la 4. **Cerrada el 2026-11-17.**
     - Pasa cuando (confirmado por Bruno el 2026-11-13): se arma a mano una inversión de giro con enclavamiento entre K1 y K2, duplicando la rama de K1 con Ctrl+D, sin bobinas repetidas, con las referencias cruzadas correctas y nada en naranja. El `.brn` dibujado se compara por redes con el archivo congelado `tests/circuitos/inversion.brn` (`npm run circuito`), como en T15. Criterio completo en el plan.
4. **Guardar y abrir:** formato `.brn`, validación, autoguardado.
   - Nota (2026-11-13): lo básico (formato `.brn` y validación) se adelantó en la fase 3 (T15a), con la fase 3 ya cerrada. En esta fase quedan el autoguardado, las migraciones y los circuitos de referencia (`tests/circuitos/marcha-parada.brn` es el primero). Nota (2026-11-16): el segundo es `tests/circuitos/inversion.brn`, del cierre de la fase 3b; `npm run circuito` elige la base con `BORNERA_BASE`.
   - Plan aprobado el 2026-11-17: `docs/plan-fase4.md` (T20 a T27).
   - **Fase 4 cerrada el 2026-11-20** con `0.1.4` publicada (WiX `0.1.4.0`, instalada encima de la `0.1.4-alpha.2` sin desinstalar). Qué trae y dónde vive cada parte:
     - T20, banco listo para la netbook: `tests/bench/` y «Probar la fase 4» en el menú de desarrollo (`docs/bench.md`).
     - T21, exportar `.brn.json`: sección «Formato de archivo propio» (exportación de respaldo).
     - T22, migraciones y corpus congelado: `tests/circuitos/formato-v1/` (sección «Formato de archivo propio»).
     - T23, autoguardado y recuperación: sección «Formato de archivo propio» (autoguardado); humo `t23-autoguardado.mjs`.
     - T24, alcance de archivos y Abrir reciente; T25, asociación de `.brn` en Windows: sección «Formato de archivo propio».
     - T26, borrar en cascada los cables en T; T27, pulsadores NC desde S0 y NA desde S1: sección «Editor e interfaz» (etiquetado, T17 y nota de T27).
     - **Factores medidos (C4, 2026-11-18):** K1 = 2,94 (pasos sin dibujo) y K2 = 2,70 (gestos con dibujo), netbook / PC, con el grupo fijado en C1. Notas: B10 ×6,2 real (Rehacer con referencias, caro en la netbook) y B14 ×8,7 por resolución (PC 0,6 ms). Son datos para la fase 5: **elegir A (el medido) o D (el mayor, 3 y 5,5) para los topes queda como decisión de Bruno en el plan de la fase 5**.
     - **Alcance (D1-C):** autoguardado y recuperación, migraciones con corpus congelado, exportar `.brn.json`, abrir recientes, asociar `.brn` en Windows y borrar en cascada los cables en T.
     - **Para la fase 5, antes de simular:** conexiones aparentes, etiquetas de red en la netlist y aviso de L con L1, L2 o L3. (Nota 2026-11-21: etiquetas de red en T28; R10 y R11 en T29.)
   - ~~Pasa cuando: guardar → cerrar → abrir deja el circuito idéntico (test automático).~~ Ya lo cumplía T15a.
   - **Pasa cuando** (D5-A, 2026-11-17): con un circuito cambiado y sin guardar, se corta Bornera sin cerrarla (Finalizar tarea).
     - Al abrirla, ofrece recuperarlo, y lo recuperado es idéntico a la última copia.
     - Con 10 s sin comandos antes del corte, no se pierde nada.
     - Lo prueba el humo `t23-autoguardado.mjs`, y en la netbook, a mano.
     - La copia con 2000 símbolos y sus cables bloquea ≤ 50 ms en la netbook.
       - Nota (2026-11-18, T23): desde la 1b, lo que se mide es el paso síncrono más largo de la copia por partes. En la PC con WebView2 dio 3,1 ms. La netbook queda para el cierre de la fase.
     - Al cierre, `0.1.4` se instala encima de `0.1.4-alpha.N` sin desinstalar.
5. **Simulación de mando:** fuentes, pulsadores, contactor, contactos auxiliares, lámpara, modo simular.
   - Pasa cuando: la marcha-parada con enclavamiento funciona y su test pasa.
   - **Fase 5 cerrada el 2026-11-22** con `0.1.5` publicada (WiX `0.1.5.0`, instalada encima de la `0.1.5-alpha.1` sin desinstalar). Plan en `docs/plan-fase5.md`. Qué trae y dónde vive cada parte:
     - T28, netlist con etiquetas de red; T30, motor (carreras, oscilación, corto, cargas en serie): sección «Motor de simulación» (notas de T30).
     - T29, avisos R10 y R11: sección «Editor e interfaz» (validaciones en vivo).
     - T31, banco de mando y «Probar la fase 5»: sección «Renderizado y rendimiento» (nota de la fase 5) y `docs/bench.md`.
     - T32, modo Simular (F5, mantener y Mayús+clic, bloqueos); T33, dibujo del estado en la capa estática: «Motor de simulación» y «Renderizado y rendimiento» (notas de T32 y T33).
     - Netbook y PC pasan todo con el `.msi` de la alpha.1 (`docs/netbook-fase5.md`, C3). Sin fusible, térmico, trifásica ni motores: son de la fase 6.
6. **Potencia:** fuente trifásica, contactos principales, térmico, fusible, motores, cortocircuito.
   - Pasa cuando: la inversión de giro con enclavamiento eléctrico simula bien ambos sentidos.
   - Nota (2026-11-27, C4): **6a cerrada** (plan en `docs/plan-fase6.md`; netbook y PC pasan con el `.msi` de `0.1.6-alpha.1`, `docs/netbook-fase6.md`). El criterio de arriba queda para el cierre de 6b. Versiones (D12, cambiada por Bruno el 2026-11-27): `0.1.6` estable sale al cerrar 6a, porque profes y compañeros quieren probarla (todavía sin publicar), y 6b sale como `0.1.7`.
     - **Simula 6a:** la trifásica (con N) da potencial por borne; los contactos principales siguen a su bobina; selector y seta alternan con un clic y el final de carrera va como el pulsador; la bocina se enciende como la lámpara; termomagnéticas, diferenciales, guardamotor, seccionador, fusibles y el térmico conducen siempre (95-96 y 97-98 en reposo); un corto entre fases detiene la simulación.
     - **Queda para 6b:** el motor como carga (hoy no conduce ni es carga), abrir y disparar protecciones y térmico, y que un corto dispare la protección. El diferencial y PE, en 6b o después. Lo anotado para 6b está en `docs/ideas.md`.
7. **Exportación:** PDF vectorial con rótulo y marco, SVG y PNG.
   - Pasa cuando: el PDF de un circuito de prueba se imprime correcto en A4.
8. **Distribución:** instalador Tauri (Windows y Linux) y versión PWA.
   - Pasa cuando: se instala y corre en la netbook y en una PC con Windows.

**Después del MVP:** temporizadores, relés auxiliares, finales de carrera, varias hojas, más símbolos, advertencias de tensión, importador `.cad` y, a largo plazo, PLC en escalera.

> Nota (2026-11-16): Bruno eligió el PLC simulado con ladder básico como fase propia, después de la fase 5. El PLC genérico como símbolo iría después de la fase 4. Esas ideas, el rótulo del plano y el hardware real por USB están en `docs/ideas.md`. La hoja de ruta se actualiza cuando se planeen.

> Nota (2026-11-27): orden elegido por Bruno desde acá: 6a → biblioteca 2 → 6b → temporizadores → Automatización industrial (PLC y ladder) → instrumentos y analógicos. Las fases 7 (Exportación) y 8 (Distribución) quedan **sin ubicar**. El detalle de cada una está en `docs/ideas.md`.

## Prompts de arranque: fase 1

> Nota (2026-11-12): fase 1 cerrada; esta sección es registro histórico. Las reglas y los comandos vigentes están en CLAUDE.md.

Cinco prompts en orden, uno por sesión de trabajo. Al terminar cada uno: probar, revisar los cambios y hacer commit antes de pasar al siguiente.

**Antes de empezar (una sola vez):**

- Instalar Node.js LTS, Rust (con rustup), Git y Claude Code.
- Instalar los requisitos de Tauri para tu sistema: en Windows, Microsoft C++ Build Tools y WebView2; en Linux Mint, los paquetes de desarrollo de WebKitGTK. La guía oficial de Tauri los lista.
- Exportar este plan a Markdown y guardarlo como `docs/arquitectura.md` dentro de la carpeta del proyecto.

**Prompt 1: crear el proyecto**

```text
Vamos a crear Bornera, un editor y simulador de automatismos eléctricos liviano. Leé docs/arquitectura.md antes de empezar.

Tarea: crear el proyecto base en esta carpeta con Tauri 2 + Svelte 5 + TypeScript + Vite, usando create-tauri-app con la plantilla svelte-ts.
- TypeScript en modo estricto.
- Nombre de la app: Bornera. Identificador: com.bornera.app
- No agregues otras dependencias.

Primero mostrame el plan; después ejecutalo y decime cómo verificar que `npm run tauri dev` abre la ventana.
```

**Prompt 2: estructura y tests**

```text
Creá la estructura de carpetas de la sección "Estructura del repositorio" de docs/arquitectura.md: src/core/{model,symbols,sim,io}, src/render, src/editor, src/ui, tests/circuitos y tests/bench.
- Configurá Vitest con el script `npm test`.
- Agregá un test de ejemplo en src/core/model que pase.
- Hacé que src/core no pueda usar el DOM: un tsconfig propio para src/core sin la librería "DOM", y una regla que impida importar desde src/ui o desde Svelte.

Verificá que `npm test` pase y que el chequeo de tipos falle si alguien usa `document` dentro de src/core.
```

**Prompt 3: CLAUDE.md**

```text
Creá CLAUDE.md en la raíz copiando el bloque de la sección "Estructura del repositorio y CLAUDE.md" de docs/arquitectura.md. Agregá los comandos reales que quedaron configurados en package.json.
```

**Prompt 4: licencia, README y Git**

```text
Prepará el repositorio para publicarlo:
- LICENSE con el texto completo de la GPL-3.0.
- README.md corto: qué es Bornera, estado (en desarrollo), cómo correrlo y licencia.
- .gitignore para Node, Rust y Tauri.
- Un workflow de GitHub Actions que corra `npm test` en cada push.
- Inicializá git y hacé el primer commit: "Base del proyecto".
```

**Prompt 5: esqueleto de la interfaz**

```text
Armá el esqueleto visual de la ventana en Svelte, todavía sin funcionalidad, según la sección "Editor e interfaz" de docs/arquitectura.md:
- Barra superior, paleta izquierda plegable, lienzo central (un <canvas> que ocupe todo el espacio libre), panel derecho plegable y barra de estado.
- Tiene que verse bien en 1024×600.
- CSS propio con variables de color; tema claro u oscuro según el sistema. Íconos Lucide. Sin librerías de componentes.

Cuando termines, decime cómo probarlo.
```

**Consejos para trabajar con Claude Code:**

- En tareas grandes, activá el modo plan (Shift+Tab) para que proponga antes de tocar archivos.
- Leé siempre los cambios antes de aceptarlos; si no entendés algo, preguntale por qué lo hizo así.
- Si algo falla, pegale el error completo, no un resumen.
- Al cerrar la fase, empezá una sesión nueva (/clear) para la siguiente: el contexto limpio rinde más.

## Testing y validación

La simulación tiene que dar resultados que coincidan con lo que pasaría en el tablero real. Para eso, cada circuito clásico es un test automático con su resultado esperado.

| Circuito de referencia | Qué verifica |
| --- | --- |
| Lámpara con interruptor | Conducción básica fase-neutro |
| Marcha-parada con enclavamiento | Realimentación por contacto auxiliar; parada con NC |
| Inversión de giro con enclavamiento eléctrico | Contactos NC cruzados; sentido de giro por secuencia |
| Disparo del térmico | El 95-96 corta el mando y el motor se detiene |
| Fase con neutro sin carga | Detección de cortocircuito y fundido de fusible |
| Relé que se corta a sí mismo | Detección de oscilación sin colgar el programa |
| Dos lámparas en serie | Advertencia de carga en serie |

**Otros tests:**

- **Formato:** guardar y abrir cada circuito de referencia devuelve exactamente el mismo documento.
- **Migraciones:** archivos de versiones viejas abren bien.
- **Comandos:** cada comando, deshecho, deja el documento igual que antes.
- **Rendimiento:** el banco de pruebas no puede empeorar más de un 10 % entre fases.
  > Nota (2026-11-12): excepción aceptada en T14b. *Soltar con todo* subió 7 ms en la PC y se mide con un criterio absoluto: ≤ 200 ms en la netbook. La línea base 0.1.2 se midió en Mint con WebKitGTK; hay que rehacerla en la netbook con Windows.
  > Nota (2026-11-14, decisión de Bruno en T17): los topes de los escenarios que la versión anterior no tiene se fijan contra el commit anterior a la tarea, medido en la misma sesión con ABBA, no contra números de otro día. La netbook, al cierre de cada fase, sigue decidiendo (`docs/plan-fase3b.md`, Reglas).
  > Nota (2026-11-16, ajuste de Bruno al cierre de la fase 3b): en la comparación entre fases, los costos ya aceptados en las tareas de la fase (con su tope y su commit) se juzgan por su tope absoluto, no por el 10 %. Frena solo una suba que no esté en esa lista (`docs/plan-cierre-3b.md`, sección 6).
  > Nota (2026-11-13): en el cierre de la fase 3 (T15, etapa 4), *Encuadrar (F)* con 2000 no pasa contra 0.1.2: +20 % de trabajo por gesto, por T14n más lo acumulado desde T2. Queda anotado como "no pasa"; optimizarlo es una tarea aparte, después de T15, y la netbook decide la urgencia. Las comparaciones contra 0.1.2 se hacen con `npm run bench -- --escena-012`, para que las dos versiones dibujen la misma escena (`docs/bench.md`).
- **Prueba humana:** armar en el programa los circuitos de los trabajos de la escuela y comparar con lo que da CADe\_SIMU y con el funcionamiento real.

## Distribución y monetización

GitHub es la base: código, instaladores y actualizaciones automáticas desde un solo lugar y gratis. El resto de los canales suma alcance.

| Canal | Para qué | Costo |
| --- | --- | --- |
| GitHub (repositorio + Releases) | Código GPL e instaladores para Windows (.msi) y Linux (.AppImage, .deb), generados solos con GitHub Actions | Gratis |
| Actualizador de Tauri | Actualizaciones automáticas leídas desde los Releases, firmadas con clave propia | Gratis |
| Página web (GitHub Pages) | Presentación, capturas, descarga y manual | Gratis |
| Flathub | Aparece en el gestor de software de Linux Mint: ideal para netbooks | Gratis |
| winget | Instalación en Windows con un comando | Gratis |
| Microsoft Store | Llega al usuario común y evita el aviso de "editor desconocido" | Verificar costo de la cuenta de desarrollador |
| Redes propias y comunidades | Escuelas técnicas, docentes y grupos de electricistas | Gratis |

- **Aviso de Windows:** un instalador sin firma digital muestra la advertencia SmartScreen. La firma cuesta dinero; la Microsoft Store lo resuelve.
  > Nota (2026-11-12): opciones pendientes de decidir: SignPath (gratis para código abierto) o un certificado Certum (unos 25-70 €).
- **macOS:** queda para después, porque requiere cuenta paga de Apple.
- **Reportes de errores:** GitHub Issues, más un formulario simple en la web para quien no tenga cuenta.

**Monetización (compatible con GPL):**

- Capacitaciones para escuelas técnicas, institutos y docentes.
- Desarrollos a medida: bibliotecas de símbolos, máquinas específicas, integraciones.
- Doble licencia para empresas que quieran integrarlo en un producto cerrado (requiere el CLA).
- Patrocinio de marcas de material eléctrico con sus productos en la biblioteca.
- Donaciones (Cafecito, Mercado Pago, GitHub Sponsors).

## Riesgos y decisiones abiertas

El mayor riesgo no es técnico: es querer agregar todo antes de tener el MVP andando.

| Riesgo | Mitigación |
| --- | --- |
| Crecer el alcance antes de terminar el MVP | No se agrega nada fuera de la lista hasta cerrar la fase 8 |
| WebKitGTK lento en la netbook | Prueba de rendimiento en la fase 2; plan B: PWA en Chromium. Mitigado (2026-11-12): 0.1.2 medida en la netbook, casi 0 cuadros de más de 16 ms |
| WebView2 lento en la netbook con Windows (sin medir) | Banco de control en la netbook con Windows, con la próxima prerelease (línea base nueva) |
| Claude Code pierde el hilo en un código grande | CLAUDE.md, módulos separados, tareas chicas y tests obligatorios |
| Simulación que no coincide con la realidad | Circuitos de referencia como tests, revisados contra la práctica |
| Derechos sobre los símbolos | Dibujarlos propios según IEC 60617; si se reutilizan de otro proyecto, revisar su licencia |
| La interfaz queda incómoda en pantallas chicas | Diseñar desde el principio para 1024×600 y probar ahí |

**Decisiones:**

- [x] Nombre: Bornera; extensión de archivo: .brn.
- [x] Licencia: código abierto GPL, con acuerdo de contribución (CLA) para conservar la opción de doble licencia.
- [x] Prioridad de entrega: escritorio con Tauri primero; PWA más adelante.
- [x] Interfaz: Svelte 5, CSS propio con variables (tema claro y oscuro) e íconos Lucide.
- [x] Distribución: GitHub como base (ver sección Distribución y monetización).
