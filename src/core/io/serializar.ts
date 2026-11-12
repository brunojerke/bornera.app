// Serializar: el Documento a texto .brn, en forma canónica (T15a, ver
// docs/plan-T15a.md §1). Sin dependencias del navegador.
//
// Forma canónica: un solo texto por documento.
// - Todos los campos se escriben siempre (también `espejado: false`,
//   `params: {}`, `codos: []` y `etiqueta: ""`).
// - Las claves van en un orden fijo por tipo de objeto; en `params` y
//   `contadores`, ordenadas alfabéticamente.
// - `hojas`, `componentes`, `cables` y `codos` van en el orden del documento
//   (es el orden de dibujo).
// - JSON compacto, sin BOM y sin salto de línea al final. `-0` sale como `0`.
//
// El texto se arma a mano, sin depender del orden de las claves en memoria.
// Hace falta en `params` y `contadores`: JavaScript pone primero las claves
// que parecen números ("10", "2") en cualquier objeto, así que un objeto
// armado en orden alfabético no saldría en ese orden.

import type { Cable, Componente, Documento, Extremo, Hoja, Meta } from "../model/documento";

/**
 * Un valor simple en JSON. Cada texto (valor o clave) pasa por
 * `JSON.stringify`, que escapa comillas, `\`, saltos y caracteres de control.
 * Un número sale como en JSON: `-0` da `0`. Lo que JSON no puede escribir
 * (`undefined`, un valor cambiado a mano por la consola) sale como `null`,
 * para que el texto siga siendo JSON y `deserializar` diga qué campo falla.
 */
function valor(v: unknown): string {
  return JSON.stringify(v) ?? "null";
}

/** Un objeto con las claves en el orden dado; cada valor ya viene escrito. */
function objeto(pares: readonly (readonly [string, string])[]): string {
  return `{${pares.map(([clave, texto]) => `${valor(clave)}:${texto}`).join(",")}}`;
}

/** Una lista, en su orden, con cada elemento escrito por `escribir`. */
function lista<T>(elementos: readonly T[], escribir: (e: T) => string): string {
  return `[${elementos.map(escribir).join(",")}]`;
}

/** Un mapa abierto (`params`, `contadores`): claves en orden alfabético (por unidades de código). */
function mapa(m: Readonly<Record<string, unknown>>): string {
  return objeto(
    Object.keys(m)
      .sort()
      .map((clave) => [clave, valor(m[clave])] as const),
  );
}

function meta(m: Meta): string {
  return objeto([
    ["titulo", valor(m.titulo)],
    ["autor", valor(m.autor)],
    ["fecha", valor(m.fecha)],
  ]);
}

function componente(c: Componente): string {
  return objeto([
    ["id", valor(c.id)],
    ["tipo", valor(c.tipo)],
    ["x", valor(c.x)],
    ["y", valor(c.y)],
    ["rot", valor(c.rot)],
    ["espejado", valor(c.espejado)],
    ["etiqueta", valor(c.etiqueta)],
    ["params", mapa(c.params)],
  ]);
}

function extremo(e: Extremo): string {
  switch (e.tipo) {
    case "borne":
      return objeto([
        ["tipo", valor(e.tipo)],
        ["comp", valor(e.comp)],
        ["borne", valor(e.borne)],
      ]);
    case "cable":
      return objeto([
        ["tipo", valor(e.tipo)],
        ["cable", valor(e.cable)],
        ["x", valor(e.x)],
        ["y", valor(e.y)],
      ]);
    case "libre":
      return objeto([
        ["tipo", valor(e.tipo)],
        ["x", valor(e.x)],
        ["y", valor(e.y)],
      ]);
    default:
      // Solo si el documento se cambió a mano: se escribe el tipo y
      // `deserializar` lo rechaza ("tipo de extremo desconocido").
      return objeto([["tipo", valor((e as { tipo: unknown }).tipo)]]);
  }
}

function cable(w: Cable): string {
  return objeto([
    ["id", valor(w.id)],
    ["desde", extremo(w.desde)],
    ["hasta", extremo(w.hasta)],
    // Cada codo tal cual está (un par): si en memoria tuviera otro largo, se
    // escribe así y `deserializar` lo rechaza.
    ["codos", lista(w.codos, (codo) => lista(codo, valor))],
  ]);
}

function hoja(h: Hoja): string {
  return objeto([
    ["nombre", valor(h.nombre)],
    ["componentes", lista(h.componentes, componente)],
    ["cables", lista(h.cables, cable)],
  ]);
}

/**
 * El texto .brn del documento, en forma canónica (JSON compacto, en una
 * línea). No valida: eso lo hace `deserializar` sobre este mismo texto antes
 * de escribir el archivo (D22-B). No cambia el documento.
 */
export function serializar(doc: Documento): string {
  return objeto([
    ["formato", valor(doc.formato)],
    ["version", valor(doc.version)],
    ["meta", meta(doc.meta)],
    ["contadores", mapa(doc.contadores)],
    ["hojas", lista(doc.hojas, hoja)],
  ]);
}
