// Test de bornes de cada símbolo de la biblioteca.
import { describe, expect, it } from "vitest";
import {
  BOBINA_CONTACTOR,
  buscarSimbolo,
  CONTACTO_AUXILIAR_NA,
  CONTACTO_AUXILIAR_NC,
  CONTACTOR_PRINCIPAL,
  DIFERENCIAL_BIPOLAR,
  DIFERENCIAL_TETRAPOLAR,
  discontinua,
  FASE,
  FINAL_NA,
  FINAL_NC,
  FUENTE_TRIFASICA,
  FUENTE_TRIFASICA_N,
  BOCINA,
  FUSIBLE,
  FUSIBLE_TRIPOLAR,
  GUARDAMOTOR,
  LAMPARA,
  MOTOR_ESTRELLA_TRIANGULO,
  MOTOR_TRIFASICO,
  NEUTRO,
  PULSADOR_NA,
  PULSADOR_NC,
  SECCIONADOR,
  SELECTOR,
  SETA,
  SIMBOLOS,
  TERMICO,
  TERMICO_NA,
  TERMICO_NC,
  TERMOMAGNETICA_BIPOLAR,
  TERMOMAGNETICA_TETRAPOLAR,
  TERMOMAGNETICA_TRIPOLAR,
  TERMOMAGNETICA_UNIPOLAR,
  TIERRA,
} from "./biblioteca";
import { esFuente, esSeguidor, nombraRed, polosDe, type DefinicionSimbolo, type Primitiva, type Rotacion } from "./tipos";
import { transformarBornes } from "./transformar";
import { validarDefinicion } from "./validar";

const ROTACIONES: Rotacion[] = [0, 90, 180, 270];

/** Bornes esperados de los símbolos de dos bornes: [arriba, abajo], siempre en (0, −2) y (0, 2). */
const ESPERADOS: [DefinicionSimbolo, string, string][] = [
  [PULSADOR_NA, "13", "14"],
  [PULSADOR_NC, "11", "12"],
  [BOBINA_CONTACTOR, "A1", "A2"],
  [CONTACTO_AUXILIAR_NA, "13", "14"],
  [CONTACTO_AUXILIAR_NC, "21", "22"],
  [LAMPARA, "X1", "X2"],
  // Mando (T36).
  [SELECTOR, "13", "14"],
  [SETA, "11", "12"],
  [FINAL_NA, "13", "14"],
  [FINAL_NC, "11", "12"],
  [TERMICO_NC, "95", "96"],
  [TERMICO_NA, "97", "98"],
  [FUSIBLE, "1", "2"],
  [BOCINA, "X1", "X2"],
];

/** Extremos de una primitiva, para ver si cae dentro de la caja. */
function extremos(p: Primitiva): [number, number][] {
  switch (p.forma) {
    case "linea":
      return [
        [p.x1, p.y1],
        [p.x2, p.y2],
      ];
    case "arco":
    case "circulo":
      return [
        [p.cx - p.r, p.cy - p.r],
        [p.cx + p.r, p.cy + p.r],
      ];
    case "rectangulo":
      return [
        [p.x, p.y],
        [p.x + p.ancho, p.y + p.alto],
      ];
    case "texto":
      return [[p.x, p.y]];
  }
}

