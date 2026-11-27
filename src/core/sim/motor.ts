// Motor de simulación (T30, fase 5): pulsar y soltar sobre la netlist de T28,
// hasta que las bobinas quedan quietas. Criterio en docs/plan-T30.md y
// docs/plan-fase5.md (sección 2, D2-B, D3-A, D4-A, D10-A).
//
// - Protecciones y seccionador (T36, D17-A): polos NA siempre cerrados.
// - Estado: pulsadores apretados y bobinas con tensión, una por etiqueta, en
//   el orden de `netlist.bobinas` (natural: K2 antes que K10). No es
//   documento: sin Comandos ni historial; el documento no cambia.
// - Recálculo (M3-A), de cero en cada iteración: los contactos que conducen
//   unen sus redes (union-find); cada grupo toma los potenciales de sus redes;
//   una carga se enciende con un potencial en cada borne, distintos y al menos
//   uno fase. Un grupo con dos potenciales o más es un corto.
// - Iteración (D2-B): de las bobinas que tienen que cambiar, cambia la de
//   etiqueta menor. Si al recalcular otra de esa lista ya no tiene que cambiar,
//   el resultado dependía del orden: «Carrera entre K1 y K2».
// - Se detiene (D3-A) por corto (en el estado en que aparece, M2-A), por un
//   estado de bobinas repetido (oscila) o al llegar al tope de cambios sin
//   repetir (2 × bobinas + 50, «No se estabilizó en N pasos»). Detenido,
//   pulsar y soltar no hacen nada hasta salir.
// - Cargas en serie (M1-B), en cada estado estable.
// - Carrera y cargas en serie avisan una vez por par o por grupo en cada
//   entrada a Simular; las detenciones, una vez (después no se recalcula).
// - Electroválvulas (T40, D-B5 A): `posiciones`, una por válvula de la
//   netlist (true: accionada, en 14). La monoestable sigue a su carga. La
//   biestable queda en la última bobina con tensión: con A1-A2 sola pasa a 14
//   y con B1-B2 sola a 12; sin ninguna queda donde estaba, y con las dos
//   también, con el aviso «Y1 con las dos bobinas» (D-T40-4 A). Solo se toma
//   de un estado estable: detenida (oscila, tope o corto) queda la última
//   estable (ajuste 2 de Bruno). Cada entrada arranca en 12 (D-T40-3 A). No
//   mueve contactos: no entra en el estado de bobinas ni en la iteración.
//
// No lee el reloj: el límite es la cantidad de cambios. Sin DOM.

import type { Hoja } from "../model/documento";
import { listaY, validar, type Aviso } from "../model/validaciones";
import { armarNetlist, type Netlist } from "./netlist";

/** Un aviso de la simulación. Las etiquetas van normalizadas. */
export type AvisoSim =
  /** `etiquetas`: la bobina que cambió y la que dejó de cambiar, en ese orden. */
  | { readonly tipo: "carrera"; readonly etiquetas: readonly [string, string] }
  /** `cargas`: los componentes, en el orden de la netlist; `etiquetas`, las suyas. */
  | { readonly tipo: "serie"; readonly cargas: readonly string[]; readonly etiquetas: readonly string[] }
  /** `etiquetas`: las bobinas que cambian en el ciclo, en orden natural. */
  | { readonly tipo: "oscila"; readonly etiquetas: readonly string[] }
  | { readonly tipo: "tope"; readonly pasos: number }
  /** Electroválvula biestable con las dos bobinas con tensión (T40, D-B5 A); `etiqueta` normalizada, "" sin etiqueta. */
  | { readonly tipo: "dos_bobinas"; readonly comp: string; readonly etiqueta: string }
  /** `redes`: índices en `netlist.redes`; `potenciales`: en `netlist.potenciales`; `nombres`: los suyos, como se muestran. */
  | { readonly tipo: "corto"; readonly redes: readonly number[]; readonly potenciales: readonly number[]; readonly nombres: readonly string[] };

