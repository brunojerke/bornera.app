// Cierre de la fase 3b, etapa 2: la inversión de giro armada con el mouse y
// el teclado a 1024×600, siguiendo la hoja 2 de docs/netbook-fase3b.md
// (docs/plan-cierre-3b.md, sección 4).
//
// Parte del archivo congelado tests/circuitos/marcha-parada.brn (el mismo que
// se abre en la netbook), con Ctrl+O y el selector interceptado. Cada paso de
// la hoja se hace como lo haría Bruno: rectángulo y arrastre para hacer
// lugar, clic y Mayús+clic en los cables y Supr, el NC desde la paleta, la
// etiqueta en el panel con Enter, los cables con W y clics (las T con un clic
// sobre el cable), la rama con un rectángulo y la tecla Ctrl+D. Se dibuja al
// zoom inicial: si lo que se va a tocar no está a la vista, se desplaza con
// el botón del medio y se cuenta.
//
// Comprueba:
//  - cada gesto, un paso de deshacer; Ctrl+D, uno solo;
//  - la barra: 5 avisos al colocar el NC, 5 después de Ctrl+D (R6 del NC de
//    la copia y 4 R7), 4 al renombrar ese NC a "K1" y «Sin avisos» al final;
//  - la copia: S2, K2 (NA), K2 (bobina) y H2 donde los deja `inversion()`, y
//    su NC con "K2";
//  - el .brn de Guardar como, en Node: `compararRedes` contra `inversion()` da
//    0 diferencias;
//  - las listas de K1 y K2: dos filas cada una, iguales a un cálculo nuevo y
//    a las de `inversion()`; con el mouse en el centro de cada contacto, la
//    barra muestra las coordenadas de su fila; ninguna caja de lista toca
//    nada (src/editor/prueba-cajas.ts);
//  - F a 1024×600 y a 1024×530, con el panel plegado y abierto.
// Las líneas con «·» son mediciones para la hoja 2, no comprobaciones.

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { CTRL, esperar, MAYUS } from "./cdp.mjs";

export const nombre = "Cierre 3b: inversión de giro con el mouse";

const W = ["w", "KeyW", 87];
const F = ["f", "KeyF", 70];
const D = ["d", "KeyD", 68];
const S = ["s", "KeyS", 83];
const O = ["o", "KeyO", 79];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];
const SUPR = ["Delete", "Delete", 46];
const ENTER = ["Enter", "Enter", 13];
const CAMPO = "#prop-etiqueta";
/** Lo que se va a tocar tiene que quedar a esta distancia (px) del borde del lienzo; si no, se desplaza la vista. */
const MARGEN = 40;
const MARCHA_PARADA = resolve(dirname(fileURLToPath(import.meta.url)), "../circuitos/marcha-parada.brn");
const NC = "contactor.auxiliar_nc";

const info = (texto) => console.log(`  ·   ${texto}`);
const px = (n) => `${Math.round(n * 10) / 10}`;
const plano = (x) => JSON.parse(JSON.stringify(x));

