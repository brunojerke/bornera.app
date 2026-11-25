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
  subgrupo: "entradas",
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
  subgrupo: "entradas",
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
  subgrupo: "bobinas",
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
  subgrupo: "contactos",
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
  subgrupo: "contactos",
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
  subgrupo: "senalizacion",
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
  subgrupo: "alimentacion",
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
  subgrupo: "alimentacion",
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
  subgrupo: "fuentes",
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
  subgrupo: "maniobra",
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

// ── Potencia (T35) ─────────────────────────────────────────────────────────
// Protecciones y seccionador (D13-A): `elemento: "proteccion"` con un polo por
// par de bornes (1-2, 3-4…). Desde T36 conducen siempre (D6-A, D17-A) y 6b
// suma abrir y disparar. El polo N de las
// tetrapolares y de los diferenciales va con una «N» dibujada (D8-A).
// Motores (D14-A): `elemento: "carga"` con 3 o 6 bornes. La netlist arma
// cargas solo de 2 bornes, así que en 6a no conducen ni son carga.

/** X de los polos de los símbolos de 1, 2 y 4 polos (los de 3, `POLOS_X`). */
const POLOS_1 = [0] as const;
const POLOS_2 = [-1, 1] as const;
const POLOS_4 = [-3, -1, 1, 3] as const;

/** Las primitivas del contacto (líneas y rectángulos) repetidas en cada polo de `xs`. */
function multipolar(contacto: Primitiva[], xs: readonly number[]): Primitiva[] {
  const salida: Primitiva[] = [];
  for (const dx of xs) {
    for (const p of contacto) {
      if (p.forma === "linea") salida.push(linea(p.x1 + dx, p.y1, p.x2 + dx, p.y2));
      else if (p.forma === "rectangulo") salida.push({ ...p, x: p.x + dx });
    }
  }
  return salida;
}

/** Enlace mecánico en y = 0, de la cuchilla del último polo hasta `hastaX` (por defecto, la del primero). */
function enlace(xs: readonly number[], xCuchilla: number, hastaX = xs[0]! + xCuchilla): Linea[] {
  return discontinua(xs[xs.length - 1]! + xCuchilla, 0, hastaX, 0);
}

/** Bornes 1, 3, 5… arriba y 2, 4, 6… abajo, uno por polo de `xs`, en una caja de `alto`. */
function bornesPolos(xs: readonly number[], alto = 4): DefinicionSimbolo["bornes"] {
  return xs.flatMap((x, i) => [
    { nombre: `${2 * i + 1}`, x, y: -alto / 2, direccion: "arriba" as const },
    { nombre: `${2 * i + 2}`, x, y: alto / 2, direccion: "abajo" as const },
  ]);
}

/** Polos 1-2, 3-4… de `n` polos. */
function polosNumerados(n: number): [string, string][] {
  return Array.from({ length: n }, (_, i) => [`${2 * i + 1}`, `${2 * i + 2}`] as [string, string]);
}

/** La «N» del polo de neutro (D8-A), a la derecha de la cuchilla del polo en `x`, a la altura `y`. */
function marcaNeutro(x: number, y = 0.5): Primitiva {
  return { forma: "texto", x: x + 0.45, y, texto: "N", alto: 0.7, alineacion: "izquierda" };
}

/** Función de interruptor automático (07-13-05): una cruz sobre el contacto fijo de arriba. */
const CRUZ_AUTOMATICO: Linea[] = [linea(-0.25, -1.25, 0.25, -0.75), linea(-0.25, -0.75, 0.25, -1.25)];

/** Función de seccionador (07-13-06): una barra sobre el contacto fijo de arriba. */
const BARRA_SECCIONADOR: Linea[] = [linea(-0.35, -1, 0.35, -1)];

/** X de la cuchilla del NA en y = 0: ahí se engancha el enlace. */
const X_CUCHILLA_NA = xEnCentro(PUNTA_NA, BISAGRA_Y);

