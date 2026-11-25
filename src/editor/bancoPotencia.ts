// Escena de potencia 2000 (fase 6, T37; docs/plan-T37.md, D21-A y D22-A): la
// escena de S6 de «Probar la fase 6». Un circuito de verdad, que se simula:
//  - 95 inversiones de giro con potencia (`inversionPotencia()`: 21 símbolos
//    y 37 cables, mando y potencia con trifásica, Q, K1 y K2 principales, F2
//    y M1),
//  - una celda de 5 (Fase «L1» → fusible → pulsador NA → lámpara → Neutro),
//    para llegar a 2000 justos. Entre L1 y N siempre está la lámpara (carga)
//    y el pulsador está abierto en reposo: no hay falso corto. Su fase es
//    «L1» (la misma red que las L1 de las trifásicas); con «L» avisaría R10.
//
// Como `bancoMando`, las celdas se copian corridas de circuitos armados con
// comandos y W, sin tocarse entre sí: 0 conexiones aparentes (lo prueba
// bancoPotencia.test.ts). Se arma de cero, sin comandos.

import { inversionPotencia } from "../core/circuitos/inversionPotencia";
import { indexarHoja } from "../core/model/cables";
import { CambiarEtiqueta, cablear, colocar } from "../core/model/comandos";
import { crearDocumento, type Documento, type Extremo } from "../core/model/documento";
import { Historial } from "../core/model/historial";
import { consultaHoja, prepararCable } from "../core/model/trazado";
import { buscarSimbolo, type Rotacion } from "../core/symbols";
import { copiar } from "./bancoMando";

/** Cuántas inversiones, cuántas por fila y la separación entre celdas (unidades de grilla). */
export const POTENCIA = { inversiones: 95, porFila: 10, dx: 80, dy: 60 } as const;

export interface InversionBanco {
  /** Ids del pulsador de marcha de cada sentido y de la parada. */
  s1: string;
  s2: string;
  s0: string;
  /** Id del motor. */
  m1: string;
  /** Etiquetas de sus dos bobinas (K1 y K2 de la celda). */
  k1: string;
  k2: string;
}

export interface BancoPotencia {
  doc: Documento;
  /** Las 95 inversiones, en orden. */
  inversiones: InversionBanco[];
  /** La celda de 5: el pulsador y la lámpara. */
  lampara: { pulsador: string; lampara: string; etiqueta: string };
}

/** La celda de 5 (Fase «L1», fusible, pulsador NA, lámpara y Neutro), armada con comandos y W. */
function celdaLampara(): { doc: Documento; comp: { pulsador: string; lampara: string; fusible: string } } {
  const doc = crearDocumento({ titulo: "Celda de 5", autor: "", fecha: "2026-11-25" });
  const historial = new Historial(doc);
  const poner = (tipo: string, x: number, y: number, etiqueta: string | null, rot: Rotacion = 0): string => {
    const def = buscarSimbolo(tipo);
    if (!def) throw new Error(`Banco de potencia: no existe el símbolo "${tipo}".`);
    const cmd = colocar(doc, { tipo, x, y, rot, espejado: false, etiqueta: def.etiquetaInicial ?? "", params: {} });
    historial.ejecutar(cmd);
    if (etiqueta !== null) historial.ejecutar(new CambiarEtiqueta(cmd.id, etiqueta));
    return cmd.id;
  };
  const fase = poner("fuente.fase", 0, 0, "L1");
  const fusible = poner("proteccion.fusible", 0, 4, "F1");
  const pulsador = poner("pulsador.na", 0, 10, "S1");
  const lampara = poner("senalizacion.lampara", 0, 16, "H1");
  const neutro = poner("fuente.neutro", 0, 22, null, 180);
  const borne = (comp: string, nombre: string): Extremo => ({ tipo: "borne", comp, borne: nombre });
  const tender = (desde: Extremo, hasta: Extremo) => {
    const hoja = doc.hojas[0]!;
    const indice = indexarHoja(hoja);
    const { problemas } = prepararCable(indice, consultaHoja(hoja, indice), { desde, hasta, codos: [] });
    if (problemas.length > 0) throw new Error(`Banco de potencia: W no dejaría el cable ${JSON.stringify({ desde, hasta })}: ${problemas.map((p) => p.mensaje).join(" ")}`);
    historial.ejecutar(cablear(doc, { desde, hasta, codos: [] }));
  };
  tender(borne(fase, "L"), borne(fusible, "1"));
  tender(borne(fusible, "2"), borne(pulsador, "13"));
  tender(borne(pulsador, "14"), borne(lampara, "X1"));
  tender(borne(lampara, "X2"), borne(neutro, "N"));
  return { doc, comp: { pulsador, lampara, fusible } };
}

/** La escena de potencia 2000 (D21-A, D22-A). Siempre la misma: sin azar. */
export function bancoPotencia(): BancoPotencia {
  const doc = crearDocumento({ titulo: "Banco de potencia 2000", autor: "", fecha: "2026-11-25" });
  const posicion = (i: number) => ({ x: (i % POTENCIA.porFila) * POTENCIA.dx, y: Math.floor(i / POTENCIA.porFila) * POTENCIA.dy });

  const inv = inversionPotencia();
  const plantilla = inv.doc.hojas[0]!;
  const ids = new Set(plantilla.componentes.map((c) => c.id));
  const c = inv.comp;
  const inversiones: InversionBanco[] = [];
  for (let i = 0; i < POTENCIA.inversiones; i++) {
    const k1 = `K${2 * i + 1}`;
    const k2 = `K${2 * i + 2}`;
    const f2 = `F${2 * i + 2}`;
    const etiquetas = new Map<string, string>([
      [c.f1, `F${2 * i + 1}`],
      [c.f2Contacto, f2],
      [c.f2, f2],
      [c.s0, `S${3 * i}`],
      [c.s1, `S${3 * i + 1}`],
      [c.s2, `S${3 * i + 2}`],
      [c.k1Auxiliar, k1],
      [c.k1AuxiliarNC, k1],
      [c.k1Bobina, k1],
      [c.k1Principal, k1],
      [c.k2Auxiliar, k2],
      [c.k2AuxiliarNC, k2],
      [c.k2Bobina, k2],
      [c.k2Principal, k2],
      [c.h1, `H${2 * i + 1}`],
      [c.h2, `H${2 * i + 2}`],
      [c.q1, `Q${i + 1}`],
      [c.m1, `M${i + 1}`],
    ]);
    const { x, y } = posicion(i);
    const nuevo = copiar(doc, plantilla, ids, x, y, etiquetas);
    inversiones.push({ s0: nuevo.get(c.s0)!, s1: nuevo.get(c.s1)!, s2: nuevo.get(c.s2)!, m1: nuevo.get(c.m1)!, k1, k2 });
  }

  // La celda de 5, en el lugar siguiente.
  const n = POTENCIA.inversiones;
  const celda = celdaLampara();
  const plantillaLampara = celda.doc.hojas[0]!;
  const etiqueta = `H${2 * n + 1}`;
  const { x, y } = posicion(n);
  const nuevo = copiar(
    doc,
    plantillaLampara,
    new Set(plantillaLampara.componentes.map((k) => k.id)),
    x,
    y,
    new Map([
      [celda.comp.fusible, `F${2 * n + 1}`],
      [celda.comp.pulsador, `S${3 * n}`],
      [celda.comp.lampara, etiqueta],
    ]),
  );
  return { doc, inversiones, lampara: { pulsador: nuevo.get(celda.comp.pulsador)!, lampara: nuevo.get(celda.comp.lampara)!, etiqueta } };
}