/** Por qué se detuvo: el aviso de la detención. */
export type Detencion = Extract<AvisoSim, { tipo: "oscila" | "tope" | "corto" }>;

export interface Simulacion {
  readonly netlist: Netlist;
  /** Cambios de bobina permitidos en cada recálculo. */
  readonly tope: number;
  /** Ids de los pulsadores apretados (un clic acciona todos sus polos). */
  readonly pulsados: ReadonlySet<string>;
  /** Por bobina de `netlist.bobinas`. */
  readonly tension: readonly boolean[];
  /** Por polo de `netlist.contactos`. */
  readonly conducen: readonly boolean[];
  /** Por carga de `netlist.cargas`. */
  readonly encendidas: readonly boolean[];
  /** Por válvula de `netlist.valvulas` (T40): accionada (en 14). */
  readonly posiciones: readonly boolean[];
  /** Por red de `netlist.redes`: índice en `netlist.potenciales`, o null sin potencial o en corto. */
  readonly potencialDeRed: readonly (number | null)[];
  readonly detenida: Detencion | null;
  /** Todos los de esta entrada a Simular, sin repetir, en el orden en que salieron. */
  readonly avisos: readonly AvisoSim[];
  /** Los que sumó la última operación (entrar, pulsar o soltar). */
  readonly nuevos: readonly AvisoSim[];
  /** Claves de los avisos ya dados (interno). */
  readonly vistos: ReadonlySet<string>;
}

/** Lo que no cambia en toda la entrada: armado una vez por netlist. */
interface Pre {
  /** Por red: índice del potencial, -1 sin potencial, -2 con dos o más. */
  potRed: Int32Array;
  /** Por potencial: es fase. */
  esFase: boolean[];
  /** Por contacto: 0 a mano (pulsado), 1 por bobina (`bobinaDe`), 2 en reposo, 3 cerrado (protección, T36). */
  modo: Int8Array;
  /** Por contacto con modo 1: índice en `netlist.bobinas`. */
  bobinaDe: Int32Array;
  /** Ids de los contactos a mano. */
  pulsables: Set<string>;
  /** Ids de los contactos a mano enclavados (selector y seta, T36): un clic acciona y otro libera. */
  enclavados: Set<string>;
  /** Por carga: índice de su bobina en `netlist.bobinas`, o -1. */
  cargaBobina: Int32Array;
  /** Por red: las cargas con un borne en ella (repetida si tiene los dos), en el orden de `netlist.cargas`. */
  cargasEnRed: number[][];
  /** Por red: los polos con un borne en ella (repetido si tiene los dos). */
  contactosEnRed: number[][];
  /** Por red: bornes que no son de cargas ni de contactos. */
  otrosEnRed: Int32Array;
}

const CACHE = new WeakMap<Netlist, Pre>();

