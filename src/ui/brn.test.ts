import { afterEach, describe, expect, it, vi } from "vitest";
import { deserializar, serializar } from "../core/io";
import { docCables, documentosDePrueba } from "../core/io/prueba-documentos";
import type { Documento } from "../core/model/documento";
import { documentoBancoCables } from "../editor/banco";
import { desempaquetar, empaquetar, MENSAJES, nombreArchivo, TOPE_BYTES } from "./brn";

afterEach(() => {
  vi.unstubAllGlobals();
});

const utf8 = (texto: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(texto);

/** Gzip directo, sin pasar por `empaquetar`: para armar archivos de prueba (dañados, con UTF-8 inválido). */
async function gzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const legible = new ReadableStream<BufferSource>({
    start(control) {
      control.enqueue(bytes);
      control.close();
    },
  }).pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(legible).arrayBuffer());
}

/** Un gzip que se expande a `megas` MB de ceros (pesa unos KB). */
async function bomba(megas: number): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const salida = new Response(cs.readable).arrayBuffer();
  const escritor = cs.writable.getWriter();
  const mega = new Uint8Array(1024 * 1024);
  for (let i = 0; i < megas; i++) await escritor.write(mega);
  await escritor.close();
  return new Uint8Array(await salida);
}

const TEXTO = serializar(docCables());

// ── Ida y vuelta ───────────────────────────────────────────────────────────

describe("empaquetar → desempaquetar → deserializar", () => {
  const documentos: [string, () => Documento][] = [
    ...documentosDePrueba().map(([nombre, doc]): [string, () => Documento] => [nombre, () => doc]),
    ["banco de 2000 con cables", () => documentoBancoCables(2000)],
  ];

  it.each(documentos)("%s: vuelve igual (toEqual) pasando por gzip", async (_nombre, crear) => {
    const doc = crear();
    const texto = serializar(doc);
    const { bytes, comprimido } = await empaquetar(texto);
    expect(comprimido).toBe(true);
    expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
    const r = await desempaquetar(bytes);
    expect(r).toEqual({ ok: true, texto });
    if (!r.ok) return;
    const abierto = deserializar(r.texto);
    expect(abierto.ok ? [] : abierto.errores).toEqual([]);
    if (!abierto.ok) return;
    expect(abierto.documento).toEqual(doc);
  });

  it("comprime de verdad: el banco de 2000 con cables pesa menos de un tercio", async () => {
    const texto = serializar(documentoBancoCables(2000));
    const { bytes } = await empaquetar(texto);
    expect(bytes.length).toBeLessThan(texto.length / 3);
  });

  it("un texto largo con tildes, partido en muchos trozos al descomprimir, vuelve igual", async () => {
    // 400 KB: la descompresión lo entrega en varios trozos y alguna "á" queda partida entre dos.
    const texto = "x" + "á".repeat(200_000);
    expect(await desempaquetar((await empaquetar(texto)).bytes)).toEqual({ ok: true, texto });
  });
});

// ── Texto plano y archivos dañados ─────────────────────────────────────────

describe("desempaquetar: texto plano (D1-B) y archivos dañados", () => {
  it("texto plano sin comprimir: abre", async () => {
    const r = await desempaquetar(utf8(TEXTO));
    expect(r).toEqual({ ok: true, texto: TEXTO });
    expect(r.ok && deserializar(r.texto).ok).toBe(true);
  });

  it("gzip roto: un byte cambiado en el medio, o el CRC mal", async () => {
    const bueno = (await empaquetar(TEXTO)).bytes;
    const medio = bueno.slice();
    medio[Math.floor(medio.length / 2)]! ^= 0xff;
    expect(await desempaquetar(medio)).toEqual({ ok: false, error: MENSAJES.danado });
    const crc = bueno.slice();
    crc[crc.length - 6]! ^= 0xff;
    expect(await desempaquetar(crc)).toEqual({ ok: false, error: MENSAJES.danado });
  });

  it("gzip cortado: en cualquier largo, desde la cabecera sola", async () => {
    const bueno = (await empaquetar(TEXTO)).bytes;
    for (const largo of [2, 3, 10, 20, Math.floor(bueno.length / 2), bueno.length - 8, bueno.length - 1]) {
      expect(await desempaquetar(bueno.slice(0, largo)), `largo ${largo}`).toEqual({ ok: false, error: MENSAJES.danado });
    }
  });

  it("UTF-8 inválido, en texto plano y dentro del gzip", async () => {
    const malo = new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x7d]); // {"\xff"}
    expect(await desempaquetar(malo)).toEqual({ ok: false, error: MENSAJES.utf8 });
    expect(await desempaquetar(await gzip(malo))).toEqual({ ok: false, error: MENSAJES.utf8 });
  });

  it("un archivo que termina a mitad de una «á»: error, en texto plano y dentro del gzip", async () => {
    const entero = utf8('{"titulo":"á');
    const cortado = entero.slice(0, -1); // queda el primer byte de la «á» (0xc3)
    expect(cortado.at(-1)).toBe(0xc3);
    expect(await desempaquetar(cortado)).toEqual({ ok: false, error: MENSAJES.utf8 });
    // Dentro del gzip el error lo da recién el decode() final, sin argumentos.
    expect(await desempaquetar(await gzip(cortado))).toEqual({ ok: false, error: MENSAJES.utf8 });
    expect(await desempaquetar(await gzip(entero))).toEqual({ ok: true, texto: '{"titulo":"á' });
  });
});

