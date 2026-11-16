// Inversión de giro de referencia (cierre de la fase 3b, D1-A y D2-A): el
// circuito de aceptación de la fase, armado solo con comandos, como
// `marchaParada.ts`. Es apoyo de los tests: el código de la app no lo usa.
// Componentes, redes esperadas, coordenadas y codos: docs/plan-cierre-3b.md,
// sección 2.
//
// - La rama de K1 es la de la marcha-parada con el NC "K2" intercalado entre
//   S1·14 y la bobina: la bobina, H1 y N bajan 6 unidades (el «hacer lugar»
//   del procedimiento) y H1 se toma con una T sobre el cable NC·22–A1.
// - La rama de K2 está donde la deja Ctrl+D (dx = 21): la copia de la rama de
//   K1, con el NC "K1". Arriba, S2·13 y K2·13 se unen con un cable y ese cable
//   va con una T a w3 (la red común de S0·12). Abajo, H2·X2 va con una T a w7
//   (el cable de la bobina K1 al Neutro) y K2·A2 con una T a ese cable.
// - El enclavamiento es solo eléctrico (D1-A): un NC de K2 en la rama de K1 y
//   uno de K1 en la de K2.
// - Etiquetas, codos fijos y `prepararCable` contra la hoja de ese momento,
//   como en `marchaParada.ts`: si W no dejaría un cable, el armado tira.

import { indexarHoja } from "../model/cables";
import { CambiarEtiqueta, cablear, colocar } from "../model/comandos";
import { crearDocumento, type Documento, type Extremo } from "../model/documento";
import { Historial } from "../model/historial";
import { consultaHoja, prepararCable } from "../model/trazado";
import { buscarSimbolo, type Rotacion } from "../symbols";

/** Metadatos fijos: el mismo documento en cada armado (también para el archivo congelado). */
export const META_INVERSION = { titulo: "Inversión de giro", autor: "", fecha: "2026-11-16" } as const;

/** Desplazamiento de la rama de K2 respecto de la de K1: el de Ctrl+D (ancho de la caja de la rama, 19, redondeado para arriba + 2). */
export const DX_RAMA_K2 = 21;

/** Ids de los componentes, por su papel en el circuito. */
export interface ComponentesInversion {
  fase: string;
  s0: string;
  /** Marcha K1. */
  s1: string;
  /** Retención de K1 (K1 13-14). */
  k1Auxiliar: string;
  /** Enclavamiento en la rama de K1: el NC de K2 (K2 21-22). */
  k2AuxiliarNC: string;
  k1Bobina: string;
  h1: string;
  /** Marcha K2. */
  s2: string;
  /** Retención de K2 (K2 13-14). */
  k2Auxiliar: string;
  /** Enclavamiento en la rama de K2: el NC de K1 (K1 21-22). */
  k1AuxiliarNC: string;
  k2Bobina: string;
  h2: string;
  neutro: string;
}

export interface Inversion {
  doc: Documento;
  /** El historial con el que se armó: deshacer todo deja la hoja vacía. */
  historial: Historial;
  comp: ComponentesInversion;
  /** Ids de los cables, w1 a w17 en el orden de la tabla del plan. */
  cables: string[];
}

