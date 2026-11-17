// La copia de recuperación por partes (T23, etapa 1b; docs/plan-T23.md).
//
// Una copia son varios pasos, uno por ocio. Cada paso saca piezas de
// `serializarPorPartes` hasta el presupuesto (2 ms, o lo que quede de ocio si
// es menos; siempre al menos unas piezas), las une y hace el `put` de ese
// trozo. Así ningún paso síncrono junta el texto entero (F1: el paso más
// largo, ≤ 9 ms en la PC con WebView2). Cuando se terminan las piezas, se
// esperan las escrituras y se escribe el registro de copia completa, que
// borra las generaciones anteriores (respaldo.ts).
//
// El documento se lee vivo. Si entre dos pasos cambió (otro contador de
// cambios, u otro documento), la copia vuelve a empezar con otra
// generación: dentro de un paso no puede cambiar, porque ningún comando corre
// en el medio de una tarea.
//
// Editando sin parar, cada paso podría encontrar un cambio. Después de 5
// reinicios seguidos, el intento siguiente es «de una vez»: espera un ocio
// largo (≥ 40 ms) y hace todos los pasos en esa misma tarea, sin ceder. Cada
// trozo sigue con su `put`. Siempre termina, y se informa aparte de F1.
//
// Todo llega de afuera (almacén, ocio, reloj, el documento), así se prueba
// sin DOM.

import { serializarPorPartes } from "../core/io";
import type { Documento } from "../core/model/documento";
import { registroCopia, type AlmacenCopias } from "./respaldo";

/** Tiempo de serializar por paso (ms). Con unir y el `put`, el paso queda en ~3 ms. */
export const PRESUPUESTO_PASO_MS = 2;
/** Reinicios seguidos tras los que la copia sale de una vez. */
export const REINICIOS_DE_UNA_VEZ = 5;
/** Ocio que hace falta para la copia de una vez (ms). */
export const OCIO_LARGO_MS = 40;
/** Cada cuántas piezas se mira el reloj. */
const PIEZAS_POR_VISTAZO = 8;

/** Lo que da un rato de ocio (como el IdleDeadline de requestIdleCallback). */
export interface Ocio {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}

/** Pide que se llame a `cb` en el próximo ocio. */
export type PedirOcio = (cb: (ocio: Ocio) => void) => void;

/**
 * `requestIdleCallback` con un `timeout` de 1 s (así corre aunque la ventana
 * esté oculta) o, donde no está (WebKitGTK), `setTimeout`: un ocio de 50 ms
 * de mentira, que alcanza para la copia de una vez.
 */
export const pedirOcio: PedirOcio = (cb) => {
  if (typeof requestIdleCallback === "function") requestIdleCallback(cb, { timeout: 1000 });
  else setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0);
};

/** El documento y su contador de cambios ahora; null si la copia ya no va (se canceló). */
export type FuenteCopia = () => { documento: Documento; cambios: number } | null;

export interface OpcionesCopia {
  /** Instancia dueña de la copia. */
  id: string;
  almacen: AlmacenCopias;
  fuente: FuenteCopia;
  /** La próxima generación de esta instancia (sube con cada intento). */
  generacion: () => number;
  /** Lo que va en el registro además del documento. */
  datos: () => { archivo: { nombre: string; ruta: string | null } | null; version: string };
  pedirOcio?: PedirOcio;
  /** Milisegundos (performance.now). */
  ahora: () => number;
  /** `Date.now()` del registro. */
  fecha?: () => number;
  presupuestoMs?: number;
  reiniciosDeUnaVez?: number;
  ocioLargoMs?: number;
}

export type ResultadoCopia =
  | {
      ok: true;
      /** El contador de cambios del documento copiado. */
      cambios: number;
      generacion: number;
      trozos: number;
      caracteres: number;
      /** Duración (ms) de cada paso síncrono: los trozos y, al final, el registro. */
      pasos: number[];
      reinicios: number;
      /** Salió de una vez, en una sola tarea (después de los reinicios). */
      deUnaVez: boolean;
      /** Esa tarea, si salió de una vez (ms); si no, 0. */
      deUnaVezMs: number;
      /** Del primer paso a la escritura del registro (ms). */
      duracionMs: number;
    }
  | { ok: false; cancelada: true; reinicios: number }
  | { ok: false; cancelada: false; error: unknown; reinicios: number };

