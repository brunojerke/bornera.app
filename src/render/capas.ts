// Capas de dibujo de un cuadro.
//
// Estática: grilla, origen y componentes. Se guarda en mosaicos de
// TAM_MOSAICO px (mosaicos.ts): canvas fuera de pantalla que en cada cuadro
// se copian a la pantalla.
// - Desplazar la vista es copiar mosaicos: solo se dibujan los que aparecen,
//   y de antemano los de un margen alrededor de la pantalla.
// - Los mosaicos se rehacen de a poco, con un presupuesto de PRESUPUESTO_MS
//   por cuadro; los que no entran quedan para los cuadros siguientes.
//   Mientras tanto se ve la versión anterior escalada (de otro nivel de zoom)
//   o un mosaico vacío con la grilla. Así ningún cuadro carga con rehacer la
//   pantalla entera.
// - Durante el zoom no se rehace nada: se escalan los mosaicos que ya están, y
//   recién ESPERA_ZOOM_MS después del último cambio se rehacen nítidos.
// - Al editar se invalida solo la región que cambió (`invalidarRegion`): los
//   mosaicos que la tocan quedan sucios, se siguen mostrando y se rehacen
//   antes que cualquier otro.
// - Los textos se copian de un caché de imágenes pre-renderizadas (textos.ts).
//
// Dinámica: selección, cable en curso, estado de simulación. Se dibuja en cada
// cuadro, encima de la estática.
//
// Los canvas son opacos (sin transparencia): copiar un mosaico es copiar
// píxeles, sin mezclar, y la pantalla no hace falta borrarla.
// No conoce el DOM salvo para crear canvas fuera de pantalla; eso y el reloj
// se pueden inyectar (los tests usan falsos).

import { ampliarCaja, seTocan, type Camara, type Caja } from "./camara";
import { RendererCanvas } from "./canvas2d";
import { DETALLE_COMPLETO, nivelDetalle } from "./detalle";
import type { ColoresContenido, Contenido } from "./escena";
import { Grilla, type ColoresGrilla } from "./grilla";
import { clave, Mosaicos, TAM_MOSAICO, type Mosaico } from "./mosaicos";
import type { MedidaCuadro } from "./rendimiento";
import type { Renderer } from "./renderer";
import { CacheTextos } from "./textos";

export interface Colores extends ColoresGrilla, ColoresContenido {
  /** Fondo del lienzo (los canvas son opacos). */
  fondo: string;
  origen: string;
  /** Lo que se está editando en la capa dinámica (vista previa al colocar). */
  acento: string;
}

/**
 * Tiempo para rehacer mosaicos en cada cuadro, en ms. Con lo que cuesta
 * copiarlos a la pantalla, el cuadro entero no debería pasar de 16 ms.
 */
export const PRESUPUESTO_MS = 8;

/**
 * Lo que puede tardar un cuadro entero, en ms (un poco menos de 16, por las
 * dudas). Si copiar a la pantalla tarda mucho (máquina lenta, mosaicos
 * escalados), el presupuesto para rehacer mosaicos se achica para no pasarse.
 */
export const OBJETIVO_CUADRO_MS = 14;

/** Después del último cambio de zoom, cuánto esperar para rehacer nítido (ms). */
export const ESPERA_ZOOM_MS = 150;

/** Margen alrededor de la pantalla que se dibuja de antemano, en px físicos. */
export const MARGEN_PX = 128;

/** Mosaicos que se guardan como máximo, en proporción a los que cubren pantalla y margen. */
const HOLGURA_MOSAICOS = 1.25;

/** Columnas de mosaicos cuyas tiras de grilla se guardan (sobra para una pantalla de 4K). */
const COLUMNAS_GRILLA = 24;

/** Alrededor de la cruz del origen, con lugar para el grosor de su trazo (unidades). */
const CAJA_CRUZ: Caja = { x: -1.5, y: -1.5, ancho: 3, alto: 3 };

/** Optimizaciones activas. Apagarlas sirve para medir cuánto aporta cada una. */
export interface OpcionesCapas {
  /** Guardar la capa estática en mosaicos (si no, se redibuja entera en cada cuadro). */
  cache: boolean;
  /** Dibujar solo lo que toca cada mosaico (o la pantalla). */
  recorte: boolean;
  /** Omitir textos y bornes con zoom muy alejado. */
  nivelDetalle: boolean;
  /** Copiar los textos de un caché de imágenes en vez de dibujarlos con fillText. */
  cacheTextos: boolean;
}

