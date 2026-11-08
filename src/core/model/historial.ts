// Historial de deshacer/rehacer, sin límite. Toda modificación del documento
// pasa por `ejecutar` (o `agrupar`).

import { Grupo, type Cambio, type Comando } from "./comandos";
import type { Documento } from "./documento";

export class Historial {
  private readonly hechos: Comando[] = [];
  private readonly deshechos: Comando[] = [];

  constructor(readonly documento: Documento) {}

  get puedeDeshacer(): boolean {
    return this.hechos.length > 0;
  }

  get puedeRehacer(): boolean {
    return this.deshechos.length > 0;
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

  /** Varios comandos en un solo paso de deshacer. Sin comandos, no agrega paso. */
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