export default async function (p, comprobar, { cargar }) {
  const m = {
    ...(await cargar("/src/core/circuitos/inversion.ts")),
    ...(await cargar("/src/core/circuitos/compararRedes.ts")),
    ...(await cargar("/src/core/model/referencias.ts")),
    ...(await cargar("/src/core/io/index.ts")),
    ...(await cargar("/src/core/symbols/biblioteca.ts")),
    ...(await cargar("/src/ui/brn.ts")),
    ...(await cargar("/src/editor/prueba-cajas.ts")),
    ...(await cargar("/src/render/detalle.ts")),
  };
  const descargas = mkdtempSync(join(tmpdir(), "bornera-descargas-"));
  const archivos = mkdtempSync(join(tmpdir(), "bornera-archivos-"));
  await p.descargasEn(descargas);
  await p.interceptarSelector();
  try {
    const h = ayudantes(p, descargas);
    const url = await p.evaluar("location.href");
    const ruta = await armar(p, comprobar, h, m, archivos);
    if (!ruta) return;
    await probarF(p, comprobar, h, "1024×600", m.ESCALA_MIN_TEXTOS);
    await p.captura("encuadre-600");

    // ── 1024×530: solo F (recargar borra los errores anotados: se miran antes) ──
    comprobar("sin errores en la página (1024×600)", p.errores.length === 0, p.errores.join(" | "));
    await p.abrir(url, 1024, 530);
    await p.interceptarSelector();
    await h.abrirCon(ruta);
    comprobar("1024×530: el archivo guardado abre con «Sin avisos»", (await h.contador()).texto === "Sin avisos");
    await probarF(p, comprobar, h, "1024×530", m.ESCALA_MIN_TEXTOS);
    await p.captura("encuadre-530");
  } finally {
    await p.interceptarSelector(false).catch(() => undefined);
    await p.descargasEn(null).catch(() => undefined);
    for (const c of [descargas, archivos]) rmSync(c, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

function ayudantes(p, carpeta) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods, key === "Enter" ? "\r" : undefined);
  const hoja = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento.hojas[0]))");
  const pasos = () => p.evaluar("bornera.activo().historial.hechos.length");
  const titulo = () => p.evaluar("document.title");
  const apretar = async (etiqueta) => {
    const k = await p.caja(`button[aria-label="${etiqueta}"]`);
    await p.clic({ x: k.cx, y: k.cy });
  };
  const marcarEditor = () => p.evaluar("bornera.editor.__anterior = true");
  const editorNuevo = () => p.esperarA("bornera.editor.__anterior !== true", 5000);
  const abrirCon = async (ruta) => {
    await marcarEditor();
    p.elegirArchivo(ruta);
    await tecla(O, CTRL);
    await editorNuevo();
    await esperar(150);
  };
  /** El contador de la barra, cuando vence el texto de 4 s de una acción (si lo hay). */
  const contador = async () => {
    await p.esperarA(`!document.querySelector("footer.estado .avisos")?.classList.contains("activo")`, 8000);
    await esperar(30);
    return p.evaluar(`(() => { const e = document.querySelector("footer.estado .avisos"); return { texto: e.textContent.trim(), naranja: e.classList.contains("validaciones") }; })()`);
  };
  /** Las reglas de los avisos del editor, ordenadas ("R6", "R7", …). */
  const reglas = () => p.evaluar("bornera.editor.avisos.lista().map((a) => a.regla).sort()");
  const aviso = () => p.evaluar(`document.querySelector(".avisos")?.textContent.trim() ?? ""`);
  const barra = () => p.evaluar(`[...document.querySelectorAll("footer.estado .dato")].map((e) => e.textContent.trim())`);
  /** Las líneas de la lista de `id` en la escena del editor (null si no tiene). */
  const lineas = (id) => p.evaluar(`(() => { const r = bornera.editor.escena.obtener(${JSON.stringify(id)})?.referencias; return r ? [...r] : null; })()`);
  const seleccion = () => p.evaluar("[...bornera.activo().seleccion].sort()");

  /** Espera una descarga, la lee y vacía la carpeta. */
  const descarga = async (ms = 8000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const todos = readdirSync(carpeta);
      const listos = todos.filter((f) => !f.endsWith(".crdownload") && !f.endsWith(".tmp"));
      if (listos.length > 0 && listos.length === todos.length) {
        await esperar(100);
        const bytes = readFileSync(join(carpeta, listos[0]));
        for (const f of readdirSync(carpeta)) rmSync(join(carpeta, f), { force: true });
        return { nombre: listos[0], bytes, otras: listos.length - 1 };
      }
      await esperar(100);
    }
    return null;
  };

  // ── Desplazar la vista con el botón del medio ──
  let desplazamientos = 0;
  const motivos = [];
  const arrastrarConMedio = async (a, b) => {
    await p.mouse("mouseMoved", a.x, a.y);
    await p.mouse("mousePressed", a.x, a.y, { boton: "middle", botones: 4 });
    for (let i = 1; i <= 6; i++) {
      await p.mouse("mouseMoved", a.x + ((b.x - a.x) * i) / 6, a.y + ((b.y - a.y) * i) / 6, { boton: "middle", botones: 4 });
    }
    await p.mouse("mouseReleased", b.x, b.y, { boton: "middle", botones: 0 });
    await esperar(30);
  };
  /** Deja a la vista la caja de grilla [x0, x1]×[y0, y1], a MARGEN px del borde del lienzo (ver t15). */
  const aLaVista = async (x0, y0, x1, y1, motivo) => {
    for (let i = 0; i < 8; i++) {
      const k = await p.caja("canvas");
      const a = await p.punto(x0, y0);
      const b = await p.punto(x1, y1);
      const fuera = (lo, hi, desde, largo) => lo < desde + MARGEN || hi > desde + largo - MARGEN;
      const limitar = (d, largo) => Math.max(-0.8 * largo, Math.min(0.8 * largo, d));
      const dx = fuera(a.x, b.x, k.x, k.ancho) ? limitar(k.cx - (a.x + b.x) / 2, k.ancho) : 0;
      const dy = fuera(a.y, b.y, k.y, k.alto) ? limitar(k.cy - (a.y + b.y) / 2, k.alto) : 0;
      if (dx === 0 && dy === 0) return;
      await arrastrarConMedio({ x: k.cx - dx / 2, y: k.cy - dy / 2 }, { x: k.cx + dx / 2, y: k.cy + dy / 2 });
      desplazamientos++;
      motivos.push(motivo);
    }
    throw new Error(`No se pudo dejar a la vista ${motivo}.`);
  };

  return {
    tecla, hoja, pasos, titulo, apretar, abrirCon, contador, reglas, aviso, barra, lineas, seleccion, descarga, aLaVista,
    desplazado: () => ({ veces: desplazamientos, motivos: [...motivos] }),
  };
}

