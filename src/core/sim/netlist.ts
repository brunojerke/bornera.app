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
//   En una fuente de varios bornes (T34, la trifásica), cada borne da el suyo:
//   papel del borne (tabla por tipo y borne, D3-A) más su nombre; la etiqueta
//   no cuenta (D1-A). Su L1 es la misma red que una Fase «L1».
// - Salida propia (T39; D-B2, D-B8, D-B10): fuentes de continua, conmutada,
//   trafos y variac. Cada borne de `salida` da papel del borne más etiqueta +
//   borne («G1.L+», «T1.2U1»): dos fuentes no se unen entre sí ni con la red,
//   y una Fase «T1.2U1» es la misma red que esa salida (D-T39-2 A). Siempre
//   activa: no depende de la entrada (hasta 6b). Sin etiqueta no da
//   potencial (R3 avisa; ajuste 4 B de T39: entra igual a Simular).
// - Corto por cables (D10-A): una red con dos potenciales o más. Acá solo se
//   anota (`enCorto`); el motor lo ve en reposo, se detiene y avisa (T30).
// - Contactos (NA o NC, con su accionamiento), uno por polo (T34: los 3 de
//   un contactor principal, con la etiqueta y el accionamiento del símbolo), y
//   cargas (bobina, lámpara, bocina; T39: los pares de `cargas`, como la
//   entrada L-N de la conmutada), cada uno con la red de sus dos bornes.
//   Las protecciones y el seccionador (T36, D17-A) son contactos NA sin
//   accionamiento (`null`), un polo por par: el motor los da cerrados (6b les
//   suma abierta y disparada). Un símbolo desconocido no conduce ni es carga;
//   tampoco los motores, cargas de 3 o 6 bornes (hasta 6b, D14-A).
// - Sensor (T40, D-B3 A): un contacto que también tiene `cargas`, la BN-BU; BN
//   es del polo y de la carga (`enPolo`). Cada polo y cada carga lleva sus
//   `bornes`: el par de su definición, sin copiar.
// - Electroválvulas (T40): `valvulas`, en el orden de la hoja, con sus cargas;
//   el motor da su posición (D-B5 A). Una carga de una válvula es "carga".
// - Bobinas por etiqueta, en orden natural (K1, K2, K10): el orden de D2. Una
//   etiqueta repetida en dos bobinas no se resuelve acá (R4 impide entrar).
//
// Solo la hoja que se recibe (la app muestra la primera). Sin DOM.

import { buscarSimbolo, cargasDe, polosDe, SIMBOLOS, type Accionamiento, type DefinicionSimbolo } from "../symbols";
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

/**
 * Papel de cada borne de las fuentes de varios bornes, por `tipo` y nombre de
 * borne (T34, D3-A). El nombre del borne es el de la red. `fuente.trifasica_n`
 * (símbolo de T35) suma el N como neutro.
 */
const PAPEL_POR_BORNE: Readonly<Record<string, Readonly<Record<string, Papel>>>> = {
  "fuente.trifasica": { L1: "fase", L2: "fase", L3: "fase" },
  "fuente.trifasica_n": { L1: "fase", L2: "fase", L3: "fase", N: "neutro" },
};
// Las claves de borne de esta tabla ya están normalizadas (mayúsculas, sin
// espacios): el nombre del borne es el de la red tal cual, sin normalizar.

/** Los símbolos con salida propia (T39), por tipo: armado una vez. */
const CON_SALIDA: ReadonlyMap<string, DefinicionSimbolo> = new Map(SIMBOLOS.filter((d) => d.salida !== undefined).map((d) => [d.tipo, d]));

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

/** Un polo de un contacto: une sus dos redes cuando conduce. Los polos de un componente se accionan juntos. */
export interface ContactoNetlist {
  comp: string;
  /** Índice del polo en `polosDe` de su símbolo: 0 en un contacto de un polo. */
  polo: number;
  /** Etiqueta normalizada ("" sin etiqueta). Para el auxiliar, la de su bobina. */
  etiqueta: string;
  /** NA (true) o NC (false). Una protección es NA. */
  na: boolean;
  /** Los bornes del polo, como en su definición (T40): el par de `polosDe`, sin copiar. */
  bornes: readonly [string, string];
  /** El del símbolo; null en una protección o un seccionador, que en 6a conducen siempre (T36, D17-A). */
  accionamiento: Accionamiento | null;
  /** Redes del primer y el segundo borne del polo, como en su definición. */
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
  /** Los bornes de la carga, como en su definición (T40): el par de `cargasDe`, sin copiar. */
  bornes: readonly [string, string];
  /** Por extremo: el borne también es de un polo de su componente (T40: el BN del sensor). */
  enPolo: readonly [boolean, boolean];
  a: number;
  b: number;
}

/**
 * Una electroválvula (T40, D-B5 A): sus cargas en `Netlist.cargas`, -1 si esa
 * bobina no tiene sus dos bornes en redes. La monoestable no tiene `b`.
 */
export interface ValvulaNetlist {
  comp: string;
  /** Etiqueta normalizada ("" sin etiqueta). */
  etiqueta: string;
  biestable: boolean;
  /** A1-A2: lleva a 14 (accionada). */
  a: number;
  /** B1-B2 de la biestable: lleva a 12 (reposo); -1 en la monoestable. */
  b: number;
}

