import { describe, expect, it } from "vitest";
import { datos, docCables, meta } from "../io/prueba-documentos";
import type { Rotacion } from "../symbols";
import { indexarHoja, recorridoCable, validarHoja } from "./cables";
import { crearDocumento, generarId, PREFIJO_CABLE, type Cable, type Componente, type Documento, type Extremo } from "./documento";
import { pegar, Pegar, problemasPegado, recortar, recorteVacio, type Recorte } from "./portapapeles";
import { comprobarControl, comprobarRedes, mapaPegado, par, unionesEsperadas } from "./prueba-portapapeles";
import { redes } from "./redes";
import { consultaHoja, geometriaComponente, problemasComponente, problemasTrazado, type Conflicto } from "./trazado";
import { uniones } from "./uniones";

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ── Armado ─────────────────────────────────────────────────────────────────

function poner(doc: Documento, tipo: string, x: number, y: number, etiqueta = "", rot: Rotacion = 0): Componente {
  const c = { id: generarId(doc), ...datos(tipo, x, y, rot), etiqueta };
  doc.hojas[0]!.componentes.push(c);
  return c;
}

function tender(doc: Documento, desde: Extremo, hasta: Extremo, codos: [number, number][] = []): Cable {
  const w = { id: generarId(doc, PREFIJO_CABLE), desde, hasta, codos };
  doc.hojas[0]!.cables.push(w);
  return w;
}

const borne = (c: Componente, nombre: string): Extremo => ({ tipo: "borne", comp: c.id, borne: nombre });
const enCable = (w: Cable, x: number, y: number): Extremo => ({ tipo: "cable", cable: w.id, x, y });
const libre = (x: number, y: number): Extremo => ({ tipo: "libre", x, y });

/** Ids de toda la hoja 0. */
const todo = (doc: Documento) => [...doc.hojas[0]!.componentes.map((c) => c.id), ...doc.hojas[0]!.cables.map((w) => w.id)];
const copiarTodo = (doc: Documento) => recortar(doc.hojas[0]!, todo(doc));
const idsDe = (r: Recorte) => [...r.componentes.map((c) => c.id), ...r.cables.map((w) => w.id)];

/**
 * K1 (c1) y H1 (c2) unidos por w1 (arriba) y w2 (abajo); S1 (c3) aparte.
 * - w3: T sobre w1 → libre; w4: T sobre w3 → libre (cadena w1 ← w3 ← w4).
 * - w5: S1·13 → T sobre w1. w6: H1·X2 → S1·14.
 * - w7: T sobre w1 → T sobre w2. w8: suelto en los dos extremos.
 */
function docBase(): Documento {
  const doc = crearDocumento(meta);
  const k1 = poner(doc, "contactor.bobina", 0, 0, "K1");
  const h1 = poner(doc, "senalizacion.lampara", 6, 0, "H1");
  const s1 = poner(doc, "pulsador.na", 20, 0, "S1");
  const w1 = tender(doc, borne(k1, "A1"), borne(h1, "X1"), [[0, -4], [6, -4]]);
  const w2 = tender(doc, borne(k1, "A2"), borne(h1, "X2"), [[0, 4], [6, 4]]);
  const w3 = tender(doc, enCable(w1, 3, -4), libre(3, -7));
  tender(doc, enCable(w3, 3, -6), libre(1, -6));
  tender(doc, borne(s1, "13"), enCable(w1, 4, -4), [[20, -10], [4, -10]]);
  tender(doc, borne(h1, "X2"), borne(s1, "14"));
  tender(doc, enCable(w1, 2, -4), enCable(w2, 2, 4));
  tender(doc, libre(-10, 0), libre(-10, 5));
  expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  return doc;
}

/** Fase "L1" → H1 → Neutro "N", en una columna. */
function docFuentes(): Documento {
  const doc = crearDocumento(meta);
  const l1 = poner(doc, "fuente.fase", 0, -6, "L1");
  const h1 = poner(doc, "senalizacion.lampara", 0, 0, "H1");
  const n = poner(doc, "fuente.neutro", 0, 6, "N", 180);
  tender(doc, borne(l1, "L"), borne(h1, "X1"));
  tender(doc, borne(h1, "X2"), borne(n, "N"));
  expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  return doc;
}