describe("biblioteca de símbolos", () => {
  it("tiene los 32 símbolos, con tipos únicos", () => {
    expect(SIMBOLOS).toHaveLength(32);
    expect(new Set(SIMBOLOS.map((s) => s.tipo)).size).toBe(SIMBOLOS.length);
  });

  it("los tipos no llevan ñ, tildes ni mayúsculas", () => {
    for (const s of SIMBOLOS) expect(s.tipo).toMatch(/^[a-z_]+\.[a-z_]+$/);
  });

  it("busca por tipo", () => {
    expect(buscarSimbolo("contactor.bobina")).toBe(BOBINA_CONTACTOR);
    expect(buscarSimbolo("no.existe")).toBeUndefined();
  });

  it.each(SIMBOLOS.map((s) => [s.tipo, s] as const))("%s es una definición válida", (_, s) => {
    expect(validarDefinicion(s)).toEqual([]);
  });

  it.each(ESPERADOS.map(([s, a, b]) => [s.tipo, s, a, b] as const))(
    "%s tiene los bornes %s (arriba) y %s (abajo)",
    (_, s, arriba, abajo) => {
      expect(s.bornes).toEqual([
        { nombre: arriba, x: 0, y: -2, direccion: "arriba" },
        { nombre: abajo, x: 0, y: 2, direccion: "abajo" },
      ]);
    },
  );

  it.each(SIMBOLOS.map((s) => [s.tipo, s] as const))("%s se dibuja dentro de su caja", (_, s) => {
    const { ancho, alto } = s.tamano;
    for (const p of s.primitivas) {
      for (const [x, y] of extremos(p)) {
        expect(Math.abs(x)).toBeLessThanOrEqual(ancho / 2 + 1e-9);
        expect(Math.abs(y)).toBeLessThanOrEqual(alto / 2 + 1e-9);
      }
    }
  });

  it.each(SIMBOLOS.map((s) => [s.tipo, s] as const))(
    "%s llega con una línea hasta cada borne",
    (_, s) => {
      for (const b of s.bornes) {
        const toca = s.primitivas.some(
          (p) => p.forma === "linea" && ((p.x1 === b.x && p.y1 === b.y) || (p.x2 === b.x && p.y2 === b.y)),
        );
        expect(toca, `borne ${b.nombre}`).toBe(true);
      }
    },
  );

  it.each(SIMBOLOS.map((s) => [s.tipo, s] as const))(
    "%s queda en la grilla en las 4 rotaciones, espejado o no",
    (_, s) => {
      for (const rotacion of ROTACIONES) {
        for (const espejado of [false, true]) {
          for (const b of transformarBornes(s.bornes, { rotacion, espejado })) {
            expect(Number.isInteger(b.x) && Number.isInteger(b.y)).toBe(true);
          }
        }
      }
    },
  );

  it("pulsadores accionados a mano; los auxiliares, por la bobina", () => {
    expect(PULSADOR_NA).toMatchObject({ elemento: "contacto_na", accionamiento: "manual_momentaneo" });
    expect(PULSADOR_NC).toMatchObject({ elemento: "contacto_nc", accionamiento: "manual_momentaneo" });
    expect(CONTACTO_AUXILIAR_NA).toMatchObject({ elemento: "contacto_na", accionamiento: "bobina" });
    expect(CONTACTO_AUXILIAR_NC).toMatchObject({ elemento: "contacto_nc", accionamiento: "bobina" });
    expect(BOBINA_CONTACTOR.elemento).toBe("bobina");
    expect(LAMPARA).toMatchObject({ elemento: "carga", subgrupo: "senalizacion" });
  });
});

