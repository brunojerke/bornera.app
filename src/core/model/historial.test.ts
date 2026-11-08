import { describe, expect, it } from "vitest";
import { Borrar, CambiarEtiqueta, Mover, Rotar, colocar, type Cambio, type Comando } from "./comandos";
import { buscarComponente, crearDocumento, type Componente, type Documento } from "./documento";
import { Historial } from "./historial";

const meta = { titulo: "Prueba", autor: "Bruno Jerke", fecha: "2026-11-08" };

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function lampara(x: number, y: number): Omit<Componente, "id"> {
  return { tipo: "senalizacion.lampara", x, y, rot: 0, espejado: false, etiqueta: "", params: {} };
}

function nuevo(): { doc: Documento; h: Historial } {
  const doc = crearDocumento(meta);
  return { doc, h: new Historial(doc) };
}

/** Un comando que siempre falla al aplicar. */
const fallido: Comando = {
  aplicar(): Cambio {
    throw new Error("falla a propósito");
  },
  deshacer(): Cambio {
    return { componentes: [] };
  },
};

describe("Historial", () => {
  it("sin nada: deshacer y rehacer devuelven null", () => {
    const { h } = nuevo();
    expect(h.puedeDeshacer).toBe(false);
    expect(h.puedeRehacer).toBe(false);
    expect(h.deshacer()).toBeNull();
    expect(h.rehacer()).toBeNull();
  });

  it("ejecuta, deshace y rehace, y devuelve el cambio de cada paso", () => {
    const { doc, h } = nuevo();
    const c = colocar(doc, lampara(2, 2));
    const vacio = copia(doc);
    expect(h.ejecutar(c)).toEqual({ componentes: ["c1"] });
    const colocado = copia(doc);
    expect(h.puedeDeshacer).toBe(true);

    expect(h.deshacer()).toEqual({ componentes: ["c1"] });
    expect(doc).toEqual(vacio);
    expect(h.puedeDeshacer).toBe(false);
    expect(h.puedeRehacer).toBe(true);

    expect(h.rehacer()).toEqual({ componentes: ["c1"] });
    expect(doc).toEqual(colocado);
    expect(h.puedeRehacer).toBe(false);
  });

  it("Colocar y Mover, deshacer los dos, rehacer los dos: el Mover encuentra su componente", () => {
    const { doc, h } = nuevo();
    const c = colocar(doc, lampara(0, 0));
    h.ejecutar(c);
    h.ejecutar(new Mover([c.id], 3, -2));
    h.deshacer();
    h.deshacer();
    expect(buscarComponente(doc, c.id)).toBeUndefined();
    h.rehacer();
    h.rehacer();
    expect(buscarComponente(doc, c.id)).toMatchObject({ x: 3, y: -2 });
  });

  it("ejecutar algo nuevo borra lo que había para rehacer", () => {
    const { doc, h } = nuevo();
    h.ejecutar(colocar(doc, lampara(0, 0)));
    h.ejecutar(new Mover(["c1"], 1, 0));
    h.deshacer();
    expect(h.puedeRehacer).toBe(true);
    h.ejecutar(new CambiarEtiqueta("c1", "H1"));
    expect(h.puedeRehacer).toBe(false);
    expect(h.rehacer()).toBeNull();
    expect(buscarComponente(doc, "c1")).toMatchObject({ x: 0, etiqueta: "H1" });
  });

  it("agrupar deshace y rehace todo en un solo paso", () => {
    const { doc, h } = nuevo();
    h.ejecutar(colocar(doc, lampara(0, 0)));
    const a = colocar(doc, lampara(4, 0));
    const antes = copia(doc);
    const cambio = h.agrupar([a, new Mover([a.id, "c1"], 0, 2), new Rotar([a.id, "c1"], 90), new Borrar(["c1"])]);
    expect(cambio).toEqual({ componentes: [a.id, "c1"] });
    const despues = copia(doc);

    h.deshacer();
    expect(doc).toEqual(antes);
    expect(h.puedeDeshacer).toBe(true); // queda el primer Colocar
    h.rehacer();
    expect(doc).toEqual(despues);
  });

  it("agrupar sin comandos no agrega un paso", () => {
    const { doc, h } = nuevo();
    h.ejecutar(colocar(doc, lampara(0, 0)));
    h.deshacer();
    expect(h.agrupar([])).toEqual({ componentes: [] });
    expect(h.puedeDeshacer).toBe(false);
    expect(h.puedeRehacer).toBe(true);
  });

  it("un comando que falla no cambia el historial ni borra el rehacer", () => {
    const { doc, h } = nuevo();
    h.ejecutar(colocar(doc, lampara(0, 0)));
    h.ejecutar(new Mover(["c1"], 1, 0));
    h.deshacer();
    const antes = copia(doc);
    expect(() => h.ejecutar(fallido)).toThrow("falla a propósito");
    expect(() => h.ejecutar(new Mover(["c99"], 1, 0))).toThrow(Error);
    expect(() => h.agrupar([new Mover(["c1"], 5, 5), fallido])).toThrow("falla a propósito");
    expect(doc).toEqual(antes);
    expect(h.puedeRehacer).toBe(true);
    h.deshacer();
    expect(h.puedeDeshacer).toBe(false);
  });

  it("es ilimitado", () => {
    const { doc, h } = nuevo();
    h.ejecutar(colocar(doc, lampara(0, 0)));
    for (let i = 0; i < 1000; i++) h.ejecutar(new Mover(["c1"], 1, 0));
    while (h.puedeDeshacer) h.deshacer();
    expect(doc.hojas[0]!.componentes).toEqual([]);
  });
});
