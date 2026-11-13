// T15 etapa 3: la marcha-parada dibujada con el mouse, a 1024×600, como en la
// netbook (docs/plan-T15.md, sección 4, "Humo").
//
// Nuevo; los 7 símbolos desde la paleta (6 arrastrados y el Neutro con clic,
// R, R y clic); las 5 etiquetas en el panel; los 8 cables con W y clics (las
// 2 T con un clic sobre el cable), un paso de deshacer por gesto. Se dibuja al
// zoom inicial: si lo que se va a tocar no está a la vista, se desplaza la
// vista con el botón del medio y se cuenta.
//
// Lo que decide son las redes: las del documento de la página, iguales a las
// de `marchaParada()` (sección 3), y el .brn de Ctrl+S, por `compararRedes`
// con 0 diferencias (la misma cadena que `npm run circuito`). Las dos se
// calculan en Node con el código de la app (`cargar`, D10-A). "Hoja igual al
// armado": componentes y extremos de los cables tienen que ser iguales; si
// solo cambian codos, no falla y se imprime qué cables difieren.
//
// Después: Nuevo y Abrir ese archivo (igual, sin «•», sin historial), y F
// (encuadrar): el circuito entero dentro del lienzo, sin tocar la paleta, el
// panel, la barra ni el pie, con el panel plegado y abierto. Segunda
// pasada a 1024×530 (Windows maximizado le quita unos 70 px, supuesto): solo
// F. Las líneas con «·» son mediciones para el plan, no comprobaciones.

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Marcha-parada con el mouse";

const W = ["w", "KeyW", 87];
const R = ["r", "KeyR", 82];
const F = ["f", "KeyF", 70];
const S = ["s", "KeyS", 83];
const O = ["o", "KeyO", 79];
const ENTER = ["Enter", "Enter", 13];
const CAMPO = "#prop-etiqueta";
/** Lo que se va a tocar tiene que quedar a esta distancia (px) del borde del lienzo; si no, se desplaza la vista. */
const MARGEN = 40;
const ARCHIVO = "marcha-parada.brn";

/** Sección 3: componentes en el orden en que se colocan (así los ids son c1…c7, como el armado). */
const COMPONENTES = [
  { tipo: "fuente.fase", x: 0, y: 0 },
  { tipo: "pulsador.nc", x: 0, y: 5, etiqueta: "S0" },
  { tipo: "pulsador.na", x: 0, y: 11, etiqueta: "S1" },
  { tipo: "contactor.auxiliar_na", x: 10, y: 11, etiqueta: "K1" },
  { tipo: "contactor.bobina", x: 0, y: 22, etiqueta: "K1" },
  { tipo: "senalizacion.lampara", x: 16, y: 22, etiqueta: "H1" },
  { tipo: "fuente.neutro", x: 0, y: 33, rot: 180 },
];

/** Sección 3: los clics de cada cable (el primero empieza, los del medio son codos, el último termina). */
const CABLES = [
  { id: "w1", clics: [[0, 1], [0, 3]] },
  { id: "w2", clics: [[0, 7], [0, 9]] },
  { id: "w3", clics: [[0, 7], [10, 7], [10, 9]] }, // segundo cable de S0·12
  { id: "w4", clics: [[0, 13], [0, 20]] },
  { id: "w5", clics: [[10, 13], [0, 13]] }, // segundo cable de S1·14
  { id: "w6", clics: [[0, 24], [0, 32]] },
  { id: "w7", clics: [[0, 16], [16, 16], [16, 20]] }, // T sobre w4
  { id: "w8", clics: [[0, 28], [16, 28], [16, 24]] }, // T sobre w6
];

const plano = (x) => JSON.parse(JSON.stringify(x));
const info = (texto) => console.log(`  ·   ${texto}`);
const px = (n) => `${Math.round(n * 10) / 10}`;

