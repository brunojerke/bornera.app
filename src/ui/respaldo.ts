// Copia de recuperación (T23, D2a-A): el almacén en IndexedDB del webview.
//
// Esquema fijo (docs/plan-T23.md, sección 2): base `bornera`, versión 1,
// almacén `copias` con keyPath `id`, una copia por instancia. El registro
// lleva su propio número de esquema, que no es la versión del formato `.brn`.
//
// Etapa 1a: el esquema, abrir la base y esperar una transacción, lo que usa
// «Medir la copia (F1)». Listar, borrar, adoptar y los candados de Web Locks
// llegan en la etapa 1.

import type { Documento } from "../core/model/documento";

export const BASE_COPIAS = "bornera";
export const VERSION_BASE = 1;
export const ALMACEN_COPIAS = "copias";

/** Una copia de recuperación (esquema 1). */
export interface RegistroCopia {
  /** Instancia dueña. */
  id: string;
  esquema: 1;
  /** `serializar(documento)`: el formato `.brn` en una línea, sin gzip. */
  texto: string;
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

/** El registro de la copia de `doc`, con su texto ya serializado. */
export function registroCopia(
  id: string,
  doc: Documento,
  texto: string,
  archivo: RegistroCopia["archivo"],
  version: string,
  fecha: number,
): RegistroCopia {
  let componentes = 0;
  for (const h of doc.hojas) componentes += h.componentes.length;
  return { id, esquema: 1, texto, archivo, titulo: doc.meta.titulo, componentes, fecha, version };
}

/**
 * Abre la base de las copias y, si no existe o es de una versión anterior,
 * crea su almacén. Tira un Error si IndexedDB no está o no abre.
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
    pedido.onupgradeneeded = () => {
      const base = pedido.result;
      if (!base.objectStoreNames.contains(ALMACEN_COPIAS)) base.createObjectStore(ALMACEN_COPIAS, { keyPath: "id" });
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
