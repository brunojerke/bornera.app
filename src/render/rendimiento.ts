// Medidor de rendimiento para el contador de F3: cuadros por segundo y tiempo
// de dibujado. Como no hay bucle constante, los FPS son los
// cuadros que se dibujaron en el último segundo: con el programa quieto, 0.
// Sin dependencias del DOM: el tiempo lo pasa quien llama.

/** Ventana de tiempo que se promedia, en ms. */
export const VENTANA_MS = 1000;

export interface MedidaCuadro {
  /** Tiempo de CPU del cuadro completo, en ms (incluye los mosaicos que se rehicieron). */
  total: number;
  /** Mosaicos de la capa estática que se rehicieron en este cuadro (0: solo se copiaron). */
  mosaicos: number;
  /** Tiempo de rehacer esos mosaicos (o la capa estática entera, sin caché), en ms. */
  estatica: number;
  /** Quedan mosaicos por rehacer: hace falta otro cuadro enseguida. */
  pendiente: boolean;
  /** Componentes que tocan la pantalla. */
  dibujados: number;
  /** Componentes en la escena. */
  componentes: number;
}

export interface Resumen {
  /** Cuadros dibujados en el último segundo. */
  fps: number;
  /** Tiempo del último cuadro, en ms. */
  ultimo: number;
  /** Promedio y máximo del último segundo, en ms (0 si no hubo cuadros). */
  promedio: number;
  maximo: number;
  /** Último tiempo de rehacer mosaicos (o la capa estática entera) en un cuadro, en ms. */
  estatica: number;
  /** Mosaicos rehechos en el último segundo. */
  mosaicos: number;
  dibujados: number;
  componentes: number;
}

interface Registro {
  t: number;
  medida: MedidaCuadro;
}

const MEDIDA_VACIA: MedidaCuadro = {
  total: 0,
  mosaicos: 0,
  estatica: 0,
  pendiente: false,
  dibujados: 0,
  componentes: 0,
};

export class MedidorRendimiento {
  private registros: Registro[] = [];
  private ultima: MedidaCuadro = MEDIDA_VACIA;
  private ultimaEstatica = 0;

  /** Anota un cuadro dibujado en el instante `t` (ms). */
  registrar(t: number, medida: MedidaCuadro): void {
    this.registros.push({ t, medida });
    this.ultima = medida;
    if (medida.estatica > 0) this.ultimaEstatica = medida.estatica;
    this.descartarViejos(t);
  }

  /** Resumen del último segundo, visto desde el instante `t` (ms). */
  resumen(t: number): Resumen {
    this.descartarViejos(t);
    const r = this.registros;
    let suma = 0;
    let maximo = 0;
    let mosaicos = 0;
    for (const { medida } of r) {
      suma += medida.total;
      if (medida.total > maximo) maximo = medida.total;
      mosaicos += medida.mosaicos;
    }
    return {
      fps: r.length,
      ultimo: this.ultima.total,
      promedio: r.length ? suma / r.length : 0,
      maximo,
      estatica: this.ultimaEstatica,
      mosaicos,
      dibujados: this.ultima.dibujados,
      componentes: this.ultima.componentes,
    };
  }

  private descartarViejos(t: number): void {
    descartarHasta(this.registros, (x) => x.t <= t - VENTANA_MS);
  }
}

/** Saca del principio de la lista (ordenada por tiempo) los que cumplen `viejo`. */
function descartarHasta<T>(lista: T[], viejo: (x: T) => boolean): void {
  let i = 0;
  while (i < lista.length && viejo(lista[i]!)) i++;
  if (i > 0) lista.splice(0, i);
}
