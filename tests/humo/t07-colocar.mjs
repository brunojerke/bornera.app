// T7: paleta real y colocar. Arrastrar cada símbolo al lienzo, clic y clic
// (queda activa), Esc, soltar fuera del lienzo, buscador y deshacer.

import { esperar } from "./cdp.mjs";

export const nombre = "Paleta y colocar";

/** Centro y texto de cada ítem de la paleta. */
const items = (p) =>
  p.evaluar(`[...document.querySelectorAll(".item")].map(e => { const r = e.getBoundingClientRect();
    return { texto: e.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`);

const componentes = (p) => p.evaluar("bornera.editor.documento.hojas[0].componentes.map(c => ({ tipo: c.tipo, x: c.x, y: c.y, etiqueta: c.etiqueta }))");

export default async function (p, comprobar) {
  const lista = await items(p);
  comprobar("la paleta muestra los 7 símbolos", lista.length === 7, lista.map((i) => i.texto).join(", "));
  const lienzo = await p.caja("canvas");

  // 1) Arrastrar cada ítem al lienzo, en columnas.
  for (let i = 0; i < lista.length; i++) {
    const destino = { x: lienzo.cx - 250 + i * 80, y: lienzo.cy };
    await p.arrastrar(lista[i], destino);
    await esperar(50);
  }
  const colocados = await componentes(p);
  comprobar("arrastrar coloca cada símbolo una vez", colocados.length === lista.length, colocados.length);
  comprobar(
    "las coordenadas quedan enteras",
    colocados.every((c) => Number.isInteger(c.x) && Number.isInteger(c.y)),
    JSON.stringify(colocados),
  );
  const fase = colocados.find((c) => c.tipo === "fuente.fase");
  const neutro = colocados.find((c) => c.tipo === "fuente.neutro");
  comprobar("Fase entra como L y Neutro como N", fase?.etiqueta === "L" && neutro?.etiqueta === "N");
  comprobar("sin herramienta después de soltar", (await p.evaluar("bornera.editor.herramienta")) === null);

  // 2) Clic en la lámpara de la paleta, dos clics en el lienzo: coloca dos y queda activa.
  const lampara = lista.find((i) => i.texto === "Lámpara");
  await p.clic(lampara);
  comprobar(
    "clic en la paleta deja la herramienta en modo clic",
    (await p.evaluar("bornera.editor.herramienta?.modo + ' ' + bornera.editor.herramienta?.def.tipo")) === "clic senalizacion.lampara",
  );
  comprobar(
    "el ítem queda resaltado",
    (await p.evaluar("document.querySelector('.item[aria-pressed=\"true\"]')?.textContent.trim()")) === "Lámpara",
  );
  await p.clic({ x: lienzo.cx - 200, y: lienzo.cy + 150 });
  await p.clic({ x: lienzo.cx + 200, y: lienzo.cy + 150 });
  comprobar("dos clics en el lienzo colocan dos lámparas", (await componentes(p)).length === lista.length + 2);
  comprobar("la herramienta sigue activa", (await p.evaluar("bornera.editor.herramienta?.modo")) === "clic");
  await p.mouse("mouseMoved", lienzo.cx, lienzo.cy - 150);
  await p.captura("previa");
  await p.esc();
  comprobar("Esc termina la herramienta", (await p.evaluar("bornera.editor.herramienta")) === null);

  // 3) Arrastrar y soltar fuera del lienzo (de vuelta sobre la paleta): no coloca.
  const antes = (await componentes(p)).length;
  // Arriba, en un lugar libre: en el centro caería encima de un símbolo del paso 1 (T14a).
  await p.arrastrar(lista[0], { x: lienzo.cx, y: lienzo.cy - 150 });
  // El arrastre de arriba coloca; ahora uno que vuelve y se suelta sobre la paleta.
  const conUno = (await componentes(p)).length;
  await p.mouse("mouseMoved", lista[0].x, lista[0].y);
  await p.mouse("mousePressed", lista[0].x, lista[0].y);
  await p.mouse("mouseMoved", lienzo.cx, lienzo.cy, { botones: 1 });
  await p.mouse("mouseMoved", lista[0].x + 10, lista[0].y + 40, { botones: 1 });
  await p.mouse("mouseReleased", lista[0].x + 10, lista[0].y + 40);
  comprobar("soltar dentro coloca", conUno === antes + 1);
  comprobar("soltar fuera del lienzo no coloca", (await componentes(p)).length === conUno);
  comprobar("ni deja la herramienta activa", (await p.evaluar("bornera.editor.herramienta")) === null);

  // 4) Buscador sin tildes ni mayúsculas.
  await p.evaluar(`(() => { const i = document.querySelector('input[type=search]'); i.value = 'LAMPARA';
    i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await esperar(50);
  const filtrados = (await items(p)).map((i) => i.texto);
  comprobar("buscar 'LAMPARA' deja solo la lámpara", JSON.stringify(filtrados) === JSON.stringify(["Lámpara"]), filtrados.join(", "));

  // 5) Deshacer de a uno hasta vaciar.
  const deshecho = await p.evaluar(`(() => { const e = bornera.editor; let k = 0;
    while (e.puedeDeshacer) { e.deshacer(); k++; } return [k, e.documento.hojas[0].componentes.length]; })()`);
  comprobar("cada colocación es un paso de deshacer", deshecho[0] === conUno && deshecho[1] === 0, JSON.stringify(deshecho));
}
