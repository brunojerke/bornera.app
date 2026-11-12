import { describe, expect, it } from "vitest";
import type { Rotacion } from "../symbols";
import { borneDe, indexarHoja, puntoSobreRecorrido, recorridoCable } from "./cables";
import { cablear, colocar } from "./comandos";
import { crearDocumento, type Componente, type Documento, type Extremo, type Hoja } from "./documento";
import { porNombre, redes, type BorneRed, type Red } from "./redes";

const meta = { titulo: "Redes", autor: "Bruno Jerke", fecha: "2026-11-12" };

function datos(tipo: string, x: number, y: number, etiqueta = "", rot: Rotacion = 0): Omit<Componente, "id"> {
  return { tipo, x, y, rot, espejado: false, etiqueta, params: {} };
}

function poner(doc: Documento, d: Omit<Componente, "id">): string {
  const c = colocar(doc, d);
  c.aplicar(doc);
  return c.id;
}

/** Cablea con el comando real (que valida la estructura al aplicar). */
function tender(doc: Documento, desde: Extremo, hasta: Extremo, codos: [number, number][] = []): string {
  const c = cablear(doc, { desde, hasta, codos });
  c.aplicar(doc);
  return c.id;
}

const borne = (comp: string, b: string): Extremo => ({ tipo: "borne", comp, borne: b });
const libre = (x: number, y: number): Extremo => ({ tipo: "libre", x, y });
const enCable = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });
const b = (comp: string, nombre: string): BorneRed => ({ comp, borne: nombre });
const red = (bornes: BorneRed[], cables: string[] = [], nombres: string[] = []): Red => ({ bornes, cables, nombres });

/** El recorrido del cable `id` pasa por (x, y). */
function pasaPor(hoja: Hoja, id: string, x: number, y: number): boolean {
  const indice = indexarHoja(hoja);
  const rec = recorridoCable(indice, indice.cables.get(id)!);
  return rec !== null && puntoSobreRecorrido(rec, x, y);
}

