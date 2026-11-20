import { describe, expect, it } from "vitest";
import { inversion } from "../circuitos/inversion";
import { marchaParada } from "../circuitos/marchaParada";
import { serializar } from "../io";
import type { Cable, Componente, Hoja } from "../model/documento";
import { redes } from "../model/redes";
import { armarNetlist, compararEtiquetas, type Netlist } from "./netlist";
import { particion, particionEsperada } from "./prueba-netlist";

// ── Ayudas ────────────────────────────────────────────────────────────────

function comp(id: string, tipo: string, etiqueta = ""): Componente {
  return { id, tipo, x: 0, y: 0, rot: 0, espejado: false, etiqueta, params: {} };
}

function cable(id: string, [c1, b1]: [string, string], [c2, b2]: [string, string]): Cable {
  return { id, desde: { tipo: "borne", comp: c1, borne: b1 }, hasta: { tipo: "borne", comp: c2, borne: b2 }, codos: [] };
}

function hoja(componentes: Componente[], cables: Cable[] = []): Hoja {
  return { nombre: "Hoja 1", componentes, cables };
}

const red = (n: Netlist, c: string, b: string): number => {
  const r = n.redDeBorne.get(c)?.get(b);
  if (r === undefined) throw new Error(`${c}:${b} sin red`);
  return r;
};

// ── Mínimos (Bruno, plan-T28) ─────────────────────────────────────────────

describe("netlist: potenciales (D7) y corto por cables (D10-A)", () => {
  it("Fase «N» y Neutro «N» son potenciales distintos y no se unen por nombre", () => {
    const h = hoja([comp("c1", "fuente.fase", "N"), comp("c2", "fuente.neutro", "N")]);
    const n = armarNetlist(h);
    expect(n.potenciales).toEqual([
      { papel: "fase", nombre: "N" },
      { papel: "neutro", nombre: "N" },
    ]);
    expect(red(n, "c1", "L")).not.toBe(red(n, "c2", "N"));
    expect(n.redes[red(n, "c1", "L")]!.potenciales).toEqual([0]);
    expect(n.redes[red(n, "c2", "N")]!.potenciales).toEqual([1]);
    expect(n.enCorto).toEqual([]);
    // `redes` con `unirPorNombre` sí los uniría: por eso la netlist no lo usa.
    expect(redes(h, { unirPorNombre: true })).toHaveLength(1);
  });

  it("dos fases unidas solo por cables: una red con dos potenciales, marcada y sin error", () => {
    const h = hoja([comp("c1", "fuente.fase", "L1"), comp("c2", "fuente.fase", "L2")], [cable("w1", ["c1", "L"], ["c2", "L"])]);
    const n = armarNetlist(h);
    expect(n.redes).toHaveLength(1);
    expect(n.potenciales).toEqual([
      { papel: "fase", nombre: "L1" },
      { papel: "fase", nombre: "L2" },
    ]);
    expect(n.redes[0]!.potenciales).toEqual([0, 1]);
    expect(n.enCorto).toEqual([0]);
  });

  it("Fase «N» y Neutro «N» unidos por un cable: corto", () => {
    const h = hoja([comp("c1", "fuente.fase", "N"), comp("c2", "fuente.neutro", "N")], [cable("w1", ["c1", "L"], ["c2", "N"])]);
    expect(armarNetlist(h).enCorto).toEqual([0]);
  });

  it("dos Fase «L1» sin cable quedan en una red; «l1 » se normaliza a «L1»", () => {
    const h = hoja([comp("c1", "fuente.fase", "L1"), comp("c2", "fuente.fase", " l1 "), comp("c3", "fuente.fase", "L2")]);
    const n = armarNetlist(h);
    expect(red(n, "c1", "L")).toBe(red(n, "c2", "L"));
    expect(red(n, "c1", "L")).not.toBe(red(n, "c3", "L"));
    expect(n.potenciales.map((p) => p.nombre)).toEqual(["L1", "L2"]);
    expect(n.enCorto).toEqual([]);
  });

  it("misma partición que redes() salvo las uniones por papel + nombre", () => {
    const h = hoja(
      [
        comp("c1", "fuente.fase", "L1"),
        comp("c2", "senalizacion.lampara", "H1"),
        comp("c3", "fuente.fase", "L1"),
        comp("c4", "fuente.neutro", "L1"),
        comp("c5", "fuente.neutro", "N"),
        comp("c6", "fuente.fase", "N"),
        comp("c7", "senalizacion.lampara", "H2"),
      ],
      [cable("w1", ["c1", "L"], ["c2", "X1"]), cable("w2", ["c2", "X2"], ["c5", "N"]), cable("w3", ["c6", "L"], ["c7", "X1"])],
    );
    const n = armarNetlist(h);
    expect(particion(n.redes)).toEqual(particionEsperada(h));
    // Une las dos Fase «L1» (c1 y c3), no el Neutro «L1» (c4) ni la Fase «N» con el Neutro «N».
    expect(red(n, "c1", "L")).toBe(red(n, "c3", "L"));
    expect(red(n, "c4", "N")).not.toBe(red(n, "c1", "L"));
    expect(red(n, "c6", "L")).not.toBe(red(n, "c5", "N"));
    // `redes` con `unirPorNombre` une además por nombre sin papel: esa es la única diferencia.
    expect(particion(redes(h, { unirPorNombre: true }))).not.toEqual(particion(n.redes));
  });

  it("en los circuitos de referencia, la misma partición que redes() unida por nombre", () => {
    for (const doc of [marchaParada().doc, marchaParada({ dosNeutros: true }).doc, marchaParada({ ramaNC: true }).doc, inversion().doc]) {
      const h = doc.hojas[0]!;
      const n = armarNetlist(h);
      expect(particion(n.redes)).toEqual(particionEsperada(h));
      expect(particion(n.redes)).toEqual(particion(redes(h, { unirPorNombre: true })));
    }
  });
});

