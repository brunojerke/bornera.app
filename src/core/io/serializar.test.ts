import { describe, expect, it } from "vitest";
import { borneDe, indexarHoja, recorridoCable, seApoyaEn, validarHoja } from "../model/cables";
import { cablear, colocar, Espejar, Rotar, type Comando } from "../model/comandos";
import { crearDocumento, generarId, type Cable, type Componente, type Documento, type Extremo } from "../model/documento";
import { SIMBOLOS } from "../symbols";
import type { Rotacion } from "../symbols/tipos";
import { deserializar, serializar } from ".";

const meta = { titulo: "Prueba", autor: "Bruno Jerke", fecha: "2026-11-12" };
const ROTACIONES: Rotacion[] = [0, 90, 180, 270];

function datos(tipo: string, x: number, y: number, rot: Rotacion = 0, espejado = false): Omit<Componente, "id"> {
  return { tipo, x, y, rot, espejado, etiqueta: "", params: {} };
}

/** Invariantes de un documento que abre: cada hoja válida, sin ciclos de apoyos y sin T en el extremo de su anfitrión. */
function invariantes(doc: Documento): string[] {
  const fallas: string[] = [];
  doc.hojas.forEach((hoja, h) => {
    for (const p of validarHoja(hoja)) fallas.push(`hoja ${h}, ${p.id}: ${p.mensaje}`);
    const indice = indexarHoja(hoja);
    for (const w of hoja.cables) {
      if (seApoyaEn(indice, w.id, w.id)) fallas.push(`hoja ${h}, ${w.id}: ciclo de apoyos`);
      for (const e of [w.desde, w.hasta]) {
        if (e.tipo !== "cable") continue;
        const anfitrion = indice.cables.get(e.cable);
        const p = anfitrion && recorridoCable(indice, anfitrion);
        if (!p) continue;
        const n = p.length;
        if ((p[0] === e.x && p[1] === e.y) || (p[n - 2] === e.x && p[n - 1] === e.y)) fallas.push(`hoja ${h}, ${w.id}: T en el extremo de ${e.cable}`);
      }
    }
  });
  return fallas;
}

/** Rutas de los `-0` que haya en un valor. */
function menosCeros(v: unknown, ruta = "", fuera: string[] = []): string[] {
  if (typeof v === "number" && Object.is(v, -0)) fuera.push(ruta);
  else if (Array.isArray(v)) v.forEach((x, i) => menosCeros(x, `${ruta}[${i}]`, fuera));
  else if (v !== null && typeof v === "object") for (const [k, x] of Object.entries(v)) menosCeros(x, `${ruta}.${k}`, fuera);
  return fuera;
}

/** Codos de un cable en L entre dos puntos (ninguno si están alineados). */
function enL(a: { x: number; y: number }, b: { x: number; y: number }): [number, number][] {
  return a.x === b.x || a.y === b.y ? [] : [[a.x, b.y]];
}

// ── Documentos de prueba ───────────────────────────────────────────────────

/** Los 7 símbolos en las 4 rotaciones, con y sin espejo; sin cables. */
function docRotados(): Documento {
  const doc = crearDocumento(meta);
  const hoja = doc.hojas[0]!;
  SIMBOLOS.forEach((s, i) => {
    ROTACIONES.forEach((rot, j) => {
      for (const espejado of [false, true]) {
        hoja.componentes.push({ id: generarId(doc), ...datos(s.tipo, i * 10, j * 20 + (espejado ? 10 : 0), rot, espejado), etiqueta: `X${i}${j}` });
      }
    });
  });
  return doc;
}

/**
 * Componentes rotados y espejados con cables entre bornes, codos, T (también
 * una T sobre un cable que es T), extremos libres, params y contadores.
 */
function docCables(): Documento {
  const doc = crearDocumento(meta);
  const hoja = doc.hojas[0]!;
  const comp = (d: Omit<Componente, "id">): Componente => {
    const c = { id: generarId(doc), ...d };
    hoja.componentes.push(c);
    return c;
  };
  const c1 = comp(datos("pulsador.na", 0, 0, 90, true));
  const c2 = comp({ ...datos("contactor.bobina", 10, 6, 180), etiqueta: "K1", params: { tension: "220V", "10": "a", "2": "b" } });
  const c3 = comp(datos("senalizacion.lampara", 16, 12, 270));
  comp(datos("fuente.fase", -10, -10));
  const cable = (desde: Extremo, hasta: Extremo, codos: [number, number][]): Cable => {
    const w = { id: generarId(doc, "w"), desde, hasta, codos };
    hoja.cables.push(w);
    return w;
  };
  const b13 = borneDe(c1, "13")!;
  const b14 = borneDe(c1, "14")!;
  const a2 = borneDe(c2, "A2")!;
  const x1 = borneDe(c3, "X1")!;
  // w1: c1·13 → c2·A2, en L con un codo. w3 hace T en el medio de su tramo horizontal.
  const w1 = cable({ tipo: "borne", comp: c1.id, borne: "13" }, { tipo: "borne", comp: c2.id, borne: "A2" }, enL(b13, a2));
  const t1 = { x: b13.x + 2, y: a2.y };
  cable({ tipo: "borne", comp: c1.id, borne: "14" }, { tipo: "libre", x: b14.x, y: b14.y - 5 }, []);
  const w3 = cable({ tipo: "cable", cable: w1.id, ...t1 }, { tipo: "libre", x: t1.x, y: t1.y + 6 }, []);
  const t2 = { x: t1.x, y: t1.y + 3 };
  cable({ tipo: "cable", cable: w3.id, ...t2 }, { tipo: "borne", comp: c3.id, borne: "X1" }, enL(t2, x1));
  doc.contadores["k"] = 2;
  return doc;
}

