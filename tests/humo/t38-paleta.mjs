// T38: la paleta con miniaturas, grupos y subgrupos plegables
// (docs/plan-T38.md), en `npm run dev` a 1024×600.
//
// Comprueba:
//  - las 32 miniaturas, cada una con su canvas dibujado y el nombre en
//    `title`, en `aria-label` y como texto (ajuste 5);
//  - la marca de las miniaturas, una sola vez y después de la de arranque
//    (fase 6 §4: no demoran el primer cuadro);
//  - sin scroll horizontal, también con una barra de scroll de 17 px (la de
//    WebView2; headless puede no tenerla) (ajuste 1);
//  - Mando › Alimentación … Potencia › Fuentes, en ese orden;
//  - se llega a la Lámpara con scroll y con plegado, y se coloca;
//  - plegar Mando deja ver Potencia; el Motor trifásico se coloca arrastrando;
//  - «motor» despliega los dos motores y el guardamotor aunque Potencia esté
//    plegada; al borrar la búsqueda, Potencia vuelve a quedar plegada;
//  (Lo visible se mira con `checkVisibility`: el contenido de un <details>
//  cerrado sigue teniendo cajas en Chrome.)
//  - plegar y buscar no tocan el documento; el .brn guarda el tipo y no el
//    lugar en la paleta.

import { esperar } from "./cdp.mjs";

export const nombre = "T38: paleta con miniaturas y subgrupos plegables";

const MARCA_ARRANQUE = "bornera:primer-cuadro-nitido";
const MARCA_MINIATURAS = "bornera:miniaturas";
/** Barra de scroll vertical de WebView2 en Windows (px CSS). */
const BARRA_WEBVIEW2 = 17;

const ORDEN = [
  "Mando › Alimentación",
  "Mando › Entradas",
  "Mando › Contactos",
  "Mando › Bobinas",
  "Mando › Señalización",
  "Potencia › Protección",
  "Potencia › Maniobra",
  "Potencia › Cargas",
  "Potencia › Fuentes",
];

const info = (texto) => console.log(`  ·   ${texto}`);

