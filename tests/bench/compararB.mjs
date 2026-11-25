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
  // Sin corridas no hay nada que comparar: no puede salir «pasa».
  if (textosBase.length === 0 || textosHead.length === 0) throw new Error("No hay corridas para comparar (¿--corridas=1? Hacen falta al menos 2: la 1.ª es fría).");
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

// ── «Probar la fase 4» (C1; docs/plan-fase4.md, sección 6) ─────────────────

/** Topes de F en la PC con WebView2 (ms): F1 ≤ 9 sobre las calientes; F2 y F3 ≤ 1 s sobre todas. */
export const TOPES_F_PC = { F1: 9, F2: 1000, F3: 1000 };

/**
 * Las filas F1–F3 de un texto de «Probar la fase 4»: id → máx. y mediana
 * (la celda es «máx. / mediana ms»).
 * @param {string} texto
 * @returns {Map<string, { maximo: number, mediana: number }>}
 */
export function filasF(texto) {
  /** @type {Map<string, { maximo: number, mediana: number }>} */
  const filas = new Map();
  for (const l of texto.split(/\r?\n/)) {
    if (!/^\| F\d+ \|/.test(l)) continue;
    const c = l.split("|").slice(1, -1).map((x) => x.trim());
    const m = new RegExp(`^${N} / ${N} ms`).exec(c[4] ?? "");
    if (!m) throw new Error(`No conozco el formato de «${c[4]}»`);
    filas.set(c[0] ?? "", { maximo: num(m[1] ?? ""), mediana: num(m[2] ?? "") });
  }
  return filas;
}

/**
 * El juicio de F en la PC (criterio de C1): F1 en cada corrida caliente (las
 * frías se informan); F2 y F3 en todas, frías y calientes. Sobre el máximo.
 * @param {readonly string[]} frias
 * @param {readonly string[]} calientes
 * @returns {{ filas: { id: string, tope: number, deciden: number[], informan: number[], pasa: boolean }[], pasa: boolean }}
 */
export function juzgarF(frias, calientes) {
  const maximos = (/** @type {readonly string[]} */ textos, /** @type {string} */ id) =>
    textos.map((t) => {
      const f = filasF(t).get(id);
      if (!f) throw new Error(`Falta ${id} en una corrida (¿es de «Probar la fase 3b»?).`);
      return f.maximo;
    });
  const filas = Object.entries(TOPES_F_PC).map(([id, tope]) => {
    const deciden = id === "F1" ? maximos(calientes, id) : [...maximos(frias, id), ...maximos(calientes, id)];
    const informan = id === "F1" ? maximos(frias, id) : [];
    return { id, tope, deciden, informan, pasa: deciden.length > 0 && deciden.every((v) => v <= tope) };
  });
  return { filas, pasa: filas.every((f) => f.pasa) };
}

// ── «Probar la fase 5» (T31; docs/plan-T31.md) ─────────────────────────────

/**
 * Topes de S en la PC (ms): netbook / K (D1-D, K1 = 3 y K2 = 5,5), con un
 * decimal (docs/plan-fase5.md, sección 3). Por fila, los números que se
 * juzgan de la celda, en orden, con su nombre. S4 desde T33: el máximo de
 * cuadro y el del gesto.
 */
export const TOPES_S_PC = {
  S1: [{ nombre: "máx.", indice: 0, tope: 54.5 }],
  S2: [
    { nombre: "mediana", indice: 0, tope: 1.7 },
    { nombre: "máx.", indice: 1, tope: 5.3 },
  ],
  S3: [{ nombre: "máx.", indice: 0, tope: 16.7 }],
  S4: [
    { nombre: "cuadro", indice: 0, tope: 6 },
    { nombre: "gesto", indice: 1, tope: 18.2 },
  ],
  S5: [{ nombre: "máx.", indice: 0, tope: 100 }],
};

/**
 * Filas S que se juzgan solo por su tope (T33, R-A, fijado antes de medir):
 * su no regresión informa. S1 cambió de definición en T33 (la base mide el
 * sustituto sin el estado) y S4 no tiene base.
 */
export const S_SOLO_TOPE = ["S1", "S4"];

