// node tests/bench/probar-webview2.mjs: ABBA de B1–B16 («Probar la fase 3b»)
// en WebView2, con la app real, entre dos exes (T23, etapa 5). Solo Windows.
//
// Cada apertura abre el exe con el puerto de depuración (webview2.mjs), toca
// menú de desarrollo › «Probar la fase 3b…» `--corridas` veces (la 1.ª es
// fría, con el calentamiento de T20; las demás calientes), lee «Copiar» y
// corta el proceso. Las aperturas van en bloques A B B A.
//
// Juicio (regla D6b-C, docs/plan-fase4.md; compararB.mjs): en cada fila, la
// mediana de las calientes de A contra la de B. Tiempos: igual a ≤ 1 ms o
// ±10 %; lentos ±1; B9 el mismo escalón. Las frías se informan y no deciden.
//
// Opciones:
//   --exe=A,B       A = la que se prueba (HEAD), B = la base. Obligatorio.
//   --fase4         A corre «Probar la fase 4» y B «Probar la fase 3b» (C1):
//                   además de B1–B16, juzga F1–F3 de A con los topes de la PC
//                   (F1 ≤ 9 ms en las calientes; F2 y F3 ≤ 1 s en todas),
//                   informa las frías con la regla de C4 y los valores K de A
//   --fase5         A corre «Probar la fase 5» y B «Probar la fase 4» (T31):
//                   lo de --fase4 y además S1–S5 de A con los topes de la PC
//   --base-fase5    con --fase5, B también corre «Probar la fase 5» (T32): se
//                   suma la no regresión de S (mediana de A ≤ la de B +
//                   máx(1 ms, 10 %)) y el cierre del ajuste 1 de T32. Desde
//                   T33 (R-A), S1 y S4 solo por tope: su no regresión informa,
//                   y una base sin S4 (anterior a T33) no la tiene
//   --fase6         A corre «Probar la fase 6» y B «Probar la fase 5» (T37):
//                   lo de --base-fase5 (S1–S5 con no regresión) y además S6
//                   de A por tope (ajuste 1 de T37: decide la mediana de las
//                   calientes ≤ 54,5; el máx. ≤ 60,0 aparte, con un pico
//                   aislado se repite el ABBA una vez) y P2 de A, que informa
//   --base-fase6    con --fase6, B también corre «Probar la fase 6» (T38):
//                   se suma la no regresión de S6 y P2 se juzga (mediana de
//                   las aperturas de A ≤ la de B + máx(1 ms, 10 %))
//   --bloques=N     bloques ABBA (por defecto 3: 6 aperturas por exe)
//   --corridas=N    corridas por apertura (por defecto 2: fría y caliente)
//   --puerto=N      puerto de depuración (por defecto 9333)
//   --salida=RUTA   guarda los textos crudos de cada corrida en JSON
//   --json          imprime el resultado crudo en JSON
//
// No tiene que haber otra Bornera abierta (ver webview2.mjs). «Probar» no
// toca la hoja ni hace copias de recuperación. No agrega dependencias.

import { existsSync, writeFileSync } from "node:fs";
import { AVISO_S1_PC_MS, cadenaS4, cierreS, compararB, desgloseS1, desgloseS6, filasB, filasF, friasFuera, juzgarF, juzgarP2, juzgarS, juzgarS6, mediana, metricas, noRegresionS, noRegresionS6, paredS5 } from "./compararB.mjs";
import { valoresK } from "./factores.mjs";
import { argumentos, cerrarResultado, conLaApp, esperar, textoResultado, tocarMenu, unDecimal } from "./webview2.mjs";

