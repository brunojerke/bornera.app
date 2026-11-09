// Cables que siguen a los componentes (T14a): qué les pasa a los cables
// cuando se mueven, giran o espejan componentes y cables. Sin dependencias
// del navegador. La vista previa del arrastre y los comandos usan la misma
// función, `planearTransformacion`, con la misma consulta.
//
// Una operación es una sola transformación de grupo T (`transformacionGrupo`),
// que lleva todo punto entero a un punto entero. Lo que pasa con cada cable:
// - Rígido: se mueve entero con T. Lo es un cable de la zona (abajo) cuyos dos
//   extremos se mueven con T: en un borne de un componente transformado, en T
//   sobre otro cable rígido, o libre si el cable está seleccionado. Se calcula
//   como punto fijo máximo dentro de la zona, así un ciclo de T sin relación
//   con lo movido no entra nunca.
// - Parcial (se mueve un solo extremo): se conserva el dibujo desde el
//   extremo fijo y se rehace el final. Primero se prueba estirar (correr solo
//   el último codo); después, rutear con `rutas` desde el codo j, con j de
//   k−1 a 0. Se toma el primero que pasa todo, por la clave (salida preferida
//   cumplida, más dibujo conservado, menos codos, más corto, orden). Después
//   se prueba el fresco (lo que tendería W, con la dirección propia de cada
//   borne y no la salida heredada): gana si pasa todo y tiene menos codos.
//   Así un cable que quedó saliendo de costado vuelve a la recta.
// - Sus dos extremos se mueven distinto (un borne movido y una T que se
//   corrió): se rehace entero.
// - Una T sobre un cable que cambió: si el punto sigue sobre él, no cambia;
//   si no, pasa al punto entero más cercano de ese cable (sin sus extremos).
//
// Zona: los cables con un extremo en un borne movido o seleccionados, más los
// que se apoyan en ellos por T. Se procesa en orden topológico (anfitrión
// antes que lo que se apoya en él). Cada cable elige mirando lo fijo, los
// rígidos y sus anfitriones, no los otros que se rehacen: así no depende del
// orden. Un ciclo de apoyos que habría que rehacer se rechaza.
//
// Después se verifica todo junto: un conflicto nuevo (una conexión aparente
// que no estaba, comparada por la clave del par) rechaza la operación. Si la
// verificación falla por conflictos entre cables rehechos, hay un único
// reintento secuencial en orden geométrico (sin ids), en el que cada uno mira
// los ya resueltos. Ver "Decisión - Cables al mover".

import { espejarEnPantalla, rotarEnPantalla, type Direccion, type Rect, type Rotacion } from "../symbols";
import { borneDe, indexarHoja, puntoSobreRecorrido, recorridoCable, type IndiceHoja } from "./cables";
import type { Cable, Componente, Extremo, Hoja } from "./documento";
import { direccionDe, formaInvalida, opuesta, perpendiculares, rutas, simplificar, VECTORES, type ExtremoRuta } from "./ruteo";
import {
  consultaHoja,
  consultaSinCable,
  consultaSuperpuesta,
  geometriaComponente,
  problemasComponente,
  problemasTrazado,
  type CableHoja,
  type Conflicto,
  type ConsultaTrazado,
  type TransformacionConsulta,
} from "./trazado";

// ── Transformación de grupo ────────────────────────────────────────────────

export type Operacion = { tipo: "mover"; dx: number; dy: number } | { tipo: "rotar"; sentido: 90 | -90 } | { tipo: "espejar" };

/** Lo que cambian mover, rotar y espejar en un componente. */
export interface Pose {
  x: number;
  y: number;
  rot: Rotacion;
  espejado: boolean;
}

/** Caja de puntos enteros: mínimos y máximos. */
export interface CajaPuntos {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Transformación afín de un grupo: x' = a·x + b·y + tx, y' = c·x + d·y + ty,
 * con a, b, c, d en {−1, 0, 1}. Lleva todo punto entero a un punto entero.
 */
export class TransformacionGrupo implements TransformacionConsulta {
  constructor(
    readonly op: Operacion,
    private readonly a: number,
    private readonly b: number,
    private readonly c: number,
    private readonly d: number,
    private readonly tx: number,
    private readonly ty: number,
  ) {}

  punto(x: number, y: number): { x: number; y: number } {
    // `+ 0` convierte -0 en 0.
    return {
      x: this.a * x + this.b * y + this.tx + 0,
      y: this.c * x + this.d * y + this.ty + 0,
    };
  }

  inversa(x: number, y: number): { x: number; y: number } {
    const det = this.a * this.d - this.b * this.c;
    const u = x - this.tx;
    const v = y - this.ty;
    return {
      x: (this.d * u - this.b * v) / det + 0,
      y: (-this.c * u + this.a * v) / det + 0,
    };
  }

  direccion(dir: Direccion): Direccion {
    const [vx, vy] = VECTORES[dir];
    return direccionDe(this.a * vx + this.b * vy, this.c * vx + this.d * vy)!;
  }

  rect(r: Rect): Rect {
    return cajaDe(this.punto(r.x, r.y), this.punto(r.x + r.ancho, r.y + r.alto));
  }

  rectInverso(r: Rect): Rect {
    return cajaDe(this.inversa(r.x, r.y), this.inversa(r.x + r.ancho, r.y + r.alto));
  }

