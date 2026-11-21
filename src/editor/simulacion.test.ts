// Sesión de Simular (T32, docs/plan-T32.md): pulsar y soltar (D5-B, M-A),
// detención (D3-A), textos de la barra (AV-A, ajuste 2) y, en el Editor,
// entrar y salir sin tocar el documento. Sin DOM (ajuste 4: un pulsador
// mantenido no es un gesto para F5).
import { describe, expect, it } from "vitest";
import { corto, oscilante } from "../core/circuitos/sim";
import { inversion } from "../core/circuitos/inversion";
import { marchaParada } from "../core/circuitos/marchaParada";
import { serializar } from "../core/io";
import * as comandos from "../core/model/comandos";
import type { Hoja } from "../core/model/documento";
import type { Simulacion } from "../core/sim/motor";
import { f5CambiaModo } from "../ui/modo";
import { Editor } from "./editor";
import { SesionSimulacion, textoNoSimula } from "./simulacion";

function sesion(h: Hoja): SesionSimulacion {
  const r = SesionSimulacion.entrar(h);
  if (!r.ok) throw new Error(`No entra: ${JSON.stringify(r.errores)}`);
  return r.sesion;
}

function tension(s: Simulacion, etiqueta: string): boolean {
  const g = s.netlist.bobinas.findIndex((b) => b.etiqueta === etiqueta);
  if (g < 0) throw new Error(`Sin bobina ${etiqueta}`);
  return s.tension[g]!;
}

function encendida(s: Simulacion, comp: string): boolean {
  const k = s.netlist.cargas.findIndex((c) => c.comp === comp);
  if (k < 0) throw new Error(`Sin carga ${comp}`);
  return s.encendidas[k]!;
}

/** Un punto de grilla sobre el cuerpo de `id` (el que elige el clic de Editar). */
function puntoDe(ed: Editor, id: string): { x: number; y: number } {
  const c = ed.escena.obtener(id);
  if (!c) throw new Error(`Sin ${id} en la escena`);
  for (let dy = -4; dy <= 4; dy += 0.25)
    for (let dx = -4; dx <= 4; dx += 0.25) if (ed.escena.componenteEnPunto(c.x + dx, c.y + dy, 0) === id) return { x: c.x + dx, y: c.y + dy };
  throw new Error(`No hay un punto sobre ${id}`);
}

const ESCALA = 20;

