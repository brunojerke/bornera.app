<script lang="ts">
  // Barra de herramientas superior. Todavía sin acciones: solo la estructura.
  import FilePlus from "@lucide/svelte/icons/file-plus";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Save from "@lucide/svelte/icons/save";
  import FileDown from "@lucide/svelte/icons/file-down";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import Redo2 from "@lucide/svelte/icons/redo-2";
  import ZoomOut from "@lucide/svelte/icons/zoom-out";
  import ZoomIn from "@lucide/svelte/icons/zoom-in";
  import Scan from "@lucide/svelte/icons/scan";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Play from "@lucide/svelte/icons/play";
  import MenuDesarrollo from "./MenuDesarrollo.svelte";
  import type { OpcionesCapas } from "../render/capas";
  import type { EscenaDesarrollo, Modo } from "./tipos";

  let {
    modo = $bindable("editar"),
    zoom = 1,
    onacercar,
    onalejar,
    onencuadrar,
    escena = $bindable("documento"),
    rendimiento = $bindable(false),
    opciones = $bindable(),
  }: {
    modo?: Modo;
    /** Zoom actual (1 = 100 %). */
    zoom?: number;
    onacercar?: () => void;
    onalejar?: () => void;
    onencuadrar?: () => void;
    /** Menú de desarrollo (solo en `npm run dev` / `tauri dev`). */
    escena?: EscenaDesarrollo;
    rendimiento?: boolean;
    opciones: OpcionesCapas;
  } = $props();

  const TAM = 18;
</script>

<header class="barra">
  <span class="marca">Bornera</span>

  <div class="grupo" role="group" aria-label="Archivo">
    <button class="boton-icono" title="Nuevo (Ctrl+N)" aria-label="Nuevo"><FilePlus size={TAM} /></button>
    <button class="boton-icono" title="Abrir (Ctrl+O)" aria-label="Abrir"><FolderOpen size={TAM} /></button>
    <button class="boton-icono" title="Guardar (Ctrl+S)" aria-label="Guardar"><Save size={TAM} /></button>
    <button class="boton-icono" title="Exportar PDF (Ctrl+P)" aria-label="Exportar PDF"><FileDown size={TAM} /></button>
  </div>

  <div class="grupo" role="group" aria-label="Historial">
    <button class="boton-icono" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" disabled><Undo2 size={TAM} /></button>
    <button class="boton-icono" title="Rehacer (Ctrl+Y)" aria-label="Rehacer" disabled><Redo2 size={TAM} /></button>
  </div>

  <div class="grupo" role="group" aria-label="Zoom">
    <button class="boton-icono" title="Alejar" aria-label="Alejar" onclick={onalejar}><ZoomOut size={TAM} /></button>
    <span class="zoom" aria-label="Zoom actual">{Math.round(zoom * 100)} %</span>
    <button class="boton-icono" title="Acercar" aria-label="Acercar" onclick={onacercar}><ZoomIn size={TAM} /></button>
    <button class="boton-icono" title="Encuadrar todo (F)" aria-label="Encuadrar todo" onclick={onencuadrar}>
      <Scan size={TAM} />
    </button>
  </div>

  <div class="espacio"></div>

  {#if import.meta.env.DEV}
    <div class="grupo-final">
      <MenuDesarrollo bind:escena bind:rendimiento bind:opciones />
    </div>
  {/if}

  <div class="modo" role="group" aria-label="Modo (F5)" title="Alternar modo (F5)">
    <button class:activo={modo === "editar"} aria-pressed={modo === "editar"} onclick={() => (modo = "editar")}>
      <Pencil size={16} /> Editar
    </button>
    <button
      class="simular"
      class:activo={modo === "simular"}
      aria-pressed={modo === "simular"}
      onclick={() => (modo = "simular")}
    >
      <Play size={16} /> Simular
    </button>
  </div>
</header>

<style>
  .barra {
    display: flex;
    align-items: center;
    gap: 4px;
    height: var(--alto-barra);
    padding: 0 6px 0 12px;
    background: var(--superficie);
    border-bottom: 1px solid var(--borde);
  }

  .marca {
    font-weight: 700;
    letter-spacing: 0.02em;
    margin-right: 8px;
  }

  .grupo {
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 0 6px;
    border-left: 1px solid var(--borde);
  }

  .zoom {
    min-width: 44px;
    text-align: center;
    font-family: var(--fuente-mono);
    font-size: 12px;
    color: var(--texto-suave);
  }

  .espacio {
    flex: 1;
  }

  .grupo-final {
    margin-right: 6px;
  }

  .modo {
    display: flex;
    padding: 2px;
    gap: 2px;
    border-radius: calc(var(--radio) + 2px);
    background: var(--superficie-2);
    border: 1px solid var(--borde);
  }

  .modo button {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--radio);
    background: transparent;
    font-weight: 600;
    cursor: pointer;
    color: var(--texto-suave);
  }

  .modo button:hover {
    color: var(--texto);
  }

  .modo button.activo {
    background: var(--acento);
    color: var(--acento-texto);
  }

  .modo button.simular.activo {
    background: var(--simular);
  }
</style>
