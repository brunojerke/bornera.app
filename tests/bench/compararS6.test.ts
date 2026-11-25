// «Probar la fase 6» (T37; docs/plan-T37.md): S6 y P2 del texto de «Copiar»
// y su juicio en la PC (ajuste 1 de T37: decide la mediana de las calientes
// ≤ 54,5; el máximo ≤ 60,0 aparte, con un pico aislado se repite una vez).
// Lo de la fase 5 se juzga igual con o sin las filas nuevas.

import { describe, expect, it } from "vitest";
import { textoFase4 } from "../../src/ui/fase4";
import { filasS as filasDeApp, notasS, type MuestrasS } from "../../src/ui/fase5";
import { filasFase6, K_FASE6, notasFase6, TOPES_FASE6_NETBOOK } from "../../src/ui/fase6";
import { arranqueP2, conMargen, desgloseS1, desgloseS6, filasS, juzgarP1, juzgarP2, juzgarS, juzgarS6, noRegresionP1, noRegresionS, noRegresionS6, TOPES_P1_PC, TOPES_S6_PC } from "./compararB.mjs";

const mando: MuestrasS = {
  s1: [{ r4: 0.5, netlist: 4.25, iniciar: 1, cuadro: 20, total: 25.75, cuadros: 3 }],
  s2: [0.2, 0.3],
  s3: [3],
  s4: [{ cuadro: 2, gesto: 3, cuadros: 2 }],
  s4Cadena: [{ cuadro: 5, gesto: 14, cuadros: 9 }],
  s5: [{ trabajo: 46, pared: 150, tramos: 10, avisos: 0 }],
};
const escena = { componentes: 2000, cables: 3519, trifasicas: 95, redes: 1526 };

/** Un texto de «Probar la fase 5» como lo arma la app. */
const texto5 = () => textoFase4(filasDeApp(mando), "Probar la fase 5 · prueba", notasS(mando, { componentes: 2000, cables: 2200, bobinas: 300 }));

/** Un texto de «Probar la fase 6»: el de la fase 5 más S6 (máx. de la corrida `s6`) y P2. */
function texto6(s6: number, p2: number | null = 800, p1 = 3): string {
  const m = { s6: [{ r4: 1, netlist: 9, iniciar: 2, cuadro: s6 - 12, total: s6, cuadros: 4 }], p1: { vueltas: [p1 - 1, p1], miniaturas: 32 }, p2 };
  return textoFase4([...filasDeApp(mando), ...filasFase6(m, 32)], "Probar la fase 6 · prueba", [...notasS(mando, { componentes: 2000, cables: 2200, bobinas: 300 }), ...notasFase6(m, escena)]);
}

describe("tope de S6 en la PC", () => {
  it("es el de la netbook / K2, con un decimal: 54,5; el máximo llega a 59,95", () => {
    expect(K_FASE6.S6).toBe("K2");
    expect(TOPES_S6_PC.S6[0]!.tope).toBe(Math.round((TOPES_FASE6_NETBOOK.S6 / 5.5) * 10) / 10);
    expect(TOPES_S6_PC.S6[0]!.tope).toBe(54.5);
    expect(conMargen(54.5)).toBeCloseTo(59.95);
  });
});

describe("lo de la fase 5, con las filas nuevas", () => {
  it("filasS lee S6; juzgarS y noRegresionS dan lo mismo con un texto de la fase 6 que con uno de la fase 5", () => {
    expect(filasS(texto6(30)).get("S6")).toEqual([30, 30]);
    expect(filasS(texto5()).has("S6")).toBe(false);
    expect(juzgarS([], [texto6(30)])).toEqual(juzgarS([], [texto5()]));
    // --fase6: A en la 6 y B en la 5.
    expect(noRegresionS([texto5()], [texto6(30)])).toEqual(noRegresionS([texto5()], [texto5()]));
  });

  it("los desgloses de S1 y S6 no se mezclan", () => {
    expect(desgloseS1(texto6(30)).get("netlist")).toBe(4.3);
    expect(desgloseS6(texto6(30)).get("netlist")).toBe(9);
    expect(desgloseS6(texto5()).size).toBe(0);
  });
});

describe("juzgarS6 (ajuste 1 de T37)", () => {
  const calientes = (...xs: number[]) => xs.map((x) => texto6(x));

  it("pasa con la mediana y el máximo bajo el tope; un máximo dentro del margen también", () => {
    expect(juzgarS6([], calientes(30, 31, 29, 33, 30, 32)).estado).toBe("pasa");
    expect(juzgarS6([], calientes(50, 51, 52, 59, 50, 51)).estado).toBe("pasa");
  });

  it("un pico aislado sobre 59,95 pide repetir; dos o más, no pasa", () => {
    const r = juzgarS6([], calientes(30, 31, 61, 30, 30, 32));
    expect(r.estado).toBe("repetir");
    expect(r.filas[0]!.sobreMargen).toEqual([61]);
    expect(juzgarS6([], calientes(30, 61, 61, 30, 30, 32)).estado).toBe("no pasa");
  });

  it("la mediana sobre 54,5 no pasa, aunque el máximo esté dentro del margen", () => {
    expect(juzgarS6([], calientes(55, 55, 56, 54, 55, 59)).estado).toBe("no pasa");
  });

  it("las frías no deciden", () => {
    const r = juzgarS6(calientes(200), calientes(30, 31));
    expect(r.estado).toBe("pasa");
    expect(r.filas[0]!.informan).toEqual([200]);
  });

  it("sin calientes no pasa; un texto de la fase 5 tira", () => {
    expect(juzgarS6([], []).estado).toBe("no pasa");
    expect(() => juzgarS6([], [texto5()])).toThrow(/Probar la fase 6/);
  });
});

