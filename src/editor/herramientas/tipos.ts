// Tipos compartidos por las herramientas del editor. Las herramientas no
// conocen el DOM: reciben eventos ya pasados a unidades de grilla y devuelven
// lo que hay que hacer (un comando, un redibujo de la capa dinámica, terminar).
// Así se prueban en Vitest con secuencias de eventos.

import type { Comando } from "../../core/model/comandos";
import type { LadoCable } from "../../core/model/reconectar";

/** Un evento de puntero, en unidades de grilla (sin redondear). */
export interface EventoHerramienta {
  x: number;
  y: number;
  /** Botón que cambió (0 izquierdo, 1 medio, 2 derecho); en un movimiento, 0. */
  boton: number;
  /** Botones apretados en este momento (máscara de bits de PointerEvent.buttons). */
  botones: number;
  mayus: boolean;
  ctrl: boolean;
  /** Píxeles CSS por unidad de grilla: para pasar distancias de pantalla a la grilla. */
  escala: number;
  /** Al soltar: el puntero quedó fuera del lienzo (con el puntero capturado igual llega). */
  fuera?: boolean;
}

/** Lo que pide una herramienta después de cada evento. */
export interface Resultado {
  /** Comando a ejecutar (un paso de deshacer). */
  comando?: Comando;
  /** Hay que redibujar la capa dinámica (la estática no cambia). */
  redibujar: boolean;
  /** La herramienta terminó: el editor vuelve a no tener herramienta. */
  terminar?: boolean;
  /** Selección nueva (ids). Es estado de la interfaz, no del documento: no se deshace. */
  seleccion?: ReadonlySet<string>;
  /**
   * Arrastre de elementos. "empezar": salen de la capa estática y pasan a la
   * dinámica. "terminar": vuelven a la estática, después de ejecutar
   * `comando` si lo hay (si no, quedan donde estaban).
   */
  arrastre?: { fase: "empezar"; ids: ReadonlySet<string> } | { fase: "terminar" };
  /**
   * Reconectar un extremo libre (T14c). "empezar": el cable sale de la capa
   * estática y la dinámica dibuja la previa. "mover": el cursor está en
   * (x, y) (el editor recalcula la previa y pide cuadro solo si cambió el
   * objetivo). "terminar": el cable vuelve a la estática, después de ejecutar
   * `comando` si lo hay.
   */
  reconexion?:
    | { fase: "empezar"; id: string; lado: LadoCable; x: number; y: number; escala: number }
    | { fase: "mover"; x: number; y: number; escala: number }
    | { fase: "terminar" };
  /** Aviso para la barra de estado: algo que se pidió y no se puede hacer. */
  aviso?: string;
}

/** Lo que recibe una herramienta. Cada método devuelve qué hacer. */
export interface Herramienta {
  /** Botón apretado sobre el lienzo. */
  presionar(ev: EventoHerramienta): Resultado;
  /** El mouse se movió sobre el lienzo (o, durante un gesto, en cualquier lado). */
  mover(ev: EventoHerramienta): Resultado;
  /** Botón soltado; null si el gesto se cortó (pointercancel). */
  soltar(ev: EventoHerramienta | null): Resultado;
  /** El mouse salió del lienzo. */
  salir(): Resultado;
  /** Esc. */
  cancelar(): Resultado;
}

/** Movimiento, en px CSS, a partir del cual apretar y mover es arrastrar y no clic. */
export const UMBRAL_ARRASTRE_PX = 4;

/** Nada que hacer. */
export const NADA: Resultado = Object.freeze({ redibujar: false });
