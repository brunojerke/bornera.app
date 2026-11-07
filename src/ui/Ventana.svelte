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

  let modo = $state<Modo>("editar");
  let paletaAbierta = $state(true);
  let propiedadesAbierto = $state(false);
  let zoom = $state(1);
  let cursor = $state<Punto | null>(null);
  let lienzo: ReturnType<typeof Lienzo>;

  // Desarrollo: escena de prueba, contador de rendimiento y optimizaciones.
  let escena = $state<EscenaDesarrollo>("simbolos");
  let rendimiento = $state(false);
  let opciones = $state<OpcionesCapas>({ ...OPCIONES_OPTIMIZADAS });

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
  />
  <main class="centro">
    <Paleta bind:abierta={paletaAbierta} />
    <Lienzo bind:this={lienzo} bind:zoom bind:cursor {escena} {rendimiento} {opciones} />
    <PanelPropiedades bind:abierto={propiedadesAbierto} />
  </main>
  <BarraEstado {modo} {zoom} {cursor} />
</div>

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
