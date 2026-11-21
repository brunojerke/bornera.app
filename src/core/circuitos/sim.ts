// Circuitos de la simulación (T30, M4-A): oscilante, corto, carrera y cadena,
// armados solo con comandos, como `inversion.ts`. Son apoyo de los tests y de
// los `.brn` congelados de `tests/circuitos/sim.mjs`: el código de la app no
// los usa. Criterio en docs/plan-T30.md.
//
// Cada rama es una columna: Fase «L» arriba, sus elementos de dos bornes cada
// 6 unidades (desde la fila `fila`) y un Neutro «N» abajo, unidos por cables rectos. Las ramas se
// unen por etiqueta de red (las Fase «L» y los Neutro «N» de cada columna) o,
// en la carrera, con un cable en T. Si W no dejaría un cable, el armado tira.
//
// - oscilante: L – K1 (NC) – bobina K1 – N. Al entrar oscila.
// - corto: L – S1 (NA) – N, y aparte L – H1 – N. Al pulsar S1, corto (M5-A).
// - carrera: L – S1 (NA) y de ahí dos ramas, K2 (NC) – bobina K1 y K1 (NC) –
//   bobina K2. Al pulsar S1: «Carrera entre K1 y K2», queda K1.
// - cadena: S1 (NA) – bobina K1; K1 (NA) – bobina K2; … hasta K5.

import { indexarHoja } from "../model/cables";
import { CambiarEtiqueta, cablear, colocar } from "../model/comandos";
import { crearDocumento, type Documento, type Extremo } from "../model/documento";
import { Historial } from "../model/historial";
import { consultaHoja, prepararCable } from "../model/trazado";
import { buscarSimbolo } from "../symbols";

export type NombreCircuitoSim = "oscilante" | "corto" | "carrera" | "cadena";

export const CIRCUITOS_SIM: readonly NombreCircuitoSim[] = ["oscilante", "corto", "carrera", "cadena"];

/** Metadatos fijos: el mismo documento en cada armado (también para el archivo congelado). */
export const META_SIM: Readonly<Record<NombreCircuitoSim, { titulo: string; autor: string; fecha: string }>> = {
  oscilante: { titulo: "Oscilante", autor: "", fecha: "2026-11-21" },
  corto: { titulo: "Corto", autor: "", fecha: "2026-11-21" },
  carrera: { titulo: "Carrera", autor: "", fecha: "2026-11-21" },
  cadena: { titulo: "Cadena", autor: "", fecha: "2026-11-21" },
};

export interface CircuitoSim {
  doc: Documento;
  historial: Historial;
  /** Ids de los componentes por un nombre corto: "s1", "k1", "k1nc", "h1"… */
  comp: Record<string, string>;
}

/** Un elemento de una columna: tipo, etiqueta y nombre corto para `comp`. */
type Elemento = [tipo: string, etiqueta: string, nombre: string];

/** Separación entre columnas. */
const DX = 10;

