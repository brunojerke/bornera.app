// Portapapeles (T16): copiar, cortar, pegar y duplicar, del lado del núcleo.
// Sin dependencias del navegador.
//
// - `recortar` copia una selección a un `Recorte`, que no guarda referencias
//   al documento: sirve aunque el documento cambie o se abra otro.
// - `pegar` arma el comando `Pegar`: ids nuevas (dadas al construir), extremos
//   remapeados y todo trasladado. Pegar y duplicar son un solo paso.
// - `problemasPegado` revisa la previa con la misma regla que Colocar y W
//   (`problemasComponente`, `problemasTrazado`), contra lo que ya está.
//
// Qué entra en un recorte (D2a-A y D2b-A de docs/plan-T16.md):
// - los componentes elegidos;
// - los cables elegidos con los dos extremos "adentro": un borne de un
//   componente copiado, una T sobre un cable copiado, o libre;
// - los cables no elegidos con los dos extremos conectados a lo copiado
//   (borne o T, no libre).
// Nada más: lo pegado nunca trae puntas sueltas nuevas.

import { buscarSimbolo, cajaCuerpo, type Rect } from "../symbols";
import { copiarCable, indexarHoja, recorridoCable, validarCable } from "./cables";
import { copiarComponente, exigirEntero, type Cambio, type Comando } from "./comandos";
import { generarId, PREFIJO_CABLE, type Cable, type Componente, type Documento, type Extremo, type Hoja } from "./documento";
import { geometriaComponente, problemasComponente, problemasTrazado, type Conflicto, type ConsultaTrazado } from "./trazado";

/**
 * Lo copiado: componentes y cables con sus ids originales, en el orden de la
 * hoja. Son copias: no comparten nada con el documento. Los extremos de los
 * cables nombran solo cosas del recorte. Se arma pensando en serializarlo
 * (las listas tienen el formato de una hoja del .brn).
 */
export interface Recorte {
  readonly componentes: readonly Componente[];
  readonly cables: readonly Cable[];
  /**
   * Caja de lo copiado: cuerpos de los componentes y puntos de los cables.
   * Puede tener medias unidades (un cuerpo de ancho impar). Null si el recorte
   * está vacío.
   */
  readonly caja: Rect | null;
}

/** True si el recorte no tiene nada. */
export function recorteVacio(r: Recorte): boolean {
  return r.componentes.length === 0 && r.cables.length === 0;
}

// ── Recortar ───────────────────────────────────────────────────────────────

/**
 * Copia de la hoja lo elegido en `ids` (componentes y cables mezclados), con
 * la regla del principio del archivo. Los ids que no están en la hoja no
 * cuentan. O(componentes + cables): un cable con T espera a que entren sus
 * anfitriones, sin pasadas repetidas.
 */
export function recortar(hoja: Hoja, ids: Iterable<string>): Recorte {
  const elegidos = new Set(ids);
  const comps = new Set<string>();
  for (const c of hoja.componentes) if (elegidos.has(c.id)) comps.add(c.id);

  const entran = new Set<string>();
  /** Anfitrión → cables con una T sobre él que esperan que entre (uno por T). */
  const esperan = new Map<string, Cable[]>();
  /** Cable → cuántas T suyas esperan todavía a su anfitrión. */
  const faltan = new Map<Cable, number>();
  const listos: Cable[] = [];
  for (const w of hoja.cables) {
    const elegido = elegidos.has(w.id);
    let puede = true;
    let ts = 0;
    for (const e of [w.desde, w.hasta]) {
      if (e.tipo === "libre") puede &&= elegido;
      else if (e.tipo === "borne") puede &&= comps.has(e.comp);
      else ts++;
    }
    if (!puede) continue;
    if (ts === 0) {
      listos.push(w);
      continue;
    }
    faltan.set(w, ts);
    for (const e of [w.desde, w.hasta]) {
      if (e.tipo !== "cable") continue;
      let lista = esperan.get(e.cable);
      if (!lista) esperan.set(e.cable, (lista = []));
      lista.push(w);
    }
  }
  // Cada cable entra una vez y libera a los que esperan por él. Sin ciclos
  // (el documento valida los apoyos); con uno, los del ciclo no entran.
  while (listos.length > 0) {
    const w = listos.pop()!;
    if (entran.has(w.id)) continue;
    entran.add(w.id);
    for (const otro of esperan.get(w.id) ?? []) {
      const n = faltan.get(otro)! - 1;
      faltan.set(otro, n);
      if (n === 0) listos.push(otro);
    }
  }

  const componentes = hoja.componentes.filter((c) => comps.has(c.id)).map(copiarComponente);
  const cables = hoja.cables.filter((w) => entran.has(w.id)).map(copiarCable);
  return { componentes, cables, caja: cajaDe(componentes, cables) };
}

