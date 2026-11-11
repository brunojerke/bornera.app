// Uniones (T14b): los puntos donde se juntan 3 o más brazos conectados. Se
// calculan del documento y no se guardan en el `.brn`.
//
// Un brazo es una línea que sale del punto y está conectada ahí:
// - el extremo de un cable en un borne o en T (un extremo libre no conecta);
// - la línea del símbolo que llega a un borne con algún cable;
// - el anfitrión de una T: 2 brazos si la T cae en el medio de su recorrido
//   (un codo también es el medio), 1 si cae en uno de sus extremos.
// Los brazos se agrupan por lo que conectan (un borne, o un punto de un
// cable): dos cosas que solo coinciden en el lugar, sin conexión, no se suman.
//
// Con esta cuenta (D1-A): una T da 1 unión, una L o un cruce sin empalme 0,
// dos cables en un mismo borne 1, un cable solo en un borne 0. Una T sobre el
// extremo libre de su anfitrión da 2 brazos y no es unión: se ve como una
// recta o una L. W no crea esa T (T13) ni la deja T14a: solo llega desde un
// `.brn` (T15a la valida o la informa).

import { indexarHoja, puntoExtremo, puntoSobreRecorrido, recorridoCable, type IndiceHoja } from "./cables";
import type { Cable, Hoja } from "./documento";

/** Una unión: su punto y lo que se junta ahí (ids ordenados). */
export interface Union {
  x: number;
  y: number;
  /** Cables con algún brazo en la unión (los que llegan y los anfitriones). */
  cables: string[];
  /** Componentes con un borne en la unión. */
  componentes: string[];
}

