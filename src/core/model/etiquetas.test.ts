import { describe, expect, it } from "vitest";
import { LARGO_MAXIMO_ETIQUETA, normalizarEtiqueta, validarEtiqueta } from "./etiquetas";

describe("normalizarEtiqueta", () => {
  it("quita los espacios de los lados y pasa a mayúsculas", () => {
    expect(normalizarEtiqueta("  k1 ")).toBe("K1");
    expect(normalizarEtiqueta("l1")).toBe(normalizarEtiqueta("L1 "));
  });
});

describe("validarEtiqueta", () => {
  it("acepta las etiquetas habituales", () => {
    for (const t of ["K1", "KM10", "-S1", "L1", "N", "H_2", "X1.3", "+A1", "F1/2", "X=1", "A:1", "k1"]) {
      expect(validarEtiqueta(t, false)).toBeNull();
    }
  });

  it("vacía se permite, salvo en una fuente", () => {
    expect(validarEtiqueta("", false)).toBeNull();
    expect(validarEtiqueta("   ", false)).toBeNull();
    expect(validarEtiqueta("", true)).toBe("La alimentación necesita un nombre de red");
    expect(validarEtiqueta("  ", true)).toBe("La alimentación necesita un nombre de red");
  });

  it("los espacios de los lados no cuentan; en el medio, error", () => {
    expect(validarEtiqueta("  K1  ", false)).toBeNull();
    expect(validarEtiqueta("K 1", false)).toBe("Sin espacios");
    expect(validarEtiqueta("K\t1", false)).toBe("Sin espacios");
  });

  it("caracteres no permitidos: nombra el primero", () => {
    expect(validarEtiqueta("Ñ1", false)).toBe("Carácter no permitido: «Ñ»");
    expect(validarEtiqueta("Ká", false)).toBe("Carácter no permitido: «á»");
    expect(validarEtiqueta("K1#", false)).toBe("Carácter no permitido: «#»");
    expect(validarEtiqueta("K,1", false)).toBe("Carácter no permitido: «,»");
  });

  it(`largo máximo: ${LARGO_MAXIMO_ETIQUETA} caracteres, sin contar los espacios de los lados`, () => {
    expect(validarEtiqueta("W".repeat(12), false)).toBeNull();
    expect(validarEtiqueta(` ${"W".repeat(12)} `, false)).toBeNull();
    expect(validarEtiqueta("W".repeat(13), false)).toBe("Máximo 12 caracteres");
  });
});
