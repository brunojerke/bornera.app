// Validaciones de la hoja en memoria (T19): los avisos de cada componente y
// cada cable, y la cuenta por severidad. Las reglas son del núcleo
// (src/core/model/validaciones.ts); acá se guardan y se ponen al día.
//
// Se pone al día solo con cada comando (ejecutar, agrupar, deshacer, rehacer:
// el editor llama a `reflejar` con los ids del cambio), nunca al mover el
// mouse, durante un arrastre ni al dibujar un cuadro. Cada parte se recalcula
// solo si el cambio la puede mover:
// - R1 a R5 y R9 (etiquetas), solo si el cambio agrega o borra un
//   componente, o le cambia la etiqueta o el tipo. Mover, girar o espejar no
//   las tocan (ajuste (a) de Bruno en la etapa 2). Se recalculan los
//   componentes del cambio y los grupos de etiqueta normalizada que tocan
//   (etapa 3b, arreglo 3); si eso es más de tres cuartos de la hoja, la hoja.
// - R6, solo si hay un auxiliar NC con la etiqueta de una bobina y cambió lo
//   que une la hoja: algún extremo de cable (a qué borne, cable o nada llega)
//   o las etiquetas. Con un cambio de etiquetas, o al deshacer o rehacer un
//   Grupo, en toda la hoja con `redes()`; si solo cambiaron cables, en las
//   redes que tocan (etapa 3b, arreglo 2).
// - R7 y R8, incremental: los bornes de los componentes agregados, borrados o
//   de otro tipo, los de los cables cuyos extremos cambiaron y esos cables.
//   Sale de `BornesConCable`, que el editor pone al día antes.
// - R10 (T29), por el mismo camino que las etiquetas: con cada Fase (o
//   trifásica, T35) que llega, se va o cambia de etiqueta, se recalculan las
//   Fases «L» (pocas).
// - R11 (T29, I-A), aparte y después de la escena (`reflejarR11`: necesita el
//   índice espacial al día). Se revisan los componentes y cables del cambio y
//   lo que la consulta tiene cerca de ellos, nunca todos contra todos; los
//   pares con algo del cambio se rehacen y los demás quedan. R11-A: un
//   encimado entre cables de la misma red no avisa; la misma red se ve
//   recorriendo solo la red de uno de los dos cables, con los vecinos de R6
//   (sin `redes()`), y se vuelve a mirar con cada cambio mientras haya
//   encimados entre cables. Si lo del cambio que sigue en la hoja es más de
//   tres cuartos de ella, la hoja entera.
//   D6-A (Bruno, 2026-11-21): en vivo hasta `UMBRAL_R11_EN_VIVO` (100)
//   elementos en el cambio; arriba de eso, y al abrir, en reposo: el mismo
//   cálculo, por partes, en tramos de `MS_TRAMO_R11` (4 ms) como máximo entre
//   cuadros. Los avisos aparecen al terminar (`alTerminarR11`). Si llega otro
//   comando en el medio, se suma a lo pendiente y el cálculo vuelve a empezar
//   con todo lo acumulado.
//
// Devuelve qué cambió: los componentes cuyo contorno de aviso aparece o se va
// (la escena los rehace), los ids cuyos avisos cambiaron (panel y anillo) y
// si cambió la cuenta (barra).
//
// No depende de la vista. Un documento nuevo es un editor nuevo, con su
// propio caché.

import { aparentesDeCable, aparentesDeComponente, avisosR11De, cercanos, type Aparente } from "../core/model/aparentes";
import type { IndiceHoja } from "../core/model/cables";
import type { Cable, Componente, Documento, Extremo, Hoja } from "../core/model/documento";
import type { ConsultaTrazado } from "../core/model/trazado";
import { normalizarEtiqueta } from "../core/model/etiquetas";
import { nombreDeFuente } from "../core/model/redes";
import { contarAvisos, esAuxiliarNC, esFaseL, fasesNumeradasDe, otrasFasesR10, validar, type Aviso, type Regla } from "../core/model/validaciones";
import { buscarSimbolo, esBobina, type DefinicionSimbolo } from "../core/symbols";
import type { BornesConCable } from "./bornesConCable";

/** Las reglas de etiqueta: una pasada por los componentes. */
const ETIQUETA: readonly Regla[] = ["R1", "R2", "R3", "R4", "R5", "R9"];
const SOLO_R6: readonly Regla[] = ["R6"];

const NINGUNO: readonly Aviso[] = [];

/** Qué cambió con un comando. */
export interface CambioAvisos {
  /** Componentes cuyo contorno (R1 a R6, R9 y R10) apareció o se fue: la escena los rehace. */
  contornos: ReadonlySet<string>;
  /** Componentes y cables cuyos avisos cambiaron (para el panel y el anillo). */
  ids: ReadonlySet<string>;
  /** Si cambió la cuenta de errores o de avisos. */
  cuenta: boolean;
}

const SIN_CAMBIOS: CambioAvisos = { contornos: new Set(), ids: new Set(), cuenta: false };

/** Hasta cuántos elementos (componentes y cables) del cambio R11 va en vivo; arriba, en reposo (T29, D6-A). */
export const UMBRAL_R11_EN_VIVO = 100;
/** Lo más que dura un tramo de R11 en reposo, en ms: no bloquea el dibujo. */
export const MS_TRAMO_R11 = 4;
/**
 * El tramo corta cuando le queda este margen (ms) para el tope, a los 2 ms:
 * un paso del cálculo dura mucho menos (un elemento, unos pocos pares o 4
 * cercanos), así el último no se pasa de `MS_TRAMO_R11`. Lo que no cubre es
 * una pausa de recolección de basura dentro del paso (T29: hasta ~4 ms en Node).
 */
export const MARGEN_TRAMO_R11 = 2;

/** Cómo va R11 en reposo. Los tests cambian el umbral, quién programa los tramos y su largo. */
export interface OpcionesR11 {
  /** Por defecto, `UMBRAL_R11_EN_VIVO`. */
  umbral?: number;
  /** Programa el próximo tramo; por defecto, `setTimeout(tramo, 0)`: después del dibujo pendiente. */
  programar?: (tramo: () => void) => void;
  /** Por defecto, `MS_TRAMO_R11`. */
  msTramo?: number;
  /** Para los tests: pasos por tramo en vez de ms (el corte queda fijo). */
  pasosTramo?: number;
  /**
   * El reloj del corte de tramo, en ms; por defecto, `performance.now`. Los
   * tests ponen uno falso que avanza un tiempo fijo por paso: así el corte a
   * los 2 ms se prueba sin depender de la recolección de basura (Bruno,
   * 2026-11-21, cambio de regla de T29).
   */
  reloj?: () => number;
}

// Lo guardado del último cálculo se compara campo por campo, sin armar un
// texto por componente o por cable (etapa 3b, arreglo 1): mover, girar o
// espejar 2000 no crea nada. El registro se reescribe en el lugar.

/**
 * Lo que cuenta de un componente para las reglas de etiqueta: tipo y
 * etiqueta. Con lo que sale de ellos (el símbolo y la etiqueta normalizada),
 * que se calcula solo cuando cambian.
 */
interface DatosComp {
  tipo: string;
  etiqueta: string;
  def: DefinicionSimbolo | undefined;
  /** Etiqueta normalizada. */
  e: string;
}

function datosComp(c: Componente): DatosComp {
  return { tipo: c.tipo, etiqueta: c.etiqueta, def: buscarSimbolo(c.tipo), e: normalizarEtiqueta(c.etiqueta) };
}

/**
 * Los componentes con una misma etiqueta normalizada, no vacía (etapa 3b,
 * arreglo 3). R2, R4 y R5 de un componente dependen solo de su grupo: al
 * tocarlo, se recalcula el grupo. Las cuentas de bobinas y auxiliares NC dicen
 * si hay candidatos de R6 sin recorrer la hoja.
 */
interface GrupoEtiqueta {
  /** Sin orden (casi siempre uno o pocos: un arreglo es más barato que un Set). */
  ids: string[];
  bobinas: number;
  nc: number;
}

const esPar = (g: GrupoEtiqueta): boolean => g.bobinas > 0 && g.nc > 0;

/**
 * Lo que une un cable, para R6, R7 y R8: a qué llega cada extremo. Las
 * coordenadas no cuentan. En un borne, `a` es el componente y `b` el borne;
 * en una T, `a` es el cable anfitrión; libre, los dos vacíos.
 */