async function armar(p, comprobar, h, m, archivos) {
  const { tecla, hoja, pasos, titulo, abrirCon, contador, reglas, aviso, barra, lineas, seleccion, descarga, aLaVista } = h;
  const ref = m.inversion();
  const refHoja = plano(ref.doc.hojas[0]);
  const refComp = (id) => refHoja.componentes.find((c) => c.id === ref.comp[id]);
  /** Gestos que no dieron exactamente un paso de deshacer. */
  const malPaso = [];
  const unPaso = async (que, accion) => {
    const antes = await pasos();
    await accion();
    await esperar(60);
    const d = (await pasos()) - antes;
    if (d !== 1) malPaso.push(`${que}: ${d} pasos`);
    return d === 1;
  };
  /** Rectángulo de selección a la derecha (contiene), de (x0, y0) a (x1, y1). */
  const rectangulo = async (x0, y0, x1, y1, motivo) => {
    await aLaVista(x0, y0, x1, y1, motivo);
    await p.arrastrar(await p.punto(x0, y0), await p.punto(x1, y1));
    await esperar(60);
  };
  /** W con clics; el primero empieza, los del medio son codos, el último termina. */
  const tender = async (que, clics) => {
    const xs = clics.map(([x]) => x);
    const ys = clics.map(([, y]) => y);
    await aLaVista(Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1, `tender ${que}`);
    const cantidad = (await hoja()).cables.length;
    const ok = await unPaso(`cable ${que}`, async () => {
      for (const [x, y] of clics) await p.clic(await p.punto(x, y));
    });
    const lista = (await hoja()).cables;
    if (!ok || lista.length !== cantidad + 1) {
      comprobar(`W: el cable ${que} sale en un gesto`, false, `${lista.length - cantidad} cables, aviso «${await aviso()}»`);
      return null;
    }
    return lista.at(-1);
  };
  /** Clic en el componente en (x, y), el campo del panel, el texto y Enter. */
  const etiquetar = async (x, y, texto, que) => {
    await aLaVista(x - 3, y - 3, x + 4, y + 3, `etiquetar ${que}`);
    await p.clic(await p.punto(x, y));
    await p.esperarA(`bornera.activo().resumenSeleccion().cantidad === 1 && !!document.querySelector("${CAMPO}")`, 5000).catch(() => undefined);
    await esperar(250); // el panel se abre: que el lienzo termine de cambiar de tamaño
    const k = await p.caja(CAMPO);
    if (!k) throw new Error(`El panel no mostró el campo de etiqueta al hacer clic en ${que}.`);
    return unPaso(`etiqueta de ${que}`, async () => {
      await p.clic({ x: k.cx, y: k.cy });
      await p.evaluar(`document.querySelector("${CAMPO}").select()`);
      await p.cdp("Input.insertText", { text: texto });
      await tecla(ENTER);
    });
  };
  const en = (h0, tipo, x, y) => h0.componentes.find((c) => c.tipo === tipo && c.x === x && c.y === y);

  // ── 1. Abrir marcha-parada.brn: «Sin avisos» ──
  await abrirCon(MARCHA_PARADA);
  const h1Hoja = await hoja();
  const s1 = en(h1Hoja, "pulsador.na", 0, 11);
  const k1Aux = en(h1Hoja, "contactor.auxiliar_na", 10, 11);
  const bobina = en(h1Hoja, "contactor.bobina", 0, 22);
  const h1 = en(h1Hoja, "senalizacion.lampara", 16, 22);
  const neutro = en(h1Hoja, "fuente.neutro", 0, 33);
  if (!s1 || !k1Aux || !bobina || !h1 || !neutro) throw new Error("marcha-parada.brn no es la de docs/archivo/plan-T15.md, sección 3.");
  const esBorne = (e, comp, borne) => e.tipo === "borne" && e.comp === comp && e.borne === borne;
  const w4 = h1Hoja.cables.find((w) => esBorne(w.desde, s1.id, "14") && esBorne(w.hasta, bobina.id, "A1"));
  const w7 = h1Hoja.cables.find((w) => w.desde.tipo === "cable" && w.desde.cable === w4?.id && esBorne(w.hasta, h1.id, "X1"));
  if (!w4 || !w7) throw new Error("No están en marcha-parada.brn el cable S1·14–A1 y el de la T de H1.");
  const c1 = await contador();
  comprobar(
    "1. abrir tests/circuitos/marcha-parada.brn: 7 componentes, 8 cables, «Sin avisos» e historial vacío",
    h1Hoja.componentes.length === 7 && h1Hoja.cables.length === 8 && c1.texto === "Sin avisos" && (await pasos()) === 0,
    JSON.stringify({ c1, pasos: await pasos() }),
  );

  // ── 2. Hacer lugar: rectángulo con la bobina, H1 y N, y bajarlos 6 ──
  await rectangulo(-4, 18.5, 24, 37.5, "rectángulo de la bobina, H1 y N");
  const sel2 = await seleccion();
  const cablesSel2 = sel2.filter((id) => h1Hoja.cables.some((w) => w.id === id));
  const compSel2 = sel2.filter((id) => !cablesSel2.includes(id));
  comprobar(
    "2. el rectángulo (a la derecha) toma la bobina, H1 y N con los 2 cables de adentro (A2–N y la T de H1·X2), no los que cruzan el borde",
    isDeepStrictEqual(compSel2, [bobina.id, h1.id, neutro.id].sort()) && cablesSel2.length === 2 && !cablesSel2.includes(w4.id) && !cablesSel2.includes(w7.id),
    JSON.stringify(sel2),
  );
  await unPaso("bajar 6", async () => p.arrastrar(await p.punto(0, 22), await p.punto(0, 28)));
  const h2Hoja = await hoja();
  const bajados = [bobina, h1, neutro].map((c) => h2Hoja.componentes.find((k) => k.id === c.id));
  comprobar(
    "2. arrastrar la bobina baja los 3 a y + 6 en un paso",
    bajados.every((c, i) => c.y === [bobina, h1, neutro][i].y + 6 && c.x === [bobina, h1, neutro][i].x),
    JSON.stringify(bajados.map((c) => [c.x, c.y])),
  );
  comprobar("2. después de bajar, sigue «Sin avisos»", (await contador()).texto === "Sin avisos", (await contador()).texto);
  await p.esc();

  // ── 3. Borrar S1·14–A1 y el cable de la T de H1: clic, Mayús+clic y Supr ──
  await aLaVista(-2, 12, 17, 27, "borrar los dos cables");
  await p.clic(await p.punto(0, 22)); // w4, entre la T (0, 16) y A1 (0, 26)
  await p.clic(await p.punto(8, 16), MAYUS); // w7, tramo horizontal
  const sel3 = await seleccion();
  comprobar("3. clic en S1·14–A1 y Mayús+clic en el de la T de H1: los dos seleccionados", isDeepStrictEqual(sel3, [w4.id, w7.id].sort()), JSON.stringify(sel3));
  await unPaso("borrar los dos cables", () => tecla(SUPR));
  const h3Hoja = await hoja();
  comprobar(
    "3. Supr borra los dos en un paso y no queda ningún cable suelto",
    !h3Hoja.cables.some((w) => w.id === w4.id || w.id === w7.id) && !h3Hoja.cables.some((w) => w.desde.tipo === "libre" || w.hasta.tipo === "libre"),
    JSON.stringify(h3Hoja.cables.map((w) => w.id)),
  );

  // ── 4. El NC desde la paleta en (0, 17), con "K2" en el panel ──
  const items = await p.evaluar(`[...document.querySelectorAll(".item")].map(e => { const r = e.getBoundingClientRect();
    return { texto: e.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`);
  const nombreNC = m.buscarSimbolo(NC)?.nombre;
  const item = items.find((i) => i.texto === nombreNC);
  if (!item) throw new Error(`No está «${nombreNC}» en la paleta.`);
  await aLaVista(-3, 14, 4, 20, "colocar el NC");
  await unPaso("colocar el NC", async () => p.arrastrar(item, await p.punto(0, 17)));
  const ncK1 = (await hoja()).componentes.find((c) => c.tipo === NC);
  comprobar("4. el NC arrastrado desde la paleta queda en (0, 17)", ncK1?.x === 0 && ncK1?.y === 17, JSON.stringify(ncK1));
  if (!ncK1) return null;
  await etiquetar(0, 17, "K2", "el NC");
  await p.esc();
  const c4 = await contador();
  const r4 = await reglas();
  comprobar(
    "4. con el NC «K2» sin cablear, la barra cuenta «5 avisos»: R2 del NC y R7 de K1·A1, H1·X1, NC·21 y NC·22",
    c4.texto === "5 avisos" && isDeepStrictEqual(r4, ["R2", "R7", "R7", "R7", "R7"]),
    JSON.stringify({ c4, r4 }),
  );

  // ── 5 y 6. W: S1·14 → NC·21, NC·22 → A1 y la T de H1 ──
  await tecla(W);
  await tender("S1·14 → NC·21", [[0, 13], [0, 15]]);
  await tender("NC·22 → K1·A1", [[0, 19], [0, 26]]);
  const t6 = await tender("T de H1·X1", [[0, 22], [16, 22], [16, 26]]);
  comprobar("6. H1·X1 vuelve con una T sobre NC·22–A1", t6?.desde?.tipo === "cable" && t6.desde.x === 0 && t6.desde.y === 22, JSON.stringify(t6?.desde));
  await p.esc();
  const c6 = await contador();
  const r6 = await reglas();
  comprobar("6. la rama de K1 cableada: queda «1 aviso», R2 del NC (todavía no hay bobina K2)", c6.texto === "1 aviso" && isDeepStrictEqual(r6, ["R2"]), JSON.stringify({ c6, r6 }));

  // ── 7 y 8. Rectángulo de la rama de K1 y Ctrl+D ──
  await rectangulo(-6, 8.5, 20, 31.5, "rectángulo de la rama de K1");
  const sel7 = await seleccion();
  const h7Hoja = await hoja();
  const compSel7 = sel7.filter((id) => h7Hoja.componentes.some((c) => c.id === id));
  comprobar(
    "7. el rectángulo toma S1, el NA K1, el NC K2, la bobina K1 y H1 (no L, S0 ni N)",
    isDeepStrictEqual(compSel7, [s1.id, k1Aux.id, ncK1.id, bobina.id, h1.id].sort()),
    JSON.stringify(compSel7),
  );
  info(`el rectángulo de la rama toma ${sel7.length - compSel7.length} cables`);
  const antes8 = new Set([...h7Hoja.componentes, ...h7Hoja.cables].map((k) => k.id));
  await unPaso("Ctrl+D", () => tecla(D, CTRL));
  await esperar(100);
  const h8Hoja = await hoja();
  const nuevos = h8Hoja.componentes.filter((c) => !antes8.has(c.id));
  const copia = nuevos.map((c) => `${c.tipo} ${c.etiqueta} (${c.x}, ${c.y})`).sort();
  const esperada = ["s2", "k2Auxiliar", "k1AuxiliarNC", "k2Bobina", "h2"]
    .map((k) => refComp(k))
    .map((c) => `${c.tipo} ${c.tipo === NC ? "K2" : c.etiqueta} (${c.x}, ${c.y})`)
    .sort();
  comprobar(
    "8. Ctrl+D (la tecla): la copia con S2, K2 (NA), K2 (bobina) y H2 donde la rama de K2 de inversion(), y su NC con «K2»",
    isDeepStrictEqual(copia, esperada),
    JSON.stringify(copia),
  );
  const c8 = await contador();
  const r8 = await reglas();
  comprobar(
    "8. la barra cuenta «5 avisos»: R6 del NC de la copia y R7 de S2·13, K2·13, K2·A2 y H2·X2",
    c8.texto === "5 avisos" && isDeepStrictEqual(r8, ["R6", "R7", "R7", "R7", "R7"]),
    JSON.stringify({ c8, r8 }),
  );
  await p.captura("copia-ctrl-d");
  // Ctrl+D es un paso: Ctrl+Z quita toda la copia y Ctrl+Y la devuelve igual.
  await p.esc();
  const despues8 = JSON.stringify(h8Hoja);
  await tecla(Z, CTRL);
  await esperar(60);
  const sinCopia = (await hoja()).componentes.length === h7Hoja.componentes.length && (await hoja()).cables.length === h7Hoja.cables.length;
  await tecla(Y, CTRL);
  await esperar(60);
  comprobar("8. Ctrl+Z quita toda la copia y Ctrl+Y la devuelve igual", sinCopia && JSON.stringify(await hoja()) === despues8);

  // ── 9. En la copia, el NC pasa a "K1" ──
  const ncCopia = nuevos.find((c) => c.tipo === NC);
  await etiquetar(ncCopia.x, ncCopia.y, "K1", "el NC de la copia");
  await p.esc();
  const c9 = await contador();
  const r9 = await reglas();
  comprobar(
    "9. el NC de la copia con «K1»: R6 se va y quedan «4 avisos» (los R7 de la copia)",
    c9.texto === "4 avisos" && isDeepStrictEqual(r9, ["R7", "R7", "R7", "R7"]),
    JSON.stringify({ c9, r9 }),
  );

  // ── 10 y 11. La copia a la red común y al Neutro ──
  const dx = m.DX_RAMA_K2;
  await tecla(W);
  const arriba = await tender("S2·13 → K2·13", [[dx, 9], [dx, 7], [dx + 10, 7], [dx + 10, 9]]);
  const t10 = await tender("T de la red común", [[10, 8], [dx, 8]]);
  info(`T de la red común: desde ${JSON.stringify(t10?.desde)}, hasta ${JSON.stringify(t10?.hasta)}`);
  const abajo = await tender("H2·X2 → T al Neutro", [[dx + 16, 30], [dx + 16, 36], [0, 36]]);
  await tender("K2·A2 → T", [[dx, 30], [dx, 36]]);
  await p.esc();
  if (!arriba || !t10 || !abajo) return null;

  // ── 12. Revisar: «Sin avisos», redes, listas ──
  const final = await hoja();
  const c12 = await contador();
  comprobar("12. al terminar, la barra dice «Sin avisos», sin naranja", c12.texto === "Sin avisos" && !c12.naranja, JSON.stringify(c12));
  comprobar("cada gesto, un paso de deshacer (y Ctrl+D, uno solo)", malPaso.length === 0, malPaso.join(" | "));
  const doc = await p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento))");
  const dif = m.compararRedes(doc, ref.doc);
  comprobar("12. el documento de la página: compararRedes contra inversion(), 0 diferencias", dif.length === 0, dif.join(" | "));
  const bobinas = final.componentes.filter((c) => c.tipo === "contactor.bobina").map((c) => c.etiqueta).sort();
  comprobar("12. una sola bobina K1 y una sola K2", isDeepStrictEqual(bobinas, ["K1", "K2"]), JSON.stringify(bobinas));

  // Listas: dos filas cada una, iguales a un cálculo nuevo y a las de inversion().
  const k2Bobina = nuevos.find((c) => c.tipo === "contactor.bobina");
  const calc = (h0, id) => (m.referenciasCruzadas(h0).get(id) ?? []).map(m.textoFila);
  const listaK1 = await lineas(bobina.id);
  const listaK2 = await lineas(k2Bobina.id);
  comprobar(
    "12. listas: K1 y K2 con dos filas cada una (NA 13-14 y NC 21-22), iguales a un cálculo nuevo y a las de inversion()",
    listaK1?.length === 2 && listaK2?.length === 2 &&
      isDeepStrictEqual(listaK1, calc(final, bobina.id)) && isDeepStrictEqual(listaK2, calc(final, k2Bobina.id)) &&
      isDeepStrictEqual(listaK1, calc(refHoja, ref.comp.k1Bobina)) && isDeepStrictEqual(listaK2, calc(refHoja, ref.comp.k2Bobina)),
    JSON.stringify({ listaK1, listaK2 }),
  );
  info(`lista de K1: ${listaK1?.join(" · ")}; lista de K2: ${listaK2?.join(" · ")}`);

  // Con el mouse en el centro de cada contacto, la barra muestra las coordenadas de su fila.
  const malBarra = [];
  for (const fila of [...(listaK1 ?? []), ...(listaK2 ?? [])]) {
    const q = /\((-?\d+), (-?\d+)\)/.exec(fila);
    if (!q) {
      malBarra.push(`fila sin coordenadas: ${fila}`);
      continue;
    }
    const [x, y] = [Number(q[1]), Number(q[2])];
    await aLaVista(x - 2, y - 2, x + 2, y + 2, `mouse en ${fila}`);
    const c = await p.punto(x, y);
    await p.mouse("mouseMoved", c.x, c.y);
    await esperar(60);
    const [xy] = await barra();
    const b = /X (-?\d+) · Y (-?\d+)/.exec(xy ?? "");
    if (!b || Number(b[1]) !== x || Number(b[2]) !== y) malBarra.push(`${fila}: barra «${xy}»`);
  }
  comprobar("12. con el mouse en el centro de cada uno de los 4 contactos, la barra muestra las coordenadas de su fila", malBarra.length === 0, malBarra.join(" | "));

  // Ninguna caja de lista toca nada.
  const tocados = [];
  let holgura = Infinity;
  for (const [b, ls] of [[bobina.id, listaK1], [k2Bobina.id, listaK2]]) {
    const comp = final.componentes.find((c) => c.id === b);
    const r = m.revisar(m.cajaLista(comp, ls), m.obstaculos(final, b));
    tocados.push(...r.tocados.map((t) => `${comp.etiqueta}: ${t}`));
    holgura = Math.min(holgura, r.holgura);
  }
  comprobar("12. ninguna lista toca un símbolo, una etiqueta, un nombre de borne ni un cable", tocados.length === 0, tocados.join(" | "));
  info(`holgura mínima de las listas: ${holgura.toFixed(2)} (mínimo pedido: ${m.HOLGURA_MINIMA})`);
  await p.captura("listas");

  const { veces, motivos } = h.desplazado();
  info(`se desplazó la vista ${veces} ${veces === 1 ? "vez" : "veces"} (botón del medio)${veces ? `: ${motivos.join(", ")}` : ""}`);
  info(`pasos de deshacer en total: ${await pasos()}`);

  // ── 13. Guardar como (Ctrl+Mayús+S): Ctrl+S pisaría marcha-parada.brn ──
  const tituloAntes = await titulo();
  await tecla(S, CTRL | MAYUS);
  const d = await descarga();
  comprobar("13. Ctrl+Mayús+S descarga un .brn", !!d && d.nombre.endsWith(".brn") && d.otras === 0, JSON.stringify(d && { nombre: d.nombre, otras: d.otras }));
  if (!d) return null;
  info(`título antes de guardar: «${tituloAntes}»; descarga: «${d.nombre}»`);
  const abierto = await m.desempaquetar(new Uint8Array(d.bytes));
  if (!abierto.ok) {
    comprobar("13. el .brn se desempaqueta", false, abierto.error);
    return null;
  }
  const r = m.deserializar(abierto.texto);
  comprobar("13. el .brn abre en Node sin errores ni avisos", r.ok && r.avisos.length === 0, (r.ok ? r.avisos : r.errores).map((x) => `${x.donde} ${x.mensaje}`).join("; "));
  if (!r.ok) return null;
  const difBrn = m.compararRedes(r.documento, ref.doc);
  comprobar("13. compararRedes(.brn, inversion()): 0 diferencias, como npm run circuito con BORNERA_BASE=inversion", difBrn.length === 0, difBrn.join(" | "));
  const ruta = join(archivos, "inversion.brn");
  writeFileSync(ruta, d.bytes);
  return ruta;
}

