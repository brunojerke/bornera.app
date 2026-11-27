// Dibujo del estado de una simulación (T33; docs/plan-T33.md): de una
// `Simulacion` del motor a lo que dibuja la escena.
//
// - Cables por potencial (D9-B, C-A): la clase de cada red. Una red sin
//   potencial va con el color de Editar (ajuste 3); la red en corto de la
//   detención, en `--conflicto` (M-A).
// - Componentes: el contacto accionado (NA que conduce, NC que no), la
//   electroválvula en 14 (T40) con la válvula corrida y sin relleno, la carga
//   encendida (lámpara o bobina con tensión) y, con la simulación detenida
//   por oscilación, las bobinas que oscilan (M-A).
// - Cada cambio toca solo lo que cambió (D8-A): `aplicarDibujo` compara el
//   dibujo de antes con el nuevo y devuelve las cajas a rehacer.
//
// Sin DOM ni reloj: se prueba en Node.

import type { Simulacion } from "../core/sim/motor";
import type { Caja } from "../render/camara";
import { CLASE_CORTO, CLASE_EDITAR, CLASE_FASE, CLASE_NEUTRO, type ClaseCable, type EscenaEditable } from "../render/escenaEditable";

/** El estado de un componente para dibujarlo. */
export interface EstadoDibujo {
  accionado: boolean;
  encendido: boolean;
  marcado: boolean;
}

const REPOSO: EstadoDibujo = { accionado: false, encendido: false, marcado: false };

/** Lo que dibuja la escena de una simulación. */
export interface DibujoSimulacion {
  /** Clase de cada red de la netlist (`netlist.redes`). */
  readonly clases: readonly ClaseCable[];
  /** Los componentes con algo que dibujar; los que no están, en reposo. */
  readonly componentes: ReadonlyMap<string, EstadoDibujo>;
  /** Cables de cada red (los de la netlist). */
  readonly cables: readonly (readonly string[])[];
}

/** El dibujo de `sim`. */
export function dibujoDe(sim: Simulacion): DibujoSimulacion {
  const n = sim.netlist;
  const d = sim.detenida;
  const corto = new Set(d?.tipo === "corto" ? d.redes : []);
  const clases = n.redes.map((_, i): ClaseCable => {
    if (corto.has(i)) return CLASE_CORTO;
    const p = sim.potencialDeRed[i];
    if (p === null || p === undefined) return CLASE_EDITAR;
    return n.potenciales[p]!.papel === "fase" ? CLASE_FASE : CLASE_NEUTRO;
  });

  const componentes = new Map<string, EstadoDibujo>();
  const estado = (comp: string) => {
    let e = componentes.get(comp);
    if (!e) componentes.set(comp, (e = { ...REPOSO }));
    return e;
  };
  // NA accionado: conduce; NC accionado: no conduce.
  n.contactos.forEach((c, i) => {
    if (sim.conducen[i] === c.na) estado(c.comp).accionado = true;
  });
  // Electroválvulas (T40, D-T40-1 A): accionadas según su posición y sin relleno; la bobina con
  // tensión se ve en el color de sus cables.
  const deValvula = n.valvulas.length > 0 ? new Set(n.valvulas.flatMap((v) => [v.a, v.b])) : null;
  n.cargas.forEach((c, i) => {
    if (sim.encendidas[i] && !deValvula?.has(i)) estado(c.comp).encendido = true;
  });
  n.valvulas.forEach((v, i) => {
    if (sim.posiciones[i]) estado(v.comp).accionado = true;
  });
  if (d?.tipo === "oscila") {
    const oscilan = new Set(d.etiquetas);
    for (const b of n.bobinas) if (oscilan.has(b.etiqueta)) for (const k of b.cargas) estado(n.cargas[k]!.comp).marcado = true;
  }
  return { clases, componentes, cables: n.redes.map((r) => r.cables) };
}

/**
 * Lleva la escena de `antes` (null: como en Editar) a `despues` y devuelve
 * las cajas que cambiaron (D8-A). Con `antes` null no junta cajas: quien
 * entra a Simular rehace la escena entera (I-A).
 */
export function aplicarDibujo(escena: EscenaEditable, antes: DibujoSimulacion | null, despues: DibujoSimulacion): Caja[] {
  const cajas: Caja[] = [];
  const juntar = antes !== null;
  despues.clases.forEach((clase, i) => {
    if (antes ? antes.clases[i] === clase : clase === CLASE_EDITAR) return;
    for (const id of despues.cables[i]!) {
      const k = escena.claseCable(id, clase);
      if (juntar) cajas.push(...k);
    }
  });
  const poner = (id: string, e: EstadoDibujo) => {
    const k = escena.estadoComponente(id, e);
    if (juntar) cajas.push(...k);
  };
  for (const [id, e] of despues.componentes) {
    const a = antes?.componentes.get(id) ?? REPOSO;
    if (a.accionado !== e.accionado || a.encendido !== e.encendido || a.marcado !== e.marcado) poner(id, e);
  }
  if (antes) for (const id of antes.componentes.keys()) if (!despues.componentes.has(id)) poner(id, REPOSO);
  return cajas;
}
