// Reconectar un extremo libre (T14c): el planificador y sus rechazos.

import { describe, expect, it } from "vitest";
import { indexarHoja, puntoSobreRecorrido, recorridoCable, validarHoja } from "./cables";
import { CambiarExtremo, Mover } from "./comandos";
import { crearDocumento, type Cable, type Componente, type Documento, type Extremo } from "./documento";
import {
  MENSAJE_APOYO_CICLO,
  MENSAJE_MISMO_ANFITRION,
  MENSAJE_SIN_LLEGADA,
  MENSAJE_SOBRE_SI_MISMO,
  MENSAJE_T_EN_EXTREMO,
  planearReconexion,
  type DestinoExtremo,
  type LadoCable,
} from "./reconectar";
import { entornoLineal } from "./seguir";
import { MENSAJE_CRUCE, MENSAJE_EXTREMO_SUELTO, MENSAJE_MISMO_BORNE, MENSAJE_SIN_LARGO, MENSAJE_SIN_SALIDAS } from "./trazado";

const meta = { titulo: "Reconectar", autor: "Bruno Jerke", fecha: "2026-11-11" };

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const borne = (comp: string, b: string): Extremo & DestinoExtremo => ({ tipo: "borne", comp, borne: b });
const libre = (x: number, y: number): Extremo => ({ tipo: "libre", x, y });
const enCable = (cable: string, x: number, y: number): Extremo & DestinoExtremo => ({ tipo: "cable", cable, x, y });

/** Bobina de contactor en (x, y): A1 en (x, y − 2) hacia arriba, A2 en (x, y + 2) hacia abajo; cuerpo de 2 × 4. */
const bobina = (id: string, x: number, y: number, etiqueta = id.toUpperCase()): Componente => ({
  id,
  tipo: "contactor.bobina",
  x,
  y,
  rot: 0,
  espejado: false,
  etiqueta,
  params: {},
});

const cable = (id: string, desde: Extremo, hasta: Extremo, codos: [number, number][] = []): Cable => ({ id, desde, hasta, codos });

/** Documento de una hoja con esos componentes y cables (válida). */
function docCon(componentes: Componente[], cables: Cable[]): Documento {
  const doc = crearDocumento(meta);
  doc.hojas[0]!.componentes.push(...componentes);
  doc.hojas[0]!.cables.push(...cables);
  expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  return doc;
}

const planear = (doc: Documento, id: string, lado: LadoCable, destino: DestinoExtremo) =>
  planearReconexion(entornoLineal(doc.hojas[0]!), id, lado, destino);

const recorrido = (doc: Documento, id: string) => {
  const h = doc.hojas[0]!;
  return recorridoCable(indexarHoja(h), h.cables.find((w) => w.id === id)!);
};

/**
 * Base: K1 en (0, 0) y K2 en (12, 0). w1 sale de K1·A1 (0, −2) hacia arriba,
 * dobla en (0, −6) y en (8, −6), y termina suelto en (8, −3).
 */
function base(extra: { componentes?: Componente[]; cables?: Cable[] } = {}): Documento {
  return docCon(
    [bobina("k1", 0, 0), bobina("k2", 12, 0), ...(extra.componentes ?? [])],
    [
      cable("w1", borne("k1", "A1"), libre(8, -3), [
        [0, -6],
        [8, -6],
      ]),
      ...(extra.cables ?? []),
    ],
  );
}

