// Editor: une el documento con lo que se ve. Tiene el Documento, su Historial
// y la EscenaEditable que dibuja la hoja activa.
//
// Todo cambio pasa por `ejecutar` (o `agrupar`, `deshacer`, `rehacer`). Con el
// Cambio que devuelve cada comando, la escena copia el estado de esos
// componentes desde el documento, y la caja afectada (vieja ∪ nueva) se pasa a
// `invalidarRegion`: solo se rehacen los mosaicos que tocan el cambio, nunca la
// pantalla entera.
//
// También tiene la herramienta activa (Colocar, o Seleccionar cuando no hay
// otra): ejecuta lo que devuelve y dibuja en la capa dinámica su vista previa,
// el resaltado de la selección y el rectángulo de selección.
//
// La selección (ids) es estado de la interfaz, no del documento: no pasa por
// comandos ni se deshace. Seleccionar no invalida ningún mosaico: el resaltado
// va solo en la capa dinámica.
//
// Arrastrar la selección (T9): al empezar, los arrastrados salen de la capa
// estática (una invalidación por componente, en su caja) y se dibujan en la
// dinámica, corridos. Moverse solo pide cuadros. Al soltar se ejecuta un
// `Mover` mientras siguen ocultos (no invalida nada) y recién después vuelven
// a la estática (otra invalidación, en la caja nueva). Esc los vuelve a su
// lugar con la misma invalidación.
//
// Atajos (T10): `accion` recibe lo que pidió el teclado o un botón (girar,
// espejar, borrar, deshacer, rehacer) y decide si se puede hacer ahora:
// - Durante un gesto del puntero en la herramienta de selección (arrastre o
//   rectángulo en curso, o el botón todavía apretado) se ignora todo: girar
//   lo que se arrastra no vale la pena, y deshacer en el medio dejaría el
//   arrastre apuntando a un estado viejo.
// - Colocando, girar y espejar van a la vista previa; borrar no hace nada;
//   deshacer y rehacer valen en modo clic, no mientras se arrastra desde la
//   paleta.
// - Girar, espejar y borrar actúan sobre la selección, con un solo comando
//   (un paso de deshacer). Solo con ids que siguen en la hoja; sin
//   ninguno, no hay comando ni paso.
//
// Cables (T12): la escena dibuja cada cable del documento con su recorrido
// resuelto (`recorridoCable`). La selección puede tener cables y
// componentes; Supr borra todo junto (`Borrar` suelta lo que colgaba de lo
// borrado).
//
// Cables que siguen (T14a): girar, espejar y arrastrar usan
// `planearTransformacion` con el índice y la consulta del editor. Si el plan
// se rechaza (una conexión aparente nueva, un ciclo de apoyos, nada que
// mover), no hay comando ni paso: se avisa, y con R y M se marcan los
// conflictos con una ✕ hasta el próximo cambio. Al empezar a arrastrar, los
// componentes y toda la zona de cables que se pueden acomodar salen de la
// capa estática (una invalidación por caja); en cada punto de grilla se
// planea con la preparación hecha al empezar y la capa dinámica dibuja el
// resultado (a rayas lo inválido, con la ✕ y el motivo en la pista). Al
// soltar va un `Mover` con ese mismo plan, si el documento no cambió. Si el
// documento cambia en medio del arrastre (por otra vía), el arrastre se
// cancela. Con más de TOPE_CABLES_PREVIA cables que se acomodan, la previa
// dibuja gomas y el plan se calcula recién al soltar.
//
// Colocar usa la misma regla (`problemasComponente`): una previa que crearía
// una conexión aparente se ve en aviso y el clic no coloca.
//
// Herramienta cable (T13): W la activa y vacía la selección. Mientras hay un
// tramo en curso, Ctrl+Z (y el botón Deshacer, y Retroceso) quitan el último
// codo y nunca tocan el historial; Ctrl+Y no hace nada; R, M y Supr tampoco.
// Un cable terminado es un `Cablear` (un paso). El editor mantiene al día, de
// forma incremental con cada `Cambio`, el índice de la hoja (componentes y
// cables por id), qué bornes tienen cable y un contador de cambios: la
// herramienta los usa para la vista previa y el comando final, y para
// cancelar el tramo si el documento cambia por otra vía.

import { hayCablesEn, indexarHoja, recorridoCable, type IndiceHoja } from "../core/model/cables";
import { Borrar, CambiarEtiqueta, Espejar, Mover, Rotar, type Cambio, type Comando } from "../core/model/comandos";
import {
  enMinuscula,
  MENSAJE_NO_SE_ACOMODA,
  planearTransformacion,
  prefijoRechazo,
  prepararTransformacion,
  type EntornoPlan,
  type Operacion,
  type Preparacion,
  type ResultadoPlan,
} from "../core/model/seguir";
import { geometriaComponente, problemasComponente, type Conflicto } from "../core/model/trazado";
import {
  crearDocumento,
  type Cable,
  type Componente,
  type Documento,
  type Extremo,
} from "../core/model/documento";
import { normalizarEtiqueta } from "../core/model/etiquetas";
import { Historial } from "../core/model/historial";
import { bornesColocados, buscarSimbolo, type DefinicionSimbolo } from "../core/symbols";
import type { Caja } from "../render/camara";
import type { InfoDinamico } from "../render/capas";
import { nivelDetalle } from "../render/detalle";
import { grosorLinea, type ComponenteEscena } from "../render/escena";
import { anotarTramos, EscenaEditable, type CableEscena } from "../render/escenaEditable";
import type { Renderer } from "../render/renderer";
import { dibujarCablesArrastre, dibujarCableEnCurso, dibujarCruces, dibujarMarcasCable } from "../render/cableEnCurso";
import { dibujarRectangulo, dibujarSeleccion } from "../render/resaltado";
import { dibujarMarcasBornes, dibujarSimbolo } from "../render/simbolo";
import type { Accion } from "./atajos";
import { BornesConCable } from "./bornesConCable";
import { ConsultaEscena } from "./consultaEscena";
import { HerramientaCable } from "./herramientas/cable";
import { HerramientaColocar, type ModoColocar, type Previa } from "./herramientas/colocar";
import { HerramientaSeleccionar } from "./herramientas/seleccionar";
import type { Herramienta, Resultado } from "./herramientas/tipos";

/**
 * Lo que se dibuja para un componente cuyo tipo no está en la biblioteca (por
 * ejemplo, de un .brn hecho con otra versión): un cuadrado con "?", sin bornes.
 * No está en SIMBOLOS, así que no aparece en la paleta. Nunca se omite en
 * silencio: el componente sigue en el documento y tiene que verse.
 */
