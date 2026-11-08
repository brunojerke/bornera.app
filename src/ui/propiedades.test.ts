import { describe, expect, it } from "vitest";
import { abrirAlSeleccionar, textoCantidad } from "./propiedades";

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
});
