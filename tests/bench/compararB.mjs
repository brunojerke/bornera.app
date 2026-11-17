// Comparar B1–B16 de «Probar la fase 3b» entre dos exes (T23, etapa 5;
// regla D6b-C de docs/plan-fase4.md, fijada antes de medir):
//  - En cada fila, la mediana de las corridas calientes de cada exe.
//  - Tiempos (ms): igual si la diferencia es ≤ 1 ms (piso) o ≤ 10 %.
//  - Lentos (cuadros > 16,7 ms): ±1.
//  - B9: el mismo escalón (N).
//  - Lo demás (porcentajes, cuántos cuadros) se informa y no decide.
// Puro: lo usa probar-webview2.mjs y lo prueba compararB.test.ts.

export const PISO_MS = 1;
export const TOLERANCIA = 0.1;
export const LENTOS = 1;

/** @typedef {"ms" | "lentos" | "escalon" | "info"} Tipo */
/** @typedef {{ nombre: string, tipo: Tipo, valor: number | string }} Metrica */
/** @typedef {{ id: string, nombre: string, tipo: Tipo, base: number | string, head: number | string, juicio: string | null }} FilaComparada */

/** @param {string} t */
const num = (t) => Number(String(t).replace(",", "."));

/**
 * Las filas «| Bn | … | valor | resultado |» del texto de «Copiar»: id → valor (la 5.ª columna).
 * @param {string} texto
 * @returns {Map<string, string>}
 */
export function filasB(texto) {
  /** @type {Map<string, string>} */
  const filas = new Map();
  for (const l of texto.split(/\r?\n/)) {
    if (!/^\| B\d+ \|/.test(l)) continue;
    // Las barras escapadas (\|) no separan celdas.
    const c = l
      .replace(/\\\|/g, "\u0000")
      .split("|")
      .slice(1, -1)
      .map((x) => x.trim().replace(/\u0000/g, "|"));
    filas.set(c[0] ?? "", c[4] ?? "");
  }
  return filas;
}

const N = "([\\d.,]+)";
/**
 * Formatos de la columna de lo medido (src/ui/fase3b.ts), con el tipo de cada número.
 * @type {{ re: RegExp, nombres: [string, Tipo][] }[]}
 */
const FORMATOS = [
  { re: /^N = (\S+?)(;|$)/, nombres: [["N", "escalon"]] },
  { re: new RegExp(`^${N} por gesto \\(${N} en total\\); máx\\. ${N} ms`), nombres: [["lentos por gesto", "lentos"], ["lentos en total", "lentos"], ["máx.", "ms"]] },
  { re: new RegExp(`^máx\\. ${N} ms; ${N} % > [\\d,]+ ms \\(${N} de ${N}\\)`), nombres: [["máx.", "ms"], ["%", "info"], ["lentos", "lentos"], ["cuadros", "info"]] },
  { re: new RegExp(`^${N} lentos; máx\\. ${N} ms`), nombres: [["lentos", "lentos"], ["máx.", "ms"]] },
  { re: new RegExp(`^${N} lentos; ${N} ms`), nombres: [["lentos", "lentos"], ["por gesto", "ms"]] },
  { re: new RegExp(`^${N} / ${N} ms`), nombres: [["1.º", "ms"], ["2.º", "ms"]] },
  { re: new RegExp(`^${N} ms`), nombres: [["valor", "ms"]] },
];

/**
 * Los números de una celda, con su nombre y tipo. Tira si el formato no se conoce.
 * @param {string} valor
 * @returns {Metrica[]}
 */
export function metricas(valor) {
  for (const f of FORMATOS) {
    const m = f.re.exec(valor);
    if (!m) continue;
    return f.nombres.map(([nombre, tipo], i) => ({ nombre, tipo, valor: tipo === "escalon" ? (m[i + 1] ?? "") : num(m[i + 1] ?? "") }));
  }
  throw new Error(`No conozco el formato de «${valor}»`);
}

/**
 * Mediana (con un número par, el promedio de los dos del medio).
 * @param {readonly number[]} v
 * @returns {number}
 */
export function mediana(v) {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? NaN) : ((s[m - 1] ?? NaN) + (s[m] ?? NaN)) / 2;
}

/**
 * El valor que más se repite (para el escalón de B9).
 * @param {readonly (number | string)[]} v
 */
function moda(v) {
  /** @type {Map<number | string, number>} */
  const cuenta = new Map();
  for (const x of v) cuenta.set(x, (cuenta.get(x) ?? 0) + 1);
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

/**
 * Juzga una métrica: «igual», «sube» o «baja» (o null si se informa).
 * @param {Tipo} tipo
 * @param {number | string} base
 * @param {number | string} head
 * @returns {string | null}
 */
export function juzgar(tipo, base, head) {
  if (tipo === "info") return null;
  if (tipo === "escalon") return base === head ? "igual" : "distinto";
  if (typeof base !== "number" || typeof head !== "number") throw new Error(`${tipo}: se esperaban números`);
  const d = head - base;
  const igual = tipo === "lentos" ? Math.abs(d) <= LENTOS : Math.abs(d) <= PISO_MS || Math.abs(d) <= TOLERANCIA * Math.abs(base);
  return igual ? "igual" : d > 0 ? "sube" : "baja";
}

/**
 * Compara las calientes de la base y de HEAD (textos de «Copiar»). Devuelve
 * una fila por métrica de cada B, en orden, con las medianas y el juicio.
 * `pasa` es falso si alguna sube (o si B9 cambia de escalón).
 * @param {readonly string[]} textosBase
 * @param {readonly string[]} textosHead
 * @returns {{ filas: FilaComparada[], pasa: boolean }}
 */
export function compararB(textosBase, textosHead) {
  const base = textosBase.map(filasB);
  const head = textosHead.map(filasB);
  const ids = [...(base[0]?.keys() ?? [])];
  /** @type {FilaComparada[]} */
  const filas = [];
  for (const id of ids) {
    const mb = base.map((f) => metricas(f.get(id) ?? ""));
    const mh = head.map((f) => {
      const v = f.get(id);
      if (v === undefined) throw new Error(`Falta ${id} en una corrida de HEAD`);
      return metricas(v);
    });
    for (const [i, { nombre, tipo }] of (mb[0] ?? []).entries()) {
      const vb = mb.map((m) => m[i]?.valor ?? NaN);
      const vh = mh.map((m) => m[i]?.valor ?? NaN);
      const b = tipo === "escalon" ? moda(vb) : mediana(/** @type {number[]} */ (vb));
      const h = tipo === "escalon" ? moda(vh) : mediana(/** @type {number[]} */ (vh));
      filas.push({ id, nombre, tipo, base: b, head: h, juicio: juzgar(tipo, b, h) });
    }
  }
  return { filas, pasa: filas.every((f) => f.juicio === null || f.juicio === "igual" || f.juicio === "baja") };
}
