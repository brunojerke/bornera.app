// Escena que cambia: componentes que se agregan, se quitan y se mueven por
// id (el del documento). Es lo que dibuja el editor.
//
// Cada operación devuelve las cajas de dibujo afectadas, en unidades de
// grilla, para pasarlas a `Capas.invalidarRegion`: así solo se rehacen los
// mosaicos que tocan el cambio. Al actualizar, la vieja y la nueva van por
// separado y no unidas: deshacer un movimiento largo marcaría toda la franja
// intermedia.
//
// Mientras se arrastran (T9), los componentes se ocultan de la capa estática:
// siguen en el índice, para elegirlos y resaltarlos, pero `dibujar` no los
// dibuja (los dibuja la capa dinámica con `dibujarDesplazados`). Cambiar o
// quitar un oculto no afecta ninguna caja: la estática no lo muestra. Con
// los cables pasa lo mismo (T14a): mientras se arrastra, los cables que se
// pueden acomodar se ocultan y los dibuja la capa dinámica.
//
// El recorte por vista usa un índice espacial (indiceEspacial.ts) en lugar de
// recorrer todos los componentes. El mismo índice sirve para elegir con el
// mouse (`idEnPunto`, `idsEnCaja`): primero da los candidatos por su caja de
// dibujo y después se compara con su forma para elegir (`FormaEleccion`).
// Esas consultas no miran qué es cada elemento, solo su forma.
//
// Los cables (T12) tienen su propio índice: se dibujan antes que los
// componentes (las marcas de bornes quedan encima), en un solo trazo por
// pasada y solo los tramos que tocan lo que se dibuja (un cable largo en L
// aparece en mosaicos que su caja toca y sus tramos no). Al elegir con un
// clic, un cable gana sobre un componente: es fino, y si el clic cae sobre él
// es porque se apuntó a él.

import { ampliarCaja, seTocan, unirCajas, type Caja } from "./camara";
import { diametroPunto, grosorEnPixeles, sobranteAlineado, TOPE_PUNTO_AL_PIXEL } from "./canvas2d";
import { dibujarComponentes, grosorLinea, type ComponenteEscena, type Contenido, type InfoDibujo, type OpcionesEscena } from "./escena";
import { IndiceEspacial } from "./indiceEspacial";
import type { Renderer } from "./renderer";
import { cajaDibujo, cajaEtiqueta, cajaSimbolo } from "./simbolo";

/**
 * Cómo se elige un elemento con el mouse, en unidades de grilla.
 * - `zonas`: lo que se puede tocar. Un componente: la caja del símbolo y la de
 *   su etiqueta (no los huecos donde van los nombres de bornes). Un cable: un
 *   rectángulo angosto por tramo.
 * - `cuerpo`: lo que tiene que quedar adentro de un rectángulo "contiene".
 *   Un componente: la caja del símbolo, sin la etiqueta.
 */
export interface FormaEleccion {
  cuerpo: Caja;
  zonas: readonly Caja[];
  /** Caja que rodea todas las zonas (para el resaltado); se calcula una vez. */
  contorno: Caja;
}

/** Arma la forma con su contorno. */
export function crearForma(cuerpo: Caja, zonas: readonly Caja[]): FormaEleccion {
  let contorno = zonas[0] ?? cuerpo;
  for (let i = 1; i < zonas.length; i++) contorno = unirCajas(contorno, zonas[i]!);
  return { cuerpo, zonas, contorno };
}

/**
 * Rectángulo de selección: "contiene" elige lo que queda entero adentro
 * (arrastrando de izquierda a derecha); "toca", lo que lo toca aunque sea un
 * poco (de derecha a izquierda).
 */
export type ModoRectangulo = "contiene" | "toca";

/** Forma para elegir un componente. */
export function formaComponente(c: ComponenteEscena): FormaEleccion {
  const cuerpo = cajaSimbolo(c.def, c);
  const etiqueta = cajaEtiqueta(c.def, c, c.etiqueta);
  return crearForma(cuerpo, etiqueta ? [cuerpo, etiqueta] : [cuerpo]);
}

/** True si `a` está entera dentro de `b` (bordes incluidos). */
export function contieneCaja(b: Caja, a: Caja): boolean {
  return a.x >= b.x && a.y >= b.y && a.x + a.ancho <= b.x + b.ancho && a.y + a.alto <= b.y + b.alto;
}

/**
 * Como `contieneCaja`, con una tolerancia de redondeo: -9,9 + 12,4 da
 * 2,4999…, no 2,5. Para decidir si alcanza con invalidar una sola caja.
 */
