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

import { type Cambio, type Comando } from "../core/model/comandos";
import { buscarComponente, crearDocumento, type Componente, type Documento } from "../core/model/documento";
import { Historial } from "../core/model/historial";
import { buscarSimbolo, type DefinicionSimbolo } from "../core/symbols";
import type { Caja } from "../render/camara";
import type { InfoDinamico } from "../render/capas";
import { nivelDetalle } from "../render/detalle";
import { grosorLinea, type ComponenteEscena } from "../render/escena";
import { EscenaEditable } from "../render/escenaEditable";
import type { Renderer } from "../render/renderer";
import { dibujarRectangulo, dibujarSeleccion } from "../render/resaltado";
import { dibujarMarcasBornes, dibujarSimbolo } from "../render/simbolo";
import { HerramientaColocar, type ModoColocar } from "./herramientas/colocar";
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

/** Lo que el panel de propiedades muestra de la selección. */
export interface ResumenSeleccion {
  cantidad: number;
  /** Con un solo componente seleccionado, sus datos; si no, null. */
  unico: {
    id: string;
    /** Nombre del símbolo, para mostrar ("Bobina de contactor"). */
    nombre: string;
    etiqueta: string;
    rot: number;
    espejado: boolean;
  } | null;
}

export const SIN_SELECCION: ResumenSeleccion = Object.freeze({ cantidad: 0, unico: null });

/**
 * Hasta cuántos componentes visibles se dibujan completos mientras se
 * arrastran. Con más, solo el contorno de cada uno: la capa dinámica se
 * redibuja entera en cada cuadro y no usa el caché de textos.
 */
export const LIMITE_ARRASTRE_COMPLETO = 200;

/** Documento vacío para arrancar la app, con la fecha de hoy. */
export function documentoNuevo(): Documento {
  return crearDocumento({ titulo: "Sin título", autor: "", fecha: new Date().toISOString().slice(0, 10) });
}

export class Editor {
  readonly historial: Historial;
  readonly escena = new EscenaEditable();
  /** Vista que muestra la escena; null si no se está mostrando (no hay nada que invalidar). */
  vista: DestinoVista | null = null;
  /** Herramienta elegida (Colocar); null si no hay ninguna y está la de selección. */
  herramienta: HerramientaColocar | null = null;
  /** Se avisa cuando empieza o termina una herramienta (para la paleta). */
  alCambiarHerramienta: (() => void) | null = null;
  /**
   * Se avisa cuando cambia la selección o algo de lo seleccionado (para el
   * panel de propiedades).
   */
  alCambiarSeleccion: (() => void) | null = null;
  /** La herramienta que está cuando no hay otra. */
  readonly seleccionar: HerramientaSeleccionar;
  private _seleccion: ReadonlySet<string> = new Set();
  /** Lo que se está arrastrando (oculto en la capa estática); null si no hay arrastre. */
  private arrastrados: ReadonlySet<string> | null = null;
  private readonly desconocidos = new Set<string>();

  constructor(
    readonly documento: Documento = documentoNuevo(),
    /** Índice de la hoja que se dibuja. */
    readonly hoja = 0,
  ) {
    this.historial = new Historial(documento);
    for (const c of this.componentesHoja()) this.escena.agregar(c.id, this.aEscena(c));
    this.seleccionar = new HerramientaSeleccionar(this.escena, () => this._seleccion);
  }

  /** La herramienta que recibe los eventos: la elegida, o la de selección. */
  get activa(): Herramienta {
    return this.herramienta ?? this.seleccionar;
  }

  /** Ids seleccionados. */
  get seleccion(): ReadonlySet<string> {
    return this._seleccion;
  }

  /** Hay un arrastre de la selección en curso (para no deshacer ni rotar en el medio). */
  get arrastrando(): boolean {
    return this.arrastrados !== null;
  }

  /**
   * Cambia la selección. Los ids que no están en la hoja se ignoran. Solo
   * pide un cuadro (la capa dinámica): la estática no cambia.
   */
  seleccionarIds(ids: Iterable<string>): void {
    const nueva = new Set<string>();
    for (const id of ids) if (this.escena.obtener(id)) nueva.add(id);
    const actual = this._seleccion;
    if (nueva.size === actual.size && [...nueva].every((id) => actual.has(id))) return;
    this._seleccion = nueva;
    this.alCambiarSeleccion?.();
    this.vista?.invalidar();
  }

  /** Resumen de la selección para el panel de propiedades. */
  resumenSeleccion(): ResumenSeleccion {
    const cantidad = this._seleccion.size;
    if (cantidad !== 1) return cantidad === 0 ? SIN_SELECCION : { cantidad, unico: null };
    const [id] = this._seleccion;
    const c = buscarComponente(this.documento, id!);
    if (!c) return { cantidad, unico: null };
    const nombre = (buscarSimbolo(c.tipo) ?? SIMBOLO_DESCONOCIDO).nombre;
    return { cantidad, unico: { id: c.id, nombre, etiqueta: c.etiqueta, rot: c.rot, espejado: c.espejado } };
  }

  /** Tipos de símbolo del documento que no están en la biblioteca (se dibujan con SIMBOLO_DESCONOCIDO). */
  get tiposDesconocidos(): ReadonlySet<string> {
    return this.desconocidos;
  }

