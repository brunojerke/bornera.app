// «Probar la fase 4» (C1; docs/plan-fase4.md, sección 6):
// - los grupos K son los del plan, y toman el número correcto de cada celda;
// - F1, F2 y F3 se juzgan con su tope de netbook, en el borde;
// - la tabla repite las columnas de «Probar la fase 3b» (compararB.mjs lee
//   B1–B16 igual) y suma K.
import { describe, expect, it } from "vitest";
import { filasB, metricas } from "../../tests/bench/compararB.mjs";
import { FILAS, type FilaEvaluada } from "./fase3b";
import { celdaK, filaF1, filasArchivo, GRUPOS_K, numerosDe, textoFase4, TOPE_F2_NETBOOK_MS, TOPE_F3_NETBOOK_MS, type MuestraArchivo } from "./fase4";
import type { MuestraCopia } from "./medirCopia";

/** Lo medido de cada fila B en el formato de fase3b.ts (valores de la PC). */
const VALORES_B: Record<string, string> = {
  B1: "49,0 / 91,0 ms",
  B2: "10,0 / 17,0 ms",
  B3: "0 por gesto (0 en total); máx. 12,0 ms",
  B4: "5,8 / 8,8 ms",
  B5: "1,7 / 3,6 ms",
  B6: "0 por gesto (0 en total); máx. 9,0 ms",
  B7: "0,9 ms",
  B8: "máx. 5,0 ms; 0,0 % > 16,7 ms (0 de 600)",
  B9: "N = 500",
  B10: "22,6 ms",
  B11: "máx. 9,0 ms; 0,0 % > 16,7 ms (0 de 12)",
  B12: "1,1 ms",
  B13: "0,1 / 0,1 ms",
  B14: "máx. 4,0 ms; 0,0 % > 16,7 ms (0 de 30)",
  B15: "0 lentos; máx. 10,0 ms",
  B16: "0 lentos; 8,3 ms",
};

const filasBien = (): FilaEvaluada[] =>
  FILAS.map((f) => ({ id: f.id, escenario: f.escenario, medida: f.medida, tope: f.tope, valor: VALORES_B[f.id]!, resultado: "pasa" }));

const copia = (largo: number): MuestraCopia => ({ trozos: [largo], registro: 0.2, duracion: 50, reinicios: 0, deUnaVezMs: 0 });
const vuelta = (guardar: number, hastaCuadro: number): MuestraArchivo => ({ guardar, abrir: hastaCuadro / 2, hastaCuadro });

describe("grupos K (docs/plan-fase4.md, C1)", () => {
  it("K1 y K2 son las filas del plan; B8, B9 y B15 no entran", () => {
    const de = (g: string) => Object.keys(GRUPOS_K).filter((id) => GRUPOS_K[id]!.grupo === g);
    expect(de("K1")).toEqual(["B1", "B2", "B4", "B5", "B7", "B10", "B12", "B13", "F1", "F2"]);
    expect(de("K2")).toEqual(["B3", "B6", "B11", "B14", "B16", "F3"]);
    for (const id of ["B8", "B9", "B15"]) expect(celdaK(id, VALORES_B[id]!)).toBe("—");
  });

  it("toma el número que dice el plan: medianas, p95, máximos de cuadros y el por gesto de B16", () => {
    const k = Object.fromEntries(filasBien().map((f) => [f.id, celdaK(f.id, f.valor)]));
    expect(k).toMatchObject({
      B1: "K1: 49,0", // mediana del paso
      B2: "K1: 10,0",
      B3: "K2: 12,0", // máx. de los cuadros
      B5: "K1: 1,7",
      B7: "K1: 0,9",
      B11: "K2: 9,0",
      B13: "K1: 0,1", // p95 de R6
      B14: "K2: 4,0",
      B16: "K2: 8,3", // por gesto, no los lentos
    });
    expect(celdaK("F1", "4,2 / 2,1 ms")).toBe("K1: 2,1"); // la mediana, no el máx.
    expect(celdaK("F3", "300,0 / 250,5 ms")).toBe("K2: 250,5");
  });

  it("los números de una celda, con coma decimal", () => {
    expect(numerosDe("0 por gesto (2 en total); máx. 12,5 ms")).toEqual([0, 2, 12.5]);
    expect(() => celdaK("B16", "0 lentos")).toThrow(/B16/);
  });
});

describe("F1, F2 y F3 con el tope de la netbook", () => {
  it("F1: el paso síncrono más largo de las copias, ≤ 50 ms en el borde", () => {
    expect(filaF1([copia(2), copia(50)])).toMatchObject({ id: "F1", valor: "50,0 / 50,0 ms", resultado: "pasa" });
    expect(filaF1([copia(2), copia(50.01), copia(3)]).resultado).toBe("no pasa");
    expect(filaF1([]).resultado).toBe("no pasa");
  });

  it("F2 ≤ 1 s y F3 ≤ 3 s, sobre el máximo de las vueltas", () => {
    const bien = filasArchivo([vuelta(100, 300), vuelta(TOPE_F2_NETBOOK_MS, TOPE_F3_NETBOOK_MS), vuelta(90, 280)]);
    expect(bien.map((f) => [f.id, f.medida, f.valor, f.resultado])).toEqual([
      ["F2", "máx. / mediana de 3", "1000,0 / 100,0 ms", "pasa"],
      ["F3", "máx. / mediana de 3", "3000,0 / 300,0 ms", "pasa"],
    ]);
    const mal = filasArchivo([vuelta(1000.1, 3000.1)]);
    expect(mal.map((f) => f.resultado)).toEqual(["no pasa", "no pasa"]);
    expect(filasArchivo([]).map((f) => f.resultado)).toEqual(["no pasa", "no pasa"]);
  });
});

describe("texto para copiar", () => {
  const filas = [...filasBien(), filaF1([copia(3)]), ...filasArchivo([vuelta(100, 300)])];
  const texto = textoFase4(filas, "Probar la fase 4 · Bornera 0.1.4-alpha.2 · hoy · Edg/157 · lienzo 1366×768", ["Disco: sí."]);

  it("las columnas de la fase 3b más K, B1–B16 y F1–F3, las notas y el resumen", () => {
    const l = texto.split("\n");
    expect(l[2]).toBe("| # | Escenario | Medida | Tope netbook | Netbook | Resultado | K |");
    expect(l.filter((x) => /^\| [BF]\d+ \|/.test(x))).toHaveLength(19);
    expect(texto).toContain("| F2 | Guardar 2000 (sin el comando) | máx. / mediana de 1 | ≤ 1000 ms (máx.) | 100,0 / 100,0 ms | pasa | K1: 100,0 |");
    expect(l.at(-2)).toBe("Disco: sí.");
    expect(l.at(-1)).toBe("Pasan 19 · no pasan 0 · se anotan 0.");
  });

  it("compararB.mjs lee B1–B16 igual que en la fase 3b (la columna K no corre lo medido)", () => {
    const b = filasB(texto);
    expect([...b.keys()]).toEqual(FILAS.map((f) => f.id));
    expect(b.get("B3")).toBe(VALORES_B.B3);
    for (const valor of b.values()) expect(() => metricas(valor)).not.toThrow();
  });
});