interface DatosCable {
  dTipo: Extremo["tipo"];
  dA: string;
  dB: string;
  hTipo: Extremo["tipo"];
  hA: string;
  hB: string;
}

const extremoA = (e: Extremo): string => (e.tipo === "borne" ? e.comp : e.tipo === "cable" ? e.cable : "");
const extremoB = (e: Extremo): string => (e.tipo === "borne" ? e.borne : "");

function datosCable(w: Cable): DatosCable {
  return { dTipo: w.desde.tipo, dA: extremoA(w.desde), dB: extremoB(w.desde), hTipo: w.hasta.tipo, hA: extremoA(w.hasta), hB: extremoB(w.hasta) };
}

function escribirCable(g: DatosCable, w: Cable): void {
  g.dTipo = w.desde.tipo;
  g.dA = extremoA(w.desde);
  g.dB = extremoB(w.desde);
  g.hTipo = w.hasta.tipo;
  g.hA = extremoA(w.hasta);
  g.hB = extremoB(w.hasta);
}

function mismoExtremo(tipo: Extremo["tipo"], a: string, b: string, e: Extremo): boolean {
  if (e.tipo !== tipo) return false;
  return e.tipo === "borne" ? e.comp === a && e.borne === b : e.tipo === "cable" ? e.cable === a : true;
}

/** Los componentes a cuyos bornes llega el cable. */
function sumarComps(g: DatosCable, salida: Set<string>): void {
  if (g.dTipo === "borne") salida.add(g.dA);
  if (g.hTipo === "borne") salida.add(g.hA);
}

/**
 * Quién toca a quién, para recorrer una red sin `redes()` (R6 en las redes
 * tocadas). Se arma cuando aparece un par NC y bobina y se mantiene con cada
 * cable que cambia mientras lo haya.
 */
interface Vecinos {
  /** Cables con algún extremo en un borne del componente. */
  porComp: Map<string, Set<string>>;
  /** Cables con un extremo en T sobre el cable. */
  colgados: Map<string, Set<string>>;
}

function sumarA(m: Map<string, Set<string>>, clave: string, id: string): void {
  let s = m.get(clave);
  if (!s) m.set(clave, (s = new Set()));
  s.add(id);
}

function sacarDe(m: Map<string, Set<string>>, clave: string, id: string): void {
  const s = m.get(clave);
  if (!s) return;
  s.delete(id);
  if (s.size === 0) m.delete(clave);
}

function ponerVecinos(v: Vecinos, id: string, g: DatosCable): void {
  if (g.dTipo === "borne") sumarA(v.porComp, g.dA, id);
  else if (g.dTipo === "cable") sumarA(v.colgados, g.dA, id);
  if (g.hTipo === "borne") sumarA(v.porComp, g.hA, id);
  else if (g.hTipo === "cable") sumarA(v.colgados, g.hA, id);
}

function sacarVecinos(v: Vecinos, id: string, g: DatosCable): void {
  if (g.dTipo === "borne") sacarDe(v.porComp, g.dA, id);
  else if (g.dTipo === "cable") sacarDe(v.colgados, g.dA, id);
  if (g.hTipo === "borne") sacarDe(v.porComp, g.hA, id);
  else if (g.hTipo === "cable") sacarDe(v.colgados, g.hA, id);
}

/** Dos avisos iguales, campo por campo (sin armar su texto). */
function mismoAviso(x: Aviso, y: Aviso): boolean {
  if (x.regla !== y.regla || x.severidad !== y.severidad || x.id !== y.id) return false;
  switch (x.regla) {
    case "R2":
      return x.etiqueta === (y as typeof x).etiqueta && x.termico === (y as typeof x).termico;
    case "R6":
      return x.etiqueta === (y as typeof x).etiqueta;
    case "R3":
      return x.nombre === (y as typeof x).nombre;
    case "R4": {
      const z = y as typeof x;
      return x.etiqueta === z.etiqueta && x.otro === z.otro;
    }
    case "R5": {
      const z = y as typeof x;
      return x.etiqueta === z.etiqueta && x.nombre === z.nombre && x.de === z.de;
    }
    case "R7":
      return x.borne === (y as typeof x).borne;
    case "R10":
      return x.otras === (y as typeof x).otras;
    case "R11": {
      const z = y as typeof x;
      return x.tipo === z.tipo && x.x === z.x && x.y === z.y;
    }
    default:
      return true;
  }
}

/** Los avisos agrupados por id, en el orden en que llegan. */
function porId(avisos: readonly Aviso[]): Map<string, Aviso[]> {
  const m = new Map<string, Aviso[]>();
  for (const a of avisos) {
    let l = m.get(a.id);
    if (!l) m.set(a.id, (l = []));
    l.push(a);
  }
  return m;
}

function mismos(a: readonly Aviso[], b: readonly Aviso[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!mismoAviso(a[i]!, b[i]!)) return false;
  return true;
}

/** Los ids del cambio, ya resueltos contra la hoja. */
export interface CambioHoja {
  componentes: ReadonlySet<string>;
  /** Los componentes del cambio que siguen en la hoja. */
  actuales: ReadonlyMap<string, Componente>;
  cables: ReadonlySet<string>;
  /** Los cables del cambio que siguen en la hoja. */
  actualesCables: ReadonlyMap<string, Cable>;
  /** Un componente de la hoja por id (para R7 de los bornes que toca un cable). */
  componente: (id: string) => Componente | undefined;
  /** R6 en toda la hoja aunque solo cambien cables: deshacer o rehacer un Grupo (etapa 3b, D1). */
  r6Hoja?: boolean;
}

export class AvisosHoja {
  /** R1 a R5 y R9 por componente, en el orden de las reglas. */
  private readonly etiqueta = new Map<string, readonly Aviso[]>();
  /** Grupos por etiqueta normalizada no vacía. */
  private readonly grupos = new Map<string, GrupoEtiqueta>();
  /** Cuántos grupos tienen una bobina y un auxiliar NC (candidatos de R6). */
  private paresR6 = 0;
  /** R6 por componente. */
  private readonly r6 = new Map<string, Aviso>();
  /** R7 por componente: un aviso por borne sin cable, en el orden de su definición. */
  private readonly r7 = new Map<string, Aviso[]>();
  /** R8 por cable. */
  private readonly r8 = new Map<string, Aviso>();
  /** R10 por Fase «L». */
  private readonly r10 = new Map<string, Aviso>();
  /** Las Fases «L» de la hoja (R10). */
  private readonly fasesL = new Set<string>();
  /** Cuántas Fases L1, L2 y L3 hay, contando los bornes de las trifásicas (R10). */
  private readonly numeradas = new Map<string, number>();
  /** R11 por componente o cable, visibles (sin los que calla R11-A). */
  private readonly r11 = new Map<string, readonly Aviso[]>();
  /** Las conexiones aparentes de la hoja, por `Aparente.k`; `oculto`: la calla R11-A. */
  private readonly pares = new Map<string, { ap: Aparente; oculto: boolean }>();
  /** Las claves de los pares de cada elemento. */
  private readonly paresDe = new Map<string, Set<string>>();
  /** Las claves de los encimados entre cables (R11-A los vuelve a mirar con cada cambio). */
  private readonly entreCables = new Set<string>();
  /** Tipo y etiqueta de cada componente en el último cálculo. */
  private readonly comps = new Map<string, DatosComp>();
  /** A qué llega cada cable en el último cálculo. */
  private readonly cables = new Map<string, DatosCable>();
  /** Contorno de cada id antes de recalcular etiquetas o R6, solo de los que cambian. */
  private readonly conContornoAntes = new Map<string, boolean>();
  /** Quién toca a quién, solo mientras hay candidatos de R6 (si no, null). */
  private vecinos: Vecinos | null = null;
  /** Semillas de R6 en las redes tocadas, del cambio en curso: bornes (componente y borne, de a pares) y cables. */
  private readonly semillasBornes: string[] = [];
  private readonly semillasCables: string[] = [];
  private _errores = 0;
  private _avisos = 0;
  private _pasadasEtiqueta = 0;
  private _componentesEtiqueta = 0;
  private _pasadasR6 = 0;
  private _pasadasR6Hoja = 0;
  private _msUltimaR6 = 0;
  private _bornesRevisados = 0;
  private _bornesR6 = 0;
  private _revisadosR11 = 0;
  private _pasadasR11Hoja = 0;
  private _msUltimaR11 = 0;
  /** El último `reflejar` cambió lo que une la hoja (extremos de cables, o bornes de un componente): R11-A mira las redes tocadas. */
  private uneR11 = false;
  /** R11 en reposo (T29, D6-A): lo acumulado desde que empezó, o null si no hay nada pendiente. */
  private pendienteR11: {
    componentes: Set<string>;
    cables: Set<string>;
    /** La hoja entera (al abrir, o si lo acumulado es más de tres cuartos de ella). */
    hoja: boolean;
    /** Algún cambio acumulado cambió lo que une la hoja (R11-A mira todas las redes). */
    une: boolean;
    indice: IndiceHoja;
    consulta: ConsultaTrazado;
  } | null = null;
  /** El cálculo en curso; null para empezarlo de nuevo en el próximo tramo. */
  private trabajoR11: Generator<void, void, void> | null = null;
  /** Ids con pares que cambiaron y avisos sin rehacer; siguen si el cálculo vuelve a empezar. */
  private readonly afectadosR11 = new Set<string>();
  /** Ids cuyo R11 cambió en el cálculo en reposo, para avisar al terminar. */
  private cambiadosR11 = new Set<string>();
  /** La cuenta antes del cálculo en reposo (para `CambioAvisos.cuenta`). */
  private cuentaAntesR11: { errores: number; avisos: number } | null = null;
  private tramoProgramadoR11 = false;
  private _tramosR11 = 0;
  private _msTrabajoR11 = 0;
  private readonly umbralR11: number;
  private readonly programarR11: (tramo: () => void) => void;
  private readonly msTramoR11: number;
  private readonly pasosTramoR11: number | undefined;
  private readonly relojR11: () => number;
  /** Lo llama el cálculo de R11 en reposo al terminar, con lo que cambió. */
  alTerminarR11: ((cambio: CambioAvisos) => void) | null = null;

