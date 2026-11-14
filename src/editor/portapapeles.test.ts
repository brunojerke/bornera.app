// Portapapeles en el editor (T16, etapa 2): copiar, cortar, pegar y duplicar
// con `Editor.accion`, la previa de pegar y cuándo no hacen nada.

import { beforeEach, describe, expect, it } from "vitest";
import { cablear, CambiarEtiqueta, Borrar, colocar, Mover } from "../core/model/comandos";
import { validarHoja } from "../core/model/cables";
import { generarId, PREFIJO_CABLE, type Componente, type Documento, type Extremo } from "../core/model/documento";
import { problemasPegado } from "../core/model/portapapeles";
import { consultaHoja } from "../core/model/trazado";
import { buscarSimbolo } from "../core/symbols";
import type { Caja } from "../render/camara";
import type { Colores } from "../render/capas";
import type { Renderer } from "../render/renderer";
import {
  AVISO_DUPLICAR_SIN_LUGAR,
  AVISO_ESC_CABLE,
  AVISO_NADA_PARA_COPIAR,
  AVISO_NADA_PARA_CORTAR,
  AVISO_NADA_PARA_DUPLICAR,
  AVISO_NADA_PARA_PEGAR,
  AVISO_RECORTE_VACIO,
  documentoNuevo,
  Editor,
  LIMITE_ARRASTRE_COMPLETO,
  type DestinoVista,
} from "./editor";
import { HerramientaPegar, TOPE_PREVIA_PEGAR } from "./herramientas/pegar";
import type { EventoHerramienta } from "./herramientas/tipos";
import { recorteGuardado, vaciarPortapapeles } from "./portapapeles";

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

const ev = (x: number, y: number, boton = 0): EventoHerramienta => ({ x, y, boton, botones: 0, mayus: false, ctrl: false, escala: 20 });
const libre = (x: number, y: number): Extremo => ({ tipo: "libre", x, y });
const bobina = (x: number, y: number, etiqueta: string): Omit<Componente, "id"> => ({
  tipo: "contactor.bobina",
  x,
  y,
  rot: 0,
  espejado: false,
  etiqueta,
  params: {},
});

function armar() {
  const editor = new Editor(documentoNuevo());
  const vista = new VistaFalsa();
  editor.vista = vista;
  const avisos: string[] = [];
  editor.alAvisar = (t) => avisos.push(t);
  const doc = editor.documento;
  const poner = (x: number, y: number, etiqueta = "K1") => {
    const cmd = colocar(doc, bobina(x, y, etiqueta));
    editor.ejecutar(cmd);
    return cmd.id;
  };
  const tender = (desde: Extremo, hasta: Extremo, codos: [number, number][] = []) => {
    const cmd = cablear(doc, { desde, hasta, codos });
    editor.ejecutar(cmd);
    return cmd.id;
  };
  /** Pasos que se pueden deshacer. */
  const pasos = () => (editor.historial as unknown as { hechos: unknown[] }).hechos.length;
  return { editor, vista, avisos, doc, poner, tender, pasos };
}

const hoja = (doc: Documento) => doc.hojas[0]!;
const comps = (doc: Documento) => hoja(doc).componentes;
const copiaDoc = (doc: Documento) => structuredClone(doc);
const mover = (editor: Editor, x: number, y: number) => editor.aplicar(editor.activa.mover(ev(x, y)));
const clic = (editor: Editor, x: number, y: number, boton = 0) => {
  editor.aplicar(editor.activa.presionar(ev(x, y, boton)));
  editor.aplicar(editor.activa.soltar(ev(x, y, boton)));
};
/** Los tipos de conflicto de la previa, sin repetir y ordenados. */
const tipos = (editor: Editor) => [...new Set(editor.pegando!.previa!.conflictos.map((c) => c.clave.split("|")[0]!))].sort();

beforeEach(() => vaciarPortapapeles());

