// La consulta del trazado (T13) con el índice de la escena: los mismos datos
// que `consultaHoja`, pero sin recorrer la hoja entera. Es la que usan la
// vista previa y el comando final de la herramienta W. Un test compara las
// dos en la escena de 2000 + 3000.

import type { Cable } from "../core/model/documento";
import {
  tocaRecorrido,
  type BorneHoja,
  type CableHoja,
  type ConsultaTrazado,
  type CuerpoHoja,
} from "../core/model/trazado";
import { bornesColocados, buscarSimbolo, cajaCuerpo, type Rect } from "../core/symbols";
import type { EscenaEditable } from "../render/escenaEditable";

function seTocan(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.ancho && b.x <= a.x + a.ancho && a.y <= b.y + b.alto && b.y <= a.y + a.alto;
}

export class ConsultaEscena implements ConsultaTrazado {
  constructor(
    private readonly escena: EscenaEditable,
    /** Los cables de la hoja por id (para los extremos). */
    private readonly cables: () => ReadonlyMap<string, Cable>,
  ) {}

  bornesEn(k: Rect): BorneHoja[] {
    const salida: BorneHoja[] = [];
    for (const [id, c] of this.escena.componentesEn(k)) {
      // Un símbolo desconocido no tiene bornes ni cuerpo (como en la consulta lineal).
      if (!buscarSimbolo(c.def.tipo)) continue;
      for (const b of bornesColocados(c.def.bornes, c.x, c.y, c)) {
        if (b.x < k.x || b.x > k.x + k.ancho || b.y < k.y || b.y > k.y + k.alto) continue;
        salida.push({ comp: id, borne: b.nombre, etiqueta: c.etiqueta ?? "", x: b.x, y: b.y, direccion: b.direccion });
      }
    }
    return salida;
  }

  cuerposEn(k: Rect): CuerpoHoja[] {
    const salida: CuerpoHoja[] = [];
    for (const [id, c] of this.escena.componentesEn(k)) {
      if (!buscarSimbolo(c.def.tipo)) continue;
      const caja = cajaCuerpo(c.def.tamano, c.x, c.y, c.rotacion);
      if (seTocan(caja, k)) salida.push({ comp: id, etiqueta: c.etiqueta ?? "", caja });
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
