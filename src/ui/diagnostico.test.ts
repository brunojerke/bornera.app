import { describe, expect, it } from "vitest";
import { LIMITE_LENTO_MS } from "../render/rendimiento";
import {
  COMBINACIONES,
  estadisticas,
  recorrido,
  resumirPasada,
  tablaDiagnostico,
  ZOOMS_DIAGNOSTICO,
  type ResultadoCombinacion,
} from "./diagnostico";

describe("Diagnóstico del arrastre", () => {
  it("prueba las 6 combinaciones pedidas, al 58 % y al 73 %", () => {
    expect(COMBINACIONES.map((c) => [c.modo, c.cache])).toEqual([
      ["nada", false],
      ["contornos", false],
      ["sinTextosNiBornes", false],
      ["sinTextos", false],
      ["completos", false],
      ["completos", true],
    ]);
    expect(ZOOMS_DIAGNOSTICO).toEqual([0.58, 0.73]);
  });

  it("el recorrido es siempre el mismo y cambia de punto de grilla casi en cada cuadro", () => {
    expect(recorrido(0)).toEqual({ dx: 0, dy: 0 });
    expect(recorrido(1234)).toEqual(recorrido(1234));
    let cambios = 0;
    for (let t = 16.7; t < 2000; t += 16.7) {
      const a = recorrido(t - 16.7);
      const b = recorrido(t);
      if (Math.round(a.dx) !== Math.round(b.dx) || Math.round(a.dy) !== Math.round(b.dy)) cambios++;
    }
    expect(cambios).toBeGreaterThan(60); // de 119 cuadros en 2 s
  });

  it("estadísticas: promedio, p95 y máximo", () => {
    expect(estadisticas([])).toEqual({ promedio: 0, p95: 0, maximo: 0 });
    const valores = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(estadisticas(valores)).toEqual({ promedio: 50.5, p95: 96, maximo: 100 });
  });

  it("una pasada: tiempo entre cuadros por los instantes, lentos como en F3 (dibujo > 16 ms)", () => {
    const r = resumirPasada({
      instantes: [0, 16, 33, 70],
      dibujo: [5, LIMITE_LENTO_MS, LIMITE_LENTO_MS + 0.1, 30],
      muestras: [3, 4],
      aciertos: 10,
      fallos: 1,
    });
    expect(r.cuadros).toBe(4);
    expect(r.entreCuadros.maximo).toBe(37);
    expect(r.entreCuadros.promedio).toBeCloseTo(70 / 3);
    expect(r.lentos).toBe(2); // 16 justo no es lento
    expect(r.dinamica.promedio).toBe(3.5);
    expect(r.muestras).toBe(2);
  });

  it("la tabla tiene una fila por zoom y combinación, con el costo de medir", () => {
    const pasada = (dibujo: number, muestras: number[]) =>
      resumirPasada({ instantes: [0, 17, 34], dibujo: [dibujo, dibujo, dibujo], muestras, aciertos: 5, fallos: 0 });
    const resultados: ResultadoCombinacion[] = ZOOMS_DIAGNOSTICO.flatMap((zoom) =>
      COMBINACIONES.map((combinacion) => ({ zoom, combinacion, sinSonda: pasada(10, []), conSonda: pasada(10.5, [4]) })),
    );
    const tabla = tablaDiagnostico(
      { version: "0.1.3-alpha.2", navegador: "Prueba", ancho: 1024, alto: 600, dpr: 1, fecha: "2026-11-08 12:00", arrastrados: 40, duracionMs: 5000 },
      resultados,
    );
    const filas = tabla.split("\n").filter((l) => /^\| \d+ %/.test(l));
    expect(filas).toHaveLength(12);
    expect(filas[0]).toContain("| 58 % | base (sin dibujar arrastrados) | 3 |");
    expect(filas[0]).toContain("+0,5"); // costo de medir
    expect(filas[5]).toContain("completos con caché");
    expect(filas[5]).toMatch(/\| 5 \/ 0 \|$/); // aciertos / fallos solo con caché
    expect(filas[4]).toMatch(/\| – \|$/);
    expect(tabla).toContain("0.1.3-alpha.2");
    expect(tabla).toContain(`más de ${LIMITE_LENTO_MS} ms de dibujo`);
  });
});
