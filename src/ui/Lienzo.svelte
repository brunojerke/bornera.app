<script lang="ts">
  // Lienzo central: un <canvas> que ocupa todo el espacio libre.
  // Por ahora solo ajusta su resolución al tamaño real (sin dibujar nada).
  // No hay bucle: solo reacciona cuando cambia el tamaño.

  let contenedor: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  $effect(() => {
    const ajustar = () => {
      const escala = window.devicePixelRatio || 1;
      const ancho = Math.round(contenedor.clientWidth * escala);
      const alto = Math.round(contenedor.clientHeight * escala);
      if (canvas.width !== ancho || canvas.height !== alto) {
        canvas.width = ancho;
        canvas.height = alto;
      }
    };

    const observador = new ResizeObserver(ajustar);
    observador.observe(contenedor);
    return () => observador.disconnect();
  });
</script>

<div class="lienzo" bind:this={contenedor}>
  <canvas bind:this={canvas} aria-label="Lienzo del circuito"></canvas>
</div>

<style>
  .lienzo {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    background: var(--lienzo);
  }

  /* Posición absoluta: el tamaño del canvas no empuja el layout. */
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
