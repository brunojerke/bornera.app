import { describe, expect, it } from "vitest";
import type { Primitiva } from "../core/symbols";
import { RendererCanvas } from "./canvas2d";
import { pasoGrilla, PASOS_POR_MAYOR, SEPARACION_MINIMA } from "./grilla";
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