/** Si S1 pasa de esto en la PC, se avisa antes de la netbook (300 / 6,2, por el ×6,2 de B10). */
export const AVISO_S1_PC_MS = 48;

/**
 * El margen del máximo (ajuste 1 de T31): tope + máx(1 ms, 10 %).
 * @param {number} tope
 */
export const conMargen = (tope) => tope + Math.max(PISO_MS, TOLERANCIA * tope);

/**
 * Las filas S de un texto de «Probar la fase 5»: id → los dos números de la
 * celda («X / Y ms»). Antes de T33, S4 («se mide en T33») no tiene números y no sale.
 * Con `letra` = "P", las P (T38: P1; P2 no tiene esa celda y no sale).
 * @param {string} texto
 * @param {string} [letra]
 * @returns {Map<string, number[]>}
 */
export function filasS(texto, letra = "S") {
  /** @type {Map<string, number[]>} */
  const filas = new Map();
  const fila = new RegExp(`^\\| ${letra}\\d+ \\|`);
  for (const l of texto.split(/\r?\n/)) {
    if (!fila.test(l)) continue;
    const c = l.split("|").slice(1, -1).map((x) => x.trim());
    const m = new RegExp(`^${N} / ${N} ms`).exec(c[4] ?? "");
    if (m) filas.set(c[0] ?? "", [num(m[1] ?? ""), num(m[2] ?? "")]);
  }
  return filas;
}

/**
 * El juicio de S en la PC (ajuste 1 de T31, fijado antes de medir): cada
 * número pasa si la mediana de las corridas calientes ≤ tope y el máximo ≤
 * tope + máx(1 ms, 10 %). Las frías se informan y no deciden.
 * Con `omitirFaltantes` (la base de T33, que no tiene S4), una fila que no
 * está en ninguna caliente no sale; si no, tira.
 * @param {readonly string[]} frias
 * @param {readonly string[]} calientes
 * @param {boolean} [omitirFaltantes]
 */
export function juzgarS(frias, calientes, omitirFaltantes = false) {
  const valores = (/** @type {readonly string[]} */ textos, /** @type {string} */ id, /** @type {number} */ i) =>
    textos.map((t) => {
      const f = filasS(t).get(id);
      if (!f) throw new Error(`Falta ${id} en una corrida (¿es de «Probar la fase 5»?).`);
      return f[i] ?? NaN;
    });
  const presentes = Object.entries(TOPES_S_PC).filter(([id]) => !omitirFaltantes || calientes.some((t) => filasS(t).has(id)));
  const filas = presentes.flatMap(([id, numeros]) =>
    numeros.map(({ nombre, indice, tope }) => {
      const deciden = valores(calientes, id, indice);
      const med = mediana(deciden);
      const max = deciden.length ? Math.max(...deciden) : NaN;
      const margen = conMargen(tope);
      return { id, nombre, tope, margen, deciden, informan: valores(frias, id, indice), mediana: med, maximo: max, pasa: deciden.length > 0 && med <= tope && max <= margen };
    }),
  );
  return { filas, pasa: filas.every((f) => f.pasa) };
}

/**
 * La no regresión de S (T32, fijada antes de medir): con A y B en «Probar la
 * fase 5», cada número de `TOPES_S_PC` pasa si la mediana de las calientes de
 * A ≤ la de B + máx(1 ms, 10 % de la de B). Las filas de `soloTope` (T33,
 * R-A: S1 y S4) informan: siempre pasan, y una que falta en la base sale con
 * base NaN.
 * @param {readonly string[]} base calientes de B
 * @param {readonly string[]} head calientes de A
 * @param {readonly string[]} [soloTope]
 */
