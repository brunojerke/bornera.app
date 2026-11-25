// Chequeos de una definición de símbolo que el sistema de tipos no puede hacer.
// Cada símbolo nuevo debe pasar `validarDefinicion` en su test de bornes.

import { esFuente, esSeguidor, tienePolos, type DefinicionSimbolo, type Direccion, type Primitiva } from "./tipos";

/** Prefijo de etiqueta válido: solo letras mayúsculas. */
const PREFIJO_VALIDO = /^[A-Z]+$/;

/** La primitiva (sin textos) cabe en la caja de `ancho` × `alto` centrada en el origen. */
function primitivaEnCaja(p: Exclude<Primitiva, { forma: "texto" }>, ancho: number, alto: number): boolean {
  const e = 1e-9;
  const adentro = (x: number, y: number) => Math.abs(x) <= ancho / 2 + e && Math.abs(y) <= alto / 2 + e;
  switch (p.forma) {
    case "linea":
      return adentro(p.x1, p.y1) && adentro(p.x2, p.y2);
    case "arco":
    case "circulo":
      return adentro(p.cx - p.r, p.cy - p.r) && adentro(p.cx + p.r, p.cy + p.r);
    case "rectangulo":
      return adentro(p.x, p.y) && adentro(p.x + p.ancho, p.y + p.alto);
  }
}

/** Dos textos iguales: posición, texto, alto y alineación. */
function mismoTexto(a: Extract<Primitiva, { forma: "texto" }>, b: Extract<Primitiva, { forma: "texto" }>): boolean {
  return a.x === b.x && a.y === b.y && a.texto === b.texto && a.alto === b.alto && (a.alineacion ?? "izquierda") === (b.alineacion ?? "izquierda");
}

/**
 * Hacia dónde queda afuera desde un punto del borde de una caja de
 * `ancho` × `alto` centrada en el origen: una dirección en un lado, dos en una
 * esquina, ninguna si el punto está adentro.
 */
export function direccionesAfuera(x: number, y: number, ancho: number, alto: number): Direccion[] {
  const d: Direccion[] = [];
  if (y === -alto / 2) d.push("arriba");
  if (y === alto / 2) d.push("abajo");
  if (x === -ancho / 2) d.push("izquierda");
  if (x === ancho / 2) d.push("derecha");
  return d;
}

