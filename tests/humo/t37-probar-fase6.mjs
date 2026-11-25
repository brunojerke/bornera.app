// T37: «Probar la fase 6» del menú de desarrollo (docs/plan-T37.md), en
// `npm run dev` a 1024×600.
//
// Comprueba:
//  - la marca de arranque (P2, D24-A) está una sola vez desde que abrió la
//    app, y abrir el menú o correr la prueba no deja otra;
//  - el botón está en el menú de desarrollo, después de «Probar la fase 5»;
//  - corre y la tabla trae B1–B16, F1–F3, S1–S6 y P2: S6 con el tope de la
//    netbook (300 ms) y lo medido; P2 con los ms de la marca y «se anota»;
//    S6 y P2 sin K; P1 no está (T38, D23-A);
//  - las notas traen la escena de potencia (2000 + 3519, 95 trifásicas, 1526
//    redes) y el desglose de S6;
//  - la hoja queda igual: documento, historial y título sin «•».
// Las líneas con «·» son lo medido (headless, por software): no son
// comprobaciones; S6 no se juzga acá (sin topes de tiempo en el humo).

import { isDeepStrictEqual } from "node:util";
import { esperar } from "./cdp.mjs";

export const nombre = "T37: «Probar la fase 6» del menú de desarrollo";

const MODAL = '[role="dialog"][aria-modal="true"]';
const MARCA = "bornera:primer-cuadro-nitido";
/** Lo que puede tardar la corrida en el humo (headless, con el calentamiento). */
const LIMITE_CORRIDA_MS = 240_000;

const info = (texto) => console.log(`  ·   ${texto}`);