const { opcion, bandera, entero } = argumentos();
const exes = (opcion("exe") ?? "").split(",").filter(Boolean);
const bloques = entero("bloques", 3);
const corridas = entero("corridas", 2);
const puerto = entero("puerto", 9333);
// --fase5 (T31): A corre «Probar la fase 5» y B «Probar la fase 4»; lo de
// --fase4 y además S1–S5 de A con el ajuste 1 de T31 (compararB.mjs, juzgarS).
// --base-fase5 (T32): B también corre «Probar la fase 5» y se juzga la no regresión de S.
// --fase6 (T37): A corre «Probar la fase 6» y B «Probar la fase 5»; lo de
// --base-fase5 más S6 y P2. --base-fase6 (T38): las dos la 6.
const baseFase6 = bandera("base-fase6");
const fase6 = bandera("fase6") || baseFase6;
const baseFase5 = bandera("base-fase5") || fase6;
const fase5 = bandera("fase5") || baseFase5;
const fase4 = bandera("fase4") || fase5;
/** El ítem del menú de cada exe: con --fase4, A corre la fase 4 y B la 3b; con --fase5, A la 5 y B la 4; con --base-fase5, las dos la 5; con --fase6, A la 6 y B la 5; con --base-fase6, las dos la 6. */
const items = baseFase6
  ? ["Probar la fase 6", "Probar la fase 6"]
  : fase6
    ? ["Probar la fase 6", "Probar la fase 5"]
    : baseFase5
      ? ["Probar la fase 5", "Probar la fase 5"]
      : fase5
        ? ["Probar la fase 5", "Probar la fase 4"]
        : fase4
          ? ["Probar la fase 4", "Probar la fase 3b"]
          : ["Probar la fase 3b", "Probar la fase 3b"];
/** Lo que puede tardar una corrida (con el calentamiento, en la PC, ~35 s). */
const LIMITE_CORRIDA_MS = 240_000;

/** Una apertura: `corridas` veces el ítem, con el texto de cada una. */
function unaApertura(exe, item) {
  return conLaApp(exe, puerto, async (pagina) => {
    const textos = [];
    for (let i = 0; i < corridas; i++) {
      await tocarMenu(pagina, item);
      const t0 = Date.now();
      let texto = "";
      while (Date.now() - t0 < LIMITE_CORRIDA_MS) {
        texto = await textoResultado(pagina);
        if (texto.startsWith(`${item} ·`) || texto.startsWith("La prueba falló")) break;
        await esperar(250);
      }
      if (!texto.startsWith(`${item} ·`)) throw new Error(texto || `«${item}» no terminó a tiempo.`);
      if (filasB(texto).size !== 16) throw new Error(`La tabla no tiene B1 a B16:\n${texto}`);
      textos.push(texto);
      await cerrarResultado(pagina);
      await esperar(500);
    }
    return { textos };
  });
}

const fmt = (v) => (typeof v === "number" ? unDecimal(v) : String(v));

