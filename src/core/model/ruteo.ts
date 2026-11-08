// Ruteo de cables (T13): los codos automáticos entre dos puntos de la
// grilla. Ortogonal, entero y determinista: la misma entrada da siempre la
// misma salida, sin estado ni histéresis. Sin dependencias del navegador.
//
// Cada extremo dice por dónde puede salir el cable desde su punto (mirando
// hacia el cable, también en `hasta`):
// - Un borne prefiere su dirección (`borneColocado`, en las 8 orientaciones)
//   y prohíbe la opuesta, que entra al símbolo.
// - Un codo ya fijado prohíbe volver por el último tramo (vuelta de 180°) y
//   prefiere, solo para desempatar, salir de costado: el clic marcó una esquina.
// - Una T o un punto libre no tienen preferencias (lo que se encima lo
//   descarta `acepta`).
//
// Candidatos, en orden fijo: recta; L primero en X y primero en Y; Z por la
// mitad en X y en Y; U a 1 unidad más allá de los dos puntos, del lado de
// cada salida preferida. Se descartan los que no son válidos (largo cero,
// vuelta de 180°, una salida prohibida) y los que `acepta` rechaza; de los
// que quedan gana el menor por (preferidas fuertes incumplidas, codos,
// largo, preferidas débiles incumplidas, orden).

import type { Direccion } from "../symbols/tipos";

export interface ExtremoRuta {
  x: number;
  y: number;
  /** Salidas preferidas (cualquiera de ellas): incumplir una pesa más que un codo. */
  preferidas?: readonly Direccion[];
  /** Salidas preferidas solo para desempatar. */
  debiles?: readonly Direccion[];
  /** Salidas que no valen. */
  prohibidas?: readonly Direccion[];
}

/** Una ruta posible: los codos y cómo puntúa. */
export interface Ruta {
  codos: [number, number][];
  /** Preferidas fuertes incumplidas (0, 1 o 2). */
  penalizacion: number;
  largo: number;
}

export const VECTORES: Readonly<Record<Direccion, readonly [number, number]>> = {
  derecha: [1, 0],
  abajo: [0, 1],
  izquierda: [-1, 0],
  arriba: [0, -1],
};

const OPUESTA: Readonly<Record<Direccion, Direccion>> = {
  derecha: "izquierda",
  izquierda: "derecha",
  arriba: "abajo",
  abajo: "arriba",
};

export function opuesta(d: Direccion): Direccion {
  return OPUESTA[d];
}

/** Las dos direcciones perpendiculares a `d`. */
export function perpendiculares(d: Direccion): [Direccion, Direccion] {
  return d === "arriba" || d === "abajo" ? ["izquierda", "derecha"] : ["arriba", "abajo"];
}

/** Dirección de un tramo (dx, dy) horizontal o vertical; null si es largo cero o diagonal. */
export function direccionDe(dx: number, dy: number): Direccion | null {
  if (dx !== 0 && dy !== 0) return null;
  if (dx > 0) return "derecha";
  if (dx < 0) return "izquierda";
  if (dy > 0) return "abajo";
  if (dy < 0) return "arriba";
  return null;
}

/**
 * Quita de un recorrido (x, y seguidos) los puntos repetidos y los del medio
 * de dos tramos que siguen en la misma dirección. Una vuelta de 180° no se
 * quita: queda para que la validación la rechace.
 */
export function simplificar(p: readonly number[]): number[] {
  const s: number[] = [];
  for (let i = 0; i + 1 < p.length; i += 2) {
    const x = p[i]!;
    const y = p[i + 1]!;
    const n = s.length;
    if (n >= 2 && s[n - 2] === x && s[n - 1] === y) continue;
    if (n >= 4) {
      const d0 = direccionDe(s[n - 2]! - s[n - 4]!, s[n - 1]! - s[n - 3]!);
      const d1 = direccionDe(x - s[n - 2]!, y - s[n - 1]!);
      if (d0 !== null && d0 === d1) {
        s[n - 2] = x;
        s[n - 1] = y;
        continue;
      }
    }
    s.push(x, y);
  }
  return s;
}

