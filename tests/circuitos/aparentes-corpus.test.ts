// R11 (T29) sobre el corpus congelado `formato-v1/` y los `.brn` de
// referencia: ninguna conexión aparente que avise. `cables-t-libres` tiene un
// encimado entre cables de la misma red (w4 en T sobre w3) y da cero por
// R11-A. Solo lee los archivos: el corpus no se toca.
// @ts-expect-error sin el paquete @types/node (como vite.config.js)
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deserializar } from "../../src/core/io";
import { aparentesHoja, avisosR11 } from "../../src/core/model/aparentes";
import type { Documento } from "../../src/core/model/documento";
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

describe("R11 en el corpus y en las referencias", () => {
  it("son los 11 del corpus y los 2 .brn", () => {
    expect(ARCHIVOS).toHaveLength(13);
  });

  it.each(ARCHIVOS)("%s: sin R11", async (_, url) => {
    const doc = await abrir(url);
    for (const h of doc.hojas) expect(avisosR11(h)).toEqual([]);
  });

  it("cables-t-libres: el encimado de la misma red está, y R11-A lo calla", async () => {
    const doc = await abrir(new URL("cables-t-libres.brn.json", CORPUS));
    const h = doc.hojas[0]!;
    const encimados = aparentesHoja(h).filter((a) => a.entreCables);
    expect(encimados.length).toBeGreaterThan(0);
    expect(aparentesHoja(h).filter((a) => !a.entreCables)).toEqual([]);
    expect(avisosR11(h)).toEqual([]);
  });
});
