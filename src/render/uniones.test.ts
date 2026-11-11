// T14b: el punto de unión. Diámetro en px enteros de la paridad del trazo
// (D3-B), centrado en el cable (T14n), caja de invalidación que lo cubre desde
// el zoom mínimo en que se dibuja (D4-A), después de los componentes (D5-B) y
// oculto si toca algo oculto (D6-A).

import { describe, expect, it } from "vitest";
import { BOBINA_CONTACTOR } from "../core/symbols";
import { diametroPunto, grosorEnPixeles, RendererCanvas } from "./canvas2d";
import { nivelDetalle, ESCALA_MIN_BORNES } from "./detalle";
import { grosorLinea, type InfoDibujo } from "./escena";
import { cajaUnion, DIAMETRO_UNION, EscenaEditable, MARGEN_UNION, margenUnion } from "./escenaEditable";
import type { Renderer } from "./renderer";

/** Contexto falso: anota en px físicos los centros y radios de los arcos y los puntos de las líneas. */
function lienzo() {
  let m = [1, 0, 0, 1, 0, 0];
  const arcos: { x: number; y: number; r: number }[] = [];
  const lineas: [number, number][] = [];
  /** Rectángulos en px físicos: x, y, ancho, alto. */
  const rects: [number, number, number, number][] = [];
  const aPx = (x: number, y: number): [number, number] => [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!];
  const ctx = {
    canvas: { width: 0, height: 0 },
    lineWidth: 1,
    lineCap: "",
    lineJoin: "",
    strokeStyle: "",
    fillStyle: "",
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void (m = [a, b, c, d, e, f]),
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: (x: number, y: number) => void lineas.push(aPx(x, y)),
    lineTo: (x: number, y: number) => void lineas.push(aPx(x, y)),
    arc: (x: number, y: number, r: number) => void arcos.push({ ...pt(aPx(x, y)), r: r * Math.hypot(m[0]!, m[1]!) }),
    rect: (x: number, y: number, w: number, h: number) => {
      // Solo se usa sin transformación (en px físicos).
      expect(m).toEqual([1, 0, 0, 1, 0, 0]);
      rects.push([x, y, w, h]);
    },
    stroke: () => {},
    fill: () => {},
  };
  const pt = ([x, y]: [number, number]) => ({ x, y });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, arcos, lineas, rects };
}

/** Extensión en px de un punto dibujado (lo pintado, sin suavizado al píxel; con 1 px de suavizado el arco). */
function extension(l: ReturnType<typeof lienzo>): { x0: number; x1: number; y0: number; y1: number; alPixel: boolean } {
  if (l.rects.length > 0) {
    expect(l.arcos).toHaveLength(0);
    return {
      x0: Math.min(...l.rects.map((q) => q[0])),
      x1: Math.max(...l.rects.map((q) => q[0] + q[2])),
      y0: Math.min(...l.rects.map((q) => q[1])),
      y1: Math.max(...l.rects.map((q) => q[1] + q[3])),
      alPixel: true,
    };
  }
  const a = l.arcos[0]!;
  return { x0: a.x - a.r - 1, x1: a.x + a.r + 1, y0: a.y - a.r - 1, y1: a.y + a.r + 1, alPixel: false };
}

/** Los píxeles que pintan los rectángulos, como "x,y". */
function pixeles(rects: readonly [number, number, number, number][]): Set<string> {
  const s = new Set<string>();
  for (const [x, y, w, h] of rects) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) s.add(`${x + i},${y + j}`);
  return s;
}

function armar(k: number, tx: number, ty: number) {
  const l = lienzo();
  const r = new RendererCanvas(l.ctx);
  r.transformar(k, 0, 0, k, tx, ty);
  r.estilo({ grosor: grosorLinea(k) });
  return { ...l, r };
}

/** Escalas de 6 px/u (30 %, la mínima en que se dibujan) a 80, y corrimientos de mosaico con fracciones. */
const ESCALAS = Array.from({ length: 741 }, (_, i) => 6 + i / 10);
const FASES: [number, number][] = [
  [0, 0],
  [-234, -106],
  [-233.5, -105.25],
  [17.3, 4.7],
];

