// T14c: reconectar un extremo libre arrastrándolo con Seleccionar, en la app
// real a 1024×600 con dpr 1:
// - a un borne: el círculo hueco desaparece y queda conectado; sin restos;
// - a un cable: la T con su punto, que aparece recién al soltar; sin restos;
// - Ctrl+Z y Ctrl+Y exactos al píxel;
// - destino inválido (mismo borne), ciclo de apoyos y vacío: sin paso, y la
//   pantalla igual que antes; el motivo en la barra y en el aviso;
// - Esc en medio del arrastre: igual al píxel que antes y la selección de antes;
// - a 58 y 73 %; a 58 % el extremo se agarra a 8 px del centro (no a 9,5);
// - cursor de mano sobre el extremo y de cruz mientras se arrastra; la barra
//   dice qué hacer.

import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Reconectar extremos libres";

const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];

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
    await foto("__restos");
    await p.evaluar("bornera.editor.vista.invalidarContenido()");
    return distintos("__restos");
  };
  const documento = () => p.evaluar("JSON.stringify(bornera.editor.documento.hojas)");
  const pasos = () => p.evaluar("bornera.editor.historial.hechos.length");
  const pista = () => p.evaluar(`document.querySelector("footer .pista-herramienta")?.textContent.trim() ?? null`);
  const aviso = () => p.evaluar(`document.querySelector(".avisos")?.textContent.trim() ?? null`);
  const cursor = () => p.evaluar(`document.querySelector("canvas").parentElement.style.cursor`);
  const uniones = () => p.evaluar(`JSON.stringify(bornera.editor.uniones.todas().map((u) => [u.x, u.y]))`);
  const seleccion = () => p.evaluar(`JSON.stringify([...bornera.editor.seleccion].sort())`);
  const cable = (id) => p.evaluar(`JSON.stringify(bornera.editor.documento.hojas[0].cables.find((w) => w.id === "${id}"))`);
  const deseleccionar = () => p.evaluar(`bornera.activo().seleccionarIds([])`);
  const camara = async (zoom, gx, gy) => {
    await p.evaluar(`(() => { const cv = document.querySelector("canvas"); const v = bornera.editor.vista;
      v.camara.zoom = ${zoom}; v.camara.centrar(${gx}, ${gy}, cv.clientWidth, cv.clientHeight); v.invalidarContenido(); })()`);
    await reposo();
  };
  /** Mouse al punto de grilla (gx, gy), corrido (dx, dy) px; con `botones` = 1, arrastrando. */
  const a = async (gx, gy, { dx = 0, dy = 0, botones = 0 } = {}) => {
    const q = await p.punto(gx, gy);
    await p.mouse("mouseMoved", q.x + dx, q.y + dy, { botones });
    await esperar(20);
    return { x: q.x + dx, y: q.y + dy };
  };
  /** Aprieta en el extremo (gx, gy) y arrastra por `puntos` (sin soltar). */
  const agarrar = async (gx, gy, puntos, desplazado = { dx: 0, dy: 0 }) => {
    const q = await a(gx, gy, desplazado);
    await p.mouse("mousePressed", q.x, q.y);
    for (const [x, y] of puntos) await a(x, y, { botones: 1 });
    await esperar(30);
  };
  const soltar = async (gx, gy) => {
    const q = await p.punto(gx, gy);
    await p.mouse("mouseReleased", q.x, q.y);
    await esperar(60);
  };
  /**
   * Píxeles más cerca del color de los bornes que del fondo y del símbolo, en
   * un cuadrado de ±`lado` px alrededor de (gx, gy): el círculo hueco de un
   * extremo libre (a 58 % el anillo sale suavizado y no da el color exacto).
   */
  const deBorne = (gx, gy, lado) =>
    p.evaluar(`(() => { const cam = bornera.editor.vista.camara, k = cam.escala;
      const px = Math.round(${gx} * k) - Math.round(cam.x * k), py = Math.round(${gy} * k) - Math.round(cam.y * k);
      const d = document.querySelector("canvas").getContext("2d").getImageData(px - ${lado}, py - ${lado}, ${2 * lado + 1}, ${2 * lado + 1}).data;
      const c = ${JSON.stringify(e.borne)}, f = ${JSON.stringify(e.fondo)}, t = ${JSON.stringify(e.trazo)};
      const dist = (i, q) => Math.abs(d[i] - q[0]) + Math.abs(d[i + 1] - q[1]) + Math.abs(d[i + 2] - q[2]);
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (dist(i, c) < dist(i, f) && dist(i, c) < dist(i, t)) n++;
      return n; })()`);

  comprobar("la prueba corre con dpr 1", (await p.evaluar("devicePixelRatio")) === 1);

  // ── La escena, con comandos ──
  // K1 (0, 0) y K2 (12, 0): A1 arriba, A2 abajo. w1 de K1·A1 por (0, −6) y (8, −6), suelto en (8, −3).
  // w2 horizontal en y = 4. w6 de (20, −6) a (28, −6), suelto; w7 en T sobre w6 en (24, −6), suelto en (24, −2).
  const e = await p.evaluar(`(() => { const { editor: ed, comandos: c } = bornera; const d = ed.documento;
    const L = (x, y) => ({ tipo: "libre", x, y }), T = (cable, x, y) => ({ tipo: "cable", cable, x, y });
    const B = (comp, borne) => ({ tipo: "borne", comp, borne });
    const cab = (desde, hasta, codos = []) => { const k = c.cablear(d, { desde, hasta, codos }); ed.ejecutar(k); return k.id; };
    const comp = (x, y, etiqueta) => { const k = c.colocar(d, { tipo: "contactor.bobina", x, y, rot: 0, espejado: false, etiqueta, params: {} }); ed.ejecutar(k); return k.id; };
    const k1 = comp(0, 0, "K1"), k2 = comp(12, 0, "K2");
    const w1 = cab(B(k1, "A1"), L(8, -3), [[0, -6], [8, -6]]);
    const w2 = cab(L(4, 4), L(16, 4));
    const w6 = cab(L(20, -6), L(28, -6));
    const w7 = cab(T(w6, 24, -6), L(24, -2));
    const css = getComputedStyle(document.querySelector("canvas"));
    const cx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const rgb = (nombre) => { cx.fillStyle = css.getPropertyValue(nombre).trim(); cx.fillRect(0, 0, 1, 1); return Array.from(cx.getImageData(0, 0, 1, 1).data.slice(0, 3)); };
    return { k1, k2, w1, w2, w6, w7, borne: rgb("--borne"), trazo: rgb("--simbolo"), fondo: rgb("--lienzo") }; })()`);

  // Seleccionar una vez abre el panel y cambia el ancho del lienzo: antes de las fotos.
  await p.evaluar(`bornera.activo().seleccionarIds(["${e.k2}"])`);
  await p.esc();
  await esperar(200);

  for (const zoom of [0.58, 0.73]) {
    const pct = Math.round(zoom * 100);
    await camara(zoom, 12, -1);
    await deseleccionar();
    const docRef = await documento();
    const pasosRef = await pasos();
    await foto("ref");

    // ── Cursor y barra sobre el extremo, sin gesto ──
    await a(8, -3, { dx: 2, dy: 1 });
    const sobre = { cursor: await cursor(), pista: await pista() };
    comprobar(
      `${pct} %: sobre el extremo libre, cursor de mano y la barra dice qué hacer`,
      sobre.cursor === "pointer" && sobre.pista === "Extremo suelto: arrastralo hasta un borne o un cable para conectarlo",
      JSON.stringify(sobre),
    );

    // ── A un borne ──
    const anillo = await deBorne(8, -3, 6);
    await agarrar(8, -3, [
      [9, -3],
      [11, -2.5],
      [12.2, -2.2],
    ]);
    const durante = { cursor: await cursor(), pista: await pista(), seleccion: await seleccion() };
    comprobar(
      `${pct} %: arrastrando, cursor de cruz, la barra nombra el borne y queda seleccionado solo el cable`,
      durante.cursor === "crosshair" && durante.pista === "Conecta con K2 · A1" && durante.seleccion === JSON.stringify([e.w1]),
      JSON.stringify(durante),
    );
    await soltar(12.2, -2.2);
    const w1 = JSON.parse(await cable(e.w1));
    await deseleccionar();
    const restosBorne = await sinRestos();
    const anilloDespues = await deBorne(8, -3, 6);
    comprobar(
      `${pct} %: a un borne: un paso, conectado a K2·A1, el círculo hueco no está más y sin restos`,
      (await pasos()) === pasosRef + 1 &&
        w1.hasta.tipo === "borne" &&
        w1.hasta.comp === e.k2 &&
        w1.hasta.borne === "A1" &&
        anillo > 0 &&
        anilloDespues === 0 &&
        restosBorne === 0 &&
        (await cursor()) === "",
      `${w1.hasta.tipo} · anillo ${anillo} → ${anilloDespues} px · restos ${restosBorne} px · cursor "${await cursor()}"`,
    );
    await foto("borne");
    await tecla(Z, CTRL);
    const dz = await distintos("ref");
    const docZ = await documento();
    await tecla(Y, CTRL);
    const dy = await distintos("borne");
    comprobar(
      `${pct} %: Ctrl+Z vuelve exacto al píxel y Ctrl+Y rehace exacto al píxel`,
      dz === 0 && docZ === docRef && dy === 0,
      `Ctrl+Z ${dz} px · Ctrl+Y ${dy} px`,
    );
    await tecla(Z, CTRL);

    // ── A un cable: la T con su punto, que aparece recién al soltar ──
    await agarrar(8, -3, [
      [9, -3],
      [8.5, 2],
      [8.1, 3.9],
    ]);
    const enPrevia = { pista: await pista(), uniones: await uniones() };
    await reposo();
    // A (1, 1) px del centro de (8, 4) cae dentro del punto (a 58 % mide 5,8 px) y fuera de los dos cables.
    const puntoPrevia = await p.evaluar(`(() => { const cam = bornera.editor.vista.camara, k = cam.escala;
      const px = Math.round(8 * k) - Math.round(cam.x * k) + 1, py = Math.round(4 * k) - Math.round(cam.y * k) + 1;
      return Array.from(document.querySelector("canvas").getContext("2d").getImageData(px, py, 1, 1).data.slice(0, 3)); })()`);
    await soltar(8.1, 3.9);
    await deseleccionar();
    await reposo();
    const puntoSoltado = await p.evaluar(`(() => { const cam = bornera.editor.vista.camara, k = cam.escala;
      const px = Math.round(8 * k) - Math.round(cam.x * k) + 1, py = Math.round(4 * k) - Math.round(cam.y * k) + 1;
      return Array.from(document.querySelector("canvas").getContext("2d").getImageData(px, py, 1, 1).data.slice(0, 3)); })()`);
    const cerca = (x, y) => x.every((v, i) => Math.abs(v - y[i]) <= 3);
    const restosT = await sinRestos();
    const unionesT = await uniones();
    comprobar(
      `${pct} %: a un cable: T en (8, 4), con su punto recién al soltar, y sin restos`,
      enPrevia.pista === "Derivación (T) sobre un cable" &&
        !enPrevia.uniones.includes("[8,4]") &&
        !cerca(puntoPrevia, e.trazo) &&
        unionesT.includes("[8,4]") &&
        cerca(puntoSoltado, e.trazo) &&
        restosT === 0,
      `previa ${JSON.stringify(enPrevia)} · píxel ${puntoPrevia} → ${puntoSoltado} (símbolo ${e.trazo}) · uniones ${unionesT} · restos ${restosT} px`,
    );
    await tecla(Z, CTRL);
    const dzT = await distintos("ref");
    comprobar(`${pct} %: Ctrl+Z de la T, exacto al píxel`, dzT === 0 && (await documento()) === docRef && (await pasos()) === pasosRef, `${dzT} px`);
  }

  // ── A 73 %: Esc, destino inválido, ciclo y vacío ──
  await camara(0.73, 12, -1);
  await deseleccionar();
  const docRef = await documento();
  const pasosRef = await pasos();
  await p.evaluar(`bornera.activo().seleccionarIds(["${e.k2}"])`);
  await foto("conK2");

  // Esc en medio: la pantalla y la selección de antes.
  await agarrar(8, -3, [
    [9, -3],
    [12, -2],
  ]);
  await p.esc();
  await esperar(60);
  const dEsc = await distintos("conK2");
  comprobar(
    "73 %: Esc en medio del arrastre: sin paso, igual al píxel que antes y vuelve la selección de antes (K2)",
    dEsc === 0 && (await pasos()) === pasosRef && (await documento()) === docRef && (await seleccion()) === JSON.stringify([e.k2]),
    `${dEsc} px · selección ${await seleccion()}`,
  );
  // Botón derecho en medio (con el izquierdo apretado): cancela igual que Esc.
  await agarrar(8, -3, [
    [9, -3],
    [12, -2],
  ]);
  {
    const q = await p.punto(12, -2);
    await p.mouse("mousePressed", q.x, q.y, { boton: "right", botones: 3 });
    await p.mouse("mouseReleased", q.x, q.y, { boton: "right", botones: 1 });
    await p.mouse("mouseReleased", q.x, q.y);
    await esperar(60);
  }
  const dDerecho = await distintos("conK2");
  comprobar(
    "73 %: el botón derecho en medio cancela igual que Esc: sin paso, igual al píxel y la selección de antes (K2)",
    dDerecho === 0 && (await pasos()) === pasosRef && (await documento()) === docRef && (await seleccion()) === JSON.stringify([e.k2]),
    `${dDerecho} px · selección ${await seleccion()} · reconectando ${await p.evaluar("bornera.editor.reconectando")}`,
  );
  await deseleccionar();
  await foto("ref73");

  const sinPaso = async (nombreCaso, id, desde, hasta, mensaje) => {
    await agarrar(desde[0], desde[1], [[desde[0] + 1, desde[1]], hasta]);
    const enPrevia = await pista();
    await soltar(hasta[0], hasta[1]);
    const avisado = await aviso();
    await deseleccionar();
    const d = await distintos("ref73");
    comprobar(
      `73 %: ${nombreCaso}: sin paso y la pantalla igual que antes${mensaje ? "; el motivo en la barra y en el aviso" : ""}`,
      (await pasos()) === pasosRef &&
        (await documento()) === docRef &&
        d === 0 &&
        (mensaje ? enPrevia === mensaje && (avisado ?? "").includes(mensaje) : enPrevia === "Soltalo sobre un borne o un cable · Esc cancela"),
      `barra "${enPrevia}" · aviso "${avisado}" · ${d} px`,
    );
  };
  await sinPaso("mismo borne", e.w1, [8, -3], [0, -2.2], "No se puede terminar en el mismo borne.");
  await sinPaso("ciclo de apoyos", e.w6, [28, -6], [24, -3], "Ese cable se apoya en el que estás conectando: no se pueden apoyar uno en otro.");
  await sinPaso("vacío", e.w1, [8, -3], [20, 10], null);

  // ── A 58 %: el extremo se agarra a 8 px del centro, no a 9,5 ──
  await camara(0.58, 12, -1);
  const agarra = async (dx) => {
    await agarrar(8, -3, [[8, 0]], { dx, dy: 0 });
    const r = await p.evaluar("bornera.editor.reconectando");
    await p.esc();
    await esperar(30);
    await p.mouse("mouseReleased", 0, 0);
    await esperar(30);
    return r;
  };
  const a8 = await agarra(7.9);
  const a95 = await agarra(9.5);
  comprobar("58 %: el extremo se agarra a 8 px del centro y no a 9,5", a8 === true && a95 === false, `8 px: ${a8} · 9,5 px: ${a95}`);
  comprobar("todo quedó como al principio", (await documento()) === docRef && (await pasos()) === pasosRef);
}