/** El intento en curso: lo leído al empezar y lo escrito hasta ahora. */
interface Intento {
  documento: Documento;
  cambios: number;
  generacion: number;
  piezas: Iterator<string, void, undefined>;
  n: number;
  caracteres: number;
  escrituras: Promise<void>[];
  terminado: boolean;
}

const esperarOcio = (pedir: PedirOcio) => new Promise<Ocio>((r) => pedir(r));

/** Hace una copia completa por partes. Nunca tira: los errores vuelven en el resultado. */
export async function copiarPorPartes(op: OpcionesCopia): Promise<ResultadoCopia> {
  const pedir = op.pedirOcio ?? pedirOcio;
  const presupuesto = op.presupuestoMs ?? PRESUPUESTO_PASO_MS;
  const maxReinicios = op.reiniciosDeUnaVez ?? REINICIOS_DE_UNA_VEZ;
  const ocioLargo = op.ocioLargoMs ?? OCIO_LARGO_MS;
  const pasos: number[] = [];
  let reinicios = 0;
  let inicio: number | null = null;
  let deUnaVezMs = 0;

  /** Empieza un intento con lo que da la fuente. */
  const empezar = (f: { documento: Documento; cambios: number }): Intento => ({
    documento: f.documento,
    cambios: f.cambios,
    generacion: op.generacion(),
    piezas: serializarPorPartes(f.documento),
    n: 0,
    caracteres: 0,
    escrituras: [],
    terminado: false,
  });

  /** Un paso: piezas hasta `limite` (al menos unas), unidas en un trozo con su `put`. */
  const paso = (it: Intento, t0: number, limite: number): void => {
    const piezas: string[] = [];
    for (;;) {
      const r = it.piezas.next();
      if (r.done) {
        it.terminado = true;
        break;
      }
      piezas.push(r.value);
      if (piezas.length % PIEZAS_POR_VISTAZO === 0 && op.ahora() >= limite) break;
    }
    if (piezas.length > 0) {
      const texto = piezas.join("");
      it.caracteres += texto.length;
      // Si el put falla, el error espera al final (la copia no se marca completa).
      const escritura = op.almacen.escribirTrozo({ id: op.id, generacion: it.generacion, n: it.n++, texto });
      escritura.catch(() => {});
      it.escrituras.push(escritura);
    }
    pasos.push(op.ahora() - t0);
  };

  try {
    let it: Intento | null = null;
    while (!it?.terminado) {
      if (reinicios >= maxReinicios) {
        // De una vez: un ocio largo y todos los pasos en esa tarea.
        const ocio = await esperarOcio(pedir);
        if (ocio.didTimeout || ocio.timeRemaining() < ocioLargo) continue;
        const t = op.ahora();
        const f = op.fuente();
        if (!f) return { ok: false, cancelada: true, reinicios };
        inicio ??= t;
        it = empezar(f);
        while (!it.terminado) {
          const t0 = op.ahora();
          paso(it, t0, t0 + presupuesto);
        }
        deUnaVezMs = op.ahora() - t;
        break;
      }
      const ocio = await esperarOcio(pedir);
      const t0 = op.ahora();
      const f = op.fuente();
      if (!f) return { ok: false, cancelada: true, reinicios };
      inicio ??= t0;
      if (it && (f.cambios !== it.cambios || f.documento !== it.documento)) {
        reinicios++;
        it = null;
        continue;
      }
      it ??= empezar(f);
      const queda = ocio.didTimeout ? presupuesto : Math.max(0, ocio.timeRemaining());
      paso(it, t0, t0 + Math.min(presupuesto, queda));
    }

    if (!it) throw new Error("La copia terminó sin intento");
    // Las escrituras de los trozos, y recién después el registro.
    await Promise.all(it.escrituras);
    const t0 = op.ahora();
    const d = op.datos();
    const registro = registroCopia(
      op.id,
      it.documento,
      { generacion: it.generacion, trozos: it.n, caracteres: it.caracteres },
      d.archivo,
      d.version,
      (op.fecha ?? Date.now)(),
    );
    const escrito = op.almacen.completar(registro);
    pasos.push(op.ahora() - t0);
    await escrito;
    return {
      ok: true,
      cambios: it.cambios,
      generacion: it.generacion,
      trozos: it.n,
      caracteres: it.caracteres,
      pasos,
      reinicios,
      deUnaVez: reinicios >= maxReinicios,
      deUnaVezMs,
      duracionMs: op.ahora() - (inicio ?? t0),
    };
  } catch (error) {
    return { ok: false, cancelada: false, error, reinicios };
  }
}
