import { describe, expect, it, vi } from "vitest";
import type { Pegar, Recorte } from "../../core/model/portapapeles";
import type { Componente } from "../../core/model/documento";
import type { Conflicto } from "../../core/model/trazado";
import { HerramientaPegar, textoPegar, textoPegarReducido, TOPE_PREVIA_PEGAR, type CrearPegado, type RevisarPegado } from "./pegar";
import type { EventoHerramienta } from "./tipos";

const ev = (x: number, y: number, boton = 0): EventoHerramienta => ({ x, y, boton, botones: 0, mayus: false, ctrl: false, escala: 20 });

const comp = (i: number): Componente => ({ id: `c${i}`, tipo: "contactor.bobina", x: 4 * i, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: {} });

/** Un recorte de `n` bobinas en fila (sin cables), con su caja. */
function recorte(n = 1): Recorte {
  const componentes = Array.from({ length: n }, (_, i) => comp(i));
  return { componentes, cables: [], caja: { x: -1, y: -2, ancho: 4 * (n - 1) + 2, alto: 4 } };
}

const conflicto = (x: number, y: number): Conflicto => ({ clave: `cuerpoCuerpo|${x}|${y}`, x, y, mensaje: "El cuerpo de K1 quedaría encima del de K2." }) as Conflicto;

/** `revisar` que choca solo en (dx, dy) de `malos`, y cuenta sus llamadas. */
function revisor(malos: [number, number][] = []) {
  return vi.fn<RevisarPegado>((_, dx, dy) => (malos.some(([x, y]) => x === dx && y === dy) ? [conflicto(dx, dy)] : []));
}
const creador = () => vi.fn<CrearPegado>((r, dx, dy) => ({ ids: r.componentes.map((c) => `n-${c.id}-${dx}-${dy}`) }) as unknown as Pegar);

