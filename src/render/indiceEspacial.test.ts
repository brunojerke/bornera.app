import { describe, expect, it } from "vitest";
import { azar } from "./banco";
import type { Caja } from "./camara";
import { IndiceEspacial, TAM_CELDA } from "./indiceEspacial";

/** Búsqueda lineal de referencia, con el mismo contacto inclusivo que el recorte de Escena. */
function lineal(cajas: (Caja | null)[], q: Caja): number[] {
  const r: number[] = [];
  cajas.forEach((k, n) => {
    if (k && k.x <= q.x + q.ancho && k.x + k.ancho >= q.x && k.y <= q.y + q.alto && k.y + k.alto >= q.y) r.push(n);
  });
  return r;
}

/** Cajas al azar como las de un esquema: 2–10 unidades, en una hoja de ±400, a veces sobre bordes de celda. */
function cajasAlAzar(cantidad: number, semilla: number): Caja[] {
  const rnd = azar(semilla);
  return Array.from({ length: cantidad }, () => {
    const enBorde = rnd() < 0.2;
    const x = enBorde ? Math.round(rnd() * 50 - 25) * TAM_CELDA : rnd() * 800 - 400;
    const y = enBorde ? Math.round(rnd() * 50 - 25) * TAM_CELDA : rnd() * 800 - 400;
    return { x, y, ancho: 2 + rnd() * 8, alto: 2 + rnd() * 8 };
  });
}

describe("IndiceEspacial", () => {
  it("con 2000 cajas, enCaja da lo mismo que la búsqueda lineal", () => {
    const cajas = cajasAlAzar(2000, 3);
    const indice = new IndiceEspacial();
    cajas.forEach((k, n) => indice.insertar(n, k));
    expect(indice.cantidad).toBe(2000);

    const rnd = azar(9);
    for (let i = 0; i < 300; i++) {
      // Consultas chicas (un mosaico al 100 %), medianas y enormes (toda la hoja).
      const lado = [12.8, 41, 300, 2000][i % 4]!;
      const q = { x: rnd() * 900 - 450 - lado / 2, y: rnd() * 900 - 450 - lado / 2, ancho: lado, alto: lado * 0.6 };
      expect(indice.enCaja(q)).toEqual(lineal(cajas, q));
      expect(indice.contar(q)).toBe(lineal(cajas, q).length);
    }
    // Una consulta justo sobre un borde de celda y de caja.
    const b = cajas.find((k) => k.x % TAM_CELDA === 0)!;
    const q = { x: b.x - 5, y: b.y, ancho: 5, alto: 1 };
    expect(indice.enCaja(q)).toEqual(lineal(cajas, q));
    expect(indice.enCaja(q)).toContain(cajas.indexOf(b));
  });

  it("con 2000 cajas, enPunto da lo mismo que la búsqueda lineal, bordes incluidos", () => {
    const cajas = cajasAlAzar(2000, 5);
    const indice = new IndiceEspacial();
    cajas.forEach((k, n) => indice.insertar(n, k));
    const rnd = azar(11);
    for (let i = 0; i < 500; i++) {
      const x = rnd() * 900 - 450;
      const y = rnd() * 900 - 450;
      expect(indice.enPunto(x, y)).toEqual(lineal(cajas, { x, y, ancho: 0, alto: 0 }));
    }
    for (const k of cajas.slice(0, 200)) {
      // Las cuatro esquinas de cada caja la encuentran.
      for (const [x, y] of [
        [k.x, k.y],
        [k.x + k.ancho, k.y],
        [k.x, k.y + k.alto],
        [k.x + k.ancho, k.y + k.alto],
      ] as const) {
        expect(indice.enPunto(x, y)).toContain(cajas.indexOf(k));
      }
    }
  });

  it("mover cambia la caja: en la posición vieja ya no aparece", () => {
    const indice = new IndiceEspacial();
    indice.insertar(0, { x: 0, y: 0, ancho: 4, alto: 4 });
    indice.insertar(1, { x: 100, y: 0, ancho: 4, alto: 4 });
    indice.mover(0, { x: 50, y: 50, ancho: 4, alto: 4 });
    expect(indice.enPunto(2, 2)).toEqual([]);
    expect(indice.enPunto(52, 52)).toEqual([0]);
    expect(indice.cantidad).toBe(2);
  });

  it("una caja que cruza varias celdas aparece una sola vez", () => {
    const indice = new IndiceEspacial();
    indice.insertar(7, { x: -20, y: -20, ancho: 60, alto: 60 }); // 5 × 5 celdas
    indice.insertar(8, { x: 1000, y: 1000, ancho: 1, alto: 1 });
    // 3 × 3 celdas, menos que las 26 ocupadas: se resuelve por celdas, no barriendo.
    expect(indice.enCaja({ x: -10, y: -10, ancho: 30, alto: 30 })).toEqual([7]);
    // Toda la hoja: se resuelve barriendo.
    expect(indice.enCaja({ x: -30, y: -30, ancho: 80, alto: 80 })).toEqual([7]);
  });

  it("quitar lo saca de todas sus celdas, y el lugar se puede reusar", () => {
    const indice = new IndiceEspacial();
    indice.insertar(0, { x: -20, y: -20, ancho: 60, alto: 60 });
    indice.insertar(1, { x: 0, y: 0, ancho: 2, alto: 2 });
    indice.quitar(0);
    expect(indice.esta(0)).toBe(false);
    expect(indice.enCaja({ x: -100, y: -100, ancho: 200, alto: 200 })).toEqual([1]);
    indice.quitar(0); // dos veces no rompe nada
    expect(indice.cantidad).toBe(1);
    indice.insertar(0, { x: 30, y: 30, ancho: 1, alto: 1 });
    expect(indice.enPunto(30.5, 30.5)).toEqual([0]);
    expect(indice.enPunto(1, 1)).toEqual([1]);
  });

  it("reusa el arreglo de salida si se lo pasan", () => {
    const indice = new IndiceEspacial();
    indice.insertar(0, { x: 0, y: 0, ancho: 1, alto: 1 });
    const salida = [99, 98, 97];
    expect(indice.enCaja({ x: 0, y: 0, ancho: 1, alto: 1 }, salida)).toBe(salida);
    expect(salida).toEqual([0]);
  });

  it("vaciar saca todo", () => {
    const indice = new IndiceEspacial();
    for (let n = 0; n < 50; n++) indice.insertar(n, { x: n * 3, y: 0, ancho: 2, alto: 2 });
    indice.vaciar();
    expect(indice.cantidad).toBe(0);
    expect(indice.enCaja({ x: -1e9, y: -1e9, ancho: 2e9, alto: 2e9 })).toEqual([]);
  });
});
