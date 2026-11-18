// F2 y F3 de «Probar la fase 4» (C1): guardar y abrir sin los comandos, con
// el disco inyectado; lo escrito se borra siempre.
import { describe, expect, it } from "vitest";
import { serializar } from "../core/io";
import type { Documento } from "../core/model/documento";
import { documentoBanco } from "../editor/banco";
import { discoEnMemoria, medirArchivo, type DiscoMedicion } from "./medirArchivo";

/** Un reloj que avanza 1 ms cada vez que se lo lee. */
function reloj() {
  let t = 0;
  return () => t++;
}

describe("medirArchivo", () => {
  it("cada vuelta guarda, abre y dibuja el primer cuadro del documento abierto; vuelve igual", async () => {
    const doc = documentoBanco(20);
    const abiertos: Documento[] = [];
    const r = await medirArchivo(doc, discoEnMemoria(), { vueltas: 3, primerCuadro: (d) => abiertos.push(d), ahora: reloj() });
    expect(r.muestras).toHaveLength(3);
    expect(abiertos).toHaveLength(3);
    expect(abiertos[0]).not.toBe(doc);
    expect(serializar(abiertos[2]!)).toBe(serializar(doc));
    expect(r.igual).toBe(true);
    // gzip: empieza con 1f 8b y es más chico que el texto.
    expect(r.bytes).toBeGreaterThan(0);
    expect(r.bytes).toBeLessThan(serializar(doc).length);
    // F3 cuenta desde leer hasta después del primer cuadro: más que la parte de abrir.
    for (const m of r.muestras) {
      expect(m.guardar).toBeGreaterThan(0);
      expect(m.hastaCuadro).toBeGreaterThan(m.abrir);
    }
  });

  it("no pasa por el documento original: no lo cambia", async () => {
    const doc = documentoBanco(10);
    const antes = serializar(doc);
    await medirArchivo(doc, discoEnMemoria(), { vueltas: 2, primerCuadro: () => {} });
    expect(serializar(doc)).toBe(antes);
  });

  it("borra lo escrito aunque falle, y tira el error", async () => {
    let borrado = 0;
    const disco: DiscoMedicion = {
      ...discoEnMemoria(),
      leer: async () => new Uint8Array([1, 2, 3]),
      borrar: async () => void borrado++,
    };
    await expect(medirArchivo(documentoBanco(5), disco, { vueltas: 2, primerCuadro: () => {} })).rejects.toThrow();
    expect(borrado).toBe(1);
  });

  it("si dibujar el primer cuadro falla, también borra", async () => {
    let borrado = 0;
    const disco: DiscoMedicion = { ...discoEnMemoria(), borrar: async () => void borrado++ };
    const primerCuadro = () => {
      throw new Error("sin lienzo");
    };
    await expect(medirArchivo(documentoBanco(5), disco, { vueltas: 1, primerCuadro })).rejects.toThrow("sin lienzo");
    expect(borrado).toBe(1);
  });
});