/** Caja de componentes y cables (sus cuerpos y sus puntos), o null si no hay nada. */
function cajaDe(componentes: readonly Componente[], cables: readonly Cable[]): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const punto = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const c of componentes) {
    const def = buscarSimbolo(c.tipo);
    if (!def) {
      punto(c.x, c.y);
      continue;
    }
    // Los bornes quedan en el borde del cuerpo (`validarDefinicion`).
    const k = cajaCuerpo(def.tamano, c.x, c.y, c.rot);
    punto(k.x, k.y);
    punto(k.x + k.ancho, k.y + k.alto);
  }
  const indice = indexarHoja({ nombre: "", componentes: [...componentes], cables: [...cables] });
  for (const w of cables) {
    const p = recorridoCable(indice, w);
    if (p) for (let i = 0; i + 1 < p.length; i += 2) punto(p[i]!, p[i + 1]!);
  }
  return x0 === Infinity ? null : { x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 };
}

// ── Ids y traslado ─────────────────────────────────────────────────────────

/** Id original → id nueva, por lista (componentes y cables por separado). */
interface IdsPegado {
  componentes: Map<string, string>;
  cables: Map<string, string>;
}

/**
 * Da las ids nuevas con `generarId`: primero los componentes ("c") y después
 * los cables ("w"), en el orden del recorte. `pegar` le pasa el documento
 * (gasta las ids); `problemasPegado`, una copia de los contadores (las prevé
 * sin gastarlas). Es la misma cuenta, así que dan las mismas ids.
 */
function darIds(doc: Pick<Documento, "contadores">, recorte: Recorte): IdsPegado {
  const componentes = new Map<string, string>();
  const cables = new Map<string, string>();
  for (const c of recorte.componentes) componentes.set(c.id, generarId(doc));
  for (const w of recorte.cables) cables.set(w.id, generarId(doc, PREFIJO_CABLE));
  return { componentes, cables };
}

/** a + b sin dar -0. */
const sumar = (a: number, b: number) => a + b + 0;

/** Lo pegado: copias del recorte con las ids nuevas, los extremos remapeados y todo trasladado. */
function trasladar(recorte: Recorte, dx: number, dy: number, ids: IdsPegado): { componentes: Componente[]; cables: Cable[] } {
  const extremo = (e: Extremo): Extremo => {
    switch (e.tipo) {
      case "borne":
        return { tipo: "borne", comp: ids.componentes.get(e.comp) ?? e.comp, borne: e.borne };
      case "cable":
        return { tipo: "cable", cable: ids.cables.get(e.cable) ?? e.cable, x: sumar(e.x, dx), y: sumar(e.y, dy) };
      case "libre":
        return { tipo: "libre", x: sumar(e.x, dx), y: sumar(e.y, dy) };
    }
  };
  const componentes = recorte.componentes.map((c) => ({
    ...copiarComponente(c),
    id: ids.componentes.get(c.id)!,
    x: sumar(c.x, dx),
    y: sumar(c.y, dy),
  }));
  const cables = recorte.cables.map((w) => ({
    id: ids.cables.get(w.id)!,
    desde: extremo(w.desde),
    hasta: extremo(w.hasta),
    codos: w.codos.map(([x, y]): [number, number] => [sumar(x, dx), sumar(y, dy)]),
  }));
  return { componentes, cables };
}

