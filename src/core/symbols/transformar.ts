// Rotación y espejado de posiciones locales de un símbolo.
// Convención: x crece a la derecha, y crece hacia abajo (como el lienzo).
// Orden: primero el espejado horizontal y después la rotación horaria, ambos
// sobre el origen (centro del símbolo). Un punto entero queda entero.

import type { Borne, Direccion, Rotacion, Transformacion } from "./tipos";

/** Transformación que no cambia nada. */
export const SIN_TRANSFORMAR: Transformacion = { rotacion: 0, espejado: false };

/** Lleva cualquier múltiplo de 90 (negativo, 360, 450…) a 0, 90, 180 o 270. */
export function normalizarRotacion(grados: number): Rotacion {
  if (grados % 90 !== 0) throw new RangeError(`La rotación tiene que ser múltiplo de 90 (es ${grados}).`);
  // `+ 0` convierte -0 en 0.
  return ((((grados % 360) + 360) % 360) + 0) as Rotacion;
}

// ── Componer en pantalla ───────────────────────────────────────────────────
// Lo que hacen R y M sobre un símbolo, sea uno del documento (Rotar, Espejar)
// o la vista previa al colocar: las dos usan estas funciones, así el resultado
// es el mismo. Se aplican después de la transformación que ya tiene.

/**
 * Gira 90° en pantalla sobre el centro del símbolo: horario con 90,
 * antihorario con −90. El espejado va antes de la rotación, así que solo
 * cambia la rotación.
 */
export function rotarEnPantalla(t: Transformacion, sentido: 90 | -90): Transformacion {
  return { rotacion: normalizarRotacion(t.rotacion + sentido), espejado: t.espejado };
}

/**
 * Espeja en pantalla, izquierda ↔ derecha, sobre el eje vertical del centro
 * del símbolo. Espejo en pantalla ∘ rotación θ ∘ espejo propio = rotación −θ ∘
 * (espejo propio invertido): un símbolo girado también se da vuelta en pantalla.
 */
export function espejarEnPantalla(t: Transformacion): Transformacion {
  return { rotacion: normalizarRotacion(-t.rotacion), espejado: !t.espejado };
}

/** Aplica espejado y rotación a un punto en coordenadas locales. */
export function transformarPunto(x: number, y: number, t: Transformacion): { x: number; y: number } {
  const ex = t.espejado ? -x : x;
  let rx: number;
  let ry: number;
  switch (t.rotacion) {
    case 0:
      [rx, ry] = [ex, y];
      break;
    case 90:
      [rx, ry] = [-y, ex];
      break;
    case 180:
      [rx, ry] = [-ex, -y];
      break;
    case 270:
      [rx, ry] = [y, -ex];
      break;
  }
  // `+ 0` convierte -0 en 0, para que las comparaciones no sorprendan.
  return { x: rx + 0, y: ry + 0 };
}

const VECTORES: Record<Direccion, readonly [number, number]> = {
  derecha: [1, 0],
  abajo: [0, 1],
  izquierda: [-1, 0],
  arriba: [0, -1],
};

/** Aplica espejado y rotación a la dirección de salida de un cable. */
export function transformarDireccion(d: Direccion, t: Transformacion): Direccion {
  const [vx, vy] = VECTORES[d];
  const { x, y } = transformarPunto(vx, vy, t);
  if (x === 1) return "derecha";
  if (x === -1) return "izquierda";
  return y === 1 ? "abajo" : "arriba";
}

/** Devuelve los bornes transformados, sin modificar los originales. */
export function transformarBornes(bornes: readonly Borne[], t: Transformacion): Borne[] {
  return bornes.map((b) => ({
    ...b,
    ...transformarPunto(b.x, b.y, t),
    direccion: transformarDireccion(b.direccion, t),
  }));
}

/**
 * Bornes de un símbolo colocado en (x, y) con la transformación `t`: posición
 * absoluta en la hoja y dirección de salida en pantalla. Es la única cuenta
 * de dónde queda un borne: la usan los cables, la escena y las herramientas.
 */
export function bornesColocados(bornes: readonly Borne[], x: number, y: number, t: Transformacion): Borne[] {
  return transformarBornes(bornes, t).map((b) => ({ ...b, x: b.x + x + 0, y: b.y + y + 0 }));
}

/** El borne `nombre` colocado (como `bornesColocados`), o undefined si el símbolo no lo tiene. */
export function borneColocado(
  bornes: readonly Borne[],
  nombre: string,
  x: number,
  y: number,
  t: Transformacion,
): Borne | undefined {
  const b = bornes.find((k) => k.nombre === nombre);
  if (!b) return undefined;
  const p = transformarPunto(b.x, b.y, t);
  return { nombre: b.nombre, x: p.x + x + 0, y: p.y + y + 0, direccion: transformarDireccion(b.direccion, t) };
}
