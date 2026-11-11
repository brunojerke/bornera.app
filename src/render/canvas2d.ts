// Implementación del Renderer sobre Canvas 2D (pantalla).

import type { DefinicionSimbolo } from "../core/symbols";
import type { Alineacion, Estilo, Renderer } from "./renderer";
import { prepararFuente, TAMANO_BASE_TEXTO, type CacheTextos, type EntradaTexto } from "./textos";

const ALINEAR: Record<Alineacion, CanvasTextAlign> = {
  izquierda: "left",
  centro: "center",
  derecha: "right",
};

const A_RADIANES = Math.PI / 180;

/** Geometría de un símbolo ya armada: un trazado para contornear y otro para rellenar. */
export interface TrazadoSimbolo {
  trazo: Path2D;
  relleno: Path2D | null;
}

/**
 * Caché de trazados, uno por definición (es decir, por tipo de símbolo).
 * Un Path2D no depende del contexto, así que se comparte entre lienzos.
 * WeakMap: si una definición deja de usarse, su trazado se libera solo.
 */
const trazados = new WeakMap<DefinicionSimbolo, TrazadoSimbolo>();

/** Arma (o devuelve del caché) los Path2D de un símbolo, en coordenadas locales. */
export function trazadoSimbolo(def: DefinicionSimbolo): TrazadoSimbolo {
  const enCache = trazados.get(def);
  if (enCache) return enCache;

  const trazo = new Path2D();
  let relleno: Path2D | null = null;
  for (const p of def.primitivas) {
    switch (p.forma) {
      case "linea":
        trazo.moveTo(p.x1, p.y1);
        trazo.lineTo(p.x2, p.y2);
        break;
      case "arco": {
        // moveTo al inicio del arco: si no, Path2D lo une con el punto anterior.
        const a = p.desde * A_RADIANES;
        trazo.moveTo(p.cx + p.r * Math.cos(a), p.cy + p.r * Math.sin(a));
        trazo.arc(p.cx, p.cy, p.r, a, p.hasta * A_RADIANES);
        break;
      }
      case "circulo": {
        const destino = p.relleno ? (relleno ??= new Path2D()) : trazo;
        destino.moveTo(p.cx + p.r, p.cy);
        destino.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        break;
      }
      case "rectangulo": {
        const destino = p.relleno ? (relleno ??= new Path2D()) : trazo;
        destino.rect(p.x, p.y, p.ancho, p.alto);
        break;
      }
      case "texto":
        // Los textos no van al trazado: se dibujan aparte, siempre derechos.
        break;
    }
  }
  const resultado = { trazo, relleno };
  trazados.set(def, resultado);
  return resultado;
}

/** Más chico que esto, un término de la matriz cuenta como cero (errores de redondeo al rotar). */
const CASI_CERO = 1e-9;

/**
 * Grosor de un trazo en px físicos: entero y por lo menos 1. Con un grosor
 * fraccionario (1,16 px al 58 %) ninguna línea llena sus píxeles: sale gris.
 */
export function grosorEnPixeles(px: number): number {
  return Math.max(1, Math.round(px));
}

/**
 * Cuántos px físicos puede sobresalir un trazo alineado al píxel de su
 * contorno sin alinear, para un grosor nominal en px (sin redondear): lo que
 * se corre (hasta 1 px con grosor impar, medio con par; ver `RendererCanvas`)
 * más lo que engorda al redondear, por lado.
 */
export function sobranteAlineado(grosorNominalPx: number): number {
  const w = grosorEnPixeles(grosorNominalPx);
  return (w & 1 ? 1 : 0.5) + Math.max(0, (w - grosorNominalPx) / 2);
}

// Lugares de `RendererCanvas.m` después de la matriz (0 a 5).
/** Traslación sin la parte entera de la que fijó `transformar` (x, y). */
const RX = 6;
const RY = 7;
/** Parte entera de la traslación que fijó `transformar` (x, y). */
const BX = 8;
const BY = 9;
/** Grosor de línea actual, en unidades del sistema actual. */
const GROSOR = 10;
const LARGO_ESTADO = 11;

