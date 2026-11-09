// Herramienta cable (W, T13) sobre el Editor real: secuencias de eventos →
// un `Cablear`, cancelación, deshacer con tramo, casos inválidos, conexiones
// engañosas, varios cables en un borne, puente y coherencia con las otras
// herramientas.

import { describe, expect, it } from "vitest";
import { nodoExtremo, validarHoja } from "../../core/model/cables";
import { cablear, colocar, type DatosCable } from "../../core/model/comandos";
import type { Cable, Componente, Documento } from "../../core/model/documento";
import { consultaHoja, MENSAJE_SIN_SALIDAS } from "../../core/model/trazado";
import type { Caja } from "../../render/camara";
import { cajasCable } from "../../render/escenaEditable";
import { documentoBancoCables } from "../banco";
import { BornesConCable, claveBorne } from "../bornesConCable";
import { documentoNuevo, Editor, type DestinoVista } from "../editor";
import { MENSAJE_MISMO_BORNE, MENSAJE_SIN_LARGO, mensajeTramo, radioBorne, SALIDA_TOQUE_PROPIO } from "./cable";
import type { EventoHerramienta } from "./tipos";

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

function ev(x: number, y: number, extra: Partial<EventoHerramienta> = {}): EventoHerramienta {
  return { x, y, boton: 0, botones: 0, mayus: false, ctrl: false, escala: ESCALA, ...extra };
}

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const bobina = (x: number, y: number, etiqueta: string, rot: 0 | 90 | 180 | 270 = 0): Omit<Componente, "id"> => ({
  tipo: "contactor.bobina",
  x,
  y,
  rot,
  espejado: false,
  etiqueta,
  params: {},
});

/**
 * c1 K1 en (0, 0): A1 (0, −2) arriba, A2 (0, 2) abajo; cuerpo x −1…1, y −2…2.
 * c2 K2 en (−6, −10): A2 (−6, −8) abajo. c3 K3 en (0, −8): A2 (0, −6) abajo.
 * c4 K4 girada 90° en (25, −4): A2 (23, −4) a la izquierda.
 */
function armar(conCables: DatosCable[] = []) {
  const editor = new Editor(documentoNuevo());
  const vista = new VistaFalsa();
  editor.vista = vista;
  const avisos: string[] = [];
  editor.alAvisar = (t) => avisos.push(t);
  let historial = 0;
  editor.alCambiarHistorial = () => historial++;
  const doc = editor.documento;
  for (const c of [bobina(0, 0, "K1"), bobina(-6, -10, "K2"), bobina(0, -8, "K3"), bobina(25, -4, "K4", 90)]) {
    editor.ejecutar(colocar(doc, c));
  }
  for (const d of conCables) editor.ejecutar(cablear(doc, d));
  const pasos = () => {
    // Cuántos pasos hay para deshacer, sin tocar nada: se cuentan en una copia.
    let n = 0;
    const h = editor.historial as unknown as { hechos: unknown[] };
    n = h.hechos.length;
    return n;
  };
  return { editor, vista, avisos, doc, pasos, historial: () => historial };
}

/** Clic (apretar y soltar en el mismo lugar) con la herramienta activa. */
function clic(editor: Editor, x: number, y: number): void {
  editor.aplicar(editor.activa.presionar(ev(x, y)));
  editor.aplicar(editor.activa.soltar(ev(x, y)));
}

function mover(editor: Editor, x: number, y: number): void {
  editor.aplicar(editor.activa.mover(ev(x, y)));
}

function cables(doc: Documento): Cable[] {
  return doc.hojas[0]!.cables;
}

function ultimo(doc: Documento): Cable {
  return cables(doc).at(-1)!;
}

const libre = (x: number, y: number) => ({ tipo: "libre", x, y }) as const;

