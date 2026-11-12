// T15a: guardar y abrir .brn en el navegador.
//
// Guardar (etapa 3a): Guardar en el navegador es una descarga: se lee en
// Node, se descomprime y se compara con el documento de la página. Ctrl+S con
// el foco en el campo del panel guarda lo escrito; la tecla mantenida guarda
// una sola vez; con un modal abierto no guarda; D22-B no escribe un documento
// que no abriría; el título lleva el nombre y la marca de cambios; Simular
// guarda; una escena del banco se guarda sin tocar el documento, y una escena
// sin editor no se guarda. `beforeunload` pregunta solo con cambios.
//
// Abrir y Nuevo (etapa 3b): el selector de archivos se intercepta por CDP y
// se responde con un archivo del disco. Lo abierto es idéntico a lo guardado,
// con el historial vacío; Abrir fija el archivo actual; con cambios, el
// diálogo "¿Guardar los cambios?" (Esc y los tres botones); Nuevo por el
// botón y por Ctrl+N; un archivo dañado no toca el documento; Ctrl+O con el
// foco en el panel; tres Abrir seguidos no acumulan oyentes; tildes.brn
// (tildes, ñ y comillas) abre y se vuelve a escribir igual; en Simular y en
// el banco, Abrir y Nuevo no andan.

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync } from "node:zlib";
import { CTRL, esperar, MAYUS } from "./cdp.mjs";
import { AUTOR, ETIQUETA, ETIQUETA_2, NOMBRE as NOMBRE_TILDES, RUTA as RUTA_TILDES, TITULO } from "./datos/tildes.mjs";

export const nombre = "Guardar y abrir .brn";

const S = ["s", "KeyS", 83];
const S_MAYUS = ["S", "KeyS", 83];
const O = ["o", "KeyO", 79];
const N = ["n", "KeyN", 78];
const W = ["w", "KeyW", 87];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];
const B = ["B", "KeyB", 66];
const F5 = ["F5", "F5", 116];
const CAMPO = "#prop-etiqueta";
const DIALOGO = '[role="dialog"][aria-modal="true"]';

