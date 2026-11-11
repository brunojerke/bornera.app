import { describe, expect, it } from "vitest";
import { Cablear, Espejar, Mover, Rotar, colocar } from "./comandos";
import { crearDocumento, type Documento, type Extremo } from "./documento";
import { uniones, unionEnPunto, puntosConectados } from "./uniones";
import { indexarHoja } from "./cables";

const meta = { titulo: "Uniones", autor: "Bruno Jerke", fecha: "2026-11-11" };
const borne = (comp: string, b: string): Extremo => ({ tipo: "borne", comp, borne: b });
const libre = (x: number, y: number): Extremo => ({ tipo: "libre", x, y });
const enCable = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Documento vacío; `bobina` pone una bobina c1 en (0, 0): A1 (0, −2), A2 (0, 2). */
function doc(bobina = false): Documento {
  const d = crearDocumento(meta);
  if (bobina) colocar(d, { tipo: "contactor.bobina", x: 0, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: {} }).aplicar(d);
  return d;
}

/** Agrega un cable con id fijo; `Cablear` lo valida. */
function tender(d: Documento, id: string, desde: Extremo, hasta: Extremo, codos: [number, number][] = []): void {
  new Cablear({ id, desde, hasta, codos }).aplicar(d);
}

const de = (d: Documento) => uniones(d.hojas[0]!);

