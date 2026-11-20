// La netlist (T28) sobre el corpus congelado `formato-v1/` y los `.brn` de
// referencia: cada hoja arma sin excepción, igual dos veces, con la misma
// partición que `redes()` unida solo por papel + nombre (D7), sin cortos por
// cables. Solo lee los archivos: el corpus no se toca.
// @ts-expect-error sin el paquete @types/node (como vite.config.js)
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deserializar } from "../../src/core/io";
import type { Documento } from "../../src/core/model/documento";
import { armarNetlist } from "../../src/core/sim/netlist";
import { particion, particionEsperada } from "../../src/core/sim/prueba-netlist";
import { desempaquetar } from "../../src/ui/brn";

const CORPUS = new URL("./formato-v1/", import.meta.url);
const AQUI = new URL("./", import.meta.url);

async function abrir(url: URL): Promise<Documento> {
  const p = await desempaquetar(Uint8Array.from(readFileSync(url) as Uint8Array));
  if (!p.ok) throw new Error(`${url}: ${p.error}`);
  const r = deserializar(p.texto);
  if (!r.ok) throw new Error(`${url}: ${JSON.stringify(r.errores)}`);
  return r.documento;
}

const ARCHIVOS: [string, URL][] = [
  ...(readdirSync(CORPUS) as string[]).sort().map((n): [string, URL] => [`formato-v1/${n}`, new URL(n, CORPUS)]),
  ["marcha-parada.brn", new URL("marcha-parada.brn", AQUI)],
  ["inversion.brn", new URL("inversion.brn", AQUI)],
];

describe("netlist del corpus y de las referencias", () => {
  it("son los 11 del corpus y los 2 .brn", () => {
    expect(ARCHIVOS).toHaveLength(13);
  });

  it.each(ARCHIVOS)("%s", async (_, url) => {
    const doc = await abrir(url);
    for (const h of doc.hojas) {
      const n = armarNetlist(h);
      expect(armarNetlist(h)).toEqual(n);
      expect(particion(n.redes)).toEqual(particionEsperada(h));
      expect(n.enCorto).toEqual([]);
    }
  });
});
