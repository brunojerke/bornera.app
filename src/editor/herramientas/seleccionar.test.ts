import { describe, expect, it } from "vitest";
import { buscarSimbolo } from "../../core/symbols";
import type { ComponenteEscena } from "../../render/escena";
import { EscenaEditable } from "../../render/escenaEditable";
import { cajaEtiqueta, cajaSimbolo } from "../../render/simbolo";
import { HerramientaSeleccionar } from "./seleccionar";
import { NADA, type EventoHerramienta, type Resultado } from "./tipos";

const BOBINA = buscarSimbolo("contactor.bobina")!;
const comp = (x: number, y: number, etiqueta = "K1"): ComponenteEscena => ({
  def: BOBINA,
  x,
  y,
  rotacion: 0,
  espejado: false,
  etiqueta,
});

/** Evento en (x, y) al 100 % (20 px por unidad). */
const ev = (x: number, y: number, mayus = false, boton = 0): EventoHerramienta => ({
  x,
  y,
  boton,
  botones: 0,
  mayus,
  ctrl: false,
  escala: 20,
});

/** Tres bobinas: a en (0,0), b en (10,0), c en (20,0). La herramienta con su selección. */
function armar() {
  const escena = new EscenaEditable([
    ["a", comp(0, 0, "K1")],
    ["b", comp(10, 0, "K2")],
    ["c", comp(20, 0, "K3")],
  ]);
  let seleccion: ReadonlySet<string> = new Set();
  const h = new HerramientaSeleccionar(escena, () => seleccion);
  /** Aplica el resultado como el editor: si trae selección, la adopta. */
  const aplicar = (r: Resultado) => {
    if (r.seleccion) seleccion = r.seleccion;
    return r;
  };
  const clic = (x: number, y: number, mayus = false) => {
    aplicar(h.presionar(ev(x, y, mayus)));
    aplicar(h.soltar(ev(x, y, mayus)));
  };
  /** Presionar en (x0,y0), moverse en varios pasos y soltar en (x1,y1). */
  const arrastrar = (x0: number, y0: number, x1: number, y1: number, mayus = false) => {
    aplicar(h.presionar(ev(x0, y0, mayus)));
    for (let i = 1; i <= 5; i++) aplicar(h.mover(ev(x0 + ((x1 - x0) * i) / 5, y0 + ((y1 - y0) * i) / 5, mayus)));
    return aplicar(h.soltar(ev(x1, y1, mayus)));
  };
  return { escena, h, aplicar, clic, arrastrar, sel: () => [...seleccion].sort() };
}

describe("HerramientaSeleccionar: clics", () => {
  it("clic sobre un componente lo selecciona solo a él", () => {
    const t = armar();
    t.clic(0, 0);
    expect(t.sel()).toEqual(["a"]);
    t.clic(10, 0);
    expect(t.sel()).toEqual(["b"]);
  });

  it("clic en vacío deselecciona; con Mayús no cambia nada", () => {
    const t = armar();
    t.clic(0, 0);
    t.clic(0, 50, true);
    expect(t.sel()).toEqual(["a"]);
    t.clic(0, 50);
    expect(t.sel()).toEqual([]);
  });

  it("Mayús+clic suma y quita", () => {
    const t = armar();
    t.clic(0, 0);
    t.clic(10, 0, true);
    t.clic(20, 0, true);
    expect(t.sel()).toEqual(["a", "b", "c"]);
    t.clic(10, 0, true);
    expect(t.sel()).toEqual(["a", "c"]);
  });

  it("clic sobre uno de un grupo: mientras está apretado el grupo sigue; al soltar sin mover, queda solo él", () => {
    const t = armar();
    t.clic(0, 0);
    t.clic(10, 0, true);
    const r = t.h.presionar(ev(10, 0));
    expect(r.seleccion).toBeUndefined();
    expect(t.sel()).toEqual(["a", "b"]);
    t.aplicar(t.h.soltar(ev(10, 0)));
    expect(t.sel()).toEqual(["b"]);
  });

  it("apretar sobre uno del grupo y arrastrar no reduce la selección (lo mueve en T9)", () => {
    const t = armar();
    t.clic(0, 0);
    t.clic(10, 0, true);
    t.arrastrar(10, 0, 14, 3);
    expect(t.sel()).toEqual(["a", "b"]);
  });

  it("un clic sobre la etiqueta selecciona el componente", () => {
    const t = armar();
    const k = cajaEtiqueta(BOBINA, comp(10, 0), "K2")!;
    t.clic(k.x + k.ancho / 2, k.y + k.alto / 2);
    expect(t.sel()).toEqual(["b"]);
  });

  it("un clic a pocos px del borde del símbolo lo agarra; uno más lejos, no", () => {
    const t = armar();
    const s = cajaSimbolo(BOBINA, comp(0, 0));
    const derecha = s.x + s.ancho;
    t.clic(derecha + 2 / 20, 0); // 2 px: dentro de la tolerancia
    expect(t.sel()).toEqual(["a"]);
    t.clic(derecha + 10 / 20, 0); // 10 px
    expect(t.sel()).toEqual([]);
  });

  it("un movimiento menor al umbral sigue siendo clic (no dibuja rectángulo)", () => {
    const t = armar();
    t.clic(0, 0);
    t.aplicar(t.h.presionar(ev(0, 50)));
    expect(t.h.mover(ev(3 / 20, 50))).toBe(NADA); // 3 px
    expect(t.h.rectangulo).toBeNull();
    t.aplicar(t.h.soltar(ev(3 / 20, 50)));
    expect(t.sel()).toEqual([]); // fue un clic en vacío
  });

  it("el botón derecho no hace nada", () => {
    const t = armar();
    expect(t.h.presionar(ev(0, 0, false, 2))).toBe(NADA);
    expect(t.h.soltar(ev(0, 0))).toBe(NADA);
    expect(t.sel()).toEqual([]);
  });

  it("Esc deselecciona; sin selección no hace nada", () => {
    const t = armar();
    t.clic(0, 0);
    expect(t.aplicar(t.h.cancelar()).seleccion?.size).toBe(0);
    expect(t.h.cancelar()).toBe(NADA);
  });
});

