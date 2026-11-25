// T36: mando y protecciones que conducen en la app real a 1024×600 (docs/plan-T36.md).
//  1. inversion-potencia.brn (fase 6, sección 0): abre con 21 componentes, sin
//     errores ni avisos. Simular: Q1 y F2 cerrados (Q1 se dibuja cerrado,
//     D20-B), el 95-96 cerrado y en reposo (ajuste 1). Clic en S1: K1, y U V W
//     toman L1 L2 L3; S0 para; S2: K2, U V W = L3 L2 L1. Un clic en Q1 o en F2
//     no hace nada (D18-A). Capturas de cada estado.
//  2. Selector y seta enclavados (D7-A, ajuste 3): un clic acciona y queda, otro
//     libera; la seta abre su NC. La bocina se enciende como la lámpara.
//  3. Paleta: los 8 nuevos, cada uno en su grupo (Mando o Señalización),
//     arrastrados a un lugar libre: entran con su prefijo y el menor número
//     libre de esta hoja (S3, F3, H3: ya están S0–S2, S5, S6, F1, F2, H1, H2,
//     H5 y H6); 95-96 y 97-98 sin etiqueta (siguen al térmico: solo R1). Una captura por símbolo,
//     con su tipo de nombre, y se borra.
// Con `-- --capturas=CARPETA` guarda las capturas.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Mando y protecciones";

const O = ["o", "KeyO", 79];
const F5 = ["F5", "F5", 116];
const CIRCUITOS = resolve(dirname(fileURLToPath(import.meta.url)), "../circuitos");

/** Los 8 de T36: texto en la paleta, tipo, grupo y etiqueta con que entran en esta hoja (el menor libre). */
const NUEVOS = [
  ["Selector NA", "mando.selector", "Mando", "S3"],
  ["Seta NC", "mando.seta", "Mando", "S3"],
  ["Final de carrera NA", "mando.final_na", "Mando", "S3"],
  ["Final de carrera NC", "mando.final_nc", "Mando", "S3"],
  ["Contacto del térmico NC", "termico.contacto_nc", "Mando", ""],
  ["Contacto del térmico NA", "termico.contacto_na", "Mando", ""],
  ["Fusible", "proteccion.fusible", "Mando", "F3"],
  ["Bocina", "senalizacion.bocina", "Señalización", "H3"],
];

const ETIQUETA = ["R1", "R2", "R3", "R4", "R5", "R9"];

const item = (p, texto) =>
  p.evaluar(`(() => { const e = [...document.querySelectorAll(".item")].find((x) => x.textContent.trim() === ${JSON.stringify(texto)});
    if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect();
    const g = e.parentElement?.closest("*:has(> h2, > h3, > summary, > .titulo)")?.querySelector("h2, h3, summary, .titulo")?.textContent.trim() ?? "";
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, grupo: g }; })()`);

