// T32: modo Simular en la app real a 1024×600 (docs/plan-T32.md).
//  1. marcha-parada.brn: F5 entra; mantener S1 arranca K1 y H1 y siguen al
//     soltar (afuera del pulsador); S0 los apaga. Mayús+clic fija («Fijados»
//     en la barra) hasta otro clic. Con S1 mantenido, F5 sale igual (ajuste 4).
//  2. Bloqueos en Simular: Guardar, Guardar como, Abrir y Nuevo (botones y
//     Ctrl+S, ajuste 3), Ctrl+Mayús+B y «Probar la fase N»; Exportar sigue.
//  3. Abrir, entrar, pulsar, soltar y salir deja el archivo byte a byte igual
//     (Ctrl+S después de salir) y sin «•».
//  4. inversion.brn enclavada; oscilante.brn y corto.brn avisan y se detienen.
//  5. Con una bobina repetida (R4), F5 avisa y queda en Editar (D4-A).

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CTRL, esperar, MAYUS } from "./cdp.mjs";

export const nombre = "Modo Simular";

const O = ["o", "KeyO", 79];
const S = ["s", "KeyS", 83];
const B = ["B", "KeyB", 66];
const Z = ["z", "KeyZ", 90];
const F5 = ["F5", "F5", 116];
const CIRCUITOS = resolve(dirname(fileURLToPath(import.meta.url)), "../circuitos");

