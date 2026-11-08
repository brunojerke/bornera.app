// Qué bornes tienen algún cable (T13): para marcarlos rellenos y no huecos
// mientras está la herramienta W. Se actualiza de forma incremental con cada
// cable que cambia (crear, borrar, soltar, deshacer, rehacer): dibujar nunca
// recorre los cables de la hoja.

import type { Cable } from "../core/model/documento";

/** Clave de un borne: componente y nombre (el separador no aparece en ids ni nombres). */
export function claveBorne(comp: string, borne: string): string {
  return `${comp}\u0000${borne}`;
}

export class BornesConCable {
  /** Cuántos extremos de cable hay en cada borne. */
  private readonly cuenta = new Map<string, number>();
  /** Las claves que puso cada cable, para sacarlas cuando cambia. */
  private readonly porCable = new Map<string, string[]>();

  constructor(cables: Iterable<Cable> = []) {
    for (const w of cables) this.poner(w.id, w);
  }

  /** Pone el estado actual de un cable: `w` undefined si ya no está en la hoja. */
  poner(id: string, w: Cable | undefined): void {
    const viejas = this.porCable.get(id);
    if (viejas) {
      for (const k of viejas) {
        const n = (this.cuenta.get(k) ?? 0) - 1;
        if (n > 0) this.cuenta.set(k, n);
        else this.cuenta.delete(k);
      }
      this.porCable.delete(id);
    }
    if (!w) return;
    const nuevas: string[] = [];
    for (const e of [w.desde, w.hasta]) if (e.tipo === "borne") nuevas.push(claveBorne(e.comp, e.borne));
    if (nuevas.length === 0) return;
    for (const k of nuevas) this.cuenta.set(k, (this.cuenta.get(k) ?? 0) + 1);
    this.porCable.set(id, nuevas);
  }

  tiene(comp: string, borne: string): boolean {
    return this.cuenta.has(claveBorne(comp, borne));
  }

  /** Las claves con cable y cuántos extremos tiene cada una (para los tests). */
  entradas(): [string, number][] {
    return [...this.cuenta].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }
}
