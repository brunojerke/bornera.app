import { describe, expect, it } from "vitest";
import { SIMBOLOS } from "../core/symbols";
import { azar, generarBanco } from "./banco";
import { seTocan, type Caja } from "./camara";
import { DETALLE_COMPLETO } from "./detalle";
import { Escena, type ComponenteEscena, type InfoDibujo } from "./escena";
import { contieneCaja, EscenaEditable, formaComponente } from "./escenaEditable";
import type { Renderer } from "./renderer";
import { cajaDibujo, cajaEtiqueta, cajaSimbolo } from "./simbolo";

function grabador(): { r: Renderer; llamadas: unknown[][] } {
  const llamadas: unknown[][] = [];
  const r = new Proxy({} as Renderer, {
    get: (_, nombre) => (...args: unknown[]) => llamadas.push([nombre, ...args]),
  });
  return { r, llamadas };
}

function info(visible: Caja): InfoDibujo {
  return { escala: 20, colores: { simbolo: "#000", borne: "#f00" }, visible, detalle: { ...DETALLE_COMPLETO } };
}

/** Contiene a `b` entera. */
function cubre(a: Caja, b: Caja): boolean {
  return a.x <= b.x && a.y <= b.y && a.x + a.ancho >= b.x + b.ancho && a.y + a.alto >= b.y + b.alto;
}

const def = SIMBOLOS[0]!;
const en = (x: number, y: number, etiqueta = "S1"): ComponenteEscena => ({
  def,
  x,
  y,
  rotacion: 0,
  espejado: false,
  etiqueta,
});

describe("EscenaEditable", () => {
  it("con los componentes del banco, dibuja lo mismo que Escena", () => {
    const lista = generarBanco(2000);
    const vieja = new Escena(lista);
    const nueva = new EscenaEditable(lista.map((c, i) => [`b${i}`, c]));
    expect(nueva.cantidad).toBe(2000);
    expect(nueva.caja).toEqual(vieja.caja);

    // Mosaicos al 100 % y al 31 %, y toda la escena.
    const t = vieja.caja!;
    for (const lado of [12.8, 41.3, Math.max(t.ancho, t.alto)]) {
      for (let y = t.y; y < t.y + t.alto; y += lado * 3.7) {
        for (let x = t.x; x < t.x + t.ancho; x += lado * 2.3) {
          const v = { x, y, ancho: lado, alto: lado };
          const a = grabador();
          const b = grabador();
          expect(nueva.dibujar(b.r, info(v))).toBe(vieja.dibujar(a.r, info(v)));
          expect(b.llamadas).toEqual(a.llamadas);
          expect(nueva.contar(v)).toBe(vieja.contar(v));
        }
      }
    }
  });

  it("agregar devuelve la caja de dibujo; quitar, la que ocupaba", () => {
    const e = new EscenaEditable();
    expect(e.caja).toBeNull();
    const k = e.agregar("c1", en(0, 0));
    expect(k).toEqual(cajaDibujo(def, en(0, 0), "S1"));
    expect(e.caja).toEqual(k);
    expect(e.obtener("c1")).toEqual(en(0, 0));
    expect(e.quitar("c1")).toEqual(k);
    expect(e.quitar("c1")).toBeNull();
    expect(e.cantidad).toBe(0);
    expect(e.caja).toBeNull();
  });

  it("actualizar devuelve la caja vieja unida a la nueva, y ya no aparece donde estaba", () => {
    const e = new EscenaEditable([
      ["c1", en(0, 0)],
      ["c2", en(40, 0)],
    ]);
    const vieja = cajaDibujo(def, en(0, 0), "S1");
    const nueva = cajaDibujo(def, en(20, 10), "K1234");
    const k = e.actualizar("c1", en(20, 10, "K1234"));
    expect(cubre(k, vieja) && cubre(k, nueva)).toBe(true);
    expect(e.idsCandidatos({ x: 0, y: 0, ancho: 0, alto: 0 })).toEqual([]);
    expect(e.idsCandidatos({ x: 20, y: 10, ancho: 0, alto: 0 })).toEqual(["c1"]);
    expect(e.obtener("c1")!.etiqueta).toBe("K1234");
  });

  it("mover uno en la escena de 2000 afecta solo su región", () => {
    const lista = generarBanco(2000);
    const e = new EscenaEditable(lista.map((c, i) => [`b${i}`, c]));
    const c = e.obtener("b7")!;
    const k = e.actualizar("b7", { ...c, x: c.x + 1 });
    // Una caja chica (un símbolo y su paso): toca a pocos vecinos, no a la escena.
    expect(k.ancho).toBeLessThan(12);
    expect(k.alto).toBeLessThan(12);
    expect(e.idsCandidatos(k).length).toBeLessThan(10);
    expect(e.idsCandidatos(k)).toContain("b7");
  });

  it("la caja total se achica al quitar el de la punta", () => {
    const e = new EscenaEditable([
      ["a", en(0, 0)],
      ["b", en(100, 0)],
    ]);
    expect(e.caja!.ancho).toBeGreaterThan(100);
    e.quitar("b");
    expect(e.caja).toEqual(cajaDibujo(def, en(0, 0), "S1"));
  });

  it("reusa lugares: agregar después de quitar no deja huecos visibles", () => {
    const e = new EscenaEditable([
      ["a", en(0, 0)],
      ["b", en(20, 0)],
    ]);
    e.quitar("a");
    e.agregar("c", en(40, 0));
    const todo = { x: -50, y: -50, ancho: 200, alto: 100 };
    expect(e.idsCandidatos(todo).sort()).toEqual(["b", "c"]);
    const { r, llamadas } = grabador();
    expect(e.dibujar(r, info(todo))).toBe(2);
    expect(llamadas.filter((l) => l[0] === "estilo")).toHaveLength(2);
  });

  it("agregar un id que ya está lo actualiza", () => {
    const e = new EscenaEditable([["a", en(0, 0)]]);
    e.agregar("a", en(30, 0));
    expect(e.cantidad).toBe(1);
    expect(seTocan(e.caja!, cajaDibujo(def, en(0, 0), "S1"))).toBe(false);
  });
});

