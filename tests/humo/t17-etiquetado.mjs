// T17: etiquetado automático en la app real a 1024×600 (plan T17, sección 4).
//
// Cada bloque arranca en un documento nuevo (Ctrl+N), así los números no
// dependen del bloque anterior:
//  1. Colocar desde la paleta: dos bobinas seguidas en modo clic dan K1 y K2
//     (previa y resultado), tres pulsadores S1, S2 y S0 (el NC, desde S0:
//     T27); borrar K1 y colocar
//     otra bobina da K1; el auxiliar entra vacío; Fase y Neutro entran L y N.
//     Cada colocación es un paso.
//  2. La rama de K1 (S1, auxiliar K1, bobina K1, H1) con Ctrl+D: S2, K2, K2 y
//     H2 en un paso; Ctrl+Z y Ctrl+Y exactos; Ctrl+X y pegar en otro lado
//     conserva.
//  3. Panel: renombrar la bobina K2 a K5 arrastra al contacto («1 contacto
//     pasó a K5.») y un Ctrl+Z vuelve los dos; a vacío no arrastra (nota
//     nueva_vacia); una etiqueta repetida escrita a mano se acepta con nota;
//     dos Fase L no muestran nota.
//  4. "Etiquetar los vacíos": con vacíos, un paso en orden (y, x) que deja
//     vacío el auxiliar; Ctrl+Z en un paso; sin vacíos, el aviso y ningún
//     paso; en Simular, el botón deshabilitado.
// Al final, validarHoja en 0 y sin errores de la página.

import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Etiquetado automático";

const N = ["n", "KeyN", 78];
const D = ["d", "KeyD", 68];
const X = ["x", "KeyX", 88];
const V = ["v", "KeyV", 86];
const Z = ["z", "KeyZ", 90];
const Y = ["y", "KeyY", 89];
const ENTER = ["Enter", "Enter", 13];
const SUPR = ["Delete", "Delete", 46];
const F5 = ["F5", "F5", 116];
const CAMPO = "#prop-etiqueta";
const NOTAS = "#prop-etiqueta-nota";
const DIALOGO = '[role="dialog"][aria-modal="true"]';
const ETIQUETAR_VACIOS = "Etiquetar los vacíos";
const AVISO_SIN_VACIOS = "No hay componentes sin etiqueta.";

