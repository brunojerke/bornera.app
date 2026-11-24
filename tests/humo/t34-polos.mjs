// T34: polos y fuente trifásica en la app real a 1024×600 (docs/plan-T34.md).
//  1. Paleta: «Fuente trifásica» en Fuentes y «Contactos principales» en
//     Potencia. Arrastrar la trifásica: entra sin etiqueta, el panel dice
//     «Etiqueta» (no «Red (etiqueta)») y no da R9 (D1-A).
//  2. El resto del circuito con los comandos de la app: Fase «L1» → S1 → K1 →
//     Neutro, la trifásica → K1 principales → H1 → Neutro. L1 de la trifásica y
//     la Fase «L1» son la misma red (sin cable entre ellas).
//  3. F5: en reposo, los principales sin accionar; los cables de L2 y L3 con
//     fase. Mantener S1: K1 cierra los tres polos (se ven accionados), H1 se
//     enciende y el cable de 2 a H1 pasa a fase. Soltar: vuelven a reposo.
// Con `-- --capturas=CARPETA` guarda las capturas de cada paso.

import { esperar } from "./cdp.mjs";

export const nombre = "Polos y fuente trifásica";

const F5 = ["F5", "F5", 116];

/** Centro y texto de cada ítem de la paleta, con el título de su grupo. */
const items = (p) =>
  p.evaluar(`[...document.querySelectorAll(".item")].map(e => { const r = e.getBoundingClientRect();
    const g = e.closest("section, .grupo, details")?.querySelector("h2, h3, summary, .titulo")?.textContent.trim() ?? "";
    return { texto: e.textContent.trim(), grupo: g, x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`);

