// F5 alterna entre Editar y Simular. Lo atiende Ventana, también con el foco
// en un campo del panel (antes de cambiar, el panel confirma lo escrito).
// Sin esto, F5 recarga la página (también en el WebView de Tauri) y se pierde
// el documento. Ctrl+R, Ctrl+F5 y Mayús+F5 quedan libres por ahora.

import type { Modo } from "./tipos";

type Tecla = Pick<KeyboardEvent, "key" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey">;

/** true si la tecla es F5 sola, sin modificadores. */
export function esAtajoModo(e: Tecla): boolean {
  return e.key === "F5" && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey;
}

export function otroModo(m: Modo): Modo {
  return m === "editar" ? "simular" : "editar";
}

/**
 * Si F5 cambia de modo ahora. La tecla es nuestra siempre (preventDefault),
 * pero no cambia si se repite al mantenerla, con un diálogo modal abierto ni
 * durante un gesto del puntero.
 */
export function f5CambiaModo(estado: { repetida: boolean; modal: boolean; gesto: boolean }): boolean {
  return !estado.repetida && !estado.modal && !estado.gesto;
}
