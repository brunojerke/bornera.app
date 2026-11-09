// Diagnóstico del arrastre (alpha.2): la parte pura de la prueba automática
// del menú de desarrollo. Qué combinaciones se prueban, el recorrido del
// mouse, las estadísticas y la tabla copiable. La corrida en sí (cuadros,
// tiempos reales) está en diagnosticoArrastre.ts.

import type { ModoArrastreDiagnostico } from "../editor/editor";
import type { MedidaTope } from "../editor/medicionTope";
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

/** Mediana; 0 sin valores. */
export function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.floor(orden.length / 2)]!;
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
  /**
   * ms de cada movimiento del mouse que cambió de punto de grilla y donde la
   * previa vale (la herramienta, el plan con cables y la pista), fuera del
   * cuadro. Los rechazados no cuentan: cortan el plan antes.
   */
  pasos: number[];
  /** Movimientos que cambiaron de punto de grilla y donde la previa quedó rechazada (a rayas con ✕). */
  rechazados: number;
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
  /** Movimientos que cambiaron de punto de grilla: mediana y máximo de los válidos (ms), cuántos válidos y cuántos rechazados. */
  paso: { mediana: number; maximo: number; cantidad: number; rechazados: number };
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
    paso: {
      mediana: mediana(p.pasos),
      maximo: p.pasos.length ? Math.max(...p.pasos) : 0,
      cantidad: p.pasos.length,
      rechazados: p.rechazados,
    },
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
  /** La escena medida ("2000 + 3000 cables + 30 T"). */
  escena?: string;
}

/** Soltar con todo seleccionado (T14a): un Mover con todo, y lo que tarda en verse. */
export interface ResultadoSoltar {
  /** Componentes y cables seleccionados. */
  seleccionados: number;
  /** ms del soltar: el comando y las invalidaciones. */
  comando: number;
  /** ms de dibujo del primer cuadro después de soltar. */
  primerCuadro: number;
  /** ms desde soltar hasta que la pantalla queda nítida (mosaicos al día). */
  hastaNitida: number;
  /** False si el Mover se rechazó (no debería: todo se mueve rígido). */
  aplicado: boolean;
}

/** Lo que mide la prueba además de las combinaciones (con la escena con cables). */
export interface ExtrasDiagnostico {
  soltar: ResultadoSoltar | null;
  /** Los 40 del grupo soltados en un lugar que vale: el comando (ms). */
  soltarGrupo?: { comando: number } | null;
  tope: readonly MedidaTope[];
}

/**
 * Aceptación de T14a en la netbook: 40 cableados al 58 %, en la combinación
 * que se comporta como la app con 40 visibles (completos con caché).
 */
export const CRITERIOS_T14A = {
  zoom: 0.58,
  promedio: 16,
  maximo: 25,
  lentos: 10,
  pasoMediano: 8,
  soltar: 200,
} as const;

export interface Criterio {
  texto: string;
  ok: boolean;
}

/** Los criterios de T14a contra los resultados; vacío si falta la fila de referencia. */
export function criteriosT14a(resultados: readonly ResultadoCombinacion[], soltar: ResultadoSoltar | null): Criterio[] {
  const k = CRITERIOS_T14A;
  const fila = resultados.find((r) => r.zoom === k.zoom && r.combinacion.modo === "completos" && r.combinacion.cache);
  if (!fila) return [];
  const s = fila.sinSonda;
  const l: Criterio[] = [
    { texto: `dibujo promedio ${f1(s.dibujo.promedio)} ms < ${k.promedio}`, ok: s.dibujo.promedio < k.promedio },
    { texto: `dibujo máximo ${f1(s.dibujo.maximo)} ms < ${k.maximo}`, ok: s.dibujo.maximo < k.maximo },
    { texto: `${s.lentos} cuadros lentos < ${k.lentos}`, ok: s.lentos < k.lentos },
    { texto: `paso mediano ${f1(s.paso.mediana)} ms < ${k.pasoMediano}`, ok: s.paso.cantidad > 0 && s.paso.mediana < k.pasoMediano },
  ];
  if (soltar) {
    const t = soltar.comando + soltar.primerCuadro;
    l.push({
      texto: `soltar con todo seleccionado ${f1(t)} ms (comando + primer cuadro) ≤ ${k.soltar}`,
      ok: soltar.aplicado && t <= k.soltar,
    });
  }
  return l;
}

