// T39: fuentes propias (G) y trafos (T) en la app real a 1024×600
// (docs/plan-T39.md).
//  1. Paleta: los 6 nuevos, las G en Mando › Alimentación y las T en
//     Potencia › Transformación. Arrastrar cada uno al lienzo: entran G1, G2,
//     G3, T1, T2 y T3 (prefijo, D-B7), sin avisos de etiqueta. Una captura
//     de cada uno; al final, la hoja se vacía.
//  2. Simular (F5) con G1: H1 entre L+ y M enciende, sin red ni avisos.
//  3. Simular con T1: primario en L y N, H1 en 2U1-2U2: H1 y la entrada de
//     T1 encienden, sin corto.
//  4. Dos G1: F5 avisa que G1 está repetida y queda en Editar (R4).
// Con `-- --capturas=CARPETA` guarda las capturas.

import { esperar } from "./cdp.mjs";

export const nombre = "T39: fuentes propias y trafos";

const F5 = ["F5", "F5", 116];
const Z = ["z", "KeyZ", 90];
const CTRL = 2;

/** Los 6 de T39: texto en la paleta, tipo, lugar y la etiqueta con que entran. */
const NUEVOS = [
  ["Fuente de continua 12/24 V", "fuente.continua", "Mando › Alimentación", "G1"],
  ["Fuente variable", "fuente.variable", "Mando › Alimentación", "G2"],
  ["Fuente conmutada (riel)", "fuente.conmutada", "Mando › Alimentación", "G3"],
  ["Transformador monofásico", "transformador.monofasico", "Potencia › Transformación", "T1"],
  ["Transformador trifásico", "transformador.trifasico", "Potencia › Transformación", "T2"],
  ["Variac", "transformador.variac", "Potencia › Transformación", "T3"],
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

/** Arma un circuito con los comandos de la app: `poner(tipo, x, y, etiqueta)` y `tender(a, z, codos)` con [comp, borne]. Devuelve los ids. */
const armar = (p, cuerpo) =>
  p.evaluar(`(() => { const { editor: ed, comandos: c } = bornera;
    const poner = (tipo, x, y, etiqueta) => { const k = c.colocar(ed.documento, { tipo, x, y, rot: 0, espejado: false, etiqueta, params: {} }); ed.ejecutar(k); return k.id; };
    const b = ([comp, borne]) => ({ tipo: "borne", comp, borne });
    const tender = (a, z, codos = []) => ed.ejecutar(c.cablear(ed.documento, { desde: b(a), hasta: b(z), codos }));
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
  const estadoSim = () =>
    p.evaluar(`(() => { const s = bornera.simulacion()?.sim; if (!s) return null; return { detenida: s.detenida, avisos: s.avisos.length, enCorto: s.netlist.enCorto.length }; })()`);

  // ── 1. Los 6 desde la paleta ──
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
  comprobar("quedan los 6 en la hoja", (await contar()) === 6);
  await vaciar();
  comprobar("la hoja queda vacía", (await contar()) === 0);

  // ── 2. Simular con G1 ──
  const g = await armar(p, `const g = poner("fuente.continua", 0, 0, "G1"); const h = poner("senalizacion.lampara", -1, 8, "H1");
    tender([g, "L+"], [h, "X1"]); tender([g, "M"], [h, "X2"], [[1, 12], [-1, 12]]); return { g, h };`);
  await centrar(p, 2, 0, 4);
  await reposo();
  await tecla(F5);
  await esperar(80);
  await reposo();
  comprobar("F5 entra a Simular con G1", (await modo()) === "simular", await aviso());
  comprobar("H1 entre L+ y M de G1 enciende", (await encendido(g.h)) === true);
  comprobar("sin detención, avisos ni corto", JSON.stringify(await estadoSim()) === JSON.stringify({ detenida: null, avisos: 0, enCorto: 0 }), JSON.stringify(await estadoSim()));
  await p.captura("simular-g1");
  await tecla(F5);
  await esperar(80);
  comprobar("F5 vuelve a Editar", (await modo()) === "editar");
  await vaciar();

  // ── 3. Simular con T1 ──
  const t = await armar(p, `const l = poner("fuente.fase", -1, -8, "L"); const n = poner("fuente.neutro", 3, -8, "N");
    const t = poner("transformador.monofasico", 0, 0, "T1"); const h = poner("senalizacion.lampara", -1, 9, "H1");
    tender([l, "L"], [t, "1U1"]); tender([n, "N"], [t, "1U2"], [[3, -5], [1, -5]]);
    tender([t, "2U1"], [h, "X1"]); tender([t, "2U2"], [h, "X2"], [[1, 13], [-1, 13]]); return { t, h };`);
  await centrar(p, 2, 0, 2);
  await reposo();
  await tecla(F5);
  await esperar(80);
  await reposo();
  comprobar("F5 entra a Simular con T1", (await modo()) === "simular", await aviso());
  comprobar("H1 en el secundario 2U1-2U2 de T1 enciende", (await encendido(t.h)) === true);
  comprobar("el primario de T1 (L-N) está con tensión", (await encendido(t.t)) === true);
  comprobar("sin detención, avisos ni corto", JSON.stringify(await estadoSim()) === JSON.stringify({ detenida: null, avisos: 0, enCorto: 0 }), JSON.stringify(await estadoSim()));
  await p.captura("simular-t1");
  await tecla(F5);
  await esperar(80);
  await vaciar();

  // ── 4. Dos G1: R4 impide entrar ──
  await armar(p, `poner("fuente.continua", 0, 0, "G1"); const k = poner("fuente.conmutada", 10, 0, "G1"); return k;`);
  await tecla(F5);
  await esperar(80);
  comprobar("con dos G1, F5 avisa y queda en Editar (R4)", (await modo()) === "editar" && (await aviso()) === "No se puede simular: G1 está repetida", await aviso());
  await tecla(Z, CTRL);
  await tecla(F5);
  await esperar(80);
  comprobar("deshecha la segunda, F5 entra", (await modo()) === "simular");
  await tecla(F5);
  await esperar(80);
  await vaciar();
}
