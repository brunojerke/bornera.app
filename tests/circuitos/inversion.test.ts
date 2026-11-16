// El archivo congelado de la inversión de giro (cierre 3b, etapa 1) abre
// igual que el armado, como `marcha-parada.test.ts`. Si falla porque el
// armado cambió a propósito, se regenera con el comando del mensaje y se
// commitea; si el cambio no era a propósito, el armado o la lectura del
// formato se rompieron. Ver inversion.mjs.
//
// También fija con el archivo los dos criterios de la fase 3b que dependen de
// la inversión: «nada naranja» (docs/plan-T19.md, sección 3) y las listas de
// referencias (docs/plan-T18.md, secciones 3 y 9).
// @ts-expect-error sin el paquete @types/node (como vite.config.js)
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compararRedes } from "../../src/core/circuitos/compararRedes";
import { inversion } from "../../src/core/circuitos/inversion";
import { deserializar, serializar } from "../../src/core/io";
import { validarHoja } from "../../src/core/model/cables";
import { referenciasCruzadas, textoFila } from "../../src/core/model/referencias";
import { validar } from "../../src/core/model/validaciones";
import { desempaquetar } from "../../src/ui/brn";

// Los mismos que exporta inversion.mjs: importarlo traería sus módulos de
// Node al chequeo de tipos, que no tiene @types/node.
const NOMBRE = "inversion.brn";
const RUTA = new URL(`./${NOMBRE}`, import.meta.url);
const REGENERAR = "node tests/circuitos/inversion.mjs";

/** El archivo congelado: sus bytes, el texto descomprimido y lo que da al leerlo. Tira si falta o no abre. */
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
  it("es gzip, formato versión 1, y abre sin avisos igual que inversion()", async () => {
    const { bytes, texto, r } = await abrirCongelado();
    expect([bytes[0], bytes[1]], "No empieza con la marca de gzip (1f 8b)").toEqual([0x1f, 0x8b]);
    expect(JSON.parse(texto).version, "El archivo congelado es de la versión 1 del formato").toBe(1);
    expect(r.avisos).toEqual([]);
    expect(
      r.documento,
      `El armado de inversion() cambió y ${NOMBRE} no. Si el cambio es a propósito, regeneralo con \`${REGENERAR}\` y commitealo; si no, revisá el cambio`,
    ).toEqual(inversion().doc);
    expect(serializar(inversion().doc)).toBe(texto);
  });

  it("compararRedes contra inversion(): 0 diferencias", async () => {
    const { r } = await abrirCongelado();
    expect(compararRedes(r.documento, inversion().doc)).toEqual([]);
  });

  it("«nada naranja»: R1 a R9 dan cero, y la hoja es válida", async () => {
    const { r } = await abrirCongelado();
    const hoja = r.documento.hojas[0]!;
    expect(validar(hoja)).toEqual([]);
    expect(validarHoja(hoja)).toEqual([]);
  });

  it("las listas de K1 y K2: dos filas cada una, con el NC de cada contactor en la otra rama", async () => {
    const { r } = await abrirCongelado();
    const hoja = r.documento.hojas[0]!;
    const refs = referenciasCruzadas(hoja);
    const lineas = [...refs].map(([bobina, filas]) => [hoja.componentes.find((c) => c.id === bobina)!.etiqueta, filas.map(textoFila)]);
    expect(lineas).toEqual([
      ["K1", ["NA 13-14 (10, 11)", "NC 21-22 (21, 17)"]],
      ["K2", ["NA 13-14 (31, 11)", "NC 21-22 (0, 17)"]],
    ]);
  });
});