describe("planearReconexion: conectar", () => {
  it("libre → borne: se estira el último codo y se conserva el resto, como en T14a", () => {
    const doc = base();
    const antes = copia(doc);
    const r = planear(doc, "w1", "hasta", borne("k2", "A1"));
    expect(r.rechazo).toBeNull();
    expect(r.cable).toMatchObject({
      id: "w1",
      desde: borne("k1", "A1"),
      hasta: borne("k2", "A1"),
      codos: [
        [0, -6],
        [12, -6],
      ],
      puntos: [0, -2, 0, -6, 12, -6, 12, -2],
    });
    expect(r.antes).toEqual(antes.hojas[0]!.cables[0]);
    // Planear no cambia nada.
    expect(doc).toEqual(antes);
  });

  it("libre → T: el extremo pasa a una T en ese punto del cable", () => {
    const doc = base({ cables: [cable("w2", libre(4, 2), libre(16, 2))] });
    const r = planear(doc, "w1", "hasta", enCable("w2", 8, 2));
    expect(r.rechazo).toBeNull();
    expect(r.cable).toMatchObject({ hasta: enCable("w2", 8, 2), codos: [[0, -6], [8, -6]], puntos: [0, -2, 0, -6, 8, -6, 8, 2] });
  });

  it("el lado desde: se orienta del extremo fijo al agarrado y el resultado queda en el sentido del cable", () => {
    // w1 al revés: desde suelto, hasta en K1·A1.
    const doc = docCon(
      [bobina("k1", 0, 0), bobina("k2", 12, 0)],
      [
        cable("w1", libre(8, -3), borne("k1", "A1"), [
          [8, -6],
          [0, -6],
        ]),
      ],
    );
    const r = planear(doc, "w1", "desde", borne("k2", "A1"));
    expect(r.rechazo).toBeNull();
    expect(r.cable).toMatchObject({ desde: borne("k2", "A1"), hasta: borne("k1", "A1"), puntos: [12, -2, 12, -6, 0, -6, 0, -2] });
  });

  it("un trazado que tocaría otro cable no se elige: gana el siguiente candidato que pasa", () => {
    // w9 tiene un codo justo donde caería el codo estirado (12, −6).
    const w9 = cable("w9", libre(12, -9), libre(16, -6), [[12, -6]]);
    const doc = base({ cables: [w9] });
    const r = planear(doc, "w1", "hasta", borne("k2", "A1"));
    expect(r.rechazo).toBeNull();
    expect(r.cable!.puntos).not.toEqual([0, -2, 0, -6, 12, -6, 12, -2]);
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  });

  it("cable con dos extremos libres: cada extremo se conecta por separado, el otro queda quieto", () => {
    const doc = docCon([bobina("k1", 0, 0), bobina("k2", 12, 0)], [cable("w1", libre(0, -6), libre(12, -6))]);
    const paso1 = new CambiarExtremo("w1", "desde", borne("k1", "A1"));
    paso1.aplicar(doc);
    expect(doc.hojas[0]!.cables[0]).toEqual(cable("w1", borne("k1", "A1"), libre(12, -6), [[0, -6]]));
    const paso2 = new CambiarExtremo("w1", "hasta", borne("k2", "A1"));
    paso2.aplicar(doc);
    // Como el parcial de T14a: estirar daría una recta saliendo de costado; gana la U corta desde (0, −2).
    expect(doc.hojas[0]!.cables[0]).toEqual(
      cable("w1", borne("k1", "A1"), borne("k2", "A1"), [
        [0, -3],
        [12, -3],
      ]),
    );
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
    // Cada uno es su propio paso.
    paso2.deshacer(doc);
    expect(doc.hojas[0]!.cables[0]).toEqual(cable("w1", borne("k1", "A1"), libre(12, -6), [[0, -6]]));
    // El extremo ya conectado no se agarra.
    expect(() => planear(doc, "w1", "desde", borne("k2", "A1"))).toThrow("no está suelto");
  });
});

describe("planearReconexion: sin T apoyadas, el mismo dibujo que T14a", () => {
  it("reconectar a K2 ya movido = mover K2 con el cable atado (T14a)", () => {
    const desplazamientos: [number, number][] = [];
    for (let dx = -6; dx <= 8; dx += 2) for (let dy = -4; dy <= 6; dy += 2) desplazamientos.push([dx, dy]);
    let comparados = 0;
    for (const [dx, dy] of desplazamientos) {
      const ctx = `K2 a (${12 + dx}, ${dy})`;
      // T14a: w1 atado a K1·A1 y a K2·A1 (llega desde arriba); se mueve K2.
      const conT14a = docCon(
        [bobina("k1", 0, 0), bobina("k2", 12, 0)],
        [cable("w1", borne("k1", "A1"), borne("k2", "A1"), [[0, -6], [12, -6]])],
      );
      try {
        new Mover(["k2"], dx, dy).aplicar(conT14a);
      } catch {
        continue;
      }
      // T14c: el mismo w1 con el extremo suelto donde estaba K2·A1, y K2 ya movido.
      const suelto = docCon(
        [bobina("k1", 0, 0), bobina("k2", 12 + dx, dy)],
        [cable("w1", borne("k1", "A1"), libre(12, -2), [[0, -6], [12, -6]])],
      );
      const r = planear(suelto, "w1", "hasta", borne("k2", "A1"));
      expect(r.rechazo, ctx).toBeNull();
      expect(r.cable!.codos, ctx).toEqual(conT14a.hojas[0]!.cables[0]!.codos);
      comparados++;
    }
    expect(comparados).toBeGreaterThan(40);
  });
});

