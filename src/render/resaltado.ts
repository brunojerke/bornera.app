// Resaltado de la selección en la capa dinámica: un rectángulo de acento
// alrededor de cada elemento seleccionado que está en pantalla, y el
// rectángulo de selección mientras se arrastra.
//
// La capa dinámica se dibuja en cada cuadro (también al desplazar la vista):
// por eso no se vuelven a dibujar los símbolos, solo rectángulos, y solo los
// que tocan la pantalla. Con 2000 seleccionados son 2000 comparaciones de
// cajas y unos pocos trazos.

import type { Caja } from "./camara";
import type { InfoDinamico } from "./capas";
import { grosorLinea } from "./escena";
import type { EscenaEditable, ModoRectangulo } from "./escenaEditable";
import type { Renderer } from "./renderer";

/** Separación entre el elemento y su recuadro de selección, en unidades. */
export const MARGEN_RESALTADO = 0.3;
/** Largo de cada raya del rectángulo "toca", en px de pantalla. */
const RAYA_PX = 5;

/** Un rectángulo de selección en curso, de la esquina donde se apretó a la del mouse. */
export interface RectanguloSeleccion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  modo: ModoRectangulo;
}

/** La caja del rectángulo, con ancho y alto positivos. */
export function cajaRectangulo(r: RectanguloSeleccion): Caja {
  return {
    x: Math.min(r.x0, r.x1),
    y: Math.min(r.y0, r.y1),
    ancho: Math.abs(r.x1 - r.x0),
    alto: Math.abs(r.y1 - r.y0),
  };
}

/** Recuadros del cuadro en curso (x, y, ancho, alto seguidos): se reusa para no pedir memoria. */
const recuadros: number[] = [];

/**
 * Dibuja el recuadro de cada seleccionado visible, todos en un solo trazo.
 * Devuelve cuántos dibujó.
 */
export function dibujarSeleccion(
  r: Renderer,
  info: InfoDinamico,
  escena: EscenaEditable,
  ids: Iterable<string>,
): number {
  const v = info.visible;
  const m = MARGEN_RESALTADO;
  let n = 0;
  for (const id of ids) {
    const k = escena.contorno(id);
    // Visible, contando el margen (como seTocan, pero sin armar otra caja).
    if (!k || k.x - m > v.x + v.ancho || k.x + k.ancho + m < v.x || k.y - m > v.y + v.alto || k.y + k.alto + m < v.y) {
      continue;
    }
    const j = n * 4;
    recuadros[j] = k.x - m;
    recuadros[j + 1] = k.y - m;
    recuadros[j + 2] = k.ancho + 2 * m;
    recuadros[j + 3] = k.alto + 2 * m;
    n++;
  }
  if (n === 0) return 0;
  const color = info.colores.acento;
  r.estilo({ trazo: color, relleno: color, grosor: 1.5 * grosorLinea(info.escala) });
  r.rectangulos(recuadros, n);
  return n;
}

/**
 * Dibuja el rectángulo de selección: continuo si es "contiene", a rayas si es
 * "toca" (como en los programas de CAD). Las rayas se hacen con líneas, porque
 * el Renderer no tiene trazos punteados.
 */
export function dibujarRectangulo(r: Renderer, info: InfoDinamico, rect: RectanguloSeleccion): void {
  const k = cajaRectangulo(rect);
  const color = info.colores.acento;
  r.estilo({ trazo: color, relleno: color, grosor: grosorLinea(info.escala) });
  if (rect.modo === "contiene") {
    r.rectangulo(k.x, k.y, k.ancho, k.alto);
    return;
  }
  // Solo la parte visible: un rectángulo enorme no tiene que dar miles de rayas.
  const v = info.visible;
  const raya = RAYA_PX / info.escala;
  const x1 = k.x + k.ancho;
  const y1 = k.y + k.alto;
  rayasHorizontales(r, k.y, Math.max(k.x, v.x), Math.min(x1, v.x + v.ancho), raya, v);
  rayasHorizontales(r, y1, Math.max(k.x, v.x), Math.min(x1, v.x + v.ancho), raya, v);
  rayasVerticales(r, k.x, Math.max(k.y, v.y), Math.min(y1, v.y + v.alto), raya, v);
  rayasVerticales(r, x1, Math.max(k.y, v.y), Math.min(y1, v.y + v.alto), raya, v);
}

/** Rayas sobre la recta y = `y`, de `desde` a `hasta`. Raya y hueco miden `raya`. */
function rayasHorizontales(r: Renderer, y: number, desde: number, hasta: number, raya: number, v: Caja): void {
  if (y < v.y || y > v.y + v.alto) return;
  // Alineadas a múltiplos de 2·raya: al desplazar la vista, las rayas no "caminan".
  for (let x = Math.floor(desde / (2 * raya)) * 2 * raya; x < hasta; x += 2 * raya) {
    const a = Math.max(x, desde);
    const b = Math.min(x + raya, hasta);
    if (b > a) r.linea(a, y, b, y);
  }
}

function rayasVerticales(r: Renderer, x: number, desde: number, hasta: number, raya: number, v: Caja): void {
  if (x < v.x || x > v.x + v.ancho) return;
  for (let y = Math.floor(desde / (2 * raya)) * 2 * raya; y < hasta; y += 2 * raya) {
    const a = Math.max(y, desde);
    const b = Math.min(y + raya, hasta);
    if (b > a) r.linea(x, a, x, b);
  }
}
