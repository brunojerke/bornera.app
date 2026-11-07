import { describe, expect, it } from "vitest";
import { LIMITE_LENTO_MS, MedidorRendimiento, VENTANA_LENTOS_MS, VENTANA_MS, type MedidaCuadro } from "./rendimiento";

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

  it(`cuenta los cuadros de más de ${LIMITE_LENTO_MS} ms de los últimos ${VENTANA_LENTOS_MS / 1000} s`, () => {
    const m = new MedidorRendimiento();
    m.registrar(0, medida(LIMITE_LENTO_MS + 5));
    m.registrar(100, medida(LIMITE_LENTO_MS)); // justo en el límite: no es lento
    m.registrar(2000, medida(40));
    m.registrar(2016, medida(3));
    expect(m.resumen(2100).lentos).toBe(2);
    // Pasado un segundo ya no hay FPS, pero los lentos siguen contando hasta los 5 s.
    expect(m.resumen(4000).fps).toBe(0);
    expect(m.resumen(4000).lentos).toBe(2);
    expect(m.resumen(VENTANA_LENTOS_MS + 1).lentos).toBe(1);
    expect(m.resumen(2000 + VENTANA_LENTOS_MS).lentos).toBe(0);
  });
});
