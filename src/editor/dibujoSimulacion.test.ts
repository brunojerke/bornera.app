// Dibujo del estado de la simulación desde el Editor (T33; docs/plan-T33.md):
// D8-A (solo la región que cambió), D9-B, I-A, M-A y el ajuste 3.
import { describe, expect, it } from "vitest";
import { corto, oscilante } from "../core/circuitos/sim";
import { marchaParada } from "../core/circuitos/marchaParada";
import { serializar } from "../core/io";
import * as motor from "../core/sim/motor";
import type { Simulacion } from "../core/sim/motor";
import { unirCajas, type Caja } from "../render/camara";
import { DETALLE_COMPLETO } from "../render/detalle";
import { CLASE_CORTO, CLASE_EDITAR, CLASE_FASE, CLASE_NEUTRO, type ClaseCable } from "../render/escenaEditable";
import type { Renderer } from "../render/renderer";
import { bancoMando } from "./bancoMando";
import { dibujoDe } from "./dibujoSimulacion";
import { Editor, type DestinoVista } from "./editor";

/** Vista falsa que anota lo que se invalida por el estado (y por región, aparte). */
class VistaFalsa implements DestinoVista {
  estados: (readonly Caja[])[] = [];
  regiones: Caja[] = [];
  invalidarRegion(caja: Caja): void {
    this.regiones.push(caja);
  }
  invalidar(): void {}
  invalidarEstado(cajas: readonly Caja[]): void {
    this.estados.push([...cajas]);
  }
}

function conVista(ed: Editor): VistaFalsa {
  const v = new VistaFalsa();
  ed.vista = v;
  return v;
}

/** La clase esperada de cada red de `sim`. */
function claseEsperada(sim: Simulacion, i: number): ClaseCable {
  const d = sim.detenida;
  if (d?.tipo === "corto" && d.redes.includes(i)) return CLASE_CORTO;
  const p = sim.potencialDeRed[i];
  if (p === null || p === undefined) return CLASE_EDITAR;
  return sim.netlist.potenciales[p]!.papel === "fase" ? CLASE_FASE : CLASE_NEUTRO;
}

/** Cada cable de la escena tiene la clase de su red. */
function cablesAlDia(ed: Editor): void {
  const sim = ed.simulacion!.sim;
  sim.netlist.redes.forEach((r, i) => {
    for (const id of r.cables) expect(ed.escena.claseDeCable(id), `${id} (red ${i})`).toBe(claseEsperada(sim, i));
  });
}

const flags = (ed: Editor, id: string) => {
  const c = ed.escena.obtener(id)!;
  return { accionado: c.accionado === true, encendido: c.encendido === true, marcado: c.marcado === true };
};

function dibujarTodo(ed: Editor): unknown[][] {
  const llamadas: unknown[][] = [];
  const r = new Proxy({} as Renderer, { get: (_, n) => (...a: unknown[]) => llamadas.push([n, ...a]) });
  const caja = ed.escena.caja!;
  ed.escena.dibujar(r, { escala: 20, colores: { simbolo: "#000", borne: "#f00", fase: "#d22", neutro: "#08c" }, visible: caja, detalle: { ...DETALLE_COMPLETO } });
  return llamadas;
}

