import { describe, expect, it, vi } from "vitest";
import { Borrar, CambiarEtiqueta, colocar, Mover } from "../core/model/comandos";
import type { Componente } from "../core/model/documento";
import { buscarSimbolo, SIMBOLOS, validarDefinicion } from "../core/symbols";
import { unirCajas, type Caja } from "../render/camara";
import type { Colores } from "../render/capas";
import type { Renderer } from "../render/renderer";
import { cajaDibujo } from "../render/simbolo";
import type { EventoHerramienta } from "./herramientas/tipos";
import { documentoNuevo, Editor, SIMBOLO_DESCONOCIDO, type DestinoVista } from "./editor";

/** Vista falsa: anota cada región invalidada y si se pidió rehacer todo. */
class VistaFalsa implements DestinoVista {
  regiones: Caja[] = [];
  enteras = 0;
  /** Cuadros pedidos solo para la capa dinámica. */
  cuadros = 0;
  invalidarRegion(caja: Caja): void {
    this.regiones.push(caja);
  }
  invalidar(): void {
    this.cuadros++;
  }
  /** La Vista real tiene esto; el editor nunca lo tiene que llamar. */
  invalidarContenido(): void {
    this.enteras++;
  }
}

const datos = (x: number, y: number, etiqueta = "K1"): Omit<Componente, "id"> => ({
  tipo: "contactor.bobina",
  x,
  y,
  rot: 0,
  espejado: false,
  etiqueta,
  params: {},
});

/** Caja de dibujo que tendría el componente en la escena. */
function cajaDe(c: Omit<Componente, "id">): Caja {
  const def = buscarSimbolo(c.tipo)!;
  return cajaDibujo(def, { x: c.x, y: c.y, rotacion: c.rot, espejado: c.espejado }, c.etiqueta || undefined);
}

function armar(): { editor: Editor; vista: VistaFalsa } {
  const editor = new Editor(documentoNuevo());
  const vista = new VistaFalsa();
  editor.vista = vista;
  return { editor, vista };
}