// Dibujo cerrado (T36, D20-B): las protecciones conducen siempre en 6a y en
// Simular salen accionadas (el NA cerrado, como el principal de T34). Lo
// llevan las de cuchilla; el fusible y el térmico se ven igual en los dos
// estados. Los textos («N», «IΔ», «I>») van iguales en los dos dibujos.

/** Termomagnética de `xs.length` polos: NA con la cruz de automático y enlace; la 4P lleva la «N» en 7-8. */
function termomagnetica(tipo: string, nombre: string, xs: readonly number[]): DefinicionSimbolo {
  const n = xs.length;
  return {
    tipo,
    nombre,
    subgrupo: "proteccion",
    elemento: "proteccion",
    prefijoEtiqueta: "Q",
    tamano: { ancho: 2 * n, alto: 4 },
    primitivas: [
      ...multipolar([...contactoNA(), ...CRUZ_AUTOMATICO], xs),
      ...(n > 1 ? enlace(xs, X_CUCHILLA_NA) : []),
      ...(n === 4 ? [marcaNeutro(xs[3]!)] : []),
    ],
    primitivasAccionado: [
      ...multipolar([...contactoNACerrado(), ...CRUZ_AUTOMATICO], xs),
      ...(n > 1 ? enlace(xs, 0) : []),
      ...(n === 4 ? [marcaNeutro(xs[3]!)] : []),
    ],
    ladoNombresBornes: "derecha",
    bornes: bornesPolos(xs),
    ...(n > 1 ? { polos: polosNumerados(n) } : {}),
  };
}

export const TERMOMAGNETICA_UNIPOLAR = termomagnetica("proteccion.termomagnetica_unipolar", "Termomagnética unipolar", POLOS_1);
export const TERMOMAGNETICA_BIPOLAR = termomagnetica("proteccion.termomagnetica_bipolar", "Termomagnética bipolar", POLOS_2);
export const TERMOMAGNETICA_TRIPOLAR = termomagnetica("proteccion.termomagnetica_tripolar", "Termomagnética tripolar", POLOS_X);
export const TERMOMAGNETICA_TETRAPOLAR = termomagnetica("proteccion.termomagnetica_tetrapolar", "Termomagnética tetrapolar", POLOS_4);

/** Las líneas del contacto corridas `dy` en vertical. */
function corrido(contacto: Primitiva[], dy: number): Primitiva[] {
  return contacto.flatMap((p) => (p.forma === "linea" ? [linea(p.x1, p.y1 + dy, p.x2, p.y2 + dy)] : []));
}

/** Y del centro del contacto del diferencial (corrido hacia arriba para dejar lugar al toroide). */
const Y_CONTACTO_DIFERENCIAL = -1;
/** Y del medio de la banda del toroide: entre el contacto y los nombres de los bornes de abajo. */
const Y_TOROIDE = 1.45;

/**
 * Diferencial: NA con enlace arriba, el toroide que abraza los conductores
 * abajo y el bloque «IΔ» a la izquierda, unido al enlace y al toroide. Mide 6
 * de alto: con 4, la banda pisaba los nombres de los bornes de abajo. El
 * último polo es el de neutro, con su «N» (D8-A): 3-4 en el bipolar, 7-8 en
 * el tetrapolar.
 */
