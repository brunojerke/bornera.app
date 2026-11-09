import { describe, expect, it } from "vitest";
import { SIMBOLOS, borneColocado, buscarSimbolo, type Direccion, type Rotacion } from "../symbols";
import { borneDe, indexarHoja, puntoSobreRecorrido, recorridoCable, validarHoja } from "./cables";
import { Cablear, Espejar, Mover, Rotar, colocar, type Comando } from "./comandos";
import { crearDocumento, type Cable, type Componente, type Documento, type Extremo, type Hoja } from "./documento";
import { codos, direccionDe, opuesta, seTocaASiMismo, type ExtremoRuta } from "./ruteo";
import {
  MENSAJE_CICLO,
  MENSAJE_NADA_SE_MUEVE_UNO,
  MENSAJE_NADA_SE_MUEVE_VARIOS,
  entornoLineal,
  planearTransformacion,
  puntosParaT,
  transformacionGrupo,
  type Operacion,
} from "./seguir";
import { consultaHoja, problemasComponente, problemasTrazado, geometriaComponente } from "./trazado";

const meta = { titulo: "Seguir", autor: "Bruno Jerke", fecha: "2026-11-08" };
const ORIENTACIONES: [Rotacion, boolean][] = [0, 90, 180, 270].flatMap((r) => [
  [r as Rotacion, false],
  [r as Rotacion, true],
]) as [Rotacion, boolean][];

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const borne = (comp: string, b: string): Extremo => ({ tipo: "borne", comp, borne: b });
const libre = (x: number, y: number): Extremo => ({ tipo: "libre", x, y });
const enCable = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });

function datos(tipo: string, x: number, y: number, rot: Rotacion = 0, espejado = false): Omit<Componente, "id"> {
  return { tipo, x, y, rot, espejado, etiqueta: "", params: {} };
}

function poner(doc: Documento, d: Omit<Componente, "id">): string {
  const c = colocar(doc, d);
  c.aplicar(doc);
  return c.id;
}

/** Agrega un cable con id fijo (sin pasar por el contador). */
function tender(doc: Documento, id: string, desde: Extremo, hasta: Extremo, codosCable: [number, number][] = []): string {
  new Cablear({ id, desde, hasta, codos: codosCable }).aplicar(doc);
  return id;
}

/** Ruta de un extremo para `codos`: en un borne, sale por su dirección. */
function rutaDe(hoja: Hoja, e: Extremo): ExtremoRuta {
  const indice = indexarHoja(hoja);
  if (e.tipo !== "borne") return { x: e.x, y: e.y };
  const b = borneDe(indice.componentes.get(e.comp)!, e.borne)!;
  return { x: b.x, y: b.y, preferidas: [b.direccion], prohibidas: [opuesta(b.direccion)] };
}

/** Cablea entre dos extremos con el ruteo de T13 y su validación, como la herramienta W. */
function rutear(doc: Documento, id: string, desde: Extremo, hasta: Extremo): string {
  const hoja = doc.hojas[0]!;
  const consulta = consultaHoja(hoja);
  const d = rutaDe(hoja, desde);
  const h = rutaDe(hoja, hasta);
  const c = codos(d, h, (k) => {
    const puntos = [d.x, d.y, ...k.flat(), h.x, h.y];
    return problemasTrazado({ desde, hasta, puntos }, consulta).length === 0;
  });
  if (!c) throw new Error(`Sin ruta para ${id}`);
  return tender(doc, id, desde, hasta, c);
}

function recorrido(doc: Documento, id: string): number[] {
  const hoja = doc.hojas[0]!;
  return recorridoCable(
    indexarHoja(hoja),
    hoja.cables.find((w) => w.id === id)!,
  )!;
}

/** Dirección con la que el cable sale del extremo `lado`. */
function salida(doc: Documento, id: string, lado: "desde" | "hasta"): Direccion {
  const p = recorrido(doc, id);
  const n = p.length;
  return lado === "desde" ? direccionDe(p[2]! - p[0]!, p[3]! - p[1]!)! : direccionDe(p[n - 4]! - p[n - 2]!, p[n - 3]! - p[n - 1]!)!;
}

/** Aplica, comprueba que la hoja queda válida, y que deshacer y rehacer son exactos. Devuelve el documento aplicado. */
function aplicarYVolver(doc: Documento, cmd: Comando): Documento {
  const antes = copia(doc);
  cmd.aplicar(doc);
  expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  const despues = copia(doc);
  cmd.deshacer(doc);
  expect(doc).toEqual(antes);
  cmd.aplicar(doc);
  expect(doc).toEqual(despues);
  return doc;
}

/** Tira, y el documento queda igual. Devuelve el mensaje. */
function rechazado(doc: Documento, cmd: Comando): string {
  const antes = copia(doc);
  let mensaje = "";
  try {
    cmd.aplicar(doc);
  } catch (e) {
    mensaje = (e as Error).message;
  }
  expect(mensaje).not.toBe("");
  expect(doc).toEqual(antes);
  return mensaje;
}

// ── Transformación de grupo ────────────────────────────────────────────────

