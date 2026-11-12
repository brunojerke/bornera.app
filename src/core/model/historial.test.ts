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
    return { componentes: [], cables: [] };
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
    expect(h.ejecutar(c)).toEqual({ componentes: ["c1"], cables: [] });
    const colocado = copia(doc);
    expect(h.puedeDeshacer).toBe(true);

    expect(h.deshacer()).toEqual({ componentes: ["c1"], cables: [] });
    expect(doc).toEqual(vacio);
    expect(h.puedeDeshacer).toBe(false);
    expect(h.puedeRehacer).toBe(true);

    expect(h.rehacer()).toEqual({ componentes: ["c1"], cables: [] });
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
    expect(cambio).toEqual({ componentes: [a.id, "c1"], cables: [] });
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
    expect(h.agrupar([])).toEqual({ componentes: [], cables: [] });
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

describe("Historial: marca de guardado (T15a, D16-A)", () => {
  /** Guarda en el acto: toma la marca y la aplica enseguida. */
  const guardar = (h: Historial): void => h.marcarGuardado(h.tomarMarca());

  it("un historial nuevo arranca sin cambios", () => {
    const { h } = nuevo();
    expect(h.modificado).toBe(false);
  });

  it("ejecutar marca cambios; guardar los quita", () => {
    const { doc, h } = nuevo();
    h.ejecutar(colocar(doc, lampara(0, 0)));
    expect(h.modificado).toBe(true);
    guardar(h);
    expect(h.modificado).toBe(false);
    h.ejecutar(new Mover(["c1"], 1, 0));
    expect(h.modificado).toBe(true);
  });

  it("deshacer hasta la marca deja sin cambios; rehacer vuelve a modificado", () => {
    const { doc, h } = nuevo();
    h.ejecutar(colocar(doc, lampara(0, 0)));
    guardar(h);
    h.ejecutar(new Mover(["c1"], 1, 0));
    h.ejecutar(new Mover(["c1"], 1, 0));
    h.deshacer();
    expect(h.modificado).toBe(true);
    h.deshacer();
    expect(h.modificado).toBe(false);
    // Más atrás de la marca también es un cambio.
    h.deshacer();
    expect(h.modificado).toBe(true);
    h.rehacer();
    expect(h.modificado).toBe(false);
    h.rehacer();
    expect(h.modificado).toBe(true);
  });

  it("guardar con la pila vacía: deshacer todo vuelve a sin cambios", () => {
    const { doc, h } = nuevo();
    guardar(h);
    h.ejecutar(colocar(doc, lampara(0, 0)));
    expect(h.modificado).toBe(true);
    h.deshacer();
    expect(h.modificado).toBe(false);
  });

  it("guardar, deshacer y ejecutar otro: la marca queda fuera del historial y sigue modificado", () => {
    const { doc, h } = nuevo();
    h.ejecutar(colocar(doc, lampara(0, 0)));
    h.ejecutar(new Mover(["c1"], 1, 0));
    guardar(h);
    h.deshacer();
    h.ejecutar(new Mover(["c1"], 0, 1));
    expect(h.modificado).toBe(true);
    // Ni deshaciendo ni rehaciendo se vuelve a la marca: ese estado ya no está.
    h.deshacer();
    expect(h.modificado).toBe(true);
    h.rehacer();
    expect(h.modificado).toBe(true);
    guardar(h);
    expect(h.modificado).toBe(false);
  });

  it("marca tomada antes de un cambio y aplicada después: sigue modificado", () => {
    const { doc, h } = nuevo();
    h.ejecutar(colocar(doc, lampara(0, 0)));
    const marca = h.tomarMarca();
    // Se edita mientras se escribe el archivo.
    h.ejecutar(new Mover(["c1"], 1, 0));
    h.marcarGuardado(marca);
    expect(h.modificado).toBe(true);
    // Deshacer lo editado durante la escritura vuelve a lo que se escribió.
    h.deshacer();
    expect(h.modificado).toBe(false);
  });

  it("agrupar apila un paso nuevo, no suma al de arriba: guardar, mover y agrupar otro mover sobre el mismo da modificado", () => {
    const { doc, h } = nuevo();
    h.ejecutar(colocar(doc, lampara(0, 0)));
    guardar(h);
    h.ejecutar(new Mover(["c1"], 1, 0));
    h.agrupar([new Mover(["c1"], 1, 0)]);
    expect(h.modificado).toBe(true);
    // El caso que fallaría si agrupar sumara al paso de arriba: la marca justo en el mover.
    guardar(h);
    h.agrupar([new Mover(["c1"], 1, 0), new Mover(["c1"], 0, 1)]);
    expect(h.modificado).toBe(true);
    h.deshacer();
    expect(h.modificado).toBe(false);
  });

  it("agrupar sin comandos no cambia la marca", () => {
    const { doc, h } = nuevo();
    h.ejecutar(colocar(doc, lampara(0, 0)));
    guardar(h);
    h.agrupar([]);
    expect(h.modificado).toBe(false);
  });

  it("un comando que falla no cambia la marca", () => {
    const { doc, h } = nuevo();
    h.ejecutar(colocar(doc, lampara(0, 0)));
    guardar(h);
    expect(() => h.ejecutar(fallido)).toThrow("falla a propósito");
    expect(() => h.agrupar([new Mover(["c1"], 5, 5), fallido])).toThrow("falla a propósito");
    expect(h.modificado).toBe(false);
  });
});
