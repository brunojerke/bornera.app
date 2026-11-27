import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIMBOLOS } from "../core/symbols";
import { contextoFalso, llamadasA, Path2DFalso, type ContextoFalso } from "../render/falsos";
import { Miniaturas } from "./miniaturas";

beforeEach(() => vi.stubGlobal("Path2D", Path2DFalso));
afterEach(() => vi.unstubAllGlobals());

/** Las 49 registradas, con un entorno falso de tema y dpr que se puede cambiar. */
function armar() {
  const entorno = { color: "#111", dpr: 1 };
  const contextos = new Map<HTMLCanvasElement, ContextoFalso>();
  const m = new Miniaturas({
    color: () => entorno.color,
    dpr: () => entorno.dpr,
    contexto: (c) => contextos.get(c)!.ctx,
  });
  const canvases = SIMBOLOS.map((def) => {
    const canvas = {} as HTMLCanvasElement;
    contextos.set(canvas, contextoFalso());
    m.registrar(canvas, def);
    return canvas;
  });
  /** Cuántas veces se dibujó cada una: un trazo del Path2D por dibujo (y alguno más si tiene relleno). */
  const dibujos = () => canvases.map((c) => llamadasA(contextos.get(c)!.llamadas, "setTransform").length);
  return { m, entorno, canvases, contextos, dibujos };
}

describe("Miniaturas (D29-A)", () => {
  it("antes del arranque no dibuja nada al registrar", () => {
    const { m, dibujos } = armar();
    expect(m.cantidad).toBe(49);
    expect(m.arrancada).toBe(false);
    expect(dibujos().every((n) => n === 0)).toBe(true);
  });

  it("al arrancar dibuja las 49 una vez; sin tema ni dpr nuevo no redibuja", () => {
    const { m, dibujos } = armar();
    expect(m.actualizar()).toBe(49);
    const primera = dibujos();
    expect(primera.every((n) => n > 0)).toBe(true);
    expect(m.actualizar()).toBe(0);
    expect(dibujos()).toEqual(primera);
  });

  it("un tema o un dpr nuevo las rehace todas", () => {
    const { m, entorno, contextos, canvases } = armar();
    m.actualizar();
    entorno.color = "#eee";
    expect(m.actualizar()).toBe(49);
    expect(contextos.get(canvases[0]!)!.llamadas).toContainEqual(["=strokeStyle", "#eee"]);
    entorno.dpr = 2;
    expect(m.actualizar()).toBe(49);
    expect(contextos.get(canvases[0]!)!.canvas.width).toBe(72);
  });

  it("rehacer (P1) dibuja las 49 de cero aunque nada cambie", () => {
    const { m, dibujos } = armar();
    m.actualizar();
    const antes = dibujos();
    expect(m.rehacer()).toBe(49);
    expect(dibujos().every((n, i) => n > antes[i]!)).toBe(true);
  });

  it("después del arranque, un ítem nuevo se dibuja solo; uno quitado ya no se dibuja", () => {
    const { m, canvases, contextos } = armar();
    m.actualizar();
    m.quitar(canvases[0]!);
    expect(m.cantidad).toBe(48);
    const nuevo = {} as HTMLCanvasElement;
    contextos.set(nuevo, contextoFalso());
    m.registrar(nuevo, SIMBOLOS[0]!);
    expect(llamadasA(contextos.get(nuevo)!.llamadas, "setTransform").length).toBeGreaterThan(0);
    expect(m.rehacer()).toBe(49);
  });
});
