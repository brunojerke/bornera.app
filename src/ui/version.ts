// Versión de la app (la de package.json, que es la misma de tauri.conf.json).

import paquete from "../../package.json";

export const VERSION: string = paquete.version;

/**
 * Una prerelease (0.1.3-alpha.2) es para medir: muestra el menú de desarrollo
 * también en la versión compilada. En una versión final no aparece.
 */
export const ES_PRERELEASE = VERSION.includes("-");
