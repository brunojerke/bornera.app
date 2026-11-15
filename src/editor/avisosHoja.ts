// Validaciones de la hoja en memoria (T19): los avisos de cada componente y
// cada cable, y la cuenta por severidad. Las reglas son del núcleo
// (src/core/model/validaciones.ts); acá se guardan y se ponen al día.
//
// Se pone al día solo con cada comando (ejecutar, agrupar, deshacer, rehacer:
// el editor llama a `reflejar` con los ids del cambio), nunca al mover el
// mouse, durante un arrastre ni al dibujar un cuadro. Cada parte se recalcula
// solo si el cambio la puede mover:
// - R1 a R5 y R9 (etiquetas), una pasada por la hoja, solo si el cambio
//   agrega o borra un componente, o le cambia la etiqueta o el tipo. Mover,
//   girar o espejar no la recorren (ajuste (a) de Bruno en la etapa 2).
// - R6, con `redes()`, solo si hay un auxiliar NC con la etiqueta de una
//   bobina y cambió lo que une la hoja: algún extremo de cable (a qué borne,
//   cable o nada llega) o las etiquetas.
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
import { contarAvisos, hayCandidatosR6, textoAviso, validar, type Aviso, type Regla } from "../core/model/validaciones";
import { buscarSimbolo } from "../core/symbols";
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

/** Lo que cuenta de un componente para las reglas de etiqueta: tipo y etiqueta. */
function firmaComponente(c: Componente): string {
  return `${c.tipo}\u0000${c.etiqueta}`;
}

/** Lo que une un extremo: el borne, el cable de la T o nada. Las coordenadas no cuentan. */
function firmaExtremo(e: Extremo): string {
  return e.tipo === "borne" ? `b\u0000${e.comp}\u0000${e.borne}` : e.tipo === "cable" ? `c\u0000${e.cable}` : "l";
}

/** Lo que cuenta de un cable para R6, R7 y R8: a qué llegan sus extremos. */
interface DatosCable {
  firma: string;
  /** Componentes a cuyos bornes llega. */
  comps: readonly string[];
}

function datosCable(w: Cable): DatosCable {
  const comps: string[] = [];
  if (w.desde.tipo === "borne") comps.push(w.desde.comp);
  if (w.hasta.tipo === "borne" && w.hasta.comp !== comps[0]) comps.push(w.hasta.comp);
  return { firma: `${firmaExtremo(w.desde)}\u0001${firmaExtremo(w.hasta)}`, comps };
}

function mismos(a: readonly Aviso[], b: readonly Aviso[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.regla !== y.regla || x.severidad !== y.severidad || textoAviso(x) !== textoAviso(y)) return false;
  }
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
}

export class AvisosHoja {
  /** R1 a R5 y R9 por componente, en el orden de las reglas. */
  private etiqueta = new Map<string, Aviso[]>();
  /** R6 por componente. */
  private r6 = new Map<string, Aviso>();
  /** R7 por componente: un aviso por borne sin cable, en el orden de su definición. */
  private readonly r7 = new Map<string, Aviso[]>();
  /** R8 por cable. */
  private readonly r8 = new Map<string, Aviso>();
  /** Tipo y etiqueta de cada componente en el último cálculo. */
  private readonly firmas = new Map<string, string>();
  /** A qué llega cada cable en el último cálculo. */
  private readonly cables = new Map<string, DatosCable>();
  /** Contorno de cada id antes de recalcular etiquetas o R6, solo de los que cambian. */
  private readonly conContornoAntes = new Map<string, boolean>();
  /** Si hay un auxiliar NC con la etiqueta de una bobina (R6 puede dar algo). */
  private candidatosR6 = false;
  private _errores = 0;
  private _avisos = 0;
  private _pasadasEtiqueta = 0;
  private _pasadasR6 = 0;
  private _msUltimaR6 = 0;
  private _bornesRevisados = 0;

  constructor(
    private readonly doc: Documento,
    private readonly hoja: number,
    private readonly bornesConCable: BornesConCable,
  ) {
    const h = this.hojaActual();
    if (!h) return;
    for (const c of h.componentes) {
      this.firmas.set(c.id, firmaComponente(c));
      this.ponerR7(c.id, c);
    }
    for (const w of h.cables) {
      this.cables.set(w.id, datosCable(w));
      if (w.desde.tipo === "libre" || w.hasta.tipo === "libre") this.ponerR8(w.id, true);
    }
    this.calcularEtiquetas(h);
    this.calcularR6(h);
    this.conContornoAntes.clear();
  }

  // ── Consultas ──────────────────────────────────────────────────────────

  /** Errores y avisos de la hoja. */
  get cuenta(): { errores: number; avisos: number } {
    return { errores: this._errores, avisos: this._avisos };
  }

