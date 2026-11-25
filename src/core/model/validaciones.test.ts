// Validaciones en vivo (T19, etapa 1): docs/archivo/plan-T19.md, sección 4.

import { describe, expect, it, vi } from "vitest";
import { marchaParada } from "../circuitos/marchaParada";
import { serializar } from "../io";
import { buscarSimbolo, SIMBOLOS, type DefinicionSimbolo, type Rotacion } from "../symbols";
import { indexarHoja, puntoExtremo, recorridoCable, validarHoja } from "./cables";
import { Borrar, CambiarEtiqueta, CambiarEtiquetas, cablear, colocar, Espejar, Mover, Rotar, type Comando } from "./comandos";
import { crearDocumento, type Documento, type Extremo, type Hoja } from "./documento";
import { conEtiquetas, etiquetarLote, etiquetasDeTitulares, planRenombrarBobina } from "./etiquetado";
import { Historial } from "./historial";
import { pegar, recortar, type Recorte } from "./portapapeles";
import { contarAvisos, NOMBRES_PREFIJO, textoAviso, textoRepetida, TODAS, validar, type Aviso, type Regla } from "./validaciones";

const BOBINA = "contactor.bobina";
const NA = "contactor.auxiliar_na";
const NC = "contactor.auxiliar_nc";
const PNA = "pulsador.na";
const PNC = "pulsador.nc";
const LAMPARA = "senalizacion.lampara";
const FASE = "fuente.fase";
const NEUTRO = "fuente.neutro";
/** Un tipo que no está en la biblioteca, como en un .brn de una versión más nueva. */
const DESCONOCIDO = "desconocido.contacto";
const ROTACIONES: Rotacion[] = [0, 90, 180, 270];

/** Las reglas de etiqueta: todas menos las de conexión (R7 y R8). */
const ETIQUETA: Regla[] = ["R1", "R2", "R3", "R4", "R5", "R6", "R9"];

// ── Armado ─────────────────────────────────────────────────────────────────

const b = (comp: string, borne: string): Extremo => ({ tipo: "borne", comp, borne });
const t = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });
const libre = (x: number, y: number): Extremo => ({ tipo: "libre", x, y });

interface Armado {
  doc: Documento;
  h: Hoja;
  historial: Historial;
  /** Coloca con la etiqueta dada (o la inicial del símbolo, como el editor) y devuelve el id. */
  poner(tipo: string, x: number, y: number, etiqueta?: string, rot?: Rotacion): string;
  /** Tiende un cable (el comando valida la forma) y devuelve el id. */
  tender(desde: Extremo, hasta: Extremo, codos?: [number, number][]): string;
  hacer(c: Comando): void;
}

/** Todo con comandos y un `Historial`, como el usuario. Sin `base`, un documento nuevo. */
function armar(base?: { doc: Documento; historial: Historial }): Armado {
  const doc = base?.doc ?? crearDocumento({ titulo: "Validaciones", autor: "", fecha: "2026-11-15" });
  const historial = base?.historial ?? new Historial(doc);
  return {
    doc,
    h: doc.hojas[0]!,
    historial,
    poner(tipo, x, y, etiqueta, rot = 0) {
      const cmd = colocar(doc, { tipo, x, y, rot, espejado: false, etiqueta: etiqueta ?? buscarSimbolo(tipo)?.etiquetaInicial ?? "", params: {} });
      historial.ejecutar(cmd);
      return cmd.id;
    },
    tender(desde, hasta, codos = []) {
      const cmd = cablear(doc, { desde, hasta, codos });
      historial.ejecutar(cmd);
      return cmd.id;
    },
    hacer(c) {
      historial.ejecutar(c);
    },
  };
}

/** La marcha-parada (T15), para seguir armando con comandos. */
function desdeMarchaParada(opciones: Parameters<typeof marchaParada>[0] = {}) {
  const m = marchaParada(opciones);
  return { ...m, a: armar(m) };
}

const de = (avisos: readonly Aviso[], regla: Regla) => avisos.filter((a) => a.regla === regla);

/**
 * La rama de K1 con el NC "K2" de enclavamiento entre S1 y A1, como en una
 * inversión de giro: L, S0 (NC), S1 (NA) con el NA K1 de retención en
 * paralelo, NC K2, bobina K1 y N. Todo cableado.
 */
function ramaK1(a: Armado) {
  const L = a.poner(FASE, 0, 0);
  const S0 = a.poner(PNC, 0, 5, "S0");
  const S1 = a.poner(PNA, 0, 11, "S1");
  const K1na = a.poner(NA, 6, 11, "K1");
  const K2nc = a.poner(NC, 0, 17, "K2");
  const K1 = a.poner(BOBINA, 0, 23, "K1");
  const N = a.poner(NEUTRO, 0, 30, undefined, 180);
  a.tender(b(L, "L"), b(S0, "11"));
  const w2 = a.tender(b(S0, "12"), b(S1, "13"));
  a.tender(t(w2, 0, 8), b(K1na, "13"), [[6, 8]]);
  const w4 = a.tender(b(S1, "14"), b(K2nc, "21"));
  a.tender(b(K1na, "14"), t(w4, 0, 14), [[6, 14]]);
  a.tender(b(K2nc, "22"), b(K1, "A1"));
  const w7 = a.tender(b(K1, "A2"), b(N, "N"));
  return { L, S0, S1, K1na, K2nc, K1, N, w7 };
}

/**
 * Mando de inversión con el enclavamiento bien hecho (ajuste 4): la rama de
 * K1 con el NC "K2" junto a A1 de K1, y la de K2 con el NC "K1" junto a A1 de
 * K2. Todo cableado: no falta ni sobra nada.
 */
function inversion() {
  const a = armar();
  const r = ramaK1(a);
  const S2 = a.poner(PNA, 20, 11, "S2");
  const K2na = a.poner(NA, 26, 11, "K2");
  const K1nc = a.poner(NC, 20, 17, "K1");
  const K2 = a.poner(BOBINA, 20, 23, "K2");
  a.tender(b(r.K1na, "13"), b(S2, "13"));
  a.tender(b(K2na, "13"), b(S2, "13"));
  a.tender(b(S2, "14"), b(K1nc, "21"));
  a.tender(b(K2na, "14"), b(S2, "14"));
  a.tender(b(K1nc, "22"), b(K2, "A1"));
  a.tender(b(K2, "A2"), t(r.w7, 0, 27), [[20, 27]]);
  return { a, ...r, S2, K2na, K1nc, K2 };
}

// ── Sin avisos ─────────────────────────────────────────────────────────────

describe("sin avisos («nada naranja», sección 3)", () => {
  it("la marcha-parada, con la rama NC y con dos neutros: cero", () => {
    for (const opciones of [{}, { ramaNC: true }, { dosNeutros: true }]) {
      expect(validar(marchaParada(opciones).doc.hojas[0]!), JSON.stringify(opciones)).toEqual([]);
    }
  });

  it("la hoja vacía (la marcha-parada deshecha entera): cero", () => {
    const { doc, historial } = marchaParada({ ramaNC: true });
    while (historial.deshacer());
    expect(doc.hojas[0]!.componentes).toEqual([]);
    expect(validar(doc.hojas[0]!)).toEqual([]);
  });

  it("el mando de inversión con el enclavamiento bien hecho: cero, con todas las reglas (ajuste 4)", () => {
    const { a } = inversion();
    expect(validarHoja(a.h)).toEqual([]);
    expect(validar(a.h)).toEqual([]);
  });
});

// ── Por regla ──────────────────────────────────────────────────────────────

