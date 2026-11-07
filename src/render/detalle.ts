// Nivel de detalle: con zoom muy alejado, los textos y las marcas de bornes
// quedan de pocos píxeles. No se leen, ensucian el dibujo y son lo más caro de
// dibujar (cada texto es un fillText), así que se omiten.

/**
 * Escala mínima (px CSS por unidad de grilla) para dibujar textos. Debajo de
 * esto, el nombre de un borne (0,7 unidades) mide menos de 4 px: ilegible.
 */
export const ESCALA_MIN_TEXTOS = 6;

/** Escala mínima para las marcas de bornes: debajo, el punto mide menos de 2 px. */
export const ESCALA_MIN_BORNES = 6;

export interface Detalle {
  /** Etiquetas, nombres de bornes y textos propios de los símbolos. */
  textos: boolean;
  /** Marcas de los puntos de conexión. */
  bornes: boolean;
}

/** Todo el detalle, sin importar el zoom (PDF, SVG o comparación). */
export const DETALLE_COMPLETO: Readonly<Detalle> = { textos: true, bornes: true };

/** Qué se dibuja a una escala dada (px CSS por unidad de grilla). */
export function nivelDetalle(escala: number): Detalle {
  return { textos: escala >= ESCALA_MIN_TEXTOS, bornes: escala >= ESCALA_MIN_BORNES };
}
