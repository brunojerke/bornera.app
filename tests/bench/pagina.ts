// Banco de dibujado: corre dentro del navegador headless que abre correr.mjs.
// Dibuja las escenas de 100, 500 y 2000 símbolos con las mismas Capas que usa
// la app y manda los tiempos al script por POST.
//
// Cada escenario es un gesto (rehacer, zoom con la rueda, arrastre…) que se
// repite varias veces. Un gesto son cuadros seguidos, uno cada 16,7 ms, y
// después la "cola": los cuadros que la app sigue pidiendo sola hasta quedar
// nítida (mosaicos pendientes o la espera tras el zoom). El reloj es simulado:
// las esperas no se duermen, se saltan.
//
// Cada cuadro fuerza el rasterizado de la pantalla (getImageData de un píxel):
// si no, solo se mediría cuánto tarda en anotar las órdenes de dibujo, no en
// dibujarlas. (Los mosaicos ya los rasteriza Capas al terminar cada uno.)

import { CANTIDADES_BANCO, crearEscenaBanco, idBanco } from "../../src/render/banco";
import { Camara } from "../../src/render/camara";
import {
  Capas,
  OPCIONES_OPTIMIZADAS,
  OPCIONES_SIN_OPTIMIZAR,
  type DibujarDinamico,
  type OpcionesCapas,
} from "../../src/render/capas";
import type { EscenaEditable as Escena } from "../../src/render/escenaEditable";
import { dibujarSeleccion } from "../../src/render/resaltado";
import { nivelDetalle } from "../../src/render/detalle";
import { LIMITE_ARRASTRE_COMPLETO } from "../../src/editor/editor";
import type { MedidaCuadro } from "../../src/render/rendimiento";

/** Pantalla típica de netbook. */
const ANCHO = 1366;
const ALTO = 768;
const DPR = 1;
/** Un cuadro a 60 FPS, en ms (el reloj simulado avanza esto por cuadro). */
const CUADRO = 1000 / 60;
/** Un cuadro que tarda más que esto se nota como tirón. */
const LIMITE_MS = 16;
/** Un paso de la rueda (deltaY 100 con la sensibilidad de la navegación). */
const PASO_RUEDA = Math.exp(-100 * 0.0015);
/** Zoom con textos (escala 6,2 ≥ 6): el peor caso medido en la netbook. */
const ZOOM_TEXTOS = 0.31;
/** Tope de cuadros de una cola, por si algo nunca queda nítido. */
const MAX_COLA = 500;

export type Modo = "optimizado" | "sin caché de textos" | "sin optimizar";

export interface Medicion {
  componentes: number;
  escenario: string;
  modo: Modo;
  /** Cuadros medidos (gesto más cola, en todas las repeticiones). */
  cuadros: number;
  /** ms por cuadro. */
  mediana: number;
  p95: number;
  maximo: number;
  /** Cuadros que tardaron más de LIMITE_MS. */
  lentos: number;
  /** ms de dibujo por gesto, sumando todos sus cuadros (hasta quedar nítido). */
  porGesto: number;
  /** Bytes máximos de caché durante el escenario. */
  cache: number;
  /** Mosaicos rehechos en un solo cuadro, como máximo. */
  mosaicosMax: number;
  /**
   * Caché de textos en la capa dinámica, en las repeticiones medidas: el
   * primer cuadro de cada gesto y el resto. Solo en los escenarios que lo piden.
   */
  textos?: { primero: UsoTextos; resto: UsoTextos };
}

export interface Resultado {
  navegador: string;
  ancho: number;
  alto: number;
  dpr: number;
  mediciones: Medicion[];
  /** MB de heap JS con cada escena armada (null si el navegador no lo informa). */
  memoria: { componentes: number; heapMB: number | null }[];
}

interface Escenario {
  nombre: string;
  /** Cámara inicial del escenario. */
  preparar(c: Camara, e: Escena): void;
  /** Antes de cada repetición (sin medir): vuelve la cámara al punto de partida. */
  reiniciar?(c: Camara, e: Escena): void;
  /** Cuadros del gesto. */
  cuadros: number;
  /** Antes de cada cuadro del gesto: mueve la cámara o invalida la capa estática. */
  paso(c: Camara, capas: Capas, e: Escena, i: number): void;
  /** Repeticiones medidas (hay una más de calentamiento). */
  repeticiones: number;
  /** Capa dinámica del escenario (por ejemplo, el resaltado de la selección). */
  dinamico?(e: Escena): DibujarDinamico;
  /** Informar aciertos y fallos del caché de textos de la capa dinámica. */
  textos?: boolean;
}

