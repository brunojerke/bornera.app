// node tests/bench/f1-webview2.mjs: mide F1 (T23, docs/plan-T23.md sección 6)
// en WebView2, con la app real. Solo Windows.
//
// Abre el exe (por defecto el de release: `npm run tauri build -- --no-bundle`)
// con el puerto de depuración de WebView2, toca menú de desarrollo › «Medir la
// copia (F1)», lee el resultado del diálogo y corta el proceso (lo común está
// en webview2.mjs). Cada proceso es nuevo, así que su primera copia es fría y
// cuenta.
//
// F1 es el paso síncrono más largo de las copias por partes. La salida de
// emergencia (las copias de una vez; desde la etapa 5, 3 forzadas por
// proceso) se junta aparte: veces y máximo, sin decidir.
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
// No tiene que haber otra Bornera abierta (ver webview2.mjs). La medición
// borra su registro al terminar. No agrega dependencias.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { argumentos, conLaApp, esperar, leerNumero, mediana, textoResultado, tocarMenu, unDecimal } from "./webview2.mjs";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const TOPE_MS = 9;

const { opcion, bandera, entero } = argumentos();
const exes = (opcion("exe") ?? `${RAIZ}src-tauri/target/release/bornera.exe`).split(",");
const procesos = entero("procesos", 3);
const puerto = entero("puerto", 9333);

/** La salida de emergencia del texto: veces y máximo (los exes de antes de la etapa 5 la escriben distinto o no la tienen). */
function emergencia(texto) {
  const l = texto.split("\n").find((x) => x.startsWith("Salida de emergencia"));
  if (!l) return { veces: 0, maximo: 0 };
  const veces = Number(/: (\d+) veces/.exec(l)?.[1] ?? 0);
  const max = /máx\. ([\d,]+) ms/.exec(l)?.[1];
  return { veces, maximo: max ? leerNumero(max) : 0 };
}

/** Un proceso: abre, mide y corta. Devuelve el paso más largo de cada copia, la emergencia y el texto. */
function medirUnProceso(exe) {
  return conLaApp(exe, puerto, async (pagina) => {
    if (bandera("borrar-base")) {
      const r = await pagina.evaluar(
        `new Promise((r) => { const d = indexedDB.deleteDatabase("bornera"); d.onsuccess = () => r("ok"); d.onerror = () => r("error"); d.onblocked = () => r("bloqueada"); })`,
      );
      if (r !== "ok") throw new Error(`No se pudo borrar la base: ${r}`);
    }
    await tocarMenu(pagina, "Medir la copia (F1)");
    let texto = "";
    for (let i = 0; i < 1200; i++) {
      texto = await textoResultado(pagina);
      if (texto.includes("F1 =") || texto.startsWith("La prueba falló")) break;
      await esperar(100);
    }
    if (!texto.includes("F1 =")) throw new Error(texto || "La medición no terminó a tiempo.");
    const linea = texto.split("\n").at(-1);
    const ms = linea.slice(linea.indexOf(":") + 1).split("·").map(leerNumero);
    if (ms.some((n) => !Number.isFinite(n))) throw new Error(`No pude leer: ${linea}`);
    return { ms, emergencia: emergencia(texto), texto, motor: texto.split("\n")[0].split(" · ").at(-1) };
  });
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
            `máx. ${unDecimal(Math.max(...r.ms))} · primera ${unDecimal(r.ms[0])} ms` +
            (r.emergencia.veces > 0 ? ` · de una vez: ${r.emergencia.veces}, máx. ${unDecimal(r.emergencia.maximo)} ms` : "") +
            (r.recuperar ? " · (salió «Bornera no se cerró bien»: Esc)" : ""),
        );
      }
    }
  }
  const porExe = exes.map((exe) => {
    const de = corridas.filter((c) => c.exe === exe);
    const ms = de.flatMap((c) => c.ms);
    const f1 = Math.max(...ms);
    const veces = de.reduce((s, c) => s + c.emergencia.veces, 0);
    const maximoEmergencia = Math.max(0, ...de.map((c) => c.emergencia.maximo));
    return { exe, copias: ms.length, mediana: mediana(ms), f1, pasa: f1 <= TOPE_MS, emergencia: { veces, maximo: maximoEmergencia } };
  });
  if (bandera("json")) {
    console.log(JSON.stringify({ tope: TOPE_MS, porExe, corridas }, null, 2));
    return;
  }
  console.log(`\nMotor: ${corridas[0].motor}`);
  for (const [i, e] of porExe.entries()) {
    const quien = exes.length > 1 ? `${i === 0 ? "A" : "B"} (${e.exe}): ` : "";
    console.log(
      `${quien}F1 = ${unDecimal(e.f1)} ms (el mayor de ${e.copias}), mediana ${unDecimal(e.mediana)} ms: ` +
        `${e.pasa ? "pasa" : "no pasa"} (≤ ${TOPE_MS} ms)`,
    );
    console.log(
      `${quien}salida de emergencia (aparte, no decide): ${e.emergencia.veces} veces` +
        (e.emergencia.veces > 0 ? `, máx. ${unDecimal(e.emergencia.maximo)} ms` : ""),
    );
  }
  console.log(`\nÚltimo resultado completo:\n${corridas.at(-1).texto}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
