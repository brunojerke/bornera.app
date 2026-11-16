// «Probar la fase 3b» (cierre 3b, etapa 4; docs/plan-cierre-3b.md, sección 7):
// las filas B1 a B16 de la checklist de la netbook (docs/netbook-fase3b.md,
// sección B), con su tope de netbook, y cómo se juzga cada una con lo que mide
// el banco. Puro, sin DOM: lo corre probarFase3b.ts en la app y lo prueban los
// tests en Node.
//
// Los topes viven acá y en ningún otro lugar del código. Los «×2,5» se
// guardan como el tope de la PC (tablas 6.1 y 6.2 del plan) y se multiplican
// por el factor de la netbook de T16. Un test compara cada fila (escenario,
// medida y tope, como texto) con la tabla de docs/netbook-fase3b.md: si se
// cambia un tope en un lado y no en el otro, falla.

import { TOPE_PREVIA_PEGAR } from "../editor/herramientas/pegar";
import { LIMITE_LENTO_MS } from "../render/rendimiento";

/** Factor de la netbook sobre la PC (docs/archivo/plan-T16.md, sección 4). */
export const FACTOR_NETBOOK = 2.5;
/** Un cuadro que tarda más que esto es lento (el `lentos` del banco y de F3). */
const LENTO_MS = LIMITE_LENTO_MS;
/** El cuadro de 60 Hz, en ms: la meta de 0.1.2 cuenta los que lo pasan (se escribe 16,7). */
export const CUADRO_MS = 1000 / 60;

/** Lo que usa de una medición del banco (tests/bench/escenarios.ts, `Medicion`). */
export interface MedidaFase3b {
  escenario: string;
  cuadros: number;
  maximo: number;
  /** Cuadros de más de LENTO_MS. */
  lentos: number;
  porGesto: number;
  /** Cuadros de más de CUADRO_MS. */
  sobreCuadro?: number;
  /** Lentos después de un paso (el paso y los cuadros hasta el siguiente), como máximo. */
  lentosPorPasoMax?: number;
  paso?: { mediana: number; p95: number; maximo: number };
  pasoImpar?: { mediana: number; p95: number; maximo: number };
  revision?: { p95: number };
  r6?: number[];
}

/** Nombres de los escenarios del banco que corre «Probar la fase 3b». */
export const ESCENARIO = {
  duplicar: "Duplicar todo (2000) y deshacer al 31 %",
  pegar: "Pegar 500 y deshacer al 31 %",
  rehacerReferencias: "Rehacer al 31 % con referencias",
  moverContacto: "Mover 1 contacto con referencias al 31 %",
  cable: "Dibujar 1 cable con 2000 y un par NC+bobina al 31 %",
  borrar: "Borrar y deshacer uno con cables al 31 %",
  /** En la escena de 500 símbolos. */
  encuadrar: "Encuadrar (F)",
} as const;
/** La serie de la previa de pegar: «Previa de pegar N al 31 %». */
const PREVIA = /^Previa de pegar (\d+) al 31 %$/;

const previa = (n: number) => `Previa de pegar ${n} al 31 %`;

/** Escenarios de la escena de 500 que corre. */
export const ESCENARIOS_500: readonly string[] = [ESCENARIO.encuadrar];
/** Los de la escena con cables que tienen que estar (de la serie de la previa, el del tope). */
export const OBLIGATORIOS_CABLES: readonly string[] = [
  ESCENARIO.borrar,
  previa(TOPE_PREVIA_PEGAR),
  ESCENARIO.pegar,
  ESCENARIO.duplicar,
  ESCENARIO.rehacerReferencias,
  ESCENARIO.moverContacto,
  ESCENARIO.cable,
];
/** Si corre el escenario de la escena con cables de ese nombre: los obligatorios y toda la serie de la previa. */
export function corre(nombre: string): boolean {
  return PREVIA.test(nombre) || OBLIGATORIOS_CABLES.includes(nombre);
}

/**
 * Los escenarios de `lista` que pide `quiere`, los mismos objetos y en el
 * orden del banco. Falla si alguno de `obligatorios` no está (un nombre que
 * cambió en el banco).
 */
