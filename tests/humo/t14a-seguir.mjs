// T14a: los extremos siguen al borne. Con el mouse de verdad, a 1024×600:
// arrastrar un contactor cableado (un paso, los cables lo siguen ortogonales;
// la previa da los mismos píxeles que el resultado), R y M; un grupo con
// cables internos y externos; T en cadena (A ← B ← C); soltar donde no vale
// (documento igual, aviso sin ids, sin restos); Esc, botón derecho, cambio de
// modo y de escena en medio del gesto (todo vuelve exacto, sin restos); el
// menú contextual se suprime durante el gesto y fuera de él no; selección
// mezclada con R, Mayús+R, M, Supr, Ctrl+Z y Ctrl+Y; colocar sobre un cable
// no coloca; y sin restos tras soltar, deshacer y rehacer, también con la
// escena corrida (10, 20).

import { CTRL, esperar, MAYUS } from "./cdp.mjs";

export const nombre = "Extremos que siguen al borne";

const R = ["r", "KeyR", 82];
const M = ["m", "KeyM", 77];
const SUPR = ["Delete", "Delete", 46];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];
const F5 = ["F5", "F5", 116];
const B = ["B", "KeyB", 66];
/** Ids internos en un texto ("w3", "c7"): los avisos no los muestran. */
const CON_IDS = /\b[wc]\d+\b/;

