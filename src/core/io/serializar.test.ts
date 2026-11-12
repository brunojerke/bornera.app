import { describe, expect, it } from "vitest";
import { crearDocumento, generarId, type Documento } from "../model/documento";
import { SIMBOLOS } from "../symbols";
import { deserializar, serializar } from ".";
import { datos, docCables, docComandos, docTextos, documentosDePrueba, meta, RAROS } from "./prueba-documentos";
import { invariantes } from "./prueba-invariantes";

// ── Forma canónica ─────────────────────────────────────────────────────────

describe("serializar: forma canónica", () => {
  /** El ejemplo de docs/plan-T15a.md §1, tal cual. */
  const EJEMPLO =
    '{"formato":"bornera","version":1,"meta":{"titulo":"Marcha-parada","autor":"","fecha":"2026-11-12"},"contadores":{"c":3,"w":3},"hojas":[{"nombre":"Hoja 1","componentes":[{"id":"c1","tipo":"pulsador.na","x":10,"y":8,"rot":90,"espejado":true,"etiqueta":"S1","params":{}}],"cables":[{"id":"w1","desde":{"tipo":"borne","comp":"c1","borne":"13"},"hasta":{"tipo":"cable","cable":"w2","x":10,"y":4},"codos":[[10,5]]}]}]}';

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

  it("el ejemplo del plan sale idéntico: JSON compacto, en una línea, sin BOM ni salto final", () => {
    const texto = serializar(docEjemplo());
    expect(texto).toBe(EJEMPLO);
    expect(texto.charCodeAt(0)).not.toBe(0xfeff);
    expect(texto.endsWith("}")).toBe(true);
    expect(texto).not.toMatch(/[\n\r]/);
  });

  it("no depende del orden de las claves en memoria", () => {
    const d = docEjemplo();
    const c = d.hojas[0]!.componentes[0]!;
    const w = d.hojas[0]!.cables[0]!;
    // Las mismas claves, al revés.
    const alReves: Documento = {
      hojas: [
        {
          cables: [{ codos: [[10, 5]], hasta: { y: 4, x: 10, cable: "w2", tipo: "cable" }, desde: { borne: "13", comp: "c1", tipo: "borne" }, id: w.id }],
          componentes: [{ params: {}, etiqueta: c.etiqueta, espejado: c.espejado, rot: c.rot, y: c.y, x: c.x, tipo: c.tipo, id: c.id }],
          nombre: "Hoja 1",
        },
      ],
      contadores: { w: 3, c: 3 },
      meta: { fecha: "2026-11-12", autor: "", titulo: "Marcha-parada" },
      version: 1,
      formato: "bornera",
    };
    expect(serializar(alReves)).toBe(EJEMPLO);
  });

  it("los campos con valor por defecto van explícitos", () => {
    const doc = crearDocumento(meta);
    doc.hojas[0]!.componentes.push({ id: generarId(doc), ...datos("pulsador.na", 0, 0) });
    doc.hojas[0]!.cables.push({ id: generarId(doc, "w"), desde: { tipo: "libre", x: 5, y: 0 }, hasta: { tipo: "libre", x: 5, y: 3 }, codos: [] });
    const texto = serializar(doc);
    expect(texto).toContain('"espejado":false,"etiqueta":"","params":{}');
    expect(texto).toContain('"codos":[]');
    expect(serializar(crearDocumento(meta))).toBe(
      '{"formato":"bornera","version":1,"meta":{"titulo":"Prueba","autor":"Bruno Jerke","fecha":"2026-11-12"},"contadores":{},"hojas":[{"nombre":"Hoja 1","componentes":[],"cables":[]}]}',
    );
  });

  it("params y contadores en orden alfabético, también con claves que parecen números", () => {
    const doc = crearDocumento(meta);
    doc.contadores = { w: 4, c: 2, k: 9, "10": 1, "2": 1 };
    doc.hojas[0]!.componentes.push({ id: "c1", ...datos("pulsador.na", 0, 0), params: { tension: "24V", b: "2", a_1: "1", "10": "x", "2": "y" } });
    const texto = serializar(doc);
    expect(texto).toContain('"contadores":{"10":1,"2":1,"c":2,"k":9,"w":4}');
    expect(texto).toContain('"params":{"10":"x","2":"y","a_1":"1","b":"2","tension":"24V"}');
  });

  it("-0 se escribe 0", () => {
    const doc = crearDocumento(meta);
    doc.hojas[0]!.componentes.push({ id: "c1", ...datos("pulsador.na", -0, -0) });
    doc.hojas[0]!.cables.push({ id: "w1", desde: { tipo: "libre", x: -0, y: 1 }, hasta: { tipo: "cable", cable: "w2", x: -0, y: 3 }, codos: [[-0, 2]] });
    const texto = serializar(doc);
    expect(texto).not.toContain("-0");
    expect(texto).toContain('"x":0,"y":0');
    expect(texto).toContain('"codos":[[0,2]]');
  });

  it("cada texto (valores y claves) sale escapado: comillas, \\, saltos, tab y control; las tildes quedan tal cual", () => {
    const doc = docTextos();
    const texto = serializar(doc);
    // Ningún carácter de control crudo: todos van escapados.
    expect(texto).not.toMatch(/[\u0000-\u001f]/);
    // La tilde combinada (U+0301) no se escapa: va tal cual, en UTF-8.
    expect(texto).toContain(String.raw`"titulo":"Dijo \"hola\" \\ fin\nlínea\ttab ñandú e${"́"}\u0001 🔌"`);
    expect(texto).toContain(String.raw`"etiqueta":"Dijo \"hola\" \\ fin\nlínea\ttab ñandú e${"́"}\u0001 🔌"`);
    expect(texto).toContain(String.raw`"nombre":"Hoja\nuno"`);
    // Una clave rara (solo puede venir de la consola) también sale escapada: el texto sigue siendo JSON.
    doc.hojas[0]!.componentes[0]!.params = { 'a"b\\c\n': "x" };
    const conClave = serializar(doc);
    expect(conClave).toContain(String.raw`"params":{"a\"b\\c\n":"x"}`);
    expect(() => JSON.parse(conClave)).not.toThrow();
  });

  it("serializar dos veces da el mismo texto y no cambia el documento", () => {
    for (const [nombre, doc] of documentosDePrueba()) {
      const copia = JSON.parse(JSON.stringify(doc)) as Documento;
      expect(serializar(doc), nombre).toBe(serializar(doc));
      expect(doc, nombre).toEqual(copia);
    }
  });
});

