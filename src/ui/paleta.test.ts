import { describe, expect, it } from "vitest";
import { SIMBOLOS } from "../core/symbols";
import { agruparSimbolos, normalizar } from "./paleta";

describe("agruparSimbolos", () => {
  it("agrupa la biblioteca en orden fijo y omite las categorías vacías", () => {
    const grupos = agruparSimbolos(SIMBOLOS);
    expect(grupos.map((g) => g.nombre)).toEqual(["Fuentes", "Mando", "Potencia", "Señalización"]);
    expect(grupos.flatMap((g) => g.simbolos)).toHaveLength(SIMBOLOS.length);
    expect(grupos[0]!.simbolos.map((s) => s.tipo)).toEqual(["fuente.fase", "fuente.neutro", "fuente.trifasica", "fuente.trifasica_n", "fuente.tierra"]);
    // T34: los contactos principales, primeros de Potencia; después, los de T35.
    expect(grupos[2]!.simbolos.map((s) => s.tipo)).toEqual(["contactor.principal", "proteccion.termomagnetica_unipolar", "proteccion.termomagnetica_bipolar", "proteccion.termomagnetica_tripolar", "proteccion.termomagnetica_tetrapolar", "proteccion.diferencial_bipolar", "proteccion.diferencial_tetrapolar", "proteccion.guardamotor", "maniobra.seccionador", "proteccion.fusible_tripolar", "proteccion.termico", "motor.trifasico", "motor.estrella_triangulo"]);
  });

  it("en Mando, el auxiliar NC sale justo después del NA (T17b)", () => {
    const mando = agruparSimbolos(SIMBOLOS).find((g) => g.nombre === "Mando")!;
    expect(mando.simbolos.map((s) => s.nombre)).toEqual([
      "Pulsador NA",
      "Pulsador NC",
      "Bobina de contactor",
      "Contacto auxiliar NA",
      "Contacto auxiliar NC",
    ]);
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