describe("uniones", () => {
  it("una T da 1 unión, con el anfitrión y el que llega", () => {
    const d = doc();
    tender(d, "w1", libre(0, 0), libre(10, 0));
    tender(d, "w2", enCable("w1", 4, 0), libre(4, 5));
    expect(de(d)).toEqual([{ x: 4, y: 0, cables: ["w1", "w2"], componentes: [] }]);
  });

  it("una L da 0, suelta o entre dos bornes", () => {
    const d = doc(true);
    tender(d, "w1", libre(10, 0), libre(15, 5), [[15, 0]]);
    tender(d, "w2", borne("c1", "A1"), libre(6, -6), [[0, -6]]);
    expect(de(d)).toEqual([]);
  });

  it("un cruce de dos cables sin empalme da 0", () => {
    const d = doc();
    tender(d, "w1", libre(0, 0), libre(10, 0));
    tender(d, "w2", libre(5, -5), libre(5, 5));
    expect(de(d)).toEqual([]);
  });

  it("dos cables que terminan en el mismo borne dan 1, con el componente", () => {
    const d = doc(true);
    tender(d, "w1", borne("c1", "A1"), libre(0, -6));
    tender(d, "w2", libre(5, -2), borne("c1", "A1"));
    expect(de(d)).toEqual([{ x: 0, y: -2, cables: ["w1", "w2"], componentes: ["c1"] }]);
  });

  it("un cable solo en un borne da 0", () => {
    const d = doc(true);
    tender(d, "w1", borne("c1", "A1"), libre(0, -6));
    expect(de(d)).toEqual([]);
  });

  it("dos T enfrentadas sobre el mismo punto dan 1 (cruz con empalme)", () => {
    const d = doc();
    tender(d, "w1", libre(0, 0), libre(10, 0));
    tender(d, "w2", enCable("w1", 4, 0), libre(4, 5));
    tender(d, "w3", libre(4, -5), enCable("w1", 4, 0));
    expect(de(d)).toEqual([{ x: 4, y: 0, cables: ["w1", "w2", "w3"], componentes: [] }]);
  });

  it("una T sobre un codo del anfitrión da 1", () => {
    const d = doc();
    tender(d, "w1", libre(0, 0), libre(5, 5), [[5, 0]]);
    tender(d, "w2", enCable("w1", 5, 0), libre(10, 0));
    expect(de(d)).toEqual([{ x: 5, y: 0, cables: ["w1", "w2"], componentes: [] }]);
  });

  it("un extremo libre encima de un cable o de un borne no conecta: 0", () => {
    const d = doc(true);
    tender(d, "w1", libre(10, 0), libre(20, 0));
    tender(d, "w2", libre(14, 0), libre(14, 5));
    tender(d, "w3", borne("c1", "A1"), libre(0, -6));
    tender(d, "w4", libre(0, -2), libre(5, -2));
    expect(de(d)).toEqual([]);
  });

  it("un cable que pasa sobre un borne con cable no suma: no lo conecta nada", () => {
    const d = doc(true);
    tender(d, "w1", borne("c1", "A1"), libre(0, -6));
    tender(d, "w2", libre(-5, -2), libre(5, -2));
    expect(de(d)).toEqual([]);
  });

  it("lo que solo coincide en el lugar no se suma: la T cuenta sola, sin el borne", () => {
    const d = doc(true);
    // Borne A1 con un cable (2 brazos) y, en el mismo punto, una T sobre w2 que no lo toca (3).
    tender(d, "w1", borne("c1", "A1"), libre(0, -6));
    tender(d, "w2", libre(-5, -2), libre(5, -2));
    tender(d, "w3", enCable("w2", 0, -2), libre(0, 3));
    expect(de(d)).toEqual([{ x: 0, y: -2, cables: ["w2", "w3"], componentes: [] }]);
  });

  it("T en cadena: una unión por cada T", () => {
    const d = doc();
    tender(d, "w1", libre(0, -6), libre(20, -6));
    tender(d, "w2", enCable("w1", 4, -6), libre(4, -14));
    tender(d, "w3", enCable("w2", 4, -10), libre(10, -10));
    expect(de(d)).toEqual([
      { x: 4, y: -10, cables: ["w2", "w3"], componentes: [] },
      { x: 4, y: -6, cables: ["w1", "w2"], componentes: [] },
    ]);
  });

  // W no crea una T sobre el extremo de su anfitrión (T13) y T14a no la deja:
  // estos dos casos solo llegan desde un `.brn`. T15a los valida o los informa.
  describe("T sobre el extremo del anfitrión (solo desde un .brn)", () => {
    it("sobre un extremo libre: 2 brazos, no es unión (se ve como una L)", () => {
      const d = doc();
      tender(d, "w1", libre(0, 0), libre(10, 0));
      tender(d, "w2", enCable("w1", 10, 0), libre(10, 5));
      expect(de(d)).toEqual([]);
    });

    it("sobre un extremo en un borne: borne, anfitrión y T son 3, es unión", () => {
      const d = doc(true);
      tender(d, "w1", borne("c1", "A1"), libre(0, -8));
      tender(d, "w2", enCable("w1", 0, -2), libre(5, -2));
      expect(de(d)).toEqual([{ x: 0, y: -2, cables: ["w1", "w2"], componentes: ["c1"] }]);
    });
  });

  it("no cambia el documento y sigue los bornes de un componente girado", () => {
    const d = crearDocumento(meta);
    colocar(d, { tipo: "contactor.bobina", x: 0, y: 0, rot: 90, espejado: false, etiqueta: "", params: {} }).aplicar(d);
    // A 90°, A1 queda en (2, 0).
    tender(d, "w1", borne("c1", "A1"), libre(6, 0));
    tender(d, "w2", borne("c1", "A1"), libre(2, -5));
    const antes = copia(d);
    expect(de(d)).toEqual([{ x: 2, y: 0, cables: ["w1", "w2"], componentes: ["c1"] }]);
    expect(d).toEqual(antes);
  });

  it("Cambio.hojaEntera: con la hoja entera transformada, cada unión va a T(p); al deshacer, a la inversa", () => {
    const armar = () => {
      const d = doc(true);
      tender(d, "w1", borne("c1", "A1"), libre(0, -6));
      tender(d, "w2", libre(5, -2), borne("c1", "A1"));
      tender(d, "w3", libre(10, -6), libre(20, -6));
      tender(d, "w4", enCable("w3", 14, -6), libre(14, -2));
      return d;
    };
    for (const hacer of [
      () => new Rotar(["c1", "w1", "w2", "w3", "w4"], 90),
      () => new Rotar(["c1", "w1", "w2", "w3", "w4"], -90),
      () => new Espejar(["c1", "w1", "w2", "w3", "w4"]),
      () => new Mover(["c1", "w1", "w2", "w3", "w4"], 3, -2),
    ]) {
      const d = armar();
      const antes = de(d);
      const cmd = hacer();
      const c = cmd.aplicar(d);
      expect(c.hojaEntera).toBeDefined();
      const t = c.hojaEntera!;
      const movidas = antes.map((u) => ({ ...u, ...t(u.x, u.y) })).sort((a, b) => a.y - b.y || a.x - b.x);
      expect(de(d)).toEqual(movidas);
      const v = cmd.deshacer(d);
      expect(de(d)).toEqual(movidas.map((u) => ({ ...u, ...v.hojaEntera!(u.x, u.y) })).sort((a, b) => a.y - b.y || a.x - b.x));
      expect(de(d)).toEqual(antes);
    }
    // Sin un cable (o sin un componente), no es la hoja entera.
    expect(new Mover(["c1", "w1", "w2", "w3"], 3, -2).aplicar(armar()).hojaEntera).toBeUndefined();
    expect(new Mover(["w1", "w2", "w3", "w4"], 3, -2).aplicar(armar()).hojaEntera).toBeUndefined();
  });

  it("puntosConectados: solo los extremos en un borne o en T", () => {
    const d = doc(true);
    tender(d, "w1", libre(-5, -6), libre(5, -6));
    tender(d, "w2", borne("c1", "A1"), enCable("w1", 0, -6));
    tender(d, "w3", libre(10, 0), libre(10, 5));
    const indice = indexarHoja(d.hojas[0]!);
    const [w1, w2, w3] = d.hojas[0]!.cables;
    expect(puntosConectados(indice, w1!)).toEqual([]);
    expect(puntosConectados(indice, w2!)).toEqual([0, -2, 0, -6]);
    expect(puntosConectados(indice, w3!)).toEqual([]);
    expect(unionEnPunto(indice, [w2!], 0, -6)).toEqual({ x: 0, y: -6, cables: ["w1", "w2"], componentes: [] });
  });
});