describe("HerramientaPegar", () => {
  it("modo pegar: el centro de la caja va bajo el mouse; redibuja y revisa solo al cambiar de punto de grilla", () => {
    const revisar = revisor();
    const h = new HerramientaPegar(recorte(), "pegar", revisar, creador());
    expect(h.previa).toBeNull();
    expect(h.mover(ev(5.2, 6.7))).toEqual({ redibujar: true });
    expect(h.previa).toMatchObject({ dx: 5, dy: 7, conflictos: [] });
    expect(h.mover(ev(5.4, 6.9)).redibujar).toBe(false);
    expect(revisar).toHaveBeenCalledTimes(1);
    expect(h.mover(ev(6, 7)).redibujar).toBe(true);
    expect(revisar).toHaveBeenCalledTimes(2);
  });

  it("con conflictos: ✕, pista y el clic no suelta; en un lugar libre el clic pega, selecciona lo pegado y termina", () => {
    const crear = creador();
    const h = new HerramientaPegar(recorte(), "pegar", revisor([[3, 0]]), crear);
    h.mover(ev(3, 0));
    expect(h.previa!.conflictos).toHaveLength(1);
    expect(h.pista).toBe(textoPegar(conflicto(3, 0)));
    const r = h.presionar(ev(3, 0));
    expect(r.comando).toBeUndefined();
    expect(r.aviso).toBe(textoPegar(conflicto(3, 0)));
    expect(r.terminar).toBeUndefined();

    const r2 = h.presionar(ev(4, 0));
    expect(crear).toHaveBeenCalledWith(expect.anything(), 4, 0);
    expect(r2).toMatchObject({ redibujar: true, terminar: true });
    expect([...r2.seleccion!]).toEqual(["n-c0-4-0"]);
    expect(r2.comando).toBeDefined();
  });

  it("al clic revisa siempre de nuevo, aunque no se haya movido (ajuste 1)", () => {
    const revisar = revisor();
    const h = new HerramientaPegar(recorte(), "pegar", revisar, creador());
    h.mover(ev(10, 10));
    expect(revisar).toHaveBeenCalledTimes(1);
    // El documento cambió por otra vía sin avisar: ahora (10, 10) choca.
    revisar.mockImplementation((_, dx, dy) => [conflicto(dx, dy)]);
    const r = h.presionar(ev(10, 10));
    expect(revisar).toHaveBeenCalledTimes(2);
    expect(r.comando).toBeUndefined();
    expect(h.previa!.conflictos).toHaveLength(1);
  });

  it("Esc y el botón derecho terminan sin comando; soltar el botón no hace nada", () => {
    const h = new HerramientaPegar(recorte(), "pegar", revisor(), creador());
    h.mover(ev(1, 1));
    expect(h.soltar()).toEqual({ redibujar: false });
    expect(h.presionar(ev(1, 1, 2))).toEqual({ redibujar: true, terminar: true });
    expect(h.previa).toBeNull();
    const h2 = new HerramientaPegar(recorte(), "pegar", revisor(), creador());
    h2.mover(ev(1, 1));
    expect(h2.cancelar()).toEqual({ redibujar: true, terminar: true });
  });

  it("salir del lienzo la esconde; al volver aparece bajo el mouse", () => {
    const h = new HerramientaPegar(recorte(), "pegar", revisor(), creador());
    h.mover(ev(1, 1));
    expect(h.salir()).toEqual({ redibujar: true });
    expect(h.previa).toBeNull();
    expect(h.salir()).toEqual({ redibujar: false });
    h.mover(ev(1, 1));
    expect(h.previa).toMatchObject({ dx: 1, dy: 1 });
  });

  it("revisarDeNuevo dice si cambió lo que se ve (deshacer o rehacer)", () => {
    const revisar = revisor();
    const h = new HerramientaPegar(recorte(), "pegar", revisar, creador());
    h.mover(ev(2, 2));
    expect(h.revisarDeNuevo()).toBe(false);
    revisar.mockImplementation((_, dx, dy) => [conflicto(dx, dy)]);
    expect(h.revisarDeNuevo()).toBe(true);
    expect(h.previa!.conflictos).toHaveLength(1);
  });

  it(`con más de ${TOPE_PREVIA_PEGAR} elementos no revisa en cada punto: la pista lo dice y revisa al soltar`, () => {
    const revisar = revisor([[0, 5]]);
    const r = recorte(TOPE_PREVIA_PEGAR + 1);
    const h = new HerramientaPegar(r, "pegar", revisar, creador());
    expect(h.reducido).toBe(true);
    // Centro de la caja: x (−1 + 4·TOPE + 1) / 2 = 2·TOPE, y 0.
    const cx = 2 * TOPE_PREVIA_PEGAR;
    h.mover(ev(cx, 5));
    h.mover(ev(cx + 1, 5));
    h.mover(ev(cx, 5));
    expect(revisar).not.toHaveBeenCalled();
    expect(h.previa).toMatchObject({ dx: 0, dy: 5, conflictos: [] });
    expect(h.pista).toBe(textoPegarReducido(TOPE_PREVIA_PEGAR + 1));
    const res = h.presionar(ev(cx, 5));
    expect(revisar).toHaveBeenCalledTimes(1);
    expect(res.comando).toBeUndefined();
    expect(h.pista).toBe(textoPegar(conflicto(0, 5)));
    // Al moverse se borra lo de esa revisión (no se revisa de nuevo hasta soltar).
    h.mover(ev(cx, 6));
    expect(h.previa!.conflictos).toEqual([]);
    expect(h.presionar(ev(cx, 6)).comando).toBeDefined();
  });

  it(`con ${TOPE_PREVIA_PEGAR} elementos todavía revisa en cada punto`, () => {
    const revisar = revisor();
    const h = new HerramientaPegar(recorte(TOPE_PREVIA_PEGAR), "pegar", revisar, creador());
    expect(h.reducido).toBe(false);
    h.mover(ev(0, 0));
    expect(revisar).toHaveBeenCalledTimes(1);
    expect(h.pista).toBeNull();
  });

  it("modo duplicar: arranca al lado con sus conflictos y sigue al mouse sin saltar", () => {
    const revisar = revisor([[4, 0]]);
    const h = new HerramientaPegar(recorte(), "duplicar", revisar, creador(), { lado: { dx: 4, dy: 0 }, conflictos: [conflicto(4, 0)] });
    expect(h.previa).toMatchObject({ dx: 4, dy: 0 });
    expect(h.previa!.conflictos).toHaveLength(1);
    // El primer punto que se ve es la referencia: no cambia nada.
    expect(h.mover(ev(30, 30)).redibujar).toBe(false);
    expect(h.previa).toMatchObject({ dx: 4, dy: 0 });
    expect(h.mover(ev(30, 33)).redibujar).toBe(true);
    expect(h.previa).toMatchObject({ dx: 4, dy: 3, conflictos: [] });
  });

  it("reemplazar (Ctrl+V con la previa abierta): otro recorte, en modo pegar y en el mismo punto", () => {
    const h = new HerramientaPegar(recorte(), "duplicar", revisor(), creador(), { lado: { dx: 4, dy: 0 }, conflictos: [] });
    h.mover(ev(30, 30));
    const otro: Recorte = { ...recorte(), caja: { x: 9, y: 18, ancho: 2, alto: 4 } }; // centro (10, 20)
    expect(h.reemplazar(otro)).toEqual({ redibujar: true });
    expect(h.modo).toBe("pegar");
    expect(h.recorte).toBe(otro);
    expect(h.previa).toMatchObject({ dx: 20, dy: 10 });
  });
});
