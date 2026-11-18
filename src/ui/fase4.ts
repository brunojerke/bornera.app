// «Probar la fase 4» (C1; docs/plan-fase4.md, sección 6): las filas F1, F2 y
// F3 con su tope de netbook, el grupo K de cada fila (B y F) y la tabla para
// copiar. Puro, sin DOM: lo corre probarFase4.ts en la app y lo prueban los
// tests en Node.
//
// La tabla es la de «Probar la fase 3b» (las mismas columnas, así
// `tests/bench/compararB.mjs` lee B1–B16 igual) más una columna K: el número
// de la fila que entra en el factor netbook / PC (K1, pasos sin dibujo; K2,
// gestos con dibujo; D6a-B). `tests/bench/factores.mjs` saca K1 y K2 de los
// textos de la PC y de la netbook (C4).
//
// Los topes de F de la netbook viven acá. En la PC (C1), F1 ≤ 9 ms
// (`TOPE_F1_PC_MS`), F2 y F3 ≤ 1 s: los juzga `tests/bench/probar-webview2.mjs`.

import { celda, type FilaEvaluada, type Resultado } from "./fase3b";
import { mediana } from "./diagnostico";
import { resumirF1, type MuestraCopia } from "./medirCopia";

/** Tope de F1 en la netbook: el paso síncrono más largo de la copia (ms). */
export const TOPE_F1_NETBOOK_MS = 50;
/** Tope de F2 en la netbook: guardar 2000, máximo de las vueltas (ms). */
export const TOPE_F2_NETBOOK_MS = 1000;
/** Tope de F3 en la netbook: abrir 2000 hasta el primer cuadro, máximo de las vueltas (ms; Bruno, 2026-11-18). */
export const TOPE_F3_NETBOOK_MS = 3000;
/** Tope de F2 y F3 en la PC (ms): decide en C1. */
export const TOPE_ARCHIVO_PC_MS = 1000;
/** Vueltas de F2 y F3. */
export const VUELTAS_ARCHIVO = 5;

/** Una vuelta de F2 y F3 (ms). */
export interface MuestraArchivo {
  /** F2: serializar + gzip + escribir. */
  guardar: number;
  /** De F3, la parte hasta el documento: leer + desempaquetar + deserializar (se informa). */
  abrir: number;
  /** F3: abrir + armar la escena + el primer cuadro. */
  hastaCuadro: number;
}

export type GrupoK = "K1" | "K2";

/**
 * Qué número de lo medido en cada fila entra en el factor (docs/plan-fase4.md,
 * C1): su grupo y su posición entre los números de la celda. Las filas que no
 * están (B8, B9 y B15) no entran.
 */
export const GRUPOS_K: Readonly<Record<string, { grupo: GrupoK; indice: number }>> = {
  // Pasos sin dibujo: medianas, p95 y valores sueltos.
  B1: { grupo: "K1", indice: 0 }, // paso: mediana / máx.
  B2: { grupo: "K1", indice: 0 },
  B4: { grupo: "K1", indice: 0 },
  B5: { grupo: "K1", indice: 0 },
  B7: { grupo: "K1", indice: 0 }, // revisión por punto: p95
  B10: { grupo: "K1", indice: 0 }, // por gesto
  B12: { grupo: "K1", indice: 0 }, // paso: mediana
  B13: { grupo: "K1", indice: 0 }, // R6: p95 / máx.
  F1: { grupo: "K1", indice: 1 }, // máx. / mediana
  F2: { grupo: "K1", indice: 1 },
  // Gestos con dibujo: máximos de los cuadros y el por gesto de B16.
  B3: { grupo: "K2", indice: 2 }, // N por gesto (N en total); máx. X ms
  B6: { grupo: "K2", indice: 2 },
  B11: { grupo: "K2", indice: 0 }, // máx. X ms; …
  B14: { grupo: "K2", indice: 0 },
  B16: { grupo: "K2", indice: 1 }, // N lentos; X ms
  F3: { grupo: "K2", indice: 1 },
};

