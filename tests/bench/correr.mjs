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
//   --escena-t12       la escena con cables de T12 (40 del centro sin cables,
//                      sin T), para comparar con mediciones anteriores
//   --json             imprime el resultado crudo en JSON

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { buscarNavegador } from "../navegador.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const LIMITE_MS = 10 * 60 * 1000;
/** Un cuadro que tarda más que esto se nota como tirón. */
const CUADRO_LENTO = 16;

const args = process.argv.slice(2);
const opcion = (nombre) => args.find((a) => a.startsWith(`--${nombre}=`))?.split("=").slice(1).join("=");
const bandera = (nombre) => args.includes(`--${nombre}`);

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
      (sinGpu ? "rasterizado por software" : "con GPU") +
      (r.escenaCables === "T12" ? " · escena con cables de T12" : ""),
  );
  lineas.push(
    "Tiempo por cuadro en ms, incluye rasterizar. Lentos = cuadros de más de 16 ms (⚠ si hay alguno).",
  );
  lineas.push("Por gesto = suma de todos los cuadros de un gesto, hasta quedar nítido.");
  lineas.push("Mosaicos máx. = mosaicos rehechos en un solo cuadro, como máximo.");

  const modos = [...new Set(r.mediciones.map((m) => m.modo))];
  for (const modo of modos) {
    lineas.push("");
    if (modos.length > 1) lineas.push(`── ${modo} ──`);
    const filas = [["Símbolos", "Escenario", "Cuadros", "Mediana", "p95", "Máx.", "Lentos", "Por gesto", "Mosaicos máx."]];
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
        m.mosaicosMax === undefined ? "–" : String(m.mosaicosMax),
      ]);
      anterior = m.componentes;
    }
    lineas.push(tabla(filas));
  }

  // Lo que tarda el paso (fuera del cuadro): seleccionar y resumir, borrar y deshacer, planear.
  const conPaso = r.mediciones.filter((m) => m.paso && m.modo === modos[0]);
  if (conPaso.length > 0) {
    lineas.push("");
    lineas.push("Tiempo de cada paso, fuera del cuadro (comando, selección, resumen del panel, plan de la previa), en ms:");
    const filas = [["Escena", "Escenario", "Mediana", "Máx.", "Cables que se acomodan", "Pasos válidos / con ✕", "Comandos"]];
    for (const m of conPaso)
      filas.push([
        String(m.componentes),
        m.escenario,
        ms.format(m.paso.mediana),
        ms.format(m.paso.maximo),
        m.acomodados === undefined ? "–" : String(m.acomodados),
        m.rechazados === undefined ? "–" : `${m.rechazados.pasos - m.rechazados.rechazados} / ${m.rechazados.rechazados}`,
        m.comandos === undefined ? "–" : String(m.comandos),
      ]);
    lineas.push(tabla(filas));
  }

  // Notas de los escenarios (por ejemplo, por qué se rechaza).
  const conNota = r.mediciones.filter((m) => m.nota && m.modo === modos[0]);
  if (conNota.length > 0) {
    lineas.push("");
    for (const m of conNota) lineas.push(`Nota · ${m.componentes} · ${m.escenario}: ${m.nota}`);
  }

  // Mosaicos por fase de un gesto con el editor: el criterio de 0 vale solo para los intermedios.
  const conFases = r.mediciones.filter((m) => m.fases && m.modo === modos[0]);
  if (conFases.length > 0) {
    lineas.push("");
    lineas.push("Mosaicos rehechos en un cuadro (máx.) por fase del gesto, e invalidaciones pedidas en los pasos del medio (tiene que dar 0;");
    lineas.push("los mosaicos del medio pueden ser la cola de lo invalidado al empezar, que se reparte en varios cuadros):");
    const filas = [["Escena", "Escenario", "Inicio", "Intermedios", "Soltar", "Invalidaciones intermedias"]];
    for (const m of conFases)
      filas.push([
        String(m.componentes),
        m.escenario,
        String(m.fases.inicio),
        String(m.fases.intermedios),
        String(m.fases.soltar),
        `${m.invalidacionesIntermedias}${m.invalidacionesIntermedias > 0 ? " ⚠" : "  "}`,
      ]);
    lineas.push(tabla(filas));
  }

  // Paso de la previa según los cables que se acomodan (TOPE_CABLES_PREVIA).
  if (r.tope?.length > 0) {
    lineas.push("");
    lineas.push("Paso de la previa (plan de un punto de grilla) según los cables que se acomodan, en ms (escena propia, todo vale):");
    const filas = [["Cables", "Mediana", "Máx.", "ms por cable", "Pasos válidos"]];
    for (const t of r.tope)
      filas.push([
        String(t.cables),
        ms.format(t.mediana),
        ms.format(t.maximo),
        new Intl.NumberFormat("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(t.mediana / t.cables),
        `${t.pasos - t.rechazados} de ${t.pasos}`,
      ]);
    lineas.push(tabla(filas));
  }

  // Caché de textos de la capa dinámica, en los escenarios que lo informan.
  const conTextos = r.mediciones.filter((m) => m.textos);
  if (conTextos.length > 0) {
    lineas.push("");
    lineas.push("Caché de textos en la capa dinámica (aciertos / fallos), primer cuadro de cada gesto y resto:");
    const filas = [["Símbolos", "Escenario", "Modo", "Primer cuadro", "Resto"]];
    const par = (u) => `${u.aciertos} / ${u.fallos}`;
    for (const m of conTextos) filas.push([String(m.componentes), m.escenario, m.modo, par(m.textos.primero), par(m.textos.resto)]);
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
  const ejecutable = buscarNavegador(opcion("navegador") ?? process.env["BORNERA_NAVEGADOR"]);
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
  const consulta = [bandera("comparar") ? "comparar" : null, bandera("escena-t12") ? "escena-t12" : null].filter(Boolean).join("&");
  const url = consulta ? `${raiz}?${consulta}` : raiz;

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
