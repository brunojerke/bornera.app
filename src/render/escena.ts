// Contenido de la capa estática y escena de componentes con recorte por vista.
// Las cajas de dibujo de cada componente se calculan una sola vez al armar la
// escena; en cada redibujo solo se comparan con la parte visible.

import type { DefinicionSimbolo, Primitiva } from "../core/symbols";
import { unirCajas, type Caja } from "./camara";
import type { Detalle } from "./detalle";
import type { Renderer } from "./renderer";
import { cajaDibujo, dibujarMarcasBornes, dibujarSimbolo, type Colocacion } from "./simbolo";

/** Colores del tema para el contenido (salen de tema.css). */
export interface ColoresContenido {
  /** Trazo y textos de los símbolos. */
  simbolo: string;
  /** Marcas de los bornes. */
  borne: string;
  /** Validaciones (T19): contorno de etiqueta y anillos. Opcional: sin él, el de los bornes. */
  aviso?: string;
  /**
   * Lo que no se puede hacer (T19, D-color A): la previa de Colocar o de
   * Pegar en conflicto, un cable en curso inválido y un arrastre con
   * conflicto, siempre con su ✕. En Simular (T33, C-A y M-A), la red en corto
   * y el contorno de las bobinas que oscilan. Opcional: sin él, el de los bornes.
   */
  conflicto?: string;
  /** En Simular (T33, C-A): las redes con una fase (L, L1, L2…). Opcional: sin él, el de los símbolos. */
  fase?: string;
  /** En Simular: las redes con neutro. Opcional: sin él, el de los símbolos. */
  neutro?: string;
  /** En Simular: el relleno de una lámpara encendida o una bobina con tensión. Opcional: sin él, el de los bornes. */
  encendida?: string;
}

/** Lo que el contenido necesita saber del cuadro que se está dibujando. */
export interface InfoDibujo {
  /** Píxeles CSS por unidad de grilla (para grosores mínimos en pantalla). */
  escala: number;
  colores: ColoresContenido;
  /** Parte de la grilla que se está dibujando: lo que no la toca se puede omitir. */
  visible: Caja;
  /** Qué detalles dibujar a este zoom. */
  detalle: Detalle;
}

/** Algo que se dibuja en la capa estática (en unidades de grilla). */
export interface Contenido {
  /** Caja que ocupa todo, para encuadrar; null si está vacío. */
  readonly caja: Caja | null;
  /** Cantidad de componentes, para el contador de rendimiento. */
  readonly cantidad: number;
  /** Dibuja lo que toca `info.visible`. Devuelve cuántos componentes dibujó. */
  dibujar(r: Renderer, info: InfoDibujo): number;
  /** Cuántos componentes tocan `vista` (para el contador de rendimiento). */
  contar(vista: Caja): number;
  /**
   * Se dibuja el estado de una simulación (T33): las capas rehacen los
   * mosaicos con otro presupuesto (P-B) y no muestran mosaicos con un estado
   * viejo (ajuste 2). Sin él, como en Editar.
   */
  readonly simulando?: boolean;
}

/** IEC 60617 pide líneas de 0,25 mm (0,1 unidad), pero en pantalla nunca menos de 1 px. */
export function grosorLinea(escala: number): number {
  return Math.max(0.1, 1 / escala);
}

/** Un símbolo puesto en la escena. */
export interface ComponenteEscena extends Colocacion {
  def: DefinicionSimbolo;
  /** Designación: "S1", "K1", "H1". */
  etiqueta?: string;
  /** Lista de referencias cruzadas de una bobina (T18), ya armada; sin lista, undefined. */
  referencias?: readonly string[];
  /**
   * Lleva el contorno a rayas de una validación de etiqueta (T19: R1 a R6 y
   * R9), ya resuelto por el editor: el dibujo no sabe de reglas.
   */
  conAviso?: true;
  /**
   * En Simular (T33, D9-B): el contacto está accionado (el NA cerrado, el NC
   * abierto) y se dibuja con `primitivasAccionado`. Lo resuelve el editor.
   */
  accionado?: true;
  /** En Simular: la lámpara está encendida o la bobina tiene tensión; su cuerpo va relleno. */
  encendido?: true;
  /** En Simular, con la simulación detenida (D3-A, M-A): la bobina oscila; contorno a rayas en `conflicto`. */
  marcado?: true;
}

export interface OpcionesEscena {
  /** Marca los puntos de conexión de cada borne. Por defecto, sí. */
  marcarBornes?: boolean;
}

