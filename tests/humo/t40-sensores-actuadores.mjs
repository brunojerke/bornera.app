// T40: sensores, presostato, termostato, electroválvulas, motor de continua y
// diferencial 3P en la app real a 1024×600 (docs/plan-T40.md).
//  1. Paleta: los 11 nuevos en Mando › Sensores, Mando › Actuadores,
//     Potencia › Cargas y Potencia › Protección. Arrastrar cada uno al lienzo:
//     entran Q1, B1 a B7, Y1, Y2 y M1, sin avisos de etiqueta. Una captura de
//     cada uno; al final, la hoja se vacía.
//  2. El circuito de la sección 0 del plan: T1 (L1-N) da 24 V a B1 (PNP) →
//     B2 (presostato NC) → K1; un NA de K1 a Y1 (monoestable) y otro de G1 a
//     M1 (continua). Un clic en B1 enciende K1, Y1 y M1 sin avisos, y B1 e Y1
//     se dibujan accionados; otro clic los apaga.
//  3. Biestable Y1: un clic en S1 (a A1) la deja en 14 al soltar; uno en S2 (a
//     B1), en 12. Con el selector S3 (a B1, en paralelo con S2) accionado,
//     apretar S1 avisa «Y1 con las dos bobinas» y la deja en 12.
//  4. Dos Y1: F5 avisa que Y1 está repetida y queda en Editar (R4).
// Con `-- --capturas=CARPETA` guarda las capturas.

import { esperar } from "./cdp.mjs";

export const nombre = "T40: sensores y actuadores";

const F5 = ["F5", "F5", 116];
const Z = ["z", "KeyZ", 90];
const CTRL = 2;

/** Los 11 de T40: texto en la paleta, tipo, lugar y la etiqueta con que entran. */
const NUEVOS = [
  ["Diferencial tripolar", "proteccion.diferencial_tripolar", "Potencia › Protección", "Q1"],
  ["Sensor inductivo PNP", "sensor.inductivo", "Mando › Sensores", "B1"],
  ["Sensor capacitivo PNP", "sensor.capacitivo", "Mando › Sensores", "B2"],
  ["Sensor fotoeléctrico PNP", "sensor.fotoelectrico", "Mando › Sensores", "B3"],
  ["Presostato NA", "sensor.presostato_na", "Mando › Sensores", "B4"],
  ["Presostato NC", "sensor.presostato_nc", "Mando › Sensores", "B5"],
  ["Termostato NA", "sensor.termostato_na", "Mando › Sensores", "B6"],
  ["Termostato NC", "sensor.termostato_nc", "Mando › Sensores", "B7"],
  ["Electroválvula monoestable", "valvula.monoestable", "Mando › Actuadores", "Y1"],
  ["Electroválvula biestable", "valvula.biestable", "Mando › Actuadores", "Y2"],
  ["Motor de continua", "motor.continua", "Potencia › Cargas", "M1"],
];

const ETIQUETA = ["R1", "R2", "R3", "R4", "R5", "R9"];

/** El ítem de la paleta con ese texto, desplazado a la vista: centro y su lugar («Grupo › Subgrupo»). */
const item = (p, texto) =>
  p.evaluar(`(() => { const e = [...document.querySelectorAll(".item")].find((x) => x.textContent.trim() === ${JSON.stringify(texto)});
    if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect();
    const g = []; for (let d = e.closest("details"); d; d = d.parentElement?.closest("details")) g.unshift(d.querySelector(":scope > summary")?.textContent.trim() ?? "");
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, grupo: g.join(" › ") }; })()`);

const centrar = (p, zoom, gx, gy) =>
  p.evaluar(`(() => { const ed = bornera.activo(), cv = document.querySelector("canvas[aria-label^=Lienzo]");
    ed.vista.camara.zoom = ${zoom}; ed.vista.camara.centrar(${gx}, ${gy}, cv.clientWidth, cv.clientHeight); ed.vista.invalidar(); })()`);

/**
 * Arma un circuito con los comandos de la app: `poner(tipo, x, y, etiqueta)` y `tender(a, z)` con
 * [comp, borne]; el cable va en L (un codo) si los bornes no están alineados. Devuelve los ids.
 */
