import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIMBOLOS, buscarSimbolo } from "../core/symbols";
import { contextoFalso, llamadasA, Path2DFalso } from "./falsos";
import { LADO_MINIATURA, MARGEN_MINIATURA, TOPE_ESCALA_MINIATURA, dibujarMiniatura, escalaMiniatura, ladoFisico } from "./miniatura";

beforeEach(() => vi.stubGlobal("Path2D", Path2DFalso));
afterEach(() => vi.unstubAllGlobals());

describe("escalaMiniatura (D27-A)", () => {
  it("cada símbolo cabe en el lado útil de la casilla", () => {
    const util = LADO_MINIATURA - 2 * MARGEN_MINIATURA;
    for (const s of SIMBOLOS) {
      const e = escalaMiniatura(s.tamano);
      expect(s.tamano.ancho * e, s.tipo).toBeLessThanOrEqual(util + 1e-9);
      expect(s.tamano.alto * e, s.tipo).toBeLessThanOrEqual(util + 1e-9);
      expect(e, s.tipo).toBeLessThanOrEqual(TOPE_ESCALA_MINIATURA);
    }
  });

  it("el tope frena a los chicos (la Fase no llena la casilla); el grande se achica", () => {
    expect(escalaMiniatura({ ancho: 2, alto: 2 })).toBe(TOPE_ESCALA_MINIATURA);
    expect(escalaMiniatura({ ancho: 10, alto: 6 })).toBeCloseTo(3.2);
  });

  it("el lado físico sigue al dpr", () => {
    expect(ladoFisico(1)).toBe(36);
    expect(ladoFisico(1.25)).toBe(45);
    expect(ladoFisico(2)).toBe(72);
  });
});

describe("dibujarMiniatura", () => {
  it("fija el tamaño del canvas la primera vez y después solo lo borra", () => {
    const { ctx, canvas, llamadas } = contextoFalso();
    const def = buscarSimbolo("senalizacion.lampara")!;
    dibujarMiniatura(ctx, def, 1.5, "#123");
    expect(canvas).toEqual({ width: 54, height: 54 });
    expect(llamadasA(llamadas, "clearRect")).toHaveLength(0);
    dibujarMiniatura(ctx, def, 1.5, "#123");
    expect(llamadasA(llamadas, "clearRect")).toEqual([[0, 0, 54, 54]]);
  });

  it("centra el símbolo con la escala de la casilla y traza con el color del tema", () => {
    const { ctx, llamadas } = contextoFalso();
    const def = buscarSimbolo("motor.trifasico")!;
    dibujarMiniatura(ctx, def, 2, "#abc");
    const k = escalaMiniatura(def.tamano) * 2;
    expect(llamadasA(llamadas, "setTransform")[0]).toEqual([k, 0, 0, k, 36, 36]);
    expect(llamadas).toContainEqual(["=strokeStyle", "#abc"]);
    // El Path2D del símbolo, una vez (más los textos propios, sin nombres de borne).
    expect(llamadasA(llamadas, "stroke").length).toBeGreaterThan(0);
    const textos = llamadasA(llamadas, "fillText").map((l) => l[0]);
    expect(textos.every((t) => def.primitivas.some((p) => p.forma === "texto" && p.texto === t))).toBe(true);
  });
});
