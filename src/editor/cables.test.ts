// El editor con cables (T12): dibujo e invalidación, borrar y deshacer,
// elegir con el mouse, y los bloqueos de girar, espejar y arrastrar.

import { afterEach, describe, expect, it, vi } from "vitest";
import { validarHoja } from "../core/model/cables";
import { cablear, colocar, type DatosCable } from "../core/model/comandos";
import type { Componente, Documento, Extremo } from "../core/model/documento";
import type { Caja } from "../render/camara";
import type { InfoDibujo } from "../render/escena";
import { cajasCable, TOPE_TOLERANCIA_CABLE } from "../render/escenaEditable";
import type { Renderer } from "../render/renderer";
import { documentoNuevo, Editor, type DestinoVista } from "./editor";
import { TOLERANCIA_PX } from "./herramientas/seleccionar";
import type { EventoHerramienta } from "./herramientas/tipos";

class VistaFalsa implements DestinoVista {
  regiones: Caja[] = [];
  invalidarRegion(caja: Caja): void {
    this.regiones.push(caja);
  }
  invalidar(): void {}
}

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const comp = (tipo: string, x: number, y: number, etiqueta: string): Omit<Componente, "id"> => ({
  tipo,
  x,
  y,
  rot: 0,
  espejado: false,
  etiqueta,
  params: {},
});
const borne = (c: string, b: string): Extremo => ({ tipo: "borne", comp: c, borne: b });

/**
 * c1 bobina K1 (0, 0): A1 (0, −2), A2 (0, 2). c2 pulsador S1 (10, 0): 13
 * (10, −2), 14 (10, 2). c3 bobina K2 (40, 0), sin cables. c4 lámpara H1
 * (20, 0) con un puente que le cruza el cuerpo.
 * w1: K1.A1 → S1.13 recto; w2: K1.A2 → S1.14 por abajo (y = 5); w3: puente de H1.
 */
function armar(): { editor: Editor; vista: VistaFalsa; avisos: string[]; pasos: () => number } {
  const editor = new Editor(documentoNuevo());
  const vista = new VistaFalsa();
  editor.vista = vista;
  const avisos: string[] = [];
  editor.alAvisar = (t) => avisos.push(t);
  const doc = editor.documento;
  for (const c of [
    comp("contactor.bobina", 0, 0, "K1"),
    comp("pulsador.na", 10, 0, "S1"),
    comp("contactor.bobina", 40, 0, "K2"),
    comp("senalizacion.lampara", 20, 0, "H1"),
  ]) {
    editor.ejecutar(colocar(doc, c));
  }
  const cables: DatosCable[] = [
    { desde: borne("c1", "A1"), hasta: borne("c2", "13"), codos: [] },
    { desde: borne("c1", "A2"), hasta: borne("c2", "14"), codos: [[0, 5], [10, 5]] },
    { desde: borne("c4", "X1"), hasta: borne("c4", "X2"), codos: [] },
  ];
  for (const d of cables) editor.ejecutar(cablear(doc, d));
  vista.regiones = [];
  const historial = editor.historial as unknown as { hechos: unknown[] };
  return { editor, vista, avisos, pasos: () => historial.hechos.length };
}

const ev = (x: number, y: number, escala = 20): EventoHerramienta => ({ x, y, boton: 0, botones: 1, mayus: false, ctrl: false, escala });

