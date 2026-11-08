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

// ── Accionamiento por pulsación (IEC 60617-02-13-05) ───────────────────────

/** X del accionador "[" a la izquierda del contacto. */
const ACCIONADOR_X = -1.75;

/** Accionador manual por pulsación, unido con trazos a la cuchilla en y = 0. */
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
  tamano: { ancho: 4, alto: 4 },
  primitivas: [...contactoNA(), ...pulsacion(xEnCentro(PUNTA_NA, BISAGRA_Y))],
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
  tamano: { ancho: 4, alto: 4 },
  primitivas: [...contactoNC(), ...pulsacion(xEnCentro(PUNTA_NC, BISAGRA_Y))],
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
  // La cuchilla se inclina a la izquierda: los nombres, del otro lado.
  ladoNombresBornes: "derecha",
  bornes: [
    { nombre: "13", x: 0, y: -2, direccion: "arriba" },
    { nombre: "14", x: 0, y: 2, direccion: "abajo" },
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

/** Dibujo común de fase y neutro: círculo, senoide y tramo hasta el borne (0, 1). */
function dibujoFuente(): Primitiva[] {
  const seno: Linea[] = [];
  const punto = (i: number): [number, number] => [
    -MEDIO_ANCHO_SENO + (2 * MEDIO_ANCHO_SENO * i) / TRAMOS_SENO,
    // y crece hacia abajo: el primer medio período sube.
    CENTRO_FUENTE - AMPLITUD_SENO * Math.sin((2 * Math.PI * i) / TRAMOS_SENO),
  ];
  for (let i = 0; i < TRAMOS_SENO; i++) {
    const [x1, y1] = punto(i);
    const [x2, y2] = punto(i + 1);
    seno.push(linea(x1, y1, x2, y2));
  }
  return [
    { forma: "circulo", cx: 0, cy: CENTRO_FUENTE, r: RADIO_FUENTE },
    ...seno,
    linea(0, CENTRO_FUENTE + RADIO_FUENTE, 0, 1),
  ];
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

/** Todos los símbolos de la biblioteca. */
export const SIMBOLOS: readonly DefinicionSimbolo[] = [
  FASE,
  NEUTRO,
  PULSADOR_NA,
  PULSADOR_NC,
  BOBINA_CONTACTOR,
  CONTACTO_AUXILIAR_NA,
  LAMPARA,
];

const POR_TIPO = new Map(SIMBOLOS.map((s) => [s.tipo, s]));

/** Busca una definición por su tipo (el que se guarda en .brn). */
export function buscarSimbolo(tipo: string): DefinicionSimbolo | undefined {
  return POR_TIPO.get(tipo);
}
