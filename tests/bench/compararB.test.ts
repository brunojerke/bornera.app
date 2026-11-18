import { describe, expect, it } from "vitest";
import { compararB, filasB, filasF, friasFuera, juzgar, juzgarF, mediana, metricas } from "./compararB.mjs";

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

  it("sin corridas de un lado no da «pasa»: falla", () => {
    expect(() => compararB([], [tabla(BASE)])).toThrow(/corridas/);
    expect(() => compararB([tabla(BASE)], [])).toThrow(/corridas/);
  });
});

describe("«Probar la fase 4» (C1): F en la PC y frías con la regla de C4", () => {
  /** Una corrida de la fase 4 con F1–F3 (máx. / mediana) y las B de `celdas`. */
  const fase4 = (f: [number, number, number], celdas: Record<string, string> = BASE) =>
    [
      tabla(celdas),
      ...f.map((m, i) => `| F${i + 1} | e | m | t | ${String(m).replace(".", ",")} / 1,0 ms | pasa | K1: 1,0 |`),
    ].join("\n");

  it("lee F1–F3 y juzga F1 solo en las calientes, F2 y F3 en todas", () => {
    expect(filasF(fase4([8.5, 300, 400])).get("F1")).toEqual({ maximo: 8.5, mediana: 1 });
    // F1 fría de 12 ms: informa, no decide.
    const bien = juzgarF([fase4([12, 900, 999])], [fase4([9, 300, 1000]), fase4([8.9, 200, 300])]);
    expect(bien.pasa).toBe(true);
    expect(bien.filas.map((f) => [f.id, f.deciden, f.informan])).toEqual([
      ["F1", [9, 8.9], [12]],
      ["F2", [900, 300, 200], []],
      ["F3", [999, 1000, 300], []],
    ]);
    // F2 frío de 1000,1: no pasa (decide en todas). F1 caliente de 9,1: no pasa.
    expect(juzgarF([fase4([1, 1000.1, 1])], [fase4([1, 1, 1])]).filas.map((f) => f.pasa)).toEqual([true, false, true]);
    expect(juzgarF([fase4([1, 1, 1])], [fase4([9.1, 1, 1])]).pasa).toBe(false);
  });

  it("un texto de la fase 3b no tiene F: falla en vez de dar «pasa»", () => {
    expect(() => juzgarF([tabla(BASE)], [tabla(BASE)])).toThrow(/F1/);
  });

  it("las frías fuera del rango de las calientes, más 1 ms; los lentos no cuentan", () => {
    const con = (b1: string, b3: string) => tabla({ ...BASE, B1: b1, B3: b3 });
    const calientes = [con("45,0 / 50,0 ms", "0 por gesto (0 en total); máx. 9,0 ms"), con("47,0 / 52,0 ms", "0 por gesto (0 en total); máx. 10,0 ms")];
    const frias = [con("48,0 / 53,0 ms", "1 por gesto (1 en total); máx. 11,0 ms"), con("48,1 / 50,0 ms", "0 por gesto (0 en total); máx. 11,1 ms")];
    expect(friasFuera(frias, calientes)).toEqual([
      { id: "B1", nombre: "1.º", fuera: [48.1], min: 45, max: 47 },
      { id: "B3", nombre: "máx.", fuera: [11.1], min: 9, max: 10 },
    ]);
  });
});
