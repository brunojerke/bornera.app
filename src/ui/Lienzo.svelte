<script lang="ts">
  // Lienzo central: un <canvas> que ocupa todo el espacio libre.
  // El dibujo lo hace la Vista (src/render) y la navegación src/editor.
  // No hay bucle: solo se redibuja cuando algo cambia.
  import { untrack } from "svelte";
  import { Vista, PASO_ZOOM } from "../render/vista";
  import { conectarNavegacion } from "../editor/navegacion";
  import { PX_POR_UNIDAD, type Punto } from "../render/camara";
  import { OPCIONES_OPTIMIZADAS, type OpcionesCapas } from "../render/capas";
  import { nivelDetalle } from "../render/detalle";
  import { Escena, type Contenido } from "../render/escena";
  import { MedidorRendimiento, type Resumen } from "../render/rendimiento";
  import { crearEscenaBanco } from "../render/banco";
  // TEMPORAL: escenas de prueba, hasta que el documento tenga componentes.
  import { ESCENA_PRUEBA } from "../render/escenaPrueba";
  import Rendimiento from "./Rendimiento.svelte";
  import type { EscenaDesarrollo } from "./tipos";

  let {
    zoom = $bindable(1),
    cursor = $bindable(null),
    escena = "simbolos",
    rendimiento = false,
    opciones = OPCIONES_OPTIMIZADAS,
  }: {
    /** Zoom actual (1 = 100 %). Solo lectura desde afuera. */
    zoom?: number;
    /** Posición del mouse en unidades de grilla; null fuera del lienzo. */
    cursor?: Punto | null;
    /** Escena de prueba que se dibuja. */
    escena?: EscenaDesarrollo;
    /** Muestra el contador de rendimiento (F3). */
    rendimiento?: boolean;
    /** Optimizaciones activas (para compararlas). */
    opciones?: Readonly<OpcionesCapas>;
  } = $props();

  let canvas: HTMLCanvasElement;
  let vista: Vista | null = null;

  function crearContenido(e: EscenaDesarrollo): Contenido {
    if (e === "simbolos") return ESCENA_PRUEBA;
    if (e === "vacia") return new Escena([]);
    return crearEscenaBanco(e);
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

  export function encuadrar() {
    if (!vista) return;
    vista.encuadrar(vista.contenido?.caja ?? null);
    cambio();
  }

  // ── Contador de rendimiento ──────────────────────────────────────────────
  // Se actualiza 4 veces por segundo mientras haya cuadros, y una última vez
  // cuando ya pasó un segundo sin dibujar (FPS en 0). Sin cuadros, sin timer.

  const medidor = new MedidorRendimiento();
  let resumen = $state<Resumen>(medidor.resumen(0));
  let memoriaCache = $state(0);
  let temporizador = 0;

  function actualizarResumen() {
    temporizador = 0;
    resumen = medidor.resumen(performance.now());
    memoriaCache = vista?.memoriaCache ?? 0;
    if (rendimiento && resumen.fps > 0) programarResumen();
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
    const v = new Vista(canvas, untrack(() => crearContenido(escena)));
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
    return () => {
      desconectar();
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
      vista.contenido = crearContenido(e);
      encuadrar();
    });
  });

  $effect(() => {
    const o = { ...opciones };
    untrack(() => {
      if (vista) vista.opciones = o;
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
