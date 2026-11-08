// Herramienta cable (T13) en la capa dinámica: las marcas de los bornes
// visibles, el cable en curso con su vista previa, el objetivo bajo el cursor
// y los conflictos. Nada de esto toca la capa estática: los mosaicos se
// invalidan recién cuando el cable se crea.
//
// Colores: acento para lo que vale; aviso, a rayas, para lo que no. Las
// marcas van en un solo relleno por tipo (`Renderer.rectangulos`).

import type { Caja } from "./camara";
import type { InfoDinamico } from "./capas";
import { grosorLinea } from "./escena";
import { RADIO_LIBRE } from "./escenaEditable";
import type { Renderer } from "./renderer";

/** Lo que dibuja la herramienta: lo arma `HerramientaCable.dibujo`. */
export interface DibujoCableEnCurso {
  /** Recorrido a dibujar (lo fijado más la vista previa), x, y seguidos; null si no hay. */
  puntos: readonly number[] | null;
  valido: boolean;
  conflictos: readonly { x: number; y: number }[];
  objetivo: { tipo: "borne" | "cable" | "vacio" | "bloqueado"; x: number; y: number } | null;
  /** Extremos libres (x, y seguidos). */
  libres: readonly number[];
}

/** Lado de la marca de un borne, en unidades. */
export const LADO_MARCA = 0.5;
/** Largo de cada raya del cable en curso inválido, en px de pantalla. */
const RAYA_PX = 6;

/** Marcas reusadas entre cuadros (x, y, ancho, alto seguidos). */
const huecos: number[] = [];
const rellenos: number[] = [];
const segmentos: number[] = [];

/**
 * Marcas de los bornes: huecas las libres y rellenas las que tienen cable.
 * `libres` y `ocupados` tienen x, y seguidos.
 */
export function dibujarMarcasCable(r: Renderer, info: InfoDinamico, libres: readonly number[], ocupados: readonly number[]): void {
  const color = info.colores.acento;
  const g = grosorLinea(info.escala);
  const m = LADO_MARCA / 2;
  let n = 0;
  for (let i = 0; i + 1 < libres.length; i += 2, n++) {
    huecos[n * 4] = libres[i]! - m;
    huecos[n * 4 + 1] = libres[i + 1]! - m;
    huecos[n * 4 + 2] = LADO_MARCA;
    huecos[n * 4 + 3] = LADO_MARCA;
  }
  if (n > 0) {
    r.estilo({ trazo: color, relleno: color, grosor: g });
    r.rectangulos(huecos, n);
  }
  // Relleno: un rectángulo de ancho 0 con el grosor del lado sale como un cuadrado lleno.
  let k = 0;
  for (let i = 0; i + 1 < ocupados.length; i += 2, k++) {
    rellenos[k * 4] = ocupados[i]!;
    rellenos[k * 4 + 1] = ocupados[i + 1]!;
    rellenos[k * 4 + 2] = 0;
    rellenos[k * 4 + 3] = 0;
  }
  if (k > 0) {
    r.estilo({ trazo: color, relleno: color, grosor: LADO_MARCA });
    r.rectangulos(rellenos, k);
  }
}

/** Anota en `segmentos` desde `n` el tramo (x0, y0)–(x1, y1) a rayas de largo `raya`. Devuelve el nuevo total. */
function aRayas(x0: number, y0: number, x1: number, y1: number, raya: number, n: number): number {
  const largo = Math.abs(x1 - x0) + Math.abs(y1 - y0);
  const ux = Math.sign(x1 - x0);
  const uy = Math.sign(y1 - y0);
  for (let d = 0; d < largo; d += 2 * raya) {
    const e = Math.min(d + raya, largo);
    const j = n * 4;
    segmentos[j] = x0 + ux * d;
    segmentos[j + 1] = y0 + uy * d;
    segmentos[j + 2] = x0 + ux * e;
    segmentos[j + 3] = y0 + uy * e;
    n++;
  }
  return n;
}

/**
 * Anota en `segmentos`, desde `n`, el recorrido `p` a rayas: solo la parte
 * visible, así un tramo largo no da miles de rayas. Devuelve el nuevo total.
 */
function anotarRayas(p: readonly number[], v: Caja, raya: number, n: number): number {
  for (let i = 0; i + 3 < p.length; i += 2) {
    let x0 = p[i]!;
    let y0 = p[i + 1]!;
    let x1 = p[i + 2]!;
    let y1 = p[i + 3]!;
    if (y0 === y1) {
      if (y0 < v.y || y0 > v.y + v.alto) continue;
      const a = Math.max(Math.min(x0, x1), v.x);
      const b = Math.min(Math.max(x0, x1), v.x + v.ancho);
      if (a >= b) continue;
      [x0, x1] = x0 <= x1 ? [a, b] : [b, a];
    } else {
      if (x0 < v.x || x0 > v.x + v.ancho) continue;
      const a = Math.max(Math.min(y0, y1), v.y);
      const b = Math.min(Math.max(y0, y1), v.y + v.alto);
      if (a >= b) continue;
      [y0, y1] = y0 <= y1 ? [a, b] : [b, a];
    }
    n = aRayas(x0, y0, x1, y1, raya, n);
  }
  return n;
}

