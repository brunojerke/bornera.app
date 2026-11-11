// Uniones de la hoja al dÃƒÂ­a, de a poco (T14b, D2-B): con cada cable que
// cambia se rehacen solo los puntos que toca, sin recorrer la hoja. La cuenta
// de cada punto es la del nÃƒÂºcleo (`unionEnPunto`); `uniones(hoja)` recorre la
// hoja entera y es la referencia de los tests.
//
// De quÃƒÂ© depende la uniÃƒÂ³n de un punto P:
// - de los cables con un extremo conectado en P (un borne o una T): se anotan
//   en P;
// - de los anfitriones de esas T (por dÃƒÂ³nde pasan y dÃƒÂ³nde terminan): cada
//   anfitriÃƒÂ³n anota P como punto que depende de ÃƒÂ©l, y si cambia solo (sin que
//   cambie la T), P se rehace igual;
// - de la posiciÃƒÂ³n de los bornes: mover, girar o espejar un componente con
//   cables rehace sus cables, que vienen en el mismo cambio.

import type { IndiceHoja } from "../core/model/cables";
import type { Cable } from "../core/model/documento";
import { clavePunto, compararUniones, puntosConectados, unionEnPunto, type Union } from "../core/model/uniones";

/** Lo que cambiÃƒÂ³: las uniones que ya no estÃƒÂ¡n (o cambiaron) y las nuevas. */
export interface CambioUniones {
  quitadas: Union[];
  puestas: Union[];
}

interface Punto {
  x: number;
  y: number;
  /** Cables con un extremo conectado en el punto. */
  llegan: Set<string>;
}

interface Registro {
  /** Claves de los puntos donde se anotÃƒÂ³. */
  puntos: string[];
  /** Anfitriones de sus T y la clave del punto de cada una. */
  anfitriones: [string, string][];
}

function mismaUnion(a: Union, b: Union): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.cables.length === b.cables.length &&
    a.componentes.length === b.componentes.length &&
    a.cables.every((id, i) => id === b.cables[i]) &&
    a.componentes.every((id, i) => id === b.componentes[i])
  );
}

export class Uniones {
  private readonly puntos = new Map<string, Punto>();
  private readonly registros = new Map<string, Registro>();
  /** Por anfitriÃƒÂ³n: los puntos con alguna T sobre ÃƒÂ©l, y cuÃƒÂ¡ntas. */
  private readonly dependientes = new Map<string, Map<string, number>>();
  private readonly lista = new Map<string, Union>();

  constructor(indice: IndiceHoja, cables: Iterable<Cable> = []) {
    const ids: string[] = [];
    for (const w of cables) ids.push(w.id);
    this.actualizar(ids, indice);
  }

  get cantidad(): number {
    return this.lista.size;
  }

  /** La uniÃƒÂ³n en (x, y), o undefined. */
  en(x: number, y: number): Union | undefined {
    return this.lista.get(clavePunto(x, y));
  }

  /** Todas, ordenadas por y y despuÃƒÂ©s por x (como `uniones` del nÃƒÂºcleo). */
  todas(): Union[] {
    return [...this.lista.values()].sort(compararUniones);
  }

  /**
   * Lleva al dÃƒÂ­a los cables `ids` (agregados, quitados o cambiados) con su
   * estado en `indice`, que ya tiene que estar al dÃƒÂ­a con todo el cambio.
   * Devuelve las uniones que cambiaron.
   */
  actualizar(ids: Iterable<string>, indice: IndiceHoja): CambioUniones {
    const sucios = new Map<string, { x: number; y: number }>();
    const unicos = new Set(ids);
    for (const id of unicos) {
      this.quitarRegistro(id, sucios);
      const w = indice.cables.get(id);
      if (w) this.ponerRegistro(w, indice, sucios);
    }
    // Los puntos que dependen de un anfitriÃƒÂ³n que cambiÃƒÂ³, aunque sus T no cambien.
    for (const id of unicos) {
      const dep = this.dependientes.get(id);
      if (!dep) continue;
      for (const k of dep.keys()) if (!sucios.has(k)) sucios.set(k, this.coordenadas(k));
    }
    const cambio: CambioUniones = { quitadas: [], puestas: [] };
    for (const [k, { x, y }] of sucios) {
      const p = this.puntos.get(k);
      let u: Union | null = null;
      if (p) {
        const llegan: Cable[] = [];
        for (const id of p.llegan) {
          const w = indice.cables.get(id);
          if (w) llegan.push(w);
        }
        u = unionEnPunto(indice, llegan, x, y);
      }
      const vieja = this.lista.get(k);
      if (vieja && u && mismaUnion(vieja, u)) continue;
      if (vieja) {
        cambio.quitadas.push(vieja);
        this.lista.delete(k);
      }
      if (u) {
        cambio.puestas.push(u);
        this.lista.set(k, u);
      }
    }
    return cambio;
  }

  private coordenadas(k: string): { x: number; y: number } {
    const i = k.indexOf(",");
    return { x: Number(k.slice(0, i)), y: Number(k.slice(i + 1)) };
  }

  private quitarRegistro(id: string, sucios: Map<string, { x: number; y: number }>): void {
    const r = this.registros.get(id);
    if (!r) return;
    for (const k of r.puntos) {
      const p = this.puntos.get(k);
      if (!p) continue;
      p.llegan.delete(id);
      sucios.set(k, { x: p.x, y: p.y });
      if (p.llegan.size === 0) this.puntos.delete(k);
    }
    for (const [anfitrion, k] of r.anfitriones) {
      const dep = this.dependientes.get(anfitrion);
      if (!dep) continue;
      const n = (dep.get(k) ?? 0) - 1;
      if (n > 0) dep.set(k, n);
      else dep.delete(k);
      if (dep.size === 0) this.dependientes.delete(anfitrion);
    }
    this.registros.delete(id);
  }

  private ponerRegistro(w: Cable, indice: IndiceHoja, sucios: Map<string, { x: number; y: number }>): void {
    const r: Registro = { puntos: [], anfitriones: [] };
    const p = puntosConectados(indice, w);
    for (let i = 0; i + 1 < p.length; i += 2) {
      const x = p[i]!;
      const y = p[i + 1]!;
      const k = clavePunto(x, y);
      let punto = this.puntos.get(k);
      if (!punto) this.puntos.set(k, (punto = { x, y, llegan: new Set() }));
      punto.llegan.add(w.id);
      if (!r.puntos.includes(k)) r.puntos.push(k);
      sucios.set(k, { x, y });
    }
    for (const e of [w.desde, w.hasta]) {
      if (e.tipo !== "cable") continue;
      const k = clavePunto(e.x, e.y);
      let dep = this.dependientes.get(e.cable);
      if (!dep) this.dependientes.set(e.cable, (dep = new Map()));
      dep.set(k, (dep.get(k) ?? 0) + 1);
      r.anfitriones.push([e.cable, k]);
    }
    if (r.puntos.length > 0 || r.anfitriones.length > 0) this.registros.set(w.id, r);
  }
}
