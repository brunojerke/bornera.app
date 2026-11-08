import { describe, expect, it } from "vitest";
import { esAtajoModo, f5CambiaModo, otroModo } from "./modo";

const tecla = (key: string, mods: Partial<Record<"ctrlKey" | "shiftKey" | "altKey" | "metaKey", boolean>> = {}) => ({
  key,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...mods,
});

describe("F5 alterna el modo", () => {
  it("solo F5 sin modificadores: Ctrl+F5 y Mayús+F5 quedan libres", () => {
    expect(esAtajoModo(tecla("F5"))).toBe(true);
    expect(esAtajoModo(tecla("F5", { ctrlKey: true }))).toBe(false);
    expect(esAtajoModo(tecla("F5", { shiftKey: true }))).toBe(false);
    expect(esAtajoModo(tecla("F5", { altKey: true }))).toBe(false);
    expect(esAtajoModo(tecla("F5", { metaKey: true }))).toBe(false);
    expect(esAtajoModo(tecla("r", { ctrlKey: true }))).toBe(false);
    expect(esAtajoModo(tecla("F4"))).toBe(false);
  });

  it("alterna entre Editar y Simular", () => {
    expect(otroModo("editar")).toBe("simular");
    expect(otroModo("simular")).toBe("editar");
  });

  it("no cambia repetida, con un diálogo modal ni durante un gesto", () => {
    expect(f5CambiaModo({ repetida: false, modal: false, gesto: false })).toBe(true);
    expect(f5CambiaModo({ repetida: true, modal: false, gesto: false })).toBe(false);
    expect(f5CambiaModo({ repetida: false, modal: true, gesto: false })).toBe(false);
    expect(f5CambiaModo({ repetida: false, modal: false, gesto: true })).toBe(false);
  });
});