describe("Editor: dibujo del estado (T33)", () => {
  it("entrar dibuja el estado y rehace la escena entera (I-A); los cables van por el potencial de su red", () => {
    const { doc, comp } = marchaParada();
    const ed = new Editor(doc);
    const v = conVista(ed);
    expect(ed.entrarSimulacion()).toBeNull();
    expect(v.estados).toEqual([[ed.escena.caja]]);
    expect(ed.escena.simulando).toBe(true);
    cablesAlDia(ed);
    // En reposo: S0 (NC) conduce y no está accionado; nada encendido.
    expect(flags(ed, comp.s0)).toEqual({ accionado: false, encendido: false, marcado: false });
    expect(flags(ed, comp.h1).encendido).toBe(false);
    // Hay cables con fase y con neutro, y alguno sin potencial (con el color de Editar, ajuste 3).
    const clases = new Set(doc.hojas[0]!.cables.map((w) => ed.escena.claseDeCable(w.id)));
    expect(clases).toEqual(new Set([CLASE_FASE, CLASE_NEUTRO, CLASE_EDITAR]));
  });

  it("pulsar y soltar: contactos accionados, cargas encendidas y cables al día; solo lo que cambió", () => {
    const { doc, comp } = marchaParada();
    const ed = new Editor(doc);
    const v = conVista(ed);
    ed.entrarSimulacion();
    v.estados = [];
    expect(ed.presionarPulsador(comp.s1)).toBe(true);
    cablesAlDia(ed);
    expect(flags(ed, comp.s1).accionado).toBe(true);
    expect(flags(ed, comp.k1Auxiliar).accionado).toBe(true);
    expect([flags(ed, comp.k1Bobina).encendido, flags(ed, comp.h1).encendido]).toEqual([true, true]);
    expect(v.estados).toHaveLength(1);
    expect(v.estados[0]!.length).toBeGreaterThan(0);
    // Las cajas son las de lo que cambió: ninguna de la fase ni del neutro, que siguen igual.
    const fase = doc.hojas[0]!.componentes.find((c) => c.id === comp.fase)!;
    for (const k of v.estados[0]!) expect(k.y > fase.y + 1 || k.x > fase.x + 1 || k.x + k.ancho < fase.x - 1).toBe(true);

    ed.soltarSimulacion();
    cablesAlDia(ed);
    expect([flags(ed, comp.s1).accionado, flags(ed, comp.k1Auxiliar).accionado, flags(ed, comp.h1).encendido]).toEqual([false, true, true]);

    // Mantener S0: se acciona (abre) y K1 cae.
    ed.presionarPulsador(comp.s0);
    cablesAlDia(ed);
    expect([flags(ed, comp.s0).accionado, flags(ed, comp.k1Bobina).encendido, flags(ed, comp.k1Auxiliar).accionado]).toEqual([true, false, false]);
    ed.soltarSimulacion();
    expect(flags(ed, comp.s0).accionado).toBe(false);
    // Sin cambios no se invalida nada.
    v.estados = [];
    expect(ed.soltarSimulacion()).toBe(false);
    expect(v.estados).toEqual([]);
  });

  it("D8-A: en la escena de mando, pulsar una marcha rehace solo su celda", () => {
    const banco = bancoMando();
    const ed = new Editor(banco.doc);
    const v = conVista(ed);
    ed.entrarSimulacion();
    for (const m of [banco.marchas[0]!, banco.marchas[150]!]) {
      v.estados = [];
      expect(ed.presionarPulsador(m.marcha)).toBe(true);
      const cajas = v.estados.flat();
      expect(cajas.length).toBeGreaterThan(0);
      const todo = cajas.reduce((a, b) => unirCajas(a, b));
      // Una celda mide 24 × 40 (simple) o 32 × 40 (con rama NC): el cambio cabe en ella, con el margen del trazo.
      expect(todo.ancho).toBeLessThanOrEqual(32 + 2);
      expect(todo.alto).toBeLessThanOrEqual(40 + 2);
      const p = ed.escena.obtener(m.marcha)!;
      expect(todo.x <= p.x && p.x <= todo.x + todo.ancho && todo.y <= p.y && p.y <= todo.y + todo.alto).toBe(true);
      ed.soltarSimulacion();
    }
    expect(v.regiones).toEqual([]); // todo pasa por invalidarEstado
  });

  it("salir vuelve al dibujo de Editar: la escena entera, igual que antes de entrar", () => {
    const { doc, comp } = marchaParada({ ramaNC: true });
    const antes = serializar(doc);
    const ed = new Editor(doc);
    const v = conVista(ed);
    const enEditar = dibujarTodo(ed);
    ed.entrarSimulacion();
    ed.presionarPulsador(comp.s1);
    expect(dibujarTodo(ed)).not.toEqual(enEditar);
    v.estados = [];
    ed.salirSimulacion();
    expect(v.estados).toEqual([[ed.escena.caja]]);
    expect([ed.escena.simulando, ed.escena.conEstadoSimulacion]).toEqual([false, false]);
    expect(dibujarTodo(ed)).toEqual(enEditar);
    expect(serializar(ed.documento)).toBe(antes);
  });

  it("M-A: la red en corto va en conflicto; las bobinas que oscilan, marcadas", () => {
    const c = corto();
    const ed = new Editor(c.doc);
    conVista(ed);
    ed.entrarSimulacion();
    ed.presionarPulsador(c.comp["s1"]!);
    expect(ed.simulacion!.detenida).toBe(true);
    cablesAlDia(ed);
    expect(c.doc.hojas[0]!.cables.some((w) => ed.escena.claseDeCable(w.id) === CLASE_CORTO)).toBe(true);

    const o = oscilante();
    const ed2 = new Editor(o.doc);
    conVista(ed2);
    ed2.entrarSimulacion();
    expect(ed2.simulacion!.detenida).toBe(true);
    expect(flags(ed2, o.comp["k1"]!).marcado).toBe(true);
    expect(flags(ed2, o.comp["k1nc"]!).marcado).toBe(false);
    ed2.salirSimulacion();
    expect(flags(ed2, o.comp["k1"]!).marcado).toBe(false);
  });

  it("F-A: el pulsador fijado con Mayús se ve accionado aunque se suelte el botón", () => {
    const { doc, comp } = marchaParada();
    const ed = new Editor(doc);
    conVista(ed);
    ed.entrarSimulacion();
    ed.presionarPulsador(comp.s0, true);
    ed.soltarSimulacion();
    expect(flags(ed, comp.s0).accionado).toBe(true);
    expect(ed.simulacion!.textoEstado()).toBeNull();
  });

  it("dibujoDe: NA accionado si conduce, NC si no; las cargas encendidas", () => {
    const { doc, comp } = marchaParada({ ramaNC: true });
    const ed = new Editor(doc);
    ed.entrarSimulacion();
    let d = dibujoDe(ed.simulacion!.sim);
    // En reposo, la lámpara de parado (H2) está encendida por el NC de K1.
    expect(d.componentes.get(comp.h2!)).toEqual({ accionado: false, encendido: true, marcado: false });
    expect(d.componentes.has(comp.k1AuxiliarNC!)).toBe(false);
    ed.presionarPulsador(comp.s1);
    d = dibujoDe(ed.simulacion!.sim);
    expect(d.componentes.get(comp.k1AuxiliarNC!)).toEqual({ accionado: true, encendido: false, marcado: false });
    expect(d.componentes.has(comp.h2!)).toBe(false);
  });
  it("dibujoDe con polos (T34): los principales se ven accionados con su bobina, un estado por componente", () => {
    const comps = [
      { id: "t", tipo: "fuente.trifasica", etiqueta: "" },
      { id: "n", tipo: "fuente.neutro", etiqueta: "N" },
      { id: "s1", tipo: "pulsador.na", etiqueta: "S1" },
      { id: "kb", tipo: "contactor.bobina", etiqueta: "K1" },
      { id: "k", tipo: "contactor.principal", etiqueta: "K1" },
    ].map((c) => ({ ...c, x: 0, y: 0, rot: 0 as const, espejado: false, params: {} }));
    const cable = (id: string, a: [string, string], b: [string, string]) => ({
      id,
      desde: { tipo: "borne" as const, comp: a[0], borne: a[1] },
      hasta: { tipo: "borne" as const, comp: b[0], borne: b[1] },
      codos: [],
    });
    const hoja = { nombre: "Hoja 1", componentes: comps, cables: [cable("w1", ["t", "L1"], ["s1", "13"]), cable("w2", ["s1", "14"], ["kb", "A1"]), cable("w3", ["kb", "A2"], ["n", "N"]), cable("w4", ["t", "L2"], ["k", "3"])] };
    const sim = (s: Simulacion) => dibujoDe(s);
    const { entrarSimulacion, pulsar } = motor;
    const e = entrarSimulacion(hoja);
    if (!e.ok) throw new Error("no entra");
    expect(sim(e.sim).componentes.has("k")).toBe(false);
    const p = pulsar(e.sim, "s1");
    const d = sim(p);
    expect(d.componentes.get("k")).toEqual({ accionado: true, encendido: false, marcado: false });
    // El cable de L2 al polo 3 va como fase.
    expect(d.clases[p.netlist.redDeBorne.get("k")!.get("3")!]).toBe(CLASE_FASE);
  });
});

