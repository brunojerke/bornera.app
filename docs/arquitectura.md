# Plan: Bornera, simulador de automatismos eléctricos

Nov 6, 2026 · @Bruno · Última revisión: 2026-11-12

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
- **Definición de símbolo:** se escribe una sola vez por tipo. Contiene el dibujo en coordenadas locales (líneas, arcos, círculos, texto), la posición y el nombre de cada borne, y el tipo de comportamiento (contacto NA, bobina, carga, fuente…).
- **Instancia de componente:** id, tipo de símbolo, posición en la grilla, rotación (0/90/180/270), espejado, etiqueta (K1, S2, H1) y parámetros (tensión, color de lámpara).
- **Cable:** id, extremos `desde` y `hasta` y los codos intermedios (tramos horizontales o verticales, en enteros). Cada extremo está en un borne, sobre otro cable (una T) o libre.
- **Unión:** punto donde llegan 3 o más brazos de una misma conexión (extremos de cable, bornes con cable y el anfitrión de una T); se calcula sola y no se guarda.

**Reglas clave:**

- Todas las coordenadas van en **unidades de grilla** (enteros), no en píxeles. Así el zoom y el PDF no cambian nada del modelo.
- Los contactos se vinculan a su bobina **por etiqueta**: todo lo que se llame K1 sigue a la bobina K1.
- Ningún cambio se aplica directo: todo pasa por un **comando** (colocar, mover, rotar, espejar, borrar, cablear, cambiar un extremo, cambiar la etiqueta, y varios juntos en un grupo). Eso da deshacer/rehacer gratis y evita estados corruptos.
- El núcleo del modelo no depende del navegador: se puede probar entero con tests sin abrir la interfaz.

## Motor de simulación

Simulación **lógica por conectividad**, no analógica: alcanza para automatismos y es muchísimo más liviana que un SPICE. Solo recalcula cuando algo cambia (un clic, un timer), nunca en un bucle constante.

**Algoritmo de cada recálculo:**

1. **Armar la netlist:** se agrupan en "redes" todos los bornes unidos por cables (estructura union-find). Además, los bornes de alimentación con el mismo nombre de red (sin espacios a los lados y en mayúsculas) se unen aunque no haya cable, como etiquetas de red: en Fase y Neutro el nombre es la etiqueta del componente; en una fuente trifásica, el nombre de cada borne. Se hace una vez al entrar a simulación.
   > Nota (2026-11-12): las redes de este paso ya están en `src/core/model/redes.ts` (fase 3, T15), sin simular: `redes(hoja)` une por cables y, con `unirPorNombre`, por nombre. Falta el nombre por borne de la fuente trifásica, que se suma con los símbolos de potencia.
2. **Unir por contactos cerrados:** cada contacto, pulsador o fusible que conduce une sus dos redes. Las cargas (bobinas, lámparas, motores) nunca unen redes: son los "cortes" del circuito.
3. **Propagar potenciales:** cada red queda marcada con las fuentes que la alcanzan (L, N, L1, L2, L3, +, −).
4. **Detectar cortocircuito:** si una misma red recibe L y N, o dos fases distintas, se marca el cortocircuito, se funde el fusible aguas arriba (si hay) o se detiene la simulación con aviso.
5. **Evaluar cargas:** una bobina o lámpara se energiza si un borne está en fase y el otro en neutro (o + y −). Un motor trifásico gira si U, V y W reciben las tres fases; el sentido sale de la paridad de la secuencia (L1-L2-L3 vs L1-L3-L2).
6. **Actualizar contactos:** las bobinas energizadas cambian sus contactos asociados.
7. **Repetir hasta estabilizar:** se vuelve al paso 2 hasta que nada cambie. Si tras 50 iteraciones sigue cambiando, es un circuito oscilante (un relé que se corta a sí mismo): se avisa en vez de colgar el programa.

**Detalles importantes:**

