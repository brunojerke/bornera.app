// Documento del banco de pruebas: los mismos componentes que la escena del
// banco (render/banco.ts), pero en un Documento, para abrirlo en un Editor y
// poder seleccionar, colocar y deshacer con 2000 símbolos (Ctrl+Shift+B).
//
// Se arma de cero, como al abrir un archivo: no es un cambio a un documento
// que ya existe, por eso no pasa por comandos (no hay nada que deshacer).

import { borneDe } from "../core/model/cables";
import { crearDocumento, generarId, PREFIJO_CABLE, type Componente, type Documento } from "../core/model/documento";
import { buscarSimbolo, type Borne, type Direccion } from "../core/symbols";
import { azar, generarBanco, PASO_BANCO } from "../render/banco";

export function documentoBanco(cantidad: number, semilla = 1): Documento {
  const doc = crearDocumento({ titulo: `Banco de ${cantidad}`, autor: "", fecha: "2026-01-01" });
  doc.hojas[0]!.componentes = generarBanco(cantidad, semilla).map((c) => ({
    id: generarId(doc),
    tipo: c.def.tipo,
    x: c.x,
    y: c.y,
    rot: c.rotacion,
    espejado: c.espejado,
    etiqueta: c.etiqueta ?? "",
    params: {},
  }));
  return doc;
}

/**
 * Componentes del centro de la escena con cables que quedan sin cables: el
 * grupo que se puede arrastrar mientras mover lo cableado está bloqueado
 * (hasta T14a). Son los mismos 40 del diagnóstico del arrastre.
 */
export const SIN_CABLES_BANCO = 40;

/** Cables por componente en la escena con cables. */
export const CABLES_POR_COMPONENTE = 1.5;

const VECTOR: Record<Direccion, readonly [number, number]> = {
  derecha: [1, 0],
  izquierda: [-1, 0],
  abajo: [0, 1],
  arriba: [0, -1],
};

/**
 * Recorrido ortogonal de `a` a `b`: sale una unidad en la dirección de cada
 * borne y los une con una L. Se sacan los puntos repetidos y los que quedan
 * en el medio de una recta (así no hay largo cero ni vueltas de 180°).
 * Devuelve los codos (sin los extremos). Solo para el banco: el ruteo de
 * verdad es de la herramienta cable (T13).
 */
export function codosBanco(a: Borne, b: Borne): [number, number][] {
  const [ax, ay] = VECTOR[a.direccion];
  const [bx, by] = VECTOR[b.direccion];
  const p: [number, number][] = [
    [a.x, a.y],
    [a.x + ax, a.y + ay],
    [b.x + bx, a.y + ay],
    [b.x + bx, b.y + by],
    [b.x, b.y],
  ];
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (let i = 1; i < p.length; i++) {
      if (p[i]![0] === p[i - 1]![0] && p[i]![1] === p[i - 1]![1]) {
        // Repetido: se saca el de adentro (nunca un extremo).
        p.splice(i === p.length - 1 ? i - 1 : i, 1);
        cambio = true;
        break;
      }
    }
    if (cambio) continue;
    for (let i = 1; i + 1 < p.length; i++) {
      const [x0, y0] = p[i - 1]!;
      const [x1, y1] = p[i]!;
      const [x2, y2] = p[i + 1]!;
      if ((x0 === x1 && x1 === x2) || (y0 === y1 && y1 === y2)) {
        p.splice(i, 1);
        cambio = true;
        break;
      }
    }
  }
  return p.slice(1, -1);
}

/**
 * El documento del banco con cables: CABLES_POR_COMPONENTE × `cantidad`
 * cables entre bornes de componentes vecinos (a la derecha y abajo), con 0 a
 * 3 codos. Los SIN_CABLES_BANCO componentes más cercanos al centro quedan
 * sin cables. Mismo azar con la misma semilla.
 */
export function documentoBancoCables(cantidad: number, semilla = 1): Documento {
  const doc = documentoBanco(cantidad, semilla);
  doc.meta.titulo = `Banco de ${cantidad} con cables`;
  const hoja = doc.hojas[0]!;
  const comps = hoja.componentes;
  const rnd = azar(semilla + 1);
  const clave = (x: number, y: number) => `${x},${y}`;
  const enPos = new Map<string, Componente>();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of comps) {
    enPos.set(clave(c.x, c.y), c);
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x);
    y1 = Math.max(y1, c.y);
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const d = (c: Componente) => (c.x - cx) ** 2 + (c.y - cy) ** 2;
  const sinCables = new Set([...comps].sort((a, b) => d(a) - d(b)).slice(0, SIN_CABLES_BANCO).map((c) => c.id));

  const objetivo = Math.round(cantidad * CABLES_POR_COMPONENTE);
  const bornes = (c: Componente) => (buscarSimbolo(c.tipo)?.bornes ?? []).map((b) => borneDe(c, b.nombre)!);
  const usados = new Set<string>();
  // Hasta tres pasadas: si con una no se llega, otro par de bornes de los mismos vecinos.
  for (let pasada = 0; pasada < 3; pasada++) for (const a of comps) {
    if (hoja.cables.length >= objetivo) break;
    if (sinCables.has(a.id)) continue;
    for (const [dx, dy] of [[PASO_BANCO, 0], [0, PASO_BANCO]] as const) {
      if (hoja.cables.length >= objetivo) break;
      const b = enPos.get(clave(a.x + dx, a.y + dy));
      if (!b || sinCables.has(b.id)) continue;
      const ba = bornes(a);
      const bb = bornes(b);
      if (ba.length === 0 || bb.length === 0) continue;
      const desde = ba[Math.floor(rnd() * ba.length)]!;
      const hasta = bb[Math.floor(rnd() * bb.length)]!;
      // Un borne puede tener varios cables, pero no el mismo par dos veces.
      const par = `${a.id}.${desde.nombre}-${b.id}.${hasta.nombre}`;
      if (usados.has(par)) continue;
      usados.add(par);
      hoja.cables.push({
        id: generarId(doc, PREFIJO_CABLE),
        desde: { tipo: "borne", comp: a.id, borne: desde.nombre },
        hasta: { tipo: "borne", comp: b.id, borne: hasta.nombre },
        codos: codosBanco(desde, hasta),
      });
    }
  }
  return doc;
}
