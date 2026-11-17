// T23, etapa 4: cortar Bornera y recuperar (criterio D5-A de docs/plan-fase4.md).
//
// Cortar es `Page.crash` (cdp.mjs, `cortar`): mata el proceso de la página
// sin `beforeunload` ni `pagehide`, como «Finalizar tarea». Después la misma
// pestaña vuelve a cargar la app con el mismo perfil, sin borrar IndexedDB
// (S4, verificado al planear la etapa).
//
// 1. Criterio D5-A con los relojes de verdad: la copia sale a los 10 s sin
//    comandos; se corta; al abrir, Recuperar da el documento igual campo por
//    campo, con «• » en el título y Deshacer desactivado.
// 2. Corte sin esperar: se recupera exactamente la copia anterior, sin el
//    último cambio (D2b).
// 3. Dos pestañas con el mismo perfil: B no ofrece la copia de A mientras A
//    vive; se corta A (B sigue) y A, al volver, la ofrece.
// 4. Varias copias por cortes de verdad: dos pestañas cortadas, el diálogo
//    lista dos; Descartar las dos.
//
// Nada se espera con un tiempo fijo: cada paso espera su señal (la copia
// hecha, `bornera.recuperacionLista`, el diálogo).

import { isDeepStrictEqual } from "node:util";

export const nombre = "Cortar y recuperar (T23)";

const DIALOGO = '[role="dialog"][aria-labelledby="dialogo-recuperar-titulo"]';

