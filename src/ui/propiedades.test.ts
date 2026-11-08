import { describe, expect, it } from "vitest";
import {
  abrirAlSeleccionar,
  textoCambioRed,
  textoCantidad,
  textoEtiqueta,
  textoExtremo,
  textoRed,
  textoRotacion,
} from "./propiedades";

describe("abrirAlSeleccionar", () => {
  it("se abre al pasar de nada a algo seleccionado", () => {
    expect(abrirAlSeleccionar(0, 1, false)).toBe(true);
    expect(abrirAlSeleccionar(0, 5, false)).toBe(true);
  });

  it("no se abre si el usuario lo plegó", () => {
    expect(abrirAlSeleccionar(0, 1, true)).toBe(false);
  });

  it("no hace nada al cambiar una selección que ya había, ni al deseleccionar", () => {
    expect(abrirAlSeleccionar(1, 2, false)).toBe(false);
    expect(abrirAlSeleccionar(2, 0, false)).toBe(false);
    expect(abrirAlSeleccionar(0, 0, false)).toBe(false);
  });
});

describe("textoCantidad", () => {
  it("singular y plural", () => {
    expect(textoCantidad(1)).toBe("1 componente seleccionado");
    expect(textoCantidad(2000)).toBe("2000 componentes seleccionados");
  });

  it("con cables, solos o mezclados", () => {
    expect(textoCantidad(0, 1)).toBe("1 cable seleccionado");
    expect(textoCantidad(0, 3000)).toBe("3000 cables seleccionados");
    expect(textoCantidad(2, 1)).toBe("2 componentes y 1 cable seleccionados");
    expect(textoCantidad(1, 1)).toBe("1 componente y 1 cable seleccionados");
  });
});

describe("textoExtremo", () => {
  it("borne, sobre otro cable o suelto", () => {
    expect(textoExtremo({ tipo: "borne", etiqueta: "K1", borne: "A1" })).toBe("K1 · A1");
    expect(textoExtremo({ tipo: "cable" })).toBe("Sobre otro cable");
    expect(textoExtremo({ tipo: "libre" })).toBe("Suelto");
  });
});

describe("textos del panel", () => {
  it("etiqueta y rotación: vacía, común o Varias", () => {
    expect(textoEtiqueta("K1")).toBe("K1");
    expect(textoEtiqueta("")).toBe("—");
    expect(textoEtiqueta(null)).toBe("Varias");
    expect(textoRotacion(90)).toBe("90°");
    expect(textoRotacion(null)).toBe("Varias");
  });

  it("red de una fuente", () => {
    expect(textoRed("L1", 0)).toBe("Red L1: sin otras alimentaciones");
    expect(textoRed("L1", 1)).toBe("Red L1: unida a 1 alimentación más");
    expect(textoRed("L1", 2)).toBe("Red L1: unida a 2 alimentaciones más");
    expect(textoCambioRed("L", "L1")).toBe("Al confirmar pasa de la red L a la red L1");
    expect(textoCambioRed("", "L1")).toBe("Al confirmar pasa a la red L1");
  });
});
