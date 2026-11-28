// Nombres de bornes contra el dibujo (C1 de la biblioteca 2): en los 49 símbolos,
// en reposo y accionados, la caja aproximada del nombre de cada borne queda a
// 0,1 de grilla o más de toda primitiva que no sea su propia conexión.
//
// - La caja del nombre sale de `posicionNombreBorne`, con un ancho medio de letra
//   (no el máximo de `cajaDibujo`) y el alto de las mayúsculas: lo que se ve.
// - La conexión del borne (la línea que pasa por el borne o la vertical u
//   horizontal que pasa por el punto de anclaje del nombre) no cuenta: el nombre va
//   a su lado a propósito (`SEPARACION_NOMBRE_X`).
// - Círculos y arcos, como polígonos de 72 lados; los textos propios del símbolo,
//   como su caja.
import { describe, expect, it } from "vitest";
import { SIMBOLOS } from "../core/symbols";
import type { Borne, DefinicionSimbolo, Primitiva } from "../core/symbols/tipos";
import { ALTO_BORNE, posicionNombreBorne } from "./simbolo";

/** Distancia mínima de un nombre de borne al dibujo, en unidades de grilla. */
const MINIMO = 0.1;
/** Ancho medio de una letra y alto de las mayúsculas, en altos de letra. */
const ANCHO_MEDIO = 0.62;
const ALTO_MAYUSCULA = 0.75;

type Segmento = [number, number, number, number];
interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

function cajaASegmentos({ x, y, w, h }: Caja): Segmento[] {
  return [
    [x, y, x + w, y],
    [x + w, y, x + w, y + h],
    [x + w, y + h, x, y + h],
    [x, y + h, x, y],
  ];
}

function segmentos(p: Primitiva): Segmento[] {
  switch (p.forma) {
    case "linea":
      return [[p.x1, p.y1, p.x2, p.y2]];
    case "rectangulo":
      return cajaASegmentos({ x: p.x, y: p.y, w: p.ancho, h: p.alto });
    case "circulo":
    case "arco": {
      const desde = p.forma === "arco" ? p.desde : 0;
      const barrido = p.forma === "arco" ? ((((p.hasta - p.desde) % 360) + 360) % 360 || 360) : 360;
      const n = 72;
      const punto = (i: number): [number, number] => {
        const a = ((desde + (barrido * i) / n) * Math.PI) / 180;
        return [p.cx + p.r * Math.cos(a), p.cy + p.r * Math.sin(a)];
      };
      return Array.from({ length: n }, (_, i) => [...punto(i), ...punto(i + 1)] as Segmento);
    }
    case "texto": {
      const w = p.texto.length * p.alto * ANCHO_MEDIO;
      const x = p.alineacion === "centro" ? p.x - w / 2 : p.alineacion === "derecha" ? p.x - w : p.x;
      return cajaASegmentos({ x, y: p.y - p.alto / 2, w, h: p.alto });
    }
  }
}

const distanciaPuntoSegmento = (px: number, py: number, [x1, y1, x2, y2]: Segmento): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l = dx * dx + dy * dy;
  const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

/** Distancia de una caja a un segmento (0 si se tocan), muestreando el segmento. */
function distanciaCajaSegmento(c: Caja, s: Segmento): number {
  let m = Infinity;
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const px = s[0] + t * (s[2] - s[0]);
    const py = s[1] + t * (s[3] - s[1]);
    const dx = Math.max(c.x - px, 0, px - (c.x + c.w));
    const dy = Math.max(c.y - py, 0, py - (c.y + c.h));
    m = Math.min(m, Math.hypot(dx, dy));
  }
  return m;
}

/** La caja visible del nombre de `b` y el punto de anclaje (de donde se separa de su conexión). */
function nombre(def: DefinicionSimbolo, b: Borne): { caja: Caja; ancla: [number, number] } {
  const n = posicionNombreBorne(b.x, b.y, b.direccion, b.ladoNombre ?? def.ladoNombresBornes ?? "izquierda");
  const w = b.nombre.length * ALTO_BORNE * ANCHO_MEDIO;
  const h = ALTO_BORNE * ALTO_MAYUSCULA;
  const x = n.alineacion === "izquierda" ? n.x : n.alineacion === "derecha" ? n.x - w : n.x - w / 2;
  const ancla: [number, number] = [n.alineacion === "izquierda" ? n.x - 0.25 : n.alineacion === "derecha" ? n.x + 0.25 : n.x, n.y];
  return { caja: { x, y: n.y - h / 2, w, h }, ancla };
}

/** ¿Es la conexión del borne? Pasa por el borne, o es recta (vertical u horizontal) por el ancla. */
function esConexion(s: Segmento, b: Borne, ancla: [number, number]): boolean {
  if (distanciaPuntoSegmento(b.x, b.y, s) < 1e-6) return true;
  const recta = Math.abs(s[0] - s[2]) < 1e-6 || Math.abs(s[1] - s[3]) < 1e-6;
  return recta && distanciaPuntoSegmento(ancla[0], ancla[1], s) < 1e-6;
}

/** La menor distancia de cada nombre de borne al dibujo `primitivas`, como «tipo · borne · estado». */
function distancias(def: DefinicionSimbolo, primitivas: readonly Primitiva[], estado: string): [string, number][] {
  return def.bornes.map((b) => {
    const { caja, ancla } = nombre(def, b);
    let m = Infinity;
    for (const p of primitivas) for (const s of segmentos(p)) if (!esConexion(s, b, ancla)) m = Math.min(m, distanciaCajaSegmento(caja, s));
    return [`${def.tipo} · ${b.nombre} · ${estado}`, m];
  });
}

/**
 * Excepciones conocidas, de la 0.1.6 (T35): los números 1, 3, 5 y 7 tocan la cruz de
 * seccionamiento en las termomagnéticas y el guardamotor; la W toca la diagonal en el
 * motor trifásico. Pendiente antes de la 0.1.7 (`docs/ideas.md`): arreglarlos sin mover
 * bornes y sacarlos de esta lista. El test falla si uno de estos deja de fallar.
 */
const EXCEPCIONES: readonly string[] = [
  "proteccion.termomagnetica_unipolar",
  "proteccion.termomagnetica_bipolar",
  "proteccion.termomagnetica_tripolar",
  "proteccion.termomagnetica_tetrapolar",
  "proteccion.guardamotor",
  "motor.trifasico",
];

describe("nombres de bornes contra el dibujo (C1)", () => {
  const todos = SIMBOLOS.filter((d) => d.mostrarNombresBornes !== false).flatMap((d) =>
    [...distancias(d, d.primitivas, "reposo"), ...(d.primitivasAccionado ? distancias(d, d.primitivasAccionado, "accionado") : [])].map(
      ([q, m]) => [d.tipo, q, m] as const,
    ),
  );
  const cerca = todos.filter(([, , m]) => m < MINIMO);

  it(`fuera de las excepciones, ningún nombre queda a menos de ${MINIMO} de grilla de una primitiva, en reposo ni accionado`, () => {
    expect(cerca.filter(([t]) => !EXCEPCIONES.includes(t)).map(([, q, m]) => `${q}: ${m.toFixed(2)}`)).toEqual([]);
  });

  it("cada excepción sigue fallando: si se arregla, se saca de EXCEPCIONES", () => {
    const fallan = new Set(cerca.map(([t]) => t));
    expect(EXCEPCIONES.filter((t) => !fallan.has(t))).toEqual([]);
  });

  it("mide los 49 símbolos con nombres visibles", () => {
    expect(SIMBOLOS).toHaveLength(49);
    expect(todos.length).toBeGreaterThan(100);
  });
});
