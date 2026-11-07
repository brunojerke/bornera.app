// Rotación y espejado de posiciones locales de un símbolo.
// Convención: x crece a la derecha, y crece hacia abajo (como el lienzo).
// Orden: primero el espejado horizontal y después la rotación horaria, ambos
// sobre el origen (centro del símbolo). Un punto entero queda entero.

import type { Borne, Direccion, Transformacion } from "./tipos";

/** Transformación que no cambia nada. */
export const SIN_TRANSFORMAR: Transformacion = { rotacion: 0, espejado: false };

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
