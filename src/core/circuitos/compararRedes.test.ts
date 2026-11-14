import { describe, expect, it } from "vitest";
import { deserializar, serializar } from "../io";
import { invariantes } from "../io/prueba-invariantes";
import { Borrar, CambiarEtiqueta, cablear, colocar, Mover } from "../model/comandos";
import { crearDocumento, type Documento, type Extremo } from "../model/documento";
import { Historial } from "../model/historial";
import { compararRedes, SIN_COMPARAR_REDES } from "./compararRedes";
import { marchaParada } from "./marchaParada";

const base = (): Documento => marchaParada().doc;

/**
 * El documento con los ids renumerados (c1 → c21, w1 → w21) y los componentes
 * y los cables en el orden inverso: como un archivo armado en otra sesión, en
 * otro orden.
 */
function renumerado(doc: Documento, suma: number): Documento {
  const id = (s: string): string => s.replace(/^([a-z]+)(\d+)$/, (_, prefijo: string, n: string) => `${prefijo}${Number(n) + suma}`);
  const extremo = (e: Extremo): Extremo =>
    e.tipo === "borne" ? { ...e, comp: id(e.comp) } : e.tipo === "cable" ? { ...e, cable: id(e.cable) } : { ...e };
  const hoja = doc.hojas[0]!;
  return {
    ...doc,
    contadores: Object.fromEntries(Object.entries(doc.contadores).map(([k, v]) => [k, v + suma])),
    hojas: [
      {
        ...hoja,
        componentes: hoja.componentes.map((c) => ({ ...c, id: id(c.id) })).reverse(),
        cables: hoja.cables.map((w) => ({ ...w, id: id(w.id), desde: extremo(w.desde), hasta: extremo(w.hasta) })).reverse(),
      },
    ],
  };
}

describe("compararRedes: un .brn contra la marcha-parada por \"etiqueta·borne\"", () => {
  it("el armado movido, con otros ids y en otro orden: sin diferencias", () => {
    const { doc, historial } = marchaParada();
    const hoja = doc.hojas[0]!;
    const antes = hoja.componentes.map((c) => [c.x, c.y]);
    historial.ejecutar(new Mover([...hoja.componentes.map((c) => c.id), ...hoja.cables.map((w) => w.id)], 7, 3));
    expect(doc.hojas[0]!.componentes.map((c) => [c.x, c.y])).toEqual(antes.map(([x, y]) => [x! + 7, y! + 3]));

    const otro = renumerado(doc, 20);
    expect(invariantes(otro)).toEqual([]);
    expect(deserializar(serializar(otro))).toEqual({ ok: true, documento: otro, avisos: [] });
    const idsBase = new Set([...base().hojas[0]!.componentes, ...base().hojas[0]!.cables].map((x) => x.id));
    expect([...otro.hojas[0]!.componentes, ...otro.hojas[0]!.cables].some((x) => idsBase.has(x.id))).toBe(false);

    expect(compararRedes(otro, base())).toEqual([]);
  });

  it("sin el cable de retención (w5, K1·14 → S1·14): dice qué red se partió", () => {
    const { doc, historial, cables } = marchaParada();
    historial.ejecutar(new Borrar([cables[4]!]));
    expect(compararRedes(doc, base())).toEqual([
      "Se partió la red {S1·14, K1·14, K1·A1, H1·X1}: quedó en {S1·14, K1·A1, H1·X1} y {K1·14}.",
    ]);
  });

  it("con S0 puenteado (un cable de S0·11 a S0·12): dice qué redes se unieron", () => {
    const { doc, historial, comp } = marchaParada();
    historial.ejecutar(
      cablear(doc, {
        desde: { tipo: "borne", comp: comp.s0, borne: "11" },
        hasta: { tipo: "borne", comp: comp.s0, borne: "12" },
        codos: [
          [-3, 3],
          [-3, 7],
        ],
      }),
    );
    expect(compararRedes(doc, base())).toEqual(["Se unieron las redes {L·L, S0·11} y {S0·12, S1·13, K1·13}."]);
  });

  it("la variante con dos Neutro \"N\" sin cable entre ellos: sin diferencias (se unen por nombre), también con \"n \"", () => {
    const variante = marchaParada({ dosNeutros: true });
    expect(compararRedes(variante.doc, base())).toEqual([]);
    variante.historial.ejecutar(new CambiarEtiqueta(variante.comp.neutro2!, "n "));
    expect(variante.doc.hojas[0]!.componentes.find((c) => c.id === variante.comp.neutro2)!.etiqueta).toBe("n ");
    expect(compararRedes(variante.doc, base())).toEqual([]);
  });

  it("componentes: falta, sobra, repetido y fuentes (una \"N\" de más no es repetida)", () => {
    const { doc, historial, comp } = marchaParada();
    const poner = (tipo: string, x: number, etiqueta: string): string => {
      const cmd = colocar(doc, { tipo, x, y: 40, rot: 0, espejado: false, etiqueta, params: {} });
      historial.ejecutar(cmd);
      return cmd.id;
    };
    historial.ejecutar(new Borrar([comp.h1]));
    const s2 = poner("pulsador.na", 0, "S2");
    const k1 = poner("contactor.bobina", 5, "k1 ");
    const l1 = poner("fuente.fase", 10, "L1");
    poner("fuente.neutro", 15, "N");
    const sinNombre = poner("fuente.fase", 20, "");

    expect(compararRedes(doc, base())).toEqual([
      'Falta "H1" (senalizacion.lampara).',
      `Hay 2 "K1" (contactor.bobina): ${comp.k1Bobina}, ${k1}.`,
      `Sobra "S2" (pulsador.na, ${s2}).`,
      `Sobra "L1" (fuente.fase, ${l1}): fuente con un nombre de red nuevo.`,
      `Sobra una fuente sin nombre de red (fuente.fase, ${sinNombre}).`,
      SIN_COMPARAR_REDES,
    ]);
  });

  it("un contacto auxiliar sin etiqueta: no sigue a ninguna bobina (T17b, D2b)", () => {
    const { doc, historial, comp } = marchaParada();
    historial.ejecutar(new CambiarEtiqueta(comp.k1Auxiliar, ""));
    expect(compararRedes(doc, base())).toEqual([
      'Falta "K1" (contactor.auxiliar_na).',
      `Contacto sin etiqueta (contactor.auxiliar_na, ${comp.k1Auxiliar}): no sigue a ninguna bobina.`,
      SIN_COMPARAR_REDES,
    ]);
  });
});

