// T27: los pulsadores NC se numeran desde S0 y los NA desde S1, en la app
// real a 1024×600 (docs/plan-fase4.md, T27; opción A: el menor libre desde su
// primer número, compartiendo los números de la S). Cada bloque arranca en un
// documento nuevo (Ctrl+N):
//  1. Paleta: NC, NC y NA en modo clic. La previa dice S0, S1 y S2, y quedan
//     S0, S1 y S2, un paso cada uno. Tres Ctrl+Z vacían la hoja y tres Ctrl+Y
//     devuelven los mismos componentes con las mismas etiquetas (no se
//     recalculan).
//  2. Borrar S0 (clic y Supr) y colocar otro NC desde la paleta: vuelve a S0.
//  3. Parada y marcha (NC S0, NA S1) con Ctrl+D: la copia da S2 (el NC) y S3
//     (el NA) en un paso.
//  4. «Etiquetar los vacíos» con NC, NC y NA vacíos: S0, S1 y S2 en un paso.
// Al final, validarHoja en 0.

import { isDeepStrictEqual } from "node:util";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Pulsadores desde S0 (NC) y S1 (NA)";

const N = ["n", "KeyN", 78];
const D = ["d", "KeyD", 68];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];
const SUPR = ["Delete", "Delete", 46];
const DIALOGO = '[role="dialog"][aria-modal="true"]';
const ETIQUETAR_VACIOS = "Etiquetar los vacíos";