const centrar = (p, zoom, gx, gy) =>
  p.evaluar(`(() => { const ed = bornera.activo(), cv = document.querySelector("canvas");
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
  const reposo = () =>
    p.evaluar(`new Promise((listo) => { let quietos = 0; const f = () => {
      quietos = bornera.activo().vista.enReposo ? quietos + 1 : 0;
      if (quietos >= 3) listo(true); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
  const modo = () => p.evaluar(`document.querySelector(".modo button.simular").getAttribute("aria-pressed") === "true" ? "simular" : "editar"`);
  const idDe = (etiqueta, tipo) =>
    p.evaluar(`bornera.editor.documento.hojas[0].componentes.find((x) => x.etiqueta === ${JSON.stringify(etiqueta)} && x.tipo === ${JSON.stringify(tipo)})?.id ?? null`);
  const conTension = () =>
    p.evaluar(`(() => { const s = bornera.simulacion(); return JSON.stringify(s.sim.netlist.bobinas.filter((_, g) => s.sim.tension[g]).map((b) => b.etiqueta)); })()`);
  /** Potenciales de U, V y W de M1, como texto. */
  const uvw = (m1) =>
    p.evaluar(`(() => { const s = bornera.simulacion().sim;
      return JSON.stringify(["U", "V", "W"].map((b) => { const p = s.potencialDeRed[s.netlist.redDeBorne.get("${m1}").get(b)]; return p === null ? null : s.netlist.potenciales[p].nombre; })); })()`);
  const accionado = (id) => p.evaluar(`bornera.editor.escena.obtener("${id}")?.accionado === true`);
  const encendida = (id) => p.evaluar(`(() => { const s = bornera.simulacion().sim; return s.encendidas[s.netlist.cargas.findIndex((k) => k.comp === "${id}")]; })()`);
  /** Un punto de la página sobre el cuerpo de `id`. */
  const sobre = async (id) => {
    const g = await p.evaluar(`(() => { const ed = bornera.activo(); const c = ed.documento.hojas[0].componentes.find((x) => x.id === "${id}");
      for (let dy = -4; dy <= 4; dy += 0.25) for (let dx = -4; dx <= 4; dx += 0.25)
        if (ed.escena.componenteEnPunto(c.x + dx, c.y + dy, 0) === c.id) return { x: c.x + dx, y: c.y + dy };
      return null; })()`);
    if (!g) throw new Error(`No hay un punto sobre ${id}`);
    return p.punto(g.x, g.y);
  };
  const clic = async (id) => {
    const q = await sobre(id);
    await p.mouse("mouseMoved", q.x, q.y);
    await p.mouse("mousePressed", q.x, q.y);
    await esperar(30);
    await p.mouse("mouseReleased", q.x, q.y);
    await esperar(30);
  };

  // ── 1. inversion-potencia.brn ──
  await p.evaluar("bornera.editor.__anterior = true");
  p.elegirArchivo(resolve(CIRCUITOS, "inversion-potencia.brn"));
  await tecla(O, CTRL);
  await p.esperarA("bornera.editor.__anterior !== true", 5000);
  await p.esperarA("!bornera.editor.avisos.enReposoR11", 5000);
  const cuenta = await p.evaluar("JSON.stringify([bornera.editor.documento.hojas[0].componentes.length, bornera.editor.avisos.cuenta])");
  comprobar("inversion-potencia.brn: 21 componentes, sin errores ni avisos", cuenta === JSON.stringify([21, { errores: 0, avisos: 0 }]), cuenta);
  const ids = {};
  for (const [k, e, t] of [
    ["q1", "Q1", "proteccion.termomagnetica_tripolar"],
    ["f2", "F2", "proteccion.termico"],
    ["c95", "F2", "termico.contacto_nc"],
    ["f1", "F1", "proteccion.fusible"],
    ["s0", "S0", "pulsador.nc"],
    ["s1", "S1", "pulsador.na"],
    ["s2", "S2", "pulsador.na"],
    ["m1", "M1", "motor.trifasico"],
  ])
    ids[k] = await idDe(e, t);
  // Todo el circuito en pantalla (x de −2 a 74, y de −2 a 53).
  await centrar(p, 0.35, 36, 26);
  await tecla(F5);
  await esperar(80);
  await reposo();
  comprobar("F5 entra a Simular sin detención ni avisos", (await modo()) === "simular" && (await p.evaluar("JSON.stringify([bornera.simulacion().sim.detenida, bornera.simulacion().sim.avisos.length])")) === "[null,0]");
  comprobar("Q1 y F1 conducen y se ven accionados; Q1 cerrado (D20-B)", (await accionado(ids.q1)) && (await accionado(ids.f1)));
  comprobar("el 95-96 de F2 conduce y se dibuja en reposo, cerrado (ajuste 1)", !(await accionado(ids.c95)) && (await p.evaluar(`(() => { const s = bornera.simulacion().sim; return s.conducen[s.netlist.contactos.findIndex((c) => c.comp === "${ids.c95}")]; })()`)));
  comprobar("en reposo, M1 sin tensión", (await uvw(ids.m1)) === "[null,null,null]", await uvw(ids.m1));
  await p.captura("inversion-potencia-reposo");
  await clic(ids.s1);
  await reposo();
  comprobar("S1: K1 retiene y U V W = L1 L2 L3", (await conTension()) === '["K1"]' && (await uvw(ids.m1)) === '["L1","L2","L3"]', `${await conTension()} ${await uvw(ids.m1)}`);
  await p.captura("inversion-potencia-k1");
  await clic(ids.s0);
  comprobar("S0 para", (await conTension()) === "[]");
  await clic(ids.s2);
  await reposo();
  comprobar("S2: K2 retiene y U V W = L3 L2 L1 (el otro sentido)", (await conTension()) === '["K2"]' && (await uvw(ids.m1)) === '["L3","L2","L1"]', `${await conTension()} ${await uvw(ids.m1)}`);
  await p.captura("inversion-potencia-k2");
  for (const k of ["q1", "f2"]) {
    await clic(ids[k]);
    comprobar(`un clic en ${k === "q1" ? "Q1" : "F2"} no hace nada (D18-A)`, (await conTension()) === '["K2"]' && (await p.evaluar("bornera.simulacion().fijados.length")) === 0);
  }
  await tecla(F5);
  await esperar(80);
  comprobar("F5 vuelve a Editar", (await modo()) === "editar");

  // ── 2. Selector y seta, con la bocina (a la izquierda, lejos del circuito) ──
  const m = await p.evaluar(`(async () => {
    const { colocar, cablear } = await import("/src/core/model/comandos.ts");
    const ed = bornera.editor;
    const poner = (tipo, x, y, etiqueta, rot = 0) => { const c = colocar(ed.documento, { tipo, x, y, rot, espejado: false, etiqueta, params: {} }); ed.ejecutar(c); return c.id; };
    const b = (comp, borne) => ({ tipo: "borne", comp, borne });
    const tender = (a, z) => { const c = cablear(ed.documento, { desde: a, hasta: z, codos: [] }); ed.ejecutar(c); return c.id; };
    const rama = (x, tipo, a, z, et, carga, hx) => {
      const f = poner("fuente.fase", x, 0, "L1"); const c = poner(tipo, x, 5, et); const h = poner(carga, x, 11, hx); const n = poner("fuente.neutro", x, 16, "N", 180);
      tender(b(f, "L"), b(c, a)); tender(b(c, z), b(h, "X1")); tender(b(h, "X2"), b(n, "N")); return { c, h };
    };
    const sel = rama(-40, "mando.selector", "13", "14", "S5", "senalizacion.bocina", "H5");
    const seta = rama(-30, "mando.seta", "11", "12", "S6", "senalizacion.lampara", "H6");
    return { sel: sel.c, bocina: sel.h, seta: seta.c, h6: seta.h };
  })()`);
  await centrar(p, 2, -35, 8);
  await tecla(F5);
  await esperar(80);
  await reposo();
  comprobar("en reposo: bocina apagada, H6 encendida por la seta", !(await encendida(m.bocina)) && (await encendida(m.h6)));
  await clic(m.sel);
  comprobar("un clic en el selector: queda accionado y la bocina suena (sin mantener el botón)", (await accionado(m.sel)) && (await encendida(m.bocina)) && (await p.evaluar("bornera.simulacion().mantenido")) === null);
  await clic(m.seta);
  comprobar("un clic en la seta: queda accionada y abre su NC, H6 se apaga (ajuste 3)", (await accionado(m.seta)) && !(await encendida(m.h6)));
  await reposo();
  await p.captura("selector-seta-accionados");
  await clic(m.sel);
  await clic(m.seta);
  comprobar("otro clic libera los dos", !(await accionado(m.sel)) && !(await accionado(m.seta)) && !(await encendida(m.bocina)) && (await encendida(m.h6)));
  await tecla(F5);
  await esperar(80);

  // ── 3. Los 8 desde la paleta, a un lugar libre ──
  const LIBRE = [-60, -20];
  for (const [texto, tipo, grupo, etiqueta] of NUEVOS) {
    await centrar(p, 1, ...LIBRE);
    await esperar(30);
    const it = await item(p, texto);
    comprobar(`la paleta tiene «${texto}» en ${grupo}`, it !== null && it.grupo.includes(grupo), JSON.stringify(it));
    if (!it) continue;
    const antes = await p.evaluar("bornera.editor.documento.hojas[0].componentes.length");
    await p.arrastrar(it, await p.punto(...LIBRE));
    await esperar(60);
    const c = await p.evaluar(`(() => { const h = bornera.editor.documento.hojas[0].componentes; if (h.length !== ${antes} + 1) return null;
      const c = h[h.length - 1]; return c.tipo === "${tipo}" ? { id: c.id, x: c.x, y: c.y, etiqueta: c.etiqueta } : null; })()`);
    comprobar(`«${texto}» entra con la etiqueta «${etiqueta}»`, c !== null && c.etiqueta === etiqueta, JSON.stringify(c));
    if (!c) continue;
    const avisos = await p.evaluar(`bornera.editor.avisos.de("${c.id}").map((a) => a.regla).filter((r) => ${JSON.stringify(ETIQUETA)}.includes(r))`);
    const esperados = etiqueta === "" ? ["R1"] : [];
    comprobar(`«${texto}» con los avisos de etiqueta esperados (${esperados.join(", ") || "ninguno"})`, JSON.stringify(avisos) === JSON.stringify(esperados), avisos.join(", "));
    await p.evaluar(`bornera.editor.seleccionarIds([])`);
    await centrar(p, 3, c.x, c.y);
    await reposo();
    await p.captura(tipo);
    await p.evaluar(`(async () => { const { Borrar } = await import("/src/core/model/comandos.ts"); bornera.editor.ejecutar(new Borrar(["${c.id}"])); })()`);
    await esperar(30);
  }
}
