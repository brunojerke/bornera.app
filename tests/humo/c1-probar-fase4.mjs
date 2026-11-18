// Cierre de la fase 4, C1: «Probar la fase 4» del menú de desarrollo
// (docs/plan-fase4.md, sección 6), en `npm run dev` a 1024×600.
//
// Comprueba:
//  - el botón está en el menú de desarrollo, junto a «Probar la fase 3b»;
//  - con cambios sin guardar avisa antes, con su título; Cancelar no corre;
//  - «Probar igual» corre: la tabla tiene B1–B16 con #, escenario, medida y
//    tope de la checklist de la 3b, y F1, F2 y F3 con su tope de netbook; la
//    columna K es la del plan; las notas dicen que la copia y lo abierto dan
//    igual, y en el navegador F2 y F3 van «sin disco»;
//  - la hoja queda igual (documento, historial, título con «•») y se sigue
//    mostrando; los recientes no cambian; la medición no deja copias en
//    IndexedDB.
// Las líneas con «·» son lo medido (headless, por software): no son
// comprobaciones.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { esperar } from "./cdp.mjs";

export const nombre = "Cierre de la fase 4 (C1): «Probar la fase 4» del menú de desarrollo";

const MODAL = '[role="dialog"][aria-modal="true"]';
const CHECKLIST = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/netbook-fase3b.md");
/** Lo que puede tardar la corrida en el humo (headless, con el calentamiento). */
const LIMITE_CORRIDA_MS = 50_000;
/** La columna K que dice el plan (C1). */
const K = {
  B1: "K1", B2: "K1", B3: "K2", B4: "K1", B5: "K1", B6: "K2", B7: "K1", B8: "—", B9: "—", B10: "K1",
  B11: "K2", B12: "K1", B13: "K1", B14: "K2", B15: "—", B16: "K2", F1: "K1", F2: "K1", F3: "K2",
};

const info = (texto) => console.log(`  ·   ${texto}`);

