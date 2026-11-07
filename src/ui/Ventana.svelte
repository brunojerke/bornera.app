<script lang="ts">
  // Esqueleto de la ventana: barra superior, paleta, lienzo, propiedades y estado.
  import "./tema.css";
  import BarraSuperior from "./BarraSuperior.svelte";
  import Paleta from "./Paleta.svelte";
  import Lienzo from "./Lienzo.svelte";
  import PanelPropiedades from "./PanelPropiedades.svelte";
  import BarraEstado from "./BarraEstado.svelte";
  import type { Modo } from "./tipos";

  let modo = $state<Modo>("editar");
  let paletaAbierta = $state(true);
  let propiedadesAbierto = $state(false);
</script>

<div class="ventana">
  <BarraSuperior bind:modo />
  <main class="centro">
    <Paleta bind:abierta={paletaAbierta} />
    <Lienzo />
    <PanelPropiedades bind:abierto={propiedadesAbierto} />
  </main>
  <BarraEstado {modo} />
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
