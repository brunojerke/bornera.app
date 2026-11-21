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
  prefijoEtiqueta: "S",
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

  it("rechaza un borne adentro de la caja (un cable no podría llegar)", () => {
    const errores = validarDefinicion(
      conBornes([
        { nombre: "13", x: 0, y: -1, direccion: "arriba" },
        { nombre: "14", x: 0, y: 2, direccion: "abajo" },
      ]),
    );
    expect(errores).toEqual(['Borne "13" adentro de la caja del símbolo: (0, -1); tiene que estar en el borde.']);
  });

  it("rechaza un borne que apunta hacia adentro o a lo largo del borde", () => {
    expect(
      validarDefinicion(
        conBornes([
          { nombre: "13", x: 0, y: -2, direccion: "abajo" },
          { nombre: "14", x: 0, y: 2, direccion: "derecha" },
        ]),
      ),
    ).toEqual([
      'Borne "13" apunta hacia abajo: tiene que apuntar hacia afuera (arriba).',
      'Borne "14" apunta hacia derecha: tiene que apuntar hacia afuera (abajo).',
    ]);
  });

  it("en una esquina, el borne puede apuntar hacia afuera por cualquiera de los dos bordes", () => {
    for (const direccion of ["arriba", "izquierda"] as const) {
      expect(validarDefinicion(conBornes([{ nombre: "1", x: -1, y: -2, direccion }]))).toEqual([]);
    }
    for (const direccion of ["abajo", "derecha"] as const) {
      expect(validarDefinicion(conBornes([{ nombre: "1", x: -1, y: -2, direccion }]))).toHaveLength(1);
    }
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

describe("validarDefinicion: prefijo de etiqueta (T17)", () => {
  const FALTA = "Falta el prefijo de etiqueta: el símbolo se numera al colocarlo.";

  it("lo que se numera (pulsador, selector, bobina, carga, protección) necesita prefijo", () => {
    const { prefijoEtiqueta: _, ...sinPrefijo } = PULSADOR;
    expect(validarDefinicion(sinPrefijo)).toEqual([FALTA]);
    expect(validarDefinicion({ ...sinPrefijo, accionamiento: "manual_enclavado" })).toEqual([FALTA]);
    for (const elemento of ["bobina", "carga", "proteccion"] as const) {
      expect(validarDefinicion({ ...sinPrefijo, elemento, accionamiento: undefined }), elemento).toEqual([FALTA]);
    }
  });

  it("el prefijo es solo letras mayúsculas", () => {
    for (const prefijo of ["k", "K1", "", "K-"]) {
      expect(validarDefinicion({ ...PULSADOR, prefijoEtiqueta: prefijo }), prefijo).toEqual([
        `El prefijo de etiqueta tiene que ser solo letras mayúsculas (es "${prefijo}").`,
      ]);
    }
    expect(validarDefinicion({ ...PULSADOR, prefijoEtiqueta: "KM" })).toEqual([]);
  });

  it("la fuente y el seguidor (auxiliar de la bobina, contacto del térmico) no llevan prefijo", () => {
    const { prefijoEtiqueta: _, ...sinPrefijo } = PULSADOR;
    const fuente = { ...sinPrefijo, elemento: "fuente", accionamiento: undefined } as const;
    const auxiliar = { ...sinPrefijo, accionamiento: "bobina" } as const;
    const termico = { ...sinPrefijo, elemento: "contacto_nc", accionamiento: "termico" } as const;
    for (const def of [fuente, auxiliar, termico]) expect(validarDefinicion(def), def.elemento).toEqual([]);
    expect(validarDefinicion({ ...fuente, prefijoEtiqueta: "L" })).toEqual(['Una fuente no lleva prefijo de etiqueta (tiene "L").']);
    expect(validarDefinicion({ ...auxiliar, prefijoEtiqueta: "K" })).toEqual([
      'Un contacto que sigue a otro no lleva prefijo de etiqueta (tiene "K").',
    ]);
  });
});

describe("validarDefinicion: primer número (T27)", () => {
  it("acepta un entero ≥ 0 junto con el prefijo", () => {
    for (const primerNumero of [0, 1, 7]) expect(validarDefinicion({ ...PULSADOR, primerNumero }), String(primerNumero)).toEqual([]);
  });

  it("rechaza un número negativo, no entero o no finito", () => {
    for (const primerNumero of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validarDefinicion({ ...PULSADOR, primerNumero }), String(primerNumero)).toEqual([
        `El primer número tiene que ser un entero ≥ 0 (es ${primerNumero}).`,
      ]);
    }
  });

  it("sin prefijo (fuente o seguidor) no lleva primer número", () => {
    const { prefijoEtiqueta: _, ...sinPrefijo } = PULSADOR;
    const auxiliar = { ...sinPrefijo, accionamiento: "bobina" } as const;
    expect(validarDefinicion({ ...auxiliar, primerNumero: 0 })).toEqual(["El primer número va solo con prefijo de etiqueta (es 0)."]);
  });
});

describe("validarDefinicion: dibujo accionado (T33)", () => {
  const cuchilla = { forma: "linea", x1: 0, y1: 1, x2: 0, y2: -1 } as const;

  it("acepta un contacto con su dibujo accionado dentro de la caja", () => {
    expect(validarDefinicion({ ...PULSADOR, primitivasAccionado: [cuchilla] })).toEqual([]);
  });

  it("solo un contacto lo lleva", () => {
    const bobina = { ...PULSADOR, elemento: "bobina", accionamiento: undefined } as const;
    expect(validarDefinicion({ ...bobina, primitivasAccionado: [cuchilla] })).toEqual(["Solo un contacto lleva dibujo accionado."]);
  });

  it("rechaza textos y lo que sale de la caja", () => {
    const texto = { forma: "texto", x: 0, y: 0, texto: "A", alto: 1 } as const;
    const afuera = { forma: "circulo", cx: 0, cy: 0, r: 1.5 } as const;
    expect(validarDefinicion({ ...PULSADOR, primitivasAccionado: [texto, afuera] })).toEqual([
      "El dibujo accionado no lleva textos.",
      "El dibujo accionado sale de la caja del símbolo (circulo).",
    ]);
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
