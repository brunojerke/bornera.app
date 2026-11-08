import { describe, expect, it } from "vitest";
import { generarBanco } from "../render/banco";
import { documentoBanco } from "./banco";
import { Editor } from "./editor";

describe("documentoBanco", () => {
  it("tiene los mismos componentes que la escena del banco, con ids únicos", () => {
    const doc = documentoBanco(500);
    const comps = doc.hojas[0]!.componentes;
    const escena = generarBanco(500);
    expect(comps).toHaveLength(500);
    expect(new Set(comps.map((c) => c.id)).size).toBe(500);
    comps.forEach((c, i) => {
      const e = escena[i]!;
      expect(c).toMatchObject({ tipo: e.def.tipo, x: e.x, y: e.y, rot: e.rotacion, espejado: e.espejado, etiqueta: e.etiqueta });
    });
  });

  it("un Editor lo carga entero y se puede seleccionar todo con un rectángulo", () => {
    const editor = new Editor(documentoBanco(2000));
    expect(editor.escena.cantidad).toBe(2000);
    expect(editor.escena.idsEnCaja(editor.escena.caja!, "contiene")).toHaveLength(2000);
  });
});