const f1 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const tres = (e: Estadisticas) => `${f1(e.promedio)} / ${f1(e.p95)} / ${f1(e.maximo)}`;
const conSigno = (n: number) => (n >= 0 ? "+" : "−") + f1(Math.abs(n));

/** Tabla en Markdown, para copiar y pegar. */
export function tablaDiagnostico(
  equipo: DatosEquipo,
  resultados: readonly ResultadoCombinacion[],
  extras: ExtrasDiagnostico = { soltar: null, tope: [] },
): string {
  const l: string[] = [];
  l.push(`## Diagnóstico del arrastre · Bornera ${equipo.version} · ${equipo.fecha}`);
  l.push("");
  l.push(`- Equipo: ${equipo.navegador}`);
  l.push(`- Lienzo ${equipo.ancho}×${equipo.alto}, dpr ${equipo.dpr}` + (equipo.escena ? ` · escena ${equipo.escena}` : ""));
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
  l.push(
    "- Paso = cada movimiento del mouse que cambia de punto de grilla (herramienta, plan de la previa y pista), " +
      "fuera del cuadro: mediana / máx. de los válidos, cuántos válidos y cuántos rechazados (✕, a rayas; " +
      "no cuentan para el tiempo porque un rechazo corta el plan antes).",
  );
  l.push("");
  l.push(
    "| Zoom | Combinación | Cuadros | Entre cuadros | Dibujo | Lentos | Paso | Dinámica (sonda) | Muestras | Costo de medir | Textos aciertos / fallos |",
  );
  l.push("|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of resultados) {
    const s = r.sinSonda;
    const c = r.conSonda;
    l.push(
      `| ${Math.round(r.zoom * 100)} % | ${r.combinacion.nombre} | ${s.cuadros} | ${tres(s.entreCuadros)} | ${tres(s.dibujo)} | ` +
        `${s.lentos} | ${s.paso.cantidad + s.paso.rechazados ? `${f1(s.paso.mediana)} / ${f1(s.paso.maximo)} · ${s.paso.cantidad} válidos · ✕ ${s.paso.rechazados}` : "–"} | ` +
        `${c.muestras ? tres(c.dinamica) : "–"} | ${c.muestras} | ${conSigno(c.dibujo.promedio - s.dibujo.promedio)} | ` +
        `${r.combinacion.cache ? `${s.aciertos} / ${s.fallos}` : "–"} |`,
    );
  }
  const { soltar, tope, soltarGrupo } = extras;
  if (soltarGrupo) {
    l.push("");
    l.push(`**Soltar los ${equipo.arrastrados} en (3, 2)**: un paso, comando ${f1(soltarGrupo.comando)} ms (después se deshace).`);
  }
  if (soltar) {
    l.push("");
    l.push(
      `**Soltar con todo seleccionado** (${soltar.seleccionados}): ` +
        (soltar.aplicado
          ? `comando ${f1(soltar.comando)} ms · primer cuadro ${f1(soltar.primerCuadro)} ms · hasta nítida ${f1(soltar.hastaNitida)} ms.`
          : "se rechazó (no debería)."),
    );
  }
  if (tope.length > 0) {
    l.push("");
    l.push("**Paso de la previa según los cables que se acomodan** (plan de un punto de grilla, ms; escena propia donde todo vale, solo pasos válidos):");
    l.push("");
    l.push("| Cables | Mediana | Máx. | ms por cable | Pasos válidos |");
    l.push("|---:|---:|---:|---:|---:|");
    for (const t of tope) {
      const porCable = (t.cables ? t.mediana / t.cables : 0).toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
      l.push(`| ${t.cables} | ${f1(t.mediana)} | ${f1(t.maximo)} | ${porCable} | ${t.pasos - t.rechazados} de ${t.pasos} |`);
    }
  }
  const criterios = criteriosT14a(resultados, soltar);
  if (criterios.length > 0) {
    l.push("");
    l.push(`**Aceptación T14a** (${Math.round(CRITERIOS_T14A.zoom * 100)} %, completos con caché):`);
    for (const k of criterios) l.push(`- ${k.ok ? "✓" : "✗"} ${k.texto}`);
  }
  return l.join("\n");
}
