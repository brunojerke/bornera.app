// Sesión de Simular (T32, E-A; docs/plan-T32.md): una entrada a Simular sobre
// la hoja del Editor, con lo que tiene apretado el puntero. La tiene el
// Editor; Ventana pide entrar y salir.
//
// - No es documento (plan de la fase, sección 2): sin Comandos, ni `.brn`, ni
//   historial, ni autoguardado. Salir la descarta, también con algo apretado.
// - Pulsar (D5-B): el botón del mouse apretado sobre un pulsador lo mantiene
//   apretado hasta soltar el botón en cualquier lado o perder la ventana.
//   Mayús+clic lo fija hasta otro clic sobre él. Al perder la ventana (M-A)
//   se suelta el mantenido y los fijados siguen.
// - Detenida (D3-A): los pulsadores no responden hasta salir.
// - Lo que ve el usuario antes de T33 (V-A, AV-A, ajuste 2): los avisos nuevos
//   de cada operación (`nuevos`) y un texto fijo con la detención y los
//   fijados (`textoEstado`).
//
// Sin DOM ni reloj: se prueba en Node.

import type { Hoja } from "../core/model/documento";
import { listaY, type Aviso } from "../core/model/validaciones";
import {
  entrarSimulacion,
  pulsables,
  pulsar,
  soltar,
  textoAvisoSim,
  type AvisoSim,
  type OpcionesSimulacion,
  type Simulacion,
} from "../core/sim/motor";

export type EntradaSesion = { readonly ok: true; readonly sesion: SesionSimulacion } | { readonly ok: false; readonly errores: readonly Aviso[] };

/** Texto de la barra cuando F5 no entra (D4-A): las etiquetas repetidas que lo impiden. */
export function textoNoSimula(errores: readonly Aviso[]): string {
  const etiquetas = [...new Set(errores.flatMap((a) => (a.regla === "R4" ? [a.etiqueta] : [])))];
  if (etiquetas.length === 0) return `No se puede simular: ${errores.length === 1 ? "hay un error" : `hay ${errores.length} errores`}`;
  return `No se puede simular: ${listaY(etiquetas)} ${etiquetas.length === 1 ? "está repetida" : "están repetidas"}`;
}

export class SesionSimulacion {
  private _sim: Simulacion;
  private readonly _pulsables: ReadonlySet<string>;
  /** Etiqueta de cada pulsador ("" sin etiqueta), para la barra. */
  private readonly etiquetaDe: ReadonlyMap<string, string>;
  /** El pulsador que tiene apretado el botón del mouse; null si ninguno. */
  private _mantenido: string | null = null;
  /** Los fijados con Mayús+clic, en el orden en que se fijaron. */
  private readonly _fijados = new Set<string>();
  /** Los avisos que sumó la última operación (entrar, presionar o soltar). */
  private _nuevos: AvisoSim[] = [];

  private constructor(sim: Simulacion) {
    this._sim = sim;
    this._pulsables = pulsables(sim.netlist);
    this.etiquetaDe = new Map(sim.netlist.contactos.filter((c) => this._pulsables.has(c.comp)).map((c) => [c.comp, c.etiqueta]));
    this._nuevos = [...sim.nuevos];
  }

  /**
   * Entra a Simular con `hoja` (D4-A): con errores no entra y los devuelve.
   * Es la entrada de F5 y la que mide S1 (S-A); `marcar` como en `entrarSimulacion`.
   */
  static entrar(hoja: Hoja, opciones: OpcionesSimulacion = {}, marcar?: () => void): EntradaSesion {
    const r = entrarSimulacion(hoja, opciones, marcar);
    return r.ok ? { ok: true, sesion: new SesionSimulacion(r.sim) } : { ok: false, errores: r.errores };
  }

  get sim(): Simulacion {
    return this._sim;
  }

  get detenida(): boolean {
    return this._sim.detenida !== null;
  }

  /** El pulsador apretado con el botón; null si ninguno. */
  get mantenido(): string | null {
    return this._mantenido;
  }

  /** Los pulsadores fijados con Mayús+clic, en el orden en que se fijaron. */
  get fijados(): readonly string[] {
    return [...this._fijados];
  }

  /** Los avisos que sumó la última operación. */
  get nuevos(): readonly AvisoSim[] {
    return this._nuevos;
  }

  esPulsable(id: string): boolean {
    return this._pulsables.has(id);
  }

  /**
   * El botón del mouse se aprieta sobre el componente `id`. Un pulsador fijado
   * se suelta (otro clic, con Mayús o sin ella); si no, con Mayús se fija y
   * sin ella se mantiene hasta `soltarBoton`. Devuelve si algo cambió:
   * detenida, o si `id` no es un pulsador, no hace nada.
   */
  presionar(id: string, mayus: boolean): boolean {
    this._nuevos = [];
    if (this.detenida || !this._pulsables.has(id)) return false;
    // Un apretar con otro ya mantenido (el soltar se perdió): primero se suelta aquel.
    if (this._mantenido !== null) this.soltarMantenido();
    if (this._fijados.has(id)) {
      this._fijados.delete(id);
      this.aplicar(soltar(this._sim, id));
    } else if (mayus) {
      this._fijados.add(id);
      this.aplicar(pulsar(this._sim, id));
    } else {
      this._mantenido = id;
      this.aplicar(pulsar(this._sim, id));
    }
    return true;
  }

  /** Se soltó el botón del mouse (en cualquier lado): vuelve el mantenido. Devuelve si había uno. */
  soltarBoton(): boolean {
    this._nuevos = [];
    if (this._mantenido === null) return false;
    this.soltarMantenido();
    return true;
  }

  /** La ventana perdió el foco (M-A): se suelta el mantenido y los fijados siguen. */
  perderVentana(): boolean {
    return this.soltarBoton();
  }

  /**
   * Texto fijo de la barra (AV-A y ajuste 2): la detención y los fijados, o
   * null si no hay ninguno de los dos.
   */
  textoEstado(): string | null {
    const partes: string[] = [];
    const d = this._sim.detenida;
    if (d) partes.push(`Simulación detenida: ${textoAvisoSim(d)} · F5 vuelve a Editar`);
    if (this._fijados.size > 0) partes.push(`Fijados: ${listaY(this.fijados.map((id) => this.etiquetaDe.get(id) || "sin etiqueta"))}`);
    return partes.length > 0 ? partes.join(" · ") : null;
  }

  /** Los avisos nuevos de la última operación, en una línea para `avisar`; null si no hay. */
  textoNuevos(): string | null {
    return this._nuevos.length > 0 ? this._nuevos.map(textoAvisoSim).join(" · ") : null;
  }

  private soltarMantenido(): void {
    const id = this._mantenido!;
    this._mantenido = null;
    this.aplicar(soltar(this._sim, id));
  }

  private aplicar(sim: Simulacion): void {
    this._sim = sim;
    this._nuevos.push(...sim.nuevos);
  }
}
