import { describe, expect, it } from "vitest";
import { buscarSimbolo, transformarBornes, transformarDireccion } from "../symbols";
import type { Direccion, Rotacion } from "../symbols/tipos";
import {
  borneDe,
  componentesCableados,
  indexarHoja,
  nodoExtremo,
  recorridoCable,
  seApoyaEn,
  validarCable,
  validarHoja,
} from "./cables";
import { Borrar, Cablear, Espejar, Mover, Rotar, cablear, colocar, type DatosCable } from "./comandos";
import { crearDocumento, type Cable, type Componente, type Documento, type Extremo } from "./documento";

const meta = { titulo: "Cables", autor: "Bruno Jerke", fecha: "2026-11-08" };

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function datos(tipo: string, x: number, y: number, rot: Rotacion = 0, espejado = false): Omit<Componente, "id"> {
  return { tipo, x, y, rot, espejado, etiqueta: "", params: {} };
}

const borne = (comp: string, b: string): Extremo => ({ tipo: "borne", comp, borne: b });
const libre = (x: number, y: number): Extremo => ({ tipo: "libre", x, y });
const enCable = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });

/** Coloca y aplica; devuelve el id. */
function poner(doc: Documento, d: Omit<Componente, "id">): string {
  const c = colocar(doc, d);
  c.aplicar(doc);
  return c.id;
}

/** Cablea y aplica; devuelve el id. */
function tender(doc: Documento, d: DatosCable): string {
  const c = cablear(doc, d);
  c.aplicar(doc);
  return c.id;
}

/** Problemas del cable `d` si se agregara a la hoja 0 (sin agregarlo). */
function problemas(doc: Documento, d: DatosCable): string[] {
  const hoja = doc.hojas[0]!;
  const w: Cable = { id: "wx", ...d };
  return validarCable(indexarHoja({ ...hoja, cables: [...hoja.cables, w] }), w).map((p) => p.mensaje);
}

/**
 * Bobina c1 en (0, 0): A1 (0, −2), A2 (0, 2). Pulsador NA c2 en (10, 0): 13
 * (10, −2), 14 (10, 2).
 */
function docBase(): Documento {
  const doc = crearDocumento(meta);
  poner(doc, datos("contactor.bobina", 0, 0));
  poner(doc, datos("pulsador.na", 10, 0));
  return doc;
}

describe("validarCable", () => {
  it("acepta un cable recto entre dos bornes y uno con codos", () => {
    const doc = docBase();
    expect(problemas(doc, { desde: borne("c1", "A1"), hasta: borne("c2", "13"), codos: [] })).toEqual([]);
    expect(problemas(doc, { desde: borne("c1", "A2"), hasta: borne("c2", "13"), codos: [[0, 4], [5, 4], [5, -2]] })).toEqual([]);
  });

  it("rechaza referencias que no existen", () => {
    const doc = docBase();
    poner(doc, datos("tipo.inventado", 30, 0));
    expect(problemas(doc, { desde: borne("c9", "A1"), hasta: libre(0, 5), codos: [] })[0]).toMatch(/no existe el componente "c9"/);
    expect(problemas(doc, { desde: borne("c1", "A3"), hasta: libre(0, 5), codos: [] })[0]).toMatch(/no tiene el borne "A3"/);
    expect(problemas(doc, { desde: borne("c3", "A1"), hasta: libre(0, 5), codos: [] })[0]).toMatch(/no está en la biblioteca/);
    expect(problemas(doc, { desde: enCable("w9", 0, 0), hasta: libre(0, 5), codos: [] })[0]).toMatch(/no existe el cable "w9"/);
  });

  it("rechaza los dos extremos en el mismo borne; dos bornes del mismo componente (puente) valen", () => {
    const doc = docBase();
    expect(problemas(doc, { desde: borne("c1", "A1"), hasta: borne("c1", "A1"), codos: [[-3, -2]] }).join()).toMatch(/mismo borne/);
    expect(problemas(doc, { desde: borne("c1", "A1"), hasta: borne("c1", "A2"), codos: [[-3, -2], [-3, 2]] })).toEqual([]);
  });

  it("rechaza puntos no enteros, tramos en diagonal, largo cero y vueltas de 180°", () => {
    const doc = docBase();
    const d = (codos: [number, number][], hasta: Extremo = borne("c2", "13")): DatosCable => ({ desde: borne("c1", "A1"), hasta, codos });
    expect(problemas(doc, d([[0.5, -2]])).join()).toMatch(/no es entero/);
    expect(problemas(doc, d([], libre(3.5, -2))).join()).toMatch(/no es entero/);
    expect(problemas(doc, d([], borne("c2", "14"))).join()).toMatch(/ni vertical/);
    expect(problemas(doc, d([[0, -2]])).join()).toMatch(/largo cero/);
    expect(problemas(doc, d([[6, -2], [4, -2]])).join()).toMatch(/vuelve sobre el anterior/);
    // Un punto en el medio de una recta (colineal) no es un error.
    expect(problemas(doc, d([[4, -2]]))).toEqual([]);
  });

  it("una T tiene que caer sobre el otro cable, que no puede ser él mismo", () => {
    const doc = docBase();
    tender(doc, { desde: borne("c1", "A1"), hasta: borne("c2", "13"), codos: [] }); // w1, y = −2
    expect(problemas(doc, { desde: enCable("w1", 5, -2), hasta: libre(5, -8), codos: [] })).toEqual([]);
    // En un extremo del otro cable también vale.
    expect(problemas(doc, { desde: enCable("w1", 10, -2), hasta: libre(10, -8), codos: [] })).toEqual([]);
    expect(problemas(doc, { desde: enCable("w1", 5, -1), hasta: libre(5, -8), codos: [] }).join()).toMatch(/no está sobre "w1"/);
    expect(problemas(doc, { desde: enCable("wx", 5, -2), hasta: libre(5, -8), codos: [] }).join()).toMatch(/sobre sí mismo/);
  });

  it("validarHoja informa ids repetidos sin tirar", () => {
    const doc = docBase();
    doc.hojas[0]!.cables.push({ id: "c1", desde: libre(0, 9), hasta: libre(4, 9), codos: [] });
    expect(validarHoja(doc.hojas[0]!).map((p) => p.mensaje)).toEqual(['El id "c1" está repetido.']);
  });
});