describe("transformacionGrupo", () => {
  const OPS: Operacion[] = [
    { tipo: "rotar", sentido: 90 },
    { tipo: "rotar", sentido: -90 },
    { tipo: "espejar" },
    { tipo: "mover", dx: 3, dy: -2 },
  ];
  const CAJAS = [
    { x0: 5, y0: -3, x1: 5, y1: -3 },
    { x0: 0, y0: 0, x1: 4, y1: 2 },
    { x0: 0, y0: 0, x1: 3, y1: 5 },
    { x0: 0, y0: 0, x1: 3, y1: 4 },
    { x0: -7, y0: -2, x1: -2, y1: 6 },
  ];

  it.each(ORIENTACIONES)("%s° espejado %s: los bornes quedan donde los lleva T, con su dirección", (rot, espejado) => {
    for (const op of OPS) {
      for (const caja of CAJAS) {
        const t = transformacionGrupo(op, caja);
        for (const def of SIMBOLOS) {
          for (const [x, y] of [
            [caja.x0, caja.y0],
            [caja.x1, caja.y1],
            [caja.x0, caja.y1],
          ] as const) {
            const antes = { x, y, rot, espejado };
            const despues = t.pose(antes);
            for (const b of def.bornes) {
              const v = borneColocado(def.bornes, b.nombre, x, y, { rotacion: rot, espejado })!;
              const n = borneColocado(def.bornes, b.nombre, despues.x, despues.y, { rotacion: despues.rot, espejado: despues.espejado })!;
              expect({ x: n.x, y: n.y }).toEqual(t.punto(v.x, v.y));
              expect(n.direccion).toBe(t.direccion(v.direccion));
              expect(Number.isInteger(n.x) && Number.isInteger(n.y)).toBe(true);
            }
          }
        }
      }
    }
  });

  it("la inversa deshace el punto y la caja", () => {
    for (const op of OPS) {
      const t = transformacionGrupo(op, CAJAS[4]!);
      for (const [x, y] of [
        [0, 0],
        [3, -7],
        [-11, 4],
      ] as const)
        expect(t.inversa(t.punto(x, y).x, t.punto(x, y).y)).toEqual({ x, y });
      const r = { x: -2, y: 1, ancho: 5, alto: 3 };
      expect(t.rectInverso(t.rect(r))).toEqual(r);
    }
  });
});

// ── Un componente con cables ───────────────────────────────────────────────

/**
 * Bobina c1 en (0, 0) con la orientación dada; lámparas c2 (−16, −14) y c3
 * (16, 14), fijas. w1: c1.A1 → c2.X2 y w2: c1.A2 → c3.X1, ruteados como W.
 */
function docUno(rot: Rotacion, espejado: boolean): Documento {
  const doc = crearDocumento(meta);
  poner(doc, datos("contactor.bobina", 0, 0, rot, espejado));
  poner(doc, datos("senalizacion.lampara", -16, -14));
  poner(doc, datos("senalizacion.lampara", 16, 14));
  rutear(doc, "w1", borne("c1", "A1"), borne("c2", "X2"));
  rutear(doc, "w2", borne("c1", "A2"), borne("c3", "X1"));
  return doc;
}

function direccionBorne(doc: Documento, comp: string, b: string): Direccion {
  const hoja = doc.hojas[0]!;
  return borneDe(indexarHoja(hoja).componentes.get(comp)!, b)!.direccion;
}

describe("un componente con cables, en las 8 orientaciones", () => {
  const COMANDOS: [string, () => Comando][] = [
    ["R", () => new Rotar(["c1"], 90)],
    ["Mayús+R", () => new Rotar(["c1"], -90)],
    ["M", () => new Espejar(["c1"])],
    ["mover", () => new Mover(["c1"], 3, -2)],
    ["mover lejos", () => new Mover(["c1"], -9, 5)],
  ];
  for (const [rot, espejado] of ORIENTACIONES) {
    it.each(COMANDOS)(
      `${rot}°${espejado ? " espejado" : ""}, %s: los cables siguen al borne y salen como salían, transformado`,
      (_, crear) => {
        const doc = docUno(rot, espejado);
        const cmd = crear();
        const op: Operacion =
          cmd instanceof Rotar
            ? { tipo: "rotar", sentido: _ === "R" ? 90 : -90 }
            : cmd instanceof Espejar
              ? { tipo: "espejar" }
              : { tipo: "mover", dx: 0, dy: 0 };
        const { t } = planearTransformacion(doc.hojas[0]!, ["c1"], op, entornoLineal(doc.hojas[0]!)).plan;
        const antes = (id: string, lado: "desde" | "hasta") => salida(doc, id, lado);
        const esperado = { w1: t.direccion(antes("w1", "desde")), w2: t.direccion(antes("w2", "desde")) };
        const fijos = { w1: antes("w1", "hasta"), w2: antes("w2", "hasta") };
        aplicarYVolver(doc, cmd);
        // Espejar uno solo da vuelta de qué lado tiene que llegar el cable: a
        // veces la salida preferida pide 3 codos (el ruteo llega a 2) y queda
        // de costado, como en W. Con el resto, sale como salía, o por la
        // dirección propia del borne si el fresco tiene menos codos (un cable
        // que salía de costado no hereda el costado).
        if (!(cmd instanceof Espejar)) {
          expect([esperado.w1, direccionBorne(doc, "c1", "A1")]).toContain(salida(doc, "w1", "desde"));
          expect([esperado.w2, direccionBorne(doc, "c1", "A2")]).toContain(salida(doc, "w2", "desde"));
        }
        // Ninguno entra al cuerpo: sale por su dirección o de costado.
        for (const [id, b] of [
          ["w1", "A1"],
          ["w2", "A2"],
        ] as const) {
          expect(salida(doc, id, "desde")).not.toBe(opuesta(direccionBorne(doc, "c1", b)));
        }
        // Los extremos fijos siguen saliendo como antes.
        expect(salida(doc, "w1", "hasta")).toBe(fijos.w1);
        expect(salida(doc, "w2", "hasta")).toBe(fijos.w2);
      },
    );
  }
});

describe("mover cada extremo", () => {
  /** Lámpara c1 (0, 0), lámpara c2 (12, −10). Un cable de c1.X1 a c2.X2, en un sentido o en el otro. */
  function docExtremo(alReves: boolean): Documento {
    const doc = crearDocumento(meta);
    poner(doc, datos("senalizacion.lampara", 0, 0));
    poner(doc, datos("senalizacion.lampara", 12, -10));
    if (alReves) rutear(doc, "w1", borne("c2", "X2"), borne("c1", "X1"));
    else rutear(doc, "w1", borne("c1", "X1"), borne("c2", "X2"));
    return doc;
  }

  it.each([
    ["el de desde", false],
    ["el de hasta", true],
  ] as const)("mover %s da el mismo recorrido (al revés)", (_, alReves) => {
    const a = aplicarYVolver(docExtremo(false), new Mover(["c1"], 4, 1));
    const b = aplicarYVolver(docExtremo(alReves), new Mover(["c1"], 4, 1));
    const pa = recorrido(a, "w1");
    const pb = recorrido(b, "w1");
    const invertido: number[] = [];
    for (let i = pb.length - 2; i >= 0; i -= 2) invertido.push(pb[i]!, pb[i + 1]!);
    expect(alReves ? invertido : pb).toEqual(pa);
    // Y lo mismo moviendo el otro componente.
    const c = aplicarYVolver(docExtremo(alReves), new Mover(["c2"], -3, 2));
    expect(validarHoja(c.hojas[0]!)).toEqual([]);
  });

  it("estirar: un movimiento chico corre solo el último codo", () => {
    const doc = docExtremo(false);
    const antes = recorrido(doc, "w1");
    aplicarYVolver(doc, new Mover(["c2"], 2, 0));
    const despues = recorrido(doc, "w1");
    expect(despues.length).toBe(antes.length);
    // El primer tramo y el primer punto no cambian.
    expect(despues.slice(0, 2)).toEqual(antes.slice(0, 2));
  });

  it("cuando el borne pasa por encima del último codo, se rehace el tramo final", () => {
    const doc = docExtremo(false);
    aplicarYVolver(doc, new Mover(["c2"], -15, 0));
    expect(salida(doc, "w1", "hasta")).toBe("abajo");
  });
});

