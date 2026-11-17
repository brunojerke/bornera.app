// Autoguardado (T23, D2b-C; docs/plan-T23.md, secciones 3 y 4): cuándo sale
// la copia de recuperación del documento y cuándo se borra.
//
// Relojes: con cambios sin copiar, la copia sale a los 10 s sin comandos o a
// los 60 s del primer cambio sin copiar, lo que llegue antes. Hay un solo
// temporizador, que se rearma con cada cambio; sin cambios sin copiar no hay
// ninguno. Lo que cambia mientras se copia arranca otro ciclo.
//
// La copia va por partes (copiaPorPartes.ts). Cada ocio pasa antes por
// «ocupado» (D1: un gesto, la previa de pegar o de colocar, un tramo de
// cable, «Probar»): si lo está, se vuelve a mirar en 1 s.
//
// Borrados (D2e y D2-A): cuando el documento queda sin cambios (se guardó,
// se deshizo hasta lo guardado, o Nuevo o Abrir lo reemplazaron), la copia
// propia se borra. Una copia en curso se cancela y no escribe su registro.
// Cerrar la ventana la borra, esperando hasta 1 s. Nunca sola al arrancar.
//
// Si IndexedDB falla: un aviso en la barra, una vez por sesión, y la app
// sigue. Un fallo al escribir reintenta a los 10 s, sin más avisos.
//
// Solo copia el editor del documento: las escenas del banco y «Probar» no
// pasan por acá. Todo llega de afuera, así se prueba sin DOM.

import type { Documento } from "../core/model/documento";
import { copiarPorPartes, pedirOcio as pedirOcioReal, type Ocio, type PedirOcio, type ResultadoCopia } from "./copiaPorPartes";
import { motivoFallo, type AlmacenCopias } from "./respaldo";

/** Sin comandos durante esto, sale la copia (ms). */
export const SIN_COMANDOS_MS = 10_000;
/** Como mucho esto desde el primer cambio sin copiar (ms). */
export const MAXIMO_SIN_COPIA_MS = 60_000;
/** Si está ocupado, se vuelve a mirar en esto (ms). */
export const REINTENTO_OCUPADO_MS = 1_000;
/** Cerrar la ventana espera el borrado de la copia hasta esto (ms). */
export const TOPE_CERRAR_MS = 1_000;

/** El aviso de la barra cuando la copia no se puede hacer (una vez por sesión). */
export const avisoFallo = (e: unknown) => `No se pudo hacer la copia de recuperación: ${motivoFallo(e)}`;

/** Lo que el autoguardado mira del editor del documento. */
export interface EditorCopiable {
  readonly documento: Documento;
  /** Sube con cada comando, deshacer y rehacer. */
  readonly cambios: number;
  /** Difiere de lo último guardado o abierto. */
  readonly modificado: boolean;
}

export interface DependenciasAutoguardado {
  /** Id de esta instancia (dueña de la copia). */
  id: string;
  almacen: AlmacenCopias;
  /** El editor del documento ahora (no el de una escena del banco). */
  editor(): EditorCopiable;
  /** Archivo actual, para el registro. */
  archivo(): { nombre: string; ruta: string | null } | null;
  version: string;
  /** Hay algo que la copia no tiene que interrumpir (D1). */
  ocupado(): boolean;
  /** Aviso de la barra de estado. */
  avisar(texto: string): void;
  /** Milisegundos (performance.now). */
  ahora(): number;
  /** `Date.now()` del registro. */
  fecha?(): number;
  /** setTimeout y clearTimeout. */
  programar(f: () => void, ms: number): unknown;
  cancelar(temporizador: unknown): void;
  pedirOcio?: PedirOcio;
}

export type CopiaHecha = Extract<ResultadoCopia, { ok: true }>;

/** Lo que muestra el menú de desarrollo. */
export interface EstadoAutoguardado {
  hechas: number;
  fallidas: number;
  canceladas: number;
  /** La última copia completa: cuándo (`Date.now`) y cómo salió. */
  ultima: { fecha: number; copia: CopiaHecha } | null;
  /** Salida de emergencia (copias de una vez): cuántas y la más larga (ms). */
  emergencias: number;
  emergenciaMaxMs: number;
  /** Hay una copia propia completa en el almacén. */
  hayCopia: boolean;
  /** Por qué se apagó (no copia más en esta sesión); null si anda. */
  apagado: string | null;
}