/**
 * Tira si el recorte no se puede pegar: vacío, ids repetidas, un extremo que
 * nombra algo fuera del recorte o una coordenada que no es entera. Así
 * `pegar` no gasta ids en vano. La forma de los cables la revisa `Pegar`.
 */
function revisarRecorte(r: Recorte): void {
  if (recorteVacio(r)) throw new Error("No hay nada para pegar.");
  const comps = new Set<string>();
  const cables = new Set<string>();
  for (const c of r.componentes) {
    if (comps.has(c.id)) throw new Error(`El componente "${c.id}" está repetido en lo copiado.`);
    comps.add(c.id);
    exigirEntero(c.x, "x");
    exigirEntero(c.y, "y");
  }
  for (const w of r.cables) {
    if (cables.has(w.id)) throw new Error(`El cable "${w.id}" está repetido en lo copiado.`);
    cables.add(w.id);
  }
  for (const w of r.cables) {
    for (const e of [w.desde, w.hasta]) {
      if (e.tipo === "borne" && !comps.has(e.comp)) throw new Error(`El cable "${w.id}" va a "${e.comp}", que no está en lo copiado.`);
      if (e.tipo === "cable" && !cables.has(e.cable)) throw new Error(`El cable "${w.id}" se apoya en "${e.cable}", que no está en lo copiado.`);
      if (e.tipo !== "borne") {
        exigirEntero(e.x, "x");
        exigirEntero(e.y, "y");
      }
    }
    for (const [x, y] of w.codos) {
      exigirEntero(x, "x del codo");
      exigirEntero(y, "y del codo");
    }
  }
}

// ── Pegar ──────────────────────────────────────────────────────────────────

/**
 * Agrega de una vez componentes y cables ya armados, con sus ids (lo que da
 * `pegar`). Un solo paso de deshacer, sin un `Grupo` de Colocar y Cablear:
 * `Cablear` indexa la hoja en cada `aplicar`, y con miles de cables sería
 * cuadrático.
 *
 * `aplicar` valida todo antes de tocar el documento: ninguna id que ya
 * exista (en ninguna hoja) ni repetida en el lote, y cada cable con
 * `validarCable` contra un solo índice (la hoja más el lote). Recién
 * entonces agrega todo al final de las listas. `deshacer` lo quita en una
 * pasada; rehacer vuelve a aplicar con las mismas ids.
 */
export class Pegar implements Comando {
  private readonly componentes: readonly Componente[];
  private readonly cables: readonly Cable[];

  constructor(
    lote: { componentes: readonly Componente[]; cables: readonly Cable[] },
    private readonly hoja = 0,
  ) {
    for (const c of lote.componentes) {
      exigirEntero(c.x, "x");
      exigirEntero(c.y, "y");
    }
    this.componentes = lote.componentes.map(copiarComponente);
    this.cables = lote.cables.map(copiarCable);
  }

  /** Ids de lo que agrega: primero los componentes y después los cables, en orden. */
  get ids(): string[] {
    return [...this.componentes.map((c) => c.id), ...this.cables.map((w) => w.id)];
  }

  aplicar(doc: Documento): Cambio {
    const hoja = doc.hojas[this.hoja];
    if (!hoja) throw new Error(`No existe la hoja ${this.hoja}.`);
    const usadas = new Set<string>();
    for (const k of doc.hojas) {
      for (const c of k.componentes) usadas.add(c.id);
      for (const w of k.cables) usadas.add(w.id);
    }
    for (const { id } of [...this.componentes, ...this.cables]) {
      if (usadas.has(id)) throw new Error(`Ya existe el id "${id}".`);
      usadas.add(id);
    }
    const indice = indexarHoja({
      nombre: hoja.nombre,
      componentes: [...hoja.componentes, ...this.componentes],
      cables: [...hoja.cables, ...this.cables],
    });
    for (const w of this.cables) {
      const problemas = validarCable(indice, w);
      if (problemas.length > 0) throw new Error(`Cable "${w.id}" inválido: ${problemas.map((p) => p.mensaje).join(" ")}`);
    }
    // Copias nuevas cada vez: rehacer arranca de lo original.
    for (const c of this.componentes) hoja.componentes.push(copiarComponente(c));
    for (const w of this.cables) hoja.cables.push(copiarCable(w));
    return this.cambio();
  }

