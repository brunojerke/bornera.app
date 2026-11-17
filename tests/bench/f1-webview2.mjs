// node tests/bench/f1-webview2.mjs: mide F1 (T23, docs/plan-T23.md sección 6)
// en WebView2, con la app real. Solo Windows.
//
// Abre el exe (por defecto el de release: `npm run tauri build -- --no-bundle`)
// con el puerto de depuración de WebView2 (variable
// WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS), toca menú de desarrollo › «Medir la
// copia (F1)», lee el resultado del diálogo y corta el proceso. Cada proceso
// es nuevo, así que su primera copia es fría y cuenta.
//
// La PC varía de 24 a 36 ms entre procesos (T22): con dos exes, los procesos
// se intercalan (A B A B…) para comparar.
//
// Opciones:
//   --exe=RUTA[,RUTA2]   por defecto src-tauri/target/release/bornera.exe
//   --procesos=N         procesos por exe (por defecto 3)
//   --puerto=N           puerto de depuración (por defecto 9333)
//   --borrar-base        borra la base `bornera` del perfil antes de cada
//                        medición. Solo para intercalar con un exe de la etapa
//                        1a, que abre la base en versión 1 y no puede abrirla
//                        después de que la 1b la subió a 2. OJO: borra también
//                        las copias de recuperación de la app instalada.
//   --json               imprime el resultado crudo en JSON
//
// El exe usa el perfil de la app instalada (%LOCALAPPDATA%\com.bornera.app):
// no tiene que haber otra Bornera abierta, porque se uniría a su proceso de
// WebView2 sin el puerto. La medición borra su registro al terminar.
// No agrega dependencias.

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { esperar, Pagina } from "../humo/cdp.mjs";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const TOPE_MS = 9;

const args = process.argv.slice(2);
const opcion = (nombre) => args.find((a) => a.startsWith(`--${nombre}=`))?.split("=").slice(1).join("=");
const entero = (nombre, porDefecto) => {
  const v = opcion(nombre);
  const n = v === undefined ? porDefecto : Number(v);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`--${nombre} tiene que ser un entero mayor que 0 (es ${v})`);
  return n;
};

const exes = (opcion("exe") ?? `${RAIZ}src-tauri/target/release/bornera.exe`).split(",");
const procesos = entero("procesos", 3);
const puerto = entero("puerto", 9333);

/** Número con coma decimal → número. */
const leerNumero = (t) => Number(t.trim().replace(",", "."));
const unDecimal = (n) => n.toFixed(1).replace(".", ",");
const mediana = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

/** Espera la página de la app en el puerto de depuración. */
async function paginaDeLaApp() {
  for (let i = 0; i < 300; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json();
      const p = lista.find((t) => t.type === "page");
      if (p) return p.webSocketDebuggerUrl;
    } catch {
      // todavía no atiende
    }
    await esperar(100);
  }
  throw new Error(`WebView2 no abrió el puerto ${puerto}. ¿Hay otra Bornera abierta?`);
}

/** Corta el proceso y lo que colgó de él (los de WebView2). */
function cortar(pid) {
  try {
    execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } catch {
    // ya terminó
  }
}

/** Un proceso: abre, mide y corta. Devuelve la parte síncrona de cada copia y el texto. */
async function medirUnProceso(exe) {
  const hijo = spawn(exe, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${puerto}` },
    stdio: "ignore",
  });
  let pagina = null;
  try {
    pagina = await Pagina.conectar(await paginaDeLaApp());
    const listo = `!!document.querySelector('[aria-label="Menú de desarrollo"]') && !!document.querySelector("canvas")`;
    for (let i = 0; i < 300 && !(await pagina.evaluar(listo).catch(() => false)); i++) await esperar(100);
    if (bandera("borrar-base")) {
      const r = await pagina.evaluar(
        `new Promise((r) => { const d = indexedDB.deleteDatabase("bornera"); d.onsuccess = () => r("ok"); d.onerror = () => r("error"); d.onblocked = () => r("bloqueada"); })`,
      );
      if (r !== "ok") throw new Error(`No se pudo borrar la base: ${r}`);
    }
    await pagina.evaluar(`document.querySelector('[aria-label="Menú de desarrollo"]').click()`);
    await esperar(100);
    const tocado = await pagina.evaluar(
      `(() => { const b = [...document.querySelectorAll('[role="menuitem"]')].find((x) => x.textContent.includes("Medir la copia (F1)"));
        if (!b) return false; b.click(); return true; })()`,
    );
    if (!tocado) throw new Error("No está «Medir la copia (F1)» en el menú de desarrollo.");
    const resultado = `document.querySelector('textarea[aria-label="Resultado"]')?.value ?? ""`;
    let texto = "";
    for (let i = 0; i < 1200; i++) {
      texto = await pagina.evaluar(resultado).catch(() => "");
      if (texto.includes("F1 =") || texto.startsWith("La prueba falló")) break;
      await esperar(100);
    }
    if (!texto.includes("F1 =")) throw new Error(texto || "La medición no terminó a tiempo.");
    const linea = texto.split("\n").at(-1);
    const ms = linea.slice(linea.indexOf(":") + 1).split("·").map(leerNumero);
    if (ms.some((n) => !Number.isFinite(n))) throw new Error(`No pude leer: ${linea}`);
    return { ms, texto, motor: texto.split("\n")[0].split(" · ").at(-1) };
  } finally {
    pagina?.cerrar();
    cortar(hijo.pid);
    // Que WebView2 suelte el perfil y el puerto antes del próximo.
    await esperar(2000);
  }
}

async function main() {
  if (process.platform !== "win32") throw new Error("Solo Windows (WebView2).");
  for (const exe of exes) if (!existsSync(exe)) throw new Error(`No existe ${exe}. Compilá con: npm run tauri build -- --no-bundle`);
  const corridas = [];
  for (let i = 0; i < procesos; i++) {
    for (const exe of exes) {
      const r = await medirUnProceso(exe);
      corridas.push({ exe, ...r });
      if (!bandera("json")) {
        console.log(
          `proceso ${corridas.length} · ${exe === exes[0] ? "A" : "B"} · mediana ${unDecimal(mediana(r.ms))} · ` +
            `máx. ${unDecimal(Math.max(...r.ms))} · primera ${unDecimal(r.ms[0])} ms`,
        );
      }
    }
  }
  const porExe = exes.map((exe) => {
    const ms = corridas.filter((c) => c.exe === exe).flatMap((c) => c.ms);
    const f1 = Math.max(...ms);
    return { exe, copias: ms.length, mediana: mediana(ms), f1, pasa: f1 <= TOPE_MS };
  });
  if (bandera("json")) {
    console.log(JSON.stringify({ tope: TOPE_MS, porExe, corridas }, null, 2));
    return;
  }
  console.log(`\nMotor: ${corridas[0].motor}`);
  for (const [i, e] of porExe.entries()) {
    console.log(
      `${exes.length > 1 ? `${i === 0 ? "A" : "B"} (${e.exe}): ` : ""}F1 = ${unDecimal(e.f1)} ms (el mayor de ${e.copias}), ` +
        `mediana ${unDecimal(e.mediana)} ms: ${e.pasa ? "pasa" : "no pasa"} (≤ ${TOPE_MS} ms)`,
    );
  }
  console.log(`\nÚltimo resultado completo:\n${corridas.at(-1).texto}`);
}

function bandera(nombre) {
  return args.includes(`--${nombre}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
