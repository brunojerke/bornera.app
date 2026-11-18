// Factores netbook / PC (K1 y K2, D6a-B; docs/plan-fase4.md, C1 y C4), de
// los textos de «Copiar» de «Probar la fase 4» de las dos máquinas:
//  - En cada fila con K (la última columna, «K1: 12,5»), la mediana de las
//    corridas de cada máquina, y el cociente netbook / PC.
//  - K1 y K2: la mediana de los cocientes de las filas de su grupo.
//  - Una fila con 0 en la PC no da cociente: se informa y no entra.
// Puro: lo prueba factores.test.ts. La línea de comandos es
// calcular-factores.mjs.

import { mediana } from "./compararB.mjs";

/** @typedef {{ id: string, grupo: string, valor: number }} ValorK */
/** @typedef {{ id: string, grupo: string, pc: number, netbook: number, cociente: number | null }} FilaFactor */

/**
 * Las filas con K de un texto de «Copiar»: id → grupo y valor.
 * @param {string} texto
 * @returns {Map<string, ValorK>}
 */
export function valoresK(texto) {
  /** @type {Map<string, ValorK>} */
  const filas = new Map();
  for (const l of texto.split(/\r?\n/)) {
    if (!/^\| [BF]\d+ \|/.test(l)) continue;
    const c = l
      .replace(/\\\|/g, "\u0000")
      .split("|")
      .slice(1, -1)
      .map((x) => x.trim());
    const m = /^(K[12]): ([\d,]+)$/.exec(c[6] ?? "");
    if (!m) continue;
    filas.set(c[0] ?? "", { id: c[0] ?? "", grupo: m[1] ?? "", valor: Number((m[2] ?? "").replace(",", ".")) });
  }
  return filas;
}

/**
 * K1 y K2 de las corridas de la PC y de la netbook (mismo día, C4).
 * @param {readonly string[]} textosPC
 * @param {readonly string[]} textosNetbook
 * @returns {{ filas: FilaFactor[], K1: number, K2: number }}
 */
export function factores(textosPC, textosNetbook) {
  if (textosPC.length === 0 || textosNetbook.length === 0) throw new Error("Hacen falta corridas de las dos máquinas.");
  const pc = textosPC.map(valoresK);
  const nb = textosNetbook.map(valoresK);
  const ids = [...(pc[0]?.keys() ?? [])];
  if (ids.length === 0) throw new Error("El texto de la PC no tiene columna K (¿es de «Probar la fase 3b»?).");
  /** @type {FilaFactor[]} */
  const filas = [];
  for (const id of ids) {
    const de = (/** @type {Map<string, ValorK>[]} */ lado, /** @type {string} */ quien) =>
      lado.map((f) => {
        const v = f.get(id);
        if (!v) throw new Error(`Falta ${id} en una corrida de la ${quien}.`);
        return v.valor;
      });
    const p = mediana(de(pc, "PC"));
    const n = mediana(de(nb, "netbook"));
    filas.push({ id, grupo: pc[0]?.get(id)?.grupo ?? "", pc: p, netbook: n, cociente: p > 0 ? n / p : null });
  }
  const k = (/** @type {string} */ g) => mediana(filas.filter((f) => f.grupo === g && f.cociente !== null).map((f) => /** @type {number} */ (f.cociente)));
  return { filas, K1: k("K1"), K2: k("K2") };
}
