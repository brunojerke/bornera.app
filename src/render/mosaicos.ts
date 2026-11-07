// Mosaicos de la capa estática. Cada nivel de zoom se parte en cuadrados de
// TAM_MOSAICO px físicos, cada uno en su canvas fuera de pantalla. En el nivel
// k (px físicos por unidad de grilla) el punto de grilla (x, y) cae en el píxel
// global (x·k, y·k), y el mosaico (i, j) cubre los píxeles globales
// [i·T, (i+1)·T) × [j·T, (j+1)·T).
//
// Este módulo solo guarda: qué mosaicos hay y de qué nivel, cuáles descartar
// cuando hay demasiados, y los canvas libres para reusar (crear un canvas es
// caro; reusarlo, no). Qué se dibuja en cada uno lo decide Capas.

import type { RendererCanvas } from "./canvas2d";

/** Lado de un mosaico, en px físicos. */
export const TAM_MOSAICO = 256;

/** Bytes de un mosaico (4 por píxel). */
export const BYTES_MOSAICO = TAM_MOSAICO * TAM_MOSAICO * 4;

/** Canvas libres que se guardan para reusar; los demás se sueltan. */
export const RESERVA_LIBRES = 4;

export interface Mosaico {
  /** Su canvas (opaco) y el renderer que dibuja en él. */
  readonly ctx: CanvasRenderingContext2D;
  readonly r: RendererCanvas;
  /** Nivel de zoom con que se dibujó: px físicos por unidad de grilla. */
  k: number;
  i: number;
  j: number;
  /** Último cuadro en que se mostró o hizo falta: se descartan primero los que hace más que no. */
  usado: number;
}

/** Clave de un mosaico dentro de su nivel. */
export function clave(i: number, j: number): string {
  return `${i},${j}`;
}

export class Mosaicos {
  /** Nivel actual; NaN si todavía no hay ninguno. */
  k = NaN;
  /** Mosaicos del nivel actual. */
  readonly actuales = new Map<string, Mosaico>();
  /**
   * Mosaicos de niveles anteriores, del más viejo al más nuevo. Se muestran
   * escalados donde todavía falta el mosaico del nivel actual.
   */
  readonly viejos: Mosaico[] = [];
  private readonly libres: Mosaico[] = [];

  /** `crear` arma un mosaico con su canvas de TAM_MOSAICO×TAM_MOSAICO. */
  constructor(private readonly crear: () => Mosaico) {}

  /** Mosaicos con canvas (en uso y libres). */
  get cantidad(): number {
    return this.actuales.size + this.viejos.length + this.libres.length;
  }

  /** Bytes que ocupan todos los canvas. */
  get memoria(): number {
    return this.cantidad * BYTES_MOSAICO;
  }

  /** Hay algo dibujado para mostrar (de cualquier nivel). */
  get hayAlgo(): boolean {
    return this.actuales.size > 0 || this.viejos.length > 0;
  }

  /** Pasa a otro nivel: los mosaicos actuales quedan como viejos. */
  cambiarNivel(k: number): void {
    for (const m of this.actuales.values()) this.viejos.push(m);
    this.actuales.clear();
    this.k = k;
  }

  /**
   * Un canvas para dibujar el mosaico (i, j) del nivel actual, que queda
   * registrado (y reemplaza al que hubiera). Usa uno libre; si no hay, crea
   * uno mientras no haya más de `maximo`; si no, descarta el que hace más que
   * no se usa (nunca uno usado en el cuadro `cuadro`).
   */
  tomar(i: number, j: number, cuadro: number, maximo: number): Mosaico {
    const c = clave(i, j);
    let m = this.actuales.get(c) ?? this.libres.pop() ?? null;
    if (!m && this.actuales.size + this.viejos.length >= maximo) m = this.descartarUno(cuadro);
    m ??= this.crear();
    m.k = this.k;
    m.i = i;
    m.j = j;
    m.usado = cuadro;
    this.actuales.set(c, m);
    return m;
  }

  /** Suelta los mosaicos viejos (ya no hacen falta: el nivel actual cubre la pantalla). */
  soltarViejos(): void {
    for (const m of this.viejos) this.libres.push(m);
    this.viejos.length = 0;
    this.recortarLibres();
  }

  /** Suelta todos los mosaicos: el contenido cambió. Los canvas quedan para reusar. */
  vaciar(): void {
    for (const m of this.actuales.values()) this.libres.push(m);
    this.actuales.clear();
    this.soltarViejos();
  }

  /** Suelta la memoria de todos los canvas. */
  liberar(): void {
    this.vaciar();
    for (const m of this.libres) soltarCanvas(m);
    this.libres.length = 0;
    this.k = NaN;
  }

  /**
   * Saca el mosaico que hace más que no se usa (a igualdad, uno viejo) y lo
   * devuelve para reusar su canvas; null si todos se usaron en este cuadro.
   */
  private descartarUno(cuadro: number): Mosaico | null {
    let menor = cuadro;
    let indiceViejo = -1;
    let claveActual: string | null = null;
    for (let i = 0; i < this.viejos.length; i++) {
      const u = this.viejos[i]!.usado;
      if (u < menor) {
        menor = u;
        indiceViejo = i;
      }
    }
    for (const [c, m] of this.actuales) {
      if (m.usado < menor) {
        menor = m.usado;
        claveActual = c;
      }
    }
    if (claveActual !== null) {
      const m = this.actuales.get(claveActual)!;
      this.actuales.delete(claveActual);
      return m;
    }
    if (indiceViejo >= 0) return this.viejos.splice(indiceViejo, 1)[0]!;
    return null;
  }

  private recortarLibres(): void {
    while (this.libres.length > RESERVA_LIBRES) soltarCanvas(this.libres.pop()!);
  }
}

function soltarCanvas(m: Mosaico): void {
  m.ctx.canvas.width = 0;
  m.ctx.canvas.height = 0;
}