export default async function (p, comprobar) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods);
  const reposo = () =>
    p.evaluar(`new Promise((listo) => { let quietos = 0; const f = () => {
      quietos = bornera.activo().vista.enReposo ? quietos + 1 : 0;
      if (quietos >= 3) listo(true); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
  const foto = async (n) => {
    await reposo();
    await p.evaluar(`(() => { const cv = document.querySelector("canvas");
      (globalThis.__fotos ??= {})["${n}"] = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; })()`);
  };
  /** Píxeles del lienzo distintos de la foto `n` (la barra de estado y el panel no son del lienzo). */
  const distintos = async (n) => {
    await reposo();
    return p.evaluar(`(() => { const cv = document.querySelector("canvas");
      const a = globalThis.__fotos["${n}"], b = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      if (a.length !== b.length) return -1; let k = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) k++;
      return k; })()`);
  };
  /** Dónde están los píxeles distintos de la foto `n`: su caja en unidades de grilla (para el detalle de una falla). */
  const donde = (n) =>
    p.evaluar(`(() => { const cv = document.querySelector("canvas"); const k = cv.width / cv.clientWidth;
      const a = globalThis.__fotos["${n}"], b = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
        const x = (i / 4) % cv.width, y = Math.floor(i / 4 / cv.width); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      if (x0 === Infinity) return "";
      const cam = bornera.activo().vista.camara, g0 = cam.aGrilla(x0 / k, y0 / k), g1 = cam.aGrilla(x1 / k, y1 / k), f = (v) => v.toFixed(1);
      return " en (" + f(g0.x) + ", " + f(g0.y) + ")–(" + f(g1.x) + ", " + f(g1.y) + ")"; })()`);
  const pasos = () => p.evaluar("bornera.activo().historial.hechos.length");
  const documento = () => p.evaluar("JSON.stringify(bornera.editor.documento.hojas)");
  const seleccionar = (ids) => p.evaluar(`bornera.editor.seleccionarIds(${JSON.stringify(ids)})`);
  const aviso = () => p.evaluar(`document.querySelector(".avisos")?.textContent.trim() ?? null`);
  const pista = () => p.evaluar(`document.querySelector("footer .pista-herramienta")?.textContent.trim() ?? null`);
  const camara = (gx, gy) =>
    p.evaluar(`(() => { const cv = document.querySelector("canvas"); const v = bornera.editor.vista;
      v.camara.zoom = 1; v.camara.centrar(${gx}, ${gy}, cv.clientWidth, cv.clientHeight); v.invalidar(); })()`);
  /** La hoja vale, todos los tramos son ortogonales y sin largo cero, y cada T está sobre su anfitrión. */
  const sana = () =>
    p.evaluar(`(() => { const { cables: k, editor: ed } = bornera; const h = ed.documento.hojas[0];
      if (k.validarHoja(h).length > 0) return "validarHoja: " + JSON.stringify(k.validarHoja(h));
      const ind = k.indexarHoja(h);
      for (const w of h.cables) { const q = k.recorridoCable(ind, w);
        for (let i = 0; i + 3 < q.length; i += 2) { const dx = q[i + 2] - q[i], dy = q[i + 3] - q[i + 1];
          if ((dx !== 0) === (dy !== 0)) return w.id + " no es ortogonal: " + q.join(","); }
        for (const e of [w.desde, w.hasta]) if (e.tipo === "cable" && !k.puntoSobreRecorrido(k.recorridoCable(ind, ind.cables.get(e.cable)), e.x, e.y))
          return w.id + " no está sobre " + e.cable; }
      return "bien"; })()`);
  /** Nada quedó oculto en la escena ni hay un arrastre en curso. */
  const limpio = () =>
    p.evaluar(`(() => { const ed = bornera.editor, h = ed.documento.hojas[0];
      return !ed.arrastrando && h.componentes.every((c) => !ed.escena.oculto(c.id)) && h.cables.every((w) => !ed.escena.cableOculto(w.id)); })()`);
  const recorrido = (id) =>
    p.evaluar(`(() => { const { cables: k, editor: ed } = bornera; const h = ed.documento.hojas[0];
      return k.recorridoCable(k.indexarHoja(h), h.cables.find((w) => w.id === "${id}")).join(","); })()`);

  // ── Mouse en puntos de grilla ──
  const a = async (gx, gy) => p.punto(gx, gy);
  const apretar = async (gx, gy) => {
    const q = await a(gx, gy);
    await p.mouse("mouseMoved", q.x, q.y);
    await p.mouse("mousePressed", q.x, q.y);
  };
  /** Con el botón apretado, de (x0, y0) a (x1, y1) en 6 pasos. */
  const llevar = async (x0, y0, x1, y1) => {
    for (let i = 1; i <= 6; i++) {
      const q = await a(x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6);
      await p.mouse("mouseMoved", q.x, q.y, { botones: 1 });
    }
    await esperar(30);
  };
  const soltar = async (gx, gy) => {
    const q = await a(gx, gy);
    await p.mouse("mouseReleased", q.x, q.y);
    await esperar(30);
  };
  const arrastrar = async (x0, y0, x1, y1) => {
    await apretar(x0, y0);
    await llevar(x0, y0, x1, y1);
    await soltar(x1, y1);
  };

  /**
   * La escena corrida (dx, dy), con comandos. K1 (−6, 0) y S1 (0, 0): w1 de
   * A1 a 13 recto, w2 de A2 a 14 por abajo (y = 5). H0 (−14, 0): w3 de su X1
   * a K1.A1 por arriba (y = −5). wB: T sobre w3 en (−10, −5), sube a (−10, −9).
   * wC: T sobre wB en (−10, −7), a (−7, −7). Cadena: w3 ← wB ← wC.
   */
  const armar = (dx, dy) =>
    p.evaluar(`(() => { const { editor: ed, comandos: c } = bornera; const d = ed.documento;
      const comp = (tipo, x, y, etiqueta) => { const k = c.colocar(d, { tipo, x: x + ${dx}, y: y + ${dy}, rot: 0, espejado: false, etiqueta, params: {} }); ed.ejecutar(k); return k.id; };
      const b = (comp, borne) => ({ tipo: "borne", comp, borne });
      const l = (x, y) => ({ tipo: "libre", x: x + ${dx}, y: y + ${dy} });
      const t = (cable, x, y) => ({ tipo: "cable", cable, x: x + ${dx}, y: y + ${dy} });
      const cab = (desde, hasta, codos = []) => {
        const k = c.cablear(d, { desde, hasta, codos: codos.map(([x, y]) => [x + ${dx}, y + ${dy}]) }); ed.ejecutar(k); return k.id; };
      const K1 = comp("contactor.bobina", -6, 0, "K1");
      const S1 = comp("pulsador.na", 0, 0, "S1");
      const H0 = comp("senalizacion.lampara", -14, 0, "H0");
      const w1 = cab(b(K1, "A1"), b(S1, "13"));
      const w2 = cab(b(K1, "A2"), b(S1, "14"), [[-6, 5], [0, 5]]);
      const w3 = cab(b(H0, "X1"), b(K1, "A1"), [[-14, -5], [-6, -5]]);
      const wB = cab(t(w3, -10, -5), l(-10, -9));
      const wC = cab(t(wB, -10, -7), l(-7, -7));
      return { K1, S1, H0, w1, w2, w3, wB, wC }; })()`);

  // Un componente lejos abre el panel (cambia el ancho del lienzo) antes de las fotos.
  const lejos = await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
    const k = c.colocar(editor.documento, { tipo: "contactor.bobina", x: 500, y: 500, rot: 0, espejado: false, etiqueta: "X", params: {} });
    editor.ejecutar(k); return k.id; })()`);
  await seleccionar([lejos]);
  await p.esc();
  await esperar(200);
  const pasosBase = await pasos();
  const volver = () => p.evaluar(`(() => { const ed = bornera.editor; while (ed.historial.hechos.length > ${pasosBase}) ed.deshacer(); })()`);

  const e = await armar(0, 0);
  comprobar("la escena de prueba es válida", (await sana()) === "bien", await sana());
  await camara(-6, -1);
  await p.esc();
  await foto("ref");
  const docRef = await documento();

  // ── Previa = resultado (píxeles) ──
  // La previa se fotografía con el mouse apretado en el destino; al soltar, la
  // selección y el mouse quedan iguales (la barra de estado no es del lienzo).
  // Se compara sin mosaicos: así la capa estática se dibuja directo en
  // pantalla, con la misma transformación que la dinámica. Con mosaicos, el
  // mismo trazo diagonal o curvo rasterizado en coordenadas del mosaico y de
  // la pantalla puede dar otro suavizado en algún píxel (pasa también moviendo
  // un símbolo solo, sin cables, desde T9): eso se informa, pero no mide la previa.
  const previaIgual = async (conMosaicos) => {
    await p.evaluar(`(() => { const v = bornera.editor.vista; v.opciones = { ...v.opciones, cache: ${conMosaicos} }; v.invalidar(); })()`);
    await apretar(-6, 0);
    await llevar(-6, 0, -6, 3);
    const valia = (await pista()) ?? "";
    await foto("previa");
    await soltar(-6, 3);
    const d = await distintos("previa");
    const lugar = await donde("previa");
    await p.esc();
    await tecla(Z, CTRL);
    await p.evaluar(`(() => { const v = bornera.editor.vista; v.opciones = { ...v.opciones, cache: true }; v.invalidar(); })()`);
    return { valia, d, lugar };
  };
  const sinMosaicos = await previaIgual(false);
  comprobar("mientras se arrastra, la previa vale (sin pista de rechazo)", sinMosaicos.valia === "", sinMosaicos.valia);
  comprobar(
    "previa = resultado: el lienzo da los mismos píxeles antes y después de soltar (dibujo directo)",
    sinMosaicos.d === 0,
    `${sinMosaicos.d} píxeles distintos${sinMosaicos.lugar}`,
  );
  const conMosaicos = await previaIgual(true);
  console.log(`  ·   con mosaicos: ${conMosaicos.d} píxeles con otro suavizado${conMosaicos.lugar}`);
  comprobar("después de comparar, todo como antes", (await documento()) === docRef);

  // ── Arrastrar K1 con sus cables: un paso, ortogonales; Ctrl+Z y Ctrl+Y exactos ──
  let n = await pasos();
  await arrastrar(-6, 0, -6, 3);
  let d;
  await p.captura("arrastre");
  comprobar("arrastrar K1 con sus cables es un paso", (await pasos()) === n + 1);
  comprobar("los cables siguen a los bornes, ortogonales, y las T sobre su anfitrión", (await sana()) === "bien", await sana());
  comprobar("nada quedó oculto", await limpio());
  const docMovido = await documento();
  await p.esc();
  await foto("movido");
  await tecla(Z, CTRL);
  d = await distintos("ref");
  comprobar("Ctrl+Z devuelve todo exacto y sin restos", (await documento()) === docRef && d === 0, `${d} píxeles distintos`);
  await tecla(Y, CTRL);
  d = await distintos("movido");
  comprobar("Ctrl+Y vuelve al resultado, también en píxeles", (await documento()) === docMovido && d === 0, `${d} píxeles distintos${await donde("movido")}`);
  await tecla(Z, CTRL);

  // ── R y M sobre K1 ──
  await seleccionar([e.K1]);
  n = await pasos();
  await tecla(R);
  const trasR = [await pasos(), await sana()];
  await tecla(M);
  const trasM = [await pasos(), await sana()];
  comprobar("R sobre K1 cableado: un paso y todo sano", trasR[0] === n + 1 && trasR[1] === "bien", JSON.stringify(trasR));
  comprobar("M sobre K1 cableado: un paso y todo sano", trasM[0] === n + 2 && trasM[1] === "bien", JSON.stringify(trasM));
  await p.esc();
  await tecla(Z, CTRL);
  await tecla(Z, CTRL);
  d = await distintos("ref");
  comprobar("dos Ctrl+Z devuelven todo exacto y sin restos", (await documento()) === docRef && d === 0, `${d} píxeles distintos`);

  // ── Grupo con cables internos (w1, w2: se trasladan) y externos (w3: se acomoda) ──
  const w1Antes = await recorrido(e.w1);
  await seleccionar([e.K1, e.S1]);
  n = await pasos();
  await arrastrar(-6, 0, -4, 3);
  const corrido = (s) => s.split(",").map((v, i) => Number(v) + (i % 2 === 0 ? 2 : 3)).join(",");
  comprobar(
    "un grupo con cables internos y externos: un paso, el interno se traslada entero y todo queda sano",
    (await pasos()) === n + 1 && (await recorrido(e.w1)) === corrido(w1Antes) && (await sana()) === "bien",
    `${await recorrido(e.w1)} · ${await sana()}`,
  );
  await p.esc();
  await tecla(Z, CTRL);
  comprobar("Ctrl+Z del grupo, exacto", (await documento()) === docRef);

  // ── T en cadena: K1 y H0 juntos (w3 rígido): wB sigue a su T y wC a la de wB ──
  const [bAntes, cAntes] = [await recorrido(e.wB), await recorrido(e.wC)];
  await seleccionar([e.K1, e.H0]);
  n = await pasos();
  await arrastrar(-6, 0, -5, 0);
  const [bDespues, cDespues] = [await recorrido(e.wB), await recorrido(e.wC)];
  comprobar(
    "T en cadena: la derivación y la derivación de la derivación siguen, sobre su anfitrión",
    (await pasos()) === n + 1 && bDespues !== bAntes && cDespues !== cAntes && (await sana()) === "bien",
    `wB ${bAntes} → ${bDespues} · wC ${cAntes} → ${cDespues} · ${await sana()}`,
  );
  await p.esc();
  await tecla(Z, CTRL);
  d = await distintos("ref");
  comprobar("Ctrl+Z de la cadena, exacto y sin restos", (await documento()) === docRef && d === 0, `${d} píxeles distintos`);

  // ── Soltar donde no vale: K1 sobre S1 ──
  n = await pasos();
  await apretar(-6, 0);
  await llevar(-6, 0, 0, 0);
  const pistaRechazo = (await pista()) ?? "";
  await soltar(0, 0);
  const avisoRechazo = (await aviso()) ?? "";
  // K1 quedó seleccionado (se apretó sobre él): sin selección, como la foto de referencia.
  await p.esc();
  d = await distintos("ref");
  comprobar(
    "soltar donde no vale: la pista y el aviso dicen por qué (borne sobre borne, sin ids)",
    pistaRechazo.startsWith("No se puede mover acá: el borne K1 · A1 quedaría sobre el borne S1 · 13") &&
      avisoRechazo === pistaRechazo &&
      !CON_IDS.test(avisoRechazo),
    `${pistaRechazo} / ${avisoRechazo}`,
  );
  comprobar(
    "y no da paso, el documento queda igual y sin restos",
    (await pasos()) === n && (await documento()) === docRef && d === 0 && (await limpio()),
    `${d} píxeles distintos${await donde("ref")}`,
  );

  // ── El menú contextual: se suprime durante el gesto; fuera, no ──
  await p.evaluar(`(() => { globalThis.__menu = []; if (!globalThis.__menuPuesto) { globalThis.__menuPuesto = true;
    addEventListener("contextmenu", (ev) => globalThis.__menu.push(ev.defaultPrevented)); } })()`);
  const menu = () => p.evaluar("JSON.stringify(globalThis.__menu)");
  const derechoEn = async (gx, gy, botonesAntes) => {
    const q = await a(gx, gy);
    await p.mouse("mousePressed", q.x, q.y, { boton: "right", botones: botonesAntes | 2 });
    await p.mouse("mouseReleased", q.x, q.y, { boton: "right", botones: botonesAntes });
    await esperar(30);
  };

  // ── Cortes del gesto: todo vuelve exacto, sin paso y sin restos ──
  const cortes = [
    ["Esc", async () => p.esc()],
    ["botón derecho", async () => derechoEn(-6, 3, 1)],
    [
      // F5 no cambia de modo durante un gesto (T11); el botón de modo sí puede
      // llegar (con el teclado, o un clic con otro puntero).
      "cambio de modo (botón Simular)",
      async () => {
        await p.evaluar(`document.querySelector(".modo button.simular").click()`);
        await esperar(50);
      },
    ],
    [
      "cambio de escena (Ctrl+Shift+B)",
      async () => {
        await tecla(B, CTRL | MAYUS);
        await p.esperarA("bornera.activo() !== bornera.editor");
      },
    ],
  ];
  let menuEnGesto = null;
  // F5 en medio del gesto no cambia de modo (T11): el arrastre sigue y Esc lo corta.
  await apretar(-6, 0);
  await llevar(-6, 0, -6, 3);
  await tecla(F5);
  const modoTrasF5 = await p.evaluar(`document.querySelector(".modo button.simular").getAttribute("aria-pressed")`);
  const sigue = await p.evaluar("bornera.editor.arrastrando");
  await p.esc();
  await soltar(-6, 3);
  comprobar("F5 en medio del arrastre no cambia de modo y el arrastre sigue", modoTrasF5 === "false" && sigue === true, `${modoTrasF5} ${sigue}`);
  for (const [cual, cortar] of cortes) {
    n = await pasos();
    await apretar(-6, 0);
    await llevar(-6, 0, -6, 3);
    const arrastrando = await p.evaluar("bornera.editor.arrastrando");
    if (cual === "botón derecho") await p.evaluar("globalThis.__menu = []");
    await cortar();
    if (cual === "botón derecho") menuEnGesto = await menu();
    await soltar(-6, 3);
    // Volver a donde estaba: Editar y el documento.
    if (cual.startsWith("cambio de modo")) {
      await p.evaluar(`document.querySelector(".modo button:not(.simular)").click()`);
      await p.esperarA(`document.querySelector(".modo button.simular").getAttribute("aria-pressed") === "false"`);
    }
    if (cual.startsWith("cambio de escena")) {
      for (let i = 0; i < 5 && (await p.evaluar("bornera.activo() !== bornera.editor")); i++) await tecla(B, CTRL | MAYUS);
      await p.esperarA("bornera.activo() === bornera.editor");
      await camara(-6, -1);
    }
    await p.esc();
    d = await distintos("ref");
    comprobar(
      `${cual} en medio del arrastre: todo vuelve exacto, sin paso y sin restos`,
      arrastrando && (await pasos()) === n && (await documento()) === docRef && (await limpio()) && d === 0,
      `arrastrando ${arrastrando} · pasos ${await pasos()}/${n} · ${d} píxeles distintos${await donde("ref")}`,
    );
  }
  await p.evaluar("globalThis.__menu = []");
  await derechoEn(-30, -12, 0);
  const menuFuera = await menu();
  if (menuEnGesto === "[]" && menuFuera === "[]") {
    // El navegador no mandó contextmenu por el botón derecho de CDP: se prueba el manejador con un evento sintético.
    const r = await p.evaluar(`(() => { const cv = document.querySelector("canvas");
      const enGesto = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, buttons: 1 });
      const fuera = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, buttons: 0 });
      cv.dispatchEvent(enGesto); cv.dispatchEvent(fuera); return [enGesto.defaultPrevented, fuera.defaultPrevented]; })()`);
    comprobar("menú contextual (evento sintético): suprimido con el botón apretado, normal sin gesto", r[0] === true && r[1] === false, JSON.stringify(r));
  } else {
    comprobar("el menú contextual se suprime durante el gesto", menuEnGesto !== "[]" && !menuEnGesto.includes("false"), menuEnGesto);
    comprobar("y fuera del gesto, sin herramienta, sale normal", menuFuera === "[false]", menuFuera);
  }
  // Un menú que se haya abierto no debe quedar tapando: Esc.
  await p.esc();

  // ── Selección mezclada: R, Mayús+R, M, Supr; Ctrl+Z y Ctrl+Y ──
  await seleccionar([e.K1, e.w1, e.w2]);
  n = await pasos();
  const trasCada = [];
  for (const [k, mods] of [
    [R, 0],
    [R, MAYUS],
    [M, 0],
  ]) {
    await tecla(k, mods);
    trasCada.push([await pasos(), await sana()]);
  }
  comprobar(
    "selección mezclada (K1 y sus dos cables): R, Mayús+R y M dan un paso cada uno, todo sano",
    trasCada.every(([k, s], i) => k === n + i + 1 && s === "bien"),
    JSON.stringify(trasCada) + " · " + ((await aviso()) ?? ""),
  );
  await tecla(SUPR);
  comprobar(
    "Supr borra la selección mezclada en un paso",
    (await pasos()) === n + 4 && (await p.evaluar(`!bornera.editor.escena.obtenerCable("${e.w1}") && !bornera.editor.escena.obtener("${e.K1}")`)),
  );
  await p.esc();
  await foto("mezcla");
  const docMezcla = await documento();
  for (let i = 0; i < 4; i++) await tecla(Z, CTRL);
  d = await distintos("ref");
  comprobar("cuatro Ctrl+Z devuelven todo exacto y sin restos", (await documento()) === docRef && d === 0, `${d} píxeles distintos`);
  for (let i = 0; i < 4; i++) await tecla(Y, CTRL);
  d = await distintos("mezcla");
  comprobar("cuatro Ctrl+Y dan lo mismo que antes", (await documento()) === docMezcla && d === 0, `${d} píxeles distintos`);
  for (let i = 0; i < 4; i++) await tecla(Z, CTRL);
  const avisosConIds = (await aviso()) ?? "";
  comprobar("los avisos no muestran ids internos", !CON_IDS.test(avisosConIds), avisosConIds);

  // ── Colocar sobre un cable no coloca ──
  const lampara = await p.evaluar(`(() => { const e = [...document.querySelectorAll(".item")].find((x) => x.textContent.trim() === "Lámpara");
    const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await p.clic(lampara);
  n = await pasos();
  const sobreCable = await a(-3, 5); // el tramo de abajo de w2
  await p.mouse("mouseMoved", sobreCable.x, sobreCable.y);
  await esperar(30);
  const pistaColocar = (await pista()) ?? "";
  await p.clic(sobreCable);
  comprobar(
    "colocar una lámpara sobre un cable no coloca y la barra dice por qué",
    (await pasos()) === n && pistaColocar.startsWith("No se puede colocar acá: ") && !CON_IDS.test(pistaColocar),
    pistaColocar,
  );
  await p.esc();
  d = await distintos("ref");
  comprobar("después de Esc, sin restos de la previa", (await documento()) === docRef && d === 0, `${d} píxeles distintos`);

  // ── Sin restos con la escena corrida (10, 20): soltar, deshacer y rehacer ──
  await volver();
  await armar(10, 20);
  await camara(4, 19);
  await p.esc();
  await foto("corrida");
  const docCorrida = await documento();
  n = await pasos();
  await arrastrar(4, 20, 4, 23);
  comprobar("con la escena corrida, arrastrar K1 es un paso y queda sano", (await pasos()) === n + 1 && (await sana()) === "bien", await sana());
  await p.esc();
  await foto("corrida-movida");
  await tecla(Z, CTRL);
  d = await distintos("corrida");
  comprobar("con la escena corrida, Ctrl+Z sin restos", (await documento()) === docCorrida && d === 0, `${d} píxeles distintos`);
  await tecla(Y, CTRL);
  d = await distintos("corrida-movida");
  comprobar("con la escena corrida, Ctrl+Y sin restos", d === 0, `${d} píxeles distintos`);
  await volver();
}
