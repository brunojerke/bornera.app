<script lang="ts">
  // Barra de estado inferior: modo, coordenadas, zoom y avisos.
  import type { Modo } from "./tipos";
  import type { Punto } from "../render/camara";

  let { modo, zoom, cursor }: { modo: Modo; zoom: number; cursor: Punto | null } = $props();
</script>

<footer class="estado">
  <span class="modo" class:simulando={modo === "simular"}>
    {modo === "editar" ? "Edición" : "Simulación"}
  </span>
  <span class="dato">
    {cursor ? `X ${Math.round(cursor.x)} · Y ${Math.round(cursor.y)}` : "X – · Y –"}
  </span>
  <span class="dato">Zoom {Math.round(zoom * 100)} %</span>
  <span class="espacio"></span>
  <span class="avisos">Sin avisos</span>
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
</style>
