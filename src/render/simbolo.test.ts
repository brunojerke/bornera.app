import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOBINA_CONTACTOR,
  FASE,
  LAMPARA,
  NEUTRO,
  PULSADOR_NA,
  PULSADOR_NC,
  transformarBornes,
  transformarPunto,
  type DefinicionSimbolo,
} from "../core/symbols";
import type { Caja } from "./camara";
import { RendererCanvas, trazadoSimbolo } from "./canvas2d";
import type { Renderer } from "./renderer";
import {
  ALTO_BORNE,
  ALTO_ETIQUETA,
  ANCHO_LETRA_MAXIMO,
  anchoTexto,
  cajaDibujo,
  cajaEtiqueta,
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

describe("fase y neutro: la caja de dibujo cubre la etiqueta", () => {
  // El índice espacial y la invalidación de mosaicos usan cajaDibujo: si la
  // etiqueta (a la izquierda del círculo) quedara afuera, al mover quedarían restos.
  const dentro = (a: { x: number; y: number; ancho: number; alto: number }, b: typeof a) =>
    a.x >= b.x && a.y >= b.y && a.x + a.ancho <= b.x + b.ancho && a.y + a.alto <= b.y + b.alto;

  it.each([
    [FASE, "L"],
    [FASE, "L1"],
    [FASE, "L123"],
    [NEUTRO, "N"],
  ] as const)("%# con la etiqueta %s", (def, etiqueta) => {
    for (const rotacion of [0, 90, 180, 270] as const) {
      const c = { x: 7, y: -3, rotacion, espejado: false };
      const e = cajaEtiqueta(def, c, etiqueta)!;
      const d = cajaDibujo(def, c, etiqueta);
      expect(e.ancho).toBeCloseTo(anchoTexto(etiqueta, ALTO_ETIQUETA));
      expect(dentro(e, d)).toBe(true);
      expect(dentro(cajaSimbolo(def, c), d)).toBe(true);
    }
  });
});

// ── Una sola transformación para dibujo, bornes y textos (T10) ─────────────

/** Matriz afín [a, b, c, d, e, f] como la de canvas: x' = a·x + c·y + e, y' = b·x + d·y + f. */
type Matriz = [number, number, number, number, number, number];

const IDENTIDAD: Matriz = [1, 0, 0, 1, 0, 0];

function por(m: Matriz, n: Matriz): Matriz {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

const aplicarM = (m: Matriz, x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4] + 0, y: m[1] * x + m[3] * y + m[5] + 0 });

/**
 * Renderer falso que lleva la matriz actual como un canvas (cada operación
 * se compone a la derecha). Anota la matriz con la que se pide cada
 * `simbolo` y cada `texto`.
 */
function grabadorConMatriz() {
  let m: Matriz = IDENTIDAD;
  const pila: Matriz[] = [];
  const simbolos: Matriz[] = [];
  const textos: { m: Matriz; x: number; y: number; texto: string; alto: number; alineacion: string }[] = [];
  const r = new Proxy({} as Renderer, {
    get: (_, nombre) => (...a: never[]) => {
      const n = a as unknown as number[];
      if (nombre === "guardar") pila.push(m);
      else if (nombre === "restaurar") m = pila.pop()!;
      else if (nombre === "trasladar") m = por(m, [1, 0, 0, 1, n[0]!, n[1]!]);
      else if (nombre === "escalar") m = por(m, [n[0]!, 0, 0, n[1] ?? n[0]!, 0, 0]);
      else if (nombre === "rotar") {
        const g = (n[0]! * Math.PI) / 180;
        const [cos, sen] = [Math.round(Math.cos(g)), Math.round(Math.sin(g))];
        m = por(m, [cos, sen, -sen, cos, 0, 0]);
      } else if (nombre === "simbolo") simbolos.push(m);
      else if (nombre === "texto") {
        const [x, y, texto, alto, alineacion] = a as unknown as [number, number, string, number, string];
        textos.push({ m, x, y, texto, alto, alineacion: alineacion ?? "izquierda" });
      }
    },
  });
  return { r, simbolos, textos, pila: () => pila.length };
}

const ORIENTACIONES = ([0, 90, 180, 270] as const).flatMap((rotacion) => [
  { rotacion, espejado: false },
  { rotacion, espejado: true },
]);

const TODOS_LOS_SIMBOLOS = [FASE, NEUTRO, PULSADOR_NA, PULSADOR_NC, BOBINA_CONTACTOR, LAMPARA];

describe("la geometría dibujada coincide con transformarPunto y los bornes", () => {
  it.each(ORIENTACIONES)("con %o, en todos los símbolos", (t) => {
    for (const def of TODOS_LOS_SIMBOLOS) {
      const c = { x: 7, y: -3, ...t };
      const g = grabadorConMatriz();
      dibujarSimbolo(g.r, def, c, { etiqueta: "K1" });
      expect(g.simbolos).toHaveLength(1);
      const m = g.simbolos[0]!;
      // Cada borne (posición y extremo de su marca de salida) cae donde dice transformarBornes.
      transformarBornes(def.bornes, c).forEach((b, i) => {
        const local = def.bornes[i]!;
        expect(aplicarM(m, local.x, local.y)).toEqual({ x: c.x + b.x, y: c.y + b.y });
        const [vx, vy] = { derecha: [1, 0], izquierda: [-1, 0], abajo: [0, 1], arriba: [0, -1] }[local.direccion];
        const [wx, wy] = { derecha: [1, 0], izquierda: [-1, 0], abajo: [0, 1], arriba: [0, -1] }[b.direccion];
        expect(aplicarM(m, local.x + vx!, local.y + vy!)).toEqual({ x: c.x + b.x + wx!, y: c.y + b.y + wy! });
      });
      // Cualquier punto de la geometría también (línea, arco, círculo, todo pasa por la misma matriz).
      for (const [px, py] of [[1, 0], [0, 1], [0.5, -1.5]] as const) {
        const q = transformarPunto(px, py, c);
        const p = aplicarM(m, px, py);
        expect(p.x).toBeCloseTo(c.x + q.x, 12);
        expect(p.y).toBeCloseTo(c.y + q.y, 12);
      }
      expect(g.pila()).toBe(0);
    }
  });
});

