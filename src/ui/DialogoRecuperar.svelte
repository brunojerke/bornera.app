<script lang="ts">
  // «Bornera no se cerró bien» (T23, D2c-A; textos en docs/plan-T23.md,
  // sección 5): al arrancar, con copias de recuperación sin dueño.
  // - Una copia: Recuperar (el principal) y Descartar.
  // - Varias (D3-A): una fila por copia, la más nueva primero, cada una con
  //   Recuperar y Descartar. Recuperar una cierra el diálogo; las demás quedan
  //   para el próximo arranque.
  // - Una copia que no abre: «No se pudo recuperar», los problemas, Exportar
  //   tal cual, Descartar y Cerrar.
  // Esc deja la decisión para el próximo arranque. Es modal (aria-modal): los
  // atajos del editor y los de archivo no actúan mientras está abierto.

  import type { FilaRecuperar } from "./recuperar";

  let {
    copias,
    rota = null,
    ocupado = false,
    onrecuperar,
    ondescartar,
    onexportar,
    oncerrar,
  }: {
    copias: readonly FilaRecuperar[];
    /** La copia que no abrió, con las líneas de sus problemas; null si no hay. */
    rota?: { fila: FilaRecuperar; lineas: readonly string[]; puedeExportar: boolean } | null;
    /** Hay una acción en curso: los botones no hacen nada. */
    ocupado?: boolean;
    onrecuperar: (id: string) => void;
    ondescartar: (id: string) => void;
    onexportar: (id: string) => void;
    /** Esc o Cerrar: la decisión queda para el próximo arranque. */
    oncerrar: () => void;
  } = $props();

  let principal = $state<HTMLButtonElement>();

  $effect(() => {
    void rota;
    principal?.focus();
  });

  function alTecla(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (!ocupado) oncerrar();
    }
  }

  const accion = (f: (id: string) => void, id: string) => () => {
    if (!ocupado) f(id);
  };
</script>

<svelte:window onkeydown={alTecla} />

<div class="fondo">
  <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="dialogo-recuperar-titulo">
    {#if rota}
      <h2 id="dialogo-recuperar-titulo">No se pudo recuperar</h2>
      <p>
        La copia de <strong>{rota.fila.nombre}</strong>{#if rota.fila.nuncaGuardada}&nbsp;(nunca se guardó){/if}, de {rota.fila.cuando}, no abre:
      </p>
      <ul class="problemas">
        {#each rota.lineas as linea, i (i)}
          <li>{linea}</li>
        {/each}
      </ul>
      <div class="acciones">
        {#if rota.puedeExportar}
          <button bind:this={principal} class="principal" onclick={accion(onexportar, rota.fila.id)}>Exportar tal cual…</button>
        {/if}
        <button onclick={accion(ondescartar, rota.fila.id)}>Descartar</button>
        <button onclick={() => !ocupado && oncerrar()}>Cerrar</button>
      </div>
    {:else}
      <h2 id="dialogo-recuperar-titulo">Bornera no se cerró bien</h2>
      {#if copias.length === 1}
        {@const c = copias[0]!}
        <p>
          Quedó una copia de recuperación de <strong>{c.nombre}</strong>{#if c.nuncaGuardada}&nbsp;(nunca se guardó){/if}, de {c.cuando}.
        </p>
        <div class="acciones">
          <button bind:this={principal} class="principal" onclick={accion(onrecuperar, c.id)}>Recuperar</button>
          <button onclick={accion(ondescartar, c.id)}>Descartar</button>
        </div>
      {:else}
        <p>Quedaron {copias.length} copias de recuperación:</p>
        <ul class="filas">
          {#each copias as c, i (c.id)}
            <li>
              <span class="texto">
                <strong>{c.nombre}</strong>{#if c.nuncaGuardada}&nbsp;· nunca se guardó{/if} · {c.cuando} · {c.componentes}
                {c.componentes === 1 ? "componente" : "componentes"}
              </span>
              {#if i === 0}
                <button bind:this={principal} class="principal" onclick={accion(onrecuperar, c.id)}>Recuperar</button>
              {:else}
                <button class="principal" onclick={accion(onrecuperar, c.id)}>Recuperar</button>
              {/if}
              <button onclick={accion(ondescartar, c.id)}>Descartar</button>
            </li>
          {/each}
        </ul>
      {/if}
      <p class="pie">Esc: decidir la próxima vez</p>
    {/if}
  </div>
</div>

<style>
  .fondo {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.4);
  }

  .dialogo {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(520px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    padding: 12px;
    background: var(--superficie);
    border: 1px solid var(--borde);
    border-radius: var(--radio);
  }

  h2 {
    margin: 0;
    font-size: 14px;
  }

  p {
    margin: 0;
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .pie {
    color: var(--texto-suave);
    font-size: 12px;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
  }

  .problemas li {
    padding: 2px 0;
    overflow-wrap: anywhere;
  }

  .filas li {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    border-top: 1px solid var(--borde);
  }

  .filas .texto {
    flex: 1;
    overflow-wrap: anywhere;
  }

  .acciones {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 4px;
  }

  button {
    height: 28px;
    padding: 0 12px;
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    background: transparent;
    cursor: pointer;
    white-space: nowrap;
  }

  button.principal {
    background: var(--acento);
    border-color: var(--acento);
    color: var(--acento-texto);
  }
</style>