export default async function (p, comprobar, { cargar }) {
  const { marchaParada } = await cargar("/src/core/circuitos/marchaParada.ts");
  const { compararRedes } = await cargar("/src/core/circuitos/compararRedes.ts");
  const { redes } = await cargar("/src/core/model/redes.ts");
  const { deserializar } = await cargar("/src/core/io/index.ts");
  const { desempaquetar } = await cargar("/src/ui/brn.ts");
  const { buscarSimbolo } = await cargar("/src/core/symbols/biblioteca.ts");
  const { ESCALA_MIN_TEXTOS } = await cargar("/src/render/detalle.ts");
  const base = marchaParada();

  const descargas = mkdtempSync(join(tmpdir(), "bornera-descargas-"));
  const archivos = mkdtempSync(join(tmpdir(), "bornera-archivos-"));
  await p.descargasEn(descargas);
  await p.interceptarSelector();
  try {
    const h = ayudantes(p, descargas);
    const url = await p.evaluar("location.href");
    const guardado = await dibujarYGuardar(p, comprobar, h, { base, redes, compararRedes, deserializar, desempaquetar, buscarSimbolo }, archivos);
    if (!guardado) return;
    await probarF(p, comprobar, h, "1024×600", ESCALA_MIN_TEXTOS);

    // ── Segunda pasada, 1024×530: solo F ──
    // Recargar borra los errores anotados: se miran antes.
    comprobar("sin errores en la página (1024×600)", p.errores.length === 0, p.errores.join(" | "));
    await p.abrir(url, 1024, 530);
    await p.interceptarSelector();
    await h.abrirCon(guardado.ruta);
    comprobar("1024×530: el archivo abre igual", isDeepStrictEqual(await h.documento(), guardado.documento));
    await probarF(p, comprobar, h, "1024×530", ESCALA_MIN_TEXTOS);
  } finally {
    await p.interceptarSelector(false).catch(() => undefined);
    await p.descargasEn(null).catch(() => undefined);
    for (const c of [descargas, archivos]) rmSync(c, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

function ayudantes(p, carpeta) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods, key === "Enter" ? "\r" : undefined);
  const titulo = () => p.evaluar("document.title");
  const documento = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento))");
  const pasos = () => p.evaluar("bornera.activo().historial.hechos.length");
  const activado = (etiqueta) => p.evaluar(`!document.querySelector('button[aria-label="${etiqueta}"]').disabled`);
  const apretar = async (etiqueta) => {
    const k = await p.caja(`button[aria-label="${etiqueta}"]`);
    await p.clic({ x: k.cx, y: k.cy });
  };
  const pista = () => p.evaluar(`document.querySelector("footer .pista-herramienta")?.textContent.trim() ?? null`);
  const aviso = () => p.evaluar(`document.querySelector(".avisos")?.textContent.trim() ?? ""`);
  const mover = async (gx, gy) => {
    const q = await p.punto(gx, gy);
    await p.mouse("mouseMoved", q.x, q.y);
    await esperar(20);
  };
  /** Abrir y Nuevo ponen un editor nuevo: se marca el de ahora y se espera a que cambie. */
  const marcarEditor = () => p.evaluar("bornera.editor.__anterior = true");
  const editorNuevo = () => p.esperarA("bornera.editor.__anterior !== true", 5000);
  const abrirCon = async (ruta) => {
    await marcarEditor();
    p.elegirArchivo(ruta);
    await tecla(O, CTRL);
    await editorNuevo();
  };

  /** Espera una descarga, la lee y vacía la carpeta. */
  const descarga = async (ms = 8000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const todos = readdirSync(carpeta);
      const listos = todos.filter((f) => !f.endsWith(".crdownload") && !f.endsWith(".tmp"));
      if (listos.length > 0 && listos.length === todos.length) {
        await esperar(100); // que termine de escribir
        const bytes = readFileSync(join(carpeta, listos[0]));
        for (const f of readdirSync(carpeta)) rmSync(join(carpeta, f), { force: true });
        return { nombre: listos[0], bytes, otras: listos.length - 1 };
      }
      await esperar(100);
    }
    return null;
  };

  // ── Desplazar la vista con el botón del medio ──
  let desplazamientos = 0;
  /** Para qué se desplazó la vista cada vez. */
  const motivos = [];
  const arrastrarConMedio = async (a, b) => {
    await p.mouse("mouseMoved", a.x, a.y);
    await p.mouse("mousePressed", a.x, a.y, { boton: "middle", botones: 4 });
    for (let i = 1; i <= 6; i++) {
      await p.mouse("mouseMoved", a.x + ((b.x - a.x) * i) / 6, a.y + ((b.y - a.y) * i) / 6, { boton: "middle", botones: 4 });
    }
    await p.mouse("mouseReleased", b.x, b.y, { boton: "middle", botones: 0 });
    await esperar(30);
  };
  /**
   * Deja a la vista la caja de grilla [x0, x1]×[y0, y1], a MARGEN px del borde
   * del lienzo: si no lo está, la lleva al centro arrastrando con el botón del
   * medio (de a lo sumo el 80 % del lienzo por arrastre) y cuenta cada arrastre.
   */
  const aLaVista = async (x0, y0, x1, y1, motivo) => {
    for (let i = 0; i < 8; i++) {
      const k = await p.caja("canvas");
      const a = await p.punto(x0, y0);
      const b = await p.punto(x1, y1);
      const fuera = (lo, hi, desde, largo) => lo < desde + MARGEN || hi > desde + largo - MARGEN;
      const limitar = (d, largo) => Math.max(-0.8 * largo, Math.min(0.8 * largo, d));
      const dx = fuera(a.x, b.x, k.x, k.ancho) ? limitar(k.cx - (a.x + b.x) / 2, k.ancho) : 0;
      const dy = fuera(a.y, b.y, k.y, k.alto) ? limitar(k.cy - (a.y + b.y) / 2, k.alto) : 0;
      if (dx === 0 && dy === 0) return;
      await arrastrarConMedio({ x: k.cx - dx / 2, y: k.cy - dy / 2 }, { x: k.cx + dx / 2, y: k.cy + dy / 2 });
      desplazamientos++;
      motivos.push(motivo);
    }
    throw new Error(`No se pudo dejar a la vista ${motivo}.`);
  };

  return {
    tecla, titulo, documento, pasos, activado, apretar, pista, aviso, mover, marcarEditor, editorNuevo, abrirCon, descarga, aLaVista,
    desplazado: () => ({ veces: desplazamientos, motivos: [...motivos] }),
  };
}