describe("planearReconexion: T apoyadas (D4-B, D5-B limitada)", () => {
  // w2 se apoya en w1 en (4, −6), en el medio del tramo (0, −6)–(8, −6), y sube suelto.
  const w2 = cable("w2", enCable("w1", 4, -6), libre(4, -9));
  const k3 = bobina("k3", 2, 6);

  it("sin T apoyadas, hasta K3·A1 se estira desde (0, −6)", () => {
    const doc = base({ componentes: [k3] });
    const r = planear(doc, "w1", "hasta", borne("k3", "A1"));
    expect(r.rechazo).toBeNull();
    expect(r.cable!.puntos).toEqual([0, -2, 0, -6, 2, -6, 2, 4]);
  });

  it("con una T apoyada: hasta la última T queda igual punto por punto, y la T no se mueve", () => {
    const doc = base({ componentes: [k3], cables: [w2] });
    const antes = copia(doc);
    const viejo = recorrido(doc, "w1")!;
    const r = planear(doc, "w1", "hasta", borne("k3", "A1"));
    expect(r.rechazo).toBeNull();
    const p = r.cable!.puntos;
    // Lo de antes de la T: (0, −2), (0, −6) y el punto de la T.
    expect(p.slice(0, 4)).toEqual(viejo.slice(0, 4));
    expect(p.slice(4, 6)).toEqual([4, -6]);
    // Sin volver sobre lo conservado: sigue desde la T.
    expect(p).toEqual([0, -2, 0, -6, 4, -6, 4, -1, 2, -1, 2, 4]);
    // Planear no tocó a w2.
    expect(doc.hojas[0]!.cables[1]).toEqual(antes.hojas[0]!.cables[1]);
    // Y aplicado, la hoja queda válida con w2 igual.
    new CambiarExtremo("w1", "hasta", borne("k3", "A1")).aplicar(doc);
    expect(doc.hojas[0]!.cables[1]).toEqual(antes.hojas[0]!.cables[1]);
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  });

  it("con varias T apoyadas manda la última; la T en un codo lo conserva tal cual", () => {
    // w3 se apoya en el codo (8, −6), más adelante que w2.
    const w3 = cable("w3", enCable("w1", 8, -6), libre(8, -9));
    const doc = base({ componentes: [k3], cables: [w2, w3] });
    const viejo = recorrido(doc, "w1")!;
    const r = planear(doc, "w1", "hasta", borne("k2", "A1"));
    expect(r.rechazo).toBeNull();
    const p = r.cable!.puntos;
    expect(p.slice(0, 6)).toEqual(viejo.slice(0, 6));
    expect(p).toEqual([0, -2, 0, -6, 8, -6, 12, -6, 12, -2]);
    expect(puntoSobreRecorrido(p, 4, -6)).toBe(true);
  });

  it("la T apoyada en el extremo agarrado (un .brn viejo) queda en el medio del cable nuevo", () => {
    const w4 = cable("w4", enCable("w1", 8, -3), libre(11, -3));
    const doc = base({ cables: [w4] });
    const viejo = recorrido(doc, "w1")!;
    const r = planear(doc, "w1", "hasta", borne("k1", "A2"));
    expect(r.rechazo).toBeNull();
    // Hasta el codo (8, −6) igual; la T sigue sobre el cable, que sigue derecho por ella.
    const p = r.cable!.puntos;
    expect(p.slice(0, 6)).toEqual(viejo.slice(0, 6));
    expect(puntoSobreRecorrido(p, 8, -3)).toBe(true);
    expect(p.slice(-2)).toEqual([0, 2]);
    new CambiarExtremo("w1", "hasta", borne("k1", "A2")).aplicar(doc);
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  });
});

