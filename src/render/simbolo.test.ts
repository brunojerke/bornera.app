import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOBINA_CONTACTOR, FASE, LAMPARA, PULSADOR_NA, PULSADOR_NC, type DefinicionSimbolo } from "../core/symbols";
import { RendererCanvas, trazadoSimbolo } from "./canvas2d";
import type { Renderer } from "./renderer";
import {
  ALTO_BORNE,
  ALTO_ETIQUETA,
  cajaSimbolo,
  dibujarSimbolo,
  posicionEtiqueta,
  posicionNombreBorne,
} from "./simbolo";

/** Renderer falso que anota cada llamada. */
function grabador(): { r: Renderer; llamadas: unknown[][] } {
  const llamadas: unknown[][] = [];
  const r = new Proxy({} as Renderer, {
    get: (_, nombre) => (...args: unknown[]) => llamadas.push([nombre, ...args]),
  });
  return { r, llamadas };
}

/** Path2D falso (Node no lo tiene): anota las llamadas. */
class Path2DFalso {
  llamadas: unknown[][] = [];
  constructor() {
    return new Proxy(this, {
      get: (obj, nombre) =>
        nombre in obj ? obj[nombre as keyof this] : (...args: unknown[]) => obj.llamadas.push([nombre, ...args]),
    });
  }
}

describe("dibujarSimbolo", () => {
  it("transforma en orden: trasladar, rotar, espejar; y deja todo como estaba", () => {
    const { r, llamadas } = grabador();
    dibujarSimbolo(r, BOBINA_CONTACTOR, { x: 10, y: 5, rotacion: 90, espejado: true }, { nombresBornes: false });
    expect(llamadas).toEqual([
      ["guardar"],
      ["trasladar", 10, 5],
      ["rotar", 90],
      ["escalar", -1, 1],
      ["simbolo", BOBINA_CONTACTOR],
      ["restaurar"],
    ]);
  });

  it("la fase no escribe el nombre de su borne, solo la etiqueta", () => {
    const { r, llamadas } = grabador();
    dibujarSimbolo(r, FASE, { x: 0, y: 0, rotacion: 0, espejado: false }, { etiqueta: "L1" });
    const textos = llamadas.filter((l) => l[0] === "texto").map((l) => l[3]);
    expect(textos).toEqual(["L1"]);
  });

  it("sin rotar ni espejar no agrega transformaciones de más", () => {
    const { r, llamadas } = grabador();
    dibujarSimbolo(r, LAMPARA, { x: 0, y: 0, rotacion: 0, espejado: false }, { nombresBornes: false });
    expect(llamadas.map((l) => l[0])).toEqual(["guardar", "trasladar", "simbolo", "restaurar"]);
  });

  it("escribe los bornes derechos, junto a su posición transformada", () => {
    const { r, llamadas } = grabador();
    dibujarSimbolo(r, BOBINA_CONTACTOR, { x: 10, y: 5, rotacion: 0, espejado: false });
    const textos = llamadas.filter((l) => l[0] === "texto");
    // A1 arriba (y = 5 − 2), A2 abajo (y = 5 + 2): medio paso adentro, a la izquierda.
    expect(textos).toEqual([
      ["texto", 9.75, 3.5, "A1", ALTO_BORNE, "derecha"],
      ["texto", 9.75, 6.5, "A2", ALTO_BORNE, "derecha"],
    ]);
    // Nunca se rota un texto: todos van después de restaurar.
    expect(llamadas.findIndex((l) => l[0] === "texto")).toBeGreaterThan(
      llamadas.findIndex((l) => l[0] === "restaurar"),
    );
  });

  it("con 90° los bornes quedan a los costados y sus nombres arriba de la conexión", () => {
    const { r, llamadas } = grabador();
    dibujarSimbolo(r, BOBINA_CONTACTOR, { x: 0, y: 0, rotacion: 90, espejado: false });
    const textos = llamadas.filter((l) => l[0] === "texto");
    // 90° horario: A1 (0, −2) → (2, 0); A2 (0, 2) → (−2, 0).
    expect(textos).toEqual([
      ["texto", 1.5, -0.6, "A1", ALTO_BORNE, "centro"],
      ["texto", -1.5, -0.6, "A2", ALTO_BORNE, "centro"],
    ]);
  });

  it("el lado de los nombres gira con el símbolo: el NC a 270° los pone abajo, lejos del tope", () => {
    const { r, llamadas } = grabador();
    dibujarSimbolo(r, PULSADOR_NC, { x: 0, y: 0, rotacion: 270, espejado: false });
    // 270°: 11 (0, −2) → (−2, 0); 12 (0, 2) → (2, 0). El tope queda arriba.
    expect(llamadas.filter((l) => l[0] === "texto")).toEqual([
      ["texto", -1.5, 0.6, "11", ALTO_BORNE, "centro"],
      ["texto", 1.5, 0.6, "12", ALTO_BORNE, "centro"],
    ]);
  });

  it("respeta ladoNombresBornes y el espejado lo invierte", () => {
    const aLaDerecha: DefinicionSimbolo = { ...BOBINA_CONTACTOR, ladoNombresBornes: "derecha" };
    const nombreA1 = (espejado: boolean) => {
      const { r, llamadas } = grabador();
      dibujarSimbolo(r, aLaDerecha, { x: 0, y: 0, rotacion: 0, espejado });
      return llamadas.find((l) => l[0] === "texto");
    };
    expect(nombreA1(false)).toEqual(["texto", 0.25, -1.5, "A1", ALTO_BORNE, "izquierda"]);
    expect(nombreA1(true)).toEqual(["texto", -0.25, -1.5, "A1", ALTO_BORNE, "derecha"]);
  });

  it("si el lado es paralelo a la conexión, usa izquierda o arriba", () => {
    expect(posicionNombreBorne(0, -2, "arriba", "abajo")).toEqual({ x: -0.25, y: -1.5, alineacion: "derecha" });
    expect(posicionNombreBorne(2, 0, "derecha", "izquierda")).toEqual({ x: 1.5, y: -0.6, alineacion: "centro" });
  });

  it("pone la etiqueta a la izquierda si está derecho y arriba si está acostado", () => {
    for (const rotacion of [0, 180] as const) {
      const { r, llamadas } = grabador();
      dibujarSimbolo(r, PULSADOR_NA, { x: 0, y: 0, rotacion, espejado: false }, { etiqueta: "S1", nombresBornes: false });
      expect(llamadas.at(-1)).toEqual(["texto", -2.5, 0, "S1", ALTO_ETIQUETA, "derecha"]);
    }
    for (const rotacion of [90, 270] as const) {
      const { r, llamadas } = grabador();
      dibujarSimbolo(r, PULSADOR_NA, { x: 0, y: 0, rotacion, espejado: false }, { etiqueta: "S1", nombresBornes: false });
      expect(llamadas.at(-1)).toEqual(["texto", 0, -3, "S1", ALTO_ETIQUETA, "centro"]);
    }
  });

  it("la etiqueta cae fuera de la caja del símbolo en cualquier rotación", () => {
    for (const rotacion of [0, 90, 180, 270] as const) {
      const c = { x: 0, y: 0, rotacion, espejado: false };
      const caja = cajaSimbolo(BOBINA_CONTACTOR, c);
      const e = posicionEtiqueta(BOBINA_CONTACTOR, c);
      const fuera = e.x < caja.x || e.y + ALTO_ETIQUETA / 2 <= caja.y;
      expect(fuera).toBe(true);
    }
  });

  it("los textos propios del símbolo se mueven pero no giran", () => {
    const conTexto: DefinicionSimbolo = {
      ...LAMPARA,
      primitivas: [{ forma: "texto", x: 1, y: 0, texto: "~", alto: 0.5, alineacion: "izquierda" }],
    };
    const { r, llamadas } = grabador();
    dibujarSimbolo(r, conTexto, { x: 0, y: 0, rotacion: 180, espejado: false }, { nombresBornes: false });
    expect(llamadas.at(-1)).toEqual(["texto", -1, 0, "~", 0.5, "derecha"]);
  });
});

