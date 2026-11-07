import { describe, expect, it } from "vitest";
import { Camara, PX_POR_UNIDAD, ZOOM_MAX, ZOOM_MIN } from "./camara";

describe("Camara", () => {
  it("convierte pantalla ↔ grilla ida y vuelta", () => {
    const c = new Camara();
    c.x = -3.5;
    c.y = 12;
    c.zoom = 1.7;
    const g = c.aGrilla(123, 456);
    const p = c.aPantalla(g.x, g.y);
    expect(p.x).toBeCloseTo(123);
    expect(p.y).toBeCloseTo(456);
  });

  it("al 100 % una unidad de grilla mide PX_POR_UNIDAD píxeles", () => {
    const c = new Camara();
    expect(c.aPantalla(1, 2)).toEqual({ x: PX_POR_UNIDAD, y: 2 * PX_POR_UNIDAD });
  });

  it("el zoom deja quieto el punto bajo el mouse", () => {
    const c = new Camara();
    c.x = 5;
    c.y = -2;
    const antes = c.aGrilla(300, 200);
    expect(c.zoomEn(2.5, 300, 200)).toBe(true);
    const despues = c.aGrilla(300, 200);
    expect(despues.x).toBeCloseTo(antes.x);
    expect(despues.y).toBeCloseTo(antes.y);
  });

  it("respeta los límites de zoom", () => {
    const c = new Camara();
    c.zoomEn(1000, 0, 0);
    expect(c.zoom).toBe(ZOOM_MAX);
    expect(c.zoomEn(2000, 0, 0)).toBe(false);
    c.zoomEn(0.0001, 0, 0);
    expect(c.zoom).toBe(ZOOM_MIN);
  });

  it("desplazar mueve el contenido junto con el mouse", () => {
    const c = new Camara();
    const antes = c.aPantalla(4, 4);
    c.desplazar(30, -10);
    const despues = c.aPantalla(4, 4);
    expect(despues.x - antes.x).toBeCloseTo(30);
    expect(despues.y - antes.y).toBeCloseTo(-10);
  });

  it("al redimensionar, lo que estaba en el centro sigue en el centro", () => {
    const c = new Camara();
    c.zoom = 1.5;
    c.centrar(0, 0, 800, 500);
    c.redimensionar(800, 500, 1920, 1080);
    expect(c.aPantalla(0, 0)).toEqual({ x: 960, y: 540 });
    expect(c.zoom).toBe(1.5);
  });

  it("encuadrar deja la caja entera y centrada", () => {
    const c = new Camara();
    const caja = { x: 10, y: 20, ancho: 40, alto: 10 };
    c.encuadrar(caja, 800, 600, 40);
    const a = c.aPantalla(caja.x, caja.y);
    const b = c.aPantalla(caja.x + caja.ancho, caja.y + caja.alto);
    expect(a.x).toBeCloseTo(40); // limita el ancho: toca el margen
    expect(b.x).toBeCloseTo(760);
    expect((a.y + b.y) / 2).toBeCloseTo(300);
    expect(a.y).toBeGreaterThanOrEqual(40);
  });

  it("encuadrar una caja sin tamaño la centra sin cambiar el zoom", () => {
    const c = new Camara();
    c.zoom = 2;
    c.encuadrar({ x: 7, y: 7, ancho: 0, alto: 0 }, 800, 600);
    expect(c.zoom).toBe(2);
    expect(c.aPantalla(7, 7)).toEqual({ x: 400, y: 300 });
  });
});
