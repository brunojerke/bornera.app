// Documento del banco de pruebas: los mismos componentes que la escena del
// banco (render/banco.ts), pero en un Documento, para abrirlo en un Editor y
// poder seleccionar, colocar y deshacer con 2000 símbolos (Ctrl+Shift+B).
//
// Se arma de cero, como al abrir un archivo: no es un cambio a un documento
// que ya existe, por eso no pasa por comandos (no hay nada que deshacer).

import { borneDe, indexarHoja, recorridoCable } from "../core/model/cables";
import { crearDocumento, generarId, PREFIJO_CABLE, type Cable, type Componente, type Documento, type Extremo, type Hoja } from "../core/model/documento";
import { codos, opuesta, type ExtremoRuta } from "../core/model/ruteo";
import {
  consultaHoja,
  consultaSuperpuesta,
  geometriaComponente,
  problemasTrazado,
  type BorneHoja,
  type CableHoja,
  type ConsultaTrazado,
  type CuerpoHoja,
} from "../core/model/trazado";
import { buscarSimbolo, type Direccion, type Rect } from "../core/symbols";
import { azar, generarBanco, PASO_BANCO } from "../render/banco";

export function documentoBanco(cantidad: number, semilla = 1): Documento {
  const doc = crearDocumento({ titulo: `Banco de ${cantidad}`, autor: "", fecha: "2026-01-01" });
  doc.hojas[0]!.componentes = generarBanco(cantidad, semilla).map((c) => ({
    id: generarId(doc),
    tipo: c.def.tipo,
    x: c.x,
    y: c.y,
    rot: c.rotacion,
    espejado: c.espejado,
    etiqueta: c.etiqueta ?? "",
    params: {},
  }));
  return doc;
}

/** Opciones de la escena con cables. */
export interface OpcionesBancoCables {
  /** Componentes más cercanos al centro que quedan sin cables. */
  centroSinCables: number;
  /** Derivaciones en T (cables que terminan sobre otro cable) que se agregan. */
  derivaciones: number;
  /**
   * Ancho, en pasos de la grilla del banco, del anillo vacío alrededor de los
   * ARRASTRADOS_BANCO del centro (0: sin anillo). Los componentes que caían
   * ahí se mudan a lugares libres lejos del centro: siguen siendo `cantidad`.
   */
  anillo: number;
  /** Cables que cruzan el anillo, de los del centro a los de afuera, tendidos como W. */
  cruces: number;
}

/**
 * La escena con cables desde T14a: los 40 del centro cableados, con un
 * anillo vacío alrededor (el grupo se puede arrastrar con sus cables) y 8
 * cables que lo cruzan; 30 derivaciones en T, con cadenas A ← B ← C (las del
 * grupo cuelgan de los cruces). Con más de 2 cruces el grupo no se puede
 * girar en su lugar: cada cruce da un cuarto de vuelta alrededor del grupo y
 * con hasta 2 codos no hay ruta que no lo atraviese (ver banco.test.ts).
 */
export const BANCO_CABLES: OpcionesBancoCables = { centroSinCables: 0, derivaciones: 30, anillo: 4, cruces: 8 };

/**
 * La escena con cables de T12 y T13 (40 del centro sin cables, sin T). Solo
 * para comparar el banco con mediciones anteriores (`npm run bench -- --escena-t12`).
 */
export const BANCO_CABLES_T12: OpcionesBancoCables = { centroSinCables: 40, derivaciones: 0, anillo: 0, cruces: 0 };

/** Pasos de grilla, por fuera del anillo, cuyos componentes no reciben cables del relleno de vecinos. */
const BANDA_LIMPIA = 2;

/** Arrastrados del banco y del diagnóstico: los más cercanos al centro. */
export const ARRASTRADOS_BANCO = 40;

/** Cables por componente en la escena con cables. */
export const CABLES_POR_COMPONENTE = 1.5;

const VECTOR: Record<Direccion, readonly [number, number]> = {
  derecha: [1, 0],
  izquierda: [-1, 0],
  abajo: [0, 1],
  arriba: [0, -1],
};

/** Lado de las celdas de `consultaGrilla`, en unidades de grilla (un paso del banco). */
const CELDA = PASO_BANCO;

