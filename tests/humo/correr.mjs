// npm run humo: pruebas de humo de la app real, en un Chrome, Chromium o Edge
// headless a 1024×600 (la pantalla de la netbook).
//
// Levanta Vite con la app (en un puerto libre: puede haber un `npm run dev`
// andando) y corre cada prueba `*.mjs` de esta carpeta (menos este archivo y
// cdp.mjs: `tNN-*.mjs` por tarea, o con nombre de tema), en orden, con la
// app recién cargada. Una prueba exporta `nombre` y una función por defecto
// que recibe la página (cdp.mjs), `comprobar(descripcion, ok, detalle?)` y
// `{ cargar }`: `cargar("/src/…ts")` carga un módulo de la app en Node con el
// mismo Vite (`ssrLoadModule`), para comparar en Node con el código de la app
// (T15). Después de cada prueba se comprueba también que la página no haya
// tenido errores (excepciones ni console.error).
//
// Cada tarea suma sus comprobaciones acá: lo que se probó a mano en el
// navegador, queda.
//
// Uso:
//   npm run humo                       todas
//   npm run humo -- t08                solo las que empiezan con t08
//   npm run humo -- --capturas=CARPETA guarda capturas de pantalla
//   npm run humo -- --navegador=RUTA   (o variable BORNERA_NAVEGADOR)
//   npm run humo -- --ver              con la ventana del navegador a la vista

import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";
import { buscarNavegador } from "../navegador.mjs";
import { esperar, Pagina } from "./cdp.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../..");
/** Tiempo máximo de una prueba. */
const LIMITE_PRUEBA_MS = 60_000;

const args = process.argv.slice(2);
const opcion = (nombre) => args.find((a) => a.startsWith(`--${nombre}=`))?.split("=").slice(1).join("=");
const bandera = (nombre) => args.includes(`--${nombre}`);
const filtros = args.filter((a) => !a.startsWith("--"));

/** Pruebas de la carpeta, en orden: fuentes-simbolos, t06-…, t07-…, t08-… */
function pruebas() {
  return readdirSync(AQUI)
    .filter((f) => f.endsWith(".mjs") && f !== "correr.mjs" && f !== "cdp.mjs")
    .filter((f) => filtros.length === 0 || filtros.some((x) => f.startsWith(x)))
    .sort();
}

/** Espera a que el navegador anote su puerto de depuración y devuelve la pestaña. */
async function pestana(perfil) {
  const archivo = join(perfil, "DevToolsActivePort");
  for (let i = 0; i < 150; i++) {
    if (existsSync(archivo)) {
      const [puerto] = readFileSync(archivo, "utf8").split("\n");
      try {
        const lista = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json();
        const p = lista.find((t) => t.type === "page");
        if (p) return p.webSocketDebuggerUrl;
      } catch {
        // todavía no atiende
      }
    }
    await esperar(100);
  }
  throw new Error("El navegador no abrió el puerto de depuración.");
}

/**
 * Primera carga, que no cuenta: Vite optimiza dependencias en la primera
 * visita y a veces la página falla al importar un módulo y hay que recargar.
 * Hasta 3 intentos; sus errores no se anotan.
 */
async function calentar(pagina, url) {
  for (let intento = 1; ; intento++) {
    try {
      await pagina.abrir(url);
      return;
    } catch (e) {
      if (intento === 3) throw new Error(`La app no carga: ${e instanceof Error ? e.message : e}`);
    }
  }
}

function conLimite(promesa, ms, mensaje) {
  let reloj;
  const vencido = new Promise((_, rechazar) => (reloj = setTimeout(() => rechazar(new Error(mensaje)), ms)));
  return Promise.race([promesa, vencido]).finally(() => clearTimeout(reloj));
}

async function main() {
  const archivos = pruebas();
  if (archivos.length === 0) throw new Error(`No hay pruebas que coincidan con: ${filtros.join(" ")}`);
  const capturas = opcion("capturas") ? resolve(opcion("capturas")) : null;
  if (capturas) mkdirSync(capturas, { recursive: true });
  const ejecutable = buscarNavegador(opcion("navegador") ?? process.env["BORNERA_NAVEGADOR"]);

  // La app tal como la sirve `npm run dev` (con su vite.config), pero en un puerto libre y sin recarga.
  const servidor = await createServer({
    root: RAIZ,
    logLevel: "error",
    clearScreen: false,
    // Los errores de la página los cuenta cada prueba; que Vite no los repita en la terminal.
    server: { host: "127.0.0.1", port: 0, strictPort: false, hmr: false, watch: null, forwardConsole: false },
  });
  await servidor.listen();
  const url = servidor.resolvedUrls?.local[0];
  if (!url) throw new Error("Vite no informó la dirección del servidor.");

  const perfil = mkdtempSync(join(tmpdir(), "bornera-humo-"));
  const navegador = spawn(
    ejecutable,
    [
      ...(bandera("ver") ? [] : ["--headless=new"]),
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-sync",
      "--disable-gpu",
      "--remote-debugging-port=0",
      `--user-data-dir=${perfil}`,
      "--window-size=1024,600",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const salida = once(navegador, "exit");

  let fallas = 0;
  let total = 0;
  let pagina = null;
  /** Módulos de la app cargados en Node (para las pruebas que comparan en Node). */
  const cargar = (ruta) => servidor.ssrLoadModule(ruta);
  try {
    pagina = await Pagina.conectar(await pestana(perfil), capturas);
    await calentar(pagina, url);
    for (const archivo of archivos) {
      const prueba = await import(pathToFileURL(join(AQUI, archivo)).href);
      const nombre = prueba.nombre ?? archivo;
      console.log(`\n${archivo.replace(/\.mjs$/, "")} · ${nombre}`);
      pagina.prefijo = `${archivo.replace(/\.mjs$/, "")}-`;
      const comprobar = (descripcion, ok, detalle = "") => {
        total++;
        if (!ok) fallas++;
        console.log(`  ${ok ? "OK " : "MAL"} ${descripcion}${!ok && detalle !== "" ? ` (${detalle})` : ""}`);
      };
      try {
        await pagina.abrir(url);
        await conLimite(prueba.default(pagina, comprobar, { cargar }), LIMITE_PRUEBA_MS, "La prueba no terminó a tiempo.");
      } catch (e) {
        comprobar("la prueba terminó sin errores", false, e instanceof Error ? e.message : String(e));
      }
      comprobar("sin errores en la página", pagina.errores.length === 0, pagina.errores.join(" | "));
    }
  } finally {
    pagina?.cerrar();
    if (navegador.exitCode === null) {
      navegador.kill();
      await salida;
    }
    await servidor.close();
    rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }

  console.log(`\n${total - fallas} de ${total} comprobaciones bien${fallas ? ` · ${fallas} MAL` : ""}.`);
  if (capturas) console.log(`Capturas en ${capturas}`);
  if (fallas) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
