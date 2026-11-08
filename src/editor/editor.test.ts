import { describe, expect, it, vi } from "vitest";
import { Borrar, CambiarEtiqueta, colocar, Mover } from "../core/model/comandos";
import type { Componente } from "../core/model/documento";
import { buscarSimbolo, SIMBOLOS, validarDefinicion } from "../core/symbols";
import { seTocan, unirCajas, type Caja } from "../render/camara";
import type { Colores } from "../render/capas";
import type { Renderer } from "../render/renderer";
import { cajaDibujo } from "../render/simbolo";
import type { EventoHerramienta } from "./herramientas/tipos";
import {
  documentoNuevo,
  Editor,
  esCuadroDeMuestra,
  SIMBOLO_DESCONOCIDO,
  type DestinoVista,
  type ModoArrastreDiagnostico,
} from "./editor";

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

  it("Mover invalida la caja vieja y la nueva por separado", () => {
    const { editor, vista } = armar();
    const cmd = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(cmd);
    vista.regiones = [];
    editor.ejecutar(new Mover([cmd.id], 5, -2));
    expect(vista.regiones).toEqual([cajaDe(datos(0, 0)), cajaDe(datos(5, -2))]);
    expect(editor.escena.obtener(cmd.id)).toMatchObject({ x: 5, y: -2 });
  });

  it("deshacer y rehacer un movimiento largo invalidan las dos puntas, no la franja intermedia", () => {
    const { editor, vista } = armar();
    const cmd = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(cmd);
    editor.ejecutar(new Mover([cmd.id], 400, 250));
    const origen = cajaDe(datos(0, 0));
    const destino = cajaDe(datos(400, 250));
    const mitad: Caja = { x: 200, y: 125, ancho: 0, alto: 0 };

    vista.regiones = [];
    editor.deshacer();
    expect(vista.regiones).toEqual([destino, origen]);
    vista.regiones = [];
    editor.rehacer();
    expect(vista.regiones).toEqual([origen, destino]);
    // Ninguna región llega a la mitad del camino (la unión sí la tocaría).
    expect(seTocan(unirCajas(origen, destino), mitad)).toBe(true);
    for (const k of vista.regiones) expect(seTocan(k, mitad)).toBe(false);
    expect(vista.enteras).toBe(0);
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

  it("alargar la etiqueta invalida solo la caja nueva (contiene a la vieja)", () => {
    const { editor, vista } = armar();
    const cmd = colocar(editor.documento, datos(0, 0, "K1"));
    editor.ejecutar(cmd);
    vista.regiones = [];
    editor.ejecutar(new CambiarEtiqueta(cmd.id, "K1-PRINCIPAL"));
    expect(vista.regiones).toEqual([cajaDe(datos(0, 0, "K1-PRINCIPAL"))]);
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

const ev = (x: number, y: number): EventoHerramienta => ({ x, y, boton: 0, botones: 0, mayus: false, ctrl: false, escala: 20 });

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
/** `medir` de la capa dinámica: dibuja y dice que tardó 7 ms (sin sonda de verdad). */
const MEDIR = (dibujar: () => void): number => {
  dibujar();
  return 7;
};
/** Toda la grilla a la vista. */
const TODO: Caja = { x: -1e6, y: -1e6, ancho: 2e6, alto: 2e6 };

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
    editor.dibujarDinamico(f.r, { escala: 20, colores: COLORES, medir: MEDIR, visible: TODO });
    expect(f.llamadas).toEqual([]);

    editor.aplicar(editor.iniciarColocar(SIMBOLOS[0]!, "clic")!.mover(ev(0, 0)));
    editor.dibujarDinamico(f.r, { escala: 20, colores: COLORES, medir: MEDIR, visible: TODO });
    expect(f.estilos[0]).toMatchObject({ trazo: "#06f", relleno: "#06f" });
    expect(f.llamadas).toContain("simbolo");
  });
});

