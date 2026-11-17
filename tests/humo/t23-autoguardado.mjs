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
// La etapa 4 suma cortar la página con CDP y recuperar.

import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Autoguardado y recuperación (T23)";

const C = ["c", "KeyC", 67];
const V = ["v", "KeyV", 86];
const RESULTADO = 'textarea[aria-label="Resultado"]';

export default async function (p, comprobar, { cargar }) {
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
}
