// Empaquetado del archivo .brn (T15a): texto ↔ bytes, con gzip y tope de
// tamaño. Va fuera del núcleo porque usa CompressionStream y
// DecompressionStream del navegador; el núcleo (src/core/io) pasa
// Documento ↔ texto.
//
// Guardar escribe gzip. Abrir acepta gzip o el JSON en texto plano, y los
// distingue por los dos primeros bytes (1f 8b) (D1-B). El tope de 16 MB vale
// para el archivo y para lo descomprimido, y se cuenta mientras se
// descomprime: una bomba de descompresión corta ahí, sin leer el resto (D18).

/** Tope del archivo, comprimido y descomprimido: 16 MB (D18). */
export const TOPE_BYTES = 16 * 1024 * 1024;

/** Mensajes para el usuario (los errores de los streams no traen un texto útil). */
export const MENSAJES = {
  grande: "El archivo es demasiado grande (el máximo es 16 MB)",
  danado: "El archivo comprimido está dañado",
  utf8: "El archivo no es texto UTF-8 válido",
  sinGzip: "Este sistema no puede abrir archivos comprimidos",
  ilegible: "No se pudo leer el archivo",
} as const;

export interface Empaquetado {
  bytes: Uint8Array;
  /**
   * False si se escribió el texto sin comprimir porque no hay
   * CompressionStream (solo puede pasar en Linux) o falló. El archivo abre
   * igual (D1-B); la interfaz lo avisa.
   */
  comprimido: boolean;
}

export type ResultadoDesempaquetar = { ok: true; texto: string } | { ok: false; error: string };

/** Pasa el texto a UTF-8 y lo comprime con gzip. No tira. */
export async function empaquetar(texto: string): Promise<Empaquetado> {
  const plano = new TextEncoder().encode(texto);
  if (typeof CompressionStream === "undefined") return { bytes: plano, comprimido: false };
  try {
    const legible = fuente(plano).pipeThrough(new CompressionStream("gzip"));
    return { bytes: new Uint8Array(await new Response(legible).arrayBuffer()), comprimido: true };
  } catch {
    return { bytes: plano, comprimido: false };
  }
}

/**
 * Bytes de un archivo .brn → su texto, gzip o plano. No tira: cualquier
 * problema vuelve como `ok: false` con un mensaje para el usuario.
 */
export async function desempaquetar(bytes: Uint8Array): Promise<ResultadoDesempaquetar> {
  try {
    // Un archivo más grande que el tope ni se lee (tampoco comprimido).
    if (bytes.length > TOPE_BYTES) return fallo(MENSAJES.grande);
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return await descomprimir(bytes);
    return decodificar(bytes);
  } catch {
    return fallo(MENSAJES.ilegible);
  }
}

/**
 * Nombre de archivo sugerido para un título: quita `/ \ : * ? " < > |` y los
 * caracteres de control, los espacios de los lados y los puntos (y espacios)
 * del final, y agrega `.brn`. Si no queda nada, `circuito.brn`. Las tildes se
 * conservan.
 */
export function nombreArchivo(titulo: string): string {
  const limpio = titulo
    .replace(/[\/\\:*?"<>|\p{Cc}]/gu, "")
    .trim()
    .replace(/[\s.]+$/u, "");
  return `${limpio || "circuito"}.brn`;
}

function fallo(error: string): ResultadoDesempaquetar {
  return { ok: false, error };
}

/** Un stream que entrega los bytes en un solo trozo (BufferSource: lo que piden CompressionStream y DecompressionStream). */
function fuente(bytes: Uint8Array): ReadableStream<BufferSource> {
  return new ReadableStream<BufferSource>({
    start(control) {
      // Solo de tipos: los bytes de un archivo nunca vienen en un
      // SharedArrayBuffer. Copiarlos costaría hasta 16 MB más.
      control.enqueue(bytes as Uint8Array<ArrayBuffer>);
      control.close();
    },
  });
}

/** Texto plano: UTF-8 estricto (un byte inválido o un carácter cortado al final es un error). */
function decodificar(bytes: Uint8Array): ResultadoDesempaquetar {
  try {
    return { ok: true, texto: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return fallo(MENSAJES.utf8);
  }
}

/**
 * Gzip: se lee de a trozos sumando los bytes descomprimidos. Al pasar el tope
 * se cancela la lectura y no se junta el resto. Cada trozo se decodifica al
 * llegar (UTF-8 estricto, en modo stream), así no se arma una copia extra de
 * todo el archivo.
 */
async function descomprimir(bytes: Uint8Array): Promise<ResultadoDesempaquetar> {
  if (typeof DecompressionStream === "undefined") return fallo(MENSAJES.sinGzip);
  const lector = fuente(bytes).pipeThrough(new DecompressionStream("gzip")).getReader();
  const decodificador = new TextDecoder("utf-8", { fatal: true });
  const partes: string[] = [];
  let total = 0;
  const cortar = async (error: string): Promise<ResultadoDesempaquetar> => {
    await lector.cancel().catch(() => undefined);
    return fallo(error);
  };
  for (;;) {
    let trozo: ReadableStreamReadResult<Uint8Array>;
    try {
      trozo = await lector.read();
    } catch {
      // Gzip roto, cortado o con el CRC mal: el stream da error.
      return fallo(MENSAJES.danado);
    }
    if (trozo.done) break;
    total += trozo.value.length;
    if (total > TOPE_BYTES) return cortar(MENSAJES.grande);
    try {
      partes.push(decodificador.decode(trozo.value, { stream: true }));
    } catch {
      return cortar(MENSAJES.utf8);
    }
  }
  try {
    // Sin argumentos: termina el stream y da error si quedó un carácter cortado al final.
    partes.push(decodificador.decode());
  } catch {
    return fallo(MENSAJES.utf8);
  }
  return { ok: true, texto: partes.join("") };
}