describe("Editor: cables en la escena", () => {
  it("Cablear dibuja el cable e invalida cada tramo; deshacer invalida lo mismo y lo quita", () => {
    const { editor, vista } = armar();
    expect(editor.escena.cantidadCables).toBe(3);
    const w2 = editor.escena.obtenerCable("w2")!;
    expect(w2).toEqual({ puntos: [0, 2, 0, 5, 10, 5, 10, 2], libres: [] });
    editor.deshacer();
    expect(editor.escena.obtenerCable("w3")).toBeUndefined();
    expect(vista.regiones).toEqual(cajasCable({ puntos: [20, -2, 20, 2], libres: [] }));
    vista.regiones = [];
    editor.rehacer();
    expect(vista.regiones).toEqual(cajasCable({ puntos: [20, -2, 20, 2], libres: [] }));
  });

  it("borrar un componente con dos cables: un paso, los suelta; deshacer y rehacer, exactos", () => {
    const { editor, pasos } = armar();
    const antes = copia(editor.documento);
    const escenaAntes = ["w1", "w2"].map((id) => copia(editor.escena.obtenerCable(id)));
    editor.seleccionarIds(["c1"]);
    const n = pasos();
    expect(editor.accion("borrar")).toBe(true);
    expect(pasos()).toBe(n + 1);
    expect(editor.escena.obtenerCable("w1")).toEqual({ puntos: [0, -2, 10, -2], libres: [0, -2] });
    expect(editor.escena.obtenerCable("w2")!.libres).toEqual([0, 2]);
    expect(validarHoja(editor.documento.hojas[0]!)).toEqual([]);
    const borrado = copia(editor.documento);
    editor.deshacer();
    expect(editor.documento).toEqual(antes);
    expect(["w1", "w2"].map((id) => editor.escena.obtenerCable(id))).toEqual(escenaAntes);
    editor.rehacer();
    expect(editor.documento).toEqual(borrado);
  });

  it("Supr con cables y componentes mezclados: un paso, y deshacer devuelve todo", () => {
    const { editor, pasos } = armar();
    const antes = copia(editor.documento);
    editor.seleccionarIds(["c3", "w1", "w3"]);
    const n = pasos();
    editor.accion("borrar");
    expect(pasos()).toBe(n + 1);
    expect(editor.seleccion.size).toBe(0);
    expect(editor.escena.obtenerCable("w1")).toBeUndefined();
    editor.deshacer();
    expect(editor.documento).toEqual(antes);
    expect(editor.escena.cantidadCables).toBe(3);
  });

  it("un cable que apunta a algo que no está no se dibuja y avisa en la consola", () => {
    const doc: Documento = documentoNuevo();
    doc.hojas[0]!.cables.push({ id: "w1", desde: borne("c9", "A1"), hasta: { tipo: "libre", x: 0, y: 5 }, codos: [] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const editor = new Editor(doc);
    expect(editor.escena.cantidadCables).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/"w1"/));
  });
});

afterEach(() => vi.restoreAllMocks());

describe("Editor: elegir cables", () => {
  it("un clic sobre un cable gana sobre el componente que tiene abajo", () => {
    const { editor } = armar();
    const t = TOLERANCIA_PX / 20;
    expect(editor.escena.idEnPunto(20, 0, t)).toBe("w3"); // el puente cruza el cuerpo de H1
    expect(editor.escena.idEnPunto(20.5, 0, t)).toBe("c4");
    expect(editor.escena.idEnPunto(5, -2.1, t)).toBe("w1");
  });

  it("la tolerancia sigue al zoom, con un tope para los cables", () => {
    const { editor } = armar();
    // Al 10 % (2 px por unidad), 3 px son 1,5 unidades: el cable se acota a 0,4.
    const t = TOLERANCIA_PX / 2;
    expect(editor.escena.idEnPunto(5, -2 + TOPE_TOLERANCIA_CABLE - 0.05, t)).toBe("w1");
    expect(editor.escena.idEnPunto(5, -2 - TOPE_TOLERANCIA_CABLE - 0.05, t)).toBeNull();
    // Al 100 %, 3 px son 0,15 unidades.
    expect(editor.escena.idEnPunto(5, -2.2, TOLERANCIA_PX / 20)).toBeNull();
  });

  it("rectángulo: \"contiene\" pide todos los tramos adentro; \"toca\", alguno", () => {
    const { editor } = armar();
    const abajo = { x: -1, y: 4, ancho: 12, alto: 2 }; // solo el tramo de y = 5 de w2
    expect(editor.escena.idsEnCaja(abajo, "contiene")).not.toContain("w2");
    expect(editor.escena.idsEnCaja(abajo, "toca")).toContain("w2");
    expect(editor.escena.idsEnCaja({ x: -1, y: 1, ancho: 12, alto: 5 }, "contiene")).toContain("w2");
  });

  it("seleccionar un cable lo resalta con sus tramos, en un solo trazo", () => {
    const { editor } = armar();
    editor.seleccionarIds(["w1", "w2", "c3"]);
    const llamadas: { nombre: string; args: unknown[] }[] = [];
    const r = new Proxy({} as Renderer, {
      get: (_, nombre) => (...args: unknown[]) => llamadas.push({ nombre: String(nombre), args }),
    });
    editor.dibujarDinamico(r, {
      escala: 20,
      colores: { acento: "#06f" },
      visible: { x: -100, y: -100, ancho: 200, alto: 200 },
      medir: (f: () => void) => (f(), 0),
    } as never);
    const lineas = llamadas.filter((l) => l.nombre === "lineas");
    expect(lineas).toHaveLength(1);
    expect(lineas[0]!.args[1]).toBe(4); // 1 tramo de w1 y 3 de w2
    expect(llamadas.filter((l) => l.nombre === "rectangulos")).toHaveLength(1); // c3
  });
});