  constructor(
    private readonly doc: Documento,
    private readonly hoja: number,
    private readonly bornesConCable: BornesConCable,
    opciones: OpcionesR11 = {},
  ) {
    this.umbralR11 = opciones.umbral ?? UMBRAL_R11_EN_VIVO;
    this.programarR11 = opciones.programar ?? ((tramo) => setTimeout(tramo, 0));
    this.msTramoR11 = opciones.msTramo ?? MS_TRAMO_R11;
    this.pasosTramoR11 = opciones.pasosTramo;
    this.relojR11 = opciones.reloj ?? (() => performance.now());
    const h = this.hojaActual();
    if (!h) return;
    for (const c of h.componentes) {
      const g = datosComp(c);
      this.comps.set(c.id, g);
      this.ponerEnGrupo(c.id, g);
      this.ponerFase(c.id, g);
      this.ponerR7(c.id, c);
    }
    for (const w of h.cables) {
      this.cables.set(w.id, datosCable(w));
      if (w.desde.tipo === "libre" || w.hasta.tipo === "libre") this.ponerR8(w.id, true);
    }
    this.calcularEtiquetas(h);
    this.calcularR10();
    this.ajustarVecinos();
    this.calcularR6(h);
    this.conContornoAntes.clear();
  }

  /** Si hay un auxiliar NC con la etiqueta de una bobina (R6 puede dar algo). */
  private get candidatosR6(): boolean {
    return this.paresR6 > 0;
  }

  private ponerEnGrupo(id: string, g: DatosComp): void {
    if (g.e === "") return;
    const bobina = esBobina(g.def);
    const nc = !bobina && esAuxiliarNC(g.def);
    const grupo = this.grupos.get(g.e);
    if (!grupo) {
      this.grupos.set(g.e, { ids: [id], bobinas: bobina ? 1 : 0, nc: nc ? 1 : 0 });
      return;
    }
    const par = esPar(grupo);
    grupo.ids.push(id);
    if (bobina) grupo.bobinas++;
    else if (nc) grupo.nc++;
    if (!par && esPar(grupo)) this.paresR6++;
  }

  private sacarDeGrupo(id: string, g: DatosComp): void {
    const grupo = g.e === "" ? undefined : this.grupos.get(g.e);
    if (!grupo) return;
    if (grupo.ids.length === 1) {
      if (grupo.ids[0] === id) this.grupos.delete(g.e);
      return;
    }
    const i = grupo.ids.indexOf(id);
    if (i < 0) return;
    grupo.ids[i] = grupo.ids[grupo.ids.length - 1]!;
    grupo.ids.pop();
    const par = esPar(grupo);
    if (esBobina(g.def)) grupo.bobinas--;
    else if (esAuxiliarNC(g.def)) grupo.nc--;
    if (par && !esPar(grupo)) this.paresR6--;
  }

  /** Arma el índice de vecinos con los cables guardados (al aparecer un par NC y bobina). */
  private armarVecinos(): Vecinos {
    const v: Vecinos = { porComp: new Map(), colgados: new Map() };
    for (const [id, g] of this.cables) ponerVecinos(v, id, g);
    return v;
  }

  /**
   * El índice de vecinos existe solo mientras hay candidatos de R6 o
   * encimados entre cables (R11-A). Con R11 en reposo pendiente y sin
   * candidatos de R6, no: cada comando se ahorra ponerlo al día, y el cálculo
   * en reposo lo arma por partes al arrancar (F2).
   */
  private ajustarVecinos(): void {
    if (this.candidatosR6) this.vecinos ??= this.armarVecinos();
    else if (this.entreCables.size === 0 || this.pendienteR11) this.vecinos = null;
  }

  /** Suma la Fase a las cuentas de R10 (si es «L», L1 a L3 o una trifásica). */
  private ponerFase(id: string, g: DatosComp): void {
    if (esFaseL(g.tipo, g.e)) this.fasesL.add(id);
    else for (const f of fasesNumeradasDe(g.tipo, g.e)) this.numeradas.set(f, (this.numeradas.get(f) ?? 0) + 1);
  }

  /** Saca la Fase de las cuentas de R10. */
  private sacarFase(id: string, g: DatosComp): void {
    if (esFaseL(g.tipo, g.e)) this.fasesL.delete(id);
    else {
      for (const f of fasesNumeradasDe(g.tipo, g.e)) {
        const n = (this.numeradas.get(f) ?? 0) - 1;
        if (n > 0) this.numeradas.set(f, n);
        else this.numeradas.delete(f);
      }
    }
  }

  // ── Consultas ──────────────────────────────────────────────────────────

  /** Errores y avisos de la hoja. */
  get cuenta(): { errores: number; avisos: number } {
    return { errores: this._errores, avisos: this._avisos };
  }

  /** Veces que se recalcularon las reglas de etiqueta (para los tests de que no recalcula de más). */
  get pasadasEtiqueta(): number {
    return this._pasadasEtiqueta;
  }

  /** Componentes evaluados por las reglas de etiqueta (renombrar uno en 2000 evalúa su grupo, no la hoja). */
  get componentesEtiqueta(): number {
    return this._componentesEtiqueta;
  }

  /** Veces que se calculó R6: en toda la hoja (con `redes()`) o en las redes tocadas. */
  get pasadasR6(): number {
    return this._pasadasR6;
  }

  /** De esas, las de toda la hoja. */
  get pasadasR6Hoja(): number {
    return this._pasadasR6Hoja;
  }

  /** Bornes visitados por R6 en las redes tocadas (para el test de que no recorre la hoja). */
  get bornesR6(): number {
    return this._bornesR6;
  }

  /**
   * ms de la última pasada de R6 (en toda la hoja o en las redes tocadas), 0
   * si nunca corrió. Lo lee el banco (plan T19, sección 5, D1-A); un solo
   * número, así no crece con la sesión.
   */
  get msUltimaR6(): number {
    return this._msUltimaR6;
  }

  /** Bornes revisados para R7 (cablear no recorre la hoja: solo los de los cables del cambio). */
  get bornesRevisados(): number {
    return this._bornesRevisados;
  }

  /** Elementos revisados por R11 (para el test de que el cruce no recorre la hoja). */
  get revisadosR11(): number {
    return this._revisadosR11;
  }

  /** Veces que R11 se calculó en la hoja entera. */
  get pasadasR11Hoja(): number {
    return this._pasadasR11Hoja;
  }

  /** ms de la última pasada de R11 en vivo, 0 si nunca corrió. */
  get msUltimaR11(): number {
    return this._msUltimaR11;
  }

  /** ms de trabajo de R11 en reposo, sumados desde que se abrió (sin las esperas entre tramos). */
  get msTrabajoR11(): number {
    return this._msTrabajoR11;
  }