// ── Ida y vuelta ───────────────────────────────────────────────────────────

describe("ida y vuelta: serializar → deserializar", () => {
  it("los documentos de prueba son válidos (si no, el resto no prueba nada)", () => {
    for (const [nombre, doc] of documentosDePrueba()) expect(invariantes(doc), nombre).toEqual([]);
  });

  it.each(documentosDePrueba())("%s: vuelve igual (toEqual), sin avisos", (_nombre, doc) => {
    expect(deserializar(serializar(doc))).toEqual({ ok: true, documento: doc, avisos: [] });
  });

  it("cada paso de girar y espejar con los comandos reales vuelve igual, sin -0 en el modelo", () => {
    const { pasos } = docComandos();
    expect(pasos.length).toBe(14);
    for (const { nombre, doc } of pasos) {
      expect(deserializar(serializar(doc)), nombre).toEqual({ ok: true, documento: doc, avisos: [] });
    }
  });

  it("idempotencia: serializar(deserializar(serializar(d))) === serializar(d)", () => {
    for (const [nombre, doc] of documentosDePrueba()) {
      const texto = serializar(doc);
      const r = deserializar(texto);
      if (!r.ok) throw new Error(`${nombre}: no abre`);
      expect(serializar(r.documento), nombre).toBe(texto);
    }
  });

  it("el documento abierto es nuevo: cambiarlo no toca el original", () => {
    const doc = docCables();
    const r = deserializar(serializar(doc));
    if (!r.ok) throw new Error("no abre");
    r.documento.hojas[0]!.componentes[0]!.x = 99;
    r.documento.hojas[0]!.cables[0]!.codos.push([1, 1]);
    expect(doc).toEqual(docCables());
  });

  it("los textos raros vuelven igual, sin normalizar (é combinada no pasa a é)", () => {
    const r = deserializar(serializar(docTextos()));
    if (!r.ok) throw new Error("no abre");
    expect(r.documento.meta.titulo).toBe(RAROS);
    expect(r.documento.hojas[0]!.componentes[0]!.etiqueta).toBe(RAROS);
    expect(r.documento.meta.titulo).toContain("é");
  });
});

// ── Claves sin ñ ni tildes ─────────────────────────────────────────────────

describe("claves sin ñ ni tildes", () => {
  /** Cada clave del JSON y cada valor de `tipo` (de componente y de extremo). */
  function clavesYTipos(v: unknown, fuera: string[] = []): string[] {
    if (Array.isArray(v)) v.forEach((x) => clavesYTipos(x, fuera));
    else if (v !== null && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        fuera.push(k);
        if (k === "tipo" && typeof x === "string") fuera.push(x);
        clavesYTipos(x, fuera);
      }
    }
    return fuera;
  }

  it("toda clave, todo tipo de símbolo y todo tipo de extremo cumplen ^[a-z0-9_.]+$", () => {
    for (const [nombre, doc] of documentosDePrueba()) {
      const malas = clavesYTipos(JSON.parse(serializar(doc))).filter((k) => !/^[a-z0-9_.]+$/.test(k));
      expect(malas, nombre).toEqual([]);
    }
    // Los tres tipos de extremo y los 7 símbolos aparecen en los documentos de prueba.
    const todos = new Set(documentosDePrueba().flatMap(([, doc]) => clavesYTipos(JSON.parse(serializar(doc)))));
    for (const t of ["borne", "cable", "libre", ...SIMBOLOS.map((s) => s.tipo)]) expect(todos.has(t), t).toBe(true);
  });
});