describe("R1: contacto sin etiqueta", () => {
  it("el NA de retención sin etiqueta: un R1, y nada más", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.k1Auxiliar, ""));
    expect(validar(a.h)).toEqual([{ regla: "R1", severidad: "aviso", id: comp.k1Auxiliar }]);
  });

  it("de puros espacios también; « k1 » no (normalizada es K1)", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.k1Auxiliar, "   "));
    expect(validar(a.h).map((x) => x.regla)).toEqual(["R1"]);
    a.hacer(new CambiarEtiqueta(comp.k1Auxiliar, " k1 "));
    expect(validar(a.h)).toEqual([]);
  });
});

describe("R2: contacto sin bobina", () => {
  it("el NA «K2» sin bobina K2: un R2 con la etiqueta", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.k1Auxiliar, "k2"));
    expect(validar(a.h)).toEqual([{ regla: "R2", severidad: "aviso", id: comp.k1Auxiliar, etiqueta: "K2" }]);
  });

  it("si la bobina pasa a K2 con su contacto, cero; con la etiqueta de algo que no es bobina (un NC «S1»), R2", () => {
    const { a, comp } = desdeMarchaParada({ ramaNC: true });
    a.hacer(new CambiarEtiquetas(planRenombrarBobina(a.h, comp.k1Bobina, "K2").cambios));
    expect(validar(a.h)).toEqual([]);
    a.hacer(new CambiarEtiqueta(comp.k1AuxiliarNC!, "S1"));
    expect(validar(a.h)).toEqual([{ regla: "R2", severidad: "aviso", id: comp.k1AuxiliarNC, etiqueta: "S1" }]);
  });
});

describe("R3: titular sin etiqueta", () => {
  it("la bobina sin etiqueta: R3 con su nombre, y su contacto queda con R2", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.k1Bobina, ""));
    expect(validar(a.h)).toEqual([
      { regla: "R2", severidad: "aviso", id: comp.k1Auxiliar, etiqueta: "K1" },
      { regla: "R3", severidad: "aviso", id: comp.k1Bobina, nombre: "Bobina de contactor" },
    ]);
  });

  it("una lámpara y un pulsador sin etiqueta: R3 cada uno; el símbolo desconocido sin etiqueta, nada", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.h1, ""));
    a.hacer(new CambiarEtiqueta(comp.s1, ""));
    const x = a.poner(DESCONOCIDO, 40, 0, "");
    expect(validar(a.h, ETIQUETA)).toEqual([
      { regla: "R3", severidad: "aviso", id: comp.s1, nombre: "Pulsador NA" },
      { regla: "R3", severidad: "aviso", id: comp.h1, nombre: "Lámpara" },
    ]);
    // Sin bornes conocidos: tampoco R7.
    expect(validar(a.h).filter((v) => v.id === x)).toEqual([]);
  });
});

describe("R4: titulares repetidos (cambio 6)", () => {
  it("un pulsador NA y uno NC con la misma etiqueta: se permiten (pulsador de doble contacto)", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.s0, "S1"));
    expect(validar(a.h)).toEqual([]);
  });

  it("dos pulsadores NA «S1»: aviso en los dos", () => {
    const { a, comp } = desdeMarchaParada();
    const otro = a.poner(PNA, 40, 0, "s1");
    const r4 = de(validar(a.h), "R4");
    expect(r4).toEqual([
      { regla: "R4", severidad: "aviso", id: comp.s1, etiqueta: "S1", otro: "Pulsador NA" },
      { regla: "R4", severidad: "aviso", id: otro, etiqueta: "S1", otro: "Pulsador NA" },
    ]);
    expect(contarAvisos(r4)).toEqual({ errores: 0, avisos: 2 });
    expect(validar(a.h, ETIQUETA)).toEqual(r4);
  });

  it("dos bobinas K1: error en las dos", () => {
    const { a, comp } = desdeMarchaParada();
    const otra = a.poner(BOBINA, 40, 0, "K1");
    const r4 = de(validar(a.h), "R4");
    expect(r4).toEqual([
      { regla: "R4", severidad: "error", id: comp.k1Bobina, etiqueta: "K1", otro: "Bobina de contactor" },
      { regla: "R4", severidad: "error", id: otra, etiqueta: "K1", otro: "Bobina de contactor" },
    ]);
    expect(contarAvisos(validar(a.h, ETIQUETA))).toEqual({ errores: 2, avisos: 0 });
  });

  it("dos lámparas H1 y dos desconocidos «X1»: error en todos", () => {
    const { a, comp } = desdeMarchaParada();
    const h = a.poner(LAMPARA, 40, 0, "H1");
    const x1 = a.poner(DESCONOCIDO, 50, 0, "X1");
    const x2 = a.poner(DESCONOCIDO, 60, 0, "x1");
    expect(validar(a.h, ETIQUETA)).toEqual([
      { regla: "R4", severidad: "error", id: comp.h1, etiqueta: "H1", otro: "Lámpara" },
      { regla: "R4", severidad: "error", id: h, etiqueta: "H1", otro: "Lámpara" },
      { regla: "R4", severidad: "error", id: x1, etiqueta: "X1", otro: "Símbolo desconocido" },
      { regla: "R4", severidad: "error", id: x2, etiqueta: "X1", otro: "Símbolo desconocido" },
    ]);
  });

  it("NA, NA y NC «S1»: aviso solo en las dos NA; la NC, nada", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.s0, "S1"));
    const otro = a.poner(PNA, 40, 0, "S1");
    expect(validar(a.h, ETIQUETA).map((x) => [x.id, x.severidad])).toEqual([
      [comp.s1, "aviso"],
      [otro, "aviso"],
    ]);
  });

  it("un pulsador con la etiqueta de una lámpara: error en los dos, y el texto nombra al otro", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.s1, "H1"));
    const r4 = de(validar(a.h), "R4");
    expect(r4.map((x) => [x.id, x.severidad, textoAviso(x)])).toEqual([
      [comp.s1, "error", "Otra lámpara ya se llama H1."],
      [comp.h1, "error", "Otro pulsador NA ya se llama H1."],
    ]);
  });

  it("los seguidores y las fuentes no cuentan: dos NA K1 y dos fases L no son R4", () => {
    const { a } = desdeMarchaParada();
    a.poner(NA, 40, 0, "K1");
    a.poner(FASE, 50, 0);
    expect(de(validar(a.h), "R4")).toEqual([]);
  });
});

describe("R5: prefijo de otro tipo", () => {
  it("un pulsador «K7»: solo R5, con su texto", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.s1, "K7"));
    const avisos = validar(a.h);
    expect(avisos).toEqual([{ regla: "R5", severidad: "aviso", id: comp.s1, etiqueta: "K7", nombre: "Pulsador NA", de: "bobina" }]);
    expect(textoAviso(avisos[0]!)).toBe("K7 es nombre de bobina y esto es un pulsador NA.");
  });

  it("un pulsador «K1» con la bobina K1: 2 errores R4 y 0 avisos R5 (cambio 7)", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.s1, "K1"));
    const avisos = validar(a.h, ETIQUETA);
    expect(de(avisos, "R4").map((x) => [x.id, x.severidad])).toEqual([
      [comp.s1, "error"],
      [comp.k1Bobina, "error"],
    ]);
    expect(de(avisos, "R5")).toEqual([]);
    // Pedida sola, R5 mira igual la condición de R4.
    expect(validar(a.h, ["R5"])).toEqual([]);
  });

  it("con un R4 que es aviso, R5 se suma: dos pulsadores NA «K7»", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.s1, "K7"));
    a.poner(PNA, 40, 0, "K7");
    expect(validar(a.h, ETIQUETA).map((x) => `${x.regla} ${x.severidad}`)).toEqual(["R4 aviso", "R5 aviso", "R4 aviso", "R5 aviso"]);
  });

  it("una lámpara «S2» avisa; una bobina «KM1», un pulsador «MARCHA», «S01» o una lámpara «X1» no", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.h1, "S2"));
    const r5 = de(validar(a.h), "R5");
    expect(r5.map(textoAviso)).toEqual(["S2 es nombre de pulsador y esto es una lámpara."]);

    a.hacer(new CambiarEtiqueta(comp.h1, "X1"));
    a.hacer(new CambiarEtiquetas(planRenombrarBobina(a.h, comp.k1Bobina, "KM1").cambios));
    a.hacer(new CambiarEtiqueta(comp.s1, "MARCHA"));
    a.hacer(new CambiarEtiqueta(comp.s0, "S01"));
    expect(validar(a.h)).toEqual([]);
  });
});

