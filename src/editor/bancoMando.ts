// Escena de mando 2000 (fase 5, T31; docs/plan-T31.md, E-A): la escena de
// S1–S5 de «Probar la fase 5». Un circuito de verdad, que se simula:
//  - 100 marcha-paradas simples (7 símbolos, 8 cables),
//  - 100 marcha-paradas con la rama NC de la lámpara de parado (9 y 11),
//  - una cadena de 100 relés (4 símbolos y 3 cables por relé): S400 alimenta
//    K201, el NA de K201 alimenta K202, y así hasta K300.
// Son 2000 componentes justos, 2200 cables y 300 bobinas. Cada celda tiene su
// Fase «L» y su Neutro «N»: la netlist las une por nombre (D7).
//
// Las celdas no se arman acá: se copian corridas de los circuitos de
// referencia (`marchaParada()` y `cadena()` de `src/core/circuitos/`), que se
// arman con comandos y pasan cada cable por W. Copiar es solo sumar un
// desplazamiento: las celdas no se tocan entre sí, así no hay conexiones
// aparentes (lo prueba bancoMando.test.ts). Como `documentoBanco`, se arma de
// cero (no es un cambio a un documento que ya existe): sin comandos.

import { marchaParada } from "../core/circuitos/marchaParada";
import { cadena } from "../core/circuitos/sim";
import { crearDocumento, generarId, PREFIJO_CABLE, type Documento, type Extremo, type Hoja } from "../core/model/documento";

/** Cuántas celdas de cada clase y cuántas por fila. */
export const MANDO = { simples: 100, conNC: 100, cadena: 100, porFila: 10 } as const;
/** Separación entre celdas (unidades de grilla). */
const PASO_SIMPLE = { dx: 24, dy: 40 };
const PASO_NC = { dx: 32, dy: 40 };
const PASO_CADENA = { dx: 10, dy: 24 };
/** Separación entre los tres bloques. */
const ENTRE_BLOQUES = 8;

export interface MarchaBanco {
  /** Id del pulsador NA (la marcha). */
  marcha: string;
  /** Id del pulsador NC (la parada). */
  parada: string;
  /** Etiqueta de su bobina. */
  bobina: string;
}

export interface BancoMando {
  doc: Documento;
  /** Las 200 marcha-paradas, primero las simples y después las de rama NC. */
  marchas: MarchaBanco[];
  /** El pulsador que arranca la cadena y las etiquetas de sus bobinas, en orden. */
  cadena: { pulsador: string; bobinas: string[] };
}

/**
 * Copia a `doc` los componentes `ids` de `plantilla` (con los cables que
 * tienen sus dos extremos en ellos), corridos (dx, dy), con ids nuevos y las
 * etiquetas de `etiquetas` (por id de la plantilla; si falta, la misma).
 * Devuelve el id nuevo de cada id de la plantilla. También la usa la escena
 * de potencia (`bancoPotencia.ts`, T37).
 */
export function copiar(doc: Documento, plantilla: Hoja, ids: ReadonlySet<string>, dx: number, dy: number, etiquetas: ReadonlyMap<string, string>): Map<string, string> {
  const hoja = doc.hojas[0]!;
  const nuevo = new Map<string, string>();
  for (const c of plantilla.componentes) {
    if (!ids.has(c.id)) continue;
    const id = generarId(doc);
    nuevo.set(c.id, id);
    hoja.componentes.push({ ...c, id, x: c.x + dx, y: c.y + dy, etiqueta: etiquetas.get(c.id) ?? c.etiqueta, params: { ...c.params } });
  }
  const dentro = (e: Extremo) => e.tipo !== "borne" || ids.has(e.comp);
  const cables = plantilla.cables.filter((w) => dentro(w.desde) && dentro(w.hasta));
  const deCable = new Map(cables.map((w) => [w.id, generarId(doc, PREFIJO_CABLE)]));
  const mover = (e: Extremo): Extremo => {
    if (e.tipo === "borne") return { tipo: "borne", comp: nuevo.get(e.comp)!, borne: e.borne };
    if (e.tipo === "cable") {
      const cable = deCable.get(e.cable);
      if (!cable) throw new Error(`Banco de mando: la T sobre ${e.cable} queda afuera de la celda.`);
      return { tipo: "cable", cable, x: e.x + dx, y: e.y + dy };
    }
    return { tipo: "libre", x: e.x + dx, y: e.y + dy };
  };
  for (const w of cables) {
    hoja.cables.push({ id: deCable.get(w.id)!, desde: mover(w.desde), hasta: mover(w.hasta), codos: w.codos.map(([x, y]) => [x + dx, y + dy]) });
  }
  return nuevo;
}

