// T26: borrar un cable con T colgando (D7-A), a 1024×600 con el mouse y el
// teclado. Es el paso 3 de la hoja 2 (docs/netbook-fase3b.md) sin el
// Mayús+clic: sobre tests/circuitos/marcha-parada.brn, un clic en el cable
// S1·14–K1·A1 (entre la T y A1) y Supr se llevan también el cable de la T de
// H1, en un paso y con el aviso «Se borró también 1 cable en T.». Ctrl+Z
// devuelve los dos con sus ids, su orden y H1·X1; Ctrl+Y los vuelve a borrar.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Borrar un cable con T colgando";

const O = ["o", "KeyO", 79];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];
const SUPR = ["Delete", "Delete", 46];
const MARCHA_PARADA = resolve(dirname(fileURLToPath(import.meta.url)), "../circuitos/marcha-parada.brn");
const AVISO = "Se borró también 1 cable en T.";

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
  const pasos = () => p.evaluar("bornera.activo().historial.hechos.length");
  const seleccion = () => p.evaluar("[...bornera.activo().seleccion].sort()");
  const aviso = () => p.evaluar(`document.querySelector("footer.estado .avisos")?.textContent.trim() ?? ""`);

  // ── Abrir marcha-parada.brn ──
  await p.evaluar("bornera.editor.__anterior = true");
  p.elegirArchivo(MARCHA_PARADA);
  await tecla(O, CTRL);
  await p.esperarA("bornera.editor.__anterior !== true", 5000);
  await esperar(150);
  const antes = await hoja();
  const en = (tipo, x, y) => antes.componentes.find((c) => c.tipo === tipo && c.x === x && c.y === y);
  const s1 = en("pulsador.na", 0, 11);
  const bobina = en("contactor.bobina", 0, 22);
  const h1 = en("senalizacion.lampara", 16, 22);
  if (!s1 || !bobina || !h1) throw new Error("marcha-parada.brn no es la de docs/archivo/plan-T15.md, sección 3.");
  const esBorne = (e, comp, borne) => e.tipo === "borne" && e.comp === comp && e.borne === borne;
  const w4 = antes.cables.find((w) => esBorne(w.desde, s1.id, "14") && esBorne(w.hasta, bobina.id, "A1"));
  const w7 = antes.cables.find((w) => w.desde.tipo === "cable" && w.desde.cable === w4?.id && esBorne(w.hasta, h1.id, "X1"));
  if (!w4 || !w7) throw new Error("No están en marcha-parada.brn el cable S1·14–A1 y el de la T de H1.");
  comprobar("abrir marcha-parada.brn: 8 cables e historial vacío", antes.cables.length === 8 && (await pasos()) === 0);

  // ── Un clic en S1·14–A1 (entre la T en (0, 16) y A1 en (0, 20)) y Supr ──
  await p.clic(await p.punto(0, 18));
  await esperar(60);
  const sel = await seleccion();
  comprobar("un clic (sin Mayús) elige solo el cable S1·14–A1", isDeepStrictEqual(sel, [w4.id]), JSON.stringify(sel));
  await tecla(SUPR);
  await esperar(60);
  const borrado = await hoja();
  const ids = (h) => h.cables.map((w) => w.id);
  comprobar("Supr es un solo paso de deshacer", (await pasos()) === 1, String(await pasos()));
  comprobar(
    "Supr se lleva también el cable de la T de H1; los otros 6 quedan igual y en su orden",
    isDeepStrictEqual(borrado.cables, antes.cables.filter((w) => w.id !== w4.id && w.id !== w7.id)),
    JSON.stringify(ids(borrado)),
  );
  comprobar("no queda ningún extremo suelto", !borrado.cables.some((w) => w.desde.tipo === "libre" || w.hasta.tipo === "libre"));
  comprobar("los componentes no cambian (H1 incluido)", isDeepStrictEqual(borrado.componentes, antes.componentes));
  const texto = await aviso();
  comprobar(`la barra avisa «${AVISO}»`, texto === AVISO, texto);
  await p.captura("borrado");

  // ── Ctrl+Z y Ctrl+Y ──
  await tecla(Z, CTRL);
  await esperar(60);
  const deshecho = await hoja();
  comprobar("Ctrl+Z devuelve los dos cables con sus ids, su orden y sus datos (la T sobre S1·14–A1, H1·X1)", isDeepStrictEqual(deshecho, antes), JSON.stringify(ids(deshecho)));
  comprobar("después de Ctrl+Z, el historial queda vacío", (await pasos()) === 0, String(await pasos()));
  await tecla(Y, CTRL);
  await esperar(60);
  comprobar("Ctrl+Y los vuelve a borrar igual", isDeepStrictEqual(await hoja(), borrado), JSON.stringify(ids(await hoja())));
}