describe("contactos accionados (T33, D9-B)", () => {
  const CONTACTOS = [
    PULSADOR_NA,
    PULSADOR_NC,
    CONTACTO_AUXILIAR_NA,
    CONTACTO_AUXILIAR_NC,
    CONTACTOR_PRINCIPAL,
    SELECTOR,
    SETA,
    FINAL_NA,
    FINAL_NC,
    TERMICO_NC,
    TERMICO_NA,
  ];
  /** Las protecciones de cuchilla, cerradas en Simular (T36, D20-B); el fusible y el térmico se ven igual. */
  const CERRADAS = [
    TERMOMAGNETICA_UNIPOLAR,
    TERMOMAGNETICA_BIPOLAR,
    TERMOMAGNETICA_TRIPOLAR,
    TERMOMAGNETICA_TETRAPOLAR,
    DIFERENCIAL_BIPOLAR,
    DIFERENCIAL_TETRAPOLAR,
    GUARDAMOTOR,
    SECCIONADOR,
  ];
  /** La cuchilla: la línea que sale de la bisagra (0, 1) hacia arriba. */
  const cuchilla = (ps: readonly Primitiva[]) => ps.find((p) => p.forma === "linea" && p.x1 === 0 && p.y1 === 1 && p.y2 < 1);

  it("los 11 contactos y las 8 protecciones de cuchilla (T36, D20-B) tienen dibujo accionado; los demás símbolos no", () => {
    for (const s of SIMBOLOS) expect(s.primitivasAccionado !== undefined, s.tipo).toBe(CONTACTOS.includes(s) || CERRADAS.includes(s));
  });

  it.each(CONTACTOS.map((s) => [s.tipo, s] as const))("%s accionado: dentro de su caja, sin textos y con una línea hasta cada borne", (_, s) => {
    const a = s.primitivasAccionado!;
    const { ancho, alto } = s.tamano;
    for (const p of a) {
      expect(p.forma).not.toBe("texto");
      for (const [x, y] of extremos(p)) {
        expect(Math.abs(x)).toBeLessThanOrEqual(ancho / 2 + 1e-9);
        expect(Math.abs(y)).toBeLessThanOrEqual(alto / 2 + 1e-9);
      }
    }
    for (const b of s.bornes) {
      expect(a.some((p) => p.forma === "linea" && ((p.x1 === b.x && p.y1 === b.y) || (p.x2 === b.x && p.y2 === b.y))), b.nombre).toBe(true);
    }
  });

  it.each([PULSADOR_NA, CONTACTO_AUXILIAR_NA, CONTACTOR_PRINCIPAL, SELECTOR, FINAL_NA, TERMICO_NA].map((s) => [s.tipo, s] as const))("%s accionado está cerrado: la cuchilla llega al contacto fijo de arriba", (_, s) => {
    expect(cuchilla(s.primitivasAccionado!)).toMatchObject({ x2: 0, y2: -1 });
    expect(cuchilla(s.primitivas)).not.toMatchObject({ x2: 0, y2: -1 });
  });

  it.each([PULSADOR_NC, CONTACTO_AUXILIAR_NC, SETA, FINAL_NC, TERMICO_NC].map((s) => [s.tipo, s] as const))("%s accionado está abierto: la cuchilla se aparta del tope", (_, s) => {
    const reposo = cuchilla(s.primitivas) as Extract<Primitiva, { forma: "linea" }>;
    const accionada = cuchilla(s.primitivasAccionado!) as Extract<Primitiva, { forma: "linea" }>;
    // En reposo cruza el tope (x de 0 a 0,9 en y = −1); accionada queda a la izquierda.
    expect(reposo.x2).toBeGreaterThan(0);
    expect(accionada.x2).toBeLessThan(0);
    expect(s.primitivasAccionado).toContainEqual({ forma: "linea", x1: 0, y1: -1, x2: 0.9, y2: -1 });
  });

  it("el pulsador accionado deja el accionador donde está y los trazos llegan a la cuchilla", () => {
    for (const s of [PULSADOR_NA, PULSADOR_NC]) {
      const corchete = (ps: readonly Primitiva[]) => ps.filter((p) => p.forma === "linea" && p.x1 === -1.75);
      expect(corchete(s.primitivasAccionado!)).toEqual(corchete(s.primitivas));
      const c = cuchilla(s.primitivasAccionado!) as Extract<Primitiva, { forma: "linea" }>;
      const xEnCero = (c.x2 * 1) / (1 - c.y2);
      const trazos = s.primitivasAccionado!.filter((p) => p.forma === "linea" && p.y1 === 0 && p.y2 === 0);
      expect(Math.max(...trazos.map((p) => (p as Extract<Primitiva, { forma: "linea" }>).x1))).toBeCloseTo(xEnCero, 9);
    }
  });

  it("los de mando (T36) dejan su accionamiento donde está y los trazos llegan a la cuchilla", () => {
    for (const s of [SELECTOR, SETA, FINAL_NA, FINAL_NC, TERMICO_NC, TERMICO_NA]) {
      // El accionamiento: todo lo que no es línea, más las líneas a la izquierda de x = −1 fuera de y = 0.
      const cabeza = (ps: readonly Primitiva[]) =>
        ps.filter((p) => (p.forma === "linea" ? !(p.y1 === 0 && p.y2 === 0) && Math.max(p.x1, p.x2) < -1 : true));
      expect(cabeza(s.primitivasAccionado!), s.tipo).toEqual(cabeza(s.primitivas));
      expect(cabeza(s.primitivas).length, s.tipo).toBeGreaterThan(0);
      const c = cuchilla(s.primitivasAccionado!) as Extract<Primitiva, { forma: "linea" }>;
      const xEnCero = (c.x2 * 1) / (1 - c.y2);
      const trazos = s.primitivasAccionado!.filter((p) => p.forma === "linea" && p.y1 === 0 && p.y2 === 0);
      expect(Math.max(...trazos.map((p) => (p as Extract<Primitiva, { forma: "linea" }>).x1)), s.tipo).toBeCloseTo(xEnCero, 9);
    }
  });
});

describe("etiquetado: fuente, seguidor o prefijo (T17)", () => {
  it.each(SIMBOLOS.map((s) => [s.tipo, s] as const))("%s es fuente, seguidor o tiene prefijo, y no dos a la vez", (_, s) => {
    const clases = [esFuente(s), esSeguidor(s), s.prefijoEtiqueta !== undefined].filter(Boolean);
    expect(clases).toHaveLength(1);
  });

  it("K en la bobina, S en los dos pulsadores, H en la lámpara; Q, F y M en potencia (T35, D9-A)", () => {
    expect(SIMBOLOS.filter((s) => s.prefijoEtiqueta !== undefined).map((s) => [s.tipo, s.prefijoEtiqueta])).toEqual([
      ["pulsador.na", "S"],
      ["pulsador.nc", "S"],
      ["contactor.bobina", "K"],
      ["senalizacion.lampara", "H"],
      ["proteccion.termomagnetica_unipolar", "Q"],
      ["proteccion.termomagnetica_bipolar", "Q"],
      ["proteccion.termomagnetica_tripolar", "Q"],
      ["proteccion.termomagnetica_tetrapolar", "Q"],
      ["proteccion.diferencial_bipolar", "Q"],
      ["proteccion.diferencial_tetrapolar", "Q"],
      ["proteccion.guardamotor", "Q"],
      ["maniobra.seccionador", "Q"],
      ["proteccion.fusible_tripolar", "F"],
      ["proteccion.termico", "F"],
      ["motor.trifasico", "M"],
      ["motor.estrella_triangulo", "M"],
      ["mando.selector", "S"],
      ["mando.seta", "S"],
      ["mando.final_na", "S"],
      ["mando.final_nc", "S"],
      ["proteccion.fusible", "F"],
      ["senalizacion.bocina", "H"],
    ]);
  });

  it("solo el pulsador NC empieza en 0 (S0, la parada); los demás, en 1 (T27)", () => {
    expect(SIMBOLOS.filter((s) => s.primerNumero !== undefined).map((s) => [s.tipo, s.primerNumero])).toEqual([["pulsador.nc", 0]]);
  });

  it("fase, neutro, trifásicas y tierra son fuentes; los auxiliares y los principales, los seguidores (los pulsadores, a mano, se numeran)", () => {
    expect(SIMBOLOS.filter(esFuente)).toEqual([FASE, NEUTRO, FUENTE_TRIFASICA, FUENTE_TRIFASICA_N, TIERRA]);
    expect(SIMBOLOS.filter(esSeguidor)).toEqual([CONTACTO_AUXILIAR_NA, CONTACTO_AUXILIAR_NC, CONTACTOR_PRINCIPAL, TERMICO_NC, TERMICO_NA]);
  });

  it("solo fase, neutro y tierra nombran la red con su etiqueta (T34, D1-A; T35)", () => {
    expect(SIMBOLOS.filter((s) => nombraRed(s))).toEqual([FASE, NEUTRO, TIERRA]);
    expect(nombraRed(undefined)).toBe(false);
  });
});

