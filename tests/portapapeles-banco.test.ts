// Pegar sobre el documento del banco con cables (T16, etapa 1, E2-A): al azar
// con semilla fija, y el costo de pegar 2000 componentes y 3000 cables. Va en
// tests/ y no en src/core porque `documentoBancoCables` vive en src/editor, y
// el núcleo no puede importar de otra capa.
import { describe, expect, it, vi } from "vitest";

// `indexarHoja` espiada, para contar cuántos índices arma pegar.
vi.mock("../src/core/model/cables", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/core/model/cables")>();
  return { ...real, indexarHoja: vi.fn(real.indexarHoja) };
});

import { indexarHoja, recorridoCable, validarHoja } from "../src/core/model/cables";
import type { Cable, Documento, Hoja } from "../src/core/model/documento";
import { pegar, problemasPegado, recortar, recorteVacio, type Recorte } from "../src/core/model/portapapeles";
import { comprobarControl, comprobarRedes, mapaPegado, unionesEsperadas } from "../src/core/model/prueba-portapapeles";
import { consultaHoja } from "../src/core/model/trazado";
import { uniones } from "../src/core/model/uniones";
import { documentoBancoCables } from "../src/editor/banco";
import { azar } from "../src/render/banco";

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const todo = (h: Hoja) => [...h.componentes.map((c) => c.id), ...h.cables.map((w) => w.id)];

/**
 * La regla de qué entra (D2a-A, D2b-A): con lo que quedó en el recorte, un
 * cable puede entrar si cada extremo es un borne copiado, una T sobre un
 * cable copiado o, si está elegido, libre.
 */
function admisible(w: Cable, elegidos: ReadonlySet<string>, comps: ReadonlySet<string>, cables: ReadonlySet<string>): boolean {
  return [w.desde, w.hasta].every((e) =>
    e.tipo === "borne" ? comps.has(e.comp) : e.tipo === "cable" ? cables.has(e.cable) : elegidos.has(w.id),
  );
}

/** El recorte es justo lo que manda la regla: lo que entró la cumple y lo que no entró, no. */
function comprobarRecorte(h: Hoja, elegidos: ReadonlySet<string>, r: Recorte): void {
  const comps = new Set(r.componentes.map((c) => c.id));
  const cables = new Set(r.cables.map((w) => w.id));
  expect([...comps].filter((id) => !elegidos.has(id))).toEqual([]);
  expect(h.cables.filter((w) => admisible(w, elegidos, comps, cables) !== cables.has(w.id)).map((w) => w.id)).toEqual([]);
}

/** Una selección como la del rectángulo, alrededor de un componente al azar, con algunos agregados y quitados. */
function elegir(h: Hoja, rnd: () => number): Set<string> {
  const indice = indexarHoja(h);
  const centro = h.componentes[Math.floor(rnd() * h.componentes.length)]!;
  const medio = 4 + Math.floor(rnd() * 24);
  const adentro = (x: number, y: number) => Math.abs(x - centro.x) <= medio && Math.abs(y - centro.y) <= medio;
  const elegidos = new Set<string>();
  for (const c of h.componentes) if (adentro(c.x, c.y)) elegidos.add(c.id);
  for (const w of h.cables) {
    const p = recorridoCable(indice, w);
    if (p && p.every((v, i) => (i % 2 === 1 ? true : adentro(v, p[i + 1]!)))) elegidos.add(w.id);
  }
  const ids = todo(h);
  for (const id of [...elegidos]) if (rnd() < 0.1) elegidos.delete(id);
  for (let i = 0; i < 3; i++) elegidos.add(ids[Math.floor(rnd() * ids.length)]!);
  return elegidos;
}

const SEMILLA = 20261113;
const VUELTAS = 60;
/**
 * Sola tarda alrededor de 1 s; con `npm test` entero, en paralelo con los
 * demás archivos, unas 3,5 veces más, cerca de los 5 s por defecto.
 */
const LIMITE_MS = 20_000;

