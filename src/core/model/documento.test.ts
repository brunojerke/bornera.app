import { describe, expect, it } from "vitest";
import { crearDocumento, VERSION_FORMATO } from "./documento";

describe("crearDocumento", () => {
  const meta = { titulo: "Marcha-parada", autor: "Bruno Jerke", fecha: "2026-11-07" };

  it("crea un documento de Bornera con la versión actual del formato", () => {
    const doc = crearDocumento(meta);
    expect(doc.formato).toBe("bornera");
    expect(doc.version).toBe(VERSION_FORMATO);
    expect(doc.meta).toEqual(meta);
  });

  it("empieza con una sola hoja", () => {
    expect(crearDocumento(meta).hojas).toEqual([{ nombre: "Hoja 1" }]);
  });

  it("no comparte la meta con el objeto recibido", () => {
    const original = { ...meta };
    const doc = crearDocumento(original);
    original.titulo = "Otro";
    expect(doc.meta.titulo).toBe("Marcha-parada");
  });
});
