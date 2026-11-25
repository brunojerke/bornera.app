// T16: copiar, cortar, pegar y duplicar en la app real a 1024×600.
//
// Los 16 casos de la prueba a mano de la etapa 2:
//  1. armar bobina, lámpara y Fase L1 con un cable tendido con W que se
//     cierra sobre un borne; 2. seleccionar con el rectángulo;
//  3. Ctrl+C; 4. Ctrl+V con la previa bajo el mouse; 5. el clic que pega en un
//     paso, con ids nuevos y `validarHoja` en 0; 6. lo pegado queda seleccionado;
//  7. Ctrl+D al lado; 8. la previa sobre el original, en aviso con ✕ y la
//     pista; 9. el clic que no pega; 10. Esc; 11. Ctrl+Z exacto; 12. Ctrl+Y
//     con los mismos ids; 13. Mayús+Supr; 14. con el foco en el buscador,
//     Ctrl+V no abre la previa; 15. en Simular, tampoco; 16. sin errores.
// Más los de la sección 4 del plan T16: Ctrl+Insert y Mayús+Insert, Ctrl+X y
// pegar en otro lado, Ctrl+D repetido, los dos casos del ajuste 2 (un cable
// existente que pasa sobre un borne pegado, con Ctrl+V; un extremo suelto
// existente bajo un borne pegado, con Ctrl+D que pasa a la previa flotante y
// se suelta corrida), la Fase "L1" que sigue siendo "L1", el foco en la
// etiqueta (solo que el editor no actúa: el portapapeles del sistema en un
// navegador headless puede pedir permiso), Ctrl+N con «No guardar» y pegar
// (el portapapeles sobrevive) y el aviso de un cable sin sus dos puntas.
//
// Desde T17 (D-duplicar C), pegar o duplicar con los originales en la hoja
// renumera lo que choca: la copia de K1 y H1 es K2 y H2, y así. La Fase L1
// conserva. Los pasos 5 y 7 esperan esas etiquetas nuevas.

import { CTRL, esperar, MAYUS } from "./cdp.mjs";

export const nombre = "Copiar, cortar, pegar y duplicar";

const C = ["c", "KeyC", 67];
const V = ["v", "KeyV", 86];
const X = ["x", "KeyX", 88];
const D = ["d", "KeyD", 68];
const N = ["n", "KeyN", 78];
const W = ["w", "KeyW", 87];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];
const INSERT = ["Insert", "Insert", 45];
const SUPR = ["Delete", "Delete", 46];
const F5 = ["F5", "F5", 116];
const CAMPO = "#prop-etiqueta";
const BUSCADOR = 'input[type="search"]';
const DIALOGO = '[role="dialog"][aria-modal="true"]';

const AVISO_SIN_LUGAR = "No hay lugar al lado: mové la copia y hacé clic para soltarla.";
const AVISO_CABLE_SOLO = "Para copiar un cable, seleccioná también lo que conecta en sus dos puntas.";