/** Celdas de las filas «| Bn |» o «| Fn |» de una tabla en Markdown. */
function celdas(texto, letra) {
  return texto
    .split(/\r?\n/)
    .filter((l) => new RegExp(`^\\| ${letra}\\d+ \\|`).test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
}

export default async function (p, comprobar) {
  const checklist = readFileSync(CHECKLIST, "utf8");
  const tablaB = celdas(checklist.slice(checklist.indexOf("## B."), checklist.indexOf("## C.")), "B");

  const documento = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento))");
  const pasos = () => p.evaluar("bornera.editor.historial.hechos.length");
  const titulo = () => p.evaluar("document.title");
  const recientes = () => p.evaluar(`localStorage.getItem("bornera.recientes")`);
  const corriendo = () =>
    p.evaluar(`[...document.querySelectorAll('[role="status"]')].map((e) => e.textContent.trim()).find((t) => t.startsWith("Probar la fase 4")) ?? null`);
  const dialogo = () =>
    p.evaluar(`(() => { const d = document.querySelector('${MODAL}'); if (!d) return null;
      return { titulo: d.querySelector("h2")?.textContent.trim(), texto: d.querySelector("p")?.textContent.trim() ?? "",
        resultado: d.querySelector("textarea")?.value ?? null,
        foco: d.contains(document.activeElement) ? document.activeElement.textContent.trim() : null }; })()`);
  const clicEn = async (expresion, que) => {
    const k = await p.evaluar(`(() => { const b = ${expresion}; if (!b) return null; b.scrollIntoView({ block: "nearest" });
      const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!k) throw new Error(`No está ${que}.`);
    await p.clic(k);
  };
  const boton = (selector, texto) => `[...document.querySelectorAll('${selector}')].find((b) => b.textContent.trim() === ${JSON.stringify(texto)})`;
  const abrirMenu = () => clicEn(`document.querySelector('button[aria-label="Menú de desarrollo"]')`, "el menú de desarrollo");
  const itemProbar = boton('[role="menu"] button', "Probar la fase 4…");
  const probar = async () => {
    await abrirMenu();
    await clicEn(itemProbar, "«Probar la fase 4…» en el menú");
    await esperar(150);
  };
  const medicionesEnLaBase = () =>
    p.evaluar(`new Promise((r) => {
      const q = indexedDB.open("bornera");
      q.onsuccess = () => {
        const db = q.result;
        const tx = db.transaction(["copias", "trozos"]);
        const copias = tx.objectStore("copias").getAllKeys();
        const trozos = tx.objectStore("trozos").getAllKeys();
        tx.oncomplete = () => {
          db.close();
          r([...copias.result, ...trozos.result.map((k) => k[0])].filter((id) => String(id).startsWith("medicion-")).length);
        };
      };
    })`);

  // ── El botón ───────────────────────────────────────────────────────────
  await abrirMenu();
  const items = await p.evaluar(`[...document.querySelectorAll('[role="menu"] [role="menuitem"]')].map((b) => b.textContent.trim())`);
  const i3b = items.indexOf("Probar la fase 3b…");
  comprobar("«Probar la fase 4…» está en el menú de desarrollo, después de «Probar la fase 3b…»", i3b >= 0 && items[i3b + 1] === "Probar la fase 4…", JSON.stringify(items));
  await p.esc();
  await esperar(100);

  // ── Con cambios sin guardar: avisa antes ───────────────────────────────
  await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
    editor.ejecutar(c.colocar(editor.documento, { tipo: "contactor.bobina", x: 4, y: 4, rot: 0, espejado: false, etiqueta: "K9", params: {} })); })()`);
  const antes = { documento: await documento(), pasos: await pasos(), titulo: await titulo(), recientes: await recientes() };
  await probar();
  let d = await dialogo();
  comprobar(
    "con cambios, avisa antes con el título «Probar la fase 4» y el foco en Cancelar",
    d?.titulo === "Probar la fase 4" && /cambios sin guardar/.test(d.texto) && d.foco === "Cancelar",
    JSON.stringify(d),
  );
  await clicEn(boton(`${MODAL} button`, "Cancelar"), "Cancelar");
  await esperar(150);
  comprobar("Cancelar cierra el aviso y no corre nada", (await dialogo()) === null && (await corriendo()) === null);

  await probar();
  await clicEn(boton(`${MODAL} button`, "Probar igual"), "Probar igual");
  await p.esperarA(`[...document.querySelectorAll('[role="status"]')].some((e) => e.textContent.trim().startsWith("Probar la fase 4"))`, 10000).catch(() => undefined);
  const aviso = await corriendo();
  comprobar("«Probar igual» corre: el aviso de arriba dice qué mide", aviso !== null, String(aviso));
  const t0 = Date.now();
  await p.esperarA(`document.querySelector('${MODAL} textarea') !== null`, LIMITE_CORRIDA_MS);
  const texto = (await dialogo()).resultado;
  info(`corrida: ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  // ── La tabla ───────────────────────────────────────────────────────────
  d = await dialogo();
  const encabezado = texto.split("\n")[0];
  comprobar("el diálogo del resultado se titula «Probar la fase 4»", d?.titulo === "Probar la fase 4", String(d?.titulo));
  comprobar(
    "encabezado con la versión, el calentamiento, el lienzo y «sin disco» (navegador)",
    /^Probar la fase 4 · Bornera \d+\.\d+\.\d+\S* · .* · Con calentamiento \(\d+ s\) · lienzo 1366×768 fuera de pantalla · sin disco · \d+ s$/.test(encabezado),
    encabezado,
  );
  comprobar("columnas de la fase 3b más K", texto.split("\n")[2] === "| # | Escenario | Medida | Tope netbook | Netbook | Resultado | K |", texto.split("\n")[2]);
  const b = celdas(texto, "B");
  comprobar(
    "B1 a B16 con #, escenario, medida y tope de la checklist de la 3b",
    isDeepStrictEqual(
      b.map((c) => c.slice(0, 4)),
      tablaB.map((c) => c.slice(0, 4)),
    ),
    JSON.stringify(b.map((c) => c[0])),
  );
  const f = celdas(texto, "F");
  comprobar(
    "F1, F2 y F3 con su tope de netbook (50 ms, 1 s y 3 s, sobre el máximo)",
    isDeepStrictEqual(
      f.map((c) => [c[0], c[3]]),
      [
        ["F1", "≤ 50 ms (máx.)"],
        ["F2", "≤ 1000 ms (máx.)"],
        ["F3", "≤ 3000 ms (máx.)"],
      ],
    ),
    JSON.stringify(f.map((c) => [c[0], c[3]])),
  );
  const filas = [...b, ...f];
  comprobar(
    "cada fila tiene lo medido y «pasa», «no pasa» o «se anota»",
    filas.every((c) => c[4] !== "" && ["pasa", "no pasa", "se anota"].includes(c[5])),
  );
  comprobar(
    "la columna K es la del plan (K1, K2 o —), con el número",
    filas.every((c) => (K[c[0]] === "—" ? c[6] === "—" : new RegExp(`^${K[c[0]]}: \\d+,\\d$`).test(c[6] ?? ""))),
    JSON.stringify(filas.map((c) => [c[0], c[6]])),
  );
  comprobar("F1: la última copia, releída, es igual a serializar", texto.includes("es igual a serializar"));
  comprobar("F2 y F3: sin disco en el navegador, y lo abierto es igual al documento", texto.includes("sin disco (en memoria)") && texto.includes("es igual al documento"));
  for (const c of f) info(`${c[0]} ${c[1]}: ${c[4]} (${c[5]}; ${c[6]})`);

  // ── La hoja y lo demás quedaron igual ──────────────────────────────────
  comprobar("la hoja quedó igual: documento, historial y título", isDeepStrictEqual(await documento(), antes.documento) && (await pasos()) === antes.pasos && (await titulo()) === antes.titulo);
  comprobar("se sigue mostrando la hoja (no una escena del banco)", await p.evaluar("bornera.activo() === bornera.editor"));
  comprobar("los recientes no cambian", (await recientes()) === antes.recientes);
  comprobar("la medición no deja copias ni trozos en IndexedDB", (await medicionesEnLaBase()) === 0);
  await clicEn(boton(`${MODAL} button`, "Cerrar"), "el botón Cerrar");
  await esperar(100);
}
