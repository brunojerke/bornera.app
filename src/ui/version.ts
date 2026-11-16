// Versión de la app (la de package.json, que es la misma de tauri.conf.json).

import paquete from "../../package.json";

export const VERSION: string = paquete.version;

/** Una prerelease lleva un guion (0.1.3-alpha.2); una versión final, no (0.1.3). */
export function esPrerelease(version: string): boolean {
  return version.includes("-");
}

/**
 * Una prerelease (0.1.3-alpha.2) es para medir: muestra el menú de desarrollo
 * también en la versión compilada. En una versión final no aparece.
 */
export const ES_PRERELEASE = esPrerelease(VERSION);

/**
 * El menú de desarrollo, y con él «Prueba automática» y «Probar la fase 3b»:
 * en desarrollo (`npm run dev`, `tauri dev`) y en las prereleases, nunca en
 * una versión final compilada.
 */
export function mostrarMenuDesarrollo(version: string, dev: boolean): boolean {
  return dev || esPrerelease(version);
}
