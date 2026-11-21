// node tests/bench/r11-tramos-node.mjs: R11 en reposo (T29, D6-A) con el
// reloj real, en Node y sin navegador. Solo informa; no está en npm test.
//
// Cambio de regla (Bruno, 2026-11-21): el test de «ningún tramo pasa de
// 4 ms» con reloj real dependía de la recolección de basura (GC) de Node,
// que llega a varios ms dentro de un solo paso. En npm test queda el corte a
// los 2 ms con un reloj falso (src/editor/avisosHoja.test.ts); acá, la
// medición real: el tramo más largo y cuántos pasan de 4 ms, marcando los
// que tuvieron una GC adentro (el heap usado baja en alguno de sus pasos).
//
// Escena oficial del banco (2000 + 3030 cables): abrir, pegar unos 500 y
// duplicar todo, dejando terminar el reposo cada vez, con el código de la
// app (Vite).
//
// Opciones:
//   --veces=N   corridas, cada una con un editor nuevo (por defecto 3)
//   --json      imprime el resultado crudo en JSON
// No agrega dependencias.

import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const args = process.argv.slice(2);
const veces = Number(args.find((a) => a.startsWith("--veces="))?.split("=")[1] ?? 3);
if (!Number.isSafeInteger(veces) || veces < 1) throw new Error("--veces tiene que ser un entero mayor que 0");
const TOPE = 4;

const { createServer } = await import("vite");
const servidor = await createServer({ root: RAIZ, logLevel: "error", clearScreen: false, appType: "custom", server: { middlewareMode: true, hmr: false, watch: null } });
const corridas = [];
try {
  const { AvisosHoja } = await servidor.ssrLoadModule("/src/editor/avisosHoja.ts");
  const { Editor } = await servidor.ssrLoadModule("/src/editor/editor.ts");
  const { documentoBancoCables } = await servidor.ssrLoadModule("/src/editor/banco.ts");
  const { pegar, recortar } = await servidor.ssrLoadModule("/src/core/model/portapapeles.ts");

  // Cada paso del cálculo en reposo: si el heap usado bajó, hubo una GC adentro.
  let conGc = false;
  const real = AvisosHoja.prototype.r11EnReposo;
  AvisosHoja.prototype.r11EnReposo = function (...a) {
    const g = real.apply(this, a);
    return {
      next() {
        const h0 = process.memoryUsage().heapUsed;
        const r = g.next();
        if (process.memoryUsage().heapUsed < h0) conGc = true;
        return r;
      },
      [Symbol.iterator]() {
        return this;
      },
    };
  };

  for (let v = 0; v < veces; v++) {
    const cola = [];
    const editor = new Editor(documentoBancoCables(2000), 0, { r11: { programar: (f) => cola.push(f) } });
    const h = editor.documento.hojas[0];
    const gestos = [];
    const terminar = (gesto) => {
      const tramos = [];
      while (cola.length > 0) {
        conGc = false;
        const h0 = process.memoryUsage().heapUsed;
        const t0 = performance.now();
        cola.shift()();
        const ms = performance.now() - t0;
        tramos.push({ ms, gc: conGc || process.memoryUsage().heapUsed < h0 });
      }
      const largos = tramos.filter((t) => t.ms > TOPE);
      gestos.push({
        gesto,
        tramos: tramos.length,
        total: tramos.reduce((s, t) => s + t.ms, 0),
        maximo: Math.max(0, ...tramos.map((t) => t.ms)),
        largos: largos.length,
        largosConGc: largos.filter((t) => t.gc).length,
      });
    };
    terminar("abrir");
    const caja = editor.escena.caja;
    let n = 1;
    while (recortar(h, h.componentes.slice(0, n + 1).map((c) => c.id)).cables.length + n + 1 <= 500) n++;
    const r500 = recortar(h, h.componentes.slice(0, n).map((c) => c.id));
    editor.ejecutar(pegar(editor.documento, r500, Math.ceil(caja.ancho) + 20, 0));
    terminar(`pegar ${r500.componentes.length + r500.cables.length}`);
    const todos = recortar(h, [...h.componentes.map((c) => c.id), ...h.cables.map((w) => w.id)]);
    editor.ejecutar(pegar(editor.documento, todos, 0, Math.ceil(caja.alto) + 20));
    terminar(`duplicar todo (${todos.componentes.length + todos.cables.length})`);
    corridas.push(gestos);
  }
} finally {
  await servidor.close();
}

if (args.includes("--json")) {
  console.log(JSON.stringify(corridas, null, 2));
} else {
  const f = (x) => x.toFixed(2).replace(".", ",");
  console.log(`R11 en reposo con reloj real (Node ${process.version}), escena oficial 2000 + 3030 cables. Solo informa.`);
  console.log(`| Corrida | Gesto | Tramos | ms en total | Tramo más largo | > ${TOPE} ms | de esos, con GC |`);
  console.log("|---|---|---|---|---|---|---|");
  corridas.forEach((gestos, i) => {
    for (const g of gestos) console.log(`| ${i + 1} | ${g.gesto} | ${g.tramos} | ${f(g.total)} | ${f(g.maximo)} | ${g.largos} | ${g.largosConGc} |`);
  });
  const todos = corridas.flat();
  const largos = todos.reduce((s, g) => s + g.largos, 0);
  const conGc = todos.reduce((s, g) => s + g.largosConGc, 0);
  console.log(`\nTramo más largo: ${f(Math.max(...todos.map((g) => g.maximo)))} ms. De ${TOPE} ms para arriba: ${largos}, ${conGc} con una GC adentro y ${largos - conGc} sin.`);
}
