// Grilla de puntos que se adapta al zoom. Es solo de pantalla (no va al PDF),
// por eso se dibuja directo sobre el contexto, en píxeles físicos y redondeada,
// para que cada punto quede nítido.
//
// Rendimiento: todas las filas tienen los puntos en las mismas columnas, así
// que se dibuja una sola fila (una "tira") y se copia una vez por fila. Con
// 20 000 puntos en pantalla son ~100 copias en vez de rasterizar un trazado de
// 20 000 cuadraditos (unas 7 veces más rápido por software).

import type { Camara } from "./camara";

/** Distancia mínima en píxeles CSS entre puntos; si es menor, se ralean. */
export const SEPARACION_MINIMA = 10;

/** Cada cuántos pasos hay un punto mayor (y factor entre un nivel y el siguiente). */
export const PASOS_POR_MAYOR = 5;

/**
 * Paso de la grilla en unidades (1, 5, 25…) para una escala en px por unidad:
 * el más chico cuyos puntos queden al menos a SEPARACION_MINIMA píxeles.
 */
export function pasoGrilla(escala: number): number {
  let paso = 1;
  while (paso * escala < SEPARACION_MINIMA) paso *= PASOS_POR_MAYOR;
  return paso;
}

export interface ColoresGrilla {
  punto: string;
  mayor: string;
}

export class Grilla {
  /** Fila común (solo puntos menores) y fila mayor (con puntos mayores cada PASOS_POR_MAYOR). */
  private readonly tiraMenor: CanvasRenderingContext2D;
  private readonly tiraMayor: CanvasRenderingContext2D;

  /** `crearContexto(true)` debe dar un canvas transparente: las tiras se copian encima del fondo. */
  constructor(crearContexto: (transparente: boolean) => CanvasRenderingContext2D) {
    this.tiraMenor = crearContexto(true);
    this.tiraMayor = crearContexto(true);
  }

  /**
   * Dibuja los puntos visibles. `dpr` es el devicePixelRatio; ancho y alto en
   * px CSS (los del área que cubre `ctx`).
   */
  dibujar(
    ctx: CanvasRenderingContext2D,
    camara: Camara,
    ancho: number,
    alto: number,
    dpr: number,
    colores: ColoresGrilla,
  ): void {
    const paso = pasoGrilla(camara.escala);
    const mayor = paso * PASOS_POR_MAYOR;
    const vista = camara.visible(ancho, alto);
    const gx0 = Math.floor(vista.x / paso) * paso;
    const gy0 = Math.floor(vista.y / paso) * paso;
    const gx1 = vista.x + vista.ancho;
    const gy1 = vista.y + vista.alto;

    const tam = Math.max(1, Math.round(dpr));
    const tamMayor = Math.max(2, Math.round(2 * dpr));
    const k = camara.escala * dpr;

    // Las dos tiras, del ancho del destino y del alto de un punto mayor; el
    // punto menor queda centrado en esa altura.
    const anchoTira = ctx.canvas.width;
    for (const t of [this.tiraMenor, this.tiraMayor]) {
      if (t.canvas.width !== anchoTira || t.canvas.height !== tamMayor) {
        t.canvas.width = anchoTira;
        t.canvas.height = tamMayor;
      } else {
        t.clearRect(0, 0, anchoTira, tamMayor);
      }
    }
    const dy = (tamMayor >> 1) - (tam >> 1);
    const menores = new Path2D();
    const menoresDeFilaMayor = new Path2D();
    const mayores = new Path2D();
    for (let gx = gx0; gx <= gx1; gx += paso) {
      const px = Math.round((gx - camara.x) * k);
      menores.rect(px - (tam >> 1), dy, tam, tam);
      if (gx % mayor === 0) mayores.rect(px - (tamMayor >> 1), 0, tamMayor, tamMayor);
      else menoresDeFilaMayor.rect(px - (tam >> 1), dy, tam, tam);
    }
    this.tiraMenor.fillStyle = colores.punto;
    this.tiraMenor.fill(menores);
    this.tiraMayor.fillStyle = colores.punto;
    this.tiraMayor.fill(menoresDeFilaMayor);
    this.tiraMayor.fillStyle = colores.mayor;
    this.tiraMayor.fill(mayores);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let gy = gy0; gy <= gy1; gy += paso) {
      const py = Math.round((gy - camara.y) * k);
      const tira = gy % mayor === 0 ? this.tiraMayor : this.tiraMenor;
      ctx.drawImage(tira.canvas, 0, py - (tamMayor >> 1));
    }
    ctx.restore();
  }
}
