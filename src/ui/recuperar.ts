// Recuperar al arrancar (T23, D2c-A; docs/plan-T23.md, secciones 4 y 5): qué
// copias se ofrecen, cómo se nombran y cómo se abren. Sin DOM: el diálogo
// (DialogoRecuperar.svelte) y la Ventana usan esto.
//
// Se ofrecen las copias completas sin dueño (D2d-B): las de un id cuyo
// candado de Web Locks está libre. La instancia que las ofrece retiene esos
// candados mientras el diálogo está abierto, así otra que arranca en ese
// momento no las ofrece también. Sin Web Locks se ofrecen todas.
//
// Al arrancar también se borran los trozos sueltos de los ids sin dueño: los
// de una instancia que se cortó antes de su primera copia completa. Nunca los
// de una instancia viva, ni ninguna copia completa: esas solo se borran con
// Descartar (D2e: nunca sola al arrancar).

import { deserializar, type ProblemaArchivo } from "../core/io";
import type { Documento } from "../core/model/documento";
import type { AlmacenCopias, Candados, RegistroCopia } from "./respaldo";

/** Una fila del diálogo «Bornera no se cerró bien». */
export interface FilaRecuperar {
  id: string;
  nombre: string;
  nuncaGuardada: boolean;
  /** «hoy a las 11:32», «ayer a las 18:05»… */
  cuando: string;
  componentes: number;
}

/** La fila del diálogo para una copia. */
export function filaRecuperar(r: RegistroCopia, ahora: Date = new Date()): FilaRecuperar {
  return { id: r.id, ...nombreVisible(r), cuando: fechaVisible(r.fecha, ahora), componentes: r.componentes };
}

/** Aviso de la barra al recuperar; con `ms`, el tiempo hasta el primer cuadro (como Abrir, D20). */
export const avisoRecuperado = (ms: number | null) => (ms === null ? "Recuperado" : `Recuperado en ${ms} ms`);

/** Aviso de la barra al descartar una copia. */
export const AVISO_DESCARTADA = "Copia descartada";

/** Una copia ofrecida, con el candado de su dueño retenido. */
export interface CopiaOfrecida {
  registro: RegistroCopia;
  /** Suelta el candado (al decidir, o con Esc). */
  soltar: () => void;
}

/** El nombre que muestra el diálogo y si la copia nunca se guardó. */
export function nombreVisible(r: Pick<RegistroCopia, "archivo" | "titulo">): { nombre: string; nuncaGuardada: boolean } {
  if (r.archivo) return { nombre: r.archivo.nombre, nuncaGuardada: false };
  return { nombre: r.titulo.trim() || "Sin título", nuncaGuardada: true };
}

const dosCifras = (n: number) => String(n).padStart(2, "0");

/** «hoy a las 11:32», «ayer a las 18:05» o «el 12/11 a las 09:40». */
export function fechaVisible(fecha: number, ahora: Date = new Date()): string {
  const d = new Date(fecha);
  const hora = `${dosCifras(d.getHours())}:${dosCifras(d.getMinutes())}`;
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(d)) / 86_400_000);
  if (dias === 0) return `hoy a las ${hora}`;
  if (dias === 1) return `ayer a las ${hora}`;
  return `el ${dosCifras(d.getDate())}/${dosCifras(d.getMonth() + 1)} a las ${hora}`;
}

/**
 * Las copias que se ofrecen al arrancar: las completas de otros ids cuyo
 * candado está libre, la más nueva primero, con su candado retenido. De paso
 * borra los trozos sueltos de los ids sin dueño y sin copia completa.
 */
export async function copiasParaOfrecer(almacen: AlmacenCopias, candados: Candados | null, idPropio: string): Promise<CopiaOfrecida[]> {
  const registros = (await almacen.listar()).filter((r) => r.id !== idPropio).sort((a, b) => b.fecha - a.fecha);
  const ofrecidas: CopiaOfrecida[] = [];
  for (const registro of registros) {
    if (!candados) {
      ofrecidas.push({ registro, soltar: () => {} });
      continue;
    }
    const soltar = await candados.retener(registro.id);
    if (soltar) ofrecidas.push({ registro, soltar });
  }
  // Trozos sueltos: ids con trozos y sin registro, sin dueño.
  const conRegistro = new Set(registros.map((r) => r.id));
  for (const id of await almacen.idsConTrozos()) {
    if (id === idPropio || conRegistro.has(id)) continue;
    const soltar = candados ? await candados.retener(id) : () => {};
    if (!soltar) continue;
    try {
      await almacen.borrar(id);
    } finally {
      soltar();
    }
  }
  return ofrecidas;
}

/** Lo que da abrir una copia: el documento con sus avisos, o los problemas (y el texto, si hay, para exportarlo tal cual). */
export type CopiaAbierta =
  | { ok: true; documento: Documento; avisos: readonly ProblemaArchivo[] }
  | { ok: false; problemas: readonly ProblemaArchivo[]; texto: string | null };

/** Lee y abre la copia de `id` con la misma validación estricta que Abrir. */
export async function abrirCopia(almacen: AlmacenCopias, id: string): Promise<CopiaAbierta> {
  const leida = await almacen.leer(id);
  if (!leida.ok) return { ok: false, problemas: [{ donde: "", mensaje: leida.problema }], texto: leida.parcial ?? null };
  if (leida.registro.esquema !== 1) {
    return { ok: false, problemas: [{ donde: "", mensaje: `La copia es de un esquema desconocido (${String(leida.registro.esquema)})` }], texto: leida.texto };
  }
  const r = deserializar(leida.texto);
  if (!r.ok) return { ok: false, problemas: r.errores, texto: leida.texto };
  return { ok: true, documento: r.documento, avisos: r.avisos };
}
