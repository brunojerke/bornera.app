// Objetivo bajo el cursor (T13, compartido desde T14c): qué hay en un punto
// para terminar un cable. Lo usan la herramienta cable (W) y reconectar un
// extremo libre (Seleccionar), con la misma regla: sobre el punto de grilla
// redondeado y con la prioridad borne > cable > vacío. Así nunca queda un codo
// ni un extremo libre sobre un borne o un cable.
//
// Para dejar afuera un cable (el que se reconecta), se pasa la consulta sin
// él (`consultaSinCable`).

import { MENSAJE_CRUCE, MENSAJE_EXTREMO_SUELTO, terminaEnTSobre, tocaRecorrido, type BorneHoja, type ConsultaTrazado } from "../core/model/trazado";

/** Distancia, en px CSS, a la que un borne todavía se agarra (alejado; ver `radioBorne`). */
export const TOLERANCIA_BORNE_PX = 8;

/**
 * Radio para agarrar un borne, en unidades (distancia de Chebyshev): 8 px,
 * pero nunca menos de 0,5 (cubre la celda del redondeo: un punto de grilla
 * sobre un borne siempre es ese borne) ni más de 0,9 (dos bornes vecinos
 * están a 1).
 */
export function radioBorne(escala: number): number {
  return Math.min(Math.max(TOLERANCIA_BORNE_PX / escala, 0.5), 0.9);
}

/** Qué hay bajo el cursor, en un punto entero. */
export type Objetivo =
  | { tipo: "borne"; x: number; y: number; borne: BorneHoja }
  | { tipo: "cable"; x: number; y: number; cable: string }
  | { tipo: "vacio"; x: number; y: number }
  | { tipo: "bloqueado"; x: number; y: number; mensaje: string };

/**
 * Qué hay en (x, y): el borne más cercano a distancia de Chebyshev ≤
 * `radioBorne` (el de arriba si empatan); si no, un cable en el punto de
 * grilla (bloqueado sobre un extremo suelto o un cruce sin unión); si no,
 * vacío.
 */
export function objetivoEn(c: ConsultaTrazado, x: number, y: number, escala: number): Objetivo {
  const radio = radioBorne(escala);
  let mejor: BorneHoja | null = null;
  let distancia = Infinity;
  for (const b of c.bornesEn({ x: x - radio, y: y - radio, ancho: 2 * radio, alto: 2 * radio })) {
    const d = Math.max(Math.abs(b.x - x), Math.abs(b.y - y));
    // `<=`: con empate gana el último, el que se dibuja arriba.
    if (d <= radio && d <= distancia) {
      mejor = b;
      distancia = d;
    }
  }
  if (mejor) return { tipo: "borne", x: mejor.x, y: mejor.y, borne: mejor };

  const gx = Math.round(x) || 0;
  const gy = Math.round(y) || 0;
  const punto = { x: gx, y: gy, ancho: 0, alto: 0 };
  const ahi = [...c.cablesEn(punto)].filter((w) => tocaRecorrido(w.puntos, punto));
  if (ahi.length === 0) return { tipo: "vacio", x: gx, y: gy };
  for (const w of ahi) {
    const m = w.puntos.length;
    const suelto =
      (w.desde.tipo === "libre" && w.puntos[0] === gx && w.puntos[1] === gy) ||
      (w.hasta.tipo === "libre" && w.puntos[m - 2] === gx && w.puntos[m - 1] === gy);
    if (suelto) return { tipo: "bloqueado", x: gx, y: gy, mensaje: MENSAJE_EXTREMO_SUELTO };
  }
  // El anfitrión: el que pasa por el punto sin terminar ahí en T (el de arriba, si hay varios).
  const terminaEnT = (w: (typeof ahi)[number]) => [w.desde, w.hasta].some((e) => e.tipo === "cable" && e.x === gx && e.y === gy);
  let anfitrion = ahi[ahi.length - 1]!;
  for (let i = ahi.length - 1; i >= 0; i--) {
    if (!terminaEnT(ahi[i]!)) {
      anfitrion = ahi[i]!;
      break;
    }
  }
  for (const w of ahi) {
    if (w === anfitrion) continue;
    if (!terminaEnTSobre(w, anfitrion.id, gx, gy) && !terminaEnTSobre(anfitrion, w.id, gx, gy)) {
      return { tipo: "bloqueado", x: gx, y: gy, mensaje: MENSAJE_CRUCE };
    }
  }
  return { tipo: "cable", x: gx, y: gy, cable: anfitrion.id };
}
