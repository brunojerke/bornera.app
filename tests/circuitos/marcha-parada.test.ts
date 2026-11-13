// El archivo congelado de la marcha-parada (T15, D5-B) abre igual que el
// armado. Si falla porque el armado cambió a propósito, se regenera con el
// comando del mensaje y se commitea; si el cambio no era a propósito, el
// armado o la lectura del formato se rompieron. Ver marcha-parada.mjs.
// @ts-expect-error sin el paquete @types/node (como vite.config.js)
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { marchaParada } from "../../src/core/circuitos/marchaParada";
import { deserializar } from "../../src/core/io";
import { desempaquetar } from "../../src/ui/brn";

// Los mismos que exporta marcha-parada.mjs: importarlo traería sus módulos de
// Node al chequeo de tipos, que no tiene @types/node.
const NOMBRE = "marcha-parada.brn";
const RUTA = new URL(`./${NOMBRE}`, import.meta.url);
const REGENERAR = "node tests/circuitos/marcha-parada.mjs";

describe(`tests/circuitos/${NOMBRE}: el archivo congelado`, () => {
  it("es gzip, formato versión 1, y abre sin avisos igual que marchaParada()", async () => {
    if (!existsSync(RUTA)) throw new Error(`Falta tests/circuitos/${NOMBRE}. Generalo con: ${REGENERAR}`);
    const bytes = new Uint8Array(readFileSync(RUTA));
    expect([bytes[0], bytes[1]], "No empieza con la marca de gzip (1f 8b)").toEqual([0x1f, 0x8b]);

    const abierto = await desempaquetar(bytes);
    if (!abierto.ok) throw new Error(`No se pudo descomprimir: ${abierto.error}`);
    expect(JSON.parse(abierto.texto).version, "El archivo congelado es de la versión 1 del formato").toBe(1);
    const r = deserializar(abierto.texto);
    if (!r.ok) throw new Error(`No abre: ${JSON.stringify(r.errores)}`);
    expect(r.avisos).toEqual([]);

    expect(
      r.documento,
      `El armado de marchaParada() cambió y ${NOMBRE} no. Si el cambio es a propósito, regeneralo con \`${REGENERAR}\` y commitealo; si no, revisá el cambio`,
    ).toEqual(marchaParada().doc);
  });
});