export class Autoguardado {
  /** Lo último que quedó copiado: documento y contador de cambios. */
  private copiado: { documento: Documento; cambios: number } | null = null;
  /** Lo último que se vio en `alCambiar`: un aviso sin cambio del documento (un tramo, guardar) no rearma. */
  private visto: { documento: Documento; cambios: number } | null = null;
  private pendienteDesde: number | null = null;
  private ultimoCambio = 0;
  private reloj: unknown = null;
  private enCurso: Promise<void> | null = null;
  private generacion = 0;
  /** Se empezó a escribir algo propio que no se borró. */
  private escribio = false;
  private avisado = false;
  private cerrando = false;
  readonly estado: EstadoAutoguardado = {
    hechas: 0,
    fallidas: 0,
    canceladas: 0,
    ultima: null,
    emergencias: 0,
    emergenciaMaxMs: 0,
    hayCopia: false,
    apagado: null,
  };
  /** Se avisa cuando cambia `estado` (menú de desarrollo). */
  alCambiarEstado: (() => void) | null = null;

  constructor(private readonly deps: DependenciasAutoguardado) {}

  /** Hay un reloj armado: cambios sin copiar esperando. */
  get esperando(): boolean {
    return this.reloj !== null;
  }

  /** Hay una copia en curso. */
  get copiando(): boolean {
    return this.enCurso !== null;
  }

  /**
   * Cambió el historial del documento: un comando, deshacer, rehacer, la
   * marca de guardado u otro documento (Nuevo, Abrir).
   */
  alCambiar(): void {
    if (this.estado.apagado || this.cerrando) return;
    const ed = this.deps.editor();
    if (!ed.modificado) {
      this.visto = null;
      this.pararReloj();
      this.pendienteDesde = null;
      if (this.escribio) void this.borrarPropia();
      return;
    }
    const v = this.visto;
    if (v && v.documento === ed.documento && v.cambios === ed.cambios) return;
    this.visto = { documento: ed.documento, cambios: ed.cambios };
    if (this.estaCopiado(ed)) return;
    const t = this.deps.ahora();
    this.ultimoCambio = t;
    this.pendienteDesde ??= t;
    this.rearmar();
  }

  /**
   * La copia ya, sin esperar los relojes (desarrollo y humo). Pasa igual por
   * el ocio y por «ocupado». Se cumple cuando terminó (o se canceló).
   */
  async copiarYa(): Promise<void> {
    this.pararReloj();
    if (this.enCurso) await this.enCurso;
    await this.copiar();
  }

  /**
   * Una copia propia lo antes posible, como si vencieran los 60 s (después de
   * Recuperar, T23): hasta que quede escrita, la copia ajena recuperada es la
   * única. La copia propia que hubiera era de otro documento.
   */
  copiarPronto(): void {
    if (this.estado.apagado || this.cerrando) return;
    this.estado.hayCopia = false;
    this.copiado = null;
    const t = this.deps.ahora();
    this.ultimoCambio = t - SIN_COMANDOS_MS;
    this.pendienteDesde = t - MAXIMO_SIN_COPIA_MS;
    this.rearmar();
  }

  /**
   * Cerrar la ventana (D2e): no copia más y borra la copia propia, esperando
   * hasta `tope` ms para que un IndexedDB colgado no trabe el cierre.
   */
  async cerrar(tope = TOPE_CERRAR_MS): Promise<void> {
    this.cerrando = true;
    this.pararReloj();
    const borrado = this.deps.almacen.borrar(this.deps.id).catch(() => {});
    let temporizador: unknown = null;
    await Promise.race([borrado, new Promise<void>((r) => (temporizador = this.deps.programar(r, tope)))]);
    this.deps.cancelar(temporizador);
    this.estado.hayCopia = false;
  }

  /** No copia más en esta sesión (la base se cerró, por ejemplo por una versión nueva), con el aviso único. */
  apagar(motivo: string): void {
    this.estado.apagado = motivo;
    this.pararReloj();
    this.avisarUnaVez(motivo);
    this.alCambiarEstado?.();
  }

  // ── Por dentro ───────────────────────────────────────────────────────────

  private estaCopiado(ed: EditorCopiable): boolean {
    return this.copiado !== null && this.copiado.documento === ed.documento && this.copiado.cambios === ed.cambios;
  }