describe("Editor: copiar, cortar y pegar (T16)", () => {
  it("sin selección, copiar, cortar y duplicar avisan y no tocan nada", () => {
    const { editor, avisos, poner, pasos } = armar();
    poner(0, 0);
    const antes = pasos();
    expect(editor.accion("copiar")).toBe(false);
    expect(editor.accion("cortar")).toBe(false);
    expect(editor.accion("duplicar")).toBe(false);
    expect(avisos).toEqual([AVISO_NADA_PARA_COPIAR, AVISO_NADA_PARA_CORTAR, AVISO_NADA_PARA_DUPLICAR]);
    expect(recorteGuardado()).toBeNull();
    expect(pasos()).toBe(antes);
  });

  it("pegar con el portapapeles vacío avisa y no abre la previa", () => {
    const { editor, avisos } = armar();
    expect(editor.accion("pegar")).toBe(false);
    expect(avisos).toEqual([AVISO_NADA_PARA_PEGAR]);
    expect(editor.herramienta).toBeNull();
  });

  it("solo un cable sin sus dos extremos en lo elegido: avisa cómo copiarlo y no toca el portapapeles", () => {
    const { editor, avisos, poner, tender, pasos } = armar();
    const k1 = poner(0, 0, "K5");
    const w = tender({ tipo: "borne", comp: k1, borne: "A1" }, libre(0, -6));
    editor.seleccionarIds([k1]);
    editor.accion("copiar");
    const guardado = recorteGuardado();
    const antes = pasos();
    editor.seleccionarIds([w]);
    expect(editor.accion("copiar")).toBe(false);
    expect(editor.accion("cortar")).toBe(false);
    expect(avisos).toEqual([AVISO_RECORTE_VACIO, AVISO_RECORTE_VACIO]);
    expect(AVISO_RECORTE_VACIO).toBe("Para copiar un cable, seleccioná también lo que conecta en sus dos puntas.");
    expect(recorteGuardado()).toBe(guardado);
    expect(pasos()).toBe(antes);
  });

  it("copiar y pegar: la previa sigue al mouse, el clic pega en un paso y queda seleccionado lo pegado", () => {
    const { editor, doc, poner, tender, pasos } = armar();
    const k1 = poner(0, 0);
    const w = tender({ tipo: "borne", comp: k1, borne: "A1" }, libre(0, -6));
    editor.seleccionarIds([k1, w]);
    expect(editor.accion("copiar")).toBe(true);
    expect(recorteGuardado()!.componentes.map((c) => c.id)).toEqual([k1]);
    const antes = pasos();

    expect(editor.accion("pegar")).toBe(true);
    expect(editor.pegando).not.toBeNull();
    expect(editor.pegando!.previa).toBeNull(); // el mouse todavía no entró al lienzo
    // Caja del recorte: x -1..1, y -6..2 → centro (0, -2). Con el mouse en (20, 3): dx 20, dy 5.
    mover(editor, 20.2, 2.8);
    expect(editor.pegando!.previa).toMatchObject({ dx: 20, dy: 5, conflictos: [] });
    clic(editor, 20, 3);

    expect(editor.herramienta).toBeNull();
    expect(pasos()).toBe(antes + 1);
    const nuevos = [comps(doc)[1]!.id, hoja(doc).cables[1]!.id];
    expect([...editor.seleccion].sort()).toEqual(nuevos.sort());
    // K1 sigue en la hoja: la copia choca y recibe el menor libre (T17, D-duplicar C).
    expect(comps(doc)[1]).toMatchObject({ x: 20, y: 5, etiqueta: "K2" });
    expect(hoja(doc).cables[1]).toMatchObject({ desde: { tipo: "borne", comp: nuevos[0] }, hasta: { tipo: "libre", x: 20, y: -1 } });
    expect(validarHoja(hoja(doc))).toEqual([]);
  });

  it("cortar es un solo paso, deja la selección vacía, y deshacer lo devuelve todo reconectado", () => {
    const { editor, doc, poner, tender, pasos } = armar();
    const k1 = poner(0, 0);
    const k2 = poner(10, 0, "K2");
    tender({ tipo: "borne", comp: k1, borne: "A2" }, { tipo: "borne", comp: k2, borne: "A2" }, [
      [0, 4],
      [10, 4],
    ]);
    const antes = copiaDoc(doc);
    const n = pasos();
    editor.seleccionarIds([k1]);
    expect(editor.accion("cortar")).toBe(true);
    expect(pasos()).toBe(n + 1);
    expect(editor.seleccion.size).toBe(0);
    expect(comps(doc).map((c) => c.id)).toEqual([k2]);
    // El cable quedó con el extremo suelto donde estaba el borne (Borrar suelta).
    expect(hoja(doc).cables[0]!.desde).toEqual(libre(0, 2));
    expect(recorteGuardado()!.componentes.map((c) => c.id)).toEqual([k1]);

    editor.accion("deshacer");
    expect({ ...doc, contadores: {} }).toEqual({ ...antes, contadores: {} });
    expect(hoja(doc).cables[0]!.desde).toEqual({ tipo: "borne", comp: k1, borne: "A2" });
  });

  it("el portapapeles sobrevive a un Editor nuevo (Ctrl+N u Ctrl+O)", () => {
    const a = armar();
    const k1 = a.poner(0, 0, "K5");
    a.editor.seleccionarIds([k1]);
    a.editor.accion("copiar");

    const b = armar();
    expect(b.editor.accion("pegar")).toBe(true);
    mover(b.editor, 3, 3);
    clic(b.editor, 3, 3);
    expect(comps(b.doc)).toEqual([expect.objectContaining({ x: 3, y: 3, etiqueta: "K5" })]);
  });

  it("el recorte es una copia: cambiar, mover o borrar el original después de copiar no cambia lo que se pega", () => {
    const { editor, doc, poner, tender } = armar();
    const k1 = poner(0, 0);
    const w = tender({ tipo: "borne", comp: k1, borne: "A1" }, libre(0, -6));
    editor.seleccionarIds([k1, w]);
    editor.accion("copiar");
    const copiado = structuredClone(recorteGuardado());

    editor.ejecutar(new CambiarEtiqueta(k1, "K7"));
    editor.ejecutar(new Mover([k1, w], 5, 5));
    hoja(doc).componentes[0]!.params["x"] = "1"; // aunque alguien toque el objeto del documento
    editor.ejecutar(new Borrar([k1, w]));
    expect(recorteGuardado()).toEqual(copiado);

    editor.accion("pegar");
    mover(editor, 0, -2);
    clic(editor, 0, -2);
    expect(comps(doc)).toEqual([expect.objectContaining({ x: 0, y: 0, etiqueta: "K1", params: {} })]);
    expect(hoja(doc).cables[0]!.hasta).toEqual(libre(0, -6));
  });
});

