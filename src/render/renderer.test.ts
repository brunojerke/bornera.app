import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Primitiva } from "../core/symbols";
import { RendererCanvas } from "./canvas2d";
import { contextoFalso as contextoConCanvas, fabricaFalsa, llamadasA, Path2DFalso } from "./falsos";
import { Grilla, pasoGrilla, PASOS_POR_MAYOR, SEPARACION_MINIMA } from "./grilla";
import { dibujarPrimitiva, type Renderer } from "./renderer";

/** Renderer falso que anota cada llamada. */
function grabador(): { r: Renderer; llamadas: unknown[][] } {
  const llamadas: unknown[][] = [];
  const r = new Proxy({} as Renderer, {
    get: (_, nombre) => (...args: unknown[]) => llamadas.push([nombre, ...args]),
  });
  return { r, llamadas };
}

/** Contexto 2D falso: anota métodos y asignaciones. */
function contextoFalso(): { ctx: CanvasRenderingContext2D; llamadas: unknown[][] } {
  const llamadas: unknown[][] = [];
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (_, nombre) => (...args: unknown[]) => llamadas.push([nombre, ...args]),
    set: (_, nombre, valor) => (llamadas.push(["=" + String(nombre), valor]), true),
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, llamadas };
}

describe("dibujarPrimitiva", () => {
  it("traduce cada primitiva del núcleo a una llamada del Renderer", () => {
    const { r, llamadas } = grabador();
    const primitivas: Primitiva[] = [
      { forma: "linea", x1: 0, y1: -2, x2: 0, y2: 2 },
      { forma: "arco", cx: 0, cy: 0, r: 1, desde: 0, hasta: 180 },
      { forma: "circulo", cx: 1, cy: 1, r: 0.5 },
      { forma: "rectangulo", x: -1, y: -1, ancho: 2, alto: 2, relleno: true },
      { forma: "texto", x: 1, y: 0, texto: "K1", alto: 0.8, alineacion: "centro" },
    ];
    for (const p of primitivas) dibujarPrimitiva(r, p);
    expect(llamadas).toEqual([
      ["linea", 0, -2, 0, 2],
      ["arco", 0, 0, 1, 0, 180],
      ["circulo", 1, 1, 0.5, false],
      ["rectangulo", -1, -1, 2, 2, true],
      ["texto", 1, 0, "K1", 0.8, "centro"],
    ]);
  });
});

describe("RendererCanvas", () => {
  it("dibuja arcos en sentido horario con ángulos en radianes", () => {
    const { ctx, llamadas } = contextoFalso();
    new RendererCanvas(ctx).arco(1, 2, 3, 90, 180);
    expect(llamadas).toContainEqual(["arc", 1, 2, 3, Math.PI / 2, Math.PI]);
    expect(llamadas.at(-1)).toEqual(["stroke"]);
  });

  it("rellena o contornea según el parámetro", () => {
    const { ctx, llamadas } = contextoFalso();
    const r = new RendererCanvas(ctx);
    r.circulo(0, 0, 1, true);
    expect(llamadas.at(-1)).toEqual(["fill"]);
    r.rectangulo(0, 0, 1, 1);
    expect(llamadas.at(-1)).toEqual(["strokeRect", 0, 0, 1, 1]);
  });

  it("escala el texto en vez de usar fuentes diminutas", () => {
    const { ctx, llamadas } = contextoFalso();
    new RendererCanvas(ctx).texto(5, 6, "A1", 0.5, "derecha");
    expect(llamadas).toContainEqual(["translate", 5, 6]);
    expect(llamadas).toContainEqual(["scale", 0.005, 0.005]);
    expect(llamadas).toContainEqual(["=textAlign", "right"]);
    expect(llamadas).toContainEqual(["fillText", "A1", 0, 0]);
  });
});

describe("Grilla", () => {
  beforeEach(() => vi.stubGlobal("Path2D", Path2DFalso));
  afterEach(() => vi.unstubAllGlobals());

  /** Puntos que dibuja un área, en px globales: [x, y, tamaño]. */
  function puntos(g: Grilla, fabrica: ReturnType<typeof fabricaFalsa>, x0: number, y0: number, ancho: number, alto: number, k: number) {
    const destino = contextoConCanvas(ancho, alto);
    g.dibujar(destino.ctx, x0, y0, ancho, alto, k, 1, { punto: "#ccc", mayor: "#999" });
    // Cada fila es una copia de una tira; cada tira, un Path2D de cuadraditos.
    const tiras = new Map<unknown, [number, number][]>();
    for (const t of fabrica.transparentes) {
      const rects = llamadasA(t.llamadas, "fill").flatMap(([p]) =>
        (p as Path2DFalso).llamadas.map((l) => [l[1] as number, l[4] as number] as [number, number]),
      );
      tiras.set(t.canvas, rects);
    }
    const resultado = new Set<string>();
    for (const [tira, , y] of llamadasA(destino.llamadas, "drawImage") as [unknown, number, number][]) {
      for (const [x, tam] of tiras.get(tira) ?? []) {
        // Solo lo que cae dentro del área.
        if (x + tam > 0 && x < ancho && y + 2 > 0 && y < alto) resultado.add(`${x + x0},${y + y0},${tam}`);
      }
    }
    return resultado;
  }

  it("dos áreas vecinas ponen cada punto donde lo pondría una sola área grande", () => {
    const k = 13.7; // px por unidad: los puntos no caen en píxeles enteros
    const f1 = fabricaFalsa();
    const todo = puntos(new Grilla(f1.crear), f1, -300, 40, 512, 256, k);
    const f2 = fabricaFalsa();
    const g = new Grilla(f2.crear, 4);
    const izquierda = puntos(g, f2, -300, 40, 256, 256, k);
    const derecha = puntos(g, f2, -44, 40, 256, 256, k);
    expect(new Set([...izquierda, ...derecha])).toEqual(todo);
    expect(todo.size).toBeGreaterThan(100);
  });

  it("arma las tiras una vez por columna y las reusa en las áreas de abajo", () => {
    const f = fabricaFalsa();
    const g = new Grilla(f.crear, 4);
    const colores = { punto: "#ccc", mayor: "#999" };
    const destino = contextoConCanvas(256, 256);
    g.dibujar(destino.ctx, 0, 0, 256, 256, 20, 1, colores);
    g.dibujar(destino.ctx, 0, 256, 256, 256, 20, 1, colores);
    g.dibujar(destino.ctx, 256, 0, 256, 256, 20, 1, colores);
    expect(f.transparentes).toHaveLength(4); // dos tiras por columna
    const rellenos = f.transparentes.flatMap((t) => llamadasA(t.llamadas, "fill"));
    expect(rellenos).toHaveLength(2 * 3); // menor: 1 relleno, mayor: 2; por columna
  });
});

describe("pasoGrilla", () => {
  it("usa paso 1 cuando los puntos quedan bien separados", () => {
    expect(pasoGrilla(20)).toBe(1);
    expect(pasoGrilla(SEPARACION_MINIMA)).toBe(1);
  });

  it("ralea los puntos al alejar, de a factores de PASOS_POR_MAYOR", () => {
    expect(pasoGrilla(SEPARACION_MINIMA - 1)).toBe(PASOS_POR_MAYOR);
    expect(pasoGrilla(2)).toBe(PASOS_POR_MAYOR);
    expect(pasoGrilla(0.3)).toBe(PASOS_POR_MAYOR ** 3);
    for (const escala of [0.1, 0.5, 2, 7, 13, 40]) {
      expect(pasoGrilla(escala) * escala).toBeGreaterThanOrEqual(SEPARACION_MINIMA);
    }
  });
});