describe("planearReconexion y CambiarExtremo: cada rechazo deja el documento igual", () => {
  /** K3 en (20, 0) con sus tres salidas de A1 ocupadas. */
  const sinSalidas = () =>
    base({
      componentes: [bobina("k3", 20, 0)],
      cables: [
        cable("c1", borne("k3", "A1"), libre(20, -5)),
        cable("c2", borne("k3", "A1"), libre(17, -2)),
        cable("c3", borne("k3", "A1"), libre(23, -2)),
      ],
    });
  /** w2 en T sobre w1 y w3 en T sobre w2. */
  const cadena = () =>
    base({
      cables: [cable("w2", enCable("w1", 4, -6), libre(4, -12)), cable("w3", enCable("w2", 4, -10), libre(9, -10))],
    });

  const casos: [string, () => Documento, string, LadoCable, DestinoExtremo, string][] = [
    ["mismo borne", () => base(), "w1", "hasta", borne("k1", "A1"), MENSAJE_MISMO_BORNE],
    [
      "largo cero",
      () => docCon([], [cable("h", libre(20, -3), libre(20, 3)), cable("w1", libre(20, 0), libre(25, 0))]),
      "w1",
      "hasta",
      enCable("h", 20, 0),
      MENSAJE_SIN_LARGO,
    ],
    [
      "extremo sobre un borne sin conectar (T sobre un cable justo en un borne)",
      () => base({ componentes: [bobina("k3", 4, 6)], cables: [cable("h", libre(2, 4), libre(6, 4))] }),
      "w1",
      "hasta",
      enCable("h", 4, 4),
      "El cable pasaría sobre el borne K3 · A1 sin conectarse.",
    ],
    [
      "T sobre un extremo suelto",
      () => base({ cables: [cable("h", libre(14, -9), libre(14, -4))] }),
      "w1",
      "hasta",
      enCable("h", 14, -4),
      MENSAJE_EXTREMO_SUELTO,
    ],
    [
      "T sobre un cruce",
      () => base({ cables: [cable("h", libre(14, -9), libre(14, 4)), cable("x", libre(10, 3), libre(18, 3))] }),
      "w1",
      "hasta",
      enCable("h", 14, 3),
      MENSAJE_CRUCE,
    ],
    ["borne sin salidas", sinSalidas, "w1", "hasta", borne("k3", "A1"), MENSAJE_SIN_SALIDAS],
    ["ciclo directo", () => base({ cables: [cable("w2", enCable("w1", 4, -6), libre(4, -12))] }), "w1", "hasta", enCable("w2", 4, -9), MENSAJE_APOYO_CICLO],
    ["ciclo de 3", cadena, "w1", "hasta", enCable("w3", 7, -10), MENSAJE_APOYO_CICLO],
    [
      "los dos extremos sobre el mismo anfitrión",
      () => docCon([], [cable("h", libre(0, 0), libre(20, 0)), cable("w1", enCable("h", 4, 0), libre(4, 6))]),
      "w1",
      "hasta",
      enCable("h", 10, 0),
      MENSAJE_MISMO_ANFITRION,
    ],
    ["sobre sí mismo", () => base(), "w1", "hasta", enCable("w1", 0, -4), MENSAJE_SOBRE_SI_MISMO],
    [
      "T apoyada en el extremo",
      // K3·A1 cae justo en (4, −6), donde w2 se apoya en w1.
      () => base({ componentes: [bobina("k3", 4, -4)], cables: [cable("w2", enCable("w1", 4, -6), libre(4, -9))] }),
      "w1",
      "hasta",
      borne("k3", "A1"),
      MENSAJE_T_EN_EXTREMO,
    ],
  ];

  for (const [nombre, crear, id, lado, destino, mensaje] of casos) {
    it(nombre, () => {
      const doc = crear();
      const antes = copia(doc);
      const r = planear(doc, id, lado, destino);
      expect(r.rechazo?.motivo, nombre).toBe(mensaje);
      expect(r.rechazo!.conflictos.length).toBeGreaterThan(0);
      expect(() => new CambiarExtremo(id, lado, destino).aplicar(doc), nombre).toThrow(mensaje);
      expect(doc, nombre).toEqual(antes);
    });
  }

  it("sin camino: con la T apoyada, todo candidato cruzaría lo conservado", () => {
    // w1 sube de K1·A1 hasta y = −10, va a x = 8 y baja suelto hasta (8, −3); w3 se apoya en (8, −6).
    // El destino, una T sobre h en (−3, −4), queda del otro lado del tramo conservado x = 0.
    const doc = docCon(
      [bobina("k1", 0, 0)],
      [
        cable("w1", borne("k1", "A1"), libre(8, -3), [
          [0, -10],
          [8, -10],
        ]),
        cable("w3", enCable("w1", 8, -6), libre(12, -6)),
        cable("h", libre(-3, -8), libre(-3, 0)),
      ],
    );
    const antes = copia(doc);
    const r = planear(doc, "w1", "hasta", enCable("h", -3, -4));
    expect(r.rechazo?.motivo).toBe(MENSAJE_SIN_LLEGADA);
    expect(r.cable).toBeNull();
    expect(() => new CambiarExtremo("w1", "hasta", enCable("h", -3, -4)).aplicar(doc)).toThrow(MENSAJE_SIN_LLEGADA);
    expect(doc).toEqual(antes);
  });

  it("con candidatos que fallan, el primero queda como intento (para la previa a rayas)", () => {
    const doc = base({ cables: [cable("h", libre(14, -9), libre(14, 4)), cable("x", libre(10, 3), libre(18, 3))] });
    const r = planear(doc, "w1", "hasta", enCable("h", 14, 3));
    expect(r.rechazo?.motivo).toBe(MENSAJE_CRUCE);
    expect(r.cable).not.toBeNull();
    expect(r.cable!.hasta).toEqual(enCable("h", 14, 3));
    expect(r.rechazo!.conflictos[0]).toMatchObject({ x: 14, y: 3 });
  });
});
