import { describe, expect, it, vi } from "vitest";
import { deserializar, serializar, serializarPorLineas, type ProblemaArchivo } from "../core/io";
import { datos, docCables, docRotados, meta } from "../core/io/prueba-documentos";
import { CambiarEtiqueta, colocar } from "../core/model/comandos";
import { crearDocumento, generarId, type Documento } from "../core/model/documento";
import { documentoNuevo, Editor } from "../editor/editor";
import type { ArchivoElegido, Archivos, Destino } from "./archivos";
import {
  atajoArchivo,
  atajoArchivoActua,
  avisoAbierto,
  avisoExportado,
  AVISO_CERRAR_EN_CURSO,
  avisoGuardado,
  avisoNoExiste,
  AVISOS_ABRIR,
  esTeclaRecarga,
  lineasProblemas,
  nombreDocumento,
  OperacionesArchivo,
  TITULOS,
  tituloVentana,
  type DependenciasArchivo,
  type Mostrado,
  type RespuestaSinGuardar,
} from "./archivo";
import { desempaquetar, empaquetar, MENSAJES, nombreArchivo, TOPE_BYTES, type FormatoArchivo } from "./brn";

/** Un archivo en el disco de mentira, para Abrir. */
interface Archivo {
  bytes: Uint8Array;
  nombre: string;
  ruta: string | null;
}

/**
 * Archivos de mentira: anotan cada llamada ("elegir X" es el diálogo de dónde
 * guardar, "guardar X" la escritura, "abrir" el selector) y lo escrito.
 */
class ArchivosFalsos implements Archivos {
  llamadas: string[] = [];
  escritos: { nombre: string; bytes: Uint8Array }[] = [];
  /** Lo que se elige en el diálogo de dónde guardar: un nombre, null (cancelar) o undefined (el sugerido). */
  eleccion: string | null | undefined = undefined;
  /** Lo que pasa mientras el diálogo de dónde guardar está abierto. */
  alElegirDestino: () => void = () => undefined;
  /** Si está, la escritura falla con este error. */
  falla: Error | null = null;
  /** Si está, la escritura espera a que se llame a `soltar`. */
  private pausa: Promise<void> | null = null;
  soltar: () => void = () => undefined;

  pausar(): void {
    this.pausa = new Promise((r) => (this.soltar = r));
  }

  /** Lo que se elige en Abrir: un archivo, o null (cancelar el selector). */
  aAbrir: Archivo | null = null;
  /** Si está, el tamaño que da el selector (si no, el de los bytes). */
  tamano: number | null = null;
  /** Si está, el selector falla con este error. */
  fallaElegir: Error | null = null;
  /** Si está, leer el archivo elegido falla con este error. */
  fallaLeer: Error | null = null;
  /** Veces que se leyó un archivo elegido. */
  lecturas = 0;
  /** Lo que pasa mientras el selector está abierto. */
  alAbrir: () => void = () => undefined;
  /** Lo que pasa mientras se lee el archivo elegido. */
  alLeer: () => void = () => undefined;
  /** Si está, el selector espera a que se llame a `soltarAbrir`. */
  private pausaAbrir: Promise<void> | null = null;
  soltarAbrir: () => void = () => undefined;

  pausarAbrir(): void {
    this.pausaAbrir = new Promise((r) => (this.soltarAbrir = r));
  }

  async elegirParaAbrir(): Promise<ArchivoElegido | null> {
    this.llamadas.push("abrir");
    if (this.pausaAbrir) await this.pausaAbrir;
    this.alAbrir();
    if (this.fallaElegir) throw this.fallaElegir;
    const a = this.aAbrir;
    if (!a) return null;
    return this.elegido(a);
  }

  /** Abrir reciente (T24): los archivos que hay en el disco, por ruta. */
  enDisco = new Map<string, Archivo>();
  /** Si está, `existe` falla con este error. */
  fallaExiste: Error | null = null;
  /** Si está, `deRuta` falla con este error. */
  fallaDeRuta: Error | null = null;

  async existe(ruta: string): Promise<boolean> {
    this.llamadas.push(`existe ${ruta}`);
    if (this.fallaExiste) throw this.fallaExiste;
    return this.enDisco.has(ruta);
  }

  async deRuta(ruta: string): Promise<ArchivoElegido> {
    this.llamadas.push(`deRuta ${ruta}`);
    if (this.fallaDeRuta) throw this.fallaDeRuta;
    const a = this.enDisco.get(ruta);
    if (!a) throw new Error("No existe");
    return this.elegido(a);
  }

  private elegido(a: Archivo): ArchivoElegido {
    return {
      nombre: a.nombre,
      ruta: a.ruta,
      tamano: this.tamano ?? a.bytes.length,
      leer: async () => {
        this.lecturas++;
        this.alLeer();
        if (this.fallaLeer) throw this.fallaLeer;
        return a.bytes;
      },
    };
  }

  /** El formato pedido en cada diálogo de dónde guardar. */
  formatos: FormatoArchivo[] = [];
  /** La carpeta que da el diálogo de dónde guardar (como el escritorio); null: sin ruta (el navegador). */
  carpeta: string | null = null;

  async elegirDestino(sugerido: string, formato: FormatoArchivo): Promise<Destino | null> {
    this.llamadas.push(`elegir ${sugerido}`);
    this.formatos.push(formato);
    this.alElegirDestino();
    if (this.eleccion === null) return null;
    const nombre = this.eleccion ?? sugerido;
    return { nombre, ruta: this.carpeta === null ? null : `${this.carpeta}\\${nombre}` };
  }

  async guardar(destino: Destino, bytes: Uint8Array): Promise<void> {
    this.llamadas.push(`guardar ${destino.nombre}`);
    if (this.pausa) await this.pausa;
    if (this.falla) throw this.falla;
    this.escritos.push({ nombre: destino.nombre, bytes });
  }
}

function preparar() {
  const archivos = new ArchivosFalsos();
  const editor = new Editor(docCables());
  const p = {
    archivos,
    /** El editor del documento (Abrir y Nuevo lo reemplazan). */
    editor,
    mostrado: { editor, esDocumento: true } as Mostrado | null,
    /** Abrir y Nuevo andan (en Editar y viendo el documento, D17). */
    puedeAbrir: true,
    /** Documentos puestos por Abrir y Nuevo. */
    reemplazos: [] as Documento[],
    /** El primer cuadro sale enseguida; si no, espera a que se cumpla `cuadros`. */
    cuadroInmediato: true,
    cuadros: [] as (() => void)[],
    /** Nombres con que se preguntó por los cambios sin guardar, y la respuesta. */
    preguntas: [] as string[],
    respuesta: "cancelar" as RespuestaSinGuardar,
    /** El diálogo no responde solo: espera a que se llame a `responder`. */
    esperarRespuesta: false,
    responder: (_r: RespuestaSinGuardar) => {},
    problemas: [] as { titulo: string; problemas: readonly ProblemaArchivo[] }[],
    avisos: [] as string[],
    confirmados: 0,
    /** Lo que hace el panel al confirmar (por defecto, nada). */
    alConfirmar: () => {},
    reloj: 0,
    /** Lo que pasa cada vez que se lee el reloj. */
    alLeerReloj: () => {},
    medir: false,
    /** Abrir reciente (T24): lo que se sumó y quitó de la lista, en orden. */
    recientes: [] as string[],
    ops: null as unknown as OperacionesArchivo,
  };
  p.ops = new OperacionesArchivo({
    archivos,
    mostrado: () => p.mostrado,
    reemplazable: () => (p.puedeAbrir ? p.editor : null),
    documento: () => p.editor,
    reemplazar: (documento, opciones) => {
      p.reemplazos.push(documento);
      p.editor = new Editor(documento, 0, opciones);
      p.mostrado = { editor: p.editor, esDocumento: true };
      return p.cuadroInmediato ? Promise.resolve() : new Promise<void>((r) => p.cuadros.push(r));
    },
    preguntarSinGuardar: async (nombre) => {
      p.preguntas.push(nombre);
      if (p.esperarRespuesta) return new Promise<RespuestaSinGuardar>((r) => (p.responder = r));
      return p.respuesta;
    },
    confirmarPanel: () => {
      p.confirmados++;
      p.alConfirmar();
    },
    mostrarProblemas: (titulo, problemas) => p.problemas.push({ titulo, problemas }),
    avisar: (t) => p.avisos.push(t),
    ahora: () => {
      p.alLeerReloj();
      return p.reloj;
    },
    get medir() {
      return p.medir;
    },
    recientes: {
      agregar: (ruta) => p.recientes.push(`agregar ${ruta}`),
      quitar: (ruta) => p.recientes.push(`quitar ${ruta}`),
    },
  });
  return p;
}

