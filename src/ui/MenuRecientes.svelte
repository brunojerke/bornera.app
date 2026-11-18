<script lang="ts">
  // Abrir reciente (T24, D8-A): la flecha junto a Abrir despliega las últimas
  // rutas abiertas o guardadas, la más nueva primero. Solo en el escritorio
  // (en el navegador no hay rutas, y la barra no lo muestra). Sin atajo.
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { nombreDeRuta } from "./archivos";

  let {
    rutas = [],
    desactivado = false,
    onabrir,
    onmostrar,
  }: {
    /** Las rutas, la más nueva primero. */
    rutas?: readonly string[];
    /** D17: no en Simular ni en una escena del banco, como Abrir. */
    desactivado?: boolean;
    onabrir?: (ruta: string) => void;
    /** Al desplegar: que se relea la lista (otra ventana pudo sumar una ruta). */
    onmostrar?: () => void;
  } = $props();

  let abierto = $state(false);
  let raiz: HTMLDivElement;

  // Si se desactiva con el menú abierto (F5 a Simular), se cierra.
  $effect(() => {
    if (desactivado) abierto = false;
  });

  /** La carpeta de la ruta, para distinguir dos archivos con el mismo nombre. */
  function carpeta(ruta: string): string {
    const nombre = nombreDeRuta(ruta);
    return ruta.slice(0, Math.max(0, ruta.length - nombre.length - 1));
  }

  function alternar() {
    if (!abierto) onmostrar?.();
    abierto = !abierto;
  }

  function elegir(ruta: string) {
    abierto = false;
    onabrir?.(ruta);
  }

  /** Cierra al hacer clic afuera o con Escape. */
  function alClicVentana(e: PointerEvent) {
    if (abierto && !raiz.contains(e.target as Node)) abierto = false;
  }

  function alTecla(e: KeyboardEvent) {
    if (abierto && e.key === "Escape") abierto = false;
  }
</script>

<svelte:window onpointerdown={alClicVentana} onkeydown={alTecla} />

<div class="menu" bind:this={raiz}>
  <button
    class="boton-icono flecha"
    class:activo={abierto}
    title={rutas.length === 0 ? "Abrir reciente (no hay archivos recientes)" : "Abrir reciente"}
    aria-label="Abrir reciente"
    aria-haspopup="menu"
    aria-expanded={abierto}
    disabled={desactivado || rutas.length === 0}
    onclick={alternar}
  >
    <ChevronDown size={14} />
  </button>

  {#if abierto && rutas.length > 0}
    <div class="lista" role="menu" aria-label="Abrir reciente">
      <div class="titulo">Abrir reciente</div>
      {#each rutas as ruta (ruta)}
        <button role="menuitem" title={ruta} onclick={() => elegir(ruta)}>
          <span class="nombre">{nombreDeRuta(ruta)}</span>
          <span class="carpeta">{carpeta(ruta)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .menu {
    position: relative;
  }

  .flecha {
    width: 16px;
    margin-left: -1px;
  }

  .activo {
    background: var(--hover);
  }

  .lista {
    position: absolute;
    top: calc(100% + 4px);
    left: -34px;
    z-index: 10;
    width: 340px;
    max-width: calc(100vw - 16px);
    padding: 4px;
    background: var(--superficie);
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.18);
  }

  .titulo {
    padding: 6px 8px 2px;
    font-size: 11px;
    font-weight: 600;
    color: var(--texto-suave);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .lista button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    width: 100%;
    min-height: 36px;
    padding: 2px 8px;
    border: 0;
    border-radius: calc(var(--radio) - 2px);
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .lista button:hover {
    background: var(--hover);
  }

  .nombre,
  .carpeta {
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .carpeta {
    font-size: 11px;
    color: var(--texto-suave);
  }
</style>