/** Pega y comprueba lo de siempre; devuelve el comando y el mapa de ids. */
function pegarYComprobar(doc: Documento, r: Recorte, dx: number, dy: number) {
  const antes = copia(doc.hojas[0]!);
  const cmd = pegar(doc, r, dx, dy);
  cmd.aplicar(doc);
  const despues = doc.hojas[0]!;
  expect(validarHoja(despues)).toEqual([]);
  expect(despues.componentes.length).toBe(antes.componentes.length + r.componentes.length);
  expect(despues.cables.length).toBe(antes.cables.length + r.cables.length);
  return { cmd, antes, mapa: mapaPegado(r, despues) };
}

// ── Recortar ───────────────────────────────────────────────────────────────

describe("recortar: qué entra", () => {
  const cables = (r: Recorte) => r.cables.map((w) => w.id);

  it("los cables internos elegidos, y un cable no elegido entre dos copiados (D2a-A)", () => {
    const r = recortar(docBase().hojas[0]!, ["c1", "c2", "w1", "w3", "w4"]);
    expect(r.componentes.map((c) => c.id)).toEqual(["c1", "c2"]);
    // w2 (borne-borne) y w7 (T-T) entran sin estar elegidos; w5 y w6 no.
    expect(cables(r)).toEqual(["w1", "w2", "w3", "w4", "w7"]);
  });

  it("un cable elegido con un extremo afuera no entra (D2b-A): en un borne o en una T", () => {
    const h = docBase().hojas[0]!;
    // w6 va a S1, que no se copia.
    expect(cables(recortar(h, ["c1", "c2", "w1", "w6"]))).toEqual(["w1", "w2", "w7"]);
    // w5 se apoya en w1, que no entra (K1 y H1 no se copian).
    expect(cables(recortar(h, ["c3", "w5"]))).toEqual([]);
    // w3 se apoya en w1, que tampoco entra.
    expect(cables(recortar(h, ["c1", "w1", "w3"]))).toEqual([]);
  });

  it("un extremo libre entra solo si el cable está elegido", () => {
    const h = docBase().hojas[0]!;
    expect(cables(recortar(h, ["c1", "c2", "w3"]))).toEqual(["w1", "w2", "w3", "w7"]);
    expect(cables(recortar(h, ["c1", "c2"]))).toEqual(["w1", "w2", "w7"]);
    expect(cables(recortar(h, ["w8"]))).toEqual(["w8"]);
    // Todo menos w8: w8 no entra solo por tener los extremos sueltos.
    expect(cables(recortar(h, ["c1", "c2", "c3"]))).toEqual(["w1", "w2", "w5", "w6", "w7"]);
  });

  it("una cadena de T entra entera, o se corta donde falta un eslabón", () => {
    const h = docBase().hojas[0]!;
    expect(cables(recortar(h, ["c1", "c2", "w3", "w4"]))).toEqual(["w1", "w2", "w3", "w4", "w7"]);
    // Sin w3 (suelto, no elegido), w4 se queda sin anfitrión.
    expect(cables(recortar(h, ["c1", "c2", "w4"]))).toEqual(["w1", "w2", "w7"]);
  });

  it("el orden no depende del orden de la hoja: entra igual con las T antes que su anfitrión", () => {
    const doc = docBase();
    doc.hojas[0]!.cables.reverse();
    expect(cables(recortar(doc.hojas[0]!, ["c1", "c2", "w3", "w4"]))).toEqual(["w7", "w4", "w3", "w2", "w1"]);
  });

  it("es una copia: cambiar el documento no cambia el recorte", () => {
    const doc = docBase();
    const r = recortar(doc.hojas[0]!, ["c1", "c2", "w3"]);
    const guardado = copia(r);
    doc.hojas[0]!.componentes[0]!.x = 99;
    doc.hojas[0]!.componentes[0]!.params["a"] = "b";
    doc.hojas[0]!.cables[0]!.codos[0]![0] = 99;
    expect(r).toEqual(guardado);
  });

  it("la caja abarca cuerpos y cables; vacía, el recorte no tiene caja", () => {
    const h = docBase().hojas[0]!;
    // K1: x -1..1, y -2..2; H1: x 5..7; w1 sube hasta y -4, w3 hasta -7, w4 va a x 1; w2 baja a 4.
    expect(recortar(h, ["c1", "c2", "w3", "w4"]).caja).toEqual({ x: -1, y: -7, ancho: 8, alto: 11 });
    const vacio = recortar(h, ["w3", "no-existe"]);
    expect(recorteVacio(vacio)).toBe(true);
    expect(vacio.caja).toBeNull();
  });
});