function diferencial(tipo: string, nombre: string, xs: readonly number[]): DefinicionSimbolo {
  const n = xs.length;
  const izq = xs[0]!;
  const der = xs[n - 1]!;
  const yc = Y_CONTACTO_DIFERENCIAL;
  /** Bloque de disparo: 0,8 × 0,8 centrado en (cx, yc). */
  const cx = izq - 1.5;
  /** Todo menos el contacto: el bloque, el toroide y la «N», iguales en los dos dibujos. */
  const resto = (xCuchilla: number): Primitiva[] => [
    ...discontinua(der + xCuchilla, yc, cx + 0.4, yc),
    { forma: "rectangulo", x: cx - 0.4, y: yc - 0.4, ancho: 0.8, alto: 0.8 },
    { forma: "texto", x: cx, y: yc, texto: "IΔ", alto: 0.4, alineacion: "centro" },
    // Toroide: una banda que cruza los conductores, unida al bloque.
    { forma: "rectangulo", x: izq - 0.5, y: Y_TOROIDE - 0.175, ancho: der - izq + 1, alto: 0.35 },
    linea(cx, yc + 0.4, cx, Y_TOROIDE),
    linea(cx, Y_TOROIDE, izq - 0.5, Y_TOROIDE),
    marcaNeutro(der, yc + 0.5),
  ];
  return {
    tipo,
    nombre,
    subgrupo: "proteccion",
    elemento: "proteccion",
    prefijoEtiqueta: "Q",
    tamano: { ancho: 2 * n + 2, alto: 6 },
    primitivas: [
      // El contacto de 4 corrido 1 hacia arriba (de −3 a 1) y el conductor hasta el borne de abajo.
      ...multipolar([...corrido(contactoNA(), yc), linea(0, 2 + yc, 0, 3)], xs),
      ...resto(X_CUCHILLA_NA),
    ],
    primitivasAccionado: [...multipolar([...corrido(contactoNACerrado(), yc), linea(0, 2 + yc, 0, 3)], xs), ...resto(0)],
    ladoNombresBornes: "derecha",
    bornes: bornesPolos(xs, 6),
    polos: polosNumerados(n),
  };
}

export const DIFERENCIAL_BIPOLAR = diferencial("proteccion.diferencial_bipolar", "Diferencial bipolar", POLOS_2);
export const DIFERENCIAL_TETRAPOLAR = diferencial("proteccion.diferencial_tetrapolar", "Diferencial tetrapolar", POLOS_4);

/** X del bloque de disparo del guardamotor (térmico arriba, magnético abajo). */
const X_DISPARO_GUARDAMOTOR = -3.5;

/** Los disparos del guardamotor, iguales en los dos dibujos. */
const DISPAROS_GUARDAMOTOR: Primitiva[] = [
  linea(X_DISPARO_GUARDAMOTOR, -0.5, X_DISPARO_GUARDAMOTOR, 0.5),
  { forma: "rectangulo", x: X_DISPARO_GUARDAMOTOR - 0.4, y: -1.3, ancho: 0.8, alto: 0.8 },
  linea(X_DISPARO_GUARDAMOTOR - 0.25, -0.65, X_DISPARO_GUARDAMOTOR, -0.65),
  linea(X_DISPARO_GUARDAMOTOR, -0.65, X_DISPARO_GUARDAMOTOR, -1.15),
  linea(X_DISPARO_GUARDAMOTOR, -1.15, X_DISPARO_GUARDAMOTOR + 0.25, -1.15),
  { forma: "rectangulo", x: X_DISPARO_GUARDAMOTOR - 0.4, y: 0.5, ancho: 0.8, alto: 0.8 },
  { forma: "texto", x: X_DISPARO_GUARDAMOTOR, y: 0.9, texto: "I>", alto: 0.4, alineacion: "centro" },
];

/**
 * Guardamotor: tres NA con la cruz de automático y el enlace hasta los
 * disparos térmico (el escalón, 07-15-21) y magnético («I>») a la izquierda.
 */
export const GUARDAMOTOR: DefinicionSimbolo = {
  tipo: "proteccion.guardamotor",
  nombre: "Guardamotor",
  subgrupo: "proteccion",
  elemento: "proteccion",
  prefijoEtiqueta: "Q",
  tamano: { ancho: 8, alto: 4 },
  primitivas: [
    ...multipolar([...contactoNA(), ...CRUZ_AUTOMATICO], POLOS_X),
    ...enlace(POLOS_X, X_CUCHILLA_NA, X_DISPARO_GUARDAMOTOR),
    ...DISPAROS_GUARDAMOTOR,
  ],
  primitivasAccionado: [
    ...multipolar([...contactoNACerrado(), ...CRUZ_AUTOMATICO], POLOS_X),
    ...enlace(POLOS_X, 0, X_DISPARO_GUARDAMOTOR),
    ...DISPAROS_GUARDAMOTOR,
  ],
  ladoNombresBornes: "derecha",
  bornes: bornesPolos(POLOS_X),
  polos: polosNumerados(3),
};