describe("Editor: girar, espejar y arrastrar con cables (bloqueado)", () => {
  it("R y M con un cable, o con un componente cableado, avisan y no dan paso", () => {
    const { editor, avisos, pasos } = armar();
    const antes = copia(editor.documento);
    const n = pasos();
    editor.seleccionarIds(["w1"]);
    expect(editor.accion("rotar")).toBe(false);
    editor.seleccionarIds(["c3", "w1"]);
    expect(editor.accion("espejar")).toBe(false);
    editor.seleccionarIds(["c1"]);
    expect(editor.accion("rotarAntihorario")).toBe(false);
    expect(avisos).toEqual([
      "Todavía no se pueden girar cables.",
      "Todavía no se pueden espejar cables.",
      "Todavía no se pueden girar componentes con cables.",
    ]);
    expect(pasos()).toBe(n);
    expect(editor.documento).toEqual(antes);
  });

  it("un componente sin cables se sigue girando", () => {
    const { editor, avisos, pasos } = armar();
    const n = pasos();
    editor.seleccionarIds(["c3"]);
    expect(editor.accion("rotar")).toBe(true);
    expect(pasos()).toBe(n + 1);
    expect(avisos).toEqual([]);
  });

  it("arrastrar un componente cableado avisa una vez, no arrastra y no da paso", () => {
    const { editor, avisos, pasos } = armar();
    const antes = copia(editor.documento);
    const n = pasos();
    editor.seleccionarIds(["c1"]);
    const h = editor.seleccionar;
    editor.aplicar(h.presionar(ev(0.5, 0)));
    editor.aplicar(h.mover(ev(3, 0)));
    editor.aplicar(h.mover(ev(5, 0)));
    expect(editor.arrastrando).toBe(false);
    editor.aplicar(h.soltar(ev(5, 0)));
    expect(avisos).toEqual(["Todavía no se pueden mover componentes con cables."]);
    expect(pasos()).toBe(n);
    expect(editor.documento).toEqual(antes);
  });

  it("arrastrar con un cable seleccionado tampoco; uno sin cables, sí", () => {
    const { editor, avisos, pasos } = armar();
    editor.seleccionarIds(["c3", "w1"]);
    editor.aplicar(editor.seleccionar.presionar(ev(40, 0)));
    editor.aplicar(editor.seleccionar.mover(ev(43, 0)));
    editor.aplicar(editor.seleccionar.soltar(ev(43, 0)));
    expect(avisos).toEqual(["Todavía no se pueden mover cables."]);
    const n = pasos();
    editor.seleccionarIds(["c3"]);
    editor.aplicar(editor.seleccionar.presionar(ev(40, 0)));
    editor.aplicar(editor.seleccionar.mover(ev(43, 0)));
    editor.aplicar(editor.seleccionar.soltar(ev(43, 0)));
    expect(pasos()).toBe(n + 1);
    expect(editor.documento.hojas[0]!.componentes[2]).toMatchObject({ id: "c3", x: 43 });
  });
});

