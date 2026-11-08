import { describe, expect, it } from "vitest";
import { SIMBOLOS, buscarSimbolo, transformarBornes, transformarDireccion } from "../symbols";
import type { Direccion, Rotacion } from "../symbols/tipos";
import {
  Borrar,
  CambiarEtiqueta,
  Colocar,
  Espejar,
  Grupo,
  Mover,
  Rotar,
  colocar,
  type Comando,
} from "./comandos";
import { buscarComponente, crearDocumento, type Componente, type Documento } from "./documento";

const meta = { titulo: "Prueba", autor: "Bruno Jerke", fecha: "2026-11-08" };
const ROTACIONES: Rotacion[] = [0, 90, 180, 270];

/** Copia profunda (sin `structuredClone`: el núcleo no tiene tipos de DOM ni de Node). */
function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function datos(tipo: string, x: number, y: number, rot: Rotacion = 0, espejado = false): Omit<Componente, "id"> {
  return { tipo, x, y, rot, espejado, etiqueta: "", params: {} };
}

/** Documento con los componentes en esas posiciones, rotaciones y espejados variados. */
function docCon(posiciones: readonly (readonly [number, number])[]): Documento {
  const doc = crearDocumento(meta);
  posiciones.forEach(([x, y], i) => {
    const tipo = SIMBOLOS[i % SIMBOLOS.length]!.tipo;
    colocar(doc, datos(tipo, x, y, ROTACIONES[i % 4]!, i % 2 === 1)).aplicar(doc);
  });
  return doc;
}

/** Los 7 símbolos, uno de cada uno, con params para ver que se copian. */
function docBase(): Documento {
  const doc = docCon(SIMBOLOS.map((_, i) => [i * 4, (i % 3) * 5] as const));
  doc.hojas[0]!.componentes[0]!.params = { tension: "230" };
  return doc;
}

function ids(doc: Documento): string[] {
  return doc.hojas.flatMap((h) => h.componentes.map((c) => c.id));
}

interface BorneEnHoja {
  id: string;
  nombre: string;
  x: number;
  y: number;
  direccion: Direccion;
}

/** Bornes de todos los componentes, en coordenadas de la hoja. */
function bornesEnHoja(doc: Documento): BorneEnHoja[] {
  return doc.hojas.flatMap((h) =>
    h.componentes.flatMap((c) =>
      transformarBornes(buscarSimbolo(c.tipo)!.bornes, { rotacion: c.rot, espejado: c.espejado }).map((b) => ({
        id: c.id,
        nombre: b.nombre,
        x: c.x + b.x,
        y: c.y + b.y,
        direccion: b.direccion,
      })),
    ),
  );
}

function coordenadasEnteras(doc: Documento): boolean {
  const enteras = (v: number) => Number.isInteger(v) && !Object.is(v, -0);
  return (
    doc.hojas.every((h) => h.componentes.every((c) => enteras(c.x) && enteras(c.y))) &&
    bornesEnHoja(doc).every((b) => enteras(b.x) && enteras(b.y))
  );
}

/** Rota un vector 90° k veces en sentido horario (y hacia abajo). */
function rotarVector(x: number, y: number, k: number): [number, number] {
  let [rx, ry] = [x, y];
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) [rx, ry] = [-ry, rx];
  return [rx + 0, ry + 0];
}

// ── Aplicar, deshacer y rehacer ────────────────────────────────────────────

const CASOS: [string, (doc: Documento) => Comando][] = [
  ["Colocar", (doc) => colocar(doc, datos("contactor.bobina", 7, -3, 90, true))],
  ["Mover", () => new Mover(["c1", "c3", "c6"], 2, -3)],
  ["Rotar +90 (grupo)", () => new Rotar(["c1", "c2", "c5"], 90)],
  ["Rotar −90 (uno)", () => new Rotar(["c4"], -90)],
  ["Espejar (grupo)", () => new Espejar(["c2", "c3", "c4"])],
  ["Borrar", () => new Borrar(["c5", "c2"])],
  ["CambiarEtiqueta", () => new CambiarEtiqueta("c3", "K1")],
  [
    "Grupo",
    (doc) => {
      const nuevo = colocar(doc, datos("pulsador.na", 1, 1));
      return new Grupo([nuevo, new Mover([nuevo.id, "c1"], -4, 2), new Rotar([nuevo.id], 90), new Borrar(["c6"])]);
    },
  ],
];