/** X del accionador manual del seccionador. */
const X_MANUAL_SECCIONADOR = -2.75;

/** Seccionador tripolar: tres NA con la barra de seccionador y el enlace hasta el accionador manual (02-13-01). */
export const SECCIONADOR: DefinicionSimbolo = {
  tipo: "maniobra.seccionador",
  nombre: "Seccionador",
  subgrupo: "maniobra",
  elemento: "proteccion",
  prefijoEtiqueta: "Q",
  tamano: { ancho: 6, alto: 4 },
  primitivas: [
    ...multipolar([...contactoNA(), ...BARRA_SECCIONADOR], POLOS_X),
    ...enlace(POLOS_X, X_CUCHILLA_NA, X_MANUAL_SECCIONADOR),
    linea(X_MANUAL_SECCIONADOR, -0.5, X_MANUAL_SECCIONADOR, 0.5),
  ],
  primitivasAccionado: [
    ...multipolar([...contactoNACerrado(), ...BARRA_SECCIONADOR], POLOS_X),
    ...enlace(POLOS_X, 0, X_MANUAL_SECCIONADOR),
    linea(X_MANUAL_SECCIONADOR, -0.5, X_MANUAL_SECCIONADOR, 0.5),
  ],
  ladoNombresBornes: "derecha",
  bornes: bornesPolos(POLOS_X),
  polos: polosNumerados(3),
};

/** Fusible tripolar (07-21-01, D4-A): un rectángulo con el conductor adentro, por polo. */
export const FUSIBLE_TRIPOLAR: DefinicionSimbolo = {
  tipo: "proteccion.fusible_tripolar",
  nombre: "Fusible tripolar",
  subgrupo: "proteccion",
  elemento: "proteccion",
  prefijoEtiqueta: "F",
  tamano: { ancho: 6, alto: 4 },
  primitivas: multipolar([linea(0, -2, 0, 2), { forma: "rectangulo", x: -0.4, y: -1, ancho: 0.8, alto: 2 }], POLOS_X),
  ladoNombresBornes: "derecha",
  bornes: bornesPolos(POLOS_X),
  polos: polosNumerados(3),
};

/**
 * Relé térmico, elemento de potencia (07-15-21): el conductor hace un escalón
 * dentro de un rectángulo, por polo, y los rectángulos van unidos con trazos.
 * Sus contactos 95-96 y 97-98 (T36) lo siguen por la etiqueta.
 */
export const TERMICO: DefinicionSimbolo = {
  tipo: "proteccion.termico",
  nombre: "Relé térmico",
  subgrupo: "proteccion",
  elemento: "proteccion",
  prefijoEtiqueta: "F",
  tamano: { ancho: 6, alto: 4 },
  primitivas: [
    ...multipolar(
      [
        linea(0, -2, 0, -0.3),
        linea(0, -0.3, -0.3, -0.3),
        linea(-0.3, -0.3, -0.3, 0.3),
        linea(-0.3, 0.3, 0, 0.3),
        linea(0, 0.3, 0, 2),
        { forma: "rectangulo", x: -0.5, y: -0.8, ancho: 1, alto: 1.6 },
      ],
      POLOS_X,
    ),
    ...discontinua(-1.5, 0, -0.5, 0),
    ...discontinua(0.5, 0, 1.5, 0),
  ],
  ladoNombresBornes: "derecha",
  bornes: bornesPolos(POLOS_X),
  polos: polosNumerados(3),
};

/** Radio del círculo de los motores. */
const R_MOTOR = 1.5;
/** Punto del círculo a 45° de la vertical. */
const D_MOTOR = R_MOTOR * Math.SQRT1_2;

