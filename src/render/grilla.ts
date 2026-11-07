// Grilla de puntos que se adapta al zoom. Es solo de pantalla (no va al PDF),
// por eso se dibuja directo sobre el contexto, en píxeles físicos y redondeada,
// para que cada punto quede nítido.
//
// Dibuja un área cualquiera (un mosaico o la pantalla entera) con los puntos
// siempre en el mismo píxel "global": el punto (x, y) de la grilla cae en el
// píxel (round(x·k), round(y·k)) del nivel de zoom k. Así dos áreas vecinas
// coinciden punto por punto, sin costuras.
//
// Rendimiento: todas las filas tienen los puntos en las mismas columnas, así
// que se dibuja una sola fila (una "tira") y se copia una vez por fila. Con
// 20 000 puntos en pantalla son ~100 copias en vez de rasterizar un trazado de
// 20 000 cuadraditos (unas 7 veces más rápido por software). Y como todos los
// mosaicos de una misma columna comparten las tiras, se arman una vez por
// columna y nivel de zoom, no una vez por mosaico.

/** Distancia mínima en píxeles CSS entre puntos; si es menor, se ralean. */
export const SEPARACION_MINIMA = 10;

/** Cada cuántos pasos hay un punto mayor (y factor entre un nivel y el siguiente). */
export const PASOS_POR_MAYOR = 5;

/**
 * Paso de la grilla en unidades (1, 5, 25…) para una escala en px por unidad:
 * el más chico cuyos puntos queden al menos a SEPARACION_MINIMA píxeles.
 */
export function pasoGrilla(escala: number): number {
  let paso = 1;
  while (paso * escala < SEPARACION_MINIMA) paso *= PASOS_POR_MAYOR;
  return paso;
}

export interface ColoresGrilla {
  punto: string;
  mayor: string;
}

/** Las dos tiras de una columna: fila común y fila con puntos mayores. */
interface Tiras {
  menor: CanvasRenderingContext2D;
  mayor: CanvasRenderingContext2D;
}

export class Grilla {
  /** Tiras ya armadas, por columna (x0): todas las áreas de una columna tienen los puntos en las mismas x. */
  private readonly columnas = new Map<number, Tiras>();
  /** Tiras sin usar, para reusar sus canvas. */
  private readonly libres: Tiras[] = [];
  /** Nivel, tamaño y colores con que se armaron las tiras guardadas. */
  private firma = "";

  /**
   * `crearContexto(true)` debe dar un canvas transparente: las tiras se
   * copian encima del fondo. Se guardan las tiras de hasta `maxColumnas`
   * columnas: para mosaicos conviene guardar varias; para la pantalla, que
   * cambia de lugar en cada cuadro, una.
   */
  constructor(
    private readonly crearContexto: (transparente: boolean) => CanvasRenderingContext2D,
    private readonly maxColumnas = 1,
  ) {}

  /**
   * Dibuja los puntos que caen en un área de `ancho`×`alto` px físicos cuya
   * esquina superior izquierda es el píxel global (x0, y0) del nivel `k` (px
   * físicos por unidad). Dibuja en `ctx` desde su (0, 0), sin importar su
   * transformación. `dpr` es el devicePixelRatio.
   */
  dibujar(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    ancho: number,
    alto: number,
    k: number,
    dpr: number,
    colores: ColoresGrilla,
  ): void {
    const paso = pasoGrilla(k / dpr);
    const mayor = paso * PASOS_POR_MAYOR;
    const tamMayor = Math.max(2, Math.round(2 * dpr));
    const tiras = this.tiras(x0, ancho, k, dpr, colores);
    // Filas cuyo cuadradito toca el área (con el margen de medio punto mayor).
    const gy0 = Math.floor((y0 - tamMayor) / k / paso) * paso;
    const gy1 = (y0 + alto + tamMayor) / k;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let gy = gy0; gy <= gy1; gy += paso) {
      const py = Math.round(gy * k) - y0;
      const tira = gy % mayor === 0 ? tiras.mayor : tiras.menor;
      ctx.drawImage(tira.canvas, 0, py - (tamMayor >> 1));
    }
    ctx.restore();
  }

  /**
   * Las tiras de la columna x0: del ancho del área y del alto de un punto
   * mayor, con el punto menor centrado en esa altura.
   */
  private tiras(x0: number, ancho: number, k: number, dpr: number, colores: ColoresGrilla): Tiras {
    const firma = `${k}|${dpr}|${ancho}|${colores.punto}|${colores.mayor}`;
    if (firma !== this.firma) {
      for (const t of this.columnas.values()) this.libres.push(t);
      this.columnas.clear();
      this.firma = firma;
    }
    const guardadas = this.columnas.get(x0);
    if (guardadas) return guardadas;

    let t = this.libres.pop();
    if (!t && this.columnas.size >= this.maxColumnas) {
      // La columna guardada hace más tiempo (los Map recuerdan el orden).
      const [vieja, tiras] = this.columnas.entries().next().value!;
      this.columnas.delete(vieja);
      t = tiras;
    }
    t ??= { menor: this.crearContexto(true), mayor: this.crearContexto(true) };

    const paso = pasoGrilla(k / dpr);
    const mayor = paso * PASOS_POR_MAYOR;
    const tam = Math.max(1, Math.round(dpr));
    const tamMayor = Math.max(2, Math.round(2 * dpr));
    for (const c of [t.menor, t.mayor]) {
      if (c.canvas.width !== ancho || c.canvas.height !== tamMayor) {
        c.canvas.width = ancho;
        c.canvas.height = tamMayor;
      } else {
        c.clearRect(0, 0, ancho, tamMayor);
      }
    }
    // Puntos cuyo cuadradito toca el área.
    const gx0 = Math.floor((x0 - tamMayor) / k / paso) * paso;
    const gx1 = (x0 + ancho + tamMayor) / k;
    const dy = (tamMayor >> 1) - (tam >> 1);
    const menores = new Path2D();
    const menoresDeFilaMayor = new Path2D();
    const mayores = new Path2D();
    for (let gx = gx0; gx <= gx1; gx += paso) {
      const px = Math.round(gx * k) - x0;
      menores.rect(px - (tam >> 1), dy, tam, tam);
      if (gx % mayor === 0) mayores.rect(px - (tamMayor >> 1), 0, tamMayor, tamMayor);
      else menoresDeFilaMayor.rect(px - (tam >> 1), dy, tam, tam);
    }
    t.menor.fillStyle = colores.punto;
    t.menor.fill(menores);
    t.mayor.fillStyle = colores.punto;
    t.mayor.fill(menoresDeFilaMayor);
    t.mayor.fillStyle = colores.mayor;
    t.mayor.fill(mayores);
    this.columnas.set(x0, t);
    return t;
  }
}
