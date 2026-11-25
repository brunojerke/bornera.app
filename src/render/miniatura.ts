// Miniatura de un símbolo para la paleta (fase 6, T38, D10-A y D27-A): un
// canvas chico por ítem, con el Renderer Canvas y el Path2D cacheado del
// símbolo (`trazadoSimbolo`). Se dibuja una vez; solo un tema o un dpr nuevo
// la rehacen (lo decide ui/miniaturas.ts). Nada de esto corre por cuadro.

import type { DefinicionSimbolo } from "../core/symbols";
import { RendererCanvas } from "./canvas2d";
import { dibujarSimbolo } from "./simbolo";

/** Lado del canvas de una miniatura, en px CSS (la casilla de 40 menos 2 de cada lado). */
export const LADO_MINIATURA = 36;
/** Margen libre alrededor del símbolo, en px CSS. */
export const MARGEN_MINIATURA = 2;
/** Escala tope, en px CSS por unidad: la Fase (2×2) no llena la casilla. */
export const TOPE_ESCALA_MINIATURA = 8;

/** Px CSS por unidad: la caja del símbolo cabe en el lado útil, sin pasar del tope (D27-A). */
export function escalaMiniatura(tamano: { ancho: number; alto: number }, lado = LADO_MINIATURA): number {
  const util = lado - 2 * MARGEN_MINIATURA;
  return Math.min(util / tamano.ancho, util / tamano.alto, TOPE_ESCALA_MINIATURA);
}

/** Lado del canvas en px físicos para un dpr. */
export function ladoFisico(dpr: number): number {
  return Math.max(1, Math.round(LADO_MINIATURA * dpr));
}

/**
 * Dibuja de cero la miniatura de `def` en `ctx`: fija el tamaño del canvas
 * (eso lo borra) o, si ya lo tenía, lo borra; centra el símbolo en reposo,
 * sin etiqueta ni nombres de bornes, con trazo de 1 px CSS en `color`.
 */
export function dibujarMiniatura(ctx: CanvasRenderingContext2D, def: DefinicionSimbolo, dpr: number, color: string): void {
  const lado = ladoFisico(dpr);
  const canvas = ctx.canvas;
  if (canvas.width !== lado || canvas.height !== lado) {
    canvas.width = lado;
    canvas.height = lado;
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, lado, lado);
  }
  const e = escalaMiniatura(def.tamano);
  const k = e * dpr;
  const r = new RendererCanvas(ctx);
  r.transformar(k, 0, 0, k, lado / 2, lado / 2);
  r.estilo({ trazo: color, relleno: color, grosor: Math.max(0.1, 1 / e) });
  dibujarSimbolo(r, def, { x: 0, y: 0, rotacion: 0, espejado: false }, { nombresBornes: false });
}
