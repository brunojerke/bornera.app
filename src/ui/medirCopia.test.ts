import { describe, expect, it } from "vitest";
import { motor, resumirF1, textoF1, TOPE_F1_PC_MS, type MuestraCopia } from "./medirCopia";

const datos = {
  version: "0.1.4-alpha.1",
  fecha: "17/11/26 12:00",
  motor: "Edg/157.0",
  simbolos: 2000,
  cables: 3030,
  caracteres: 653364,
  igual: true,
};

const muestra = (trozos: number[], registro = 0.3, duracion = 100, reinicios = 0, deUnaVezMs = 0): MuestraCopia => ({
  trozos,
  registro,
  duracion,
  reinicios,
  deUnaVezMs,
});

describe("resumirF1 (1b: por partes)", () => {
  it("F1 es el paso síncrono más largo de todas las copias, con la primera incluida", () => {
    const r = resumirF1([muestra([2.5, 3.1, 2.8]), muestra([2.2, 2.9], 3.4), muestra([2.4, 2.6])]);
    expect(r.f1).toBe(3.4);
    expect(r.pasoMasLargo.primera).toBe(3.1);
    expect(r.trozo.maximo).toBe(3.1);
    expect(r.registro.maximo).toBe(3.4);
    expect(r.pasosPorCopia).toBe(3);
    expect(r.copias).toBe(3);
  });

  it("pasa con F1 ≤ 9 ms, sin redondear", () => {
    expect(resumirF1([muestra([9])]).pasa).toBe(true);
    expect(resumirF1([muestra([9.01])]).pasa).toBe(false);
    expect(TOPE_F1_PC_MS).toBe(9);
  });

  it("sin copias no pasa", () => {
    expect(resumirF1([]).pasa).toBe(false);
  });

  it("la salida de emergencia va aparte: máximo y veces, fuera de la mediana y de F1", () => {
    const r = resumirF1([muestra([2.5]), { ...muestra([2.4, 2.6], 0.3, 40, 5, 16.2), porPlazo: true }, muestra([2.7]), muestra([2.2], 0.3, 40, 5, 14)]);
    expect(r.emergencia).toEqual({ veces: 2, maximo: 16.2, porPlazo: 1 });
    expect(r.f1).toBe(2.7);
    expect(r.pasa).toBe(true);
    expect(r.pasoMasLargo.mediana).toBe(2.7);
    expect(r.reinicios).toBe(10);
    const t = textoF1([muestra([2.5]), muestra([2.4], 0.3, 40, 5, 16.2)], datos);
    expect(t).toContain("Salida de emergencia (la copia de una vez; aparte, no decide): 1 veces, máx. 16,2 ms, 0 por plazo");
    expect(t).toContain("una tras otra; la primera (en frío) cuenta; después, 1 de una vez");
    // La última línea (la que lee f1-webview2.mjs) no lleva las de una vez.
    expect(t.split("\n").at(-1)).toBe("Paso más largo por copia (ms): 2,5");
  });

  it("la duración total y los reinicios se informan, pero no deciden", () => {
    const r = resumirF1([muestra([2], 0.3, 900, 4)]);
    expect(r.pasa).toBe(true);
    expect(r.duracion.maximo).toBe(900);
    expect(r.reinicios).toBe(4);
  });
});

describe("textoF1", () => {
  it("dice F1, si pasa, lo que se informa y el paso más largo de cada copia en orden", () => {
    const t = textoF1([muestra([2.25, 9.5]), muestra([2], 0.4)], datos);
    expect(t).toContain("F1 = 9,5 ms (el paso síncrono más largo): no pasa (tope en la PC con WebView2: ≤ 9 ms; objetivo ~3 ms)");
    expect(t).toContain("2000 símbolos + 3030 cables");
    expect(t).toContain("la última copia, releída, es igual a serializar");
    expect(t.split("\n").at(-1)).toBe("Paso más largo por copia (ms): 9,5 · 2,0");
  });

  it("si la copia releída no es igual, lo dice", () => {
    expect(textoF1([muestra([2])], { ...datos, igual: false })).toContain("NO es igual a serializar (MAL)");
  });
});

describe("motor", () => {
  it("toma Edg, Chrome o AppleWebKit del user agent", () => {
    expect(motor("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36 Edg/142.0.3595.65")).toBe("Edg/142.0.3595.65");
    expect(motor("Mozilla/5.0 AppleWebKit/537.36 (KHTML) Chrome/142.0.0.0 Safari/537.36")).toBe("Chrome/142.0.0.0");
    expect(motor("Mozilla/5.0 (X11; Linux) AppleWebKit/605.1.15 (KHTML)")).toBe("AppleWebKit/605.1.15");
  });
});