- **Enclavamientos y realimentaciones** salen solos del punto fijo del paso 7.
- **Cargas en serie** (dos lámparas en serie): el modelo simplificado no las resuelve bien. En el MVP se detectan y se marca una advertencia.
- **Tensión incorrecta** (bobina de 24 V conectada a 220 V): se deja para una fase posterior, como advertencia.
- **Temporizadores** (fase posterior): se agregan como una cola de eventos con tiempo simulado; un timer que vence dispara un recálculo.
- **Interacción:** en modo simulación, mantener apretado un pulsador lo acciona; un clic en el térmico lo dispara o lo rearma.
- **Visual:** los conductores con tensión se pintan de un color por potencial (fase, neutro, CC); las lámparas se encienden y los motores muestran el giro con una flecha animada.

## Editor e interfaz

La interfaz tiene que ser cómoda en una pantalla de 1024×600: lienzo grande, paneles que se pliegan y atajos de teclado para todo lo frecuente.

**Distribución de pantalla:**

- **Arriba:** barra de herramientas (nuevo, abrir, guardar, exportar PDF, deshacer/rehacer, zoom) y el botón grande **Editar / Simular**.
- **Izquierda:** paleta de componentes por categoría (fuentes, mando, potencia, señalización), con buscador. Plegable.
- **Centro:** lienzo con grilla.
- **Derecha:** propiedades del elemento seleccionado (etiqueta, tensión, rotación). Plegable; se abre solo al seleccionar.
- **Abajo:** barra de estado (coordenadas, zoom, avisos de simulación).

**Funciones del editor:**

- Arrastrar desde la paleta y soltar con ajuste a la grilla.
- Seleccionar con clic o con rectángulo; mover, rotar (R), espejar (M) y borrar (Supr).
- Herramienta cable (W): clic en un borne, codos en ángulo recto automáticos, clic en el destino. Los bornes libres se resaltan al pasar el mouse.
- Al mover un componente, los cables conectados lo siguen.
- Copiar, cortar, pegar y duplicar (Ctrl+D).
- Deshacer/rehacer ilimitado (Ctrl+Z / Ctrl+Y).
- Zoom con la rueda centrado en el mouse; desplazamiento con botón del medio o espacio + arrastrar; "encuadrar todo" (F).
- Etiquetado automático: el segundo contactor que se coloca es K2, el tercer pulsador S3, etc.
- Referencias cruzadas: debajo de cada bobina, la lista de dónde están sus contactos.
- Validaciones en vivo: bornes sin conectar y cables sueltos marcados en naranja.

> Nota (2026-11-12): copiar/pegar, etiquetado automático, referencias cruzadas y validaciones en vivo quedaron fuera del criterio de la fase 3 (`docs/plan-fase3.md` los propone como T16–T19). Ubicación pendiente de decisión de Bruno.

**Atajos principales:** F5 alterna editar/simular, Ctrl+N nuevo, Ctrl+O abre, Ctrl+S guarda, Ctrl+Mayús+S guarda como, Ctrl+P exporta PDF (con la exportación, fase 7), Esc cancela la herramienta actual. Tema claro y oscuro.

## Renderizado y rendimiento

La diferencia con CADe\_SIMU se gana acá: **dibujar solo lo necesario, solo cuando algo cambia**. Estas reglas se fijan desde el día uno porque agregarlas después cuesta el triple.

- **Interfaz de dibujo única:** un `Renderer` con operaciones básicas (línea, arco, círculo, texto) y tres implementaciones: Canvas (pantalla), SVG y PDF. Cada símbolo se dibuja una sola vez en código y sale igual en los tres.
- **Sin bucle constante:** se redibuja con `requestAnimationFrame` solo cuando hubo un cambio. Con el programa quieto, el consumo de CPU es cero.
- **Capas:** la grilla y los componentes van en una capa estática cacheada en un canvas fuera de pantalla; la selección, el cable en curso y el estado de simulación van en una capa dinámica encima.
- **Recorte por vista:** solo se dibuja lo que entra en pantalla.
- **Índice espacial:** grilla de hash para saber en tiempo constante qué hay bajo el mouse, sin recorrer todos los componentes.
- **Símbolos precompilados:** cada definición se convierte una vez en `Path2D`, que el navegador dibuja mucho más rápido.
- **Nivel de detalle:** con zoom muy alejado se omiten textos y bornes.
- **Simulación incremental:** la netlist se arma una vez; durante la simulación solo se recalculan los contactos que cambiaron.

