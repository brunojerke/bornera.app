// Armado de los comandos que etiquetan (T17): el editor le pide acá la
// etiqueta de lo que coloca, el Pegar ya etiquetado, el "Etiquetar los
// vacíos" y el renombrado con arrastre. Las reglas son del núcleo
// (src/core/model/etiquetado.ts); acá se juntan con el documento y se guardan
// en memoria las etiquetas de los titulares de la hoja.
//
// La memoria se invalida con cada comando (ejecutar, deshacer, rehacer: el
// editor llama a `invalidar` al reflejar cada cambio), nunca al mover el
// mouse, y se vuelve a juntar recién cuando alguien la pide. Un documento
// nuevo es un editor nuevo, con su propia memoria.
//
// No depende de la vista ni del editor: el test al azar la usa con un
// Historial suelto (armarEtiquetas.test.ts).

import { CambiarEtiquetas } from "../core/model/comandos";
import type { Documento } from "../core/model/documento";
import {
  conEtiquetas,
  etiquetarLote,
  etiquetarVacios,
  etiquetasDeTitulares,
  menorLibre,
  planRenombrarBobina,
  prefijoDe,
  type PlanRenombrar,
} from "../core/model/etiquetado";
import { pegar, type Pegar, type Recorte } from "../core/model/portapapeles";
import { esFuente, type DefinicionSimbolo } from "../core/symbols";

/** El Pegar ya etiquetado y qué etiquetas cambiaron (id del recorte → etiqueta nueva). */
export interface PegadoEtiquetado {
  comando: Pegar;
  cambios: ReadonlyMap<string, string>;
}

/** El renombrado: el comando (null si nada cambia) y el plan del núcleo. */
export interface Renombrado {
  comando: CambiarEtiquetas | null;
  plan: PlanRenombrar;
}

export class EtiquetasHoja {
  private usadasEnMemoria: Set<string> | null = null;
  private _calculos = 0;

  constructor(
    private readonly doc: Documento,
    private readonly hoja = 0,
  ) {}

  /** Cuántas veces se juntaron las etiquetas (para el test de que mover el mouse no las recalcula). */
  get calculos(): number {
    return this._calculos;
  }

  /** El documento cambió: la próxima vez que se pidan, se vuelven a juntar. */
  invalidar(): void {
    this.usadasEnMemoria = null;
  }

  /** Las etiquetas normalizadas y no vacías de los titulares de la hoja, en memoria. */
  get usadas(): ReadonlySet<string> {
    if (!this.usadasEnMemoria) {
      const h = this.doc.hojas[this.hoja];
      this.usadasEnMemoria = h ? etiquetasDeTitulares(h) : new Set();
      this._calculos++;
    }
    return this.usadasEnMemoria;
  }

  /**
   * La etiqueta con que se coloca `def`: el menor libre de su prefijo para un
   * titular; la inicial para una fuente; vacía para un seguidor o un titular
   * sin prefijo.
   */
  alColocar(def: DefinicionSimbolo): string {
    if (esFuente(def)) return def.etiquetaInicial ?? "";
    const prefijo = prefijoDe(def);
    return prefijo === null ? "" : menorLibre(this.usadas, prefijo);
  }

  /**
   * El Pegar de `recorte` desplazado, con las etiquetas de `etiquetarLote`
   * calculadas con la hoja de ahora (se llama al hacer clic o al duplicar).
   * Da las ids ahora, como `pegar`.
   */
  pegado(recorte: Recorte, dx: number, dy: number): PegadoEtiquetado {
    const cambios = etiquetarLote(this.usadas, recorte.componentes);
    const r = cambios.size === 0 ? recorte : conEtiquetas(recorte, cambios);
    return { comando: pegar(this.doc, r, dx, dy, this.hoja), cambios };
  }

  /** "Etiquetar los vacíos": un CambiarEtiquetas con los titulares vacíos, o null si no hay ninguno. */
  vacios(): CambiarEtiquetas | null {
    const h = this.doc.hojas[this.hoja];
    if (!h) return null;
    const cambios = etiquetarVacios(h);
    return cambios.size === 0 ? null : new CambiarEtiquetas(cambios);
  }

  /**
   * Ponerle `etiqueta` al componente `id`: si es una bobina y se cumplen las
   * cuatro condiciones, sus contactos la siguen (`planRenombrarBobina`). Un
   * solo CambiarEtiquetas. Tira si el componente no está en la hoja.
   */
  renombrar(id: string, etiqueta: string): Renombrado {
    const h = this.doc.hojas[this.hoja];
    if (!h) throw new Error(`No existe el componente "${id}".`);
    const plan = planRenombrarBobina(h, id, etiqueta);
    return { comando: plan.cambios.size === 0 ? null : new CambiarEtiquetas(plan.cambios), plan };
  }
}