describe("Editor", () => {
  it("arranca con el documento vacío", () => {
    const { editor } = armar();
    expect(editor.documento.hojas[0]!.componentes).toEqual([]);
    expect(editor.escena.cantidad).toBe(0);
    expect(editor.escena.caja).toBeNull();
  });

  it("Colocar invalida solo la caja del símbolo, y deshacer la misma caja", () => {
    const { editor, vista } = armar();
    const d = datos(3, 4);
    const cmd = colocar(editor.documento, d);
    editor.ejecutar(cmd);

    expect(vista.regiones).toEqual([cajaDe(d)]);
    expect(vista.enteras).toBe(0);
    expect(editor.escena.obtener(cmd.id)).toMatchObject({ x: 3, y: 4, etiqueta: "K1" });

    vista.regiones = [];
    editor.deshacer();
    expect(vista.regiones).toEqual([cajaDe(d)]);
    expect(vista.enteras).toBe(0);
    expect(editor.escena.obtener(cmd.id)).toBeUndefined();
    expect(editor.escena.cantidad).toBe(0);
  });

  it("rehacer vuelve a mostrar el componente con el mismo id", () => {
    const { editor, vista } = armar();
    const cmd = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(cmd);
    editor.deshacer();
    vista.regiones = [];
    editor.rehacer();
    expect(editor.escena.obtener(cmd.id)).toBeDefined();
    expect(vista.regiones).toEqual([cajaDe(datos(0, 0))]);
  });

  it("Mover invalida la caja vieja unida a la nueva", () => {
    const { editor, vista } = armar();
    const cmd = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(cmd);
    vista.regiones = [];
    editor.ejecutar(new Mover([cmd.id], 5, -2));
    expect(vista.regiones).toEqual([unirCajas(cajaDe(datos(0, 0)), cajaDe(datos(5, -2)))]);
    expect(editor.escena.obtener(cmd.id)).toMatchObject({ x: 5, y: -2 });
  });

  it("cada componente invalida su propia caja, no la unión de todos", () => {
    const { editor, vista } = armar();
    const a = colocar(editor.documento, datos(0, 0));
    const b = colocar(editor.documento, datos(500, 500));
    editor.agrupar([a, b]);
    expect(vista.regiones).toHaveLength(2);
    expect(vista.regiones).toContainEqual(cajaDe(datos(0, 0)));
    expect(vista.regiones).toContainEqual(cajaDe(datos(500, 500)));
  });

  it("Borrar lo saca de la escena y deshacer lo devuelve", () => {
    const { editor, vista } = armar();
    const cmd = colocar(editor.documento, datos(2, 2));
    editor.ejecutar(cmd);
    vista.regiones = [];
    editor.ejecutar(new Borrar([cmd.id]));
    expect(editor.escena.obtener(cmd.id)).toBeUndefined();
    expect(vista.regiones).toEqual([cajaDe(datos(2, 2))]);
    editor.deshacer();
    expect(editor.escena.obtener(cmd.id)).toMatchObject({ x: 2, y: 2 });
  });

  it("cambiar la etiqueta invalida la caja vieja unida a la nueva", () => {
    const { editor, vista } = armar();
    const cmd = colocar(editor.documento, datos(0, 0, "K1"));
    editor.ejecutar(cmd);
    vista.regiones = [];
    editor.ejecutar(new CambiarEtiqueta(cmd.id, "K1-PRINCIPAL"));
    expect(vista.regiones).toEqual([unirCajas(cajaDe(datos(0, 0, "K1")), cajaDe(datos(0, 0, "K1-PRINCIPAL")))]);
  });

  it("un comando que falla no invalida nada", () => {
    const { editor, vista } = armar();
    expect(() => editor.ejecutar(new Mover(["c99"], 1, 0))).toThrow();
    expect(vista.regiones).toEqual([]);
    expect(editor.puedeDeshacer).toBe(false);
  });

  it("sin vista conectada, la escena se mantiene al día igual", () => {
    const editor = new Editor(documentoNuevo());
    const cmd = colocar(editor.documento, datos(1, 1));
    editor.ejecutar(cmd);
    expect(editor.escena.obtener(cmd.id)).toBeDefined();
  });

  it("un tipo desconocido se dibuja como símbolo desconocido, con aviso, y no se omite", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const doc = documentoNuevo();
    doc.hojas[0]!.componentes.push(
      { ...datos(0, 0, "X1"), tipo: "inventado.x", id: "c1" },
      { ...datos(9, 0, "X2"), tipo: "inventado.x", id: "c2" },
    );
    const editor = new Editor(doc);
    expect(editor.escena.cantidad).toBe(2);
    expect(editor.escena.obtener("c1")).toMatchObject({ def: SIMBOLO_DESCONOCIDO, x: 0, y: 0, etiqueta: "X1" });
    expect([...editor.tiposDesconocidos]).toEqual(["inventado.x"]);
    expect(aviso).toHaveBeenCalledTimes(1); // uno por tipo, no por componente
    aviso.mockRestore();
  });

  it("el símbolo desconocido es válido salvo por no tener bornes, y no está en la biblioteca", () => {
    // Sin bornes a propósito: no se sabe dónde estarían. Es el único reparo.
    expect(validarDefinicion(SIMBOLO_DESCONOCIDO)).toEqual(["El símbolo no tiene bornes."]);
    expect(SIMBOLO_DESCONOCIDO.bornes).toEqual([]);
    expect(SIMBOLOS).not.toContain(SIMBOLO_DESCONOCIDO);
  });

  it("carga en la escena los componentes que ya tenía el documento", () => {
    const doc = documentoNuevo();
    doc.hojas[0]!.componentes.push({ ...datos(7, 8), id: "c1" });
    doc.hojas.push({ nombre: "Hoja 2", componentes: [{ ...datos(0, 0), id: "c2" }], cables: [] });
    const editor = new Editor(doc);
    expect(editor.escena.cantidad).toBe(1);
    expect(editor.escena.obtener("c1")).toMatchObject({ x: 7, y: 8 });
    expect(editor.escena.obtener("c2")).toBeUndefined();
  });
});