describe("salida del borne fijo con j = 0, en las 8 orientaciones", () => {
  it.each(ORIENTACIONES)("%s° espejado %s: el cable sigue saliendo del borne fijo por su dirección", (rot, espejado) => {
    // c1 fijo en la orientación dada; c2 (lámpara) a 14 unidades en la
    // dirección de salida de c1.A1, cable recto entre los dos.
    const doc = crearDocumento(meta);
    poner(doc, datos("contactor.bobina", 0, 0, rot, espejado));
    const a1 = borneDe(indexarHoja(doc.hojas[0]!).componentes.get("c1")!, "A1")!;
    const [vx, vy] = { derecha: [1, 0], izquierda: [-1, 0], abajo: [0, 1], arriba: [0, -1] }[a1.direccion];
    // La lámpara, girada para que su X2 mire hacia c1: X2 en (0, 2) mirando abajo.
    const rotLampara: Record<Direccion, Rotacion> = { arriba: 0, derecha: 90, abajo: 180, izquierda: 270 };
    const r = rotLampara[a1.direccion];
    const ox = { 0: [0, 2], 90: [-2, 0], 180: [0, -2], 270: [2, 0] }[r];
    poner(doc, datos("senalizacion.lampara", a1.x + vx * 14 - ox[0]!, a1.y + vy * 14 - ox[1]!, r));
    tender(doc, "w1", borne("c1", "A1"), borne("c2", "X2"));
    expect(recorrido(doc, "w1").length).toBe(4);
    // Correr la lámpara de costado: recto ya no se puede, hay que rutear desde F.
    const lado = a1.direccion === "arriba" || a1.direccion === "abajo" ? [4, 0] : [0, 4];
    aplicarYVolver(doc, new Mover(["c2"], lado[0]!, lado[1]!));
    expect(salida(doc, "w1", "desde")).toBe(a1.direccion);
  });
});

// ── Grupos y selección ─────────────────────────────────────────────────────

/**
 * Bobina c1 (0, 0) y pulsador c2 (8, 0), con w1 interno (c1.A1 → c2.13);
 * lámpara c3 (−10, 12) fija, con w2 externo (c1.A2 → c3.X1).
 */
function docGrupo(): Documento {
  const doc = crearDocumento(meta);
  poner(doc, datos("contactor.bobina", 0, 0));
  poner(doc, datos("pulsador.na", 8, 0));
  poner(doc, datos("senalizacion.lampara", -10, 12));
  rutear(doc, "w1", borne("c1", "A1"), borne("c2", "13"));
  rutear(doc, "w2", borne("c1", "A2"), borne("c3", "X1"));
  return doc;
}

describe("grupo con cables internos y externos", () => {
  it("al mover, el interno se traslada entero y el externo se acomoda", () => {
    const doc = docGrupo();
    const w1 = copia(doc.hojas[0]!.cables[0]!);
    aplicarYVolver(doc, new Mover(["c1", "c2"], 5, -3));
    expect(doc.hojas[0]!.cables[0]!.codos).toEqual(w1.codos.map(([x, y]) => [x + 5, y - 3]));
    expect(salida(doc, "w2", "desde")).toBe("abajo");
  });

  it.each([
    ["R", { tipo: "rotar", sentido: 90 }, () => new Rotar(["c1", "c2"], 90)],
    ["Mayús+R", { tipo: "rotar", sentido: -90 }, () => new Rotar(["c1", "c2"], -90)],
    ["M", { tipo: "espejar" }, () => new Espejar(["c1", "c2"])],
  ] as [string, Operacion, () => Comando][])("%s: el interno gira entero con el grupo", (_, op, crear) => {
    const doc = docGrupo();
    const plan = planearTransformacion(doc.hojas[0]!, ["c1", "c2"], op, entornoLineal(doc.hojas[0]!));
    expect(plan.plan.rigidos.has("w1")).toBe(true);
    expect(plan.plan.rigidos.has("w2")).toBe(false);
    aplicarYVolver(doc, crear());
  });

  it("un cable seleccionado de borde se acomoda como uno no seleccionado", () => {
    const doc = docGrupo();
    const plan = planearTransformacion(doc.hojas[0]!, ["c1", "w2"], { tipo: "mover", dx: 3, dy: 0 }, entornoLineal(doc.hojas[0]!));
    expect(plan.rechazo).toBeNull();
    expect(plan.plan.rigidos.has("w2")).toBe(false);
    aplicarYVolver(doc, new Mover(["c1", "w2"], 3, 0));
  });

  it("una selección que no mueve nada avisa y no cambia nada", () => {
    const doc = docGrupo();
    expect(rechazado(doc, new Mover(["w2"], 3, 0))).toBe(MENSAJE_NADA_SE_MUEVE_UNO);
    expect(rechazado(doc, new Rotar(["w2"], 90))).toBe(MENSAJE_NADA_SE_MUEVE_UNO);
  });

  it("un puente gira entero con su componente", () => {
    const doc = crearDocumento(meta);
    poner(doc, datos("senalizacion.lampara", 0, 0));
    tender(doc, "w1", borne("c1", "X1"), borne("c1", "X2"), [
      [0, -4],
      [3, -4],
      [3, 4],
      [0, 4],
    ]);
    const plan = planearTransformacion(doc.hojas[0]!, ["c1"], { tipo: "rotar", sentido: 90 }, entornoLineal(doc.hojas[0]!));
    expect(plan.plan.rigidos.has("w1")).toBe(true);
    aplicarYVolver(doc, new Rotar(["c1"], 90));
    expect(doc.hojas[0]!.cables[0]!.codos).toEqual([
      [4, 0],
      [4, 3],
      [-4, 3],
      [-4, 0],
    ]);
  });

  it("dos cables del mismo borne se acomodan sin encimarse", () => {
    const doc = crearDocumento(meta);
    poner(doc, datos("contactor.bobina", 0, 0));
    poner(doc, datos("senalizacion.lampara", -10, -14));
    poner(doc, datos("senalizacion.lampara", 10, -14));
    tender(doc, "w1", borne("c1", "A1"), borne("c2", "X2"), [
      [0, -8],
      [-10, -8],
    ]);
    tender(doc, "w2", borne("c1", "A1"), borne("c3", "X2"), [[10, -2]]);
    aplicarYVolver(doc, new Mover(["c1"], 0, -3));
    aplicarYVolver(doc, new Mover(["c1"], 2, 1));
  });
});

