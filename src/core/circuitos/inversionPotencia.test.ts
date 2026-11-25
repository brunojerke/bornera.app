// La inversión de giro con potencia (fase 6, sección 0; T36): se arma con W,
// abre sin avisos y simula según D6 y D7.
import { describe, expect, it } from "vitest";
import { deserializar, serializar } from "../io";
import { validarHoja } from "../model/cables";
import { validar } from "../model/validaciones";
import { entrarSimulacion, pulsar, soltar, type Simulacion } from "../sim/motor";
import { compararRedes } from "./compararRedes";
import { inversionPotencia } from "./inversionPotencia";

function entrar(): { s: Simulacion; comp: ReturnType<typeof inversionPotencia>["comp"] } {
  const { doc, comp } = inversionPotencia();
  const e = entrarSimulacion(doc.hojas[0]!);
  if (!e.ok) throw new Error(`No entra: ${JSON.stringify(e.errores)}`);
  return { s: e.sim, comp };
}

/** El nombre del potencial de la red de `comp:borne`, o null. */
function potencial(s: Simulacion, comp: string, borne: string): string | null {
  const r = s.netlist.redDeBorne.get(comp)!.get(borne)!;
  const p = s.potencialDeRed[r];
  return p === null || p === undefined ? null : s.netlist.potenciales[p]!.nombre;
}

const tension = (s: Simulacion, e: string) => s.tension[s.netlist.bobinas.findIndex((b) => b.etiqueta === e)]!;
const uvw = (s: Simulacion, m1: string) => ["U", "V", "W"].map((b) => potencial(s, m1, b));

describe("inversión con potencia: armado", () => {
  it("se arma con W, sin avisos (R1 a R10) y con la hoja válida", () => {
    const hoja = inversionPotencia().doc.hojas[0]!;
    expect(validar(hoja)).toEqual([]);
    expect(validarHoja(hoja)).toEqual([]);
    expect(hoja.componentes).toHaveLength(21);
  });

  it("guardar y abrir: el mismo documento, sin avisos; compararRedes contra sí misma, 0", () => {
    const { doc } = inversionPotencia();
    const r = deserializar(serializar(doc));
    if (!r.ok) throw new Error("No abre");
    expect(r.avisos).toEqual([]);
    expect(r.documento).toEqual(doc);
    expect(compararRedes(r.documento, inversionPotencia().doc)).toEqual([]);
  });
});

describe("inversión con potencia: Simular (D6-A, D7-A)", () => {
  it("en reposo: Q1 y F2 cerrados ponen L1, L2 y L3 hasta K1 y K2; M1 sin tensión; F1 y el 95-96 llevan L1 a S0", () => {
    const { s, comp } = entrar();
    expect(s.detenida).toBeNull();
    expect(s.avisos).toEqual([]);
    expect(["1", "3", "5"].map((b) => potencial(s, comp.k1Principal, b))).toEqual(["L1", "L2", "L3"]);
    expect(["1", "3", "5"].map((b) => potencial(s, comp.k2Principal, b))).toEqual(["L1", "L2", "L3"]);
    expect(uvw(s, comp.m1)).toEqual([null, null, null]);
    expect(potencial(s, comp.s0, "11")).toBe("L1");
  });

  it("S1: K1 arranca y retiene, U V W = L1 L2 L3; S0 para", () => {
    let { s, comp } = entrar();
    s = soltar(pulsar(s, comp.s1), comp.s1);
    expect([tension(s, "K1"), tension(s, "K2")]).toEqual([true, false]);
    expect(uvw(s, comp.m1)).toEqual(["L1", "L2", "L3"]);
    expect(s.detenida).toBeNull();
    s = soltar(pulsar(s, comp.s0), comp.s0);
    expect([tension(s, "K1"), uvw(s, comp.m1)]).toEqual([false, [null, null, null]]);
  });

  it("S2: K2 arranca, U V W = L3 L2 L1 (el otro sentido); con K2, S1 no entra (enclavamiento): sin corto", () => {
    let { s, comp } = entrar();
    s = soltar(pulsar(s, comp.s2), comp.s2);
    expect([tension(s, "K1"), tension(s, "K2")]).toEqual([false, true]);
    expect(uvw(s, comp.m1)).toEqual(["L3", "L2", "L1"]);
    s = soltar(pulsar(s, comp.s1), comp.s1);
    expect([tension(s, "K1"), tension(s, "K2"), s.detenida]).toEqual([false, true, null]);
    expect(s.avisos).toEqual([]);
  });
});
