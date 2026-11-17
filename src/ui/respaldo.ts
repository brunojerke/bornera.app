// Copia de recuperación (T23, D2a-A): el almacén en IndexedDB del webview.
//
// Esquema (docs/plan-T23.md, sección 2; por trozos desde la etapa 1b):
// - base `bornera`, versión 2 (la 1 la usó solo el arnés de la etapa 1a, sin
//   publicar: al subir se vacía lo que hubiera);
// - `copias` (keyPath `id`): el registro chico de la copia completa de cada
//   instancia. Al arrancar se leen solo estos;
// - `trozos` (keyPath `[id, generacion, n]`): el texto, por trozos. Cada
//   intento de copia es una generación; el registro dice cuál está completa.
//
// Cada trozo va en su transacción, con su `put`: ningún paso junta el texto
// entero. Al final, `completar` escribe el registro y borra las generaciones
// anteriores en una sola transacción, así la copia completa anterior vale
// hasta que la nueva queda escrita. Todo con `durability: "strict"`.
//
// Hay dos almacenes con la misma interfaz: el de IndexedDB y uno en memoria
// para los tests (IndexedDB no está en Node).

import type { Documento } from "../core/model/documento";

export const BASE_COPIAS = "bornera";
export const VERSION_BASE = 2;
export const ALMACEN_COPIAS = "copias";
export const ALMACEN_TROZOS = "trozos";

/** Un trozo del texto de una copia. Unidos en orden de `n` dan `serializar(documento)`. */
export interface Trozo {
  id: string;
  generacion: number;
  n: number;
  texto: string;
}

/** El registro de una copia completa (esquema 1). */
export interface RegistroCopia {
  /** Instancia dueña. */
  id: string;
  esquema: 1;
  /** La generación completa. */
  generacion: number;
  /** Cuántos trozos tiene (de 0 a `trozos - 1`). */
  trozos: number;
  /** Largo del texto unido, para comprobar al leer. */
  caracteres: number;
  /** Archivo actual al copiar; `ruta` es null en el navegador. Null si nunca se guardó. */
  archivo: { nombre: string; ruta: string | null } | null;
  /** `meta.titulo`, para nombrar una copia sin archivo. */
  titulo: string;
  /** Componentes de todas las hojas, para distinguir copias en la lista. */
  componentes: number;
  /** `Date.now()` de la copia. */
  fecha: number;
  /** Versión de Bornera que la escribió. */
  version: string;
}

/** El registro de la copia completa de `doc`. */
export function registroCopia(
  id: string,
  doc: Documento,
  partes: { generacion: number; trozos: number; caracteres: number },
  archivo: RegistroCopia["archivo"],
  version: string,
  fecha: number,
): RegistroCopia {
  let componentes = 0;
  for (const h of doc.hojas) componentes += h.componentes.length;
  return { id, esquema: 1, ...partes, archivo, titulo: doc.meta.titulo, componentes, fecha, version };
}

/**
 * Lo que da leer una copia: el texto unido, o por qué no se puede. Si hay
 * registro pero los trozos no dan, `parcial` trae lo que hay unido (para
 * exportarlo tal cual).
 */
export type CopiaLeida = { ok: true; registro: RegistroCopia; texto: string } | { ok: false; problema: string; parcial?: string };

/**
 * Las copias guardadas. Cada escritura hace su parte síncrona al llamarla
 * (abrir la transacción y pedir el `put`) y devuelve la promesa de que quedó
 * escrita (`complete`), o el error.
 */
export interface AlmacenCopias {
  escribirTrozo(trozo: Trozo): Promise<void>;
  /** Escribe el registro y borra los trozos de las generaciones anteriores de ese `id`, en una sola transacción. */
  completar(registro: RegistroCopia): Promise<void>;
  /** La copia completa de `id`, con sus trozos unidos y comprobados. */
  leer(id: string): Promise<CopiaLeida>;
  /** Los registros de las copias completas, sin las de «Medir la copia (F1)». */
  listar(): Promise<RegistroCopia[]>;
  /** Borra el registro y todos los trozos de `id` (completos o no). */
  borrar(id: string): Promise<void>;
  /** Los ids que tienen trozos (con copia completa o no), sin las mediciones. */
  idsConTrozos(): Promise<string[]>;
  cerrar(): void;
}

/** Une los trozos de una copia y comprueba que estén todos y que el largo dé. */
export function unirTrozos(registro: RegistroCopia, trozos: readonly Trozo[]): CopiaLeida {
  const orden = trozos.filter((t) => t.generacion === registro.generacion).sort((a, b) => a.n - b.n);
  const texto = orden.map((t) => t.texto).join("");
  if (orden.length !== registro.trozos || orden.some((t, i) => t.n !== i)) {
    return { ok: false, problema: `Faltan trozos de la copia: hay ${orden.length} de ${registro.trozos}`, parcial: texto };
  }
  if (texto.length !== registro.caracteres) {
    return { ok: false, problema: `La copia tiene ${texto.length} caracteres y tendría que tener ${registro.caracteres}`, parcial: texto };
  }
  return { ok: true, registro, texto };
}

