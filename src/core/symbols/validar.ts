// Chequeos de una definición de símbolo que el sistema de tipos no puede hacer.
// Cada símbolo nuevo debe pasar `validarDefinicion` en su test de bornes.

import type { DefinicionSimbolo } from "./tipos";

/** Devuelve la lista de errores de la definición; vacía si está bien. */
export function validarDefinicion(def: DefinicionSimbolo): string[] {
  const errores: string[] = [];
  const { ancho, alto } = def.tamano;

  if (def.tipo.trim() === "") errores.push("El tipo está vacío.");
  if (def.nombre.trim() === "") errores.push("El nombre está vacío.");

  if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho <= 0 || alto <= 0) {
    errores.push(`El tamaño debe ser entero y positivo (es ${ancho}×${alto}).`);
  }

  if (def.bornes.length === 0) errores.push("El símbolo no tiene bornes.");

  const nombres = new Set<string>();
  const posiciones = new Map<string, string>();
  for (const b of def.bornes) {
    if (b.nombre.trim() === "") errores.push("Hay un borne sin nombre.");

    if (nombres.has(b.nombre)) errores.push(`Borne "${b.nombre}" repetido.`);
    nombres.add(b.nombre);

    if (!Number.isInteger(b.x) || !Number.isInteger(b.y)) {
      errores.push(`Borne "${b.nombre}" fuera de la grilla: (${b.x}, ${b.y}).`);
    }

    if (Math.abs(b.x) > ancho / 2 || Math.abs(b.y) > alto / 2) {
      errores.push(`Borne "${b.nombre}" fuera de la caja del símbolo: (${b.x}, ${b.y}).`);
    }

    const clave = `${b.x},${b.y}`;
    const otro = posiciones.get(clave);
    if (otro !== undefined) {
      errores.push(`Bornes "${otro}" y "${b.nombre}" en la misma posición (${b.x}, ${b.y}).`);
    } else {
      posiciones.set(clave, b.nombre);
    }
  }

  return errores;
}
