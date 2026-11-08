// Tipos compartidos por los componentes de la interfaz.

import type { CantidadBanco } from "../render/banco";

/** Modo de trabajo: se alterna con el botón grande o con F5. */
export type Modo = "editar" | "simular";

/**
 * Lo que muestra el lienzo: el documento (lo normal) o, desde el menú de
 * desarrollo o con Ctrl+Shift+B, una escena de prueba: la de revisión de
 * símbolos, un banco con esa cantidad de componentes o la escena vacía.
 */
export type EscenaDesarrollo = "documento" | "simbolos" | CantidadBanco | "vacia";