describe("herramienta cable: conectar bornes", () => {
  it("borne → borne alineados: un cable sin codos, un paso", () => {
    const { editor, doc, pasos } = armar();
    expect(editor.accion("cable")).toBe(true);
    const n = pasos();
    clic(editor, 0, -2);
    clic(editor, 0, -6);
    expect(pasos()).toBe(n + 1);
    expect(ultimo(doc)).toEqual({
      id: "w1",
      desde: { tipo: "borne", comp: "c1", borne: "A1" },
      hasta: { tipo: "borne", comp: "c3", borne: "A2" },
      codos: [],
    });
    expect(editor.cable).not.toBeNull(); // sigue activa
    expect(editor.cable!.enTramo).toBe(false);
  });

  it("con un codo: llega por el costado al borne girado, desde afuera", () => {
    const { editor, doc } = armar();
    editor.accion("cable");
    clic(editor, 0, -2);
    clic(editor, 23, -4);
    expect(ultimo(doc)).toMatchObject({ hasta: { tipo: "borne", comp: "c4", borne: "A2" }, codos: [[0, -4]] });
  });

  it("con dos codos: Z por la mitad, y entra a A2 desde abajo", () => {
    const { editor, doc } = armar();
    editor.accion("cable");
    clic(editor, 0, -2);
    clic(editor, -6, -8);
    expect(ultimo(doc)).toMatchObject({ hasta: { tipo: "borne", comp: "c2", borne: "A2" }, codos: [[0, -5], [-6, -5]] });
  });

  it("los clics en vacío fijan codos, y el borne final termina", () => {
    const { editor, doc } = armar();
    editor.accion("cable");
    clic(editor, 0, -2);
    clic(editor, -3, -4); // sube y dobla a la izquierda
    expect(editor.cable!.fijados).toEqual([
      [0, -4],
      [-3, -4],
    ]);
    clic(editor, 0, -6);
    const w = ultimo(doc);
    expect(w.hasta).toEqual({ tipo: "borne", comp: "c3", borne: "A2" });
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  });

  it("arrastrar de un borne a otro crea el cable en un solo gesto", () => {
    const { editor, doc } = armar();
    editor.accion("cable");
    editor.aplicar(editor.activa.presionar(ev(0, -2)));
    mover(editor, 0, -4);
    editor.aplicar(editor.activa.soltar(ev(0, -6)));
    expect(ultimo(doc)).toMatchObject({ desde: { comp: "c1", borne: "A1" }, hasta: { comp: "c3", borne: "A2" } });
  });

  it("soltar fuera del lienzo no fija nada", () => {
    const { editor, doc } = armar();
    editor.accion("cable");
    editor.aplicar(editor.activa.presionar(ev(0, -2)));
    editor.aplicar(editor.activa.soltar(ev(0, -6, { fuera: true })));
    expect(cables(doc)).toHaveLength(0);
    expect(editor.cable!.enTramo).toBe(true);
  });

  it("el radio para agarrar un borne crece al alejar, entre 0,5 y 0,9", () => {
    expect(radioBorne(40)).toBe(0.5);
    expect(radioBorne(10)).toBeCloseTo(0.8);
    expect(radioBorne(2)).toBe(0.9);
    const { editor } = armar();
    const h = editor.iniciarCable()!;
    expect(h.objetivoEn(0.4, -2.4, ESCALA)).toMatchObject({ tipo: "borne", x: 0, y: -2 });
    expect(h.objetivoEn(0.7, -2, ESCALA).tipo).toBe("vacio");
    expect(h.objetivoEn(0.7, -2, 10).tipo).toBe("borne");
  });
});

