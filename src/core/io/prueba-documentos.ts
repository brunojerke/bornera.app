// Documentos de prueba del formato .brn (T15a), compartidos por los tests del
// núcleo (src/core/io) y los del empaquetado (src/ui/brn.test.ts). Solo lo
// importan los tests: el código de la app no lo usa.
import { expect } from "vitest";
import { marchaParada } from "../circuitos/marchaParada";
import { borneDe } from "../model/cables";
import { cablear, colocar, Espejar, Rotar, type Comando } from "../model/comandos";
import { crearDocumento, generarId, type Cable, type Componente, type Documento, type Extremo } from "../model/documento";
import { SIMBOLOS } from "../symbols";
import type { Rotacion } from "../symbols/tipos";

export const meta = { titulo: "Prueba", autor: "Bruno Jerke", fecha: "2026-11-12" };
const ROTACIONES: Rotacion[] = [0, 90, 180, 270];

export function datos(tipo: string, x: number, y: number, rot: Rotacion = 0, espejado = false): Omit<Componente, "id"> {
  return { tipo, x, y, rot, espejado, etiqueta: "", params: {} };
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

/** Los 7 símbolos en las 4 rotaciones, con y sin espejo; sin cables. */
export function docRotados(): Documento {
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
export function docCables(): Documento {
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

/**
 * Textos con comillas, \, saltos, tab, control, tildes, ñ, una tilde combinada
 * (e + U+0301, escrita como escape para que ningún editor la normalice) y un emoji.
 */
export const RAROS = 'Dijo "hola" \\ fin\nlínea\ttab ñandú é\u0001 🔌';

export function docTextos(): Documento {
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
export function docComandos(): { doc: Documento; pasos: { nombre: string; doc: Documento }[] } {
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

/** Los documentos de la ida y vuelta (T15a etapa 1, y la marcha-parada de T15), con su nombre. */
export function documentosDePrueba(): [string, Documento][] {
  return [
    ["vacío", crearDocumento({ titulo: "", autor: "", fecha: "" })],
    ["rotados y espejados", docRotados()],
    ["cables, T, libres y contadores", docCables()],
    ["textos raros", docTextos()],
    ["girado y espejado con comandos", docComandos().doc],
    ["marcha-parada", marchaParada().doc],
    ["marcha-parada con dos N", marchaParada({ dosNeutros: true }).doc],
  ];
}
