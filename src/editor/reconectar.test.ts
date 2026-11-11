// Reconectar un extremo libre con Seleccionar (T14c): el gesto en el editor.

import { describe, expect, it } from "vitest";
import { indexarHoja, recorridoCable } from "../core/model/cables";
import { cablear, colocar } from "../core/model/comandos";
import type { Cable, Documento, Extremo } from "../core/model/documento";
import { MENSAJE_SOBRE_SI_MISMO } from "../core/model/reconectar";
import { MENSAJE_EXTREMO_SUELTO, MENSAJE_MISMO_BORNE } from "../core/model/trazado";
import { uniones } from "../core/model/uniones";
import type { Caja } from "../render/camara";
import { cajaUnion } from "../render/escenaEditable";
import { AVISO_ARRASTRE_CANCELADO, documentoNuevo, Editor, PISTA_RECONECTAR_VACIO, PISTA_SOBRE_EXTREMO, type DestinoVista } from "./editor";
import { radioExtremo } from "./herramientas/seleccionar";
import type { EventoHerramienta } from "./herramientas/tipos";

class VistaFalsa implements DestinoVista {
  regiones: Caja[] = [];
  cuadros = 0;
  invalidarRegion(caja: Caja): void {
    this.regiones.push(caja);
  }
  invalidar(): void {
    this.cuadros++;
  }
}

const ESCALA = 20;
const ev = (x: number, y: number, o: { escala?: number; mayus?: boolean; boton?: number } = {}): EventoHerramienta => ({
  x,
  y,
  boton: o.boton ?? 0,
  botones: 1,
  mayus: o.mayus ?? false,
  ctrl: false,
  escala: o.escala ?? ESCALA,
});

const borne = (comp: string, b: string): Extremo => ({ tipo: "borne", comp, borne: b });
const libre = (x: number, y: number): Extremo => ({ tipo: "libre", x, y });

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * K1 en (0, 0) y K2 en (12, 0) (bobinas: A1 arriba, A2 abajo). w1 sale de
 * K1·A1 (0, −2), sube a (0, −6), va a (8, −6) y baja suelto hasta (8, −3).
 * w2 horizontal en y = 4, suelto en los dos extremos (4, 4) y (16, 4). w3
 * sale de K1·A1 hacia la izquierda: con w1, A1 es una unión.
 */
function armar(): { ed: Editor; vista: VistaFalsa; avisos: string[]; doc: Documento } {
  const ed = new Editor(documentoNuevo());
  const doc = ed.documento;
  const k1 = colocar(doc, { tipo: "contactor.bobina", x: 0, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: {} });
  ed.ejecutar(k1);
  const k2 = colocar(doc, { tipo: "contactor.bobina", x: 12, y: 0, rot: 0, espejado: false, etiqueta: "K2", params: {} });
  ed.ejecutar(k2);
  ed.ejecutar(cablear(doc, { desde: borne(k1.id, "A1"), hasta: libre(8, -3), codos: [[0, -6], [8, -6]] }));
  ed.ejecutar(cablear(doc, { desde: libre(4, 4), hasta: libre(16, 4), codos: [] }));
  ed.ejecutar(cablear(doc, { desde: borne(k1.id, "A1"), hasta: libre(-5, -2), codos: [] }));
  const vista = new VistaFalsa();
  ed.vista = vista;
  const avisos: string[] = [];
  ed.alAvisar = (t) => avisos.push(t);
  expect(ed.uniones.todas().map((u) => [u.x, u.y])).toEqual([[0, -2]]);
  return { ed, vista, avisos, doc };
}

const w = (doc: Documento, id: string): Cable => doc.hojas[0]!.cables.find((c) => c.id === id)!;

/** Aprieta en (x0, y0), pasa el umbral y se mueve por `puntos` (sin soltar). */
function arrastrar(ed: Editor, x0: number, y0: number, puntos: [number, number][], escala = ESCALA): void {
  const h = ed.seleccionar;
  ed.aplicar(h.presionar(ev(x0, y0, { escala })));
  for (const [x, y] of puntos) ed.aplicar(h.mover(ev(x, y, { escala })));
}

const caben = (regiones: readonly Caja[], k: Caja) =>
  regiones.some((r) => k.x >= r.x && k.y >= r.y && k.x + k.ancho <= r.x + r.ancho && k.y + k.alto <= r.y + r.alto);