function cubreCasi(b: Caja, a: Caja): boolean {
  const e = 1e-9;
  return a.x >= b.x - e && a.y >= b.y - e && a.x + a.ancho <= b.x + b.ancho + e && a.y + a.alto <= b.y + b.alto + e;
}

/** True si el punto está en la caja agrandada `tolerancia` hacia cada lado. */
function puntoEn(k: Caja, x: number, y: number, tolerancia: number): boolean {
  return x >= k.x - tolerancia && x <= k.x + k.ancho + tolerancia && y >= k.y - tolerancia && y <= k.y + k.alto + tolerancia;
}

/** Cuerpos de los arrastrados (x, y, ancho, alto seguidos): se reusa para no pedir memoria. */
const cuerpos: number[] = [];

// ── Cables ─────────────────────────────────────────────────────────────────

/**
 * Un cable en la escena, ya resuelto (el editor saca los puntos del
 * documento con `recorridoCable`). La escena no conoce bornes ni comandos.
 */
export interface CableEscena {
  /** Recorrido: x, y de cada punto seguidos (por lo menos dos puntos). */
  puntos: readonly number[];
  /** Extremos libres: x, y seguidos (0, 1 o 2 puntos). */
  libres: readonly number[];
}

/**
 * Lo que sobresale el trazo de un cable de su línea, en unidades: medio
 * grosor (0,5 u en el zoom mínimo, 1 px) y el suavizado del borde. El tope
 * redondeado de cada tramo también queda adentro.
 */
export const MARGEN_CABLE = 0.5;
/** Radio del círculo de un extremo libre, en unidades. */
export const RADIO_LIBRE = 0.25;
/**
 * Tolerancia máxima para elegir un cable con un clic, en unidades: con dos
 * cables paralelos a 1 unidad, un clic entre los dos no agarra ninguno.
 */
export const TOPE_TOLERANCIA_CABLE = 0.4;

/**
 * Cajas a rehacer de un cable: una por tramo (con el margen del trazo) y una
 * por extremo libre. No la caja entera: un cable largo en L marcaría todo el
 * rectángulo que encierra.
 */
export function cajasCable(c: CableEscena): Caja[] {
  const cajas: Caja[] = [];
  const p = c.puntos;
  const m = MARGEN_CABLE;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const x0 = Math.min(p[i]!, p[i + 2]!);
    const y0 = Math.min(p[i + 1]!, p[i + 3]!);
    const x1 = Math.max(p[i]!, p[i + 2]!);
    const y1 = Math.max(p[i + 1]!, p[i + 3]!);
    cajas.push({ x: x0 - m, y: y0 - m, ancho: x1 - x0 + 2 * m, alto: y1 - y0 + 2 * m });
  }
  const r = RADIO_LIBRE + m;
  for (let i = 0; i + 1 < c.libres.length; i += 2) cajas.push({ x: c.libres[i]! - r, y: c.libres[i + 1]! - r, ancho: 2 * r, alto: 2 * r });
  return cajas;
}

/** Caja de dibujo de un cable: la unión de sus cajas por tramo. */
function cajaCable(cajas: readonly Caja[]): Caja {
  let k = cajas[0]!;
  for (let i = 1; i < cajas.length; i++) k = unirCajas(k, cajas[i]!);
  return k;
}

/**
 * Forma para elegir un cable: cada tramo, sin grosor (la tolerancia del clic
 * lo engorda). El cuerpo es la caja de todos los puntos: si queda entera
 * dentro del rectángulo, quedan todos los tramos.
 */
export function formaCable(c: CableEscena): FormaEleccion {
  const p = c.puntos;
  const zonas: Caja[] = [];
  for (let i = 0; i + 3 < p.length; i += 2) {
    const x0 = Math.min(p[i]!, p[i + 2]!);
    const y0 = Math.min(p[i + 1]!, p[i + 3]!);
    zonas.push({ x: x0, y: y0, ancho: Math.abs(p[i + 2]! - p[i]!), alto: Math.abs(p[i + 3]! - p[i + 1]!) });
  }
  const forma = crearForma(zonas[0]!, zonas);
  return { ...forma, cuerpo: forma.contorno };
}

/** Tramos a trazar en el cuadro en curso (x0, y0, x1, y1 seguidos): se reusa para no pedir memoria. */
const tramos: number[] = [];

/**
 * Anota en `salida`, desde `n`, los tramos de `c` que tocan `v` (con el margen
 * del trazo). Devuelve el nuevo total. Corridos (dx, dy).
 */
