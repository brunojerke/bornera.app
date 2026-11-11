// Herramienta cable (W, T13): dibuja un cable nuevo con codos en ángulo recto.
//
// - Clic-clic. El primer clic empieza en el objetivo bajo el cursor (un
//   borne, una T sobre un cable o un extremo libre en vacío). Un clic en
//   vacío fija el recorrido de la vista previa hasta ahí: sus codos y ese
//   punto, que pasa a ser el ancla. Un clic en un borne o en un cable termina
//   conectado. Otro clic en el mismo punto del último codo termina con el
//   extremo libre ahí (doble clic por punto de grilla, sin temporizador).
// - Arrastre: apretar, moverse más del umbral y soltar es un clic más, en el
//   punto donde se suelta. Soltar fuera del lienzo no fija nada.
// - La herramienta sigue activa después de terminar un cable.
// - Esc (o el botón derecho): con tramo, cancela el cable en curso; sin
//   tramo, termina la herramienta. Retroceso y Ctrl+Z (`quitarCodo`), con
//   tramo, quitan el último clic fijado; sin codos, cancelan el tramo. Nunca
//   tocan el historial mientras hay un tramo.
//
// Objetivo bajo el cursor (`objetivoEn`), sobre el punto de grilla redondeado
// y con la prioridad borne > cable > vacío: así nunca queda un codo ni un
// extremo libre sobre un borne o un cable.
//
// La vista previa y el clic final pasan por la misma cuenta (`calcular`): el
// ruteo (`rutas`) y, para cada candidato, `prepararCable` (estructura +
// conexiones engañosas) con la misma consulta. Gana el primero sin
// problemas; si no hay ninguno, la previa muestra el primero con sus
// problemas y el clic no hace nada. El id del cable se da recién al armar el
// comando: cancelar no gasta ids.
//
// Nada de esto toca el documento ni los mosaicos: es estado de la herramienta
// y se dibuja en la capa dinámica. Solo pide redibujo cuando cambia el
// objetivo, el estado del tramo o el documento.

import type { IndiceHoja } from "../../core/model/cables";
import { cablear, type DatosCable } from "../../core/model/comandos";
import type { Documento, Extremo } from "../../core/model/documento";
import { direccionDe, opuesta, perpendiculares, rutas, simplificar, type ExtremoRuta } from "../../core/model/ruteo";
import {
  MENSAJE_CRUCE,
  MENSAJE_EXTREMO_SUELTO,
  MENSAJE_MISMO_BORNE,
  MENSAJE_SIN_LARGO,
  MENSAJE_SIN_SALIDAS,
  prepararCable,
  salidasLibres,
  terminaEnTSobre,
  tocaRecorrido,
  type BorneHoja,
  type Conflicto,
  type ConsultaTrazado,
} from "../../core/model/trazado";
import { NADA, UMBRAL_ARRASTRE_PX, type EventoHerramienta, type Herramienta, type Resultado } from "./tipos";

/** Distancia, en px CSS, a la que un borne todavía se agarra (alejado; ver `radioBorne`). */
export const TOLERANCIA_BORNE_PX = 8;

/**
 * Radio para agarrar un borne, en unidades (distancia de Chebyshev): 8 px,
 * pero nunca menos de 0,5 (cubre la celda del redondeo: un punto de grilla
 * sobre un borne siempre es ese borne) ni más de 0,9 (dos bornes vecinos
 * están a 1).
 */
export function radioBorne(escala: number): number {
  return Math.min(Math.max(TOLERANCIA_BORNE_PX / escala, 0.5), 0.9);
}

// Viven en el núcleo desde T14c (reconectar los usa también); acá se re-exportan.
export { MENSAJE_MISMO_BORNE, MENSAJE_SIN_LARGO };
export const MENSAJE_SIN_CAMINO = "Sin camino: fijá un codo.";
export const MENSAJE_DOCUMENTO_CAMBIO = "El documento cambió: se canceló el cable en curso.";
/**
 * Lo que W suma al motivo del núcleo cuando el cable en curso se tocaría,
 * cruzaría o encimaría consigo mismo: cómo salir. El texto del núcleo no
 * cambia (mover y girar lo usan sin esto).
 */
