import { describe, expect, it, vi } from "vitest";
import { deserializar, serializar, type ProblemaArchivo } from "../core/io";
import { datos, docCables, docRotados, meta } from "../core/io/prueba-documentos";
import { CambiarEtiqueta, colocar } from "../core/model/comandos";
import { crearDocumento, generarId } from "../core/model/documento";
import { Editor } from "../editor/editor";
import type { ArchivoAbierto, Archivos, Destino } from "./archivos";
import {
  atajoArchivo,
  atajoArchivoActua,
  avisoGuardado,
  esTeclaRecarga,
  lineasProblemas,
  OperacionesArchivo,
  TITULOS,
  tituloVentana,
  type Mostrado,
} from "./archivo";
import { desempaquetar } from "./brn";

/** Archivos de mentira: anotan cada llamada y lo escrito. */
class ArchivosFalsos implements Archivos {
  llamadas: string[] = [];
  escritos: { nombre: string; bytes: Uint8Array }[] = [];
  /** Lo que se elige en Guardar como: un nombre, null (cancelar) o undefined (el sugerido). */
  eleccion: string | null | undefined = undefined;
  /** Si está, la escritura falla con este error. */
  falla: Error | null = null;
  /** Si está, la escritura espera a que se llame a `soltar`. */
  private pausa: Promise<void> | null = null;
  soltar: () => void = () => undefined;

  pausar(): void {
    this.pausa = new Promise((r) => (this.soltar = r));
  }

  async abrir(): Promise<ArchivoAbierto | null> {
    this.llamadas.push("abrir");
    return null;
  }

  async guardarComo(bytes: Uint8Array, sugerido: string): Promise<Destino | null> {
    this.llamadas.push(`guardarComo ${sugerido}`);
    if (this.eleccion === null) return null;
    const nombre = this.eleccion ?? sugerido;
    await this.escribir(nombre, bytes);
    return { nombre, ruta: null };
  }

  async guardar(destino: Destino, bytes: Uint8Array): Promise<void> {
    this.llamadas.push(`guardar ${destino.nombre}`);
    await this.escribir(destino.nombre, bytes);
  }

  private async escribir(nombre: string, bytes: Uint8Array): Promise<void> {
    if (this.pausa) await this.pausa;
    if (this.falla) throw this.falla;
    this.escritos.push({ nombre, bytes });
  }
}

function preparar() {
  const archivos = new ArchivosFalsos();
  const editor = new Editor(docCables());
  const p = {
    archivos,
    editor,
    mostrado: { editor, esDocumento: true } as Mostrado | null,
    problemas: [] as { titulo: string; problemas: readonly ProblemaArchivo[] }[],
    avisos: [] as string[],
    confirmados: 0,
    /** Lo que hace el panel al confirmar (por defecto, nada). */
    alConfirmar: () => {},
    reloj: 0,
    medir: false,
    ops: null as unknown as OperacionesArchivo,
  };
  p.ops = new OperacionesArchivo({
    archivos,
    mostrado: () => p.mostrado,
    confirmarPanel: () => {
      p.confirmados++;
      p.alConfirmar();
    },
    mostrarProblemas: (titulo, problemas) => p.problemas.push({ titulo, problemas }),
    avisar: (t) => p.avisos.push(t),
    ahora: () => p.reloj,
    get medir() {
      return p.medir;
    },
  });
  return p;
}

/** Un cambio cualquiera en el documento del editor. */
function cambiar(ed: Editor, x = 40): void {
  ed.ejecutar(colocar(ed.documento, datos("contactor.bobina", x, 0)));
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
    expect(p.archivos.llamadas).toEqual(["guardarComo Prueba.brn"]);
    expect(p.ops.archivoActual).toEqual({ nombre: "Prueba.brn", ruta: null });
    expect(p.editor.modificado).toBe(false);
    cambiar(p.editor, 50);
    expect(await p.ops.guardar()).toBe(true);
    expect(p.archivos.llamadas).toEqual(["guardarComo Prueba.brn", "guardar Prueba.brn"]);
    expect(p.editor.modificado).toBe(false);
  });

  it("Guardar como siempre pide y fija el archivo actual", async () => {
    const p = preparar();
    await p.ops.guardar();
    p.archivos.eleccion = "Otro.brn";
    expect(await p.ops.guardar(true)).toBe(true);
    expect(p.archivos.llamadas).toEqual(["guardarComo Prueba.brn", "guardarComo Prueba.brn"]);
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
    await vi.waitFor(() => expect(p.archivos.llamadas).toHaveLength(1));
    expect(await p.ops.guardar(true)).toBe(false);
    expect(await p.ops.guardar()).toBe(false);
    expect(p.confirmados).toBe(1);
    p.archivos.soltar();
    expect(await primera).toBe(true);
    expect(p.archivos.llamadas).toHaveLength(1);
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
    expect(p.archivos.llamadas.at(-1)).toBe("guardarComo Banco de 100.brn");
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

  it("avisoGuardado", () => {
    expect(avisoGuardado(true, null)).toBe("Guardado");
    expect(avisoGuardado(false, null)).toBe("Guardado sin comprimir");
    expect(avisoGuardado(true, 12)).toBe("Guardado en 12 ms");
    expect(avisoGuardado(false, 0)).toBe("Guardado sin comprimir en 0 ms");
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

describe("tituloVentana", () => {
  it("con y sin archivo, con y sin cambios", () => {
    expect(tituloVentana({ archivo: null, titulo: "Sin título", modificado: false })).toBe("Sin título — Bornera");
    expect(tituloVentana({ archivo: null, titulo: "Sin título", modificado: true })).toBe("• Sin título — Bornera");
    expect(tituloVentana({ archivo: "Marcha.brn", titulo: "Sin título", modificado: false })).toBe("Marcha.brn — Bornera");
    expect(tituloVentana({ archivo: "Marcha.brn", titulo: "Sin título", modificado: true })).toBe("• Marcha.brn — Bornera");
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
