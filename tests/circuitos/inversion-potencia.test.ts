// El archivo congelado de la inversión de giro con potencia (fase 6, sección 0;
// T36) abre igual que el armado, como `inversion.test.ts`. Si falla porque el
// armado cambió a propósito, se regenera con el comando del mensaje y se
// commitea; si el cambio no era a propósito, el armado o la lectura del
// formato se rompieron. Ver inversion-potencia.mjs.
// @ts-expect-error sin el paquete @types/node (como vite.config.js)
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compararRedes } from "../../src/core/circuitos/compararRedes";
import { inversion } from "../../src/core/circuitos/inversion";
import { inversionPotencia } from "../../src/core/circuitos/inversionPotencia";
import { deserializar, serializar } from "../../src/core/io";
import { validarHoja } from "../../src/core/model/cables";
import { validar } from "../../src/core/model/validaciones";
import { desempaquetar } from "../../src/ui/brn";

// Los mismos que exporta inversion-potencia.mjs (importarlo traería sus módulos de Node al chequeo de tipos).
const NOMBRE = "inversion-potencia.brn";
const RUTA = new URL(`./${NOMBRE}`, import.meta.url);
const REGENERAR = "node tests/circuitos/inversion-potencia.mjs";

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
  it("es gzip, formato versión 1, y abre sin avisos igual que inversionPotencia()", async () => {
    const { bytes, texto, r } = await abrirCongelado();
    expect([bytes[0], bytes[1]], "No empieza con la marca de gzip (1f 8b)").toEqual([0x1f, 0x8b]);
    expect(JSON.parse(texto).version).toBe(1);
    expect(r.avisos).toEqual([]);
    expect(
      r.documento,
      `El armado de inversionPotencia() cambió y ${NOMBRE} no. Si el cambio es a propósito, regeneralo con \`${REGENERAR}\` y commitealo; si no, revisá el cambio`,
    ).toEqual(inversionPotencia().doc);
    expect(serializar(inversionPotencia().doc)).toBe(texto);
  });

  it("compararRedes contra inversionPotencia(): 0 diferencias; contra la inversión de la 3b, las hay", async () => {
    const { r } = await abrirCongelado();
    expect(compararRedes(r.documento, inversionPotencia().doc)).toEqual([]);
    expect(compararRedes(r.documento, inversion().doc).length).toBeGreaterThan(0);
  });

  it("«nada naranja»: R1 a R10 dan cero, y la hoja es válida", async () => {
    const { r } = await abrirCongelado();
    const hoja = r.documento.hojas[0]!;
    expect(validar(hoja)).toEqual([]);
    expect(validarHoja(hoja)).toEqual([]);
  });
});
