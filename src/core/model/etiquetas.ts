// Reglas de las etiquetas que el usuario escribe en el panel de propiedades.
//
// - No se exige que sean únicas: la bobina y los contactos de un contactor
//   comparten la etiqueta (K1), y varias fases "L" son la misma red.
// - Se validan solo al editar. El documento acepta cualquier texto: un `.brn`
//   con "k1" o un carácter que hoy no se permite se carga y se conserva tal cual.
// - En fase y neutro la etiqueta es el nombre de la red. Los nombres se
//   comparan normalizados (sin espacios a los lados y en mayúsculas): "l1 " y
//   "L1" son la misma red (ver "Etiquetas de red" en docs/plan-fase3.md).

/** Largo máximo de una etiqueta, en caracteres. */
export const LARGO_MAXIMO_ETIQUETA = 12;

/** Caracteres permitidos (antes de pasar a mayúsculas). */
const PERMITIDOS = /^[A-Za-z0-9\-_.+/=:]*$/;
const PERMITIDO = /[A-Za-z0-9\-_.+/=:]/;

/** Sin espacios a los lados y en mayúsculas: como se guarda y como se comparan las redes. */
export function normalizarEtiqueta(texto: string): string {
  return texto.trim().toUpperCase();
}

/**
 * Error de la etiqueta escrita, para mostrar; null si se puede confirmar.
 * `esFuente`: fase o neutro, donde la etiqueta es el nombre de la red y no
 * puede quedar vacía.
 */
export function validarEtiqueta(texto: string, esFuente: boolean): string | null {
  const t = texto.trim();
  if (t === "") return esFuente ? "La alimentación necesita un nombre de red" : null;
  if (/\s/.test(t)) return "Sin espacios";
  if (!PERMITIDOS.test(t)) {
    const malo = [...t].find((ch) => !PERMITIDO.test(ch));
    return `Carácter no permitido: «${malo}»`;
  }
  if (t.length > LARGO_MAXIMO_ETIQUETA) return `Máximo ${LARGO_MAXIMO_ETIQUETA} caracteres`;
  return null;
}