describe("R5 con los prefijos de potencia: un nombre neutro por prefijo (T35, ajuste 1 de Bruno)", () => {
  const r5 = (h: Hoja) => de(validar(h), "R5");

  it("todo prefijo de la biblioteca tiene su nombre en la tabla", () => {
    const prefijos = new Set(SIMBOLOS.flatMap((s) => (s.prefijoEtiqueta ? [s.prefijoEtiqueta] : [])));
    expect([...prefijos].sort()).toEqual([...NOMBRES_PREFIJO.keys()].sort());
  });

  it("un motor «Q2» con un guardamotor Q1 en la hoja: «protección o maniobra», no el nombre de un símbolo Q", () => {
    const a = armar();
    a.poner("proteccion.guardamotor", 0, 0, "Q1");
    const m = a.poner("motor.trifasico", 20, 0, "Q2");
    expect(r5(a.h)).toEqual([{ regla: "R5", severidad: "aviso", id: m, etiqueta: "Q2", nombre: "Motor trifásico", de: "protección o maniobra" }]);
    expect(textoAviso(r5(a.h)[0]!)).toBe("Q2 es nombre de protección o maniobra y esto es un motor trifásico.");
  });

  it("un guardamotor «M1» y uno «F3»: «motor» y «protección»; con «Q4», nada", () => {
    const a = armar();
    const g = a.poner("proteccion.guardamotor", 0, 0, "M1");
    const h = a.poner("proteccion.guardamotor", 20, 0, "F3");
    a.poner("proteccion.guardamotor", 40, 0, "Q4");
    expect(r5(a.h).map((x) => [x.id, textoAviso(x)])).toEqual([
      [g, "M1 es nombre de motor y esto es un guardamotor."],
      [h, "F3 es nombre de protección y esto es un guardamotor."],
    ]);
  });

  it("un seccionador, un diferencial o un fusible con letras de su mismo prefijo no avisan; un térmico «Q1», sí", () => {
    const a = armar();
    a.poner("maniobra.seccionador", 0, 0, "Q1");
    a.poner("proteccion.diferencial_bipolar", 20, 0, "Q2");
    a.poner("proteccion.fusible_tripolar", 40, 0, "F1");
    const t = a.poner("proteccion.termico", 60, 0, "Q9");
    expect(r5(a.h).map((x) => [x.id, textoAviso(x)])).toEqual([[t, "Q9 es nombre de protección o maniobra y esto es un relé térmico."]]);
  });

  it("K, S y H dicen lo de antes", () => {
    const a = armar();
    a.poner("motor.trifasico", 0, 0, "K1");
    a.poner("motor.trifasico", 20, 0, "S1");
    a.poner("motor.trifasico", 40, 0, "H1");
    expect(r5(a.h).map((x) => (x as Extract<Aviso, { regla: "R5" }>).de)).toEqual(["bobina", "pulsador", "lámpara"]);
  });
});

describe("R6: NC en la rama de su propia bobina", () => {
  it("el enclavamiento bien hecho (cero) y el duplicado mal hecho, el límite de T17b: exactamente un R6, en el NC de la copia (ajuste 4)", () => {
    const a = armar();
    const r = ramaK1(a);
    // Sin bobina K2 todavía: el NC K2 avisa R2.
    expect(validar(a.h)).toEqual([{ regla: "R2", severidad: "aviso", id: r.K2nc, etiqueta: "K2" }]);

    // Duplicar la rama (S1, el NA K1, el NC K2 y la bobina K1, con sus cables), como el editor.
    const recorte = recortar(a.h, [r.S1, r.K1na, r.K2nc, r.K1]);
    expect(recorte.cables).toHaveLength(3);
    const cmd = pegar(a.doc, conEtiquetas(recorte, etiquetarLote(etiquetasDeTitulares(a.h), recorte.componentes)), 40, 0);
    a.hacer(cmd);
    const copia = new Set(cmd.ids);
    const ncCopia = a.h.componentes.find((c) => copia.has(c.id) && c.tipo === NC)!;
    // T17b: la copia queda toda en K2 (bobina, NA y NC).
    expect(a.h.componentes.filter((c) => copia.has(c.id)).map((c) => c.etiqueta)).toEqual(["S2", "K2", "K2", "K2"]);

    const avisos = validar(a.h);
    expect(de(avisos, "R6")).toEqual([{ regla: "R6", severidad: "aviso", id: ncCopia.id, etiqueta: "K2" }]);
    // El NC original ya tiene bobina K2 (la copia) y no está en su rama: nada.
    expect(avisos.filter((x) => x.id === r.K2nc)).toEqual([]);
    // De etiqueta, solo ese R6; lo demás son los bornes de la copia que quedaron sin cable.
    expect(validar(a.h, ETIQUETA)).toEqual(de(avisos, "R6"));
    expect(avisos.map((x) => x.regla)).toEqual(["R7", "R7", "R6", "R7"]);

    // Y la inversión bien hecha, con los dos NC de enclavamiento, da cero.
    expect(validar(inversion().a.h)).toEqual([]);
  });

  it("un NC «k1 » cableado a A1 de K1: R6; si esa red tiene nombre (A1 también va a L), no", () => {
    const a = armar();
    const K1 = a.poner(BOBINA, 0, 10, "K1");
    const nc = a.poner(NC, 0, 4, "k1 ");
    const w = a.tender(b(nc, "22"), b(K1, "A1"));
    expect(validar(a.h, ["R6"])).toEqual([{ regla: "R6", severidad: "aviso", id: nc, etiqueta: "K1" }]);
    const L = a.poner(FASE, 8, 0);
    a.tender(b(L, "L"), t(w, 0, 7), [[8, 7]]);
    expect(validar(a.h, ["R6"])).toEqual([]);
  });

  it("un NA en la rama de su bobina no es R6; un NC de otra bobina tampoco", () => {
    const a = armar();
    const K1 = a.poner(BOBINA, 0, 10, "K1");
    a.poner(BOBINA, 20, 10, "K2");
    const na = a.poner(NA, 0, 4, "K1");
    a.tender(b(na, "14"), b(K1, "A1"));
    const nc = a.poner(NC, 6, 4, "K2");
    a.tender(b(nc, "22"), b(K1, "A1"), [[6, 8]]);
    expect(validar(a.h, ["R6"])).toEqual([]);
  });

  it("la rama NC de la marcha-parada (el NC K1 prende H2 desde L): cero", () => {
    expect(validar(marchaParada({ ramaNC: true }).doc.hojas[0]!, ["R6"])).toEqual([]);
  });

  it("un NC K1 del lado del neutro, en la red N con A2 de K1: cero (la red tiene nombre)", () => {
    const { a, cables } = desdeMarchaParada();
    // w6 va de A2 de K1 al Neutro; w1, de la Fase a S0.
    const w1 = cables[0]!;
    const w6 = cables[5]!;
    const nc = a.poner(NC, 30, 27, "K1");
    const h2 = a.poner(LAMPARA, 30, 20, "H2");
    a.tender(b(nc, "22"), t(w6, 0, 30), [[30, 30]]);
    a.tender(b(h2, "X2"), b(nc, "21"));
    a.tender(b(h2, "X1"), t(w1, 0, 2), [[30, 2]]);
    expect(validarHoja(a.h)).toEqual([]);
    expect(validar(a.h)).toEqual([]);
  });

  it("límite conocido (S3): un NC K1 con una lámpara en el medio antes de A1 de K1 no se ve", () => {
    const a = armar();
    const K1 = a.poner(BOBINA, 0, 20, "K1");
    const nc = a.poner(NC, 0, 4, "K1");
    const h = a.poner(LAMPARA, 0, 11, "H1");
    a.tender(b(nc, "22"), b(h, "X1"));
    a.tender(b(h, "X2"), b(K1, "A1"));
    expect(validar(a.h, ["R6"])).toEqual([]);
  });
});

