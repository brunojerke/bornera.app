// Falsos para los tests: Node no tiene canvas. Un contexto 2D que anota cada
// llamada y cada asignación, y un Path2D que anota sus figuras.
// Solo lo importan los tests (no llega al build de la app).

import type { CrearContexto } from "./capas";

export interface ContextoFalso {
  ctx: CanvasRenderingContext2D;
  /** El canvas: solo tamaño. */
  canvas: { width: number; height: number };
  /** Métodos llamados ([nombre, ...args]) y asignaciones (["=propiedad", valor]), en orden. */
  llamadas: unknown[][];
}

/** Ancho de letra de los textos falsos, en px con la fuente de 100 px. */
export const ANCHO_LETRA_FALSA = 60;

/**
 * Contexto 2D falso. `measureText` mide ANCHO_LETRA_FALSA por letra y 40 px
 * hacia arriba y hacia abajo del centro (con la fuente de 100 px).
 * `alLlamar` se avisa de cada método llamado (para simular lo que tarda).
 */
export function contextoFalso(ancho = 0, alto = 0, alLlamar?: (nombre: string) => void): ContextoFalso {
  const llamadas: unknown[][] = [];
  const canvas = { width: ancho, height: alto };
  const propiedades: Record<string, unknown> = {};
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (_, nombre) => {
      if (nombre === "canvas") return canvas;
      if (typeof nombre === "string" && nombre in propiedades) return propiedades[nombre];
      if (nombre === "measureText") {
        return (texto: string) => {
          const w = texto.length * ANCHO_LETRA_FALSA;
          return {
            width: w,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: w,
            actualBoundingBoxAscent: 40,
            actualBoundingBoxDescent: 40,
          };
        };
      }
      return (...args: unknown[]) => {
        llamadas.push([nombre, ...args]);
        alLlamar?.(String(nombre));
      };
    },
    set: (_, nombre, valor) => {
      propiedades[String(nombre)] = valor;
      llamadas.push(["=" + String(nombre), valor]);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, canvas, llamadas };
}

/** Fábrica de contextos falsos que recuerda los que creó, opacos y transparentes. */
export function fabricaFalsa(): { crear: CrearContexto; opacos: ContextoFalso[]; transparentes: ContextoFalso[] } {
  const opacos: ContextoFalso[] = [];
  const transparentes: ContextoFalso[] = [];
  const crear: CrearContexto = (transparente) => {
    const c = contextoFalso();
    (transparente ? transparentes : opacos).push(c);
    return c.ctx;
  };
  return { crear, opacos, transparentes };
}

/** Path2D falso: anota las figuras. Se instala con vi.stubGlobal("Path2D", Path2DFalso). */
export class Path2DFalso {
  readonly llamadas: unknown[][] = [];
  rect(...args: unknown[]) {
    this.llamadas.push(["rect", ...args]);
  }
  moveTo(...args: unknown[]) {
    this.llamadas.push(["moveTo", ...args]);
  }
  lineTo(...args: unknown[]) {
    this.llamadas.push(["lineTo", ...args]);
  }
  arc(...args: unknown[]) {
    this.llamadas.push(["arc", ...args]);
  }
}

/** Llamadas a un método, sin el nombre. */
export function llamadasA(llamadas: unknown[][], nombre: string): unknown[][] {
  return llamadas.filter((l) => l[0] === nombre).map((l) => l.slice(1));
}