describe("contacto auxiliar NC (T17b)", () => {
  it("es contactor.auxiliar_nc, va en Mando justo después del NA y entra sin prefijo", () => {
    expect(CONTACTO_AUXILIAR_NC).toMatchObject({ tipo: "contactor.auxiliar_nc", nombre: "Contacto auxiliar NC", subgrupo: "contactos" });
    expect(CONTACTO_AUXILIAR_NC.prefijoEtiqueta).toBeUndefined();
    expect(CONTACTO_AUXILIAR_NC.etiquetaInicial).toBeUndefined();
    expect(buscarSimbolo("contactor.auxiliar_nc")).toBe(CONTACTO_AUXILIAR_NC);
    const i = SIMBOLOS.indexOf(CONTACTO_AUXILIAR_NA);
    expect(SIMBOLOS[i + 1]).toBe(CONTACTO_AUXILIAR_NC);
  });

  it("la caja es la del NA (2×4) y los nombres van a la izquierda: el tope está a la derecha", () => {
    expect(CONTACTO_AUXILIAR_NC.tamano).toEqual(CONTACTO_AUXILIAR_NA.tamano);
    expect(CONTACTO_AUXILIAR_NC.ladoNombresBornes).toBe("izquierda");
    expect(CONTACTO_AUXILIAR_NC.primitivas.some((p) => p.forma === "linea" && p.y1 === -1 && p.y2 === -1 && p.x2 > 0)).toBe(true);
  });

  it("21 y 22 en (0, ∓2) quedan en enteros en las 4 rotaciones, espejado o no, y siempre a 4 de distancia", () => {
    for (const rotacion of ROTACIONES) {
      for (const espejado of [false, true]) {
        const [a, b] = transformarBornes(CONTACTO_AUXILIAR_NC.bornes, { rotacion, espejado });
        expect([a!.nombre, b!.nombre]).toEqual(["21", "22"]);
        for (const p of [a!, b!]) expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
        expect(Math.abs(a!.x - b!.x) + Math.abs(a!.y - b!.y)).toBe(4);
      }
    }
  });
});