describe("herramienta cable: T y extremos libres", () => {
  const w1: DatosCable = { desde: libre(10, 0), hasta: libre(20, 0), codos: [] };

  it("terminar sobre un cable crea una T en el punto entero", () => {
    const { editor, doc } = armar([w1]);
    editor.accion("cable");
    clic(editor, 0, 2);
    clic(editor, 15.2, 0.3);
    expect(ultimo(doc)).toMatchObject({
      desde: { tipo: "borne", comp: "c1", borne: "A2" },
      hasta: { tipo: "cable", cable: "w1", x: 15, y: 0 },
    });
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  });

  it("empezar en una T y terminar libre con otro clic en el mismo punto", () => {
    const { editor, doc } = armar([w1]);
    editor.accion("cable");
    clic(editor, 12, 0);
    clic(editor, 12, 5);
    expect(cables(doc)).toHaveLength(1);
    clic(editor, 12, 5);
    expect(ultimo(doc)).toEqual({ id: "w2", desde: { tipo: "cable", cable: "w1", x: 12, y: 0 }, hasta: libre(12, 5), codos: [] });
  });

  it("libre → libre con un codo", () => {
    const { editor, doc } = armar();
    editor.accion("cable");
    clic(editor, 30, 0);
    clic(editor, 34, 3);
    clic(editor, 34, 3);
    expect(ultimo(doc)).toMatchObject({ desde: libre(30, 0), hasta: libre(34, 3), codos: [[34, 0]] });
  });

  it("un cruce simple no conecta: los dos cables siguen sin T", () => {
    const { editor, doc } = armar([w1]);
    editor.accion("cable");
    clic(editor, 15, -3);
    clic(editor, 15, 3);
    clic(editor, 15, 3);
    const w = ultimo(doc);
    expect(w).toMatchObject({ desde: libre(15, -3), hasta: libre(15, 3), codos: [] });
    expect(nodoExtremo(w.desde)).toBeNull();
    expect(nodoExtremo(w.hasta)).toBeNull();
    expect(cables(doc)[0]).toMatchObject({ desde: libre(10, 0), hasta: libre(20, 0) });
  });

  it("el extremo suelto de otro cable no es objetivo: avisa y no empieza", () => {
    const { editor, avisos } = armar([w1]);
    editor.accion("cable");
    mover(editor, 20, 0);
    expect(editor.cable!.dibujo?.objetivo?.tipo).toBe("bloqueado");
    clic(editor, 20, 0);
    expect(editor.cable!.enTramo).toBe(false);
    expect(avisos.at(-1)).toBe("Ese extremo está suelto: todavía no se puede conectar a él.");
  });
});

describe("herramienta cable: cancelar y deshacer", () => {
  it("Esc con tramo cancela sin cambiar el documento ni gastar ids; sin tramo, sale", () => {
    const { editor, doc, pasos } = armar();
    editor.accion("cable");
    const antes = copia(doc);
    const n = pasos();
    clic(editor, 0, -2);
    clic(editor, 4, -4);
    editor.escape();
    expect(editor.cable).not.toBeNull();
    expect(editor.cable!.enTramo).toBe(false);
    expect(doc).toEqual(antes); // contadores incluidos
    expect(pasos()).toBe(n);
    editor.escape();
    expect(editor.herramienta).toBeNull();
  });

  it("el botón derecho hace lo mismo que Esc", () => {
    const { editor } = armar();
    editor.accion("cable");
    clic(editor, 0, -2);
    editor.aplicar(editor.activa.presionar(ev(3, -3, { boton: 2 })));
    expect(editor.cable!.enTramo).toBe(false);
    editor.aplicar(editor.activa.presionar(ev(3, -3, { boton: 2 })));
    expect(editor.herramienta).toBeNull();
  });

  it("Ctrl+Z con tramo quita el último codo y después cancela; nunca toca el historial", () => {
    const { editor, doc, pasos } = armar();
    editor.accion("cable");
    const n = pasos();
    clic(editor, 0, -2);
    clic(editor, -3, -4);
    clic(editor, -3, -7);
    expect(editor.cable!.fijados).toHaveLength(3);
    expect(editor.accion("deshacer")).toBe(true);
    expect(editor.cable!.fijados).toEqual([
      [0, -4],
      [-3, -4],
    ]);
    expect(editor.accion("borrarAtras")).toBe(true); // Retroceso: lo mismo
    expect(editor.cable!.fijados).toEqual([]);
    expect(editor.cable!.enTramo).toBe(true);
    expect(editor.accion("deshacer")).toBe(true);
    expect(editor.cable!.enTramo).toBe(false);
    expect(pasos()).toBe(n);
    expect(cables(doc)).toHaveLength(0);
    // Sin tramo, Ctrl+Z deshace lo último del documento (el último Colocar).
    expect(editor.accion("deshacer")).toBe(true);
    expect(pasos()).toBe(n - 1);
  });

  it("un cable terminado se deshace en un paso; Ctrl+Y con tramo no hace nada", () => {
    const { editor, doc } = armar();
    editor.accion("cable");
    clic(editor, 0, -2);
    clic(editor, 0, -6);
    clic(editor, 30, 0); // empieza otro
    expect(editor.accion("rehacer")).toBe(false);
    editor.escape();
    expect(editor.accion("deshacer")).toBe(true);
    expect(cables(doc)).toHaveLength(0);
    expect(editor.accion("rehacer")).toBe(true);
    expect(cables(doc)).toHaveLength(1);
  });

  it("el botón Deshacer está activo con un tramo aunque el historial esté vacío", () => {
    const editor = new Editor(documentoNuevo());
    editor.vista = new VistaFalsa();
    let avisos = 0;
    editor.alCambiarHistorial = () => avisos++;
    editor.accion("cable");
    expect(editor.puedeDeshacer).toBe(false);
    clic(editor, 3, 3);
    expect(editor.puedeDeshacer).toBe(true);
    expect(editor.puedeRehacer).toBe(false);
    expect(avisos).toBe(1); // avisó al empezar el tramo
    expect(editor.accion("deshacer")).toBe(true); // la misma acción que Ctrl+Z
    expect(editor.puedeDeshacer).toBe(false);
    expect(avisos).toBe(2);
  });

  it("si el documento cambia por otra vía durante un tramo, el tramo se cancela", () => {
    const { editor, doc, avisos } = armar();
    editor.accion("cable");
    clic(editor, 0, -2);
    editor.ejecutar(colocar(doc, bobina(40, 0, "K9")));
    mover(editor, 2, -5);
    expect(editor.cable!.enTramo).toBe(false);
    expect(avisos.at(-1)).toBe("El documento cambió: se canceló el cable en curso.");
  });
});

