// Capas de dibujo de un cuadro:
// - Estática: grilla, origen y componentes. Se dibuja en un canvas fuera de
//   pantalla y se reusa mientras no cambie el contenido ni el zoom. El caché
//   cubre la pantalla más un margen hacia cada lado, así desplazar la vista
//   es copiar una imagen corrida, sin redibujar nada, hasta salir del margen.
// - Dinámica: selección, cable en curso, estado de simulación. Se dibuja en
//   cada cuadro, encima de la estática.
// Los canvas son opacos (sin transparencia): copiar el caché es copiar
// píxeles, sin mezclar, y la pantalla no hace falta borrarla.
// No conoce el DOM salvo para crear canvas fuera de pantalla (inyectable).

import { Camara, type Caja } from "./camara";
import { RendererCanvas } from "./canvas2d";
import { DETALLE_COMPLETO, nivelDetalle } from "./detalle";
import type { ColoresContenido, Contenido } from "./escena";
import { Grilla, type ColoresGrilla } from "./grilla";
import type { MedidaCuadro } from "./rendimiento";
import type { Renderer } from "./renderer";

export interface Colores extends ColoresGrilla, ColoresContenido {
  /** Fondo del lienzo (los canvas son opacos). */
  fondo: string;
  origen: string;
}

/** Margen del caché hacia cada lado, en fracción del tamaño de la pantalla. */
export const MARGEN_CACHE = 0.25;

/** Optimizaciones activas. Apagarlas sirve para medir cuánto aporta cada una. */
export interface OpcionesCapas {
  /** Cachear la capa estática (si no, se redibuja en cada cuadro). */
  cache: boolean;
  /** Dibujar solo lo que toca la vista. */
  recorte: boolean;
  /** Omitir textos y bornes con zoom muy alejado. */
  nivelDetalle: boolean;
}

export const OPCIONES_OPTIMIZADAS: Readonly<OpcionesCapas> = { cache: true, recorte: true, nivelDetalle: true };
export const OPCIONES_SIN_OPTIMIZAR: Readonly<OpcionesCapas> = { cache: false, recorte: false, nivelDetalle: false };

/** Dibuja la capa dinámica, en unidades de grilla. */
export type DibujarDinamico = (r: Renderer, info: { escala: number; colores: Colores }) => void;

/** Caja que contiene todo: sin recorte. */
const TODO: Caja = { x: -1e9, y: -1e9, ancho: 2e9, alto: 2e9 };

/** Crea un canvas fuera de pantalla; opaco salvo que se pida transparente. */
export type CrearContexto = (transparente: boolean) => CanvasRenderingContext2D;

export function contextoNuevo(transparente: boolean): CanvasRenderingContext2D {
  const ctx = document.createElement("canvas").getContext("2d", { alpha: transparente });
  if (!ctx) throw new Error("El navegador no soporta Canvas 2D.");
  return ctx;
}

/** Con qué cámara y tamaño se armó el caché. */
interface EstadoCache {
  k: number;
  dpr: number;
  ancho: number;
  alto: number;
}

export class Capas {
  contenido: Contenido | null = null;
  dinamico: DibujarDinamico | null = null;
  colores: Colores = {
    fondo: "#fff",
    punto: "#ccc",
    mayor: "#999",
    origen: "#999",
    simbolo: "#000",
    borne: "#c00",
  };