describe("redes por cables", () => {
  it("dos cables que se cruzan no se unen", () => {
    const doc = crearDocumento(meta);
    const k = poner(doc, datos("contactor.bobina", 0, 0)); // A1 (0, −2), A2 (0, 2)
    const s = poner(doc, datos("pulsador.na", 10, 0)); // 13 (10, −2), 14 (10, 2)
    const w1 = tender(doc, borne(k, "A2"), borne(s, "13"), [[0, 4], [5, 4], [5, -2]]);
    const w2 = tender(doc, borne(k, "A1"), borne(s, "14"), [[0, -4], [3, -4], [3, 0], [8, 0], [8, 2]]);
    const hoja = doc.hojas[0]!;
    // Se cruzan en (5, 0).
    expect(pasaPor(hoja, w1, 5, 0) && pasaPor(hoja, w2, 5, 0)).toBe(true);
    expect(redes(hoja)).toEqual([red([b(k, "A1"), b(s, "14")], [w2]), red([b(k, "A2"), b(s, "13")], [w1])]);
  });

  it("dos tramos encimados no se unen", () => {
    const doc = crearDocumento(meta);
    const k = poner(doc, datos("contactor.bobina", 0, 0));
    const s = poner(doc, datos("pulsador.na", 10, 0));
    const w1 = tender(doc, borne(k, "A1"), borne(s, "13"), [[0, -4], [10, -4]]);
    // w2 sube por x = 3, va encima de w1 por y = −4 hasta x = 8 y baja.
    const w2 = tender(doc, borne(k, "A2"), borne(s, "14"), [[0, 4], [3, 4], [3, -4], [8, -4], [8, 4], [10, 4]]);
    const hoja = doc.hojas[0]!;
    for (const x of [3, 5, 8]) expect(pasaPor(hoja, w1, x, -4) && pasaPor(hoja, w2, x, -4), `x = ${x}`).toBe(true);
    expect(redes(hoja)).toEqual([red([b(k, "A1"), b(s, "13")], [w1]), red([b(k, "A2"), b(s, "14")], [w2])]);
  });

  it("un extremo libre no se une, aunque caiga sobre un borne o sobre el tramo de otro cable", () => {
    const doc = crearDocumento(meta);
    const k = poner(doc, datos("contactor.bobina", 0, 0));
    const s = poner(doc, datos("pulsador.na", 10, 0));
    const w1 = tender(doc, libre(0, -2), libre(0, -6));
    const w2 = tender(doc, borne(k, "A2"), borne(s, "14"), [[0, 4], [10, 4]]);
    const w3 = tender(doc, libre(5, 4), libre(5, 8));
    const hoja = doc.hojas[0]!;
    expect(borneDe(hoja.componentes[0]!, "A1")).toMatchObject({ x: 0, y: -2 });
    expect(pasaPor(hoja, w2, 5, 4)).toBe(true);
    // Las redes sin bornes (cables sueltos) van al final.
    expect(redes(hoja)).toEqual([
      red([b(k, "A1")]),
      red([b(k, "A2"), b(s, "14")], [w2]),
      red([b(s, "13")]),
      red([], [w1]),
      red([], [w3]),
    ]);
  });

  it("un puente entre dos bornes del mismo componente los une", () => {
    const doc = crearDocumento(meta);
    const s = poner(doc, datos("pulsador.na", 0, 0)); // 13 (0, −2), 14 (0, 2)
    const w1 = tender(doc, borne(s, "13"), borne(s, "14"), [[0, -4], [4, -4], [4, 4], [0, 4]]);
    expect(redes(doc.hojas[0]!)).toEqual([red([b(s, "13"), b(s, "14")], [w1])]);
  });

  it("una T une con su anfitrión, también una T sobre otra T", () => {
    const doc = crearDocumento(meta);
    const k = poner(doc, datos("contactor.bobina", 0, 0));
    const s = poner(doc, datos("pulsador.na", 10, 0));
    const h = poner(doc, datos("senalizacion.lampara", 9, -9)); // X1 (9, −11), X2 (9, −7)
    const w1 = tender(doc, borne(k, "A1"), borne(s, "13"), [[0, -4], [10, -4]]);
    const w2 = tender(doc, enCable(w1, 5, -4), libre(5, -10));
    const w3 = tender(doc, enCable(w2, 5, -7), borne(h, "X2"));
    const hoja = doc.hojas[0]!;
    const antes = JSON.parse(JSON.stringify(hoja)) as Hoja;
    expect(redes(hoja)).toEqual([
      red([b(k, "A1"), b(s, "13"), b(h, "X2")], [w1, w2, w3]),
      red([b(k, "A2")]),
      red([b(s, "14")]),
      red([b(h, "X1")]),
    ]);
    // No toca la hoja.
    expect(hoja).toEqual(antes);
  });

  it("una T sobre un cable que viene después en la hoja también une", () => {
    // El orden de la lista no es el de creación: así puede llegar de un .brn.
    const hoja: Hoja = {
      nombre: "Hoja 1",
      componentes: [],
      cables: [
        { id: "w2", desde: enCable("w1", 5, 0), hasta: libre(5, 4), codos: [] },
        { id: "w1", desde: libre(0, 0), hasta: libre(10, 0), codos: [] },
      ],
    };
    expect(redes(hoja)).toEqual([red([], ["w2", "w1"])]);
  });

  it("un contacto no une sus dos bornes, ni una carga; un componente sin cables da una red por borne", () => {
    const doc = crearDocumento(meta);
    const s = poner(doc, datos("pulsador.na", 0, 0, "S1"));
    const k = poner(doc, datos("contactor.bobina", 10, 0, "K1"));
    const h = poner(doc, datos("senalizacion.lampara", 20, 0, "H1"));
    const w1 = tender(doc, borne(s, "13"), borne(k, "A1"), [[0, -4], [10, -4]]);
    const w2 = tender(doc, borne(s, "14"), borne(k, "A2"), [[0, 4], [10, 4]]);
    // La etiqueta de lo que no es una fuente no es nombre de red.
    expect(redes(doc.hojas[0]!)).toEqual([
      red([b(s, "13"), b(k, "A1")], [w1]),
      red([b(s, "14"), b(k, "A2")], [w2]),
      red([b(h, "X1")]),
      red([b(h, "X2")]),
    ]);
  });

  it("dos cables en un mismo borne unen", () => {
    const doc = crearDocumento(meta);
    const k = poner(doc, datos("contactor.bobina", 0, 0));
    const s = poner(doc, datos("pulsador.na", 10, 0));
    const w1 = tender(doc, borne(k, "A1"), borne(s, "13"), [[0, -4], [10, -4]]);
    const w2 = tender(doc, borne(k, "A1"), borne(s, "14"), [[-3, -2], [-3, 6], [10, 6]]);
    expect(redes(doc.hojas[0]!)).toEqual([red([b(k, "A1"), b(s, "13"), b(s, "14")], [w1, w2]), red([b(k, "A2")])]);
  });

  it("una hoja vacía no tiene redes", () => {
    expect(redes(crearDocumento(meta).hojas[0]!)).toEqual([]);
  });
});

