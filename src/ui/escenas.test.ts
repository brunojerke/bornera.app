import { describe, expect, it } from "vitest";
import { esAtajoBanco, siguienteEscenaBanco } from "./escenas";

describe("atajo del banco de pruebas", () => {
  it("cicla documento → 100 → 500 → 2000 → vacía → documento", () => {
    expect(siguienteEscenaBanco("documento")).toBe(100);
    expect(siguienteEscenaBanco(100)).toBe(500);
    expect(siguienteEscenaBanco(500)).toBe(2000);
    expect(siguienteEscenaBanco(2000)).toBe("vacia");
    expect(siguienteEscenaBanco("vacia")).toBe("documento");
  });

  it("desde la revisión de símbolos arranca por 100", () => {
    expect(siguienteEscenaBanco("simbolos")).toBe(100);
  });

  it("reconoce Ctrl+Shift+B y nada más", () => {
    const tecla = (key: string, mods: Partial<Record<"ctrlKey" | "shiftKey" | "altKey" | "metaKey", boolean>> = {}) => ({
      key,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      ...mods,
    });
    expect(esAtajoBanco(tecla("B", { ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(esAtajoBanco(tecla("b", { ctrlKey: true, shiftKey: true }))).toBe(true); // Bloq Mayús
    expect(esAtajoBanco(tecla("B", { shiftKey: true }))).toBe(false);
    expect(esAtajoBanco(tecla("b", { ctrlKey: true }))).toBe(false);
    expect(esAtajoBanco(tecla("B", { ctrlKey: true, shiftKey: true, altKey: true }))).toBe(false);
  });
});