/**
 * Consulta de trazado por grilla, para tender la escena como W sin recorrer
 * la hoja entera en cada prueba (con la consulta lineal, tender 3000 cables
 * es cuadrático). Cada elemento va en las celdas que toca su caja; una
 * consulta junta los de las celdas de la caja, sin repetir. Da candidatos de
 * más: la regla compara exacto (`ConsultaTrazado`). `agregar` suma un cable
 * recién tendido.
 */
function consultaGrilla(hoja: Hoja): { consulta: ConsultaTrazado; agregar(w: CableHoja): void } {
  const bornes = new Map<number, BorneHoja[]>();
  const cuerpos = new Map<number, CuerpoHoja[]>();
  const cables = new Map<number, CableHoja[]>();
  // Clave numérica de la celda (i, j): el banco no pasa de ±8192 celdas.
  const celdas = (k: Rect, f: (clave: number) => void) => {
    for (let i = Math.floor(k.x / CELDA); i <= Math.floor((k.x + k.ancho) / CELDA); i++)
      for (let j = Math.floor(k.y / CELDA); j <= Math.floor((k.y + k.alto) / CELDA); j++) f((i + 8192) * 16384 + (j + 8192));
  };
  const meter = <T>(m: Map<number, T[]>, k: Rect, v: T) =>
    celdas(k, (clave) => {
      const l = m.get(clave);
      if (l) l.push(v);
      else m.set(clave, [v]);
    });
  const juntar = <T>(m: Map<number, T[]>, k: Rect): T[] => {
    const s = new Set<T>();
    celdas(k, (clave) => {
      for (const v of m.get(clave) ?? []) s.add(v);
    });
    return [...s];
  };
  const agregar = (w: CableHoja) => {
    const p = w.puntos;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const x = Math.min(p[i]!, p[i + 2]!);
      const y = Math.min(p[i + 1]!, p[i + 3]!);
      meter(cables, { x, y, ancho: Math.abs(p[i + 2]! - p[i]!), alto: Math.abs(p[i + 3]! - p[i + 1]!) }, w);
    }
  };
  for (const c of hoja.componentes) {
    const g = geometriaComponente(c);
    if (!g) continue;
    meter(cuerpos, g.cuerpo.caja, g.cuerpo);
    for (const b of g.bornes) meter(bornes, { x: b.x, y: b.y, ancho: 0, alto: 0 }, b);
  }
  const indice = indexarHoja(hoja);
  for (const w of hoja.cables) {
    const puntos = recorridoCable(indice, w);
    if (puntos) agregar({ id: w.id, puntos, desde: w.desde, hasta: w.hasta });
  }
  return {
    consulta: {
      bornesEn: (k) => juntar(bornes, k).filter((b) => b.x >= k.x && b.x <= k.x + k.ancho && b.y >= k.y && b.y <= k.y + k.alto),
      cuerposEn: (k) => juntar(cuerpos, k),
      cablesEn: (k) => juntar(cables, k),
    },
    agregar,
  };
}

/** Centro de la caja de posiciones de los componentes (el del banco). */
function centroPosiciones(comps: readonly Componente[]): { cx: number; cy: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of comps) {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x);
    y1 = Math.max(y1, c.y);
  }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Los `n` componentes más cercanos al centro de las posiciones (desempate por orden en la hoja). */
function masCercanos(comps: readonly Componente[], n: number): Componente[] {
  const { cx, cy } = centroPosiciones(comps);
  const d = (c: Componente) => (c.x - cx) ** 2 + (c.y - cy) ** 2;
  return comps
    .map((c, i) => ({ c, i }))
    .sort((a, b) => d(a.c) - d(b.c) || a.i - b.i)
    .slice(0, n)
    .map((x) => x.c);
}

/**
 * Los ids del grupo del centro de la escena con cables: los ARRASTRADOS_BANCO
 * más cercanos al centro, con el anillo vacío alrededor. Es lo que arrastran
 * y giran el banco y la prueba del menú de desarrollo.
 */
export function grupoCentralBanco(doc: Documento): string[] {
  return masCercanos(doc.hojas[0]!.componentes, ARRASTRADOS_BANCO).map((c) => c.id);
}

/**
 * Vacía un anillo de `pasos` pasos de grilla alrededor de `grupo`: los
 * componentes que caen ahí se mudan a las posiciones libres de la grilla más
 * lejanas del centro (sin salir de la caja, así el centro no cambia).
 * Devuelve el radio de afuera del anillo.
 */