export const SIMBOLO_DESCONOCIDO: DefinicionSimbolo = {
  tipo: "desconocido",
  nombre: "Símbolo desconocido",
  categoria: "mando",
  elemento: "carga",
  tamano: { ancho: 2, alto: 2 },
  primitivas: [
    { forma: "rectangulo", x: -1, y: -1, ancho: 2, alto: 2 },
    { forma: "texto", x: 0, y: 0, texto: "?", alto: 1.2, alineacion: "centro" },
  ],
  bornes: [],
};

/** Lo que el editor necesita de la vista (la Vista real, o un falso en los tests). */
export interface DestinoVista {
  /** Rehacer solo la parte de la capa estática que toca `caja` (unidades de grilla). */
  invalidarRegion(caja: Caja): void;
  /** Pedir un cuadro: cambió solo la capa dinámica. */
  invalidar(): void;
}

/** Un extremo de cable, para mostrar en el panel. */
export type ExtremoResumen =
  | { tipo: "borne"; etiqueta: string; borne: string }
  | { tipo: "cable" }
  | { tipo: "libre" };

/** Lo que el panel de propiedades muestra de la selección. */
export interface ResumenSeleccion {
  /** Componentes más cables. */
  cantidad: number;
  componentes: number;
  cables: number;
  /** Con un solo cable seleccionado (y nada más), sus extremos; si no, null. */
  cable: { id: string; desde: ExtremoResumen; hasta: ExtremoResumen } | null;
  /** Con un solo componente seleccionado (y nada más), sus datos; si no, null. */
  unico: {
    id: string;
    /** Nombre del símbolo, para mostrar ("Bobina de contactor"). */
    nombre: string;
    etiqueta: string;
    rot: number;
    espejado: boolean;
    /** Fase o neutro: la etiqueta es el nombre de la red. */
    esFuente: boolean;
    /** En una fuente: cuántas otras alimentaciones del documento están en su misma red; si no, 0. */
    otrasEnRed: number;
  } | null;
  /**
   * Con varios: la etiqueta y la rotación de los componentes, si todos tienen
   * la misma; null si son distintas o no hay componentes.
   */
  varios: { etiqueta: string | null; rot: number | null } | null;
}

export const SIN_SELECCION: ResumenSeleccion = Object.freeze({
  cantidad: 0,
  componentes: 0,
  cables: 0,
  cable: null,
  unico: null,
  varios: null,
});

/**
 * Con más cables que se acomodan (no rígidos) que esto, la previa del
 * arrastre no planea en cada punto de grilla: dibuja gomas rectas y el plan
 * se calcula al soltar. Valor inicial; se fija con la medición del banco en
 * la netbook (T14a).
 */
export const TOPE_CABLES_PREVIA = 150;

/** Aviso cuando el documento cambia por otra vía en medio de un arrastre. */
export const AVISO_ARRASTRE_CANCELADO = "El documento cambió: se canceló el arrastre.";

/** Un arrastre de la selección en curso, del lado del editor. */
interface ArrastreEditor {
  /** Lo que se arrastra (los componentes, ocultos en la capa estática). */
  ids: ReadonlySet<string>;
  /** Preparación del plan (null si la hoja tiene un cable que no se puede resolver). */
  prep: Preparacion | null;
  /** `cambios` al empezar: el plan vale mientras el documento no cambie. */
  cambios: number;
  /** Zona de cables, ocultos en la capa estática mientras dura el arrastre. */
  cables: readonly string[];
  /** Último plan, del punto de grilla (dx, dy). */
  plan: PlanArrastre | null;
}

/** El plan de un punto de grilla del arrastre, listo para dibujar. */
interface PlanArrastre {
  dx: number;
  dy: number;
  r: ResultadoPlan;
  /** Recorrido nuevo de cada cable que cambia. */
  cambiados: Map<string, CableEscena>;
  /** Cables que aparecen en algún conflicto (van a rayas). */
  invalidos: Set<string>;
}

/** Un plan que no se pudo hacer: solo el rechazo. */
type PlanFallido = { plan: null; rechazo: { motivo: string; conflictos: Conflicto[] } };

/** Ids de cables que aparecen en los conflictos ("cable:w3" en la clave). */
function cablesEnConflicto(conflictos: readonly Conflicto[]): Set<string> {
  const ids = new Set<string>();
  for (const c of conflictos) for (const parte of c.clave.split("|")) if (parte.startsWith("cable:")) ids.add(parte.slice(6));
  return ids;
}

/**
 * Hasta cuántos componentes visibles se dibujan completos mientras se
 * arrastran. Con más, solo el contorno de cada uno: la capa dinámica se
 * redibuja entera en cada cuadro. Tope fijo, medido en la netbook (alpha.2):
 * 40 completos con el caché de textos dan 5–7 ms por cuadro. Un límite por
 * tiempo no sirve allá: hasta los contornos pasan de 5 ms con la sonda.
 */
export const LIMITE_ARRASTRE_COMPLETO = 80;

/**
 * Diagnóstico del arrastre (alpha.2, menú de desarrollo): cómo se dibujan los
 * arrastrados, para medir en la netbook qué parte del costo es cada cosa.
 * - "auto": lo normal (completos hasta LIMITE_ARRASTRE_COMPLETO visibles).
 * - "completos", "sinTextos", "sinTextosNiBornes": completos sin límite, con
 *   menos detalle.
 * - "contornos": solo el contorno del cuerpo.
 * - "nada": la capa dinámica queda vacía (ni arrastrados ni resaltado). El
 *   arrastre y la composición siguen: es la base.
 */
export type ModoArrastreDiagnostico = "auto" | "completos" | "sinTextos" | "sinTextosNiBornes" | "contornos" | "nada";

export interface DiagnosticoArrastre {
  modo: ModoArrastreDiagnostico;
  /** Medir con la sonda (`InfoDinamico.medir`) los cuadros de muestra del arrastre. */
  sonda: boolean;
}

/**
 * Cuadros de un arrastre que se miden con la sonda: los 3 primeros y después
 * 1 cada 15 (el 17, el 32…). Medir todos contaminaría lo que se mide.
 */
export function esCuadroDeMuestra(i: number): boolean {
  return i < 3 || (i - 2) % 15 === 0;
}

/** Documento vacío para arrancar la app, con la fecha de hoy. */
export function documentoNuevo(): Documento {
  return crearDocumento({ titulo: "Sin título", autor: "", fecha: new Date().toISOString().slice(0, 10) });
}