  /** La pose nueva de un componente: su centro con T y su orientación con R o M. */
  pose(c: Pose): Pose {
    const p = this.punto(c.x, c.y);
    const t = { rotacion: c.rot, espejado: c.espejado };
    const op = this.op;
    const n = op.tipo === "rotar" ? rotarEnPantalla(t, op.sentido) : op.tipo === "espejar" ? espejarEnPantalla(t) : t;
    return { x: p.x, y: p.y, rot: n.rotacion, espejado: n.espejado };
  }
}

function cajaDe(p: { x: number; y: number }, q: { x: number; y: number }): Rect {
  const x = Math.min(p.x, q.x);
  const y = Math.min(p.y, q.y);
  return { x, y, ancho: Math.abs(q.x - p.x), alto: Math.abs(q.y - p.y) };
}

/**
 * La transformación de una operación. Para girar y espejar hace falta la caja
 * de lo seleccionado (posiciones de componentes y puntos de cables).
 *
 * Girar es sobre el centro exacto de la caja. Si el ancho y el alto tienen
 * paridad distinta, el centro cae en media unidad en un solo eje y el
 * resultado quedaría en medias unidades: se corre el grupo (+½, −½) si el
 * ancho es impar y (−½, +½) si es par. Girar y volver deja todo igual (ver
 * "Decisión - Rotar y espejar en grupo"). Espejar es sobre el eje vertical
 * del centro: x0 + x1 es entero aunque el centro caiga en media unidad.
 */
export function transformacionGrupo(op: Operacion, caja: CajaPuntos | null): TransformacionGrupo {
  if (op.tipo === "mover") return new TransformacionGrupo(op, 1, 0, 0, 1, op.dx, op.dy);
  if (!caja) throw new Error("Hace falta la caja del grupo para girar o espejar.");
  const { x0, y0, x1, y1 } = caja;
  if (op.tipo === "espejar") return new TransformacionGrupo(op, -1, 0, 0, 1, x0 + x1, 0);
  // Múltiplos de ½: las cuentas son exactas en punto flotante.
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const anchoImpar = (x1 - x0) % 2 === 1;
  const altoImpar = (y1 - y0) % 2 === 1;
  const corrimiento = anchoImpar === altoImpar ? 0 : anchoImpar ? 0.5 : -0.5;
  // Horario: x' = cx − (y − cy) + c, y' = cy + (x − cx) − c.
  if (op.sentido === 90) return new TransformacionGrupo(op, 0, -1, 1, 0, cx + cy + corrimiento, cy - cx - corrimiento);
  // Antihorario: x' = cx + (y − cy) + c, y' = cy − (x − cx) − c.
  return new TransformacionGrupo(op, 0, 1, -1, 0, cx - cy + corrimiento, cy + cx - corrimiento);
}

// ── Plan ───────────────────────────────────────────────────────────────────

/** Un cable que cambia: extremos y codos nuevos, y el recorrido resuelto. */
export interface CableCambiado {
  id: string;
  desde: Extremo;
  hasta: Extremo;
  codos: [number, number][];
  puntos: number[];
}

export interface Plan {
  t: TransformacionGrupo;
  /** Componentes transformados, con su pose nueva (en el orden de los ids pedidos). */
  componentes: { id: string; pose: Pose }[];
  /** Cables que cambian, rígidos y rehechos. */
  cables: CableCambiado[];
  /** Cables que se mueven enteros con T. */
  rigidos: ReadonlySet<string>;
  /** Todos los cables que pueden cambiar con estos ids (no depende de cuánto se mueve). */
  zona: ReadonlySet<string>;
  /** Copias de lo que cambia, como estaba antes (para deshacer y para saber si el plan sigue valiendo). */
  antes: { componentes: Componente[]; cables: Cable[] };
}

export interface Rechazo {
  /** Texto para el usuario (barra de estado), sin ids internos. */
  motivo: string;
  /** Dónde marcar la ✕. */
  conflictos: Conflicto[];
}

/**
 * Lo que da `planearTransformacion`. Con rechazo, el plan es el intento (para
 * dibujarlo a rayas en la vista previa) y no se aplica.
 */
export interface ResultadoPlan {
  plan: Plan;
  rechazo: Rechazo | null;
}

/** Índice y consulta de la hoja sobre los que se planea (los del editor, o lineales). */
export interface EntornoPlan {
  indice: IndiceHoja;
  consulta: ConsultaTrazado;
}

/** Entorno armado de cero sobre la hoja (tests, consola): consulta lineal. */
export function entornoLineal(hoja: Hoja): EntornoPlan {
  const indice = indexarHoja(hoja);
  return { indice, consulta: consultaHoja(hoja, indice) };
}

export const MENSAJE_NADA_SE_MUEVE_UNO = "Ese cable está conectado a componentes que no se mueven: mové los componentes.";
export const MENSAJE_NADA_SE_MUEVE_VARIOS = "Esos cables están conectados a componentes que no se mueven: mové los componentes.";
export const MENSAJE_CICLO = "Esos cables se apoyan uno en otro: no se pueden acomodar solos.";
export const MENSAJE_SIN_CAMINO = "Un cable no tiene por dónde ir.";
export const MENSAJE_NO_SE_ACOMODA = "Un cable no se puede acomodar.";

/** Comienzo del aviso de un rechazo por conflicto, según la operación. */
export function prefijoRechazo(op: Operacion): string {
  return op.tipo === "mover" ? "No se puede mover acá" : op.tipo === "rotar" ? "No se puede girar" : "No se puede espejar";
}

/** "El cable pasaría…" → "un cable pasaría…"; "El borne…" → "el borne…". */
export function enMinuscula(mensaje: string): string {
  if (mensaje.startsWith("El cable ")) return `un cable ${mensaje.slice("El cable ".length)}`;
  return mensaje.charAt(0).toLowerCase() + mensaje.slice(1);
}

function textoConflicto(op: Operacion, c: Conflicto): string {
  return `${prefijoRechazo(op)}: ${enMinuscula(c.mensaje)}`;
}

// ── Geometría de recorridos ────────────────────────────────────────────────

/** El recorrido al revés (x, y seguidos). */
function invertir(p: readonly number[]): number[] {
  const r: number[] = [];
  for (let i = p.length - 2; i >= 0; i -= 2) r.push(p[i]!, p[i + 1]!);
  return r;
}

function contarCodos(p: readonly number[]): number {
  return p.length / 2 - 2;
}

function largoDe(p: readonly number[]): number {
  let l = 0;
  for (let i = 0; i + 3 < p.length; i += 2) l += Math.abs(p[i + 2]! - p[i]!) + Math.abs(p[i + 3]! - p[i + 1]!);
  return l;
}

function codosDe(p: readonly number[]): [number, number][] {
  const codos: [number, number][] = [];
  for (let i = 2; i + 3 < p.length; i += 2) codos.push([p[i]!, p[i + 1]!]);
  return codos;
}

/** Salida desde el primer punto y desde el último (mirando hacia el cable). */
function salidas(p: readonly number[]): {
  inicio: Direccion | null;
  fin: Direccion | null;
} {
  const n = p.length;
  return {
    inicio: direccionDe(p[2]! - p[0]!, p[3]! - p[1]!),
    fin: direccionDe(p[n - 4]! - p[n - 2]!, p[n - 3]! - p[n - 1]!),
  };
}

/** 1 si la salida `d` no es una de las preferidas de `e` (sin preferidas, 0). */
function incumpleSalida(d: Direccion | null, e: ExtremoRuta): number {
  return d && e.preferidas && e.preferidas.length > 0 && !e.preferidas.includes(d) ? 1 : 0;
}

/**
 * Cota de abajo de los codos de una ruta de `a` a `b`: 0 si va recta, 1 si
 * alcanza una L, si no 2. Con `cumpliendo`, solo cuentan las rutas que salen
 * por las preferidas de los dos extremos.
 */
function minimoCodosFresco(a: ExtremoRuta, b: ExtremoRuta, cumpliendo: boolean): number {
  const vale = (d: Direccion | null, e: ExtremoRuta) => d !== null && (!cumpliendo || incumpleSalida(d, e) === 0);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 || dy === 0) {
    const d = direccionDe(dx, dy);
    return d !== null && vale(d, a) && vale(opuesta(d), b) ? 0 : 2;
  }
  // L por (b.x, a.y): sale de a en x y llega a b en y; o por (a.x, b.y).
  if (vale(direccionDe(dx, 0), a) && vale(direccionDe(0, -dy), b)) return 1;
  if (vale(direccionDe(0, dy), a) && vale(direccionDe(-dx, 0), b)) return 1;
  return 2;
}