function vaciarAnillo(comps: Componente[], grupo: ReadonlySet<string>, pasos: number): number {
  const { cx, cy } = centroPosiciones(comps);
  const d = (x: number, y: number) => Math.hypot(x - cx, y - cy);
  let radio = 0;
  for (const c of comps) if (grupo.has(c.id)) radio = Math.max(radio, d(c.x, c.y));
  // En una escena chica puede no haber lugar: el anillo se achica hasta que entre.
  for (; pasos > 0; pasos--) if (lugarParaAnillo(comps, grupo, radio + pasos * PASO_BANCO, cx, cy)) break;
  if (pasos === 0) return radio;
  const limite = radio + pasos * PASO_BANCO;
  const ocupadas = new Set(comps.map((c) => `${c.x},${c.y}`));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of comps) {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x);
    y1 = Math.max(y1, c.y);
  }
  const libres: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y += PASO_BANCO)
    for (let x = x0; x <= x1; x += PASO_BANCO) if (!ocupadas.has(`${x},${y}`) && d(x, y) > limite + PASO_BANCO) libres.push({ x, y });
  libres.sort((a, b) => d(b.x, b.y) - d(a.x, a.y) || a.y - b.y || a.x - b.x);
  let i = 0;
  for (const c of comps) {
    if (grupo.has(c.id) || d(c.x, c.y) > limite) continue;
    const l = libres[i++];
    if (!l) throw new Error("El banco no tiene lugar para vaciar el anillo.");
    c.x = l.x;
    c.y = l.y;
  }
  return limite;
}

/** True si hay posiciones libres para mudar a todos los que caen dentro de `limite`. */
function lugarParaAnillo(comps: readonly Componente[], grupo: ReadonlySet<string>, limite: number, cx: number, cy: number): boolean {
  const d = (x: number, y: number) => Math.hypot(x - cx, y - cy);
  const ocupadas = new Set(comps.map((c) => `${c.x},${c.y}`));
  const xs = comps.map((c) => c.x);
  const ys = comps.map((c) => c.y);
  let libres = 0;
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += PASO_BANCO)
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += PASO_BANCO) if (!ocupadas.has(`${x},${y}`) && d(x, y) > limite + PASO_BANCO) libres++;
  let mudar = 0;
  for (const c of comps) if (!grupo.has(c.id) && d(c.x, c.y) <= limite) mudar++;
  return libres >= mudar;
}

/** Cómo sale un cable de un borne en el ruteo de W: prefiere su dirección y no entra al cuerpo. */
function rutaBorne(c: Componente, nombre: string): ExtremoRuta {
  const b = borneDe(c, nombre)!;
  return { x: b.x, y: b.y, preferidas: [b.direccion], prohibidas: [opuesta(b.direccion)] };
}

/**
 * Tiende cables como la herramienta W: ruteo de T13 (`codos`) y
 * `problemasTrazado` contra todo lo que ya está (sin conexiones aparentes ni
 * entradas por el cuerpo). La consulta por grilla se arma una vez y cada
 * cable tendido se le suma.
 */
