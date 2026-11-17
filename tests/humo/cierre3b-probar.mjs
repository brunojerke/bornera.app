// Cierre de la fase 3b, etapa 4: «Probar la fase 3b» del menú de desarrollo
// (docs/plan-cierre-3b.md, sección 7), en `npm run dev` a 1024×600.
//
// Comprueba:
//  - el botón está en el menú de desarrollo (en desarrollo; la condición de
//    las prereleases la prueba src/ui/version.test.ts);
//  - con cambios sin guardar avisa antes: Esc y Cancelar no corren nada, y
//    el diálogo se ve entero con el foco en Cancelar;
//  - «Probar igual» corre y la tabla tiene B1 a B16, con #, escenario,
//    medida y tope iguales a la checklist (docs/netbook-fase3b.md) y cada
//    fila con «pasa», «no pasa» o «se anota»;
//  - la hoja queda igual: el mismo documento, el mismo historial, el título
//    con «•» y lo que se muestra sigue siendo la hoja;
//  - sin cambios, corre sin preguntar.
// Las líneas con «·» son lo medido (headless, por software): sirven para
// compararlo con el banco completo, no son comprobaciones.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Cierre 3b: «Probar la fase 3b» del menú de desarrollo";

const Z = ["z", "KeyZ", 90];
const MODAL = '[role="dialog"][aria-modal="true"]';
const CHECKLIST = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/netbook-fase3b.md");
/** Lo que puede tardar una corrida en el humo (headless, por software). */
const LIMITE_CORRIDA_MS = 25_000;

const info = (texto) => console.log(`  ·   ${texto}`);

