// T13: herramienta cable (W). Con el mouse de verdad, a 1024×600: W activa la
// herramienta (cursor y botón); el botón Deshacer anda con un tramo aunque el
// historial esté vacío; cables entre bornes con 0, 1 y 2 codos (el de 2, con
// un arrastre), extremo libre, T sobre un cable y un cruce que no conecta;
// Esc y el botón derecho con y sin tramo; Ctrl+Z deshace el cable entero en
// un paso; atravesar una bobina no crea nada; segundo y tercer cable del
// mismo borne, el cuarto avisa y la derivación con T funciona; W escrita en
// el buscador y en el campo de etiqueta no activa nada; y sin restos (la
// pantalla queda igual tras cancelar y tras crear y deshacer).

import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Herramienta cable (W)";

const W = ["w", "KeyW", 87];
const Z = ["z", "KeyZ", 90];
const SIN_SALIDAS = "El borne no tiene más salidas libres: derivá con una T sobre uno de sus cables.";

export default async function (p, comprobar) {
  const tecla = ([key, code, vk], mods = 0, texto) => p.tecla(key, code, vk, mods, texto);
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
  const pasos = () => p.evaluar("bornera.activo().historial.hechos.length");
  const cables = () => p.evaluar("JSON.stringify(bornera.editor.documento.hojas[0].cables)");
  const ultimo = () => p.evaluar("JSON.stringify(bornera.editor.documento.hojas[0].cables.at(-1) ?? null)");
  const cantidad = () => p.evaluar("bornera.editor.documento.hojas[0].cables.length");
  const documento = () => p.evaluar("JSON.stringify(bornera.editor.documento)");
  const hojas = () => p.evaluar("JSON.stringify(bornera.editor.documento.hojas)");
  const activa = () => p.evaluar("bornera.editor.cable !== null");
  const enTramo = () => p.evaluar("bornera.editor.enTramo");
  const aviso = () => p.evaluar(`document.querySelector(".avisos")?.textContent.trim() ?? null`);
  const pista = () => p.evaluar(`document.querySelector("footer .pista-herramienta")?.textContent.trim() ?? null`);
  const deshacerActivo = () => p.evaluar(`!document.querySelector('button[aria-label="Deshacer"]').disabled`);
  const botonCable = () => p.evaluar(`document.querySelector(".herramienta")?.getAttribute("aria-pressed") === "true"`);
  const cursor = () => p.evaluar(`document.querySelector("canvas").parentElement.style.cursor`);
  /** Clic en el punto de grilla (gx, gy). */
  const clic = async (gx, gy) => p.clic(await p.punto(gx, gy));
  const mover = async (gx, gy) => {
    const q = await p.punto(gx, gy);
    await p.mouse("mouseMoved", q.x, q.y);
    await esperar(20);
  };
  /** Mouse fuera del lienzo (sobre la paleta): la capa dinámica no muestra objetivo. */
  const afuera = async () => {
    await p.mouse("mouseMoved", 8, 400);
    await esperar(30);
  };
  const derecho = async (gx, gy) => {
    const q = await p.punto(gx, gy);
    await p.mouse("mouseMoved", q.x, q.y);
    await p.mouse("mousePressed", q.x, q.y, { boton: "right", botones: 2 });
    await p.mouse("mouseReleased", q.x, q.y, { boton: "right", botones: 0 });
    await esperar(30);
  };
  const libre = (x, y) => ({ tipo: "libre", x, y });

  // ── Con el historial vacío: el botón Deshacer anda con un tramo ──
  comprobar("al empezar no hay nada para deshacer", !(await deshacerActivo()));
  await tecla(W);
  comprobar("W activa la herramienta: cursor de cruz y botón resaltado", (await activa()) && (await cursor()) === "crosshair" && (await botonCable()));
  await clic(3, 3);
  comprobar("con un tramo, el botón Deshacer se activa aunque el historial esté vacío", (await enTramo()) && (await deshacerActivo()));
  await p.clic(await p.caja('button[aria-label="Deshacer"]').then((k) => ({ x: k.cx, y: k.cy })));
  comprobar(
    "el botón hace lo mismo que Ctrl+Z: cancela el tramo, y vuelve a depender del historial",
    !(await enTramo()) && !(await deshacerActivo()) && (await pasos()) === 0,
  );
  await p.esc();
  comprobar("Esc sin tramo sale de la herramienta", !(await activa()) && (await cursor()) === "");

  // ── Armado ──
  await p.evaluar(`(() => { const { editor: ed, comandos: c } = bornera; const d = ed.documento;
    const comp = (x, y, etiqueta) => ed.ejecutar(c.colocar(d, { tipo: "contactor.bobina", x, y, rot: 0, espejado: false, etiqueta, params: {} }));
    comp(0, 0, "K1"); comp(0, -8, "K3"); comp(5, 10, "K5"); comp(400, 400, "LEJOS");
    ed.ejecutar(c.cablear(d, { desde: { tipo: "libre", x: 8, y: 0 }, hasta: { tipo: "libre", x: 18, y: 0 }, codos: [] })); })()`);
  // El panel se abre (cambia el ancho del lienzo) antes de las fotos.
  await p.evaluar(`bornera.editor.seleccionarIds(["c4"])`);
  await p.esc();
  await esperar(150);
  await p.evaluar(`(() => { const cv = document.querySelector("canvas"); const v = bornera.editor.vista;
    v.camara.zoom = 1; v.camara.centrar(5, -1, cv.clientWidth, cv.clientHeight); v.invalidar(); })()`);
  await afuera();
  await foto("base");
  const base = await hojas();

  // ── Pista y objetivo antes del clic ──
  await tecla(W);
  await mover(0, 2.2);
  comprobar("sobre un borne, la barra dice dónde empieza", (await pista()) === "Empezar en K1 · A2", await pista());
  await mover(12, 0.2);
  comprobar("sobre un cable, una derivación", (await pista()) === "Empezar con una derivación (T) sobre un cable", await pista());

  // ── 0 codos: K1 A1 → K3 A2 ──
  let n = await pasos();
  await clic(0, -2);
  await mover(0, -6);
  comprobar("con un tramo, sobre el otro borne: Conecta con K3 · A2", (await pista()) === "Conecta con K3 · A2", await pista());
  await clic(0, -6);
  comprobar(
    "borne → borne alineados: un cable sin codos, en un paso",
    (await pasos()) === n + 1 &&
      (await ultimo()) === JSON.stringify({ id: "w2", desde: { tipo: "borne", comp: "c1", borne: "A1" }, hasta: { tipo: "borne", comp: "c2", borne: "A2" }, codos: [] }),
    await ultimo(),
  );
  comprobar("la herramienta sigue activa", await activa());

  // ── 2 codos, arrastrando: K1 A2 → K5 A1, Z por la mitad ──
  await p.arrastrar(await p.punto(0, 2), await p.punto(5, 8));
  const z = JSON.parse(await ultimo());
  comprobar(
    "arrastrar de borne a borne: Z con 2 codos",
    z.desde.borne === "A2" && z.hasta.comp === "c3" && z.hasta.borne === "A1" && JSON.stringify(z.codos) === "[[0,5],[5,5]]",
    JSON.stringify(z),
  );

  // ── 1 codo con extremo libre: desde K3 A1, doble clic en el codo ──
  await clic(0, -10);
  await clic(4, -13);
  await mover(4, -13);
  comprobar("otro clic en el último codo: la barra avisa que termina libre", (await pista()) === "Extremo libre: clic para terminar acá", await pista());
  await clic(4, -13);
  comprobar(
    "1 codo y extremo libre",
    (await ultimo()) === JSON.stringify({ id: "w4", desde: { tipo: "borne", comp: "c2", borne: "A1" }, hasta: libre(4, -13), codos: [[0, -13]] }),
    await ultimo(),
  );

  // ── T sobre el cable w1 ──
  await clic(13, -5);
  await clic(13, 0);
  comprobar(
    "terminar sobre un cable: T en el punto",
    (await ultimo()) === JSON.stringify({ id: "w5", desde: libre(13, -5), hasta: { tipo: "cable", cable: "w1", x: 13, y: 0 }, codos: [] }),
    await ultimo(),
  );

  // ── Cruce: no conecta ──
  await clic(16, -3);
  await clic(16, 3);
  await clic(16, 3);
  const cruce = JSON.parse(await ultimo());
  comprobar("cruzar un cable no lo conecta (los dos extremos libres)", cruce.desde.tipo === "libre" && cruce.hasta.tipo === "libre", JSON.stringify(cruce));
  comprobar("todos los cables válidos", (await p.evaluar("bornera.cables.validarHoja(bornera.editor.documento.hojas[0]).length")) === 0);

  // ── Inválido: atravesar la bobina ──
  const antesInv = await cables();
  await clic(-5, 0);
  await mover(5, 0);
  comprobar("la previa dice por qué no", (await pista()) === "El cable atravesaría el cuerpo de K1.", await pista());
  await clic(5, 0);
  comprobar("y el clic no crea ni fija nada", (await cables()) === antesInv && (await p.evaluar("bornera.editor.cable.fijados.length")) === 0, await aviso());

  // ── Esc y botón derecho, con y sin tramo ──
  await p.esc();
  comprobar("Esc con tramo cancela el cable; la herramienta sigue", !(await enTramo()) && (await activa()));
  await clic(10, -8);
  await clic(12, -10);
  await derecho(12, -10);
  comprobar("el botón derecho con tramo también lo cancela", !(await enTramo()) && (await activa()) && (await cables()) === antesInv);
  await derecho(12, -10);
  comprobar("y sin tramo sale de la herramienta", !(await activa()));

  // ── Ctrl+Z: el cable entero en un paso ──
  await tecla(W);
  n = await pasos();
  const nCables = await cantidad();
  await clic(10, -8);
  await clic(12, -10);
  await clic(14, -12);
  await clic(14, -12);
  comprobar("un cable con codos, un paso", (await pasos()) === n + 1 && (await cantidad()) === nCables + 1);
  await tecla(Z, CTRL);
  comprobar("Ctrl+Z (sin tramo) lo deshace entero", (await pasos()) === n && (await cantidad()) === nCables);
  // Con tramo, Ctrl+Z quita codos y no toca el historial.
  await clic(10, -8);
  await clic(12, -10);
  await tecla(Z, CTRL);
  await tecla(Z, CTRL);
  comprobar("con tramo, Ctrl+Z quita el codo y después cancela, sin tocar el historial", !(await enTramo()) && (await pasos()) === n);

  // ── Varios cables en un borne: K1 A1 ya tiene uno hacia arriba ──
  await clic(0, -2);
  await clic(4, -4);
  await clic(4, -4);
  const segundo = JSON.parse(await ultimo());
  comprobar("el segundo cable del borne sale de costado, sin encimarse", JSON.stringify(segundo.codos) === "[[4,-2]]", JSON.stringify(segundo));
  await clic(0, -2);
  await clic(-4, -4);
  await clic(-4, -4);
  const tercero = JSON.parse(await ultimo());
  comprobar("el tercero, por el otro costado", JSON.stringify(tercero.codos) === "[[-4,-2]]", JSON.stringify(tercero));
  const antes4 = await cables();
  await mover(0, -2);
  comprobar("el cuarto: la barra avisa que no hay salidas", (await pista()) === SIN_SALIDAS, await pista());
  await clic(0, -2);
  comprobar("y no empieza", !(await enTramo()) && (await cables()) === antes4);
  await clic(0, -4);
  await clic(2, -4);
  await clic(2, -4);
  const t = JSON.parse(await ultimo());
  comprobar("derivar con una T sobre el primero funciona", t.desde.tipo === "cable" && t.desde.cable === "w2" && t.desde.y === -4, JSON.stringify(t));
  await p.esc();

  // ── W en el buscador y en el campo de etiqueta ──
  await p.esc(); // sale de la herramienta
  const buscador = await p.caja('input[type="search"]');
  await p.clic({ x: buscador.cx, y: buscador.cy });
  await tecla(W, 0, "w");
  comprobar(
    "W escrita en el buscador no activa la herramienta",
    !(await activa()) && (await p.evaluar(`document.querySelector('input[type="search"]').value`)) === "w",
  );
  await p.evaluar(`(() => { const i = document.querySelector('input[type="search"]'); i.value = ""; i.dispatchEvent(new Event("input")); i.blur(); })()`);
  await p.evaluar(`bornera.editor.seleccionarIds(["c3"])`);
  await esperar(50);
  const campo = await p.caja("#prop-etiqueta");
  await p.clic({ x: campo.cx, y: campo.cy });
  await tecla(W, 0, "w");
  comprobar("W escrita en el campo de etiqueta no activa la herramienta", !(await activa()) && (await p.evaluar(`document.querySelector("#prop-etiqueta").value.includes("w")`)));
  await p.esc(); // cancela la edición
  await p.esc(); // deselecciona

  // ── Sin restos ──
  // Deshacer lo que hizo la herramienta hasta el armado.
  await p.evaluar(`(() => { const ed = bornera.editor; while (JSON.stringify(ed.documento.hojas[0].cables) !== ${JSON.stringify(JSON.stringify(JSON.parse(base)[0].cables))}) ed.deshacer(); })()`);
  await afuera();
  let d = await distintos("base");
  comprobar("deshecho todo, la pantalla es la del armado", (await hojas()) === base && d === 0, `${d} píxeles distintos`);
  // Cancelar no cambia nada, ni los contadores de ids.
  const antesCancelar = await documento();
  await tecla(W);
  await clic(10, -8);
  await clic(12, -10);
  await mover(14, -6);
  await p.esc();
  await p.esc();
  await afuera();
  d = await distintos("base");
  comprobar("cancelar un tramo no deja restos ni cambia el documento (ni gasta ids)", (await documento()) === antesCancelar && d === 0, `${d} píxeles distintos`);
  await tecla(W);
  await clic(10, -8);
  await clic(12, -10);
  await clic(12, -10);
  await p.esc();
  await tecla(Z, CTRL);
  await afuera();
  d = await distintos("base");
  comprobar("crear un cable y deshacerlo no deja restos", d === 0, `${d} píxeles distintos`);
  await p.captura("cable");

  // ── Ruteo en las 8 orientaciones, con clics de verdad ──
  // Una bobina por orientación; desde A1, un clic 3 adelante y 2 al costado:
  // la L sale por la dirección real del borne transformado.
  const ocho = await p.evaluar(`(() => { const { editor: ed, comandos: c, cables } = bornera; const d = ed.documento;
    const VEC = { derecha: [1, 0], izquierda: [-1, 0], abajo: [0, 1], arriba: [0, -1] };
    const salida = []; let i = 0;
    for (const rot of [0, 90, 180, 270]) for (const espejado of [false, true]) {
      const k = c.colocar(d, { tipo: "contactor.bobina", x: 40 + 8 * (i % 4), y: 8 * Math.floor(i / 4), rot, espejado, etiqueta: "", params: {} });
      ed.ejecutar(k); i++;
      const b = cables.borneDe(d.hojas[0].componentes.find((x) => x.id === k.id), "A1");
      const [vx, vy] = VEC[b.direccion];
      salida.push({ rot, espejado, x: b.x, y: b.y, ax: b.x + 3 * vx, ay: b.y + 3 * vy, hx: b.x + 3 * vx + 2 * vy, hy: b.y + 3 * vy + 2 * vx, comp: k.id });
    }
    const cv = document.querySelector("canvas"); ed.vista.camara.zoom = 0.7; ed.vista.camara.centrar(52, 4, cv.clientWidth, cv.clientHeight); ed.vista.invalidar();
    return salida; })()`);
  await esperar(100);
  await tecla(W);
  const fallan = [];
  for (const o of ocho) {
    await clic(o.x, o.y);
    await clic(o.hx, o.hy);
    await clic(o.hx, o.hy);
    const w = JSON.parse(await ultimo());
    const bien = w.desde.comp === o.comp && w.desde.borne === "A1" && JSON.stringify(w.codos) === JSON.stringify([[o.ax, o.ay]]);
    if (!bien) fallan.push(`${o.rot}°${o.espejado ? " esp." : ""}: ${JSON.stringify(w.codos)}`);
  }
  comprobar("en las 8 orientaciones, el cable sale por la dirección del borne transformado", fallan.length === 0, fallan.join(" · "));
  await p.esc();
}
