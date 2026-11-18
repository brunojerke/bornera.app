// Archivos (T15a): dónde se leen y se escriben los .brn. La lógica de
// Guardar, Guardar como, Abrir y Nuevo (archivo.ts) no sabe si corre en el
// escritorio o en el navegador: recibe una de estas.
//
// Elegir (el diálogo) va separado de leer y escribir, así los tiempos de los
// avisos ("Guardado en N ms", "Abierto en N ms") no cuentan lo que el usuario
// tarda en el diálogo (D20).
//
// - Escritorio (`archivosTauri`): el camino del usuario, con los diálogos
//   nativos (plugin dialog) y escritura segura (plugin fs): se escribe un
//   temporal `<ruta>.tmp` en la misma carpeta y se renombra sobre la ruta. La
//   ruta que da el diálogo entra sola al alcance de fs (dura la sesión). Desde
//   T24 (D8-A), la capability deja usar sin el diálogo todo `.brn` y
//   `.brn.json`, y sus temporales, sin mirar mayúsculas (`X.BRN.tmp` también):
//   Abrir reciente lo necesita después de reiniciar. El alcance de Tauri
//   distingue mayúsculas, así que los globs van con clases (`[bB][rR][nN]`).
// - Navegador (`archivosNavegador`): solo para `npm run dev` y el humo. Abrir
//   con un <input type="file">; Guardar y Guardar como, con una descarga. No
//   hay ruta, y se da por guardado al disparar la descarga.

import { open, save } from "@tauri-apps/plugin-dialog";
import { exists, readFile, remove, rename, stat, writeFile } from "@tauri-apps/plugin-fs";
import { TOPE_BYTES, type FormatoArchivo } from "./brn";

/** Un archivo elegido para abrir, todavía sin leer. */
export interface ArchivoElegido {
  /** Nombre del archivo, con la extensión ("Marcha.brn"). */
  nombre: string;
  /** Ruta completa en el escritorio; null en el navegador. */
  ruta: string | null;
  /** Tamaño en bytes: uno más grande que el tope se rechaza sin leerlo. */
  tamano: number;
  /** Lee los bytes. */
  leer(): Promise<Uint8Array>;
}

/** Dónde se guardó (el archivo actual). */
export interface Destino {
  nombre: string;
  ruta: string | null;
}

export interface Archivos {
  /** Pide un archivo para abrir (diálogo o selector). Null si se canceló. No lo lee. */
  elegirParaAbrir(): Promise<ArchivoElegido | null>;
  /**
   * Pide dónde guardar (diálogo), con el filtro del formato: `.brn` para
   * Guardar y Guardar como, `.brn.json` para Exportar. Null si se canceló. No
   * escribe.
   */
  elegirDestino(sugerido: string, formato: FormatoArchivo): Promise<Destino | null>;
  /** Escribe en ese destino, sin preguntar. */
  guardar(destino: Destino, bytes: Uint8Array): Promise<void>;
  /**
   * Abrir reciente (T24), solo en el escritorio: si el archivo de la ruta
   * existe. Tira si no se puede saber (sin permiso).
   */
  existe?(ruta: string): Promise<boolean>;
  /** Abrir reciente (T24): el archivo de la ruta, como si se lo eligiera en el diálogo. No lo lee. */
  deRuta?(ruta: string): Promise<ArchivoElegido>;
}

// ── Escritorio ─────────────────────────────────────────────────────────────

/** Filtro del diálogo de Abrir: los dos formatos (T21). */
const FILTROS_ABRIR = [{ name: "Circuito de Bornera", extensions: ["brn", "brn.json"] }];

/**
 * Filtro del diálogo de dónde guardar, por formato. En Windows, la primera
 * extensión también es la que el diálogo agrega si no se escribe ninguna.
 */
const FILTROS_GUARDAR: Readonly<Record<FormatoArchivo, { name: string; extensions: string[] }[]>> = {
  brn: [{ name: "Circuito de Bornera", extensions: ["brn"] }],
  brnJson: [{ name: "Circuito de Bornera sin comprimir", extensions: ["brn.json"] }],
};

/** Lo que la escritura segura usa del plugin fs (inyectable, para probarla). */
export interface FsEscritura {
  writeFile(ruta: string, bytes: Uint8Array): Promise<void>;
  rename(de: string, a: string): Promise<void>;
  remove(ruta: string): Promise<void>;
}

/** El temporal de la escritura segura: en la misma carpeta, así el rename no cruza discos. */
export function rutaTemporal(ruta: string): string {
  return `${ruta}.tmp`;
}

/**
 * Escritura segura: escribe `<ruta>.tmp` y lo renombra sobre `ruta` (en
 * Windows, el rename reemplaza el archivo que ya existe). Si algo falla, borra
 * el temporal y tira el error original: el archivo anterior queda como estaba.
 */
export async function escribirSeguro(ruta: string, bytes: Uint8Array, fs: FsEscritura): Promise<void> {
  const temporal = rutaTemporal(ruta);
  try {
    await fs.writeFile(temporal, bytes);
    await fs.rename(temporal, ruta);
  } catch (e) {
    try {
      await fs.remove(temporal);
    } catch {
      // El temporal puede no existir (falló al crearlo). El error que importa es el primero.
    }
    throw e;
  }
}

/** El nombre del archivo de una ruta de Windows o de Linux ("C:\\x\\Marcha.brn" da "Marcha.brn"). */
export function nombreDeRuta(ruta: string): string {
  return ruta.split(/[\\/]/).pop() || ruta;
}

