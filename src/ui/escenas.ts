// Atajo oculto Ctrl+Shift+B: cicla entre las escenas del banco de pruebas, la
// escena vacía y el documento. Funciona también en la versión compilada, donde
// no está el menú de desarrollo, para medir en la netbook.

import { CANTIDADES_BANCO } from "../render/banco";
import type { EscenaDesarrollo } from "./tipos";

/** Orden del ciclo: 100, 500, 2000 símbolos, la escena vacía y vuelta al documento. */
export const CICLO_BANCO: readonly EscenaDesarrollo[] = [...CANTIDADES_BANCO, "vacia", "documento"];

/** Escena que sigue en el ciclo. Desde una escena fuera del ciclo, arranca por la primera. */
export function siguienteEscenaBanco(actual: EscenaDesarrollo): EscenaDesarrollo {
  const i = CICLO_BANCO.indexOf(actual);
  return CICLO_BANCO[(i + 1) % CICLO_BANCO.length];
}

/** true si la tecla es Ctrl+Shift+B (sin Alt ni Meta, sin importar Bloq Mayús). */
export function esAtajoBanco(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey">): boolean {
  return e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === "b";
}
