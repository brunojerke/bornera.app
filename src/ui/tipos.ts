// Tipos compartidos por los componentes de la interfaz.

import type { CantidadBanco } from "../render/banco";

/** Modo de trabajo: se alterna con el botón grande o con F5. */
export type Modo = "editar" | "simular";

/**
 * Escena elegida en el menú de desarrollo: la de revisión de símbolos o un
 * banco de pruebas con esa cantidad de componentes. TEMPORAL, hasta que el
 * documento tenga componentes.
 */
export type EscenaDesarrollo = "simbolos" | CantidadBanco;
