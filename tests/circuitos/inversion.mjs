// Archivo congelado de la inversión de giro (cierre 3b, etapa 1):
// `inversion.brn`, el documento de `inversion()` guardado como lo guarda
// Bornera (gzip, formato versión 1). Lo abre `inversion.test.ts` y lo compara
// con el armado. Igual que `marcha-parada.mjs`: cuando el formato cambie,
// este archivo no se regenera, tiene que seguir abriendo igual.
//
// Se regenera solo a propósito, si el armado cambia (el test falla y lo pide):
//   node tests/circuitos/inversion.mjs
// Usa el `serializar` y el `empaquetar` de la app (cargados con Vite).
// Importar este módulo no genera nada.

import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const NOMBRE = "inversion.brn";
export const RUTA = fileURLToPath(new URL(`./${NOMBRE}`, import.meta.url));
export const REGENERAR = "node tests/circuitos/inversion.mjs";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));

async function generar() {
  const { createServer } = await import("vite");
  const servidor = await createServer({
    root: RAIZ,
    logLevel: "error",
    clearScreen: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const { serializar, deserializar } = await servidor.ssrLoadModule("/src/core/io/index.ts");
    const { empaquetar } = await servidor.ssrLoadModule("/src/ui/brn.ts");
    const { inversion } = await servidor.ssrLoadModule("/src/core/circuitos/inversion.ts");

    const texto = serializar(inversion().doc);
    if (JSON.parse(texto).version !== 1) throw new Error(`Se esperaba el formato versión 1: ${texto.slice(0, 80)}`);
    const r = deserializar(texto);
    if (!r.ok) throw new Error(`El documento no abre: ${JSON.stringify(r.errores)}`);
    if (r.avisos.length > 0) throw new Error(`El documento abre con avisos: ${JSON.stringify(r.avisos)}`);
    if (serializar(r.documento) !== texto) throw new Error("Al abrirlo y volver a guardarlo, el texto cambia.");
    const { bytes, comprimido } = await empaquetar(texto);
    if (!comprimido) throw new Error("No se comprimió (falta CompressionStream).");
    writeFileSync(RUTA, bytes);
    console.log(`${RUTA}: ${bytes.length} bytes (${texto.length} caracteres de JSON).`);
  } finally {
    await servidor.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  generar().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
