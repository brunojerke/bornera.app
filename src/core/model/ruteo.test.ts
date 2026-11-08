import { describe, expect, it } from "vitest";
import { BOBINA_CONTACTOR, borneColocado, type Direccion, type Rotacion, type Transformacion } from "../symbols";
import { indexarHoja, validarCable } from "./cables";
import type { Componente, Hoja } from "./documento";
import { codos, direccionDe, formaInvalida, opuesta, perpendiculares, rutas, simplificar, VECTORES, type ExtremoRuta } from "./ruteo";
import { consultaHoja, problemasTrazado } from "./trazado";

const ROTACIONES: Rotacion[] = [0, 90, 180, 270];
const ORIENTACIONES: Transformacion[] = ROTACIONES.flatMap((rotacion) => [
  { rotacion, espejado: false },
  { rotacion, espejado: true },
]);

/** Extremo de ruta de un borne: prefiere su dirección y prohíbe la opuesta. */
function deBorne(x: number, y: number, d: Direccion): ExtremoRuta {
  return { x, y, preferidas: [d], prohibidas: [opuesta(d)] };
}

/** Recorrido entero (x, y seguidos) de a por los codos hasta b. */
function recorrido(a: ExtremoRuta, c: [number, number][], b: ExtremoRuta): number[] {
  return [a.x, a.y, ...c.flat(), b.x, b.y];
}

function primeraDireccion(p: number[]): Direccion | null {
  return direccionDe(p[2]! - p[0]!, p[3]! - p[1]!);
}

function bobina(id: string, x: number, y: number, t: Transformacion, etiqueta = id.toUpperCase()): Componente {
  return { id, tipo: BOBINA_CONTACTOR.tipo, x, y, rot: t.rotacion, espejado: t.espejado, etiqueta, params: {} };
}

describe("simplificar y formaInvalida", () => {
  it("quita puntos repetidos y colineales, y deja la vuelta de 180° para rechazarla", () => {
    expect(simplificar([0, 0, 0, 0, 2, 0, 5, 0, 5, 3])).toEqual([0, 0, 5, 0, 5, 3]);
    expect(simplificar([0, 0, 5, 0, 2, 0])).toEqual([0, 0, 5, 0, 2, 0]);
    expect(formaInvalida([0, 0, 5, 0, 2, 0])).toBe(true);
    expect(formaInvalida([0, 0, 5, 0, 5, 0])).toBe(true);
    expect(formaInvalida([0, 0, 5, 1])).toBe(true);
    expect(formaInvalida([0, 0, 5, 0, 5, 3])).toBe(false);
  });
});

describe("codos desde un borne en las 8 orientaciones", () => {
  // Destinos en el marco del borne: (a lo largo de su salida, de costado).
  // Esperado: codos en el mismo marco, o null si no hay camino.
  const CASOS: [string, number, number, [number, number][] | null][] = [
    ["adelante", 5, 0, []],
    ["adelante a un costado", 5, 3, [[5, 0]]],
    ["adelante al otro costado", 5, -3, [[5, 0]]],
    ["al nivel, a un costado", 0, 4, [[1, 0], [1, 4]]],
    ["al nivel, al otro costado", 0, -4, [[1, 0], [1, -4]]],
    ["detrás, a un costado", -4, 3, [[1, 0], [1, 3]]],
    ["detrás, al otro costado", -4, -3, [[1, 0], [1, -3]]],
    ["justo detrás (sin camino)", -4, 0, null],
  ];

  for (const t of ORIENTACIONES) {
    const b = borneColocado(BOBINA_CONTACTOR.bornes, "A1", 3, -2, t)!;
    const [sx, sy] = VECTORES[b.direccion];
    const [px, py] = VECTORES[perpendiculares(b.direccion)[1]];
    const enMarco = (a: number, s: number): [number, number] => [b.x + a * sx + s * px + 0, b.y + a * sy + s * py + 0];

    it.each(CASOS)(`${t.rotacion}° ${t.espejado ? "espejado" : "derecho"}: %s`, (_, a, s, esperado) => {
      const desde = deBorne(b.x, b.y, b.direccion);
      const [hx, hy] = enMarco(a, s);
      const hasta: ExtremoRuta = { x: hx, y: hy };
      const c = codos(desde, hasta);
      expect(c).toEqual(esperado && esperado.map(([ca, cs]) => enMarco(ca, cs)));
      // Determinista: la misma entrada da lo mismo.
      expect(codos(desde, hasta)).toEqual(c);
      if (!c) return;
      const p = recorrido(desde, c, hasta);
      expect(p.every(Number.isInteger)).toBe(true);
      expect(formaInvalida(p)).toBe(false);
      // Sale por la dirección real del borne transformado.
      expect(primeraDireccion(p)).toBe(b.direccion);
    });
  }
});

