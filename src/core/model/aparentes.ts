// R11 (T29): las conexiones aparentes que ya están en la hoja. Son las mismas
// que `problemasTrazado` y `problemasComponente` le impiden crear al editor
// (T14a), pero acá se buscan en lo que hay: un archivo abierto, lo pegado (lo
// que choca dentro del recorte se copia tal cual), deshacer o rehacer.
//
// Puro y sin DOM. La geometría la da una `ConsultaTrazado`: la lineal de
// `consultaHoja` (tests, hojas chicas) o la indexada del editor.
//
// Cada conflicto es un par de elementos (`Conflicto.clave`) y se marca en los
// dos (M-A). No todos los tipos de conflicto son conexiones aparentes:
// «sinSalidas» y «tSuelta» son reglas del gesto de dibujar, «mismo» es un
// cable consigo mismo y «estructura» un cable mal armado; esos no cuentan.
//
// R11-A (Bruno, 2026-11-20): un encimado entre dos cables que ya están en la
// misma red no avisa. La misma red es por cables, como `redes()` sin unir por
// nombre (la opción que calla menos). En la hoja entera se llama a `redes()`
// una sola vez, y solo si hay algún encimado entre cables; el editor recorre
// solo la red de uno de los dos cables (src/editor/avisosHoja.ts).
//
// Un mismo par puede verse distinto desde cada lado (un borne sobre el extremo
// suelto de un cable es «borneSuelto» desde el borne y «borne» desde el
// cable): la hoja entera mira desde todos los elementos y junta todo.

import { indexarHoja, recorridoCable, type IndiceHoja } from "./cables";
import type { Cable, Componente, Hoja } from "./documento";
import { redes } from "./redes";
import { consultaHoja, consultaSinCable, geometriaComponente, problemasComponente, problemasTrazado, type ConsultaTrazado, type Conflicto } from "./trazado";
import type { Rect } from "../symbols";
import type { Aviso, TipoAparente } from "./validaciones";

/** Una conexión aparente: el par (sus ids, que pueden ser el mismo), su tipo y dónde se marca. */
export interface Aparente {
  /** `clave|x|y`: lo que la identifica (el mismo par puede chocar en varios puntos). */
  readonly k: string;
  readonly tipo: TipoAparente;
  readonly x: number;
  readonly y: number;
  /** Ids de los dos elementos: un componente (por su borne o su cuerpo) o un cable. */
  readonly a: string;
  readonly b: string;
  /** Encimado entre dos cables: el único que mira R11-A. */
  readonly entreCables: boolean;
}

const TIPOS: ReadonlySet<string> = new Set<TipoAparente>(["borne", "borneBorne", "borneSuelto", "cruce", "cuerpo", "cuerpoCuerpo", "encimado", "suelto", "toca"]);

/**
 * El id del elemento de `clave` entre `desde` y `hasta`, sin cortar el texto
 * en partes: "cable:w5" da "w5"; "borne:c3:A1" y "cuerpo:c3", "c3".
 */
function idDe(clave: string, desde: number, hasta: number): string {
  const dos = clave.indexOf(":", desde);
  if (clave.startsWith("borne:", desde)) return clave.slice(dos + 1, clave.lastIndexOf(":", hasta - 1));
  return clave.slice(dos + 1, hasta);
}

/**
 * La conexión aparente de un conflicto, o null si su tipo no es de R11. Lee
 * la clave por posiciones, sin `split` (T29, A: menos basura por par).
 */
export function aparenteDe(k: Conflicto): Aparente | null {
  const c = k.clave;
  const i = c.indexOf("|");
  const j = i < 0 ? -1 : c.indexOf("|", i + 1);
  if (j < 0 || c.indexOf("|", j + 1) >= 0) return null;
  const tipo = c.slice(0, i);
  if (!TIPOS.has(tipo)) return null;
  return {
    k: `${c}|${k.x}|${k.y}`,
    tipo: tipo as TipoAparente,
    x: k.x,
    y: k.y,
    a: idDe(c, i + 1, j),
    b: idDe(c, j + 1, c.length),
    entreCables: tipo === "encimado" && c.startsWith("cable:", i + 1) && c.startsWith("cable:", j + 1),
  };
}

