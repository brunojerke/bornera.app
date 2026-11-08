// T10: rotar, espejar, borrar y deshacer desde el teclado y los botones.
// R/Mayús+R/M/Supr sobre una selección de varios (un paso cada uno), sin
// restos en pantalla (píxeles iguales después de 4×R, 2×M y Supr+Ctrl+Z),
// botones de deshacer y rehacer, atajos ignorados en el buscador y durante un
// arrastre, colocar con R y M, modo Simular, un solo listener al cambiar de
// escena y rotar todo con 2000.

import { CTRL, esperar, MAYUS } from "./cdp.mjs";

export const nombre = "Rotar, espejar, borrar y deshacer";

const R = ["r", "KeyR", 82];
const M = ["m", "KeyM", 77];
const SUPR = ["Delete", "Delete", 46];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];

export default async function (p, comprobar) {
  const tecla = ([key, code, w], mods = 0) => p.tecla(mods & MAYUS && key.length === 1 ? key.toUpperCase() : key, code, w, mods);
  /** Espera a que la vista no tenga nada por dibujar (ni mosaicos pendientes), 3 cuadros seguidos. */
  const reposo = () =>
    p.evaluar(`new Promise((listo) => { let quietos = 0; const f = () => {
      quietos = bornera.activo().vista.enReposo ? quietos + 1 : 0;
      if (quietos >= 3) listo(true); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
  /** Guarda los píxeles del lienzo con un nombre. */
  const foto = async (n) => {
    await reposo();
    await p.evaluar(`(() => { const cv = document.querySelector("canvas");
      (globalThis.__fotos ??= {})["${n}"] = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; })()`);
  };
  /** Píxeles distintos entre el lienzo de ahora y la foto `n` (−1 si cambió el tamaño). */
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
    p.evaluar("JSON.stringify(bornera.activo().documento.hojas[0].componentes.map(({ id, x, y, rot, espejado }) => ({ id, x, y, rot, espejado })))");
  const seleccionar = (ids) => p.evaluar(`bornera.activo().seleccionarIds(${JSON.stringify(ids)})`);
  const colocarK = (tipo, x, y, etiqueta) =>
    p.evaluar(`(() => { const { editor, comandos: c } = bornera;
      const cmd = c.colocar(editor.documento, { tipo: "${tipo}", x: ${x}, y: ${y}, rot: 0, espejado: false, etiqueta: "${etiqueta}", params: {} });
      editor.ejecutar(cmd); return cmd.id; })()`);

  // Un componente lejos, para abrir el panel de propiedades (cambia el ancho del
  // lienzo) antes de las fotos: así todas tienen el mismo tamaño.
  const lejos = await colocarK("contactor.bobina", 500, 500, "X");
  await seleccionar([lejos]);
  await p.esc();
  await esperar(200); // el panel se abrió: que el lienzo termine de cambiar de tamaño
  await p.evaluar(`(() => { const cv = document.querySelector("canvas"); const v = bornera.editor.vista;
    v.camara.zoom = 1; v.camara.centrar(0, 1, cv.clientWidth, cv.clientHeight); v.invalidar(); })()`);
  await foto("vacia");

  // Bobina K1, Fase L y una bobina con etiqueta larga (sobresale de su caja al girar).
  const ids = [
    await colocarK("contactor.bobina", -6, 0, "K1"),
    await colocarK("fuente.fase", 0, 0, "L"),
    await colocarK("contactor.bobina", 5, 3, "KM12-WWWW"),
  ];
  await foto("ref");
  const original = await poses();

  // ── 4×R, 4×Mayús+R y 2×M: cada uno un paso y vuelve exacto, sin restos ──
  for (const [nombreTecla, t, mods, veces] of [
    ["R", R, 0, 4],
    ["Mayús+R", R, MAYUS, 4],
    ["M", M, 0, 2],
  ]) {
    await seleccionar(ids);
    const antes = await pasos();
    await tecla(t, mods);
    const una = await poses();
    for (let i = 1; i < veces; i++) await tecla(t, mods);
    comprobar(`${veces}×${nombreTecla}: ${veces} pasos de deshacer`, (await pasos()) === antes + veces, (await pasos()) - antes);
    comprobar(`${veces}×${nombreTecla} vuelve al estado exacto`, (await poses()) === original, await poses());
    comprobar(`un ${nombreTecla} cambió algo`, una !== original);
    await p.esc(); // sin resaltado para la foto
    const d = await distintos("ref");
    comprobar(`${veces}×${nombreTecla}: la pantalla queda igual, sin restos`, d === 0, `${d} píxeles distintos`);
  }

  // Bloq Mayús: key "R" sin Mayús gira en sentido horario.
  await seleccionar([ids[1]]);
  await p.tecla("R", "KeyR", 82);
  comprobar(
    "Bloq Mayús + R gira 90° horario (no antihorario)",
    (await p.evaluar(`bornera.editor.documento.hojas[0].componentes.find(c => c.id === "${ids[1]}").rot`)) === 90,
  );
  // L girada 180°: borne arriba, etiqueta derecha (captura).
  await tecla(R);
  const l180 = await p.evaluar(`(() => { const c = bornera.editor.escena.obtener("${ids[1]}"); return c.rotacion; })()`);
  comprobar("la fase queda a 180°", l180 === 180, l180);
  await p.esc();
  await p.captura("fase-180");
  await tecla(Z, CTRL);
  await tecla(Z, CTRL);
  comprobar("Ctrl+Z dos veces la deja derecha", (await poses()) === original);

  // ── Supr borra los tres en un paso; Ctrl+Z, Ctrl+Y y Ctrl+Mayús+Z ──
  await seleccionar(ids);
  const antesSupr = await pasos();
  await tecla(SUPR);
  comprobar("Supr borra la selección", (await p.evaluar("bornera.editor.escena.cantidad")) === 1);
  comprobar("Supr es un solo paso", (await pasos()) === antesSupr + 1);
  comprobar("Supr vacía la selección", (await p.evaluar("bornera.editor.seleccion.size")) === 0);
  let d = await distintos("vacia");
  comprobar("después de Supr la pantalla queda como vacía, sin restos", d === 0, `${d} píxeles distintos`);
  await tecla(Z, CTRL);
  d = await distintos("ref");
  comprobar("Ctrl+Z devuelve los tres, igual que antes", (await poses()) === original && d === 0, `${d} píxeles distintos`);
  await tecla(Y, CTRL);
  comprobar("Ctrl+Y los vuelve a borrar", (await p.evaluar("bornera.editor.escena.cantidad")) === 1);
  await tecla(Z, CTRL);
  await tecla(Z, CTRL | MAYUS);
  comprobar("Ctrl+Mayús+Z también rehace", (await p.evaluar("bornera.editor.escena.cantidad")) === 1);
  await tecla(Z, CTRL);
  await tecla(["Backspace", "Backspace", 8]);
  comprobar("Retroceso sin selección no hace nada", (await p.evaluar("bornera.editor.escena.cantidad")) === 4);

  // Colocar, seleccionar, deshacer y R: sin cambios y sin paso nuevo.
  const nuevo = await colocarK("senalizacion.lampara", 0, 8, "H1");
  await seleccionar([nuevo]);
  await tecla(Z, CTRL);
  const sinNuevo = await pasos();
  await tecla(R);
  await tecla(SUPR);
  comprobar(
    "deshacer un Colocar lo saca de la selección: R y Supr después no hacen nada",
    (await pasos()) === sinNuevo && (await p.evaluar("bornera.editor.seleccion.size")) === 0 && (await p.evaluar("bornera.editor.puedeRehacer")),
  );

  // ── Botones de la barra ──
  const boton = (n) => p.evaluar(`document.querySelector('button[aria-label="${n}"]').disabled`);
  comprobar("con algo hecho, Deshacer está activo", (await boton("Deshacer")) === false);
  comprobar("con algo deshecho, Rehacer está activo", (await boton("Rehacer")) === false);
  await p.evaluar("(() => { const e = bornera.editor; while (e.puedeDeshacer) e.accion('deshacer'); })()");
  await esperar(30);
  comprobar("sin nada para deshacer, Deshacer queda desactivado", (await boton("Deshacer")) === true);
  const cajaRehacer = await p.caja('button[aria-label="Rehacer"]');
  await p.clic({ x: cajaRehacer.cx, y: cajaRehacer.cy });
  comprobar("el botón Rehacer rehace un paso", (await p.evaluar("bornera.editor.escena.cantidad")) === 1 && (await boton("Deshacer")) === false);
  const cajaDeshacer = await p.caja('button[aria-label="Deshacer"]');
  await p.clic({ x: cajaDeshacer.cx, y: cajaDeshacer.cy });
  comprobar("el botón Deshacer deshace", (await p.evaluar("bornera.editor.escena.cantidad")) === 0);
  await p.evaluar("(() => { const e = bornera.editor; while (e.puedeRehacer) e.accion('rehacer'); })()");
  // Rehacer todo: los de antes, más la lámpara cuyo Colocar se había deshecho.
  const todo = JSON.parse(await poses());
  comprobar(
    "rehacer todo vuelve al estado de antes (y rehace la lámpara)",
    JSON.stringify(todo.slice(0, 4)) === original && todo.length === 5 && todo[4].id === nuevo,
    JSON.stringify(todo),
  );
  comprobar("y Rehacer queda desactivado", (await boton("Rehacer")) === true);

  // ── En el buscador las teclas son del campo; en un botón de la paleta, del editor ──
  await seleccionar([ids[0]]);
  const antesCampo = await pasos();
  await p.evaluar(`document.querySelector('input[type=search]').focus()`);
  const valor = () => p.evaluar(`document.querySelector('input[type=search]').value`);
  const rotK1 = () => p.evaluar(`bornera.editor.documento.hojas[0].componentes.find(c => c.id === "${ids[0]}").rot`);
  await p.tecla("r", "KeyR", 82, 0, "r");
  comprobar("en el buscador, R escribe la letra y no gira", (await valor()) === "r" && (await rotK1()) === 0, await valor());
  await p.tecla("m", "KeyM", 77, 0, "m");
  await p.tecla("Backspace", "Backspace", 8);
  comprobar("M escribe y Retroceso borra la letra, no la selección", (await valor()) === "r" && (await p.evaluar("bornera.editor.escena.cantidad")) === 5, await valor());
  // Ctrl+Z es el del campo: deshace lo escrito (la "r"), no el documento.
  await p.tecla("z", "KeyZ", 90, CTRL);
  await p.tecla("Delete", "Delete", 46);
  comprobar("Supr y Ctrl+Z en el buscador no tocan el documento", (await pasos()) === antesCampo && (await rotK1()) === 0, (await pasos()) - antesCampo);
  await p.evaluar(`(() => { const i = document.querySelector('input[type=search]'); i.value = '';
    i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); })()`);
  await esperar(30);
  await p.evaluar(`document.querySelector('.item').focus()`);
  await tecla(R);
  comprobar(
    "con el foco en un botón de la paleta, R gira la selección",
    (await p.evaluar(`bornera.editor.documento.hojas[0].componentes.find(c => c.id === "${ids[0]}").rot`)) === 90 &&
      (await pasos()) === antesCampo + 1,
  );
  await p.evaluar("document.activeElement.blur()");
  await tecla(Z, CTRL);

  // ── R durante un arrastre: se ignora; al soltar, un solo Mover ──
  await seleccionar([ids[0]]);
  const antesArrastre = await pasos();
  const a = await p.punto(-6, 0);
  const b = await p.punto(-6, 4);
  await p.mouse("mouseMoved", a.x, a.y);
  await p.mouse("mousePressed", a.x, a.y);
  for (let i = 1; i <= 5; i++) await p.mouse("mouseMoved", a.x, a.y + ((b.y - a.y) * i) / 10, { botones: 1 });
  await tecla(R);
  await tecla(SUPR);
  await tecla(Z, CTRL);
  for (let i = 6; i <= 10; i++) await p.mouse("mouseMoved", a.x, a.y + ((b.y - a.y) * i) / 10, { botones: 1 });
  await p.mouse("mouseReleased", b.x, b.y);
  await esperar(30);
  const k1 = await p.evaluar(`JSON.stringify((({ x, y, rot }) => ({ x, y, rot }))(bornera.editor.documento.hojas[0].componentes.find(c => c.id === "${ids[0]}")))`);
  comprobar("R, Supr y Ctrl+Z durante el arrastre se ignoran: solo se movió", k1 === JSON.stringify({ x: -6, y: 4, rot: 0 }), k1);
  comprobar("el arrastre dio un solo paso", (await pasos()) === antesArrastre + 1, (await pasos()) - antesArrastre);
  await tecla(Z, CTRL);
  await p.esc();

  // ── Colocar con R y M desde la paleta (modo clic) ──
  const items = await p.evaluar(`[...document.querySelectorAll(".item")].map(e => { const r = e.getBoundingClientRect();
    return { texto: e.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`);
  const fase = items.find((i) => i.texto.startsWith("Fase"));
  await p.clic(fase);
  const destino = await p.punto(-8, 8);
  await p.mouse("mouseMoved", destino.x, destino.y);
  await tecla(R);
  await tecla(R);
  await tecla(M);
  await p.captura("previa-girada");
  const cantidad = await p.evaluar("bornera.editor.documento.hojas[0].componentes.length");
  await p.clic(destino);
  const colocada = await p.evaluar("JSON.stringify((({ tipo, x, y, rot, espejado }) => ({ tipo, x, y, rot, espejado }))(bornera.editor.documento.hojas[0].componentes.at(-1)))");
  comprobar(
    "colocar después de R, R y M deja la fase a 180° espejada",
    colocada === JSON.stringify({ tipo: "fuente.fase", x: -8, y: 8, rot: 180, espejado: true }),
    colocada,
  );
  comprobar("girar la previa no agregó pasos: solo el Colocar", (await p.evaluar("bornera.editor.documento.hojas[0].componentes.length")) === cantidad + 1);
  await p.clic(await p.punto(-4, 8));
  comprobar(
    "la siguiente en modo clic conserva la orientación",
    (await p.evaluar("bornera.editor.documento.hojas[0].componentes.at(-1).rot")) === 180,
  );
  await tecla(SUPR);
  comprobar("Supr mientras se coloca no borra nada", (await p.evaluar("bornera.editor.documento.hojas[0].componentes.length")) === cantidad + 2);
  await p.esc();
  await p.clic(fase);
  comprobar(
    "elegir otra vez en la paleta empieza derecha",
    (await p.evaluar("JSON.stringify(bornera.editor.herramienta.orientacion)")) === JSON.stringify({ rotacion: 0, espejado: false }),
  );
  await tecla(R);
  await p.esc();
  comprobar("Esc descarta la orientación sin colocar", (await p.evaluar("bornera.editor.documento.hojas[0].componentes.length")) === cantidad + 2);

  // ── Modo Simular: los atajos de edición no actúan ──
  await seleccionar([ids[0]]);
  await p.evaluar(`document.querySelector('.modo button.simular').click()`);
  await esperar(30);
  const antesSimular = await pasos();
  await tecla(R);
  await tecla(Z, CTRL);
  comprobar("en modo Simular, R y Ctrl+Z no hacen nada", (await pasos()) === antesSimular);
  comprobar("y los botones del historial quedan desactivados", (await boton("Deshacer")) === true);
  await p.evaluar(`document.querySelector('.modo button:not(.simular)').click()`);
  await esperar(30);

  // ── Cambiar de escena: un solo listener, R gira 90° y no 180° ──
  for (let i = 0; i < 3; i++) await p.tecla("B", "KeyB", 66, CTRL | MAYUS);
  await p.esperarA("bornera.activo()?.escena.cantidad === 2000");
  const uno = await p.evaluar("bornera.activo().documento.hojas[0].componentes[0].id");
  await seleccionar([uno]);
  const rot0 = await p.evaluar("bornera.activo().documento.hojas[0].componentes[0].rot");
  await tecla(R);
  const rot1 = await p.evaluar("bornera.activo().documento.hojas[0].componentes[0].rot");
  comprobar("después de cambiar de escena, R una vez gira 90° (no 180°)", rot1 === (rot0 + 90) % 360, `${rot0} → ${rot1}`);
  comprobar("y es un solo paso", (await pasos()) === 1);

  // Rotar todo con 2000: tiempo del comando y hasta terminar los mosaicos.
  await p.evaluar("bornera.activo().seleccionarIds(bornera.activo().documento.hojas[0].componentes.map(c => c.id))");
  await reposo();
  const tiempos = await p.evaluar(`new Promise((listo) => {
    const ed = bornera.activo();
    const t0 = performance.now();
    ed.accion("rotar");
    const comando = performance.now() - t0;
    let quietos = 0;
    const f = () => {
      quietos = ed.vista.enReposo ? quietos + 1 : 0;
      if (quietos >= 1) listo({ comando, mosaicos: performance.now() - t0 }); else requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  })`);
  const ms = (v) => `${v.toFixed(1)} ms`;
  comprobar(
    `rotar todo con 2000: comando ${ms(tiempos.comando)}, hasta terminar los mosaicos ${ms(tiempos.mosaicos)} (límite del comando: 50 ms)`,
    tiempos.comando < 50,
    ms(tiempos.comando),
  );
  console.log(`  ·   rotar 2000: comando ${ms(tiempos.comando)} · mosaicos listos a los ${ms(tiempos.mosaicos)}`);
  comprobar("rotar todo con 2000 es un solo paso", (await pasos()) === 2);

  // Volver al documento (vacía → documento): sigue habiendo un solo listener.
  for (let i = 0; i < 2; i++) await p.tecla("B", "KeyB", 66, CTRL | MAYUS);
  await p.esperarA("bornera.activo() === bornera.editor");
  await seleccionar([ids[0]]);
  const antesVuelta = await pasos();
  await tecla(R);
  comprobar(
    "de vuelta en el documento, R una vez gira 90° y da un paso",
    (await p.evaluar(`bornera.editor.documento.hojas[0].componentes.find(c => c.id === "${ids[0]}").rot`)) === 90 &&
      (await pasos()) === antesVuelta + 1,
  );
}