describe("bornes en las 8 orientaciones", () => {
  const VECTOR: Record<Direccion, [number, number]> = { derecha: [1, 0], izquierda: [-1, 0], abajo: [0, 1], arriba: [0, -1] };
  for (const rot of [0, 90, 180, 270] as Rotacion[]) {
    for (const espejado of [false, true]) {
      it(`${rot}°${espejado ? " espejado" : ""}: el cable sale del borne transformado, en su dirección`, () => {
        const doc = crearDocumento(meta);
        const id = poner(doc, datos("contactor.bobina", 20, 30, rot, espejado));
        const def = buscarSimbolo("contactor.bobina")!;
        const t = { rotacion: rot, espejado };
        for (const [i, b] of transformarBornes(def.bornes, t).entries()) {
          const x = b.x + 20;
          const y = b.y + 30;
          const colocado = borneDe(doc.hojas[0]!.componentes[0]!, b.nombre)!;
          expect(colocado).toEqual({ nombre: b.nombre, x, y, direccion: transformarDireccion(def.bornes[i]!.direccion, t) });
          // Un cable recto de 3 unidades en la dirección del borne es válido y empieza en él.
          const [vx, vy] = VECTOR[colocado.direccion];
          const w = tender(doc, { desde: borne(id, b.nombre), hasta: libre(x + 3 * vx, y + 3 * vy), codos: [] });
          const hoja = doc.hojas[0]!;
          expect(recorridoCable(indexarHoja(hoja), hoja.cables.find((k) => k.id === w)!)).toEqual([x, y, x + 3 * vx, y + 3 * vy]);
        }
        expect(validarHoja(doc.hojas[0]!)).toEqual([]);
      });
    }
  }
});

describe("Cablear", () => {
  it("da el id al construir; aplicar y deshacer deja el documento igual; rehacer, igual que aplicar", () => {
    const doc = docBase();
    const antes = copia(doc.hojas);
    const c = cablear(doc, { desde: borne("c1", "A1"), hasta: borne("c2", "13"), codos: [] });
    expect(c.id).toBe("w1");
    expect(doc.contadores.w).toBe(2);
    expect(c.aplicar(doc)).toEqual({ componentes: [], cables: ["w1"] });
    const despues = copia(doc.hojas);
    expect(c.deshacer(doc)).toEqual({ componentes: [], cables: ["w1"] });
    expect(doc.hojas).toEqual(antes);
    c.aplicar(doc);
    expect(doc.hojas).toEqual(despues);
  });

  it("un cable inválido tira y no cambia nada", () => {
    const doc = docBase();
    const antes = copia(doc);
    expect(() => new Cablear({ id: "w5", desde: borne("c1", "A9"), hasta: libre(0, 5), codos: [] }).aplicar(doc)).toThrow(/A9/);
    expect(() => cablear(doc, { desde: libre(0.5, 0), hasta: libre(0, 5), codos: [] })).toThrow(RangeError);
    expect(doc).toEqual(antes); // tampoco gastó un id
  });

  it("no copia lo que recibe: cambiar los datos después no toca el documento", () => {
    const doc = docBase();
    const d: DatosCable = { desde: borne("c1", "A1"), hasta: borne("c2", "13"), codos: [[4, -2]] };
    cablear(doc, d).aplicar(doc);
    d.codos[0]![0] = 99;
    expect(doc.hojas[0]!.cables[0]!.codos).toEqual([[4, -2]]);
  });
});

