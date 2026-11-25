// Inversión de giro con potencia (fase 6, sección 0; T36): el circuito de
// aceptación de 6a, armado solo con comandos, como `inversion.ts`. Es apoyo
// de los tests: el código de la app no lo usa.
//
// - Mando: la inversión del cierre 3b (`inversion.ts`) corrida 12 hacia abajo,
//   con el fusible F1 y el 95-96 del térmico F2 entre la fase y S0. La fase es
//   «L1»: con la trifásica en la hoja, una Fase «L» avisaría (R10). El neutro
//   «N» es el de abajo, como en la 3b.
// - Potencia, a la derecha: trifásica → Q1 (termomagnética 3P) → K1 y K2
//   (principales) → F2 (térmico) → M1. K1 pasa L1, L2 y L3 derecho; K2 cruza
//   L1 y L3 (L1 a W, L3 a U): el otro sentido. Las entradas de K2 salen con
//   una T de los cables Q1–K1 y sus salidas llegan con una T a los de K1–F2.
// - Etiquetas, codos fijos y `prepararCable` contra la hoja de ese momento:
//   si W no dejaría un cable, el armado tira.

import { indexarHoja } from "../model/cables";
import { CambiarEtiqueta, cablear, colocar } from "../model/comandos";
import { crearDocumento, type Documento, type Extremo } from "../model/documento";
import { Historial } from "../model/historial";
import { consultaHoja, prepararCable } from "../model/trazado";
import { buscarSimbolo, type Rotacion } from "../symbols";

/** Metadatos fijos: el mismo documento en cada armado (también para el archivo congelado). */
export const META_INVERSION_POTENCIA = { titulo: "Inversión de giro con potencia", autor: "", fecha: "2026-11-25" } as const;

/** Cuánto baja el mando respecto de `inversion.ts`: lugar para F1 y el 95-96. */
const DY = 12;
/** Rama de K2 del mando, como en `inversion.ts`. */
const DX = 21;

/** Ids de los componentes, por su papel en el circuito. */
export interface ComponentesInversionPotencia {
  fase: string;
  f1: string;
  /** 95-96 del térmico F2, en el mando. */
  f2Contacto: string;
  s0: string;
  s1: string;
  k1Auxiliar: string;
  k2AuxiliarNC: string;
  k1Bobina: string;
  h1: string;
  s2: string;
  k2Auxiliar: string;
  k1AuxiliarNC: string;
  k2Bobina: string;
  h2: string;
  neutro: string;
  trifasica: string;
  q1: string;
  k1Principal: string;
  k2Principal: string;
  f2: string;
  m1: string;
}

export interface InversionPotencia {
  doc: Documento;
  historial: Historial;
  comp: ComponentesInversionPotencia;
}

