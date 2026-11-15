<script lang="ts">
  // Barra de estado inferior: modo, coordenadas, zoom, la pista de la
  // herramienta (cable: qué haría el próximo clic) y avisos.
  //
  // Avisos (T19): un contador fijo de las validaciones, «1 error · 3 avisos»
  // o «Sin avisos». El texto de 4 s de una acción que no se pudo hacer lo
  // tapa y después vuelve el contador. En las escenas que no se editan, solo
  // «Sin avisos».
  import type { Modo } from "./tipos";
  import type { Punto } from "../render/camara";
  import { textoContador } from "./propiedades";

  let {
    modo,
    zoom,
    cursor,
    aviso = null,
    pista = null,
    cuentaAvisos = null,
  }: {
    modo: Modo;
    zoom: number;
    cursor: Punto | null;
    aviso?: string | null;
    pista?: string | null;
    cuentaAvisos?: { errores: number; avisos: number } | null;
  } = $props();

  const contador = $derived(textoContador(cuentaAvisos ?? { errores: 0, avisos: 0 }));
  const conAvisos = $derived(cuentaAvisos !== null && cuentaAvisos.errores + cuentaAvisos.avisos > 0);
</script>

<footer class="estado">
  <span class="modo" class:simulando={modo === "simular"}>
    {modo === "editar" ? "Edición" : "Simulación"}
  </span>
  <span class="dato">
    {cursor ? `X ${Math.round(cursor.x)} · Y ${Math.round(cursor.y)}` : "X – · Y –"}
  </span>
  <span class="dato">Zoom {Math.round(zoom * 100)} %</span>
  {#if pista}
    <span class="pista-herramienta" title={pista}>{pista}</span>
  {:else}
    <span class="espacio"></span>
  {/if}
  <span class="avisos" class:activo={aviso !== null} class:validaciones={aviso === null && conAvisos} role="status" aria-live="polite"
    >{aviso ?? contador}</span
  >
</footer>

<style>
  .estado {
    display: flex;
    align-items: center;
    gap: 16px;
    height: var(--alto-estado);
    padding: 0 10px;
    background: var(--superficie);
    border-top: 1px solid var(--borde);
    color: var(--texto-suave);
    font-size: 12px;
    white-space: nowrap;
  }

  .modo {
    font-weight: 600;
    color: var(--acento);
  }

  .modo.simulando {
    color: var(--simular);
  }

  .dato {
    font-family: var(--fuente-mono);
    font-size: 11px;
  }

  .espacio {
    flex: 1;
  }

  .pista-herramienta {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--texto);
  }

  .avisos {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .avisos.activo {
    color: var(--texto);
    font-weight: 600;
  }

  .avisos.validaciones {
    color: var(--aviso);
  }
</style>
