<script lang="ts">
  // Paleta de componentes (izquierda), plegable. Sale de la biblioteca de
  // símbolos, agrupada por categoría. Apretar un ítem empieza a colocarlo:
  // arrastrando hasta el lienzo, o clic y después clic en el lienzo.
  // Arriba, el botón de la herramienta cable (W), resaltado mientras está activa.
  import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
  import Search from "@lucide/svelte/icons/search";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Cable from "@lucide/svelte/icons/cable";
  import { SIMBOLOS, type DefinicionSimbolo } from "../core/symbols";
  import { agruparSimbolos } from "./paleta";

  let {
    abierta = $bindable(true),
    activo = null,
    desactivada = false,
    cableActivo = false,
    cableDesactivado = false,
    onelegir,
    oncable,
  }: {
    abierta?: boolean;
    /** Tipo del símbolo que se está colocando (se resalta). */
    activo?: string | null;
    /** No se puede colocar (el lienzo muestra una escena de prueba). */
    desactivada?: boolean;
    /** Se apretó un ítem: empieza a colocarse. */
    onelegir?: (def: DefinicionSimbolo, e: PointerEvent) => void;
    /** La herramienta cable está activa (se resalta su botón). */
    cableActivo?: boolean;
    /** No se puede cablear (escena sin editor, o modo Simular). */
    cableDesactivado?: boolean;
    /** Se apretó el botón de la herramienta cable: lo mismo que W. */
    oncable?: () => void;
  } = $props();

  let filtro = $state("");
  const grupos = $derived(agruparSimbolos(SIMBOLOS, filtro));
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

    <button
      class="herramienta"
      class:activo={cableActivo}
      aria-pressed={cableActivo}
      disabled={cableDesactivado}
      title="Dibujar cables: clic en un borne, clic en cada codo y clic en el otro borne"
      onclick={() => oncable?.()}
    >
      <Cable size={14} />Cable (W)
    </button>

    <label class="buscador">
      <Search size={14} />
      <input type="search" placeholder="Buscar…" aria-label="Buscar componente" bind:value={filtro} />
    </label>

    <div class="lista">
      {#each grupos as grupo (grupo.id)}
        <details open>
          <summary><ChevronRight size={14} class="flecha" />{grupo.nombre}</summary>
          <ul>
            {#each grupo.simbolos as def (def.tipo)}
              <li>
                <button
                  class="item"
                  class:activo={activo === def.tipo}
                  aria-pressed={activo === def.tipo}
                  disabled={desactivada}
                  title={desactivada ? "Volvé al documento para colocar" : "Arrastrar al lienzo, o clic y clic en el lienzo"}
                  onpointerdown={(e) => onelegir?.(def, e)}
                >
                  {def.nombre}
                </button>
              </li>
            {/each}
          </ul>
        </details>
      {:else}
        <p class="vacio">Ningún componente coincide.</p>
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

  .herramienta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 8px 6px;
    padding: 4px 8px;
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .herramienta:hover:not(:disabled) {
    background: var(--hover);
  }

  .herramienta.activo {
    background: var(--acento);
    border-color: var(--acento);
    color: var(--acento-texto);
  }

  .herramienta:disabled {
    color: var(--texto-suave);
    cursor: default;
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

  .item:hover:not(:disabled) {
    background: var(--hover);
  }

  .item.activo {
    background: var(--acento);
    color: var(--acento-texto);
  }

  .item:disabled {
    color: var(--texto-suave);
    cursor: default;
  }

  .vacio {
    margin: 8px;
    color: var(--texto-suave);
  }
</style>
