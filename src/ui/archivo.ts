// Operaciones de archivo (T15a): Guardar y Guardar como. Las dependencias
// (archivos, editores, diálogos, avisos, reloj) llegan de afuera, así la
// lógica se prueba sin DOM y sin saber si corre en el escritorio o en el
// navegador. También van acá, como funciones puras, los atajos de archivo,
// las teclas de recarga, el título de la ventana y el recorte de la lista
// de problemas.
//
// Guardar, paso a paso:
// 1. Si hay otra operación en curso, nada. El panel confirma lo escrito.
// 2. Se serializa y se toma la marca, en el mismo instante.
// 3. El texto pasa por `deserializar` (D22-B): si no abriría, se muestran los
//    problemas y no se escribe ni se marca. Los avisos solos no frenan.
// 4. Se empaqueta (gzip).
// 5. Con archivo actual, se pisa; si no (o en Guardar como, o en una escena
//    del banco), se pide dónde. Cancelar termina sin cambios.
// 6. Si se escribió: queda como archivo actual, se aplica la marca y sale el
//    aviso. Si falló: el error en un diálogo, y nada cambia.
// 7. La operación termina siempre, también ante un error.
//
// En una escena del banco (D17), Guardar guarda esa escena, siempre pregunta
// dónde y no cambia el archivo actual ni la marca del documento.

import { deserializar, serializar, type ProblemaArchivo } from "../core/io";
import type { Documento } from "../core/model/documento";
import type { MarcaGuardado } from "../core/model/historial";
import { letra } from "../editor/atajos";
import type { Archivos, Destino } from "./archivos";
import { empaquetar, nombreArchivo } from "./brn";

export type AccionArchivo = "nuevo" | "abrir" | "guardar" | "guardarComo";

/** Lo que las operaciones usan de un Editor. */
export interface EditorArchivo {
  readonly documento: Documento;
  tomarMarca(): MarcaGuardado;
  marcarGuardado(marca: MarcaGuardado): void;
}

/** Lo que se ve en el lienzo y se puede guardar. */
export interface Mostrado {
  editor: EditorArchivo;
  /** Es el documento (no una escena del banco). */
  esDocumento: boolean;
}

export interface DependenciasArchivo {
  archivos: Archivos;
  /** Lo que se ve y se guarda; null si lo que se ve no se guarda (escenas sin editor). */
  mostrado(): Mostrado | null;
  /** El panel de propiedades confirma lo que se esté escribiendo. */
  confirmarPanel(): void;
  /** Diálogo con una lista de problemas ("No se puede guardar"…). */
  mostrarProblemas(titulo: string, problemas: readonly ProblemaArchivo[]): void;
  /** Aviso de la barra de estado. */
  avisar(texto: string): void;
  /** Milisegundos, para medir (performance.now). */
  ahora(): number;
  /** Los avisos dicen el tiempo (en desarrollo y en las prereleases, D20). */
  medir: boolean;
}

/** Títulos de los diálogos de archivo. */
export const TITULOS = {
  noSePuedeGuardar: "No se puede guardar",
  noSePudoGuardar: "No se pudo guardar",
} as const;

export class OperacionesArchivo {
  /** Archivo donde Guardar escribe sin preguntar; null en un documento nuevo. */
  private _archivoActual: Destino | null = null;
  private _enCurso = false;
  /** Se avisa cuando cambia el archivo actual o si hay una operación en curso. */
  alCambiar: (() => void) | null = null;

  constructor(private readonly deps: DependenciasArchivo) {}

  get archivoActual(): Destino | null {
    return this._archivoActual;
  }

  /** Hay una operación de archivo en curso: las cuatro acciones no hacen nada. */
  get enCurso(): boolean {
    return this._enCurso;
  }

  /**
   * Guardar (Ctrl+S) o, con `como`, Guardar como (Ctrl+Mayús+S). Devuelve si
   * quedó guardado (para el diálogo de cambios sin guardar).
   */
  async guardar(como = false): Promise<boolean> {
    if (this._enCurso) return false;
    const mostrado = this.deps.mostrado();
    if (!mostrado) return false;
    this.deps.confirmarPanel();
    this.empezar();
    try {
      const { editor, esDocumento } = mostrado;
      const inicio = this.deps.ahora();
      const texto = serializar(editor.documento);
      const marca = editor.tomarMarca();
      const prueba = deserializar(texto);
      if (!prueba.ok) {
        this.deps.mostrarProblemas(TITULOS.noSePuedeGuardar, prueba.errores);
        return false;
      }
      const { bytes, comprimido } = await empaquetar(texto);
      const actual = esDocumento && !como ? this._archivoActual : null;
      let destino: Destino | null = actual;
      if (actual) await this.deps.archivos.guardar(actual, bytes);
      else destino = await this.deps.archivos.guardarComo(bytes, nombreArchivo(editor.documento.meta.titulo));
      if (!destino) return false;
      const ms = Math.round(this.deps.ahora() - inicio);
      if (esDocumento) {
        this._archivoActual = destino;
        editor.marcarGuardado(marca);
      }
      this.deps.avisar(avisoGuardado(comprimido, this.deps.medir ? ms : null));
      return true;
    } catch (e) {
      this.deps.mostrarProblemas(TITULOS.noSePudoGuardar, [{ donde: "", mensaje: textoError(e) }]);
      return false;
    } finally {
      this.terminar();
    }
  }

