// Circuito de la biblioteca 2 (sección 0 de docs/plan-biblioteca2.md; C1):
// armado solo con comandos, como `inversionPotencia.ts`. Es apoyo de los
// tests y la base `biblioteca2` de `npm run circuito`: el código de la app no
// lo usa.
//
// - Mando en 24 V: la Fase «L1» y el «N» alimentan el primario de T1; el
//   secundario (2U1-2U2) da los 24 V. 2U1 → BN de B1 (sensor inductivo PNP,
//   espejado: BU a la derecha) → BK → B2 (presostato NC, 11-12) → A1 de K1.
//   Un NA de K1 (13-14) lleva 2U1 a A1 de Y1 (electroválvula monoestable).
//   El común (2U2) baja por x = 8 hasta A2 de K1; BU de B1 y A2 de Y1 llegan
//   con una T.
// - A la derecha, en continua: L+ de G1 → otro NA de K1 → A1 de M1 (motor de
//   continua); A2 de M1 vuelve a M de G1.
// - Etiquetas, codos fijos y `prepararCable` contra la hoja de ese momento:
//   si W no dejaría un cable, el armado tira.

import { indexarHoja } from "../model/cables";
import { CambiarEtiqueta, cablear, colocar } from "../model/comandos";
import { crearDocumento, type Documento, type Extremo } from "../model/documento";
import { Historial } from "../model/historial";
import { consultaHoja, prepararCable } from "../model/trazado";
import { buscarSimbolo } from "../symbols";

/** Metadatos fijos: el mismo documento en cada armado (también para el archivo congelado). */
export const META_BIBLIOTECA2 = { titulo: "Circuito de la biblioteca 2", autor: "", fecha: "2026-11-28" } as const;

/** Ids de los componentes, por su papel en el circuito. */
export interface ComponentesBiblioteca2 {
  fase: string;
  neutro: string;
  t1: string;
  b1: string;
  b2: string;
  k1Bobina: string;
  k1AuxiliarY: string;
  y1: string;
  g1: string;
  k1AuxiliarM: string;
  m1: string;
}

export interface Biblioteca2 {
  doc: Documento;
  historial: Historial;
  comp: ComponentesBiblioteca2;
}

export function biblioteca2(): Biblioteca2 {
  const doc = crearDocumento({ ...META_BIBLIOTECA2 });
  const historial = new Historial(doc);

  const poner = (tipo: string, x: number, y: number, etiqueta: string | null, espejado = false): string => {
    const def = buscarSimbolo(tipo);
    if (!def) throw new Error(`Biblioteca 2: no existe el símbolo "${tipo}".`);
    const cmd = colocar(doc, { tipo, x, y, rot: 0, espejado, etiqueta: def.etiquetaInicial ?? "", params: {} });
    historial.ejecutar(cmd);
    if (etiqueta !== null) historial.ejecutar(new CambiarEtiqueta(cmd.id, etiqueta));
    return cmd.id;
  };

  // Mando en 24 V.
  const fase = poner("fuente.fase", 1, 0, "L1");
  const neutro = poner("fuente.neutro", 5, 0, null);
  const t1 = poner("transformador.monofasico", 2, 6, "T1");
  const b1 = poner("sensor.inductivo", 2, 16, "B1", true);
  const b2 = poner("sensor.presostato_nc", 1, 22, "B2");
  const k1Bobina = poner("contactor.bobina", 1, 28, "K1");
  const k1AuxiliarY = poner("contactor.auxiliar_na", 12, 20, "K1");
  const y1 = poner("valvula.monoestable", 15, 26, "Y1");
  // Continua, a la derecha.
  const g1 = poner("fuente.continua", 25, 4, "G1");
  const k1AuxiliarM = poner("contactor.auxiliar_na", 24, 12, "K1");
  const m1 = poner("motor.continua", 24, 20, "M1");

  const tender = (desde: Extremo, hasta: Extremo, codos: [number, number][] = []): string => {
    const hoja = doc.hojas[0]!;
    const indice = indexarHoja(hoja);
    const { problemas } = prepararCable(indice, consultaHoja(hoja, indice), { desde, hasta, codos });
    if (problemas.length > 0) {
      throw new Error(`Biblioteca 2: W no dejaría el cable ${JSON.stringify({ desde, hasta, codos })}: ${problemas.map((p) => p.mensaje).join(" ")}`);
    }
    const cmd = cablear(doc, { desde, hasta, codos });
    historial.ejecutar(cmd);
    return cmd.id;
  };
  const borne = (comp: string, nombre: string): Extremo => ({ tipo: "borne", comp, borne: nombre });
  const enCable = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });

  // Primario de T1.
  tender(borne(fase, "L"), borne(t1, "1U1"));
  tender(borne(neutro, "N"), borne(t1, "1U2"), [
    [5, 2],
    [3, 2],
  ]);
  // 24 V: 2U1 → B1 → B2 → K1; con una T, al NA de K1 que lleva a Y1.
  const w24 = tender(borne(t1, "2U1"), borne(b1, "BN"));
  tender(enCable(w24, 1, 12), borne(k1AuxiliarY, "13"), [[12, 12]]);
  tender(borne(b1, "BK"), borne(b2, "11"));
  tender(borne(b2, "12"), borne(k1Bobina, "A1"));
  tender(borne(k1AuxiliarY, "14"), borne(y1, "A1"));
  // Común: 2U2 baja por x = 8 hasta A2 de K1; BU de B1 y A2 de Y1 llegan con una T.
  const wComun = tender(borne(t1, "2U2"), borne(k1Bobina, "A2"), [
    [3, 10],
    [8, 10],
    [8, 32],
    [1, 32],
  ]);
  tender(borne(b1, "BU"), enCable(wComun, 8, 18));
  tender(borne(y1, "A2"), enCable(wComun, 8, 30), [[12, 30]]);
  // Continua: L+ de G1 → NA de K1 → M1 → M de G1.
  tender(borne(g1, "L+"), borne(k1AuxiliarM, "13"));
  tender(borne(k1AuxiliarM, "14"), borne(m1, "A1"));
  tender(borne(m1, "A2"), borne(g1, "M"), [
    [24, 24],
    [28, 24],
    [28, 8],
    [26, 8],
  ]);

  const comp: ComponentesBiblioteca2 = { fase, neutro, t1, b1, b2, k1Bobina, k1AuxiliarY, y1, g1, k1AuxiliarM, m1 };
  return { doc, historial, comp };
}