const borne = (comp: string, nombre: string): Extremo => ({ tipo: "borne", comp, borne: nombre });

/**
 * La marcha-parada con una rama de señalización: un segundo NA de K1 (`k1b`,
 * c8) que prende H2 (c9). Fase "L" → K1 13-14 → H2 → H1·X2 (la red del
 * Neutro). `aH2` es el cable de K1·14 a H2·X1.
 */
function conRamaH2() {
  const mp = marchaParada();
  const { doc, historial, comp } = mp;
  const poner = (tipo: string, x: number, y: number, etiqueta: string): string => {
    const cmd = colocar(doc, { tipo, x, y, rot: 0, espejado: false, etiqueta, params: {} });
    historial.ejecutar(cmd);
    return cmd.id;
  };
  const k1b = poner("contactor.auxiliar_na", 24, 11, "K1");
  const h2 = poner("senalizacion.lampara", 24, 22, "H2");
  historial.ejecutar(cablear(doc, { desde: borne(comp.fase, "L"), hasta: borne(k1b, "13"), codos: [[24, 1]] }));
  const aH2 = cablear(doc, { desde: borne(k1b, "14"), hasta: borne(h2, "X1"), codos: [] });
  historial.ejecutar(aH2);
  historial.ejecutar(cablear(doc, { desde: borne(h2, "X2"), hasta: borne(comp.h1, "X2"), codos: [] }));
  return { ...mp, k1b, h2, aH2: aH2.id };
}

/**
 * Una hoja de prueba con las Fases "A", "B" y "C" (c1 a c3, redes con nombre)
 * y contactos auxiliares NA "K1" (desde c4). Cada contacto se da como [red de
 * su 13, red de su 14]; una red en minúscula ("m1") junta solo bornes de
 * contactos. Cada cable va en L (un codo, o ninguno si están alineados):
 * `redes` no mira por dónde pasa.
 */