  private empezar(): void {
    this._enCurso = true;
    this.alCambiar?.();
  }

  private terminar(): void {
    this._enCurso = false;
    this.alCambiar?.();
  }
}

/** Aviso de la barra de estado al guardar; con `ms`, dice el tiempo (D20). */
export function avisoGuardado(comprimido: boolean, ms: number | null): string {
  const base = comprimido ? "Guardado" : "Guardado sin comprimir";
  return ms === null ? base : `${base} en ${ms} ms`;
}

function textoError(e: unknown): string {
  const t = e instanceof Error ? e.message : String(e);
  return t.trim() === "" ? "Error desconocido al escribir el archivo" : t;
}

// ── Teclas ─────────────────────────────────────────────────────────────────

type TeclaEvento = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey">;

/**
 * Atajo de archivo de la tecla: Ctrl+S, Ctrl+Mayús+S, Ctrl+O y Ctrl+N. Null
 * si no es uno. La letra es la impresa en la tecla o, en un teclado no
 * latino, la de la posición física (como los atajos del editor).
 */
export function atajoArchivo(e: TeclaEvento): AccionArchivo | null {
  if (!e.ctrlKey || e.altKey || e.metaKey) return null;
  const l = letra(e);
  if (l === "s") return e.shiftKey ? "guardarComo" : "guardar";
  if (e.shiftKey) return null;
  if (l === "o") return "abrir";
  if (l === "n") return "nuevo";
  return null;
}

/**
 * Si un atajo de archivo actúa ahora. La tecla es nuestra siempre
 * (preventDefault), pero no actúa si se repite al mantenerla, con un diálogo
 * modal abierto ni durante un gesto del puntero. La operación en curso la
 * mira `OperacionesArchivo`.
 */
export function atajoArchivoActua(estado: { repetida: boolean; modal: boolean; gesto: boolean }): boolean {
  return !estado.repetida && !estado.modal && !estado.gesto;
}

/**
 * Teclas que recargan la página: Ctrl+R, Ctrl+Mayús+R, Ctrl+F5 y Mayús+F5
 * (con o sin la otra). En la app compilada se anulan (D15-C); en desarrollo
 * quedan para recargar. F5 solo es Editar/Simular (modo.ts).
 */
export function esTeclaRecarga(e: TeclaEvento): boolean {
  if (e.altKey || e.metaKey) return false;
  if (e.key === "F5") return e.ctrlKey || e.shiftKey;
  return e.ctrlKey && letra(e) === "r";
}

// ── Título y problemas ─────────────────────────────────────────────────────

/**
 * Título de la ventana (D18-B): `<marca><nombre> — Bornera`. El nombre es el
 * del archivo actual o, si no hay, el título del documento; la marca `• `
 * va adelante si hay cambios sin guardar.
 */
export function tituloVentana(estado: { archivo: string | null; titulo: string; modificado: boolean }): string {
  return `${estado.modificado ? "• " : ""}${estado.archivo ?? estado.titulo} — Bornera`;
}

/** Cuántas líneas muestra el diálogo de problemas; el resto va como "y N más". */
export const LINEAS_DIALOGO = 10;

/** El "y N más" con que `deserializar` cierra una lista recortada. */
const SOBRAN = /^y (\d+) más$/;

/**
 * Líneas del diálogo de problemas: `donde: mensaje` (o solo el mensaje),
 * hasta `max`, y "y N más" con los que no entran. Si la lista ya venía
 * recortada (`deserializar` lista hasta 20 y cierra con "y N más"), esos N
 * se suman.
 */
export function lineasProblemas(problemas: readonly ProblemaArchivo[], max = LINEAS_DIALOGO): string[] {
  let lista = problemas;
  let sobran = 0;
  const ultimo = problemas.at(-1);
  const m = ultimo && ultimo.donde === "" ? SOBRAN.exec(ultimo.mensaje) : null;
  if (m) {
    lista = problemas.slice(0, -1);
    sobran = Number(m[1]);
  }
  const lineas = lista.slice(0, max).map((p) => (p.donde === "" ? p.mensaje : `${p.donde}: ${p.mensaje}`));
  sobran += lista.length - lineas.length;
  if (sobran > 0) lineas.push(`y ${sobran} más`);
  return lineas;
}
