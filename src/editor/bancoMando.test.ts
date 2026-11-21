// La escena de mando 2000 (T31, E-A): tamaño, validez y que se simula como
// lo que es. Sin topes con reloj real (docs/plan-T31.md, reglas).

import { describe, expect, it } from "vitest";
import { serializar } from "../core/io";
import { aparentesHoja } from "../core/model/aparentes";
import { validarHoja } from "../core/model/cables";
import { validar } from "../core/model/validaciones";
import { entrarSimulacion, pulsar, soltar, type Simulacion } from "../core/sim/motor";
import { bancoMando, MANDO } from "./bancoMando";

const banco = bancoMando();
const hoja = banco.doc.hojas[0]!;

function entrar(): Simulacion {
  const e = entrarSimulacion(hoja);
  if (!e.ok) throw new Error(`No entra: ${e.errores.map((a) => a.regla).join(", ")}`);
  return e.sim;
}
const conTension = (sim: Simulacion, etiqueta: string) => sim.tension[sim.netlist.bobinas.findIndex((b) => b.etiqueta === etiqueta)];
const cuantasConTension = (sim: Simulacion) => sim.tension.filter(Boolean).length;

describe("bancoMando", () => {
  it("tiene 2000 componentes, 2200 cables y 300 bobinas, con ids únicos", () => {
    expect(hoja.componentes).toHaveLength(2000);
    expect(hoja.cables).toHaveLength(2200);
    expect(new Set(hoja.componentes.map((c) => c.id)).size).toBe(2000);
    expect(new Set(hoja.cables.map((w) => w.id)).size).toBe(2200);
    expect(hoja.componentes.filter((c) => c.tipo === "contactor.bobina")).toHaveLength(300);
    expect(banco.marchas).toHaveLength(MANDO.simples + MANDO.conNC);
    expect(banco.cadena.bobinas).toHaveLength(MANDO.cadena);
  });

  it("es válida: cables bien enganchados, sin conexiones aparentes y sin errores", () => {
    expect(validarHoja(hoja)).toEqual([]);
    expect(aparentesHoja(hoja)).toEqual([]);
    expect(validar(hoja).filter((a) => a.severidad === "error")).toEqual([]);
    // Etiquetas de bobina sin repetir: R4 no avisa.
    expect(validar(hoja, ["R4"])).toEqual([]);
  });

  it("es siempre la misma", () => {
    expect(serializar(bancoMando().doc)).toBe(serializar(banco.doc));
  });

  it("entra en reposo: ninguna bobina con tensión, sin detenerse ni avisos", () => {
    const sim = entrar();
    expect(sim.detenida).toBeNull();
    expect(sim.avisos).toEqual([]);
    expect(cuantasConTension(sim)).toBe(0);
    // Las lámparas de parado (rama NC) prenden en reposo: una por marcha-parada con rama NC.
    expect(sim.encendidas.filter(Boolean)).toHaveLength(MANDO.conNC);
  });

  it("cada marcha arranca su bobina, la retiene al soltar y la parada la para", () => {
    let sim = entrar();
    for (const m of [banco.marchas[0]!, banco.marchas[57]!, banco.marchas[100]!, banco.marchas[199]!]) {
      sim = soltar(pulsar(sim, m.marcha), m.marcha);
      expect(conTension(sim, m.bobina)).toBe(true);
      expect(cuantasConTension(sim)).toBe(1);
      sim = soltar(pulsar(sim, m.parada), m.parada);
      expect(conTension(sim, m.bobina)).toBe(false);
      expect(sim.avisos).toEqual([]);
    }
  });

  it("la cadena entra entera al pulsar y cae entera al soltar", () => {
    let sim = pulsar(entrar(), banco.cadena.pulsador);
    expect(sim.detenida).toBeNull();
    for (const b of banco.cadena.bobinas) expect(conTension(sim, b)).toBe(true);
    expect(cuantasConTension(sim)).toBe(MANDO.cadena);
    sim = soltar(sim, banco.cadena.pulsador);
    expect(cuantasConTension(sim)).toBe(0);
    expect(sim.avisos).toEqual([]);
  });

  it("simular no cambia el documento", () => {
    const antes = serializar(banco.doc);
    let sim = entrar();
    sim = soltar(pulsar(sim, banco.marchas[3]!.marcha), banco.marchas[3]!.marcha);
    soltar(pulsar(sim, banco.cadena.pulsador), banco.cadena.pulsador);
    expect(serializar(banco.doc)).toBe(antes);
  });
});