export function noRegresionS(base, head, soloTope = S_SOLO_TOPE) {
  if (base.length === 0 || head.length === 0) throw new Error("No hay corridas para comparar S.");
  const med = (/** @type {readonly string[]} */ textos, /** @type {string} */ id, /** @type {number} */ i, /** @type {boolean} */ puedeFaltar) =>
    mediana(
      textos.map((t) => {
        const f = filasS(t).get(id);
        if (!f) {
          if (puedeFaltar) return NaN;
          throw new Error(`Falta ${id} en una corrida (¿la base corre «Probar la fase 5»?).`);
        }
        return f[i] ?? NaN;
      }),
    );
  const filas = Object.entries(TOPES_S_PC).flatMap(([id, numeros]) =>
    numeros.map(({ nombre, indice }) => {
      const informa = soloTope.includes(id);
      const b = med(base, id, indice, informa);
      const h = med(head, id, indice, false);
      const limite = conMargen(b);
      return { id, nombre, base: b, head: h, limite, informa, pasa: informa || h <= limite };
    }),
  );
  return { filas, pasa: filas.every((f) => f.pasa) };
}

/**
 * El cierre de S de T32 (ajuste 1, fijado antes de medir): «pasa» si pasan el
 * tope y la no regresión; «causa conocida» si solo S5 no pasa el tope y su no
 * regresión pasa (aparentes de la escena del banco, pendiente `codosBanco`);
 * «frena» en cualquier otro caso (se consulta sin volver a medir).
 * @param {{ filas: { id: string, pasa: boolean }[] }} tope el de `juzgarS`
 * @param {{ filas: { id: string, pasa: boolean }[] }} regresion el de `noRegresionS`
 * @returns {"pasa" | "causa conocida" | "frena"}
 */
export function cierreS(tope, regresion) {
  if (regresion.filas.some((f) => !f.pasa)) return "frena";
  const fallan = tope.filas.filter((f) => !f.pasa);
  if (fallan.length === 0) return "pasa";
  return fallan.every((f) => f.id === "S5") ? "causa conocida" : "frena";
}

/**
 * El desglose de S1 de un texto (la nota «S1, desglose …»): parte → ms.
 * Con `fila` = "S6", el de S6 (T37).
 * @param {string} texto
 * @param {string} [fila]
 * @returns {Map<string, number>}
 */
export function desgloseS1(texto, fila = "S1") {
  /** @type {Map<string, number>} */
  const partes = new Map();
  const l = texto.split(/\r?\n/).find((x) => x.startsWith(`${fila}, desglose`));
  if (!l) return partes;
  for (const m of l.matchAll(/(R4|netlist|iniciar|cuadro) ([\d,]+)/g)) partes.set(m[1] ?? "", num(m[2] ?? ""));
  return partes;
}

/**
 * S4 sobre la cadena de 100 de un texto (la nota «S4, cadena de 100 …», T33:
 * informa): el máximo de cuadro y el de gesto; NaN si no está.
 * @param {string} texto
 * @returns {{ cuadro: number, gesto: number }}
 */
export function cadenaS4(texto) {
  const l = texto.split(/\r?\n/).find((x) => x.startsWith("S4, cadena de 100"));
  const c = l ? /cuadro máx\. ([\d,]+)/.exec(l) : null;
  const g = l ? /gesto máx\. ([\d,]+)/.exec(l) : null;
  return { cuadro: c ? num(c[1] ?? "") : NaN, gesto: g ? num(g[1] ?? "") : NaN };
}

/**
 * El tiempo de pared de S5 de un texto (la nota «S5, de abrir a los avisos …»): el máximo.
 * @param {string} texto
 */
export function paredS5(texto) {
  const l = texto.split(/\r?\n/).find((x) => x.startsWith("S5, de abrir a los avisos"));
  const m = l ? /máx\. ([\d,]+)/.exec(l) : null;
  return m ? num(m[1] ?? "") : NaN;
}

/**
 * Las frías con la regla de C4 (T20): cada valor en ms de una fría tiene que
 * quedar dentro del rango de las calientes del mismo exe, más un piso de
 * 1 ms. Devuelve los que quedan fuera, por fila y métrica.
 * @param {readonly string[]} frias
 * @param {readonly string[]} calientes
 * @returns {{ id: string, nombre: string, fuera: number[], min: number, max: number }[]}
 */
