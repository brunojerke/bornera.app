// Chequeos de una definición de símbolo que el sistema de tipos no puede hacer.
// Cada símbolo nuevo debe pasar `validarDefinicion` en su test de bornes.

import type { DefinicionSimbolo, Direccion } from "./tipos";

/**
 * Hacia dónde queda afuera desde un punto del borde de una caja de
 * `ancho` × `alto` centrada en el origen: una dirección en un lado, dos en una
 * esquina, ninguna si el punto está adentro.
 */
export function direccionesAfuera(x: number, y: number, ancho: number, alto: number): Direccion[] {
  const d: Direccion[] = [];
  if (y === -alto / 2) d.push("arriba");
  if (y === alto / 2) d.push("abajo");
  if (x === -ancho / 2) d.push("izquierda");
  if (x === ancho / 2) d.push("derecha");
  return d;
}

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
    } else {
      // En el borde y apuntando hacia afuera de ese borde: un cable no puede
      // atravesar el cuerpo (T13), así que un borne adentro sería inalcanzable.
      // En una esquina vale cualquiera de los dos bordes.
      const afuera = direccionesAfuera(b.x, b.y, ancho, alto);
      if (afuera.length === 0) {
        errores.push(`Borne "${b.nombre}" adentro de la caja del símbolo: (${b.x}, ${b.y}); tiene que estar en el borde.`);
      } else if (!afuera.includes(b.direccion)) {
        errores.push(`Borne "${b.nombre}" apunta hacia ${b.direccion}: tiene que apuntar hacia afuera (${afuera.join(" o ")}).`);
      }
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
