// T18: referencias cruzadas en la app real a 1024×600 (plan T18, sección 5).
//
// La marcha-parada se arma en Node con `marchaParada()` y se abre con Ctrl+O
// (selector interceptado). Las listas se leen de la escena del editor
// (`ComponenteEscena.referencias`) y se comparan con un cálculo nuevo.
//  1. La marcha-parada muestra la lista de K1 con una fila.
//  2. Con el mouse sobre el centro del contacto, la barra de estado muestra
//     los mismos números que la fila (ajuste 2).
//  3. Mover el contacto: la fila cambia al soltar, no antes. Ctrl+Z la devuelve.
//  4. Sumar un NC "K1": segunda fila.
//  5. Renombrar K1 a K5 en el panel: la lista sigue a la bobina.
//  6. Sin restos (ajuste 3): fotos de referencia de documentos recién
//     abiertos (sin lista, 1 fila y 2 filas). Desde el de sin lista, por
//     comandos, la lista aparece, crece y al borrar los contactos de a uno se
//     achica y desaparece; cada estado da los mismos píxeles que su
//     referencia (el último, en la caja de la lista). Ctrl+Z, lo mismo.
//  7. Ctrl+D de la rama de K1: K2 con su lista, K1 con la suya, y ninguna
//     lista toca un componente ni un cable (ajuste 1).
//  8. Dos bobinas K1: las dos con la misma lista, sin aviso de rechazo; desde
//     T19, con un error R4 en cada una.
//  9. Guardar y reabrir: las mismas listas.
// 10. Alejar con la rueda hasta apagar los textos: la lista se apaga con ellos.
// 11. El indicador de zoom de la barra sigue a la rueda.
// 12. validarHoja en 0 y sin errores de la página.

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Referencias cruzadas";

const N = ["n", "KeyN", 78];
const S = ["s", "KeyS", 83];
const O = ["o", "KeyO", 79];
const Z = ["z", "KeyZ", 90];
const D = ["d", "KeyD", 68];
const ENTER = ["Enter", "Enter", 13];
const CAMPO = "#prop-etiqueta";
const DIALOGO = '[role="dialog"][aria-modal="true"]';
const TIPO_NC = "contactor.auxiliar_nc";