  private pararReloj(): void {
    if (this.reloj !== null) this.deps.cancelar(this.reloj);
    this.reloj = null;
  }

  /** Arma el reloj a lo que llegue antes: 10 s sin comandos o 60 s del primer cambio sin copiar. */
  private rearmar(): void {
    if (this.pendienteDesde === null) return;
    this.pararReloj();
    const vence = Math.min(this.ultimoCambio + SIN_COMANDOS_MS, this.pendienteDesde + MAXIMO_SIN_COPIA_MS);
    this.reloj = this.deps.programar(
      () => {
        this.reloj = null;
        void this.copiar();
      },
      Math.max(0, vence - this.deps.ahora()),
    );
  }

  /** Lo que lee la copia en cada paso: null si ya no va (se guardó, se cierra, se apagó). */
  private fuente(): { documento: Documento; cambios: number } | null {
    if (this.estado.apagado || this.cerrando) return null;
    const ed = this.deps.editor();
    return ed.modificado ? { documento: ed.documento, cambios: ed.cambios } : null;
  }

  /** El ocio, pero no mientras está ocupado: se vuelve a mirar en 1 s. */
  private pedirOcio(cb: (ocio: Ocio) => void): void {
    (this.deps.pedirOcio ?? pedirOcioReal)((ocio) => {
      if (this.deps.ocupado()) this.deps.programar(() => this.pedirOcio(cb), REINTENTO_OCUPADO_MS);
      else cb(ocio);
    });
  }

  private copiar(): Promise<void> {
    if (this.enCurso) return this.enCurso;
    if (!this.fuente()) return Promise.resolve();
    // Lo que cambie desde acá arma otro ciclo (la copia lee el documento recién en su primer paso).
    this.pendienteDesde = null;
    this.escribio = true;
    const tarea = async () => {
      const r = await copiarPorPartes({
        id: this.deps.id,
        almacen: this.deps.almacen,
        fuente: () => this.fuente(),
        generacion: () => ++this.generacion,
        datos: () => ({ archivo: this.deps.archivo(), version: this.deps.version }),
        pedirOcio: (cb) => this.pedirOcio(cb),
        ahora: () => this.deps.ahora(),
        fecha: () => (this.deps.fecha ?? Date.now)(),
      });
      this.trasCopia(r);
    };
    this.enCurso = tarea().finally(() => {
      this.enCurso = null;
      this.revisar();
      this.alCambiarEstado?.();
    });
    return this.enCurso;
  }

  private trasCopia(r: ResultadoCopia): void {
    if (r.ok) {
      this.copiado = { documento: r.documento, cambios: r.cambios };
      this.estado.hechas++;
      this.estado.hayCopia = true;
      this.estado.ultima = { fecha: (this.deps.fecha ?? Date.now)(), copia: r };
      if (r.deUnaVez) {
        this.estado.emergencias++;
        this.estado.emergenciaMaxMs = Math.max(this.estado.emergenciaMaxMs, r.deUnaVezMs);
      }
      return;
    }
    if (r.cancelada) {
      this.estado.canceladas++;
      // Se canceló porque quedó sin cambios: pudo escribir trozos después del borrado.
      if (!this.cerrando && !this.deps.editor().modificado) void this.borrarPropia();
      return;
    }
    this.estado.fallidas++;
    this.avisarUnaVez(avisoFallo(r.error));
    // Reintenta con los mismos relojes, como un cambio de ahora.
    const t = this.deps.ahora();
    this.ultimoCambio = t;
    this.pendienteDesde = t;
  }

  /** Después de una copia: si quedaron cambios sin copiar (llegaron mientras, o falló), arma el reloj. */
  private revisar(): void {
    if (this.estado.apagado || this.cerrando) return;
    const ed = this.deps.editor();
    if (!ed.modificado || this.estaCopiado(ed)) return;
    this.pendienteDesde ??= this.deps.ahora();
    this.rearmar();
  }

  private async borrarPropia(): Promise<void> {
    this.copiado = null;
    this.escribio = false;
    this.estado.hayCopia = false;
    try {
      await this.deps.almacen.borrar(this.deps.id);
    } catch (e) {
      this.avisarUnaVez(avisoFallo(e));
    }
    this.alCambiarEstado?.();
  }

  private avisarUnaVez(texto: string): void {
    if (this.avisado) return;
    this.avisado = true;
    this.deps.avisar(texto);
  }
}