/** La escena de mando 2000 (E-A). Siempre la misma: sin azar. */
export function bancoMando(): BancoMando {
  const doc = crearDocumento({ titulo: "Banco de mando 2000", autor: "", fecha: "2026-11-21" });
  const marchas: MarchaBanco[] = [];
  const posicion = (i: number, x0: number, paso: { dx: number; dy: number }) => ({
    x: x0 + (i % MANDO.porFila) * paso.dx,
    y: Math.floor(i / MANDO.porFila) * paso.dy,
  });

  // Marcha-paradas: simples desde K1, con rama NC desde K101.
  const bloques = [
    { mp: marchaParada(), n: MANDO.simples, x0: 0, paso: PASO_SIMPLE },
    { mp: marchaParada({ ramaNC: true }), n: MANDO.conNC, x0: MANDO.porFila * PASO_SIMPLE.dx + ENTRE_BLOQUES, paso: PASO_NC },
  ];
  let k = 0; // marcha-paradas ya puestas
  let h = 0; // lámparas ya puestas
  for (const { mp, n, x0, paso } of bloques) {
    const plantilla = mp.doc.hojas[0]!;
    const ids = new Set(plantilla.componentes.map((c) => c.id));
    for (let i = 0; i < n; i++, k++) {
      const bobina = `K${k + 1}`;
      const etiquetas = new Map<string, string>([
        [mp.comp.s0, `S${2 * k}`],
        [mp.comp.s1, `S${2 * k + 1}`],
        [mp.comp.k1Auxiliar, bobina],
        [mp.comp.k1Bobina, bobina],
        [mp.comp.h1, `H${++h}`],
      ]);
      if (mp.comp.k1AuxiliarNC) etiquetas.set(mp.comp.k1AuxiliarNC, bobina);
      if (mp.comp.h2) etiquetas.set(mp.comp.h2, `H${++h}`);
      const { x, y } = posicion(i, x0, paso);
      const nuevo = copiar(doc, plantilla, ids, x, y, etiquetas);
      marchas.push({ marcha: nuevo.get(mp.comp.s1)!, parada: nuevo.get(mp.comp.s0)!, bobina });
    }
  }

  // Cadena: la columna 1 de `cadena()` (el pulsador) y después la 2 (un NA y la bobina siguiente).
  const cad = cadena();
  const plantilla = cad.doc.hojas[0]!;
  const columna = (x: number) => new Set(plantilla.componentes.filter((c) => c.x === x).map((c) => c.id));
  const x0 = bloques[1]!.x0 + MANDO.porFila * PASO_NC.dx + ENTRE_BLOQUES;
  const primera = k + 1; // K201
  const pulsadorCadena = `S${2 * k}`; // S400
  const bobinas: string[] = [];
  let pulsador = "";
  for (let i = 0; i < MANDO.cadena; i++) {
    const { x, y } = posicion(i, x0, PASO_CADENA);
    const bobina = `K${primera + i}`;
    bobinas.push(bobina);
    if (i === 0) {
      const nuevo = copiar(doc, plantilla, columna(0), x, y, new Map([[cad.comp.s1!, pulsadorCadena], [cad.comp.k1!, bobina]]));
      pulsador = nuevo.get(cad.comp.s1!)!;
    } else {
      // La columna 2 de la plantilla está en x = 10: se corre a x.
      copiar(doc, plantilla, columna(10), x - 10, y, new Map([[cad.comp.k1na!, `K${primera + i - 1}`], [cad.comp.k2!, bobina]]));
    }
  }
  return { doc, marchas, cadena: { pulsador, bobinas } };
}
