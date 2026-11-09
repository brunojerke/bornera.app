// Conexiones engañosas (T13): lo que se ve conectado y no lo está. La
// herramienta cable (W) no deja fijar un tramo así. Sin dependencias del
// navegador.
//
// Bloquean, para el cable nuevo entero (lo fijado más la vista previa):
// - un tramo o codo sobre un borne que no es el de su extremo;
// - un tramo encimado (colineal, más de un punto) con otro cable;
// - un contacto en un punto que es codo o extremo de alguno de los dos
//   (incluye pasar por el extremo libre de otro cable), salvo la T de otro
//   cable sobre este, en su punto;
// - el cable consigo mismo: dos tramos no vecinos con algún punto en común
//   (encimados, cruzados o tocándose);
// - una T sobre un cruce de cables que no están unidos ahí, o sobre el
//   extremo libre de otro cable;
// - un tramo por el interior abierto del cuerpo de un componente, propio o
//   ajeno (llegar a un borne por afuera y bordear la caja vale);
// - un borne de extremo que ya no tiene salidas libres (afuera y los dos
//   costados ocupados por otros cables).
// En los puntos donde el cable declara su conexión (su borne, su punto de T)
// se permite el contacto, no el encimado. El cruce simple de dos interiores
// se permite y no conecta.
//
// No es una invariante del documento (`validarCable` no cambia). Mover, girar
// y espejar (T14a, `seguir.ts`) y colocar usan la misma regla:
// `problemasTrazado` para los cables que cambian y `problemasComponente` para
// los componentes, y bloquean solo los conflictos nuevos (cada `Conflicto`
// tiene la clave del par de elementos que chocan).
//
// `problemasTrazado` es la única regla. Los datos los da una `ConsultaTrazado`:
// la lineal de acá (`consultaHoja`), o la del editor con el índice de la
// escena. La vista previa y el comando final usan la misma función y la misma
// consulta.

import { bornesColocados, buscarSimbolo, cajaCuerpo, type DefinicionSimbolo, type Direccion, type Rect } from "../symbols";
import { indexarHoja, puntoExtremo, recorridoCable, validarCable, type IndiceHoja } from "./cables";
import type { Componente, Extremo, Hoja } from "./documento";
import type { DatosCable } from "./comandos";
import { perpendiculares } from "./ruteo";

/** Un borne colocado en la hoja. */
export interface BorneHoja {
  comp: string;
  borne: string;
  /**
   * Cómo se nombra el componente en los mensajes: su etiqueta ("K1") o, sin
   * etiqueta, el nombre del símbolo ("Bobina de contactor"). Nunca el id.
   */
  nombre: string;
  x: number;
  y: number;
  direccion: Direccion;
}

/** Un cable de la hoja, con su recorrido resuelto. */
export interface CableHoja {
  id: string;
  puntos: readonly number[];
  desde: Extremo;
  hasta: Extremo;
}

/** El cuerpo de un componente de la hoja. */
export interface CuerpoHoja {
  comp: string;
  /** Como en `BorneHoja.nombre`. */
  nombre: string;
  caja: Rect;
}

/** Lo que hay en la hoja cerca de una caja. Puede dar de más (candidatos): la regla compara exacto. */
export interface ConsultaTrazado {
  bornesEn(caja: Rect): Iterable<BorneHoja>;
  cablesEn(caja: Rect): Iterable<CableHoja>;
  cuerposEn(caja: Rect): Iterable<CuerpoHoja>;
}

/**
 * Un problema del trazado, con el punto donde se marca. El mensaje es para
 * el usuario: nombra componentes y bornes, nunca ids internos.
 */
export interface Conflicto {
  mensaje: string;
  x: number;
  y: number;
  /**
   * Qué par de elementos choca y cómo: `tipo|elemento|elemento`, con los dos
   * elementos ordenados ("cable:w5", "borne:c3:A1", "cuerpo:c3"). Sirve para
   * saber si un conflicto ya estaba antes de una operación (T14a): un
   * encimado viejo de w5 con w8 no tapa uno nuevo de w5 con w9.
   */
  clave: string;
}

/** El cable que se quiere crear o cambiar: extremos y recorrido resuelto (x, y seguidos). */
export interface CableNuevo {
  /** Id del cable, para las claves de conflicto; uno nuevo no tiene ("nuevo"). */
  id?: string;
  desde: Extremo;
  hasta: Extremo;
  puntos: readonly number[];
}

