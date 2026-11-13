// Ayudas de los tests de pegar (T16), compartidas por
// src/core/model/portapapeles.test.ts y tests/portapapeles-banco.test.ts.
// Solo lo importan los tests: el código de la app no lo usa.
import { expect } from "vitest";
import type { Rect } from "../symbols";
import { indexarHoja, recorridoCable } from "./cables";
import type { Hoja } from "./documento";
import type { Recorte } from "./portapapeles";
import { nombreDeFuente, redes, type Red } from "./redes";
import { consultaHoja, consultaSinCable, geometriaComponente, problemasComponente, problemasTrazado, type Conflicto } from "./trazado";
import { compararUniones, uniones, type Union } from "./uniones";

/** El recorte solo, como una hoja. */
export function hojaDe(r: Recorte): Hoja {
  return { nombre: "Recorte", componentes: [...r.componentes], cables: [...r.cables] };
}

/**
 * Id original → id nueva. Lo pegado va al final de las listas de `despues`,
 * en el orden del recorte.
 */
export function mapaPegado(r: Recorte, despues: Hoja): Map<string, string> {
  const mapa = new Map<string, string>();
  const nc = despues.componentes.length - r.componentes.length;
  const nw = despues.cables.length - r.cables.length;
  r.componentes.forEach((c, i) => mapa.set(c.id, despues.componentes[nc + i]!.id));
  r.cables.forEach((w, i) => mapa.set(w.id, despues.cables[nw + i]!.id));
  return mapa;
}

/**
 * Partición de los bornes: cada red como lista ordenada de "comp·borne", y
 * las listas ordenadas. Solo los bornes cuyo componente pasa `filtro`, con
 * el id que da `renombrar`; las redes que quedan sin bornes no cuentan.
 */
export function particion(
  lista: readonly Red[],
  filtro: (comp: string) => boolean = () => true,
  renombrar: (comp: string) => string = (id) => id,
): string[][] {
  return lista
    .map((red) => red.bornes.filter((b) => filtro(b.comp)).map((b) => `${renombrar(b.comp)}·${b.borne}`).sort())
    .filter((r) => r.length > 0)
    .sort((a, b) => (a.join(" ") < b.join(" ") ? -1 : 1));
}

/** La partición de `lista` uniendo las redes que comparten un nombre. */
function unirPorNombres(lista: readonly Red[]): string[][] {
  const padre = lista.map((_, i) => i);
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i]!)));
  const primero = new Map<string, number>();
  lista.forEach((red, i) => {
    for (const n of red.nombres) {
      const p = primero.get(n);
      if (p === undefined) primero.set(n, i);
      else padre[raiz(i)] = raiz(p);
    }
  });
  const juntas = new Map<number, Red>();
  lista.forEach((red, i) => {
    const r = raiz(i);
    const j = juntas.get(r) ?? { bornes: [], cables: [], nombres: [] };
    j.bornes.push(...red.bornes);
    juntas.set(r, j);
  });
  return particion([...juntas.values()]);
}

/**
 * Las redes después de pegar (ajuste de Bruno a la sección 3):
 * - sin unir por nombre, ninguna red junta lo que ya estaba con lo pegado; lo
 *   que ya estaba queda como antes y lo pegado, como el recorte solo;
 * - uniendo por nombre, cada fuente pegada cae en la red de su nombre (con la
 *   fuente de ese nombre que ya estaba, si hay) y no aparece otra unión.
 */
export function comprobarRedes(antes: Hoja, despues: Hoja, r: Recorte, mapa: ReadonlyMap<string, string>): void {
  const pegados = new Set(r.componentes.map((c) => mapa.get(c.id)!));
  const sin = redes(despues);
  for (const red of sin) expect(new Set(red.bornes.map((b) => pegados.has(b.comp))).size).toBeLessThanOrEqual(1);
  expect(particion(sin, (c) => !pegados.has(c))).toEqual(particion(redes(antes)));
  expect(particion(sin, (c) => pegados.has(c))).toEqual(particion(redes(hojaDe(r)), () => true, (id) => mapa.get(id)!));

  const con = redes(despues, { unirPorNombre: true });
  expect(particion(con)).toEqual(unirPorNombres(sin));
  for (const c of despues.componentes) {
    const nombre = pegados.has(c.id) ? nombreDeFuente(c) : null;
    if (!nombre) continue;
    const red = con.find((x) => x.bornes.some((b) => b.comp === c.id))!;
    expect(red.nombres).toContain(nombre);
    for (const o of antes.componentes) {
      if (nombreDeFuente(o) === nombre) expect(red.bornes.some((b) => b.comp === o.id)).toBe(true);
    }
  }
}

/** El par de una clave de conflicto, sin el tipo: "cable:w1|cuerpo:c3". */
export function par(clave: string): string {
  return clave.split("|").slice(1).join("|");
}

/** El id de un lado de una clave: "borne:c3:A1" → "c3". */
function elemento(lado: string): string {
  return lado.split(":")[1]!;
}

/** Un conflicto entre algo pegado y algo que ya estaba. */
interface Cruzado {
  par: string;
  x: number;
  y: number;
  /** El id de lo que ya estaba. */
  existente: string;
}