function preparar(n: Netlist): Pre {
  const hecho = CACHE.get(n);
  if (hecho) return hecho;
  const R = n.redes.length;
  const potRed = new Int32Array(R);
  n.redes.forEach((r, i) => (potRed[i] = r.potenciales.length === 0 ? -1 : r.potenciales.length === 1 ? r.potenciales[0]! : -2));
  const esFase = n.potenciales.map((p) => p.papel === "fase");

  const indiceBobina = new Map(n.bobinas.map((b, i) => [b.etiqueta, i]));
  const modo = new Int8Array(n.contactos.length);
  const bobinaDe = new Int32Array(n.contactos.length).fill(-1);
  const pulsables = new Set<string>();
  const enclavados = new Set<string>();
  n.contactos.forEach((c, i) => {
    if (c.accionamiento === "manual_momentaneo" || c.accionamiento === "manual_enclavado") {
      modo[i] = 0;
      pulsables.add(c.comp);
      if (c.accionamiento === "manual_enclavado") enclavados.add(c.comp);
    } else if (c.accionamiento === null) {
      modo[i] = 3; // protección o seccionador: cerrado en 6a (T36, D17-A)
    } else if (c.accionamiento === "bobina" && indiceBobina.has(c.etiqueta)) {
      modo[i] = 1;
      bobinaDe[i] = indiceBobina.get(c.etiqueta)!;
    } else {
      modo[i] = 2; // sin bobina de su etiqueta, o térmico: en reposo
    }
  });

  const cargaBobina = new Int32Array(n.cargas.length).fill(-1);
  n.bobinas.forEach((b, g) => b.cargas.forEach((k) => (cargaBobina[k] = g)));

  // Por los extremos de cada polo y de cada carga (T34): un componente puede
  // tener varios polos, así que no se busca por componente. Cada extremo es
  // un borne; los que sobran en la red son de otros (fuentes, desconocidos…).
  const cargasEnRed: number[][] = Array.from({ length: R }, () => []);
  const contactosEnRed: number[][] = Array.from({ length: R }, () => []);
  const otrosEnRed = new Int32Array(R);
  n.redes.forEach((r, i) => (otrosEnRed[i] = r.bornes.length));
  n.cargas.forEach((k, i) => {
    cargasEnRed[k.a]!.push(i);
    cargasEnRed[k.b]!.push(i);
    // Por borne: el BN del sensor (T40) es de la carga y del polo, y ya se restó con el polo.
    if (!k.enPolo[0]) otrosEnRed[k.a]!--;
    if (!k.enPolo[1]) otrosEnRed[k.b]!--;
  });
  n.contactos.forEach((c, i) => {
    contactosEnRed[c.a]!.push(i);
    contactosEnRed[c.b]!.push(i);
    otrosEnRed[c.a]!--;
    otrosEnRed[c.b]!--;
  });

  const pre: Pre = { potRed, esFase, modo, bobinaDe, pulsables, enclavados, cargaBobina, cargasEnRed, contactosEnRed, otrosEnRed };
  CACHE.set(n, pre);
  return pre;
}

/** Un recálculo: pasos 1 a 3 de la sección 2, con las bobinas quietas. */
interface Calculo {
  conducen: boolean[];
  /** Por red: la raíz de su grupo. */
  raiz: Int32Array;
  /** Por raíz: índice del potencial, -1 sin potencial, -2 con dos o más. */
  potG: Int32Array;
  encendidas: boolean[];
  /** Por bobina: alguna de sus cargas encendida. */
  deseado: boolean[];
  corto: boolean;
}

function calcular(n: Netlist, pre: Pre, pulsados: ReadonlySet<string>, tension: readonly boolean[]): Calculo {
  const R = n.redes.length;
  const padre = new Int32Array(R);
  for (let i = 0; i < R; i++) padre[i] = i;
  const buscar = (i: number): number => {
    while (padre[i] !== i) {
      padre[i] = padre[padre[i]!]!;
      i = padre[i]!;
    }
    return i;
  };

  const conducen = n.contactos.map((c, i) => {
    const m = pre.modo[i]!;
    const activo = m === 0 ? pulsados.has(c.comp) : m === 1 ? tension[pre.bobinaDe[i]!]! : m === 3;
    const conduce = c.na ? activo : !activo;
    if (conduce) {
      const ra = buscar(c.a);
      const rb = buscar(c.b);
      if (ra !== rb) padre[Math.max(ra, rb)] = Math.min(ra, rb);
    }
    return conduce;
  });

  const raiz = new Int32Array(R);
  const potG = new Int32Array(R).fill(-1);
  let corto = false;
  for (let i = 0; i < R; i++) {
    const r = buscar(i);
    raiz[i] = r;
    const p = pre.potRed[i]!;
    const g = potG[r]!;
    if (p === -1 || g === p || g === -2) continue;
    if (g === -1 && p >= 0) potG[r] = p;
    else {
      potG[r] = -2;
      corto = true;
    }
  }

  const deseado = n.bobinas.map(() => false);
  const encendidas = n.cargas.map((k, i) => {
    const pa = potG[raiz[k.a]!]!;
    const pb = potG[raiz[k.b]!]!;
    const on = pa >= 0 && pb >= 0 && pa !== pb && (pre.esFase[pa]! || pre.esFase[pb]!);
    const g = pre.cargaBobina[i]!;
    if (on && g >= 0) deseado[g] = true;
    return on;
  });

  return { conducen, raiz, potG, encendidas, deseado, corto };
}

