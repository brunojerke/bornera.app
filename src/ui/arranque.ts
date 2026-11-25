// Marca de arranque (fase 6, T37; docs/plan-T37.md, D24-A): la base de P2.
// El Lienzo la deja una sola vez, en el primer cuadro nítido (sin mosaicos
// pendientes ni la espera del zoom) desde que abrió la app; «Probar la fase 6»
// la lee. Su tiempo es desde `performance.timeOrigin`.

/** Nombre de la marca en `performance` (lo busca también el humo de T37). */
export const MARCA_ARRANQUE = "bornera:primer-cuadro-nitido";

let marcada = false;

/** Deja la marca si el cuadro quedó nítido y todavía no se marcó. Un `if` por cuadro. */
export function marcarArranque(medida: { pendiente: boolean; esperar: number }): void {
  if (marcada || medida.pendiente || medida.esperar > 0) return;
  marcada = true;
  performance.mark(MARCA_ARRANQUE);
}

/** Los ms desde `timeOrigin` hasta la marca, o null si todavía no hubo cuadro nítido. */
export function msArranque(): number | null {
  const m = performance.getEntriesByName(MARCA_ARRANQUE, "mark")[0];
  return m ? m.startTime : null;
}