describe("Editor: cuándo el portapapeles no hace nada (T16)", () => {
  it("con W activa no pasa nada; con un tramo en curso, avisa cómo cancelarlo", () => {
    const { editor, avisos, doc, poner, pasos } = armar();
    const k1 = poner(0, 0);
    editor.seleccionarIds([k1]);
    editor.accion("copiar");
    const recorte = recorteGuardado();
    editor.accion("cable");
    expect(editor.cable).not.toBeNull();
    const antes = copiaDoc(doc);
    const n = pasos();
    for (const a of ["copiar", "cortar", "pegar", "duplicar"] as const) expect(editor.accion(a)).toBe(false);
    expect(avisos).toEqual([]);

    clic(editor, 0, -2); // empieza un tramo en A1
    expect(editor.enTramo).toBe(true);
    for (const a of ["copiar", "cortar", "pegar", "duplicar"] as const) expect(editor.accion(a)).toBe(false);
    expect(avisos).toEqual(Array(4).fill(AVISO_ESC_CABLE));
    expect(editor.cable).not.toBeNull();
    expect(doc).toEqual(antes);
    expect(pasos()).toBe(n);
    expect(recorteGuardado()).toBe(recorte);
  });

  it("en medio de un arrastre de la selección no hace nada", () => {
    const { editor, doc, poner, pasos } = armar();
    const k1 = poner(0, 0);
    editor.seleccionarIds([k1]);
    editor.aplicar(editor.activa.presionar(ev(0, 0)));
    for (let i = 1; i <= 5; i++) mover(editor, i, 0);
    expect(editor.arrastrando).toBe(true);
    const n = pasos();
    for (const a of ["copiar", "cortar", "pegar", "duplicar"] as const) expect(editor.accion(a)).toBe(false);
    expect(recorteGuardado()).toBeNull();
    expect(editor.herramienta).toBeNull();
    expect(pasos()).toBe(n);
    expect(comps(doc)).toHaveLength(1);
  });

  it("con Colocar activa: copiar, cortar y duplicar no hacen nada; Ctrl+V la termina y empieza a pegar", () => {
    const { editor, poner, pasos } = armar();
    const k1 = poner(0, 0);
    editor.seleccionarIds([k1]);
    editor.accion("copiar");
    const recorte = recorteGuardado();
    editor.iniciarColocar(buscarSimbolo("contactor.bobina")!, "clic");
    const n = pasos();
    for (const a of ["copiar", "cortar", "duplicar"] as const) expect(editor.accion(a)).toBe(false);
    expect(editor.colocar).not.toBeNull();
    expect(recorteGuardado()).toBe(recorte);
    expect(pasos()).toBe(n);

    expect(editor.accion("pegar")).toBe(true);
    expect(editor.colocar).toBeNull();
    expect(editor.pegando).not.toBeNull();
    expect(editor.pegando!.recorte).toBe(recorte);
  });

  it("con la previa abierta: Ctrl+C y Ctrl+D no hacen nada; Ctrl+V reemplaza el recorte y sigue en el mismo punto", () => {
    const { editor, poner, pasos } = armar();
    const k1 = poner(0, 0);
    const k2 = poner(0, 20, "K2");
    editor.seleccionarIds([k2]);
    editor.accion("copiar");
    const delPortapapeles = recorteGuardado()!;
    // Ctrl+D de K1 choca al lado con un cable suelto: abre la previa de duplicar, con K1.
    editor.ejecutar(cablear(editor.documento, { desde: libre(4, -2), hasta: libre(4, -8), codos: [] }));
    editor.seleccionarIds([k1]);
    editor.accion("duplicar");
    const h = editor.pegando!;
    expect(h.modo).toBe("duplicar");
    expect(h.recorte).not.toBe(delPortapapeles);
    mover(editor, 50, 50);
    const n = pasos();

    expect(editor.accion("copiar")).toBe(false);
    expect(editor.accion("cortar")).toBe(false);
    expect(editor.accion("duplicar")).toBe(false);
    expect(editor.accion("rotar")).toBe(false);
    expect(editor.accion("borrar")).toBe(false);
    expect(recorteGuardado()).toBe(delPortapapeles);
    expect(editor.pegando).toBe(h);
    expect(pasos()).toBe(n);

    // Ctrl+V: el recorte del portapapeles (K2, centro en (0, 20)), centrado en el mismo punto del mouse.
    expect(editor.accion("pegar")).toBe(true);
    expect(editor.pegando).toBe(h);
    expect(h.modo).toBe("pegar");
    expect(h.recorte).toBe(delPortapapeles);
    expect(h.previa).toMatchObject({ dx: 50, dy: 30, conflictos: [] });
  });

  it("Ctrl+Z con la previa abierta deshace y la previa se revisa de nuevo", () => {
    const { editor, doc, poner } = armar();
    const k1 = poner(0, 0);
    editor.seleccionarIds([k1]);
    editor.accion("copiar");
    editor.accion("pegar");
    mover(editor, 20, 0);
    expect(editor.pegando!.previa!.conflictos).toEqual([]);
    // Algo nuevo justo donde está la previa (otra vía): la previa se revisa al reflejar.
    poner(20, 0, "K9");
    expect(tipos(editor)).toContain("cuerpoCuerpo");
    expect(editor.accion("deshacer")).toBe(true);
    expect(comps(doc)).toHaveLength(1);
    expect(editor.pegando!.previa!.conflictos).toEqual([]);
    expect(editor.pista).toBeNull();
  });
});

