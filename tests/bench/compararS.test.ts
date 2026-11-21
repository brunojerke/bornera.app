// «Probar la fase 5» (T31): las filas S del texto de «Copiar» y su juicio en
// la PC (ajuste 1 de T31: mediana de las calientes ≤ tope y máximo ≤ tope +
// máx(1 ms, 10 %); las frías informan).

import { describe, expect, it } from "vitest";
import { textoFase4 } from "../../src/ui/fase4";
import { filasS as filasDeApp, K_S, notasS, TOPES_S_NETBOOK, type MuestrasS } from "../../src/ui/fase5";
import { AVISO_S1_PC_MS, cierreS, conMargen, desgloseS1, filasS, juzgarS, noRegresionS, paredS5, TOPES_S_PC } from "./compararB.mjs";

/** Un texto de «Probar la fase 5» como lo arma la app, con S1 total `s1`, S2 `s2` (mediana y máx.), S3 `s3` y S5 `s5`. */
function texto(s1: number, s2: [number, number], s3: number, s5: number): string {
  const m: MuestrasS = {
    s1: [{ r4: 0.5, netlist: 4.25, iniciar: 1, cuadro: s1 - 5.75, total: s1, cuadros: 3 }],
    s2: [s2[0], s2[0], s2[1]],
    s3: [s3],
    s5: [{ trabajo: s5, pared: s5 * 2, tramos: 10, avisos: 5 }],
  };
  return textoFase4(filasDeApp(m), "Probar la fase 5 · prueba", notasS(m, { componentes: 2000, cables: 2200, bobinas: 300 }));
}

describe("topes de S en la PC", () => {
  it("son los de la netbook / K, con un decimal (D1-D: K1 = 3, K2 = 5,5)", () => {
    const k = { K1: 3, K2: 5.5 };
    const pc = (n: number, id: keyof typeof K_S) => Math.round((n / k[K_S[id]]) * 10) / 10;
    expect(TOPES_S_PC.S1[0]!.tope).toBe(pc(TOPES_S_NETBOOK.S1, "S1"));
    expect(TOPES_S_PC.S2.map((x) => x.tope)).toEqual(TOPES_S_NETBOOK.S2.map((n) => pc(n, "S2")));
    expect(TOPES_S_PC.S3[0]!.tope).toBe(pc(TOPES_S_NETBOOK.S3, "S3"));
    expect(TOPES_S_PC.S5[0]!.tope).toBe(pc(TOPES_S_NETBOOK.S5, "S5"));
    expect(AVISO_S1_PC_MS).toBe(48);
  });

  it("el margen del máximo es máx(1 ms, 10 %)", () => {
    expect(conMargen(54.5)).toBeCloseTo(59.95);
    expect(conMargen(1.7)).toBeCloseTo(2.7);
    expect(conMargen(100)).toBeCloseTo(110);
  });
});

describe("filasS, desgloseS1 y paredS5", () => {
  it("leen el texto que arma la app; S4 (se mide en T33) no sale", () => {
    const t = texto(30, [0.5, 2], 8, 90);
    expect([...filasS(t).entries()]).toEqual([
      ["S1", [30, 30]],
      ["S2", [0.5, 2]],
      ["S3", [8, 8]],
      ["S5", [90, 90]],
    ]);
    expect([...desgloseS1(t).entries()]).toEqual([
      ["R4", 0.5],
      ["netlist", 4.3],
      ["iniciar", 1],
      ["cuadro", 24.3],
    ]);
    expect(paredS5(t)).toBe(180);
  });
});

