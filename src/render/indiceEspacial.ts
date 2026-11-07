// Índice espacial: una grilla de hash para saber, sin recorrer todo, qué
// elementos tocan una caja o un punto (en unidades de grilla). Sirve para el
// recorte de la capa estática y para elegir lo que hay bajo el mouse.
//
// Cada elemento se anota en todas las celdas (de TAM_CELDA unidades) que toca
// su caja. Una consulta mira solo las celdas de la caja pedida y después
// compara las cajas exactas. El contacto es inclusivo: dos cajas que comparten
// un borde se tocan (como `seTocan`).
//
// Los elementos se identifican con un número chico (un lugar, 0, 1, 2…) que
// elige quien usa el índice; sus cajas van en arreglos indexados por ese número.
//
// Se consulta en cada mosaico y en cada cuadro: las consultas no crean
// funciones ni números con decimales, y contar no arma ni ordena listas.

import type { Caja } from "./camara";

/** Lado de una celda, en unidades de grilla: unas dos veces un símbolo con sus textos. */
export const TAM_CELDA = 16;

/**
 * Clave de una celda: 15 bits por eje, así entra en un entero chico de V8
 * (menos de 2^30) y el Map no tiene que guardar números con decimales. Las
 * celdas a 32768 de distancia comparten clave: no pasa nada, porque después
 * se comparan las cajas exactas.
 */
function claveCelda(cx: number, cy: number): number {
  return (cx & 0x7fff) * 0x8000 + (cy & 0x7fff);
}

const celda = (v: number) => Math.floor(v / TAM_CELDA);

const ascendente = (a: number, b: number) => a - b;

export class IndiceEspacial {
  private readonly celdas = new Map<number, number[]>();
  /** Caja de cada lugar: x0, y0, x1, y1 seguidos; NaN si el lugar está vacío. */
  private cajas = new Float64Array(0);
  /** Última consulta que vio a cada lugar: evita repetirlo si está en varias celdas. */
  private sellos = new Uint32Array(0);
  private sello = 0;
  private _cantidad = 0;
  /** Lugar más alto + 1 que se usó alguna vez (para barrer linealmente). */
  private tope = 0;
  /** La última búsqueda recorrió todos los lugares en orden, en vez de ir por celdas. */
  private barrio = false;

  get cantidad(): number {
    return this._cantidad;
  }

  /** Anota el lugar `n` con su caja (si ya estaba, lo mueve). */
  insertar(n: number, caja: Caja): void {
    if (this.esta(n)) this.quitar(n);
    this.crecer(n + 1);
    const x0 = caja.x;
    const y0 = caja.y;
    const x1 = caja.x + caja.ancho;
    const y1 = caja.y + caja.alto;
    this.cajas.set([x0, y0, x1, y1], n * 4);
    const cx1 = celda(x1);
    const cy1 = celda(y1);
    for (let cx = celda(x0); cx <= cx1; cx++) {
      for (let cy = celda(y0); cy <= cy1; cy++) {
        const c = claveCelda(cx, cy);
        const lista = this.celdas.get(c);
        // Si dos celdas lejanas comparten clave, no se anota dos veces.
        if (!lista) this.celdas.set(c, [n]);
        else if (lista[lista.length - 1] !== n) lista.push(n);
      }
    }
    this._cantidad++;
    this.tope = Math.max(this.tope, n + 1);
  }

  /** Saca el lugar `n` (si no estaba, no hace nada). */
  quitar(n: number): void {
    if (!this.esta(n)) return;
    const j = n * 4;
    const { cajas } = this;
    const cx1 = celda(cajas[j + 2]!);
    const cy1 = celda(cajas[j + 3]!);
    for (let cx = celda(cajas[j]!); cx <= cx1; cx++) {
      for (let cy = celda(cajas[j + 1]!); cy <= cy1; cy++) {
        const c = claveCelda(cx, cy);
        const lista = this.celdas.get(c);
        const i = lista ? lista.indexOf(n) : -1;
        if (i < 0) continue; // ya se sacó (otra celda con la misma clave)
        // Sacar cambiando por el último: el orden dentro de una celda no importa.
        lista![i] = lista![lista!.length - 1]!;
        lista!.pop();
        if (lista!.length === 0) this.celdas.delete(c);
      }
    }
    cajas[j] = NaN;
    this._cantidad--;
  }

