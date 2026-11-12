// Operaciones de archivo (T15a): Guardar, Guardar como, Abrir y Nuevo. Las
// dependencias (archivos, editores, diálogos, avisos, reloj) llegan de
// afuera, así la lógica se prueba sin DOM y sin saber si corre en el
// escritorio o en el navegador. También van acá, como funciones puras, los
// atajos de archivo, las teclas de recarga, el título de la ventana y el
// recorte de la lista de problemas.
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
// El tiempo del aviso (D20) va de serializar al fin de la escritura, sin lo
// que se tarda en el diálogo de dónde guardar.
//
// En una escena del banco (D17), Guardar guarda esa escena, siempre pregunta
// dónde y no cambia el archivo actual ni la marca del documento.
//
// Abrir, paso a paso:
// 1. Si hay otra operación en curso, o se está en Simular o en el banco
//    (D17), nada. El panel confirma lo escrito.
// 2. Si hay cambios, el diálogo "Guardar / No guardar / Cancelar" (D13-A).
//    Guardar sigue solo si quedó guardado (y no cambió mientras se escribía).
// 3. Se recuerda el contador de cambios y se pide el archivo. Cancelar
//    termina sin cambios.
// 4. Recién con el archivo elegido empieza la operación: en el navegador, el
//    selector puede no avisar que se canceló y la marca quedaría trabada.
// 5. Si pasa el tope, se rechaza sin leerlo. Se lee, se desempaqueta y se
//    deserializa. Con errores, "No se pudo abrir" y el documento actual no
//    se toca.
// 6. Si el documento cambió, o se pasó a Simular o al banco, se cancela con
//    un aviso.
// 7. Se reemplaza el editor (historial vacío, D19-A) y el archivo pasa a ser
//    el actual. Los avisos del archivo se muestran una vez, y al primer
//    cuadro dibujado sale "Abierto" (con el tiempo desde la lectura, sin el
//    diálogo, D20).
//
// Nuevo: los pasos 1 y 2 y un documento vacío, sin archivo actual.
//
// Cerrar la ventana (D14-A, `antesDeCerrar`): con cambios en el documento,
// el mismo diálogo. "Guardar" guarda el documento, también si se está viendo
// una escena del banco, y se cierra solo si quedó guardado y sin cambios.

import { deserializar, serializar, type ProblemaArchivo } from "../core/io";
import type { Documento } from "../core/model/documento";
import type { MarcaGuardado } from "../core/model/historial";
import { letra } from "../editor/atajos";
import { documentoNuevo } from "../editor/editor";
import type { ArchivoElegido, Archivos, Destino } from "./archivos";
import { desempaquetar, empaquetar, MENSAJES, nombreArchivo, TOPE_BYTES } from "./brn";

export type AccionArchivo = "nuevo" | "abrir" | "guardar" | "guardarComo";

/** Respuesta del diálogo de cambios sin guardar (D13-A). */
export type RespuestaSinGuardar = "guardar" | "noGuardar" | "cancelar";

/** Lo que las operaciones usan de un Editor. */
export interface EditorArchivo {
  readonly documento: Documento;
  tomarMarca(): MarcaGuardado;
  marcarGuardado(marca: MarcaGuardado): void;
}

/** Lo que Abrir y Nuevo usan del editor del documento. */
export interface EditorDocumento extends EditorArchivo {
  /** Tiene cambios sin guardar. */
  readonly modificado: boolean;
  /** Sube con cada cambio del documento: si cambió mientras se elegía el archivo, Abrir se cancela. */
  readonly cambios: number;
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
  /**
   * El editor del documento, si Abrir y Nuevo pueden reemplazarlo ahora; null
   * en Simular o mientras se ve una escena del banco (D17).
   */
  reemplazable(): EditorDocumento | null;
  /** El editor del documento, siempre (aunque se vea una escena del banco): lo guarda el cierre. */
  documento(): EditorDocumento;
  /** Pone este documento en un editor nuevo (D19-A). Se cumple con el primer cuadro dibujado. */
  reemplazar(documento: Documento): Promise<void>;
  /** Diálogo de cambios sin guardar del documento `nombre` (D13-A). */
  preguntarSinGuardar(nombre: string): Promise<RespuestaSinGuardar>;
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
  noSePudoAbrir: "No se pudo abrir",
  seAbrioConAvisos: "Se abrió con avisos",
} as const;

/** Avisos de la barra de estado cuando Abrir se cancela solo. */
export const AVISOS_ABRIR = {
  documentoCambio: "El documento cambió: se canceló abrir",
  cambioModo: "Se canceló abrir: se cambió de modo o de escena",
  otraOperacion: "Se canceló abrir: hay otra operación de archivo en curso",
} as const;

/** Aviso de la barra de estado cuando no se puede cerrar la ventana. */
export const AVISO_CERRAR_EN_CURSO = "No se puede cerrar: hay una operación de archivo en curso";

