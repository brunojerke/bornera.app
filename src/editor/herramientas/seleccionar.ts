// Herramienta Seleccionar: la que está activa cuando no hay otra.
//
// - Clic sobre un elemento: queda seleccionado solo ese. Si ya estaba en una
//   selección de varios, el grupo se mantiene mientras el botón está apretado
//   (para arrastrarlo entero) y se reduce a ese elemento al soltar sin
//   haberse movido.
// - Apretar sobre un elemento y arrastrar: mueve toda la selección, de a
//   unidades enteras de grilla. Al soltar da un solo `Mover` (un paso de
//   deshacer); si volvió al punto de partida, nada. Esc o el botón derecho lo
//   cortan y todo queda donde estaba. Si la selección no movería nada (cables
//   atados a componentes que no se mueven), no se arrastra: se avisa una vez y
//   el gesto sigue como un clic. Si al soltar el editor rechaza el plan (una
//   conexión aparente nueva), no hay comando y todo vuelve.
// - Mayús+clic sobre un elemento: lo suma o lo quita (con Mayús no se arrastra).
// - Clic en vacío: deselecciona todo (con Mayús, no cambia nada).
// - Arrastrar desde vacío: rectángulo. De izquierda a derecha elige lo que
//   queda entero adentro ("contiene"); de derecha a izquierda, lo que lo toca
//   ("toca"). Con Mayús, lo elegido se suma a lo que ya había.
// - Esc: corta el rectángulo en curso; si no hay ninguno, deselecciona.
// - Reconectar (T14c): apretar sobre el extremo libre de un cable (dentro de
//   `radioExtremo`) y arrastrar lo lleva hasta un borne o un cable. Gana a
//   mover la selección y a cualquier otro elemento bajo el cursor, salvo un
//   borne más cercano (dentro de su tolerancia): eso lo decide
//   `Reconectar.extremoEn`. Apretar y soltar sin pasar el umbral es un clic
//   sobre el cable. Con Mayús no se reconecta. Desde un extremo libre no
//   empieza un rectángulo. Al pasar el umbral queda seleccionado solo ese
//   cable, y así sigue después de soltar; con Esc vuelve la selección de antes
//   de apretar. El botón derecho, un `pointerup` perdido o un cambio del
//   documento cortan sin paso.
//
// La selección no es parte del documento: no pasa por comandos ni se
// deshace. La herramienta no la guarda: la lee del editor y devuelve la nueva
// en `Resultado.seleccion`.

import { Mover, type Comando } from "../../core/model/comandos";
import type { LadoCable } from "../../core/model/reconectar";
import { RADIO_LIBRE, type ModoRectangulo } from "../../render/escenaEditable";
import { cajaRectangulo, type RectanguloSeleccion } from "../../render/resaltado";
import type { Caja } from "../../render/camara";
import { NADA, UMBRAL_ARRASTRE_PX, type EventoHerramienta, type Herramienta, type Resultado } from "./tipos";

/** Distancia, en px CSS, a la que un clic todavía agarra un elemento. */
export const TOLERANCIA_PX = 3;

/** Distancia, en px CSS, a la que se agarra el extremo libre de un cable (T14c; la misma que un borne en W). */
export const TOLERANCIA_EXTREMO_PX = 8;

/**
 * Radio para agarrar un extremo libre, en unidades (distancia de Chebyshev):
 * 8 px, nunca menos que el círculo que se dibuja ni más de 0,9 (dos puntos de
 * grilla vecinos están a 1).
 */
export function radioExtremo(escala: number): number {
  return Math.min(Math.max(TOLERANCIA_EXTREMO_PX / escala, RADIO_LIBRE), 0.9);
}

/** Un extremo libre que se puede agarrar para reconectarlo. */
export interface ExtremoAgarrable {
  id: string;
  lado: LadoCable;
  x: number;
  y: number;
}

/** Lo que la herramienta necesita del editor para reconectar (T14c). */
export interface Reconectar {
  /** El extremo libre que se agarra en (x, y), o null (ya con la regla del borne más cercano). */
  extremoEn(x: number, y: number, escala: number): ExtremoAgarrable | null;
  /** El comando de soltar en (x, y), con la previa; null si no vale (el editor ya avisó, si hacía falta). */
  crear(x: number, y: number, escala: number): Comando | null;
}

