import { describe, expect, it } from "vitest";
import { generarBanco } from "../render/banco";
import { componentesCableados, indexarHoja, recorridoCable, validarHoja } from "../core/model/cables";
import { borneDe } from "../core/model/cables";
import type { Cable, Extremo, Hoja } from "../core/model/documento";
import { direccionDe, opuesta } from "../core/model/ruteo";
import { planearTransformacion, prepararTransformacion, type Operacion } from "../core/model/seguir";
import type { Direccion } from "../core/symbols";
import { PASO_BANCO } from "../render/banco";
import { recorrido } from "../ui/diagnostico";
import { consultaHoja, consultaSuperpuesta, problemasTrazado } from "../core/model/trazado";
import { ARRASTRADOS_BANCO, BANCO_CABLES, BANCO_CABLES_T12, CABLES_POR_COMPONENTE, documentoBanco, documentoBancoCables, grupoCentralBanco } from "./banco";
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

  describe("el grupo del centro, con lugar alrededor", () => {
    const doc = documentoBancoCables(2000);
    const editor = new Editor(doc);
    const hoja = doc.hojas[0]!;
    const indice = indexarHoja(hoja);
    const grupo = grupoCentralBanco(doc);
    const enGrupo = new Set(grupo);
    const extremosEnGrupo = (w: Cable) => [w.desde, w.hasta].filter((e) => e.tipo === "borne" && enGrupo.has(e.comp)).length;
    const cruces = hoja.cables.filter((w) => extremosEnGrupo(w) === 1);

    it("son 40, todos cableados, y el anillo alrededor está vacío", () => {
      expect(grupo).toHaveLength(ARRASTRADOS_BANCO);
      expect(editor.tieneCables(grupo)).toBe(true);
      const cableados = componentesCableados(hoja);
      expect(grupo.filter((id) => !cableados.has(id))).toEqual([]);
      const { cx, cy } = (() => {
        const xs = hoja.componentes.map((c) => c.x);
        const ys = hoja.componentes.map((c) => c.y);
        return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
      })();
      const d = (c: { x: number; y: number }) => Math.hypot(c.x - cx, c.y - cy);
      const radio = Math.max(...hoja.componentes.filter((c) => enGrupo.has(c.id)).map(d));
      const enAnillo = hoja.componentes.filter((c) => !enGrupo.has(c.id) && d(c) <= radio + BANCO_CABLES.anillo * PASO_BANCO);
      expect(enAnillo).toEqual([]);
    });

    it("sus cables (internos y cruces) están tendidos como W: ninguno entra a un borne por el lado del cuerpo", () => {
      expect(cruces).toHaveLength(BANCO_CABLES.cruces);
      for (const w of hoja.cables.filter((x) => extremosEnGrupo(x) > 0)) {
        const p = recorridoCable(indice, w)!;
        const n = p.length;
        const lados: [Extremo, Direccion | null][] = [
          [w.desde, direccionDe(p[2]! - p[0]!, p[3]! - p[1]!)],
          [w.hasta, direccionDe(p[n - 4]! - p[n - 2]!, p[n - 3]! - p[n - 1]!)],
        ];
        for (const [e, salida] of lados) {
          if (e.tipo !== "borne") continue;
          const b = borneDe(indice.componentes.get(e.comp)!, e.borne)!;
          expect(salida, w.id).not.toBe(opuesta(b.direccion));
        }
      }
    });

    it("arrastrarlos por el recorrido de la prueba de la netbook vale en casi todos los puntos, y soltar en (3, 2) vale", () => {
      const prep = prepararTransformacion(hoja, grupo, editor.entornoPlan());
      expect(prep.rehechos).toBeGreaterThanOrEqual(BANCO_CABLES.cruces);
      const vistos = new Set<string>();
      let validos = 0;
      for (let t = 0; t < 6000; t += 50) {
        const { dx, dy } = recorrido(t);
        const k = `${Math.round(dx)},${Math.round(dy)}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        if (!prep.planear({ tipo: "mover", dx: Math.round(dx), dy: Math.round(dy) }).rechazo) validos++;
      }
      expect(validos / vistos.size).toBeGreaterThan(0.9);
      expect(prep.planear({ tipo: "mover", dx: 3, dy: 2 }).rechazo).toBeNull();
    });

    it("girarlos: con 2 cruces se acepta; con los 8 de la escena no (cada cruce da un cuarto de vuelta y con hasta 2 codos no hay ruta que no atraviese el grupo)", () => {
      const r = planearTransformacion(hoja, grupo, { tipo: "rotar", sentido: 90 }, editor.entornoPlan());
      expect(r.rechazo).not.toBeNull();
      const conDos = documentoBancoCables(2000, 1, { ...BANCO_CABLES, cruces: 2 });
      const h2 = conDos.hojas[0]!;
      for (const op of [{ tipo: "rotar", sentido: 90 }, { tipo: "rotar", sentido: -90 }, { tipo: "espejar" }] as Operacion[])
        expect(planearTransformacion(h2, grupoCentralBanco(conDos), op, new Editor(conDos).entornoPlan()).rechazo, JSON.stringify(op)).toBeNull();
    });

    it("las T del grupo cuelgan de los cruces, nunca de un cable interno", () => {
      const porId = new Map(hoja.cables.map((w) => [w.id, w]));
      const sobreCruces = derivaciones(hoja).filter((w) => w.desde.tipo === "cable" && extremosEnGrupo(porId.get(w.desde.cable)!) === 1);
      expect(sobreCruces.length).toBeGreaterThanOrEqual(BANCO_CABLES.cruces);
      expect(derivaciones(hoja).filter((w) => w.desde.tipo === "cable" && extremosEnGrupo(porId.get(w.desde.cable)!) === 2)).toEqual([]);
      expect(editor.escena.cantidadCables).toBe(3030);
    });
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
