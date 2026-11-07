// Escena que cambia: componentes que se agregan, se quitan y se mueven por
// id (el del documento). Es lo que dibuja el editor.
//
// Cada operación devuelve la caja de dibujo afectada (la vieja unida a la
// nueva), en unidades de grilla, para pasarla a `Capas.invalidarRegion`: así
// solo se rehacen los mosaicos que tocan el cambio.
//
// El recorte por vista usa un índice espacial (indiceEspacial.ts) en lugar de
// recorrer todos los componentes.

import { unirCajas, type Caja } from "./camara";
import { dibujarComponentes, type ComponenteEscena, type Contenido, type InfoDibujo, type OpcionesEscena } from "./escena";
import { IndiceEspacial } from "./indiceEspacial";
import type { Renderer } from "./renderer";
import { cajaDibujo } from "./simbolo";

export class EscenaEditable implements Contenido {
  /** Componente en cada lugar del índice; null si el lugar está libre. */
  private readonly lugares: (ComponenteEscena | null)[] = [];
  /** Caja de dibujo de cada lugar. */
  private readonly cajas: (Caja | null)[] = [];
  private readonly ids: (string | null)[] = [];
  private readonly lugarDe = new Map<string, number>();
  private readonly libres: number[] = [];
  private readonly indice = new IndiceEspacial();
  /** Lugares visibles del último recorte (se reusa para no pedir memoria en cada cuadro). */
  private readonly visibles: number[] = [];
  private readonly marcarBornes: boolean;
  /** Caja total; undefined si hay que recalcularla (algo se quitó o se achicó). */
  private cajaTotal: Caja | null | undefined = null;

  constructor(componentes: Iterable<[string, ComponenteEscena]> = [], opciones: OpcionesEscena = {}) {
    this.marcarBornes = opciones.marcarBornes ?? true;
    for (const [id, c] of componentes) this.agregar(id, c);
  }

  get cantidad(): number {
    return this.lugarDe.size;
  }

  get caja(): Caja | null {
    if (this.cajaTotal === undefined) {
      let total: Caja | null = null;
      for (const k of this.cajas) if (k) total = total ? unirCajas(total, k) : k;
      this.cajaTotal = total;
    }
    return this.cajaTotal;
  }

  /** El componente con ese id, o undefined. */
  obtener(id: string): ComponenteEscena | undefined {
    const n = this.lugarDe.get(id);
    return n === undefined ? undefined : this.lugares[n]!;
  }

  /** Agrega un componente. Devuelve su caja de dibujo. Si el id ya estaba, es `actualizar`. */
  agregar(id: string, c: ComponenteEscena): Caja {
    if (this.lugarDe.has(id)) return this.actualizar(id, c);
    const n = this.libres.pop() ?? this.lugares.length;
    const k = cajaDibujo(c.def, c, c.etiqueta);
    this.lugares[n] = c;
    this.cajas[n] = k;
    this.ids[n] = id;
    this.lugarDe.set(id, n);
    this.indice.insertar(n, k);
    if (this.cajaTotal !== undefined) this.cajaTotal = this.cajaTotal ? unirCajas(this.cajaTotal, k) : k;
    return k;
  }

  /** Quita un componente. Devuelve la caja que ocupaba, o null si no estaba. */
  quitar(id: string): Caja | null {
    const n = this.lugarDe.get(id);
    if (n === undefined) return null;
    const k = this.cajas[n]!;
    this.indice.quitar(n);
    this.lugares[n] = null;
    this.cajas[n] = null;
    this.ids[n] = null;
    this.lugarDe.delete(id);
    this.libres.push(n);
    this.cajaTotal = undefined;
    return k;
  }

  /**
   * Cambia un componente (posición, rotación, etiqueta…). Devuelve la caja
   * vieja unida a la nueva. Si no estaba, lo agrega.
   */
  actualizar(id: string, c: ComponenteEscena): Caja {
    const n = this.lugarDe.get(id);
    if (n === undefined) return this.agregar(id, c);
    const vieja = this.cajas[n]!;
    const nueva = cajaDibujo(c.def, c, c.etiqueta);
    this.lugares[n] = c;
    this.cajas[n] = nueva;
    this.indice.mover(n, nueva);
    this.cajaTotal = undefined;
    return unirCajas(vieja, nueva);
  }

  /** Ids de los componentes cuya caja de dibujo toca `caja`. */
  idsEnCaja(caja: Caja): string[] {
    return this.indice.enCaja(caja).map((n) => this.ids[n]!);
  }

  contar(vista: Caja): number {
    // Se llama en cada cuadro, para el contador: sin armar ni ordenar la lista.
    return this.indice.contar(vista);
  }

  dibujar(r: Renderer, info: InfoDibujo): number {
    const visibles = this.indice.enCaja(info.visible, this.visibles);
    dibujarComponentes(r, info, this.lugares, visibles, visibles.length, this.marcarBornes);
    return visibles.length;
  }
}