export function friasFuera(frias, calientes) {
  const valores = (/** @type {readonly string[]} */ textos) => {
    /** @type {Map<string, { id: string, nombre: string, v: number[] }>} */
    const m = new Map();
    for (const t of textos)
      for (const [id, celda] of filasB(t))
        for (const x of metricas(celda)) {
          if (x.tipo !== "ms" || typeof x.valor !== "number") continue;
          const k = `${id} ${x.nombre}`;
          if (!m.has(k)) m.set(k, { id, nombre: x.nombre, v: [] });
          m.get(k)?.v.push(x.valor);
        }
    return m;
  };
  const cal = valores(calientes);
  const salida = [];
  for (const [k, { id, nombre, v }] of valores(frias)) {
    const c = cal.get(k)?.v ?? [];
    if (c.length === 0) continue;
    const min = Math.min(...c);
    const max = Math.max(...c);
    const fuera = v.filter((x) => x < min - PISO_MS || x > max + PISO_MS);
    if (fuera.length > 0) salida.push({ id, nombre, fuera, min, max });
  }
  return salida;
}

// ── «Probar la fase 6» (T37; docs/plan-T37.md, fijado antes de medir) ──────

/**
 * Tope de S6 en la PC (ms): 300 / K2 = 54,5. Aparte de `TOPES_S_PC`, así
 * `--fase5` y `--base-fase5` no cambian. El número que se juzga es el máximo
 * de cada corrida (el 1.º de la celda «máx. / mediana ms»).
 */
export const TOPES_S6_PC = { S6: [{ nombre: "máx.", indice: 0, tope: 54.5 }] };

/**
 * Tope de P1 en la PC (ms): 50 / K2 = 9,1 (T38). Se juzga con la regla de S6
 * (ajuste 4 de T38): mediana de las calientes ≤ 9,1; máx. ≤ 10,1 aparte, con
 * una sola repetición si lo pasa una caliente.
 */
export const TOPES_P1_PC = { P1: [{ nombre: "máx.", indice: 0, tope: 9.1 }] };

/**
 * El juicio de S6 en la PC (ajuste 1 de T37, fijado antes de medir): decide
 * la mediana de las calientes ≤ tope. El máximo ≤ tope + máx(1 ms, 10 %) se
 * juzga aparte: si lo pasa una sola caliente (pico aislado), «repetir» (el
 * ABBA se repite una vez, a mano; si vuelve a pasarse, «no pasa»); si lo pasa
 * más de una, «no pasa». Las frías informan.
 * Con `topes` = TOPES_P1_PC y `letra` = "P", el de P1 (T38, la misma regla).
 * @param {readonly string[]} frias
 * @param {readonly string[]} calientes
 * @param {Record<string, { nombre: string, indice: number, tope: number }[]>} [topes]
 * @param {string} [letra]
 * @returns {{ filas: { id: string, nombre: string, tope: number, margen: number, deciden: number[], informan: number[], mediana: number, maximo: number, sobreMargen: number[], estado: "pasa" | "repetir" | "no pasa" }[], estado: "pasa" | "repetir" | "no pasa" }}
 */
export function juzgarS6(frias, calientes, topes = TOPES_S6_PC, letra = "S") {
  const valores = (/** @type {readonly string[]} */ textos, /** @type {string} */ id, /** @type {number} */ i) =>
    textos.map((t) => {
      const f = filasS(t, letra).get(id);
      if (!f) throw new Error(`Falta ${id} en una corrida (¿es de «Probar la fase 6»?).`);
      return f[i] ?? NaN;
    });
  const filas = Object.entries(topes).flatMap(([id, numeros]) =>
    numeros.map(({ nombre, indice, tope }) => {
      const deciden = valores(calientes, id, indice);
      const med = mediana(deciden);
      const max = deciden.length ? Math.max(...deciden) : NaN;
      const margen = conMargen(tope);
      const sobreMargen = deciden.filter((v) => v > margen);
      /** @type {"pasa" | "repetir" | "no pasa"} */
      const estado = deciden.length === 0 || !(med <= tope) || sobreMargen.length > 1 ? "no pasa" : sobreMargen.length === 1 ? "repetir" : "pasa";
      return { id, nombre, tope, margen, deciden, informan: valores(frias, id, indice), mediana: med, maximo: max, sobreMargen, estado };
    }),
  );
  const estado = filas.some((f) => f.estado === "no pasa") ? "no pasa" : filas.some((f) => f.estado === "repetir") ? "repetir" : "pasa";
  return { filas, estado };
}

