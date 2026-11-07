// Test de bornes de cada símbolo de la biblioteca.
import { describe, expect, it } from "vitest";
import {
  BOBINA_CONTACTOR,
  buscarSimbolo,
  CONTACTO_AUXILIAR_NA,
  discontinua,
  LAMPARA,
  PULSADOR_NA,
  PULSADOR_NC,
  SIMBOLOS,
} from "./biblioteca";
import type { DefinicionSimbolo, Primitiva, Rotacion } from "./tipos";
import { transformarBornes } from "./transformar";
import { validarDefinicion } from "./validar";

const ROTACIONES: Rotacion[] = [0, 90, 180, 270];

/** Bornes esperados: [arriba, abajo], siempre en (0, −2) y (0, 2). */
const ESPERADOS: [DefinicionSimbolo, string, string][] = [
  [PULSADOR_NA, "13", "14"],
  [PULSADOR_NC, "11", "12"],
  [BOBINA_CONTACTOR, "A1", "A2"],
  [CONTACTO_AUXILIAR_NA, "13", "14"],
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
  it("tiene los cinco símbolos, con tipos únicos", () => {
    expect(SIMBOLOS).toHaveLength(5);
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

  it("pulsadores accionados a mano; el auxiliar, por la bobina", () => {
    expect(PULSADOR_NA).toMatchObject({ elemento: "contacto_na", accionamiento: "manual_momentaneo" });
    expect(PULSADOR_NC).toMatchObject({ elemento: "contacto_nc", accionamiento: "manual_momentaneo" });
    expect(CONTACTO_AUXILIAR_NA).toMatchObject({ elemento: "contacto_na", accionamiento: "bobina" });
    expect(BOBINA_CONTACTOR.elemento).toBe("bobina");
    expect(LAMPARA).toMatchObject({ elemento: "carga", categoria: "senalizacion" });
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