function tendedorW(doc: Documento) {
  const hoja = doc.hojas[0]!;
  const { consulta, agregar } = consultaGrilla(hoja);
  const nombres = (c: Componente) => (buscarSimbolo(c.tipo)?.bornes ?? []).map((b) => b.nombre);
  return {
    /**
     * Prueba los pares de bornes de `a` y `b` y tiende el primero que vale;
     * false si ninguno. En orden desde `inicio` o, con `enfrentados`, primero
     * los bornes que se miran (así la ruta va derecho de uno al otro). Con
     * `usados`, saltea los pares que ya tienen un cable y anota el nuevo (un
     * borne puede tener varios cables, pero no el mismo par dos veces).
     */
    tender(a: Componente, b: Componente, inicio = 0, enfrentados = false, usados?: Set<string>): boolean {
      const na = nombres(a);
      const nb = nombres(b);
      const total = na.length * nb.length;
      const mira = (c: Componente, nombre: string, x: number, y: number) => {
        const q = borneDe(c, nombre)!;
        const [vx, vy] = VECTOR[q.direccion];
        return vx * (x - q.x) + vy * (y - q.y);
      };
      const orden = Array.from({ length: total }, (_, i) => (i + inicio) % total);
      if (enfrentados) {
        const puntaje = (k: number) => mira(a, na[Math.floor(k / nb.length)]!, b.x, b.y) + mira(b, nb[k % nb.length]!, a.x, a.y);
        orden.sort((x, y) => puntaje(y) - puntaje(x) || x - y);
      }
      for (const k of orden) {
        const desde: Extremo = { tipo: "borne", comp: a.id, borne: na[Math.floor(k / nb.length)]! };
        const hasta: Extremo = { tipo: "borne", comp: b.id, borne: nb[k % nb.length]! };
        const par = `${a.id}.${desde.borne}-${b.id}.${hasta.borne}`;
        if (usados?.has(par)) continue;
        const r0 = rutaBorne(a, desde.borne);
        const r1 = rutaBorne(b, hasta.borne);
        const cs = codos(r0, r1, (c) => problemasTrazado({ desde, hasta, puntos: [r0.x, r0.y, ...c.flat(), r1.x, r1.y] }, consulta).length === 0);
        if (!cs) continue;
        usados?.add(par);
        const id = generarId(doc, PREFIJO_CABLE);
        hoja.cables.push({ id, desde, hasta, codos: cs });
        agregar({ id, desde, hasta, puntos: [r0.x, r0.y, ...cs.flat(), r1.x, r1.y] });
        return true;
      }
      return false;
    },
  };
}

/**
 * Los cables del grupo del centro, tendidos con `w` como el resto del banco.
 * Primero los internos (entre vecinos del grupo), después los que cruzan el
 * anillo: de los del grupo (los de más afuera primero) a sus vecinos de
 * afuera más cercanos, hasta `cruces`. Devuelve los componentes de afuera que
 * recibieron un cruce.
 */
function cablearGrupo(doc: Documento, w: ReturnType<typeof tendedorW>, grupo: readonly Componente[], cruces: number, rnd: () => number): Set<string> {
  const hoja = doc.hojas[0]!;
  const { cx, cy } = centroPosiciones(hoja.componentes);
  const enGrupo = new Set(grupo.map((c) => c.id));
  const enPos = new Map(grupo.map((c) => [`${c.x},${c.y}`, c]));
  for (const a of grupo)
    for (const [dx, dy] of [
      [PASO_BANCO, 0],
      [0, PASO_BANCO],
    ] as const) {
      const b = enPos.get(`${a.x + dx},${a.y + dy}`);
      if (b) w.tender(a, b, Math.floor(rnd() * 4));
    }
  // Ninguno del grupo sin cables: el que quedó solo prueba con los otros, del más cercano al más lejano.
  const conCable = () => new Set(hoja.cables.flatMap((c) => [c.desde, c.hasta]).flatMap((e) => (e.tipo === "borne" ? [e.comp] : [])));
  let cableados = conCable();
  for (const a of grupo) {
    if (cableados.has(a.id)) continue;
    const otros = grupo.filter((b) => b !== a).sort((b, c) => Math.hypot(b.x - a.x, b.y - a.y) - Math.hypot(c.x - a.x, c.y - a.y));
    for (const b of otros) if (w.tender(a, b)) break;
    cableados = conCable();
  }
  const afuera = hoja.componentes.filter((c) => !enGrupo.has(c.id));
  const d = (c: Componente) => Math.hypot(c.x - cx, c.y - cy);
  const destinos = new Set<string>();
  let n = 0;
  // Dos vueltas: en la segunda, cada uno del grupo prueba con su segundo vecino de afuera.
  for (let vuelta = 0; vuelta < 2 && n < cruces; vuelta++)
    for (const g of [...grupo].sort((a, b) => d(b) - d(a))) {
      if (n >= cruces) break;
      const o = [...afuera].filter((c) => !destinos.has(c.id)).sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y))[0];
      if (!o || !w.tender(g, o, 0, true)) continue;
      destinos.add(o.id);
      n++;
    }
  return destinos;
}

/** Pasadas del relleno de vecinos: en cada una, cada par de vecinos prueba otro par de bornes. */
const PASADAS_VECINOS = 6;

