import { describe, expect, it } from "vitest";
import { compararB, filasB, juzgar, mediana, metricas } from "./compararB.mjs";

/** Una tabla de «Copiar» con B1–B16, como la arma la app, con los valores de `celdas`. */
function tabla(celdas: Record<string, string>): string {
  const lineas = ["Probar la fase 3b · Bornera x · …", "", "| # | Escenario | Medida | Tope netbook | Netbook | Resultado |", "|---|---|---|---|---|---|"];
  for (const [id, valor] of Object.entries(celdas)) lineas.push(`| ${id} | e | m | t | ${valor.replace(/\|/g, "\\|")} | pasa |`);
  return lineas.join("\n");
}

const BASE: Record<string, string> = {
  B1: "45,2 / 53,9 ms",
  B3: "0 por gesto (0 en total); máx. 9,7 ms",
  B8: "máx. 4,4 ms; 0,0 % > 16,7 ms (0 de 120)",
  B9: "N = 500",
  B10: "22,6 ms",
  B15: "0 lentos; máx. 6,1 ms",
  B16: "0 lentos; 10,0 ms",
};

describe("compararB (T23, etapa 5: regla D6b-C)", () => {
  it("lee los formatos de cada fila", () => {
    expect(metricas("45,2 / 53,9 ms").map((m) => m.valor)).toEqual([45.2, 53.9]);
    expect(metricas("1 por gesto (3 en total); máx. 9,7 ms").map((m) => [m.tipo, m.valor])).toEqual([
      ["lentos", 1],
      ["lentos", 3],
      ["ms", 9.7],
    ]);
    expect(metricas("máx. 4,4 ms; 0,8 % > 16,7 ms (1 de 120)").map((m) => m.tipo)).toEqual(["ms", "info", "lentos", "info"]);
    expect(metricas("N = 500").map((m) => m.valor)).toEqual(["500"]);
    expect(metricas("N = ninguno; menos de 500: revisar `TOPE_PREVIA_PEGAR`")[0]?.valor).toBe("ninguno");
    expect(metricas("2 lentos; máx. 17,6 ms").map((m) => m.valor)).toEqual([2, 17.6]);
    expect(metricas("0 lentos; 98,0 ms").map((m) => m.nombre)).toEqual(["lentos", "por gesto"]);
    expect(() => metricas("otra cosa")).toThrow();
    // La columna de lo medido, con las barras escapadas de Markdown.
    expect(filasB(tabla({ B1: "45,2 / 53,9 ms" })).get("B1")).toBe("45,2 / 53,9 ms");
  });

  it("piso de 1 ms o 10 %, lentos ±1, B9 el mismo escalón", () => {
    expect(juzgar("ms", 5, 5.9)).toBe("igual");
    expect(juzgar("ms", 5, 6.2)).toBe("sube");
    expect(juzgar("ms", 50, 54.9)).toBe("igual");
    expect(juzgar("ms", 50, 55.1)).toBe("sube");
    expect(juzgar("ms", 50, 40)).toBe("baja");
    expect(juzgar("lentos", 0, 1)).toBe("igual");
    expect(juzgar("lentos", 0, 2)).toBe("sube");
    expect(juzgar("escalon", "500", "400")).toBe("distinto");
    expect(juzgar("info", 1, 9)).toBeNull();
  });

  it("decide con la mediana de las corridas, y pasa si nada sube", () => {
    expect(mediana([3, 1, 2, 10])).toBe(2.5);
    const base = [tabla(BASE), tabla(BASE)];
    // Una corrida suelta alta no mueve la mediana de tres.
    expect(compararB(base, [tabla(BASE), tabla(BASE), tabla({ ...BASE, B10: "30,0 ms" })]).pasa).toBe(true);
    const sube = compararB(base, [tabla({ ...BASE, B10: "30,0 ms" }), tabla({ ...BASE, B10: "30,0 ms" })]);
    expect(sube.pasa).toBe(false);
    expect(sube.filas.find((f) => f.id === "B10")).toMatchObject({ base: 22.6, head: 30, juicio: "sube" });
    expect(compararB(base, [tabla({ ...BASE, B9: "N = 400" })]).pasa).toBe(false);
  });
});
