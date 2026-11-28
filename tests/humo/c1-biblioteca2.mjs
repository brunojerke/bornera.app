// C1 de la biblioteca 2: el circuito de la sección 0 (docs/plan-biblioteca2.md)
// desde su archivo congelado, en la app real a 1024×600.
//  1. biblioteca2.brn abre (Ctrl+O) con 11 componentes, sin errores ni avisos.
//  2. F5 entra a Simular sin detención ni avisos; en reposo K1, Y1 y M1
//     apagados y B1 alimentado. Un clic en B1 enciende K1, Y1 y M1, sin
//     avisos; B1 queda accionado e Y1 corrida (14).
//  3. Mantener B2 (presostato NC) apaga los tres; al soltarlo vuelven.
//  4. Otro clic en B1 apaga todo; F5 vuelve a Editar.
// Con `-- --capturas=CARPETA` guarda las capturas.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "C1: circuito de la biblioteca 2";

const O = ["o", "KeyO", 79];
const F5 = ["F5", "F5", 116];
const CIRCUITOS = resolve(dirname(fileURLToPath(import.meta.url)), "../circuitos");

const centrar = (p, zoom, gx, gy) =>
  p.evaluar(`(() => { const ed = bornera.activo(), cv = document.querySelector("canvas[aria-label^=Lienzo]");
    ed.vista.camara.zoom = ${zoom}; ed.vista.camara.centrar(${gx}, ${gy}, cv.clientWidth, cv.clientHeight); ed.vista.invalidar(); })()`);

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
  const modo = () => p.evaluar(`document.querySelector(".modo button.simular").getAttribute("aria-pressed") === "true" ? "simular" : "editar"`);
  const reposo = () =>
    p.evaluar(`new Promise((listo) => { let quietos = 0; const f = () => {
      quietos = bornera.activo().vista.enReposo ? quietos + 1 : 0;
      if (quietos >= 3) listo(true); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
  const idDe = (etiqueta, tipo) =>
    p.evaluar(`bornera.editor.documento.hojas[0].componentes.find((x) => x.etiqueta === ${JSON.stringify(etiqueta)} && x.tipo === ${JSON.stringify(tipo)})?.id ?? null`);
  /** Encendida alguna carga del componente en Simular. */
  const encendido = (id) =>
    p.evaluar(`(() => { const s = bornera.simulacion()?.sim; if (!s) return null;
      return s.netlist.cargas.some((k, i) => k.comp === "${id}" && s.encendidas[i]); })()`);
  /** Dibujado accionado en la escena (el contacto o la válvula corrida). */
  const accionado = (id) => p.evaluar(`bornera.editor.escena.obtener("${id}")?.accionado === true`);
  /** Posición de la electroválvula en Simular: true en 14. */
  const en14 = (id) =>
    p.evaluar(`(() => { const s = bornera.simulacion()?.sim; if (!s) return null; const i = s.netlist.valvulas.findIndex((v) => v.comp === "${id}"); return i < 0 ? null : s.posiciones[i]; })()`);
  const estadoSim = () =>
    p.evaluar(`(() => { const s = bornera.simulacion()?.sim; if (!s) return null; return JSON.stringify({ detenida: s.detenida, avisos: s.avisos.length, enCorto: s.netlist.enCorto.length }); })()`);
  const SANO = JSON.stringify({ detenida: null, avisos: 0, enCorto: 0 });
  /** Un punto de la página sobre el cuerpo de `id`. */
  const sobre = async (id) => {
    const g = await p.evaluar(`(() => { const ed = bornera.activo(); const c = ed.documento.hojas[0].componentes.find((x) => x.id === "${id}");
      for (let dy = -4; dy <= 4; dy += 0.25) for (let dx = -4; dx <= 4; dx += 0.25)
        if (ed.escena.componenteEnPunto(c.x + dx, c.y + dy, 0) === c.id) return { x: c.x + dx, y: c.y + dy };
      return null; })()`);
    if (!g) throw new Error(`No hay un punto sobre ${id}`);
    return p.punto(g.x, g.y);
  };
  const apretar = async (id) => {
    const q = await sobre(id);
    await p.mouse("mouseMoved", q.x, q.y);
    await p.mouse("mousePressed", q.x, q.y);
    await esperar(40);
    return q;
  };
  const largar = async (q) => {
    await p.mouse("mouseReleased", q.x, q.y);
    await esperar(40);
  };
  const clic = async (id) => largar(await apretar(id));
  const tres = async (ids) => [await encendido(ids.k1), await encendido(ids.y1), await encendido(ids.m1)];

  // ── 1. Abrir biblioteca2.brn ──
  await p.evaluar("bornera.editor.__anterior = true");
  p.elegirArchivo(resolve(CIRCUITOS, "biblioteca2.brn"));
  await tecla(O, CTRL);
  await p.esperarA("bornera.editor.__anterior !== true", 5000);
  await p.esperarA("!bornera.editor.avisos.enReposoR11", 5000);
  const cuenta = await p.evaluar("JSON.stringify([bornera.editor.documento.hojas[0].componentes.length, bornera.editor.avisos.cuenta])");
  comprobar("biblioteca2.brn: 11 componentes, sin errores ni avisos", cuenta === JSON.stringify([11, { errores: 0, avisos: 0 }]), cuenta);
  const ids = {};
  for (const [k, e, t] of [
    ["b1", "B1", "sensor.inductivo"],
    ["b2", "B2", "sensor.presostato_nc"],
    ["k1", "K1", "contactor.bobina"],
    ["y1", "Y1", "valvula.monoestable"],
    ["m1", "M1", "motor.continua"],
  ])
    ids[k] = await idDe(e, t);
  comprobar("están B1, B2, K1, Y1 y M1", Object.values(ids).every((x) => x !== null), JSON.stringify(ids));

  // ── 2. Simular: clic en B1 ──
  // Todo el circuito en pantalla (x de −2 a 30, y de −1 a 33).
  await centrar(p, 0.9, 14, 16);
  await tecla(F5);
  await esperar(80);
  await reposo();
  comprobar("F5 entra a Simular sin detención, avisos ni corto", (await modo()) === "simular" && (await estadoSim()) === SANO, await estadoSim());
  comprobar("en reposo K1, Y1 y M1 apagados; B1 alimentado", JSON.stringify(await tres(ids)) === "[false,false,false]" && (await encendido(ids.b1)));
  await p.captura("biblioteca2-reposo");
  await clic(ids.b1);
  await reposo();
  comprobar("un clic en B1 enciende K1, Y1 y M1", JSON.stringify(await tres(ids)) === "[true,true,true]", JSON.stringify(await tres(ids)));
  comprobar("B1 queda accionado e Y1 corrida (14)", (await accionado(ids.b1)) && (await accionado(ids.y1)) && (await en14(ids.y1)) === true);
  comprobar("sin detención, avisos ni corto", (await estadoSim()) === SANO, await estadoSim());
  await p.captura("biblioteca2-b1");

  // ── 3. Mantener B2 ──
  const q = await apretar(ids.b2);
  await reposo();
  comprobar("mantener B2 (presostato NC) apaga K1, Y1 y M1", JSON.stringify(await tres(ids)) === "[false,false,false]", JSON.stringify(await tres(ids)));
  await p.captura("biblioteca2-b2");
  await largar(q);
  await reposo();
  comprobar("al soltar B2 vuelven K1, Y1 y M1, sin avisos", JSON.stringify(await tres(ids)) === "[true,true,true]" && (await estadoSim()) === SANO, `${JSON.stringify(await tres(ids))} ${await estadoSim()}`);

  // ── 4. Otro clic en B1 ──
  await clic(ids.b1);
  await reposo();
  comprobar("otro clic en B1 apaga todo; Y1 vuelve a 12", JSON.stringify(await tres(ids)) === "[false,false,false]" && !(await accionado(ids.b1)) && (await en14(ids.y1)) === false);
  await tecla(F5);
  await esperar(80);
  comprobar("F5 vuelve a Editar", (await modo()) === "editar");
}
