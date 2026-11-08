// Comandos: la única forma de cambiar el documento. Cada uno sabe aplicarse y
// deshacerse, y devuelve un Cambio con los ids que tocó, para que la vista
// sepa qué invalidar. El Historial los apila para deshacer y rehacer.
//
// Reglas:
// - Los ids se fijan al construir el comando (`colocar` llama a `generarId`),
//   nunca al aplicarlo: rehacer vuelve a usar el mismo id, y un comando
//   posterior que lo nombre sigue valiendo después de deshacer y rehacer.
// - `aplicar` valida todo antes de tocar el documento: si tira un error, el
//   documento queda igual.
// - Deshacer vuelve al estado guardado al aplicar, no aplica la operación
//   inversa: así es exacto aunque la operación ajuste coordenadas.
// - Las coordenadas quedan siempre enteras.

import type { Rotacion } from "../symbols/tipos";
import { buscarComponente, generarId, type Componente, type Documento } from "./documento";

/** Lo que cambió un comando. T12 suma `cables`. */
export interface Cambio {
  /** Ids de los componentes agregados, quitados o modificados. */
  componentes: string[];
}

export interface Comando {
  aplicar(doc: Documento): Cambio;
  deshacer(doc: Documento): Cambio;
}

/** Une varios cambios en uno, sin ids repetidos. */
export function unirCambios(cambios: readonly Cambio[]): Cambio {
  const ids = new Set<string>();
  for (const c of cambios) for (const id of c.componentes) ids.add(id);
  return { componentes: [...ids] };
}

/** Copia de un componente que no comparte nada con el original. */
export function copiarComponente(c: Componente): Componente {
  return { ...c, params: { ...c.params } };
}

// ── Ayudas ─────────────────────────────────────────────────────────────────

interface Ubicacion {
  comp: Componente;
  hoja: number;
  indice: number;
}

/** Todos los componentes del documento por id, en una sola pasada. */
function indexar(doc: Documento): Map<string, Ubicacion> {
  const mapa = new Map<string, Ubicacion>();
  doc.hojas.forEach((hoja, h) => {
    hoja.componentes.forEach((comp, indice) => mapa.set(comp.id, { comp, hoja: h, indice }));
  });
  return mapa;
}

/** Ubica cada id (armando el índice una vez); tira un error si falta alguno. */
function ubicar(doc: Documento, ids: readonly string[]): Ubicacion[] {
  const mapa = indexar(doc);
  return ids.map((id) => {
    const u = mapa.get(id);
    if (!u) throw new Error(`No existe el componente "${id}".`);
    return u;
  });
}

/** Lista de ids sin repetidos; tira un error si queda vacía. */
function idsUnicos(ids: Iterable<string>, comando: string): string[] {
  const lista = [...new Set(ids)];
  if (lista.length === 0) throw new Error(`${comando}: no hay componentes.`);
  return lista;
}

function exigirEntero(valor: number, nombre: string): void {
  if (!Number.isInteger(valor)) throw new RangeError(`${nombre} tiene que ser entero (es ${valor}).`);
}

// ── Colocar ────────────────────────────────────────────────────────────────

/** Agrega un componente ya armado, con su id. Para uno nuevo, usar `colocar`. */
export class Colocar implements Comando {
  private readonly componente: Componente;

  constructor(
    componente: Componente,
    private readonly hoja = 0,
  ) {
    exigirEntero(componente.x, "x");
    exigirEntero(componente.y, "y");
    this.componente = copiarComponente(componente);
  }

  get id(): string {
    return this.componente.id;
  }

  aplicar(doc: Documento): Cambio {
    const hoja = doc.hojas[this.hoja];
    if (!hoja) throw new Error(`No existe la hoja ${this.hoja}.`);
    if (buscarComponente(doc, this.id)) throw new Error(`Ya existe el componente "${this.id}".`);
    // Una copia nueva cada vez: rehacer arranca del componente original.
    hoja.componentes.push(copiarComponente(this.componente));
    return { componentes: [this.id] };
  }

  deshacer(doc: Documento): Cambio {
    const lista = doc.hojas[this.hoja]?.componentes;
    const i = lista ? lista.findIndex((c) => c.id === this.id) : -1;
    if (!lista || i < 0) throw new Error(`No existe el componente "${this.id}".`);
    lista.splice(i, 1);
    return { componentes: [this.id] };
  }
}

/**
 * Arma el comando para colocar un componente nuevo. El id se da acá, al
 * construir (y sube el contador del documento, que deshacer no baja).
 */
export function colocar(doc: Documento, datos: Omit<Componente, "id">, hoja = 0): Colocar {
  // Se valida antes de gastar un id.
  exigirEntero(datos.x, "x");
  exigirEntero(datos.y, "y");
  return new Colocar({ ...datos, id: generarId(doc) }, hoja);
}