describe("Editor: selección", () => {
  it("seleccionar no invalida mosaicos: solo pide un cuadro y avisa", () => {
    const { editor, vista } = armar();
    const cmd = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(cmd);
    vista.regiones = [];
    vista.cuadros = 0;
    const aviso = vi.fn();
    editor.alCambiarSeleccion = aviso;

    editor.aplicar(editor.activa.presionar(ev(0, 0)));
    editor.aplicar(editor.activa.soltar(ev(0, 0)));
    expect([...editor.seleccion]).toEqual([cmd.id]);
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(vista.regiones).toEqual([]);
    expect(vista.enteras).toBe(0);
    expect(vista.cuadros).toBeGreaterThan(0);

    // Clic en vacío: deselecciona, tampoco invalida.
    editor.aplicar(editor.activa.presionar(ev(50, 50)));
    editor.aplicar(editor.activa.soltar(ev(50, 50)));
    expect(editor.seleccion.size).toBe(0);
    expect(vista.regiones).toEqual([]);
  });

  it("deshacer un Colocar saca su id de la selección; rehacer no lo vuelve a seleccionar", () => {
    const { editor } = armar();
    const a = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(a);
    const b = colocar(editor.documento, datos(10, 0, "K2"));
    editor.ejecutar(b);
    editor.seleccionarIds([a.id, b.id]);
    const aviso = vi.fn();
    editor.alCambiarSeleccion = aviso;

    editor.deshacer();
    expect([...editor.seleccion]).toEqual([a.id]);
    expect(aviso).toHaveBeenCalled();
    editor.rehacer();
    expect([...editor.seleccion]).toEqual([a.id]);
  });

  it("Borrar lo seleccionado lo saca de la selección", () => {
    const { editor } = armar();
    const a = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(a);
    editor.seleccionarIds([a.id]);
    editor.ejecutar(new Borrar([a.id]));
    expect(editor.seleccion.size).toBe(0);
  });

  it("mover algo seleccionado avisa (el panel lo muestra) y no lo deselecciona", () => {
    const { editor } = armar();
    const a = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(a);
    editor.seleccionarIds([a.id]);
    const aviso = vi.fn();
    editor.alCambiarSeleccion = aviso;
    editor.ejecutar(new Mover([a.id], 3, 0));
    expect(aviso).toHaveBeenCalledTimes(1);
    expect([...editor.seleccion]).toEqual([a.id]);
  });

  it("seleccionarIds ignora ids que no están y no avisa si no cambia nada", () => {
    const { editor } = armar();
    const a = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(a);
    const aviso = vi.fn();
    editor.alCambiarSeleccion = aviso;
    editor.seleccionarIds(["c999"]);
    expect(editor.seleccion.size).toBe(0);
    expect(aviso).not.toHaveBeenCalled();
    editor.seleccionarIds([a.id]);
    editor.seleccionarIds([a.id]);
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("el resumen da los datos con uno y la cantidad con varios", () => {
    const { editor } = armar();
    const a = colocar(editor.documento, { ...datos(0, 0), rot: 90, espejado: true });
    editor.ejecutar(a);
    const b = colocar(editor.documento, datos(10, 0, "K2"));
    editor.ejecutar(b);
    expect(editor.resumenSeleccion()).toEqual({ cantidad: 0, unico: null });
    editor.seleccionarIds([a.id]);
    expect(editor.resumenSeleccion()).toEqual({
      cantidad: 1,
      unico: { id: a.id, nombre: buscarSimbolo("contactor.bobina")!.nombre, etiqueta: "K1", rot: 90, espejado: true },
    });
    editor.seleccionarIds([a.id, b.id]);
    expect(editor.resumenSeleccion()).toEqual({ cantidad: 2, unico: null });
  });

  it("la capa dinámica resalta solo los seleccionados visibles", () => {
    const { editor } = armar();
    const a = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(a);
    const b = colocar(editor.documento, datos(500, 0, "K2"));
    editor.ejecutar(b);
    editor.seleccionarIds([a.id, b.id]);
    const f = rendererFalso();
    let dibujados = -1;
    const r = new Proxy(f.r, {
      get: (obj, nombre, recv) =>
        nombre === "rectangulos" ? (_: ArrayLike<number>, n: number) => (dibujados = n) : Reflect.get(obj, nombre, recv),
    });
    editor.dibujarDinamico(r, { escala: 20, colores: COLORES, medir: MEDIR, visible: { x: -20, y: -20, ancho: 40, alto: 40 } });
    // Un solo trazo, con un recuadro: el de 'b' está fuera de pantalla.
    expect(dibujados).toBe(1);
    expect(f.llamadas.filter((l) => l === "rectangulo")).toHaveLength(0);
    expect(f.estilos[0]).toMatchObject({ trazo: "#06f" });
  });
});

describe("Editor: mover arrastrando", () => {
  /** Un componente en (0, 0), seleccionado, con las regiones y cuadros en cero. */
  function conUno() {
    const { editor, vista } = armar();
    const cmd = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(cmd);
    editor.seleccionarIds([cmd.id]);
    vista.regiones = [];
    vista.cuadros = 0;
    return { editor, vista, id: cmd.id };
  }
  const h = (editor: Editor) => editor.activa;

  it("30 movimientos dan exactamente 1 comando y 2 invalidaciones", () => {
    const { editor, vista, id } = conUno();
    const pasos = editor.historial;
    editor.aplicar(h(editor).presionar(ev(0, 0)));
    for (let i = 1; i <= 30; i++) editor.aplicar(h(editor).mover(ev(i * 0.2, i * 0.1)));
    expect(editor.arrastrando).toBe(true);
    expect(vista.regiones).toEqual([cajaDe(datos(0, 0))]); // al empezar: sale de la capa estática
    expect(editor.escena.oculto(id)).toBe(true);
    expect(editor.puedeDeshacer).toBe(true); // el Colocar
    editor.aplicar(h(editor).soltar(ev(6, 3)));

    expect(editor.arrastrando).toBe(false);
    expect(editor.escena.oculto(id)).toBe(false);
    expect(vista.regiones).toEqual([cajaDe(datos(0, 0)), cajaDe(datos(6, 3))]);
    expect(vista.enteras).toBe(0);
    expect(editor.escena.obtener(id)).toMatchObject({ x: 6, y: 3 });
    // Un solo paso: deshacer lo devuelve, y el siguiente deshace el Colocar.
    editor.deshacer();
    expect(editor.escena.obtener(id)).toMatchObject({ x: 0, y: 0 });
    editor.deshacer();
    expect(pasos.puedeDeshacer).toBe(false);
  });

  it("moverse solo pide un cuadro al cambiar de punto de grilla", () => {
    const { editor, vista } = conUno();
    editor.aplicar(h(editor).presionar(ev(0, 0)));
    // 0,1 por paso hasta 3,0: el arrastre empieza en 0,3 (12 px > 4) y pasa por 0, 1, 2 y 3.
    for (let i = 1; i <= 30; i++) editor.aplicar(h(editor).mover(ev(i * 0.1, 0)));
    expect(vista.cuadros).toBe(4);
    expect(vista.regiones).toHaveLength(1);
  });

  it("Esc a mitad del arrastre: ningún comando, vuelve a su lugar con 2 invalidaciones", () => {
    const { editor, vista, id } = conUno();
    editor.aplicar(h(editor).presionar(ev(0, 0)));
    for (let i = 1; i <= 10; i++) editor.aplicar(h(editor).mover(ev(i, 0)));
    editor.aplicar(editor.seleccionar.cancelar());
    expect(editor.arrastrando).toBe(false);
    expect(vista.regiones).toEqual([cajaDe(datos(0, 0)), cajaDe(datos(0, 0))]);
    // El botón se suelta después: no hace nada.
    editor.aplicar(h(editor).soltar(ev(10, 0)));
    expect(editor.escena.obtener(id)).toMatchObject({ x: 0, y: 0 });
    expect(editor.documento.hojas[0]!.componentes[0]).toMatchObject({ x: 0, y: 0 });
    expect([...editor.seleccion]).toEqual([id]); // Esc en el arrastre no deselecciona
    editor.deshacer(); // lo único para deshacer es el Colocar
    expect(editor.escena.cantidad).toBe(0);
  });

  it("volver al punto de partida no da comando; cancelar la herramienta corta el arrastre", () => {
    const { editor, vista, id } = conUno();
    editor.aplicar(h(editor).presionar(ev(0, 0)));
    editor.aplicar(h(editor).mover(ev(3, 0)));
    editor.aplicar(h(editor).soltar(ev(0.2, -0.3)));
    expect(editor.escena.oculto(id)).toBe(false);
    expect(vista.regiones).toHaveLength(2);
    editor.deshacer();
    expect(editor.escena.cantidad).toBe(0); // se deshizo el Colocar: no había Mover

    const otro = conUno();
    otro.editor.aplicar(h(otro.editor).presionar(ev(0, 0)));
    otro.editor.aplicar(h(otro.editor).mover(ev(3, 0)));
    otro.editor.cancelarHerramienta(); // al desconectar el lienzo
    expect(otro.editor.arrastrando).toBe(false);
    expect(otro.editor.escena.oculto(otro.id)).toBe(false);
  });

  it("arrastra el grupo entero: un Mover con todos, cada uno con sus invalidaciones", () => {
    const { editor, vista } = armar();
    const a = colocar(editor.documento, datos(0, 0));
    const b = colocar(editor.documento, datos(300, 0, "K2"));
    editor.agrupar([a, b]);
    editor.seleccionarIds([a.id, b.id]);
    vista.regiones = [];
    editor.aplicar(h(editor).presionar(ev(0, 0)));
    editor.aplicar(h(editor).mover(ev(2.4, 4.6)));
    editor.aplicar(h(editor).soltar(ev(2.4, 4.6)));
    expect(editor.escena.obtener(a.id)).toMatchObject({ x: 2, y: 5 });
    expect(editor.escena.obtener(b.id)).toMatchObject({ x: 302, y: 5 });
    expect(vista.regiones).toHaveLength(4);
    expect(new Set(editor.seleccion)).toEqual(new Set([a.id, b.id]));
    editor.deshacer();
    expect(editor.escena.obtener(a.id)).toMatchObject({ x: 0, y: 0 });
    expect(editor.escena.obtener(b.id)).toMatchObject({ x: 300, y: 0 });
  });

  it("si algo arrastrado se borra en el medio, se mueve el resto y nada queda oculto", () => {
    const { editor } = armar();
    const a = colocar(editor.documento, datos(0, 0));
    const b = colocar(editor.documento, datos(10, 0, "K2"));
    editor.agrupar([a, b]);
    editor.seleccionarIds([a.id, b.id]);
    editor.aplicar(h(editor).presionar(ev(0, 0)));
    editor.aplicar(h(editor).mover(ev(3, 0)));
    editor.ejecutar(new Borrar([b.id]));
    editor.aplicar(h(editor).soltar(ev(3, 0)));
    expect(editor.escena.obtener(a.id)).toMatchObject({ x: 3, y: 0 });
    expect(editor.escena.oculto(a.id)).toBe(false);
    editor.deshacer(); // el Mover
    editor.deshacer(); // el Borrar
    expect(editor.escena.oculto(b.id)).toBe(false);
  });

  it("la capa dinámica dibuja lo arrastrado corrido, con su resaltado", () => {
    const { editor } = conUno();
    const f = rendererFalso();
    const pantalla = { visible: { x: 40, y: -20, ancho: 40, alto: 40 }, escala: 20, colores: COLORES, medir: MEDIR };
    editor.dibujarDinamico(f.r, pantalla);
    expect(f.llamadas).toEqual([]); // el componente está en 0, fuera de pantalla

    editor.aplicar(h(editor).presionar(ev(0, 0)));
    editor.aplicar(h(editor).mover(ev(50, 0)));
    editor.dibujarDinamico(f.r, pantalla);
    expect(f.llamadas).toContain("trasladar");
    expect(f.llamadas).toContain("rectangulos"); // el resaltado, corrido hasta la pantalla
  });
});

describe("Editor: diagnóstico del arrastre (alpha.2)", () => {
  /** Un componente arrastrándose, y lo que dibuja la capa dinámica en un cuadro con ese modo. */
  function dibujarCon(modo: ModoArrastreDiagnostico) {
    const { editor } = armar();
    const cmd = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(cmd);
    editor.seleccionarIds([cmd.id]);
    editor.diagnostico = { modo, sonda: false };
    editor.aplicar(editor.activa.presionar(ev(0, 0)));
    editor.aplicar(editor.activa.mover(ev(3, 0)));
    const f = rendererFalso();
    editor.dibujarDinamico(f.r, { escala: 20, colores: COLORES, medir: MEDIR, visible: TODO });
    return f.llamadas;
  }

  it("cada modo dibuja lo suyo", () => {
    const completos = dibujarCon("completos");
    expect(completos).toContain("texto");
    expect(completos).toContain("circulo");
    expect(dibujarCon("auto")).toEqual(completos); // 1 arrastrado: por debajo del límite

    const sinTextos = dibujarCon("sinTextos");
    expect(sinTextos).not.toContain("texto");
    expect(sinTextos).toContain("circulo");

    const sinNada = dibujarCon("sinTextosNiBornes");
    expect(sinNada).not.toContain("texto");
    expect(sinNada).not.toContain("circulo");
    expect(sinNada).toContain("simbolo");

    // Contornos: el cuerpo y el resaltado, dos rellenos de rectángulos, sin el símbolo.
    const contornos = dibujarCon("contornos");
    expect(contornos.filter((l) => l === "rectangulos")).toHaveLength(2);
    expect(contornos).not.toContain("simbolo");

    // Base: la capa dinámica vacía, ni el resaltado.
    expect(dibujarCon("nada")).toEqual([]);
  });

  it("los cuadros de muestra son los 3 primeros y después 1 cada 15", () => {
    const muestras = Array.from({ length: 50 }, (_, i) => i).filter(esCuadroDeMuestra);
    expect(muestras).toEqual([0, 1, 2, 17, 32, 47]);
  });

  it("con la sonda, mide solo los cuadros de muestra; sin la sonda, ninguno", () => {
    const { editor } = armar();
    const cmd = colocar(editor.documento, datos(0, 0));
    editor.ejecutar(cmd);
    editor.seleccionarIds([cmd.id]);
    const medidos: number[] = [];
    let cuadro = 0;
    const medir = (dibujar: () => void) => {
      medidos.push(cuadro);
      dibujar();
      return 2.5;
    };
    const info = { escala: 20, colores: COLORES, medir, visible: TODO };

    for (const sonda of [false, true]) {
      editor.diagnostico = { modo: "completos", sonda };
      medidos.length = 0;
      editor.aplicar(editor.activa.presionar(ev(0, 0)));
      editor.aplicar(editor.activa.mover(ev(3, 0)));
      for (cuadro = 0; cuadro < 20; cuadro++) editor.dibujarDinamico(rendererFalso().r, info);
      editor.aplicar(editor.seleccionar.cancelar());
      if (sonda) {
        expect(medidos).toEqual([0, 1, 2, 17]);
        expect(editor.tomarMuestras()).toEqual([2.5, 2.5, 2.5, 2.5]);
        expect(editor.tomarMuestras()).toEqual([]); // se vacía al leerlas
      } else {
        expect(medidos).toEqual([]);
        expect(editor.tomarMuestras()).toEqual([]);
      }
    }
  });
});