export const MENSAJE_SIN_SALIDAS = "El borne no tiene más salidas libres: derivá con una T sobre uno de sus cables.";
export const MENSAJE_EXTREMO_SUELTO = "Ese extremo está suelto: todavía no se puede conectar a él.";
export const MENSAJE_CRUCE = "Ahí se cruzan dos cables sin unirse: elegí otro punto.";

/** Clave de un conflicto entre dos elementos (en cualquier orden). */
export function claveConflicto(tipo: string, a: string, b: string): string {
  return a <= b ? `${tipo}|${a}|${b}` : `${tipo}|${b}|${a}`;
}

const elCable = (id: string) => `cable:${id}`;
const elBorne = (comp: string, borne: string) => `borne:${comp}:${borne}`;
const elCuerpo = (comp: string) => `cuerpo:${comp}`;

/** True si las cajas se tocan (bordes incluidos). */
function seTocan(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.ancho && b.x <= a.x + a.ancho && a.y <= b.y + b.alto && b.y <= a.y + a.alto;
}

/** Caja de un punto o de un tramo ortogonal. */
function cajaTramo(x0: number, y0: number, x1: number, y1: number): Rect {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, ancho: Math.abs(x1 - x0), alto: Math.abs(y1 - y0) };
}

/**
 * Nombre de un componente para los mensajes: su etiqueta o, sin etiqueta, el
 * nombre del símbolo. Nunca el id interno.
 */
export function nombreVisible(etiqueta: string | undefined, def: DefinicionSimbolo): string {
  return etiqueta || def.nombre;
}

/** Bornes y cuerpo de un componente en la hoja, o null si su símbolo no se conoce. */
export function geometriaComponente(
  c: Pick<Componente, "id" | "tipo" | "x" | "y" | "rot" | "espejado" | "etiqueta">,
): { bornes: BorneHoja[]; cuerpo: CuerpoHoja } | null {
  const def = buscarSimbolo(c.tipo);
  if (!def) return null;
  const nombre = nombreVisible(c.etiqueta, def);
  const bornes = bornesColocados(def.bornes, c.x, c.y, { rotacion: c.rot, espejado: c.espejado }).map((b) => ({
    comp: c.id,
    borne: b.nombre,
    nombre,
    x: b.x,
    y: b.y,
    direccion: b.direccion,
  }));
  return { bornes, cuerpo: { comp: c.id, nombre, caja: cajaCuerpo(def.tamano, c.x, c.y, c.rot) } };
}

/**
 * Consulta lineal sobre una hoja: arma una vez las listas de bornes, cables y
 * cuerpos, y cada consulta las recorre enteras. Para los tests y para
 * comparar con la indexada del editor. Los símbolos desconocidos no tienen
 * cuerpo ni bornes.
 */
export function consultaHoja(hoja: Hoja, indice: IndiceHoja = indexarHoja(hoja)): ConsultaTrazado {
  const bornes: BorneHoja[] = [];
  const cuerpos: CuerpoHoja[] = [];
  for (const c of hoja.componentes) {
    const g = geometriaComponente(c);
    if (!g) continue;
    cuerpos.push(g.cuerpo);
    bornes.push(...g.bornes);
  }
  const cables: CableHoja[] = [];
  for (const w of hoja.cables) {
    const puntos = recorridoCable(indice, w);
    if (puntos) cables.push({ id: w.id, puntos, desde: w.desde, hasta: w.hasta });
  }
  return {
    bornesEn: (k) => bornes.filter((b) => b.x >= k.x && b.x <= k.x + k.ancho && b.y >= k.y && b.y <= k.y + k.alto),
    cuerposEn: (k) => cuerpos.filter((c) => seTocan(c.caja, k)),
    cablesEn: (k) => cables.filter((w) => tocaRecorrido(w.puntos, k)),
  };
}

/** True si algún tramo del recorrido toca la caja (bordes incluidos). */
export function tocaRecorrido(p: readonly number[], k: Rect): boolean {
  for (let i = 0; i + 3 < p.length; i += 2) {
    if (seTocan(cajaTramo(p[i]!, p[i + 1]!, p[i + 2]!, p[i + 3]!), k)) return true;
  }
  return false;
}