describe("diámetro del punto (D3-B)", () => {
  it.each([
    [3, 1, 3], // 30 %: 0,5 u × 6
    [5.8, 1, 5], // 58 %
    [7.3, 1, 7], // 73 %
    [10, 2, 10], // 100 %
    [4, 1, 3], // empate entre 3 y 5: el menor
    [4.005, 1, 5],
    [5, 2, 4], // empate entre 4 y 6: el menor
    [1, 1, 3], // mínimo w + 2
    [2, 2, 4],
    [20, 4, 20],
  ])("nominal %s px con trazo de %s px: %s px", (nominal, w, esperado) => {
    expect(diametroPunto(nominal, w)).toBe(esperado);
  });

  it("siempre de la paridad del trazo y por lo menos w + 2", () => {
    for (const k of ESCALAS) {
      const w = grosorEnPixeles(grosorLinea(k) * k);
      const d = diametroPunto(DIAMETRO_UNION * k, w);
      expect(d % 2, `k ${k}`).toBe(w % 2);
      expect(d, `k ${k}`).toBeGreaterThanOrEqual(w + 2);
      expect(Math.abs(d - DIAMETRO_UNION * k), `k ${k}`).toBeLessThanOrEqual(Math.max(1, w + 2 - DIAMETRO_UNION * k));
    }
  });
});

describe("caja de una unión", () => {
  it("con el radio de cada rama: a 6 px/u, 3 px al píxel (2,5 / 6); el máximo, apenas pasando 8 px/u (5 px al píxel, 0,4375 u)", () => {
    expect(ESCALA_MIN_BORNES).toBe(6);
    expect(margenUnion(6)).toBeCloseTo(2.5 / 6, 12);
    expect(margenUnion(8)).toBeCloseTo(2.5 / 8, 12); // empate entre 3 y 5: el menor
    expect(margenUnion(8 + 1e-9)).toBeCloseTo(MARGEN_UNION, 6);
    expect(MARGEN_UNION).toBe(0.4375);
    // Arco: 10 px a 20 px/u, con 1 px de suavizado.
    expect(margenUnion(20)).toBeCloseTo((5 + 0.5 + 1) / 20, 12);
  });

  it("ninguna escala desde 6 px/u pide más margen", () => {
    for (const k of ESCALAS) expect(margenUnion(k), `k ${k}`).toBeLessThanOrEqual(MARGEN_UNION + 1e-12);
  });

  it("a 6 px/u y en todas las escalas, lo pintado (y el suavizado del arco) queda dentro de la caja", () => {
    let alPixel = 0;
    let arcos = 0;
    for (const k of [6, 8 + 1e-9, ...ESCALAS]) {
      for (const [tx, ty] of FASES) {
        for (const [x, y] of [
          [0, 0],
          [3, -7],
          [-12, 5],
        ] as [number, number][]) {
          const l = armar(k, tx, ty);
          l.r.puntos([x, y], 1, DIAMETRO_UNION);
          const e = extension(l);
          if (e.alPixel) alPixel++;
          else arcos++;
          const caja = cajaUnion(x, y);
          const ctx = `k ${k}, fase (${tx}, ${ty}), (${x}, ${y})`;
          // Caja en px, con el mismo corrimiento.
          expect(e.x0, ctx).toBeGreaterThanOrEqual(caja.x * k + tx - 1e-9);
          expect(e.x1, ctx).toBeLessThanOrEqual((caja.x + caja.ancho) * k + tx + 1e-9);
          expect(e.y0, ctx).toBeGreaterThanOrEqual(caja.y * k + ty - 1e-9);
          expect(e.y1, ctx).toBeLessThanOrEqual((caja.y + caja.alto) * k + ty + 1e-9);
        }
      }
    }
    expect(alPixel).toBeGreaterThan(0);
    expect(arcos).toBeGreaterThan(0);
  });
});