export const SALIDA_TOQUE_PROPIO = "fijá el codo en otro lado, o quitá el último con Retroceso (Esc cancela el cable).";

/** El motivo que muestra W para un problema del tramo en curso. */
export function mensajeTramo(c: Conflicto): string {
  return c.clave.startsWith("mismo|") ? `${c.mensaje.replace(/\.$/, "")}: ${SALIDA_TOQUE_PROPIO}` : c.mensaje;
}

/** Lo que necesita la herramienta del editor. */
export interface EntornoCable {
  readonly documento: Documento;
  readonly hoja: number;
  /** Bornes, cables y cuerpos cerca de una caja (con el índice de la escena). */
  readonly consulta: ConsultaTrazado;
  /** Componentes y cables de la hoja por id, al día. */
  indice(): IndiceHoja;
  /** Contador de cambios del documento: si cambia durante un tramo, el tramo se cancela. */
  cambios(): number;
}

/** Qué hay bajo el cursor, en un punto entero. */
export type Objetivo =
  | { tipo: "borne"; x: number; y: number; borne: BorneHoja }
  | { tipo: "cable"; x: number; y: number; cable: string }
  | { tipo: "vacio"; x: number; y: number }
  | { tipo: "bloqueado"; x: number; y: number; mensaje: string };

/** Lo que dibuja la capa dinámica. */
export interface DibujoCable {
  /** Recorrido a dibujar (lo fijado más la vista previa), x, y seguidos; null sin tramo. */
  puntos: readonly number[] | null;
  /** Si el próximo clic vale. */
  valido: boolean;
  /** Problemas, con el punto donde se marcan. */
  conflictos: readonly Conflicto[];
  objetivo: Objetivo | null;
  /** Extremos libres del cable en curso o del que empezaría (x, y seguidos). */
  libres: readonly number[];
}

interface Tramo {
  desde: Extremo;
  x: number;
  y: number;
  /** Por dónde puede salir desde `desde`. */
  ruta: ExtremoRuta;
  /** Puntos fijados con clics en vacío, en orden (sin simplificar). */
  fijados: [number, number][];
  /** Largo de `fijados` antes de cada clic, para quitarlos de a uno. */
  pasos: number[];
  /** `cambios()` al empezar. */
  cambios: number;
}

/** Lo que daría un clic en un objetivo. */
interface Calculo {
  /** El cable entero, si el clic termina; null si fija un codo o no vale. */
  datos: DatosCable | null;
  /** Codos de la ruta desde el ancla hasta el objetivo (los que fija un clic en vacío). */
  ruta: [number, number][] | null;
  puntos: readonly number[] | null;
  problemas: Conflicto[];
}

function libre(x: number, y: number): Extremo {
  return { tipo: "libre", x, y };
}

function nombreBorne(b: BorneHoja): string {
  return `${b.nombre} · ${b.borne}`;
}

export class HerramientaCable implements Herramienta {
  private tramo: Tramo | null = null;
  /** Último punto del cursor sobre el lienzo (sin redondear); null si salió. */
  private ultimo: { x: number; y: number; escala: number } | null = null;
  /** Botón apretado: dónde y en qué objetivo (para el arrastre). */
  private apretado: { x: number; y: number; ox: number; oy: number } | null = null;
  /** Sube con cada cambio del tramo: entra en la clave de lo dibujado. */
  private version = 0;
  private clave: string | null = null;
  private _dibujo: DibujoCable | null = null;
  private _pista = "";

  constructor(private readonly entorno: EntornoCable) {
    this._pista = this.pistaSin();
  }

  /** Hay un cable en curso (por lo menos el primer clic). */
  get enTramo(): boolean {
    return this.tramo !== null;
  }

