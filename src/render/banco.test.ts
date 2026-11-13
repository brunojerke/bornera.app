import { describe, expect, it } from "vitest";
import { SIMBOLOS } from "../core/symbols";
import { CANTIDADES_BANCO, generarBanco, simbolosEscena012, TIPOS_ESCENA_012 } from "./banco";
import type { ComponenteEscena } from "./escena";

/** Una línea por componente: tipo, x, y, rotación, espejado (0 o 1) y etiqueta. */
const lineas = (lista: ComponenteEscena[]): string[] =>
  lista.map((c) => `${c.def.tipo},${c.x},${c.y},${c.rotacion},${c.espejado ? 1 : 0},${c.etiqueta}`);

async function sha256(texto: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function contarTipos(lista: ComponenteEscena[]): Record<string, number> {
  const tipos: Record<string, number> = {};
  for (const c of lista) tipos[c.def.tipo] = (tipos[c.def.tipo] ?? 0) + 1;
  return tipos;
}

/**
 * La escena del banco en v0.1.2: `generarBanco(n, 1)` del tag v0.1.2, sacada del
 * worktree el 2026-11-13 con las mismas `lineas` unidas por "\n".
 */
const ESCENA_012: Record<number, { sha256: string; tipos: Record<string, number> }> = {
  100: {
    sha256: "b5d3e3aecaa96017b91d8344a11f29b30425eaca172dcb41036380d4634c54a9",
    tipos: { "pulsador.na": 24, "pulsador.nc": 21, "contactor.bobina": 18, "contactor.auxiliar_na": 28, "senalizacion.lampara": 9 },
  },
  500: {
    sha256: "6577b199a24229844ddf28013dc90281f63c47dc912c668d0a3cf69c206178a5",
    tipos: { "pulsador.na": 101, "pulsador.nc": 100, "contactor.bobina": 100, "contactor.auxiliar_na": 111, "senalizacion.lampara": 88 },
  },
  2000: {
    sha256: "5fce6093be4c93b4b8a4ee0f1dd2e00a1f5779b4745b0fcb409a19d5f495aeff",
    tipos: { "pulsador.na": 432, "pulsador.nc": 363, "contactor.bobina": 403, "contactor.auxiliar_na": 407, "senalizacion.lampara": 395 },
  },
};

/** La escena de siempre (con Fase y Neutro), sacada en e137ea8, antes de agregar la opción. */
const ESCENA_ACTUAL: Record<number, string> = {
  100: "a59ff842eebfc9fe72a56f551fe5a1745ca6bb0c4cd18bdb46c48335b94f5a24",
  500: "3f6075b80cdfa776295e76c60f062d056b0b5968572b9eae252585ce427da4dd",
  2000: "8f44a9e6bfc6408806fc3abe5a05c86de175984584eb2c1d71902e76812887ed",
};

describe("escena de 0.1.2 en el banco (--escena-012)", () => {
  it("busca los 5 símbolos de 0.1.2 por tipo, en el orden de 0.1.2", () => {
    const defs = simbolosEscena012();
    expect(defs.map((d) => d.tipo)).toEqual([...TIPOS_ESCENA_012]);
    for (const d of defs) expect(SIMBOLOS).toContain(d);
  });

  it("da la escena de v0.1.2, componente por componente (100, 500 y 2000)", async () => {
    for (const n of CANTIDADES_BANCO) {
      const lista = generarBanco(n, 1, simbolosEscena012());
      expect(contarTipos(lista), `tipos con ${n}`).toEqual(ESCENA_012[n]!.tipos);
      expect(await sha256(lineas(lista).join("\n")), `escena de ${n}`).toBe(ESCENA_012[n]!.sha256);
    }
    // Los primeros de 2000, a la vista.
    expect(lineas(generarBanco(2000, 1, simbolosEscena012())).slice(0, 3)).toEqual([
      "pulsador.na,248,256,90,0,S1",
      "pulsador.nc,64,0,270,0,S2",
      "senalizacion.lampara,184,216,180,0,H1",
    ]);
  });

  it("sin la opción, la escena no cambia", async () => {
    for (const n of CANTIDADES_BANCO)
      expect(await sha256(lineas(generarBanco(n)).join("\n")), `escena de ${n}`).toBe(ESCENA_ACTUAL[n]);
  });

  it("la lista de símbolos cambia los tipos, no las posiciones, rotaciones ni espejados", () => {
    const sinTipo = (lista: ComponenteEscena[]) => lista.map((c) => [c.x, c.y, c.rotacion, c.espejado]);
    expect(sinTipo(generarBanco(2000, 1, simbolosEscena012()))).toEqual(sinTipo(generarBanco(2000)));
  });
});
