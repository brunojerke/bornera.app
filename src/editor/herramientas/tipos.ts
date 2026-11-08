// Tipos compartidos por las herramientas del editor. Las herramientas no
// conocen el DOM: reciben eventos ya pasados a unidades de grilla y devuelven
// lo que hay que hacer (un comando, un redibujo de la capa dinámica, terminar).
// Así se prueban en Vitest con secuencias de eventos.

import type { Comando } from "../../core/model/comandos";

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
}

/** Lo que pide una herramienta después de cada evento. */
export interface Resultado {
  /** Comando a ejecutar (un paso de deshacer). */
  comando?: Comando;
  /** Hay que redibujar la capa dinámica (la estática no cambia). */
  redibujar: boolean;
  /** La herramienta terminó: el editor vuelve a no tener herramienta. */
  terminar?: boolean;
}

/** Nada que hacer. */
export const NADA: Resultado = Object.freeze({ redibujar: false });
