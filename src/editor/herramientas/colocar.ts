// Herramienta Colocar: un símbolo elegido en la paleta sigue al mouse,
// ajustado a la grilla, y al confirmar se ejecuta un `Colocar`.
//
// Dos modos, según cómo se eligió en la paleta:
// - "arrastre": se arrastra desde la paleta y se suelta sobre el lienzo. Una
//   sola colocación; soltar fuera del lienzo no coloca nada.
// - "clic": clic en la paleta y después clic en el lienzo. Queda activa para
//   colocar varios iguales; Esc o el botón derecho la terminan.
//
// La vista previa va en la capa dinámica: solo pide redibujo cuando el punto
// de grilla cambia, no en cada píxel que se mueve el mouse.
//
// R y M (T10) giran y espejan la vista previa con las mismas funciones que
// los comandos Rotar y Espejar (`rotarEnPantalla`, `espejarEnPantalla`), y el
// Colocar sale con esa orientación. No tocan el documento ni el historial: es
// estado de la herramienta. Se conserva mientras siga activa (para colocar
// varios iguales) y cada herramienta nueva empieza derecha (0°, sin espejar).

import { colocar } from "../../core/model/comandos";
import type { Documento } from "../../core/model/documento";
import {
  espejarEnPantalla,
  rotarEnPantalla,
  SIN_TRANSFORMAR,
  type DefinicionSimbolo,
  type Transformacion,
} from "../../core/symbols";
import { NADA, type EventoHerramienta, type Herramienta, type Resultado } from "./tipos";

export type ModoColocar = "clic" | "arrastre";

/** Lo que dibuja la vista previa: el símbolo en un punto entero de la grilla, con su orientación. */
export interface Previa extends Transformacion {
  def: DefinicionSimbolo;
  x: number;
  y: number;
}

/** Redondea al punto de grilla más cercano, sin −0. */
export function ajustarAGrilla(v: number): number {
  return Math.round(v) || 0;
}

export class HerramientaColocar implements Herramienta {
  /** Punto de grilla bajo el mouse; null si el mouse no está sobre el lienzo. */
  private punto: { x: number; y: number } | null = null;
  /** Orientación con la que se coloca (R y M). */
  private _orientacion: Transformacion = SIN_TRANSFORMAR;

  constructor(
    readonly def: DefinicionSimbolo,
    private _modo: ModoColocar,
    private readonly doc: Documento,
    private readonly hoja = 0,
  ) {}

  get modo(): ModoColocar {
    return this._modo;
  }

  get orientacion(): Transformacion {
    return this._orientacion;
  }

  get previa(): Previa | null {
    return this.punto && { def: this.def, x: this.punto.x, y: this.punto.y, ...this._orientacion };
  }

  /** R (o Mayús+R): gira la vista previa 90°. Redibuja solo si se ve. */
  rotar(sentido: 90 | -90): Resultado {
    this._orientacion = rotarEnPantalla(this._orientacion, sentido);
    return { redibujar: this.punto !== null };
  }

  /** M: espeja la vista previa izquierda ↔ derecha. Redibuja solo si se ve. */
  espejar(): Resultado {
    this._orientacion = espejarEnPantalla(this._orientacion);
    return { redibujar: this.punto !== null };
  }

  /**
   * Se soltó el arrastre sin moverse (fue un clic en la paleta): pasa a
   * esperar el clic en el lienzo.
   */
  aClic(): void {
    this._modo = "clic";
  }

  /** El mouse se movió sobre el lienzo. */
  mover(ev: EventoHerramienta): Resultado {
    return this.ubicar(ev) ? { redibujar: true } : NADA;
  }

  /** El mouse salió del lienzo: se esconde la vista previa. */
  salir(): Resultado {
    if (!this.punto) return NADA;
    this.punto = null;
    return { redibujar: true };
  }

  /** Botón apretado sobre el lienzo. En modo clic, el izquierdo coloca y el derecho termina. */
  presionar(ev: EventoHerramienta): Resultado {
    if (this._modo !== "clic") return NADA;
    if (ev.boton === 2) return this.cancelar();
    if (ev.boton !== 0) return NADA;
    const redibujar = this.ubicar(ev);
    return { comando: this.comando(), redibujar };
  }

  /**
   * Se soltó el arrastre: `ev` es el punto sobre el lienzo, o null si se soltó
   * afuera (no se coloca nada). En modo clic no hace nada.
   */
  soltar(ev: EventoHerramienta | null): Resultado {
    if (this._modo !== "arrastre") return NADA;
    this.punto = null;
    if (!ev) return { redibujar: true, terminar: true };
    this.ubicar(ev);
    const comando = this.comando();
    this.punto = null;
    return { comando, redibujar: true, terminar: true };
  }

  /** Esc: termina sin colocar. */
  cancelar(): Resultado {
    this.punto = null;
    return { redibujar: true, terminar: true };
  }

  /** Termina sin colocar (otra herramienta, cambio de escena o de modo): lo mismo que Esc. */
  terminar(): Resultado {
    return this.cancelar();
  }

  /** Lleva la previa al punto de grilla del evento; true si cambió. */
  private ubicar(ev: EventoHerramienta): boolean {
    const x = ajustarAGrilla(ev.x);
    const y = ajustarAGrilla(ev.y);
    if (this.punto && this.punto.x === x && this.punto.y === y) return false;
    this.punto = { x, y };
    return true;
  }

  /**
   * El id se fija acá (generarId), al construir el comando, como piden los
   * comandos. La etiqueta es la inicial del símbolo (la fase entra como "L").
   * La orientación es la de la vista previa.
   */
  private comando() {
    const p = this.punto!;
    const etiqueta = this.def.etiquetaInicial ?? "";
    const { rotacion: rot, espejado } = this._orientacion;
    return colocar(
      this.doc,
      { tipo: this.def.tipo, x: p.x, y: p.y, rot, espejado, etiqueta, params: {} },
      this.hoja,
    );
  }
}
