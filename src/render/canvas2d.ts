// Implementación del Renderer sobre Canvas 2D (pantalla).

import type { DefinicionSimbolo } from "../core/symbols";
import type { Alineacion, Estilo, Renderer } from "./renderer";

/** Helvetica, para que la pantalla se parezca al PDF. */
const FUENTE = "Helvetica, Arial, sans-serif";

/**
 * Los textos se dibujan a este tamaño y se escalan después: algunos motores
 * (WebKitGTK) redondean o ignoran fuentes de 1 px aunque luego se amplíen.
 */
const TAMANO_BASE_TEXTO = 100;

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

export class RendererCanvas implements Renderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  estilo(e: Estilo): void {
    if (e.trazo !== undefined) this.ctx.strokeStyle = e.trazo;
    if (e.relleno !== undefined) this.ctx.fillStyle = e.relleno;
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

  texto(x: number, y: number, texto: string, alto: number, alineacion: Alineacion = "izquierda"): void {
    const c = this.ctx;
    const k = alto / TAMANO_BASE_TEXTO;
    c.save();
    c.translate(x, y);
    c.scale(k, k);
    c.font = `${TAMANO_BASE_TEXTO}px ${FUENTE}`;
    c.textAlign = ALINEAR[alineacion];
    c.textBaseline = "middle";
    c.fillText(texto, 0, 0);
    c.restore();
  }

  simbolo(def: DefinicionSimbolo): void {
    const { trazo, relleno } = trazadoSimbolo(def);
    this.ctx.stroke(trazo);
    if (relleno) this.ctx.fill(relleno);
  }

  guardar(): void {
    this.ctx.save();
  }

  restaurar(): void {
    this.ctx.restore();
  }

  trasladar(dx: number, dy: number): void {
    this.ctx.translate(dx, dy);
  }

  escalar(sx: number, sy = sx): void {
    this.ctx.scale(sx, sy);
  }

  rotar(grados: number): void {
    this.ctx.rotate(grados * A_RADIANES);
  }
}
