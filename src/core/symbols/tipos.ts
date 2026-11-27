// Tipos para describir un símbolo como datos: dibujo, bornes y comportamiento.
// Todo en unidades de grilla. Acá no se dibuja nada: el Renderer lee estos datos.

/** Escala de exportación: 1 unidad de grilla = 2,5 mm en el PDF. */
export const MM_POR_UNIDAD = 2.5;

// ── Primitivas (unidades de grilla; pueden ser fraccionarias) ──────────────

export interface Linea {
  forma: "linea";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Ángulos en grados, sentido horario (y crece hacia abajo), de `desde` a `hasta`. */
export interface Arco {
  forma: "arco";
  cx: number;
  cy: number;
  r: number;
  desde: number;
  hasta: number;
}

export interface Circulo {
  forma: "circulo";
  cx: number;
  cy: number;
  r: number;
  relleno?: boolean;
}

export interface Rectangulo {
  forma: "rectangulo";
  x: number;
  y: number;
  ancho: number;
  alto: number;
  relleno?: boolean;
}

export interface Texto {
  forma: "texto";
  x: number;
  y: number;
  texto: string;
  /** Alto de la letra en unidades de grilla. */
  alto: number;
  alineacion?: "izquierda" | "centro" | "derecha";
}

export type Primitiva = Linea | Arco | Circulo | Rectangulo | Texto;

// ── Bornes ─────────────────────────────────────────────────────────────────

/** Hacia dónde sale el cable desde el borne. */
export type Direccion = "arriba" | "abajo" | "izquierda" | "derecha";

export interface Borne {
  /** Nombre normalizado del borne: "A1", "13", "L1". */
  nombre: string;
  /** Posición entera relativa al centro del símbolo. */
  x: number;
  y: number;
  direccion: Direccion;
}

// ── Comportamiento ─────────────────────────────────────────────────────────

export type Elemento = "contacto_na" | "contacto_nc" | "bobina" | "carga" | "fuente" | "proteccion";

export type Accionamiento =
  | "bobina" // sigue a la bobina con su misma etiqueta (K1)
  | "manual_momentaneo" // pulsador
  | "manual_enclavado" // interruptor / selector
  | "termico"; // contactos 95-96 (NC) y 97-98 (NA) del relé térmico

/**
 * Solo los contactos llevan accionamiento; en el resto no se admite.
 * Un componente con varias partes (contactor, relé térmico) se arma con varios
 * símbolos que comparten la etiqueta: por ejemplo, el elemento de potencia del
 * térmico es "proteccion" y sus contactos son contactos con accionamiento "termico".
 */
export type Comportamiento =
  | { elemento: "contacto_na" | "contacto_nc"; accionamiento: Accionamiento }
  | { elemento: "bobina" | "carga" | "fuente" | "proteccion"; accionamiento?: never };

// ── Definición ─────────────────────────────────────────────────────────────

/**
 * Lugar del símbolo en la paleta (fase 6, T38, D26-A). El grupo (Mando o
 * Potencia), los nombres visibles y el orden están en `ui/paleta.ts`. No va
 * al .brn: el archivo guarda el tipo.
 */
export const SUBGRUPOS = [
  "alimentacion",
  "entradas",
  "contactos",
  "bobinas",
  "senalizacion",
  "proteccion",
  "maniobra",
  "cargas",
  "fuentes",
  "transformacion",
] as const;

export type Subgrupo = (typeof SUBGRUPOS)[number];

export type Rotacion = 0 | 90 | 180 | 270;

/** Papel de un borne de salida (T39, D-B1 A): el + es fase y el − neutro; sin papel nuevo. */
export type PapelSalida = "fase" | "neutro";

export interface Transformacion {
  /** Rotación en sentido horario, sobre el origen (centro del símbolo). */
  rotacion: Rotacion;
  /** Espejado horizontal (x → −x), aplicado antes de rotar. */
  espejado: boolean;
}

export type DefinicionSimbolo = Comportamiento & {
  /** Identificador estable, el que se guarda en .brn: "contactor.bobina". */
  tipo: string;
  /** Texto visible, con ortografía correcta: "Bobina de contactor". */
  nombre: string;
  /** Subgrupo de la paleta (`SUBGRUPOS`); el grupo sale de él. */
  subgrupo: Subgrupo;
  /** Caja del símbolo, centrada en el origen (0,0), que también es el pivote de rotación. */
  tamano: { ancho: number; alto: number };
  primitivas: Primitiva[];
  /**
   * Dibujo del contacto accionado (T33, D9-B): el NA cerrado y el NC abierto.
   * El lienzo lo usa en Simular mientras el contacto está accionado; si no,
   * `primitivas`. Solo en contactos, sin textos y dentro de `tamano`, así la
   * caja de dibujo es la misma en los dos estados (`validarDefinicion`).
   */
  primitivasAccionado?: Primitiva[];
  bornes: Borne[];
  /**
   * Polos de un contacto o de una protección (T34, T35 D13-A): pares de
   * bornes que une cuando conduce, como los 1-2, 3-4 y 5-6 del contactor
   * principal. Todos los polos se accionan juntos. Sin `polos`, un contacto o
   * una protección de 2 bornes es un polo. Cada borne en un solo polo
   * (`validarDefinicion`).
   */
  polos?: readonly (readonly [string, string])[];
  /**
   * Cargas del símbolo (T39, D-B7 A): pares de bornes, cada uno una carga que
   * se enciende con potenciales distintos en sus dos bornes, como la entrada
   * L-N de una fuente conmutada o el primario 1U1-1U2 de un trafo. Sin
   * `cargas`, una bobina o una carga de 2 bornes es una carga y el resto
   * ninguna; con `cargas` (vacío vale), solo esos pares (`cargasDe`).
   */
  cargas?: readonly (readonly [string, string])[];
  /**
   * Salida propia (T39, D-B2 A, D-B7 A): borne → papel. Cada borne da un
   * potencial propio, siempre activo, de nombre etiqueta + borne («G1.L+»,
   * «T1.2U1»; D-B8, D-B10). Sin etiqueta no da potencial. El símbolo que la
   * lleva es titular, con prefijo, y no es fuente (`validarDefinicion`).
   */
  salida?: Readonly<Record<string, PapelSalida>>;
  /**
   * De qué lado de las conexiones van los nombres de los bornes, en coordenadas
   * locales (gira y se espeja con el símbolo). Por defecto, "izquierda".
   * Sirve para alejarlos de partes del dibujo, como el tope de un contacto NC.
   */
  ladoNombresBornes?: Direccion;
  /**
   * Etiqueta con la que se coloca (por ejemplo "L" en la fase). Sin ella, el
   * componente se coloca sin etiqueta.
   */
  etiquetaInicial?: string;
  /**
   * Letras con que se numera al colocarlo (T17): "K" da K1, K2… Solo letras
   * mayúsculas. La llevan los símbolos que se numeran solos (bobina,
   * pulsadores, lámpara); la fuente y el seguidor no la llevan
   * (`validarDefinicion`).
   */
  prefijoEtiqueta?: string;
  /**
   * Desde qué número se numera (T27). Por defecto, 1. El pulsador NC lleva 0:
   * la parada es S0 y la marcha, S1. Comparte los números con los demás
   * símbolos de su prefijo: es el menor libre desde acá. Solo junto con
   * `prefijoEtiqueta`. Vive en la biblioteca: no se guarda en el archivo.
   */
  primerNumero?: number;
  /**
   * Dibujar los nombres de los bornes. Por defecto, sí. La fase y el neutro no
   * los dibujan: su nombre visible es la etiqueta, y si no se vería dos veces.
   */
  mostrarNombresBornes?: boolean;
};

// ── Clases para el etiquetado (T17) ────────────────────────────────────────
// Fuente, seguidor o titular (docs/archivo/plan-T17.md, sección 2). El titular, lo
// que se numera, se define en src/core/model/etiquetado.ts.

/** Accionamientos a mano: el contacto es un pulsador o un selector, que se numera solo (S1, S2). */
const ACCIONAMIENTOS_MANUALES: ReadonlySet<Accionamiento> = new Set<Accionamiento>(["manual_momentaneo", "manual_enclavado"]);

/** Alimentación: fase, neutro o una fuente de varios bornes (la trifásica). No se numera. */
export function esFuente(def: DefinicionSimbolo): boolean {
  return def.elemento === "fuente";
}

/**
 * Fuente cuya etiqueta es el nombre de la red: la de un solo borne (fase y
 * neutro). La etiqueta no puede quedar vacía (R9). En una fuente de varios
 * bornes (la trifásica) nombra cada borne y la etiqueta es libre (T34, D1-A).
 */
export function nombraRed(def: DefinicionSimbolo | undefined): boolean {
  return def?.elemento === "fuente" && def.bornes.length === 1;
}

/** Sin polos: la misma lista vacía en cada llamada. */
const SIN_POLOS: readonly (readonly [string, string])[] = [];

/** Polos armados de los contactos de 2 bornes sin `polos`, uno por definición (no se arman en cada llamada). */
const POLOS_ARMADOS = new WeakMap<DefinicionSimbolo, readonly (readonly [string, string])[]>();

/** Lleva polos: un contacto o una protección (T35, D13-A). */
export function tienePolos(def: DefinicionSimbolo): boolean {
  return def.elemento === "contacto_na" || def.elemento === "contacto_nc" || def.elemento === "proteccion";
}

/**
 * Los polos de un contacto o de una protección (T34, T35): `polos`, o sus dos
 * bornes si no los tiene. Fuera de ellos, ninguno. No arma arreglos nuevos en
 * cada llamada: el polo de 2 bornes se arma una vez por definición. La netlist
 * los lee de los contactos y de las protecciones (T36, que conducen siempre).
 */
export function polosDe(def: DefinicionSimbolo): readonly (readonly [string, string])[] {
  if (!tienePolos(def)) return SIN_POLOS;
  if (def.polos) return def.polos;
  if (def.bornes.length !== 2) return SIN_POLOS;
  let polos = POLOS_ARMADOS.get(def);
  if (!polos) POLOS_ARMADOS.set(def, (polos = [[def.bornes[0]!.nombre, def.bornes[1]!.nombre]]));
  return polos;
}

/** Cargas armadas de las bobinas y cargas de 2 bornes sin `cargas`, una por definición. */
const CARGAS_ARMADAS = new WeakMap<DefinicionSimbolo, readonly (readonly [string, string])[]>();

/**
 * Las cargas del símbolo (T39): `cargas` si las tiene; si no, sus dos bornes
 * en una bobina o una carga de 2 bornes (lámpara, bocina); si no, ninguna (los
 * motores de 3 y 6 bornes, hasta 6b). No arma arreglos nuevos en cada llamada.
 */
export function cargasDe(def: DefinicionSimbolo): readonly (readonly [string, string])[] {
  if (def.cargas) return def.cargas;
  if ((def.elemento !== "bobina" && def.elemento !== "carga") || def.bornes.length !== 2) return SIN_POLOS;
  let cargas = CARGAS_ARMADAS.get(def);
  if (!cargas) CARGAS_ARMADAS.set(def, (cargas = [[def.bornes[0]!.nombre, def.bornes[1]!.nombre]]));
  return cargas;
}

/**
 * Contacto que sigue a otro componente por la etiqueta, como el auxiliar a su
 * bobina: todo contacto con un accionamiento que no es a mano. Su etiqueta
 * dice a quién sigue, así que no se numera.
 */
export function esSeguidor(def: DefinicionSimbolo): boolean {
  return def.accionamiento !== undefined && !ACCIONAMIENTOS_MANUALES.has(def.accionamiento);
}

/**
 * Bobina de contactor: la única que arrastra a sus contactos al renombrarla
 * (T17, D4) y la que lleva la lista de sus contactos (T18). Un símbolo
 * desconocido (`undefined`) no lo es.
 */
export function esBobina(def: DefinicionSimbolo | undefined): boolean {
  return def?.elemento === "bobina";
}

/** Contacto que sigue a una bobina por la etiqueta: hoy, los auxiliares NA y NC del contactor. */
export function sigueABobina(def: DefinicionSimbolo | undefined): boolean {
  return def?.accionamiento === "bobina";
}
