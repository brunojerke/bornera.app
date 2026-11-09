import { describe, expect, it } from "vitest";
import { validarHoja } from "../core/model/cables";
import { corrimientoTope, documentoTope, medirTope, OBJETIVOS_TOPE } from "./medicionTope";

describe("medición del tope de la previa", () => {
  it("cada paso cambia de punto de grilla", () => {
    for (let i = 1; i < 30; i++) expect(corrimientoTope(i)).not.toEqual(corrimientoTope(i - 1));
  });

  it("la escena es válida", () => {
    expect(validarHoja(documentoTope(60).hojas[0]!)).toEqual([]);
  });

  it("acomoda exactamente los cables pedidos, y ningún paso se rechaza (el plan es completo)", () => {
    let t = 0;
    const medidas = medirTope(OBJETIVOS_TOPE, 8, () => (t += 1));
    expect(medidas.map((m) => m.cables)).toEqual([50, 100, 150, 200, 300]);
    for (const m of medidas) {
      expect(m.rechazados, `${m.cables}`).toBe(0);
      expect(m.pasos).toBe(8);
      expect(m.mediana).toBe(1);
    }
  });
});