/**
 * Hoja con todas las combinaciones: c1 bobina (0, 0), c2 pulsador (10, 0),
 * c3 lámpara (20, 0), c4 bobina (40, 0) sin cables.
 * - w1: c1.A1 → c2.13, recto.
 * - w2: puente de c3, X1 → X2, por la izquierda.
 * - w3: T sobre w1 en (5, −2) → libre (5, −8).
 * - w4: c2.14 → c3.X2, recto.
 * - w5: libre → libre.
 * - w6: T sobre w3 en (5, −6) → c1.A2, con codos.
 * - w7: c1.A2 → libre: dos cables en el mismo borne.
 */
function docCombinado(): Documento {
  const doc = crearDocumento(meta);
  poner(doc, datos("contactor.bobina", 0, 0));
  poner(doc, datos("pulsador.na", 10, 0));
  poner(doc, datos("senalizacion.lampara", 20, 0));
  poner(doc, datos("contactor.bobina", 40, 0));
  tender(doc, { desde: borne("c1", "A1"), hasta: borne("c2", "13"), codos: [] });
  tender(doc, { desde: borne("c3", "X1"), hasta: borne("c3", "X2"), codos: [[17, -2], [17, 2]] });
  tender(doc, { desde: enCable("w1", 5, -2), hasta: libre(5, -8), codos: [] });
  tender(doc, { desde: borne("c2", "14"), hasta: borne("c3", "X2"), codos: [] });
  tender(doc, { desde: libre(30, 0), hasta: libre(30, 5), codos: [] });
  tender(doc, { desde: enCable("w3", 5, -6), hasta: borne("c1", "A2"), codos: [[-3, -6], [-3, 2]] });
  tender(doc, { desde: borne("c1", "A2"), hasta: libre(0, 6), codos: [] });
  return doc;
}

