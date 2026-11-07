import { describe, expect, it } from "vitest";
import type { DefinicionSimbolo } from "./tipos";
import { validarDefinicion } from "./validar";

/** Contacto NA de pulsador, solo para probar (no es un símbolo de la biblioteca). */
const PULSADOR: DefinicionSimbolo = {
  tipo: "prueba.pulsador_na",
  nombre: "Pulsador NA de prueba",
  categoria: "mando",
  elemento: "contacto_na",
  accionamiento: "manual_momentaneo",
  tamano: { ancho: 2, alto: 4 },
  primitivas: [{ forma: "linea", x1: 0, y1: -2, x2: 0, y2: -0.5 }],
  bornes: [
    { nombre: "13", x: 0, y: -2, direccion: "arriba" },
    { nombre: "14", x: 0, y: 2, direccion: "abajo" },
  ],
};

function conBornes(bornes: DefinicionSimbolo["bornes"]): DefinicionSimbolo {
  return { ...PULSADOR, bornes };
}

describe("validarDefinicion", () => {
  it("acepta una definición correcta", () => {
    expect(validarDefinicion(PULSADOR)).toEqual([]);
  });

  it("rechaza bornes fuera de la grilla", () => {
    const errores = validarDefinicion(
      conBornes([
        { nombre: "13", x: 0.5, y: -2, direccion: "arriba" },
        { nombre: "14", x: 0, y: 2, direccion: "abajo" },
      ]),
    );
    expect(errores).toEqual(['Borne "13" fuera de la grilla: (0.5, -2).']);
  });

  it("rechaza nombres de borne repetidos", () => {
    const errores = validarDefinicion(
      conBornes([
        { nombre: "13", x: 0, y: -2, direccion: "arriba" },
        { nombre: "13", x: 0, y: 2, direccion: "abajo" },
      ]),
    );
    expect(errores).toEqual(['Borne "13" repetido.']);
  });

  it("rechaza dos bornes en la misma posición", () => {
    const errores = validarDefinicion(
      conBornes([
        { nombre: "13", x: 0, y: 2, direccion: "abajo" },
        { nombre: "14", x: 0, y: 2, direccion: "abajo" },
      ]),
    );
    expect(errores).toEqual(['Bornes "13" y "14" en la misma posición (0, 2).']);
  });

  it("rechaza bornes fuera de la caja del símbolo", () => {
    const errores = validarDefinicion(
      conBornes([
        { nombre: "13", x: 0, y: -3, direccion: "arriba" },
        { nombre: "14", x: 0, y: 2, direccion: "abajo" },
      ]),
    );
    expect(errores).toEqual(['Borne "13" fuera de la caja del símbolo: (0, -3).']);
  });

  it("rechaza un tamaño no entero o no positivo", () => {
    expect(validarDefinicion({ ...PULSADOR, tamano: { ancho: 2.5, alto: 4 } })).toContain(
      "El tamaño debe ser entero y positivo (es 2.5×4).",
    );
    expect(validarDefinicion({ ...PULSADOR, tamano: { ancho: 0, alto: 4 } }).length).toBeGreaterThan(0);
  });

  it("rechaza un símbolo sin bornes", () => {
    expect(validarDefinicion(conBornes([]))).toEqual(["El símbolo no tiene bornes."]);
  });
});

// Chequeos de tipos: no corren en Vitest, los verifica `npm run check:core`.
// Si algún @ts-expect-error deja de ser un error, el chequeo de tipos falla.
export const comprobacionesDeTipos: DefinicionSimbolo[] = [
  // Elemento de potencia del relé térmico: protección, sin accionamiento.
  { ...PULSADOR, tipo: "prueba.termico", elemento: "proteccion", accionamiento: undefined },
  // Contacto 95-96 del térmico.
  { ...PULSADOR, elemento: "contacto_nc", accionamiento: "termico" },
  // @ts-expect-error un contacto necesita accionamiento
  { tipo: "x", nombre: "x", categoria: "mando", elemento: "contacto_na", tamano: { ancho: 2, alto: 2 }, primitivas: [], bornes: [] },
  // @ts-expect-error una bobina no lleva accionamiento
  { tipo: "x", nombre: "x", categoria: "mando", elemento: "bobina", accionamiento: "bobina", tamano: { ancho: 2, alto: 2 }, primitivas: [], bornes: [] },
];
