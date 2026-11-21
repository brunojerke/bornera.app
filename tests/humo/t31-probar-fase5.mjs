// T31: «Probar la fase 5» del menú de desarrollo (docs/plan-T31.md), en
// `npm run dev` a 1024×600.
//
// Comprueba:
//  - el botón está en el menú de desarrollo, después de «Probar la fase 4»;
//  - corre (sin cambios sin guardar, sin aviso antes) y la tabla trae B1–B16,
//    F1–F3 y S1–S5, con los topes de la netbook de S (sección 3 del plan de
//    fase); S4 dice «se mide en T33»; las S no llevan K;
//  - las notas traen el desglose de S1 y el tiempo de pared de S5;
//  - la hoja queda igual: documento, historial y título sin «•».
// Las líneas con «·» son lo medido (headless, por software): no son
// comprobaciones.

import { isDeepStrictEqual } from "node:util";
import { esperar } from "./cdp.mjs";

export const nombre = "T31: «Probar la fase 5» del menú de desarrollo";

const MODAL = '[role="dialog"][aria-modal="true"]';
/** Lo que puede tardar la corrida en el humo (headless, con el calentamiento). */
const LIMITE_CORRIDA_MS = 180_000;

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

  // ── El botón ───────────────────────────────────────────────────────────
  await abrirMenu();
  const items = await p.evaluar(`[...document.querySelectorAll('[role="menu"] [role="menuitem"]')].map((b) => b.textContent.trim())`);
  const i4 = items.indexOf("Probar la fase 4…");
  comprobar("«Probar la fase 5…» está en el menú de desarrollo, después de «Probar la fase 4…»", i4 >= 0 && items[i4 + 1] === "Probar la fase 5…", JSON.stringify(items));

  // ── Corre ──────────────────────────────────────────────────────────────
  const antes = { documento: await documento(), pasos: await pasos(), titulo: await titulo() };
  await clicEn(boton('[role="menu"] button', "Probar la fase 5…"), "«Probar la fase 5…» en el menú");
  const t0 = Date.now();
  await p.esperarA(`document.querySelector('${MODAL} textarea') !== null`, LIMITE_CORRIDA_MS);
  const d = await dialogo();
  const texto = d.resultado;
  info(`corrida: ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  // ── La tabla ───────────────────────────────────────────────────────────
  const encabezado = texto.split("\n")[0];
  comprobar("el diálogo del resultado se titula «Probar la fase 5»", d.titulo === "Probar la fase 5", String(d.titulo));
  comprobar("encabezado de la fase 5 con la versión, el lienzo y «sin disco»", /^Probar la fase 5 · Bornera \S+ · .* · lienzo 1366×768 fuera de pantalla · sin disco · \d+ s$/.test(encabezado), encabezado);
  const b = celdas(texto, "B");
  const f = celdas(texto, "F");
  const s = celdas(texto, "S");
  comprobar("trae B1–B16 y F1–F3", b.length === 16 && isDeepStrictEqual(f.map((c) => c[0]), ["F1", "F2", "F3"]), `${b.length} B, ${f.length} F`);
  comprobar(
    "S1–S5 con los topes de la netbook (300, 5 / 16, 50, 33 / 100 y 300 ms)",
    isDeepStrictEqual(
      s.map((c) => [c[0], c[3]]),
      [
        ["S1", "≤ 300 ms (máx.)"],
        ["S2", "≤ 5 / 16 ms"],
        ["S3", "≤ 50 ms (máx.)"],
        ["S4", "≤ 33 / 100 ms"],
        ["S5", "≤ 300 ms (máx.)"],
      ],
    ),
    JSON.stringify(s.map((c) => [c[0], c[3]])),
  );
  comprobar("S1, S2, S3 y S5 traen lo medido («X / Y ms») y «pasa» o «no pasa»", s.filter((c) => c[0] !== "S4").every((c) => /^\d+,\d \/ \d+,\d ms$/.test(c[4]) && ["pasa", "no pasa"].includes(c[5])), JSON.stringify(s.map((c) => c[4])));
  comprobar("S4 dice «se mide en T33» y se anota", isDeepStrictEqual(s[3]?.slice(4, 6), ["se mide en T33", "se anota"]), JSON.stringify(s[3]));
  comprobar("las S no llevan K", s.every((c) => c[6] === "—"));
  const desglose = texto.split("\n").find((l) => l.startsWith("S1, desglose"));
  comprobar("las notas traen el desglose de S1 (R4, netlist, iniciar, cuadro)", /R4 \d+,\d · netlist \d+,\d · iniciar \d+,\d · cuadro \d+,\d/.test(desglose ?? ""), String(desglose));
  comprobar("las notas traen la escena de mando (2000 + 2200, 300 bobinas) y la pared de S5", texto.includes("2000 componentes + 2200 cables (300 bobinas)") && texto.includes("S5, de abrir a los avisos"));
  for (const c of s) info(`${c[0]}: ${c[4]} (${c[5]})`);
  if (desglose) info(desglose);

  // ── La hoja quedó igual ────────────────────────────────────────────────
  comprobar(
    "la hoja quedó igual: documento, historial y título, sin «•»",
    isDeepStrictEqual(await documento(), antes.documento) && (await pasos()) === antes.pasos && (await titulo()) === antes.titulo && !(await titulo()).includes("•"),
    await titulo(),
  );
  comprobar("se sigue mostrando la hoja (no una escena del banco)", await p.evaluar("bornera.activo() === bornera.editor"));
  await clicEn(boton(`${MODAL} button`, "Cerrar"), "el botón Cerrar");
  await esperar(100);
}