describe("alimentaciones: fase y neutro", () => {
  it("la fase tiene un solo borne L, que sale hacia abajo", () => {
    expect(FASE.bornes).toEqual([{ nombre: "L", x: 0, y: 1, direccion: "abajo" }]);
  });

  it("el neutro tiene un solo borne N, que sale hacia abajo, como la fase", () => {
    expect(NEUTRO.bornes).toEqual([{ nombre: "N", x: 0, y: 1, direccion: "abajo" }]);
  });

  it.each([FASE, NEUTRO])("%# se dibuja como un círculo con una senoide y un tramo hasta el borne", (s) => {
    const circulos = s.primitivas.filter((p) => p.forma === "circulo");
    expect(circulos).toHaveLength(1);
    const c = circulos[0]!;
    // Pegado al borde de arriba de la caja.
    expect(c.cy - c.r).toBeCloseTo(-1);
    const lineas = s.primitivas.filter((p) => p.forma === "linea");
    // Tramo vertical del fondo del círculo al borne (0, 1).
    expect(lineas).toContainEqual({ forma: "linea", x1: 0, y1: c.cy + c.r, x2: 0, y2: 1 });
    // La senoide: el resto de las líneas, encadenadas y adentro del círculo.
    const seno = lineas.filter((l) => !(l.x1 === 0 && l.x2 === 0));
    expect(seno.length).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < seno.length; i++) {
      expect(seno[i]!.x1).toBeCloseTo(seno[i - 1]!.x2);
      expect(seno[i]!.y1).toBeCloseTo(seno[i - 1]!.y2);
    }
    for (const l of seno) {
      for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]] as const) {
        expect(Math.hypot(x - c.cx, y - c.cy)).toBeLessThan(c.r);
      }
    }
    // Un período completo: empieza y termina a la altura del centro, y sube primero.
    expect(seno[0]!.y1).toBeCloseTo(c.cy);
    expect(seno.at(-1)!.y2).toBeCloseTo(c.cy);
    expect(Math.min(...seno.map((l) => l.y2))).toBeLessThan(c.cy);
  });

  it.each([
    [FASE, "L"],
    [NEUTRO, "N"],
  ] as const)("%# es una fuente, va en Fuentes y se coloca con la etiqueta %s", (s, etiqueta) => {
    expect(s).toMatchObject({ elemento: "fuente", subgrupo: "alimentacion", etiquetaInicial: etiqueta });
    // Su nombre visible es la etiqueta: el del borne no se dibuja.
    expect(s.mostrarNombresBornes).toBe(false);
  });

  it("son los primeros de la biblioteca", () => {
    expect(SIMBOLOS.slice(0, 2)).toEqual([FASE, NEUTRO]);
  });

  it("los demás símbolos, salvo la tierra (T35), dibujan los nombres de sus bornes", () => {
    for (const s of SIMBOLOS.slice(2)) if (s !== TIERRA) expect(s.mostrarNombresBornes, s.tipo).toBeUndefined();
    expect(TIERRA.mostrarNombresBornes).toBe(false);
  });
});

describe("fuente trifásica (T34)", () => {
  it("L1, L2 y L3 abajo (y = 2), en x −2, 0 y 2, en Fuentes, sin etiqueta inicial ni prefijo", () => {
    expect(FUENTE_TRIFASICA.bornes).toEqual([
      { nombre: "L1", x: -2, y: 2, direccion: "abajo" },
      { nombre: "L2", x: 0, y: 2, direccion: "abajo" },
      { nombre: "L3", x: 2, y: 2, direccion: "abajo" },
    ]);
    expect(FUENTE_TRIFASICA).toMatchObject({ tipo: "fuente.trifasica", elemento: "fuente", subgrupo: "fuentes", tamano: { ancho: 6, alto: 4 } });
    expect(FUENTE_TRIFASICA.etiquetaInicial).toBeUndefined();
    expect(FUENTE_TRIFASICA.prefijoEtiqueta).toBeUndefined();
    expect(buscarSimbolo("fuente.trifasica")).toBe(FUENTE_TRIFASICA);
  });

  it("dibuja los nombres de sus bornes y no tiene polos", () => {
    expect(FUENTE_TRIFASICA.mostrarNombresBornes).toBeUndefined();
    expect(polosDe(FUENTE_TRIFASICA)).toEqual([]);
  });
});