export function inversion(): Inversion {
  const doc = crearDocumento({ ...META_INVERSION });
  const historial = new Historial(doc);

  const poner = (tipo: string, x: number, y: number, etiqueta: string | null, rot: Rotacion = 0): string => {
    const def = buscarSimbolo(tipo);
    if (!def) throw new Error(`Inversión: no existe el símbolo "${tipo}".`);
    const cmd = colocar(doc, { tipo, x, y, rot, espejado: false, etiqueta: def.etiquetaInicial ?? "", params: {} });
    historial.ejecutar(cmd);
    if (etiqueta !== null) historial.ejecutar(new CambiarEtiqueta(cmd.id, etiqueta));
    return cmd.id;
  };

  const dx = DX_RAMA_K2;
  // Rama de K1: la marcha-parada con lugar para el NC.
  const fase = poner("fuente.fase", 0, 0, null);
  const s0 = poner("pulsador.nc", 0, 5, "S0");
  const s1 = poner("pulsador.na", 0, 11, "S1");
  const k1Auxiliar = poner("contactor.auxiliar_na", 10, 11, "K1");
  const k2AuxiliarNC = poner("contactor.auxiliar_nc", 0, 17, "K2");
  const k1Bobina = poner("contactor.bobina", 0, 28, "K1");
  const h1 = poner("senalizacion.lampara", 16, 28, "H1");
  // Rama de K2: la copia, dx unidades a la derecha.
  const s2 = poner("pulsador.na", dx, 11, "S2");
  const k2Auxiliar = poner("contactor.auxiliar_na", dx + 10, 11, "K2");
  const k1AuxiliarNC = poner("contactor.auxiliar_nc", dx, 17, "K1");
  const k2Bobina = poner("contactor.bobina", dx, 28, "K2");
  const h2 = poner("senalizacion.lampara", dx + 16, 28, "H2");
  const neutro = poner("fuente.neutro", 0, 39, null, 180);

  const tender = (desde: Extremo, hasta: Extremo, codos: [number, number][] = []): string => {
    const hoja = doc.hojas[0]!;
    const indice = indexarHoja(hoja);
    const { problemas } = prepararCable(indice, consultaHoja(hoja, indice), { desde, hasta, codos });
    if (problemas.length > 0) {
      throw new Error(`Inversión: W no dejaría el cable ${JSON.stringify({ desde, hasta, codos })}: ${problemas.map((p) => p.mensaje).join(" ")}`);
    }
    const cmd = cablear(doc, { desde, hasta, codos });
    historial.ejecutar(cmd);
    return cmd.id;
  };
  const borne = (comp: string, nombre: string): Extremo => ({ tipo: "borne", comp, borne: nombre });
  const enCable = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });

  // Rama de K1.
  const w1 = tender(borne(fase, "L"), borne(s0, "11"));
  const w2 = tender(borne(s0, "12"), borne(s1, "13"));
  const w3 = tender(borne(s0, "12"), borne(k1Auxiliar, "13"), [[10, 7]]);
  const w4 = tender(borne(s1, "14"), borne(k2AuxiliarNC, "21"));
  const w5 = tender(borne(k1Auxiliar, "14"), borne(s1, "14"));
  const w6 = tender(borne(k2AuxiliarNC, "22"), borne(k1Bobina, "A1"));
  const w7 = tender(borne(k1Bobina, "A2"), borne(neutro, "N"));
  const w8 = tender(enCable(w6, 0, 22), borne(h1, "X1"), [[16, 22]]);
  const w9 = tender(enCable(w7, 0, 34), borne(h1, "X2"), [[16, 34]]);
  // Rama de K2: los cables que trae la copia.
  const w10 = tender(borne(s2, "14"), borne(k1AuxiliarNC, "21"));
  const w11 = tender(borne(k2Auxiliar, "14"), borne(s2, "14"));
  const w12 = tender(borne(k1AuxiliarNC, "22"), borne(k2Bobina, "A1"));
  const w13 = tender(enCable(w12, dx, 22), borne(h2, "X1"), [[dx + 16, 22]]);
  // La copia arriba, a la red común.
  const w14 = tender(borne(s2, "13"), borne(k2Auxiliar, "13"), [
    [dx, 7],
    [dx + 10, 7],
  ]);
  const w15 = tender(enCable(w3, 10, 8), enCable(w14, dx, 8));
  // La copia abajo, al Neutro.
  const w16 = tender(borne(h2, "X2"), enCable(w7, 0, 36), [[dx + 16, 36]]);
  const w17 = tender(borne(k2Bobina, "A2"), enCable(w16, dx, 36));

  const comp: ComponentesInversion = { fase, s0, s1, k1Auxiliar, k2AuxiliarNC, k1Bobina, h1, s2, k2Auxiliar, k1AuxiliarNC, k2Bobina, h2, neutro };
  const cables = [w1, w2, w3, w4, w5, w6, w7, w8, w9, w10, w11, w12, w13, w14, w15, w16, w17];
  return { doc, historial, comp, cables };
}
