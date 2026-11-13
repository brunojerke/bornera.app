// Comando de D8-B (T15): compara un .brn dibujado a mano (en la netbook) con
// la marcha-parada base, por la partición de sus bornes en "etiqueta·borne"
// (`compararRedes`). No mira ids, orden ni geometría. La ruta va en la
// variable de entorno BORNERA_BRN; sin ella, el test se saltea (así corre en
// `npm test` sin hacer nada). En Windows (PowerShell), docs/plan-T15.md
// sección 5:
//   $env:BORNERA_BRN = "C:\ruta\marcha-parada.brn"; npm run circuito; Remove-Item Env:BORNERA_BRN
// @ts-expect-error sin el paquete @types/node (como vite.config.js)
import { readFileSync } from "node:fs";
// @ts-expect-error sin el paquete @types/node
import { resolve } from "node:path";
// @ts-expect-error sin el paquete @types/node
import process from "node:process";
import { describe, expect, it } from "vitest";
import { compararRedes } from "../../src/core/circuitos/compararRedes";
import { marchaParada } from "../../src/core/circuitos/marchaParada";
import { deserializar } from "../../src/core/io";
import { redes } from "../../src/core/model/redes";
import { desempaquetar } from "../../src/ui/brn";

const ruta = process.env.BORNERA_BRN?.trim() ?? "";

describe.skipIf(ruta === "")("marcha-parada dibujada a mano (BORNERA_BRN)", () => {
  it("misma partición de bornes que la base", async () => {
    const archivo = resolve(ruta);
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(readFileSync(archivo));
    } catch (e) {
      throw new Error(`No se pudo leer ${archivo}: ${e instanceof Error ? e.message : e}`);
    }
    const abierto = await desempaquetar(bytes);
    if (!abierto.ok) throw new Error(`${archivo}: ${abierto.error}`);
    const r = deserializar(abierto.texto);
    if (!r.ok) throw new Error(`${archivo} no abre: ${r.errores.map((p) => `${p.donde} ${p.mensaje}`).join("; ")}`);
    if (r.avisos.length > 0) throw new Error(`${archivo} abre con avisos: ${r.avisos.map((p) => `${p.donde} ${p.mensaje}`).join("; ")}`);

    expect(compararRedes(r.documento, marchaParada().doc), `${archivo} no es la marcha-parada base`).toEqual([]);
    const lista = redes(r.documento.hojas[0]!, { unirPorNombre: true }).filter((x) => x.bornes.length > 0);
    const bornes = lista.reduce((n, x) => n + x.bornes.length, 0);
    console.log(`${archivo}: misma partición que la base (${lista.length} redes, ${bornes} bornes).`);
  });
});
