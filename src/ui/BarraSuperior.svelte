<script lang="ts">
  // Barra de herramientas superior. Andan Nuevo, Abrir, Guardar y Guardar
  // como (T15a), Exportar sin comprimir (T21), Abrir reciente (T24, solo en el escritorio), el historial (deshacer y rehacer, desactivados si no hay
  // nada) y el zoom; el resto es estructura.
  import FilePlus from "@lucide/svelte/icons/file-plus";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Save from "@lucide/svelte/icons/save";
  import SaveAll from "@lucide/svelte/icons/save-all";
  import FileBraces from "@lucide/svelte/icons/file-braces";
  import FileDown from "@lucide/svelte/icons/file-down";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import Redo2 from "@lucide/svelte/icons/redo-2";
  import ZoomOut from "@lucide/svelte/icons/zoom-out";
  import ZoomIn from "@lucide/svelte/icons/zoom-in";
  import Scan from "@lucide/svelte/icons/scan";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Play from "@lucide/svelte/icons/play";
  import MenuDesarrollo from "./MenuDesarrollo.svelte";
  import MenuRecientes from "./MenuRecientes.svelte";
  import type { OpcionesCapas } from "../render/capas";
  import type { DiagnosticoArrastre } from "../editor/editor";
  import type { EscenaDesarrollo, Modo } from "./tipos";
  import { mostrarMenuDesarrollo, VERSION } from "./version";

  let {
    modo = "editar",
    oncambiarmodo,
    zoom = 1,
    puedeGuardar = false,
    puedeExportar = false,
    puedeAbrir = false,
    onnuevo,
    onabrir,
    recientes = null,
    onabrirreciente,
    onmostrarrecientes,
    onguardar,
    onguardarcomo,
    onexportar,
    onacercar,
    onalejar,
    onencuadrar,
    puedeDeshacer = false,
    puedeRehacer = false,
    ondeshacer,
    onrehacer,
    escena = $bindable("documento"),
    rendimiento = $bindable(false),
    opciones = $bindable(),
    diagnostico = $bindable(),
    onprobararrastre,
    onprobarfase3b,
    onprobarfase4,
    onprobarfase5,
    onmedircopia,
    oncopias,
  }: {
    modo?: Modo;
    /** Se pidió otro modo (los botones; Ventana decide si entra a Simular, T32). */
    oncambiarmodo?: (m: Modo) => void;
    /** Zoom actual (1 = 100 %). */
    zoom?: number;
    /** Guardar y Guardar como andan: lo que se ve tiene editor y no se simula (T32, ajuste 3). */
    puedeGuardar?: boolean;
    /** Exportar anda: lo que se ve tiene editor (también en Simular). */
    puedeExportar?: boolean;
    /** Nuevo y Abrir andan (D17: no en Simular ni en una escena del banco). */
    puedeAbrir?: boolean;
    onnuevo?: () => void;
    onabrir?: () => void;
    /** Abrir reciente (T24): las rutas, la más nueva primero; null en el navegador (no se muestra). */
    recientes?: readonly string[] | null;
    onabrirreciente?: (ruta: string) => void;
    /** Al desplegar Abrir reciente: que se relea la lista. */
    onmostrarrecientes?: () => void;
    onguardar?: () => void;
    onguardarcomo?: () => void;
    /** Exportar sin comprimir (.brn.json), T21: una copia; no cambia el archivo actual. */
    onexportar?: () => void;
    onacercar?: () => void;
    onalejar?: () => void;
    onencuadrar?: () => void;
    /** Hay algo para deshacer o rehacer: si no, el botón queda desactivado. */
    puedeDeshacer?: boolean;
    puedeRehacer?: boolean;
    ondeshacer?: () => void;
    onrehacer?: () => void;
    /** Menú de desarrollo (en `npm run dev` / `tauri dev` y en las prereleases). */
    escena?: EscenaDesarrollo;
    rendimiento?: boolean;
    opciones: OpcionesCapas;
    diagnostico: DiagnosticoArrastre;
    onprobararrastre?: () => void;
    /** «Probar la fase 3b» (cierre 3b, etapa 4). */
    onprobarfase3b?: () => void;
    /** «Probar la fase 4» (C1). */
    onprobarfase4?: () => void;
    /** «Probar la fase 5» (T31). */
    onprobarfase5?: () => void;
    /** «Medir la copia (F1)» (T23). */
    onmedircopia?: () => void;
    /** «Copias de recuperación» (T23). */
    oncopias?: () => void;
  } = $props();

  const TAM = 18;
</script>

<header class="barra">
  <span class="marca">Bornera</span>

  <div class="grupo" role="group" aria-label="Archivo">
    <button class="boton-icono" title="Nuevo (Ctrl+N)" aria-label="Nuevo" disabled={!puedeAbrir} onclick={onnuevo}>
      <FilePlus size={TAM} />
    </button>
    <button class="boton-icono" title="Abrir (Ctrl+O)" aria-label="Abrir" disabled={!puedeAbrir} onclick={onabrir}>
      <FolderOpen size={TAM} />
    </button>
    {#if recientes}
      <MenuRecientes rutas={recientes} desactivado={!puedeAbrir} onabrir={onabrirreciente} onmostrar={onmostrarrecientes} />
    {/if}
    <button class="boton-icono" title="Guardar (Ctrl+S)" aria-label="Guardar" disabled={!puedeGuardar} onclick={onguardar}>
      <Save size={TAM} />
    </button>
    <button
      class="boton-icono"
      title="Guardar como (Ctrl+Mayús+S)"
      aria-label="Guardar como"
      disabled={!puedeGuardar}
      onclick={onguardarcomo}
    >
      <SaveAll size={TAM} />
    </button>
    <button
      class="boton-icono"
      title="Exportar sin comprimir (.brn.json)…"
      aria-label="Exportar sin comprimir (.brn.json)"
      disabled={!puedeExportar}
      onclick={onexportar}
    >
      <FileBraces size={TAM} />
    </button>
    <button class="boton-icono" title="Exportar PDF (Ctrl+P)" aria-label="Exportar PDF"><FileDown size={TAM} /></button>
  </div>

  <div class="grupo" role="group" aria-label="Historial">
    <button class="boton-icono" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" disabled={!puedeDeshacer} onclick={ondeshacer}>
      <Undo2 size={TAM} />
    </button>
    <button class="boton-icono" title="Rehacer (Ctrl+Y)" aria-label="Rehacer" disabled={!puedeRehacer} onclick={onrehacer}>
      <Redo2 size={TAM} />
    </button>
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

  {#if mostrarMenuDesarrollo(VERSION, import.meta.env.DEV)}
    <div class="grupo-final">
      <MenuDesarrollo simulando={modo === "simular"} bind:escena bind:rendimiento bind:opciones bind:diagnostico {onprobararrastre} {onprobarfase3b} {onprobarfase4} {onprobarfase5} {onmedircopia} {oncopias} />
    </div>
  {/if}

  <div class="modo" role="group" aria-label="Modo (F5)" title="Alternar modo (F5)">
    <button class:activo={modo === "editar"} aria-pressed={modo === "editar"} onclick={() => oncambiarmodo?.("editar")}>
      <Pencil size={16} /> Editar
    </button>
    <button
      class="simular"
      class:activo={modo === "simular"}
      aria-pressed={modo === "simular"}
      onclick={() => oncambiarmodo?.("simular")}
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
