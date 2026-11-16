// Validaciones en vivo (T19): lo que le falta o le sobra al circuito. Puro y
// sin DOM: devuelve los avisos de una hoja, y el editor los guarda y los
// muestra (src/editor/avisosHoja.ts, etapa 2). No se guarda en el .brn: se
// deriva de la hoja. Detalle en docs/plan-T19.md, sección 2.
//
// Severidad: *error* es lo que impedirá simular en la fase 5; *aviso*, lo que
// no (el circuito está incompleto o raro, pero se podrá simular).
//
// Reglas (las mismas palabras que el etiquetado de T17: fuente, seguidor y
// titular, en src/core/model/etiquetado.ts):
// - R1. Seguidor sin etiqueta: no sigue a nadie.
// - R2. Contacto que sigue a bobina, con etiqueta, sin ninguna bobina con esa
//   etiqueta en la hoja.
// - R3. Titular con prefijo y sin etiqueta. El símbolo desconocido no tiene
//   prefijo: ya avisa al abrir.
// - R4. Titulares con la misma etiqueta (cambio 6 del plan): error si en el
//   grupo hay alguno que no es un contacto a mano (bobina, lámpara o
//   desconocido); entre contactos a mano, un NA y un NC se permiten (pulsador
//   de doble contacto) y dos del mismo tipo dan aviso.
// - R5. Titular con prefijo cuya etiqueta es letras y número, con las letras
//   del prefijo de otro símbolo de la biblioteca (un pulsador "K1"). No se
//   suma a un error R4 del mismo componente (cambio 7).
// - R6. Auxiliar NC con un borne en la misma red que un borne de su propia
//   bobina, si esa red no tiene nombre de alimentación.
// - R7. Borne de un símbolo conocido sin ningún extremo de cable.
// - R8. Cable con algún extremo libre.
// - R9. Fuente sin etiqueta: no da nombre de red.
//
// `validar(hoja, reglas)` con un subconjunto da lo mismo que filtrar el
// resultado completo: cada regla se decide sola (R5 mira la condición de R4
// aunque R4 no se pida).

import { buscarSimbolo, esBobina, esFuente, esSeguidor, SIMBOLOS, sigueABobina, type DefinicionSimbolo } from "../symbols";
import type { Componente, Hoja } from "./documento";
import { esTitular, prefijoDe } from "./etiquetado";
import { normalizarEtiqueta } from "./etiquetas";
import { redes } from "./redes";

// ── Tipos ──────────────────────────────────────────────────────────────────

export type Regla = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8" | "R9";

/** Todas las reglas, en su orden. */
export const TODAS: readonly Regla[] = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"];

export type Severidad = "error" | "aviso";

/**
 * Un resultado de una regla. `id` es el componente marcado (el cable en R8).
 * Las etiquetas van normalizadas; los nombres, como en la biblioteca.
 */
export type Aviso =
  | { readonly regla: "R1"; readonly severidad: "aviso"; readonly id: string }
  | { readonly regla: "R2"; readonly severidad: "aviso"; readonly id: string; readonly etiqueta: string }
  /** `nombre`: el del símbolo ("Bobina de contactor"). */
  | { readonly regla: "R3"; readonly severidad: "aviso"; readonly id: string; readonly nombre: string }
  /** `otro`: el nombre del símbolo de otro titular del grupo (el primero en la hoja; del mismo tipo, si es aviso). */
  | { readonly regla: "R4"; readonly severidad: Severidad; readonly id: string; readonly etiqueta: string; readonly otro: string }
  /** `nombre`: el del símbolo marcado; `de`: lo que nombra ese prefijo ("bobina"). */
  | { readonly regla: "R5"; readonly severidad: "aviso"; readonly id: string; readonly etiqueta: string; readonly nombre: string; readonly de: string }
  | { readonly regla: "R6"; readonly severidad: "aviso"; readonly id: string; readonly etiqueta: string }
  | { readonly regla: "R7"; readonly severidad: "aviso"; readonly id: string; readonly borne: string }
  | { readonly regla: "R8"; readonly severidad: "aviso"; readonly id: string }
  | { readonly regla: "R9"; readonly severidad: "aviso"; readonly id: string };

