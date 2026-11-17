// Lo común de las mediciones en WebView2 con la app real (solo Windows):
// `f1-webview2.mjs` (F1, T23) y `probar-webview2.mjs` («Probar la fase 3b»,
// ABBA de B1–B16).
//
// Abre el exe con el puerto de depuración de WebView2 (variable
// WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS), espera la app, toca un ítem del menú
// de desarrollo y, al final, corta el proceso. Cada proceso es nuevo: lo
// primero que mide es en frío.
//
// El exe usa el perfil de la app instalada (%LOCALAPPDATA%\com.bornera.app):
// no tiene que haber otra Bornera abierta, porque se uniría a su proceso de
// WebView2 sin el puerto. Si al abrir sale «Bornera no se cerró bien» (quedan
// copias de recuperación en el perfil), se cierra con Esc: las copias quedan
// para el próximo arranque, no se borra nada.
// No agrega dependencias.

import { execFileSync, spawn } from "node:child_process";
import { esperar, Pagina } from "../humo/cdp.mjs";

export { esperar };

/** Número con coma decimal → número. */
export const leerNumero = (t) => Number(String(t).trim().replace(",", "."));
export const unDecimal = (n) => n.toFixed(1).replace(".", ",");
export const mediana = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

/** Argumentos de la línea de comandos: `opcion("exe")`, `bandera("json")`, `entero("procesos", 3)`. */
export function argumentos(args = process.argv.slice(2)) {
  const opcion = (nombre) => args.find((a) => a.startsWith(`--${nombre}=`))?.split("=").slice(1).join("=");
  const bandera = (nombre) => args.includes(`--${nombre}`);
  const entero = (nombre, porDefecto) => {
    const v = opcion(nombre);
    const n = v === undefined ? porDefecto : Number(v);
    if (!Number.isSafeInteger(n) || n < 1) throw new Error(`--${nombre} tiene que ser un entero mayor que 0 (es ${v})`);
    return n;
  };
  return { opcion, bandera, entero };
}

/** Espera la página de la app en el puerto de depuración. */
async function paginaDeLaApp(puerto) {
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

const MODAL = '[role="dialog"][aria-modal="true"]';
/** Cuánto se espera, al abrir, a que salga «Bornera no se cerró bien» (T23). */
const ESPERA_RECUPERAR_MS = 2000;

/**
 * Abre el exe, hace `trabajo(pagina)` y corta el proceso, también si falla.
 * Devuelve lo que devuelva `trabajo`, más `recuperar`: si salió el diálogo de
 * recuperar y se cerró con Esc.
 */
export async function conLaApp(exe, puerto, trabajo) {
  const hijo = spawn(exe, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${puerto}` },
    stdio: "ignore",
  });
  let pagina = null;
  try {
    pagina = await Pagina.conectar(await paginaDeLaApp(puerto));
    const listo = `!!document.querySelector('[aria-label="Menú de desarrollo"]') && !!document.querySelector("canvas")`;
    for (let i = 0; i < 300 && !(await pagina.evaluar(listo).catch(() => false)); i++) await esperar(100);
    const recuperar = await cerrarRecuperar(pagina);
    return { ...(await trabajo(pagina)), recuperar };
  } finally {
    pagina?.cerrar();
    cortar(hijo.pid);
    // Que WebView2 suelte el perfil y el puerto antes del próximo.
    await esperar(2000);
  }
}

/** Si sale «Bornera no se cerró bien» o «No se pudo recuperar», Esc (decidir la próxima vez). */
async function cerrarRecuperar(pagina) {
  const titulo = `document.querySelector('${MODAL} h2')?.textContent.trim() ?? null`;
  const esRecuperar = (t) => t === "Bornera no se cerró bien" || t === "No se pudo recuperar";
  const t0 = Date.now();
  let t = null;
  while (Date.now() - t0 < ESPERA_RECUPERAR_MS && !esRecuperar((t = await pagina.evaluar(titulo).catch(() => null)))) await esperar(100);
  if (!esRecuperar(t)) return false;
  await pagina.tecla("Escape", "Escape", 27);
  for (let i = 0; i < 50 && esRecuperar(await pagina.evaluar(titulo).catch(() => null)); i++) await esperar(100);
  if (esRecuperar(await pagina.evaluar(titulo).catch(() => null))) throw new Error(`«${t}» no se cerró con Esc.`);
  return true;
}

/** Abre el menú de desarrollo y toca el ítem que contiene `texto`. */
export async function tocarMenu(pagina, texto) {
  await pagina.evaluar(`document.querySelector('[aria-label="Menú de desarrollo"]').click()`);
  await esperar(100);
  const tocado = await pagina.evaluar(
    `(() => { const b = [...document.querySelectorAll('[role="menuitem"]')].find((x) => x.textContent.includes(${JSON.stringify(texto)}));
      if (!b) return false; b.click(); return true; })()`,
  );
  if (!tocado) throw new Error(`No está «${texto}» en el menú de desarrollo.`);
}

/** El texto del diálogo de resultado (`textarea[aria-label="Resultado"]` o el del modal), o "". */
export const textoResultado = (pagina) =>
  pagina.evaluar(`(document.querySelector('textarea[aria-label="Resultado"]') ?? document.querySelector('${MODAL} textarea'))?.value ?? ""`).catch(() => "");

/** Cierra el diálogo de resultado con su botón «Cerrar». */
export async function cerrarResultado(pagina) {
  const ok = await pagina.evaluar(
    `(() => { const b = [...document.querySelectorAll('${MODAL} button')].find((x) => x.textContent.trim() === "Cerrar");
      if (!b) return false; b.click(); return true; })()`,
  );
  if (!ok) throw new Error("No está el botón Cerrar del resultado.");
  for (let i = 0; i < 50 && (await pagina.evaluar(`!!document.querySelector('${MODAL}')`).catch(() => false)); i++) await esperar(100);
}
