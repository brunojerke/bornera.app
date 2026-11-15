import { describe, expect, it } from "vitest";
import type { Aviso } from "../core/model/validaciones";
import {
  abrirAlSeleccionar,
  notasAvisos,
  textoContador,
  textoCambioRed,
  textoCantidad,
  textoEtiqueta,
  textoExtremo,
  textoRed,
  textoRenombre,
  textoRepetida,
  textoRotacion,
} from "./propiedades";

describe("abrirAlSeleccionar", () => {
  it("se abre al pasar de nada a algo seleccionado", () => {
    expect(abrirAlSeleccionar(0, 1, false)).toBe(true);
    expect(abrirAlSeleccionar(0, 5, false)).toBe(true);
  });

  it("no se abre si el usuario lo plegó", () => {
    expect(abrirAlSeleccionar(0, 1, true)).toBe(false);
  });

  it("no hace nada al cambiar una selección que ya había, ni al deseleccionar", () => {
    expect(abrirAlSeleccionar(1, 2, false)).toBe(false);
    expect(abrirAlSeleccionar(2, 0, false)).toBe(false);
    expect(abrirAlSeleccionar(0, 0, false)).toBe(false);
  });
});

describe("textoCantidad", () => {
  it("singular y plural", () => {
    expect(textoCantidad(1)).toBe("1 componente seleccionado");
    expect(textoCantidad(2000)).toBe("2000 componentes seleccionados");
  });

  it("con cables, solos o mezclados", () => {
    expect(textoCantidad(0, 1)).toBe("1 cable seleccionado");
    expect(textoCantidad(0, 3000)).toBe("3000 cables seleccionados");
    expect(textoCantidad(2, 1)).toBe("2 componentes y 1 cable seleccionados");
    expect(textoCantidad(1, 1)).toBe("1 componente y 1 cable seleccionados");
  });
});

describe("textoExtremo", () => {
  it("borne, sobre otro cable o suelto", () => {
    expect(textoExtremo({ tipo: "borne", etiqueta: "K1", borne: "A1" })).toBe("K1 · A1");
    expect(textoExtremo({ tipo: "cable" })).toBe("Sobre otro cable");
    expect(textoExtremo({ tipo: "libre" })).toBe("Suelto");
  });
});

describe("textos del panel", () => {
  it("etiqueta y rotación: vacía, común o Varias", () => {
    expect(textoEtiqueta("K1")).toBe("K1");
    expect(textoEtiqueta("")).toBe("—");
    expect(textoEtiqueta(null)).toBe("Varias");
    expect(textoRotacion(90)).toBe("90°");
    expect(textoRotacion(null)).toBe("Varias");
  });

  it("red de una fuente", () => {
    expect(textoRed("L1", 0)).toBe("Red L1: sin otras alimentaciones");
    expect(textoRed("L1", 1)).toBe("Red L1: unida a 1 alimentación más");
    expect(textoRed("L1", 2)).toBe("Red L1: unida a 2 alimentaciones más");
    expect(textoCambioRed("L", "L1")).toBe("Al confirmar pasa de la red L a la red L1");
    expect(textoCambioRed("", "L1")).toBe("Al confirmar pasa a la red L1");
  });
});

describe("notas del etiquetado (T17)", () => {
  it("repetida: con el nombre del otro titular y su artículo", () => {
    expect(textoRepetida("Bobina de contactor", "K1")).toBe("Otra bobina de contactor ya se llama K1.");
    expect(textoRepetida("Lámpara", "H1")).toBe("Otra lámpara ya se llama H1.");
    expect(textoRepetida("Pulsador NA", "S1")).toBe("Otro pulsador NA ya se llama S1.");
    expect(textoRepetida("Símbolo desconocido", "M1")).toBe("Otro símbolo desconocido ya se llama M1.");
  });

  it("renombre con arrastre, en singular y en plural", () => {
    expect(textoRenombre({ vieja: "K2", nueva: "K5", contactos: 1, motivo: null })).toBe("1 contacto pasó a K5.");
    expect(textoRenombre({ vieja: "K2", nueva: "K5", contactos: 2, motivo: null })).toBe("2 contactos pasaron a K5.");
  });

  it("renombre sin arrastre, con su motivo", () => {
    expect(textoRenombre({ vieja: "K1", nueva: "K5", contactos: 0, motivo: "otra_bobina_vieja" })).toBe(
      "Los contactos K1 no cambiaron: hay otra bobina K1.",
    );
    expect(textoRenombre({ vieja: "K1", nueva: "K5", contactos: 0, motivo: "otra_bobina_nueva" })).toBe(
      "Los contactos K1 no cambiaron: ya hay una bobina K5.",
    );
    expect(textoRenombre({ vieja: "K1", nueva: "", contactos: 0, motivo: "nueva_vacia" })).toBe(
      "La bobina quedó sin etiqueta; los contactos siguen como K1.",
    );
  });
});

describe("validaciones en la barra y el panel (T19)", () => {
  it("textoContador: «Sin avisos», singular, plural y los dos juntos", () => {
    expect(textoContador({ errores: 0, avisos: 0 })).toBe("Sin avisos");
    expect(textoContador({ errores: 1, avisos: 0 })).toBe("1 error");
    expect(textoContador({ errores: 0, avisos: 1 })).toBe("1 aviso");
    expect(textoContador({ errores: 2, avisos: 3 })).toBe("2 errores · 3 avisos");
    expect(textoContador({ errores: 1, avisos: 1 })).toBe("1 error · 1 aviso");
  });

  it("notasAvisos: R4 error marcado; bornes sueltos en una línea donde estaba el primero (D2); R9 no se repite (D3)", () => {
    const avisos: Aviso[] = [
      { regla: "R4", severidad: "error", id: "c1", etiqueta: "K1", otro: "Bobina de contactor" },
      { regla: "R7", severidad: "aviso", id: "c1", borne: "A1" },
      { regla: "R7", severidad: "aviso", id: "c1", borne: "A2" },
      { regla: "R9", severidad: "aviso", id: "c1" },
    ];
    expect(notasAvisos(avisos)).toEqual([
      { texto: "Otra bobina de contactor ya se llama K1.", error: true },
      { texto: "Bornes A1 y A2 sin conectar.", error: false },
    ]);
    expect(notasAvisos([{ regla: "R7", severidad: "aviso", id: "c1", borne: "14" }])).toEqual([{ texto: "Borne 14 sin conectar.", error: false }]);
    expect(
      notasAvisos(["13", "14", "21"].map((borne): Aviso => ({ regla: "R7", severidad: "aviso", id: "c1", borne }))),
    ).toEqual([{ texto: "Bornes 13, 14 y 21 sin conectar.", error: false }]);
    expect(notasAvisos([{ regla: "R8", severidad: "aviso", id: "w1" }])).toEqual([{ texto: "Cable con un extremo suelto.", error: false }]);
    expect(notasAvisos([])).toEqual([]);
  });

  it("un R4 que es aviso (dos pulsadores NA) no lleva el rótulo de error", () => {
    expect(notasAvisos([{ regla: "R4", severidad: "aviso", id: "c1", etiqueta: "S1", otro: "Pulsador NA" }])).toEqual([
      { texto: "Otro pulsador NA ya se llama S1.", error: false },
    ]);
  });
});