describe("Borrar con cables", () => {
  it("la hoja combinada es válida", () => {
    expect(validarHoja(docCombinado().hojas[0]!)).toEqual([]);
  });

  it("borrar un componente suelta sus cables en el punto del borne; deshacer y rehacer, exactos", () => {
    const doc = docCombinado();
    const antes = copia(doc);
    const b = new Borrar(["c1"]);
    const cambio = b.aplicar(doc);
    expect(cambio.componentes).toEqual(["c1"]);
    expect(cambio.cables.sort()).toEqual(["w1", "w6", "w7"]);
    const hoja = doc.hojas[0]!;
    const w = (id: string) => hoja.cables.find((k) => k.id === id)!;
    expect(w("w1").desde).toEqual(libre(0, -2));
    expect(w("w1").hasta).toEqual(borne("c2", "13"));
    expect(w("w6").hasta).toEqual(libre(0, 2));
    expect(w("w7").desde).toEqual(libre(0, 2));
    // Nada se borró además de c1.
    expect(hoja.cables.map((k) => k.id)).toEqual(["w1", "w2", "w3", "w4", "w5", "w6", "w7"]);
    const borrado = copia(doc);
    b.deshacer(doc);
    expect(doc).toEqual(antes);
    b.aplicar(doc);
    expect(doc).toEqual(borrado);
  });

  it("borrar un cable suelta las T que llegan a él", () => {
    const doc = docCombinado();
    const antes = copia(doc);
    const b = new Borrar(["w1"]);
    expect(b.aplicar(doc)).toEqual({ componentes: [], cables: ["w1", "w3"] });
    expect(doc.hojas[0]!.cables.find((k) => k.id === "w3")!.desde).toEqual(libre(5, -2));
    b.deshacer(doc);
    expect(doc).toEqual(antes);
  });

  it("ids mezclados, en cualquier orden, en un solo paso", () => {
    const doc = docCombinado();
    const antes = copia(doc);
    const b = new Borrar(["w4", "c3", "w1", "c2"]);
    b.aplicar(doc);
    const hoja = doc.hojas[0]!;
    expect(hoja.componentes.map((c) => c.id)).toEqual(["c1", "c4"]);
    expect(hoja.cables.map((c) => c.id)).toEqual(["w2", "w3", "w5", "w6", "w7"]);
    // El puente de c3 queda con los dos extremos libres, en sus bornes.
    expect(hoja.cables[0]).toMatchObject({ desde: libre(20, -2), hasta: libre(20, 2) });
    b.deshacer(doc);
    expect(doc).toEqual(antes);
  });

  it("un id que no existe tira y no cambia nada", () => {
    const doc = docCombinado();
    const antes = copia(doc);
    expect(() => new Borrar(["c1", "w99"]).aplicar(doc)).toThrow(/w99/);
    expect(doc).toEqual(antes);
  });

  it("después de borrar, deshacer y rehacer, la hoja sigue válida (todas las combinaciones)", () => {
    const base = docCombinado();
    const todos = [...base.hojas[0]!.componentes.map((c) => c.id), ...base.hojas[0]!.cables.map((w) => w.id)];
    const grupos: string[][] = [...todos.map((id) => [id])];
    for (let i = 0; i < todos.length; i++) for (let j = i + 1; j < todos.length; j++) grupos.push([todos[i]!, todos[j]!]);
    grupos.push(todos, ["c1", "c2", "c3"], ["w1", "w3", "w6"]);
    for (const ids of grupos) {
      const doc = docCombinado();
      const antes = copia(doc);
      const b = new Borrar(ids);
      b.aplicar(doc);
      expect(validarHoja(doc.hojas[0]!), `borrar ${ids}`).toEqual([]);
      const borrado = copia(doc);
      b.deshacer(doc);
      expect(doc, `deshacer ${ids}`).toEqual(antes);
      expect(validarHoja(doc.hojas[0]!)).toEqual([]);
      b.aplicar(doc);
      expect(doc, `rehacer ${ids}`).toEqual(borrado);
      expect(validarHoja(doc.hojas[0]!)).toEqual([]);
    }
  });
});

describe("transformar con cables (T14a)", () => {
  it("mover un componente cableado deja la hoja válida, y deshacer, igual", () => {
    const doc = docCombinado();
    const antes = copia(doc);
    const cmd = new Mover(["c2"], 0, 3);
    cmd.aplicar(doc);
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
    cmd.deshacer(doc);
    expect(doc).toEqual(antes);
  });

  it("un componente sin cables se sigue moviendo", () => {
    const doc = docCombinado();
    new Mover(["c4"], 2, 0).aplicar(doc);
    new Rotar(["c4"], 90).aplicar(doc);
    expect(doc.hojas[0]!.componentes[3]).toMatchObject({ x: 42, rot: 90 });
  });

  it("reciben ids de cables: uno suelto se mueve entero", () => {
    const doc = docCombinado();
    new Mover(["w5"], 1, 0).aplicar(doc);
    expect(doc.hojas[0]!.cables[4]).toMatchObject({ desde: libre(31, 0), hasta: libre(31, 5) });
    new Espejar(["w5"]).aplicar(doc);
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  });

  it("componentesCableados da los que tienen algún cable en un borne", () => {
    expect([...componentesCableados(docCombinado().hojas[0]!)].sort()).toEqual(["c1", "c2", "c3"]);
  });
});