export class Escena implements Contenido {
  readonly caja: Caja | null;
  /** Caja de dibujo de cada componente: x0, y0, x1, y1 seguidos. */
  private readonly cajas: Float64Array;
  /** Índices visibles del último dibujo (se reusa para no pedir memoria en cada cuadro). */
  private readonly visibles: Uint32Array;
  private readonly marcarBornes: boolean;

  constructor(
    readonly componentes: readonly ComponenteEscena[],
    opciones: OpcionesEscena = {},
  ) {
    this.marcarBornes = opciones.marcarBornes ?? true;
    this.cajas = new Float64Array(componentes.length * 4);
    this.visibles = new Uint32Array(componentes.length);
    let total: Caja | null = null;
    componentes.forEach((c, i) => {
      const k = cajaDibujo(c.def, c, c.etiqueta, c.referencias);
      this.cajas.set([k.x, k.y, k.x + k.ancho, k.y + k.alto], i * 4);
      total = total ? unirCajas(total, k) : k;
    });
    this.caja = total;
  }

  get cantidad(): number {
    return this.componentes.length;
  }

  /** Cuántos componentes tocan `vista` y cuáles (en `this.visibles`). */
  private recortar(vista: Caja): number {
    const { cajas, visibles } = this;
    const x0 = vista.x;
    const y0 = vista.y;
    const x1 = vista.x + vista.ancho;
    const y1 = vista.y + vista.alto;
    let n = 0;
    for (let i = 0, j = 0; i < this.componentes.length; i++, j += 4) {
      if (cajas[j]! <= x1 && cajas[j + 2]! >= x0 && cajas[j + 1]! <= y1 && cajas[j + 3]! >= y0) {
        visibles[n++] = i;
      }
    }
    return n;
  }

  contar(vista: Caja): number {
    return this.recortar(vista);
  }

  /** Índices de los componentes que tocan `vista` (para tests y herramientas). */
  indicesVisibles(vista: Caja): number[] {
    return Array.from(this.visibles.subarray(0, this.recortar(vista)));
  }

  dibujar(r: Renderer, info: InfoDibujo): number {
    const n = this.recortar(info.visible);
    dibujarComponentes(r, info, this.componentes, this.visibles, n, this.marcarBornes);
    return n;
  }
}

/** La definición con el dibujo accionado en lugar del de reposo (T33): una por definición, para que el Renderer la cachee. */
const accionadas = new WeakMap<DefinicionSimbolo, DefinicionSimbolo>();

/** La definición a dibujar con el contacto accionado: la misma si no tiene dibujo accionado. */
export function definicionAccionada(def: DefinicionSimbolo): DefinicionSimbolo {
  const p = def.primitivasAccionado;
  if (!p) return def;
  let d = accionadas.get(def);
  if (!d) accionadas.set(def, (d = { ...def, primitivas: p }));
  return d;
}

/** El cuerpo que se rellena de una carga encendida: su primer círculo o rectángulo; null si no tiene. */
const cuerpos = new WeakMap<DefinicionSimbolo, Primitiva | null>();
function cuerpoRelleno(def: DefinicionSimbolo): Primitiva | null {
  let p = cuerpos.get(def);
  if (p === undefined) cuerpos.set(def, (p = def.primitivas.find((q) => q.forma === "circulo" || q.forma === "rectangulo") ?? null));
  return p;
}

/** Rellena el cuerpo de una carga encendida (T33), debajo de su trazo, con el color `color`. */
function rellenarCuerpo(r: Renderer, c: ComponenteEscena, color: string): void {
  const p = cuerpoRelleno(c.def);
  if (!p) return;
  r.guardar();
  r.estilo({ relleno: color });
  r.trasladar(c.x, c.y);
  if (c.rotacion !== 0) r.rotar(c.rotacion);
  if (c.espejado) r.escalar(-1, 1);
  if (p.forma === "circulo") r.circulo(p.cx, p.cy, p.r, true);
  else if (p.forma === "rectangulo") r.rectangulo(p.x, p.y, p.ancho, p.alto, true);
  r.restaurar();
}

/**
 * Dibuja los componentes `componentes[indices[0..n)]`. Primero todos los
 * símbolos, después todas las marcas: así el estilo cambia dos veces por
 * cuadro y no dos veces por componente.
 *
 * En Simular (T33) cada componente puede venir con su estado: accionado (se
 * dibuja su geometría accionada), encendido (el cuerpo relleno, debajo del
 * trazo) o marcado (contorno a rayas en `conflicto`). Los marcados solo se
 * buscan con `marcados`: en Editar no cuestan una lectura.
 */