describe("herramienta cable: casos inválidos (la previa y el clic dan lo mismo)", () => {
  /** Mueve a (x, y), toma el problema de la previa, hace clic y devuelve los dos y si se creó algo. */
  function probar(editor: Editor, doc: Documento, avisos: string[], x: number, y: number) {
    mover(editor, x, y);
    const d = editor.cable!.dibujo!;
    const n = cables(doc).length;
    const fijados = editor.cable!.fijados.length;
    clic(editor, x, y);
    return {
      valido: d.valido,
      previa: d.conflictos[0]?.mensaje,
      clic: avisos.at(-1),
      creo: cables(doc).length !== n,
      fijo: editor.cable!.fijados.length !== fijados,
    };
  }

  it("terminar en el mismo borne", () => {
    const { editor, doc, avisos } = armar();
    editor.accion("cable");
    clic(editor, 0, -2);
    expect(probar(editor, doc, avisos, 0, -2)).toEqual({ valido: false, previa: MENSAJE_MISMO_BORNE, clic: MENSAJE_MISMO_BORNE, creo: false, fijo: false });
    clic(editor, 0, -5);
    clic(editor, 3, -5);
    expect(probar(editor, doc, avisos, 0, -2)).toMatchObject({ valido: false, previa: MENSAJE_MISMO_BORNE, clic: MENSAJE_MISMO_BORNE, creo: false });
  });

  it("largo cero", () => {
    const { editor, doc, avisos } = armar();
    editor.accion("cable");
    clic(editor, 30, 0);
    expect(probar(editor, doc, avisos, 30, 0)).toEqual({ valido: false, previa: MENSAJE_SIN_LARGO, clic: MENSAJE_SIN_LARGO, creo: false, fijo: false });
  });

  it("atravesar una bobina se bloquea", () => {
    const { editor, doc, avisos } = armar();
    editor.accion("cable");
    clic(editor, -5, 0);
    const r = probar(editor, doc, avisos, 5, 0);
    expect(r).toMatchObject({ valido: false, previa: "El cable atravesaría el cuerpo de K1.", creo: false, fijo: false });
    expect(r.clic).toBe(r.previa);
  });

  it("pasar sobre un borne sin conectar se bloquea", () => {
    const { editor, doc, avisos } = armar();
    editor.accion("cable");
    clic(editor, -5, -2);
    const r = probar(editor, doc, avisos, 5, -2);
    expect(r).toMatchObject({ valido: false, previa: "El cable pasaría sobre el borne K1 · A1 sin conectarse.", creo: false, fijo: false });
    expect(r.clic).toBe(r.previa);
  });

  it("volver sobre el último tramo no da vuelta de 180°: rodea en U", () => {
    const { editor, doc } = armar();
    editor.accion("cable");
    clic(editor, 30, 0);
    clic(editor, 35, 0);
    clic(editor, 28, 0);
    clic(editor, 28, 0);
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
    expect(ultimo(doc).codos).toEqual([
      [35, 0],
      [35, -1],
      [28, -1],
    ]);
  });

  it("la U que termina sobre su propio primer tramo se toca consigo misma y se bloquea", () => {
    const { editor, doc, avisos } = armar();
    editor.accion("cable");
    clic(editor, 30, 0);
    clic(editor, 35, 0);
    // Con el tramo en curso, la barra ya dice por qué y cómo salir; la ✕ lleva el motivo del núcleo.
    mover(editor, 32, 0);
    const conSalida = `El cable se tocaría consigo mismo: ${SALIDA_TOQUE_PROPIO}`;
    expect(editor.cable!.pista).toBe(conSalida);
    const r = probar(editor, doc, avisos, 32, 0);
    expect(r).toMatchObject({ valido: false, previa: "El cable se tocaría consigo mismo.", creo: false, fijo: false });
    expect(r.clic).toBe(conSalida);
  });

  it("la que se cruzaría consigo misma: la barra y el aviso dicen cómo salir", () => {
    const { editor, doc, avisos } = armar();
    editor.accion("cable");
    for (const [x, y] of [[30, 0], [35, 0], [35, 5], [33, 5]] as const) clic(editor, x, y);
    mover(editor, 33, -3);
    const conSalida = `El cable se cruzaría consigo mismo: ${SALIDA_TOQUE_PROPIO}`;
    expect(editor.cable!.pista).toBe(conSalida);
    const r = probar(editor, doc, avisos, 33, -3);
    expect(r).toMatchObject({ valido: false, previa: "El cable se cruzaría consigo mismo.", clic: conSalida, creo: false, fijo: false });
    // Retroceso (lo que dice el aviso) quita el último codo: queda el tramo hasta (35, 5).
    expect(editor.accion("borrarAtras")).toBe(true);
    expect(editor.cable!.fijados.at(-1)).toEqual([35, 5]);
  });

  it("mensajeTramo: solo los toques propios llevan cómo salir; el texto del núcleo no cambia", () => {
    for (const v of ["tocaría", "cruzaría", "encimaría"]) {
      expect(mensajeTramo({ mensaje: `El cable se ${v} consigo mismo.`, x: 0, y: 0, clave: "mismo|cable:|cable:" })).toBe(
        `El cable se ${v} consigo mismo: fijá el codo en otro lado, o quitá el último con Retroceso (Esc cancela el cable).`,
      );
    }
    const otro = { mensaje: "El cable se encimaría con otro cable.", x: 0, y: 0, clave: "encimado|cable:|cable:w1" };
    expect(mensajeTramo(otro)).toBe(otro.mensaje);
  });

  it("ningún cable creado por la herramienta es inválido", () => {
    const { editor, doc } = armar([{ desde: libre(10, 0), hasta: libre(20, 0), codos: [] }]);
    editor.accion("cable");
    // Muchos clics al azar (con semilla): lo que se crea siempre es válido.
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 30 - 15;
    // Cada 8 clics, Esc: un cable en curso que ya no puede seguir sin tocarse a sí mismo no traba la prueba.
    for (let i = 0; i < 400; i++) {
      clic(editor, rnd(), rnd());
      if (i % 8 === 7 && editor.cable!.enTramo) editor.escape();
    }
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
    expect(cables(doc).length).toBeGreaterThan(1);
  });
});