export function anotarTramos(c: CableEscena, v: Caja, salida: number[], n: number, dx = 0, dy = 0): number {
  const p = c.puntos;
  const m = MARGEN_CABLE;
  const vx0 = v.x - m - dx;
  const vy0 = v.y - m - dy;
  const vx1 = v.x + v.ancho + m - dx;
  const vy1 = v.y + v.alto + m - dy;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = p[i]!;
    const ay = p[i + 1]!;
    const bx = p[i + 2]!;
    const by = p[i + 3]!;
    if (Math.max(ax, bx) < vx0 || Math.min(ax, bx) > vx1 || Math.max(ay, by) < vy0 || Math.min(ay, by) > vy1) continue;
    const j = n * 4;
    salida[j] = ax + dx;
    salida[j + 1] = ay + dy;
    salida[j + 2] = bx + dx;
    salida[j + 3] = by + dy;
    n++;
  }
  return n;
}

/** Cables de la escena, con su propio índice espacial. */
class Cables {
  readonly lugares: (CableEscena | null)[] = [];
  /** Cajas por tramo de cada lugar. */
  readonly cajas: (Caja[] | null)[] = [];
  readonly formas: (FormaEleccion | null)[] = [];
  readonly ids: (string | null)[] = [];
  readonly lugarDe = new Map<string, number>();
  private readonly libres: number[] = [];
  readonly indice = new IndiceEspacial();
  readonly visibles: number[] = [];
  /** Lugares que la capa estática no dibuja (se arrastran, T14a). */
  readonly ocultos = new Set<number>();

  get cantidad(): number {
    return this.lugarDe.size;
  }

  /** Agrega o cambia; devuelve las cajas a rehacer (las viejas y las nuevas; ninguna si está oculto). */
  poner(id: string, c: CableEscena): Caja[] {
    let n = this.lugarDe.get(id);
    const oculto = n !== undefined && this.ocultos.has(n);
    const viejas = n === undefined ? [] : this.cajas[n]!;
    if (n === undefined) {
      n = this.libres.pop() ?? this.lugares.length;
      this.ids[n] = id;
      this.lugarDe.set(id, n);
    }
    const nuevas = cajasCable(c);
    this.lugares[n] = c;
    this.cajas[n] = nuevas;
    this.formas[n] = formaCable(c);
    this.indice.insertar(n, cajaCable(nuevas));
    return oculto ? [] : [...viejas, ...nuevas];
  }

  /** Quita; devuelve las cajas que ocupaba (vacío si no estaba o estaba oculto). */
  quitar(id: string): Caja[] {
    const n = this.lugarDe.get(id);
    if (n === undefined) return [];
    const k = this.ocultos.delete(n) ? [] : this.cajas[n]!;
    this.indice.quitar(n);
    this.lugares[n] = null;
    this.cajas[n] = null;
    this.formas[n] = null;
    this.ids[n] = null;
    this.lugarDe.delete(id);
    this.libres.push(n);
    return k;
  }

  /** El cable de arriba (el último en dibujarse) a menos de `tolerancia` de (x, y), o null. */
  enPunto(x: number, y: number, tolerancia: number): string | null {
    const t = Math.min(tolerancia, TOPE_TOLERANCIA_CABLE);
    const candidatos = this.indice.enCaja({ x: x - t, y: y - t, ancho: 2 * t, alto: 2 * t });
    for (let i = candidatos.length - 1; i >= 0; i--) {
      const n = candidatos[i]!;
      for (const z of this.formas[n]!.zonas) if (puntoEn(z, x, y, t)) return this.ids[n]!;
    }
    return null;
  }

  /**
   * Dibuja los cables que tocan `info.visible`: solo sus tramos que la tocan,
   * todos en un solo trazo, y después los círculos de los extremos libres.
   */
  dibujar(r: Renderer, info: InfoDibujo): void {
    if (this.lugarDe.size === 0) return;
    const v = info.visible;
    const visibles = this.indice.enCaja(v, this.visibles);
    if (this.ocultos.size > 0) {
      let j = 0;
      for (const lugar of visibles) if (!this.ocultos.has(lugar)) visibles[j++] = lugar;
      visibles.length = j;
    }
    if (visibles.length === 0) return;
    let n = 0;
    for (const lugar of visibles) n = anotarTramos(this.lugares[lugar]!, v, tramos, n);
    const g = grosorLinea(info.escala);
    if (n > 0) {
      r.estilo({ trazo: info.colores.simbolo, relleno: info.colores.simbolo, grosor: g });
      r.lineas(tramos, n);
    }
    if (!info.detalle.bornes) return;
    let estilo = false;
    const m = RADIO_LIBRE + MARGEN_CABLE;
    for (const lugar of visibles) {
      const l = this.lugares[lugar]!.libres;
      for (let i = 0; i + 1 < l.length; i += 2) {
        const x = l[i]!;
        const y = l[i + 1]!;
        if (x + m < v.x || x - m > v.x + v.ancho || y + m < v.y || y - m > v.y + v.alto) continue;
        if (!estilo) {
          r.estilo({ trazo: info.colores.borne, relleno: info.colores.borne, grosor: g });
          estilo = true;
        }
        r.circulo(x, y, RADIO_LIBRE);
      }
    }
  }
}