export function dibujarComponentes(
  r: Renderer,
  { escala, colores, detalle }: InfoDibujo,
  componentes: readonly (ComponenteEscena | null)[],
  indices: ArrayLike<number>,
  n: number,
  marcarBornes: boolean,
  marcados = false,
): void {
  const g = grosorLinea(escala);
  r.estilo({ trazo: colores.simbolo, relleno: colores.simbolo, grosor: g });
  for (let i = 0; i < n; i++) {
    const c = componentes[indices[i]!]!;
    if (c.encendido === true) rellenarCuerpo(r, c, colores.encendida ?? colores.borne);
    const def = c.accionado === true ? definicionAccionada(c.def) : c.def;
    dibujarSimbolo(r, def, c, { etiqueta: c.etiqueta, textos: detalle.textos, referencias: c.referencias });
  }

  // El umbral antes que nada: debajo de él, marcas y contornos no cuestan ni una lectura (T19, agregado 1).
  if (!detalle.bornes) return;
  if (marcarBornes) {
    r.estilo({ trazo: colores.borne, relleno: colores.borne, grosor: g });
    for (let i = 0; i < n; i++) {
      const c = componentes[indices[i]!]!;
      dibujarMarcasBornes(r, c.def, c);
    }
  }
  dibujarContornos(r, colores.aviso ?? colores.borne, g, componentes, indices, n, conAviso);
  if (marcados) dibujarContornos(r, colores.conflicto ?? colores.borne, g, componentes, indices, n, conMarca);
}

const conAviso = (c: ComponenteEscena) => c.conAviso === true;
const conMarca = (c: ComponenteEscena) => c.marcado === true;

/** Separación entre el cuerpo del símbolo y su contorno de aviso, en unidades. */
export const MARGEN_CONTORNO = 0.25;
/** Largo de cada raya del contorno de aviso, y de cada hueco, en unidades. */
export const RAYA_CONTORNO = 0.5;

/** Rayas de los contornos del cuadro en curso (x0, y0, x1, y1 seguidos): se reusa, sin pedir memoria por componente. */
const rayasContorno: number[] = [];

/**
 * Contorno a rayas sobre el cuerpo de cada componente con `conAviso` (T19,
 * opción P), o con la marca de la detención (T33, M-A): todas las rayas en un
 * solo trazo, en `color`. Las cuentas van en línea (sin cajas ni objetos por
 * componente). Lo llama `dibujarComponentes` solo con las marcas de bornes
 * visibles. Devuelve cuántas rayas dibujó.
 */
function dibujarContornos(
  r: Renderer,
  color: string,
  g: number,
  componentes: readonly (ComponenteEscena | null)[],
  indices: ArrayLike<number>,
  n: number,
  lleva: (c: ComponenteEscena) => boolean,
): number {
  let t = 0;
  for (let i = 0; i < n; i++) {
    const c = componentes[indices[i]!]!;
    if (!lleva(c)) continue;
    const girado = c.rotacion === 90 || c.rotacion === 270;
    const mx = (girado ? c.def.tamano.alto : c.def.tamano.ancho) / 2 + MARGEN_CONTORNO;
    const my = (girado ? c.def.tamano.ancho : c.def.tamano.alto) / 2 + MARGEN_CONTORNO;
    const x0 = c.x - mx;
    const x1 = c.x + mx;
    const y0 = c.y - my;
    const y1 = c.y + my;
    t = rayas(x0, y0, x1, y0, t);
    t = rayas(x0, y1, x1, y1, t);
    t = rayas(x0, y0, x0, y1, t);
    t = rayas(x1, y0, x1, y1, t);
  }
  if (t === 0) return 0;
  r.estilo({ trazo: color, relleno: color, grosor: g });
  r.lineas(rayasContorno, t);
  return t;
}

/** Anota las rayas de un lado horizontal o vertical, desde su esquina. Devuelve la cuenta nueva. */
function rayas(xa: number, ya: number, xb: number, yb: number, t: number): number {
  const largo = xb - xa + (yb - ya);
  const dx = xb > xa ? 1 : 0;
  const dy = 1 - dx;
  for (let s = 0; s < largo; s += 2 * RAYA_CONTORNO) {
    const e = Math.min(s + RAYA_CONTORNO, largo);
    const j = t * 4;
    rayasContorno[j] = xa + dx * s;
    rayasContorno[j + 1] = ya + dy * s;
    rayasContorno[j + 2] = xa + dx * e;
    rayasContorno[j + 3] = ya + dy * e;
    t++;
  }
  return t;
}
