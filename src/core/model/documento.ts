// Documento: la raíz del modelo. El editor lo modifica, el simulador lo lee
// y el formato .brn lo guarda tal cual. Sin dependencias del navegador.

import type { Rotacion } from "../symbols/tipos";

/** Versión actual del formato de archivo. Cada cambio de estructura la sube. */
export const VERSION_FORMATO = 1;

export interface Meta {
  titulo: string;
  autor: string;
  /** Fecha en formato ISO (AAAA-MM-DD). */
  fecha: string;
}

/** Un símbolo colocado en la hoja. Coordenadas enteras, en unidades de grilla. */
export interface Componente {
  id: string;
  /** Tipo de la definición en la biblioteca: "contactor.bobina". */
  tipo: string;
  /** Posición del centro del símbolo (su pivote de rotación). */
  x: number;
  y: number;
  rot: Rotacion;
  /** Espejado horizontal, aplicado antes de rotar. */
  espejado: boolean;
  etiqueta: string;
  params: Record<string, string>;
}

/** Cable entre bornes. Por ahora solo el id: los puntos y extremos llegan en T12. */
export interface Cable {
  id: string;
}

export interface Hoja {
  nombre: string;
  componentes: Componente[];
  cables: Cable[];
}

export interface Documento {
  formato: "bornera";
  version: number;
  meta: Meta;
  /**
   * Próximo número de id por prefijo ("c" componentes, "w" cables). Solo sube:
   * un id borrado nunca se vuelve a dar. Se guarda en el .brn.
   */
  contadores: Record<string, number>;
  hojas: Hoja[];
}

/** Crea un documento vacío con una sola hoja. */
export function crearDocumento(meta: Meta): Documento {
  return {
    formato: "bornera",
    version: VERSION_FORMATO,
    meta: { ...meta },
    contadores: {},
    hojas: [{ nombre: "Hoja 1", componentes: [], cables: [] }],
  };
}

/** Busca un componente por id en todas las hojas. */
export function buscarComponente(doc: Documento, id: string): Componente | undefined {
  for (const hoja of doc.hojas) {
    const c = hoja.componentes.find((comp) => comp.id === id);
    if (c) return c;
  }
  return undefined;
}

/**
 * Da un id nuevo ("c1", "c2"…) y sube el contador del documento. No se deshace:
 * así, rehacer o deshacer nunca hace que dos objetos compartan id. Se llama al
 * construir un comando, no al aplicarlo.
 */
export function generarId(doc: Documento, prefijo = "c"): string {
  const n = doc.contadores[prefijo] ?? 1;
  doc.contadores[prefijo] = n + 1;
  return `${prefijo}${n}`;
}
