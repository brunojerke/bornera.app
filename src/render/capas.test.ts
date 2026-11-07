import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Camara } from "./camara";
import { Capas, MARGEN_CACHE, OPCIONES_SIN_OPTIMIZAR } from "./capas";
import type { Contenido, InfoDibujo } from "./escena";

/** Contexto 2D falso con su canvas: anota los métodos llamados. */
function contextoFalso(ancho = 0, alto = 0) {
  const llamadas: unknown[][] = [];
  const canvas = { width: ancho, height: alto };
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (_, nombre) => (nombre === "canvas" ? canvas : (...args: unknown[]) => llamadas.push([nombre, ...args])),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, canvas, llamadas };
}

/** Contenido falso: anota con qué info lo dibujaron. */
function contenidoFalso(): Contenido & { infos: InfoDibujo[] } {
  const infos: InfoDibujo[] = [];
  return {
    caja: null,
    cantidad: 3,
    infos,
    dibujar: (_, info) => (infos.push(info), 3),
  };
}

const W = 800;
const H = 600;

function armar() {
  const principal = contextoFalso(W, H);
  // Fuera de pantalla: el caché (opaco) y las tiras de la grilla (transparentes).
  const cache = contextoFalso();
  const transparentes: ReturnType<typeof contextoFalso>[] = [];
  const capas = new Capas(principal.ctx, (transparente) => {
    if (!transparente) return cache.ctx;
    const t = contextoFalso();
    transparentes.push(t);
    return t.ctx;
  });
  const contenido = contenidoFalso();
  capas.contenido = contenido;
  const camara = new Camara();
  const dibujar = () => capas.dibujar(camara, W, H, 1);
  return { principal, cache, transparentes, capas, contenido, camara, dibujar };
}

/** El último drawImage del caché en la pantalla: [x, y]. */
function ultimaCopia(llamadas: unknown[][]): [number, number] {
  const l = llamadas.filter((x) => x[0] === "drawImage").at(-1)!;
  return [l[2] as number, l[3] as number];
}

class Path2DFalso {
  rect() {}
  moveTo() {}
  lineTo() {}
  arc() {}
}

describe("Capas", () => {
  beforeEach(() => vi.stubGlobal("Path2D", Path2DFalso));
  afterEach(() => vi.unstubAllGlobals());

  it("el primer cuadro arma la capa estática con margen; los siguientes la reusan", () => {
    const { cache, contenido, dibujar } = armar();
    const m1 = dibujar();
    expect(m1.reconstruida).toBe(true);
    expect(m1.dibujados).toBe(3);
    expect(m1.componentes).toBe(3);
    expect(cache.canvas).toEqual({ width: W * (1 + 2 * MARGEN_CACHE), height: H * (1 + 2 * MARGEN_CACHE) });
    expect(dibujar().reconstruida).toBe(false);
    expect(contenido.infos).toHaveLength(1);
  });

  it("desplazar dentro del margen solo corre la imagen, a píxeles enteros", () => {
    const { principal, camara, dibujar } = armar();
    dibujar();
    const [x0, y0] = ultimaCopia(principal.llamadas);
    expect([x0, y0]).toEqual([-W * MARGEN_CACHE, -H * MARGEN_CACHE]);

    camara.desplazar(30.4, -12.6);
    const m = dibujar();
    expect(m.reconstruida).toBe(false);
    expect(ultimaCopia(principal.llamadas)).toEqual([x0 + 30, y0 - 13]);
  });

  it("al salir del margen o cambiar el zoom, la rehace", () => {
    const { camara, dibujar } = armar();
    dibujar();
    camara.desplazar(W * MARGEN_CACHE + 1, 0);
    expect(dibujar().reconstruida).toBe(true);
    expect(dibujar().reconstruida).toBe(false);
    camara.zoomEn(2, 100, 100);
    expect(dibujar().reconstruida).toBe(true);
  });

  it("invalidarEstatica (contenido o colores nuevos) la rehace", () => {
    const { capas, dibujar } = armar();
    dibujar();
    capas.invalidarEstatica();
    expect(dibujar().reconstruida).toBe(true);
  });

  it("recorta a la parte visible del caché y baja el detalle con zoom alejado", () => {
    const { camara, contenido, dibujar } = armar();
    dibujar();
    const v = contenido.infos[0]!.visible;
    // Al 100 % (20 px por unidad): pantalla + margen, en unidades.
    expect(v.ancho).toBeCloseTo((W * (1 + 2 * MARGEN_CACHE)) / 20);
    expect(v.x).toBeCloseTo(camara.x - (W * MARGEN_CACHE) / 20);
    expect(contenido.infos[0]!.detalle).toEqual({ textos: true, bornes: true });

    camara.zoomEn(0.1, 0, 0);
    dibujar();
    expect(contenido.infos[1]!.detalle).toEqual({ textos: false, bornes: false });
  });

  it("la capa dinámica queda alineada con la estática copiada", () => {
    const { capas, principal, camara, dibujar } = armar();
    capas.dinamico = () => {};
    dibujar();
    camara.desplazar(17.3, 4.8);
    dibujar();
    const t = principal.llamadas.filter((l) => l[0] === "setTransform").at(-1)!;
    const k = camara.escala;
    // Un punto de la grilla cae donde debería, con menos de medio píxel de error.
    const g = 12.34;
    expect(Math.abs((t[5] as number) + g * k - (g - camara.x) * k)).toBeLessThanOrEqual(0.5);
  });

  it("sin optimizar: dibuja todo, directo en pantalla, en cada cuadro", () => {
    const { capas, principal, cache, contenido, camara, dibujar } = armar();
    capas.opciones = { ...OPCIONES_SIN_OPTIMIZAR };
    camara.zoomEn(0.1, 0, 0);
    expect(dibujar().reconstruida).toBe(true);
    expect(dibujar().reconstruida).toBe(true);
    // Copia las tiras de la grilla, pero nunca el caché.
    expect(principal.llamadas.some((l) => l[0] === "drawImage" && l[1] === cache.canvas)).toBe(false);
    expect(contenido.infos[0]!.visible.ancho).toBeGreaterThan(1e6);
    expect(contenido.infos[0]!.detalle).toEqual({ textos: true, bornes: true });
    expect(capas.memoriaCache).toBe(0);
  });

  it("la grilla copia una tira transparente por fila en vez de un punto por vez", () => {
    const { cache, transparentes, dibujar } = armar();
    dibujar();
    expect(transparentes).toHaveLength(2);
    // Al 100 %: un punto cada 20 px, una copia por fila del caché.
    const filas = cache.llamadas.filter((l) => l[0] === "drawImage").length;
    expect(filas).toBeGreaterThanOrEqual(Math.floor((H * (1 + 2 * MARGEN_CACHE)) / 20));
    expect(filas).toBeLessThanOrEqual(Math.ceil((H * (1 + 2 * MARGEN_CACHE)) / 20) + 1);
    expect(transparentes[0]!.canvas.width).toBe(cache.canvas.width);
  });

  it("no dibuja nada si el lienzo no tiene tamaño", () => {
    const { capas, contenido, camara } = armar();
    expect(capas.dibujar(camara, 0, 0, 1).reconstruida).toBe(false);
    expect(contenido.infos).toHaveLength(0);
  });
});