  /** El botón está apretado (F5 espera a que se suelte). */
  get enGesto(): boolean {
    return this.apretado !== null;
  }

  /** Lo que dibuja la capa dinámica; null si no hay nada. */
  get dibujo(): DibujoCable | null {
    return this._dibujo;
  }

  /** Texto para la barra de estado. */
  get pista(): string {
    return this._pista;
  }

  /** Puntos fijados hasta ahora (para los tests). */
  get fijados(): readonly (readonly [number, number])[] {
    return this.tramo?.fijados ?? [];
  }

  /**
   * Qué hay en (x, y): el borne más cercano a distancia de Chebyshev ≤
   * `radioBorne` (el de arriba si empatan); si no, un cable en el punto de
   * grilla (bloqueado sobre un extremo suelto o un cruce sin unión); si no,
   * vacío.
   */
  objetivoEn(x: number, y: number, escala: number): Objetivo {
    const c = this.entorno.consulta;
    const radio = radioBorne(escala);
    let mejor: BorneHoja | null = null;
    let distancia = Infinity;
    for (const b of c.bornesEn({ x: x - radio, y: y - radio, ancho: 2 * radio, alto: 2 * radio })) {
      const d = Math.max(Math.abs(b.x - x), Math.abs(b.y - y));
      // `<=`: con empate gana el último, el que se dibuja arriba.
      if (d <= radio && d <= distancia) {
        mejor = b;
        distancia = d;
      }
    }
    if (mejor) return { tipo: "borne", x: mejor.x, y: mejor.y, borne: mejor };

    const gx = Math.round(x) || 0;
    const gy = Math.round(y) || 0;
    const punto = { x: gx, y: gy, ancho: 0, alto: 0 };
    const ahi = [...c.cablesEn(punto)].filter((w) => tocaRecorrido(w.puntos, punto));
    if (ahi.length === 0) return { tipo: "vacio", x: gx, y: gy };
    for (const w of ahi) {
      const m = w.puntos.length;
      const suelto =
        (w.desde.tipo === "libre" && w.puntos[0] === gx && w.puntos[1] === gy) ||
        (w.hasta.tipo === "libre" && w.puntos[m - 2] === gx && w.puntos[m - 1] === gy);
      if (suelto) return { tipo: "bloqueado", x: gx, y: gy, mensaje: MENSAJE_EXTREMO_SUELTO };
    }
    // El anfitrión: el que pasa por el punto sin terminar ahí en T (el de arriba, si hay varios).
    const terminaEnT = (w: (typeof ahi)[number]) =>
      [w.desde, w.hasta].some((e) => e.tipo === "cable" && e.x === gx && e.y === gy);
    let anfitrion = ahi[ahi.length - 1]!;
    for (let i = ahi.length - 1; i >= 0; i--) {
      if (!terminaEnT(ahi[i]!)) {
        anfitrion = ahi[i]!;
        break;
      }
    }
    for (const w of ahi) {
      if (w === anfitrion) continue;
      if (!terminaEnTSobre(w, anfitrion.id, gx, gy) && !terminaEnTSobre(anfitrion, w.id, gx, gy)) {
        return { tipo: "bloqueado", x: gx, y: gy, mensaje: MENSAJE_CRUCE };
      }
    }
    return { tipo: "cable", x: gx, y: gy, cable: anfitrion.id };
  }

  mover(ev: EventoHerramienta): Resultado {
    const aviso = this.revisarDocumento();
    this.ultimo = { x: ev.x, y: ev.y, escala: ev.escala };
    const cambio = this.actualizar();
    return aviso ? { redibujar: true, aviso } : cambio ? { redibujar: true } : NADA;
  }

  presionar(ev: EventoHerramienta): Resultado {
    const aviso = this.revisarDocumento();
    if (ev.boton === 2) return this.cancelar();
    if (ev.boton !== 0) return aviso ? { redibujar: true, aviso } : NADA;
    this.ultimo = { x: ev.x, y: ev.y, escala: ev.escala };
    const obj = this.objetivoEn(ev.x, ev.y, ev.escala);
    this.apretado = { x: ev.x, y: ev.y, ox: obj.x, oy: obj.y };
    const r = this.clic(obj);
    return aviso && !r.aviso ? { ...r, aviso } : r;
  }