/** Nombre de un símbolo que no está en la biblioteca: el mismo que dibuja el editor (`SIMBOLO_DESCONOCIDO`). */
const NOMBRE_DESCONOCIDO = "Símbolo desconocido";

// ── Clases ─────────────────────────────────────────────────────────────────

/** Contacto a mano (pulsador o selector): un titular con accionamiento. Puede tener varios contactos con la misma etiqueta. */
function esContactoManual(def: DefinicionSimbolo | undefined): boolean {
  return def !== undefined && def.accionamiento !== undefined && esTitular(def);
}

/** Auxiliar NC: el contacto de R6. El editor lo usa para R6 en las redes tocadas (T19, etapa 3b). */
export function esAuxiliarNC(def: DefinicionSimbolo | undefined): boolean {
  return def?.elemento === "contacto_nc" && sigueABobina(def);
}

/** Primera palabra del nombre: "Bobina de contactor" da "Bobina". */
function primeraPalabra(nombre: string): string {
  return nombre.split(" ")[0] ?? "";
}

/** El nombre con la primera letra en minúscula: "Pulsador NA" da "pulsador NA". */
function enMinuscula(nombre: string): string {
  return nombre.charAt(0).toLowerCase() + nombre.slice(1);
}

/** Si la primera palabra del nombre es femenina (termina en "a": bobina, lámpara). */
function esFemenino(nombre: string): boolean {
  return primeraPalabra(nombre).toLowerCase().endsWith("a");
}

/**
 * Prefijo → lo que nombra, en minúscula: la primera palabra del primer
 * símbolo de la biblioteca con ese prefijo. Hoy: K "bobina", S "pulsador",
 * H "lámpara".
 */
const DUENOS_PREFIJO: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const def of SIMBOLOS) {
    const p = prefijoDe(def);
    if (p !== null && !m.has(p)) m.set(p, primeraPalabra(def.nombre).toLowerCase());
  }
  return m;
})();

/** Etiqueta numerada: letras y número ("K01" es K y 1). La misma forma que numera T17. */
const NUMERADA = /^([A-Z]+)(\d+)$/;

// ── Validar ────────────────────────────────────────────────────────────────

/** Lo que se sabe de cada componente, en el orden de la hoja. */
interface Datos {
  c: Componente;
  def: DefinicionSimbolo | undefined;
  /** Etiqueta normalizada. */
  e: string;
}

/** R4 de un componente: con qué severidad y a quién nombra. */
interface Repetida {
  severidad: Severidad;
  otro: string;
}

const clave = (comp: string, borne: string) => `${comp}\u0000${borne}`;

/**
 * Los avisos de la hoja, en un orden fijo: primero los componentes, en el
 * orden de la hoja (y en cada uno, por regla; los de R7, por borne en el
 * orden de su definición); después los cables (R8), en el orden de la hoja.
 * Con `reglas`, solo esas: da lo mismo que filtrar el resultado completo.
 */