function hojaDeContactos(contactos: readonly (readonly [string, string])[]): Documento {
  const doc = crearDocumento({ titulo: "Contactos", autor: "", fecha: "2026-11-14" });
  const historial = new Historial(doc);
  /** Los bornes de cada red, con su posición en la grilla. */
  const miembros = new Map<string, { extremo: Extremo; x: number; y: number }[]>();
  const sumar = (red: string, extremo: Extremo, x: number, y: number): void => {
    let lista = miembros.get(red);
    if (!lista) miembros.set(red, (lista = []));
    lista.push({ extremo, x, y });
  };
  const poner = (tipo: string, x: number, y: number, etiqueta: string): string => {
    const cmd = colocar(doc, { tipo, x, y, rot: 0, espejado: false, etiqueta, params: {} });
    historial.ejecutar(cmd);
    return cmd.id;
  };
  // Fase: borne L en (0, 1). NA: 13 en (0, −2) y 14 en (0, 2).
  ["A", "B", "C"].forEach((nombre, i) => sumar(nombre, borne(poner("fuente.fase", 4 * i, 0, nombre), "L"), 4 * i, 1));
  contactos.forEach(([red13, red14], i) => {
    const id = poner("contactor.auxiliar_na", 4 * i, 10, "K1");
    sumar(red13, borne(id, "13"), 4 * i, 8);
    sumar(red14, borne(id, "14"), 4 * i, 12);
  });
  for (const lista of miembros.values()) {
    for (let j = 1; j < lista.length; j++) {
      const a = lista[j - 1]!;
      const b = lista[j]!;
      const codos: [number, number][] = a.x !== b.x && a.y !== b.y ? [[b.x, a.y]] : [];
      historial.ejecutar(cablear(doc, { desde: a.extremo, hasta: b.extremo, codos }));
    }
  }
  return doc;
}

/** "K1" (NA, id) con sus dos redes, como lo escribe `compararRedes`. */
const na = (id: string, red13: string, red14: string): string => `"K1" (contactor.auxiliar_na, ${id}) con 13 en ${red13} y 14 en ${red14}`;
const NO_LA_TIENE = ": la base no lo tiene entre esas redes.";
const TRABADO = ": alguna de sus redes solo tiene contactos repetidos.";

