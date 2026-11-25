// T17b: contacto auxiliar NC en la app real a 1024×600 (plan T17b, sección 4).
//
// Cada bloque arranca en un documento nuevo (Ctrl+N):
//  1. Paleta: «Contacto auxiliar NC» está justo después de «Contacto auxiliar
//     NA»; hay 8 ítems.
//  2. Arrastrar: del ítem al lienzo, entra vacío, con los bornes 21 y 22 (los
//     de la definición, y un cable puede salir de cada uno), en un paso.
//  3. Renombrar: la bobina K1, el NA y el NC con "K1" escrito a mano en el
//     panel. Renombrar la bobina a K5 arrastra al NA y al NC en un paso
//     («2 contactos pasaron a K5.») y un Ctrl+Z vuelve los tres. Con solo el
//     NC enlazado, «1 contacto pasó a K5.».
//  4. «Etiquetar los vacíos» no toca al NC (queda vacío), en un paso, y un
//     Ctrl+Z lo deshace.
//  5. Guardar y reabrir: con el NC colocado y etiquetado, Ctrl+S (descarga),
//     Ctrl+O con el archivo (selector interceptado) y lo abierto es idéntico.
// Al final, validarHoja en 0 y sin errores de la página.

import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync } from "node:zlib";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Contacto auxiliar NC";

const N = ["n", "KeyN", 78];
const S = ["s", "KeyS", 83];
const O = ["o", "KeyO", 79];
const Z = ["z", "KeyZ", 90];
const ENTER = ["Enter", "Enter", 13];
const CAMPO = "#prop-etiqueta";
const NOTAS = "#prop-etiqueta-nota";
const DIALOGO = '[role="dialog"][aria-modal="true"]';
const ETIQUETAR_VACIOS = "Etiquetar los vacíos";
const TIPO_NC = "contactor.auxiliar_nc";
const TIPO_NA = "contactor.auxiliar_na";