// ── Uniones (T14b) ─────────────────────────────────────────────────────────

/** Una unión en la escena: su punto y lo que se junta ahí (para ocultarla en un arrastre). */
export interface UnionEscena {
  x: number;
  y: number;
  cables: readonly string[];
  componentes: readonly string[];
}

/** Diámetro nominal del punto de unión, en unidades; en pantalla se redondea en px (ver `diametroPunto`). */
export const DIAMETRO_UNION = 0.5;

/**
 * Medio lado de la caja de una unión, en unidades, a `k` px físicos por
 * unidad: el radio ya redondeado, lo que se corre al alinear y, solo con el
 * arco suavizado (más de `TOPE_PUNTO_AL_PIXEL`), 1 px del suavizado: al
 * píxel, lo pintado no pasa del radio.
 */
export function margenUnion(k: number): number {
  const nominal = grosorLinea(k) * k;
  const d = diametroPunto(DIAMETRO_UNION * k, grosorEnPixeles(nominal));
  return (d / 2 + sobranteAlineado(nominal) + (d <= TOPE_PUNTO_AL_PIXEL ? 0 : 1)) / k;
}

/**
 * Medio lado de la caja de cada unión: el máximo de `margenUnion` desde la
 * escala más chica en que se dibujan (`ESCALA_MIN_BORNES`, 6 px/u). No es en
 * 6 px/u (punto de 3 px: 2,5 / 6 = 0,417 u) sino apenas pasando 8 px/u, donde
 * el punto salta a 5 px al píxel con el trazo de 1 px: (2,5 + 1) / 8 =
 * 0,4375 u. El arco (desde 18 px/u) pide 0,367 u como mucho. Lo prueba
 * uniones.test.ts en todas las escalas.
 */
export const MARGEN_UNION = (2.5 + 1) / 8;

/** Caja a rehacer de una unión. */
export function cajaUnion(x: number, y: number): Caja {
  return { x: x - MARGEN_UNION, y: y - MARGEN_UNION, ancho: 2 * MARGEN_UNION, alto: 2 * MARGEN_UNION };
}

const claveUnion = (x: number, y: number) => `${x},${y}`;

/** Centros de las uniones del cuadro en curso (x, y seguidos): se reusa para no pedir memoria. */
const centros: number[] = [];

/** Uniones de la escena, con su propio índice espacial. */
class PuntosUnion {
  readonly lugares: (UnionEscena | null)[] = [];
  readonly lugarDe = new Map<string, number>();
  private readonly libres: number[] = [];
  readonly indice = new IndiceEspacial();
  private readonly visibles: number[] = [];
  /** Lugares de las uniones de cada cable o componente. */
  private readonly porAncla = new Map<string, Set<number>>();

  get cantidad(): number {
    return this.lugarDe.size;
  }

  /** Agrega o cambia la unión de su punto; devuelve las cajas a rehacer. */
  poner(u: UnionEscena): Caja[] {
    const k = claveUnion(u.x, u.y);
    let n = this.lugarDe.get(k);
    if (n !== undefined) this.desanclar(n);
    else {
      n = this.libres.pop() ?? this.lugares.length;
      this.lugarDe.set(k, n);
      this.indice.insertar(n, cajaUnion(u.x, u.y));
    }
    const copia: UnionEscena = { x: u.x, y: u.y, cables: [...u.cables], componentes: [...u.componentes] };
    this.lugares[n] = copia;
    for (const id of [...copia.cables, ...copia.componentes]) {
      let s = this.porAncla.get(id);
      if (!s) this.porAncla.set(id, (s = new Set()));
      s.add(n);
    }
    return [cajaUnion(u.x, u.y)];
  }