**Banco de pruebas:** un script que genera circuitos de 100, 500 y 2000 componentes y mide fotogramas por segundo, tiempo de recálculo y RAM. Se corre en la netbook al final de cada fase.

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

Acá va con sangría para leerlo. En el archivo, `serializar` lo escribe en forma canónica: JSON compacto en una línea, todos los campos explícitos y las claves en orden fijo (ver `docs/plan-T15a.md`, §1).

**Reglas:**

- **Compresión:** Guardar escribe gzip con `CompressionStream` del navegador (sin librerías); si el sistema no lo tiene, guarda sin comprimir y lo avisa. Abrir acepta los dos (los distingue por los bytes `1f 8b`). Tope: 16 MB. Un circuito escolar pesa pocos KB.
- **Versión y migraciones:** hoy hay una sola versión (1). Un archivo de una versión más nueva se rechaza ("hecho con una versión más nueva de Bornera"). Cada cambio de estructura sube `version` y agrega una función que convierte la versión anterior. Los archivos viejos siempre abren.
- **Validación al abrir:** un archivo dañado se rechaza con la lista de problemas, sin cerrar el programa: claves desconocidas, cables rotos, contadores atrasados, ciclos de apoyos o una T sobre el extremo de su anfitrión. Un símbolo desconocido sin cables abre con "?" y un aviso.
- **Autoguardado:** copia de recuperación cada 60 s en el almacenamiento local (pendiente, fase 4).
- **Biblioteca separada:** los símbolos no se guardan dentro de cada archivo; solo se referencia su tipo (`contactor.bobina`).
- **Exportación de respaldo:** opción de guardar sin comprimir (`.brn.json`) para revisarlo o versionarlo con Git (pendiente: T15a la dejó para la fase 4).

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
│   └── bench.md           resultados del banco de dibujado
├── src/
│   ├── core/              sin dependencias del navegador
│   │   ├── model/         tipos, documento, comandos, deshacer
│   │   ├── symbols/       definiciones de símbolos IEC
│   │   ├── sim/           netlist, solver, eventos
│   │   ├── io/            formato .brn, migraciones, validación
│   │   └── circuitos/     circuitos de referencia armados con comandos y su comparación por redes (solo los usan los tests)
│   ├── render/            Renderer: canvas, svg, pdf
│   ├── editor/            herramientas, selección, índice espacial
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
4. **Guardar y abrir:** formato `.brn`, validación, autoguardado.
   - Pasa cuando: guardar → cerrar → abrir deja el circuito idéntico (test automático).
5. **Simulación de mando:** fuentes, pulsadores, contactor, contactos auxiliares, lámpara, modo simular.
   - Pasa cuando: la marcha-parada con enclavamiento funciona y su test pasa.
6. **Potencia:** fuente trifásica, contactos principales, térmico, fusible, motores, cortocircuito.
   - Pasa cuando: la inversión de giro con enclavamiento eléctrico simula bien ambos sentidos.
7. **Exportación:** PDF vectorial con rótulo y marco, SVG y PNG.
   - Pasa cuando: el PDF de un circuito de prueba se imprime correcto en A4.
8. **Distribución:** instalador Tauri (Windows y Linux) y versión PWA.
   - Pasa cuando: se instala y corre en la netbook y en una PC con Windows.

**Después del MVP:** temporizadores, relés auxiliares, finales de carrera, varias hojas, más símbolos, advertencias de tensión, importador `.cad` y, a largo plazo, PLC en escalera.

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
