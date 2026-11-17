// Forma por líneas del `.brn.json` (T21, D4-C): el mismo JSON canónico de
// `serializar`, con saltos de línea para que Git muestre un componente o un
// cable por línea. Función aparte: `serializar` (el `.brn`) no cambia.
//
// Forma exacta (UTF-8 sin BOM; cada línea termina en "\n", también la última):
//
//   {"formato":"bornera","version":1,
//   "meta":{…},
//   "contadores":{…},
//   "hojas":[
//   {"nombre":"Hoja 1",
//   "componentes":[
//   {un componente},          ← uno por línea, "," al final salvo el último
//   {otro componente}
//   ],
//   "cables":[
//   {un cable}                ← uno por línea, igual
//   ]},                       ← "," si sigue otra hoja
//   {"nombre":"Hoja 2",
//   "componentes":[],         ← lista vacía: en una línea
//   "cables":[]}
//   ]}
//
// Cada objeto va en forma compacta canónica, escrito por los mismos
// escritores que `serializar`. Por eso, quitando todos los "\n" queda
// exactamente `serializar(doc)`: JSON escapa los saltos dentro de los textos,
// así que los únicos "\n" son los que se agregan acá.

import type { Documento, Hoja } from "../model/documento";
import { cable, componente, mapa, meta, valor } from "./serializar";

/** Una lista con un elemento por línea; vacía, en la misma línea que su clave. */
function listaPorLineas<T>(clave: string, elementos: readonly T[], escribir: (e: T) => string, cierre: string): string[] {
  const abre = `${valor(clave)}:[`;
  if (elementos.length === 0) return [`${abre}]${cierre}`];
  return [abre, ...elementos.map((e, i) => escribir(e) + (i < elementos.length - 1 ? "," : "")), `]${cierre}`];
}

function hojaPorLineas(h: Hoja, ultima: boolean): string[] {
  return [
    `{${valor("nombre")}:${valor(h.nombre)},`,
    ...listaPorLineas("componentes", h.componentes, componente, ","),
    ...listaPorLineas("cables", h.cables, cable, ultima ? "}" : "},"),
  ];
}

/**
 * El texto `.brn.json` del documento: la forma canónica de `serializar`, con
 * un componente o un cable por línea (ver arriba). No valida y no cambia el
 * documento.
 */
export function serializarPorLineas(doc: Documento): string {
  const lineas = [
    `{${valor("formato")}:${valor(doc.formato)},${valor("version")}:${valor(doc.version)},`,
    `${valor("meta")}:${meta(doc.meta)},`,
    `${valor("contadores")}:${mapa(doc.contadores)},`,
  ];
  if (doc.hojas.length === 0) {
    // Solo si el documento se cambió a mano: `deserializar` lo rechaza.
    lineas.push(`${valor("hojas")}:[]}`);
  } else {
    lineas.push(`${valor("hojas")}:[`);
    doc.hojas.forEach((h, i) => lineas.push(...hojaPorLineas(h, i === doc.hojas.length - 1)));
    lineas.push("]}");
  }
  return lineas.map((l) => `${l}\n`).join("");
}