// ── Caja del grupo ─────────────────────────────────────────────────────────

/**
 * La escena de t12: c1 bobina K1 (−6, 0), c2 pulsador S1 (0, 0); w1 de A1 a
 * 13 recto, w2 de A2 a 14 por abajo. w9 suelto, con los dos extremos libres
 * (rígido si se lo selecciona), lejos.
 */
function docCaja(): Documento {
  const doc = crearDocumento(meta);
  poner(doc, datos("contactor.bobina", -6, 0));
  poner(doc, datos("pulsador.na", 0, 0));
  tender(doc, "w1", borne("c1", "A1"), borne("c2", "13"));
  tender(doc, "w2", borne("c1", "A2"), borne("c2", "14"), [
    [-6, 5],
    [0, 5],
  ]);
  tender(doc, "w9", libre(20, 0), libre(25, 3), [[25, 0]]);
  return doc;
}

const OPS_CAJA: [string, Operacion, (ids: string[]) => Comando][] = [
  ["R", { tipo: "rotar", sentido: 90 }, (ids) => new Rotar(ids, 90)],
  ["Mayús+R", { tipo: "rotar", sentido: -90 }, (ids) => new Rotar(ids, -90)],
  ["M", { tipo: "espejar" }, (ids) => new Espejar(ids)],
];

describe("caja del grupo: solo lo que se transforma", () => {
  it.each(OPS_CAJA)("%s con un componente y sus cables seleccionados (que no son rígidos) = el componente solo", (_, op, crear) => {
    const doc = docCaja();
    const hoja = doc.hojas[0]!;
    const mezcla = planearTransformacion(hoja, ["c1", "w1", "w2"], op, entornoLineal(hoja));
    const solo = planearTransformacion(hoja, ["c1"], op, entornoLineal(hoja));
    expect(mezcla.rechazo).toBeNull();
    expect(mezcla.plan.rigidos.size).toBe(0);
    expect(mezcla.plan.componentes).toEqual(solo.plan.componentes);
    expect(mezcla.plan.cables).toEqual(solo.plan.cables);
    // Antes, la caja sumaba w1 y w2: el eje caía en x = −3 y K1 terminaba sobre S1.
    if (op.tipo === "espejar") expect(mezcla.plan.componentes[0]!.pose).toMatchObject({ x: -6, y: 0 });
    aplicarYVolver(doc, crear(["c1", "w1", "w2"]));
  });

  it.each(OPS_CAJA)("%s con solo cables: la caja es la de los rígidos", (_, op, crear) => {
    const doc = docCaja();
    const hoja = doc.hojas[0]!;
    const conAtado = planearTransformacion(hoja, ["w9", "w1"], op, entornoLineal(hoja));
    const soloRigido = planearTransformacion(hoja, ["w9"], op, entornoLineal(hoja));
    expect(conAtado.rechazo).toBeNull();
    expect([...conAtado.plan.rigidos]).toEqual(["w9"]);
    expect(conAtado.plan.cables).toEqual(soloRigido.plan.cables);
    aplicarYVolver(doc, crear(["w9", "w1"]));
  });

  it.each(OPS_CAJA)("%s con solo cables y ninguno rígido: avisa y no cambia nada", (_, op, crear) => {
    const doc = docCaja();
    const hoja = doc.hojas[0]!;
    const r = planearTransformacion(hoja, ["w1", "w2"], op, entornoLineal(hoja));
    expect(r.rechazo?.motivo).toBe(MENSAJE_NADA_SE_MUEVE_VARIOS);
    expect(rechazado(doc, crear(["w1", "w2"]))).toBe(MENSAJE_NADA_SE_MUEVE_VARIOS);
  });

  it("un borne que cae sobre otro borne es el motivo, antes que el cable sin camino", () => {
    const doc = docCaja();
    const hoja = doc.hojas[0]!;
    const r = planearTransformacion(hoja, ["c1"], { tipo: "mover", dx: 6, dy: 0 }, entornoLineal(hoja));
    expect(r.rechazo).not.toBeNull();
    expect(r.rechazo!.conflictos[0]!.clave.startsWith("borneBorne|")).toBe(true);
    expect(r.rechazo!.motivo).toMatch(/^No se puede mover acá: el borne .* quedaría sobre el borne .* sin conectarse\.$/);
    expect(r.rechazo!.motivo).not.toMatch(/\b[cw]\d+\b/);
    expect(rechazado(doc, new Mover(["c1"], 6, 0))).toBe(r.rechazo!.motivo);
  });
});

// ── Reintento ──────────────────────────────────────────────────────────────