  /** Quita la unión de (x, y); devuelve su caja (vacío si no estaba). */
  quitar(x: number, y: number): Caja[] {
    const k = claveUnion(x, y);
    const n = this.lugarDe.get(k);
    if (n === undefined) return [];
    this.desanclar(n);
    this.indice.quitar(n);
    this.lugares[n] = null;
    this.lugarDe.delete(k);
    this.libres.push(n);
    return [cajaUnion(x, y)];
  }

  private desanclar(n: number): void {
    const u = this.lugares[n];
    if (!u) return;
    for (const id of [...u.cables, ...u.componentes]) {
      const s = this.porAncla.get(id);
      if (!s) continue;
      s.delete(n);
      if (s.size === 0) this.porAncla.delete(id);
    }
  }

  /** Cajas de las uniones donde está alguno de `ids` (cables o componentes), sin repetir. */
  cajasDe(ids: Iterable<string>): Caja[] {
    const vistos = new Set<number>();
    const cajas: Caja[] = [];
    for (const id of ids) {
      const s = this.porAncla.get(id);
      if (!s) continue;
      for (const n of s) {
        if (vistos.has(n)) continue;
        vistos.add(n);
        const u = this.lugares[n]!;
        cajas.push(cajaUnion(u.x, u.y));
      }
    }
    return cajas;
  }

  /**
   * Dibuja las uniones que tocan `info.visible`, todas en un solo relleno, con
   * el grosor de los cables (el centro cae en el del cable). `oculta`: true si
   * la unión toca algo que la capa estática no dibuja.
   */
  dibujar(r: Renderer, info: InfoDibujo, oculta: ((u: UnionEscena) => boolean) | null): void {
    if (this.lugarDe.size === 0 || !info.detalle.bornes) return;
    const visibles = this.indice.enCaja(info.visible, this.visibles);
    let n = 0;
    for (const lugar of visibles) {
      const u = this.lugares[lugar]!;
      if (oculta && oculta(u)) continue;
      centros[2 * n] = u.x;
      centros[2 * n + 1] = u.y;
      n++;
    }
    if (n === 0) return;
    r.estilo({ trazo: info.colores.simbolo, relleno: info.colores.simbolo, grosor: grosorLinea(info.escala) });
    r.puntos(centros, n, DIAMETRO_UNION);
  }

  /** Las uniones cuya caja toca `caja` (para los tests y el humo). */
  en(caja: Caja): UnionEscena[] {
    return this.indice.enCaja(caja).map((n) => this.lugares[n]!);
  }
}

export class EscenaEditable implements Contenido {
  /** Componente en cada lugar del índice; null si el lugar está libre. */
  private readonly lugares: (ComponenteEscena | null)[] = [];
  /** Caja de dibujo de cada lugar. */
  private readonly cajas: (Caja | null)[] = [];
  /** Forma para elegir de cada lugar. */
  private readonly formas: (FormaEleccion | null)[] = [];
  private readonly ids: (string | null)[] = [];
  private readonly lugarDe = new Map<string, number>();
  private readonly libres: number[] = [];
  private readonly indice = new IndiceEspacial();
  /** Lugares visibles del último recorte (se reusa para no pedir memoria en cada cuadro). */
  private readonly visibles: number[] = [];
  private readonly marcarBornes: boolean;
  /** Caja total; undefined si hay que recalcularla (algo se quitó o se achicó). */
  private cajaTotal: Caja | null | undefined = null;
  /** Lugares que la capa estática no dibuja (se están arrastrando). */
  private readonly ocultos = new Set<number>();
  /** Lugares de lo que se dibuja desplazado (se reusa, como `visibles`). */
  private readonly desplazados: number[] = [];
  private readonly cables = new Cables();
  private readonly uniones = new PuntosUnion();
  /**
   * Dibujar los puntos de unión. Solo para comparar en el humo (T14b):
   * apagado, la escena sale como sin uniones. Quien lo cambia rehace la capa
   * estática.
   */
  mostrarUniones = true;

  constructor(componentes: Iterable<[string, ComponenteEscena]> = [], opciones: OpcionesEscena = {}) {
    this.marcarBornes = opciones.marcarBornes ?? true;
    for (const [id, c] of componentes) this.agregar(id, c);
  }

  get cantidad(): number {
    return this.lugarDe.size;
  }

  get caja(): Caja | null {
    if (this.cajaTotal === undefined) {
      let total: Caja | null = null;
      for (const k of this.cajas) if (k) total = total ? unirCajas(total, k) : k;
      for (const lista of this.cables.cajas) if (lista) for (const k of lista) total = total ? unirCajas(total, k) : k;
      this.cajaTotal = total;
    }
    return this.cajaTotal;
  }