/**
 * Renderer sobre un contexto 2D.
 *
 * Lleva la cuenta de la transformación actual (además de aplicarla al
 * contexto) para saber de qué tamaño en píxeles queda cada texto. Por eso la
 * transformación inicial se fija con `transformar`, no con ctx.setTransform.
 *
 * Con un caché de textos (`textos`), los textos derechos no se dibujan en el
 * momento: se anotan y se copian todos juntos del caché en `volcarTextos`,
 * encima del resto del dibujo. Quien dibuja tiene que llamarlo al terminar.
 *
 * Alineación al píxel (T14n). Sin ella, una línea de un cable cae en cualquier
 * fracción de píxel y el suavizado la reparte en dos columnas grises. Mientras
 * la transformación no esté girada (0°, 90°, 180° o 270°; espejada vale):
 * - el grosor de todo trazo es un número entero de px físicos;
 * - los tramos horizontales o verticales de `lineas` y de `linea`, el centro
 *   de `circulo` y el origen de `simbolo` se llevan al píxel: un trazo de `w` px en la
 *   posición X ocupa desde round(X) − (w >> 1), la misma cuenta que los puntos
 *   de la grilla (grilla.ts). El centro queda en round(X), más medio píxel si
 *   `w` es impar.
 * El redondeo se hace sin la parte entera de la traslación que fijó
 * `transformar` (el corrimiento del mosaico o de la pantalla): así un punto de
 * la grilla cae en el mismo píxel en todos los mosaicos y en la capa dinámica,
 * y el cable llega justo a la línea del borne del símbolo, también cuando la
 * cuenta cae justo en medio píxel.
 */
export class RendererCanvas implements Renderer {
  /** Caché de textos pre-renderizados; null: cada texto con fillText. */
  textos: CacheTextos | null = null;
  /**
   * Transformación actual (a, b, c, d, e, f), la misma que tiene el contexto,
   * y después lo que hace falta para alinear al píxel (RX, RY, BX, BY, GROSOR).
   */
  private readonly m = [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1];
  private readonly pila: number[] = [];
  /** Resultado de `alinear`, en coordenadas del sistema actual. */
  private ax = 0;
  private ay = 0;
  /** Color de relleno actual (el de los textos); null si todavía no se fijó. */
  private relleno: string | null = null;
  private readonly pilaRelleno: (string | null)[] = [];
  /** Textos anotados para copiar del caché, con su destino en px (x, y seguidos). */
  private readonly pendientes: (EntradaTexto | undefined)[] = [];
  private readonly destinos: number[] = [];
  private cantidadPendientes = 0;

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  /** Reemplaza la transformación (como ctx.setTransform). */
  transformar(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.ctx.setTransform(a, b, c, d, e, f);
    const m = this.m;
    m[0] = a;
    m[1] = b;
    m[2] = c;
    m[3] = d;
    m[4] = e;
    m[5] = f;
    m[BX] = Math.round(e);
    m[BY] = Math.round(f);
    m[RX] = e - m[BX];
    m[RY] = f - m[BY];
  }

  /** Px físicos por unidad del sistema actual. */
  private escala(): number {
    const m = this.m;
    return Math.sqrt(m[0]! * m[0]! + m[1]! * m[1]!);
  }

  /**
   * Cómo quedan los ejes con la transformación actual. 1: derechos (sin girar
   * o a 180°); 2: cruzados (a 90° o 270°); 0: girada otro ángulo, y entonces
   * nada se alinea al píxel.
   */
  private ejes(): 0 | 1 | 2 {
    const m = this.m;
    const derechos = Math.abs(m[0]!) + Math.abs(m[3]!);
    const cruzados = Math.abs(m[1]!) + Math.abs(m[2]!);
    if (cruzados <= CASI_CERO * derechos) return 1;
    if (derechos <= CASI_CERO * cruzados) return 2;
    return 0;
  }

  /** Grosor del trazo actual en px físicos (entero). */
  private grosorPx(): number {
    return grosorEnPixeles(this.m[GROSOR]! * this.escala());
  }

  /**
   * Lleva el punto (x, y) al píxel, para un trazo de `w` px, y lo deja en
   * (`ax`, `ay`), en coordenadas del sistema actual. `ejes` es 1 o 2.
   */
  private alinear(x: number, y: number, w: number, ejes: 1 | 2): void {
    const m = this.m;
    const medio = (w & 1) / 2;
    // En px, contados desde la traslación actual (m[4], m[5]).
    const px = Math.round(m[0]! * x + m[2]! * y + m[RX]!) + medio + m[BX]! - m[4]!;
    const py = Math.round(m[1]! * x + m[3]! * y + m[RY]!) + medio + m[BY]! - m[5]!;
    if (ejes === 1) {
      this.ax = px / m[0]!;
      this.ay = py / m[3]!;
    } else {
      this.ax = py / m[1]!;
      this.ay = px / m[2]!;
    }
  }

  estilo(e: Estilo): void {
    if (e.trazo !== undefined) this.ctx.strokeStyle = e.trazo;
    if (e.relleno !== undefined) {
      this.ctx.fillStyle = e.relleno;
      this.relleno = e.relleno;
    }
    if (e.grosor !== undefined) {
      // Grosor entero en px físicos (ver la clase).
      const s = this.escala();
      const g = s > 0 ? grosorEnPixeles(e.grosor * s) / s : e.grosor;
      this.ctx.lineWidth = g;
      this.m[GROSOR] = g;
    }
  }