/**
 * Conexiones de los motores desde los bornes de `y` (−2 o −3 arriba; positivo,
 * abajo) hasta el círculo de centro (0, cy): la del medio, recta; las de los
 * lados bajan un poco y van en diagonal al círculo, a 45°.
 */
function conexionesMotor(y: number, cy: number): Linea[] {
  const s = Math.sign(y);
  const codo = y - s * 0.6;
  return [
    linea(-2, y, -2, codo),
    linea(-2, codo, -D_MOTOR, cy + s * D_MOTOR),
    linea(0, y, 0, cy + s * R_MOTOR),
    linea(2, y, 2, codo),
    linea(2, codo, D_MOTOR, cy + s * D_MOTOR),
  ];
}

/** Círculo con «M» y «3~» (06-04-01), centrado en (0, cy). */
function cuerpoMotor(cy: number): Primitiva[] {
  return [
    { forma: "circulo", cx: 0, cy, r: R_MOTOR },
    { forma: "texto", x: 0, y: cy - 0.3, texto: "M", alto: 1, alineacion: "centro" },
    { forma: "texto", x: 0, y: cy + 0.75, texto: "3~", alto: 0.6, alineacion: "centro" },
  ];
}

/** Motor trifásico: U, V y W arriba. */
export const MOTOR_TRIFASICO: DefinicionSimbolo = {
  tipo: "motor.trifasico",
  nombre: "Motor trifásico",
  subgrupo: "cargas",
  elemento: "carga",
  prefijoEtiqueta: "M",
  tamano: { ancho: 6, alto: 4 },
  primitivas: [...conexionesMotor(-2, 0.5), ...cuerpoMotor(0.5)],
  bornes: POLOS_X.map((x, i) => ({ nombre: "UVW"[i]!, x, y: -2, direccion: "arriba" as const })),
};

/** Motor para estrella-triángulo: U1, V1 y W1 arriba; U2, V2 y W2 abajo. */
export const MOTOR_ESTRELLA_TRIANGULO: DefinicionSimbolo = {
  tipo: "motor.estrella_triangulo",
  nombre: "Motor estrella-triángulo",
  subgrupo: "cargas",
  elemento: "carga",
  prefijoEtiqueta: "M",
  tamano: { ancho: 6, alto: 6 },
  primitivas: [...conexionesMotor(-3, 0), ...conexionesMotor(3, 0), ...cuerpoMotor(0)],
  bornes: [
    ...POLOS_X.map((x, i) => ({ nombre: `${"UVW"[i]}1`, x, y: -3, direccion: "arriba" as const })),
    ...POLOS_X.map((x, i) => ({ nombre: `${"UVW"[i]}2`, x, y: 3, direccion: "abajo" as const })),
  ],
};

/**
 * Fuente trifásica con neutro: L1, L2, L3 y N abajo, en x −3, −1, 1 y 3. Como
 * la trifásica (D1-A): cada borne es su red y la etiqueta es libre. L1 y N
 * salen de los lados del círculo; L2 y L3, de abajo a 45°.
 */
export const FUENTE_TRIFASICA_N: DefinicionSimbolo = {
  tipo: "fuente.trifasica_n",
  nombre: "Fuente trifásica con neutro",
  subgrupo: "fuentes",
  elemento: "fuente",
  tamano: { ancho: 8, alto: 4 },
  primitivas: (() => {
    const [circulo, ...resto] = dibujoFuente(CENTRO_TRIFASICA, 2);
    // Sin el tramo del medio hasta el borne: este símbolo no tiene borne en x = 0.
    const seno = resto.slice(0, -1);
    const d = RADIO_FUENTE * Math.SQRT1_2;
    // De (∓d, cy + d) a 45° hasta x = ∓1: baja 1 − d, así que llega a cy + 1.
    const codo = CENTRO_TRIFASICA + 1;
    return [
      circulo!,
      ...seno,
      linea(-RADIO_FUENTE, CENTRO_TRIFASICA, -3, CENTRO_TRIFASICA),
      linea(-3, CENTRO_TRIFASICA, -3, 2),
      linea(-d, CENTRO_TRIFASICA + d, -1, codo),
      linea(-1, codo, -1, 2),
      linea(d, CENTRO_TRIFASICA + d, 1, codo),
      linea(1, codo, 1, 2),
      linea(RADIO_FUENTE, CENTRO_TRIFASICA, 3, CENTRO_TRIFASICA),
      linea(3, CENTRO_TRIFASICA, 3, 2),
    ];
  })(),
  ladoNombresBornes: "derecha",
  bornes: POLOS_4.map((x, i) => ({ nombre: ["L1", "L2", "L3", "N"][i]!, x, y: 2, direccion: "abajo" as const })),
};