async function dibujarYGuardar(p, comprobar, h, m, archivos) {
  const { tecla, titulo, documento, pasos, activado, apretar, pista, aviso, mover, marcarEditor, editorNuevo, abrirCon, descarga, aLaVista } = h;
  const { base, redes, compararRedes, deserializar, desempaquetar, buscarSimbolo } = m;
  const componentes = () => p.evaluar("bornera.editor.documento.hojas[0].componentes.map(({ id, tipo, x, y, rot, espejado, etiqueta }) => ({ id, tipo, x, y, rot, espejado, etiqueta }))");
  const cables = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento.hojas[0].cables))");

  // ── 1. Nuevo ──
  await marcarEditor();
  await apretar("Nuevo");
  await editorNuevo();
  comprobar("Nuevo: documento vacío y sin historial", (await componentes()).length === 0 && !(await activado("Deshacer")));
  const inicio = await p.evaluar(`(() => { const cam = bornera.activo().vista.camara, cv = document.querySelector("canvas");
    return { escala: cam.escala, zoom: cam.zoom, ancho: cv.clientWidth, alto: cv.clientHeight }; })()`);
  info(
    `zoom inicial ${inicio.zoom}: 1 unidad = ${px(inicio.escala)} px; lienzo ${inicio.ancho}×${inicio.alto} px = ` +
      `${px(inicio.ancho / inicio.escala)}×${px(inicio.alto / inicio.escala)} unidades (sin selección)`,
  );

  // ── 2. Los 7 desde la paleta ──
  const items = await p.evaluar(`[...document.querySelectorAll(".item")].map(e => { const r = e.getBoundingClientRect();
    return { texto: e.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`);
  for (const c of COMPONENTES) {
    const nombreItem = buscarSimbolo(c.tipo)?.nombre;
    const item = items.find((i) => i.texto === nombreItem);
    if (!item) throw new Error(`No está «${nombreItem}» (${c.tipo}) en la paleta.`);
    await aLaVista(c.x - 3, c.y - 3, c.x + 4, c.y + 3, `colocar ${c.tipo}`);
    const destino = await p.punto(c.x, c.y);
    if (c.rot === 180) {
      // Clic en la paleta, R, R (180°) sobre el lienzo y clic: como en la netbook.
      await p.clic(item);
      await p.mouse("mouseMoved", destino.x, destino.y);
      await tecla(R);
      await tecla(R);
      await p.clic(destino);
      await p.esc();
    } else {
      await p.arrastrar(item, destino);
    }
    await esperar(50);
  }
  const puestos = await componentes();
  const esperados = plano(base.doc.hojas[0].componentes).map(({ id, tipo, x, y, rot, espejado }) => ({
    id, tipo, x, y, rot, espejado, etiqueta: buscarSimbolo(tipo)?.etiquetaInicial ?? "",
  }));
  comprobar(
    "los 7 colocados desde la paleta: tipo, posición y giro de la sección 3 (el Neutro a 180°), «L» y «N» automáticas",
    isDeepStrictEqual(puestos, esperados),
    JSON.stringify(puestos),
  );
  comprobar("7 pasos de deshacer (uno por símbolo)", (await pasos()) === 7, `${await pasos()}`);

  // ── 3. Etiquetas en el panel ──
  let etiquetasBien = true;
  for (const [i, c] of COMPONENTES.entries()) {
    if (!c.etiqueta) continue;
    const id = `c${i + 1}`;
    await aLaVista(c.x - 3, c.y - 3, c.x + 4, c.y + 3, `etiquetar ${id}`);
    await p.clic(await p.punto(c.x, c.y));
    await p.esperarA(`bornera.activo().resumenSeleccion().cantidad === 1 && !!document.querySelector("${CAMPO}")`, 5000).catch(() => undefined);
    await esperar(250); // el panel se abre: que el lienzo termine de cambiar de tamaño
    const antes = await pasos();
    const k = await p.caja(CAMPO);
    if (!k) throw new Error(`El panel no mostró el campo de etiqueta al hacer clic en ${id}.`);
    await p.clic({ x: k.cx, y: k.cy });
    await p.evaluar(`document.querySelector("${CAMPO}").select()`);
    await p.cdp("Input.insertText", { text: c.etiqueta });
    await tecla(ENTER);
    const puesta = await p.evaluar(`bornera.editor.documento.hojas[0].componentes.find((x) => x.id === "${id}")?.etiqueta ?? null`);
    if (puesta !== c.etiqueta || (await pasos()) !== antes + 1) {
      etiquetasBien = false;
      comprobar(`etiqueta de ${id} en el panel`, false, `quedó ${JSON.stringify(puesta)}, ${(await pasos()) - antes} pasos`);
    }
  }
  comprobar("las 5 etiquetas, con clic en el símbolo, el campo del panel y Enter: un paso cada una", etiquetasBien && (await pasos()) === 12, `${await pasos()} pasos`);
  await p.esc(); // sin selección

  // ── 4. Los 8 cables con W ──
  await tecla(W);
  comprobar("W activa la herramienta cable", await p.evaluar("bornera.editor.cable !== null"));
  const fallas = [];
  let s012 = null;
  for (const w of CABLES) {
    const xs = w.clics.map(([x]) => x);
    const ys = w.clics.map(([, y]) => y);
    await aLaVista(Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1, `tender ${w.id}`);
    const antes = await pasos();
    const cantidad = (await cables()).length;
    if (w.id === "w3") {
      await mover(...w.clics[0]);
      s012 = await pista();
    }
    for (const [x, y] of w.clics) await p.clic(await p.punto(x, y));
    const lista = await cables();
    const ultimo = lista.at(-1);
    if (lista.length !== cantidad + 1 || (await pasos()) !== antes + 1 || ultimo?.id !== w.id) {
      fallas.push(`${w.id}: ${lista.length - cantidad} cables, ${(await pasos()) - antes} pasos, último ${JSON.stringify(ultimo)}, aviso «${await aviso()}»`);
    }
    if (w.id === "w3") {
      comprobar(
        "sin trabas: un clic en S0·12, que ya tiene a w2, empieza en el borne (no en una T sobre w2)",
        s012 === "Empezar en S0 · 12" && ultimo?.desde?.tipo === "borne" && ultimo.desde.comp === "c2" && ultimo.desde.borne === "12",
        `pista «${s012}», desde ${JSON.stringify(ultimo?.desde)}`,
      );
    }
  }
  comprobar("los 8 cables con clics: cada uno en un gesto y un paso de deshacer (20 pasos en total)", fallas.length === 0 && (await pasos()) === 20, fallas.join(" | ") || `${await pasos()} pasos`);
  await p.esc();
  comprobar("Esc sale de W", await p.evaluar("bornera.editor.cable === null"));

  // ── Zoom y desplazamientos (agregado 3) ──
  const fin = await p.evaluar(`(() => { const ed = bornera.activo(), k = ed.escena.caja;
    return { escala: ed.vista.camara.escala, caja: { ancho: k.ancho, alto: k.alto } }; })()`);
  const { veces, motivos } = h.desplazado();
  comprobar("se dibujó al zoom inicial (sin acercar ni alejar)", fin.escala === inicio.escala, `${fin.escala}`);
  const entra = fin.caja.ancho * inicio.escala <= inicio.ancho && fin.caja.alto * inicio.escala <= inicio.alto;
  info(
    `el circuito ocupa ${px(fin.caja.ancho)}×${px(fin.caja.alto)} unidades = ${px(fin.caja.ancho * inicio.escala)}×${px(fin.caja.alto * inicio.escala)} px ` +
      `al zoom inicial: ${entra ? "entra" : "no entra"} en el lienzo de ${inicio.ancho}×${inicio.alto} px`,
  );
  info(`se desplazó la vista ${veces} ${veces === 1 ? "vez" : "veces"} para dibujar (botón del medio)${veces ? `: ${motivos.join(", ")}` : ""}`);

  // ── 5. Redes (lo que decide) y hoja igual al armado ──
  const doc = await documento();
  const hoja = doc.hojas[0];
  const hojaBase = plano(base.doc.hojas[0]);
  const redesPagina = plano(redes(hoja));
  const redesBase = plano(redes(hojaBase));
  comprobar(
    "redes del documento de la página = las de marchaParada() (4 redes, con bornes, cables y nombres)",
    redesPagina.length === 4 && isDeepStrictEqual(redesPagina, redesBase),
    JSON.stringify(redesPagina),
  );
  const difComp = hoja.componentes.filter((c, i) => !isDeepStrictEqual(c, hojaBase.componentes[i]));
  comprobar(
    "hoja: componentes iguales al armado (ids, tipo, posición, giro y etiqueta)",
    hoja.componentes.length === hojaBase.componentes.length && difComp.length === 0,
    JSON.stringify(difComp),
  );
  const extremos = ({ id, desde, hasta }) => ({ id, desde, hasta });
  const difExt = hoja.cables.filter((w, i) => !isDeepStrictEqual(extremos(w), extremos(hojaBase.cables[i] ?? {})));
  comprobar(
    "hoja: cables con los mismos extremos que el armado (bornes y T)",
    hoja.cables.length === hojaBase.cables.length && difExt.length === 0,
    JSON.stringify(difExt),
  );
  const difCodos = hoja.cables
    .map((w, i) => ({ w, b: hojaBase.cables[i] }))
    .filter(({ w, b }) => b && !isDeepStrictEqual(w.codos, b.codos))
    .map(({ w, b }) => `${w.id} ${JSON.stringify(w.codos)} (armado ${JSON.stringify(b.codos)})`);
  info(difCodos.length === 0 ? "codos iguales al armado en los 8 cables" : `codos distintos del armado (no falla): ${difCodos.join("; ")}`);

  // ── 6. Ctrl+S: el .brn, en Node, por compararRedes (agregado 1) ──
  await tecla(S, CTRL);
  const d = await descarga();
  comprobar("Ctrl+S descarga «Sin título.brn»", d?.nombre === "Sin título.brn" && d.otras === 0, JSON.stringify(d && { nombre: d.nombre, otras: d.otras }));
  if (!d) return null;
  const abierto = await desempaquetar(new Uint8Array(d.bytes));
  comprobar("el .brn se desempaqueta (gzip)", abierto.ok && d.bytes[0] === 0x1f && d.bytes[1] === 0x8b, abierto.ok ? "" : abierto.error);
  if (!abierto.ok) return null;
  const r = deserializar(abierto.texto);
  const problemas = r.ok ? r.avisos : r.errores;
  comprobar("el .brn abre en Node sin errores ni avisos", r.ok && r.avisos.length === 0, problemas.map((x) => `${x.donde} ${x.mensaje}`).join("; "));
  if (!r.ok) return null;
  const diferencias = compararRedes(r.documento, base.doc);
  comprobar("compararRedes(.brn, marchaParada()): 0 diferencias, como npm run circuito", diferencias.length === 0, diferencias.join(" | "));
  const guardadoJson = JSON.parse(abierto.texto);
  comprobar("lo guardado es el documento de la página", isDeepStrictEqual(guardadoJson, doc));
  comprobar("guardado: el título no lleva «•»", (await titulo()) === "Sin título.brn — Bornera", await titulo());
  const ruta = join(archivos, ARCHIVO);
  writeFileSync(ruta, d.bytes);

  // ── Nuevo y Abrir ese archivo ──
  await marcarEditor();
  await apretar("Nuevo");
  await editorNuevo();
  comprobar("Nuevo después de guardar: sin diálogo y documento vacío", (await componentes()).length === 0);
  await abrirCon(ruta);
  comprobar("Abrir: el documento es igual al guardado", isDeepStrictEqual(await documento(), guardadoJson));
  comprobar(
    `Abrir: «${ARCHIVO} — Bornera» sin «•» e historial vacío`,
    (await titulo()) === `${ARCHIVO} — Bornera` && (await pasos()) === 0 && !(await activado("Deshacer")),
    `${await titulo()}, ${await pasos()} pasos`,
  );
  return { ruta, documento: guardadoJson };
}

