// Marcha-parada de referencia (T15, D1-A): el circuito de aceptación de la
// fase 3, armado solo con comandos, como lo haría el usuario. Es apoyo de los
// tests: el código de la app no lo usa. La fase 4 lo importa desde
// `tests/circuitos/` (la dirección permitida: `tests/` importa de `src/core`,
// nunca al revés).
//
// Fase "L" arriba, S0 (NC) y S1 (NA) en serie, el contacto auxiliar K1 13-14
// en paralelo con S1, la bobina K1 con la lámpara H1 en paralelo y el Neutro
// "N" abajo. Coordenadas, codos y redes esperadas: docs/plan-T15.md, sección 3.
//
// - Cada componente se coloca con la etiqueta inicial de su símbolo ("L" y
//   "N", como el editor) y las demás se ponen con `CambiarEtiqueta`, como el
//   panel. Todo pasa por un `Historial`: cada comando es un paso de deshacer.
// - Los codos son fijos (D3-B): los que daba el ruteo de W el 2026-11-12. Si
//   el ruteo cambia, este documento no se mueve. Cada cable pasa antes por
//   `prepararCable` (la validación de W) contra la hoja de ese momento: si W
//   no lo dejaría, el armado tira un error.
// - `dosNeutros`: la lámpara va a un segundo Neutro "N" (c8), sin cable entre
//   los dos neutros. Por cables quedan 5 redes; por nombre se unirían en 4.

import { indexarHoja } from "../model/cables";
import { CambiarEtiqueta, cablear, colocar } from "../model/comandos";
import { crearDocumento, type Documento, type Extremo } from "../model/documento";
import { Historial } from "../model/historial";
import { consultaHoja, prepararCable } from "../model/trazado";
import { buscarSimbolo, type Rotacion } from "../symbols";

/** Metadatos fijos: el mismo documento en cada armado (también para el archivo congelado de la etapa 2). */
export const META_MARCHA_PARADA = { titulo: "Marcha-parada", autor: "", fecha: "2026-11-12" } as const;

export interface OpcionesMarchaParada {
  /** La lámpara va a un segundo Neutro "N", sin cable entre los dos neutros. */
  dosNeutros?: boolean;
}

/** Ids de los componentes, por su papel en el circuito. */
export interface ComponentesMarchaParada {
  fase: string;
  s0: string;
  s1: string;
  /** Contacto auxiliar NA del contactor (K1 13-14). */
  k1Auxiliar: string;
  /** Bobina del contactor (K1 A1-A2). */
  k1Bobina: string;
  h1: string;
  neutro: string;
  /** El Neutro de la lámpara, solo con `dosNeutros`. */
  neutro2?: string;
}

export interface MarchaParada {
  doc: Documento;
  /** El historial con el que se armó: deshacer todo deja la hoja vacía. */
  historial: Historial;
  comp: ComponentesMarchaParada;
  /** Ids de los cables, w1 a w8 en el orden de la tabla del plan. */
  cables: string[];
}

export function marchaParada(opciones: OpcionesMarchaParada = {}): MarchaParada {
  const doc = crearDocumento({ ...META_MARCHA_PARADA });
  const historial = new Historial(doc);

  const poner = (tipo: string, x: number, y: number, etiqueta: string | null, rot: Rotacion = 0): string => {
    const def = buscarSimbolo(tipo);
    if (!def) throw new Error(`Marcha-parada: no existe el símbolo "${tipo}".`);
    const cmd = colocar(doc, { tipo, x, y, rot, espejado: false, etiqueta: def.etiquetaInicial ?? "", params: {} });
    historial.ejecutar(cmd);
    if (etiqueta !== null) historial.ejecutar(new CambiarEtiqueta(cmd.id, etiqueta));
    return cmd.id;
  };

  const fase = poner("fuente.fase", 0, 0, null);
  const s0 = poner("pulsador.nc", 0, 5, "S0");
  const s1 = poner("pulsador.na", 0, 11, "S1");
  const k1Auxiliar = poner("contactor.auxiliar_na", 10, 11, "K1");
  const k1Bobina = poner("contactor.bobina", 0, 22, "K1");
  const h1 = poner("senalizacion.lampara", 16, 22, "H1");
  const neutro = poner("fuente.neutro", 0, 33, null, 180);
  const neutro2 = opciones.dosNeutros ? poner("fuente.neutro", 16, 33, null, 180) : undefined;

  const tender = (desde: Extremo, hasta: Extremo, codos: [number, number][] = []): string => {
    const hoja = doc.hojas[0]!;
    const indice = indexarHoja(hoja);
    const { problemas } = prepararCable(indice, consultaHoja(hoja, indice), { desde, hasta, codos });
    if (problemas.length > 0) {
      throw new Error(`Marcha-parada: W no dejaría el cable ${JSON.stringify({ desde, hasta, codos })}: ${problemas.map((p) => p.mensaje).join(" ")}`);
    }
    const cmd = cablear(doc, { desde, hasta, codos });
    historial.ejecutar(cmd);
    return cmd.id;
  };
  const borne = (comp: string, nombre: string): Extremo => ({ tipo: "borne", comp, borne: nombre });
  const enCable = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });

  const w1 = tender(borne(fase, "L"), borne(s0, "11"));
  const w2 = tender(borne(s0, "12"), borne(s1, "13"));
  const w3 = tender(borne(s0, "12"), borne(k1Auxiliar, "13"), [[10, 7]]);
  const w4 = tender(borne(s1, "14"), borne(k1Bobina, "A1"));
  const w5 = tender(borne(k1Auxiliar, "14"), borne(s1, "14"));
  const w6 = tender(borne(k1Bobina, "A2"), borne(neutro, "N"));
  const w7 = tender(enCable(w4, 0, 16), borne(h1, "X1"), [[16, 16]]);
  const w8 = neutro2 ? tender(borne(h1, "X2"), borne(neutro2, "N")) : tender(enCable(w6, 0, 28), borne(h1, "X2"), [[16, 28]]);

  const comp: ComponentesMarchaParada = { fase, s0, s1, k1Auxiliar, k1Bobina, h1, neutro };
  if (neutro2) comp.neutro2 = neutro2;
  return { doc, historial, comp, cables: [w1, w2, w3, w4, w5, w6, w7, w8] };
}