const SIN_RECONECTAR: Reconectar = { extremoEn: () => null, crear: () => null };

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
      /** Se apretó sobre un extremo libre (T14c): clic sobre el cable o reconectar. */
      tipo: "extremo";
      extremo: ExtremoAgarrable;
      /** Ya estaba seleccionado con otros: al soltar sin mover, queda solo él. */
      reducir: boolean;
      x0: number;
      y0: number;
      /** Pasó el umbral: se está reconectando. */
      activo: boolean;
      /** La selección de antes de apretar: Esc la devuelve. */
      previa: ReadonlySet<string>;
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
/** Fin de una reconexión: el cable vuelve a la capa estática. */
const TERMINAR_RECONEXION = { fase: "terminar" } as const;

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
    /** Aviso si esos ids no se pueden mover; null si se puede. */
    private readonly bloqueo: (ids: ReadonlySet<string>) => string | null = () => null,
    /**
     * Arma el comando del arrastre (el editor usa el plan de la previa); null
     * si no se puede soltar ahí (el editor ya avisó).
     */
    private readonly crearMover: (ids: string[], dx: number, dy: number) => Comando | null = (ids, dx, dy) => new Mover(ids, dx, dy),
    /** Reconectar extremos libres (T14c); sin esto, no se agarran. */
    private readonly reconectar: Reconectar = SIN_RECONECTAR,
  ) {}

  /** El extremo libre agarrable bajo el cursor, sin gesto (para la pista y el cursor); null si no hay. */
  private _sobre: ExtremoAgarrable | null = null;

  get sobreExtremo(): ExtremoAgarrable | null {
    return this.gesto ? null : this._sobre;
  }

  /** Hay una reconexión en curso (se pasó el umbral desde un extremo libre). */
  get reconectando(): boolean {
    return this.gesto?.tipo === "extremo" && this.gesto.activo;
  }

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
    // El botón derecho en medio de un gesto lo corta, como Esc.
    // Un apretar con un gesto abierto (el pointerup se perdió: se soltó fuera
    // de la ventana o en otra app) también: solo lo descarta, no empieza otro.
    if (this.gesto) {
      const g = this.gesto;
      this.gesto = null;
      return this.descartar(g);
    }
    if (ev.boton !== 0) return NADA;
    this._sobre = null;
    const actual = this.seleccion();
    // Un extremo libre gana a todo lo demás (con Mayús no: suma o quita el cable).
    const extremo = ev.mayus ? null : this.reconectar.extremoEn(ev.x, ev.y, ev.escala);
    if (extremo) {
      this.gesto = { tipo: "extremo", extremo, reducir: false, x0: ev.x, y0: ev.y, activo: false, previa: actual };
      if (actual.has(extremo.id)) {
        this.gesto.reducir = actual.size > 1;
        return NADA;
      }
      return this.con(new Set([extremo.id]));
    }
    const id = this.elegibles.idEnPunto(ev.x, ev.y, TOLERANCIA_PX / ev.escala);

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
    if (!g) return this.revisarSobre(ev);
    if (g.tipo === "extremo") {
      if (g.activo) return { redibujar: false, reconexion: { fase: "mover", x: ev.x, y: ev.y, escala: ev.escala } };
      if (!seMovio(ev, g.x0, g.y0)) return NADA;
      g.activo = true;
      const { id, lado } = g.extremo;
      return { redibujar: true, seleccion: new Set([id]), reconexion: { fase: "empezar", id, lado, x: ev.x, y: ev.y, escala: ev.escala } };
    }
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
      const aviso = this.bloqueo(actual);
      if (aviso) return { redibujar: false, aviso };
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

    if (g.tipo === "extremo") {
      if (!g.activo) return g.reducir ? this.con(new Set([g.extremo.id])) : NADA;
      const comando = this.reconectar.crear(ev.x, ev.y, ev.escala);
      return comando ? { comando, redibujar: true, reconexion: TERMINAR_RECONEXION } : { redibujar: true, reconexion: TERMINAR_RECONEXION };
    }
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
        const comando = this.crearMover(ids, dx, dy);
        return comando ? { comando, redibujar: true, arrastre: TERMINAR } : { redibujar: true, arrastre: TERMINAR };
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
    this._sobre = null;
    return NADA; // durante un gesto el puntero está capturado: siguen llegando eventos
  }

  /** Esc. Reconectando, además, vuelve la selección de antes de apretar. */
  cancelar(): Resultado {
    const g = this.gesto;
    this.gesto = null;
    if (g?.tipo === "extremo" && g.activo) return { ...this.descartar(g), seleccion: g.previa };
    if (g) return this.descartar(g);
    return this.seleccion().size > 0 ? this.con(VACIA) : NADA;
  }

  /** Corta el gesto en curso sin tocar la selección (el documento cambió por otra vía). */
  cortar(): Resultado {
    const g = this.gesto;
    this.gesto = null;
    return g ? this.descartar(g) : NADA;
  }

  /** Corta un gesto sin cambiar nada: borra el rectángulo o devuelve lo arrastrado a su lugar. */
  private descartar(g: Gesto): Resultado {
    if (g.tipo === "vacio") return g.rect ? { redibujar: true } : NADA;
    if (g.tipo === "extremo") return g.activo ? { redibujar: true, reconexion: TERMINAR_RECONEXION } : NADA;
    return g.arrastre ? { redibujar: true, arrastre: TERMINAR } : NADA;
  }

  /**
   * Sin gesto: anota si el cursor está sobre un extremo libre agarrable (para
   * la pista y el cursor, que el editor lee después de cada evento). No pide
   * cuadro: no se dibuja nada.
   */
  private revisarSobre(ev: EventoHerramienta): Resultado {
    const e = ev.mayus ? null : this.reconectar.extremoEn(ev.x, ev.y, ev.escala);
    const a = this._sobre;
    if (e?.id !== a?.id || e?.lado !== a?.lado) this._sobre = e;
    return NADA;
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