/** Celdas de las filas «| Xn |» de una tabla en Markdown. */
function celdas(texto, letra) {
  return texto
    .split(/\r?\n/)
    .filter((l) => new RegExp(`^\\| ${letra}\\d+ \\|`).test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
}

export default async function (p, comprobar) {
  const documento = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento))");
  const pasos = () => p.evaluar("bornera.editor.historial.hechos.length");
  const titulo = () => p.evaluar("document.title");
  const marcas = () => p.evaluar(`performance.getEntriesByName(${JSON.stringify(MARCA)}, "mark").map((m) => m.startTime)`);
  const dialogo = () =>
    p.evaluar(`(() => { const d = document.querySelector('${MODAL}'); if (!d) return null;
      return { titulo: d.querySelector("h2")?.textContent.trim(), resultado: d.querySelector("textarea")?.value ?? null }; })()`);
  const clicEn = async (expresion, que) => {
    const k = await p.evaluar(`(() => { const b = ${expresion}; if (!b) return null; b.scrollIntoView({ block: "nearest" });
      const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!k) throw new Error(`No está ${que}.`);
    await p.clic(k);
  };
  const boton = (selector, texto) => `[...document.querySelectorAll('${selector}')].find((b) => b.textContent.trim() === ${JSON.stringify(texto)})`;
  const abrirMenu = () => clicEn(`document.querySelector('button[aria-label="Menú de desarrollo"]')`, "el menú de desarrollo");

  // ── La marca de arranque ───────────────────────────────────────────────
  const marca = await marcas();
  comprobar("la marca de arranque (P2) está una sola vez", marca.length === 1 && marca[0] > 0, JSON.stringify(marca));
  info(`P2 (marca de arranque): ${marca[0]?.toFixed(1)} ms desde timeOrigin`);

  // ── El botón ───────────────────────────────────────────────────────────
  await abrirMenu();
  const items = await p.evaluar(`[...document.querySelectorAll('[role="menu"] [role="menuitem"]')].map((b) => b.textContent.trim())`);
  const i5 = items.indexOf("Probar la fase 5…");
  comprobar("«Probar la fase 6…» está en el menú de desarrollo, después de «Probar la fase 5…»", i5 >= 0 && items[i5 + 1] === "Probar la fase 6…", JSON.stringify(items));

  // ── Corre ──────────────────────────────────────────────────────────────
  const antes = { documento: await documento(), pasos: await pasos(), titulo: await titulo() };
  await clicEn(boton('[role="menu"] button', "Probar la fase 6…"), "«Probar la fase 6…» en el menú");
  const t0 = Date.now();
  await p.esperarA(`document.querySelector('${MODAL} textarea') !== null`, LIMITE_CORRIDA_MS);
  const d = await dialogo();
  const texto = d.resultado;
  info(`corrida: ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  // ── La tabla ───────────────────────────────────────────────────────────
  const encabezado = texto.split("\n")[0];
  comprobar("el diálogo del resultado se titula «Probar la fase 6»", d.titulo === "Probar la fase 6", String(d.titulo));
  comprobar("encabezado de la fase 6 con la versión, el lienzo y «sin disco»", /^Probar la fase 6 · Bornera \S+ · .* · lienzo 1366×768 fuera de pantalla · sin disco · \d+ s$/.test(encabezado), encabezado);
  const b = celdas(texto, "B");
  const f = celdas(texto, "F");
  const s = celdas(texto, "S");
  const pp = celdas(texto, "P");
  comprobar("trae B1–B16 y F1–F3", b.length === 16 && isDeepStrictEqual(f.map((c) => c[0]), ["F1", "F2", "F3"]), `${b.length} B, ${f.length} F`);
  comprobar("trae S1–S6 y P2, sin P1 (T38)", isDeepStrictEqual(s.map((c) => c[0]), ["S1", "S2", "S3", "S4", "S5", "S6"]) && isDeepStrictEqual(pp.map((c) => c[0]), ["P2"]), JSON.stringify([...s, ...pp].map((c) => c[0])));
  const s6 = s.find((c) => c[0] === "S6") ?? [];
  comprobar("S6 con el tope de la netbook (≤ 300 ms, máx.), lo medido («X / Y ms») y «pasa» o «no pasa»", s6[3] === "≤ 300 ms (máx.)" && /^\d+,\d \/ \d+,\d ms$/.test(s6[4] ?? "") && ["pasa", "no pasa"].includes(s6[5]), JSON.stringify(s6));
  const p2 = pp[0] ?? [];
  const p2ms = Number((/^([\d,]+) ms$/.exec(p2[4] ?? "")?.[1] ?? "").replace(",", "."));
  comprobar("P2 trae los ms de la marca de arranque y «se anota»", p2[5] === "se anota" && Math.abs(p2ms - (marca[0] ?? NaN)) <= 0.05, `${p2[4]} contra ${marca[0]}`);
  comprobar("S6 y P2 no llevan K", s6[6] === "—" && p2[6] === "—");
  comprobar("las notas traen la escena de potencia (2000 + 3519, 95 trifásicas, 1526 redes)", texto.includes("S6: escena de potencia de 2000 componentes + 3519 cables (95 trifásicas, 1526 redes)"));
  const desglose = texto.split("\n").find((l) => l.startsWith("S6, desglose"));
  comprobar("las notas traen el desglose de S6 (R4, netlist, iniciar, cuadro)", /R4 \d+,\d · netlist \d+,\d · iniciar \d+,\d · cuadro \d+,\d/.test(desglose ?? ""), String(desglose));
  comprobar("las notas de la fase 5 siguen (desglose de S1, escena de mando)", texto.includes("S1, desglose") && texto.includes("2000 componentes + 2200 cables (300 bobinas)"));
  for (const c of [...s, ...pp]) info(`${c[0]}: ${c[4]} (${c[5]})`);
  if (desglose) info(desglose);

  // ── La hoja quedó igual, y la marca también ────────────────────────────
  comprobar(
    "la hoja quedó igual: documento, historial y título, sin «•»",
    isDeepStrictEqual(await documento(), antes.documento) && (await pasos()) === antes.pasos && (await titulo()) === antes.titulo && !(await titulo()).includes("•"),
    await titulo(),
  );
  comprobar("correr la prueba no deja otra marca de arranque", isDeepStrictEqual(await marcas(), marca), JSON.stringify(await marcas()));
  comprobar("se sigue mostrando la hoja (no una escena del banco)", await p.evaluar("bornera.activo() === bornera.editor"));
  await clicEn(boton(`${MODAL} button`, "Cerrar"), "el botón Cerrar");
  await esperar(100);
}