export class Editor {
  readonly historial: Historial;
  readonly escena = new EscenaEditable();
  /** Vista que muestra la escena; null si no se está mostrando (no hay nada que invalidar). */
  vista: DestinoVista | null = null;
  /** Herramienta elegida (Colocar o Cable); null si no hay ninguna y está la de selección. */
  herramienta: HerramientaColocar | HerramientaCable | null = null;
  /** Se avisa cuando empieza o termina una herramienta (para la paleta). */
  alCambiarHerramienta: (() => void) | null = null;
  /**
   * Se avisa cuando cambia la selección o algo de lo seleccionado (para el
   * panel de propiedades).
   */
  alCambiarSeleccion: (() => void) | null = null;
  /** Se avisa cuando cambia lo que se puede deshacer o rehacer (para los botones). */
  alCambiarHistorial: (() => void) | null = null;
  /** Aviso para la barra de estado: una acción que no se pudo hacer. */
  alAvisar: ((texto: string) => void) | null = null;
  /** Se avisa cuando cambia la pista de la herramienta (para la barra de estado). */
  alCambiarPista: ((pista: string | null) => void) | null = null;
  /** Qué bornes tienen cable (marcas de la herramienta W). Al día con cada cambio. */
  readonly bornesConCable: BornesConCable;
  /** Bornes, cables y cuerpos cerca de una caja, con el índice de la escena (herramienta W). */
  readonly consulta: ConsultaEscena;
  /** Componentes y cables de la hoja por id, al día con cada cambio. */
  private readonly indiceHoja: { componentes: Map<string, Componente>; cables: Map<string, Cable> };
  /** Sube con cada cambio del documento que se refleja. */
  private _cambios = 0;
  private pistaAvisada: string | null = null;
  /** Lo último que se avisó de `enTramo` (cambia lo que se puede deshacer). */
  private tramoAvisado = false;
  /** Bornes visibles para las marcas de la herramienta W, y de qué vista y cambio son. */
  private marcas: { clave: string; libres: number[]; ocupados: number[] } = { clave: "", libres: [], ocupados: [] };
  /** La herramienta que está cuando no hay otra. */
  readonly seleccionar: HerramientaSeleccionar;
  private _seleccion: ReadonlySet<string> = new Set();
  /** El arrastre de la selección en curso; null si no hay. */
  private arrastre: ArrastreEditor | null = null;
  /** Preparación hecha al ver si se puede arrastrar; se usa al empezar si nada cambió. */
  private preparado: { ids: ReadonlySet<string>; prep: Preparacion; cambios: number } | null = null;
  /** Se está ejecutando el `Mover` del arrastre (no es un cambio "por otra vía"). */
  private soltando = false;
  /** ✕ del último R o M rechazado; se borran con el próximo cambio. */
  private crucesRechazo: readonly { x: number; y: number }[] = [];
  /** Tramos de los cables del arrastre en el cuadro en curso (x0, y0, x1, y1 seguidos): se reusa. */
  private readonly tramosArrastre: number[] = [];
  /** Diagnóstico del arrastre (menú de desarrollo). */
  diagnostico: DiagnosticoArrastre = { modo: "auto", sonda: false };
  /** Cuadros dibujados del arrastre en curso (para elegir los de muestra). */
  private cuadrosArrastre = 0;
  /** Mediciones con la sonda (ms), desde la última vez que se leyeron con `tomarMuestras`. */
  private muestras: number[] = [];
  private readonly desconocidos = new Set<string>();

  constructor(
    readonly documento: Documento = documentoNuevo(),
    /** Índice de la hoja que se dibuja. */
    readonly hoja = 0,
  ) {
    this.historial = new Historial(documento);
    for (const c of this.componentesHoja()) this.escena.agregar(c.id, this.aEscena(c));
    const h = documento.hojas[hoja];
    const indice = h ? indexarHoja(h) : { componentes: new Map<string, Componente>(), cables: new Map<string, Cable>() };
    this.indiceHoja = { componentes: new Map(indice.componentes), cables: new Map(indice.cables) };
    this.bornesConCable = new BornesConCable(h?.cables ?? []);
    this.consulta = new ConsultaEscena(this.escena, () => this.indiceHoja.cables);
    if (h && h.cables.length > 0) {
      for (const w of h.cables) {
        const c = this.cableEscena(indice, w);
        if (c) this.escena.ponerCable(w.id, c);
      }
    }
    this.seleccionar = new HerramientaSeleccionar(
      this.escena,
      () => this._seleccion,
      (ids) => this.motivoArrastre(ids),
      (ids, dx, dy) => this.comandoArrastre(ids, dx, dy),
    );
  }

  /**
   * Índice y consulta de la hoja para planear mover, girar y espejar (T14a):
   * los del editor, con el índice espacial de la escena, siempre al día con
   * el documento.
   */
  readonly entornoPlan = (): EntornoPlan => ({ indice: this.indiceHoja, consulta: this.consulta });

  /** La herramienta que recibe los eventos: la elegida, o la de selección. */
  get activa(): Herramienta {
    return this.herramienta ?? this.seleccionar;
  }

  /** La herramienta cable, si es la activa. */
  get cable(): HerramientaCable | null {
    return this.herramienta instanceof HerramientaCable ? this.herramienta : null;
  }

  /** La herramienta Colocar, si es la activa. */
  get colocar(): HerramientaColocar | null {
    return this.herramienta instanceof HerramientaColocar ? this.herramienta : null;
  }

  /** Hay un cable en curso con la herramienta W. */
  get enTramo(): boolean {
    return this.cable?.enTramo ?? false;
  }

  /** Contador de cambios del documento reflejados (sube con cada comando, deshacer y rehacer). */
  get cambios(): number {
    return this._cambios;
  }

  /**
   * Pista para la barra de estado: la de la herramienta cable, por qué no se
   * puede colocar o soltar donde está el cursor, o cuántos cables se
   * acomodan al soltar. Null si no hay nada que decir: se limpia sola al
   * volver a una posición que vale.
   */
  get pista(): string | null {
    return this.cable?.pista ?? this.colocar?.pista ?? this.pistaArrastre();
  }

  /** Ids seleccionados. */
  get seleccion(): ReadonlySet<string> {
    return this._seleccion;
  }

  /** Hay un arrastre de la selección en curso (para no deshacer ni rotar en el medio). */
  get arrastrando(): boolean {
    return this.arrastre !== null;
  }

  /**
   * Cambia la selección. Los ids que no están en la hoja se ignoran. Solo
   * pide un cuadro (la capa dinámica): la estática no cambia.
   */
  seleccionarIds(ids: Iterable<string>): void {
    const nueva = new Set<string>();
    for (const id of ids) if (this.escena.existe(id)) nueva.add(id);
    const actual = this._seleccion;
    if (nueva.size === actual.size && [...nueva].every((id) => actual.has(id))) return;
    this.limpiarCruces();
    this._seleccion = nueva;
    this.alCambiarSeleccion?.();
    this.vista?.invalidar();
  }