  /** Pasadas por la hoja de las reglas de etiqueta (para los tests de que no recalcula de más). */
  get pasadasEtiqueta(): number {
    return this._pasadasEtiqueta;
  }

  /** Veces que se calculó R6 (con `redes()`). */
  get pasadasR6(): number {
    return this._pasadasR6;
  }

  /**
   * ms de la última pasada de R6 (`validar` con R6, que llama a `redes()`), 0
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

    // Componentes: agregados, borrados o con otro tipo o etiqueta.
    let etiquetas = false;
    const r7 = new Set<string>();
    for (const id of cambio.componentes) {
      const c = cambio.actuales.get(id);
      const vieja = this.firmas.get(id);
      const nueva = c ? firmaComponente(c) : undefined;
      if (vieja === nueva) continue;
      etiquetas = true;
      if (nueva === undefined) this.firmas.delete(id);
      else this.firmas.set(id, nueva);
      // El borne de otro tipo, o de un componente que ya no está.
      if (!c || vieja === undefined || vieja.split("\u0000")[0] !== c.tipo) r7.add(id);
    }

    // Cables: agregados, borrados o con otros extremos.
    let une = false;
    for (const id of cambio.cables) {
      const w = cambio.actualesCables.get(id);
      const viejos = this.cables.get(id);
      const nuevos = w ? datosCable(w) : undefined;
      if (viejos?.firma === nuevos?.firma) continue;
      une = true;
      for (const comp of viejos?.comps ?? []) r7.add(comp);
      for (const comp of nuevos?.comps ?? []) r7.add(comp);
      if (nuevos) this.cables.set(id, nuevos);
      else this.cables.delete(id);
      const libre = w !== undefined && (w.desde.tipo === "libre" || w.hasta.tipo === "libre");
      if (this.ponerR8(id, libre)) ids.add(id);
    }

    for (const id of r7) {
      if (this.ponerR7(id, cambio.componente(id))) ids.add(id);
    }

    if (etiquetas) {
      for (const id of this.calcularEtiquetas(h)) {
        ids.add(id);
        contornos.add(id);
      }
    }
    if (etiquetas || une) {
      for (const id of this.calcularR6(h)) {
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

  /** R1 a R5 y R9: una pasada por la hoja. Devuelve los ids cuyos avisos cambiaron. */
  private calcularEtiquetas(h: Hoja): Set<string> {
    this._pasadasEtiqueta++;
    const nuevos = new Map<string, Aviso[]>();
    for (const a of validar(h, ETIQUETA)) {
      let l = nuevos.get(a.id);
      if (!l) nuevos.set(a.id, (l = []));
      l.push(a);
    }
    this.candidatosR6 = hayCandidatosR6(h);
    const cambiados = new Set<string>();
    const revisar = (id: string) => {
      const viejos = this.etiqueta.get(id) ?? NINGUNO;
      const actuales = nuevos.get(id) ?? NINGUNO;
      if (mismos(viejos, actuales)) return;
      cambiados.add(id);
      if (!this.conContornoAntes.has(id)) this.conContornoAntes.set(id, viejos.length > 0 || this.r6.has(id));
      this.contar(viejos, -1);
      this.contar(actuales, 1);
    };
    for (const id of this.etiqueta.keys()) revisar(id);
    for (const id of nuevos.keys()) if (!this.etiqueta.has(id)) revisar(id);
    this.etiqueta = nuevos;
    return cambiados;
  }

  /** R6, con `redes()`, solo si hay candidatos. Devuelve los ids cuyo R6 cambió. */
  private calcularR6(h: Hoja): Set<string> {
    const nuevos = new Map<string, Aviso>();
    if (this.candidatosR6) {
      this._pasadasR6++;
      const t0 = performance.now();
      for (const a of validar(h, SOLO_R6)) nuevos.set(a.id, a);
      this._msUltimaR6 = performance.now() - t0;
    }
    const cambiados = new Set<string>();
    const revisar = (id: string) => {
      const viejo = this.r6.get(id);
      const actual = nuevos.get(id);
      if (viejo === undefined && actual === undefined) return;
      if (viejo && actual && mismos([viejo], [actual])) return;
      cambiados.add(id);
      if (!this.conContornoAntes.has(id)) this.conContornoAntes.set(id, viejo !== undefined || this.etiqueta.has(id));
      if (viejo) this.contar([viejo], -1);
      if (actual) this.contar([actual], 1);
    };
    for (const id of this.r6.keys()) revisar(id);
    for (const id of nuevos.keys()) if (!this.r6.has(id)) revisar(id);
    this.r6 = nuevos;
    return cambiados;
  }
}
