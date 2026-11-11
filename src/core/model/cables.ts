// Cables: geometría, validación e índice inverso. Sin dependencias del navegador.
//
// Geometría y conexión van separadas:
// - El recorrido de un cable es [desde, ...codos, hasta]. Un extremo en un
//   borne no guarda coordenada: su punto sale del componente, con
//   `borneColocado` (la misma cuenta que rotar y espejar).
// - Conecta solo lo que dicen los extremos: un borne, o un punto de otro
//   cable (T). Dos tramos que se cruzan o se enciman no conectan, ni un tramo
//   que pasa sobre un borne, ni un extremo libre, aunque caiga sobre algo.
//
// `validarCable` y `validarHoja` no tiran: devuelven la lista de problemas.
// `Cablear` tira si hay alguno; `deserializar` (T15a) los informa.

import { borneColocado, buscarSimbolo, type Borne } from "../symbols";
import type { Cable, Componente, Extremo, Hoja } from "./documento";

/** Un problema de validación: a qué id se refiere y qué falla. */
export interface Problema {
  id: string;
  mensaje: string;
}

/** Componentes y cables de una hoja por id, para resolver extremos sin buscar. */
export interface IndiceHoja {
  componentes: ReadonlyMap<string, Componente>;
  cables: ReadonlyMap<string, Cable>;
}

/** Arma el índice de una hoja, en una pasada. Con ids repetidos, queda el primero. */
export function indexarHoja(hoja: Hoja): IndiceHoja {
  const componentes = new Map<string, Componente>();
  const cables = new Map<string, Cable>();
  for (const c of hoja.componentes) if (!componentes.has(c.id)) componentes.set(c.id, c);
  for (const w of hoja.cables) if (!cables.has(w.id)) cables.set(w.id, w);
  return { componentes, cables };
}

/** Copia de un cable que no comparte nada con el original. */
export function copiarCable(w: Cable): Cable {
  return { id: w.id, desde: { ...w.desde }, hasta: { ...w.hasta }, codos: w.codos.map(([x, y]) => [x, y]) };
}

/** El borne colocado de un componente, o undefined si el símbolo no se conoce o no tiene ese borne. */
export function borneDe(comp: Componente, nombre: string): Borne | undefined {
  const def = buscarSimbolo(comp.tipo);
  if (!def) return undefined;
  return borneColocado(def.bornes, nombre, comp.x, comp.y, { rotacion: comp.rot, espejado: comp.espejado });
}

/** Punto de un extremo en la hoja, o null si apunta a algo que no existe. */
export function puntoExtremo(indice: IndiceHoja, e: Extremo): { x: number; y: number } | null {
  if (e.tipo !== "borne") return { x: e.x, y: e.y };
  const comp = indice.componentes.get(e.comp);
  const b = comp && borneDe(comp, e.borne);
  return b ? { x: b.x, y: b.y } : null;
}

/**
 * Recorrido del cable: x, y de cada punto seguidos (desde, codos, hasta).
 * Null si algún extremo no se puede resolver.
 */
export function recorridoCable(indice: IndiceHoja, w: Cable): number[] | null {
  const a = puntoExtremo(indice, w.desde);
  const b = puntoExtremo(indice, w.hasta);
  if (!a || !b) return null;
  const puntos = [a.x, a.y];
  for (const [x, y] of w.codos) puntos.push(x, y);
  puntos.push(b.x, b.y);
  return puntos;
}

/** True si (x, y) está sobre algún tramo del recorrido (x, y seguidos), extremos incluidos. */
export function puntoSobreRecorrido(puntos: readonly number[], x: number, y: number): boolean {
  for (let i = 0; i + 3 < puntos.length; i += 2) {
    const x0 = puntos[i]!;
    const y0 = puntos[i + 1]!;
    const x1 = puntos[i + 2]!;
    const y1 = puntos[i + 3]!;
    if (x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= Math.min(y0, y1) && y <= Math.max(y0, y1)) {
      // Tramos ortogonales: estar en la caja es estar en el tramo.
      if (x0 === x1 || y0 === y1) return true;
    }
  }
  return false;
}

/** Problemas de un extremo, sin mirar la forma del recorrido. */
function problemasExtremo(indice: IndiceHoja, w: Cable, e: Extremo, lado: "desde" | "hasta"): string[] {
  switch (e.tipo) {
    case "borne": {
      const comp = indice.componentes.get(e.comp);
      if (!comp) return [`${lado}: no existe el componente "${e.comp}".`];
      if (!buscarSimbolo(comp.tipo)) return [`${lado}: el símbolo "${comp.tipo}" de "${e.comp}" no está en la biblioteca.`];
      if (!borneDe(comp, e.borne)) return [`${lado}: "${e.comp}" no tiene el borne "${e.borne}".`];
      return [];
    }
    case "cable": {
      if (!Number.isInteger(e.x) || !Number.isInteger(e.y)) return [`${lado}: el punto (${e.x}, ${e.y}) no es entero.`];
      if (e.cable === w.id) return [`${lado}: el cable no puede terminar sobre sí mismo.`];
      const otro = indice.cables.get(e.cable);
      if (!otro) return [`${lado}: no existe el cable "${e.cable}".`];
      const rec = recorridoCable(indice, otro);
      if (!rec || !puntoSobreRecorrido(rec, e.x, e.y)) return [`${lado}: el punto (${e.x}, ${e.y}) no está sobre "${e.cable}".`];
      return [];
    }
    case "libre":
      return Number.isInteger(e.x) && Number.isInteger(e.y) ? [] : [`${lado}: el punto (${e.x}, ${e.y}) no es entero.`];
    default:
      return [`${lado}: tipo de extremo desconocido.`];
  }
}