  linea(x1: number, y1: number, x2: number, y2: number): void {
    const c = this.ctx;
    // Horizontal o vertical: al píxel, como los cables (la marca de un borne va sobre el cable).
    if (x1 === x2 || y1 === y2) {
      const ejes = this.ejes();
      if (ejes !== 0) {
        const w = this.grosorPx();
        this.alinear(x1, y1, w, ejes);
        x1 = this.ax;
        y1 = this.ay;
        this.alinear(x2, y2, w, ejes);
        x2 = this.ax;
        y2 = this.ay;
      }
    }
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  }

  arco(cx: number, cy: number, r: number, desde: number, hasta: number): void {
    const c = this.ctx;
    c.beginPath();
    // Con y hacia abajo, el sentido por defecto de canvas ya es horario.
    c.arc(cx, cy, r, desde * A_RADIANES, hasta * A_RADIANES);
    c.stroke();
  }

  circulo(cx: number, cy: number, r: number, relleno = false): void {
    const c = this.ctx;
    // Centro al píxel: el punto de un borne o de un extremo libre queda centrado en su cable.
    const ejes = this.ejes();
    if (ejes !== 0) {
      this.alinear(cx, cy, this.grosorPx(), ejes);
      cx = this.ax;
      cy = this.ay;
    }
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    if (relleno) c.fill();
    else c.stroke();
  }

  rectangulo(x: number, y: number, ancho: number, alto: number, relleno = false): void {
    if (relleno) this.ctx.fillRect(x, y, ancho, alto);
    else this.ctx.strokeRect(x, y, ancho, alto);
  }

