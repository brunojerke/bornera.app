// T23: autoguardado y recuperación (docs/plan-T23.md).
//
// Etapa 1 (lo que se ve en el navegador antes del diálogo de recuperar):
// - Al abrir no hay copia propia; con un cambio, el reloj queda armado.
// - La copia es igual al documento: el texto unido de los trozos se compara
//   en Node con `serializar` (D10-A de T15).
// - D1: no sale durante un arrastre ni con la previa de pegar abierta; sale
//   al soltar o con Esc, con lo último del documento.
// - «Copias de recuperación» la muestra como de esta instancia.
// - Guardar (la marca de guardado) la borra.
// - «Medir la copia (F1)» anda con IndexedDB de verdad y relee igual.
//
// Etapa 2, el diálogo «Bornera no se cerró bien» (con copias sembradas sin
// dueño): Recuperar (igual, «• » y el nombre original, sin deshacer, la
// propia queda escrita y la recuperada se borra), «Sin título (nunca se
// guardó)», Descartar no vuelve, Esc pregunta otra vez, varias copias, y una
// copia que no abre (problemas, Exportar tal cual, Descartar).
//
// La etapa 4 suma cortar la página con CDP y recuperar.

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Autoguardado y recuperación (T23)";

const C = ["c", "KeyC", 67];
const V = ["v", "KeyV", 86];
const RESULTADO = 'textarea[aria-label="Resultado"]';