export const OPCIONES_OPTIMIZADAS: Readonly<OpcionesCapas> = {
  cache: true,
  recorte: true,
  nivelDetalle: true,
  cacheTextos: true,
};
export const OPCIONES_SIN_OPTIMIZAR: Readonly<OpcionesCapas> = {
  cache: false,
  recorte: false,
  nivelDetalle: false,
  cacheTextos: false,
};

/** Lo que la capa dinámica sabe del cuadro. */
export interface InfoDinamico {
  /** Píxeles CSS por unidad de grilla. */
  escala: number;
  colores: Colores;
  /** Parte de la grilla en pantalla: lo que no la toca no hace falta dibujarlo. */
  visible: Caja;
}

/** Dibuja la capa dinámica, en unidades de grilla. */
export type DibujarDinamico = (r: Renderer, info: InfoDinamico) => void;

/** Caja que contiene todo: sin recorte. */
const TODO: Caja = { x: -1e9, y: -1e9, ancho: 2e9, alto: 2e9 };

/** Crea un canvas fuera de pantalla; opaco salvo que se pida transparente. */
export type CrearContexto = (transparente: boolean) => CanvasRenderingContext2D;

export function contextoNuevo(transparente: boolean): CanvasRenderingContext2D {
  const ctx = document.createElement("canvas").getContext("2d", { alpha: transparente });
  if (!ctx) throw new Error("El navegador no soporta Canvas 2D.");
  return ctx;
}

/** Reloj en ms para medir el presupuesto de cada cuadro (los tests usan uno falso). */
export type Reloj = () => number;

/** Prioridad (menor, antes) de un mosaico visible sucio, de uno visible que falta y de uno del margen. */
const PRIORIDAD_SUCIO = -1e6;
const PRIORIDAD_FALTA = 0;
const PRIORIDAD_MARGEN = 1e6;