describe("herramienta cable: varios cables en un borne", () => {
  it("el segundo y el tercero salen de costado; el cuarto avisa; derivar con una T funciona", () => {
    const { editor, doc, avisos } = armar();
    editor.accion("cable");
    // 1: A1 hacia arriba.
    clic(editor, 0, -2);
    clic(editor, -0, -4); // en vacío: un codo
    clic(editor, 0, -4); // otra vez: termina libre
    expect(ultimo(doc)).toMatchObject({ desde: { borne: "A1" }, hasta: libre(0, -4), codos: [] });
    // 2: no puede subir (se encimaría con el 1): sale a la derecha por el borde de la caja.
    clic(editor, 0, -2);
    clic(editor, 4, -5);
    clic(editor, 4, -5);
    expect(ultimo(doc)).toMatchObject({ hasta: libre(4, -5), codos: [[4, -2]] });
    // 3: por el otro costado.
    clic(editor, 0, -2);
    clic(editor, -4, -5);
    clic(editor, -4, -5);
    expect(ultimo(doc)).toMatchObject({ hasta: libre(-4, -5), codos: [[-4, -2]] });
    // 4: el borne ya no tiene salidas.
    mover(editor, 0, -2);
    expect(editor.pista).toBe(MENSAJE_SIN_SALIDAS);
    clic(editor, 0, -2);
    expect(avisos.at(-1)).toBe(MENSAJE_SIN_SALIDAS);
    expect(editor.cable!.enTramo).toBe(false);
    // Derivar con una T sobre el primero.
    clic(editor, 0, -3);
    clic(editor, 2, -3);
    clic(editor, 2, -3);
    expect(ultimo(doc)).toMatchObject({ desde: { tipo: "cable", cable: "w1", x: 0, y: -3 }, hasta: libre(2, -3) });
    expect(cables(doc)).toHaveLength(4);
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  });
});

