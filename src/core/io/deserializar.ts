// Deserializar: texto .brn a Documento (T15a, ver docs/plan-T15a.md §2). Sin
// dependencias del navegador.
//
// - Nunca tira. El único try/catch envuelve a `JSON.parse`; el resto son
//   comprobaciones a mano.
// - Lista blanca: el Documento se arma campo por campo, en objetos nuevos.
//   Nunca se devuelve ni se reusa lo que dio `JSON.parse`.
// - Estricto: una clave de más, un campo que falta (también los de valor por
//   defecto) o un valor de otro tipo rechazan el archivo (D3-A).
// - Corre por etapas y corta en la primera con errores, porque las siguientes
//   suponen las anteriores. Dentro de una etapa junta todos los errores, hasta
//   MAXIMO_PROBLEMAS ("y N más").
//
// Etapas: 0 texto, 1 JSON, 2 formato, 3 versión, 4 estructura, 5 ids,
// 6 contadores, 7 símbolos, 8 cables (`validarHoja`), 9 apoyos y T.
//
// No se miran: las etiquetas (el documento acepta cualquier texto), la forma
// de `meta.fecha` (es un texto) ni las conexiones aparentes (D10-A).
// Claves repetidas en el JSON: `JSON.parse` se queda con la última y no se
// puede detectar sin un parser propio.

import { componentesCableados, indexarHoja, recorridoCable, seApoyaEn, validarHoja } from "../model/cables";
import { VERSION_FORMATO, type Cable, type Componente, type Documento, type Extremo, type Hoja, type Meta } from "../model/documento";
import { buscarSimbolo, type Rotacion } from "../symbols";

/**
 * Rango de la grilla (D21-A), inclusivo: cada coordenada (componentes,
 * extremos libres y en T, codos) cumple −RANGO_GRILLA ≤ v ≤ RANGO_GRILLA.
 * 10 000 abre; 10 001 se rechaza. Son 25 m con 2,5 mm por unidad.
 */
export const RANGO_GRILLA = 10_000;

/** Largo máximo del texto, en caracteres (D18): 16 × 1024 × 1024. */
export const LARGO_MAXIMO_TEXTO = 16 * 1024 * 1024;

/** Cuántos errores (o avisos) se listan por etapa; el resto va como "y N más". */
export const MAXIMO_PROBLEMAS = 20;

/** Un error (rechaza el archivo) o un aviso (deja abrir e informa). */
export interface ProblemaArchivo {
  /** Ruta del campo ("hojas[0].cables[2].desde") o id del objeto. Vacío si es de todo el archivo. */
  donde: string;
  mensaje: string;
}

export type ResultadoAbrir =
  | { ok: true; documento: Documento; avisos: ProblemaArchivo[] }
  | { ok: false; errores: ProblemaArchivo[] };

// ── Problemas ──────────────────────────────────────────────────────────────

/** Junta problemas hasta MAXIMO_PROBLEMAS y cuenta los que sobran, sin guardarlos. */
class Problemas {
  private readonly lista: ProblemaArchivo[] = [];
  private sobran = 0;

  agregar(donde: string, mensaje: string): void {
    if (this.lista.length < MAXIMO_PROBLEMAS) this.lista.push({ donde, mensaje });
    else this.sobran++;
  }

  get hay(): boolean {
    return this.lista.length > 0;
  }

  todos(): ProblemaArchivo[] {
    return this.sobran > 0 ? [...this.lista, { donde: "", mensaje: `y ${this.sobran} más` }] : [...this.lista];
  }
}

function rechazo(problemas: Problemas): ResultadoAbrir {
  return { ok: false, errores: problemas.todos() };
}

function rechazoUnico(donde: string, mensaje: string): ResultadoAbrir {
  return { ok: false, errores: [{ donde, mensaje }] };
}

// ── Mensajes ───────────────────────────────────────────────────────────────

/** Texto largo recortado, para que un valor enorme no llene el mensaje. */
function recortar(s: string, maximo = 40): string {
  return s.length > maximo ? `${s.slice(0, maximo - 1)}…` : s;
}