function avisoCorto(n: Netlist, calc: Calculo): Detencion {
  const redes: number[] = [];
  const pots = new Set<number>();
  for (let i = 0; i < n.redes.length; i++) {
    if (calc.potG[calc.raiz[i]!] !== -2) continue;
    redes.push(i);
    for (const p of n.redes[i]!.potenciales) pots.add(p);
  }
  const potenciales = [...pots].sort((a, b) => a - b);
  return { tipo: "corto", redes, potenciales, nombres: nombresPotenciales(n, potenciales) };
}

/** Nombres para mostrar: solo el nombre; con el papel delante si dos se llaman igual (Fase «N» y Neutro «N»). */
function nombresPotenciales(n: Netlist, indices: readonly number[]): string[] {
  const ps = indices.map((i) => n.potenciales[i]!);
  return ps.map((p) => (ps.filter((q) => q.nombre === p.nombre).length > 1 ? `${p.papel === "fase" ? "Fase" : "Neutro"} ${p.nombre}` : p.nombre));
}

/** Cargas en serie (M1-B) en un estado estable, en el orden de la primera red de cada grupo. */
function avisosSerie(n: Netlist, pre: Pre, calc: Calculo): AvisoSim[] {
  const R = n.redes.length;
  const cargas = new Map<number, number[]>();
  const descartado = new Set<number>();
  for (let i = 0; i < R; i++) {
    const r = calc.raiz[i]!;
    if (calc.potG[r] !== -1 || descartado.has(r)) continue;
    if (pre.otrosEnRed[i]! > 0 || pre.contactosEnRed[i]!.some((c) => !calc.conducen[c])) {
      descartado.add(r);
      cargas.delete(r);
      continue;
    }
    let lista = cargas.get(r);
    if (!lista) cargas.set(r, (lista = []));
    lista.push(...pre.cargasEnRed[i]!);
  }
  const avisos: AvisoSim[] = [];
  for (const [r, lista] of cargas) {
    const unicas = [...new Set(lista)].sort((a, b) => a - b);
    if (unicas.length < 2) continue;
    const otros = new Set<number>();
    for (const k of unicas) {
      const c = n.cargas[k]!;
      for (const [este, otro] of [
        [c.a, c.b],
        [c.b, c.a],
      ] as const) {
        if (calc.raiz[este] !== r) continue;
        const p = calc.potG[calc.raiz[otro]!]!;
        if (p >= 0) otros.add(p);
      }
    }
    if (otros.size < 2) continue;
    avisos.push({ tipo: "serie", cargas: unicas.map((k) => n.cargas[k]!.comp), etiquetas: unicas.map((k) => n.cargas[k]!.etiqueta) });
  }
  return avisos;
}

/** Clave de un aviso para darlo una sola vez por entrada. */
function claveAviso(a: AvisoSim): string {
  switch (a.tipo) {
    case "carrera":
      return `carrera\u0000${a.etiquetas.join("\u0000")}`;
    case "serie":
      return `serie\u0000${a.cargas.join("\u0000")}`;
    case "dos_bobinas":
      return `dos_bobinas\u0000${a.comp}`;
    default:
      return a.tipo;
  }
}