describe("reintento entre cables rehechos", () => {
  /**
   * Bobinas c1 (0, 0) y c2 (3, 0), que se mueven juntas; lámparas c3 (0, −22)
   * y c4 (3, −22) fijas. Cables rectos y paralelos de c1.A1 a c3.X2 y de
   * c2.A1 a c4.X2. Moverlas 4 a la derecha: los dos eligen la Z por la mitad
   * y se enciman; el reintento los separa.
   */
  function docParalelos(invertirIds: boolean): Documento {
    const doc = crearDocumento(meta);
    poner(doc, datos("contactor.bobina", 0, 0));
    poner(doc, datos("contactor.bobina", 3, 0));
    poner(doc, datos("senalizacion.lampara", 0, -22));
    poner(doc, datos("senalizacion.lampara", 3, -22));
    const [a, b] = invertirIds ? ["w2", "w1"] : ["w1", "w2"];
    if (invertirIds) {
      tender(doc, b, borne("c2", "A1"), borne("c4", "X2"));
      tender(doc, a, borne("c1", "A1"), borne("c3", "X2"));
    } else {
      tender(doc, a, borne("c1", "A1"), borne("c3", "X2"));
      tender(doc, b, borne("c2", "A1"), borne("c4", "X2"));
    }
    return doc;
  }

  /** Los cables por el componente donde empiezan, sin ids. */
  function porComponente(doc: Documento): Record<string, [number, number][]> {
    const salida: Record<string, [number, number][]> = {};
    for (const w of doc.hojas[0]!.cables) if (w.desde.tipo === "borne") salida[w.desde.comp] = w.codos;
    return salida;
  }

  it("se acomodan, y el resultado no depende de los ids", () => {
    const a = aplicarYVolver(docParalelos(false), new Mover(["c1", "c2"], 4, 0));
    const b = aplicarYVolver(docParalelos(true), new Mover(["c1", "c2"], 4, 0));
    expect(porComponente(b)).toEqual(porComponente(a));
    // Sin encimarse.
    const hoja = a.hojas[0]!;
    const consulta = consultaHoja(hoja);
    for (const w of hoja.cables) {
      const otros = {
        ...consulta,
        cablesEn: (k: Parameters<typeof consulta.cablesEn>[0]) => [...consulta.cablesEn(k)].filter((x) => x.id !== w.id),
      };
      const p = problemasTrazado({ id: w.id, desde: w.desde, hasta: w.hasta, puntos: recorridoCable(indexarHoja(hoja), w)! }, otros);
      expect(p.filter((c) => c.clave.startsWith("encimado"))).toEqual([]);
    }
  });
});

// ── Claves por par ─────────────────────────────────────────────────────────

describe("claves de conflicto por par", () => {
  /**
   * c1 bobina (0, 0) y c2 pulsador (6, 0) con w5 interno por arriba (y = −6).
   * w8 libre de (−20, −6) a (20, −6), encimado con w5 desde antes; w9 libre
   * de (22, −6) a (40, −6).
   */
  function docPar(): Documento {
    const doc = crearDocumento(meta);
    poner(doc, datos("contactor.bobina", 0, 0));
    poner(doc, datos("pulsador.na", 6, 0));
    tender(doc, "w5", borne("c1", "A1"), borne("c2", "13"), [
      [0, -6],
      [6, -6],
    ]);
    tender(doc, "w8", libre(-20, -6), libre(20, -6));
    tender(doc, "w9", libre(22, -6), libre(40, -6));
    return doc;
  }

  it("un encimado viejo (w5 con w8) no frena una operación que lo conserva", () => {
    aplicarYVolver(docPar(), new Mover(["c1", "c2"], 3, 0));
  });

  it("un encimado viejo de w5 con w8 no tapa uno nuevo de w5 con w9", () => {
    const doc = docPar();
    const r = planearTransformacion(doc.hojas[0]!, ["c1", "c2"], { tipo: "mover", dx: 18, dy: 0 }, entornoLineal(doc.hojas[0]!));
    expect(r.rechazo).not.toBeNull();
    expect(r.rechazo!.conflictos.some((c) => c.clave === "encimado|cable:w5|cable:w9")).toBe(true);
    expect(r.rechazo!.conflictos.some((c) => c.clave.includes("w8"))).toBe(false);
    expect(r.rechazo!.motivo).toBe("No se puede mover acá: un cable se encimaría con otro cable.");
    rechazado(doc, new Mover(["c1", "c2"], 18, 0));
  });

  it("borne con cable y cable con cable dan claves del par, iguales vistas desde los dos lados", () => {
    const doc = crearDocumento(meta);
    poner(doc, datos("contactor.bobina", 0, 0));
    tender(doc, "w1", libre(-5, -2), libre(5, -2));
    const hoja = doc.hojas[0]!;
    const consulta = consultaHoja(hoja);
    const desdeCable = problemasTrazado(
      { id: "w1", desde: libre(-5, -2), hasta: libre(5, -2), puntos: [-5, -2, 5, -2] },
      {
        ...consulta,
        cablesEn: () => [],
      },
    );
    const g = geometriaComponente(hoja.componentes[0]!)!;
    const desdeBorne = problemasComponente(g, consulta);
    expect(desdeCable.map((c) => c.clave)).toEqual(["borne|borne:c1:A1|cable:w1"]);
    expect(desdeBorne.map((c) => c.clave)).toEqual(["borne|borne:c1:A1|cable:w1"]);
    expect(desdeBorne[0]!.mensaje).toBe("El borne Bobina de contactor · A1 quedaría sobre un cable sin conectarse.");
  });
});

// ── T en cadena y ciclos ───────────────────────────────────────────────────

/**
 * Bobina c1 (0, 0) y lámpara c2 (20, −10). A (w1): c1.A1 → (0, −6) → (20, −6)
 * → c2.X2 (20, −8). B (w2): T sobre A en (4, −6) → libre (4, −14), con C (w3):
 * T sobre B en (4, −10) → libre (10, −10).
 */
function docCadena(): Documento {
  const doc = crearDocumento(meta);
  poner(doc, datos("contactor.bobina", 0, 0));
  poner(doc, datos("senalizacion.lampara", 20, -10));
  tender(doc, "w1", borne("c1", "A1"), borne("c2", "X2"), [
    [0, -6],
    [20, -6],
  ]);
  tender(doc, "w2", enCable("w1", 4, -6), libre(4, -14));
  tender(doc, "w3", enCable("w2", 4, -10), libre(10, -10));
  return doc;
}