/** F (encuadrar) con el panel plegado y abierto: el circuito entero en el lienzo libre. */
async function probarF(p, comprobar, h, tamano, escalaMinTextos) {
  const medir = () =>
    p.evaluar(`(() => { const ed = bornera.activo(), cam = ed.vista.camara, k = ed.escena.caja;
      const cv = document.querySelector("canvas").getBoundingClientRect();
      const a = cam.aPantalla(k.x, k.y), b = cam.aPantalla(k.x + k.ancho, k.y + k.alto);
      const rect = (r) => ({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
      const de = (sel) => { const e = document.querySelector(sel); return e ? rect(e.getBoundingClientRect()) : null; };
      return { circuito: { x0: cv.left + a.x, y0: cv.top + a.y, x1: cv.left + b.x, y1: cv.top + b.y }, lienzo: rect(cv), escala: cam.escala,
        tapan: { paleta: de('aside[aria-label="Paleta de componentes"]'), panel: de('aside[aria-label="Propiedades"]'),
          barra: de("header.barra"), pie: de("footer.estado") },
        campo: !!document.querySelector("${CAMPO}") }; })()`);
  const se = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const revisar = (m) => {
    const c = m.circuito;
    const l = m.lienzo;
    const fuera = c.x0 < l.x0 - 0.5 || c.y0 < l.y0 - 0.5 || c.x1 > l.x1 + 0.5 || c.y1 > l.y1 + 0.5;
    const tocan = Object.entries(m.tapan).filter(([, r]) => r && se(c, r)).map(([n]) => n);
    const r = (q) => `(${px(q.x0)}, ${px(q.y0)})–(${px(q.x1)}, ${px(q.y1)})`;
    return { ok: !fuera && tocan.length === 0, detalle: `circuito ${r(c)}, lienzo ${r(l)}${tocan.length ? `, toca ${tocan.join(" y ")}` : ""}` };
  };
  const contar = (m, cuando) =>
    info(`${tamano}, F ${cuando}: ${px(m.escala)} px por unidad, lienzo ${px(m.lienzo.x1 - m.lienzo.x0)}×${px(m.lienzo.y1 - m.lienzo.y0)} px; ` +
      `textos ${m.escala >= escalaMinTextos ? "dibujados" : "ocultos"} (desde ${escalaMinTextos} px por unidad)`);

  // Sin selección y con el panel plegado (queda abierto si se abrió antes, al etiquetar).
  await p.esc();
  if (await p.caja('button[aria-label="Plegar propiedades"]')) await h.apretar("Plegar propiedades");
  await esperar(250);
  const plegado = !!(await p.caja('button[aria-label="Mostrar propiedades"]'));
  await h.tecla(F);
  await esperar(100);
  let m = await medir();
  let v = revisar(m);
  comprobar(
    `${tamano}, F con el panel plegado: el circuito entero dentro del lienzo, sin tocar paleta, panel, barra ni pie`,
    plegado && v.ok,
    `${plegado ? "" : "el panel no se plegó; "}${v.detalle}`,
  );
  contar(m, "con el panel plegado");

  // Con el panel abierto: clic en la bobina (en el centro del símbolo). Si el
  // panel se plegó a mano, seleccionar no lo abre: se abre con su botón.
  await p.clic(await p.punto(0, 22));
  await esperar(250);
  if (await p.caja('button[aria-label="Mostrar propiedades"]')) await h.apretar("Mostrar propiedades");
  await p.esperarA(`!!document.querySelector("${CAMPO}")`, 5000).catch(() => undefined);
  await esperar(250);
  await h.tecla(F);
  await esperar(100);
  m = await medir();
  v = revisar(m);
  comprobar(`${tamano}, F con el panel abierto: el circuito entero dentro del lienzo libre`, m.campo && v.ok, `${m.campo ? "" : "el panel no se abrió; "}${v.detalle}`);
  contar(m, "con el panel abierto");
  await p.esc();
}
