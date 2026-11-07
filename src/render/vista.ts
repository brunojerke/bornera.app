// Vista: une un <canvas> con la cámara y las capas de dibujo (capas.ts).
// - Ajusta la resolución al tamaño real en píxeles físicos (devicePixelRatio).
// - Redibuja solo cuando se pide con `invalidar()`, en el próximo
//   requestAnimationFrame; varios pedidos en el mismo cuadro se juntan en uno.
//   Sin cambios no hay ningún cuadro pendiente: CPU en cero.
// - Además, las capas pueden pedir otro cuadro si quedan mosaicos por rehacer
//   (se rehacen de a poco). Es trabajo con fin: cuando todo está al día, no se
//   pide nada más.

import { Camara, type Caja } from "./camara";
import { Capas, type OpcionesCapas } from "./capas";
import type { Contenido } from "./escena";
import type { MedidaCuadro } from "./rendimiento";

/** Factor de los botones de acercar/alejar. */
export const PASO_ZOOM = 1.25;

export class Vista {
  readonly camara = new Camara();
  /** Tamaño en píxeles CSS. */
  ancho = 0;
  alto = 0;
  /** Se llama después de cada cuadro dibujado, con lo que tardó. */
  alDibujar: ((m: MedidaCuadro) => void) | null = null;
  private dpr = 1;
  /** Ya se centró el origen la primera vez que el lienzo tuvo tamaño. */
  private iniciada = false;
  private readonly capas: Capas;
  private cuadroPendiente = 0;
  private readonly limpiezas: (() => void)[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    contenido: Contenido | null = null,
  ) {
    // Opaco: el fondo lo pinta Capas con el color del tema.
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("El navegador no soporta Canvas 2D.");
    this.capas = new Capas(ctx);
    this.capas.contenido = contenido;
    this.leerColores();
    this.observarTamano();
    this.observarTema();
  }

  get contenido(): Contenido | null {
    return this.capas.contenido;
  }

  /** Cambia lo que se dibuja (rehace la capa estática). */
  set contenido(c: Contenido | null) {
    this.capas.contenido = c;
    this.invalidarContenido();
  }

  get opciones(): Readonly<OpcionesCapas> {
    return this.capas.opciones;
  }

  /** Prende o apaga optimizaciones (para compararlas desde el menú de desarrollo). */
  set opciones(o: OpcionesCapas) {
    this.capas.opciones = o;
    this.invalidar();
  }

  /** Bytes del caché de la capa estática. */
  get memoriaCache(): number {
    return this.capas.memoriaCache;
  }

  /** El contenido cambió: rehacer la capa estática en el próximo cuadro. */
  invalidarContenido(): void {
    this.capas.invalidarEstatica();
    this.invalidar();
  }

  /**
   * Pide un redibujo para el próximo cuadro (si no hay uno ya pedido). Si solo
   * se movió la cámara o cambió la capa dinámica, la estática se reusa.
   */
  invalidar(): void {
    if (this.cuadroPendiente) return;
    this.cuadroPendiente = requestAnimationFrame(() => {
      this.cuadroPendiente = 0;
      this.dibujar();
    });
  }

  /** Zoom centrado en la pantalla, para los botones. */
  zoomAlCentro(factor: number): boolean {
    return this.camara.zoomEn(this.camara.zoom * factor, this.ancho / 2, this.alto / 2);
  }

  /** Encuadra la caja; sin caja (documento vacío), vuelve al origen al 100 %. */
  encuadrar(caja: Caja | null): void {
    if (caja) {
      this.camara.encuadrar(caja, this.ancho, this.alto);
    } else {
      this.camara.zoom = 1;
      this.camara.centrar(0, 0, this.ancho, this.alto);
    }
  }

  destruir(): void {
    this.cancelarPendiente();
    for (const limpiar of this.limpiezas) limpiar();
    this.capas.liberarCache();
  }

  private dibujar(): void {
    const medida = this.capas.dibujar(this.camara, this.ancho, this.alto, this.dpr);
    this.alDibujar?.(medida);
    if (medida.pendiente) this.invalidar();
  }

  private ajustar(anchoFisico: number, altoFisico: number, ancho: number, alto: number): void {
    if (ancho > 0 && alto > 0) {
      if (this.ancho > 0 && this.alto > 0) {
        this.camara.redimensionar(this.ancho, this.alto, ancho, alto);
      } else if (!this.iniciada) {
        this.camara.centrar(0, 0, ancho, alto);
        this.iniciada = true;
      }
    }
    this.ancho = ancho;
    this.alto = alto;
    this.dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== anchoFisico) this.canvas.width = anchoFisico;
    if (this.canvas.height !== altoFisico) this.canvas.height = altoFisico;
    // Cambiar el tamaño del canvas lo borra: hay que redibujar en el mismo cuadro.
    this.cancelarPendiente();
    this.dibujar();
  }

  private cancelarPendiente(): void {
    if (this.cuadroPendiente) cancelAnimationFrame(this.cuadroPendiente);
    this.cuadroPendiente = 0;
  }

  private observarTamano(): void {
    const observador = new ResizeObserver(([entrada]) => {
      if (!entrada) return;
      const { width, height } = entrada.contentRect;
      // Tamaño exacto en píxeles físicos si el navegador lo informa (evita
      // errores de redondeo con escalas como 125 %); si no, se calcula.
      const fisico = entrada.devicePixelContentBoxSize?.[0];
      const dpr = window.devicePixelRatio || 1;
      this.ajustar(
        fisico ? fisico.inlineSize : Math.round(width * dpr),
        fisico ? fisico.blockSize : Math.round(height * dpr),
        width,
        height,
      );
    });
    try {
      observador.observe(this.canvas, { box: "device-pixel-content-box" });
    } catch {
      observador.observe(this.canvas);
    }
    this.limpiezas.push(() => observador.disconnect());

    // Al pasar la ventana a otro monitor (u otro zoom del sistema) cambia el
    // devicePixelRatio sin que cambie el tamaño CSS: se vuelve a ajustar.
    let consulta: MediaQueryList | null = null;
    const alCambiarDpr = () => {
      consulta?.removeEventListener("change", alCambiarDpr);
      const dpr = window.devicePixelRatio || 1;
      if (this.ancho > 0) {
        this.ajustar(Math.round(this.ancho * dpr), Math.round(this.alto * dpr), this.ancho, this.alto);
      }
      consulta = matchMedia(`(resolution: ${dpr}dppx)`);
      consulta.addEventListener("change", alCambiarDpr);
    };
    consulta = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    consulta.addEventListener("change", alCambiarDpr);
    this.limpiezas.push(() => consulta?.removeEventListener("change", alCambiarDpr));
  }

  private observarTema(): void {
    const consulta = matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => {
      this.leerColores();
      this.invalidarContenido();
    };
    consulta.addEventListener("change", alCambiar);
    this.limpiezas.push(() => consulta.removeEventListener("change", alCambiar));
  }

  /** Los colores salen de las variables del tema (tema.css). */
  private leerColores(): void {
    const css = getComputedStyle(this.canvas);
    const leer = (nombre: string, otro: string) => css.getPropertyValue(nombre).trim() || otro;
    const antes = this.capas.colores;
    this.capas.colores = {
      fondo: leer("--lienzo", antes.fondo),
      punto: leer("--grilla", antes.punto),
      mayor: leer("--grilla-mayor", antes.mayor),
      origen: leer("--grilla-origen", antes.origen),
      simbolo: leer("--simbolo", antes.simbolo),
      borne: leer("--borne", antes.borne),
    };
  }
}
