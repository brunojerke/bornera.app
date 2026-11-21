// «Probar la fase 5» del menú de desarrollo (T31; docs/plan-T31.md): lo de
// «Probar la fase 4» (B1–B16 con su calentamiento la 1.ª vez, F1, F2 y F3) y
// después S1–S5 (medirMando.ts), con la tabla para copiar. S1 completa y S4
// desde T33. No toca la hoja ni su copia de recuperación, los recientes, el
// título ni «modificado».
//
// El juicio de la PC (topes = netbook / K; mediana de las calientes y máximo
// con margen, ajuste 1 de T31) lo hace `tests/bench/probar-webview2.mjs --fase5`.

import { textoFase4 } from "./fase4";
import { filasS, notasS } from "./fase5";
import { medirMando } from "./medirMando";
import { medirFase4 } from "./probarFase4";

/** Corre B1–B16, F1–F3 y S1–S5, y devuelve la tabla para copiar. */
export async function probarFase5(progreso: (paso: string) => void = () => {}): Promise<string> {
  const inicio = performance.now();
  const f4 = await medirFase4(progreso);
  const { muestras, escena } = await medirMando(f4.doc, f4.ancho, f4.alto, progreso);
  const segundos = Math.round((performance.now() - inicio) / 1000);
  return textoFase4([...f4.filas, ...filasS(muestras)], `Probar la fase 5 · ${f4.condiciones} · ${segundos} s`, [...f4.notas, ...notasS(muestras, escena), ""]);
}
