// T9: mover arrastrando. Arrastrar uno (un paso de deshacer y solo 2
// invalidaciones de región), arrastrar un grupo, Esc a mitad del arrastre,
// soltar fuera del lienzo y arrastrar uno en la escena de 2000.

import { CTRL, esperar, MAYUS } from "./cdp.mjs";

export const nombre = "Mover arrastrando";

export default async function (p, comprobar) {
  // Dos bobinas K1 (0,0) y K2 (10,0), con la vista centrada en (5, 0) al 100 %.
  // Se cuentan las regiones invalidadas (envolviendo invalidarRegion de la vista).
  const [a, b] = await p.evaluar(`(() => {
    const { editor, comandos: c } = bornera;
    const ids = [[0, "K1"], [10, "K2"]].map(([x, etiqueta]) => {
      const cmd = c.colocar(editor.documento, { tipo: "contactor.bobina", x, y: 0, rot: 0, espejado: false, etiqueta, params: {} });
      editor.ejecutar(cmd);
      return cmd.id;
    });
    const cv = document.querySelector("canvas");
    editor.vista.camara.zoom = 1;
    editor.vista.camara.centrar(5, 0, cv.clientWidth, cv.clientHeight);
    editor.vista.invalidar();
    const v = editor.vista, original = v.invalidarRegion.bind(v);
    globalThis.__regiones = 0;
    v.invalidarRegion = (k) => { globalThis.__regiones++; original(k); };
    return ids;
  })()`);
  await esperar(100);
  const pos = (id) => p.evaluar(`(() => { const c = bornera.activo().escena.obtener("${id}"); return c.x + "," + c.y; })()`);
  const regiones = () => p.evaluar("globalThis.__regiones");
  const ocultos = (...ids) => p.evaluar(`[${ids.map((id) => `"${id}"`).join(",")}].some((id) => bornera.activo().escena.oculto(id))`);

  // Arrastrar K1 de (0,0) a (4,3) en 30 pasos: un Mover, dos invalidaciones.
  await p.evaluar("globalThis.__regiones = 0");
  await p.arrastrar(await p.punto(0, 0), await p.punto(4, 3), { pasos: 30 });
  comprobar("arrastrar mueve K1 a (4, 3)", (await pos(a)) === "4,3", await pos(a));
  comprobar("30 movimientos: solo 2 invalidaciones de región", (await regiones()) === 2, await regiones());
  comprobar("al soltar vuelve a la capa estática", !(await ocultos(a)) && !(await p.evaluar("bornera.editor.arrastrando")));
  await p.captura("movido");
  await p.evaluar("bornera.editor.deshacer()");
  comprobar("un solo paso de deshacer lo devuelve a (0, 0)", (await pos(a)) === "0,0", await pos(a));
  comprobar("el paso anterior sigue siendo el Colocar de K2", (await p.evaluar("bornera.editor.escena.cantidad")) === 2);

  // Grupo: K1 y K2 seleccionados, se arrastra desde K2.
  await p.clic(await p.punto(0, 0));
  await p.clic(await p.punto(10, 0), MAYUS);
  await p.arrastrar(await p.punto(10, 0), await p.punto(10, 5));
  comprobar("arrastrar el grupo mueve los dos", (await pos(a)) === "0,5" && (await pos(b)) === "10,5", `${await pos(a)} · ${await pos(b)}`);
  comprobar(
    "el grupo sigue seleccionado",
    (await p.evaluar("[...bornera.editor.seleccion].sort().join(',')")) === [a, b].sort().join(","),
  );

  // Esc a mitad del arrastre: todo queda donde estaba.
  const ini = await p.punto(0, 5);
  const fin = await p.punto(-6, -2);
  await p.mouse("mouseMoved", ini.x, ini.y);
  await p.mouse("mousePressed", ini.x, ini.y);
  for (let i = 1; i <= 10; i++) {
    await p.mouse("mouseMoved", ini.x + ((fin.x - ini.x) * i) / 10, ini.y + ((fin.y - ini.y) * i) / 10, { botones: 1 });
  }
  comprobar("mientras se arrastra, los dos salen de la capa estática", await ocultos(a, b));
  comprobar(
    "cursor de mover",
    (await p.evaluar(`document.querySelector("canvas").parentElement.style.cursor`)) === "move",
  );
  await p.captura("arrastrando");
  await p.esc();
  await p.mouse("mouseReleased", fin.x, fin.y);
  await esperar(30);
  comprobar("Esc los deja donde estaban", (await pos(a)) === "0,5" && (await pos(b)) === "10,5", `${await pos(a)} · ${await pos(b)}`);
  comprobar("después de Esc no queda nada oculto", !(await ocultos(a, b)) && !(await p.evaluar("bornera.editor.arrastrando")));
  comprobar("Esc no agrega pasos de deshacer", (await p.evaluar("bornera.editor.deshacer(), bornera.editor.escena.obtener('" + a + "').y")) === 0);

  // Soltar fuera del lienzo (sobre la barra de estado): el puntero está capturado.
  await p.clic(await p.punto(0, 0));
  const abajo = await p.punto(0, 0);
  await p.arrastrar(abajo, { x: abajo.x, y: 595 });
  const y = await p.evaluar(`bornera.editor.escena.obtener("${a}").y`);
  comprobar("soltar fuera del lienzo termina el arrastre", y > 5 && !(await ocultos(a)), `y = ${y}`);

  // Escena de 2000 (Ctrl+Shift+B tres veces): arrastrar el componente más cercano al centro.
  for (let i = 0; i < 3; i++) await p.tecla("B", "KeyB", 66, CTRL | MAYUS);
  await p.esperarA("bornera.activo()?.escena.cantidad === 2000");
  await esperar(200);
  const c = await p.evaluar(`(() => { const ed = bornera.activo(); const cv = document.querySelector("canvas");
    const cen = ed.vista.camara.aGrilla(cv.clientWidth / 2, cv.clientHeight / 2);
    const ids = ed.escena.idsEnCaja({ x: cen.x - 15, y: cen.y - 10, ancho: 30, alto: 20 }, "toca");
    let mejor = null, d = Infinity;
    for (const id of ids) { const k = ed.escena.obtener(id); const e = (k.x - cen.x) ** 2 + (k.y - cen.y) ** 2;
      if (e < d && ed.escena.idEnPunto(k.x, k.y, 0) === id) { d = e; mejor = { id, x: k.x, y: k.y }; } }
    return mejor; })()`);
  comprobar("hay un componente para arrastrar en la de 2000", !!c);
  if (!c) return;
  await p.arrastrar(await p.punto(c.x, c.y), await p.punto(c.x + 3, c.y + 2));
  const c2 = await p.evaluar(`(() => { const k = bornera.activo().escena.obtener("${c.id}"); return k.x + "," + k.y; })()`);
  comprobar("con 2000, el arrastrado se movió (3, 2)", c2 === `${c.x + 3},${c.y + 2}`, c2);
  comprobar(
    "con 2000, solo él quedó seleccionado y nada oculto",
    (await p.evaluar(`bornera.activo().seleccion.size === 1 && !bornera.activo().escena.oculto("${c.id}")`)) === true,
  );
  await p.captura("2000");
}
