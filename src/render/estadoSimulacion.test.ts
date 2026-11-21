// Dibujo del estado de la simulación en la escena (T33, D8-A y D9-B; docs/plan-T33.md).
import { describe, expect, it } from "vitest";
import { buscarSimbolo, type DefinicionSimbolo } from "../core/symbols";
import type { Caja } from "./camara";
import { DETALLE_COMPLETO } from "./detalle";
import { definicionAccionada, type ComponenteEscena, type InfoDibujo } from "./escena";
import { CLASE_CORTO, CLASE_EDITAR, CLASE_FASE, CLASE_NEUTRO, cajaUnion, cajasCable, EscenaEditable } from "./escenaEditable";
import type { Renderer } from "./renderer";
import { cajaDibujo } from "./simbolo";

function grabador(): { r: Renderer; llamadas: unknown[][] } {
  const llamadas: unknown[][] = [];
  const r = new Proxy({} as Renderer, {
    get: (_, nombre) => (...args: unknown[]) => llamadas.push([nombre, ...args]),
  });
  return { r, llamadas };
}

const COLORES = { simbolo: "#000", borne: "#f00", aviso: "#c40", conflicto: "#a12", fase: "#d22", neutro: "#08c", encendida: "#fc1" };
const TODO: Caja = { x: -100, y: -100, ancho: 200, alto: 200 };
const info = (visible: Caja = TODO): InfoDibujo => ({ escala: 20, colores: COLORES, visible, detalle: { ...DETALLE_COMPLETO } });

const def = (tipo: string): DefinicionSimbolo => buscarSimbolo(tipo)!;
const en = (tipo: string, x: number, y: number, etiqueta: string): ComponenteEscena => ({ def: def(tipo), x, y, rotacion: 0, espejado: false, etiqueta });

/** Lámpara, pulsador NA, bobina y auxiliar NC, con cuatro cables y una unión. */
function escena(): EscenaEditable {
  const e = new EscenaEditable([
    ["h1", en("senalizacion.lampara", 0, 0, "H1")],
    ["s1", en("pulsador.na", 10, 0, "S1")],
    ["k1", en("contactor.bobina", 20, 0, "K1")],
    ["k1nc", en("contactor.auxiliar_nc", 30, 0, "K1")],
  ]);
  e.ponerCable("w1", { puntos: [0, -2, 0, -6, 10, -6, 10, -2], libres: [] });
  e.ponerCable("w2", { puntos: [10, 2, 10, 6, 20, 6, 20, 2], libres: [] });
  e.ponerCable("w3", { puntos: [20, -2, 20, -8], libres: [20, -8] });
  e.ponerCable("w4", { puntos: [5, -6, 5, -10], libres: [5, -10] });
  e.ponerUnion({ x: 5, y: -6, cables: ["w1", "w4"], componentes: [] });
  return e;
}

/** El estilo vigente antes de cada llamada `nombre`. */
function estilosAntesDe(llamadas: unknown[][], nombre: string): Record<string, unknown>[] {
  const salida: Record<string, unknown>[] = [];
  let estilo: Record<string, unknown> = {};
  for (const l of llamadas) {
    if (l[0] === "estilo") estilo = { ...estilo, ...(l[1] as object) };
    if (l[0] === nombre) salida.push(estilo);
  }
  return salida;
}

/** El estilo vigente en la llamada `indice`, con guardar y restaurar. */
function estiloEn(llamadas: unknown[][], indice: number): Record<string, unknown> {
  const pila: Record<string, unknown>[] = [];
  let estilo: Record<string, unknown> = {};
  for (let i = 0; i < indice; i++) {
    const l = llamadas[i]!;
    if (l[0] === "estilo") estilo = { ...estilo, ...(l[1] as object) };
    else if (l[0] === "guardar") pila.push(estilo);
    else if (l[0] === "restaurar") estilo = pila.pop() ?? {};
  }
  return estilo;
}

const REPOSO = { accionado: false, encendido: false, marcado: false };