// ── Pegar ──────────────────────────────────────────────────────────────────

describe("pegar", () => {
  it("ida y vuelta: lo pegado es el original con ids nuevas y trasladado", () => {
    const doc = docCables();
    const original = copia(doc.hojas[0]!);
    const r = copiarTodo(doc);
    const dx = 37;
    const dy = -11;
    const { cmd, mapa } = pegarYComprobar(doc, r, dx, dy);
    expect(cmd.ids).toEqual([...mapa.values()]);
    const m = (id: string) => mapa.get(id)!;
    const mover = (e: Extremo): Extremo =>
      e.tipo === "borne" ? { ...e, comp: m(e.comp) } : e.tipo === "cable" ? { ...e, cable: m(e.cable), x: e.x + dx, y: e.y + dy } : { ...e, x: e.x + dx, y: e.y + dy };
    const hoja = doc.hojas[0]!;
    expect(hoja.componentes.slice(original.componentes.length)).toEqual(
      original.componentes.map((c) => ({ ...c, id: m(c.id), x: c.x + dx, y: c.y + dy })),
    );
    expect(hoja.cables.slice(original.cables.length)).toEqual(
      original.cables.map((w) => ({
        id: m(w.id),
        desde: mover(w.desde),
        hasta: mover(w.hasta),
        codos: w.codos.map(([x, y]) => [x + dx, y + dy]),
      })),
    );
    // Lo que ya estaba no cambió, y las etiquetas y params van iguales (D3-A).
    expect(hoja.componentes.slice(0, original.componentes.length)).toEqual(original.componentes);
    expect(hoja.cables.slice(0, original.cables.length)).toEqual(original.cables);
  });

  it("da las ids con generarId: primero componentes y después cables, en el orden del recorte", () => {
    const doc = docBase();
    const r = recortar(doc.hojas[0]!, ["c1", "c2", "w3", "w4"]);
    expect(pegar(doc, r, 0, 20).ids).toEqual(["c4", "c5", "w9", "w10", "w11", "w12", "w13"]);
    expect(doc.contadores).toEqual({ c: 6, w: 14 });
    // Otra vez, ids nuevas.
    expect(pegar(doc, r, 0, 40).ids).toEqual(["c6", "c7", "w14", "w15", "w16", "w17", "w18"]);
  });

  it("las uniones son las de antes más las del recorte trasladadas", () => {
    const doc = docBase();
    const r = recortar(doc.hojas[0]!, ["c1", "c2", "w3", "w4"]);
    const { antes, mapa } = pegarYComprobar(doc, r, 30, 2);
    const esperadas = unionesEsperadas(antes, r, mapa, 30, 2);
    expect(esperadas.length).toBeGreaterThan(uniones(antes).length);
    expect(uniones(doc.hojas[0]!)).toEqual(esperadas);
  });

  it("deshacer vuelve exacto (los contadores no bajan) y rehacer da lo mismo, con las mismas ids", () => {
    const doc = docBase();
    const r = recortar(doc.hojas[0]!, ["c1", "c2", "w3", "w4", "w8"]);
    const cmd = pegar(doc, r, -30, 0);
    const antes = copia(doc);
    const cambio = cmd.aplicar(doc);
    expect(cambio).toEqual({ componentes: ["c4", "c5"], cables: ["w9", "w10", "w11", "w12", "w13", "w14"] });
    const aplicado = copia(doc);
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);

    expect(cmd.deshacer(doc)).toEqual(cambio);
    expect(doc).toEqual(antes);
    expect(doc.contadores).toEqual({ c: 6, w: 15 });
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);

    expect(cmd.aplicar(doc)).toEqual(cambio);
    expect(doc).toEqual(aplicado);
    expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  });

  it("deshacer no cambia el orden de lo que había, aunque después se haya agregado algo", () => {
    const doc = docBase();
    const cmd = pegar(doc, copiarTodo(doc), 0, 30);
    const antes = copia(doc.hojas[0]!);
    cmd.aplicar(doc);
    const extra = { id: generarId(doc), ...datos("pulsador.nc", 50, 50) };
    doc.hojas[0]!.componentes.push(extra);
    cmd.deshacer(doc);
    expect(doc.hojas[0]!.componentes).toEqual([...antes.componentes, extra]);
    expect(doc.hojas[0]!.cables).toEqual(antes.cables);
  });

  it("un aplicar que falla deja el documento igual: una id que ya existe, o un cable inválido", () => {
    const doc = docBase();
    const cmd = pegar(doc, copiarTodo(doc), 0, 30);
    // Alguien ocupó la id de un cable que se iba a pegar (en otra hoja).
    doc.hojas.push({ nombre: "Hoja 2", componentes: [], cables: [{ id: cmd.ids.at(-1)!, desde: libre(0, 0), hasta: libre(0, 1), codos: [] }] });
    const antes = copia(doc);
    expect(() => cmd.aplicar(doc)).toThrow(/Ya existe el id/);
    expect(doc).toEqual(antes);

    // Un lote armado a mano con un tramo en diagonal: lo frena validarCable.
    const doc2 = docBase();
    const c = { id: "x1", ...datos("contactor.bobina", 40, 0) };
    const malo = new Pegar({ componentes: [c], cables: [{ id: "x2", desde: borne(c, "A1"), hasta: libre(45, -9), codos: [] }] });
    const antes2 = copia(doc2);
    expect(() => malo.aplicar(doc2)).toThrow(/inválido/);
    expect(doc2).toEqual(antes2);
    // Y la id repetida dentro del lote.
    const repetido = new Pegar({ componentes: [c, { ...c }], cables: [] });
    expect(() => repetido.aplicar(doc2)).toThrow(/Ya existe el id "x1"/);
    expect(doc2).toEqual(antes2);
  });

  it("deshacer tira sin tocar nada si falta algo de lo pegado", () => {
    const doc = docBase();
    const cmd = pegar(doc, copiarTodo(doc), 0, 30);
    cmd.aplicar(doc);
    doc.hojas[0]!.cables.pop();
    const antes = copia(doc);
    expect(() => cmd.deshacer(doc)).toThrow(/No existe/);
    expect(doc).toEqual(antes);
  });

  it("revisa el recorte y los números antes de gastar ids", () => {
    const doc = docBase();
    const contadores = { ...doc.contadores };
    const r = recortar(doc.hojas[0]!, ["c1", "c2", "w3"]);
    expect(() => pegar(doc, r, 0.5, 0)).toThrow(RangeError);
    expect(() => pegar(doc, recortar(doc.hojas[0]!, []), 0, 0)).toThrow("No hay nada para pegar.");
    // Un recorte que nombra algo de afuera (no lo arma `recortar`, pero un portapapeles serializado podría).
    const roto: Recorte = { ...r, cables: [...r.cables, { id: "w99", desde: borne(doc.hojas[0]!.componentes[2]!, "13"), hasta: libre(0, -20), codos: [] }] };
    expect(() => pegar(doc, roto, 0, 30)).toThrow(/no está en lo copiado/);
    const apoyado: Recorte = { ...r, cables: [{ id: "w98", desde: enCable(doc.hojas[0]!.cables[4]!, 4, -4), hasta: libre(4, -2), codos: [] }] };
    expect(() => pegar(doc, apoyado, 0, 30)).toThrow(/no está en lo copiado/);
    expect(doc.contadores).toEqual(contadores);
  });
});

