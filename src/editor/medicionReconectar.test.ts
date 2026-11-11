// El gesto de reconectar que miden el banco y la prueba de la netbook (T14c).

import { describe, expect, it } from "vitest";
import { cablear, colocar } from "../core/model/comandos";
import { MENSAJE_SIN_LLEGADA, type ResultadoReconexion } from "../core/model/reconectar";
import { MENSAJE_MISMO_BORNE } from "../core/model/trazado";
import { documentoBancoCables } from "./banco";
import { documentoNuevo, Editor, PISTA_RECONECTAR_VACIO } from "./editor";
import type { EventoHerramienta } from "./herramientas/tipos";
import { claseReconexion, clasesDelRecorrido, gestoReconexion, RADIO_RECONECTAR } from "./medicionReconectar";

/** Al 58 %, como el banco y la prueba de la netbook. */
const ESCALA = 0.58 * 20;
const ev = (x: number, y: number): EventoHerramienta => ({ x, y, boton: 0, botones: 1, mayus: false, ctrl: false, escala: ESCALA });

describe("claseReconexion", () => {
  const base = { id: "w1", lado: "hasta", destino: { tipo: "borne", comp: "c1", borne: "A1" }, antes: { id: "w1" } } as unknown as ResultadoReconexion;
  const intento = { puntos: [0, 0, 1, 0] } as unknown as ResultadoReconexion["cable"];
  const rechazo = (motivo: string) => ({ motivo, conflictos: [] });

  it("vale, rechazo después de rutear (con intento o sin camino) y rechazo antes", () => {
    expect(claseReconexion({ ...base, cable: intento, rechazo: null })).toBe("valido");
    expect(claseReconexion({ ...base, cable: intento, rechazo: rechazo("se encimaría") })).toBe("rechazoRuteado");
    expect(claseReconexion({ ...base, cable: null, rechazo: rechazo(MENSAJE_SIN_LLEGADA) })).toBe("rechazoRuteado");
    expect(claseReconexion({ ...base, cable: null, rechazo: rechazo(MENSAJE_MISMO_BORNE) })).toBe("rechazoAntes");
  });
});

describe("gestoReconexion", () => {
  it("en el banco: el extremo con más destinos, zigzag a ±6 u y un destino válido para soltar", () => {
    const ed = new Editor(documentoBancoCables(2000));
    const g = gestoReconexion(ed, ESCALA);
    const n = clasesDelRecorrido(g);
    expect(ed.extremoAgarrable(g.x, g.y, ESCALA)).toMatchObject({ id: g.id, lado: g.lado });
    // Las tres clases, así el banco y la netbook miden las dos filas (válidos y rechazados después de rutear).
    expect(n.valido).toBeGreaterThan(0);
    expect(n.rechazoRuteado).toBeGreaterThan(0);
    expect(n.rechazoAntes).toBeGreaterThan(0);
    const todos = [...g.recorrido, g.soltar];
    for (const p of todos) expect(Math.max(Math.abs(p.x - g.x), Math.abs(p.y - g.y))).toBeLessThanOrEqual(RADIO_RECONECTAR);
    // Cada punto es otro: cada paso cambia de objetivo y la previa vuelve a planear.
    expect(new Set(todos.map((p) => `${p.x},${p.y}`)).size).toBe(todos.length);
  });

  it("el gesto en el editor: la pista coincide con la clase, soltar da un paso y Ctrl+Z deja todo igual", () => {
    const ed = new Editor(documentoBancoCables(2000));
    const antes = JSON.stringify(ed.documento.hojas);
    const g = gestoReconexion(ed, ESCALA);
    const pasos = () => (ed.historial as unknown as { hechos: unknown[] }).hechos.length;
    const n = pasos();
    ed.aplicar(ed.seleccionar.presionar(ev(g.x, g.y)));
    for (const p of g.recorrido) {
      ed.aplicar(ed.seleccionar.mover(ev(p.x, p.y)));
      expect(ed.reconectando).toBe(true);
      const conecta = ed.pista !== null && (ed.pista.startsWith("Conecta con ") || ed.pista.startsWith("Derivación (T)"));
      expect(conecta, `(${p.x}, ${p.y}): ${ed.pista}`).toBe(p.clase === "valido");
      expect(ed.pista).not.toBe(PISTA_RECONECTAR_VACIO);
    }
    ed.aplicar(ed.seleccionar.mover(ev(g.soltar.x, g.soltar.y)));
    ed.aplicar(ed.seleccionar.soltar(ev(g.soltar.x, g.soltar.y)));
    expect(pasos()).toBe(n + 1);
    expect(ed.reconectando).toBe(false);
    const w = ed.documento.hojas[0]!.cables.find((c) => c.id === g.id)!;
    expect(w[g.lado].tipo).not.toBe("libre");
    ed.deshacer();
    expect(JSON.stringify(ed.documento.hojas)).toBe(antes);
  });

  it("tira si ningún extremo libre tiene un destino válido", () => {
    const ed = new Editor(documentoNuevo());
    const doc = ed.documento;
    ed.ejecutar(colocar(doc, { tipo: "contactor.bobina", x: 0, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: {} }));
    // Un cable suelto lejos de todo: alrededor de su extremo no hay destinos.
    ed.ejecutar(cablear(doc, { desde: { tipo: "libre", x: 40, y: 0 }, hasta: { tipo: "libre", x: 44, y: 0 }, codos: [] }));
    expect(() => gestoReconexion(ed, ESCALA)).toThrow(/Ningún extremo libre/);
  });
});
