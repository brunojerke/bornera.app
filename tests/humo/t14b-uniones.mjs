// T14b: puntos de unión. Con dpr 1, a 1024×600, a 40, 58, 73 y 100 %:
// - cuántas hay: 5 T con el anfitrión vertical y 5 con el horizontal, dos
//   cables en un borne (K1) y en otro (K9); los cruces, las L, un borne con un
//   cable (K2) y una T sobre el extremo libre de su anfitrión (solo desde un
//   `.brn`) no dan;
// - el punto suelto (un RendererCanvas aparte, cinco fases): hasta 8 px va al
//   píxel y la fila y la columna del centro son simétricas y sin grises; con
//   arco (10 px a 100 %), la fila simétrica y la columna con tolerancia 0,08
//   (el arco de Chrome no es simétrico en vertical: lo mismo con el lienzo
//   transpuesto, es del rasterizador);
// - en cada T de la app, la mitad sin brazo de la fila o columna del centro es
//   la del punto suelto y el anfitrión sigue lleno; en los cruces y las L, el
//   corte es el del cable solo; en mosaicos y dibujado directo (con arco y
//   mosaicos, solo se informa);
// - en K1 el punto tapa la marca del borne (D5-B): el centro sale del color
//   de los símbolos; en K2 (un cable) queda la marca;
// - una T justo sobre un borde de mosaico: mosaicos = dibujo directo hasta
//   8 px; con arco, solo se informa (como en t14a);
// - debajo de 30 % no se dibujan; a 30 % sí (D4-A);
// - borrar una T a 30, 40, 58 y 73 % no deja restos (la caja de la unión
//   alcanza desde el zoom mínimo en que se dibuja) y Ctrl+Z la devuelve;
// - mover K9 (dos cables en A1) cruzando bordes de mosaico a 58 y 73 %: igual
//   a redibujar de cero, y Ctrl+Z sin restos;
// - mientras se arrastra K9, ni el punto viejo ni uno nuevo (D6-A); al soltar,
//   el nuevo.

import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Puntos de unión";

const Z = ["z", "KeyZ", 90];
const ZOOMS = [0.4, 0.58, 0.73, 1];
/** Píxeles a cada lado del centro que se leen en cada corte (el punto más grande, a 100 %, mide 10 px). */
const LADO = 8;
const TOLERANCIA = 0.02;

/** Grosor del trazo en px con dpr 1, como en t14n. */
const grosor = (zoom) => Math.max(1, Math.round(Math.max(0.1 * 20 * zoom, 1)));

