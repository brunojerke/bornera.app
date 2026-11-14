// Referencias cruzadas (T18): debajo de cada bobina, la lista de sus
// contactos. Puro y sin DOM: devuelve las filas de cada bobina y el editor
// las guarda (src/editor/referenciasHoja.ts, etapa 2). No se guarda en el
// .brn: se deriva de la hoja. Detalle en docs/plan-T18.md, sección 2.
//
// Palabras:
// - Bobina: símbolo con `elemento: "bobina"` (`esBobina`).
// - Contacto seguidor: símbolo con `accionamiento: "bobina"` (`sigueABobina`);
//   hoy, los auxiliares NA y NC.
// - Lista de una bobina: las filas de los contactos seguidores de su hoja con
//   su misma etiqueta, normalizada (`normalizarEtiqueta`) y no vacía.
// - Fila: un contacto: clase (NA o NC), sus bornes y dónde está.
//
// Casos (sin avisos: todo aviso es de T19): una bobina sin contactos, o sin
// etiqueta, no tiene lista; un contacto sin bobina, sin etiqueta o con la
// etiqueta de algo que no es bobina no aparece en ninguna; dos bobinas con la
// misma etiqueta muestran la misma lista; un símbolo desconocido no cuenta.

import { buscarSimbolo, esBobina, sigueABobina, type DefinicionSimbolo } from "../symbols";
import type { Hoja } from "./documento";
import { normalizarEtiqueta } from "./etiquetas";

export type ClaseContacto = "NA" | "NC";

/**
 * Dónde está un contacto: su hoja y su punto en unidades de grilla. El punto
 * es `Componente.x` e `y`, el centro del símbolo: lo mismo que muestra la
 * barra de estado con el cursor sobre ese centro (origen en el (0, 0) de la
 * grilla, Y hacia abajo, enteros).
 */
export interface Ubicacion {
  readonly hoja: number;
  readonly x: number;
  readonly y: number;
}

export interface FilaReferencia {
  /** Id del contacto. */
  readonly contacto: string;
  readonly clase: ClaseContacto;
  /** Nombres de sus bornes (`bornesDeFila`): "13", "14". */
  readonly bornes: readonly string[];
  readonly ubicacion: Ubicacion;
}

/** Id de bobina → sus filas, en orden. Solo las bobinas con al menos una fila. */
export type Referencias = ReadonlyMap<string, readonly FilaReferencia[]>;

/**
 * Los bornes de una fila. Es la única fuente: hoy, los nombres de la
 * definición (D0-A, bornes fijos: 13-14 y 21-22). El número de orden de los
 * auxiliares cambia solo esta función.
 */
export function bornesDeFila(def: DefinicionSimbolo): string[] {
  return def.bornes.map((b) => b.nombre);
}

/** Un contacto de una lista, con su lugar en la hoja para desempatar. */
interface Pendiente {
  fila: FilaReferencia;
  indice: number;
}

const NUMERO = /^\d+$/;

/** Dos nombres de borne: como números si los dos lo son ("9" antes que "13"); si no, como texto. */
function compararBorne(a: string, b: string): number {
  if (NUMERO.test(a) && NUMERO.test(b)) {
    const d = Number(a) - Number(b);
    if (d !== 0) return d;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Orden de las filas: por el primer borne, después por (y, x) y, a igualdad, en el de la hoja. */
function compararPendientes(a: Pendiente, b: Pendiente): number {
  return (
    compararBorne(a.fila.bornes[0] ?? "", b.fila.bornes[0] ?? "") ||
    a.fila.ubicacion.y - b.fila.ubicacion.y ||
    a.fila.ubicacion.x - b.fila.ubicacion.x ||
    a.indice - b.indice
  );
}

/**
 * Las listas de las bobinas de la hoja `indiceHoja`. Una pasada por la hoja,
 * con un mapa por etiqueta; después se ordena cada lista. Las bobinas salen
 * en el orden de la hoja, y dos con la misma etiqueta comparten la misma
 * lista (el mismo arreglo, de solo lectura). No toca la hoja.
 */
export function referenciasCruzadas(hoja: Pick<Hoja, "componentes">, indiceHoja = 0): Map<string, readonly FilaReferencia[]> {
  /** Las bobinas con etiqueta, en el orden de la hoja. */
  const bobinas: { id: string; etiqueta: string }[] = [];
  /** Etiqueta → sus contactos seguidores, en el orden de la hoja. */
  const contactos = new Map<string, Pendiente[]>();

  hoja.componentes.forEach((c, indice) => {
    const def = buscarSimbolo(c.tipo);
    const bobina = esBobina(def);
    if (!bobina && !sigueABobina(def)) return;
    const etiqueta = normalizarEtiqueta(c.etiqueta);
    if (etiqueta === "") return;
    if (bobina) {
      bobinas.push({ id: c.id, etiqueta });
      return;
    }
    const fila: FilaReferencia = {
      contacto: c.id,
      clase: def!.elemento === "contacto_nc" ? "NC" : "NA",
      bornes: bornesDeFila(def!),
      ubicacion: { hoja: indiceHoja, x: c.x, y: c.y },
    };
    const lista = contactos.get(etiqueta);
    if (lista) lista.push({ fila, indice });
    else contactos.set(etiqueta, [{ fila, indice }]);
  });

  const listas = new Map<string, readonly FilaReferencia[]>();
  const salida = new Map<string, readonly FilaReferencia[]>();
  for (const { id, etiqueta } of bobinas) {
    let filas = listas.get(etiqueta);
    if (filas === undefined) {
      const pendientes = contactos.get(etiqueta);
      if (pendientes === undefined) continue;
      filas = pendientes.sort(compararPendientes).map((p) => p.fila);
      listas.set(etiqueta, filas);
    }
    salida.set(id, filas);
  }
  return salida;
}

/**
 * La ubicación como texto: hoy, "(10, 11)", con los números como los escribe
 * la barra de estado (un negativo, con su signo). Con marco o varias hojas
 * cambia solo esta función ("B3", "2/B3").
 */
export function textoUbicacion(u: Ubicacion): string {
  return `(${u.x}, ${u.y})`;
}

/**
 * La línea que se dibuja bajo la bobina: "NA 13-14 (10, 11)". Un espacio entre
 * las partes (elegido con las capturas de la etapa 2: es la más corta y deja
 * más margen contra lo que está a la derecha de la lista).
 */
export function textoFila(f: FilaReferencia): string {
  return `${f.clase} ${f.bornes.join("-")} ${textoUbicacion(f.ubicacion)}`;
}