  soltar(ev: EventoHerramienta | null): Resultado {
    const a = this.apretado;
    this.apretado = null;
    if (!a || !ev || ev.fuera) return NADA;
    // Arrastre: soltar lejos de donde se apretó es otro clic.
    if (Math.hypot(ev.x - a.x, ev.y - a.y) * ev.escala <= UMBRAL_ARRASTRE_PX) return NADA;
    this.ultimo = { x: ev.x, y: ev.y, escala: ev.escala };
    const obj = this.objetivoEn(ev.x, ev.y, ev.escala);
    if (obj.x === a.ox && obj.y === a.oy) return NADA;
    return this.clic(obj);
  }

  salir(): Resultado {
    this.ultimo = null;
    return this.actualizar() ? { redibujar: true } : NADA;
  }

  /** Esc o botón derecho: cancela el tramo; sin tramo, termina la herramienta. */
  cancelar(): Resultado {
    if (!this.tramo) return this.terminar();
    this.tramo = null;
    this.version++;
    this.actualizar();
    return { redibujar: true };
  }

  /** Termina la herramienta (otra herramienta, cambio de escena o de modo): sin cable. */
  terminar(): Resultado {
    this.tramo = null;
    this.apretado = null;
    this._dibujo = null;
    this.clave = null;
    return { redibujar: true, terminar: true };
  }

  /**
   * Retroceso o Ctrl+Z con un tramo: quita lo que fijó el último clic; sin
   * codos, cancela el tramo. Null si no hay tramo (Ctrl+Z deshace normal).
   */
  quitarCodo(): Resultado | null {
    const t = this.tramo;
    if (!t) return null;
    const n = t.pasos.pop();
    if (n === undefined) this.tramo = null;
    else t.fijados.length = n;
    this.version++;
    this.actualizar();
    return { redibujar: true };
  }

  /** Vuelve a calcular con la última posición del cursor (cambió el documento o la cámara). */
  refrescar(): boolean {
    return this.actualizar();
  }

  /** El documento cambió por otra vía durante un tramo: se cancela. Devuelve el aviso. */
  private revisarDocumento(): string | null {
    if (!this.tramo || this.tramo.cambios === this.entorno.cambios()) return null;
    this.tramo = null;
    this.version++;
    this.actualizar();
    return MENSAJE_DOCUMENTO_CAMBIO;
  }

  private clic(obj: Objetivo): Resultado {
    if (!this.tramo) return this.empezar(obj);
    const c = this.calcular(obj);
    if (c.problemas.length > 0) {
      this.actualizar();
      return { redibujar: true, aviso: mensajeTramo(c.problemas[0]!) };
    }
    if (c.datos) {
      // Termina: el id se da recién acá.
      const comando = cablear(this.entorno.documento, c.datos, this.entorno.hoja);
      this.tramo = null;
      this.version++;
      this.clave = null;
      return { comando, redibujar: true };
    }
    // Clic en vacío: fija la ruta hasta ahí y ese punto.
    const t = this.tramo;
    t.pasos.push(t.fijados.length);
    t.fijados.push(...c.ruta!, [obj.x, obj.y]);
    this.version++;
    this.actualizar();
    return { redibujar: true };
  }

  private empezar(obj: Objetivo): Resultado {
    const problemas = this.problemasInicio(obj);
    if (problemas.length > 0) return { redibujar: false, aviso: problemas[0]!.mensaje };
    const { x, y } = obj;
    let desde: Extremo;
    let ruta: ExtremoRuta = { x, y };
    if (obj.tipo === "borne") {
      const d = obj.borne.direccion;
      desde = { tipo: "borne", comp: obj.borne.comp, borne: obj.borne.borne };
      ruta = { x, y, preferidas: [d], prohibidas: [opuesta(d)] };
    } else if (obj.tipo === "cable") {
      desde = { tipo: "cable", cable: obj.cable, x, y };
    } else {
      desde = libre(x, y);
    }
    this.tramo = { desde, x, y, ruta, fijados: [], pasos: [], cambios: this.entorno.cambios() };
    this.version++;
    this.actualizar();
    return { redibujar: true };
  }

