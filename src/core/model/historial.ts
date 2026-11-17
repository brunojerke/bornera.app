// Historial de deshacer/rehacer, sin límite. Toda modificación del documento
// pasa por `ejecutar` (o `agrupar`).
//
// Marca de guardado (T15a, D16-A): el comando que estaba arriba de la pila al
// guardar, o `null` si la pila estaba vacía. El documento está "modificado"
// si lo de arriba de la pila no es ese comando. Se compara por identidad del
// objeto, así que vale mientras ningún comando ya apilado se modifique en el
// lugar ni se vuelva a ejecutar el mismo objeto: el Editor arma un comando
// nuevo por acción y `agrupar` apila siempre un Grupo nuevo.
//
// Sin tope. Si algún día se agrega uno, descartar el comando marcado (o
// cualquiera, si se guardó con la pila vacía) tiene que dejar la marca como
// inalcanzable: si no, el documento podría quedar "sin cambios" en falso.

import { Grupo, type Cambio, type Comando } from "./comandos";
import type { Documento } from "./documento";

/**
 * Marca de guardado tomada en un instante (ver `tomarMarca`). Es opaca: solo
 * sirve para pasársela a `marcarGuardado` del mismo historial.
 */
export interface MarcaGuardado {
  readonly tope: Comando | null;
}

/**
 * Marca de un documento que nunca se guardó tal como está (T23, D7: una copia
 * recuperada). No es ningún comando, así que nunca está arriba de la pila: el
 * documento queda modificado hasta que se guarde, aunque se deshaga todo.
 */
const NUNCA_GUARDADO = Symbol("nunca guardado");

export interface OpcionesHistorial {
  /** Arranca con cambios sin guardar y sin nada que deshacer (una copia recuperada, T23). */
  modificado?: boolean;
}

export class Historial {
  private readonly hechos: Comando[] = [];
  private readonly deshechos: Comando[] = [];
  /**
   * Lo que estaba arriba de la pila en el último guardado. Un historial nuevo
   * arranca sin cambios (null), salvo con `modificado` (NUNCA_GUARDADO).
   */
  private marca: Comando | null | typeof NUNCA_GUARDADO;

  constructor(
    readonly documento: Documento,
    opciones: OpcionesHistorial = {},
  ) {
    this.marca = opciones.modificado ? NUNCA_GUARDADO : null;
  }

  get puedeDeshacer(): boolean {
    return this.hechos.length > 0;
  }

  get puedeRehacer(): boolean {
    return this.deshechos.length > 0;
  }

  /** El comando que desharía `deshacer`, o undefined. Solo para mirar (el editor pregunta si es un Grupo). */
  get siguienteDeshacer(): Comando | undefined {
    return this.hechos.at(-1);
  }

  /** El comando que rehace `rehacer`, o undefined. Solo para mirar. */
  get siguienteRehacer(): Comando | undefined {
    return this.deshechos.at(-1);
  }

  /** El documento difiere de lo último guardado o abierto. */
  get modificado(): boolean {
    return (this.hechos.at(-1) ?? null) !== this.marca;
  }

  /**
   * Toma la marca en este instante. Se llama en el mismo momento en que se
   * serializa el documento, y se aplica con `marcarGuardado` solo si la
   * escritura salió bien: si se editó mientras tanto, sigue modificado.
   */
  tomarMarca(): MarcaGuardado {
    return { tope: this.hechos.at(-1) ?? null };
  }

  /** Da por guardado el documento tal como estaba al tomar la marca. */
  marcarGuardado(marca: MarcaGuardado): void {
    this.marca = marca.tope;
  }

  /**
   * Aplica el comando y lo apila. Borra lo que había para rehacer. Si el
   * comando tira un error, el historial queda como estaba.
   */
  ejecutar(comando: Comando): Cambio {
    const cambio = comando.aplicar(this.documento);
    this.hechos.push(comando);
    this.deshechos.length = 0;
    return cambio;
  }

  /**
   * Varios comandos en un solo paso de deshacer. Sin comandos, no agrega paso.
   * Siempre apila un Grupo nuevo: nunca suma al paso de arriba (la marca de
   * guardado depende de eso).
   */
  agrupar(comandos: readonly Comando[]): Cambio {
    const grupo = new Grupo(comandos);
    if (grupo.vacio) return { componentes: [], cables: [] };
    return this.ejecutar(grupo);
  }

  /** Deshace el último paso; null si no hay nada para deshacer. */
  deshacer(): Cambio | null {
    const comando = this.hechos.at(-1);
    if (!comando) return null;
    const cambio = comando.deshacer(this.documento);
    this.deshechos.push(this.hechos.pop()!);
    return cambio;
  }

  /** Rehace el último paso deshecho; null si no hay nada para rehacer. */
  rehacer(): Cambio | null {
    const comando = this.deshechos.at(-1);
    if (!comando) return null;
    const cambio = comando.aplicar(this.documento);
    this.hechos.push(this.deshechos.pop()!);
    return cambio;
  }
}