  private _opciones: OpcionesCapas = { ...OPCIONES_OPTIMIZADAS };
  private readonly renderer: RendererCanvas;
  private readonly grilla: Grilla;
  private cacheCtx: CanvasRenderingContext2D | null = null;
  private cacheRenderer: RendererCanvas | null = null;
  /** Cámara del caché: su esquina superior izquierda es el píxel (0, 0) del caché. */
  private readonly camaraCache = new Camara();
  private estadoCache: EstadoCache | null = null;
  private dibujados = 0;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly crearContexto: CrearContexto = contextoNuevo,
  ) {
    this.renderer = new RendererCanvas(ctx);
    this.grilla = new Grilla(crearContexto);
  }

  get opciones(): Readonly<OpcionesCapas> {
    return this._opciones;
  }

  set opciones(o: OpcionesCapas) {
    this._opciones = { ...o };
    this.invalidarEstatica();
    if (!o.cache) this.liberarCache();
  }

  /** El contenido, los colores o las opciones cambiaron: rehacer la capa estática. */
  invalidarEstatica(): void {
    this.estadoCache = null;
  }

  /** Bytes que ocupa el caché (4 por píxel). */
  get memoriaCache(): number {
    const c = this.cacheCtx?.canvas;
    return c ? c.width * c.height * 4 : 0;
  }

  /**
   * Dibuja un cuadro en el canvas principal, que ya debe tener su tamaño físico
   * y ser opaco (`getContext("2d", { alpha: false })`).
   * `ancho` y `alto` en px CSS; `dpr` es el devicePixelRatio.
   */
  dibujar(camara: Camara, ancho: number, alto: number, dpr: number): MedidaCuadro {
    const t0 = performance.now();
    const { ctx } = this;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    let estatica = 0;
    let reconstruida = false;
    if (ancho <= 0 || alto <= 0) {
      this.pintarFondo(ctx);
    } else {
      const k = camara.escala * dpr;
      // Origen de la capa estática en la grilla y dónde cae en la pantalla
      // (px físicos, enteros: copiar a medio píxel la desenfocaría).
      let ox = camara.x;
      let oy = camara.y;
      let sx = 0;
      let sy = 0;

      if (this._opciones.cache) {
        const mx = Math.round(W * MARGEN_CACHE);
        const my = Math.round(H * MARGEN_CACHE);
        const cache = this.asegurarCache(W + 2 * mx, H + 2 * my);
        const cam = this.camaraCache;
        sx = Math.round((cam.x - camara.x) * k);
        sy = Math.round((cam.y - camara.y) * k);
        const e = this.estadoCache;
        const vigente =
          e !== null &&
          e.k === k &&
          e.dpr === dpr &&
          e.ancho === cache.canvas.width &&
          e.alto === cache.canvas.height &&
          sx <= 0 &&
          sy <= 0 &&
          sx + e.ancho >= W &&
          sy + e.alto >= H;
        if (!vigente) {
          cam.zoom = camara.zoom;
          cam.x = camara.x - mx / k;
          cam.y = camara.y - my / k;
          sx = -mx;
          sy = -my;
          const r = (this.cacheRenderer ??= new RendererCanvas(cache));
          estatica = this.dibujarEstatica(cache, r, cam, cache.canvas.width / dpr, cache.canvas.height / dpr, dpr);
          reconstruida = true;
          this.estadoCache = { k, dpr, ancho: cache.canvas.width, alto: cache.canvas.height };
        }
        ox = cam.x;
        oy = cam.y;
        ctx.drawImage(cache.canvas, sx, sy);
      } else {
        estatica = this.dibujarEstatica(ctx, this.renderer, camara, ancho, alto, dpr);
        reconstruida = true;
      }

      if (this.dinamico) {
        ctx.setTransform(k, 0, 0, k, sx - ox * k, sy - oy * k);
        this.prepararContexto(ctx);
        this.renderer.guardar();
        this.dinamico(this.renderer, { escala: camara.escala, colores: this.colores });
        this.renderer.restaurar();
      }
    }

    return {
      total: performance.now() - t0,
      reconstruida,
      estatica,
      dibujados: this.dibujados,
      componentes: this.contenido?.cantidad ?? 0,
    };
  }

  /** Suelta el caché (la memoria del canvas fuera de pantalla). */
  liberarCache(): void {
    if (this.cacheCtx) {
      this.cacheCtx.canvas.width = 0;
      this.cacheCtx.canvas.height = 0;
    }
    this.cacheCtx = null;
    this.cacheRenderer = null;
    this.estadoCache = null;
  }

  /** Crea el caché o le cambia el tamaño (cambiar el tamaño de un canvas lo borra). */
  private asegurarCache(ancho: number, alto: number): CanvasRenderingContext2D {
    const ctx = (this.cacheCtx ??= this.crearContexto(false));
    if (ctx.canvas.width !== ancho || ctx.canvas.height !== alto) {
      ctx.canvas.width = ancho;
      ctx.canvas.height = alto;
      this.estadoCache = null;
    }
    return ctx;
  }

  private pintarFondo(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.colores.fondo;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  /** Cambiar el tamaño de un canvas reinicia su estado: se repone en cada dibujo. */
  private prepararContexto(ctx: CanvasRenderingContext2D): void {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  /** Grilla, origen y contenido. Devuelve el tiempo que tardó, en ms. */
  private dibujarEstatica(
    ctx: CanvasRenderingContext2D,
    r: Renderer,
    cam: Camara,
    ancho: number,
    alto: number,
    dpr: number,
  ): number {
    const t0 = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.pintarFondo(ctx);
    this.prepararContexto(ctx);
    this.grilla.dibujar(ctx, cam, ancho, alto, dpr, this.colores);

    // De acá en adelante, todo se dibuja en unidades de grilla.
    const k = cam.escala * dpr;
    ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);

    // Cruz chica en (0, 0) para orientarse.
    r.guardar();
    r.estilo({ trazo: this.colores.origen, grosor: 1.5 / cam.escala });
    r.linea(-0.5, 0, 0.5, 0);
    r.linea(0, -0.5, 0, 0.5);
    r.restaurar();

    this.dibujados = 0;
    if (this.contenido) {
      const o = this._opciones;
      r.guardar();
      this.dibujados = this.contenido.dibujar(r, {
        escala: cam.escala,
        colores: this.colores,
        visible: o.recorte ? cam.visible(ancho, alto) : TODO,
        detalle: o.nivelDetalle ? nivelDetalle(cam.escala) : { ...DETALLE_COMPLETO },
      });
      r.restaurar();
    }
    return performance.now() - t0;
  }
}
