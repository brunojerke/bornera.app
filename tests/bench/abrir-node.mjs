// node tests/bench/abrir-node.mjs: mide en Node, sin navegador, cuánto tarda
// pasar la escena del banco de 2000 + cables entre Documento, texto y archivo.
// Lo armó T22 (abrir no cambia con las migraciones vacías) y lo reusa T23
// para la copia de recuperación (F1).
//
// Pasos que mide (el código es el de la app, cargado con Vite):
//   serializar     Documento → texto .brn (lo que hace la copia de T23)
//   deserializar   texto → Documento (las 9 etapas, con las migraciones)
//   abrir          bytes gzip → Documento (desempaquetar + deserializar)
//
// Corre los procesos uno después del otro, cada uno con su Vite. En cada
// proceso, cada paso hace sus vueltas de calentamiento y después las medidas,
// y queda su mediana. El resumen es la mediana de esas medianas.
//
// Opciones:
//   --procesos=N        procesos (por defecto 3)
//   --calentamiento=N   vueltas sin medir por paso (por defecto 10)
//   --vueltas=N         vueltas medidas por paso (por defecto 50)
//   --json              imprime el resultado crudo en JSON
// No agrega dependencias.

import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const ESTE = fileURLToPath(import.meta.url);
const SIMBOLOS = 2000;
const PASOS = ["serializar", "deserializar", "abrir"];

const args = process.argv.slice(2);
const opcion = (nombre, porDefecto) => {
  const v = args.find((a) => a.startsWith(`--${nombre}=`))?.split("=")[1];
  const n = v === undefined ? porDefecto : Number(v);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`--${nombre} tiene que ser un entero mayor que 0 (es ${v})`);
  return n;
};
const bandera = (nombre) => args.includes(`--${nombre}`);

function mediana(valores) {
  const v = [...valores].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// ── Un proceso ─────────────────────────────────────────────────────────────

async function medirProceso(calentamiento, vueltas) {
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
    const { empaquetar, desempaquetar } = await servidor.ssrLoadModule("/src/ui/brn.ts");
    const { documentoBancoCables } = await servidor.ssrLoadModule("/src/editor/banco.ts");

    const doc = documentoBancoCables(SIMBOLOS);
    const texto = serializar(doc);
    const { bytes, comprimido } = await empaquetar(texto);
    if (!comprimido) throw new Error("No se comprimió (falta CompressionStream).");
    const prueba = deserializar(texto);
    if (!prueba.ok) throw new Error(`La escena no abre: ${JSON.stringify(prueba.errores)}`);

    // Cada paso devuelve algo que se usa, para que no se descarte.
    const pasos = {
      serializar: () => serializar(doc).length,
      deserializar: () => (deserializar(texto).ok ? 1 : 0),
      abrir: async () => {
        const p = await desempaquetar(bytes);
        if (!p.ok) throw new Error(p.error);
        return deserializar(p.texto).ok ? 1 : 0;
      },
    };
    const medianas = {};
    let suma = 0;
    for (const nombre of PASOS) {
      const paso = pasos[nombre];
      for (let i = 0; i < calentamiento; i++) suma += await paso();
      const tiempos = [];
      for (let i = 0; i < vueltas; i++) {
        const t0 = performance.now();
        suma += await paso();
        tiempos.push(performance.now() - t0);
      }
      medianas[nombre] = mediana(tiempos);
    }
    if (suma === 0) throw new Error("Ningún paso devolvió nada.");
    return { caracteres: texto.length, bytesGzip: bytes.length, medianas };
  } finally {
    await servidor.close();
  }
}

// ── Resumen ────────────────────────────────────────────────────────────────

function git(...a) {
  try {
    return execFileSync("git", a, { cwd: RAIZ, encoding: "utf8" }).trim();
  } catch {
    return "?";
  }
}

async function correrHijo(calentamiento, vueltas) {
  const hijo = spawn(process.execPath, [ESTE, "--hijo", `--calentamiento=${calentamiento}`, `--vueltas=${vueltas}`], {
    cwd: RAIZ,
    stdio: ["ignore", "pipe", "inherit"],
  });
  let salida = "";
  hijo.stdout.setEncoding("utf8");
  hijo.stdout.on("data", (d) => (salida += d));
  const [codigo] = await once(hijo, "close");
  if (codigo !== 0) throw new Error(`Un proceso terminó con código ${codigo}.`);
  return JSON.parse(salida);
}

async function principal() {
  const calentamiento = opcion("calentamiento", 10);
  const vueltas = opcion("vueltas", 50);
  if (bandera("hijo")) {
    process.stdout.write(JSON.stringify(await medirProceso(calentamiento, vueltas)));
    return;
  }
  const procesos = opcion("procesos", 3);
  const corridas = [];
  for (let i = 0; i < procesos; i++) corridas.push(await correrHijo(calentamiento, vueltas));
  const resumen = Object.fromEntries(PASOS.map((p) => [p, mediana(corridas.map((c) => c.medianas[p]))]));
  const sucio = git("status", "--porcelain", "--untracked-files=no") !== "";
  const resultado = {
    commit: git("rev-parse", "--short", "HEAD") + (sucio ? " con cambios" : ""),
    node: process.version,
    escena: `${SIMBOLOS} + cables`,
    caracteres: corridas[0].caracteres,
    bytesGzip: corridas[0].bytesGzip,
    calentamiento,
    vueltas,
    medianasPorProceso: corridas.map((c) => c.medianas),
    resumen,
  };
  if (bandera("json")) {
    console.log(JSON.stringify(resultado, null, 2));
    return;
  }
  const ms = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  console.log(`Banco de ${resultado.escena} en Node ${resultado.node}, ${resultado.commit}`);
  console.log(`${resultado.caracteres} caracteres, ${resultado.bytesGzip} bytes en gzip; ${calentamiento} de calentamiento y ${vueltas} medidas por paso`);
  console.log(`| Paso | ${corridas.map((_, i) => `Proceso ${i + 1}`).join(" | ")} | Mediana |`);
  console.log(`|---|${corridas.map(() => "---:").join("|")}|---:|`);
  for (const p of PASOS) console.log(`| ${p} | ${corridas.map((c) => `${ms.format(c.medianas[p])} ms`).join(" | ")} | ${ms.format(resumen[p])} ms |`);
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
