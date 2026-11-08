<script lang="ts">
  // Panel de propiedades (derecha), plegable. Se abre solo al seleccionar,
  // salvo que el usuario lo haya plegado (lo decide Ventana). Por ahora los
  // datos son solo para leer: editarlos es T11.
  import PanelRightClose from "@lucide/svelte/icons/panel-right-close";
  import PanelRightOpen from "@lucide/svelte/icons/panel-right-open";
  import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
  import { SIN_SELECCION, type ResumenSeleccion } from "../editor/editor";
  import { textoCantidad } from "./propiedades";

  let {
    abierto = $bindable(false),
    seleccion = SIN_SELECCION,
    onalternar,
  }: {
    abierto?: boolean;
    seleccion?: ResumenSeleccion;
    /** El usuario lo abrió o lo plegó con el botón. */
    onalternar?: (abierto: boolean) => void;
  } = $props();

  function alternar(valor: boolean) {
    abierto = valor;
    onalternar?.(valor);
  }
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
        onclick={() => alternar(false)}
      >
        <PanelRightClose size={16} />
      </button>
    </div>

    {#if seleccion.unico}
      {@const c = seleccion.unico}
      <div class="datos">
        <p class="nombre">{c.nombre}</p>
        <dl>
          <dt>Etiqueta</dt>
          <dd>{c.etiqueta || "—"}</dd>
          <dt>Rotación</dt>
          <dd>{c.rot}°</dd>
          <dt>Espejado</dt>
          <dd>{c.espejado ? "Sí" : "No"}</dd>
        </dl>
      </div>
    {:else if seleccion.cantidad > 1}
      <div class="vacio">
        <MousePointer2 size={22} />
        <p>{textoCantidad(seleccion.cantidad)}</p>
      </div>
    {:else}
      <div class="vacio">
        <MousePointer2 size={22} />
        <p>Nada seleccionado</p>
        <p class="pista">Seleccioná un componente para ver su etiqueta, tensión y rotación.</p>
      </div>
    {/if}
  {:else}
    <button
      class="boton-icono"
      title="Mostrar propiedades"
      aria-label="Mostrar propiedades"
      aria-expanded="false"
      onclick={() => alternar(true)}
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

  .datos {
    padding: 4px 10px 12px;
  }

  .nombre {
    margin: 0 0 8px;
    font-weight: 600;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0;
  }

  dt {
    color: var(--texto-suave);
  }

  dd {
    margin: 0;
    font-family: var(--fuente-mono);
  }
</style>
