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
// 4. Con archivo actual, se pisa; si no (o en Guardar como, o en una escena
//    del banco), se pide dónde. Cancelar termina sin cambios.
// 5. Se empaqueta según el nombre del destino (D4-C, T21): `.brn` con gzip,
//    `.brn.json` por líneas y sin comprimir.
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
// Exportar sin comprimir (T21, D4-C): los mismos pasos, siempre pregunta
// dónde (con `.brn.json`) y nunca cambia el archivo actual ni la marca: es
// una copia.
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
// Abrir reciente (T24, D8-A): sin selector. Primero, con los bloqueos del
// paso 1, se mira si el archivo existe (`exists` del plugin fs): si no, un
// aviso, se quita de la lista y no se pregunta nada. Si existe, los pasos 2 y
// 3 con la ruta en lugar del selector, y los pasos 4 a 7 son los mismos de
// Abrir (`abrirElegido`). Abrir, Guardar y Guardar como suman la ruta arriba
// de la lista; Exportar y Recuperar no (no cambian el archivo actual).
//
// Abrir el archivo del argumento (T25, doble clic en un `.brn`): los pasos de
// Abrir reciente, salvo que un archivo que no existe es un error y no toca la
// lista. Si abre, sube en la lista como Abrir. La ventana lo llama al
// arrancar, después de resolver la recuperación.
//
// Nuevo: los pasos 1 y 2 y un documento vacío, sin archivo actual.
//
// Cerrar la ventana (D14-A, `antesDeCerrar`): con cambios en el documento,
// el mismo diálogo. "Guardar" guarda el documento, también si se está viendo
// una escena del banco, y se cierra solo si quedó guardado y sin cambios.

import { deserializar, serializar, serializarPorLineas, type ProblemaArchivo } from "../core/io";
import type { Documento } from "../core/model/documento";
import type { MarcaGuardado } from "../core/model/historial";
import { letra } from "../editor/atajos";
import { documentoNuevo } from "../editor/editor";
import { nombreDeRuta, type ArchivoElegido, type Archivos, type Destino } from "./archivos";
import {
  desempaquetar,
  empaquetar,
  empaquetarPlano,
  formatoDeNombre,
  MENSAJES,
  nombreArchivo,
  TOPE_BYTES,
  type FormatoArchivo,
} from "./brn";

/** Acciones de archivo de la barra. Exportar no tiene atajo (T21, D4). */
export type AccionArchivo = "nuevo" | "abrir" | "guardar" | "guardarComo" | "exportar";

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
  /**
   * Pone este documento en un editor nuevo (D19-A). Se cumple con el primer
   * cuadro dibujado. Con `modificado`, el editor arranca con cambios sin
   * guardar y sin nada que deshacer (una copia recuperada, T23).
   */
  reemplazar(documento: Documento, opciones?: { modificado?: boolean }): Promise<void>;
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
  /** Abrir reciente (T24): la lista de rutas; null si no hay (el navegador). */
  recientes?: { agregar(ruta: string): void; quitar(ruta: string): void } | null;
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

/** Aviso de la barra de estado cuando el archivo de Abrir reciente ya no existe (T24). */
export function avisoNoExiste(nombre: string): string {
  return `Ya no existe «${nombre}»: se quitó de recientes`;
}

/** Problema de «No se pudo abrir» cuando el archivo con que arrancó Bornera no existe (T25). */
export function mensajeNoExiste(ruta: string): string {
  return `No existe el archivo «${ruta}»`;
}

/** Aviso de la barra de estado cuando no se puede cerrar la ventana. */
export const AVISO_CERRAR_EN_CURSO = "No se puede cerrar: hay una operación de archivo en curso";

/** Aviso de la barra al exportar tal cual una copia que no abre (T23). */
export const AVISO_EXPORTADO_TAL_CUAL = "Copia exportada tal cual";

export class OperacionesArchivo {
  /** Archivo donde Guardar escribe sin preguntar; null en un documento nuevo. */
  private _archivoActual: Destino | null = null;
  /**
   * El archivo de una copia recuperada (T23, D2c): no es el actual (Guardar
   * pregunta dónde), pero da el nombre del título y lo que sugiere el diálogo.
   * Se limpia al guardar, abrir o con Nuevo.
   */
  private _sugerido: Destino | null = null;
  private _enCurso = false;
  /** El diálogo de cambios sin guardar está abierto: otra Abrir o Nuevo no hace nada. */
  private preguntando = false;
  /** Se avisa cuando cambia el archivo actual o si hay una operación en curso. */
  alCambiar: (() => void) | null = null;

  constructor(private readonly deps: DependenciasArchivo) {}

  get archivoActual(): Destino | null {
    return this._archivoActual;
  }