/**
 * Tierra de protección (02-15-03): el borne PE arriba y tres trazos que se
 * achican. Forma red y no da potencial en 6a (D11-B). Como la fase, la
 * etiqueta es el nombre de la red: entra «PE».
 */
export const TIERRA: DefinicionSimbolo = {
  tipo: "fuente.tierra",
  nombre: "Tierra (PE)",
  subgrupo: "fuentes",
  elemento: "fuente",
  tamano: { ancho: 2, alto: 2 },
  primitivas: [linea(0, -1, 0, 0), linea(-0.8, 0, 0.8, 0), linea(-0.5, 0.35, 0.5, 0.35), linea(-0.2, 0.7, 0.2, 0.7)],
  bornes: [{ nombre: "PE", x: 0, y: -1, direccion: "arriba" }],
  etiquetaInicial: "PE",
  mostrarNombresBornes: false,
};

// ── Mando (T36) ────────────────────────────────────────────────────────────
// Contactos de 4 de ancho como los pulsadores: el accionamiento a la izquierda,
// unido con trazos a la cuchilla en y = 0. Accionados (T33), los trazos
// siguen a la cuchilla y el accionamiento queda donde está.
// - Selector y seta: `manual_enclavado`; en Simular un clic los acciona y otro
//   los libera (D7-A; la seta abre su NC). El final, como el pulsador.
// - 95-96 y 97-98: `termico`, siguen al relé térmico F de su etiqueta. En 6a
//   F no dispara: 95-96 cerrado y 97-98 abierto, como en reposo.
// - Fusible de mando: protección de un polo, conduce siempre. Bocina: carga
//   de 2 bornes, como la lámpara.

/** X de la cuchilla en y = 0 del NA y del NC en reposo, y del NA cerrado. */
const X_EN_NA = xEnCentro(PUNTA_NA, BISAGRA_Y);
const X_EN_NC = xEnCentro(PUNTA_NC, BISAGRA_Y);
const X_EN_NA_CERRADO = xEnCentro(PUNTA_NA_CERRADO, BISAGRA_Y);

/** Trazos de la cuchilla en `xCuchilla` hasta el accionamiento en `hasta`, más el accionamiento. */
function accionamiento(xCuchilla: number, hasta: number, cabeza: Primitiva[]): Primitiva[] {
  return [...discontinua(xCuchilla, 0, hasta, 0), ...cabeza];
}

/** Accionamiento por giro (02-13-04): el trazo vertical con los extremos doblados. */
const GIRO: Primitiva[] = [
  linea(ACCIONADOR_X, -0.5, ACCIONADOR_X, 0.5),
  linea(ACCIONADOR_X, -0.5, ACCIONADOR_X + 0.25, -0.5),
  linea(ACCIONADOR_X - 0.25, 0.5, ACCIONADOR_X, 0.5),
];

/** X del vástago de la seta: la cabeza (medio círculo) queda a su izquierda. */
const X_SETA = -1.5;
/** Pulsador de seta (02-13-07): el vástago y la cabeza en medio círculo. */
const SETA_CABEZA: Primitiva[] = [linea(X_SETA, -0.5, X_SETA, 0.5), { forma: "arco", cx: X_SETA, cy: 0, r: 0.5, desde: 90, hasta: 270 }];

