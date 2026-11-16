// «Probar la fase 3b» (cierre 3b, etapa 4; docs/plan-cierre-3b.md, sección 7):
// - las filas y sus topes son los de la checklist de la netbook (una sola
//   fuente en el código; el .md se compara contra ella);
// - cada fila se juzga bien en el borde de su tope;
// - el texto para copiar repite las columnas de la checklist;
// - los escenarios se reusan (los mismos objetos del banco), no se copian, y
//   el banco entra en la app solo por `import()`.
import { afterAll, describe, expect, it } from "vitest";
import checklist from "../../docs/netbook-fase3b.md?raw";
import fuenteBanco from "../../tests/bench/escenarios.ts?raw";
import * as banco from "../../tests/bench/escenarios";
import { TOPE_PREVIA_PEGAR } from "../editor/herramientas/pegar";
import {
  corre,
  elegir,
  ESCENARIO,
  ESCENARIOS_500,
  evaluar,
  FILAS,
  OBLIGATORIOS_CABLES,
  textoParaCopiar,
  type FilaEvaluada,
  type MedidaFase3b,
} from "./fase3b";

/** Celdas de las filas «| Bn | …» de una tabla en Markdown. */
function celdas(texto: string): string[][] {
  return texto
    .split(/\r?\n/)
    .filter((l) => /^\| B\d+ \|/.test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
}

/** La tabla de la sección B de la checklist: #, escenario, medida, tope, origen, PC, netbook. */
const tablaB = celdas(checklist.slice(checklist.indexOf("## B."), checklist.indexOf("## C.")));

describe("las filas son las de docs/netbook-fase3b.md", () => {
  it("B1 a B16, en el mismo orden", () => {
    expect(tablaB.map((c) => c[0])).toEqual(Array.from({ length: 16 }, (_, i) => `B${i + 1}`));
    expect(FILAS.map((f) => f.id)).toEqual(tablaB.map((c) => c[0]));
  });

  it.each(tablaB.map((c) => [c[0]!, c] as const))("%s: escenario, medida y tope iguales", (id, c) => {
    const f = FILAS.find((x) => x.id === id)!;
    expect([f.escenario, f.medida, f.tope]).toEqual([c[1], c[2], c[3]]);
  });
});

// ── Mediciones armadas a mano ───────────────────────────────────────────────

const SERIE = [40, 80, 160, 320, 500];
const previa = (n: number) => `Previa de pegar ${n} al 31 %`;
const paso = (mediana: number, maximo: number) => ({ mediana, p95: maximo, maximo });

/** Una corrida en la que todo pasa, con los valores de la PC (columna «PC» de la checklist). */
function todoBien(): MedidaFase3b[] {
  return [
    { escenario: ESCENARIO.encuadrar, cuadros: 16, maximo: 10, lentos: 0, sobreCuadro: 0, porGesto: 8 },
    { escenario: ESCENARIO.borrar, cuadros: 40, maximo: 6, lentos: 0, sobreCuadro: 0, porGesto: 8.25 },
    ...SERIE.map((n) => ({ escenario: previa(n), cuadros: 120, maximo: 5, lentos: 0, sobreCuadro: 0, porGesto: 60, revision: { p95: 0.9 } })),
    {
      escenario: ESCENARIO.pegar,
      cuadros: 40,
      maximo: 9,
      lentos: 0,
      sobreCuadro: 0,
      lentosPorPasoMax: 0,
      porGesto: 70,
      paso: paso(5.8, 8.8),
      pasoImpar: paso(1.7, 3.6),
    },
    {
      escenario: ESCENARIO.duplicar,
      cuadros: 10,
      maximo: 12,
      lentos: 0,
      sobreCuadro: 0,
      lentosPorPasoMax: 0,
      porGesto: 45,
      paso: paso(49, 91),
      pasoImpar: paso(10, 17),
    },
    { escenario: ESCENARIO.rehacerReferencias, cuadros: 12, maximo: 9, lentos: 0, sobreCuadro: 0, porGesto: 22.6 },
    { escenario: ESCENARIO.moverContacto, cuadros: 30, maximo: 3, lentos: 0, sobreCuadro: 0, porGesto: 11, paso: paso(1.1, 2) },
    { escenario: ESCENARIO.cable, cuadros: 30, maximo: 4, lentos: 0, sobreCuadro: 0, porGesto: 4, r6: Array(20).fill(0.1) },
  ];
}

/** Una corrida en la que todo pasa, con un cambio. */
function con(cambiar: (m: Map<string, MedidaFase3b>) => void): FilaEvaluada[] {
  const m = new Map(todoBien().map((x) => [x.escenario, structuredClone(x)]));
  cambiar(m);
  return evaluar([...m.values()]);
}
const fila = (filas: FilaEvaluada[], id: string) => filas.find((f) => f.id === id)!;
const resultado = (filas: FilaEvaluada[], id: string) => fila(filas, id).resultado;

describe("evaluar", () => {
  it("con todo bien, pasan todas menos B9, que se anota", () => {
    const filas = evaluar(todoBien());
    expect(filas.filter((f) => f.resultado !== "pasa").map((f) => f.id)).toEqual(["B9"]);
    expect(fila(filas, "B9")).toMatchObject({ resultado: "se anota", valor: "N = 500" });
    expect(fila(filas, "B1").valor).toBe("49,0 / 91,0 ms");
    expect(fila(filas, "B16").valor).toBe("0 lentos; 8,3 ms");
  });

  it("B1 y B2: paso y deshacer de duplicar, en el borde (×2,5 de 150/300 y 40/80)", () => {
    expect(resultado(con((m) => (m.get(ESCENARIO.duplicar)!.paso!.mediana = 375)), "B1")).toBe("pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.duplicar)!.paso!.mediana = 375.01)), "B1")).toBe("no pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.duplicar)!.paso!.maximo = 750)), "B1")).toBe("pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.duplicar)!.paso!.maximo = 750.01)), "B1")).toBe("no pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.duplicar)!.pasoImpar!.mediana = 100.01)), "B2")).toBe("no pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.duplicar)!.pasoImpar!.maximo = 200.01)), "B2")).toBe("no pasa");
  });

  it("B4 y B5: pegar y deshacer (×2,5 de 40/80)", () => {
    expect(resultado(con((m) => (m.get(ESCENARIO.pegar)!.paso!.mediana = 100)), "B4")).toBe("pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.pegar)!.paso!.mediana = 100.01)), "B4")).toBe("no pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.pegar)!.pasoImpar!.maximo = 200.01)), "B5")).toBe("no pasa");
  });

  it("B3 y B6: hasta 1 lento por gesto y ninguno de más de 100 ms", () => {
    expect(resultado(con((m) => (m.get(ESCENARIO.duplicar)!.lentosPorPasoMax = 1)), "B3")).toBe("pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.duplicar)!.lentosPorPasoMax = 2)), "B3")).toBe("no pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.duplicar)!.maximo = 100)), "B3")).toBe("pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.duplicar)!.maximo = 100.01)), "B3")).toBe("no pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.pegar)!.lentosPorPasoMax = 2)), "B6")).toBe("no pasa");
  });

  it("B7 y B9: la revisión por punto de la previa (×2,5 de 5 ms) y el mayor N", () => {
    const justo = con((m) => (m.get(previa(TOPE_PREVIA_PEGAR))!.revision!.p95 = 12.5));
    expect(resultado(justo, "B7")).toBe("pasa");
    const pasado = con((m) => (m.get(previa(TOPE_PREVIA_PEGAR))!.revision!.p95 = 12.51));
    expect(resultado(pasado, "B7")).toBe("no pasa");
    // Con 160 pasado, el mayor N es 80 (aunque 320 y 500 pasen) y avisa.
    expect(fila(pasado, "B9")).toMatchObject({ resultado: "se anota", valor: "N = 80; menos de 160: revisar `TOPE_PREVIA_PEGAR`" });
    expect(fila(con((m) => (m.get(previa(40))!.revision!.p95 = 13)), "B9").valor).toMatch(/^N = ninguno/);
  });

  it("B8, B11 y B14: ninguno de más de 50 ms y menos de 1 % de más de 16,7 ms", () => {
    expect(resultado(con((m) => (m.get(previa(500))!.maximo = 50)), "B8")).toBe("pasa");
    expect(resultado(con((m) => (m.get(previa(500))!.maximo = 50.01)), "B8")).toBe("no pasa");
    // La serie suma 600 cuadros: 5 son 0,83 % y 6 son el 1 % justo, que no pasa.
    expect(resultado(con((m) => (m.get(previa(80))!.sobreCuadro = 5)), "B8")).toBe("pasa");
    expect(resultado(con((m) => (m.get(previa(80))!.sobreCuadro = 6)), "B8")).toBe("no pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.rehacerReferencias)!.maximo = 51)), "B11")).toBe("no pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.cable)!.sobreCuadro = 1)), "B14")).toBe("no pasa");
  });

  it("B10, B12 y B13: rehacer con referencias, mover un contacto y R6", () => {
    expect(resultado(con((m) => (m.get(ESCENARIO.rehacerReferencias)!.porGesto = 62.5)), "B10")).toBe("pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.rehacerReferencias)!.porGesto = 62.51)), "B10")).toBe("no pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.moverContacto)!.paso!.mediana = 4.5)), "B12")).toBe("pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.moverContacto)!.paso!.mediana = 4.51)), "B12")).toBe("no pasa");
    // 40 pasadas de R6: el p95 es la 39.ª ordenada (índice ⌊0,95·40⌋ = 38), como en el banco.
    const r6 = (...altas: number[]) => [...Array(40 - altas.length).fill(0.1), ...altas];
    expect(resultado(con((m) => (m.get(ESCENARIO.cable)!.r6 = r6(20))), "B13")).toBe("pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.cable)!.r6 = r6(20.01))), "B13")).toBe("no pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.cable)!.r6 = r6(7.5, 7.5))), "B13")).toBe("pasa");
    expect(resultado(con((m) => (m.get(ESCENARIO.cable)!.r6 = r6(7.6, 7.6))), "B13")).toBe("no pasa");
  });

  it("B15 y B16: un lento ya no pasa; B16 informa el tiempo por gesto", () => {
    expect(resultado(con((m) => (m.get(ESCENARIO.encuadrar)!.lentos = 1)), "B15")).toBe("no pasa");
    const borrar = con((m) => Object.assign(m.get(ESCENARIO.borrar)!, { lentos: 1, porGesto: 12 }));
    expect(fila(borrar, "B16")).toMatchObject({ resultado: "no pasa", valor: "1 lentos; 12,0 ms" });
  });

  it("si falta un escenario, falla en vez de dar «pasa»", () => {
    expect(() => evaluar(todoBien().filter((x) => x.escenario !== ESCENARIO.cable))).toThrow(/Dibujar 1 cable/);
  });
});

