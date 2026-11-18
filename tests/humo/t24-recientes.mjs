// T24: Abrir reciente (D8-A).
//
// En el navegador no hay rutas: el menú no aparece y Guardar y Abrir no
// escriben la lista en `localStorage`. El menú con rutas, el alcance de fs y
// «ya no existe» se prueban a mano en `tauri dev` (y la fila 5 de la netbook).

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Abrir reciente";

const S = ["s", "KeyS", 83];
const O = ["o", "KeyO", 79];
const CLAVE = "bornera.recientes";

export default async function (p, comprobar) {
  const carpeta = mkdtempSync(join(tmpdir(), "bornera-descargas-"));
  const archivos = mkdtempSync(join(tmpdir(), "bornera-archivos-"));
  await p.descargasEn(carpeta);
  try {
    await probar(p, comprobar, carpeta, archivos);
  } finally {
    await p.interceptarSelector(false).catch(() => undefined);
    await p.descargasEn(null).catch(() => undefined);
    for (const c of [carpeta, archivos]) rmSync(c, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

async function probar(p, comprobar, carpeta, archivos) {
  const tecla = ([key, code, w], mods = 0) => p.tecla(key, code, w, mods);
  const aviso = () => p.evaluar(`document.querySelector(".avisos").textContent.trim()`);
  const hayMenu = () => p.evaluar(`document.querySelector('[aria-label="Abrir reciente"]') !== null`);
  const guardada = () => p.evaluar(`(() => { try { return localStorage.getItem(${JSON.stringify(CLAVE)}); } catch { return "tiró"; } })()`);
  /** Espera una descarga, la lee y vacía la carpeta. */
  const descarga = async (ms = 8000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const listos = readdirSync(carpeta).filter((f) => !f.endsWith(".crdownload") && !f.endsWith(".tmp"));
      if (listos.length > 0 && listos.length === readdirSync(carpeta).length) {
        await esperar(100);
        const nombre = listos[0];
        const bytes = readFileSync(join(carpeta, nombre));
        for (const f of readdirSync(carpeta)) rmSync(join(carpeta, f), { force: true });
        return { nombre, bytes };
      }
      await esperar(100);
    }
    return null;
  };

  comprobar("en el navegador no hay menú «Abrir reciente»; Abrir sí está", !(await hayMenu()) && (await p.evaluar(`document.querySelector('button[aria-label="Abrir"]') !== null`)));
  comprobar("al arrancar no hay lista guardada", (await guardada()) === null, String(await guardada()));

  // Guardar en el navegador es una descarga, sin ruta: no entra a la lista.
  await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
    editor.ejecutar(c.colocar(editor.documento, { tipo: "contactor.bobina", x: 0, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: {} })); })()`);
  await tecla(S, CTRL);
  const d = await descarga();
  comprobar("Ctrl+S descarga «Sin título.brn»", d?.nombre === "Sin título.brn", d?.nombre);
  await p.esperarA(`document.querySelector(".avisos").textContent.includes("Guardado")`, 5000).catch(() => undefined);
  comprobar("después de Guardar, sin lista y sin menú", (await guardada()) === null && !(await hayMenu()), `${await guardada()} · ${await aviso()}`);

  // Abrir con el selector del navegador tampoco tiene ruta.
  const ruta = join(archivos, "Marcha.brn");
  writeFileSync(ruta, d?.bytes ?? Buffer.alloc(0));
  await p.interceptarSelector();
  await p.evaluar("bornera.editor.__anterior = true");
  p.elegirArchivo(ruta);
  await tecla(O, CTRL);
  await p.esperarA("bornera.editor.__anterior !== true", 5000);
  comprobar("Abrir cambia el documento", await p.evaluar("bornera.editor.__anterior !== true"));
  comprobar("después de Abrir, sin lista y sin menú", (await guardada()) === null && !(await hayMenu()), String(await guardada()));
}