/** Las conexiones aparentes que ve un componente desde su lugar (ninguna si su símbolo no se conoce). */
export function aparentesDeComponente(c: Componente, consulta: ConsultaTrazado, salida: Aparente[] = []): Aparente[] {
  const g = geometriaComponente(c);
  if (!g) return salida;
  for (const k of problemasComponente(g, consulta)) {
    const a = aparenteDe(k);
    if (a) salida.push(a);
  }
  return salida;
}

/**
 * La consulta sin un cable, una por consulta base y reusada (T29, A: un
 * objeto y tres funciones menos por cable). Sirve porque `problemasTrazado`
 * no vuelve a pedir otra mientras corre.
 */
const sinUnCable = new WeakMap<ConsultaTrazado, { id: string; consulta: ConsultaTrazado }>();
function consultaSin(base: ConsultaTrazado, id: string): ConsultaTrazado {
  let e = sinUnCable.get(base);
  if (!e) {
    const nueva = { id: "", consulta: consultaSinCable(base, "") };
    nueva.consulta = {
      bornesEn: (k) => base.bornesEn(k),
      cuerposEn: (k) => base.cuerposEn(k),
      cablesEn(k) {
        const salida = [];
        for (const w of base.cablesEn(k)) if (w.id !== nueva.id) salida.push(w);
        return salida;
      },
    };
    sinUnCable.set(base, nueva);
    e = nueva;
  }
  e.id = id;
  return e.consulta;
}

/** Las conexiones aparentes que ve un cable desde su recorrido (ninguna si no se resuelve). */
export function aparentesDeCable(w: Cable, indice: IndiceHoja, consulta: ConsultaTrazado, salida: Aparente[] = []): Aparente[] {
  const puntos = recorridoCable(indice, w);
  if (!puntos) return salida;
  for (const k of problemasTrazado({ id: w.id, desde: w.desde, hasta: w.hasta, puntos }, consultaSin(consulta, w.id))) {
    const a = aparenteDe(k);
    if (a) salida.push(a);
  }
  return salida;
}

/**
 * Los ids de lo que la consulta tiene cerca de un componente (su cuerpo y
 * sus bornes) o de un cable (cada tramo): los únicos que pueden chocar con
 * él. El editor los revisa junto con lo que cambió, porque un par puede
 * verse solo desde el otro lado (ver arriba). Puede dar de más.
 */
export function cercanos(elemento: { componente: Componente } | { cable: Cable; indice: IndiceHoja }, consulta: ConsultaTrazado, salida: Set<string>): void {
  const mirar = (k: Rect) => {
    for (const x of consulta.cuerposEn(k)) salida.add(x.comp);
    for (const x of consulta.bornesEn(k)) salida.add(x.comp);
    for (const x of consulta.cablesEn(k)) salida.add(x.id);
  };
  if ("componente" in elemento) {
    const g = geometriaComponente(elemento.componente);
    if (!g) return;
    mirar(g.cuerpo.caja);
    for (const b of g.bornes) mirar({ x: b.x, y: b.y, ancho: 0, alto: 0 });
    return;
  }
  const p = recorridoCable(elemento.indice, elemento.cable);
  if (!p) return;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const x0 = p[i]!;
    const y0 = p[i + 1]!;
    const x1 = p[i + 2]!;
    const y1 = p[i + 3]!;
    mirar({ x: Math.min(x0, x1), y: Math.min(y0, y1), ancho: Math.abs(x1 - x0), alto: Math.abs(y1 - y0) });
  }
}

/**
 * Todas las conexiones aparentes de la hoja, vistas desde cada componente y
 * cada cable, sin repetir y sin R11-A (los encimados entre cables de la misma
 * red también salen, con `entreCables`).
 */
