// Escenarios del banco de dibujado y `medir`, sin efectos al cargarse (cierre
// 3b, etapa 4): los importan el arranque del banco (pagina.ts, en el navegador
// headless que abre correr.mjs) y «Probar la fase 3b» del menú de desarrollo
// (src/ui/probarFase3b.ts), que corre algunos en la app real.
//
// El banco dibuja las escenas de 100, 500 y 2000 símbolos con las mismas
// Capas que usa la app. Después, la de 2000 con 3000 cables y 30 derivaciones
// en T (T14a), abierta en un Editor como en la app (Ctrl+Shift+B), con
// reconectar uno de sus extremos libres (T14c) al final. Después, T16: la
// previa de pegar sobre la zona densa, pegar 500, duplicar todo y copiar.
// Después, T18: rehacer y mover un contacto con los auxiliares siguiendo a
// las bobinas (listas de referencias cruzadas). Al final, T19: rehacer con los
// contornos de aviso y dibujar un cable con un par NC y bobina (R6).
// Con `t12`, la de cables es la de T12 (para comparar).
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

import { idBanco } from "../../src/render/banco";
import { Camara, PX_POR_UNIDAD } from "../../src/render/camara";
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
import { Editor, LIMITE_ARRASTRE_COMPLETO } from "../../src/editor/editor";
import { planearTransformacion, prepararTransformacion } from "../../src/core/model/seguir";
import { ARRASTRADOS_BANCO, BANCO_CABLES, BANCO_CABLES_T12, documentoBancoCables, grupoCentralBanco } from "../../src/editor/banco";
import { recorrido } from "../../src/ui/diagnostico";
import { clasesDelRecorrido, gestoReconexion, type ClaseReconexion, type GestoReconexion } from "../../src/editor/medicionReconectar";
import { SIMBOLOS_BANCO_CABLES } from "../../src/ui/escenas";
import type { MedidaCuadro } from "../../src/render/rendimiento";
import { bornesColocados, buscarSimbolo } from "../../src/core/symbols";
import { CambiarEtiquetas, cablear, colocar } from "../../src/core/model/comandos";
import { esTitular } from "../../src/core/model/etiquetado";
import { problemasPegado, recortar, type Recorte } from "../../src/core/model/portapapeles";
import { elementosRecorte } from "../../src/editor/herramientas/pegar";
import { ajustarAGrilla } from "../../src/editor/herramientas/colocar";

/** Pantalla típica de netbook. */
export const ANCHO = 1366;
export const ALTO = 768;
export const DPR = 1;
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
  /** Símbolos de la escena, o "2000 + 3000 cables". */
  componentes: number | string;
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
  /**
   * Cuadros que tardaron más de un cuadro de 60 Hz (CUADRO, 16,7 ms): la meta
   * de 0.1.2. Lo usa «Probar la fase 3b» (src/ui/fase3b.ts); el banco juzga
   * con `lentos`, que no cambia.
   */
  sobreCuadro: number;
  /**
   * Lentos (> LIMITE_MS) después de un paso, como máximo: el paso, su cuadro
   * y los que siguen hasta el próximo paso (con la cola, si es el último).
   * Para «≤ 1 lento por gesto» después de pegar, duplicar y deshacer (B3, B6).
   */
  lentosPorPasoMax: number;
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
  /** ms de cada paso (fuera del cuadro), en los escenarios que lo piden. Con `pasoImpar`, solo los pares. */
  paso?: TiempoPaso;
  /** ms de los pasos impares (deshacer), en los escenarios con `pasoImpar`. */
  pasoImpar?: TiempoPaso;
  /** Revisión por punto de la previa de pegar (`problemasPegado`, aparte del paso), en los que la miden. */
  revision?: RevisionPrevia;
  /**
   * Mosaicos rehechos en un solo cuadro, como máximo, por fase del gesto: el
   * primer cuadro, los del medio y el último con su cola (en los que lo piden).
   */
  fases?: { inicio: number; intermedios: number; soltar: number };
  /** Cables que se acomodan (no rígidos) con la selección del escenario. */
  acomodados?: number;
  /** Gestos que terminaron en un comando (al soltar), de los medidos. */
  comandos?: number;
  /** Pasos del medio de un arrastre con el editor donde la previa se rechazaba (a rayas con ✕), de cuántos. */
  rechazados?: { rechazados: number; pasos: number };
  /** Invalidaciones de mosaicos pedidas en los pasos del medio de un gesto (tiene que dar 0). */
  invalidacionesIntermedias?: number;
  /** Lo que conviene saber del escenario (por ejemplo, por qué se rechaza). */
  nota?: string;
  /** ms de cada pasada de R6 en los pasos medidos (T19; vacío en la base, sin validaciones). */
  r6?: number[];
}

export interface TiempoPaso {
  mediana: number;
  p95: number;
  maximo: number;
}

/** Revisión de la previa de pegar en cada punto (T16): ms y conflictos que dio. */
export interface RevisionPrevia extends TiempoPaso {
  puntos: number;
  /** Elementos del recorte (componentes + cables). */
  elementos: number;
  componentes: number;
  cables: number;
  /** Conflictos por punto, mínimo y máximo: con un mínimo > 0, siempre había algo debajo. */
  conflictosMin: number;
  conflictosMax: number;
}