function armar(nombre: NombreCircuitoSim, columnas: { fase: boolean; elementos: Elemento[]; fila?: number }[], extra?: (h: Herramientas) => void): CircuitoSim {
  const doc = crearDocumento({ ...META_SIM[nombre] });
  const historial = new Historial(doc);
  const comp: Record<string, string> = {};

  const poner = (tipo: string, x: number, y: number, etiqueta: string | null, rot: 0 | 180 = 0): string => {
    const def = buscarSimbolo(tipo);
    if (!def) throw new Error(`${nombre}: no existe el símbolo "${tipo}".`);
    const cmd = colocar(doc, { tipo, x, y, rot, espejado: false, etiqueta: def.etiquetaInicial ?? "", params: {} });
    historial.ejecutar(cmd);
    if (etiqueta !== null) historial.ejecutar(new CambiarEtiqueta(cmd.id, etiqueta));
    return cmd.id;
  };
  const tender = (desde: Extremo, hasta: Extremo, codos: [number, number][] = []): string => {
    const hoja = doc.hojas[0]!;
    const indice = indexarHoja(hoja);
    const { problemas } = prepararCable(indice, consultaHoja(hoja, indice), { desde, hasta, codos });
    if (problemas.length > 0) {
      throw new Error(`${nombre}: W no dejaría el cable ${JSON.stringify({ desde, hasta, codos })}: ${problemas.map((p) => p.mensaje).join(" ")}`);
    }
    const cmd = cablear(doc, { desde, hasta, codos });
    historial.ejecutar(cmd);
    return cmd.id;
  };
  const borne = (c: string, b: string): Extremo => ({ tipo: "borne", comp: c, borne: b });
  const enCable = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });

  // Colocar todo primero y cablear después, columna por columna.
  const tramos: { x: number; ids: string[]; fase?: string; neutro: string }[] = [];
  columnas.forEach((col, i) => {
    const x = i * DX;
    const fase = col.fase ? poner("fuente.fase", x, 0, null) : undefined;
    const fila = col.fila ?? 0;
    const ids = col.elementos.map(([tipo, etiqueta, n], j) => (comp[n] = poner(tipo, x, 5 + 6 * (fila + j), etiqueta)));
    const neutro = poner("fuente.neutro", x, 6 * (fila + col.elementos.length) + 4, null, 180);
    if (fase) comp[`l${i + 1}`] = fase;
    comp[`n${i + 1}`] = neutro;
    tramos.push({ x, ids, fase, neutro });
  });
  const cables: Record<string, string> = {};
  for (const t of tramos) {
    const bornesDe = (id: string) => buscarSimbolo(doc.hojas[0]!.componentes.find((c) => c.id === id)!.tipo)!.bornes.map((b) => b.nombre);
    if (t.fase) cables[`${t.ids[0]}:arriba`] = tender(borne(t.fase, "L"), borne(t.ids[0]!, bornesDe(t.ids[0]!)[0]!));
    t.ids.forEach((id, j) => {
      const abajo = bornesDe(id)[1]!;
      const siguiente = t.ids[j + 1];
      if (siguiente) cables[`${id}:abajo`] = tender(borne(id, abajo), borne(siguiente, bornesDe(siguiente)[0]!));
      else tender(borne(id, abajo), borne(t.neutro, "N"));
    });
  }
  extra?.({ tender, borne, enCable, comp, cables });
  return { doc, historial, comp };
}

interface Herramientas {
  tender: (desde: Extremo, hasta: Extremo, codos?: [number, number][]) => string;
  borne: (c: string, b: string) => Extremo;
  enCable: (cable: string, x: number, y: number) => Extremo;
  comp: Record<string, string>;
  /** Cable que sale por abajo de cada elemento hacia el siguiente: `${id}:abajo`. */
  cables: Record<string, string>;
}

export function oscilante(): CircuitoSim {
  return armar("oscilante", [
    {
      fase: true,
      elementos: [
        ["contactor.auxiliar_nc", "K1", "k1nc"],
        ["contactor.bobina", "K1", "k1"],
      ],
    },
  ]);
}

export function corto(): CircuitoSim {
  return armar("corto", [
    { fase: true, elementos: [["pulsador.na", "S1", "s1"]] },
    { fase: true, elementos: [["senalizacion.lampara", "H1", "h1"]] },
  ]);
}

export function carrera(): CircuitoSim {
  return armar(
    "carrera",
    [
      {
        fase: true,
        elementos: [
          ["pulsador.na", "S1", "s1"],
          ["contactor.auxiliar_nc", "K2", "k2nc"],
          ["contactor.bobina", "K1", "k1"],
        ],
      },
      {
        fase: false,
        fila: 1,
        elementos: [
          ["contactor.auxiliar_nc", "K1", "k1nc"],
          ["contactor.bobina", "K2", "k2"],
        ],
      },
    ],
    // S1·14 (y = 7) a K2·21 (y = 9): una T a la altura 8 lleva S1 a K1·21 de la otra columna.
    ({ tender, borne, enCable, comp, cables }) => {
      tender(enCable(cables[`${comp["s1"]}:abajo`]!, 0, 8), borne(comp["k1nc"]!, "21"), [[DX, 8]]);
    },
  );
}

/** Cantidad de bobinas de la cadena. */
export const BOBINAS_CADENA = 5;

export function cadena(): CircuitoSim {
  return armar(
    "cadena",
    Array.from({ length: BOBINAS_CADENA }, (_, i) => ({
      fase: true,
      elementos: [
        i === 0 ? (["pulsador.na", "S1", "s1"] as Elemento) : (["contactor.auxiliar_na", `K${i}`, `k${i}na`] as Elemento),
        ["contactor.bobina", `K${i + 1}`, `k${i + 1}`] as Elemento,
      ],
    })),
  );
}

export const ARMADOS_SIM: Readonly<Record<NombreCircuitoSim, () => CircuitoSim>> = { oscilante, corto, carrera, cadena };
