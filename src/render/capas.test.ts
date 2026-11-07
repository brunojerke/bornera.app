import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Camara } from "./camara";
import { Capas, ESPERA_ZOOM_MS, MARGEN_PX, OPCIONES_OPTIMIZADAS, OPCIONES_SIN_OPTIMIZAR, PRESUPUESTO_MS } from "./capas";
import type { Contenido, InfoDibujo } from "./escena";
import { contextoFalso, fabricaFalsa, llamadasA, Path2DFalso } from "./falsos";
import { BYTES_MOSAICO, RESERVA_LIBRES, TAM_MOSAICO } from "./mosaicos";
import type { Renderer } from "./renderer";

const T = TAM_MOSAICO;
/** Pantalla de 800×600 px con dpr 1. Al 100 % (k = 20), la esquina en (0, 0). */
const W = 800;
const H = 600;
const K = 20;
/** Mosaicos visibles: columnas 0..3 y filas 0..2. Con el margen: columnas −1..3, filas −1..2. */
const VISIBLES = 4 * 3;
const CON_MARGEN = 5 * 4;

/** Contenido falso: anota con qué info lo dibujaron y "tarda" lo que diga `alDibujar`. */
function contenidoFalso(alDibujar: (r: Renderer) => void): Contenido & { infos: InfoDibujo[] } {
  const infos: InfoDibujo[] = [];
  return {
    caja: null,
    cantidad: 3,
    infos,
    dibujar: (r, info) => {
      infos.push(info);
      alDibujar(r);
      return 3;
    },
    contar: () => 2,
  };
}

/**
 * Capas con contextos falsos y un reloj falso: cada mosaico "tarda" `costo`
 * ms (lo que avanza el reloj mientras se dibuja el contenido).
 */
function armar(costo = 0, alDibujar: (r: Renderer) => void = () => {}, costoCopia = 0) {
  let ahora = 1000;
  // Cada copia a la pantalla "tarda" costoCopia ms.
  const principal = contextoFalso(W, H, (nombre) => {
    if (nombre === "drawImage") ahora += costoCopia;
  });
  const fabrica = fabricaFalsa();
  const capas = new Capas(principal.ctx, fabrica.crear, () => ahora);
  const contenido = contenidoFalso((r) => {
    ahora += costo;
    alDibujar(r);
  });
  capas.contenido = contenido;
  const camara = new Camara();
  const dibujar = () => capas.dibujar(camara, W, H, 1, ahora);
  const avanzar = (ms: number) => void (ahora += ms);
  /** Dibuja cuadros (uno cada 16 ms) hasta que no quede nada pendiente; devuelve cuántos. */
  const terminar = () => {
    let n = 0;
    for (let m = dibujar(); m.pendiente || m.esperar > 0; n++) {
      avanzar(m.pendiente ? 16 : m.esperar);
      m = dibujar();
      if (n > 1000) throw new Error("no termina nunca");
    }
    return n;
  };
  /** Mosaicos de la capa estática (los canvas opacos fuera de pantalla). */
  const mosaicos = () => fabrica.opacos;
  return { principal, fabrica, capas, contenido, camara, dibujar, avanzar, terminar, mosaicos };
}

/** Mosaicos que cubren la pantalla (con esquina en el píxel global ox, oy) y su margen. */
function necesarios(ox: number, oy: number): number {
  const n = (o: number, lado: number) => Math.floor((o + lado - 1 + MARGEN_PX) / T) - Math.floor((o - MARGEN_PX) / T) + 1;
  return n(ox, W) * n(oy, H);
}

/** Copias a la pantalla: [canvas, x, y] (a escala 1) o [canvas, x, y, ancho, alto] (escaladas). */
function copias(llamadas: unknown[][]) {
  return llamadasA(llamadas, "drawImage") as [unknown, number, number, number?, number?][];
}

