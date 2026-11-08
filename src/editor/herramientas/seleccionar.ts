// Herramienta Seleccionar: la que está activa cuando no hay otra.
//
// - Clic sobre un elemento: queda seleccionado solo ese. Si ya estaba en una
//   selección de varios, el grupo se mantiene mientras el botón está apretado
//   (para arrastrarlo entero) y se reduce a ese elemento al soltar sin
//   haberse movido.
// - Apretar sobre un elemento y arrastrar: mueve toda la selección, de a
//   unidades enteras de grilla. Al soltar da un solo `Mover` (un paso de
//   deshacer); si volvió al punto de partida, nada. Esc lo corta y todo queda
//   donde estaba.
// - Mayús+clic sobre un elemento: lo suma o lo quita (con Mayús no se arrastra).
// - Clic en vacío: deselecciona todo (con Mayús, no cambia nada).
// - Arrastrar desde vacío: rectángulo. De izquierda a derecha elige lo que
//   queda entero adentro ("contiene"); de derecha a izquierda, lo que lo toca
//   ("toca"). Con Mayús, lo elegido se suma a lo que ya había.
// - Esc: corta el rectángulo en curso; si no hay ninguno, deselecciona.
//
// La selección no es parte del documento: no pasa por comandos ni se
// deshace. La herramienta no la guarda: la lee del editor y devuelve la nueva
// en `Resultado.seleccion`.

import { Mover } from "../../core/model/comandos";
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
      /** Se apretó con Mayús: no se arrastra. */
      mayus: boolean;
      x0: number;
      y0: number;
      movio: boolean;
      /** Arrastre en curso (desde que pasó el umbral); null si no se arrastra. */
      arrastre: Arrastre | null;
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

/** Elementos que se arrastran y cuánto se corrieron, en unidades enteras de grilla. */
export interface Arrastre {
  ids: ReadonlySet<string>;
  dx: number;
  dy: number;
}

const VACIA: ReadonlySet<string> = Object.freeze(new Set<string>());

/** Fin de un arrastre: los elementos vuelven a la capa estática. */
const TERMINAR = { fase: "terminar" } as const;

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

  /**
   * Hay un gesto en curso: el botón se apretó y todavía no se soltó (clic,
   * arrastre o rectángulo). Los atajos esperan a que termine.
   */
  get enGesto(): boolean {
    return this.gesto !== null;
  }

  /** Arrastre en curso, para dibujarlo; null si no hay. */
  get arrastre(): Readonly<Arrastre> | null {
    return this.gesto?.tipo === "elemento" ? this.gesto.arrastre : null;
  }

  presionar(ev: EventoHerramienta): Resultado {
    if (ev.boton !== 0) return NADA;
    const id = this.elegibles.idEnPunto(ev.x, ev.y, TOLERANCIA_PX / ev.escala);
    const actual = this.seleccion();

    if (id === null) {
      this.gesto = { tipo: "vacio", mayus: ev.mayus, x0: ev.x, y0: ev.y, rect: null };
      return NADA;
    }

    this.gesto = { tipo: "elemento", id, reducir: false, mayus: ev.mayus, x0: ev.x, y0: ev.y, movio: false, arrastre: null };
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
      const a = g.arrastre;
      if (a) {
        // Pide un cuadro solo si cambió el punto de grilla.
        const dx = Math.round(ev.x - g.x0);
        const dy = Math.round(ev.y - g.y0);
        if (dx === a.dx && dy === a.dy) return NADA;
        a.dx = dx;
        a.dy = dy;
        return { redibujar: true };
      }
      if (g.movio || !seMovio(ev, g.x0, g.y0)) return NADA;
      g.movio = true;
      // Se arrastra la selección, si el elemento está en ella (con Mayús pudo haber salido).
      const actual = this.seleccion();
      if (g.mayus || !actual.has(g.id)) return NADA;
      g.arrastre = { ids: actual, dx: Math.round(ev.x - g.x0), dy: Math.round(ev.y - g.y0) };
      return { redibujar: true, arrastre: { fase: "empezar", ids: actual } };
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
    // Gesto cortado (pointercancel): se descarta sin cambiar nada.
    if (!ev) return this.descartar(g);

    if (g.tipo === "elemento") {
      const a = g.arrastre;
      if (a) {
        // Termina donde se soltó; si volvió al punto de partida, no hay comando.
        const dx = Math.round(ev.x - g.x0);
        const dy = Math.round(ev.y - g.y0);
        // Lo que se borró durante el arrastre ya salió de la selección: no se mueve.
        const actual = this.seleccion();
        const ids = [...a.ids].filter((id) => actual.has(id));
        if ((dx === 0 && dy === 0) || ids.length === 0) return { redibujar: true, arrastre: TERMINAR };
        return { comando: new Mover(ids, dx, dy), redibujar: true, arrastre: TERMINAR };
      }
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
    if (g) return this.descartar(g);
    return this.seleccion().size > 0 ? this.con(VACIA) : NADA;
  }

  /** Corta un gesto sin cambiar nada: borra el rectángulo o devuelve lo arrastrado a su lugar. */
  private descartar(g: Gesto): Resultado {
    if (g.tipo === "vacio") return g.rect ? { redibujar: true } : NADA;
    return g.arrastre ? { redibujar: true, arrastre: TERMINAR } : NADA;
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
