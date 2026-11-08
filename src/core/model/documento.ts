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

/**
 * Extremo de un cable.
 * - "borne": conectado al borne `borne` del componente `comp`. No guarda
 *   coordenada: la posición sale del componente (`bornesColocados`).
 * - "cable": conectado a un punto de otro cable (una T). El punto es la
 *   fuente de verdad y tiene que caer sobre el recorrido de ese cable.
 * - "libre": suelto en (x, y). No conecta con nada, aunque caiga sobre un
 *   borne o un cable: reconectarlo es tarea de la herramienta cable (W).
 */
export type Extremo =
  | { tipo: "borne"; comp: string; borne: string }
  | { tipo: "cable"; cable: string; x: number; y: number }
  | { tipo: "libre"; x: number; y: number };

/**
 * Cable con codos. El recorrido es [desde, ...codos, hasta]: tramos solo
 * horizontales o verticales, en coordenadas enteras (ver `validarCable`).
 */
export interface Cable {
  /** "w1", "w2"… */
  id: string;
  desde: Extremo;
  hasta: Extremo;
  /** Solo los puntos intermedios, [x, y] enteros. */
  codos: [number, number][];
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
 * Prefijo de los ids de cables nuevos ("w1"); los de componentes son "c1". Es
 * solo para darlos: qué es cada id se sabe por la lista donde está, no por
 * el prefijo (un .brn puede traer cualquier id).
 */
export const PREFIJO_CABLE = "w";

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
