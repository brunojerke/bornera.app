// Abrir reciente (T24, D8-A): las últimas rutas abiertas o guardadas, en
// `localStorage`. Solo en el escritorio: en el navegador no hay rutas.
//
// - Hasta 8, la más nueva primero. Un repetido sube arriba con la forma nueva.
// - En Windows, dos rutas son la misma sin mirar mayúsculas y con `/` igual a
//   `\` (el sistema de archivos no las distingue). En Linux, solo si son
//   iguales letra por letra.
// - Entran las rutas `.brn` y `.brn.json` (sin mirar mayúsculas): las que el
//   alcance de fs deja abrir sin el diálogo, después de reiniciar.
// - Todo acceso a `localStorage` va con `try`: si no se puede leer o escribir
//   (almacenamiento bloqueado o lleno), la lista queda vacía o sin cambios, y
//   la app sigue.
// - `localStorage` es por origen: `tauri dev` (el servidor de Vite) y la
//   app compilada tienen listas separadas.

/** Cuántas rutas guarda la lista. */
export const TOPE_RECIENTES = 8;

/** Clave de la lista en `localStorage`. */
export const CLAVE_RECIENTES = "bornera.recientes";

/** Lo que se usa de `localStorage` (inyectable, para probarlo). */
export interface AlmacenRecientes {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

/** El sistema es Windows, según el user agent del webview (WebView2 dice «Windows NT»). */
export function esWindows(userAgent: string): boolean {
  return /Windows/i.test(userAgent);
}

/** La forma con que se comparan dos rutas: en Windows, sin mayúsculas y con `\`; en Linux, tal cual. */
function clave(ruta: string, windows: boolean): string {
  return windows ? ruta.replace(/\//g, "\\").toLowerCase() : ruta;
}

/** Dos rutas son el mismo archivo (ver arriba). */
export function mismaRuta(a: string, b: string, windows: boolean): boolean {
  return clave(a, windows) === clave(b, windows);
}

/** La ruta termina en `.brn` o `.brn.json`, sin mirar mayúsculas: el alcance de fs la deja abrir. */
export function entraEnRecientes(ruta: string): boolean {
  return /\.brn(\.json)?$/i.test(ruta);
}

/** La lista con `ruta` primero, sin repetidos y hasta el tope. Una ruta que no entra deja la lista igual. */
export function agregarReciente(lista: readonly string[], ruta: string, windows: boolean): string[] {
  if (!entraEnRecientes(ruta)) return [...lista];
  return [ruta, ...lista.filter((r) => !mismaRuta(r, ruta, windows))].slice(0, TOPE_RECIENTES);
}

/** La lista sin `ruta` (ni otra forma de la misma). */
export function quitarReciente(lista: readonly string[], ruta: string, windows: boolean): string[] {
  return lista.filter((r) => !mismaRuta(r, ruta, windows));
}

/**
 * La lista guardada. Lo que no sea una lista de textos se descarta; los
 * repetidos y lo que pasa del tope se quitan. Si no se puede leer, vacía.
 */
export function leerRecientes(almacen: AlmacenRecientes | null, windows: boolean): string[] {
  let crudo: unknown;
  try {
    const texto = almacen?.getItem(CLAVE_RECIENTES) ?? null;
    if (texto === null) return [];
    crudo = JSON.parse(texto);
  } catch {
    return [];
  }
  if (!Array.isArray(crudo)) return [];
  let lista: string[] = [];
  // De la más vieja a la más nueva, así cada repetido queda en su lugar más nuevo.
  for (const r of [...crudo].reverse()) if (typeof r === "string" && r !== "") lista = agregarReciente(lista, r, windows);
  return lista;
}

/** Guarda la lista. Devuelve si se pudo. */
export function escribirRecientes(almacen: AlmacenRecientes | null, lista: readonly string[]): boolean {
  if (!almacen) return false;
  try {
    almacen.setItem(CLAVE_RECIENTES, JSON.stringify(lista));
    return true;
  } catch {
    return false;
  }
}

/**
 * La lista de una ventana. Cada cambio se hace sobre lo guardado en ese
 * momento: si otra ventana de Bornera sumó una ruta, no se pierde.
 */
export class Recientes {
  constructor(
    private readonly almacen: () => AlmacenRecientes | null,
    private readonly windows: boolean,
  ) {}

  /** La lista guardada, la más nueva primero. */
  lista(): string[] {
    return leerRecientes(this.almacenSeguro(), this.windows);
  }

  /** Suma `ruta` arriba (Abrir, Guardar o Guardar como). Devuelve la lista nueva. */
  agregar(ruta: string): string[] {
    const lista = agregarReciente(this.lista(), ruta, this.windows);
    escribirRecientes(this.almacenSeguro(), lista);
    return lista;
  }

  /** Quita `ruta` (el archivo ya no existe). Devuelve la lista nueva. */
  quitar(ruta: string): string[] {
    const lista = quitarReciente(this.lista(), ruta, this.windows);
    escribirRecientes(this.almacenSeguro(), lista);
    return lista;
  }

  /** Leer `localStorage` puede tirar (almacenamiento bloqueado). */
  private almacenSeguro(): AlmacenRecientes | null {
    try {
      return this.almacen();
    } catch {
      return null;
    }
  }
}