export function validar(hoja: Hoja, reglas: Iterable<Regla> = TODAS): Aviso[] {
  const activas = new Set(reglas);
  const datos: Datos[] = hoja.componentes.map((c) => ({ c, def: buscarSimbolo(c.tipo), e: normalizarEtiqueta(c.etiqueta) }));

  // Una pasada: las etiquetas de las bobinas y los titulares por etiqueta.
  const etiquetasBobina = new Set<string>();
  const titulares = new Map<string, number[]>();
  for (let i = 0; i < datos.length; i++) {
    const { def, e } = datos[i]!;
    if (e === "") continue;
    if (esBobina(def)) etiquetasBobina.add(e);
    if (esTitular(def)) {
      let lista = titulares.get(e);
      if (!lista) titulares.set(e, (lista = []));
      lista.push(i);
    }
  }

  // R4 (y la condición de R5): se decide por grupo.
  const repetidas = activas.has("R4") || activas.has("R5") ? titularesRepetidos(datos, titulares) : new Map<number, Repetida>();
  const marcadosR6 = activas.has("R6") ? ncEnSuRama(hoja, datos, etiquetasBobina) : new Set<string>();

  let conCable: Set<string> | null = null;
  if (activas.has("R7")) {
    conCable = new Set<string>();
    for (const w of hoja.cables) {
      for (const x of [w.desde, w.hasta]) if (x.tipo === "borne") conCable.add(clave(x.comp, x.borne));
    }
  }

  const avisos: Aviso[] = [];
  for (let i = 0; i < datos.length; i++) {
    const { c, def, e } = datos[i]!;
    const id = c.id;
    if (activas.has("R1") && def !== undefined && esSeguidor(def) && e === "") avisos.push({ regla: "R1", severidad: "aviso", id });
    if (activas.has("R2") && sigueABobina(def) && e !== "" && !etiquetasBobina.has(e)) avisos.push({ regla: "R2", severidad: "aviso", id, etiqueta: e });
    const prefijo = prefijoDe(def);
    if (activas.has("R3") && prefijo !== null && e === "") avisos.push({ regla: "R3", severidad: "aviso", id, nombre: def!.nombre });
    const repetida = repetidas.get(i);
    if (activas.has("R4") && repetida) avisos.push({ regla: "R4", severidad: repetida.severidad, id, etiqueta: e, otro: repetida.otro });
    if (activas.has("R5") && prefijo !== null && repetida?.severidad !== "error") {
      const m = NUMERADA.exec(e);
      const de = m && m[1] !== prefijo ? DUENOS_PREFIJO.get(m[1]!) : undefined;
      if (de !== undefined) avisos.push({ regla: "R5", severidad: "aviso", id, etiqueta: e, nombre: def!.nombre, de });
    }
    if (marcadosR6.has(id)) avisos.push({ regla: "R6", severidad: "aviso", id, etiqueta: e });
    if (conCable && def) {
      for (const b of def.bornes) if (!conCable.has(clave(id, b.nombre))) avisos.push({ regla: "R7", severidad: "aviso", id, borne: b.nombre });
    }
    if (activas.has("R9") && def !== undefined && esFuente(def) && e === "") avisos.push({ regla: "R9", severidad: "aviso", id });
  }

  if (activas.has("R8")) {
    for (const w of hoja.cables) {
      if (w.desde.tipo === "libre" || w.hasta.tipo === "libre") avisos.push({ regla: "R8", severidad: "aviso", id: w.id });
    }
  }
  return avisos;
}

/**
 * R4 por grupo de titulares con la misma etiqueta (cambio 6): índice en
 * `datos` → severidad y el nombre del otro. Error en todos si en el grupo
 * hay alguno que no es un contacto a mano. Si son todos contactos a mano,
 * aviso solo en los que comparten tipo con otro (NA y NC juntos se permiten).
 */
function titularesRepetidos(datos: readonly Datos[], titulares: ReadonlyMap<string, readonly number[]>): Map<number, Repetida> {
  const nombre = (i: number) => datos[i]!.def?.nombre ?? NOMBRE_DESCONOCIDO;
  const salida = new Map<number, Repetida>();
  for (const grupo of titulares.values()) {
    if (grupo.length < 2) continue;
    if (!grupo.every((i) => esContactoManual(datos[i]!.def))) {
      for (const i of grupo) salida.set(i, { severidad: "error", otro: nombre(grupo[0] === i ? grupo[1]! : grupo[0]!) });
      continue;
    }
    const porTipo = new Map<string, number[]>();
    for (const i of grupo) {
      const tipo = datos[i]!.c.tipo;
      let lista = porTipo.get(tipo);
      if (!lista) porTipo.set(tipo, (lista = []));
      lista.push(i);
    }
    for (const mismos of porTipo.values()) {
      if (mismos.length < 2) continue;
      for (const i of mismos) salida.set(i, { severidad: "aviso", otro: nombre(mismos[0] === i ? mismos[1]! : mismos[0]!) });
    }
  }
  return salida;
}

/**
 * R6: los ids de los auxiliares NC con un borne en una red sin nombre de
 * alimentación donde también hay un borne de una bobina con su misma
 * etiqueta. `redes()` recorre la hoja entera: se llama solo si hay algún NC
 * con la etiqueta de una bobina.
 */
