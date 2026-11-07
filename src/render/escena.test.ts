import { describe, expect, it } from "vitest";
import { SIMBOLOS, type Rotacion } from "../core/symbols";
import { ampliarCaja, seTocan, unirCajas, type Caja } from "./camara";
import { azar, CANTIDADES_BANCO, generarBanco, PASO_BANCO } from "./banco";
import { DETALLE_COMPLETO, ESCALA_MIN_TEXTOS, nivelDetalle } from "./detalle";
import { Escena, type ComponenteEscena, type InfoDibujo } from "./escena";
import type { Renderer } from "./renderer";
import { cajaDibujo, cajaSimbolo, dibujarMarcasBornes, dibujarSimbolo } from "./simbolo";

/** Renderer falso que anota cada llamada. */
function grabador(): { r: Renderer; llamadas: unknown[][] } {
  const llamadas: unknown[][] = [];
  const r = new Proxy({} as Renderer, {
    get: (_, nombre) => (...args: unknown[]) => llamadas.push([nombre, ...args]),
  });
  return { r, llamadas };
}

function contiene(c: Caja, x: number, y: number): boolean {
  return x >= c.x && x <= c.x + c.ancho && y >= c.y && y <= c.y + c.alto;
}

const COLORES = { simbolo: "#000", borne: "#f00" };

function info(visible: Caja, escala = 20, detalle = DETALLE_COMPLETO): InfoDibujo {
  return { escala, colores: COLORES, visible, detalle: { ...detalle } };
}

describe("cajas", () => {
  it("seTocan, unirCajas y ampliarCaja", () => {
    const a = { x: 0, y: 0, ancho: 2, alto: 2 };
    expect(seTocan(a, { x: 2, y: 2, ancho: 1, alto: 1 })).toBe(true); // comparten una esquina
    expect(seTocan(a, { x: 2.01, y: 0, ancho: 1, alto: 1 })).toBe(false);
    expect(seTocan(a, { x: 0, y: -5, ancho: 1, alto: 4.9 })).toBe(false);
    expect(unirCajas(a, { x: -1, y: 1, ancho: 1, alto: 5 })).toEqual({ x: -1, y: 0, ancho: 3, alto: 6 });
    expect(ampliarCaja(a, 1)).toEqual({ x: -1, y: -1, ancho: 4, alto: 4 });
  });
});

describe("cajaDibujo", () => {
  const ROTACIONES: Rotacion[] = [0, 90, 180, 270];

  it("contiene geometría, textos y marcas de bornes en cualquier posición", () => {
    for (const def of SIMBOLOS) {
      for (const rotacion of ROTACIONES) {
        for (const espejado of [false, true]) {
          const c = { x: 3, y: -7, rotacion, espejado };
          const caja = cajaDibujo(def, c, "K12");
          const s = cajaSimbolo(def, c);
          expect(seTocan(caja, s) && caja.ancho >= s.ancho && caja.alto >= s.alto).toBe(true);

          const { r, llamadas } = grabador();
          dibujarSimbolo(r, def, c, { etiqueta: "K12" });
          dibujarMarcasBornes(r, def, c);
          for (const l of llamadas) {
            if (l[0] === "texto" || l[0] === "circulo") {
              expect(contiene(caja, l[1] as number, l[2] as number), `${def.tipo} ${rotacion}° ${l}`).toBe(true);
            }
            if (l[0] === "linea") {
              expect(contiene(caja, l[3] as number, l[4] as number), `${def.tipo} ${rotacion}° ${l}`).toBe(true);
            }
          }
        }
      }
    }
  });

  it("la etiqueta larga agranda la caja hacia su lado", () => {
    const def = SIMBOLOS[0]!;
    const c = { x: 0, y: 0, rotacion: 0 as const, espejado: false };
    expect(cajaDibujo(def, c, "K1234567").x).toBeLessThan(cajaDibujo(def, c, "K1").x);
  });
});