  /**
   * Resumen de la selección para el panel de propiedades. Se pide cuando
   * cambia la selección o algo seleccionado, no por cuadro: el rectángulo de
   * selección cambia la selección recién al soltar. Con varios, una pasada por
   * la hoja; el conteo de red, solo con una única fuente.
   */
  resumenSeleccion(): ResumenSeleccion {
    const cantidad = this._seleccion.size;
    if (cantidad === 0) return SIN_SELECCION;
    // Una pasada por los componentes y otra por los cables de la hoja.
    let componentes = 0;
    let cables = 0;
    let etiqueta: string | null = null;
    let rot: number | null = null;
    let unico: Componente | null = null;
    let unicoCable: Cable | null = null;
    for (const c of this.componentesHoja()) {
      if (!this._seleccion.has(c.id)) continue;
      if (componentes === 0) {
        etiqueta = c.etiqueta;
        rot = c.rot;
        unico = c;
      } else {
        if (etiqueta !== c.etiqueta) etiqueta = null;
        if (rot !== c.rot) rot = null;
      }
      componentes++;
    }
    for (const w of this.cablesHoja()) {
      if (!this._seleccion.has(w.id)) continue;
      if (cables === 0) unicoCable = w;
      cables++;
    }
    const base = { cantidad, componentes, cables, cable: null, unico: null, varios: null };
    if (cantidad > 1) return { ...base, varios: { etiqueta, rot } };
    if (unicoCable) {
      const w = unicoCable;
      return { ...base, cable: { id: w.id, desde: this.extremoResumen(w.desde), hasta: this.extremoResumen(w.hasta) } };
    }
    if (!unico) return base;
    const c = unico;
    const def = buscarSimbolo(c.tipo) ?? SIMBOLO_DESCONOCIDO;
    const esFuente = def.elemento === "fuente";
    return {
      ...base,
      unico: {
        id: c.id,
        nombre: def.nombre,
        etiqueta: c.etiqueta,
        rot: c.rot,
        espejado: c.espejado,
        esFuente,
        otrasEnRed: esFuente ? this.otrasEnRed(c) : 0,
      },
    };
  }

  /** Un extremo para el panel: en un borne, la etiqueta del componente (o su id, si no tiene). */
  private extremoResumen(e: Extremo): ExtremoResumen {
    if (e.tipo !== "borne") return { tipo: e.tipo };
    const c = this.componentesHoja().find((k) => k.id === e.comp);
    return { tipo: "borne", etiqueta: c?.etiqueta || e.comp, borne: e.borne };
  }

  /** Cuántas otras fuentes del documento (todas las hojas) tienen el mismo nombre de red que `f`. */
  private otrasEnRed(f: Componente): number {
    const red = normalizarEtiqueta(f.etiqueta);
    let n = 0;
    for (const hoja of this.documento.hojas) {
      for (const c of hoja.componentes) {
        if (c.id === f.id || normalizarEtiqueta(c.etiqueta) !== red) continue;
        if (buscarSimbolo(c.tipo)?.elemento === "fuente") n++;
      }
    }
    return n;
  }

  /**
   * Hay un gesto del puntero en curso: rectángulo o arrastre de la selección,
   * o un arrastre desde la paleta. F5 no cambia de modo en el medio.
   */
  get enGesto(): boolean {
    return this.seleccionar.enGesto || this.arrastre !== null || this.colocar?.modo === "arrastre" || (this.cable?.enGesto ?? false);
  }

  /**
   * Cambia la etiqueta de un componente con un solo `CambiarEtiqueta` (un paso
   * de deshacer). El texto llega ya validado y normalizado por el panel. No
   * hace nada (y devuelve false) si el valor es el mismo, si el componente ya
   * no está en la hoja o en medio de un gesto.
   */
  cambiarEtiqueta(id: string, etiqueta: string): boolean {
    if (this.enGesto) return false;
    const c = this.componentesHoja().find((k) => k.id === id);
    if (!c || c.etiqueta === etiqueta) return false;
    this.ejecutar(new CambiarEtiqueta(id, etiqueta));
    return true;
  }

  /** Tipos de símbolo del documento que no están en la biblioteca (se dibujan con SIMBOLO_DESCONOCIDO). */
  get tiposDesconocidos(): ReadonlySet<string> {
    return this.desconocidos;
  }

  /** Con un tramo en curso, siempre: Deshacer quita el último codo (o cancela el tramo). */
  get puedeDeshacer(): boolean {
    return this.enTramo || this.historial.puedeDeshacer;
  }

  /** Con un tramo en curso, nunca. */
  get puedeRehacer(): boolean {
    return !this.enTramo && this.historial.puedeRehacer;
  }

  /** Ejecuta el comando y muestra el cambio. Si el comando tira un error, no cambia nada. */
  ejecutar(comando: Comando): Cambio {
    return this.trasHistorial(this.reflejar(this.historial.ejecutar(comando)));
  }

  /** Varios comandos en un solo paso de deshacer. */
  agrupar(comandos: readonly Comando[]): Cambio {
    return this.trasHistorial(this.reflejar(this.historial.agrupar(comandos)));
  }

  /**
   * Deshace el último paso. Lo seleccionado que sale del documento (por
   * ejemplo, al deshacer su Colocar) sale también de la selección. Para el
   * teclado y los botones, usar `accion("deshacer")`, que no lo hace en medio
   * de un gesto.
   */
  deshacer(): Cambio | null {
    const cambio = this.historial.deshacer();
    return cambio && this.trasHistorial(this.reflejar(cambio));
  }

  /** Rehace el último paso deshecho. Igual que `deshacer` con la selección. */
  rehacer(): Cambio | null {
    const cambio = this.historial.rehacer();
    return cambio && this.trasHistorial(this.reflejar(cambio));
  }

  /**
   * Hace la acción de un atajo o un botón, si se puede ahora (ver el
   * comentario del principio). Devuelve true si hizo algo.
   */
  accion(a: Accion): boolean {
    this.limpiarCruces();
    if (a === "cable") return this.alternarCable();
    const w = this.cable;
    if (w) {
      // Herramienta cable: con un tramo, deshacer (o Retroceso) quita el último
      // codo; rehacer no hace nada. Sin tramo, deshacer y rehacer normales.
      // Girar, espejar y borrar no hacen nada. Con el botón apretado, nada.
      if (w.enGesto) return false;
      if (a === "deshacer" || a === "borrarAtras") {
        const r = w.quitarCodo();
        if (r) {
          this.aplicar(r);
          return true;
        }
        return a === "deshacer" && this.deshacer() !== null;
      }
      if (a === "rehacer") return !w.enTramo && this.rehacer() !== null;
      return false;
    }
    if (a === "borrarAtras") a = "borrar";
    const h = this.colocar;
    if (h) {
      // Colocando: girar y espejar cambian la vista previa (también mientras
      // se arrastra desde la paleta).
      if (a === "rotar" || a === "rotarAntihorario") {
        this.aplicar(h.rotar(a === "rotar" ? 90 : -90));
        return true;
      }
      if (a === "espejar") {
        this.aplicar(h.espejar());
        return true;
      }
      if (a === "borrar" || h.modo === "arrastre") return false;
    } else if (this.seleccionar.enGesto) {
      return false;
    }
    switch (a) {
      case "deshacer":
        return this.deshacer() !== null;
      case "rehacer":
        return this.rehacer() !== null;
    }
    const ids = this.idsSeleccionados();
    if (ids.length === 0) return false;
    if (a === "borrar") {
      this.borrarSeleccion(ids);
      return true;
    }
    const op: Operacion = a === "espejar" ? { tipo: "espejar" } : { tipo: "rotar", sentido: a === "rotar" ? 90 : -90 };
    const r = this.planear(ids, op);
    if (r.rechazo || !r.plan) {
      this.alAvisar?.(r.rechazo!.motivo);
      this.crucesRechazo = r.rechazo!.conflictos;
      if (this.crucesRechazo.length > 0) this.vista?.invalidar();
      return false;
    }
    const opciones = { entorno: this.entornoPlan, plan: r.plan };
    this.ejecutar(op.tipo === "rotar" ? new Rotar(ids, op.sentido, opciones) : new Espejar(ids, opciones));
    return true;
  }