describe("Capas: mosaicos", () => {
  beforeEach(() => vi.stubGlobal("Path2D", Path2DFalso));
  afterEach(() => vi.unstubAllGlobals());

  it("rehace los mosaicos de a poco, sin pasarse del presupuesto, los visibles primero", () => {
    const costo = 3;
    const { contenido, dibujar, avanzar } = armar(costo);
    let cuadros = 0;
    let total = 0;
    for (let m = dibujar(); ; m = dibujar()) {
      cuadros++;
      total += m.mosaicos;
      expect(m.mosaicos).toBeGreaterThanOrEqual(1);
      // Se corta antes de pasarse; como mucho, por lo que tarda un mosaico.
      expect(m.estatica).toBeLessThanOrEqual(PRESUPUESTO_MS + costo);
      if (!m.pendiente) break;
      avanzar(16);
    }
    expect(total).toBe(CON_MARGEN);
    expect(cuadros).toBeGreaterThanOrEqual(Math.ceil((CON_MARGEN * costo) / (PRESUPUESTO_MS + costo)));

    // Los primeros en hacerse son los visibles (0..3 × 0..2).
    const orden = contenido.infos.map((i) => [Math.round((i.visible.x * K) / T), Math.round((i.visible.y * K) / T)]);
    for (const [i, j] of orden.slice(0, VISIBLES)) expect(i! >= 0 && i! <= 3 && j! >= 0 && j! <= 2).toBe(true);
    for (const [i, j] of orden.slice(VISIBLES)) expect(i === -1 || j === -1).toBe(true);

    // Con todo hecho, el cuadro siguiente solo copia.
    const m = dibujar();
    expect(m.mosaicos).toBe(0);
    expect(m.pendiente).toBe(false);
  });

  it("cada mosaico cubre su parte de la grilla", () => {
    const { contenido, terminar, mosaicos } = armar();
    terminar();
    for (const info of contenido.infos) {
      expect(info.visible.ancho).toBeCloseTo(T / K);
      expect(info.visible.alto).toBeCloseTo(T / K);
      expect(info.detalle).toEqual({ textos: true, bornes: true });
    }
    for (const m of mosaicos()) expect(m.canvas).toEqual({ width: T, height: T });
  });

  it("desplazar dentro de lo dibujado solo copia mosaicos, a píxel entero", () => {
    const { principal, camara, dibujar, terminar, mosaicos } = armar();
    terminar();
    principal.llamadas.length = 0;
    camara.desplazar(-30.4, 12.6);
    const m = dibujar();
    expect(m.mosaicos).toBe(0);
    const c = copias(principal.llamadas);
    expect(c).toHaveLength(4 * 4); // la pantalla corrida (30, −13) toca 4 × 4 mosaicos
    for (const [, x, y, ancho] of c) {
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
      expect(ancho).toBeUndefined(); // sin escalar
    }
    // Cada mosaico cae donde la cámara dice, redondeado: a un múltiplo de T
    // de la esquina de la pantalla en px globales.
    const ox = Math.round(camara.x * K);
    const oy = Math.round(camara.y * K);
    for (const [, x, y] of c) {
      expect((((x + ox) % T) + T) % T).toBe(0);
      expect((((y + oy) % T) + T) % T).toBe(0);
    }
    expect(new Set(c.map(([canvas]) => canvas)).size).toBe(c.length);
    expect(mosaicos().length).toBe(CON_MARGEN);
  });

  it("al desplazar, rehace solo los mosaicos que aparecen", () => {
    const { contenido, camara, dibujar, terminar } = armar();
    terminar();
    contenido.infos.length = 0;
    camara.desplazar(-300, 0); // la pantalla ahora empieza en x = 300 px
    const m = dibujar();
    // Con el margen, aparece la columna 4 (1227 + 128 px > 4 · 256).
    expect(Math.floor((300 + W - 1 + MARGEN_PX) / T)).toBe(4);
    expect(m.mosaicos).toBe(4);
    expect(contenido.infos.every((i) => Math.round((i.visible.x * K) / T) === 4)).toBe(true);
  });

  it("durante el zoom no rehace nada: escala lo que hay, y lo rehace nítido al detenerse", () => {
    const { principal, camara, dibujar, avanzar, terminar } = armar();
    terminar();
    principal.llamadas.length = 0;

    camara.zoomEn(2, W / 2, H / 2);
    let m = dibujar();
    expect(m.mosaicos).toBe(0);
    expect(m.esperar).toBe(ESPERA_ZOOM_MS);
    // Los mosaicos de antes, al doble de tamaño.
    const escaladas = copias(principal.llamadas).filter((c) => c[3] !== undefined);
    expect(escaladas.length).toBeGreaterThan(0);
    for (const [, , , ancho, alto] of escaladas) {
      expect(Math.abs(ancho! - 2 * T)).toBeLessThanOrEqual(1);
      expect(Math.abs(alto! - 2 * T)).toBeLessThanOrEqual(1);
    }

    // Otro paso de rueda reinicia la espera.
    avanzar(100);
    camara.zoomEn(2.5, W / 2, H / 2);
    expect(dibujar().esperar).toBe(ESPERA_ZOOM_MS);
    avanzar(100);
    m = dibujar();
    expect(m.mosaicos).toBe(0);
    expect(m.esperar).toBe(ESPERA_ZOOM_MS - 100);

    // Pasada la espera, se rehace con el zoom nuevo.
    avanzar(ESPERA_ZOOM_MS - 100);
    m = dibujar();
    expect(m.mosaicos).toBeGreaterThan(0);
    expect(m.esperar).toBe(0);
  });

  it("si no hay nada que escalar, no espera aunque el zoom cambie", () => {
    const { capas, camara, dibujar, terminar } = armar();
    terminar();
    camara.zoomEn(2, 0, 0);
    capas.invalidarEstatica();
    const m = dibujar();
    expect(m.esperar).toBe(0);
    expect(m.mosaicos).toBeGreaterThan(0);
  });

  it("donde falta un mosaico se ve la grilla y, encima, el nivel anterior escalado", () => {
    const { principal, fabrica, camara, dibujar, avanzar, terminar } = armar(10);
    terminar();
    camara.zoomEn(2, W / 2, H / 2);
    dibujar();
    avanzar(ESPERA_ZOOM_MS);
    principal.llamadas.length = 0;
    const m = dibujar();
    expect(m.mosaicos).toBe(1); // tarda 10 ms: uno por cuadro
    expect(m.pendiente).toBe(true);

    const l = principal.llamadas.map((x) => x[0]);
    const clip = l.indexOf("clip");
    expect(clip).toBeGreaterThan(-1);
    // Recortado a los que faltan: fondo, grilla (tiras transparentes) y los viejos escalados.
    const despues = principal.llamadas.slice(clip);
    expect(despues.some((x) => x[0] === "fillRect")).toBe(true);
    const tiras = new Set(fabrica.transparentes.map((t) => t.canvas));
    expect(copias(despues).some(([c]) => tiras.has(c as never))).toBe(true);
    expect(copias(despues).some((c) => c[3] !== undefined)).toBe(true);
    // El que ya está, nítido: a escala 1.
    expect(copias(principal.llamadas).filter((c) => c[3] === undefined && !tiras.has(c[0] as never))).toHaveLength(1);
  });

  it("si componer la pantalla tarda, rehace menos mosaicos por cuadro", () => {
    const porCuadro = (costoCopia: number) => {
      const { capas, dibujar, avanzar, terminar } = armar(2, () => {}, costoCopia);
      terminar();
      // Varios cuadros para que el promedio de la composición se asiente.
      const hechos: number[] = [];
      for (let i = 0; i < 6; i++) {
        capas.invalidarEstatica();
        avanzar(16);
        hechos.push(dibujar().mosaicos);
      }
      return hechos.at(-1)!;
    };
    const rapido = porCuadro(0);
    const lento = porCuadro(0.5); // ~16 copias: ~8 ms solo para componer
    expect(rapido).toBeGreaterThanOrEqual(3);
    expect(lento).toBeLessThan(rapido);
    expect(lento).toBeGreaterThanOrEqual(1); // al menos uno por cuadro
  });

  it("al agrandar los mosaicos escalados no los suaviza; al achicarlos, sí", () => {
    const suavizado = (factor: number) => {
      const { principal, camara, dibujar, terminar } = armar();
      terminar();
      principal.llamadas.length = 0;
      camara.zoomEn(factor, W / 2, H / 2);
      dibujar();
      const valores = principal.llamadas.filter((l) => l[0] === "=imageSmoothingEnabled").map((l) => l[1]);
      expect(valores.at(-1)).toBe(true); // queda como estaba
      return valores.slice(0, -1);
    };
    const alAgrandar = suavizado(2);
    expect(alAgrandar.length).toBeGreaterThan(0);
    expect(alAgrandar.every((v) => v === false)).toBe(true);
    expect(suavizado(0.5).every((v) => v === true)).toBe(true);
  });

  it("cuando el nivel nuevo cubre la pantalla, suelta los mosaicos viejos", () => {
    const { capas, camara, dibujar, avanzar, terminar } = armar();
    terminar();
    camara.zoomEn(2, W / 2, H / 2);
    dibujar();
    avanzar(ESPERA_ZOOM_MS);
    terminar();
    // Solo quedan los del nivel nuevo (y unos pocos canvas para reusar).
    const k = 2 * K;
    const nuevos = necesarios(Math.round(camara.x * k), Math.round(camara.y * k));
    expect(capas.memoriaCache).toBe((nuevos + RESERVA_LIBRES) * BYTES_MOSAICO);
  });

  it("invalidarEstatica rehace todo, mostrando la grilla mientras tanto", () => {
    const { principal, capas, dibujar, terminar } = armar(10);
    terminar();
    capas.invalidarEstatica();
    principal.llamadas.length = 0;
    const m = dibujar();
    expect(m.mosaicos).toBe(1);
    expect(m.pendiente).toBe(true);
    expect(principal.llamadas.some((x) => x[0] === "clip")).toBe(true);
  });

  it("la memoria tiene un tope aunque se recorra mucho", () => {
    const { capas, camara, terminar } = armar();
    for (let i = 0; i < 30; i++) {
      camara.desplazar(-700, 300);
      terminar();
    }
    // Como mucho se necesitan 6 × 5 (la pantalla y el margen, mal alineados con
    // los mosaicos); se guardan hasta un 25 % más, para volver atrás sin rehacer.
    expect(Math.max(...Array.from({ length: T }, (_, d) => necesarios(d, d)))).toBe(6 * 5);
    expect(capas.memoriaCache).toBeLessThanOrEqual(Math.ceil(6 * 5 * 1.25) * BYTES_MOSAICO);
    expect(capas.memoriaCache).toBeGreaterThanOrEqual(CON_MARGEN * BYTES_MOSAICO);
  });

  it("la capa dinámica queda alineada con los mosaicos", () => {
    const { principal, capas, camara, dibujar, terminar } = armar();
    capas.dinamico = () => {};
    terminar();
    camara.desplazar(17.3, 4.8);
    dibujar();
    const t = llamadasA(principal.llamadas, "setTransform").at(-1)!;
    expect(t.slice(0, 4)).toEqual([K, 0, 0, K]);
    expect(t[4]).toBe(-Math.round(camara.x * K));
    // Con menos de medio píxel de error respecto de la cámara.
    expect(Math.abs((t[4] as number) + camara.x * K)).toBeLessThanOrEqual(0.5);
  });

  it("dibujados cuenta los componentes que tocan la pantalla", () => {
    const { capas, dibujar } = armar();
    expect(dibujar().dibujados).toBe(2);
    expect(dibujar().componentes).toBe(3);
    capas.opciones = { ...OPCIONES_OPTIMIZADAS, recorte: false };
    expect(dibujar().dibujados).toBe(3);
  });

  it("baja el detalle con el zoom alejado", () => {
    const { contenido, camara, terminar } = armar();
    camara.zoomEn(0.1, 0, 0);
    terminar();
    expect(contenido.infos.at(-1)!.detalle).toEqual({ textos: false, bornes: false });
  });

  it("sin optimizar: dibuja todo directo en pantalla, en cada cuadro", () => {
    const { principal, capas, contenido, camara, dibujar, mosaicos } = armar();
    capas.opciones = { ...OPCIONES_SIN_OPTIMIZAR };
    camara.zoomEn(0.1, 0, 0);
    expect(dibujar().pendiente).toBe(false);
    dibujar();
    expect(contenido.infos).toHaveLength(2);
    expect(contenido.infos[0]!.visible.ancho).toBeGreaterThan(1e6);
    expect(contenido.infos[0]!.detalle).toEqual({ textos: true, bornes: true });
    expect(mosaicos()).toHaveLength(0);
    expect(capas.memoriaCache).toBe(0);
    expect(llamadasA(principal.llamadas, "clip")).toHaveLength(0);
  });

  it("no dibuja nada si el lienzo no tiene tamaño", () => {
    const { capas, contenido, camara } = armar();
    const m = capas.dibujar(camara, 0, 0, 1);
    expect(m.mosaicos).toBe(0);
    expect(m.pendiente).toBe(false);
    expect(contenido.infos).toHaveLength(0);
  });
});
