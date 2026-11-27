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
 * de alto: con 4, la banda pisaba los nombres de los bornes de abajo. Con
 * `neutro`, el último polo es el de neutro, con su «N» (D8-A): 3-4 en el
 * bipolar, 7-8 en el tetrapolar. El tripolar (T40) va sin neutro.
 */
function diferencial(tipo: string, nombre: string, xs: readonly number[], neutro = true): DefinicionSimbolo {
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
    ...(neutro ? [marcaNeutro(der, yc + 0.5)] : []),
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
/** Diferencial tripolar sin neutro (T40): polos 1-2, 3-4 y 5-6, que conducen siempre (como el resto en 6a). */
export const DIFERENCIAL_TRIPOLAR = diferencial("proteccion.diferencial_tripolar", "Diferencial tripolar", POLOS_X, false);

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

// ── Fuentes propias y trafos (T39, biblioteca 2) ───────────────────────────
// Titulares con `salida` (D-B7 A): cada borne de salida da un potencial
// propio, siempre activo (D-B2 A), de nombre etiqueta + borne («G1.L+»,
// «T1.2U1»; D-B8, D-B10): dos fuentes no se unen entre sí ni con la red. El +
// es fase y el − neutro (D-B1 A); en los trafos, 2U2 y 2N son neutro
// (D-T39-3 A). La entrada L-N (conmutada) y el primario 1U1-1U2 (trafo mono y
// variac) son cargas; el primario trifásico no, hasta 6b (D-B11 A). PE no
// tiene papel (D11). El negativo va en ASCII: `V-`, `-V` (D-T39-1 A).

/** Signo de continua (02-02-04): una raya llena y debajo tres trazos, centrado en (0, y). */
function signoContinua(y: number): Linea[] {
  return [linea(-0.6, y, 0.6, y), linea(-0.6, y + 0.3, -0.3, y + 0.3), linea(-0.15, y + 0.3, 0.15, y + 0.3), linea(0.3, y + 0.3, 0.6, y + 0.3)];
}

/** Flecha de regulación (02-03-01): de (x1, y1) a (x2, y2), con la punta en (x2, y2). */
function flecha(x1: number, y1: number, x2: number, y2: number): Linea[] {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const punta = (d: number) => linea(x2, y2, x2 - 0.45 * Math.cos(a + d), y2 - 0.45 * Math.sin(a + d));
  return [linea(x1, y1, x2, y2), punta(0.45), punta(-0.45)];
}

/** Caja de la fuente de continua y la variable: 4×4, cuerpo arriba y los dos bornes abajo, en x −1 y 1. */
const CUERPO_CONTINUA: Primitiva[] = [{ forma: "rectangulo", x: -1.6, y: -1.8, ancho: 3.2, alto: 2.8 }, linea(-1, 1, -1, 2), linea(1, 1, 1, 2)];

/** Los dos bornes de salida de abajo de una fuente de continua, en x −1 y 1. */
function bornesSalidaContinua(mas: string, menos: string): DefinicionSimbolo["bornes"] {
  return [
    { nombre: mas, x: -1, y: 2, direccion: "abajo" },
    { nombre: menos, x: 1, y: 2, direccion: "abajo" },
  ];
}

/** Fuente de continua 12/24 V: L+ y M (EN 60445). La tensión va dibujada (`params` sin editor). */
export const FUENTE_CONTINUA: DefinicionSimbolo = {
  tipo: "fuente.continua",
  nombre: "Fuente de continua 12/24 V",
  subgrupo: "alimentacion",
  elemento: "carga",
  prefijoEtiqueta: "G",
  tamano: { ancho: 4, alto: 4 },
  primitivas: [...CUERPO_CONTINUA, ...signoContinua(-0.9), { forma: "texto", x: 0, y: 0.45, texto: "12/24 V", alto: 0.5, alineacion: "centro" }],
  ladoNombresBornes: "derecha",
  bornes: bornesSalidaContinua("L+", "M"),
  cargas: [],
  salida: { "L+": "fase", M: "neutro" },
};

/** Fuente variable: V+ y V-, con la flecha de regulación cruzando el cuerpo. */
export const FUENTE_VARIABLE: DefinicionSimbolo = {
  tipo: "fuente.variable",
  nombre: "Fuente variable",
  subgrupo: "alimentacion",
  elemento: "carga",
  prefijoEtiqueta: "G",
  tamano: { ancho: 4, alto: 4 },
  primitivas: [...CUERPO_CONTINUA, ...signoContinua(-0.55), ...flecha(-1.3, 0.7, 1.3, -1.5)],
  ladoNombresBornes: "derecha",
  bornes: bornesSalidaContinua("V+", "V-"),
  cargas: [],
  salida: { "V+": "fase", "V-": "neutro" },
};

/**
 * Fuente conmutada de riel (tipo DR-120-24): L, N y PE arriba; +V y -V abajo
 * (un borne de cada uno; la real trae dos puenteados). Convertidor (06-14-03):
 * caja con la diagonal, «~» arriba a la izquierda y continua abajo a la derecha.
 */
export const FUENTE_CONMUTADA: DefinicionSimbolo = {
  tipo: "fuente.conmutada",
  nombre: "Fuente conmutada (riel)",
  subgrupo: "alimentacion",
  elemento: "carga",
  prefijoEtiqueta: "G",
  tamano: { ancho: 6, alto: 4 },
  primitivas: [
    { forma: "rectangulo", x: -2.6, y: -1.2, ancho: 5.2, alto: 2.4 },
    linea(-2.6, 1.2, 2.6, -1.2),
    { forma: "texto", x: -1.5, y: -0.45, texto: "~", alto: 0.8, alineacion: "centro" },
    ...signoContinua(0.3).map((l) => linea(l.x1 + 1.5, l.y1, l.x2 + 1.5, l.y2)),
    linea(-2, -2, -2, -1.2),
    linea(0, -2, 0, -1.2),
    linea(2, -2, 2, -1.2),
    linea(-1, 1.2, -1, 2),
    linea(1, 1.2, 1, 2),
  ],
  ladoNombresBornes: "derecha",
  bornes: [
    { nombre: "L", x: -2, y: -2, direccion: "arriba" },
    { nombre: "N", x: 0, y: -2, direccion: "arriba" },
    { nombre: "PE", x: 2, y: -2, direccion: "arriba" },
    ...bornesSalidaContinua("+V", "-V"),
  ],
  cargas: [["L", "N"]],
  salida: { "+V": "fase", "-V": "neutro" },
};

/** Radio y centros de los dos círculos del trafo mono y del variac (06-09-01, forma 1). */
const R_TRAFO = 1.1;
const CY_TRAFO = 0.7;
/** Y donde una vertical en x = ±1 toca el círculo de arriba (el de abajo, con el signo cambiado). */
const Y_TOQUE_TRAFO = CY_TRAFO + Math.sqrt(R_TRAFO * R_TRAFO - 1);

/** Trafo de dos devanados, 4×6: dos círculos y los bornes 1U1, 1U2 arriba y 2U1, 2U2 abajo, en x −1 y 1. */
const CUERPO_TRAFO: Primitiva[] = [
  { forma: "circulo", cx: 0, cy: -CY_TRAFO, r: R_TRAFO },
  { forma: "circulo", cx: 0, cy: CY_TRAFO, r: R_TRAFO },
  linea(-1, -3, -1, -Y_TOQUE_TRAFO),
  linea(1, -3, 1, -Y_TOQUE_TRAFO),
  linea(-1, Y_TOQUE_TRAFO, -1, 3),
  linea(1, Y_TOQUE_TRAFO, 1, 3),
];

const BORNES_TRAFO: DefinicionSimbolo["bornes"] = [
  { nombre: "1U1", x: -1, y: -3, direccion: "arriba" },
  { nombre: "1U2", x: 1, y: -3, direccion: "arriba" },
  { nombre: "2U1", x: -1, y: 3, direccion: "abajo" },
  { nombre: "2U2", x: 1, y: 3, direccion: "abajo" },
];

/** Transformador monofásico: primario 1U1-1U2 (carga), secundario 2U1-2U2 (salida). */
export const TRAFO_MONOFASICO: DefinicionSimbolo = {
  tipo: "transformador.monofasico",
  nombre: "Transformador monofásico",
  subgrupo: "transformacion",
  elemento: "carga",
  prefijoEtiqueta: "T",
  tamano: { ancho: 4, alto: 6 },
  primitivas: CUERPO_TRAFO,
  ladoNombresBornes: "derecha",
  bornes: BORNES_TRAFO,
  cargas: [["1U1", "1U2"]],
  salida: { "2U1": "fase", "2U2": "neutro" },
};

/** Variac: el trafo mono con la flecha de regulación cruzando los dos círculos. */
export const VARIAC: DefinicionSimbolo = {
  tipo: "transformador.variac",
  nombre: "Variac",
  subgrupo: "transformacion",
  elemento: "carga",
  prefijoEtiqueta: "T",
  tamano: { ancho: 4, alto: 6 },
  primitivas: [...CUERPO_TRAFO, ...flecha(-1.7, 1.9, 1.7, -1.9)],
  ladoNombresBornes: "derecha",
  bornes: BORNES_TRAFO,
  cargas: [["1U1", "1U2"]],
  salida: { "2U1": "fase", "2U2": "neutro" },
};

/** Radio y centros de los círculos del trafo trifásico. */
const R_TRAFO_3 = 1.3;
const CY_TRAFO_3 = 0.9;

/** Punto del círculo de centro (0, cy) a `grados` de +x (y crece hacia abajo, así que −90 es arriba). */
function enCirculo(cy: number, grados: number): [number, number] {
  const a = (grados * Math.PI) / 180;
  return [R_TRAFO_3 * Math.cos(a), cy + R_TRAFO_3 * Math.sin(a)];
}

/**
 * Transformador trifásico, 8×6: primario 1U, 1V y 1W arriba (x −2, 0, 2), sin
 * carga hasta 6b (D-B11 A); secundario 2U, 2V, 2W y 2N abajo (x −3, −1, 1, 3).
 * Los de los lados bajan un poco y van en diagonal al círculo.
 */
export const TRAFO_TRIFASICO: DefinicionSimbolo = {
  tipo: "transformador.trifasico",
  nombre: "Transformador trifásico",
  subgrupo: "transformacion",
  elemento: "carga",
  prefijoEtiqueta: "T",
  tamano: { ancho: 8, alto: 6 },
  primitivas: (() => {
    const arriba = -CY_TRAFO_3;
    const [xa, ya] = enCirculo(arriba, -135);
    const [xb, yb] = enCirculo(CY_TRAFO_3, 160);
    const yMedio = CY_TRAFO_3 + Math.sqrt(R_TRAFO_3 * R_TRAFO_3 - 1);
    return [
      { forma: "circulo", cx: 0, cy: arriba, r: R_TRAFO_3 },
      { forma: "circulo", cx: 0, cy: CY_TRAFO_3, r: R_TRAFO_3 },
      { forma: "texto", x: 0, y: arriba, texto: "3~", alto: 0.6, alineacion: "centro" },
      linea(-2, -3, -2, -2.4),
      linea(-2, -2.4, xa, ya),
      linea(0, -3, 0, arriba - R_TRAFO_3),
      linea(2, -3, 2, -2.4),
      linea(2, -2.4, -xa, ya),
      linea(-3, 3, -3, 2.4),
      linea(-3, 2.4, xb, yb),
      linea(-1, yMedio, -1, 3),
      linea(1, yMedio, 1, 3),
      linea(3, 3, 3, 2.4),
      linea(3, 2.4, -xb, yb),
    ];
  })(),
  ladoNombresBornes: "derecha",
  bornes: [
    ...POLOS_X.map((x, i) => ({ nombre: `1${"UVW"[i]}`, x, y: -3, direccion: "arriba" as const })),
    ...POLOS_4.map((x, i) => ({ nombre: ["2U", "2V", "2W", "2N"][i]!, x, y: 3, direccion: "abajo" as const })),
  ],
  cargas: [],
  salida: { "2U": "fase", "2V": "fase", "2W": "fase", "2N": "neutro" },
};

// ── Sensores, electroválvulas y motor de continua (T40, biblioteca 2) ──────
// - Sensor PNP (D-B3 A): BN (+) arriba, BK (salida) abajo a la derecha y BU
//   (−) abajo a la izquierda. Es un contacto NA enclavado (un clic lo acciona
//   y otro lo libera) con el polo BN-BK, más la carga BN-BU: BN está en los
//   dos. El cuerpo se rellena con la carga encendida y el contacto se dibuja
//   cerrado accionado. Conmuta aunque BU esté suelto (límite hasta 6b).
// - Presostato y termostato NA y NC (D-B4 A): como el final de carrera, con
//   la cabeza de presión («p») o de temperatura («θ») en un recuadro.
// - Electroválvula (D-B5 A, D-B12 A, D-T40-5 A): 5/2 sin vías numeradas. Dos
//   cuadros (14 a la izquierda, 12 a la derecha) sobre las vías fijas; en
//   reposo está en 12 y accionada la válvula corre un cuadro a la derecha y
//   queda en 14. Monoestable: bobina A1-A2 a la izquierda y resorte a la
//   derecha. Biestable: A1-A2 (14) a la izquierda y B1-B2 (12) a la derecha.
// - Motor de continua: carga A1-A2 (giro y polaridad, en 6b).

/** Las primitivas corridas `dx` en horizontal. */
function corridoX(ps: readonly Primitiva[], dx: number): Primitiva[] {
  return ps.map((p): Primitiva => {
    switch (p.forma) {
      case "linea":
        return linea(p.x1 + dx, p.y1, p.x2 + dx, p.y2);
      case "rectangulo":
      case "texto":
        return { ...p, x: p.x + dx };
      case "circulo":
      case "arco":
        return { ...p, cx: p.cx + dx };
    }
  });
}

/** X del contacto del sensor (BN arriba, BK abajo) y del BU. */
const X_CONTACTO_SENSOR = 1;
const X_BU = -1;
/** Cuerpo del sensor: su primer rectángulo, el que se rellena con la carga encendida. */
const CUERPO_SENSOR = { forma: "rectangulo" as const, x: -1.9, y: -1.2, ancho: 1.8, alto: 2.2 };
/** Centro del rombo de proximidad (07-20-01), dentro del cuerpo. */
const CX_SENSOR = -1;
const CY_SENSOR = -0.1;

/** Rombo de proximidad centrado en el cuerpo. */
const ROMBO_SENSOR: Linea[] = [
  linea(CX_SENSOR, CY_SENSOR - 0.85, CX_SENSOR + 0.75, CY_SENSOR),
  linea(CX_SENSOR + 0.75, CY_SENSOR, CX_SENSOR, CY_SENSOR + 0.85),
  linea(CX_SENSOR, CY_SENSOR + 0.85, CX_SENSOR - 0.75, CY_SENSOR),
  linea(CX_SENSOR - 0.75, CY_SENSOR, CX_SENSOR, CY_SENSOR - 0.85),
];

/** Lo que el sensor dibuja igual en los dos estados: cuerpo, rombo, marca, la alimentación por BN y el BU. */
function fijoSensor(marca: Primitiva[]): Primitiva[] {
  return [
    CUERPO_SENSOR,
    ...ROMBO_SENSOR,
    ...marca,
    // BN alimenta el cuerpo desde el contacto fijo de arriba, con el punto de unión.
    linea(X_CONTACTO_SENSOR, -1.6, CX_SENSOR, -1.6),
    linea(CX_SENSOR, -1.6, CX_SENSOR, -1.2),
    { forma: "circulo", cx: X_CONTACTO_SENSOR, cy: -1.6, r: 0.1, relleno: true },
    // BU sale del cuerpo hacia abajo.
    linea(X_BU, CUERPO_SENSOR.y + CUERPO_SENSOR.alto, X_BU, 2),
  ];
}

/** Sensor PNP con la marca de su tipo dentro del rombo. */
function sensor(tipo: string, nombre: string, marca: Primitiva[]): DefinicionSimbolo {
  const borde = CUERPO_SENSOR.x + CUERPO_SENSOR.ancho;
  return {
    tipo,
    nombre,
    subgrupo: "sensores",
    elemento: "contacto_na",
    accionamiento: "manual_enclavado",
    prefijoEtiqueta: "B",
    tamano: { ancho: 4, alto: 4 },
    primitivas: [...fijoSensor(marca), ...corridoX(contactoNA(), X_CONTACTO_SENSOR), ...discontinua(X_CONTACTO_SENSOR + X_EN_NA, 0, borde, 0)],
    primitivasAccionado: [...fijoSensor(marca), ...corridoX(contactoNACerrado(), X_CONTACTO_SENSOR), ...discontinua(X_CONTACTO_SENSOR + X_EN_NA_CERRADO, 0, borde, 0)],
    ladoNombresBornes: "derecha",
    bornes: [
      { nombre: "BN", x: X_CONTACTO_SENSOR, y: -2, direccion: "arriba" },
      { nombre: "BU", x: X_BU, y: 2, direccion: "abajo" },
      { nombre: "BK", x: X_CONTACTO_SENSOR, y: 2, direccion: "abajo" },
    ],
    polos: [["BN", "BK"]],
    cargas: [["BN", "BU"]],
  };
}

/** Flecha chica, de punta corta, para dentro del rombo. */
function flechaCorta(x1: number, y1: number, x2: number, y2: number): Linea[] {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const punta = (d: number) => linea(x2, y2, x2 - 0.18 * Math.cos(a + d), y2 - 0.18 * Math.sin(a + d));
  return [linea(x1, y1, x2, y2), punta(0.5), punta(-0.5)];
}

/** Sensor inductivo: «Fe» en el rombo (detecta metal). */
export const SENSOR_INDUCTIVO = sensor("sensor.inductivo", "Sensor inductivo PNP", [
  { forma: "texto", x: CX_SENSOR, y: CY_SENSOR, texto: "Fe", alto: 0.45, alineacion: "centro" },
]);

/** Sensor capacitivo: las dos placas de un capacitor en el rombo. */
export const SENSOR_CAPACITIVO = sensor("sensor.capacitivo", "Sensor capacitivo PNP", [
  linea(CX_SENSOR - 0.12, CY_SENSOR - 0.3, CX_SENSOR - 0.12, CY_SENSOR + 0.3),
  linea(CX_SENSOR + 0.12, CY_SENSOR - 0.3, CX_SENSOR + 0.12, CY_SENSOR + 0.3),
  linea(CX_SENSOR - 0.4, CY_SENSOR, CX_SENSOR - 0.12, CY_SENSOR),
  linea(CX_SENSOR + 0.12, CY_SENSOR, CX_SENSOR + 0.4, CY_SENSOR),
]);

/** Sensor fotoeléctrico: dos flechas de luz que entran al rombo. */
export const SENSOR_FOTOELECTRICO = sensor("sensor.fotoelectrico", "Sensor fotoeléctrico PNP", [
  ...flechaCorta(CX_SENSOR - 0.45, CY_SENSOR - 0.4, CX_SENSOR - 0.05, CY_SENSOR),
  ...flechaCorta(CX_SENSOR - 0.25, CY_SENSOR - 0.55, CX_SENSOR + 0.15, CY_SENSOR - 0.15),
]);

/** X del recuadro de la cabeza del presostato y del termostato, a la izquierda del contacto. */
const X_CABEZA = -1.55;

/** Cabeza de presostato o termostato: el recuadro con su letra. */
function cabeza(texto: string): Primitiva[] {
  return [
    { forma: "rectangulo", x: X_CABEZA - 0.4, y: -0.4, ancho: 0.8, alto: 0.8 },
    { forma: "texto", x: X_CABEZA, y: 0, texto, alto: 0.55, alineacion: "centro" },
  ];
}

/** Presostato o termostato, como el final de carrera (D-B4 A): momentáneo, 13-14 o 11-12. */
function comoFinal(tipo: string, nombre: string, na: boolean, letra: string): DefinicionSimbolo {
  return {
    tipo,
    nombre,
    subgrupo: "sensores",
    elemento: na ? "contacto_na" : "contacto_nc",
    accionamiento: "manual_momentaneo",
    prefijoEtiqueta: "B",
    tamano: { ancho: 4, alto: 4 },
    ...conAccionamiento(na, X_CABEZA + 0.4, cabeza(letra)),
    ladoNombresBornes: na ? "derecha" : "izquierda",
    bornes: na ? dosBornes("13", "14") : dosBornes("11", "12"),
  };
}

export const PRESOSTATO_NA = comoFinal("sensor.presostato_na", "Presostato NA", true, "p");
export const PRESOSTATO_NC = comoFinal("sensor.presostato_nc", "Presostato NC", false, "p");
export const TERMOSTATO_NA = comoFinal("sensor.termostato_na", "Termostato NA", true, "θ");
export const TERMOSTATO_NC = comoFinal("sensor.termostato_nc", "Termostato NC", false, "θ");

/** Lado de un cuadro de la válvula; los cuadros van de y −0,75 a 0,75. */
const LADO_VALVULA = 1.5;
const Y_VALVULA = -LADO_VALVULA / 2;
/** X del borde izquierdo del cuadro que está sobre las vías: el 12 en reposo. */
const X_VIAS = -1;

/** Flecha de paso dentro de un cuadro, de (x1, y1) a (x2, y2). */
function paso(x1: number, y1: number, x2: number, y2: number): Linea[] {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const punta = (d: number) => linea(x2, y2, x2 - 0.25 * Math.cos(a + d), y2 - 0.25 * Math.sin(a + d));
  return [linea(x1, y1, x2, y2), punta(0.45), punta(-0.45)];
}

/** Vía cerrada abajo (la «T»): un trazo desde el borde de abajo hacia adentro y la barra. */
function cerrada(x: number): Linea[] {
  const y1 = -Y_VALVULA - 0.3;
  return [linea(x, -Y_VALVULA, x, y1), linea(x - 0.15, y1, x + 0.15, y1)];
}

/** X de las vías de un cuadro que empieza en `x0`: arriba 4 y 2; abajo 5, 1 y 3. */
function vias(x0: number) {
  return { v4: x0 + 0.45, v2: x0 + 1.05, v5: x0 + 0.3, v1: x0 + 0.75, v3: x0 + 1.2 };
}

/** Cuadro 14 (1 → 4 y 2 → 3; 5 cerrada) desde `x0`. */
function cuadro14(x0: number): Primitiva[] {
  const v = vias(x0);
  return [
    { forma: "rectangulo", x: x0, y: Y_VALVULA, ancho: LADO_VALVULA, alto: LADO_VALVULA },
    ...paso(v.v1, -Y_VALVULA, v.v4, Y_VALVULA),
    ...paso(v.v2, Y_VALVULA, v.v3, -Y_VALVULA),
    ...cerrada(v.v5),
  ];
}

/** Cuadro 12 (1 → 2 y 4 → 5; 3 cerrada) desde `x0`. */
function cuadro12(x0: number): Primitiva[] {
  const v = vias(x0);
  return [
    { forma: "rectangulo", x: x0, y: Y_VALVULA, ancho: LADO_VALVULA, alto: LADO_VALVULA },
    ...paso(v.v1, -Y_VALVULA, v.v2, Y_VALVULA),
    ...paso(v.v4, Y_VALVULA, v.v5, -Y_VALVULA),
    ...cerrada(v.v3),
  ];
}

/** Las vías fijas, del cuadro que está sobre ellas hacia afuera: 4 y 2 arriba; 5, 1 y 3 abajo. */
function viasFijas(): Linea[] {
  const v = vias(X_VIAS);
  return [
    linea(v.v4, Y_VALVULA - 0.5, v.v4, Y_VALVULA),
    linea(v.v2, Y_VALVULA - 0.5, v.v2, Y_VALVULA),
    linea(v.v5, -Y_VALVULA, v.v5, -Y_VALVULA + 0.5),
    linea(v.v1, -Y_VALVULA, v.v1, -Y_VALVULA + 0.5),
    linea(v.v3, -Y_VALVULA, v.v3, -Y_VALVULA + 0.5),
  ];
}

/** Ancho del recuadro de la bobina de la válvula (accionamiento por solenoide). */
const ANCHO_SOLENOIDE = 1;

/** Bobina de la válvula: el recuadro con la diagonal, desde `x0`. */
function solenoide(x0: number): Primitiva[] {
  return [{ forma: "rectangulo", x: x0, y: -0.5, ancho: ANCHO_SOLENOIDE, alto: 1 }, linea(x0 + 0.25, 0.5, x0 + 0.75, -0.5)];
}

/** Cables de una bobina: de sus bornes en `xBorne` (arriba y abajo) al recuadro centrado en `xCentro`. */
function cablesSolenoide(xBorne: number, xCentro: number): Linea[] {
  return xBorne === xCentro
    ? [linea(xBorne, -2, xBorne, -0.5), linea(xBorne, 0.5, xBorne, 2)]
    : [linea(xBorne, -2, xBorne, -1.6), linea(xBorne, -1.6, xCentro, -0.5), linea(xBorne, 2, xBorne, 1.6), linea(xBorne, 1.6, xCentro, 0.5)];
}

/** Resorte de retorno (zigzag) desde `x`, hacia la derecha. */
function resorte(x: number): Linea[] {
  const ys = [0, -0.35, 0.35, -0.35, 0.35, 0];
  return ys.slice(1).map((y, i) => linea(x + i * 0.2, ys[i]!, x + (i + 1) * 0.2, y));
}

/**
 * La válvula corrida `dx` (0 en 12, un cuadro en 14): la bobina de 14 a la
 * izquierda, los dos cuadros y a la derecha el resorte o la bobina de 12.
 */
function bloqueValvula(dx: number, biestable: boolean): Primitiva[] {
  const x14 = X_VIAS - LADO_VALVULA + dx;
  const x12 = X_VIAS + dx;
  const derecha = x12 + LADO_VALVULA;
  return [...solenoide(x14 - ANCHO_SOLENOIDE), ...cuadro14(x14), ...cuadro12(x12), ...(biestable ? solenoide(derecha) : resorte(derecha))];
}

/** X de los bornes de cada bobina: el centro de su recuadro en reposo (12). */
const X_BOBINA_14 = X_VIAS - LADO_VALVULA - ANCHO_SOLENOIDE / 2;
const X_BOBINA_12 = X_VIAS + LADO_VALVULA + ANCHO_SOLENOIDE / 2;

/** Electroválvula 5/2 monoestable o biestable. */
function electrovalvula(biestable: boolean): DefinicionSimbolo {
  const dibujo = (dx: number): Primitiva[] => [
    ...bloqueValvula(dx, biestable),
    ...viasFijas(),
    ...cablesSolenoide(X_BOBINA_14, X_BOBINA_14 + dx),
    ...(biestable ? cablesSolenoide(X_BOBINA_12, X_BOBINA_12 + dx) : []),
  ];
  const a: DefinicionSimbolo["bornes"] = [
    { nombre: "A1", x: X_BOBINA_14, y: -2, direccion: "arriba" },
    { nombre: "A2", x: X_BOBINA_14, y: 2, direccion: "abajo" },
  ];
  const b: DefinicionSimbolo["bornes"] = [
    { nombre: "B1", x: X_BOBINA_12, y: -2, direccion: "arriba" },
    { nombre: "B2", x: X_BOBINA_12, y: 2, direccion: "abajo" },
  ];
  return {
    tipo: biestable ? "valvula.biestable" : "valvula.monoestable",
    nombre: biestable ? "Electroválvula biestable" : "Electroválvula monoestable",
    subgrupo: "actuadores",
    elemento: "carga",
    prefijoEtiqueta: "Y",
    tamano: { ancho: 8, alto: 4 },
    primitivas: dibujo(0),
    primitivasAccionado: dibujo(LADO_VALVULA),
    ladoNombresBornes: "izquierda",
    bornes: biestable ? [...a, ...b] : a,
    cargas: biestable
      ? [
          ["A1", "A2"],
          ["B1", "B2"],
        ]
      : [["A1", "A2"]],
    valvula: biestable ? "biestable" : "monoestable",
  };
}

export const ELECTROVALVULA_MONOESTABLE = electrovalvula(false);
export const ELECTROVALVULA_BIESTABLE = electrovalvula(true);

/** Motor de continua (06-04-01, «M» con el signo de continua): carga A1-A2. */
export const MOTOR_CONTINUA: DefinicionSimbolo = {
  tipo: "motor.continua",
  nombre: "Motor de continua",
  subgrupo: "cargas",
  elemento: "carga",
  prefijoEtiqueta: "M",
  tamano: { ancho: 4, alto: 4 },
  primitivas: [
    ...conexiones(R_MOTOR),
    { forma: "circulo", cx: 0, cy: 0, r: R_MOTOR },
    { forma: "texto", x: 0, y: -0.3, texto: "M", alto: 1, alineacion: "centro" },
    ...signoContinua(0.55),
  ],
  bornes: dosBornes("A1", "A2"),
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
  FUENTE_CONTINUA,
  FUENTE_VARIABLE,
  FUENTE_CONMUTADA,
  TRAFO_MONOFASICO,
  TRAFO_TRIFASICO,
  VARIAC,
  DIFERENCIAL_TRIPOLAR,
  SENSOR_INDUCTIVO,
  SENSOR_CAPACITIVO,
  SENSOR_FOTOELECTRICO,
  PRESOSTATO_NA,
  PRESOSTATO_NC,
  TERMOSTATO_NA,
  TERMOSTATO_NC,
  ELECTROVALVULA_MONOESTABLE,
  ELECTROVALVULA_BIESTABLE,
  MOTOR_CONTINUA,
];

const POR_TIPO = new Map(SIMBOLOS.map((s) => [s.tipo, s]));

/** Busca una definición por su tipo (el que se guarda en .brn). */
export function buscarSimbolo(tipo: string): DefinicionSimbolo | undefined {
  return POR_TIPO.get(tipo);
}