describe("Editor: duplicar (Ctrl+D, T16)", () => {
  it("al lado, en un paso, queda seleccionado lo pegado, y repetido arma una fila; no toca el portapapeles", () => {
    const { editor, doc, poner, pasos } = armar();
    const k1 = poner(0, 0);
    const k2 = poner(0, 30, "K2");
    editor.seleccionarIds([k2]);
    editor.accion("copiar");
    const recorte = recorteGuardado();

    editor.seleccionarIds([k1]);
    const n = pasos();
    expect(editor.accion("duplicar")).toBe(true);
    expect(pasos()).toBe(n + 1);
    expect(editor.herramienta).toBeNull();
    const d1 = comps(doc).at(-1)!;
    // Caja de la bobina: ancho 2 → dx = 2 + 2.
    // Con K1 y K2 en la hoja, la copia de K1 es K3, y la de K3, K4 (T17, D-duplicar C).
    expect(d1).toMatchObject({ x: 4, y: 0, etiqueta: "K3" });
    expect([...editor.seleccion]).toEqual([d1.id]);
    editor.accion("duplicar");
    expect(comps(doc).at(-1)).toMatchObject({ x: 8, y: 0, etiqueta: "K4" });
    expect(recorteGuardado()).toBe(recorte);
    expect(validarHoja(hoja(doc))).toEqual([]);
  });

  it("sin nada copiado, duplicar deja el portapapeles vacío", () => {
    const { editor, poner } = armar();
    editor.seleccionarIds([poner(0, 0)]);
    editor.accion("duplicar");
    expect(recorteGuardado()).toBeNull();
  });

  it("si choca al lado, pasa a la previa flotante (D5-C): Esc no deja paso; el clic en un lugar libre pega", () => {
    const { editor, doc, avisos, poner, tender, pasos } = armar();
    const k1 = poner(0, 0);
    tender(libre(4, -2), libre(4, -8)); // extremo suelto donde caería A1 de la copia
    editor.seleccionarIds([k1]);
    const n = pasos();
    expect(editor.accion("duplicar")).toBe(true);
    expect(avisos).toEqual([AVISO_DUPLICAR_SIN_LUGAR]);
    expect(pasos()).toBe(n);
    expect(editor.pegando!.previa).toMatchObject({ dx: 4, dy: 0 });
    expect(tipos(editor)).toEqual(["borneSuelto"]);

    editor.escape();
    expect(editor.herramienta).toBeNull();
    expect(pasos()).toBe(n);

    editor.accion("duplicar");
    // El primer punto del mouse es la referencia: la previa no salta.
    mover(editor, 50, 50);
    expect(editor.pegando!.previa).toMatchObject({ dx: 4, dy: 0 });
    mover(editor, 50, 60);
    expect(editor.pegando!.previa).toMatchObject({ dx: 4, dy: 10, conflictos: [] });
    clic(editor, 50, 60);
    expect(pasos()).toBe(n + 1);
    const nuevo = comps(doc).at(-1)!;
    expect(nuevo).toMatchObject({ x: 4, y: 10 });
    expect([...editor.seleccion]).toEqual([nuevo.id]);
    expect(editor.herramienta).toBeNull();
  });
});

