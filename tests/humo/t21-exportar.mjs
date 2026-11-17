// T21: Exportar sin comprimir (.brn.json), D4-C.
//
// Los tres casos del plan, en el navegador (la descarga es el archivo):
// 1. Exportar descarga `X.brn.json`: texto plano por líneas que abre igual.
// 2. Exportar no cambia el archivo actual, la marca «•» ni el historial (con
//    cambios y sin cambios); el Ctrl+S siguiente sigue yendo al `.brn` con gzip.
// 3. Abrir ese `.brn.json` (también con CRLF, como lo deja Git en Windows) y
//    Ctrl+S lo vuelve a escribir por líneas y sin comprimir.
// Además: el botón entra en la barra a 1024×600 y no tiene atajo.

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync } from "node:zlib";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Exportar sin comprimir (.brn.json)";

const S = ["s", "KeyS", 83];
const O = ["o", "KeyO", 79];
const EXPORTAR = "Exportar sin comprimir (.brn.json)";

export default async function (p, comprobar) {
  const carpeta = mkdtempSync(join(tmpdir(), "bornera-descargas-"));
  const archivos = mkdtempSync(join(tmpdir(), "bornera-archivos-"));
  await p.descargasEn(carpeta);
  try {
    await probar(p, comprobar, carpeta, archivos);
  } finally {
    await p.interceptarSelector(false).catch(() => undefined);
    await p.descargasEn(null).catch(() => undefined);
    for (const c of [carpeta, archivos]) rmSync(c, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

async function probar(p, comprobar, carpeta, archivos) {
  const tecla = ([key, code, w], mods = 0) => p.tecla(key, code, w, mods);
  const titulo = () => p.evaluar("document.title");
  const aviso = () => p.evaluar(`document.querySelector(".avisos").textContent.trim()`);
  const documento = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento))");
  const hechos = () => p.evaluar("bornera.editor.historial.hechos.length");
  const deshechos = () => p.evaluar("bornera.editor.historial.deshechos?.length ?? null");
  const activado = (etiqueta) => p.evaluar(`!document.querySelector('button[aria-label="${etiqueta}"]').disabled`);
  const apretar = async (etiqueta) => {
    const k = await p.caja(`button[aria-label="${etiqueta}"]`);
    await p.clic({ x: k.cx, y: k.cy });
  };
  const colocar = (tipo, x, y, etiqueta) =>
    p.evaluar(`(() => { const { editor, comandos: c } = bornera;
      const cmd = c.colocar(editor.documento, { tipo: "${tipo}", x: ${x}, y: ${y}, rot: 0, espejado: false, etiqueta: ${JSON.stringify(etiqueta)}, params: {} });
      editor.ejecutar(cmd); return cmd.id; })()`);
  const terminados = () => readdirSync(carpeta).filter((f) => !f.endsWith(".crdownload") && !f.endsWith(".tmp"));
  /** Espera una descarga, la lee y vacía la carpeta. */
  const descarga = async (ms = 8000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const listos = terminados();
      if (listos.length > 0 && listos.length === readdirSync(carpeta).length) {
        await esperar(100);
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
  const marcarEditor = () => p.evaluar("bornera.editor.__anterior = true");
  const editorNuevo = () => p.esperarA("bornera.editor.__anterior !== true", 5000);
  const abrirCon = async (ruta) => {
    await marcarEditor();
    p.elegirArchivo(ruta);
    await tecla(O, CTRL);
    await editorNuevo();
  };
  /** El texto por líneas: sin BOM ni gzip, con \n y sin \r; devuelve las líneas (sin la vacía del final). */
  const lineasDe = (bytes) => {
    const texto = bytes.toString("utf8");
    const ok = bytes[0] !== 0xef && !(bytes[0] === 0x1f && bytes[1] === 0x8b) && !texto.includes("\r") && texto.endsWith("]}\n");
    return ok ? texto.slice(0, -1).split("\n") : null;
  };

  // ── El botón: en la barra, activo y dentro de 1024×600 ──
  const boton = await p.caja(`button[aria-label="${EXPORTAR}"]`);
  const barra = await p.evaluar(`(() => { const b = document.querySelector(".barra"); return { ancho: b.scrollWidth, visible: b.clientWidth }; })()`);
  comprobar(
    "el botón Exportar está activo, entra en la ventana y la barra no desborda",
    (await activado(EXPORTAR)) && boton.x >= 0 && boton.x + boton.ancho <= 1024 && barra.ancho <= barra.visible,
    JSON.stringify({ boton, barra }),
  );
  comprobar(
    "su título dice «Exportar sin comprimir (.brn.json)…», sin atajo",
    (await p.evaluar(`document.querySelector('button[aria-label="${EXPORTAR}"]').title`)) === "Exportar sin comprimir (.brn.json)…",
  );

  // ── Un circuito guardado (archivo actual «Sin título.brn») ──
  const k1 = await colocar("contactor.bobina", 0, 0, "Señal");
  await colocar("pulsador.na", 10, 0, "S1");
  await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
    editor.ejecutar(c.cablear(editor.documento, { desde: { tipo: "borne", comp: "${k1}", borne: "A1" }, hasta: { tipo: "libre", x: 0, y: -6 }, codos: [] })); })()`);
  await tecla(S, CTRL);
  let d = await descarga();
  comprobar("Ctrl+S guarda «Sin título.brn»", d?.nombre === "Sin título.brn");

  // ── Caso 2 (sin cambios): Exportar no pone la marca ──
  await apretar(EXPORTAR);
  d = await descarga();
  comprobar("sin cambios: Exportar descarga «Sin título.brn.json»", d?.nombre === "Sin título.brn.json" && d.otras === 0, d?.nombre);
  comprobar("sin cambios: el título sigue sin la marca", (await titulo()) === "Sin título.brn — Bornera", await titulo());

  // ── Con cambios: la marca, el historial y el archivo actual siguen igual ──
  await colocar("senalizacion.lampara", 20, 0, "H1");
  const tituloAntes = await titulo();
  const hechosAntes = await hechos();
  const deshechosAntes = await deshechos();
  comprobar("con cambios, el título lleva la marca", tituloAntes === "• Sin título.brn — Bornera", tituloAntes);
  await apretar(EXPORTAR);
  d = await descarga();
  comprobar("Exportar descarga «Sin título.brn.json»", d?.nombre === "Sin título.brn.json" && d.otras === 0, d?.nombre);
  if (!d) return;

  // ── Caso 1: texto plano por líneas que abre igual ──
  const lineas = lineasDe(d.bytes);
  comprobar("es texto UTF-8 sin BOM ni gzip, con \\n (sin \\r) y un \\n al final", lineas !== null);
  if (!lineas) return;
  const doc = await documento();
  const objetos = doc.hojas[0].componentes.length + doc.hojas[0].cables.length;
  comprobar(
    "un componente o cable por línea (meta, contadores y hoja en las suyas)",
    lineas[0] === '{"formato":"bornera","version":1,' &&
      lineas[1].startsWith('"meta":') &&
      lineas[2].startsWith('"contadores":') &&
      lineas.filter((l) => l.startsWith('{"id":')).length === objetos &&
      lineas.length === 4 + 1 + 2 + doc.hojas[0].componentes.length + 2 + doc.hojas[0].cables.length + 1,
    lineas.slice(0, 6).join(" ⏎ "),
  );
  comprobar("lo exportado es el documento (con la tilde)", isDeepStrictEqual(JSON.parse(d.bytes.toString("utf8")), doc) && lineas.some((l) => l.includes("Señal")));
  comprobar("el aviso dice «Exportado sin comprimir» y el tiempo", /^Exportado sin comprimir en \d+ ms$/.test(await aviso()), await aviso());
  comprobar("Exportar no cambia el título ni la marca", (await titulo()) === tituloAntes, await titulo());
  comprobar(
    "Exportar no cambia el historial",
    (await hechos()) === hechosAntes && (await deshechos()) === deshechosAntes && (await activado("Deshacer")),
    `${await hechos()} / ${hechosAntes}`,
  );
  const exportado = join(archivos, "Sin título.brn.json");
  writeFileSync(exportado, d.bytes);

  // El Ctrl+S siguiente sigue yendo al .brn con gzip.
  await tecla(S, CTRL);
  d = await descarga();
  comprobar(
    "después, Ctrl+S sigue guardando «Sin título.brn» con gzip",
    d?.nombre === "Sin título.brn" && d.bytes[0] === 0x1f && d.bytes[1] === 0x8b && isDeepStrictEqual(JSON.parse(gunzipSync(d.bytes).toString("utf8")), doc),
    d?.nombre,
  );
  comprobar("y queda guardado (sin marca)", (await titulo()) === "Sin título.brn — Bornera", await titulo());

  // ── Caso 1 (cont.): el .brn.json abre igual ──
  await p.interceptarSelector();
  await abrirCon(exportado);
  comprobar("Abrir el .brn.json: idéntico a lo exportado", isDeepStrictEqual(await documento(), doc));
  comprobar("el título es «Sin título.brn.json — Bornera»", (await titulo()) === "Sin título.brn.json — Bornera", await titulo());

  // ── Caso 3: Ctrl+S sobre el .brn.json lo escribe sin comprimir ──
  await colocar("pulsador.nc", 30, 0, "S0");
  comprobar("con un cambio, vuelve la marca", (await titulo()) === "• Sin título.brn.json — Bornera", await titulo());
  await tecla(S, CTRL);
  d = await descarga();
  comprobar("Ctrl+S descarga «Sin título.brn.json»", d?.nombre === "Sin título.brn.json", d?.nombre);
  const despues = d && lineasDe(d.bytes);
  comprobar(
    "por líneas, sin comprimir, y es el documento con el cambio",
    despues !== null && despues !== undefined && isDeepStrictEqual(JSON.parse(d.bytes.toString("utf8")), await documento()) && despues.some((l) => l.includes('"S0"')),
  );
  comprobar("queda guardado (sin marca)", (await titulo()) === "Sin título.brn.json — Bornera", await titulo());
  comprobar("el aviso dice «Guardado sin comprimir»", /^Guardado sin comprimir en \d+ ms$/.test(await aviso()), await aviso());

  // ── Git en Windows: el mismo archivo con CRLF abre igual, y se vuelve a escribir con \n ──
  const crlf = join(archivos, "Con CRLF.brn.json");
  writeFileSync(crlf, readFileSync(exportado, "utf8").replaceAll("\n", "\r\n"));
  await abrirCon(crlf);
  comprobar("un .brn.json con CRLF abre idéntico", isDeepStrictEqual(await documento(), doc));
  await colocar("pulsador.nc", 40, 0, "S9");
  await tecla(S, CTRL);
  d = await descarga();
  comprobar("Ctrl+S lo vuelve a escribir con \\n", d?.nombre === "Con CRLF.brn.json" && lineasDe(d.bytes) !== null, d?.nombre);

  comprobar("no quedó ninguna respuesta de selector sin usar", p.respuestasPendientes === 0, `${p.respuestasPendientes}`);
}
