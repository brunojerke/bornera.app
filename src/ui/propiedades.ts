// Cuándo se abre solo el panel de propiedades, y cómo se muestran sus datos.

/**
 * True si el panel tiene que abrirse solo: la selección pasó de vacía a tener
 * algo y el usuario no lo plegó a mano. Si lo plegó, queda plegado hasta que
 * lo vuelva a abrir él (el panel le quita lugar al lienzo en 1024×600).
 */
export function abrirAlSeleccionar(antes: number, despues: number, plegadoPorUsuario: boolean): boolean {
  return antes === 0 && despues > 0 && !plegadoPorUsuario;
}

import type { ExtremoResumen } from "../editor/editor";

/** Cuánto dura un aviso en la barra de estado, en ms. */
export const DURACION_AVISO_MS = 4000;

const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * "1 componente seleccionado", "3 cables seleccionados", "2 componentes y 1
 * cable seleccionados".
 */
export function textoCantidad(componentes: number, cables = 0): string {
  const c = cuenta(componentes, "componente", "componentes");
  const w = cuenta(cables, "cable", "cables");
  if (cables === 0) return `${c} ${componentes === 1 ? "seleccionado" : "seleccionados"}`;
  if (componentes === 0) return `${w} ${cables === 1 ? "seleccionado" : "seleccionados"}`;
  return `${c} y ${w} seleccionados`;
}

/** Un extremo de cable: "K1 · A1", "Sobre otro cable", "Suelto". */
export function textoExtremo(e: ExtremoResumen): string {
  if (e.tipo === "borne") return `${e.etiqueta} · ${e.borne}`;
  return e.tipo === "cable" ? "Sobre otro cable" : "Suelto";
}

/** Con varios seleccionados, un valor distinto entre ellos. */
export const VARIAS = "Varias";

/** Etiqueta para mostrar: "—" si está vacía, "Varias" si son distintas (null). */
export function textoEtiqueta(e: string | null): string {
  if (e === null) return VARIAS;
  return e === "" ? "—" : e;
}

/** Rotación para mostrar: "90°", o "Varias" si son distintas (null). */
export function textoRotacion(r: number | null): string {
  return r === null ? VARIAS : `${r}°`;
}

/** Nota fija bajo el campo de una fase o un neutro. */
export const NOTA_RED = "Las alimentaciones con el mismo nombre están unidas.";

/** "Red L1: unida a 2 alimentaciones más". */
export function textoRed(red: string, otras: number): string {
  if (red === "") return "Sin nombre de red";
  if (otras === 0) return `Red ${red}: sin otras alimentaciones`;
  return `Red ${red}: unida a ${otras} ${otras === 1 ? "alimentación" : "alimentaciones"} más`;
}

/** Mientras se escribe en una fuente: a qué red pasa al confirmar. */
export function textoCambioRed(de: string, a: string): string {
  return de === "" ? `Al confirmar pasa a la red ${a}` : `Al confirmar pasa de la red ${de} a la red ${a}`;
}
