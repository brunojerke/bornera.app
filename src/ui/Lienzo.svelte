<script lang="ts">
  // Lienzo central: un <canvas> que ocupa todo el espacio libre.
  // El dibujo lo hace la Vista (src/render); la navegación y el Editor (el
  // documento con su historial) viven en src/editor.
  // No hay bucle: solo se redibuja cuando algo cambia.
  import { untrack } from "svelte";
  import { Vista, PASO_ZOOM } from "../render/vista";
  import { conectarNavegacion } from "../editor/navegacion";
  import { conectarHerramientas, type Herramientas } from "../editor/punteros";
  import type { DefinicionSimbolo } from "../core/symbols";
  import { PX_POR_UNIDAD, type Punto } from "../render/camara";
  import { OPCIONES_OPTIMIZADAS, type OpcionesCapas } from "../render/capas";
  import { nivelDetalle } from "../render/detalle";
  import { Escena, type Contenido } from "../render/escena";
  import { MedidorRendimiento, type Resumen } from "../render/rendimiento";
  import { ESCENA_PRUEBA } from "../render/escenaPrueba";
  import { Editor, SIN_SELECCION, type DiagnosticoArrastre, type ResumenSeleccion } from "../editor/editor";
  import { probarArrastre, type OpcionesDiagnostico } from "./diagnosticoArrastre";
  import { ARRASTRADOS_DIAGNOSTICO, DURACION_DIAGNOSTICO_MS, tablaDiagnostico } from "./diagnostico";
  import { VERSION } from "./version";
  import { documentoBanco } from "../editor/banco";
  import * as comandos from "../core/model/comandos";
  import Rendimiento from "./Rendimiento.svelte";
  import type { EscenaDesarrollo } from "./tipos";

  let {
    zoom = $bindable(1),
    cursor = $bindable(null),
    colocando = $bindable(null),
    escena = "documento",
    rendimiento = false,
    opciones = OPCIONES_OPTIMIZADAS,
    diagnostico = { modo: "auto", sonda: false },
    onseleccion,
  }: {
    /** Zoom actual (1 = 100 %). Solo lectura desde afuera. */
    zoom?: number;
    /** Posición del mouse en unidades de grilla; null fuera del lienzo. */
    cursor?: Punto | null;
    /** Tipo del símbolo que se está colocando; null si no hay herramienta. Solo lectura desde afuera. */
    colocando?: string | null;
    /** Qué se dibuja: el documento o una escena de prueba. */
    escena?: EscenaDesarrollo;
    /** Muestra el contador de rendimiento (F3). */
    rendimiento?: boolean;
    /** Optimizaciones activas (para compararlas). */
    opciones?: Readonly<OpcionesCapas>;
    /** Diagnóstico del arrastre (menú de desarrollo). */
    diagnostico?: Readonly<DiagnosticoArrastre>;
    /** Cambió la selección o algo seleccionado. */
    onseleccion?: (resumen: ResumenSeleccion) => void;
  } = $props();

  let canvas: HTMLCanvasElement;
  let vista: Vista | null = null;

  // El editor del documento dura lo que dura el lienzo: cambiar a una escena
  // de prueba y volver no pierde el documento ni su historial. Las escenas del
  // banco (100, 500, 2000) se abren en un editor aparte, que se descarta al
  // salir: así se puede seleccionar con 2000 símbolos sin tocar el documento.
  const editorDocumento = new Editor();
  /** El editor de lo que se muestra; null en las escenas que no se editan. */
  let editor: Editor | null = editorDocumento;
  let herramientas: Herramientas | null = null;

  function editorPara(e: EscenaDesarrollo): Editor | null {
    if (e === "documento") return editorDocumento;
    if (typeof e === "number") return new Editor(documentoBanco(e));
    return null;
  }

  /** Conecta el editor `ed` a la vista: herramientas, capa dinámica y avisos. */
  function conectarEditor(v: Vista, ed: Editor | null) {
    herramientas?.desconectar();
    herramientas = null;
    if (editor && editor !== ed) {
      editor.vista = null;
      editor.alCambiarHerramienta = null;
      editor.alCambiarSeleccion = null;
    }
    editor = ed;
    if (ed) ed.diagnostico = { ...untrack(() => diagnostico) };
    v.dinamico = ed?.dibujarDinamico ?? null;
    colocando = null;
    onseleccion?.(ed?.resumenSeleccion() ?? SIN_SELECCION);
    if (!ed) return;
    ed.vista = v;
    ed.alCambiarHerramienta = () => (colocando = ed.herramienta?.def.tipo ?? null);
    ed.alCambiarSeleccion = () => onseleccion?.(ed.resumenSeleccion());
    // Después de la navegación: lo que ella consume llega con defaultPrevented.
    herramientas = conectarHerramientas(canvas, { camara: v.camara, editor: ed });
  }

  // Desarrollo: ejecutar comandos desde la consola. Por ejemplo:
  //   const { editor, comandos: c } = bornera;
  //   editor.ejecutar(c.colocar(editor.documento, { tipo: "contactor.bobina",
  //     x: 0, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: {} }));
  //   editor.deshacer();
  // `bornera.activo()` da el editor de lo que se muestra (el del banco, en esas escenas).
  if (import.meta.env.DEV) {
    (globalThis as Record<string, unknown>).bornera = {
      editor: editorDocumento,
      comandos,
      activo: () => editor,
      diagnosticarArrastre,
    };
  }

  /**
   * Prueba automática del arrastre (diagnóstico de la alpha.2) sobre lo que
   * se muestra (la escena de 2000). Devuelve la tabla en Markdown.
   */
  export async function diagnosticarArrastre(op: OpcionesDiagnostico = {}): Promise<string> {
    const v = vista;
    const ed = editor;
    if (!v || !ed) throw new Error("No hay una escena editable a la vista.");
    ed.cancelarHerramienta();
    const resultados = await probarArrastre(v, ed, op);
    return tablaDiagnostico(
      {
        version: VERSION,
        navegador: navigator.userAgent,
        ancho: v.ancho,
        alto: v.alto,
        dpr: window.devicePixelRatio || 1,
        fecha: new Date().toISOString().slice(0, 16).replace("T", " "),
        arrastrados: Math.min(ARRASTRADOS_DIAGNOSTICO, ed.escena.cantidad),
        duracionMs: op.duracionMs ?? DURACION_DIAGNOSTICO_MS,
      },
      resultados,
    );
  }

  function crearContenido(e: EscenaDesarrollo, ed: Editor | null): Contenido {
    if (ed) return ed.escena;
    if (e === "simbolos") return ESCENA_PRUEBA;
    return new Escena([]);
  }

  function cambio() {
    if (!vista) return;
    vista.invalidar();
    zoom = vista.camara.zoom;
  }

  export function acercar() {
    if (vista?.zoomAlCentro(PASO_ZOOM)) cambio();
  }

  export function alejar() {
    if (vista?.zoomAlCentro(1 / PASO_ZOOM)) cambio();
  }

  /** Empieza a colocar un símbolo desde un pointerdown en la paleta. */
  export function iniciarColocar(def: DefinicionSimbolo, e: PointerEvent) {
    herramientas?.desdePaleta(def, e);
  }

  export function encuadrar() {
    if (!vista) return;
    vista.encuadrar(vista.contenido?.caja ?? null);
    cambio();
  }

  // ── Contador de rendimiento ──────────────────────────────────────────────
  // Se actualiza 4 veces por segundo mientras haya cuadros o queden cuadros
  // lentos en la ventana de 5 s, y una última vez cuando ya no hay ninguno de
  // los dos (FPS y lentos en 0). Sin cuadros recientes, sin timer.

  const medidor = new MedidorRendimiento();
  let resumen = $state<Resumen>(medidor.resumen(0));
  let memoriaCache = $state(0);
  let temporizador = 0;

  function actualizarResumen() {
    temporizador = 0;
    resumen = medidor.resumen(performance.now());
    memoriaCache = vista?.memoriaCache ?? 0;
    if (rendimiento && (resumen.fps > 0 || resumen.lentos > 0)) programarResumen();
  }

  function programarResumen() {
    if (!temporizador) temporizador = window.setTimeout(actualizarResumen, 250);
  }

  const detalle = $derived.by(() => {
    if (!opciones.nivelDetalle) return "completo (forzado)";
    const d = nivelDetalle(PX_POR_UNIDAD * zoom);
    return d.textos ? "completo" : "sin textos ni bornes";
  });

  $effect(() => {
    if (rendimiento) untrack(actualizarResumen);
  });

  // ── Vista ────────────────────────────────────────────────────────────────

  $effect(() => {
    const e = untrack(() => escena);
    const ed = editorPara(e);
    const v = new Vista(canvas, crearContenido(e, ed));
    vista = v;
    v.alDibujar = (m) => {
      medidor.registrar(performance.now(), m);
      if (rendimiento) programarResumen();
    };
    const desconectar = conectarNavegacion(canvas, {
      camara: v.camara,
      alCambiar: cambio,
      alEncuadrar: encuadrar,
      alMoverCursor: (p) => (cursor = p),
    });
    untrack(() => conectarEditor(v, ed));
    return () => {
      herramientas?.desconectar();
      herramientas = null;
      desconectar();
      if (editor) editor.vista = null;
      v.destruir();
      vista = null;
      clearTimeout(temporizador);
      temporizador = 0;
    };
  });

  // Cambio de escena: la nueva se dibuja encuadrada.
  let escenaActual: EscenaDesarrollo | null = null;
  $effect(() => {
    const e = escena;
    untrack(() => {
      if (!vista || e === escenaActual) return;
      const primera = escenaActual === null;
      escenaActual = e;
      if (primera) return; // la Vista ya se creó con esta escena
      // Desconectar las herramientas termina la que estaba (Colocar) sin colocar.
      const ed = editorPara(e);
      vista.contenido = crearContenido(e, ed);
      conectarEditor(vista, ed);
      encuadrar();
    });
  });

  $effect(() => {
    const o = { ...opciones };
    untrack(() => {
      if (vista) vista.opciones = o;
    });
  });

  $effect(() => {
    const d = { ...diagnostico };
    untrack(() => {
      if (editor) editor.diagnostico = d;
      vista?.invalidar();
    });
  });
</script>

<div class="lienzo">
  <canvas bind:this={canvas} aria-label="Lienzo del circuito"></canvas>
  {#if rendimiento}
    <Rendimiento {resumen} {memoriaCache} {detalle} />
  {/if}
</div>

<style>
  .lienzo {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    background: var(--lienzo);
  }

  /* Posición absoluta: el tamaño del canvas no empuja el layout. */
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    /* La rueda y los gestos los maneja la navegación, no el navegador. */
    touch-action: none;
  }
</style>
