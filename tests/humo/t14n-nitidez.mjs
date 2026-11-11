// T14n: líneas nítidas con dpr 1. En la netbook (WebKitGTK, dpr 1, zoom
// 58–73 %) los tramos verticales de los cables se veían grises y finos: sin
// alinear al píxel, una línea de 1,16 px cae en cualquier fracción y el
// suavizado la reparte en dos columnas.
//
// Acá se lee la cobertura de cada píxel (0 = fondo, 1 = color del símbolo), no
// se compara mosaicos contra dibujo directo: los dos salían igual de grises.
// Con dpr 1, a 40, 58, 73 y 100 %:
// - cinco cables en L, uno por cada fase de píxel (x = 6n, y = n): el tramo
//   vertical y el horizontal llenan justo `w` px al 100 % y nada alrededor;
// - cinco bobinas derechas y cinco a 90°, cada una con un cable en A1: la
//   línea del símbolo que llega al borne y el cable caen en la misma columna
//   (o fila) de píxeles, con la capa estática en mosaicos y dibujada directo;
// - lo mismo con un RendererCanvas suelto, con el trazado del símbolo cacheado
//   (`simbolo`) y primitiva por primitiva (`dibujarGeometria`), a 0° y 90°;
// - mover una bobina cableada a 58 % y 73 %, cruzando bordes de mosaico: lo
//   que queda es igual a redibujar todo de cero, y Ctrl+Z vuelve sin restos.

import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Líneas nítidas con dpr 1";

const Z = ["z", "KeyZ", 90];
const ZOOMS = [0.4, 0.58, 0.73, 1];
/** Píxeles a cada lado del centro que se leen en cada corte. */
const LADO = 4;
/** Cuánto puede apartarse la cobertura de 0 o de 1. */
const TOLERANCIA = 0.02;

/** Grosor del trazo en px con dpr 1: 0,1 unidades, por lo menos 1 px, redondeado. */
const grosor = (zoom) => Math.max(1, Math.round(Math.max(0.1 * 20 * zoom, 1)));

