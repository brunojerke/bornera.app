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
  import { documentoBanco, documentoBancoCables } from "../editor/banco";
  import { SIMBOLOS_BANCO_CABLES } from "./escenas";
  import * as comandos from "../core/model/comandos";
  import * as cables from "../core/model/cables";
  import Rendimiento from "./Rendimiento.svelte";
  import type { EscenaDesarrollo, Modo } from "./tipos";

  let {
    zoom = $bindable(1),
    cursor = $bindable(null),
    colocando = $bindable(null),
    cableActivo = $bindable(false),
    pista = $bindable(null),
    puedeDeshacer = $bindable(false),
    puedeRehacer = $bindable(false),
    modificado = $bindable(false),
    tituloDocumento = $bindable(""),
    activo = $bindable(null),
    modo = "editar",
    escena = "documento",
    rendimiento = false,
    opciones = OPCIONES_OPTIMIZADAS,
    diagnostico = { modo: "auto", sonda: false },
    onseleccion,
    onaviso,
  }: {
    /** Zoom actual (1 = 100 %). Solo lectura desde afuera. */
    zoom?: number;
    /** Posición del mouse en unidades de grilla; null fuera del lienzo. */
    cursor?: Punto | null;
    /** Tipo del símbolo que se está colocando; null si no hay herramienta. Solo lectura desde afuera. */
    colocando?: string | null;
    /** La herramienta cable (W) está activa. Solo lectura desde afuera. */
    cableActivo?: boolean;
    /** Pista de la herramienta para la barra de estado; null si no hay. Solo lectura desde afuera. */
    pista?: string | null;
    /** Hay algo para deshacer o rehacer en el editor a la vista. Solo lectura desde afuera. */
    puedeDeshacer?: boolean;
    puedeRehacer?: boolean;
    /**
     * El documento (no una escena del banco) tiene cambios sin guardar. Solo
     * lectura desde afuera. Mientras se ve otra escena no cambia: el
     * documento no se puede editar desde ahí.
     */
    modificado?: boolean;
    /** `meta.titulo` del documento (para el título de la ventana). Solo lectura desde afuera. */
    tituloDocumento?: string;
    /** Editor de lo que se muestra (null en las escenas que no se editan). Solo lectura desde afuera. */
    activo?: Editor | null;
    /** Modo de trabajo: en Simular, los atajos de edición no actúan. */
    modo?: Modo;
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
    /** Una acción que no se pudo hacer (para la barra de estado). */
    onaviso?: (texto: string) => void;
  } = $props();

  let canvas: HTMLCanvasElement;
  let vista: Vista | null = null;

  // El editor del documento: cambiar a una escena de prueba y volver no pierde
  // el documento ni su historial. Abrir y Nuevo lo reemplazan por otro
  // (`reemplazarDocumento`, D19-A). Las escenas del banco (100, 500, 2000) se
  // abren en un editor aparte, que se descarta al salir: así se puede
  // seleccionar con 2000 símbolos sin tocar el documento.
  let editorDocumento = new Editor();
  /** El editor de lo que se muestra; null en las escenas que no se editan. */
  let editor: Editor | null = editorDocumento;
  let herramientas: Herramientas | null = null;

  function editorPara(e: EscenaDesarrollo): Editor | null {
    if (e === "documento") return editorDocumento;
    if (typeof e === "number") return new Editor(documentoBanco(e));
    if (e === "cables") return new Editor(documentoBancoCables(SIMBOLOS_BANCO_CABLES));
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
      editor.alCambiarHistorial = null;
      editor.alAvisar = null;
      editor.alCambiarPista = null;
    }
    editor = ed;
    activo = ed;
    if (ed) ed.diagnostico = { ...untrack(() => diagnostico) };
    v.dinamico = ed?.dibujarDinamico ?? null;
    colocando = null;
    cableActivo = false;
    pista = null;
    onseleccion?.(ed?.resumenSeleccion() ?? SIN_SELECCION);
    const historial = () => {
      puedeDeshacer = ed?.puedeDeshacer ?? false;
      puedeRehacer = ed?.puedeRehacer ?? false;
      if (ed === editorDocumento) {
        modificado = ed.modificado;
        tituloDocumento = ed.documento.meta.titulo;
      }
    };
    historial();
    if (!ed) return;
    ed.vista = v;
    ed.alCambiarHerramienta = () => {
      colocando = ed.colocar?.def.tipo ?? null;
      cableActivo = ed.cable !== null;
    };
    ed.alCambiarPista = (p) => (pista = p);
    ed.alCambiarSeleccion = () => onseleccion?.(ed.resumenSeleccion());
    ed.alCambiarHistorial = historial;
    ed.alAvisar = (t) => onaviso?.(t);
    // Después de la navegación: lo que ella consume llega con defaultPrevented.
    herramientas = conectarHerramientas(canvas, {
      camara: v.camara,
      editor: ed,
      atajosActivos: () => modo === "editar",
    });
  }

  // Desarrollo: ejecutar comandos desde la consola. Por ejemplo:
  //   const { editor, comandos: c } = bornera;
  //   editor.ejecutar(c.colocar(editor.documento, { tipo: "contactor.bobina",
  //     x: 0, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: {} }));
  //   editor.ejecutar(c.cablear(editor.documento, { desde: { tipo: "borne", comp: "c1", borne: "A1" },
  //     hasta: { tipo: "libre", x: 0, y: -6 }, codos: [] }));
  //   editor.deshacer();
  // `bornera.activo()` da el editor de lo que se muestra (el del banco, en esas escenas).
  // `bornera.editor` se lee en el momento: después de Abrir o Nuevo es el
  // editor nuevo, y no se retiene el documento viejo.
  if (import.meta.env.DEV) {
    (globalThis as Record<string, unknown>).bornera = {
      get editor() {
        return editorDocumento;
      },
      comandos,
      cables,
      activo: () => editor,
      diagnosticarArrastre,
    };
  }

  /**
   * Prueba automática del arrastre (diagnóstico de la alpha.2; con cables
   * desde T14a) sobre lo que se muestra (la escena de 2000 con cables).
   * Devuelve la tabla en Markdown.
   */
  export async function diagnosticarArrastre(op: OpcionesDiagnostico = {}): Promise<string> {
    const v = vista;
    const ed = editor;
    if (!v || !ed) throw new Error("No hay una escena editable a la vista.");
    ed.cancelarHerramienta();
    const { combinaciones, extras } = await probarArrastre(v, ed, op);
    const hoja = ed.documento.hojas[0];
    const derivaciones = hoja?.cables.filter((w) => w.desde.tipo === "cable" || w.hasta.tipo === "cable").length ?? 0;
    const nCables = ed.escena.cantidadCables;
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
        escena:
          `${ed.escena.cantidad}` + (nCables > 0 ? ` + ${nCables - derivaciones} cables` : "") + (derivaciones > 0 ? ` + ${derivaciones} T` : ""),
      },
      combinaciones,
      extras,
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
    // La cámara se movió con el mouse quieto: la herramienta cable vuelve a mirar qué hay bajo el cursor.
    herramientas?.refrescar();
  }

  /** Botones de la barra: lo mismo que Ctrl+Z y Ctrl+Y (no en medio de un gesto). */
  export function deshacer() {
    if (modo === "editar") editor?.accion("deshacer");
  }

  export function rehacer() {
    if (modo === "editar") editor?.accion("rehacer");
  }

  /** Botón de la paleta: lo mismo que W. */
  export function alternarCable() {
    if (modo === "editar") editor?.accion("cable");
  }

  /** Hay un gesto del puntero en curso en el editor a la vista (F5 no cambia de modo). */
  export function enGesto(): boolean {
    return editor?.enGesto ?? false;
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

  /** Quienes esperan el próximo cuadro dibujado (ver `reemplazarDocumento`). */
  let esperasCuadro: (() => void)[] = [];

  /**
   * Abrir y Nuevo (D19-A): el documento pasa a ser el de `ed`, con su
   * historial. Si se está viendo el documento, se conecta (lo que desconecta
   * al editor anterior) y se dibuja encuadrado. La promesa se cumple con el
   * primer cuadro dibujado después del cambio ("Abierto en N ms").
   */
  export function reemplazarDocumento(ed: Editor): Promise<void> {
    editorDocumento = ed;
    const v = vista;
    if (!v || escena !== "documento") {
      // No debería pasar: Abrir y Nuevo no andan en el banco. Al volver al
      // documento, `editorPara` ya da el editor nuevo.
      modificado = ed.modificado;
      tituloDocumento = ed.documento.meta.titulo;
      return Promise.resolve();
    }
    const cuadro = new Promise<void>((r) => esperasCuadro.push(r));
    v.contenido = ed.escena;
    conectarEditor(v, ed);
    encuadrar();
    return cuadro;
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
      if (esperasCuadro.length > 0) {
        const esperas = esperasCuadro;
        esperasCuadro = [];
        for (const cumplir of esperas) cumplir();
      }
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

  // Al pasar a Simular se termina la herramienta activa (Cable o Colocar), sin
  // cambiar el documento: un cable en curso se descarta.
  $effect(() => {
    if (modo === "simular") untrack(() => editor?.cancelarHerramienta());
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
    <Rendimiento {resumen} {memoriaCache} {detalle} sonda={diagnostico.sonda} />
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
