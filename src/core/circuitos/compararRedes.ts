// Comparar redes (T15, D8-B): si un documento tiene el mismo circuito que
// otro, sin mirar ids, orden ni geometría. Sirve para la marcha-parada
// dibujada a mano en la netbook (`npm run circuito`, docs/plan-T15.md
// sección 5) y, en la fase 4, para otros circuitos de referencia. Es apoyo de
// los tests: el código de la app no lo usa.
//
// - Cada borne se nombra "etiqueta·borne", con la etiqueta normalizada
//   ("S0·11", "K1·A1"). Las dos K1 (auxiliar y bobina) comparten etiqueta y
//   se distinguen por el borne.
// - Primero los componentes, por etiqueta y tipo: falta, sobra o repetido.
//   Fase y Neutro no cuentan como repetidos: varias "N" son la misma red
//   (etiquetas.ts). Se comparan por nombre de red y tipo, y su borne sale
//   como "N·N" aunque haya varias.
// - Después la partición de los bornes, con las redes de los dos documentos
//   unidas por nombre (`unirPorNombre`): una red de la base que quedó en
//   varias ("se partió") o varias de la base que quedaron en una ("se
//   unieron"). Los cables y las redes sin bornes no se comparan.
// - Si los componentes no coinciden, las redes no se comparan: cada etiqueta
//   tiene que estar una vez para que "etiqueta·borne" diga de qué borne se
//   habla.

import type { Componente, Documento } from "../model/documento";
import { normalizarEtiqueta } from "../model/etiquetas";
import { nombreDeFuente, redes } from "../model/redes";

export const SIN_COMPARAR_REDES = "Las redes no se comparan hasta que coincidan los componentes.";

/** Un componente por etiqueta y tipo; `fuente`, el nombre de red si es Fase o Neutro (si no, null). */
interface Grupo {
  etiqueta: string;
  tipo: string;
  fuente: string | null;
  ids: string[];
}

/** Los componentes de la hoja agrupados por etiqueta normalizada y tipo, en el orden de la hoja. */
function agrupar(componentes: readonly Componente[]): Map<string, Grupo> {
  const grupos = new Map<string, Grupo>();
  for (const c of componentes) {
    const etiqueta = normalizarEtiqueta(c.etiqueta);
    const clave = JSON.stringify([etiqueta, c.tipo]);
    let g = grupos.get(clave);
    if (!g) grupos.set(clave, (g = { etiqueta, tipo: c.tipo, fuente: nombreDeFuente(c), ids: [] }));
    g.ids.push(c.id);
  }
  return grupos;
}

/** "H1" entre comillas, o "un componente sin etiqueta". */
function nombrar(etiqueta: string): string {
  return etiqueta === "" ? "un componente sin etiqueta" : `"${etiqueta}"`;
}

/** "a", "a y b", "a, b y c". */
function enumerar(partes: readonly string[]): string {
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

function llaves(red: readonly string[]): string {
  return `{${red.join(", ")}}`;
}

/** Diferencias de componentes: lo que falta, lo que sobra y lo repetido. */
function compararComponentes(dibujado: Map<string, Grupo>, base: Map<string, Grupo>): string[] {
  const diferencias: string[] = [];
  const nombresBase = new Set([...base.values()].map((g) => g.fuente).filter((n) => n !== null));
  for (const [clave, g] of base) {
    if (!dibujado.has(clave)) diferencias.push(`Falta ${nombrar(g.etiqueta)} (${g.tipo}).`);
  }
  for (const [clave, g] of dibujado) {
    const ids = g.ids.join(", ");
    if (!base.has(clave)) {
      if (g.fuente === "") diferencias.push(`Sobra una fuente sin nombre de red (${g.tipo}, ${ids}).`);
      else if (g.fuente !== null && !nombresBase.has(g.fuente)) {
        diferencias.push(`Sobra "${g.fuente}" (${g.tipo}, ${ids}): fuente con un nombre de red nuevo.`);
      } else diferencias.push(`Sobra ${nombrar(g.etiqueta)} (${g.tipo}, ${ids}).`);
    } else if (g.fuente === null && g.ids.length > 1) {
      diferencias.push(`Hay ${g.ids.length} ${g.etiqueta === "" ? "sin etiqueta" : `"${g.etiqueta}"`} (${g.tipo}): ${ids}.`);
    }
  }
  return diferencias;
}

/** Las redes con bornes, unidas por nombre, cada una como su lista de "etiqueta·borne" sin repetir. */
function particion(doc: Documento): string[][] {
  const hoja = doc.hojas[0]!;
  const etiqueta = new Map(hoja.componentes.map((c) => [c.id, normalizarEtiqueta(c.etiqueta)]));
  return redes(hoja, { unirPorNombre: true })
    .filter((r) => r.bornes.length > 0)
    .map((r) => [...new Set(r.bornes.map((b) => `${etiqueta.get(b.comp)}·${b.borne}`))]);
}

/** En qué red (índice) está cada "etiqueta·borne". */
function indicePorBorne(redesDoc: readonly string[][]): Map<string, number> {
  const indice = new Map<string, number>();
  redesDoc.forEach((red, i) => {
    for (const b of red) indice.set(b, i);
  });
  return indice;
}

/**
 * Las diferencias entre el circuito de `dibujado` y el de `base`, en texto
 * para leer; vacío si son el mismo circuito. La base tiene que tener una sola
 * hoja y ningún componente repetido (sin contar Fase y Neutro): si no, tira.
 */
export function compararRedes(dibujado: Documento, base: Documento): string[] {
  if (base.hojas.length !== 1) throw new Error(`compararRedes: la base tiene ${base.hojas.length} hojas.`);
  const gruposBase = agrupar(base.hojas[0]!.componentes);
  for (const g of gruposBase.values()) {
    if (g.fuente === null && g.ids.length > 1) {
      throw new Error(`compararRedes: la base tiene ${g.ids.length} ${nombrar(g.etiqueta)} (${g.tipo}).`);
    }
  }
  if (dibujado.hojas.length !== 1) return [`Tiene ${dibujado.hojas.length} hojas: se espera una sola.`];

  const deComponentes = compararComponentes(agrupar(dibujado.hojas[0]!.componentes), gruposBase);
  if (deComponentes.length > 0) return [...deComponentes, SIN_COMPARAR_REDES];

  const redesDibujado = particion(dibujado);
  const redesBase = particion(base);
  const enDibujado = indicePorBorne(redesDibujado);
  const enBase = indicePorBorne(redesBase);
  const diferencias: string[] = [];

  for (const red of redesBase) {
    const partes = new Map<number, string[]>();
    for (const b of red) {
      const i = enDibujado.get(b);
      if (i === undefined) continue;
      let parte = partes.get(i);
      if (!parte) partes.set(i, (parte = []));
      parte.push(b);
    }
    if (partes.size > 1) diferencias.push(`Se partió la red ${llaves(red)}: quedó en ${enumerar([...partes.values()].map(llaves))}.`);
  }
  for (const red of redesDibujado) {
    const deBase = [...new Set(red.map((b) => enBase.get(b)).filter((i) => i !== undefined))];
    if (deBase.length > 1) diferencias.push(`Se unieron las redes ${enumerar(deBase.map((i) => llaves(redesBase[i]!)))}.`);
  }
  return diferencias;
}
