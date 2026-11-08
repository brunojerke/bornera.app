// Escena que cambia: componentes que se agregan, se quitan y se mueven por
// id (el del documento). Es lo que dibuja el editor.
//
// Cada operación devuelve la caja de dibujo afectada (la vieja unida a la
// nueva), en unidades de grilla, para pasarla a `Capas.invalidarRegion`: así
// solo se rehacen los mosaicos que tocan el cambio.
//
// El recorte por vista usa un índice espacial (indiceEspacial.ts) en lugar de
// recorrer todos los componentes. El mismo índice sirve para elegir con el
// mouse (`idEnPunto`, `idsEnCaja`): primero da los candidatos por su caja de
// dibujo y después se compara con su forma para elegir (`FormaEleccion`).
// Esas consultas no miran qué es cada elemento, solo su forma: cuando lleguen
// los cables (T12) se suman con los tramos como zonas y las consultas no cambian.

import { ampliarCaja, seTocan, unirCajas, type Caja } from "./camara";
import { dibujarComponentes, type ComponenteEscena, type Contenido, type InfoDibujo, type OpcionesEscena } from "./escena";
import { IndiceEspacial } from "./indiceEspacial";
import type { Renderer } from "./renderer";
import { cajaDibujo, cajaEtiqueta, cajaSimbolo } from "./simbolo";

/**
 * Cómo se elige un elemento con el mouse, en unidades de grilla.
 * - `zonas`: lo que se puede tocar. Un componente: la caja del símbolo y la de
 *   su etiqueta (no los huecos donde van los nombres de bornes). Un cable: un
 *   rectángulo angosto por tramo.
 * - `cuerpo`: lo que tiene que quedar adentro de un rectángulo "contiene".
 *   Un componente: la caja del símbolo, sin la etiqueta.
 */
export interface FormaEleccion {
  cuerpo: Caja;
  zonas: readonly Caja[];
  /** Caja que rodea todas las zonas (para el resaltado); se calcula una vez. */
  contorno: Caja;
}

/** Arma la forma con su contorno. */
export function crearForma(cuerpo: Caja, zonas: readonly Caja[]): FormaEleccion {
  let contorno = zonas[0] ?? cuerpo;
  for (let i = 1; i < zonas.length; i++) contorno = unirCajas(contorno, zonas[i]!);
  return { cuerpo, zonas, contorno };
}

/**
 * Rectángulo de selección: "contiene" elige lo que queda entero adentro
 * (arrastrando de izquierda a derecha); "toca", lo que lo toca aunque sea un
 * poco (de derecha a izquierda).
 */
export type ModoRectangulo = "contiene" | "toca";

/** Forma para elegir un componente. */
export function formaComponente(c: ComponenteEscena): FormaEleccion {
  const cuerpo = cajaSimbolo(c.def, c);
  const etiqueta = cajaEtiqueta(c.def, c, c.etiqueta);
  return crearForma(cuerpo, etiqueta ? [cuerpo, etiqueta] : [cuerpo]);
}

/** True si `a` está entera dentro de `b` (bordes incluidos). */
export function contieneCaja(b: Caja, a: Caja): boolean {
  return a.x >= b.x && a.y >= b.y && a.x + a.ancho <= b.x + b.ancho && a.y + a.alto <= b.y + b.alto;
}

/** True si el punto está en la caja agrandada `tolerancia` hacia cada lado. */
function puntoEn(k: Caja, x: number, y: number, tolerancia: number): boolean {
  return x >= k.x - tolerancia && x <= k.x + k.ancho + tolerancia && y >= k.y - tolerancia && y <= k.y + k.alto + tolerancia;
}

export class EscenaEditable implements Contenido {
  /** Componente en cada lugar del índice; null si el lugar está libre. */
  private readonly lugares: (ComponenteEscena | null)[] = [];
  /** Caja de dibujo de cada lugar. */
  private readonly cajas: (Caja | null)[] = [];
  /** Forma para elegir de cada lugar. */
  private readonly formas: (FormaEleccion | null)[] = [];
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
    this.formas[n] = formaComponente(c);
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
    this.formas[n] = null;
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
    this.formas[n] = formaComponente(c);
    this.indice.mover(n, nueva);
    this.cajaTotal = undefined;
    return unirCajas(vieja, nueva);
  }

  /** Forma para elegir del elemento con ese id, o undefined. */
  forma(id: string): FormaEleccion | undefined {
    const n = this.lugarDe.get(id);
    return n === undefined ? undefined : this.formas[n]!;
  }

  /** Ids de los elementos cuya caja de dibujo toca `caja` (candidatos, sin el filtro fino). */
  idsCandidatos(caja: Caja): string[] {
    return this.indice.enCaja(caja).map((n) => this.ids[n]!);
  }

  /**
   * El elemento que se elige con un clic en (x, y): el que tiene una zona a
   * menos de `tolerancia` del punto. Si hay varios encimados, el de arriba
   * (el que se dibuja último). Null si no hay ninguno.
   */
  idEnPunto(x: number, y: number, tolerancia = 0): string | null {
    // La caja de dibujo contiene a las zonas: con la tolerancia, no se pierde ninguno.
    const candidatos = this.indice.enCaja({ x: x - tolerancia, y: y - tolerancia, ancho: 2 * tolerancia, alto: 2 * tolerancia });
    // Vienen de menor a mayor lugar, que es el orden de dibujo: se recorre al revés.
    for (let i = candidatos.length - 1; i >= 0; i--) {
      const n = candidatos[i]!;
      for (const z of this.formas[n]!.zonas) if (puntoEn(z, x, y, tolerancia)) return this.ids[n]!;
    }
    return null;
  }

  /**
   * Ids de los elementos que elige un rectángulo de selección, en orden de
   * dibujo: con "contiene", los que tienen el cuerpo entero adentro; con
   * "toca", los que tienen alguna zona que lo toca.
   */
  idsEnCaja(caja: Caja, modo: ModoRectangulo): string[] {
    const salida: string[] = [];
    for (const n of this.indice.enCaja(caja)) {
      const f = this.formas[n]!;
      const elegido = modo === "contiene" ? contieneCaja(caja, f.cuerpo) : f.zonas.some((z) => seTocan(z, caja));
      if (elegido) salida.push(this.ids[n]!);
    }
    return salida;
  }

  /** Caja que rodea todas las zonas del elemento (para resaltarlo), o null si no está. */
  contorno(id: string, margen = 0): Caja | null {
    const f = this.forma(id);
    if (!f) return null;
    return margen ? ampliarCaja(f.contorno, margen) : f.contorno;
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
