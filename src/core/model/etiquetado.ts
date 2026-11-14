// Etiquetado automático (T17): las reglas, puras y sin DOM. No tocan el
// documento: devuelven qué etiqueta va en cada id, y el editor arma con eso
// el comando (src/editor/armarEtiquetas.ts). Detalle en docs/plan-T17.md,
// sección 2.
//
// Palabras:
// - Fuente: fase o neutro (`esFuente`). Su etiqueta es el nombre de la red y
//   acá nunca se toca.
// - Seguidor: contacto que sigue a otro por la etiqueta, como el auxiliar a su
//   bobina (`esSeguidor`). No se numera ni cuenta como choque.
// - Titular: todo lo demás (bobina, pulsadores, lámpara). Es lo que se numera,
//   con el prefijo de su símbolo. Un símbolo desconocido (un tipo que no está
//   en la biblioteca) es un titular sin prefijo: su etiqueta queda reservada,
//   pero nunca se numera ni se rellena (D2).
// - Choca: una etiqueta normalizada y no vacía que ya tiene un titular de la hoja.
//
// Las etiquetas se comparan normalizadas (`normalizarEtiqueta`) y las que se
// dan ya salen normalizadas. Los mapas que devuelven estas funciones traen
// solo los ids cuya etiqueta cambia.

import { buscarSimbolo, esFuente, esSeguidor, type DefinicionSimbolo } from "../symbols";
import type { Componente, Hoja } from "./documento";
import { normalizarEtiqueta } from "./etiquetas";
import type { Recorte } from "./portapapeles";

/** Lo que se lee de una hoja: sus componentes. */
type ConComponentes = Pick<Hoja, "componentes">;

// ── Clases ─────────────────────────────────────────────────────────────────

/** Titular: lo que se numera. `undefined` es un símbolo desconocido, que también es titular (D2). */
export function esTitular(def: DefinicionSimbolo | undefined): boolean {
  return def === undefined || (!esFuente(def) && !esSeguidor(def));
}

/** El prefijo con que se numera; null para la fuente, el seguidor y el símbolo desconocido. */
export function prefijoDe(def: DefinicionSimbolo | undefined): string | null {
  return def !== undefined && esTitular(def) ? (def.prefijoEtiqueta ?? null) : null;
}

/** Bobina de contactor: la única que arrastra a sus contactos (D4). */
function esBobina(def: DefinicionSimbolo | undefined): boolean {
  return def?.elemento === "bobina";
}

/** Contacto que sigue a una bobina. */
function sigueABobina(def: DefinicionSimbolo | undefined): boolean {
  return def?.accionamiento === "bobina";
}

/** Las etiquetas normalizadas y no vacías de los titulares de la hoja. */
export function etiquetasDeTitulares(hoja: ConComponentes): Set<string> {
  const usadas = new Set<string>();
  for (const c of hoja.componentes) {
    if (!esTitular(buscarSimbolo(c.tipo))) continue;
    const e = normalizarEtiqueta(c.etiqueta);
    if (e !== "") usadas.add(e);
  }
  return usadas;
}

// ── Números ────────────────────────────────────────────────────────────────

/** Etiqueta numerada: letras y número ("K01" es K y 1). */
const NUMERADA = /^([A-Z]+)(\d+)$/;

/**
 * Da el menor número libre de cada prefijo, desde 1. Se arma con una pasada
 * por las etiquetas usadas y después cada número sale en tiempo constante
 * (amortizado): los ocupados solo se agregan, así que el próximo libre de un
 * prefijo nunca baja. Con 2000 que chocan no se recorre la lista 2000 veces.
 */
class Numerador {
  private readonly ocupados = new Map<string, Set<number>>();
  /** Todos los números de 1 a proximo − 1 del prefijo están ocupados. */
  private readonly proximo = new Map<string, number>();

  constructor(usadas: Iterable<string>) {
    for (const e of usadas) this.reservar(e);
  }

  /** Marca la etiqueta como usada. Una que no es letras y número no ocupa nada. */
  reservar(etiqueta: string): void {
    const m = NUMERADA.exec(normalizarEtiqueta(etiqueta));
    if (m) this.numerosDe(m[1]!).add(Number(m[2]));
  }