/** El tope por defecto: 2 × bobinas + 50 cambios. */
export function topePorDefecto(n: Netlist): number {
  return 2 * n.bobinas.length + 50;
}

/** Itera desde `tension0` con los pulsados dados hasta estable o detenido. */
function resolver(base: Simulacion, pulsados: ReadonlySet<string>, tension0: readonly boolean[]): Simulacion {
  const n = base.netlist;
  const pre = preparar(n);
  const tension = tension0.slice();
  const vistos = new Set(base.vistos);
  const nuevos: AvisoSim[] = [];
  const avisar = (a: AvisoSim) => {
    const k = claveAviso(a);
    if (vistos.has(k)) return;
    vistos.add(k);
    nuevos.push(a);
  };

  const visitados = new Map<string, number>();
  const cambios: number[] = [];
  let anteriores: number[] = [];
  let cambiada = -1;
  let calc = calcular(n, pre, pulsados, tension);
  let detenida: Detencion | null = null;

  for (let paso = 0; ; paso++) {
    const quieren: number[] = [];
    for (let g = 0; g < tension.length; g++) if (calc.deseado[g] !== tension[g]) quieren.push(g);
    for (const q of anteriores) {
      if (q !== cambiada && !quieren.includes(q)) avisar({ tipo: "carrera", etiquetas: [n.bobinas[cambiada]!.etiqueta, n.bobinas[q]!.etiqueta] });
    }
    if (calc.corto) {
      detenida = avisoCorto(n, calc);
      break;
    }
    if (quieren.length === 0) {
      for (const a of avisosSerie(n, pre, calc)) avisar(a);
      break;
    }
    const clave = tension.map((t) => (t ? "1" : "0")).join("");
    const desde = visitados.get(clave);
    if (desde !== undefined) {
      const enCiclo = new Set(cambios.slice(desde));
      detenida = { tipo: "oscila", etiquetas: [...enCiclo].sort((a, b) => a - b).map((g) => n.bobinas[g]!.etiqueta) };
      break;
    }
    if (paso >= base.tope) {
      detenida = { tipo: "tope", pasos: base.tope };
      break;
    }
    visitados.set(clave, paso);
    cambiada = quieren[0]!;
    tension[cambiada] = !tension[cambiada];
    cambios.push(cambiada);
    anteriores = quieren;
    calc = calcular(n, pre, pulsados, tension);
  }
  if (detenida) avisar(detenida);

  const posiciones = n.valvulas.map((v, i) => {
    const antes = base.posiciones[i] ?? false;
    const conA = v.a >= 0 && calc.encendidas[v.a]!;
    if (!v.biestable) return conA;
    if (detenida) return antes;
    const conB = v.b >= 0 && calc.encendidas[v.b]!;
    if (conA && conB) avisar({ tipo: "dos_bobinas", comp: v.comp, etiqueta: v.etiqueta });
    return conA === conB ? antes : conA;
  });

  return {
    netlist: n,
    tope: base.tope,
    pulsados,
    tension,
    conducen: calc.conducen,
    encendidas: calc.encendidas,
    posiciones,
    potencialDeRed: n.redes.map((_, i) => {
      const p = calc.potG[calc.raiz[i]!]!;
      return p >= 0 ? p : null;
    }),
    detenida,
    avisos: [...base.avisos, ...nuevos],
    nuevos,
    vistos,
  };
}

export interface OpcionesSimulacion {
  /** Cambios de bobina permitidos en cada recálculo. Por defecto, `topePorDefecto`. */
  tope?: number;
}

/** Entra a Simular sobre una netlist: todo suelto, bobinas sin tensión, y recalcula (el reposo puede mover bobinas). */
export function iniciar(n: Netlist, opciones: OpcionesSimulacion = {}): Simulacion {
  const vacia: Simulacion = {
    netlist: n,
    tope: opciones.tope ?? topePorDefecto(n),
    pulsados: new Set(),
    tension: [],
    conducen: [],
    encendidas: [],
    posiciones: n.valvulas.map(() => false),
    potencialDeRed: [],
    detenida: null,
    avisos: [],
    nuevos: [],
    vistos: new Set(),
  };
  return resolver(vacia, vacia.pulsados, n.bobinas.map(() => false));
}