export default async function (p, comprobar) {
  const tecla = ([key, code, vk], mods = 0, texto = undefined) => p.tecla(key, code, vk, mods, texto);
  const hojaJSON = () => p.evaluar("JSON.stringify(bornera.editor.documento.hojas)");
  const hoja = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento.hojas[0]))");
  const pasos = () => p.evaluar("bornera.editor.historial.hechos.length");
  const seleccion = () => p.evaluar("[...bornera.editor.seleccion].sort()");
  const problemas = () => p.evaluar("bornera.cables.validarHoja(bornera.editor.documento.hojas[0]).length");
  const previa = () =>
    p.evaluar(`(() => { const h = bornera.editor.pegando; if (!h) return null; const v = h.previa;
      return { modo: h.modo, visible: !!v, dx: v?.dx ?? null, dy: v?.dy ?? null, conflictos: v?.conflictos.length ?? 0 }; })()`);
  const herramienta = () => p.evaluar("bornera.editor.herramienta === null ? null : bornera.editor.herramienta.constructor.name");
  const pista = () => p.evaluar(`document.querySelector("footer .pista-herramienta")?.textContent.trim() ?? null`);
  const aviso = () => p.evaluar(`document.querySelector(".avisos").textContent.trim()`);
  const modo = () => p.evaluar(`document.querySelector(".modo button.simular").getAttribute("aria-pressed") === "true" ? "simular" : "editar"`);
  const guardado = () => p.evaluar(`import("/src/editor/portapapeles.ts").then((m) => JSON.stringify(m.recorteGuardado()))`);
  const seleccionar = (ids) => p.evaluar(`bornera.editor.seleccionarIds(${JSON.stringify(ids)})`);
  const colocar = (tipo, x, y, etiqueta) =>
    p.evaluar(`(() => { const { editor, comandos: c } = bornera;
      const cmd = c.colocar(editor.documento, { tipo: "${tipo}", x: ${x}, y: ${y}, rot: 0, espejado: false, etiqueta: ${JSON.stringify(etiqueta)}, params: {} });
      editor.ejecutar(cmd); return cmd.id; })()`);
  const tender = (desde, hasta) =>
    p.evaluar(`(() => { const { editor, comandos: c } = bornera;
      const cmd = c.cablear(editor.documento, { desde: ${JSON.stringify(desde)}, hasta: ${JSON.stringify(hasta)}, codos: [] });
      editor.ejecutar(cmd); return cmd.id; })()`);
  const camara = async (zoom, gx, gy) => {
    await p.evaluar(`(() => { const cv = document.querySelector("canvas[aria-label^=Lienzo]"); const v = bornera.editor.vista;
      v.camara.zoom = ${zoom}; v.camara.centrar(${gx}, ${gy}, cv.clientWidth, cv.clientHeight); v.invalidarContenido(); })()`);
    await esperar(60);
  };
  /** Mouse al punto de grilla (gx, gy). */
  const a = async (gx, gy) => {
    const q = await p.punto(gx, gy);
    await p.mouse("mouseMoved", q.x, q.y);
    await esperar(30);
  };
  const clic = async (gx, gy) => {
    await p.clic(await p.punto(gx, gy));
    await esperar(30);
  };
  /** Los componentes y cables nuevos de `despues` respecto de `antes` (por id). */
  const nuevos = (antes, despues) => {
    const ya = new Set([...antes.componentes, ...antes.cables].map((e) => e.id));
    return {
      componentes: despues.componentes.filter((c) => !ya.has(c.id)),
      cables: despues.cables.filter((w) => !ya.has(w.id)),
    };
  };
  const ids = (n) => [...n.componentes, ...n.cables].map((e) => e.id).sort();
  /**
   * Cada componente nuevo es un original trasladado (dx, dy), con el mismo
   * tipo y la misma etiqueta, o la que diga `renumerada` (T17: lo que choca
   * con la hoja recibe el menor libre).
   */
  const trasladados = (originales, copias, dx, dy, renumerada = {}) =>
    copias.length === originales.length &&
    originales.every((o) =>
      copias.some((c) => c.tipo === o.tipo && c.etiqueta === (renumerada[o.etiqueta] ?? o.etiqueta) && c.x === o.x + dx && c.y === o.y + dy),
    );
  const hayDialogo = () => p.esperarA(`!!document.querySelector('${DIALOGO}')`, 5000);
  const sinDialogo = () => p.esperarA(`!document.querySelector('${DIALOGO}')`, 5000);
  const responder = async (texto) => {
    const k = await p.evaluar(`(() => { const b = [...document.querySelectorAll('${DIALOGO} button')].find((x) => x.textContent.trim() === ${JSON.stringify(texto)});
      if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!k) throw new Error(`No está el botón «${texto}» en el diálogo.`);
    await p.clic(k);
  };

  // ── 1. Armado: K1 (0, 0), H1 (6, 0) y la Fase L1 (−4, −6) con comandos ──
  const k1 = await colocar("contactor.bobina", 0, 0, "K1");
  const h1 = await colocar("senalizacion.lampara", 6, 0, "H1");
  const l1 = await colocar("fuente.fase", -4, -6, "L1");
  // Seleccionar una vez abre el panel y cambia el ancho del lienzo: antes de la cámara.
  await seleccionar([k1]);
  await p.esc();
  await esperar(150);
  await camara(1, 6, 0);

  // El cable con W: de K1·A1 (0, −2) a H1·X1 (6, −2), cerrado sobre el borne.
  await tecla(W);
  await a(0, -2);
  await clic(0, -2);
  await a(6, -2);
  await clic(6, -2);
  await p.esc();
  await p.esc();
  const h0 = await hoja();
  const w1 = h0.cables[0];
  comprobar(
    "1. el cable de W va de K1·A1 y se cierra sobre H1·X1",
    h0.cables.length === 1 &&
      w1.desde.tipo === "borne" && w1.desde.comp === k1 && w1.desde.borne === "A1" &&
      w1.hasta.tipo === "borne" && w1.hasta.comp === h1 && w1.hasta.borne === "X1",
    JSON.stringify(w1),
  );
  comprobar("la herramienta cable terminó", (await herramienta()) === null, await herramienta());

  // ── 2. Rectángulo de selección ──
  await seleccionar([]);
  await p.arrastrar(await p.punto(-8, -9), await p.punto(9, 4));
  await esperar(60);
  const originales = [k1, h1, l1, w1.id].sort();
  comprobar("2. el rectángulo selecciona los 3 componentes y el cable", JSON.stringify(await seleccion()) === JSON.stringify(originales), JSON.stringify(await seleccion()));

  // ── 3. Ctrl+C ──
  let n = await pasos();
  await tecla(C, CTRL);
  const r1 = JSON.parse(await guardado());
  comprobar(
    "3. Ctrl+C guarda el recorte (3 componentes y el cable) sin dar un paso",
    r1?.componentes.length === 3 && r1?.cables.length === 1 && (await pasos()) === n,
    JSON.stringify(r1 && { c: r1.componentes.length, w: r1.cables.length }),
  );

  // ── 4. Ctrl+V: previa bajo el mouse ──
  await a(20, 0);
  await tecla(V, CTRL);
  await a(20, 1);
  await a(20, 0);
  const pv = await previa();
  comprobar("4. Ctrl+V abre la previa bajo el mouse, sin conflictos", pv?.modo === "pegar" && pv.visible && pv.conflictos === 0, JSON.stringify(pv));
  await p.captura("previa");

  // ── 5 y 6. El clic pega en un paso; lo pegado queda seleccionado ──
  const antesPegar = await hoja();
  n = await pasos();
  await clic(20, 0);
  const despuesPegar = await hoja();
  const pegado = nuevos(antesPegar, despuesPegar);
  comprobar(
    "5. el clic pega en un paso: 3 componentes y 1 cable con ids nuevos, trasladados (K1 y H1 pasan a K2 y H2), y validarHoja en 0",
    (await pasos()) === n + 1 &&
      pegado.cables.length === 1 &&
      trasladados(antesPegar.componentes, pegado.componentes, pv.dx, pv.dy, { K1: "K2", H1: "H2" }) &&
      (await problemas()) === 0 &&
      (await herramienta()) === null,
    JSON.stringify(pegado),
  );
  const wp = pegado.cables[0];
  const kp = pegado.componentes.find((c) => c.etiqueta === "K2");
  const hp = pegado.componentes.find((c) => c.etiqueta === "H2");
  comprobar(
    "el cable pegado va de la K2 pegada a la H2 pegada, borne a borne",
    wp?.desde.comp === kp?.id && wp?.desde.borne === "A1" && wp?.hasta.comp === hp?.id && wp?.hasta.borne === "X1",
    JSON.stringify(wp),
  );
  comprobar("la Fase copiada sigue siendo «L1»", pegado.componentes.some((c) => c.tipo === "fuente.fase" && c.etiqueta === "L1"));
  comprobar("6. lo pegado queda seleccionado", JSON.stringify(await seleccion()) === JSON.stringify(ids(pegado)), JSON.stringify(await seleccion()));

  // ── 11 y 12. Ctrl+Z y Ctrl+Y exactos, con los mismos ids ──
  const docPegado = await hojaJSON();
  await tecla(Z, CTRL);
  comprobar("11. Ctrl+Z deshace el pegado exacto", (await hojaJSON()) === JSON.stringify([antesPegar]) && (await pasos()) === n);
  await tecla(Y, CTRL);
  comprobar("12. Ctrl+Y lo rehace exacto, con los mismos ids", (await hojaJSON()) === docPegado && (await pasos()) === n + 1);

  // ── 7. Ctrl+D al lado, y repetido ──
  await seleccionar(ids(pegado));
  const ancho = Math.ceil(r1.caja.ancho) + 2;
  let antes = await hoja();
  n = await pasos();
  await tecla(D, CTRL);
  let dup = nuevos(antes, await hoja());
  const dup1 = dup;
  comprobar(
    "7. Ctrl+D pega al lado (dx = ancho + 2) en un paso, con K3 y H3, y queda seleccionado",
    (await pasos()) === n + 1 &&
      trasladados(pegado.componentes, dup.componentes, ancho, 0, { K2: "K3", H2: "H3" }) &&
      dup.cables.length === 1 &&
      JSON.stringify(await seleccion()) === JSON.stringify(ids(dup)) &&
      (await problemas()) === 0,
    JSON.stringify(dup.componentes.map((c) => [c.etiqueta, c.x, c.y])),
  );
  antes = await hoja();
  await tecla(D, CTRL);
  dup = nuevos(antes, await hoja());
  comprobar(
    "Ctrl+D repetido arma una fila, con K4 y H4",
    (await pasos()) === n + 2 && trasladados(dup1.componentes, dup.componentes, ancho, 0, { K3: "K4", H3: "H4" }) && (await problemas()) === 0,
    JSON.stringify(dup.componentes.map((c) => [c.etiqueta, c.x, c.y])),
  );
  comprobar("Ctrl+D no toca el portapapeles", JSON.stringify(JSON.parse(await guardado())) === JSON.stringify(r1));

  // ── 8, 9 y 10. La previa sobre el original: aviso, ✕, el clic no pega; Esc ──
  await seleccionar([]);
  // El centro del recorte, redondeado, bajo el mouse: dx = dy = 0, encima del original.
  const cx = Math.round(r1.caja.x + r1.caja.ancho / 2);
  const cy = Math.round(r1.caja.y + r1.caja.alto / 2);
  await a(cx + 1, cy);
  await tecla(V, CTRL);
  await a(cx, cy);
  let pv2 = await previa();
  const pistaChoque = await pista();
  comprobar(
    "8. la previa sobre el original está en aviso (✕) y la pista dice por qué",
    pv2?.dx === 0 && pv2.dy === 0 && pv2.conflictos > 0 && /^No se puede pegar acá: /.test(pistaChoque ?? ""),
    JSON.stringify({ pv2, pistaChoque }),
  );
  await p.captura("previa-choca");
  const docChoque = await hojaJSON();
  n = await pasos();
  await clic(cx, cy);
  comprobar(
    "9. el clic sobre el conflicto no pega y avisa",
    (await pasos()) === n && (await hojaJSON()) === docChoque && (await previa())?.visible === true && /^No se puede pegar acá: /.test(await aviso()),
    await aviso(),
  );
  await p.esc();
  comprobar("10. Esc cierra la previa sin paso", (await herramienta()) === null && (await pasos()) === n && (await hojaJSON()) === docChoque);

  // ── Ctrl+X y pegar en otro lado ──
  await seleccionar(originales);
  n = await pasos();
  await tecla(X, CTRL);
  let h = await hoja();
  comprobar(
    "Ctrl+X corta en un paso: el original se va y la selección queda vacía",
    (await pasos()) === n + 1 && !h.componentes.some((c) => originales.includes(c.id)) && (await seleccion()).length === 0,
  );
  await camara(1, 0, 16);
  await a(0, 14);
  await tecla(V, CTRL);
  await a(0, 15);
  await a(0, 14);
  const pv3 = await previa();
  antes = await hoja();
  await clic(0, 14);
  let corte = nuevos(antes, await hoja());
  comprobar(
    "lo cortado se pega en otro lado, en un paso y sin problemas",
    (await pasos()) === n + 2 && corte.componentes.length === 3 && corte.cables.length === 1 && pv3?.conflictos === 0 && (await problemas()) === 0,
    JSON.stringify(pv3),
  );

  // ── Ctrl+Insert, Mayús+Insert y Mayús+Supr ──
  await seleccionar(ids(corte));
  await p.evaluar(`import("/src/editor/portapapeles.ts").then((m) => m.vaciarPortapapeles())`);
  await tecla(INSERT, CTRL);
  const r2 = JSON.parse(await guardado());
  comprobar("Ctrl+Insert copia", r2?.componentes.length === 3 && r2.cables.length === 1);
  await seleccionar([]);
  await camara(1, 0, 28);
  await a(0, 28);
  await tecla(INSERT, MAYUS);
  await a(0, 29);
  await a(0, 28);
  comprobar("Mayús+Insert abre la previa", (await previa())?.visible === true && (await previa())?.conflictos === 0, JSON.stringify(await previa()));
  antes = await hoja();
  n = await pasos();
  await clic(0, 28);
  const ins = nuevos(antes, await hoja());
  comprobar("y el clic pega", (await pasos()) === n + 1 && ins.componentes.length === 3 && (await problemas()) === 0);
  // ins quedó seleccionado: Mayús+Supr lo corta.
  await tecla(SUPR, MAYUS);
  h = await hoja();
  const r3 = JSON.parse(await guardado());
  comprobar(
    "13. Mayús+Supr corta: un paso, lo seleccionado se va y queda en el portapapeles",
    (await pasos()) === n + 2 && !h.componentes.some((c) => ins.componentes.some((x) => x.id === c.id)) && r3?.componentes.length === 3,
  );

  // ── Ajuste 2, con Ctrl+V: un cable existente pasa sobre un borne pegado ──
  await camara(1, 150, 4);
  const k9 = await colocar("contactor.bobina", 160, 10, "K9");
  await tender({ tipo: "libre", x: 136, y: -2 }, { tipo: "libre", x: 144, y: -2 });
  await seleccionar([k9]);
  await tecla(C, CTRL);
  await seleccionar([]);
  // La caja de la bobina es x −1..1, y −2..2: su centro (160, 10) bajo el mouse. En (140, 0), A1 cae en (140, −2), sobre el cable.
  await a(141, 0);
  await tecla(V, CTRL);
  await a(140, 0);
  const pvA = await previa();
  const docA = await hojaJSON();
  n = await pasos();
  await clic(140, 0);
  comprobar(
    "ajuste 2 (Ctrl+V): con un cable existente sobre un borne pegado, la previa está en aviso y el clic no pega",
    pvA?.dx === -20 && pvA.dy === -10 && pvA.conflictos > 0 && (await pasos()) === n && (await hojaJSON()) === docA,
    JSON.stringify(pvA),
  );
  await p.esc();

  // ── Ajuste 2, con Ctrl+D: un extremo suelto existente bajo un borne pegado ──
  // K9 (160, 10): al lado va en (164, 10), con A1 en (164, 8). Un cable suelto termina ahí.
  await tender({ tipo: "libre", x: 164, y: 4 }, { tipo: "libre", x: 164, y: 8 });
  await seleccionar([k9]);
  await a(156, 14);
  antes = await hoja();
  n = await pasos();
  await tecla(D, CTRL);
  const pvD = await previa();
  comprobar(
    "ajuste 2 (Ctrl+D): con un extremo suelto bajo un borne, no pega y pasa a la previa flotante al lado, con ✕",
    (await pasos()) === n && pvD?.modo === "duplicar" && pvD.dx === 4 && pvD.dy === 0 && pvD.conflictos > 0 && (await aviso()) === AVISO_SIN_LUGAR,
    JSON.stringify({ pvD, aviso: await aviso() }),
  );
  await p.captura("duplicar-choca");
  // Se corre 3 a la derecha desde el punto del mouse al apretar Ctrl+D: sin saltar.
  await a(157, 14);
  await a(159, 14);
  const pvD2 = await previa();
  await clic(159, 14);
  const dupD = nuevos(antes, await hoja());
  comprobar(
    "la previa de Ctrl+D se corre sin saltar y el clic la suelta en un lugar libre",
    pvD2?.dx === 7 && pvD2.conflictos === 0 && (await pasos()) === n + 1 &&
      dupD.componentes.length === 1 && dupD.componentes[0].x === 167 && dupD.componentes[0].y === 10 && (await problemas()) === 0,
    JSON.stringify({ pvD2, dupD: dupD.componentes }),
  );

  // ── El aviso de un cable sin sus dos puntas ──
  // El cable pegado va de borne a borne: solo, sin K1 ni H1, no entra (D2b-A). (Uno suelto en las dos puntas sí entraría.)
  await seleccionar([wp.id]);
  const antesAviso = await guardado();
  n = await pasos();
  await tecla(C, CTRL);
  comprobar(
    "copiar solo un cable sin sus dos puntas avisa cómo hacerlo y no toca el portapapeles",
    (await aviso()) === AVISO_CABLE_SOLO && (await guardado()) === antesAviso && (await pasos()) === n,
    await aviso(),
  );

  // ── Foco en la etiqueta y en el buscador: el editor no actúa ──
  await seleccionar([k9]);
  await esperar(100);
  const campo = await p.caja(CAMPO);
  await p.clic({ x: campo.cx, y: campo.cy });
  const docCampo = await hojaJSON();
  n = await pasos();
  for (const [t, m] of [[C, CTRL], [V, CTRL], [X, CTRL], [D, CTRL], [INSERT, CTRL], [INSERT, MAYUS], [SUPR, MAYUS]]) await tecla(t, m);
  const enCampo = { foco: await p.evaluar(`document.activeElement?.id ?? null`), previa: await previa(), pasos: await pasos() };
  comprobar(
    "con el foco en la etiqueta, ni Ctrl+C/V/X/D ni Ctrl+Insert, Mayús+Insert y Mayús+Supr llegan al editor",
    enCampo.foco === "prop-etiqueta" && enCampo.previa === null && enCampo.pasos === n && (await hojaJSON()) === docCampo,
    JSON.stringify(enCampo),
  );
  await p.evaluar(`document.activeElement.blur()`);
  await esperar(60);

  const buscador = await p.caja(BUSCADOR);
  await p.clic({ x: buscador.cx, y: buscador.cy });
  n = await pasos();
  for (const [t, m] of [[V, CTRL], [INSERT, MAYUS], [D, CTRL], [SUPR, MAYUS]]) await tecla(t, m);
  comprobar(
    "14. con el foco en el buscador, Ctrl+V no abre la previa (ni los demás atajos actúan)",
    (await previa()) === null && (await pasos()) === n && (await hojaJSON()) === docCampo,
  );
  await p.evaluar(`document.activeElement.blur()`);
  await esperar(60);

  // ── 15. Simular ──
  await camara(1, 150, 4);
  await a(150, 14);
  await tecla(F5);
  comprobar("pasa a Simular", (await modo()) === "simular");
  for (const [t, m] of [[V, CTRL], [INSERT, MAYUS], [C, CTRL], [D, CTRL], [X, CTRL]]) await tecla(t, m);
  await a(150, 15);
  comprobar("15. en Simular, Ctrl+V no abre la previa y nada cambia", (await previa()) === null && (await pasos()) === n && (await hojaJSON()) === docCampo);
  await tecla(F5);
  comprobar("vuelve a Editar", (await modo()) === "editar");

  // ── Ctrl+N con cambios: «No guardar», y el portapapeles sobrevive ──
  const recorteAntes = await guardado();
  await tecla(N, CTRL);
  await hayDialogo();
  await responder("No guardar");
  await sinDialogo();
  comprobar(
    "Ctrl+N con «No guardar»: documento vacío",
    (await p.evaluar("bornera.editor.documento.hojas[0].componentes.length")) === 0 && (await pasos()) === 0,
  );
  comprobar("el portapapeles sobrevive a Ctrl+N", (await guardado()) === recorteAntes);
  await camara(1, 0, 0);
  await a(1, 0);
  await tecla(V, CTRL);
  await a(0, 0);
  await clic(0, 0);
  const enNuevo = await hoja();
  comprobar(
    "pegar en el documento nuevo",
    (await pasos()) === 1 && enNuevo.componentes.length === 1 && enNuevo.componentes[0].etiqueta === "K9" && (await problemas()) === 0,
    JSON.stringify(enNuevo.componentes),
  );
  comprobar("sin diálogos colgados", (await p.evaluar(`document.querySelectorAll('${DIALOGO}').length`)) === 0);
  comprobar("16. sin errores de la página hasta acá", p.errores.length === 0, p.errores.join(" | "));
}