/**
 * Las salidas de un extremo en un borne: prefiere `salida` (la que tiene el
 * cable, o la transformada), y entrar al cuerpo está prohibido. La misma
 * regla para el extremo que se mueve y para el que queda fijo.
 */
export function extremoRutaBorne(x: number, y: number, direccion: Direccion, salida: Direccion): ExtremoRuta {
  const adentro = opuesta(direccion);
  return {
    x,
    y,
    preferidas: [salida === adentro ? direccion : salida],
    prohibidas: [adentro],
  };
}

/**
 * True si el recorrido es válido de forma (ortogonal, sin largo cero ni
 * 180°) y respeta las salidas prohibidas de los dos extremos; con
 * `preferidas`, también las preferidas.
 */
function formaValida(p: readonly number[], inicio: ExtremoRuta, fin: ExtremoRuta, preferidas: boolean): boolean {
  if (p.length < 4 || formaInvalida(p)) return false;
  const s = salidas(p);
  if (!s.inicio || !s.fin) return false;
  if (inicio.prohibidas?.includes(s.inicio) || fin.prohibidas?.includes(s.fin)) return false;
  if (!preferidas) return true;
  const cumple = (d: Direccion, l: readonly Direccion[] | undefined) => !l || l.length === 0 || l.includes(d);
  return cumple(s.inicio, inicio.preferidas) && cumple(s.fin, fin.preferidas);
}

interface Candidato {
  puntos: number[];
  clave: number[];
}

function compararNumeros(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}

