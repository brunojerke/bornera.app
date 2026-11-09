import { describe, expect, it } from "vitest";
import { BOBINA_CONTACTOR, borneColocado } from "../symbols";
import { indexarHoja } from "./cables";
import type { Cable, Componente, Extremo, Hoja } from "./documento";
import { codos, opuesta, type ExtremoRuta } from "./ruteo";
import {
  consultaHoja,
  MENSAJE_CRUCE,
  MENSAJE_EXTREMO_SUELTO,
  MENSAJE_SIN_SALIDAS,
  prepararCable,
  problemasTrazado,
  salidasLibres,
  type CableNuevo,
} from "./trazado";

/** Bobina K1 con el centro en (0, 0): cuerpo x −1…1, y −2…2; A1 en (0, −2) arriba, A2 en (0, 2) abajo. */
function k1(): Componente {
  return { id: "c1", tipo: BOBINA_CONTACTOR.tipo, x: 0, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: {} };
}

function libre(x: number, y: number): { tipo: "libre"; x: number; y: number } {
  return { tipo: "libre", x, y };
}

function cable(id: string, desde: Extremo, hasta: Extremo, codosCable: [number, number][] = []): Cable {
  return { id, desde, hasta, codos: codosCable };
}

function hojaCon(componentes: Componente[], cables: Cable[] = []): Hoja {
  return { nombre: "H", componentes, cables };
}

function mensajes(hoja: Hoja, nuevo: CableNuevo): string[] {
  return problemasTrazado(nuevo, consultaHoja(hoja)).map((c) => c.mensaje);
}

const A1 = { tipo: "borne", comp: "c1", borne: "A1" } as const;
const A2 = { tipo: "borne", comp: "c1", borne: "A2" } as const;

