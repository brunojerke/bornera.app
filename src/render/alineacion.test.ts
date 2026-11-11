// T14n: los trazos se alinean al píxel. Un contexto falso que lleva la
// transformación anota cada trazo en px físicos, que es lo que se comprueba:
// no importa si el Renderer dibuja con o sin transformación.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOBINA_CONTACTOR } from "../core/symbols";
import { grosorEnPixeles, RendererCanvas, sobranteAlineado } from "./canvas2d";
import { grosorLinea } from "./escena";
import { Path2DFalso } from "./falsos";
import { dibujarGeometria } from "./renderer";
import { dibujarSimbolo } from "./simbolo";

interface Trazo {
  /** Puntos del recorrido (o centros de los arcos), en px físicos. */
  puntos: [number, number][];
  /** Grosor en px físicos. */
  grosor: number;
  tope: string;
  /** A dónde va el origen del sistema, en px físicos (para los trazados de símbolos). */
  origen: [number, number];
  /** El Path2D, si se trazó uno. */
  trazado: unknown;
}

/** Contexto 2D falso que lleva la transformación, como un canvas de verdad. */
function lienzo() {
  let m = [1, 0, 0, 1, 0, 0];
  let estado = { lineWidth: 1, lineCap: "butt" };
  const pila: { m: number[]; estado: typeof estado }[] = [];
  let puntos: [number, number][] = [];
  const trazos: Trazo[] = [];
  const rellenos: Trazo[] = [];
  const aPx = (x: number, y: number): [number, number] => [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!];
  const multiplicar = (a: number, b: number, c: number, d: number, e: number, f: number) => {
    const [a0, b0, c0, d0, e0, f0] = m as [number, number, number, number, number, number];
    m = [a0 * a + c0 * b, b0 * a + d0 * b, a0 * c + c0 * d, b0 * c + d0 * d, a0 * e + c0 * f + e0, b0 * e + d0 * f + f0];
  };
  const anotar = (lista: Trazo[], trazado: unknown) =>
    lista.push({
      puntos: trazado ? [] : puntos,
      grosor: estado.lineWidth * Math.hypot(m[0]!, m[1]!),
      tope: estado.lineCap,
      origen: [m[4]!, m[5]!],
      trazado: trazado ?? null,
    });
  const ctx = {
    canvas: { width: 0, height: 0 },
    set lineWidth(v: number) {
      estado.lineWidth = v;
    },
    get lineWidth() {
      return estado.lineWidth;
    },
    set lineCap(v: string) {
      estado.lineCap = v;
    },
    get lineCap() {
      return estado.lineCap;
    },
    lineJoin: "",
    strokeStyle: "",
    fillStyle: "",
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void (m = [a, b, c, d, e, f]),
    translate: (dx: number, dy: number) => multiplicar(1, 0, 0, 1, dx, dy),
    scale: (sx: number, sy: number) => multiplicar(sx, 0, 0, sy, 0, 0),
    rotate: (r: number) => multiplicar(Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0),
    save: () => void pila.push({ m: [...m], estado: { ...estado } }),
    restore: () => {
      const p = pila.pop();
      if (p) ({ m, estado } = p);
    },
    beginPath: () => void (puntos = []),
    moveTo: (x: number, y: number) => void puntos.push(aPx(x, y)),
    lineTo: (x: number, y: number) => void puntos.push(aPx(x, y)),
    arc: (x: number, y: number) => void puntos.push(aPx(x, y)),
    stroke: (trazado?: unknown) => void anotar(trazos, trazado),
    fill: (trazado?: unknown) => void anotar(rellenos, trazado),
    strokeRect: () => {},
    fillRect: () => {},
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, trazos, rellenos };
}

/** Renderer con la transformación de un mosaico o de la pantalla: `k` px por unidad, corrido (tx, ty) px. */
function armar(k: number, tx = -234, ty = -106) {
  const l = lienzo();
  const r = new RendererCanvas(l.ctx);
  r.transformar(k, 0, 0, k, tx, ty);
  r.estilo({ grosor: grosorLinea(k) });
  return { ...l, r };
}

/** Un tramo vertical y uno horizontal por cada punto de grilla 0..9 (x0, y0, x1, y1 seguidos). */
function tramos(): number[] {
  const t: number[] = [];
  for (let g = 0; g < 10; g++) t.push(g, 0, g, 5, 0, g, 5, g);
  return t;
}

