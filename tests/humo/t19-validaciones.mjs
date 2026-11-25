// T19: validaciones en vivo en la app real a 1024×600 (plan T19, sección 5).
//
// Los documentos se arman en Node con `marchaParada()` y se abren con Ctrl+O
// (selector interceptado). Los cambios se hacen con comandos, como el panel o
// las herramientas, y el estado se lee del caché del editor (`editor.avisos`),
// de la barra de estado, del panel y de los píxeles del lienzo.
//  1. La marcha-parada completa: «Sin avisos». El texto de 4 s de Abrir tapa
//     al contador mientras dura.
//  2. Un borne sin cable (H2 X2): «1 aviso» y, con H2 seleccionado, el anillo
//     en X2 y no en X1. Sin selección, sin anillos.
//  3. Una lámpara recién colocada: el contador sube y sus dos bornes llevan
//     anillo. Ctrl+Z la saca.
//  4. Al cablear X2, «Sin avisos» y el anillo se va. Ctrl+Z y Ctrl+Y: el
//     contador y el anillo siguen al documento.
//  5. Un contacto sin etiqueta y uno sin bobina: contorno y nota en el panel.
//  6. Dos bobinas K1: «2 errores», las dos con contorno y con el rótulo
//     «Error» en el panel.
//  7. La previa de Pegar en conflicto y un aviso a la vez: cada uno con su
//     color por píxel (--conflicto y --aviso), sin mezclarse.
//  8. Al 31 % se ven los contornos; alejando hasta apagar los bornes, se
//     apagan y el contador sigue.
//  9. Sin restos al arreglar el último aviso (al 200 %, con documentos recién
//     abiertos, como en t18): el contorno del contacto se va aunque el
//     comando solo nombre a la bobina nueva.
// 10. Mover el mouse no recalcula.
// 11. Guardar y reabrir: los mismos avisos, y el `.brn` no los trae.
// 12. validarHoja en 0 y sin errores de la página.

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Validaciones en vivo";

const N = ["n", "KeyN", 78];
const S = ["s", "KeyS", 83];
const O = ["o", "KeyO", 79];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];
const C = ["c", "KeyC", 67];
const V = ["v", "KeyV", 86];
const DIALOGO = '[role="dialog"][aria-modal="true"]';
const LAMPARA = "senalizacion.lampara";
const BOBINA = "contactor.bobina";
const AUXILIAR = "contactor.auxiliar_na";

