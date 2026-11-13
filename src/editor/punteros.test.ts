// El despachador de teclado (punteros.ts) con los atajos del portapapeles
// (T16, E4-A): sin DOM de verdad. Vitest corre en node, así que `window`,
// `document` y `HTMLElement` son falsos y la tecla se le pasa directo al
// listener `keydown` que registra `conectarHerramientas`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { colocar } from "../core/model/comandos";
import type { Camara } from "../render/camara";
import { documentoNuevo, Editor } from "./editor";
import { conectarHerramientas } from "./punteros";
import { guardarRecorte, recorteGuardado, vaciarPortapapeles } from "./portapapeles";

/** Lo mínimo de un elemento para `esCampoEditable` y `soltarFocoDeCampo`. */
class ElementoFalso {
  isContentEditable = false;
  constructor(
    readonly tagName: string,
    readonly type = "",
  ) {}
  blur(): void {}
}

type Manejador = (e: unknown) => void;

/** Un objeto que guarda sus listeners por tipo de evento. */
function conListeners<T extends object>(base: T) {
  const manejadores = new Map<string, Manejador>();
  const obj = Object.assign(base, {
    addEventListener: (tipo: string, f: Manejador) => manejadores.set(tipo, f),
    removeEventListener: (tipo: string) => manejadores.delete(tipo),
  });
  return { obj, disparar: (tipo: string, e: unknown) => manejadores.get(tipo)!(e) };
}

/** Una tecla con Ctrl, dirigida a `target`. */
function tecla(key: string, target: unknown, mods: { ctrl?: boolean; mayus?: boolean } = { ctrl: true }) {
  return {
    key,
    code: /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : key,
    ctrlKey: mods.ctrl ?? false,
    shiftKey: mods.mayus ?? false,
    altKey: false,
    metaKey: false,
    repeat: false,
    target,
    preventDefault: vi.fn(),
  };
}

const ESCALA = 20;
const camara = { escala: ESCALA, aGrilla: (px: number, py: number) => ({ x: px / ESCALA, y: py / ESCALA }) } as unknown as Camara;

let modal = false;

function armar(atajosActivos = () => true) {
  const ventana = conListeners({});
  vi.stubGlobal("window", ventana.obj);
  const canvas = conListeners({
    parentElement: null,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 2000, bottom: 2000 }),
    setPointerCapture: () => {},
  });
  const editor = new Editor(documentoNuevo());
  editor.vista = { invalidar: () => {}, invalidarRegion: () => {} };
  const cmd = colocar(editor.documento, { tipo: "contactor.bobina", x: 0, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: {} });
  editor.ejecutar(cmd);
  editor.seleccionarIds([cmd.id]);
  const conexion = conectarHerramientas(canvas.obj as unknown as HTMLCanvasElement, { camara, editor, atajosActivos });
  const accion = vi.spyOn(editor, "accion");
  return { editor, accion, conexion, teclado: (e: unknown) => ventana.disparar("keydown", e), puntero: canvas.disparar };
}

beforeEach(() => {
  modal = false;
  vi.stubGlobal("HTMLElement", ElementoFalso);
  vi.stubGlobal("document", { activeElement: null, querySelector: () => (modal ? {} : null) });
  vaciarPortapapeles();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("despachador: atajos del portapapeles (T16)", () => {
  const atajos = ["c", "x", "v", "d"];

  it("fuera de los campos, Ctrl+C, X, V y D llegan al editor y la tecla es nuestra", () => {
    const { accion, teclado } = armar();
    const cuerpo = new ElementoFalso("DIV");
    for (const k of atajos) {
      const e = tecla(k, cuerpo);
      teclado(e);
      expect(e.preventDefault).toHaveBeenCalled();
    }
    expect(accion.mock.calls.map((c) => c[0])).toEqual(["copiar", "cortar", "pegar", "duplicar"]);
  });

  it("Ctrl+Insert, Mayús+Insert y Mayús+Supr también", () => {
    const { accion, teclado } = armar();
    const cuerpo = new ElementoFalso("DIV");
    teclado(tecla("Insert", cuerpo));
    teclado(tecla("Insert", cuerpo, { mayus: true }));
    teclado(tecla("Delete", cuerpo, { mayus: true }));
    expect(accion.mock.calls.map((c) => c[0])).toEqual(["copiar", "pegar", "cortar"]);
  });

  it.each([
    ["la etiqueta del panel", new ElementoFalso("INPUT", "text")],
    ["el buscador de la paleta", new ElementoFalso("INPUT", "search")],
  ])("con el foco en %s no actúan: el campo hace lo suyo con el texto", (_, campo) => {
    const { editor, accion, teclado } = armar();
    for (const k of atajos) {
      const e = tecla(k, campo);
      teclado(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
    for (const [k, mods] of [
      ["Insert", { ctrl: true }],
      ["Insert", { mayus: true }],
      ["Delete", { mayus: true }],
    ] as const) {
      const e = tecla(k, campo, mods);
      teclado(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
    expect(accion).not.toHaveBeenCalled();
    expect(recorteGuardado()).toBeNull();
    expect(editor.herramienta).toBeNull();
    expect(editor.documento.hojas[0]!.componentes).toHaveLength(1);
  });

  it("en modo Simular no actúan", () => {
    const { editor, accion, teclado } = armar(() => false);
    const cuerpo = new ElementoFalso("DIV");
    for (const k of atajos) teclado(tecla(k, cuerpo));
    expect(accion).not.toHaveBeenCalled();
    expect(recorteGuardado()).toBeNull();
    expect(editor.herramienta).toBeNull();
    expect(editor.documento.hojas[0]!.componentes).toHaveLength(1);
  });

  it("con un diálogo abierto no actúan", () => {
    const { accion, teclado } = armar();
    modal = true;
    for (const k of atajos) teclado(tecla(k, new ElementoFalso("DIV")));
    expect(accion).not.toHaveBeenCalled();
  });

  it("Ctrl+V con el mouse sobre el lienzo: la previa aparece ahí sin esperar a que se mueva", () => {
    const { editor, teclado, puntero } = armar();
    const cuerpo = new ElementoFalso("DIV");
    teclado(tecla("c", cuerpo));
    expect(recorteGuardado()).not.toBeNull();
    puntero("pointermove", { clientX: 200, clientY: 100, buttons: 0, button: 0, shiftKey: false, ctrlKey: false });
    teclado(tecla("v", cuerpo));
    // (200, 100) px a escala 20 → (10, 5); el centro de la bobina es (0, 0).
    expect(editor.pegando!.previa).toMatchObject({ dx: 10, dy: 5 });
  });

  it("Ctrl+V con la previa ya abierta sigue en su punto", () => {
    const { editor, teclado, puntero } = armar();
    const cuerpo = new ElementoFalso("DIV");
    teclado(tecla("c", cuerpo));
    const r = recorteGuardado()!;
    puntero("pointermove", { clientX: 200, clientY: 100, buttons: 0, button: 0, shiftKey: false, ctrlKey: false });
    teclado(tecla("v", cuerpo));
    const h = editor.pegando;
    guardarRecorte({ ...r });
    teclado(tecla("v", cuerpo));
    expect(editor.pegando).toBe(h);
    expect(h!.previa).toMatchObject({ dx: 10, dy: 5 });
  });
});
