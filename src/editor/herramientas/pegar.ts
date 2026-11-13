// Herramienta Pegar (T16): la previa flotante de lo que se pega, que sigue al
// mouse por la grilla y se suelta con un clic. Hecha como Colocar en modo
// clic: una pegada por Ctrl+V; Esc o el botón derecho cancelan sin paso.
//
// Dos modos:
// - "pegar" (Ctrl+V): el centro de la caja del recorte, redondeado a la
//   grilla, va bajo el mouse. Si el mouse no está en el lienzo, la previa
//   aparece al entrar.
// - "duplicar" (Ctrl+D que chocó al lado, D5-C): la previa arranca al lado,
//   con sus ✕, y sigue al mouse sin saltar. Su posición es la de al lado más
//   lo que se movió el mouse desde el primer punto que se vio (el del mouse
//   al apretar Ctrl+D, si estaba sobre el lienzo: E5-A).
//
// Conflictos (D5): la previa se revisa con `problemasPegado` (lo da el
// editor, con su consulta indexada y los contadores del documento). Con
// conflictos se ve en `--aviso` con una ✕ en cada uno, la pista dice por qué
// y el clic no suelta. Con más de `TOPE_PREVIA_PEGAR` elementos no se revisa
// en cada punto: la pista lo dice y se revisa al soltar.
//
// Al clic de soltar se revisa SIEMPRE de nuevo, con cualquier tamaño, con la
// consulta y los contadores de ese momento: entre la previa y el clic pudo
// cambiar el documento, y con él las ids previstas (E1-A).
//
// R, M y Supr no hacen nada sobre la previa: lo pegado queda seleccionado y
// se gira después. Al deshacer o rehacer con la previa abierta, el editor
// llama a `revisarDeNuevo`.

import type { Conflicto } from "../../core/model/trazado";
import type { Pegar, Recorte } from "../../core/model/portapapeles";
import { enMinuscula } from "../../core/model/seguir";
import { ajustarAGrilla } from "./colocar";
import { NADA, type EventoHerramienta, type Herramienta, type Resultado } from "./tipos";

/**
 * Elementos (componentes + cables del recorte) hasta los que la previa se
 * revisa en cada punto de grilla. Con más, se revisa recién al soltar.
 * Etapa 3 de T16 (docs/bench.md): en la PC, en condiciones de T15, toda la
 * serie 40, 80, 160, 320 y 500 da la revisión por punto en p95 ≤ 5 ms sobre
 * la zona densa del banco (500: p95 de 2,9 a 3,5 ms). Queda en 160 hasta
 * medir en la netbook al cerrar la fase 3b (decisión de Bruno): en Mint, la
 * previa fue unas 6 veces más lenta que en la PC (T14a).
 */
export const TOPE_PREVIA_PEGAR = 160;

export type ModoPegar = "pegar" | "duplicar";

/** Conflictos de pegar el recorte desplazado (dx, dy), con el documento de ese momento. */
export type RevisarPegado = (recorte: Recorte, dx: number, dy: number) => Conflicto[];
/** El comando que pega el recorte desplazado (dx, dy): da las ids al construirse. */
export type CrearPegado = (recorte: Recorte, dx: number, dy: number) => Pegar;

/** Lo que dibuja la previa. */
export interface PreviaPegado {
  recorte: Recorte;
  dx: number;
  dy: number;
  /** Conflictos donde está (vacío si vale, o si no se revisó: modo reducido). */
  conflictos: readonly Conflicto[];
}

/** El aviso de una previa que no se puede soltar. */
export function textoPegar(c: Conflicto): string {
  return `No se puede pegar acá: ${enMinuscula(c.mensaje)}`;
}

/** Pista del modo reducido: la previa no se revisa en cada punto. */
export function textoPegarReducido(elementos: number): string {
  return `${elementos} elementos: recién al soltar se revisa si se puede pegar.`;
}

/** Cantidad de elementos del recorte (lo que cuenta para el tope). */
export function elementosRecorte(r: Recorte): number {
  return r.componentes.length + r.cables.length;
}

type Punto = { x: number; y: number };
type Desplazamiento = { dx: number; dy: number };

/** El centro de la caja del recorte, redondeado a la grilla. */
function centro(r: Recorte): Punto {
  const k = r.caja;
  if (!k) return { x: 0, y: 0 };
  return { x: ajustarAGrilla(k.x + k.ancho / 2), y: ajustarAGrilla(k.y + k.alto / 2) };
}

export class HerramientaPegar implements Herramienta {
  /** Punto de grilla bajo el mouse; null si el mouse no está sobre el lienzo. */
  private punto: Punto | null = null;
  /** Desplazamiento cuando el mouse está en `ref`. */
  private base: Desplazamiento;
  /** Punto del mouse que corresponde a `base`; null hasta el primero que se vea (duplicar). */
  private ref: Punto | null;
  /** Desplazamiento de la previa; null si no se ve. */
  private desp: Desplazamiento | null;
  private conflictos: readonly Conflicto[] = [];