  /** El componente con ese id, o undefined. */
  obtener(id: string): ComponenteEscena | undefined {
    const n = this.lugarDe.get(id);
    return n === undefined ? undefined : this.lugares[n]!;
  }

  /** Cantidad de cables. */
  get cantidadCables(): number {
    return this.cables.cantidad;
  }

  /** El cable con ese id, o undefined. */
  obtenerCable(id: string): CableEscena | undefined {
    const n = this.cables.lugarDe.get(id);
    return n === undefined ? undefined : this.cables.lugares[n]!;
  }

  /** True si hay un componente o un cable con ese id. */
  existe(id: string): boolean {
    return this.lugarDe.has(id) || this.cables.lugarDe.has(id);
  }

  /** True si el id es de un cable de la escena. */
  esCable(id: string): boolean {
    return this.cables.lugarDe.has(id);
  }

  /**
   * Agrega o cambia un cable. Devuelve las cajas a rehacer: las de cada tramo
   * viejo y nuevo, por separado.
   */
  ponerCable(id: string, c: CableEscena): readonly Caja[] {
    const cajas = this.cables.poner(id, c);
    this.cajaTotal = undefined;
    return cajas;
  }

  /**
   * Saca el cable de la capa estática (sigue en el índice: se elige y se
   * consulta). Devuelve las cajas a rehacer; vacío si no está o ya estaba oculto.
   */
  ocultarCable(id: string): readonly Caja[] {
    const n = this.cables.lugarDe.get(id);
    if (n === undefined || this.cables.ocultos.has(n)) return [];
    this.cables.ocultos.add(n);
    return this.cables.cajas[n]!;
  }

  /** Lo vuelve a la capa estática, como esté ahora. Devuelve las cajas a rehacer; vacío si no estaba oculto. */
  mostrarCable(id: string): readonly Caja[] {
    const n = this.cables.lugarDe.get(id);
    if (n === undefined || !this.cables.ocultos.delete(n)) return [];
    return this.cables.cajas[n]!;
  }

  /** True si la capa estática no dibuja ese cable. */
  cableOculto(id: string): boolean {
    const n = this.cables.lugarDe.get(id);
    return n !== undefined && this.cables.ocultos.has(n);
  }

  /** Quita un cable. Devuelve las cajas de los tramos que ocupaba (vacío si no estaba). */
  quitarCable(id: string): readonly Caja[] {
    const cajas = this.cables.quitar(id);
    if (cajas.length > 0) this.cajaTotal = undefined;
    return cajas;
  }

  /** Cantidad de uniones. */
  get cantidadUniones(): number {
    return this.uniones.cantidad;
  }

  /**
   * Agrega o cambia la unión de su punto (T14b). Devuelve las cajas a rehacer.
   * Las uniones no cuentan para la caja total: caen sobre los cables.
   */
  ponerUnion(u: UnionEscena): readonly Caja[] {
    return this.uniones.poner(u);
  }

  /** Quita la unión de (x, y). Devuelve su caja (vacío si no estaba). */
  quitarUnion(x: number, y: number): readonly Caja[] {
    return this.uniones.quitar(x, y);
  }

  /** Uniones cuya caja toca `caja`. */
  unionesEn(caja: Caja): UnionEscena[] {
    return this.uniones.en(caja);
  }

  /**
   * Cajas de las uniones donde está alguno de `ids` (cables o componentes):
   * al ocultarlos para un arrastre o volverlos, sus uniones también cambian
   * (se ocultan las que tocan algo oculto, D6-A).
   */
  cajasUnionesDe(ids: Iterable<string>): readonly Caja[] {
    return this.uniones.cajasDe(ids);
  }

  /** True si la unión toca un cable o un componente que la capa estática no dibuja. */
  private unionOculta = (u: UnionEscena): boolean => {
    for (const id of u.cables) if (this.cableOculto(id)) return true;
    for (const id of u.componentes) if (this.oculto(id)) return true;
    return false;
  };

  /**
   * Agrega un componente. Devuelve su caja de dibujo. Si el id ya estaba, lo
   * cambia (como `actualizar`) y devuelve la caja nueva.
   */
  agregar(id: string, c: ComponenteEscena): Caja {
    if (this.lugarDe.has(id)) {
      this.actualizar(id, c);
      return this.cajas[this.lugarDe.get(id)!]!;
    }
    const n = this.libres.pop() ?? this.lugares.length;
    const k = cajaDibujo(c.def, c, c.etiqueta);
    this.lugares[n] = c;
    this.cajas[n] = k;
    this.formas[n] = formaComponente(c);
    this.ids[n] = id;
    this.lugarDe.set(id, n);
    this.indice.insertar(n, k);
    if (this.cajaTotal !== undefined) this.cajaTotal = this.cajaTotal ? unirCajas(this.cajaTotal, k) : k;
    return k;
  }