describe("problemasTrazado", () => {
  it("un tramo sobre un borne que no es el suyo se bloquea; llegar a ese borne vale", () => {
    const hoja = hojaCon([k1()]);
    expect(mensajes(hoja, { desde: libre(-5, -2), hasta: libre(5, -2), puntos: [-5, -2, 5, -2] })).toEqual([
      "El cable pasaría sobre el borne K1 · A1 sin conectarse.",
    ]);
    expect(mensajes(hoja, { desde: libre(0, -6), hasta: A1, puntos: [0, -6, 0, -2] })).toEqual([]);
  });

  it("atravesar una bobina se bloquea; bordearla vale", () => {
    const hoja = hojaCon([k1()]);
    expect(mensajes(hoja, { desde: libre(-5, 0), hasta: libre(5, 0), puntos: [-5, 0, 5, 0] })).toEqual([
      "El cable atravesaría el cuerpo de K1.",
    ]);
    expect(mensajes(hoja, { desde: libre(0, -6), hasta: libre(0, 6), puntos: [0, -6, 0, 6] })).toContain(
      "El cable atravesaría el cuerpo de K1.",
    );
    // Por el borde derecho de la caja (x = 1): no entra al interior.
    expect(mensajes(hoja, { desde: libre(1, -5), hasta: libre(1, 5), puntos: [1, -5, 1, 5] })).toEqual([]);
    // Entrar al borne desde adentro del símbolo también atraviesa.
    expect(mensajes(hoja, { desde: libre(0, 1), hasta: A1, puntos: [0, 1, 0, -2] })).toContain("El cable atravesaría el cuerpo de K1.");
  });

  it("encimarse con otro cable se bloquea; el cruce simple no", () => {
    const hoja = hojaCon([], [cable("w1", libre(0, 10), libre(10, 10))]);
    expect(mensajes(hoja, { desde: libre(5, 10), hasta: libre(15, 10), puntos: [5, 10, 15, 10] })).toEqual([
      "El cable se encimaría con otro cable.",
    ]);
    expect(mensajes(hoja, { desde: libre(5, 5), hasta: libre(5, 15), puntos: [5, 5, 5, 15] })).toEqual([]);
  });

  it("tocar otro cable en un codo o extremo se bloquea", () => {
    const hoja = hojaCon([], [cable("w1", libre(0, 5), libre(10, 5)), cable("w2", libre(20, 0), libre(20, 5))]);
    // Extremo libre del nuevo sobre el interior de w1.
    expect(mensajes(hoja, { desde: libre(3, 0), hasta: libre(3, 5), puntos: [3, 0, 3, 5] })).toEqual(["El cable tocaría otro cable sin conectarse."]);
    // Codo del nuevo sobre el interior de w1: (2, 5) es esquina del nuevo.
    expect(mensajes(hoja, { desde: libre(2, 0), hasta: libre(-3, 8), puntos: [2, 0, 2, 5, -3, 5] })).toContain(
      "El cable se encimaría con otro cable.",
    );
    // Pasar por el extremo suelto de w2.
    expect(mensajes(hoja, { desde: libre(17, 5), hasta: libre(23, 5), puntos: [17, 5, 23, 5] })).toEqual([
      "El cable pasaría por el extremo suelto de otro cable.",
    ]);
  });

  it("una T vale sobre un cable, pero no sobre su extremo suelto ni sobre un cruce sin unión", () => {
    const hoja = hojaCon(
      [],
      [cable("w1", libre(0, 0), libre(10, 0)), cable("w2", libre(5, -5), libre(5, 5)), cable("w3", libre(20, 0), libre(30, 0))],
    );
    expect(mensajes(hoja, { desde: { tipo: "cable", cable: "w3", x: 25, y: 0 }, hasta: libre(25, 6), puntos: [25, 0, 25, 6] })).toEqual([]);
    expect(mensajes(hoja, { desde: { tipo: "cable", cable: "w3", x: 30, y: 0 }, hasta: libre(30, 6), puntos: [30, 0, 30, 6] })).toEqual([
      MENSAJE_EXTREMO_SUELTO,
    ]);
    expect(mensajes(hoja, { desde: { tipo: "cable", cable: "w1", x: 5, y: 0 }, hasta: libre(2, 4), puntos: [5, 0, 5, 4, 2, 4] })).toContain(
      MENSAJE_CRUCE,
    );
  });

  it("una T sobre un punto donde otro cable ya está unido al anfitrión vale", () => {
    // w2 baja y termina en T sobre w1 en (5, 0); el nuevo sale de (5, 0) hacia arriba.
    const hoja = hojaCon(
      [],
      [cable("w1", libre(0, 0), libre(10, 0)), cable("w2", { tipo: "cable", cable: "w1", x: 5, y: 0 }, libre(5, 5))],
    );
    expect(mensajes(hoja, { desde: { tipo: "cable", cable: "w1", x: 5, y: 0 }, hasta: libre(5, -4), puntos: [5, 0, 5, -4] })).toEqual([]);
  });

  it("el cable no puede encimarse, cruzarse ni tocarse consigo mismo", () => {
    const sola = hojaCon([]);
    expect(mensajes(sola, { desde: libre(0, 0), hasta: libre(1, 0), puntos: [0, 0, 6, 0, 6, 3, 3, 3, 3, 0, 1, 0] })).toContain(
      "El cable se encimaría consigo mismo.",
    );
    // Cruce en X de dos tramos no vecinos (antes valía).
    expect(mensajes(sola, { desde: libre(0, 0), hasta: libre(3, -2), puntos: [0, 0, 6, 0, 6, 3, 3, 3, 3, -2] })).toEqual([
      "El cable se cruzaría consigo mismo.",
    ]);
    // Un codo sobre otro codo propio: vuelve a pasar por (4, 0).
    expect(mensajes(sola, { desde: libre(0, 0), hasta: libre(4, -2), puntos: [0, 0, 4, 0, 4, 2, 6, 2, 6, 0, 4, 0, 4, -2] })).toEqual([
      "El cable se tocaría consigo mismo.",
    ]);
    // El extremo sobre un tramo propio.
    expect(mensajes(sola, { desde: libre(0, 0), hasta: libre(3, 0), puntos: [0, 0, 6, 0, 6, 3, 3, 3, 3, 0] })).toEqual([
      "El cable se tocaría consigo mismo.",
    ]);
    // Una U que no vuelve a tocarse vale.
    expect(mensajes(sola, { desde: libre(0, 0), hasta: libre(3, 1), puntos: [0, 0, 6, 0, 6, 3, 3, 3, 3, 1] })).toEqual([]);
  });

  it("la T de otro cable sobre este, en su punto, no es un toque (visto desde el anfitrión)", () => {
    const hoja = hojaCon([], [cable("w2", { tipo: "cable", cable: "w1", x: 5, y: 0 }, libre(5, 5))]);
    expect(mensajes(hoja, { id: "w1", desde: libre(0, 0), hasta: libre(10, 0), puntos: [0, 0, 10, 0] })).toEqual([]);
    // Si la T es sobre otro cable, el toque sigue contando.
    expect(mensajes(hoja, { id: "w9", desde: libre(0, 0), hasta: libre(10, 0), puntos: [0, 0, 10, 0] })).toEqual([
      "El cable tocaría otro cable sin conectarse.",
    ]);
  });

  const TOCA = "El cable tocaría otro cable sin conectarse.";
  const ENCIMA = "El cable se encimaría con otro cable.";
  it.each([
    // El extremo libre de w2 vuelve a caer sobre w1, lejos de la T.
    ["con el extremo libre", [0, 0, 10, 0], [2, 0, 2, 3, 6, 3, 6, 0], [6, 0], "El cable pasaría por el extremo suelto de otro cable.", TOCA],
    // Un tramo de w2 encimado sobre w1.
    ["con un tramo encimado", [0, 0, 10, 0], [2, 0, 2, 3, 6, 3, 6, 0, 8, 0], [6, 0], ENCIMA, ENCIMA],
    // Un codo de w2 sobre el codo de w1 (w1 en L), sin encimarse.
    ["con un codo sobre un codo", [0, 0, 10, 0, 10, 10], [2, 0, 2, -4, 10, -4, 10, 0, 13, 0, 13, 5], [10, 0], TOCA, TOCA],
  ] as const)("la T de w2 sobre w1 no tapa otro toque de w2 sobre w1 fuera de su punto (%s): se rechaza de los dos lados", (_, p1, p2, [x, y], mensajeW1, mensajeW2) => {
    const enT = { tipo: "cable", cable: "w1", x: 2, y: 0 } as const;
    const fin2 = libre(p2.at(-2)!, p2.at(-1)!);
    const fin1 = libre(p1.at(-2)!, p1.at(-1)!);
    const codos = (p: readonly number[]) => {
      const c: [number, number][] = [];
      for (let i = 2; i + 3 < p.length; i += 2) c.push([p[i]!, p[i + 1]!]);
      return c;
    };
    // Visto desde el anfitrión (w1 cambia; w2 ya está en la hoja).
    const conW2 = hojaCon([], [cable("w2", enT, fin2, codos(p2))]);
    const desdeW1 = problemasTrazado({ id: "w1", desde: libre(0, 0), hasta: fin1, puntos: [...p1] }, consultaHoja(conW2));
    // Visto desde el derivado (w2 cambia; w1 ya está en la hoja).
    const conW1 = hojaCon([], [cable("w1", libre(0, 0), fin1, codos(p1))]);
    const desdeW2 = problemasTrazado({ id: "w2", desde: enT, hasta: fin2, puntos: [...p2] }, consultaHoja(conW1));
    expect(desdeW1).toContainEqual(expect.objectContaining({ mensaje: mensajeW1, x, y }));
    expect(desdeW2).toContainEqual(expect.objectContaining({ mensaje: mensajeW2, x, y }));
    // Ninguno es en el punto de la T: ahí están unidos.
    for (const c of [...desdeW1, ...desdeW2]) expect([c.x, c.y]).not.toEqual([2, 0]);
  });
});