describe("herramienta cable: puente A1-A2", () => {
  it("sin codos no hay camino; con un codo a mano en (2, −3), rodea la bobina", () => {
    const { editor, doc } = armar();
    editor.accion("cable");
    clic(editor, 0, -2);
    mover(editor, 0, 2);
    expect(editor.cable!.dibujo!.valido).toBe(false);
    clic(editor, 2, -3);
    mover(editor, 0, 2);
    expect(editor.cable!.dibujo!.valido).toBe(true);
    clic(editor, 0, 2);
    expect(ultimo(doc)).toEqual({
      id: "w1",
      desde: { tipo: "borne", comp: "c1", borne: "A1" },
      hasta: { tipo: "borne", comp: "c1", borne: "A2" },
      codos: [
        [0, -3],
        [2, -3],
        [2, 3],
        [0, 3],
      ],
    });
  });
});

describe("herramienta cable: coherencia con el editor", () => {
  it("W vacía la selección; con un tramo, W no hace nada; sin tramo, la apaga", () => {
    const { editor, avisos } = armar();
    editor.seleccionarIds(["c1"]);
    editor.accion("cable");
    expect(editor.seleccion.size).toBe(0);
    clic(editor, 0, -2);
    expect(editor.accion("cable")).toBe(false);
    expect(avisos.at(-1)).toBe("Esc cancela el cable en curso.");
    editor.escape();
    expect(editor.accion("cable")).toBe(true);
    expect(editor.herramienta).toBeNull();
  });

  it("R, M y Supr no hacen nada con la herramienta cable", () => {
    const { editor, doc } = armar();
    editor.accion("cable");
    const antes = copia(doc);
    for (const a of ["rotar", "espejar", "borrar"] as const) expect(editor.accion(a)).toBe(false);
    expect(doc).toEqual(antes);
  });

  it("W en medio de un rectángulo de selección no hace nada", () => {
    const { editor } = armar();
    editor.aplicar(editor.activa.presionar(ev(20, 20)));
    editor.aplicar(editor.activa.mover(ev(25, 25)));
    expect(editor.accion("cable")).toBe(false);
    expect(editor.cable).toBeNull();
  });

  it("Colocar desde la paleta cancela el tramo; W cancela Colocar", () => {
    const { editor, doc } = armar();
    editor.accion("cable");
    clic(editor, 0, -2);
    const def = { ...editor.escena.obtener("c1")!.def };
    editor.iniciarColocar(def, "clic");
    expect(editor.colocar).not.toBeNull();
    expect(editor.enTramo).toBe(false);
    editor.accion("cable");
    expect(editor.cable).not.toBeNull();
    expect(cables(doc)).toHaveLength(0);
  });

  it("cancelar la herramienta (cambio de escena o de modo) descarta el tramo y la cierra", () => {
    const { editor, doc } = armar();
    const antes = copia(doc);
    editor.accion("cable");
    clic(editor, 0, -2);
    clic(editor, 3, -4);
    editor.cancelarHerramienta();
    expect(editor.herramienta).toBeNull();
    expect(doc).toEqual(antes);
    expect(editor.puedeRehacer).toBe(false);
  });

  it("el tramo no invalida mosaicos; al terminar, solo las cajas por tramo del cable nuevo", () => {
    const { editor, vista } = armar();
    editor.accion("cable");
    vista.regiones = [];
    clic(editor, 0, -2);
    for (let i = 0; i < 30; i++) mover(editor, i * 0.3, -3 - i * 0.2);
    clic(editor, -3, -4);
    expect(vista.regiones).toEqual([]);
    clic(editor, 0, -6);
    const c = editor.escena.obtenerCable("w1")!;
    expect(vista.regiones).toEqual(cajasCable(c));
  });

  it("mover el mouse solo pide cuadro al cambiar de punto de grilla u objetivo", () => {
    const { editor, vista } = armar();
    editor.accion("cable");
    clic(editor, 30, 0);
    vista.cuadros = 0;
    for (let i = 0; i < 10; i++) mover(editor, 33 + i * 0.02, 2);
    expect(vista.cuadros).toBe(1);
  });
});