/** Sin cambios: la misma simulación, sin avisos nuevos. */
function igual(sim: Simulacion): Simulacion {
  return sim.nuevos.length === 0 ? sim : { ...sim, nuevos: [] };
}

/** Aprieta uno o varios pulsadores a la vez y recalcula. Detenida, o si nada cambia, no hace nada. */
export function pulsar(sim: Simulacion, ...comps: string[]): Simulacion {
  if (sim.detenida) return igual(sim);
  const pre = preparar(sim.netlist);
  const nuevos = comps.filter((c) => pre.pulsables.has(c) && !sim.pulsados.has(c));
  if (nuevos.length === 0) return igual(sim);
  return resolver(sim, new Set([...sim.pulsados, ...nuevos]), sim.tension);
}

/** Suelta uno o varios pulsadores a la vez y recalcula. Detenida, o si nada cambia, no hace nada. */
export function soltar(sim: Simulacion, ...comps: string[]): Simulacion {
  if (sim.detenida) return igual(sim);
  const sueltos = comps.filter((c) => sim.pulsados.has(c));
  if (sueltos.length === 0) return igual(sim);
  const quedan = new Set(sim.pulsados);
  for (const c of sueltos) quedan.delete(c);
  return resolver(sim, quedan, sim.tension);
}

/** Los pulsadores de la netlist (contactos a mano): los únicos que `pulsar` aprieta. */
export function pulsables(n: Netlist): ReadonlySet<string> {
  return preparar(n).pulsables;
}

/** Los enclavados de la netlist (selector y seta, T36): pulsables que un clic acciona y otro libera. */
export function enclavados(n: Netlist): ReadonlySet<string> {
  return preparar(n).enclavados;
}

export type Entrada = { readonly ok: true; readonly sim: Simulacion } | { readonly ok: false; readonly errores: readonly Aviso[] };

/**
 * Entrar a Simular con una hoja (D4-A): solo los errores lo impiden (hoy, R4
 * con una bobina, una lámpara o un símbolo desconocido) y se devuelven. Si no,
 * arma la netlist y arranca. No cambia la hoja.
 *
 * `marcar` (T32, S-A) se llama al terminar R4 y al terminar la netlist: así
 * S1 mide cada parte de esta misma entrada (la de F5) sin que el motor lea
 * el reloj.
 */
export function entrarSimulacion(hoja: Hoja, opciones: OpcionesSimulacion = {}, marcar?: () => void): Entrada {
  const errores = validar(hoja, ["R4"]).filter((a) => a.severidad === "error");
  marcar?.();
  if (errores.length > 0) return { ok: false, errores };
  const n = armarNetlist(hoja);
  marcar?.();
  return { ok: true, sim: iniciar(n, opciones) };
}

/** El texto de la barra para un aviso de la simulación. */
export function textoAvisoSim(a: AvisoSim): string {
  switch (a.tipo) {
    case "carrera":
      return `Carrera entre ${a.etiquetas[0]} y ${a.etiquetas[1]}`;
    case "serie":
      return `Cargas en serie: ${listaY(a.etiquetas.map((e) => e || "sin etiqueta"))}`;
    case "oscila":
      return `Oscila: ${listaY(a.etiquetas)}`;
    case "tope":
      return `No se estabilizó en ${a.pasos} pasos`;
    case "corto":
      return a.nombres.length > 0 ? `Cortocircuito entre ${listaY(a.nombres)}` : "Cortocircuito";
    case "dos_bobinas":
      return `${a.etiqueta || "Electroválvula sin etiqueta"} con las dos bobinas`;
  }
}
