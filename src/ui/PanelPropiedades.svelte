<script lang="ts">
  // Panel de propiedades (derecha), plegable. Se abre solo al seleccionar,
  // salvo que el usuario lo haya plegado (lo decide Ventana).
  //
  // Con un componente: se edita la etiqueta (en fase y neutro, el nombre de la
  // red) y se gira o espeja. Con varios: la cantidad, la etiqueta y la
  // rotación comunes (o "Varias") y girar o espejar el grupo; la etiqueta, de
  // solo lectura. En Simular, todo de solo lectura.
  //
  // La etiqueta se edita con un borrador (edicionEtiqueta.ts): escribir no
  // toca el documento ni el lienzo; Enter, perder el foco, apretar en el
  // lienzo, F5 o cambiar de escena confirman (un paso de deshacer), y Esc
  // cancela. Se confirma sobre el editor y el componente con los que se
  // empezó, aunque la selección haya cambiado.
  import PanelRightClose from "@lucide/svelte/icons/panel-right-close";
  import PanelRightOpen from "@lucide/svelte/icons/panel-right-open";
  import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import FlipHorizontal2 from "@lucide/svelte/icons/flip-horizontal-2";
  import { untrack } from "svelte";
  import { SIN_SELECCION, type Editor, type ResumenSeleccion } from "../editor/editor";
  import type { Accion } from "../editor/atajos";
  import { normalizarEtiqueta } from "../core/model/etiquetas";
  import { EdicionEtiqueta } from "./edicionEtiqueta";
  import { NOTA_RED, textoCambioRed, textoCantidad, textoEtiqueta, textoRed, textoRotacion } from "./propiedades";

  let {
    abierto = $bindable(false),
    seleccion = SIN_SELECCION,
    editor = null,
    soloLectura = false,
    onalternar,
  }: {
    abierto?: boolean;
    seleccion?: ResumenSeleccion;
    /** Editor de lo que se muestra: a él van las ediciones. */
    editor?: Editor | null;
    /** En Simular: nada se edita. */
    soloLectura?: boolean;
    /** El usuario lo abrió o lo plegó con el botón. */
    onalternar?: (abierto: boolean) => void;
  } = $props();

  const edicion = new EdicionEtiqueta();
  let campo = $state<HTMLInputElement | null>(null);
  /** Lo que muestra el campo: el borrador mientras se edita, si no la etiqueta confirmada. */
  let texto = $state("");
  /** Sube con cada cambio del borrador, para recalcular el error y la nota. */
  let version = $state(0);

  const error = $derived.by(() => {
    void version;
    return edicion.error;
  });
  const redNueva = $derived.by(() => {
    void version;
    return edicion.redNueva;
  });

  function alternar(valor: boolean) {
    confirmar();
    abierto = valor;
    onalternar?.(valor);
  }

  /**
   * Confirma lo que se esté escribiendo, como al perder el foco (con un error,
   * vuelve al valor confirmado, sin paso). Ventana lo llama antes de cambiar
   * de modo o de escena. Se puede llamar de más: confirma una sola vez.
   */
  export function confirmar() {
    if (edicion.activa) {
      edicion.confirmar("salir");
      version++;
      texto = seleccion.unico?.etiqueta ?? "";
    }
    if (campo && document.activeElement === campo) campo.blur();
  }

  // La selección o lo seleccionado cambió (seleccionar, deshacer, rehacer,
  // borrar, otra escena). Un cambio de afuera no pisa lo que se escribe.
  $effect(() => {
    const u = seleccion.unico;
    untrack(() => {
      if (edicion.activa && u?.id === edicion.id) {
        edicion.actualizarBase(u.id, u.etiqueta);
        texto = edicion.texto ?? "";
        version++;
        return;
      }
      if (edicion.activa) {
        // Ya no se muestra lo que se editaba: se confirma sobre ese componente.
        edicion.confirmar("salir");
        version++;
        if (u && campo && document.activeElement === campo && !soloLectura && editor) {
          edicion.empezar(editor, u.id, u.etiqueta, u.esFuente);
        }
      }
      texto = u?.etiqueta ?? "";
    });
  });

  // Al pasar a Simular o cambiar de editor, lo escrito se confirma (también
  // lo hace Ventana antes; confirmar de más no hace nada).
  $effect(() => {
    if (soloLectura || editor) untrack(confirmar);
  });

  function alEnfocar() {
    const u = seleccion.unico;
    if (!u || !editor || soloLectura) return;
    edicion.empezar(editor, u.id, u.etiqueta, u.esFuente);
    texto = u.etiqueta;
    version++;
  }

  function alEscribir(e: Event & { currentTarget: HTMLInputElement }) {
    texto = e.currentTarget.value;
    edicion.escribir(texto);
    version++;
  }

  function alTecla(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key === "Enter") {
      e.preventDefault();
      const fin = edicion.confirmar("enter");
      version++;
      // Con error se sigue editando; si no, el foco vuelve al lienzo (R, M, Supr).
      if (fin !== "error") {
        texto = seleccion.unico?.etiqueta ?? "";
        e.currentTarget.blur();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      const base = edicion.base;
      edicion.cancelar();
      version++;
      texto = base ?? seleccion.unico?.etiqueta ?? "";
      e.currentTarget.value = texto;
      e.currentTarget.blur();
    }
  }

  function alSalir() {
    if (!edicion.activa) return; // ya se confirmó (Enter) o se canceló (Esc)
    edicion.confirmar("salir");
    version++;
    // Si se aplicó, el resumen ya trae la etiqueta nueva; si no, la de siempre.
    texto = seleccion.unico?.etiqueta ?? "";
  }

  /** Girar o espejar desde los botones: lo mismo que R y M. */
  function transformar(a: Accion) {
    if (!editor || soloLectura || editor.herramienta) return;
    confirmar();
    editor.accion(a);
  }

  const red = (etiqueta: string) => normalizarEtiqueta(etiqueta);
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
        <label class="rotulo" for="prop-etiqueta">{c.esFuente ? "Red (etiqueta)" : "Etiqueta"}</label>
        <input
          id="prop-etiqueta"
          bind:this={campo}
          class="campo"
          class:invalido={error}
          type="text"
          value={texto}
          disabled={soloLectura}
          aria-invalid={error ? "true" : "false"}
          aria-describedby="prop-etiqueta-nota"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          onfocus={alEnfocar}
          oninput={alEscribir}
          onkeydown={alTecla}
          onblur={alSalir}
        />
        <div id="prop-etiqueta-nota" class="notas">
          {#if error}
            <p class="error" role="alert">{error}</p>
          {:else if c.esFuente}
            <p class="nota">
              {redNueva ? textoCambioRed(red(edicion.base ?? c.etiqueta), redNueva) : textoRed(red(c.etiqueta), c.otrasEnRed)}
            </p>
            <p class="nota">{NOTA_RED}</p>
          {/if}
        </div>

        <div class="fila">
          <span class="rotulo">Rotación</span>
          <span class="valor">{textoRotacion(c.rot)}</span>
          {@render botonesGiro()}
        </div>
        <div class="fila">
          <span class="rotulo">Espejado</span>
          <span class="valor">{c.espejado ? "Sí" : "No"}</span>
          {@render botonEspejar()}
        </div>
        {#if soloLectura}
          <p class="nota">Solo lectura en Simular</p>
        {/if}
      </div>
    {:else if seleccion.cantidad > 1}
      {@const v = seleccion.varios}
      <div class="datos">
        <p class="nombre">{textoCantidad(seleccion.cantidad)}</p>
        <div class="fila">
          <span class="rotulo">Etiqueta</span>
          <span class="valor" class:varias={v?.etiqueta === null}>{textoEtiqueta(v?.etiqueta ?? null)}</span>
        </div>
        <div class="fila">
          <span class="rotulo">Rotación</span>
          <span class="valor" class:varias={v?.rot === null}>{textoRotacion(v?.rot ?? null)}</span>
          {@render botonesGiro()}
        </div>
        <div class="fila">
          <span class="rotulo">Espejar</span>
          <span class="valor"></span>
          {@render botonEspejar()}
        </div>
        {#if soloLectura}
          <p class="nota">Solo lectura en Simular</p>
        {/if}
      </div>
    {:else}
      <div class="vacio">
        <MousePointer2 size={22} />
        <p>Nada seleccionado</p>
        <p class="pista">Seleccioná un componente para ver su etiqueta y rotación.</p>
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

{#snippet botonesGiro()}
  <button
    class="boton-icono"
    title="Girar 90° antihorario (Mayús+R)"
    aria-label="Girar antihorario"
    disabled={soloLectura}
    onclick={() => transformar("rotarAntihorario")}
  >
    <RotateCcw size={16} />
  </button>
  <button
    class="boton-icono"
    title="Girar 90° horario (R)"
    aria-label="Girar horario"
    disabled={soloLectura}
    onclick={() => transformar("rotar")}
  >
    <RotateCw size={16} />
  </button>
{/snippet}

{#snippet botonEspejar()}
  <button class="boton-icono" title="Espejar (M)" aria-label="Espejar" disabled={soloLectura} onclick={() => transformar("espejar")}>
    <FlipHorizontal2 size={16} />
  </button>
{/snippet}

<style>
  .panel {
    display: flex;
    flex-direction: column;
    width: var(--ancho-propiedades);
    flex-shrink: 0;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
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
    display: flex;
    flex-direction: column;
    padding: 4px 10px 12px;
    min-width: 0;
  }

  .nombre {
    margin: 0 0 10px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .rotulo {
    color: var(--texto-suave);
  }

  label.rotulo {
    margin-bottom: 3px;
  }

  .campo {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 28px;
    padding: 0 6px;
    font: inherit;
    font-family: var(--fuente-mono);
    color: var(--texto);
    background: var(--fondo, var(--superficie));
    border: 1px solid var(--borde);
    border-radius: 4px;
  }

  .campo:focus {
    outline: 2px solid var(--acento);
    outline-offset: -1px;
  }

  .campo.invalido {
    border-color: var(--error, #d33);
    outline-color: var(--error, #d33);
  }

  .campo:disabled {
    opacity: 0.7;
  }

  .notas {
    min-height: 6px;
    margin-bottom: 6px;
  }

  .nota,
  .error {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .nota {
    color: var(--texto-suave);
  }

  .error {
    color: var(--error, #d33);
  }

  .fila {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 30px;
  }

  .fila .rotulo {
    width: 64px;
    flex-shrink: 0;
  }

  .valor {
    flex: 1;
    min-width: 0;
    font-family: var(--fuente-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .valor.varias {
    font-style: italic;
    font-family: inherit;
    color: var(--texto-suave);
  }
</style>