export default async function (p, comprobar, { cargar }) {
  const { buscarSimbolo } = await cargar("/src/core/symbols/biblioteca.ts");
  const carpeta = mkdtempSync(join(tmpdir(), "bornera-descargas-"));
  const archivos = mkdtempSync(join(tmpdir(), "bornera-archivos-"));
  await p.descargasEn(carpeta);
  try {
    await probar(p, comprobar, buscarSimbolo, carpeta, archivos);
  } finally {
    await p.interceptarSelector(false).catch(() => undefined);
    await p.descargasEn(null).catch(() => undefined);
    for (const c of [carpeta, archivos]) rmSync(c, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

async function probar(p, comprobar, buscarSimbolo, carpeta, archivos) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods);
  const hojaJSON = () => p.evaluar("JSON.stringify(bornera.editor.documento.hojas)");
  const hoja = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento.hojas[0]))");
  const pasos = () => p.evaluar("bornera.editor.historial.hechos.length");
  const problemas = () => p.evaluar("bornera.cables.validarHoja(bornera.editor.documento.hojas[0]).length");
  const etiqueta = (id) => p.evaluar(`bornera.editor.documento.hojas[0].componentes.find((c) => c.id === ${JSON.stringify(id)})?.etiqueta ?? null`);
  const notas = () => p.evaluar(`[...document.querySelectorAll("${NOTAS} .nota")].map((e) => e.textContent.trim())`);
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
  const items = () =>
    p.evaluar(`[...document.querySelectorAll(".item")].map((e) => { const r = e.getBoundingClientRect();
      return { texto: e.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`);
  /** Selecciona un componente y escribe su etiqueta en el panel con Enter. */
  const escribirEtiqueta = async (id, texto) => {
    await seleccionar([id]);
    await p.esperarA(`!!document.querySelector("${CAMPO}")`, 5000);
    await esperar(150);
    const k = await p.caja(CAMPO);
    await p.clic({ x: k.cx, y: k.cy });
    await p.evaluar(`document.querySelector("${CAMPO}").select()`);
    if (texto !== "") await p.cdp("Input.insertText", { text: texto });
    await tecla(ENTER);
    await esperar(60);
  };
  const componentes = async () => (await hoja()).componentes;
  const porId = (lista) => Object.fromEntries(lista.map((c) => [c.id, c.etiqueta]));
  const soltarFuera = () => p.evaluar(`document.activeElement?.blur()`);

  // ── 1. Paleta ──
  const lista = await items();
  const textos = lista.map((i) => i.texto);
  const iNA = textos.indexOf("Contacto auxiliar NA");
  const iNC = textos.indexOf("Contacto auxiliar NC");
  comprobar("la paleta tiene 32 ítems (T36: los de mando)", lista.length === 32, textos.join(", "));
  comprobar("«Contacto auxiliar NC» está justo después de «Contacto auxiliar NA»", iNA >= 0 && iNC === iNA + 1, textos.join(", "));
  await p.captura("paleta");

  // ── 2. Arrastrar al lienzo ──
  const lienzo = await p.caja("canvas[aria-label^=Lienzo]");
  const nPasos = await pasos();
  await p.arrastrar(lista[iNC], { x: lienzo.cx - 100, y: lienzo.cy });
  await esperar(80);
  let cs = await componentes();
  const nc = cs[0];
  comprobar(
    "arrastrar el NC al lienzo: un componente, de tipo NC, vacío, en un paso",
    cs.length === 1 && nc?.tipo === TIPO_NC && nc.etiqueta === "" && (await pasos()) === nPasos + 1,
    JSON.stringify({ cs: cs.length, tipo: nc?.tipo, etiqueta: nc?.etiqueta, pasos: (await pasos()) - nPasos }),
  );
  const def = buscarSimbolo(TIPO_NC);
  comprobar(
    "sus bornes son 21 y 22",
    JSON.stringify(def?.bornes.map((b) => b.nombre)) === JSON.stringify(["21", "22"]),
    JSON.stringify(def?.bornes.map((b) => b.nombre)),
  );
  // Un cable sale de cada borne: la app los reconoce como bornes de ese contacto.
  for (const borne of ["21", "22"]) {
    await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
      editor.ejecutar(c.cablear(editor.documento, { desde: { tipo: "borne", comp: "${nc.id}", borne: "${borne}" },
        hasta: { tipo: "libre", x: ${nc.x + 6}, y: ${nc.y + (borne === "21" ? -2 : 2)} }, codos: [] })); })()`);
  }
  comprobar("un cable sale de 21 y otro de 22, y validarHoja da 0", (await hoja()).cables.length === 2 && (await problemas()) === 0);
  await p.captura("nc-arrastrado");

  // ── 3. Renombrar la bobina: arrastra al NA y al NC ──
  await nuevo();
  await camara(0.6, 6, 6);
  const bobina = await colocar("contactor.bobina", 0, 0, "K1");
  const na = await colocar(TIPO_NA, 6, 0, "");
  const ncR = await colocar(TIPO_NC, 12, 0, "");
  // Los contactos entran vacíos: se les escribe "K1" a mano.
  await escribirEtiqueta(na, "K1");
  await escribirEtiqueta(ncR, "K1");
  await soltarFuera();
  comprobar(
    "el NA y el NC reciben K1 a mano en el panel",
    (await etiqueta(na)) === "K1" && (await etiqueta(ncR)) === "K1" && (await etiqueta(bobina)) === "K1",
    JSON.stringify(porId(await componentes())),
  );
  let docAntes = await hojaJSON();
  let n = await pasos();
  await escribirEtiqueta(bobina, "K5");
  const notaDos = await notas();
  comprobar(
    "renombrar la bobina K1 a K5: el NA y el NC pasan a K5, en un paso, con «2 contactos pasaron a K5.»",
    (await etiqueta(bobina)) === "K5" && (await etiqueta(na)) === "K5" && (await etiqueta(ncR)) === "K5" &&
      (await pasos()) === n + 1 && notaDos.includes("2 contactos pasaron a K5."),
    JSON.stringify({ etiquetas: porId(await componentes()), notas: notaDos, pasos: (await pasos()) - n }),
  );
  await p.captura("nota-dos-contactos");
  await soltarFuera();
  await tecla(Z, CTRL);
  comprobar("un Ctrl+Z vuelve la bobina, el NA y el NC a K1", (await hojaJSON()) === docAntes && (await pasos()) === n);

  // Solo el NC enlazado: «1 contacto pasó a K5.».
  await nuevo();
  await camara(0.6, 6, 6);
  const bobina2 = await colocar("contactor.bobina", 0, 0, "K1");
  const nc2 = await colocar(TIPO_NC, 6, 0, "");
  await escribirEtiqueta(nc2, "K1");
  await soltarFuera();
  docAntes = await hojaJSON();
  n = await pasos();
  await escribirEtiqueta(bobina2, "K5");
  const notaUno = await notas();
  comprobar(
    "con solo el NC enlazado: pasa a K5, en un paso, con «1 contacto pasó a K5.»",
    (await etiqueta(bobina2)) === "K5" && (await etiqueta(nc2)) === "K5" && (await pasos()) === n + 1 && notaUno.includes("1 contacto pasó a K5."),
    JSON.stringify({ etiquetas: porId(await componentes()), notas: notaUno, pasos: (await pasos()) - n }),
  );
  await soltarFuera();
  await tecla(Z, CTRL);
  comprobar("un Ctrl+Z vuelve la bobina y el NC a K1", (await hojaJSON()) === docAntes && (await pasos()) === n);

  // ── 4. «Etiquetar los vacíos» no toca al NC ──
  await nuevo();
  const v = {
    pulsador: await colocar("pulsador.nc", 0, 0, ""),
    bobina: await colocar("contactor.bobina", 4, 0, ""),
    nc: await colocar(TIPO_NC, 8, 0, ""),
  };
  await seleccionar([]);
  await esperar(150);
  await camara(1, 6, 3);
  const b = await boton(ETIQUETAR_VACIOS);
  comprobar("sin selección, «Etiquetar los vacíos» está habilitado", b !== null && !b.deshabilitado, JSON.stringify(b));
  docAntes = await hojaJSON();
  n = await pasos();
  await p.clic(b);
  await esperar(60);
  const tras = porId(await componentes());
  comprobar(
    "«Etiquetar los vacíos»: S0 (pulsador NC, T27) y K1 en un paso, y el NC auxiliar queda vacío",
    (await pasos()) === n + 1 && tras[v.pulsador] === "S0" && tras[v.bobina] === "K1" && tras[v.nc] === "",
    JSON.stringify(tras),
  );
  await p.captura("etiquetar-vacios");
  await tecla(Z, CTRL);
  comprobar("un Ctrl+Z deshace «Etiquetar los vacíos»", (await hojaJSON()) === docAntes && (await pasos()) === n);

  // ── 5. Guardar y reabrir ──
  await nuevo();
  await camara(0.6, 6, 6);
  const k1 = await colocar("contactor.bobina", 0, 0, "K1");
  const ncG = await colocar(TIPO_NC, 6, 0, "");
  await escribirEtiqueta(ncG, "K1");
  await soltarFuera();
  await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
    editor.ejecutar(c.cablear(editor.documento, { desde: { tipo: "borne", comp: "${ncG}", borne: "21" }, hasta: { tipo: "libre", x: 12, y: -2 }, codos: [] })); })()`);
  const documento = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento))");
  await tecla(S, CTRL);
  const bytes = await esperarDescarga(carpeta);
  comprobar("Ctrl+S descarga el circuito", bytes !== null);
  if (bytes) {
    const guardado = JSON.parse(gunzipSync(bytes).toString("utf8"));
    const enArchivo = guardado.hojas?.[0]?.componentes?.find((c) => c.id === ncG);
    comprobar(
      "en el archivo, el NC lleva su tipo y la etiqueta K1",
      enArchivo?.tipo === TIPO_NC && enArchivo.etiqueta === "K1" && !!k1,
      JSON.stringify(enArchivo),
    );
    const ruta = join(archivos, "NC.brn");
    writeFileSync(ruta, bytes);
    await p.interceptarSelector();
    await nuevo();
    await p.evaluar("bornera.editor.__anterior = true");
    p.elegirArchivo(ruta);
    await tecla(O, CTRL);
    await p.esperarA("bornera.editor.__anterior !== true", 5000);
    await esperar(100);
    const abierto = await documento();
    comprobar("lo reabierto es idéntico a lo guardado", isDeepStrictEqual(abierto, guardado));
    const ncA = (await componentes()).find((c) => c.tipo === TIPO_NC);
    comprobar(
      "el NC reabierto sigue en K1, con el cable en su borne 21 y sin pasos en el historial",
      ncA?.etiqueta === "K1" && (await hoja()).cables.some((w) => w.desde.comp === ncA.id && w.desde.borne === "21") && (await pasos()) === 0,
      JSON.stringify(ncA),
    );
    await p.captura("reabierto");
  }

  comprobar("al final: validarHoja en 0", (await problemas()) === 0);
  comprobar("sin errores de la página hasta acá", p.errores.length === 0, p.errores.join(" | "));
}

/** Espera una descarga terminada, la lee y vacía la carpeta (null si no llega). */
async function esperarDescarga(carpeta, ms = 8000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const todos = readdirSync(carpeta);
    const listos = todos.filter((f) => !f.endsWith(".crdownload") && !f.endsWith(".tmp"));
    if (listos.length > 0 && listos.length === todos.length) {
      await esperar(100);
      const bytes = readFileSync(join(carpeta, listos[0]));
      for (const f of readdirSync(carpeta)) rmSync(join(carpeta, f), { force: true });
      return bytes;
    }
    await esperar(100);
  }
  return null;
}