describe("texto para copiar", () => {
  const texto = textoParaCopiar(evaluar(todoBien()), "Probar la fase 3b · prueba");

  it("cada fila repite #, escenario, medida y tope de la checklist", () => {
    const filas = celdas(texto);
    expect(filas.map((c) => c.slice(0, 4))).toEqual(tablaB.map((c) => c.slice(0, 4)));
    expect(filas.map((c) => c[5])).toEqual([...Array(8).fill("pasa"), "se anota", ...Array(7).fill("pasa")]);
  });

  it("encabezado, columnas y resumen", () => {
    const lineas = texto.split("\n");
    expect(lineas[0]).toBe("Probar la fase 3b · prueba");
    expect(lineas[2]).toBe("| # | Escenario | Medida | Tope netbook | Netbook | Resultado |");
    expect(lineas.at(-1)).toBe("Pasan 15 · no pasan 0 · se anotan 1.");
  });
});

describe("los escenarios se reusan del banco, no se copian", () => {
  const ed = banco.abrirEditorCables(false);
  const cables = banco.escenariosCables(false);
  afterAll(() => banco.cerrarEditorCables());

  it("elegir da los mismos objetos del banco, en su orden", () => {
    const de500 = elegir(banco.ESCENARIOS, (n) => ESCENARIOS_500.includes(n), ESCENARIOS_500);
    const deCables = elegir(cables, corre, OBLIGATORIOS_CABLES);
    expect(de500).toHaveLength(1);
    for (const [lista, elegidos] of [
      [banco.ESCENARIOS, de500],
      [cables, deCables],
    ] as const) {
      // indexOf compara por identidad: -1 sería una copia.
      const indices = elegidos.map((e) => (lista as readonly unknown[]).indexOf(e));
      for (const [k, i] of indices.entries()) expect(lista[i]).toBe(elegidos[k]);
      expect([...indices].sort((a, b) => a - b)).toEqual(indices);
    }
    expect(deCables.map((e) => e.nombre)).toEqual([
      ESCENARIO.borrar,
      ...SERIE.map(previa),
      ESCENARIO.pegar,
      ESCENARIO.duplicar,
      ESCENARIO.rehacerReferencias,
      ESCENARIO.moverContacto,
      ESCENARIO.cable,
    ]);
    expect(ed.escena.cantidadCables).toBeGreaterThan(3000);
  });

  it("la serie de la previa del banco es la de la fila B8 y tiene el tope de B7", () => {
    const serie = cables.map((e) => /^Previa de pegar (\d+) al 31 %$/.exec(e.nombre)?.[1]).filter(Boolean).map(Number);
    expect(serie).toContain(TOPE_PREVIA_PEGAR);
    expect(FILAS.find((f) => f.id === "B8")!.escenario).toBe(`Previa de pegar, ${serie[0]} a ${serie.at(-1)}`);
  });

  it("si el banco cambia un nombre, elegir falla", () => {
    expect(() => elegir(cables, corre, [...OBLIGATORIOS_CABLES, "Pegar 501 y deshacer al 31 %"])).toThrow(/Pegar 501/);
  });
});

