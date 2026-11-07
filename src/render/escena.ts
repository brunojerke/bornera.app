// Contenido de la capa estática y escena de componentes con recorte por vista.
// Las cajas de dibujo de cada componente se calculan una sola vez al armar la
// escena; en cada redibujo solo se comparan con la parte visible.

import type { DefinicionSimbolo } from "../core/symbols";
import { unirCajas, type Caja } from "./camara";
import type { Detalle } from "./detalle";
import type { Renderer } from "./renderer";
import { cajaDibujo, dibujarMarcasBornes, dibujarSimbolo, type Colocacion } from "./simbolo";

/** Colores del tema para el contenido (salen de tema.css). */
export interface ColoresContenido {
  /** Trazo y textos de los símbolos. */
  simbolo: string;
  /** Marcas de los bornes. */
  borne: string;
}

/** Lo que el contenido necesita saber del cuadro que se está dibujando. */
export interface InfoDibujo {
  /** Píxeles CSS por unidad de grilla (para grosores mínimos en pantalla). */
  escala: number;
  colores: ColoresContenido;
  /** Parte de la grilla que se está dibujando: lo que no la toca se puede omitir. */
  visible: Caja;
  /** Qué detalles dibujar a este zoom. */
  detalle: Detalle;
}

/** Algo que se dibuja en la capa estática (en unidades de grilla). */
export interface Contenido {
  /** Caja que ocupa todo, para encuadrar; null si está vacío. */
  readonly caja: Caja | null;
  /** Cantidad de componentes, para el contador de rendimiento. */
  readonly cantidad: number;
  /** Dibuja lo que toca `info.visible`. Devuelve cuántos componentes dibujó. */
  dibujar(r: Renderer, info: InfoDibujo): number;
  /** Cuántos componentes tocan `vista` (para el contador de rendimiento). */
  contar(vista: Caja): number;
}

/** IEC 60617 pide líneas de 0,25 mm (0,1 unidad), pero en pantalla nunca menos de 1 px. */
export function grosorLinea(escala: number): number {
  return Math.max(0.1, 1 / escala);
}

/** Un símbolo puesto en la escena. */
export interface ComponenteEscena extends Colocacion {
  def: DefinicionSimbolo;
  /** Designación: "S1", "K1", "H1". */
  etiqueta?: string;
}

export interface OpcionesEscena {
  /** Marca los puntos de conexión de cada borne. Por defecto, sí. */
  marcarBornes?: boolean;
}

export class Escena implements Contenido {
  readonly caja: Caja | null;
  /** Caja de dibujo de cada componente: x0, y0, x1, y1 seguidos. */
  private readonly cajas: Float64Array;
  /** Índices visibles del último dibujo (se reusa para no pedir memoria en cada cuadro). */
  private readonly visibles: Uint32Array;
  private readonly marcarBornes: boolean;

  constructor(
    readonly componentes: readonly ComponenteEscena[],
    opciones: OpcionesEscena = {},
  ) {
    this.marcarBornes = opciones.marcarBornes ?? true;
    this.cajas = new Float64Array(componentes.length * 4);
    this.visibles = new Uint32Array(componentes.length);
    let total: Caja | null = null;
    componentes.forEach((c, i) => {
      const k = cajaDibujo(c.def, c, c.etiqueta);
      this.cajas.set([k.x, k.y, k.x + k.ancho, k.y + k.alto], i * 4);
      total = total ? unirCajas(total, k) : k;
    });
    this.caja = total;
  }

  get cantidad(): number {
    return this.componentes.length;
  }

  /** Cuántos componentes tocan `vista` y cuáles (en `this.visibles`). */
  private recortar(vista: Caja): number {
    const { cajas, visibles } = this;
    const x0 = vista.x;
    const y0 = vista.y;
    const x1 = vista.x + vista.ancho;
    const y1 = vista.y + vista.alto;
    let n = 0;
    for (let i = 0, j = 0; i < this.componentes.length; i++, j += 4) {
      if (cajas[j]! <= x1 && cajas[j + 2]! >= x0 && cajas[j + 1]! <= y1 && cajas[j + 3]! >= y0) {
        visibles[n++] = i;
      }
    }
    return n;
  }

  contar(vista: Caja): number {
    return this.recortar(vista);
  }

  /** Índices de los componentes que tocan `vista` (para tests y herramientas). */
  indicesVisibles(vista: Caja): number[] {
    return Array.from(this.visibles.subarray(0, this.recortar(vista)));
  }

  dibujar(r: Renderer, { escala, colores, visible, detalle }: InfoDibujo): number {
    const n = this.recortar(visible);
    const g = grosorLinea(escala);
    const { componentes, visibles } = this;

    // Primero todos los símbolos, después todas las marcas: así el estilo
    // cambia dos veces por cuadro y no dos veces por componente.
    r.estilo({ trazo: colores.simbolo, relleno: colores.simbolo, grosor: g });
    for (let i = 0; i < n; i++) {
      const c = componentes[visibles[i]!]!;
      dibujarSimbolo(r, c.def, c, { etiqueta: c.etiqueta, textos: detalle.textos });
    }

    if (this.marcarBornes && detalle.bornes) {
      r.estilo({ trazo: colores.borne, relleno: colores.borne, grosor: g });
      for (let i = 0; i < n; i++) {
        const c = componentes[visibles[i]!]!;
        dibujarMarcasBornes(r, c.def, c);
      }
    }
    return n;
  }
}