describe("netlist: orden natural de etiquetas (D2)", () => {
  it("K1, K2, K10", () => {
    expect(["K10", "K2", "K1"].sort(compararEtiquetas)).toEqual(["K1", "K2", "K10"]);
    expect(["KA", "K10", "K01", "K1", "K", "H2", "K2A", "K2"].sort(compararEtiquetas)).toEqual(["H2", "K", "K01", "K1", "K2", "K2A", "K10", "KA"]);
    expect(compararEtiquetas("K99999999999999999999", "K100000000000000000000")).toBeLessThan(0);
  });

  it("las bobinas salen en ese orden, sea cual sea el de la hoja", () => {
    const n = armarNetlist(
      hoja([
        comp("c1", "contactor.bobina", "K10"),
        comp("c2", "contactor.bobina", "K2"),
        comp("c3", "contactor.bobina", "k1"),
        comp("c4", "contactor.bobina", ""),
      ]),
    );
    expect(n.bobinas.map((b) => b.etiqueta)).toEqual(["K1", "K2", "K10"]);
    expect(n.bobinas.map((b) => n.cargas[b.cargas[0]!]!.comp)).toEqual(["c3", "c2", "c1"]);
    // La bobina sin etiqueta es carga, pero no está en ningún grupo.
    expect(n.cargas).toHaveLength(4);
  });
});

// ── Circuitos de referencia ───────────────────────────────────────────────