/** Un cambio cualquiera en el documento del editor. */
function cambiar(ed: Editor, x = 40): void {
  ed.ejecutar(colocar(ed.documento, datos("contactor.bobina", x, 0)));
}

/** Un archivo con el documento, como lo escribe Guardar (gzip). */
async function archivo(doc: Documento, nombre = "Marcha.brn"): Promise<Archivo> {
  return { bytes: (await empaquetar(serializar(doc))).bytes, nombre, ruta: null };
}

/** Un archivo con este texto, sin comprimir. */
function archivoTexto(texto: string, nombre = "Roto.brn"): Archivo {
  return { bytes: new TextEncoder().encode(texto), nombre, ruta: null };
}

/** Lo escrito, abierto de vuelta. */
async function abrirEscrito(bytes: Uint8Array) {
  const d = await desempaquetar(bytes);
  if (!d.ok) throw new Error(d.error);
  const r = deserializar(d.texto);
  if (!r.ok) throw new Error(r.errores.map((e) => e.mensaje).join("; "));
  return r.documento;
}

describe("Guardar", () => {
  it("sin archivo actual pide dónde; con archivo actual, no", async () => {
    const p = preparar();
    cambiar(p.editor);
    expect(p.editor.modificado).toBe(true);
    expect(await p.ops.guardar()).toBe(true);
    expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn"]);
    expect(p.ops.archivoActual).toEqual({ nombre: "Prueba.brn", ruta: null });
    expect(p.editor.modificado).toBe(false);
    cambiar(p.editor, 50);
    expect(await p.ops.guardar()).toBe(true);
    expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn", "guardar Prueba.brn"]);
    expect(p.editor.modificado).toBe(false);
  });

  it("Guardar como siempre pide y fija el archivo actual", async () => {
    const p = preparar();
    await p.ops.guardar();
    p.archivos.eleccion = "Otro.brn";
    expect(await p.ops.guardar(true)).toBe(true);
    expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn", "elegir Prueba.brn", "guardar Otro.brn"]);
    expect(p.ops.archivoActual?.nombre).toBe("Otro.brn");
    await p.ops.guardar();
    expect(p.archivos.llamadas.at(-1)).toBe("guardar Otro.brn");
  });

  it("lo escrito es gzip, abre y es el documento", async () => {
    const p = preparar();
    cambiar(p.editor);
    await p.ops.guardar();
    const { bytes } = p.archivos.escritos[0]!;
    expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
    expect(await abrirEscrito(bytes)).toEqual(p.editor.documento);
  });

  it("Guardar no toca el historial: se puede seguir deshaciendo", async () => {
    const p = preparar();
    cambiar(p.editor);
    await p.ops.guardar();
    expect(p.editor.puedeDeshacer).toBe(true);
    p.editor.deshacer();
    expect(p.editor.modificado).toBe(true);
    p.editor.rehacer();
    expect(p.editor.modificado).toBe(false);
  });

  it("el panel confirma antes de serializar: lo escrito en el campo se guarda", async () => {
    const p = preparar();
    const id = p.editor.documento.hojas[0]!.componentes[0]!.id;
    p.alConfirmar = () => p.editor.ejecutar(new CambiarEtiqueta(id, "Señal"));
    await p.ops.guardar();
    expect(p.confirmados).toBe(1);
    const doc = await abrirEscrito(p.archivos.escritos[0]!.bytes);
    expect(doc.hojas[0]!.componentes[0]!.etiqueta).toBe("Señal");
    expect(p.editor.modificado).toBe(false);
  });

  it("cancelar el diálogo no cambia nada", async () => {
    const p = preparar();
    cambiar(p.editor);
    p.archivos.eleccion = null;
    expect(await p.ops.guardar()).toBe(false);
    expect(p.ops.archivoActual).toBeNull();
    expect(p.editor.modificado).toBe(true);
    expect(p.avisos).toEqual([]);
    expect(p.problemas).toEqual([]);
    expect(p.ops.enCurso).toBe(false);
  });

  it("un error de escritura no marca ni cambia el archivo actual", async () => {
    const p = preparar();
    await p.ops.guardar();
    cambiar(p.editor);
    p.archivos.falla = new Error("El disco está lleno");
    expect(await p.ops.guardar()).toBe(false);
    expect(p.problemas).toEqual([{ titulo: TITULOS.noSePudoGuardar, problemas: [{ donde: "", mensaje: "El disco está lleno" }] }]);
    expect(p.editor.modificado).toBe(true);
    expect(p.ops.archivoActual?.nombre).toBe("Prueba.brn");
    expect(p.ops.enCurso).toBe(false);
    // Lo mismo en Guardar como: el archivo actual no pasa al nuevo.
    p.archivos.eleccion = "Nuevo.brn";
    expect(await p.ops.guardar(true)).toBe(false);
    expect(p.ops.archivoActual?.nombre).toBe("Prueba.brn");
  });

  it("D22-B: un documento que no abriría no se escribe ni se marca", async () => {
    const p = preparar();
    cambiar(p.editor, 20_000);
    expect(await p.ops.guardar()).toBe(false);
    expect(p.archivos.llamadas).toEqual([]);
    expect(p.problemas).toHaveLength(1);
    expect(p.problemas[0]!.titulo).toBe(TITULOS.noSePuedeGuardar);
    expect(p.problemas[0]!.problemas[0]!.donde).toMatch(/^hojas\[0\]\.componentes\[\d+\]\.x$/);
    expect(p.editor.modificado).toBe(true);
    expect(p.ops.enCurso).toBe(false);
  });

  it("los avisos solos no frenan (varias hojas)", async () => {
    const p = preparar();
    p.editor.documento.hojas.push({ nombre: "Hoja 2", componentes: [], cables: [] });
    expect(await p.ops.guardar()).toBe(true);
    expect(p.problemas).toEqual([]);
    expect((await abrirEscrito(p.archivos.escritos[0]!.bytes)).hojas).toHaveLength(2);
  });

  it("reentrada: otra acción durante la primera no hace nada", async () => {
    const p = preparar();
    p.archivos.pausar();
    const primera = p.ops.guardar();
    expect(p.ops.enCurso).toBe(true);
    // Mientras comprime…
    expect(await p.ops.guardar()).toBe(false);
    // …y mientras escribe.
    await vi.waitFor(() => expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn"]));
    expect(await p.ops.guardar(true)).toBe(false);
    expect(await p.ops.guardar()).toBe(false);
    expect(p.confirmados).toBe(1);
    p.archivos.soltar();
    expect(await primera).toBe(true);
    expect(p.archivos.llamadas).toHaveLength(2);
    expect(p.ops.enCurso).toBe(false);
  });

  it("la marca se toma al serializar: lo editado durante la escritura sigue modificado", async () => {
    const p = preparar();
    p.archivos.pausar();
    const guardando = p.ops.guardar();
    await Promise.resolve();
    cambiar(p.editor);
    p.archivos.soltar();
    expect(await guardando).toBe(true);
    expect(p.editor.modificado).toBe(true);
    // Lo escrito es el documento de antes del cambio.
    const doc = await abrirEscrito(p.archivos.escritos[0]!.bytes);
    expect(doc.hojas[0]!.componentes).toHaveLength(p.editor.documento.hojas[0]!.componentes.length - 1);
  });

  it("D17: una escena del banco siempre pregunta y no toca el archivo actual ni la marca", async () => {
    const p = preparar();
    await p.ops.guardar();
    cambiar(p.editor);
    const banco = new Editor(docRotados());
    banco.documento.meta.titulo = "Banco de 100";
    cambiar(banco);
    p.mostrado = { editor: banco, esDocumento: false };
    expect(await p.ops.guardar()).toBe(true);
    expect(p.archivos.llamadas.slice(-2)).toEqual(["elegir Banco de 100.brn", "guardar Banco de 100.brn"]);
    expect(p.ops.archivoActual?.nombre).toBe("Prueba.brn");
    expect(p.editor.modificado).toBe(true);
    expect(banco.modificado).toBe(true);
    expect(await abrirEscrito(p.archivos.escritos.at(-1)!.bytes)).toEqual(banco.documento);
  });

  it("en una escena sin editor no hace nada", async () => {
    const p = preparar();
    p.mostrado = null;
    expect(await p.ops.guardar()).toBe(false);
    expect(await p.ops.guardar(true)).toBe(false);
    expect(p.archivos.llamadas).toEqual([]);
    expect(p.confirmados).toBe(0);
  });

  it("el aviso dice el tiempo solo si se mide (de serializar al fin de la escritura)", async () => {
    const p = preparar();
    await p.ops.guardar();
    expect(p.avisos).toEqual(["Guardado"]);
    p.medir = true;
    p.reloj = 100;
    p.archivos.pausar();
    const guardando = p.ops.guardar();
    p.reloj = 137.4;
    p.archivos.soltar();
    await guardando;
    expect(p.avisos.at(-1)).toBe("Guardado en 37 ms");
  });

  it("D20: el tiempo no cuenta lo que se tarda en el diálogo de dónde guardar", async () => {
    const p = preparar();
    p.medir = true;
    p.reloj = 100;
    // Lecturas del reloj: 1 al empezar, 2 antes del diálogo, 3 después, 4 al terminar de escribir.
    let lecturas = 0;
    p.alLeerReloj = () => {
      // Serializar y validar: 20 ms.
      if (++lecturas === 2) p.reloj += 20;
    };
    p.archivos.alElegirDestino = () => (p.reloj += 5000);
    p.archivos.pausar();
    const guardando = p.ops.guardar();
    await vi.waitFor(() => expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn"]));
    // Comprimir y escribir: 30 ms.
    p.reloj += 30;
    p.archivos.soltar();
    expect(await guardando).toBe(true);
    expect(p.avisos.at(-1)).toBe("Guardado en 50 ms");
  });

  it("avisoGuardado", () => {
    expect(avisoGuardado(true, null)).toBe("Guardado");
    expect(avisoGuardado(false, null)).toBe("Guardado sin comprimir");
    expect(avisoGuardado(true, 12)).toBe("Guardado en 12 ms");
    expect(avisoGuardado(false, 0)).toBe("Guardado sin comprimir en 0 ms");
  });
});

/** Lo escrito es texto plano por líneas (`.brn.json`) del documento. */
function esPorLineas(bytes: Uint8Array, doc: Documento): void {
  expect([bytes[0], bytes[1]]).not.toEqual([0x1f, 0x8b]);
  expect(new TextDecoder().decode(bytes)).toBe(serializarPorLineas(doc));
}

describe("Exportar sin comprimir (T21)", () => {
  it("escribe una copia .brn.json por líneas; no cambia el archivo actual, la marca ni el historial", async () => {
    const p = preparar();
    await p.ops.guardar();
    p.archivos.llamadas = [];
    cambiar(p.editor);
    const cambios = p.editor.cambios;
    const actual = p.ops.archivoActual;
    expect(await p.ops.exportar()).toBe(true);
    expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn.json", "guardar Prueba.brn.json"]);
    expect(p.archivos.formatos.at(-1)).toBe("brnJson");
    esPorLineas(p.archivos.escritos.at(-1)!.bytes, p.editor.documento);
    expect(p.ops.archivoActual).toBe(actual);
    expect(p.editor.modificado).toBe(true);
    expect(p.editor.cambios).toBe(cambios);
    expect(p.editor.puedeDeshacer).toBe(true);
    expect(p.avisos.at(-1)).toBe("Exportado sin comprimir");
    expect(p.confirmados).toBeGreaterThan(0);
    expect(p.ops.enCurso).toBe(false);
    // El Guardar siguiente sigue yendo al .brn, con gzip.
    p.archivos.llamadas = [];
    await p.ops.guardar();
    expect(p.archivos.llamadas).toEqual(["guardar Prueba.brn"]);
    expect(await abrirEscrito(p.archivos.escritos.at(-1)!.bytes)).toEqual(p.editor.documento);
    expect(p.editor.modificado).toBe(false);
  });

  it("sin cambios, el documento sigue sin cambios; sin archivo actual, sigue sin archivo actual", async () => {
    const p = preparar();
    expect(await p.ops.exportar()).toBe(true);
    expect(p.editor.modificado).toBe(false);
    expect(p.ops.archivoActual).toBeNull();
  });

  it("Cancelar en el diálogo no escribe nada", async () => {
    const p = preparar();
    p.archivos.eleccion = null;
    expect(await p.ops.exportar()).toBe(false);
    expect(p.archivos.escritos).toEqual([]);
    expect(p.avisos).toEqual([]);
    expect(p.ops.enCurso).toBe(false);
  });

  it("D22-B: un documento que no abriría no se exporta", async () => {
    const p = preparar();
    cambiar(p.editor, 20_000);
    expect(await p.ops.exportar()).toBe(false);
    expect(p.archivos.llamadas).toEqual([]);
    expect(p.problemas[0]!.titulo).toBe(TITULOS.noSePuedeGuardar);
  });

  it("una escena del banco se exporta; una escena sin editor, no; con otra operación en curso, nada", async () => {
    const p = preparar();
    const banco = new Editor(docRotados());
    p.mostrado = { editor: banco, esDocumento: false };
    expect(await p.ops.exportar()).toBe(true);
    esPorLineas(p.archivos.escritos.at(-1)!.bytes, banco.documento);
    p.mostrado = null;
    expect(await p.ops.exportar()).toBe(false);
    p.mostrado = { editor: p.editor, esDocumento: true };
    p.archivos.pausar();
    const guardando = p.ops.guardar();
    expect(await p.ops.exportar()).toBe(false);
    p.archivos.soltar();
    await guardando;
  });

  it("D20: con medir, el aviso dice el tiempo", async () => {
    const p = preparar();
    p.medir = true;
    await p.ops.exportar();
    expect(p.avisos.at(-1)).toMatch(/^Exportado sin comprimir en \d+ ms$/);
    expect(avisoExportado(null)).toBe("Exportado sin comprimir");
    expect(avisoExportado(7)).toBe("Exportado sin comprimir en 7 ms");
  });
});

describe("El formato lo da la extensión (D4-C)", () => {
  it("Ctrl+S sobre un .brn.json abierto lo escribe por líneas y sin comprimir; queda guardado", async () => {
    const p = preparar();
    const doc = docRotados();
    p.archivos.aAbrir = { bytes: new TextEncoder().encode(serializarPorLineas(doc)), nombre: "Marcha.brn.json", ruta: null };
    await p.ops.abrir();
    expect(p.editor.documento).toEqual(doc);
    cambiar(p.editor);
    p.archivos.llamadas = [];
    expect(await p.ops.guardar()).toBe(true);
    expect(p.archivos.llamadas).toEqual(["guardar Marcha.brn.json"]);
    esPorLineas(p.archivos.escritos.at(-1)!.bytes, p.editor.documento);
    expect(p.editor.modificado).toBe(false);
    expect(p.avisos.at(-1)).toBe("Guardado sin comprimir");
  });

  it("un .brn.json con CRLF abre igual, y Ctrl+S lo vuelve a escribir con \\n", async () => {
    const p = preparar();
    const doc = docRotados();
    const crlf = serializarPorLineas(doc).replaceAll("\n", "\r\n");
    p.archivos.aAbrir = { bytes: new TextEncoder().encode(crlf), nombre: "Marcha.brn.json", ruta: null };
    await p.ops.abrir();
    expect(p.editor.documento).toEqual(doc);
    await p.ops.guardar();
    esPorLineas(p.archivos.escritos.at(-1)!.bytes, doc);
  });

  it("D3: en Guardar como se puede escribir .brn.json a mano; pasa a ser el archivo actual", async () => {
    const p = preparar();
    cambiar(p.editor);
    p.archivos.eleccion = "Copia.brn.json";
    expect(await p.ops.guardar(true)).toBe(true);
    expect(p.archivos.formatos.at(-1)).toBe("brn");
    esPorLineas(p.archivos.escritos.at(-1)!.bytes, p.editor.documento);
    expect(p.ops.archivoActual?.nombre).toBe("Copia.brn.json");
    expect(p.editor.modificado).toBe(false);
  });

  it("el formato cambiado en el diálogo usa el documento del momento de la marca", async () => {
    const p = preparar();
    const antes = structuredClone(p.editor.documento);
    p.archivos.eleccion = "Copia.brn.json";
    p.archivos.alElegirDestino = () => cambiar(p.editor);
    await p.ops.guardar(true);
    esPorLineas(p.archivos.escritos.at(-1)!.bytes, antes);
    // Cambió durante el diálogo: sigue con cambios.
    expect(p.editor.modificado).toBe(true);
  });

  it("Guardar como sobre un .brn.json vuelve a .brn (gzip) si se elige un .brn", async () => {
    const p = preparar();
    p.archivos.aAbrir = { bytes: new TextEncoder().encode(serializarPorLineas(docRotados())), nombre: "Marcha.brn.json", ruta: null };
    await p.ops.abrir();
    p.archivos.eleccion = "Marcha.brn";
    await p.ops.guardar(true);
    const bytes = p.archivos.escritos.at(-1)!.bytes;
    expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
    expect(await abrirEscrito(bytes)).toEqual(p.editor.documento);
  });
});

describe("Abrir", () => {
  it("reemplaza el documento (historial vacío) y fija el archivo actual: el Guardar siguiente lo pisa sin preguntar", async () => {
    const p = preparar();
    const viejo = p.editor;
    const doc = docRotados();
    p.archivos.aAbrir = await archivo(doc);
    await p.ops.abrir();
    expect(p.preguntas).toEqual([]);
    expect(p.reemplazos).toHaveLength(1);
    expect(p.editor).not.toBe(viejo);
    expect(p.editor.documento).toEqual(doc);
    expect(p.editor.puedeDeshacer).toBe(false);
    expect(p.editor.modificado).toBe(false);
    expect(p.ops.archivoActual).toEqual({ nombre: "Marcha.brn", ruta: null });
    expect(p.ops.enCurso).toBe(false);
    cambiar(p.editor);
    expect(await p.ops.guardar()).toBe(true);
    expect(p.archivos.llamadas).toEqual(["abrir", "guardar Marcha.brn"]);
  });

  it("JSON en texto plano, sin comprimir, también abre (D1-B)", async () => {
    const p = preparar();
    const doc = docRotados();
    p.archivos.aAbrir = archivoTexto(serializar(doc), "Plano.brn");
    await p.ops.abrir();
    expect(p.editor.documento).toEqual(doc);
    expect(p.problemas).toEqual([]);
  });

  it("con cambios pregunta, con el nombre del título de la ventana; Cancelar no hace nada", async () => {
    const p = preparar();
    const viejo = p.editor;
    cambiar(p.editor);
    p.archivos.aAbrir = await archivo(docRotados());
    await p.ops.abrir();
    expect(p.preguntas).toEqual(["Prueba.brn"]);
    expect(p.archivos.llamadas).toEqual([]);
    expect(p.editor).toBe(viejo);
    expect(p.editor.modificado).toBe(true);
  });

  it("No guardar abre sin guardar", async () => {
    const p = preparar();
    cambiar(p.editor);
    p.respuesta = "noGuardar";
    p.archivos.aAbrir = await archivo(docRotados());
    await p.ops.abrir();
    expect(p.archivos.llamadas).toEqual(["abrir"]);
    expect(p.reemplazos).toHaveLength(1);
  });

  it("Guardar guarda y después abre", async () => {
    const p = preparar();
    const viejo = p.editor;
    cambiar(p.editor);
    p.respuesta = "guardar";
    p.archivos.aAbrir = await archivo(docRotados());
    await p.ops.abrir();
    expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn", "abrir"]);
    expect(await abrirEscrito(p.archivos.escritos[0]!.bytes)).toEqual(viejo.documento);
    expect(p.reemplazos).toHaveLength(1);
  });

  it("Guardar que no queda guardado no abre (cancelado o D22-B)", async () => {
    const p = preparar();
    cambiar(p.editor);
    p.respuesta = "guardar";
    p.archivos.eleccion = null;
    p.archivos.aAbrir = await archivo(docRotados());
    await p.ops.abrir();
    expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn"]);
    expect(p.reemplazos).toEqual([]);
    // D22-B: no abriría, no se guarda, y tampoco se abre.
    p.archivos.eleccion = undefined;
    cambiar(p.editor, 20_000);
    await p.ops.abrir();
    expect(p.problemas.map((x) => x.titulo)).toEqual([TITULOS.noSePuedeGuardar]);
    expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn"]);
    expect(p.reemplazos).toEqual([]);
  });

  it("Guardar, pero el documento cambió mientras se escribía: no abre", async () => {
    const p = preparar();
    cambiar(p.editor);
    p.respuesta = "guardar";
    p.archivos.aAbrir = await archivo(docRotados());
    p.archivos.pausar();
    const abriendo = p.ops.abrir();
    await vi.waitFor(() => expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn"]));
    cambiar(p.editor, 60);
    p.archivos.soltar();
    await abriendo;
    expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn"]);
    expect(p.editor.modificado).toBe(true);
    expect(p.reemplazos).toEqual([]);
  });

  it("el panel confirma antes de mirar si hay cambios", async () => {
    const p = preparar();
    const id = p.editor.documento.hojas[0]!.componentes[0]!.id;
    p.alConfirmar = () => p.editor.ejecutar(new CambiarEtiqueta(id, "K9"));
    await p.ops.abrir();
    expect(p.confirmados).toBe(1);
    expect(p.preguntas).toEqual(["Prueba.brn"]);
  });

  it("cancelar el selector no cambia nada ni deja la operación en curso", async () => {
    const p = preparar();
    await p.ops.abrir();
    expect(p.archivos.llamadas).toEqual(["abrir"]);
    expect(p.reemplazos).toEqual([]);
    expect(p.avisos).toEqual([]);
    expect(p.problemas).toEqual([]);
    expect(p.ops.enCurso).toBe(false);
  });

  it("archivo rechazado: «No se pudo abrir» y el documento actual no se toca", async () => {
    const p = preparar();
    await p.ops.guardar();
    cambiar(p.editor);
    p.respuesta = "noGuardar";
    const viejo = p.editor;
    const antes = serializar(viejo.documento);
    const casos: [Archivo, RegExp][] = [
      [archivoTexto("{roto"), /JSON/],
      [archivoTexto('{"formato":"otro"}'), /No es un archivo de Bornera/],
      [{ bytes: new Uint8Array([0x1f, 0x8b, 1, 2, 3]), nombre: "Roto.brn", ruta: null }, /./],
    ];
    for (const [a, mensaje] of casos) {
      p.problemas = [];
      p.archivos.aAbrir = a;
      await p.ops.abrir();
      expect(p.problemas).toHaveLength(1);
      expect(p.problemas[0]!.titulo).toBe(TITULOS.noSePudoAbrir);
      expect(p.problemas[0]!.problemas.map((x) => x.mensaje).join(" ")).toMatch(mensaje);
      expect(p.editor).toBe(viejo);
      expect(serializar(p.editor.documento)).toBe(antes);
      expect(p.editor.modificado).toBe(true);
      expect(p.ops.archivoActual?.nombre).toBe("Prueba.brn");
      expect(p.ops.enCurso).toBe(false);
    }
    expect(p.reemplazos).toEqual([]);
  });

  it("un error al leer el archivo se muestra y no cambia nada", async () => {
    const p = preparar();
    p.archivos.aAbrir = await archivo(docRotados());
    p.archivos.fallaLeer = new Error("Permiso denegado");
    await p.ops.abrir();
    expect(p.problemas).toEqual([{ titulo: TITULOS.noSePudoAbrir, problemas: [{ donde: "", mensaje: "Permiso denegado" }] }]);
    expect(p.reemplazos).toEqual([]);
    expect(p.ops.archivoActual).toBeNull();
    expect(p.ops.enCurso).toBe(false);
  });

  it("un error del selector se muestra y no cambia nada", async () => {
    const p = preparar();
    p.archivos.aAbrir = await archivo(docRotados());
    p.archivos.fallaElegir = new Error("No se pudo leer el tamaño");
    await p.ops.abrir();
    expect(p.problemas).toEqual([{ titulo: TITULOS.noSePudoAbrir, problemas: [{ donde: "", mensaje: "No se pudo leer el tamaño" }] }]);
    expect(p.archivos.lecturas).toBe(0);
    expect(p.reemplazos).toEqual([]);
    expect(p.ops.enCurso).toBe(false);
  });

  it("un archivo más grande que el tope se rechaza sin leerlo (D18)", async () => {
    const p = preparar();
    p.archivos.aAbrir = await archivo(docRotados());
    p.archivos.tamano = TOPE_BYTES + 1;
    await p.ops.abrir();
    expect(p.archivos.lecturas).toBe(0);
    expect(p.problemas).toEqual([{ titulo: TITULOS.noSePudoAbrir, problemas: [{ donde: "", mensaje: MENSAJES.grande }] }]);
    expect(p.reemplazos).toEqual([]);
    expect(p.ops.enCurso).toBe(false);
    // Justo en el tope, se lee y abre.
    p.archivos.tamano = TOPE_BYTES;
    await p.ops.abrir();
    expect(p.archivos.lecturas).toBe(1);
    expect(p.reemplazos).toHaveLength(1);
  });

  it("el documento cambió mientras se elegía el archivo: se cancela", async () => {
    const p = preparar();
    p.archivos.aAbrir = await archivo(docRotados());
    p.archivos.alAbrir = () => cambiar(p.editor);
    await p.ops.abrir();
    expect(p.avisos).toEqual([AVISOS_ABRIR.documentoCambio]);
    expect(p.reemplazos).toEqual([]);
    expect(p.ops.archivoActual).toBeNull();
    expect(p.ops.enCurso).toBe(false);
  });

  it("se pasó a Simular o al banco mientras se elegía el archivo: se cancela", async () => {
    const p = preparar();
    p.archivos.aAbrir = await archivo(docRotados());
    p.archivos.alAbrir = () => (p.puedeAbrir = false);
    await p.ops.abrir();
    expect(p.avisos).toEqual([AVISOS_ABRIR.cambioModo]);
    expect(p.reemplazos).toEqual([]);
  });

  it("D17: en Simular o en el banco, Abrir y Nuevo no hacen nada", async () => {
    const p = preparar();
    cambiar(p.editor);
    p.puedeAbrir = false;
    await p.ops.abrir();
    await p.ops.nuevo();
    expect(p.archivos.llamadas).toEqual([]);
    expect(p.confirmados).toBe(0);
    expect(p.preguntas).toEqual([]);
    expect(p.reemplazos).toEqual([]);
  });

  it("reentrada: con la operación en curso, ni Guardar ni otro Abrir hacen nada", async () => {
    const p = preparar();
    p.archivos.aAbrir = await archivo(docRotados());
    // El reloj se lee al empezar a cargar, ya con la operación en curso.
    const durante: Promise<unknown>[] = [];
    p.alLeerReloj = () => {
      if (durante.length > 0) return;
      expect(p.ops.enCurso).toBe(true);
      durante.push(p.ops.guardar(), p.ops.guardar(true), p.ops.abrir(), p.ops.nuevo());
    };
    await p.ops.abrir();
    expect(await Promise.all(durante)).toEqual([false, false, undefined, undefined]);
    expect(p.archivos.llamadas).toEqual(["abrir"]);
    expect(p.reemplazos).toHaveLength(1);
  });

  it("reentrada: Abrir durante un Guardar no hace nada; un Guardar empezado con el selector abierto cancela Abrir", async () => {
    const p = preparar();
    p.archivos.pausar();
    const guardando = p.ops.guardar();
    await p.ops.abrir();
    // Guardar ya pidió dónde (y está escribiendo); Abrir no llegó al selector.
    expect(p.archivos.llamadas).not.toContain("abrir");
    p.archivos.soltar();
    await guardando;
    // Con el selector abierto todavía no hay operación: Guardar anda, y al
    // volver el archivo, Abrir se cancela.
    p.archivos.llamadas = [];
    p.archivos.aAbrir = await archivo(docRotados());
    p.archivos.pausarAbrir();
    const abriendo = p.ops.abrir();
    p.archivos.pausar();
    const guardando2 = p.ops.guardar();
    p.archivos.soltarAbrir();
    await abriendo;
    expect(p.avisos.at(-1)).toBe(AVISOS_ABRIR.otraOperacion);
    expect(p.reemplazos).toEqual([]);
    p.archivos.soltar();
    expect(await guardando2).toBe(true);
  });

  it("los avisos del archivo se muestran una vez; Guardar no los repite", async () => {
    const p = preparar();
    const doc = docRotados();
    doc.hojas[0]!.componentes.push({ id: generarId(doc), ...datos("no.existe", 100, 0) });
    p.archivos.aAbrir = await archivo(doc);
    await p.ops.abrir();
    expect(p.reemplazos).toHaveLength(1);
    expect(p.problemas).toHaveLength(1);
    expect(p.problemas[0]!.titulo).toBe(TITULOS.seAbrioConAvisos);
    expect(p.problemas[0]!.problemas[0]!.mensaje).toMatch(/no\.existe/);
    cambiar(p.editor);
    expect(await p.ops.guardar()).toBe(true);
    expect(p.problemas).toHaveLength(1);
  });

  it("D20: «Abierto en N ms» cuenta la lectura y no el diálogo", async () => {
    const p = preparar();
    p.medir = true;
    p.reloj = 0;
    p.archivos.aAbrir = await archivo(docRotados());
    p.archivos.alAbrir = () => (p.reloj += 5000);
    p.archivos.alLeer = () => (p.reloj += 25);
    await p.ops.abrir();
    expect(p.avisos).toEqual(["Abierto en 25 ms"]);
  });

  it("«Abierto» sale con el primer cuadro, ya sin la operación en curso; medido, desde antes de leer", async () => {
    const p = preparar();
    p.cuadroInmediato = false;
    p.medir = true;
    p.reloj = 100;
    p.archivos.aAbrir = await archivo(docRotados());
    const abriendo = p.ops.abrir();
    await vi.waitFor(() => expect(p.cuadros).toHaveLength(1));
    expect(p.ops.enCurso).toBe(false);
    expect(p.avisos).toEqual([]);
    p.reloj = 142.6;
    p.cuadros[0]!();
    await abriendo;
    expect(p.avisos).toEqual(["Abierto en 43 ms"]);
    p.medir = false;
    p.cuadroInmediato = true;
    await p.ops.abrir();
    expect(p.avisos.at(-1)).toBe("Abierto");
  });

  it("avisoAbierto", () => {
    expect(avisoAbierto(null)).toBe("Abierto");
    expect(avisoAbierto(0)).toBe("Abierto en 0 ms");
  });
});

describe("Nuevo", () => {
  it("sin cambios: documento vacío, sin archivo actual", async () => {
    const p = preparar();
    await p.ops.guardar();
    expect(p.ops.archivoActual).not.toBeNull();
    let cambios = 0;
    p.ops.alCambiar = () => cambios++;
    await p.ops.nuevo();
    expect(p.preguntas).toEqual([]);
    expect(p.reemplazos).toHaveLength(1);
    const doc = p.reemplazos[0]!;
    expect(doc.hojas).toHaveLength(1);
    expect(doc.hojas[0]!.componentes).toEqual([]);
    expect(doc.hojas[0]!.cables).toEqual([]);
    expect(doc.meta.titulo).toBe("Sin título");
    expect(p.ops.archivoActual).toBeNull();
    expect(cambios).toBeGreaterThan(0);
    expect(p.editor.modificado).toBe(false);
  });

  it("con cambios pregunta: Cancelar no hace nada, No guardar sigue, Guardar guarda antes", async () => {
    const p = preparar();
    cambiar(p.editor);
    await p.ops.nuevo();
    expect(p.preguntas).toEqual(["Prueba.brn"]);
    expect(p.reemplazos).toEqual([]);
    p.respuesta = "guardar";
    await p.ops.nuevo();
    expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn"]);
    expect(p.reemplazos).toHaveLength(1);
    cambiar(p.editor);
    p.respuesta = "noGuardar";
    await p.ops.nuevo();
    expect(p.preguntas).toEqual(["Prueba.brn", "Prueba.brn", "Sin título.brn"]);
    expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn"]);
    expect(p.reemplazos).toHaveLength(2);
  });

  it("un documento nuevo se llama «Sin título.brn»: el mismo nombre en el título y al guardar", async () => {
    // documentoNuevo pone el título "Sin título"; sin él, nombreArchivo daría "circuito.brn".
    expect(documentoNuevo().meta.titulo).toBe("Sin título");
    expect(new Editor().documento.meta.titulo).toBe("Sin título");
    expect(tituloVentana({ archivo: null, titulo: documentoNuevo().meta.titulo, modificado: false })).toBe("Sin título.brn — Bornera");
    const p = preparar();
    await p.ops.nuevo();
    cambiar(p.editor);
    p.respuesta = "noGuardar";
    await p.ops.nuevo();
    const nombre = p.preguntas.at(-1);
    expect(nombre).toBe("Sin título.brn");
    await p.ops.guardar();
    expect(p.archivos.llamadas.slice(-2)).toEqual([`elegir ${nombre}`, `guardar ${nombre}`]);
  });
});

describe("Cerrar la ventana (D14-A)", () => {
  it("sin cambios se cierra sin preguntar; el panel confirma antes de mirar", async () => {
    const p = preparar();
    expect(await p.ops.antesDeCerrar()).toBe(true);
    expect(p.preguntas).toEqual([]);
    expect(p.confirmados).toBe(1);
    // Lo escrito en el campo cuenta como cambio.
    const id = p.editor.documento.hojas[0]!.componentes[0]!.id;
    p.alConfirmar = () => p.editor.ejecutar(new CambiarEtiqueta(id, "K9"));
    expect(await p.ops.antesDeCerrar()).toBe(false);
    expect(p.preguntas).toEqual(["Prueba.brn"]);
  });

  it("con cambios: Cancelar no cierra, No guardar cierra sin escribir", async () => {
    const p = preparar();
    cambiar(p.editor);
    expect(await p.ops.antesDeCerrar()).toBe(false);
    expect(p.preguntas).toEqual(["Prueba.brn"]);
    p.respuesta = "noGuardar";
    expect(await p.ops.antesDeCerrar()).toBe(true);
    expect(p.archivos.llamadas).toEqual([]);
    expect(p.editor.modificado).toBe(true);
  });

  it("Guardar guarda y cierra; con archivo actual, lo pisa sin preguntar dónde", async () => {
    const p = preparar();
    cambiar(p.editor);
    p.respuesta = "guardar";
    expect(await p.ops.antesDeCerrar()).toBe(true);
    expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn"]);
    expect(p.editor.modificado).toBe(false);
    cambiar(p.editor, 50);
    expect(await p.ops.antesDeCerrar()).toBe(true);
    expect(p.archivos.llamadas.at(-1)).toBe("guardar Prueba.brn");
    expect(await abrirEscrito(p.archivos.escritos.at(-1)!.bytes)).toEqual(p.editor.documento);
  });

  it("Guardar que no queda guardado no cierra (cancelado, error, D22-B)", async () => {
    const p = preparar();
    cambiar(p.editor);
    p.respuesta = "guardar";
    p.archivos.eleccion = null;
    expect(await p.ops.antesDeCerrar()).toBe(false);
    p.archivos.eleccion = undefined;
    p.archivos.falla = new Error("El disco está lleno");
    expect(await p.ops.antesDeCerrar()).toBe(false);
    expect(p.problemas.map((x) => x.titulo)).toEqual([TITULOS.noSePudoGuardar]);
    p.archivos.falla = null;
    cambiar(p.editor, 20_000);
    expect(await p.ops.antesDeCerrar()).toBe(false);
    expect(p.problemas.map((x) => x.titulo)).toEqual([TITULOS.noSePudoGuardar, TITULOS.noSePuedeGuardar]);
    expect(p.archivos.escritos).toEqual([]);
    expect(p.ops.enCurso).toBe(false);
  });

  it("Guardar, pero el documento cambió mientras se escribía: no cierra", async () => {
    const p = preparar();
    cambiar(p.editor);
    p.respuesta = "guardar";
    p.archivos.pausar();
    const cerrando = p.ops.antesDeCerrar();
    await vi.waitFor(() => expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn"]));
    cambiar(p.editor, 60);
    p.archivos.soltar();
    expect(await cerrando).toBe(false);
    expect(p.editor.modificado).toBe(true);
  });

  it("viendo una escena del banco, Guardar guarda el documento y no la escena", async () => {
    const p = preparar();
    cambiar(p.editor);
    const banco = new Editor(docRotados());
    banco.documento.meta.titulo = "Banco de 100";
    cambiar(banco);
    p.mostrado = { editor: banco, esDocumento: false };
    p.puedeAbrir = false;
    p.respuesta = "guardar";
    expect(await p.ops.antesDeCerrar()).toBe(true);
    expect(p.preguntas).toEqual(["Prueba.brn"]);
    expect(p.archivos.llamadas).toEqual(["elegir Prueba.brn", "guardar Prueba.brn"]);
    expect(await abrirEscrito(p.archivos.escritos[0]!.bytes)).toEqual(p.editor.documento);
    expect(p.ops.archivoActual?.nombre).toBe("Prueba.brn");
    expect(p.editor.modificado).toBe(false);
    expect(banco.modificado).toBe(true);
  });

  it("con una operación en curso no se cierra, y avisa", async () => {
    const p = preparar();
    p.archivos.pausar();
    const guardando = p.ops.guardar();
    expect(await p.ops.antesDeCerrar()).toBe(false);
    expect(p.avisos).toEqual([AVISO_CERRAR_EN_CURSO]);
    expect(p.preguntas).toEqual([]);
    p.archivos.soltar();
    expect(await guardando).toBe(true);
    expect(await p.ops.antesDeCerrar()).toBe(true);
  });

  it("con el diálogo ya abierto, otro pedido de cierre (o Abrir) no hace nada", async () => {
    const p = preparar();
    cambiar(p.editor);
    p.esperarRespuesta = true;
    const primero = p.ops.antesDeCerrar();
    await vi.waitFor(() => expect(p.preguntas).toHaveLength(1));
    expect(await p.ops.antesDeCerrar()).toBe(false);
    await p.ops.abrir();
    expect(p.preguntas).toHaveLength(1);
    expect(p.archivos.llamadas).toEqual([]);
    p.responder("noGuardar");
    expect(await primero).toBe(true);
  });
});

/** Una tecla para las funciones puras. */
function tecla(key: string, mods: { ctrl?: boolean; mayus?: boolean; alt?: boolean; meta?: boolean } = {}, code?: string) {
  const c = code ?? (/^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : key);
  return { key, code: c, ctrlKey: !!mods.ctrl, shiftKey: !!mods.mayus, altKey: !!mods.alt, metaKey: !!mods.meta };
}

describe("atajoArchivo", () => {
  it("Ctrl+S, Ctrl+Mayús+S, Ctrl+O y Ctrl+N", () => {
    expect(atajoArchivo(tecla("s", { ctrl: true }))).toBe("guardar");
    expect(atajoArchivo(tecla("S", { ctrl: true, mayus: true }))).toBe("guardarComo");
    expect(atajoArchivo(tecla("o", { ctrl: true }))).toBe("abrir");
    expect(atajoArchivo(tecla("n", { ctrl: true }))).toBe("nuevo");
    // Con Bloq Mayús, la letra viene en mayúscula sin Mayús.
    expect(atajoArchivo(tecla("S", { ctrl: true }))).toBe("guardar");
  });

  it("otras combinaciones no son atajos de archivo", () => {
    expect(atajoArchivo(tecla("s"))).toBeNull();
    expect(atajoArchivo(tecla("S", { mayus: true }))).toBeNull();
    expect(atajoArchivo(tecla("s", { ctrl: true, alt: true }))).toBeNull();
    expect(atajoArchivo(tecla("s", { ctrl: true, meta: true }))).toBeNull();
    expect(atajoArchivo(tecla("O", { ctrl: true, mayus: true }))).toBeNull();
    expect(atajoArchivo(tecla("N", { ctrl: true, mayus: true }))).toBeNull();
    expect(atajoArchivo(tecla("z", { ctrl: true }))).toBeNull();
    expect(atajoArchivo(tecla("F5", { ctrl: true }))).toBeNull();
  });

  it("en un teclado no latino vale la posición física", () => {
    expect(atajoArchivo(tecla("ы", { ctrl: true }, "KeyS"))).toBe("guardar");
    expect(atajoArchivo(tecla("щ", { ctrl: true }, "KeyO"))).toBe("abrir");
  });

  it("no actúa al mantener la tecla, con un modal ni durante un gesto", () => {
    expect(atajoArchivoActua({ repetida: false, modal: false, gesto: false })).toBe(true);
    expect(atajoArchivoActua({ repetida: true, modal: false, gesto: false })).toBe(false);
    expect(atajoArchivoActua({ repetida: false, modal: true, gesto: false })).toBe(false);
    expect(atajoArchivoActua({ repetida: false, modal: false, gesto: true })).toBe(false);
  });
});

describe("esTeclaRecarga", () => {
  it("Ctrl+R, Ctrl+Mayús+R, Ctrl+F5 y Mayús+F5 recargan", () => {
    expect(esTeclaRecarga(tecla("r", { ctrl: true }))).toBe(true);
    expect(esTeclaRecarga(tecla("R", { ctrl: true, mayus: true }))).toBe(true);
    expect(esTeclaRecarga(tecla("F5", { ctrl: true }))).toBe(true);
    expect(esTeclaRecarga(tecla("F5", { mayus: true }))).toBe(true);
    expect(esTeclaRecarga(tecla("F5", { ctrl: true, mayus: true }))).toBe(true);
    // Teclado ruso: la letra impresa es otra, la posición es la de la R.
    expect(esTeclaRecarga(tecla("к", { ctrl: true }, "KeyR"))).toBe(true);
  });

  it("F5 solo es Editar/Simular, y R sola es rotar", () => {
    expect(esTeclaRecarga(tecla("F5"))).toBe(false);
    expect(esTeclaRecarga(tecla("r"))).toBe(false);
    expect(esTeclaRecarga(tecla("R", { mayus: true }))).toBe(false);
  });

  it("con Alt o Meta no son de recarga (son del sistema)", () => {
    expect(esTeclaRecarga(tecla("r", { ctrl: true, alt: true }))).toBe(false);
    expect(esTeclaRecarga(tecla("r", { meta: true }))).toBe(false);
    expect(esTeclaRecarga(tecla("F5", { alt: true }))).toBe(false);
  });

  it("los atajos de archivo no son de recarga", () => {
    expect(esTeclaRecarga(tecla("s", { ctrl: true }))).toBe(false);
    expect(esTeclaRecarga(tecla("o", { ctrl: true }))).toBe(false);
  });
});

describe("tituloVentana y nombreDocumento", () => {
  it("con y sin archivo, con y sin cambios", () => {
    expect(tituloVentana({ archivo: null, titulo: "Sin título", modificado: false })).toBe("Sin título.brn — Bornera");
    expect(tituloVentana({ archivo: null, titulo: "Sin título", modificado: true })).toBe("• Sin título.brn — Bornera");
    expect(tituloVentana({ archivo: "Marcha.brn", titulo: "Sin título", modificado: false })).toBe("Marcha.brn — Bornera");
    expect(tituloVentana({ archivo: "Marcha.brn", titulo: "Sin título", modificado: true })).toBe("• Marcha.brn — Bornera");
  });

  it("sin archivo, el nombre es el que se sugiere al guardar", () => {
    for (const titulo of ["Sin título", 'Marcha: "A"', "", "Señal…", "  puntos.. "]) {
      expect(nombreDocumento(null, titulo)).toBe(nombreArchivo(titulo));
    }
    expect(nombreDocumento(null, 'Marcha: "A"')).toBe("Marcha A.brn");
    expect(nombreDocumento("Otro.brn", "Sin título")).toBe("Otro.brn");
  });
});

describe("lineasProblemas", () => {
  const problema = (i: number): ProblemaArchivo => ({ donde: `hojas[0].componentes[${i}].rot`, mensaje: "tiene que ser 0, 90, 180 o 270 (es 45)" });

  it("donde: mensaje, o solo el mensaje si no hay dónde", () => {
    expect(lineasProblemas([problema(0), { donde: "", mensaje: "No es un archivo de Bornera" }])).toEqual([
      "hojas[0].componentes[0].rot: tiene que ser 0, 90, 180 o 270 (es 45)",
      "No es un archivo de Bornera",
    ]);
  });

  it("hasta 10 líneas, y el resto como «y N más»", () => {
    const diez = Array.from({ length: 10 }, (_, i) => problema(i));
    expect(lineasProblemas(diez)).toHaveLength(10);
    const lineas = lineasProblemas([...diez, problema(10), problema(11)]);
    expect(lineas).toHaveLength(11);
    expect(lineas.at(-1)).toBe("y 2 más");
  });

  it("suma los que `deserializar` ya había recortado", () => {
    const doc = crearDocumento(meta);
    for (let i = 0; i < 30; i++) doc.hojas[0]!.componentes.push({ id: generarId(doc), ...datos("contactor.bobina", i * 10, 0) });
    const json = JSON.parse(serializar(doc));
    for (const c of json.hojas[0].componentes) c.rot = 45;
    const r = deserializar(JSON.stringify(json));
    if (r.ok) throw new Error("tendría que rechazarse");
    // deserializar lista 20 y cierra con "y 10 más".
    expect(r.errores.at(-1)).toEqual({ donde: "", mensaje: "y 10 más" });
    const lineas = lineasProblemas(r.errores);
    expect(lineas).toHaveLength(11);
    expect(lineas.at(-1)).toBe("y 20 más");
  });
});

describe("Recuperar una copia (T23, D2c-A)", () => {
  const original = { nombre: "marcha.brn", ruta: "C:\\x\\marcha.brn" };

  it("el documento queda con cambios, sin deshacer y sin archivo actual; el título lleva el nombre original", async () => {
    const p = preparar();
    const doc = docRotados();
    const r = await p.ops.recuperar(doc, original);
    // La promesa del primer cuadro llega envuelta: si no, el await la esperaría.
    expect(r?.cuadro).toBeInstanceOf(Promise);
    expect(p.reemplazos).toEqual([doc]);
    expect(p.editor.modificado).toBe(true);
    expect(p.editor.puedeDeshacer).toBe(false);
    expect(p.ops.archivoActual).toBeNull();
    expect(p.ops.sugerido).toEqual(original);
    expect(tituloVentana({ archivo: p.ops.nombreVisible, titulo: doc.meta.titulo, modificado: p.editor.modificado })).toBe("• marcha.brn — Bornera");
  });

  it("Guardar pregunta dónde, sugiriendo la ruta original; después queda como archivo actual", async () => {
    const p = preparar();
    await p.ops.recuperar(docRotados(), original);
    expect(await p.ops.guardar()).toBe(true);
    expect(p.archivos.llamadas).toEqual(["elegir C:\\x\\marcha.brn", "guardar C:\\x\\marcha.brn"]);
    expect(p.ops.sugerido).toBeNull();
    expect(p.ops.archivoActual?.nombre).toBe("C:\\x\\marcha.brn");
    expect(p.editor.modificado).toBe(false);
  });

  it("sin archivo original (nunca se guardó), sugiere el nombre del título, como un documento nuevo", async () => {
    const p = preparar();
    const doc = docRotados();
    await p.ops.recuperar(doc, null);
    expect(p.ops.nombreVisible).toBeNull();
    await p.ops.guardar();
    expect(p.archivos.llamadas[0]).toBe(`elegir ${nombreArchivo(doc.meta.titulo)}`);
  });

  it("si el original era .brn.json, Guardar lo escribe por líneas", async () => {
    const p = preparar();
    const doc = docRotados();
    await p.ops.recuperar(doc, { nombre: "x.brn.json", ruta: null });
    await p.ops.guardar();
    expect(new TextDecoder().decode(p.archivos.escritos[0]!.bytes)).toBe(serializarPorLineas(doc));
  });

  it("Abrir y Nuevo limpian el nombre sugerido", async () => {
    const p = preparar();
    p.respuesta = "noGuardar";
    await p.ops.recuperar(docRotados(), original);
    await p.ops.nuevo();
    expect(p.ops.sugerido).toBeNull();
    await p.ops.recuperar(docRotados(), original);
    p.archivos.aAbrir = await archivo(docCables(), "Otro.brn");
    await p.ops.abrir();
    expect(p.ops.sugerido).toBeNull();
    expect(p.ops.nombreVisible).toBe("Otro.brn");
  });

  it("con cambios a la vista, primero pregunta (como Abrir); Cancelar no recupera", async () => {
    const p = preparar();
    cambiar(p.editor);
    p.respuesta = "cancelar";
    expect(await p.ops.recuperar(docRotados(), original)).toBeNull();
    expect(p.preguntas).toHaveLength(1);
    expect(p.reemplazos).toEqual([]);
  });

  it("en Simular o en el banco no recupera", async () => {
    const p = preparar();
    p.puedeAbrir = false;
    expect(await p.ops.recuperar(docRotados(), original)).toBeNull();
    expect(p.reemplazos).toEqual([]);
  });
});

describe("Exportar tal cual una copia que no abre (T23)", () => {
  it("escribe el texto crudo, sin validar, a «<nombre> (copia de recuperación).brn.json»", async () => {
    const p = preparar();
    expect(await p.ops.exportarTexto("{roto", "marcha.brn")).toBe(true);
    expect(p.archivos.llamadas).toEqual(["elegir marcha (copia de recuperación).brn.json", "guardar marcha (copia de recuperación).brn.json"]);
    expect(p.archivos.formatos).toEqual(["brnJson"]);
    expect(new TextDecoder().decode(p.archivos.escritos[0]!.bytes)).toBe("{roto");
    expect(p.avisos).toEqual(["Copia exportada tal cual"]);
    expect(p.ops.enCurso).toBe(false);
  });

  it("Cancelar en el diálogo no escribe; un error se muestra", async () => {
    const p = preparar();
    p.archivos.eleccion = null;
    expect(await p.ops.exportarTexto("x", "Sin título")).toBe(false);
    expect(p.archivos.escritos).toEqual([]);
    p.archivos.eleccion = undefined;
    p.archivos.falla = new Error("disco lleno");
    expect(await p.ops.exportarTexto("x", "Sin título")).toBe(false);
    expect(p.problemas).toEqual([{ titulo: TITULOS.noSePudoGuardar, problemas: [{ donde: "", mensaje: "disco lleno" }] }]);
  });
});

describe("Abrir reciente (T24, D8-A)", () => {
  const RUTA = "C:\\a\\Marcha.brn";

  it("abre la ruta sin selector, como Abrir: historial vacío, archivo actual, «Abierto», y sube en la lista", async () => {
    const p = preparar();
    const doc = docRotados();
    p.archivos.enDisco.set(RUTA, { ...(await archivo(doc)), ruta: RUTA });
    await p.ops.abrirReciente(RUTA);
    expect(p.archivos.llamadas).toEqual([`existe ${RUTA}`, `deRuta ${RUTA}`]);
    expect(p.editor.documento).toEqual(doc);
    expect(p.editor.puedeDeshacer).toBe(false);
    expect(p.ops.archivoActual).toEqual({ nombre: "Marcha.brn", ruta: RUTA });
    expect(p.recientes).toEqual([`agregar ${RUTA}`]);
    expect(p.avisos).toEqual([avisoAbierto(null)]);
    expect(p.ops.enCurso).toBe(false);
  });

  it("si ya no existe: aviso y se quita de la lista, sin preguntar por los cambios ni tocar el documento", async () => {
    const p = preparar();
    const viejo = p.editor;
    cambiar(p.editor);
    await p.ops.abrirReciente(RUTA);
    expect(p.preguntas).toEqual([]);
    expect(p.archivos.llamadas).toEqual([`existe ${RUTA}`]);
    expect(p.recientes).toEqual([`quitar ${RUTA}`]);
    expect(p.avisos).toEqual([avisoNoExiste("Marcha.brn")]);
    expect(avisoNoExiste("Marcha.brn")).toBe("Ya no existe «Marcha.brn»: se quitó de recientes");
    expect(p.editor).toBe(viejo);
    expect(p.ops.enCurso).toBe(false);
  });

  it("D3-A: si no se puede saber (sin permiso), «No se pudo abrir» y queda en la lista", async () => {
    const p = preparar();
    p.archivos.fallaExiste = new Error("forbidden path");
    await p.ops.abrirReciente(RUTA);
    expect(p.problemas).toEqual([{ titulo: TITULOS.noSePudoAbrir, problemas: [{ donde: "", mensaje: "forbidden path" }] }]);
    expect(p.recientes).toEqual([]);
  });

  it("D3-A: un archivo dañado no abre, no toca el documento y queda en la lista (los pasos de Abrir)", async () => {
    const p = preparar();
    const viejo = p.editor;
    p.archivos.enDisco.set(RUTA, { ...archivoTexto("{"), ruta: RUTA });
    await p.ops.abrirReciente(RUTA);
    expect(p.problemas.map((x) => x.titulo)).toEqual([TITULOS.noSePudoAbrir]);
    expect(p.editor).toBe(viejo);
    expect(p.ops.archivoActual).toBeNull();
    expect(p.recientes).toEqual([]);
    expect(p.ops.enCurso).toBe(false);
  });

  it("si desaparece entre mirar y abrir: el error se muestra y queda en la lista", async () => {
    const p = preparar();
    p.archivos.enDisco.set(RUTA, { ...(await archivo(docRotados())), ruta: RUTA });
    p.archivos.fallaDeRuta = new Error("No existe el archivo");
    await p.ops.abrirReciente(RUTA);
    expect(p.problemas).toEqual([{ titulo: TITULOS.noSePudoAbrir, problemas: [{ donde: "", mensaje: "No existe el archivo" }] }]);
    expect(p.recientes).toEqual([]);
    expect(p.reemplazos).toEqual([]);
  });

  it("con cambios pregunta: Cancelar no abre; No guardar abre", async () => {
    const p = preparar();
    const viejo = p.editor;
    cambiar(p.editor);
    p.archivos.enDisco.set(RUTA, { ...(await archivo(docRotados())), ruta: RUTA });
    await p.ops.abrirReciente(RUTA);
    expect(p.preguntas).toEqual(["Prueba.brn"]);
    expect(p.editor).toBe(viejo);
    expect(p.archivos.llamadas).toEqual([`existe ${RUTA}`]);
    p.respuesta = "noGuardar";
    await p.ops.abrirReciente(RUTA);
    expect(p.reemplazos).toHaveLength(1);
    expect(p.ops.archivoActual?.ruta).toBe(RUTA);
  });

  it("el documento cambió mientras se leía: se cancela y no sube en la lista", async () => {
    const p = preparar();
    p.archivos.enDisco.set(RUTA, { ...(await archivo(docRotados())), ruta: RUTA });
    p.archivos.alLeer = () => cambiar(p.editor);
    await p.ops.abrirReciente(RUTA);
    expect(p.avisos).toEqual([AVISOS_ABRIR.documentoCambio]);
    expect(p.reemplazos).toEqual([]);
    expect(p.recientes).toEqual([]);
  });

  it("D17: en Simular o en el banco, o con otra operación en curso, no hace nada (ni mira el disco)", async () => {
    const p = preparar();
    p.puedeAbrir = false;
    await p.ops.abrirReciente(RUTA);
    p.puedeAbrir = true;
    p.archivos.pausar();
    cambiar(p.editor);
    const guardando = p.ops.guardar();
    await Promise.resolve();
    await p.ops.abrirReciente(RUTA);
    p.archivos.soltar();
    await guardando;
    expect(p.archivos.llamadas.filter((l) => l.startsWith("existe"))).toEqual([]);
  });

  it("en el navegador (sin existe ni deRuta) no hace nada", async () => {
    const p = preparar();
    const archivos: Archivos = {
      elegirParaAbrir: p.archivos.elegirParaAbrir.bind(p.archivos),
      elegirDestino: p.archivos.elegirDestino.bind(p.archivos),
      guardar: p.archivos.guardar.bind(p.archivos),
    };
    const ops = new OperacionesArchivo({ ...(p.ops as unknown as { deps: DependenciasArchivo }).deps, archivos });
    await ops.abrirReciente(RUTA);
    expect(p.archivos.llamadas).toEqual([]);
    expect(p.avisos).toEqual([]);
  });
});

describe("Qué entra a la lista de recientes (T24, D2-A)", () => {
  it("Abrir con ruta suma; sin ruta (el navegador), no", async () => {
    const p = preparar();
    p.archivos.aAbrir = { ...(await archivo(docRotados())), ruta: "C:\\a\\Marcha.brn" };
    await p.ops.abrir();
    p.archivos.aAbrir = await archivo(docRotados());
    await p.ops.abrir();
    expect(p.recientes).toEqual(["agregar C:\\a\\Marcha.brn"]);
  });

  it("Guardar y Guardar como con ruta suman; Exportar, una escena del banco, un error y el navegador, no", async () => {
    const p = preparar();
    cambiar(p.editor);
    p.archivos.carpeta = "C:\\a";
    expect(await p.ops.guardar()).toBe(true);
    p.archivos.eleccion = "Otro.brn";
    expect(await p.ops.guardar(true)).toBe(true);
    expect(await p.ops.exportar()).toBe(true);
    const banco = new Editor(docCables());
    p.mostrado = { editor: banco, esDocumento: false };
    expect(await p.ops.guardar()).toBe(true);
    p.mostrado = { editor: p.editor, esDocumento: true };
    p.archivos.falla = new Error("disco lleno");
    expect(await p.ops.guardar(true)).toBe(false);
    p.archivos.falla = null;
    p.archivos.carpeta = null;
    expect(await p.ops.guardar(true)).toBe(true);
    expect(p.recientes).toEqual(["agregar C:\\a\\Prueba.brn", "agregar C:\\a\\Otro.brn"]);
  });

  it("Recuperar y Nuevo no tocan la lista", async () => {
    const p = preparar();
    await p.ops.recuperar(docRotados(), { nombre: "x.brn", ruta: "C:\\a\\x.brn" });
    await p.ops.nuevo();
    p.respuesta = "noGuardar";
    await p.ops.nuevo();
    expect(p.recientes).toEqual([]);
  });
});