export function aparentesHoja(hoja: Hoja, indice: IndiceHoja = indexarHoja(hoja), consulta: ConsultaTrazado = consultaHoja(hoja, indice)): Aparente[] {
  const vistos = new Map<string, Aparente>();
  const lista: Aparente[] = [];
  for (const c of hoja.componentes) aparentesDeComponente(c, consulta, lista);
  for (const w of hoja.cables) aparentesDeCable(w, indice, consulta, lista);
  for (const a of lista) if (!vistos.has(a.k)) vistos.set(a.k, a);
  return [...vistos.values()];
}

/** R11-A en la hoja entera: si dos cables están en la misma red, con `redes()` una sola vez (al primer uso). */
export function mismaRedPorRedes(hoja: Hoja): (a: string, b: string) => boolean {
  let red: Map<string, number> | null = null;
  return (a, b) => {
    if (!red) {
      red = new Map();
      redes(hoja).forEach((r, i) => {
        for (const id of r.cables) red!.set(id, i);
      });
    }
    const x = red.get(a);
    return x !== undefined && x === red.get(b);
  };
}

/** Orden fijo de los avisos R11 de un elemento: de arriba abajo, de izquierda a derecha y por tipo. */
function compararR11(p: Extract<Aviso, { regla: "R11" }>, q: Extract<Aviso, { regla: "R11" }>): number {
  return p.y - q.y || p.x - q.x || (p.tipo < q.tipo ? -1 : p.tipo > q.tipo ? 1 : 0);
}

/**
 * Los avisos R11 de un elemento a partir de sus conexiones aparentes
 * visibles: uno por tipo y punto (dos cables encimados con él en el mismo
 * punto dan uno), en el orden de `compararR11`.
 */
export function avisosR11De(id: string, aparentes: Iterable<Aparente>): Extract<Aviso, { regla: "R11" }>[] {
  const salida: Extract<Aviso, { regla: "R11" }>[] = [];
  // Casi siempre son uno o pocos: se compara con los ya puestos, sin claves de texto (T29, A).
  for (const a of aparentes) {
    if (salida.some((s) => s.tipo === a.tipo && s.x === a.x && s.y === a.y)) continue;
    salida.push({ regla: "R11", severidad: "aviso", id, tipo: a.tipo, x: a.x, y: a.y });
  }
  return salida.length > 1 ? salida.sort(compararR11) : salida;
}

/**
 * R11 de la hoja entera: por elemento, en el orden de la hoja (componentes y
 * después cables). Con R11-A.
 */
export function avisosR11(hoja: Hoja, indice: IndiceHoja = indexarHoja(hoja), consulta: ConsultaTrazado = consultaHoja(hoja, indice)): Aviso[] {
  const mismaRed = mismaRedPorRedes(hoja);
  const porId = new Map<string, Aparente[]>();
  const sumar = (id: string, a: Aparente) => {
    let l = porId.get(id);
    if (!l) porId.set(id, (l = []));
    l.push(a);
  };
  for (const a of aparentesHoja(hoja, indice, consulta)) {
    if (a.entreCables && mismaRed(a.a, a.b)) continue;
    sumar(a.a, a);
    if (a.b !== a.a) sumar(a.b, a);
  }
  const salida: Aviso[] = [];
  for (const c of hoja.componentes) {
    const l = porId.get(c.id);
    if (l) salida.push(...avisosR11De(c.id, l));
  }
  for (const w of hoja.cables) {
    const l = porId.get(w.id);
    if (l) salida.push(...avisosR11De(w.id, l));
  }
  return salida;
}

/**
 * Los avisos de `validar` más los de R11, en el orden del editor: cada
 * componente con los suyos y después su R11; cada cable con su R8 y después
 * su R11. Para comparar con lo que muestra el editor.
 */
export function juntarConR11(hoja: Hoja, avisos: readonly Aviso[], r11: readonly Aviso[]): Aviso[] {
  const porId = new Map<string, Aviso[]>();
  for (const a of [...avisos, ...r11]) {
    let l = porId.get(a.id);
    if (!l) porId.set(a.id, (l = []));
    l.push(a);
  }
  const salida: Aviso[] = [];
  for (const c of hoja.componentes) salida.push(...(porId.get(c.id) ?? []));
  for (const w of hoja.cables) salida.push(...(porId.get(w.id) ?? []));
  return salida;
}