/** Devuelve la lista de errores de la definición; vacía si está bien. */
export function validarDefinicion(def: DefinicionSimbolo): string[] {
  const errores: string[] = [];
  const { ancho, alto } = def.tamano;

  if (def.tipo.trim() === "") errores.push("El tipo está vacío.");
  if (def.nombre.trim() === "") errores.push("El nombre está vacío.");

  if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho <= 0 || alto <= 0) {
    errores.push(`El tamaño debe ser entero y positivo (es ${ancho}×${alto}).`);
  }

  // Etiquetado (T17): cada símbolo es fuente, seguidor o tiene prefijo.
  const prefijo = def.prefijoEtiqueta;
  if (esFuente(def) || esSeguidor(def)) {
    if (prefijo !== undefined) {
      const quien = esFuente(def) ? "Una fuente" : "Un contacto que sigue a otro";
      errores.push(`${quien} no lleva prefijo de etiqueta (tiene "${prefijo}").`);
    }
  } else if (prefijo === undefined) {
    errores.push("Falta el prefijo de etiqueta: el símbolo se numera al colocarlo.");
  } else if (!PREFIJO_VALIDO.test(prefijo)) {
    errores.push(`El prefijo de etiqueta tiene que ser solo letras mayúsculas (es "${prefijo}").`);
  }
  const primero = def.primerNumero;
  if (primero !== undefined) {
    if (prefijo === undefined) errores.push(`El primer número va solo con prefijo de etiqueta (es ${primero}).`);
    else if (!Number.isSafeInteger(primero) || primero < 0) {
      errores.push(`El primer número tiene que ser un entero ≥ 0 (es ${primero}).`);
    }
  }

  // Dibujo accionado (T33): solo contactos y protecciones (T36, D20-B), dentro
  // de la caja. Un texto solo si el reposo tiene uno igual (la «N» del neutro,
  // «IΔ»): así la caja de dibujo es la misma en los dos estados.
  const accionado = def.primitivasAccionado;
  if (accionado !== undefined) {
    if (!tienePolos(def)) errores.push("Solo un contacto o una protección lleva dibujo accionado.");
    for (const p of accionado) {
      if (p.forma === "texto") {
        if (!def.primitivas.some((q) => q.forma === "texto" && mismoTexto(p, q))) errores.push("El dibujo accionado solo lleva los textos del reposo.");
      } else if (!primitivaEnCaja(p, ancho, alto)) errores.push(`El dibujo accionado sale de la caja del símbolo (${p.forma}).`);
    }
  }

  if (def.bornes.length === 0) errores.push("El símbolo no tiene bornes.");

  const nombres = new Set<string>();
  const posiciones = new Map<string, string>();
  for (const b of def.bornes) {
    if (b.nombre.trim() === "") errores.push("Hay un borne sin nombre.");

    if (nombres.has(b.nombre)) errores.push(`Borne "${b.nombre}" repetido.`);
    nombres.add(b.nombre);

    if (!Number.isInteger(b.x) || !Number.isInteger(b.y)) {
      errores.push(`Borne "${b.nombre}" fuera de la grilla: (${b.x}, ${b.y}).`);
    }

    if (Math.abs(b.x) > ancho / 2 || Math.abs(b.y) > alto / 2) {
      errores.push(`Borne "${b.nombre}" fuera de la caja del símbolo: (${b.x}, ${b.y}).`);
    } else {
      // En el borde y apuntando hacia afuera de ese borde: un cable no puede
      // atravesar el cuerpo (T13), así que un borne adentro sería inalcanzable.
      // En una esquina vale cualquiera de los dos bordes.
      const afuera = direccionesAfuera(b.x, b.y, ancho, alto);
      if (afuera.length === 0) {
        errores.push(`Borne "${b.nombre}" adentro de la caja del símbolo: (${b.x}, ${b.y}); tiene que estar en el borde.`);
      } else if (!afuera.includes(b.direccion)) {
        errores.push(`Borne "${b.nombre}" apunta hacia ${b.direccion}: tiene que apuntar hacia afuera (${afuera.join(" o ")}).`);
      }
    }

    const clave = `${b.x},${b.y}`;
    const otro = posiciones.get(clave);
    if (otro !== undefined) {
      errores.push(`Bornes "${otro}" y "${b.nombre}" en la misma posición (${b.x}, ${b.y}).`);
    } else {
      posiciones.set(clave, b.nombre);
    }
  }

  // Polos (T34; protecciones, T35 D13-A): solo contactos y protecciones; cada
  // polo, dos bornes distintos que existen; cada borne en un solo polo; uno
  // que no tiene 2 bornes, todos en polos.
  const esContacto = tienePolos(def);
  if (def.polos !== undefined) {
    if (!esContacto) errores.push("Solo un contacto o una protección lleva polos.");
    if (def.polos.length === 0) errores.push("La lista de polos está vacía.");
    const enPolo = new Set<string>();
    for (const polo of def.polos) {
      const [a, b] = polo;
      if (polo.length !== 2 || a === b) errores.push(`El polo ${polo.join("-")} tiene que unir dos bornes distintos.`);
      for (const n of polo) {
        if (!nombres.has(n)) errores.push(`El polo ${polo.join("-")} nombra un borne que no existe: "${n}".`);
        else if (enPolo.has(n)) errores.push(`Borne "${n}" en dos polos.`);
        enPolo.add(n);
      }
    }
    if (esContacto) for (const b of def.bornes) if (!enPolo.has(b.nombre)) errores.push(`Borne "${b.nombre}" sin polo.`);
  } else if (esContacto && def.bornes.length > 0 && def.bornes.length !== 2) {
    const quien = def.elemento === "proteccion" ? "Una protección" : "Un contacto";
    errores.push(`${quien} de ${def.bornes.length} bornes necesita polos.`);
  }

  return errores;
}
