<script lang="ts">
  // Menú de desarrollo (en `npm run dev` / `tauri dev` y en las prereleases):
  // elegir la escena de prueba, ver el contador de rendimiento (F3), apagar
  // optimizaciones para comparar cuánto aporta cada una y diagnosticar el
  // arrastre (alpha.2).
  import Wrench from "@lucide/svelte/icons/wrench";
  import Check from "@lucide/svelte/icons/check";
  import { CANTIDADES_BANCO } from "../render/banco";
  import type { OpcionesCapas } from "../render/capas";
  import type { DiagnosticoArrastre, ModoArrastreDiagnostico } from "../editor/editor";
  import type { EscenaDesarrollo } from "./tipos";

  let {
    escena = $bindable("documento"),
    rendimiento = $bindable(false),
    opciones = $bindable(),
    diagnostico = $bindable(),
    onprobararrastre,
  }: {
    escena?: EscenaDesarrollo;
    rendimiento?: boolean;
    opciones: OpcionesCapas;
    diagnostico: DiagnosticoArrastre;
    /** Prueba automática del arrastre (abre la escena de 2000). */
    onprobararrastre?: () => void;
  } = $props();

  const MODOS_ARRASTRE: { valor: ModoArrastreDiagnostico; texto: string }[] = [
    { valor: "auto", texto: "Automático (completos hasta 80)" },
    { valor: "completos", texto: "Completos" },
    { valor: "sinTextos", texto: "Completos sin textos" },
    { valor: "sinTextosNiBornes", texto: "Completos sin textos ni bornes" },
    { valor: "contornos", texto: "Contornos" },
    { valor: "nada", texto: "Sin dibujar arrastrados (base)" },
  ];

  function probar() {
    abierto = false;
    onprobararrastre?.();
  }

  let abierto = $state(false);
  let raiz: HTMLDivElement;

  const ESCENAS: { valor: EscenaDesarrollo; texto: string }[] = [
    { valor: "documento", texto: "Documento" },
    { valor: "simbolos", texto: "Revisión de símbolos" },
    ...CANTIDADES_BANCO.map((n) => ({ valor: n, texto: `Banco: ${n.toLocaleString("es-AR")} símbolos` })),
    { valor: "cables", texto: "Banco: 2.000 símbolos y 3.000 cables" },
    { valor: "vacia", texto: "Escena vacía" },
  ];

  const OPTIMIZACIONES: { clave: keyof OpcionesCapas; texto: string }[] = [
    { clave: "cache", texto: "Capa estática en mosaicos" },
    { clave: "recorte", texto: "Recorte por vista" },
    { clave: "nivelDetalle", texto: "Nivel de detalle" },
    { clave: "cacheTextos", texto: "Caché de textos" },
  ];

  function elegir(valor: EscenaDesarrollo) {
    escena = valor;
    abierto = false;
  }

  function alternar(clave: keyof OpcionesCapas) {
    opciones = { ...opciones, [clave]: !opciones[clave] };
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
    class="boton-icono"
    class:activo={abierto}
    title="Desarrollo"
    aria-label="Menú de desarrollo"
    aria-haspopup="menu"
    aria-expanded={abierto}
    onclick={() => (abierto = !abierto)}
  >
    <Wrench size={18} />
  </button>

  {#if abierto}
    <div class="lista" role="menu" aria-label="Desarrollo">
      <div class="titulo">Escena</div>
      {#each ESCENAS as e (e.valor)}
        <button role="menuitemradio" aria-checked={escena === e.valor} onclick={() => elegir(e.valor)}>
          <span class="marca">{#if escena === e.valor}<Check size={14} />{/if}</span>
          {e.texto}
        </button>
      {/each}

      <div class="separador"></div>
      <button role="menuitemcheckbox" aria-checked={rendimiento} onclick={() => (rendimiento = !rendimiento)}>
        <span class="marca">{#if rendimiento}<Check size={14} />{/if}</span>
        Rendimiento
        <kbd>F3</kbd>
      </button>

      <div class="separador"></div>
      <div class="titulo">Optimizaciones</div>
      {#each OPTIMIZACIONES as o (o.clave)}
        <button role="menuitemcheckbox" aria-checked={opciones[o.clave]} onclick={() => alternar(o.clave)}>
          <span class="marca">{#if opciones[o.clave]}<Check size={14} />{/if}</span>
          {o.texto}
        </button>
      {/each}

      <div class="separador"></div>
      <div class="titulo">Arrastre (diagnóstico)</div>
      <button
        role="menuitemcheckbox"
        aria-checked={opciones.cacheTextosDinamica}
        onclick={() => alternar("cacheTextosDinamica")}
      >
        <span class="marca">{#if opciones.cacheTextosDinamica}<Check size={14} />{/if}</span>
        Caché de textos al arrastrar
      </button>
      {#each MODOS_ARRASTRE as m (m.valor)}
        <button
          role="menuitemradio"
          aria-checked={diagnostico.modo === m.valor}
          onclick={() => (diagnostico = { ...diagnostico, modo: m.valor })}
        >
          <span class="marca">{#if diagnostico.modo === m.valor}<Check size={14} />{/if}</span>
          {m.texto}
        </button>
      {/each}
      <button
        role="menuitemcheckbox"
        aria-checked={diagnostico.sonda}
        onclick={() => (diagnostico = { ...diagnostico, sonda: !diagnostico.sonda })}
      >
        <span class="marca">{#if diagnostico.sonda}<Check size={14} />{/if}</span>
        Medir la dinámica (sonda)
      </button>
      <button role="menuitem" onclick={probar}>
        <span class="marca"></span>
        Prueba automática…
      </button>
    </div>
  {/if}
</div>

<style>
  .menu {
    position: relative;
  }

  .activo {
    background: var(--hover);
  }

  .lista {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 10;
    min-width: 230px;
    /* A 1024×600 no entra entero: se desplaza. */
    max-height: calc(100vh - 56px);
    overflow-y: auto;
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
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 28px;
    padding: 0 8px 0 4px;
    border: 0;
    border-radius: calc(var(--radio) - 2px);
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .lista button:hover {
    background: var(--hover);
  }

  .marca {
    display: inline-grid;
    place-items: center;
    width: 16px;
    color: var(--acento);
  }

  kbd {
    margin-left: auto;
    font-family: var(--fuente-mono);
    font-size: 11px;
    color: var(--texto-suave);
  }

  .separador {
    height: 1px;
    margin: 4px 0;
    background: var(--borde);
  }
</style>
