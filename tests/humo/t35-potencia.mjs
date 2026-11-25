// T35: símbolos de potencia en la app real a 1024×600 (docs/plan-T35.md).
//  1. Paleta: los 14 nuevos, cada uno en su grupo (Fuentes o Potencia).
//     Arrastrar cada uno al centro: entra con su prefijo (Q1, F1, M1; D9-A),
//     la trifásica con neutro sin etiqueta y la tierra con «PE». Sin avisos de
//     etiqueta (R1 a R5, R9). Una captura por símbolo, con su tipo de nombre
//     (ajuste 4: todas en la carpeta de `--capturas`), y se borra.
//  2. Referencias por polos (D16-A): bobina K1 con sus principales y un
//     auxiliar; bajo la bobina, «NA 1-2, 3-4, 5-6 (x, y)» y «NA 13-14 (x, y)».
//  3. R10 con la trifásica (D15-A): una Fase «L» y una trifásica marcan la «L».
//  4. Simular (F5) con M1 en L1, L2 y L3 de la trifásica: sin corto ni avisos.
// Con `-- --capturas=CARPETA` guarda las capturas.

import { esperar } from "./cdp.mjs";

export const nombre = "Símbolos de potencia";

const F5 = ["F5", "F5", 116];

/** Los 14 de T35: texto en la paleta, tipo, grupo y etiqueta con que entran. */
const NUEVOS = [
  ["Fuente trifásica con neutro", "fuente.trifasica_n", "Fuentes", ""],
  ["Tierra (PE)", "fuente.tierra", "Fuentes", "PE"],
  ["Termomagnética unipolar", "proteccion.termomagnetica_unipolar", "Potencia", "Q1"],
  ["Termomagnética bipolar", "proteccion.termomagnetica_bipolar", "Potencia", "Q1"],
  ["Termomagnética tripolar", "proteccion.termomagnetica_tripolar", "Potencia", "Q1"],
  ["Termomagnética tetrapolar", "proteccion.termomagnetica_tetrapolar", "Potencia", "Q1"],
  ["Diferencial bipolar", "proteccion.diferencial_bipolar", "Potencia", "Q1"],
  ["Diferencial tetrapolar", "proteccion.diferencial_tetrapolar", "Potencia", "Q1"],
  ["Guardamotor", "proteccion.guardamotor", "Potencia", "Q1"],
  ["Seccionador", "maniobra.seccionador", "Potencia", "Q1"],
  ["Fusible tripolar", "proteccion.fusible_tripolar", "Potencia", "F1"],
  ["Relé térmico", "proteccion.termico", "Potencia", "F1"],
  ["Motor trifásico", "motor.trifasico", "Potencia", "M1"],
  ["Motor estrella-triángulo", "motor.estrella_triangulo", "Potencia", "M1"],
];

const ETIQUETA = ["R1", "R2", "R3", "R4", "R5", "R9"];

/** El ítem de la paleta con ese texto, desplazado a la vista: centro y título de su grupo. */
const item = (p, texto) =>
  p.evaluar(`(() => { const e = [...document.querySelectorAll(".item")].find((x) => x.textContent.trim() === ${JSON.stringify(texto)});
    if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect();
    const g = e.parentElement?.closest("*:has(> h2, > h3, > summary, > .titulo)")?.querySelector("h2, h3, summary, .titulo")?.textContent.trim() ?? "";
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, grupo: g }; })()`);

const centrar = (p, zoom, gx, gy) =>
  p.evaluar(`(() => { const ed = bornera.activo(), cv = document.querySelector("canvas");
    ed.vista.camara.zoom = ${zoom}; ed.vista.camara.centrar(${gx}, ${gy}, cv.clientWidth, cv.clientHeight); ed.vista.invalidar(); })()`);