/** Codos candidatos entre a y b, en el orden fijo de la lista. */
function candidatos(a: ExtremoRuta, b: ExtremoRuta): [number, number][][] {
  const { x: ax, y: ay } = a;
  const { x: bx, y: by } = b;
  const dx = bx - ax;
  const dy = by - ay;
  const lista: [number, number][][] = [];
  if (dx === 0 || dy === 0) lista.push([]);
  if (dx !== 0 && dy !== 0) {
    lista.push([[bx, ay]]);
    lista.push([[ax, by]]);
  }
  if (Math.abs(dx) >= 2 && dy !== 0) {
    const mx = ax + Math.trunc(dx / 2);
    lista.push([
      [mx, ay],
      [mx, by],
    ]);
  }
  if (Math.abs(dy) >= 2 && dx !== 0) {
    const my = ay + Math.trunc(dy / 2);
    lista.push([
      [ax, my],
      [bx, my],
    ]);
  }
  // U del lado de cada salida preferida (fuerte o débil), a 1 unidad más allá de los dos.
  const lados = new Set<Direccion>([...(a.preferidas ?? []), ...(a.debiles ?? []), ...(b.preferidas ?? []), ...(b.debiles ?? [])]);
  for (const d of ["arriba", "abajo", "izquierda", "derecha"] as const) {
    if (!lados.has(d)) continue;
    if (d === "izquierda" || d === "derecha") {
      if (ay === by) continue;
      const X = d === "derecha" ? Math.max(ax, bx) + 1 : Math.min(ax, bx) - 1;
      lista.push([
        [X, ay],
        [X, by],
      ]);
    } else {
      if (ax === bx) continue;
      const Y = d === "abajo" ? Math.max(ay, by) + 1 : Math.min(ay, by) - 1;
      lista.push([
        [ax, Y],
        [bx, Y],
      ]);
    }
  }
  return lista;
}

/** Salida de un recorrido simplificado desde su primer punto (inicio) o desde el último (fin). */
function salidas(p: readonly number[]): { inicio: Direccion; fin: Direccion } | null {
  const n = p.length;
  const inicio = direccionDe(p[2]! - p[0]!, p[3]! - p[1]!);
  const fin = direccionDe(p[n - 4]! - p[n - 2]!, p[n - 3]! - p[n - 1]!);
  return inicio && fin ? { inicio, fin } : null;
}

/** True si el recorrido (x, y seguidos) tiene tramos de largo cero, diagonales o vueltas de 180°. */
export function formaInvalida(p: readonly number[]): boolean {
  let anterior: Direccion | null = null;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const d = direccionDe(p[i + 2]! - p[i]!, p[i + 3]! - p[i + 1]!);
    if (d === null) return true;
    if (anterior !== null && d === opuesta(anterior)) return true;
    anterior = d;
  }
  return false;
}

function largo(p: readonly number[]): number {
  let l = 0;
  for (let i = 0; i + 3 < p.length; i += 2) l += Math.abs(p[i + 2]! - p[i]!) + Math.abs(p[i + 3]! - p[i + 1]!);
  return l;
}

function incumple(salida: Direccion, lista: readonly Direccion[] | undefined): number {
  return lista && lista.length > 0 && !lista.includes(salida) ? 1 : 0;
}

/**
 * Todas las rutas válidas por su forma entre `desde` y `hasta`, de la mejor
 * a la peor. Vacío si los puntos coinciden o no hay ninguna con 2 codos o menos.
 */
export function rutas(desde: ExtremoRuta, hasta: ExtremoRuta): Ruta[] {
  if (desde.x === hasta.x && desde.y === hasta.y) return [];
  const puntuadas: { ruta: Ruta; debil: number; orden: number }[] = [];
  const vistas = new Set<string>();
  const lista = candidatos(desde, hasta);
  for (let orden = 0; orden < lista.length; orden++) {
    const crudos = [desde.x, desde.y, ...lista[orden]!.flat(), hasta.x, hasta.y];
    const p = simplificar(crudos);
    if (p.length < 4 || formaInvalida(p)) continue;
    const s = salidas(p);
    if (!s) continue;
    if (desde.prohibidas?.includes(s.inicio) || hasta.prohibidas?.includes(s.fin)) continue;
    const codos: [number, number][] = [];
    for (let i = 2; i + 3 < p.length; i += 2) codos.push([p[i]!, p[i + 1]!]);
    const clave = codos.join(";");
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    puntuadas.push({
      ruta: { codos, penalizacion: incumple(s.inicio, desde.preferidas) + incumple(s.fin, hasta.preferidas), largo: largo(p) },
      debil: incumple(s.inicio, desde.debiles) + incumple(s.fin, hasta.debiles),
      orden,
    });
  }
  puntuadas.sort(
    (a, b) =>
      a.ruta.penalizacion - b.ruta.penalizacion ||
      a.ruta.codos.length - b.ruta.codos.length ||
      a.ruta.largo - b.ruta.largo ||
      a.debil - b.debil ||
      a.orden - b.orden,
  );
  return puntuadas.map((c) => c.ruta);
}

/**
 * Los codos de la mejor ruta entre `desde` y `hasta` que `acepta` deja pasar
 * (por defecto, todas), o null si no hay ninguna. `acepta` recibe los codos.
 */
export function codos(
  desde: ExtremoRuta,
  hasta: ExtremoRuta,
  acepta: (codos: [number, number][]) => boolean = () => true,
): [number, number][] | null {
  for (const r of rutas(desde, hasta)) if (acepta(r.codos)) return r.codos;
  return null;
}
