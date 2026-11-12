// Lo que Bornera guarda, abre (T15a): los documentos del banco pasan el
// paquete estricto de `deserializar`. Va acá y no en src/core/io porque el
// banco es de src/editor y el núcleo no puede importarlo.
import { describe, expect, it } from "vitest";
import { deserializar, serializar } from "../core/io";
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
