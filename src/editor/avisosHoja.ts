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
//
// Devuelve qué cambió: los componentes cuyo contorno de aviso aparece o se va
// (la escena los rehace), los ids cuyos avisos cambiaron (panel y anillo) y
// si cambió la cuenta (barra).
//
// No depende de la vista. Un documento nuevo es un editor nuevo, con su
// propio caché.

import type { Cable, Componente, Documento, Extremo, Hoja } from "../core/model/documento";
import { normalizarEtiqueta } from "../core/model/etiquetas";
import { nombreDeFuente } from "../core/model/redes";
import { contarAvisos, esAuxiliarNC, validar, type Aviso, type Regla } from "../core/model/validaciones";
import { buscarSimbolo, esBobina, type DefinicionSimbolo } from "../core/symbols";
import type { BornesConCable } from "./bornesConCable";

/** Las reglas de etiqueta: una pasada por los componentes. */
const ETIQUETA: readonly Regla[] = ["R1", "R2", "R3", "R4", "R5", "R9"];
const SOLO_R6: readonly Regla[] = ["R6"];

const NINGUNO: readonly Aviso[] = [];

/** Qué cambió con un comando. */
export interface CambioAvisos {
  /** Componentes cuyo contorno (R1 a R6 y R9) apareció o se fue: la escena los rehace. */
  contornos: ReadonlySet<string>;
  /** Componentes y cables cuyos avisos cambiaron (para el panel y el anillo). */
  ids: ReadonlySet<string>;
  /** Si cambió la cuenta de errores o de avisos. */
  cuenta: boolean;
}

const SIN_CAMBIOS: CambioAvisos = { contornos: new Set(), ids: new Set(), cuenta: false };

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

  constructor(
    private readonly doc: Documento,
    private readonly hoja: number,
    private readonly bornesConCable: BornesConCable,
  ) {
    const h = this.hojaActual();
    if (!h) return;
    for (const c of h.componentes) {
      const g = datosComp(c);
      this.comps.set(c.id, g);
      this.ponerEnGrupo(c.id, g);
      this.ponerR7(c.id, c);
    }
    for (const w of h.cables) {
      this.cables.set(w.id, datosCable(w));
      if (w.desde.tipo === "libre" || w.hasta.tipo === "libre") this.ponerR8(w.id, true);
    }
    this.calcularEtiquetas(h);
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

  /** El índice de vecinos existe solo mientras hay candidatos de R6. */
  private ajustarVecinos(): void {
    if (this.candidatosR6) this.vecinos ??= this.armarVecinos();
    else this.vecinos = null;
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

  /** True si el componente lleva el contorno de aviso (R1 a R6 o R9). */
  conContorno(id: string): boolean {
    return this.etiqueta.has(id) || this.r6.has(id);
  }

  /** Los bornes sin cable del componente (R7), en el orden de su definición. */
  bornesSueltos(id: string): readonly string[] {
    const l = this.r7.get(id);
    return l ? l.map((a) => (a as Extract<Aviso, { regla: "R7" }>).borne) : [];
  }

  /** Los avisos de un componente o un cable, en el orden de `validar`. */
  de(id: string): readonly Aviso[] {
    const w = this.r8.get(id);
    if (w) return [w];
    const etiqueta = this.etiqueta.get(id);
    const r6 = this.r6.get(id);
    const r7 = this.r7.get(id);
    if (!etiqueta && !r6 && !r7) return NINGUNO;
    const salida: Aviso[] = [];
    let r9: Aviso | undefined;
    for (const a of etiqueta ?? NINGUNO) {
      if (a.regla === "R9") r9 = a;
      else salida.push(a);
    }
    if (r6) salida.push(r6);
    if (r7) salida.push(...r7);
    if (r9) salida.push(r9);
    return salida;
  }

  /** Todos los avisos, en el orden de `validar` (para los tests). */
  lista(): Aviso[] {
    const h = this.hojaActual();
    if (!h) return [];
    const salida: Aviso[] = [];
    for (const c of h.componentes) salida.push(...this.de(c.id));
    for (const w of h.cables) {
      const a = this.r8.get(w.id);
      if (a) salida.push(a);
    }
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
      if (n.e !== "") tocadas.add(n.e);
      recalcular.add(id);
    }

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
    if (!this.conContornoAntes.has(id)) this.conContornoAntes.set(id, viejos.length > 0 || this.r6.has(id));
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

  /** R6 de un NC (undefined: no lo marca). Devuelve true si cambió. */
  private ponerR6(id: string, actual: Aviso | undefined): boolean {
    const viejo = this.r6.get(id);
    if (viejo === undefined ? actual === undefined : actual !== undefined && mismoAviso(viejo, actual)) return false;
    if (!this.conContornoAntes.has(id)) this.conContornoAntes.set(id, viejo !== undefined || this.etiqueta.has(id));
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
        if (def.elemento === "fuente" && nombreDeFuente(info)) nombrada = true;
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