describe("los textos quedan siempre derechos y legibles", () => {
  it.each(ORIENTACIONES)("con %o: ningún texto se dibuja girado ni espejado", (t) => {
    const conTexto: DefinicionSimbolo = {
      ...BOBINA_CONTACTOR,
      primitivas: [...BOBINA_CONTACTOR.primitivas, { forma: "texto", x: 0.5, y: 0, texto: "~", alto: 0.5, alineacion: "izquierda" }],
    };
    for (const def of [...TODOS_LOS_SIMBOLOS, conTexto]) {
      const g = grabadorConMatriz();
      dibujarSimbolo(g.r, def, { x: 3, y: 4, ...t }, { etiqueta: "K1" });
      expect(g.textos.length).toBeGreaterThan(0);
      for (const tx of g.textos) expect(tx.m).toEqual(IDENTIDAD);
    }
  });
});

describe("cajaDibujo cubre todo lo que se dibuja (sin restos al transformar o borrar)", () => {
  const ETIQUETAS = ["L", "K1", "KM12-3", "WWWWWWWW", "Ñandú 1"];
  const dentro = (k: Caja, x0: number, y0: number, x1: number, y1: number) =>
    x0 >= k.x - 1e-9 && y0 >= k.y - 1e-9 && x1 <= k.x + k.ancho + 1e-9 && y1 <= k.y + k.alto + 1e-9;

  it.each(ORIENTACIONES)("con %o, todos los símbolos y etiquetas cortas y largas", (t) => {
    for (const def of TODOS_LOS_SIMBOLOS) {
      for (const etiqueta of ETIQUETAS) {
        const c = { x: -5, y: 2, ...t };
        const k = cajaDibujo(def, c, etiqueta);
        const g = grabadorConMatriz();
        dibujarSimbolo(g.r, def, c, { etiqueta });
        // Textos con la letra más ancha posible.
        for (const tx of g.textos) {
          const w = tx.texto.length * tx.alto * ANCHO_LETRA_MAXIMO;
          const x0 = tx.alineacion === "derecha" ? tx.x - w : tx.alineacion === "centro" ? tx.x - w / 2 : tx.x;
          expect(dentro(k, x0, tx.y - tx.alto / 2, x0 + w, tx.y + tx.alto / 2), `${def.tipo} "${tx.texto}"`).toBe(true);
        }
        // Geometría y marcas de bornes (punto y trazo de salida).
        const s = cajaSimbolo(def, c);
        expect(dentro(k, s.x, s.y, s.x + s.ancho, s.y + s.alto)).toBe(true);
        for (const b of transformarBornes(def.bornes, c)) {
          const [vx, vy] = { derecha: [1, 0], izquierda: [-1, 0], abajo: [0, 1], arriba: [0, -1] }[b.direccion];
          const ex = c.x + b.x + vx! * 0.8;
          const ey = c.y + b.y + vy! * 0.8;
          expect(dentro(k, Math.min(ex, c.x + b.x) - 0.2, Math.min(ey, c.y + b.y) - 0.2, Math.max(ex, c.x + b.x) + 0.2, Math.max(ey, c.y + b.y) + 0.2)).toBe(true);
        }
      }
    }
  });

  it("la caja para elegir y resaltar no se agranda con la cota (sigue con el ancho promedio)", () => {
    const c = { x: 0, y: 0, rotacion: 90 as const, espejado: false };
    const e = cajaEtiqueta(FASE, c, "WWWWWWWW")!;
    expect(e.ancho).toBeCloseTo(anchoTexto("WWWWWWWW", ALTO_ETIQUETA));
    expect(cajaDibujo(FASE, c, "WWWWWWWW").ancho).toBeGreaterThan(e.ancho);
  });
});

describe("fase y neutro girados 180°", () => {
  it.each([
    [FASE, "L"],
    [NEUTRO, "N"],
  ] as const)("%#: el borne pasa arriba y la etiqueta %s queda derecha a la izquierda", (def, etiqueta) => {
    const c = { x: 4, y: 6, rotacion: 180 as const, espejado: false };
    expect(transformarBornes(def.bornes, c)).toEqual([{ nombre: etiqueta, x: 0, y: -1, direccion: "arriba" }]);
    const g = grabadorConMatriz();
    dibujarSimbolo(g.r, def, c, { etiqueta });
    // Solo la etiqueta (sin nombre de borne), sin girar, a la izquierda del símbolo.
    expect(g.textos).toEqual([{ m: IDENTIDAD, x: 4 - 1 - 0.5, y: 6, texto: etiqueta, alto: ALTO_ETIQUETA, alineacion: "derecha" }]);
    // La geometría sí gira: el borne local (0, 1) cae arriba del centro.
    expect(aplicarM(g.simbolos[0]!, 0, 1)).toEqual({ x: 4, y: 5 });
  });
});