  get puedeDeshacer(): boolean {
    return this.historial.puedeDeshacer;
  }

  get puedeRehacer(): boolean {
    return this.historial.puedeRehacer;
  }

  /** Ejecuta el comando y muestra el cambio. Si el comando tira un error, no cambia nada. */
  ejecutar(comando: Comando): Cambio {
    return this.reflejar(this.historial.ejecutar(comando));
  }

  /** Varios comandos en un solo paso de deshacer. */
  agrupar(comandos: readonly Comando[]): Cambio {
    return this.reflejar(this.historial.agrupar(comandos));
  }

  deshacer(): Cambio | null {
    const cambio = this.historial.deshacer();
    return cambio && this.reflejar(cambio);
  }

  rehacer(): Cambio | null {
    const cambio = this.historial.rehacer();
    return cambio && this.reflejar(cambio);
  }

  /** Empieza a colocar un símbolo de la paleta. Sin vista no hace nada. */
  iniciarColocar(def: DefinicionSimbolo, modo: ModoColocar): HerramientaColocar | null {
    if (!this.vista) return null;
    this.herramienta = new HerramientaColocar(def, modo, this.documento, this.hoja);
    this.alCambiarHerramienta?.();
    return this.herramienta;
  }

  /**
   * Termina la herramienta activa sin hacer nada (Esc, cambio de escena). Un
   * arrastre en curso vuelve a su lugar.
   */
  cancelarHerramienta(): void {
    if (this.herramienta) this.aplicar(this.herramienta.cancelar());
    if (this.arrastrados) this.aplicar(this.seleccionar.cancelar());
  }

  /**
   * Hace lo que pidió la herramienta: empezar un arrastre, ejecutar su
   * comando, terminar el arrastre, cambiar la selección, redibujar, terminar.
   */
  aplicar(r: Resultado): void {
    if (r.arrastre?.fase === "empezar") this.empezarArrastre(r.arrastre.ids);
    try {
      if (r.comando) this.ejecutar(r.comando);
    } finally {
      // Aunque el comando falle, lo arrastrado no puede quedar oculto.
      if (r.arrastre?.fase === "terminar") this.terminarArrastre();
    }
    if (r.seleccion) this.seleccionarIds(r.seleccion);
    if (r.terminar && this.herramienta) {
      this.herramienta = null;
      this.alCambiarHerramienta?.();
    }
    if (r.redibujar || r.terminar) this.vista?.invalidar();
  }

  /** Saca los arrastrados de la capa estática: cada uno invalida su caja. */
  private empezarArrastre(ids: ReadonlySet<string>): void {
    if (this.arrastrados) this.terminarArrastre();
    this.arrastrados = ids;
    for (const id of ids) {
      const k = this.escena.ocultar(id);
      if (k) this.vista?.invalidarRegion(k);
    }
  }

  /** Vuelve los arrastrados a la capa estática, donde estén ahora: cada uno invalida su caja. */
  private terminarArrastre(): void {
    const ids = this.arrastrados;
    this.arrastrados = null;
    if (!ids) return;
    for (const id of ids) {
      const k = this.escena.mostrar(id);
      if (k) this.vista?.invalidarRegion(k);
    }
  }

  /**
   * Capa dinámica: lo que se arrastra (con los colores de siempre), y con el
   * color de acento el resaltado de la selección, el rectángulo de selección
   * y la vista previa de Colocar. No toca la capa estática.
   */
  readonly dibujarDinamico = (r: Renderer, info: InfoDinamico): void => {
    const a = this.arrastrados && this.seleccionar.arrastre;
    if (a) {
      const datos = { ...info, detalle: nivelDetalle(info.escala) };
      this.escena.dibujarDesplazados(r, datos, a.ids, a.dx, a.dy, LIMITE_ARRASTRE_COMPLETO);
      dibujarSeleccion(r, info, this.escena, this._seleccion, a.dx, a.dy);
    } else if (this._seleccion.size > 0) {
      dibujarSeleccion(r, info, this.escena, this._seleccion);
    }
    const rect = this.seleccionar.rectangulo;
    if (rect) dibujarRectangulo(r, info, rect);
    const p = this.herramienta?.previa;
    if (!p) return;
    const c = { x: p.x, y: p.y, rotacion: 0 as const, espejado: false };
    const color = info.colores.acento;
    r.estilo({ trazo: color, relleno: color, grosor: grosorLinea(info.escala) });
    const detalle = nivelDetalle(info.escala);
    dibujarSimbolo(r, p.def, c, { textos: detalle.textos, etiqueta: p.def.etiquetaInicial });
    if (detalle.bornes) dibujarMarcasBornes(r, p.def, c);
  };

  private componentesHoja(): readonly Componente[] {
    return this.documento.hojas[this.hoja]?.componentes ?? [];
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
    if (cambio.componentes.length === 0) return cambio;
    // Una pasada por la hoja, no una búsqueda por id.
    const ids = new Set(cambio.componentes);
    const actuales = new Map<string, Componente>();
    for (const c of this.componentesHoja()) if (ids.has(c.id)) actuales.set(c.id, c);

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
    return cambio;
  }
}
