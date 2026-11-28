// El archivo congelado del circuito de la biblioteca 2 (sección 0 de
// docs/plan-biblioteca2.md; C1) abre igual que el armado, como
// `inversion-potencia.test.ts`. Si falla porque el
// armado cambió a propósito, se regenera con el comando del mensaje y se
// commitea; si el cambio no era a propósito, el armado o la lectura del
// formato se rompieron. Ver biblioteca2.mjs.
// @ts-expect-error sin el paquete @types/node (como vite.config.js)
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compararRedes } from "../../src/core/circuitos/compararRedes";
import { biblioteca2 } from "../../src/core/circuitos/biblioteca2";
import { inversionPotencia } from "../../src/core/circuitos/inversionPotencia";
import { deserializar, serializar } from "../../src/core/io";
import { validarHoja } from "../../src/core/model/cables";
import { validar } from "../../src/core/model/validaciones";
import { desempaquetar } from "../../src/ui/brn";

// Los mismos que exporta biblioteca2.mjs (importarlo traería sus módulos de Node al chequeo de tipos).
const NOMBRE = "biblioteca2.brn";
const RUTA = new URL(`./${NOMBRE}`, import.meta.url);
const REGENERAR = "node tests/circuitos/biblioteca2.mjs";

async function abrirCongelado() {
  if (!existsSync(RUTA)) throw new Error(`Falta tests/circuitos/${NOMBRE}. Generalo con: ${REGENERAR}`);
  const bytes = new Uint8Array(readFileSync(RUTA));
  const abierto = await desempaquetar(bytes);
  if (!abierto.ok) throw new Error(`No se pudo descomprimir: ${abierto.error}`);
  const r = deserializar(abierto.texto);
  if (!r.ok) throw new Error(`No abre: ${JSON.stringify(r.errores)}`);
  return { bytes, texto: abierto.texto, r };
}

describe(`tests/circuitos/${NOMBRE}: el archivo congelado`, () => {
  it("es gzip, formato versión 1, y abre sin avisos igual que biblioteca2()", async () => {
    const { bytes, texto, r } = await abrirCongelado();
    expect([bytes[0], bytes[1]], "No empieza con la marca de gzip (1f 8b)").toEqual([0x1f, 0x8b]);
    expect(JSON.parse(texto).version).toBe(1);
    expect(r.avisos).toEqual([]);
    expect(
      r.documento,
      `El armado de biblioteca2() cambió y ${NOMBRE} no. Si el cambio es a propósito, regeneralo con \`${REGENERAR}\` y commitealo; si no, revisá el cambio`,
    ).toEqual(biblioteca2().doc);
    expect(serializar(biblioteca2().doc)).toBe(texto);
  });

  it("compararRedes contra biblioteca2(): 0 diferencias; contra la inversión con potencia, las hay", async () => {
    const { r } = await abrirCongelado();
    expect(compararRedes(r.documento, biblioteca2().doc)).toEqual([]);
    expect(compararRedes(r.documento, inversionPotencia().doc).length).toBeGreaterThan(0);
  });

  it("«nada naranja»: R1 a R10 dan cero, y la hoja es válida", async () => {
    const { r } = await abrirCongelado();
    const hoja = r.documento.hojas[0]!;
    expect(validar(hoja)).toEqual([]);
    expect(validarHoja(hoja)).toEqual([]);
  });
});