/**
 * Salidas libres de un borne en (x, y) con dirección `direccion`: afuera y
 * los dos costados, menos las que ya usa un tramo de otro cable que sale de
 * ese punto (o pasa por él). Hacia adentro no se cuenta nunca.
 */
export function salidasLibres(consulta: ConsultaTrazado, x: number, y: number, direccion: Direccion): Direccion[] {
  const ocupadas = new Set<Direccion>();
  for (const w of consulta.cablesEn({ x, y, ancho: 0, alto: 0 })) {
    const p = w.puntos;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const x0 = p[i]!;
      const y0 = p[i + 1]!;
      const x1 = p[i + 2]!;
      const y1 = p[i + 3]!;
      if (!(x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= Math.min(y0, y1) && y <= Math.max(y0, y1))) continue;
      if (x0 !== x || y0 !== y) ocupadas.add(direccionHacia(x, y, x0, y0));
      if (x1 !== x || y1 !== y) ocupadas.add(direccionHacia(x, y, x1, y1));
    }
  }
  return [direccion, ...perpendiculares(direccion)].filter((d) => !ocupadas.has(d));
}

/** Dirección de (x, y) hacia (x1, y1), en un tramo ortogonal. */
function direccionHacia(x: number, y: number, x1: number, y1: number): Direccion {
  if (x1 > x) return "derecha";
  if (x1 < x) return "izquierda";
  return y1 > y ? "abajo" : "arriba";
}

/** Cómo se tocan dos tramos ortogonales: nada, un punto o un encimado (más de un punto). */
type Toque = null | { tipo: "punto"; x: number; y: number } | { tipo: "encimado"; x: number; y: number };

function toque(ax0: number, ay0: number, ax1: number, ay1: number, bx0: number, by0: number, bx1: number, by1: number): Toque {
  const aH = ay0 === ay1;
  const bH = by0 === by1;
  if (aH && bH) {
    if (ay0 !== by0) return null;
    const lo = Math.max(Math.min(ax0, ax1), Math.min(bx0, bx1));
    const hi = Math.min(Math.max(ax0, ax1), Math.max(bx0, bx1));
    if (lo > hi) return null;
    return { tipo: lo === hi ? "punto" : "encimado", x: lo, y: ay0 };
  }
  if (!aH && !bH) {
    if (ax0 !== bx0) return null;
    const lo = Math.max(Math.min(ay0, ay1), Math.min(by0, by1));
    const hi = Math.min(Math.max(ay0, ay1), Math.max(by0, by1));
    if (lo > hi) return null;
    return { tipo: lo === hi ? "punto" : "encimado", x: ax0, y: lo };
  }
  // Uno horizontal y otro vertical.
  const [hx0, hx1, hy, vx, vy0, vy1] = aH ? [ax0, ax1, ay0, bx0, by0, by1] : [bx0, bx1, by0, ax0, ay0, ay1];
  if (vx < Math.min(hx0, hx1) || vx > Math.max(hx0, hx1) || hy < Math.min(vy0, vy1) || hy > Math.max(vy0, vy1)) return null;
  return { tipo: "punto", x: vx, y: hy };
}

/** True si el tramo pasa por el interior abierto de la caja (no solo por su borde). */
function atraviesa(x0: number, y0: number, x1: number, y1: number, k: Rect): boolean {
  const kx1 = k.x + k.ancho;
  const ky1 = k.y + k.alto;
  if (y0 === y1) {
    return y0 > k.y && y0 < ky1 && Math.max(Math.min(x0, x1), k.x) < Math.min(Math.max(x0, x1), kx1);
  }
  return x0 > k.x && x0 < kx1 && Math.max(Math.min(y0, y1), k.y) < Math.min(Math.max(y0, y1), ky1);
}

/** True si algún extremo de `w` está en (x, y) y es una T sobre el cable `otro`. */
export function terminaEnTSobre(w: CableHoja, otro: string, x: number, y: number): boolean {
  for (const e of [w.desde, w.hasta]) if (e.tipo === "cable" && e.cable === otro && e.x === x && e.y === y) return true;
  return false;
}

/**
 * Problemas del trazado de un cable nuevo (o cambiado, con su `id`) contra
 * lo que da `consulta`, que no tiene que incluir a ese mismo cable. Vacío si
 * se puede fijar. Ver las reglas al principio del archivo.
 */
