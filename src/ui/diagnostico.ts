// Diagnóstico del arrastre (alpha.2): la parte pura de la prueba automática
// del menú de desarrollo. Qué combinaciones se prueban, el recorrido del
// mouse, las estadísticas y la tabla copiable. La corrida en sí (cuadros,
// tiempos reales) está en diagnosticoArrastre.ts.

import type { ModoArrastreDiagnostico } from "../editor/editor";
import { LIMITE_LENTO_MS } from "../render/rendimiento";

/** Zooms del caso que dio tirones en la netbook. */
export const ZOOMS_DIAGNOSTICO = [0.58, 0.73] as const;
/** Arrastrados: los más cercanos al centro, enteros en pantalla. */
export const ARRASTRADOS_DIAGNOSTICO = 40;
/** Duración de cada combinación, en ms (como la ventana de lentos de F3). */
export const DURACION_DIAGNOSTICO_MS = 5000;

export interface Combinacion {
  nombre: string;
  modo: ModoArrastreDiagnostico;
  /** Caché de textos en la capa dinámica. */
  cache: boolean;
}

/** De lo más barato a lo más caro: cada una agrega algo a la anterior. */
export const COMBINACIONES: readonly Combinacion[] = [
  { nombre: "base (sin dibujar arrastrados)", modo: "nada", cache: false },
  { nombre: "contornos", modo: "contornos", cache: false },
  { nombre: "completos sin textos ni bornes", modo: "sinTextosNiBornes", cache: false },
  { nombre: "completos sin textos", modo: "sinTextos", cache: false },
  { nombre: "completos sin caché", modo: "completos", cache: false },
  { nombre: "completos con caché", modo: "completos", cache: true },
];

/**
 * Corrimiento del mouse, en unidades de grilla, `t` ms después de apretar:
 * siempre el mismo recorrido. Ida y vuelta en x (20 unidades, cada 2 s) y en
 * y (8 unidades, cada 3 s): cambia de punto de grilla casi en cada cuadro.
 */
export function recorrido(t: number): { dx: number; dy: number } {
  return {
    dx: 20 * Math.sin((2 * Math.PI * t) / 2000),
    dy: 8 * Math.sin((2 * Math.PI * t) / 3000),
  };
}

export interface Estadisticas {
  promedio: number;
  p95: number;
  maximo: number;
}

/** Promedio, p95 y máximo; todo 0 sin valores. */
export function estadisticas(valores: readonly number[]): Estadisticas {
  if (valores.length === 0) return { promedio: 0, p95: 0, maximo: 0 };
  const orden = [...valores].sort((a, b) => a - b);
  const suma = orden.reduce((s, v) => s + v, 0);
  return {
    promedio: suma / orden.length,
    p95: orden[Math.min(orden.length - 1, Math.floor(0.95 * orden.length))]!,
    maximo: orden[orden.length - 1]!,
  };
}

/** Lo que se juntó en una pasada de una combinación. */
export interface Pasada {
  /** Instantes de cada cuadro dibujado (ms). */
  instantes: number[];
  /** Tiempo de dibujo de cada cuadro (ms): lo que muestra F3. */
  dibujo: number[];
  /** Mediciones de la capa dinámica con la sonda (ms); vacío si no se midió. */
  muestras: number[];
  /** Caché de textos de la capa dinámica. */
  aciertos: number;
  fallos: number;
}

export interface ResumenPasada {
  cuadros: number;
  entreCuadros: Estadisticas;
  dibujo: Estadisticas;
  /** Cuadros de más de LIMITE_LENTO_MS de dibujo, como F3. */
  lentos: number;
  dinamica: Estadisticas;
  muestras: number;
  aciertos: number;
  fallos: number;
}

export function resumirPasada(p: Pasada): ResumenPasada {
  const intervalos: number[] = [];
  for (let i = 1; i < p.instantes.length; i++) intervalos.push(p.instantes[i]! - p.instantes[i - 1]!);
  return {
    cuadros: p.instantes.length,
    entreCuadros: estadisticas(intervalos),
    dibujo: estadisticas(p.dibujo),
    lentos: p.dibujo.filter((ms) => ms > LIMITE_LENTO_MS).length,
    dinamica: estadisticas(p.muestras),
    muestras: p.muestras.length,
    aciertos: p.aciertos,
    fallos: p.fallos,
  };
}

/** Resultado de una combinación a un zoom: la pasada sin sonda (tiempos) y la con sonda. */
export interface ResultadoCombinacion {
  zoom: number;
  combinacion: Combinacion;
  sinSonda: ResumenPasada;
  conSonda: ResumenPasada;
}

export interface DatosEquipo {
  version: string;
  navegador: string;
  ancho: number;
  alto: number;
  dpr: number;
  fecha: string;
  arrastrados: number;
  duracionMs: number;
}

const f1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const tres = (e: Estadisticas) => `${f1(e.promedio)} / ${f1(e.p95)} / ${f1(e.maximo)}`;
const conSigno = (n: number) => (n >= 0 ? "+" : "−") + f1(Math.abs(n));

/** Tabla en Markdown, para copiar y pegar. */
export function tablaDiagnostico(equipo: DatosEquipo, resultados: readonly ResultadoCombinacion[]): string {
  const l: string[] = [];
  l.push(`## Diagnóstico del arrastre · Bornera ${equipo.version} · ${equipo.fecha}`);
  l.push("");
  l.push(`- Equipo: ${equipo.navegador}`);
  l.push(`- Lienzo ${equipo.ancho}×${equipo.alto}, dpr ${equipo.dpr}`);
  l.push(
    `- ${equipo.arrastrados} arrastrados (los más cercanos al centro), el mismo recorrido durante ` +
      `${f1(equipo.duracionMs / 1000)} s por combinación.`,
  );
  l.push(
    `- Tiempos en ms (prom. / p95 / máx.), de la pasada **sin sonda**. Dibujo = lo que muestra F3. ` +
      `Lentos = cuadros de más de ${LIMITE_LENTO_MS} ms de dibujo, como en F3.`,
  );
  l.push(
    "- Dinámica = capa dinámica medida con la sonda en una pasada aparte (3 primeros cuadros y 1 cada 15). " +
      "Costo de medir = dibujo prom. con sonda − sin sonda.",
  );
  l.push("");
  l.push(
    "| Zoom | Combinación | Cuadros | Entre cuadros | Dibujo | Lentos | Dinámica (sonda) | Muestras | Costo de medir | Textos aciertos / fallos |",
  );
  l.push("|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of resultados) {
    const s = r.sinSonda;
    const c = r.conSonda;
    l.push(
      `| ${Math.round(r.zoom * 100)} % | ${r.combinacion.nombre} | ${s.cuadros} | ${tres(s.entreCuadros)} | ${tres(s.dibujo)} | ` +
        `${s.lentos} | ${c.muestras ? tres(c.dinamica) : "–"} | ${c.muestras} | ${conSigno(c.dibujo.promedio - s.dibujo.promedio)} | ` +
        `${r.combinacion.cache ? `${s.aciertos} / ${s.fallos}` : "–"} |`,
    );
  }
  return l.join("\n");
}