describe("R7 y R8: conexiones", () => {
  it("quitar el cable del NA de retención a S1: el borne 14 del NA queda sin conectar (S1 14 sigue con w4)", () => {
    const { a, comp, cables } = desdeMarchaParada();
    a.hacer(new Borrar([cables[4]!]));
    expect(validar(a.h)).toEqual([{ regla: "R7", severidad: "aviso", id: comp.k1Auxiliar, borne: "14" }]);
    a.historial.deshacer();
    expect(validar(a.h)).toEqual([]);
  });

  it("un componente recién colocado: un R7 por borne, en el orden de su definición", () => {
    const { a } = desdeMarchaParada();
    const k = a.poner(BOBINA, 40, 0, "K2");
    expect(validar(a.h)).toEqual([
      { regla: "R7", severidad: "aviso", id: k, borne: "A1" },
      { regla: "R7", severidad: "aviso", id: k, borne: "A2" },
    ]);
  });

  it("borrar H1: sus dos cables quedan con un extremo suelto (R8, uno por cable)", () => {
    const { a, comp, cables } = desdeMarchaParada();
    a.hacer(new Borrar([comp.h1]));
    expect(validar(a.h)).toEqual([
      { regla: "R8", severidad: "aviso", id: cables[6] },
      { regla: "R8", severidad: "aviso", id: cables[7] },
    ]);
  });

  it("un cable con los dos extremos sueltos es un solo R8; un extremo libre sobre un borne no lo conecta", () => {
    const a = armar();
    const k = a.poner(BOBINA, 0, 0, "K1");
    const w1 = a.tender(libre(10, 0), libre(10, 5));
    // El extremo libre cae justo en A1 (0, -2): A1 sigue sin conectar.
    const w2 = a.tender(b(k, "A2"), libre(0, -2), [[3, 2], [3, -2]]);
    expect(validar(a.h)).toEqual([
      { regla: "R7", severidad: "aviso", id: k, borne: "A1" },
      { regla: "R8", severidad: "aviso", id: w1 },
      { regla: "R8", severidad: "aviso", id: w2 },
    ]);
  });

  it("una T no conecta el borne: el cable que termina en T sobre otro sí cuenta como cable de su otro borne", () => {
    const { a, cables } = desdeMarchaParada();
    // w7 (de la T sobre w4 a X1 de H1) se va: X1 queda sin conectar; w4 sigue igual.
    a.hacer(new Borrar([cables[6]!]));
    expect(validar(a.h).map((x) => (x.regla === "R7" ? `R7 ${x.borne}` : x.regla))).toEqual(["R7 X1"]);
  });
});

describe("R9: alimentación sin nombre", () => {
  it("la fase sin etiqueta: R9, y nada más", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.fase, "  "));
    expect(validar(a.h)).toEqual([{ regla: "R9", severidad: "aviso", id: comp.fase }]);
  });
});

describe("trifásica (T34, D1-A y D2-A)", () => {
  it("sin etiqueta no da R9: nombra sus bornes, su etiqueta es libre", () => {
    const a = armar();
    a.poner("fuente.trifasica", 0, 0, "");
    expect(validar(a.h).filter((x) => x.regla === "R9")).toEqual([]);
  });

  it("el NC en la red de su bobina no da R6 si esa red es L1 de la trifásica (red con nombre)", () => {
    const a = armar();
    const k = a.poner(BOBINA, 0, 0, "K1");
    const nc = a.poner(NC, 10, 0, "K1");
    const t = a.poner("fuente.trifasica", 0, -10, "");
    a.tender({ tipo: "borne", comp: nc, borne: "22" }, { tipo: "borne", comp: k, borne: "A1" }, [[10, -2]]);
    expect(validar(a.h, ["R6"]).map((x) => x.id)).toEqual([nc]);
    a.tender({ tipo: "borne", comp: t, borne: "L1" }, { tipo: "borne", comp: k, borne: "A1" }, [
      [-2, -5],
      [0, -5],
    ]);
    expect(validar(a.h, ["R6"])).toEqual([]);
  });

  it("CambiarEtiquetas: vaciarle la etiqueta no tira (en Fase y Neutro sí: necesitan nombre de red)", () => {
    const a = armar();
    const t = a.poner("fuente.trifasica", 0, 0, "Red");
    a.hacer(new CambiarEtiquetas([[t, ""]]));
    expect(a.h.componentes.find((c) => c.id === t)!.etiqueta).toBe("");
    const f = a.poner(FASE, 10, 0);
    expect(() => a.hacer(new CambiarEtiquetas([[f, ""]]))).toThrow("necesita un nombre de red");
  });
});

describe("R10: fase L junto con L1, L2 o L3 (T29)", () => {
  const r10 = (h: Hoja) => validar(h).filter((x) => x.regla === "R10");

  it("la marcha-parada (una Fase «L»): sin R10", () => {
    const { a } = desdeMarchaParada();
    expect(r10(a.h)).toEqual([]);
  });

  it("una Fase «L1» junto a la «L»: R10 en la «L», no en la «L1»", () => {
    const { a, comp } = desdeMarchaParada();
    a.poner(FASE, 40, 0, "L1");
    expect(r10(a.h)).toEqual([{ regla: "R10", severidad: "aviso", id: comp.fase, otras: "L1" }]);
  });

  it("compara etiquetas normalizadas: «l1 » cuenta como «L1» y « l » como «L»", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.fase, " l "));
    a.poner(FASE, 40, 0, "l1 ");
    expect(r10(a.h)).toEqual([{ regla: "R10", severidad: "aviso", id: comp.fase, otras: "L1" }]);
  });

  it("varias numeradas: «L1 y L3», y marca cada Fase «L»", () => {
    const { a, comp } = desdeMarchaParada();
    a.poner(FASE, 40, 0, "L3");
    a.poner(FASE, 50, 0, "L1");
    const otraL = a.poner(FASE, 60, 0, "L");
    expect(r10(a.h)).toEqual([
      { regla: "R10", severidad: "aviso", id: comp.fase, otras: "L1 y L3" },
      { regla: "R10", severidad: "aviso", id: otraL, otras: "L1 y L3" },
    ]);
    a.poner(FASE, 70, 0, "L2");
    expect(r10(a.h).map((x) => (x as Extract<Aviso, { regla: "R10" }>).otras)).toEqual(["L1, L2 y L3", "L1, L2 y L3"]);
  });

  it("solo fases: un Neutro «L1» o «L», o una Fase «L4» o «L12», no cuentan", () => {
    const { a, comp } = desdeMarchaParada();
    a.poner(NEUTRO, 40, 0, "L1");
    a.poner(FASE, 50, 0, "L4");
    a.poner(FASE, 60, 0, "L12");
    expect(r10(a.h)).toEqual([]);
    a.hacer(new CambiarEtiqueta(comp.fase, "L2"));
    a.poner(NEUTRO, 70, 0, "L");
    expect(r10(a.h)).toEqual([]);
  });

  it("una trifásica en la hoja con una Fase «L»: R10 en la «L», «L1, L2 y L3» (T35, D15-A)", () => {
    const { a, comp } = desdeMarchaParada();
    a.poner("fuente.trifasica", 40, 0);
    expect(r10(a.h)).toEqual([{ regla: "R10", severidad: "aviso", id: comp.fase, otras: "L1, L2 y L3" }]);
    expect(textoAviso(r10(a.h)[0]!)).toBe("Fase L junto con L1, L2 y L3: para Bornera son fases distintas.");
  });

  it("la trifásica con neutro también; su etiqueta no cuenta, y sin ninguna «L» no hay R10", () => {
    const { a, comp } = desdeMarchaParada();
    const t = a.poner("fuente.trifasica_n", 40, 0, "L");
    expect(r10(a.h)).toEqual([{ regla: "R10", severidad: "aviso", id: comp.fase, otras: "L1, L2 y L3" }]);
    a.hacer(new CambiarEtiqueta(comp.fase, "L1"));
    expect(r10(a.h)).toEqual([]);
    a.hacer(new Borrar([t]));
    a.hacer(new CambiarEtiqueta(comp.fase, "L"));
    expect(r10(a.h)).toEqual([]);
  });

  it("la tierra y los demás de potencia no cuentan", () => {
    const { a } = desdeMarchaParada();
    a.poner("fuente.tierra", 40, 0);
    a.poner("proteccion.termomagnetica_tripolar", 50, 0);
    a.poner("motor.trifasico", 60, 0);
    expect(r10(a.h)).toEqual([]);
  });

  it("L1, L2 y L3 sin ninguna «L»: sin R10", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.fase, "L1"));
    a.poner(FASE, 40, 0, "L2");
    a.poner(FASE, 50, 0, "L3");
    expect(r10(a.h)).toEqual([]);
  });

  it("es un aviso: el texto dice cuáles y que son fases distintas", () => {
    const { a } = desdeMarchaParada();
    a.poner(FASE, 40, 0, "L2");
    expect(r10(a.h).map(textoAviso)).toEqual(["Fase L junto con L2: para Bornera son fases distintas."]);
    expect(contarAvisos(r10(a.h))).toEqual({ errores: 0, avisos: 1 });
  });
});

