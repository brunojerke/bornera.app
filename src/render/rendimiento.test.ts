import { describe, expect, it } from "vitest";
import { MedidorRendimiento, VENTANA_MS, type MedidaCuadro } from "./rendimiento";

function medida(total: number, mosaicos = 0): MedidaCuadro {
  return {
    total,
    mosaicos,
    estatica: mosaicos ? total : 0,
    pendiente: false,
    esperar: 0,
    dibujados: 10,
    componentes: 100,
  };
}

describe("MedidorRendimiento", () => {
  it("cuenta los cuadros del último segundo", () => {
    const m = new MedidorRendimiento();
    for (let i = 0; i < 30; i++) m.registrar(i * 16, medida(2));
    expect(m.resumen(30 * 16).fps).toBe(30);
  });

  it("sin cuadros nuevos, los FPS caen a 0 (en reposo)", () => {
    const m = new MedidorRendimiento();
    m.registrar(0, medida(5));
    m.registrar(16, medida(3));
    expect(m.resumen(500).fps).toBe(2);
    expect(m.resumen(16 + VENTANA_MS).fps).toBe(0);
    // El último tiempo sigue a la vista aunque esté en reposo.
    expect(m.resumen(5000).ultimo).toBe(3);
  });

  it("promedia, toma el máximo y suma los mosaicos rehechos", () => {
    const m = new MedidorRendimiento();
    m.registrar(0, medida(10, 4));
    m.registrar(16, medida(2));
    m.registrar(32, medida(3, 1));
    const r = m.resumen(40);
    expect(r.promedio).toBe(5);
    expect(r.maximo).toBe(10);
    expect(r.mosaicos).toBe(5);
    expect(r.estatica).toBe(3); // el último cuadro que rehízo mosaicos
    expect(r.dibujados).toBe(10);
    expect(r.componentes).toBe(100);
  });
});