  /**
   * El plan de girar, espejar o mover `ids` con el índice y la consulta del
   * editor. Si la hoja tiene un cable que no se puede resolver, un rechazo.
   */
  private planear(ids: readonly string[], op: Operacion): ResultadoPlan | PlanFallido {
    const hoja = this.documento.hojas[this.hoja];
    try {
      if (hoja) return planearTransformacion(hoja, ids, op, this.entornoPlan());
    } catch {
      // un cable que apunta a algo que no está
    }
    return { plan: null, rechazo: { motivo: `${prefijoRechazo(op)}: ${enMinuscula(MENSAJE_NO_SE_ACOMODA)}`, conflictos: [] } };
  }

  /** True si algún componente de `ids` tiene un cable en un borne. Una pasada por los cables. */
  tieneCables(ids: Iterable<string>): boolean {
    const hoja = this.documento.hojas[this.hoja];
    return hoja !== undefined && hayCablesEn(hoja, new Set(ids));
  }

  /** Borra las ✕ de un R o M rechazado, si había. */
  private limpiarCruces(): void {
    if (this.crucesRechazo.length === 0) return;
    this.crucesRechazo = [];
    this.vista?.invalidar();
  }

  /** Prepara el plan de mover `ids`; null si la hoja tiene un cable que no se puede resolver. */
  private preparar(ids: Iterable<string>): Preparacion | null {
    const hoja = this.documento.hojas[this.hoja];
    if (!hoja) return null;
    try {
      return prepararTransformacion(hoja, ids, this.entornoPlan());
    } catch {
      return null;
    }
  }

  /**
   * Aviso si la selección `ids` no se puede arrastrar (no movería nada);
   * null si se puede. Deja hecha la preparación para el arrastre.
   */
  private motivoArrastre(ids: ReadonlySet<string>): string | null {
    const prep = this.preparar(ids);
    if (!prep) return `${prefijoRechazo({ tipo: "mover", dx: 0, dy: 0 })}: ${enMinuscula(MENSAJE_NO_SE_ACOMODA)}`;
    this.preparado = { ids, prep, cambios: this._cambios };
    return prep.motivoNada;
  }

  /**
   * El comando del arrastre al soltar en (dx, dy), con el plan de la previa si
   * el documento no cambió (si cambió, se planea de nuevo). Null si el plan se
   * rechaza: se avisa y no hay paso.
   */
  private comandoArrastre(ids: string[], dx: number, dy: number): Comando | null {
    const a = this.arrastre;
    const op: Operacion = { tipo: "mover", dx, dy };
    const mismos =
      a !== null && a.prep !== null && a.cambios === this._cambios && a.ids.size === ids.length && ids.every((id) => a.ids.has(id));
    let r: ResultadoPlan | PlanFallido;
    if (mismos && a.plan && a.plan.dx === dx && a.plan.dy === dy) r = a.plan.r;
    else if (mismos) r = a.prep!.planear(op);
    else r = this.planear(ids, op);
    if (r.rechazo || !r.plan) {
      this.alAvisar?.(r.rechazo!.motivo);
      return null;
    }
    return new Mover(ids, dx, dy, { entorno: this.entornoPlan, plan: r.plan });
  }

  /** Con muchos cables que se acomodan, la previa no planea en cada punto (modo reducido). */
  private reducido(a: ArrastreEditor): boolean {
    return (a.prep?.rehechos ?? 0) > TOPE_CABLES_PREVIA;
  }

  /**
   * El plan del punto de grilla actual del arrastre (con caché); null sin
   * arrastre, sin moverse, en modo reducido o si el documento cambió.
   */
  private planArrastre(): PlanArrastre | null {
    const a = this.arrastre;
    const g = this.seleccionar.arrastre;
    if (!a || !g || !a.prep || (g.dx === 0 && g.dy === 0) || this.reducido(a) || a.cambios !== this._cambios) return null;
    if (a.plan && a.plan.dx === g.dx && a.plan.dy === g.dy) return a.plan;
    const r = a.prep.planear({ tipo: "mover", dx: g.dx, dy: g.dy });
    const cambiados = new Map<string, CableEscena>();
    for (const c of r.plan.cables) {
      const libres: number[] = [];
      if (c.desde.tipo === "libre") libres.push(c.desde.x, c.desde.y);
      if (c.hasta.tipo === "libre") libres.push(c.hasta.x, c.hasta.y);
      cambiados.set(c.id, { puntos: c.puntos, libres });
    }
    a.plan = { dx: g.dx, dy: g.dy, r, cambiados, invalidos: r.rechazo ? cablesEnConflicto(r.rechazo.conflictos) : new Set() };
    return a.plan;
  }

  /** Pista del arrastre: por qué no se puede soltar acá, o cuántos cables se acomodan al soltar. */
  private pistaArrastre(): string | null {
    const a = this.arrastre;
    if (!a || !this.seleccionar.arrastre) return null;
    if (this.reducido(a)) return `${a.prep!.rehechos} cables se acomodan al soltar.`;
    return this.planArrastre()?.r.rechazo?.motivo ?? null;
  }

  /**
   * Borra lo seleccionado en un solo paso, componentes y cables juntos.
   * `Borrar` suelta lo que colgaba de lo borrado.
   */
  private borrarSeleccion(ids: readonly string[]): void {
    this.ejecutar(new Borrar(ids));
  }

  /**
   * Los ids seleccionados que siguen en la hoja. La selección ya se limpia al
   * reflejar cada cambio; esto es la garantía de que un comando nunca nombra
   * un id que no existe.
   */
  private idsSeleccionados(): string[] {
    if (this._seleccion.size === 0) return [];
    const ids: string[] = [];
    for (const c of this.componentesHoja()) if (this._seleccion.has(c.id)) ids.push(c.id);
    for (const w of this.cablesHoja()) if (this._seleccion.has(w.id)) ids.push(w.id);
    return ids;
  }

