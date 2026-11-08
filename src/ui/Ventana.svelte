<script lang="ts">
  // Esqueleto de la ventana: barra superior, paleta, lienzo, propiedades y estado.
  import "./tema.css";
  import BarraSuperior from "./BarraSuperior.svelte";
  import Paleta from "./Paleta.svelte";
  import Lienzo from "./Lienzo.svelte";
  import PanelPropiedades from "./PanelPropiedades.svelte";
  import BarraEstado from "./BarraEstado.svelte";
  import type { EscenaDesarrollo, Modo } from "./tipos";
  import { esAtajoBanco, siguienteEscenaBanco } from "./escenas";
  import type { Punto } from "../render/camara";
  import { OPCIONES_OPTIMIZADAS, type OpcionesCapas } from "../render/capas";
  import { SIN_SELECCION, type DiagnosticoArrastre, type ResumenSeleccion } from "../editor/editor";
  import { abrirAlSeleccionar } from "./propiedades";
  import { tick } from "svelte";
  import DialogoDiagnostico from "./DialogoDiagnostico.svelte";

  let modo = $state<Modo>("editar");
  let paletaAbierta = $state(true);
  let propiedadesAbierto = $state(false);
  /** El usuario plegó el panel con el botón: no se vuelve a abrir solo. */
  let propiedadesPlegadoPorUsuario = false;
  let seleccion = $state<ResumenSeleccion>(SIN_SELECCION);
  let zoom = $state(1);
  let cursor = $state<Punto | null>(null);
  /** Tipo del símbolo que se está colocando (para resaltarlo en la paleta). */
  let colocando = $state<string | null>(null);
  let lienzo: ReturnType<typeof Lienzo>;

  // Lo que muestra el lienzo (el documento, salvo que se elija una escena de
  // prueba), contador de rendimiento y optimizaciones.
  let escena = $state<EscenaDesarrollo>("documento");
  let rendimiento = $state(false);
  let opciones = $state<OpcionesCapas>({ ...OPCIONES_OPTIMIZADAS });
  let diagnostico = $state<DiagnosticoArrastre>({ modo: "auto", sonda: false });

  /** Prueba automática del arrastre: estado del diálogo (null: cerrado). */
  let prueba = $state<{ corriendo: boolean; texto: string } | null>(null);

  async function probarArrastre() {
    if (prueba?.corriendo) return;
    prueba = { corriendo: true, texto: "Abriendo la escena de 2000…" };
    try {
      escena = 2000;
      await tick();
      // Dos cuadros: la escena nueva ya está conectada y dibujada.
      for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r));
      const tabla = await lienzo.diagnosticarArrastre({
        progreso: (t) => {
          if (prueba) prueba.texto = `Midiendo: ${t}…`;
        },
      });
      prueba = { corriendo: false, texto: tabla };
    } catch (e) {
      prueba = { corriendo: false, texto: `La prueba falló: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  function alCambiarSeleccion(r: ResumenSeleccion) {
    if (abrirAlSeleccionar(seleccion.cantidad, r.cantidad, propiedadesPlegadoPorUsuario)) propiedadesAbierto = true;
    seleccion = r;
  }

  function alTecla(e: KeyboardEvent) {
    // F3: contador de rendimiento (y que el navegador no abra "Buscar").
    if (e.key === "F3" && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      if (!e.repeat) rendimiento = !rendimiento;
    }
    // Ctrl+Shift+B (oculto, también en la versión compilada): siguiente escena
    // del banco de pruebas. Se anula el atajo del WebView (barra de favoritos).
    if (esAtajoBanco(e)) {
      e.preventDefault();
      if (!e.repeat) escena = siguienteEscenaBanco(escena);
    }
  }
</script>

<svelte:window onkeydown={alTecla} />

<div class="ventana">
  <BarraSuperior
    bind:modo
    {zoom}
    onacercar={() => lienzo.acercar()}
    onalejar={() => lienzo.alejar()}
    onencuadrar={() => lienzo.encuadrar()}
    bind:escena
    bind:rendimiento
    bind:opciones
    bind:diagnostico
    onprobararrastre={probarArrastre}
  />
  <main class="centro">
    <Paleta
      bind:abierta={paletaAbierta}
      activo={colocando}
      desactivada={escena !== "documento"}
      onelegir={(def, e) => lienzo.iniciarColocar(def, e)}
    />
    <Lienzo
      bind:this={lienzo}
      bind:zoom
      bind:cursor
      bind:colocando
      {escena}
      {rendimiento}
      {opciones}
      {diagnostico}
      onseleccion={alCambiarSeleccion}
    />
    <PanelPropiedades
      bind:abierto={propiedadesAbierto}
      {seleccion}
      onalternar={(abierto) => (propiedadesPlegadoPorUsuario = !abierto)}
    />
  </main>
  <BarraEstado {modo} {zoom} {cursor} />
</div>

{#if prueba}
  <DialogoDiagnostico corriendo={prueba.corriendo} texto={prueba.texto} oncerrar={() => (prueba = null)} />
{/if}

<style>
  .ventana {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
  }

  .centro {
    display: flex;
    min-height: 0;
  }
</style>