/** Corte del cable solo: `w` px llenos desde el centro menos (w >> 1). */
function esperado(w) {
  const c = new Array(2 * LADO + 1).fill(0);
  for (let i = 0; i < w; i++) c[LADO - (w >> 1) + i] = 1;
  return c;
}
const igual = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= TOLERANCIA);
const texto = (c) => "[" + c.map((v) => Math.round(v * 100)).join(" ") + "]";

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
  const distintos = async (n) => {
    await reposo();
    return p.evaluar(`(() => { const cv = document.querySelector("canvas");
      const a = globalThis.__fotos["${n}"], b = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      if (a.length !== b.length) return -1; let k = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) k++;
      return k; })()`);
  };
  /** Igual a redibujar todo de cero: foto, se rehace la capa estática, y se compara. */
  const sinRestos = async () => {
    await foto("antes");
    await p.evaluar("bornera.editor.vista.invalidarContenido()");
    return distintos("antes");
  };
  const documento = () => p.evaluar("JSON.stringify(bornera.editor.documento.hojas)");
  const camara = async (zoom, gx, gy) => {
    await p.evaluar(`(() => { const cv = document.querySelector("canvas"); const v = bornera.editor.vista;
      v.camara.zoom = ${zoom}; v.camara.centrar(${gx}, ${gy}, cv.clientWidth, cv.clientHeight); v.invalidarContenido(); })()`);
    await reposo();
  };
  const mosaicos = async (prendidos) => {
    await p.evaluar(`(() => { const v = bornera.editor.vista; v.opciones = { ...v.opciones, cache: ${prendidos} }; v.invalidarContenido(); })()`);
    await reposo();
  };
  const uniones = () => p.evaluar(`JSON.stringify(bornera.editor.uniones.todas().map((u) => [u.x, u.y]))`);

  comprobar("la prueba corre con dpr 1", (await p.evaluar("devicePixelRatio")) === 1);

  // ── La escena, con comandos ──
  const e = await p.evaluar(`(() => { const { editor: ed, comandos: c } = bornera; const d = ed.documento;
    const L = (x, y) => ({ tipo: "libre", x, y }), T = (cable, x, y) => ({ tipo: "cable", cable, x, y });
    const B = (comp, borne) => ({ tipo: "borne", comp, borne });
    const cab = (desde, hasta, codos = []) => { const k = c.cablear(d, { desde, hasta, codos }); ed.ejecutar(k); return k.id; };
    const comp = (x, y, etiqueta) => { const k = c.colocar(d, { tipo: "contactor.bobina", x, y, rot: 0, espejado: false, etiqueta, params: {} }); ed.ejecutar(k); return k.id; };
    const verticales = [], horizontales = [], cruces = [], eles = [];
    for (let n = 0; n < 5; n++) {
      // T con el anfitrión vertical y el brazo a la derecha: unión en (6n, n + 4).
      const h = cab(L(6 * n, n), L(6 * n, n + 8));
      verticales.push({ x: 6 * n, y: n + 4, brazo: cab(T(h, 6 * n, n + 4), L(6 * n + 3, n + 4)) });
      // T con el anfitrión horizontal y el brazo abajo: unión en (44 + n, 6n).
      const g = cab(L(40 + n, 6 * n), L(48 + n, 6 * n));
      horizontales.push({ x: 44 + n, y: 6 * n, brazo: cab(T(g, 44 + n, 6 * n), L(44 + n, 6 * n + 3)) });
      // Cruce sin empalme en (6n, 34 + n).
      cab(L(6 * n, 30 + n), L(6 * n, 38 + n)); cab(L(6 * n - 3, 34 + n), L(6 * n + 3, 34 + n));
      cruces.push({ x: 6 * n, y: 34 + n });
      // L con el codo en (6n, 44 + n): brazo a la derecha y hacia abajo.
      cab(L(6 * n + 3, 44 + n), L(6 * n, 48 + n), [[6 * n, 44 + n]]);
      eles.push({ x: 6 * n, y: 44 + n });
    }
    // T sobre el extremo libre de su anfitrión (solo desde un .brn): no es unión.
    const ext = cab(L(60, 0), L(70, 0)); cab(T(ext, 70, 0), L(70, 5));
    // K1: dos cables en A1 (80, 8). K2: uno solo en A1 (90, 8).
    const k1 = comp(80, 10, "K1"); cab(B(k1, "A1"), L(80, 2)); cab(B(k1, "A1"), L(85, 8));
    const k2 = comp(90, 10, "K2"); cab(B(k2, "A1"), L(90, 2));
    // K9 para mover a la derecha: dos cables en A1 (120, 58), uno arriba y otro a la izquierda.
    const k9 = comp(120, 60, "K9"); cab(B(k9, "A1"), L(120, 52)); cab(B(k9, "A1"), L(112, 58));

    const css = getComputedStyle(document.querySelector("canvas"));
    const cx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const rgb = (nombre) => { cx.fillStyle = css.getPropertyValue(nombre).trim(); cx.fillRect(0, 0, 1, 1); return Array.from(cx.getImageData(0, 0, 1, 1).data.slice(0, 3)); };
    const fondo = rgb("--lienzo"), trazo = rgb("--simbolo"), borne = rgb("--borne");
    let canal = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(trazo[i] - fondo[i]) > Math.abs(trazo[canal] - fondo[canal])) canal = i;
    const pantalla = () => { const cam = bornera.editor.vista.camara, k = cam.escala; return { k, ox: Math.round(cam.x * k), oy: Math.round(cam.y * k) }; };
    /**
     * Corte que cruza el punto (x, y) de la grilla. "fila": ${2 * LADO + 1} px
     * de una fila, corrida \`d\` px del centro; "columna", lo mismo de una
     * columna. El del medio es round(posición).
     */
    globalThis.__corte = ({ eje, x, y, d }) => {
      const cv = document.querySelector("canvas"), { k, ox, oy } = pantalla();
      const px = Math.round(x * k) - ox, py = Math.round(y * k) - oy;
      const x0 = eje === "fila" ? px - ${LADO} : px + d, y0 = eje === "fila" ? py + d : py - ${LADO};
      const w = eje === "fila" ? ${2 * LADO + 1} : 1, h = eje === "fila" ? 1 : ${2 * LADO + 1};
      if (x0 < 0 || y0 < 0 || x0 + w > cv.width || y0 + h > cv.height) return null;
      const datos = cv.getContext("2d").getImageData(x0, y0, w, h).data, corte = [];
      for (let i = canal; i < datos.length; i += 4) corte.push((datos[i] - fondo[canal]) / (trazo[canal] - fondo[canal]));
      return corte;
    };
    /** Color del píxel del centro de (x, y). */
    globalThis.__color = ({ x, y }) => { const { k, ox, oy } = pantalla();
      return Array.from(document.querySelector("canvas").getContext("2d").getImageData(Math.round(x * k) - ox, Math.round(y * k) - oy, 1, 1).data.slice(0, 3)); };
    /** Píxeles de un cuadrado de ±${LADO} px alrededor de (x, y). */
    globalThis.__ventana = ({ x, y }) => { const { k, ox, oy } = pantalla();
      return Array.from(document.querySelector("canvas").getContext("2d").getImageData(Math.round(x * k) - ox - ${LADO}, Math.round(y * k) - oy - ${LADO}, ${2 * LADO + 1}, ${2 * LADO + 1}).data); };
    return { verticales, horizontales, cruces, eles, k1, k2, k9, trazo, borne, contraste: Math.abs(trazo[canal] - fondo[canal]) }; })()`);
  comprobar("el color del símbolo se distingue del fondo", e.contraste > 100, `${e.contraste} de 255`);
  const cortes = (lista) => p.evaluar(`${JSON.stringify(lista)}.map((q) => globalThis.__corte(q))`);
  const color = (q) => p.evaluar(`globalThis.__color(${JSON.stringify(q)})`);

  // Seleccionar una vez abre el panel y cambia el ancho del lienzo: antes de las fotos.
  await p.evaluar(`bornera.activo().seleccionarIds(["${e.k9}"])`);
  await p.esc();
  await esperar(200);

  // ── Cuántas ──
  const esperadas = [
    ...e.verticales.map((u) => [u.x, u.y]),
    ...e.horizontales.map((u) => [u.x, u.y]),
    [80, 8],
    [120, 58],
  ].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const hay = await uniones();
  comprobar(
    "12 uniones: 10 T y 2 bornes con dos cables; cruces, L, un borne con un cable y la T sobre el extremo libre no dan",
    hay === JSON.stringify(esperadas),
    hay,
  );
  comprobar("la escena tiene las mismas 12", (await p.evaluar("bornera.editor.escena.cantidadUniones")) === 12);

  // ── El punto suelto: la fila y la columna del centro ──
  // Un RendererCanvas en un lienzo aparte (el mismo código y el mismo motor
  // que la app), solo con el punto: en una T, la fila y la columna del centro
  // tienen el anfitrión o el brazo. Cinco fases de px (corrimientos con
  // fracción) a cada zoom.
  const sueltos = JSON.parse(
    await p.evaluar(`(async () => {
    const { RendererCanvas } = await import("/src/render/canvas2d.ts");
    const { DIAMETRO_UNION } = await import("/src/render/escenaEditable.ts");
    const L = ${LADO}, N = 64, res = {};
    for (const zoom of ${JSON.stringify(ZOOMS)}) {
      const k = 20 * zoom, lista = [];
      for (let n = 0; n < 5; n++) {
        const cv = document.createElement("canvas"); cv.width = N; cv.height = N;
        const ctx = cv.getContext("2d", { alpha: false }); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, N, N);
        const gx = 3 + n, gy = 7 - n, tx = 32 - gx * k + 0.37 * n, ty = 32 - gy * k - 0.21 * n;
        const r = new RendererCanvas(ctx);
        r.transformar(k, 0, 0, k, tx, ty);
        r.estilo({ trazo: "#000", relleno: "#000", grosor: Math.max(0.1, 1 / k) });
        r.puntos([gx, gy], 1, DIAMETRO_UNION);
        // El píxel del centro, con la cuenta de RendererCanvas (sin el medio píxel).
        const px = Math.round(k * gx + tx - Math.round(tx)) + Math.round(tx), py = Math.round(k * gy + ty - Math.round(ty)) + Math.round(ty);
        const lee = (x, y, w, h) => { const d = ctx.getImageData(x, y, w, h).data, c = []; for (let i = 0; i < d.length; i += 4) c.push(1 - d[i] / 255); return c; };
        lista.push({ fila: lee(px - L, py, 2 * L + 1, 1), columna: lee(px, py - L, 1, 2 * L + 1) });
      }
      res[zoom] = lista;
    }
    return JSON.stringify(res); })()`),
  );
  /** Diferencia más grande entre el corte y su espejo alrededor del centro del trazo (con `w` par, entre dos píxeles). */
  const asimetria = (c, w) => {
    let max = 0;
    for (let i = 0; i < c.length; i++) {
      const j = w & 1 ? 2 * LADO - i : 2 * LADO - 1 - i;
      if (j >= 0 && j < c.length) max = Math.max(max, Math.abs(c[i] - c[j]));
    }
    return max;
  };
  const diametro = (zoom) => {
    const k = 20 * zoom;
    const w = grosor(zoom);
    const par = w & 1;
    const t = (0.5 * k - par) / 2;
    const f = Math.floor(t);
    return Math.max((t - f > 0.5 ? f + 1 : f) * 2 + par, w + 2);
  };
  for (const zoom of ZOOMS) {
    const w = grosor(zoom);
    const d = diametro(zoom);
    const pct = Math.round(zoom * 100);
    const lista = sueltos[zoom];
    const ax = Math.max(...lista.map((s) => asimetria(s.fila, w)));
    const ay = Math.max(...lista.map((s) => asimetria(s.columna, w)));
    const iguales = lista.every((s) => igual(s.fila, lista[0].fila) && igual(s.columna, lista[0].columna));
    if (d <= 8) {
      const grises = lista.flatMap((s) => [...s.fila, ...s.columna]).filter((v) => v > TOLERANCIA && v < 1 - TOLERANCIA).length;
      comprobar(
        `${pct} %, punto de ${d} px al píxel: fila y columna del centro simétricas, sin grises, iguales en las 5 fases`,
        ax <= TOLERANCIA && ay <= TOLERANCIA && grises === 0 && iguales,
        `asimetría x ${ax.toFixed(2)} · y ${ay.toFixed(2)} · ${grises} grises · fila ${texto(lista[0].fila)} · columna ${texto(lista[0].columna)}`,
      );
    } else {
      comprobar(
        `${pct} %, punto de ${d} px con arco: fila del centro simétrica, columna con tolerancia 0,08 (Chrome), iguales en las 5 fases`,
        ax <= TOLERANCIA && ay <= 0.08 && iguales,
        `asimetría x ${ax.toFixed(2)} · y ${ay.toFixed(2)} · fila ${texto(lista[0].fila)} · columna ${texto(lista[0].columna)}`,
      );
    }
  }

  // ── En la app: cada T con el mismo punto que el suelto, en las cinco fases ──
  // La mitad sin brazo de la fila del centro (anfitrión vertical, brazo a la
  // derecha) o de la columna del centro (anfitrión horizontal, brazo abajo) es
  // igual a la del punto suelto; el trazo del anfitrión, lleno.
  for (const zoom of ZOOMS) {
    const w = grosor(zoom);
    const d = diametro(zoom);
    const pct = Math.round(zoom * 100);
    const al = w - (w >> 1); // primer píxel al costado del trazo
    const antes = LADO - (w >> 1); // primer píxel del trazo
    const ref = sueltos[zoom][0];
    for (const conMosaicos of [true, false]) {
      await mosaicos(conMosaicos);
      const modo = conMosaicos ? "en mosaicos" : "dibujo directo";
      await camara(zoom, 13, 6);
      const vCen = await cortes(e.verticales.map((u) => ({ eje: "fila", x: u.x, y: u.y, d: 0 })));
      await camara(zoom, 46, 12);
      const hCen = await cortes(e.horizontales.map((u) => ({ eje: "columna", x: u.x, y: u.y, d: 0 })));
      if (zoom === 0.58 && conMosaicos) await p.captura("58");
      if ([...vCen, ...hCen].some((c) => c === null)) {
        comprobar(`${pct} %, ${modo}: los cortes de las T caen dentro del lienzo`, false);
        continue;
      }
      const mal = [];
      // Del borde del punto (más 1 px) hasta el trazo: más lejos puede haber otra cosa del dibujo (a 40 %, 8 px es 1 unidad).
      const desde = Math.max(0, antes - (d >> 1) - 1);
      const mitad = (c, r) =>
        igual(c.slice(desde, antes), r.slice(desde, antes)) && c.slice(antes, antes + w).every((v) => v >= 1 - TOLERANCIA);
      vCen.forEach((c, n) => mitad(c, ref.fila) || mal.push(`vertical n=${n} ${texto(c)} (suelto ${texto(ref.fila)})`));
      hCen.forEach((c, n) => mitad(c, ref.columna) || mal.push(`horizontal n=${n} ${texto(c)} (suelto ${texto(ref.columna)})`));
      const titulo = `${pct} %, ${modo}: en las 10 T, el punto es el del suelto (${d} px) y el anfitrión sigue lleno (${w} px)`;
      if (d > 8 && conMosaicos) console.log(`  ·   ${titulo}: ${mal.length === 0 ? "igual" : mal.join(" · ")} (con arco y mosaicos, solo se informa)`);
      else comprobar(titulo, mal.length === 0, mal.join(" · "));
      // Cruces y L: la fila debajo del cruce o del codo es la del cable solo.
      await camara(zoom, 13, 41);
      const cr = await cortes([...e.cruces, ...e.eles].map((u) => ({ eje: "fila", x: u.x, y: u.y, d: al })));
      const eleCen = await cortes(e.eles.map((u) => ({ eje: "fila", x: u.x, y: u.y, d: 0 })));
      const malCr = [];
      if ([...cr, ...eleCen].some((c) => c === null)) malCr.push("afuera del lienzo");
      else {
        cr.forEach((c, n) => igual(c, esperado(w)) || malCr.push(`${n < 5 ? "cruce" : "L"} n=${n % 5} ${texto(c)}`));
        eleCen.forEach((c, n) => c[LADO - (w >> 1) - 1] <= TOLERANCIA || malCr.push(`L n=${n}: algo a la izquierda del codo ${texto(c)}`));
      }
      comprobar(`${pct} %, ${modo}: en los 5 cruces y las 5 L no hay punto (el corte es el del cable solo)`, malCr.length === 0, malCr.join(" · "));
      // K1: el punto tapa la marca del borne. K2: la marca queda.
      await camara(zoom, 85, 8);
      const c1 = await color({ x: 80, y: 8 });
      const c2 = await color({ x: 90, y: 8 });
      const cerca = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 3);
      comprobar(
        `${pct} %, ${modo}: en K1 (dos cables) el centro es del color de los símbolos; en K2 (uno), del de la marca del borne`,
        cerca(c1, e.trazo) && cerca(c2, e.borne),
        `K1 ${c1} (símbolo ${e.trazo}) · K2 ${c2} (borne ${e.borne})`,
      );
    }
    await mosaicos(true);
  }

  // ── Una T sobre un borde de mosaico: mosaicos = dibujo directo ──
  for (const zoom of ZOOMS) {
    const pct = Math.round(zoom * 100);
    const k = 20 * zoom;
    // El x entero cuyo punto cruza un borde de mosaico (256 px) lo más cerca del centro, entre 150 y 400.
    let g = 150;
    let mejor = Infinity;
    for (let x = 150; x <= 400; x++) {
      const c = Math.round(x * k) + (grosor(zoom) & 1) / 2;
      const dist = Math.abs(c - Math.round(c / 256) * 256);
      if (dist < mejor) [g, mejor] = [x, dist];
    }
    await p.evaluar(`(() => { const { editor: ed, comandos: c } = bornera; const d = ed.documento;
      const h = c.cablear(d, { desde: { tipo: "libre", x: ${g}, y: ${g} - 4 }, hasta: { tipo: "libre", x: ${g}, y: ${g} + 4 }, codos: [] }); ed.ejecutar(h);
      ed.ejecutar(c.cablear(d, { desde: { tipo: "cable", cable: h.id, x: ${g}, y: ${g} }, hasta: { tipo: "libre", x: ${g} + 3, y: ${g} }, codos: [] })); })()`);
    await camara(zoom, g, g);
    await mosaicos(true);
    const a = await p.evaluar(`globalThis.__ventana({ x: ${g}, y: ${g} })`);
    await mosaicos(false);
    const b = await p.evaluar(`globalThis.__ventana({ x: ${g}, y: ${g} })`);
    await mosaicos(true);
    let d = 0;
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) d++;
    const titulo = `${pct} %: una T con el punto (${diametro(zoom)} px) sobre un borde de mosaico (x = ${g}, a ${mejor.toFixed(1)} px) sale igual en mosaicos que directo`;
    if (diametro(zoom) > 8) console.log(`  ·   ${titulo}: ${d} píxeles distintos (con arco, solo se informa, como en t14a)`);
    else comprobar(titulo, d === 0 && mejor < 1, `${d} píxeles distintos`);
  }

  // ── Zoom chico: debajo de 30 % no, a 30 % sí ──
  for (const [zoom, se] of [
    [0.29, false],
    [0.3, true],
  ]) {
    await camara(zoom, 13, 6);
    const c = await cortes(e.verticales.map((u) => ({ eje: "fila", x: u.x, y: u.y, d: 0 })));
    const conPunto = c.filter((q) => q && q[LADO - 1] > 0.5).length;
    comprobar(`${Math.round(zoom * 100)} %: ${se ? "las 5 T muestran el punto" : "ninguna T muestra el punto"}`, conPunto === (se ? 5 : 0), `${conPunto} de 5`);
  }

  // ── Borrar una T sin restos, también a 30 % (la caja alcanza); Ctrl+Z la devuelve ──
  for (const zoom of [0.3, 0.4, 0.58, 0.73]) {
    const pct = Math.round(zoom * 100);
    const u = e.verticales[2];
    await camara(zoom, u.x, u.y);
    const docRef = await documento();
    await foto("ref");
    await p.evaluar(`(() => { const { editor: ed, comandos: c } = bornera; ed.ejecutar(new c.Borrar(["${u.brazo}"])); })()`);
    const sin = await uniones();
    const restos = await sinRestos();
    comprobar(
      `${pct} %: borrar el brazo de una T saca su unión y no deja restos`,
      !sin.includes(`[${u.x},${u.y}]`) && restos === 0,
      `${restos} píxeles distintos de redibujar de cero`,
    );
    await tecla(Z, CTRL);
    const d = await distintos("ref");
    comprobar(`${pct} %: Ctrl+Z la devuelve exacta y sin restos`, (await documento()) === docRef && d === 0, `${d} píxeles distintos`);
  }

  // ── Mover K9 (dos cables en A1) cruzando bordes de mosaico ──
  // A 58 % hay un borde en x = 132,4; a 73 %, en 122,7 y 140,3.
  for (const zoom of [0.58, 0.73]) {
    const pct = Math.round(zoom * 100);
    await camara(zoom, 128, 58);
    const docRef = await documento();
    const pasosRef = await p.evaluar("bornera.editor.historial.hechos.length");
    await foto("ref");
    const pasos = [[123, 60], [126, 61], [129, 59], [132, 60], [134, 62], [136, 60]];
    let [x, y] = [120, 60];
    const restos = [];
    const lugares = [];
    for (const [nx, ny] of pasos) {
      await p.arrastrar(await p.punto(x, y), await p.punto(nx, ny));
      await p.esc();
      await esperar(30);
      [x, y] = [nx, ny];
      const d = await sinRestos();
      if (d !== 0) restos.push(`en (${nx}, ${ny}): ${d} px`);
      lugares.push(await uniones());
    }
    const final = lugares.at(-1);
    comprobar(`${pct} %: la unión de K9 sigue a A1 hasta (136, 58)`, final.includes("[136,58]") && !final.includes("[120,58]"), final);
    comprobar(`${pct} %: después de cada arrastre, igual a redibujar todo de cero (sin restos)`, restos.length === 0, restos.join(" · "));
    const hechos = (await p.evaluar("bornera.editor.historial.hechos.length")) - pasosRef;
    for (let i = 0; i < hechos; i++) await tecla(Z, CTRL);
    const d = await distintos("ref");
    comprobar(
      `${pct} %: 6 arrastres son 6 pasos, y 6 Ctrl+Z devuelven todo exacto y sin restos`,
      hechos === 6 && (await documento()) === docRef && d === 0,
      `${hechos} pasos, ${d} píxeles distintos`,
    );
  }

  // ── Con todo seleccionado (atajo de la hoja entera): R, M y mover sin restos; Ctrl+Z exacto ──
  // Las uniones van a T(p) sin recalcular y sin invalidar sus cajas aparte (caben en las de los cables).
  {
    const R = ["r", "KeyR", 82];
    const M = ["m", "KeyM", 77];
    await camara(0.58, 13, 6);
    const docRef = await documento();
    const pasosRef = await p.evaluar("bornera.editor.historial.hechos.length");
    await foto("refTodo");
    await p.evaluar(`(() => { const ed = bornera.activo(), h = ed.documento.hojas[0];
      ed.seleccionarIds([...h.componentes.map((c) => c.id), ...h.cables.map((w) => w.id)]); })()`);
    const restos = [];
    for (const [nombre, hacer] of [
      ["R", () => tecla(R)],
      ["M", () => tecla(M)],
      ["mover", () => p.evaluar(`(() => { const ed = bornera.activo(), h = ed.documento.hojas[0];
        ed.ejecutar(new bornera.comandos.Mover([...h.componentes.map((c) => c.id), ...h.cables.map((w) => w.id)], 3, -2)); })()`)],
    ]) {
      await hacer();
      await esperar(30);
      await p.evaluar(`bornera.activo().seleccionarIds([])`);
      const d = await sinRestos();
      if (d !== 0) restos.push(`${nombre}: ${d} px`);
      await p.evaluar(`(() => { const ed = bornera.activo(), h = ed.documento.hojas[0];
        ed.seleccionarIds([...h.componentes.map((c) => c.id), ...h.cables.map((w) => w.id)]); })()`);
    }
    await p.evaluar(`bornera.activo().seleccionarIds([])`);
    const hechos = (await p.evaluar("bornera.editor.historial.hechos.length")) - pasosRef;
    const iguales = await p.evaluar(`(async () => { const { uniones } = await import("/src/core/model/uniones.ts");
      const ed = bornera.editor; return JSON.stringify(ed.uniones.todas()) === JSON.stringify(uniones(ed.documento.hojas[0])); })()`);
    comprobar(
      "58 %, todo seleccionado: R, M y mover son 3 pasos, cada uno igual a redibujar de cero, y las uniones son las del cálculo completo",
      hechos === 3 && restos.length === 0 && iguales === true,
      `${hechos} pasos · ${restos.join(" · ")} · uniones ${iguales ? "iguales" : "distintas"}`,
    );
    for (let i = 0; i < hechos; i++) await tecla(Z, CTRL);
    const d = await distintos("refTodo");
    comprobar("58 %, todo seleccionado: 3 Ctrl+Z devuelven todo exacto y sin restos", (await documento()) === docRef && d === 0, `${d} píxeles distintos`);
  }

  // ── Mientras se arrastra K9: ni el punto viejo ni uno nuevo (D6-A); al soltar, el nuevo ──
  await camara(0.73, 122, 60);
  const w = grosor(0.73);
  const izq = LADO - (w >> 1) - 1;
  const q0 = await p.punto(120, 60);
  const q1 = await p.punto(120, 63);
  await p.mouse("mouseMoved", q0.x, q0.y);
  await p.mouse("mousePressed", q0.x, q0.y);
  for (let i = 1; i <= 6; i++) await p.mouse("mouseMoved", q0.x, q0.y + ((q1.y - q0.y) * i) / 6, { botones: 1 });
  await esperar(60);
  await reposo();
  // En el lugar viejo pasa el cable vertical rehecho: a su izquierda no queda nada.
  // En el nuevo, la previa dibuja la marca del borne de K9 sin el punto (el centro, del color de la marca).
  const [viejo] = await cortes([{ eje: "fila", x: 120, y: 58, d: 0 }]);
  const nuevo = await color({ x: 120, y: 61 });
  await p.mouse("mouseReleased", q1.x, q1.y);
  await esperar(60);
  await reposo();
  const soltado = await color({ x: 120, y: 61 });
  const cerca = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 3);
  comprobar(
    "en medio del arrastre no queda el punto viejo ni se dibuja el nuevo; al soltar, el nuevo",
    viejo !== null && viejo[izq] <= TOLERANCIA && cerca(nuevo, e.borne) && cerca(soltado, e.trazo),
    `viejo ${viejo && texto(viejo)} · previa ${nuevo} (marca ${e.borne}) · soltado ${soltado} (símbolo ${e.trazo})`,
  );
  comprobar("la unión quedó en (120, 61)", (await uniones()).includes("[120,61]"));
}