export default async function (p, comprobar, { cargar }) {
  const m = {
    ...(await cargar("/src/core/circuitos/marchaParada.ts")),
    ...(await cargar("/src/core/io/index.ts")),
    ...(await cargar("/src/core/model/comandos.ts")),
    ...(await cargar("/src/core/model/referencias.ts")),
    ...(await cargar("/src/core/model/cables.ts")),
    ...(await cargar("/src/core/symbols/biblioteca.ts")),
    ...(await cargar("/src/render/simbolo.ts")),
    ...(await cargar("/src/render/detalle.ts")),
    ...(await cargar("/src/render/camara.ts")),
  };
  const carpeta = mkdtempSync(join(tmpdir(), "bornera-descargas-"));
  const archivos = mkdtempSync(join(tmpdir(), "bornera-archivos-"));
  await p.descargasEn(carpeta);
  await p.interceptarSelector();
  try {
    await probar(p, comprobar, m, carpeta, archivos);
  } finally {
    await p.interceptarSelector(false).catch(() => undefined);
    await p.descargasEn(null).catch(() => undefined);
    for (const c of [carpeta, archivos]) rmSync(c, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

async function probar(p, comprobar, m, carpeta, archivos) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods);
  const hoja = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento.hojas[0]))");
  const pasos = () => p.evaluar("bornera.editor.historial.hechos.length");
  const problemas = () => p.evaluar("bornera.cables.validarHoja(bornera.editor.documento.hojas[0]).length");
  const seleccionar = (ids) => p.evaluar(`bornera.editor.seleccionarIds(${JSON.stringify(ids)})`);
  const soltarFuera = () => p.evaluar(`document.activeElement?.blur()`);
  /** Las líneas de la lista de `id` en la escena del editor (null si no tiene). */
  const lineas = (id) => p.evaluar(`(() => { const r = bornera.editor.escena.obtener(${JSON.stringify(id)})?.referencias; return r ? [...r] : null; })()`);
  /** Las listas de todas las bobinas de la escena, por id (solo las que tienen). */
  const listas = () =>
    p.evaluar(`(() => { const ed = bornera.editor; const s = {};
      for (const c of ed.documento.hojas[0].componentes) { const r = ed.escena.obtener(c.id)?.referencias; if (r) s[c.id] = [...r]; }
      return s; })()`);
  /** Las listas de un cálculo nuevo sobre la hoja de la página. */
  const esperadas = async (h) => {
    const s = {};
    for (const [id, filas] of m.referenciasCruzadas(h ?? (await hoja()))) s[id] = filas.map(m.textoFila);
    return s;
  };
  const colocar = (tipo, x, y, etiqueta) =>
    p.evaluar(`(() => { const { editor, comandos: c } = bornera;
      const cmd = c.colocar(editor.documento, { tipo: "${tipo}", x: ${x}, y: ${y}, rot: 0, espejado: false, etiqueta: ${JSON.stringify(etiqueta)}, params: {} });
      editor.ejecutar(cmd); return cmd.id; })()`);
  const etiquetaPorCodigo = (id, texto) =>
    p.evaluar(`(() => { const { editor, comandos: c } = bornera; editor.ejecutar(new c.CambiarEtiqueta(${JSON.stringify(id)}, ${JSON.stringify(texto)})); })()`);
  const camara = async (zoom, gx, gy) => {
    await p.evaluar(`(() => { const cv = document.querySelector("canvas"); const v = bornera.editor.vista;
      v.camara.zoom = ${zoom}; v.camara.centrar(${gx}, ${gy}, cv.clientWidth, cv.clientHeight); v.invalidar(); })()`);
    await esperar(60);
  };
  const dialogo = () => p.esperarA(`!!document.querySelector('${DIALOGO}')`, 1500).then(() => true, () => false);
  /** Ctrl+N; si hay cambios, «No guardar». Documento vacío y sin historial. */
  const nuevo = async () => {
    await tecla(N, CTRL);
    if (await dialogo()) {
      const k = await p.evaluar(`(() => { const b = [...document.querySelectorAll('${DIALOGO} button')].find((x) => x.textContent.trim() === "No guardar");
        if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!k) throw new Error("No está el botón «No guardar» en el diálogo.");
      await p.clic(k);
      await p.esperarA(`!document.querySelector('${DIALOGO}')`, 5000);
    }
    await p.esperarA("bornera.editor.documento.hojas[0].componentes.length === 0 && bornera.editor.historial.hechos.length === 0", 5000);
    await esperar(100);
  };
  /** Documento nuevo y Ctrl+O con el archivo `ruta`. */
  const abrir = async (ruta) => {
    await nuevo();
    await p.evaluar("bornera.editor.__anterior = true");
    p.elegirArchivo(ruta);
    await tecla(O, CTRL);
    await p.esperarA("bornera.editor.__anterior !== true", 5000);
    await esperar(150);
  };
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
    await soltarFuera();
  };
  /** Espera a que la vista no tenga nada por dibujar, 3 cuadros seguidos. */
  const reposo = () =>
    p.evaluar(`new Promise((listo) => { let quietos = 0; const f = () => {
      quietos = bornera.activo().vista.enReposo ? quietos + 1 : 0;
      if (quietos >= 3) listo(true); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
  const foto = async (n) => {
    await reposo();
    await p.evaluar(`(() => { const cv = document.querySelector("canvas");
      (globalThis.__fotos ??= {})["${n}"] = { w: cv.width, h: cv.height, datos: cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data }; })()`);
  };
  /**
   * Píxeles distintos entre el lienzo de ahora y la foto `n`, en todo el
   * lienzo o en la caja de grilla `k` (−1 si cambió el tamaño).
   */
  const distintos = async (n, k = null) => {
    await reposo();
    return p.evaluar(`(() => { const cv = document.querySelector("canvas"); const f = globalThis.__fotos["${n}"];
      if (f.w !== cv.width || f.h !== cv.height) return -1;
      const b = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data, a = f.datos;
      let x0 = 0, y0 = 0, x1 = cv.width, y1 = cv.height;
      const k = ${JSON.stringify(k)};
      if (k) { const cam = bornera.activo().vista.camara; const dpr = cv.width / cv.clientWidth;
        const p0 = cam.aPantalla(k.x, k.y), p1 = cam.aPantalla(k.x + k.ancho, k.y + k.alto);
        x0 = Math.max(0, Math.floor(p0.x * dpr)); y0 = Math.max(0, Math.floor(p0.y * dpr));
        x1 = Math.min(cv.width, Math.ceil(p1.x * dpr)); y1 = Math.min(cv.height, Math.ceil(p1.y * dpr)); }
      let d = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * cv.width + x) * 4;
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) d++; }
      return d; })()`);
  };
  /** Los dos datos de la barra de estado: "X 10 · Y 11" y "Zoom 100 %". */
  const barra = () => p.evaluar(`[...document.querySelectorAll("footer.estado .dato")].map((e) => e.textContent.trim())`);
  const avisoBarra = () => p.evaluar(`document.querySelector("footer.estado .avisos")?.textContent.trim() ?? null`);
  const zoomCamara = () => p.evaluar("bornera.editor.vista.camara.zoom");
  const colocacion = (c) => ({ x: c.x, y: c.y, rotacion: c.rot, espejado: c.espejado });
  /** Caja de la lista de `bobina` (ancho por exceso, la de "no tapa"). */
  const cajaLista = (bobina, ls) => m.cajaReferencias(m.buscarSimbolo(bobina.tipo), colocacion(bobina), ls);

  /** Escribe un documento armado en Node como .brn (texto plano) y devuelve la ruta. */
  const archivo = (nombreArchivo, doc) => {
    const ruta = join(archivos, nombreArchivo);
    writeFileSync(ruta, m.serializar(doc));
    return ruta;
  };

  const mp = m.marchaParada();
  const { k1Bobina, k1Auxiliar, s1, h1 } = mp.comp;
  const rutaMarcha = archivo("marcha-parada.brn", mp.doc);
  const fila1 = "NA 13-14 (10, 11)";

  // ── 1. La lista de K1 ──
  await abrir(rutaMarcha);
  await camara(1, 8, 16);
  comprobar(
    "1. la marcha-parada muestra la lista de K1 con una fila, igual a un cálculo nuevo",
    isDeepStrictEqual(await lineas(k1Bobina), [fila1]) && isDeepStrictEqual(await listas(), await esperadas()),
    JSON.stringify(await listas()),
  );
  await p.captura("lista-k1");

  // ── 2. La barra de estado en el centro del contacto ──
  const centroNA = await p.punto(10, 11);
  await p.mouse("mouseMoved", centroNA.x, centroNA.y);
  await esperar(60);
  const [xy] = await barra();
  const enBarra = /X (-?\d+) · Y (-?\d+)/.exec(xy ?? "");
  const enFila = /\((-?\d+), (-?\d+)\)/.exec(fila1);
  comprobar(
    "2. con el mouse en el centro del NA, la barra muestra los mismos números que la fila",
    !!enBarra && !!enFila && enBarra[1] === enFila[1] && enBarra[2] === enFila[2],
    `barra «${xy}», fila «${fila1}»`,
  );

  // ── 3. Mover el contacto: cambia al soltar ──
  let n = await pasos();
  const destino = await p.punto(12, 11);
  await p.mouse("mousePressed", centroNA.x, centroNA.y);
  for (let i = 1; i <= 4; i++) await p.mouse("mouseMoved", centroNA.x + ((destino.x - centroNA.x) * i) / 8, centroNA.y, { botones: 1 });
  await esperar(60);
  const enGesto = await p.evaluar("bornera.editor.enGesto");
  const aMitad = await lineas(k1Bobina);
  for (let i = 5; i <= 8; i++) await p.mouse("mouseMoved", centroNA.x + ((destino.x - centroNA.x) * i) / 8, centroNA.y, { botones: 1 });
  await esperar(60);
  const antesDeSoltar = await lineas(k1Bobina);
  await p.mouse("mouseReleased", destino.x, destino.y);
  await esperar(80);
  const movido = (await hoja()).componentes.find((c) => c.id === k1Auxiliar);
  comprobar(
    "3. durante el arrastre (gesto en curso) la fila no cambia",
    enGesto === true && isDeepStrictEqual(aMitad, [fila1]) && isDeepStrictEqual(antesDeSoltar, [fila1]),
    JSON.stringify({ enGesto, aMitad, antesDeSoltar }),
  );
  comprobar(
    "3. al soltar (un paso), la fila dice la posición nueva",
    (await pasos()) === n + 1 && movido?.x === 12 && isDeepStrictEqual(await lineas(k1Bobina), ["NA 13-14 (12, 11)"]),
    JSON.stringify({ pasos: (await pasos()) - n, x: movido?.x, lineas: await lineas(k1Bobina) }),
  );
  await seleccionar([]);
  await tecla(Z, CTRL);
  comprobar("3. Ctrl+Z devuelve el contacto y la fila", (await pasos()) === n && isDeepStrictEqual(await lineas(k1Bobina), [fila1]));

  // ── 4. Sumar un NC "K1" ──
  const nc = await colocar(TIPO_NC, 24, 11, "");
  await escribirEtiqueta(nc, "K1");
  await seleccionar([]);
  const dos = [fila1, "NC 21-22 (24, 11)"];
  comprobar(
    "4. un NC con «K1» escrito en el panel suma la segunda fila",
    isDeepStrictEqual(await lineas(k1Bobina), dos) && isDeepStrictEqual(await listas(), await esperadas()),
    JSON.stringify(await lineas(k1Bobina)),
  );
  await p.captura("dos-filas");

  // ── 5. Renombrar K1 a K5 en el panel ──
  n = await pasos();
  await escribirEtiqueta(k1Bobina, "K5");
  await seleccionar([]);
  const h5 = await hoja();
  const etiquetas5 = [k1Bobina, k1Auxiliar, nc].map((id) => h5.componentes.find((c) => c.id === id)?.etiqueta);
  comprobar(
    "5. renombrar K1 a K5: los contactos pasan a K5 y la lista sigue a la bobina",
    isDeepStrictEqual(etiquetas5, ["K5", "K5", "K5"]) && isDeepStrictEqual(await lineas(k1Bobina), dos) && isDeepStrictEqual(await listas(), await esperadas(h5)),
    JSON.stringify({ etiquetas5, lineas: await lineas(k1Bobina) }),
  );
  await tecla(Z, CTRL);
  comprobar("5. Ctrl+Z vuelve a K1 con la misma lista", (await pasos()) === n && isDeepStrictEqual(await lineas(k1Bobina), dos));

  // ── 6. Sin restos (ajuste 3) ──
  // Fotos de referencia de documentos recién abiertos, con la misma cámara:
  // la marcha-parada (1 fila), con el NC "K1" (2 filas) y con el NA sin
  // etiqueta (sin lista). Después, desde el de sin lista, todo por comandos
  // (sin selección ni panel: solo invalida lo que reflejar pide) y cada estado
  // se compara con su referencia.
  // Al 200 %: un mosaico (256 px) mide 6,4 unidades y la lista de K1 (y ≈ 22)
  // no comparte mosaico con el NA (y = 11). Al 100 % sí (12,8 unidades), y
  // redibujar el mosaico del NA borrado tapaba un resto de la lista: con
  // `actualizar` devolviendo solo la caja nueva, al 100 % pasaba igual y al
  // 200 % falla «borrar el NA» (probado a propósito, 205 píxeles).
  // De 2 filas a 1 no puede quedar resto: la caja nueva (con el cuerpo de la
  // bobina) cubre la segunda fila.
  const mp2 = m.marchaParada();
  mp2.historial.ejecutar(m.colocar(mp2.doc, { tipo: TIPO_NC, x: 24, y: 11, rot: 0, espejado: false, etiqueta: "K1", params: {} }));
  const mp0 = m.marchaParada();
  mp0.historial.ejecutar(new m.CambiarEtiqueta(k1Auxiliar, ""));
  const referencia = async (ruta, nombreFoto) => {
    await abrir(ruta);
    await camara(2, 6, 18); // mosaicos de 6,4 unidades: la lista de K1 y el NA caen en mosaicos distintos
    await p.mouse("mouseMoved", 5, 5); // fuera del lienzo: sin resaltado bajo el cursor
    await foto(nombreFoto);
  };
  await referencia(rutaMarcha, "una");
  await referencia(archivo("dos-filas.brn", mp2.doc), "dos");
  comprobar("6. abierta con el NC: K1 con 2 filas", isDeepStrictEqual(await lineas(k1Bobina), dos), JSON.stringify(await lineas(k1Bobina)));
  await referencia(archivo("sin-lista.brn", mp0.doc), "sin");
  comprobar("6. abierta con el NA sin etiqueta: K1 sin lista", (await lineas(k1Bobina)) === null);
  const bobina6 = (await hoja()).componentes.find((c) => c.id === k1Bobina);
  const cajaDos = cajaLista(bobina6, dos);
  const dRef = [await distintos("una", cajaDos), await distintos("dos", cajaDos)];
  comprobar("6. las referencias de 1 y 2 filas difieren de la de sin lista en la caja de la lista", dRef[0] > 0 && dRef[1] > 0, JSON.stringify(dRef));
  await etiquetaPorCodigo(k1Auxiliar, "K1");
  let d = await distintos("una");
  comprobar("6. aparece la lista (1 fila): el lienzo entero igual a la referencia", (await lineas(k1Bobina))?.length === 1 && d === 0, `${d} píxeles distintos`);
  const nc6 = await colocar(TIPO_NC, 24, 11, "K1");
  d = await distintos("dos");
  comprobar("6. crece a 2 filas: el lienzo entero igual a la referencia", isDeepStrictEqual(await lineas(k1Bobina), dos) && d === 0, `${d} píxeles distintos`);
  const borrar = (id) => p.evaluar(`(() => { const { editor, comandos: c } = bornera; editor.ejecutar(new c.Borrar([${JSON.stringify(id)}])); })()`);
  await borrar(nc6);
  d = await distintos("una");
  comprobar("6. borrar el NC: vuelve a 1 fila y el lienzo entero queda igual a la referencia", (await lineas(k1Bobina))?.length === 1 && d === 0, `${d} píxeles distintos`);
  await borrar(k1Auxiliar);
  d = await distintos("sin", cajaDos);
  comprobar(
    "6. borrar el NA: la lista desaparece y su caja de 2 filas queda igual a la referencia sin lista",
    (await lineas(k1Bobina)) === null && d === 0,
    `${d} píxeles distintos en la caja`,
  );
  await p.captura("sin-restos");
  await tecla(Z, CTRL);
  d = await distintos("una");
  comprobar("6. Ctrl+Z: 1 fila, el lienzo igual a la referencia", (await lineas(k1Bobina))?.length === 1 && d === 0, `${d} píxeles distintos`);
  await tecla(Z, CTRL);
  d = await distintos("dos");
  comprobar("6. Ctrl+Z: 2 filas, el lienzo igual a la referencia", isDeepStrictEqual(await lineas(k1Bobina), dos) && d === 0, `${d} píxeles distintos`);
  comprobar("6. validarHoja en 0", (await problemas()) === 0);

  // ── 7. Ctrl+D de la rama de K1 (ajuste 1) ──
  await abrir(rutaMarcha);
  await camara(0.6, 18, 16);
  const antes7 = new Set((await hoja()).componentes.map((c) => c.id));
  await seleccionar([s1, k1Auxiliar, k1Bobina, h1, ...mp.cables]);
  n = await pasos();
  await tecla(D, CTRL);
  await esperar(100);
  await seleccionar([]);
  const h7 = await hoja();
  const bobinaK2 = h7.componentes.find((c) => !antes7.has(c.id) && c.tipo === "contactor.bobina");
  const listas7 = await listas();
  comprobar(
    "7. Ctrl+D: K2 con su lista y K1 con la suya, iguales a un cálculo nuevo",
    (await pasos()) === n + 1 &&
      bobinaK2?.etiqueta === "K2" &&
      isDeepStrictEqual(listas7[k1Bobina], [fila1]) &&
      isDeepStrictEqual(listas7[bobinaK2.id], [`NA 13-14 (${10 + bobinaK2.x}, 11)`]) &&
      isDeepStrictEqual(listas7, await esperadas(h7)),
    JSON.stringify({ k2: bobinaK2?.etiqueta, listas7 }),
  );
  const tocados = [];
  let holgura = Infinity;
  const indice = m.indexarHoja(h7);
  for (const [id, ls] of Object.entries(listas7)) {
    const bobina = h7.componentes.find((c) => c.id === id);
    const k = cajaLista(bobina, ls);
    const obs = [];
    for (const c of h7.componentes) if (c.id !== id) obs.push([c.etiqueta || c.tipo, m.cajaDibujo(m.buscarSimbolo(c.tipo), colocacion(c), c.etiqueta)]);
    for (const w of h7.cables) {
      const r = m.recorridoCable(indice, w);
      for (let i = 0; r && i + 3 < r.length; i += 2) {
        const x0 = Math.min(r[i], r[i + 2]), x1 = Math.max(r[i], r[i + 2]), y0 = Math.min(r[i + 1], r[i + 3]), y1 = Math.max(r[i + 1], r[i + 3]);
        obs.push([`cable ${w.id}`, { x: x0 - 0.1, y: y0 - 0.1, ancho: x1 - x0 + 0.2, alto: y1 - y0 + 0.2 }]);
      }
    }
    for (const [que, o] of obs) {
      const s = Math.max(o.x - (k.x + k.ancho), k.x - (o.x + o.ancho), o.y - (k.y + k.alto), k.y - (o.y + o.alto));
      if (s <= 0) tocados.push(`${bobina.etiqueta}: ${que}`);
      holgura = Math.min(holgura, s);
    }
  }
  comprobar("7. ninguna lista toca un componente ni un cable", tocados.length === 0, `${tocados.join(", ")} (holgura ${holgura.toFixed(2)})`);
  comprobar("7. validarHoja en 0", (await problemas()) === 0);
  await p.captura("ctrl-d");

  // ── 8. Dos bobinas K1 ──
  await abrir(rutaMarcha);
  await camara(0.6, 18, 16);
  const avisoAntes = await avisoBarra(); // el de Abrir («Abierto en N ms»)
  const otra = await colocar("contactor.bobina", 30, 22, "");
  await escribirEtiqueta(otra, "K1");
  await seleccionar([]);
  const listas8 = await listas();
  comprobar(
    "8. dos bobinas K1: las dos con la misma lista",
    isDeepStrictEqual(listas8[k1Bobina], [fila1]) && isDeepStrictEqual(listas8[otra], [fila1]) && isDeepStrictEqual(listas8, await esperadas()),
    JSON.stringify(listas8),
  );
  comprobar("8. la segunda K1 se acepta sin aviso de rechazo (la barra sigue con el de Abrir)", (await avisoBarra()) === avisoAntes, `${avisoAntes} → ${await avisoBarra()}`);
  // T19 (etapa 2): dos bobinas K1 son ahora un error R4 en cada una (impedirá simular). Antes, este paso
  // decía «no da ningún aviso»: T18 no tenía validaciones; el aviso que miraba era el de una acción rechazada.
  const r4 = await p.evaluar(`(() => {
    const a = bornera.editor.avisos;
    const de = (id) => a.de(id).filter((x) => x.regla === "R4" && x.severidad === "error").length;
    return { k1: de(${JSON.stringify(k1Bobina)}), otra: de(${JSON.stringify(otra)}), errores: a.cuenta.errores };
  })()`);
  comprobar("8. con las validaciones de T19, las dos K1 tienen un error R4 y la cuenta dice 2 errores", r4.k1 === 1 && r4.otra === 1 && r4.errores === 2, JSON.stringify(r4));
  await p.captura("dos-bobinas");

  // ── 9. Guardar y reabrir ──
  await tecla(S, CTRL);
  const bytes = await esperarDescarga(carpeta);
  comprobar("9. Ctrl+S descarga el circuito", bytes !== null);
  if (bytes) {
    const ruta = join(archivos, "dos-bobinas.brn");
    writeFileSync(ruta, bytes);
    await abrir(ruta);
    comprobar("9. reabierto: las mismas listas", isDeepStrictEqual(await listas(), listas8), JSON.stringify(await listas()));
  }

  // ── 10 y 11. Alejar con la rueda hasta apagar los textos ──
  await abrir(rutaMarcha);
  await camara(1, 8, 16);
  await p.mouse("mouseMoved", 5, 5);
  const lienzo = await p.caja("canvas");
  const zoomInicial = (await barra())[1];
  const saltos = [];
  let ruedaBien = true;
  for (let i = 0; i < 40 && m.nivelDetalle(m.PX_POR_UNIDAD * (await zoomCamara())).textos; i++) {
    const antes = (await barra())[1];
    await p.rueda(lienzo.cx, lienzo.cy, 100);
    await esperar(40);
    const ahora = (await barra())[1];
    const esperado = `Zoom ${Math.round((await zoomCamara()) * 100)} %`;
    saltos.push(ahora);
    if (ahora === antes || ahora !== esperado) ruedaBien = false;
  }
  comprobar(
    "11. el indicador de zoom cambia con cada paso de rueda y dice el zoom de la cámara",
    ruedaBien && saltos.length > 0,
    `de «${zoomInicial}» a ${saltos.join(", ")}`,
  );
  const apagados = !m.nivelDetalle(m.PX_POR_UNIDAD * (await zoomCamara())).textos;
  await p.mouse("mouseMoved", 5, 5);
  await foto("lejos");
  n = await pasos();
  await etiquetaPorCodigo(k1Auxiliar, "");
  d = await distintos("lejos");
  comprobar(
    "10. con los textos apagados, quitar la lista (el NA sin etiqueta) no cambia ningún píxel",
    apagados && (await lineas(k1Bobina)) === null && d === 0,
    JSON.stringify({ apagados, zoom: await zoomCamara(), d }),
  );
  await p.captura("textos-apagados");
  await tecla(Z, CTRL);
  comprobar("10. Ctrl+Z vuelve la lista", (await pasos()) === n && isDeepStrictEqual(await lineas(k1Bobina), [fila1]));

  // ── 12. Al final ──
  comprobar("12. al final: validarHoja en 0", (await problemas()) === 0);
  comprobar("12. sin errores de la página hasta acá", p.errores.length === 0, p.errores.join(" | "));
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
