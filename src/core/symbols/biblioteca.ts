// Biblioteca de símbolos, según IEC 60617, como datos.
// Convención de dibujo: el símbolo se define vertical (circuito de arriba hacia
// abajo), con el primer borne arriba y el segundo abajo, y el centro en (0, 0).
// Las alimentaciones (fase y neutro) tienen un solo borne.
// Escala: 1 unidad de grilla = 2,5 mm, así un contacto de 4 unidades mide 10 mm.

import type { DefinicionSimbolo, Linea, Primitiva } from "./tipos";

// ── Ayudas para armar primitivas ───────────────────────────────────────────

function linea(x1: number, y1: number, x2: number, y2: number): Linea {
  return { forma: "linea", x1, y1, x2, y2 };
}

/**
 * Línea de trazos (enlace mecánico, IEC 60617-02-12-01) como segmentos sueltos.
 * Siempre empieza y termina con un trazo: los huecos se estiran o se achican
 * un poco (alrededor de `hueco`) para que el último toque (x2, y2).
 */
export function discontinua(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  trazo = 0.25,
  hueco = 0.2,
): Linea[] {
  const largo = Math.hypot(x2 - x1, y2 - y1);
  if (largo === 0) return [];
  if (largo <= 2 * trazo + hueco / 2) return [linea(x1, y1, x2, y2)];
  const n = Math.max(2, Math.round((largo + hueco) / (trazo + hueco)));
  const paso = trazo + (largo - n * trazo) / (n - 1);
  const ux = (x2 - x1) / largo;
  const uy = (y2 - y1) / largo;
  const segmentos: Linea[] = [];
  for (let i = 0; i < n; i++) {
    const d = i * paso;
    const fin = i === n - 1 ? largo : d + trazo;
    segmentos.push(linea(x1 + ux * d, y1 + uy * d, x1 + ux * fin, y1 + uy * fin));
  }
  // El último extremo exacto, sin error de punto flotante.
  const ultimo = segmentos[n - 1]!;
  ultimo.x2 = x2;
  ultimo.y2 = y2;
  return segmentos;
}

/** Conexiones de arriba y abajo: del borne (0, ±2) hasta (0, ±hasta). */
function conexiones(hasta: number): Linea[] {
  return [linea(0, -2, 0, -hasta), linea(0, hasta, 0, 2)];
}

/** X de la línea de un contacto en y = 0 (ahí se engancha el accionamiento). */
function xEnCentro(punta: { x: number; y: number }, bisagraY: number): number {
  return (punta.x * bisagraY) / (bisagraY - punta.y);
}

// ── Contactos (IEC 60617-07-02-01 y 07-02-03) ──────────────────────────────

/** Los contactos fijos terminan a 1 unidad del centro; la cuchilla gira en (0, 1). */
const BISAGRA_Y = 1;

/** Punta de la cuchilla del contacto NA: inclinada a la izquierda, abierta. */
const PUNTA_NA = { x: -0.9, y: -1.1 };

/** Punta de la cuchilla del contacto NC: inclinada a la derecha, cruza el tope. */
const PUNTA_NC = { x: 0.9, y: -1.25 };

/** Contacto de cierre (NA), 07-02-01. */
function contactoNA(): Primitiva[] {
  return [...conexiones(1), linea(0, BISAGRA_Y, PUNTA_NA.x, PUNTA_NA.y)];
}

/** Contacto de apertura (NC), 07-02-03: el tope horizontal apoya la cuchilla. */
function contactoNC(): Primitiva[] {
  return [...conexiones(1), linea(0, -1, 0.9, -1), linea(0, BISAGRA_Y, PUNTA_NC.x, PUNTA_NC.y)];
}

// ── Contactos accionados (T33, D9-B) ───────────────────────────────────────
// En Simular, un contacto accionado se dibuja en su estado: el NA cerrado (la
// cuchilla derecha, del contacto fijo de abajo al de arriba) y el NC abierto
// (la cuchilla inclinada a la izquierda, como la del NA en reposo, lejos del
// tope). Todo queda dentro de la caja del símbolo: la caja de dibujo no cambia.