  /** True si el componente lleva el contorno de aviso (R1 a R6, R9 o R10). */
  conContorno(id: string): boolean {
    return this.etiqueta.has(id) || this.r6.has(id) || this.r10.has(id);
  }

  /** Dónde se marcan los R11 del elemento: x, y seguidos (para el anillo). */
  puntosR11(id: string): number[] {
    const salida: number[] = [];
    for (const a of this.r11.get(id) ?? NINGUNO) if (a.regla === "R11") salida.push(a.x, a.y);
    return salida;
  }

  /** Los bornes sin cable del componente (R7), en el orden de su definición. */
  bornesSueltos(id: string): readonly string[] {
    const l = this.r7.get(id);
    return l ? l.map((a) => (a as Extract<Aviso, { regla: "R7" }>).borne) : [];
  }

  /** Los avisos de un componente o un cable, en el orden de `validar` y después R11. */
  de(id: string): readonly Aviso[] {
    const r11 = this.r11.get(id);
    if (this.cables.has(id)) {
      const w = this.r8.get(id);
      if (!r11) return w ? [w] : NINGUNO;
      return w ? [w, ...r11] : r11;
    }
    const etiqueta = this.etiqueta.get(id);
    const r6 = this.r6.get(id);
    const r7 = this.r7.get(id);
    const r10 = this.r10.get(id);
    if (!etiqueta && !r6 && !r7 && !r10 && !r11) return NINGUNO;
    const salida: Aviso[] = [];
    let r9: Aviso | undefined;
    for (const a of etiqueta ?? NINGUNO) {
      if (a.regla === "R9") r9 = a;
      else salida.push(a);
    }
    if (r6) salida.push(r6);
    if (r7) salida.push(...r7);
    if (r9) salida.push(r9);
    if (r10) salida.push(r10);
    if (r11) salida.push(...r11);
    return salida;
  }

  /** Todos los avisos, en el orden de `validar` (para los tests). */
  lista(): Aviso[] {
    const h = this.hojaActual();
    if (!h) return [];
    const salida: Aviso[] = [];
    for (const c of h.componentes) salida.push(...this.de(c.id));
    for (const w of h.cables) salida.push(...this.de(w.id));
    return salida;
  }

  // ── Al día ─────────────────────────────────────────────────────────────

  /**
   * El documento cambió en `cambio`. `BornesConCable` ya tiene que estar al
   * día con sus cables.
   */
  reflejar(cambio: CambioHoja): CambioAvisos {
    const h = this.hojaActual();
    if (!h) return SIN_CAMBIOS;
    const antes = { errores: this._errores, avisos: this._avisos };
    const ids = new Set<string>();
    const contornos = new Set<string>();

    // Componentes: agregados, borrados o con otro tipo o etiqueta. Cada uno
    // sale de su grupo de etiqueta y entra al nuevo; los dos quedan tocados.
    let etiquetas = false;
    const r7 = new Set<string>();
    const recalcular = new Set<string>();
    const tocadas = new Set<string>();
    const quitados: string[] = [];
    for (const id of cambio.componentes) {
      const c = cambio.actuales.get(id);
      const g = this.comps.get(id);
      if (c && g ? this.mismoComponente(g, c) : !c && !g) continue;
      etiquetas = true;
      if (g) {
        this.sacarDeGrupo(id, g);
        this.sacarFase(id, g);
        if (g.e !== "") tocadas.add(g.e);
      }
      // Los bornes de otro tipo, o de un componente que llega o se va.
      if (!c) {
        this.comps.delete(id);
        r7.add(id);
        quitados.push(id);
        continue;
      }
      let n = g;
      if (!n) {
        this.comps.set(id, (n = datosComp(c)));
        r7.add(id);
      } else {
        if (n.tipo !== c.tipo) {
          r7.add(id);
          n.tipo = c.tipo;
          n.def = buscarSimbolo(c.tipo);
        }
        if (n.etiqueta !== c.etiqueta) {
          n.etiqueta = c.etiqueta;
          n.e = normalizarEtiqueta(c.etiqueta);
        }
      }
      this.ponerEnGrupo(id, n);
      this.ponerFase(id, n);
      if (n.e !== "") tocadas.add(n.e);
      recalcular.add(id);
    }

    // Los componentes con otros bornes (llegan, se van o cambian de tipo): sus cables cambian de red (R11-A).
    const conOtrosBornes = [...r7];

    // Cables: agregados, borrados o con otros extremos. Con candidatos de R6,
    // el índice de vecinos sigue a cada cable y se juntan las semillas.
    let une = false;
    const v = this.vecinos;
    this.semillasBornes.length = 0;
    this.semillasCables.length = 0;
    for (const id of cambio.cables) {
      const w = cambio.actualesCables.get(id);
      const g = this.cables.get(id);
      if (w && g ? this.mismoCable(g, w) : !w && !g) continue;
      une = true;
      if (g) {
        sumarComps(g, r7);
        if (v) {
          sacarVecinos(v, id, g);
          this.sembrarViejos(g);
        }
      }
      if (!w) this.cables.delete(id);
      else if (g) escribirCable(g, w);
      else this.cables.set(id, datosCable(w));
      if (w) {
        const n = this.cables.get(id)!;
        sumarComps(n, r7);
        if (v) {
          ponerVecinos(v, id, n);
          this.sembrarNuevos(n);
        }
      }
      if (v) this.semillasCables.push(id);
      const libre = w !== undefined && (w.desde.tipo === "libre" || w.hasta.tipo === "libre");
      if (this.ponerR8(id, libre)) ids.add(id);
    }
    // R11-A: los cables de los componentes con otros bornes también siembran.
    if (v) for (const id of conOtrosBornes) for (const k of v.porComp.get(id) ?? []) this.semillasCables.push(k);
    this.uneR11 = une || conOtrosBornes.length > 0;
    // Los que cuelgan en T de un cable del cambio, cada uno por su lado (si el anfitrión ya no está, no los une).
    if (v) {
      for (let i = 0, n = this.semillasCables.length; i < n; i++) {
        const hijos = v.colgados.get(this.semillasCables[i]!);
        if (hijos) for (const k of hijos) this.semillasCables.push(k);
      }
    }

    for (const id of r7) {
      if (this.ponerR7(id, cambio.componente(id))) ids.add(id);
    }

    if (etiquetas) {
      for (const id of this.etiquetasDe(h, recalcular, tocadas, quitados, cambio.componente)) {
        ids.add(id);
        contornos.add(id);
      }
      for (const id of this.calcularR10()) {
        ids.add(id);
        contornos.add(id);
      }
      this.ajustarVecinos();
    }
    if (etiquetas || une) {
      // Solo cables, con candidatos y sin un Grupo deshecho o rehecho: las redes tocadas.
      const local = !etiquetas && cambio.r6Hoja !== true && this.candidatosR6 && this.vecinos !== null;
      for (const id of local ? this.r6Local() : this.calcularR6(h)) {
        ids.add(id);
        contornos.add(id);
      }
    }
    // Contornos: solo los que de verdad cambian de estado.
    for (const id of contornos) if (this.conContornoAntes.get(id) === this.conContorno(id)) contornos.delete(id);
    this.conContornoAntes.clear();

    const cuenta = antes.errores !== this._errores || antes.avisos !== this._avisos;
    if (ids.size === 0 && !cuenta) return SIN_CAMBIOS;
    return { contornos, ids, cuenta };
  }

  private hojaActual(): Hoja | undefined {
    return this.doc.hojas[this.hoja];
  }

  /** Mismo tipo y misma etiqueta que en el último cálculo. */
  private mismoComponente(g: DatosComp, c: Componente): boolean {
    return g.tipo === c.tipo && g.etiqueta === c.etiqueta;
  }

  /** Los dos extremos llegan a lo mismo que en el último cálculo. */
  private mismoCable(g: DatosCable, w: Cable): boolean {
    return mismoExtremo(g.dTipo, g.dA, g.dB, w.desde) && mismoExtremo(g.hTipo, g.hA, g.hB, w.hasta);
  }

  /** Suma o resta los avisos a la cuenta. */
  private contar(avisos: Iterable<Aviso>, signo: 1 | -1): void {
    const n = contarAvisos(avisos);
    this._errores += signo * n.errores;
    this._avisos += signo * n.avisos;
  }

