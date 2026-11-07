import { describe, expect, it } from "vitest";
import { ANCHO_LETRA_FALSA, fabricaFalsa, llamadasA } from "./falsos";
import { CacheTextos, LADO_PAGINA, MAX_ALTO_PX, MAX_PAGINAS, TAMANO_BASE_TEXTO, type EntradaTexto } from "./textos";

function armar() {
  const fabrica = fabricaFalsa();
  return { cache: new CacheTextos(fabrica.crear), ...fabrica };
}

/** Las dos entradas no comparten ningún píxel (o están en páginas distintas). */
function separadas(a: EntradaTexto, b: EntradaTexto): boolean {
  return (
    a.imagen !== b.imagen ||
    a.sx + a.ancho <= b.sx ||
    b.sx + b.ancho <= a.sx ||
    a.sy + a.alto <= b.sy ||
    b.sy + b.alto <= a.sy
  );
}

describe("CacheTextos", () => {
  it("dibuja cada texto una sola vez y después lo devuelve del caché", () => {
    const { cache, transparentes } = armar();
    const a = cache.obtener("K1", 20, "#000")!;
    expect(cache.obtener("K1", 20, "#000")).toBe(a);
    expect(cache.cantidad).toBe(1);
    expect(transparentes).toHaveLength(1); // una página
    expect(llamadasA(transparentes[0]!.llamadas, "fillText")).toEqual([["K1", 0, 0]]);
  });

  it("otro tamaño u otro color es otra entrada", () => {
    const { cache } = armar();
    const a = cache.obtener("K1", 20, "#000");
    expect(cache.obtener("K1", 21, "#000")).not.toBe(a);
    expect(cache.obtener("K1", 20, "#fff")).not.toBe(a);
    expect(cache.cantidad).toBe(3);
  });

  it("mide el texto y deja el anclaje en un píxel entero, con margen alrededor", () => {
    const { cache, transparentes } = armar();
    const px = 20;
    const s = px / TAMANO_BASE_TEXTO;
    const e = cache.obtener("K12", px, "#123")!;
    expect(e.avance).toBeCloseTo(3 * ANCHO_LETRA_FALSA * s);
    expect(Number.isInteger(e.ax) && Number.isInteger(e.ay)).toBe(true);
    // El glifo (40 px arriba y abajo con la fuente de 100) entra con margen.
    expect(e.ay).toBeGreaterThanOrEqual(40 * s + 1);
    expect(e.alto - e.ay).toBeGreaterThanOrEqual(40 * s + 1);
    expect(e.ancho - e.ax).toBeGreaterThanOrEqual(e.avance + 1);
    // Se dibujó escalado desde la fuente base, con el color pedido, en su anclaje.
    const c = transparentes[0]!.llamadas;
    expect(llamadasA(c, "setTransform").at(-1)).toEqual([s, 0, 0, s, e.sx + e.ax, e.sy + e.ay]);
    expect(c).toContainEqual(["=fillStyle", "#123"]);
  });

  it("acomoda los textos sin superponerlos y pide páginas a medida que hacen falta", () => {
    const { cache, transparentes } = armar();
    const entradas: EntradaTexto[] = [];
    for (let i = 0; i < 400; i++) entradas.push(cache.obtener(`X${i}`, 10 + (i % 7) * 5, "#000")!);
    expect(entradas.every((e) => e !== null)).toBe(true);
    for (let i = 0; i < entradas.length; i++) {
      const e = entradas[i]!;
      expect(e.sx >= 0 && e.sy >= 0 && e.sx + e.ancho <= LADO_PAGINA && e.sy + e.alto <= LADO_PAGINA).toBe(true);
      for (let j = 0; j < i; j++) expect(separadas(e, entradas[j]!)).toBe(true);
    }
    expect(transparentes.length).toBeGreaterThan(1);
    expect(transparentes.length).toBeLessThanOrEqual(MAX_PAGINAS);
    expect(cache.memoria).toBe(transparentes.length * LADO_PAGINA * LADO_PAGINA * 4);
  });

  it("lleno: devuelve null (fillText) sin borrar lo que ya entregó, hasta que se lo vacía", () => {
    const { cache, transparentes } = armar();
    const primera = cache.obtener("A", MAX_ALTO_PX, "#000")!;
    let i = 0;
    while (cache.obtener(`texto ${String(i).padStart(4, "0")}`, MAX_ALTO_PX, "#000")) i++;
    expect(i).toBeGreaterThan(MAX_PAGINAS);
    expect(cache.lleno).toBe(true);
    expect(transparentes).toHaveLength(MAX_PAGINAS);
    expect(cache.obtener("otro", 10, "#000")).toBeNull();
    expect(cache.obtener("A", MAX_ALTO_PX, "#000")).toBe(primera);

    cache.vaciar();
    expect(cache.lleno).toBe(false);
    expect(cache.cantidad).toBe(0);
    expect(cache.obtener("otro", 10, "#000")).not.toBeNull();
    expect(transparentes).toHaveLength(MAX_PAGINAS); // reusa las páginas
  });

  it("no cachea letras grandes ni textos vacíos", () => {
    const { cache } = armar();
    expect(cache.obtener("K1", MAX_ALTO_PX + 1, "#000")).toBeNull();
    expect(cache.obtener("", 10, "#000")).toBeNull();
    expect(cache.obtener("K1", 0, "#000")).toBeNull();
    expect(cache.lleno).toBe(false);
  });

  it("liberar suelta las páginas", () => {
    const { cache, transparentes } = armar();
    cache.obtener("K1", 20, "#000");
    cache.liberar();
    expect(cache.memoria).toBe(0);
    expect(transparentes[0]!.canvas).toEqual({ width: 0, height: 0 });
  });
});
