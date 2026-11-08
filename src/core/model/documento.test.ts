import { describe, expect, it } from "vitest";
import {
  buscarComponente,
  crearDocumento,
  generarId,
  VERSION_FORMATO,
  type Componente,
  type Documento,
} from "./documento";

const meta = { titulo: "Marcha-parada", autor: "Bruno Jerke", fecha: "2026-11-07" };

/** Coloca un componente con id nuevo en la hoja indicada (los comandos llegan en T4). */
function colocar(doc: Documento, tipo: string, hoja = 0): Componente {
  const c: Componente = { id: generarId(doc), tipo, x: 0, y: 0, rot: 0, espejado: false, etiqueta: "", params: {} };
  doc.hojas[hoja]!.componentes.push(c);
  return c;
}

describe("crearDocumento", () => {
  it("crea un documento de Bornera con la versión actual del formato", () => {
    const doc = crearDocumento(meta);
    expect(doc.formato).toBe("bornera");
    expect(doc.version).toBe(VERSION_FORMATO);
    expect(doc.meta).toEqual(meta);
  });

  it("empieza con una sola hoja vacía", () => {
    expect(crearDocumento(meta).hojas).toEqual([{ nombre: "Hoja 1", componentes: [], cables: [] }]);
  });

  it("no comparte la meta con el objeto recibido", () => {
    const original = { ...meta };
    const doc = crearDocumento(original);
    original.titulo = "Otro";
    expect(doc.meta.titulo).toBe("Marcha-parada");
  });
});

describe("componentes", () => {
  it("se pueden agregar y buscar por id, en cualquier hoja", () => {
    const doc = crearDocumento(meta);
    doc.hojas.push({ nombre: "Hoja 2", componentes: [], cables: [] });
    const k1 = colocar(doc, "contactor.bobina");
    const h1 = colocar(doc, "senalizacion.lampara", 1);
    expect(buscarComponente(doc, k1.id)).toBe(k1);
    expect(buscarComponente(doc, h1.id)).toBe(h1);
    expect(buscarComponente(doc, "c99")).toBeUndefined();
  });
});

describe("generarId", () => {
  it("empieza en c1 y da ids únicos", () => {
    const doc = crearDocumento(meta);
    expect(generarId(doc)).toBe("c1");
    const ids = new Set(Array.from({ length: 100 }, () => generarId(doc)));
    expect(ids.size).toBe(100);
  });

  it("lleva un contador por prefijo", () => {
    const doc = crearDocumento(meta);
    generarId(doc);
    generarId(doc);
    expect(generarId(doc, "w")).toBe("w1");
    expect(generarId(doc)).toBe("c3");
  });

  it("no repite el id del componente más alto después de borrarlo", () => {
    const doc = crearDocumento(meta);
    colocar(doc, "pulsador.na");
    const ultimo = colocar(doc, "pulsador.nc");
    const hoja = doc.hojas[0]!;
    hoja.componentes = hoja.componentes.filter((c) => c.id !== ultimo.id);
    expect(colocar(doc, "pulsador.nc").id).not.toBe(ultimo.id);
  });

  it("el contador queda en el documento (se guarda con él)", () => {
    const doc = crearDocumento(meta);
    generarId(doc);
    const copia: Documento = JSON.parse(JSON.stringify(doc));
    expect(generarId(copia)).toBe("c2");
  });
});
