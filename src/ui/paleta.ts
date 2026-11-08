// Contenido de la paleta: los símbolos de la biblioteca agrupados por
// categoría, en orden fijo, con el filtro del buscador.

import type { Categoria, DefinicionSimbolo } from "../core/symbols";

/** Orden y nombre visible de cada categoría. */
export const CATEGORIAS: readonly { id: Categoria; nombre: string }[] = [
  { id: "fuentes", nombre: "Fuentes" },
  { id: "mando", nombre: "Mando" },
  { id: "potencia", nombre: "Potencia" },
  { id: "senalizacion", nombre: "Señalización" },
];

export interface GrupoPaleta {
  id: Categoria;
  nombre: string;
  simbolos: DefinicionSimbolo[];
}

/** Minúsculas y sin tildes, para buscar "lampara" y encontrar "Lámpara". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * Agrupa por categoría, en el orden de CATEGORIAS y, dentro de cada una, en el
 * orden de la biblioteca. Con `filtro`, quedan los símbolos cuyo nombre lo
 * contiene (sin distinguir tildes ni mayúsculas). Las categorías vacías no van.
 */
export function agruparSimbolos(simbolos: readonly DefinicionSimbolo[], filtro = ""): GrupoPaleta[] {
  const f = normalizar(filtro);
  const grupos: GrupoPaleta[] = [];
  for (const { id, nombre } of CATEGORIAS) {
    const lista = simbolos.filter((s) => s.categoria === id && (!f || normalizar(s.nombre).includes(f)));
    if (lista.length > 0) grupos.push({ id, nombre, simbolos: lista });
  }
  return grupos;
}