/** Ordena por clave y saca los recorridos repetidos (queda el de mejor clave). */
function ordenar(lista: Candidato[]): Candidato[] {
  lista.sort((a, b) => compararNumeros(a.clave, b.clave));
  const vistos = new Set<string>();
  return lista.filter((c) => {
    const k = c.puntos.join(",");
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/**
 * Estirar: el extremo de llegada pasa a `m` y se corre solo el último codo,
 * para que sus dos tramos conserven el eje. Sin codos, solo si `m` sigue en
 * la misma recta. Null si no se puede.
 */
function estirar(P: readonly number[], m: { x: number; y: number }): number[] | null {
  const k = contarCodos(P);
  const n = P.length;
  if (k === 0) {
    const horizontal = P[1] === P[3];
    if (horizontal ? m.y !== P[1] : m.x !== P[0]) return null;
    return [P[0]!, P[1]!, m.x, m.y];
  }
  const cx = P[n - 4]!;
  const cy = P[n - 3]!;
  const vertical = cx === P[n - 2];
  const codo = vertical ? [m.x, cy] : [cx, m.y];
  return simplificar([...P.slice(0, n - 4), codo[0]!, codo[1]!, m.x, m.y]);
}

/**
 * Candidatos de un cable que se mueve por un solo extremo: `P` va del
 * extremo fijo (F) al que se mueve, que pasa a `m`. Ordenados de mejor a peor.
 */
function candidatosParcial(P: readonly number[], m: { x: number; y: number }, rutaF: ExtremoRuta, rutaM: ExtremoRuta): Candidato[] {
  const lista: Candidato[] = [];
  const e = estirar(P, m);
  if (e && formaValida(e, rutaF, rutaM, true)) lista.push({ puntos: e, clave: [-1] });
  const k = contarCodos(P);
  for (let j = Math.max(k - 1, 0); j >= 0; j--) {
    const conservado = P.slice(0, 2 * j + 2);
    let ancla: ExtremoRuta;
    if (j === 0) {
      ancla = rutaF;
    } else {
      const v = direccionDe(conservado[2 * j]! - conservado[2 * j - 2]!, conservado[2 * j + 1]! - conservado[2 * j - 1]!)!;
      ancla = {
        x: conservado[2 * j]!,
        y: conservado[2 * j + 1]!,
        prohibidas: [opuesta(v)],
        debiles: perpendiculares(v),
      };
    }
    rutas(ancla, rutaM).forEach((r, orden) => {
      const p = simplificar([...conservado, ...r.codos.flat(), m.x, m.y]);
      if (!formaValida(p, rutaF, rutaM, false)) return;
      lista.push({
        puntos: p,
        clave: [0, r.penalizacion, -j, contarCodos(p), largoDe(p), orden],
      });
    });
  }
  return ordenar(lista);
}

/** Candidatos de un cable que se rehace entero, de `d` a `h`. */
function candidatosEntero(d: ExtremoRuta, h: ExtremoRuta): Candidato[] {
  const lista: Candidato[] = [];
  rutas(d, h).forEach((r, orden) => {
    const p = simplificar([d.x, d.y, ...r.codos.flat(), h.x, h.y]);
    if (!formaValida(p, d, h, false)) return;
    lista.push({
      puntos: p,
      clave: [0, r.penalizacion, contarCodos(p), largoDe(p), orden],
    });
  });
  return ordenar(lista);
}

/**
 * Puntos enteros del recorrido `Q` donde puede ir una T que estaba en
 * (px, py), del más cercano al más lejano: la proyección sobre cada tramo,
 * sin los extremos de `Q`. Empate: por el orden a lo largo de `Q`.
 */
export function puntosParaT(Q: readonly number[], px: number, py: number): { x: number; y: number }[] {
  const tramos = Q.length / 2 - 1;
  const lista: { x: number; y: number; d: number; i: number; s: number }[] = [];
  for (let i = 0; i < tramos; i++) {
    const x0 = Q[2 * i]!;
    const y0 = Q[2 * i + 1]!;
    const x1 = Q[2 * i + 2]!;
    const y1 = Q[2 * i + 3]!;
    const ux = Math.sign(x1 - x0);
    const uy = Math.sign(y1 - y0);
    const largo = Math.abs(x1 - x0) + Math.abs(y1 - y0);
    const lo = i === 0 ? 1 : 0;
    const hi = i === tramos - 1 ? largo - 1 : largo;
    if (lo > hi) continue;
    const s = Math.min(Math.max((px - x0) * ux + (py - y0) * uy, lo), hi);
    const x = x0 + ux * s + 0;
    const y = y0 + uy * s + 0;
    lista.push({ x, y, d: (x - px) ** 2 + (y - py) ** 2, i, s });
  }
  lista.sort((a, b) => a.d - b.d || a.i - b.i || a.s - b.s);
  const vistos = new Set<string>();
  const salida: { x: number; y: number }[] = [];
  for (const p of lista) {
    const k = `${p.x},${p.y}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    salida.push({ x: p.x, y: p.y });
  }
  return salida;
}

/** Orden geométrico de un recorrido, igual en los dos sentidos: el menor de los dos, número a número. */
function claveGeometrica(p: readonly number[]): number[] {
  const r = invertir(p);
  return compararNumeros(p, r) <= 0 ? [...p] : r;
}

/**
 * Componentes fuertemente conexas (Tarjan, sin recursión). `vecinos` da los
 * anfitriones de cada cable dentro de la zona.
 */
function componentesFuertes(nodos: readonly string[], vecinos: (id: string) => readonly string[]): string[][] {
  let n = 0;
  const indice = new Map<string, number>();
  const bajo = new Map<string, number>();
  const enPila = new Set<string>();
  const pila: string[] = [];
  const salida: string[][] = [];
  for (const raiz of nodos) {
    if (indice.has(raiz)) continue;
    const marcos: { v: string; i: number }[] = [{ v: raiz, i: 0 }];
    indice.set(raiz, n);
    bajo.set(raiz, n++);
    pila.push(raiz);
    enPila.add(raiz);
    while (marcos.length > 0) {
      const f = marcos[marcos.length - 1]!;
      const vs = vecinos(f.v);
      if (f.i < vs.length) {
        const w = vs[f.i++]!;
        if (!indice.has(w)) {
          indice.set(w, n);
          bajo.set(w, n++);
          pila.push(w);
          enPila.add(w);
          marcos.push({ v: w, i: 0 });
        } else if (enPila.has(w)) {
          bajo.set(f.v, Math.min(bajo.get(f.v)!, indice.get(w)!));
        }
        continue;
      }
      marcos.pop();
      const padre = marcos[marcos.length - 1];
      if (padre) bajo.set(padre.v, Math.min(bajo.get(padre.v)!, bajo.get(f.v)!));
      if (bajo.get(f.v) === indice.get(f.v)) {
        const comp: string[] = [];
        let w: string;
        do {
          w = pila.pop()!;
          enPila.delete(w);
          comp.push(w);
        } while (w !== f.v);
        salida.push(comp);
      }
    }
  }
  return salida;
}

// ── Planear ────────────────────────────────────────────────────────────────

/** Cómo queda un extremo de un cable que no es rígido. */
/**
 * `ruta`: con la salida que tiene el cable (o la transformada). `fresca`: la
 * que usaría W, con la dirección propia del borne; sin borne, igual a `ruta`.
 */
type Movimiento =
  | { tipo: "fijo"; ruta: ExtremoRuta; fresca: ExtremoRuta }
  /** Opciones de punto nuevo, de la mejor a la peor (una sola, salvo una T que se corre). */
  | { tipo: "movido"; opciones: { extremo: Extremo; ruta: ExtremoRuta; fresca: ExtremoRuta }[] };

/** Lo que salió al acomodar un cable: sin cambios, el cambio, o por qué no se pudo. */
type Acomodo =
  { tipo: "igual" } | { tipo: "cambia"; cable: CableCambiado } | { tipo: "falla"; conflictos: Conflicto[]; intento: CableCambiado | null };

/**
 * Planea mover, girar o espejar `ids` (componentes y cables mezclados, de la
 * hoja de `entorno`) con todo lo que eso le hace a los cables. No cambia
 * nada. Tira un error si un id no está en la hoja o la hoja ya tenía un
 * cable que no se puede resolver; un rechazo para el usuario va en el
 * resultado.
 */
export function planearTransformacion(hoja: Hoja, ids: Iterable<string>, op: Operacion, entorno: EntornoPlan): ResultadoPlan {
  return prepararTransformacion(hoja, ids, entorno).planear(op);
}

/**
 * Lo que no depende de cuánto se mueve (zona, rígidos, orden, conflictos de
 * antes): el arrastre lo prepara una vez y planea cada punto de grilla con
 * `planear`. Vale mientras el documento no cambie.
 */
export interface Preparacion {
  /** Todos los cables que pueden cambiar. */
  readonly zona: ReadonlySet<string>;
  /** Los que se mueven enteros con la transformación. */
  readonly rigidos: ReadonlySet<string>;
  /** Cuántos de la zona no son rígidos (se acomodan: se rehacen o quedan igual). */
  readonly rehechos: number;
  /** Componentes que se transforman. */
  readonly movidos: ReadonlySet<string>;
  /** False si la operación no movería nada (cables seleccionados que siguen atados a lo que no se mueve). */
  readonly mueveAlgo: boolean;
  /** El aviso si no mueve nada; null si mueve algo. */
  readonly motivoNada: string | null;
  planear(op: Operacion): ResultadoPlan;
}

/** Prepara `planearTransformacion` para varias operaciones sobre los mismos ids y el mismo documento. */
export function prepararTransformacion(hoja: Hoja, ids: Iterable<string>, entorno: EntornoPlan): Preparacion {
  const { indice, consulta: base } = entorno;
  const comps: Componente[] = [];
  const seleccionados = new Set<string>();
  for (const id of new Set(ids)) {
    const c = indice.componentes.get(id);
    if (c) comps.push(c);
    else if (indice.cables.has(id)) seleccionados.add(id);
    else throw new Error(`No existe "${id}".`);
  }
  const movidos = new Set(comps.map((c) => c.id));

  const viejos = new Map<string, number[]>();
  const cableDe = (id: string): Cable => indice.cables.get(id)!;
  const recorrido = (id: string): number[] => {
    let p = viejos.get(id);
    if (!p) {
      const r = recorridoCable(indice, cableDe(id));
      if (!r) throw new Error(`El cable "${id}" apunta a algo que no está.`);
      p = r;
      viejos.set(id, p);
    }
    return p;
  };

  // Zona: lo que toca a lo movido y lo que se apoya en eso. Una pasada por los cables.
  const apoyados = new Map<string, string[]>();
  const zona = new Set<string>();
  for (const w of hoja.cables) {
    let directo = seleccionados.has(w.id);
    for (const e of [w.desde, w.hasta]) {
      if (e.tipo === "borne" && movidos.has(e.comp)) directo = true;
      else if (e.tipo === "cable") {
        const l = apoyados.get(e.cable);
        if (l) l.push(w.id);
        else apoyados.set(e.cable, [w.id]);
      }
    }
    if (directo) zona.add(w.id);
  }
  const cola = [...zona];
  while (cola.length > 0) {
    for (const d of apoyados.get(cola.pop()!) ?? []) {
      if (zona.has(d)) continue;
      zona.add(d);
      cola.push(d);
    }
  }

  // Rígidos: punto fijo máximo dentro de la zona.
  const rigidos = new Set(zona);
  const fijo = (w: Cable, e: Extremo): boolean =>
    e.tipo === "borne" ? !movidos.has(e.comp) : e.tipo === "libre" ? !seleccionados.has(w.id) : !rigidos.has(e.cable);
  const revisar = [...zona];
  while (revisar.length > 0) {
    const id = revisar.pop()!;
    if (!rigidos.has(id)) continue;
    const w = cableDe(id);
    if (!fijo(w, w.desde) && !fijo(w, w.hasta)) continue;
    rigidos.delete(id);
    for (const d of apoyados.get(id) ?? []) if (rigidos.has(d)) revisar.push(d);
  }

  // Para girar y espejar: la caja de lo que se transforma de lo seleccionado,
  // es decir, los componentes y los cables seleccionados que se mueven
  // rígidos. Uno seleccionado que no puede ser rígido se acomoda como uno no
  // seleccionado y tampoco corre el eje (si no, con K1 y sus dos cables
  // hasta S1, espejar llevaba K1 encima de S1). Si no se mueve nada, la de
  // todo lo seleccionado: no se usa, pero la transformación queda definida.
  const caja: CajaPuntos = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  {
    const k = caja;
    const sumar = (x: number, y: number) => {
      k.x0 = Math.min(k.x0, x);
      k.y0 = Math.min(k.y0, y);
      k.x1 = Math.max(k.x1, x);
      k.y1 = Math.max(k.y1, y);
    };
    const sumarCables = (ids: Iterable<string>) => {
      for (const id of ids) {
        const p = recorrido(id);
        for (let i = 0; i + 1 < p.length; i += 2) sumar(p[i]!, p[i + 1]!);
      }
    };
    for (const c of comps) sumar(c.x, c.y);
    sumarCables([...seleccionados].filter((id) => rigidos.has(id)));
    if (k.x0 === Infinity) sumarCables(seleccionados);
  }

  // Los que no son rígidos: orden topológico (anfitrión primero), con
  // desempate geométrico. Las componentes con ciclos van juntas.
  const resto: string[] = [];
  for (const w of hoja.cables) if (zona.has(w.id) && !rigidos.has(w.id)) resto.push(w.id);
  const enResto = new Set(resto);
  const anfitriones = (id: string): string[] => {
    const w = cableDe(id);
    const l: string[] = [];
    for (const e of [w.desde, w.hasta]) if (e.tipo === "cable" && enResto.has(e.cable) && !l.includes(e.cable)) l.push(e.cable);
    return l;
  };
  const sccs = componentesFuertes(resto, anfitriones);
  const sccDe = new Map<string, number>();
  sccs.forEach((s, i) => s.forEach((id) => sccDe.set(id, i)));
  const claveScc = sccs.map((s) => s.map((id) => claveGeometrica(recorrido(id))).sort(compararNumeros)[0]!);
  const pendientes = sccs.map(() => 0);
  const siguientes = sccs.map(() => new Set<number>());
  sccs.forEach((s, i) => {
    const hosts = new Set<number>();
    for (const id of s) for (const h of anfitriones(id)) if (sccDe.get(h) !== i) hosts.add(sccDe.get(h)!);
    pendientes[i] = hosts.size;
    for (const h of hosts) siguientes[h]!.add(i);
  });
  const orden: number[] = [];
  const listos = sccs.map((_, i) => i).filter((i) => pendientes[i] === 0);
  while (listos.length > 0) {
    listos.sort((a, b) => compararNumeros(claveScc[a]!, claveScc[b]!));
    const i = listos.shift()!;
    orden.push(i);
    for (const j of siguientes[i]!) if (--pendientes[j]! === 0) listos.push(j);
  }

  const viejasClaves = new Map<string, Set<string>>();
  /** Claves de los conflictos que el cable ya tenía antes de la operación. */
  const clavesViejas = (id: string): Set<string> => {
    let s = viejasClaves.get(id);
    if (!s) {
      const w = cableDe(id);
      s = new Set(
        problemasTrazado({ id, desde: w.desde, hasta: w.hasta, puntos: recorrido(id) }, consultaSinCable(base, id)).map((c) => c.clave),
      );
      viejasClaves.set(id, s);
    }
    return s;
  };
  const comoHoja = (id: string, c: CableCambiado | null): CableHoja => {
    if (c) return { id, puntos: c.puntos, desde: c.desde, hasta: c.hasta };
    const w = cableDe(id);
    return { id, puntos: recorrido(id), desde: w.desde, hasta: w.hasta };
  };

  // Conflictos de antes de lo rígido y lo movido contra lo que no se mueve con ellos.
  let antesFijos: ConsultaTrazado | null = null;
  const vieja = () =>
    (antesFijos ??= consultaSuperpuesta(base, {
      quitar: new Set<string>([...movidos, ...rigidos]),
    }));
  const viejasRigido = new Map<string, Set<string>>();
  const clavesViejasRigido = (id: string): Set<string> => {
    let s = viejasRigido.get(id);
    if (!s) {
      const w = cableDe(id);
      s = new Set(problemasTrazado({ id, desde: w.desde, hasta: w.hasta, puntos: recorrido(id) }, vieja()).map((k) => k.clave));
      viejasRigido.set(id, s);
    }
    return s;
  };
  const viejasComp = new Map<string, Set<string>>();
  const clavesViejasComp = (comp: Componente): Set<string> => {
    let s = viejasComp.get(comp.id);
    if (!s) {
      const g = geometriaComponente(comp);
      s = new Set(g ? problemasComponente(g, vieja()).map((k) => k.clave) : []);
      viejasComp.set(comp.id, s);
    }
    return s;
  };

  const mueveAlgo = movidos.size > 0 || rigidos.size > 0;
  const motivoNada = mueveAlgo ? null : seleccionados.size > 1 ? MENSAJE_NADA_SE_MUEVE_VARIOS : MENSAJE_NADA_SE_MUEVE_UNO;
  return { zona, rigidos, rehechos: resto.length, movidos, mueveAlgo, motivoNada, planear };

  function planear(op: Operacion): ResultadoPlan {
    const t = transformacionGrupo(op, op.tipo === "mover" ? null : caja);
    const poses = comps.map((c) => ({ id: c.id, pose: t.pose(c) }));
    const moverExtremo = (e: Extremo): Extremo => (e.tipo === "borne" ? { ...e } : { ...e, ...t.punto(e.x, e.y) });
    const finalesRigidos: CableCambiado[] = [];
    for (const w of hoja.cables) {
      if (!rigidos.has(w.id)) continue;
      const p = recorrido(w.id);
      const puntos: number[] = [];
      for (let i = 0; i + 1 < p.length; i += 2) {
        const q = t.punto(p[i]!, p[i + 1]!);
        puntos.push(q.x, q.y);
      }
      finalesRigidos.push({
        id: w.id,
        desde: moverExtremo(w.desde),
        hasta: moverExtremo(w.hasta),
        codos: codosDe(puntos),
        puntos,
      });
    }
    const rigidoPorId = new Map(finalesRigidos.map((c) => [c.id, c]));

    const resultado = (cables: CableCambiado[], rechazo: Rechazo | null): ResultadoPlan => {
      const antes = {
        componentes: comps.map((c) => ({ ...c, params: { ...c.params } })),
        cables: cables.map((c) => {
          const w = cableDe(c.id);
          return {
            id: w.id,
            desde: { ...w.desde },
            hasta: { ...w.hasta },
            codos: w.codos.map(([x, y]) => [x, y] as [number, number]),
          };
        }),
      };
      return {
        plan: { t, componentes: poses, cables, rigidos, zona, antes },
        rechazo,
      };
    };

    if (motivoNada) return resultado([], { motivo: motivoNada, conflictos: [] });

    const quitar = new Set<string>([...movidos, ...zona]);
    const transformados = { ids: new Set<string>([...movidos, ...rigidos]), t };
    /** Recorrido actual de un cable, según lo resuelto hasta ahora. */
    const puntosDe = (id: string, estado: ReadonlyMap<string, CableCambiado | null>): number[] =>
      rigidoPorId.get(id)?.puntos ?? estado.get(id)?.puntos ?? recorrido(id);

    /** Cómo queda cada extremo de un cable no rígido. `estado`: lo resuelto antes. */
    const movimientos = (id: string, estado: ReadonlyMap<string, CableCambiado | null>): { desde: Movimiento; hasta: Movimiento } => {
      const w = cableDe(id);
      const P = recorrido(id);
      const n = P.length;
      const uno = (e: Extremo, x: number, y: number, vx: number, vy: number): Movimiento => {
        const salida = direccionDe(vx - x, vy - y)!;
        if (e.tipo === "borne") {
          const comp = indice.componentes.get(e.comp)!;
          const b = borneDe(comp, e.borne)!;
          if (!movidos.has(e.comp))
            return {
              tipo: "fijo",
              ruta: extremoRutaBorne(x, y, b.direccion, salida),
              fresca: extremoRutaBorne(x, y, b.direccion, b.direccion),
            };
          const q = t.punto(x, y);
          const d = t.direccion(b.direccion);
          return {
            tipo: "movido",
            opciones: [
              {
                extremo: e,
                ruta: extremoRutaBorne(q.x, q.y, d, t.direccion(salida)),
                fresca: extremoRutaBorne(q.x, q.y, d, d),
              },
            ],
          };
        }
        if (e.tipo === "cable") {
          if (rigidos.has(e.cable)) {
            const q = t.punto(e.x, e.y);
            const ruta = { x: q.x, y: q.y };
            return {
              tipo: "movido",
              opciones: [{ extremo: { ...e, ...q }, ruta, fresca: ruta }],
            };
          }
          if (enResto.has(e.cable) && estado.get(e.cable)) {
            const Q = puntosDe(e.cable, estado);
            if (!puntoSobreRecorrido(Q, e.x, e.y)) {
              return {
                tipo: "movido",
                opciones: puntosParaT(Q, e.x, e.y).map((q) => {
                  const ruta = { x: q.x, y: q.y };
                  return { extremo: { ...e, x: q.x, y: q.y }, ruta, fresca: ruta };
                }),
              };
            }
          }
        }
        return { tipo: "fijo", ruta: { x, y }, fresca: { x, y } };
      };
      return {
        desde: uno(w.desde, P[0]!, P[1]!, P[2]!, P[3]!),
        hasta: uno(w.hasta, P[n - 2]!, P[n - 1]!, P[n - 4]!, P[n - 3]!),
      };
    };

    /** Acomoda un cable no rígido, eligiendo contra `consulta` (que no lo incluye). */
    const acomodar = (id: string, estado: ReadonlyMap<string, CableCambiado | null>, consulta: ConsultaTrazado): Acomodo => {
      const w = cableDe(id);
      const m = movimientos(id, estado);
      if (m.desde.tipo === "fijo" && m.hasta.tipo === "fijo") return { tipo: "igual" };
      /** El primer candidato que falló: sus conflictos y su recorrido, para mostrarlos. */
      const mejor: {
        valor: { conflictos: Conflicto[]; intento: CableCambiado } | null;
      } = { valor: null };
      let sinCandidatos: { x: number; y: number } | null = null;
      const probar = (desde: Extremo, hasta: Extremo, lista: Candidato[]): CableCambiado | null => {
        for (const c of lista) {
          const cable = {
            id,
            desde,
            hasta,
            codos: codosDe(c.puntos),
            puntos: c.puntos,
          };
          let nuevos = problemasTrazado({ id, desde, hasta, puntos: c.puntos }, consulta);
          if (nuevos.length > 0) {
            const viejas = clavesViejas(id);
            nuevos = nuevos.filter((k) => !viejas.has(k.clave));
          }
          if (nuevos.length === 0) return cable;
          mejor.valor ??= { conflictos: nuevos, intento: cable };
        }
        return null;
      };
      if (m.desde.tipo === "movido" && m.hasta.tipo === "movido") {
        for (const od of m.desde.opciones) {
          for (const oh of m.hasta.opciones) {
            const lista = candidatosEntero(od.ruta, oh.ruta);
            if (lista.length === 0) sinCandidatos ??= { x: oh.ruta.x, y: oh.ruta.y };
            const r = probar(od.extremo, oh.extremo, lista);
            if (r) return { tipo: "cambia", cable: r };
          }
        }
      } else {
        // Un solo extremo se mueve: se orienta del fijo (F) al movido.
        const alReves = m.desde.tipo === "movido";
        const fijoM = (alReves ? m.hasta : m.desde) as Extract<Movimiento, { tipo: "fijo" }>;
        const movidoM = (alReves ? m.desde : m.hasta) as Extract<Movimiento, { tipo: "movido" }>;
        const P = alReves ? invertir(recorrido(id)) : recorrido(id);
        const enSentido = (l: Candidato[]): Candidato[] => (alReves ? l.map((c) => ({ puntos: invertir(c.puntos), clave: c.clave })) : l);
        for (const o of movidoM.opciones) {
          const lista = enSentido(candidatosParcial(P, o.ruta, fijoM.ruta, o.ruta));
          const desde = alReves ? o.extremo : w.desde;
          const hasta = alReves ? w.hasta : o.extremo;
          // El mejor que conserva dibujo. El fresco gana solo con menos codos y
          // sin incumplir más salidas propias de los bornes (medidas igual en los dos).
          const r = probar({ ...desde }, { ...hasta }, lista);
          const [ini, fin] = alReves ? [o.fresca, fijoM.fresca] : [fijoM.fresca, o.fresca];
          const incumplidas = (p: readonly number[]): number => {
            const s = salidas(p);
            return incumpleSalida(s.inicio, ini) + incumpleSalida(s.fin, fin);
          };
          const tope = r ? { codos: contarCodos(r.puntos), incumplidas: incumplidas(r.puntos) } : null;
          // Si ningún fresco puede tener menos codos, no se arman (es lo que más cuesta).
          if (r && tope && minimoCodosFresco(ini, fin, tope.incumplidas === 0) >= tope.codos) return { tipo: "cambia", cable: r };
          // Fresco: lo que tendería W, con la dirección propia de cada borne.
          const frescos = enSentido(candidatosEntero(fijoM.fresca, o.fresca));
          if (lista.length === 0 && frescos.length === 0) sinCandidatos ??= { x: o.ruta.x, y: o.ruta.y };
          const f = probar(
            { ...desde },
            { ...hasta },
            tope ? frescos.filter((c) => contarCodos(c.puntos) < tope.codos && incumplidas(c.puntos) <= tope.incumplidas) : frescos,
          );
          if (f) return { tipo: "cambia", cable: f };
          if (r) return { tipo: "cambia", cable: r };
        }
      }
      if (mejor.valor)
        return {
          tipo: "falla",
          conflictos: mejor.valor.conflictos,
          intento: mejor.valor.intento,
        };
      const p = sinCandidatos ?? { x: recorrido(id)[0]!, y: recorrido(id)[1]! };
      return {
        tipo: "falla",
        conflictos: [
          {
            mensaje: MENSAJE_SIN_CAMINO,
            x: p.x,
            y: p.y,
            clave: `sinCamino|cable:${id}`,
          },
        ],
        intento: null,
      };
    };

    /** Una pasada por la zona no rígida, en orden. Con `previo`, es el reintento secuencial. */
    const resolver = (
      previo: ReadonlyMap<string, CableCambiado | null> | null,
    ): {
      estado: Map<string, CableCambiado | null>;
      falla: {
        id: string;
        conflictos: Conflicto[];
        intento: CableCambiado | null;
      } | null;
      ciclo: string[] | null;
    } => {
      const estado = new Map<string, CableCambiado | null>();
      for (const i of orden) {
        const s = sccs[i]!;
        if (s.length > 1) {
          // Un ciclo de apoyos: vale solo si no hay que tocar ninguno.
          const tocado = s.some((id) => {
            const m = movimientos(id, estado);
            return m.desde.tipo === "movido" || m.hasta.tipo === "movido";
          });
          if (tocado) return { estado, falla: null, ciclo: s };
          for (const id of s) estado.set(id, null);
          continue;
        }
        const id = s[0]!;
        const extras: CableHoja[] = [];
        if (previo) {
          for (const otro of resto) {
            if (otro === id) continue;
            extras.push(comoHoja(otro, estado.has(otro) ? estado.get(otro)! : (previo.get(otro) ?? null)));
          }
        } else {
          for (const h of anfitriones(id)) extras.push(comoHoja(h, estado.get(h) ?? null));
        }
        const consulta = consultaSuperpuesta(base, {
          quitar,
          transformados,
          cables: extras,
        });
        const r = acomodar(id, estado, consulta);
        if (r.tipo === "falla")
          return {
            estado,
            falla: { id, conflictos: r.conflictos, intento: r.intento },
            ciclo: null,
          };
        estado.set(id, r.tipo === "cambia" ? r.cable : null);
      }
      return { estado, falla: null, ciclo: null };
    };

    /** Lo que cambia: rígidos y rehechos, en el orden de la hoja. */
    const cambiados = (estado: ReadonlyMap<string, CableCambiado | null>, extra: CableCambiado | null = null): CableCambiado[] => {
      const l: CableCambiado[] = [];
      for (const w of hoja.cables) {
        const c = rigidoPorId.get(w.id) ?? (extra?.id === w.id ? extra : estado.get(w.id));
        if (c) l.push(c);
      }
      return l;
    };

    /** Conflictos nuevos de todo lo que cambia, contra el estado nuevo completo. */
    const verificar = (estado: ReadonlyMap<string, CableCambiado | null>): Conflicto[] => {
      const finales = resto.map((id) => comoHoja(id, estado.get(id) ?? null));
      const conflictos: Conflicto[] = [];
      // Cada rehecho ya se eligió contra todo lo que no es de la zona no
      // rígida: falta solo contra los otros de la zona (y sus anfitriones, para
      // saber si una T está unida).
      const vacia: ConsultaTrazado = {
        bornesEn: () => [],
        cuerposEn: () => [],
        cablesEn: () => [],
      };
      for (const id of resto) {
        const c = estado.get(id);
        if (!c) continue;
        const otros = finales.filter((f) => f.id !== id);
        for (const e of [c.desde, c.hasta]) {
          if (e.tipo !== "cable" || enResto.has(e.cable)) continue;
          const h = rigidoPorId.get(e.cable);
          otros.push(h ? comoHoja(e.cable, h) : comoHoja(e.cable, null));
        }
        const nuevos = problemasTrazado(
          { id, desde: c.desde, hasta: c.hasta, puntos: c.puntos },
          consultaSuperpuesta(vacia, { cables: otros }),
        );
        if (nuevos.length === 0) continue;
        const viejas = clavesViejas(id);
        for (const k of nuevos) if (!viejas.has(k.clave)) conflictos.push(k);
      }
      // Lo rígido y lo movido solo contra lo que no se mueve con ellos: un par
      // que se mueve junto no cambia.
      const fijos = consultaSuperpuesta(base, { quitar, cables: finales });
      for (const c of finalesRigidos) {
        const nuevos = problemasTrazado({ id: c.id, desde: c.desde, hasta: c.hasta, puntos: c.puntos }, fijos);
        if (nuevos.length === 0) continue;
        const viejas = clavesViejasRigido(c.id);
        for (const k of nuevos) if (!viejas.has(k.clave)) conflictos.push(k);
      }
      comps.forEach((comp, i) => {
        const g = geometriaComponente({ ...comp, ...poses[i]!.pose });
        if (!g) return;
        const nuevos = problemasComponente(g, fijos);
        if (nuevos.length === 0) return;
        const viejas = clavesViejasComp(comp);
        for (const k of nuevos) if (!viejas.has(k.clave)) conflictos.push(k);
      });
      return conflictos;
    };

    /** True si el conflicto es entre dos cables que se rehacen. */
    const entreRehechos = (c: Conflicto): boolean => {
      const [, a, b] = c.clave.split("|");
      if (!a || !b || a === b || !a.startsWith("cable:") || !b.startsWith("cable:")) return false;
      return enResto.has(a.slice(6)) && enResto.has(b.slice(6));
    };

    /**
     * Bornes de un componente transformado que caen sobre bornes de uno que
     * no se mueve (nuevos). No dependen de los cables: si hay, son la causa
     * de un rechazo antes que el cable que, por eso, no tiene por dónde ir.
     */
    const borneSobreBorne = (): Conflicto[] => {
      const l: Conflicto[] = [];
      let fijos: ConsultaTrazado | null = null;
      comps.forEach((comp, i) => {
        const g = geometriaComponente({ ...comp, ...poses[i]!.pose });
        if (!g) return;
        fijos ??= consultaSuperpuesta(base, { quitar });
        const viejas = clavesViejasComp(comp);
        for (const k of problemasComponente(g, fijos)) if (k.clave.startsWith("borneBorne|") && !viejas.has(k.clave)) l.push(k);
      });
      return l;
    };
    /** Un rechazo: el motivo de borne sobre borne va primero, si lo hay. */
    const rechazar = (cables: CableCambiado[], motivo: string, conflictos: Conflicto[]): ResultadoPlan => {
      const primero = borneSobreBorne();
      if (primero.length === 0) return resultado(cables, { motivo, conflictos });
      const claves = new Set(primero.map((k) => k.clave));
      return resultado(cables, {
        motivo: textoConflicto(op, primero[0]!),
        conflictos: [...primero, ...conflictos.filter((k) => !claves.has(k.clave))],
      });
    };
    const rechazarConflictos = (conflictos: Conflicto[], cables: CableCambiado[]): ResultadoPlan =>
      rechazar(cables, textoConflicto(op, conflictos[0]!), conflictos);

    let r = resolver(null);
    if (r.ciclo) {
      const conflictos = r.ciclo.map((id) => ({
        mensaje: MENSAJE_CICLO,
        x: recorrido(id)[0]!,
        y: recorrido(id)[1]!,
        clave: `ciclo|cable:${id}`,
      }));
      return rechazar(cambiados(r.estado), MENSAJE_CICLO, conflictos);
    }
    if (r.falla) return rechazarConflictos(r.falla.conflictos, cambiados(r.estado, r.falla.intento));
    let conflictos = verificar(r.estado);
    if (conflictos.length > 0 && conflictos.some(entreRehechos)) {
      const r2 = resolver(r.estado);
      if (r2.falla) return rechazarConflictos(r2.falla.conflictos, cambiados(r2.estado, r2.falla.intento));
      if (!r2.ciclo) {
        r = r2;
        conflictos = verificar(r.estado);
      }
    }
    if (conflictos.length > 0) return rechazarConflictos(conflictos, cambiados(r.estado));

    // Garantía: cada T de la zona queda sobre su anfitrión.
    for (const id of zona) {
      const c = rigidoPorId.get(id) ?? r.estado.get(id) ?? null;
      const w = cableDe(id);
      for (const e of c ? [c.desde, c.hasta] : [w.desde, w.hasta]) {
        if (e.tipo !== "cable") continue;
        if (!puntoSobreRecorrido(puntosDe(e.cable, r.estado), e.x, e.y)) {
          const p = recorrido(id);
          return rechazar(cambiados(r.estado), MENSAJE_NO_SE_ACOMODA, [
            {
              mensaje: MENSAJE_NO_SE_ACOMODA,
              x: p[0]!,
              y: p[1]!,
              clave: `noSeAcomoda|cable:${id}`,
            },
          ]);
        }
      }
    }
    return resultado(cambiados(r.estado), null);
  }
}
