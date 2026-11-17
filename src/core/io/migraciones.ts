// Migraciones del formato .brn (T22, D3-A de docs/plan-fase4.md). Sin
// dependencias del navegador.
//
// Una migración pasa el JSON leído de la versión n a la n+1. Es una función
// pura:
// - Recibe lo que dio `JSON.parse`, con `formato: "bornera"` y `version: n`
//   ya revisados. Nada más está revisado.
// - Devuelve un valor nuevo, con `version: n + 1`, sin cambiar el que recibe.
// - No valida: si algo no tiene la forma que espera, lo deja como está. Lo
//   informa la etapa 4 de `deserializar`, que es estricta.
//
// `migrar` las corre en cadena entre las etapas 3 (versión) y 4 (estructura)
// de `deserializar`. Nunca tira: si una migración tira o devuelve otra cosa,
// queda un error.
//
// Hoy no hay ninguna: el formato está en la versión 1. Al subir
// `VERSION_FORMATO` a 2 se agrega acá la de 1 a 2, y el corpus congelado
// (tests/circuitos/formato-v1/) tiene que seguir abriendo.

import { VERSION_FORMATO } from "../model/documento";

type Objeto = { readonly [clave: string]: unknown };

/** Pasa el JSON de la versión n a la n+1 (ver arriba). */
export type Migracion = (datos: Objeto) => unknown;

/**
 * La versión del formato que se lee y las migraciones hasta ella: la de la
 * posición i pasa de la versión i+1 a la i+2.
 */
export interface FormatoLectura {
  readonly version: number;
  readonly migraciones: readonly Migracion[];
}

/** Las migraciones del formato, en orden. Hoy ninguna. */
export const MIGRACIONES: readonly Migracion[] = [];

/** El formato que lee la app. */
export const FORMATO_ACTUAL: FormatoLectura = { version: VERSION_FORMATO, migraciones: MIGRACIONES };

export type ResultadoMigrar = { ok: true; datos: Objeto } | { ok: false; mensaje: string };

function esObjeto(v: unknown): v is Objeto {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** El texto de lo que tiró una migración, recortado. */
function textoError(e: unknown): string {
  const t = e instanceof Error ? e.message : String(e);
  return t.length > 80 ? `${t.slice(0, 79)}…` : t;
}

/**
 * Un error si el formato no es consistente: hacen falta `version − 1`
 * migraciones. Solo puede pasar por un error de programación.
 */
export function revisarFormato(formato: FormatoLectura): string | null {
  const { version, migraciones } = formato;
  if (!Number.isSafeInteger(version) || version < 1) return `Bornera no puede leer: su versión del formato es ${String(version)}`;
  if (migraciones.length !== version - 1) {
    return `Bornera no puede leer: la lista de migraciones no corresponde al formato ${version} (tiene ${migraciones.length}; tendría que tener ${version - 1})`;
  }
  return null;
}

/**
 * Pasa `datos`, de la versión `desde`, a la versión de `formato`, una
 * migración por vez. Nunca tira. No cambia `datos`. Supone que `formato` ya
 * pasó `revisarFormato` y que 1 ≤ desde ≤ formato.version.
 */
export function migrar(datos: Objeto, desde: number, formato: FormatoLectura): ResultadoMigrar {
  let actual = datos;
  for (let n = desde; n < formato.version; n++) {
    const fallo = (que: string): ResultadoMigrar => ({ ok: false, mensaje: `No se pudo pasar del formato ${n} al ${n + 1}: ${que}` });
    const migracion = formato.migraciones[n - 1];
    if (!migracion) return fallo("falta la migración");
    let siguiente: unknown;
    try {
      siguiente = migracion(actual);
    } catch (e) {
      return fallo(`la migración falló (${textoError(e)})`);
    }
    if (!esObjeto(siguiente)) return fallo("la migración no devolvió un documento");
    if (siguiente["formato"] !== "bornera" || siguiente["version"] !== n + 1) {
      return fallo(`la migración no dejó "formato": "bornera" y "version": ${n + 1}`);
    }
    actual = siguiente;
  }
  return { ok: true, datos: actual };
}
