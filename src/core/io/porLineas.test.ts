import { describe, expect, it } from "vitest";
import { crearDocumento, type Documento } from "../model/documento";
import { deserializar, serializar, serializarPorLineas } from ".";
import { datos, docCables, documentosDePrueba, meta } from "./prueba-documentos";

/** El ejemplo de docs/archivo/plan-T15a.md §1, el mismo de serializar.test.ts. */
function docEjemplo(): Documento {
  return {
    formato: "bornera",
    version: 1,
    meta: { titulo: "Marcha-parada", autor: "", fecha: "2026-11-12" },
    contadores: { c: 3, w: 3 },
    hojas: [
      {
        nombre: "Hoja 1",
        componentes: [{ id: "c1", tipo: "pulsador.na", x: 10, y: 8, rot: 90, espejado: true, etiqueta: "S1", params: {} }],
        cables: [{ id: "w1", desde: { tipo: "borne", comp: "c1", borne: "13" }, hasta: { tipo: "cable", cable: "w2", x: 10, y: 4 }, codos: [[10, 5]] }],
      },
    ],
  };
}

/** El ejemplo en forma por líneas, tal cual (docs/arquitectura.md). */
const EJEMPLO_LINEAS = [
  '{"formato":"bornera","version":1,',
  '"meta":{"titulo":"Marcha-parada","autor":"","fecha":"2026-11-12"},',
  '"contadores":{"c":3,"w":3},',
  '"hojas":[',
  '{"nombre":"Hoja 1",',
  '"componentes":[',
  '{"id":"c1","tipo":"pulsador.na","x":10,"y":8,"rot":90,"espejado":true,"etiqueta":"S1","params":{}}',
  "],",
  '"cables":[',
  '{"id":"w1","desde":{"tipo":"borne","comp":"c1","borne":"13"},"hasta":{"tipo":"cable","cable":"w2","x":10,"y":4},"codos":[[10,5]]}',
  "]}",
  "]}",
  "",
].join("\n");

/** Tres hojas: con todo, vacía y con un solo componente; contadores de más de una letra. */
function docHojas(): Documento {
  const doc = docCables();
  doc.hojas.push({ nombre: "Hoja 2", componentes: [], cables: [] });
  doc.hojas.push({ nombre: "Hoja 3", componentes: [{ id: "c90", ...datos("pulsador.nc", 4, 4) }], cables: [] });
  doc.contadores["c"] = 91;
  return doc;
}

const TODOS: [string, Documento][] = [...documentosDePrueba(), ["tres hojas, una vacía", docHojas()]];

describe("serializarPorLineas: forma exacta", () => {
  it("el ejemplo sale idéntico", () => {
    expect(serializarPorLineas(docEjemplo())).toBe(EJEMPLO_LINEAS);
  });

  it("una hoja vacía y la última hoja", () => {
    const doc = crearDocumento(meta);
    doc.hojas.push({ nombre: "Hoja 2", componentes: [{ id: "c1", ...datos("pulsador.na", 0, 0) }], cables: [] });
    const lineas = serializarPorLineas(doc).split("\n");
    expect(lineas.slice(3)).toEqual([
      '"hojas":[',
      '{"nombre":"Hoja 1",',
      '"componentes":[],',
      '"cables":[]},',
      '{"nombre":"Hoja 2",',
      '"componentes":[',
      '{"id":"c1","tipo":"pulsador.na","x":0,"y":0,"rot":0,"espejado":false,"etiqueta":"","params":{}}',
      "],",
      '"cables":[]}',
      "]}",
      "",
    ]);
  });

  it.each(TODOS)("%s: sin BOM, sin \\r, termina en un solo \\n y una línea por componente y por cable", (_n, doc) => {
    const texto = serializarPorLineas(doc);
    expect(texto.charCodeAt(0)).not.toBe(0xfeff);
    expect(texto).not.toContain("\r");
    expect(texto.endsWith("]}\n")).toBe(true);
    expect(texto.endsWith("\n\n")).toBe(false);
    // 4 de cabecera y cierre; por hoja: nombre, y cada lista vacía 1 línea o abre + elementos + cierra.
    const lista = (n: number) => (n === 0 ? 1 : n + 2);
    const esperadas = 5 + doc.hojas.reduce((s, h) => s + 1 + lista(h.componentes.length) + lista(h.cables.length), 0);
    expect(texto.split("\n").length - 1).toBe(esperadas);
    // Cada componente y cada cable es una línea entera que se lee sola, en el orden del documento.
    const objetos = texto
      .split("\n")
      .filter((l) => l.startsWith('{"id":'))
      .map((l) => JSON.parse(l.replace(/,$/, "")) as unknown);
    expect(objetos).toEqual(doc.hojas.flatMap((h) => [...h.componentes, ...h.cables]));
  });
});

describe("serializarPorLineas: la misma forma canónica", () => {
  it.each(TODOS)("%s: quitando los \\n queda serializar", (_n, doc) => {
    expect(serializarPorLineas(doc).replaceAll("\n", "")).toBe(serializar(doc));
  });

  it.each(TODOS)("%s: abre igual y se vuelve a escribir igual (idempotente)", (_n, doc) => {
    const texto = serializarPorLineas(doc);
    const r = deserializar(texto);
    expect(r.ok ? [] : r.errores).toEqual([]);
    if (!r.ok) return;
    // Con varias hojas, `deserializar` avisa que solo se ve la primera; abre igual.
    expect(r.avisos.filter((a) => a.donde !== "hojas")).toEqual([]);
    expect(r.documento).toEqual(doc);
    expect(serializarPorLineas(r.documento)).toBe(texto);
  });

  it.each(TODOS)("%s: con CRLF (Git en Windows) abre igual y se vuelve a escribir con \\n", (_n, doc) => {
    const texto = serializarPorLineas(doc);
    const crlf = texto.replaceAll("\n", "\r\n");
    const r = deserializar(crlf);
    expect(r.ok ? [] : r.errores).toEqual([]);
    if (!r.ok) return;
    expect(r.documento).toEqual(doc);
    expect(serializarPorLineas(r.documento)).toBe(texto);
  });

  it("no cambia el documento", () => {
    const doc = docHojas();
    const copia = JSON.parse(JSON.stringify(doc)) as Documento;
    serializarPorLineas(doc);
    expect(doc).toEqual(copia);
  });

  it("las claves no llevan ñ ni tildes", () => {
    const claves = new Set<string>();
    const juntar = (v: unknown, enMapa: boolean): void => {
      if (Array.isArray(v)) v.forEach((x) => juntar(x, false));
      else if (v !== null && typeof v === "object")
        for (const [k, x] of Object.entries(v)) {
          // Las claves de `params` y `contadores` las elige el usuario o el símbolo: no se miran.
          if (!enMapa) claves.add(k);
          juntar(x, k === "params" || k === "contadores");
        }
    };
    for (const [, doc] of TODOS) juntar(JSON.parse(serializarPorLineas(doc)), false);
    expect([...claves].filter((k) => !/^[a-z]+$/.test(k))).toEqual([]);
  });
});
