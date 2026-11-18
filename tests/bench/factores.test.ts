// K1 y K2 (D6a-B, docs/plan-fase4.md, C1 y C4) de los textos de «Copiar» de
// «Probar la fase 4»: mediana por máquina, cociente netbook / PC por fila y
// mediana de los cocientes del grupo.
import { describe, expect, it } from "vitest";
import { factores, valoresK } from "./factores.mjs";

/** Un texto de «Copiar» con las columnas de la fase 4; `k` es la celda K de cada fila. */
const texto = (k: Record<string, string>) =>
  [
    "Probar la fase 4 · Bornera 0.1.4-alpha.2 · hoy · Edg/157",
    "",
    "| # | Escenario | Medida | Tope netbook | Netbook | Resultado | K |",
    "|---|---|---|---|---|---|---|",
    ...Object.entries(k).map(([id, c]) => `| ${id} | x | y | z | 1,0 ms | pasa | ${c} |`),
    "",
    "Pasan 1 · no pasan 0 · se anotan 0.",
  ].join("\n");

describe("valoresK", () => {
  it("lee el grupo y el número de la columna K; las filas con «—» no entran", () => {
    const v = valoresK(texto({ B1: "K1: 49,5", B8: "—", F3: "K2: 250,0" }));
    expect([...v.values()]).toEqual([
      { id: "B1", grupo: "K1", valor: 49.5 },
      { id: "F3", grupo: "K2", valor: 250 },
    ]);
  });

  it("un texto de «Probar la fase 3b» (sin K) no tiene filas", () => {
    const fase3b = "| # | Escenario | Medida | Tope netbook | Netbook | Resultado |\n| B1 | x | y | z | 49,0 / 91,0 ms | pasa |";
    expect(valoresK(fase3b).size).toBe(0);
    expect(() => factores([fase3b], [fase3b])).toThrow(/columna K/);
  });
});

describe("factores", () => {
  it("cociente de las medianas de cada máquina, y K = mediana de los cocientes del grupo", () => {
    const pc = [texto({ B1: "K1: 10,0", B2: "K1: 2,0", B7: "K1: 1,0", B3: "K2: 10,0", F3: "K2: 100,0" })];
    const netbook = [
      texto({ B1: "K1: 25,0", B2: "K1: 6,0", B7: "K1: 4,0", B3: "K2: 50,0", F3: "K2: 600,0" }),
      texto({ B1: "K1: 35,0", B2: "K1: 6,0", B7: "K1: 4,0", B3: "K2: 60,0", F3: "K2: 500,0" }),
      texto({ B1: "K1: 30,0", B2: "K1: 7,0", B7: "K1: 2,0", B3: "K2: 55,0", F3: "K2: 550,0" }),
    ];
    const r = factores(pc, netbook);
    expect(r.filas.map((f) => [f.id, f.netbook, f.cociente])).toEqual([
      ["B1", 30, 3],
      ["B2", 6, 3],
      ["B7", 4, 4],
      ["B3", 55, 5.5],
      ["F3", 550, 5.5],
    ]);
    expect(r.K1).toBe(3);
    expect(r.K2).toBe(5.5);
  });

  it("una fila con 0 en la PC no da cociente y no entra en K", () => {
    const r = factores([texto({ B1: "K1: 0,0", B2: "K1: 2,0" })], [texto({ B1: "K1: 0,1", B2: "K1: 5,0" })]);
    expect(r.filas[0]!.cociente).toBeNull();
    expect(r.K1).toBe(2.5);
  });

  it("si una corrida de la netbook no tiene una fila de la PC, falla", () => {
    expect(() => factores([texto({ B1: "K1: 1,0" })], [texto({ B2: "K1: 1,0" })])).toThrow(/B1/);
  });
});
