<script lang="ts">
  // Panel de propiedades (derecha), plegable. Más adelante se abre solo
  // al seleccionar un elemento; por ahora arranca plegado.
  import PanelRightClose from "@lucide/svelte/icons/panel-right-close";
  import PanelRightOpen from "@lucide/svelte/icons/panel-right-open";
  import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";

  let { abierto = $bindable(false) }: { abierto?: boolean } = $props();
</script>

<aside class="panel" class:plegado={!abierto} aria-label="Propiedades">
  {#if abierto}
    <div class="cabecera">
      <span>Propiedades</span>
      <button
        class="boton-icono"
        title="Plegar propiedades"
        aria-label="Plegar propiedades"
        aria-expanded="true"
        onclick={() => (abierto = false)}
      >
        <PanelRightClose size={16} />
      </button>
    </div>

    <div class="vacio">
      <MousePointer2 size={22} />
      <p>Nada seleccionado</p>
      <p class="pista">Seleccioná un componente para ver su etiqueta, tensión y rotación.</p>
    </div>
  {:else}
    <button
      class="boton-icono"
      title="Mostrar propiedades"
      aria-label="Mostrar propiedades"
      aria-expanded="false"
      onclick={() => (abierto = true)}
    >
      <PanelRightOpen size={16} />
    </button>
  {/if}
</aside>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    width: var(--ancho-propiedades);
    flex-shrink: 0;
    min-height: 0;
    background: var(--superficie);
    border-left: 1px solid var(--borde);
  }

  .panel.plegado {
    width: var(--ancho-plegado);
    align-items: center;
    padding-top: 4px;
  }

  .cabecera {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 34px;
    padding: 0 2px 0 10px;
    font-weight: 600;
    color: var(--texto-suave);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
  }

  .vacio {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 24px 16px;
    text-align: center;
    color: var(--texto-suave);
  }

  .vacio p {
    margin: 6px 0 0;
  }

  .pista {
    font-size: 12px;
  }
</style>
