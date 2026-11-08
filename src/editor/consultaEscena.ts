// La consulta del trazado (T13) con el índice de la escena: los mismos datos
// que `consultaHoja`, pero sin recorrer la hoja entera. Es la que usan la
// vista previa y el comando final de la herramienta W. Un test compara las
// dos en la escena de 2000 + 3000.

import type { Cable } from "../core/model/documento";
import {
  nombreVisible,
  tocaRecorrido,
  type BorneHoja,
  type CableHoja,
  type ConsultaTrazado,
  type CuerpoHoja,
} from "../core/model/trazado";
import { bornesColocados, buscarSimbolo, cajaCuerpo, type Rect } from "../core/symbols";
import type { ComponenteEscena } from "../render/escena";
import type { EscenaEditable } from "../render/escenaEditable";

function seTocan(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.ancho && b.x <= a.x + a.ancho && a.y <= b.y + b.alto && b.y <= a.y + a.alto;
}

/** Bornes y cuerpo de un componente de la escena, ya listos para la consulta. */
interface Geometria {
  bornes: BorneHoja[];
  cuerpo: CuerpoHoja;
}

export class ConsultaEscena implements ConsultaTrazado {
  /**
   * Bornes y cuerpo por componente de la escena. La escena cambia el objeto
   * de un componente cada vez que cambia, así que el caché se vacía solo.
   */
  private readonly geometrias = new WeakMap<ComponenteEscena, Geometria | null>();

  constructor(
    private readonly escena: EscenaEditable,
    /** Los cables de la hoja por id (para los extremos). */
    private readonly cables: () => ReadonlyMap<string, Cable>,
  ) {}

  /** Bornes y cuerpo del componente; null si su símbolo no se conoce (como en la consulta lineal). */
  private geometria(id: string, c: ComponenteEscena): Geometria | null {
    let g = this.geometrias.get(c);
    if (g !== undefined) return g;
    if (!buscarSimbolo(c.def.tipo)) {
      g = null;
    } else {
      const nombre = nombreVisible(c.etiqueta, c.def);
      g = {
        bornes: bornesColocados(c.def.bornes, c.x, c.y, c).map((b) => ({ comp: id, borne: b.nombre, nombre, x: b.x, y: b.y, direccion: b.direccion })),
        cuerpo: { comp: id, nombre, caja: cajaCuerpo(c.def.tamano, c.x, c.y, c.rotacion) },
      };
    }
    this.geometrias.set(c, g);
    return g;
  }

  bornesEn(k: Rect): BorneHoja[] {
    const salida: BorneHoja[] = [];
    for (const [id, c] of this.escena.componentesEn(k)) {
      const g = this.geometria(id, c);
      if (!g) continue;
      for (const b of g.bornes) if (b.x >= k.x && b.x <= k.x + k.ancho && b.y >= k.y && b.y <= k.y + k.alto) salida.push(b);
    }
    return salida;
  }

  cuerposEn(k: Rect): CuerpoHoja[] {
    const salida: CuerpoHoja[] = [];
    for (const [id, c] of this.escena.componentesEn(k)) {
      const g = this.geometria(id, c);
      if (g && seTocan(g.cuerpo.caja, k)) salida.push(g.cuerpo);
    }
    return salida;
  }

  cablesEn(k: Rect): CableHoja[] {
    const mapa = this.cables();
    const salida: CableHoja[] = [];
    for (const [id, c] of this.escena.cablesEn(k)) {
      const w = mapa.get(id);
      if (!w || !tocaRecorrido(c.puntos, k)) continue;
      salida.push({ id, puntos: c.puntos, desde: w.desde, hasta: w.hasta });
    }
    return salida;
  }
}
