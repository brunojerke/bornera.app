<script lang="ts">
  // Diálogo de archivo (T15a): un título ("No se puede guardar", "No se pudo
  // abrir"…) y la lista de problemas, hasta 10 líneas y "y N más". Es modal
  // (aria-modal), así `hayModal()` frena los atajos del editor y los de
  // archivo mientras está abierto. Enter o Esc lo cierran.
  import type { ProblemaArchivo } from "../core/io";
  import { lineasProblemas } from "./archivo";

  let {
    titulo,
    problemas,
    oncerrar,
  }: {
    titulo: string;
    problemas: readonly ProblemaArchivo[];
    oncerrar: () => void;
  } = $props();

  const lineas = $derived(lineasProblemas(problemas));
  let boton = $state<HTMLButtonElement>();

  $effect(() => {
    boton?.focus();
  });

  function alTecla(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      oncerrar();
    }
  }
</script>

<svelte:window onkeydown={alTecla} />

<div class="fondo">
  <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="dialogo-archivo-titulo">
    <h2 id="dialogo-archivo-titulo">{titulo}</h2>
    <ul class="problemas">
      {#each lineas as linea, i (i)}
        <li>{linea}</li>
      {/each}
    </ul>
    <div class="acciones">
      <button bind:this={boton} onclick={oncerrar}>Cerrar</button>
    </div>
  </div>
</div>

<style>
  .fondo {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.4);
  }

  .dialogo {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(600px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    padding: 12px;
    background: var(--superficie);
    border: 1px solid var(--borde);
    border-radius: var(--radio);
  }

  h2 {
    margin: 0;
    font-size: 14px;
  }

  .problemas {
    flex: 1;
    min-height: 0;
    overflow: auto;
    margin: 0;
    padding: 6px 8px 6px 24px;
    font-size: 12px;
    line-height: 1.5;
    overflow-wrap: anywhere;
    background: var(--lienzo);
    border: 1px solid var(--borde);
    border-radius: var(--radio);
  }

  .acciones {
    display: flex;
    justify-content: flex-end;
  }

  .acciones button {
    height: 28px;
    padding: 0 12px;
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    background: transparent;
    cursor: pointer;
  }
</style>