/** Cómo se nombra un valor en un mensaje: "(es 45)", "(es una lista)". */
function describir(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "una lista";
  switch (typeof v) {
    case "string":
      return recortar(JSON.stringify(v));
    case "number":
      return Number.isFinite(v) ? String(v) : "un número fuera de rango";
    case "boolean":
      return String(v);
    case "object":
      return "un objeto";
    default:
      return "nada";
  }
}

/** Ruta de una clave dentro de `ruta`. Una clave rara va entre corchetes, como JSON. */
function rutaClave(ruta: string, clave: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(clave)) return ruta ? `${ruta}.${clave}` : clave;
  return `${ruta}[${recortar(JSON.stringify(clave))}]`;
}

// ── Etapa 4: estructura ────────────────────────────────────────────────────

type Objeto = { readonly [clave: string]: unknown };

function esObjeto(v: unknown): v is Objeto {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const CLAVES_RAIZ = ["formato", "version", "meta", "contadores", "hojas"] as const;
const CLAVES_META = ["titulo", "autor", "fecha"] as const;
const CLAVES_HOJA = ["nombre", "componentes", "cables"] as const;
const CLAVES_COMPONENTE = ["id", "tipo", "x", "y", "rot", "espejado", "etiqueta", "params"] as const;
const CLAVES_CABLE = ["id", "desde", "hasta", "codos"] as const;
const CLAVES_BORNE = ["tipo", "comp", "borne"] as const;
const CLAVES_T = ["tipo", "cable", "x", "y"] as const;
const CLAVES_LIBRE = ["tipo", "x", "y"] as const;

const ROTACIONES: readonly number[] = [0, 90, 180, 270];

/** Claves de los mapas abiertos (`params`, `contadores`). */
const CLAVE_MAPA = /^[a-z0-9_]+$/;
/** Nombres que cumplen CLAVE_MAPA pero tocarían el prototipo de un objeto. */
const NOMBRES_RESERVADOS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Lee la estructura con lista blanca. Cada lectura anota sus errores y
 * devuelve igual un valor del tipo pedido (un relleno si falló): si hubo
 * algún error, el documento armado se descarta.
 */
class Lector {
  constructor(readonly problemas: Problemas) {}

  private error(donde: string, mensaje: string): void {
    this.problemas.agregar(donde, mensaje);
  }

  /** Anota cada clave de `o` que no está en `claves` (D3-A). */
  sobrantes(o: Objeto, ruta: string, claves: readonly string[]): void {
    for (const clave of Object.keys(o)) {
      if (!claves.includes(clave)) this.error(rutaClave(ruta, clave), "sobra: Bornera no conoce esta clave");
    }
  }

  /** `v` como objeto con exactamente esas claves (las que faltan las anota cada campo). Null si no es un objeto. */
  objeto(v: unknown, ruta: string, claves: readonly string[]): Objeto | null {
    if (!esObjeto(v)) {
      this.error(ruta, `tiene que ser un objeto (es ${describir(v)})`);
      return null;
    }
    this.sobrantes(v, ruta, claves);
    return v;
  }

  /** El valor del campo; undefined (y el error "falta") si no está. JSON no da undefined. */
  campo(o: Objeto, clave: string, ruta: string): unknown {
    if (Object.hasOwn(o, clave)) return o[clave];
    this.error(rutaClave(ruta, clave), "falta");
    return undefined;
  }

  texto(o: Objeto, clave: string, ruta: string): string {
    const v = this.campo(o, clave, ruta);
    if (v === undefined) return "";
    if (typeof v === "string") return v;
    this.error(rutaClave(ruta, clave), `tiene que ser un texto (es ${describir(v)})`);
    return "";
  }

  booleano(o: Objeto, clave: string, ruta: string): boolean {
    const v = this.campo(o, clave, ruta);
    if (v === undefined) return false;
    if (typeof v === "boolean") return v;
    this.error(rutaClave(ruta, clave), `tiene que ser true o false (es ${describir(v)})`);
    return false;
  }

  /** Una coordenada en unidades de grilla: entero seguro dentro de ±RANGO_GRILLA (inclusivo). */
  numeroGrilla(v: unknown, donde: string): number {
    if (typeof v !== "number" || !Number.isSafeInteger(v)) {
      this.error(donde, `tiene que ser un número entero (es ${describir(v)})`);
      return 0;
    }
    if (Math.abs(v) > RANGO_GRILLA) {
      this.error(donde, `está fuera de la grilla: tiene que estar entre -${RANGO_GRILLA} y ${RANGO_GRILLA} (es ${v})`);
      return 0;
    }
    // `+ 0` convierte -0 en 0.
    return v + 0;
  }

  coordenada(o: Objeto, clave: string, ruta: string): number {
    const v = this.campo(o, clave, ruta);
    return v === undefined ? 0 : this.numeroGrilla(v, rutaClave(ruta, clave));
  }

  rotacion(o: Objeto, ruta: string): Rotacion {
    const v = this.campo(o, "rot", ruta);
    if (v === undefined) return 0;
    if (typeof v === "number" && ROTACIONES.includes(v)) return (v + 0) as Rotacion;
    this.error(rutaClave(ruta, "rot"), `tiene que ser 0, 90, 180 o 270 (es ${describir(v)})`);
    return 0;
  }

  /** Un mapa abierto: claves con CLAVE_MAPA y sin nombres reservados; cada valor lo lee `leerValor`. */
  mapa<T>(o: Objeto, clave: string, ruta: string, leerValor: (v: unknown, donde: string) => T | undefined): Record<string, T> {
    const r: Record<string, T> = {};
    const v = this.campo(o, clave, ruta);
    if (v === undefined) return r;
    const donde = rutaClave(ruta, clave);
    if (!esObjeto(v)) {
      this.error(donde, `tiene que ser un objeto (es ${describir(v)})`);
      return r;
    }
    for (const k of Object.keys(v)) {
      const dk = rutaClave(donde, k);
      if (NOMBRES_RESERVADOS.has(k)) {
        this.error(dk, "es un nombre reservado: no se puede usar como clave");
        continue;
      }
      if (!CLAVE_MAPA.test(k)) {
        this.error(dk, "la clave solo puede tener minúsculas sin tildes, números y _");
        continue;
      }
      const x = leerValor(v[k], dk);
      // Seguro: `k` no es un nombre reservado.
      if (x !== undefined) r[k] = x;
    }
    return r;
  }

  /** Una lista; cada elemento lo lee `leer` (null si no se pudo). */
  lista<T>(o: Objeto, clave: string, ruta: string, leer: (v: unknown, ruta: string) => T | null): T[] {
    const v = this.campo(o, clave, ruta);
    if (v === undefined) return [];
    const donde = rutaClave(ruta, clave);
    if (!Array.isArray(v)) {
      this.error(donde, `tiene que ser una lista (es ${describir(v)})`);
      return [];
    }
    const r: T[] = [];
    v.forEach((x: unknown, i) => {
      const e = leer(x, `${donde}[${i}]`);
      if (e !== null) r.push(e);
    });
    return r;
  }

  meta(o: Objeto): Meta {
    const m = this.campo(o, "meta", "");
    const vacia: Meta = { titulo: "", autor: "", fecha: "" };
    if (m === undefined) return vacia;
    const v = this.objeto(m, "meta", CLAVES_META);
    if (!v) return vacia;
    return { titulo: this.texto(v, "titulo", "meta"), autor: this.texto(v, "autor", "meta"), fecha: this.texto(v, "fecha", "meta") };
  }

  componente(v: unknown, ruta: string): Componente | null {
    const o = this.objeto(v, ruta, CLAVES_COMPONENTE);
    if (!o) return null;
    return {
      id: this.texto(o, "id", ruta),
      tipo: this.texto(o, "tipo", ruta),
      x: this.coordenada(o, "x", ruta),
      y: this.coordenada(o, "y", ruta),
      rot: this.rotacion(o, ruta),
      espejado: this.booleano(o, "espejado", ruta),
      etiqueta: this.texto(o, "etiqueta", ruta),
      params: this.mapa(o, "params", ruta, (x, donde) => {
        if (typeof x === "string") return x;
        this.error(donde, `tiene que ser un texto (es ${describir(x)})`);
        return undefined;
      }),
    };
  }

  extremo(o: Objeto, lado: "desde" | "hasta", ruta: string): Extremo {
    const relleno: Extremo = { tipo: "libre", x: 0, y: 0 };
    const v = this.campo(o, lado, ruta);
    if (v === undefined) return relleno;
    const donde = rutaClave(ruta, lado);
    if (!esObjeto(v)) {
      this.error(donde, `tiene que ser un objeto (es ${describir(v)})`);
      return relleno;
    }
    // El tipo elige las claves esperadas.
    const tipo = this.campo(v, "tipo", donde);
    switch (tipo) {
      case "borne":
        this.sobrantes(v, donde, CLAVES_BORNE);
        return { tipo: "borne", comp: this.texto(v, "comp", donde), borne: this.texto(v, "borne", donde) };
      case "cable":
        this.sobrantes(v, donde, CLAVES_T);
        return { tipo: "cable", cable: this.texto(v, "cable", donde), x: this.coordenada(v, "x", donde), y: this.coordenada(v, "y", donde) };
      case "libre":
        this.sobrantes(v, donde, CLAVES_LIBRE);
        return { tipo: "libre", x: this.coordenada(v, "x", donde), y: this.coordenada(v, "y", donde) };
      default:
        if (tipo !== undefined) this.error(rutaClave(donde, "tipo"), `tiene que ser "borne", "cable" o "libre" (es ${describir(tipo)})`);
        return relleno;
    }
  }

  codos(o: Objeto, ruta: string): [number, number][] {
    return this.lista(o, "codos", ruta, (par, donde): [number, number] | null => {
      if (!Array.isArray(par) || par.length !== 2) {
        const es = Array.isArray(par) ? `una lista de ${par.length}` : describir(par);
        this.error(donde, `tiene que ser un par [x, y] (es ${es})`);
        return null;
      }
      return [this.numeroGrilla(par[0], `${donde}[0]`), this.numeroGrilla(par[1], `${donde}[1]`)];
    });
  }

  cable(v: unknown, ruta: string): Cable | null {
    const o = this.objeto(v, ruta, CLAVES_CABLE);
    if (!o) return null;
    return {
      id: this.texto(o, "id", ruta),
      desde: this.extremo(o, "desde", ruta),
      hasta: this.extremo(o, "hasta", ruta),
      codos: this.codos(o, ruta),
    };
  }

  hoja(v: unknown, ruta: string): Hoja | null {
    const o = this.objeto(v, ruta, CLAVES_HOJA);
    if (!o) return null;
    return {
      nombre: this.texto(o, "nombre", ruta),
      componentes: this.lista(o, "componentes", ruta, (x, r) => this.componente(x, r)),
      cables: this.lista(o, "cables", ruta, (x, r) => this.cable(x, r)),
    };
  }

  /** Arma el documento de la raíz (`formato` y `version` ya revisados). */
  documento(raiz: Objeto, version: number): Documento {
    this.sobrantes(raiz, "", CLAVES_RAIZ);
    const meta = this.meta(raiz);
    const contadores = this.mapa(raiz, "contadores", "", (x, donde) => {
      if (typeof x === "number" && Number.isSafeInteger(x) && x >= 1) return x;
      this.error(donde, `tiene que ser un entero mayor o igual a 1 (es ${describir(x)})`);
      return undefined;
    });
    const hojas = this.lista(raiz, "hojas", "", (x, r) => this.hoja(x, r));
    if (Array.isArray(raiz["hojas"]) && raiz["hojas"].length === 0) this.error("hojas", "tiene que tener al menos una hoja");
    return { formato: "bornera", version, meta, contadores, hojas };
  }
}

// ── Etapas 5 a 9 ───────────────────────────────────────────────────────────

/** Cada id del documento con la ruta de su campo, en orden (componentes y cables de cada hoja). */
function idsConRuta(doc: Documento): { id: string; ruta: string }[] {
  const r: { id: string; ruta: string }[] = [];
  doc.hojas.forEach((hoja, h) => {
    hoja.componentes.forEach((c, i) => r.push({ id: c.id, ruta: `hojas[${h}].componentes[${i}].id` }));
    hoja.cables.forEach((w, i) => r.push({ id: w.id, ruta: `hojas[${h}].cables[${i}].id` }));
  });
  return r;
}

/** Etapa 5: ids no vacíos y únicos en todo el documento. */
function revisarIds(ids: readonly { id: string; ruta: string }[], p: Problemas): void {
  const vistos = new Map<string, string>();
  for (const { id, ruta } of ids) {
    if (id === "") {
      p.agregar(ruta, "no puede estar vacío");
      continue;
    }
    const antes = vistos.get(id);
    if (antes !== undefined) p.agregar(ruta, `el id ${describir(id)} está repetido (ya está en ${antes})`);
    else vistos.set(id, ruta);
  }
}

/** Ids con forma de contador: prefijo en minúsculas y número sin ceros adelante ("c5", "w12"). */
const ID_CON_NUMERO = /^([a-z]+)([1-9][0-9]*)$/;

/**
 * Etapa 6 (D7-A): el contador de cada prefijo va adelante de sus ids, como lo
 * deja `generarId` (`contadores[prefijo] ?? 1` es el próximo número). Si no,
 * el próximo id que se diera ya estaría usado.
 */
function revisarContadores(doc: Documento, ids: readonly { id: string; ruta: string }[], p: Problemas): void {
  for (const { id, ruta } of ids) {
    const m = ID_CON_NUMERO.exec(id);
    if (!m) continue;
    const prefijo = m[1]!;
    const numero = Number(m[2]);
    // `Object.hasOwn`: un prefijo como "constructor" no lee el prototipo.
    const hay = Object.hasOwn(doc.contadores, prefijo);
    const proximo = hay ? doc.contadores[prefijo]! : 1;
    if (proximo > numero) continue;
    const es = hay ? `es ${proximo}` : "falta";
    p.agregar(ruta, `${describir(id)} pide que contadores.${prefijo} sea mayor que ${numero} (${es})`);
  }
}

/** Etapa 7 (D5-A): un símbolo que no está en la biblioteca abre con aviso si no tiene cables en sus bornes. */
function revisarSimbolos(doc: Documento, p: Problemas, avisos: Problemas): void {
  doc.hojas.forEach((hoja, h) => {
    const cableados = componentesCableados(hoja);
    hoja.componentes.forEach((c, i) => {
      if (buscarSimbolo(c.tipo)) return;
      const ruta = `hojas[${h}].componentes[${i}].tipo`;
      const tipo = recortar(c.tipo);
      const id = recortar(c.id);
      if (cableados.has(c.id)) p.agregar(ruta, `el símbolo «${tipo}» de «${id}» no está en la biblioteca y tiene cables en sus bornes`);
      else avisos.agregar(ruta, `El símbolo «${tipo}» de «${id}» no está en la biblioteca: se dibuja con «?»`);
    });
  });
}

/** Etapa 8 (D6-A): cada hoja pasa `validarHoja` (referencias, bornes, T sobre su anfitrión, forma). */
function revisarCables(doc: Documento, p: Problemas): void {
  doc.hojas.forEach((hoja, h) => {
    const rutas = new Map(hoja.cables.map((w, i) => [w.id, `hojas[${h}].cables[${i}]`] as const));
    for (const { id, mensaje } of validarHoja(hoja)) p.agregar(rutas.get(id) ?? id, mensaje.replace(/\.$/, ""));
  });
}

/**
 * Etapa 9: sin ciclos de apoyos (D8-A) y sin T en el primer o el último
 * punto del recorrido de su anfitrión (D9-A). `validarHoja` acepta las dos
 * cosas; acá se rechazan.
 */
function revisarApoyos(doc: Documento, p: Problemas): void {
  doc.hojas.forEach((hoja, h) => {
    const indice = indexarHoja(hoja);
    hoja.cables.forEach((w, i) => {
      const ruta = `hojas[${h}].cables[${i}]`;
      if (seApoyaEn(indice, w.id, w.id)) p.agregar(ruta, `«${recortar(w.id)}» está en un ciclo de apoyos: a través de sus T se apoya en sí mismo`);
      for (const lado of ["desde", "hasta"] as const) {
        const e = w[lado];
        if (e.tipo !== "cable") continue;
        const anfitrion = indice.cables.get(e.cable);
        const puntos = anfitrion && recorridoCable(indice, anfitrion);
        // Sin recorrido no llega acá: la etapa 8 ya lo rechazó.
        if (!puntos) continue;
        const n = puntos.length;
        const enExtremo = (puntos[0] === e.x && puntos[1] === e.y) || (puntos[n - 2] === e.x && puntos[n - 1] === e.y);
        if (enExtremo) {
          p.agregar(`${ruta}.${lado}`, `la T cae en un extremo de «${recortar(e.cable)}», en (${e.x}, ${e.y}): tiene que caer sobre el cable, sin ser uno de sus extremos`);
        }
      }
    });
  });
}

// ── deserializar ───────────────────────────────────────────────────────────

/**
 * Lee un texto .brn (ya descomprimido). Nunca tira: devuelve el documento con
 * sus avisos, o la lista de errores. El documento es nuevo: no comparte nada
 * con lo que dio `JSON.parse`.
 */
export function deserializar(texto: string): ResultadoAbrir {
  // 0. Texto.
  if (texto.length > LARGO_MAXIMO_TEXTO) return rechazoUnico("", "El archivo es demasiado grande (el máximo es 16 MB)");
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  if (texto.trim() === "") return rechazoUnico("", "El archivo está vacío");

  // 1. JSON.
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch (e) {
    const posicion = /position (\d+)/.exec(e instanceof Error ? e.message : "");
    return rechazoUnico("", `No se puede leer: el texto no es JSON válido${posicion ? ` (posición ${posicion[1]})` : ""}`);
  }

  // 2. Formato.
  if (!esObjeto(datos) || datos["formato"] !== "bornera") return rechazoUnico("", "No es un archivo de Bornera");

  // 3. Versión (D4-A).
  const version = datos["version"];
  if (!Object.hasOwn(datos, "version")) return rechazoUnico("version", "falta");
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) {
    return rechazoUnico("version", `tiene que ser un entero mayor o igual a 1 (es ${describir(version)})`);
  }
  if (version > VERSION_FORMATO) {
    return rechazoUnico("", `El archivo está hecho con una versión más nueva de Bornera (formato ${version}; esta lee hasta el ${VERSION_FORMATO})`);
  }

  // 4. Estructura.
  const estructura = new Problemas();
  const documento = new Lector(estructura).documento(datos, version);
  if (estructura.hay) return rechazo(estructura);

  // 5 y 6. Ids y contadores.
  const ids = idsConRuta(documento);
  const problemasIds = new Problemas();
  revisarIds(ids, problemasIds);
  if (problemasIds.hay) return rechazo(problemasIds);
  const problemasContadores = new Problemas();
  revisarContadores(documento, ids, problemasContadores);
  if (problemasContadores.hay) return rechazo(problemasContadores);

  // Varias hojas (D18): abre, las conserva y avisa. Va primero entre los
  // avisos, así no queda escondido en "y N más". Las etapas 5 a 9 miran todas.
  const avisos = new Problemas();
  const n = documento.hojas.length;
  if (n > 1) avisos.agregar("hojas", `Tiene ${n} hojas: solo se ve la primera`);

  // 7. Símbolos.
  const problemasSimbolos = new Problemas();
  revisarSimbolos(documento, problemasSimbolos, avisos);
  if (problemasSimbolos.hay) return rechazo(problemasSimbolos);

  // 8. Cables.
  const problemasCables = new Problemas();
  revisarCables(documento, problemasCables);
  if (problemasCables.hay) return rechazo(problemasCables);

  // 9. Apoyos y T.
  const problemasApoyos = new Problemas();
  revisarApoyos(documento, problemasApoyos);
  if (problemasApoyos.hay) return rechazo(problemasApoyos);

  return { ok: true, documento, avisos: avisos.todos() };
}
