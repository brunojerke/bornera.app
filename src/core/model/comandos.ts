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

import { copiarCable, indexarHoja, puntoExtremo, validarCable, type IndiceHoja } from "./cables";
import {
  buscarComponente,
  generarId,
  PREFIJO_CABLE,
  type Cable,
  type Componente,
  type Documento,
  type Extremo,
  type Hoja,
} from "./documento";
import { entornoLineal, planearTransformacion, type EntornoPlan, type Operacion, type Plan } from "./seguir";

/** Lo que cambió un comando. */
export interface Cambio {
  /** Ids de los componentes agregados, quitados o modificados. */
  componentes: string[];
  /** Ids de los cables agregados, quitados o modificados (también los soltados). */
  cables: string[];
}

/** Cambio que toca solo esos componentes. */
function soloComponentes(ids: readonly string[]): Cambio {
  return { componentes: [...ids], cables: [] };
}

export interface Comando {
  aplicar(doc: Documento): Cambio;
  deshacer(doc: Documento): Cambio;
}

/** Une varios cambios en uno, sin ids repetidos. */
export function unirCambios(cambios: readonly Cambio[]): Cambio {
  const comps = new Set<string>();
  const cables = new Set<string>();
  for (const c of cambios) {
    for (const id of c.componentes) comps.add(id);
    for (const id of c.cables) cables.add(id);
  }
  return { componentes: [...comps], cables: [...cables] };
}

/** Copia de un componente que no comparte nada con el original. */
export function copiarComponente(c: Componente): Componente {
  return { ...c, params: { ...c.params } };
}

