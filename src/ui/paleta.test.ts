import { describe, expect, it } from "vitest";
import { SIMBOLOS } from "../core/symbols";
import { agruparSimbolos, normalizar } from "./paleta";

describe("agruparSimbolos", () => {
  it("agrupa la biblioteca en orden fijo y omite las categorías vacías", () => {
    const grupos = agruparSimbolos(SIMBOLOS);
    expect(grupos.map((g) => g.nombre)).toEqual(["Fuentes", "Mando", "Señalización"]);
    expect(grupos.flatMap((g) => g.simbolos)).toHaveLength(SIMBOLOS.length);
    expect(grupos[0]!.simbolos.map((s) => s.tipo)).toEqual(["fuente.fase", "fuente.neutro"]);
  });

  it("filtra por nombre sin distinguir tildes ni mayúsculas", () => {
    expect(agruparSimbolos(SIMBOLOS, "LAMPARA").flatMap((g) => g.simbolos.map((s) => s.nombre))).toEqual([
      "Lámpara",
    ]);
    const pulsadores = agruparSimbolos(SIMBOLOS, " pulsador ");
    expect(pulsadores.map((g) => g.nombre)).toEqual(["Mando"]);
    expect(pulsadores[0]!.simbolos.map((s) => s.nombre)).toEqual(["Pulsador NA", "Pulsador NC"]);
  });

  it("sin coincidencias, no hay grupos", () => {
    expect(agruparSimbolos(SIMBOLOS, "transformador")).toEqual([]);
  });
});

describe("normalizar", () => {
  it("saca tildes y pasa a minúsculas", () => {
    expect(normalizar(" Señalización ")).toBe("senalizacion");
  });
});