/**
 * Problemas de un cable en la hoja de `indice` (vacío si es válido):
 * referencias que existen, puntos enteros, tramos horizontales o verticales,
 * sin largo cero ni vuelta de 180°, y los dos extremos no en el mismo borne.
 */
export function validarCable(indice: IndiceHoja, w: Cable): Problema[] {
  const mensajes = [...problemasExtremo(indice, w, w.desde, "desde"), ...problemasExtremo(indice, w, w.hasta, "hasta")];
  const { desde, hasta } = w;
  if (desde.tipo === "borne" && hasta.tipo === "borne" && desde.comp === hasta.comp && desde.borne === hasta.borne) {
    mensajes.push(`Los dos extremos están en el mismo borne ("${desde.comp}" ${desde.borne}).`);
  }
  for (const [x, y] of w.codos) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) mensajes.push(`El codo (${x}, ${y}) no es entero.`);
  }
  const rec = mensajes.length === 0 ? recorridoCable(indice, w) : null;
  if (rec) mensajes.push(...problemasForma(rec));
  return mensajes.map((mensaje) => ({ id: w.id, mensaje }));
}

/** Problemas de la forma de un recorrido (x, y seguidos). */
function problemasForma(p: readonly number[]): string[] {
  const mensajes: string[] = [];
  let anterior: "h" | "v" | null = null;
  let signoAnterior = 0;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const dx = p[i + 2]! - p[i]!;
    const dy = p[i + 3]! - p[i + 1]!;
    const tramo = i / 2 + 1;
    if (dx === 0 && dy === 0) {
      mensajes.push(`El tramo ${tramo} tiene largo cero.`);
      continue;
    }
    if (dx !== 0 && dy !== 0) {
      mensajes.push(`El tramo ${tramo} no es horizontal ni vertical.`);
      anterior = null;
      continue;
    }
    const eje = dx !== 0 ? "h" : "v";
    const signo = Math.sign(dx + dy);
    if (eje === anterior && signo !== signoAnterior) mensajes.push(`El tramo ${tramo} vuelve sobre el anterior.`);
    anterior = eje;
    signoAnterior = signo;
  }
  return mensajes;
}

/**
 * Problemas de toda la hoja: ids repetidos (entre componentes y cables) y
 * cada cable. Vacío si la hoja es válida.
 */
export function validarHoja(hoja: Hoja): Problema[] {
  const problemas: Problema[] = [];
  const vistos = new Set<string>();
  for (const { id } of [...hoja.componentes, ...hoja.cables]) {
    if (vistos.has(id)) problemas.push({ id, mensaje: `El id "${id}" está repetido.` });
    vistos.add(id);
  }
  const indice = indexarHoja(hoja);
  for (const w of hoja.cables) problemas.push(...validarCable(indice, w));
  return problemas;
}

/**
 * True si el cable `id` se apoya en `base`, directa o indirectamente (T14c,
 * D7-C): subiendo por los anfitriones de sus T se llega a `base`. Cada cable
 * tiene 2 anfitriones como mucho; sube sin recursión y con un conjunto de
 * visitados, así termina aunque la hoja ya tenga un ciclo. No recorre la hoja.
 * Un anfitrión que no existe corta ese camino. Con `id` igual a `base`, es
 * true solo si `id` está en un ciclo de apoyos.
 */
export function seApoyaEn(indice: IndiceHoja, id: string, base: string): boolean {
  const vistos = new Set<string>([id]);
  const pila = [id];
  while (pila.length > 0) {
    const w = indice.cables.get(pila.pop()!);
    if (!w) continue;
    for (const e of [w.desde, w.hasta]) {
      if (e.tipo !== "cable") continue;
      if (e.cable === base) return true;
      if (vistos.has(e.cable)) continue;
      vistos.add(e.cable);
      pila.push(e.cable);
    }
  }
  return false;
}

/** True si algún cable de la hoja tiene un extremo en un borne de alguno de `comps`. Una pasada por los cables. */
export function hayCablesEn(hoja: Hoja, comps: ReadonlySet<string>): boolean {
  for (const w of hoja.cables) {
    if (w.desde.tipo === "borne" && comps.has(w.desde.comp)) return true;
    if (w.hasta.tipo === "borne" && comps.has(w.hasta.comp)) return true;
  }
  return false;
}

/** Ids de los componentes de la hoja que tienen algún cable en un borne. Una pasada por los cables. */
export function componentesCableados(hoja: Hoja): Set<string> {
  const ids = new Set<string>();
  for (const w of hoja.cables) {
    if (w.desde.tipo === "borne") ids.add(w.desde.comp);
    if (w.hasta.tipo === "borne") ids.add(w.hasta.comp);
  }
  return ids;
}

/**
 * Base de las redes (T15): a qué nodo conecta un extremo. Un borne es
 * "borne:<comp>:<nombre>" y una T, "cable:<id>" (se une con ese cable). Un
 * extremo libre no conecta: null, aunque caiga sobre un borne o un cable.
 * La geometría no cuenta: dos tramos que se cruzan no comparten nodo.
 */
export function nodoExtremo(e: Extremo): string | null {
  if (e.tipo === "borne") return `borne:${e.comp}:${e.borne}`;
  if (e.tipo === "cable") return `cable:${e.cable}`;
  return null;
}