const ev = (x: number, y: number): EventoHerramienta => ({ x, y, boton: 0, botones: 0, mayus: false, ctrl: false });

/** Renderer falso: anota el nombre de cada llamada y el último estilo. */
function rendererFalso(): { r: Renderer; llamadas: string[]; estilos: unknown[] } {
  const llamadas: string[] = [];
  const estilos: unknown[] = [];
  const r = new Proxy({} as Renderer, {
    get: (_, nombre) => (...args: unknown[]) => {
      llamadas.push(String(nombre));
      if (nombre === "estilo") estilos.push(args[0]);
    },
  });
  return { r, llamadas, estilos };
}

const COLORES = { acento: "#06f" } as Colores;

describe("Editor con la herramienta Colocar", () => {
  it("la vista previa solo pide cuadros; colocar invalida solo la caja del símbolo", () => {
    const { editor, vista } = armar();
    const def = buscarSimbolo("contactor.bobina")!;
    const avisos = vi.fn();
    editor.alCambiarHerramienta = avisos;
    const h = editor.iniciarColocar(def, "clic")!;
    expect(avisos).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 30; i++) editor.aplicar(h.mover(ev(2 + i * 0.1, 3)));
    expect(vista.regiones).toEqual([]); // moverse no toca la capa estática
    expect(vista.cuadros).toBe(4); // 2, 3, 4 y 5: un cuadro por punto de grilla

    editor.aplicar(h.presionar(ev(4.9, 3.2)));
    expect(vista.regiones).toEqual([cajaDe({ ...datos(5, 3), etiqueta: "" })]);
    expect(vista.enteras).toBe(0);
    expect(editor.herramienta).toBe(h); // en modo clic sigue activa

    editor.deshacer();
    expect(vista.regiones).toHaveLength(2);
    expect(vista.regiones[1]).toEqual(vista.regiones[0]);
  });

  it("Esc termina sin cambiar el documento ni la capa estática", () => {
    const { editor, vista } = armar();
    const avisos = vi.fn();
    editor.alCambiarHerramienta = avisos;
    editor.aplicar(editor.iniciarColocar(SIMBOLOS[0]!, "clic")!.mover(ev(1, 1)));
    editor.cancelarHerramienta();
    expect(editor.herramienta).toBeNull();
    expect(avisos).toHaveBeenCalledTimes(2);
    expect(vista.regiones).toEqual([]);
    expect(editor.puedeDeshacer).toBe(false);
    expect(editor.documento.hojas[0]!.componentes).toEqual([]);
  });

  it("soltar un arrastre coloca y termina la herramienta", () => {
    const { editor } = armar();
    const h = editor.iniciarColocar(SIMBOLOS[0]!, "arrastre")!;
    editor.aplicar(h.soltar(ev(-2.2, 7.7)));
    expect(editor.herramienta).toBeNull();
    expect(editor.documento.hojas[0]!.componentes[0]).toMatchObject({ tipo: SIMBOLOS[0]!.tipo, x: -2, y: 8 });
  });

  it("sin vista no se puede colocar", () => {
    const editor = new Editor(documentoNuevo());
    expect(editor.iniciarColocar(SIMBOLOS[0]!, "clic")).toBeNull();
    expect(editor.herramienta).toBeNull();
  });

  it("la capa dinámica dibuja la vista previa con el color de acento, y nada sin herramienta", () => {
    const { editor } = armar();
    const f = rendererFalso();
    editor.dibujarDinamico(f.r, { escala: 20, colores: COLORES });
    expect(f.llamadas).toEqual([]);

    editor.aplicar(editor.iniciarColocar(SIMBOLOS[0]!, "clic")!.mover(ev(0, 0)));
    editor.dibujarDinamico(f.r, { escala: 20, colores: COLORES });
    expect(f.estilos[0]).toMatchObject({ trazo: "#06f", relleno: "#06f" });
    expect(f.llamadas).toContain("simbolo");
  });
});
