// Dibujo de un símbolo colocado: posición, rotación, espejado, nombres de
// bornes y etiqueta (S1, K1, H1). Funciona con cualquier Renderer.
// La geometría gira y se espeja con el símbolo; los textos no: quedan siempre
// derechos y legibles, en la posición transformada.

import {
  transformarBornes,
  transformarDireccion,
  transformarPunto,
  type DefinicionSimbolo,
  type Direccion,
  type Texto,
  type Transformacion,
} from "../core/symbols";
import type { Caja } from "./camara";
import type { Alineacion, Renderer } from "./renderer";

/** Dónde y cómo está puesto un símbolo, en unidades de grilla. */
export interface Colocacion extends Transformacion {
  x: number;
  y: number;
}

export interface OpcionesSimbolo {
  /** Designación del componente: "S1", "K1", "H1". */
  etiqueta?: string;
  /** Escribe el nombre de cada borne (13, 14, A1…) junto a su conexión. Por defecto, sí. */
  nombresBornes?: boolean;
  /**
   * Dibuja textos (propios del símbolo, nombres de bornes y etiqueta). Por
   * defecto, sí; con zoom muy alejado se apagan todos de una vez.
   */
  textos?: boolean;
}

/** Alto de la letra de la etiqueta: 2,5 mm. */
export const ALTO_ETIQUETA = 1;
/** Alto de la letra de los bornes: 1,75 mm. */
export const ALTO_BORNE = 0.7;
/** Separación del nombre de un borne a una conexión horizontal (centro del texto). */
const SEPARACION_NOMBRE_Y = 0.6;
/** Separación del nombre de un borne a una conexión vertical (borde del texto). */
const SEPARACION_NOMBRE_X = 0.25;
/** Separación entre la caja del símbolo y su etiqueta. */
const MARGEN_ETIQUETA = 0.5;

/** Caja que ocupa el símbolo colocado (la rotación de 90° o 270° la traspone). */
export function cajaSimbolo(def: DefinicionSimbolo, c: Colocacion): Caja {
  const girado = c.rotacion === 90 || c.rotacion === 270;
  const ancho = girado ? def.tamano.alto : def.tamano.ancho;
  const alto = girado ? def.tamano.ancho : def.tamano.alto;
  return { x: c.x - ancho / 2, y: c.y - alto / 2, ancho, alto };
}

/** Ancho de letra promedio de Helvetica, generoso, en altos de letra. */
const ANCHO_LETRA = 0.7;

/**
 * Lo que sobresalen de la caja del símbolo los nombres de bornes y el grosor
 * del trazo. Un borne está en el borde de la caja y su nombre va medio paso
 * adentro, corrido a un costado: con 1,5 unidades sobra para nombres cortos.
 */
const MARGEN_TEXTOS = 1.5;

/** Ancho aproximado (por exceso) de un texto de `alto` unidades. */
export function anchoTexto(texto: string, alto: number): number {
  return texto.length * alto * ANCHO_LETRA;
}

/**
 * Caja que ocupa todo lo que se dibuja de un símbolo colocado: geometría,
 * nombres de bornes y etiqueta. Es aproximada pero nunca se queda corta;
 * sirve para el recorte por vista (lo que no la toca, no se dibuja).
 */
export function cajaDibujo(def: DefinicionSimbolo, c: Colocacion, etiqueta?: string): Caja {
  const s = cajaSimbolo(def, c);
  let x0 = s.x - MARGEN_TEXTOS;
  let y0 = s.y - MARGEN_TEXTOS;
  const x1 = s.x + s.ancho + MARGEN_TEXTOS;
  const y1 = s.y + s.alto + MARGEN_TEXTOS;
  if (etiqueta) {
    const e = posicionEtiqueta(def, c);
    const ancho = anchoTexto(etiqueta, ALTO_ETIQUETA);
    // Derecha: el texto termina en e.x. Centro: se reparte a los dos lados.
    const izquierda = c.x + e.x - (e.alineacion === "derecha" ? ancho : ancho / 2);
    x0 = Math.min(x0, izquierda);
    y0 = Math.min(y0, c.y + e.y - ALTO_ETIQUETA);
  }
  return { x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 };
}

/** Largo del trazo que marca hacia dónde sale el cable de un borne. */
const LARGO_MARCA = 0.8;
/** Radio del punto de conexión. */
const RADIO_MARCA = 0.18;

/**
 * Marca cada borne: un punto en su posición y un trazo hacia donde sale el
 * cable. Usa el trazo y el relleno actuales.
 */
