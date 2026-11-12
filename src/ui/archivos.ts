// Archivos (T15a): dónde se leen y se escriben los .brn. La lógica de
// Guardar, Guardar como, Abrir y Nuevo (archivo.ts) no sabe si corre en el
// escritorio o en el navegador: recibe una de estas.
//
// - Escritorio (`archivosTauri`, etapa 4): el camino del usuario, con los
//   diálogos nativos y escritura segura (temporal y rename).
// - Navegador (`archivosNavegador`): solo para `npm run dev` y el humo. Abrir
//   con un <input type="file">; Guardar y Guardar como, con una descarga. No
//   hay ruta, y se da por guardado al disparar la descarga.

import { TOPE_BYTES } from "./brn";

/** Un archivo elegido y leído. */
export interface ArchivoAbierto {
  bytes: Uint8Array;
  /** Nombre del archivo, con la extensión ("Marcha.brn"). */
  nombre: string;
  /** Ruta completa en el escritorio; null en el navegador. */
  ruta: string | null;
}

/** Dónde se guardó (el archivo actual). */
export interface Destino {
  nombre: string;
  ruta: string | null;
}

export interface Archivos {
  /** Pide un archivo y lo lee. Null si se canceló. */
  abrir(): Promise<ArchivoAbierto | null>;
  /** Pide dónde guardar y escribe. Null si se canceló. */
  guardarComo(bytes: Uint8Array, sugerido: string): Promise<Destino | null>;
  /** Escribe en el archivo actual, sin preguntar. */
  guardar(destino: Destino, bytes: Uint8Array): Promise<void>;
}

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
  abrir() {
    entradaPendiente?.remove();
    const entrada = document.createElement("input");
    entrada.type = "file";
    entrada.accept = ".brn";
    entrada.hidden = true;
    document.body.append(entrada);
    entradaPendiente = entrada;
    return new Promise<ArchivoAbierto | null>((resolver, rechazar) => {
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
          // Un byte más que el tope alcanza para que `desempaquetar` lo
          // rechace sin leer el resto del archivo.
          archivo
            .slice(0, TOPE_BYTES + 1)
            .arrayBuffer()
            .then((b) => resolver({ bytes: new Uint8Array(b), nombre: archivo.name, ruta: null }), rechazar);
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

  async guardarComo(bytes, sugerido) {
    descargar(bytes, sugerido);
    return { nombre: sugerido, ruta: null };
  },

  async guardar(destino, bytes) {
    descargar(bytes, destino.nombre);
  },
};
