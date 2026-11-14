// Comparar redes (T15, D8-B): si un documento tiene el mismo circuito que
// otro, sin mirar ids, orden ni geometría. Sirve para la marcha-parada
// dibujada a mano en la netbook (`npm run circuito`, docs/plan-T15.md
// sección 5) y, en la fase 4, para otros circuitos de referencia. Es apoyo de
// los tests: el código de la app no lo usa.
//
// - Cada borne se nombra "etiqueta·borne", con la etiqueta normalizada
//   ("S0·11", "K1·A1"). Las dos K1 (auxiliar y bobina) comparten etiqueta y
//   se distinguen por el borne.
// - Primero los componentes, por etiqueta y tipo: falta, sobra o repetido.
//   Fase y Neutro no cuentan como repetidos: varias "N" son la misma red
//   (etiquetas.ts). Se comparan por nombre de red y tipo, y su borne sale
//   como "N·N" aunque haya varias.
// - Contactos repetidos (T17b, D2a): varios seguidores (`esSeguidor`) con la
//   misma etiqueta y tipo, como dos auxiliares NA de K1. No son error: se
//   comparan por cantidad y después se identifican por firma
//   (`identificarRepetidos`). Las bobinas repetidas siguen siendo error.
// - Contactos vacíos (T17b, D2b): un seguidor sin etiqueta no sigue a
//   ninguna bobina. En el dibujo es una diferencia por contacto; en la base,
//   tira: la base tiene que estar completa.
// - Después la partición de los bornes, con las redes de los dos documentos
//   unidas por nombre (`unirPorNombre`): una red de la base que quedó en
//   varias ("se partió") o varias de la base que quedaron en una ("se
//   unieron"). Los cables y las redes sin bornes no se comparan.
// - Si los componentes no coinciden, las redes no se comparan: cada etiqueta
//   tiene que estar una vez (o, si es un contacto repetido, las mismas veces)
//   para que "etiqueta·borne" diga de qué borne se habla.

import type { Componente, Documento } from "../model/documento";
import { normalizarEtiqueta } from "../model/etiquetas";
import { nombreDeFuente, redes, type BorneRed } from "../model/redes";
import { buscarSimbolo, esSeguidor } from "../symbols";

export const SIN_COMPARAR_REDES = "Las redes no se comparan hasta que coincidan los componentes.";

/** Cuántos nombres muestra cada red en los mensajes de los contactos repetidos; si hay más, "…". */
const NOMBRES_POR_RED = 3;

/** Un componente por etiqueta y tipo; `fuente`, el nombre de red si es Fase o Neutro (si no, null). */
interface Grupo {
  etiqueta: string;
  tipo: string;
  fuente: string | null;
  /** Contacto que sigue a una bobina por la etiqueta (`esSeguidor`). */
  seguidor: boolean;
  ids: string[];
}

function claveGrupo(etiqueta: string, tipo: string): string {
  return JSON.stringify([etiqueta, tipo]);
}

function esContactoSeguidor(tipo: string): boolean {
  const def = buscarSimbolo(tipo);
  return def !== undefined && esSeguidor(def);
}

/** Los nombres de los bornes del componente, en el orden de su definición. */
function bornesDe(c: Componente): string[] {
  return buscarSimbolo(c.tipo)?.bornes.map((b) => b.nombre) ?? [];
}

/** Los componentes de la hoja agrupados por etiqueta normalizada y tipo, en el orden de la hoja. */
function agrupar(componentes: readonly Componente[]): Map<string, Grupo> {
  const grupos = new Map<string, Grupo>();
  for (const c of componentes) {
    const etiqueta = normalizarEtiqueta(c.etiqueta);
    const clave = claveGrupo(etiqueta, c.tipo);
    let g = grupos.get(clave);
    if (!g) {
      g = { etiqueta, tipo: c.tipo, fuente: nombreDeFuente(c), seguidor: esContactoSeguidor(c.tipo), ids: [] };
      grupos.set(clave, g);
    }
    g.ids.push(c.id);
  }
  return grupos;
}

/** "H1" entre comillas, o "un componente sin etiqueta". */
function nombrar(etiqueta: string): string {
  return etiqueta === "" ? "un componente sin etiqueta" : `"${etiqueta}"`;
}