export function problemasTrazado(nuevo: CableNuevo, consulta: ConsultaTrazado): Conflicto[] {
  const P = nuevo.puntos;
  const n = P.length;
  const yo = elCable(nuevo.id ?? "nuevo");
  const salida: Conflicto[] = [];
  const vistos = new Set<string>();
  const anotar = (mensaje: string, x: number, y: number, clave: string) => {
    const k = `${clave}|${x}|${y}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    salida.push({ mensaje, x, y, clave });
  };
  if (n < 4) return salida;
  const extremos: [Extremo, number, number][] = [
    [nuevo.desde, P[0]!, P[1]!],
    [nuevo.hasta, P[n - 2]!, P[n - 1]!],
  ];
  /** El extremo declarado (borne o T) del cable nuevo en (x, y), o null. */
  const declarado = (x: number, y: number): Extremo | null => {
    for (const [e, ex, ey] of extremos) if (e.tipo !== "libre" && ex === x && ey === y) return e;
    return null;
  };

  // Extremos: borne sin salidas libres; T sobre un extremo suelto.
  for (const [e, x, y] of extremos) {
    if (e.tipo === "borne") {
      for (const b of consulta.bornesEn({ x, y, ancho: 0, alto: 0 })) {
        if (b.comp !== e.comp || b.borne !== e.borne || b.x !== x || b.y !== y) continue;
        if (salidasLibres(consulta, x, y, b.direccion).length === 0) {
          anotar(MENSAJE_SIN_SALIDAS, x, y, claveConflicto("sinSalidas", elBorne(b.comp, b.borne), yo));
        }
      }
    } else if (e.tipo === "cable") {
      for (const w of consulta.cablesEn({ x, y, ancho: 0, alto: 0 })) {
        if (w.id !== e.cable) continue;
        const m = w.puntos.length;
        const suelto =
          (w.desde.tipo === "libre" && w.puntos[0] === x && w.puntos[1] === y) ||
          (w.hasta.tipo === "libre" && w.puntos[m - 2] === x && w.puntos[m - 1] === y);
        if (suelto) anotar(MENSAJE_EXTREMO_SUELTO, x, y, claveConflicto("tSuelta", elCable(w.id), yo));
      }
      // Otro cable por el punto de la T, sin estar unido ahí con el anfitrión: un cruce.
      const ahi = [...consulta.cablesEn({ x, y, ancho: 0, alto: 0 })].filter((w) => tocaRecorrido(w.puntos, { x, y, ancho: 0, alto: 0 }));
      const anfitrion = ahi.find((w) => w.id === e.cable);
      for (const w of ahi) {
        if (w.id === e.cable) continue;
        const unidos = terminaEnTSobre(w, e.cable, x, y) || (anfitrion !== undefined && terminaEnTSobre(anfitrion, w.id, x, y));
        if (!unidos) anotar(MENSAJE_CRUCE, x, y, claveConflicto("cruce", elCable(w.id), yo));
      }
    }
  }

  for (let i = 0; i + 3 < n; i += 2) {
    const sx0 = P[i]!;
    const sy0 = P[i + 1]!;
    const sx1 = P[i + 2]!;
    const sy1 = P[i + 3]!;
    const caja = cajaTramo(sx0, sy0, sx1, sy1);

    // Bornes sobre el tramo, salvo el de su extremo.
    for (const b of consulta.bornesEn(caja)) {
      if (b.x < caja.x || b.x > caja.x + caja.ancho || b.y < caja.y || b.y > caja.y + caja.alto) continue;
      const e = declarado(b.x, b.y);
      if (e && e.tipo === "borne" && e.comp === b.comp && e.borne === b.borne) continue;
      anotar(
        `El cable pasaría sobre el borne ${b.nombre} · ${b.borne} sin conectarse.`,
        b.x,
        b.y,
        claveConflicto("borne", elBorne(b.comp, b.borne), yo),
      );
    }

    // Cuerpos de componentes.
    for (const c of consulta.cuerposEn(caja)) {
      if (!atraviesa(sx0, sy0, sx1, sy1, c.caja)) continue;
      const k = c.caja;
      const x = Math.min(Math.max((sx0 + sx1) / 2, k.x), k.x + k.ancho);
      const y = Math.min(Math.max((sy0 + sy1) / 2, k.y), k.y + k.alto);
      anotar(`El cable atravesaría el cuerpo de ${c.nombre}.`, x, y, claveConflicto("cuerpo", elCuerpo(c.comp), yo));
    }

    // Otros cables.
    const cables = [...consulta.cablesEn(caja)];
    for (const w of cables) {
      const otro = elCable(w.id);
      const p = w.puntos;
      for (let j = 0; j + 3 < p.length; j += 2) {
        const tx0 = p[j]!;
        const ty0 = p[j + 1]!;
        const tx1 = p[j + 2]!;
        const ty1 = p[j + 3]!;
        const t = toque(sx0, sy0, sx1, sy1, tx0, ty0, tx1, ty1);
        if (!t) continue;
        if (t.tipo === "encimado") {
          anotar("El cable se encimaría con otro cable.", t.x, t.y, claveConflicto("encimado", otro, yo));
          continue;
        }
        const e = declarado(t.x, t.y);
        if (e?.tipo === "borne") continue;
        if (e?.tipo === "cable") {
          if (w.id === e.cable) continue;
          // Otro cable en el punto de la T: vale si ya está unido ahí con el de la T.
          const anfitrion = cables.find((k) => k.id === e.cable);
          const unidos = terminaEnTSobre(w, e.cable, t.x, t.y) || (anfitrion !== undefined && terminaEnTSobre(anfitrion, w.id, t.x, t.y));
          if (!unidos) anotar(MENSAJE_CRUCE, t.x, t.y, claveConflicto("cruce", otro, yo));
          continue;
        }
        const enVertice = (t.x === sx0 && t.y === sy0) || (t.x === sx1 && t.y === sy1) || (t.x === tx0 && t.y === ty0) || (t.x === tx1 && t.y === ty1);
        if (!enVertice) continue; // cruce simple: no conecta
        // La T de `w` sobre este cable, en su punto: está unida, no es un toque.
        if (nuevo.id !== undefined && terminaEnTSobre(w, nuevo.id, t.x, t.y)) continue;
        const m = p.length;
        const suelto =
          (w.desde.tipo === "libre" && p[0] === t.x && p[1] === t.y) || (w.hasta.tipo === "libre" && p[m - 2] === t.x && p[m - 1] === t.y);
        if (suelto) anotar("El cable pasaría por el extremo suelto de otro cable.", t.x, t.y, claveConflicto("suelto", otro, yo));
        else anotar("El cable tocaría otro cable sin conectarse.", t.x, t.y, claveConflicto("toca", otro, yo));
      }
    }

    // Consigo mismo: un tramo no vecino encimado, cruzado o tocándose.
    for (let j = i + 4; j + 3 < n; j += 2) {
      const tx0 = P[j]!;
      const ty0 = P[j + 1]!;
      const tx1 = P[j + 2]!;
      const ty1 = P[j + 3]!;
      const t = toque(sx0, sy0, sx1, sy1, tx0, ty0, tx1, ty1);
      if (!t) continue;
      const enVertice = (t.x === sx0 && t.y === sy0) || (t.x === sx1 && t.y === sy1) || (t.x === tx0 && t.y === ty0) || (t.x === tx1 && t.y === ty1);
      anotar(
        t.tipo === "encimado"
          ? "El cable se encimaría consigo mismo."
          : enVertice
            ? "El cable se tocaría consigo mismo."
            : "El cable se cruzaría consigo mismo.",
        t.x,
        t.y,
        claveConflicto("mismo", yo, yo),
      );
    }
  }
  return salida;
}

/** Un componente movido o por colocar: sus bornes y su cuerpo (null si el símbolo no se conoce). */
export interface ComponenteNuevo {
  bornes: readonly BorneHoja[];
  cuerpo: CuerpoHoja | null;
}

/**
 * Conexiones aparentes que crea un componente en su lugar (T14a), contra lo
 * que da `consulta`, que no tiene que incluir al componente mismo:
 * - un borne sobre un tramo de un cable que no termina en ese borne;
 * - un borne sobre el extremo suelto de un cable;
 * - un borne sobre otro borne;
 * - un tramo de cable por el interior de su cuerpo.
 * Las claves son las mismas que da `problemasTrazado` para el mismo par: un
 * conflicto se reconoce igual lo vea el cable o el componente.
 */
export function problemasComponente(comp: ComponenteNuevo, consulta: ConsultaTrazado): Conflicto[] {
  const salida: Conflicto[] = [];
  const vistos = new Set<string>();
  const anotar = (mensaje: string, x: number, y: number, clave: string) => {
    const k = `${clave}|${x}|${y}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    salida.push({ mensaje, x, y, clave });
  };
  for (const b of comp.bornes) {
    const punto = { x: b.x, y: b.y, ancho: 0, alto: 0 };
    const yo = elBorne(b.comp, b.borne);
    for (const otro of consulta.bornesEn(punto)) {
      if (otro.comp === b.comp || otro.x !== b.x || otro.y !== b.y) continue;
      anotar(
        `El borne ${b.nombre} · ${b.borne} quedaría sobre el borne ${otro.nombre} · ${otro.borne} sin conectarse.`,
        b.x,
        b.y,
        claveConflicto("borneBorne", yo, elBorne(otro.comp, otro.borne)),
      );
    }
    for (const w of consulta.cablesEn(punto)) {
      if (!tocaRecorrido(w.puntos, punto)) continue;
      const suyo = [w.desde, w.hasta].some((e) => e.tipo === "borne" && e.comp === b.comp && e.borne === b.borne);
      if (suyo) continue;
      const m = w.puntos.length;
      const suelto =
        (w.desde.tipo === "libre" && w.puntos[0] === b.x && w.puntos[1] === b.y) ||
        (w.hasta.tipo === "libre" && w.puntos[m - 2] === b.x && w.puntos[m - 1] === b.y);
      if (suelto) {
        anotar(
          `El borne ${b.nombre} · ${b.borne} quedaría sobre el extremo suelto de un cable.`,
          b.x,
          b.y,
          claveConflicto("borneSuelto", yo, elCable(w.id)),
        );
      } else {
        anotar(
          `El borne ${b.nombre} · ${b.borne} quedaría sobre un cable sin conectarse.`,
          b.x,
          b.y,
          claveConflicto("borne", yo, elCable(w.id)),
        );
      }
    }
  }
  const c = comp.cuerpo;
  if (c) {
    const k = c.caja;
    for (const w of consulta.cablesEn(k)) {
      const p = w.puntos;
      for (let i = 0; i + 3 < p.length; i += 2) {
        const x0 = p[i]!;
        const y0 = p[i + 1]!;
        const x1 = p[i + 2]!;
        const y1 = p[i + 3]!;
        if (!atraviesa(x0, y0, x1, y1, k)) continue;
        const x = Math.min(Math.max((x0 + x1) / 2, k.x), k.x + k.ancho);
        const y = Math.min(Math.max((y0 + y1) / 2, k.y), k.y + k.alto);
        anotar(`Un cable atravesaría el cuerpo de ${c.nombre}.`, x, y, claveConflicto("cuerpo", elCuerpo(c.comp), elCable(w.id)));
      }
    }
  }
  return salida;
}

