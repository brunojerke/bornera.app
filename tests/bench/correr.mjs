// npm run bench: mide tiempos de dibujado sin abrir la ventana de la app.
// Levanta Vite con la página del banco (tests/bench) y la abre en un Chrome,
// Chromium o Edge headless (el que haya instalado), que dibuja con el mismo
// código de la app y devuelve los tiempos por POST. No agrega dependencias.
//
// Opciones:
//   --navegador=RUTA   ejecutable a usar (o variable BORNERA_NAVEGADOR)
//   --gpu              no desactivar la GPU (por defecto se rasteriza por
//                      software, más parecido a una netbook)
//   --comparar         mide también sin caché de textos y sin ninguna
//                      optimización (tarda el triple)
//   --json             imprime el resultado crudo en JSON

import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const AQUI = dirname(fileURLToPath(import.meta.url));
const LIMITE_MS = 10 * 60 * 1000;
/** Un cuadro que tarda más que esto se nota como tirón. */
const CUADRO_LENTO = 16;

const args = process.argv.slice(2);
const opcion = (nombre) => args.find((a) => a.startsWith(`--${nombre}=`))?.split("=").slice(1).join("=");
const bandera = (nombre) => args.includes(`--${nombre}`);

// ── Navegador ──────────────────────────────────────────────────────────────

function candidatos() {
  const env = process.env;
  if (process.platform === "win32") {
    const raices = [env["PROGRAMFILES"], env["PROGRAMFILES(X86)"], env["LOCALAPPDATA"]].filter(Boolean);
    return raices.flatMap((r) => [
      join(r, "Google", "Chrome", "Application", "chrome.exe"),
      join(r, "Chromium", "Application", "chrome.exe"),
      join(r, "Microsoft", "Edge", "Application", "msedge.exe"),
    ]);
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
  }
  const nombres = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "microsoft-edge"];
  const carpetas = (env["PATH"] ?? "").split(delimiter).filter(Boolean);
  return nombres.flatMap((n) => carpetas.map((c) => join(c, n)));
}

function buscarNavegador() {
  const pedido = opcion("navegador") ?? process.env["BORNERA_NAVEGADOR"];
  if (pedido) {
    if (!existsSync(pedido)) throw new Error(`No existe el navegador indicado: ${pedido}`);
    return pedido;
  }
  const encontrado = candidatos().find((c) => existsSync(c));
  if (!encontrado) {
    throw new Error(
      "No encontré Chrome, Chromium ni Edge. Instalá uno o indicá la ruta con " +
        "--navegador=RUTA o la variable BORNERA_NAVEGADOR.",
    );
  }
  return encontrado;
}

// ── Formato ────────────────────────────────────────────────────────────────

const ms = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const mb = ms;

function tabla(filas) {
  const anchos = filas[0].map((_, i) => Math.max(...filas.map((f) => f[i].length)));
  return filas
    .map((f, n) =>
      f
        .map((celda, i) => (i < 2 && n > 0 ? celda.padEnd(anchos[i]) : n === 0 ? celda.padEnd(anchos[i]) : celda.padStart(anchos[i])))
        .join("   "),
    )
    .join("\n");
}

