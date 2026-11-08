import { describe, expect, it } from "vitest";
import { generarBanco } from "../render/banco";
import { componentesCableados, validarHoja } from "../core/model/cables";
import { CABLES_POR_COMPONENTE, documentoBanco, documentoBancoCables, SIN_CABLES_BANCO } from "./banco";
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

describe("documentoBancoCables", () => {
  it("es válido, reproducible y tiene 1,5 cables por componente (con 100, menos: el centro va sin cables)", () => {
    for (const n of [100, 500, 2000]) {
      const doc = documentoBancoCables(n);
      const hoja = doc.hojas[0]!;
      expect(validarHoja(hoja), `${n}`).toEqual([]);
      if (n > 100) expect(hoja.cables.length, `${n}`).toBe(Math.round(n * CABLES_POR_COMPONENTE));
      else expect(hoja.cables.length).toBeGreaterThan(n);
      expect(documentoBancoCables(n)).toEqual(doc);
    }
  });

  it("los 40 del centro quedan sin cables y se pueden arrastrar", () => {
    const doc = documentoBancoCables(2000);
    const editor = new Editor(doc);
    const comps = doc.hojas[0]!.componentes;
    const cableados = componentesCableados(doc.hojas[0]!);
    const k = editor.escena.caja!;
    const cx = k.x + k.ancho / 2;
    const cy = k.y + k.alto / 2;
    const cercanos = [...comps].sort((a, b) => (a.x - cx) ** 2 + (a.y - cy) ** 2 - ((b.x - cx) ** 2 + (b.y - cy) ** 2));
    const libres = cercanos.slice(0, SIN_CABLES_BANCO / 2).map((c) => c.id);
    expect(libres.filter((id) => cableados.has(id))).toEqual([]);
    expect(editor.bloqueo("mover", libres)).toBeNull();
    expect(editor.escena.cantidadCables).toBe(3000);
  });
});
