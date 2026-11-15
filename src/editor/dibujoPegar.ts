// Dibujo de la previa de pegar (T16) en la capa dinámica. No toca la capa
// estática: mover la previa no invalida mosaicos, igual que Colocar.
//
// Lo que no cambia con el desplazamiento (símbolos, cuerpos, tramos de los
// cables y extremos libres del recorte) se arma una vez por recorte
// (`armarDibujoPegado`) y cada cuadro lo dibuja trasladado. Con más de
// `limite` componentes a la vista, solo los contornos, como el arrastre.
// Color de acento si vale; `--conflicto` con una ✕ en cada conflicto si no.

import { indexarHoja, recorridoCable } from "../core/model/cables";
import type { Recorte } from "../core/model/portapapeles";
import type { Conflicto } from "../core/model/trazado";
import type { DefinicionSimbolo } from "../core/symbols";
import { seTocan, type Caja } from "../render/camara";
import { dibujarCruces } from "../render/cableEnCurso";
import type { InfoDinamico } from "../render/capas";
import { nivelDetalle } from "../render/detalle";
import { grosorLinea, type ComponenteEscena } from "../render/escena";
import { RADIO_LIBRE } from "../render/escenaEditable";
import type { Renderer } from "../render/renderer";
import { cajaSimbolo, dibujarMarcasBornes, dibujarSimbolo } from "../render/simbolo";

/** La previa armada, en las coordenadas del recorte (sin desplazar). */
export interface DibujoPegado {
  readonly recorte: Recorte;
  readonly componentes: readonly ComponenteEscena[];
  /** Caja del símbolo de cada componente (mismo orden). */
  readonly cuerpos: readonly Caja[];
  /** Tramos de los cables, x0, y0, x1, y1 seguidos. */
  readonly tramos: readonly number[];
  /** Extremos libres, x, y seguidos. */
  readonly libres: readonly number[];
}

/** Arma lo que dibuja la previa de `r`. `def` da el símbolo de cada tipo (o el desconocido). */
export function armarDibujoPegado(r: Recorte, def: (tipo: string) => DefinicionSimbolo): DibujoPegado {
  const componentes = r.componentes.map(
    (c): ComponenteEscena => ({
      def: def(c.tipo),
      x: c.x,
      y: c.y,
      rotacion: c.rot,
      espejado: c.espejado,
      etiqueta: c.etiqueta || undefined,
    }),
  );
  const cuerpos = componentes.map((c) => cajaSimbolo(c.def, c));
  const tramos: number[] = [];
  const libres: number[] = [];
  const indice = indexarHoja({ nombre: "", componentes: [...r.componentes], cables: [...r.cables] });
  for (const w of r.cables) {
    const p = recorridoCable(indice, w);
    if (p) for (let i = 0; i + 3 < p.length; i += 2) tramos.push(p[i]!, p[i + 1]!, p[i + 2]!, p[i + 3]!);
    for (const e of [w.desde, w.hasta]) if (e.tipo === "libre") libres.push(e.x, e.y);
  }
  return { recorte: r, componentes, cuerpos, tramos, libres };
}

/** Contornos reusados entre cuadros (x, y, ancho, alto seguidos). */
const contornos: number[] = [];

/**
 * Dibuja la previa desplazada (dx, dy). Con más de `limite` componentes a la
 * vista, solo sus contornos. Devuelve cuántos componentes quedaron a la vista.
 */
export function dibujarPegado(
  r: Renderer,
  info: InfoDinamico,
  d: DibujoPegado,
  dx: number,
  dy: number,
  conflictos: readonly Conflicto[],
  limite: number,
): number {
  const valida = conflictos.length === 0;
  const color = valida ? info.colores.acento : (info.colores.conflicto ?? info.colores.borne);
  const g = grosorLinea(info.escala);
  const detalle = nivelDetalle(info.escala);
  const v = info.visible;
  const vista: Caja = { x: v.x - dx, y: v.y - dy, ancho: v.ancho, alto: v.alto };
  const visibles: number[] = [];
  for (let i = 0; i < d.cuerpos.length; i++) if (seTocan(d.cuerpos[i]!, vista)) visibles.push(i);

  r.guardar();
  r.trasladar(dx, dy);
  r.estilo({ trazo: color, relleno: color, grosor: g });
  if (d.tramos.length > 0) r.lineas(d.tramos, d.tramos.length / 4);
  if (visibles.length <= limite) {
    for (const i of visibles) {
      const c = d.componentes[i]!;
      dibujarSimbolo(r, c.def, c, { textos: detalle.textos, etiqueta: c.etiqueta });
      if (detalle.bornes) dibujarMarcasBornes(r, c.def, c);
    }
  } else {
    contornos.length = 0;
    for (const i of visibles) {
      const k = d.cuerpos[i]!;
      contornos.push(k.x, k.y, k.ancho, k.alto);
    }
    r.rectangulos(contornos, visibles.length);
  }
  for (let i = 0; i + 1 < d.libres.length; i += 2) r.circulo(d.libres[i]!, d.libres[i + 1]!, RADIO_LIBRE);
  r.restaurar();
  // Los conflictos ya vienen en coordenadas de la hoja.
  if (!valida) dibujarCruces(r, info, conflictos);
  return visibles.length;
}