/** Transformación de puntos que usa `consultaSuperpuesta` (la de un grupo, en T14a). */
export interface TransformacionConsulta {
  punto(x: number, y: number): { x: number; y: number };
  direccion(d: Direccion): Direccion;
  rect(r: Rect): Rect;
  rectInverso(r: Rect): Rect;
}

/** Lo que una `consultaSuperpuesta` cambia de la base. */
export interface Superposicion {
  /** Componentes y cables (ids) que no se ven en la base. */
  quitar?: ReadonlySet<string>;
  /**
   * Componentes y cables (ids) que se ven transformados con `t`: se consulta
   * la base con la caja inversa y se lleva cada uno a su lugar nuevo. Tienen
   * que estar también en `quitar`.
   */
  transformados?: { ids: ReadonlySet<string>; t: TransformacionConsulta };
  /** Bornes, cuerpos y cables que se agregan (listas chicas: se recorren enteras). */
  bornes?: readonly BorneHoja[];
  cuerpos?: readonly CuerpoHoja[];
  cables?: readonly CableHoja[];
}

function enCaja(x: number, y: number, k: Rect): boolean {
  return x >= k.x && x <= k.x + k.ancho && y >= k.y && y <= k.y + k.alto;
}

const NINGUNO: ReadonlySet<string> = new Set();