/** Celdas de las filas «| Bn | …» de una tabla en Markdown. */
function celdas(texto) {
  return texto
    .split(/\r?\n/)
    .filter((l) => /^\| B\d+ \|/.test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
}

export default async function (p, comprobar) {
  const checklist = readFileSync(CHECKLIST, "utf8");
  const tablaB = celdas(checklist.slice(checklist.indexOf("## B."), checklist.indexOf("## C.")));

  const documento = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento))");
  const pasos = () => p.evaluar("bornera.editor.historial.hechos.length");
  const titulo = () => p.evaluar("document.title");
  const muestraLaHoja = () => p.evaluar("bornera.activo() === bornera.editor");
  /** El aviso de arriba mientras corre (la barra de estado también es role="status"). */
  const corriendo = () =>
    p.evaluar(`[...document.querySelectorAll('[role="status"]')].map((e) => e.textContent.trim()).find((t) => t.startsWith("Probar la fase 3b")) ?? null`);
  const dialogo = () =>
    p.evaluar(`(() => { const d = document.querySelector('${MODAL}'); if (!d) return null; const r = d.getBoundingClientRect();
      return { titulo: d.querySelector("h2")?.textContent.trim(), texto: d.querySelector("p")?.textContent.trim() ?? "",
        resultado: d.querySelector("textarea")?.value ?? null,
        foco: d.contains(document.activeElement) ? document.activeElement.textContent.trim() : null,
        dentro: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; })()`);
  const clicEn = async (expresion, que) => {
    const k = await p.evaluar(`(() => { const b = ${expresion}; if (!b) return null; b.scrollIntoView({ block: "nearest" });
      const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!k) throw new Error(`No está ${que}.`);
    await p.clic(k);
  };
  const boton = (selector, texto) => `[...document.querySelectorAll('${selector}')].find((b) => b.textContent.trim() === ${JSON.stringify(texto)})`;
  const abrirMenu = () => clicEn(`document.querySelector('button[aria-label="Menú de desarrollo"]')`, "el menú de desarrollo");
  const itemProbar = boton('[role="menu"] button', "Probar la fase 3b…");
  const probar = async () => {
    await abrirMenu();
    await clicEn(itemProbar, "«Probar la fase 3b…» en el menú");
    await esperar(150);
  };
  /** Espera la tabla del diálogo; devuelve el texto y cuánto tardó. */
  const esperarTabla = async () => {
    const t0 = Date.now();
    await p.esperarA(`document.querySelector('${MODAL} textarea') !== null`, LIMITE_CORRIDA_MS);
    return { texto: (await dialogo()).resultado, ms: Date.now() - t0 };
  };
  const cerrarTabla = async () => {
    await clicEn(boton(`${MODAL} button`, "Cerrar"), "el botón Cerrar");
    await esperar(100);
  };

  // ── El botón ───────────────────────────────────────────────────────────
  await abrirMenu();
  const enMenu = await p.evaluar(`(() => { const b = ${itemProbar}; return b ? b.getAttribute("role") : null; })()`);
  comprobar("«Probar la fase 3b…» está en el menú de desarrollo", enMenu === "menuitem");
  await p.esc();
  await esperar(100);

  // ── Con cambios sin guardar: avisa antes ───────────────────────────────
  await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
    editor.ejecutar(c.colocar(editor.documento, { tipo: "contactor.bobina", x: 4, y: 4, rot: 0, espejado: false, etiqueta: "K9", params: {} })); })()`);
  const antes = { documento: await documento(), pasos: await pasos(), titulo: await titulo() };
  comprobar("con un cambio, el título lleva «•»", antes.titulo.startsWith("• "), antes.titulo);

  await probar();
  let d = await dialogo();
  comprobar(
    "con cambios, avisa antes: «Probar la fase 3b», sin guardar, foco en Cancelar, entero a la vista",
    d?.titulo === "Probar la fase 3b" && /cambios sin guardar/.test(d.texto) && /no toca tu hoja/.test(d.texto) && d.foco === "Cancelar" && d.dentro,
    JSON.stringify(d),
  );
  await p.esc();
  await esperar(150);
  comprobar("Esc cierra el aviso y no corre nada", (await dialogo()) === null && (await corriendo()) === null);

  await probar();
  await clicEn(boton(`${MODAL} button`, "Cancelar"), "Cancelar");
  await esperar(150);
  comprobar("Cancelar cierra el aviso y no corre nada", (await dialogo()) === null && (await corriendo()) === null);

  await probar();
  await clicEn(boton(`${MODAL} button`, "Probar igual"), "Probar igual");
  // El aviso arranca con «Preparando las escenas…» y dice «Probar la fase 3b: …»
  // recién con el primer progreso: se espera esa señal (leerlo enseguida
  // dependía de que llegara en unos milisegundos; falló 1 vez en T23).
  await p.esperarA(`[...document.querySelectorAll('[role="status"]')].some((e) => e.textContent.trim().startsWith("Probar la fase 3b"))`, 10000).catch(() => undefined);
  const aviso = await corriendo();
  comprobar("«Probar igual» corre: el aviso de arriba dice qué mide", aviso !== null && aviso.startsWith("Probar la fase 3b"), String(aviso));
  const { texto, ms } = await esperarTabla();
  info(`corrida: ${(ms / 1000).toFixed(1)} s`);

  // ── La tabla ───────────────────────────────────────────────────────────
  d = await dialogo();
  comprobar("el diálogo del resultado se titula «Probar la fase 3b»", d?.titulo === "Probar la fase 3b", String(d?.titulo));
  comprobar("encabezado con la versión y el lienzo", /^Probar la fase 3b · Bornera \d+\.\d+\.\d+\S* · .* · lienzo 1366×768 fuera de pantalla · \d+ s$/.test(texto.split("\n")[0]), texto.split("\n")[0]);
  comprobar("la 1.ª corrida tras abrir avisa «Con calentamiento (N s)» (T20)", / · Con calentamiento \(\d+ s\) · /.test(texto.split("\n")[0]), texto.split("\n")[0]);
  const filas = celdas(texto);
  comprobar(
    "B1 a B16 con #, escenario, medida y tope de la checklist",
    isDeepStrictEqual(
      filas.map((c) => c.slice(0, 4)),
      tablaB.map((c) => c.slice(0, 4)),
    ),
    JSON.stringify(filas.map((c) => c[0])),
  );
  comprobar(
    "cada fila tiene lo medido y «pasa», «no pasa» o «se anota» (B9 se anota)",
    filas.every((c) => c[4] !== "" && ["pasa", "no pasa", "se anota"].includes(c[5])) && filas.find((c) => c[0] === "B9")?.[5] === "se anota",
  );
  for (const c of filas) info(`${c[0]} ${c[1]} · ${c[2]}: ${c[4]} (${c[5]})`);

  // ── La hoja quedó igual ────────────────────────────────────────────────
  comprobar("la hoja quedó igual: documento, historial y título", isDeepStrictEqual(await documento(), antes.documento) && (await pasos()) === antes.pasos && (await titulo()) === antes.titulo);
  comprobar("se sigue mostrando la hoja (no una escena del banco)", await muestraLaHoja());
  await cerrarTabla();

  // ── Sin cambios: corre sin preguntar ───────────────────────────────────
  await p.tecla(...Z, CTRL);
  await esperar(150);
  comprobar("Ctrl+Z deshace el cambio de la hoja (sin «•»)", !(await titulo()).startsWith("• ") && (await pasos()) === 0);
  await probar();
  const sinAviso = (await dialogo()) === null && (await corriendo()) !== null;
  comprobar("sin cambios, corre sin preguntar", sinAviso);
  if (sinAviso) {
    const segunda = await esperarTabla();
    info(`segunda corrida: ${(segunda.ms / 1000).toFixed(1)} s`);
    comprobar("la segunda corrida también da B1 a B16", celdas(segunda.texto).length === 16);
    comprobar("la segunda corrida no vuelve a calentar", !/calentamiento/.test(segunda.texto.split("\n")[0]), segunda.texto.split("\n")[0]);
    await cerrarTabla();
  }
}