const armar = (p, cuerpo) =>
  p.evaluar(`(async () => { const { editor: ed, comandos: c } = bornera; const { buscarSimbolo } = await import("/src/core/symbols/index.ts");
    const poner = (tipo, x, y, etiqueta) => { const k = c.colocar(ed.documento, { tipo, x, y, rot: 0, espejado: false, etiqueta, params: {} }); ed.ejecutar(k); return k.id; };
    const b = ([comp, borne]) => ({ tipo: "borne", comp, borne });
    const punto = ([comp, borne]) => { const k = ed.documento.hojas[0].componentes.find((x) => x.id === comp); const d = buscarSimbolo(k.tipo).bornes.find((x) => x.nombre === borne); return [k.x + d.x, k.y + d.y]; };
    const tender = (a, z) => { const [ax, ay] = punto(a); const [zx, zy] = punto(z);
      ed.ejecutar(c.cablear(ed.documento, { desde: b(a), hasta: b(z), codos: ax === zx || ay === zy ? [] : [[ax, zy]] })); };
    ${cuerpo} })()`);

export default async function (p, comprobar) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods);
  const modo = () => p.evaluar(`document.querySelector(".modo button.simular").getAttribute("aria-pressed") === "true" ? "simular" : "editar"`);
  const aviso = () => p.evaluar(`document.querySelector(".avisos").textContent.trim()`);
  const reposo = () =>
    p.evaluar(`new Promise((listo) => { let quietos = 0; const f = () => {
      quietos = bornera.activo().vista.enReposo ? quietos + 1 : 0;
      if (quietos >= 3) listo(true); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
  const vaciar = () =>
    p.evaluar(`(async () => { const { Borrar } = await import("/src/core/model/comandos.ts"); const h = bornera.editor.documento.hojas[0];
      bornera.editor.ejecutar(new Borrar([...h.componentes.map((c) => c.id), ...h.cables.map((w) => w.id)])); })()`);
  const contar = () => p.evaluar("bornera.editor.documento.hojas[0].componentes.length");
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
    p.evaluar(`(() => { const s = bornera.simulacion()?.sim; if (!s) return null; return { detenida: s.detenida, avisos: s.avisos.length, enCorto: s.netlist.enCorto.length }; })()`);
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

  // ── 1. Los 11 desde la paleta ──
  for (const [i, [texto, tipo, lugar, etiqueta]] of NUEVOS.entries()) {
    const gx = 10 * i;
    await centrar(p, 1, gx, 0);
    await esperar(30);
    const it = await item(p, texto);
    comprobar(`la paleta tiene «${texto}» en ${lugar}`, it !== null && it.grupo === lugar, JSON.stringify(it));
    if (!it) continue;
    await p.arrastrar(it, await p.punto(gx, 0));
    await esperar(60);
    const c = await p.evaluar(`(() => { const c = bornera.editor.documento.hojas[0].componentes.find((x) => x.tipo === "${tipo}"); return c ? { id: c.id, x: c.x, y: c.y, etiqueta: c.etiqueta } : null; })()`);
    comprobar(`«${texto}» entra como ${etiqueta}`, c !== null && c.etiqueta === etiqueta, JSON.stringify(c));
    if (!c) continue;
    const avisos = await p.evaluar(`bornera.editor.avisos.de("${c.id}").map((a) => a.regla)`);
    comprobar(`${etiqueta} sin avisos de etiqueta`, !avisos.some((r) => ETIQUETA.includes(r)), avisos.join(", "));
    await p.evaluar(`bornera.editor.seleccionarIds([])`);
    await centrar(p, 3, c.x, c.y);
    await reposo();
    await p.captura(tipo);
  }
  comprobar("quedan los 11 en la hoja", (await contar()) === 11);
  await vaciar();
  comprobar("la hoja queda vacía", (await contar()) === 0);

  // ── 2. El circuito de la sección 0 ──
  const ids = await armar(
    p,
    `const l = poner("fuente.fase", -2, -14, "L1"); const n = poner("fuente.neutro", 2, -14, "N");
    const t = poner("transformador.monofasico", 0, -9, "T1");
    const b1 = poner("sensor.inductivo", -8, -2, "B1"); const b2 = poner("sensor.presostato_nc", -7, 4, "B2");
    const k = poner("contactor.bobina", -7, 10, "K1"); const ka = poner("contactor.auxiliar_na", 0, 2, "K1");
    const y = poner("valvula.monoestable", 3, 9, "Y1");
    const g = poner("fuente.continua", 12, -2, "G1"); const kb = poner("contactor.auxiliar_na", 11, 4, "K1"); const m = poner("motor.continua", 13, 10, "M1");
    tender([l, "L"], [t, "1U1"]); tender([n, "N"], [t, "1U2"]);
    tender([t, "2U1"], [b1, "BN"]); tender([t, "2U1"], [ka, "13"]);
    tender([t, "2U2"], [b1, "BU"]); tender([b1, "BU"], [k, "A2"]); tender([k, "A2"], [y, "A2"]);
    tender([b1, "BK"], [b2, "11"]); tender([b2, "12"], [k, "A1"]);
    tender([ka, "14"], [y, "A1"]);
    tender([g, "L+"], [kb, "13"]); tender([kb, "14"], [m, "A1"]); tender([m, "A2"], [g, "M"]);
    return { b1, b2, k, y, m };`,
  );
  await centrar(p, 1.6, 2, -2);
  await reposo();
  await tecla(F5);
  await esperar(80);
  await reposo();
  comprobar("F5 entra a Simular con el circuito de la prueba", (await modo()) === "simular", await aviso());
  comprobar("en reposo K1, Y1 y M1 apagados; B1 alimentado", !(await encendido(ids.k)) && !(await encendido(ids.y)) && !(await encendido(ids.m)) && (await encendido(ids.b1)));
  await clic(ids.b1);
  await reposo();
  comprobar("un clic en B1 enciende K1, Y1 y M1", (await encendido(ids.k)) && (await encendido(ids.y)) && (await encendido(ids.m)));
  comprobar("B1 queda accionado (enclavado) e Y1 se dibuja con la válvula corrida", (await accionado(ids.b1)) && (await accionado(ids.y)) && (await en14(ids.y)) === true);
  comprobar("sin detención, avisos ni corto", JSON.stringify(await estadoSim()) === JSON.stringify({ detenida: null, avisos: 0, enCorto: 0 }), JSON.stringify(await estadoSim()));
  await p.captura("simular-prueba");
  await clic(ids.b1);
  await reposo();
  comprobar("otro clic en B1 apaga K1, Y1 y M1", !(await encendido(ids.k)) && !(await encendido(ids.y)) && !(await encendido(ids.m)) && !(await accionado(ids.y)));
  await tecla(F5);
  await esperar(80);
  comprobar("F5 vuelve a Editar", (await modo()) === "editar");
  await vaciar();

  // ── 3. Biestable ──
  const bi = await armar(
    p,
    `const l = poner("fuente.fase", 0, -10, "L1"); const n = poner("fuente.neutro", 4, 10, "N");
    const s1 = poner("pulsador.na", -6, -4, "S1"); const s2 = poner("pulsador.na", 0, -4, "S2"); const s3 = poner("mando.selector", 6, -4, "S3");
    const y = poner("valvula.biestable", 0, 4, "Y1");
    for (const s of [s1, s2, s3]) tender([l, "L"], [s, "13"]);
    tender([s1, "14"], [y, "A1"]); tender([s2, "14"], [y, "B1"]); tender([s3, "14"], [y, "B1"]);
    tender([y, "A2"], [n, "N"]); tender([y, "B2"], [n, "N"]);
    return { s1, s2, s3, y };`,
  );
  await centrar(p, 2, 0, 0);
  await reposo();
  await tecla(F5);
  await esperar(80);
  await reposo();
  comprobar("F5 entra a Simular con la biestable, en 12", (await modo()) === "simular" && (await en14(bi.y)) === false && !(await accionado(bi.y)));
  await clic(bi.s1);
  await reposo();
  comprobar("un clic en S1 (A1-A2) la deja en 14 al soltar", (await en14(bi.y)) === true && (await accionado(bi.y)));
  await p.captura("biestable-14");
  await clic(bi.s2);
  await reposo();
  comprobar("un clic en S2 (B1-B2) la vuelve a 12", (await en14(bi.y)) === false && !(await accionado(bi.y)));
  await clic(bi.s3);
  await reposo();
  comprobar("con el selector S3 accionado (B1-B2 con tensión) sigue en 12", (await en14(bi.y)) === false);
  const q = await apretar(bi.s1);
  await reposo();
  comprobar("apretando S1 con S3 accionado (las dos bobinas) avisa y queda en 12", (await aviso()).includes("Y1 con las dos bobinas") && (await en14(bi.y)) === false, await aviso());
  await p.captura("biestable-dos-bobinas");
  await largar(q);
  await clic(bi.s3);
  await tecla(F5);
  await esperar(80);
  await vaciar();

  // ── 4. Dos Y1: R4 impide entrar ──
  await armar(p, `poner("valvula.biestable", 0, 0, "Y1"); return poner("valvula.monoestable", 12, 0, "Y1");`);
  await tecla(F5);
  await esperar(80);
  comprobar("con dos Y1, F5 avisa y queda en Editar (R4)", (await modo()) === "editar" && (await aviso()) === "No se puede simular: Y1 está repetida", await aviso());
  await tecla(Z, CTRL);
  await tecla(F5);
  await esperar(80);
  comprobar("deshecha la segunda, F5 entra", (await modo()) === "simular");
  await tecla(F5);
  await esperar(80);
  await vaciar();
}
