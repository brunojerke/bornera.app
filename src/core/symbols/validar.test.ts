import { describe, expect, it } from "vitest";
import type { DefinicionSimbolo } from "./tipos";
import { validarDefinicion } from "./validar";

/** Contacto NA de pulsador, solo para probar (no es un símbolo de la biblioteca). */
const PULSADOR: DefinicionSimbolo = {
  tipo: "prueba.pulsador_na",
  nombre: "Pulsador NA de prueba",
  subgrupo: "entradas",
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

/**
 * Una carga con estos bornes, para probar la geometría: en un contacto,
 * otra cantidad de bornes que 2 pediría polos (T34).
 */
function conBornes(bornes: DefinicionSimbolo["bornes"]): DefinicionSimbolo {
  const { accionamiento: _, ...sinAccionamiento } = PULSADOR;
  return { ...sinAccionamiento, elemento: "carga", bornes };
}

describe("validarDefinicion", () => {
  it("acepta una definición correcta", () => {
    expect(validarDefinicion(PULSADOR)).toEqual([]);
  });

  it("exige el subgrupo de la paleta (T38, D26-A)", () => {
    const { subgrupo: _, ...sin } = PULSADOR;
    expect(validarDefinicion(sin as DefinicionSimbolo)).toEqual(['Falta el subgrupo de la paleta (es "undefined").']);
    expect(validarDefinicion({ ...PULSADOR, subgrupo: "mando" as never })).toEqual(['Falta el subgrupo de la paleta (es "mando").']);
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

  it("solo un contacto, una protección (T36, D20-B) o una electroválvula (T40) lo lleva", () => {
    const bobina = { ...PULSADOR, elemento: "bobina", accionamiento: undefined } as const;
    expect(validarDefinicion({ ...bobina, primitivasAccionado: [cuchilla] })).toEqual(["Solo un contacto, una protección o una electroválvula lleva dibujo accionado."]);
    const proteccion = { ...PULSADOR, elemento: "proteccion", accionamiento: undefined, prefijoEtiqueta: "Q" } as const;
    expect(validarDefinicion({ ...proteccion, primitivasAccionado: [cuchilla] })).toEqual([]);
  });

  it("rechaza textos que no están en el reposo y lo que sale de la caja", () => {
    const texto = { forma: "texto", x: 0, y: 0, texto: "A", alto: 1 } as const;
    const afuera = { forma: "circulo", cx: 0, cy: 0, r: 1.5 } as const;
    expect(validarDefinicion({ ...PULSADOR, primitivasAccionado: [texto, afuera] })).toEqual([
      "El dibujo accionado solo lleva los textos del reposo.",
      "El dibujo accionado sale de la caja del símbolo (circulo).",
    ]);
    // El mismo texto del reposo, sí (T36: la «N» del neutro).
    expect(validarDefinicion({ ...PULSADOR, primitivas: [...PULSADOR.primitivas, texto], primitivasAccionado: [cuchilla, { ...texto }] })).toEqual([]);
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
  { tipo: "x", nombre: "x", subgrupo: "entradas", elemento: "contacto_na", tamano: { ancho: 2, alto: 2 }, primitivas: [], bornes: [] },
  // @ts-expect-error una bobina no lleva accionamiento
  { tipo: "x", nombre: "x", subgrupo: "entradas", elemento: "bobina", accionamiento: "bobina", tamano: { ancho: 2, alto: 2 }, primitivas: [], bornes: [] },
];

describe("validarDefinicion: polos (T34)", () => {
  /** Contacto tripolar de prueba, como los principales: 1-2, 3-4, 5-6. */
  const TRIPOLAR: DefinicionSimbolo = {
    tipo: "prueba.tripolar",
    nombre: "Tripolar de prueba",
    subgrupo: "maniobra",
    elemento: "contacto_na",
    accionamiento: "bobina",
    tamano: { ancho: 6, alto: 4 },
    primitivas: [],
    bornes: [-2, 0, 2].flatMap((x, i) => [
      { nombre: `${2 * i + 1}`, x, y: -2, direccion: "arriba" as const },
      { nombre: `${2 * i + 2}`, x, y: 2, direccion: "abajo" as const },
    ]),
    polos: [
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ],
  };
  const conPolos = (polos: DefinicionSimbolo["polos"]): DefinicionSimbolo => ({ ...TRIPOLAR, polos });

  it("acepta un contacto de 6 bornes con 3 polos, y uno de 2 con su polo explícito", () => {
    expect(validarDefinicion(TRIPOLAR)).toEqual([]);
    expect(validarDefinicion({ ...PULSADOR, polos: [["13", "14"]] })).toEqual([]);
  });

  it("un contacto de 6 bornes sin polos", () => {
    expect(validarDefinicion(conPolos(undefined))).toEqual(["Un contacto de 6 bornes necesita polos."]);
  });

  it("un borne en dos polos y otro sin polo", () => {
    expect(validarDefinicion(conPolos([["1", "2"], ["3", "4"], ["4", "5"]]))).toEqual(['Borne "4" en dos polos.', 'Borne "6" sin polo.']);
  });

  it("un polo con un borne que no existe", () => {
    expect(validarDefinicion(conPolos([["1", "2"], ["3", "4"], ["5", "7"]]))).toEqual([
      'El polo 5-7 nombra un borne que no existe: "7".',
      'Borne "6" sin polo.',
    ]);
  });

  it("un polo que une un borne consigo mismo", () => {
    expect(validarDefinicion(conPolos([["1", "2"], ["3", "4"], ["5", "5"], ["6", "6"]]))).toEqual([
      "El polo 5-5 tiene que unir dos bornes distintos.",
      'Borne "5" en dos polos.',
      "El polo 6-6 tiene que unir dos bornes distintos.",
      'Borne "6" en dos polos.',
    ]);
  });

  it("una lista vacía de polos", () => {
    expect(validarDefinicion({ ...PULSADOR, polos: [] })).toEqual(["La lista de polos está vacía.", 'Borne "13" sin polo.', 'Borne "14" sin polo.']);
  });

  it("polos fuera de un contacto o una protección: en bobina, carga y fuente no", () => {
    const { accionamiento: _, ...sinAccionamiento } = PULSADOR;
    for (const elemento of ["bobina", "carga"] as const) {
      const def: DefinicionSimbolo = { ...sinAccionamiento, elemento, polos: [["13", "14"]] };
      expect(validarDefinicion(def), elemento).toEqual(["Solo un contacto o una protección lleva polos."]);
    }
    const { prefijoEtiqueta: __, ...sinPrefijo } = sinAccionamiento;
    const fuente: DefinicionSimbolo = { ...sinPrefijo, elemento: "fuente", polos: [["13", "14"]] };
    expect(validarDefinicion(fuente)).toEqual(["Solo un contacto o una protección lleva polos."]);
  });

  it("una protección lleva polos (T35, D13-A); con 6 bornes los necesita", () => {
    const { accionamiento: _, ...sinAccionamiento } = TRIPOLAR;
    const proteccion: DefinicionSimbolo = { ...sinAccionamiento, elemento: "proteccion", prefijoEtiqueta: "Q" };
    expect(validarDefinicion(proteccion)).toEqual([]);
    expect(validarDefinicion({ ...proteccion, polos: undefined })).toEqual(["Una protección de 6 bornes necesita polos."]);
  });
});

describe("validarDefinicion: cargas y salida (T39, D-B7 A)", () => {
  const FUENTE: DefinicionSimbolo = {
    ...conBornes([
      { nombre: "L", x: 0, y: -2, direccion: "arriba" },
      { nombre: "N", x: 1, y: -2, direccion: "arriba" },
      { nombre: "L+", x: 0, y: 2, direccion: "abajo" },
      { nombre: "M", x: 1, y: 2, direccion: "abajo" },
    ]),
    prefijoEtiqueta: "G",
    cargas: [["L", "N"]],
    salida: { "L+": "fase", M: "neutro" },
  };

  it("acepta una fuente con entrada L-N y salida L+ y M", () => {
    expect(validarDefinicion(FUENTE)).toEqual([]);
  });

  it("rechaza cargas con bornes repetidos o que no existen", () => {
    expect(validarDefinicion({ ...FUENTE, cargas: [["L", "L"]] })).toEqual(["La carga L-L tiene que unir dos bornes distintos.", 'Borne "L" en dos cargas.']);
    expect(validarDefinicion({ ...FUENTE, cargas: [["L", "X"]] })).toEqual(['La carga L-X nombra un borne que no existe: "X".']);
  });

  it("rechaza una salida vacía, con un borne que no existe, en una carga o con otro papel", () => {
    expect(validarDefinicion({ ...FUENTE, salida: {} })).toEqual(["La salida está vacía."]);
    expect(validarDefinicion({ ...FUENTE, salida: { X: "fase" } })).toEqual(['La salida nombra un borne que no existe: "X".']);
    expect(validarDefinicion({ ...FUENTE, salida: { L: "fase" } })).toEqual(['Borne "L" de salida en una carga o un polo.']);
    expect(validarDefinicion({ ...FUENTE, salida: { M: "tierra" as never } })).toEqual(['Borne "M" de salida con papel "tierra": fase o neutro.']);
  });

  it("la salida pide un titular con prefijo: una fuente no la lleva", () => {
    const { prefijoEtiqueta: _, ...sinPrefijo } = FUENTE;
    expect(validarDefinicion({ ...sinPrefijo, elemento: "fuente" } as DefinicionSimbolo)).toEqual(["Solo un titular (con prefijo) lleva salida."]);
    expect(validarDefinicion(sinPrefijo as DefinicionSimbolo)).toEqual(["Falta el prefijo de etiqueta: el símbolo se numera al colocarlo."]);
  });
});

describe("validarDefinicion: sensor y electroválvula (T40)", () => {
  /** Sensor de prueba: polo BN-BK y carga BN-BU (BN en los dos). */
  const SENSOR: DefinicionSimbolo = {
    ...PULSADOR,
    tipo: "prueba.sensor",
    accionamiento: "manual_enclavado",
    prefijoEtiqueta: "B",
    bornes: [
      { nombre: "BN", x: 0, y: -2, direccion: "arriba" },
      { nombre: "BU", x: -1, y: 2, direccion: "abajo" },
      { nombre: "BK", x: 0, y: 2, direccion: "abajo" },
    ],
    polos: [["BN", "BK"]],
    cargas: [["BN", "BU"]],
  };
  const cuchilla = { forma: "linea", x1: 0, y1: 1, x2: 0, y2: -1 } as const;
  /** Electroválvula de prueba: una carga A1-A2 con dibujo accionado. */
  const EV: DefinicionSimbolo = {
    tipo: "prueba.ev",
    nombre: "EV de prueba",
    subgrupo: "actuadores",
    elemento: "carga",
    prefijoEtiqueta: "Y",
    tamano: { ancho: 2, alto: 4 },
    primitivas: [cuchilla],
    primitivasAccionado: [cuchilla],
    bornes: [
      { nombre: "A1", x: 0, y: -2, direccion: "arriba" },
      { nombre: "A2", x: 0, y: 2, direccion: "abajo" },
    ],
    cargas: [["A1", "A2"]],
    valvula: "monoestable",
  };

  it("un borne puede estar en un polo y en una carga (BN); el que no está en un polo tiene que estar en una carga (BU)", () => {
    expect(validarDefinicion(SENSOR)).toEqual([]);
    expect(validarDefinicion({ ...SENSOR, cargas: [] })).toEqual(['Borne "BU" sin polo.']);
  });

  it("acepta la electroválvula; la biestable lleva dos cargas", () => {
    expect(validarDefinicion(EV)).toEqual([]);
    expect(validarDefinicion({ ...EV, valvula: "biestable" })).toEqual(["Una electroválvula biestable lleva dos cargas."]);
    expect(validarDefinicion({ ...EV, cargas: [["A1", "A2"], ["A2", "A1"]] })).toContain("Una electroválvula monoestable lleva una carga.");
  });

  it("rechaza una electroválvula sin dibujo accionado, sin `cargas` o que no es carga", () => {
    const { primitivasAccionado: _, ...sinAccionado } = EV;
    expect(validarDefinicion(sinAccionado)).toEqual(["Una electroválvula lleva dibujo accionado."]);
    const { cargas: __, ...sinCargas } = EV;
    expect(validarDefinicion(sinCargas)).toEqual(["Una electroválvula monoestable lleva una carga."]);
    expect(validarDefinicion({ ...EV, elemento: "bobina" })).toEqual(["Solo una carga es electroválvula."]);
  });

  it("una carga sin `valvula` no lleva dibujo accionado (la lámpara)", () => {
    const { valvula: _, ...lampara } = EV;
    expect(validarDefinicion(lampara)).toEqual(["Solo un contacto, una protección o una electroválvula lleva dibujo accionado."]);
  });
});