export default async function (p, comprobar, { cargar }) {
  const { SIMBOLOS } = await cargar("/src/core/symbols/index.ts");
  const { serializar } = await cargar("/src/core/io/index.ts");
  const pasos = () => p.evaluar("bornera.editor.historial.hechos.length");
  const componentes = () => p.evaluar("bornera.editor.documento.hojas[0].componentes.map((c) => c.tipo)");

  /** Un ítem por su nombre: centro, si se ve en la lista y si el punto cae en él. */
  const item = (nombreItem, { mostrar = false } = {}) =>
    p.evaluar(`(() => { const e = [...document.querySelectorAll(".item")].find((x) => x.getAttribute("aria-label") === ${JSON.stringify(nombreItem)});
      if (!e) return null; if (${mostrar}) e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect(), l = document.querySelector(".lista").getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const aLaVista = e.checkVisibility() && r.top >= l.top && r.bottom <= l.bottom;
      return { x, y, aLaVista, tocable: aLaVista && e.contains(document.elementFromPoint(x, y)) }; })()`);
  /** El <summary> de un grupo o subgrupo por su texto (el primero, mirando de arriba). */
  const resumen = (texto) =>
    p.evaluar(`(() => { const s = [...document.querySelectorAll(".lista summary")].find((x) => x.textContent.trim() === ${JSON.stringify(texto)});
      if (!s) return null; s.scrollIntoView({ block: "nearest" }); const r = s.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, abierto: s.parentElement.open, visible: s.checkVisibility() }; })()`);
  const plegar = async (texto) => {
    const s = await resumen(texto);
    if (!s) throw new Error(`No está «${texto}».`);
    await p.clic(s);
  };
  const buscar = async (texto) => {
    await p.evaluar(`(() => { const i = document.querySelector('input[aria-label="Buscar componente"]'); i.value = ${JSON.stringify(texto)};
      i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    await esperar(50);
  };
  const lista = () => p.evaluar(`(() => { const l = document.querySelector(".lista"); l.scrollTop = 0; return true; })()`);

  // ── 1. Las miniaturas ──────────────────────────────────────────────────
  await p.esperarA(`performance.getEntriesByName(${JSON.stringify(MARCA_MINIATURAS)}, "mark").length > 0`, 10000);
  const items = await p.evaluar(`[...document.querySelectorAll(".item")].map((e) => {
    const c = e.querySelector("canvas"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let tinta = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) tinta++;
    return { texto: e.textContent.trim(), titulo: e.title, etiqueta: e.getAttribute("aria-label"), ancho: c.width, alto: c.height, tinta }; })`);
  const nombres = SIMBOLOS.map((s) => s.nombre);
  comprobar("la paleta tiene 32 ítems, uno por símbolo", items.length === 32 && nombres.every((n) => items.some((i) => i.texto === n)), items.map((i) => i.texto).join(", "));
  comprobar(
    "cada ítem lleva el nombre en title, en aria-label y como texto (ajuste 5)",
    items.every((i) => i.titulo === i.texto && i.etiqueta === i.texto),
    JSON.stringify(items.filter((i) => i.titulo !== i.texto || i.etiqueta !== i.texto)),
  );
  const dpr = await p.evaluar("window.devicePixelRatio || 1");
  const lado = Math.round(36 * dpr);
  comprobar(`cada miniatura está dibujada (canvas de ${lado} px con trazo)`, items.every((i) => i.ancho === lado && i.alto === lado && i.tinta > 0), JSON.stringify(items.filter((i) => i.tinta === 0 || i.ancho !== lado).map((i) => i.texto)));
  info(`píxeles con trazo: mín. ${Math.min(...items.map((i) => i.tinta))}, máx. ${Math.max(...items.map((i) => i.tinta))}`);

  const marcas = await p.evaluar(`[${JSON.stringify(MARCA_ARRANQUE)}, ${JSON.stringify(MARCA_MINIATURAS)}].map((n) => performance.getEntriesByName(n, "mark").map((m) => m.startTime))`);
  comprobar(
    "las miniaturas se dibujan una vez, después del primer cuadro nítido (fase 6 §4)",
    marcas[0].length === 1 && marcas[1].length === 1 && marcas[1][0] > marcas[0][0],
    JSON.stringify(marcas),
  );
  info(`arranque ${marcas[0][0]?.toFixed(1)} ms; miniaturas ${marcas[1][0]?.toFixed(1)} ms`);

  await p.captura("paleta");

  // ── 2. Ancho: sin scroll horizontal, también con la barra de WebView2 ──
  const ancho = await p.evaluar(`(() => { const l = document.querySelector(".lista"), cs = getComputedStyle(l);
    const barra = l.offsetWidth - l.clientWidth;
    const padding = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    // Ancho de la grilla: del borde izquierdo del ul al derecho de su última casilla.
    const grillas = [...l.querySelectorAll("ul")].map((u) => Math.max(...[...u.children].map((li) => li.getBoundingClientRect().right)) - u.getBoundingClientRect().left);
    return { panel: document.querySelector('aside[aria-label="Paleta de componentes"]').getBoundingClientRect().width,
      barra, util: l.clientWidth - padding, grilla: Math.max(...grillas), scrollW: l.scrollWidth, clientW: l.clientWidth,
      vertical: l.scrollHeight > l.clientHeight }; })()`);
  comprobar("la paleta sigue en 200 px", ancho.panel === 200, String(ancho.panel));
  comprobar("sin scroll horizontal a 1024×600", ancho.scrollW <= ancho.clientW, JSON.stringify(ancho));
  const utilWebView2 = ancho.util + ancho.barra - BARRA_WEBVIEW2;
  comprobar(`la grilla entra con una barra de ${BARRA_WEBVIEW2} px (ajuste 1)`, ancho.grilla <= utilWebView2, `grilla ${ancho.grilla}, útil ${utilWebView2}`);
  comprobar("con todo abierto la lista tiene scroll vertical", ancho.vertical);
  info(`barra de esta corrida ${ancho.barra} px; útil con la de WebView2 ${utilWebView2} px; grilla ${ancho.grilla} px`);

  const orden = await p.evaluar(`[...document.querySelectorAll(".lista details.subgrupo")].map((d) =>
    d.parentElement.closest("details").querySelector(":scope > summary").textContent.trim() + " › " + d.querySelector(":scope > summary").textContent.trim())`);
  comprobar("grupos y subgrupos en el orden del plan", JSON.stringify(orden) === JSON.stringify(ORDEN), orden.join(" | "));

  // ── 3. La Lámpara: con scroll y con plegado ────────────────────────────
  const pasosAntes = await pasos();
  await lista();
  const sinMover = await item("Lámpara");
  info(`la Lámpara sin desplazar: ${sinMover.aLaVista ? "a la vista" : "fuera de la vista"}`);
  const conScroll = await item("Lámpara", { mostrar: true });
  comprobar("se llega a la Lámpara desplazando la lista", conScroll?.tocable === true, JSON.stringify(conScroll));
  await lista();
  for (const s of ["Alimentación", "Entradas", "Contactos", "Bobinas"]) await plegar(s);
  await lista();
  const conPlegado = await item("Lámpara");
  comprobar("plegando 4 subgrupos de Mando, la Lámpara queda a la vista sin desplazar", conPlegado?.tocable === true, JSON.stringify(conPlegado));
  const destinoLampara = await p.punto(-6, 0);
  await p.arrastrar(conPlegado, destinoLampara);
  await esperar(80);
  comprobar("arrastrar la Lámpara la coloca", (await componentes()).includes("senalizacion.lampara"), JSON.stringify(await componentes()));
  for (const s of ["Alimentación", "Entradas", "Contactos", "Bobinas"]) await plegar(s);

  // ── 4. Plegar Mando; el Motor trifásico arrastrando ────────────────────
  await lista();
  await plegar("Mando");
  const potencia = await resumen("Potencia");
  const caja = await p.caja(".lista");
  comprobar("plegar Mando deja ver Potencia arriba", potencia?.visible === true && potencia.y < caja.y + 60, JSON.stringify({ potencia, caja }));
  comprobar("con Mando plegado, sus ítems no se ven", (await item("Pulsador NA"))?.aLaVista === false);
  const motor = await item("Motor trifásico", { mostrar: true });
  comprobar("el Motor trifásico se ve", motor?.tocable === true, JSON.stringify(motor));
  await p.arrastrar(motor, await p.punto(8, 0));
  await esperar(80);
  comprobar("arrastrar el Motor trifásico lo coloca", (await componentes()).includes("motor.trifasico"), JSON.stringify(await componentes()));
  await plegar("Mando");

  // ── 5. La búsqueda despliega lo que encuentra ──────────────────────────
  const pasosPlegado = await pasos();
  await plegar("Potencia");
  comprobar("Potencia queda plegada", (await resumen("Potencia"))?.abierto === false);
  await buscar("motor");
  const encontrados = await p.evaluar(`[...document.querySelectorAll(".item")].filter((e) => e.checkVisibility()).map((e) => e.getAttribute("aria-label"))`);
  comprobar(
    "«motor» despliega los dos motores y el guardamotor, con Potencia plegada",
    JSON.stringify(encontrados) === JSON.stringify(["Guardamotor", "Motor trifásico", "Motor estrella-triángulo"]) && (await resumen("Potencia"))?.abierto === true,
    JSON.stringify(encontrados),
  );
  comprobar("Mando no se ve buscando «motor»", (await resumen("Mando"))?.visible === false);
  await buscar("transformador");
  comprobar("sin coincidencias, avisa", (await p.evaluar(`document.querySelector(".vacio")?.textContent.trim() ?? ""`)) === "Ningún componente coincide.");
  await buscar("");
  comprobar("al borrar la búsqueda, Potencia vuelve a quedar plegada", (await resumen("Potencia"))?.abierto === false && (await resumen("Mando"))?.abierto === true);
  const lamparaDeNuevo = await item("Lámpara", { mostrar: true });
  comprobar("las miniaturas siguen dibujadas después de buscar (no se desmontan)", lamparaDeNuevo?.tocable === true);
  await plegar("Potencia");
  comprobar("plegar y buscar no tocan el historial", (await pasos()) === pasosPlegado && pasosPlegado === pasosAntes + 2, `${pasosAntes} → ${pasosPlegado} → ${await pasos()}`);

  // ── 6. El .brn ─────────────────────────────────────────────────────────
  const texto = serializar(await p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento))"));
  comprobar(
    "el .brn guarda el tipo y no el lugar en la paleta",
    texto.includes('"senalizacion.lampara"') && texto.includes('"motor.trifasico"') && !/categoria|subgrupo|alimentacion|"cargas"/.test(texto),
    texto.slice(0, 200),
  );
}