describe("T en cadena", () => {
  it("un movimiento que no toca el tramo de la T no cambia la cadena", () => {
    const doc = docCadena();
    const antes = copia(doc.hojas[0]!.cables.slice(1));
    aplicarYVolver(doc, new Mover(["c1"], 0, 1));
    expect(doc.hojas[0]!.cables.slice(1)).toEqual(antes);
  });

  it("si el tramo de la T se corre, B pasa al punto más cercano de A y C lo sigue", () => {
    const doc = docCadena();
    // Bajar la lámpara: el tramo y = −6 de A cambia con la Z del rehecho.
    aplicarYVolver(doc, new Mover(["c1"], 0, -3));
    const hoja = doc.hojas[0]!;
    const indice = indexarHoja(hoja);
    const [a, b, c] = hoja.cables as [Cable, Cable, Cable];
    expect(b.desde.tipo).toBe("cable");
    expect(c.desde.tipo).toBe("cable");
    const pa = recorridoCable(indice, a)!;
    const pb = recorridoCable(indice, b)!;
    const db = b.desde as Extract<Extremo, { tipo: "cable" }>;
    const dc = c.desde as Extract<Extremo, { tipo: "cable" }>;
    expect(puntoSobreRecorrido(pa, db.x, db.y)).toBe(true);
    expect(puntoSobreRecorrido(pb, dc.x, dc.y)).toBe(true);
  });

  it("puntosParaT: el más cercano por tramo, sin los extremos del anfitrión", () => {
    expect(puntosParaT([0, 0, 10, 0, 10, 8], 4, 3)).toEqual([
      { x: 4, y: 0 },
      { x: 10, y: 3 },
    ]);
    // Más allá de la punta: no la punta misma.
    expect(puntosParaT([0, 0, 10, 0], -3, 0)).toEqual([{ x: 1, y: 0 }]);
  });

  it("al girar, la cadena queda válida y deshacer es exacto", () => {
    aplicarYVolver(docCadena(), new Rotar(["c1"], 90));
    aplicarYVolver(docCadena(), new Espejar(["c2"]));
  });
});

/**
 * Bobina c1 (0, 0) y pulsador c2 (10, 0). A (w1): c1.A1 (0, −2) → (0, −6) →
 * (6, −6) → T sobre B en (6, −4). B (w2): c2.13 (10, −2) → (10, −4) → (3, −4)
 * → T sobre A en (3, −6). Cada uno se apoya en el otro.
 */
function docCiclo(): Documento {
  const doc = crearDocumento(meta);
  poner(doc, datos("contactor.bobina", 0, 0));
  poner(doc, datos("pulsador.na", 10, 0));
  poner(doc, datos("senalizacion.lampara", 40, 0));
  const hoja = doc.hojas[0]!;
  hoja.cables.push(
    {
      id: "w1",
      desde: borne("c1", "A1"),
      hasta: enCable("w2", 6, -4),
      codos: [
        [0, -6],
        [6, -6],
      ],
    },
    {
      id: "w2",
      desde: borne("c2", "13"),
      hasta: enCable("w1", 3, -6),
      codos: [
        [10, -4],
        [3, -4],
      ],
    },
    // Un ciclo sin relación con nada de lo que se mueve.
    { id: "w3", desde: libre(30, -10), hasta: enCable("w4", 36, -8), codos: [[36, -10]] },
    { id: "w4", desde: libre(40, -8), hasta: enCable("w3", 33, -10), codos: [[33, -8]] },
  );
  return doc;
}

describe("ciclos de apoyos", () => {
  it("la hoja del ciclo es válida", () => {
    expect(validarHoja(docCiclo().hojas[0]!)).toEqual([]);
  });

  it("un ciclo que se mueve entero anda", () => {
    const doc = docCiclo();
    const r = planearTransformacion(doc.hojas[0]!, ["c1", "c2"], { tipo: "mover", dx: 5, dy: 3 }, entornoLineal(doc.hojas[0]!));
    expect([...r.plan.rigidos].sort()).toEqual(["w1", "w2"]);
    aplicarYVolver(doc, new Mover(["c1", "c2"], 5, 3));
    aplicarYVolver(doc, new Rotar(["c1", "c2"], 90));
  });

  it("un ciclo que habría que rehacer se rechaza sin cambiar nada", () => {
    expect(rechazado(docCiclo(), new Mover(["c1"], 0, 5))).toBe(MENSAJE_CICLO);
  });

  it("un ciclo sin relación con lo movido no se mueve", () => {
    const doc = docCiclo();
    const r = planearTransformacion(doc.hojas[0]!, ["c3"], { tipo: "mover", dx: 0, dy: 4 }, entornoLineal(doc.hojas[0]!));
    expect(r.plan.rigidos.size).toBe(0);
    expect(r.plan.zona.size).toBe(0);
    const antes = copia(doc.hojas[0]!.cables);
    aplicarYVolver(doc, new Mover(["c3"], 0, 4));
    expect(doc.hojas[0]!.cables).toEqual(antes);
  });

  it("el resultado no depende del orden de los cables en la hoja", () => {
    const a = docCiclo();
    const b = docCiclo();
    b.hojas[0]!.cables.reverse();
    new Mover(["c1", "c2"], 5, 3).aplicar(a);
    new Mover(["c1", "c2"], 5, 3).aplicar(b);
    const ordenar = (d: Documento) => [...d.hojas[0]!.cables].sort((x, y) => (x.id < y.id ? -1 : 1));
    expect(ordenar(b)).toEqual(ordenar(a));
  });
});

// ── Al azar ────────────────────────────────────────────────────────────────