// ── Orden, subconjuntos, textos y cuentas ──────────────────────────────────

describe("orden y subconjuntos", () => {
  it("los componentes en el orden de la hoja (por regla y, en R7, por borne), y después los cables", () => {
    const a = armar();
    const w = a.tender(libre(30, 0), libre(30, 5));
    const k = a.poner(BOBINA, 0, 0, "");
    const na = a.poner(NA, 10, 0, "");
    const f = a.poner(FASE, 20, 0, "");
    expect(validar(a.h).map((x) => `${x.regla} ${x.id}${x.regla === "R7" ? ` ${x.borne}` : ""}`)).toEqual([
      `R3 ${k}`,
      `R7 ${k} A1`,
      `R7 ${k} A2`,
      `R1 ${na}`,
      `R7 ${na} 13`,
      `R7 ${na} 14`,
      `R7 ${f} L`,
      `R9 ${f}`,
      `R8 ${w}`,
    ]);
  });

  it("validar con un subconjunto da lo mismo que filtrar el resultado completo", () => {
    const { a, comp } = desdeMarchaParada();
    a.hacer(new CambiarEtiqueta(comp.s1, "K1"));
    a.hacer(new CambiarEtiqueta(comp.k1Auxiliar, ""));
    a.poner(NA, 40, 0, "K9");
    const todo = validar(a.h);
    for (const regla of TODAS) expect(validar(a.h, [regla]), regla).toEqual(de(todo, regla));
    expect(validar(a.h, [])).toEqual([]);
  });

  it("validar no cambia el documento: el .brn sale igual", () => {
    const { doc } = marchaParada({ ramaNC: true });
    doc.hojas[0]!.componentes[3]!.etiqueta = "k2";
    const antes = JSON.parse(JSON.stringify(doc)) as typeof doc;
    const texto = serializar(doc);
    expect(validar(doc.hojas[0]!).length).toBeGreaterThan(0);
    expect(doc).toEqual(antes);
    expect(serializar(doc)).toBe(texto);
  });
});

describe("textos y cuentas", () => {
  it("un texto por regla", () => {
    const textos = (
      [
        { regla: "R1", severidad: "aviso", id: "c1" },
        { regla: "R2", severidad: "aviso", id: "c1", etiqueta: "K2" },
        { regla: "R3", severidad: "aviso", id: "c1", nombre: "Bobina de contactor" },
        { regla: "R4", severidad: "error", id: "c1", etiqueta: "K1", otro: "Bobina de contactor" },
        { regla: "R5", severidad: "aviso", id: "c1", etiqueta: "K1", nombre: "Pulsador NA", de: "bobina" },
        { regla: "R6", severidad: "aviso", id: "c1", etiqueta: "K2" },
        { regla: "R7", severidad: "aviso", id: "c1", borne: "14" },
        { regla: "R8", severidad: "aviso", id: "w1" },
        { regla: "R9", severidad: "aviso", id: "c1" },
      ] satisfies Aviso[]
    ).map(textoAviso);
    expect(textos).toEqual([
      "Contacto sin etiqueta: no sigue a ninguna bobina.",
      "No hay ninguna bobina K2 para este contacto.",
      "Bobina de contactor sin etiqueta.",
      "Otra bobina de contactor ya se llama K1.",
      "K1 es nombre de bobina y esto es un pulsador NA.",
      "El NC K2 corta a su propia bobina. ¿Es el enclavamiento de otro contactor?",
      "Borne 14 sin conectar.",
      "Cable con un extremo suelto.",
      "Alimentación sin nombre de red.",
    ]);
  });

  it("textoRepetida (la nota de T17, ahora el texto de R4): el artículo sale de la primera palabra", () => {
    expect(textoRepetida("Lámpara", "H1")).toBe("Otra lámpara ya se llama H1.");
    expect(textoRepetida("Pulsador NC", "S1")).toBe("Otro pulsador NC ya se llama S1.");
    expect(textoRepetida("Símbolo desconocido", "X1")).toBe("Otro símbolo desconocido ya se llama X1.");
  });

  it("contarAvisos separa errores de avisos", () => {
    const { a } = desdeMarchaParada();
    a.poner(BOBINA, 40, 0, "K1");
    expect(contarAvisos(validar(a.h))).toEqual({ errores: 2, avisos: 2 });
    expect(contarAvisos([])).toEqual({ errores: 0, avisos: 0 });
  });
});

// ── Al azar, contra el cálculo lento ───────────────────────────────────────