  /** Por qué no se puede empezar en `obj` (vacío si se puede). */
  private problemasInicio(obj: Objetivo): Conflicto[] {
    if (obj.tipo === "bloqueado") return [{ mensaje: obj.mensaje, x: obj.x, y: obj.y, clave: `objetivo|${obj.mensaje}` }];
    if (obj.tipo === "borne" && salidasLibres(this.entorno.consulta, obj.x, obj.y, obj.borne.direccion).length === 0) {
      return [{ mensaje: MENSAJE_SIN_SALIDAS, x: obj.x, y: obj.y, clave: "objetivo|sinSalidas" }];
    }
    return [];
  }

  /** El último punto fijado (o el de partida) y por dónde puede seguir desde ahí. */
  private ancla(): ExtremoRuta {
    const t = this.tramo!;
    const f = t.fijados;
    if (f.length === 0) return t.ruta;
    const [ax, ay] = f[f.length - 1]!;
    const [bx, by] = f.length >= 2 ? f[f.length - 2]! : [t.x, t.y];
    const v = direccionDe(ax - bx, ay - by)!;
    return { x: ax, y: ay, prohibidas: [opuesta(v)], debiles: perpendiculares(v) };
  }

  /** Lo que daría un clic en `obj` con el tramo en curso: la misma cuenta para la previa y para el clic. */
  private calcular(obj: Objetivo): Calculo {
    const t = this.tramo!;
    const fijo = this.puntosFijados();
    const problema = (mensaje: string): Calculo => ({ datos: null, ruta: null, puntos: fijo, problemas: [{ mensaje, x: obj.x, y: obj.y, clave: `objetivo|${mensaje}` }] });
    if (obj.tipo === "bloqueado") return problema(obj.mensaje);
    const mismoBorne =
      obj.tipo === "borne" && t.desde.tipo === "borne" && t.desde.comp === obj.borne.comp && t.desde.borne === obj.borne.borne;
    const a = this.ancla();
    if (obj.x === a.x && obj.y === a.y) {
      // Otro clic en el último codo: termina con el extremo libre ahí.
      if (obj.tipo === "vacio" && t.fijados.length > 0) return this.armar(libre(a.x, a.y), a.x, a.y, t.fijados.slice(0, -1), true, null);
      return problema(mismoBorne ? MENSAJE_MISMO_BORNE : MENSAJE_SIN_LARGO);
    }
    if (mismoBorne) return problema(MENSAJE_MISMO_BORNE);

    let hasta: ExtremoRuta = { x: obj.x, y: obj.y };
    let extremo: Extremo;
    if (obj.tipo === "borne") {
      const d = obj.borne.direccion;
      hasta = { x: obj.x, y: obj.y, preferidas: [d], prohibidas: [opuesta(d)] };
      extremo = { tipo: "borne", comp: obj.borne.comp, borne: obj.borne.borne };
    } else if (obj.tipo === "cable") {
      extremo = { tipo: "cable", cable: obj.cable, x: obj.x, y: obj.y };
    } else {
      extremo = libre(obj.x, obj.y);
    }
    const termina = obj.tipo !== "vacio";
    const lista = rutas(a, hasta);
    if (lista.length === 0) return problema(MENSAJE_SIN_CAMINO);
    let primero: Calculo | null = null;
    for (const r of lista) {
      const c = this.armar(extremo, obj.x, obj.y, [...t.fijados, ...r.codos], termina, r.codos);
      if (c.problemas.length === 0) return c;
      primero ??= c;
    }
    return primero!;
  }

