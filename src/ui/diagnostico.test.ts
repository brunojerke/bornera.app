import { describe, expect, it } from "vitest";
import { LIMITE_LENTO_MS } from "../render/rendimiento";
import {
  COMBINACIONES,
  criteriosT14a,
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
      pasos: [2, 9, 1],
      rechazados: 4,
    });
    expect(r.cuadros).toBe(4);
    expect(r.entreCuadros.maximo).toBe(37);
    expect(r.entreCuadros.promedio).toBeCloseTo(70 / 3);
    expect(r.lentos).toBe(2); // 16 justo no es lento
    expect(r.dinamica.promedio).toBe(3.5);
    expect(r.muestras).toBe(2);
    expect(r.paso).toEqual({ mediana: 2, maximo: 9, cantidad: 3, rechazados: 4 });
  });

  it("la tabla tiene una fila por zoom y combinación, con el costo de medir", () => {
    const pasada = (dibujo: number, muestras: number[]) =>
      resumirPasada({ instantes: [0, 17, 34], dibujo: [dibujo, dibujo, dibujo], muestras, aciertos: 5, fallos: 0, pasos: [], rechazados: 0 });
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
    // Sin cables no hay soltar ni tope; los criterios igual se informan.
    expect(tabla).not.toContain("Soltar con todo seleccionado");
    expect(tabla).not.toContain("Paso de la previa");
  });

  /** Resultados con la fila de referencia (58 %, completos con caché) dada. */
  function conReferencia(dibujo: number[], pasos: number[]): ResultadoCombinacion[] {
    const vacia = resumirPasada({ instantes: [0, 17], dibujo: [1, 1], muestras: [], aciertos: 0, fallos: 0, pasos: [], rechazados: 0 });
    return COMBINACIONES.map((combinacion) => {
      const ref = combinacion.modo === "completos" && combinacion.cache;
      const instantes = dibujo.map((_, i) => i * 17);
      const sinSonda = ref ? resumirPasada({ instantes, dibujo, muestras: [], aciertos: 0, fallos: 0, pasos, rechazados: 0 }) : vacia;
      return { zoom: 0.58, combinacion, sinSonda, conSonda: vacia };
    });
  }
  const soltar = (comando: number, primerCuadro: number, aplicado = true, pasoTodo = 20) => ({
    seleccionados: 5030,
    comando,
    primerCuadro,
    hastaNitida: 400,
    aplicado,
    paso: { mediana: pasoTodo, maximo: pasoTodo + 5, cantidad: 12 },
  });

  it("criterios de T14a sobre 58 %, completos con caché: promedio, máximo, lentos, paso mediano, soltar y paso con todo", () => {
    const bien = criteriosT14a(conReferencia([10, 12, 14], [3, 4, 5]), soltar(120, 60));
    expect(bien.map((k) => k.ok)).toEqual([true, true, true, true, true, true]);
    const mal = criteriosT14a(conReferencia([10, 30, ...Array(10).fill(17)], [9, 9, 2]), soltar(150, 60, true, 33));
    expect(mal.map((k) => k.ok)).toEqual([false, false, false, false, false, false]);
    // Un soltar rechazado no pasa aunque sea rápido; sin pasos, el paso no pasa.
    expect(criteriosT14a(conReferencia([10], []), soltar(1, 1, false)).map((k) => k.ok)).toEqual([true, true, true, false, false, true]);
    const sinPasos = { ...soltar(1, 1), paso: { mediana: 0, maximo: 0, cantidad: 0 } };
    expect(criteriosT14a(conReferencia([10], [3]), sinPasos).map((k) => k.ok)).toEqual([true, true, true, true, true, false]);
    expect(criteriosT14a([], null)).toEqual([]);
  });

  it("con cables, la tabla suma el paso, el soltar, el tope y la aceptación", () => {
    const tabla = tablaDiagnostico(
      { version: "0.1.3-alpha.5", navegador: "Prueba", ancho: 1024, alto: 600, dpr: 1, fecha: "2026-11-09 12:00", arrastrados: 40, duracionMs: 5000, escena: "2000 + 3000 cables + 30 T" },
      conReferencia([10, 12, 14], [3, 4, 5]),
      {
        soltar: soltar(120, 60),
        soltarGrupo: { comando: 12.5 },
        tope: [{ cables: 152, mediana: 3.04, maximo: 5, rechazados: 0, pasos: 20 }],
      },
    );
    expect(tabla).toContain("escena 2000 + 3000 cables + 30 T");
    expect(tabla.split("\n").find((l) => l.includes("completos con caché"))).toContain("| 4,0 / 5,0 · 3 válidos · ✕ 0 |");
    expect(tabla).toContain("**Soltar con todo seleccionado** (5030): comando 120,0 ms · primer cuadro 60,0 ms");
    expect(tabla).toContain("| 152 | 3,0 | 5,0 | 0,020 | 20 de 20 |");
    expect(tabla).toContain("**Soltar los 40 en (3, 2)**: un paso, comando 12,5 ms");
    expect(tabla).toContain("- ✓ paso mediano 4,0 ms < 8");
    expect(tabla).toContain("- ✓ soltar con todo seleccionado 180,0 ms (comando + primer cuadro) ≤ 200");
    expect(tabla).toContain("**Arrastrar con todo seleccionado** (5030): paso de la previa 20,0 / 25,0 ms (mediana / máx., 12 puntos de grilla).");
    expect(tabla).toContain("- ✓ paso de la previa con todo seleccionado 20,0 ms (mediana) < 33");
  });
});
