// Apoyo de tests (T18 y cierre 3b): la caja real de la lista de referencias
// de una bobina y todo lo dibujado de la hoja como obstáculos, para comprobar
// que una lista no tapa nada (condición 4 de docs/plan-T18.md, sección 3).
// Solo lo importan tests; vive en `editor/` porque usa las cajas de `render/`,
// que `src/core` no puede importar.
//
// Los obstáculos son la `cajaDibujo` de cada componente (la cota que nunca se
// queda corta: cuerpo, nombres de bornes y etiqueta con la letra más ancha) y
// cada tramo de cable con medio grosor de trazo. Se excluye solo la bobina
// dueña de la lista: lo suyo (etiqueta, nombres de bornes) es S4, del dibujo.

import { indexarHoja, recorridoCable } from "../core/model/cables";
import type { Componente, Hoja } from "../core/model/documento";
import { buscarSimbolo } from "../core/symbols";
import type { Caja } from "../render/camara";
import { cajaDibujo, cajaReferencias } from "../render/simbolo";

/** Medio grosor del trazo de un cable, generoso. */
export const MEDIO_TRAZO = 0.1;
/** Por debajo de esta holgura (en unidades) contra cualquier cosa, se frena (decisión de Bruno al aprobar la etapa 2 de T18). */
export const HOLGURA_MINIMA = 1;

export const colocacion = (c: Componente) => ({ x: c.x, y: c.y, rotacion: c.rot, espejado: c.espejado });

/** La caja real de la lista de `bobina` con esas líneas. */
export function cajaLista(bobina: Componente, lineas: readonly string[]): Caja {
  const k = cajaReferencias(buscarSimbolo(bobina.tipo)!, colocacion(bobina), lineas);
  if (!k) throw new Error("Sin lista.");
  return k;
}

export interface Obstaculo {
  /** Id del componente o del cable. */
  id: string;
  cable: boolean;
  /** Para leer el fallo. */
  que: string;
  caja: Caja;
}

/** Todo lo dibujado de la hoja salvo la bobina `excepto`: componentes (cajaDibujo) y tramos de cable. */
export function obstaculos(hoja: Hoja, excepto: string): Obstaculo[] {
  const salida: Obstaculo[] = [];
  for (const c of hoja.componentes) {
    if (c.id === excepto) continue;
    const def = buscarSimbolo(c.tipo)!;
    const caja = cajaDibujo(def, colocacion(c), c.etiqueta);
    salida.push({ id: c.id, cable: false, que: `${c.etiqueta || c.tipo} en (${c.x}, ${c.y})`, caja });
  }
  const indice = indexarHoja(hoja);
  for (const w of hoja.cables) {
    const p = recorridoCable(indice, w);
    if (!p) throw new Error(`El cable ${w.id} no se resuelve.`);
    for (let i = 0; i + 3 < p.length; i += 2) {
      const x0 = Math.min(p[i]!, p[i + 2]!);
      const x1 = Math.max(p[i]!, p[i + 2]!);
      const y0 = Math.min(p[i + 1]!, p[i + 3]!);
      const y1 = Math.max(p[i + 1]!, p[i + 3]!);
      salida.push({
        id: w.id,
        cable: true,
        que: `cable ${w.id} de (${p[i]}, ${p[i + 1]}) a (${p[i + 2]}, ${p[i + 3]})`,
        caja: { x: x0 - MEDIO_TRAZO, y: y0 - MEDIO_TRAZO, ancho: x1 - x0 + 2 * MEDIO_TRAZO, alto: y1 - y0 + 2 * MEDIO_TRAZO },
      });
    }
  }
  return salida;
}

/** Separación entre dos cajas: la mayor de las dos distancias por eje (negativa o 0 si se tocan). */
export function separacion(a: Caja, b: Caja): number {
  const dx = Math.max(b.x - (a.x + a.ancho), a.x - (b.x + b.ancho));
  const dy = Math.max(b.y - (a.y + a.alto), a.y - (b.y + b.alto));
  return Math.max(dx, dy);
}

/** Lo que toca la caja `lista` y la menor separación con todo lo demás. */
export function revisar(lista: Caja, obs: readonly Obstaculo[]): { tocados: string[]; holgura: number } {
  const tocados: string[] = [];
  let holgura = Infinity;
  for (const o of obs) {
    const s = separacion(lista, o.caja);
    if (s <= 0) tocados.push(o.que);
    holgura = Math.min(holgura, s);
  }
  return { tocados, holgura };
}

/** La caja con que `obstaculos` anotó a `id`. */
export function cajaDe(obs: readonly Obstaculo[], id: string): Caja {
  const o = obs.find((k) => k.id === id);
  if (!o) throw new Error(`No hay obstáculo ${id}.`);
  return o.caja;
}