describe("pegar al azar sobre el banco con cables (semilla fija)", () => {
  it("recorte justo, hoja válida, control de conflictos, redes, uniones y deshacer y rehacer exactos", { timeout: LIMITE_MS }, () => {
    const rnd = azar(SEMILLA);
    const base = [1, 2, 3, 4].map((s) => documentoBancoCables(120, s));
    for (const d of base) expect(validarHoja(d.hojas[0]!)).toEqual([]);
    const entero = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
    let con = 0;
    let sin = 0;
    let vacios = 0;
    for (let k = 0; k < VUELTAS; k++) {
      const doc: Documento = copia(base[k % base.length]!);
      const hoja = doc.hojas[0]!;
      const elegidos = elegir(hoja, rnd);
      const r = recortar(hoja, elegidos);
      comprobarRecorte(hoja, elegidos, r);
      if (recorteVacio(r)) {
        vacios++;
        continue;
      }
      const caja = r.caja!;
      // Cerca (casi siempre choca), al lado como Ctrl+D, o lejos de todo.
      const modo = rnd();
      const ancho = Math.ceil(caja.ancho) + 2;
      const [dx, dy] =
        modo < 0.4 ? [entero(-12, 12), entero(-12, 12)] : modo < 0.7 ? [ancho, entero(-2, 2)] : [entero(200, 260), entero(-30, 30)];

      const ps = problemasPegado(r, dx, dy, consultaHoja(hoja), doc.contadores);
      const contadores = { ...doc.contadores };
      const cmd = pegar(doc, r, dx, dy);
      expect(doc.contadores).toEqual({ ...contadores, c: contadores["c"]! + r.componentes.length, w: contadores["w"]! + r.cables.length });
      const antes = copia(doc);
      cmd.aplicar(doc);
      const aplicado = copia(doc);
      expect(validarHoja(hoja)).toEqual([]);
      expect(hoja.componentes).toHaveLength(antes.hojas[0]!.componentes.length + r.componentes.length);
      expect(hoja.cables).toHaveLength(antes.hojas[0]!.cables.length + r.cables.length);

      comprobarControl(ps, hoja, new Set(cmd.ids));
      const mapa = mapaPegado(r, hoja);
      comprobarRedes(antes.hojas[0]!, hoja, r, mapa);
      if (ps.length === 0) {
        sin++;
        expect(uniones(hoja)).toEqual(unionesEsperadas(antes.hojas[0]!, r, mapa, dx, dy));
      } else con++;

      cmd.deshacer(doc);
      expect(doc).toEqual(antes);
      expect(validarHoja(hoja)).toEqual([]);
      cmd.aplicar(doc);
      expect(doc).toEqual(aplicado);
      expect(validarHoja(hoja)).toEqual([]);
    }
    // Que la prueba no sea vacía: hubo de los dos casos.
    expect(con).toBeGreaterThan(10);
    expect(sin).toBeGreaterThan(10);
    expect(vacios).toBeLessThan(VUELTAS / 4);
  });
});

describe("costo de pegar 2000 componentes y 3000 cables", () => {
  it("construir y aplicar Pegar arma un solo índice (no un Grupo de Cablear); deshacer, ninguno", { timeout: LIMITE_MS }, () => {
    const doc = documentoBancoCables(2000);
    const hoja = doc.hojas[0]!;
    const r = recortar(hoja, todo(hoja));
    expect(r.componentes).toHaveLength(2000);
    expect(r.cables).toHaveLength(hoja.cables.length);
    expect(r.cables.length).toBeGreaterThanOrEqual(3000);

    const indices = vi.mocked(indexarHoja);
    indices.mockClear();
    const cmd = pegar(doc, r, Math.ceil(r.caja!.ancho) + 2, 0);
    cmd.aplicar(doc);
    expect(indices).toHaveBeenCalledTimes(1);
    expect(hoja.componentes).toHaveLength(4000);
    expect(hoja.cables).toHaveLength(2 * r.cables.length);

    indices.mockClear();
    cmd.deshacer(doc);
    expect(indices).not.toHaveBeenCalled();
    expect(hoja.componentes).toHaveLength(2000);

    indices.mockClear();
    cmd.aplicar(doc);
    expect(indices).toHaveBeenCalledTimes(1);
  });
});
