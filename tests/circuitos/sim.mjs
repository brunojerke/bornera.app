// Archivos congelados de la simulación (T30, M4-A): `oscilante.brn`,
// `corto.brn`, `carrera.brn` y `cadena.brn`, los documentos de
// `src/core/circuitos/sim.ts` guardados como los guarda Bornera (gzip,
// formato versión 1). Los abre `sim.test.ts` y los compara con los armados.
// Igual que `inversion.mjs`: cuando el formato cambie, estos archivos no se
// regeneran, tienen que seguir abriendo igual.
//
// Se regeneran solo a propósito, si un armado cambia (el test falla y lo pide):
//   node tests/circuitos/sim.mjs
// Usa el `serializar` y el `empaquetar` de la app (cargados con Vite).
// Importar este módulo no genera nada.

import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const NOMBRES = ["oscilante", "corto", "carrera", "cadena"];
export const REGENERAR = "node tests/circuitos/sim.mjs";

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
    const { ARMADOS_SIM } = await servidor.ssrLoadModule("/src/core/circuitos/sim.ts");

    for (const nombre of NOMBRES) {
      const texto = serializar(ARMADOS_SIM[nombre]().doc);
      if (JSON.parse(texto).version !== 1) throw new Error(`${nombre}: se esperaba el formato versión 1: ${texto.slice(0, 80)}`);
      const r = deserializar(texto);
      if (!r.ok) throw new Error(`${nombre}: el documento no abre: ${JSON.stringify(r.errores)}`);
      if (r.avisos.length > 0) throw new Error(`${nombre}: el documento abre con avisos: ${JSON.stringify(r.avisos)}`);
      if (serializar(r.documento) !== texto) throw new Error(`${nombre}: al abrirlo y volver a guardarlo, el texto cambia.`);
      const { bytes, comprimido } = await empaquetar(texto);
      if (!comprimido) throw new Error("No se comprimió (falta CompressionStream).");
      const ruta = fileURLToPath(new URL(`./${nombre}.brn`, import.meta.url));
      writeFileSync(ruta, bytes);
      console.log(`${ruta}: ${bytes.length} bytes (${texto.length} caracteres de JSON).`);
    }
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
