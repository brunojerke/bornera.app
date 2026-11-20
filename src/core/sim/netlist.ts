// Netlist (T28, fase 5): lo que el motor de simulación necesita de una hoja,
// armado una vez al entrar a Simular. No simula, no avisa y no cambia el
// documento. Detalle en docs/plan-T28.md y docs/plan-fase5.md (sección 2).
//
// - Redes: las de `redes(hoja)` por cables, unidas después por etiquetas de
//   red. No se usa `unirPorNombre` de `redes`: une solo por nombre y juntaría
//   una Fase «N» con un Neutro «N», que son potenciales distintos (D7).
// - Potencial (D7): papel del símbolo (fase o neutro) más su etiqueta
//   normalizada. Fase «L1» y Fase «L2» son dos; Fase «N» y Neutro «N»,
//   también. Las redes con el mismo potencial se unen (etiqueta de red).
//   Una fuente sin etiqueta (solo desde un archivo: R9) no da potencial.
// - Corto por cables (D10-A): una red con dos potenciales o más. Acá solo se
//   anota (`enCorto`); el motor lo ve en reposo, se detiene y avisa (T30).
// - Contactos (NA o NC, con su accionamiento) y cargas (bobina, lámpara), cada
//   uno con la red de sus dos bornes. Un símbolo desconocido no conduce ni es
//   carga; tampoco lo que la fase 5 no simula (la protección).
// - Bobinas por etiqueta, en orden natural (K1, K2, K10): el orden de D2. Una
//   etiqueta repetida en dos bobinas no se resuelve acá (R4 impide entrar).
//
// Solo la hoja que se recibe (la app muestra la primera). Sin DOM.

import { buscarSimbolo, type Accionamiento } from "../symbols";
import type { Hoja } from "../model/documento";
import { normalizarEtiqueta } from "../model/etiquetas";
import { redes, type BorneRed } from "../model/redes";

/** Qué es una fuente: fase o neutro. */
export type Papel = "fase" | "neutro";

/** Papel de cada símbolo de fuente, por su `tipo` (N1-A). */
const PAPEL: Readonly<Record<string, Papel>> = {
  "fuente.fase": "fase",
  "fuente.neutro": "neutro",
};

/** Un potencial: papel y nombre de red (etiqueta normalizada, no vacía). */
export interface Potencial {
  papel: Papel;
  nombre: string;
}

/** Una red de la netlist: redes por cables unidas por etiquetas de red. */
export interface RedNetlist {
  /** Bornes de sus redes por cables, en el orden de esas redes en `redes()`. */
  bornes: BorneRed[];
  /** Ids de sus cables, en el mismo orden. */
  cables: string[];
  /** Índices en `Netlist.potenciales`, de menor a mayor. Dos o más: corto por cables. */
  potenciales: number[];
}

/** Un contacto: une sus dos redes cuando conduce. */
export interface ContactoNetlist {
  comp: string;
  /** Etiqueta normalizada ("" sin etiqueta). Para el auxiliar, la de su bobina. */
  etiqueta: string;
  /** NA (true) o NC (false). */
  na: boolean;
  accionamiento: Accionamiento;
  /** Redes de su primer y su segundo borne, como en su definición. */
  a: number;
  b: number;
}

/** Una carga: se enciende con potenciales distintos en sus dos bornes. No une redes. */
export interface CargaNetlist {
  comp: string;
  /** Etiqueta normalizada ("" sin etiqueta). */
  etiqueta: string;
  /** La bobina mueve contactos; la carga (lámpara) solo se enciende. */
  tipo: "bobina" | "carga";
  a: number;
  b: number;
}

export interface Netlist {
  /** En el orden de su primera red por cables en `redes(hoja)`. */
  redes: RedNetlist[];
  /** Ordenados por papel (fase antes que neutro) y por nombre, en orden natural. */
  potenciales: Potencial[];
  /** Red de cada borne de un símbolo conocido: comp → borne → índice en `redes`. */
  redDeBorne: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** Índices de las redes con dos potenciales o más, de menor a mayor (D10-A). */
  enCorto: number[];
  /** En el orden de la hoja. */
  contactos: ContactoNetlist[];
  /** En el orden de la hoja. */
  cargas: CargaNetlist[];
  /** Bobinas con etiqueta, agrupadas por ella, en orden natural; `cargas` son índices en `Netlist.cargas`. */
  bobinas: { etiqueta: string; cargas: number[] }[];
}