/**
 * La no regresión de S6 (con `--base-fase6`, desde T38): mediana de las
 * calientes de A ≤ la de B + máx(1 ms, 10 %).
 * Con `topes` = TOPES_P1_PC y `letra` = "P", la de P1 (cuando la base la tenga).
 * @param {readonly string[]} base calientes de B
 * @param {readonly string[]} head calientes de A
 * @param {Record<string, { nombre: string, indice: number, tope: number }[]>} [topes]
 * @param {string} [letra]
 */
export function noRegresionS6(base, head, topes = TOPES_S6_PC, letra = "S") {
  if (base.length === 0 || head.length === 0) throw new Error("No hay corridas para comparar S6.");
  const med = (/** @type {readonly string[]} */ textos, /** @type {string} */ id, /** @type {number} */ i) =>
    mediana(
      textos.map((t) => {
        const f = filasS(t, letra).get(id);
        if (!f) throw new Error(`Falta ${id} en una corrida (¿la base corre «Probar la fase 6»?).`);
        return f[i] ?? NaN;
      }),
    );
  const filas = Object.entries(topes).flatMap(([id, numeros]) =>
    numeros.map(({ nombre, indice }) => {
      const b = med(base, id, indice);
      const h = med(head, id, indice);
      const limite = conMargen(b);
      return { id, nombre, base: b, head: h, limite, pasa: h <= limite };
    }),
  );
  return { filas, pasa: filas.every((f) => f.pasa) };
}

/** P1 en la PC (T38, ajuste 4): la regla de S6 con su tope. */
export const juzgarP1 = (/** @type {readonly string[]} */ frias, /** @type {readonly string[]} */ calientes) => juzgarS6(frias, calientes, TOPES_P1_PC, "P");

/**
 * La no regresión de P1: null si alguna corrida de la base no tiene P1
 * (T38 contra 24090e0: «sin base»); si no, la de S6 con el tope de P1.
 * @param {readonly string[]} base calientes de B
 * @param {readonly string[]} head calientes de A
 */
export function noRegresionP1(base, head) {
  if (base.length === 0 || base.some((t) => !filasS(t, "P").has("P1"))) return null;
  return noRegresionS6(base, head, TOPES_P1_PC, "P");
}

/**
 * P2 de un texto (la fila «| P2 | … | N ms |»): ms desde `timeOrigin` hasta el
 * primer cuadro nítido; NaN si no está o dice «sin marca».
 * @param {string} texto
 */
export function arranqueP2(texto) {
  const l = texto.split(/\r?\n/).find((x) => /^\| P2 \|/.test(x));
  const c = l ? l.split("|").slice(1, -1).map((x) => x.trim()) : [];
  const m = new RegExp(`^${N} ms$`).exec(c[4] ?? "");
  return m ? num(m[1] ?? "") : NaN;
}

/**
 * P2 por exe (plan de fase §4): una por apertura (la 1.ª corrida de cada una),
 * mediana de las aperturas. Con base (`--base-fase6`, T38 juzga): A ≤ B +
 * máx(1 ms, 10 %). Sin base (T37, B anterior a la marca): informa.
 * @param {readonly string[]} primerasA la 1.ª corrida de cada apertura de A
 * @param {readonly string[]} primerasB la 1.ª corrida de cada apertura de B
 */
export function juzgarP2(primerasA, primerasB) {
  const a = primerasA.map(arranqueP2);
  const b = primerasB.map(arranqueP2);
  const medA = mediana(a.filter((x) => !Number.isNaN(x)));
  const conBase = b.length > 0 && b.every((x) => !Number.isNaN(x));
  const medB = conBase ? mediana(b) : NaN;
  const limite = conBase ? conMargen(medB) : NaN;
  return { a, b, medianaA: medA, medianaB: medB, limite, juzga: conBase, pasa: conBase ? a.every((x) => !Number.isNaN(x)) && medA <= limite : null };
}

/**
 * El desglose de S6 de un texto (la nota «S6, desglose …», T37): parte → ms.
 * @param {string} texto
 */
export const desgloseS6 = (texto) => desgloseS1(texto, "S6");