/** Rodillo del final de carrera (02-13-21): un círculo al final de los trazos. */
const R_RODILLO = 0.35;
const X_RODILLO = -2 + R_RODILLO;
const RODILLO: Primitiva[] = [{ forma: "circulo", cx: X_RODILLO, cy: 0, r: R_RODILLO }];

/** Efecto térmico (07-15-21) en un recuadro, como el del guardamotor. */
const X_TERMICO = -1.6;
const EFECTO_TERMICO: Primitiva[] = [
  { forma: "rectangulo", x: X_TERMICO - 0.4, y: -0.4, ancho: 0.8, alto: 0.8 },
  linea(X_TERMICO - 0.25, 0.2, X_TERMICO, 0.2),
  linea(X_TERMICO, 0.2, X_TERMICO, -0.2),
  linea(X_TERMICO, -0.2, X_TERMICO + 0.25, -0.2),
];

/** Un contacto NA o NC con accionamiento: dibujo de reposo y accionado. */
function conAccionamiento(na: boolean, hasta: number, cabeza: Primitiva[]): Pick<DefinicionSimbolo, "primitivas" | "primitivasAccionado"> {
  return na
    ? { primitivas: [...contactoNA(), ...accionamiento(X_EN_NA, hasta, cabeza)], primitivasAccionado: [...contactoNACerrado(), ...accionamiento(X_EN_NA_CERRADO, hasta, cabeza)] }
    : { primitivas: [...contactoNC(), ...accionamiento(X_EN_NC, hasta, cabeza)], primitivasAccionado: [...contactoNCAbierto(), ...accionamiento(X_EN_NA, hasta, cabeza)] };
}

/** Bornes de arriba y abajo con esos nombres. */
function dosBornes(arriba: string, abajo: string): DefinicionSimbolo["bornes"] {
  return [
    { nombre: arriba, x: 0, y: -2, direccion: "arriba" },
    { nombre: abajo, x: 0, y: 2, direccion: "abajo" },
  ];
}

/** Selector NA (07-07-01 con accionamiento por giro): queda donde se lo deja. */
export const SELECTOR: DefinicionSimbolo = {
  tipo: "mando.selector",
  nombre: "Selector NA",
  subgrupo: "entradas",
  elemento: "contacto_na",
  accionamiento: "manual_enclavado",
  prefijoEtiqueta: "S",
  tamano: { ancho: 4, alto: 4 },
  ...conAccionamiento(true, ACCIONADOR_X, GIRO),
  ladoNombresBornes: "derecha",
  bornes: dosBornes("13", "14"),
};

/** Pulsador de seta NC (parada de emergencia): queda accionado hasta liberarlo. */
export const SETA: DefinicionSimbolo = {
  tipo: "mando.seta",
  nombre: "Seta NC",
  subgrupo: "entradas",
  elemento: "contacto_nc",
  accionamiento: "manual_enclavado",
  prefijoEtiqueta: "S",
  tamano: { ancho: 4, alto: 4 },
  ...conAccionamiento(false, X_SETA, SETA_CABEZA),
  ladoNombresBornes: "izquierda",
  bornes: dosBornes("11", "12"),
};

/** Final de carrera NA (07-08-01, con rodillo): como el pulsador, se mantiene. */
export const FINAL_NA: DefinicionSimbolo = {
  tipo: "mando.final_na",
  nombre: "Final de carrera NA",
  subgrupo: "entradas",
  elemento: "contacto_na",
  accionamiento: "manual_momentaneo",
  prefijoEtiqueta: "S",
  tamano: { ancho: 4, alto: 4 },
  ...conAccionamiento(true, X_RODILLO + R_RODILLO, RODILLO),
  ladoNombresBornes: "derecha",
  bornes: dosBornes("13", "14"),
};

/** Final de carrera NC (07-08-02, con rodillo). */
export const FINAL_NC: DefinicionSimbolo = {
  tipo: "mando.final_nc",
  nombre: "Final de carrera NC",
  subgrupo: "entradas",
  elemento: "contacto_nc",
  accionamiento: "manual_momentaneo",
  prefijoEtiqueta: "S",
  tamano: { ancho: 4, alto: 4 },
  ...conAccionamiento(false, X_RODILLO + R_RODILLO, RODILLO),
  ladoNombresBornes: "izquierda",
  bornes: dosBornes("11", "12"),
};