  /** R7 de un componente (undefined: ya no está). Devuelve true si cambió. */
  private ponerR7(id: string, c: Componente | undefined): boolean {
    const viejos = this.r7.get(id) ?? NINGUNO;
    const nuevos: Aviso[] = [];
    const def = c && buscarSimbolo(c.tipo);
    if (def) {
      for (const b of def.bornes) {
        this._bornesRevisados++;
        if (!this.bornesConCable.tiene(id, b.nombre)) nuevos.push({ regla: "R7", severidad: "aviso", id, borne: b.nombre });
      }
    }
    if (mismos(viejos, nuevos)) return false;
    this.contar(viejos, -1);
    this.contar(nuevos, 1);
    if (nuevos.length > 0) this.r7.set(id, nuevos);
    else this.r7.delete(id);
    return true;
  }

  /** R8 de un cable. Devuelve true si cambió. */
  private ponerR8(id: string, libre: boolean): boolean {
    if (this.r8.has(id) === libre) return false;
    if (libre) {
      this.r8.set(id, { regla: "R8", severidad: "aviso", id });
      this._avisos++;
    } else {
      this.r8.delete(id);
      this._avisos--;
    }
    return true;
  }

  /** R1 a R5 y R9 de un componente (NINGUNO: ninguno, o ya no está). Devuelve true si cambiaron. */
  private ponerEtiqueta(id: string, actuales: readonly Aviso[]): boolean {
    const viejos = this.etiqueta.get(id) ?? NINGUNO;
    if (mismos(viejos, actuales)) return false;
    if (!this.conContornoAntes.has(id)) this.conContornoAntes.set(id, this.conContorno(id));
    this.contar(viejos, -1);
    this.contar(actuales, 1);
    if (actuales.length > 0) this.etiqueta.set(id, actuales);
    else this.etiqueta.delete(id);
    return true;
  }

  /** R1 a R5 y R9: una pasada por la hoja entera. Devuelve los ids cuyos avisos cambiaron. */
  private calcularEtiquetas(h: Hoja): Set<string> {
    this._pasadasEtiqueta++;
    this._componentesEtiqueta += h.componentes.length;
    const nuevos = porId(validar(h, ETIQUETA));
    const cambiados = new Set<string>();
    for (const id of [...this.etiqueta.keys()]) if (!nuevos.has(id) && this.ponerEtiqueta(id, NINGUNO)) cambiados.add(id);
    for (const [id, l] of nuevos) if (this.ponerEtiqueta(id, l)) cambiados.add(id);
    return cambiados;
  }

  /**
   * Suma a `recalcular` los miembros de los grupos de etiqueta tocados. True si
   * alguno tiene dos o más: entonces importa el orden de la hoja (R4 nombra al
   * primero del grupo).
   */
  private sumarGrupos(tocadas: ReadonlySet<string>, recalcular: Set<string>): boolean {
    let ordenar = false;
    for (const e of tocadas) {
      const grupo = this.grupos.get(e);
      if (!grupo) continue;
      if (grupo.ids.length >= 2) ordenar = true;
      for (const id of grupo.ids) recalcular.add(id);
    }
    return ordenar;
  }

  /**
   * R1 a R5 y R9 solo de lo que el cambio puede mover (etapa 3b, arreglo 3):
   * los componentes del cambio (R1, R3 y R9 son de cada uno) y todos los de
   * los grupos de etiqueta tocados (R2, R4 y R5 dependen del grupo). Se
   * calculan con `validar` sobre una hoja con solo esos componentes, en el
   * orden de la hoja si hace falta: da lo mismo que en la hoja entera, porque
   * cada grupo entra completo. Si son más de tres cuartos, la hoja entera.
   * Devuelve los ids cuyos avisos cambiaron.
   */
  private etiquetasDe(
    h: Hoja,
    recalcular: Set<string>,
    tocadas: ReadonlySet<string>,
    quitados: readonly string[],
    componente: (id: string) => Componente | undefined,
  ): Set<string> {
    const ordenar = this.sumarGrupos(tocadas, recalcular);
    if (recalcular.size * 4 > h.componentes.length * 3) return this.calcularEtiquetas(h);
    this._pasadasEtiqueta++;
    const cambiados = new Set<string>();
    for (const id of quitados) if (this.ponerEtiqueta(id, NINGUNO)) cambiados.add(id);
    if (recalcular.size === 0) return cambiados;
    let lista: Componente[];
    if (ordenar) {
      lista = h.componentes.filter((c) => recalcular.has(c.id));
    } else {
      lista = [];
      for (const id of recalcular) {
        const c = componente(id);
        if (c) lista.push(c);
      }
    }
    this._componentesEtiqueta += lista.length;
    const nuevos = porId(validar({ ...h, componentes: lista, cables: [] }, ETIQUETA));
    for (const c of lista) if (this.ponerEtiqueta(c.id, nuevos.get(c.id) ?? NINGUNO)) cambiados.add(c.id);
    return cambiados;
  }

  // ── R10 ────────────────────────────────────────────────────────────────

  /** R10 de las Fases «L» (pocas): todas, con cada cambio de etiquetas. Devuelve los ids cuyo R10 cambió. */
  private calcularR10(): Set<string> {
    const otras = otrasFasesR10((n) => this.numeradas.has(n));
    const cambiados = new Set<string>();
    for (const id of [...this.r10.keys()]) if (!this.fasesL.has(id) && this.ponerR10(id, undefined)) cambiados.add(id);
    for (const id of this.fasesL) {
      if (this.ponerR10(id, otras === "" ? undefined : { regla: "R10", severidad: "aviso", id, otras })) cambiados.add(id);
    }
    return cambiados;
  }

  /** R10 de una Fase (undefined: no la marca). Devuelve true si cambió. */
  private ponerR10(id: string, actual: Aviso | undefined): boolean {
    const viejo = this.r10.get(id);
    if (viejo === undefined ? actual === undefined : actual !== undefined && mismoAviso(viejo, actual)) return false;
    if (!this.conContornoAntes.has(id)) this.conContornoAntes.set(id, this.conContorno(id));
    if (viejo) this.contar([viejo], -1);
    if (actual) {
      this.contar([actual], 1);
      this.r10.set(id, actual);
    } else {
      this.r10.delete(id);
    }
    return true;
  }

  // ── R11 ────────────────────────────────────────────────────────────────

  /**
   * R11 en la hoja entera al abrir (H-A), en reposo: el editor la llama cuando
   * la escena ya tiene todo (la consulta es su índice espacial). Los avisos
   * aparecen al terminar (`alTerminarR11`).
   */
  iniciarR11(indice: IndiceHoja, consulta: ConsultaTrazado): void {
    if (!this.hojaActual()) return;
    this.acumularR11(new Set(), new Set(), indice, consulta, true);
  }

  /**
   * R11 después de un comando, con la escena ya al día: `componentes` y
   * `cables` son los ids del cambio (estén o no en la hoja). Hasta
   * `UMBRAL_R11_EN_VIVO` elementos, y sin un cálculo en reposo pendiente, en
   * vivo (I-A): devuelve qué cambió. Si no, se suma a lo pendiente, el cálculo
   * vuelve a empezar con todo lo acumulado y esto devuelve nada; los avisos
   * llegan al terminar (`alTerminarR11`). Sin contornos: R11 se ve en el
   * panel, en la cuenta y en el anillo de la selección.
   */
  reflejarR11(componentes: ReadonlySet<string>, cables: ReadonlySet<string>, indice: IndiceHoja, consulta: ConsultaTrazado): CambioAvisos {
    const h = this.hojaActual();
    if (!h || (componentes.size === 0 && cables.size === 0)) return SIN_CAMBIOS;
    if (this.pendienteR11 || componentes.size + cables.size > this.umbralR11) {
      this.acumularR11(componentes, cables, indice, consulta, false);
      return SIN_CAMBIOS;
    }
    const antes = { errores: this._errores, avisos: this._avisos };
    const t0 = performance.now();
    const afectados = new Set<string>();
    const ids = new Set<string>();
    const hoja = this.presentesR11(componentes, cables, indice) * 4 > (h.componentes.length + h.cables.length) * 3;
    const partes = hoja
      ? this.r11HojaPorPartes(h, indice, consulta, afectados, ids)
      : this.r11LocalPorPartes(componentes, cables, indice, consulta, this.uneR11 ? "tocadas" : "ninguna", afectados, ids);
    while (!partes.next().done);
    this._msUltimaR11 = performance.now() - t0;
    this.ajustarVecinos();
    const cuenta = antes.errores !== this._errores || antes.avisos !== this._avisos;
    if (ids.size === 0 && !cuenta) return SIN_CAMBIOS;
    return { contornos: new Set(), ids, cuenta };
  }