/** Generador de números con semilla (mulberry32): la misma semilla da la misma secuencia. */
function generador(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEMILLA = 20261108;

/** Pares de elementos en conflicto en toda la hoja (sin "sin salidas", que es una regla de W). */
function paresEnConflicto(hoja: Hoja): Set<string> {
  const indice = indexarHoja(hoja);
  const consulta = consultaHoja(hoja, indice);
  const pares = new Set<string>();
  const anotar = (clave: string) => {
    const [tipo, a, b] = clave.split("|");
    if (tipo === "sinSalidas") return;
    pares.add(`${a}|${b}`);
  };
  for (const w of hoja.cables) {
    const puntos = recorridoCable(indice, w)!;
    const sin = {
      ...consulta,
      cablesEn: (k: Parameters<typeof consulta.cablesEn>[0]) => [...consulta.cablesEn(k)].filter((x) => x.id !== w.id),
    };
    for (const c of problemasTrazado({ id: w.id, desde: w.desde, hasta: w.hasta, puntos }, sin)) anotar(c.clave);
  }
  for (const c of hoja.componentes) {
    const g = geometriaComponente(c);
    if (g) for (const k of problemasComponente(g, consulta)) anotar(k.clave);
  }
  return pares;
}

/** Un documento chico al azar: componentes en una grilla, cables entre bornes, T y sueltos. */
function docAzar(azar: () => number): Documento {
  const doc = crearDocumento(meta);
  const tipos = SIMBOLOS.map((s) => s.tipo);
  const rotaciones: Rotacion[] = [0, 90, 180, 270];
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      if (azar() < 0.35) continue;
      const tipo = tipos[Math.floor(azar() * tipos.length)]!;
      poner(
        doc,
        datos(tipo, i * 10 + Math.floor(azar() * 3), j * 10 + Math.floor(azar() * 3), rotaciones[Math.floor(azar() * 4)]!, azar() < 0.5),
      );
    }
  }
  const hoja = doc.hojas[0]!;
  const bornes = hoja.componentes.flatMap((c) => buscarSimbolo(c.tipo)!.bornes.map((b) => borne(c.id, b.nombre)));
  let n = 1;
  for (let k = 0; k < 14 && bornes.length > 1; k++) {
    const a = bornes[Math.floor(azar() * bornes.length)]!;
    const b = bornes[Math.floor(azar() * bornes.length)]!;
    if (a === b) continue;
    try {
      rutear(doc, `w${n}`, a, b);
      n++;
    } catch {
      // sin ruta: se sigue
    }
  }
  // Derivaciones en T desde el medio de un tramo de un cable hasta un borne.
  for (let k = 0; k < 5 && hoja.cables.length > 0; k++) {
    const host = hoja.cables[Math.floor(azar() * hoja.cables.length)]!;
    const p = recorridoCable(indexarHoja(hoja), host)!;
    const i = Math.floor(azar() * (p.length / 2 - 1));
    const x0 = p[2 * i]!;
    const y0 = p[2 * i + 1]!;
    const x1 = p[2 * i + 2]!;
    const y1 = p[2 * i + 3]!;
    const largo = Math.abs(x1 - x0) + Math.abs(y1 - y0);
    if (largo < 2) continue;
    const s = 1 + Math.floor(azar() * (largo - 1));
    const tx = x0 + Math.sign(x1 - x0) * s;
    const ty = y0 + Math.sign(y1 - y0) * s;
    const destino = bornes[Math.floor(azar() * bornes.length)]!;
    try {
      rutear(doc, `w${n}`, enCable(host.id, tx, ty), destino);
      n++;
    } catch {
      // sin ruta
    }
  }
  // Un cable suelto.
  try {
    rutear(doc, `w${n}`, libre(-6, -6), libre(-6, -2));
  } catch {
    // ocupado
  }
  return doc;
}

describe("al azar, con semilla fija", () => {
  it(`500 operaciones (semilla ${SEMILLA}): rechazadas sin cambios, o válidas, sin conflictos nuevos y con deshacer y rehacer exactos`, () => {
    const azar = generador(SEMILLA);
    let aceptadas = 0;
    let rechazadas = 0;
    for (let d = 0; d < 25; d++) {
      const doc = docAzar(azar);
      expect(validarHoja(doc.hojas[0]!), `semilla ${SEMILLA}, documento ${d}`).toEqual([]);
      for (let k = 0; k < 20; k++) {
        const contexto = `semilla ${SEMILLA}, documento ${d}, operación ${k}`;
        const hoja = doc.hojas[0]!;
        const todos = [...hoja.componentes.map((c) => c.id), ...hoja.cables.map((w) => w.id)];
        const ids = todos.filter(() => azar() < 0.25);
        if (ids.length === 0) ids.push(todos[Math.floor(azar() * todos.length)]!);
        const r = azar();
        const cmd: Comando =
          r < 0.5
            ? new Mover(ids, Math.floor(azar() * 9) - 4, Math.floor(azar() * 9) - 4)
            : r < 0.7
              ? new Rotar(ids, 90)
              : r < 0.85
                ? new Rotar(ids, -90)
                : new Espejar(ids);
        const antes = copia(doc);
        const paresAntes = paresEnConflicto(hoja);
        try {
          cmd.aplicar(doc);
        } catch (e) {
          rechazadas++;
          expect(doc, `${contexto}: ${(e as Error).message}`).toEqual(antes);
          continue;
        }
        aceptadas++;
        expect(validarHoja(doc.hojas[0]!), contexto).toEqual([]);
        const nuevos = [...paresEnConflicto(doc.hojas[0]!)].filter((p) => !paresAntes.has(p));
        expect(nuevos, contexto).toEqual([]);
        const despues = copia(doc);
        cmd.deshacer(doc);
        expect(doc, contexto).toEqual(antes);
        cmd.aplicar(doc);
        expect(doc, contexto).toEqual(despues);
      }
    }
    // Que la prueba pruebe algo: hay de las dos.
    expect(aceptadas).toBeGreaterThan(100);
    expect(rechazadas).toBeGreaterThan(10);
  });
});

// ── Codos que no se acumulan ───────────────────────────────────────────────

/**
 * Marcha-parada tendida como W, con KM1 en el medio: L, S0 (NC), S1 (NA),
 * K1 13-14 en paralelo con S1, bobina KM1 y Neutro. `conLampara`: H1 en
 * paralelo con la bobina, colgada en T de los cables de A1 y de A2; sin
 * ella, cada borne de KM1 tiene un solo cable directo (la escena de las
 * fotos de la acumulación de codos).
 */
