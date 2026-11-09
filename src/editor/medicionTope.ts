// Medición para fijar TOPE_CABLES_PREVIA (T14a): cuánto tarda la previa del
// arrastre en planear un punto de grilla según cuántos cables se acomodan.
// La usan el banco (PC) y la prueba automática del menú de desarrollo
// (netbook). Prepara y planea como la previa, con la consulta indexada de un
// editor, sin importar el tope.
//
// No se mide sobre la escena del banco: es tan densa que casi todo
// corrimiento se rechaza, y un rechazo corta el plan en el primer conflicto
// (mediría de menos). Se arma una escena propia donde todo vale: pares
// bobina → lámpara con lugar de sobra, y se arrastran N bobinas, así se
// acomodan exactamente N cables y el plan es siempre completo.

import { crearDocumento, type Documento } from "../core/model/documento";
import { prepararTransformacion } from "../core/model/seguir";
import { Editor } from "./editor";

/** Cables que se acomodan en cada medición: alrededor del tope, de un lado y del otro. */
export const OBJETIVOS_TOPE = [50, 100, 150, 300, 600] as const;

/** Puntos de grilla planeados por medición (más uno de calentamiento). */
export const PASOS_TOPE = 20;

/** Columnas de la escena de la medición, y separación entre pares (x) y filas (y). */
const COLUMNAS = 30;
const PASO_X = 8;
const PASO_Y = 16;

export interface MedidaTope {
  /** Cables que se acomodan (los que se buscaban: la escena da exactamente esos). */
  cables: number;
  /** ms por punto de grilla: mediana y máximo. */
  mediana: number;
  maximo: number;
  /** Puntos donde el plan se rechazó: tiene que dar 0 (si no, la medida no vale). */
  rechazados: number;
  pasos: number;
}

/**
 * Corrimiento del punto `i`, en unidades: una vuelta chica de 4 puntos que
 * cambia de punto de grilla en cada paso, como un arrastre lento.
 */
export function corrimientoTope(i: number): { dx: number; dy: number } {
  const vuelta = [
    [1, 0],
    [1, 1],
    [2, 1],
    [2, 0],
  ] as const;
  const [dx, dy] = vuelta[i % 4]!;
  return { dx, dy };
}

/**
 * La escena de la medición: `pares` bobinas en una grilla (cada PASO_X en x
 * y PASO_Y en y), cada una con un cable recto de A2 al X1 de una lámpara 10
 * más abajo. Ids: bobinas `c1, c3, …`, lámparas `c2, c4, …`, cables `w1…`.
 * Se arma de cero, como el banco.
 */
export function documentoTope(pares: number): Documento {
  const doc = crearDocumento({ titulo: `Tope de la previa (${pares})`, autor: "", fecha: "2026-01-01" });
  const hoja = doc.hojas[0]!;
  for (let i = 0; i < pares; i++) {
    const x = (i % COLUMNAS) * PASO_X;
    const y = Math.floor(i / COLUMNAS) * PASO_Y;
    const k = `c${2 * i + 1}`;
    const h = `c${2 * i + 2}`;
    hoja.componentes.push(
      { id: k, tipo: "contactor.bobina", x, y, rot: 0, espejado: false, etiqueta: `K${i + 1}`, params: {} },
      { id: h, tipo: "senalizacion.lampara", x, y: y + 10, rot: 0, espejado: false, etiqueta: `H${i + 1}`, params: {} },
    );
    hoja.cables.push({ id: `w${i + 1}`, desde: { tipo: "borne", comp: k, borne: "A2" }, hasta: { tipo: "borne", comp: h, borne: "X1" }, codos: [] });
  }
  doc.contadores = { c: 2 * pares + 1, w: pares + 1 };
  return doc;
}

/**
 * Mide el paso de la previa para cada cantidad de cables: arrastra las
 * primeras N bobinas (las de arriba a la izquierda) y planea `pasos` puntos
 * de grilla. `ahora` da ms (por defecto, performance.now).
 */
export function medirTope(
  objetivos: readonly number[] = OBJETIVOS_TOPE,
  pasos = PASOS_TOPE,
  ahora: () => number = () => performance.now(),
): MedidaTope[] {
  const pares = Math.max(...objetivos);
  const editor = new Editor(documentoTope(pares));
  const hoja = editor.documento.hojas[0]!;
  const salida: MedidaTope[] = [];
  for (const n of objetivos) {
    const ids = Array.from({ length: n }, (_, i) => `c${2 * i + 1}`);
    const prep = prepararTransformacion(hoja, ids, editor.entornoPlan());
    prep.planear({ tipo: "mover", ...corrimientoTope(0) }); // calentamiento
    const tiempos: number[] = [];
    let rechazados = 0;
    for (let i = 1; i <= pasos; i++) {
      const t0 = ahora();
      const r = prep.planear({ tipo: "mover", ...corrimientoTope(i) });
      tiempos.push(ahora() - t0);
      if (r.rechazo) rechazados++;
    }
    tiempos.sort((a, b) => a - b);
    salida.push({
      cables: prep.rehechos,
      mediana: tiempos[Math.floor(tiempos.length / 2)] ?? 0,
      maximo: tiempos.at(-1) ?? 0,
      rechazados,
      pasos,
    });
  }
  return salida;
}
