// T7: paleta real y colocar. Arrastrar cada símbolo al lienzo, clic y clic
// (queda activa), Esc, soltar fuera del lienzo, buscador y deshacer.

import { esperar } from "./cdp.mjs";

export const nombre = "Paleta y colocar";

/** Centro y texto de cada ítem de la paleta. */
const items = (p) =>
  p.evaluar(`[...document.querySelectorAll(".item")].map(e => { const r = e.getBoundingClientRect();
    return { texto: e.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`);

/**
 * Centro del ítem de la paleta con ese texto, desplazado a la vista: desde T35
 * la paleta tiene 38 ítems (T39) y a 1024×600 los de abajo quedan fuera.
 */
const itemVisible = (p, texto) =>
  p.evaluar(`(() => { const e = [...document.querySelectorAll(".item")].find((x) => x.textContent.trim() === ${JSON.stringify(texto)});
    if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect();
    return { texto: e.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

/** Los 10 de T34: los que arrastra el paso 1 (los 14 de potencia de T35 los coloca t35-potencia). */
const DE_T34 = ["Fase (L)", "Neutro (N)", "Fuente trifásica", "Pulsador NA", "Pulsador NC", "Bobina de contactor", "Contacto auxiliar NA", "Contacto auxiliar NC", "Contactos principales", "Lámpara"];

const componentes = (p) => p.evaluar("bornera.editor.documento.hojas[0].componentes.map(c => ({ tipo: c.tipo, x: c.x, y: c.y, etiqueta: c.etiqueta }))");

export default async function (p, comprobar, { cargar }) {
  const { SIMBOLOS } = await cargar("/src/core/symbols/index.ts");
  const lista = await items(p);
  comprobar(`la paleta muestra los ${SIMBOLOS.length} símbolos (38 desde T39)`, lista.length === SIMBOLOS.length && SIMBOLOS.length === 38, lista.map((i) => i.texto).join(", "));
  comprobar("están los 10 de T34", DE_T34.every((t) => lista.some((i) => i.texto === t)), lista.map((i) => i.texto).join(", "));
  const lienzo = await p.caja("canvas[aria-label^=Lienzo]");

  // 1) Arrastrar cada ítem al lienzo, en columnas. Los 8 de 0.1.5 en una fila; desde T34, la
  // trifásica y los principales (6 de ancho) en otra más arriba: en la misma no caben a 1024×600.
  const nuevos = ["Fuente trifásica", "Contactos principales"];
  let enFila = 0;
  let arriba = 0;
  for (const texto of DE_T34) {
    const destino = nuevos.includes(texto)
      ? { x: lienzo.cx - 250 + 300 * arriba++, y: lienzo.cy - 75 }
      : { x: lienzo.cx - 250 + enFila++ * 80, y: lienzo.cy };
    await p.arrastrar(await itemVisible(p, texto), destino);
    await esperar(50);
  }
  const colocados = await componentes(p);
  comprobar("arrastrar coloca cada símbolo una vez", colocados.length === DE_T34.length, colocados.length);
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
  const lampara = await itemVisible(p, "Lámpara");
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
  comprobar("dos clics en el lienzo colocan dos lámparas", (await componentes(p)).length === DE_T34.length + 2);
  comprobar("la herramienta sigue activa", (await p.evaluar("bornera.editor.herramienta?.modo")) === "clic");
  await p.mouse("mouseMoved", lienzo.cx, lienzo.cy - 150);
  await p.captura("previa");
  await p.esc();
  comprobar("Esc termina la herramienta", (await p.evaluar("bornera.editor.herramienta")) === null);

  // 3) Arrastrar y soltar fuera del lienzo (de vuelta sobre la paleta): no coloca.
  const antes = (await componentes(p)).length;
  // El primero (Fase), de vuelta a la vista: el paso 2 desplazó la paleta hasta la lámpara.
  lista[0] = await itemVisible(p, lista[0].texto);
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
  // Desde T38 la búsqueda oculta los ítems que no coinciden (no los saca del DOM).
  const filtrados = await p.evaluar(`[...document.querySelectorAll(".item")].filter((e) => e.checkVisibility()).map((e) => e.textContent.trim())`);
  comprobar("buscar 'LAMPARA' deja solo la lámpara", JSON.stringify(filtrados) === JSON.stringify(["Lámpara"]), filtrados.join(", "));

  // 5) Deshacer de a uno hasta vaciar.
  const deshecho = await p.evaluar(`(() => { const e = bornera.editor; let k = 0;
    while (e.puedeDeshacer) { e.deshacer(); k++; } return [k, e.documento.hojas[0].componentes.length]; })()`);
  comprobar("cada colocación es un paso de deshacer", deshecho[0] === conUno && deshecho[1] === 0, JSON.stringify(deshecho));
}