/** F (encuadrar) con el panel plegado y abierto: el circuito entero en el lienzo libre (como t15). */
async function probarF(p, comprobar, h, tamano, escalaMinTextos) {
  const medir = () =>
    p.evaluar(`(() => { const ed = bornera.activo(), cam = ed.vista.camara, k = ed.escena.caja;
      const cv = document.querySelector("canvas").getBoundingClientRect();
      const a = cam.aPantalla(k.x, k.y), b = cam.aPantalla(k.x + k.ancho, k.y + k.alto);
      const rect = (r) => ({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
      const de = (sel) => { const e = document.querySelector(sel); return e ? rect(e.getBoundingClientRect()) : null; };
      return { circuito: { x0: cv.left + a.x, y0: cv.top + a.y, x1: cv.left + b.x, y1: cv.top + b.y }, lienzo: rect(cv), escala: cam.escala,
        tapan: { paleta: de('aside[aria-label="Paleta de componentes"]'), panel: de('aside[aria-label="Propiedades"]'),
          barra: de("header.barra"), pie: de("footer.estado") },
        campo: !!document.querySelector("${CAMPO}") }; })()`);
  const se = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const revisar = (md) => {
    const c = md.circuito;
    const l = md.lienzo;
    const fuera = c.x0 < l.x0 - 0.5 || c.y0 < l.y0 - 0.5 || c.x1 > l.x1 + 0.5 || c.y1 > l.y1 + 0.5;
    const tocan = Object.entries(md.tapan).filter(([, r]) => r && se(c, r)).map(([n]) => n);
    const r = (q) => `(${px(q.x0)}, ${px(q.y0)})–(${px(q.x1)}, ${px(q.y1)})`;
    return { ok: !fuera && tocan.length === 0, detalle: `circuito ${r(c)}, lienzo ${r(l)}${tocan.length ? `, toca ${tocan.join(" y ")}` : ""}` };
  };
  const contar = (md, cuando) =>
    info(`${tamano}, F ${cuando}: ${px(md.escala)} px por unidad; textos ${md.escala >= escalaMinTextos ? "dibujados" : "OCULTOS"} (desde ${escalaMinTextos})`);

  await p.esc();
  if (await p.caja('button[aria-label="Plegar propiedades"]')) await h.apretar("Plegar propiedades");
  await esperar(250);
  const plegado = !!(await p.caja('button[aria-label="Mostrar propiedades"]'));
  await h.tecla(F);
  await esperar(100);
  let md = await medir();
  let v = revisar(md);
  comprobar(`${tamano}, F con el panel plegado: la inversión entera dentro del lienzo, con los textos dibujados`, plegado && v.ok && md.escala >= escalaMinTextos, `${plegado ? "" : "el panel no se plegó; "}${v.detalle}, ${px(md.escala)} px por unidad`);
  contar(md, "con el panel plegado");

  // Con el panel abierto: clic en la bobina K1 (en (0, 28) después de hacer lugar).
  await p.clic(await p.punto(0, 28));
  await esperar(250);
  if (await p.caja('button[aria-label="Mostrar propiedades"]')) await h.apretar("Mostrar propiedades");
  await p.esperarA(`!!document.querySelector("${CAMPO}")`, 5000).catch(() => undefined);
  await esperar(250);
  await h.tecla(F);
  await esperar(100);
  md = await medir();
  v = revisar(md);
  comprobar(`${tamano}, F con el panel abierto: la inversión entera dentro del lienzo libre, con los textos dibujados`, md.campo && v.ok && md.escala >= escalaMinTextos, `${md.campo ? "" : "el panel no se abrió; "}${v.detalle}, ${px(md.escala)} px por unidad`);
  contar(md, "con el panel abierto");
  await p.esc();
}