export function inversionPotencia(): InversionPotencia {
  const doc = crearDocumento({ ...META_INVERSION_POTENCIA });
  const historial = new Historial(doc);

  const poner = (tipo: string, x: number, y: number, etiqueta: string | null, rot: Rotacion = 0): string => {
    const def = buscarSimbolo(tipo);
    if (!def) throw new Error(`Inversión con potencia: no existe el símbolo "${tipo}".`);
    const cmd = colocar(doc, { tipo, x, y, rot, espejado: false, etiqueta: def.etiquetaInicial ?? "", params: {} });
    historial.ejecutar(cmd);
    if (etiqueta !== null) historial.ejecutar(new CambiarEtiqueta(cmd.id, etiqueta));
    return cmd.id;
  };

  // Mando.
  const fase = poner("fuente.fase", 0, 0, "L1");
  const f1 = poner("proteccion.fusible", 0, 4, "F1");
  const f2Contacto = poner("termico.contacto_nc", 0, 10, "F2");
  const s0 = poner("pulsador.nc", 0, 5 + DY, "S0");
  const s1 = poner("pulsador.na", 0, 11 + DY, "S1");
  const k1Auxiliar = poner("contactor.auxiliar_na", 10, 11 + DY, "K1");
  const k2AuxiliarNC = poner("contactor.auxiliar_nc", 0, 17 + DY, "K2");
  const k1Bobina = poner("contactor.bobina", 0, 28 + DY, "K1");
  const h1 = poner("senalizacion.lampara", 16, 28 + DY, "H1");
  const s2 = poner("pulsador.na", DX, 11 + DY, "S2");
  const k2Auxiliar = poner("contactor.auxiliar_na", DX + 10, 11 + DY, "K2");
  const k1AuxiliarNC = poner("contactor.auxiliar_nc", DX, 17 + DY, "K1");
  const k2Bobina = poner("contactor.bobina", DX, 28 + DY, "K2");
  const h2 = poner("senalizacion.lampara", DX + 16, 28 + DY, "H2");
  const neutro = poner("fuente.neutro", 0, 39 + DY, null, 180);
  // Potencia: polos en x 58, 60 y 62 (K2 en 68, 70 y 72).
  const trifasica = poner("fuente.trifasica", 60, 0, null);
  const q1 = poner("proteccion.termomagnetica_tripolar", 60, 6, "Q1");
  const k1Principal = poner("contactor.principal", 60, 18, "K1");
  const k2Principal = poner("contactor.principal", 70, 18, "K2");
  const f2 = poner("proteccion.termico", 60, 26, "F2");
  const m1 = poner("motor.trifasico", 60, 32, "M1");

  const tender = (desde: Extremo, hasta: Extremo, codos: [number, number][] = []): string => {
    const hoja = doc.hojas[0]!;
    const indice = indexarHoja(hoja);
    const { problemas } = prepararCable(indice, consultaHoja(hoja, indice), { desde, hasta, codos });
    if (problemas.length > 0) {
      throw new Error(`Inversión con potencia: W no dejaría el cable ${JSON.stringify({ desde, hasta, codos })}: ${problemas.map((p) => p.mensaje).join(" ")}`);
    }
    const cmd = cablear(doc, { desde, hasta, codos });
    historial.ejecutar(cmd);
    return cmd.id;
  };
  const borne = (comp: string, nombre: string): Extremo => ({ tipo: "borne", comp, borne: nombre });
  const enCable = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });

  // Mando: la fase, F1 y el 95-96 hasta S0.
  tender(borne(fase, "L"), borne(f1, "1"));
  tender(borne(f1, "2"), borne(f2Contacto, "95"));
  tender(borne(f2Contacto, "96"), borne(s0, "11"));
  // Rama de K1 (la de `inversion.ts`, corrida DY).
  tender(borne(s0, "12"), borne(s1, "13"));
  const w3 = tender(borne(s0, "12"), borne(k1Auxiliar, "13"), [[10, 7 + DY]]);
  tender(borne(s1, "14"), borne(k2AuxiliarNC, "21"));
  tender(borne(k1Auxiliar, "14"), borne(s1, "14"));
  const w6 = tender(borne(k2AuxiliarNC, "22"), borne(k1Bobina, "A1"));
  const w7 = tender(borne(k1Bobina, "A2"), borne(neutro, "N"));
  tender(enCable(w6, 0, 22 + DY), borne(h1, "X1"), [[16, 22 + DY]]);
  tender(enCable(w7, 0, 34 + DY), borne(h1, "X2"), [[16, 34 + DY]]);
  // Rama de K2.
  tender(borne(s2, "14"), borne(k1AuxiliarNC, "21"));
  tender(borne(k2Auxiliar, "14"), borne(s2, "14"));
  const w12 = tender(borne(k1AuxiliarNC, "22"), borne(k2Bobina, "A1"));
  tender(enCable(w12, DX, 22 + DY), borne(h2, "X1"), [[DX + 16, 22 + DY]]);
  const w14 = tender(borne(s2, "13"), borne(k2Auxiliar, "13"), [
    [DX, 7 + DY],
    [DX + 10, 7 + DY],
  ]);
  tender(enCable(w3, 10, 8 + DY), enCable(w14, DX, 8 + DY));
  const w16 = tender(borne(h2, "X2"), enCable(w7, 0, 36 + DY), [[DX + 16, 36 + DY]]);
  tender(borne(k2Bobina, "A2"), enCable(w16, DX, 36 + DY));

  // Potencia: trifásica → Q1 → K1.
  for (const [l, q] of [
    ["L1", "1"],
    ["L2", "3"],
    ["L3", "5"],
  ] as const)
    tender(borne(trifasica, l), borne(q1, q));
  const qk = [
    tender(borne(q1, "2"), borne(k1Principal, "1")),
    tender(borne(q1, "4"), borne(k1Principal, "3")),
    tender(borne(q1, "6"), borne(k1Principal, "5")),
  ];
  // Entradas de K2: una T por fase, cada una a su altura (y 10, 11 y 12).
  tender(enCable(qk[0]!, 58, 10), borne(k2Principal, "1"), [[68, 10]]);
  tender(enCable(qk[1]!, 60, 11), borne(k2Principal, "3"), [[70, 11]]);
  tender(enCable(qk[2]!, 62, 12), borne(k2Principal, "5"), [[72, 12]]);
  // K1 → F2, derecho.
  const kf = [
    tender(borne(k1Principal, "2"), borne(f2, "1")),
    tender(borne(k1Principal, "4"), borne(f2, "3")),
    tender(borne(k1Principal, "6"), borne(f2, "5")),
  ];
  // Salidas de K2, cruzadas: L1 (2) a F2·5, L2 (4) a F2·3, L3 (6) a F2·1.
  tender(borne(k2Principal, "2"), enCable(kf[2]!, 62, 23), [[68, 23]]);
  tender(borne(k2Principal, "4"), enCable(kf[1]!, 60, 22), [[70, 22]]);
  tender(borne(k2Principal, "6"), enCable(kf[0]!, 58, 21), [[72, 21]]);
  // F2 → M1.
  tender(borne(f2, "2"), borne(m1, "U"));
  tender(borne(f2, "4"), borne(m1, "V"));
  tender(borne(f2, "6"), borne(m1, "W"));

  const comp: ComponentesInversionPotencia = {
    fase,
    f1,
    f2Contacto,
    s0,
    s1,
    k1Auxiliar,
    k2AuxiliarNC,
    k1Bobina,
    h1,
    s2,
    k2Auxiliar,
    k1AuxiliarNC,
    k2Bobina,
    h2,
    neutro,
    trifasica,
    q1,
    k1Principal,
    k2Principal,
    f2,
    m1,
  };
  return { doc, historial, comp };
}