/** Punta de la cuchilla del NA cerrado: sobre el contacto fijo de arriba. */
const PUNTA_NA_CERRADO = { x: 0, y: -1 };

/** NA accionado: cerrado, la cuchilla une los dos contactos fijos. */
function contactoNACerrado(): Primitiva[] {
  return [...conexiones(1), linea(0, BISAGRA_Y, PUNTA_NA_CERRADO.x, PUNTA_NA_CERRADO.y)];
}

/** NC accionado: abierto, la cuchilla se aparta del tope (la del NA en reposo). */
function contactoNCAbierto(): Primitiva[] {
  return [...conexiones(1), linea(0, -1, 0.9, -1), linea(0, BISAGRA_Y, PUNTA_NA.x, PUNTA_NA.y)];
}

// ── Accionamiento por pulsación (IEC 60617-02-13-05) ───────────────────────

/** X del accionador "[" a la izquierda del contacto. */
const ACCIONADOR_X = -1.75;

/**
 * Accionador manual por pulsación, unido con trazos a la cuchilla en y = 0.
 * Accionado (T33), el "[" queda donde está y los trazos siguen a la cuchilla:
 * así no sale de la caja del símbolo.
 */
function pulsacion(xCuchilla: number): Primitiva[] {
  return [
    ...discontinua(xCuchilla, 0, ACCIONADOR_X, 0),
    linea(ACCIONADOR_X, -0.5, ACCIONADOR_X, 0.5),
    linea(ACCIONADOR_X, -0.5, ACCIONADOR_X + 0.25, -0.5),
    linea(ACCIONADOR_X, 0.5, ACCIONADOR_X + 0.25, 0.5),
  ];
}

// ── Definiciones ───────────────────────────────────────────────────────────

/** Pulsador NA, 07-07-02: contacto de cierre con accionamiento por pulsación. */
export const PULSADOR_NA: DefinicionSimbolo = {
  tipo: "pulsador.na",
  nombre: "Pulsador NA",
  categoria: "mando",
  elemento: "contacto_na",
  accionamiento: "manual_momentaneo",
  prefijoEtiqueta: "S",
  tamano: { ancho: 4, alto: 4 },
  primitivas: [...contactoNA(), ...pulsacion(xEnCentro(PUNTA_NA, BISAGRA_Y))],
  primitivasAccionado: [...contactoNACerrado(), ...pulsacion(xEnCentro(PUNTA_NA_CERRADO, BISAGRA_Y))],
  // La cuchilla se inclina a la izquierda: los nombres, del otro lado.
  ladoNombresBornes: "derecha",
  bornes: [
    { nombre: "13", x: 0, y: -2, direccion: "arriba" },
    { nombre: "14", x: 0, y: 2, direccion: "abajo" },
  ],
};

/** Pulsador NC: contacto de apertura con accionamiento por pulsación. */
export const PULSADOR_NC: DefinicionSimbolo = {
  tipo: "pulsador.nc",
  nombre: "Pulsador NC",
  categoria: "mando",
  elemento: "contacto_nc",
  accionamiento: "manual_momentaneo",
  prefijoEtiqueta: "S",
  // La parada es S0; la marcha (pulsador NA) empieza en S1 (T27).
  primerNumero: 0,
  tamano: { ancho: 4, alto: 4 },
  primitivas: [...contactoNC(),...pulsacion(xEnCentro(PUNTA_NC, BISAGRA_Y))],
  primitivasAccionado: [...contactoNCAbierto(), ...pulsacion(xEnCentro(PUNTA_NA, BISAGRA_Y))],
  // El tope del contacto está a la derecha: los nombres, del otro lado.
  ladoNombresBornes: "izquierda",
  bornes: [
    { nombre: "11", x: 0, y: -2, direccion: "arriba" },
    { nombre: "12", x: 0, y: 2, direccion: "abajo" },
  ],
};