describe("noRegresionS6 (--base-fase6)", () => {
  it("A pasa si su mediana ≤ la de B + máx(1 ms, 10 %)", () => {
    expect(noRegresionS6([texto6(30)], [texto6(33)]).pasa).toBe(true);
    expect(noRegresionS6([texto6(30)], [texto6(33.1)]).pasa).toBe(false);
    expect(() => noRegresionS6([texto5()], [texto6(30)])).toThrow(/Probar la fase 6/);
  });
});

describe("P2", () => {
  it("arranqueP2 lee la fila; «sin marca» o un texto de la fase 5 dan NaN", () => {
    expect(arranqueP2(texto6(30, 812.34))).toBe(812.3);
    expect(arranqueP2(texto6(30, null))).toBeNaN();
    expect(arranqueP2(texto5())).toBeNaN();
  });

  it("sin base (T37, B en la fase 5) informa: no juzga", () => {
    const r = juzgarP2([texto6(30, 800), texto6(30, 820), texto6(30, 900)], [texto5(), texto5()]);
    expect(r).toMatchObject({ medianaA: 820, juzga: false, pasa: null });
    expect(juzgarP2([texto6(30, 800)], []).juzga).toBe(false);
  });

  it("con base (--base-fase6): mediana de A ≤ la de B + máx(1 ms, 10 %)", () => {
    const b = [texto6(30, 800), texto6(30, 810)];
    expect(juzgarP2([texto6(30, 880), texto6(30, 890)], b)).toMatchObject({ juzga: true, pasa: true });
    expect(juzgarP2([texto6(30, 900), texto6(30, 900)], b)).toMatchObject({ juzga: true, pasa: false });
    // Una apertura de A sin marca no pasa.
    expect(juzgarP2([texto6(30, null), texto6(30, 800)], b).pasa).toBe(false);
  });
});

describe("P1 (T38, ajuste 4: la regla de S6 con su tope)", () => {
  /** Un texto de «Probar la fase 6» de T37: sin la fila P1. */
  const sinP1 = (t: string) => t.split("\n").filter((l) => !l.startsWith("| P1 |")).join("\n");
  const calientes = (...xs: number[]) => xs.map((x) => texto6(30, 800, x));

  it("el tope de la PC es 50 / K2 = 9,1; el máximo llega a 10,1", () => {
    expect(K_FASE6.P1).toBe("K2");
    expect(TOPES_P1_PC.P1[0]!.tope).toBe(Math.round((TOPES_FASE6_NETBOOK.P1 / 5.5) * 10) / 10);
    expect(conMargen(9.1)).toBeCloseTo(10.1);
  });

  it("filasS con «P» lee P1 (no P2); con «S» no la toma", () => {
    const p = filasS(texto6(30, 800, 4), "P");
    expect([...p.keys()]).toEqual(["P1"]);
    expect(p.get("P1")![0]).toBe(4);
    expect(filasS(texto6(30, 800, 4)).has("P1")).toBe(false);
  });

  it("pasa con la mediana ≤ 9,1 y el máximo ≤ 10,1; un pico aislado pide repetir; dos, no pasa", () => {
    expect(juzgarP1([], calientes(4, 5, 4, 10, 5, 4)).estado).toBe("pasa");
    const r = juzgarP1([], calientes(4, 5, 4, 10.2, 5, 4));
    expect(r.estado).toBe("repetir");
    expect(r.filas[0]!.sobreMargen).toEqual([10.2]);
    expect(juzgarP1([], calientes(4, 11, 4, 10.2, 5, 4)).estado).toBe("no pasa");
    expect(juzgarP1([], calientes(9.2, 9.2, 9.3, 9, 9, 9.5)).estado).toBe("no pasa");
  });

  it("las frías informan; S6 y P1 no se mezclan", () => {
    const r = juzgarP1(calientes(40), calientes(4, 5));
    expect(r.estado).toBe("pasa");
    expect(r.filas[0]!.informan).toEqual([40]);
    expect(juzgarS6([], calientes(4, 5)).filas[0]!.deciden).toEqual([30, 30]);
  });

  it("no regresión: sin base si B no tiene P1 (T38 contra 24090e0); con base, la regla de S6", () => {
    expect(noRegresionP1([sinP1(texto6(30))], calientes(4))).toBeNull();
    expect(noRegresionP1([], calientes(4))).toBeNull();
    expect(noRegresionP1(calientes(4), calientes(5))!.pasa).toBe(true);
    expect(noRegresionP1(calientes(4), calientes(5.1))!.pasa).toBe(false);
  });
});