describe("índices al día", () => {
  function bornesDesdeCero(doc: Documento): [string, number][] {
    return new BornesConCable(doc.hojas[0]!.cables).entradas();
  }

  it("bornes con cable: igual a una pasada completa después de crear, borrar, deshacer y rehacer", () => {
    const { editor, doc } = armar();
    editor.accion("cable");
    clic(editor, 0, -2);
    clic(editor, 0, -6);
    clic(editor, 0, 2);
    clic(editor, 6, 6);
    clic(editor, 6, 6);
    expect(editor.bornesConCable.entradas()).toEqual(bornesDesdeCero(doc));
    expect(editor.bornesConCable.tiene("c1", "A1")).toBe(true);
    editor.escape();
    editor.escape();
    editor.seleccionarIds(["c3"]); // borrar K3 suelta el cable de su A2
    editor.accion("borrar");
    expect(editor.bornesConCable.entradas()).toEqual(bornesDesdeCero(doc));
    expect(editor.bornesConCable.tiene("c3", "A2")).toBe(false);
    for (const a of ["deshacer", "deshacer", "rehacer", "deshacer", "rehacer", "rehacer"] as const) {
      editor.accion(a);
      expect(editor.bornesConCable.entradas()).toEqual(bornesDesdeCero(doc));
    }
  });

  it("bornes con cable: volver a poner un cable con los mismos bornes no cuenta dos veces; cambiar o quitar sí actualiza", () => {
    const b = new BornesConCable();
    const w = { id: "w1", desde: { tipo: "borne", comp: "c1", borne: "A1" }, hasta: { tipo: "libre", x: 4, y: 4 }, codos: [] } as const;
    const copiaW = () => ({ ...w, desde: { ...w.desde }, hasta: { ...w.hasta }, codos: [] as [number, number][] });
    b.poner("w1", copiaW());
    b.poner("w1", { ...copiaW(), codos: [[4, -2]] });
    expect(b.entradas()).toEqual([[claveBorne("c1", "A1"), 1]]);
    b.poner("w1", { ...copiaW(), hasta: { tipo: "borne", comp: "c2", borne: "13" } });
    expect(b.entradas()).toEqual([
      [claveBorne("c1", "A1"), 1],
      [claveBorne("c2", "13"), 1],
    ]);
    b.poner("w1", { ...copiaW(), desde: { tipo: "libre", x: 0, y: 0 } });
    expect(b.entradas()).toEqual([]);
    b.poner("w1", undefined);
    expect(b.entradas()).toEqual([]);
    b.poner("w2", undefined);
    expect(b.entradas()).toEqual([]);
  });

  it("la consulta con el índice de la escena da lo mismo que la lineal, en 2000 + 3000", () => {
    const doc = documentoBancoCables(2000);
    const editor = new Editor(doc);
    const lineal = consultaHoja(doc.hojas[0]!);
    const ordenar = <T>(l: Iterable<T>, f: (t: T) => string) => [...l].map(f).sort();
    let s = 3;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const caja = editor.escena.caja!;
    for (let i = 0; i < 60; i++) {
      const k = {
        x: Math.round(caja.x + rnd() * caja.ancho),
        y: Math.round(caja.y + rnd() * caja.alto),
        ancho: Math.round(rnd() * 30),
        alto: Math.round(rnd() * (i % 3 === 0 ? 0 : 30)),
      };
      const b = (x: { comp: string; borne: string; x: number; y: number; direccion: string }) => `${x.comp}.${x.borne}@${x.x},${x.y}${x.direccion}`;
      expect(ordenar(editor.consulta.bornesEn(k), b)).toEqual(ordenar(lineal.bornesEn(k), b));
      const c = (x: { comp: string; caja: Caja }) => `${x.comp}:${JSON.stringify(x.caja)}`;
      expect(ordenar(editor.consulta.cuerposEn(k), c)).toEqual(ordenar(lineal.cuerposEn(k), c));
      const w = (x: { id: string; puntos: readonly number[] }) => `${x.id}:${x.puntos.join(",")}`;
      expect(ordenar(editor.consulta.cablesEn(k), w)).toEqual(ordenar(lineal.cablesEn(k), w));
    }
  });
});