  /** Cambia la caja del lugar `n`. */
  mover(n: number, caja: Caja): void {
    this.insertar(n, caja);
  }

  /** True si el lugar `n` está anotado. */
  esta(n: number): boolean {
    return n < this.tope && !Number.isNaN(this.cajas[n * 4]!);
  }

  /**
   * Lugares cuya caja toca `caja`, de menor a mayor. Si se pasa `salida`, se
   * reusa (se vacía primero) para no pedir memoria en cada cuadro.
   */
  enCaja(caja: Caja, salida: number[] = []): number[] {
    salida.length = 0;
    this.buscar(caja, salida);
    // Barriendo salen ya ordenados; por celdas, no.
    if (!this.barrio) salida.sort(ascendente);
    return salida;
  }

  /** Cuántos lugares tocan `caja` (sin armar la lista). */
  contar(caja: Caja): number {
    return this.buscar(caja, null);
  }

  /** Lugares cuya caja contiene el punto (x, y), bordes incluidos, de menor a mayor. */
  enPunto(x: number, y: number): number[] {
    return this.enCaja({ x, y, ancho: 0, alto: 0 });
  }

  /** Saca todo. */
  vaciar(): void {
    this.celdas.clear();
    this.cajas.fill(NaN);
    this._cantidad = 0;
    this.tope = 0;
  }

  /**
   * Busca los lugares que tocan `caja`, los agrega a `salida` (si no es null)
   * y devuelve cuántos son. Deja en `barrio` si recorrió todos los lugares en
   * orden (en ese caso `salida` ya quedó ordenada).
   */
  private buscar(caja: Caja, salida: number[] | null): number {
    const x0 = caja.x;
    const y0 = caja.y;
    const x1 = caja.x + caja.ancho;
    const y1 = caja.y + caja.alto;
    const { cajas } = this;
    let n = 0;

    // Con la vista muy alejada la caja abarca más celdas que elementos:
    // barrer todo es más barato que recorrer celdas casi vacías.
    const cx0 = celda(x0);
    const cy0 = celda(y0);
    const cx1 = celda(x1);
    const cy1 = celda(y1);
    if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > this.celdas.size) {
      for (let i = 0, j = 0; i < this.tope; i++, j += 4) {
        if (cajas[j]! <= x1 && cajas[j + 2]! >= x0 && cajas[j + 1]! <= y1 && cajas[j + 3]! >= y0) {
          salida?.push(i);
          n++;
        }
      }
      this.barrio = true;
      return n;
    }

    const sello = this.nuevoSello();
    const { sellos } = this;
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const lista = this.celdas.get(claveCelda(cx, cy));
        if (!lista) continue;
        for (let k = 0; k < lista.length; k++) {
          const i = lista[k]!;
          if (sellos[i] === sello) continue;
          sellos[i] = sello;
          const j = i * 4;
          if (cajas[j]! <= x1 && cajas[j + 2]! >= x0 && cajas[j + 1]! <= y1 && cajas[j + 3]! >= y0) {
            salida?.push(i);
            n++;
          }
        }
      }
    }
    this.barrio = false;
    return n;
  }

  private nuevoSello(): number {
    this.sello = (this.sello + 1) >>> 0;
    if (this.sello === 0) {
      // Dio la vuelta (después de 4 mil millones de consultas): se borran los sellos.
      this.sellos.fill(0);
      this.sello = 1;
    }
    return this.sello;
  }

  /** Agranda los arreglos para que entren `n` lugares (duplicando, como un arreglo dinámico). */
  private crecer(n: number): void {
    if (n * 4 <= this.cajas.length) return;
    const capacidad = Math.max(16, n, (this.cajas.length / 4) * 2);
    const cajas = new Float64Array(capacidad * 4).fill(NaN);
    cajas.set(this.cajas);
    this.cajas = cajas;
    const sellos = new Uint32Array(capacidad);
    sellos.set(this.sellos);
    this.sellos = sellos;
  }
}
