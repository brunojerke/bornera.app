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

export type Categoria = "fuentes" | "mando" | "potencia" | "senalizacion";

export type Rotacion = 0 | 90 | 180 | 270;

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
  categoria: Categoria;
  /** Caja del símbolo, centrada en el origen (0,0), que también es el pivote de rotación. */
  tamano: { ancho: number; alto: number };
  primitivas: Primitiva[];
  bornes: Borne[];
  /**
   * De qué lado de las conexiones van los nombres de los bornes, en coordenadas
   * locales (gira y se espeja con el símbolo). Por defecto, "izquierda".
   * Sirve para alejarlos de partes del dibujo, como el tope de un contacto NC.
   */
  ladoNombresBornes?: Direccion;
};