describe("codos entre bornes", () => {
  it("A1 hacia un borne de arriba que mira hacia abajo, corrido: Z por la mitad, llegando desde afuera", () => {
    const desde = deBorne(0, 0, "arriba");
    const hasta = deBorne(3, -6, "abajo");
    expect(codos(desde, hasta)).toEqual([
      [0, -3],
      [3, -3],
    ]);
  });

  it("dos bornes vecinos que miran hacia arriba: U por arriba", () => {
    expect(codos(deBorne(0, 0, "arriba"), deBorne(4, 0, "arriba"))).toEqual([
      [0, -1],
      [4, -1],
    ]);
  });

  it("enfrentados y alineados: recta", () => {
    expect(codos(deBorne(0, 0, "arriba"), deBorne(0, -6, "abajo"))).toEqual([]);
  });

  it("8 × 8 orientaciones de dos bobinas: cada ruta que encuentra es válida, entera y no atraviesa ningún cuerpo", () => {
    let encontradas = 0;
    let total = 0;
    for (const t1 of ORIENTACIONES) {
      for (const t2 of ORIENTACIONES) {
        const hoja: Hoja = { nombre: "H", componentes: [bobina("k1", 0, 0, t1), bobina("k2", 10, 7, t2)], cables: [] };
        const indice = indexarHoja(hoja);
        const consulta = consultaHoja(hoja, indice);
        for (const [n1, n2] of [["A1", "A1"], ["A1", "A2"], ["A2", "A1"], ["A2", "A2"]] as const) {
          total++;
          const b1 = borneColocado(BOBINA_CONTACTOR.bornes, n1, 0, 0, t1)!;
          const b2 = borneColocado(BOBINA_CONTACTOR.bornes, n2, 10, 7, t2)!;
          const desde = { tipo: "borne", comp: "k1", borne: n1 } as const;
          const hasta = { tipo: "borne", comp: "k2", borne: n2 } as const;
          const a = deBorne(b1.x, b1.y, b1.direccion);
          const b = deBorne(b2.x, b2.y, b2.direccion);
          const c = codos(a, b, (k) => problemasTrazado({ desde, hasta, puntos: recorrido(a, k, b) }, consulta).length === 0);
          if (!c) continue;
          encontradas++;
          const p = recorrido(a, c, b);
          expect(p.every(Number.isInteger)).toBe(true);
          expect(validarCable(indice, { id: "w", desde, hasta, codos: c })).toEqual([]);
          // No sale ni llega por adentro de su símbolo.
          expect(primeraDireccion(p)).not.toBe(opuesta(b1.direccion));
          expect(direccionDe(p[p.length - 4]! - p[p.length - 2]!, p[p.length - 3]! - p[p.length - 1]!)).not.toBe(opuesta(b2.direccion));
          expect(problemasTrazado({ desde, hasta, puntos: p }, consulta)).toEqual([]);
        }
      }
    }
    // Las que faltan piden más de 2 codos (rodear un cuerpo): se fija un codo a mano.
    expect(encontradas).toBeGreaterThan(total / 2);
  });
});

describe("al cruzar los ejes", () => {
  const desde = deBorne(0, 0, "arriba");

  it("el cursor que cruza la línea de salida espeja la L, sin cambiar de forma", () => {
    expect(codos(desde, { x: 3, y: -5 })).toEqual([[0, -5]]);
    expect(codos(desde, { x: -3, y: -5 })).toEqual([[0, -5]]);
  });

  it("al bajar hasta el nivel del borne y detrás, pasa de L a U; justo detrás, sin camino", () => {
    const formas = [-5, -1, 0, 1, 4].map((y) => codos(desde, { x: 3, y }));
    expect(formas).toEqual([
      [[0, -5]],
      [[0, -1]],
      [[0, -1], [3, -1]],
      [[0, -1], [3, -1]],
      [[0, -1], [3, -1]],
    ]);
    expect(codos(desde, { x: 0, y: 4 })).toBeNull();
  });

  it("desde un codo fijado: sigue recto si el cursor está alineado y dobla de costado si no; para volver, da la vuelta en U", () => {
    // Llegó al codo bajando: no vuelve hacia arriba y prefiere doblar.
    const ancla: ExtremoRuta = { x: 0, y: 0, prohibidas: ["arriba"], debiles: ["izquierda", "derecha"] };
    expect(codos(ancla, { x: 0, y: 6 })).toEqual([]);
    expect(codos(ancla, { x: 5, y: 3 })).toEqual([[5, 0]]);
    expect(codos(ancla, { x: 0, y: -4 })).toEqual([
      [-1, 0],
      [-1, -4],
    ]);
  });

  it("los mismos puntos dan siempre lo mismo (rutas ordenadas)", () => {
    const r1 = rutas(desde, deBorne(7, 3, "izquierda"));
    const r2 = rutas(desde, deBorne(7, 3, "izquierda"));
    expect(r1).toEqual(r2);
    expect(r1.length).toBeGreaterThan(0);
  });
});
