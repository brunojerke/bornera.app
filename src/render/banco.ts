// Escena de banco de pruebas: N símbolos al azar para medir el dibujado.
// El azar sale de una semilla fija, así dos corridas (o dos máquinas) dibujan
// exactamente la misma escena y los tiempos se pueden comparar.

import { SIMBOLOS, type Rotacion } from "../core/symbols";
import type { ComponenteEscena } from "./escena";
import { EscenaEditable } from "./escenaEditable";

/** Tamaños de escena del banco, como pide la arquitectura. */
export const CANTIDADES_BANCO = [100, 500, 2000] as const;
export type CantidadBanco = (typeof CANTIDADES_BANCO)[number];

/** Distancia entre posiciones posibles, en unidades: el símbolo más sus textos. */
export const PASO_BANCO = 8;
/** Fracción de posiciones ocupadas: deja huecos, como un esquema real. */
const OCUPACION = 0.75;

const ROTACIONES: Rotacion[] = [0, 90, 180, 270];

/** Letra de designación por familia de símbolo (IEC 81346): S, K, H. */
const LETRAS: Record<string, string> = { pulsador: "S", contactor: "K", senalizacion: "H" };

/** Generador pseudoaleatorio mulberry32: rápido, de 32 bits y reproducible. */
export function azar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Genera `cantidad` componentes al azar sobre una grilla cuadrada de
 * posiciones separadas PASO_BANCO, sin repetir posición.
 */
export function generarBanco(cantidad: number, semilla = 1): ComponenteEscena[] {
  const rnd = azar(semilla);
  const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(rnd() * lista.length)]!;

  const lado = Math.max(1, Math.ceil(Math.sqrt(cantidad / OCUPACION)));
  // Fisher-Yates parcial: las primeras `cantidad` posiciones, al azar y sin repetir.
  const posiciones = Array.from({ length: lado * lado }, (_, i) => i);
  for (let i = 0; i < cantidad; i++) {
    const j = i + Math.floor(rnd() * (posiciones.length - i));
    [posiciones[i], posiciones[j]] = [posiciones[j]!, posiciones[i]!];
  }

  const contadores: Record<string, number> = {};
  return posiciones.slice(0, cantidad).map((p) => {
    const def = elegir(SIMBOLOS);
    const letra = LETRAS[def.tipo.split(".")[0]!] ?? "X";
    contadores[letra] = (contadores[letra] ?? 0) + 1;
    return {
      def,
      x: (p % lado) * PASO_BANCO,
      y: Math.floor(p / lado) * PASO_BANCO,
      rotacion: elegir(ROTACIONES),
      espejado: rnd() < 0.2,
      etiqueta: `${letra}${contadores[letra]}`,
    };
  });
}

/** Id de cada componente del banco: "b0", "b1"… */
export const idBanco = (i: number) => `b${i}`;

/** La escena del banco, editable como la del editor (es lo que se quiere medir). */
export function crearEscenaBanco(cantidad: number, semilla = 1): EscenaEditable {
  return new EscenaEditable(generarBanco(cantidad, semilla).map((c, i) => [idBanco(i), c]));
}
