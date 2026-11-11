// Reconectar un extremo libre (T14c): arrastrar el extremo libre de un cable
// hasta un borne o hasta otro cable (T) lo conecta. Sin dependencias del
// navegador. La vista previa del editor y el comando `CambiarExtremo` usan la
// misma función, `planearReconexion`, con la misma consulta.
//
// El recorrido se orienta del extremo fijo (el que no se agarró) al agarrado.
// Qué se conserva (D4-B, D5-B limitada):
// - Sin T apoyadas en el cable: el parcial de T14a completo (estirar; rutear
//   desde el codo j, de k−1 a 0; el fresco si tiene menos codos).
// - Con T apoyadas: lo que va del extremo fijo hasta la última T apoyada queda
//   igual, punto por punto, y el parcial se aplica solo al resto, con ancla en
//   el punto de esa T (sin volver sobre lo conservado). Sin fresco del cable
//   entero. Las T apoyadas nunca se mueven: cambia un solo cable.
//
// Validación, la misma para la previa y para el comando, en este orden: sobre
// sí mismo, mismo borne, los dos extremos sobre el mismo anfitrión (D6-A),
// ciclo de apoyos (D7-C), largo cero, el extremo sobre una T apoyada, la T en
// el extremo de su anfitrión cuando ese extremo es otra T (así no queda una T
// sobre el extremo de su anfitrión, ni por este lado ni por el de las T
// apoyadas; con un extremo suelto o un borne lo frena el trazado). Después,
// cada candidato en orden: la estructura y las conexiones aparentes
// (`prepararCableExistente`), que bloquean solo los conflictos nuevos, por
// clave, como en T14a. Gana el primero sin problemas; si ninguno pasa, queda el
// primero con sus problemas, para dibujarlo a rayas.

import { copiarCable, borneDe, puntoExtremo, puntoSobreRecorrido, recorridoCable, seApoyaEn, type IndiceHoja } from "./cables";
import type { Cable, Extremo } from "./documento";
import { direccionDe, formaInvalida, opuesta, perpendiculares, simplificar, type ExtremoRuta } from "./ruteo";
import {
  candidatosEntero,
  candidatosParcial,
  codosDe,
  contarCodos,
  extremoRutaBorne,
  incumpleSalida,
  invertir,
  minimoCodosFresco,
  salidas,
  type CableCambiado,
  type Candidato,
  type EntornoPlan,
  type Rechazo,
} from "./seguir";
import {
  MENSAJE_MISMO_BORNE,
  MENSAJE_SIN_LARGO,
  consultaSinCable,
  prepararCableExistente,
  problemasTrazado,
  type Conflicto,
  type ConsultaTrazado,
} from "./trazado";

export const MENSAJE_APOYO_CICLO = "Ese cable se apoya en el que estás conectando: no se pueden apoyar uno en otro.";
export const MENSAJE_MISMO_ANFITRION = "Los dos extremos quedarían sobre el mismo cable.";
export const MENSAJE_SOBRE_SI_MISMO = "El cable no puede terminar sobre sí mismo.";
export const MENSAJE_T_EN_EXTREMO = "Ahí llega la derivación de otro cable: el extremo no puede quedar sobre ella.";
export const MENSAJE_SIN_LLEGADA = "El cable no tiene por dónde llegar ahí.";
/** La T caería en el extremo de su anfitrión, que ahí termina en T sobre otro cable (agregado al plan después de la etapa 1). */
export const MENSAJE_EXTREMO_ANFITRION = "Ahí termina ese cable: la derivación no puede quedar en su extremo.";
/** Rehacer cuando el cable ya no está como cuando se reconectó: no se reconecta por otro camino. */
export const MENSAJE_NO_REHACER = "El cable cambió desde que se conectó: no se puede rehacer.";

export type LadoCable = "desde" | "hasta";

/** A dónde se conecta el extremo: un borne o un punto de otro cable (T). */
export type DestinoExtremo = Exclude<Extremo, { tipo: "libre" }>;

