// T15a: guardar .brn en el navegador (etapa 3a: Guardar y Guardar como).
// Guardar en el navegador es una descarga: se lee en Node, se descomprime y
// se compara con el documento de la página. Ctrl+S con el foco en el campo
// del panel guarda lo escrito; la tecla mantenida guarda una sola vez; con un
// modal abierto no guarda; D22-B no escribe un documento que no abriría; el
// título lleva el nombre y la marca de cambios; Simular guarda; una escena
// del banco se guarda sin tocar el documento, y una escena sin editor no se
// guarda. `beforeunload` pregunta solo con cambios.
// Abrir y Nuevo se suman en la etapa 3b.

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync } from "node:zlib";
import { CTRL, esperar, MAYUS } from "./cdp.mjs";

export const nombre = "Guardar .brn";

const S = ["s", "KeyS", 83];
const S_MAYUS = ["S", "KeyS", 83];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];
const B = ["B", "KeyB", 66];
const F5 = ["F5", "F5", 116];
const CAMPO = "#prop-etiqueta";
const DIALOGO = '[role="dialog"][aria-modal="true"]';

export default async function (p, comprobar) {
  const carpeta = mkdtempSync(join(tmpdir(), "bornera-descargas-"));
  await p.descargasEn(carpeta);
  try {
    await probar(p, comprobar, carpeta);
  } finally {
    await p.descargasEn(null).catch(() => undefined);
    rmSync(carpeta, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

async function probar(p, comprobar, carpeta) {
  const tecla = ([key, code, w], mods = 0) => p.tecla(key, code, w, mods);
  const titulo = () => p.evaluar("document.title");
  const aviso = () => p.evaluar(`document.querySelector(".avisos").textContent.trim()`);
  const documento = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento))");
  const activado = (etiqueta) => p.evaluar(`!document.querySelector('button[aria-label="${etiqueta}"]').disabled`);
  const apretar = async (etiqueta) => {
    const k = await p.caja(`button[aria-label="${etiqueta}"]`);
    await p.clic({ x: k.cx, y: k.cy });
  };
  const colocar = (tipo, x, y, etiqueta) =>
    p.evaluar(`(() => { const { editor, comandos: c } = bornera;
      const cmd = c.colocar(editor.documento, { tipo: "${tipo}", x: ${x}, y: ${y}, rot: 0, espejado: false, etiqueta: ${JSON.stringify(etiqueta)}, params: {} });
      editor.ejecutar(cmd); return cmd.id; })()`);
  const dialogo = () =>
    p.evaluar(`(() => { const d = [...document.querySelectorAll('${DIALOGO}')]; if (d.length === 0) return null;
      const r = d[0].getBoundingClientRect();
      return { cuantos: d.length, titulo: d[0].querySelector("h2")?.textContent.trim(), lineas: [...d[0].querySelectorAll("li")].map((l) => l.textContent.trim()),
        dentro: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; })()`);

  /** Archivos terminados de la carpeta de descargas (sin los parciales de Chrome). */
  const terminados = () => readdirSync(carpeta).filter((f) => !f.endsWith(".crdownload") && !f.endsWith(".tmp"));
  /** Espera una descarga, la lee y vacía la carpeta. */
  const descarga = async (ms = 8000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const listos = terminados();
      if (listos.length > 0 && listos.length === readdirSync(carpeta).length) {
        await esperar(100); // que termine de escribir
        const nombre = listos[0];
        const bytes = readFileSync(join(carpeta, nombre));
        const otras = listos.length - 1;
        for (const f of readdirSync(carpeta)) rmSync(join(carpeta, f), { force: true });
        return { nombre, bytes, otras };
      }
      await esperar(100);
    }
    return null;
  };
  /** No hubo ninguna descarga en `ms`. */
  const ninguna = async (ms = 800) => {
    await esperar(ms);
    const hay = readdirSync(carpeta);
    for (const f of hay) rmSync(join(carpeta, f), { force: true });
    return hay.length === 0;
  };
  const leer = (bytes) => JSON.parse(gunzipSync(bytes).toString("utf8"));

  // ── Inicio ──
  comprobar("documento nuevo: el título es «Sin título — Bornera»", (await titulo()) === "Sin título — Bornera", await titulo());
  comprobar("Guardar y Guardar como están activos", (await activado("Guardar")) && (await activado("Guardar como")));

  // ── Armar un circuito: dos componentes (una etiqueta con tilde) y un cable ──
  const k1 = await colocar("contactor.bobina", 0, 0, "Señal");
  await colocar("pulsador.na", 10, 0, "S1");
  await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
    editor.ejecutar(c.cablear(editor.documento, { desde: { tipo: "borne", comp: "${k1}", borne: "A1" }, hasta: { tipo: "libre", x: 0, y: -6 }, codos: [] })); })()`);
  comprobar("con cambios, el título lleva la marca", (await titulo()) === "• Sin título — Bornera", await titulo());

  // ── Ctrl+S: descarga, la lee Node y es el documento ──
  await tecla(S, CTRL);
  let d = await descarga();
  comprobar("Ctrl+S descarga «Sin título.brn»", d?.nombre === "Sin título.brn" && d.otras === 0, JSON.stringify(d && { nombre: d.nombre, otras: d.otras }));
  if (!d) return;
  comprobar("el archivo es gzip (1f 8b)", d.bytes[0] === 0x1f && d.bytes[1] === 0x8b);
  const texto = gunzipSync(d.bytes).toString("utf8");
  comprobar("adentro, JSON compacto en forma canónica", texto.startsWith('{"formato":"bornera","version":1,"meta":{') && !texto.includes("\n"), texto.slice(0, 60));
  comprobar("lo guardado es el documento (con la tilde)", isDeepStrictEqual(JSON.parse(texto), await documento()) && texto.includes("Señal"));
  comprobar("guardado: el título lleva el nombre y no la marca", (await titulo()) === "Sin título.brn — Bornera", await titulo());
  comprobar("el aviso dice el tiempo", /^Guardado en \d+ ms$/.test(await aviso()), await aviso());
  comprobar("Guardar no toca el historial: Deshacer sigue activo", await activado("Deshacer"));

  // ── Deshacer hasta el punto guardado ──
  await tecla(Z, CTRL);
  comprobar("Ctrl+Z después de guardar: vuelve la marca", (await titulo()) === "• Sin título.brn — Bornera", await titulo());
  await tecla(Y, CTRL);
  comprobar("Ctrl+Y hasta lo guardado: sin marca", (await titulo()) === "Sin título.brn — Bornera", await titulo());

  // ── Ctrl+S con el foco en el campo del panel: guarda lo escrito ──
  await p.evaluar(`bornera.activo().seleccionarIds(["${k1}"])`);
  await esperar(250); // el panel se abre solo
  const campo = await p.caja(CAMPO);
  await p.clic({ x: campo.cx, y: campo.cy });
  await p.evaluar(`document.querySelector("${CAMPO}").select()`);
  // El panel acepta solo letras sin tilde, números y - _ . + / = : (validarEtiqueta).
  await p.cdp("Input.insertText", { text: "K2" });
  const pasosAntes = await p.evaluar("bornera.editor.historial.hechos.length");
  await tecla(S, CTRL);
  d = await descarga();
  const etiquetaGuardada = d && leer(d.bytes).hojas[0].componentes.find((c) => c.id === k1)?.etiqueta;
  comprobar("Ctrl+S en el campo: se guarda lo escrito", etiquetaGuardada === "K2", etiquetaGuardada);
  comprobar(
    "lo escrito entra en un paso y queda guardado (sin marca)",
    (await p.evaluar("bornera.editor.historial.hechos.length")) === pasosAntes + 1 && (await titulo()) === "Sin título.brn — Bornera",
    await titulo(),
  );

  // ── Tecla mantenida: una sola descarga ──
  await p.teclaMantenida(...S, CTRL, 4);
  d = await descarga();
  comprobar("Ctrl+S mantenida guarda una sola vez", d !== null && d.otras === 0 && (await ninguna()));

  // ── Botones ──
  await apretar("Guardar como");
  d = await descarga();
  comprobar("el botón Guardar como descarga", d?.nombre === "Sin título.brn");
  await apretar("Guardar");
  d = await descarga();
  comprobar("el botón Guardar descarga", d?.nombre === "Sin título.brn");
  await tecla(S_MAYUS, CTRL | MAYUS);
  d = await descarga();
  comprobar("Ctrl+Mayús+S descarga", d?.nombre === "Sin título.brn");

  // ── D22-B: un documento que no abriría no se guarda ──
  await colocar("contactor.bobina", 20000, 0, "Lejos");
  await tecla(S, CTRL);
  const dlg = await dialogo();
  comprobar("D22-B: sale «No se puede guardar»", dlg?.titulo === "No se puede guardar", JSON.stringify(dlg));
  comprobar("el diálogo dice dónde y qué", /^hojas\[0\]\.componentes\[\d+\]\.x: /.test(dlg?.lineas[0] ?? ""), dlg?.lineas[0]);
  comprobar("el diálogo entra en 1024×600", dlg?.dentro === true);
  comprobar("no se descargó nada y sigue la marca", (await ninguna()) && (await titulo()).startsWith("• "), await titulo());
  // Con el diálogo abierto, Ctrl+S no hace nada (ni abre otro).
  await tecla(S, CTRL);
  comprobar("con un modal abierto, Ctrl+S no hace nada", (await ninguna()) && (await dialogo())?.cuantos === 1);
  await p.esc();
  comprobar("Esc cierra el diálogo", (await dialogo()) === null);
  await tecla(Z, CTRL);
  comprobar("deshacer lo de afuera del rango: vuelve a lo guardado", (await titulo()) === "Sin título.brn — Bornera", await titulo());

  // ── Simular: Guardar anda ──
  await tecla(F5);
  await tecla(S, CTRL);
  d = await descarga();
  comprobar("en Simular, Ctrl+S guarda", d?.nombre === "Sin título.brn");
  await tecla(F5);

  // ── Escena del banco: guarda la escena, sin tocar el documento ──
  await tecla(B, CTRL | MAYUS); // 100
  await p.esperarA("bornera.activo() !== bornera.editor");
  await tecla(S, CTRL);
  d = await descarga();
  const banco = d && leer(d.bytes);
  comprobar("en el banco, Ctrl+S guarda la escena", d?.nombre === "Banco de 100.brn" && banco?.hojas[0].componentes.length === 100, d?.nombre);
  comprobar("el documento no cambió de archivo ni de marca", (await titulo()) === "Sin título.brn — Bornera", await titulo());
  // 500, 2000, cables y vacía: una escena sin editor no se guarda.
  for (let i = 0; i < 4; i++) await tecla(B, CTRL | MAYUS);
  await p.esperarA("bornera.activo() === null");
  comprobar("en una escena sin editor, Guardar está desactivado", !(await activado("Guardar")) && !(await activado("Guardar como")));
  await tecla(S, CTRL);
  comprobar("y Ctrl+S no hace nada", await ninguna());
  await tecla(B, CTRL | MAYUS); // documento
  await p.esperarA("bornera.activo() === bornera.editor");

  // ── beforeunload: pregunta solo con cambios ──
  const url = await p.evaluar("location.href");
  await colocar("contactor.bobina", 0, 20, "K9");
  let salidas = p.salidasConCambios;
  await p.abrir(url);
  comprobar("recargar con cambios pregunta (beforeunload)", p.salidasConCambios === salidas + 1, `${p.salidasConCambios - salidas}`);
  await p.esc(); // un gesto: sin él, el navegador no preguntaría de todos modos
  salidas = p.salidasConCambios;
  await p.abrir(url);
  comprobar("recargar sin cambios no pregunta", p.salidasConCambios === salidas);
}