  /** El menor libre del prefijo, que queda ocupado. */
  siguiente(prefijo: string): string {
    const numeros = this.numerosDe(prefijo);
    let n = this.proximo.get(prefijo) ?? 1;
    while (numeros.has(n)) n++;
    numeros.add(n);
    this.proximo.set(prefijo, n + 1);
    return `${prefijo}${n}`;
  }

  private numerosDe(prefijo: string): Set<number> {
    let numeros = this.ocupados.get(prefijo);
    if (!numeros) this.ocupados.set(prefijo, (numeros = new Set()));
    return numeros;
  }
}

/**
 * `prefijo + n` con el menor n ≥ 1 que no esté en `usadas`. Se comparan los
 * números, no los textos: "K01" ocupa el 1. "S0" no ocupa nada (los números
 * empiezan en 1) y otras letras no cuentan ("KA1" no ocupa el 1 de K).
 */
export function menorLibre(usadas: Iterable<string>, prefijo: string): string {
  return new Numerador(usadas).siguiente(prefijo);
}

/** Los componentes en orden (y, x) y, a igualdad, en el de la lista (`sort` es estable). */
function enOrden(lista: readonly Componente[]): Componente[] {
  return [...lista].sort((a, b) => a.y - b.y || a.x - b.x);
}

// ── Pegar y duplicar ───────────────────────────────────────────────────────

/**
 * Las etiquetas nuevas de un lote que se pega (D-duplicar C), con `usadas`
 * = las etiquetas de los titulares de la hoja en el momento de pegar
 * (`etiquetasDeTitulares`). Devuelve id del lote → etiqueta nueva, solo para
 * lo que cambia:
 * 1. Los titulares del lote que no chocan conservan, y su etiqueta queda
 *    reservada: nadie del lote la recibe.
 * 2. Los que chocan, en orden (y, x) y, a igualdad, en el del lote, reciben
 *    el menor libre de su prefijo. Sin prefijo, conservan.
 * 3. Con varias bobinas de una misma etiqueta que chocan, la primera en
 *    (y, x) encabeza el grupo: los contactos del lote con esa etiqueta la
 *    siguen. Las demás reciben su número, sin contactos (D3).
 * 4. Los contactos sin su bobina en el lote, los vacíos y las fuentes conservan.
 */
export function etiquetarLote(usadas: Iterable<string>, lote: readonly Componente[]): Map<string, string> {
  const enHoja = new Set<string>();
  for (const e of usadas) enHoja.add(normalizarEtiqueta(e));
  const numerador = new Numerador(enHoja);

  const chocan: Componente[] = [];
  for (const c of enOrden(lote)) {
    const e = normalizarEtiqueta(c.etiqueta);
    if (e === "" || !esTitular(buscarSimbolo(c.tipo))) continue;
    if (enHoja.has(e)) chocan.push(c);
    else numerador.reservar(e);
  }

  const cambios = new Map<string, string>();
  /** Etiqueta vieja de una bobina que choca → la nueva de la que encabeza el grupo. */
  const encabezadas = new Map<string, string>();
  for (const c of chocan) {
    const def = buscarSimbolo(c.tipo);
    const prefijo = prefijoDe(def);
    if (prefijo === null) continue;
    const nueva = numerador.siguiente(prefijo);
    cambios.set(c.id, nueva);
    const vieja = normalizarEtiqueta(c.etiqueta);
    if (esBobina(def) && !encabezadas.has(vieja)) encabezadas.set(vieja, nueva);
  }

  if (encabezadas.size > 0) {
    for (const c of lote) {
      if (!sigueABobina(buscarSimbolo(c.tipo))) continue;
      const nueva = encabezadas.get(normalizarEtiqueta(c.etiqueta));
      if (nueva !== undefined && c.etiqueta !== nueva) cambios.set(c.id, nueva);
    }
  }
  return cambios;
}

