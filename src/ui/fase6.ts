// «Probar la fase 6» (T37; docs/plan-fase6.md §4 y docs/plan-T37.md): las
// filas S6 y P2 con su tope de netbook, para sumar a la tabla de «Probar la
// fase 5». Puro, sin DOM: lo corre probarFase6.ts en la app y lo prueban los
// tests en Node. P1 (miniaturas) llega con T38 (D23-A).
//
// Como las S de la fase 5, S6 y P2 no llevan K en la tabla. El tope de S6 en
// la PC (300 / K2 = 54,5 ms) y su juicio (mediana de las calientes ≤ tope; el
// máximo ≤ tope + máx(1 ms, 10 %), aparte: ajuste 1 de T37) están en
// `tests/bench/compararB.mjs`. P2 se anota: T38 la juzga contra T37.

import { mediana } from "./diagnostico";
import type { FilaEvaluada } from "./fase3b";
import type { MuestraS1 } from "./fase5";

/** Topes de la netbook (ms), sección 4 del plan de fase. */
export const TOPES_FASE6_NETBOOK = {
  /** Entrar a Simular, escena de potencia 2000 al 31 %, hasta nítido: máx. de las vueltas. */
  S6: 300,
} as const;

/** El K de S6 (D1-D: K2 = 5,5), para el tope de la PC. */
export const K_FASE6 = { S6: "K2" } as const;

/** Vueltas medidas de S6 (más una de calentamiento sin medir). */
export const VUELTAS_S6 = 5;

export interface MuestrasFase6 {
  s6: MuestraS1[];
  /** P2: ms desde `timeOrigin` hasta el primer cuadro nítido (null si no hubo marca). */
  p2: number | null;
}

const unDecimal = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
const entero = new Intl.NumberFormat("es-AR", { useGrouping: false });
const v = (n: number) => unDecimal.format(n);
const e = (n: number) => entero.format(n);
const maximo = (xs: readonly number[]) => (xs.length ? Math.max(...xs) : 0);

/** Las filas S6 y P2 de una corrida, S6 juzgada con el tope de la netbook. */
export function filasFase6(m: MuestrasFase6): FilaEvaluada[] {
  const s6 = m.s6.map((x) => x.total);
  return [
    {
      id: "S6",
      escenario: "Entrar a Simular, potencia 2000 al 31 %, hasta nítido",
      medida: `máx. / mediana de ${s6.length}`,
      tope: `≤ ${e(TOPES_FASE6_NETBOOK.S6)} ms (máx.)`,
      valor: `${v(maximo(s6))} / ${v(mediana(s6))} ms`,
      resultado: s6.length > 0 && maximo(s6) <= TOPES_FASE6_NETBOOK.S6 ? "pasa" : "no pasa",
    },
    {
      id: "P2",
      escenario: "Arranque: de abrir la app al primer cuadro nítido del lienzo",
      medida: "una por apertura",
      tope: "se anota",
      valor: m.p2 === null ? "sin marca" : `${v(m.p2)} ms`,
      resultado: "se anota",
    },
  ];
}

/** Prefijo de la nota del desglose de S6 (lo lee `tests/bench/compararB.mjs`). */
export const NOTA_DESGLOSE_S6 = "S6, desglose (máx. de cada parte, ms):";

/** Las notas de S6 y P2 para debajo de la tabla. */
export function notasFase6(m: MuestrasFase6, escena: { componentes: number; cables: number; trifasicas: number; redes: number }): string[] {
  const parte = (k: keyof MuestraS1) => v(maximo(m.s6.map((x) => x[k])));
  return [
    `S6: escena de potencia de ${escena.componentes} componentes + ${escena.cables} cables (${escena.trifasicas} trifásicas, ${escena.redes} redes), con una vuelta de calentamiento sin medir.`,
    `${NOTA_DESGLOSE_S6} R4 ${parte("r4")} · netlist ${parte("netlist")} · iniciar ${parte("iniciar")} · cuadro ${parte("cuadro")} (${e(maximo(m.s6.map((x) => x.cuadros)))} cuadros como máximo).`,
    "P2: desde performance.timeOrigin; la misma en todas las corridas de una apertura (se toma la de la 1.ª). P1 llega con las miniaturas (T38).",
    "Los topes de la PC y el juicio de S6 los aplica tests/bench/probar-webview2.mjs --fase6.",
  ];
}
