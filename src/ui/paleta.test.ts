import { describe, expect, it } from "vitest";
import { SIMBOLOS, SUBGRUPOS } from "../core/symbols";
import { GRUPOS, Plegado, SUBGRUPOS_PALETA, agruparSimbolos, normalizar } from "./paleta";

/** Nombres por subgrupo, «Grupo › Subgrupo»: lo que muestra la paleta. */
function lugares(filtro = ""): Record<string, string[]> {
  const r: Record<string, string[]> = {};
  for (const g of agruparSimbolos(SIMBOLOS, filtro)) for (const s of g.subgrupos) r[`${g.nombre} › ${s.nombre}`] = s.simbolos.map((x) => x.nombre);
  return r;
}

describe("agruparSimbolos (T38, D26-A)", () => {
  it("la tabla de la paleta tiene cada subgrupo del core una vez, y los ids no chocan con los de grupo", () => {
    expect(Object.keys(SUBGRUPOS_PALETA).sort()).toEqual([...SUBGRUPOS].sort());
    const ids = [...GRUPOS.map((g) => g.id), ...SUBGRUPOS];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada uno de los 32 queda en un solo subgrupo, con el orden y la ubicación del plan", () => {
    expect(SIMBOLOS).toHaveLength(32);
    const tipos = agruparSimbolos(SIMBOLOS).flatMap((g) => g.subgrupos.flatMap((s) => s.simbolos.map((x) => x.tipo)));
    expect(tipos).toHaveLength(32);
    expect(new Set(tipos).size).toBe(32);
    expect(lugares()).toEqual({
      "Mando › Alimentación": ["Fase (L)", "Neutro (N)", "Fusible"],
      "Mando › Entradas": ["Pulsador NA", "Pulsador NC", "Selector NA", "Seta NC", "Final de carrera NA", "Final de carrera NC"],
      "Mando › Contactos": ["Contacto auxiliar NA", "Contacto auxiliar NC", "Contacto del térmico NC", "Contacto del térmico NA"],
      "Mando › Bobinas": ["Bobina de contactor"],
      "Mando › Señalización": ["Lámpara", "Bocina"],
      "Potencia › Protección": [
        "Termomagnética unipolar",
        "Termomagnética bipolar",
        "Termomagnética tripolar",
        "Termomagnética tetrapolar",
        "Diferencial bipolar",
        "Diferencial tetrapolar",
        "Guardamotor",
        "Fusible tripolar",
        "Relé térmico",
      ],
      "Potencia › Maniobra": ["Contactos principales", "Seccionador"],
      "Potencia › Cargas": ["Motor trifásico", "Motor estrella-triángulo"],
      "Potencia › Fuentes": ["Fuente trifásica", "Fuente trifásica con neutro", "Tierra (PE)"],
    });
    // El orden de las claves es el de la paleta.
    expect(Object.keys(lugares())[0]).toBe("Mando › Alimentación");
    expect(Object.keys(lugares()).at(-1)).toBe("Potencia › Fuentes");
  });

  it("buscar «termo» deja solo las 4 termomagnéticas, en su subgrupo", () => {
    expect(Object.keys(lugares("termo"))).toEqual(["Potencia › Protección"]);
    expect(lugares("termo")["Potencia › Protección"]).toHaveLength(4);
  });

  it("filtra por nombre sin distinguir tildes ni mayúsculas, y omite grupos y subgrupos vacíos", () => {
    expect(lugares("LAMPARA")).toEqual({ "Mando › Señalización": ["Lámpara"] });
    expect(lugares(" pulsador ")).toEqual({ "Mando › Entradas": ["Pulsador NA", "Pulsador NC"] });
    // «motor»: los dos motores y el guardamotor, en dos subgrupos.
    expect(lugares("motor")).toEqual({ "Potencia › Protección": ["Guardamotor"], "Potencia › Cargas": ["Motor trifásico", "Motor estrella-triángulo"] });
    // «fusible»: uno en cada grupo.
    expect(lugares("fusible")).toEqual({ "Mando › Alimentación": ["Fusible"], "Potencia › Protección": ["Fusible tripolar"] });
  });

  it("sin coincidencias, no hay grupos", () => {
    expect(agruparSimbolos(SIMBOLOS, "transformador")).toEqual([]);
  });
});

describe("Plegado (D28-A)", () => {
  it("arranca todo abierto y alterna", () => {
    const p = new Plegado();
    expect(p.abierto("mando")).toBe(true);
    p.alternar("mando");
    expect(p.abierto("mando")).toBe(false);
    p.alternar("mando");
    expect(p.abierto("mando")).toBe(true);
  });

  it("con búsqueda todo se ve abierto; al borrarla vuelve el plegado de antes", () => {
    const p = new Plegado();
    p.alternar("potencia");
    p.alternar("entradas");
    p.filtrar("motor");
    expect(p.abierto("potencia")).toBe(true);
    expect(p.abierto("entradas")).toBe(true);
    // Lo plegado durante la búsqueda se olvida al cambiarla.
    p.alternar("cargas");
    expect(p.abierto("cargas")).toBe(false);
    p.filtrar("motor t");
    expect(p.abierto("cargas")).toBe(true);
    p.filtrar("  ");
    expect(p.abierto("potencia")).toBe(false);
    expect(p.abierto("entradas")).toBe(false);
    expect(p.abierto("cargas")).toBe(true);
  });
});

describe("normalizar", () => {
  it("saca tildes y pasa a minúsculas", () => {
    expect(normalizar(" Señalización ")).toBe("senalizacion");
  });
});