export default async function (p, comprobar) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods);
  const reposo = () =>
    p.evaluar(`new Promise((listo) => { let quietos = 0; const f = () => {
      quietos = bornera.activo().vista.enReposo ? quietos + 1 : 0;
      if (quietos >= 3) listo(true); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);

  // ── 1. Cada símbolo desde la paleta, una captura y se borra ──
  for (const [texto, tipo, grupo, etiqueta] of NUEVOS) {
    await centrar(p, 1, 0, 0);
    await esperar(30);
    const it = await item(p, texto);
    comprobar(`la paleta tiene «${texto}» en ${grupo}`, it !== null && it.grupo.includes(grupo), JSON.stringify(it));
    if (!it) continue;
    await p.arrastrar(it, await p.punto(0, 0));
    await esperar(60);
    const c = await p.evaluar(`(() => { const c = bornera.editor.documento.hojas[0].componentes.find((x) => x.tipo === "${tipo}"); return c ? { id: c.id, x: c.x, y: c.y, etiqueta: c.etiqueta } : null; })()`);
    comprobar(`«${texto}» entra con la etiqueta «${etiqueta}»`, c !== null && c.etiqueta === etiqueta, JSON.stringify(c));
    if (!c) continue;
    const avisos = await p.evaluar(`bornera.editor.avisos.de("${c.id}").map((a) => a.regla)`);
    comprobar(`«${texto}» sin avisos de etiqueta`, !avisos.some((r) => ETIQUETA.includes(r)), avisos.join(", "));
    await p.evaluar(`bornera.editor.seleccionarIds([])`);
    await centrar(p, 3, c.x, c.y);
    await reposo();
    await p.captura(tipo);
    await p.evaluar(`(async () => { const { Borrar } = await import("/src/core/model/comandos.ts"); bornera.editor.ejecutar(new Borrar(["${c.id}"])); })()`);
    await esperar(30);
  }
  comprobar("la hoja queda vacía después de los 14", (await p.evaluar("bornera.editor.documento.hojas[0].componentes.length")) === 0);

  // ── 2 y 3. Referencias por polos y R10, con los comandos de la app ──
  await centrar(p, 1, 10, 8);
  const ids = await p.evaluar(`(async () => {
    const { colocar, cablear } = await import("/src/core/model/comandos.ts");
    const ed = bornera.editor;
    const poner = (tipo, x, y, etiqueta, rot = 0) => { const c = colocar(ed.documento, { tipo, x, y, rot, espejado: false, etiqueta, params: {} }); ed.ejecutar(c); return c.id; };
    const b = (comp, borne) => ({ tipo: "borne", comp, borne });
    const tender = (a, z) => { const c = cablear(ed.documento, { desde: a, hasta: z, codos: [] }); ed.ejecutar(c); return c.id; };
    const t = poner("fuente.trifasica", 20, 0, "");
    const k = poner("contactor.principal", 20, 8, "K1");
    const m = poner("motor.trifasico", 20, 16, "M1");
    const kb = poner("contactor.bobina", 0, 10, "K1");
    const aux = poner("contactor.auxiliar_na", 0, 24, "K1");
    const fase = poner("fuente.fase", 0, 0, "L");
    tender(b(t, "L1"), b(k, "1")); tender(b(t, "L2"), b(k, "3")); tender(b(t, "L3"), b(k, "5"));
    tender(b(k, "2"), b(m, "U")); tender(b(k, "4"), b(m, "V")); tender(b(k, "6"), b(m, "W"));
    return { t, k, m, kb, aux, fase };
  })()`);
  await reposo();
  const lineas = await p.evaluar(`[...(bornera.editor.referencias.lineas("${ids.kb}") ?? [])]`);
  comprobar("bajo K1: «NA 1-2, 3-4, 5-6 (20, 8)» y «NA 13-14 (0, 24)» (D16-A)", JSON.stringify(lineas) === JSON.stringify(["NA 1-2, 3-4, 5-6 (20, 8)", "NA 13-14 (0, 24)"]), JSON.stringify(lineas));
  const r10 = await p.evaluar(`bornera.editor.avisos.de("${ids.fase}").filter((a) => a.regla === "R10").map((a) => a.otras)`);
  comprobar("la Fase «L» con la trifásica en la hoja: R10 «L1, L2 y L3» (D15-A)", JSON.stringify(r10) === JSON.stringify(["L1, L2 y L3"]), JSON.stringify(r10));
  await p.captura("referencias-r10");

  // ── 4. Simular: M1 entre L1, L2 y L3 sin falsos cortos ──
  await p.evaluar(`(async () => { const { Borrar } = await import("/src/core/model/comandos.ts"); bornera.editor.ejecutar(new Borrar(["${ids.fase}"])); })()`);
  await reposo();
  await tecla(F5);
  await esperar(80);
  await reposo();
  const sim = await p.evaluar(`(() => { const s = bornera.editor.simulacion?.sim; if (!s) return null;
    return { detenida: s.detenida, avisos: s.avisos.length, enCorto: s.netlist.enCorto.length, motorCarga: s.netlist.cargas.some((c) => c.comp === "${ids.m}") }; })()`);
  comprobar("Simular entra con M1: sin detención, avisos ni corto, y M1 no es carga (D14-A)", JSON.stringify(sim) === JSON.stringify({ detenida: null, avisos: 0, enCorto: 0, motorCarga: false }), JSON.stringify(sim));
  await p.captura("simular");
  await tecla(F5);
  await esperar(80);
  comprobar("F5 vuelve a Editar", (await p.evaluar("bornera.editor.simulacion")) === null);
}
