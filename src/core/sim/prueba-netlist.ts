// Ayudas de los tests de la netlist (T28), compartidas por
// src/core/sim/netlist.test.ts y tests/circuitos/netlist-corpus.test.ts. Solo
// las importan los tests: el código de la app no las usa.
import type { Hoja } from "../model/documento";
import { redes } from "../model/redes";

type ConBornes = { bornes: readonly { comp: string; borne: string }[]; cables: readonly string[] };

/** Partición de redes como conjuntos de "comp:borne" y "cable:id", ordenados. */
export function particion(lista: readonly ConBornes[]): string[][] {
  return lista
    .map((r) => [...r.bornes.map((b) => `${b.comp}:${b.borne}`), ...r.cables.map((c) => `cable:${c}`)].sort())
    .sort((a, b) => (a.join() < b.join() ? -1 : a.join() > b.join() ? 1 : 0));
}

/** Papel de las fuentes, escrito aparte del de la netlist a propósito. */
const PAPEL: Readonly<Record<string, string>> = { "fuente.fase": "fase", "fuente.neutro": "neutro" };

/** Fuentes de varios bornes (T34): el papel de cada borne; el nombre de red es el del borne. */
const TRIFASICAS = new Set(["fuente.trifasica", "fuente.trifasica_n"]);

/** Salida propia (T39): tipo → borne → papel; el nombre de red es etiqueta + «.» + borne. */
const SALIDAS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "fuente.continua": { "L+": "fase", M: "neutro" },
  "fuente.variable": { "V+": "fase", "V-": "neutro" },
  "fuente.conmutada": { "+V": "fase", "-V": "neutro" },
  "transformador.monofasico": { "2U1": "fase", "2U2": "neutro" },
  "transformador.variac": { "2U1": "fase", "2U2": "neutro" },
  "transformador.trifasico": { "2U": "fase", "2V": "fase", "2W": "fase", "2N": "neutro" },
};

/**
 * La partición esperada, armada sin la netlist: las redes por cables de
 * `redes()`, unidas solo cuando comparten papel y nombre de una fuente.
 */
export function particionEsperada(h: Hoja): string[][] {
  const lista = redes(h);
  const grupo = lista.map((_, i) => i);
  const claveDe = new Map<string, number>();
  lista.forEach((r, i) => {
    for (const b of r.bornes) {
      const c = h.componentes.find((x) => x.id === b.comp)!;
      const tri = TRIFASICAS.has(c.tipo);
      const salida = SALIDAS[c.tipo];
      const etiqueta = c.etiqueta.trim().toUpperCase();
      const papel = tri ? (b.borne === "N" ? "neutro" : "fase") : salida ? salida[b.borne] : PAPEL[c.tipo];
      const nombre = tri ? b.borne : salida ? (etiqueta === "" ? "" : `${etiqueta}.${b.borne}`) : etiqueta;
      if (!papel || nombre === "") continue;
      const clave = `${papel}|${nombre}`;
      const otro = claveDe.get(clave);
      if (otro === undefined) {
        claveDe.set(clave, i);
        continue;
      }
      const viejo = grupo[i]!;
      const nuevo = grupo[otro]!;
      for (let k = 0; k < grupo.length; k++) if (grupo[k] === viejo) grupo[k] = nuevo;
    }
  });
  const unidas = new Map<number, { bornes: { comp: string; borne: string }[]; cables: string[] }>();
  lista.forEach((r, i) => {
    let u = unidas.get(grupo[i]!);
    if (!u) unidas.set(grupo[i]!, (u = { bornes: [], cables: [] }));
    u.bornes.push(...r.bornes);
    u.cables.push(...r.cables);
  });
  return particion([...unidas.values()]);
}
