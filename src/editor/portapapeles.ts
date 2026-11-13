// Portapapeles interno del editor (T16, D1-A): el último recorte copiado o
// cortado, en memoria. Es de módulo y no del `Editor`, así sobrevive a
// Ctrl+N y Ctrl+O (cada uno arma un `Editor` nuevo) y se puede pegar entre
// dos archivos en la misma ventana. No pasa entre dos instancias y se pierde
// al cerrar.
//
// El recorte es una copia (`recortar` no guarda referencias al documento):
// cambiar o borrar el original después de copiar no cambia lo que se pega.
// Deshacer no lo toca, y duplicar (Ctrl+D) tampoco.

import type { Recorte } from "../core/model/portapapeles";

let guardado: Recorte | null = null;

/** Guarda el recorte (reemplaza el anterior). */
export function guardarRecorte(r: Recorte): void {
  guardado = r;
}

/** El recorte guardado; null si todavía no se copió nada. */
export function recorteGuardado(): Recorte | null {
  return guardado;
}

/** Vacía el portapapeles. Solo para tests. */
export function vaciarPortapapeles(): void {
  guardado = null;
}
