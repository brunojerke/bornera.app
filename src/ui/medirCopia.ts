// «Medir la copia (F1)» (T23; docs/plan-T23.md, sección 6).
//
// Desde la etapa 1b, la copia de recuperación va por partes
// (copiaPorPartes.ts): un paso por ocio, cada uno con un trozo y su `put`, y
// al final el registro. F1 es el paso síncrono más largo. En la PC con
// WebView2 pasa si es ≤ 9 ms (objetivo ~3); en la netbook, ≤ 50 ms. La
// duración total, los pasos por copia y los reinicios se informan, pero no
// deciden.
//
// Se mide con la escena del banco de 2000 + 3030 cables, armada aparte: no
// toca el documento ni su copia. Son 20 copias seguidas, a la clave
// `medicion-…`, que se borra al final. La primera copia cuenta: es la fría,
// la que se nota (D5-A). Al terminar se relee la última copia y se compara
// con `serializar`.
//
// Lo reusa «Probar la fase 4» (C1).

import { serializar } from "../core/io";
import type { Documento } from "../core/model/documento";
import { documentoBancoCables } from "../editor/banco";
import { copiarPorPartes, PRESUPUESTO_PASO_MS } from "./copiaPorPartes";
import { mediana } from "./diagnostico";
import { SIMBOLOS_BANCO_CABLES } from "./escenas";
import { abrirBase, almacenIndexedDB } from "./respaldo";
import { VERSION } from "./version";

/** Copias que hace la medición. */
export const COPIAS_F1 = 20;
/** Tope de F1 en la PC con WebView2 (ms). */
export const TOPE_F1_PC_MS = 9;
/** Objetivo de F1 en la PC (ms): no decide. */
export const OBJETIVO_F1_PC_MS = 3;

/** Una copia medida (ms). */
export interface MuestraCopia {
  /** Cada paso de trozo: piezas unidas + su `put`. */
  trozos: number[];
  /** El paso del registro final. */
  registro: number;
  /** Del primer paso a la escritura del registro. */
  duracion: number;
  reinicios: number;
}

/** Mediana, máximo y el de la primera copia (la fría). */
export interface Estadistica {
  mediana: number;
  maximo: number;
  primera: number;
}

export interface ResumenF1 {
  copias: number;
  /** Todos los pasos de trozo; «primera» es el más largo de la primera copia. */
  trozo: Estadistica;
  registro: Estadistica;
  /** El paso más largo de cada copia. */
  pasoMasLargo: Estadistica;
  pasosPorCopia: number;
  duracion: Estadistica;
  reinicios: number;
  /** El paso síncrono más largo de todas las copias. */
  f1: number;
  pasa: boolean;
}

const maximo = (v: readonly number[]) => (v.length ? Math.max(...v) : 0);
const pasoMasLargo = (m: MuestraCopia) => Math.max(m.registro, ...m.trozos);

/** El resumen de las copias medidas, en orden. Se compara sin redondear. */
export function resumirF1(muestras: readonly MuestraCopia[]): ResumenF1 {
  const todos = muestras.flatMap((m) => m.trozos);
  const largos = muestras.map(pasoMasLargo);
  const f1 = maximo(largos);
  const primera = muestras[0];
  return {
    copias: muestras.length,
    trozo: { mediana: mediana(todos), maximo: maximo(todos), primera: primera ? maximo(primera.trozos) : 0 },
    registro: { mediana: mediana(muestras.map((m) => m.registro)), maximo: maximo(muestras.map((m) => m.registro)), primera: primera?.registro ?? 0 },
    pasoMasLargo: { mediana: mediana(largos), maximo: f1, primera: largos[0] ?? 0 },
    pasosPorCopia: mediana(muestras.map((m) => m.trozos.length + 1)),
    duracion: {
      mediana: mediana(muestras.map((m) => m.duracion)),
      maximo: maximo(muestras.map((m) => m.duracion)),
      primera: primera?.duracion ?? 0,
    },
    reinicios: muestras.reduce((s, m) => s + m.reinicios, 0),
    f1,
    pasa: muestras.length > 0 && f1 <= TOPE_F1_PC_MS,
  };
}

const unDecimal = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
const entero = new Intl.NumberFormat("es-AR");
/** Un tiempo medido, con un decimal. */
const ms = (n: number) => unDecimal.format(n);

/** Lo que dice el encabezado. */
export interface DatosF1 {
  version: string;
  fecha: string;
  motor: string;
  simbolos: number;
  cables: number;
  caracteres: number;
  /** La última copia, releída, es igual a `serializar`. */
  igual: boolean;
}

/**
 * El resultado para copiar. La última línea lleva el paso más largo de cada
 * copia, en orden, para que `tests/bench/f1-webview2.mjs` la lea.
 */