/**
 * La hoja como quedaría después de un cambio, sin armarla: la base menos lo
 * que se quita, más lo transformado y lo agregado. Sirve igual sobre la
 * consulta lineal y sobre la indexada del editor (T14a).
 */
export function consultaSuperpuesta(base: ConsultaTrazado, s: Superposicion): ConsultaTrazado {
  const quitar = s.quitar ?? NINGUNO;
  const tr = s.transformados;
  const moverExtremo = (e: Extremo): Extremo => {
    if (!tr || e.tipo === "borne") return e;
    return { ...e, ...tr.t.punto(e.x, e.y) };
  };
  // Listas, no generadores: se llama miles de veces por plan.
  return {
    bornesEn(k) {
      const salida: BorneHoja[] = [];
      for (const b of base.bornesEn(k)) if (!quitar.has(b.comp)) salida.push(b);
      if (tr) {
        for (const b of base.bornesEn(tr.t.rectInverso(k))) {
          if (!tr.ids.has(b.comp)) continue;
          const p = tr.t.punto(b.x, b.y);
          if (enCaja(p.x, p.y, k)) salida.push({ ...b, x: p.x, y: p.y, direccion: tr.t.direccion(b.direccion) });
        }
      }
      if (s.bornes) for (const b of s.bornes) if (enCaja(b.x, b.y, k)) salida.push(b);
      return salida;
    },
    cuerposEn(k) {
      const salida: CuerpoHoja[] = [];
      for (const c of base.cuerposEn(k)) if (!quitar.has(c.comp)) salida.push(c);
      if (tr) {
        for (const c of base.cuerposEn(tr.t.rectInverso(k))) {
          if (!tr.ids.has(c.comp)) continue;
          const caja = tr.t.rect(c.caja);
          if (seTocan(caja, k)) salida.push({ ...c, caja });
        }
      }
      if (s.cuerpos) for (const c of s.cuerpos) if (seTocan(c.caja, k)) salida.push(c);
      return salida;
    },
    cablesEn(k) {
      const salida: CableHoja[] = [];
      for (const w of base.cablesEn(k)) if (!quitar.has(w.id)) salida.push(w);
      if (tr) {
        for (const w of base.cablesEn(tr.t.rectInverso(k))) {
          if (!tr.ids.has(w.id)) continue;
          const puntos: number[] = [];
          for (let i = 0; i + 1 < w.puntos.length; i += 2) {
            const p = tr.t.punto(w.puntos[i]!, w.puntos[i + 1]!);
            puntos.push(p.x, p.y);
          }
          if (tocaRecorrido(puntos, k)) salida.push({ id: w.id, puntos, desde: moverExtremo(w.desde), hasta: moverExtremo(w.hasta) });
        }
      }
      if (s.cables) for (const w of s.cables) if (tocaRecorrido(w.puntos, k)) salida.push(w);
      return salida;
    },
  };
}

