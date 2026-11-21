// «Probar la fase 5» (T31; docs/plan-fase5.md, sección 3, y docs/plan-T31.md):
// las filas S1–S5 con su tope de netbook y la tabla para copiar. Puro, sin
// DOM: lo corre probarFase5.ts en la app y lo prueban los tests en Node.
//
// La tabla es la de «Probar la fase 4» (B1–B16 y F1–F3, las mismas columnas)
// más las filas S. Las S no llevan K en la tabla: K no se recalcula en la
// fase 5 y sus cocientes se anotan aparte (sección 3), así
// `tests/bench/factores.mjs` no las suma a K1 ni a K2.
//
// Los topes de S de la netbook viven acá. Los de la PC (netbook / K) y su
// juicio (ajuste 1 de T31: mediana de las calientes ≤ tope y máximo ≤ tope +
// máx(1 ms, 10 %)) están en `tests/bench/compararB.mjs`.

import { mediana } from "./diagnostico";
import type { FilaEvaluada, Resultado } from "./fase3b";

/** Topes de la netbook (ms), sección 3 del plan de fase. */
export const TOPES_S_NETBOOK = {
  /** Entrar a Simular hasta el cuadro nítido: máx. de las vueltas. */
  S1: 300,
  /** Pulsar y soltar una marcha: mediana / máx. */
  S2: [5, 16],
  /** Cadena de 100: de pulsar a que entran los 100, máx. */
  S3: 50,
  /** Pulsar con dibujo: máx. de cuadro / por gesto (T33). */
  S4: [33, 100],
  /** R11 en la hoja entera: máx. */
  S5: 300,
} as const;

/** El K de cada fila S (D1-D: K1 = 3, K2 = 5,5), para los topes de la PC. */
export const K_S = { S1: "K2", S2: "K1", S3: "K1", S4: "K2", S5: "K1" } as const;

/** Vueltas medidas de cada S (más una de calentamiento sin medir). */
export const VUELTAS_S = { S1: 5, S2: 20, S3: 5, S5: 5 } as const;

/** Una vuelta de S1 (ms): las partes de entrar y el cuadro, y el total. */
export interface MuestraS1 {
  r4: number;
  netlist: number;
  iniciar: number;
  cuadro: number;
  total: number;
  /** Cuadros hasta quedar nítido. */
  cuadros: number;
}

/** Una vuelta de S5 (ms). */
export interface MuestraS5 {
  /** `msTrabajoR11`: la suma de los tramos, sin las esperas entre ellos (S5-A). */
  trabajo: number;
  /** Desde que se abre hasta que aparecen los avisos (informa). */
  pared: number;
  tramos: number;
  avisos: number;
}

export interface MuestrasS {
  s1: MuestraS1[];
  /** S2: pulsar y soltar la marcha, por vuelta. */
  s2: number[];
  /** S3: de pulsar a que entran los 100, por vuelta. */
  s3: number[];
  s5: MuestraS5[];
}

// ── Formato ────────────────────────────────────────────────────────────────

const unDecimal = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
const entero = new Intl.NumberFormat("es-AR", { useGrouping: false });
const v = (n: number) => unDecimal.format(n);
const e = (n: number) => entero.format(n);
const pasa = (ok: boolean): Resultado => (ok ? "pasa" : "no pasa");
const maximo = (xs: readonly number[]) => (xs.length ? Math.max(...xs) : 0);

/** Las filas S1–S5 de una corrida, juzgadas con los topes de la netbook. */
export function filasS(m: MuestrasS): FilaEvaluada[] {
  const t = TOPES_S_NETBOOK;
  const s1 = m.s1.map((x) => x.total);
  const s5 = m.s5.map((x) => x.trabajo);
  const maxMed = (xs: readonly number[]) => `${v(maximo(xs))} / ${v(mediana(xs))} ms`;
  return [
    {
      id: "S1",
      escenario: "Entrar a Simular, mando 2000 al 31 %, hasta nítido",
      medida: `máx. / mediana de ${s1.length}`,
      tope: `≤ ${e(t.S1)} ms (máx.)`,
      valor: maxMed(s1),
      resultado: pasa(s1.length > 0 && maximo(s1) <= t.S1),
    },
    {
      id: "S2",
      escenario: "Pulsar y soltar una marcha (mando 2000), sin dibujo",
      medida: `mediana / máx. de ${m.s2.length}`,
      tope: `≤ ${e(t.S2[0])} / ${e(t.S2[1])} ms`,
      valor: `${v(mediana(m.s2))} / ${v(maximo(m.s2))} ms`,
      resultado: pasa(m.s2.length > 0 && mediana(m.s2) <= t.S2[0] && maximo(m.s2) <= t.S2[1]),
    },
    {
      id: "S3",
      escenario: "Cadena de 100 relés (mando 2000): de pulsar a que entran, sin dibujo",
      medida: `máx. / mediana de ${m.s3.length}`,
      tope: `≤ ${e(t.S3)} ms (máx.)`,
      valor: maxMed(m.s3),
      resultado: pasa(m.s3.length > 0 && maximo(m.s3) <= t.S3),
    },
    {
      id: "S4",
      escenario: "Pulsar con dibujo al 31 %",
      medida: "máx. de cuadro / por gesto",
      tope: `≤ ${e(t.S4[0])} / ${e(t.S4[1])} ms`,
      valor: "se mide en T33",
      resultado: "se anota",
    },
    {
      id: "S5",
      escenario: "R11 en la hoja entera (2000 + cables), trabajo de los tramos",
      medida: `máx. / mediana de ${s5.length}`,
      tope: `≤ ${e(t.S5)} ms (máx.)`,
      valor: maxMed(s5),
      resultado: pasa(s5.length > 0 && maximo(s5) <= t.S5),
    },
  ];
}

/** Prefijo de la nota del desglose de S1 (lo lee `tests/bench/compararB.mjs`). */
export const NOTA_DESGLOSE_S1 = "S1, desglose (máx. de cada parte, ms):";
/** Prefijo de la nota del tiempo de pared de S5. */
export const NOTA_PARED_S5 = "S5, de abrir a los avisos (informa, ms):";

/** Las notas de S para debajo de la tabla: desglose de S1 (N-A: la netlist informa) y S5. */
export function notasS(m: MuestrasS, escena: { componentes: number; cables: number; bobinas: number }): string[] {
  const parte = (k: keyof MuestraS1) => v(maximo(m.s1.map((x) => x[k])));
  const s5 = m.s5[0];
  return [
    `S1–S3: escena de mando de ${escena.componentes} componentes + ${escena.cables} cables (${escena.bobinas} bobinas). Cada S con una vuelta de calentamiento sin medir.`,
    `${NOTA_DESGLOSE_S1} R4 ${parte("r4")} · netlist ${parte("netlist")} · iniciar ${parte("iniciar")} · cuadro ${parte("cuadro")} (${e(maximo(m.s1.map((x) => x.cuadros)))} cuadros como máximo).`,
    `${NOTA_PARED_S5} máx. ${v(maximo(m.s5.map((x) => x.pared)))} / mediana ${v(mediana(m.s5.map((x) => x.pared)))}` +
      (s5 ? ` · ${e(s5.tramos)} tramos y ${e(s5.avisos)} avisos R11 por vuelta.` : "."),
    "S4 se mide en T33 (S4-A). Los topes de la PC y el juicio de S los aplica tests/bench/probar-webview2.mjs --fase5.",
  ];
}
