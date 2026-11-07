<script lang="ts">
  // Contador de rendimiento (F3), encima del lienzo. Solo muestra datos: los
  // mide el Lienzo. No tapa el mouse (pointer-events: none).
  import { LIMITE_LENTO_MS, VENTANA_LENTOS_MS, type Resumen } from "../render/rendimiento";

  let {
    resumen,
    memoriaCache,
    detalle,
  }: {
    resumen: Resumen;
    /** Bytes del caché de la capa estática. */
    memoriaCache: number;
    /** Qué se está dibujando a este zoom. */
    detalle: string;
  } = $props();

  const ms = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const entero = new Intl.NumberFormat("es-AR");
  const etiquetaLentos = `> ${LIMITE_LENTO_MS} ms (${VENTANA_LENTOS_MS / 1000} s)`;
</script>

<div class="rendimiento" aria-live="off">
  <span>FPS</span>
  <b>{resumen.fps}{resumen.fps === 0 ? " (en reposo)" : ""}</b>
  <span>Cuadro</span>
  <b>{ms.format(resumen.ultimo)} ms</b>
  <span>Prom. / máx.</span>
  <b>{ms.format(resumen.promedio)} / {ms.format(resumen.maximo)} ms</b>
  <span>{etiquetaLentos}</span>
  <b class:alerta={resumen.lentos > 0}>{resumen.lentos} {resumen.lentos === 1 ? "cuadro" : "cuadros"}</b>
  <span>Capa estática</span>
  <b>{ms.format(resumen.estatica)} ms · {resumen.mosaicos} mosaicos/s</b>
  <span>Dibujados</span>
  <b>{entero.format(resumen.dibujados)} de {entero.format(resumen.componentes)}</b>
  <span>Detalle</span>
  <b>{detalle}</b>
  <span>Caché</span>
  <b>{memoriaCache ? `${ms.format(memoriaCache / 2 ** 20)} MB` : "apagado"}</b>
</div>

<style>
  .rendimiento {
    position: absolute;
    top: 8px;
    left: 8px;
    display: grid;
    grid-template-columns: auto auto;
    gap: 1px 10px;
    padding: 6px 9px;
    border-radius: var(--radio);
    background: var(--superficie); /* WebKitGTK viejo, sin color-mix */
    background: color-mix(in srgb, var(--superficie) 88%, transparent);
    border: 1px solid var(--borde);
    font-family: var(--fuente-mono);
    font-size: 11px;
    color: var(--texto-suave);
    pointer-events: none;
  }

  b {
    font-weight: 600;
    color: var(--texto);
    text-align: right;
  }

  b.alerta {
    color: var(--aviso);
  }
</style>