// ── Mover ──────────────────────────────────────────────────────────────────

/** Traslada varios componentes en unidades enteras de grilla. */
export class Mover implements Comando {
  private readonly ids: string[];

  constructor(
    ids: Iterable<string>,
    private readonly dx: number,
    private readonly dy: number,
  ) {
    exigirEntero(dx, "dx");
    exigirEntero(dy, "dy");
    this.ids = idsUnicos(ids, "Mover");
  }

  aplicar(doc: Documento): Cambio {
    return this.trasladar(doc, this.dx, this.dy);
  }

  deshacer(doc: Documento): Cambio {
    return this.trasladar(doc, -this.dx, -this.dy);
  }

  private trasladar(doc: Documento, dx: number, dy: number): Cambio {
    for (const { comp } of ubicar(doc, this.ids)) {
      comp.x += dx;
      comp.y += dy;
    }
    return { componentes: [...this.ids] };
  }
}

// ── Rotar y espejar ────────────────────────────────────────────────────────

/** Lo que cambian rotar y espejar en cada componente. */
interface Pose {
  x: number;
  y: number;
  rot: Rotacion;
  espejado: boolean;
}

function pose(c: Componente): Pose {
  return { x: c.x, y: c.y, rot: c.rot, espejado: c.espejado };
}

/** Caja de las posiciones (centros) de los componentes. */
function cajaPosiciones(comps: readonly Componente[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of comps) {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x);
    y1 = Math.max(y1, c.y);
  }
  return { x0, y0, x1, y1 };
}

/** Base de Rotar y Espejar: calcula las poses nuevas y guarda las viejas para deshacer. */
abstract class Transformar implements Comando {
  protected readonly ids: string[];
  private antes: Pose[] | null = null;

  constructor(ids: Iterable<string>, nombre: string) {
    this.ids = idsUnicos(ids, nombre);
  }

  /** Poses nuevas de los componentes, en el mismo orden. No modifica nada. */
  protected abstract calcular(comps: readonly Componente[]): Pose[];

  aplicar(doc: Documento): Cambio {
    const comps = ubicar(doc, this.ids).map((u) => u.comp);
    const nuevas = this.calcular(comps);
    this.antes = comps.map(pose);
    comps.forEach((c, i) => Object.assign(c, nuevas[i]!));
    return { componentes: [...this.ids] };
  }

  deshacer(doc: Documento): Cambio {
    const antes = this.antes;
    if (!antes) throw new Error("No se puede deshacer un comando que no se aplicó.");
    ubicar(doc, this.ids).forEach((u, i) => Object.assign(u.comp, antes[i]!));
    return { componentes: [...this.ids] };
  }
}

/**
 * Rota los componentes ±90° (horario con 90, como `transformarPunto`) sobre el
 * centro exacto de la caja de sus posiciones. Uno solo rota en su lugar.
 *
 * Si el ancho y el alto de la caja tienen paridad distinta, el centro cae en
 * media unidad en un solo eje y el resultado quedaría en medias unidades: se
 * corre el grupo (+½, −½) si el ancho es impar y (−½, +½) si es par, en los dos
 * sentidos. Cada rotación cambia la paridad del ancho, así que las correcciones
 * se alternan y se anulan de a pares: girar y volver (4 × +90, +90 y −90) deja
 * el grupo exactamente igual. Depende solo de la paridad, no del signo de las
 * coordenadas. Redondear el centro (Math.round) corría el grupo hasta 4
 * unidades cada 4 giros. Ver "Decisión - Rotar y espejar en grupo".
 */
export class Rotar extends Transformar {
  constructor(
    ids: Iterable<string>,
    private readonly sentido: 90 | -90,
  ) {
    super(ids, "Rotar");
  }

  protected calcular(comps: readonly Componente[]): Pose[] {
    const { x0, y0, x1, y1 } = cajaPosiciones(comps);
    // Múltiplos de ½: las cuentas son exactas en punto flotante.
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const anchoImpar = (x1 - x0) % 2 === 1;
    const altoImpar = (y1 - y0) % 2 === 1;
    const corrimiento = anchoImpar === altoImpar ? 0 : anchoImpar ? 0.5 : -0.5;
    const horario = this.sentido === 90;
    return comps.map((c) => {
      const dx = c.x - cx;
      const dy = c.y - cy;
      return {
        // `+ 0` convierte -0 en 0.
        x: (horario ? cx - dy : cx + dy) + corrimiento + 0,
        y: (horario ? cy + dx : cy - dx) - corrimiento + 0,
        // El espejado va antes de la rotación: rotar el grupo solo suma a `rot`.
        rot: ((c.rot + (horario ? 90 : 270)) % 360) as Rotacion,
        espejado: c.espejado,
      };
    });
  }
}