/** Generador de números con semilla (mulberry32), como en seguir.test.ts. */
function generador(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const SEMILLA = 20261115;
const OPERACIONES = 600;

/**
 * Normalización escrita acá, a propósito: el cálculo lento no puede usar
 * `normalizarEtiqueta`, porque la prueba con la normalización anulada la
 * reemplaza y los dos cálculos coincidirían.
 */
const norma = (texto: string): string => texto.trim().toUpperCase();

// Clases escritas aparte, desde la definición de cada símbolo.
const MANUALES = new Set(["manual_momentaneo", "manual_enclavado"]);
const lento = {
  fuente: (d: DefinicionSimbolo | undefined) => d?.elemento === "fuente",
  seguidor: (d: DefinicionSimbolo | undefined) => d?.accionamiento !== undefined && !MANUALES.has(d.accionamiento),
  titular: (d: DefinicionSimbolo | undefined) => d === undefined || (d.elemento !== "fuente" && !(d.accionamiento !== undefined && !MANUALES.has(d.accionamiento))),
  manual: (d: DefinicionSimbolo | undefined) => d?.accionamiento !== undefined && MANUALES.has(d.accionamiento),
  bobina: (d: DefinicionSimbolo | undefined) => d?.elemento === "bobina",
  sigueABobina: (d: DefinicionSimbolo | undefined) => d?.accionamiento === "bobina",
  auxiliarNC: (d: DefinicionSimbolo | undefined) => d?.elemento === "contacto_nc" && d.accionamiento === "bobina",
};

/** Lo que nombra un prefijo: la primera palabra del primer símbolo de la biblioteca que lo usa. */
/** Lo que nombra cada prefijo en R5 (T35, ajuste 1 de Bruno), escrito aparte; solo los de la biblioteca. */
function duenoLento(prefijo: string): string | undefined {
  const nombres: Record<string, string> = { K: "bobina", S: "pulsador", H: "lámpara", Q: "protección o maniobra", F: "protección", M: "motor" };
  return SIMBOLOS.some((s) => lento.titular(s) && s.prefijoEtiqueta === prefijo) ? nombres[prefijo] : undefined;
}

/** Si el componente pone la fase `n` en la hoja (R10): una Fase con esa etiqueta, o una fuente de varios bornes con un borne `n` (T35). */
function poneFaseLento(o: { c: { tipo: string }; def: DefinicionSimbolo | undefined; e: string }, n: string): boolean {
  if (o.c.tipo === FASE) return o.e === n;
  return o.def !== undefined && o.def.elemento === "fuente" && o.def.bornes.length > 1 && o.def.bornes.some((bb) => bb.nombre === n);
}

/** Vecinos de cada nodo ("b:comp|borne" o "w:cable"): lo que une cada cable. Sin union-find. */
type Vecinos = Map<string, string[]>;

function vecindad(h: Hoja): Vecinos {
  const vecinos: Vecinos = new Map();
  const unir = (x: string, y: string) => {
    for (const [p, q] of [
      [x, y],
      [y, x],
    ] as const) {
      let lista = vecinos.get(p);
      if (!lista) vecinos.set(p, (lista = []));
      lista.push(q);
    }
  };
  const cables = new Set(h.cables.map((w) => w.id));
  for (const w of h.cables) {
    for (const x of [w.desde, w.hasta]) {
      if (x.tipo === "borne") {
        const c = h.componentes.find((k) => k.id === x.comp);
        if (c && buscarSimbolo(c.tipo)?.bornes.some((bb) => bb.nombre === x.borne)) unir(`w:${w.id}`, `b:${x.comp}|${x.borne}`);
      } else if (x.tipo === "cable" && cables.has(x.cable)) unir(`w:${w.id}`, `w:${x.cable}`);
    }
  }
  return vecinos;
}

/** Los bornes a los que se llega desde `inicio` por cables (búsqueda a lo ancho). */
function alcanzados(vecinos: Vecinos, inicio: string): Set<string> {
  const vistos = new Set([inicio]);
  const pendientes = [inicio];
  while (pendientes.length > 0) {
    for (const v of vecinos.get(pendientes.pop()!) ?? []) {
      if (!vistos.has(v)) {
        vistos.add(v);
        pendientes.push(v);
      }
    }
  }
  return new Set([...vistos].filter((v) => v.startsWith("b:")).map((v) => v.slice(2)));
}

/**
 * El cálculo de referencia, lento y escrito aparte: por cada componente y
 * cada regla, recorre toda la hoja. Mismo orden que `validar`.
 */
function validarLento(h: Hoja): Aviso[] {
  const salida: Aviso[] = [];
  const todos = h.componentes.map((c) => ({ c, def: buscarSimbolo(c.tipo), e: norma(c.etiqueta) }));
  let vecinos: Vecinos | null = null;
  for (const yo of todos) {
    const { c, def, e } = yo;
    const prefijo = def && lento.titular(def) ? (def.prefijoEtiqueta ?? null) : null;
    if (lento.seguidor(def) && e === "") salida.push({ regla: "R1", severidad: "aviso", id: c.id });
    if (lento.sigueABobina(def) && e !== "" && !todos.some((o) => lento.bobina(o.def) && o.e === e)) salida.push({ regla: "R2", severidad: "aviso", id: c.id, etiqueta: e });
    if (prefijo !== null && e === "") salida.push({ regla: "R3", severidad: "aviso", id: c.id, nombre: def!.nombre });

    let r4: Aviso | null = null;
    if (lento.titular(def) && e !== "") {
      const otros = todos.filter((o) => o !== yo && lento.titular(o.def) && o.e === e);
      const nombre = (o: (typeof todos)[number]) => o.def?.nombre ?? "Símbolo desconocido";
      if (otros.length > 0 && [yo, ...otros].some((o) => !lento.manual(o.def))) {
        r4 = { regla: "R4", severidad: "error", id: c.id, etiqueta: e, otro: nombre(otros[0]!) };
      } else {
        const mismos = otros.filter((o) => o.c.tipo === c.tipo);
        if (mismos.length > 0) r4 = { regla: "R4", severidad: "aviso", id: c.id, etiqueta: e, otro: nombre(mismos[0]!) };
      }
    }
    if (r4) salida.push(r4);

    const m = /^([A-Z]+)(\d+)$/.exec(e);
    if (prefijo !== null && m && m[1] !== prefijo && r4?.severidad !== "error") {
      const dueno = duenoLento(m[1]!);
      if (dueno) salida.push({ regla: "R5", severidad: "aviso", id: c.id, etiqueta: e, nombre: def!.nombre, de: dueno });
    }

    if (lento.auxiliarNC(def) && e !== "") {
      const bornesBobina = new Set<string>();
      for (const o of todos) if (lento.bobina(o.def) && o.e === e) for (const bb of o.def!.bornes) bornesBobina.add(`${o.c.id}|${bb.nombre}`);
      const enSuRama = def!.bornes.some((bb) => {
        const red = alcanzados((vecinos ??= vecindad(h)), `b:${c.id}|${bb.nombre}`);
        const conNombre = todos.some((o) => lento.fuente(o.def) && o.def!.bornes.length === 1 && o.e !== "" && red.has(`${o.c.id}|${o.def!.bornes[0]!.nombre}`));
        return !conNombre && [...red].some((x) => bornesBobina.has(x));
      });
      if (enSuRama) salida.push({ regla: "R6", severidad: "aviso", id: c.id, etiqueta: e });
    }

    for (const bb of def?.bornes ?? []) {
      const conectado = h.cables.some((w) => [w.desde, w.hasta].some((x) => x.tipo === "borne" && x.comp === c.id && x.borne === bb.nombre));
      if (!conectado) salida.push({ regla: "R7", severidad: "aviso", id: c.id, borne: bb.nombre });
    }
    if (lento.fuente(def) && e === "") salida.push({ regla: "R9", severidad: "aviso", id: c.id });
    if (c.tipo === FASE && e === "L") {
      const otras = ["L1", "L2", "L3"].filter((n) => todos.some((o) => poneFaseLento(o, n)));
      if (otras.length > 0) salida.push({ regla: "R10", severidad: "aviso", id: c.id, otras: otras.length === 1 ? otras[0]! : `${otras.slice(0, -1).join(", ")} y ${otras.at(-1)}` });
    }
  }
  for (const w of h.cables) if (w.desde.tipo === "libre" || w.hasta.tipo === "libre") salida.push({ regla: "R8", severidad: "aviso", id: w.id });
  return salida;
}

/** Un aviso como texto, para comparar y para leer la diferencia. */
const canonico = (avisos: readonly Aviso[]): string[] => avisos.map((x) => JSON.stringify(x, Object.keys(x).sort()));

const ETIQUETAS = ["", "  ", "K1", "K2", " k1", "k2 ", "K7", "S1", "S2", "s1", "S3", "H1", "KM1", "L", "N", "X1"];
/** Lo que se coloca: más contactos y bobinas que lo demás. */
const TIPOS = [BOBINA, BOBINA, NA, NA, NC, NC, NC, PNA, PNA, PNA, PNC, PNC, LAMPARA, FASE, NEUTRO, DESCONOCIDO];

interface Recorrido {
  diferencias: number;
  primeras: string[];
  hechas: Record<string, number>;
  situaciones: Record<string, number>;
  rechazados: number;
  /** Con cada regla sacada de `reglas`, cuántos pasos dieron distinto que el cálculo lento. */
  conReglaAnulada: Record<string, number>;
  /** Pasos en que `validar(h, [regla])` no fue el filtro del resultado completo. */
  subconjuntoDistinto: number;
}

/**
 * Parte de la marcha-parada con la rama NC y hace `OPERACIONES` pasos al azar
 * (colocar, mover, rotar, espejar, borrar, renombrar con y sin arrastre,
 * cablear de borne a borne, a un extremo libre o en T, copiar, pegar,
 * duplicar, deshacer y rehacer) con un `Historial`. Después de cada paso
 * compara `calcular` con el cálculo lento. La secuencia depende solo de la
 * semilla: el resultado de `calcular` no decide nada. Con `conFaseL1`, arranca
 * con una segunda Fase «l1» (R10).
 */
function recorrer(calcular: (h: Hoja) => Aviso[], completo = false, conFaseL1 = false): Recorrido {
  const azar = generador(SEMILLA);
  const entero = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
  const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)]!;

  const { doc, historial } = marchaParada({ ramaNC: true });
  // R10 (T29): una segunda Fase «l1» junto a la «L» de la marcha-parada; sin ella, el recorrido casi nunca tiene dos fases.
  if (conFaseL1) historial.ejecutar(colocar(doc, { tipo: FASE, x: -10, y: 0, rot: 0, espejado: false, etiqueta: "l1", params: {} }));
  const h = doc.hojas[0]!;
  let portapapeles: Recorte | null = null;
  let rechazados = 0;
  let diferencias = 0;
  let subconjuntoDistinto = 0;
  const primeras: string[] = [];
  const hechas: Record<string, number> = {
    colocar: 0,
    mover: 0,
    rotar: 0,
    espejar: 0,
    borrar: 0,
    renombrar: 0,
    renombrarFuente: 0,
    renombrarConArrastre: 0,
    cablear: 0,
    cablearNCaBobina: 0,
    cablearSuelto: 0,
    cablearEnT: 0,
    copiar: 0,
    pegar: 0,
    duplicar: 0,
    deshacer: 0,
    rehacer: 0,
  };
  const situaciones: Record<string, number> = {
    ...Object.fromEntries(TODAS.map((r) => [r, 0])),
    R4error: 0,
    R4aviso: 0,
    pulsadorDobleContactoSinAviso: 0,
    R5callaPorR4: 0,
    etiquetaSinNormalizarEnUnAviso: 0,
  };
  const conReglaAnulada: Record<string, number> = Object.fromEntries(TODAS.map((r) => [r, 0]));

  const ejecutar = (armarlo: () => Comando): boolean => {
    try {
      historial.ejecutar(armarlo());
      return true;
    } catch {
      rechazados++;
      return false;
    }
  };

  const algunos = (): string[] => {
    const ids = new Set<string>();
    const n = entero(1, Math.min(4, h.componentes.length));
    while (ids.size < n) ids.add(elegir(h.componentes).id);
    if (h.cables.length > 0 && azar() < 0.3) ids.add(elegir(h.cables).id);
    return [...ids];
  };

  const bornes = (): Extremo[] => {
    const lista: Extremo[] = [];
    for (const c of h.componentes) for (const bb of buscarSimbolo(c.tipo)?.bornes ?? []) lista.push(b(c.id, bb.nombre));
    return lista;
  };

  /** Un cable de un borne (`desde`, o uno al azar) a `hasta`, con un codo si no están alineados. */
  const tender = (hasta: () => Extremo | null, desdeDado?: Extremo): boolean => {
    const lista = bornes();
    if (lista.length === 0) return false;
    const desde = desdeDado ?? elegir(lista);
    const destino = hasta();
    if (!destino) return false;
    const indice = indexarHoja(h);
    const p = puntoExtremo(indice, desde);
    const q = puntoExtremo(indice, destino);
    if (!p || !q || (p.x === q.x && p.y === q.y)) return false;
    const codos: [number, number][] = p.x === q.x || p.y === q.y ? [] : azar() < 0.5 ? [[q.x, p.y]] : [[p.x, q.y]];
    return ejecutar(() => cablear(doc, { desde, hasta: destino, codos }));
  };

  /** Un punto entero sobre un tramo de un cable al azar, para una T. */
  const puntoEnCable = (): Extremo | null => {
    if (h.cables.length === 0) return null;
    const w = elegir(h.cables);
    const r = recorridoCable(indexarHoja(h), w);
    if (!r) return null;
    const k = entero(0, r.length / 2 - 2);
    const [x0, y0, x1, y1] = [r[2 * k]!, r[2 * k + 1]!, r[2 * k + 2]!, r[2 * k + 3]!];
    const x = x0 === x1 ? x0 : entero(Math.min(x0, x1), Math.max(x0, x1));
    const y = y0 === y1 ? y0 : entero(Math.min(y0, y1), Math.max(y0, y1));
    return t(w.id, x, y);
  };

  for (let k = 0; k < OPERACIONES; k++) {
    const r = azar();
    const vacia = h.componentes.length === 0;
    let hecha: string | null = null;
    if (r < 0.14) {
      const datos = { tipo: elegir(TIPOS), x: entero(-20, 20), y: entero(-20, 20), rot: elegir(ROTACIONES), espejado: azar() < 0.3, etiqueta: elegir(ETIQUETAS), params: {} };
      if (ejecutar(() => colocar(doc, datos))) hecha = "colocar";
    } else if (r < 0.19) {
      if (!vacia && ejecutar(() => new Mover(algunos(), entero(-4, 4), entero(-4, 4)))) hecha = "mover";
    } else if (r < 0.22) {
      if (!vacia && ejecutar(() => new Rotar(algunos(), elegir([90, -90] as const)))) hecha = "rotar";
    } else if (r < 0.24) {
      if (!vacia && ejecutar(() => new Espejar(algunos()))) hecha = "espejar";
    } else if (r < 0.32) {
      if (!vacia && ejecutar(() => new Borrar(algunos()))) hecha = "borrar";
    } else if (r < 0.38) {
      if (!vacia && ejecutar(() => new CambiarEtiqueta(elegir(h.componentes).id, elegir(ETIQUETAS)))) hecha = "renombrar";
    } else if (r < 0.41) {
      // Una fuente: con o sin nombre de red (R9 y el salteo de R6 en las redes con nombre).
      const fuentes = h.componentes.filter((c) => c.tipo === FASE || c.tipo === NEUTRO);
      if (fuentes.length > 0 && ejecutar(() => new CambiarEtiqueta(elegir(fuentes).id, elegir(["", "  ", "L", "N", "L2"])))) hecha = "renombrarFuente";
    } else if (r < 0.44) {
      const lista = h.componentes.filter((c) => c.tipo === BOBINA);
      if (lista.length > 0) {
        const plan = planRenombrarBobina(h, elegir(lista).id, elegir(["K1", "K2", "K3", "K7"]));
        if (plan.cambios.size > 0 && ejecutar(() => new CambiarEtiquetas(plan.cambios))) hecha = "renombrarConArrastre";
      }
    } else if (r < 0.5) {
      if (tender(() => elegir(bornes()))) hecha = "cablear";
    } else if (r < 0.56) {
      // De un auxiliar NC a una bobina: es lo que pone a prueba R6.
      const ncs = h.componentes.filter((c) => c.tipo === NC);
      const bobinas = h.componentes.filter((c) => c.tipo === BOBINA);
      if (ncs.length > 0 && bobinas.length > 0) {
        // Casi siempre, un NC con la etiqueta de esa bobina (si hay).
        const pares = ncs.flatMap((nc) => bobinas.filter((k) => norma(k.etiqueta) !== "" && norma(k.etiqueta) === norma(nc.etiqueta)).map((k) => [nc, k] as const));
        const [nc, bobina] = pares.length > 0 && azar() < 0.7 ? elegir(pares) : [elegir(ncs), elegir(bobinas)];
        if (tender(() => b(bobina.id, elegir(["A1", "A2"])), b(nc.id, elegir(["21", "22"])))) hecha = "cablearNCaBobina";
      }
    } else if (r < 0.59) {
      if (tender(() => libre(entero(-24, 24), entero(-24, 24)))) hecha = "cablearSuelto";
    } else if (r < 0.64) {
      if (tender(puntoEnCable)) hecha = "cablearEnT";
    } else if (r < 0.68) {
      if (!vacia) {
        portapapeles = recortar(h, algunos());
        hecha = "copiar";
      }
    } else if (r < 0.73) {
      const recorte = portapapeles;
      if (recorte && ejecutar(() => pegar(doc, conEtiquetas(recorte, etiquetarLote(etiquetasDeTitulares(h), recorte.componentes)), entero(-3, 3), entero(-3, 3)))) {
        hecha = "pegar";
      }
    } else if (r < 0.77) {
      if (!vacia) {
        const recorte = recortar(h, algunos());
        if (ejecutar(() => pegar(doc, conEtiquetas(recorte, etiquetarLote(etiquetasDeTitulares(h), recorte.componentes)), entero(4, 12), 0))) hecha = "duplicar";
      }
    } else if (r < 0.88) {
      if (historial.deshacer()) hecha = "deshacer";
    } else if (historial.rehacer()) {
      hecha = "rehacer";
    }
    if (hecha === null) continue;
    hechas[hecha]!++;

    const lenta = validarLento(h);
    const esperado = canonico(lenta);
    const obtenido = canonico(calcular(h));
    if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) {
      diferencias++;
      if (primeras.length < 3) primeras.push(`operación ${k} (${hecha}):\n  da       ${obtenido.join("\n           ")}\n  esperado ${esperado.join("\n           ")}`);
    }
    if (completo) {
      for (const regla of TODAS) {
        if (JSON.stringify(canonico(validar(h, TODAS.filter((x) => x !== regla)))) !== JSON.stringify(esperado)) conReglaAnulada[regla]!++;
        if (JSON.stringify(canonico(validar(h, [regla]))) !== JSON.stringify(canonico(de(lenta, regla)))) subconjuntoDistinto++;
      }
    }
    contarSituaciones(h, lenta, situaciones);
  }
  return { diferencias, primeras, hechas, situaciones, rechazados, conReglaAnulada, subconjuntoDistinto };
}

