// Interfaz de dibujo única. Pantalla (Canvas), SVG y PDF la implementan, así
// cada símbolo se dibuja una sola vez en código y sale igual en los tres.
// Las coordenadas son las del sistema actual (normalmente unidades de grilla);
// la transformación a píxeles o milímetros la pone quien crea el Renderer.

import type { DefinicionSimbolo, Primitiva } from "../core/symbols";

export type Alineacion = "izquierda" | "centro" | "derecha";

export interface Estilo {
  /** Color del trazo (líneas, arcos y contornos). */
  trazo?: string;
  /** Color de relleno (figuras con `relleno`) y de los textos. */
  relleno?: string;
  /** Grosor de línea en unidades del sistema actual. */
  grosor?: number;
}

export interface Renderer {
  /** Cambia solo los campos indicados; el resto queda como estaba. */
  estilo(e: Estilo): void;

  linea(x1: number, y1: number, x2: number, y2: number): void;
  /** Ángulos en grados, sentido horario (y crece hacia abajo), de `desde` a `hasta`. */
  arco(cx: number, cy: number, r: number, desde: number, hasta: number): void;
  circulo(cx: number, cy: number, r: number, relleno?: boolean): void;
  rectangulo(x: number, y: number, ancho: number, alto: number, relleno?: boolean): void;
  /** `y` es el centro vertical del texto; `alto` es el alto de la letra. */
  texto(x: number, y: number, texto: string, alto: number, alineacion?: Alineacion): void;
  /**
   * Dibuja la geometría de un símbolo (todas sus primitivas menos los textos)
   * en el sistema actual. Puede cachear por definición: las definiciones no cambian.
   */
  simbolo(def: DefinicionSimbolo): void;

  /** Guarda transformación y estilo actuales. */
  guardar(): void;
  /** Vuelve a lo último guardado. */
  restaurar(): void;
  trasladar(dx: number, dy: number): void;
  escalar(sx: number, sy?: number): void;
  /** Rotación en grados, sentido horario. */
  rotar(grados: number): void;
}

/** Dibuja una primitiva de símbolo con cualquier Renderer. */
export function dibujarPrimitiva(r: Renderer, p: Primitiva): void {
  switch (p.forma) {
    case "linea":
      r.linea(p.x1, p.y1, p.x2, p.y2);
      break;
    case "arco":
      r.arco(p.cx, p.cy, p.r, p.desde, p.hasta);
      break;
    case "circulo":
      r.circulo(p.cx, p.cy, p.r, p.relleno ?? false);
      break;
    case "rectangulo":
      r.rectangulo(p.x, p.y, p.ancho, p.alto, p.relleno ?? false);
      break;
    case "texto":
      r.texto(p.x, p.y, p.texto, p.alto, p.alineacion ?? "izquierda");
      break;
  }
}

/** Geometría de un símbolo primitiva por primitiva, sin textos ni caché. */
export function dibujarGeometria(r: Renderer, def: DefinicionSimbolo): void {
  for (const p of def.primitivas) {
    if (p.forma !== "texto") dibujarPrimitiva(r, p);
  }
}