  /** Avisa que el historial cambió (después de reflejar el cambio). */
  private trasHistorial(cambio: Cambio): Cambio {
    this.alCambiarHistorial?.();
    return cambio;
  }

  /** Empieza a colocar un símbolo de la paleta (cancela la herramienta cable). Sin vista no hace nada. */
  iniciarColocar(def: DefinicionSimbolo, modo: ModoColocar): HerramientaColocar | null {
    if (!this.vista) return null;
    const h = new HerramientaColocar(def, modo, this.documento, this.hoja, (p) => this.revisarColocar(p));
    this.ponerHerramienta(h);
    return h;
  }

  /** Conexiones aparentes que crearía colocar la previa `p` (la misma regla que al mover). */
  private revisarColocar(p: Omit<Previa, "conflictos">): Conflicto[] {
    const g = geometriaComponente({
      id: "nuevo",
      tipo: p.def.tipo,
      x: p.x,
      y: p.y,
      rot: p.rotacion,
      espejado: p.espejado,
      etiqueta: p.def.etiquetaInicial ?? "",
    });
    return g ? problemasComponente(g, this.consulta) : [];
  }

  /**
   * Activa la herramienta cable (W): cancela Colocar sin colocar y vacía la
   * selección (en W no se puede actuar sobre ella). Sin vista, o en medio de
   * un gesto, no hace nada.
   */
  iniciarCable(): HerramientaCable | null {
    if (!this.vista || this.seleccionar.enGesto || this.arrastre || this.colocar?.modo === "arrastre") return null;
    this.seleccionarIds([]);
    const h = new HerramientaCable({
      documento: this.documento,
      hoja: this.hoja,
      consulta: this.consulta,
      indice: () => this.indiceHoja,
      cambios: () => this._cambios,
    });
    this.ponerHerramienta(h);
    // Las marcas de los bornes aparecen sin esperar a que se mueva el mouse.
    this.vista?.invalidar();
    return h;
  }

  /**
   * W: activa la herramienta cable, o la termina si ya está y no hay tramo.
   * Con un tramo no hace nada (avisa cómo cancelarlo).
   */
  private alternarCable(): boolean {
    const w = this.cable;
    if (!w) return this.iniciarCable() !== null;
    if (w.enTramo || w.enGesto) {
      this.alAvisar?.("Esc cancela el cable en curso.");
      return false;
    }
    this.aplicar(w.terminar());
    return true;
  }

  /** Cambia la herramienta activa y avisa (la paleta, los botones de deshacer y la pista). */
  private ponerHerramienta(h: HerramientaColocar | HerramientaCable): void {
    const habiaCable = this.cable !== null;
    this.herramienta = h;
    this.alCambiarHerramienta?.();
    this.avisarTramo();
    this.avisarPista();
    // Lo que dibujaba la herramienta cable (marcas, tramo) se borra.
    if (habiaCable) this.vista?.invalidar();
  }

  /**
   * Termina la herramienta activa sin hacer nada (cambio de escena o de
   * modo): un tramo en curso se descarta. Un arrastre en curso vuelve a su lugar.
   */
  cancelarHerramienta(): void {
    if (this.herramienta) this.aplicar(this.herramienta.terminar());
    if (this.arrastre) this.aplicar(this.seleccionar.cancelar());
  }

  /** Esc con una herramienta: Colocar termina; Cable cancela el tramo (o termina si no hay). */
  escape(): void {
    if (this.herramienta) this.aplicar(this.herramienta.cancelar());
  }

  /** La cámara o el documento cambiaron: la herramienta cable vuelve a mirar qué hay bajo el cursor. */
  refrescarHerramienta(): void {
    if (this.cable?.refrescar()) {
      this.avisarTramo(); // un cambio del documento pudo cancelar el tramo
      this.avisarPista();
      this.vista?.invalidar();
    }
    // Colocando en modo clic, deshacer o rehacer pueden cambiar si la previa vale.
    if (this.colocar?.revisarDeNuevo()) {
      this.avisarPista();
      this.vista?.invalidar();
    }
  }

  /**
   * Si empezó o terminó un tramo, avisa a los botones de deshacer y rehacer.
   * Se compara con lo último avisado: la herramienta cambia su estado antes
   * de que el editor aplique su resultado.
   */
  private avisarTramo(): void {
    const t = this.enTramo;
    if (t === this.tramoAvisado) return;
    this.tramoAvisado = t;
    this.alCambiarHistorial?.();
  }

  private avisarPista(): void {
    const p = this.pista;
    if (p === this.pistaAvisada) return;
    this.pistaAvisada = p;
    this.alCambiarPista?.(p);
  }

  /**
   * Hace lo que pidió la herramienta: empezar un arrastre, ejecutar su
   * comando, terminar el arrastre, cambiar la selección, redibujar, terminar.
   */
  aplicar(r: Resultado): void {
    if (r.aviso) this.alAvisar?.(r.aviso);
    if (r.arrastre?.fase === "empezar") this.empezarArrastre(r.arrastre.ids);
    const termina = r.arrastre?.fase === "terminar";
    this.soltando = termina;
    try {
      if (r.comando) this.ejecutar(r.comando);
    } finally {
      this.soltando = false;
      // Aunque el comando falle, lo arrastrado no puede quedar oculto.
      if (termina) this.terminarArrastre();
    }
    if (r.seleccion) this.seleccionarIds(r.seleccion);
    if (r.terminar && this.herramienta) {
      this.herramienta = null;
      this.alCambiarHerramienta?.();
    }
    this.avisarTramo();
    this.avisarPista();
    if (r.redibujar || r.terminar) this.vista?.invalidar();
  }

  /** Devuelve las mediciones de la sonda juntadas hasta ahora y empieza de cero. */
  tomarMuestras(): number[] {
    const m = this.muestras;
    this.muestras = [];
    return m;
  }

  /**
   * Saca los arrastrados y toda la zona de cables de la capa estática: cada
   * uno invalida sus cajas (por tramo, en los cables). Recién al pasar el
   * umbral: un clic sin movimiento no invalida nada.
   */
  private empezarArrastre(ids: ReadonlySet<string>): void {
    if (this.arrastre) this.terminarArrastre();
    const p = this.preparado;
    const prep = p && p.ids === ids && p.cambios === this._cambios ? p.prep : this.preparar(ids);
    this.preparado = null;
    this.limpiarCruces();
    const cables = prep ? [...prep.zona] : [];
    this.arrastre = { ids, prep, cambios: this._cambios, cables, plan: null };
    this.cuadrosArrastre = 0;
    for (const id of ids) {
      const k = this.escena.ocultar(id);
      if (k) this.vista?.invalidarRegion(k);
    }
    for (const id of cables) for (const k of this.escena.ocultarCable(id)) this.vista?.invalidarRegion(k);
  }

