// P1 de «Probar la fase 6» (T38; docs/plan-T38.md, docs/plan-fase6.md §4):
// dibujar todas las miniaturas de la paleta de cero, lo que pasa con un tema
// o un dpr nuevo. Solo el dibujo sincrónico en los canvas (sin pintar la
// pantalla); una vuelta de calentamiento sin medir y VUELTAS_P1 medidas.

import { VUELTAS_P1, type MuestraP1 } from "./fase6";
import { miniaturas } from "./miniaturas";

const respirar = () => new Promise((r) => setTimeout(r, 0));

export async function medirMiniaturas(progreso: (paso: string) => void = () => {}): Promise<MuestraP1> {
  progreso("P1: las miniaturas de la paleta");
  const m = miniaturas();
  // Si todavía no arrancaron (no debería: Probar corre después del primer cuadro), que arranquen.
  if (!m.arrancada) m.actualizar();
  await respirar();
  m.rehacer();
  const vueltas: number[] = [];
  let cantidad = 0;
  for (let i = 0; i < VUELTAS_P1; i++) {
    await respirar();
    const t0 = performance.now();
    cantidad = m.rehacer();
    vueltas.push(performance.now() - t0);
  }
  return { vueltas, miniaturas: cantidad };
}
