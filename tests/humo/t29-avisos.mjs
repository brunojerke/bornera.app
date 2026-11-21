// T29: avisos R10 (Fase L junto con L1, L2 o L3) y R11 (conexiones aparentes
// en la hoja), a 1024×600. Sobre tests/humo/datos/t29-aparentes.brn: 60
// lámparas, cada una con un cable suelto que pasa sobre su X1 (120 avisos
// R11), y una Fase «L» con otra «l1» (R10 en la «L»).
//  1. Abrir: R11 de la hoja entera va en reposo (D6-A) y aparece al terminar.
//  2. Borrar un cable (en vivo, un elemento): su lámpara deja de avisar;
//     Ctrl+Z lo vuelve a mostrar y Ctrl+Y lo vuelve a sacar.
//  3. Copiar todo (122 elementos) y pegarlo con Ctrl+V: más de 100, en reposo
//     por tramos; se espera a que aparezcan los avisos de la copia.
//  4. F5 entra a Simular con estos avisos (no son errores, D4).

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Avisos R10 y R11";

const O = ["o", "KeyO", 79];
const C = ["c", "KeyC", 67];
const V = ["v", "KeyV", 86];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];
const SUPR = ["Delete", "Delete", 46];
const F5 = ["F5", "F5", 116];
const ARCHIVO = resolve(dirname(fileURLToPath(import.meta.url)), "datos/t29-aparentes.brn");

export default async function (p, comprobar) {
  await p.interceptarSelector();
  try {
    await probar(p, comprobar);
  } finally {
    await p.interceptarSelector(false).catch(() => undefined);
  }
}

