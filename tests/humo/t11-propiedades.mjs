// T11: panel de propiedades. Que entre y se use en 1024×600; escribir no toca
// el lienzo ni el historial; R, M, Supr, Retroceso y Ctrl+Z dentro del campo
// son del campo; Enter, Tab, clic en el lienzo, F5 y Ctrl+Shift+B confirman
// una sola vez (un paso); Esc cancela; un error no se aplica; lo escrito va
// al componente que se editaba aunque cambie la selección; fase y neutro
// muestran su red; sin restos con etiquetas largas en las 4 rotaciones;
// Simular de solo lectura; F5 no cambia de modo con un modal ni durante un
// gesto. Al final, el resumen de la selección con 2000: cuántas veces se
// calcula durante un rectángulo y cuánto tarda.

import { CTRL, esperar, MAYUS } from "./cdp.mjs";

export const nombre = "Panel de propiedades";

const R = ["r", "KeyR", 82];
const M = ["m", "KeyM", 77];
const SUPR = ["Delete", "Delete", 46];
const RETROCESO = ["Backspace", "Backspace", 8];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];
const ENTER = ["Enter", "Enter", 13];
const TAB = ["Tab", "Tab", 9];
const F5 = ["F5", "F5", 116];
const CAMPO = "#prop-etiqueta";
/** El panel de propiedades (la paleta también tiene class="panel"). */
const PANEL = 'aside[aria-label="Propiedades"]';