/**
 * Espejo horizontal en pantalla, sobre el eje vertical del centro de la caja
 * de las posiciones. Un símbolo rotado también se da vuelta izquierda↔derecha
 * en pantalla, por eso cambia su `rot` además de `espejado`.
 */
export class Espejar extends Transformar {
  constructor(ids: Iterable<string>) {
    super(ids, "Espejar");
  }

  protected calcular(comps: readonly Componente[]): Pose[] {
    const { x0, x1 } = cajaPosiciones(comps);
    return comps.map((c) => ({
      // x0 + x1 es entero aunque el centro caiga en media unidad.
      x: x0 + x1 - c.x + 0,
      y: c.y,
      // Espejo en pantalla ∘ rotación θ ∘ espejo propio = rotación −θ ∘ (sin espejo propio).
      rot: ((360 - c.rot) % 360) as Rotacion,
      espejado: !c.espejado,
    }));
  }
}

// ── Borrar ─────────────────────────────────────────────────────────────────

interface Borrado {
  hoja: number;
  indice: number;
  comp: Componente;
}

/** Quita componentes. Deshacer los devuelve a su hoja y a su lugar en la lista. */
export class Borrar implements Comando {
  private readonly ids: string[];
  /** Ordenados por hoja e índice, de menor a mayor. */
  private borrados: Borrado[] | null = null;

  constructor(ids: Iterable<string>) {
    this.ids = idsUnicos(ids, "Borrar");
  }

  aplicar(doc: Documento): Cambio {
    const borrados = ubicar(doc, this.ids)
      .map((u) => ({ hoja: u.hoja, indice: u.indice, comp: copiarComponente(u.comp) }))
      .sort((a, b) => a.hoja - b.hoja || a.indice - b.indice);
    // De atrás para adelante, así los índices que faltan no se corren.
    for (let i = borrados.length - 1; i >= 0; i--) {
      const b = borrados[i]!;
      doc.hojas[b.hoja]!.componentes.splice(b.indice, 1);
    }
    this.borrados = borrados;
    return { componentes: [...this.ids] };
  }

  deshacer(doc: Documento): Cambio {
    const borrados = this.borrados;
    if (!borrados) throw new Error("No se puede deshacer un comando que no se aplicó.");
    const mapa = indexar(doc);
    for (const b of borrados) {
      if (!doc.hojas[b.hoja]) throw new Error(`No existe la hoja ${b.hoja}.`);
      if (mapa.has(b.comp.id)) throw new Error(`Ya existe el componente "${b.comp.id}".`);
    }
    // De adelante para atrás: cada uno vuelve a su índice original.
    for (const b of borrados) doc.hojas[b.hoja]!.componentes.splice(b.indice, 0, copiarComponente(b.comp));
    return { componentes: [...this.ids] };
  }
}

// ── Etiqueta ───────────────────────────────────────────────────────────────

export class CambiarEtiqueta implements Comando {
  private anterior: string | null = null;

  constructor(
    private readonly id: string,
    private readonly etiqueta: string,
  ) {}

  aplicar(doc: Documento): Cambio {
    const c = this.buscar(doc);
    this.anterior = c.etiqueta;
    c.etiqueta = this.etiqueta;
    return { componentes: [this.id] };
  }

  deshacer(doc: Documento): Cambio {
    if (this.anterior === null) throw new Error("No se puede deshacer un comando que no se aplicó.");
    this.buscar(doc).etiqueta = this.anterior;
    return { componentes: [this.id] };
  }

  private buscar(doc: Documento): Componente {
    const c = buscarComponente(doc, this.id);
    if (!c) throw new Error(`No existe el componente "${this.id}".`);
    return c;
  }
}

// ── Grupo ──────────────────────────────────────────────────────────────────

/** Varios comandos como uno solo: un único paso de deshacer. */
export class Grupo implements Comando {
  private readonly comandos: readonly Comando[];

  constructor(comandos: readonly Comando[]) {
    this.comandos = [...comandos];
  }

  get vacio(): boolean {
    return this.comandos.length === 0;
  }

  aplicar(doc: Documento): Cambio {
    const cambios: Cambio[] = [];
    let i = 0;
    try {
      for (; i < this.comandos.length; i++) cambios.push(this.comandos[i]!.aplicar(doc));
    } catch (error) {
      // Si uno falla, se deshacen los ya aplicados: el documento queda igual.
      for (let j = i - 1; j >= 0; j--) this.comandos[j]!.deshacer(doc);
      throw error;
    }
    return unirCambios(cambios);
  }

  deshacer(doc: Documento): Cambio {
    const cambios: Cambio[] = [];
    for (let i = this.comandos.length - 1; i >= 0; i--) cambios.push(this.comandos[i]!.deshacer(doc));
    return unirCambios(cambios);
  }
}