describe("netlist: circuitos de referencia", () => {
  it("marcha-parada: redes, potenciales, contactos y cargas", () => {
    const { doc, comp: c } = marchaParada();
    const n = armarNetlist(doc.hojas[0]!);
    expect(n.redes).toHaveLength(4);
    expect(n.potenciales).toEqual([
      { papel: "fase", nombre: "L" },
      { papel: "neutro", nombre: "N" },
    ]);
    expect(n.enCorto).toEqual([]);
    expect(red(n, c.fase, "L")).toBe(red(n, c.s0, "11"));
    expect(new Set([red(n, c.s0, "12"), red(n, c.s1, "13"), red(n, c.k1Auxiliar, "13")]).size).toBe(1);
    expect(new Set([red(n, c.s1, "14"), red(n, c.k1Auxiliar, "14"), red(n, c.k1Bobina, "A1"), red(n, c.h1, "X1")]).size).toBe(1);
    expect(new Set([red(n, c.k1Bobina, "A2"), red(n, c.h1, "X2"), red(n, c.neutro, "N")]).size).toBe(1);
    expect(n.redes[red(n, c.fase, "L")]!.potenciales).toEqual([0]);
    expect(n.redes[red(n, c.neutro, "N")]!.potenciales).toEqual([1]);
    expect(n.contactos.map(({ comp, etiqueta, na, accionamiento }) => ({ comp, etiqueta, na, accionamiento }))).toEqual([
      { comp: c.s0, etiqueta: "S0", na: false, accionamiento: "manual_momentaneo" },
      { comp: c.s1, etiqueta: "S1", na: true, accionamiento: "manual_momentaneo" },
      { comp: c.k1Auxiliar, etiqueta: "K1", na: true, accionamiento: "bobina" },
    ]);
    expect(n.cargas.map(({ comp, etiqueta, tipo }) => ({ comp, etiqueta, tipo }))).toEqual([
      { comp: c.k1Bobina, etiqueta: "K1", tipo: "bobina" },
      { comp: c.h1, etiqueta: "H1", tipo: "carga" },
    ]);
    expect(n.bobinas).toEqual([{ etiqueta: "K1", cargas: [0] }]);
  });

  it("marcha-parada con dos neutros: se unen por etiqueta de red, sin cable", () => {
    const { doc, comp: c } = marchaParada({ dosNeutros: true });
    const h = doc.hojas[0]!;
    const n = armarNetlist(h);
    expect(redes(h)).toHaveLength(5);
    expect(n.redes).toHaveLength(4);
    expect(red(n, c.neutro, "N")).toBe(red(n, c.neutro2!, "N"));
    expect(n.potenciales).toHaveLength(2);
  });

  it("inversión: enclavamiento por los NC y bobinas K1, K2", () => {
    const { doc, comp: c } = inversion();
    const n = armarNetlist(doc.hojas[0]!);
    expect(n.enCorto).toEqual([]);
    expect(n.bobinas.map((b) => b.etiqueta)).toEqual(["K1", "K2"]);
    const contacto = (id: string) => n.contactos.find((k) => k.comp === id)!;
    const entre = (id: string) => new Set([contacto(id).a, contacto(id).b]);
    // El NC de K2 está entre S1·14 y la bobina K1; el de K1, entre S2·14 y la bobina K2.
    expect(contacto(c.k2AuxiliarNC)).toMatchObject({ etiqueta: "K2", na: false, accionamiento: "bobina" });
    expect(entre(c.k2AuxiliarNC)).toEqual(new Set([red(n, c.s1, "14"), red(n, c.k1Bobina, "A1")]));
    expect(contacto(c.k1AuxiliarNC)).toMatchObject({ etiqueta: "K1", na: false, accionamiento: "bobina" });
    expect(entre(c.k1AuxiliarNC)).toEqual(new Set([red(n, c.s2, "14"), red(n, c.k2Bobina, "A1")]));
    expect(red(n, c.h1, "X1")).toBe(red(n, c.k1Bobina, "A1"));
    expect(red(n, c.s2, "13")).toBe(red(n, c.s0, "12"));
    expect(new Set([red(n, c.k1Bobina, "A2"), red(n, c.k2Bobina, "A2"), red(n, c.h2, "X2"), red(n, c.neutro, "N")]).size).toBe(1);
    expect(n.contactos).toHaveLength(7);
    expect(n.cargas).toHaveLength(4);
  });

  it("no cambia el documento", () => {
    const { doc } = inversion();
    const antes = serializar(doc);
    armarNetlist(doc.hojas[0]!);
    expect(serializar(doc)).toBe(antes);
  });
});

// ── Bordes ────────────────────────────────────────────────────────────────

describe("netlist: bordes", () => {
  it("hoja vacía", () => {
    expect(armarNetlist(hoja([]))).toEqual({ redes: [], potenciales: [], redDeBorne: new Map(), enCorto: [], contactos: [], cargas: [], bobinas: [] });
  });

  it("símbolo desconocido: sin bornes, ni contacto ni carga", () => {
    const n = armarNetlist(hoja([comp("c1", "x.raro", "K1")]));
    expect(n.redes).toEqual([]);
    expect(n.redDeBorne.has("c1")).toBe(false);
    expect(n.contactos).toEqual([]);
    expect(n.cargas).toEqual([]);
  });

  it("carga sin cables: cada borne en su red, sin potencial", () => {
    const n = armarNetlist(hoja([comp("c1", "senalizacion.lampara", "H1")]));
    expect(n.redes).toHaveLength(2);
    expect(n.cargas).toEqual([{ comp: "c1", etiqueta: "H1", tipo: "carga", a: 0, b: 1 }]);
    expect(n.redes.every((r) => r.potenciales.length === 0)).toBe(true);
  });

  it("fuente sin etiqueta: no da potencial (N2-A)", () => {
    const n = armarNetlist(hoja([comp("c1", "fuente.fase", "  "), comp("c2", "fuente.fase", "")]));
    expect(n.potenciales).toEqual([]);
    expect(red(n, "c1", "L")).not.toBe(red(n, "c2", "L"));
  });

  it("cable roto: no une ni tira", () => {
    const roto: Cable = { id: "w1", desde: { tipo: "borne", comp: "c9", borne: "A1" }, hasta: { tipo: "borne", comp: "c1", borne: "X1" }, codos: [] };
    const n = armarNetlist(hoja([comp("c1", "senalizacion.lampara", "H1")], [roto]));
    expect(n.redes).toHaveLength(2);
    expect(n.redes[red(n, "c1", "X1")]!.cables).toEqual(["w1"]);
  });
});