/** Aciertos y fallos del caché de textos de la capa dinámica. */
export interface UsoTextos {
  aciertos: number;
  fallos: number;
}

function centrar(c: Camara, e: Escena, zoom: number): void {
  const k = e.caja!;
  c.zoom = zoom;
  c.centrar(k.x + k.ancho / 2, k.y + k.alto / 2, ANCHO, ALTO);
}

/** Al zoom dado, con el borde izquierdo de la escena en el borde izquierdo de la pantalla. */
function alBordeIzquierdo(c: Camara, e: Escena, zoom: number): void {
  const k = e.caja!;
  c.zoom = zoom;
  c.centrar(k.x + ANCHO / 2 / c.escala, k.y + k.alto / 2, ANCHO, ALTO);
}

/** Componente más cercano al centro de la escena: el que se edita (uno por escena). */
const editados = new WeakMap<Escena, string>();
function editado(e: Escena): string {
  let id = editados.get(e);
  if (id === undefined) {
    const k = e.caja!;
    const cx = k.x + k.ancho / 2;
    const cy = k.y + k.alto / 2;
    let mejor = Infinity;
    for (let i = 0; i < e.cantidad; i++) {
      const c = e.obtener(idBanco(i))!;
      const d = (c.x - cx) ** 2 + (c.y - cy) ** 2;
      if (d < mejor) {
        mejor = d;
        id = idBanco(i);
      }
    }
    editados.set(e, id!);
  }
  return id!;
}

/**
 * Edición: el componente del centro se corre una unidad, ida y vuelta, en
 * cada cuadro del gesto. Solo se invalida su región, como en el editor.
 */
function editar(_: Camara, capas: Capas, e: Escena, i: number): void {
  const id = editado(e);
  const c = e.obtener(id)!;
  for (const k of e.actualizar(id, { ...c, x: c.x + (i % 2 ? -1 : 1) })) capas.invalidarRegion(k);
}

/**
 * Selección del banco: la arman los escenarios de selección y la dibuja su
 * capa dinámica, igual que el editor (rectángulos, solo los visibles).
 */
let seleccion = new Set<string>();
const resaltar = (e: Escena): DibujarDinamico => (r, info) => dibujarSeleccion(r, info, e, seleccion);

/**
 * Selección: en cada cuadro, alternando, un rectángulo que toca toda la
 * pantalla (todo lo visible queda seleccionado) y un clic en el centro.
 * Como en el editor, no se invalida ningún mosaico.
 */
function seleccionar(c: Camara, _: Capas, e: Escena, i: number): void {
  const v = c.visible(ANCHO, ALTO);
  if (i % 2 === 0) {
    seleccion = new Set(e.idsEnCaja(v, "toca"));
  } else {
    const id = e.idEnPunto(v.x + v.ancho / 2, v.y + v.alto / 2, 3 / c.escala);
    seleccion = new Set(id ? [id] : []);
  }
}

/**
 * Arrastre de la selección, como el editor (T9): en el primer cuadro los
 * seleccionados salen de la capa estática (una invalidación por componente),
 * después se dibujan corridos en la dinámica, una unidad por cuadro, y en el
 * último se sueltan: se mueven y vuelven a la estática (otra invalidación).
 * Una repetición va y la siguiente vuelve, así la escena queda como estaba.
 */
const arrastre = { dx: 0, dy: 0, activo: false, sentido: -1 };
const CUADROS_ARRASTRE = 30;
function moverArrastrando(_: Camara, capas: Capas, e: Escena, i: number): void {
  if (i === 0) {
    arrastre.sentido = -arrastre.sentido;
    arrastre.activo = true;
    for (const id of seleccion) {
      const k = e.ocultar(id);
      if (k) capas.invalidarRegion(k);
    }
  }
  arrastre.dx = arrastre.sentido * i;
  arrastre.dy = arrastre.sentido * Math.round(i / 3);
  if (i === CUADROS_ARRASTRE - 1) {
    for (const id of seleccion) {
      const c = e.obtener(id)!;
      e.actualizar(id, { ...c, x: c.x + arrastre.dx, y: c.y + arrastre.dy });
      const k = e.mostrar(id);
      if (k) capas.invalidarRegion(k);
    }
    arrastre.activo = false;
  }
}
/** Capa dinámica de un arrastre: completos hasta `limite` visibles, contornos con más. */
const arrastrarCon = (limite: number) => (e: Escena): DibujarDinamico => (r, info) => {
  if (!arrastre.activo) {
    dibujarSeleccion(r, info, e, seleccion);
    return;
  }
  const { dx, dy } = arrastre;
  e.dibujarDesplazados(r, { ...info, detalle: nivelDetalle(info.escala) }, seleccion, dx, dy, limite);
  dibujarSeleccion(r, info, e, seleccion, dx, dy);
};
const dibujarArrastre = arrastrarCon(LIMITE_ARRASTRE_COMPLETO);

