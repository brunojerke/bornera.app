// Atajos de teclado del editor: qué acción da cada tecla. Puro, sin DOM: el
// despachador (punteros.ts) arma la `Tecla` desde el KeyboardEvent, descarta
// lo que va a un campo de texto y le pasa la acción al Editor, que decide si
// se puede hacer ahora (`Editor.accion`).
//
// - R: gira la selección (o la vista previa al colocar) 90° en sentido
//   horario; Mayús+R, antihorario. Solo cuenta la tecla Mayús de verdad: con
//   Bloq Mayús, `key` es "R" pero `mayus` es falso, y gira en sentido horario.
// - M: espeja izquierda ↔ derecha. Mayús+M no hace nada (queda libre).
// - Supr o Retroceso: borra la selección. Mayús+Supr corta (como en
//   Windows); Mayús+Retroceso, nada. Retroceso es otra acción ("borrarAtras"): con la herramienta cable y un
//   tramo en curso, quita el último codo.
// - W: herramienta cable (T13). Mayús+W y Ctrl+W, nada.
// - Ctrl+Z deshace; Ctrl+Y y Ctrl+Mayús+Z rehacen.
// - Portapapeles (T16): Ctrl+C y Ctrl+Insert copian; Ctrl+X y Mayús+Supr
//   cortan; Ctrl+V y Mayús+Insert pegan; Ctrl+D duplica. Con Ctrl+Mayús+letra,
//   nada. No se repiten al mantener la tecla: cada repetición sería un paso
//   (o una previa nueva).
// - Con Alt o Meta (Windows, Cmd), nada: son del sistema. Ctrl+R tampoco
//   (recarga en desarrollo).
// - R, M, W, Supr y Retroceso no se repiten al mantener la tecla apretada:
//   llenarían el historial de pasos. Deshacer y rehacer sí, como en
//   cualquier programa.

export type Accion =
  | "rotar"
  | "rotarAntihorario"
  | "espejar"
  | "borrar"
  | "borrarAtras"
  | "deshacer"
  | "rehacer"
  | "cable"
  | AccionPortapapeles;

/** Las acciones del portapapeles (T16). */
export type AccionPortapapeles = "copiar" | "cortar" | "pegar" | "duplicar";

/** True si `a` es copiar, cortar, pegar o duplicar. */
export function esDePortapapeles(a: Accion): a is AccionPortapapeles {
  return a === "copiar" || a === "cortar" || a === "pegar" || a === "duplicar";
}

/** Lo que importa de un KeyboardEvent. */
export interface Tecla {
  /** `KeyboardEvent.key`: la letra impresa en la tecla, según la distribución. */
  key: string;
  /** `KeyboardEvent.code`: la posición física ("KeyR"). */
  code: string;
  ctrl: boolean;
  /** Mayús apretada (`shiftKey`), no Bloq Mayús. */
  mayus: boolean;
  alt: boolean;
  meta: boolean;
  /** Autorrepetición por mantener la tecla apretada. */
  repeat: boolean;
}

/** Arma la Tecla desde un KeyboardEvent (o algo con los mismos campos). */
export function teclaDe(e: {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
}): Tecla {
  return { key: e.key, code: e.code, ctrl: e.ctrlKey, mayus: e.shiftKey, alt: e.altKey, meta: e.metaKey, repeat: e.repeat };
}

/**
 * La letra de la tecla, en minúscula: la impresa (`key`), así R es R en
 * cualquier distribución latina; si no es una letra latina (teclado ruso,
 * griego), la de la posición física (`code`). Null si no es una letra.
 * También la usan los atajos de archivo (src/ui/archivo.ts).
 */
export function letra(t: Pick<Tecla, "key" | "code">): string | null {
  if (/^[a-z]$/i.test(t.key)) return t.key.toLowerCase();
  const m = /^Key([A-Z])$/.exec(t.code);
  return m ? m[1]!.toLowerCase() : null;
}

/** La acción de la tecla, o null si no es un atajo del editor. */
export function accionDeTecla(t: Tecla): Accion | null {
  if (t.alt || t.meta) return null;
  const l = letra(t);
  if (t.ctrl) {
    if (l === "z") return t.mayus ? "rehacer" : "deshacer";
    if (l === "y" && !t.mayus) return "rehacer";
    if (t.repeat || t.mayus) return null;
    if (l === "c" || t.key === "Insert") return "copiar";
    if (l === "x") return "cortar";
    if (l === "v") return "pegar";
    if (l === "d") return "duplicar";
    return null;
  }
  if (t.repeat) return null;
  if (t.key === "Insert") return t.mayus ? "pegar" : null;
  if (t.key === "Delete") return t.mayus ? "cortar" : "borrar";
  if (t.key === "Backspace") return t.mayus ? null : "borrarAtras";
  if (l === "r") return t.mayus ? "rotarAntihorario" : "rotar";
  if (l === "m" && !t.mayus) return "espejar";
  if (l === "w" && !t.mayus) return "cable";
  return null;
}