export function elegir<E extends { nombre: string }>(lista: readonly E[], quiere: (nombre: string) => boolean, obligatorios: readonly string[]): E[] {
  const elegidos = lista.filter((e) => quiere(e.nombre));
  const faltan = obligatorios.filter((n) => !elegidos.some((e) => e.nombre === n));
  if (faltan.length > 0) throw new Error(`El banco no tiene ${faltan.map((n) => `«${n}»`).join(", ")}.`);
  return elegidos;
}

export type Resultado = "pasa" | "no pasa" | "se anota";

export interface FilaEvaluada {
  id: string;
  escenario: string;
  medida: string;
  tope: string;
  valor: string;
  resultado: Resultado;
}

interface Fila {
  id: string;
  /** Como en la tabla de la netbook («″»: el de la fila de arriba). */
  escenario: string;
  medida: string;
  tope: string;
  evaluar(m: Mediciones): { valor: string; resultado: Resultado };
}

/** Las mediciones por nombre de escenario. */
type Mediciones = ReadonlyMap<string, MedidaFase3b>;

// ── Formato ────────────────────────────────────────────────────────────────

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2, useGrouping: false });
const unDecimal = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
/** Un tope: sin ceros de más (375, 12,5). */
const t = (n: number) => numero.format(n);
/** Un valor medido: con un decimal. */
const v = (n: number) => unDecimal.format(n);
const pasa = (ok: boolean): Resultado => (ok ? "pasa" : "no pasa");

function medida(m: Mediciones, nombre: string): MedidaFase3b {
  const x = m.get(nombre);
  if (!x) throw new Error(`Falta la medición de «${nombre}».`);
  return x;
}

/** Percentil como el del banco (el elemento en ⌊p·n⌋ de la lista ordenada). */
function percentilR6(ms: readonly number[], p: number): number {
  const o = [...ms].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.floor(p * o.length))] ?? 0;
}

// ── Criterios ──────────────────────────────────────────────────────────────

/** Mediana y máximo de un paso, contra el tope de la PC por FACTOR_NETBOOK. */
function pasoMedianaMaximo(nombre: string, impar: boolean, pcMediana: number, pcMaximo: number) {
  const med = pcMediana * FACTOR_NETBOOK;
  const max = pcMaximo * FACTOR_NETBOOK;
  return {
    tope: `≤ ${t(med)} / ≤ ${t(max)} ms`,
    evaluar(m: Mediciones) {
      const x = medida(m, nombre);
      const p = impar ? x.pasoImpar : x.paso;
      if (!p) throw new Error(`«${nombre}» no midió el paso.`);
      return { valor: `${v(p.mediana)} / ${v(p.maximo)} ms`, resultado: pasa(p.mediana <= med && p.maximo <= max) };
    },
  };
}

/** Cuadros después de pegar o duplicar y de deshacer (Bruno). */
const LENTOS_POR_GESTO = 1;
const MAXIMO_DESPUES_DEL_GESTO = 100;
function cuadrosDespuesDelGesto(nombre: string) {
  return {
    tope: `≤ ${LENTOS_POR_GESTO} lento por gesto y ninguno > ${t(MAXIMO_DESPUES_DEL_GESTO)} ms`,
    evaluar(m: Mediciones) {
      const x = medida(m, nombre);
      const porGesto = x.lentosPorPasoMax ?? 0;
      return {
        valor: `${porGesto} por gesto (${x.lentos} en total); máx. ${v(x.maximo)} ms`,
        resultado: pasa(porGesto <= LENTOS_POR_GESTO && x.maximo <= MAXIMO_DESPUES_DEL_GESTO),
      };
    },
  };
}

/** La meta de 0.1.2: ningún cuadro de más de 50 ms y menos de 1 % de más de 16,7 ms. */
const META_012 = { maximo: 50, porcentaje: 1 };
function meta012(nombres: (m: Mediciones) => string[]) {
  return {
    tope: `ninguno > ${t(META_012.maximo)} ms y < ${t(META_012.porcentaje)} % > ${t(Number(CUADRO_MS.toFixed(1)))} ms`,
    evaluar(m: Mediciones) {
      const xs = nombres(m).map((n) => medida(m, n));
      const maximo = Math.max(...xs.map((x) => x.maximo));
      const cuadros = xs.reduce((s, x) => s + x.cuadros, 0);
      const sobre = xs.reduce((s, x) => s + (x.sobreCuadro ?? 0), 0);
      const porcentaje = cuadros > 0 ? (sobre / cuadros) * 100 : 0;
      return {
        valor: `máx. ${v(maximo)} ms; ${v(porcentaje)} % > ${t(Number(CUADRO_MS.toFixed(1)))} ms (${sobre} de ${cuadros})`,
        resultado: pasa(maximo <= META_012.maximo && porcentaje < META_012.porcentaje),
      };
    },
  };
}