/** Corte esperado de un trazo de `w` px: ocupa desde el píxel del centro menos (w >> 1). */
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

  comprobar("la prueba corre con dpr 1", (await p.evaluar("devicePixelRatio")) === 1);

  // ── La escena ──
  // `cortes`: dónde leer. `eje` "v": trazo vertical (se lee una fila); "h": horizontal (una columna).
  const escena = await p.evaluar(`(() => { const { editor: ed, comandos: c, cables } = bornera; const d = ed.documento;
    const VEC = { derecha: [1, 0], izquierda: [-1, 0], abajo: [0, 1], arriba: [0, -1] };
    const ele = [], derechas = [], acostadas = [];
    for (let n = 0; n < 5; n++) {
      ed.ejecutar(c.cablear(d, { desde: { tipo: "libre", x: 6 * n, y: n + 3 }, hasta: { tipo: "libre", x: 6 * n + 3, y: n }, codos: [[6 * n, n]] }));
      ele.push({ v: { eje: "v", x: 6 * n, y: n + 1.5 }, h: { eje: "h", x: 6 * n + 1.5, y: n } });
    }
    const bobina = (x, y, rot, lista) => {
      const k = c.colocar(d, { tipo: "contactor.bobina", x, y, rot, espejado: false, etiqueta: "", params: {} }); ed.ejecutar(k);
      const b = cables.borneDe(d.hojas[0].componentes.find((q) => q.id === k.id), "A1");
      const [vx, vy] = VEC[b.direccion];
      ed.ejecutar(c.cablear(d, { desde: { tipo: "borne", comp: k.id, borne: "A1" }, hasta: { tipo: "libre", x: b.x + 4 * vx, y: b.y + 4 * vy }, codos: [] }));
      const eje = vx === 0 ? "v" : "h";
      // La línea del símbolo va del borne 1,25 unidades hacia adentro; el nombre del borne ocupa hasta 0,85.
      lista.push({ patita: { eje, x: b.x - 1.05 * vx, y: b.y - 1.05 * vy }, cable: { eje, x: b.x + 1.5 * vx, y: b.y + 1.5 * vy } });
    };
    for (let n = 0; n < 5; n++) bobina(1 + 6 * n, 14, 0, derechas);
    [[2, 20], [11, 21], [20, 22], [2, 28], [11, 29]].forEach(([x, y]) => bobina(x, y, 90, acostadas));
    // Para mover (lejos del resto): una bobina con un cable en cada borne.
    const m = c.colocar(d, { tipo: "contactor.bobina", x: 60, y: 60, rot: 0, espejado: false, etiqueta: "K9", params: {} }); ed.ejecutar(m);
    ed.ejecutar(c.cablear(d, { desde: { tipo: "borne", comp: m.id, borne: "A1" }, hasta: { tipo: "libre", x: 57, y: 54 }, codos: [[60, 54]] }));
    ed.ejecutar(c.cablear(d, { desde: { tipo: "borne", comp: m.id, borne: "A2" }, hasta: { tipo: "libre", x: 64, y: 66 }, codos: [[60, 66]] }));

    // Colores del tema, en RGB.
    const css = getComputedStyle(document.querySelector("canvas"));
    const cx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const rgb = (nombre) => { cx.fillStyle = css.getPropertyValue(nombre).trim(); cx.fillRect(0, 0, 1, 1); return Array.from(cx.getImageData(0, 0, 1, 1).data.slice(0, 3)); };
    const fondo = rgb("--lienzo"), trazo = rgb("--simbolo");
    let canal = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(trazo[i] - fondo[i]) > Math.abs(trazo[canal] - fondo[canal])) canal = i;
    /**
     * Cobertura de los píxeles de un corte que cruza el trazo en (x, y) de la
     * grilla: ${2 * LADO + 1} px con el del medio en round(posición), donde
     * cae el punto de la grilla. null si queda fuera del lienzo.
     */
    globalThis.__corte = ({ eje, x, y }) => {
      const cv = document.querySelector("canvas"), cam = bornera.editor.vista.camara, k = cam.escala;
      const ox = Math.round(cam.x * k), oy = Math.round(cam.y * k);
      const px = eje === "v" ? Math.round(x * k) - ox : Math.floor(x * k) - ox;
      const py = eje === "v" ? Math.floor(y * k) - oy : Math.round(y * k) - oy;
      const x0 = eje === "v" ? px - ${LADO} : px, y0 = eje === "v" ? py : py - ${LADO};
      const w = eje === "v" ? ${2 * LADO + 1} : 1, h = eje === "v" ? 1 : ${2 * LADO + 1};
      if (x0 < 0 || y0 < 0 || x0 + w > cv.width || y0 + h > cv.height) return null;
      const datos = cv.getContext("2d").getImageData(x0, y0, w, h).data;
      const corte = [];
      for (let i = canal; i < datos.length; i += 4) corte.push((datos[i] - fondo[canal]) / (trazo[canal] - fondo[canal]));
      return corte;
    };
    return { ele, derechas, acostadas, mover: m.id, contraste: Math.abs(trazo[canal] - fondo[canal]) }; })()`);
  comprobar("el color del símbolo se distingue del fondo", escena.contraste > 100, `${escena.contraste} de 255`);
  const cortes = (lista) => p.evaluar(`${JSON.stringify(lista)}.map((q) => globalThis.__corte(q))`);

  // ── Cables: vertical y horizontal del mismo cable, en las cinco fases ──
  for (const zoom of ZOOMS) {
    const w = grosor(zoom);
    const bien = esperado(w);
    const pct = Math.round(zoom * 100);
    await mosaicos(true);
    await camara(zoom, 13, 8);
    const v = await cortes(escena.ele.map((e) => e.v));
    const h = await cortes(escena.ele.map((e) => e.h));
    if (zoom === 0.58) await p.captura("58");
    if (zoom === 0.73) await p.captura("73");
    const fuera = [...v, ...h].filter((c) => c === null).length;
    comprobar(`${pct} %: los cortes de los cables caen dentro del lienzo`, fuera === 0, `${fuera} afuera`);
    if (fuera > 0) continue;
    const malV = v.map((c, n) => (igual(c, bien) ? "" : `n=${n} ${texto(c)}`)).filter(Boolean);
    const malH = h.map((c, n) => (igual(c, bien) ? "" : `n=${n} ${texto(c)}`)).filter(Boolean);
    comprobar(`${pct} %: los 5 tramos verticales llenan ${w} px al 100 % y nada alrededor`, malV.length === 0, `${malV.join(" · ")} (esperado ${texto(bien)})`);
    comprobar(`${pct} %: los 5 tramos horizontales, igual`, malH.length === 0, `${malH.join(" · ")} (esperado ${texto(bien)})`);
    const distintosVH = v.map((c, n) => (igual(c, h[n]) ? "" : `n=${n} V ${texto(c)} H ${texto(h[n])}`)).filter(Boolean);
    comprobar(`${pct} %: el tramo vertical y el horizontal de cada cable salen iguales`, distintosVH.length === 0, distintosVH.join(" · "));

    // ── Símbolos: la línea del borne y su cable, con mosaicos y dibujado directo ──
    for (const conMosaicos of [true, false]) {
      await mosaicos(conMosaicos);
      const modo = conMosaicos ? "en mosaicos" : "dibujo directo";
      for (const [grupo, lista, cx, cy, que] of [
        ["derechas", escena.derechas, 13, 11, "columna"],
        ["a 90°", escena.acostadas, 13, 24.5, "fila"],
      ]) {
        await camara(zoom, cx, cy);
        const patitas = await cortes(lista.map((b) => b.patita));
        const cables = await cortes(lista.map((b) => b.cable));
        if ([...patitas, ...cables].some((c) => c === null)) {
          comprobar(`${pct} %, ${modo}: los cortes de las bobinas ${grupo} caen dentro del lienzo`, false);
          continue;
        }
        const mal = [];
        patitas.forEach((c, n) => {
          if (!igual(c, bien)) mal.push(`n=${n} símbolo ${texto(c)}`);
          if (!igual(cables[n], bien)) mal.push(`n=${n} cable ${texto(cables[n])}`);
          if (!igual(c, cables[n])) mal.push(`n=${n} símbolo ${texto(c)} ≠ cable ${texto(cables[n])}`);
        });
        comprobar(
          `${pct} %, ${modo}: en las 5 bobinas ${grupo}, la línea del borne y el cable caen en la misma ${que}, ${w} px al 100 %`,
          mal.length === 0,
          `${mal.join(" · ")} (esperado ${texto(bien)})`,
        );
      }
    }
    await mosaicos(true);
  }

  // ── Renderer suelto: trazado cacheado y primitiva por primitiva, a 0° y 90° ──
  const sueltos = JSON.parse(
    await p.evaluar(`(async () => {
    const { RendererCanvas } = await import("/src/render/canvas2d.ts");
    const { dibujarGeometria } = await import("/src/render/renderer.ts");
    const { BOBINA_CONTACTOR: def } = await import("/src/core/symbols/index.ts");
    const LADO = ${LADO}, N = 200, res = [];
    for (const zoom of [0.58, 0.73]) for (const cacheado of [true, false]) for (const rot of [0, 90]) for (let n = 0; n < 5; n++) {
      const k = 20 * zoom, gx = 20 + 6 * n, gy = 31 + 6 * n;
      const cv = document.createElement("canvas"); cv.width = N; cv.height = N;
      const ctx = cv.getContext("2d", { alpha: false }); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, N, N);
      const tx = -Math.round((gx - 7) * k), ty = -Math.round((gy - 7) * k);
      const r = new RendererCanvas(ctx);
      r.transformar(k, 0, 0, k, tx, ty);
      r.estilo({ trazo: "#000", relleno: "#000", grosor: Math.max(0.1, 1 / k) });
      // A1 está en (0, −2): derecha queda arriba; a 90° (horario), a la derecha.
      const [vx, vy] = rot === 0 ? [0, -1] : [1, 0];
      r.lineas([gx + 2 * vx, gy + 2 * vy, gx + 6 * vx, gy + 6 * vy], 1);
      r.guardar(); r.trasladar(gx, gy); if (rot) r.rotar(rot);
      if (cacheado) r.simbolo(def); else dibujarGeometria(r, def);
      r.restaurar();
      const corte = (d) => {
        const x = gx + d * vx, y = gy + d * vy;
        const px = vx === 0 ? Math.round(x * k) + tx : Math.floor(x * k) + tx, py = vx === 0 ? Math.floor(y * k) + ty : Math.round(y * k) + ty;
        const datos = vx === 0 ? ctx.getImageData(px - LADO, py, 2 * LADO + 1, 1).data : ctx.getImageData(px, py - LADO, 1, 2 * LADO + 1).data;
        const c = []; for (let i = 0; i < datos.length; i += 4) c.push(1 - datos[i] / 255); return c;
      };
      res.push({ zoom, cacheado, rot, n, patita: corte(0.95), cable: corte(3.5) });
    }
    return JSON.stringify(res); })()`),
  );
  for (const zoom of [0.58, 0.73]) {
    for (const cacheado of [true, false]) {
      const bien = esperado(grosor(zoom));
      const mal = sueltos
        .filter((s) => s.zoom === zoom && s.cacheado === cacheado)
        .filter((s) => !igual(s.patita, bien) || !igual(s.cable, bien))
        .map((s) => `${s.rot}° n=${s.n} símbolo ${texto(s.patita)} cable ${texto(s.cable)}`);
      comprobar(
        `${Math.round(zoom * 100)} %, símbolo ${cacheado ? "con el trazado cacheado" : "primitiva por primitiva (sin caché)"}: a 0° y 90°, la línea del borne y el cable caen en el mismo píxel`,
        mal.length === 0,
        `${mal.join(" · ")} (esperado ${texto(bien)})`,
      );
    }
  }

  // ── Mover sin restos, con el grosor redondeado y el trazo alineado ──
  // K9 va de x = 60 a 73 en pasos: a 58 % el borde de mosaico está en x = 66,2; a 73 %, en 70,1.
  // Seleccionar una vez abre el panel y cambia el ancho del lienzo: antes de las fotos.
  await p.evaluar(`bornera.activo().seleccionarIds(["${escena.mover}"])`);
  await p.esc();
  await esperar(200);
  const docRef = await documento();
  for (const zoom of [0.58, 0.73]) {
    const pct = Math.round(zoom * 100);
    await camara(zoom, 66, 60);
    await foto("ref");
    const pasos = [[63, 60], [66, 61], [67, 59], [70, 60], [71, 62], [73, 60]];
    let [x, y] = [60, 60];
    const restos = [];
    for (const [nx, ny] of pasos) {
      await p.arrastrar(await p.punto(x, y), await p.punto(nx, ny));
      await p.esc();
      await esperar(30);
      [x, y] = [nx, ny];
      await foto("movido");
      await p.evaluar("bornera.editor.vista.invalidarContenido()");
      const d = await distintos("movido");
      if (d !== 0) restos.push(`en (${nx}, ${ny}): ${d} px`);
    }
    const pos = await p.evaluar(`(() => { const k = bornera.editor.escena.obtener("${escena.mover}"); return k.x + "," + k.y; })()`);
    comprobar(`${pct} %: K9 con sus cables se movió en 6 arrastres hasta (73, 60)`, pos === "73,60", pos);
    comprobar(`${pct} %: después de cada arrastre, la pantalla es igual a redibujar todo de cero (sin restos)`, restos.length === 0, restos.join(" · "));
    for (let i = 0; i < pasos.length; i++) await tecla(Z, CTRL);
    const d = await distintos("ref");
    comprobar(`${pct} %: 6 Ctrl+Z devuelven todo exacto y sin restos`, (await documento()) === docRef && d === 0, `${d} píxeles distintos`);
  }
}
