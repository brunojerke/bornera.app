// T12: cables en el modelo y en la escena. Los cables se crean por comando
// (la herramienta W es de T13). Se ven en las 8 orientaciones de los bornes;
// un clic los elige (por encima del componente), Supr los borra y Ctrl+Z los
// devuelve sin restos; borrar un componente con dos cables los suelta y
// deshacer y rehacer dejan la pantalla exacta; girar y arrastrar con cables
// avisan y no dan paso; el panel muestra "Cable" y las cantidades; y no hay
// cortes en los bordes de mosaico (la misma escena corrida da los mismos
// píxeles). Al final, la escena de 2000 símbolos y 3000 cables.

import { CTRL, esperar, MAYUS } from "./cdp.mjs";

export const nombre = "Cables en el modelo y en la escena";

const R = ["r", "KeyR", 82];
const SUPR = ["Delete", "Delete", 46];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];

export default async function (p, comprobar) {
  const tecla = ([key, code, w], mods = 0) => p.tecla(key, code, w, mods);
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
  /** True si el píxel del punto de grilla (gx, gy) cambió respecto de la foto `n`. */
  const pintado = async (gx, gy, n) => {
    await reposo();
    return p.evaluar(`(() => { const cv = document.querySelector("canvas"); const k = cv.width / cv.clientWidth;
      const q = bornera.activo().vista.camara.aPantalla(${gx}, ${gy});
      const x = Math.round(q.x * k), y = Math.round(q.y * k), i = (y * cv.width + x) * 4;
      const a = globalThis.__fotos["${n}"], b = cv.getContext("2d").getImageData(x, y, 1, 1).data;
      return a[i] !== b[0] || a[i + 1] !== b[1] || a[i + 2] !== b[2]; })()`);
  };
  const pasos = () => p.evaluar("bornera.activo().historial.hechos.length");
  const seleccion = () => p.evaluar("JSON.stringify([...bornera.activo().seleccion].sort())");
  const seleccionar = (ids) => p.evaluar(`bornera.activo().seleccionarIds(${JSON.stringify(ids)})`);
  const texto = (sel) => p.evaluar(`document.querySelector(${JSON.stringify(sel)})?.textContent.trim() ?? null`);
  const aviso = () => texto(".avisos");
  const documento = () => p.evaluar("JSON.stringify(bornera.editor.documento.hojas)");
  const camara = (gx, gy) =>
    p.evaluar(`(() => { const cv = document.querySelector("canvas"); const v = bornera.editor.vista;
      v.camara.zoom = 0.5; v.camara.centrar(${gx}, ${gy}, cv.clientWidth, cv.clientHeight); v.invalidar(); })()`);

  /**
   * Arma la escena corrida (dx, dy) con comandos y devuelve los ids. K1, S1 y
   * H1 en fila; w1 recto arriba, w2 por abajo, w3 que cruza a los dos sin
   * conectar, un cable largo en L que pasa por varios mosaicos y 8 bobinas
   * en las 8 orientaciones, cada una con un cable de 3 unidades desde A1.
   */
  const armar = (dx, dy) =>
    p.evaluar(`(() => { const { editor: ed, comandos: c, cables } = bornera; const d = ed.documento;
      const comp = (tipo, x, y, etiqueta, rot = 0, espejado = false) => {
        const k = c.colocar(d, { tipo, x: x + ${dx}, y: y + ${dy}, rot, espejado, etiqueta, params: {} }); ed.ejecutar(k); return k.id; };
      const b = (comp, borne) => ({ tipo: "borne", comp, borne });
      const l = (x, y) => ({ tipo: "libre", x: x + ${dx}, y: y + ${dy} });
      const cab = (desde, hasta, codos = []) => {
        const k = c.cablear(d, { desde, hasta, codos: codos.map(([x, y]) => [x + ${dx}, y + ${dy}]) }); ed.ejecutar(k); return k.id; };
      const K1 = comp("contactor.bobina", -6, 0, "K1");
      const S1 = comp("pulsador.na", 0, 0, "S1");
      const H1 = comp("senalizacion.lampara", 6, 0, "H1");
      const w1 = cab(b(K1, "A1"), b(S1, "13"));
      const w2 = cab(b(K1, "A2"), b(S1, "14"), [[-6, 5], [0, 5]]);
      const w3 = cab(b(H1, "X1"), l(-3, 8), [[6, -4], [-3, -4]]);
      const largo = cab(l(-30, -10), l(30, 12), [[30, -10]]);
      const VEC = { derecha: [1, 0], izquierda: [-1, 0], abajo: [0, 1], arriba: [0, -1] };
      const ocho = [];
      let i = 0;
      for (const rot of [0, 90, 180, 270]) for (const esp of [false, true]) {
        const id = comp("contactor.bobina", -12 + 8 * (i % 4), 15 + 8 * Math.floor(i / 4), "", rot, esp);
        i++;
        const q = cables.borneDe(d.hojas[0].componentes.find((k) => k.id === id), "A1");
        const [vx, vy] = VEC[q.direccion];
        const k = c.cablear(d, { desde: b(id, "A1"), hasta: { tipo: "libre", x: q.x + 3 * vx, y: q.y + 3 * vy }, codos: [] });
        ed.ejecutar(k);
        ocho.push({ rot, esp, x: q.x + 2.5 * vx, y: q.y + 2.5 * vy });
      }
      return { K1, S1, H1, w1, w2, w3, largo, ocho }; })()`);

  // Un componente lejos abre el panel (cambia el ancho del lienzo) antes de las fotos.
  const lejos = await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
    const k = c.colocar(editor.documento, { tipo: "contactor.bobina", x: 500, y: 500, rot: 0, espejado: false, etiqueta: "X", params: {} });
    editor.ejecutar(k); return k.id; })()`);
  await seleccionar([lejos]);
  await p.esc();
  await esperar(200);
  await camara(0, 4);
  await foto("vacia");
  const pasosBase = await pasos();

  const e = await armar(0, 0);
  await foto("ref");
  await p.captura("cables");

  // ── Se ven, en las 8 orientaciones, y deshacer un Cablear los saca sin restos ──
  const fallan = [];
  for (const o of e.ocho) if (!(await pintado(o.x, o.y, "vacia"))) fallan.push(`${o.rot}°${o.esp ? " esp." : ""}`);
  comprobar("en las 8 orientaciones, el cable sale del borne transformado y se ve", fallan.length === 0, fallan.join(", "));
  comprobar("el cable largo en L se ve en su esquina", await pintado(30, -10, "vacia"));
  comprobar("todos válidos", (await p.evaluar("bornera.cables.validarHoja(bornera.editor.documento.hojas[0]).length")) === 0);
  const antesW = await pasos();
  await tecla(Z, CTRL);
  const tras = [await pasos(), await pintado(e.ocho[7].x, e.ocho[7].y, "vacia")];
  comprobar("Ctrl+Z deshace el último Cablear", tras[0] === antesW - 1 && !tras[1], JSON.stringify([antesW, ...tras]));
  await tecla(Y, CTRL);
  let d = await distintos("ref");
  comprobar("Ctrl+Y lo vuelve a poner, igual que antes", d === 0, `${d} píxeles distintos`);

  // ── Cruce sin conexión ──
  const cruce = await p.evaluar(`(() => { const h = bornera.editor.documento.hojas[0]; const n = (id) => {
    const w = h.cables.find((k) => k.id === id); return [bornera.cables.nodoExtremo(w.desde), bornera.cables.nodoExtremo(w.hasta)]; };
    const a = n("${e.w3}"), b = [...n("${e.w1}"), ...n("${e.w2}")]; return a.some((x) => x !== null && b.includes(x)); })()`);
  comprobar("w3 cruza a w1 y a w2 sin conectarse", cruce === false);

  // ── Clic: el cable gana sobre el componente; el panel dice "Cable" ──
  await p.clic(await p.punto(-4.5, -2));
  comprobar("un clic sobre el cable lo elige", (await seleccion()) === JSON.stringify([e.w1]), await seleccion());
  await esperar(50);
  comprobar(
    "el panel muestra Cable y sus extremos, sin campo de etiqueta",
    (await texto(".nombre")) === "Cable" &&
      (await p.evaluar(`[...document.querySelectorAll(".panel .valor")].map((x) => x.textContent.trim()).join("|")`)) === "K1 · A1|S1 · 13" &&
      (await p.evaluar(`document.querySelector("#prop-etiqueta") === null`)),
  );

  // ── R con un cable entre componentes que no se mueven: aviso, sin paso (T14a) ──
  const antesR = await pasos();
  await tecla(R);
  await esperar(50);
  comprobar(
    "R con un cable solo avisa y no da paso",
    (await pasos()) === antesR && (await aviso()) === "Ese cable está conectado a componentes que no se mueven: mové los componentes.",
    await aviso(),
  );

  // ── Supr borra el cable; Ctrl+Z lo devuelve sin restos ──
  await tecla(SUPR);
  comprobar("Supr borra el cable en un paso", (await pasos()) === antesR + 1 && (await p.evaluar(`!bornera.editor.escena.obtenerCable("${e.w1}")`)));
  comprobar("donde estaba no queda nada", !(await pintado(-4.5, -2, "vacia")));
  await tecla(Z, CTRL);
  d = await distintos("ref");
  comprobar("Ctrl+Z lo devuelve, igual que antes", d === 0, `${d} píxeles distintos`);

  // ── Arrastrar un componente cableado (T14a): un paso, los cables lo siguen; Ctrl+Z sin restos ──
  await p.esc();
  const antesArr = await pasos();
  const docAntes = await documento();
  await p.arrastrar(await p.punto(-6, 0), await p.punto(-6, 6));
  await esperar(50);
  comprobar(
    "arrastrar un componente con cables lo mueve en un paso y la hoja queda válida",
    (await pasos()) === antesArr + 1 &&
      (await documento()) !== docAntes &&
      (await p.evaluar("bornera.cables.validarHoja(bornera.editor.documento.hojas[0]).length")) === 0,
    await aviso(),
  );
  await p.esc();
  await tecla(Z, CTRL);
  d = await distintos("ref");
  comprobar("Ctrl+Z lo devuelve con sus cables y la pantalla queda igual", (await documento()) === docAntes && d === 0, `${d} píxeles distintos`);

  // ── Selección mezclada en el panel ──
  await seleccionar([e.K1, e.w1, e.w2]);
  await esperar(50);
  comprobar("el panel cuenta componentes y cables", (await texto(".nombre")) === "1 componente y 2 cables seleccionados", await texto(".nombre"));
  await tecla(["m", "KeyM", 77]);
  await esperar(50);
  // Espejar K1 (con w1 y w2) sobre su lugar no deja recorrido válido hasta S1: se rechaza, sin ids en el aviso.
  const avisoM = (await aviso()) ?? "";
  comprobar(
    "M con la selección mezclada avisa por qué y no da paso",
    (await pasos()) === antesArr && avisoM.startsWith("No se puede espejar: ") && !/[wc]\d+/.test(avisoM),
    avisoM,
  );

  // ── Borrar un componente con dos cables: los suelta; deshacer y rehacer, exactos ──
  await seleccionar([e.K1]);
  await tecla(SUPR);
  comprobar("Supr borra K1 en un solo paso", (await pasos()) === antesArr + 1);
  const sueltos = await p.evaluar(`(() => { const h = bornera.editor.documento.hojas[0];
    return ["${e.w1}", "${e.w2}"].map((id) => h.cables.find((k) => k.id === id)).map((w) => w.desde.tipo + "," + w.desde.x + "," + w.desde.y).join(" "); })()`);
  comprobar("sus dos cables quedan sueltos donde estaban los bornes", sueltos === "libre,-6,-2 libre,-6,2", sueltos);
  await p.esc();
  await foto("borrado");
  const docBorrado = await documento();
  await tecla(Z, CTRL);
  d = await distintos("ref");
  comprobar("Ctrl+Z devuelve K1 y sus cables, sin restos", (await documento()) === docAntes && d === 0, `${d} píxeles distintos`);
  await tecla(Y, CTRL);
  d = await distintos("borrado");
  comprobar("Ctrl+Y da el mismo resultado que borrar", (await documento()) === docBorrado && d === 0, `${d} píxeles distintos`);
  await tecla(Z, CTRL);

  // ── Bordes de mosaico: la misma escena corrida da los mismos píxeles ──
  // Los mosaicos están fijos en la grilla: al correr todo (10, 20), sus bordes
  // caen en otros lugares de los cables (200 y 144 px de 256). Si un tramo se
  // cortara o se pintara distinto en un borde, cambiarían píxeles. Lejos del
  // origen (su cruz no se corre) y con múltiplos de 5 (las rayas mayores de
  // la grilla quedan en el mismo lugar respecto de la escena).
  const volver = () => p.evaluar(`(() => { const ed = bornera.editor; while (ed.historial.hechos.length > ${pasosBase}) ed.deshacer(); })()`);
  await volver();
  await armar(100, 100);
  await camara(100, 104);
  await foto("lejos");
  await volver();
  await armar(110, 120);
  await camara(110, 124);
  await reposo();
  // Los mosaicos cubren 256 px físicos desde el origen de la grilla: un píxel
  // está en el borde si su x o su y de grilla, en px, cae a menos de 2 px de
  // un múltiplo de 256, en cualquiera de las dos fotos.
  const bordes = await p.evaluar(`(() => { const cv = document.querySelector("canvas"); const k = cv.width / cv.clientWidth;
    const a = globalThis.__fotos["lejos"], b = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    const cam = bornera.editor.vista.camara; const e = cam.escala * k;
    const cerca = (g) => { const m = (((g * e) % 256) + 256) % 256; return m < 2 || m > 254; };
    // Extremos libres de la escena de ahora (sus círculos son arcos: ver abajo).
    const libres = bornera.editor.documento.hojas[0].cables.flatMap((w) => [w.desde, w.hasta]).filter((x) => x.tipo === "libre");
    const enMarca = (g) => libres.some((l) => Math.hypot(g.x - l.x, g.y - l.y) < 0.6);
    let grandes = 0, chicas = 0, enBorde = 0, enBordeMarca = 0;
    for (let i = 0; i < a.length; i += 4) {
      const dif = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (dif === 0) continue;
      if (dif > 2) grandes++; else chicas++;
      const px = (i / 4) % cv.width, py = Math.floor(i / 4 / cv.width); const g = cam.aGrilla(px / k, py / k);
      if (cerca(g.x) || cerca(g.y) || cerca(g.x - 10) || cerca(g.y - 20)) {
        if (enMarca(g)) enBordeMarca++;
        else enBorde++;
      }
    }
    return { grandes, chicas, enBorde, enBordeMarca }; })()`);
  // Un corte daría diferencias grandes. El rasterizador suaviza ±1 distinto un
  // arco recortado por el borde del mosaico (el círculo de un extremo libre;
  // a los símbolos les pasaría igual): se informa, pero no es un corte.
  comprobar(
    "la escena corrida (otros bordes de mosaico): sin cortes, y los tramos de cable iguales también en los bordes",
    bordes.grandes === 0 && bordes.enBorde === 0,
    JSON.stringify(bordes),
  );
  console.log(
    `  ·   escena corrida: ${bordes.grandes} píxeles muy distintos; ${bordes.chicas} con ±1–2, ` +
      `${bordes.enBordeMarca} de ellos en el arco de un extremo libre sobre un borde de mosaico`,
  );
  await volver();

  // ── 2000 símbolos y 3000 cables: seleccionar todo y el resumen del panel ──
  for (let i = 0; i < 4; i++) await p.tecla("B", "KeyB", 66, CTRL | MAYUS);
  await p.esperarA("bornera.activo()?.escena.cantidadCables === 3000");
  await reposo();
  const t = await p.evaluar(`(() => { const ed = bornera.activo(); const ids = ed.escena.idsEnCaja(ed.escena.caja, "toca");
    const t0 = performance.now(); ed.seleccionarIds(ids); const t1 = performance.now(); const r = ed.resumenSeleccion();
    return { n: ids.length, seleccionar: t1 - t0, resumen: performance.now() - t1, componentes: r.componentes, cables: r.cables }; })()`);
  comprobar(
    `seleccionar todo con 2000 + 3000 cables: ${t.seleccionar.toFixed(1)} ms, resumen ${t.resumen.toFixed(1)} ms`,
    t.componentes === 2000 && t.cables === 3000 && t.seleccionar < 50 && t.resumen < 50,
    JSON.stringify(t),
  );
  console.log(`  ·   seleccionar todo (5000): ${t.seleccionar.toFixed(1)} ms · resumen ${t.resumen.toFixed(1)} ms`);
  await esperar(50);
  comprobar("el panel muestra las dos cantidades", (await texto(".nombre")) === "2000 componentes y 3000 cables seleccionados", await texto(".nombre"));
  await p.captura("cables-2000");
  for (let i = 0; i < 2; i++) await p.tecla("B", "KeyB", 66, CTRL | MAYUS);
  await p.esperarA("bornera.activo() === bornera.editor");
}