describe("nivelDetalle", () => {
  it("omite textos y bornes con zoom muy alejado", () => {
    expect(nivelDetalle(20)).toEqual({ textos: true, bornes: true });
    expect(nivelDetalle(ESCALA_MIN_TEXTOS)).toEqual({ textos: true, bornes: true });
    expect(nivelDetalle(ESCALA_MIN_TEXTOS - 0.01).textos).toBe(false);
    expect(nivelDetalle(2)).toEqual({ textos: false, bornes: false });
  });
});

describe("Escena", () => {
  const def = SIMBOLOS[0]!;
  const componentes: ComponenteEscena[] = [0, 10, 20, 30].map((x) => ({
    def,
    x,
    y: 0,
    rotacion: 0,
    espejado: false,
    etiqueta: "S1",
  }));
  const escena = new Escena(componentes);

  it("la caja total cubre todos los componentes", () => {
    for (const c of componentes) {
      const k = cajaDibujo(def, c, c.etiqueta);
      expect(contiene(escena.caja!, k.x, k.y) && contiene(escena.caja!, k.x + k.ancho, k.y + k.alto)).toBe(true);
    }
    expect(new Escena([]).caja).toBeNull();
  });

  it("recorta: solo devuelve lo que toca la vista", () => {
    expect(escena.indicesVisibles({ x: 8, y: -1, ancho: 4, alto: 2 })).toEqual([1]);
    expect(escena.indicesVisibles({ x: 5, y: -1, ancho: 20, alto: 2 })).toEqual([1, 2]);
    expect(escena.indicesVisibles({ x: 100, y: 100, ancho: 5, alto: 5 })).toEqual([]);
    expect(escena.indicesVisibles({ x: -100, y: -100, ancho: 300, alto: 300 })).toEqual([0, 1, 2, 3]);
  });

  it("dibuja solo los visibles y devuelve cuántos", () => {
    const { r, llamadas } = grabador();
    const n = escena.dibujar(r, info({ x: 5, y: -1, ancho: 20, alto: 2 }));
    expect(n).toBe(2);
    expect(llamadas.filter((l) => l[0] === "simbolo")).toHaveLength(2);
  });

  it("sin textos ni bornes no escribe ni marca nada", () => {
    const { r, llamadas } = grabador();
    escena.dibujar(r, info({ x: -100, y: -100, ancho: 300, alto: 300 }, 2, { textos: false, bornes: false }));
    expect(llamadas.filter((l) => l[0] === "simbolo")).toHaveLength(4);
    expect(llamadas.some((l) => l[0] === "texto" || l[0] === "circulo")).toBe(false);
  });

  it("agrupa el estilo: dos cambios por cuadro, no por componente", () => {
    const { r, llamadas } = grabador();
    escena.dibujar(r, info({ x: -100, y: -100, ancho: 300, alto: 300 }));
    expect(llamadas.filter((l) => l[0] === "estilo")).toHaveLength(2);
  });
});

describe("banco de pruebas", () => {
  it("es reproducible: la misma semilla da la misma escena", () => {
    expect(generarBanco(50, 7)).toEqual(generarBanco(50, 7));
    expect(generarBanco(50, 7)).not.toEqual(generarBanco(50, 8));
    const a = azar(1);
    const b = azar(1);
    for (let i = 0; i < 10; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v >= 0 && v < 1).toBe(true);
    }
  });

  it("genera la cantidad pedida, sin repetir posición ni etiqueta, sobre la grilla", () => {
    for (const n of CANTIDADES_BANCO) {
      const lista = generarBanco(n);
      expect(lista).toHaveLength(n);
      expect(new Set(lista.map((c) => `${c.x},${c.y}`)).size).toBe(n);
      expect(new Set(lista.map((c) => c.etiqueta)).size).toBe(n);
      for (const c of lista) {
        expect(c.x % PASO_BANCO).toBe(0);
        expect(c.y % PASO_BANCO).toBe(0);
        expect(SIMBOLOS).toContain(c.def);
      }
    }
  });
});