describe("Reconectar con Seleccionar: el gesto", () => {
  it("a un borne: previa = resultado, un paso, el cable vuelve a la estática; deshacer exacto", () => {
    const { ed, doc, vista } = armar();
    const antes = copia(doc);
    const pasos = () => (ed.historial as unknown as { hechos: unknown[] }).hechos.length;
    const n = pasos();
    arrastrar(ed, 8, -3, [
      [8.5, -3],
      [12.2, -2.2],
    ]);
    expect(ed.reconectando).toBe(true);
    expect(ed.escena.cableOculto("w1")).toBe(true);
    expect(ed.seleccion).toEqual(new Set(["w1"]));
    expect(ed.pista).toBe("Conecta con K2 · A1");
    const previa = ed.dibujoReconexion!;
    expect(previa.valido).toBe(true);
    // Moverse dentro del mismo objetivo no pide cuadro.
    vista.cuadros = 0;
    ed.aplicar(ed.seleccionar.mover(ev(12.1, -2.1)));
    expect(vista.cuadros).toBe(0);
    ed.aplicar(ed.seleccionar.soltar(ev(12.1, -2.1)));
    expect(ed.reconectando).toBe(false);
    expect(ed.escena.cableOculto("w1")).toBe(false);
    expect(pasos()).toBe(n + 1);
    expect(w(doc, "w1").hasta).toEqual(borne("c2", "A1"));
    expect(recorridoCable(indexarHoja(doc.hojas[0]!), w(doc, "w1"))).toEqual(previa.puntos);
    expect(ed.seleccion).toEqual(new Set(["w1"]));
    ed.deshacer();
    expect(doc).toEqual(antes);
  });

  it("a una T: la unión aparece al soltar (no en la previa) y se va al deshacer; cada caja de unión se invalida", () => {
    const { ed, doc, vista } = armar();
    vista.regiones = [];
    arrastrar(ed, 8, -3, [
      [8.5, -3],
      [8.1, 3.9],
    ]);
    expect(ed.pista).toBe("Derivación (T) sobre un cable");
    // Al ocultar: la caja de la unión vieja (A1) se invalida; durante el arrastre no hay punto nuevo.
    expect(caben(vista.regiones, cajaUnion(0, -2))).toBe(true);
    expect(ed.uniones.todas().map((u) => [u.x, u.y])).toEqual([[0, -2]]);
    // La unión de A1 toca el cable oculto: la estática no la dibuja.
    expect(ed.escena.unionesEn(cajaUnion(0, -2))[0]!.cables).toContain("w1");
    vista.regiones = [];
    ed.aplicar(ed.seleccionar.soltar(ev(8.1, 3.9)));
    expect(w(doc, "w1").hasta).toEqual({ tipo: "cable", cable: "w2", x: 8, y: 4 });
    expect(ed.uniones.todas()).toEqual(uniones(doc.hojas[0]!));
    expect(ed.uniones.todas().map((u) => [u.x, u.y])).toEqual([
      [0, -2],
      [8, 4],
    ]);
    for (const u of ed.uniones.todas()) expect(caben(vista.regiones, cajaUnion(u.x, u.y)), `(${u.x}, ${u.y})`).toBe(true);
    vista.regiones = [];
    ed.deshacer();
    expect(ed.uniones.todas().map((u) => [u.x, u.y])).toEqual([[0, -2]]);
    expect(caben(vista.regiones, cajaUnion(8, 4))).toBe(true);
    ed.rehacer();
    expect(ed.uniones.todas()).toEqual(uniones(doc.hojas[0]!));
  });

  it("radio de agarre a 58 %, 73 % y 100 %: 8 px (Chebyshev), nunca menos que el círculo", () => {
    for (const escala of [11.6, 14.6, 20]) {
      const r = radioExtremo(escala);
      expect(r).toBeCloseTo(8 / escala);
      // Adentro, en diagonal: agarra.
      {
        const { ed } = armar();
        arrastrar(ed, 8 + 0.95 * r, -3 + 0.95 * r, [[8 + 0.95 * r + 1, -3 + 0.95 * r]], escala);
        expect(ed.reconectando, `${escala} adentro`).toBe(true);
      }
      // Afuera: no (es vacío: un rectángulo de selección).
      {
        const { ed } = armar();
        arrastrar(ed, 8 + 1.1 * r, -3 + 1.1 * r, [[8 + 1.1 * r + 1, -3 + 1.1 * r]], escala);
        expect(ed.reconectando, `${escala} afuera`).toBe(false);
        expect(ed.seleccionar.rectangulo, `${escala} afuera`).not.toBeNull();
      }
    }
    expect(radioExtremo(100)).toBe(0.25);
    expect(radioExtremo(4)).toBe(0.9);
  });

  it("el extremo gana a mover la selección; clic sin moverse elige el cable; con Mayús no reconecta", () => {
    const { ed, doc } = armar();
    // El cable en una selección con K1: apretar en el extremo y arrastrar reconecta, no mueve.
    ed.seleccionarIds(["c1", "w1"]);
    arrastrar(ed, 8, -3, [[9, -3]]);
    expect(ed.reconectando).toBe(true);
    expect(ed.arrastrando).toBe(false);
    expect(ed.seleccion).toEqual(new Set(["w1"]));
    ed.aplicar(ed.seleccionar.cancelar());
    // Clic sin moverse: con el grupo, queda solo el cable al soltar.
    ed.seleccionarIds(["c1", "w1"]);
    ed.aplicar(ed.seleccionar.presionar(ev(8, -3)));
    ed.aplicar(ed.seleccionar.soltar(ev(8, -3)));
    expect(ed.seleccion).toEqual(new Set(["w1"]));
    // Sin selección: clic lo elige.
    ed.seleccionarIds([]);
    ed.aplicar(ed.seleccionar.presionar(ev(8.1, -3.1)));
    ed.aplicar(ed.seleccionar.soltar(ev(8.1, -3.1)));
    expect(ed.seleccion).toEqual(new Set(["w1"]));
    // Con Mayús: lo saca de la selección y no reconecta.
    const antes = copia(doc);
    ed.aplicar(ed.seleccionar.presionar(ev(8, -3, { mayus: true })));
    ed.aplicar(ed.seleccionar.mover(ev(10, -3, { mayus: true })));
    expect(ed.reconectando).toBe(false);
    ed.aplicar(ed.seleccionar.soltar(ev(10, -3, { mayus: true })));
    expect(ed.seleccion).toEqual(new Set());
    expect(doc).toEqual(antes);
  });

  it("ajuste: un extremo libre y un borne dentro de la tolerancia: gana el más cercano; con empate, el extremo", () => {
    const { ed } = armar();
    // w9 termina suelto en (13, −2), a 1 de K2·A1 (12, −2). A 58 % los dos radios son ~0,69.
    ed.ejecutar(cablear(ed.documento, { desde: libre(13, -2), hasta: libre(17, -2), codos: [] }));
    const escala = 11.6;
    // Más cerca del extremo: reconecta.
    expect(ed.extremoAgarrable(12.6, -2, escala)).toMatchObject({ id: "w4", lado: "desde" });
    // Más cerca del borne: no se agarra el extremo (apretar elige K2, como siempre).
    expect(ed.extremoAgarrable(12.45, -2, escala)).toBeNull();
    arrastrar(ed, 12.45, -2, [[12.45, -1]], escala);
    expect(ed.reconectando).toBe(false);
    expect(ed.seleccion).toEqual(new Set(["c2"]));
    ed.aplicar(ed.seleccionar.cancelar());
    // A la misma distancia: el extremo.
    expect(ed.extremoAgarrable(12.5, -2, escala)).toMatchObject({ id: "w4" });
    // Con el borne fuera de su tolerancia, el extremo gana aunque el borne esté cerca.
    expect(ed.extremoAgarrable(13.3, -2, escala)).toMatchObject({ id: "w4" });
  });

  it("soltar en vacío o donde estaba: vuelve, sin paso ni aviso", () => {
    for (const [x, y] of [
      [20, -10],
      [8, -3],
    ] as const) {
      const { ed, doc, avisos } = armar();
      const antes = copia(doc);
      arrastrar(ed, 8, -3, [
        [9, -3],
        [x, y],
      ]);
      expect(ed.pista).toBe(PISTA_RECONECTAR_VACIO);
      ed.aplicar(ed.seleccionar.soltar(ev(x, y)));
      expect(doc).toEqual(antes);
      expect(ed.historial.puedeRehacer).toBe(false);
      expect(avisos).toEqual([]);
      expect(ed.escena.cableOculto("w1")).toBe(false);
      expect(ed.seleccion).toEqual(new Set(["w1"]));
    }
  });

  it("destino inválido: la pista y el aviso dan el motivo, sin paso", () => {
    const casos: [number, number, string][] = [
      [0, -2.2, MENSAJE_MISMO_BORNE],
      [16, 4, MENSAJE_EXTREMO_SUELTO],
      [0, -4, MENSAJE_SOBRE_SI_MISMO],
    ];
    for (const [x, y, mensaje] of casos) {
      const { ed, doc, avisos } = armar();
      const antes = copia(doc);
      arrastrar(ed, 8, -3, [
        [9, -3],
        [x, y],
      ]);
      expect(ed.pista, mensaje).toBe(mensaje);
      expect(ed.dibujoReconexion!.valido).toBe(false);
      ed.aplicar(ed.seleccionar.soltar(ev(x, y)));
      expect(doc, mensaje).toEqual(antes);
      expect(avisos, mensaje).toEqual([mensaje]);
      expect(ed.escena.cableOculto("w1")).toBe(false);
    }
  });

  it("ajuste: Esc vuelve la selección de antes del arrastre; el botón derecho y un pointerup perdido la dejan en el cable", () => {
    const cortes: [string, (ed: Editor) => void, string[]][] = [
      ["Esc", (ed) => ed.aplicar(ed.seleccionar.cancelar()), ["c2"]],
      ["botón derecho", (ed) => ed.aplicar(ed.seleccionar.presionar(ev(12, -2, { boton: 2 }))), ["w1"]],
      ["pointerup perdido", (ed) => ed.aplicar(ed.seleccionar.soltar(null)), ["w1"]],
    ];
    for (const [nombre, cortar, seleccion] of cortes) {
      const { ed, doc } = armar();
      ed.seleccionarIds(["c2"]);
      const antes = copia(doc);
      arrastrar(ed, 8, -3, [
        [9, -3],
        [12, -2],
      ]);
      expect(ed.seleccion, nombre).toEqual(new Set(["w1"]));
      cortar(ed);
      expect(ed.reconectando, nombre).toBe(false);
      expect(ed.enGesto, nombre).toBe(false);
      expect(doc, nombre).toEqual(antes);
      expect(ed.escena.cableOculto("w1"), nombre).toBe(false);
      expect(ed.seleccion, nombre).toEqual(new Set(seleccion));
    }
  });

  it("el documento cambia en medio: se corta sin paso, con aviso, y el cable vuelve", () => {
    const { ed, doc, avisos } = armar();
    arrastrar(ed, 8, -3, [
      [9, -3],
      [12, -2],
    ]);
    ed.ejecutar(colocar(doc, { tipo: "contactor.bobina", x: 30, y: 0, rot: 0, espejado: false, etiqueta: "K3", params: {} }));
    expect(avisos).toEqual([AVISO_ARRASTRE_CANCELADO]);
    expect(ed.reconectando).toBe(false);
    expect(ed.escena.cableOculto("w1")).toBe(false);
    expect(w(doc, "w1").hasta).toEqual(libre(8, -3));
    // Soltar después ya no hace nada.
    ed.aplicar(ed.seleccionar.soltar(ev(12, -2)));
    expect(w(doc, "w1").hasta).toEqual(libre(8, -3));
  });

  it("pista sin gesto: sobre un extremo libre, y nada lejos de él", () => {
    const { ed } = armar();
    ed.aplicar(ed.seleccionar.mover(ev(8.2, -3.1)));
    expect(ed.sobreExtremo).toBe(true);
    expect(ed.pista).toBe(PISTA_SOBRE_EXTREMO);
    ed.aplicar(ed.seleccionar.mover(ev(20, 20)));
    expect(ed.sobreExtremo).toBe(false);
    expect(ed.pista).toBeNull();
    // Con Mayús no se agarra: tampoco la pista.
    ed.aplicar(ed.seleccionar.mover(ev(8, -3, { mayus: true })));
    expect(ed.pista).toBeNull();
    ed.aplicar(ed.seleccionar.mover(ev(8, -3)));
    ed.aplicar(ed.seleccionar.salir());
    expect(ed.pista).toBeNull();
  });
});