/** Clave de un punto de la grilla. */
export function clavePunto(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Puntos donde el cable tiene un extremo conectado (borne o T), x, y
 * seguidos: 0, 1 o 2 puntos. Solo ahí puede haber una unión que lo cuente
 * como cable que llega. Un extremo que no se puede resolver no da punto.
 */
export function puntosConectados(indice: IndiceHoja, w: Cable): number[] {
  const salida: number[] = [];
  for (const e of [w.desde, w.hasta]) {
    if (e.tipo === "libre") continue;
    const p = puntoExtremo(indice, e);
    if (p) salida.push(p.x, p.y);
  }
  return salida;
}

/**
 * La unión en (x, y), o null si ahí no se juntan 3 brazos de una misma
 * conexión. `llegan`: los cables con un extremo conectado en ese punto (los
 * demás no aportan; los anfitriones de las T se buscan en `indice`).
 */
export function unionEnPunto(indice: IndiceHoja, llegan: Iterable<Cable>, x: number, y: number): Union | null {
  // Conexiones del punto, unidas con union-find: "b:<comp>\0<borne>" o "t:<cable>".
  const padre = new Map<string, string>();
  const raiz = (k: string): string => {
    let r = k;
    while (padre.get(r) !== r) r = padre.get(r)!;
    // Acortar el camino para la próxima.
    let a = k;
    while (a !== r) {
      const s = padre.get(a)!;
      padre.set(a, r);
      a = s;
    }
    return r;
  };
  const nodo = (k: string): string => {
    if (!padre.has(k)) padre.set(k, k);
    return k;
  };
  const unir = (a: string, b: string) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre.set(ra, rb);
  };
  /** Cada brazo (sin repetir) y la conexión a la que llega. */
  const brazos = new Map<string, string>();
  const brazo = (clave: string, n: string) => {
    if (!brazos.has(clave)) brazos.set(clave, nodo(n));
  };
  /** Ids que aporta cada conexión. */
  const cablesDe = new Map<string, Set<string>>();
  const compsDe = new Map<string, Set<string>>();
  const anotar = (mapa: Map<string, Set<string>>, n: string, id: string) => {
    let s = mapa.get(n);
    if (!s) mapa.set(n, (s = new Set()));
    s.add(id);
  };
  const anfitriones = new Set<string>();

  /** Toma el extremo `lado` de `w`, que está en el punto. Devuelve su conexión, o null si es libre. */
  const tomarExtremo = (w: Cable, lado: "desde" | "hasta"): string | null => {
    const e = w[lado];
    if (e.tipo === "borne") {
      const n = nodo(`b:${e.comp}\u0000${e.borne}`);
      brazo(`e:${w.id}:${lado}`, n);
      brazo(`l:${e.comp}\u0000${e.borne}`, n);
      anotar(cablesDe, n, w.id);
      anotar(compsDe, n, e.comp);
      return n;
    }
    if (e.tipo === "cable") {
      const n = nodo(`t:${e.cable}`);
      brazo(`e:${w.id}:${lado}`, n);
      anotar(cablesDe, n, w.id);
      tomarAnfitrion(e.cable);
      return n;
    }
    return null;
  };

  /** Los brazos del anfitrión de una T en el punto. */
  const tomarAnfitrion = (id: string) => {
    if (anfitriones.has(id)) return;
    anfitriones.add(id);
    const h = indice.cables.get(id);
    const rec = h && recorridoCable(indice, h);
    // Un documento roto (la T no está sobre su anfitrión): el anfitrión no aporta.
    if (!h || !rec || !puntoSobreRecorrido(rec, x, y)) return;
    const n = nodo(`t:${id}`);
    anotar(cablesDe, n, id);
    const m = rec.length;
    const enDesde = rec[0] === x && rec[1] === y;
    const enHasta = rec[m - 2] === x && rec[m - 1] === y;
    if (!enDesde && !enHasta) {
      brazo(`p:${id}:a`, n);
      brazo(`p:${id}:b`, n);
      return;
    }
    for (const lado of ["desde", "hasta"] as const) {
      if (lado === "desde" ? !enDesde : !enHasta) continue;
      const otra = tomarExtremo(h, lado);
      if (otra) unir(n, otra);
      else brazo(`e:${id}:${lado}`, n);
    }
  };

  for (const w of llegan) {
    for (const lado of ["desde", "hasta"] as const) {
      const e = w[lado];
      if (e.tipo === "libre") continue;
      const p = puntoExtremo(indice, e);
      if (p && p.x === x && p.y === y) tomarExtremo(w, lado);
    }
  }

  const cuenta = new Map<string, number>();
  for (const n of brazos.values()) {
    const r = raiz(n);
    cuenta.set(r, (cuenta.get(r) ?? 0) + 1);
  }
  const cables = new Set<string>();
  const componentes = new Set<string>();
  let hay = false;
  for (const n of padre.keys()) {
    if ((cuenta.get(raiz(n)) ?? 0) < 3) continue;
    hay = true;
    for (const id of cablesDe.get(n) ?? []) cables.add(id);
    for (const id of compsDe.get(n) ?? []) componentes.add(id);
  }
  if (!hay) return null;
  return { x, y, cables: [...cables].sort(), componentes: [...componentes].sort() };
}

/** Orden de las uniones: por y, después por x. */
export function compararUniones(a: Union, b: Union): number {
  return a.y - b.y || a.x - b.x;
}

/** Todas las uniones de la hoja, ordenadas por y y después por x. Recorre la hoja entera. */
export function uniones(hoja: Hoja, indice: IndiceHoja = indexarHoja(hoja)): Union[] {
  const porPunto = new Map<string, { x: number; y: number; llegan: Cable[] }>();
  for (const w of hoja.cables) {
    const p = puntosConectados(indice, w);
    for (let i = 0; i + 1 < p.length; i += 2) {
      const x = p[i]!;
      const y = p[i + 1]!;
      const k = clavePunto(x, y);
      let g = porPunto.get(k);
      if (!g) porPunto.set(k, (g = { x, y, llegan: [] }));
      if (!g.llegan.includes(w)) g.llegan.push(w);
    }
  }
  const salida: Union[] = [];
  for (const g of porPunto.values()) {
    const u = unionEnPunto(indice, g.llegan, g.x, g.y);
    if (u) salida.push(u);
  }
  return salida.sort(compararUniones);
}