export class OperacionesArchivo {
  /** Archivo donde Guardar escribe sin preguntar; null en un documento nuevo. */
  private _archivoActual: Destino | null = null;
  private _enCurso = false;
  /** El diálogo de cambios sin guardar está abierto: otra Abrir o Nuevo no hace nada. */
  private preguntando = false;
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
    return this.escribir(mostrado.editor, mostrado.esDocumento, como);
  }

  /**
   * Cerrar la ventana (D14-A): true si se puede cerrar. Con cambios en el
   * documento, el diálogo; "Guardar" guarda el documento (aunque se vea una
   * escena del banco) y se cierra solo si quedó guardado y sin cambios. Con
   * una operación en curso no se cierra.
   */
  async antesDeCerrar(): Promise<boolean> {
    // El diálogo ya está abierto (otro pedido de cierre, o Abrir o Nuevo): que se responda ese.
    if (this.preguntando) return false;
    if (this._enCurso) {
      this.deps.avisar(AVISO_CERRAR_EN_CURSO);
      return false;
    }
    this.deps.confirmarPanel();
    const editor = this.deps.documento();
    if (!editor.modificado) return true;
    this.preguntando = true;
    let respuesta: RespuestaSinGuardar;
    try {
      respuesta = await this.deps.preguntarSinGuardar(nombreDocumento(this._archivoActual?.nombre ?? null, editor.documento.meta.titulo));
    } finally {
      this.preguntando = false;
    }
    if (respuesta === "cancelar" || this.deps.documento() !== editor) return false;
    if (respuesta === "noGuardar") return true;
    if (this._enCurso) {
      this.deps.avisar(AVISO_CERRAR_EN_CURSO);
      return false;
    }
    return (await this.escribir(editor, true, false)) && !editor.modificado;
  }

  /** Pasos 2 a 7 de Guardar, sobre este editor. */
  private async escribir(editor: EditorArchivo, esDocumento: boolean, como: boolean): Promise<boolean> {
    this.empezar();
    try {
      const inicio = this.deps.ahora();
      const texto = serializar(editor.documento);
      const marca = editor.tomarMarca();
      const prueba = deserializar(texto);
      if (!prueba.ok) {
        this.deps.mostrarProblemas(TITULOS.noSePuedeGuardar, prueba.errores);
        return false;
      }
      const { bytes, comprimido } = await empaquetar(texto);
      // D20: el tiempo se corta durante el diálogo de dónde guardar.
      let ms = this.deps.ahora() - inicio;
      let destino = esDocumento && !como ? this._archivoActual : null;
      if (!destino) {
        destino = await this.deps.archivos.elegirDestino(nombreArchivo(editor.documento.meta.titulo));
        if (!destino) return false;
      }
      const escribiendo = this.deps.ahora();
      await this.deps.archivos.guardar(destino, bytes);
      ms = Math.round(ms + this.deps.ahora() - escribiendo);
      if (esDocumento) {
        this._archivoActual = destino;
        editor.marcarGuardado(marca);
      }
      this.deps.avisar(avisoGuardado(comprimido, this.deps.medir ? ms : null));
      return true;
    } catch (e) {
      this.deps.mostrarProblemas(TITULOS.noSePudoGuardar, [{ donde: "", mensaje: textoError(e, "escribir") }]);
      return false;
    } finally {
      this.terminar();
    }
  }

  /** Abrir (Ctrl+O): pide un archivo, lo valida y reemplaza el documento. */
  async abrir(): Promise<void> {
    const editor = await this.antesDeReemplazar();
    if (!editor) return;
    const cambios = editor.cambios;
    let elegido: ArchivoElegido | null;
    try {
      elegido = await this.deps.archivos.elegirParaAbrir();
    } catch (e) {
      this.deps.mostrarProblemas(TITULOS.noSePudoAbrir, [{ donde: "", mensaje: textoError(e, "leer") }]);
      return;
    }
    if (!elegido) return;
    if (this._enCurso) {
      this.deps.avisar(AVISOS_ABRIR.otraOperacion);
      return;
    }
    this.empezar();
    let abierto: { cuadro: Promise<void>; avisos: readonly ProblemaArchivo[]; inicio: number } | null = null;
    try {
      abierto = await this.cargar(elegido, editor, cambios);
    } catch (e) {
      this.deps.mostrarProblemas(TITULOS.noSePudoAbrir, [{ donde: "", mensaje: textoError(e, "abrir") }]);
    } finally {
      this.terminar();
    }
    if (!abierto) return;
    if (abierto.avisos.length > 0) this.deps.mostrarProblemas(TITULOS.seAbrioConAvisos, abierto.avisos);
    // Fuera de la operación: si el cuadro tardara (una ventana oculta), no traba las demás.
    await abierto.cuadro;
    const ms = Math.round(this.deps.ahora() - abierto.inicio);
    this.deps.avisar(avisoAbierto(this.deps.medir ? ms : null));
  }

  /** Nuevo (Ctrl+N o el botón): documento vacío, sin archivo actual. */
  async nuevo(): Promise<void> {
    const editor = await this.antesDeReemplazar();
    if (!editor || this._enCurso) return;
    void this.deps.reemplazar(documentoNuevo());
    this._archivoActual = null;
    this.alCambiar?.();
  }

  /**
   * Pasos 5 a 7 de Abrir, con la operación en curso. Devuelve null si no se
   * abrió (los errores ya se mostraron). El tiempo se mide desde antes de
   * leer: cuenta la lectura del disco, no el diálogo (D20).
   */
  private async cargar(
    elegido: ArchivoElegido,
    editor: EditorDocumento,
    cambios: number,
  ): Promise<{ cuadro: Promise<void>; avisos: readonly ProblemaArchivo[]; inicio: number } | null> {
    if (elegido.tamano > TOPE_BYTES) {
      this.deps.mostrarProblemas(TITULOS.noSePudoAbrir, [{ donde: "", mensaje: MENSAJES.grande }]);
      return null;
    }
    const inicio = this.deps.ahora();
    let bytes: Uint8Array;
    try {
      bytes = await elegido.leer();
    } catch (e) {
      this.deps.mostrarProblemas(TITULOS.noSePudoAbrir, [{ donde: "", mensaje: textoError(e, "leer") }]);
      return null;
    }
    const paquete = await desempaquetar(bytes);
    if (!paquete.ok) {
      this.deps.mostrarProblemas(TITULOS.noSePudoAbrir, [{ donde: "", mensaje: paquete.error }]);
      return null;
    }
    const r = deserializar(paquete.texto);
    if (!r.ok) {
      this.deps.mostrarProblemas(TITULOS.noSePudoAbrir, r.errores);
      return null;
    }
    const ahora = this.deps.reemplazable();
    if (!ahora) {
      this.deps.avisar(AVISOS_ABRIR.cambioModo);
      return null;
    }
    if (ahora !== editor || ahora.cambios !== cambios) {
      this.deps.avisar(AVISOS_ABRIR.documentoCambio);
      return null;
    }
    const cuadro = this.deps.reemplazar(r.documento);
    this._archivoActual = { nombre: elegido.nombre, ruta: elegido.ruta };
    return { cuadro, avisos: r.avisos, inicio };
  }

  /**
   * Primeros pasos de Abrir y Nuevo: bloqueos, el panel confirma y, si hay
   * cambios, el diálogo (D13-A). Devuelve el editor del documento si se
   * sigue, o null.
   */
  private async antesDeReemplazar(): Promise<EditorDocumento | null> {
    if (this._enCurso || this.preguntando || !this.deps.reemplazable()) return null;
    this.deps.confirmarPanel();
    const editor = this.deps.reemplazable();
    if (!editor || !editor.modificado) return editor;
    this.preguntando = true;
    let respuesta: RespuestaSinGuardar;
    try {
      respuesta = await this.deps.preguntarSinGuardar(nombreDocumento(this._archivoActual?.nombre ?? null, editor.documento.meta.titulo));
    } finally {
      this.preguntando = false;
    }
    if (respuesta === "cancelar" || this.deps.reemplazable() !== editor) return null;
    // Si no quedó guardado (cancelado, error, D22-B, o cambió mientras se escribía), termina.
    if (respuesta === "guardar" && (!(await this.guardar()) || editor.modificado)) return null;
    return this.deps.reemplazable() === editor ? editor : null;
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

/** Aviso de la barra de estado al abrir; con `ms`, dice el tiempo hasta el primer cuadro (D20). */
export function avisoAbierto(ms: number | null): string {
  return ms === null ? "Abierto" : `Abierto en ${ms} ms`;
}

function textoError(e: unknown, accion: "escribir" | "leer" | "abrir"): string {
  const t = e instanceof Error ? e.message : String(e);
  return t.trim() === "" ? `Error desconocido al ${accion} el archivo` : t;
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
 * Nombre del documento, el mismo en el título de la ventana y en el diálogo
 * de cambios sin guardar: el del archivo actual o, si no hay, el que se
 * sugiere al guardar (`nombreArchivo` del título: "Sin título.brn").
 */
export function nombreDocumento(archivo: string | null, titulo: string): string {
  return archivo ?? nombreArchivo(titulo);
}

/**
 * Título de la ventana (D18-B): `<marca><nombre> — Bornera`, con el nombre
 * de `nombreDocumento`; la marca `• ` va adelante si hay cambios sin guardar.
 */
export function tituloVentana(estado: { archivo: string | null; titulo: string; modificado: boolean }): string {
  return `${estado.modificado ? "• " : ""}${nombreDocumento(estado.archivo, estado.titulo)} — Bornera`;
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