describe("comandos: aplicar, deshacer y rehacer", () => {
  it.each(CASOS)("%s: deshacer deja el documento igual y rehacer reproduce el resultado", (_, crear) => {
    const doc = docBase();
    const cmd = crear(doc);
    // La copia va después de construir: el contador ya subió y deshacer no lo baja.
    const antes = copia(doc);
    cmd.aplicar(doc);
    const despues = copia(doc);
    expect(doc).not.toEqual(antes);
    expect(coordenadasEnteras(doc)).toBe(true);

    cmd.deshacer(doc);
    expect(doc).toEqual(antes);
    cmd.aplicar(doc);
    expect(doc).toEqual(despues);
    cmd.deshacer(doc);
    expect(doc).toEqual(antes);
  });

  it("cada comando informa los ids que tocó", () => {
    const doc = docBase();
    expect(new Mover(["c1", "c1", "c2"], 1, 0).aplicar(doc)).toEqual({ componentes: ["c1", "c2"] });
    expect(new CambiarEtiqueta("c3", "S1").aplicar(doc)).toEqual({ componentes: ["c3"] });
    const grupo = new Grupo([new Mover(["c1"], 1, 0), new Rotar(["c1", "c4"], 90)]);
    expect(grupo.aplicar(doc)).toEqual({ componentes: ["c1", "c4"] });
    expect(grupo.deshacer(doc)).toEqual({ componentes: ["c1", "c4"] });
  });
});

// ── Ids estables ───────────────────────────────────────────────────────────

describe("ids estables", () => {
  it("colocar fija el id al construir; deshacer y rehacer lo conservan", () => {
    const doc = crearDocumento(meta);
    const cmd = colocar(doc, datos("senalizacion.lampara", 0, 0));
    expect(cmd.id).toBe("c1");
    expect(ids(doc)).toEqual([]);
    cmd.aplicar(doc);
    cmd.deshacer(doc);
    cmd.aplicar(doc);
    expect(ids(doc)).toEqual(["c1"]);
  });

  it("deshacer un Colocar no baja el contador: el próximo id es nuevo", () => {
    const doc = crearDocumento(meta);
    const cmd = colocar(doc, datos("senalizacion.lampara", 0, 0));
    cmd.aplicar(doc);
    cmd.deshacer(doc);
    expect(colocar(doc, datos("senalizacion.lampara", 0, 0)).id).toBe("c2");
  });

  it("rehacer un Colocar arranca del componente original, aunque se lo haya movido", () => {
    const doc = crearDocumento(meta);
    const cmd = colocar(doc, datos("senalizacion.lampara", 3, 4));
    cmd.aplicar(doc);
    buscarComponente(doc, cmd.id)!.x = 99; // un Mover ya deshecho, por ejemplo
    cmd.deshacer(doc);
    cmd.aplicar(doc);
    expect(buscarComponente(doc, cmd.id)!.x).toBe(3);
  });

  it("Borrar → deshacer → rehacer: mismo id, y deshacer lo devuelve a su lugar", () => {
    const doc = docBase();
    const cmd = new Borrar(["c3"]);
    cmd.aplicar(doc);
    expect(buscarComponente(doc, "c3")).toBeUndefined();
    cmd.deshacer(doc);
    expect(ids(doc)).toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7"]);
    cmd.aplicar(doc);
    expect(ids(doc)).toEqual(["c1", "c2", "c4", "c5", "c6", "c7"]);
  });

  it("Borrar varios, en varias hojas, devuelve cada uno a su hoja y a su orden", () => {
    const doc = docBase();
    doc.hojas.push({ nombre: "Hoja 2", componentes: [], cables: [] });
    colocar(doc, datos("pulsador.na", 0, 0), 1).aplicar(doc);
    colocar(doc, datos("pulsador.nc", 0, 4), 1).aplicar(doc);
    const antes = copia(doc);
    const cmd = new Borrar(["c9", "c4", "c1", "c6", "c8"]);
    cmd.aplicar(doc);
    expect(doc.hojas.map((h) => h.componentes.map((c) => c.id))).toEqual([["c2", "c3", "c5", "c7"], []]);
    cmd.deshacer(doc);
    expect(doc).toEqual(antes);
  });
});

