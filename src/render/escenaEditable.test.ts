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

  it("actualizar devuelve la caja vieja y la nueva por separado, y ya no aparece donde estaba", () => {
    const e = new EscenaEditable([
      ["c1", en(0, 0)],
      ["c2", en(40, 0)],
    ]);
    const vieja = cajaDibujo(def, en(0, 0), "S1");
    const nueva = cajaDibujo(def, en(20, 10), "K1234");
    expect(e.actualizar("c1", en(20, 10, "K1234"))).toEqual([vieja, nueva]);
    expect(e.idsCandidatos({ x: 0, y: 0, ancho: 0, alto: 0 })).toEqual([]);
    expect(e.idsCandidatos({ x: 20, y: 10, ancho: 0, alto: 0 })).toEqual(["c1"]);
    expect(e.obtener("c1")!.etiqueta).toBe("K1234");
  });

  it("mover uno en la escena de 2000 afecta solo su región", () => {
    const lista = generarBanco(2000);
    const e = new EscenaEditable(lista.map((c, i) => [`b${i}`, c]));
    const c = e.obtener("b7")!;
    const cajas = e.actualizar("b7", { ...c, x: c.x + 1 });
    expect(cajas).toHaveLength(2);
    // Cajas chicas (un símbolo): tocan a pocos vecinos, no a la escena.
    for (const k of cajas) {
      expect(k.ancho).toBeLessThan(12);
      expect(k.alto).toBeLessThan(12);
      expect(e.idsCandidatos(k).length).toBeLessThan(10);
    }
    expect(e.idsCandidatos(cajas[1]!)).toContain("b7");
  });

  it("un movimiento largo no marca la franja intermedia: dos cajas chicas, no su unión", () => {
    const e = new EscenaEditable([["a", en(0, 0)]]);
    const cajas = e.actualizar("a", en(500, 300));
    expect(cajas).toEqual([cajaDibujo(def, en(0, 0), "S1"), cajaDibujo(def, en(500, 300), "S1")]);
    // Nada entre las dos: ni un punto de la mitad del camino.
    for (const k of cajas) expect(seTocan(k, { x: 250, y: 150, ancho: 0, alto: 0 })).toBe(false);
  });

  it("si una caja contiene a la otra, devuelve solo la grande", () => {
    const e = new EscenaEditable([["a", en(0, 0, "K1")]]);
    const larga = cajaDibujo(def, en(0, 0), "K1-PRINCIPAL");
    expect(e.actualizar("a", en(0, 0, "K1-PRINCIPAL"))).toEqual([larga]);
    expect(e.actualizar("a", en(0, 0, "K1"))).toEqual([larga]);
  });

  it("ocultar lo saca del dibujo pero no del índice; mostrar lo devuelve", () => {
    const e = new EscenaEditable([
      ["a", en(0, 0)],
      ["b", en(20, 0)],
    ]);
    const ka = cajaDibujo(def, en(0, 0), "S1");
    const todo = { x: -50, y: -50, ancho: 200, alto: 100 };
    expect(e.ocultar("a")).toEqual(ka);
    expect(e.ocultar("a")).toBeNull(); // ya estaba oculto
    expect(e.oculto("a")).toBe(true);
    expect(e.dibujar(grabador().r, info(todo))).toBe(1);
    // Se sigue eligiendo y resaltando.
    expect(e.idEnPunto(0, 0)).toBe("a");
    expect(e.contorno("a")).not.toBeNull();

    // Moverlo o quitarlo oculto no afecta la capa estática.
    expect(e.actualizar("a", en(10, 10))).toEqual([]);
    expect(e.mostrar("a")).toEqual(cajaDibujo(def, en(10, 10), "S1"));
    expect(e.mostrar("a")).toBeNull();
    expect(e.dibujar(grabador().r, info(todo))).toBe(2);
    e.ocultar("b");
    expect(e.quitar("b")).toBeNull();
    expect(e.oculto("b")).toBe(false);
    expect(e.ocultar("no-esta")).toBeNull();
  });

  it("dibujarDesplazados dibuja corridos solo los pedidos que quedan en pantalla", () => {
    const e = new EscenaEditable([
      ["a", en(0, 0)],
      ["b", en(20, 0)],
      ["c", en(100, 0)],
    ]);
    const ids = new Set(["a", "c"]);
    // La pantalla está en x 40..60: "a" corrido 50 entra; "c" (en 150) no; "b" no se pidió.
    const pantalla = { x: 40, y: -10, ancho: 20, alto: 20 };
    const { r, llamadas } = grabador();
    expect(e.dibujarDesplazados(r, info(pantalla), ids, 50, 0, 10)).toBe(1);
    expect(llamadas[0]).toEqual(["guardar"]);
    expect(llamadas[1]).toEqual(["trasladar", 50, 0]);
    expect(llamadas.at(-1)).toEqual(["restaurar"]);
    expect(llamadas.length).toBeGreaterThan(4); // el símbolo entero, no solo su caja
    expect(llamadas.map(([n]) => n)).not.toContain("rectangulos");
    expect(e.dibujarDesplazados(grabador().r, info(pantalla), ids, 0, 0, 10)).toBe(0);
  });

  it("dibujarDesplazados con más del límite dibuja solo los cuerpos, en un solo relleno", () => {
    const lista = generarBanco(500);
    const e = new EscenaEditable(lista.map((c, i) => [`b${i}`, c]));
    const ids = new Set(lista.map((_, i) => `b${i}`));
    const { r, llamadas } = grabador();
    const n = e.dibujarDesplazados(r, info(e.caja!), ids, 0, 0, 200);
    expect(n).toBeGreaterThan(200);
    const nombres = llamadas.map(([nombre]) => nombre);
    expect(nombres.filter((x) => x === "rectangulos")).toHaveLength(1);
    expect(nombres).not.toContain("texto");
    expect(nombres).not.toContain("simbolo");
    const [, cajas, cantidad] = llamadas.find(([x]) => x === "rectangulos")!;
    expect(cantidad).toBe(n);
    // Cada rectángulo es el cuerpo de un componente (sin la etiqueta).
    const cuerpos = new Set([...ids].map((id) => JSON.stringify(e.forma(id)!.cuerpo)));
    for (let i = 0; i < n; i++) {
      const [x, y, ancho, alto] = (cajas as number[]).slice(i * 4, i * 4 + 4);
      expect(cuerpos.has(JSON.stringify({ x, y, ancho, alto }))).toBe(true);
    }
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