export default async function (p, comprobar, { cargar }) {
  const m = {
    ...(await cargar("/src/core/circuitos/marchaParada.ts")),
    ...(await cargar("/src/core/io/index.ts")),
    ...(await cargar("/src/core/model/comandos.ts")),
    ...(await cargar("/src/core/symbols/index.ts")),
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
  const cuenta = () => p.evaluar("({ ...bornera.editor.avisos.cuenta })");
  const lista = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.avisos.lista()))");
  const reglasDe = (id) => p.evaluar(`bornera.editor.avisos.de(${JSON.stringify(id)}).map((a) => a.regla)`);
  const contadores = () =>
    p.evaluar("(() => { const a = bornera.editor.avisos; return { etiqueta: a.pasadasEtiqueta, r6: a.pasadasR6, bornes: a.bornesRevisados }; })()");
  const ejecutar = (expr) =>
    p.evaluar(`(() => { const { editor, comandos: c } = bornera; const cmd = ${expr}; editor.ejecutar(cmd); return cmd.id ?? null; })()`);
  const colocar = (tipo, x, y, etiqueta) =>
    ejecutar(`c.colocar(editor.documento, { tipo: "${tipo}", x: ${x}, y: ${y}, rot: 0, espejado: false, etiqueta: ${JSON.stringify(etiqueta)}, params: {} })`);
  const camara = async (zoom, gx, gy) => {
    await p.evaluar(`(() => { const cv = document.querySelector("canvas[aria-label^=Lienzo]"); const v = bornera.editor.vista;
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
  /** Espera a que la vista no tenga nada por dibujar, 3 cuadros seguidos. */
  const reposo = () =>
    p.evaluar(`new Promise((listo) => { let quietos = 0; const f = () => {
      quietos = bornera.activo().vista.enReposo ? quietos + 1 : 0;
      if (quietos >= 3) listo(true); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
  const foto = async (n) => {
    await reposo();
    await p.evaluar(`(() => { const cv = document.querySelector("canvas[aria-label^=Lienzo]");
      (globalThis.__fotos ??= {})["${n}"] = { w: cv.width, h: cv.height, datos: cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data }; })()`);
  };
  /** Píxeles distintos entre el lienzo de ahora y la foto `n` (−1 si cambió el tamaño). */
  const distintos = async (n) => {
    await reposo();
    return p.evaluar(`(() => { const cv = document.querySelector("canvas[aria-label^=Lienzo]"); const f = globalThis.__fotos["${n}"];
      if (f.w !== cv.width || f.h !== cv.height) return -1;
      const b = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data, a = f.datos;
      let d = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) d++;
      return d; })()`);
  };
  /**
   * Píxeles de la caja de grilla `k` que son --aviso o --conflicto mezclados
   * con el fondo (el antialiasing): el píxel se ajusta a fondo + a·(color −
   * fondo); cuenta si a va de 0,5 a 1,05 y ningún canal se aparta más de 7.
   * Así la marca de borne (--borne, parecida a --aviso) no cuenta como aviso
   * (se aparta de 8 a 16 en claro y en oscuro con a ≥ 0,5), ni un naranja
   * oscurecido por una línea negra cuenta como conflicto.
   */
  const colores = async (k) => {
    await reposo();
    return p.evaluar(`(() => {
      const cv = document.querySelector("canvas[aria-label^=Lienzo]"); const cam = bornera.activo().vista.camara; const dpr = cv.width / cv.clientWidth;
      const css = getComputedStyle(document.documentElement);
      const rgb = (n) => { const h = css.getPropertyValue(n).trim(); return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); };
      const C = { aviso: rgb("--aviso"), conflicto: rgb("--conflicto") };
      const k = ${JSON.stringify(k)};
      const p0 = cam.aPantalla(k.x, k.y), p1 = cam.aPantalla(k.x + k.ancho, k.y + k.alto);
      const x0 = Math.max(0, Math.floor(p0.x * dpr)), y0 = Math.max(0, Math.floor(p0.y * dpr));
      const x1 = Math.min(cv.width, Math.ceil(p1.x * dpr)), y1 = Math.min(cv.height, Math.ceil(p1.y * dpr));
      const salida = { aviso: 0, conflicto: 0, pixeles: Math.max(0, x1 - x0) * Math.max(0, y1 - y0) };
      if (salida.pixeles === 0) return salida;
      const d = cv.getContext("2d").getImageData(x0, y0, x1 - x0, y1 - y0).data;
      // El fondo: el color más común de la caja.
      const veces = new Map();
      for (let i = 0; i < d.length; i += 4) { const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; veces.set(c, (veces.get(c) ?? 0) + 1); }
      const f = [...veces].sort((a, b) => b[1] - a[1])[0][0];
      const F = [(f >> 16) & 255, (f >> 8) & 255, f & 255];
      for (let i = 0; i < d.length; i += 4) {
        for (const [nombre, col] of Object.entries(C)) {
          const D = [col[0] - F[0], col[1] - F[1], col[2] - F[2]];
          const P = [d[i] - F[0], d[i + 1] - F[1], d[i + 2] - F[2]];
          const a = (P[0] * D[0] + P[1] * D[1] + P[2] * D[2]) / (D[0] * D[0] + D[1] * D[1] + D[2] * D[2]);
          if (a < 0.5 || a > 1.05) continue;
          const resto = Math.max(Math.abs(P[0] - a * D[0]), Math.abs(P[1] - a * D[1]), Math.abs(P[2] - a * D[2]));
          if (resto <= 7) salida[nombre]++;
        }
      }
      return salida; })()`);
  };
  const avisoBarra = () => p.evaluar(`document.querySelector("footer.estado .avisos")?.textContent.trim() ?? null`);
  const avisoActivo = () => p.evaluar(`document.querySelector("footer.estado .avisos")?.classList.contains("activo") ?? false`);
  /** El contador de la barra, cuando vence el texto de 4 s de una acción (si lo hay). */
  const contador = async () => {
    await p.esperarA(`!document.querySelector("footer.estado .avisos")?.classList.contains("activo")`, 8000);
    await esperar(30);
    return p.evaluar(`(() => { const e = document.querySelector("footer.estado .avisos"); return { texto: e.textContent.trim(), naranja: e.classList.contains("validaciones") }; })()`);
  };
  const notas = () =>
    p.evaluar(`(() => ({ notas: [...document.querySelectorAll(".notas .nota")].map((e) => e.textContent.trim()),
      errores: [...document.querySelectorAll(".notas .validacion")].map((e) => e.querySelector(".severidad")?.textContent.trim() + ": " + e.querySelector(".nota")?.textContent.trim()) }))()`);
  /** Caja de grilla alrededor de un punto. */
  const alrededor = (x, y, r = 0.8) => ({ x: x - r, y: y - r, ancho: 2 * r, alto: 2 * r });
  /** Caja del cuerpo de un componente (sin rotar) más el margen del contorno y un poco. */
  const cuerpo = (tipo, x, y) => {
    const t = m.buscarSimbolo(tipo).tamano;
    return { x: x - t.ancho / 2 - 0.6, y: y - t.alto / 2 - 0.6, ancho: t.ancho + 1.2, alto: t.alto + 1.2 };
  };
  const bornesDe = (tipo, x, y) =>
    Object.fromEntries(m.bornesColocados(m.buscarSimbolo(tipo).bornes, x, y, { rotacion: 0, espejado: false }).map((b) => [b.nombre, b]));

  /** Escribe un documento armado en Node como .brn (texto plano) y devuelve la ruta. */
  const archivo = (nombreArchivo, doc) => {
    const ruta = join(archivos, nombreArchivo);
    writeFileSync(ruta, m.serializar(doc));
    return ruta;
  };

  // Documentos: la marcha-parada; la de la rama NC sin el último cable (H2 X2
  // sin conectar); y, para "sin restos", la de la rama NC con un NA "K7" sin
  // bobina, con y sin la bobina K7 (la bobina, la última de la hoja).
  const mp = m.marchaParada();
  const rutaMarcha = archivo("marcha-parada.brn", mp.doc);
  const nc = m.marchaParada({ ramaNC: true });
  const h2 = nc.comp.h2;
  nc.historial.deshacer(); // el cable de H2 X2 al Neutro
  const rutaFalta = archivo("falta-x2.brn", nc.doc);
  const ultimo = nc.cables.at(-1);
  if (nc.doc.hojas[0].cables.some((w) => w.id === ultimo)) throw new Error("t19: deshacer no sacó el último cable.");
  const w6 = nc.cables[5];
  const sinBobina = m.marchaParada({ ramaNC: true });
  sinBobina.historial.ejecutar(m.colocar(sinBobina.doc, { tipo: AUXILIAR, x: 34, y: 11, rot: 0, espejado: false, etiqueta: "K7", params: {} }));
  const conBobina = m.marchaParada({ ramaNC: true });
  conBobina.historial.ejecutar(m.colocar(conBobina.doc, { tipo: AUXILIAR, x: 34, y: 11, rot: 0, espejado: false, etiqueta: "K7", params: {} }));
  conBobina.historial.ejecutar(m.colocar(conBobina.doc, { tipo: BOBINA, x: 34, y: 22, rot: 0, espejado: false, etiqueta: "K7", params: {} }));

  // ── 1. La marcha-parada completa ──
  await abrir(rutaMarcha);
  await camara(1, 8, 16);
  const tapa = { activo: await avisoActivo(), texto: await avisoBarra() };
  comprobar(
    "1. al abrir, el texto de 4 s de Abrir tapa al contador",
    tapa.activo && tapa.texto !== "Sin avisos" && /Abiert/.test(tapa.texto ?? ""),
    JSON.stringify(tapa),
  );
  let cont = await contador();
  comprobar(
    "1. la marcha-parada completa: «Sin avisos», sin naranja, y el caché en cero",
    cont.texto === "Sin avisos" && !cont.naranja && isDeepStrictEqual(await cuenta(), { errores: 0, avisos: 0 }),
    JSON.stringify({ cont, cuenta: await cuenta() }),
  );

  // ── 2. Un borne sin cable: H2 X2 ──
  await abrir(rutaFalta);
  await camara(1, 24, 20);
  await p.mouse("mouseMoved", 5, 5); // fuera del lienzo: sin resaltado bajo el cursor
  const hH2 = (await hoja()).componentes.find((c) => c.id === h2);
  const bH2 = bornesDe(LAMPARA, hH2.x, hH2.y);
  cont = await contador();
  comprobar(
    "2. sin el cable de H2 X2: «1 aviso», en naranja, y es R7 de X2",
    cont.texto === "1 aviso" && cont.naranja && isDeepStrictEqual(await lista(), [{ regla: "R7", severidad: "aviso", id: h2, borne: "X2" }]),
    JSON.stringify({ cont, lista: await lista() }),
  );
  const sinSel = { x2: await colores(alrededor(bH2.X2.x, bH2.X2.y)), x1: await colores(alrededor(bH2.X1.x, bH2.X1.y)) };
  await seleccionar([h2]);
  const conSel = { x2: await colores(alrededor(bH2.X2.x, bH2.X2.y)), x1: await colores(alrededor(bH2.X1.x, bH2.X1.y)) };
  comprobar(
    "2. sin selección, ningún anillo: 0 píxeles de aviso en X1 y X2 (la marca del borne no cuenta)",
    sinSel.x2.aviso === 0 && sinSel.x1.aviso === 0,
    JSON.stringify(sinSel),
  );
  comprobar("2. con H2 seleccionado: el anillo en X2 y no en X1", conSel.x2.aviso > 0 && conSel.x1.aviso === 0, JSON.stringify(conSel));
  await p.captura("anillo-x2");

  // ── 3. Una lámpara recién colocada ──
  let n = await pasos();
  const h3 = await colocar(LAMPARA, 34, 22, "H3");
  const bH3 = bornesDe(LAMPARA, 34, 22);
  cont = await contador();
  await seleccionar([h3]);
  const anillosH3 = [await colores(alrededor(bH3.X1.x, bH3.X1.y)), await colores(alrededor(bH3.X2.x, bH3.X2.y))];
  comprobar(
    "3. una lámpara recién colocada: el contador sube a «3 avisos» y sus dos bornes llevan anillo al seleccionarla",
    cont.texto === "3 avisos" && isDeepStrictEqual(await reglasDe(h3), ["R7", "R7"]) && anillosH3.every((c) => c.aviso > 0),
    JSON.stringify({ cont, anillosH3 }),
  );
  await seleccionar([]);
  await tecla(Z, CTRL);
  cont = await contador();
  comprobar("3. Ctrl+Z la saca: «1 aviso»", (await pasos()) === n && cont.texto === "1 aviso", cont.texto);

  // ── 4. Cablear X2: «Sin avisos»; Ctrl+Z y Ctrl+Y ──
  await seleccionar([h2]);
  n = await pasos();
  await ejecutar(`c.cablear(editor.documento, { desde: { tipo: "cable", cable: ${JSON.stringify(w6)}, x: 0, y: 30 }, hasta: { tipo: "borne", comp: ${JSON.stringify(h2)}, borne: "X2" }, codos: [[24, 30]] })`);
  cont = await contador();
  let x2 = await colores(alrededor(bH2.X2.x, bH2.X2.y));
  comprobar(
    "4. al cablear X2: «Sin avisos», sin naranja, y el anillo se va (H2 sigue seleccionado)",
    (await pasos()) === n + 1 && cont.texto === "Sin avisos" && !cont.naranja && x2.aviso === 0,
    JSON.stringify({ cont, x2 }),
  );
  await seleccionar([h2]);
  await tecla(Z, CTRL);
  await seleccionar([h2]);
  cont = await contador();
  x2 = await colores(alrededor(bH2.X2.x, bH2.X2.y));
  comprobar("4. Ctrl+Z: «1 aviso» y el anillo vuelve", (await pasos()) === n && cont.texto === "1 aviso" && x2.aviso > 0, JSON.stringify({ cont, x2 }));
  await tecla(Y, CTRL);
  await seleccionar([h2]);
  cont = await contador();
  x2 = await colores(alrededor(bH2.X2.x, bH2.X2.y));
  comprobar("4. Ctrl+Y: «Sin avisos» y sin anillo", (await pasos()) === n + 1 && cont.texto === "Sin avisos" && x2.aviso === 0, JSON.stringify({ cont, x2 }));
  await seleccionar([]);
  comprobar("4. validarHoja en 0", (await problemas()) === 0);

  // ── 5. Un contacto sin etiqueta y uno sin bobina ──
  // La hoja es ahora la marcha-parada con la rama NC, completa.
  await camara(1, 30, 16);
  const cajaNA = cuerpo(AUXILIAR, 34, 11);
  const antesNA = await colores(cajaNA);
  const na = await colocar(AUXILIAR, 34, 11, "");
  const conNA = await colores(cajaNA);
  await seleccionar([na]);
  await esperar(100);
  const notasR1 = await notas();
  comprobar(
    "5. un contacto sin etiqueta: R1, contorno (píxeles de aviso en su cuerpo) y la nota en el panel",
    (await reglasDe(na)).includes("R1") && antesNA.aviso === 0 && conNA.aviso > 0 && notasR1.notas.includes("Contacto sin etiqueta: no sigue a ninguna bobina."),
    JSON.stringify({ antesNA, conNA, notasR1 }),
  );
  await ejecutar(`new c.CambiarEtiqueta(${JSON.stringify(na)}, "K7")`);
  await esperar(100);
  const notasR2 = await notas();
  const conNA2 = await colores(cajaNA);
  comprobar(
    "5. el mismo contacto con «K7» y sin bobina K7: R2, sigue el contorno y la nota cambia",
    (await reglasDe(na)).includes("R2") && conNA2.aviso > 0 && notasR2.notas.includes("No hay ninguna bobina K7 para este contacto."),
    JSON.stringify({ conNA2, notasR2 }),
  );
  await p.captura("contacto-sin-bobina");
  await seleccionar([]);

  // ── 6. Dos bobinas K1 ──
  await camara(0.6, 20, 18); // K1 en x = 0 y la otra en x = 40, las dos a la vista (12 px por unidad)
  const k1 = nc.comp.k1Bobina;
  const hK1 = (await hoja()).componentes.find((c) => c.id === k1);
  n = await pasos();
  const otra = await colocar(BOBINA, 40, 22, "K1");
  cont = await contador();
  const c6 = await cuenta();
  const contornos6 = [await colores(cuerpo(BOBINA, hK1.x, hK1.y)), await colores(cuerpo(BOBINA, 40, 22))];
  await seleccionar([otra]);
  await esperar(100);
  const notas6 = await notas();
  comprobar(
    "6. dos bobinas K1: «2 errores» en la barra (uno por bobina) y R4 error en las dos",
    c6.errores === 2 &&
      cont.texto.startsWith("2 errores") &&
      (await reglasDe(k1)).includes("R4") &&
      (await reglasDe(otra)).includes("R4"),
    JSON.stringify({ cont, c6 }),
  );
  comprobar(
    "6. las dos bobinas K1 con contorno, y el panel con el rótulo «Error» y el texto de R4",
    contornos6.every((c) => c.aviso > 0) && notas6.errores.some((e) => e === "Error: Otra bobina de contactor ya se llama K1."),
    JSON.stringify({ contornos6, notas6 }),
  );
  await p.captura("dos-k1");
  await seleccionar([]);
  await tecla(Z, CTRL);
  comprobar("6. Ctrl+Z: sin errores", (await pasos()) === n && (await cuenta()).errores === 0, JSON.stringify(await cuenta()));

  // ── 7. La previa de Pegar en conflicto y un aviso, a la vez ──
  // El NA "K7" sigue con su contorno. Se copia H1 y se pega encima de sí mismo.
  const h1 = nc.comp.h1;
  const hH1 = (await hoja()).componentes.find((c) => c.id === h1);
  await seleccionar([h1]);
  await tecla(C, CTRL);
  await seleccionar([]);
  const sobreH1 = async (dx) => {
    const q = await p.punto(hH1.x + dx, hH1.y);
    await p.mouse("mouseMoved", q.x, q.y);
    await esperar(40);
  };
  await sobreH1(1);
  await tecla(V, CTRL);
  await sobreH1(0);
  const pv = await p.evaluar(`(() => { const h = bornera.editor.pegando; const v = h?.previa; return v ? { dx: v.dx, dy: v.dy, conflictos: v.conflictos.length } : null; })()`);
  comprobar("7. la previa de pegar sobre H1 está en conflicto", pv?.dx === 0 && pv.dy === 0 && pv.conflictos > 0, JSON.stringify(pv));
  // En los dos temas, sin depender del de la máquina (la vista escucha el cambio y redibuja).
  try {
    for (const tema of ["light", "dark"]) {
      await p.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: tema }] });
      await esperar(150);
      const enPrevia = await colores(cuerpo(LAMPARA, hH1.x, hH1.y));
      const enAviso = await colores(cajaNA);
      comprobar(
        `7. en ${tema === "light" ? "claro" : "oscuro"}: la previa en conflicto en --conflicto y no en --aviso; el contorno del contacto en --aviso y no en --conflicto`,
        enPrevia.conflicto > 0 && enPrevia.aviso === 0 && enAviso.aviso > 0 && enAviso.conflicto === 0,
        JSON.stringify({ enPrevia, enAviso }),
      );
      await p.captura(`previa-y-aviso-${tema === "light" ? "claro" : "oscuro"}`);
    }
  } finally {
    await p.cdp("Emulation.setEmulatedMedia", { features: [] });
    await esperar(150);
  }
  await p.esc();

  // ── 8. Al 31 % y alejando ──
  await camara(0.31, 20, 16);
  await p.mouse("mouseMoved", 5, 5);
  const c31 = await colores(cajaNA);
  const cuenta31 = await cuenta();
  const texto31 = (await contador()).texto;
  comprobar("8. al 31 %, el contorno del contacto se ve", m.nivelDetalle(m.PX_POR_UNIDAD * 0.31).bornes && c31.aviso > 0, JSON.stringify(c31));
  await p.captura("al-31");
  await camara(0.25, 20, 16);
  const c25 = await colores(cajaNA);
  comprobar(
    "8. al 25 %, con los bornes apagados, el contorno se apaga y el contador sigue",
    !m.nivelDetalle(m.PX_POR_UNIDAD * 0.25).bornes && c25.aviso === 0 && isDeepStrictEqual(await cuenta(), cuenta31) && (await contador()).texto === texto31,
    JSON.stringify({ c25, texto31, cuenta: await cuenta() }),
  );
  await p.captura("al-25");

  // ── 9. Sin restos al arreglar el último aviso ──
  // Al 200 %, un mosaico mide 6,4 unidades: el NA (y = 11) y la bobina nueva
  // (y = 22) caen en mosaicos distintos. Colocar la bobina solo nombra a la
  // bobina, pero el contorno del NA se tiene que ir.
  const rutaCon = archivo("con-bobina.brn", conBobina.doc);
  const rutaSin = archivo("sin-bobina.brn", sinBobina.doc);
  const referencia = async (ruta, nombreFoto) => {
    await abrir(ruta);
    await camara(2, 34, 16.5);
    await p.mouse("mouseMoved", 5, 5);
    await foto(nombreFoto);
  };
  await referencia(rutaCon, "con");
  await referencia(rutaSin, "sin");
  const naSin = (await hoja()).componentes.find((c) => c.tipo === AUXILIAR && c.etiqueta === "K7").id;
  const dRef = await distintos("con");
  comprobar(
    "9. las referencias difieren (con el contorno del NA y sin la bobina K7) y el NA tiene R2",
    dRef > 0 && (await reglasDe(naSin)).includes("R2") && (await colores(cuerpo(AUXILIAR, 34, 11))).aviso > 0,
    `${dRef} píxeles distintos`,
  );
  n = await pasos();
  await colocar(BOBINA, 34, 22, "K7");
  let d = await distintos("con");
  comprobar(
    "9. colocar la bobina K7: el NA pierde R2 y el lienzo entero queda igual al documento recién abierto con la bobina",
    !(await reglasDe(naSin)).includes("R2") && d === 0,
    `${d} píxeles distintos`,
  );
  await tecla(Z, CTRL);
  d = await distintos("sin");
  comprobar("9. Ctrl+Z: el contorno vuelve, igual al documento recién abierto sin la bobina", (await pasos()) === n && d === 0, `${d} píxeles distintos`);
  await tecla(Y, CTRL);
  d = await distintos("con");
  comprobar("9. Ctrl+Y: otra vez sin restos", (await pasos()) === n + 1 && d === 0, `${d} píxeles distintos`);
  await p.captura("sin-restos");

  // ── 10. Mover el mouse no recalcula ──
  await camara(1, 20, 16);
  const antes10 = await contadores();
  const lienzo = await p.caja("canvas[aria-label^=Lienzo]");
  for (let i = 0; i <= 30; i++) await p.mouse("mouseMoved", lienzo.x + (lienzo.ancho * i) / 30, lienzo.y + lienzo.alto * (0.2 + (0.6 * i) / 30));
  await esperar(60);
  comprobar("10. mover el mouse por el lienzo no recalcula ninguna validación", isDeepStrictEqual(await contadores(), antes10), JSON.stringify({ antes10, despues: await contadores() }));

  // ── 11. Guardar y reabrir ──
  // Con avisos de varias reglas: el NA "K7" sin bobina (Ctrl+Z de la bobina) y una lámpara sin etiqueta.
  await tecla(Z, CTRL);
  await colocar(LAMPARA, 40, 22, "");
  const lista11 = await lista();
  await tecla(S, CTRL);
  const bytes = await esperarDescarga(carpeta);
  comprobar("11. Ctrl+S descarga el circuito", bytes !== null);
  if (bytes) {
    const texto = bytes.toString("utf8");
    comprobar("11. el .brn no trae avisos", !/aviso|validaci|"R[1-9]"/i.test(texto));
    const ruta = join(archivos, "con-avisos.brn");
    writeFileSync(ruta, bytes);
    await abrir(ruta);
    comprobar(
      "11. reabierto: los mismos avisos",
      lista11.length > 0 && isDeepStrictEqual(await lista(), lista11),
      JSON.stringify({ antes: lista11.map((a) => a.regla), despues: (await lista()).map((a) => a.regla) }),
    );
  }

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