  /** Vuelve los arrastrados y su zona de cables a la capa estática, como estén ahora: cada uno invalida sus cajas. */
  private terminarArrastre(): void {
    const a = this.arrastre;
    this.arrastre = null;
    if (!a) return;
    for (const id of a.ids) {
      const k = this.escena.mostrar(id);
      if (k) this.vista?.invalidarRegion(k);
    }
    for (const id of a.cables) for (const k of this.escena.mostrarCable(id)) this.vista?.invalidarRegion(k);
  }

  /**
   * El documento cambió por otra vía en medio de un arrastre: el plan ya no
   * vale. Se cancela como con Esc (todo vuelve, sin paso) y se avisa.
   */
  private cancelarArrastrePorCambio(): void {
    this.alAvisar?.(AVISO_ARRASTRE_CANCELADO);
    this.aplicar(this.seleccionar.cancelar());
  }

  /**
   * Los cables de la zona en la capa dinámica: los rígidos corridos (dx, dy),
   * los que se acomodan con el recorrido del plan (o como estaban), lo
   * inválido a rayas con la ✕; en modo reducido, gomas.
   */
  private dibujarCablesDelArrastre(r: Renderer, info: InfoDinamico, a: ArrastreEditor, dx: number, dy: number, bornes: boolean): void {
    const prep = a.prep;
    if (!prep) return;
    const v = info.visible;
    const plan = this.planArrastre();
    const reducido = this.reducido(a);
    const invalidos: number[][] = [];
    const gomas: number[] = [];
    const libres: number[] = [];
    let n = 0;
    for (const id of a.cables) {
      const c = this.escena.obtenerCable(id);
      if (!c) continue;
      if (prep.rigidos.has(id)) {
        if (plan?.invalidos.has(id)) invalidos.push([...(plan.cambiados.get(id)?.puntos ?? [])]);
        else n = anotarTramos(c, v, this.tramosArrastre, n, dx, dy);
        if (bornes) for (let i = 0; i + 1 < c.libres.length; i += 2) libres.push(c.libres[i]! + dx, c.libres[i + 1]! + dy);
        continue;
      }
      if (reducido) {
        n = this.anotarGoma(id, c, v, dx, dy, prep, n, gomas);
        if (bornes) libres.push(...c.libres);
        continue;
      }
      const k = plan?.cambiados.get(id) ?? c;
      if (plan?.invalidos.has(id)) invalidos.push([...k.puntos]);
      else n = anotarTramos(k, v, this.tramosArrastre, n);
      if (bornes) libres.push(...k.libres);
    }
    dibujarCablesArrastre(r, info, {
      tramos: this.tramosArrastre,
      cantidad: n,
      invalidos,
      gomas,
      libres,
      conflictos: plan?.r.rechazo?.conflictos ?? [],
    });
  }

  /**
   * Modo reducido: la parte fija de un cable que se acomoda, como estaba, y
   * una goma recta desde su último punto fijo hasta cada extremo movido.
   */
  private anotarGoma(id: string, c: CableEscena, v: Caja, dx: number, dy: number, prep: Preparacion, n: number, gomas: number[]): number {
    const w = this.indiceHoja.cables.get(id);
    if (!w) return n;
    const mueve = (e: Extremo) => (e.tipo === "borne" && prep.movidos.has(e.comp)) || (e.tipo === "cable" && prep.rigidos.has(e.cable));
    const p = c.puntos;
    const m = p.length;
    const desde = mueve(w.desde);
    const hasta = mueve(w.hasta);
    const i0 = desde ? 2 : 0;
    const i1 = hasta ? m - 2 : m;
    if (i1 - i0 >= 4) n = anotarTramos({ puntos: p.slice(i0, i1), libres: [] }, v, this.tramosArrastre, n);
    if (desde) gomas.push(p[2]!, p[3]!, p[0]! + dx, p[1]! + dy);
    if (hasta) gomas.push(p[m - 4]!, p[m - 3]!, p[m - 2]! + dx, p[m - 1]! + dy);
    return n;
  }

  /**
   * Capa dinámica: lo que se arrastra (con los colores de siempre), y con el
   * color de acento el resaltado de la selección, el rectángulo de selección
   * y la vista previa de Colocar. No toca la capa estática.
   */
  readonly dibujarDinamico = (r: Renderer, info: InfoDinamico): void => {
    const ae = this.arrastre;
    const a = ae && this.seleccionar.arrastre;
    if (ae && a) {
      const { modo, sonda } = this.diagnostico;
      if (modo === "nada") return; // base: la capa dinámica vacía
      const detalle = nivelDetalle(info.escala);
      if (modo === "sinTextos" || modo === "sinTextosNiBornes") detalle.textos = false;
      if (modo === "sinTextosNiBornes") detalle.bornes = false;
      const limite = modo === "auto" ? LIMITE_ARRASTRE_COMPLETO : modo === "contornos" ? 0 : Infinity;
      const datos = { ...info, detalle };
      const dibujar = () => {
        // Como en la capa estática: primero los cables, después los componentes.
        this.dibujarCablesDelArrastre(r, info, ae, a.dx, a.dy, detalle.bornes);
        this.escena.dibujarDesplazados(r, datos, a.ids, a.dx, a.dy, limite);
      };
      if (sonda && esCuadroDeMuestra(this.cuadrosArrastre)) this.muestras.push(info.medir(dibujar));
      else dibujar();
      this.cuadrosArrastre++;
      // El resaltado de un cable sigue su recorrido de la previa (los rígidos, corridos).
      const plan = this.planArrastre();
      dibujarSeleccion(r, info, this.escena, this._seleccion, a.dx, a.dy, (id) => {
        const c = this.escena.obtenerCable(id);
        if (!c) return null;
        if (ae.prep?.rigidos.has(id)) return { cable: c, dx: a.dx, dy: a.dy };
        return { cable: plan?.cambiados.get(id) ?? c, dx: 0, dy: 0 };
      });
    } else if (this._seleccion.size > 0) {
      dibujarSeleccion(r, info, this.escena, this._seleccion);
    }
    if (this.crucesRechazo.length > 0) dibujarCruces(r, info, this.crucesRechazo);
    const rect = this.seleccionar.rectangulo;
    if (rect) dibujarRectangulo(r, info, rect);
    const w = this.cable;
    if (w) {
      if (nivelDetalle(info.escala).bornes) {
        const m = this.marcasVisibles(info.visible);
        dibujarMarcasCable(r, info, m.libres, m.ocupados);
      }
      const d = w.dibujo;
      if (d) dibujarCableEnCurso(r, info, d);
      return;
    }
    const p = this.colocar?.previa;
    if (!p) return;
    // Con la orientación de la herramienta (R, M): la misma que va a tener al colocarse.
    const c = { x: p.x, y: p.y, rotacion: p.rotacion, espejado: p.espejado };
    // Si crearía una conexión aparente, en aviso y con la ✕ (el clic no coloca).
    const valida = p.conflictos.length === 0;
    const color = valida ? info.colores.acento : (info.colores.aviso ?? info.colores.borne);
    r.estilo({ trazo: color, relleno: color, grosor: grosorLinea(info.escala) });
    const detalle = nivelDetalle(info.escala);
    dibujarSimbolo(r, p.def, c, { textos: detalle.textos, etiqueta: p.def.etiquetaInicial });
    if (detalle.bornes) dibujarMarcasBornes(r, p.def, c);
    if (!valida) dibujarCruces(r, info, p.conflictos);
  };