  /** El archivo de una copia recuperada, mientras no se guarde, abra otro o haga Nuevo (T23). */
  get sugerido(): Destino | null {
    return this._sugerido;
  }

  /** El nombre del archivo para el título y los diálogos: el actual o, si no hay, el de la copia recuperada. */
  get nombreVisible(): string | null {
    return this._archivoActual?.nombre ?? this._sugerido?.nombre ?? null;
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
      respuesta = await this.deps.preguntarSinGuardar(nombreDocumento(this.nombreVisible, editor.documento.meta.titulo));
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

  /**
   * Exportar sin comprimir (D4-C, T21): escribe una copia `.brn.json` de lo
   * que se ve, por líneas. No cambia el archivo actual, la marca de cambios
   * ni el historial. Como Guardar, no escribe un documento que no abriría
   * (D22-B). Devuelve si se escribió.
   */
  async exportar(): Promise<boolean> {
    if (this._enCurso) return false;
    const mostrado = this.deps.mostrado();
    if (!mostrado) return false;
    this.deps.confirmarPanel();
    return this.escribir(mostrado.editor, mostrado.esDocumento, "exportar");
  }

  /**
   * Pasos 2 a 7 de Guardar (o de Exportar), sobre este editor. El formato lo
   * da el nombre del destino (D4-C): `.brn.json` se escribe por líneas y sin
   * comprimir.
   */
  private async escribir(editor: EditorArchivo, esDocumento: boolean, modo: boolean | "exportar"): Promise<boolean> {
    const exportar = modo === "exportar";
    const como = modo === true;
    this.empezar();
    try {
      const inicio = this.deps.ahora();
      let destino = esDocumento && !como && !exportar ? this._archivoActual : null;
      // Una copia recuperada (T23): el diálogo sugiere su archivo original.
      const sugerido = esDocumento && !exportar ? this._sugerido : null;
      // El formato que se espera antes del diálogo; el nombre elegido puede cambiarlo.
      const previsto: FormatoArchivo = exportar
        ? "brnJson"
        : destino
          ? formatoDeNombre(destino.nombre)
          : sugerido
            ? formatoDeNombre(sugerido.nombre)
            : "brn";
      let texto = textoDe(editor.documento, previsto);
      // Exportar no toca la marca: es una copia.
      const marca = exportar ? null : editor.tomarMarca();
      const prueba = deserializar(texto);
      if (!prueba.ok) {
        this.deps.mostrarProblemas(TITULOS.noSePuedeGuardar, prueba.errores);
        return false;
      }
      // D20: el tiempo se corta durante el diálogo de dónde guardar.
      let ms = this.deps.ahora() - inicio;
      if (!destino) {
        const propuesta = sugerido ? (sugerido.ruta ?? sugerido.nombre) : nombreArchivo(editor.documento.meta.titulo, previsto);
        destino = await this.deps.archivos.elegirDestino(propuesta, exportar ? "brnJson" : "brn");
        if (!destino) return false;
      }
      const escribiendo = this.deps.ahora();
      const formato = formatoDeNombre(destino.nombre);
      // Se escribió `.brn.json` a mano en Guardar como (o al revés): el texto
      // sale del documento ya validado, que es el del momento de la marca
      // aunque el editor haya cambiado durante el diálogo.
      if (formato !== previsto) texto = textoDe(prueba.documento, formato);
      const { bytes, comprimido } = formato === "brnJson" ? empaquetarPlano(texto) : await empaquetar(texto);
      await this.deps.archivos.guardar(destino, bytes);
      ms = Math.round(ms + this.deps.ahora() - escribiendo);
      const tiempo = this.deps.medir ? ms : null;
      if (exportar) {
        this.deps.avisar(avisoExportado(tiempo));
        return true;
      }
      if (esDocumento && marca) {
        this._archivoActual = destino;
        this._sugerido = null;
        editor.marcarGuardado(marca);
        if (destino.ruta !== null) this.deps.recientes?.agregar(destino.ruta);
      }
      this.deps.avisar(avisoGuardado(comprimido, tiempo));
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
    await this.abrirElegido(elegido, editor, cambios);
  }

  /**
   * Abrir reciente (T24): abre esta ruta sin el selector. Si el archivo ya no
   * existe, avisa y la quita de la lista, sin preguntar por los cambios.
   */
  abrirReciente(ruta: string): Promise<void> {
    return this.abrirRuta(ruta, "reciente");
  }

  /**
   * Abrir el archivo con que arrancó Bornera (T25, doble clic en un `.brn`):
   * los pasos de Abrir reciente, pero si el archivo no existe es un error
   * («No se pudo abrir») y la lista de recientes no se toca. Si abre, sube en
   * la lista (D3-A).
   */
  abrirArgumento(ruta: string): Promise<void> {
    return this.abrirRuta(ruta, "argumento");
  }

  private async abrirRuta(ruta: string, origen: "reciente" | "argumento"): Promise<void> {
    const archivos = this.deps.archivos;
    if (!archivos.existe || !archivos.deRuta) return;
    // Los bloqueos del paso 1, antes de mirar el disco.
    if (this._enCurso || this.preguntando || !this.deps.reemplazable()) return;
    let hay: boolean;
    try {
      hay = await archivos.existe(ruta);
    } catch (e) {
      // Sin permiso u otro error: queda en la lista (D3-A).
      this.deps.mostrarProblemas(TITULOS.noSePudoAbrir, [{ donde: "", mensaje: textoError(e, "abrir") }]);
      return;
    }
    if (!hay && origen === "argumento") {
      this.deps.mostrarProblemas(TITULOS.noSePudoAbrir, [{ donde: "", mensaje: mensajeNoExiste(ruta) }]);
      return;
    }
    if (!hay) {
      this.deps.recientes?.quitar(ruta);
      this.deps.avisar(avisoNoExiste(nombreDeRuta(ruta)));
      return;
    }
    const editor = await this.antesDeReemplazar();
    if (!editor) return;
    const cambios = editor.cambios;
    let elegido: ArchivoElegido;
    try {
      elegido = await archivos.deRuta(ruta);
    } catch (e) {
      this.deps.mostrarProblemas(TITULOS.noSePudoAbrir, [{ donde: "", mensaje: textoError(e, "leer") }]);
      return;
    }
    await this.abrirElegido(elegido, editor, cambios);
  }

  /**
   * Pasos 4 a 7 de Abrir y de Abrir reciente, con el archivo ya elegido:
   * empieza la operación, lo carga y reemplaza el documento, y avisa.
   */
  private async abrirElegido(elegido: ArchivoElegido, editor: EditorDocumento, cambios: number): Promise<void> {
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
    this._sugerido = null;
    this.alCambiar?.();
  }

  /**
   * Recuperar una copia (T23, D2c-A): el documento pasa a ser el de la copia,
   * con cambios sin guardar y el historial vacío. No queda archivo actual:
   * Guardar pregunta dónde, sugiriendo `archivo` (el original), que también da
   * el nombre del título. Si el documento a la vista tiene cambios, primero
   * el diálogo de cambios sin guardar, como Abrir. Devuelve la promesa del
   * primer cuadro, o null si no se reemplazó (otra operación, Simular, el
   * banco o Cancelar).
   */
  async recuperar(documento: Documento, archivo: Destino | null): Promise<{ cuadro: Promise<void> } | null> {
    const editor = await this.antesDeReemplazar();
    if (!editor || this._enCurso) return null;
    const cuadro = this.deps.reemplazar(documento, { modificado: true });
    this._archivoActual = null;
    this._sugerido = archivo;
    this.alCambiar?.();
    // En un objeto: una función async que devuelve una promesa la espera.
    return { cuadro };
  }

  /**
   * Exportar tal cual el texto de una copia que no abre (T23, D2c): sin
   * validar ni cambiar nada, a un `.brn.json` que se elige. Devuelve si se
   * escribió.
   */
  async exportarTexto(texto: string, nombre: string): Promise<boolean> {
    if (this._enCurso) return false;
    this.empezar();
    try {
      const base = nombre.replace(/\.brn(\.json)?$/i, "");
      const destino = await this.deps.archivos.elegirDestino(nombreArchivo(`${base} (copia de recuperación)`, "brnJson"), "brnJson");
      if (!destino) return false;
      await this.deps.archivos.guardar(destino, new TextEncoder().encode(texto));
      this.deps.avisar(AVISO_EXPORTADO_TAL_CUAL);
      return true;
    } catch (e) {
      this.deps.mostrarProblemas(TITULOS.noSePudoGuardar, [{ donde: "", mensaje: textoError(e, "escribir") }]);
      return false;
    } finally {
      this.terminar();
    }
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
    this._sugerido = null;
    if (elegido.ruta !== null) this.deps.recientes?.agregar(elegido.ruta);
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
      respuesta = await this.deps.preguntarSinGuardar(nombreDocumento(this.nombreVisible, editor.documento.meta.titulo));
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

/** Aviso de la barra de estado al exportar (T21); con `ms`, dice el tiempo (D20). */
export function avisoExportado(ms: number | null): string {
  return ms === null ? "Exportado sin comprimir" : `Exportado sin comprimir en ${ms} ms`;
}

/** El texto del documento en ese formato: `.brn` en una línea, `.brn.json` por líneas (T21). */
function textoDe(doc: Documento, formato: FormatoArchivo): string {
  return formato === "brnJson" ? serializarPorLineas(doc) : serializar(doc);
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