export default async function (p, comprobar, { cargar, url }) {
  const { serializar } = await cargar("/src/core/io/index.ts");
  await p.esperarA("!!bornera.autoguardado", 10000);

  const copia = () => p.evaluar("bornera.respaldo.leer(bornera.idInstancia).then((l) => (l.ok ? l.texto : null))");
  const documento = async () => JSON.parse(await p.evaluar("JSON.stringify(bornera.editor.documento)"));
  const hechas = () => p.evaluar("bornera.autoguardado.estado.hechas");
  const igualAlDocumento = async () => {
    const t = await copia();
    return t !== null && t === serializar(await documento());
  };
  const menu = async (texto) => {
    await p.evaluar(`document.querySelector('button[aria-label="Menú de desarrollo"]').click()`);
    await esperar(50);
    const ok = await p.evaluar(
      `(() => { const b = [...document.querySelectorAll('[role="menuitem"]')].find((x) => x.textContent.includes(${JSON.stringify(texto)})); if (!b) return false; b.click(); return true; })()`,
    );
    if (!ok) throw new Error(`No está «${texto}» en el menú de desarrollo`);
  };
  const resultado = async (hasta) => {
    await p.esperarA(`(document.querySelector('${RESULTADO}')?.value ?? "").includes(${JSON.stringify(hasta)})`, 30000);
    const t = await p.evaluar(`document.querySelector('${RESULTADO}').value`);
    await p.esc();
    return t;
  };

  comprobar("al abrir no hay copia propia ni reloj", (await copia()) === null && !(await p.evaluar("bornera.autoguardado.esperando")));

  // Dos bobinas, con la vista centrada en (5, 0) al 100 %.
  await p.evaluar(`(() => {
    const { editor, comandos: c } = bornera;
    for (const [x, etiqueta] of [[0, "K1"], [10, "K2"]]) {
      editor.ejecutar(c.colocar(editor.documento, { tipo: "contactor.bobina", x, y: 0, rot: 0, espejado: false, etiqueta, params: {} }));
    }
    const cv = document.querySelector("canvas");
    editor.vista.camara.zoom = 1;
    editor.vista.camara.centrar(5, 0, cv.clientWidth, cv.clientHeight);
    editor.vista.invalidar();
  })()`);
  await esperar(100);
  comprobar("con un cambio, el reloj de la copia queda armado", await p.evaluar("bornera.autoguardado.esperando"));
  await p.evaluar("bornera.autoguardado.copiarYa()");
  comprobar("la copia es igual al documento (serializar en Node)", await igualAlDocumento());

  // «Copias de recuperación»: la de esta instancia.
  await menu("Copias de recuperación");
  const lista = await resultado("Esta instancia");
  const idCorto = (await p.evaluar("bornera.idInstancia")).slice(0, 8);
  comprobar("«Copias de recuperación» la muestra como de esta instancia y que abre", lista.includes(`| ${idCorto} | esta instancia |`) && /\| sí \|/.test(lista), lista);

  // D1, un arrastre a medias: la copia espera.
  const antes = await hechas();
  const a = await p.punto(0, 0);
  const b = await p.punto(4, 3);
  await p.mouse("mouseMoved", a.x, a.y);
  await p.mouse("mousePressed", a.x, a.y);
  for (let i = 1; i <= 5; i++) await p.mouse("mouseMoved", a.x + ((b.x - a.x) * i) / 5, a.y + ((b.y - a.y) * i) / 5, { botones: 1 });
  await p.evaluar("void bornera.autoguardado.copiarYa()");
  await esperar(1500);
  comprobar("durante un arrastre no sale la copia", (await hechas()) === antes, `hechas ${await hechas()}`);
  await p.mouse("mouseReleased", b.x, b.y);
  await p.esperarA(`bornera.autoguardado.estado.hechas > ${antes} && !bornera.autoguardado.copiando`, 5000);
  comprobar("al soltar sale, con el arrastre incluido", await igualAlDocumento());

  // D1, la previa de pegar abierta: la copia espera hasta Esc.
  await p.clic(await p.punto(10, 0));
  await p.tecla(...C, CTRL);
  await p.tecla(...V, CTRL);
  comprobar("Ctrl+V abre la previa de pegar", await p.evaluar("bornera.editor.pegando !== null"));
  const antes2 = await hechas();
  await p.evaluar("void bornera.autoguardado.copiarYa()");
  await esperar(1500);
  comprobar("con la previa de pegar abierta no sale la copia", (await hechas()) === antes2, `hechas ${await hechas()}`);
  await p.esc();
  await p.esperarA(`bornera.autoguardado.estado.hechas > ${antes2} && !bornera.autoguardado.copiando`, 5000);
  comprobar("con Esc sale", await igualAlDocumento());

  // Guardar: la marca de guardado deja el documento sin cambios y la copia se borra.
  await p.evaluar("bornera.editor.marcarGuardado(bornera.editor.tomarMarca())");
  await p.esperarA("bornera.respaldo.leer(bornera.idInstancia).then((l) => !l.ok)", 5000);
  comprobar("guardar borra la copia propia", (await copia()) === null && !(await p.evaluar("bornera.autoguardado.estado.hayCopia")));

  // «Medir la copia (F1)», con IndexedDB de verdad.
  await menu("Medir la copia (F1)");
  const f1 = await resultado("Paso más largo por copia");
  comprobar("«Medir la copia (F1)» mide por partes y relee igual", f1.includes("F1 = ") && f1.includes("es igual a serializar"), f1.split("\n").slice(-4).join(" | "));
  // En la base cruda: `listar` ya saltea las mediciones, así que no alcanza.
  const quedan = await p.evaluar(`new Promise((r) => {
    const q = indexedDB.open("bornera");
    q.onsuccess = () => {
      const db = q.result;
      const tx = db.transaction(["copias", "trozos"]);
      const copias = tx.objectStore("copias").getAllKeys();
      const trozos = tx.objectStore("trozos").getAllKeys();
      tx.oncomplete = () => {
        db.close();
        r([...copias.result, ...trozos.result.map((k) => k[0])].filter((id) => String(id).startsWith("medicion-")).length);
      };
    };
  })`);
  comprobar("la medición no deja registros ni trozos en la base", quedan === 0, `quedan ${quedan}`);

  await dialogoRecuperar(p, comprobar, { cargar, url, serializar, documento });
}

