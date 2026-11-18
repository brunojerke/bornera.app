<script lang="ts">
  // Aviso antes de «Probar la fase 3b» con cambios sin guardar (cierre 3b,
  // etapa 4, D3-A). La prueba no toca la hoja: arma sus escenas en un editor
  // aparte. Pero tarda y usa memoria, y en la netbook (4 GB) un cierre de la
  // app se llevaría los cambios. Probar igual / Cancelar; el foco arranca en
  // Cancelar y Esc es Cancelar. Es modal (aria-modal), así `hayModal()` frena
  // los atajos del editor mientras está abierto.
  // También antes de «Probar la fase 4» (C1), con su título.
  let {
    titulo = "Probar la fase 3b",
    nombre,
    onresponder,
  }: {
    /** El nombre de la prueba. */
    titulo?: string;
    /** Nombre del documento (el del título de la ventana). */
    nombre: string;
    /** true: probar igual; false: cancelar. */
    onresponder: (probar: boolean) => void;
  } = $props();

  let cancelar = $state<HTMLButtonElement>();

  $effect(() => {
    cancelar?.focus();
  });

  function alTecla(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onresponder(false);
    }
  }
</script>

<svelte:window onkeydown={alTecla} />

<div class="fondo">
  <div
    class="dialogo"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialogo-probar-titulo"
    aria-describedby="dialogo-probar-texto"
  >
    <h2 id="dialogo-probar-titulo">{titulo}</h2>
    <p id="dialogo-probar-texto">
      «{nombre}» tiene cambios sin guardar. La prueba no toca tu hoja: arma sus propias escenas aparte. Pero tarda un
      rato y usa memoria; si la app se cerrara, perderías los cambios. Conviene guardar antes.
    </p>
    <div class="acciones">
      <button onclick={() => onresponder(true)}>Probar igual</button>
      <button bind:this={cancelar} class="principal" onclick={() => onresponder(false)}>Cancelar</button>
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