// ── Rotar ──────────────────────────────────────────────────────────────────

/** Grupos por paridad del ancho y el alto de la caja de posiciones. */
const GRUPOS: [string, [number, number][]][] = [
  ["uno solo", [[5, -3]]],
  ["par×par", [[0, 0], [4, 2], [2, -2]]],
  ["impar×impar", [[0, 0], [3, 5], [1, 2]]],
  ["impar×par", [[0, 0], [3, 0], [1, 4]]],
  ["par×impar", [[0, 0], [2, 3], [1, 1]]],
  ["impar×par, los 7 símbolos", [[0, 0], [3, 0], [1, 4], [2, 2], [0, 4], [3, 1], [1, 1]]],
];

/** Desplazamientos: positivos, negativos y de paridad distinta. */
const DESPLAZAMIENTOS: [number, number][] = [
  [0, 0],
  [-11, -6],
  [-10, -7],
  [7, -13],
];

function casosGrupo(): [string, [number, number][]][] {
  return GRUPOS.flatMap(([nombre, pos]) =>
    DESPLAZAMIENTOS.map(([ox, oy]): [string, [number, number][]] => [
      `${nombre} en (${ox}, ${oy})`,
      pos.map(([x, y]): [number, number] => [x + ox, y + oy]),
    ]),
  );
}

describe("Rotar", () => {
  it("uno solo rota en su lugar", () => {
    const doc = docCon([[5, -3]]);
    new Rotar(["c1"], 90).aplicar(doc);
    expect(buscarComponente(doc, "c1")).toMatchObject({ x: 5, y: -3, rot: 90 });
  });

  it("de a pasos de ±90 suma o resta a rot, con y sin espejado", () => {
    for (const espejado of [false, true]) {
      const doc = crearDocumento(meta);
      colocar(doc, datos("pulsador.na", 0, 0, 0, espejado)).aplicar(doc);
      const rots: number[] = [];
      for (const s of [90, 90, 90, 90, -90, -90] as const) {
        new Rotar(["c1"], s).aplicar(doc);
        rots.push(buscarComponente(doc, "c1")!.rot);
      }
      expect(rots).toEqual([90, 180, 270, 0, 270, 180]);
      expect(buscarComponente(doc, "c1")!.espejado).toBe(espejado);
    }
  });

  it.each(casosGrupo())(
    "%s: todos los bornes quedan enteros y el grupo gira entero, sin deformarse",
    (_, posiciones) => {
      for (const sentido of [90, -90] as const) {
        for (let pasos = 1; pasos <= 3; pasos++) {
          const doc = docCon(posiciones);
          const antes = bornesEnHoja(doc);
          const todos = ids(doc);
          for (let i = 0; i < pasos; i++) new Rotar(todos, sentido).aplicar(doc);
          const despues = bornesEnHoja(doc);
          expect(coordenadasEnteras(doc)).toBe(true);

          // Cada borne es el de antes rotado 90°·k más una misma traslación para todos.
          const k = sentido === 90 ? pasos : -pasos;
          const giro = { rotacion: ((((k % 4) + 4) % 4) * 90) as Rotacion, espejado: false };
          const [r0x, r0y] = rotarVector(antes[0]!.x, antes[0]!.y, k);
          const tx = despues[0]!.x - r0x;
          const ty = despues[0]!.y - r0y;
          const esperados = antes.map((b) => {
            const [rx, ry] = rotarVector(b.x, b.y, k);
            return { ...b, x: rx + tx, y: ry + ty, direccion: transformarDireccion(b.direccion, giro) };
          });
          expect(despues).toEqual(esperados);
        }
      }
    },
  );

  it.each(casosGrupo())("%s: girar y volver deja el grupo exactamente igual (sin corrimiento)", (_, posiciones) => {
    const secuencias: [string, (todos: string[]) => Comando[]][] = [
      ["4 × (+90)", (t) => [90, 90, 90, 90].map((s) => new Rotar(t, s as 90))],
      ["4 × (−90)", (t) => [-90, -90, -90, -90].map((s) => new Rotar(t, s as -90))],
      ["+90, −90", (t) => [new Rotar(t, 90), new Rotar(t, -90)]],
      ["−90, +90", (t) => [new Rotar(t, -90), new Rotar(t, 90)]],
      ["+90, +90, −90, −90", (t) => [new Rotar(t, 90), new Rotar(t, 90), new Rotar(t, -90), new Rotar(t, -90)]],
      ["+90, espejar, +90, espejar", (t) => [new Rotar(t, 90), new Espejar(t), new Rotar(t, 90), new Espejar(t)]],
    ];
    for (const [nombre, armar] of secuencias) {
      const doc = docCon(posiciones);
      const original = copia(doc);
      for (const cmd of armar(ids(doc))) cmd.aplicar(doc);
      expect(doc, nombre).toEqual(original);
    }
  });
});

