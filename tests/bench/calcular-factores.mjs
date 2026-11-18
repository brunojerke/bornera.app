// node tests/bench/calcular-factores.mjs --pc=a.txt,b.txt --netbook=c.txt,d.txt,e.txt
// K1 y K2 (factores netbook / PC, C4; docs/plan-fase4.md) de los textos de
// «Copiar» de «Probar la fase 4»: cada archivo es el texto de una corrida, o
// un .json con un arreglo de textos (como la --salida de probar-webview2.mjs,
// de la que se toman las calientes de A). La cuenta está en factores.mjs.
// No agrega dependencias.

import { readFileSync } from "node:fs";
import { factores } from "./factores.mjs";

/** Los textos de una lista de archivos (.txt: uno; .json: un arreglo de textos, o la salida de probar-webview2.mjs). */
function leer(lista) {
  return lista
    .split(",")
    .filter(Boolean)
    .flatMap((f) => {
      if (!f.endsWith(".json")) return [readFileSync(f, "utf8")];
      const j = JSON.parse(readFileSync(f, "utf8"));
      if (Array.isArray(j)) return j;
      // La --salida de probar-webview2.mjs: las calientes de A.
      return j.aperturas.filter((a) => a.exe === "A").flatMap((a) => a.textos.slice(1));
    });
}

const op = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? "";
const r = factores(leer(op("pc")), leer(op("netbook")));
const f = (x, d = 1) => (x === null ? "—" : x.toFixed(d).replace(".", ","));
console.log("| # | K | PC | Netbook | Netbook / PC |\n|---|---|---|---|---|");
for (const x of r.filas) console.log(`| ${x.id} | ${x.grupo} | ${f(x.pc)} | ${f(x.netbook)} | ${f(x.cociente, 2)} |`);
console.log(`\nK1 (pasos sin dibujo) = ${f(r.K1, 2)} · K2 (gestos con dibujo) = ${f(r.K2, 2)}`);