// ── Tope de 16 MB (D18) ────────────────────────────────────────────────────

describe("desempaquetar: tope de 16 MB (D18)", () => {
  it("un archivo de más de 16 MB ni se lee: ni comprimido ni en texto", async () => {
    const leido = vi.fn();
    vi.stubGlobal(
      "DecompressionStream",
      class {
        constructor() {
          leido();
          throw new Error("no se tenía que descomprimir");
        }
      },
    );
    vi.stubGlobal(
      "TextDecoder",
      class {
        constructor() {
          leido();
        }
        decode(): string {
          return "";
        }
      },
    );
    const comprimido = new Uint8Array(TOPE_BYTES + 1);
    comprimido.set([0x1f, 0x8b]);
    expect(await desempaquetar(comprimido)).toEqual({ ok: false, error: MENSAJES.grande });
    expect(await desempaquetar(new Uint8Array(TOPE_BYTES + 1).fill(0x61))).toEqual({ ok: false, error: MENSAJES.grande });
    expect(leido).not.toHaveBeenCalled();
  });

  it("16 MB justos abren", async () => {
    const r = await desempaquetar(new Uint8Array(TOPE_BYTES).fill(0x61));
    expect(r.ok && r.texto.length).toBe(TOPE_BYTES);
  });

  it("bomba de descompresión: un gzip de pocos KB que se expande a 32 MB corta al pasar el tope, sin leer el resto", async () => {
    const archivo = await bomba(32);
    expect(archivo.length).toBeLessThan(100 * 1024);
    // Se cuenta lo que entrega el DecompressionStream real, trozo por trozo.
    const Real = DecompressionStream;
    let entregados = 0;
    vi.stubGlobal(
      "DecompressionStream",
      class {
        readonly readable: ReadableStream<Uint8Array>;
        readonly writable: WritableStream<BufferSource>;
        constructor(formato: CompressionFormat) {
          const real = new Real(formato);
          this.writable = real.writable;
          this.readable = real.readable.pipeThrough(
            new TransformStream<Uint8Array, Uint8Array>({
              transform(trozo, control) {
                entregados += trozo.length;
                control.enqueue(trozo);
              },
            }),
          );
        }
      },
    );
    expect(await desempaquetar(archivo)).toEqual({ ok: false, error: MENSAJES.grande });
    expect(entregados).toBeGreaterThan(TOPE_BYTES);
    // Corta enseguida: a lo sumo unos trozos más allá del tope, lejos de los 32 MB.
    expect(entregados).toBeLessThan(TOPE_BYTES + 1024 * 1024);
  });
});

// ── Sin CompressionStream o DecompressionStream ────────────────────────────

describe("sin CompressionStream o DecompressionStream", () => {
  it("sin CompressionStream: guarda el texto sin comprimir, lo dice, y el archivo abre igual (D1-B)", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    const { bytes, comprimido } = await empaquetar(TEXTO);
    expect(comprimido).toBe(false);
    expect(bytes).toEqual(utf8(TEXTO));
    expect(await desempaquetar(bytes)).toEqual({ ok: true, texto: TEXTO });
  });

  it("si CompressionStream falla: igual que si no existiera", async () => {
    vi.stubGlobal(
      "CompressionStream",
      class {
        constructor() {
          throw new Error("falla a propósito");
        }
      },
    );
    const { bytes, comprimido } = await empaquetar(TEXTO);
    expect(comprimido).toBe(false);
    expect(bytes).toEqual(utf8(TEXTO));
  });

  it("sin DecompressionStream: un gzip da error con mensaje; el texto plano abre", async () => {
    const comprimido = (await empaquetar(TEXTO)).bytes;
    vi.stubGlobal("DecompressionStream", undefined);
    expect(await desempaquetar(comprimido)).toEqual({ ok: false, error: MENSAJES.sinGzip });
    expect(await desempaquetar(utf8(TEXTO))).toEqual({ ok: true, texto: TEXTO });
  });
});

// ── nombreArchivo ──────────────────────────────────────────────────────────

describe("nombreArchivo", () => {
  it.each([
    ["Marcha-parada", "Marcha-parada.brn"],
    ['a/b\\c:d*e?f"g<h>i|j', "abcdefghij.brn"],
    ["Hoja\nuno\t2\u0000\u007f", "Hojauno2.brn"],
    ["", "circuito.brn"],
    ["   ", "circuito.brn"],
    ['/\\:*?"<>|', "circuito.brn"],
    ["...", "circuito.brn"],
    ["Motor 1...", "Motor 1.brn"],
    ["Motor . . ", "Motor.brn"],
    ["  Arranque estrella-triángulo  ", "Arranque estrella-triángulo.brn"],
    ["Señalización ñandú", "Señalización ñandú.brn"],
  ])("%j → %j", (titulo, nombre) => {
    expect(nombreArchivo(titulo)).toBe(nombre);
  });
});
