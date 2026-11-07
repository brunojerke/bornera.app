<script lang="ts">
  // Paleta de componentes (izquierda), plegable. Todavía sin arrastrar ni buscar.
  import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
  import Search from "@lucide/svelte/icons/search";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  let { abierta = $bindable(true) }: { abierta?: boolean } = $props();

  // Provisorio: cuando exista la biblioteca de símbolos (src/core/symbols),
  // esta lista va a salir de ahí.
  const categorias: { nombre: string; items: string[] }[] = [
    { nombre: "Fuentes", items: ["Fuente monofásica", "Fuente trifásica", "Fuente CC 24 V"] },
    {
      nombre: "Mando",
      items: [
        "Pulsador NA",
        "Pulsador NC",
        "Interruptor / selector",
        "Bobina de contactor",
        "Contacto auxiliar NA",
        "Contacto auxiliar NC",
      ],
    },
    {
      nombre: "Potencia",
      items: ["Contactos principales", "Relé térmico", "Fusible", "Motor trifásico", "Motor monofásico"],
    },
    { nombre: "Señalización", items: ["Lámpara"] },
  ];
</script>

<aside class="panel" class:plegado={!abierta} aria-label="Paleta de componentes">
  {#if abierta}
    <div class="cabecera">
      <span>Componentes</span>
      <button
        class="boton-icono"
        title="Plegar paleta"
        aria-label="Plegar paleta"
        aria-expanded="true"
        onclick={() => (abierta = false)}
      >
        <PanelLeftClose size={16} />
      </button>
    </div>

    <label class="buscador">
      <Search size={14} />
      <input type="search" placeholder="Buscar…" aria-label="Buscar componente" />
    </label>

    <div class="lista">
      {#each categorias as categoria (categoria.nombre)}
        <details open>
          <summary><ChevronRight size={14} class="flecha" />{categoria.nombre}</summary>
          <ul>
            {#each categoria.items as item (item)}
              <li><button class="item">{item}</button></li>
            {/each}
          </ul>
        </details>
      {/each}
    </div>
  {:else}
    <button
      class="boton-icono"
      title="Mostrar paleta"
      aria-label="Mostrar paleta"
      aria-expanded="false"
      onclick={() => (abierta = true)}
    >
      <PanelLeftOpen size={16} />
    </button>
  {/if}
</aside>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    width: var(--ancho-paleta);
    flex-shrink: 0;
    min-height: 0;
    background: var(--superficie);
    border-right: 1px solid var(--borde);
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

  .buscador {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 8px 6px;
    padding: 0 8px;
    height: 28px;
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    background: var(--superficie-2);
    color: var(--texto-suave);
  }

  .buscador:focus-within {
    border-color: var(--foco);
  }

  .buscador input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
  }

  .lista {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 4px 8px;
  }

  summary {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 6px;
    font-weight: 600;
    cursor: pointer;
    list-style: none;
    border-radius: var(--radio);
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary:hover {
    background: var(--hover);
  }

  /* El ícono es un componente hijo: :global para alcanzar su <svg>. */
  summary :global(.flecha) {
    color: var(--texto-suave);
    transition: transform 0.12s;
  }

  details[open] > summary :global(.flecha) {
    transform: rotate(90deg);
  }

  ul {
    margin: 0;
    padding: 0 0 4px;
    list-style: none;
  }

  .item {
    display: block;
    width: 100%;
    padding: 4px 8px 4px 24px;
    border: 0;
    border-radius: var(--radio);
    background: transparent;
    text-align: left;
    cursor: grab;
  }

  .item:hover {
    background: var(--hover);
  }
</style>
