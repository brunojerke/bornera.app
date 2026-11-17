import { describe, expect, it } from "vitest";
import { documentosDePrueba } from "../core/io/prueba-documentos";
import { abrirBase, almacenMemoria, registroCopia, unirTrozos, type RegistroCopia, type Trozo } from "./respaldo";

const registro = (generacion: number, trozos: number, caracteres: number): RegistroCopia => ({
  id: "a",
  esquema: 1,
  generacion,
  trozos,
  caracteres,
  archivo: null,
  titulo: "Sin título",
  componentes: 0,
  fecha: 1,
  version: "x",
});
const trozo = (generacion: number, n: number, texto: string, id = "a"): Trozo => ({ id, generacion, n, texto });

describe("registroCopia", () => {
  it("arma el registro del esquema 1 con la cuenta de componentes de todas las hojas", () => {
    const docs = documentosDePrueba().map(([, d]) => d);
    const doc = docs.find((d) => d.hojas.length > 1) ?? docs[0]!;
    const total = doc.hojas.reduce((n, h) => n + h.componentes.length, 0);
    const r = registroCopia("abc", doc, { generacion: 3, trozos: 2, caracteres: 10 }, { nombre: "x.brn", ruta: "C:\\x.brn" }, "0.1.4-alpha.1", 1234);
    expect(r).toEqual({
      id: "abc",
      esquema: 1,
      generacion: 3,
      trozos: 2,
      caracteres: 10,
      archivo: { nombre: "x.brn", ruta: "C:\\x.brn" },
      titulo: doc.meta.titulo,
      componentes: total,
      fecha: 1234,
      version: "0.1.4-alpha.1",
    });
  });
});

describe("unirTrozos", () => {
  it("une en orden de n solo la generación del registro", () => {
    const r = unirTrozos(registro(2, 3, 6), [trozo(2, 2, "ef"), trozo(1, 0, "zz"), trozo(2, 0, "ab"), trozo(2, 1, "cd"), trozo(3, 0, "nuevo")]);
    expect(r).toEqual({ ok: true, registro: registro(2, 3, 6), texto: "abcdef" });
  });

  it("si falta un trozo, es una copia que no abre", () => {
    expect(unirTrozos(registro(2, 3, 6), [trozo(2, 0, "ab"), trozo(2, 2, "ef")])).toEqual({ ok: false, problema: "Faltan trozos de la copia: hay 2 de 3" });
  });

  it("si el largo no da, también", () => {
    expect(unirTrozos(registro(2, 1, 5), [trozo(2, 0, "abc")])).toEqual({ ok: false, problema: "La copia tiene 3 caracteres y tendría que tener 5" });
  });
});

describe("almacenMemoria (la misma conducta que el de IndexedDB)", () => {
  it("completar borra las generaciones anteriores de ese id, y nada más", async () => {
    const a = almacenMemoria();
    for (const t of [trozo(1, 0, "v"), trozo(2, 0, "ab"), trozo(3, 0, "en curso"), trozo(1, 0, "otro", "b")]) await a.escribirTrozo(t);
    await a.completar(registro(2, 1, 2));
    expect(a.trozos.map((t) => `${t.id}${t.generacion}`).sort()).toEqual(["a2", "a3", "b1"]);
    expect(await a.leer("a")).toMatchObject({ ok: true, texto: "ab" });
    expect(await a.leer("b")).toEqual({ ok: false, problema: "No hay una copia completa" });
  });

  it("borrar quita el registro y todos los trozos de ese id", async () => {
    const a = almacenMemoria();
    await a.escribirTrozo(trozo(1, 0, "ab"));
    await a.escribirTrozo(trozo(2, 0, "cd"));
    await a.escribirTrozo(trozo(1, 0, "x", "b"));
    await a.completar(registro(1, 1, 2));
    await a.borrar("a");
    expect(await a.listar()).toEqual([]);
    expect(a.trozos.map((t) => t.id)).toEqual(["b"]);
  });
});

describe("abrirBase", () => {
  it("sin IndexedDB (como en Node) rechaza con un mensaje claro", async () => {
    expect(globalThis.indexedDB).toBeUndefined();
    await expect(abrirBase()).rejects.toThrow("IndexedDB no está disponible");
  });
});