const NO_HAY_COPIA = "No hay una copia completa";

/** Prefijo de las copias de «Medir la copia (F1)»: nunca son copias de recuperación. */
export const PREFIJO_MEDICION = "medicion-";

/** El motivo de un fallo de IndexedDB, para el aviso de la barra (una vez por sesión). */
export function motivoFallo(e: unknown): string {
  if ((e as { name?: unknown } | null)?.name === "QuotaExceededError") return "no hay espacio en el disco";
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return m.trim() || "IndexedDB no está disponible";
}

/** El id de esta instancia: al azar, uno por arranque. */
export function idInstancia(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// ── Candados (D2d-B) ───────────────────────────────────────────────────────
// La instancia viva toma el candado de su id y no lo suelta nunca: se suelta
// solo cuando la página o el proceso mueren. Una copia sin dueño es la de un
// id cuyo candado está libre.

/** Nombre del candado de Web Locks de la instancia `id`. */
export const candado = (id: string) => `bornera-copia-${id}`;

export interface Candados {
  /** Toma el candado de esta instancia para siempre. */
  tomarPropio(id: string): void;
  /** Los ids con el candado tomado ahora (por esta u otra instancia viva), sin tomar nada. */
  conDueno(): Promise<Set<string>>;
  /**
   * Si el candado de `id` está libre (su instancia murió), lo toma y devuelve
   * cómo soltarlo; si tiene dueño, null. Mientras se retiene, otra instancia
   * no ofrece esa copia.
   */
  retener(id: string): Promise<(() => void) | null>;
}

/** Candados de Web Locks; null si `navigator.locks` no está (contexto no seguro o motor viejo). */
export function candadosWebLocks(locks: LockManager | undefined = globalThis.navigator?.locks): Candados | null {
  if (!locks) return null;
  return {
    tomarPropio(id) {
      void locks.request(candado(id), () => new Promise<never>(() => {}));
    },
    async conDueno() {
      const estado = await locks.query();
      const ids = new Set<string>();
      for (const l of estado.held ?? []) if (l.name?.startsWith("bornera-copia-")) ids.add(l.name.slice("bornera-copia-".length));
      return ids;
    },
    retener(id) {
      return new Promise((resolver) => {
        void locks.request(candado(id), { ifAvailable: true }, (lock) => {
          if (!lock) {
            resolver(null);
            return undefined;
          }
          // El candado dura lo que esta promesa: se suelta al llamar a `soltar`.
          return new Promise<void>((soltar) => resolver(() => soltar()));
        });
      });
    },
  };
}

/** Candados en memoria (tests): `vivos` son los ids con dueño. */
export function candadosMemoria(vivos = new Set<string>()): Candados & { vivos: Set<string> } {
  return {
    vivos,
    tomarPropio(id) {
      vivos.add(id);
    },
    conDueno() {
      return Promise.resolve(new Set(vivos));
    },
    retener(id) {
      if (vivos.has(id)) return Promise.resolve(null);
      vivos.add(id);
      return Promise.resolve(() => void vivos.delete(id));
    },
  };
}

// ── En memoria (tests) ─────────────────────────────────────────────────────

export interface OpcionesMemoria {
  /** Si da true, la escritura de ese trozo falla (como un disco lleno). */
  fallarTrozo?: (trozo: Trozo) => boolean;
}

/** Almacén en memoria con la misma conducta que el de IndexedDB (cada escritura se ve enseguida). */
export function almacenMemoria(opciones: OpcionesMemoria = {}): AlmacenCopias & { trozos: Trozo[]; registros: Map<string, RegistroCopia> } {
  const registros = new Map<string, RegistroCopia>();
  let trozos: Trozo[] = [];
  return {
    get trozos() {
      return trozos;
    },
    registros,
    escribirTrozo(t) {
      if (opciones.fallarTrozo?.(t)) return Promise.reject(new DOMException("No hay espacio", "QuotaExceededError"));
      trozos = trozos.filter((x) => !(x.id === t.id && x.generacion === t.generacion && x.n === t.n));
      trozos.push({ ...t });
      return Promise.resolve();
    },
    completar(r) {
      registros.set(r.id, { ...r });
      trozos = trozos.filter((t) => t.id !== r.id || t.generacion >= r.generacion);
      return Promise.resolve();
    },
    leer(id) {
      const r = registros.get(id);
      if (!r) return Promise.resolve({ ok: false, problema: NO_HAY_COPIA });
      return Promise.resolve(unirTrozos(r, trozos.filter((t) => t.id === id)));
    },
    listar() {
      return Promise.resolve([...registros.values()].filter((r) => !r.id.startsWith(PREFIJO_MEDICION)).map((r) => ({ ...r })));
    },
    borrar(id) {
      registros.delete(id);
      trozos = trozos.filter((t) => t.id !== id);
      return Promise.resolve();
    },
    idsConTrozos() {
      return Promise.resolve([...new Set(trozos.map((t) => t.id))].filter((id) => !id.startsWith(PREFIJO_MEDICION)));
    },
    cerrar() {},
  };
}

// ── IndexedDB ──────────────────────────────────────────────────────────────

/**
 * Abre la base de las copias y crea o pone al día sus almacenes. Tira un
 * Error si IndexedDB no está o no abre.
 */
export function abrirBase(fabrica: IDBFactory | undefined = globalThis.indexedDB): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    if (!fabrica) {
      rechazar(new Error("IndexedDB no está disponible"));
      return;
    }
    let pedido: IDBOpenDBRequest;
    try {
      pedido = fabrica.open(BASE_COPIAS, VERSION_BASE);
    } catch (e) {
      rechazar(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    pedido.onupgradeneeded = (e) => {
      const base = pedido.result;
      // La versión 1 (solo el arnés de la etapa 1a) guardaba el texto entero en `copias`: no sirve.
      if (e.oldVersion < 2 && base.objectStoreNames.contains(ALMACEN_COPIAS)) base.deleteObjectStore(ALMACEN_COPIAS);
      if (!base.objectStoreNames.contains(ALMACEN_COPIAS)) base.createObjectStore(ALMACEN_COPIAS, { keyPath: "id" });
      if (!base.objectStoreNames.contains(ALMACEN_TROZOS)) base.createObjectStore(ALMACEN_TROZOS, { keyPath: ["id", "generacion", "n"] });
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error ?? new Error("No se pudo abrir IndexedDB"));
  });
}