// ── Fuentes y redes ────────────────────────────────────────────────────────

describe("pegar fuentes (D3-A)", () => {
  it("Fase L1 y Neutro N pegadas: sin unir por nombre, redes aparte; por nombre, caen en L1 y N y nada más se une", () => {
    const doc = docFuentes();
    const r = copiarTodo(doc);
    const { antes, mapa } = pegarYComprobar(doc, r, 10, 0);
    const hoja = doc.hojas[0]!;
    // Las etiquetas quedan iguales.
    expect(hoja.componentes.map((c) => c.etiqueta)).toEqual(["L1", "H1", "N", "L1", "H1", "N"]);

    comprobarRedes(antes, hoja, r, mapa);

    // A mano, lo mismo: sin unir por nombre hay 4 redes (2 por circuito)…
    expect(redes(hoja).filter((x) => x.bornes.length > 0)).toHaveLength(4);
    // …y por nombre, 2: las de nombre siguen siendo las mismas, con el borne pegado adentro.
    const con = redes(hoja, { unirPorNombre: true });
    const conNombre = (lista: typeof con) => lista.filter((x) => x.nombres.length > 0);
    expect(conNombre(con)).toHaveLength(conNombre(redes(antes, { unirPorNombre: true })).length);
    const l1 = con.find((x) => x.nombres.includes("L1"))!;
    expect(l1.bornes).toEqual(
      expect.arrayContaining([
        { comp: "c1", borne: "L" },
        { comp: "c2", borne: "X1" },
        { comp: mapa.get("c1"), borne: "L" },
        { comp: mapa.get("c2"), borne: "X1" },
      ]),
    );
    expect(l1.bornes).toHaveLength(4);
    expect(l1.nombres).toEqual(["L1"]);
  });

  it("una red que no tiene fuente no se une con nada, aunque se pegue igual", () => {
    const doc = docBase();
    const r = recortar(doc.hojas[0]!, ["c1", "c2", "w3", "w4"]);
    const { antes, mapa } = pegarYComprobar(doc, r, 0, 30);
    comprobarRedes(antes, doc.hojas[0]!, r, mapa);
    expect(redes(doc.hojas[0]!, { unirPorNombre: true })).toEqual(redes(doc.hojas[0]!));
  });
});