/**
 * La ruta elegida con la extensión del formato, sin mirar mayúsculas (en
 * Windows, "A.BRN" ya la trae):
 * - `brn` (Guardar, Guardar como): deja `.brn` y también `.brn.json` escrito a
 *   mano (el formato lo da la extensión, D4-C); si no, agrega `.brn`.
 * - `brnJson` (Exportar): deja `.brn.json`; un `.brn` o un `.json` solo pasan
 *   a `.brn.json` (`x.brn` y `x.json` dan `x.brn.json`); si no, agrega
 *   `.brn.json`.
 */
export function conExtension(ruta: string, formato: FormatoArchivo): string {
  if (/\.brn\.json$/i.test(ruta)) return ruta;
  if (formato === "brn") return /\.brn$/i.test(ruta) ? ruta : `${ruta}.brn`;
  return `${ruta.replace(/\.(brn|json)$/i, "")}.brn.json`;
}

/**
 * El texto de un error del plugin fs para el usuario. Tauri rechaza con un
 * texto, no con un Error. "forbidden path" sale si la ruta no está en el
 * alcance (por ejemplo, un nombre con otra extensión al que se le agregó .brn).
 */
export function mensajeErrorFs(e: unknown): string {
  const t = e instanceof Error ? e.message : String(e);
  return /forbidden path/i.test(t)
    ? "Bornera no tiene permiso para usar ese archivo. Elegí un nombre que termine en .brn o .brn.json"
    : t;
}

/** Corre una llamada al plugin fs y traduce su error. */
async function conMensaje<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    throw new Error(mensajeErrorFs(e));
  }
}

/** El archivo de una ruta, sin leerlo: el tamaño antes de leer, así uno enorme no se carga entero en memoria. */
async function archivoDeRuta(ruta: string): Promise<ArchivoElegido> {
  const { size } = await conMensaje(() => stat(ruta));
  return { nombre: nombreDeRuta(ruta), ruta, tamano: size, leer: () => conMensaje(() => readFile(ruta)) };
}

export const archivosTauri: Archivos = {
  async elegirParaAbrir() {
    const ruta = await open({ multiple: false, directory: false, filters: FILTROS_ABRIR });
    if (ruta === null) return null;
    return archivoDeRuta(ruta);
  },

  existe(ruta) {
    return conMensaje(() => exists(ruta));
  },

  deRuta: archivoDeRuta,

  async elegirDestino(sugerido, formato) {
    const elegida = await save({ defaultPath: sugerido, filters: FILTROS_GUARDAR[formato] });
    if (elegida === null) return null;
    // Si se corrige el nombre, la ruta nueva no la dio el diálogo: entra al
    // alcance por los globs de `.brn` y `.brn.json` de la capability.
    const ruta = conExtension(elegida, formato);
    return { nombre: nombreDeRuta(ruta), ruta };
  },

  async guardar(destino, bytes) {
    if (destino.ruta === null) throw new Error("Falta la ruta del archivo");
    const ruta = destino.ruta;
    await conMensaje(() => escribirSeguro(ruta, bytes, { writeFile, rename, remove }));
  },
};

// ── Navegador ──────────────────────────────────────────────────────────────

/** Cuánto vive la URL de la descarga (la descarga ya empezó mucho antes). */
const VIDA_URL_MS = 60_000;

/** El <input> del último Abrir, si quedó colgado (un navegador que no avisa al cancelar). */
let entradaPendiente: HTMLInputElement | null = null;

/** Descarga los bytes con ese nombre (Guardar y Guardar como en el navegador). */
function descargar(bytes: Uint8Array, nombre: string): void {
  // Solo de tipos: los bytes nunca vienen en un SharedArrayBuffer.
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), VIDA_URL_MS);
}

export const archivosNavegador: Archivos = {
  elegirParaAbrir() {
    entradaPendiente?.remove();
    const entrada = document.createElement("input");
    entrada.type = "file";
    // `.json` y no `.brn.json`: el selector mira solo la última extensión.
    entrada.accept = ".brn,.json";
    entrada.hidden = true;
    document.body.append(entrada);
    entradaPendiente = entrada;
    return new Promise<ArchivoElegido | null>((resolver) => {
      const terminar = () => {
        entrada.remove();
        if (entradaPendiente === entrada) entradaPendiente = null;
      };
      entrada.addEventListener(
        "change",
        () => {
          const archivo = entrada.files?.[0];
          terminar();
          if (!archivo) return resolver(null);
          resolver({
            nombre: archivo.name,
            ruta: null,
            tamano: archivo.size,
            // Un byte más que el tope alcanza para que `desempaquetar` lo
            // rechace sin leer el resto (red, por si `tamano` mintiera).
            leer: async () => new Uint8Array(await archivo.slice(0, TOPE_BYTES + 1).arrayBuffer()),
          });
        },
        { once: true },
      );
      entrada.addEventListener(
        "cancel",
        () => {
          terminar();
          resolver(null);
        },
        { once: true },
      );
      entrada.click();
    });
  },

  // En el navegador no hay diálogo: la descarga lleva el nombre sugerido.
  async elegirDestino(sugerido) {
    return { nombre: sugerido, ruta: null };
  },

  async guardar(destino, bytes) {
    descargar(bytes, destino.nombre);
  },
};
