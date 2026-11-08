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
 * Renderer sobre un contexto 2D.
 *
 * Lleva la cuenta de la transformación actual (además de aplicarla al
 * contexto) para saber de qué tamaño en píxeles queda cada texto. Por eso la
 * transformación inicial se fija con `transformar`, no con ctx.setTransform.
 *
 * Con un caché de textos (`textos`), los textos derechos no se dibujan en el
 * momento: se anotan y se copian todos juntos del caché en `volcarTextos`,
 * encima del resto del dibujo. Quien dibuja tiene que llamarlo al terminar.
 */
export class RendererCanvas implements Renderer {
  /** Caché de textos pre-renderizados; null: cada texto con fillText. */
  textos: CacheTextos | null = null;
  /** Transformación actual (a, b, c, d, e, f), la misma que tiene el contexto. */
  private readonly m = [1, 0, 0, 1, 0, 0];
  private readonly pila: number[] = [];
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
  }

  estilo(e: Estilo): void {
    if (e.trazo !== undefined) this.ctx.strokeStyle = e.trazo;
    if (e.relleno !== undefined) {
      this.ctx.fillStyle = e.relleno;
      this.relleno = e.relleno;
    }
    if (e.grosor !== undefined) this.ctx.lineWidth = e.grosor;
  }

  linea(x1: number, y1: number, x2: number, y2: number): void {
    const c = this.ctx;
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
    c.beginPath();
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      c.moveTo(segmentos[j]!, segmentos[j + 1]!);
      c.lineTo(segmentos[j + 2]!, segmentos[j + 3]!);
    }
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
    this.ctx.stroke(trazo);
    if (relleno) this.ctx.fill(relleno);
  }

  guardar(): void {
    this.ctx.save();
    this.pila.push(...this.m);
    this.pilaRelleno.push(this.relleno);
  }

  restaurar(): void {
    this.ctx.restore();
    if (this.pila.length < 6) return;
    for (let i = 5; i >= 0; i--) this.m[i] = this.pila.pop()!;
    this.relleno = this.pilaRelleno.pop() ?? null;
  }

  trasladar(dx: number, dy: number): void {
    this.ctx.translate(dx, dy);
    const m = this.m;
    m[4] = m[0]! * dx + m[2]! * dy + m[4]!;
    m[5] = m[1]! * dx + m[3]! * dy + m[5]!;
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