export default async function (p, comprobar, { cargar, url, nuevaPestana }) {
  const { serializar } = await cargar("/src/core/io/index.ts");

  const listo = (q) => q.esperarA("bornera.recuperacionLista === true && !!bornera.autoguardado", 15000);
  const documento = async (q = p) => JSON.parse(await q.evaluar("JSON.stringify(bornera.editor.documento)"));
  const copiaPropia = (q = p) => q.evaluar("bornera.respaldo.leer(bornera.idInstancia).then((l) => (l.ok ? l.texto : null))");
  const hayDialogo = (q = p) => q.evaluar(`!!document.querySelector('${DIALOGO}')`);
  const textoDialogo = () => p.evaluar(`(document.querySelector('${DIALOGO}')?.textContent ?? "").replace(/\\s+/g, " ").trim()`);
  const cumple = async (expresion, ms = 5000, q = p) => {
    try {
      await q.esperarA(expresion, ms);
      return true;
    } catch {
      return false;
    }
  };
  const boton = async (texto) => {
    const ok = await p.evaluar(
      `(() => { const b = [...document.querySelectorAll('${DIALOGO} button')].find((x) => x.textContent.trim() === ${JSON.stringify(texto)});
        if (!b) return false; b.click(); return true; })()`,
    );
    if (!ok) throw new Error(`No está el botón «${texto}» en el diálogo`);
  };
  /** Coloca una bobina con un comando (como el usuario, un paso de deshacer). */
  const colocar = (q, x, etiqueta) =>
    q.evaluar(`(() => { const { editor, comandos: c } = bornera;
      const k = c.colocar(editor.documento, { tipo: "contactor.bobina", x: ${x}, y: 0, rot: 0, espejado: false, etiqueta: ${JSON.stringify(etiqueta)}, params: {} });
      editor.ejecutar(k); return k.id; })()`);
  /** Recarga la pestaña conservando las copias y espera a que decida si hay diálogo. */
  const reabrir = async () => {
    await p.abrir(url, 1024, 600, { conservarCopias: true });
    await listo(p);
  };
  /** Recupera la única copia ofrecida y espera a que el diálogo cierre. */
  const recuperar = async () => {
    await boton("Recuperar");
    if (!(await cumple(`!document.querySelector('${DIALOGO}')`))) throw new Error("Recuperar no cerró el diálogo");
  };

  // ── 1. Criterio D5-A, con los relojes de verdad ──
  await listo(p);
  const [k1, k2] = [await colocar(p, 0, "K1"), await colocar(p, 10, "K2")];
  await p.evaluar(`(() => { const { editor, comandos: c } = bornera;
    editor.ejecutar(c.cablear(editor.documento, { desde: { tipo: "borne", comp: "${k1}", borne: "A2" },
      hasta: { tipo: "borne", comp: "${k2}", borne: "A2" }, codos: [] })); })()`);
  const ultimoComando = Date.now();
  const antes = await documento();
  comprobar("dos bobinas y un cable en el documento", antes.hojas[0].componentes.length === 2 && antes.hojas[0].cables.length === 1);
  // La copia sale sola: 10 s sin comandos (D2b-C). Sin copiarYa.
  const salio = await cumple("bornera.autoguardado.estado.hechas >= 1 && !bornera.autoguardado.copiando", 16000);
  const espera = Date.now() - ultimoComando;
  comprobar("la copia sale sola a los ~10 s sin comandos", salio && espera >= 9500 && espera <= 14000, `${espera} ms`);
  comprobar("la copia es el documento (serializar en Node)", (await copiaPropia()) === serializar(antes));
  const idCortada = await p.evaluar("bornera.idInstancia");
  const salidas = p.salidasConCambios;
  await p.cortar();
  comprobar("cortar no pasa por beforeunload", p.salidasConCambios === salidas);
  await reabrir();
  comprobar("al volver a abrir sale «Bornera no se cerró bien»", await hayDialogo());
  const t1 = await textoDialogo();
  comprobar("con «Sin título (nunca se guardó)»", t1.includes("Quedó una copia de recuperación de Sin título (nunca se guardó)"), t1);
  await recuperar();
  comprobar("lo recuperado es igual al documento de antes del corte, campo por campo", isDeepStrictEqual(await documento(), antes));
  comprobar("y su texto también (serializar en Node)", serializar(await documento()) === serializar(antes));
  const titulo = await p.evaluar("document.title");
  comprobar("el título empieza con «• »", titulo.startsWith("• "), titulo);
  comprobar("Deshacer desactivado", await p.evaluar(`document.querySelector('button[aria-label="Deshacer"]').disabled`));
  comprobar(
    "la copia propia queda escrita y la cortada se borra",
    await cumple(`bornera.respaldo.listar().then((l) => !l.some((r) => r.id === ${JSON.stringify(idCortada)}) && l.some((r) => r.id === bornera.idInstancia))`),
  );

  // ── 2. Corte sin esperar: se recupera la copia anterior, exacta ──
  await p.evaluar("bornera.autoguardado.copiarYa()");
  const copiaAnterior = await documento();
  comprobar("la copia anterior queda escrita igual al documento", (await copiaPropia()) === serializar(copiaAnterior));
  await colocar(p, 20, "K3");
  comprobar("el último cambio está en el documento", (await documento()).hojas[0].componentes.length === copiaAnterior.hojas[0].componentes.length + 1);
  comprobar("y todavía no hay copia de él", !(await p.evaluar("bornera.autoguardado.copiando")) && (await copiaPropia()) === serializar(copiaAnterior));
  await p.cortar();
  await reabrir();
  comprobar("al volver a abrir ofrece una copia", (await hayDialogo()) && (await textoDialogo()).includes("Quedó una copia"));
  await recuperar();
  comprobar("se recupera exactamente la copia anterior, sin el último cambio", isDeepStrictEqual(await documento(), copiaAnterior));

  // ── 3. Dos pestañas con el mismo perfil ──
  await p.abrir(url);
  await listo(p);
  await colocar(p, 0, "KA");
  await p.evaluar("bornera.autoguardado.copiarYa()");
  const docA = await documento();
  const idA = await p.evaluar("bornera.idInstancia");
  const b = await nuevaPestana();
  await listo(b);
  comprobar("B abre sin diálogo mientras A vive", !(await hayDialogo(b)));
  comprobar(
    "B ve el candado de A",
    await b.evaluar(`navigator.locks.query().then((q) => q.held.some((l) => l.name === "bornera-copia-" + ${JSON.stringify(idA)}))`),
  );
  await p.cortar();
  comprobar("cortar A no corta B", (await b.evaluar("1 + 1")) === 2);
  comprobar(
    "B ve que el candado de A se soltó",
    await cumple(`navigator.locks.query().then((q) => !q.held.some((l) => l.name === "bornera-copia-" + ${JSON.stringify(idA)}))`, 5000, b),
  );
  await reabrir();
  const t3 = (await hayDialogo()) ? await textoDialogo() : "";
  comprobar("A, al volver, ofrece su copia (B no tiene copia)", t3.includes("Quedó una copia"), t3);
  await recuperar();
  comprobar("y es el documento de A", isDeepStrictEqual(await documento(), docA));

  // ── 4. Varias copias por cortes de verdad ──
  await p.abrir(url);
  await listo(p);
  await colocar(p, 0, "K1");
  await p.evaluar("bornera.autoguardado.copiarYa()");
  const c = await nuevaPestana();
  await listo(c);
  await colocar(c, 30, "K7");
  await colocar(c, 40, "K8");
  await c.evaluar("bornera.autoguardado.copiarYa()");
  await c.cortar();
  await p.cortar();
  await reabrir();
  const t4 = (await hayDialogo()) ? await textoDialogo() : "";
  comprobar("dos pestañas cortadas: «Quedaron 2 copias»", t4.includes("Quedaron 2 copias de recuperación"), t4);
  // Mientras borra, el diálogo no atiende clics: se espera a que baje la cantidad de copias antes del siguiente.
  const descartar = `document.querySelectorAll('${DIALOGO} button').length`;
  for (let i = 0; i < 2; i++) {
    const botones = await p.evaluar(descartar);
    await boton("Descartar");
    if (!(await cumple(`(${descartar}) < ${botones}`))) throw new Error("Descartar no quitó la copia del diálogo");
  }
  comprobar("Descartar las dos cierra el diálogo", await cumple(`!document.querySelector('${DIALOGO}')`));
  comprobar("y no queda ninguna copia ajena", await cumple("bornera.respaldo.listar().then((l) => l.every((r) => r.id === bornera.idInstancia))"));
}