  lineas(segmentos: ArrayLike<number>, n: number): void {
    if (n === 0) return;
    const c = this.ctx;
    const m = this.m;
    if (this.ejes() === 0) {
      c.beginPath();
      for (let i = 0, j = 0; i < n; i++, j += 4) {
        c.moveTo(segmentos[j]!, segmentos[j + 1]!);
        c.lineTo(segmentos[j + 2]!, segmentos[j + 3]!);
      }
      this.trazarLineas();
      return;
    }
    // Al píxel, y directamente en px físicos (sin transformación): así las
    // coordenadas son exactas, también lejos del origen, y cada tramo llena
    // píxeles enteros en cualquier motor.
    const a = m[0]!;
    const b = m[1]!;
    const cc = m[2]!;
    const d = m[3]!;
    const rx = m[RX]!;
    const ry = m[RY]!;
    const w = this.grosorPx();
    const dx = (w & 1) / 2 + m[BX]!;
    const dy = (w & 1) / 2 + m[BY]!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.beginPath();
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const x0 = segmentos[j]!;
      const y0 = segmentos[j + 1]!;
      const x1 = segmentos[j + 2]!;
      const y1 = segmentos[j + 3]!;
      if (x0 === x1 || y0 === y1) {
        c.moveTo(Math.round(a * x0 + cc * y0 + rx) + dx, Math.round(b * x0 + d * y0 + ry) + dy);
        c.lineTo(Math.round(a * x1 + cc * y1 + rx) + dx, Math.round(b * x1 + d * y1 + ry) + dy);
      } else {
        // Inclinado (las gomas de un arrastre): sin alinear, o sus rayas saldrían quebradas.
        c.moveTo(a * x0 + cc * y0 + m[4]!, b * x0 + d * y0 + m[5]!);
        c.lineTo(a * x1 + cc * y1 + m[4]!, b * x1 + d * y1 + m[5]!);
      }
    }
    c.lineWidth = w;
    this.trazarLineas();
    c.lineWidth = m[GROSOR]!;
    c.setTransform(a, b, cc, d, m[4]!, m[5]!);
  }

  /** Traza el recorrido que armó `lineas`. */
  private trazarLineas(): void {
    const c = this.ctx;
    // Tope cuadrado: en tramos horizontales y verticales llena justo la
    // esquina de cada codo (con el redondeado, la esquina de afuera queda
    // redonda) y no tiene arcos que suavizar.
    c.lineCap = "square";
    c.stroke();
    c.lineCap = "round";
  }

  rectangulos(cajas: ArrayLike<number>, n: number): void {
    if (n === 0) return;
    const c = this.ctx;
    // Cada contorno es un marco relleno (rectángulo de afuera menos el de
    // adentro, con la regla par-impar), con el color del trazo. Rellenar es
    // mucho más barato que trazar con antialiasing cuando son cientos.
    const g = c.lineWidth / 2;
    c.beginPath();
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const x = cajas[j]!;
      const y = cajas[j + 1]!;
      const w = cajas[j + 2]!;
      const h = cajas[j + 3]!;
      c.rect(x - g, y - g, w + 2 * g, h + 2 * g);
      if (w > 2 * g && h > 2 * g) c.rect(x + g, y + g, w - 2 * g, h - 2 * g);
    }
    const relleno = c.fillStyle;
    c.fillStyle = c.strokeStyle;
    c.fill("evenodd");
    c.fillStyle = relleno;
  }

  texto(x: number, y: number, texto: string, alto: number, alineacion: Alineacion = "izquierda"): void {
    const m = this.m;
    // Con caché, si el texto queda derecho y sin deformar: se anota para copiarlo.
    if (
      this.textos &&
      this.relleno !== null &&
      Math.abs(m[1]!) < CASI_CERO &&
      Math.abs(m[2]!) < CASI_CERO &&
      m[0]! > 0 &&
      Math.abs(m[0]! - m[3]!) < CASI_CERO
    ) {
      const e = this.textos.obtener(texto, alto * m[0]!, this.relleno);
      if (e) {
        const corrimiento = alineacion === "izquierda" ? 0 : alineacion === "centro" ? e.avance / 2 : e.avance;
        const i = this.cantidadPendientes++;
        this.pendientes[i] = e;
        // Destino en px enteros: copiar a medio píxel desenfocaría el texto.
        this.destinos[2 * i] = Math.round(m[0]! * x + m[4]! - e.ax - corrimiento);
        this.destinos[2 * i + 1] = Math.round(m[3]! * y + m[5]! - e.ay);
        return;
      }
    }
    const c = this.ctx;
    const k = alto / TAMANO_BASE_TEXTO;
    c.save();
    c.translate(x, y);
    c.scale(k, k);
    prepararFuente(c);
    c.textAlign = ALINEAR[alineacion];
    c.fillText(texto, 0, 0);
    c.restore();
  }

  /** Copia del caché los textos anotados, encima de lo dibujado hasta ahora. */
  volcarTextos(): void {
    const n = this.cantidadPendientes;
    if (n === 0) return;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < n; i++) {
      const e = this.pendientes[i]!;
      c.drawImage(e.imagen, e.sx, e.sy, e.ancho, e.alto, this.destinos[2 * i]!, this.destinos[2 * i + 1]!, e.ancho, e.alto);
      this.pendientes[i] = undefined; // no retener páginas liberadas
    }
    this.cantidadPendientes = 0;
    const m = this.m;
    c.setTransform(m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!);
  }

  simbolo(def: DefinicionSimbolo): void {
    const { trazo, relleno } = trazadoSimbolo(def);
    const c = this.ctx;
    const m = this.m;
    if (this.ejes() === 0) {
      c.stroke(trazo);
      if (relleno) c.fill(relleno);
      return;
    }
    // El origen del símbolo al píxel: sus líneas por el origen (las que llegan
    // a los bornes) caen en la columna o la fila del cable que llega a ellas.
    const medio = (this.grosorPx() & 1) / 2;
    c.setTransform(m[0]!, m[1]!, m[2]!, m[3]!, Math.round(m[RX]!) + medio + m[BX]!, Math.round(m[RY]!) + medio + m[BY]!);
    c.stroke(trazo);
    if (relleno) c.fill(relleno);
    c.setTransform(m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!);
  }

  guardar(): void {
    this.ctx.save();
    this.pila.push(...this.m);
    this.pilaRelleno.push(this.relleno);
  }

  restaurar(): void {
    this.ctx.restore();
    if (this.pila.length < LARGO_ESTADO) return;
    for (let i = LARGO_ESTADO - 1; i >= 0; i--) this.m[i] = this.pila.pop()!;
    this.relleno = this.pilaRelleno.pop() ?? null;
  }

  trasladar(dx: number, dy: number): void {
    this.ctx.translate(dx, dy);
    const m = this.m;
    m[4] = m[0]! * dx + m[2]! * dy + m[4]!;
    m[5] = m[1]! * dx + m[3]! * dy + m[5]!;
    // La misma cuenta sin la parte entera: da lo mismo en todos los mosaicos.
    m[RX] = m[0]! * dx + m[2]! * dy + m[RX]!;
    m[RY] = m[1]! * dx + m[3]! * dy + m[RY]!;
  }

  escalar(sx: number, sy = sx): void {
    this.ctx.scale(sx, sy);
    const m = this.m;
    m[0]! *= sx;
    m[1]! *= sx;
    m[2]! *= sy;
    m[3]! *= sy;
  }

  rotar(grados: number): void {
    const r = grados * A_RADIANES;
    this.ctx.rotate(r);
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const [a, b, c, d] = this.m as [number, number, number, number];
    const m = this.m;
    m[0] = a * cos + c * sin;
    m[1] = b * cos + d * sin;
    m[2] = c * cos - a * sin;
    m[3] = d * cos - b * sin;
  }
}