// ── Conflictos ─────────────────────────────────────────────────────────────

/** Los tipos de conflicto, sin repetir y ordenados. */
const tipos = (ps: readonly Conflicto[]) => [...new Set(ps.map((p) => p.clave.split("|")[0]!))].sort();

/** Conflictos de pegar `r` desplazado en la hoja de `existente`. */
const revisar = (existente: Documento, r: Recorte, dx: number, dy: number) =>
  problemasPegado(r, dx, dy, consultaHoja(existente.hojas[0]!), existente.contadores);

/** Un documento armado con `armar`, y su recorte entero. */
function fuente(armar: (doc: Documento) => void): Recorte {
  const doc = crearDocumento(meta);
  armar(doc);
  return copiarTodo(doc);
}

/** Bobina en (0, 0): A1 en (0, -2), A2 en (0, 2), cuerpo x -1..1, y -2..2. */
const bobina = () => fuente((d) => poner(d, "contactor.bobina", 0, 0, "K9"));
/** Un cable suelto de (x0, y0) a (x1, y1). */
const suelto = (x0: number, y0: number, x1: number, y1: number) => fuente((d) => tender(d, libre(x0, y0), libre(x1, y1)));
/** Una hoja con lo que arma `armar`. */
function hoja(armar: (doc: Documento) => void): Documento {
  const doc = crearDocumento(meta);
  armar(doc);
  expect(validarHoja(doc.hojas[0]!)).toEqual([]);
  return doc;
}
const conBobina = () => hoja((d) => poner(d, "contactor.bobina", 10, 0, "K1"));
const conCable = (x0: number, y0: number, x1: number, y1: number) => hoja((d) => tender(d, libre(x0, y0), libre(x1, y1)));