export default async function (p, comprobar) {
  const carpeta = mkdtempSync(join(tmpdir(), "bornera-t32-"));
  await p.interceptarSelector();
  await p.descargasEn(carpeta);
  try {
    await probar(p, comprobar, carpeta);
  } finally {
    await p.interceptarSelector(false).catch(() => undefined);
    await p.descargasEn(null).catch(() => undefined);
    rmSync(carpeta, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

async function probar(p, comprobar, carpeta) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods);
  const modo = () => p.evaluar(`document.querySelector(".modo button.simular").getAttribute("aria-pressed") === "true" ? "simular" : "editar"`);
  const titulo = () => p.evaluar("document.title");
  const aviso = () => p.evaluar(`document.querySelector(".avisos").textContent.trim()`);
  const estado = () => p.evaluar(`document.querySelector(".pista-herramienta")?.textContent.trim() ?? ""`);
  const activado = (etiqueta) => p.evaluar(`!document.querySelector('button[aria-label="${etiqueta}"]').disabled`);
  const conTension = () =>
    p.evaluar(`(() => { const s = bornera.simulacion(); if (!s) return null;
      return JSON.stringify(s.sim.netlist.bobinas.filter((_, g) => s.sim.tension[g]).map((b) => b.etiqueta)); })()`);
  const prendida = (etiqueta) =>
    p.evaluar(`(() => { const s = bornera.simulacion(); const h = bornera.editor.documento.hojas[0];
      const c = h.componentes.find((x) => x.etiqueta === ${JSON.stringify(etiqueta)} && x.tipo === "senalizacion.lampara");
      return s.sim.encendidas[s.sim.netlist.cargas.findIndex((k) => k.comp === c.id)]; })()`);
  /** Un punto de la página sobre el cuerpo del componente de esa etiqueta y ese tipo. */
  const sobre = async (etiqueta, tipo) => {
    const g = await p.evaluar(`(() => { const ed = bornera.activo(); const h = ed.documento.hojas[0];
      const c = h.componentes.find((x) => x.etiqueta === ${JSON.stringify(etiqueta)} && x.tipo === ${JSON.stringify(tipo)});
      for (let dy = -4; dy <= 4; dy += 0.25) for (let dx = -4; dx <= 4; dx += 0.25)
        if (ed.escena.componenteEnPunto(c.x + dx, c.y + dy, 0) === c.id) return { x: c.x + dx, y: c.y + dy };
      return null; })()`);
    if (!g) throw new Error(`No hay un punto sobre ${etiqueta}`);
    return p.punto(g.x, g.y);
  };
  const apretar = async (q, mods = 0) => {
    await p.mouse("mouseMoved", q.x, q.y, { mods });
    await p.mouse("mousePressed", q.x, q.y, { mods });
    await esperar(30);
  };
  const soltarEn = async (q, mods = 0) => {
    await p.mouse("mouseMoved", q.x, q.y, { mods, botones: 1 });
    await p.mouse("mouseReleased", q.x, q.y, { mods });
    await esperar(30);
  };
  const pulsarYSoltar = async (etiqueta, tipo, mods = 0) => {
    const q = await sobre(etiqueta, tipo);
    await apretar(q, mods);
    await soltarEn(q, mods);
  };
  const abrir = async (archivo) => {
    await p.evaluar("bornera.editor.__anterior = true");
    p.elegirArchivo(resolve(CIRCUITOS, archivo));
    await tecla(O, CTRL);
    await p.esperarA("bornera.editor.__anterior !== true", 5000);
    await p.esperarA("!bornera.editor.avisos.enReposoR11", 5000);
  };
  const terminados = () => readdirSync(carpeta).filter((f) => !f.endsWith(".crdownload") && !f.endsWith(".tmp"));
  const descarga = async (ms = 8000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const listos = terminados();
      if (listos.length > 0 && listos.length === readdirSync(carpeta).length) {
        await esperar(100);
        const bytes = readFileSync(join(carpeta, listos[0]));
        for (const f of readdirSync(carpeta)) rmSync(join(carpeta, f), { force: true });
        return { nombre: listos[0], bytes };
      }
      await esperar(100);
    }
    return null;
  };

  // ── 1. marcha-parada.brn ──
  await abrir("marcha-parada.brn");
  await tecla(F5);
  await esperar(80);
  comprobar("marcha-parada: F5 entra a Simular con la sesión", (await modo()) === "simular" && (await p.evaluar("bornera.simulacion() !== null")));
  comprobar("en reposo, nada con tensión", (await conTension()) === "[]", await conTension());
  const s1 = await sobre("S1", "pulsador.na");
  await apretar(s1);
  comprobar("mantener S1: entran K1 y H1", (await conTension()) === '["K1"]' && (await prendida("H1")), await conTension());
  await soltarEn({ x: s1.x + 120, y: s1.y + 60 });
  comprobar("soltar el botón afuera de S1: K1 y H1 siguen (autorretención)", (await conTension()) === '["K1"]' && (await prendida("H1")));
  comprobar("y S1 ya no está apretado", (await p.evaluar("bornera.simulacion().sim.pulsados.size")) === 0);
  await pulsarYSoltar("S0", "pulsador.nc");
  comprobar("S0: K1 y H1 se apagan y siguen así", (await conTension()) === "[]" && !(await prendida("H1")));
  comprobar("el documento no cambió: sin «•»", !(await titulo()).includes("•"), await titulo());

  await pulsarYSoltar("S0", "pulsador.nc", MAYUS);
  comprobar("Mayús+clic fija S0: la barra dice «Fijados: S0»", (await estado()) === "Fijados: S0", await estado());
  await pulsarYSoltar("S1", "pulsador.na");
  comprobar("con S0 fijado, S1 no arranca", (await conTension()) === "[]");
  await pulsarYSoltar("S0", "pulsador.nc");
  comprobar("otro clic suelta S0 y la barra ya no lo dice", (await estado()) === "" && (await p.evaluar("bornera.simulacion().fijados.length")) === 0, await estado());
  comprobar("el cursor es la mano sobre un pulsador", (await p.evaluar(`document.querySelector("canvas").parentElement.style.cursor`)) === "pointer");

  // ── 2. Bloqueos en Simular ──
  comprobar("Guardar, Guardar como, Abrir y Nuevo desactivados; Exportar activo", !(await activado("Guardar")) && !(await activado("Guardar como")) && !(await activado("Abrir")) && !(await activado("Nuevo")) && (await activado("Exportar sin comprimir (.brn.json)")));
  await tecla(S, CTRL);
  await esperar(800);
  comprobar("Ctrl+S en Simular no guarda", readdirSync(carpeta).length === 0, readdirSync(carpeta).join(", "));
  await tecla(B, CTRL | MAYUS);
  await esperar(80);
  comprobar("Ctrl+Mayús+B en Simular no cambia de escena", await p.evaluar("bornera.activo() === bornera.editor"));
  const menu = await p.caja('button[aria-label="Menú de desarrollo"]');
  if (menu) {
    await p.clic({ x: menu.cx, y: menu.cy });
    const desactivados = await p.evaluar(`[...document.querySelectorAll('[role="menu"] button')].filter((b) => /Probar la fase|Prueba automática|Banco:/.test(b.textContent)).every((b) => b.disabled)`);
    comprobar("en el menú de desarrollo, las pruebas y las escenas están desactivadas", desactivados);
    await p.clic({ x: menu.cx, y: menu.cy });
  }

  // Ajuste 4: con S1 mantenido, F5 sale igual y el estado se descarta.
  await apretar(await sobre("S1", "pulsador.na"));
  comprobar("con S1 mantenido, K1 entró", (await conTension()) === '["K1"]');
  await tecla(F5);
  await esperar(80);
  comprobar("F5 con S1 mantenido vuelve a Editar y descarta la sesión", (await modo()) === "editar" && (await p.evaluar("bornera.simulacion() === null")));
  await soltarEn(s1);
  comprobar("el soltar que llega después no selecciona ni cambia nada", !(await titulo()).includes("•"), await titulo());

  // ── 3. Byte a byte igual ──
  await tecla(S, CTRL);
  const d = await descarga();
  const original = readFileSync(resolve(CIRCUITOS, "marcha-parada.brn"));
  comprobar("Ctrl+S después de salir guarda marcha-parada.brn byte a byte igual", d?.nombre === "marcha-parada.brn" && d.bytes.equals(original), d ? `${d.nombre}, ${d.bytes.length} bytes (original ${original.length})` : "sin descarga");
  comprobar("y sin «•»", !(await titulo()).includes("•"), await titulo());
  await p.captura("marcha-parada");

  // ── 4. inversion.brn, oscilante.brn y corto.brn ──
  await abrir("inversion.brn");
  await tecla(F5);
  await esperar(80);
  await pulsarYSoltar("S1", "pulsador.na");
  await pulsarYSoltar("S2", "pulsador.na");
  comprobar("inversión: K1 entra y, con K1, K2 no", (await conTension()) === '["K1"]', await conTension());
  await pulsarYSoltar("S0", "pulsador.nc");
  await pulsarYSoltar("S2", "pulsador.na");
  comprobar("inversión: S0 apaga y con S2 entra K2 y K1 no", (await conTension()) === '["K2"]', await conTension());
  await tecla(F5);
  await esperar(80);

  await abrir("oscilante.brn");
  await tecla(F5);
  await esperar(80);
  comprobar("oscilante: entra, avisa «Oscila: K1» y se detiene", (await modo()) === "simular" && (await aviso()) === "Oscila: K1" && (await p.evaluar("bornera.simulacion().detenida")), await aviso());
  comprobar("oscilante: la barra dice que está detenida", (await estado()) === "Simulación detenida: Oscila: K1 · F5 vuelve a Editar", await estado());
  await tecla(F5);
  await esperar(80);
  comprobar("oscilante: F5 sale", (await modo()) === "editar");

  await abrir("corto.brn");
  await tecla(F5);
  await esperar(80);
  await pulsarYSoltar("S1", "pulsador.na");
  comprobar("corto: al pulsar S1, «Cortocircuito entre L y N» y se detiene", (await aviso()) === "Cortocircuito entre L y N" && (await p.evaluar("bornera.simulacion().detenida")), await aviso());
  await pulsarYSoltar("S1", "pulsador.na", MAYUS);
  comprobar("corto: detenida, los pulsadores no responden", (await p.evaluar("bornera.simulacion().fijados.length")) === 0);
  await tecla(F5);
  await esperar(80);
  comprobar("corto: F5 sale, sin «•»", (await modo()) === "editar" && !(await titulo()).includes("•"), await titulo());
  await p.captura("corto");

  // ── 5. R4 impide entrar ──
  await p.evaluar(`(() => { const { editor: ed, comandos: c } = bornera;
    ed.ejecutar(c.colocar(ed.documento, { tipo: "contactor.bobina", x: 60, y: 60, rot: 0, espejado: false, etiqueta: "K9", params: {} }));
    ed.ejecutar(c.colocar(ed.documento, { tipo: "contactor.bobina", x: 70, y: 60, rot: 0, espejado: false, etiqueta: "K9", params: {} })); })()`);
  await tecla(F5);
  await esperar(80);
  comprobar("con K9 repetida, F5 avisa y queda en Editar (D4-A)", (await modo()) === "editar" && (await aviso()) === "No se puede simular: K9 está repetida", await aviso());
  await tecla(Z, CTRL);
  await tecla(Z, CTRL);
  await tecla(F5);
  await esperar(80);
  comprobar("deshecho, F5 entra", (await modo()) === "simular");
  await tecla(F5);
  await esperar(80);
}
