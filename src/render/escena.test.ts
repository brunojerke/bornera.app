import { describe, expect, it } from "vitest";
import { bornesColocados, SIMBOLOS, type Rotacion } from "../core/symbols";
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

// ── Contorno de aviso (T19, opción P) ──────────────────────────────────────

describe("contorno de aviso de etiqueta (T19)", () => {
  const AVISO = "#f80";
  const conAviso = { ...COLORES, aviso: AVISO };
  const infoAviso = (escala: number): InfoDibujo => ({ escala, colores: conAviso, visible: TODO_ESCENA, detalle: nivelDetalle(escala) });

  /** Un componente de cada símbolo, en fila, con `conAviso` leído por un getter que cuenta. */
  function contados(): { lista: ComponenteEscena[]; lecturas: () => number } {
    let n = 0;
    const lista = SIMBOLOS.map((def, i) => {
      const c = { def, x: i * 10, y: 0, rotacion: 0 as Rotacion, espejado: false, etiqueta: "K1" } as ComponenteEscena;
      Object.defineProperty(c, "conAviso", {
        get: () => {
          n++;
          return true as const;
        },
      });
      return c;
    });
    return { lista, lecturas: () => n };
  }

  it("agregado 1: debajo de 6 px por unidad, el contorno no cuesta nada: ni una lectura de conAviso, y las mismas llamadas que sin avisos", () => {
    const { lista, lecturas } = contados();
    const sin = SIMBOLOS.map((def, i) => ({ def, x: i * 10, y: 0, rotacion: 0 as Rotacion, espejado: false, etiqueta: "K1" }));
    for (const escala of [1, 3.3, 5.99]) {
      const a = grabador();
      new Escena(lista).dibujar(a.r, infoAviso(escala));
      const b = grabador();
      new Escena(sin).dibujar(b.r, infoAviso(escala));
      expect(lecturas(), `escala ${escala}`).toBe(0);
      expect(a.llamadas).toEqual(b.llamadas);
    }
    // A 6 px por unidad, sí: una lectura por componente.
    new Escena(lista).dibujar(grabador().r, infoAviso(6));
    expect(lecturas()).toBe(SIMBOLOS.length);
  });

  it("con los bornes visibles: todas las rayas en un solo trazo, en el color de aviso, sobre el cuerpo más 0,25", () => {
    const def = SIMBOLOS.find((d) => d.tamano.ancho === 2 && d.tamano.alto === 4)!;
    const c: ComponenteEscena = { def, x: 4, y: 6, rotacion: 0, espejado: false, etiqueta: "K1", conAviso: true };
    const { r, llamadas } = grabador();
    new Escena([c, { ...c, x: 20 }]).dibujar(r, infoAviso(20));
    const lineas = llamadas.filter((l) => l[0] === "lineas");
    expect(lineas).toHaveLength(1);
    const [, seg, n] = lineas[0] as [string, number[], number];
    // 2,5 × 4,5 con rayas y huecos de 0,5: 3 + 3 + 5 + 5 = 16 rayas por símbolo de 2×4.
    expect(n).toBe(32);
    const i = llamadas.indexOf(lineas[0]!);
    const estilo = llamadas.slice(0, i).reverse().find((l) => l[0] === "estilo")![1] as { trazo: string };
    expect(estilo.trazo).toBe(AVISO);
    // Las del primero: sobre su cuerpo (2×4 centrado en 4, 6) más 0,25.
    for (let k = 0; k < 16; k++) {
      const [x0, y0, x1, y1] = seg.slice(k * 4, k * 4 + 4) as [number, number, number, number];
      expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThanOrEqual(0.5 + 1e-9);
      for (const [x, y] of [[x0, y0], [x1, y1]] as const) {
        const enBorde = Math.abs(x - 2.75) < 1e-9 || Math.abs(x - 5.25) < 1e-9 || Math.abs(y - 3.75) < 1e-9 || Math.abs(y - 8.25) < 1e-9;
        expect(enBorde && x >= 2.75 - 1e-9 && x <= 5.25 + 1e-9 && y >= 3.75 - 1e-9 && y <= 8.25 + 1e-9, `${x}, ${y}`).toBe(true);
      }
    }
  });

  it("acostado (90°) las rayas siguen el cuerpo girado; el arreglo de rayas es el mismo entre cuadros (sin pedir memoria)", () => {
    const def = SIMBOLOS.find((d) => d.tamano.ancho === 2 && d.tamano.alto === 4)!;
    const c: ComponenteEscena = { def, x: 0, y: 0, rotacion: 90, espejado: false, conAviso: true };
    const a = grabador();
    new Escena([c]).dibujar(a.r, infoAviso(20));
    const b = grabador();
    new Escena([c]).dibujar(b.r, infoAviso(20));
    const la = a.llamadas.find((l) => l[0] === "lineas")!;
    const lb = b.llamadas.find((l) => l[0] === "lineas")!;
    expect(la[1]).toBe(lb[1]);
    const seg = la[1] as number[];
    const xs = seg.slice(0, (la[2] as number) * 4).filter((_, k) => k % 2 === 0);
    expect(Math.min(...xs)).toBeCloseTo(-2.25);
    expect(Math.max(...xs)).toBeCloseTo(2.25);
  });

  it("sin avisos, ninguna raya ni estilo de aviso: un componente dibuja lo mismo que antes de T19", () => {
    const lista = generarBanco(100);
    const { r, llamadas } = grabador();
    new Escena(lista).dibujar(r, infoAviso(20));
    expect(llamadas.some((l) => l[0] === "lineas")).toBe(false);
    expect(llamadas.some((l) => l[0] === "estilo" && (l[1] as { trazo?: string }).trazo === AVISO)).toBe(false);
  });

  it("cajaDibujo no cambia y cubre el contorno y los anillos de los bornes, en las 4 rotaciones y espejado", () => {
    const grosor = 1 / ESCALA_MIN_TEXTOS; // el más grueso con los bornes visibles
    for (const def of SIMBOLOS) {
      for (const rotacion of [0, 90, 180, 270] as Rotacion[]) {
        for (const espejado of [false, true]) {
          const c = { x: 3, y: -7, rotacion, espejado };
          const caja = cajaDibujo(def, c, "K12");
          const s = cajaSimbolo(def, c);
          const m = 0.25 + grosor;
          const contorno = { x: s.x - m, y: s.y - m, ancho: s.ancho + 2 * m, alto: s.alto + 2 * m };
          expect(contiene(caja, contorno.x, contorno.y) && contiene(caja, contorno.x + contorno.ancho, contorno.y + contorno.alto), `${def.tipo} ${rotacion}°`).toBe(true);
          for (const b of bornesColocados(def.bornes, c.x, c.y, c)) {
            const ra = 0.5 + grosor;
            expect(contiene(caja, b.x - ra, b.y - ra) && contiene(caja, b.x + ra, b.y + ra), `${def.tipo} ${rotacion}° ${b.nombre}`).toBe(true);
          }
        }
      }
    }
  });
});

const TODO_ESCENA: Caja = { x: -1e6, y: -1e6, ancho: 2e6, alto: 2e6 };