/** Se cumple cuando la transacción termina bien (`complete`); si se aborta o falla, con su error. */
export function terminada(tx: IDBTransaction): Promise<void> {
  return new Promise((resolver, rechazar) => {
    tx.oncomplete = () => resolver();
    tx.onabort = () => rechazar(tx.error ?? new Error("Se abortó la escritura en IndexedDB"));
    tx.onerror = () => rechazar(tx.error ?? new Error("Falló la escritura en IndexedDB"));
  });
}

/** El resultado de un pedido de IndexedDB. */
function resultado<T>(pedido: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rechazar) => {
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error ?? new Error("Falló la lectura en IndexedDB"));
  });
}

/** Los trozos de `id`: de una generación, o de todas. */
function rangoTrozos(id: string, generacion?: number): IDBKeyRange {
  return generacion === undefined
    ? IDBKeyRange.bound([id, -Infinity, -Infinity], [id, Infinity, Infinity])
    : IDBKeyRange.bound([id, generacion, -Infinity], [id, generacion, Infinity]);
}

/** El almacén sobre una base ya abierta con `abrirBase`. */
export function almacenIndexedDB(base: IDBDatabase): AlmacenCopias {
  const escribir = (almacenes: string[]) => base.transaction(almacenes, "readwrite", { durability: "strict" });
  return {
    escribirTrozo(t) {
      const tx = escribir([ALMACEN_TROZOS]);
      tx.objectStore(ALMACEN_TROZOS).put(t);
      return terminada(tx);
    },
    completar(r) {
      const tx = escribir([ALMACEN_COPIAS, ALMACEN_TROZOS]);
      tx.objectStore(ALMACEN_COPIAS).put(r);
      // Las generaciones anteriores: de [id, -∞, -∞] hasta [id, g, -∞], sin incluirlo.
      tx.objectStore(ALMACEN_TROZOS).delete(IDBKeyRange.bound([r.id, -Infinity, -Infinity], [r.id, r.generacion, -Infinity], false, true));
      return terminada(tx);
    },
    async leer(id) {
      const tx = base.transaction([ALMACEN_COPIAS, ALMACEN_TROZOS], "readonly");
      const r = (await resultado(tx.objectStore(ALMACEN_COPIAS).get(id))) as RegistroCopia | undefined;
      if (!r) return { ok: false, problema: NO_HAY_COPIA };
      const trozos = (await resultado(tx.objectStore(ALMACEN_TROZOS).getAll(rangoTrozos(id, r.generacion)))) as Trozo[];
      return unirTrozos(r, trozos);
    },
    async listar() {
      const tx = base.transaction(ALMACEN_COPIAS, "readonly");
      const todos = (await resultado(tx.objectStore(ALMACEN_COPIAS).getAll())) as RegistroCopia[];
      return todos.filter((r) => !r.id.startsWith(PREFIJO_MEDICION));
    },
    borrar(id) {
      const tx = escribir([ALMACEN_COPIAS, ALMACEN_TROZOS]);
      tx.objectStore(ALMACEN_COPIAS).delete(id);
      tx.objectStore(ALMACEN_TROZOS).delete(rangoTrozos(id));
      return terminada(tx);
    },
    async idsConTrozos() {
      // Solo las claves ([id, generacion, n]), sin leer los textos.
      const tx = base.transaction(ALMACEN_TROZOS, "readonly");
      const claves = (await resultado(tx.objectStore(ALMACEN_TROZOS).getAllKeys())) as [string, number, number][];
      return [...new Set(claves.map((k) => k[0]))].filter((id) => !id.startsWith(PREFIJO_MEDICION));
    },
    cerrar() {
      base.close();
    },
  };
}