export default async function (p, comprobar) {
  const carpeta = mkdtempSync(join(tmpdir(), "bornera-descargas-"));
  const archivos = mkdtempSync(join(tmpdir(), "bornera-archivos-"));
  await p.descargasEn(carpeta);
  try {
    const h = ayudantes(p, carpeta);
    await probarGuardar(p, comprobar, h);
    await probarAbrir(p, comprobar, h, archivos);
  } finally {
    await p.interceptarSelector(false).catch(() => undefined);
    await p.descargasEn(null).catch(() => undefined);
    for (const c of [carpeta, archivos]) rmSync(c, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

function ayudantes(p, carpeta) {
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
      return { cuantos: d.length, titulo: d[0].querySelector("h2")?.textContent.trim(), texto: d[0].querySelector("p")?.textContent.trim() ?? "",
        lineas: [...d[0].querySelectorAll("li")].map((l) => l.textContent.trim()),
        foco: d[0].contains(document.activeElement) ? document.activeElement.textContent.trim() : null,
        dentro: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; })()`);
  /** Aprieta el botón del diálogo que dice `texto`. */
  const responder = async (texto) => {
    const k = await p.evaluar(`(() => { const b = [...document.querySelectorAll('${DIALOGO} button')].find((x) => x.textContent.trim() === ${JSON.stringify(texto)});
      if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!k) throw new Error(`No está el botón «${texto}» en el diálogo.`);
    await p.clic(k);
  };

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
  return { tecla, titulo, aviso, documento, activado, apretar, colocar, dialogo, responder, descarga, ninguna, leer };
}

async function probarGuardar(p, comprobar, h) {
  const { tecla, titulo, aviso, documento, activado, apretar, colocar, dialogo, descarga, ninguna, leer } = h;

  // ── Inicio: el título lleva el nombre que se sugiere al guardar ──
  comprobar("documento nuevo: el título es «Sin título.brn — Bornera»", (await titulo()) === "Sin título.brn — Bornera", await titulo());
  comprobar("Guardar y Guardar como están activos", (await activado("Guardar")) && (await activado("Guardar como")));

  // ── Armar un circuito: dos componentes (una etiqueta con tilde) y un cable ──
  const k1 = await colocar("contactor.bobina", 0, 0, "Señal");
  await colocar("pulsador.na", 10, 0, "S1");
  await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
    editor.ejecutar(c.cablear(editor.documento, { desde: { tipo: "borne", comp: "${k1}", borne: "A1" }, hasta: { tipo: "libre", x: 0, y: -6 }, codos: [] })); })()`);
  comprobar("con cambios, el título lleva la marca", (await titulo()) === "• Sin título.brn — Bornera", await titulo());

  // ── Ctrl+S: descarga, la lee Node y es el documento ──
  await tecla(S, CTRL);
  let d = await descarga();
  comprobar("Ctrl+S descarga «Sin título.brn» (el nombre del título)", d?.nombre === "Sin título.brn" && d.otras === 0, JSON.stringify(d && { nombre: d.nombre, otras: d.otras }));
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
  // Recargar borra los errores anotados: se miran antes.
  comprobar("sin errores en la página (Guardar)", p.errores.length === 0, p.errores.join(" | "));
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

async function probarAbrir(p, comprobar, h, archivos) {
  const { tecla, titulo, aviso, documento, activado, apretar, colocar, dialogo, responder, descarga, ninguna, leer } = h;
  await p.interceptarSelector();

  const hayDialogo = () => p.esperarA(`document.querySelector('${DIALOGO}') !== null`, 5000);
  const sinDialogo = () => p.esperarA(`document.querySelector('${DIALOGO}') === null`, 5000);
  /** Abrir y Nuevo ponen un editor nuevo: se marca el de ahora y se espera a que cambie. */
  const marcarEditor = () => p.evaluar("bornera.editor.__anterior = true");
  const editorNuevo = () => p.esperarA("bornera.editor.__anterior !== true", 5000);
  /** Ctrl+O (sin cambios) eligiendo `ruta`, y espera al documento nuevo. */
  const abrirCon = async (ruta) => {
    await marcarEditor();
    p.elegirArchivo(ruta);
    await tecla(O, CTRL);
    await editorNuevo();
  };
  const componentes = () => p.evaluar("bornera.editor.documento.hojas[0].componentes.length");
  /** Oyentes de la ventana y del lienzo (para ver que no se acumulan). */
  const oyentes = async () => {
    const cuenta = async (expresion) => {
      const { result } = await p.cdp("Runtime.evaluate", { expression: expresion });
      const { listeners } = await p.cdp("DOMDebugger.getEventListeners", { objectId: result.objectId });
      await p.cdp("Runtime.releaseObject", { objectId: result.objectId });
      return listeners.length;
    };
    return { ventana: await cuenta("window"), lienzo: await cuenta('document.querySelector("canvas")') };
  };

  comprobar("en Editar, Nuevo y Abrir están activos", (await activado("Nuevo")) && (await activado("Abrir")));

  // ── Un circuito guardado en el disco: Marcha.brn ──
  const k1 = await colocar("contactor.bobina", 0, 0, "K1");
  await colocar("pulsador.na", 10, 0, "S1");
  await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
    editor.ejecutar(c.cablear(editor.documento, { desde: { tipo: "borne", comp: "${k1}", borne: "A1" }, hasta: { tipo: "libre", x: 0, y: -6 }, codos: [] })); })()`);
  await tecla(S, CTRL);
  let d = await descarga();
  comprobar("Ctrl+S descarga el circuito", d !== null);
  if (!d) return;
  const marcha = join(archivos, "Marcha.brn");
  writeFileSync(marcha, d.bytes);
  const esperado = leer(d.bytes);

  // ── Nuevo por el botón, sin cambios: sin diálogo ──
  await marcarEditor();
  await apretar("Nuevo");
  await editorNuevo();
  comprobar("Nuevo sin cambios: sin diálogo y documento vacío", (await dialogo()) === null && (await componentes()) === 0);
  comprobar("sin archivo actual: «Sin título.brn — Bornera»", (await titulo()) === "Sin título.brn — Bornera", await titulo());
  comprobar("historial vacío: Deshacer desactivado", !(await activado("Deshacer")));

  // ── Ctrl+O: abre lo guardado, idéntico ──
  const selectores = p.selectoresAbiertos;
  await abrirCon(marcha);
  comprobar("Ctrl+O abre el selector una vez", p.selectoresAbiertos === selectores + 1, `${p.selectoresAbiertos - selectores}`);
  comprobar("lo abierto es idéntico a lo guardado", isDeepStrictEqual(await documento(), esperado));
  comprobar(
    "historial vacío y sin la marca: «Marcha.brn — Bornera»",
    !(await activado("Deshacer")) && (await p.evaluar("bornera.editor.historial.hechos.length")) === 0 && (await titulo()) === "Marcha.brn — Bornera",
    await titulo(),
  );
  comprobar("bornera.editor es el editor nuevo, el que se ve", await p.evaluar("bornera.editor === bornera.activo()"));
  await p.esperarA(`/^Abierto/.test(document.querySelector(".avisos").textContent.trim())`, 5000);
  comprobar("el aviso dice el tiempo hasta el primer cuadro", /^Abierto en \d+ ms$/.test(await aviso()), await aviso());

  // ── Abrir fija el archivo actual: Ctrl+S guarda en Marcha.brn ──
  await colocar("contactor.bobina", 0, 20, "K2");
  await tecla(S, CTRL);
  d = await descarga();
  comprobar("después de Abrir, Ctrl+S guarda en «Marcha.brn» (no en «Sin título.brn»)", d?.nombre === "Marcha.brn", d?.nombre);

  // ── Con cambios, Abrir pregunta ──
  await colocar("contactor.bobina", 0, 30, "K3");
  const conCambios = await documento();
  const antesDialogo = p.selectoresAbiertos;
  await tecla(O, CTRL);
  await hayDialogo();
  let dlg = await dialogo();
  comprobar(
    "con cambios, Ctrl+O muestra «¿Guardar los cambios?» con el nombre",
    dlg?.titulo === "¿Guardar los cambios?" && dlg.texto === "«Marcha.brn» tiene cambios sin guardar.",
    JSON.stringify(dlg),
  );
  comprobar("el foco arranca en Guardar", dlg?.foco === "Guardar", dlg?.foco);
  comprobar("el diálogo entra en 1024×600", dlg?.dentro === true);
  await tecla(B, CTRL | MAYUS);
  await esperar(100);
  comprobar("con el diálogo abierto, Ctrl+Mayús+B no cambia de escena", await p.evaluar("bornera.activo() === bornera.editor"));
  await tecla(O, CTRL);
  comprobar("con el diálogo abierto, Ctrl+O no abre otro", (await dialogo())?.cuantos === 1);
  await p.esc();
  await sinDialogo();
  comprobar(
    "Esc es Cancelar: no se abre el selector y el documento sigue",
    p.selectoresAbiertos === antesDialogo && isDeepStrictEqual(await documento(), conCambios) && (await titulo()) === "• Marcha.brn — Bornera",
    await titulo(),
  );

  await tecla(O, CTRL);
  await hayDialogo();
  await responder("Cancelar");
  await sinDialogo();
  comprobar(
    "Cancelar: no se abre el selector, no se guarda y el documento sigue",
    p.selectoresAbiertos === antesDialogo && isDeepStrictEqual(await documento(), conCambios) && (await ninguna(300)),
  );

  await tecla(O, CTRL);
  await hayDialogo();
  await marcarEditor();
  p.elegirArchivo(marcha);
  await responder("No guardar");
  await editorNuevo();
  comprobar(
    "No guardar: abre sin guardar",
    isDeepStrictEqual(await documento(), esperado) && (await ninguna()) && (await titulo()) === "Marcha.brn — Bornera",
    await titulo(),
  );

  await colocar("contactor.bobina", 0, 40, "K4");
  const aGuardar = await documento();
  await tecla(O, CTRL);
  await hayDialogo();
  await marcarEditor();
  p.elegirArchivo(marcha);
  await responder("Guardar");
  d = await descarga();
  await editorNuevo();
  comprobar("Guardar: primero guarda lo que había, en «Marcha.brn»", d?.nombre === "Marcha.brn" && isDeepStrictEqual(leer(d.bytes), aGuardar), d?.nombre);
  comprobar("y después abre el archivo elegido", isDeepStrictEqual(await documento(), esperado));

  // ── Nuevo con cambios: el mismo diálogo ──
  await colocar("contactor.bobina", 0, 50, "K5");
  await apretar("Nuevo");
  await hayDialogo();
  comprobar("con cambios, el botón Nuevo muestra el diálogo", (await dialogo())?.titulo === "¿Guardar los cambios?");
  await marcarEditor();
  await responder("No guardar");
  await editorNuevo();
  comprobar(
    "No guardar: documento vacío, «Sin título.brn» y sin historial",
    (await componentes()) === 0 && (await titulo()) === "Sin título.brn — Bornera" && !(await activado("Deshacer")),
    await titulo(),
  );
  // Ctrl+N: por CDP llega a la página; en un Chrome de verdad no (lo reserva) y va el botón.
  await colocar("contactor.bobina", 0, 0, "K6");
  await tecla(N, CTRL);
  await hayDialogo();
  comprobar("Ctrl+N con cambios muestra el diálogo", (await dialogo())?.titulo === "¿Guardar los cambios?");
  await responder("Cancelar");
  await sinDialogo();
  comprobar("Cancelar: sigue el documento con el cambio", (await titulo()) === "• Sin título.brn — Bornera", await titulo());
  await tecla(Z, CTRL);

  // ── Un archivo dañado: el error, y el documento sigue ──
  await abrirCon(marcha);
  const roto = join(archivos, "Roto.brn");
  writeFileSync(roto, "{roto");
  p.elegirArchivo(roto);
  await tecla(O, CTRL);
  await hayDialogo();
  dlg = await dialogo();
  comprobar("un archivo dañado muestra «No se pudo abrir» con el problema", dlg?.titulo === "No se pudo abrir" && dlg.lineas.length > 0, JSON.stringify(dlg));
  comprobar(
    "el documento sigue igual, con su archivo y sin marca",
    isDeepStrictEqual(await documento(), esperado) && (await titulo()) === "Marcha.brn — Bornera",
    await titulo(),
  );
  await p.esc();
  await sinDialogo();

  // ── Ctrl+O con el foco en el campo del panel: lo escrito entra antes ──
  const id = esperado.hojas[0].componentes[0].id;
  await p.evaluar(`bornera.activo().seleccionarIds(["${id}"])`);
  await esperar(250); // el panel se abre solo
  const campo = await p.caja(CAMPO);
  await p.clic({ x: campo.cx, y: campo.cy });
  await p.evaluar(`document.querySelector("${CAMPO}").select()`);
  await p.cdp("Input.insertText", { text: "K7" });
  await tecla(O, CTRL);
  await hayDialogo();
  const etiqueta = await p.evaluar(`bornera.editor.documento.hojas[0].componentes.find((c) => c.id === "${id}").etiqueta`);
  comprobar("Ctrl+O en el campo: lo escrito entra y Abrir pregunta", etiqueta === "K7" && (await dialogo())?.titulo === "¿Guardar los cambios?", etiqueta);
  await responder("Cancelar");
  await sinDialogo();
  await tecla(Z, CTRL);
  await p.esc();
  comprobar("Ctrl+Z vuelve a lo abierto", (await titulo()) === "Marcha.brn — Bornera", await titulo());

  // ── Tres Abrir seguidos: no se acumulan oyentes; una tecla, una acción ──
  const antes = await oyentes();
  for (let i = 0; i < 3; i++) await abrirCon(marcha);
  const despues = await oyentes();
  comprobar("tres Abrir seguidos no acumulan oyentes (ventana y lienzo)", isDeepStrictEqual(antes, despues), `${JSON.stringify(antes)} → ${JSON.stringify(despues)}`);
  await tecla(W);
  comprobar("W una vez: queda activa la herramienta cable (una sola acción)", await p.evaluar("bornera.activo().cable !== null"));
  await p.esc();
  comprobar("Esc la termina", await p.evaluar("bornera.activo().cable === null"));
  comprobar("sigue idéntico a lo guardado", isDeepStrictEqual(await documento(), esperado));

  // ── tildes.brn: título, autor y etiquetas con tildes, ñ, ü y comillas ──
  const textoTildes = gunzipSync(readFileSync(RUTA_TILDES)).toString("utf8");
  await abrirCon(RUTA_TILDES);
  const tildes = await documento();
  comprobar("tildes.brn abre igual a lo que lee Node", isDeepStrictEqual(tildes, JSON.parse(textoTildes)));
  const [c1, c2] = tildes.hojas[0].componentes;
  comprobar(
    "título, autor y etiquetas intactos",
    tildes.meta.titulo === TITULO && tildes.meta.autor === AUTOR && c1?.etiqueta === ETIQUETA && c2?.etiqueta === ETIQUETA_2,
    JSON.stringify([tildes.meta.titulo, tildes.meta.autor, c1?.etiqueta, c2?.etiqueta]),
  );
  comprobar("el título de la ventana es «tildes.brn — Bornera»", (await titulo()) === `${NOMBRE_TILDES} — Bornera`, await titulo());
  await p.evaluar(`bornera.activo().seleccionarIds(["${c1?.id}"])`);
  await esperar(250);
  const enPanel = await p.evaluar(`document.querySelector("${CAMPO}")?.value ?? null`);
  comprobar("el panel muestra la etiqueta con tildes", enPanel === ETIQUETA, enPanel);
  await tecla(S, CTRL);
  d = await descarga();
  comprobar(
    "Ctrl+S la vuelve a escribir igual (el mismo texto canónico)",
    d?.nombre === NOMBRE_TILDES && gunzipSync(d.bytes).toString("utf8") === textoTildes,
    d?.nombre,
  );
  await p.esc();

  // ── D17: en Simular y en el banco, Nuevo y Abrir no andan ──
  const antesD17 = p.selectoresAbiertos;
  await tecla(F5);
  comprobar("en Simular, Nuevo y Abrir están desactivados", !(await activado("Nuevo")) && !(await activado("Abrir")));
  await tecla(O, CTRL);
  await esperar(300);
  comprobar("en Simular, Ctrl+O no hace nada", p.selectoresAbiertos === antesD17 && (await dialogo()) === null);
  await tecla(F5);
  await tecla(B, CTRL | MAYUS); // 100
  await p.esperarA("bornera.activo() !== bornera.editor");
  comprobar("en el banco, Nuevo y Abrir están desactivados", !(await activado("Nuevo")) && !(await activado("Abrir")));
  await tecla(O, CTRL);
  await esperar(300);
  comprobar("en el banco, Ctrl+O no hace nada", p.selectoresAbiertos === antesD17 && (await dialogo()) === null);
  for (let i = 0; i < 8 && !(await p.evaluar("bornera.activo() === bornera.editor")); i++) await tecla(B, CTRL | MAYUS);
  comprobar(
    "de vuelta en el documento, Nuevo y Abrir andan",
    (await p.evaluar("bornera.activo() === bornera.editor")) && (await activado("Nuevo")) && (await activado("Abrir")),
  );
  comprobar("no quedó ninguna respuesta de selector sin usar", p.respuestasPendientes === 0, `${p.respuestasPendientes}`);
}
