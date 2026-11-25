<script lang="ts">
  // Paleta de componentes (izquierda), plegable. Sale de la biblioteca de
  // símbolos, por grupo (Mando, Potencia) y subgrupo, los dos plegables
  // (T38, D26-A y D28-A). Cada ítem es una miniatura (D10-A) con el nombre en
  // el tooltip y en aria-label (y como texto oculto, el que buscan los humos).
  // Apretar un ítem empieza a colocarlo: arrastrando hasta el lienzo, o clic
  // y después clic en el lienzo. La búsqueda oculta lo que no coincide (no
  // desmonta: las miniaturas no se redibujan) y despliega lo que encuentra.
  // Arriba, el botón de la herramienta cable (W), resaltado mientras está activa.
  import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
  import Search from "@lucide/svelte/icons/search";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Cable from "@lucide/svelte/icons/cable";
  import { SIMBOLOS, type DefinicionSimbolo } from "../core/symbols";
  import { Plegado, agruparSimbolos } from "./paleta";
  import { miniatura } from "./miniaturas";

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

  /** La estructura completa, fija: la búsqueda solo oculta. */
  const grupos = agruparSimbolos(SIMBOLOS);
  let filtro = $state("");
  /** Tipos, subgrupos y grupos que coinciden con la búsqueda. */
  const visibles = $derived.by(() => {
    const ids = new Set<string>();
    for (const g of agruparSimbolos(SIMBOLOS, filtro)) {
      ids.add(g.id);
      for (const s of g.subgrupos) {
        ids.add(s.id);
        for (const d of s.simbolos) ids.add(d.tipo);
      }
    }
    return ids;
  });

  const plegado = new Plegado();
  /** Sube con cada cambio del plegado: `abierto` lo lee para volver a evaluarse. */
  let version = $state(0);
  function abierto(id: string): boolean {
    void version;
    return plegado.abierto(id);
  }
  function alternar(e: MouseEvent, id: string): void {
    // El <details> lo maneja el estado, no el navegador.
    e.preventDefault();
    plegado.alternar(id);
    version++;
  }
  function buscar(e: Event & { currentTarget: HTMLInputElement }): void {
    plegado.filtrar(e.currentTarget.value);
    version++;
  }
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
      <input type="search" placeholder="Buscar…" aria-label="Buscar componente" bind:value={filtro} oninput={buscar} />
    </label>

    <div class="lista">
      {#each grupos as grupo (grupo.id)}
        <details class="grupo" open={abierto(grupo.id)} hidden={!visibles.has(grupo.id)}>
          <summary onclick={(e) => alternar(e, grupo.id)}><ChevronRight size={14} class="flecha" />{grupo.nombre}</summary>
          {#each grupo.subgrupos as sub (sub.id)}
            <details class="subgrupo" open={abierto(sub.id)} hidden={!visibles.has(sub.id)}>
              <summary onclick={(e) => alternar(e, sub.id)}><ChevronRight size={12} class="flecha" />{sub.nombre}</summary>
              <ul>
                {#each sub.simbolos as def (def.tipo)}
                  <li hidden={!visibles.has(def.tipo)}>
                    <button
                      class="item"
                      class:activo={activo === def.tipo}
                      aria-pressed={activo === def.tipo}
                      aria-label={def.nombre}
                      disabled={desactivada}
                      title={desactivada ? `${def.nombre} (volvé al documento para colocar)` : def.nombre}
                      onpointerdown={(e) => onelegir?.(def, e)}
                    >
                      <canvas use:miniatura={def} aria-hidden="true"></canvas>
                      <span class="oculto">{def.nombre}</span>
                    </button>
                  </li>
                {/each}
              </ul>
            </details>
          {/each}
        </details>
      {/each}
      {#if visibles.size === 0}
        <p class="vacio">Ningún componente coincide.</p>
      {/if}
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
    padding: 5px 6px;
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

  .subgrupo > summary {
    padding: 2px 6px 2px 14px;
    font-weight: 500;
    font-size: 12px;
    color: var(--texto-suave);
  }

  /*
   * Grilla de casillas de 40 px con 4 de espacio (T38, ajuste 1): 4 × 40 +
   * 3 × 4 = 172 px, y quedan 174 con la barra de scroll de WebView2 (17 px)
   * a la vista: 200 − 1 de borde − 8 de padding − 17. Sin sangría a la
   * izquierda, para que entren las 4. Sin scroll horizontal.
   */
  ul {
    display: grid;
    grid-template-columns: repeat(4, 40px);
    gap: 4px;
    margin: 0;
    padding: 2px 0 6px;
    list-style: none;
  }

  li[hidden] {
    display: none;
  }

  .item {
    display: block;
    position: relative;
    width: 40px;
    height: 40px;
    padding: 1px;
    border: 1px solid transparent;
    border-radius: var(--radio);
    background: transparent;
    cursor: grab;
  }

  .item canvas {
    display: block;
    width: 36px;
    height: 36px;
  }

  /* El nombre, solo para lectores de pantalla y para buscar el ítem por su texto. */
  .oculto {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .item:hover:not(:disabled) {
    background: var(--hover);
  }

  /* Con el trazo del tema sobre el fondo: se resalta el borde, no se rellena. */
  .item.activo {
    border-color: var(--acento);
    background: var(--hover);
  }

  .item:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .vacio {
    margin: 8px;
    color: var(--texto-suave);
  }
</style>
