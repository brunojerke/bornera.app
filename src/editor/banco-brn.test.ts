// Lo que Bornera guarda, abre (T15a): los documentos del banco pasan el
// paquete estricto de `deserializar`. Va acá y no en src/core/io porque el
// banco es de src/editor y el núcleo no puede importarlo.
import { describe, expect, it } from "vitest";
import { deserializar, serializar, serializarPorLineas } from "../core/io";
import type { Documento } from "../core/model/documento";
import { documentoBanco, documentoBancoCables } from "./banco";

/** Las escenas del banco de la app: 100, 500 y 2000 símbolos, y la de cables (2000, como SIMBOLOS_BANCO_CABLES). */
const ESCENAS: [string, () => Documento][] = [
  ["banco de 100", () => documentoBanco(100)],
  ["banco de 500", () => documentoBanco(500)],
  ["banco de 2000", () => documentoBanco(2000)],
  ["banco de 2000 con cables", () => documentoBancoCables(2000)],
];

describe("el banco abre (T15a)", () => {
  it.each(ESCENAS)("%s: abre sin errores ni avisos, vuelve igual y se guarda igual", (_nombre, crear) => {
    const doc = crear();
    const texto = serializar(doc);
    const r = deserializar(texto);
    // Primero los errores: si no abre, que se vea por qué y no un diff enorme.
    expect(r.ok ? [] : r.errores).toEqual([]);
    if (!r.ok) return;
    expect(r.avisos).toEqual([]);
    expect(r.documento).toEqual(doc);
    expect(serializar(r.documento)).toBe(texto);
  });
});

/**
 * El texto .brn de cada escena, fijado en 5a51c2b (T21, antes de tocar
 * serializar.ts): la forma por líneas de `.brn.json` no puede cambiar ni un
 * byte del `.brn` normal. Si algún día cambia a propósito (una migración),
 * se actualiza con el OK de Bruno. «banco de 2000 con cables» cambió en
 * `codosBanco` (2026-11-22, con el OK de Bruno): sus cables se tienden como W.
 */
const BRN_FIJADO: Record<string, { largo: number; sha256: string }> = {
  "banco de 100": { largo: 10708, sha256: "af948adae5529149c80d123c85c2347ef6775c764ceccc3dc331e00d53de2786" },
  "banco de 500": { largo: 54473, sha256: "ea24854a7e00414fbd968b81db49c58bae824f01e9cb3fda24826de830c43044" },
  "banco de 2000": { largo: 220999, sha256: "511788abe970d08e5b2223e2039b09c4e6b036d915113848f36eee3080b59ac3" },
  "banco de 2000 con cables": { largo: 655938, sha256: "852eb73d3641c8b7b0f111e86f5b1516cc052411f1c6a3b17ad2e9025ab2b331" },
};

async function sha256(texto: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("el .brn del banco no cambia ni un byte (T21)", () => {
  it.each(ESCENAS)("%s: mismo largo y mismo sha256 que en 5a51c2b", async (nombre, crear) => {
    const texto = serializar(crear());
    expect({ largo: texto.length, sha256: await sha256(texto) }).toEqual(BRN_FIJADO[nombre]);
  });
});

describe("el banco en .brn.json (T21)", () => {
  it.each(ESCENAS)("%s: por líneas, sin los saltos de línea es el .brn, y abre igual", (_nombre, crear) => {
    const doc = crear();
    const lineas = serializarPorLineas(doc);
    expect(lineas.replaceAll("\n", "")).toBe(serializar(doc));
    const r = deserializar(lineas);
    expect(r.ok ? [] : r.errores).toEqual([]);
    if (r.ok) expect(r.documento).toEqual(doc);
  });
});