function docMarchaParada(conLampara: boolean): { doc: Documento; km1: string } {
  const doc = crearDocumento(meta);
  const L = poner(doc, datos("fuente.fase", 0, 0));
  const S0 = poner(doc, datos("pulsador.nc", 0, 5));
  const S1 = poner(doc, datos("pulsador.na", 0, 11));
  const K1 = poner(doc, datos("contactor.auxiliar_na", 10, 11));
  const KM1 = poner(doc, datos("contactor.bobina", 0, 22));
  const N = poner(doc, datos("fuente.neutro", 0, 33, 180));
  rutear(doc, "w1", borne(L, "L"), borne(S0, "11"));
  rutear(doc, "w2", borne(S0, "12"), borne(S1, "13"));
  rutear(doc, "w3", borne(S0, "12"), borne(K1, "13"));
  rutear(doc, "w4", borne(S1, "14"), borne(KM1, "A1"));
  rutear(doc, "w5", borne(K1, "14"), borne(S1, "14"));
  rutear(doc, "w7", borne(KM1, "A2"), borne(N, "N"));
  if (conLampara) {
    const H1 = poner(doc, datos("senalizacion.lampara", 16, 22));
    rutear(doc, "w6", enCable("w4", 0, 16), borne(H1, "X1"));
    rutear(doc, "w8", enCable("w7", 0, 28), borne(H1, "X2"));
  }
  expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  return { doc, km1: KM1 };
}

/** Conflictos de toda la hoja por par y punto ("clave@x,y"), sin "sin salidas" (regla de W). */
function conflictosHoja(hoja: Hoja): Set<string> {
  const indice = indexarHoja(hoja);
  const consulta = consultaHoja(hoja, indice);
  const s = new Set<string>();
  const anotar = (c: { clave: string; x: number; y: number }) => {
    if (!c.clave.startsWith("sinSalidas|")) s.add(`${c.clave}@${c.x},${c.y}`);
  };
  for (const w of hoja.cables) {
    const puntos = recorridoCable(indice, w)!;
    const sin = {
      ...consulta,
      cablesEn: (k: Parameters<typeof consulta.cablesEn>[0]) => [...consulta.cablesEn(k)].filter((x) => x.id !== w.id),
    };
    for (const c of problemasTrazado({ id: w.id, desde: w.desde, hasta: w.hasta, puntos }, sin)) anotar(c);
  }
  for (const c of hoja.componentes) {
    const g = geometriaComponente(c);
    if (g) for (const k of problemasComponente(g, consulta)) anotar(k);
  }
  return s;
}

/** Codos del ruteo fresco de W para `w` (contra el resto de la hoja), o null si no hay uno válido de 2 codos o menos. */
function codosFresco(hoja: Hoja, w: Cable): number | null {
  const consulta = consultaHoja({ ...hoja, cables: hoja.cables.filter((k) => k.id !== w.id) });
  const d = rutaDe(hoja, w.desde);
  const h = rutaDe(hoja, w.hasta);
  const c = codos(d, h, (k) => problemasTrazado({ id: w.id, desde: w.desde, hasta: w.hasta, puntos: [d.x, d.y, ...k.flat(), h.x, h.y] }, consulta).length === 0);
  return c ? c.length : null;
}

/**
 * Aplica `cmd` y comprueba: rechazado sin cambios, o aceptado con la hoja
 * válida, cada cable con codos ≤ fresco + 2 (4 sin fresco), sin tocarse a sí
 * mismo, sin conflictos nuevos por par y punto, y deshacer y rehacer exactos.
 * Devuelve si se aceptó.
 */
function operarSinAcumular(doc: Documento, cmd: Comando, contexto: string): boolean {
  const antes = copia(doc);
  const conflictosAntes = conflictosHoja(doc.hojas[0]!);
  try {
    cmd.aplicar(doc);
  } catch (e) {
    expect(doc, `${contexto}: ${(e as Error).message}`).toEqual(antes);
    return false;
  }
  const hoja = doc.hojas[0]!;
  expect(validarHoja(hoja), contexto).toEqual([]);
  const indice = indexarHoja(hoja);
  for (const w of hoja.cables) {
    const f = codosFresco(hoja, w);
    expect(w.codos.length, `${contexto}, ${w.id} (fresco ${f ?? "—"})`).toBeLessThanOrEqual(f === null ? 4 : f + 2);
    expect(seTocaASiMismo(recorridoCable(indice, w)!), `${contexto}, ${w.id} se toca a sí mismo`).toBe(false);
  }
  const nuevos = [...conflictosHoja(hoja)].filter((c) => !conflictosAntes.has(c));
  expect(nuevos, contexto).toEqual([]);
  const despues = copia(doc);
  cmd.deshacer(doc);
  expect(doc, contexto).toEqual(antes);
  cmd.aplicar(doc);
  expect(doc, contexto).toEqual(despues);
  return true;
}

describe("los codos no se acumulan", () => {
  it("marcha-parada con H1 en T: 10 × R, 10 × M y 10 movimientos de KM1 (semilla fija)", () => {
    const { doc, km1 } = docMarchaParada(true);
    const azar = generador(SEMILLA);
    let aceptadas = 0;
    for (let k = 0; k < 30; k++) {
      const cmd =
        k < 10 ? new Rotar([km1], 90) : k < 20 ? new Espejar([km1]) : new Mover([km1], Math.floor(azar() * 7) - 3, Math.floor(azar() * 7) - 3);
      if (operarSinAcumular(doc, cmd, `semilla ${SEMILLA}, operación ${k}`)) aceptadas++;
    }
    expect(aceptadas).toBeGreaterThanOrEqual(20);
  });

  it("marcha-parada sin H1 (un cable directo por borne de KM1): 10 × R, todas aceptadas", () => {
    const { doc, km1 } = docMarchaParada(false);
    for (let k = 0; k < 10; k++) expect(operarSinAcumular(doc, new Rotar([km1], 90), `R número ${k + 1}`), `R número ${k + 1}`).toBe(true);
  });

  it("4 × R sobre KM1 sin H1 vuelve a los cables rectos", () => {
    const { doc, km1 } = docMarchaParada(false);
    const antes = copia(doc);
    for (let k = 0; k < 4; k++) new Rotar([km1], 90).aplicar(doc);
    expect(doc.hojas[0]!.cables.find((w) => w.id === "w4")!.codos).toEqual(antes.hojas[0]!.cables.find((w) => w.id === "w4")!.codos);
    expect(doc.hojas[0]!.cables.find((w) => w.id === "w7")!.codos).toEqual(antes.hojas[0]!.cables.find((w) => w.id === "w7")!.codos);
  });
});
