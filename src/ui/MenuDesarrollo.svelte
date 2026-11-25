<script lang="ts">
  // Menú de desarrollo (en `npm run dev` / `tauri dev` y en las prereleases):
  // elegir la escena de prueba, ver el contador de rendimiento (F3), apagar
  // optimizaciones para comparar cuánto aporta cada una, diagnosticar el
  // arrastre (alpha.2), «Probar la fase 3b» (cierre 3b, etapa 4), «Probar la
  // fase 4» (C1), «Probar la fase 5» (T31), «Probar la fase 6» (T37) y
  // «Medir la copia (F1)» (T23).
  import Wrench from "@lucide/svelte/icons/wrench";
  import Check from "@lucide/svelte/icons/check";
  import { CANTIDADES_BANCO } from "../render/banco";
  import type { OpcionesCapas } from "../render/capas";
  import type { DiagnosticoArrastre, ModoArrastreDiagnostico } from "../editor/editor";
  import type { EscenaDesarrollo } from "./tipos";

  let {
    simulando = false,
    escena = $bindable("documento"),
    rendimiento = $bindable(false),
    opciones = $bindable(),
    diagnostico = $bindable(),
    onprobararrastre,
    onprobarfase3b,
    onprobarfase4,
    onprobarfase5,
    onprobarfase6,
    onmedircopia,
    oncopias,
  }: {
    /** En Simular (T32): no se cambia de escena ni corren las pruebas que la cambian o usan el banco. */
    simulando?: boolean;
    escena?: EscenaDesarrollo;
    rendimiento?: boolean;
    opciones: OpcionesCapas;
    diagnostico: DiagnosticoArrastre;
    /** Prueba automática del arrastre (abre la escena de 2000). */
    onprobararrastre?: () => void;
    /** Escenarios del banco de la checklist de la netbook, sin tocar la hoja (cierre 3b, etapa 4). */
    onprobarfase3b?: () => void;
    /** «Probar la fase 4»: lo de la fase 3b más F1, F2 y F3, sin tocar la hoja (C1). */
    onprobarfase4?: () => void;
    /** «Probar la fase 5»: lo de la fase 4 más S1–S5, sin tocar la hoja (T31). */
    onprobarfase5?: () => void;
    /** «Probar la fase 6»: lo de la fase 5 más S6 y P2, sin tocar la hoja (T37). */
    onprobarfase6?: () => void;
    /** «Medir la copia (F1)»: la parte síncrona de la copia de recuperación con 2000 + cables (T23). */
    onmedircopia?: () => void;
    /** «Copias de recuperación»: las copias, de quién son y si abren (T23, S2 y S3 a mano). */
    oncopias?: () => void;
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

  function probarFase3b() {
    abierto = false;
    onprobarfase3b?.();
  }

  function probarFase4() {
    abierto = false;
    onprobarfase4?.();
  }

  function probarFase5() {
    abierto = false;
    onprobarfase5?.();
  }

  function probarFase6() {
    abierto = false;
    onprobarfase6?.();
  }

  function medirCopia() {
    abierto = false;
    onmedircopia?.();
  }

  function verCopias() {
    abierto = false;
    oncopias?.();
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
        <button role="menuitemradio" aria-checked={escena === e.valor} disabled={simulando} onclick={() => elegir(e.valor)}>
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
      <button role="menuitem" disabled={simulando} onclick={probar}>
        <span class="marca"></span>
        Prueba automática…
      </button>

      <div class="separador"></div>
      <div class="titulo">Cierre de fase</div>
      <button role="menuitem" disabled={simulando} onclick={probarFase3b}>
        <span class="marca"></span>
        Probar la fase 3b…
      </button>
      <button role="menuitem" disabled={simulando} onclick={probarFase4}>
        <span class="marca"></span>
        Probar la fase 4…
      </button>
      <button role="menuitem" disabled={simulando} onclick={probarFase5}>
        <span class="marca"></span>
        Probar la fase 5…
      </button>
      <button role="menuitem" disabled={simulando} onclick={probarFase6}>
        <span class="marca"></span>
        Probar la fase 6…
      </button>
      <button role="menuitem" onclick={medirCopia}>
        <span class="marca"></span>
        Medir la copia (F1)…
      </button>
      <button role="menuitem" onclick={verCopias}>
        <span class="marca"></span>
        Copias de recuperación…
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

  .lista button:hover:not(:disabled) {
    background: var(--hover);
  }

  .lista button:disabled {
    color: var(--texto-suave);
    cursor: default;
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