/** Bobina de contactor, 07-15-01: rectángulo con las conexiones en los lados largos. */
export const BOBINA_CONTACTOR: DefinicionSimbolo = {
  tipo: "contactor.bobina",
  nombre: "Bobina de contactor",
  categoria: "mando",
  elemento: "bobina",
  prefijoEtiqueta: "K",
  tamano: { ancho: 2, alto: 4 },
  primitivas: [...conexiones(0.75), { forma: "rectangulo", x: -1, y: -0.75, ancho: 2, alto: 1.5 }],
  bornes: [
    { nombre: "A1", x: 0, y: -2, direccion: "arriba" },
    { nombre: "A2", x: 0, y: 2, direccion: "abajo" },
  ],
};

/** Contacto auxiliar NA del contactor: lo acciona la bobina con su misma etiqueta. */
export const CONTACTO_AUXILIAR_NA: DefinicionSimbolo = {
  tipo: "contactor.auxiliar_na",
  nombre: "Contacto auxiliar NA",
  categoria: "mando",
  elemento: "contacto_na",
  accionamiento: "bobina",
  tamano: { ancho: 2, alto: 4 },
  primitivas: contactoNA(),
  primitivasAccionado: contactoNACerrado(),
  // La cuchilla se inclina a la izquierda: los nombres, del otro lado.
  ladoNombresBornes: "derecha",
  bornes: [
    { nombre: "13", x: 0, y: -2, direccion: "arriba" },
    { nombre: "14", x: 0, y: 2, direccion: "abajo" },
  ],
};

/**
 * Contacto auxiliar NC del contactor (T17b): lo acciona la bobina con su misma
 * etiqueta, al revés que el NA. Bornes 21-22 fijos (D1-A): el número de orden
 * (31-32, 41-42…) es tarea aparte.
 */
export const CONTACTO_AUXILIAR_NC: DefinicionSimbolo = {
  tipo: "contactor.auxiliar_nc",
  nombre: "Contacto auxiliar NC",
  categoria: "mando",
  elemento: "contacto_nc",
  accionamiento: "bobina",
  tamano: { ancho: 2, alto: 4 },
  primitivas: contactoNC(),
  primitivasAccionado: contactoNCAbierto(),
  // El tope del contacto está a la derecha: los nombres, del otro lado.
  ladoNombresBornes: "izquierda",
  bornes: [
    { nombre: "21", x: 0, y: -2, direccion: "arriba" },
    { nombre: "22", x: 0, y: 2, direccion: "abajo" },
  ],
};

/** Radio del círculo de la lámpara. */
const R_LAMPARA = 0.75;
/** Extremo de la cruz de la lámpara, sobre el círculo a 45°. */
const C_LAMPARA = R_LAMPARA * Math.SQRT1_2;

/** Lámpara de señalización, 08-10-01: círculo con una cruz. */
export const LAMPARA: DefinicionSimbolo = {
  tipo: "senalizacion.lampara",
  nombre: "Lámpara",
  categoria: "senalizacion",
  elemento: "carga",
  prefijoEtiqueta: "H",
  tamano: { ancho: 2, alto: 4 },
  primitivas: [
    ...conexiones(R_LAMPARA),
    { forma: "circulo", cx: 0, cy: 0, r: R_LAMPARA },
    linea(-C_LAMPARA, -C_LAMPARA, C_LAMPARA, C_LAMPARA),
    linea(-C_LAMPARA, C_LAMPARA, C_LAMPARA, -C_LAMPARA),
  ],
  bornes: [
    { nombre: "X1", x: 0, y: -2, direccion: "arriba" },
    { nombre: "X2", x: 0, y: 2, direccion: "abajo" },
  ],
};