/** Zoom del caso medido en la netbook (58–73 %): textos y bornes, unos 40 visibles arrastrados. */
const ZOOM_ARRASTRE = 0.58;
const ARRASTRADOS = 40;

/** Los `n` componentes más cercanos al centro de la escena que están enteros en pantalla. */
function cercanosAlCentro(c: Camara, e: Escena, n: number): Set<string> {
  const v = c.visible(ANCHO, ALTO);
  const cx = v.x + v.ancho / 2;
  const cy = v.y + v.alto / 2;
  const ids = e.idsEnCaja(v, "contiene");
  const d = (id: string) => {
    const k = e.obtener(id)!;
    return (k.x - cx) ** 2 + (k.y - cy) ** 2;
  };
  return new Set(ids.sort((a, b) => d(a) - d(b)).slice(0, n));
}

const ESCENARIOS: Escenario[] = [
  {
    // Contenido nuevo (o colores) con la vista quieta: rehacer todo lo visible.
    nombre: "Rehacer al 100 %",
    preparar: (c, e) => centrar(c, e, 1),
    cuadros: 1,
    paso: (_, capas) => capas.invalidarEstatica(),
    repeticiones: 12,
  },
  {
    nombre: "Rehacer al 31 %",
    preparar: (c, e) => centrar(c, e, ZOOM_TEXTOS),
    cuadros: 1,
    paso: (_, capas) => capas.invalidarEstatica(),
    repeticiones: 12,
  },
  {
    // Tecla F desde el 100 %: un salto de zoom.
    nombre: "Encuadrar (F)",
    preparar: (c, e) => centrar(c, e, 1),
    reiniciar: (c, e) => centrar(c, e, 1),
    cuadros: 1,
    paso: (c, _, e) => c.encuadrar(e.caja!, ANCHO, ALTO),
    repeticiones: 8,
  },
  {
    // Ocho pasos de rueda seguidos hacia afuera, del 100 % al 30 % (con textos).
    nombre: "Zoom con la rueda",
    preparar: (c, e) => centrar(c, e, 1),
    reiniciar: (c, e) => centrar(c, e, 1),
    cuadros: 8,
    paso: (c) => c.zoomEn(c.zoom * PASO_RUEDA, ANCHO / 2, ALTO / 2),
    repeticiones: 6,
  },
  {
    // Ida y vuelta de a 6 px: no sale de lo ya dibujado.
    nombre: "Desplazar al 100 %",
    preparar: (c, e) => centrar(c, e, 1),
    cuadros: 25,
    paso: (c, _, __, i) => c.desplazar(i % 2 ? -6 : 6, 3 * (i % 2 ? -1 : 1)),
    repeticiones: 3,
  },
  {
    // Arrastre largo de 16 px por cuadro (960 px/s): sale una y otra vez de lo dibujado.
    nombre: "Arrastre al 31 %",
    preparar: (c, e) => alBordeIzquierdo(c, e, ZOOM_TEXTOS),
    reiniciar: (c, e) => alBordeIzquierdo(c, e, ZOOM_TEXTOS),
    cuadros: 100,
    paso: (c) => c.desplazar(-16, -3),
    repeticiones: 2,
  },
  {
    // Mover un símbolo 20 veces seguidas con la vista quieta.
    nombre: "Editar al 100 %",
    preparar: (c, e) => centrar(c, e, 1),
    cuadros: 20,
    paso: editar,
    repeticiones: 3,
  },
  {
    nombre: "Editar al 31 %",
    preparar: (c, e) => centrar(c, e, ZOOM_TEXTOS),
    cuadros: 20,
    paso: editar,
    repeticiones: 3,
  },
  {
    // Clic y rectángulo, 20 veces seguidas, con el resaltado en la capa dinámica.
    nombre: "Seleccionar al 31 %",
    preparar: (c, e) => {
      seleccion = new Set();
      centrar(c, e, ZOOM_TEXTOS);
    },
    cuadros: 20,
    paso: seleccionar,
    repeticiones: 3,
    dinamico: resaltar,
  },
  {
    // El peor caso de la capa dinámica: todo seleccionado mientras se arrastra la vista.
    nombre: "Arrastre con todo seleccionado al 31 %",
    preparar: (c, e) => {
      seleccion = new Set(e.idsEnCaja(e.caja!, "contiene"));
      alBordeIzquierdo(c, e, ZOOM_TEXTOS);
    },
    reiniciar: (c, e) => alBordeIzquierdo(c, e, ZOOM_TEXTOS),
    cuadros: 100,
    paso: (c) => c.desplazar(-16, -3),
    repeticiones: 2,
    dinamico: resaltar,
  },
  {
    // Arrastrar el componente del centro 30 unidades y soltarlo.
    nombre: "Mover 1 al 31 %",
    preparar: (c, e) => {
      seleccion = new Set([editado(e)]);
      centrar(c, e, ZOOM_TEXTOS);
    },
    cuadros: CUADROS_ARRASTRE,
    paso: moverArrastrando,
    // Impar: con la de calentamiento son pares, y la escena vuelve a su lugar.
    repeticiones: 3,
    dinamico: dibujarArrastre,
  },
  {
    // Lo mismo con todo seleccionado: con más de LIMITE_ARRASTRE_COMPLETO
    // visibles se dibujan solo los contornos.
    nombre: "Mover todo al 31 %",
    preparar: (c, e) => {
      seleccion = new Set(e.idsEnCaja(e.caja!, "contiene"));
      centrar(c, e, ZOOM_TEXTOS);
    },
    cuadros: CUADROS_ARRASTRE,
    paso: moverArrastrando,
    repeticiones: 3,
    dinamico: dibujarArrastre,
  },
  {
    // El caso que dio tirones en la netbook: unos 40 arrastrados dibujados
    // completos (con textos y bornes), forzados sin límite.
    nombre: "Arrastrar 40 completos al 58 %",
    preparar: (c, e) => {
      centrar(c, e, ZOOM_ARRASTRE);
      seleccion = cercanosAlCentro(c, e, ARRASTRADOS);
    },
    cuadros: CUADROS_ARRASTRE,
    paso: moverArrastrando,
    repeticiones: 3,
    dinamico: arrastrarCon(Infinity),
    textos: true,
  },
  {
    // Referencia: los mismos 40 en contornos. La diferencia con el anterior
    // es lo que cuesta dibujarlos completos.
    nombre: "Arrastrar 40 en contornos al 58 %",
    preparar: (c, e) => {
      centrar(c, e, ZOOM_ARRASTRE);
      seleccion = cercanosAlCentro(c, e, ARRASTRADOS);
    },
    cuadros: CUADROS_ARRASTRE,
    paso: moverArrastrando,
    repeticiones: 3,
    dinamico: arrastrarCon(0),
  },
];

