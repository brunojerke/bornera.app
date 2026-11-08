// Borrador de la etiqueta que se escribe en el panel de propiedades. Sin DOM:
// el panel le cuenta lo que pasa en el campo.
//
// - Escribir solo cambia el borrador: no ejecuta nada ni toca el lienzo.
// - Al empezar se guardan el destino (el Editor), el id y el valor de base, y
//   se confirma siempre sobre ellos, nunca sobre "la selección actual": si la
//   selección cambia antes de confirmar, lo escrito va al componente que se
//   estaba editando.
// - Confirmar y cancelar terminan la edición: lo que llegue después (Enter y
//   después blur, Esc y después blur) no hace nada. Un paso como mucho.
// - Si el texto es igual al de base, no se normaliza, no se valida y no hay
//   paso: un "k1" de un .brn queda tal cual por enfocar y salir.

import { normalizarEtiqueta, validarEtiqueta } from "../core/model/etiquetas";

/** A quién se le aplica la etiqueta confirmada (el Editor). */
export interface DestinoEtiqueta {
  /** Devuelve true si hubo un paso nuevo. */
  cambiarEtiqueta(id: string, etiqueta: string): boolean;
}

/**
 * Cómo terminó `confirmar`:
 * - "nada": no había edición en curso (ya se había confirmado o cancelado).
 * - "aplicado": hubo un paso nuevo.
 * - "sinCambios": terminó sin paso (texto igual, o el destino no lo aplicó).
 * - "error": con Enter y un texto inválido; la edición sigue.
 * - "revertido": al salir con un texto inválido; volvió al valor de base, sin paso.
 */
export type FinEdicion = "nada" | "aplicado" | "sinCambios" | "error" | "revertido";

/** Cómo se confirma: Enter deja seguir editando si hay error; salir (blur, clic en el lienzo, F5, escena) no. */
export type ModoConfirmar = "enter" | "salir";

interface Sesion {
  destino: DestinoEtiqueta;
  id: string;
  base: string;
  texto: string;
  esFuente: boolean;
}

export class EdicionEtiqueta {
  private sesion: Sesion | null = null;

  /** Empieza a editar (el campo tomó el foco). Si había otra edición, se descarta. */
  empezar(destino: DestinoEtiqueta, id: string, base: string, esFuente: boolean): void {
    this.sesion = { destino, id, base, texto: base, esFuente };
  }

  get activa(): boolean {
    return this.sesion !== null;
  }

  /** Id del componente que se está editando; null si no hay edición. */
  get id(): string | null {
    return this.sesion?.id ?? null;
  }

  get destino(): DestinoEtiqueta | null {
    return this.sesion?.destino ?? null;
  }

  /** Lo escrito; null si no hay edición. */
  get texto(): string | null {
    return this.sesion?.texto ?? null;
  }

  /** El valor confirmado del componente. */
  get base(): string | null {
    return this.sesion?.base ?? null;
  }

  /** El usuario cambió el texto (cada letra). */
  escribir(texto: string): void {
    if (this.sesion) this.sesion.texto = texto;
  }

  /** Lo escrito difiere del valor de base: el usuario editó. */
  get editado(): boolean {
    const s = this.sesion;
    return s !== null && s.texto !== s.base;
  }

  /** Error de lo escrito; null si no hay edición, no se editó o es válido. */
  get error(): string | null {
    const s = this.sesion;
    if (!s || s.texto === s.base) return null;
    return validarEtiqueta(s.texto, s.esFuente);
  }

  /**
   * En una fuente: la red a la que pasaría al confirmar, si lo escrito es
   * válido y es otra red; si no, null.
   */
  get redNueva(): string | null {
    const s = this.sesion;
    if (!s || !s.esFuente || !this.editado || this.error) return null;
    const nueva = normalizarEtiqueta(s.texto);
    return nueva === normalizarEtiqueta(s.base) ? null : nueva;
  }

  /**
   * El componente que se edita cambió desde afuera (por ejemplo, se deshizo
   * algo). No pisa lo escrito, pero sí el valor de base, así Esc vuelve al
   * valor real. Si todavía no se escribió nada, el texto lo sigue.
   */
  actualizarBase(id: string, base: string): void {
    const s = this.sesion;
    if (!s || s.id !== id || s.base === base) return;
    if (s.texto === s.base) s.texto = base;
    s.base = base;
  }

  /** Confirma lo escrito (Enter, blur, clic en el lienzo, cambio de escena o de modo). */
  confirmar(modo: ModoConfirmar): FinEdicion {
    const s = this.sesion;
    if (!s) return "nada";
    if (s.texto === s.base) {
      this.sesion = null;
      return "sinCambios";
    }
    if (validarEtiqueta(s.texto, s.esFuente)) {
      if (modo === "enter") return "error";
      this.sesion = null;
      return "revertido";
    }
    this.sesion = null;
    const etiqueta = normalizarEtiqueta(s.texto);
    if (etiqueta === s.base) return "sinCambios";
    return s.destino.cambiarEtiqueta(s.id, etiqueta) ? "aplicado" : "sinCambios";
  }

  /** Esc: descarta lo escrito sin paso. Devuelve true si había una edición. */
  cancelar(): boolean {
    const habia = this.sesion !== null;
    this.sesion = null;
    return habia;
  }
}