describe("el banco entra en la app solo por import()", () => {
  /** Código de src/ que va en la app (sin los tests). */
  const fuentes = import.meta.glob<string>(["../**/*.ts", "../**/*.svelte", "!../**/*.test.ts"], {
    query: "?raw",
    import: "default",
    eager: true,
  });

  it("solo probarFase3b.ts lo importa, y con import() (un archivo aparte, que se pide al tocar el botón)", () => {
    const importan = Object.entries(fuentes).filter(([, s]) => /(?:from\s+|import\s*\(\s*)["'][^"']*tests\/bench/.test(s));
    expect(importan.map(([f]) => f)).toEqual(["./probarFase3b.ts"]);
    const s = importan[0]![1];
    expect(s).toMatch(/\bimport\("\.\.\/\.\.\/tests\/bench\/escenarios"\)/);
    expect(s).not.toMatch(/from\s+["'][^"']*tests\/bench/);
  });

  /**
   * Nombres del banco que ya existían en src/ con otro código (helpers
   * genéricos y la prueba del arrastre de alpha.2): no son copias.
   */
  const PREEXISTENTES = [
    "../core/model/reconectar.ts: contexto",
    "../editor/punteros.ts: evento",
    "../render/capas.ts: medir",
    "./diagnosticoArrastre.ts: hechos",
    "./diagnosticoArrastre.ts: evento",
    "./diagnosticoArrastre.ts: soltarTodo",
  ];

  it("ningún archivo de src/ define una función del banco", () => {
    const nombres = [...fuenteBanco.matchAll(/^(?:export )?(?:async )?function (\w+)|^(?:export )?const (\w+)(?::[^=]+)? = (?:\(|async)/gm)].map(
      (m) => (m[1] ?? m[2])!,
    );
    expect(nombres).toEqual(expect.arrayContaining(["medir", "pegarYDeshacer", "duplicarYDeshacer", "borrarYDeshacer", "escenariosPegar", "escenariosCables"]));
    const definidas = Object.entries(fuentes).flatMap(([f, s]) =>
      nombres.filter((n) => new RegExp(`\\bfunction ${n}\\s*[(<]|\\b(?:const|let) ${n}\\s*(?::[^=]+)?=\\s*(?:\\(|async|function)`).test(s)).map((n) => `${f}: ${n}`),
    );
    expect(definidas.filter((d) => !PREEXISTENTES.includes(d))).toEqual([]);
  });
});
