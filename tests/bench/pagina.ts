// Banco de dibujado: corre dentro del navegador headless que abre correr.mjs.
// Dibuja las escenas de 100, 500 y 2000 símbolos con las mismas Capas que usa
// la app, con y sin optimizaciones, y manda los tiempos al script por POST.
// Cada medición fuerza el rasterizado (getImageData de un píxel): si no, solo
// se mediría cuánto tarda en anotar las órdenes de dibujo, no en dibujarlas.

import { CANTIDADES_BANCO, crearEscenaBanco } from "../../src/render/banco";
import { Camara } from "../../src/render/camara";
import { Capas, MARGEN_CACHE, OPCIONES_OPTIMIZADAS, OPCIONES_SIN_OPTIMIZAR, type OpcionesCapas } from "../../src/render/capas";
import type { Escena } from "../../src/render/escena";

/** Pantalla típica de netbook. */
const ANCHO = 1366;
const ALTO = 768;
const DPR = 1;
const CALENTAMIENTO = 3;
const REPETICIONES = 25;

export interface Medicion {
  componentes: number;
  escenario: string;
  modo: "optimizado" | "sin optimizar";
  /** ms por cuadro. */
  mediana: number;
  p95: number;
  /** Componentes dibujados en la capa estática. */
  dibujados: number;
}

export interface Resultado {
  navegador: string;
  ancho: number;
  alto: number;
  dpr: number;
  mediciones: Medicion[];
  /** MB de heap JS con cada escena armada (null si el navegador no lo informa). */
  memoria: { componentes: number; heapMB: number | null; cacheMB: number }[];
}

interface Escenario {
  nombre: string;
  /** Pone la cámara antes de medir. */
  preparar(c: Camara, e: Escena): void;
  /** Antes de cada cuadro: mueve la cámara o invalida el caché. */
  paso(c: Camara, capas: Capas, i: number): void;
}

function centrar(c: Camara, e: Escena, zoom: number): void {
  const k = e.caja!;
  c.zoom = zoom;
  c.centrar(k.x + k.ancho / 2, k.y + k.alto / 2, ANCHO, ALTO);
}

const ESCENARIOS: Escenario[] = [
  {
    nombre: "Vista al 100 %",
    preparar: (c, e) => centrar(c, e, 1),
    paso: (_, capas) => capas.invalidarEstatica(),
  },
  {
    nombre: "Acercado al 400 %",
    preparar: (c, e) => centrar(c, e, 4),
    paso: (_, capas) => capas.invalidarEstatica(),
  },
  {
    nombre: "Encuadrado (F)",
    preparar: (c, e) => c.encuadrar(e.caja!, ANCHO, ALTO),
    paso: (_, capas) => capas.invalidarEstatica(),
  },
  {
    // Ida y vuelta de a 6 px, como un arrastre: no sale del margen del caché.
    nombre: "Desplazar al 100 %",
    preparar: (c, e) => centrar(c, e, 1),
    paso: (c, _, i) => c.desplazar(i % 2 ? -6 : 6, 3 * (i % 2 ? -1 : 1)),
  },
];

function contexto(canvas = document.createElement("canvas")): CanvasRenderingContext2D {
  // Opaco, como el lienzo de la app.
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Sin Canvas 2D.");
  return ctx;
}

function percentil(ordenados: number[], p: number): number {
  return ordenados[Math.min(ordenados.length - 1, Math.floor(p * ordenados.length))]!;
}

function medir(
  escena: Escena,
  escenario: Escenario,
  opciones: OpcionesCapas,
): Pick<Medicion, "mediana" | "p95" | "dibujados"> {
  const canvas = document.createElement("canvas");
  canvas.width = ANCHO * DPR;
  canvas.height = ALTO * DPR;
  const ctx = contexto(canvas);
  const capas = new Capas(ctx);
  capas.contenido = escena;
  capas.opciones = { ...opciones };
  const camara = new Camara();
  escenario.preparar(camara, escena);

  const tiempos: number[] = [];
  let dibujados = 0;
  for (let i = 0; i < CALENTAMIENTO + REPETICIONES; i++) {
    escenario.paso(camara, capas, i);
    const t0 = performance.now();
    const m = capas.dibujar(camara, ANCHO, ALTO, DPR);
    ctx.getImageData(0, 0, 1, 1); // fuerza el rasterizado
    const t = performance.now() - t0;
    if (i >= CALENTAMIENTO) tiempos.push(t);
    dibujados = m.dibujados;
  }
  capas.liberarCache();
  canvas.width = canvas.height = 0;
  tiempos.sort((a, b) => a - b);
  return { mediana: percentil(tiempos, 0.5), p95: percentil(tiempos, 0.95), dibujados };
}

/** Heap JS en MB, después de recolectar basura si el navegador lo permite. */
function heapMB(): number | null {
  (globalThis as { gc?: () => void }).gc?.();
  const memoria = (performance as { memory?: { usedJSHeapSize: number } }).memory;
  return memoria ? memoria.usedJSHeapSize / 2 ** 20 : null;
}

async function enviar(cuerpo: unknown): Promise<void> {
  await fetch("/__bench", { method: "POST", body: JSON.stringify(cuerpo) });
}

/** Deja respirar al navegador entre mediciones (y que se vea el progreso). */
const respirar = () => new Promise((r) => setTimeout(r, 0));

async function correr(): Promise<void> {
  const estado = document.getElementById("estado")!;
  const resultado: Resultado = {
    navegador: navigator.userAgent,
    ancho: ANCHO,
    alto: ALTO,
    dpr: DPR,
    mediciones: [],
    memoria: [],
  };

  // Mismo cálculo que Capas: pantalla más el margen hacia cada lado.
  const lado = (px: number) => px + 2 * Math.round(px * MARGEN_CACHE);
  const cacheMB = (lado(ANCHO * DPR) * lado(ALTO * DPR) * 4) / 2 ** 20;

  for (const n of CANTIDADES_BANCO) {
    const escena = crearEscenaBanco(n);
    resultado.memoria.push({ componentes: n, heapMB: heapMB(), cacheMB });

    for (const escenario of ESCENARIOS) {
      for (const [modo, opciones] of [
        ["optimizado", OPCIONES_OPTIMIZADAS],
        ["sin optimizar", OPCIONES_SIN_OPTIMIZAR],
      ] as const) {
        estado.textContent = `${n} componentes · ${escenario.nombre} · ${modo}`;
        await respirar();
        resultado.mediciones.push({ componentes: n, escenario: escenario.nombre, modo, ...medir(escena, escenario, opciones) });
      }
    }
  }
  await enviar(resultado);
  estado.textContent = "Listo.";
}

addEventListener("error", (e) => void enviar({ error: String(e.error?.stack ?? e.message) }));
addEventListener("unhandledrejection", (e) => void enviar({ error: String(e.reason?.stack ?? e.reason) }));
correr().catch((e: unknown) => enviar({ error: String((e as Error)?.stack ?? e) }));