  deshacer(doc: Documento): Cambio {
    const hoja = doc.hojas[this.hoja];
    if (!hoja) throw new Error(`No existe la hoja ${this.hoja}.`);
    const comps = new Set(this.componentes.map((c) => c.id));
    const cables = new Set(this.cables.map((w) => w.id));
    // Todo se comprueba antes de tocar nada.
    const presentes = new Set<string>();
    for (const c of hoja.componentes) if (comps.has(c.id)) presentes.add(c.id);
    for (const w of hoja.cables) if (cables.has(w.id)) presentes.add(w.id);
    for (const id of [...comps, ...cables]) if (!presentes.has(id)) throw new Error(`No existe "${id}".`);
    quitarDe(hoja.componentes, comps);
    quitarDe(hoja.cables, cables);
    return this.cambio();
  }

  private cambio(): Cambio {
    return { componentes: this.componentes.map((c) => c.id), cables: this.cables.map((w) => w.id) };
  }
}

/** Quita de la lista, en su lugar y en una pasada, los elementos con id en `ids`. */
function quitarDe<T extends { id: string }>(lista: T[], ids: ReadonlySet<string>): void {
  let j = 0;
  for (const x of lista) if (!ids.has(x.id)) lista[j++] = x;
  lista.length = j;
}

/**
 * Arma el comando para pegar el recorte desplazado (dx, dy), enteros. Las ids
 * se dan acá, al construir (`generarId`, que deshacer no baja), después de
 * revisar el recorte. Las etiquetas quedan iguales (D3-A).
 */
export function pegar(doc: Documento, recorte: Recorte, dx: number, dy: number, hoja = 0): Pegar {
  exigirEntero(dx, "dx");
  exigirEntero(dy, "dy");
  revisarRecorte(recorte);
  return new Pegar(trasladar(recorte, dx, dy, darIds(doc, recorte)), hoja);
}

// ── Conflictos de la previa ────────────────────────────────────────────────

/**
 * Conflictos de pegar el recorte desplazado (dx, dy) contra lo que da
 * `consulta` (la hoja como está, sin lo pegado). Cada componente pasa por
 * `problemasComponente` y cada cable por `problemasTrazado`, como Colocar y W.
 *
 * Lo pegado lleva las ids que le daría `pegar` con estos `contadores` (se
 * prevén sin gastarlas): nunca coinciden con algo de la hoja, así que pegar
 * encima del original choca como con cualquier otra cosa, y las claves son
 * las del pegado real.
 *
 * Lo que choca dentro del recorte no cuenta: es la copia rígida de algo que
 * ya está. Lo pegado no está en la consulta, así que no se revisa entre sí, y
 * se ignora "mismo" (un cable consigo mismo). Los símbolos desconocidos no
 * tienen geometría y no dan conflicto. Un mismo conflicto (clave y punto) sale
 * una sola vez.
 */
export function problemasPegado(
  recorte: Recorte,
  dx: number,
  dy: number,
  consulta: ConsultaTrazado,
  contadores: Readonly<Record<string, number>>,
): Conflicto[] {
  exigirEntero(dx, "dx");
  exigirEntero(dy, "dy");
  const lote = trasladar(recorte, dx, dy, darIds({ contadores: { ...contadores } }, recorte));
  const indice = indexarHoja({ nombre: "", ...lote });
  const salida: Conflicto[] = [];
  const vistos = new Set<string>();
  const anotar = (lista: readonly Conflicto[]) => {
    for (const k of lista) {
      if (k.clave.startsWith("mismo|")) continue;
      const clave = `${k.clave}|${k.x}|${k.y}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push(k);
    }
  };
  for (const c of lote.componentes) {
    const g = geometriaComponente(c);
    if (g) anotar(problemasComponente(g, consulta));
  }
  for (const w of lote.cables) {
    const puntos = recorridoCable(indice, w);
    if (puntos) anotar(problemasTrazado({ id: w.id, desde: w.desde, hasta: w.hasta, puntos }, consulta));
  }
  return salida;
}
