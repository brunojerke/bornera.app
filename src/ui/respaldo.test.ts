import { describe, expect, it } from "vitest";
import { documentosDePrueba } from "../core/io/prueba-documentos";
import { abrirBase, registroCopia } from "./respaldo";

describe("registroCopia", () => {
  it("arma el registro del esquema 1 con la cuenta de componentes de todas las hojas", () => {
    const docs = documentosDePrueba().map(([, d]) => d);
    const doc = docs.find((d) => d.hojas.length > 1) ?? docs[0]!;
    const total = doc.hojas.reduce((n, h) => n + h.componentes.length, 0);
    const r = registroCopia("abc", doc, "{}", { nombre: "x.brn", ruta: "C:\\x.brn" }, "0.1.4-alpha.1", 1234);
    expect(r).toEqual({
      id: "abc",
      esquema: 1,
      texto: "{}",
      archivo: { nombre: "x.brn", ruta: "C:\\x.brn" },
      titulo: doc.meta.titulo,
      componentes: total,
      fecha: 1234,
      version: "0.1.4-alpha.1",
    });
  });
});

describe("abrirBase", () => {
  it("sin IndexedDB (como en Node) rechaza con un mensaje claro", async () => {
    expect(globalThis.indexedDB).toBeUndefined();
    await expect(abrirBase()).rejects.toThrow("IndexedDB no está disponible");
  });
});