  /** Arma el cable (codos simplificados) y lo valida con `prepararCable`. */
  private armar(
    hasta: Extremo,
    hx: number,
    hy: number,
    codosCrudos: readonly (readonly [number, number])[],
    termina: boolean,
    ruta: [number, number][] | null,
  ): Calculo {
    const t = this.tramo!;
    const p = simplificar([t.x, t.y, ...codosCrudos.flat(), hx, hy]);
    const codos: [number, number][] = [];
    for (let i = 2; i + 3 < p.length; i += 2) codos.push([p[i]!, p[i + 1]!]);
    const datos: DatosCable = { desde: t.desde, hasta, codos };
    const r = prepararCable(this.entorno.indice(), this.entorno.consulta, datos);
    return { datos: termina ? datos : null, ruta, puntos: r.puntos ?? p, problemas: r.problemas };
  }

  /** Recorrido de lo fijado (desde el punto de partida); null si todavía no hay tramo dibujable. */
  private puntosFijados(): number[] | null {
    const t = this.tramo!;
    if (t.fijados.length === 0) return null;
    return [t.x, t.y, ...t.fijados.flat()];
  }

  /** Recalcula objetivo, previa y pista si cambió algo; true si cambió lo que se ve. */
  private actualizar(): boolean {
    const u = this.ultimo;
    const obj = u ? this.objetivoEn(u.x, u.y, u.escala) : null;
    const idObj = obj ? `${obj.tipo}|${obj.x}|${obj.y}|${obj.tipo === "borne" ? `${obj.borne.comp}:${obj.borne.borne}` : obj.tipo === "cable" ? obj.cable : ""}` : "-";
    const clave = `${idObj}|${this.version}|${this.entorno.cambios()}`;
    if (clave === this.clave) return false;
    this.clave = clave;
    const t = this.tramo;
    if (!t) {
      const problemas = obj ? this.problemasInicio(obj) : [];
      this._dibujo = obj
        ? { puntos: null, valido: problemas.length === 0, conflictos: problemas, objetivo: obj, libres: obj.tipo === "vacio" ? [obj.x, obj.y] : [] }
        : null;
      this._pista = problemas[0]?.mensaje ?? (obj ? this.pistaInicio(obj) : this.pistaSin());
      return true;
    }
    const libres: number[] = t.desde.tipo === "libre" ? [t.x, t.y] : [];
    if (!obj) {
      this._dibujo = { puntos: this.puntosFijados(), valido: true, conflictos: [], objetivo: null, libres };
      this._pista = this.pistaSin();
      return true;
    }
    const c = this.calcular(obj);
    const terminaLibre = c.datos?.hasta.tipo === "libre";
    if (terminaLibre) libres.push(obj.x, obj.y);
    this._dibujo = { puntos: c.puntos, valido: c.problemas.length === 0, conflictos: c.problemas, objetivo: obj, libres };
    const primero = c.problemas[0];
    this._pista = primero ? mensajeTramo(primero) : this.pistaTramo(obj, terminaLibre);
    return true;
  }

  private pistaSin(): string {
    return this.tramo
      ? "Cable: clic en un borne o un cable para terminar · Esc cancela el cable"
      : "Cable: clic en un borne para empezar · Esc sale";
  }

  private pistaInicio(obj: Objetivo): string {
    if (obj.tipo === "borne") return `Empezar en ${nombreBorne(obj.borne)}`;
    if (obj.tipo === "cable") return "Empezar con una derivación (T) sobre un cable";
    return "Empezar con un extremo libre";
  }

  private pistaTramo(obj: Objetivo, terminaLibre: boolean): string {
    if (obj.tipo === "borne") return `Conecta con ${nombreBorne(obj.borne)}`;
    if (obj.tipo === "cable") return "Derivación (T) sobre un cable";
    if (terminaLibre) return "Extremo libre: clic para terminar acá";
    return "Clic fija un codo · otro clic en el mismo punto termina con un extremo libre";
  }
}