/**
 * El documento del banco con cables: CABLES_POR_COMPONENTE × `cantidad`
 * cables, todos tendidos como W (`codosBanco`, 2026-11-22: sin conexiones
 * aparentes ni cables que entran a un borne por el cuerpo). Con
 * `opciones.anillo`, el grupo del centro queda con un anillo vacío alrededor
 * y `opciones.cruces` cables lo cruzan; el resto, entre bornes de
 * componentes vecinos (a la derecha y abajo), hasta PASADAS_VECINOS pasadas
 * (un par de vecinos sin ruta se saltea). Después, las derivaciones en T de
 * `opciones` (ver `derivar`). Mismo azar con la misma semilla.
 */
export function documentoBancoCables(cantidad: number, semilla = 1, opciones: OpcionesBancoCables = BANCO_CABLES): Documento {
  const doc = documentoBanco(cantidad, semilla);
  doc.meta.titulo = `Banco de ${cantidad} con cables`;
  const hoja = doc.hojas[0]!;
  const comps = hoja.componentes;
  const rnd = azar(semilla + 1);
  const grupo = masCercanos(comps, ARRASTRADOS_BANCO);
  const limite = opciones.anillo > 0 ? vaciarAnillo(comps, new Set(grupo.map((c) => c.id)), opciones.anillo) : 0;
  const clave = (x: number, y: number) => `${x},${y}`;
  const enPos = new Map<string, Componente>();
  for (const c of comps) enPos.set(clave(c.x, c.y), c);
  const { cx, cy } = centroPosiciones(comps);
  // Sin cables del relleno de vecinos: los del centro que quedan sin cables y,
  // con anillo, el grupo y los de afuera que reciben un cruce (sus cables van como W).
  const sinCables = new Set(masCercanos(comps, opciones.centroSinCables).map((c) => c.id));

  const objetivo = Math.round(cantidad * CABLES_POR_COMPONENTE);
  const cantidadBornes = (c: Componente) => buscarSimbolo(c.tipo)?.bornes.length ?? 0;
  const w = tendedorW(doc);
  const usados = new Set<string>();
  /** Cables entre vecinos de la grilla hasta llegar a `hasta`; en cada pasada, cada par prueba sus pares de bornes desde uno al azar. */
  const vecinos = (hasta: number) => {
    for (let pasada = 0; pasada < PASADAS_VECINOS; pasada++) for (const a of comps) {
      if (hoja.cables.length >= hasta) return;
      if (sinCables.has(a.id)) continue;
      for (const [dx, dy] of [[PASO_BANCO, 0], [0, PASO_BANCO]] as const) {
        if (hoja.cables.length >= hasta) return;
        const b = enPos.get(clave(a.x + dx, a.y + dy));
        if (!b || sinCables.has(b.id)) continue;
        const total = cantidadBornes(a) * cantidadBornes(b);
        if (total === 0) continue;
        w.tender(a, b, Math.floor(rnd() * total), false, usados);
      }
    }
  };
  const enGrupo = new Set(grupo.map((c) => c.id));
  if (opciones.anillo > 0) {
    for (const id of cablearGrupo(doc, w, grupo, opciones.cruces, rnd)) sinCables.add(id);
    for (const id of enGrupo) sinCables.add(id);
    // Banda limpia: los de la franja de afuera del anillo tampoco reciben
    // cables del relleno, así los cruces se acomodan sin chocar con cables
    // que entran por el cuerpo.
    for (const c of comps) if (Math.hypot(c.x - cx, c.y - cy) <= limite + BANDA_LIMPIA * PASO_BANCO) sinCables.add(c.id);
  }
  vecinos(objetivo);
  if (opciones.derivaciones > 0) derivar(doc, cx, cy, enGrupo, opciones.derivaciones, opciones.anillo > 0);
  return doc;
}

/** Largo de una derivación que lleva otra encima (tiene puntos adentro) y de una suelta. */
const LARGO_CON_OTRA = 4;
const LARGO_SUELTA = 3;

/**
 * Agrega `cantidad` derivaciones en T, cada una un tramo recto que sale de un
 * punto de adentro de un cable y termina libre: un tercio en cadenas A ← B ←
 * C (C sobre B) y el resto sueltas. Los anfitriones son primero los cables
 * de los componentes de `centro` (al arrastrarlos se corre la T) y después
 * los más cercanos al centro. Cada una se valida con `problemasTrazado`
 * contra la hoja como está: sin conexiones aparentes.
 */
