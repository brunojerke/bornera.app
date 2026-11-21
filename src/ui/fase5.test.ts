import { describe, expect, it } from "vitest";
import { celdaK, textoFase4 } from "./fase4";
import { filasS, notasS, NOTA_CADENA_S4, NOTA_DESGLOSE_S1, NOTA_PARED_S5, TOPES_S_NETBOOK, VUELTAS_S, type MuestrasS } from "./fase5";

const s1 = (total: number) => ({ r4: 0.2, netlist: 4, iniciar: 1, cuadro: total - 5.2, total, cuadros: 3 });
const g = (cuadro: number, gesto: number, cuadros = 2) => ({ cuadro, gesto, cuadros });
const muestras = (cambio: Partial<MuestrasS> = {}): MuestrasS => ({
  s1: [s1(30), s1(32.25), s1(28)],
  s2: [0.4, 0.5, 0.6, 2],
  s3: [6, 7, 8],
  s4: [g(2.5, 4), g(3.25, 6.5, 3), g(2, 3)],
  s4Cadena: [g(4, 20, 9), g(4.5, 24, 10)],
  s5: [
    { trabajo: 80, pared: 150, tramos: 40, avisos: 13394 },
    { trabajo: 90, pared: 160, tramos: 41, avisos: 13394 },
  ],
  ...cambio,
});

describe("filasS", () => {
  it("da S1–S5 con lo medido en el formato de la tabla; S4 con su máximo de cuadro y de gesto (T33)", () => {
    const f = filasS(muestras());
    expect(f.map((x) => x.id)).toEqual(["S1", "S2", "S3", "S4", "S5"]);
    expect(f.map((x) => x.valor)).toEqual(["32,3 / 30,0 ms", "0,6 / 2,0 ms", "8,0 / 7,0 ms", "3,3 / 6,5 ms", "90,0 / 90,0 ms"]);
    expect(f.map((x) => x.resultado)).toEqual(["pasa", "pasa", "pasa", "pasa", "pasa"]);
    expect(f.map((x) => x.tope)).toEqual(["≤ 300 ms (máx.)", "≤ 5 / 16 ms", "≤ 50 ms (máx.)", "≤ 33 / 100 ms", "≤ 300 ms (máx.)"]);
    expect(f[3]!.medida).toBe("máx. de cuadro / por gesto de 3");
  });

  it("juzga con los topes de la netbook: el máximo (S2, también la mediana; S4, cuadro y gesto)", () => {
    const t = TOPES_S_NETBOOK;
    const f = filasS(
      muestras({
        s1: [s1(t.S1 + 0.1)],
        s2: [t.S2[0] + 1, t.S2[0] + 1, 1],
        s3: [t.S3],
        s4: [g(t.S4[0] + 0.1, 40)],
        s5: [{ trabajo: t.S5 + 1, pared: 0, tramos: 1, avisos: 0 }],
      }),
    );
    expect(f.map((x) => x.resultado)).toEqual(["no pasa", "no pasa", "pasa", "no pasa", "no pasa"]);
    expect(filasS(muestras({ s2: [1, 1, t.S2[1] + 0.1] }))[1]!.resultado).toBe("no pasa");
    expect(filasS(muestras({ s4: [g(5, t.S4[1] + 0.1)] }))[3]!.resultado).toBe("no pasa");
    // La cadena informa: no cambia el juicio de S4.
    expect(filasS(muestras({ s4Cadena: [g(500, 900)] }))[3]!.resultado).toBe("pasa");
  });

  it("sin vueltas no pasa", () => {
    const f = filasS({ s1: [], s2: [], s3: [], s4: [], s4Cadena: [], s5: [] });
    expect(f.filter((x) => x.resultado === "pasa")).toEqual([]);
  });

  it("las S no llevan K (K no se recalcula en la fase 5)", () => {
    for (const x of filasS(muestras())) expect(celdaK(x.id, x.valor)).toBe("—");
  });

  it("S4: 20 vueltas de la marcha y 5 de la cadena (S4-B)", () => {
    expect([VUELTAS_S.S4, VUELTAS_S.S4Cadena]).toEqual([20, 5]);
  });
});

describe("notasS", () => {
  it("trae el desglose de S1 (la netlist sola informa), la cadena de S4 y la pared de S5", () => {
    const n = notasS(muestras(), { componentes: 2000, cables: 2200, bobinas: 300 });
    const desglose = n.find((l) => l.startsWith(NOTA_DESGLOSE_S1));
    expect(desglose).toBe(
      `${NOTA_DESGLOSE_S1} R4 0,2 · netlist 4,0 · iniciar 1,0 · cuadro 27,1 (3 cuadros como máximo). «iniciar» incluye armar el dibujo del estado (T33).`,
    );
    expect(n.find((l) => l.startsWith(NOTA_CADENA_S4))).toBe(`${NOTA_CADENA_S4} cuadro máx. 4,5 · gesto máx. 24,0 / mediana 24,0 · 10 cuadros como máximo, 2 gestos.`);
    expect(n.find((l) => l.startsWith("S4: "))).toContain("hasta 3 cuadros por gesto");
    expect(n.find((l) => l.startsWith(NOTA_PARED_S5))).toBe(`${NOTA_PARED_S5} máx. 160,0 / mediana 160,0 · 40 tramos y 13394 avisos R11 por vuelta.`);
  });

  it("entra en la tabla de «Copiar» con B y F", () => {
    const texto = textoFase4(filasS(muestras()), "Probar la fase 5 · prueba", notasS(muestras(), { componentes: 2000, cables: 2200, bobinas: 300 }));
    expect(texto).toContain("| S2 | Pulsar y soltar una marcha (mando 2000), sin dibujo | mediana / máx. de 4 | ≤ 5 / 16 ms | 0,6 / 2,0 ms | pasa | — |");
    expect(texto).toContain("| S4 | Pulsar y soltar una marcha (mando 2000) con dibujo al 31 %, hasta nítido | máx. de cuadro / por gesto de 3 | ≤ 33 / 100 ms | 3,3 / 6,5 ms | pasa | — |");
    expect(texto).toMatch(/Pasan 5 · no pasan 0 · se anotan 0\.$/);
  });
});