/** Textos con comillas, \, saltos, tab, control, tildes, ñ, una tilde combinada y un emoji. */
const RAROS = 'Dijo "hola" \\ fin\nlínea\ttab ñandú é\u0001 🔌';

function docTextos(): Documento {
  const doc = crearDocumento({ titulo: RAROS, autor: "Bruno Jerke — «autor»", fecha: "12/11/2026" });
  doc.hojas[0]!.nombre = "Hoja\nuno";
  doc.hojas[0]!.componentes.push({ id: generarId(doc), ...datos("pulsador.na", 0, 0), etiqueta: RAROS, params: { nota: RAROS } });
  return doc;
}

/**
 * Componentes en el origen y simétricos alrededor de él, con cables, girados
 * y espejados con los comandos reales. Si el modelo dejara un `-0`, el
 * `toEqual` de ida y vuelta fallaría (supuesto con "frenar" del plan).
 */
function docComandos(): { doc: Documento; pasos: { nombre: string; doc: Documento }[] } {
  const doc = crearDocumento(meta);
  const a = colocar(doc, datos("pulsador.na", -10, 0));
  a.aplicar(doc);
  const b = colocar(doc, datos("pulsador.nc", 10, 0));
  b.aplicar(doc);
  const c = colocar(doc, datos("contactor.bobina", 0, 0));
  c.aplicar(doc);
  // La bobina del origen, con un cable a un punto libre de cada lado y una T.
  cablear(doc, { desde: { tipo: "borne", comp: c.id, borne: "A1" }, hasta: { tipo: "libre", x: 0, y: -6 }, codos: [] }).aplicar(doc);
  const w2 = cablear(doc, { desde: { tipo: "borne", comp: c.id, borne: "A2" }, hasta: { tipo: "libre", x: 0, y: 6 }, codos: [] });
  w2.aplicar(doc);
  cablear(doc, { desde: { tipo: "cable", cable: w2.id, x: 0, y: 4 }, hasta: { tipo: "libre", x: 4, y: 4 }, codos: [] }).aplicar(doc);
  // Los pulsadores, unidos por arriba.
  cablear(doc, {
    desde: { tipo: "borne", comp: a.id, borne: "13" },
    hasta: { tipo: "borne", comp: b.id, borne: "11" },
    codos: [
      [-10, -10],
      [10, -10],
    ],
  }).aplicar(doc);
  const todos = (): string[] => [...doc.hojas[0]!.componentes.map((k) => k.id), ...doc.hojas[0]!.cables.map((w) => w.id)];
  const pasos: { nombre: string; doc: Documento }[] = [];
  const hacer = (nombre: string, cmd: Comando): void => {
    cmd.aplicar(doc);
    pasos.push({ nombre, doc: JSON.parse(JSON.stringify(doc)) as Documento });
    // JSON pierde los -0: se miran en el documento vivo.
    expect(menosCeros(doc), `${nombre}: -0 en el modelo`).toEqual([]);
  };
  for (const sentido of [90, -90] as const) {
    for (let i = 0; i < 4; i++) hacer(`girar ${sentido} la bobina del origen, con sus cables (${i + 1})`, new Rotar([c.id], sentido));
  }
  hacer("espejar la bobina del origen", new Espejar([c.id]));
  hacer("espejar el pulsador con su cable", new Espejar([a.id]));
  hacer("girar los tres componentes", new Rotar([a.id, b.id, c.id], -90));
  hacer("espejar los tres componentes", new Espejar([a.id, b.id, c.id]));
  hacer("girar todo", new Rotar(todos(), 90));
  hacer("espejar todo", new Espejar(todos()));
  return { doc, pasos };
}

function documentosDePrueba(): [string, Documento][] {
  return [
    ["vacío", crearDocumento({ titulo: "", autor: "", fecha: "" })],
    ["rotados y espejados", docRotados()],
    ["cables, T, libres y contadores", docCables()],
    ["textos raros", docTextos()],
    ["girado y espejado con comandos", docComandos().doc],
  ];
}

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