export default async function (p, comprobar) {
  const tecla = ([key, code, w], mods = 0) => p.tecla(key, code, w, mods, key === "Enter" ? "\r" : undefined);
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
  const poses = () =>
    p.evaluar("JSON.stringify(bornera.editor.documento.hojas[0].componentes.map(({ id, x, y, rot, espejado }) => ({ id, x, y, rot, espejado })))");
  const etiqueta = (id) => p.evaluar(`bornera.editor.documento.hojas[0].componentes.find(c => c.id === "${id}")?.etiqueta ?? null`);
  const seleccionar = (ids) => p.evaluar(`bornera.activo().seleccionarIds(${JSON.stringify(ids)})`);
  const colocarK = (tipo, x, y, etiqueta) =>
    p.evaluar(`(() => { const { editor, comandos: c } = bornera;
      const cmd = c.colocar(editor.documento, { tipo: "${tipo}", x: ${x}, y: ${y}, rot: 0, espejado: false, etiqueta: ${JSON.stringify(etiqueta)}, params: {} });
      editor.ejecutar(cmd); return cmd.id; })()`);
  const valor = () => p.evaluar(`document.querySelector("${CAMPO}")?.value ?? null`);
  const enCampo = () => p.evaluar(`document.activeElement?.id === "prop-etiqueta"`);
  const texto = (sel) => p.evaluar(`[...document.querySelectorAll('${PANEL} ${sel}')].map(e => e.textContent.trim()).join(" | ")`);
  /** Clic de verdad en el campo y todo el texto seleccionado (escribir lo reemplaza). */
  const enfocar = async () => {
    const k = await p.caja(CAMPO);
    await p.clic({ x: k.cx, y: k.cy });
    await p.evaluar(`document.querySelector("${CAMPO}").select()`);
  };
  /** Escribe letra por letra en el campo con foco. */
  const escribir = async (s) => {
    for (const ch of s) {
      const code = /\d/.test(ch) ? `Digit${ch}` : ch === " " ? "Space" : `Key${ch.toUpperCase()}`;
      const vk = /[A-Za-z0-9 ]/.test(ch) ? ch.toUpperCase().charCodeAt(0) : 0;
      await p.tecla(ch, /[A-Za-z0-9 ]/.test(ch) ? code : "", vk, 0, ch);
    }
  };
  const modo = () => p.evaluar(`document.querySelector(".modo button.simular").getAttribute("aria-pressed") === "true" ? "simular" : "editar"`);

  // ── Armado: K1, K2 y dos fases L ──
  const k1 = await colocarK("contactor.bobina", -6, 0, "K1");
  const k2 = await colocarK("contactor.bobina", 4, 0, "K2");
  await seleccionar([k1]);
  await esperar(250); // el panel se abrió solo: que el lienzo termine de cambiar de tamaño
  await p.evaluar(`(() => { const cv = document.querySelector("canvas"); const v = bornera.editor.vista;
    v.camara.zoom = 1; v.camara.centrar(0, 4, cv.clientWidth, cv.clientHeight); v.invalidar(); })()`);

  // ── Espacio en 1024×600 ──
  const espacio = await p.evaluar(`(() => {
    const panel = document.querySelector('${PANEL}'), campo = document.querySelector("${CAMPO}");
    const r = campo.getBoundingClientRect(), cv = document.querySelector("canvas");
    const botones = [...panel.querySelectorAll("button")].map(b => b.getBoundingClientRect());
    const centro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { dentro: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      alcanzable: centro === campo, sinDesborde: panel.scrollWidth <= panel.clientWidth,
      botonesDentro: botones.every(b => b.right <= innerWidth && b.bottom <= innerHeight && b.left >= panel.getBoundingClientRect().left),
      lienzo: cv.clientWidth, pagina: document.documentElement.scrollWidth <= innerWidth }; })()`);
  comprobar("1024×600: el campo está a la vista y se puede apretar", espacio.dentro && espacio.alcanzable, JSON.stringify(espacio));
  comprobar("el panel no desborda a lo ancho y sus botones entran", espacio.sinDesborde && espacio.botonesDentro && espacio.pagina, JSON.stringify(espacio));
  comprobar("al lienzo le quedan al menos 560 px", espacio.lienzo >= 560, espacio.lienzo);
  const atributos = await p.evaluar(`(() => { const c = document.querySelector("${CAMPO}");
    return [c.getAttribute("autocomplete"), c.getAttribute("autocorrect"), c.getAttribute("autocapitalize"), c.getAttribute("spellcheck")].join(","); })()`);
  comprobar("autocompletar, autocorregir, mayúsculas automáticas y corrector apagados", atributos === "off,off,off,false", atributos);

  await p.evaluar("document.activeElement.blur()");
  await foto("refSeleccionado");
  await p.esc();
  await foto("ref");
  await seleccionar([k1]);
  const original = await poses();

  // ── Escribir no toca el lienzo, el historial ni el caché de textos ──
  const antes = await pasos();
  const memoria = await p.evaluar("bornera.editor.vista.memoriaCache");
  await enfocar();
  await escribir("km10abc");
  comprobar("escribir letra por letra no da pasos", (await pasos()) === antes, (await pasos()) - antes);
  comprobar("ni cambia el documento", (await etiqueta(k1)) === "K1");
  let d = await distintos("refSeleccionado");
  comprobar("ni el lienzo (sin resaltado nuevo ni etiqueta a medias)", d === 0, `${d} píxeles distintos`);
  comprobar("ni el caché de textos", (await p.evaluar("bornera.editor.vista.memoriaCache")) === memoria);
  comprobar("las minúsculas quedan como se escriben (sin mover el cursor)", (await valor()) === "km10abc", await valor());

  // ── R, M, Supr, Retroceso y Ctrl+Z son del campo ──
  await tecla(SUPR);
  await tecla(RETROCESO);
  await p.tecla("r", "KeyR", 82, 0, "r");
  await p.tecla("m", "KeyM", 77, 0, "m");
  await tecla(Z, CTRL);
  comprobar(
    "R, M, Supr, Retroceso y Ctrl+Z en el campo no tocan el documento",
    (await poses()) === original && (await pasos()) === antes && (await etiqueta(k1)) === "K1",
  );
  comprobar("y la selección sigue", (await p.evaluar("bornera.editor.seleccion.size")) === 1);

  // ── Esc cancela; después, blur no aplica nada ──
  await p.esc();
  comprobar("Esc cancela: el campo vuelve a K1 y suelta el foco", (await valor()) === "K1" && !(await enCampo()), await valor());
  comprobar("Esc en el campo no deselecciona", (await p.evaluar("bornera.editor.seleccion.size")) === 1);
  await p.evaluar(`(() => { const c = document.querySelector("${CAMPO}"); c.focus(); c.blur(); })()`);
  comprobar("Esc y después blur: ningún paso", (await pasos()) === antes && (await etiqueta(k1)) === "K1");

  // ── Enter confirma (mayúsculas, un paso) y suelta el foco; blur después no suma ──
  await enfocar();
  await escribir("km5");
  await tecla(ENTER);
  comprobar("Enter aplica en mayúsculas", (await etiqueta(k1)) === "KM5", await etiqueta(k1));
  comprobar("Enter es un paso", (await pasos()) === antes + 1, (await pasos()) - antes);
  comprobar("Enter devuelve el foco al lienzo", !(await enCampo()));
  await p.evaluar(`(() => { const c = document.querySelector("${CAMPO}"); c.focus(); c.blur(); })()`);
  comprobar("Enter y después blur: un solo paso", (await pasos()) === antes + 1);
  await p.esc(); // sin resaltado
  d = await distintos("ref");
  comprobar("la etiqueta nueva se ve en el lienzo", d > 0, `${d} píxeles distintos`);
  await tecla(Z, CTRL);
  comprobar("Ctrl+Z la deshace en un paso", (await etiqueta(k1)) === "K1" && (await pasos()) === antes);
  d = await distintos("ref");
  comprobar("y el lienzo queda como antes, sin restos", d === 0, `${d} píxeles distintos`);
  await tecla(Y, CTRL);
  comprobar("Ctrl+Y la rehace", (await etiqueta(k1)) === "KM5");
  await seleccionar([k1]);
  await esperar(30);
  comprobar("el panel muestra lo rehecho", (await valor()) === "KM5", await valor());

  // ── Mismo valor: sin paso. Tab confirma ──
  await enfocar();
  await tecla(ENTER);
  await enfocar();
  await escribir("KM5");
  await tecla(ENTER);
  comprobar("confirmar el mismo valor no da paso", (await pasos()) === antes + 1);
  await enfocar();
  await escribir("K6");
  await tecla(TAB);
  comprobar("Tab confirma (un paso)", (await etiqueta(k1)) === "K6" && (await pasos()) === antes + 2 && !(await enCampo()));

  // ── Clic en otro componente mientras se escribe: va al que se editaba ──
  await seleccionar([k1]);
  await enfocar();
  await escribir("K9");
  await p.clic(await p.punto(4, 0));
  comprobar("clic en K2 con K9 escrito: K1 pasa a K9", (await etiqueta(k1)) === "K9", await etiqueta(k1));
  comprobar("y K2 queda igual", (await etiqueta(k2)) === "K2", await etiqueta(k2));
  comprobar("la selección pasa a K2 y el panel lo muestra", (await p.evaluar("[...bornera.editor.seleccion][0]")) === k2 && (await valor()) === "K2");

  // ── Error: Enter no confirma; clic en el lienzo vuelve al valor confirmado ──
  const antesError = await pasos();
  await enfocar();
  await escribir("K 2");
  await tecla(ENTER);
  comprobar("con espacio en el medio, Enter no confirma y sigue en el campo", (await pasos()) === antesError && (await enCampo()));
  comprobar(
    "se marca el error",
    (await texto(".error")) === "Sin espacios" && (await p.evaluar(`document.querySelector("${CAMPO}").getAttribute("aria-invalid")`)) === "true",
    await texto(".error"),
  );
  await p.clic(await p.punto(-12, 14)); // vacío
  comprobar("al salir con error vuelve al valor confirmado, sin paso", (await etiqueta(k2)) === "K2" && (await pasos()) === antesError);
  for (const [escrito, error] of [
    ["K#1", "Carácter no permitido: «#»"],
    ["WWWWWWWWWWWWW", "Máximo 12 caracteres"],
  ]) {
    await seleccionar([k2]);
    await enfocar();
    await escribir(escrito);
    comprobar(`"${escrito}": ${error}`, (await texto(".error")) === error, await texto(".error"));
    await p.esc();
  }
  await seleccionar([k2]);
  await enfocar();
  await escribir("X=1:A");
  await tecla(ENTER);
  comprobar("= y : se permiten", (await etiqueta(k2)) === "X=1:A", await etiqueta(k2));

  // ── Valores existentes: enfocar y salir no cambia ni marca error ──
  await p.evaluar(`bornera.editor.ejecutar(new bornera.comandos.CambiarEtiqueta("${k2}", "k#1"))`);
  await seleccionar([k2]);
  const antesBrn = await pasos();
  await enfocar();
  comprobar("un valor viejo no permitido no marca error al enfocar", (await texto(".error")) === "");
  await tecla(TAB);
  comprobar("ni cambia al salir", (await etiqueta(k2)) === "k#1" && (await pasos()) === antesBrn);
  await enfocar();
  await tecla(ENTER);
  comprobar("ni con Enter", (await etiqueta(k2)) === "k#1" && (await pasos()) === antesBrn);

  // ── Botón Deshacer con la edición abierta: confirma y deshace esa edición ──
  await seleccionar([k2]);
  await enfocar();
  await escribir("KU");
  const caja = await p.caja('button[aria-label="Deshacer"]');
  await p.clic({ x: caja.cx, y: caja.cy });
  comprobar(
    "clic en Deshacer con la edición abierta: la confirma y la deshace",
    (await etiqueta(k2)) === "k#1" && (await pasos()) === antesBrn && (await p.evaluar("bornera.editor.puedeRehacer")),
  );

  // ── Fase: la etiqueta es la red ──
  const l1 = await colocarK("fuente.fase", -6, 8, "L");
  await colocarK("fuente.fase", 0, 8, "L");
  await seleccionar([l1]);
  await esperar(30);
  comprobar("en una fase el campo dice Red (etiqueta)", (await texto("label")) === "Red (etiqueta)", await texto("label"));
  comprobar("y muestra con cuántas está unida", (await texto(".nota")).startsWith("Red L: unida a 1 alimentación más"), await texto(".nota"));
  await enfocar();
  await escribir("l1");
  comprobar("mientras se escribe, avisa a qué red pasa", (await texto(".nota")).startsWith("Al confirmar pasa de la red L a la red L1"), await texto(".nota"));
  await tecla(ENTER);
  comprobar("Enter la pasa a L1", (await etiqueta(l1)) === "L1" && (await texto(".nota")).startsWith("Red L1: sin otras"), await texto(".nota"));
  await enfocar();
  await tecla(RETROCESO);
  comprobar("una fase sin nombre de red es un error", (await texto(".error")) === "La alimentación necesita un nombre de red");
  await p.esc();
  const espacioFase = await p.evaluar(`(() => { const b = [...document.querySelectorAll('${PANEL} button')].map(e => e.getBoundingClientRect());
    const panel = document.querySelector('${PANEL}'); return b.every(r => r.bottom <= innerHeight) && panel.scrollWidth <= panel.clientWidth; })()`);
  comprobar("con las notas de red, el panel sigue entrando", espacioFase);
  await p.captura("fase");

  // ── Etiquetas largas en las 4 rotaciones: de larga a corta sin restos ──
  await seleccionar([]);
  await foto("conFases");
  for (let i = 0; i < 4; i++) {
    await seleccionar([k1]);
    await enfocar();
    await escribir("WWWWWWWWWWWW");
    await tecla(ENTER);
    await tecla(R);
    await enfocar();
    await escribir("K9");
    await tecla(ENTER);
  }
  await p.esc();
  d = await distintos("conFases");
  comprobar("12 W, girar y volver a K9 en las 4 rotaciones: sin restos", d === 0, `${d} píxeles distintos`);
  comprobar("y K1 quedó derecho", JSON.parse(await poses()).find((c) => c.id === k1).rot === 0);

  // ── Botones del panel: girar y espejar (un paso cada uno) ──
  await seleccionar([k1]);
  const antesBotones = await pasos();
  await p.evaluar(`document.querySelector('${PANEL} button[aria-label="Girar horario"]').click()`);
  await p.evaluar(`document.querySelector('${PANEL} button[aria-label="Espejar"]').click()`);
  const pose = JSON.parse(await poses()).find((c) => c.id === k1);
  comprobar("los botones giran y espejan, un paso cada uno", pose.rot === 270 && pose.espejado && (await pasos()) === antesBotones + 2, JSON.stringify(pose));
  await tecla(Z, CTRL);
  await tecla(Z, CTRL);

  // ── Varios: cantidad, etiqueta común o Varias, de solo lectura ──
  await seleccionar([k1, k2]);
  await esperar(30);
  comprobar(
    "con varios: cantidad y Varias, sin campo",
    (await texto(".nombre")) === "2 componentes seleccionados" && (await texto(".valor.varias")).includes("Varias") && (await valor()) === null,
    await texto(".valor"),
  );
  await p.captura("varios");

  // ── F5 desde el campo: confirma y pasa a Simular, sin recargar ──
  await p.evaluar("globalThis.__sinRecargar = true");
  await seleccionar([k1]);
  const antesF5 = await pasos();
  await enfocar();
  await escribir("KF");
  await tecla(F5);
  comprobar("F5 desde el campo pasa a Simular", (await modo()) === "simular");
  comprobar("y confirma lo escrito antes (un paso)", (await etiqueta(k1)) === "KF" && (await pasos()) === antesF5 + 1, await etiqueta(k1));
  comprobar("F5 no recarga la página", (await p.evaluar("globalThis.__sinRecargar === true")));
  comprobar(
    "en Simular el panel es de solo lectura",
    (await p.evaluar(`document.querySelector("${CAMPO}").disabled`)) &&
      (await p.evaluar(`[...document.querySelectorAll('${PANEL} .fila button')].every(b => b.disabled)`)) &&
      (await texto(".nota")).includes("Solo lectura en Simular"),
  );
  await p.captura("simular");
  await tecla(F5);
  comprobar("F5 otra vez vuelve a Editar", (await modo()) === "editar");

  // F5 con un error: vuelve al valor confirmado, sin paso, y cambia de modo.
  await seleccionar([k1]);
  await enfocar();
  await escribir("K 1");
  await tecla(F5);
  comprobar("F5 con un error: cambia de modo sin aplicar ni dar paso", (await modo()) === "simular" && (await etiqueta(k1)) === "KF" && (await pasos()) === antesF5 + 1);
  await tecla(F5);

  // F5 con un modal abierto o durante un gesto: no cambia.
  await p.evaluar(`(() => { const d = document.createElement("div"); d.id = "modal-falso"; d.setAttribute("aria-modal", "true"); document.body.append(d); })()`);
  await tecla(F5);
  comprobar("F5 con un diálogo modal no cambia de modo", (await modo()) === "editar");
  await p.evaluar(`document.getElementById("modal-falso").remove()`);
  const a = await p.punto(-12, 14);
  await p.mouse("mouseMoved", a.x, a.y);
  await p.mouse("mousePressed", a.x, a.y);
  await p.mouse("mouseMoved", a.x + 30, a.y + 20, { botones: 1 });
  comprobar("(el rectángulo está en curso)", await p.evaluar("bornera.editor.enGesto"));
  await tecla(F5);
  comprobar("F5 durante un rectángulo de selección no cambia de modo", (await modo()) === "editar");
  await p.mouse("mouseReleased", a.x + 30, a.y + 20);
  comprobar("y nada recargó la página", await p.evaluar("globalThis.__sinRecargar === true"));

  // ── Ctrl+Shift+B desde el campo: confirma en el documento, no en el banco ──
  await seleccionar([k1]);
  await enfocar();
  await escribir("KB");
  await p.tecla("B", "KeyB", 66, CTRL | MAYUS);
  await p.esperarA("bornera.activo() !== bornera.editor");
  comprobar("Ctrl+Shift+B desde el campo cambia de escena y confirma en el documento", (await etiqueta(k1)) === "KB", await etiqueta(k1));
  comprobar(
    "y no en el banco",
    await p.evaluar(`!bornera.activo().documento.hojas[0].componentes.some(c => c.etiqueta === "KB")`),
  );

  // ── Resumen con 2000: se calcula al soltar el rectángulo, no por cuadro ──
  await p.tecla("B", "KeyB", 66, CTRL | MAYUS);
  await p.tecla("B", "KeyB", 66, CTRL | MAYUS);
  await p.esperarA("bornera.activo()?.escena.cantidad === 2000");
  await p.evaluar(`(() => { const ed = bornera.activo(); const orig = ed.resumenSeleccion.bind(ed);
    globalThis.__resumen = { veces: 0, ms: 0 };
    ed.resumenSeleccion = () => { const t0 = performance.now(); const r = orig(); globalThis.__resumen.veces++;
      globalThis.__resumen.ms = Math.max(globalThis.__resumen.ms, performance.now() - t0); return r; }; })()`);
  await reposo();
  // Desde un rincón del lienzo fuera de la escena (se aleja hasta que quede afuera) hasta el centro.
  const { ini, fin } = await p.evaluar(`(() => { const ed = bornera.activo(), v = ed.vista, k = ed.escena.caja;
    const r = document.querySelector("canvas").getBoundingClientRect();
    const afuera = () => { const g = v.camara.aGrilla(4, 4); return g.x < k.x - 0.5 && g.y < k.y - 0.5; };
    for (let i = 0; i < 20 && !afuera(); i++) { v.camara.zoom *= 0.85; v.camara.centrar(k.x + k.ancho / 2, k.y + k.alto / 2, r.width, r.height); }
    v.invalidar();
    const c = v.camara.aPantalla(k.x + k.ancho / 2, k.y + k.alto / 2);
    return { ini: { x: r.left + 4, y: r.top + 4 }, fin: { x: r.left + c.x, y: r.top + c.y } }; })()`);
  await reposo();
  const pasosRect = 30;
  await p.evaluar(`(() => { const v = bornera.activo().vista; const antes = v.alDibujar; globalThis.__cuadros = [];
    v.alDibujar = (m) => { antes?.(m); globalThis.__cuadros.push(m.total); }; })()`);
  await p.mouse("mouseMoved", ini.x, ini.y);
  await p.mouse("mousePressed", ini.x, ini.y);
  for (let i = 1; i <= pasosRect; i++) {
    await p.mouse("mouseMoved", ini.x + ((fin.x - ini.x) * i) / pasosRect, ini.y + ((fin.y - ini.y) * i) / pasosRect, { botones: 1 });
  }
  const durante = await p.evaluar("globalThis.__resumen.veces");
  await p.mouse("mouseReleased", fin.x, fin.y);
  await reposo();
  const r = await p.evaluar(`(() => { const ed = bornera.activo(); const c = globalThis.__cuadros;
    return { seleccionados: ed.seleccion.size, veces: globalThis.__resumen.veces, ms: globalThis.__resumen.ms,
      cuadros: c.length, lentos: c.filter(x => x > 16).length, maximo: Math.max(0, ...c) }; })()`);
  comprobar("con 2000, el rectángulo no calcula el resumen mientras se arrastra", durante === 0, durante);
  comprobar(`y lo calcula una vez al soltar (${r.seleccionados} seleccionados)`, r.veces === 1 && r.seleccionados > 0, JSON.stringify(r));
  comprobar(`el resumen con ${r.seleccionados} tarda ${r.ms.toFixed(2)} ms (límite 5 ms)`, r.ms < 5, r.ms);
  console.log(
    `  ·   rectángulo sobre 2000: ${r.seleccionados} seleccionados · resumen ${r.ms.toFixed(2)} ms, ${r.veces} vez · ` +
      `${r.cuadros} cuadros, ${r.lentos} lentos > 16 ms (máx. ${r.maximo.toFixed(1)} ms)`,
  );
  comprobar("el rectángulo sobre 2000 no da cuadros lentos", r.lentos === 0, JSON.stringify(r));
  const todos = await p.evaluar(`(() => { const ed = bornera.activo(); ed.seleccionarIds([]);
    const ids = ed.documento.hojas[0].componentes.map(c => c.id); const t0 = performance.now(); ed.seleccionarIds(ids);
    return { veces: globalThis.__resumen.veces, ms: performance.now() - t0 }; })()`);
  console.log(`  ·   seleccionar las 2000 de una vez (con el resumen): ${todos.ms.toFixed(2)} ms`);
}
