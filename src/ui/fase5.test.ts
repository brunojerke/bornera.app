import { describe, expect, it } from "vitest";
import { celdaK, textoFase4 } from "./fase4";
import { filasS, notasS, NOTA_DESGLOSE_S1, NOTA_PARED_S5, TOPES_S_NETBOOK, type MuestrasS } from "./fase5";

const s1 = (total: number) => ({ r4: 0.2, netlist: 4, iniciar: 1, cuadro: total - 5.2, total, cuadros: 3 });
const muestras = (cambio: Partial<MuestrasS> = {}): MuestrasS => ({
  s1: [s1(30), s1(32.25), s1(28)],
  s2: [0.4, 0.5, 0.6, 2],
  s3: [6, 7, 8],
  s5: [
    { trabajo: 80, pared: 150, tramos: 40, avisos: 13394 },
    { trabajo: 90, pared: 160, tramos: 41, avisos: 13394 },
  ],
  ...cambio,
});

describe("filasS", () => {
  it("da S1–S5 con lo medido en el formato de la tabla", () => {
    const f = filasS(muestras());
    expect(f.map((x) => x.id)).toEqual(["S1", "S2", "S3", "S4", "S5"]);
    expect(f.map((x) => x.valor)).toEqual(["32,3 / 30,0 ms", "0,6 / 2,0 ms", "8,0 / 7,0 ms", "se mide en T33", "90,0 / 90,0 ms"]);
    expect(f.map((x) => x.resultado)).toEqual(["pasa", "pasa", "pasa", "se anota", "pasa"]);
    expect(f.map((x) => x.tope)).toEqual(["≤ 300 ms (máx.)", "≤ 5 / 16 ms", "≤ 50 ms (máx.)", "≤ 33 / 100 ms", "≤ 300 ms (máx.)"]);
  });

  it("juzga con los topes de la netbook: el máximo (S2, también la mediana)", () => {
    const t = TOPES_S_NETBOOK;
    const f = filasS(
      muestras({
        s1: [s1(t.S1 + 0.1)],
        s2: [t.S2[0] + 1, t.S2[0] + 1, 1],
        s3: [t.S3],
        s5: [{ trabajo: t.S5 + 1, pared: 0, tramos: 1, avisos: 0 }],
      }),
    );
    expect(f.map((x) => x.resultado)).toEqual(["no pasa", "no pasa", "pasa", "se anota", "no pasa"]);
    expect(filasS(muestras({ s2: [1, 1, t.S2[1] + 0.1] }))[1]!.resultado).toBe("no pasa");
  });

  it("sin vueltas no pasa", () => {
    const f = filasS({ s1: [], s2: [], s3: [], s5: [] });
    expect(f.filter((x) => x.resultado === "pasa")).toEqual([]);
  });

  it("las S no llevan K (K no se recalcula en la fase 5)", () => {
    for (const x of filasS(muestras())) expect(celdaK(x.id, x.valor)).toBe("—");
  });
});

describe("notasS", () => {
  it("trae el desglose de S1 (la netlist sola informa) y la pared de S5", () => {
    const n = notasS(muestras(), { componentes: 2000, cables: 2200, bobinas: 300 });
    const desglose = n.find((l) => l.startsWith(NOTA_DESGLOSE_S1));
    expect(desglose).toBe(`${NOTA_DESGLOSE_S1} R4 0,2 · netlist 4,0 · iniciar 1,0 · cuadro 27,1 (3 cuadros como máximo).`);
    expect(n.find((l) => l.startsWith(NOTA_PARED_S5))).toBe(`${NOTA_PARED_S5} máx. 160,0 / mediana 160,0 · 40 tramos y 13394 avisos R11 por vuelta.`);
  });

  it("entra en la tabla de «Copiar» con B y F", () => {
    const texto = textoFase4(filasS(muestras()), "Probar la fase 5 · prueba", notasS(muestras(), { componentes: 2000, cables: 2200, bobinas: 300 }));
    expect(texto).toContain("| S2 | Pulsar y soltar una marcha (mando 2000), sin dibujo | mediana / máx. de 4 | ≤ 5 / 16 ms | 0,6 / 2,0 ms | pasa | — |");
    expect(texto).toMatch(/Pasan 4 · no pasan 0 · se anotan 1\.$/);
  });
});