async function main() {
  if (process.platform !== "win32") throw new Error("Solo Windows (WebView2).");
  if (exes.length !== 2) throw new Error("Hace falta --exe=A,B (A = la que se prueba, B = la base).");
  for (const exe of exes) if (!existsSync(exe)) throw new Error(`No existe ${exe}.`);
  if (corridas < 2) throw new Error("Hace falta --corridas=2 o más: la 1.ª es fría y el juicio usa las calientes.");
  if (bloques < 1) throw new Error("Hace falta --bloques=1 o más.");
  const orden = [];
  for (let b = 0; b < bloques; b++) orden.push(0, 1, 1, 0);
  const aperturas = [];
  const inicio = new Date();
  for (const [n, i] of orden.entries()) {
    const t0 = Date.now();
    const r = await unaApertura(exes[i], items[i]);
    aperturas.push({ exe: i === 0 ? "A" : "B", textos: r.textos, recuperar: r.recuperar, hora: new Date().toLocaleTimeString("es-AR") });
    if (!bandera("json")) {
      console.log(
        `apertura ${n + 1}/${orden.length} · ${i === 0 ? "A" : "B"} · ${Math.round((Date.now() - t0) / 1000)} s` +
          (r.recuperar ? " · (salió «Bornera no se cerró bien»: Esc)" : ""),
      );
    }
    if (opcion("salida")) writeFileSync(opcion("salida"), JSON.stringify({ exes, inicio, aperturas }, null, 2));
  }
  const de = (quien, frias) => aperturas.filter((a) => a.exe === quien).flatMap((a) => (frias ? a.textos.slice(0, 1) : a.textos.slice(1)));
  const calientes = compararB(de("B", false), de("A", false));
  const frias = compararB(de("B", false), de("A", true));
  const deFrias = { A: de("A", true), B: de("B", true) };
  const fuera = { A: friasFuera(deFrias.A, de("A", false)), B: friasFuera(deFrias.B, de("B", false)) };
  const f = fase4 ? juzgarF(deFrias.A, de("A", false)) : null;
  const s = fase5 ? juzgarS(deFrias.A, de("A", false)) : null;
  const sB = baseFase5 ? juzgarS(deFrias.B, de("B", false), true) : null;
  const regresion = baseFase5 ? noRegresionS(de("B", false), de("A", false)) : null;
  const cierre = s && regresion ? cierreS(s, regresion) : null;
  const s6 = fase6 ? juzgarS6(deFrias.A, de("A", false)) : null;
  const regresionS6 = baseFase6 ? noRegresionS6(de("B", false), de("A", false)) : null;
  const p2 = fase6 ? juzgarP2(deFrias.A, baseFase6 ? deFrias.B : []) : null;
  if (s && !bandera("json")) {
    for (const x of s.filas) console.log(`S ${x.id} ${x.nombre}: tope ${fmt(x.tope)} (máx. ${fmt(x.margen)}) · mediana ${fmt(x.mediana)} · máx. ${fmt(x.maximo)} · ${x.pasa ? "pasa" : "NO pasa"} · frías ${x.informan.map(fmt).join(", ")}`);
    const s1 = s.filas.find((x) => x.id === "S1");
    if (s1 && s1.maximo > AVISO_S1_PC_MS) console.log(`AVISO: S1 pasa de ${AVISO_S1_PC_MS} ms en la PC.`);
    const cal = de("A", false);
    console.log("Desglose S1 (mediana): " + ["R4", "netlist", "iniciar", "cuadro"].map((p) => `${p} ${fmt(mediana(cal.map((t) => desgloseS1(t).get(p) ?? NaN)))}`).join(" · "));
    console.log(`Pared S5 (informa): ${fmt(mediana(cal.map(paredS5)))} ms`);
    const cad = cal.map(cadenaS4);
    if (cad.some((c) => !Number.isNaN(c.gesto))) {
      console.log(`S4 cadena de 100 (informa, no frena): cuadro máx. mediana ${fmt(mediana(cad.map((c) => c.cuadro)))} · gesto máx. mediana ${fmt(mediana(cad.map((c) => c.gesto)))} ms`);
    }
    if (sB) for (const x of sB.filas) console.log(`S de B ${x.id} ${x.nombre} (informa): mediana ${fmt(x.mediana)} · máx. ${fmt(x.maximo)}`);
    if (regresion) {
      for (const x of regresion.filas) {
        const juicio = x.informa ? "informa (R-A)" : x.pasa ? "pasa" : "NO pasa";
        console.log(`No regresión ${x.id} ${x.nombre}: B ${fmt(x.base)} · A ${fmt(x.head)} · límite ${fmt(x.limite)} · ${juicio}`);
      }
      console.log(`Cierre de S (ajuste 1 de T32): ${cierre}`);
    }
  }
  if (s6 && !bandera("json")) {
    for (const x of s6.filas) {
      const juicio = x.estado === "repetir" ? `REPETIR el ABBA una vez (pico aislado: ${x.sobreMargen.map(fmt).join(", ")})` : x.estado === "pasa" ? "pasa" : "NO pasa";
      console.log(`S6 ${x.nombre} (ajuste 1 de T37): tope ${fmt(x.tope)} (mediana) · máx. ≤ ${fmt(x.margen)} aparte · mediana ${fmt(x.mediana)} · máx. ${fmt(x.maximo)} · ${juicio} · calientes ${x.deciden.map(fmt).join(", ")} · frías ${x.informan.map(fmt).join(", ")}`);
    }
    const cal = de("A", false);
    console.log("Desglose S6 (mediana): " + ["R4", "netlist", "iniciar", "cuadro"].map((p) => `${p} ${fmt(mediana(cal.map((t) => desgloseS6(t).get(p) ?? NaN)))}`).join(" · "));
    if (regresionS6) for (const x of regresionS6.filas) console.log(`No regresión S6 ${x.nombre}: B ${fmt(x.base)} · A ${fmt(x.head)} · límite ${fmt(x.limite)} · ${x.pasa ? "pasa" : "NO pasa"}`);
    else console.log("No regresión S6: no aplica (la base corre «Probar la fase 5», sin S6).");
    if (p2) {
      const juicio = p2.juzga ? (p2.pasa ? "pasa" : "NO pasa") : "informa (la base no tiene la marca)";
      console.log(`P2 (una por apertura, ms): A ${p2.a.map(fmt).join(", ")} · mediana ${fmt(p2.medianaA)}` + (p2.juzga ? ` · B mediana ${fmt(p2.medianaB)} · límite ${fmt(p2.limite)}` : "") + ` · ${juicio}`);
    }
    console.log("B2 por mediana (a mano, docs/plan-T37.md): B2 1.º decide; si B2 2.º sale «sube», se anota «informa» y no cuenta.");
  }
  if (bandera("json")) {
    console.log(JSON.stringify({ exes, items, inicio, calientes, frias, fuera, f, s, sB, regresion, cierre, s6, regresionS6, p2, aperturas }, null, 2));
    return;
  }
  console.log(`\nA = ${exes[0]}\nB = ${exes[1]}`);
  console.log(`Motor: ${aperturas[0].textos[0].split("\n")[0].split(" · ")[3]}`);
  console.log(`${bloques} bloques ABBA, ${corridas} corridas por apertura (la 1.ª fría). Mediana de ${de("A", false).length} calientes por exe.\n`);
  console.log("| # | Métrica | B (base) | A (HEAD) | Juicio | A fría (informa) |");
  console.log("|---|---|---|---|---|---|");
  for (const [k, f] of calientes.filas.entries()) {
    const fr = frias.filas[k];
    console.log(`| ${f.id} | ${f.nombre} | ${fmt(f.base)} | ${fmt(f.head)} | ${f.juicio ?? "se informa"} | ${fmt(fr.head)} |`);
  }
  console.log(`\nCalientes: ${calientes.pasa ? "pasa (nada sube)" : "NO pasa: " + calientes.filas.filter((f) => f.juicio === "sube" || f.juicio === "distinto").map((f) => `${f.id} ${f.nombre}`).join(", ")}`);
  // El rango de las calientes de cada exe, para ver el ruido.
  const rango = (quien, id, k) => {
    const v = de(quien, false).map((t) => metricas(filasB(t).get(id))[k].valor);
    return typeof v[0] === "number" ? `${fmt(Math.min(...v))}–${fmt(Math.max(...v))} (med. ${fmt(mediana(v))})` : v.join(" ");
  };
  console.log("\nRango de las calientes (B | A):");
  let previo = null;
  let k = 0;
  for (const f of calientes.filas) {
    k = f.id === previo ? k + 1 : 0;
    previo = f.id;
    if (f.juicio === null) continue;
    console.log(`  ${f.id} ${f.nombre}: ${rango("B", f.id, k)} | ${rango("A", f.id, k)}`);
  }
  // Frías con la regla de C4 (informan; seguimiento de B1 y B3 máx. en C1).
  for (const quien of ["B", "A"]) {
    const n = fuera[quien].reduce((s, x) => s + x.fuera.length, 0);
    console.log(`\nFrías de ${quien} fuera del rango de sus calientes (+1 ms): ${n}`);
    for (const x of fuera[quien]) console.log(`  ${x.id} ${x.nombre}: ${x.fuera.map(fmt).join(", ")} (calientes ${fmt(x.min)}–${fmt(x.max)})`);
  }
  if (!f) return;
  console.log("\nF en la PC (A, criterio de C1; máximos en ms):");
  for (const x of f.filas) {
    const cuales = x.id === "F1" ? "calientes" : "todas";
    console.log(`  ${x.id} ≤ ${x.tope} (${cuales}): ${x.pasa ? "pasa" : "NO pasa"} · ${x.deciden.map(fmt).join(", ")}` + (x.informan.length ? ` · frías (informan): ${x.informan.map(fmt).join(", ")}` : ""));
  }
  const medianasF = (id) => mediana(de("A", false).map((t) => filasF(t).get(id)?.mediana ?? NaN));
  console.log(`  Medianas de las calientes: F1 ${fmt(medianasF("F1"))} · F2 ${fmt(medianasF("F2"))} · F3 ${fmt(medianasF("F3"))}`);
  // K de la PC (C1 solo los anota; el factor sale en C4).
  const porK = new Map();
  for (const t of de("A", false)) for (const [id, v] of valoresK(t)) porK.set(id, [...(porK.get(id) ?? []), v]);
  console.log("\nValores K de A (mediana de las calientes):");
  for (const [id, vs] of porK) console.log(`  ${id} ${vs[0].grupo}: ${fmt(mediana(vs.map((v) => v.valor)))}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
