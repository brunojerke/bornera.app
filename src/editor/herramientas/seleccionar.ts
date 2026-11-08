// Herramienta Seleccionar: la que está activa cuando no hay otra.
//
// - Clic sobre un elemento: queda seleccionado solo ese. Si ya estaba en una
//   selección de varios, el grupo se mantiene mientras el botón está apretado
//   (para arrastrarlo entero en T9) y se reduce a ese elemento al soltar sin
//   haberse movido.
// - Mayús+clic sobre un elemento: lo suma o lo quita.
// - Clic en vacío: deselecciona todo (con Mayús, no cambia nada).
// - Arrastrar desde vacío: rectángulo. De izquierda a derecha elige lo que
//   queda entero adentro ("contiene"); de derecha a izquierda, lo que lo toca
//   ("toca"). Con Mayús, lo elegido se suma a lo que ya había.
// - Esc: corta el rectángulo en curso; si no hay ninguno, deselecciona.
//
// La selección no es parte del documento: no pasa por comandos ni se
// deshace. La herramienta no la guarda: la lee del editor y devuelve la nueva
// en `Resultado.seleccion`.

import type { ModoRectangulo } from "../../render/escenaEditable";
import { cajaRectangulo, type RectanguloSeleccion } from "../../render/resaltado";
import type { Caja } from "../../render/camara";
import { NADA, UMBRAL_ARRASTRE_PX, type EventoHerramienta, type Herramienta, type Resultado } from "./tipos";

/** Distancia, en px CSS, a la que un clic todavía agarra un elemento. */
export const TOLERANCIA_PX = 3;

/** Lo que la herramienta necesita para elegir (la EscenaEditable, o un falso). */
export interface Elegibles {
  idEnPunto(x: number, y: number, tolerancia: number): string | null;
  idsEnCaja(caja: Caja, modo: ModoRectangulo): string[];
}

/** Gesto en curso, desde que se aprieta el botón hasta que se suelta. */
type Gesto =
  | {
      /** Se apretó sobre un elemento. */
      tipo: "elemento";
      id: string;
      /** Ya estaba seleccionado con otros: al soltar sin mover, queda solo él. */
      reducir: boolean;
      x0: number;
      y0: number;
      movio: boolean;
    }
  | {
      /** Se apretó en vacío: clic o rectángulo. */
      tipo: "vacio";
      mayus: boolean;
      x0: number;
      y0: number;
      /** null mientras no pase el umbral (todavía es un clic). */
      rect: RectanguloSeleccion | null;
    };

const VACIA: ReadonlySet<string> = Object.freeze(new Set<string>());

/** True si el mouse ya se movió más que el umbral desde (x0, y0). */
function seMovio(ev: EventoHerramienta, x0: number, y0: number): boolean {
  return Math.hypot(ev.x - x0, ev.y - y0) * ev.escala > UMBRAL_ARRASTRE_PX;
}

/** Lleva la esquina libre del rectángulo al mouse; la dirección decide el modo. */
function extender(rect: RectanguloSeleccion, ev: EventoHerramienta): void {
  rect.x1 = ev.x;
  rect.y1 = ev.y;
  rect.modo = ev.x >= rect.x0 ? "contiene" : "toca";
}

export class HerramientaSeleccionar implements Herramienta {
  private gesto: Gesto | null = null;

  constructor(
    private readonly elegibles: Elegibles,
    /** La selección actual (la tiene el editor). */
    private readonly seleccion: () => ReadonlySet<string>,
  ) {}

  /** Rectángulo de selección en curso, para dibujarlo; null si no hay. */
  get rectangulo(): RectanguloSeleccion | null {
    return this.gesto?.tipo === "vacio" ? this.gesto.rect : null;
  }

  presionar(ev: EventoHerramienta): Resultado {
    if (ev.boton !== 0) return NADA;
    const id = this.elegibles.idEnPunto(ev.x, ev.y, TOLERANCIA_PX / ev.escala);
    const actual = this.seleccion();

    if (id === null) {
      this.gesto = { tipo: "vacio", mayus: ev.mayus, x0: ev.x, y0: ev.y, rect: null };
      return NADA;
    }

    this.gesto = { tipo: "elemento", id, reducir: false, x0: ev.x, y0: ev.y, movio: false };
    if (ev.mayus) {
      const nueva = new Set(actual);
      if (nueva.has(id)) nueva.delete(id);
      else nueva.add(id);
      return this.con(nueva);
    }
    if (actual.has(id)) {
      this.gesto.reducir = actual.size > 1;
      return NADA;
    }
    return this.con(new Set([id]));
  }

  mover(ev: EventoHerramienta): Resultado {
    const g = this.gesto;
    if (!g) return NADA;
    if (g.tipo === "elemento") {
      if (!g.movio && seMovio(ev, g.x0, g.y0)) g.movio = true; // T9: acá empieza a mover
      return NADA;
    }
    if (!g.rect) {
      if (!seMovio(ev, g.x0, g.y0)) return NADA;
      g.rect = { x0: g.x0, y0: g.y0, x1: ev.x, y1: ev.y, modo: "contiene" };
    }
    extender(g.rect, ev);
    return { redibujar: true };
  }

  soltar(ev: EventoHerramienta | null): Resultado {
    const g = this.gesto;
    this.gesto = null;
    if (!g) return NADA;
    // Gesto cortado (pointercancel): se descarta sin cambiar la selección.
    if (!ev) return g.tipo === "vacio" && g.rect ? { redibujar: true } : NADA;

    if (g.tipo === "elemento") {
      return g.reducir && !g.movio ? this.con(new Set([g.id])) : NADA;
    }
    if (!g.rect) {
      // Clic en vacío.
      if (g.mayus || this.seleccion().size === 0) return NADA;
      return this.con(VACIA);
    }
    // El rectángulo termina donde se soltó.
    extender(g.rect, ev);
    const elegidos = this.elegibles.idsEnCaja(cajaRectangulo(g.rect), g.rect.modo);
    const nueva = g.mayus ? new Set(this.seleccion()) : new Set<string>();
    for (const id of elegidos) nueva.add(id);
    // Sin cambios en la selección igual hay que borrar el rectángulo.
    return this.iguales(nueva) ? { redibujar: true } : this.con(nueva);
  }

  salir(): Resultado {
    return NADA; // durante un gesto el puntero está capturado: siguen llegando eventos
  }

  cancelar(): Resultado {
    const g = this.gesto;
    this.gesto = null;
    if (g?.tipo === "vacio" && g.rect) return { redibujar: true };
    if (g) return NADA;
    return this.seleccion().size > 0 ? this.con(VACIA) : NADA;
  }

  private con(seleccion: ReadonlySet<string>): Resultado {
    return { seleccion, redibujar: true };
  }

  private iguales(nueva: ReadonlySet<string>): boolean {
    const actual = this.seleccion();
    if (actual.size !== nueva.size) return false;
    for (const id of nueva) if (!actual.has(id)) return false;
    return true;
  }
}
