import { describe, expect, it } from "vitest";
import barra from "./BarraSuperior.svelte?raw";
import { esPrerelease, mostrarMenuDesarrollo } from "./version";

describe("menú de desarrollo solo en desarrollo y prereleases (cierre 3b, etapa 4)", () => {
  it("una versión final compilada no lo muestra", () => {
    expect(mostrarMenuDesarrollo("0.1.4", false)).toBe(false);
    expect(mostrarMenuDesarrollo("0.1.3", false)).toBe(false);
    expect(mostrarMenuDesarrollo("1.0.0", false)).toBe(false);
  });

  it("una prerelease compilada lo muestra", () => {
    expect(mostrarMenuDesarrollo("0.1.4-alpha.1", false)).toBe(true);
    expect(mostrarMenuDesarrollo("0.1.3-alpha.11", false)).toBe(true);
    expect(mostrarMenuDesarrollo("0.2.0-beta.2", false)).toBe(true);
  });

  it("en desarrollo lo muestra siempre", () => {
    expect(mostrarMenuDesarrollo("0.1.4", true)).toBe(true);
    expect(mostrarMenuDesarrollo("0.1.4-alpha.1", true)).toBe(true);
  });

  it("esPrerelease mira el guion", () => {
    expect(esPrerelease("0.1.4-alpha.1")).toBe(true);
    expect(esPrerelease("0.1.4")).toBe(false);
  });

  it("la barra superior usa esa condición (y no otra) para el menú", () => {
    expect(barra).toContain("{#if mostrarMenuDesarrollo(VERSION, import.meta.env.DEV)}");
    // El menú se monta en un solo lugar: los botones de prueba viven dentro de él.
    expect(barra.match(/<MenuDesarrollo\b/g)).toHaveLength(1);
  });
});