export function textoF1(muestras: readonly MuestraCopia[], datos: DatosF1): string {
  const r = resumirF1(muestras);
  const fila = (nombre: string, e: Estadistica) => `| ${nombre} | ${ms(e.mediana)} ms | ${ms(e.maximo)} ms | ${ms(e.primera)} ms |`;
  return [
    `Medir la copia (F1) · Bornera ${datos.version} · ${datos.fecha} · ${datos.motor}`,
    `Escena: ${datos.simbolos} símbolos + ${datos.cables} cables · texto de ${entero.format(datos.caracteres)} caracteres · ` +
      `${r.copias} copias por partes (${PRESUPUESTO_PASO_MS} ms de serializar por paso), una tras otra; la primera (en frío) cuenta`,
    "",
    "| Paso síncrono | Mediana | Máx. | Primera copia |",
    "|---|---|---|---|",
    fila("Trozo (piezas + put)", r.trozo),
    fila("Registro final", r.registro),
    fila("**El más largo de cada copia**", r.pasoMasLargo),
    "",
    `F1 = ${ms(r.f1)} ms (el paso síncrono más largo): ${r.pasa ? "pasa" : "no pasa"} ` +
      `(tope en la PC con WebView2: ≤ ${TOPE_F1_PC_MS} ms; objetivo ~${OBJETIVO_F1_PC_MS} ms)`,
    `Se informa, no decide: ${r.pasosPorCopia} pasos por copia (mediana) · duración total: mediana ${ms(r.duracion.mediana)} ms, ` +
      `máx. ${ms(r.duracion.maximo)} ms · reinicios: ${r.reinicios}`,
    `Lectura: la última copia, releída, ${datos.igual ? "es igual a serializar" : "NO es igual a serializar (MAL)"}`,
    `Paso más largo por copia (ms): ${muestras.map((m) => ms(pasoMasLargo(m))).join(" · ")}`,
  ].join("\n");
}

/** El motor del webview, del user agent (Edg/…, Chrome/… o AppleWebKit/…). */
export function motor(ua: string = navigator.userAgent): string {
  return /Edg\/[\d.]+/.exec(ua)?.[0] ?? /Chrome\/[\d.]+/.exec(ua)?.[0] ?? /AppleWebKit\/[\d.]+/.exec(ua)?.[0] ?? ua;
}

/**
 * Mide `copias` copias por partes de `doc` en IndexedDB, y relee la última.
 * Borra su copia al terminar, también si falla.
 */
export async function medirCopias(
  doc: Documento,
  copias = COPIAS_F1,
  progreso: (texto: string) => void = () => {},
): Promise<{ muestras: MuestraCopia[]; igual: boolean }> {
  const almacen = almacenIndexedDB(await abrirBase());
  const id = `medicion-${Math.random().toString(36).slice(2)}`;
  let generacion = 0;
  const muestras: MuestraCopia[] = [];
  try {
    for (let i = 0; i < copias; i++) {
      progreso(`copia ${i + 1} de ${copias}`);
      const r = await copiarPorPartes({
        id,
        almacen,
        fuente: () => ({ documento: doc, cambios: 0 }),
        generacion: () => ++generacion,
        datos: () => ({ archivo: null, version: VERSION }),
        ahora: () => performance.now(),
      });
      if (!r.ok) throw r.cancelada ? new Error("La copia se canceló") : r.error;
      muestras.push({ trozos: r.pasos.slice(0, -1), registro: r.pasos.at(-1) ?? 0, duracion: r.duracionMs, reinicios: r.reinicios });
    }
    const leida = await almacen.leer(id);
    return { muestras, igual: leida.ok && leida.texto === serializar(doc) };
  } finally {
    try {
      await almacen.borrar(id);
    } finally {
      almacen.cerrar();
    }
  }
}

/** «Medir la copia (F1)» del menú de desarrollo: el texto para copiar. */
export async function medirCopia(progreso: (texto: string) => void = () => {}): Promise<string> {
  progreso("armando la escena de 2000 con cables");
  // Que se vea el aviso antes de armar la escena (tarda).
  await new Promise((r) => setTimeout(r, 0));
  const doc = documentoBancoCables(SIMBOLOS_BANCO_CABLES);
  const { muestras, igual } = await medirCopias(doc, COPIAS_F1, progreso);
  let cables = 0;
  for (const h of doc.hojas) cables += h.cables.length;
  return textoF1(muestras, {
    version: VERSION,
    fecha: new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }),
    motor: motor(),
    simbolos: SIMBOLOS_BANCO_CABLES,
    cables,
    caracteres: serializar(doc).length,
    igual,
  });
}