/** Mosaico que falta, con su prioridad (menor, antes). */
interface Pendiente {
  i: number;
  j: number;
  prioridad: number;
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
    acento: "#06f",
  };

  private _opciones: OpcionesCapas = { ...OPCIONES_OPTIMIZADAS };
  private readonly renderer: RendererCanvas;
  /** Una grilla para la pantalla y otra para los mosaicos: sus tiras tienen distinto ancho. */
  private readonly grillaPantalla: Grilla;
  private readonly grillaMosaicos: Grilla;
  private readonly mosaicos: Mosaicos;
  private readonly textos: CacheTextos;
  /** Canvas de 1×1 para forzar el rasterizado de cada mosaico (ver `rasterizar`). */
  private readonly sonda: CanvasRenderingContext2D;
  /** Cuadros dibujados: marca cuándo se usó cada mosaico por última vez. */
  private cuadro = 0;
  /** Nivel de zoom (px físicos por unidad) del cuadro anterior, y cuándo cambió por última vez. */
  private kAnterior = NaN;
  private cambioZoom = -Infinity;
  /** Lo que tarda un mosaico y lo que tarda componer la pantalla, promediados. */
  private estimadoMosaico = 1;
  private estimadoComposicion = 0;
  /** Máximo de mosaicos a guardar; depende del tamaño de la pantalla. */
  private maximoMosaicos = 0;
  private readonly pendientes: Pendiente[] = [];
  /** Esquinas en pantalla de los mosaicos visibles que faltan (x, y seguidos). */
  private readonly faltan: number[] = [];

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    crearContexto: CrearContexto = contextoNuevo,
    private readonly reloj: Reloj = () => performance.now(),
  ) {
    this.renderer = new RendererCanvas(ctx);
    this.grillaPantalla = new Grilla(crearContexto);
    this.grillaMosaicos = new Grilla(crearContexto, COLUMNAS_GRILLA);
    this.textos = new CacheTextos(crearContexto);
    this.mosaicos = new Mosaicos((): Mosaico => {
      const c = crearContexto(false);
      c.canvas.width = TAM_MOSAICO;
      c.canvas.height = TAM_MOSAICO;
      return { ctx: c, r: new RendererCanvas(c), k: NaN, i: 0, j: 0, usado: 0, sucio: false };
    });
    this.sonda = crearContexto(true);
    this.sonda.canvas.width = 1;
    this.sonda.canvas.height = 1;
  }

  get opciones(): Readonly<OpcionesCapas> {
    return this._opciones;
  }

  set opciones(o: OpcionesCapas) {
    this._opciones = { ...o };
    this.invalidarEstatica();
    if (!o.cache) this.mosaicos.liberar();
    if (!o.cacheTextos) this.textos.liberar();
  }

  /**
   * El contenido, los colores o las opciones cambiaron: rehacer la capa
   * estática. El caché de textos se conserva: las etiquetas suelen seguir
   * siendo las mismas, y uno de otro color es otra entrada.
   */
  invalidarEstatica(): void {
    this.mosaicos.vaciar();
  }

  /**
   * Cambió lo que se dibuja dentro de `caja` (unidades de grilla; la caja de
   * dibujo vieja unida a la nueva). Solo se rehacen los mosaicos que la tocan,
   * primero que nada; mientras tanto se siguen viendo como estaban. Los de
   * otros niveles de zoom que la tocan se descartan.
   * Devuelve true si hace falta un cuadro para ponerse al día.
   */
  invalidarRegion(caja: Caja): boolean {
    // Sin caché, cada cuadro dibuja todo: alcanza con pedir uno.
    if (!this._opciones.cache) return true;
    const mos = this.mosaicos;
    if (!mos.hayAlgo) return false;
    let n = 0;
    const k = mos.k;
    if (!Number.isNaN(k)) {
      // Un píxel físico de más por lado: el suavizado de los bordes del trazo.
      const m = 1 / k;
      const T = TAM_MOSAICO;
      n += mos.marcarSucios(
        Math.floor(((caja.x - m) * k) / T),
        Math.floor(((caja.y - m) * k) / T),
        Math.floor(((caja.x + caja.ancho + m) * k) / T),
        Math.floor(((caja.y + caja.alto + m) * k) / T),
      );
    }
    // Los viejos son de cualquier nivel: una unidad de grilla de margen es
    // siempre más de un píxel físico (con el zoom mínimo, 1 unidad = 2 px).
    n += mos.descartarViejosEn(ampliarCaja(caja, 1));
    return n > 0;
  }

  /** Bytes que ocupan los mosaicos y el caché de textos (4 por píxel). */
  get memoriaCache(): number {
    return this.mosaicos.memoria + this.textos.memoria;
  }

  /**
   * Dibuja un cuadro en el canvas principal, que ya debe tener su tamaño físico
   * y ser opaco (`getContext("2d", { alpha: false })`).
   * `ancho` y `alto` en px CSS; `dpr` es el devicePixelRatio; `ahora`, el
   * instante del cuadro en ms (para saber cuándo se detuvo el zoom).
   */
  dibujar(camara: Camara, ancho: number, alto: number, dpr: number, ahora = this.reloj()): MedidaCuadro {
    const t0 = this.reloj();
    const { ctx } = this;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Cambiar el tamaño de un canvas reinicia su estado: se repone en cada cuadro.
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const medida: MedidaCuadro = {
      total: 0,
      mosaicos: 0,
      estatica: 0,
      pendiente: false,
      esperar: 0,
      dibujados: 0,
      componentes: this.contenido?.cantidad ?? 0,
    };

    if (ancho <= 0 || alto <= 0) {
      this.pintarFondo(ctx, W, H);
    } else {
      const k = camara.escala * dpr;
      // Esquina de la pantalla en px globales del nivel k, entera: los
      // mosaicos se copian a píxel entero (a medio píxel se desenfocarían).
      const ox = Math.round(camara.x * k);
      const oy = Math.round(camara.y * k);
      const pantalla: Caja = { x: ox / k, y: oy / k, ancho: W / k, alto: H / k };

      if (this._opciones.cache) {
        this.dibujarConMosaicos(camara, k, ox, oy, W, H, dpr, ahora, medida);
      } else {
        const t = this.reloj();
        this.pintarVacio(ox, oy, W, H, k, dpr);
        this.dibujarContenido(this.renderer, k, -ox, -oy, pantalla, dpr);
        medida.estatica = this.reloj() - t;
      }

      if (this.dinamico) {
        const r = this.renderer;
        r.transformar(k, 0, 0, k, -ox, -oy);
        r.guardar();
        this.dinamico(r, { escala: camara.escala, colores: this.colores, visible: pantalla });
        r.restaurar();
      }

      if (this.contenido) {
        medida.dibujados = this._opciones.recorte ? this.contenido.contar(pantalla) : this.contenido.cantidad;
      }
    }

    medida.total = this.reloj() - t0;
    return medida;
  }

  /** Suelta la memoria de los mosaicos y del caché de textos. */
  liberarCache(): void {
    this.mosaicos.liberar();
    this.textos.liberar();
  }

  private dibujarConMosaicos(
    camara: Camara,
    k: number,
    ox: number,
    oy: number,
    W: number,
    H: number,
    dpr: number,
    ahora: number,
    medida: MedidaCuadro,
  ): void {
    this.cuadro++;
    const mos = this.mosaicos;
    if (k !== this.kAnterior && !Number.isNaN(this.kAnterior)) this.cambioZoom = ahora;
    this.kAnterior = k;

    if (k !== mos.k) {
      // Zoom en curso: se escala lo que hay hasta que pase la espera. Si no
      // hay nada que escalar, no tiene sentido esperar. Menos de 1 ms no se
      // espera (y evita esperas eternas de 1e-14 por redondeo).
      const espera = ESPERA_ZOOM_MS - (ahora - this.cambioZoom);
      if (espera >= 1 && mos.hayAlgo) {
        medida.esperar = Math.ceil(espera);
      } else {
        mos.cambiarNivel(k);
        this.textos.vaciar(); // los textos de otro tamaño ya no sirven
      }
    }

    if (k === mos.k) {
      const t = this.reloj();
      const quedan = this.rehacerMosaicos(ox, oy, W, H, k, dpr, medida);
      if (medida.mosaicos > 0) medida.estatica = this.reloj() - t;
      medida.pendiente = quedan > 0;
    }

    const t = this.reloj();
    this.componer(camara, k, ox, oy, W, H, dpr);
    this.estimadoComposicion = 0.7 * this.estimadoComposicion + 0.3 * (this.reloj() - t);
  }

  /**
   * Rehace los mosaicos que faltan o están sucios en la pantalla y su margen:
   * primero los visibles sucios (lo que se acaba de editar), después los
   * visibles que faltan y al final el margen; cada grupo del centro hacia
   * afuera. Sigue hasta gastar el presupuesto (al menos uno por cuadro).
   * Devuelve cuántos quedan.
   */
  private rehacerMosaicos(
    ox: number,
    oy: number,
    W: number,
    H: number,
    k: number,
    dpr: number,
    medida: MedidaCuadro,
  ): number {
    const T = TAM_MOSAICO;
    const mos = this.mosaicos;
    const vi0 = Math.floor(ox / T);
    const vi1 = Math.floor((ox + W - 1) / T);
    const vj0 = Math.floor(oy / T);
    const vj1 = Math.floor((oy + H - 1) / T);
    const mi0 = Math.floor((ox - MARGEN_PX) / T);
    const mi1 = Math.floor((ox + W - 1 + MARGEN_PX) / T);
    const mj0 = Math.floor((oy - MARGEN_PX) / T);
    const mj1 = Math.floor((oy + H - 1 + MARGEN_PX) / T);
    this.maximoMosaicos = Math.ceil((mi1 - mi0 + 1) * (mj1 - mj0 + 1) * HOLGURA_MOSAICOS);

    // Centro de la pantalla, en mosaicos.
    const ci = (ox + W / 2) / T - 0.5;
    const cj = (oy + H / 2) / T - 0.5;
    const pendientes = this.pendientes;
    pendientes.length = 0;
    for (let j = mj0; j <= mj1; j++) {
      for (let i = mi0; i <= mi1; i++) {
        const m = mos.actuales.get(clave(i, j));
        if (m) {
          m.usado = this.cuadro;
          if (!m.sucio) continue;
        }
        const fuera = i < vi0 || i > vi1 || j < vj0 || j > vj1;
        const base = fuera ? PRIORIDAD_MARGEN : m ? PRIORIDAD_SUCIO : PRIORIDAD_FALTA;
        pendientes.push({ i, j, prioridad: base + (i - ci) ** 2 + (j - cj) ** 2 });
      }
    }
    if (pendientes.length === 0) return 0;
    pendientes.sort((a, b) => a.prioridad - b.prioridad);

    const presupuesto = Math.min(PRESUPUESTO_MS, OBJETIVO_CUADRO_MS - this.estimadoComposicion);
    const t0 = this.reloj();
    let hechos = 0;
    for (const p of pendientes) {
      if (hechos > 0 && this.reloj() - t0 + this.estimadoMosaico > presupuesto) break;
      const t = this.reloj();
      this.dibujarMosaico(p.i, p.j, k, dpr);
      this.estimadoMosaico = 0.7 * this.estimadoMosaico + 0.3 * (this.reloj() - t);
      hechos++;
    }
    medida.mosaicos = hechos;
    return pendientes.length - hechos;
  }

  private dibujarMosaico(i: number, j: number, k: number, dpr: number): void {
    const T = TAM_MOSAICO;
    const m = this.mosaicos.tomar(i, j, this.cuadro, this.maximoMosaicos);
    const c = m.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    this.pintarFondo(c, T, T);
    this.grillaMosaicos.dibujar(c, i * T, j * T, T, T, k, dpr, this.colores);
    this.dibujarContenido(m.r, k, -i * T, -j * T, { x: (i * T) / k, y: (j * T) / k, ancho: T / k, alto: T / k }, dpr);
    this.rasterizar(c);
  }

  /**
   * Obliga a rasterizar el mosaico ya mismo. Algunos motores (Chromium sin
   * GPU) solo anotan las órdenes de dibujo y las ejecutan después, cuando el
   * canvas se copia: el presupuesto mediría solo el anotado y el dibujo real
   * caería todo junto en un cuadro. Copiar un píxel del mosaico obliga a
   * ejecutarlas ahora; borrar la copia enseguida suelta la referencia al
   * mosaico. En los motores que dibujan en el momento no cuesta casi nada.
   */
  private rasterizar(c: CanvasRenderingContext2D): void {
    this.sonda.drawImage(c.canvas, 0, 0, 1, 1, 0, 0, 1, 1);
    this.sonda.clearRect(0, 0, 1, 1);
  }

  /**
   * Origen y contenido, con la transformación (k, 0, 0, k, tx, ty): unidades
   * de grilla a px del canvas de `r`. `area` es la parte de la grilla que cubre.
   */
  private dibujarContenido(r: RendererCanvas, k: number, tx: number, ty: number, area: Caja, dpr: number): void {
    const escala = k / dpr;
    const o = this._opciones;
    if (this.textos.lleno) this.textos.vaciar();
    r.textos = o.cacheTextos ? this.textos : null;
    r.transformar(k, 0, 0, k, tx, ty);

    // Cruz chica en (0, 0) para orientarse (solo en el área que la toca).
    if (seTocan(area, CAJA_CRUZ)) {
      r.guardar();
      r.estilo({ trazo: this.colores.origen, grosor: 1.5 / escala });
      r.linea(-0.5, 0, 0.5, 0);
      r.linea(0, -0.5, 0, 0.5);
      r.restaurar();
    }

    if (this.contenido) {
      r.guardar();
      this.contenido.dibujar(r, {
        escala,
        colores: this.colores,
        visible: o.recorte ? area : TODO,
        detalle: o.nivelDetalle ? nivelDetalle(escala) : { ...DETALLE_COMPLETO },
      });
      r.restaurar();
    }
    r.volcarTextos();
    r.textos = null;
  }

  /**
   * Copia los mosaicos a la pantalla. Los del nivel de la cámara van a píxel
   * entero; donde faltan, mosaico vacío con la grilla y encima lo que haya de
   * otros niveles, escalado. Con el zoom en curso, todo va escalado.
   */
  private componer(camara: Camara, k: number, ox: number, oy: number, W: number, H: number, dpr: number): void {
    const T = TAM_MOSAICO;
    const { ctx } = this;
    const mos = this.mosaicos;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (k !== mos.k) {
      if (!this.cubreLaPantalla(camara, k, W, H)) {
        this.pintarVacio(ox, oy, W, H, k, dpr);
        this.dibujarEscalados(mos.viejos, camara, k, W, H);
      }
      this.dibujarEscalados(mos.actuales.values(), camara, k, W, H);
      return;
    }

    const faltan = this.faltan;
    faltan.length = 0;
    const i1 = Math.floor((ox + W - 1) / T);
    const j1 = Math.floor((oy + H - 1) / T);
    for (let j = Math.floor(oy / T); j <= j1; j++) {
      for (let i = Math.floor(ox / T); i <= i1; i++) {
        const m = mos.actuales.get(clave(i, j));
        if (m) {
          ctx.drawImage(m.ctx.canvas, i * T - ox, j * T - oy);
          m.usado = this.cuadro;
        } else {
          faltan.push(i * T - ox, j * T - oy);
        }
      }
    }

    if (faltan.length === 0) {
      // El nivel actual ya cubre la pantalla: los viejos no hacen más falta.
      if (mos.viejos.length) mos.soltarViejos();
      return;
    }
    ctx.save();
    ctx.beginPath();
    for (let n = 0; n < faltan.length; n += 2) ctx.rect(faltan[n]!, faltan[n + 1]!, T, T);
    ctx.clip();
    this.pintarVacio(ox, oy, W, H, k, dpr);
    this.dibujarEscalados(mos.viejos, camara, k, W, H);
    ctx.restore();
  }

  /**
   * Copia mosaicos de otro nivel a la escala de la cámara (los que tocan la
   * pantalla). Al agrandarlos no se suavizan: por software cuesta hasta cinco
   * veces menos, y la imagen dura lo que dura el zoom. Al achicarlos sí: sin
   * suavizado, las líneas finas aparecen y desaparecen.
   */
  private dibujarEscalados(lista: Iterable<Mosaico>, camara: Camara, k: number, W: number, H: number): void {
    const T = TAM_MOSAICO;
    const { ctx } = this;
    const bx = camara.x * k;
    const by = camara.y * k;
    for (const m of lista) {
      const f = (T * k) / m.k;
      ctx.imageSmoothingEnabled = k < m.k;
      // Bordes redondeados a píxel entero: mosaicos vecinos no dejan costuras.
      const x0 = Math.round(m.i * f - bx);
      const x1 = Math.round((m.i + 1) * f - bx);
      const y0 = Math.round(m.j * f - by);
      const y1 = Math.round((m.j + 1) * f - by);
      if (x1 <= Math.max(0, x0) || y1 <= Math.max(0, y0) || x0 >= W || y0 >= H) continue;
      ctx.drawImage(m.ctx.canvas, x0, y0, x1 - x0, y1 - y0);
      m.usado = this.cuadro;
    }
    ctx.imageSmoothingEnabled = true;
  }

  /** True si los mosaicos del nivel actual cubren toda la pantalla vista con zoom k. */
  private cubreLaPantalla(camara: Camara, k: number, W: number, H: number): boolean {
    const T = TAM_MOSAICO;
    const { actuales, k: kn } = this.mosaicos;
    if (actuales.size === 0) return false;
    const f = kn / k;
    const x0 = camara.x * kn;
    const y0 = camara.y * kn;
    const i0 = Math.floor(x0 / T);
    const i1 = Math.ceil((x0 + W * f) / T) - 1;
    const j0 = Math.floor(y0 / T);
    const j1 = Math.ceil((y0 + H * f) / T) - 1;
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > actuales.size) return false;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) if (!actuales.has(clave(i, j))) return false;
    }
    return true;
  }

  /** Fondo y grilla de toda la pantalla: lo que se ve donde todavía no hay mosaico. */
  private pintarVacio(ox: number, oy: number, W: number, H: number, k: number, dpr: number): void {
    this.pintarFondo(this.ctx, W, H);
    this.grillaPantalla.dibujar(this.ctx, ox, oy, W, H, k, dpr, this.colores);
  }

  private pintarFondo(ctx: CanvasRenderingContext2D, ancho: number, alto: number): void {
    ctx.fillStyle = this.colores.fondo;
    ctx.fillRect(0, 0, ancho, alto);
  }
}