export interface Escenario {
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
  /** Medir también lo que tarda cada paso (fuera del cuadro). */
  medirPaso?: boolean;
  /** Qué pasos cuentan para el tiempo de paso (por defecto, todos). */
  pasoMedido?(i: number): boolean;
  /** Los pasos impares (deshacer) van aparte, en `pasoImpar`. */
  pasoImpar?: boolean;
  /** Antes de cada paso, sin contar en su tiempo (por ejemplo, abrir la previa o medir algo aparte). */
  antes?(i: number, medido: boolean): void;
  /** Revisión por punto de la previa de pegar (después de medir). */
  revision?(): RevisionPrevia;
  /** Informar los mosaicos por fase (inicio, intermedios, soltar). */
  fases?: boolean;
  /** Después de la última repetición (sin medir): deja la escena como estaba. */
  terminar?(e: Escena): void;
  /** Cables que se acomodan, si el escenario lo sabe (después de preparar). */
  acomodados?(): number;
  /** Comandos que dieron los gestos medidos, si el escenario los cuenta. */
  comandos?(): number;
  /** Pasos rechazados de los medidos, si el escenario los cuenta. */
  rechazados?(): { rechazados: number; pasos: number };
  /** Nota para el informe, si el escenario la tiene (después de medir). */
  nota?(): string | undefined;
  /** ms de cada pasada de R6 en los pasos medidos (T19), si el escenario los junta. */
  r6?(): number[];
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

/**
 * Los `n` componentes más cercanos al centro de la escena que están enteros
 * en pantalla. En la escena con cables, `cableados` elige solo los que tienen
 * cables (true) o solo los que no (false).
 */
function cercanosAlCentro(c: Camara, e: Escena, n: number, cableados: boolean | null = null): Set<string> {
  const v = c.visible(ANCHO, ALTO);
  const cx = v.x + v.ancho / 2;
  const cy = v.y + v.alto / 2;
  const ids = e
    .idsEnCaja(v, "contiene")
    .filter((id) => !e.esCable(id) && (cableados === null || editorCables?.escena !== e || editorCables.tieneCables([id]) === cableados));
  const d = (id: string) => {
    const k = e.obtener(id)!;
    return (k.x - cx) ** 2 + (k.y - cy) ** 2;
  };
  return new Set(ids.sort((a, b) => d(a) - d(b)).slice(0, n));
}

export const ESCENARIOS: Escenario[] = [
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

// ── Escena con cables ──────────────────────────────────────────────────────
// Se abre en un Editor: seleccionar, borrar y deshacer van por el editor y
// sus comandos, como en la app. Las invalidaciones van a las Capas del
// escenario que se está midiendo.

let editorCables: Editor | null = null;
let capasActivas: Capas | null = null;
/** El último aviso del editor (para explicar un rechazo que frena el banco). */
let ultimoAviso = "";
/** Invalidaciones de mosaicos que pidió el editor de cables. */
let invalidaciones = 0;

export function abrirEditorCables(t12: boolean): Editor {
  const ed = new Editor(documentoBancoCables(SIMBOLOS_BANCO_CABLES, 1, t12 ? BANCO_CABLES_T12 : BANCO_CABLES));
  ed.vista = {
    invalidarRegion: (k) => {
      invalidaciones++;
      capasActivas?.invalidarRegion(k);
    },
    invalidar: () => {},
  };
  ed.alAvisar = (t) => (ultimoAviso = t);
  editorCables = ed;
  return ed;
}

/**
 * Suelta el editor de la escena con cables (2000 + 3000 cables), para que
 * «Probar la fase 3b» no lo deje en memoria al terminar. El banco no lo usa:
 * corre una vez y se cierra la página.
 */
export function cerrarEditorCables(): void {
  editorCables = null;
  capasActivas = null;
  pegarBanco.recorte = null;
  pegarBanco.todos = [];
}

/** Pasos del historial del editor de cables. */
const hechos = () => (editorCables!.historial as unknown as { hechos: unknown[] }).hechos.length;

/** Un evento de la herramienta en el punto de grilla (x, y), con el botón apretado. */
const evento = (c: Camara, x: number, y: number) => ({ x, y, boton: 0, botones: 1, mayus: false, ctrl: false, escala: c.escala });

/**
 * Gesto con la herramienta Seleccionar sobre lo seleccionado, como el mouse:
 * se aprieta sobre `ancla` (un seleccionado que se elige con un clic en su
 * posición), se arrastra y se suelta. Si el soltar dio un comando, se
 * deshace al reiniciar o al terminar (sin medir), así la escena vuelve.
 */
const gesto = { ancla: null as { x: number; y: number } | null, pendiente: false, comandos: 0, acomodados: 0, rechazados: 0, pasos: 0 };

/** Selecciona `ids` en el editor y, si el gesto aprieta con el mouse, elige el ancla. */
function prepararGesto(ids: Iterable<string>, conAncla = true): void {
  const ed = editorCables!;
  const lista = [...ids];
  ed.cancelarHerramienta();
  ed.seleccionarIds(lista);
  const e = ed.escena;
  const id = lista.find((x) => {
    const k = e.obtener(x);
    return k !== undefined && e.idEnPunto(k.x, k.y, 0) === x;
  });
  const c = id === undefined ? undefined : e.obtener(id);
  if (!c && conAncla) throw new Error("El gesto no tiene un componente donde apretar.");
  gesto.ancla = c ? { x: c.x, y: c.y } : null;
  gesto.pendiente = false;
  gesto.comandos = 0;
  gesto.rechazados = 0;
  gesto.pasos = 0;
  gesto.acomodados = prepararTransformacion(ed.documento.hojas[0]!, lista, ed.entornoPlan()).rehechos;
}

/** Deshace el comando del último gesto, si lo hubo (sin medir). */
function volverGesto(): void {
  if (gesto.pendiente) editorCables!.deshacer();
  gesto.pendiente = false;
}

/** Suelta en (x, y) y anota si dio un comando. */
function soltarGesto(c: Camara, x: number, y: number, medido: boolean): void {
  const ed = editorCables!;
  const n = hechos();
  ed.aplicar(ed.seleccionar.soltar(evento(c, x, y)));
  gesto.pendiente = hechos() > n;
  if (gesto.pendiente && medido) gesto.comandos++;
}

/**
 * Arrastrar los 40 cableados (T14a): 60 pasos y al final se suelta. En cada
 * paso la previa planea con la consulta indexada. Dos trayectorias: la de la
 * prueba de la netbook (dentro del lugar que deja el anillo; suelta en
 * (3, 2)) y una contra los vecinos (sale del anillo: casi todo se rechaza).
 */
const PASOS_ARRASTRE_CABLES = 60;
type Trayectoria = (i: number) => { dx: number; dy: number };
const POR_EL_ANILLO: Trayectoria = (i) => {
  if (i === PASOS_ARRASTRE_CABLES - 1) return { dx: 3, dy: 2 };
  const { dx, dy } = recorrido(100 * (i + 1));
  return { dx: Math.round(dx), dy: Math.round(dy) };
};
// Sale del anillo (4 pasos, 32 unidades) hacia los vecinos: de 30 a 59 unidades y vuelta.
const CONTRA_LOS_VECINOS: Trayectoria = (i) => ({ dx: 30 + Math.min(i, PASOS_ARRASTRE_CABLES - 1 - i), dy: i % 2 });
let trayectoria: Trayectoria = POR_EL_ANILLO;
let repeticionGesto = 0;
function arrastrarCableados(c: Camara, _: Capas, __: Escena, i: number): void {
  const ed = editorCables!;
  const p = gesto.ancla!;
  const { dx, dy } = trayectoria(i);
  if (i === 0) ed.aplicar(ed.seleccionar.presionar(evento(c, p.x, p.y)));
  ed.aplicar(ed.seleccionar.mover(evento(c, p.x + dx, p.y + dy)));
  // La pista dice por qué no se puede soltar ahí: la previa está a rayas con ✕.
  if (repeticionGesto > 0 && i > 0 && i < PASOS_ARRASTRE_CABLES - 1) {
    gesto.pasos++;
    if (ed.pista !== null) gesto.rechazados++;
  }
  if (i === PASOS_ARRASTRE_CABLES - 1) soltarGesto(c, p.x + dx, p.y + dy, repeticionGesto++ > 0);
}

/**
 * R sobre lo seleccionado y Ctrl+Z, alternando. Con `aceptar`, si R se
 * rechaza el banco se frena con el motivo; sin, se mide el rechazo (lo que
 * tarda en planear y avisar) y no hay nada que deshacer.
 */
const girar = { aceptar: true, comandos: 0, rechazos: 0, medido: false, repeticion: 0, motivo: "" };
function girarYDeshacer(_: Camara, __: Capas, ___: Escena, i: number): void {
  const ed = editorCables!;
  if (i % 2 === 1) {
    if (gesto.pendiente) ed.deshacer();
    gesto.pendiente = false;
    return;
  }
  gesto.pendiente = ed.accion("rotar");
  if (gesto.pendiente && girar.medido) girar.comandos++;
  if (!gesto.pendiente && girar.medido) girar.rechazos++;
  if (!gesto.pendiente) girar.motivo = ultimoAviso;
  if (!gesto.pendiente && girar.aceptar) throw new Error(`Girar: se rechaza ("${ultimoAviso}").`);
}

/** Prepara un escenario de girar: selección, si se espera que se acepte y los contadores. */
function prepararGirar(ids: Iterable<string>, aceptar: boolean): void {
  prepararGesto(ids, false);
  girar.aceptar = aceptar;
  girar.comandos = 0;
  girar.rechazos = 0;
  girar.medido = false;
  girar.repeticion = 0;
  girar.motivo = "";
}

/**
 * El componente cableado más cercano al centro que se puede girar (con R)
 * sin rechazo. En el banco, denso, R de uno se rechaza en ~4 de cada 10.
 */
function cableadoQueGira(c: Camara, e: Escena): string {
  const ed = editorCables!;
  const hoja = ed.documento.hojas[0]!;
  for (const id of cercanosAlCentro(c, e, 200, true)) {
    if (!planearTransformacion(hoja, [id], { tipo: "rotar", sentido: 90 }, ed.entornoPlan()).rechazo) return id;
  }
  throw new Error("Girar 1 cableado: ninguno de los 200 del centro se puede girar.");
}

/** Todo seleccionado: se aprieta, se arrastra dos puntos y se suelta (un Mover con todo rígido). */
function soltarTodo(c: Camara, _: Capas, __: Escena, i: number): void {
  const ed = editorCables!;
  const p = gesto.ancla!;
  if (i === 0) {
    ed.aplicar(ed.seleccionar.presionar(evento(c, p.x, p.y)));
    ed.aplicar(ed.seleccionar.mover(evento(c, p.x + 1, p.y)));
  } else if (i === 1) {
    ed.aplicar(ed.seleccionar.mover(evento(c, p.x + 2, p.y + 1)));
  } else {
    soltarGesto(c, p.x + 2, p.y + 1, repeticionGesto++ > 0);
    if (!gesto.pendiente) throw new Error(`Soltar con todo seleccionado: se rechaza ("${ultimoAviso}").`);
  }
}

/**
 * Todo seleccionado, arrastrado sin soltar: cada paso cambia de punto de
 * grilla (la previa planea en cada uno). El primero aprieta y pasa el umbral.
 */
const CUADROS_ARRASTRE_TODO = 20;
function arrastrarTodo(c: Camara, _: Capas, __: Escena, i: number): void {
  const ed = editorCables!;
  const p = gesto.ancla!;
  if (i === 0) {
    ed.aplicar(ed.seleccionar.presionar(evento(c, p.x, p.y)));
    ed.aplicar(ed.seleccionar.mover(evento(c, p.x + 1, p.y)));
    return;
  }
  ed.aplicar(ed.seleccionar.mover(evento(c, p.x + 1 + (i % 4), p.y + (i % 2))));
  if (ed.pista !== null) throw new Error(`Arrastrar todo seleccionado: la previa se rechaza ("${ed.pista}").`);
}

/** Esc: corta el gesto en curso, si lo hay (sin comando). */
function cancelarGesto(): void {
  const ed = editorCables!;
  if (ed.arrastrando) ed.aplicar(ed.seleccionar.cancelar());
}

/** Todo seleccionado y el resumen del panel, alternando con nada seleccionado. */
function seleccionarTodo(_: Camara, __: Capas, e: Escena, i: number): void {
  const ed = editorCables!;
  if (i % 2 === 0) ed.seleccionarIds(e.idsEnCaja(e.caja!, "toca"));
  else ed.seleccionarIds([]);
  ed.resumenSeleccion();
}

/** El componente cableado más cercano al centro (fuera de los que no tienen cables). */
let borrado: string | null = null;
function cableadoDelCentro(e: Escena): string {
  const ed = editorCables!;
  const k = e.caja!;
  const cx = k.x + k.ancho / 2;
  const cy = k.y + k.alto / 2;
  let mejor = Infinity;
  for (const c of ed.documento.hojas[0]!.componentes) {
    const d = (c.x - cx) ** 2 + (c.y - cy) ** 2;
    if (d < mejor && ed.tieneCables([c.id])) {
      mejor = d;
      borrado = c.id;
    }
  }
  return borrado!;
}

/** Supr sobre un componente con cables y Ctrl+Z, alternando: un paso de deshacer cada uno. */
function borrarYDeshacer(_: Camara, __: Capas, e: Escena, i: number): void {
  const ed = editorCables!;
  if (i % 2 === 0) {
    ed.seleccionarIds([borrado ?? cableadoDelCentro(e)]);
    ed.accion("borrar");
  } else {
    ed.deshacer();
  }
}

/**
 * Cable en curso (T13): el borne de partida es uno del componente sin cables
 * más cercano al centro; el cursor recorre 3 filas de 20 puntos de grilla
 * por encima, cruzando cables y bornes de los vecinos (cada paso cambia el
 * punto de grilla: ruteo y validación en cada uno).
 */
let partidaCable: { x: number; y: number } | null = null;
function empezarCable(c: Camara, e: Escena): void {
  const ed = editorCables!;
  ed.cancelarHerramienta();
  ed.iniciarCable();
  if (!partidaCable) {
    const k = e.caja!;
    const cx = k.x + k.ancho / 2;
    const cy = k.y + k.alto / 2;
    let mejor = Infinity;
    for (const comp of ed.documento.hojas[0]!.componentes) {
      const d = (comp.x - cx) ** 2 + (comp.y - cy) ** 2;
      if (d >= mejor || ed.tieneCables([comp.id])) continue;
      const ce = e.obtener(comp.id)!;
      const b = bornesColocados(ce.def.bornes, ce.x, ce.y, ce)[0];
      if (!b) continue;
      mejor = d;
      partidaCable = { x: b.x, y: b.y };
    }
  }
  const p = partidaCable!;
  const ev = { x: p.x, y: p.y, boton: 0, botones: 0, mayus: false, ctrl: false, escala: c.escala };
  ed.aplicar(ed.activa.presionar(ev));
  ed.aplicar(ed.activa.soltar(ev));
  if (!ed.enTramo) throw new Error("Cable en curso: el tramo no empezó.");
}

function moverCable(c: Camara, _: Capas, __: Escena, i: number): void {
  const ed = editorCables!;
  const p = partidaCable!;
  const x = p.x + (i % 20) - 10;
  const y = p.y - 4 - Math.floor(i / 20) * 4;
  ed.aplicar(ed.activa.mover({ x, y, boton: 0, botones: 0, mayus: false, ctrl: false, escala: c.escala }));
}

/**
 * Reconectar un extremo libre (T14c): el gesto de medicionReconectar, al
 * 58 % con la cámara en el extremo (los 30 están lejos del centro de la
 * escena). El primer cuadro aprieta sobre el extremo y pasa al primer
 * destino (empieza: el cable sale de la capa estática); después, un destino
 * por cuadro; el último suelta en el destino válido (un paso, que se deshace
 * al reiniciar).
 */
function prepararReconectar(c: Camara, g: GestoReconexion): void {
  const ed = editorCables!;
  ed.cancelarHerramienta();
  ed.seleccionarIds([]);
  c.zoom = ZOOM_ARRASTRE;
  c.centrar(g.x, g.y, ANCHO, ALTO);
  repeticionGesto = 0;
  gesto.pendiente = false;
  gesto.comandos = 0;
  gesto.rechazados = 0;
  gesto.pasos = 0;
}

/** Aprieta sobre el extremo y pasa al primer destino: empieza a reconectar. */
function agarrarExtremo(c: Camara, g: GestoReconexion): void {
  const ed = editorCables!;
  ed.aplicar(ed.seleccionar.presionar(evento(c, g.x, g.y)));
  const p = g.recorrido[0]!;
  ed.aplicar(ed.seleccionar.mover(evento(c, p.x, p.y)));
  if (!ed.reconectando) throw new Error(`Reconectar: apretar en (${g.x}, ${g.y}) no agarró el extremo de ${g.id}.`);
}

/** Suelta en el destino válido: tiene que dar un paso. */
function soltarEnDestino(c: Camara, g: GestoReconexion): void {
  soltarGesto(c, g.soltar.x, g.soltar.y, repeticionGesto++ > 0);
  if (!gesto.pendiente) throw new Error(`Reconectar: soltar en ${g.soltar.texto} no dio un paso ("${ultimoAviso}").`);
}

/** Los escenarios de reconectar (la escena de T12 no tiene extremos libres). Se arman con la escena como está. */
function escenariosReconectar(): Escenario[] {
  const g = gestoReconexion(editorCables!, ZOOM_ARRASTRE * PX_POR_UNIDAD);
  const n = g.recorrido.length;
  const medidos = clasesDelRecorrido({ ...g, recorrido: g.recorrido.slice(1) });
  const descripcion =
    `${g.id} (${g.lado}) desde (${g.x}, ${g.y}): ${n - 1} destinos medidos a ±6 u (${medidos.valido} válidos, ` +
    `${medidos.rechazoRuteado} rechazados después de rutear, ${medidos.rechazoAntes} antes de rutear); suelta en ${g.soltar.texto}`;
  /** Un destino por cuadro y al final suelta. */
  const recorrer = (c: Camara, _: Capas, __: Escena, i: number): void => {
    const ed = editorCables!;
    if (i === 0) return agarrarExtremo(c, g);
    if (i < n) {
      const p = g.recorrido[i]!;
      ed.aplicar(ed.seleccionar.mover(evento(c, p.x, p.y)));
      if (repeticionGesto > 0) {
        gesto.pasos++;
        if (p.clase !== "valido") gesto.rechazados++;
      }
      return;
    }
    ed.aplicar(ed.seleccionar.mover(evento(c, g.soltar.x, g.soltar.y)));
    soltarEnDestino(c, g);
  };
  const terminar = (nombre: string) => () => {
    volverGesto();
    editorCables!.seleccionarIds([]);
    if (gesto.comandos === 0) throw new Error(`${nombre}: ningún gesto dio un paso; no mide reconectar.`);
  };
  /** Solo los destinos de la clase `clase` (sin el primero, que empieza, ni el último, que suelta). */
  const deClase = (clase: ClaseReconexion) => (i: number) => i > 0 && i < n && g.recorrido[i]!.clase === clase;
  const comun = {
    preparar: (c: Camara) => prepararReconectar(c, g),
    reiniciar: () => volverGesto(),
    cuadros: n + 1,
    paso: recorrer,
    repeticiones: 3,
    dinamico: () => editorCables!.dibujarDinamico,
    medirPaso: true,
    comandos: () => gesto.comandos,
    rechazados: () => ({ rechazados: gesto.rechazados, pasos: gesto.pasos }),
  };
  return [
    {
      // El paso es solo el de los destinos válidos (un rechazo corta el plan antes). Criterio en la netbook: mediana < 8 ms.
      ...comun,
      nombre: "Reconectar un extremo libre al 58 %",
      terminar: terminar("Reconectar"),
      pasoMedido: deClase("valido"),
      fases: true,
      nota: () => `${descripcion}. Paso = los válidos.`,
    },
    {
      // El mismo gesto; el paso es el de los rechazados después de rutear (cuestan el ruteo entero). Mismo criterio.
      ...comun,
      nombre: "Reconectar, rechazos después de rutear, al 58 %",
      terminar: terminar("Reconectar, rechazos después de rutear"),
      pasoMedido: deClase("rechazoRuteado"),
      nota: () => `el mismo gesto. Paso = los ${medidos.rechazoRuteado} rechazados después de rutear.`,
    },
    {
      // Agarra, va al destino válido y suelta: el paso medido es el soltar (comando, reflejar e invalidaciones).
      nombre: "Soltar reconectando al 58 %",
      preparar: (c) => prepararReconectar(c, g),
      reiniciar: () => volverGesto(),
      terminar: terminar("Soltar reconectando"),
      cuadros: 3,
      paso: (c, _, __, i) => {
        if (i === 0) agarrarExtremo(c, g);
        else if (i === 1) editorCables!.aplicar(editorCables!.seleccionar.mover(evento(c, g.soltar.x, g.soltar.y)));
        else soltarEnDestino(c, g);
      },
      repeticiones: 3,
      dinamico: () => editorCables!.dibujarDinamico,
      medirPaso: true,
      pasoMedido: (i) => i === 2,
      fases: true,
      comandos: () => gesto.comandos,
    },
  ];
}

// ── T16: pegar, duplicar y copiar (plan T16, sección 4) ─────────────────────

/** Tamaños de la previa de pegar, en elementos (componentes + cables del recorte). */
const TAMANOS_PREVIA = [40, 80, 160, 320, 500];
/** Puntos de grilla del barrido de la previa: cada paso es un punto nuevo. */
const PUNTOS_PREVIA = 60;
/**
 * Barrido de la previa: de dx −30 a +29 con dy = 1, respecto del lugar del
 * original. Lo pegado pasa por encima del mismo grupo y de sus vecinos, con
 * bornes y cables debajo en cada punto (el banco lo comprueba: conflictos > 0).
 */
const desplazamientoPrevia = (i: number) => ({ dx: i - PUNTOS_PREVIA / 2, dy: 1 });

/**
 * La zona densa: a un cuarto del ancho de la escena desde la izquierda, a
 * media altura. Lejos del anillo vacío alrededor del grupo del centro.
 */
function zonaDensa(): { x: number; y: number } {
  const k = editorCables!.escena.caja!;
  return { x: Math.round(k.x + k.ancho / 4), y: Math.round(k.y + k.alto / 2) };
}

/**
 * El recorte de los componentes más cercanos a `q` con el mayor número de
 * elementos que no pasa de `n` (los cables entre ellos entran solos, D2a).
 */
function recorteCercano(q: { x: number; y: number }, n: number): Recorte {
  const hoja = editorCables!.documento.hojas[0]!;
  const d = (c: { x: number; y: number }) => (c.x - q.x) ** 2 + (c.y - q.y) ** 2;
  const orden = [...hoja.componentes].sort((a, b) => d(a) - d(b)).map((c) => c.id);
  // Los elementos no bajan al sumar componentes: búsqueda binaria del mayor k.
  let lo = 1;
  let hi = orden.length;
  while (lo < hi) {
    const m = Math.ceil((lo + hi) / 2);
    if (elementosRecorte(recortar(hoja, orden.slice(0, m))) <= n) lo = m;
    else hi = m - 1;
  }
  return recortar(hoja, orden.slice(0, lo));
}

/** El punto de grilla que la herramienta pone bajo el mouse: el centro de la caja del recorte. */
function centroRecorte(r: Recorte): { x: number; y: number } {
  const k = r.caja!;
  return { x: ajustarAGrilla(k.x + k.ancho / 2), y: ajustarAGrilla(k.y + k.alto / 2) };
}

const pegarBanco = {
  recorte: null as Recorte | null,
  centro: { x: 0, y: 0 },
  /** Desplazamiento de Pegar 500: a la derecha de la escena, sin conflictos. */
  lado: { dx: 0, dy: 0 },
  revisiones: [] as number[],
  conflictosMin: Infinity,
  conflictosMax: 0,
  /** Todo lo de la escena (para duplicar y copiar). */
  todos: [] as string[],
};

function prepararRecorte(n: number): void {
  const r = recorteCercano(zonaDensa(), n);
  pegarBanco.recorte = r;
  pegarBanco.centro = centroRecorte(r);
  pegarBanco.revisiones = [];
  pegarBanco.conflictosMin = Infinity;
  pegarBanco.conflictosMax = 0;
}

/** Abre la previa de pegar el recorte del banco, con la selección vacía. */
function abrirPrevia(): void {
  const ed = editorCables!;
  ed.cancelarHerramienta();
  ed.seleccionarIds([]);
  if (!ed.iniciarPegar(pegarBanco.recorte!)) throw new Error("Pegar: no abre la previa.");
}

/** El mouse en el punto de la previa con desplazamiento (dx, dy). */
const eventoPrevia = (c: Camara, dx: number, dy: number, botones = 0) => {
  const p = pegarBanco.centro;
  return { ...evento(c, p.x + dx, p.y + dy), botones };
};

/** Un punto del barrido: la herramienta revisa (o no, por encima del tope) y la previa se mueve. */
function moverPrevia(c: Camara, _: Capas, __: Escena, i: number): void {
  const ed = editorCables!;
  const { dx, dy } = desplazamientoPrevia(i);
  ed.aplicar(ed.activa.mover(eventoPrevia(c, dx, dy)));
  const v = ed.pegando?.previa;
  if (!v || v.dx !== dx || v.dy !== dy) throw new Error(`Previa de pegar: no está en (${dx}, ${dy}).`);
}

/** La revisión por punto, aparte del paso: `problemasPegado` con la consulta y los contadores del editor, con cualquier tamaño. */
function revisarPrevia(i: number, medido: boolean): void {
  if (!medido) return;
  const ed = editorCables!;
  const { dx, dy } = desplazamientoPrevia(i);
  const t0 = performance.now();
  const n = problemasPegado(pegarBanco.recorte!, dx, dy, ed.consulta, ed.documento.contadores).length;
  pegarBanco.revisiones.push(performance.now() - t0);
  pegarBanco.conflictosMin = Math.min(pegarBanco.conflictosMin, n);
  pegarBanco.conflictosMax = Math.max(pegarBanco.conflictosMax, n);
}

function revisionPrevia(): RevisionPrevia {
  const r = pegarBanco.recorte!;
  return {
    ...tiempoPaso(pegarBanco.revisiones),
    puntos: pegarBanco.revisiones.length,
    elementos: elementosRecorte(r),
    componentes: r.componentes.length,
    cables: r.cables.length,
    conflictosMin: pegarBanco.conflictosMin,
    conflictosMax: pegarBanco.conflictosMax,
  };
}

/** Pegar 500: en los pares, el clic que suelta (revisa, crea y ejecuta); en los impares, deshacer. */
function pegarYDeshacer(c: Camara, _: Capas, __: Escena, i: number): void {
  const ed = editorCables!;
  if (i % 2 === 1) {
    ed.deshacer();
    return;
  }
  const n = hechos();
  ed.aplicar(ed.activa.presionar(eventoPrevia(c, pegarBanco.lado.dx, pegarBanco.lado.dy, 1)));
  if (hechos() !== n + 1) throw new Error(`Pegar 500: no pega ("${ultimoAviso}").`);
}

/** Ctrl+D con todo seleccionado en los pares; deshacer en los impares. */
function duplicarYDeshacer(_: Camara, __: Capas, ___: Escena, i: number): void {
  const ed = editorCables!;
  if (i % 2 === 1) {
    ed.deshacer();
    return;
  }
  const n = hechos();
  ed.accion("duplicar");
  if (hechos() !== n + 1) throw new Error(`Duplicar todo: no pega al lado ("${ultimoAviso}").`);
}

// ── T17: etiquetar los vacíos (plan T17, sección 4) ─────────────────────────

const vaciosBanco = {
  /** Titulares de la escena que el escenario vacía y vuelve a numerar. */
  titulares: 0,
};

/**
 * Vacía la etiqueta de todos los titulares de la escena en un paso, fuera de
 * lo medido (las fuentes y los contactos quedan como están). Al terminar el
 * escenario se deshace, así la escena vuelve a ser la de siempre.
 */
function vaciarTitulares(): void {
  const ed = editorCables!;
  const ids = ed.documento.hojas[0]!.componentes.filter((c) => esTitular(buscarSimbolo(c.tipo)) && c.etiqueta !== "").map((c) => c.id);
  vaciosBanco.titulares = ids.length;
  ed.ejecutar(new CambiarEtiquetas(ids.map((id) => [id, ""] as const)));
}

/** "Etiquetar los vacíos" en los pares (un paso con todos los titulares); deshacer en los impares. */
function etiquetarYDeshacer(_: Camara, __: Capas, ___: Escena, i: number): void {
  const ed = editorCables!;
  if (i % 2 === 1) {
    ed.deshacer();
    return;
  }
  const n = hechos();
  if (!ed.etiquetarVacios() || hechos() !== n + 1) throw new Error(`Etiquetar los vacíos: no etiqueta ("${ultimoAviso}").`);
}

/** Los escenarios de T16, con la escena como está (al final, después de los de v0.1.3). */
function escenariosPegar(): Escenario[] {
  const ed = () => editorCables!;
  return [
    ...TAMANOS_PREVIA.map(
      (n): Escenario => ({
        // La previa flotante de Ctrl+V barriendo la zona densa. El paso es el
        // de la app (revisa solo hasta TOPE_PREVIA_PEGAR); la revisión por
        // punto se mide aparte, con cualquier tamaño.
        nombre: `Previa de pegar ${n} al 31 %`,
        preparar: (c) => {
          prepararRecorte(n);
          const q = zonaDensa();
          c.zoom = ZOOM_TEXTOS;
          c.centrar(q.x, q.y, ANCHO, ALTO);
        },
        reiniciar: () => abrirPrevia(),
        antes: (i, medido) => revisarPrevia(i, medido),
        terminar: () => ed().cancelarHerramienta(),
        cuadros: PUNTOS_PREVIA,
        paso: moverPrevia,
        repeticiones: 2,
        dinamico: () => ed().dibujarDinamico,
        medirPaso: true,
        revision: revisionPrevia,
      }),
    ),
    {
      // Pegar 500 a la derecha de la escena (sin conflictos) y deshacer. Abrir
      // la previa va fuera del paso; el paso es el clic que suelta.
      nombre: "Pegar 500 y deshacer al 31 %",
      preparar: (c, e) => {
        prepararRecorte(500);
        const k = e.caja!;
        const r = pegarBanco.recorte!;
        pegarBanco.lado = { dx: Math.ceil(k.x + k.ancho - r.caja!.x) + 10, dy: 0 };
        centrar(c, e, ZOOM_TEXTOS);
      },
      antes: (i) => {
        if (i % 2 === 0) abrirPrevia();
      },
      terminar: () => {
        ed().cancelarHerramienta();
        ed().seleccionarIds([]);
      },
      cuadros: 10,
      paso: pegarYDeshacer,
      repeticiones: 3,
      dinamico: () => ed().dibujarDinamico,
      medirPaso: true,
      pasoImpar: true,
      nota: () => {
        const r = pegarBanco.recorte!;
        return `${elementosRecorte(r)} elementos (${r.componentes.length} componentes + ${r.cables.length} cables), pegados en dx = ${pegarBanco.lado.dx}`;
      },
    },
    {
      // Ctrl+D con todo seleccionado (2000 + 3030): al lado, sin conflictos, y deshacer.
      nombre: "Duplicar todo (2000) y deshacer al 31 %",
      preparar: (c, e) => {
        const h = ed().documento.hojas[0]!;
        pegarBanco.todos = [...h.componentes, ...h.cables].map((x) => x.id);
        centrar(c, e, ZOOM_TEXTOS);
      },
      antes: (i) => {
        if (i % 2 === 0) ed().seleccionarIds(pegarBanco.todos);
      },
      terminar: () => ed().seleccionarIds([]),
      cuadros: 4,
      paso: duplicarYDeshacer,
      repeticiones: 2,
      dinamico: () => ed().dibujarDinamico,
      medirPaso: true,
      pasoImpar: true,
      nota: () => `${pegarBanco.todos.length} elementos`,
    },
    {
      // T17: con los titulares de la escena vacíos (fuera de lo medido),
      // "Etiquetar los vacíos" los numera en un paso, y deshacer.
      nombre: "Etiquetar los vacíos (2000) y deshacer al 31 %",
      preparar: (c, e) => {
        vaciarTitulares();
        centrar(c, e, ZOOM_TEXTOS);
      },
      terminar: () => ed().deshacer(),
      cuadros: 4,
      paso: etiquetarYDeshacer,
      repeticiones: 2,
      dinamico: () => ed().dibujarDinamico,
      medirPaso: true,
      pasoImpar: true,
      nota: () => `${vaciosBanco.titulares} titulares numerados`,
    },
    {
      // Ctrl+C con todo seleccionado: solo se informa.
      nombre: "Copiar 2000 al 31 %",
      preparar: (c, e) => {
        const h = ed().documento.hojas[0]!;
        ed().seleccionarIds([...h.componentes, ...h.cables].map((x) => x.id));
        centrar(c, e, ZOOM_TEXTOS);
      },
      terminar: () => ed().seleccionarIds([]),
      cuadros: 4,
      paso: () => {
        if (!ed().accion("copiar")) throw new Error(`Copiar 2000: no copia ("${ultimoAviso}").`);
      },
      repeticiones: 2,
      dinamico: () => ed().dibujarDinamico,
      medirPaso: true,
    },
  ];
}

// ── T18: referencias cruzadas (plan T18, sección 5) ─────────────────────────

/** Auxiliares por bobina al renombrar (decisión de Bruno al aprobar la etapa 3). */
const AUXILIARES_POR_BOBINA = 3;

const referenciasBanco = {
  bobinas: 0,
  auxiliares: 0,
  /** Bobinas que quedan con lista y filas en total (cuenta propia, sin `referencias.ts`). */
  conLista: 0,
  filas: 0,
  /** Bobinas con lista en la escena del editor (0 en la base, que no las dibuja). */
  enEscena: 0,
  /** El contacto que se mueve y cuánto. */
  contacto: "",
  dx: 0,
  dy: 0,
  /** Atlas de textos, en las repeticiones medidas. */
  atlas: { fillText: 0, llenados: 0, entradasMax: 0, medido: false },
};

/**
 * Renombra los auxiliares de la escena para que sigan a las bobinas, en un
 * paso y fuera de lo medido: en el orden de la hoja, el auxiliar i pasa a la
 * etiqueta de la bobina floor(i / 3), hasta agotar auxiliares o bobinas.
 * Las condiciones son las de `esBobina` y `sigueABobina` (escritas acá: en
 * la base no se exportan). Al terminar el escenario se deshace.
 */
function seguirABobinas(): void {
  const ed = editorCables!;
  const cs = ed.documento.hojas[0]!.componentes;
  const bobinas = cs.filter((c) => buscarSimbolo(c.tipo)?.elemento === "bobina");
  const auxiliares = cs.filter((c) => buscarSimbolo(c.tipo)?.accionamiento === "bobina");
  const pares: (readonly [string, string])[] = [];
  const filas = new Map<string, number>();
  for (let i = 0; i < auxiliares.length; i++) {
    const b = bobinas[Math.floor(i / AUXILIARES_POR_BOBINA)];
    if (!b || b.etiqueta === "") break;
    pares.push([auxiliares[i]!.id, b.etiqueta]);
    filas.set(b.etiqueta, (filas.get(b.etiqueta) ?? 0) + 1);
  }
  ed.ejecutar(new CambiarEtiquetas(pares));
  const r = referenciasBanco;
  r.bobinas = bobinas.length;
  r.auxiliares = auxiliares.length;
  // Dos bobinas con la misma etiqueta mostrarían la misma lista; en la escena no hay.
  r.conLista = bobinas.filter((b) => filas.has(b.etiqueta)).length;
  r.filas = bobinas.reduce((n, b) => n + (filas.get(b.etiqueta) ?? 0), 0);
  r.enEscena = bobinas.filter((b) => ((ed.escena.obtener(b.id) as { referencias?: readonly string[] } | undefined)?.referencias?.length ?? 0) > 0).length;
}

/**
 * Cuenta, en el caché de textos de las Capas que miden, los textos que caen a
 * fillText porque el atlas está lleno, cuántas veces se llena y el máximo de
 * textos guardados. Solo en las repeticiones medidas (`atlas.medido`).
 */
function contarAtlas(): void {
  const a = referenciasBanco.atlas;
  a.fillText = a.llenados = a.entradasMax = 0;
  a.medido = false;
  const t = (capasActivas as unknown as { textos: { lleno: boolean; cantidad: number; obtener(texto: string, px: number, color: string): unknown } }).textos;
  const obtener = t.obtener.bind(t);
  t.obtener = (texto, px, color) => {
    const estaba = t.lleno;
    const e = obtener(texto, px, color);
    if (a.medido) {
      if (!estaba && t.lleno) a.llenados++;
      if (e === null && t.lleno) a.fillText++;
      a.entradasMax = Math.max(a.entradasMax, t.cantidad);
    }
    return e;
  };
}

function notaReferencias(): string {
  const r = referenciasBanco;
  const a = r.atlas;
  return (
    `${r.auxiliares} auxiliares en ${r.bobinas} bobinas, de a ${AUXILIARES_POR_BOBINA}: ${r.conLista} bobinas con lista y ${r.filas} filas` +
    ` (en la escena: ${r.enEscena} con lista)` +
    (r.contacto ? `; se mueve ${r.contacto} (${r.dx}, ${r.dy})` : "") +
    `; atlas: ${a.fillText} textos con fillText por atlas lleno, ${a.llenados} veces lleno, hasta ${a.entradasMax} textos`
  );
}

/** Desplazamientos que se prueban para mover el contacto, en orden. */
const DESPLAZAMIENTOS_CONTACTO: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [2, 0],
  [0, 2],
];

/**
 * Elige el contacto que se mueve: el auxiliar renombrado más cercano al
 * centro de la vista que se puede apretar en su centro y cuyo movimiento se
 * acepta. La prueba va fuera de lo medido y se deshace.
 */
function elegirContacto(c: Camara): void {
  const ed = editorCables!;
  const e = ed.escena;
  const centro = c.aGrilla(ANCHO / 2, ALTO / 2);
  const hoja = ed.documento.hojas[0]!;
  const nombres = new Set(hoja.componentes.filter((k) => buscarSimbolo(k.tipo)?.elemento === "bobina").map((k) => k.etiqueta));
  const distancia = (k: { x: number; y: number }) => (k.x - centro.x) ** 2 + (k.y - centro.y) ** 2;
  const candidatos = hoja.componentes
    .filter((k) => buscarSimbolo(k.tipo)?.accionamiento === "bobina" && nombres.has(k.etiqueta) && e.idEnPunto(k.x, k.y, 0) === k.id)
    .sort((a, b) => distancia(a) - distancia(b));
  for (const k of candidatos.slice(0, 20)) {
    for (const [dx, dy] of DESPLAZAMIENTOS_CONTACTO) {
      prepararGesto([k.id]);
      moverContacto(c, dx, dy, false);
      if (gesto.pendiente) {
        volverGesto();
        Object.assign(referenciasBanco, { contacto: `${k.etiqueta} ${k.id}`, dx, dy });
        prepararGesto([k.id]);
        return;
      }
    }
  }
  throw new Error("Mover 1 contacto: ningún auxiliar cercano al centro se puede mover.");
}

/** Aprieta en el ancla, mueve (dx, dy) y suelta: un Mover si se acepta. */
function moverContacto(c: Camara, dx: number, dy: number, medido: boolean): void {
  const ed = editorCables!;
  const p = gesto.ancla!;
  ed.aplicar(ed.seleccionar.presionar(evento(c, p.x, p.y)));
  ed.aplicar(ed.seleccionar.mover(evento(c, p.x + dx, p.y + dy)));
  soltarGesto(c, p.x + dx, p.y + dy, medido);
}

/** Los escenarios de T18, con la escena como está (al final, después de todo lo anterior). */
function escenariosReferencias(): Escenario[] {
  const ed = () => editorCables!;
  return [
    {
      // Rehacer la capa estática con las listas de referencias a la vista.
      nombre: "Rehacer al 31 % con referencias",
      preparar: (c, e) => {
        referenciasBanco.contacto = "";
        ed().seleccionarIds([]);
        seguirABobinas();
        contarAtlas();
        centrar(c, e, ZOOM_TEXTOS);
      },
      antes: (_, medido) => {
        referenciasBanco.atlas.medido = medido;
      },
      terminar: () => ed().deshacer(),
      cuadros: 1,
      paso: (_, capas) => capas.invalidarEstatica(),
      repeticiones: 12,
      nota: notaReferencias,
    },
    {
      // Mover un contacto (apretar, mover y soltar: un Mover que recalcula la
      // lista de su bobina) en los pares; deshacer en los impares.
      nombre: "Mover 1 contacto con referencias al 31 %",
      preparar: (c, e) => {
        seguirABobinas();
        contarAtlas();
        centrar(c, e, ZOOM_TEXTOS);
        elegirContacto(c);
      },
      antes: (_, medido) => {
        referenciasBanco.atlas.medido = medido;
      },
      terminar: () => {
        volverGesto();
        ed().seleccionarIds([]);
        ed().deshacer(); // el renombrado
      },
      cuadros: 10,
      paso: (c, _, __, i) => {
        if (i % 2 === 1) {
          volverGesto();
          return;
        }
        const { dx, dy } = referenciasBanco;
        moverContacto(c, dx, dy, true);
        if (!gesto.pendiente) throw new Error(`Mover 1 contacto: se rechaza ("${ultimoAviso}").`);
      },
      repeticiones: 3,
      dinamico: () => ed().dibujarDinamico,
      medirPaso: true,
      pasoImpar: true,
      nota: notaReferencias,
    },
  ];
}

// ── T19: validaciones (plan T19, sección 5; ajuste (b) de Bruno en la etapa 2) ──

const validacionesBanco = {
  /** El auxiliar NC que se agrega con la etiqueta de una bobina (el par que hace correr R6). */
  nc: "",
  etiqueta: "",
  /** Borne del NC del que sale el cable y a dónde llega su extremo libre. */
  borne: "",
  libre: { x: 0, y: 0 },
  /** Si la repetición en curso se mide (la primera es de calentamiento). */
  medido: false,
  /** ms de cada pasada de R6 en los pasos medidos, al cablear y al deshacer (D1-A, plan T19, sección 5). */
  r6: [] as number[],
};

/** Lo que el editor sabe de las validaciones, si las tiene (en la base de comparación no existen). */
type AvisosBanco = { lista(): readonly { regla: string }[]; pasadasR6: number; pasadasEtiqueta: number; msUltimaR6?: number };
const avisosDe = (ed: Editor): AvisosBanco | undefined => (ed as unknown as { avisos?: AvisosBanco }).avisos;

/**
 * Agrega, fuera de lo medido, un auxiliar NC con la etiqueta de la primera
 * bobina, a la derecha de la escena: con ese par, cada comando que toca un
 * cable hace correr R6 (`redes()` sobre la hoja entera), el peor caso. En la
 * escena del banco no hay auxiliares NC. Al terminar se deshace.
 */
function ponerParNC(e: Escena): void {
  const ed = editorCables!;
  const doc = ed.documento;
  const bobina = doc.hojas[0]!.componentes.find((c) => buscarSimbolo(c.tipo)?.elemento === "bobina" && c.etiqueta !== "");
  if (!bobina) throw new Error("Validaciones: la escena no tiene ninguna bobina con etiqueta.");
  const k = e.caja!;
  const x = Math.ceil(k.x + k.ancho) + 6;
  const y = Math.round(k.y + k.alto / 2);
  const cmd = colocar(doc, { tipo: "contactor.auxiliar_nc", x, y, rot: 0, espejado: false, etiqueta: bobina.etiqueta, params: {} });
  ed.ejecutar(cmd);
  const def = buscarSimbolo("contactor.auxiliar_nc")!;
  // El borne de arriba; el cable sube 3 unidades y queda con un extremo libre.
  const arriba = bornesColocados(def.bornes, x, y, { rotacion: 0, espejado: false }).sort((a, b) => a.y - b.y)[0]!;
  Object.assign(validacionesBanco, { nc: cmd.id, etiqueta: bobina.etiqueta, borne: arriba.nombre, libre: { x: arriba.x, y: arriba.y - 3 }, medido: false, r6: [] });
}

/** En los pares, un cable del NC del par a un punto libre (un comando que toca cables); en los impares, deshacer. */
function cablearYDeshacer(_: Camara, __: Capas, ___: Escena, i: number): void {
  const ed = editorCables!;
  const v = validacionesBanco;
  const a = avisosDe(ed);
  const pasadas = a?.pasadasR6 ?? 0;
  if (i % 2 === 1) {
    ed.deshacer();
  } else {
    const n = hechos();
    ed.ejecutar(cablear(ed.documento, { desde: { tipo: "borne", comp: v.nc, borne: v.borne }, hasta: { tipo: "libre", ...v.libre }, codos: [] }));
    if (hechos() !== n + 1) throw new Error("Dibujar 1 cable: el comando no se ejecutó.");
  }
  // Lo que tardó R6 dentro de este paso (en la base no hay validaciones).
  if (v.medido && a && a.pasadasR6 === pasadas + 1 && a.msUltimaR6 !== undefined) v.r6.push(a.msUltimaR6);
}

/** p95 y máximo de las pasadas de R6 medidas, para la nota. */
function notaR6(): string {
  const l = [...validacionesBanco.r6].sort((x, y) => x - y);
  if (l.length === 0) return "R6 sin pasadas medidas";
  const f = (x: number) => x.toFixed(2).replace(".", ",");
  return `R6 medido ${l.length} veces: mediana ${f(percentil(l, 0.5))}, p95 ${f(percentil(l, 0.95))}, máx. ${f(l.at(-1)!)} ms`;
}

/** Cuántos avisos hay de cada regla y cuántas veces corrió R6 (sin validaciones, en la base, lo dice). */
function notaValidaciones(): string {
  const v = validacionesBanco;
  const a = avisosDe(editorCables!);
  const par = `par NC ${v.nc} y bobina ${v.etiqueta}`;
  if (!a) return `${par}; sin validaciones (base)`;
  const porRegla = new Map<string, number>();
  for (const x of a.lista()) porRegla.set(x.regla, (porRegla.get(x.regla) ?? 0) + 1);
  const reglas = [...porRegla].sort(([x], [y]) => (x < y ? -1 : 1)).map(([r, n]) => `${r} ${n}`).join(", ");
  return `${par}; avisos: ${reglas || "ninguno"}; R6 calculado ${a.pasadasR6} veces, etiquetas ${a.pasadasEtiqueta}`;
}

/** Los escenarios de T19, con la escena como está (al final, así lo de antes corre igual que en la base). */
function escenariosValidaciones(): Escenario[] {
  const ed = () => editorCables!;
  return [
    {
      // Rehacer la capa estática con los contornos de aviso a la vista (R2 en
      // los auxiliares sin bobina de la escena) y un par NC y bobina.
      nombre: "Rehacer al 31 % con avisos",
      preparar: (c, e) => {
        ed().seleccionarIds([]);
        ponerParNC(e);
        centrar(c, e, ZOOM_TEXTOS);
      },
      terminar: () => ed().deshacer(),
      cuadros: 1,
      paso: (_, capas) => capas.invalidarEstatica(),
      repeticiones: 12,
      nota: notaValidaciones,
    },
    {
      // Dibujar 1 cable con 2000 y un par NC y bobina: cada cable hace correr
      // R6 con `redes()` sobre la hoja entera. Pares: el cable; impares: deshacer.
      nombre: "Dibujar 1 cable con 2000 y un par NC+bobina al 31 %",
      preparar: (c, e) => {
        ed().seleccionarIds([]);
        ponerParNC(e);
        centrar(c, e, ZOOM_TEXTOS);
      },
      terminar: () => ed().deshacer(),
      cuadros: 10,
      paso: cablearYDeshacer,
      repeticiones: 3,
      dinamico: () => ed().dibujarDinamico,
      medirPaso: true,
      pasoImpar: true,
      antes: (_, medido) => {
        validacionesBanco.medido = medido;
      },
      r6: () => [...validacionesBanco.r6],
      nota: () => `${notaValidaciones()}; ${notaR6()}`,
    },
  ];
}

/** Escenarios de la escena con cables: los de dibujo de siempre y los de edición. `t12`: la escena de T12. */
export const escenariosCables = (t12: boolean): Escenario[] => [
  ...ESCENARIOS.filter((x) =>
    ["Rehacer al 100 %", "Rehacer al 31 %", "Encuadrar (F)", "Zoom con la rueda", "Desplazar al 100 %", "Arrastre al 31 %"].includes(x.nombre),
  ),
  {
    // Seleccionar todo (2000 símbolos y 3000 cables) y deseleccionar: resaltado y resumen del panel.
    nombre: "Seleccionar todo al 31 %",
    preparar: (c, e) => {
      editorCables!.seleccionarIds([]);
      centrar(c, e, ZOOM_TEXTOS);
    },
    cuadros: 10,
    paso: seleccionarTodo,
    repeticiones: 3,
    dinamico: () => editorCables!.dibujarDinamico,
    medirPaso: true,
  },
  {
    // La vista se arrastra con todo seleccionado: el resaltado de 3000 cables en cada cuadro.
    nombre: "Arrastre con todo seleccionado al 31 %",
    preparar: (c, e) => {
      editorCables!.seleccionarIds(e.idsEnCaja(e.caja!, "toca"));
      alBordeIzquierdo(c, e, ZOOM_TEXTOS);
    },
    reiniciar: (c, e) => alBordeIzquierdo(c, e, ZOOM_TEXTOS),
    cuadros: 100,
    paso: (c) => c.desplazar(-16, -3),
    repeticiones: 2,
    dinamico: () => editorCables!.dibujarDinamico,
  },
  ...(t12
    ? [
        {
          // El arrastre que se podía hacer hasta T14a: los 40 del centro, sin
          // cables, por la escena (sin el editor). Solo en la escena de T12.
          nombre: `Mover ${BANCO_CABLES_T12.centroSinCables} sin cables al 58 %`,
          preparar: (c: Camara, e: Escena) => {
            editorCables!.seleccionarIds([]);
            centrar(c, e, ZOOM_ARRASTRE);
            seleccion = cercanosAlCentro(c, e, ARRASTRADOS, false);
          },
          cuadros: CUADROS_ARRASTRE,
          paso: moverArrastrando,
          repeticiones: 3,
          dinamico: dibujarArrastre,
        } satisfies Escenario,
      ]
    : []),
  {
    // T14a: los 40 del centro (el grupo con lugar alrededor), arrastrados con
    // el editor por el recorrido de la prueba de la netbook (previa con
    // cables, plan en cada punto de grilla) y soltados en (3, 2). Si no hay
    // comando o la mayoría de los pasos se rechaza, el banco falla: mediría
    // previas rechazadas, no el arrastre.
    nombre: `Arrastrar ${ARRASTRADOS_BANCO} cableados al 58 %`,
    preparar: (c, e) => {
      centrar(c, e, ZOOM_ARRASTRE);
      repeticionGesto = 0;
      trayectoria = POR_EL_ANILLO;
      prepararGesto(t12 ? cercanosAlCentro(c, e, ARRASTRADOS_BANCO, true) : grupoCentralBanco(editorCables!.documento));
    },
    reiniciar: () => volverGesto(),
    terminar: () => {
      volverGesto();
      if (t12) return; // la escena de T12 es solo para comparar: ahí todo se rechaza
      const { comandos, rechazados, pasos } = gesto;
      if (comandos === 0 || 2 * rechazados > pasos)
        throw new Error(`Arrastrar ${ARRASTRADOS_BANCO} cableados: ${pasos - rechazados} pasos válidos, ${rechazados} rechazados y ${comandos} comandos; no mide el arrastre.`);
    },
    cuadros: PASOS_ARRASTRE_CABLES,
    paso: arrastrarCableados,
    repeticiones: 3,
    dinamico: () => editorCables!.dibujarDinamico,
    medirPaso: true,
    // Solo los movimientos: sin el primero (aprieta y oculta) ni el último (suelta).
    pasoMedido: (i) => i > 0 && i < PASOS_ARRASTRE_CABLES - 1,
    fases: true,
    acomodados: () => gesto.acomodados,
    comandos: () => gesto.comandos,
    rechazados: () => ({ rechazados: gesto.rechazados, pasos: gesto.pasos }),
  },
  {
    // Rechazos aparte: los mismos 40 arrastrados contra los vecinos (fuera
    // del anillo). Mide lo que cuesta una previa rechazada (a rayas con ✕).
    nombre: `Arrastrar ${ARRASTRADOS_BANCO} cableados contra los vecinos (se rechaza) al 58 %`,
    preparar: (c, e) => {
      centrar(c, e, ZOOM_ARRASTRE);
      repeticionGesto = 0;
      trayectoria = CONTRA_LOS_VECINOS;
      prepararGesto(t12 ? cercanosAlCentro(c, e, ARRASTRADOS_BANCO, true) : grupoCentralBanco(editorCables!.documento));
    },
    reiniciar: () => volverGesto(),
    terminar: () => {
      volverGesto();
      trayectoria = POR_EL_ANILLO;
    },
    cuadros: PASOS_ARRASTRE_CABLES,
    paso: arrastrarCableados,
    repeticiones: 3,
    dinamico: () => editorCables!.dibujarDinamico,
    medirPaso: true,
    pasoMedido: (i) => i > 0 && i < PASOS_ARRASTRE_CABLES - 1,
    acomodados: () => gesto.acomodados,
    comandos: () => gesto.comandos,
    rechazados: () => ({ rechazados: gesto.rechazados, pasos: gesto.pasos }),
  },
  {
    // R sobre los mismos 40. Con los 8 cruces de la escena se rechaza: cada
    // cruce da un cuarto de vuelta alrededor del grupo y con hasta 2 codos no
    // hay ruta que no lo atraviese (con 2 cruces se acepta: banco.test.ts).
    // Mide lo que tarda en planear y avisar; no hay mosaicos.
    nombre: `Girar ${ARRASTRADOS_BANCO} cableados (se rechaza) al 58 %`,
    preparar: (c, e) => {
      centrar(c, e, ZOOM_ARRASTRE);
      prepararGirar(t12 ? cercanosAlCentro(c, e, ARRASTRADOS_BANCO, true) : grupoCentralBanco(editorCables!.documento), false);
    },
    nota: () => (girar.motivo ? `R se rechaza: "${girar.motivo}"` : girar.comandos > 0 ? "R se acepta" : undefined),
    // Antes de cada repetición: la primera es de calentamiento.
    reiniciar: () => void (girar.medido = girar.repeticion++ > 0),
    terminar: () => volverGesto(),
    cuadros: 10,
    paso: girarYDeshacer,
    repeticiones: 3,
    dinamico: () => editorCables!.dibujarDinamico,
    medirPaso: true,
    pasoMedido: (i) => i % 2 === 0,
    acomodados: () => gesto.acomodados,
    comandos: () => girar.comandos,
  },
  {
    // R y Ctrl+Z sobre el cableado más cercano al centro que se puede girar: comando y mosaicos.
    nombre: "Girar 1 cableado al 58 %",
    preparar: (c, e) => {
      centrar(c, e, ZOOM_ARRASTRE);
      prepararGirar([cableadoQueGira(c, e)], true);
    },
    // Antes de cada repetición: la primera es de calentamiento.
    reiniciar: () => void (girar.medido = girar.repeticion++ > 0),
    terminar: () => volverGesto(),
    cuadros: 10,
    paso: girarYDeshacer,
    repeticiones: 3,
    dinamico: () => editorCables!.dibujarDinamico,
    medirPaso: true,
    pasoMedido: (i) => i % 2 === 0,
    acomodados: () => gesto.acomodados,
    comandos: () => girar.comandos,
  },
  {
    // R y Ctrl+Z con todo seleccionado (todo rígido): el peor caso del comando y de los mosaicos.
    nombre: "Girar todo al 31 %",
    preparar: (c, e) => {
      centrar(c, e, ZOOM_TEXTOS);
      prepararGirar(e.idsEnCaja(e.caja!, "toca"), true);
    },
    // Antes de cada repetición: la primera es de calentamiento.
    reiniciar: () => void (girar.medido = girar.repeticion++ > 0),
    terminar: () => {
      volverGesto();
      editorCables!.seleccionarIds([]);
    },
    cuadros: 4,
    paso: girarYDeshacer,
    repeticiones: 2,
    dinamico: () => editorCables!.dibujarDinamico,
    medirPaso: true,
    pasoMedido: (i) => i % 2 === 0,
    comandos: () => girar.comandos,
  },
  {
    // Todo seleccionado (2000 + 3030): soltar es un Mover con todo rígido. El
    // paso medido es el soltar (comando e invalidaciones).
    nombre: "Soltar con todo seleccionado al 31 %",
    preparar: (c, e) => {
      centrar(c, e, ZOOM_TEXTOS);
      repeticionGesto = 0;
      prepararGesto(e.idsEnCaja(e.caja!, "toca"));
    },
    reiniciar: () => volverGesto(),
    terminar: () => {
      volverGesto();
      editorCables!.seleccionarIds([]);
    },
    cuadros: 3,
    paso: soltarTodo,
    repeticiones: 3,
    dinamico: () => editorCables!.dibujarDinamico,
    medirPaso: true,
    pasoMedido: (i) => i === 2,
    fases: true,
    comandos: () => gesto.comandos,
  },
  {
    // Todo seleccionado (2000 + 3030), arrastrado con el editor: el paso es
    // el plan de la previa en cada punto de grilla (todo rígido). Termina con
    // Esc, sin comando. Criterio de T14a en la netbook: mediana < 33 ms.
    nombre: "Arrastrar todo seleccionado al 31 %",
    preparar: (c, e) => {
      centrar(c, e, ZOOM_TEXTOS);
      prepararGesto(e.idsEnCaja(e.caja!, "toca"));
    },
    reiniciar: () => cancelarGesto(),
    terminar: () => {
      cancelarGesto();
      editorCables!.seleccionarIds([]);
    },
    cuadros: CUADROS_ARRASTRE_TODO,
    paso: arrastrarTodo,
    repeticiones: 3,
    dinamico: () => editorCables!.dibujarDinamico,
    medirPaso: true,
    // Sin el primero: aprieta, pasa el umbral y oculta todo.
    pasoMedido: (i) => i > 0,
  },
  {
    // Supr y Ctrl+Z sobre un componente con cables, con la vista quieta.
    nombre: "Borrar y deshacer uno con cables al 31 %",
    preparar: (c, e) => {
      editorCables!.seleccionarIds([]);
      centrar(c, e, ZOOM_TEXTOS);
    },
    cuadros: 10,
    paso: borrarYDeshacer,
    repeticiones: 3,
    dinamico: () => editorCables!.dibujarDinamico,
    medirPaso: true,
  },
  {
    // La herramienta W con un cable en curso: previa, ruteo, validación y marcas de bornes.
    nombre: "Cable en curso al 58 %",
    preparar: (c, e) => {
      editorCables!.seleccionarIds([]);
      centrar(c, e, ZOOM_ARRASTRE);
      empezarCable(c, e);
    },
    reiniciar: (c, e) => empezarCable(c, e),
    cuadros: 60,
    paso: moverCable,
    repeticiones: 3,
    dinamico: () => editorCables!.dibujarDinamico,
    medirPaso: true,
  },
  // T14c, al final: los de antes corren en el mismo orden que en la base.
  ...(t12 ? [] : escenariosReconectar()),
  // T16, después de todo lo de v0.1.3 (así lo de antes corre igual).
  ...(t12 ? [] : escenariosPegar()),
  // T18, al final (así lo de antes corre igual que en la base).
  ...(t12 ? [] : escenariosReferencias()),
  // T19, al final (así lo de antes corre igual que en la base).
  ...(t12 ? [] : escenariosValidaciones()),
];

export const OPCIONES: Record<Modo, OpcionesCapas> = {
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

/** Mediana, p95 y máximo de una lista de ms (la ordena). */
function tiempoPaso(ms: number[]): TiempoPaso {
  ms.sort((a, b) => a - b);
  return { mediana: percentil(ms, 0.5), p95: percentil(ms, 0.95), maximo: ms.at(-1) ?? 0 };
}

export function medir(escena: Escena, escenario: Escenario, opciones: OpcionesCapas): Omit<Medicion, "componentes" | "escenario" | "modo"> {
  const canvas = document.createElement("canvas");
  canvas.width = ANCHO * DPR;
  canvas.height = ALTO * DPR;
  const ctx = contexto(canvas);
  const capas = new Capas(ctx);
  capasActivas = capas;
  capas.contenido = escena;
  capas.opciones = { ...opciones };
  capas.dinamico = escenario.dinamico?.(escena) ?? null;
  const camara = new Camara();
  escenario.preparar(camara, escena);

  let t = 0;
  let cache = 0;
  let mosaicosMax = 0;
  let midiendo = false;
  /** Fase del cuadro que se dibuja (para los mosaicos por fase). */
  let fase: "inicio" | "intermedios" | "soltar" = "inicio";
  const fases = { inicio: 0, intermedios: 0, soltar: 0 };
  let invalidacionesIntermedias = 0;
  /** Dibuja un cuadro en el instante simulado `t`; devuelve la medida y el tiempo real. */
  const cuadro = (): [MedidaCuadro, number] => {
    const t0 = performance.now();
    const m = capas.dibujar(camara, ANCHO, ALTO, DPR, t);
    ctx.getImageData(0, 0, 1, 1); // fuerza el rasterizado
    const ms = performance.now() - t0;
    cache = Math.max(cache, capas.memoriaCache);
    if (midiendo) {
      mosaicosMax = Math.max(mosaicosMax, m.mosaicos);
      fases[fase] = Math.max(fases[fase], m.mosaicos);
    }
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
  const pasos: number[] = [];
  const pasosImpares: number[] = [];
  let total = 0;
  /** Lentos desde el último paso (el paso y los cuadros hasta el siguiente) y el máximo de eso. */
  let lentosPaso = 0;
  let lentosPorPasoMax = 0;
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
      if (ms > LIMITE_MS) lentosPorPasoMax = Math.max(lentosPorPasoMax, ++lentosPaso);
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
      fase = i === 0 ? "inicio" : i === escenario.cuadros - 1 ? "soltar" : "intermedios";
      escenario.antes?.(i, medido);
      lentosPaso = 0;
      const p0 = performance.now();
      const inv0 = invalidaciones;
      escenario.paso(camara, capas, escena, i);
      if (medido && fase === "intermedios") invalidacionesIntermedias += invalidaciones - inv0;
      if (medido && escenario.medirPaso && (escenario.pasoMedido?.(i) ?? true))
        (escenario.pasoImpar && i % 2 === 1 ? pasosImpares : pasos).push(performance.now() - p0);
      t += CUADRO;
      const antes = { ...capas.textosDinamica };
      const [m2, ms] = cuadro();
      if (medido) sumarTextos(i === 0 ? usoPrimero : usoResto, antes);
      anotar(ms);
      m = m2;
    }
    const antes = { ...capas.textosDinamica };
    fase = "soltar";
    if (m) cola(m, anotar);
    if (medido) sumarTextos(usoResto, antes);
  }
  midiendo = false;
  escenario.terminar?.(escena);
  capas.liberarCache();
  capasActivas = null;
  canvas.width = canvas.height = 0;
  tiempos.sort((a, b) => a - b);
  return {
    cuadros: tiempos.length,
    mediana: percentil(tiempos, 0.5),
    p95: percentil(tiempos, 0.95),
    maximo: tiempos.at(-1) ?? 0,
    lentos: tiempos.filter((x) => x > LIMITE_MS).length,
    sobreCuadro: tiempos.filter((x) => x > CUADRO).length,
    lentosPorPasoMax,
    porGesto: total / escenario.repeticiones,
    cache,
    mosaicosMax,
    ...(escenario.textos ? { textos: { primero: usoPrimero, resto: usoResto } } : {}),
    ...(escenario.medirPaso ? { paso: tiempoPaso(pasos) } : {}),
    ...(escenario.pasoImpar ? { pasoImpar: tiempoPaso(pasosImpares) } : {}),
    ...(escenario.revision ? { revision: escenario.revision() } : {}),
    ...(escenario.fases ? { fases, invalidacionesIntermedias } : {}),
    ...(escenario.rechazados ? { rechazados: escenario.rechazados() } : {}),
    ...(escenario.nota?.() ? { nota: escenario.nota() } : {}),
    ...(escenario.acomodados ? { acomodados: escenario.acomodados() } : {}),
    ...(escenario.comandos ? { comandos: escenario.comandos() } : {}),
    ...(escenario.r6 ? { r6: escenario.r6() } : {}),
  };
}
