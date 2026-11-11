// Gesto de reconectar para medir (T14c): el mismo en el banco (PC) y en la
// prueba automática del menú de desarrollo (netbook), sobre la escena del
// banco con cables (2000 + 3000 cables + 30 T), cuyas 30 derivaciones
// terminan en un extremo libre.
//
// Se elige el extremo libre agarrable con más destinos (bornes y puntos de
// otros cables) a ±RADIO_RECONECTAR unidades: el que más planea. El cursor
// pasa por cada destino en zigzag (en cada paso la previa planea) y se suelta
// en el destino válido más cercano al extremo. Cada punto lleva su clase,
// calculada con el mismo plan que la previa, para separar los tiempos.

import { MENSAJE_SIN_LLEGADA, planearReconexion, type DestinoExtremo, type LadoCable, type ResultadoReconexion } from "../core/model/reconectar";
import { consultaSinCable } from "../core/model/trazado";
import type { Editor } from "./editor";
import { objetivoEn, type Objetivo } from "./objetivo";

/** Medio lado del cuadrado donde se buscan destinos alrededor del extremo, en unidades. */
export const RADIO_RECONECTAR = 6;

/**
 * Cómo queda la previa en un punto: vale; se rechaza después de rutear (un
 * intento con conflictos, o "sin camino": cuesta el ruteo entero); o se
 * rechaza antes, con las reglas del principio (mismo borne, mismo
 * anfitrión, ciclo de apoyos…), que cortan el plan antes de rutear.
 */
export type ClaseReconexion = "valido" | "rechazoRuteado" | "rechazoAntes";

export interface PuntoReconexion {
  x: number;
  y: number;
  clase: ClaseReconexion;
}

export interface GestoReconexion {
  id: string;
  lado: LadoCable;
  /** El extremo libre: donde se aprieta. */
  x: number;
  y: number;
  /** Los destinos alrededor del extremo, en zigzag, sin el de soltar. */
  recorrido: PuntoReconexion[];
  /** Donde se suelta: el destino válido más cercano al extremo; `texto` dice cuál es. */
  soltar: { x: number; y: number; texto: string };
}

/** La clase de un plan de reconexión (ver ClaseReconexion). */
export function claseReconexion(r: ResultadoReconexion): ClaseReconexion {
  if (!r.rechazo) return "valido";
  return r.cable !== null || r.rechazo.motivo === MENSAJE_SIN_LLEGADA ? "rechazoRuteado" : "rechazoAntes";
}

/** El destino de soltar sobre `obj`, como la previa; null si no conecta (vacío o bloqueado). */
function destinoDe(obj: Objetivo): DestinoExtremo | null {
  if (obj.tipo === "borne") return { tipo: "borne", comp: obj.borne.comp, borne: obj.borne.borne };
  if (obj.tipo === "cable") return { tipo: "cable", cable: obj.cable, x: obj.x, y: obj.y };
  return null;
}

/**
 * El gesto de reconectar en la escena de `editor` a `escala` (px por
 * unidad). Tira si ningún extremo libre agarrable tiene un destino válido.
 */
export function gestoReconexion(editor: Editor, escala: number): GestoReconexion {
  const r = RADIO_RECONECTAR;
  interface Destino {
    x: number;
    y: number;
    obj: Objetivo;
    destino: DestinoExtremo;
  }
  const candidatos: { id: string; lado: LadoCable; x: number; y: number; destinos: Destino[] }[] = [];
  for (const w of editor.documento.hojas[0]?.cables ?? []) {
    for (const lado of ["desde", "hasta"] as const) {
      const e = w[lado];
      if (e.tipo !== "libre") continue;
      const a = editor.extremoAgarrable(e.x, e.y, escala);
      if (!a || a.id !== w.id || a.lado !== lado) continue;
      // Como la previa: el objetivo se busca sin el cable que se reconecta.
      const consulta = consultaSinCable(editor.consulta, w.id);
      const destinos: Destino[] = [];
      for (let dy = -r; dy <= r; dy++) {
        // Zigzag: las filas pares de izquierda a derecha, las impares al revés.
        for (let k = -r; k <= r; k++) {
          const x = e.x + ((dy + r) % 2 === 0 ? k : -k);
          const y = e.y + dy;
          const obj = objetivoEn(consulta, x, y, escala);
          const destino = destinoDe(obj);
          if (destino) destinos.push({ x, y, obj, destino });
        }
      }
      candidatos.push({ id: w.id, lado, x: e.x, y: e.y, destinos });
    }
  }
  // El que más destinos tiene; con empate, el primero (sort es estable).
  candidatos.sort((a, b) => b.destinos.length - a.destinos.length);
  for (const c of candidatos) {
    const puntos = c.destinos.map((d) => {
      let clase: ClaseReconexion;
      try {
        clase = claseReconexion(planearReconexion(editor.entornoPlan(), c.id, c.lado, d.destino));
      } catch {
        clase = "rechazoAntes"; // un cable que apunta a algo que no está: la previa no rutea
      }
      return { ...d, clase };
    });
    let mejor: (typeof puntos)[number] | null = null;
    for (const p of puntos) {
      if (p.clase !== "valido") continue;
      if (!mejor || Math.hypot(p.x - c.x, p.y - c.y) < Math.hypot(mejor.x - c.x, mejor.y - c.y)) mejor = p;
    }
    if (!mejor) continue;
    const texto = mejor.obj.tipo === "borne" ? `${mejor.obj.borne.nombre} · ${mejor.obj.borne.borne}` : `una T sobre ${mejor.destino.tipo === "cable" ? mejor.destino.cable : "?"}`;
    return {
      id: c.id,
      lado: c.lado,
      x: c.x,
      y: c.y,
      recorrido: puntos.filter((p) => p !== mejor).map(({ x, y, clase }) => ({ x, y, clase })),
      soltar: { x: mejor.x, y: mejor.y, texto },
    };
  }
  throw new Error(`Ningún extremo libre agarrable tiene un destino válido a ±${r} u: no se mide reconectar.`);
}

/** Cuántos puntos del recorrido hay de cada clase. */
export function clasesDelRecorrido(g: GestoReconexion): Record<ClaseReconexion, number> {
  const n: Record<ClaseReconexion, number> = { valido: 0, rechazoRuteado: 0, rechazoAntes: 0 };
  for (const p of g.recorrido) n[p.clase]++;
  return n;
}
