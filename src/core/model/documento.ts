// Documento: la raíz del modelo. El editor lo modifica, el simulador lo lee
// y el formato .brn lo guarda tal cual. Sin dependencias del navegador.

/** Versión actual del formato de archivo. Cada cambio de estructura la sube. */
export const VERSION_FORMATO = 1;

export interface Meta {
  titulo: string;
  autor: string;
  /** Fecha en formato ISO (AAAA-MM-DD). */
  fecha: string;
}

export interface Hoja {
  nombre: string;
}

export interface Documento {
  formato: "bornera";
  version: number;
  meta: Meta;
  hojas: Hoja[];
}

/** Crea un documento vacío con una sola hoja. */
export function crearDocumento(meta: Meta): Documento {
  return {
    formato: "bornera",
    version: VERSION_FORMATO,
    meta: { ...meta },
    hojas: [{ nombre: "Hoja 1" }],
  };
}