/** Orden por unidades de código: el mismo en cualquier idioma del sistema. */
function compararTexto(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Tramos de dígitos y de no dígitos: "K10A" → ["K", "10", "A"]. */
function tramos(t: string): string[] {
  return t.match(/\d+|\D+/g) ?? [];
}

/**
 * Orden natural de etiquetas: los números van por su valor (K1 < K2 < K10) y
 * el resto por unidades de código, así que K1 < KA. Si empatan («K01» y «K1»),
 * decide el texto entero. El mismo resultado en cualquier idioma del sistema.
 */
export function compararEtiquetas(a: string, b: string): number {
  const ta = tramos(a);
  const tb = tramos(b);
  const n = Math.min(ta.length, tb.length);
  for (let i = 0; i < n; i++) {
    const x = ta[i]!;
    const y = tb[i]!;
    if (x === y) continue;
    const dx = x.charCodeAt(0) <= 57 && x.charCodeAt(0) >= 48;
    const dy = y.charCodeAt(0) <= 57 && y.charCodeAt(0) >= 48;
    if (dx && dy) {
      // Por valor, sin pasar a número (no se desborda): sin ceros adelante, el más largo es mayor.
      const sx = x.replace(/^0+/, "");
      const sy = y.replace(/^0+/, "");
      if (sx.length !== sy.length) return sx.length - sy.length;
      if (sx !== sy) return compararTexto(sx, sy);
      continue;
    }
    return compararTexto(x, y);
  }
  if (ta.length !== tb.length) return ta.length - tb.length;
  return compararTexto(a, b);
}

/** La netlist de una hoja. No cambia la hoja. */
export function armarNetlist(hoja: Hoja): Netlist {
  const porCables = redes(hoja);

  // Red por cables de cada borne.
  const redCables = new Map<string, Map<string, number>>();
  porCables.forEach((r, i) => {
    for (const b of r.bornes) {
      let delComp = redCables.get(b.comp);
      if (!delComp) redCables.set(b.comp, (delComp = new Map()));
      delComp.set(b.borne, i);
    }
  });

  // Fuentes con potencial: el potencial (clave "papel|nombre") y su red por cables.
  const fuentes: { clave: string; potencial: Potencial; red: number }[] = [];
  for (const c of hoja.componentes) {
    const papel = PAPEL[c.tipo];
    const def = papel ? buscarSimbolo(c.tipo) : undefined;
    if (!papel || !def || def.bornes.length !== 1) continue;
    const nombre = normalizarEtiqueta(c.etiqueta);
    const red = redCables.get(c.id)?.get(def.bornes[0]!.nombre);
    if (nombre === "" || red === undefined) continue;
    fuentes.push({ clave: `${papel}|${nombre}`, potencial: { papel, nombre }, red });
  }

  // Potenciales, ordenados: papel y después nombre.
  const unicos = new Map<string, Potencial>();
  for (const f of fuentes) if (!unicos.has(f.clave)) unicos.set(f.clave, f.potencial);
  const claves = [...unicos.keys()].sort((x, y) => {
    const p = unicos.get(x)!;
    const q = unicos.get(y)!;
    return compararTexto(p.papel, q.papel) || compararEtiquetas(p.nombre, q.nombre);
  });
  const potenciales = claves.map((k) => unicos.get(k)!);
  const indicePotencial = new Map(claves.map((k, i) => [k, i]));

  // Etiquetas de red: union-find sobre las redes por cables, por potencial.
  const padre = porCables.map((_, i) => i);
  const raiz = (i: number): number => {
    while (padre[i] !== i) {
      padre[i] = padre[padre[i]!]!;
      i = padre[i]!;
    }
    return i;
  };
  const primera = new Map<string, number>();
  for (const f of fuentes) {
    const p = primera.get(f.clave);
    if (p === undefined) {
      primera.set(f.clave, f.red);
      continue;
    }
    const ra = raiz(p);
    const rb = raiz(f.red);
    if (ra !== rb) padre[Math.max(ra, rb)] = Math.min(ra, rb);
  }

  // Redes de la netlist, en el orden de su primera red por cables.
  const nueva = new Map<number, number>();
  const salida: RedNetlist[] = [];
  const indiceDe = porCables.map((r, i) => {
    const k = raiz(i);
    let j = nueva.get(k);
    if (j === undefined) {
      j = salida.length;
      nueva.set(k, j);
      salida.push({ bornes: [], cables: [], potenciales: [] });
    }
    const red = salida[j]!;
    red.bornes.push(...r.bornes);
    red.cables.push(...r.cables);
    return j;
  });
  for (const f of fuentes) {
    const red = salida[indiceDe[f.red]!]!;
    const p = indicePotencial.get(f.clave)!;
    if (!red.potenciales.includes(p)) red.potenciales.push(p);
  }
  const enCorto: number[] = [];
  salida.forEach((r, i) => {
    r.potenciales.sort((x, y) => x - y);
    if (r.potenciales.length >= 2) enCorto.push(i);
  });

  const redDeBorne = new Map<string, Map<string, number>>();
  for (const [comp, delComp] of redCables) redDeBorne.set(comp, new Map([...delComp].map(([b, i]) => [b, indiceDe[i]!])));
  const redDe = (comp: string, borne: string): number | undefined => redDeBorne.get(comp)?.get(borne);

  // Contactos y cargas, en el orden de la hoja.
  const contactos: ContactoNetlist[] = [];
  const cargas: CargaNetlist[] = [];
  for (const c of hoja.componentes) {
    const def = buscarSimbolo(c.tipo);
    if (!def || def.bornes.length !== 2) continue;
    const a = redDe(c.id, def.bornes[0]!.nombre);
    const b = redDe(c.id, def.bornes[1]!.nombre);
    if (a === undefined || b === undefined) continue;
    const etiqueta = normalizarEtiqueta(c.etiqueta);
    if (def.elemento === "contacto_na" || def.elemento === "contacto_nc") {
      contactos.push({ comp: c.id, etiqueta, na: def.elemento === "contacto_na", accionamiento: def.accionamiento, a, b });
    } else if (def.elemento === "bobina" || def.elemento === "carga") {
      cargas.push({ comp: c.id, etiqueta, tipo: def.elemento, a, b });
    }
  }

  // Bobinas con etiqueta, agrupadas, en orden natural.
  const grupos = new Map<string, number[]>();
  cargas.forEach((k, i) => {
    if (k.tipo !== "bobina" || k.etiqueta === "") return;
    let g = grupos.get(k.etiqueta);
    if (!g) grupos.set(k.etiqueta, (g = []));
    g.push(i);
  });
  const bobinas = [...grupos].sort(([x], [y]) => compararEtiquetas(x, y)).map(([etiqueta, ids]) => ({ etiqueta, cargas: ids }));

  return { redes: salida, potenciales, redDeBorne, enCorto, contactos, cargas, bobinas };
}
