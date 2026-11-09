import { describe, expect, it } from "vitest";
import { generarBanco } from "../render/banco";
import { componentesCableados, indexarHoja, recorridoCable, validarHoja } from "../core/model/cables";
import type { Hoja } from "../core/model/documento";
import { consultaHoja, consultaSuperpuesta, problemasTrazado } from "../core/model/trazado";
import { ARRASTRADOS_BANCO, BANCO_CABLES, BANCO_CABLES_T12, CABLES_POR_COMPONENTE, documentoBanco, documentoBancoCables } from "./banco";
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
  /** Las derivaciones en T de la hoja: cables con un extremo sobre otro cable. */
  const derivaciones = (h: Hoja) => h.cables.filter((w) => w.desde.tipo === "cable" || w.hasta.tipo === "cable");
  /** Los `n` componentes más cercanos al centro de la caja de la escena. */
  const delCentro = (editor: Editor, n: number) => {
    const k = editor.escena.caja!;
    const cx = k.x + k.ancho / 2;
    const cy = k.y + k.alto / 2;
    const d = (c: { x: number; y: number }) => (c.x - cx) ** 2 + (c.y - cy) ** 2;
    return [...editor.documento.hojas[0]!.componentes].sort((a, b) => d(a) - d(b)).slice(0, n).map((c) => c.id);
  };

  it("es válida y reproducible: 1,5 cables por componente más 30 derivaciones en T", () => {
    for (const n of [100, 500, 2000]) {
      const doc = documentoBancoCables(n);
      const hoja = doc.hojas[0]!;
      expect(validarHoja(hoja), `${n}`).toEqual([]);
      expect(derivaciones(hoja), `${n}`).toHaveLength(BANCO_CABLES.derivaciones);
      if (n > 100) expect(hoja.cables.length, `${n}`).toBe(Math.round(n * CABLES_POR_COMPONENTE) + BANCO_CABLES.derivaciones);
      expect(documentoBancoCables(n)).toEqual(doc);
    }
  });

  it("las T no crean conexiones aparentes, y hay cadenas A ← B ← C", () => {
    const hoja = documentoBancoCables(2000).hojas[0]!;
    const indice = indexarHoja(hoja);
    const ts = derivaciones(hoja);
    const ids = new Set(ts.map((w) => w.id));
    const base = consultaHoja(hoja, indice);
    for (const w of ts) {
      const puntos = recorridoCable(indice, w)!;
      // Como al tenderla con W: sin ella y sin las que después se apoyaron en ella.
      const quitar = new Set([w.id, ...ts.filter((k) => k.desde.tipo === "cable" && k.desde.cable === w.id).map((k) => k.id)]);
      expect(problemasTrazado({ id: w.id, desde: w.desde, hasta: w.hasta, puntos }, consultaSuperpuesta(base, { quitar })), w.id).toEqual([]);
    }
    const enCadena = ts.filter((w) => w.desde.tipo === "cable" && ids.has(w.desde.cable));
    expect(enCadena).toHaveLength(Math.floor(BANCO_CABLES.derivaciones / 3));
  });

  it("los 40 del centro tienen cables, y la mitad de las T cuelga de cables suyos", () => {
    const doc = documentoBancoCables(2000);
    const editor = new Editor(doc);
    const hoja = doc.hojas[0]!;
    const centro = delCentro(editor, ARRASTRADOS_BANCO);
    const cableados = componentesCableados(hoja);
    expect(centro.filter((id) => !cableados.has(id))).toEqual([]);
    const porId = new Map(hoja.cables.map((w) => [w.id, w]));
    const sobreCentro = derivaciones(hoja).filter((w) => {
      const a = w.desde.tipo === "cable" ? porId.get(w.desde.cable)! : null;
      return a !== null && [a.desde, a.hasta].some((e) => e.tipo === "borne" && centro.includes(e.comp));
    });
    expect(sobreCentro.length).toBeGreaterThanOrEqual(BANCO_CABLES.derivaciones / 2);
    expect(editor.escena.cantidadCables).toBe(3030);
  });

  it("la escena de T12 (para comparar): los 40 del centro sin cables y sin T", () => {
    const doc = documentoBancoCables(2000, 1, BANCO_CABLES_T12);
    const editor = new Editor(doc);
    const hoja = doc.hojas[0]!;
    expect(validarHoja(hoja)).toEqual([]);
    expect(derivaciones(hoja)).toEqual([]);
    expect(hoja.cables).toHaveLength(3000);
    // Los 20 más cercanos: el centro de la caja de la escena no es exactamente el de las posiciones.
    expect(editor.tieneCables(delCentro(editor, BANCO_CABLES_T12.centroSinCables / 2))).toBe(false);
  });
});