export default async function (p, comprobar) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods);
  const hojaJSON = () => p.evaluar("JSON.stringify(bornera.editor.documento.hojas)");
  const hoja = () => p.evaluar("JSON.parse(JSON.stringify(bornera.editor.documento.hojas[0]))");
  const pasos = () => p.evaluar("bornera.editor.historial.hechos.length");
  const problemas = () => p.evaluar("bornera.cables.validarHoja(bornera.editor.documento.hojas[0]).length");
  const etiqueta = (id) => p.evaluar(`bornera.editor.documento.hojas[0].componentes.find((c) => c.id === ${JSON.stringify(id)})?.etiqueta ?? null`);
  const herramienta = () => p.evaluar("bornera.editor.herramienta === null ? null : bornera.editor.herramienta.constructor.name");
  /** La etiqueta que la previa de Colocar va a dar (null si no hay herramienta de colocar). */
  const etiquetaPrevia = () => p.evaluar("bornera.editor.herramienta?.etiqueta ?? null");
  const notas = () => p.evaluar(`[...document.querySelectorAll("${NOTAS} .nota")].map((e) => e.textContent.trim())`);
  const aviso = () => p.evaluar(`document.querySelector(".avisos")?.textContent.trim() ?? ""`);
  const modo = () => p.evaluar(`document.querySelector(".modo button.simular").getAttribute("aria-pressed") === "true" ? "simular" : "editar"`);
  const seleccionar = (ids) => p.evaluar(`bornera.editor.seleccionarIds(${JSON.stringify(ids)})`);
  const colocar = (tipo, x, y, etiqueta) =>
    p.evaluar(`(() => { const { editor, comandos: c } = bornera;
      const cmd = c.colocar(editor.documento, { tipo: "${tipo}", x: ${x}, y: ${y}, rot: 0, espejado: false, etiqueta: ${JSON.stringify(etiqueta)}, params: {} });
      editor.ejecutar(cmd); return cmd.id; })()`);
  const camara = async (zoom, gx, gy) => {
    await p.evaluar(`(() => { const cv = document.querySelector("canvas[aria-label^=Lienzo]"); const v = bornera.editor.vista;
      v.camara.zoom = ${zoom}; v.camara.centrar(${gx}, ${gy}, cv.clientWidth, cv.clientHeight); v.invalidarContenido(); })()`);
    await esperar(60);
  };
  const a = async (gx, gy) => {
    const q = await p.punto(gx, gy);
    await p.mouse("mouseMoved", q.x, q.y);
    await esperar(30);
  };
  const clic = async (gx, gy) => {
    await p.clic(await p.punto(gx, gy));
    await esperar(30);
  };
  /** Ctrl+N; si hay cambios, «No guardar». Documento vacío y sin historial. */
  const nuevo = async () => {
    await tecla(N, CTRL);
    if (await p.esperarA(`!!document.querySelector('${DIALOGO}')`, 1500).then(() => true, () => false)) {
      const k = await p.evaluar(`(() => { const b = [...document.querySelectorAll('${DIALOGO} button')].find((x) => x.textContent.trim() === "No guardar");
        if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!k) throw new Error("No está el botón «No guardar» en el diálogo.");
      await p.clic(k);
      await p.esperarA(`!document.querySelector('${DIALOGO}')`, 5000);
    }
    await p.esperarA("bornera.editor.documento.hojas[0].componentes.length === 0 && bornera.editor.historial.hechos.length === 0", 5000);
    await esperar(100);
  };
  /** Un botón por su texto: su centro y si está deshabilitado (null si no está). */
  const boton = (texto) =>
    p.evaluar(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(texto)});
      if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, deshabilitado: b.disabled }; })()`);
  const itemPaleta = (nombreItem) =>
    p.evaluar(`(() => { const e = [...document.querySelectorAll(".item")].find((x) => x.textContent.trim() === ${JSON.stringify(nombreItem)});
      if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  /** Clic en la paleta: deja la herramienta en modo clic. */
  const elegir = async (nombreItem) => {
    const item = await itemPaleta(nombreItem);
    if (!item) throw new Error(`No está «${nombreItem}» en la paleta.`);
    await p.clic(item);
    await esperar(30);
  };
  /** Selecciona un componente con clic y escribe su etiqueta en el panel con Enter. */
  const escribirEtiqueta = async (id, texto) => {
    await seleccionar([id]);
    await p.esperarA(`!!document.querySelector("${CAMPO}")`, 5000);
    await esperar(150);
    const k = await p.caja(CAMPO);
    await p.clic({ x: k.cx, y: k.cy });
    await p.evaluar(`document.querySelector("${CAMPO}").select()`);
    if (texto === "") await tecla(SUPR);
    else await p.cdp("Input.insertText", { text: texto });
    await tecla(ENTER);
    await esperar(60);
  };
  const componentes = async () => (await hoja()).componentes;
  const porId = (lista) => Object.fromEntries(lista.map((c) => [c.id, c.etiqueta]));

  // Al 60 % entra todo el bloque 1 (x 0..12, y 0..16), aun con el panel abierto.
  await camara(0.6, 6, 8);

  // ── 1. Colocar desde la paleta ──
  // Dos bobinas seguidas en modo clic: la previa dice K1, el clic da K1; la previa pasa a K2 y el clic da K2.
  await elegir("Bobina de contactor");
  await a(0, 0);
  const previa1 = await etiquetaPrevia();
  let n = await pasos();
  await clic(0, 0);
  await a(6, 0);
  const previa2 = await etiquetaPrevia();
  await clic(6, 0);
  await p.esc();
  let cs = await componentes();
  const b1 = cs[0];
  const b2 = cs[1];
  comprobar(
    "dos bobinas seguidas en modo clic: la previa dice K1 y K2, y quedan K1 y K2, un paso cada una",
    previa1 === "K1" && previa2 === "K2" && b1?.etiqueta === "K1" && b2?.etiqueta === "K2" && (await pasos()) === n + 2,
    JSON.stringify({ previa1, previa2, etiquetas: cs.map((c) => c.etiqueta), pasos: (await pasos()) - n }),
  );
  await p.captura("previa-k2");

  // Tres pulsadores: NA, NC y NA comparten la S.
  await elegir("Pulsador NA");
  await clic(0, 8);
  await clic(6, 8);
  await p.esc();
  await elegir("Pulsador NC");
  await clic(12, 8);
  await p.esc();
  cs = await componentes();
  comprobar(
    "tres pulsadores (NA, NA, NC): S1, S2 y S0 (T27)",
    JSON.stringify(cs.slice(2).map((c) => c.etiqueta)) === JSON.stringify(["S1", "S2", "S0"]),
    JSON.stringify(cs.map((c) => c.etiqueta)),
  );

  // Ctrl+Z deshace una colocación en un paso.
  n = await pasos();
  await tecla(Z, CTRL);
  comprobar("Ctrl+Z deshace la última colocación (S0) en un paso", (await pasos()) === n - 1 && (await componentes()).length === 4);
  await tecla(Y, CTRL);
  comprobar("Ctrl+Y la rehace con la misma etiqueta", (await pasos()) === n && (await componentes())[4]?.etiqueta === "S0");

  // Borrar K1 y colocar otra bobina: rellena el hueco.
  await seleccionar([b1.id]);
  await tecla(SUPR);
  // Seleccionar abre el panel y achica el lienzo: la cámara se vuelve a centrar.
  await esperar(150);
  await camara(0.6, 6, 8);
  await elegir("Bobina de contactor");
  await a(12, 0);
  const previaHueco = await etiquetaPrevia();
  await clic(12, 0);
  await p.esc();
  cs = await componentes();
  const b3 = cs.find((c) => c.x === 12 && c.y === 0);
  comprobar("borrar K1 y colocar otra bobina: K1 (previa y resultado)", previaHueco === "K1" && b3?.etiqueta === "K1", JSON.stringify({ previaHueco, b3 }));

  // El auxiliar entra vacío; Fase y Neutro como L y N.
  await elegir("Contacto auxiliar NA");
  await a(0, 16);
  const previaAux = await etiquetaPrevia();
  await clic(0, 16);
  await p.esc();
  await elegir("Fase (L)");
  await clic(6, 16);
  await p.esc();
  await elegir("Neutro (N)");
  await clic(12, 16);
  await p.esc();
  cs = await componentes();
  const fila = (y) => cs.filter((c) => c.y === y).sort((u, v) => u.x - v.x);
  comprobar(
    "el auxiliar entra vacío (también en la previa); Fase y Neutro entran L y N",
    previaAux === "" && JSON.stringify(fila(16).map((c) => [c.tipo, c.etiqueta])) ===
      JSON.stringify([["contactor.auxiliar_na", ""], ["fuente.fase", "L"], ["fuente.neutro", "N"]]),
    JSON.stringify({ previaAux, fila: fila(16).map((c) => [c.tipo, c.etiqueta]) }),
  );
  comprobar("bloque 1: validarHoja en 0", (await problemas()) === 0);

  // ── 2. La rama de K1: Ctrl+D, Ctrl+Z, Ctrl+Y, Ctrl+X y pegar ──
  await nuevo();
  const rama = [
    await colocar("pulsador.na", 0, 0, "S1"),
    await colocar("contactor.auxiliar_na", 4, 0, "K1"),
    await colocar("contactor.bobina", 0, 6, "K1"),
    await colocar("senalizacion.lampara", 4, 6, "H1"),
  ];
  await seleccionar([]);
  await esperar(150);
  await camara(1, 6, 3);
  await seleccionar(rama);
  const antesDup = await hoja();
  const docAntesDup = await hojaJSON();
  n = await pasos();
  await tecla(D, CTRL);
  const despuesDup = await hoja();
  const copia = despuesDup.componentes.filter((c) => !rama.includes(c.id)).sort((u, v) => u.y - v.y || u.x - v.x);
  comprobar(
    "Ctrl+D de la rama de K1: S2, K2 (auxiliar), K2 (bobina) y H2 en un paso",
    (await pasos()) === n + 1 &&
      JSON.stringify(copia.map((c) => [c.tipo, c.etiqueta])) ===
        JSON.stringify([["pulsador.na", "S2"], ["contactor.auxiliar_na", "K2"], ["contactor.bobina", "K2"], ["senalizacion.lampara", "H2"]]) &&
      JSON.stringify(antesDup.componentes.map((c) => c.etiqueta)) === JSON.stringify(despuesDup.componentes.filter((c) => rama.includes(c.id)).map((c) => c.etiqueta)),
    JSON.stringify(copia.map((c) => [c.tipo, c.etiqueta])),
  );
  const docDup = await hojaJSON();
  await tecla(Z, CTRL);
  comprobar("Ctrl+Z deshace el duplicado exacto, en un paso", (await hojaJSON()) === docAntesDup && (await pasos()) === n);
  await tecla(Y, CTRL);
  comprobar("Ctrl+Y lo rehace exacto (mismas ids y etiquetas)", (await hojaJSON()) === docDup && (await pasos()) === n + 1);
  await p.captura("duplicar-rama");

  // Ctrl+X de la copia y pegar en otro lado: conserva S2, K2, K2 y H2.
  const idsCopia = copia.map((c) => c.id);
  await seleccionar(idsCopia);
  await tecla(X, CTRL);
  await camara(1, 2, 24);
  await a(2, 24);
  await tecla(V, CTRL);
  await a(2, 25);
  await a(2, 24);
  n = await pasos();
  const antesPegar = await hoja();
  await clic(2, 24);
  const pegado = (await hoja()).componentes.filter((c) => !antesPegar.componentes.some((x) => x.id === c.id)).sort((u, v) => u.y - v.y || u.x - v.x);
  comprobar(
    "Ctrl+X y pegar en otro lado: las mismas etiquetas (S2, K2, K2 y H2), en un paso",
    (await pasos()) === n + 1 && JSON.stringify(pegado.map((c) => c.etiqueta)) === JSON.stringify(["S2", "K2", "K2", "H2"]) && (await problemas()) === 0,
    JSON.stringify(pegado.map((c) => c.etiqueta)),
  );

  // ── 3. Panel: renombrar con arrastre, a vacío y la nota de repetida ──
  const bobinaK2 = pegado.find((c) => c.tipo === "contactor.bobina");
  const auxK2 = pegado.find((c) => c.tipo === "contactor.auxiliar_na");
  await p.esc();
  let docAntes = await hojaJSON();
  n = await pasos();
  await escribirEtiqueta(bobinaK2.id, "K5");
  const notaArrastre = await notas();
  comprobar(
    "renombrar la bobina K2 a K5 en el panel: su contacto pasa a K5, en un paso, con «1 contacto pasó a K5.»",
    (await etiqueta(bobinaK2.id)) === "K5" && (await etiqueta(auxK2.id)) === "K5" && (await pasos()) === n + 1 && notaArrastre.includes("1 contacto pasó a K5."),
    JSON.stringify({ bobina: await etiqueta(bobinaK2.id), aux: await etiqueta(auxK2.id), notas: notaArrastre, pasos: (await pasos()) - n }),
  );
  await p.captura("nota-arrastre");
  await p.evaluar(`document.activeElement?.blur()`);
  await tecla(Z, CTRL);
  comprobar("un Ctrl+Z vuelve la bobina y el contacto a K2", (await hojaJSON()) === docAntes && (await pasos()) === n);

  // A vacío: no arrastra.
  await escribirEtiqueta(bobinaK2.id, "");
  const notaVacia = await notas();
  comprobar(
    "renombrar la bobina K2 a vacío: el contacto sigue K2, en un paso, con la nota",
    (await etiqueta(bobinaK2.id)) === "" && (await etiqueta(auxK2.id)) === "K2" && (await pasos()) === n + 1 &&
      notaVacia.includes("La bobina quedó sin etiqueta; los contactos siguen como K2."),
    JSON.stringify({ bobina: await etiqueta(bobinaK2.id), aux: await etiqueta(auxK2.id), notas: notaVacia }),
  );
  await p.evaluar(`document.activeElement?.blur()`);
  await tecla(Z, CTRL);
  comprobar("Ctrl+Z vuelve la bobina a K2 en un paso", (await hojaJSON()) === docAntes && (await pasos()) === n);

  // Repetida a mano: la lámpara H2 pasa a H1; se acepta y aparece la nota.
  const lamparaH2 = pegado.find((c) => c.tipo === "senalizacion.lampara");
  await escribirEtiqueta(lamparaH2.id, "H1");
  const notaRepetida = await notas();
  comprobar(
    "escribir a mano H1 (repetida) en la lámpara: se acepta en un paso, con «Otra lámpara ya se llama H1.»",
    (await etiqueta(lamparaH2.id)) === "H1" && (await pasos()) === n + 1 && notaRepetida.includes("Otra lámpara ya se llama H1."),
    JSON.stringify({ etiqueta: await etiqueta(lamparaH2.id), notas: notaRepetida }),
  );
  await p.captura("nota-repetida");
  await p.evaluar(`document.activeElement?.blur()`);
  await tecla(Z, CTRL);
  comprobar("Ctrl+Z vuelve la lámpara a H2 en un paso", (await etiqueta(lamparaH2.id)) === "H2" && (await pasos()) === n);

  // Dos Fase L: sin nota de repetida (es la misma red).
  const fase1 = await colocar("fuente.fase", 12, 0, "L");
  const fase2 = await colocar("fuente.fase", 16, 0, "L");
  await seleccionar([fase2]);
  await p.esperarA(`!!document.querySelector("${CAMPO}")`, 5000);
  await esperar(150);
  const notasFase = await notas();
  comprobar("dos Fase L: la segunda no muestra nota de repetida", !notasFase.some((t) => /ya se llama/.test(t)), JSON.stringify(notasFase));
  comprobar("bloque 3: validarHoja en 0", (await problemas()) === 0 && !!fase1);

  // ── 4. "Etiquetar los vacíos" ──
  await nuevo();
  // Titulares vacíos fuera de orden de creación: el orden lo da (y, x). Más un auxiliar vacío y una Fase.
  const v = {
    lampara: await colocar("senalizacion.lampara", 8, 6, ""),
    bobinaAbajo: await colocar("contactor.bobina", 4, 6, ""),
    bobinaArriba: await colocar("contactor.bobina", 8, 0, ""),
    pulsador: await colocar("pulsador.nc", 0, 0, ""),
    k1: await colocar("contactor.bobina", 0, 6, "K1"),
    aux: await colocar("contactor.auxiliar_na", 4, 0, ""),
    fase: await colocar("fuente.fase", 12, 0, "L"),
  };
  await seleccionar([]);
  await esperar(150);
  await camara(1, 6, 3);
  let b = await boton(ETIQUETAR_VACIOS);
  comprobar("sin selección, el panel muestra «Etiquetar los vacíos» habilitado", b !== null && !b.deshabilitado, JSON.stringify(b));
  docAntes = await hojaJSON();
  n = await pasos();
  await p.clic(b);
  await esperar(60);
  const tras = porId(await componentes());
  comprobar(
    "«Etiquetar los vacíos»: un paso, en orden (y, x): S0 (el NC), K2 arriba, K3 y H1 abajo; K1 conserva",
    (await pasos()) === n + 1 &&
      tras[v.pulsador] === "S0" && tras[v.bobinaArriba] === "K2" && tras[v.bobinaAbajo] === "K3" && tras[v.lampara] === "H1" && tras[v.k1] === "K1",
    JSON.stringify(tras),
  );
  comprobar("el contacto auxiliar queda vacío y la Fase sigue L", tras[v.aux] === "" && tras[v.fase] === "L", JSON.stringify(tras));
  await p.captura("etiquetar-vacios");
  await tecla(Z, CTRL);
  comprobar("Ctrl+Z deshace «Etiquetar los vacíos» en un paso", (await hojaJSON()) === docAntes && (await pasos()) === n);
  await tecla(Y, CTRL);
  comprobar("Ctrl+Y lo rehace", JSON.stringify(porId(await componentes())) === JSON.stringify(tras) && (await pasos()) === n + 1);

  // Sin vacíos: el aviso y ningún paso.
  const docLleno = await hojaJSON();
  n = await pasos();
  b = await boton(ETIQUETAR_VACIOS);
  await p.clic(b);
  await esperar(60);
  comprobar(
    "sin vacíos: avisa «No hay componentes sin etiqueta.» y no da ningún paso",
    (await aviso()).includes(AVISO_SIN_VACIOS) && (await pasos()) === n && (await hojaJSON()) === docLleno,
    await aviso(),
  );

  // En Simular, deshabilitado.
  await a(6, 12);
  await tecla(F5);
  comprobar("pasa a Simular", (await modo()) === "simular");
  b = await boton(ETIQUETAR_VACIOS);
  comprobar("en Simular, «Etiquetar los vacíos» está deshabilitado", b !== null && b.deshabilitado, JSON.stringify(b));
  await tecla(F5);
  comprobar("vuelve a Editar", (await modo()) === "editar");

  comprobar("al final: validarHoja en 0", (await problemas()) === 0);
  comprobar("sin herramienta colgada", (await herramienta()) === null, await herramienta());
  comprobar("sin errores de la página hasta acá", p.errores.length === 0, p.errores.join(" | "));
}