describe("herramienta cable: capa dinámica", () => {
  function dibujar(editor: Editor, visible: Caja) {
    const llamadas: { nombre: string; args: unknown[] }[] = [];
    const r = new Proxy({} as Record<string, unknown>, {
      get: (_, nombre) => (...args: unknown[]) => llamadas.push({ nombre: String(nombre), args }),
    });
    editor.dibujarDinamico(r as never, {
      escala: ESCALA,
      colores: { acento: "#06f", aviso: "#c40" },
      visible,
      medir: (f: () => void) => (f(), 0),
    } as never);
    return llamadas;
  }

  it("las marcas de los bornes visibles van en un relleno por tipo (huecos libres, rellenos con cable)", () => {
    const { editor } = armar([{ desde: { tipo: "borne", comp: "c1", borne: "A1" }, hasta: libre(0, -4), codos: [] }]);
    editor.accion("cable");
    const l = dibujar(editor, { x: -3, y: -4, ancho: 6, alto: 8 }); // solo K1
    const rect = l.filter((k) => k.nombre === "rectangulos");
    expect(rect.map((k) => k.args[1])).toEqual([1, 1]); // A2 libre, A1 con cable
  });

  it("sin herramienta cable no dibuja marcas; Esc sin tramo no deja nada en la capa dinámica", () => {
    const { editor } = armar();
    editor.accion("cable");
    clic(editor, 0, -2);
    mover(editor, 3, -5);
    expect(dibujar(editor, { x: -50, y: -50, ancho: 100, alto: 100 }).some((k) => k.nombre === "lineas")).toBe(true);
    editor.escape();
    editor.escape();
    expect(dibujar(editor, { x: -50, y: -50, ancho: 100, alto: 100 })).toEqual([]);
  });
});
