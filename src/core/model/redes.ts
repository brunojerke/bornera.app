// Redes (T15): los bornes y los cables unidos por cables, agrupados con
// union-find. Es el paso 1 de la simulación (docs/arquitectura.md, "Motor de
// simulación"), sin simular: un contacto no une sus dos bornes, ni una carga.
//
// - Un cable une sus extremos conectados: un borne o, en una T, su anfitrión
//   (lo mismo que `nodoExtremo`). Un extremo libre no conecta, aunque caiga
//   sobre un borne o sobre un cable.
// - La geometría no cuenta: dos tramos que se cruzan o se enciman no se unen.
//   Avisar de esas conexiones aparentes es de la fase 4 ("Verificación de
//   conexiones aparentes" en docs/plan-fase3.md).
// - Cada borne de un componente está en una red, aunque no tenga cables.
// - Lo que no existe no conecta: un extremo hacia un componente, un borne o
//   un cable que no está (un documento roto) no une nada y no tira excepción.
//
// Nombres de red: en Fase y Neutro (fuentes de un solo borne), la etiqueta
// del componente normalizada (sin espacios a los lados y en mayúsculas); una
// etiqueta vacía no da nombre. `redes` une por nombre solo si se pide
// (`unirPorNombre`), como etiquetas de red; `porNombre` anota qué redes se
// unirían. Las fuentes de varios bornes (la trifásica, con el nombre de cada
// borne) se suman cuando existan.
//
// Se calcula del documento y no se guarda. Recorre la hoja entera: es para
// entrar a simular y para los tests, no para cada cuadro.

import { buscarSimbolo } from "../symbols";
import type { Hoja } from "./documento";
import { normalizarEtiqueta } from "./etiquetas";

/** Un borne de un componente. */
export interface BorneRed {
  comp: string;
  borne: string;
}

/** Una red: lo que queda unido por cables (y, si se pide, por nombre). */
export interface Red {
  /** Bornes, en el orden de la hoja: por componente y, dentro de él, como en su definición. */
  bornes: BorneRed[];
  /** Ids de los cables, en el orden de la hoja. */
  cables: string[];
  /** Nombres de red de sus alimentaciones, normalizados, ordenados y sin repetir. */
  nombres: string[];
}

export interface OpcionesRedes {
  /** Unir las redes que comparten un nombre, como etiquetas de red. Por defecto, no. */
  unirPorNombre?: boolean;
}

/** Lo que es cada nodo del union-find. `nombre` vacío: sin nombre de red. */
type Nodo = { tipo: "borne"; comp: string; borne: string; nombre: string } | { tipo: "cable"; id: string };

/** Orden por unidades de código: el mismo en cualquier idioma del sistema. */
function compararTexto(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Las redes de la hoja. Van en el orden de su primer borne en la hoja; las que
 * no tienen bornes (cables con los dos extremos libres, o solo con T entre
 * ellos), al final, en el orden de sus cables.
 */
export function redes(hoja: Hoja, opciones: OpcionesRedes = {}): Red[] {
  const nodos: Nodo[] = [];
  const padre: number[] = [];
  const nuevo = (n: Nodo): number => {
    padre.push(nodos.length);
    nodos.push(n);
    return nodos.length - 1;
  };
  const raiz = (i: number): number => {
    while (padre[i] !== i) {
      // Acorta el camino a la mitad para la próxima.
      padre[i] = padre[padre[i]!]!;
      i = padre[i]!;
    }
    return i;
  };
  const unir = (a: number, b: number): void => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  // Los bornes primero, en el orden de la hoja.
  const bornes = new Map<string, Map<string, number>>();
  for (const c of hoja.componentes) {
    const def = buscarSimbolo(c.tipo);
    // Un símbolo desconocido no tiene bornes conocidos (y ningún cable puede llegarle: T15a lo rechaza).
    if (!def) continue;
    const nombre = def.elemento === "fuente" && def.bornes.length === 1 ? normalizarEtiqueta(c.etiqueta) : "";
    let delComp = bornes.get(c.id);
    if (!delComp) bornes.set(c.id, (delComp = new Map()));
    for (const b of def.bornes) {
      if (!delComp.has(b.nombre)) delComp.set(b.nombre, nuevo({ tipo: "borne", comp: c.id, borne: b.nombre, nombre }));
    }
  }

  // Después los cables, y recién entonces sus extremos (una T puede apoyarse en un cable que viene después).
  const cables = new Map<string, number>();
  const nodoCable = hoja.cables.map((w) => {
    const n = nuevo({ tipo: "cable", id: w.id });
    if (!cables.has(w.id)) cables.set(w.id, n);
    return n;
  });
  hoja.cables.forEach((w, i) => {
    for (const e of [w.desde, w.hasta]) {
      const otro = e.tipo === "borne" ? bornes.get(e.comp)?.get(e.borne) : e.tipo === "cable" ? cables.get(e.cable) : undefined;
      if (otro !== undefined) unir(nodoCable[i]!, otro);
    }
  });

  if (opciones.unirPorNombre) {
    const primero = new Map<string, number>();
    nodos.forEach((n, i) => {
      if (n.tipo !== "borne" || n.nombre === "") return;
      const p = primero.get(n.nombre);
      if (p === undefined) primero.set(n.nombre, i);
      else unir(p, i);
    });
  }

  // Cada red sale cuando aparece su primer nodo: bornes antes que cables, cada uno en el orden de la hoja.
  const porRaiz = new Map<number, Red>();
  const salida: Red[] = [];
  nodos.forEach((n, i) => {
    const r = raiz(i);
    let red = porRaiz.get(r);
    if (!red) {
      red = { bornes: [], cables: [], nombres: [] };
      porRaiz.set(r, red);
      salida.push(red);
    }
    if (n.tipo === "cable") {
      red.cables.push(n.id);
      return;
    }
    red.bornes.push({ comp: n.comp, borne: n.borne });
    if (n.nombre !== "" && !red.nombres.includes(n.nombre)) red.nombres.push(n.nombre);
  });
  for (const red of salida) red.nombres.sort(compararTexto);
  return salida;
}

/**
 * Qué redes de `lista` se unirían por nombre: para cada nombre, los índices
 * (en `lista`) de las redes que lo tienen, en orden. Una red con dos nombres
 * aparece en los dos. Los nombres van en orden alfabético; los que tiene una
 * sola red también salen.
 */
export function porNombre(lista: readonly Red[]): Map<string, number[]> {
  const grupos = new Map<string, number[]>();
  lista.forEach((red, i) => {
    for (const nombre of red.nombres) {
      let indices = grupos.get(nombre);
      if (!indices) grupos.set(nombre, (indices = []));
      indices.push(i);
    }
  });
  return new Map([...grupos].sort(([a], [b]) => compararTexto(a, b)));
}
