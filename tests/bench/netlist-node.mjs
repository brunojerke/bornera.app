// node tests/bench/netlist-node.mjs: mide en Node, sin navegador, cuánto
// tarda armar la netlist (T28) de la escena del banco de 2000 + cables
// (`documentoBancoCables(2000)`, la de F1–F3: 2000 componentes y 3030 cables).
//
// Presupuesto de T28 (docs/plan-T28.md, fijado por Bruno antes de medir):
// ≤ 5 ms en la PC y ≤ 27,5 ms en la netbook (K = 5,5). Se juzga el máximo de
// las vueltas medidas de todos los procesos, como S1 («máx. de 5 vueltas»).
// Si no entra, no pasa (código de salida 1) y se informa la causa; el tope no
// se cambia. Para la causa se mide aparte `redes(hoja)`, la parte de T15.
//
// Corre los procesos uno después del otro, cada uno con su Vite (el código es
// el de la app). En cada proceso: vueltas de calentamiento y después las
// medidas, de `redes` y de `armarNetlist`, intercaladas.
//
// Opciones:
//   --maquina=pc|netbook  qué tope se aplica (por defecto pc)
//   --procesos=N          procesos (por defecto 3)
//   --calentamiento=N     vueltas sin medir (por defecto 10)
//   --vueltas=N           vueltas medidas por proceso (por defecto 5)
//   --json                imprime el resultado crudo en JSON
// No agrega dependencias.

import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const ESTE = fileURLToPath(import.meta.url);

const SIMBOLOS = 2000;
const TOPES = { pc: 5, netbook: 27.5 };

const args = process.argv.slice(2);
const valor = (nombre) => args.find((a) => a.startsWith(`--${nombre}=`))?.split("=")[1];
const opcion = (nombre, porDefecto) => {
  const v = valor(nombre);
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
    const { armarNetlist } = await servidor.ssrLoadModule("/src/core/sim/netlist.ts");
    const { redes } = await servidor.ssrLoadModule("/src/core/model/redes.ts");
    const { documentoBancoCables } = await servidor.ssrLoadModule("/src/editor/banco.ts");

    const hoja = documentoBancoCables(SIMBOLOS).hojas[0];
    const n = armarNetlist(hoja);
    const escena = {
      componentes: hoja.componentes.length,
      cables: hoja.cables.length,
      redes: n.redes.length,
      potenciales: n.potenciales.length,
      enCorto: n.enCorto.length,
      contactos: n.contactos.length,
      cargas: n.cargas.length,
      bobinas: n.bobinas.length,
    };

    // Cada paso devuelve algo que se usa, para que no se descarte.
    let suma = 0;
    for (let i = 0; i < calentamiento; i++) suma += redes(hoja).length + armarNetlist(hoja).redes.length;
    const tiempos = { redes: [], netlist: [] };
    for (let i = 0; i < vueltas; i++) {
      let t0 = performance.now();
      suma += redes(hoja).length;
      tiempos.redes.push(performance.now() - t0);
      t0 = performance.now();
      suma += armarNetlist(hoja).redes.length;
      tiempos.netlist.push(performance.now() - t0);
    }
    if (suma === 0) throw new Error("Ningún paso devolvió nada.");
    return { escena, tiempos };
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
  const vueltas = opcion("vueltas", 5);
  if (bandera("hijo")) {
    process.stdout.write(JSON.stringify(await medirProceso(calentamiento, vueltas)));
    return;
  }
  const maquina = valor("maquina") ?? "pc";
  if (!(maquina in TOPES)) throw new Error(`--maquina tiene que ser pc o netbook (es ${maquina})`);
  const tope = TOPES[maquina];
  const procesos = opcion("procesos", 3);
  const corridas = [];
  for (let i = 0; i < procesos; i++) corridas.push(await correrHijo(calentamiento, vueltas));

  const todos = (paso) => corridas.flatMap((c) => c.tiempos[paso]);
  const resumen = Object.fromEntries(
    ["redes", "netlist"].map((p) => [p, { maximo: Math.max(...todos(p)), mediana: mediana(todos(p)) }]),
  );
  const pasa = resumen.netlist.maximo <= tope;
  const sucio = git("status", "--porcelain", "--untracked-files=no") !== "";
  const resultado = {
    commit: git("rev-parse", "--short", "HEAD") + (sucio ? " con cambios" : ""),
    node: process.version,
    maquina,
    tope,
    escena: corridas[0].escena,
    calentamiento,
    vueltas,
    procesos,
    tiemposPorProceso: corridas.map((c) => c.tiempos),
    resumen,
    pasa,
  };
  if (!pasa) process.exitCode = 1;
  if (bandera("json")) {
    console.log(JSON.stringify(resultado, null, 2));
    return;
  }
  const ms = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const e = resultado.escena;
  console.log(`Netlist de la escena del banco (${e.componentes} componentes, ${e.cables} cables) en Node ${resultado.node}, ${resultado.commit}`);
  console.log(
    `${e.redes} redes, ${e.potenciales} potenciales, ${e.enCorto} en corto, ${e.contactos} contactos, ${e.cargas} cargas, ${e.bobinas} bobinas; ` +
      `${procesos} procesos, ${calentamiento} de calentamiento y ${vueltas} medidas cada uno`,
  );
  console.log(`| Paso | ${corridas.map((_, i) => `Máx. proceso ${i + 1}`).join(" | ")} | Mediana | Máximo |`);
  console.log(`|---|${corridas.map(() => "---:").join("|")}|---:|---:|`);
  for (const p of ["redes", "netlist"]) {
    const nombre = p === "redes" ? "redes() (T15)" : "armarNetlist (T28)";
    console.log(
      `| ${nombre} | ${corridas.map((c) => `${ms.format(Math.max(...c.tiempos[p]))} ms`).join(" | ")} | ${ms.format(resumen[p].mediana)} ms | ${ms.format(resumen[p].maximo)} ms |`,
    );
  }
  const veredicto = `${ms.format(resumen.netlist.maximo)} ms ≤ ${ms.format(tope)} ms (${maquina})`;
  if (pasa) {
    console.log(`PASA: ${veredicto}`);
    return;
  }
  const propia = resumen.netlist.maximo - resumen.redes.maximo;
  console.log(`NO PASA: ${ms.format(resumen.netlist.maximo)} ms > ${ms.format(tope)} ms (${maquina}).`);
  console.log(`Causa: redes() de T15 se lleva hasta ${ms.format(resumen.redes.maximo)} ms; lo propio de la netlist, unos ${ms.format(propia)} ms.`);
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