describe("SesionSimulacion: pulsar y soltar (D5-B)", () => {
  it("mantener S1 arranca K1 y H1; al soltar el botón retiene; S0 para", () => {
    const { doc, comp } = marchaParada();
    const s = sesion(doc.hojas[0]!);
    expect(s.presionar(comp.s1, false)).toBe(true);
    expect([s.mantenido, tension(s.sim, "K1"), encendida(s.sim, comp.h1)]).toEqual([comp.s1, true, true]);
    expect(s.soltarBoton()).toBe(true);
    expect([s.mantenido, tension(s.sim, "K1"), s.sim.pulsados.size]).toEqual([null, true, 0]);
    s.presionar(comp.s0, false);
    expect(tension(s.sim, "K1")).toBe(false);
    s.soltarBoton();
    expect([tension(s.sim, "K1"), encendida(s.sim, comp.h1), s.textoEstado()]).toEqual([false, false, null]);
  });

  it("soltar sin nada mantenido no hace nada; lo que no es pulsador no se aprieta", () => {
    const { doc, comp } = marchaParada();
    const s = sesion(doc.hojas[0]!);
    expect(s.soltarBoton()).toBe(false);
    expect(s.presionar(comp.k1Bobina, false)).toBe(false);
    expect(s.presionar(comp.h1, true)).toBe(false);
    expect([s.mantenido, s.fijados, s.sim.pulsados.size]).toEqual([null, [], 0]);
  });

  it("Mayús+clic fija hasta otro clic, con Mayús o sin ella; la barra ya no dice «Fijados» (T33, F-A)", () => {
    const { doc, comp } = marchaParada();
    const s = sesion(doc.hojas[0]!);
    s.presionar(comp.s0, true);
    expect([s.fijados, s.mantenido, s.textoEstado()]).toEqual([[comp.s0], null, null]);
    expect(s.soltarBoton()).toBe(false);
    s.presionar(comp.s1, false);
    expect(tension(s.sim, "K1")).toBe(false); // S0 fijado corta la marcha
    s.soltarBoton();
    s.presionar(comp.s1, true);
    expect([s.fijados, s.textoEstado()]).toEqual([[comp.s0, comp.s1], null]);
    s.presionar(comp.s0, false); // otro clic sobre el fijado lo suelta
    expect([s.fijados, s.mantenido, tension(s.sim, "K1")]).toEqual([[comp.s1], null, true]);
    s.presionar(comp.s1, true);
    expect([s.fijados, s.sim.pulsados.size, s.textoEstado()]).toEqual([[], 0, null]);
  });

  it("al perder la ventana (M-A) se suelta el mantenido y los fijados siguen", () => {
    const { doc, comp } = marchaParada();
    const s = sesion(doc.hojas[0]!);
    s.presionar(comp.s1, true);
    expect(tension(s.sim, "K1")).toBe(true);
    s.presionar(comp.s0, false);
    expect(tension(s.sim, "K1")).toBe(false);
    expect(s.perderVentana()).toBe(true);
    expect([s.mantenido, s.fijados, tension(s.sim, "K1")]).toEqual([null, [comp.s1], true]);
    expect(s.perderVentana()).toBe(false);
  });

  it("un apretar con otro mantenido (el soltar se perdió) suelta primero aquel", () => {
    const { doc, comp } = inversion();
    const s = sesion(doc.hojas[0]!);
    s.presionar(comp.s1, false);
    s.presionar(comp.s2, false);
    expect([s.mantenido, [...s.sim.pulsados], tension(s.sim, "K1"), tension(s.sim, "K2")]).toEqual([comp.s2, [comp.s2], true, false]);
  });

  it("inversión: con K1, K2 no entra; S0 apaga; con S2 entra K2 y K1 no", () => {
    const { doc, comp } = inversion();
    const s = sesion(doc.hojas[0]!);
    const pulsarYSoltar = (id: string) => {
      s.presionar(id, false);
      s.soltarBoton();
    };
    pulsarYSoltar(comp.s1);
    pulsarYSoltar(comp.s2);
    expect([tension(s.sim, "K1"), tension(s.sim, "K2")]).toEqual([true, false]);
    pulsarYSoltar(comp.s0);
    pulsarYSoltar(comp.s2);
    expect([tension(s.sim, "K1"), tension(s.sim, "K2"), s.textoNuevos()]).toEqual([false, true, null]);
  });
});

describe("SesionSimulacion: detención (D3-A) y avisos (AV-A)", () => {
  it("corto: al pulsar S1 avisa, se detiene y los pulsadores no responden", () => {
    const { doc, comp } = corto();
    const s = sesion(doc.hojas[0]!);
    expect(s.presionar(comp.s1, false)).toBe(true);
    expect(s.textoNuevos()).toBe("Cortocircuito entre L y N");
    expect(s.detenida).toBe(true);
    expect(s.textoEstado()).toBe("Simulación detenida: Cortocircuito entre L y N · F5 vuelve a Editar");
    const antes = s.sim;
    expect(s.soltarBoton()).toBe(true); // el botón se suelta, pero el estado queda
    expect(s.sim.pulsados).toEqual(antes.pulsados);
    expect(s.presionar(comp.s1, true)).toBe(false);
    expect([s.fijados, s.nuevos]).toEqual([[], []]);
  });

  it("oscilante: se detiene al entrar y lo avisa en los avisos de la entrada", () => {
    const { doc } = oscilante();
    const s = sesion(doc.hojas[0]!);
    expect([s.detenida, s.textoNuevos()]).toEqual([true, "Oscila: K1"]);
    expect(s.textoEstado()).toBe("Simulación detenida: Oscila: K1 · F5 vuelve a Editar");
  });

  it("textoNoSimula: las etiquetas repetidas, sin repetir", () => {
    const r4 = (id: string, etiqueta: string) => ({ regla: "R4", severidad: "error", id, etiqueta, otro: "contactor" }) as const;
    expect(textoNoSimula([r4("c1", "K1"), r4("c2", "K1")])).toBe("No se puede simular: K1 está repetida");
    expect(textoNoSimula([r4("c1", "K1"), r4("c2", "K1"), r4("c3", "H2")])).toBe("No se puede simular: K1 y H2 están repetidas");
  });
});