export default async function (p, comprobar) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods);
  const reposo = () =>
    p.evaluar(`new Promise((listo) => { let quietos = 0; const f = () => {
      quietos = bornera.activo().vista.enReposo ? quietos + 1 : 0;
      if (quietos >= 3) listo(true); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);

  // ── 1. Paleta y la trifásica ──
  const lista = await items(p);
  const tri = lista.find((i) => i.texto.includes("Fuente trifásica"));
  const principal = lista.find((i) => i.texto.includes("Contactos principales"));
  comprobar("la paleta tiene «Fuente trifásica» y «Contactos principales»", tri !== undefined && principal !== undefined, lista.map((i) => i.texto).join(", "));
  const grupos = await p.evaluar(`[...document.querySelectorAll(".item")].map(e => e.parentElement?.closest("*:has(> h2, > h3, > summary, > .titulo)")?.querySelector("h2, h3, summary, .titulo")?.textContent.trim() ?? "")`);
  const grupoDe = (texto) => grupos[lista.findIndex((i) => i.texto.includes(texto))] ?? "";
  comprobar("la trifásica va en Fuentes y los principales en Potencia", grupoDe("Fuente trifásica").includes("Fuentes") && grupoDe("Contactos principales").includes("Potencia"), `${grupoDe("Fuente trifásica")} / ${grupoDe("Contactos principales")}`);

  const destino = await p.punto(0, -2);
  if (tri) await p.arrastrar(tri, destino);
  await esperar(80);
  const t = await p.evaluar(`(() => { const c = bornera.editor.documento.hojas[0].componentes.find((x) => x.tipo === "fuente.trifasica"); return c ? { id: c.id, x: c.x, y: c.y, etiqueta: c.etiqueta } : null; })()`);
  comprobar("arrastrar coloca la trifásica, sin etiqueta (D1-A)", t !== null && t.etiqueta === "", JSON.stringify(t));
  if (!t) return;
  // Queda seleccionada al colocarla: el panel la muestra.
  await p.evaluar(`bornera.editor.seleccionarIds(["${t.id}"])`);
  await esperar(80);
  const rotulo = await p.evaluar(`document.querySelector('label[for="prop-etiqueta"]')?.textContent.trim() ?? ""`);
  comprobar("el panel dice «Etiqueta», no «Red (etiqueta)»", rotulo === "Etiqueta", rotulo);
  const avisosT = await p.evaluar(`bornera.editor.avisos.de("${t.id}").map((a) => a.regla)`);
  comprobar("la trifásica sin etiqueta no da R9", !avisosT.includes("R9"), avisosT.join(", "));
  await p.captura("t34-trifasica");

  // ── 2. El circuito, con los comandos de la app, relativo a la trifásica ──
  const ids = await p.evaluar(`(async () => {
    const { colocar, cablear } = await import("/src/core/model/comandos.ts");
    const ed = bornera.editor; const X = ${t.x}, Y = ${t.y};
    const poner = (tipo, dx, dy, etiqueta, rot = 0) => { const c = colocar(ed.documento, { tipo, x: X + dx, y: Y + dy, rot, espejado: false, etiqueta, params: {} }); ed.ejecutar(c); return c.id; };
    const b = (comp, borne) => ({ tipo: "borne", comp, borne });
    const tender = (a, z) => { const c = cablear(ed.documento, { desde: a, hasta: z, codos: [] }); ed.ejecutar(c); return c.id; };
    const T = "${t.id}";
    const k = poner("contactor.principal", 0, 10, "K1");
    const f = poner("fuente.fase", -10, 5, "L1");
    const s1 = poner("pulsador.na", -10, 10, "S1");
    const kb = poner("contactor.bobina", -10, 18, "K1");
    const n1 = poner("fuente.neutro", -10, 24, "N", 180);
    const h1 = poner("senalizacion.lampara", -2, 16, "H1");
    const n2 = poner("fuente.neutro", -2, 22, "N", 180);
    const w = {
      l1: tender(b(T, "L1"), b(k, "1")), l2: tender(b(T, "L2"), b(k, "3")), l3: tender(b(T, "L3"), b(k, "5")),
      f: tender(b(f, "L"), b(s1, "13")), s: tender(b(s1, "14"), b(kb, "A1")), a2: tender(b(kb, "A2"), b(n1, "N")),
      h: tender(b(k, "2"), b(h1, "X1")), x2: tender(b(h1, "X2"), b(n2, "N")),
    };
    return { k, s1, kb, h1, w };
  })()`);
  comprobar("el circuito se arma: 8 cables", Object.keys(ids.w).length === 8 && (await p.evaluar("bornera.editor.documento.hojas[0].cables.length")) === 8);
  await reposo();

  // ── 3. Simular ──
  await tecla(F5);
  await esperar(80);
  await reposo();
  const clase = (w) => p.evaluar(`bornera.editor.escena.claseDeCable("${w}")`);
  const accionado = () => p.evaluar(`bornera.editor.escena.obtener("${ids.k}").accionado === true`);
  const mismaRed = await p.evaluar(`(() => { const n = bornera.editor.simulacion.sim.netlist; const r = (c, b) => n.redDeBorne.get(c).get(b);
    const f = bornera.editor.documento.hojas[0].componentes.find((x) => x.tipo === "fuente.fase").id;
    return r("${t.id}", "L1") === r(f, "L"); })()`);
  comprobar("L1 de la trifásica y la Fase «L1» son la misma red, sin cable", mismaRed === true);
  comprobar("en reposo: principales sin accionar, L2 y L3 con fase, 2 → H1 sin potencial", !(await accionado()) && (await clase(ids.w.l2)) === 1 && (await clase(ids.w.l3)) === 1 && (await clase(ids.w.h)) === 0, `${await clase(ids.w.l2)} ${await clase(ids.w.l3)} ${await clase(ids.w.h)}`);
  await p.captura("t34-reposo");

  const sobreS1 = await p.evaluar(`(() => { const ed = bornera.activo(); const c = ed.documento.hojas[0].componentes.find((x) => x.id === "${ids.s1}");
    for (let dy = -2; dy <= 2; dy += 0.25) for (let dx = -2; dx <= 2; dx += 0.25) if (ed.escena.componenteEnPunto(c.x + dx, c.y + dy, 0) === c.id) return { x: c.x + dx, y: c.y + dy };
    return null; })()`);
  const q = await p.punto(sobreS1.x, sobreS1.y);
  await p.mouse("mouseMoved", q.x, q.y);
  await p.mouse("mousePressed", q.x, q.y);
  await esperar(50);
  await reposo();
  const sim = () => p.evaluar(`(() => { const s = bornera.editor.simulacion.sim; const n = s.netlist;
    return { polos: n.contactos.filter((c) => c.comp === "${ids.k}").map((c) => s.conducen[n.contactos.indexOf(c)]),
      h1: s.encendidas[n.cargas.findIndex((c) => c.comp === "${ids.h1}")] }; })()`);
  const conS1 = await sim();
  comprobar("mantener S1: K1 cierra los tres polos y H1 se enciende", JSON.stringify(conS1) === JSON.stringify({ polos: [true, true, true], h1: true }), JSON.stringify(conS1));
  comprobar("los principales se ven accionados y el cable 2 → H1 pasa a fase", (await accionado()) && (await clase(ids.w.h)) === 1);
  await p.captura("t34-s1");
  await p.mouse("mouseMoved", q.x + 120, q.y + 60, { botones: 1 });
  await p.mouse("mouseReleased", q.x + 120, q.y + 60);
  await esperar(50);
  await reposo();
  const suelto = await sim();
  comprobar("al soltar S1 (sin retención): polos abiertos y H1 apagada", JSON.stringify(suelto) === JSON.stringify({ polos: [false, false, false], h1: false }) && !(await accionado()), JSON.stringify(suelto));
  comprobar("sin detención ni avisos", await p.evaluar("bornera.editor.simulacion.sim.detenida === null && bornera.editor.simulacion.sim.avisos.length === 0"));

  await tecla(F5);
  await esperar(80);
  comprobar("F5 vuelve a Editar", (await p.evaluar("bornera.editor.simulacion")) === null);
}
