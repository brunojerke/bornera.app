// T8: selección. Clic, Mayús+clic, clic en la etiqueta, clic en vacío,
// rectángulo contiene/toca, Esc, soltar fuera del lienzo, panel de
// propiedades y selección en la escena de 2000.

import { CTRL, esperar, MAYUS } from "./cdp.mjs";

export const nombre = "Selección";

const PANEL = 'aside[aria-label="Propiedades"]';

export default async function (p, comprobar) {
  // Tres bobinas K1 (0,0), K2 (10,0) y K3 (20,0), con la vista centrada en (10, 0) al 100 %.
  const [a, b, c] = await p.evaluar(`(() => {
    const { editor, comandos: c } = bornera;
    const ids = [[0, "K1"], [10, "K2"], [20, "K3"]].map(([x, etiqueta]) => {
      const cmd = c.colocar(editor.documento, { tipo: "contactor.bobina", x, y: 0, rot: 0, espejado: false, etiqueta, params: {} });
      editor.ejecutar(cmd);
      return cmd.id;
    });
    const cv = document.querySelector("canvas");
    editor.vista.camara.zoom = 1;
    editor.vista.camara.centrar(10, 0, cv.clientWidth, cv.clientHeight);
    editor.vista.invalidar();
    return ids;
  })()`);
  await esperar(100);
  const sel = () => p.evaluar("[...bornera.activo().seleccion].sort().join(',')");
  const panel = () => p.evaluar(`document.querySelector('${PANEL}').innerText.replace(/\\s+/g, " ").trim()`);
  const ids = (...x) => x.sort().join(",");

  await p.clic(await p.punto(0, 0));
  comprobar("clic selecciona K1", (await sel()) === a, await sel());
  const p1 = await panel();
  comprobar("el panel se abre solo y muestra K1", p1.includes("K1") && p1.includes("Rotación"), p1);
  await p.captura("clic");

  await p.clic(await p.punto(10, 0), MAYUS);
  comprobar("Mayús+clic suma K2", (await sel()) === ids(a, b), await sel());
  comprobar("el panel muestra la cantidad", (await panel()).includes("2 componentes seleccionados"), await panel());
  await p.clic(await p.punto(0, 0), MAYUS);
  comprobar("Mayús+clic quita K1", (await sel()) === b, await sel());

  const et = await p.evaluar(`(() => { const k = bornera.editor.escena.forma("${c}").zonas[1];
    return { x: k.x + k.ancho / 2, y: k.y + k.alto / 2 }; })()`);
  await p.clic(await p.punto(et.x, et.y));
  comprobar("clic en la etiqueta selecciona K3", (await sel()) === c, await sel());

  await p.clic(await p.punto(10, 8));
  comprobar("clic en vacío deselecciona", (await sel()) === "", await sel());

  // Rectángulo de izquierda a derecha que contiene K1 y la mitad de K2; después el mismo al revés.
  await p.arrastrar(await p.punto(-4, -5), await p.punto(10, 5));
  comprobar("rectángulo a la derecha (contiene): solo K1", (await sel()) === a, await sel());
  await p.arrastrar(await p.punto(10, 5), await p.punto(-4, -5));
  comprobar("rectángulo a la izquierda (toca): K1 y K2", (await sel()) === ids(a, b), await sel());

  // Rectángulo en curso (para la captura) cortado con Esc: no cambia la selección.
  // Desde (18, 6): con el panel abierto, más a la derecha queda debajo de él.
  const ini = await p.punto(18, 6);
  const medio = await p.punto(8, -4);
  await p.mouse("mouseMoved", ini.x, ini.y);
  await p.mouse("mousePressed", ini.x, ini.y);
  for (let i = 1; i <= 6; i++) {
    await p.mouse("mouseMoved", ini.x + ((medio.x - ini.x) * i) / 6, ini.y + ((medio.y - ini.y) * i) / 6, { botones: 1 });
  }
  comprobar("mientras se arrastra hay rectángulo", (await p.evaluar("bornera.editor.seleccionar.rectangulo?.modo")) === "toca");
  await p.captura("rectangulo");
  await p.esc();
  await p.mouse("mouseReleased", medio.x, medio.y);
  comprobar("Esc corta el rectángulo sin cambiar la selección", (await sel()) === ids(a, b), await sel());
  await p.esc();
  comprobar("Esc deselecciona", (await sel()) === "", await sel());

  // Soltar fuera del lienzo (sobre la barra de estado): el puntero está capturado.
  await p.arrastrar(await p.punto(-3, -6), { x: (await p.punto(23, 0)).x, y: 595 });
  comprobar("soltar fuera del lienzo termina el rectángulo", (await sel()) === ids(a, b, c), await sel());

  // Si el usuario pliega el panel, seleccionar no lo vuelve a abrir.
  await p.esc();
  await p.evaluar(`document.querySelector('button[aria-label="Plegar propiedades"]').click()`);
  await p.clic(await p.punto(0, 0));
  comprobar(
    "plegado por el usuario: no se abre solo",
    await p.evaluar(`!!document.querySelector('button[aria-label="Mostrar propiedades"]')`),
  );
  await p.evaluar(`document.querySelector('button[aria-label="Mostrar propiedades"]').click()`);

  // Deshacer el Colocar de K3 con K3 seleccionado lo saca de la selección.
  await p.clic(await p.punto(20, 0));
  await p.evaluar("bornera.editor.deshacer()");
  comprobar("deshacer el Colocar lo saca de la selección", (await sel()) === "", await sel());

  // Escena de 2000 (Ctrl+Shift+B tres veces: 100, 500, 2000), alejada al mínimo.
  for (let i = 0; i < 3; i++) await p.tecla("B", "KeyB", 66, CTRL | MAYUS);
  await p.esperarA("bornera.activo()?.escena.cantidad === 2000");
  const r = await p.caja("canvas");
  for (let i = 0; i < 4; i++) await p.rueda(r.cx, r.cy, 100);
  await esperar(300);
  // Con 2000 la escena no entra en pantalla ni al 10 %: se buscan huecos cerca de las esquinas.
  const vacio = (x0, y0, d) =>
    p.evaluar(`(() => { const ed = bornera.activo(); const cam = ed.vista.camara;
      const r = document.querySelector("canvas").getBoundingClientRect();
      for (let k = 0; k < 200; k++) { const px = ${x0} + ${d} * k, py = ${y0} + ${d} * k;
        const g = cam.aGrilla(px - r.left, py - r.top);
        if (!ed.escena.idEnPunto(g.x, g.y, 3 / cam.escala)) return { x: px, y: py }; }
      return null; })()`);
  const desde = await vacio(r.x + 2, r.y + 2, 1);
  const hasta = await vacio(r.x + r.ancho - 2, r.y + r.alto - 2, -1);
  const esperados = await p.evaluar(`(() => { const ed = bornera.activo(); const cam = ed.vista.camara;
    const r = document.querySelector("canvas").getBoundingClientRect();
    const a = cam.aGrilla(${desde.x} - r.left, ${desde.y} - r.top), b = cam.aGrilla(${hasta.x} - r.left, ${hasta.y} - r.top);
    return ed.escena.idsEnCaja({ x: a.x, y: a.y, ancho: b.x - a.x, alto: b.y - a.y }, "contiene").length; })()`);
  await p.arrastrar(desde, hasta);
  await esperar(200);
  const p3 = await panel();
  comprobar(
    "con 2000, el rectángulo selecciona lo que contiene",
    esperados > 500 && p3.includes(`${esperados} componentes seleccionados`),
    `${esperados} esperados · ${p3}`,
  );
  comprobar("el documento no se tocó", (await p.evaluar("bornera.editor.escena.cantidad")) === 2);
  await p.captura("2000");
}