/**
 * Etapa 2: el diálogo «Bornera no se cerró bien». Cada caso arranca limpio,
 * siembra copias sin dueño (ids sin candado, como las de una instancia que se
 * cortó) y recarga conservándolas.
 */
async function dialogoRecuperar(p, comprobar, { cargar, url, serializar, documento }) {
  const DIALOGO = '[role="dialog"][aria-labelledby="dialogo-recuperar-titulo"]';
  const hayDialogo = () => p.evaluar(`!!document.querySelector('${DIALOGO}')`);
  const textoDialogo = () => p.evaluar(`(document.querySelector('${DIALOGO}')?.textContent ?? "").replace(/\\s+/g, " ").trim()`);
  const cumple = async (expresion, ms = 5000) => {
    try {
      await p.esperarA(expresion, ms);
      return true;
    } catch {
      return false;
    }
  };
  const boton = async (texto, n = 0) => {
    const ok = await p.evaluar(
      `(() => { const b = [...document.querySelectorAll('${DIALOGO} button')].filter((x) => x.textContent.trim() === ${JSON.stringify(texto)})[${n}];
        if (!b) return false; b.click(); return true; })()`,
    );
    if (!ok) throw new Error(`No está el botón «${texto}» en el diálogo`);
    await esperar(150);
  };
  /** Una copia completa de otra instancia (sin candado: sin dueño). */
  const sembrar = (id, texto, { nombre = null, fecha = Date.now(), componentes = 2 } = {}) =>
    p.evaluar(`(async () => {
      const a = bornera.respaldo;
      await a.escribirTrozo({ id: ${JSON.stringify(id)}, generacion: 1, n: 0, texto: ${JSON.stringify(texto)} });
      await a.completar({ id: ${JSON.stringify(id)}, esquema: 1, generacion: 1, trozos: 1, caracteres: ${texto.length},
        archivo: ${nombre ? JSON.stringify({ nombre, ruta: null }) : "null"}, titulo: "Sin título", componentes: ${componentes},
        fecha: ${fecha}, version: "humo" });
    })()`);
  const limpio = async () => {
    await p.abrir(url);
    await p.esperarA("!!bornera.autoguardado", 10000);
  };
  const recargar = async () => {
    await p.abrir(url, 1024, 600, { conservarCopias: true });
    await p.esperarA("!!bornera.autoguardado", 10000);
  };
  const barra = () => p.evaluar("document.body.innerText");

  const { documentosDePrueba } = await cargar("/src/core/io/prueba-documentos.ts");
  const [, ref] = documentosDePrueba().find(([n]) => n.startsWith("marcha-parada"));
  const textoRef = serializar(ref);

  // Una copia: Recuperar.
  await limpio();
  await sembrar("muerta-a", textoRef, { nombre: "marcha.brn" });
  await recargar();
  comprobar("al arrancar con una copia sin dueño sale el diálogo", await cumple(`!!document.querySelector('${DIALOGO}')`));
  const ta = await textoDialogo();
  comprobar(
    "«Bornera no se cerró bien», con el nombre y la hora",
    ta.includes("Bornera no se cerró bien") && ta.includes("Quedó una copia de recuperación de marcha.brn, de hoy a las") && ta.includes("Esc: decidir la próxima vez"),
    ta,
  );
  comprobar("con el diálogo abierto, Ctrl+N no hace nada (es modal)", await p.evaluar(`!!document.querySelector('[aria-modal="true"]')`));
  await boton("Recuperar");
  comprobar("Recuperar cierra el diálogo", await cumple(`!document.querySelector('${DIALOGO}')`));
  comprobar("lo recuperado es igual a la copia (serializar en Node)", serializar(await documento()) === textoRef);
  comprobar("el título lleva «• » y el nombre original", (await p.evaluar("document.title")) === "• marcha.brn — Bornera", await p.evaluar("document.title"));
  comprobar("Deshacer desactivado: el historial vacío", !(await p.evaluar("bornera.editor.puedeDeshacer")) && (await p.evaluar("bornera.editor.modificado")));
  comprobar("aviso «Recuperado»", await cumple(`document.body.innerText.includes("Recuperado")`));
  comprobar(
    "la copia propia queda escrita y la recuperada se borra",
    await cumple(`bornera.respaldo.listar().then((l) => !l.some((r) => r.id === "muerta-a") && l.some((r) => r.id === bornera.idInstancia))`),
  );

  // Sin archivo, Descartar: no vuelve.
  await limpio();
  await sembrar("muerta-b", textoRef);
  await recargar();
  await cumple(`!!document.querySelector('${DIALOGO}')`);
  const tb = await textoDialogo();
  comprobar("sin archivo: «Sin título (nunca se guardó)»", tb.includes("Sin título (nunca se guardó)"), tb);
  await boton("Descartar");
  comprobar("Descartar cierra el diálogo y avisa «Copia descartada»", !(await hayDialogo()) && (await barra()).includes("Copia descartada"));
  await recargar();
  await esperar(800);
  comprobar("descartada, no vuelve a preguntar", !(await hayDialogo()));

  // Esc: decide la próxima vez.
  await limpio();
  await sembrar("muerta-c", textoRef);
  await recargar();
  await cumple(`!!document.querySelector('${DIALOGO}')`);
  await p.esc();
  comprobar("Esc cierra el diálogo sin decidir", !(await hayDialogo()));
  await recargar();
  comprobar("y al volver a arrancar pregunta otra vez", await cumple(`!!document.querySelector('${DIALOGO}')`));

  // Varias copias: una fila por copia, la más nueva primero.
  await limpio();
  await sembrar("vieja", textoRef, { nombre: "vieja.brn", fecha: Date.now() - 60_000 });
  await sembrar("nueva", textoRef, { nombre: "nueva.brn", fecha: Date.now() });
  await recargar();
  await cumple(`!!document.querySelector('${DIALOGO}')`);
  const td = await textoDialogo();
  comprobar(
    "varias: «Quedaron 2 copias», la más nueva primero",
    td.includes("Quedaron 2 copias de recuperación") && td.indexOf("nueva.brn") < td.indexOf("vieja.brn"),
    td,
  );
  await boton("Recuperar", 1);
  comprobar(
    "Recuperar una cierra el diálogo y abre esa",
    (await cumple(`!document.querySelector('${DIALOGO}')`)) && (await p.evaluar("document.title")) === "• vieja.brn — Bornera",
  );
  await recargar();
  await cumple(`!!document.querySelector('${DIALOGO}')`);
  comprobar("la otra queda para el próximo arranque", (await textoDialogo()).includes("nueva.brn"));

  // Una copia que no abre: los problemas, Exportar tal cual y Descartar.
  await limpio();
  await sembrar("rota", "{roto", { nombre: "rota.brn" });
  await recargar();
  await cumple(`!!document.querySelector('${DIALOGO}')`);
  await boton("Recuperar");
  const te = await textoDialogo();
  comprobar("una copia que no abre: «No se pudo recuperar» con los problemas", te.includes("No se pudo recuperar") && te.includes("rota.brn") && te.includes("no abre:"), te);
  const carpeta = mkdtempSync(join(tmpdir(), "bornera-t23-"));
  try {
    await p.descargasEn(carpeta);
    await boton("Exportar tal cual…");
    const nombre = "rota (copia de recuperación).brn.json";
    let escrito = null;
    for (let i = 0; i < 50 && escrito === null; i++) {
      await esperar(100);
      if (readdirSync(carpeta).includes(nombre)) escrito = readFileSync(join(carpeta, nombre), "utf8");
    }
    comprobar("Exportar tal cual escribe el texto crudo, sin validar", escrito === "{roto", String(escrito));
  } finally {
    await p.descargasEn(null);
    rmSync(carpeta, { recursive: true, force: true });
  }
  await boton("Descartar");
  comprobar("Descartar la copia rota cierra el diálogo", !(await hayDialogo()));
  await limpio();
}