  /**
   * Quita un componente. Devuelve la caja que ocupaba, o null si no estaba o
   * estaba oculto (la capa estática no lo mostraba).
   */
  quitar(id: string): Caja | null {
    const n = this.lugarDe.get(id);
    if (n === undefined) return null;
    const k = this.ocultos.delete(n) ? null : this.cajas[n]!;
    this.indice.quitar(n);
    this.lugares[n] = null;
    this.cajas[n] = null;
    this.formas[n] = null;
    this.ids[n] = null;
    this.lugarDe.delete(id);
    this.libres.push(n);
    this.cajaTotal = undefined;
    return k;
  }

  /**
   * Cambia un componente (posición, rotación, etiqueta…). Si no estaba, lo
   * agrega. Devuelve las cajas a rehacer por separado: la vieja y la nueva, o
   * una sola si contiene a la otra. Si está oculto, ninguna.
   */
  actualizar(id: string, c: ComponenteEscena): readonly Caja[] {
    const n = this.lugarDe.get(id);
    if (n === undefined) return [this.agregar(id, c)];
    const vieja = this.cajas[n]!;
    const nueva = cajaDibujo(c.def, c, c.etiqueta);
    this.lugares[n] = c;
    this.cajas[n] = nueva;
    this.formas[n] = formaComponente(c);
    this.indice.mover(n, nueva);
    this.cajaTotal = undefined;
    if (this.ocultos.has(n)) return [];
    if (cubreCasi(vieja, nueva)) return [vieja];
    if (cubreCasi(nueva, vieja)) return [nueva];
    return [vieja, nueva];
  }

  /**
   * Saca el componente de la capa estática; sigue en el índice. Devuelve la
   * caja a rehacer, o null si no está o ya estaba oculto.
   */
  ocultar(id: string): Caja | null {
    const n = this.lugarDe.get(id);
    if (n === undefined || this.ocultos.has(n)) return null;
    this.ocultos.add(n);
    return this.cajas[n]!;
  }

  /** Lo vuelve a la capa estática. Devuelve la caja a rehacer, o null si no estaba oculto. */
  mostrar(id: string): Caja | null {
    const n = this.lugarDe.get(id);
    if (n === undefined || !this.ocultos.delete(n)) return null;
    return this.cajas[n]!;
  }

  /** True si la capa estática no lo dibuja. */
  oculto(id: string): boolean {
    const n = this.lugarDe.get(id);
    return n !== undefined && this.ocultos.has(n);
  }

  /** Forma para elegir del elemento con ese id, o undefined. */
  forma(id: string): FormaEleccion | undefined {
    const n = this.lugarDe.get(id);
    if (n !== undefined) return this.formas[n]!;
    const w = this.cables.lugarDe.get(id);
    return w === undefined ? undefined : this.cables.formas[w]!;
  }

  /**
   * Componentes cuya caja de dibujo toca `caja` (candidatos: la caja de
   * dibujo contiene el cuerpo y los bornes), en orden de dibujo.
   */
  componentesEn(caja: Caja): [string, ComponenteEscena][] {
    return this.indice.enCaja(caja).map((n) => [this.ids[n]!, this.lugares[n]!]);
  }

  /** Cables cuya caja toca `caja` (candidatos, sin mirar cada tramo), en orden de dibujo. */
  cablesEn(caja: Caja): [string, CableEscena][] {
    const c = this.cables;
    return c.indice.enCaja(caja).map((n) => [c.ids[n]!, c.lugares[n]!]);
  }

  /** Ids de los elementos cuya caja de dibujo toca `caja` (candidatos, sin el filtro fino). */
  idsCandidatos(caja: Caja): string[] {
    return this.indice.enCaja(caja).map((n) => this.ids[n]!);
  }

  /**
   * El elemento que se elige con un clic en (x, y): el que tiene una zona a
   * menos de `tolerancia` del punto. Si hay varios encimados, el de arriba
   * (el que se dibuja último). Null si no hay ninguno.
   */
  idEnPunto(x: number, y: number, tolerancia = 0): string | null {
    // Primero los cables, con la tolerancia acotada (TOPE_TOLERANCIA_CABLE).
    const cable = this.cables.enPunto(x, y, tolerancia);
    if (cable !== null) return cable;
    // La caja de dibujo contiene a las zonas: con la tolerancia, no se pierde ninguno.
    const candidatos = this.indice.enCaja({ x: x - tolerancia, y: y - tolerancia, ancho: 2 * tolerancia, alto: 2 * tolerancia });
    // Vienen de menor a mayor lugar, que es el orden de dibujo: se recorre al revés.
    for (let i = candidatos.length - 1; i >= 0; i--) {
      const n = candidatos[i]!;
      for (const z of this.formas[n]!.zonas) if (puntoEn(z, x, y, tolerancia)) return this.ids[n]!;
    }
    return null;
  }