export function dibujarMarcasBornes(r: Renderer, def: DefinicionSimbolo, c: Colocacion): void {
  for (const b of transformarBornes(def.bornes, c)) {
    const bx = c.x + b.x;
    const by = c.y + b.y;
    const [vx, vy] = HACIA_AFUERA[b.direccion];
    r.linea(bx, by, bx + vx * LARGO_MARCA, by + vy * LARGO_MARCA);
    r.circulo(bx, by, RADIO_MARCA, true);
  }
}

/**
 * Posición de la etiqueta, relativa al centro del símbolo. Los símbolos se
 * definen verticales: derechos (0° o 180°) llevan la etiqueta a la izquierda,
 * como en un esquema IEC; acostados (90° o 270°), arriba.
 */
export function posicionEtiqueta(
  def: DefinicionSimbolo,
  t: Transformacion,
): { x: number; y: number; alineacion: Alineacion } {
  if (t.rotacion === 0 || t.rotacion === 180) {
    return { x: -def.tamano.ancho / 2 - MARGEN_ETIQUETA, y: 0, alineacion: "derecha" };
  }
  return { x: 0, y: -def.tamano.ancho / 2 - MARGEN_ETIQUETA - ALTO_ETIQUETA / 2, alineacion: "centro" };
}

const HACIA_AFUERA: Record<Direccion, readonly [number, number]> = {
  derecha: [1, 0],
  abajo: [0, 1],
  izquierda: [-1, 0],
  arriba: [0, -1],
};

/**
 * Posición del nombre de un borne ya transformado, relativa al centro del símbolo:
 * medio paso hacia adentro sobre la conexión, corrido hacia `lado` (ya en
 * coordenadas de la hoja). Si `lado` es paralelo a la conexión no sirve
 * (el texto caería sobre la línea): se usa izquierda o arriba.
 */
export function posicionNombreBorne(
  x: number,
  y: number,
  direccion: Direccion,
  lado: Direccion = "izquierda",
): { x: number; y: number; alineacion: Alineacion } {
  const [vx, vy] = HACIA_AFUERA[direccion];
  const ax = x - vx * 0.5;
  const ay = y - vy * 0.5;
  let [lx, ly] = HACIA_AFUERA[lado];
  if (lx * vx + ly * vy !== 0) [lx, ly] = vx === 0 ? [-1, 0] : [0, -1];
  if (lx !== 0) {
    return { x: ax + lx * SEPARACION_NOMBRE_X, y: ay, alineacion: lx < 0 ? "derecha" : "izquierda" };
  }
  return { x: ax, y: ay + ly * SEPARACION_NOMBRE_Y, alineacion: "centro" };
}

/** Alineación de un texto propio del símbolo después de transformarlo. */
function alinearTexto(p: Texto, t: Transformacion): Alineacion {
  const a = p.alineacion ?? "izquierda";
  if (a === "centro") return a;
  if (t.rotacion === 90 || t.rotacion === 270) return "centro";
  const invertir = t.espejado !== (t.rotacion === 180);
  if (!invertir) return a;
  return a === "izquierda" ? "derecha" : "izquierda";
}

/**
 * Dibuja un símbolo colocado. El estilo (color, grosor) lo pone quien llama;
 * los textos usan el color de relleno actual.
 */
export function dibujarSimbolo(
  r: Renderer,
  def: DefinicionSimbolo,
  c: Colocacion,
  opciones: OpcionesSimbolo = {},
): void {
  // Geometría: el Renderer aplica primero el espejado y después la rotación,
  // igual que transformarPunto (la última transformación pedida es la primera aplicada).
  r.guardar();
  r.trasladar(c.x, c.y);
  if (c.rotacion !== 0) r.rotar(c.rotacion);
  if (c.espejado) r.escalar(-1, 1);
  r.simbolo(def);
  r.restaurar();

  if (opciones.textos === false) return;

  // Textos propios del símbolo, derechos.
  for (const p of def.primitivas) {
    if (p.forma !== "texto") continue;
    const q = transformarPunto(p.x, p.y, c);
    r.texto(c.x + q.x, c.y + q.y, p.texto, p.alto, alinearTexto(p, c));
  }

  if (opciones.nombresBornes ?? true) {
    const lado = transformarDireccion(def.ladoNombresBornes ?? "izquierda", c);
    for (const b of transformarBornes(def.bornes, c)) {
      const n = posicionNombreBorne(b.x, b.y, b.direccion, lado);
      r.texto(c.x + n.x, c.y + n.y, b.nombre, ALTO_BORNE, n.alineacion);
    }
  }

  if (opciones.etiqueta) {
    const e = posicionEtiqueta(def, c);
    r.texto(c.x + e.x, c.y + e.y, opciones.etiqueta, ALTO_ETIQUETA, e.alineacion);
  }
}
