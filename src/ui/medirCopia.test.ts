import { describe, expect, it } from "vitest";
import { motor, resumirF1, textoF1, TOPE_F1_PC_MS, type MuestraCopia } from "./medirCopia";

const datos = { version: "0.1.4-alpha.1", fecha: "17/11/26 12:00", motor: "Edg/142.0", simbolos: 2000, cables: 3030, caracteres: 653364 };

const muestra = (serializar: number, put: number, escritura = 5): MuestraCopia => ({ serializar, put, escritura });

describe("resumirF1", () => {
  it("F1 es el máximo de la parte síncrona (serializar + put), con la primera incluida", () => {
    const r = resumirF1([muestra(12, 0.5), muestra(8, 0.4), muestra(7, 0.3)]);
    expect(r.f1).toBe(12.5);
    expect(r.sincrona.primera).toBe(12.5);
    expect(r.serializar.maximo).toBe(12);
    expect(r.put.maximo).toBe(0.5);
    expect(r.copias).toBe(3);
  });

  it("pasa con F1 ≤ 9 ms, sin redondear", () => {
    expect(resumirF1([muestra(8.5, 0.5)]).pasa).toBe(true);
    expect(resumirF1([muestra(8.5, 0.51)]).pasa).toBe(false);
    expect(TOPE_F1_PC_MS).toBe(9);
  });

  it("sin copias no pasa", () => {
    expect(resumirF1([]).pasa).toBe(false);
  });

  it("la escritura hasta complete no cuenta para F1", () => {
    const r = resumirF1([muestra(5, 0.5, 80)]);
    expect(r.f1).toBe(5.5);
    expect(r.escritura.maximo).toBe(80);
  });
});

describe("textoF1", () => {
  it("dice F1, si pasa y la parte síncrona de cada copia en orden", () => {
    const t = textoF1([muestra(12.25, 0.5), muestra(8, 0.4)], datos);
    expect(t).toContain("F1 = 12,8 ms (máximo de la parte síncrona): no pasa");
    expect(t).toContain("2000 símbolos + 3030 cables");
    expect(t.split("\n").at(-1)).toBe("Parte síncrona por copia (ms): 12,8 · 8,4");
  });

  it("pasa", () => {
    expect(textoF1([muestra(4, 0.2)], datos)).toContain(": pasa (tope en la PC con WebView2: ≤ 9 ms)");
  });
});

describe("motor", () => {
  it("toma Edg, Chrome o AppleWebKit del user agent", () => {
    expect(motor("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36 Edg/142.0.3595.65")).toBe("Edg/142.0.3595.65");
    expect(motor("Mozilla/5.0 AppleWebKit/537.36 (KHTML) Chrome/142.0.0.0 Safari/537.36")).toBe("Chrome/142.0.0.0");
    expect(motor("Mozilla/5.0 (X11; Linux) AppleWebKit/605.1.15 (KHTML)")).toBe("AppleWebKit/605.1.15");
  });
});
