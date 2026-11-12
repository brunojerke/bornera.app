<script lang="ts">
  // Diálogo de cambios sin guardar (T15a, D13-A): antes de Abrir o Nuevo con
  // cambios. Guardar / No guardar / Cancelar; el foco arranca en Guardar y Esc
  // es Cancelar. Es modal (aria-modal), así `hayModal()` frena los atajos del
  // editor y los de archivo mientras está abierto.
  import type { RespuestaSinGuardar } from "./archivo";

  let {
    nombre,
    onresponder,
  }: {
    /** Nombre del documento (el del título de la ventana). */
    nombre: string;
    onresponder: (respuesta: RespuestaSinGuardar) => void;
  } = $props();

  let guardar = $state<HTMLButtonElement>();

  $effect(() => {
    guardar?.focus();
  });

  function alTecla(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onresponder("cancelar");
    }
  }
</script>

<svelte:window onkeydown={alTecla} />

<div class="fondo">
  <div
    class="dialogo"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialogo-sin-guardar-titulo"
    aria-describedby="dialogo-sin-guardar-texto"
  >
    <h2 id="dialogo-sin-guardar-titulo">¿Guardar los cambios?</h2>
    <p id="dialogo-sin-guardar-texto">«{nombre}» tiene cambios sin guardar.</p>
    <div class="acciones">
      <button bind:this={guardar} class="principal" onclick={() => onresponder("guardar")}>Guardar</button>
      <button onclick={() => onresponder("noGuardar")}>No guardar</button>
      <button onclick={() => onresponder("cancelar")}>Cancelar</button>
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
    width: min(420px, calc(100vw - 32px));
    padding: 12px;
    background: var(--superficie);
    border: 1px solid var(--borde);
    border-radius: var(--radio);
  }

  h2 {
    margin: 0;
    font-size: 14px;
  }

  p {
    margin: 0;
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .acciones {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 4px;
  }

  .acciones button {
    height: 28px;
    padding: 0 12px;
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    background: transparent;
    cursor: pointer;
  }

  .acciones button.principal {
    background: var(--acento);
    border-color: var(--acento);
    color: var(--acento-texto);
  }
</style>