function derivar(doc: Documento, cx: number, cy: number, centro: ReadonlySet<string>, cantidad: number, soloCruces = false): void {
  const hoja = doc.hojas[0]!;
  const indice = indexarHoja(hoja);
  const base = consultaHoja(hoja, indice);
  /** Las derivaciones ya puestas, encima de la hoja de antes (sin reindexar). */
  const agregadas: CableHoja[] = [];
  let consulta = base;
  const enCentro = (w: Cable) => [w.desde, w.hasta].filter((e) => e.tipo === "borne" && centro.has(e.comp)).length;
  // Con anillo, las del grupo cuelgan de los cruces (un extremo en el grupo):
  // una T sobre un interno quedaría con su extremo libre adentro del grupo.
  const delCentro = (w: Cable) => (soloCruces ? enCentro(w) === 1 : enCentro(w) > 0);
  const distancia = (w: Cable) => {
    const p = recorridoCable(indice, w)!;
    return (p[0]! - cx) ** 2 + (p[1]! - cy) ** 2;
  };
  const anfitriones = hoja.cables
    .filter((w) => !soloCruces || enCentro(w) < 2)
    .map((w) => ({ w, centro: delCentro(w), d: distancia(w) }))
    .sort((a, b) => Number(b.centro) - Number(a.centro) || a.d - b.d)
    .map((x) => x.w);

  /**
   * Una T recta de `largo` sobre un punto de adentro de `anfitrion`; null si
   * no hay lugar. Con `desdeElFinal` (los cruces, que van del grupo hacia
   * afuera), empieza por el tramo de afuera y por su punta: lejos de por
   * donde se mueve el grupo.
   */
  const derivacion = (anfitrion: Cable | CableHoja, largo: number, desdeElFinal = false): CableHoja | null => {
    const P = "puntos" in anfitrion ? anfitrion.puntos : recorridoCable(indice, anfitrion)!;
    const tramos = Array.from({ length: P.length / 2 - 1 }, (_, i) => 2 * i);
    if (desdeElFinal) tramos.reverse();
    for (const i of tramos) {
      const [ax, ay, bx, by] = [P[i]!, P[i + 1]!, P[i + 2]!, P[i + 3]!];
      const n = Math.abs(bx - ax) + Math.abs(by - ay);
      if (n < 4) continue;
      const ux = Math.sign(bx - ax);
      const uy = Math.sign(by - ay);
      // Del medio hacia afuera (o desde la punta de afuera), sin las puntas del tramo.
      const medio = Math.floor(n / 2);
      for (let k = 0; k < n - 1; k++) {
        const t = desdeElFinal ? n - 2 - k : medio + (k % 2 === 0 ? k / 2 : -(k + 1) / 2);
        if (t <= 0 || t >= n) continue;
        const px = ax + ux * t;
        const py = ay + uy * t;
        for (const s of [1, -1]) {
          const qx = px - uy * s * largo;
          const qy = py + ux * s * largo;
          const nuevo = {
            desde: { tipo: "cable" as const, cable: anfitrion.id, x: px, y: py },
            hasta: { tipo: "libre" as const, x: qx, y: qy },
            puntos: [px, py, qx, qy],
          };
          if (problemasTrazado(nuevo, consulta).length > 0) continue;
          const id = generarId(doc, PREFIJO_CABLE);
          hoja.cables.push({ id, desde: nuevo.desde, hasta: nuevo.hasta, codos: [] });
          const w: CableHoja = { id, ...nuevo };
          agregadas.push(w);
          consulta = consultaSuperpuesta(base, { cables: agregadas });
          return w;
        }
      }
    }
    return null;
  };

  const cadenas = Math.floor(cantidad / 3);
  let hechas = 0;
  let enCadena = 0;
  for (const a of anfitriones) {
    if (hechas >= cantidad) break;
    const cruce = soloCruces && enCentro(a) === 1;
    if (enCadena < cadenas && hechas + 2 <= cantidad) {
      const b = derivacion(a, LARGO_CON_OTRA, cruce);
      if (!b) continue;
      hechas++;
      if (derivacion(b, LARGO_SUELTA)) {
        hechas++;
        enCadena++;
      }
    } else if (derivacion(a, LARGO_SUELTA, cruce)) {
      hechas++;
    }
  }
}