// ── Alimentaciones ─────────────────────────────────────────────────────────
// Fase y neutro van sueltos: la fase arriba del esquema y el neutro abajo. Su
// etiqueta (L, L1, N…) es el nombre de la red: en la simulación, las
// alimentaciones con la misma etiqueta (sin espacios a los lados y en
// mayúsculas) quedan conectadas aunque no haya cable entre ellas.
// Las dos se dibujan igual (las distingue la etiqueta): un círculo con un
// período de senoide adentro, de alterna, y un tramo hasta el único borne,
// abajo. El dibujo llena justo la caja de 2×2.

/** Radio del círculo de alimentación. */
const RADIO_FUENTE = 0.8;
/** Centro del círculo: pegado al borde de arriba de la caja. */
const CENTRO_FUENTE = -1 + RADIO_FUENTE;
/** Medio ancho y amplitud de la senoide. */
const MEDIO_ANCHO_SENO = 0.5;
const AMPLITUD_SENO = 0.28;
/** Tramos rectos con que se aproxima la senoide. */
const TRAMOS_SENO = 12;

/**
 * Dibujo común de fase y neutro: círculo, senoide y tramo hasta el borne (0, 1).
 * Con `cy` y `hasta`, el mismo círculo más arriba y el tramo hasta (0, hasta) (la trifásica).
 */
function dibujoFuente(cy = CENTRO_FUENTE, hasta = 1): Primitiva[] {
  const seno: Linea[] = [];
  const punto = (i: number): [number, number] => [
    -MEDIO_ANCHO_SENO + (2 * MEDIO_ANCHO_SENO * i) / TRAMOS_SENO,
    // y crece hacia abajo: el primer medio período sube.
    cy - AMPLITUD_SENO * Math.sin((2 * Math.PI * i) / TRAMOS_SENO),
  ];
  for (let i = 0; i < TRAMOS_SENO; i++) {
    const [x1, y1] = punto(i);
    const [x2, y2] = punto(i + 1);
    seno.push(linea(x1, y1, x2, y2));
  }
  return [{ forma: "circulo", cx: 0, cy, r: RADIO_FUENTE }, ...seno, linea(0, cy + RADIO_FUENTE, 0, hasta)];
}

/** Fase: la etiqueta se edita (L1, L2, L3). */
export const FASE: DefinicionSimbolo = {
  tipo: "fuente.fase",
  nombre: "Fase (L)",
  categoria: "fuentes",
  elemento: "fuente",
  tamano: { ancho: 2, alto: 2 },
  primitivas: dibujoFuente(),
  bornes: [{ nombre: "L", x: 0, y: 1, direccion: "abajo" }],
  etiquetaInicial: "L",
  mostrarNombresBornes: false,
};

/** Neutro: mismo dibujo y mismo lado del borne que la fase. */
export const NEUTRO: DefinicionSimbolo = {
  tipo: "fuente.neutro",
  nombre: "Neutro (N)",
  categoria: "fuentes",
  elemento: "fuente",
  tamano: { ancho: 2, alto: 2 },
  primitivas: dibujoFuente(),
  bornes: [{ nombre: "N", x: 0, y: 1, direccion: "abajo" }],
  etiquetaInicial: "N",
  mostrarNombresBornes: false,
};

// ── Potencia (fase 6) ──────────────────────────────────────────────────────

/** Centro del círculo de la trifásica: pegado al borde de arriba de su caja de 4 de alto. */
const CENTRO_TRIFASICA = -2 + RADIO_FUENTE;

/** X de los tres bornes de los símbolos tripolares: un polo cada 2 unidades. */
const POLOS_X = [-2, 0, 2] as const;

/**
 * Fuente trifásica (T34): tres fases L1, L2 y L3 que salen hacia abajo. Cada
 * borne es su propia red (D1-A): L1 es la misma red que una Fase «L1». La
 * etiqueta es libre y no da nombre de red, así que no entra con etiqueta ni se
 * numera. Dibujo: el círculo con la senoide de la fase arriba en el medio y
 * un tramo hasta cada borne. Caja de 6×4, como los principales: con 2 de alto
 * los nombres de los bornes pisaban el círculo.
 */