describe("HerramientaSeleccionar: rectángulo", () => {
  /** Caja del cuerpo de la bobina en (x, 0). */
  const cuerpo = (x: number) => cajaSimbolo(BOBINA, comp(x, 0));

  it("de izquierda a derecha elige lo que queda entero adentro", () => {
    const t = armar();
    const a = cuerpo(0);
    const b = cuerpo(10);
    // Contiene a 'a' entero y la mitad izquierda de 'b'.
    t.arrastrar(a.x - 1, a.y - 1, b.x + b.ancho / 2, b.y + b.alto + 1);
    expect(t.sel()).toEqual(["a"]);
  });

  it("de derecha a izquierda elige lo que toca", () => {
    const t = armar();
    const a = cuerpo(0);
    const b = cuerpo(10);
    t.arrastrar(b.x + b.ancho / 2, b.y + b.alto + 1, a.x - 1, a.y - 1);
    expect(t.sel()).toEqual(["a", "b"]);
  });

  it("toca alcanza con rozar la etiqueta; contiene no la pide", () => {
    const t = armar();
    const k = cajaEtiqueta(BOBINA, comp(20, 0), "K3")!;
    // De derecha a izquierda, solo sobre la etiqueta de 'c'.
    t.arrastrar(k.x + k.ancho / 2, k.y + 0.1, k.x - 0.5, k.y + 0.3);
    expect(t.sel()).toEqual(["c"]);
    // De izquierda a derecha, solo el cuerpo de 'c' (sin su etiqueta): igual lo elige.
    const c = cuerpo(20);
    t.arrastrar(c.x - 0.1, c.y - 0.1, c.x + c.ancho + 0.1, c.y + c.alto + 0.1);
    expect(t.sel()).toEqual(["c"]);
  });

  it("sin Mayús reemplaza la selección; con Mayús suma", () => {
    const t = armar();
    t.clic(20, 0);
    const a = cuerpo(0);
    t.arrastrar(a.x - 1, a.y - 1, a.x + a.ancho + 1, a.y + a.alto + 1);
    expect(t.sel()).toEqual(["a"]);
    const b = cuerpo(10);
    t.arrastrar(b.x - 1, b.y - 1, b.x + b.ancho + 1, b.y + b.alto + 1, true);
    expect(t.sel()).toEqual(["a", "b"]);
  });

  it("un rectángulo vacío sin Mayús deselecciona", () => {
    const t = armar();
    t.clic(0, 0);
    t.arrastrar(0, 40, 10, 50);
    expect(t.sel()).toEqual([]);
  });

  it("mientras se arrastra hay rectángulo y cambia de modo con la dirección; al soltar desaparece", () => {
    const t = armar();
    t.aplicar(t.h.presionar(ev(0, 40)));
    expect(t.h.mover(ev(5, 45)).redibujar).toBe(true);
    expect(t.h.rectangulo).toMatchObject({ x0: 0, y0: 40, x1: 5, y1: 45, modo: "contiene" });
    t.h.mover(ev(-5, 45));
    expect(t.h.rectangulo?.modo).toBe("toca");
    expect(t.h.soltar(ev(-5, 45)).redibujar).toBe(true);
    expect(t.h.rectangulo).toBeNull();
  });

  it("Esc corta el rectángulo sin cambiar la selección", () => {
    const t = armar();
    t.clic(0, 0);
    t.aplicar(t.h.presionar(ev(0, 40)));
    t.h.mover(ev(30, 50));
    const r = t.aplicar(t.h.cancelar());
    expect(r.redibujar).toBe(true);
    expect(r.seleccion).toBeUndefined();
    expect(t.h.rectangulo).toBeNull();
    expect(t.sel()).toEqual(["a"]);
    // El soltar que llega después no hace nada.
    expect(t.h.soltar(ev(30, 50))).toBe(NADA);
  });

  it("un gesto cortado (pointercancel) no cambia la selección", () => {
    const t = armar();
    t.clic(0, 0);
    t.aplicar(t.h.presionar(ev(0, 40)));
    t.h.mover(ev(30, 50));
    const r = t.aplicar(t.h.soltar(null));
    expect(r.seleccion).toBeUndefined();
    expect(t.sel()).toEqual(["a"]);
  });
});
