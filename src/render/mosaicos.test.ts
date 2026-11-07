import { describe, expect, it } from "vitest";
import type { RendererCanvas } from "./canvas2d";
import { contextoFalso } from "./falsos";
import { BYTES_MOSAICO, clave, Mosaicos, RESERVA_LIBRES, TAM_MOSAICO, type Mosaico } from "./mosaicos";

function armar() {
  const creados: Mosaico[] = [];
  const mos = new Mosaicos(() => {
    const m: Mosaico = {
      ctx: contextoFalso(TAM_MOSAICO, TAM_MOSAICO).ctx,
      r: null as unknown as RendererCanvas,
      k: NaN,
      i: 0,
      j: 0,
      usado: 0,
    };
    creados.push(m);
    return m;
  });
  return { mos, creados };
}

const MUCHOS = 1000;

describe("Mosaicos", () => {
  it("registra cada mosaico en su nivel y su lugar", () => {
    const { mos } = armar();
    mos.cambiarNivel(20);
    const m = mos.tomar(3, -2, 1, MUCHOS);
    expect(m).toMatchObject({ k: 20, i: 3, j: -2, usado: 1 });
    expect(mos.actuales.get(clave(3, -2))).toBe(m);
    expect(mos.hayAlgo).toBe(true);
    expect(mos.memoria).toBe(BYTES_MOSAICO);
  });

  it("al cambiar de nivel, los actuales pasan a viejos (del más viejo al más nuevo)", () => {
    const { mos } = armar();
    mos.cambiarNivel(20);
    const a = mos.tomar(0, 0, 1, MUCHOS);
    mos.cambiarNivel(10);
    const b = mos.tomar(0, 0, 2, MUCHOS);
    mos.cambiarNivel(5);
    expect(mos.viejos).toEqual([a, b]);
    expect(mos.actuales.size).toBe(0);
    expect(mos.k).toBe(5);
  });

  it("reusa los canvas sueltos antes de crear otros", () => {
    const { mos, creados } = armar();
    mos.cambiarNivel(20);
    for (let i = 0; i < 3; i++) mos.tomar(i, 0, 1, MUCHOS);
    mos.cambiarNivel(10);
    mos.soltarViejos();
    for (let i = 0; i < 3; i++) mos.tomar(i, 0, 2, MUCHOS);
    expect(creados).toHaveLength(3);
  });

  it("con el máximo alcanzado, descarta el que hace más que no se usa (a igualdad, uno viejo)", () => {
    const { mos, creados } = armar();
    mos.cambiarNivel(20);
    const viejo = mos.tomar(0, 0, 1, 3);
    mos.cambiarNivel(10);
    const a = mos.tomar(0, 0, 1, 3);
    const b = mos.tomar(1, 0, 2, 3);
    // Lleno (3): el siguiente reusa el del cuadro 1; entre el viejo y `a`, el viejo.
    const c = mos.tomar(2, 0, 3, 3);
    expect(c).toBe(viejo);
    expect(mos.viejos).toHaveLength(0);
    expect(mos.tomar(3, 0, 3, 3)).toBe(a);
    expect(mos.actuales.has(clave(0, 0))).toBe(false);
    expect(creados).toHaveLength(3);
    expect(mos.actuales.get(clave(1, 0))).toBe(b);
  });

  it("nunca descarta uno usado en este cuadro: si hace falta, crea otro", () => {
    const { mos, creados } = armar();
    mos.cambiarNivel(20);
    mos.tomar(0, 0, 7, 1);
    mos.tomar(1, 0, 7, 1);
    expect(creados).toHaveLength(2);
    expect(mos.actuales.size).toBe(2);
  });

  it("guarda pocos canvas sueltos y suelta la memoria del resto", () => {
    const { mos, creados } = armar();
    mos.cambiarNivel(20);
    for (let i = 0; i < RESERVA_LIBRES + 3; i++) mos.tomar(i, 0, 1, MUCHOS);
    mos.vaciar();
    expect(mos.hayAlgo).toBe(false);
    expect(mos.cantidad).toBe(RESERVA_LIBRES);
    expect(creados.filter((m) => m.ctx.canvas.width === 0)).toHaveLength(3);

    mos.liberar();
    expect(mos.cantidad).toBe(0);
    expect(mos.memoria).toBe(0);
    expect(creados.every((m) => m.ctx.canvas.width === 0)).toBe(true);
    expect(Number.isNaN(mos.k)).toBe(true);
  });
});