function informe(r, sinGpu) {
  const lineas = [];
  const motor = /Edg\/([\d.]+)/.exec(r.navegador)?.[0] ?? /Chrome\/([\d.]+)/.exec(r.navegador)?.[0] ?? r.navegador;
  lineas.push(
    `Banco de dibujado · lienzo ${r.ancho}×${r.alto} · dpr ${r.dpr} · ${motor} · ` +
      (sinGpu ? "rasterizado por software" : "con GPU"),
  );
  lineas.push(
    "Tiempo por cuadro en ms, incluye rasterizar. Lentos = cuadros de más de 16 ms (⚠ si hay alguno).",
  );
  lineas.push("Por gesto = suma de todos los cuadros de un gesto, hasta quedar nítido.");

  const modos = [...new Set(r.mediciones.map((m) => m.modo))];
  for (const modo of modos) {
    lineas.push("");
    if (modos.length > 1) lineas.push(`── ${modo} ──`);
    const filas = [["Símbolos", "Escenario", "Cuadros", "Mediana", "p95", "Máx.", "Lentos", "Por gesto"]];
    let anterior = null;
    for (const m of r.mediciones.filter((x) => x.modo === modo)) {
      filas.push([
        m.componentes === anterior ? "" : String(m.componentes),
        m.escenario,
        String(m.cuadros),
        ms.format(m.mediana),
        ms.format(m.p95),
        ms.format(m.maximo),
        `${m.lentos}${m.lentos > 0 ? " ⚠" : "  "}`,
        ms.format(m.porGesto),
      ]);
      anterior = m.componentes;
    }
    lineas.push(tabla(filas));
  }
  lineas.push("");
  const heap = r.memoria
    .map((m) => `${m.componentes}: ${m.heapMB === null ? "–" : `${mb.format(m.heapMB)} MB`}`)
    .join(" · ");
  lineas.push(`Heap JS con la escena armada: ${heap}`);
  const cache = Math.max(...r.mediciones.filter((m) => m.modo === modos[0]).map((m) => m.cache ?? 0));
  lineas.push(`Caché (capa estática y textos), máximo: ${mb.format(cache / 2 ** 20)} MB`);
  return lineas.join("\n");
}

// ── Corrida ────────────────────────────────────────────────────────────────

async function main() {
  const ejecutable = buscarNavegador();
  const sinGpu = !bandera("gpu");

  let recibir;
  const resultado = new Promise((resolve) => (recibir = resolve));

  const servidor = await createServer({
    configFile: false,
    root: AQUI,
    logLevel: "error",
    clearScreen: false,
    server: { host: "127.0.0.1", port: 0, strictPort: false, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      {
        name: "bornera-bench",
        configureServer(s) {
          s.middlewares.use("/__bench", (req, res) => {
            let cuerpo = "";
            req.on("data", (d) => (cuerpo += d));
            req.on("end", () => {
              res.end("ok");
              recibir(JSON.parse(cuerpo));
            });
          });
        },
      },
    ],
  });
  await servidor.listen();
  const raiz = servidor.resolvedUrls?.local[0];
  if (!raiz) throw new Error("Vite no informó la dirección del servidor.");
  const url = bandera("comparar") ? `${raiz}?comparar` : raiz;

  const perfil = mkdtempSync(join(tmpdir(), "bornera-bench-"));
  const banderas = [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    `--user-data-dir=${perfil}`,
    "--window-size=1366,768",
    "--js-flags=--expose-gc",
    "--enable-precise-memory-info",
    ...(sinGpu ? ["--disable-gpu"] : []),
    url,
  ];
  console.error(`Navegador: ${ejecutable}\nMidiendo 100, 500 y 2000 símbolos… (puede tardar unos minutos)`);
  const navegador = spawn(ejecutable, banderas, { stdio: "ignore" });
  const salida = once(navegador, "exit");

  let reloj;
  const vencido = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error("El banco no terminó a tiempo.")), LIMITE_MS);
  });
  const terminoAntes = salida.then(([codigo]) => {
    throw new Error(`El navegador se cerró antes de terminar (código ${codigo}).`);
  });

  try {
    const r = await Promise.race([resultado, vencido, terminoAntes]);
    if (r.error) throw new Error(`Error en la página del banco:\n${r.error}`);
    console.log(bandera("json") ? JSON.stringify(r, null, 2) : informe(r, sinGpu));
  } finally {
    clearTimeout(reloj);
    terminoAntes.catch(() => {});
    if (navegador.exitCode === null) {
      navegador.kill();
      await salida;
    }
    await servidor.close();
    rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
