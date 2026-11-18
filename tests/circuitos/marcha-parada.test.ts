// El archivo congelado de la marcha-parada (T15, D5-B) abre igual que el
// armado. Si falla porque el armado cambió a propósito, se regenera con el
// comando del mensaje y se commitea; si el cambio no era a propósito, el
// armado o la lectura del formato se rompieron. Ver marcha-parada.mjs.
// @ts-expect-error sin el paquete @types/node (como vite.config.js)
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compararRedes } from "../../src/core/circuitos/compararRedes";
import { marchaParada } from "../../src/core/circuitos/marchaParada";
import { deserializar, serializar } from "../../src/core/io";
import { referenciasCruzadas } from "../../src/core/model/referencias";
import { validar } from "../../src/core/model/validaciones";
import { desempaquetar } from "../../src/ui/brn";
import { AVISO_DUPLICAR_SIN_LUGAR, Editor } from "../../src/editor/editor";
import type { EventoHerramienta } from "../../src/editor/herramientas/tipos";

// Los mismos que exporta marcha-parada.mjs: importarlo traería sus módulos de
// Node al chequeo de tipos, que no tiene @types/node.
const NOMBRE = "marcha-parada.brn";
const RUTA = new URL(`./${NOMBRE}`, import.meta.url);
const REGENERAR = "node tests/circuitos/marcha-parada.mjs";

/** Tope del control de tiempo de `compararRedes` (T17b): no es banco, solo que no se dispare. */
const TOPE_COMPARAR_MS = 50;

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
  it("es gzip, formato versión 1, y abre sin avisos igual que marchaParada()", async () => {
    const { bytes, texto, r } = await abrirCongelado();
    expect([bytes[0], bytes[1]], "No empieza con la marca de gzip (1f 8b)").toEqual([0x1f, 0x8b]);
    expect(JSON.parse(texto).version, "El archivo congelado es de la versión 1 del formato").toBe(1);
    expect(r.avisos).toEqual([]);

    expect(
      r.documento,
      `El armado de marchaParada() cambió y ${NOMBRE} no. Si el cambio es a propósito, regeneralo con \`${REGENERAR}\` y commitealo; si no, revisá el cambio`,
    ).toEqual(marchaParada().doc);
  });

  it("con las referencias cruzadas calculadas (T18), serializar da el mismo texto que el archivo congelado: el .brn no cambia", async () => {
    const { texto } = await abrirCongelado();
    const { doc } = marchaParada();
    expect(referenciasCruzadas(doc.hojas[0]!).size).toBe(1);
    expect(serializar(doc)).toBe(texto);
  });

  it("con las validaciones calculadas (T19), serializar da el mismo texto que el archivo congelado: el .brn no cambia", async () => {
    const { texto } = await abrirCongelado();
    const { doc } = marchaParada();
    expect(validar(doc.hojas[0]!)).toEqual([]);
    expect(serializar(doc)).toBe(texto);
  });

  it(`compararRedes contra marchaParada(): 0 diferencias, en menos de ${TOPE_COMPARAR_MS} ms (una medición en frío)`, async () => {
    const { r } = await abrirCongelado();
    const base = marchaParada().doc;
    const t0 = performance.now();
    const diferencias = compararRedes(r.documento, base);
    const ms = performance.now() - t0;
    expect(diferencias).toEqual([]);
    expect(ms, `compararRedes tardó ${ms.toFixed(2)} ms con la marcha-parada (tope ${TOPE_COMPARAR_MS} ms)`).toBeLessThan(TOPE_COMPARAR_MS);
  });
});

// Fila 5 de la checklist de la netbook (docs/plan-fase4.md, sección 6; T27):
// el «Pasa si» dice exactamente lo que fija este test. En el archivo, K1 está
// a la derecha de S1: Ctrl+D no tiene lugar al lado y abre la previa, que se
// corre a la izquierda y se suelta con un clic.
describe(`tests/circuitos/${NOMBRE}: Ctrl+D de la parada y la marcha (T27, fila 5 de la netbook)`, () => {
  const ev = (x: number, y: number): EventoHerramienta => ({ x, y, boton: 0, botones: 0, mayus: false, ctrl: false, escala: 20 });

  it("con S0 y S1 seleccionados, Ctrl+D avisa «No hay lugar al lado»; soltada a la izquierda, la copia de la parada es S2 y la de la marcha S3", async () => {
    const { r } = await abrirCongelado();
    const editor = new Editor(r.documento);
    editor.vista = { invalidarRegion: () => {}, invalidar: () => {} };
    const avisos: string[] = [];
    editor.alAvisar = (t) => avisos.push(t);
    const hoja = () => editor.documento.hojas[0]!;
    const antes = hoja().componentes.map((c) => [c.tipo, c.etiqueta, c.x, c.y]);
    expect(antes.filter(([t]) => String(t).startsWith("pulsador."))).toEqual([
      ["pulsador.nc", "S0", 0, 5],
      ["pulsador.na", "S1", 0, 11],
    ]);
    editor.seleccionarIds(hoja().componentes.filter((c) => c.etiqueta === "S0" || c.etiqueta === "S1").map((c) => c.id));

    expect(editor.accion("duplicar")).toBe(true);
    expect(avisos).toEqual([AVISO_DUPLICAR_SIN_LUGAR]);
    const lado = editor.pegando!.previa!.dx;
    // El primer punto es la referencia; después, la copia va 10 a la izquierda de los originales.
    editor.aplicar(editor.activa.mover(ev(50, 50)));
    editor.aplicar(editor.activa.mover(ev(50 - lado - 10, 50)));
    expect(editor.pegando!.previa).toMatchObject({ dx: -10, dy: 0, conflictos: [] });
    editor.aplicar(editor.activa.presionar(ev(50 - lado - 10, 50)));
    editor.aplicar(editor.activa.soltar(ev(50 - lado - 10, 50)));

    const comps = hoja().componentes;
    expect(comps.slice(0, antes.length).map((c) => [c.tipo, c.etiqueta, c.x, c.y])).toEqual(antes);
    expect(comps.slice(antes.length).map((c) => [c.tipo, c.etiqueta, c.x, c.y])).toEqual([
      ["pulsador.nc", "S2", -10, 5],
      ["pulsador.na", "S3", -10, 11],
    ]);
  });
});