async function probar(p, comprobar) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods);
  const hoja = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento.hojas[0]))");
  const r11 = () => p.evaluar(`bornera.editor.avisos.lista().filter((a) => a.regla === "R11").length`);
  const reglasDe = (id) => p.evaluar(`bornera.editor.avisos.de(${JSON.stringify(id)}).map((a) => a.regla)`);
  const enReposo = () => p.evaluar("bornera.editor.avisos.enReposoR11");
  const cuentaCoincide = () => p.evaluar("bornera.editor.avisos.cuenta.avisos === bornera.editor.avisos.lista().filter((a) => a.severidad === 'aviso').length");
  const modo = () => p.evaluar(`document.querySelector(".modo button.simular").getAttribute("aria-pressed") === "true" ? "simular" : "editar"`);
  const a = async (gx, gy) => {
    const q = await p.punto(gx, gy);
    await p.mouse("mouseMoved", q.x, q.y);
    await esperar(30);
  };

  // ── 1. Abrir ──
  await p.evaluar("bornera.editor.__anterior = true");
  p.elegirArchivo(ARCHIVO);
  await tecla(O, CTRL);
  await p.esperarA("bornera.editor.__anterior !== true", 5000);
  await p.esperarA("!bornera.editor.avisos.enReposoR11", 5000);
  const abierta = await hoja();
  const lampara = abierta.componentes.find((c) => c.tipo === "senalizacion.lampara" && c.x === 0 && c.y === 0);
  const cable = abierta.cables.find((w) => w.desde.tipo === "libre" && w.desde.x === -2 && w.desde.y === -2);
  const faseL = abierta.componentes.find((c) => c.tipo === "fuente.fase" && c.etiqueta === "L");
  const faseL1 = abierta.componentes.find((c) => c.tipo === "fuente.fase" && c.etiqueta === "l1");
  if (!lampara || !cable || !faseL || !faseL1) throw new Error("t29-aparentes.brn no es el de este humo.");
  comprobar("1. abrir: 62 componentes y 60 cables", abierta.componentes.length === 62 && abierta.cables.length === 60);
  comprobar("1. R11 de la hoja entera aparece al terminar el cálculo en reposo: 120 avisos (lámpara y cable de cada par)", (await r11()) === 120, String(await r11()));
  const deLampara = await reglasDe(lampara.id);
  comprobar("1. la lámpara (0, 0) avisa R11", deLampara.includes("R11"), JSON.stringify(deLampara));
  const deFase = await reglasDe(faseL.id);
  comprobar("1. R10 en la Fase «L» (hay una Fase «l1»), y no en la «l1»", deFase.includes("R10") && !(await reglasDe(faseL1.id)).includes("R10"), JSON.stringify(deFase));
  comprobar("1. la Fase «L» lleva contorno de aviso", await p.evaluar(`bornera.editor.escena.obtener(${JSON.stringify(faseL.id)})?.conAviso === true`));
  comprobar("1. la cuenta de la barra sigue a los avisos", await cuentaCoincide());
  await p.captura("abierta");

  // ── 2. Borrar un cable, deshacer y rehacer ──
  await p.evaluar(`bornera.editor.seleccionarIds([${JSON.stringify(cable.id)}])`);
  await tecla(SUPR);
  await esperar(60);
  comprobar("2. Supr (un elemento, en vivo): la lámpara deja de avisar R11, 118 en total", !(await reglasDe(lampara.id)).includes("R11") && (await r11()) === 118, String(await r11()));
  await tecla(Z, CTRL);
  await esperar(60);
  comprobar("2. Ctrl+Z: el aviso R11 de la lámpara vuelve, 120 en total", (await reglasDe(lampara.id)).includes("R11") && (await r11()) === 120, String(await r11()));
  await tecla(Y, CTRL);
  await esperar(60);
  comprobar("2. Ctrl+Y: lo vuelve a sacar", !(await reglasDe(lampara.id)).includes("R11") && (await r11()) === 118, String(await r11()));
  await tecla(Z, CTRL);
  await esperar(60);
  comprobar("2. Ctrl+Z otra vez: 120", (await r11()) === 120 && (await cuentaCoincide()));

  // ── 3. Copiar todo y pegar con Ctrl+V debajo (122 elementos, más de 100) ──
  const todos = [...abierta.componentes.map((c) => c.id), ...abierta.cables.map((w) => w.id)];
  await p.evaluar(`bornera.editor.seleccionarIds(${JSON.stringify(todos)})`);
  await tecla(C, CTRL);
  await p.evaluar(`(() => { const cv = document.querySelector("canvas"); const v = bornera.editor.vista;
    v.camara.zoom = 0.2; v.camara.centrar(22, 50, cv.clientWidth, cv.clientHeight); v.invalidarContenido(); })()`);
  await esperar(60);
  await a(22, 80);
  await tecla(V, CTRL);
  await a(22, 81);
  await a(22, 80);
  const pv = await p.evaluar(`(() => { const h = bornera.editor.pegando; const v = h?.previa; return v ? { conflictos: v.conflictos.length } : null; })()`);
  comprobar("3. Ctrl+V abre la previa debajo, sin conflictos", pv?.conflictos === 0, JSON.stringify(pv));
  const tramos = await p.evaluar("bornera.editor.avisos.tramosR11");
  await p.clic(await p.punto(22, 80));
  await esperar(30);
  const pegada = await hoja();
  comprobar("3. el clic pega los 122 elementos", pegada.componentes.length === 124 && pegada.cables.length === 120, `${pegada.componentes.length} + ${pegada.cables.length}`);
  await p.esperarA(`bornera.editor.avisos.lista().filter((a) => a.regla === "R11").length === 240`, 5000);
  comprobar("3. los avisos de la copia aparecen al terminar: 240 R11", (await r11()) === 240 && !(await enReposo()), String(await r11()));
  comprobar("3. fue en reposo, por tramos (más de 100 elementos)", (await p.evaluar("bornera.editor.avisos.tramosR11")) > tramos);
  comprobar("3. R10 también en la «L» copiada", (await p.evaluar(`bornera.editor.avisos.lista().filter((a) => a.regla === "R10").length`)) === 2);
  comprobar("3. la cuenta de la barra sigue a los avisos", await cuentaCoincide());
  await p.captura("pegada");

  // ── 4. F5 entra a Simular con avisos ──
  await tecla(F5);
  await esperar(60);
  comprobar("4. F5 entra a Simular con R10 y R11 (son avisos, D4)", (await modo()) === "simular");
  await tecla(F5);
  await esperar(60);
  comprobar("4. F5 vuelve a Editar", (await modo()) === "editar");
}
