import { describe, expect, it } from "vitest";
import { celdaK, textoFase4 } from "./fase4";
import { filasFase6 as filas, notasFase6, NOTA_DESGLOSE_S6, TOPES_FASE6_NETBOOK, VUELTAS_P1, VUELTAS_S6, type MuestrasFase6 } from "./fase6";

const s = (total: number) => ({ r4: 0.3, netlist: 6, iniciar: 2, cuadro: total - 8.3, total, cuadros: 4 });
const muestras = (cambio: Partial<MuestrasFase6> = {}): MuestrasFase6 => ({ s6: [s(30), s(33.25), s(28)], p1: { vueltas: [3, 4.25, 2], miniaturas: 32 }, p2: 812.34, ...cambio });
/** Las filas con las 32 miniaturas de la biblioteca. */
const filasFase6 = (m: MuestrasFase6) => filas(m, 32);
const escena = { componentes: 2000, cables: 3519, trifasicas: 95, redes: 1526 };

describe("filasFase6", () => {
  it("da S6 (máx. / mediana, como S1), P1 (igual, T38) y P2, que se anota", () => {
    const f = filasFase6(muestras());
    expect(f.map((x) => x.id)).toEqual(["S6", "P1", "P2"]);
    expect(f.map((x) => x.valor)).toEqual(["33,3 / 30,0 ms", "4,3 / 3,0 ms", "812,3 ms"]);
    expect(f.map((x) => x.resultado)).toEqual(["pasa", "pasa", "se anota"]);
    expect(f[1]).toMatchObject({ tope: "≤ 50 ms (máx.)", medida: "máx. / mediana de 3", escenario: "Dibujar las 32 miniaturas de la paleta de cero" });
    expect(f[0]!.tope).toBe("≤ 300 ms (máx.)");
    expect(f[0]!.medida).toBe("máx. / mediana de 3");
  });

  it("S6 juzga el máximo con el tope de la netbook; sin vueltas no pasa", () => {
    expect(filasFase6(muestras({ s6: [s(TOPES_FASE6_NETBOOK.S6)] }))[0]!.resultado).toBe("pasa");
    expect(filasFase6(muestras({ s6: [s(10), s(TOPES_FASE6_NETBOOK.S6 + 0.1)] }))[0]!.resultado).toBe("no pasa");
    expect(filasFase6(muestras({ s6: [] }))[0]!.resultado).toBe("no pasa");
  });

  it("P2 sin marca: «sin marca», se anota igual", () => {
    expect(filasFase6(muestras({ p2: null }))[2]).toMatchObject({ valor: "sin marca", resultado: "se anota" });
  });

  it("P1 juzga el máximo con el tope de la netbook (50 ms); sin vueltas o con otra cantidad de miniaturas no pasa", () => {
    const p1 = (vueltas: number[], miniaturas = 32) => filasFase6(muestras({ p1: { vueltas, miniaturas } }))[1]!.resultado;
    expect(TOPES_FASE6_NETBOOK.P1).toBe(50);
    expect(p1([TOPES_FASE6_NETBOOK.P1])).toBe("pasa");
    expect(p1([1, TOPES_FASE6_NETBOOK.P1 + 0.1])).toBe("no pasa");
    expect(p1([])).toBe("no pasa");
    // La paleta cerrada no tiene miniaturas: no se midió nada.
    expect(p1([0.1], 0)).toBe("no pasa");
  });

  it("S6, P1 y P2 no llevan K", () => {
    for (const x of filasFase6(muestras())) expect(celdaK(x.id, x.valor)).toBe("—");
  });

  it("5 vueltas de S6 y de P1", () => {
    expect(VUELTAS_S6).toBe(5);
    expect(VUELTAS_P1).toBe(5);
  });
});

describe("notasFase6 y la tabla", () => {
  it("el desglose de S6 sale con su prefijo y la escena con trifásicas y redes", () => {
    const n = notasFase6(muestras(), escena);
    expect(n[0]).toContain("2000 componentes + 3519 cables (95 trifásicas, 1526 redes)");
    const d = n.find((x) => x.startsWith(NOTA_DESGLOSE_S6))!;
    expect(d).toContain("R4 0,3 · netlist 6,0 · iniciar 2,0 · cuadro 25,0");
  });

  it("las filas entran en la tabla de «Probar la fase 4» con 7 columnas", () => {
    const t = textoFase4(filasFase6(muestras()), "Probar la fase 6 · x · 1 s", notasFase6(muestras(), escena));
    const s6 = t.split("\n").find((l) => l.startsWith("| S6 |"))!;
    expect(s6.split("|").slice(1, -1)).toHaveLength(7);
    expect(t).toContain("| P2 | Arranque: de abrir la app al primer cuadro nítido del lienzo | una por apertura | se anota | 812,3 ms | se anota | — |");
  });
});