describe("contactos principales (T34)", () => {
  it("1, 3, 5 arriba y 2, 4, 6 abajo, un polo cada 2 unidades", () => {
    expect(CONTACTOR_PRINCIPAL.bornes).toEqual([
      { nombre: "1", x: -2, y: -2, direccion: "arriba" },
      { nombre: "2", x: -2, y: 2, direccion: "abajo" },
      { nombre: "3", x: 0, y: -2, direccion: "arriba" },
      { nombre: "4", x: 0, y: 2, direccion: "abajo" },
      { nombre: "5", x: 2, y: -2, direccion: "arriba" },
      { nombre: "6", x: 2, y: 2, direccion: "abajo" },
    ]);
  });

  it("tres polos NA que siguen a la bobina, en Potencia, sin prefijo", () => {
    expect(CONTACTOR_PRINCIPAL).toMatchObject({ tipo: "contactor.principal", elemento: "contacto_na", accionamiento: "bobina", subgrupo: "maniobra" });
    expect(polosDe(CONTACTOR_PRINCIPAL)).toEqual([
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
    expect(CONTACTOR_PRINCIPAL.prefijoEtiqueta).toBeUndefined();
  });

  it("cada polo queda vertical y a 4 de distancia en las 4 rotaciones, espejado o no", () => {
    for (const rotacion of ROTACIONES) {
      for (const espejado of [false, true]) {
        const t = new Map(transformarBornes(CONTACTOR_PRINCIPAL.bornes, { rotacion, espejado }).map((b) => [b.nombre, b]));
        for (const [a, b] of polosDe(CONTACTOR_PRINCIPAL)) {
          const pa = t.get(a)!;
          const pb = t.get(b)!;
          expect(Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y)).toBe(4);
        }
      }
    }
  });

  it("los contactos de 2 bornes son un polo: sus dos bornes", () => {
    expect(polosDe(CONTACTO_AUXILIAR_NA)).toEqual([["13", "14"]]);
    expect(polosDe(PULSADOR_NC)).toEqual([["11", "12"]]);
    expect(polosDe(BOBINA_CONTACTOR)).toEqual([]);
    expect(polosDe(LAMPARA)).toEqual([]);
  });
});

describe("discontinua", () => {
  it("arma trazos que empiezan y terminan en los extremos", () => {
    const trazos = discontinua(0, 0, -1.3, 0);
    expect(trazos[0]).toMatchObject({ x1: 0, y1: 0 });
    expect(trazos.at(-1)).toMatchObject({ x2: -1.3, y2: 0 });
    for (const t of trazos) expect(Math.abs(t.x2 - t.x1)).toBeLessThanOrEqual(0.25 + 1e-9);
  });

  it("no devuelve nada para un largo cero", () => {
    expect(discontinua(1, 1, 1, 1)).toEqual([]);
  });
});

describe("nombres de borne de las fuentes de varios bornes (T34)", () => {
  it("ya están normalizados: la netlist y redes() los usan tal cual como nombre de red", () => {
    for (const s of SIMBOLOS.filter((d) => d.elemento === "fuente" && d.bornes.length > 1)) {
      for (const b of s.bornes) expect(b.nombre, `${s.tipo} ${b.nombre}`).toBe(b.nombre.trim().toUpperCase());
    }
  });

  it("polosDe no arma arreglos nuevos en cada llamada", () => {
    expect(polosDe(CONTACTO_AUXILIAR_NA)).toBe(polosDe(CONTACTO_AUXILIAR_NA));
    expect(polosDe(LAMPARA)).toBe(polosDe(BOBINA_CONTACTOR));
    expect(polosDe(CONTACTOR_PRINCIPAL)).toBe(CONTACTOR_PRINCIPAL.polos);
  });
});

// ── Potencia (T35) ─────────────────────────────────────────────────────────

/** Bornes 1, 3, 5… arriba (y = −alto/2) y 2, 4, 6… abajo (y = alto/2), uno por polo en `xs`. */
const numerados = (xs: number[], alto: number) =>
  xs.flatMap((x, i) => [
    { nombre: `${2 * i + 1}`, x, y: -alto / 2, direccion: "arriba" },
    { nombre: `${2 * i + 2}`, x, y: alto / 2, direccion: "abajo" },
  ]);
const polos = (n: number) => Array.from({ length: n }, (_, i) => [`${2 * i + 1}`, `${2 * i + 2}`]);

/** Los de polos numerados: definición, x de sus polos, caja (ancho, alto) y prefijo. Los diferenciales miden 6 de alto: el toroide va abajo. */
const NUMERADOS: [DefinicionSimbolo, number[], number, number, string][] = [
  [TERMOMAGNETICA_UNIPOLAR, [0], 2, 4, "Q"],
  [TERMOMAGNETICA_BIPOLAR, [-1, 1], 4, 4, "Q"],
  [TERMOMAGNETICA_TRIPOLAR, [-2, 0, 2], 6, 4, "Q"],
  [TERMOMAGNETICA_TETRAPOLAR, [-3, -1, 1, 3], 8, 4, "Q"],
  [DIFERENCIAL_BIPOLAR, [-1, 1], 6, 6, "Q"],
  [DIFERENCIAL_TETRAPOLAR, [-3, -1, 1, 3], 10, 6, "Q"],
  [GUARDAMOTOR, [-2, 0, 2], 8, 4, "Q"],
  [SECCIONADOR, [-2, 0, 2], 6, 4, "Q"],
  [FUSIBLE_TRIPOLAR, [-2, 0, 2], 6, 4, "F"],
  [TERMICO, [-2, 0, 2], 6, 4, "F"],
];

/** Los que llevan la «N» del polo de neutro (D8-A), con la x de ese polo. */
const CON_NEUTRO: [DefinicionSimbolo, number][] = [
  [TERMOMAGNETICA_TETRAPOLAR, 3],
  [DIFERENCIAL_TETRAPOLAR, 3],
  [DIFERENCIAL_BIPOLAR, 1],
];

describe("protecciones y seccionador (T35, D13-A)", () => {
  it.each(NUMERADOS.map(([s, xs, ancho, alto, prefijo]) => [s.tipo, s, xs, ancho, alto, prefijo] as const))(
    "%s: bornes 1-2, 3-4… en sus polos, protección en Potencia con prefijo",
    (_, s, xs, ancho, alto, prefijo) => {
      expect(s.bornes).toEqual(numerados(xs, alto));
      expect(polosDe(s)).toEqual(polos(xs.length));
      expect(s).toMatchObject({ elemento: "proteccion", subgrupo: s === SECCIONADOR ? "maniobra" : "proteccion", prefijoEtiqueta: prefijo, tamano: { ancho, alto } });
      expect(s.accionamiento).toBeUndefined();
    },
  );

  it.each(NUMERADOS.map(([s, xs]) => [s.tipo, s, xs] as const))(
    "%s accionado (T36, D20-B): cada cuchilla cerrada y los mismos textos; el fusible y el térmico no tienen",
    (_, s, xs) => {
      if (s === FUSIBLE_TRIPOLAR || s === TERMICO) return expect(s.primitivasAccionado).toBeUndefined();
      const a = s.primitivasAccionado!;
      const textos = (ps: readonly Primitiva[]) => ps.filter((p) => p.forma === "texto");
      expect(textos(a)).toEqual(textos(s.primitivas));
      // Cada polo, la cuchilla vertical hasta su contacto fijo de arriba (corrida 1 hacia arriba en el diferencial).
      const dy = s === DIFERENCIAL_BIPOLAR || s === DIFERENCIAL_TETRAPOLAR ? -1 : 0;
      for (const x of xs) {
        const cerrada = { forma: "linea", x1: x, y1: 1 + dy, x2: x, y2: -1 + dy };
        expect(a, `${s.tipo} ${x}`).toContainEqual(cerrada);
        expect(s.primitivas, `${s.tipo} ${x}`).not.toContainEqual(cerrada);
      }
    },
  );

  it("la unipolar no necesita `polos`: sus dos bornes son el polo", () => {
    expect(TERMOMAGNETICA_UNIPOLAR.polos).toBeUndefined();
    expect(polosDe(TERMOMAGNETICA_UNIPOLAR)).toBe(polosDe(TERMOMAGNETICA_UNIPOLAR));
  });

  it("el polo N lleva su «N» dibujada (D8-A): 7-8 en las tetrapolares, 3-4 en el diferencial bipolar; las demás no", () => {
    const n = (s: DefinicionSimbolo) => s.primitivas.filter((p): p is Extract<Primitiva, { forma: "texto" }> => p.forma === "texto" && p.texto === "N");
    for (const [s, x] of CON_NEUTRO) {
      expect(n(s), s.tipo).toHaveLength(1);
      // A la derecha del conductor del último polo, entre sus dos bornes.
      expect(n(s)[0]!.x, s.tipo).toBeGreaterThan(x);
      expect(Math.abs(n(s)[0]!.y), s.tipo).toBeLessThan(s.tamano.alto / 2);
    }
    const conN = new Set(CON_NEUTRO.map(([s]) => s));
    for (const [s] of NUMERADOS) if (!conN.has(s)) expect(n(s), s.tipo).toEqual([]);
  });

  it("cada polo queda vertical y a su alto de distancia en las 4 rotaciones, espejado o no", () => {
    for (const [s, , , alto] of NUMERADOS) {
      for (const rotacion of ROTACIONES) {
        for (const espejado of [false, true]) {
          const t = new Map(transformarBornes(s.bornes, { rotacion, espejado }).map((b) => [b.nombre, b]));
          for (const [a, b] of polosDe(s)) expect(Math.abs(t.get(a)!.x - t.get(b)!.x) + Math.abs(t.get(a)!.y - t.get(b)!.y), s.tipo).toBe(alto);
        }
      }
    }
  });
});

describe("motores (T35, D14-A)", () => {
  it("trifásico: U, V y W arriba en x −2, 0 y 2; carga con prefijo M", () => {
    expect(MOTOR_TRIFASICO.bornes).toEqual([
      { nombre: "U", x: -2, y: -2, direccion: "arriba" },
      { nombre: "V", x: 0, y: -2, direccion: "arriba" },
      { nombre: "W", x: 2, y: -2, direccion: "arriba" },
    ]);
    expect(MOTOR_TRIFASICO).toMatchObject({ tipo: "motor.trifasico", elemento: "carga", subgrupo: "cargas", prefijoEtiqueta: "M", tamano: { ancho: 6, alto: 4 } });
  });

  it("estrella-triángulo: U1, V1, W1 arriba y U2, V2, W2 abajo; carga con prefijo M", () => {
    expect(MOTOR_ESTRELLA_TRIANGULO.bornes).toEqual([
      { nombre: "U1", x: -2, y: -3, direccion: "arriba" },
      { nombre: "V1", x: 0, y: -3, direccion: "arriba" },
      { nombre: "W1", x: 2, y: -3, direccion: "arriba" },
      { nombre: "U2", x: -2, y: 3, direccion: "abajo" },
      { nombre: "V2", x: 0, y: 3, direccion: "abajo" },
      { nombre: "W2", x: 2, y: 3, direccion: "abajo" },
    ]);
    expect(MOTOR_ESTRELLA_TRIANGULO).toMatchObject({ elemento: "carga", subgrupo: "cargas", prefijoEtiqueta: "M", tamano: { ancho: 6, alto: 6 } });
  });

  it("no tienen polos y dibujan «M» y «3~» en un círculo", () => {
    for (const s of [MOTOR_TRIFASICO, MOTOR_ESTRELLA_TRIANGULO]) {
      expect(polosDe(s)).toEqual([]);
      expect(s.primitivas.filter((p) => p.forma === "circulo")).toHaveLength(1);
      expect(s.primitivas.filter((p): p is Extract<Primitiva, { forma: "texto" }> => p.forma === "texto").map((p) => p.texto)).toEqual(["M", "3~"]);
    }
  });
});

describe("fuente trifásica con neutro y tierra (T35)", () => {
  it("trifásica con neutro: L1, L2, L3 y N abajo, en x −3, −1, 1 y 3, en Fuentes, sin etiqueta inicial ni prefijo", () => {
    expect(FUENTE_TRIFASICA_N.bornes).toEqual([
      { nombre: "L1", x: -3, y: 2, direccion: "abajo" },
      { nombre: "L2", x: -1, y: 2, direccion: "abajo" },
      { nombre: "L3", x: 1, y: 2, direccion: "abajo" },
      { nombre: "N", x: 3, y: 2, direccion: "abajo" },
    ]);
    expect(FUENTE_TRIFASICA_N).toMatchObject({ tipo: "fuente.trifasica_n", elemento: "fuente", subgrupo: "fuentes", tamano: { ancho: 8, alto: 4 } });
    expect(FUENTE_TRIFASICA_N.etiquetaInicial).toBeUndefined();
    expect(FUENTE_TRIFASICA_N.prefijoEtiqueta).toBeUndefined();
    expect(nombraRed(FUENTE_TRIFASICA_N)).toBe(false);
  });

  it("cada borne de la trifásica con neutro baja por su propia vertical", () => {
    const lineas = FUENTE_TRIFASICA_N.primitivas.filter((p): p is Extract<Primitiva, { forma: "linea" }> => p.forma === "linea");
    const verticales = lineas.filter((l) => l.x1 === l.x2 && l.y2 === 2);
    expect(verticales.map((l) => l.x1).sort((a, b) => a - b)).toEqual([-3, -1, 1, 3]);
  });

  it("tierra: un borne PE arriba, en Fuentes, entra «PE» y no da prefijo", () => {
    expect(TIERRA.bornes).toEqual([{ nombre: "PE", x: 0, y: -1, direccion: "arriba" }]);
    expect(TIERRA).toMatchObject({ tipo: "fuente.tierra", elemento: "fuente", subgrupo: "fuentes", etiquetaInicial: "PE", tamano: { ancho: 2, alto: 2 } });
    expect(TIERRA.prefijoEtiqueta).toBeUndefined();
  });
});

describe("mando (T36)", () => {
  it("selector y seta enclavados; finales como el pulsador; 95-96 y 97-98 siguen al térmico", () => {
    expect(SELECTOR).toMatchObject({ elemento: "contacto_na", accionamiento: "manual_enclavado", subgrupo: "entradas" });
    expect(SETA).toMatchObject({ elemento: "contacto_nc", accionamiento: "manual_enclavado", subgrupo: "entradas" });
    expect(FINAL_NA).toMatchObject({ elemento: "contacto_na", accionamiento: "manual_momentaneo", subgrupo: "entradas" });
    expect(FINAL_NC).toMatchObject({ elemento: "contacto_nc", accionamiento: "manual_momentaneo", subgrupo: "entradas" });
    expect(TERMICO_NC).toMatchObject({ elemento: "contacto_nc", accionamiento: "termico", subgrupo: "contactos" });
    expect(TERMICO_NA).toMatchObject({ elemento: "contacto_na", accionamiento: "termico", subgrupo: "contactos" });
    expect(TERMICO_NC.prefijoEtiqueta).toBeUndefined();
    expect(TERMICO_NA.prefijoEtiqueta).toBeUndefined();
  });

  it("el fusible de mando es una protección de un polo (1-2); la bocina, una carga en Señalización", () => {
    expect(FUSIBLE).toMatchObject({ elemento: "proteccion", subgrupo: "alimentacion", prefijoEtiqueta: "F", tamano: { ancho: 2, alto: 4 } });
    expect(FUSIBLE.polos).toBeUndefined();
    expect(polosDe(FUSIBLE)).toEqual([["1", "2"]]);
    expect(BOCINA).toMatchObject({ elemento: "carga", subgrupo: "senalizacion", prefijoEtiqueta: "H", tamano: { ancho: 2, alto: 4 } });
    // Encendida se rellena como la lámpara: tiene un cuerpo (rectángulo).
    expect(BOCINA.primitivas.some((p) => p.forma === "rectangulo")).toBe(true);
  });

  it("los NC llevan los nombres a la izquierda (el tope a la derecha); los NA, a la derecha", () => {
    for (const s of [SETA, FINAL_NC, TERMICO_NC]) expect(s.ladoNombresBornes, s.tipo).toBe("izquierda");
    for (const s of [SELECTOR, FINAL_NA, TERMICO_NA]) expect(s.ladoNombresBornes, s.tipo).toBe("derecha");
  });
});
