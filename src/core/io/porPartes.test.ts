import { describe, expect, it } from "vitest";
import type { Cable, Componente, Documento, Extremo } from "../model/documento";
import { SIMBOLOS } from "../symbols";
import { serializar, serializarPorPartes } from ".";
import { documentosDePrueba, RAROS } from "./prueba-documentos";

const unir = (doc: Documento) => [...serializarPorPartes(doc)].join("");

/** Generador con semilla fija (mulberry32). */
function azarCon(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un documento armado al azar: 0 a 3 hojas, hasta 6 componentes y 6 cables cada una, con textos raros a veces. */
function documentoAlAzar(azar: () => number): Documento {
  const entero = (n: number) => Math.floor(azar() * n);
  const elegir = <T>(xs: readonly T[]): T => xs[entero(xs.length)]!;
  const texto = () => elegir(["", "K1", "S0", RAROS, "Hoja \"2\"", "ñandú"]);
  const extremo = (): Extremo => {
    const t = entero(3);
    if (t === 0) return { tipo: "borne", comp: `c${entero(9)}`, borne: elegir(["A1", "13", "14"]) };
    if (t === 1) return { tipo: "cable", cable: `w${entero(9)}`, x: entero(40) - 20, y: entero(40) - 20 };
    return { tipo: "libre", x: entero(40) - 20, y: entero(40) - 20 };
  };
  const hojas = Array.from({ length: entero(4) }, (_, h) => ({
    nombre: azar() < 0.2 ? texto() : `Hoja ${h + 1}`,
    componentes: Array.from(
      { length: entero(7) },
      (_, i): Componente => ({
        id: `c${h}_${i}`,
        tipo: elegir(SIMBOLOS).tipo,
        x: entero(200) - 100,
        y: entero(200) - 100,
        rot: elegir([0, 90, 180, 270] as const),
        espejado: azar() < 0.5,
        etiqueta: texto(),
        params: azar() < 0.5 ? {} : { "10": texto(), b: String(entero(9)), a: "x" },
      }),
    ),
    cables: Array.from(
      { length: entero(7) },
      (_, i): Cable => ({
        id: `w${h}_${i}`,
        desde: extremo(),
        hasta: extremo(),
        codos: Array.from({ length: entero(3) }, () => [entero(40) - 20, entero(40) - 20] as [number, number]),
      }),
    ),
  }));
  return {
    formato: "bornera",
    version: 1,
    meta: { titulo: texto(), autor: texto(), fecha: "2026-11-17" },
    contadores: azar() < 0.5 ? {} : { w: entero(50), c: entero(50), "2": 1 },
    hojas,
  };
}

describe("serializarPorPartes (T23, 1b): las piezas unidas son serializar, carácter por carácter", () => {
  it.each(documentosDePrueba())("%s", (_nombre, doc) => {
    expect(unir(doc)).toBe(serializar(doc));
  });

  it("hojas sin componentes, sin cables, vacías y ninguna hoja", () => {
    const base = documentosDePrueba()[0]![1];
    const conHojas = (hojas: Documento["hojas"]): Documento => ({ ...base, hojas });
    const c = base.hojas[0]!.componentes;
    const w = base.hojas[0]!.cables;
    for (const doc of [
      conHojas([]),
      conHojas([{ nombre: "A", componentes: [], cables: [] }]),
      conHojas([{ nombre: "A", componentes: c, cables: [] }]),
      conHojas([{ nombre: "A", componentes: [], cables: w }]),
      conHojas([
        { nombre: "A", componentes: [], cables: [] },
        { nombre: "B", componentes: c, cables: w },
        { nombre: "C", componentes: [], cables: [] },
      ]),
    ]) {
      expect(unir(doc)).toBe(serializar(doc));
    }
  });

  it("300 documentos al azar (semilla fija), con textos raros y claves que parecen números", () => {
    const azar = azarCon(23);
    for (let i = 0; i < 300; i++) {
      const doc = documentoAlAzar(azar);
      expect(unir(doc), `documento ${i}`).toBe(serializar(doc));
    }
  });

  it("una pieza por componente y por cable, más la cabeza y los cierres", () => {
    const doc = documentosDePrueba().find(([, d]) => d.hojas[0]!.cables.length > 0)![1];
    const n = doc.hojas.reduce((s, h) => s + 3 + h.componentes.length + h.cables.length, 0);
    expect([...serializarPorPartes(doc)]).toHaveLength(n + 2);
  });

  it("no cambia el documento", () => {
    const doc = documentosDePrueba()[1]![1];
    const antes = JSON.parse(JSON.stringify(doc)) as Documento;
    unir(doc);
    expect(doc).toEqual(antes);
  });
});