describe("dibujoDe: mando y protecciones (T36)", () => {
  /** L – Q1 – F2 (polo 1-2 del térmico) – 95-96 – H1 – N y – 97-98 – H2 – N. */
  function hojaT36() {
    const comps: [string, string, string][] = [
      ["f", "fuente.fase", "L"],
      ["n", "fuente.neutro", "N"],
      ["q", "proteccion.termomagnetica_unipolar", "Q1"],
      ["t", "proteccion.termico", "F2"],
      ["c95", "termico.contacto_nc", "F2"],
      ["c97", "termico.contacto_na", "F2"],
      ["h1", "senalizacion.lampara", "H1"],
      ["h2", "senalizacion.bocina", "H2"],
    ];
    const nodos = [
      ["f:L", "q:1"],
      ["q:2", "t:1"],
      ["t:2", "c95:95", "c97:97"],
      ["c95:96", "h1:X1"],
      ["c97:98", "h2:X1"],
      ["h1:X2", "h2:X2", "n:N"],
    ];
    const extremo = (x: string) => {
      const [comp, borne] = x.split(":") as [string, string];
      return { tipo: "borne" as const, comp, borne };
    };
    return {
      nombre: "Hoja 1",
      componentes: comps.map(([id, tipo, etiqueta]) => ({ id, tipo, x: 0, y: 0, rot: 0 as const, espejado: false, etiqueta, params: {} })),
      cables: nodos.flatMap((nodo, j) => nodo.slice(1).map((x, i) => ({ id: `w${j}_${i}`, desde: extremo(nodo[i]!), hasta: extremo(x), codos: [] }))),
    };
  }

  it("95-96 y 97-98 se dibujan en su estado real, el de reposo: 95-96 cerrado, 97-98 abierto (ajuste 1)", () => {
    const e = motor.entrarSimulacion(hojaT36());
    if (!e.ok) throw new Error("No entra");
    const d = dibujoDe(e.sim);
    expect(d.componentes.get("c95")?.accionado ?? false).toBe(false);
    expect(d.componentes.get("c97")?.accionado ?? false).toBe(false);
    // H1 encendida por el 95-96 cerrado; la bocina H2 apagada por el 97-98 abierto.
    expect(d.componentes.get("h1")?.encendido).toBe(true);
    expect(d.componentes.get("h2")?.encendido ?? false).toBe(false);
  });

  it("Q1 y F2 conducen: salen accionados (Q1 se dibuja cerrado, D20-B; F2 no tiene dibujo accionado y se ve igual)", () => {
    const e = motor.entrarSimulacion(hojaT36());
    if (!e.ok) throw new Error("No entra");
    const d = dibujoDe(e.sim);
    expect(d.componentes.get("q")?.accionado).toBe(true);
    expect(d.componentes.get("t")?.accionado).toBe(true);
  });
});