/** Suma 1 a cada situación que se da en el paso: las que ponen a prueba cada regla. */
function contarSituaciones(h: Hoja, lenta: readonly Aviso[], s: Record<string, number>): void {
  const marcar = (nombre: string, si: boolean) => {
    if (si) s[nombre]!++;
  };
  for (const regla of TODAS) marcar(regla, lenta.some((x) => x.regla === regla));
  marcar("R4error", lenta.some((x) => x.regla === "R4" && x.severidad === "error"));
  marcar("R4aviso", lenta.some((x) => x.regla === "R4" && x.severidad === "aviso"));

  const porId = new Map(h.componentes.map((c) => [c.id, c]));
  const grupos = new Map<string, string[]>();
  for (const c of h.componentes) {
    const e = norma(c.etiqueta);
    if (e !== "" && lento.titular(buscarSimbolo(c.tipo))) grupos.set(e, [...(grupos.get(e) ?? []), c.tipo]);
  }
  marcar("pulsadorDobleContactoSinAviso", [...grupos.values()].some((tipos) => tipos.length === 2 && tipos.includes(PNA) && tipos.includes(PNC)));

  const errores = new Set(lenta.filter((x) => x.regla === "R4" && x.severidad === "error").map((x) => x.id));
  marcar(
    "R5callaPorR4",
    h.componentes.some((c) => {
      const def = buscarSimbolo(c.tipo);
      const prefijo = def && lento.titular(def) ? def.prefijoEtiqueta : undefined;
      const m = /^([A-Z]+)(\d+)$/.exec(norma(c.etiqueta));
      return errores.has(c.id) && prefijo !== undefined && m !== null && m[1] !== prefijo && duenoLento(m[1]!) !== undefined;
    }),
  );
  marcar(
    "etiquetaSinNormalizarEnUnAviso",
    lenta.some((x) => "etiqueta" in x && porId.get(x.id) !== undefined && porId.get(x.id)!.etiqueta !== x.etiqueta),
  );
}