function ncEnSuRama(hoja: Hoja, datos: readonly Datos[], etiquetasBobina: ReadonlySet<string>): Set<string> {
  const candidatos = new Map<string, string>();
  for (const { c, def, e } of datos) if (e !== "" && esAuxiliarNC(def) && etiquetasBobina.has(e)) candidatos.set(c.id, e);
  const marcados = new Set<string>();
  if (candidatos.size === 0) return marcados;

  const etiquetaBobina = new Map<string, string>();
  for (const { c, def, e } of datos) if (e !== "" && esBobina(def)) etiquetaBobina.set(c.id, e);
  for (const red of redes(hoja)) {
    if (red.nombres.length > 0) continue;
    let bobinas: Set<string> | null = null;
    for (const b of red.bornes) {
      const e = etiquetaBobina.get(b.comp);
      if (e !== undefined) (bobinas ??= new Set()).add(e);
    }
    if (!bobinas) continue;
    for (const b of red.bornes) {
      const e = candidatos.get(b.comp);
      if (e !== undefined && bobinas.has(e)) marcados.add(b.comp);
    }
  }
  return marcados;
}

/**
 * True si hay algún auxiliar NC con la etiqueta de una bobina de la hoja: la
 * única forma de que R6 dé algo. Una pasada por los componentes, sin
 * `redes()`. El editor la usa para saber si un cambio de cables puede mover
 * R6 (T19, etapa 2).
 */
export function hayCandidatosR6(hoja: Hoja): boolean {
  const bobinas = new Set<string>();
  const nc = new Set<string>();
  for (const c of hoja.componentes) {
    const def = buscarSimbolo(c.tipo);
    const bobina = esBobina(def);
    const auxiliarNC = esAuxiliarNC(def);
    if (!bobina && !auxiliarNC) continue;
    const e = normalizarEtiqueta(c.etiqueta);
    if (e === "") continue;
    if (bobina) bobinas.add(e);
    else nc.add(e);
  }
  for (const e of nc) if (bobinas.has(e)) return true;
  return false;
}

// ── Textos y cuentas ───────────────────────────────────────────────────────

/**
 * Etiqueta repetida (T17, D-manuales B): "Otra bobina de contactor ya se
 * llama K1.", con el nombre del símbolo del otro titular. El artículo sale de
 * la primera palabra del nombre: "Otra" si termina en "a" (bobina, lámpara),
 * "Otro" si no (pulsador, símbolo). Es el texto de R4.
 */
export function textoRepetida(nombreOtro: string, etiqueta: string): string {
  return `${esFemenino(nombreOtro) ? "Otra" : "Otro"} ${enMinuscula(nombreOtro)} ya se llama ${etiqueta}.`;
}

/** La línea que se muestra de un aviso (en la barra o en el panel). */
export function textoAviso(a: Aviso): string {
  switch (a.regla) {
    case "R1":
      return "Contacto sin etiqueta: no sigue a ninguna bobina.";
    case "R2":
      return `No hay ninguna bobina ${a.etiqueta} para este contacto.`;
    case "R3":
      return `${a.nombre} sin etiqueta.`;
    case "R4":
      return textoRepetida(a.otro, a.etiqueta);
    case "R5":
      return `${a.etiqueta} es nombre de ${a.de} y esto es ${esFemenino(a.nombre) ? "una" : "un"} ${enMinuscula(a.nombre)}.`;
    case "R6":
      return `El NC ${a.etiqueta} corta a su propia bobina. ¿Es el enclavamiento de otro contactor?`;
    case "R7":
      return `Borne ${a.borne} sin conectar.`;
    case "R8":
      return "Cable con un extremo suelto.";
    case "R9":
      return "Alimentación sin nombre de red.";
  }
}

/** Cuántos errores y cuántos avisos hay. */
export function contarAvisos(avisos: Iterable<Aviso>): { errores: number; avisos: number } {
  let errores = 0;
  let resto = 0;
  for (const a of avisos) {
    if (a.severidad === "error") errores++;
    else resto++;
  }
  return { errores, avisos: resto };
}
