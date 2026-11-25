// Fuente de 4 bornes (T34, ajuste 2): L1, L2, L3 y N, armada en el test con el
// tipo `fuente.trifasica_n` de T35, que todavía no está en la biblioteca. Se
// suma a `buscarSimbolo` solo en este archivo (vi.mock alcanza también a
// `redes`, que la netlist usa para las redes por cables).
import { describe, expect, it, vi } from "vitest";
import type { Componente, Hoja } from "../model/documento";
import type { DefinicionSimbolo } from "../symbols";

const CUATRO: DefinicionSimbolo = {
  tipo: "fuente.trifasica_n",
  nombre: "Fuente trifásica con neutro (prueba)",
  subgrupo: "fuentes",
  elemento: "fuente",
  tamano: { ancho: 8, alto: 2 },
  primitivas: [],
  bornes: ["L1", "L2", "L3", "N"].map((nombre, i) => ({ nombre, x: -3 + 2 * i, y: 1, direccion: "abajo" as const })),
};

vi.mock("../symbols", async (original) => {
  const m = await original<typeof import("../symbols")>();
  return { ...m, buscarSimbolo: (tipo: string) => (tipo === CUATRO.tipo ? CUATRO : m.buscarSimbolo(tipo)) };
});

const { armarNetlist } = await import("./netlist");
const { redes } = await import("../model/redes");

function comp(id: string, tipo: string, etiqueta = ""): Componente {
  return { id, tipo, x: 0, y: 0, rot: 0, espejado: false, etiqueta, params: {} };
}

describe("netlist: fuente de 4 bornes (T34, ajuste 2)", () => {
  const h: Hoja = { nombre: "Hoja 1", componentes: [comp("t", CUATRO.tipo, "Red"), comp("n", "fuente.neutro", "N"), comp("f", "fuente.fase", "N")], cables: [] };
  const n = armarNetlist(h);
  const red = (c: string, b: string) => n.redDeBorne.get(c)!.get(b)!;

  it("N da neutro y L1–L3, fases", () => {
    expect(n.potenciales).toEqual([
      { papel: "fase", nombre: "L1" },
      { papel: "fase", nombre: "L2" },
      { papel: "fase", nombre: "L3" },
      { papel: "fase", nombre: "N" },
      { papel: "neutro", nombre: "N" },
    ]);
    expect(n.redes[red("t", "N")]!.potenciales).toEqual([4]);
  });

  it("su N es la red del Neutro «N», no la de una Fase «N»", () => {
    expect(red("t", "N")).toBe(red("n", "N"));
    expect(red("t", "N")).not.toBe(red("f", "L"));
    expect(n.enCorto).toEqual([]);
  });

  it("en redes(), cada borne nombra su red (D2-A)", () => {
    const porBorne = new Map(redes(h).flatMap((r) => r.bornes.filter((b) => b.comp === "t").map((b) => [b.borne, r.nombres] as const)));
    expect(Object.fromEntries(porBorne)).toEqual({ L1: ["L1"], L2: ["L2"], L3: ["L3"], N: ["N"] });
  });
});