describe("las dos ramas en el umbral (8 px)", () => {
  it("7 px (73 %): franjas de píxeles enteros, simétricas en x e y, sin arco", () => {
    const l = armar(14.6, -233.5, -105.25);
    l.r.puntos([3, 4], 1, DIAMETRO_UNION);
    expect(l.arcos).toHaveLength(0);
    for (const q of l.rects) for (const v of q) expect(Number.isInteger(v)).toBe(true);
    const s = pixeles(l.rects);
    // Centro en medio píxel (trazo de 1 px): los píxeles enteros van de c − 3,5 a c + 3,5.
    const e = extension(l);
    expect([e.x1 - e.x0, e.y1 - e.y0]).toEqual([7, 7]);
    const cx = (e.x0 + e.x1) / 2;
    const cy = (e.y0 + e.y1) / 2;
    for (const p of s) {
      const [x, y] = p.split(",").map(Number) as [number, number];
      expect(s.has(`${2 * cx - 1 - x},${y}`), `espejo en x de ${p}`).toBe(true);
      expect(s.has(`${x},${2 * cy - 1 - y}`), `espejo en y de ${p}`).toBe(true);
      expect(s.has(`${y - cy + cx},${x - cx + cy}`), `transpuesto de ${p}`).toBe(true);
      // Cada píxel con el centro a 3,5 px o menos, y ninguno más.
      expect(Math.hypot(x + 0.5 - cx, y + 0.5 - cy)).toBeLessThanOrEqual(3.5);
    }
    // 3, 5, 7, 7, 7, 5, 3 por fila.
    expect(s.size).toBe(37);
  });

  it("8 px (último al píxel, trazo de 2 px): centro en el borde de un píxel, 4, 6, 8, 8, 8, 8, 6, 4 por fila", () => {
    const l = armar(16, -234, -106); // 80 %: 0,5 u = 8 px, trazo de 2 px
    l.r.puntos([3, 4], 1, DIAMETRO_UNION);
    expect(l.arcos).toHaveLength(0);
    expect(l.rects.map((q) => q[2])).toEqual([4, 6, 8, 8, 8, 8, 6, 4]);
  });

  it("10 px (100 %): un arco suavizado, sin franjas", () => {
    const l = armar(20, -234, -106);
    l.r.puntos([3, 4], 1, DIAMETRO_UNION);
    expect(l.rects).toHaveLength(0);
    expect(l.arcos).toHaveLength(1);
    expect(l.arcos[0]!.r).toBe(5);
  });
});

describe("el punto sobre el cable (T14n)", () => {
  it.each([6, 8, 11.6, 14.6, 15.2, 20, 26, 40])("con %s px por unidad, centro en la columna y la fila del cable", (k) => {
    for (const [tx, ty] of FASES) {
      for (let g = 0; g < 5; g++) {
        const l = armar(k, tx, ty);
        // Un tramo vertical y uno horizontal que pasan por (g, g).
        l.r.lineas([g, g - 3, g, g + 3, g - 3, g, g + 3, g], 2);
        l.r.puntos([g, g], 1, DIAMETRO_UNION);
        const e = extension(l);
        const suavizado = e.alPixel ? 0 : 1;
        const ctx = `k ${k}, fase (${tx}, ${ty}), g ${g}`;
        expect((e.x0 + e.x1) / 2, ctx).toBe(l.lineas[0]![0]); // columna del vertical
        expect((e.y0 + e.y1) / 2, ctx).toBe(l.lineas[2]![1]); // fila del horizontal
        // El diámetro: entero y de la paridad del trazo; al píxel hasta 8 px.
        const w = grosorEnPixeles(grosorLinea(k) * k);
        const d = diametroPunto(DIAMETRO_UNION * k, w);
        expect(e.x1 - e.x0 - 2 * suavizado, ctx).toBe(d);
        expect(e.alPixel, ctx).toBe(d <= 8);
      }
    }
  });

  it("con mosaicos corridos 256 px, los mismos píxeles corridos (al píxel) y el mismo centro (arco)", () => {
    const a = armar(11.6, -234, -106);
    const b = armar(11.6, -234 + 256, -106 - 256);
    a.r.puntos([1, 2, 3, 4], 2, DIAMETRO_UNION);
    b.r.puntos([1, 2, 3, 4], 2, DIAMETRO_UNION);
    expect(b.rects.map(([x, y, w, h]) => [x - 256, y + 256, w, h])).toEqual(a.rects);
    const c = armar(20, -234, -106);
    const d = armar(20, -234 + 256, -106 - 256);
    c.r.puntos([1, 2, 3, 4], 2, DIAMETRO_UNION);
    d.r.puntos([1, 2, 3, 4], 2, DIAMETRO_UNION);
    expect(c.arcos).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      expect(d.arcos[i]!.x - 256).toBe(c.arcos[i]!.x);
      expect(d.arcos[i]!.y + 256).toBe(c.arcos[i]!.y);
    }
  });
});

