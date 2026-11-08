import { describe, expect, it } from "vitest";
import { buscarComponente, crearDocumento, type Documento } from "../../core/model/documento";
import { Historial } from "../../core/model/historial";
import { buscarSimbolo, SIMBOLOS } from "../../core/symbols";
import { ajustarAGrilla, HerramientaColocar } from "./colocar";
import type { EventoHerramienta } from "./tipos";

const BOBINA = buscarSimbolo("contactor.bobina")!;

const doc = (): Documento => crearDocumento({ titulo: "Prueba", autor: "", fecha: "2026-11-08" });

/** Evento en (x, y); `boton` 0 izquierdo, 2 derecho. */
const ev = (x: number, y: number, boton = 0): EventoHerramienta => ({
  x,
  y,
  boton,
  botones: 0,
  mayus: false,
  ctrl: false,
});

describe("ajustarAGrilla", () => {
  it("redondea al entero más cercano y nunca da −0", () => {
    expect(ajustarAGrilla(3.4)).toBe(3);
    expect(ajustarAGrilla(-1.6)).toBe(-2);
    expect(Object.is(ajustarAGrilla(-0.2), 0)).toBe(true);
  });
});

describe("HerramientaColocar, modo clic", () => {
  it("mover y presionar da un Colocar en coordenadas enteras", () => {
    const d = doc();
    const h = new HerramientaColocar(BOBINA, "clic", d);
    h.mover(ev(3.4, -1.6));
    expect(h.previa).toEqual({ def: BOBINA, x: 3, y: -2 });

    const r = h.presionar(ev(3.4, -1.6));
    expect(r.terminar).toBeFalsy();
    expect(r.comando).toBeDefined();

    const historial = new Historial(d);
    const cambio = historial.ejecutar(r.comando!);
    const c = buscarComponente(d, cambio.componentes[0]!)!;
    expect(c).toMatchObject({ tipo: "contactor.bobina", x: 3, y: -2, rot: 0, espejado: false });
  });

  it("queda activa: dos clics colocan dos componentes con ids distintos", () => {
    const d = doc();
    const h = new HerramientaColocar(BOBINA, "clic", d);
    const historial = new Historial(d);
    historial.ejecutar(h.presionar(ev(0, 0)).comando!);
    historial.ejecutar(h.presionar(ev(5, 0)).comando!);
    const comps = d.hojas[0]!.componentes;
    expect(comps.map((c) => [c.x, c.y])).toEqual([
      [0, 0],
      [5, 0],
    ]);
    expect(comps[0]!.id).not.toBe(comps[1]!.id);
  });

  it("solo pide redibujo al cambiar de punto de grilla", () => {
    const h = new HerramientaColocar(BOBINA, "clic", doc());
    expect(h.mover(ev(1.1, 1.1)).redibujar).toBe(true);
    expect(h.mover(ev(1.3, 0.8)).redibujar).toBe(false);
    expect(h.mover(ev(1.6, 1)).redibujar).toBe(true);
  });

  it("salir del lienzo esconde la vista previa", () => {
    const h = new HerramientaColocar(BOBINA, "clic", doc());
    h.mover(ev(2, 2));
    expect(h.salir().redibujar).toBe(true);
    expect(h.previa).toBeNull();
    expect(h.salir().redibujar).toBe(false);
  });

  it("Esc no produce nada y termina", () => {
    const d = doc();
    const h = new HerramientaColocar(BOBINA, "clic", d);
    h.mover(ev(2, 2));
    const r = h.cancelar();
    expect(r).toEqual({ redibujar: true, terminar: true });
    expect(h.previa).toBeNull();
    expect(d.hojas[0]!.componentes).toEqual([]);
  });

  it("el botón derecho termina sin colocar; el del medio no hace nada", () => {
    const h = new HerramientaColocar(BOBINA, "clic", doc());
    expect(h.presionar(ev(0, 0, 1)).comando).toBeUndefined();
    const r = h.presionar(ev(0, 0, 2));
    expect(r.comando).toBeUndefined();
    expect(r.terminar).toBe(true);
  });

  it("soltar no hace nada en modo clic", () => {
    const h = new HerramientaColocar(BOBINA, "clic", doc());
    h.mover(ev(0, 0));
    expect(h.soltar(ev(0, 0)).comando).toBeUndefined();
  });
});

describe("HerramientaColocar, modo arrastre", () => {
  it("soltar sobre el lienzo da un Colocar y termina", () => {
    const d = doc();
    const h = new HerramientaColocar(BOBINA, "arrastre", d);
    h.mover(ev(-4.7, 6.2));
    const r = h.soltar(ev(-4.7, 6.2));
    expect(r.terminar).toBe(true);
    new Historial(d).ejecutar(r.comando!);
    expect(d.hojas[0]!.componentes[0]).toMatchObject({ x: -5, y: 6 });
    expect(h.previa).toBeNull();
  });

  it("soltar fuera del lienzo no coloca nada", () => {
    const h = new HerramientaColocar(BOBINA, "arrastre", doc());
    h.mover(ev(1, 1));
    h.salir();
    const r = h.soltar(null);
    expect(r.comando).toBeUndefined();
    expect(r.terminar).toBe(true);
  });

  it("presionar no coloca mientras se arrastra", () => {
    const h = new HerramientaColocar(BOBINA, "arrastre", doc());
    expect(h.presionar(ev(0, 0)).comando).toBeUndefined();
  });

  it("aClic: un clic en la paleta pasa a esperar el clic en el lienzo", () => {
    const h = new HerramientaColocar(BOBINA, "arrastre", doc());
    h.aClic();
    expect(h.modo).toBe("clic");
    expect(h.presionar(ev(0, 0)).comando).toBeDefined();
  });
});

describe("los 6 símbolos de la biblioteca", () => {
  it("se colocan con ajuste a la grilla", () => {
    expect(SIMBOLOS).toHaveLength(6);
    const d = doc();
    const historial = new Historial(d);
    SIMBOLOS.forEach((def, i) => {
      const h = new HerramientaColocar(def, "arrastre", d);
      historial.ejecutar(h.soltar(ev(i * 4 + 0.3, -0.6)).comando!);
    });
    const comps = d.hojas[0]!.componentes;
    expect(comps.map((c) => c.tipo)).toEqual(SIMBOLOS.map((s) => s.tipo));
    for (const c of comps) {
      expect(Number.isInteger(c.x)).toBe(true);
      expect(Number.isInteger(c.y)).toBe(true);
    }
    expect(comps.map((c) => [c.x, c.y])).toEqual(SIMBOLOS.map((_, i) => [i * 4, -1]));
  });
});