describe("grosor en px físicos", () => {
  it("es entero, por lo menos 1, y redondea al más cercano", () => {
    expect(grosorEnPixeles(0.2)).toBe(1);
    expect(grosorEnPixeles(1.16)).toBe(1);
    expect(grosorEnPixeles(1.46)).toBe(1);
    expect(grosorEnPixeles(1.5)).toBe(2);
    expect(grosorEnPixeles(2.4)).toBe(2);
    expect(grosorEnPixeles(2.6)).toBe(3);
  });

  it.each([
    [2, 1], // 10 %
    [8, 1], // 40 %
    [11.6, 1], // 58 %: sin redondear, 1,16 px
    [14.6, 1], // 73 %: sin redondear, 1,46 px
    [15.2, 2], // 76 %
    [20, 2], // 100 %
    [26, 3], // 130 %
    [40, 4], // 200 %, o 100 % con dpr 2
  ])("con %s px por unidad, las líneas se trazan de %s px", (k, px) => {
    const { r, trazos } = armar(k);
    r.lineas([0, 0, 0, 5], 1);
    r.linea(0, 0, 3, 4);
    expect(trazos.map((t) => t.grosor)).toEqual([expect.closeTo(px, 9), expect.closeTo(px, 9)]);
  });

  it("el resaltado (3 grosores) y los avisos (2) también quedan enteros", () => {
    const { r, trazos } = armar(11.6);
    r.estilo({ grosor: 3 * grosorLinea(11.6) }); // 3,48 px
    r.lineas([0, 0, 0, 5], 1);
    r.estilo({ grosor: 2 * grosorLinea(11.6) }); // 2,32 px
    r.lineas([0, 0, 0, 5], 1);
    expect(trazos.map((t) => t.grosor)).toEqual([expect.closeTo(3, 9), expect.closeTo(2, 9)]);
  });
});