describe("uniones en la escena", () => {
  function grabar() {
    const llamadas: [string, ...unknown[]][] = [];
    const r = new Proxy({} as Renderer, {
      get:
        (_, nombre: string) =>
        (...a: unknown[]) =>
          void llamadas.push([nombre, ...a]),
    });
    return { r, llamadas };
  }
  const info = (escala: number): InfoDibujo => ({
    escala,
    colores: { simbolo: "#000", borne: "#06c" },
    visible: { x: -50, y: -50, ancho: 100, alto: 100 },
    detalle: nivelDetalle(escala),
  });

  function escena() {
    const e = new EscenaEditable();
    e.agregar("c1", { def: BOBINA_CONTACTOR, x: 0, y: 0, rotacion: 0, espejado: false });
    e.ponerCable("w1", { puntos: [0, -2, 0, -6], libres: [0, -6] });
    e.ponerCable("w2", { puntos: [0, -2, 5, -2], libres: [5, -2] });
    e.ponerUnion({ x: 0, y: -2, cables: ["w1", "w2"], componentes: ["c1"] });
    return e;
  }

  it("se dibujan después de los componentes, con el grosor de los cables", () => {
    const { r, llamadas } = grabar();
    escena().dibujar(r, info(11.6));
    const nombres = llamadas.map((l) => l[0]);
    const iPuntos = nombres.lastIndexOf("puntos");
    expect(iPuntos).toBeGreaterThan(nombres.lastIndexOf("simbolo"));
    expect(iPuntos).toBeGreaterThan(nombres.lastIndexOf("circulo"));
    expect(llamadas[iPuntos]!.slice(2)).toEqual([1, DIAMETRO_UNION]);
    expect(llamadas[iPuntos - 1]).toEqual(["estilo", { trazo: "#000", relleno: "#000", grosor: grosorLinea(11.6) }]);
  });

  it("debajo de 30 % (sin marcas de bornes) no se dibujan", () => {
    const { r, llamadas } = grabar();
    escena().dibujar(r, info(5.9));
    expect(llamadas.some((l) => l[0] === "puntos")).toBe(false);
  });

  it("una unión que toca un cable o un componente oculto no se dibuja (D6-A)", () => {
    for (const ocultar of [(e: EscenaEditable) => e.ocultarCable("w2"), (e: EscenaEditable) => e.ocultar("c1")]) {
      const e = escena();
      e.ponerUnion({ x: 10, y: 10, cables: ["w9"], componentes: [] });
      ocultar(e);
      const { r, llamadas } = grabar();
      e.dibujar(r, info(11.6));
      const p = llamadas.find((l) => l[0] === "puntos")!;
      expect(p[2]).toBe(1);
      expect(Array.from(p[1] as number[]).slice(0, 2)).toEqual([10, 10]);
    }
  });

  it("con `mostrarUniones` apagado no se dibujan; cajasUnionesDe da las de cada ancla, sin repetir", () => {
    const e = escena();
    e.mostrarUniones = false;
    const { r, llamadas } = grabar();
    e.dibujar(r, info(11.6));
    expect(llamadas.some((l) => l[0] === "puntos")).toBe(false);
    expect(e.cajasUnionesDe(["w1", "c1", "w2", "otro"])).toEqual([cajaUnion(0, -2)]);
    expect(e.quitarUnion(0, -2)).toEqual([cajaUnion(0, -2)]);
    expect(e.cajasUnionesDe(["w1"])).toEqual([]);
    expect(e.quitarUnion(0, -2)).toEqual([]);
    expect(e.cantidadUniones).toBe(0);
  });
});
