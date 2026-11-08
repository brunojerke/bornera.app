// Modo Simular: las herramientas de edición no reciben el puntero. Clic,
// rectángulo y arrastre no cambian la selección ni el documento; la rueda y
// el botón del medio siguen moviendo la vista.

import { esperar } from "./cdp.mjs";

export const nombre = "Puntero en modo Simular";

const F5 = ["F5", "F5", 116];

export default async function (p, comprobar) {
  const seleccion = () => p.evaluar("JSON.stringify([...bornera.editor.seleccion].sort())");
  const documento = () => p.evaluar("JSON.stringify(bornera.editor.documento)");
  const camara = () => p.evaluar("JSON.stringify({ x: bornera.editor.vista.camara.x, y: bornera.editor.vista.camara.y, z: bornera.editor.vista.camara.zoom })");

  await p.evaluar(`(() => { const { editor: ed, comandos: c } = bornera;
    ed.ejecutar(c.colocar(ed.documento, { tipo: "contactor.bobina", x: 0, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: {} }));
    const cv = document.querySelector("canvas"); ed.vista.camara.zoom = 1; ed.vista.camara.centrar(0, 0, cv.clientWidth, cv.clientHeight); ed.vista.invalidar(); })()`);
  await p.tecla(...F5);
  await esperar(50);
  comprobar("F5 pasa a Simular", await p.evaluar(`document.querySelector(".modo button.simular").getAttribute("aria-pressed") === "true"`));
  const doc = await documento();

  await p.clic(await p.punto(0, 0));
  comprobar("un clic sobre un componente no lo selecciona", (await seleccion()) === "[]", await seleccion());
  await p.arrastrar(await p.punto(-6, -6), await p.punto(6, 6));
  comprobar("el rectángulo no selecciona", (await seleccion()) === "[]", await seleccion());
  await p.arrastrar(await p.punto(0, 0), await p.punto(5, 3));
  comprobar("arrastrar no mueve nada", (await documento()) === doc && (await seleccion()) === "[]");
  await p.tecla("w", "KeyW", 87);
  await p.clic(await p.punto(0, -2));
  await p.clic(await p.punto(0, -6));
  comprobar("W y clics no crean cables", (await documento()) === doc && (await p.evaluar("bornera.editor.herramienta === null")));

  // Navegar sigue andando.
  let antes = await camara();
  const c = await p.punto(0, 0);
  await p.rueda(c.x, c.y, 200);
  await esperar(50);
  comprobar("la rueda hace zoom", (await camara()) !== antes);
  antes = await camara();
  await p.mouse("mouseMoved", c.x, c.y);
  await p.mouse("mousePressed", c.x, c.y, { boton: "middle", botones: 4 });
  for (let i = 1; i <= 5; i++) await p.mouse("mouseMoved", c.x + 20 * i, c.y + 10 * i, { boton: "middle", botones: 4 });
  await p.mouse("mouseReleased", c.x + 100, c.y + 50, { boton: "middle", botones: 0 });
  await esperar(50);
  comprobar("el botón del medio desplaza la vista", (await camara()) !== antes);
  comprobar("y nada del documento cambió", (await documento()) === doc);

  await p.tecla(...F5);
  await esperar(50);
  await p.clic(await p.punto(0, 0));
  comprobar("de vuelta en Editar, el clic selecciona", (await seleccion()) === JSON.stringify(["c1"]), await seleccion());
}