  /**
   * En modo "duplicar", `lado` es el desplazamiento al lado y `conflictos`
   * los que dio ahí (la previa arranca visible, con sus ✕).
   */
  constructor(
    private _recorte: Recorte,
    private _modo: ModoPegar,
    private readonly revisar: RevisarPegado,
    private readonly crear: CrearPegado,
    duplicar?: { lado: Desplazamiento; conflictos: readonly Conflicto[] },
  ) {
    if (_modo === "duplicar" && duplicar) {
      this.base = { ...duplicar.lado };
      this.ref = null;
      this.desp = { ...duplicar.lado };
      this.conflictos = duplicar.conflictos;
    } else {
      this._modo = "pegar";
      this.base = { dx: 0, dy: 0 };
      this.ref = centro(_recorte);
      this.desp = null;
    }
  }

  get modo(): ModoPegar {
    return this._modo;
  }

  get recorte(): Recorte {
    return this._recorte;
  }

  /** Con más de `TOPE_PREVIA_PEGAR` elementos, la previa no se revisa en cada punto. */
  get reducido(): boolean {
    return elementosRecorte(this._recorte) > TOPE_PREVIA_PEGAR;
  }

  get previa(): PreviaPegado | null {
    const d = this.desp;
    return d && { recorte: this._recorte, dx: d.dx, dy: d.dy, conflictos: this.conflictos };
  }

  /** Por qué no se puede soltar donde está la previa, o que se revisa al soltar; null si no hay nada que decir. */
  get pista(): string | null {
    if (!this.desp) return null;
    const c = this.conflictos[0];
    if (c) return textoPegar(c);
    return this.reducido ? textoPegarReducido(elementosRecorte(this._recorte)) : null;
  }

  /**
   * Ctrl+V con la previa abierta: pega el recorte `r` (el del portapapeles),
   * en modo "pegar", centrado en el mismo punto del mouse.
   */
  reemplazar(r: Recorte): Resultado {
    const visible = this.desp !== null;
    this._recorte = r;
    this._modo = "pegar";
    this.base = { dx: 0, dy: 0 };
    this.ref = centro(r);
    this.desp = this.punto ? this.desplazamientoEn(this.punto) : null;
    this.revisarAca();
    return { redibujar: visible || this.desp !== null };
  }

  /**
   * Vuelve a revisar la previa (cambió el documento: deshacer o rehacer).
   * True si cambió lo que se ve. En modo reducido, borra lo de una revisión
   * al soltar: ya no vale.
   */
  revisarDeNuevo(): boolean {
    const antes = this.conflictos;
    this.revisarAca();
    return antes.length !== this.conflictos.length || antes.some((c, i) => c.clave !== this.conflictos[i]!.clave);
  }

  mover(ev: EventoHerramienta): Resultado {
    return this.ubicar(ev) ? { redibujar: true } : NADA;
  }

  /** El mouse salió del lienzo: se esconde la previa. */
  salir(): Resultado {
    this.punto = null;
    if (!this.desp) return NADA;
    this.desp = null;
    this.conflictos = [];
    return { redibujar: true };
  }

  /** El izquierdo suelta (si se puede); el derecho cancela. */
  presionar(ev: EventoHerramienta): Resultado {
    if (ev.boton === 2) return this.cancelar();
    if (ev.boton !== 0) return NADA;
    const movio = this.ubicar(ev);
    const d = this.desp;
    if (!d) return movio ? { redibujar: true } : NADA;
    // Siempre de nuevo, con el documento de ahora (ajuste 1).
    const antes = this.conflictos;
    this.conflictos = this.revisar(this._recorte, d.dx, d.dy);
    const c = this.conflictos[0];
    if (c) return { redibujar: movio || antes !== this.conflictos, aviso: textoPegar(c) };
    const comando = this.crear(this._recorte, d.dx, d.dy);
    this.desp = null;
    this.conflictos = [];
    return { comando, seleccion: new Set(comando.ids), redibujar: true, terminar: true };
  }

  /** Solo se suelta con clic: soltar el botón no hace nada. */
  soltar(): Resultado {
    return NADA;
  }

  /** Esc: termina sin pegar. */
  cancelar(): Resultado {
    this.desp = null;
    this.conflictos = [];
    return { redibujar: true, terminar: true };
  }

  /** Termina sin pegar (otra herramienta, cambio de escena o de modo): lo mismo que Esc. */
  terminar(): Resultado {
    return this.cancelar();
  }

  private desplazamientoEn(p: Punto): Desplazamiento {
    const ref = this.ref ?? p;
    return { dx: this.base.dx + p.x - ref.x + 0, dy: this.base.dy + p.y - ref.y + 0 };
  }

  /** Lleva la previa al punto de grilla del evento; true si cambió lo que se ve. */
  private ubicar(ev: EventoHerramienta): boolean {
    const p = { x: ajustarAGrilla(ev.x), y: ajustarAGrilla(ev.y) };
    if (this.punto && this.punto.x === p.x && this.punto.y === p.y) return false;
    this.punto = p;
    // Duplicar: el primer punto que se ve es la referencia (no salta).
    this.ref ??= p;
    const d = this.desplazamientoEn(p);
    if (this.desp && this.desp.dx === d.dx && this.desp.dy === d.dy) return false;
    this.desp = d;
    this.revisarAca();
    return true;
  }

  /** Revisa donde está la previa, salvo en modo reducido (ahí se revisa al soltar). */
  private revisarAca(): void {
    const d = this.desp;
    this.conflictos = d && !this.reducido ? this.revisar(this._recorte, d.dx, d.dy) : [];
  }
}