/** El cable en curso, el objetivo y los conflictos. */
export function dibujarCableEnCurso(r: Renderer, info: InfoDinamico, d: DibujoCableEnCurso): void {
  const g = grosorLinea(info.escala);
  const acento = info.colores.acento;
  const aviso = info.colores.aviso ?? info.colores.borne;
  const color = d.valido ? acento : aviso;
  const p = d.puntos;
  if (p && p.length >= 4) {
    let n = 0;
    if (d.valido) {
      for (let i = 0; i + 3 < p.length; i += 2, n++) {
        segmentos[n * 4] = p[i]!;
        segmentos[n * 4 + 1] = p[i + 1]!;
        segmentos[n * 4 + 2] = p[i + 2]!;
        segmentos[n * 4 + 3] = p[i + 3]!;
      }
    } else {
      n = anotarRayas(p, info.visible, RAYA_PX / info.escala, 0);
    }
    if (n > 0) {
      r.estilo({ trazo: color, relleno: color, grosor: 2 * g });
      r.lineas(segmentos, n);
    }
  }

  r.estilo({ trazo: color, relleno: color, grosor: 1.5 * g });
  for (let i = 0; i + 1 < d.libres.length; i += 2) r.circulo(d.libres[i]!, d.libres[i + 1]!, RADIO_LIBRE);

  const o = d.objetivo;
  if (o) {
    if (o.tipo === "borne") {
      r.circulo(o.x, o.y, 0.45);
    } else if (o.tipo === "cable") {
      const s = 0.45;
      r.linea(o.x - s, o.y, o.x, o.y - s);
      r.linea(o.x, o.y - s, o.x + s, o.y);
      r.linea(o.x + s, o.y, o.x, o.y + s);
      r.linea(o.x, o.y + s, o.x - s, o.y);
    } else if (o.tipo === "vacio") {
      const s = 0.25;
      r.linea(o.x - s, o.y, o.x + s, o.y);
      r.linea(o.x, o.y - s, o.x, o.y + s);
    }
  }

  dibujarCruces(r, info, d.conflictos);
}

/** Una ✕ en `--aviso` en cada conflicto. */
export function dibujarCruces(r: Renderer, info: InfoDinamico, conflictos: readonly { x: number; y: number }[]): void {
  if (conflictos.length === 0) return;
  const aviso = info.colores.aviso ?? info.colores.borne;
  const s = 0.35;
  r.estilo({ trazo: aviso, relleno: aviso, grosor: 2 * grosorLinea(info.escala) });
  for (const c of conflictos) {
    r.linea(c.x - s, c.y - s, c.x + s, c.y + s);
    r.linea(c.x - s, c.y + s, c.x + s, c.y - s);
  }
}

/** Lo que dibuja la vista previa de los cables de un arrastre (T14a). */
export interface DibujoCablesArrastre {
  /** Tramos que valen, ya anotados (x0, y0, x1, y1 seguidos) y cuántos son. */
  tramos: readonly number[];
  cantidad: number;
  /** Recorridos con un conflicto: a rayas en `--aviso`. */
  invalidos: readonly (readonly number[])[];
  /** Modo reducido: gomas rectas de la parte fija al extremo movido (x0, y0, x1, y1 seguidos). */
  gomas: readonly number[];
  /** Extremos libres (x, y seguidos). */
  libres: readonly number[];
  conflictos: readonly { x: number; y: number }[];
}

/**
 * Los cables de un arrastre en la capa dinámica, con los colores de la capa
 * estática (son lo que se va a ver al soltar), salvo lo inválido.
 */
export function dibujarCablesArrastre(r: Renderer, info: InfoDinamico, d: DibujoCablesArrastre): void {
  const g = grosorLinea(info.escala);
  const v = info.visible;
  const simbolo = info.colores.simbolo;
  if (d.cantidad > 0) {
    r.estilo({ trazo: simbolo, relleno: simbolo, grosor: g });
    r.lineas(d.tramos, d.cantidad);
  }
  // Gomas: rectas (pueden ir en diagonal), a trazos.
  let n = 0;
  const raya = RAYA_PX / info.escala;
  for (let i = 0; i + 3 < d.gomas.length; i += 4) {
    const x0 = d.gomas[i]!;
    const y0 = d.gomas[i + 1]!;
    const dx = d.gomas[i + 2]! - x0;
    const dy = d.gomas[i + 3]! - y0;
    const largo = Math.hypot(dx, dy);
    for (let t = 0; t < largo; t += 2 * raya) {
      const e = Math.min(t + raya, largo);
      segmentos[n * 4] = x0 + (dx * t) / largo;
      segmentos[n * 4 + 1] = y0 + (dy * t) / largo;
      segmentos[n * 4 + 2] = x0 + (dx * e) / largo;
      segmentos[n * 4 + 3] = y0 + (dy * e) / largo;
      n++;
    }
  }
  if (n > 0) {
    r.estilo({ trazo: simbolo, relleno: simbolo, grosor: g });
    r.lineas(segmentos, n);
  }
  n = 0;
  for (const p of d.invalidos) n = anotarRayas(p, v, raya, n);
  if (n > 0) {
    const aviso = info.colores.aviso ?? info.colores.borne;
    r.estilo({ trazo: aviso, relleno: aviso, grosor: 2 * g });
    r.lineas(segmentos, n);
  }
  if (d.libres.length > 0) {
    r.estilo({ trazo: info.colores.borne, relleno: info.colores.borne, grosor: g });
    for (let i = 0; i + 1 < d.libres.length; i += 2) r.circulo(d.libres[i]!, d.libres[i + 1]!, RADIO_LIBRE);
  }
  dibujarCruces(r, info, d.conflictos);
}