  /** True mientras hay un cálculo de R11 en reposo sin terminar. */
  get enReposoR11(): boolean {
    return this.pendienteR11 !== null;
  }

  /** Tramos corridos por el cálculo en reposo (para los tests). */
  get tramosR11(): number {
    return this._tramosR11;
  }

  /** Lo pendiente del reposo: los elementos acumulados y si es la hoja entera (null si no hay nada). */
  get pendienteR11Tamano(): { elementos: number; hoja: boolean } | null {
    const p = this.pendienteR11;
    return p ? { elementos: p.componentes.size + p.cables.size, hoja: p.hoja } : null;
  }

  /** Termina ya, sin tramos, el cálculo en reposo pendiente (tests y humo). */
  terminarR11(): void {
    while (this.pendienteR11) this.correrTramoR11(false);
  }

  /** Lo del cambio que sigue en la hoja (lo que se va solo saca sus pares). */
  private presentesR11(componentes: ReadonlySet<string>, cables: ReadonlySet<string>, indice: IndiceHoja): number {
    let n = 0;
    for (const id of componentes) if (indice.componentes.has(id)) n++;
    for (const id of cables) if (indice.cables.has(id)) n++;
    return n;
  }

  /**
   * Suma el cambio a lo pendiente y vuelve a empezar el cálculo en reposo
   * (con todo lo acumulado). Cuesta lo del cambio (F1): si la hoja entera se
   * va a revisar no guarda ids, y si lo acumulado pasa a ser hoja entera se
   * decide al arrancar el cálculo, no en cada comando. Sin candidatos de R6,
   * los vecinos se sueltan (F2).
   */
  private acumularR11(componentes: ReadonlySet<string>, cables: ReadonlySet<string>, indice: IndiceHoja, consulta: ConsultaTrazado, hoja: boolean): void {
    const p = (this.pendienteR11 ??= { componentes: new Set(), cables: new Set(), hoja: false, une: false, indice, consulta });
    if (!this.cuentaAntesR11) this.cuentaAntesR11 = { errores: this._errores, avisos: this._avisos };
    if (hoja && !p.hoja) {
      p.hoja = true;
      p.componentes.clear();
      p.cables.clear();
    }
    if (!p.hoja) {
      for (const id of componentes) p.componentes.add(id);
      for (const id of cables) p.cables.add(id);
    }
    p.indice = indice;
    p.consulta = consulta;
    p.une ||= this.uneR11 || hoja;
    this.trabajoR11 = null;
    if (!this.candidatosR6) this.vecinos = null;
    this.programarTramoR11();
  }

  private programarTramoR11(): void {
    if (this.tramoProgramadoR11) return;
    this.tramoProgramadoR11 = true;
    this.programarR11(() => {
      this.tramoProgramadoR11 = false;
      this.correrTramoR11(true);
    });
  }

  /**
   * Un tramo del cálculo en reposo: hasta `msTramoR11` ms (o `pasosTramoR11`
   * pasos, en los tests); con `limitado` en false, hasta el final. Si lo
   * termina, avisa al editor; si no, programa el siguiente.
   */
  private correrTramoR11(limitado: boolean): void {
    const p = this.pendienteR11;
    const h = this.hojaActual();
    if (!p || !h) {
      this.pendienteR11 = null;
      return;
    }
    this._tramosR11++;
    this.trabajoR11 ??= this.r11EnReposo(p, h);
    const reloj = this.relojR11;
    const t0 = reloj();
    const corte = this.msTramoR11 - MARGEN_TRAMO_R11;
    let pasos = 0;
    for (;;) {
      if (this.trabajoR11.next().done) break;
      pasos++;
      if (!limitado) continue;
      if (this.pasosTramoR11 !== undefined ? pasos >= this.pasosTramoR11 : reloj() - t0 >= corte) {
        this._msTrabajoR11 += reloj() - t0;
        this.programarTramoR11();
        return;
      }
    }
    this._msTrabajoR11 += reloj() - t0;
    // Terminado: lo acumulado ya está, y los avisos aparecen ahora.
    this.pendienteR11 = null;
    this.trabajoR11 = null;
    this.ajustarVecinos();
    const antes = this.cuentaAntesR11!;
    this.cuentaAntesR11 = null;
    const ids = this.cambiadosR11;
    this.cambiadosR11 = new Set();
    this.afectadosR11.clear();
    const cuenta = antes.errores !== this._errores || antes.avisos !== this._avisos;
    if (ids.size > 0 || cuenta) this.alTerminarR11?.({ contornos: new Set(), ids, cuenta });
  }

  /**
   * El cálculo en reposo, por partes. Al arrancar decide si lo acumulado es
   * más de tres cuartos de la hoja (F1) y arma los vecinos de R11-A si no
   * están (F2): los dos, con cortes de tramo. Los vecinos se ponen recién
   * completos: si llega un comando en el medio, el cálculo vuelve a empezar y
   * lo armado a medias se tira.
   */
  private *r11EnReposo(p: NonNullable<AvisosHoja["pendienteR11"]>, h: Hoja): Generator<void, void, void> {
    let n = 0;
    if (!p.hoja) {
      let presentes = 0;
      for (const id of p.componentes) {
        if (p.indice.componentes.has(id)) presentes++;
        if (++n % 1024 === 0) yield;
      }
      for (const id of p.cables) {
        if (p.indice.cables.has(id)) presentes++;
        if (++n % 1024 === 0) yield;
      }
      if (presentes * 4 > (h.componentes.length + h.cables.length) * 3) {
        p.hoja = true;
        p.componentes.clear();
        p.cables.clear();
      }
      yield;
    }
    if (!this.vecinos) {
      const v: Vecinos = { porComp: new Map(), colgados: new Map() };
      for (const [id, g] of this.cables) {
        ponerVecinos(v, id, g);
        if (++n % 512 === 0) yield;
      }
      this.vecinos = v;
      yield;
    }
    if (p.hoja) yield* this.r11HojaPorPartes(h, p.indice, p.consulta, this.afectadosR11, this.cambiadosR11);
    else yield* this.r11LocalPorPartes(p.componentes, p.cables, p.indice, p.consulta, p.une ? "todas" : "ninguna", this.afectadosR11, this.cambiadosR11);
  }

  /**
   * R11 en la hoja entera, desde cada elemento, por partes (un paso por
   * elemento, por 8 pares o por 64 ids). Suma a `cambiados` los ids cuyo R11
   * cambió.
   */
  private *r11HojaPorPartes(h: Hoja, indice: IndiceHoja, consulta: ConsultaTrazado, afectados: Set<string>, cambiados: Set<string>): Generator<void, void, void> {
    this._pasadasR11Hoja++;
    let n = 0;
    for (const id of this.r11.keys()) {
      afectados.add(id);
      if (++n % 1024 === 0) yield;
    }
    this.pares.clear();
    this.paresDe.clear();
    this.entreCables.clear();
    yield;
    // Sin copiar las listas (F4): si la hoja cambia, el cálculo vuelve a empezar.
    const lista: Aparente[] = [];
    for (let i = 0; i < h.componentes.length; i++) {
      this._revisadosR11++;
      aparentesDeComponente(h.componentes[i]!, consulta, lista);
      yield;
    }
    for (let i = 0; i < h.cables.length; i++) {
      this._revisadosR11++;
      aparentesDeCable(h.cables[i]!, indice, consulta, lista);
      yield;
    }
    // Cada par puede recorrer una red (R11-A): de a 8.
    // Cada vuelta cuenta para el corte, también las que se saltan (T29: miles seguidas no cedían).
    const mismaRed = this.mismaRed();
    for (const ap of lista) {
      if (++n % 8 === 0) yield;
      if (this.pares.has(ap.k)) continue;
      this.ponerPar(ap, afectados, mismaRed);
    }
    // Los encimados entre cables se vuelven a mirar con los cambios: hacen falta los vecinos.
    if (this.entreCables.size > 0) this.vecinos ??= this.armarVecinos();
    yield* this.ponerAfectadosPorPartes(afectados, cambiados);
  }