/** Ningún extremo en un polo: el mismo par en cada carga que no es de un contacto. */
const SIN_POLO: readonly [boolean, boolean] = [false, false];

export interface Netlist {
  /** En el orden de su primera red por cables en `redes(hoja)`. */
  redes: RedNetlist[];
  /** Ordenados por papel (fase antes que neutro) y por nombre, en orden natural. */
  potenciales: Potencial[];
  /** Red de cada borne de un símbolo conocido: comp → borne → índice en `redes`. */
  redDeBorne: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** Índices de las redes con dos potenciales o más, de menor a mayor (D10-A). */
  enCorto: number[];
  /** En el orden de la hoja y, en cada componente, por polo. */
  contactos: ContactoNetlist[];
  /** En el orden de la hoja. */
  cargas: CargaNetlist[];
  /** Bobinas con etiqueta, agrupadas por ella, en orden natural; `cargas` son índices en `Netlist.cargas`. */
  bobinas: { etiqueta: string; cargas: number[] }[];
  /** Electroválvulas (T40), en el orden de la hoja. */
  valvulas: ValvulaNetlist[];
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

/** Una fuente con potencial: el potencial (clave "papel|nombre") y su red por cables. */
interface Fuente {
  clave: string;
  potencial: Potencial;
  red: number;
}

/** Suma a `fuentes` la de ese papel y nombre, si tiene nombre y red. */
function sumarFuente(fuentes: Fuente[], papel: Papel, nombre: string, red: number | undefined): void {
  if (nombre === "" || red === undefined) return;
  fuentes.push({ clave: `${papel}|${nombre}`, potencial: { papel, nombre }, red });
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
  const fuentes: Fuente[] = [];
  for (const c of hoja.componentes) {
    const papel = PAPEL[c.tipo];
    const porBorne = papel ? undefined : PAPEL_POR_BORNE[c.tipo];
    if (!papel && !porBorne) {
      const conSalida = CON_SALIDA.get(c.tipo);
      if (!conSalida) continue;
      const etiqueta = normalizarEtiqueta(c.etiqueta);
      if (etiqueta === "") continue;
      const delComp = redCables.get(c.id);
      const salidaDe = conSalida.salida!;
      for (const b of conSalida.bornes) {
        const p = salidaDe[b.nombre];
        if (p) sumarFuente(fuentes, p, `${etiqueta}.${b.nombre}`, delComp?.get(b.nombre));
      }
      continue;
    }
    const def = buscarSimbolo(c.tipo);
    if (!def) continue;
    const delComp = redCables.get(c.id);
    if (papel) {
      if (def.bornes.length === 1) sumarFuente(fuentes, papel, normalizarEtiqueta(c.etiqueta), delComp?.get(def.bornes[0]!.nombre));
      continue;
    }
    for (const b of def.bornes) {
      const p = porBorne![b.nombre];
      if (p) sumarFuente(fuentes, p, b.nombre, delComp?.get(b.nombre));
    }
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
  const valvulas: ValvulaNetlist[] = [];
  for (const c of hoja.componentes) {
    const def = buscarSimbolo(c.tipo);
    if (!def) continue;
    const contacto = def.elemento === "contacto_na" || def.elemento === "contacto_nc" || def.elemento === "proteccion";
    if (contacto) {
      const etiqueta = normalizarEtiqueta(c.etiqueta);
      const polos = polosDe(def);
      const na = def.elemento !== "contacto_nc";
      const accionamiento = def.accionamiento ?? null;
      for (let polo = 0; polo < polos.length; polo++) {
        const bornes = polos[polo]!;
        const a = redDe(c.id, bornes[0]);
        const b = redDe(c.id, bornes[1]);
        if (a === undefined || b === undefined) continue;
        contactos.push({ comp: c.id, polo, etiqueta, na, accionamiento, bornes, a, b });
      }
    }
    // Cargas: las de una bobina o una carga y, en un contacto, las de `cargas` (el sensor, T40).
    const pares = cargasDe(def);
    if (pares.length === 0) continue;
    const etiqueta = normalizarEtiqueta(c.etiqueta);
    const tipo = def.elemento === "bobina" ? "bobina" : "carga";
    const valvula = def.valvula;
    const indices = valvula ? [-1, -1] : undefined;
    for (let i = 0; i < pares.length; i++) {
      const bornes = pares[i]!;
      const a = redDe(c.id, bornes[0]);
      const b = redDe(c.id, bornes[1]);
      if (a === undefined || b === undefined) continue;
      const polos = contacto ? polosDe(def) : undefined;
      const enPolo: readonly [boolean, boolean] = polos ? [polos.some((p) => p.includes(bornes[0])), polos.some((p) => p.includes(bornes[1]))] : SIN_POLO;
      if (indices) indices[i] = cargas.length;
      cargas.push({ comp: c.id, etiqueta, tipo, bornes, enPolo, a, b });
    }
    if (indices) valvulas.push({ comp: c.id, etiqueta, biestable: valvula === "biestable", a: indices[0]!, b: indices[1]! });
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

  return { redes: salida, potenciales, redDeBorne, enCorto, contactos, cargas, bobinas, valvulas };
}
