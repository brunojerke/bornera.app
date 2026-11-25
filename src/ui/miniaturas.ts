// Miniaturas de la paleta (fase 6, T38; D10-A y D29-A): cada ítem registra su
// canvas; las 32 se dibujan de una vez después del primer cuadro nítido del
// lienzo (`despuesDelArranque`), también las de grupos plegados (el <details>
// conserva el DOM), y la búsqueda solo las oculta. Se rehacen solo con un
// tema o un dpr nuevo. Nada corre por cuadro.

import type { DefinicionSimbolo } from "../core/symbols";
import { dibujarMiniatura } from "../render/miniatura";
import { despuesDelArranque } from "./arranque";

/** Marca de `performance` cuando quedan dibujadas por primera vez (la mira el humo de T38). */
export const MARCA_MINIATURAS = "bornera:miniaturas";

/** Lo que la clase lee del entorno; en los tests, falsos. */
export interface EntornoMiniaturas {
  /** Color del trazo de los símbolos (`--simbolo` del tema). */
  color(): string;
  dpr(): number;
  /** El contexto 2D de un canvas registrado. */
  contexto(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null;
}

export class Miniaturas {
  private readonly items = new Map<HTMLCanvasElement, DefinicionSimbolo>();
  /** Con qué tema y dpr están dibujadas; null antes del arranque. */
  private hecho: { color: string; dpr: number } | null = null;

  constructor(private readonly entorno: EntornoMiniaturas) {}

  /** Un ítem nuevo: si ya arrancó, se dibuja ahora (uno solo). */
  registrar(canvas: HTMLCanvasElement, def: DefinicionSimbolo): void {
    this.items.set(canvas, def);
    if (this.hecho) this.dibujar(canvas, def, this.hecho.dpr, this.hecho.color);
  }

  quitar(canvas: HTMLCanvasElement): void {
    this.items.delete(canvas);
  }

  get cantidad(): number {
    return this.items.size;
  }

  get arrancada(): boolean {
    return this.hecho !== null;
  }

  /**
   * Dibuja todas si el tema o el dpr cambiaron desde la última vez (o si
   * todavía no se dibujaron). Devuelve cuántas dibujó.
   */
  actualizar(): number {
    const color = this.entorno.color();
    const dpr = this.entorno.dpr();
    if (this.hecho && this.hecho.color === color && this.hecho.dpr === dpr) return 0;
    return this.todas(color, dpr);
  }

  /** Todas de cero, aunque nada haya cambiado: lo que mide P1. Devuelve cuántas. */
  rehacer(): number {
    return this.todas(this.entorno.color(), this.entorno.dpr());
  }

  private todas(color: string, dpr: number): number {
    this.hecho = { color, dpr };
    for (const [canvas, def] of this.items) this.dibujar(canvas, def, dpr, color);
    return this.items.size;
  }

  private dibujar(canvas: HTMLCanvasElement, def: DefinicionSimbolo, dpr: number, color: string): void {
    const ctx = this.entorno.contexto(canvas);
    if (ctx) dibujarMiniatura(ctx, def, dpr, color);
  }
}

let unica: Miniaturas | null = null;

/**
 * Las miniaturas de la app: se crean la primera vez, esperan el primer cuadro
 * nítido y escuchan el tema y el dpr. Solo en el navegador.
 */
export function miniaturas(): Miniaturas {
  if (unica) return unica;
  const m = new Miniaturas({
    color: () => getComputedStyle(document.documentElement).getPropertyValue("--simbolo").trim() || "#000",
    dpr: () => window.devicePixelRatio || 1,
    contexto: (canvas) => canvas.getContext("2d"),
  });
  unica = m;
  despuesDelArranque(() => {
    m.actualizar();
    performance.mark(MARCA_MINIATURAS);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => m.actualizar());
    // El dpr cambia al pasar a otra pantalla o con el zoom: se vuelve a armar la consulta.
    const observarDpr = () => {
      const consulta = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      consulta.addEventListener(
        "change",
        () => {
          m.actualizar();
          observarDpr();
        },
        { once: true },
      );
    };
    observarDpr();
  });
  return m;
}

/** Acción de Svelte: `<canvas use:miniatura={def}>` registra el canvas y lo quita al desmontarse. */
export function miniatura(canvas: HTMLCanvasElement, def: DefinicionSimbolo): { destroy(): void } {
  const m = miniaturas();
  m.registrar(canvas, def);
  return { destroy: () => m.quitar(canvas) };
}