describe("lineas, al píxel", () => {
  it.each([11.6, 14.6])("a %s px por unidad (grosor 1) cada tramo llena una columna o una fila entera", (k) => {
    const { r, trazos } = armar(k);
    r.lineas(tramos(), 20);
    expect(trazos).toHaveLength(1);
    expect(trazos[0]!.tope).toBe("square");
    const p = trazos[0]!.puntos;
    expect(p).toHaveLength(40);
    for (let g = 0; g < 10; g++) {
      // Vertical en x = g: de x − 0,5 a x + 0,5, justo el píxel donde va el punto de la grilla.
      const [x0, y0] = p[4 * g]!;
      const [x1, y1] = p[4 * g + 1]!;
      expect([x0 - 0.5, x1 - 0.5]).toEqual([Math.round(g * k) - 234, Math.round(g * k) - 234]);
      expect([y0 - 0.5, y1 - 0.5]).toEqual([-106, Math.round(5 * k) - 106]);
      // Horizontal en y = g: lo mismo en la otra dirección.
      const [x2, y2] = p[4 * g + 2]!;
      const [x3, y3] = p[4 * g + 3]!;
      expect([y2 - 0.5, y3 - 0.5]).toEqual([Math.round(g * k) - 106, Math.round(g * k) - 106]);
      expect([x2 - 0.5, x3 - 0.5]).toEqual([-234, Math.round(5 * k) - 234]);
    }
  });

  it("con grosor par (2 px al 100 %) el centro va en el borde entre dos píxeles", () => {
    const { r, trazos } = armar(20, -233, -107);
    r.lineas(tramos(), 20);
    for (const [x, y] of trazos[0]!.puntos) {
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
    }
    expect(trazos[0]!.puntos[4]).toEqual([20 - 233, -107]);
  });

  it("deja el contexto como estaba: transformación, grosor y tope", () => {
    const { r, trazos } = armar(11.6);
    r.lineas([1, 1, 1, 4], 1);
    r.linea(0.3, 0.2, 2.1, 3.7); // inclinada: sin alinear, con la transformación de antes
    expect(trazos[1]!.puntos).toEqual([
      [expect.closeTo(0.3 * 11.6 - 234, 9), expect.closeTo(0.2 * 11.6 - 106, 9)],
      [expect.closeTo(2.1 * 11.6 - 234, 9), expect.closeTo(3.7 * 11.6 - 106, 9)],
    ]);
    expect(trazos[1]!.grosor).toBeCloseTo(1, 9);
    expect(trazos[1]!.tope).toBe("round");
  });

  // 12,5: los puntos impares caen justo en medio píxel. 12,499999999999998: casi.
  it.each([11.6, 12.5, 12.499999999999998, 14.6, 20])(
    "a %s px por unidad, un punto de la grilla cae en el mismo píxel en todos los mosaicos y en la pantalla",
    (k) => {
      const corrimientos = [0, -512, -1024, -234, -100000, 4096];
      const globales = corrimientos.map((t) => {
        const { r, trazos } = armar(k, t, t);
        const segmentos: number[] = [];
        for (let g = 0; g <= 40; g++) segmentos.push(g, g, g, g + 1);
        r.lineas(segmentos, 41);
        return trazos[0]!.puntos.map(([x, y]) => [x - t, y - t]);
      });
      for (const g of globales) expect(g).toEqual(globales[0]);
    },
  );

  it("con la traslación a medio píxel igual llena píxeles enteros", () => {
    const { r, trazos } = armar(11.6, -233.4, -106.7);
    r.lineas(tramos(), 20);
    for (const [x, y] of trazos[0]!.puntos) {
      expect(Number.isInteger(x - 0.5)).toBe(true);
      expect(Number.isInteger(y - 0.5)).toBe(true);
    }
  });

  it("un tramo inclinado (las gomas de un arrastre) no se alinea, y los rectos del mismo trazo sí", () => {
    const k = 11.6;
    const { r, trazos } = armar(k);
    r.lineas([0.3, 0.2, 2.1, 3.7, 3, 0, 3, 5], 2);
    expect(trazos).toHaveLength(1);
    expect(trazos[0]!.puntos).toEqual([
      [expect.closeTo(0.3 * k - 234, 9), expect.closeTo(0.2 * k - 106, 9)],
      [expect.closeTo(2.1 * k - 234, 9), expect.closeTo(3.7 * k - 106, 9)],
      [Math.round(3 * k) - 234 + 0.5, -106 + 0.5],
      [Math.round(3 * k) - 234 + 0.5, Math.round(5 * k) - 106 + 0.5],
    ]);
  });

  it("girado un ángulo que no es múltiplo de 90°, no alinea", () => {
    const { r, trazos } = armar(11.6);
    r.rotar(30);
    r.lineas([1, 0, 4, 0], 1);
    const cos = Math.cos(Math.PI / 6);
    expect(trazos[0]!.puntos[0]).toEqual([expect.closeTo(11.6 * cos - 234, 9), expect.closeTo(11.6 * 0.5 - 106, 9)]);
    expect(trazos[0]!.tope).toBe("square");
  });

  it("guardar y restaurar devuelven también la alineación y el grosor", () => {
    const { r, trazos } = armar(11.6);
    r.lineas([3, 0, 3, 5], 1);
    r.guardar();
    r.trasladar(0.37, 0.41);
    r.estilo({ grosor: 0.3 });
    r.restaurar();
    r.lineas([3, 0, 3, 5], 1);
    expect(trazos[1]).toEqual(trazos[0]);
  });
});