describe("problemasPegado", () => {
  it("borne pegado sobre un borne existente", () => {
    // A2 pegado en (10, -2), sobre A1 de K1; los cuerpos se tocan por el borde.
    expect(tipos(revisar(conBobina(), bobina(), 10, -4))).toEqual(["borneBorne"]);
  });

  it("un cable existente que pasa sobre un borne pegado (ajuste 2)", () => {
    // A1 pegado en (10, -6), en el medio del cable; el cable va por el borde del cuerpo.
    const ps = revisar(conCable(5, -6, 15, -6), bobina(), 10, -4);
    expect(tipos(ps)).toEqual(["borne"]);
    expect(ps[0]!.mensaje).toBe("El borne K9 · A1 quedaría sobre un cable sin conectarse.");
  });

  it("un extremo suelto existente bajo un borne pegado (ajuste 2)", () => {
    const ps = revisar(conCable(10, -6, 10, -12), bobina(), 10, -4);
    expect(tipos(ps)).toEqual(["borneSuelto"]);
    expect(ps[0]).toMatchObject({ x: 10, y: -6 });
  });

  it("cuerpo sobre cuerpo", () => {
    expect(tipos(revisar(conBobina(), bobina(), 10, 1))).toEqual(["cuerpoCuerpo"]);
  });

  it("un cable existente por un cuerpo pegado, y un cable pegado por un cuerpo existente", () => {
    expect(tipos(revisar(conCable(5, 0, 15, 0), bobina(), 10, 0))).toEqual(["cuerpo"]);
    expect(tipos(revisar(conBobina(), suelto(-5, 0, 5, 0), 10, 0))).toEqual(["cuerpo"]);
  });

  it("tramos encimados", () => {
    expect(tipos(revisar(conCable(0, 0, 10, 0), suelto(0, 0, 6, 0), 5, 0))).toEqual(["encimado"]);
  });

  it("toque en un vértice: un extremo libre pegado sobre un cable existente, o al revés", () => {
    expect(tipos(revisar(conCable(0, 0, 10, 0), suelto(0, -5, 0, 0), 5, 0))).toEqual(["toca"]);
    // El extremo suelto existente queda en el medio del tramo pegado.
    expect(tipos(revisar(conCable(10, -5, 10, 0), suelto(-5, 0, 5, 0), 10, 0))).toEqual(["suelto"]);
  });

  it("extremo libre pegado sobre un borne existente", () => {
    expect(tipos(revisar(conBobina(), suelto(0, -6, 0, -2), 10, 0))).toEqual(["borne"]);
  });

  it("una T pegada sobre un cruce existente", () => {
    // Existente: e1 horizontal y e2 vertical, cruzados en (5, 0). Pegado: la T cae ahí.
    const existente = hoja((d) => {
      tender(d, libre(0, 0), libre(10, 0));
      tender(d, libre(5, -5), libre(5, 5));
    });
    const r = fuente((d) => {
      const h = tender(d, libre(-3, 0), libre(3, 0));
      tender(d, enCable(h, 0, 0), libre(0, 4));
    });
    const ps = revisar(existente, r, 5, 0);
    expect(tipos(ps)).toContain("cruce");
    expect(ps.find((p) => p.clave.startsWith("cruce|"))).toMatchObject({ x: 5, y: 0 });
  });

  it("en un lugar libre da []", () => {
    const existente = docBase();
    const r = recortar(existente.hojas[0]!, ["c1", "c2", "w3", "w4"]);
    expect(revisar(existente, r, 0, 30)).toEqual([]);
    expect(revisar(existente, bobina(), 100, 100)).toEqual([]);
  });

  it("lo que choca dentro del recorte no cuenta, aunque el original lo tenga", () => {
    const original = hoja((d) => {
      poner(d, "contactor.bobina", 0, 0, "K1");
      // Atraviesa el cuerpo de K1.
      tender(d, libre(-3, 0), libre(3, 0));
      // Se cruza consigo mismo en (2, 10).
      tender(d, libre(0, 10), libre(2, 8), [[4, 10], [4, 14], [2, 14]]);
    });
    const h = original.hojas[0]!;
    const indice = indexarHoja(h);
    const consulta = consultaHoja(h, indice);
    expect(problemasComponente(geometriaComponente(h.componentes[0]!)!, consulta).length).toBeGreaterThan(0);
    const w2 = h.cables[1]!;
    const propios = problemasTrazado({ id: w2.id, desde: w2.desde, hasta: w2.hasta, puntos: recorridoCable(indice, w2)! }, { ...consulta, cablesEn: () => [] });
    expect(tipos(propios)).toEqual(["mismo"]);

    const r = copiarTodo(original);
    expect(revisar(conBobina(), r, 40, 40)).toEqual([]);
    expect(revisar(crearDocumento(meta), r, 0, 0)).toEqual([]);
  });

  it("pegar encima del original choca (E1-A): las ids previstas no son las del original", () => {
    const doc = hoja((d) => poner(d, "contactor.bobina", 0, 0, "K1"));
    const r = copiarTodo(doc);
    expect(tipos(revisar(doc, r, 0, 0))).toEqual(["borneBorne", "cuerpoCuerpo"]);
    expect(tipos(revisar(doc, r, 1, 0))).toEqual(["cuerpoCuerpo"]);
    const conW = conCable(0, 0, 10, 0);
    expect(tipos(revisar(conW, copiarTodo(conW), 0, 0))).toEqual(["encimado"]);
  });

  it("las claves usan las ids que va a dar pegar, sin gastarlas", () => {
    const doc = hoja((d) => poner(d, "contactor.bobina", 0, 0, "K1"));
    const r = copiarTodo(doc);
    const contadores = { ...doc.contadores };
    const ps = revisar(doc, r, 0, 1);
    expect(doc.contadores).toEqual(contadores);
    const [id] = pegar(doc, r, 0, 1).ids;
    expect(ps.map((p) => par(p.clave))).toContain(`cuerpo:c1|cuerpo:${id}`);
  });

  it("los símbolos desconocidos no dan conflicto", () => {
    const r: Recorte = { componentes: [{ id: "c1", ...datos("no.existe", 0, 0) }], cables: [], caja: { x: 0, y: 0, ancho: 0, alto: 0 } };
    expect(revisar(conBobina(), r, 10, 0)).toEqual([]);
  });

  it("coincide con revisar la hoja entera después de pegar (mismo punto y mismo elemento existente)", () => {
    const casos: [Documento, Recorte, number, number][] = [
      [conBobina(), bobina(), 10, -4],
      [conCable(5, -6, 15, -6), bobina(), 10, -4],
      [conCable(10, -6, 10, -12), bobina(), 10, -4],
      [conBobina(), bobina(), 10, 1],
      [conCable(0, 0, 10, 0), suelto(0, 0, 6, 0), 5, 0],
      [conCable(10, -5, 10, 0), suelto(-5, 0, 5, 0), 10, 0],
      [conBobina(), suelto(0, -6, 0, -2), 10, 0],
    ];
    const base = docBase();
    for (let dy = -8; dy <= 8; dy += 2) casos.push([base, recortar(base.hojas[0]!, ["c1", "c2", "w3", "w4"]), 3, dy]);
    for (const [existente, r, dx, dy] of casos) {
      const doc = copia(existente);
      const ps = revisar(doc, r, dx, dy);
      const cmd = pegar(doc, r, dx, dy);
      cmd.aplicar(doc);
      comprobarControl(ps, doc.hojas[0]!, new Set(cmd.ids));
    }
  });
});

describe("pegar en otra hoja", () => {
  it("pega en la hoja pedida, con las ids del documento", () => {
    const doc = docBase();
    doc.hojas.push({ nombre: "Hoja 2", componentes: [], cables: [] });
    const r = recortar(doc.hojas[0]!, ["c1", "c2"]);
    const cmd = pegar(doc, r, 0, 0, 1);
    cmd.aplicar(doc);
    expect(doc.hojas[1]!.componentes.map((c) => c.id)).toEqual(cmd.ids.slice(0, 2));
    expect(validarHoja(doc.hojas[1]!)).toEqual([]);
    expect(idsDe(r)).toEqual(["c1", "c2", "w1", "w2", "w7"]);
  });
});
