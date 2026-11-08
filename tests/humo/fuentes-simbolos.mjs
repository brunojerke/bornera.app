// Símbolos de fase y neutro: círculo con senoide y un borne abajo. Colocar
// desde la paleta, contorno igual a la caja 2×2, borne en la grilla, etiqueta
// a 51 % y 100 % de zoom, y que al mover no quede rastro de la etiqueta.
// (Rotar 180° desde la app llega con T10: acá no se prueba.)

import { esperar } from "./cdp.mjs";

export const nombre = "Símbolos de fase y neutro";

/**
 * Píxeles del lienzo (en píxeles del dispositivo) que cubren la caja de grilla
 * `k`, como texto: para comparar una región antes y después.
 */
const region = (p, k) =>
  p.evaluar(`(() => { const cv = document.querySelector("canvas"); const cam = bornera.activo().vista.camara;
    const d = cv.width / cv.clientWidth; const a = cam.aPantalla(${k.x}, ${k.y}), b = cam.aPantalla(${k.x + k.ancho}, ${k.y + k.alto});
    const x = Math.floor(a.x * d), y = Math.floor(a.y * d), w = Math.ceil(b.x * d) - x, h = Math.ceil(b.y * d) - y;
    const datos = cv.getContext("2d").getImageData(x, y, w, h).data; let s = 0;
    for (let i = 0; i < datos.length; i += 4) { const v = datos[i] + datos[i + 1] * 7 + datos[i + 2] * 13; s = (s * 31 + v) | 0; }
    return w + "x" + h + ":" + s; })()`);

const centrar = (p, zoom, gx, gy) =>
  p.evaluar(`(() => { const ed = bornera.activo(), cv = document.querySelector("canvas");
    ed.vista.camara.zoom = ${zoom}; ed.vista.camara.centrar(${gx}, ${gy}, cv.clientWidth, cv.clientHeight); ed.vista.invalidar(); })()`);

export default async function (p, comprobar) {
  // 1) Colocar fase y neutro arrastrando desde la paleta.
  const items = await p.evaluar(`[...document.querySelectorAll(".item")].map(e => { const r = e.getBoundingClientRect();
    return { texto: e.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`);
  const lienzo = await p.caja("canvas");
  await centrar(p, 1, 0, 0);
  await esperar(50);
  for (const [i, texto] of ["Fase (L)", "Neutro (N)"].entries()) {
    const item = items.find((t) => t.texto === texto);
    comprobar(`la paleta tiene "${texto}"`, !!item);
    if (!item) return;
    // Previa al colocar: captura con el símbolo bajo el puntero.
    await p.mouse("mouseMoved", item.x, item.y);
    await p.mouse("mousePressed", item.x, item.y);
    await p.mouse("mouseMoved", lienzo.cx - 60 + i * 120, lienzo.cy, { botones: 1 });
    await esperar(50);
    await p.captura(`colocando-${i ? "neutro" : "fase"}`);
    await p.mouse("mouseReleased", lienzo.cx - 60 + i * 120, lienzo.cy);
    await esperar(50);
  }
  const datos = await p.evaluar(`(() => { const ed = bornera.activo();
    return ed.documento.hojas[0].componentes.map(c => ({ id: c.id, tipo: c.tipo, x: c.x, y: c.y, etiqueta: c.etiqueta, contorno: ed.escena.contorno(c.id) })); })()`);
  const fase = datos.find((c) => c.tipo === "fuente.fase");
  const neutro = datos.find((c) => c.tipo === "fuente.neutro");
  comprobar("se colocaron la fase y el neutro", !!fase && !!neutro, JSON.stringify(datos));
  if (!fase || !neutro) return;
  comprobar("la fase entra como L y el neutro como N", fase.etiqueta === "L" && neutro.etiqueta === "N");
  comprobar(
    "los dos quedan en la grilla, con el borne en (x, y + 1)",
    [fase, neutro].every((c) => Number.isInteger(c.x) && Number.isInteger(c.y + 1)),
  );
  // El cuerpo (contorno del arrastre) es la caja 2×2; con la etiqueta, el contorno de elección la incluye.
  comprobar(
    "el contorno cubre la caja 2×2 del símbolo y la etiqueta a la izquierda",
    [fase, neutro].every((c) => {
      const k = c.contorno;
      return k && k.x < c.x - 1 && Math.abs(k.y - (c.y - 1)) < 1e-9 && Math.abs(k.x + k.ancho - (c.x + 1)) < 1e-9 && Math.abs(k.alto - 2) < 1e-9;
    }),
    JSON.stringify([fase.contorno, neutro.contorno]),
  );

  // 2) Zoom 51 % y 100 %: los textos se dibujan (etiqueta visible).
  for (const zoom of [0.51, 1]) {
    await centrar(p, zoom, (fase.x + neutro.x) / 2, fase.y);
    await esperar(100);
    const escala = await p.evaluar("bornera.activo().vista.camara.escala");
    comprobar(`al ${Math.round(zoom * 100)} % hay detalle de textos (escala ${escala} ≥ 6)`, escala >= 6);
    await p.captura(`zoom-${Math.round(zoom * 100)}`);
  }

  // 3) Al mover no queda rastro de la etiqueta: una fase "L123" (etiqueta
  //    larga, a la izquierda del círculo) en (0, 10); se mira su región antes
  //    de colocarla, con ella y después de moverla lejos.
    await centrar(p, 1, 0, 10);
  await esperar(100);
  // Caja de la etiqueta: termina 1,5 a la izquierda del centro, 0,7 por letra, 1 de alto.
  const etiqueta = { x: -1.5 - 4 * 0.7, y: 10 - 0.5, ancho: 4 * 0.7, alto: 1 };
  const vacia = await region(p, etiqueta);
  const id = await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
    const cmd = c.colocar(editor.documento, { tipo: "fuente.fase", x: 0, y: 10, rot: 0, espejado: false, etiqueta: "L123", params: {} });
    editor.ejecutar(cmd); return cmd.id; })()`);
  await esperar(100);
  const conEtiqueta = await region(p, etiqueta);
  comprobar("la etiqueta L123 se dibuja a la izquierda del círculo", conEtiqueta !== vacia);
  // Arrastre: captura en el medio, con el símbolo entero en la capa dinámica.
  const ini = await p.punto(0, 10);
  const fin = await p.punto(8, 12);
  await p.mouse("mouseMoved", ini.x, ini.y);
  await p.mouse("mousePressed", ini.x, ini.y);
  for (let i = 1; i <= 10; i++) {
    await p.mouse("mouseMoved", ini.x + ((fin.x - ini.x) * i) / 10, ini.y + ((fin.y - ini.y) * i) / 10, { botones: 1 });
  }
  await esperar(50);
  await p.captura("arrastrando");
  await p.mouse("mouseReleased", fin.x, fin.y);
  await esperar(150);
  const pos = await p.evaluar(`(() => { const c = bornera.activo().escena.obtener("${id}"); return c.x + "," + c.y; })()`);
  comprobar("la fase se movió a (8, 12)", pos === "8,12", pos);
  comprobar("donde estaba la etiqueta no queda rastro", (await region(p, etiqueta)) === vacia);
  await p.captura("movido");
}
