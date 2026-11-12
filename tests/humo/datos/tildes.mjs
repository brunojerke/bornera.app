// Archivo de la prueba de tildes (T15a): `tildes.brn`, un circuito chico con
// título, autor y etiquetas con tildes, ñ, ü y comillas. Lo abre el humo
// (t15a-archivo) y es el que se abre en la netbook para el criterio "Etiqueta
// y título con tildes sobreviven": el panel solo acepta etiquetas sin tilde y
// T15a no edita el título, así que no se puede armar desde la interfaz.
//
// Se genera con el `serializar` y el `empaquetar` de la app (cargados con
// Vite), así es exactamente lo que Bornera escribe:
//   node tests/humo/datos/tildes.mjs
// El humo importa solo las constantes; importar este módulo no genera nada.

import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const NOMBRE = "tildes.brn";
export const RUTA = fileURLToPath(new URL(`./${NOMBRE}`, import.meta.url));
export const TITULO = `Arranque «estrella-triángulo» "Ñandú" y 'pingüino'`;
export const AUTOR = "Íñigo Ibáñez";
/** Etiqueta del primer componente (la bobina). */
export const ETIQUETA = `Señal "K1" ñ áéíóú Ü`;
/** Etiqueta del segundo componente (el pulsador). */
export const ETIQUETA_2 = `Marcha 'S1' ¿sí?`;

const RAIZ = fileURLToPath(new URL("../../..", import.meta.url));

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
    const { crearDocumento } = await servidor.ssrLoadModule("/src/core/model/documento.ts");
    const { colocar, cablear } = await servidor.ssrLoadModule("/src/core/model/comandos.ts");

    const doc = crearDocumento({ titulo: TITULO, autor: AUTOR, fecha: "2026-11-12" });
    const componente = (tipo, x, y, etiqueta) => {
      const cmd = colocar(doc, { tipo, x, y, rot: 0, espejado: false, etiqueta, params: {} });
      cmd.aplicar(doc);
      return cmd.id;
    };
    const k1 = componente("contactor.bobina", 0, 0, ETIQUETA);
    componente("pulsador.na", 10, 0, ETIQUETA_2);
    cablear(doc, { desde: { tipo: "borne", comp: k1, borne: "A1" }, hasta: { tipo: "libre", x: 0, y: -6 }, codos: [] }).aplicar(doc);

    const texto = serializar(doc);
    const r = deserializar(texto);
    if (!r.ok) throw new Error(`El documento no abre: ${JSON.stringify(r.errores)}`);
    if (r.avisos.length > 0) throw new Error(`El documento abre con avisos: ${JSON.stringify(r.avisos)}`);
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
