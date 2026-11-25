// Contenido de la paleta (fase 6, T38, D26-A): los símbolos de la biblioteca
// por grupo (Mando, Potencia) y subgrupo, en orden fijo, con el filtro del
// buscador y el plegado. El core guarda solo el subgrupo de cada símbolo; el
// grupo, los nombres visibles y el orden salen de acá.

import type { DefinicionSimbolo, Subgrupo } from "../core/symbols";

export type Grupo = "mando" | "potencia";

/** Orden y nombre visible de los grupos. */
export const GRUPOS: readonly { id: Grupo; nombre: string }[] = [
  { id: "mando", nombre: "Mando" },
  { id: "potencia", nombre: "Potencia" },
];

/**
 * Subgrupo → grupo y nombre visible. El orden de las claves es el de la
 * paleta dentro de cada grupo. `satisfies` obliga a tener todos los subgrupos.
 */
export const SUBGRUPOS_PALETA = {
  alimentacion: { grupo: "mando", nombre: "Alimentación" },
  entradas: { grupo: "mando", nombre: "Entradas" },
  contactos: { grupo: "mando", nombre: "Contactos" },
  bobinas: { grupo: "mando", nombre: "Bobinas" },
  senalizacion: { grupo: "mando", nombre: "Señalización" },
  proteccion: { grupo: "potencia", nombre: "Protección" },
  maniobra: { grupo: "potencia", nombre: "Maniobra" },
  cargas: { grupo: "potencia", nombre: "Cargas" },
  fuentes: { grupo: "potencia", nombre: "Fuentes" },
} as const satisfies Record<Subgrupo, { grupo: Grupo; nombre: string }>;

export interface SubgrupoPaleta {
  id: Subgrupo;
  nombre: string;
  simbolos: DefinicionSimbolo[];
}

export interface GrupoPaleta {
  id: Grupo;
  nombre: string;
  subgrupos: SubgrupoPaleta[];
}

/** Minúsculas y sin tildes, para buscar "lampara" y encontrar "Lámpara". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * Agrupa por grupo y subgrupo, en el orden de GRUPOS y SUBGRUPOS_PALETA y,
 * dentro de cada subgrupo, en el orden de la biblioteca. Con `filtro`, quedan
 * los símbolos cuyo nombre lo contiene (sin distinguir tildes ni mayúsculas).
 * Los subgrupos y grupos vacíos no van.
 */
export function agruparSimbolos(simbolos: readonly DefinicionSimbolo[], filtro = ""): GrupoPaleta[] {
  const f = normalizar(filtro);
  const grupos: GrupoPaleta[] = [];
  for (const { id, nombre } of GRUPOS) {
    const subgrupos: SubgrupoPaleta[] = [];
    for (const [sub, lugar] of Object.entries(SUBGRUPOS_PALETA) as [Subgrupo, { grupo: Grupo; nombre: string }][]) {
      if (lugar.grupo !== id) continue;
      const lista = simbolos.filter((s) => s.subgrupo === sub && (!f || normalizar(s.nombre).includes(f)));
      if (lista.length > 0) subgrupos.push({ id: sub, nombre: lugar.nombre, simbolos: lista });
    }
    if (subgrupos.length > 0) grupos.push({ id, nombre, subgrupos });
  }
  return grupos;
}

/**
 * Plegado de la paleta (D28-A): en memoria, sin guardarse. Sin búsqueda manda
 * lo que plegó el usuario; con búsqueda todo se ve abierto (lo que coincide
 * queda a la vista), salvo lo que se plegue durante esa búsqueda. Al cambiar
 * o borrar la búsqueda se olvida eso y vuelve el plegado de antes.
 * Las claves son los ids de grupo y de subgrupo (no se repiten entre sí).
 */
export class Plegado {
  private readonly plegados = new Set<string>();
  private readonly plegadosBusqueda = new Set<string>();
  private buscando = false;

  /** Avisa el filtro actual; uno distinto del anterior olvida lo plegado en la búsqueda. */
  filtrar(filtro: string): void {
    this.plegadosBusqueda.clear();
    this.buscando = normalizar(filtro) !== "";
  }

  abierto(id: string): boolean {
    return !(this.buscando ? this.plegadosBusqueda : this.plegados).has(id);
  }

  alternar(id: string): void {
    const s = this.buscando ? this.plegadosBusqueda : this.plegados;
    if (!s.delete(id)) s.add(id);
  }
}
