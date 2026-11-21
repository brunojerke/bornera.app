// Test de bornes de cada símbolo de la biblioteca.
import { describe, expect, it } from "vitest";
import {
  BOBINA_CONTACTOR,
  buscarSimbolo,
  CONTACTO_AUXILIAR_NA,
  CONTACTO_AUXILIAR_NC,
  discontinua,
  FASE,
  LAMPARA,
  NEUTRO,
  PULSADOR_NA,
  PULSADOR_NC,
  SIMBOLOS,
} from "./biblioteca";
import { esFuente, esSeguidor, type DefinicionSimbolo, type Primitiva, type Rotacion } from "./tipos";
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
  it("tiene los ocho símbolos, con tipos únicos", () => {
    expect(SIMBOLOS).toHaveLength(8);
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
    expect(LAMPARA).toMatchObject({ elemento: "carga", categoria: "senalizacion" });
  });
});

describe("contactos accionados (T33, D9-B)", () => {
  const CONTACTOS = [PULSADOR_NA, PULSADOR_NC, CONTACTO_AUXILIAR_NA, CONTACTO_AUXILIAR_NC];
  /** La cuchilla: la línea que sale de la bisagra (0, 1) hacia arriba. */
  const cuchilla = (ps: readonly Primitiva[]) => ps.find((p) => p.forma === "linea" && p.x1 === 0 && p.y1 === 1 && p.y2 < 1);

  it("los cuatro contactos tienen dibujo accionado; los demás símbolos no", () => {
    for (const s of SIMBOLOS) expect(s.primitivasAccionado !== undefined, s.tipo).toBe(CONTACTOS.includes(s));
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

  it.each([PULSADOR_NA, CONTACTO_AUXILIAR_NA].map((s) => [s.tipo, s] as const))("%s accionado está cerrado: la cuchilla llega al contacto fijo de arriba", (_, s) => {
    expect(cuchilla(s.primitivasAccionado!)).toMatchObject({ x2: 0, y2: -1 });
    expect(cuchilla(s.primitivas)).not.toMatchObject({ x2: 0, y2: -1 });
  });

  it.each([PULSADOR_NC, CONTACTO_AUXILIAR_NC].map((s) => [s.tipo, s] as const))("%s accionado está abierto: la cuchilla se aparta del tope", (_, s) => {
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
});

describe("etiquetado: fuente, seguidor o prefijo (T17)", () => {
  it.each(SIMBOLOS.map((s) => [s.tipo, s] as const))("%s es fuente, seguidor o tiene prefijo, y no dos a la vez", (_, s) => {
    const clases = [esFuente(s), esSeguidor(s), s.prefijoEtiqueta !== undefined].filter(Boolean);
    expect(clases).toHaveLength(1);
  });

  it("K en la bobina, S en los dos pulsadores y H en la lámpara", () => {
    expect(SIMBOLOS.filter((s) => s.prefijoEtiqueta !== undefined).map((s) => [s.tipo, s.prefijoEtiqueta])).toEqual([
      ["pulsador.na", "S"],
      ["pulsador.nc", "S"],
      ["contactor.bobina", "K"],
      ["senalizacion.lampara", "H"],
    ]);
  });

  it("solo el pulsador NC empieza en 0 (S0, la parada); los demás, en 1 (T27)", () => {
    expect(SIMBOLOS.filter((s) => s.primerNumero !== undefined).map((s) => [s.tipo, s.primerNumero])).toEqual([["pulsador.nc", 0]]);
  });

  it("fase y neutro son fuentes; los auxiliares NA y NC son los únicos seguidores (los pulsadores, a mano, se numeran)", () => {
    expect(SIMBOLOS.filter(esFuente)).toEqual([FASE, NEUTRO]);
    expect(SIMBOLOS.filter(esSeguidor)).toEqual([CONTACTO_AUXILIAR_NA, CONTACTO_AUXILIAR_NC]);
  });
});

describe("contacto auxiliar NC (T17b)", () => {
  it("es contactor.auxiliar_nc, va en Mando justo después del NA y entra sin prefijo", () => {
    expect(CONTACTO_AUXILIAR_NC).toMatchObject({ tipo: "contactor.auxiliar_nc", nombre: "Contacto auxiliar NC", categoria: "mando" });
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
    expect(s).toMatchObject({ elemento: "fuente", categoria: "fuentes", etiquetaInicial: etiqueta });
    // Su nombre visible es la etiqueta: el del borne no se dibuja.
    expect(s.mostrarNombresBornes).toBe(false);
  });

  it("son los primeros de la biblioteca", () => {
    expect(SIMBOLOS.slice(0, 2)).toEqual([FASE, NEUTRO]);
  });

  it("los demás símbolos dibujan los nombres de sus bornes", () => {
    for (const s of SIMBOLOS.slice(2)) expect(s.mostrarNombresBornes).toBeUndefined();
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