describe("estado de la simulación en la escena (T33)", () => {
  it("sin estado dibuja igual que antes de entrar, y después de salir igual que antes", () => {
    const e = escena();
    const antes = grabador();
    e.dibujar(antes.r, info());
    e.claseCable("w1", CLASE_FASE);
    e.claseCable("w2", CLASE_NEUTRO);
    e.estadoComponente("s1", { ...REPOSO, accionado: true });
    e.estadoComponente("h1", { ...REPOSO, encendido: true });
    e.estadoComponente("k1", { ...REPOSO, marcado: true });
    expect(e.conEstadoSimulacion).toBe(true);
    const durante = grabador();
    e.dibujar(durante.r, info());
    expect(durante.llamadas).not.toEqual(antes.llamadas);
    e.limpiarEstado();
    expect(e.conEstadoSimulacion).toBe(false);
    const despues = grabador();
    e.dibujar(despues.r, info());
    expect(despues.llamadas).toEqual(antes.llamadas);
  });

  it("un trazo por clase con su color; una red sin potencial va con el color de Editar (ajuste 3)", () => {
    const e = escena();
    e.claseCable("w1", CLASE_FASE);
    e.claseCable("w2", CLASE_NEUTRO);
    e.claseCable("w4", CLASE_CORTO);
    // w3 sigue en CLASE_EDITAR: sin potencial.
    const g = grabador();
    e.dibujar(g.r, info());
    const trazos = estilosAntesDe(g.llamadas, "lineas").map((s) => s["trazo"]);
    expect(trazos).toEqual([COLORES.simbolo, COLORES.fase, COLORES.neutro, COLORES.conflicto]);
    const lineas = g.llamadas.filter((l) => l[0] === "lineas").map((l) => l[2]);
    expect(lineas).toEqual([1, 3, 3, 1]);
  });

  it("en Editar, todos los cables en un solo trazo", () => {
    const g = grabador();
    escena().dibujar(g.r, info());
    expect(g.llamadas.filter((l) => l[0] === "lineas")).toHaveLength(1);
  });

  it("las uniones van con el color de su red", () => {
    const e = escena();
    e.claseCable("w1", CLASE_FASE);
    e.claseCable("w4", CLASE_FASE);
    const g = grabador();
    e.dibujar(g.r, info());
    expect(estilosAntesDe(g.llamadas, "puntos").map((s) => s["relleno"])).toEqual([COLORES.fase]);
  });

  it("claseCable devuelve las cajas de sus tramos y de sus uniones; sin cambio, ninguna", () => {
    const e = escena();
    const w1 = e.obtenerCable("w1")!;
    expect(e.claseCable("w1", CLASE_FASE)).toEqual([...cajasCable(w1), cajaUnion(5, -6)]);
    expect(e.claseDeCable("w1")).toBe(CLASE_FASE);
    expect(e.claseCable("w1", CLASE_FASE)).toEqual([]);
    expect(e.claseCable("w3", CLASE_EDITAR)).toEqual([]);
    expect(e.claseCable("nada", CLASE_FASE)).toEqual([]);
  });

  it("estadoComponente devuelve su caja de dibujo, que no cambia; sin cambio, ninguna", () => {
    const e = escena();
    const caja = cajaDibujo(def("pulsador.na"), en("pulsador.na", 10, 0, "S1"), "S1");
    expect(e.estadoComponente("s1", { ...REPOSO, accionado: true })).toEqual([caja]);
    expect(e.obtener("s1")!.accionado).toBe(true);
    expect(e.estadoComponente("s1", { ...REPOSO, accionado: true })).toEqual([]);
    expect(e.estadoComponente("s1", REPOSO)).toEqual([caja]);
    expect(e.obtener("s1")!.accionado).toBeUndefined();
    expect(e.estadoComponente("nada", REPOSO)).toEqual([]);
  });

  it("el contacto accionado se dibuja con su geometría accionada", () => {
    const e = escena();
    e.estadoComponente("s1", { ...REPOSO, accionado: true });
    e.estadoComponente("k1nc", { ...REPOSO, accionado: true });
    const g = grabador();
    e.dibujar(g.r, info());
    const dibujados = g.llamadas.filter((l) => l[0] === "simbolo").map((l) => l[1] as DefinicionSimbolo);
    expect(dibujados).toContain(definicionAccionada(def("pulsador.na")));
    expect(dibujados).toContain(definicionAccionada(def("contactor.auxiliar_nc")));
    expect(definicionAccionada(def("pulsador.na")).primitivas).toBe(def("pulsador.na").primitivasAccionado);
    // Una por definición: el Renderer la cachea.
    expect(definicionAccionada(def("pulsador.na"))).toBe(definicionAccionada(def("pulsador.na")));
    expect(definicionAccionada(def("senalizacion.lampara"))).toBe(def("senalizacion.lampara"));
  });

  it("la lámpara encendida y la bobina con tensión van rellenas, debajo de su trazo", () => {
    const e = escena();
    e.estadoComponente("h1", { ...REPOSO, encendido: true });
    e.estadoComponente("k1", { ...REPOSO, encendido: true });
    const g = grabador();
    e.dibujar(g.r, info());
    const l = g.llamadas.map((x) => x[0]);
    const circulo = g.llamadas.findIndex((x) => x[0] === "circulo" && x[4] === true);
    const rect = g.llamadas.findIndex((x) => x[0] === "rectangulo" && x[5] === true);
    expect(g.llamadas[circulo]).toEqual(["circulo", 0, 0, 0.75, true]);
    expect(g.llamadas[rect]).toEqual(["rectangulo", -1, -0.75, 2, 1.5, true]);
    expect(estiloEn(g.llamadas, circulo)["relleno"]).toBe(COLORES.encendida);
    expect(estiloEn(g.llamadas, rect)["relleno"]).toBe(COLORES.encendida);
    // Cada relleno, antes del trazo de su símbolo.
    expect(l.indexOf("simbolo", circulo)).toBeGreaterThan(circulo);
    expect(l.indexOf("simbolo", rect)).toBeGreaterThan(rect);
  });

  it("la bobina marcada (detención, M-A) lleva el contorno a rayas en conflicto", () => {
    const e = escena();
    const sin = grabador();
    e.dibujar(sin.r, info());
    e.estadoComponente("k1", { ...REPOSO, marcado: true });
    const con = grabador();
    e.dibujar(con.r, info());
    const antes = estilosAntesDe(sin.llamadas, "lineas").map((s) => s["trazo"]);
    const despues = estilosAntesDe(con.llamadas, "lineas").map((s) => s["trazo"]);
    expect(despues).toEqual([...antes, COLORES.conflicto]);
  });
});
