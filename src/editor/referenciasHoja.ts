// Referencias cruzadas de la hoja en memoria (T18): la lista de cada bobina,
// ya como líneas de texto, para que el dibujo no recalcule nada. Las reglas
// son del núcleo (src/core/model/referencias.ts); acá se guardan y se ponen
// al día.
//
// Se pone al día con cada comando (ejecutar, agrupar, deshacer, rehacer: el
// editor llama a `reflejar` con los ids del cambio), nunca al mover el mouse
// ni durante un arrastre: la lista muestra la ubicación vieja hasta soltar.
// Si el cambio no toca ninguna bobina ni contacto seguidor (cablear, mover un
// pulsador), no recalcula. Si recalcula, devuelve las bobinas cuya lista
// cambió: el editor actualiza esas en la escena, que invalida su caja vieja
// y la nueva (sin restos, ajuste 3).
//
// No depende de la vista ni del editor. Un documento nuevo es un editor
// nuevo, con su propio caché.

import type { Componente, Documento } from "../core/model/documento";
import { referenciasCruzadas, textoFila } from "../core/model/referencias";
import { buscarSimbolo, esBobina, sigueABobina } from "../core/symbols";

const SIN_CAMBIOS: ReadonlySet<string> = new Set();

export class ReferenciasHoja {
  /** Id de bobina → sus líneas. Solo las bobinas con lista. */
  private lineasPorBobina = new Map<string, readonly string[]>();
  /** Ids de las bobinas y los seguidores de la hoja en el último cálculo, con o sin etiqueta. */
  private relevantes = new Set<string>();
  private _calculos = 0;

  constructor(
    private readonly doc: Documento,
    private readonly hoja = 0,
  ) {
    this.calcular();
  }

  /** Cuántas veces se recorrió la hoja (para los tests de que no recalcula de más). */
  get calculos(): number {
    return this._calculos;
  }

  /** Las líneas de la lista de `idBobina`, o undefined si no tiene lista. */
  lineas(idBobina: string): readonly string[] | undefined {
    return this.lineasPorBobina.get(idBobina);
  }

  /** Las bobinas con lista y sus líneas (para los tests). */
  todas(): ReadonlyMap<string, readonly string[]> {
    return this.lineasPorBobina;
  }

  /**
   * El documento cambió en los componentes `ids` (los que siguen en la hoja,
   * en `actuales`). Devuelve las bobinas cuya lista cambió, apareció o
   * desapareció; vacío si no hizo falta recalcular.
   */
  reflejar(ids: Iterable<string>, actuales: ReadonlyMap<string, Componente>): ReadonlySet<string> {
    let toca = false;
    for (const id of ids) {
      if (this.relevantes.has(id)) {
        toca = true;
        break;
      }
      const c = actuales.get(id);
      if (c && esRelevante(c)) {
        toca = true;
        break;
      }
    }
    if (!toca) return SIN_CAMBIOS;
    const antes = this.lineasPorBobina;
    this.calcular();
    const cambiadas = new Set<string>();
    for (const [id, nuevas] of this.lineasPorBobina) {
      const viejas = antes.get(id);
      if (!viejas || !iguales(viejas, nuevas)) cambiadas.add(id);
    }
    for (const id of antes.keys()) if (!this.lineasPorBobina.has(id)) cambiadas.add(id);
    return cambiadas;
  }

  /** Recorre la hoja: las listas (núcleo) y los relevantes. */
  private calcular(): void {
    this._calculos++;
    const h = this.doc.hojas[this.hoja];
    this.relevantes = new Set();
    this.lineasPorBobina = new Map();
    if (!h) return;
    for (const c of h.componentes) if (esRelevante(c)) this.relevantes.add(c.id);
    // Dos bobinas con la misma etiqueta comparten el arreglo de filas: también las líneas.
    const armadas = new Map<readonly unknown[], readonly string[]>();
    for (const [id, filas] of referenciasCruzadas(h, this.hoja)) {
      let lineas = armadas.get(filas);
      if (!lineas) armadas.set(filas, (lineas = filas.map(textoFila)));
      this.lineasPorBobina.set(id, lineas);
    }
  }
}

/** True si el componente es una bobina o un contacto seguidor (por su símbolo). */
function esRelevante(c: Componente): boolean {
  const def = buscarSimbolo(c.tipo);
  return esBobina(def) || sigueABobina(def);
}

function iguales(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
