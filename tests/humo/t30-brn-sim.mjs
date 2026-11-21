// T30: los cuatro `.brn` de la simulación (tests/circuitos: oscilante, corto,
// carrera y cadena) abren en la app real a 1024×600 sin errores, así en T32 se
// podrá entrar a Simular con ellos (D4-A). El motor todavía no está en la app:
// F5 entra a la cáscara de Simular y vuelve, sin «•».

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Archivos de la simulación";

const O = ["o", "KeyO", 79];
const F5 = ["F5", "F5", 116];
const CIRCUITOS = resolve(dirname(fileURLToPath(import.meta.url)), "../circuitos");

/** Componentes y cables de cada archivo (los de `src/core/circuitos/sim.ts`). */
const ARCHIVOS = [
  ["oscilante", 4, 3],
  ["corto", 6, 4],
  ["carrera", 8, 7],
  ["cadena", 20, 15],
];

export default async function (p, comprobar) {
  await p.interceptarSelector();
  try {
    await probar(p, comprobar);
  } finally {
    await p.interceptarSelector(false).catch(() => undefined);
  }
}

async function probar(p, comprobar) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods);
  const modo = () => p.evaluar(`document.querySelector(".modo button.simular").getAttribute("aria-pressed") === "true" ? "simular" : "editar"`);
  const titulo = () => p.evaluar("document.title");

  for (const [archivo, componentes, cables] of ARCHIVOS) {
    await p.evaluar("bornera.editor.__anterior = true");
    p.elegirArchivo(resolve(CIRCUITOS, `${archivo}.brn`));
    await tecla(O, CTRL);
    await p.esperarA("bornera.editor.__anterior !== true", 5000);
    await p.esperarA("!bornera.editor.avisos.enReposoR11", 5000);
    const cuenta = await p.evaluar("JSON.stringify([bornera.editor.documento.hojas[0].componentes.length, bornera.editor.documento.hojas[0].cables.length])");
    comprobar(`${archivo}.brn: abre con ${componentes} componentes y ${cables} cables`, cuenta === JSON.stringify([componentes, cables]), cuenta);
    const errores = await p.evaluar("bornera.editor.avisos.cuenta.errores");
    comprobar(`${archivo}.brn: sin errores (se podrá entrar a Simular, D4-A)`, errores === 0, String(errores));
    await tecla(F5);
    await esperar(80);
    comprobar(`${archivo}.brn: F5 entra a Simular`, (await modo()) === "simular");
    await tecla(F5);
    await esperar(80);
    comprobar(`${archivo}.brn: F5 vuelve a Editar, sin «•»`, (await modo()) === "editar" && !(await titulo()).includes("•"), await titulo());
    await p.captura(archivo);
  }
}