/** Contacto NC del relé térmico, 95-96: sigue al F de su etiqueta. */
export const TERMICO_NC: DefinicionSimbolo = {
  tipo: "termico.contacto_nc",
  nombre: "Contacto del térmico NC",
  subgrupo: "contactos",
  elemento: "contacto_nc",
  accionamiento: "termico",
  tamano: { ancho: 4, alto: 4 },
  ...conAccionamiento(false, X_TERMICO + 0.4, EFECTO_TERMICO),
  ladoNombresBornes: "izquierda",
  bornes: dosBornes("95", "96"),
};

/** Contacto NA del relé térmico, 97-98: sigue al F de su etiqueta. */
export const TERMICO_NA: DefinicionSimbolo = {
  tipo: "termico.contacto_na",
  nombre: "Contacto del térmico NA",
  subgrupo: "contactos",
  elemento: "contacto_na",
  accionamiento: "termico",
  tamano: { ancho: 4, alto: 4 },
  ...conAccionamiento(true, X_TERMICO + 0.4, EFECTO_TERMICO),
  ladoNombresBornes: "derecha",
  bornes: dosBornes("97", "98"),
};

/** Fusible de mando (07-21-01): un polo, 1-2. Conduce siempre (D6-A). */
export const FUSIBLE: DefinicionSimbolo = {
  tipo: "proteccion.fusible",
  nombre: "Fusible",
  subgrupo: "alimentacion",
  elemento: "proteccion",
  prefijoEtiqueta: "F",
  tamano: { ancho: 2, alto: 4 },
  primitivas: [linea(0, -2, 0, 2), { forma: "rectangulo", x: -0.4, y: -1, ancho: 0.8, alto: 2 }],
  ladoNombresBornes: "derecha",
  bornes: dosBornes("1", "2"),
};

/** Bocina (08-10-05): el cuerpo y la boca que se abre a la derecha. Carga como la lámpara. */
export const BOCINA: DefinicionSimbolo = {
  tipo: "senalizacion.bocina",
  nombre: "Bocina",
  subgrupo: "senalizacion",
  elemento: "carga",
  prefijoEtiqueta: "H",
  tamano: { ancho: 2, alto: 4 },
  primitivas: [
    ...conexiones(0.5),
    { forma: "rectangulo", x: -0.4, y: -0.5, ancho: 0.8, alto: 1 },
    linea(0.4, -0.5, 1, -0.9),
    linea(1, -0.9, 1, 0.9),
    linea(1, 0.9, 0.4, 0.5),
  ],
  bornes: dosBornes("X1", "X2"),
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
  FUENTE_TRIFASICA_N,
  TIERRA,
  TERMOMAGNETICA_UNIPOLAR,
  TERMOMAGNETICA_BIPOLAR,
  TERMOMAGNETICA_TRIPOLAR,
  TERMOMAGNETICA_TETRAPOLAR,
  DIFERENCIAL_BIPOLAR,
  DIFERENCIAL_TETRAPOLAR,
  GUARDAMOTOR,
  SECCIONADOR,
  FUSIBLE_TRIPOLAR,
  TERMICO,
  MOTOR_TRIFASICO,
  MOTOR_ESTRELLA_TRIANGULO,
  SELECTOR,
  SETA,
  FINAL_NA,
  FINAL_NC,
  TERMICO_NC,
  TERMICO_NA,
  FUSIBLE,
  BOCINA,
];

const POR_TIPO = new Map(SIMBOLOS.map((s) => [s.tipo, s]));

/** Busca una definición por su tipo (el que se guarda en .brn). */
export function buscarSimbolo(tipo: string): DefinicionSimbolo | undefined {
  return POR_TIPO.get(tipo);
}