/** La consulta sin el cable `id` (para revisar un cable contra todo lo demás). */
export function consultaSinCable(base: ConsultaTrazado, id: string): ConsultaTrazado {
  return {
    bornesEn: (k) => base.bornesEn(k),
    cuerposEn: (k) => base.cuerposEn(k),
    cablesEn(k) {
      const salida: CableHoja[] = [];
      for (const w of base.cablesEn(k)) if (w.id !== id) salida.push(w);
      return salida;
    },
  };
}

/** Lo que da `prepararCable`: el recorrido (si se pudo resolver) y los problemas. */
export interface CablePreparado {
  puntos: number[] | null;
  problemas: Conflicto[];
}

/**
 * La validación completa de un cable nuevo: la estructura (`validarCable`,
 * lo mismo que exige `Cablear`) y, si está bien, el trazado. La herramienta
 * W la usa para la vista previa y para el comando final.
 */
export function prepararCable(indice: IndiceHoja, consulta: ConsultaTrazado, datos: DatosCable): CablePreparado {
  const w = { id: "", ...datos };
  const estructura = validarCable(indice, w);
  if (estructura.length > 0) {
    const p = puntoExtremo(indice, datos.hasta) ?? puntoExtremo(indice, datos.desde) ?? { x: 0, y: 0 };
    return { puntos: null, problemas: estructura.map((e) => ({ mensaje: e.mensaje, x: p.x, y: p.y, clave: `estructura|${e.mensaje}` })) };
  }
  const puntos = recorridoCable(indice, w)!;
  return { puntos, problemas: problemasTrazado({ desde: datos.desde, hasta: datos.hasta, puntos }, consulta) };
}