/** Lo que hay de cruzado (un lado en `nuevos` y el otro no) en una lista de conflictos. Sin "sinSalidas", que es regla de W. */
function cruzadosDe(lista: readonly Conflicto[], nuevos: ReadonlySet<string>): Cruzado[] {
  const salida: Cruzado[] = [];
  for (const k of lista) {
    const [tipo, a, b] = k.clave.split("|") as [string, string, string];
    if (tipo === "sinSalidas") continue;
    const na = nuevos.has(elemento(a));
    if (na === nuevos.has(elemento(b))) continue;
    salida.push({ par: `${a}|${b}`, x: k.x, y: k.y, existente: elemento(na ? b : a) });
  }
  return salida;
}

/** Caja de una lista de puntos (x, y seguidos). */
function cajaPuntos(p: readonly number[]): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i + 1 < p.length; i += 2) {
    x0 = Math.min(x0, p[i]!);
    x1 = Math.max(x1, p[i]!);
    y0 = Math.min(y0, p[i + 1]!);
    y1 = Math.max(y1, p[i + 1]!);
  }
  return { x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 };
}

const seTocan = (a: Rect, b: Rect) => a.x <= b.x + b.ancho && b.x <= a.x + a.ancho && a.y <= b.y + b.alto && b.y <= a.y + a.alto;

/**
 * Los conflictos entre un elemento de `nuevos` y uno que no está ahí,
 * revisando la hoja entera con la consulta lineal: cada cable contra todo lo
 * demás y cada componente contra todo. Lo que ya estaba se revisa solo si su
 * caja toca la de lo nuevo: si no, no puede chocar con nada nuevo (así no es
 * cuadrático en la hoja).
 */
export function cruzados(hoja: Hoja, nuevos: ReadonlySet<string>): Cruzado[] {
  const indice = indexarHoja(hoja);
  const consulta = consultaHoja(hoja, indice);
  const cables = hoja.cables.map((w) => ({ w, puntos: recorridoCable(indice, w) }));
  const comps = hoja.componentes.map((c) => ({ c, g: geometriaComponente(c) }));
  const cajas: Rect[] = [];
  for (const { w, puntos } of cables) if (nuevos.has(w.id) && puntos) cajas.push(cajaPuntos(puntos));
  for (const { c, g } of comps) if (nuevos.has(c.id) && g) cajas.push(g.cuerpo.caja);
  if (cajas.length === 0) return [];
  const nueva = cajaPuntos(cajas.flatMap((k) => [k.x, k.y, k.x + k.ancho, k.y + k.alto]));
  const salida: Cruzado[] = [];
  for (const { w, puntos } of cables) {
    if (!puntos || (!nuevos.has(w.id) && !seTocan(cajaPuntos(puntos), nueva))) continue;
    salida.push(...cruzadosDe(problemasTrazado({ id: w.id, desde: w.desde, hasta: w.hasta, puntos }, consultaSinCable(consulta, w.id)), nuevos));
  }
  for (const { c, g } of comps) {
    if (!g || (!nuevos.has(c.id) && !seTocan(g.cuerpo.caja, nueva))) continue;
    salida.push(...cruzadosDe(problemasComponente(g, consulta), nuevos));
  }
  return salida;
}

/**
 * Control de `problemasPegado` (`ps`, de antes de pegar) contra la hoja
 * entera ya pegada (`nuevos`: las ids pegadas):
 * - no inventa: cada par que da está en la revisión de la hoja entera;
 * - no se le escapa nada: cada conflicto cruzado de la hoja entera tiene en
 *   `ps` uno en el mismo punto y con el mismo elemento existente.
 * No se exige el mismo par: un borne pegado sobre un cable existente se ve,
 * desde ese cable, como un toque con el cable que llega a ese borne
 * (cable–cable), y `problemasPegado` lo da como borne–cable
 * (`problemasTrazado` deja el contacto en el borne de su extremo a
 * `problemasComponente`).
 */
export function comprobarControl(ps: readonly Conflicto[], hoja: Hoja, nuevos: ReadonlySet<string>): void {
  const control = cruzados(hoja, nuevos);
  const pares = new Set(control.map((k) => k.par));
  expect(ps.map((p) => par(p.clave)).filter((p) => !pares.has(p))).toEqual([]);
  const propios = cruzadosDe(ps, nuevos);
  const lugar = (k: Cruzado) => `${k.existente}@${k.x},${k.y}`;
  const marcados = new Set(propios.map(lugar));
  expect(control.filter((k) => !marcados.has(lugar(k)))).toEqual([]);
  expect(propios).toHaveLength(ps.length);
}

/** Las uniones de `antes` más las del recorte solo, trasladadas y con las ids nuevas. */
export function unionesEsperadas(antes: Hoja, r: Recorte, mapa: ReadonlyMap<string, string>, dx: number, dy: number): Union[] {
  const m = (id: string) => mapa.get(id)!;
  const pegadas = uniones(hojaDe(r)).map((u) => ({
    x: u.x + dx,
    y: u.y + dy,
    cables: u.cables.map(m).sort(),
    componentes: u.componentes.map(m).sort(),
  }));
  return [...uniones(antes), ...pegadas].sort(compararUniones);
}