describe("EscenaEditable: elegir con el mouse", () => {
  /** Lo que daría recorrer todo, sin índice: la referencia. */
  function lineal(comps: [string, ComponenteEscena][]) {
    const formas = comps.map(([id, c]) => [id, formaComponente(c)] as const);
    const enZona = (z: Caja, x: number, y: number, t: number) =>
      x >= z.x - t && x <= z.x + z.ancho + t && y >= z.y - t && y <= z.y + z.alto + t;
    return {
      enPunto(x: number, y: number, t: number): string | null {
        let elegido: string | null = null; // el último que toca: el de arriba
        for (const [id, f] of formas) if (f.zonas.some((z) => enZona(z, x, y, t))) elegido = id;
        return elegido;
      },
      enCaja(k: Caja, modo: "contiene" | "toca"): string[] {
        return formas
          .filter(([, f]) => (modo === "contiene" ? contieneCaja(k, f.cuerpo) : f.zonas.some((z) => seTocan(z, k))))
          .map(([id]) => id);
      },
    };
  }

  it("con 2000 al azar, idEnPunto e idsEnCaja dan lo mismo que la búsqueda lineal", () => {
    const comps = generarBanco(2000, 7).map((c, i) => [`b${i}`, c] as [string, ComponenteEscena]);
    const e = new EscenaEditable(comps);
    const ref = lineal(comps);
    const k = e.caja!;
    const rnd = azar(3);
    const en = (a: number, ancho: number) => a + rnd() * ancho;
    for (let i = 0; i < 300; i++) {
      const x = en(k.x, k.ancho);
      const y = en(k.y, k.alto);
      const t = rnd() < 0.5 ? 0 : 0.2;
      expect(e.idEnPunto(x, y, t)).toBe(ref.enPunto(x, y, t));
    }
    let contenidos = 0;
    for (let i = 0; i < 60; i++) {
      const caja = { x: en(k.x, k.ancho), y: en(k.y, k.alto), ancho: rnd() * 60, alto: rnd() * 60 };
      const toca = e.idsEnCaja(caja, "toca");
      const contiene = e.idsEnCaja(caja, "contiene");
      // Mismo conjunto y mismo orden (el de dibujo) que la referencia.
      expect(toca).toEqual(ref.enCaja(caja, "toca"));
      expect(contiene).toEqual(ref.enCaja(caja, "contiene"));
      contenidos += contiene.length;
    }
    expect(contenidos).toBeGreaterThan(0); // la prueba no es trivial
  });

  it("un clic sobre la etiqueta lo elige; uno en el hueco del nombre de un borne, no", () => {
    const c = en(0, 0, "S12");
    const e = new EscenaEditable([["a", c]]);
    const et = cajaEtiqueta(def, c, "S12")!;
    expect(e.idEnPunto(et.x + et.ancho / 2, et.y + et.alto / 2)).toBe("a");
    // Afuera de la caja del símbolo pero dentro de la caja de dibujo, lejos de la etiqueta.
    const s = cajaSimbolo(def, c);
    const dibujo = cajaDibujo(def, c, "S12");
    const x = s.x + s.ancho + 0.8;
    expect(x).toBeLessThan(dibujo.x + dibujo.ancho);
    expect(e.idEnPunto(x, s.y + s.alto / 2)).toBeNull();
    // Con tolerancia suficiente, sí.
    expect(e.idEnPunto(x, s.y + s.alto / 2, 1)).toBe("a");
  });

  it("encimados: gana el que se dibuja arriba", () => {
    const e = new EscenaEditable([
      ["abajo", en(0, 0)],
      ["arriba", en(0, 0)],
    ]);
    expect(e.idEnPunto(0, 0)).toBe("arriba");
  });

  it("contiene pide el cuerpo entero (la etiqueta no hace falta); toca alcanza con la etiqueta", () => {
    const c = en(0, 0, "S1");
    const e = new EscenaEditable([["a", c]]);
    const s = cajaSimbolo(def, c);
    expect(e.idsEnCaja(s, "contiene")).toEqual(["a"]);
    expect(e.idsEnCaja({ ...s, ancho: s.ancho - 0.1 }, "contiene")).toEqual([]);
    const et = cajaEtiqueta(def, c, "S1")!;
    const sobreEtiqueta = { x: et.x, y: et.y, ancho: 0.1, alto: 0.1 };
    expect(e.idsEnCaja(sobreEtiqueta, "toca")).toEqual(["a"]);
    expect(e.idsEnCaja(sobreEtiqueta, "contiene")).toEqual([]);
  });

  it("después de actualizar, se elige en la posición nueva y no en la vieja", () => {
    const e = new EscenaEditable([["a", en(0, 0)]]);
    e.actualizar("a", en(30, 0));
    expect(e.idEnPunto(0, 0)).toBeNull();
    expect(e.idEnPunto(30, 0)).toBe("a");
    e.quitar("a");
    expect(e.idEnPunto(30, 0)).toBeNull();
    expect(e.contorno("a")).toBeNull();
  });
});