/** Los números de una celda medida, en orden («12,5 / 3 ms» da 12,5 y 3). */
export function numerosDe(valor: string): number[] {
  return [...valor.matchAll(/\d+(?:,\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));
}

/** La celda K de una fila: «K1: 12,5» o «—» si no entra. */
export function celdaK(id: string, valor: string): string {
  const k = GRUPOS_K[id];
  if (!k) return "—";
  const n = numerosDe(valor)[k.indice];
  if (n === undefined) throw new Error(`${id}: «${valor}» no tiene el número ${k.indice + 1}.`);
  return `${k.grupo}: ${unDecimal.format(n)}`;
}

// ── Formato ────────────────────────────────────────────────────────────────

const unDecimal = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
const entero = new Intl.NumberFormat("es-AR", { useGrouping: false });
const v = (n: number) => unDecimal.format(n);
const pasa = (ok: boolean): Resultado => (ok ? "pasa" : "no pasa");
const maximo = (xs: readonly number[]) => (xs.length ? Math.max(...xs) : 0);

// ── Filas F ────────────────────────────────────────────────────────────────

/** F1: el paso síncrono más largo de la copia (`resumirF1`), con la mediana de los pasos más largos. */
export function filaF1(muestras: readonly MuestraCopia[]): FilaEvaluada {
  const r = resumirF1(muestras);
  return {
    id: "F1",
    escenario: "Copia de recuperación (2000 + cables)",
    medida: "paso síncrono más largo: máx. / mediana",
    tope: `≤ ${entero.format(TOPE_F1_NETBOOK_MS)} ms (máx.)`,
    valor: `${v(r.f1)} / ${v(r.pasoMasLargo.mediana)} ms`,
    resultado: pasa(r.copias > 0 && r.f1 <= TOPE_F1_NETBOOK_MS),
  };
}

/** F2 y F3: máximo y mediana de las vueltas. */
export function filasArchivo(muestras: readonly MuestraArchivo[]): FilaEvaluada[] {
  const fila = (id: string, escenario: string, xs: number[], tope: number): FilaEvaluada => ({
    id,
    escenario,
    medida: `máx. / mediana de ${xs.length}`,
    tope: `≤ ${entero.format(tope)} ms (máx.)`,
    valor: `${v(maximo(xs))} / ${v(mediana(xs))} ms`,
    resultado: pasa(xs.length > 0 && maximo(xs) <= tope),
  });
  return [
    fila("F2", "Guardar 2000 (sin el comando)", muestras.map((m) => m.guardar), TOPE_F2_NETBOOK_MS),
    fila("F3", "Abrir 2000 hasta el primer cuadro (sin el comando)", muestras.map((m) => m.hastaCuadro), TOPE_F3_NETBOOK_MS),
  ];
}

/**
 * La tabla para copiar: el encabezado, las filas (B y F) con las columnas de
 * «Probar la fase 3b» más K, las líneas de `notas` y el resumen.
 */
export function textoFase4(filas: readonly FilaEvaluada[], encabezado: string, notas: readonly string[] = []): string {
  const lineas = [
    encabezado,
    "",
    "| # | Escenario | Medida | Tope netbook | Netbook | Resultado | K |",
    "|---|---|---|---|---|---|---|",
    ...filas.map((f) => `| ${[f.id, f.escenario, f.medida, f.tope, f.valor, f.resultado, celdaK(f.id, f.valor)].map(celda).join(" | ")} |`),
    "",
    ...notas,
  ];
  const cuenta = (r: Resultado) => filas.filter((f) => f.resultado === r).length;
  lineas.push(`Pasan ${cuenta("pasa")} · no pasan ${cuenta("no pasa")} · se anotan ${cuenta("se anota")}.`);
  return lineas.join("\n");
}