export default async function (p, comprobar) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods);
  const hoja = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento.hojas[0]))");
  const componentes = async () => (await hoja()).componentes;
  const pasos = () => p.evaluar("bornera.editor.historial.hechos.length");
  const problemas = () => p.evaluar("bornera.cables.validarHoja(bornera.editor.documento.hojas[0]).length");
  const etiquetaPrevia = () => p.evaluar("bornera.editor.herramienta?.etiqueta ?? null");
  const seleccionar = (ids) => p.evaluar(`bornera.editor.seleccionarIds(${JSON.stringify(ids)})`);
  const colocar = (tipo, x, y, etiqueta) =>
    p.evaluar(`(() => { const { editor, comandos: c } = bornera;
      const cmd = c.colocar(editor.documento, { tipo: "${tipo}", x: ${x}, y: ${y}, rot: 0, espejado: false, etiqueta: ${JSON.stringify(etiqueta)}, params: {} });
      editor.ejecutar(cmd); return cmd.id; })()`);
  const camara = async (zoom, gx, gy) => {
    await p.evaluar(`(() => { const cv = document.querySelector("canvas[aria-label^=Lienzo]"); const v = bornera.editor.vista;
      v.camara.zoom = ${zoom}; v.camara.centrar(${gx}, ${gy}, cv.clientWidth, cv.clientHeight); v.invalidarContenido(); })()`);
    await esperar(60);
  };
  const a = async (gx, gy) => {
    const q = await p.punto(gx, gy);
    await p.mouse("mouseMoved", q.x, q.y);
    await esperar(30);
  };
  const clic = async (gx, gy) => {
    await p.clic(await p.punto(gx, gy));
    await esperar(30);
  };
  /** Ctrl+N; si hay cambios, «No guardar». Documento vacío y sin historial. */
  const nuevo = async () => {
    await tecla(N, CTRL);
    if (await p.esperarA(`!!document.querySelector('${DIALOGO}')`, 1500).then(() => true, () => false)) {
      const k = await p.evaluar(`(() => { const b = [...document.querySelectorAll('${DIALOGO} button')].find((x) => x.textContent.trim() === "No guardar");
        if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!k) throw new Error("No está el botón «No guardar» en el diálogo.");
      await p.clic(k);
      await p.esperarA(`!document.querySelector('${DIALOGO}')`, 5000);
    }
    await p.esperarA("bornera.editor.documento.hojas[0].componentes.length === 0 && bornera.editor.historial.hechos.length === 0", 5000);
    await esperar(100);
  };
  const boton = (texto) =>
    p.evaluar(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(texto)});
      if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, deshabilitado: b.disabled }; })()`);
  /** Clic en la paleta: deja la herramienta en modo clic. */
  const elegir = async (nombreItem) => {
    const item = await p.evaluar(`(() => { const e = [...document.querySelectorAll(".item")].find((x) => x.textContent.trim() === ${JSON.stringify(nombreItem)});
      if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!item) throw new Error(`No está «${nombreItem}» en la paleta.`);
    await p.clic(item);
    await esperar(30);
  };
  const etiquetas = (lista) => lista.map((c) => c.etiqueta);

  // ── 1. Paleta: NC, NC y NA ──
  await nuevo();
  await camara(0.6, 6, 4);
  await elegir("Pulsador NC");
  await a(0, 0);
  const previa1 = await etiquetaPrevia();
  let n = await pasos();
  await clic(0, 0);
  await a(6, 0);
  const previa2 = await etiquetaPrevia();
  await clic(6, 0);
  await p.esc();
  await elegir("Pulsador NA");
  await a(12, 0);
  const previa3 = await etiquetaPrevia();
  await clic(12, 0);
  await p.esc();
  const colocados = await componentes();
  comprobar(
    "paleta: NC, NC y NA. La previa dice S0, S1 y S2, y quedan S0, S1 y S2, un paso cada uno",
    previa1 === "S0" && previa2 === "S1" && previa3 === "S2" &&
      isDeepStrictEqual(etiquetas(colocados), ["S0", "S1", "S2"]) && (await pasos()) === n + 3,
    JSON.stringify({ previas: [previa1, previa2, previa3], etiquetas: etiquetas(colocados), pasos: (await pasos()) - n }),
  );
  await p.captura("nc-nc-na");

  for (let i = 0; i < 3; i++) await tecla(Z, CTRL);
  await esperar(60);
  comprobar("tres Ctrl+Z vacían la hoja", (await componentes()).length === 0 && (await pasos()) === n);
  for (let i = 0; i < 3; i++) await tecla(Y, CTRL);
  await esperar(60);
  const rehechos = await componentes();
  comprobar(
    "tres Ctrl+Y devuelven los mismos componentes (ids y etiquetas S0, S1 y S2)",
    isDeepStrictEqual(rehechos, colocados) && (await pasos()) === n + 3,
    JSON.stringify(rehechos.map((c) => [c.id, c.etiqueta])),
  );
  comprobar("bloque 1: validarHoja en 0", (await problemas()) === 0);

  // ── 2. Borrar S0 y colocar otro NC ──
  const s0 = colocados[0].id;
  await seleccionar([]);
  await esperar(60);
  await clic(0, 0);
  const sel = await p.evaluar("[...bornera.editor.seleccion]");
  comprobar("un clic en S0 lo elige", isDeepStrictEqual(sel, [s0]), JSON.stringify(sel));
  await tecla(SUPR);
  await esperar(60);
  comprobar("Supr borra S0", !(await componentes()).some((c) => c.id === s0));
  await elegir("Pulsador NC");
  await a(0, 6);
  const previaS0 = await etiquetaPrevia();
  await clic(0, 6);
  await p.esc();
  const tras = await componentes();
  comprobar(
    "con S0 borrado, el próximo NC vuelve a S0 (previa y resultado)",
    previaS0 === "S0" && isDeepStrictEqual(etiquetas(tras), ["S1", "S2", "S0"]),
    JSON.stringify({ previa: previaS0, etiquetas: etiquetas(tras) }),
  );

  // ── 3. Parada y marcha con Ctrl+D ──
  await nuevo();
  const pm = [await colocar("pulsador.nc", 0, 0, "S0"), await colocar("pulsador.na", 6, 0, "S1")];
  await seleccionar([]);
  await esperar(150);
  await camara(1, 6, 3);
  await seleccionar(pm);
  n = await pasos();
  await tecla(D, CTRL);
  await esperar(60);
  const despues = await componentes();
  const copia = despues.filter((c) => !pm.includes(c.id)).sort((u, v) => u.y - v.y || u.x - v.x);
  comprobar(
    "Ctrl+D de parada y marcha (S0, S1): la copia da S2 (NC) y S3 (NA) en un paso; los originales conservan",
    (await pasos()) === n + 1 &&
      isDeepStrictEqual(copia.map((c) => [c.tipo, c.etiqueta]), [["pulsador.nc", "S2"], ["pulsador.na", "S3"]]) &&
      isDeepStrictEqual(etiquetas(despues.filter((c) => pm.includes(c.id))), ["S0", "S1"]),
    JSON.stringify(despues.map((c) => [c.tipo, c.etiqueta])),
  );
  await p.captura("duplicar-parada-marcha");

  // ── 4. «Etiquetar los vacíos» con NC, NC y NA ──
  await nuevo();
  const v = [await colocar("pulsador.nc", 0, 0, ""), await colocar("pulsador.nc", 6, 0, ""), await colocar("pulsador.na", 12, 0, "")];
  await seleccionar([]);
  await esperar(150);
  await camara(1, 6, 3);
  const b = await boton(ETIQUETAR_VACIOS);
  comprobar("sin selección, «Etiquetar los vacíos» está habilitado", b !== null && !b.deshabilitado, JSON.stringify(b));
  n = await pasos();
  await p.clic(b);
  await esperar(60);
  const vacios = Object.fromEntries((await componentes()).map((c) => [c.id, c.etiqueta]));
  comprobar(
    "«Etiquetar los vacíos» con NC, NC y NA: S0, S1 y S2 en un paso",
    (await pasos()) === n + 1 && isDeepStrictEqual(v.map((id) => vacios[id]), ["S0", "S1", "S2"]),
    JSON.stringify(vacios),
  );
  comprobar("bloque 4: validarHoja en 0", (await problemas()) === 0);
}