// ── Espejar ────────────────────────────────────────────────────────────────

describe("Espejar", () => {
  it.each(casosGrupo())("%s: los bornes quedan espejados en pantalla y enteros", (_, posiciones) => {
    const doc = docCon(posiciones);
    const xs = posiciones.map(([x]) => x);
    const suma = Math.min(...xs) + Math.max(...xs);
    const antes = bornesEnHoja(doc);
    new Espejar(ids(doc)).aplicar(doc);
    expect(coordenadasEnteras(doc)).toBe(true);
    const opuesta: Partial<Record<Direccion, Direccion>> = { izquierda: "derecha", derecha: "izquierda" };
    expect(bornesEnHoja(doc)).toEqual(
      antes.map((b) => ({ ...b, x: suma - b.x + 0, direccion: opuesta[b.direccion] ?? b.direccion })),
    );
  });

  it("espejar dos veces vuelve al original", () => {
    const doc = docBase();
    const original = copia(doc);
    new Espejar(ids(doc)).aplicar(doc);
    new Espejar(ids(doc)).aplicar(doc);
    expect(doc).toEqual(original);
  });
});

// ── Errores ────────────────────────────────────────────────────────────────

describe("errores: el documento no cambia", () => {
  const INVALIDOS: [string, (doc: Documento) => Comando][] = [
    ["Mover con un id inexistente", () => new Mover(["c1", "c99"], 1, 1)],
    ["Rotar con un id inexistente", () => new Rotar(["c2", "c99"], 90)],
    ["Espejar con un id inexistente", () => new Espejar(["c2", "c99"])],
    ["Borrar con un id inexistente", () => new Borrar(["c2", "c99"])],
    ["CambiarEtiqueta con un id inexistente", () => new CambiarEtiqueta("c99", "K9")],
    ["Colocar un id que ya existe", (doc) => new Colocar(copia(doc.hojas[0]!.componentes[0]!))],
    ["Colocar en una hoja inexistente", (doc) => colocar(doc, datos("pulsador.na", 0, 0), 5)],
    ["un Grupo cuyo segundo comando falla", () => new Grupo([new Mover(["c1"], 3, 0), new Mover(["c99"], 1, 0)])],
  ];

  it.each(INVALIDOS)("%s", (_, crear) => {
    const doc = docBase();
    const cmd = crear(doc);
    const antes = copia(doc);
    expect(() => cmd.aplicar(doc)).toThrow(Error);
    expect(doc).toEqual(antes);
  });

  it("coordenadas no enteras: se rechazan al construir, sin gastar un id", () => {
    const doc = docBase();
    const antes = copia(doc);
    expect(() => new Mover(["c1"], 0.5, 0)).toThrow(RangeError);
    expect(() => new Mover(["c1"], 0, Number.NaN)).toThrow(RangeError);
    expect(() => colocar(doc, datos("pulsador.na", 1.5, 0))).toThrow(RangeError);
    expect(() => new Colocar({ ...datos("pulsador.na", 0, 2.5), id: "c50" })).toThrow(RangeError);
    expect(doc).toEqual(antes);
  });

  it("sin ids: se rechaza al construir", () => {
    expect(() => new Mover([], 1, 0)).toThrow(Error);
    expect(() => new Rotar([], 90)).toThrow(Error);
    expect(() => new Espejar([])).toThrow(Error);
    expect(() => new Borrar([])).toThrow(Error);
  });

  it("deshacer algo que no se aplicó tira un error", () => {
    const doc = docBase();
    expect(() => new Rotar(["c1"], 90).deshacer(doc)).toThrow(Error);
    expect(() => new Borrar(["c1"]).deshacer(doc)).toThrow(Error);
    expect(() => new CambiarEtiqueta("c1", "K1").deshacer(doc)).toThrow(Error);
  });
});