describe("símbolos, al píxel", () => {
  beforeEach(() => vi.stubGlobal("Path2D", Path2DFalso));
  afterEach(() => vi.unstubAllGlobals());

  const casos: [number, boolean][] = [];
  for (const rotacion of [0, 90, 180, 270]) for (const espejado of [false, true]) casos.push([rotacion, espejado]);

  it.each(casos)("a %s° (espejado: %s) el origen cae en la columna y la fila del cable que llega al borne", (rotacion, espejado) => {
    for (const k of [11.6, 14.6, 12.5, 20]) {
      for (const [gx, gy] of [[3, 7], [4, 5], [10, 1], [-6, -3]] as const) {
        const { r, trazos } = armar(k);
        r.lineas([gx, gy, gx, gy], 1);
        dibujarSimbolo(r, BOBINA_CONTACTOR, { x: gx, y: gy, rotacion: rotacion as 0, espejado }, { textos: false });
        const [cable, simbolo] = trazos;
        expect(simbolo!.trazado).not.toBeNull();
        expect(simbolo!.origen).toEqual(cable!.puntos[0]);
        expect(simbolo!.grosor).toBeCloseTo(cable!.grosor, 9);
        expect(Number.isInteger(simbolo!.origen[0] - (cable!.grosor > 1.5 ? 0 : 0.5))).toBe(true);
      }
    }
  });

  it("después del símbolo, la transformación queda como estaba", () => {
    const { r, trazos } = armar(11.6);
    r.guardar();
    r.trasladar(3, 7);
    r.simbolo(BOBINA_CONTACTOR);
    r.linea(0.25, 0, 1, 0.5); // inclinada, en el sistema del símbolo sin alinear
    r.restaurar();
    expect(trazos[1]!.puntos[0]).toEqual([expect.closeTo(3.25 * 11.6 - 234, 9), expect.closeTo(7 * 11.6 - 106, 9)]);
  });

  it("girado 30°, el símbolo no se alinea", () => {
    const { r, trazos } = armar(11.6);
    r.guardar();
    r.trasladar(3, 7);
    r.rotar(30);
    r.simbolo(BOBINA_CONTACTOR);
    r.restaurar();
    expect(trazos[0]!.origen).toEqual([expect.closeTo(3 * 11.6 - 234, 9), expect.closeTo(7 * 11.6 - 106, 9)]);
  });

  it.each([0, 90, 180, 270])(
    "sin el trazado cacheado (primitiva por primitiva), a %s° la línea del borne cae en el mismo lugar",
    (rotacion) => {
      const k = 11.6;
      const { r, trazos } = armar(k);
      r.lineas([3, 7, 3, 7], 1);
      r.guardar();
      r.trasladar(3, 7);
      if (rotacion !== 0) r.rotar(rotacion);
      dibujarGeometria(r, BOBINA_CONTACTOR);
      r.restaurar();
      const [cx, cy] = trazos[0]!.puntos[0]!;
      // Primera primitiva: la conexión del borne de arriba, de (0, −2) a (0, −0,75).
      const [[x0, y0], [x1, y1]] = trazos[1]!.puntos as [[number, number], [number, number]];
      if (rotacion === 0 || rotacion === 180) {
        expect([x0, x1]).toEqual([expect.closeTo(cx, 6), expect.closeTo(cx, 6)]);
      } else {
        expect([y0, y1]).toEqual([expect.closeTo(cy, 6), expect.closeTo(cy, 6)]);
      }
    },
  );
});

describe("linea y circulo, al píxel", () => {
  it("una linea vertical u horizontal cae donde caería un cable", () => {
    const k = 11.6;
    const { r, trazos } = armar(k);
    r.lineas([3, 7, 3, 7.8, 3, 7, 3.8, 7], 2);
    r.linea(3, 7, 3, 7.8);
    r.linea(3, 7, 3.8, 7);
    const cable = trazos[0]!.puntos;
    for (const [i, t] of [trazos[1]!, trazos[2]!].entries()) {
      expect(t.puntos[0]![0]).toBeCloseTo(cable[2 * i]![0], 6);
      expect(t.puntos[0]![1]).toBeCloseTo(cable[2 * i]![1], 6);
      expect(t.puntos[1]![0]).toBeCloseTo(cable[2 * i + 1]![0], 6);
      expect(t.puntos[1]![1]).toBeCloseTo(cable[2 * i + 1]![1], 6);
      expect(t.tope).toBe("round");
    }
  });

  it("el centro de un círculo cae en el centro del cable", () => {
    for (const k of [11.6, 14.6, 20]) {
      const { r, trazos, rellenos } = armar(k);
      r.lineas([3, 7, 3, 7], 1);
      r.circulo(3, 7, 0.18, true);
      r.circulo(3, 7, 0.25);
      const [cx, cy] = trazos[0]!.puntos[0]!;
      expect(rellenos[0]!.puntos[0]).toEqual([expect.closeTo(cx, 6), expect.closeTo(cy, 6)]);
      expect(trazos[1]!.puntos[0]).toEqual([expect.closeTo(cx, 6), expect.closeTo(cy, 6)]);
    }
  });
});

describe("sobranteAlineado", () => {
  it("lo que se corre (1 px con grosor impar, medio con par) más lo que engorda al redondear", () => {
    expect(sobranteAlineado(1)).toBe(1);
    expect(sobranteAlineado(1.16)).toBe(1); // 1 px: más fino que sin redondear
    expect(sobranteAlineado(1.5)).toBe(0.75); // 2 px: un cuarto de más por lado
    expect(sobranteAlineado(2)).toBe(0.5);
    expect(sobranteAlineado(2.6)).toBeCloseTo(1.2, 9); // 3 px
  });
});