/** "a", "a y b", "a, b y c". */
function enumerar(partes: readonly string[]): string {
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

function llaves(red: readonly string[]): string {
  return `{${red.join(", ")}}`;
}

/** Diferencias de componentes: lo que falta, lo que sobra, lo repetido y los contactos vacíos. */
function compararComponentes(dibujado: Map<string, Grupo>, base: Map<string, Grupo>): string[] {
  const diferencias: string[] = [];
  const nombresBase = new Set([...base.values()].map((g) => g.fuente).filter((n) => n !== null));
  for (const [clave, g] of base) {
    if (!dibujado.has(clave)) diferencias.push(`Falta ${nombrar(g.etiqueta)} (${g.tipo}).`);
  }
  for (const [clave, g] of dibujado) {
    const ids = g.ids.join(", ");
    const enBase = base.get(clave);
    if (g.seguidor && g.etiqueta === "") {
      for (const id of g.ids) diferencias.push(`Contacto sin etiqueta (${g.tipo}, ${id}): no sigue a ninguna bobina.`);
    } else if (!enBase) {
      if (g.fuente === "") diferencias.push(`Sobra una fuente sin nombre de red (${g.tipo}, ${ids}).`);
      else if (g.fuente !== null && !nombresBase.has(g.fuente)) {
        diferencias.push(`Sobra "${g.fuente}" (${g.tipo}, ${ids}): fuente con un nombre de red nuevo.`);
      } else diferencias.push(`Sobra ${nombrar(g.etiqueta)} (${g.tipo}, ${ids}).`);
    } else if (g.seguidor) {
      if (g.ids.length !== enBase.ids.length) {
        diferencias.push(`Hay ${g.ids.length} "${g.etiqueta}" (${g.tipo}); la base tiene ${enBase.ids.length}.`);
      }
    } else if (g.fuente === null && g.ids.length > 1) {
      diferencias.push(`Hay ${g.ids.length} ${g.etiqueta === "" ? "sin etiqueta" : `"${g.etiqueta}"`} (${g.tipo}): ${ids}.`);
    }
  }
  return diferencias;
}

/** Un documento por sus redes, para nombrar sus bornes. */
interface Lado {
  /** Las redes con bornes (unidas por nombre), cada una con sus bornes en el orden de la hoja. */
  redes: BorneRed[][];
  /** En qué red cae cada borne: id → borne → índice en `redes`. */
  redDe: Map<string, Map<string, number>>;
  /** La etiqueta normalizada de cada componente, por id. */
  etiqueta: Map<string, string>;
  /** Lo que sigue a "etiqueta·borne": "" o, en un contacto repetido ya identificado, "#n". Sin entrada: todavía sin nombre. */
  sufijo: Map<string, string>;
  /** Contactos repetidos sin identificar, en el orden de la hoja. */
  pendientes: Componente[];
}

/** El documento como `Lado`; `repetidos`, las claves de los grupos de contactos repetidos. */
function armarLado(doc: Documento, repetidos: ReadonlySet<string>): Lado {
  const hoja = doc.hojas[0]!;
  const etiqueta = new Map<string, string>();
  const sufijo = new Map<string, string>();
  const pendientes: Componente[] = [];
  for (const c of hoja.componentes) {
    const e = normalizarEtiqueta(c.etiqueta);
    etiqueta.set(c.id, e);
    if (repetidos.has(claveGrupo(e, c.tipo))) pendientes.push(c);
    else sufijo.set(c.id, "");
  }
  const lista = redes(hoja, { unirPorNombre: true })
    .filter((r) => r.bornes.length > 0)
    .map((r) => r.bornes);
  const redDe = new Map<string, Map<string, number>>();
  lista.forEach((bornes, i) => {
    for (const b of bornes) {
      let delComp = redDe.get(b.comp);
      if (!delComp) redDe.set(b.comp, (delComp = new Map()));
      delComp.set(b.borne, i);
    }
  });
  return { redes: lista, redDe, etiqueta, sufijo, pendientes };
}

/** Los nombres conocidos de la red, sin repetir, en el orden de la hoja. */
function nombresDeRed(lado: Lado, i: number): string[] {
  const nombres = new Set<string>();
  for (const b of lado.redes[i]!) {
    const sufijo = lado.sufijo.get(b.comp);
    if (sufijo !== undefined) nombres.add(`${lado.etiqueta.get(b.comp)}·${b.borne}${sufijo}`);
  }
  return [...nombres];
}

/** El índice de la red donde cae un borne de un componente con bornes conocidos. */
function redDelBorne(lado: Lado, comp: string, borne: string): number {
  const i = lado.redDe.get(comp)?.get(borne);
  if (i === undefined) throw new Error(`compararRedes: el borne ${comp}·${borne} no está en ninguna red.`);
  return i;
}

/** Los contactos pendientes que comparten firma. */
interface Firma {
  /** Alguna de sus redes no tiene nombres conocidos. */
  conAnclaVacia: boolean;
  /** En el orden de la hoja. */
  comps: Componente[];
}

/**
 * La firma de cada contacto pendiente: su tipo, su etiqueta y el ancla de la
 * red de cada borne, en el orden de la definición. El ancla es la lista
 * ordenada de los nombres conocidos de la red. Devuelve los contactos
 * agrupados por firma y la firma de cada uno, por id.
 */
function firmas(lado: Lado): { porFirma: Map<string, Firma>; firmaDe: Map<string, string> } {
  // Orden por unidades de código (el de `sort` sin comparador): el mismo en cualquier idioma del sistema.
  const anclas = lado.redes.map((_, i) => nombresDeRed(lado, i).sort());
  const porFirma = new Map<string, Firma>();
  const firmaDe = new Map<string, string>();
  for (const c of lado.pendientes) {
    const deRedes = bornesDe(c).map((b) => anclas[redDelBorne(lado, c.id, b)]!);
    const clave = JSON.stringify([c.tipo, lado.etiqueta.get(c.id), deRedes]);
    let f = porFirma.get(clave);
    if (!f) porFirma.set(clave, (f = { conAnclaVacia: deRedes.some((a) => a.length === 0), comps: [] }));
    f.comps.push(c);
    firmaDe.set(c.id, clave);
  }
  return { porFirma, firmaDe };
}

/** La red para un mensaje: hasta `NOMBRES_POR_RED` nombres conocidos y "…" si hay más. */
function mostrarRed(lado: Lado, i: number): string {
  const nombres = nombresDeRed(lado, i);
  if (nombres.length === 0) return "{sin bornes conocidos}";
  return llaves(nombres.length > NOMBRES_POR_RED ? [...nombres.slice(0, NOMBRES_POR_RED), "…"] : nombres);
}

/** `"K1" (tipo, id) con 13 en {…} y 14 en {…}`. */
function contactoEnSusRedes(lado: Lado, c: Componente): string {
  const donde = bornesDe(c).map((b) => `${b} en ${mostrarRed(lado, redDelBorne(lado, c.id, b))}`);
  return `"${lado.etiqueta.get(c.id)}" (${c.tipo}, ${c.id}) con ${enumerar(donde)}`;
}

/**
 * Empareja los contactos repetidos del dibujo con los de la base (D2a) y les
 * da el mismo nombre en los dos ("K1·13#1"). Las anclas de las firmas se
 * arman con nombres que se conocen a la vez en los dos documentos y solo
 * ganan nombres de una vuelta a otra: dos firmas distintas no se vuelven
 * iguales después.
 *
 * En cada vuelta se calculan todas las firmas y recién después se empareja.
 * Se emparejan las firmas con un contacto en cada lado y, si ninguna de sus
 * anclas está vacía, las que tienen varios: están en paralelo entre las
 * mismas redes y son intercambiables (van en el orden de la hoja). Una firma
 * con un ancla vacía y varios contactos espera a otra vuelta. Se corta en la
 * primera vuelta que no empareja a nadie; el tope, tantas vueltas como
 * contactos repetidos, no llega antes (cada vuelta útil empareja al menos un
 * par) y está para que nunca cicle.
 *
 * Emparejar mal solo puede dar diferencias de más: las 0 diferencias salen de
 * comparar la partición completa. Devuelve un mensaje por cada contacto del
 * dibujo que quedó sin emparejar.
 */
function identificarRepetidos(dibujado: Lado, base: Lado): string[] {
  const numero = new Map<string, number>();
  const tope = base.pendientes.length;
  for (let vuelta = 0; vuelta < tope && base.pendientes.length > 0; vuelta++) {
    const enDibujado = firmas(dibujado).porFirma;
    let parejas = 0;
    for (const [clave, fb] of firmas(base).porFirma) {
      const fd = enDibujado.get(clave);
      if (!fd) continue;
      const n = fb.comps.length === 1 && fd.comps.length === 1 ? 1 : fb.conAnclaVacia ? 0 : Math.min(fb.comps.length, fd.comps.length);
      for (let j = 0; j < n; j++) {
        const cb = fb.comps[j]!;
        const grupo = claveGrupo(base.etiqueta.get(cb.id)!, cb.tipo);
        const orden = (numero.get(grupo) ?? 0) + 1;
        numero.set(grupo, orden);
        base.sufijo.set(cb.id, `#${orden}`);
        dibujado.sufijo.set(fd.comps[j]!.id, `#${orden}`);
      }
      parejas += n;
    }
    if (parejas === 0) break;
    base.pendientes = base.pendientes.filter((c) => !base.sufijo.has(c.id));
    dibujado.pendientes = dibujado.pendientes.filter((c) => !dibujado.sufijo.has(c.id));
  }

  // Una firma del dibujo que la base no tiene no la va a tener nunca. La que
  // sí tiene quedó trabada por un ancla vacía.
  const enBase = firmas(base).porFirma;
  const { firmaDe } = firmas(dibujado);
  return dibujado.pendientes.map((c) =>
    enBase.has(firmaDe.get(c.id)!)
      ? `No se pudo identificar ${contactoEnSusRedes(dibujado, c)}: alguna de sus redes solo tiene contactos repetidos.`
      : `${contactoEnSusRedes(dibujado, c)}: la base no lo tiene entre esas redes.`,
  );
}

/** Las redes con algún nombre conocido, cada una como su lista de nombres sin repetir. */
function particion(lado: Lado): string[][] {
  return lado.redes.map((_, i) => nombresDeRed(lado, i)).filter((red) => red.length > 0);
}

/** En qué red (índice) está cada nombre. */
function indicePorBorne(redesDoc: readonly string[][]): Map<string, number> {
  const indice = new Map<string, number>();
  redesDoc.forEach((red, i) => {
    for (const b of red) indice.set(b, i);
  });
  return indice;
}

/**
 * Las diferencias entre el circuito de `dibujado` y el de `base`, en texto
 * para leer; vacío si son el mismo circuito. La base tiene que tener una sola
 * hoja, ningún componente repetido (sin contar Fase y Neutro ni los contactos
 * repetidos) y ningún contacto sin etiqueta: si no, tira.
 */
export function compararRedes(dibujado: Documento, base: Documento): string[] {
  if (base.hojas.length !== 1) throw new Error(`compararRedes: la base tiene ${base.hojas.length} hojas.`);
  const gruposBase = agrupar(base.hojas[0]!.componentes);
  for (const g of gruposBase.values()) {
    if (g.seguidor && g.etiqueta === "") {
      throw new Error(`compararRedes: la base tiene un contacto sin etiqueta (${g.tipo}, ${g.ids[0]}).`);
    }
    if (!g.seguidor && g.fuente === null && g.ids.length > 1) {
      throw new Error(`compararRedes: la base tiene ${g.ids.length} ${nombrar(g.etiqueta)} (${g.tipo}).`);
    }
  }
  if (dibujado.hojas.length !== 1) return [`Tiene ${dibujado.hojas.length} hojas: se espera una sola.`];

  const deComponentes = compararComponentes(agrupar(dibujado.hojas[0]!.componentes), gruposBase);
  if (deComponentes.length > 0) return [...deComponentes, SIN_COMPARAR_REDES];

  const repetidos = new Set<string>();
  for (const [clave, g] of gruposBase) if (g.seguidor && g.ids.length > 1) repetidos.add(clave);
  const ladoDibujado = armarLado(dibujado, repetidos);
  const ladoBase = armarLado(base, repetidos);
  const diferencias = identificarRepetidos(ladoDibujado, ladoBase);

  const redesDibujado = particion(ladoDibujado);
  const redesBase = particion(ladoBase);
  const enDibujado = indicePorBorne(redesDibujado);
  const enBase = indicePorBorne(redesBase);

  for (const red of redesBase) {
    const partes = new Map<number, string[]>();
    for (const b of red) {
      const i = enDibujado.get(b);
      if (i === undefined) continue;
      let parte = partes.get(i);
      if (!parte) partes.set(i, (parte = []));
      parte.push(b);
    }
    if (partes.size > 1) diferencias.push(`Se partió la red ${llaves(red)}: quedó en ${enumerar([...partes.values()].map(llaves))}.`);
  }
  for (const red of redesDibujado) {
    const deBase = [...new Set(red.map((b) => enBase.get(b)).filter((i) => i !== undefined))];
    if (deBase.length > 1) diferencias.push(`Se unieron las redes ${enumerar(deBase.map((i) => llaves(redesBase[i]!)))}.`);
  }
  return diferencias;
}
