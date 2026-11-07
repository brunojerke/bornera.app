// Medidor de rendimiento para el contador de F3: cuadros por segundo y tiempo
// de dibujado. Como no hay bucle constante, los FPS son los cuadros que se
// dibujaron en el último segundo: con el programa quieto, 0.
// Sin dependencias del DOM: el tiempo lo pasa quien llama.

/** Ventana de tiempo que se promedia, en ms. */
export const VENTANA_MS = 1000;

export interface MedidaCuadro {
  /** Tiempo de CPU del cuadro completo, en ms (incluye la capa estática si se rehízo). */
  total: number;
  /** Se rehízo la capa estática en este cuadro (si no, se reusó la del caché). */
  reconstruida: boolean;
  /** Tiempo de rehacer la capa estática, en ms; 0 si se reusó. */
  estatica: number;
  /** Componentes dibujados en la capa estática la última vez que se rehízo. */
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
  /** Último tiempo de rehacer la capa estática, en ms. */
  estatica: number;
  /** Cuadros del último segundo que rehicieron la capa estática. */
  reconstrucciones: number;
  dibujados: number;
  componentes: number;
}

interface Registro {
  t: number;
  medida: MedidaCuadro;
}

export class MedidorRendimiento {
  private registros: Registro[] = [];
  private ultima: MedidaCuadro = { total: 0, reconstruida: false, estatica: 0, dibujados: 0, componentes: 0 };
  private ultimaEstatica = 0;

  /** Anota un cuadro dibujado en el instante `t` (ms). */
  registrar(t: number, medida: MedidaCuadro): void {
    this.registros.push({ t, medida });
    this.ultima = medida;
    if (medida.reconstruida) this.ultimaEstatica = medida.estatica;
    this.descartarViejos(t);
  }

  /** Resumen del último segundo, visto desde el instante `t` (ms). */
  resumen(t: number): Resumen {
    this.descartarViejos(t);
    const r = this.registros;
    let suma = 0;
    let maximo = 0;
    let reconstrucciones = 0;
    for (const { medida } of r) {
      suma += medida.total;
      if (medida.total > maximo) maximo = medida.total;
      if (medida.reconstruida) reconstrucciones++;
    }
    return {
      fps: r.length,
      ultimo: this.ultima.total,
      promedio: r.length ? suma / r.length : 0,
      maximo,
      estatica: this.ultimaEstatica,
      reconstrucciones,
      dibujados: this.ultima.dibujados,
      componentes: this.ultima.componentes,
    };
  }

  private descartarViejos(t: number): void {
    const limite = t - VENTANA_MS;
    let i = 0;
    while (i < this.registros.length && this.registros[i]!.t <= limite) i++;
    if (i > 0) this.registros.splice(0, i);
  }
}