  /**
   * R11 de lo que cambió, por partes: se sacan los pares con algo del cambio
   * y se buscan de nuevo desde lo del cambio y desde lo que la consulta tiene
   * cerca (un par puede verse solo desde el otro lado). Los pares sin nada del
   * cambio no se mueven: su geometría y sus extremos son los de antes. R11-A
   * vuelve a mirar los encimados entre cables que quedan: en las redes
   * tocadas por el último `reflejar` (en vivo), en todas (en reposo, con
   * varios cambios acumulados) o en ninguna (no cambió lo que une la hoja).
   */
  private *r11LocalPorPartes(
    componentes: ReadonlySet<string>,
    cables: ReadonlySet<string>,
    indice: IndiceHoja,
    consulta: ConsultaTrazado,
    redes: "tocadas" | "todas" | "ninguna",
    afectados: Set<string>,
    cambiados: Set<string>,
  ): Generator<void, void, void> {
    // Sin juntar los dos conjuntos en uno nuevo (F4).
    const delCambio = (id: string) => componentes.has(id) || cables.has(id);
    let n = 0;
    for (const ids of [componentes, cables]) {
      for (const id of ids) {
        const ks = this.paresDe.get(id);
        if (ks) {
          // `quitarPar` lo vacía: se saca siempre el primero, sin copiar.
          while (ks.size > 0) {
            this.quitarPar(ks.values().next().value!, afectados);
            if (++n % 64 === 0) yield;
          }
        }
        if (++n % 512 === 0) yield;
      }
    }
    const revisar = new Set<string>();
    for (const id of componentes) {
      if (indice.componentes.has(id)) revisar.add(id);
      if (++n % 512 === 0) yield;
    }
    for (const id of cables) {
      if (indice.cables.has(id)) revisar.add(id);
      if (++n % 512 === 0) yield;
    }
    for (const ids of [componentes, cables]) {
      for (const id of ids) {
        this.sumarCercanos(id, indice, consulta, revisar);
        if (++n % 4 === 0) yield;
      }
    }
    const lista: Aparente[] = [];
    for (const id of revisar) {
      this._revisadosR11++;
      const c = indice.componentes.get(id);
      if (c) aparentesDeComponente(c, consulta, lista);
      else {
        const w = indice.cables.get(id);
        if (w) aparentesDeCable(w, indice, consulta, lista);
      }
      yield;
    }
    // Cada par puede recorrer una red (R11-A): de a 8.
    const mismaRed = this.mismaRed();
    const nuevos = new Set<string>();
    // Cada vuelta cuenta para el corte, también las que se saltan: después de duplicar, la lista trae
    // decenas de miles de pares de los vecinos que ya estaban (T29: 2,3 ms seguidos sin ceder).
    for (const ap of lista) {
      if (++n % 8 === 0) yield;
      if (!(delCambio(ap.a) || delCambio(ap.b)) || this.pares.has(ap.k)) continue;
      this.ponerPar(ap, afectados, mismaRed);
      nuevos.add(ap.k);
    }
    if (redes !== "ninguna" && this.entreCables.size > 0) {
      const tocados = redes === "tocadas" ? this.cablesTocados() : null;
      // Sin copiar (F4): acá solo cambia `oculto`, no el conjunto.
      for (const k of this.entreCables) {
        if (++n % 8 === 0) yield;
        if (nuevos.has(k)) continue;
        const p = this.pares.get(k)!;
        if (tocados && !tocados.has(p.ap.a) && !tocados.has(p.ap.b)) continue;
        const oculto = mismaRed(p.ap.a, p.ap.b);
        if (oculto !== p.oculto) {
          p.oculto = oculto;
          afectados.add(p.ap.a);
          afectados.add(p.ap.b);
        }
      }
    }
    yield* this.ponerAfectadosPorPartes(afectados, cambiados);
  }

  /** Suma a `revisar` lo que la consulta tiene cerca de un elemento del cambio (con el índice espacial, nunca la hoja entera). */
  private sumarCercanos(id: string, indice: IndiceHoja, consulta: ConsultaTrazado, revisar: Set<string>): void {
    const c = indice.componentes.get(id);
    if (c) {
      cercanos({ componente: c }, consulta, revisar);
      return;
    }
    const w = indice.cables.get(id);
    if (w) cercanos({ cable: w, indice }, consulta, revisar);
  }

  private ponerPar(ap: Aparente, afectados: Set<string>, mismaRed: (a: string, b: string) => boolean): void {
    const oculto = ap.entreCables && mismaRed(ap.a, ap.b);
    this.pares.set(ap.k, { ap, oculto });
    sumarA(this.paresDe, ap.a, ap.k);
    sumarA(this.paresDe, ap.b, ap.k);
    if (ap.entreCables) this.entreCables.add(ap.k);
    afectados.add(ap.a);
    afectados.add(ap.b);
  }

  private quitarPar(k: string, afectados: Set<string>): void {
    const p = this.pares.get(k);
    if (!p) return;
    this.pares.delete(k);
    sacarDe(this.paresDe, p.ap.a, k);
    sacarDe(this.paresDe, p.ap.b, k);
    this.entreCables.delete(k);
    afectados.add(p.ap.a);
    afectados.add(p.ap.b);
  }

  /**
   * Rehace los avisos R11 de cada id afectado con sus pares visibles, de a
   * 64, y lo saca de `afectados` (si el cálculo vuelve a empezar, los que
   * faltan siguen ahí). Suma a `cambiados` los que cambiaron.
   */
  private *ponerAfectadosPorPartes(afectados: Set<string>, cambiados: Set<string>): Generator<void, void, void> {
    let n = 0;
    // Un solo arreglo de trabajo para todos los ids (menos basura, F4 y A).
    const visibles: Aparente[] = [];
    for (const id of afectados) {
      visibles.length = 0;
      for (const k of this.paresDe.get(id) ?? []) {
        const p = this.pares.get(k)!;
        if (!p.oculto) visibles.push(p.ap);
      }
      if (this.ponerR11(id, visibles.length > 0 ? avisosR11De(id, visibles) : NINGUNO)) cambiados.add(id);
      afectados.delete(id);
      if (++n % 64 === 0) yield;
    }
  }

  /** R11 de un elemento. Devuelve true si cambió. */
  private ponerR11(id: string, nuevos: readonly Aviso[]): boolean {
    const viejos = this.r11.get(id) ?? NINGUNO;
    if (mismos(viejos, nuevos)) return false;
    this.contar(viejos, -1);
    this.contar(nuevos, 1);
    if (nuevos.length > 0) this.r11.set(id, nuevos);
    else this.r11.delete(id);
    return true;
  }

  /**
   * R11-A sin `redes()` de la hoja: si dos cables están en la misma red. La
   * primera vez que se pregunta por un cable se recorre solo su red, como
   * `redes()` sin unir por nombre (un extremo libre o hacia algo que no está
   * no une; la geometría no cuenta), y todos sus cables quedan con el mismo
   * número: cada red se recorre a lo sumo una vez por cálculo (si la hoja
   * cambia en el medio, el cálculo vuelve a empezar). Usa los vecinos de R6
   * (los arma si no están). El costo es el de las redes preguntadas.
   */
  private mismaRed(): (a: string, b: string) => boolean {
    const red = new Map<string, number>();
    let n = 0;
    return (a, b) => {
      if (a === b) return true;
      let x = red.get(a);
      if (x === undefined) {
        const vistos = new Set<string>();
        this.recorrerCables([a], [null], null, vistos);
        x = n++;
        red.set(a, x);
        for (const id of vistos) red.set(id, x);
      }
      return red.get(b) === x;
    };
  }

  /**
   * Los cables de las redes tocadas por el último `reflejar` (sus semillas,
   * las de R6): toda red que cambió contiene alguna. Para R11-A.
   */
  private cablesTocados(): Set<string> {
    const colaA: string[] = [];
    const colaB: (string | null)[] = [];
    const sb = this.semillasBornes;
    for (let i = 0; i < sb.length; i += 2) {
      colaA.push(sb[i]!);
      colaB.push(sb[i + 1]!);
    }
    for (const id of this.semillasCables) {
      colaA.push(id);
      colaB.push(null);
    }
    const vistos = new Set<string>();
    this.recorrerCables(colaA, colaB, null, vistos);
    return vistos;
  }