// ── Ayudas ─────────────────────────────────────────────────────────────────

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
    return soloComponentes([this.id]);
  }

  deshacer(doc: Documento): Cambio {
    const lista = doc.hojas[this.hoja]?.componentes;
    const i = lista ? lista.findIndex((c) => c.id === this.id) : -1;
    if (!lista || i < 0) throw new Error(`No existe el componente "${this.id}".`);
    lista.splice(i, 1);
    return soloComponentes([this.id]);
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

// ── Mover, rotar y espejar ─────────────────────────────────────────────────

/** Lo que el editor le puede dar a Mover, Rotar y Espejar. */
export interface OpcionesTransformar {
  /**
   * Índice y consulta de la hoja (los del editor, con el índice espacial).
   * Sin esto se arman lineales sobre la hoja, que alcanza para los tests.
   */
  entorno?: (hoja: Hoja) => EntornoPlan;
  /**
   * Plan ya calculado con los mismos ids y la misma operación (la vista
   * previa del arrastre). Se usa si lo que toca sigue igual en el documento.
   */
  plan?: Plan;
}

/** La hoja donde están todos los ids; tira si falta alguno o están en hojas distintas. */
function hojaDe(doc: Documento, ids: readonly string[]): number {
  let hoja = -1;
  for (const id of ids) {
    const h = doc.hojas.findIndex((k) => k.componentes.some((c) => c.id === id) || k.cables.some((w) => w.id === id));
    if (h < 0) throw new Error(`No existe "${id}".`);
    if (hoja >= 0 && h !== hoja) throw new Error("Los elementos están en hojas distintas.");
    hoja = h;
  }
  return hoja;
}

/** True si lo que el plan toca está en la hoja igual que cuando se calculó. */
function planVigente(hoja: Hoja, plan: Plan): boolean {
  const indice = indexarHoja(hoja);
  for (const c of plan.antes.componentes) {
    const actual = indice.componentes.get(c.id);
    if (!actual || JSON.stringify(actual) !== JSON.stringify(c)) return false;
  }
  for (const w of plan.antes.cables) {
    const actual = indice.cables.get(w.id);
    if (!actual || JSON.stringify(actual) !== JSON.stringify(w)) return false;
  }
  return true;
}

/**
 * Base de Mover, Rotar y Espejar: una transformación de grupo sobre
 * componentes y cables (mezclados), con todo lo que les pasa a los cables
 * (`planearTransformacion`, T14a). Si el plan se rechaza (una conexión
 * aparente nueva, un ciclo de apoyos, nada que mover), tira con el aviso y no
 * cambia nada. Deshacer vuelve a las copias de antes; rehacer vuelve a
 * aplicar el mismo plan si el documento sigue como entonces.
 */
abstract class Transformar implements Comando {
  protected readonly ids: string[];
  private hecho: { hoja: number; plan: Plan } | null = null;

  constructor(
    ids: Iterable<string>,
    nombre: string,
    private readonly opciones: OpcionesTransformar = {},
  ) {
    this.ids = idsUnicos(ids, nombre);
  }

  /** La operación de grupo que hace el comando. */
  protected abstract get operacion(): Operacion;

  aplicar(doc: Documento): Cambio {
    const h = hojaDe(doc, this.ids);
    const hoja = doc.hojas[h]!;
    let plan: Plan | null = null;
    if (this.hecho?.hoja === h && planVigente(hoja, this.hecho.plan)) plan = this.hecho.plan;
    else if (this.opciones.plan && planVigente(hoja, this.opciones.plan)) plan = this.opciones.plan;
    if (!plan) {
      const entorno = this.opciones.entorno?.(hoja) ?? entornoLineal(hoja);
      const r = planearTransformacion(hoja, this.ids, this.operacion, entorno);
      if (r.rechazo) throw new Error(r.rechazo.motivo);
      plan = r.plan;
    }
    const indice = indexarHoja(hoja);
    for (const { id, pose } of plan.componentes) Object.assign(indice.componentes.get(id)!, pose);
    for (const c of plan.cables) {
      const w = indice.cables.get(c.id)!;
      w.desde = { ...c.desde };
      w.hasta = { ...c.hasta };
      w.codos = c.codos.map(([x, y]) => [x, y]);
    }
    this.hecho = { hoja: h, plan };
    return cambioDe(plan);
  }

  deshacer(doc: Documento): Cambio {
    const hecho = this.hecho;
    if (!hecho) throw new Error("No se puede deshacer un comando que no se aplicó.");
    const hoja = doc.hojas[hecho.hoja];
    if (!hoja) throw new Error(`No existe la hoja ${hecho.hoja}.`);
    const indice = indexarHoja(hoja);
    const { antes } = hecho.plan;
    // Todo se comprueba antes de tocar nada.
    for (const c of antes.componentes) if (!indice.componentes.has(c.id)) throw new Error(`No existe el componente "${c.id}".`);
    for (const w of antes.cables) if (!indice.cables.has(w.id)) throw new Error(`No existe el cable "${w.id}".`);
    for (const c of antes.componentes) {
      const actual = indice.componentes.get(c.id)!;
      actual.x = c.x;
      actual.y = c.y;
      actual.rot = c.rot;
      actual.espejado = c.espejado;
    }
    for (const w of antes.cables) {
      const actual = indice.cables.get(w.id)!;
      actual.desde = { ...w.desde };
      actual.hasta = { ...w.hasta };
      actual.codos = w.codos.map(([x, y]) => [x, y]);
    }
    return cambioDe(hecho.plan);
  }
}

function cambioDe(plan: Plan): Cambio {
  return { componentes: plan.componentes.map((c) => c.id), cables: plan.cables.map((c) => c.id) };
}

/**
 * Traslada componentes y cables en unidades enteras de grilla. Los cables
 * conectados siguen a sus bornes (T14a).
 */
export class Mover extends Transformar {
  constructor(
    ids: Iterable<string>,
    private readonly dx: number,
    private readonly dy: number,
    opciones?: OpcionesTransformar,
  ) {
    exigirEntero(dx, "dx");
    exigirEntero(dy, "dy");
    super(ids, "Mover", opciones);
  }

  protected get operacion(): Operacion {
    return { tipo: "mover", dx: this.dx, dy: this.dy };
  }
}

/**
 * Rota ±90° (horario con 90, como `transformarPunto`) sobre el centro exacto
 * de la caja de lo seleccionado: las posiciones de los componentes y los
 * puntos de los cables seleccionados. Uno solo rota en su lugar. Ver
 * `transformacionGrupo` para la corrección de media unidad.
 */
export class Rotar extends Transformar {
  constructor(
    ids: Iterable<string>,
    private readonly sentido: 90 | -90,
    opciones?: OpcionesTransformar,
  ) {
    super(ids, "Rotar", opciones);
  }

  protected get operacion(): Operacion {
    return { tipo: "rotar", sentido: this.sentido };
  }
}

/**
 * Espejo horizontal en pantalla, sobre el eje vertical del centro de la caja
 * de lo seleccionado. Un símbolo rotado también se da vuelta izquierda↔derecha
 * en pantalla, por eso cambia su `rot` además de `espejado`.
 */
export class Espejar extends Transformar {
  constructor(ids: Iterable<string>, opciones?: OpcionesTransformar) {
    super(ids, "Espejar", opciones);
  }

  protected get operacion(): Operacion {
    return { tipo: "espejar" };
  }
}

// ── Cablear ────────────────────────────────────────────────────────────────

/** Agrega un cable ya armado, con su id. Para uno nuevo, usar `cablear`. */
export class Cablear implements Comando {
  private readonly cable: Cable;

  constructor(
    cable: Cable,
    private readonly hoja = 0,
  ) {
    this.cable = copiarCable(cable);
  }

  get id(): string {
    return this.cable.id;
  }

  aplicar(doc: Documento): Cambio {
    const hoja = doc.hojas[this.hoja];
    if (!hoja) throw new Error(`No existe la hoja ${this.hoja}.`);
    const indice = indexarHoja(hoja);
    if (indice.cables.has(this.id) || indice.componentes.has(this.id)) throw new Error(`Ya existe el id "${this.id}".`);
    const problemas = validarCable(indice, this.cable);
    if (problemas.length > 0) throw new Error(`Cable "${this.id}" inválido: ${problemas.map((p) => p.mensaje).join(" ")}`);
    // Una copia nueva cada vez: rehacer arranca del cable original.
    hoja.cables.push(copiarCable(this.cable));
    return { componentes: [], cables: [this.id] };
  }

  deshacer(doc: Documento): Cambio {
    const lista = doc.hojas[this.hoja]?.cables;
    const i = lista ? lista.findIndex((w) => w.id === this.id) : -1;
    if (!lista || i < 0) throw new Error(`No existe el cable "${this.id}".`);
    lista.splice(i, 1);
    return { componentes: [], cables: [this.id] };
  }
}

/** Datos de un cable nuevo: los extremos y los codos, sin id. */
export type DatosCable = Omit<Cable, "id">;

/**
 * Arma el comando para un cable nuevo. El id ("w1"…) se da acá, al
 * construir. Los números se validan antes de gastar el id; el resto
 * (referencias, forma), al aplicar.
 */
export function cablear(doc: Documento, datos: DatosCable, hoja = 0): Cablear {
  for (const e of [datos.desde, datos.hasta]) {
    if (e.tipo !== "borne") {
      exigirEntero(e.x, "x");
      exigirEntero(e.y, "y");
    }
  }
  for (const [x, y] of datos.codos) {
    exigirEntero(x, "x del codo");
    exigirEntero(y, "y del codo");
  }
  return new Cablear({ ...datos, id: generarId(doc, PREFIJO_CABLE) }, hoja);
}

// ── Borrar ─────────────────────────────────────────────────────────────────

interface Borrado<T> {
  hoja: number;
  indice: number;
  dato: T;
}

/** Un cable que quedó con un extremo suelto, y cómo estaban sus extremos antes. */
interface Soltado {
  hoja: number;
  id: string;
  desde: Extremo;
  hasta: Extremo;
}

const porLugar = <T>(a: Borrado<T>, b: Borrado<T>) => a.hoja - b.hoja || a.indice - b.indice;

/**
 * Quita componentes y cables (los ids pueden venir mezclados). Lo que colgaba
 * de lo borrado se suelta, no se borra: un extremo en un borne de un
 * componente borrado, o sobre un cable borrado, pasa a libre en el punto
 * donde estaba. Deshacer devuelve todo a su hoja y a su lugar en la lista, y
 * los extremos soltados a su conexión.
 *
 * Todo sale de un índice armado en una pasada por el documento:
 * O(componentes + cables), sin búsquedas por id.
 */
export class Borrar implements Comando {
  private readonly ids: string[];
  private hecho: {
    /** Ordenados por hoja e índice, de menor a mayor. */
    componentes: Borrado<Componente>[];
    cables: Borrado<Cable>[];
    soltados: Soltado[];
  } | null = null;

  constructor(ids: Iterable<string>) {
    this.ids = idsUnicos(ids, "Borrar");
  }

  aplicar(doc: Documento): Cambio {
    // 1. Ubicar todo sin tocar nada: si falta un id, el documento queda igual.
    const lugares = new Map<string, { hoja: number; indice: number; cable: boolean }>();
    doc.hojas.forEach((hoja, h) => {
      hoja.componentes.forEach((c, indice) => lugares.set(c.id, { hoja: h, indice, cable: false }));
      hoja.cables.forEach((w, indice) => lugares.set(w.id, { hoja: h, indice, cable: true }));
    });
    const componentes: Borrado<Componente>[] = [];
    const cables: Borrado<Cable>[] = [];
    const quitados = new Set<string>();
    for (const id of this.ids) {
      const u = lugares.get(id);
      if (!u) throw new Error(`No existe "${id}".`);
      const hoja = doc.hojas[u.hoja]!;
      if (u.cable) cables.push({ hoja: u.hoja, indice: u.indice, dato: copiarCable(hoja.cables[u.indice]!) });
      else componentes.push({ hoja: u.hoja, indice: u.indice, dato: copiarComponente(hoja.componentes[u.indice]!) });
      quitados.add(id);
    }
    componentes.sort(porLugar);
    cables.sort(porLugar);

    // 2. Lo que se suelta, con el punto que tiene ahora (antes de quitar nada).
    const soltados: Soltado[] = [];
    const nuevos: { cable: Cable; desde: Extremo; hasta: Extremo }[] = [];
    doc.hojas.forEach((hoja, h) => {
      let indice: IndiceHoja | null = null;
      for (const w of hoja.cables) {
        if (quitados.has(w.id)) continue;
        const sueltaDesde = cuelgaDe(w.desde, quitados);
        const sueltaHasta = cuelgaDe(w.hasta, quitados);
        if (!sueltaDesde && !sueltaHasta) continue;
        indice ??= indexarHoja(hoja);
        soltados.push({ hoja: h, id: w.id, desde: { ...w.desde }, hasta: { ...w.hasta } });
        nuevos.push({
          cable: w,
          desde: sueltaDesde ? soltar(indice, w.desde) : w.desde,
          hasta: sueltaHasta ? soltar(indice, w.hasta) : w.hasta,
        });
      }
    });

    // 3. Recién ahora se cambia el documento.
    for (const n of nuevos) {
      n.cable.desde = n.desde;
      n.cable.hasta = n.hasta;
    }
    // De atrás para adelante, así los índices que faltan no se corren.
    for (let i = cables.length - 1; i >= 0; i--) doc.hojas[cables[i]!.hoja]!.cables.splice(cables[i]!.indice, 1);
    for (let i = componentes.length - 1; i >= 0; i--) {
      doc.hojas[componentes[i]!.hoja]!.componentes.splice(componentes[i]!.indice, 1);
    }
    this.hecho = { componentes, cables, soltados };
    return this.cambio();
  }

  deshacer(doc: Documento): Cambio {
    const hecho = this.hecho;
    if (!hecho) throw new Error("No se puede deshacer un comando que no se aplicó.");
    // Todo se comprueba antes de tocar nada.
    const existentes = new Set<string>();
    const cablesPorId = new Map<string, Cable>();
    for (const hoja of doc.hojas) {
      for (const c of hoja.componentes) existentes.add(c.id);
      for (const w of hoja.cables) {
        existentes.add(w.id);
        cablesPorId.set(w.id, w);
      }
    }
    for (const b of [...hecho.componentes, ...hecho.cables]) {
      if (!doc.hojas[b.hoja]) throw new Error(`No existe la hoja ${b.hoja}.`);
      if (existentes.has(b.dato.id)) throw new Error(`Ya existe "${b.dato.id}".`);
    }
    for (const s of hecho.soltados) if (!cablesPorId.has(s.id)) throw new Error(`No existe el cable "${s.id}".`);

    // De adelante para atrás: cada uno vuelve a su índice original.
    for (const b of hecho.componentes) doc.hojas[b.hoja]!.componentes.splice(b.indice, 0, copiarComponente(b.dato));
    for (const b of hecho.cables) doc.hojas[b.hoja]!.cables.splice(b.indice, 0, copiarCable(b.dato));
    for (const s of hecho.soltados) {
      const w = cablesPorId.get(s.id)!;
      w.desde = { ...s.desde };
      w.hasta = { ...s.hasta };
    }
    return this.cambio();
  }

  private cambio(): Cambio {
    const h = this.hecho!;
    return {
      componentes: h.componentes.map((b) => b.dato.id),
      cables: [...h.cables.map((b) => b.dato.id), ...h.soltados.map((s) => s.id)],
    };
  }
}

/** True si el extremo está conectado a algo de `quitados`. */
function cuelgaDe(e: Extremo, quitados: ReadonlySet<string>): boolean {
  if (e.tipo === "borne") return quitados.has(e.comp);
  if (e.tipo === "cable") return quitados.has(e.cable);
  return false;
}

/**
 * El extremo suelto en el punto donde está ahora. Si no se puede resolver (un
 * documento que ya era inválido: un borne que no existe), queda en el centro
 * del componente, para no perder el cable.
 */
function soltar(indice: IndiceHoja, e: Extremo): Extremo {
  const p = puntoExtremo(indice, e);
  if (p) return { tipo: "libre", x: p.x, y: p.y };
  const c = e.tipo === "borne" ? indice.componentes.get(e.comp) : undefined;
  return { tipo: "libre", x: c?.x ?? 0, y: c?.y ?? 0 };
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
    return soloComponentes([this.id]);
  }

  deshacer(doc: Documento): Cambio {
    if (this.anterior === null) throw new Error("No se puede deshacer un comando que no se aplicó.");
    this.buscar(doc).etiqueta = this.anterior;
    return soloComponentes([this.id]);
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