describe("Editor: resumen con cables", () => {
  it("un cable: sus extremos; varios: la cantidad de cada cosa", () => {
    const { editor } = armar();
    editor.seleccionarIds(["w2"]);
    expect(editor.resumenSeleccion()).toEqual({
      cantidad: 1,
      componentes: 0,
      cables: 1,
      cable: { id: "w2", desde: { tipo: "borne", etiqueta: "K1", borne: "A2" }, hasta: { tipo: "borne", etiqueta: "S1", borne: "14" } },
      unico: null,
      varios: null,
    });
    editor.seleccionarIds(["c1", "w1", "w2"]);
    expect(editor.resumenSeleccion()).toMatchObject({ cantidad: 3, componentes: 1, cables: 2, varios: { etiqueta: "K1", rot: 0 } });
    editor.seleccionarIds(["w1", "w2"]);
    expect(editor.resumenSeleccion()).toMatchObject({ componentes: 0, cables: 2, varios: { etiqueta: null, rot: null } });
  });

  it("un extremo suelto se muestra como libre", () => {
    const { editor } = armar();
    editor.seleccionarIds(["c1"]);
    editor.accion("borrar");
    editor.seleccionarIds(["w1"]);
    expect(editor.resumenSeleccion().cable).toEqual({ id: "w1", desde: { tipo: "libre" }, hasta: { tipo: "borne", etiqueta: "S1", borne: "13" } });
  });
});

describe("EscenaEditable: dibujo de cables", () => {
  /** Dibuja la escena del editor en `visible` y devuelve las llamadas a `lineas` y `circulo`. */
  function dibujar(editor: Editor, visible: Caja, bornes = true) {
    const llamadas: { nombre: string; args: unknown[] }[] = [];
    const r = new Proxy({} as Renderer, {
      get: (_, nombre) => (...args: unknown[]) => llamadas.push({ nombre: String(nombre), args: args.map((a) => (Array.isArray(a) ? [...a] : a)) }),
    });
    const info: InfoDibujo = { escala: 20, colores: { simbolo: "#000", borne: "#f00" }, visible, detalle: { textos: true, bornes } };
    editor.escena.dibujar(r, info);
    return llamadas;
  }

  it("todos los cables en un solo trazo, antes que los componentes", () => {
    const { editor } = armar();
    const ll = dibujar(editor, { x: -100, y: -100, ancho: 200, alto: 200 });
    const lineas = ll.filter((l) => l.nombre === "lineas");
    expect(lineas).toHaveLength(1);
    expect(lineas[0]!.args[1]).toBe(5); // w1: 1, w2: 3, w3: 1
    expect(ll.findIndex((l) => l.nombre === "lineas")).toBeLessThan(ll.findIndex((l) => l.nombre === "simbolo" || l.nombre === "linea"));
  });

  it("en un mosaico, solo los tramos que lo tocan", () => {
    const { editor } = armar();
    // La esquina de abajo a la derecha de w2: el tramo de y = 5 y el de x = 10, no el de x = 0.
    const ll = dibujar(editor, { x: 8, y: 3, ancho: 4, alto: 4 });
    const lineas = ll.filter((l) => l.nombre === "lineas");
    expect(lineas).toHaveLength(1);
    expect(lineas[0]!.args[1]).toBe(2);
    expect((lineas[0]!.args[0] as number[]).slice(0, 8)).toEqual([0, 5, 10, 5, 10, 5, 10, 2]);
  });

  it("los extremos libres llevan un círculo, solo con los bornes a la vista", () => {
    const { editor } = armar();
    editor.seleccionarIds(["c1"]);
    editor.accion("borrar");
    const todo = { x: -100, y: -100, ancho: 200, alto: 200 };
    const marca = (l: { nombre: string; args: unknown[] }) => l.nombre === "circulo" && l.args[2] === 0.25;
    expect(dibujar(editor, todo).filter(marca)).toHaveLength(2);
    expect(dibujar(editor, todo, false).filter(marca)).toHaveLength(0);
  });
});