describe("cajaSimbolo", () => {
  it("traspone el tamaño al girar 90°", () => {
    expect(cajaSimbolo(BOBINA_CONTACTOR, { x: 10, y: 10, rotacion: 0, espejado: false })).toEqual({
      x: 9,
      y: 8,
      ancho: 2,
      alto: 4,
    });
    expect(cajaSimbolo(BOBINA_CONTACTOR, { x: 10, y: 10, rotacion: 270, espejado: true })).toEqual({
      x: 8,
      y: 9,
      ancho: 4,
      alto: 2,
    });
  });
});

describe("caché de Path2D", () => {
  beforeEach(() => vi.stubGlobal("Path2D", Path2DFalso));
  afterEach(() => vi.unstubAllGlobals());

  it("arma el trazado una sola vez por definición", () => {
    const def = { ...LAMPARA }; // copia: no la tocó ningún otro test
    const a = trazadoSimbolo(def);
    const b = trazadoSimbolo(def);
    expect(b).toBe(a);
  });

  it("une líneas y círculos en un solo trazado, cada uno con su moveTo", () => {
    const def = { ...LAMPARA };
    const { trazo, relleno } = trazadoSimbolo(def);
    const llamadas = (trazo as unknown as Path2DFalso).llamadas;
    expect(relleno).toBeNull();
    expect(llamadas.filter((l) => l[0] === "lineTo")).toHaveLength(4);
    expect(llamadas.filter((l) => l[0] === "moveTo")).toHaveLength(5);
    // El círculo empieza en su punto de 0° para no unirse con la línea anterior.
    const iArc = llamadas.findIndex((l) => l[0] === "arc");
    expect(llamadas[iArc - 1]).toEqual(["moveTo", 0.75, 0]);
  });

  it("separa lo relleno de lo contorneado", () => {
    const def: DefinicionSimbolo = {
      ...LAMPARA,
      primitivas: [
        { forma: "circulo", cx: 0, cy: 0, r: 1, relleno: true },
        { forma: "linea", x1: 0, y1: 0, x2: 1, y2: 0 },
      ],
    };
    const { trazo, relleno } = trazadoSimbolo(def);
    expect((relleno as unknown as Path2DFalso).llamadas.map((l) => l[0])).toEqual(["moveTo", "arc"]);
    expect((trazo as unknown as Path2DFalso).llamadas.map((l) => l[0])).toEqual(["moveTo", "lineTo"]);
  });

  it("RendererCanvas contornea el trazado cacheado sin rearmarlo", () => {
    const llamadas: unknown[][] = [];
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get: (_, nombre) => (...args: unknown[]) => llamadas.push([nombre, ...args]),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    const def = { ...BOBINA_CONTACTOR };
    const r = new RendererCanvas(ctx);
    r.simbolo(def);
    r.simbolo(def);
    const trazos = llamadas.filter((l) => l[0] === "stroke");
    expect(trazos).toHaveLength(2);
    expect(trazos[0]![1]).toBe(trazos[1]![1]);
    expect(trazos[0]![1]).toBe(trazadoSimbolo(def).trazo);
    expect(llamadas.some((l) => l[0] === "fill")).toBe(false);
  });
});