describe("juzgarS (ajuste 1 de T31)", () => {
  const bien = texto(40, [0.5, 2], 8, 90);

  it("pasa con todo bajo el tope", () => {
    const j = juzgarS([], [bien, bien, bien]);
    expect(j.pasa).toBe(true);
    expect(j.filas.map((f) => `${f.id} ${f.nombre}`)).toEqual(["S1 máx.", "S2 mediana", "S2 máx.", "S3 máx.", "S5 máx."]);
  });

  it("un máximo arriba del tope pero dentro del margen pasa, si la mediana está bajo el tope", () => {
    expect(juzgarS([], [bien, bien, texto(59, [0.5, 2], 8, 90)]).pasa).toBe(true);
  });

  it("no pasa si el máximo pasa el margen, aunque la mediana esté bien", () => {
    const j = juzgarS([], [bien, bien, texto(60.1, [0.5, 2], 8, 90)]);
    expect(j.pasa).toBe(false);
    expect(j.filas.filter((f) => !f.pasa).map((f) => f.id)).toEqual(["S1"]);
  });

  it("no pasa si la mediana pasa el tope, aunque el máximo esté dentro del margen", () => {
    const alto = texto(40, [0.5, 2], 8, 105);
    const j = juzgarS([], [alto, alto, bien]);
    expect(j.filas.filter((f) => !f.pasa).map((f) => f.id)).toEqual(["S5"]);
  });

  it("las frías no deciden", () => {
    const fria = texto(500, [10, 50], 100, 900);
    const j = juzgarS([fria], [bien, bien]);
    expect(j.pasa).toBe(true);
    expect(j.filas[0]!.informan).toEqual([500]);
  });

  it("sin calientes no pasa, y sin filas S tira", () => {
    expect(juzgarS([], []).pasa).toBe(false);
    expect(() => juzgarS([], ["Probar la fase 4 · sin S"])).toThrow(/Falta S1/);
  });
});

describe("noRegresionS y cierreS (T32, fijados antes de medir)", () => {
  const b = [texto(18, [0.2, 0.3], 3, 95), texto(19, [0.2, 0.4], 4, 99)];

  it("A pasa si su mediana ≤ la de B + máx(1 ms, 10 %)", () => {
    const igual = noRegresionS(b, [texto(19.5, [1.2, 1.3], 4.4, 106)]);
    expect(igual.pasa).toBe(true);
    expect(igual.filas.map((f) => [f.id, f.nombre, f.base, Math.round(f.limite * 100) / 100])).toEqual([
      ["S1", "máx.", 18.5, 20.35],
      ["S2", "mediana", 0.2, 1.2],
      ["S2", "máx.", 0.35, 1.35],
      ["S3", "máx.", 3.5, 4.5],
      ["S5", "máx.", 97, 106.7],
    ]);
    const sube = noRegresionS(b, [texto(20.6, [0.2, 0.3], 3, 95)]);
    expect(sube.filas.filter((f) => !f.pasa).map((f) => f.id)).toEqual(["S1"]);
  });

  it("sin corridas o con una base de la fase 4 (sin S), no hay juicio", () => {
    expect(() => noRegresionS([], b)).toThrow(/No hay corridas/);
    expect(() => noRegresionS(["| B1 | x | x | x | 1 ms | |"], b)).toThrow(/Probar la fase 5/);
  });

  it("ajuste 1: solo S5 sobre el tope sin regresión es «causa conocida»; lo demás frena", () => {
    const bien = texto(40, [0.5, 2], 8, 90);
    const s5Alto = texto(40, [0.5, 2], 8, 104);
    expect(cierreS(juzgarS([], [bien]), noRegresionS([bien], [bien]))).toBe("pasa");
    expect(cierreS(juzgarS([], [s5Alto]), noRegresionS([s5Alto], [s5Alto]))).toBe("causa conocida");
    // S5 sobre el tope y además sube contra B: frena.
    expect(cierreS(juzgarS([], [s5Alto]), noRegresionS([bien], [s5Alto]))).toBe("frena");
    // S1 sobre el tope: frena aunque no suba.
    const s1Alto = texto(60, [0.5, 2], 8, 90);
    expect(cierreS(juzgarS([], [s1Alto]), noRegresionS([s1Alto], [s1Alto]))).toBe("frena");
    // Todo bajo el tope pero S3 sube contra B: frena.
    expect(cierreS(juzgarS([], [texto(40, [0.5, 2], 12, 90)]), noRegresionS([bien], [texto(40, [0.5, 2], 12, 90)]))).toBe("frena");
  });
});