describe("Editor: conflictos del ajuste 2 con Ctrl+V y Ctrl+D (T16)", () => {
  /** K1 en (0, 0) y un cable existente; la copia de K1 va a (4, 0): A1 en (4, -2). */
  const casos = [
    { nombre: "un cable existente que pasa sobre un borne pegado", cable: [libre(2, -2), libre(6, -2)] as const, tipo: "borne" },
    { nombre: "un extremo suelto existente bajo un borne pegado", cable: [libre(4, -2), libre(4, -8)] as const, tipo: "borneSuelto" },
  ];

  for (const caso of casos) {
    it(`Ctrl+V: ${caso.nombre} → la previa en aviso no se suelta`, () => {
      const { editor, doc, avisos, poner, tender, pasos } = armar();
      const k1 = poner(0, 0);
      tender(caso.cable[0], caso.cable[1]);
      editor.seleccionarIds([k1]);
      editor.accion("copiar");
      editor.accion("pegar");
      mover(editor, 4, 0);
      expect(tipos(editor)).toEqual([caso.tipo]);
      expect(editor.pista).toMatch(/^No se puede pegar acá: /);
      const antes = copiaDoc(doc);
      const n = pasos();
      clic(editor, 4, 0);
      expect(pasos()).toBe(n);
      expect(doc).toEqual(antes);
      expect(avisos.at(-1)).toMatch(/^No se puede pegar acá: /);
      expect(editor.pegando).not.toBeNull(); // sigue abierta para correrla
    });

    it(`Ctrl+D: ${caso.nombre} → pasa a la previa flotante`, () => {
      const { editor, avisos, poner, tender, pasos } = armar();
      const k1 = poner(0, 0);
      tender(caso.cable[0], caso.cable[1]);
      editor.seleccionarIds([k1]);
      const n = pasos();
      editor.accion("duplicar");
      expect(pasos()).toBe(n);
      expect(avisos).toEqual([AVISO_DUPLICAR_SIN_LUGAR]);
      expect(editor.pegando!.modo).toBe("duplicar");
      expect(tipos(editor)).toEqual([caso.tipo]);
    });
  }
});