describe("Editor: entrar y salir de Simular (E-A)", () => {
  it("entra, pulsa por el punto y sale sin tocar el documento ni el historial", () => {
    const { doc, comp } = marchaParada();
    const antes = serializar(doc);
    const ed = new Editor(doc);
    let avisos = 0;
    ed.alCambiarSimulacion = () => avisos++;
    expect(ed.entrarSimulacion()).toBeNull();
    expect([ed.simulacion !== null, avisos]).toEqual([true, 1]);
    const p = puntoDe(ed, comp.s1);
    expect(ed.sobrePulsador(p.x, p.y, ESCALA)).toBe(true);
    expect(ed.presionarSimulacion(p.x, p.y, ESCALA, false)).toBe(true);
    expect(tension(ed.simulacion!.sim, "K1")).toBe(true);
    // Ajuste 4: con S1 mantenido no hay gesto, así que F5 sale.
    expect(ed.enGesto).toBe(false);
    expect(f5CambiaModo({ repetida: false, modal: false, gesto: ed.enGesto })).toBe(true);
    ed.salirSimulacion();
    expect([ed.simulacion, avisos]).toEqual([null, 3]);
    expect(ed.soltarSimulacion()).toBe(false); // el soltar que llega después no hace nada
    expect([serializar(ed.documento), ed.modificado, ed.puedeDeshacer]).toEqual([antes, false, false]);
  });

  it("el clic fuera de un pulsador no hace nada; la bobina no se pulsa", () => {
    const { doc, comp } = marchaParada();
    const ed = new Editor(doc);
    ed.entrarSimulacion();
    const b = puntoDe(ed, comp.k1Bobina);
    expect(ed.sobrePulsador(b.x, b.y, ESCALA)).toBe(false);
    expect(ed.presionarSimulacion(b.x, b.y, ESCALA, false)).toBe(false);
    expect(ed.presionarSimulacion(-100, -100, ESCALA, false)).toBe(false);
    expect(ed.simulacion!.sim.pulsados.size).toBe(0);
  });

  it("sin Simular, pulsar no hace nada", () => {
    const { doc, comp } = marchaParada();
    const ed = new Editor(doc);
    const p = puntoDe(ed, comp.s1);
    expect([ed.sobrePulsador(p.x, p.y, ESCALA), ed.presionarSimulacion(p.x, p.y, ESCALA, false), ed.soltarSimulacion()]).toEqual([false, false, false]);
  });

  it("con una bobina repetida (R4) no entra y devuelve los errores (D4-A)", () => {
    const { doc } = marchaParada();
    const ed = new Editor(doc);
    ed.ejecutar(comandos.colocar(ed.documento, { tipo: "contactor.bobina", x: 60, y: 60, rot: 0, espejado: false, etiqueta: "K1", params: {} }));
    const errores = ed.entrarSimulacion();
    expect(errores?.map((a) => a.regla)).toEqual(["R4", "R4"]);
    expect(textoNoSimula(errores!)).toBe("No se puede simular: K1 está repetida");
    expect(ed.simulacion).toBeNull();
  });
});
