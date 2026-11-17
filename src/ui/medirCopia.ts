// «Medir la copia (F1)» (T23, etapa 1a; docs/plan-T23.md, sección 6).
//
// La parte síncrona de la copia de recuperación es lo que traba la página
// mientras dura: `serializar` el documento, armar el registro, abrir la
// transacción y pedir el `put` (que clona el texto). La escritura hasta
// `complete` es asíncrona y no cuenta.
//
// Se mide con la escena del banco de 2000 + 3030 cables, armada aparte: no
// toca el documento ni su copia. Son 20 copias seguidas, cada una en su
// tarea (con ocio antes), a la clave `medicion-…`, que se borra al final. La
// primera copia cuenta: es la fría, la que se nota (D5-A).
//
// F1 = el máximo de la parte síncrona. En la PC, con WebView2, pasa si es
// ≤ 9 ms (50 ms de la netbook / 5,5; docs/plan-fase4.md, sección 5). Si no,
// viene la etapa 1b. Lo reusa «Probar la fase 4» (C1).

import { serializar } from "../core/io";
import type { Documento } from "../core/model/documento";
import { documentoBancoCables } from "../editor/banco";
import { mediana } from "./diagnostico";
import { SIMBOLOS_BANCO_CABLES } from "./escenas";
import { ALMACEN_COPIAS, abrirBase, registroCopia, terminada } from "./respaldo";
import { VERSION } from "./version";

/** Copias que hace la medición. */
export const COPIAS_F1 = 20;
/** Tope de F1 en la PC con WebView2 (ms). */
export const TOPE_F1_PC_MS = 9;

/** Una copia medida (ms). */
export interface MuestraCopia {
  /** `serializar(documento)`. */
  serializar: number;
  /** Armar el registro, abrir la transacción y pedir el `put`. */
  put: number;
  /** De pedir el `put` a `complete` (asíncrono, no cuenta para F1). */
  escritura: number;
}

/** Mediana, máximo y la primera (la fría) de una lista de tiempos. */
export interface Estadistica {
  mediana: number;
  maximo: number;
  primera: number;
}

export interface ResumenF1 {
  copias: number;
  serializar: Estadistica;
  put: Estadistica;
  /** La parte síncrona: `serializar` + `put`. */
  sincrona: Estadistica;
  escritura: Estadistica;
  /** Máximo de la parte síncrona. */
  f1: number;
  pasa: boolean;
}

function estadistica(valores: readonly number[]): Estadistica {
  return { mediana: mediana(valores), maximo: valores.length ? Math.max(...valores) : 0, primera: valores[0] ?? 0 };
}

/** El resumen de las copias medidas, en orden. Se compara sin redondear. */
export function resumirF1(muestras: readonly MuestraCopia[]): ResumenF1 {
  const sincrona = estadistica(muestras.map((m) => m.serializar + m.put));
  return {
    copias: muestras.length,
    serializar: estadistica(muestras.map((m) => m.serializar)),
    put: estadistica(muestras.map((m) => m.put)),
    sincrona,
    escritura: estadistica(muestras.map((m) => m.escritura)),
    f1: sincrona.maximo,
    pasa: muestras.length > 0 && sincrona.maximo <= TOPE_F1_PC_MS,
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
}

/**
 * El resultado para copiar. La última línea lleva la parte síncrona de cada
 * copia, en orden, para que `tests/bench/f1-webview2.mjs` la lea.
 */
export function textoF1(muestras: readonly MuestraCopia[], datos: DatosF1): string {
  const r = resumirF1(muestras);
  const fila = (nombre: string, e: Estadistica) => `| ${nombre} | ${ms(e.mediana)} ms | ${ms(e.maximo)} ms | ${ms(e.primera)} ms |`;
  return [
    `Medir la copia (F1) · Bornera ${datos.version} · ${datos.fecha} · ${datos.motor}`,
    `Escena: ${datos.simbolos} símbolos + ${datos.cables} cables · texto de ${entero.format(datos.caracteres)} caracteres · ` +
      `${r.copias} copias, una por tarea; la primera (en frío) cuenta`,
    "",
    "| Parte | Mediana | Máx. | Primera |",
    "|---|---|---|---|",
    fila("serializar", r.serializar),
    fila("registro y put", r.put),
    fila("**Parte síncrona**", r.sincrona),
    "",
    `F1 = ${ms(r.f1)} ms (máximo de la parte síncrona): ${r.pasa ? "pasa" : "no pasa"} (tope en la PC con WebView2: ≤ ${TOPE_F1_PC_MS} ms)`,
    `Escritura hasta «complete» (no cuenta): mediana ${ms(r.escritura.mediana)} ms, máx. ${ms(r.escritura.maximo)} ms`,
    `Parte síncrona por copia (ms): ${muestras.map((m) => ms(m.serializar + m.put)).join(" · ")}`,
  ].join("\n");
}

/** El motor del webview, del user agent (Edg/…, Chrome/… o AppleWebKit/…). */
export function motor(ua: string = navigator.userAgent): string {
  return /Edg\/[\d.]+/.exec(ua)?.[0] ?? /Chrome\/[\d.]+/.exec(ua)?.[0] ?? /AppleWebKit\/[\d.]+/.exec(ua)?.[0] ?? ua;
}

/** Espera un rato de ocio (o, sin `requestIdleCallback`, la próxima tarea). */
function ocio(): Promise<void> {
  return new Promise((resolver) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolver(), { timeout: 1000 });
    else setTimeout(resolver, 0);
  });
}

/** Mide `copias` copias de `doc` en IndexedDB. Borra su registro al terminar, también si falla. */
export async function medirCopias(doc: Documento, copias = COPIAS_F1, progreso: (texto: string) => void = () => {}): Promise<MuestraCopia[]> {
  const base = await abrirBase();
  const id = `medicion-${Math.random().toString(36).slice(2)}`;
  const muestras: MuestraCopia[] = [];
  try {
    for (let i = 0; i < copias; i++) {
      progreso(`copia ${i + 1} de ${copias}`);
      await ocio();
      const t0 = performance.now();
      const texto = serializar(doc);
      const t1 = performance.now();
      const tx = base.transaction(ALMACEN_COPIAS, "readwrite", { durability: "strict" });
      tx.objectStore(ALMACEN_COPIAS).put(registroCopia(id, doc, texto, null, VERSION, Date.now()));
      const t2 = performance.now();
      await terminada(tx);
      muestras.push({ serializar: t1 - t0, put: t2 - t1, escritura: performance.now() - t2 });
    }
  } finally {
    try {
      const tx = base.transaction(ALMACEN_COPIAS, "readwrite");
      tx.objectStore(ALMACEN_COPIAS).delete(id);
      await terminada(tx);
    } finally {
      base.close();
    }
  }
  return muestras;
}

/** «Medir la copia (F1)» del menú de desarrollo: el texto para copiar. */
export async function medirCopia(progreso: (texto: string) => void = () => {}): Promise<string> {
  progreso("armando la escena de 2000 con cables");
  // Que se vea el aviso antes de armar la escena (tarda).
  await new Promise((r) => setTimeout(r, 0));
  const doc = documentoBancoCables(SIMBOLOS_BANCO_CABLES);
  const muestras = await medirCopias(doc, COPIAS_F1, progreso);
  let cables = 0;
  for (const h of doc.hojas) cables += h.cables.length;
  return textoF1(muestras, {
    version: VERSION,
    fecha: new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }),
    motor: motor(),
    simbolos: SIMBOLOS_BANCO_CABLES,
    cables,
    caracteres: serializar(doc).length,
  });
}