describe("puente A1-A2 de una bobina", () => {
  const hoja = hojaCon([k1()]);
  const indice = indexarHoja(hoja);
  const consulta = consultaHoja(hoja, indice);
  const a1 = borneColocado(BOBINA_CONTACTOR.bornes, "A1", 0, 0, { rotacion: 0, espejado: false })!;
  const a2 = borneColocado(BOBINA_CONTACTOR.bornes, "A2", 0, 0, { rotacion: 0, espejado: false })!;
  const deA2: ExtremoRuta = { x: a2.x, y: a2.y, preferidas: [a2.direccion], prohibidas: [opuesta(a2.direccion)] };

  it("sin codos no hay ruta: rodear la bobina pide más de 2 codos", () => {
    const deA1: ExtremoRuta = { x: a1.x, y: a1.y, preferidas: [a1.direccion], prohibidas: [opuesta(a1.direccion)] };
    const acepta = (c: [number, number][]) =>
      problemasTrazado({ desde: A1, hasta: A2, puntos: [a1.x, a1.y, ...c.flat(), a2.x, a2.y] }, consulta).length === 0;
    expect(codos(deA1, deA2, acepta)).toBeNull();
  });

  it("con un codo a mano en (2, −3), la rodea por el costado y entra a A2 desde abajo", () => {
    // Lo fijado: A1 (0, −2) → (0, −3) → (2, −3). Desde ahí, el ruteo.
    const fijado: [number, number][] = [
      [0, -3],
      [2, -3],
    ];
    const ancla: ExtremoRuta = { x: 2, y: -3, prohibidas: ["izquierda"], debiles: ["arriba", "abajo"] };
    const acepta = (c: [number, number][]) =>
      problemasTrazado({ desde: A1, hasta: A2, puntos: [a1.x, a1.y, ...fijado.flat(), ...c.flat(), a2.x, a2.y] }, consulta).length === 0;
    const resto = codos(ancla, deA2, acepta);
    expect(resto).toEqual([
      [2, 3],
      [0, 3],
    ]);
    const r = prepararCable(indice, consulta, { desde: A1, hasta: A2, codos: [...fijado, ...resto!] });
    expect(r.problemas).toEqual([]);
  });
});