/** Lo que da `planearReconexion`. */
export interface ResultadoReconexion {
  id: string;
  lado: LadoCable;
  destino: DestinoExtremo;
  /** Copia del cable como estaba (para deshacer y para saber si el resultado sigue valiendo). */
  antes: Cable;
  /**
   * El cable como queda. Con rechazo, el primer intento (para dibujarlo a
   * rayas), o null si el rechazo es anterior al ruteo.
   */
  cable: CableCambiado | null;
  /** null si vale. */
  rechazo: Rechazo | null;
}

/** Una T de otro cable apoyada en el que se reconecta. */
interface TApoyada {
  x: number;
  y: number;
}

/** Las T de otros cables apoyadas en `id` (`puntos`: su recorrido). Consulta solo la caja del recorrido. */
function tApoyadas(consulta: ConsultaTrazado, id: string, puntos: readonly number[]): TApoyada[] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i + 1 < puntos.length; i += 2) {
    x0 = Math.min(x0, puntos[i]!);
    y0 = Math.min(y0, puntos[i + 1]!);
    x1 = Math.max(x1, puntos[i]!);
    y1 = Math.max(y1, puntos[i + 1]!);
  }
  const salida: TApoyada[] = [];
  const vistos = new Set<string>();
  for (const w of consulta.cablesEn({ x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 })) {
    if (w.id === id) continue;
    for (const e of [w.desde, w.hasta]) {
      if (e.tipo !== "cable" || e.cable !== id) continue;
      const k = `${e.x},${e.y}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      salida.push({ x: e.x, y: e.y });
    }
  }
  return salida;
}

/**
 * Dónde cae (x, y) a lo largo de `P`: el tramo y la distancia desde el
 * principio. Si cae en más de un lugar, el más lejano; en un codo, el tramo
 * que empieza ahí. Null si no está sobre `P`.
 */
function ubicar(P: readonly number[], x: number, y: number): { tramo: number; distancia: number } | null {
  let mejor: { tramo: number; distancia: number } | null = null;
  let recorrido = 0;
  for (let i = 0; i + 3 < P.length; i += 2) {
    const ax = P[i]!;
    const ay = P[i + 1]!;
    const bx = P[i + 2]!;
    const by = P[i + 3]!;
    if (puntoSobreRecorrido([ax, ay, bx, by], x, y)) {
      const d = recorrido + Math.abs(x - ax) + Math.abs(y - ay);
      if (!mejor || d >= mejor.distancia) mejor = { tramo: i / 2, distancia: d };
    }
    recorrido += Math.abs(bx - ax) + Math.abs(by - ay);
  }
  return mejor;
}

/** Por dónde puede salir el cable desde su extremo fijo, en (P[0], P[1]). Con `fresca`, la dirección propia del borne. */
function rutaFija(indice: IndiceHoja, e: Extremo, P: readonly number[], fresca: boolean): ExtremoRuta {
  const x = P[0]!;
  const y = P[1]!;
  if (e.tipo !== "borne") return { x, y };
  const b = borneDe(indice.componentes.get(e.comp)!, e.borne)!;
  const salida = direccionDe(P[2]! - x, P[3]! - y) ?? b.direccion;
  return extremoRutaBorne(x, y, b.direccion, fresca ? b.direccion : salida);
}

/** Lo que comparten planear y revisar: el cable, su recorrido de F a M y el destino. */
interface Contexto {
  indice: IndiceHoja;
  consulta: ConsultaTrazado;
  /** El recorrido de ahora, en el sentido del cable. */
  viejo: number[];
  /** Del extremo fijo (F) al agarrado (M). */
  P: number[];
  fijo: Extremo;
  /** El punto del destino. */
  pm: { x: number; y: number };
  /** Las T apoyadas que están sobre el recorrido (en un documento roto puede haber otras). */
  sobreP: TApoyada[];
  /** La última T apoyada desde F, o null si no hay. */
  ultima: { tramo: number; distancia: number; x: number; y: number } | null;
  resultado(cable: CableCambiado | null, rechazo: Rechazo | null): ResultadoReconexion;
  /** El cable con el extremo nuevo y los codos de `puntos` (F → M). */
  armar(puntos: readonly number[]): Cable;
  /** Claves de los conflictos que el cable ya tenía. */
  viejas(): Set<string>;
}

/**
 * Arma el contexto y hace lo que no depende del ruteo: sobre sí mismo, mismo
 * borne, mismo anfitrión, ciclo, un borne que no existe, largo cero, el
 * extremo sobre una T apoyada y la T en un extremo del anfitrión. Devuelve el
 * rechazo si hay uno. Tira si el
 * cable no existe, si ese extremo no está suelto o si el cable apunta a algo
 * que no está.
 */
function contexto(entorno: EntornoPlan, id: string, lado: LadoCable, destino: DestinoExtremo): { ctx: Contexto } | { rechazado: ResultadoReconexion } {
  const { indice, consulta } = entorno;
  const w = indice.cables.get(id);
  if (!w) throw new Error(`No existe el cable "${id}".`);
  if (w[lado].tipo !== "libre") throw new Error(`El extremo ${lado} de "${id}" no está suelto.`);
  const viejo = recorridoCable(indice, w);
  if (!viejo) throw new Error(`El cable "${id}" apunta a algo que no está.`);
  const fijo = lado === "hasta" ? w.desde : w.hasta;
  const nuevo: DestinoExtremo = { ...destino };
  const antes = copiarCable(w);
  const resultado = (cable: CableCambiado | null, rechazo: Rechazo | null): ResultadoReconexion => ({
    id,
    lado,
    destino: { ...destino },
    antes,
    cable,
    rechazo,
  });
  const P = lado === "hasta" ? viejo : invertir(viejo);
  const n = P.length;
  const pm = puntoExtremo(indice, destino);
  const marca = pm ?? { x: P[n - 2]!, y: P[n - 1]! };
  const rechazar = (mensaje: string, clave: string) => ({
    rechazado: resultado(null, { motivo: mensaje, conflictos: [{ mensaje, x: marca.x, y: marca.y, clave: `reconectar|${clave}|cable:${id}` }] }),
  });
  const armar = (puntos: readonly number[]): Cable => {
    const p = lado === "hasta" ? puntos : invertir(puntos);
    return {
      id,
      desde: lado === "desde" ? { ...nuevo } : { ...w.desde },
      hasta: lado === "hasta" ? { ...nuevo } : { ...w.hasta },
      codos: codosDe(p),
    };
  };

  if (destino.tipo === "cable" && destino.cable === id) return rechazar(MENSAJE_SOBRE_SI_MISMO, "sobreSiMismo");
  if (destino.tipo === "borne" && fijo.tipo === "borne" && fijo.comp === destino.comp && fijo.borne === destino.borne) {
    return rechazar(MENSAJE_MISMO_BORNE, "mismoBorne");
  }
  if (destino.tipo === "cable" && fijo.tipo === "cable" && fijo.cable === destino.cable) return rechazar(MENSAJE_MISMO_ANFITRION, "mismoAnfitrion");
  if (destino.tipo === "cable" && seApoyaEn(indice, destino.cable, id)) return rechazar(MENSAJE_APOYO_CICLO, "ciclo");
  if (!pm) {
    // Un borne que no se puede resolver: los problemas de estructura.
    const r = prepararCableExistente(indice, consulta, armar([P[0]!, P[1]!, P[0]!, P[1]!]));
    return { rechazado: resultado(null, { motivo: r.problemas[0]!.mensaje, conflictos: r.problemas }) };
  }
  if (pm.x === P[0] && pm.y === P[1]) return rechazar(MENSAJE_SIN_LARGO, "sinLargo");
  const apoyadas = tApoyadas(consulta, id, P);
  if (apoyadas.some((t) => t.x === pm.x && t.y === pm.y)) return rechazar(MENSAJE_T_EN_EXTREMO, "tEnExtremo");
  if (destino.tipo === "cable") {
    // La T no puede quedar en el extremo de su anfitrión cuando ese extremo es a su vez una T:
    // `problemasTrazado` la da por unida. Sobre un extremo suelto o un borne ya la frena
    // `problemasTrazado` (el aviso de W, o "pasaría sobre el borne").
    const h = indice.cables.get(destino.cable);
    const rec = h && recorridoCable(indice, h);
    if (h && rec) {
      const m = rec.length;
      const enDesde = h.desde.tipo === "cable" && rec[0] === pm.x && rec[1] === pm.y;
      const enHasta = h.hasta.tipo === "cable" && rec[m - 2] === pm.x && rec[m - 1] === pm.y;
      if (enDesde || enHasta) return rechazar(MENSAJE_EXTREMO_ANFITRION, "extremoAnfitrion");
    }
  }

  let ultima: Contexto["ultima"] = null;
  const sobreP: TApoyada[] = [];
  for (const t of apoyadas) {
    const u = ubicar(P, t.x, t.y);
    if (!u) continue;
    sobreP.push(t);
    if (!ultima || u.distancia > ultima.distancia) ultima = { ...u, x: t.x, y: t.y };
  }
  let viejas: Set<string> | null = null;
  const ctx: Contexto = {
    indice,
    consulta,
    viejo,
    P,
    fijo,
    pm,
    sobreP,
    ultima,
    resultado,
    armar,
    viejas: () =>
      (viejas ??= new Set(
        problemasTrazado({ id, desde: w.desde, hasta: w.hasta, puntos: viejo }, consultaSinCable(consulta, id)).map((k) => k.clave),
      )),
  };
  return { ctx };
}

/**
 * Los problemas nuevos de `cable` (la estructura y las conexiones aparentes,
 * sin los conflictos que ya tenía) y su recorrido. `valido` también exige que
 * las T apoyadas sigan sobre él.
 */
function revisar(ctx: Contexto, cable: Cable): { puntos: number[] | null; conflictos: Conflicto[]; valido: boolean } {
  const r = prepararCableExistente(ctx.indice, ctx.consulta, cable);
  let conflictos = r.problemas;
  if (conflictos.length > 0) {
    const v = ctx.viejas();
    conflictos = conflictos.filter((k) => !v.has(k.clave));
  }
  const p = r.puntos;
  // Garantía: las T apoyadas siguen sobre el cable (lo asegura lo conservado).
  const valido = conflictos.length === 0 && p !== null && ctx.sobreP.every((t) => puntoSobreRecorrido(p, t.x, t.y));
  return { puntos: p, conflictos, valido };
}

/**
 * Qué pasa si el extremo `lado` (libre) del cable `id` se conecta a
 * `destino`. No cambia nada. Tira si el cable no existe, si ese extremo no
 * está suelto o si el cable apunta a algo que no está; el resto de los
 * problemas vuelve como rechazo.
 */
export function planearReconexion(entorno: EntornoPlan, id: string, lado: LadoCable, destino: DestinoExtremo): ResultadoReconexion {
  const c0 = contexto(entorno, id, lado, destino);
  if ("rechazado" in c0) return c0.rechazado;
  const { ctx } = c0;
  const { indice, fijo, P, pm, ultima } = ctx;
  const n = P.length;

  // Candidatos, todos de F a M.
  const rutaF = rutaFija(indice, fijo, P, false);
  const frescaF = rutaFija(indice, fijo, P, true);
  let rutaM: ExtremoRuta = { x: pm.x, y: pm.y };
  if (destino.tipo === "borne") {
    const b = borneDe(indice.componentes.get(destino.comp)!, destino.borne)!;
    rutaM = extremoRutaBorne(pm.x, pm.y, b.direccion, b.direccion);
  }
  let lista: Candidato[];
  if (!ultima) {
    lista = candidatosParcial(P, pm, rutaF, rutaM);
  } else {
    // Se conservan los puntos 0..s tal cual y, si la T cae en el medio del tramo s, su punto.
    const s = ultima.tramo;
    const enVertice = P[2 * s] === ultima.x && P[2 * s + 1] === ultima.y;
    const previo = enVertice ? (s > 0 ? [P[2 * s - 2]!, P[2 * s - 1]!] : null) : [P[2 * s]!, P[2 * s + 1]!];
    let ancla: ExtremoRuta = rutaF;
    const v = previo && direccionDe(ultima.x - previo[0]!, ultima.y - previo[1]!);
    if (v) ancla = { x: ultima.x, y: ultima.y, prohibidas: [opuesta(v)], debiles: perpendiculares(v) };
    // Lo que sigue a la T, hasta M (sin repetir el punto de la T).
    const resto = [ultima.x, ultima.y];
    for (let i = 2 * s + 2; i + 1 < n; i += 2) {
      if (resto.length === 2 && P[i] === ultima.x && P[i + 1] === ultima.y) continue;
      resto.push(P[i]!, P[i + 1]!);
    }
    const parte = resto.length >= 4 ? candidatosParcial(resto, pm, ancla, rutaM) : candidatosEntero(ancla, rutaM);
    const conservado = P.slice(0, 2 * s);
    lista = [];
    for (const c of parte) {
      // Desde el punto s: si la T cae en el medio de un tramo y el cable sigue derecho, su punto no queda como codo.
      const puntos = [...conservado, ...simplificar([P[2 * s]!, P[2 * s + 1]!, ...c.puntos])];
      if (!formaInvalida(puntos)) lista.push({ puntos, clave: c.clave });
    }
  }

  /** El primer candidato que falló: sus conflictos y su recorrido. */
  const primero: { valor: { conflictos: Conflicto[]; intento: CableCambiado } | null } = { valor: null };
  /** El primero de `candidatos` que pasa todo. */
  const probar = (candidatos: readonly Candidato[]): { c: Candidato; cable: CableCambiado } | null => {
    for (const c of candidatos) {
      const cable = ctx.armar(c.puntos);
      const r = revisar(ctx, cable);
      const final: CableCambiado = { ...cable, puntos: r.puntos ?? (lado === "hasta" ? c.puntos : invertir(c.puntos)) };
      if (r.valido) return { c, cable: final };
      if (r.conflictos.length > 0) primero.valor ??= { conflictos: r.conflictos, intento: final };
    }
    return null;
  };

  const r = probar(lista);
  if (!ultima) {
    // El fresco (lo que tendería W) gana solo con menos codos y sin incumplir más salidas propias de los bornes.
    const incumplidas = (p: readonly number[]): number => {
      const s = salidas(p);
      return incumpleSalida(s.inicio, frescaF) + incumpleSalida(s.fin, rutaM);
    };
    const tope = r ? { codos: contarCodos(r.c.puntos), incumplidas: incumplidas(r.c.puntos) } : null;
    if (r && tope && minimoCodosFresco(frescaF, rutaM, tope.incumplidas === 0) >= tope.codos) return ctx.resultado(r.cable, null);
    const frescos = candidatosEntero(frescaF, rutaM);
    const f = probar(tope ? frescos.filter((c) => contarCodos(c.puntos) < tope.codos && incumplidas(c.puntos) <= tope.incumplidas) : frescos);
    if (f) return ctx.resultado(f.cable, null);
  }
  if (r) return ctx.resultado(r.cable, null);
  const p = primero.valor;
  if (p) return ctx.resultado(p.intento, { motivo: p.conflictos[0]!.mensaje, conflictos: p.conflictos });
  const mensaje = MENSAJE_SIN_LLEGADA;
  return ctx.resultado(null, { motivo: mensaje, conflictos: [{ mensaje, x: pm.x, y: pm.y, clave: `reconectar|sinCamino|cable:${id}` }] });
}

/**
 * Revisa un resultado ya calculado contra la hoja de ahora, sin rutear (para
 * rehacer): las mismas reglas que `planearReconexion`, para ese mismo cable.
 * Null si vale. Tira como `planearReconexion`.
 */
export function revisarReconexion(entorno: EntornoPlan, r: ResultadoReconexion & { cable: CableCambiado }): Rechazo | null {
  const c0 = contexto(entorno, r.id, r.lado, r.destino);
  if ("rechazado" in c0) return c0.rechazado.rechazo;
  const { ctx } = c0;
  const cable: Cable = { id: r.id, desde: r.cable.desde, hasta: r.cable.hasta, codos: r.cable.codos };
  const noRehacer = (): Rechazo => {
    const mensaje = MENSAJE_NO_REHACER;
    return { motivo: mensaje, conflictos: [{ mensaje, x: ctx.pm.x, y: ctx.pm.y, clave: `reconectar|noRehacer|cable:${r.id}` }] };
  };
  // El otro extremo tiene que ser el de ahora: si no, sería otro cable.
  const fijo = r.lado === "hasta" ? cable.desde : cable.hasta;
  if (JSON.stringify(fijo) !== JSON.stringify(ctx.fijo)) return noRehacer();
  const v = revisar(ctx, cable);
  if (v.valido) return null;
  return v.conflictos.length > 0 ? { motivo: v.conflictos[0]!.mensaje, conflictos: v.conflictos } : noRehacer();
}