export const FUENTE_TRIFASICA: DefinicionSimbolo = {
  tipo: "fuente.trifasica",
  nombre: "Fuente trifásica",
  categoria: "fuentes",
  elemento: "fuente",
  tamano: { ancho: 6, alto: 4 },
  primitivas: [
    ...dibujoFuente(CENTRO_TRIFASICA, 2),
    linea(-RADIO_FUENTE, CENTRO_TRIFASICA, -2, CENTRO_TRIFASICA),
    linea(-2, CENTRO_TRIFASICA, -2, 2),
    linea(RADIO_FUENTE, CENTRO_TRIFASICA, 2, CENTRO_TRIFASICA),
    linea(2, CENTRO_TRIFASICA, 2, 2),
  ],
  ladoNombresBornes: "derecha",
  bornes: POLOS_X.map((x, i) => ({ nombre: `L${i + 1}`, x, y: 2, direccion: "abajo" as const })),
};

/** Tres contactos iguales, uno por polo, corridos a `POLOS_X`. */
function tripolar(contacto: Primitiva[]): Primitiva[] {
  const salida: Primitiva[] = [];
  for (const dx of POLOS_X) {
    for (const p of contacto) if (p.forma === "linea") salida.push(linea(p.x1 + dx, p.y1, p.x2 + dx, p.y2));
  }
  return salida;
}

/** Enlace mecánico de los tres polos, en y = 0, desde la cuchilla del primero a la del último. */
function enlaceTripolar(xCuchilla: number): Linea[] {
  return discontinua(POLOS_X[0] + xCuchilla, 0, POLOS_X[2] + xCuchilla, 0);
}

/**
 * Contactos principales del contactor (T34), 07-13-02: tres NA con enlace
 * mecánico. Lo acciona la bobina con su misma etiqueta, como al auxiliar, y
 * los tres polos (1-2, 3-4, 5-6) se mueven juntos.
 */
export const CONTACTOR_PRINCIPAL: DefinicionSimbolo = {
  tipo: "contactor.principal",
  nombre: "Contactos principales",
  categoria: "potencia",
  elemento: "contacto_na",
  accionamiento: "bobina",
  tamano: { ancho: 6, alto: 4 },
  primitivas: [...tripolar(contactoNA()), ...enlaceTripolar(xEnCentro(PUNTA_NA, BISAGRA_Y))],
  primitivasAccionado: [...tripolar(contactoNACerrado()), ...enlaceTripolar(0)],
  // Como en el auxiliar NA: la cuchilla se inclina a la izquierda.
  ladoNombresBornes: "derecha",
  bornes: POLOS_X.flatMap((x, i) => [
    { nombre: `${2 * i + 1}`, x, y: -2, direccion: "arriba" as const },
    { nombre: `${2 * i + 2}`, x, y: 2, direccion: "abajo" as const },
  ]),
  polos: [
    ["1", "2"],
    ["3", "4"],
    ["5", "6"],
  ],
};

/** Todos los símbolos de la biblioteca. */
export const SIMBOLOS: readonly DefinicionSimbolo[] = [
  FASE,
  NEUTRO,
  PULSADOR_NA,
  PULSADOR_NC,
  BOBINA_CONTACTOR,
  CONTACTO_AUXILIAR_NA,
  CONTACTO_AUXILIAR_NC,
  LAMPARA,
  FUENTE_TRIFASICA,
  CONTACTOR_PRINCIPAL,
];

const POR_TIPO = new Map(SIMBOLOS.map((s) => [s.tipo, s]));

/** Busca una definición por su tipo (el que se guarda en .brn). */
export function buscarSimbolo(tipo: string): DefinicionSimbolo | undefined {
  return POR_TIPO.get(tipo);
}