// Tope holgado: el recorrido tarda 1,5 s en la PC; en una máquina cargada no tiene que fallar por tiempo.
describe("al azar, con semilla fija, contra el cálculo lento", { timeout: 30_000 }, () => {
  it(`${OPERACIONES} operaciones (semilla ${SEMILLA}): después de cada paso, igual que el cálculo lento; cada regla sale y cada una, anulada, se nota`, () => {
    const r = recorrer((h) => validar(h), true);
    expect(r.primeras, `${r.diferencias} pasos con diferencias`).toEqual([]);
    expect(r.diferencias).toBe(0);
    expect(r.subconjuntoDistinto, "validar(h, [regla]) no es el filtro del completo").toBe(0);
    for (const [operacion, n] of Object.entries(r.hechas)) expect(n, operacion).toBeGreaterThan(0);
    // R10 casi nunca sale con una sola Fase: lo prueba el recorrido siguiente, con dos.
    for (const [situacion, n] of Object.entries(r.situaciones)) if (situacion !== "R10") expect(n, situacion).toBeGreaterThan(0);
    // Reglas anuladas a propósito: sin cualquiera de ellas, el recorrido da distinto.
    for (const [regla, n] of Object.entries(r.conReglaAnulada)) if (regla !== "R10") expect(n, `sin ${regla}`).toBeGreaterThan(0);
  });

  it(`R10: el mismo recorrido con una segunda Fase «l1» desde el principio; R10 sale, igual que el lento, y anulada se nota`, () => {
    const r = recorrer((h) => validar(h), true, true);
    expect(r.primeras, `${r.diferencias} pasos con diferencias`).toEqual([]);
    expect(r.diferencias).toBe(0);
    expect(r.subconjuntoDistinto, "validar(h, [regla]) no es el filtro del completo").toBe(0);
    expect(r.situaciones.R10).toBeGreaterThan(0);
    expect(r.conReglaAnulada.R10).toBeGreaterThan(0);
  });

  it("con la normalización anulada a propósito, el mismo recorrido encuentra diferencias", async () => {
    vi.resetModules();
    vi.doMock("./etiquetas", async (importOriginal) => ({
      ...(await importOriginal<typeof import("./etiquetas")>()),
      normalizarEtiqueta: (texto: string) => texto,
    }));
    try {
      const mutante = (await import("./validaciones")).validar;
      // El reemplazo llegó: un contacto « k1» ya no sigue a la bobina K1.
      const { a } = desdeMarchaParada();
      a.poner(NA, 40, 0, " k1");
      expect(de(mutante(a.h), "R2")).toHaveLength(1);
      expect(de(validar(a.h), "R2")).toHaveLength(0);

      const r = recorrer(mutante);
      expect(r.diferencias, "el recorrido al azar no notó que falta la normalización").toBeGreaterThan(0);
    } finally {
      vi.doUnmock("./etiquetas");
      vi.resetModules();
    }
  });

  it("con las redes anuladas a propósito (cada borne solo), R6 se apaga y el recorrido lo nota", async () => {
    vi.resetModules();
    vi.doMock("./redes", async (importOriginal) => {
      const original = await importOriginal<typeof import("./redes")>();
      return {
        ...original,
        redes: (h: Hoja) => original.redes({ ...h, cables: [] }),
      };
    });
    try {
      const mutante = (await import("./validaciones")).validar;
      const r = recorrer(mutante);
      expect(r.diferencias, "el recorrido al azar no notó que R6 no mira los cables").toBeGreaterThan(0);
    } finally {
      vi.doUnmock("./redes");
      vi.resetModules();
    }
  });
});