describe("conexión (base de las redes de T15)", () => {
  /** Nodos a los que conecta cada cable de la hoja. */
  const nodos = (doc: Documento) =>
    Object.fromEntries(doc.hojas[0]!.cables.map((w) => [w.id, [nodoExtremo(w.desde), nodoExtremo(w.hasta)]]));

  it("dos cables que se cruzan no comparten nodo", () => {
    const doc = crearDocumento(meta);
    poner(doc, datos("contactor.bobina", 0, 0)); // c1: A1 (0, −2), A2 (0, 2)
    poner(doc, datos("pulsador.na", 10, 0)); // c2: 13 (10, −2), 14 (10, 2)
    // w1 baja por x = 5 y w2 cruza por y = 0: se cruzan en (5, 0), pero ningún extremo cae ahí.
    tender(doc, { desde: borne("c1", "A2"), hasta: borne("c2", "13"), codos: [[0, 4], [5, 4], [5, -2]] });
    tender(doc, { desde: borne("c1", "A1"), hasta: borne("c2", "14"), codos: [[0, -4], [3, -4], [3, 0], [8, 0], [8, 2]] });
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
    const n = nodos(doc);
    expect(n.w1).toEqual(["borne:c1:A2", "borne:c2:13"]);
    expect(n.w2).toEqual(["borne:c1:A1", "borne:c2:14"]);
    expect(n.w1!.some((k) => n.w2!.includes(k))).toBe(false);
  });

  it("una T conecta con su cable; dos extremos en el mismo borne dan el mismo nodo", () => {
    const n = nodos(docCombinado());
    expect(n.w3![0]).toBe("cable:w1");
    expect(n.w6![1]).toBe(n.w7![0]);
  });

  it("un extremo libre no conecta aunque caiga sobre un borne o un cable", () => {
    const doc = docCombinado();
    new Borrar(["c1"]).aplicar(doc);
    // Se vuelve a poner una bobina en el mismo lugar: los extremos sueltos quedan sobre sus bornes.
    const id = poner(doc, datos("contactor.bobina", 0, 0));
    const hoja = doc.hojas[0]!;
    const w1 = hoja.cables.find((k) => k.id === "w1")!;
    expect(w1.desde).toEqual(libre(0, -2));
    expect(borneDe(hoja.componentes.find((c) => c.id === id)!, "A1")).toMatchObject({ x: 0, y: -2 });
    expect(nodoExtremo(w1.desde)).toBeNull();
    // Un extremo libre sobre un tramo de otro cable (w3 pasa por (5, −4)) tampoco.
    const w = tender(doc, { desde: libre(5, -4), hasta: libre(8, -4), codos: [] });
    expect(nodos(doc)[w]).toEqual([null, null]);
  });
});

describe("apoyos de T (T14c, D7-C)", () => {
  /** Índice con solo estos cables. */
  const indiceDe = (...cables: Cable[]) => indexarHoja({ nombre: "Hoja 1", componentes: [], cables });
  const w1: Cable = { id: "w1", desde: libre(0, 0), hasta: libre(10, 0), codos: [] };
  const w2: Cable = { id: "w2", desde: enCable("w1", 4, 0), hasta: libre(4, 6), codos: [] };
  const w3: Cable = { id: "w3", desde: enCable("w2", 4, 3), hasta: libre(8, 3), codos: [] };
  const w4: Cable = { id: "w4", desde: libre(0, 9), hasta: libre(10, 9), codos: [] };

  it("directo: la T se apoya en su anfitrión, no al revés", () => {
    const i = indiceDe(w1, w2);
    expect(seApoyaEn(i, "w2", "w1")).toBe(true);
    expect(seApoyaEn(i, "w1", "w2")).toBe(false);
  });

  it("cadena de 3: se apoya en el anfitrión de su anfitrión", () => {
    const i = indiceDe(w1, w2, w3);
    expect(seApoyaEn(i, "w3", "w1")).toBe(true);
    expect(seApoyaEn(i, "w3", "w2")).toBe(true);
    expect(seApoyaEn(i, "w1", "w3")).toBe(false);
    expect(seApoyaEn(i, "w2", "w3")).toBe(false);
  });

  it("sin relación: false", () => {
    const i = indiceDe(w1, w2, w3, w4);
    expect(seApoyaEn(i, "w3", "w4")).toBe(false);
    expect(seApoyaEn(i, "w4", "w1")).toBe(false);
    // Un cable solo no se apoya en sí mismo.
    expect(seApoyaEn(i, "w1", "w1")).toBe(false);
    expect(seApoyaEn(i, "w3", "w3")).toBe(false);
  });

  it("un anfitrión que no existe corta el camino, sin tirar", () => {
    const i = indiceDe(w2, w3);
    expect(seApoyaEn(i, "w3", "w2")).toBe(true);
    expect(seApoyaEn(i, "w3", "w1")).toBe(true);
    expect(seApoyaEn(i, "w2", "w4")).toBe(false);
    expect(seApoyaEn(i, "w9", "w1")).toBe(false);
  });

  it("una hoja que ya tiene un ciclo (de un .brn): termina", () => {
    const a: Cable = { id: "a", desde: enCable("c", 0, 0), hasta: libre(5, 0), codos: [] };
    const b: Cable = { id: "b", desde: enCable("a", 2, 0), hasta: libre(2, 5), codos: [] };
    // Solo cuentan los extremos: la geometría no se mira.
    const c: Cable = { id: "c", desde: enCable("b", 2, 3), hasta: libre(0, 3), codos: [] };
    const i = indiceDe(a, b, c);
    expect(seApoyaEn(i, "a", "a")).toBe(true);
    expect(seApoyaEn(i, "a", "w4")).toBe(false);
  });
});