  /**
   * Recorre las redes desde la cola (cables, o bornes de componente) como
   * `redes()` sin unir por nombre, sumando los cables a `cablesVistos`. Con
   * `objetivo`, corta y da true al llegar a ese cable.
   */
  private recorrerCables(colaA: string[], colaB: (string | null)[], objetivo: string | null, cablesVistos: Set<string>): boolean {
    const v = (this.vecinos ??= this.armarVecinos());
    const bornesVistos = new Set<string>();
    while (colaA.length > 0) {
      const x = colaA.pop()!;
      const y = colaB.pop()!;
      if (y === null) {
        if (x === objetivo) return true;
        if (cablesVistos.has(x)) continue;
        const g = this.cables.get(x);
        if (!g) continue;
        cablesVistos.add(x);
        if (g.dTipo !== "libre") {
          colaA.push(g.dA);
          colaB.push(g.dTipo === "borne" ? g.dB : null);
        }
        if (g.hTipo !== "libre") {
          colaA.push(g.hA);
          colaB.push(g.hTipo === "borne" ? g.hB : null);
        }
        const hijos = v.colgados.get(x);
        if (hijos) {
          for (const k of hijos) {
            colaA.push(k);
            colaB.push(null);
          }
        }
        continue;
      }
      const clave = `${x}\u0000${y}`;
      if (bornesVistos.has(clave)) continue;
      bornesVistos.add(clave);
      const def = this.comps.get(x)?.def;
      if (!def || !def.bornes.some((k) => k.nombre === y)) continue;
      const cables = v.porComp.get(x);
      if (!cables) continue;
      for (const k of cables) {
        const g = this.cables.get(k)!;
        if ((g.dTipo === "borne" && g.dA === x && g.dB === y) || (g.hTipo === "borne" && g.hA === x && g.hB === y)) {
          colaA.push(k);
          colaB.push(null);
        }
      }
    }
    return false;
  }

  // ── R6 ─────────────────────────────────────────────────────────────────

  /** R6 de un NC (undefined: no lo marca). Devuelve true si cambió. */
  private ponerR6(id: string, actual: Aviso | undefined): boolean {
    const viejo = this.r6.get(id);
    if (viejo === undefined ? actual === undefined : actual !== undefined && mismoAviso(viejo, actual)) return false;
    if (!this.conContornoAntes.has(id)) this.conContornoAntes.set(id, this.conContorno(id));
    if (viejo) this.contar([viejo], -1);
    if (actual) {
      this.contar([actual], 1);
      this.r6.set(id, actual);
    } else {
      this.r6.delete(id);
    }
    return true;
  }

  /** R6 en toda la hoja, con `redes()`, solo si hay candidatos. Devuelve los ids cuyo R6 cambió. */
  private calcularR6(h: Hoja): Set<string> {
    const nuevos = new Map<string, Aviso>();
    if (this.candidatosR6) {
      this._pasadasR6++;
      this._pasadasR6Hoja++;
      const t0 = performance.now();
      for (const a of validar(h, SOLO_R6)) nuevos.set(a.id, a);
      this._msUltimaR6 = performance.now() - t0;
    }
    const cambiados = new Set<string>();
    for (const id of [...this.r6.keys()]) if (!nuevos.has(id) && this.ponerR6(id, undefined)) cambiados.add(id);
    for (const [id, a] of nuevos) if (this.ponerR6(id, a)) cambiados.add(id);
    return cambiados;
  }

  /** Semillas de R6 en las redes tocadas: a qué llegaban los extremos de un cable que cambió. */
  private sembrarViejos(g: DatosCable): void {
    this.sembrarExtremos(g);
  }

  /** Semillas de R6 en las redes tocadas: a qué llegan ahora los extremos de un cable que cambió. */
  private sembrarNuevos(g: DatosCable): void {
    this.sembrarExtremos(g);
  }

  private sembrarExtremos(g: DatosCable): void {
    if (g.dTipo === "borne") this.semillasBornes.push(g.dA, g.dB);
    else if (g.dTipo === "cable") this.semillasCables.push(g.dA);
    if (g.hTipo === "borne") this.semillasBornes.push(g.hA, g.hB);
    else if (g.hTipo === "cable") this.semillasCables.push(g.hA);
  }

  /**
   * R6 solo en las redes tocadas (etapa 3b, arreglo 2), cuando el cambio es
   * solo de cables. Las semillas son los extremos viejos y nuevos de los
   * cables que cambiaron, esos cables y los que cuelgan de ellos en T: toda red
   * que cambió contiene alguna. Las demás son las de antes y, sin cambios de
   * etiqueta, marcan lo mismo. Se recorren como `redes()` (un extremo libre o
   * hacia algo que no está no une; la geometría no cuenta) y se recalculan los
   * NC con algún borne en ellas, mirando todas sus redes. El costo depende del
   * tamaño de esas redes, no de la hoja. Devuelve los ids cuyo R6 cambió.
   */
  private r6Local(): Set<string> {
    this._pasadasR6++;
    const t0 = performance.now();
    const v = this.vecinos!;
    /** Componente → borne → número de red. */
    const redDe = new Map<string, Map<string, number>>();
    const cablesVistos = new Set<string>();
    /** Por red: las etiquetas de sus bobinas, o null si tiene nombre de alimentación o ninguna bobina. */
    const bobinasRed: (Set<string> | null)[] = [];
    const colaA: string[] = [];
    /** null: el nodo es un cable; si no, el borne de `colaA`. */
    const colaB: (string | null)[] = [];

    /** Recorre la red del nodo, si existe y no se vio. Los auxiliares NC que encuentra van a `ncs`. */
    const recorrer = (a: string, b: string | null, ncs: Set<string> | null): void => {
      const red = bobinasRed.length;
      let nombrada = false;
      let bobinas: Set<string> | null = null;
      let alguno = false;
      colaA.push(a);
      colaB.push(b);
      while (colaA.length > 0) {
        const x = colaA.pop()!;
        const y = colaB.pop()!;
        if (y === null) {
          if (cablesVistos.has(x)) continue;
          const g = this.cables.get(x);
          if (!g) continue;
          cablesVistos.add(x);
          alguno = true;
          if (g.dTipo !== "libre") {
            colaA.push(g.dA);
            colaB.push(g.dTipo === "borne" ? g.dB : null);
          }
          if (g.hTipo !== "libre") {
            colaA.push(g.hA);
            colaB.push(g.hTipo === "borne" ? g.hB : null);
          }
          const hijos = v.colgados.get(x);
          if (hijos) {
            for (const k of hijos) {
              colaA.push(k);
              colaB.push(null);
            }
          }
          continue;
        }
        let delComp = redDe.get(x);
        if (delComp?.has(y)) continue;
        const info = this.comps.get(x);
        const def = info?.def;
        if (!info || !def || !def.bornes.some((k) => k.nombre === y)) continue;
        if (!delComp) redDe.set(x, (delComp = new Map()));
        delComp.set(y, red);
        alguno = true;
        this._bornesR6++;
        // Fase o Neutro con etiqueta; una fuente de varios bornes nombra cada uno (T34, D2-A).
        if (def.elemento === "fuente" && (def.bornes.length > 1 || nombreDeFuente(info))) nombrada = true;
        const e = info.e;
        if (e !== "") {
          if (esBobina(def)) (bobinas ??= new Set()).add(e);
          else if (ncs && esAuxiliarNC(def)) ncs.add(x);
        }
        const cables = v.porComp.get(x);
        if (cables) {
          for (const k of cables) {
            const g = this.cables.get(k)!;
            if ((g.dTipo === "borne" && g.dA === x && g.dB === y) || (g.hTipo === "borne" && g.hA === x && g.hB === y)) {
              colaA.push(k);
              colaB.push(null);
            }
          }
        }
      }
      if (alguno) bobinasRed.push(nombrada ? null : bobinas);
    };

    const tocados = new Set<string>();
    const sb = this.semillasBornes;
    for (let i = 0; i < sb.length; i += 2) recorrer(sb[i]!, sb[i + 1]!, tocados);
    for (const id of this.semillasCables) recorrer(id, null, tocados);

    // Los NC tocados, con todas sus redes (las que faltan se recorren ahora).
    const cambiados = new Set<string>();
    for (const id of tocados) {
      const info = this.comps.get(id)!;
      const def = info.def!;
      const e = info.e;
      let marcado = false;
      for (const k of def.bornes) {
        if (!redDe.get(id)?.has(k.nombre)) recorrer(id, k.nombre, null);
        if (bobinasRed[redDe.get(id)!.get(k.nombre)!]?.has(e)) {
          marcado = true;
          break;
        }
      }
      if (this.ponerR6(id, marcado ? { regla: "R6", severidad: "aviso", id, etiqueta: e } : undefined)) cambiados.add(id);
    }
    this._msUltimaR6 = performance.now() - t0;
    return cambiados;
  }
}
