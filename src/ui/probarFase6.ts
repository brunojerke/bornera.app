// «Probar la fase 6» del menú de desarrollo (T37; docs/plan-T37.md): lo de
// «Probar la fase 5» (B1–B16, F1–F3 y S1–S5, con el mismo texto) y después
// S6 (escena de potencia 2000) y P2 (la marca de arranque). P1 llega con T38.
// No toca la hoja ni su copia de recuperación, los recientes, el título ni
// «modificado».
//
// El juicio de la PC lo hace `tests/bench/probar-webview2.mjs --fase6`.

import { textoFase4 } from "./fase4";
import { filasS, notasS } from "./fase5";
import { filasFase6, notasFase6 } from "./fase6";
import { medirMando } from "./medirMando";
import { medirPotencia } from "./medirPotencia";
import { medirFase4 } from "./probarFase4";

/** Corre B1–B16, F1–F3, S1–S6 y P2, y devuelve la tabla para copiar. */
export async function probarFase6(progreso: (paso: string) => void = () => {}): Promise<string> {
  const inicio = performance.now();
  const f4 = await medirFase4(progreso);
  const mando = await medirMando(f4.doc, f4.ancho, f4.alto, progreso);
  const potencia = await medirPotencia(f4.ancho, f4.alto, progreso);
  const segundos = Math.round((performance.now() - inicio) / 1000);
  return textoFase4(
    [...f4.filas, ...filasS(mando.muestras), ...filasFase6(potencia.muestras)],
    `Probar la fase 6 · ${f4.condiciones} · ${segundos} s`,
    [...f4.notas, ...notasS(mando.muestras, mando.escena), ...notasFase6(potencia.muestras, potencia.escena), ""],
  );
}