describe("nombres de red", () => {
  it("Fase y Neutro dan su etiqueta normalizada; una etiqueta vacía no da nombre", () => {
    const doc = crearDocumento(meta);
    const l1 = poner(doc, datos("fuente.fase", 0, 0, "l1 "));
    const n = poner(doc, datos("fuente.neutro", 10, 0, "N"));
    const sin = poner(doc, datos("fuente.fase", 20, 0, "  "));
    const otraL1 = poner(doc, datos("fuente.fase", 30, 0, "L1"));
    const lista = redes(doc.hojas[0]!);
    expect(lista).toEqual([red([b(l1, "L")], [], ["L1"]), red([b(n, "N")], [], ["N"]), red([b(sin, "L")]), red([b(otraL1, "L")], [], ["L1"])]);
    expect(porNombre(lista)).toEqual(
      new Map([
        ["L1", [0, 3]],
        ["N", [1]],
      ]),
    );
    expect([...porNombre(lista).keys()]).toEqual(["L1", "N"]);
    // Unidas por nombre: las dos L1 en una; la fuente sin nombre queda sola.
    expect(redes(doc.hojas[0]!, { unirPorNombre: true })).toEqual([
      red([b(l1, "L"), b(otraL1, "L")], [], ["L1"]),
      red([b(n, "N")], [], ["N"]),
      red([b(sin, "L")]),
    ]);
  });

  it("una red con L y N cableadas tiene los dos nombres, y unir por nombre es transitivo", () => {
    const doc = crearDocumento(meta);
    const l = poner(doc, datos("fuente.fase", 0, 0, "L")); // borne en (0, 1)
    const n = poner(doc, datos("fuente.neutro", 10, 0, "N"));
    const l2 = poner(doc, datos("fuente.fase", 20, 0, "L"));
    const n2 = poner(doc, datos("fuente.neutro", 30, 0, "N"));
    const w1 = tender(doc, borne(l, "L"), borne(n, "N"), [[0, 3], [10, 3]]);
    const lista = redes(doc.hojas[0]!);
    expect(lista).toEqual([red([b(l, "L"), b(n, "N")], [w1], ["L", "N"]), red([b(l2, "L")], [], ["L"]), red([b(n2, "N")], [], ["N"])]);
    expect(porNombre(lista)).toEqual(
      new Map([
        ["L", [0, 1]],
        ["N", [0, 2]],
      ]),
    );
    // La red con L y N junta la otra L con el otro N.
    expect(redes(doc.hojas[0]!, { unirPorNombre: true })).toEqual([red([b(l, "L"), b(n, "N"), b(l2, "L"), b(n2, "N")], [w1], ["L", "N"])]);
  });

  it("sin nombres, porNombre está vacío y unir por nombre no cambia nada", () => {
    const doc = crearDocumento(meta);
    poner(doc, datos("pulsador.na", 0, 0));
    const hoja = doc.hojas[0]!;
    expect(porNombre(redes(hoja)).size).toBe(0);
    expect(redes(hoja, { unirPorNombre: true })).toEqual(redes(hoja));
  });
});

describe("documento roto", () => {
  it("lo que no existe no conecta, y no tira excepción", () => {
    // Armado a mano: Cablear no deja crear estas referencias. Solo pueden llegar de un archivo que no se validó.
    const hoja: Hoja = {
      nombre: "Hoja 1",
      componentes: [
        { id: "c1", ...datos("simbolo.desconocido", 0, 0) },
        { id: "c2", ...datos("contactor.bobina", 10, 0) },
      ],
      cables: [
        { id: "w1", desde: borne("c9", "A1"), hasta: borne("c2", "A1"), codos: [] },
        { id: "w2", desde: enCable("w99", 0, 0), hasta: libre(0, 5), codos: [] },
        { id: "w3", desde: borne("c2", "Z9"), hasta: libre(20, 5), codos: [] },
        { id: "w4", desde: borne("c1", "1"), hasta: libre(30, 5), codos: [] },
      ],
    };
    expect(() => redes(hoja)).not.toThrow();
    expect(redes(hoja)).toEqual([red([b("c2", "A1")], ["w1"]), red([b("c2", "A2")]), red([], ["w2"]), red([], ["w3"]), red([], ["w4"])]);
  });
});