const OPCIONES: Record<Modo, OpcionesCapas> = {
  optimizado: { ...OPCIONES_OPTIMIZADAS },
  "sin caché de textos": { ...OPCIONES_OPTIMIZADAS, cacheTextos: false },
  "sin optimizar": { ...OPCIONES_SIN_OPTIMIZAR },
};

function contexto(canvas = document.createElement("canvas")): CanvasRenderingContext2D {
  // Opaco, como el lienzo de la app.
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Sin Canvas 2D.");
  return ctx;
}

function percentil(ordenados: number[], p: number): number {
  return ordenados[Math.min(ordenados.length - 1, Math.floor(p * ordenados.length))]!;
}

function medir(escena: Escena, escenario: Escenario, opciones: OpcionesCapas): Omit<Medicion, "componentes" | "escenario" | "modo"> {
  const canvas = document.createElement("canvas");
  canvas.width = ANCHO * DPR;
  canvas.height = ALTO * DPR;
  const ctx = contexto(canvas);
  const capas = new Capas(ctx);
  capas.contenido = escena;
  capas.opciones = { ...opciones };
  capas.dinamico = escenario.dinamico?.(escena) ?? null;
  const camara = new Camara();
  escenario.preparar(camara, escena);

  let t = 0;
  let cache = 0;
  let mosaicosMax = 0;
  let midiendo = false;
  /** Dibuja un cuadro en el instante simulado `t`; devuelve la medida y el tiempo real. */
  const cuadro = (): [MedidaCuadro, number] => {
    const t0 = performance.now();
    const m = capas.dibujar(camara, ANCHO, ALTO, DPR, t);
    ctx.getImageData(0, 0, 1, 1); // fuerza el rasterizado
    const ms = performance.now() - t0;
    cache = Math.max(cache, capas.memoriaCache);
    if (midiendo) mosaicosMax = Math.max(mosaicosMax, m.mosaicos);
    return [m, ms];
  };
  /** Cuadros que la app pediría sola después de un gesto, hasta quedar nítida. */
  const cola = (m: MedidaCuadro, anotar: (ms: number) => void) => {
    for (let n = 0; n < MAX_COLA && (m.pendiente || m.esperar > 0); n++) {
      // Con espera (zoom recién terminado), el próximo cuadro llega cuando vence el temporizador.
      t += m.pendiente ? CUADRO : m.esperar;
      const [m2, ms] = cuadro();
      anotar(ms);
      m = m2;
    }
  };

  const tiempos: number[] = [];
  let total = 0;
  const usoPrimero = { aciertos: 0, fallos: 0 };
  const usoResto = { aciertos: 0, fallos: 0 };
  /** Suma a `uso` lo que pidió la capa dinámica desde `antes`. */
  const sumarTextos = (uso: UsoTextos, antes: UsoTextos) => {
    uso.aciertos += capas.textosDinamica.aciertos - antes.aciertos;
    uso.fallos += capas.textosDinamica.fallos - antes.fallos;
  };
  for (let rep = 0; rep <= escenario.repeticiones; rep++) {
    const medido = rep > 0; // la primera es de calentamiento
    const anotar = (ms: number) => {
      if (!medido) return;
      tiempos.push(ms);
      total += ms;
    };
    midiendo = false;
    if (escenario.reiniciar) {
      escenario.reiniciar(camara, escena);
      t += CUADRO;
      cola(cuadro()[0], () => {});
      t += 1000; // pausa entre gestos
    } else if (rep === 0) {
      // Sin reinicio, la primera vista se deja nítida antes del calentamiento,
      // así el máximo de mosaicos mide solo el gesto.
      t += CUADRO;
      cola(cuadro()[0], () => {});
    }
    midiendo = medido;
    let m: MedidaCuadro | null = null;
    for (let i = 0; i < escenario.cuadros; i++) {
      escenario.paso(camara, capas, escena, i);
      t += CUADRO;
      const antes = { ...capas.textosDinamica };
      const [m2, ms] = cuadro();
      if (medido) sumarTextos(i === 0 ? usoPrimero : usoResto, antes);
      anotar(ms);
      m = m2;
    }
    const antes = { ...capas.textosDinamica };
    if (m) cola(m, anotar);
    if (medido) sumarTextos(usoResto, antes);
  }
  capas.liberarCache();
  canvas.width = canvas.height = 0;
  tiempos.sort((a, b) => a - b);
  return {
    cuadros: tiempos.length,
    mediana: percentil(tiempos, 0.5),
    p95: percentil(tiempos, 0.95),
    maximo: tiempos.at(-1) ?? 0,
    lentos: tiempos.filter((x) => x > LIMITE_MS).length,
    porGesto: total / escenario.repeticiones,
    cache,
    mosaicosMax,
    ...(escenario.textos ? { textos: { primero: usoPrimero, resto: usoResto } } : {}),
  };
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
  const comparar = new URLSearchParams(location.search).has("comparar");
  const modos: Modo[] = comparar ? ["optimizado", "sin caché de textos", "sin optimizar"] : ["optimizado"];
  const resultado: Resultado = {
    navegador: navigator.userAgent,
    ancho: ANCHO,
    alto: ALTO,
    dpr: DPR,
    mediciones: [],
    memoria: [],
  };

  for (const n of CANTIDADES_BANCO) {
    const escena = crearEscenaBanco(n);
    resultado.memoria.push({ componentes: n, heapMB: heapMB() });

    for (const escenario of ESCENARIOS) {
      for (const modo of modos) {
        estado.textContent = `${n} componentes · ${escenario.nombre} · ${modo}`;
        await respirar();
        resultado.mediciones.push({
          componentes: n,
          escenario: escenario.nombre,
          modo,
          ...medir(escena, escenario, OPCIONES[modo]),
        });
      }
    }
  }
  await enviar(resultado);
  estado.textContent = "Listo.";
}

addEventListener("error", (e) => void enviar({ error: String(e.error?.stack ?? e.message) }));
addEventListener("unhandledrejection", (e) => void enviar({ error: String(e.reason?.stack ?? e.reason) }));
correr().catch((e: unknown) => enviar({ error: String((e as Error)?.stack ?? e) }));