describe("compararRedes: contactos repetidos por firma (T17b, D2a) y vacíos (D2b)", () => {
  it("dos NA de K1 en la base y en el dibujo, con otros ids, en otro orden y movido: sin diferencias", () => {
    const { doc, historial } = conRamaH2();
    const hoja = doc.hojas[0]!;
    historial.ejecutar(new Mover([...hoja.componentes.map((c) => c.id), ...hoja.cables.map((w) => w.id)], 7, 3));
    const otro = renumerado(doc, 20);
    expect(invariantes(otro)).toEqual([]);
    expect(compararRedes(otro, conRamaH2().doc)).toEqual([]);
  });

  it("los dos NA de K1 cruzados entre sus redes: diferencia (un multiconjunto de redes no la ve)", () => {
    const { doc, historial, comp, cables, k1b, h2, aH2 } = conRamaH2();
    historial.ejecutar(new Borrar([cables[4]!, aH2]));
    historial.ejecutar(cablear(doc, { desde: borne(comp.k1Auxiliar, "14"), hasta: borne(h2, "X1"), codos: [[10, 20]] }));
    historial.ejecutar(cablear(doc, { desde: borne(k1b, "14"), hasta: borne(comp.s1, "14"), codos: [] }));
    expect(compararRedes(doc, conRamaH2().doc)).toEqual([
      `${na(comp.k1Auxiliar, "{S0·12, S1·13}", "{H2·X1}")}${NO_LA_TIENE}`,
      `${na(k1b, "{L·L, S0·11}", "{S1·14, K1·A1, H1·X1}")}${NO_LA_TIENE}`,
    ]);
  });

  it("un NA de K1 corrido a la red del Neutro: la red muestra 3 nombres y \"…\"", () => {
    const { doc, historial, comp, k1b, aH2 } = conRamaH2();
    historial.ejecutar(new Borrar([aH2]));
    historial.ejecutar(cablear(doc, { desde: borne(k1b, "14"), hasta: borne(comp.h1, "X2"), codos: [[24, 24]] }));
    expect(compararRedes(doc, conRamaH2().doc)).toEqual([`${na(k1b, "{L·L, S0·11}", "{K1·A2, H1·X2, N·N, …}")}${NO_LA_TIENE}`]);
  });

  it("tres NA de K1 contra dos en la base: diferencia de cantidad", () => {
    const dos = hojaDeContactos([
      ["A", "B"],
      ["A", "B"],
    ]);
    const tres = hojaDeContactos([
      ["A", "B"],
      ["A", "B"],
      ["A", "B"],
    ]);
    expect(compararRedes(tres, dos)).toEqual(['Hay 3 "K1" (contactor.auxiliar_na); la base tiene 2.', SIN_COMPARAR_REDES]);
  });

  it("en serie, con una red del medio que solo tiene bornes repetidos: igual sin diferencias, corrido o partido con diferencia", () => {
    const serie = (): Documento =>
      hojaDeContactos([
        ["A", "m"],
        ["m", "B"],
      ]);
    expect(compararRedes(renumerado(serie(), 20), serie())).toEqual([]);
    const alReves = hojaDeContactos([
      ["m", "B"],
      ["A", "m"],
    ]);
    expect(compararRedes(alReves, serie())).toEqual([]);

    const corrido = hojaDeContactos([
      ["A", "m"],
      ["m", "C"],
    ]);
    expect(compararRedes(corrido, serie())).toEqual([`${na("c5", "{K1·14#1}", "{C·L}")}${NO_LA_TIENE}`]);

    // Se identifican aunque el medio esté cortado: lo ve la partición, con los nombres ya puestos.
    const partido = hojaDeContactos([
      ["A", "m1"],
      ["m2", "B"],
    ]);
    expect(compararRedes(partido, serie())).toEqual(["Se partió la red {K1·14#1, K1·13#2}: quedó en {K1·14#1} y {K1·13#2}."]);
  });

  it("en paralelo, entre las mismas redes (firmas idénticas): igual sin diferencias, corrido con diferencia", () => {
    const paralelo = (): Documento =>
      hojaDeContactos([
        ["A", "B"],
        ["A", "B"],
      ]);
    expect(compararRedes(renumerado(paralelo(), 20), paralelo())).toEqual([]);
    const corrido = hojaDeContactos([
      ["A", "B"],
      ["A", "C"],
    ]);
    expect(compararRedes(corrido, paralelo())).toEqual([`${na("c5", "{A·L, K1·13#1}", "{C·L}")}${NO_LA_TIENE}`]);
  });

  it("límite conocido: dos cadenas en serie, en paralelo entre sí, no se identifican; termina con diferencia y no cicla", () => {
    const dosCadenas = (): Documento =>
      hojaDeContactos([
        ["A", "m1"],
        ["m1", "B"],
        ["A", "m2"],
        ["m2", "B"],
      ]);
    const vacia = "{sin bornes conocidos}";
    expect(compararRedes(dosCadenas(), dosCadenas())).toEqual([
      `No se pudo identificar ${na("c4", "{A·L}", vacia)}${TRABADO}`,
      `No se pudo identificar ${na("c5", vacia, "{B·L}")}${TRABADO}`,
      `No se pudo identificar ${na("c6", "{A·L}", vacia)}${TRABADO}`,
      `No se pudo identificar ${na("c7", vacia, "{B·L}")}${TRABADO}`,
    ]);
  });

  it("un NC sin etiqueta en el dibujo: no sigue a ninguna bobina", () => {
    const { doc, historial } = marchaParada();
    const nc = colocar(doc, { tipo: "contactor.auxiliar_nc", x: 24, y: 11, rot: 0, espejado: false, etiqueta: "", params: {} });
    historial.ejecutar(nc);
    expect(compararRedes(doc, base())).toEqual([`Contacto sin etiqueta (contactor.auxiliar_nc, ${nc.id}): no sigue a ninguna bobina.`, SIN_COMPARAR_REDES]);
  });

  it("la base: con un contacto sin etiqueta tira; con dos NA de K1 no; con dos bobinas K1 tira", () => {
    const vacia = marchaParada();
    vacia.historial.ejecutar(new CambiarEtiqueta(vacia.comp.k1Auxiliar, ""));
    expect(() => compararRedes(base(), vacia.doc)).toThrow(
      `compararRedes: la base tiene un contacto sin etiqueta (contactor.auxiliar_na, ${vacia.comp.k1Auxiliar}).`,
    );

    expect(compararRedes(conRamaH2().doc, conRamaH2().doc)).toEqual([]);

    const dosBobinas = marchaParada();
    dosBobinas.historial.ejecutar(colocar(dosBobinas.doc, { tipo: "contactor.bobina", x: 24, y: 22, rot: 0, espejado: false, etiqueta: "K1", params: {} }));
    expect(() => compararRedes(base(), dosBobinas.doc)).toThrow('compararRedes: la base tiene 2 "K1" (contactor.bobina).');
  });
});