  /**
   * Ids de los elementos que elige un rectángulo de selección, en orden de
   * dibujo: con "contiene", los que tienen el cuerpo entero adentro; con
   * "toca", los que tienen alguna zona que lo toca.
   */
  idsEnCaja(caja: Caja, modo: ModoRectangulo): string[] {
    const salida: string[] = [];
    const cables = this.cables;
    for (const n of cables.indice.enCaja(caja)) {
      const f = cables.formas[n]!;
      const elegido = modo === "contiene" ? contieneCaja(caja, f.cuerpo) : f.zonas.some((z) => seTocan(z, caja));
      if (elegido) salida.push(cables.ids[n]!);
    }
    for (const n of this.indice.enCaja(caja)) {
      const f = this.formas[n]!;
      const elegido = modo === "contiene" ? contieneCaja(caja, f.cuerpo) : f.zonas.some((z) => seTocan(z, caja));
      if (elegido) salida.push(this.ids[n]!);
    }
    return salida;
  }

  /** Caja que rodea todas las zonas del elemento (para resaltarlo), o null si no está. */
  contorno(id: string, margen = 0): Caja | null {
    const f = this.forma(id);
    if (!f) return null;
    return margen ? ampliarCaja(f.contorno, margen) : f.contorno;
  }

  contar(vista: Caja): number {
    // Se llama en cada cuadro, para el contador: sin armar ni ordenar la lista.
    return this.indice.contar(vista);
  }

  dibujar(r: Renderer, info: InfoDibujo): number {
    this.cables.dibujar(r, info);
    const visibles = this.indice.enCaja(info.visible, this.visibles);
    if (this.ocultos.size > 0) {
      // Sin los ocultos, compactando la misma lista (sin pedir memoria).
      let j = 0;
      for (const n of visibles) if (!this.ocultos.has(n)) visibles[j++] = n;
      visibles.length = j;
    }
    dibujarComponentes(r, info, this.lugares, visibles, visibles.length, this.marcarBornes);
    // Después de los componentes (D5-B): en un borne, el punto tapa la marca.
    if (this.mostrarUniones) {
      const hayOcultos = this.ocultos.size > 0 || this.cables.ocultos.size > 0;
      this.uniones.dibujar(r, info, hayOcultos ? this.unionOculta : null);
    }
    return visibles.length;
  }

  /**
   * Dibuja los componentes `ids` corridos (dx, dy), solo los que quedan en
   * `info.visible` después de correrse: es la capa dinámica de un arrastre.
   * Si son más de `limite`, dibuja solo el contorno del cuerpo de cada uno,
   * todos en un solo relleno: cientos de símbolos en cada cuadro darían
   * tirones. Devuelve cuántos dibujó.
   */
  dibujarDesplazados(
    r: Renderer,
    info: InfoDibujo,
    ids: ReadonlySet<string>,
    dx: number,
    dy: number,
    limite: number,
  ): number {
    const v = info.visible;
    const lista = this.indice.enCaja({ x: v.x - dx, y: v.y - dy, ancho: v.ancho, alto: v.alto }, this.desplazados);
    let n = 0;
    for (const lugar of lista) if (ids.has(this.ids[lugar]!)) lista[n++] = lugar;
    lista.length = n;
    if (n === 0) return 0;
    r.guardar();
    r.trasladar(dx, dy);
    if (n <= limite) {
      dibujarComponentes(r, info, this.lugares, lista, n, this.marcarBornes);
    } else {
      for (let i = 0; i < n; i++) {
        const k = this.formas[lista[i]!]!.cuerpo;
        cuerpos[i * 4] = k.x;
        cuerpos[i * 4 + 1] = k.y;
        cuerpos[i * 4 + 2] = k.ancho;
        cuerpos[i * 4 + 3] = k.alto;
      }
      const color = info.colores.simbolo;
      r.estilo({ trazo: color, relleno: color, grosor: grosorLinea(info.escala) });
      r.rectangulos(cuerpos, n);
    }
    r.restaurar();
    return n;
  }
}