describe("varios cables en un borne", () => {
  // w1 sale de A1 hacia arriba. El segundo y el tercero tienen que salir de costado.
  const w1 = cable("w1", A1, libre(0, -6));
  const deA1: ExtremoRuta = { x: 0, y: -2, preferidas: ["arriba"], prohibidas: ["abajo"] };

  function primeraRuta(hoja: Hoja, hasta: { tipo: "libre"; x: number; y: number }): [number, number][] | null {
    const consulta = consultaHoja(hoja);
    return codos(deA1, { x: hasta.x, y: hasta.y }, (c) =>
      problemasTrazado({ desde: A1, hasta, puntos: [0, -2, ...c.flat(), hasta.x, hasta.y] }, consulta).length === 0,
    );
  }

  it("el segundo cable no se encima con el primero: sale de costado, bordeando la caja", () => {
    const hoja = hojaCon([k1()], [w1]);
    expect(primeraRuta(hoja, libre(4, -5))).toEqual([[4, -2]]);
    expect(salidasLibres(consultaHoja(hoja), 0, -2, "arriba")).toEqual(["izquierda", "derecha"]);
  });

  it("el tercero sale por el otro costado; el cuarto avisa que no hay más salidas", () => {
    const w2 = cable("w2", A1, libre(4, -5), [[4, -2]]);
    const hoja3 = hojaCon([k1()], [w1, w2]);
    expect(primeraRuta(hoja3, libre(-4, -5))).toEqual([[-4, -2]]);

    const w3 = cable("w3", A1, libre(-4, -5), [[-4, -2]]);
    const hoja4 = hojaCon([k1()], [w1, w2, w3]);
    const consulta = consultaHoja(hoja4);
    expect(salidasLibres(consulta, 0, -2, "arriba")).toEqual([]);
    expect(primeraRuta(hoja4, libre(6, -8))).toBeNull();
    const m = problemasTrazado({ desde: A1, hasta: libre(6, -8), puntos: [0, -2, 0, -8, 6, -8] }, consulta).map((c) => c.mensaje);
    expect(m[0]).toBe(MENSAJE_SIN_SALIDAS);
  });

  it("derivar con una T sobre uno de esos cables funciona", () => {
    const w2 = cable("w2", A1, libre(4, -5), [[4, -2]]);
    const w3 = cable("w3", A1, libre(-4, -5), [[-4, -2]]);
    const hoja = hojaCon([k1()], [w1, w2, w3]);
    const indice = indexarHoja(hoja);
    const r = prepararCable(indice, consultaHoja(hoja, indice), {
      desde: { tipo: "cable", cable: "w1", x: 0, y: -4 },
      hasta: libre(2, -4),
      codos: [],
    });
    expect(r.problemas).toEqual([]);
  });
});

describe("prepararCable", () => {
  it("con la estructura mal (mismo borne) no llega al trazado", () => {
    const hoja = hojaCon([k1()]);
    const indice = indexarHoja(hoja);
    const r = prepararCable(indice, consultaHoja(hoja, indice), { desde: A1, hasta: A1, codos: [[0, -4], [2, -4], [2, -2]] });
    expect(r.puntos).toBeNull();
    expect(r.problemas.length).toBeGreaterThan(0);
  });
});