  /**
   * Bornes en `v` para las marcas de la herramienta W: libres (huecos) y con
   * cable (rellenos), x, y seguidos. Se rehacen solo si cambió la vista o el
   * documento; con cable o no sale de `bornesConCable`, sin recorrer los cables.
   */
  private marcasVisibles(v: Caja): { libres: number[]; ocupados: number[] } {
    const clave = `${v.x}|${v.y}|${v.ancho}|${v.alto}|${this._cambios}`;
    if (this.marcas.clave === clave) return this.marcas;
    const libres: number[] = [];
    const ocupados: number[] = [];
    for (const [id, c] of this.escena.componentesEn(v)) {
      if (!buscarSimbolo(c.def.tipo)) continue;
      for (const b of bornesColocados(c.def.bornes, c.x, c.y, c)) {
        if (b.x < v.x - 1 || b.x > v.x + v.ancho + 1 || b.y < v.y - 1 || b.y > v.y + v.alto + 1) continue;
        (this.bornesConCable.tiene(id, b.nombre) ? ocupados : libres).push(b.x, b.y);
      }
    }
    this.marcas = { clave, libres, ocupados };
    return this.marcas;
  }

  private componentesHoja(): readonly Componente[] {
    return this.documento.hojas[this.hoja]?.componentes ?? [];
  }

  private cablesHoja(): readonly Cable[] {
    return this.documento.hojas[this.hoja]?.cables ?? [];
  }

  /**
   * Lo que dibuja la escena para un cable del documento, o null si no se
   * puede resolver (un extremo apunta a algo que no está): no se dibuja y se
   * avisa en la consola, sin romper nada.
   */
  private cableEscena(indice: IndiceHoja, w: Cable): CableEscena | null {
    const puntos = recorridoCable(indice, w);
    if (!puntos) {
      console.warn(`Bornera: el cable "${w.id}" apunta a algo que no está; no se dibuja.`);
      return null;
    }
    const libres: number[] = [];
    if (w.desde.tipo === "libre") libres.push(w.desde.x, w.desde.y);
    if (w.hasta.tipo === "libre") libres.push(w.hasta.x, w.hasta.y);
    return { puntos, libres };
  }

  /** Lo que dibuja la escena para un componente del documento. Avisa una vez por tipo desconocido. */
  private aEscena(c: Componente): ComponenteEscena {
    let def = buscarSimbolo(c.tipo);
    if (!def) {
      def = SIMBOLO_DESCONOCIDO;
      if (!this.desconocidos.has(c.tipo)) {
        this.desconocidos.add(c.tipo);
        console.warn(`Bornera: el símbolo "${c.tipo}" no está en la biblioteca; se dibuja como desconocido.`);
      }
    }
    return { def, x: c.x, y: c.y, rotacion: c.rot, espejado: c.espejado, etiqueta: c.etiqueta || undefined };
  }

  /**
   * Lleva a la escena el estado actual de cada componente del cambio: si sigue
   * en la hoja, se agrega o actualiza; si no (se borró, o es de otra hoja), se
   * quita. Cada componente invalida sus propias cajas, y la vieja y la nueva
   * por separado: unirlas marcaría de más si están lejos entre sí (dos
   * componentes lejanos, o deshacer un movimiento largo).
   */
  private reflejar(cambio: Cambio): Cambio {
    // Un cambio por otra vía en medio de un arrastre: el plan de la previa ya no vale.
    if (this.arrastre && !this.soltando) this.cancelarArrastrePorCambio();
    this.limpiarCruces();
    this._cambios++;
    if (cambio.componentes.length === 0 && cambio.cables.length === 0) return this.trasReflejar(cambio);
    // Una pasada por la hoja, no una búsqueda por id.
    const ids = new Set(cambio.componentes);
    const actuales = new Map<string, Componente>();
    for (const c of this.componentesHoja()) if (ids.has(c.id)) actuales.set(c.id, c);
    for (const id of ids) {
      const c = actuales.get(id);
      if (c) this.indiceHoja.componentes.set(id, c);
      else this.indiceHoja.componentes.delete(id);
    }

    let tocaSeleccion = false;
    let quitados: string[] | null = null;
    for (const id of ids) {
      const c = actuales.get(id);
      if (c) {
        for (const k of this.escena.actualizar(id, this.aEscena(c))) this.vista?.invalidarRegion(k);
      } else {
        const k = this.escena.quitar(id);
        if (k) this.vista?.invalidarRegion(k);
      }
      if (this._seleccion.has(id)) {
        tocaSeleccion = true;
        if (!c) (quitados ??= []).push(id);
      }
    }
    if (cambio.cables.length > 0) {
      const idsCables = new Set(cambio.cables);
      const actualesCables = new Map<string, Cable>();
      for (const w of this.cablesHoja()) if (idsCables.has(w.id) && !actualesCables.has(w.id)) actualesCables.set(w.id, w);
      for (const id of idsCables) {
        const w = actualesCables.get(id);
        if (w) this.indiceHoja.cables.set(id, w);
        else this.indiceHoja.cables.delete(id);
        this.bornesConCable.poner(id, w);
      }
      const indice = this.indiceHoja;
      for (const id of idsCables) {
        const w = indice.cables.get(id);
        const c = w ? this.cableEscena(indice, w) : null;
        const cajas = c ? this.escena.ponerCable(id, c) : this.escena.quitarCable(id);
        for (const k of cajas) this.vista?.invalidarRegion(k);
        if (this._seleccion.has(id)) {
          tocaSeleccion = true;
          if (!c) (quitados ??= []).push(id);
        }
      }
    }
    // Lo seleccionado que ya no está (se borró, o se deshizo su Colocar) sale de la selección.
    if (quitados) {
      const nueva = new Set(this._seleccion);
      for (const id of quitados) nueva.delete(id);
      this._seleccion = nueva;
    }
    if (tocaSeleccion) {
      this.alCambiarSeleccion?.();
      // El resaltado se mueve con el componente, aunque su región no esté en pantalla.
      this.vista?.invalidar();
    }
    return this.trasReflejar(cambio);
  }

  /** Después de un cambio, la herramienta cable vuelve a mirar qué hay bajo el cursor. */
  private trasReflejar(cambio: Cambio): Cambio {
    this.refrescarHerramienta();
    return cambio;
  }
}