/** El recorte con las etiquetas de `cambios` (id del recorte → etiqueta). No toca el original. */
export function conEtiquetas(recorte: Recorte, cambios: ReadonlyMap<string, string>): Recorte {
  if (cambios.size === 0) return recorte;
  return {
    ...recorte,
    componentes: recorte.componentes.map((c) => {
      const etiqueta = cambios.get(c.id);
      return etiqueta === undefined ? c : { ...c, params: { ...c.params }, etiqueta };
    }),
  };
}

// ── Etiquetar los vacíos ───────────────────────────────────────────────────

/**
 * Etiquetas para los titulares vacíos de la hoja, en orden (y, x): el menor
 * libre de su prefijo. Los seguidores, las fuentes y los titulares sin
 * prefijo quedan como están.
 */
export function etiquetarVacios(hoja: ConComponentes): Map<string, string> {
  const numerador = new Numerador(etiquetasDeTitulares(hoja));
  const cambios = new Map<string, string>();
  for (const c of enOrden(hoja.componentes.filter((k) => normalizarEtiqueta(k.etiqueta) === ""))) {
    const prefijo = prefijoDe(buscarSimbolo(c.tipo));
    if (prefijo !== null) cambios.set(c.id, numerador.siguiente(prefijo));
  }
  return cambios;
}

// ── Renombrar una bobina ───────────────────────────────────────────────────

/** Por qué los contactos no siguieron a la bobina renombrada. */
export type MotivoSinArrastre =
  /** Otra bobina tiene la etiqueta vieja: no se sabe a cuál seguían. */
  | "otra_bobina_vieja"
  /** Otra bobina ya tiene la etiqueta nueva. */
  | "otra_bobina_nueva";

export interface PlanRenombrar {
  /** Id → etiqueta nueva, normalizada: el componente y, si hay arrastre, sus contactos. Solo lo que cambia. */
  cambios: Map<string, string>;
  /** Algún contacto pasó a la etiqueta nueva junto con la bobina. */
  arrastre: boolean;
  /** Por qué no hubo arrastre, si había contactos con la etiqueta vieja; si no, null. */
  motivo: MotivoSinArrastre | null;
}

/**
 * Qué cambia al ponerle `nueva` al componente `id` (D-manuales b). Si es una
 * bobina, sus contactos con la etiqueta vieja pasan a la nueva solo si se
 * cumplen las tres: la etiqueta vieja no está vacía, no hay otra bobina con
 * la vieja y ninguna otra bobina tiene ya la nueva. Si no, cambia solo la
 * bobina. Tira si el componente no está en la hoja.
 */
export function planRenombrarBobina(hoja: ConComponentes, id: string, nueva: string): PlanRenombrar {
  const componente = hoja.componentes.find((c) => c.id === id);
  if (!componente) throw new Error(`No existe el componente "${id}".`);
  const etiqueta = normalizarEtiqueta(nueva);
  const cambios = new Map<string, string>();
  if (componente.etiqueta !== etiqueta) cambios.set(id, etiqueta);

  const vieja = normalizarEtiqueta(componente.etiqueta);
  if (!esBobina(buscarSimbolo(componente.tipo)) || vieja === "") return { cambios, arrastre: false, motivo: null };

  const contactos: Componente[] = [];
  let otraVieja = false;
  let otraNueva = false;
  for (const c of hoja.componentes) {
    const def = buscarSimbolo(c.tipo);
    const e = normalizarEtiqueta(c.etiqueta);
    if (sigueABobina(def)) {
      if (e === vieja) contactos.push(c);
    } else if (c !== componente && esBobina(def)) {
      if (e === vieja) otraVieja = true;
      if (e === etiqueta) otraNueva = true;
    }
  }
  if (contactos.length === 0) return { cambios, arrastre: false, motivo: null };
  if (otraVieja) return { cambios, arrastre: false, motivo: "otra_bobina_vieja" };
  if (otraNueva) return { cambios, arrastre: false, motivo: "otra_bobina_nueva" };

  let arrastre = false;
  for (const c of contactos) {
    if (c.etiqueta === etiqueta) continue;
    cambios.set(c.id, etiqueta);
    arrastre = true;
  }
  return { cambios, arrastre, motivo: null };
}