/** Los N de la serie de la previa de pegar que se midieron, de menor a mayor. */
function seriePrevia(m: Mediciones): number[] {
  return [...m.keys()]
    .map((n) => PREVIA.exec(n)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
}

/** Revisión por punto de la previa de pegar (T16: 5 ms en la PC). */
const REVISION_PREVIA = 5 * FACTOR_NETBOOK;

/** Rehacer con referencias: el tope de T18 (25 ms en la PC). */
const REHACER_REFERENCIAS = 25 * FACTOR_NETBOOK;
/** Mover 1 contacto con referencias: el paso de T18 (1,8 ms en la PC). */
const MOVER_CONTACTO = 1.8 * FACTOR_NETBOOK;
/** R6 al dibujar un cable: el de T19 (3 / 8 ms en la PC). */
const R6 = { p95: 3 * FACTOR_NETBOOK, maximo: 8 * FACTOR_NETBOOK };

export const FILAS: readonly Fila[] = [
  { id: "B1", escenario: "Duplicar todo (2000)", medida: "paso: mediana / máx.", ...pasoMedianaMaximo(ESCENARIO.duplicar, false, 150, 300) },
  { id: "B2", escenario: "″", medida: "deshacer: mediana / máx.", ...pasoMedianaMaximo(ESCENARIO.duplicar, true, 40, 80) },
  { id: "B3", escenario: "″", medida: "cuadros después del gesto", ...cuadrosDespuesDelGesto(ESCENARIO.duplicar) },
  { id: "B4", escenario: "Pegar 500", medida: "paso: mediana / máx.", ...pasoMedianaMaximo(ESCENARIO.pegar, false, 40, 80) },
  { id: "B5", escenario: "″", medida: "deshacer: mediana / máx.", ...pasoMedianaMaximo(ESCENARIO.pegar, true, 40, 80) },
  { id: "B6", escenario: "″", medida: "cuadros después del gesto", ...cuadrosDespuesDelGesto(ESCENARIO.pegar) },
  {
    id: "B7",
    escenario: `Previa de pegar ${TOPE_PREVIA_PEGAR}`,
    medida: "revisión por punto: p95",
    tope: `≤ ${t(REVISION_PREVIA)} ms`,
    evaluar(m) {
      const r = medida(m, previa(TOPE_PREVIA_PEGAR)).revision;
      if (!r) throw new Error("La previa de pegar no midió la revisión por punto.");
      return { valor: `${v(r.p95)} ms`, resultado: pasa(r.p95 <= REVISION_PREVIA) };
    },
  },
  {
    id: "B8",
    escenario: "Previa de pegar, 40 a 500",
    medida: "cuadros",
    ...meta012((m) => seriePrevia(m).map(previa)),
  },
  {
    id: "B9",
    escenario: "Previa de pegar, la serie",
    medida: `mayor N con revisión p95 ≤ ${t(REVISION_PREVIA)} ms`,
    tope:
      `se anota. Si da menos de ${TOPE_PREVIA_PEGAR}, se baja \`TOPE_PREVIA_PEGAR\`; ` +
      `si da ${2 * TOPE_PREVIA_PEGAR} o más, se puede subir (con Bruno)`,
    evaluar(m) {
      // El mayor N tal que él y todos los menores pasan.
      let mayor: number | null = null;
      for (const n of seriePrevia(m)) {
        const r = medida(m, previa(n)).revision;
        if (!r || r.p95 > REVISION_PREVIA) break;
        mayor = n;
      }
      const aviso = mayor === null || mayor < TOPE_PREVIA_PEGAR ? `; menos de ${TOPE_PREVIA_PEGAR}: revisar \`TOPE_PREVIA_PEGAR\`` : "";
      return { valor: `N = ${mayor ?? "ninguno"}${aviso}`, resultado: "se anota" };
    },
  },
  {
    id: "B10",
    escenario: ESCENARIO.rehacerReferencias,
    medida: "por gesto",
    tope: `≤ ${t(REHACER_REFERENCIAS)} ms`,
    evaluar(m) {
      const x = medida(m, ESCENARIO.rehacerReferencias);
      return { valor: `${v(x.porGesto)} ms`, resultado: pasa(x.porGesto <= REHACER_REFERENCIAS) };
    },
  },
  { id: "B11", escenario: "″", medida: "cuadros", ...meta012(() => [ESCENARIO.rehacerReferencias]) },
  {
    id: "B12",
    escenario: ESCENARIO.moverContacto,
    medida: "paso: mediana",
    tope: `≤ ${t(MOVER_CONTACTO)} ms`,
    evaluar(m) {
      const p = medida(m, ESCENARIO.moverContacto).paso;
      if (!p) throw new Error("Mover 1 contacto no midió el paso.");
      return { valor: `${v(p.mediana)} ms`, resultado: pasa(p.mediana <= MOVER_CONTACTO) };
    },
  },
  {
    id: "B13",
    escenario: ESCENARIO.cable,
    medida: "R6: p95 / máx.",
    tope: `≤ ${t(R6.p95)} / ≤ ${t(R6.maximo)} ms`,
    evaluar(m) {
      const r6 = medida(m, ESCENARIO.cable).r6 ?? [];
      if (r6.length === 0) throw new Error("Dibujar 1 cable no midió R6.");
      const p95 = percentilR6(r6, 0.95);
      const maximo = Math.max(...r6);
      return { valor: `${v(p95)} / ${v(maximo)} ms`, resultado: pasa(p95 <= R6.p95 && maximo <= R6.maximo) };
    },
  },
  { id: "B14", escenario: "″", medida: "cuadros", ...meta012(() => [ESCENARIO.cable]) },
  {
    id: "B15",
    escenario: "Encuadrar (F) con 500",
    medida: "cuadros",
    tope: `0 lentos (> ${LENTO_MS} ms)`,
    evaluar(m) {
      const x = medida(m, ESCENARIO.encuadrar);
      return { valor: `${x.lentos} lentos; máx. ${v(x.maximo)} ms`, resultado: pasa(x.lentos === 0) };
    },
  },
  {
    id: "B16",
    escenario: `${ESCENARIO.borrar} (escena con cables)`,
    medida: "cuadros; por gesto",
    tope: "0 lentos; por gesto se informa",
    evaluar(m) {
      const x = medida(m, ESCENARIO.borrar);
      return { valor: `${x.lentos} lentos; ${v(x.porGesto)} ms`, resultado: pasa(x.lentos === 0) };
    },
  },
];

/** Juzga cada fila con las mediciones de una corrida. */
export function evaluar(mediciones: readonly MedidaFase3b[]): FilaEvaluada[] {
  const m = new Map(mediciones.map((x) => [x.escenario, x]));
  return FILAS.map((f) => ({ id: f.id, escenario: f.escenario, medida: f.medida, tope: f.tope, ...f.evaluar(m) }));
}

/** Celda de una tabla en Markdown (sin barras sueltas). */
const celda = (s: string) => s.replace(/\|/g, "\\|");

/**
 * La tabla para copiar al `.txt` del pendrive: una línea de encabezado con
 * la versión y las condiciones, las filas con las mismas columnas que la
 * checklist (escenario, medida y tope) más lo medido y el resultado, y un
 * resumen.
 */
export function textoParaCopiar(filas: readonly FilaEvaluada[], encabezado: string): string {
  const lineas = [
    encabezado,
    "",
    "| # | Escenario | Medida | Tope netbook | Netbook | Resultado |",
    "|---|---|---|---|---|---|",
    ...filas.map((f) => `| ${[f.id, f.escenario, f.medida, f.tope, f.valor, f.resultado].map(celda).join(" | ")} |`),
    "",
  ];
  const cuenta = (r: Resultado) => filas.filter((f) => f.resultado === r).length;
  lineas.push(`Pasan ${cuenta("pasa")} · no pasan ${cuenta("no pasa")} · se anotan ${cuenta("se anota")}.`);
  return lineas.join("\n");
}
