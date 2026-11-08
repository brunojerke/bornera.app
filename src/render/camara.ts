// Cámara del lienzo: qué parte de la grilla se ve y con cuánto zoom.
// Pantalla = píxeles CSS relativos a la esquina superior izquierda del lienzo
// (el devicePixelRatio lo aplica la vista, no la cámara). Sin dependencias del DOM.

/** Píxeles CSS por unidad de grilla con zoom 100 %. */
export const PX_POR_UNIDAD = 20;

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;

/** Rectángulo en unidades de grilla. */
export interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface Punto {
  x: number;
  y: number;
}

/** True si las dos cajas se tocan (compartir solo un borde cuenta). */
export function seTocan(a: Caja, b: Caja): boolean {
  return a.x <= b.x + b.ancho && b.x <= a.x + a.ancho && a.y <= b.y + b.alto && b.y <= a.y + a.alto;
}

/** Caja que contiene a las dos. */
export function unirCajas(a: Caja, b: Caja): Caja {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    ancho: Math.max(a.x + a.ancho, b.x + b.ancho) - x,
    alto: Math.max(a.y + a.alto, b.y + b.alto) - y,
  };
}

/** La caja agrandada `margen` unidades hacia cada lado. */
export function ampliarCaja(c: Caja, margen: number): Caja {
  return { x: c.x - margen, y: c.y - margen, ancho: c.ancho + 2 * margen, alto: c.alto + 2 * margen };
}

export function limitarZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

export class Camara {
  /** Punto de la grilla que cae en la esquina superior izquierda de la pantalla. */
  x = 0;
  y = 0;
  /** 1 = 100 %. */
  zoom = 1;

  /** Píxeles CSS por unidad de grilla. */
  get escala(): number {
    return PX_POR_UNIDAD * this.zoom;
  }

  aGrilla(px: number, py: number): Punto {
    const e = this.escala;
    return { x: this.x + px / e, y: this.y + py / e };
  }

  aPantalla(gx: number, gy: number): Punto {
    const e = this.escala;
    return { x: (gx - this.x) * e, y: (gy - this.y) * e };
  }

  /**
   * Cambia el zoom (con límites) dejando quieto el punto de grilla que está
   * bajo (px, py). Devuelve true si el zoom cambió.
   */
  zoomEn(zoom: number, px: number, py: number): boolean {
    const nuevo = limitarZoom(zoom);
    if (nuevo === this.zoom) return false;
    const ancla = this.aGrilla(px, py);
    this.zoom = nuevo;
    const e = this.escala;
    this.x = ancla.x - px / e;
    this.y = ancla.y - py / e;
    return true;
  }

  /** Mueve el contenido (dx, dy) píxeles, como si se lo arrastrara. */
  desplazar(dx: number, dy: number): void {
    const e = this.escala;
    this.x -= dx / e;
    this.y -= dy / e;
  }

  /** Pone el punto de grilla (gx, gy) en el centro de una pantalla de ancho×alto. */
  centrar(gx: number, gy: number, ancho: number, alto: number): void {
    const e = this.escala;
    this.x = gx - ancho / 2 / e;
    this.y = gy - alto / 2 / e;
  }

  /**
   * La pantalla cambió de tamaño: la esquina superior izquierda queda fija,
   * así nada se corre bajo el mouse. Casi siempre cambia por un panel que se
   * abre o se cierra a la derecha (el de propiedades, al seleccionar): si se
   * mantuviera el centro, todo saltaría media anchura del panel en medio de un
   * clic o de un arrastre. (Hasta T9 mantenía el centro.)
   */
  redimensionar(_anchoAntes: number, _altoAntes: number, _ancho: number, _alto: number): void {
    // La cámara guarda la esquina (x, y): no hay nada que cambiar.
  }

  /** Ajusta zoom y posición para que la caja entre entera, con un margen en píxeles. */
  encuadrar(caja: Caja, ancho: number, alto: number, margen = 40): void {
    const util = { ancho: Math.max(1, ancho - 2 * margen), alto: Math.max(1, alto - 2 * margen) };
    const zx = caja.ancho > 0 ? util.ancho / (caja.ancho * PX_POR_UNIDAD) : Infinity;
    const zy = caja.alto > 0 ? util.alto / (caja.alto * PX_POR_UNIDAD) : Infinity;
    const z = Math.min(zx, zy);
    // Caja sin tamaño (un solo punto): se centra sin cambiar el zoom.
    if (Number.isFinite(z)) this.zoom = limitarZoom(z);
    this.centrar(caja.x + caja.ancho / 2, caja.y + caja.alto / 2, ancho, alto);
  }

  /** Parte de la grilla visible en una pantalla de ancho×alto. */
  visible(ancho: number, alto: number): Caja {
    const e = this.escala;
    return { x: this.x, y: this.y, ancho: ancho / e, alto: alto / e };
  }
}
