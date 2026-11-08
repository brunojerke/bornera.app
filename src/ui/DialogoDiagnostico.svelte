<script lang="ts">
  // Prueba automática del arrastre (alpha.2). Mientras corre: un aviso chico
  // arriba, que no tapa el lienzo (taparlo cambiaría lo que se mide). Al
  // terminar: la tabla en Markdown para copiar.
  let {
    corriendo,
    texto,
    oncerrar,
  }: {
    corriendo: boolean;
    texto: string;
    oncerrar: () => void;
  } = $props();

  let area = $state<HTMLTextAreaElement>();
  let copiado = $state(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Sin permiso para el portapapeles: se selecciona y se copia a la antigua.
      area?.select();
      document.execCommand("copy");
    }
    copiado = true;
  }

  function alTecla(e: KeyboardEvent) {
    if (!corriendo && e.key === "Escape") oncerrar();
  }
</script>

<svelte:window onkeydown={alTecla} />

{#if corriendo}
  <div class="aviso" role="status">{texto} No toques el mouse.</div>
{:else}
  <div class="fondo">
    <div class="dialogo" role="dialog" aria-modal="true" aria-label="Diagnóstico del arrastre">
      <h2>Diagnóstico del arrastre</h2>
      <textarea bind:this={area} readonly value={texto} aria-label="Resultado"></textarea>
      <div class="acciones">
        <button onclick={copiar}>{copiado ? "Copiado" : "Copiar"}</button>
        <button onclick={oncerrar}>Cerrar</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .aviso {
    position: fixed;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    padding: 4px 10px;
    border-radius: var(--radio);
    background: var(--superficie);
    border: 1px solid var(--borde);
    font-size: 12px;
    pointer-events: none;
  }

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
    width: min(960px, calc(100vw - 32px));
    height: min(520px, calc(100vh - 32px));
    padding: 12px;
    background: var(--superficie);
    border: 1px solid var(--borde);
    border-radius: var(--radio);
  }

  h2 {
    margin: 0;
    font-size: 14px;
  }

  textarea {
    flex: 1;
    resize: none;
    font-family: var(--fuente-mono);
    font-size: 11px;
    white-space: pre;
    background: var(--lienzo);
    color: var(--texto);
    border: 1px solid var(--borde);
  }

  .acciones {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .acciones button {
    height: 28px;
    padding: 0 12px;
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    background: transparent;
    cursor: pointer;
  }
</style>