describe("Editor: la previa de pegar (T16)", () => {
  /** Renderer que solo cuenta llamadas. */
  const renderer = () => new Proxy({} as Renderer, { get: () => () => undefined });
  const info = { escala: 20, colores: { acento: "#06f", aviso: "#f60" } as Colores, medir: (d: () => void) => (d(), 0), visible: { x: -1e6, y: -1e6, ancho: 2e6, alto: 2e6 } };

  it("moverla no invalida mosaicos: solo pide un cuadro por punto de grilla nuevo", () => {
    const { editor, vista, poner, tender } = armar();
    const k1 = poner(0, 0);
    tender({ tipo: "borne", comp: k1, borne: "A1" }, libre(0, -6));
    editor.seleccionarIds([k1]);
    editor.accion("copiar");
    vista.regiones = [];
    vista.cuadros = 0;

    editor.accion("pegar");
    const puntos = [
      [10, 10],
      [10.3, 10.2], // mismo punto de grilla
      [11, 10],
      [12, 10],
      [12.4, 9.6], // mismo
      [30, 30],
    ];
    for (const [x, y] of puntos) {
      mover(editor, x!, y!);
      editor.dibujarDinamico(renderer(), info);
    }
    expect(vista.regiones).toEqual([]);
    expect(vista.cuadros).toBe(4);
    editor.aplicar(editor.activa.salir());
    expect(vista.cuadros).toBe(5);
    expect(vista.regiones).toEqual([]);
  });

  it("Esc y el botón derecho la cancelan sin paso ni cambio en el documento", () => {
    const { editor, doc, poner, pasos } = armar();
    editor.seleccionarIds([poner(0, 0)]);
    editor.accion("copiar");
    const antes = copiaDoc(doc);
    const n = pasos();

    editor.accion("pegar");
    mover(editor, 20, 0);
    editor.escape();
    expect(editor.herramienta).toBeNull();

    editor.accion("pegar");
    mover(editor, 20, 0);
    editor.aplicar(editor.activa.presionar(ev(20, 0, 2)));
    expect(editor.herramienta).toBeNull();

    expect(pasos()).toBe(n);
    expect(doc).toEqual(antes);
  });

  it("al clic revisa siempre de nuevo, con la consulta y los contadores de ese momento (ajuste 1, modo reducido)", () => {
    const { editor, doc, avisos, poner, pasos } = armar();
    // TOPE + 1 bobinas en fila: la previa no se revisa en cada punto.
    const ids = Array.from({ length: TOPE_PREVIA_PEGAR + 1 }, (_, i) => poner(4 * i, 0, `K${i + 1}`));
    editor.seleccionarIds(ids);
    editor.accion("copiar");
    const recorte = recorteGuardado()!;
    editor.accion("pegar");
    const h = editor.pegando!;
    expect(h.reducido).toBe(true);
    // Centro de la caja: x (-1 + 4·TOPE + 1) / 2 = 2·TOPE, y 0. Mouse en (2·TOPE, 20): dx 0, dy 20.
    const cx = 2 * TOPE_PREVIA_PEGAR;
    mover(editor, cx, 20);
    expect(h.previa).toMatchObject({ dx: 0, dy: 20, conflictos: [] });
    expect(editor.pista).toMatch(/recién al soltar/);

    // Otra vía: una bobina donde cae la primera copia (sube los contadores). La previa no lo ve.
    poner(0, 20, "K99");
    expect(h.previa!.conflictos).toEqual([]);
    const n = pasos();
    const esperados = problemasPegado(recorte, 0, 20, consultaHoja(hoja(doc)), doc.contadores);
    expect(esperados.length).toBeGreaterThan(0);
    clic(editor, cx, 20);
    expect(pasos()).toBe(n);
    expect(avisos.at(-1)).toMatch(/^No se puede pegar acá: /);
    expect(h.previa!.conflictos.map(({ clave, x, y }) => ({ clave, x, y }))).toEqual(esperados.map(({ clave, x, y }) => ({ clave, x, y })));

    // Ctrl+Z quita la bobina; los contadores no bajan: las ids de lo pegado son las de ahora.
    editor.accion("deshacer");
    expect(h.previa!.conflictos).toEqual([]);
    const previstas = { contadores: { ...doc.contadores } };
    const ids0 = recorte.componentes.map(() => generarId(previstas));
    expect(problemasPegado(recorte, 0, 20, consultaHoja(hoja(doc)), doc.contadores)).toEqual([]);
    clic(editor, cx, 20);
    expect(pasos()).toBe(n);
    expect(editor.herramienta).toBeNull();
    const pegados = comps(doc).slice(TOPE_PREVIA_PEGAR + 1).map((c) => c.id);
    expect(pegados).toEqual(ids0);
    expect(pegados[0]).toBe(`c${TOPE_PREVIA_PEGAR + 3}`); // c(TOPE + 2) lo gastó la bobina deshecha
    expect([...editor.seleccion].sort()).toEqual([...pegados].sort());
    expect(validarHoja(hoja(doc))).toEqual([]);
  });

  it("los cables pegados también salen de los contadores de ese momento", () => {
    const { editor, doc, poner, tender } = armar();
    const k1 = poner(0, 0);
    const w = tender({ tipo: "borne", comp: k1, borne: "A1" }, libre(0, -6));
    editor.seleccionarIds([k1, w]);
    editor.accion("copiar");
    editor.accion("pegar");
    mover(editor, 20, 0);
    const previstas = { contadores: { ...doc.contadores } };
    const esperadas = [generarId(previstas), generarId(previstas, PREFIJO_CABLE)];
    clic(editor, 20, 0);
    expect([...editor.seleccion].sort()).toEqual(esperadas.sort());
  });

  it(`con más de ${LIMITE_ARRASTRE_COMPLETO} componentes a la vista dibuja solo los contornos, en un solo relleno`, () => {
    /** Renderer que anota el nombre de cada llamada. */
    const anotador = () => {
      const llamadas: string[] = [];
      const r = new Proxy({} as Renderer, { get: (_, nombre) => () => void llamadas.push(String(nombre)) });
      return { r, llamadas };
    };
    const dibujar = (cantidad: number) => {
      vaciarPortapapeles();
      const { editor, poner } = armar();
      editor.seleccionarIds(Array.from({ length: cantidad }, (_, i) => poner(4 * i, 0, `K${i + 1}`)));
      editor.accion("copiar");
      editor.seleccionarIds([]); // sin el resaltado de la selección (también usa rectangulos)
      editor.accion("pegar");
      mover(editor, 0, 50);
      const f = anotador();
      editor.dibujarDinamico(f.r, info);
      return f.llamadas;
    };
    const completos = dibujar(LIMITE_ARRASTRE_COMPLETO);
    expect(completos.filter((l) => l === "simbolo")).toHaveLength(LIMITE_ARRASTRE_COMPLETO);
    expect(completos).not.toContain("rectangulos");
    const contornos = dibujar(LIMITE_ARRASTRE_COMPLETO + 1);
    expect(contornos).not.toContain("simbolo");
    expect(contornos.filter((l) => l === "rectangulos")).toHaveLength(1);
  });

  it("es una HerramientaPegar en modo pegar, y R, M y Supr no hacen nada", () => {
    const { editor, doc, poner } = armar();
    editor.seleccionarIds([poner(0, 0)]);
    editor.accion("copiar");
    editor.accion("pegar");
    mover(editor, 20, 0);
    expect(editor.herramienta).toBeInstanceOf(HerramientaPegar);
    const antes = copiaDoc(doc);
    expect(editor.accion("rotar")).toBe(false);
    expect(editor.accion("espejar")).toBe(false);
    expect(editor.accion("borrar")).toBe(false);
    expect(doc).toEqual(antes);
    expect(editor.pegando!.previa).toMatchObject({ dx: 20, dy: 0 });
  });
});
