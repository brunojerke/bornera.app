// La escena de potencia 2000 (T37, D21-A y D22-A; ajuste 2): tamaño, que es
// siempre la misma, tendida como W, sin aparentes, las redes que da la
// netlist y que se simula como lo que es. Sin topes con reloj real.

import { describe, expect, it } from "vitest";
import { serializar } from "../core/io";
import { aparentesHoja } from "../core/model/aparentes";
import { indexarHoja, recorridoCable, validarHoja } from "../core/model/cables";
import { consultaHoja, consultaSuperpuesta, problemasTrazado } from "../core/model/trazado";
import { validar } from "../core/model/validaciones";
import { armarNetlist } from "../core/sim/netlist";
import { entrarSimulacion, pulsar, soltar, type Simulacion } from "../core/sim/motor";
import { bancoPotencia, POTENCIA } from "./bancoPotencia";

const banco = bancoPotencia();
const hoja = banco.doc.hojas[0]!;

/**
 * Redes de la netlist de la escena (fijadas por el ajuste 2). Una inversión
 * tiene 20 (9 de mando y 12 de potencia, con L1 en las dos); L1, L2, L3 y N
 * son las mismas en toda la hoja. La celda de 5 suma 2 propias:
 * 95 × 16 + 2 + 4 = 1526.
 */
const REDES = POTENCIA.inversiones * 16 + 2 + 4;

function entrar(): Simulacion {
  const e = entrarSimulacion(hoja);
  if (!e.ok) throw new Error(`No entra: ${e.errores.map((a) => a.regla).join(", ")}`);
  return e.sim;
}

/** El nombre del potencial de la red de `comp:borne`, o null. */
function potencial(s: Simulacion, comp: string, borne: string): string | null {
  const r = s.netlist.redDeBorne.get(comp)!.get(borne)!;
  const p = s.potencialDeRed[r];
  return p === null || p === undefined ? null : s.netlist.potenciales[p]!.nombre;
}
const uvw = (s: Simulacion, m: string) => ["U", "V", "W"].map((b) => potencial(s, m, b));
const tension = (s: Simulacion, e: string) => s.tension[s.netlist.bobinas.findIndex((b) => b.etiqueta === e)]!;

describe("bancoPotencia", () => {
  it("tiene 2000 componentes justos (95 inversiones de 21 y una celda de 5), con ids únicos", () => {
    expect(hoja.componentes).toHaveLength(2000);
    expect(hoja.cables).toHaveLength(POTENCIA.inversiones * 37 + 4);
    expect(new Set(hoja.componentes.map((c) => c.id)).size).toBe(2000);
    expect(new Set(hoja.cables.map((w) => w.id)).size).toBe(hoja.cables.length);
    const cuenta = (tipo: string) => hoja.componentes.filter((c) => c.tipo === tipo).length;
    expect(cuenta("fuente.trifasica")).toBe(95);
    expect(cuenta("contactor.principal")).toBe(190);
    expect(cuenta("contactor.bobina")).toBe(190);
    expect(cuenta("motor.trifasico")).toBe(95);
    expect(cuenta("proteccion.termomagnetica_tripolar")).toBe(95);
    expect(cuenta("proteccion.termico")).toBe(95);
    expect(cuenta("proteccion.fusible")).toBe(96);
    expect(cuenta("senalizacion.lampara")).toBe(191);
    expect(cuenta("fuente.fase")).toBe(96);
    expect(cuenta("fuente.neutro")).toBe(96);
  });

  it("es siempre la misma (dos llamadas dan lo mismo)", () => {
    expect(serializar(bancoPotencia().doc)).toBe(serializar(banco.doc));
  });

  // Tope propio: 3519 cables, cada uno con consultas de consultaHoja sin índice
  // por zona. Tarda 8,5–10,8 s solo y llegó a 22 s con la PC cargada; 60 s le deja ×5.
  it("está tendida como W: problemasTrazado da 0 en cada cable y no hay conexiones aparentes", { timeout: 60_000 }, () => {
    const indice = indexarHoja(hoja);
    const base = consultaHoja(hoja, indice);
    expect(validarHoja(hoja)).toEqual([]);
    expect(aparentesHoja(hoja, indice, base)).toEqual([]);
    const apoyados = (id: string) =>
      hoja.cables.filter((k) => (k.desde.tipo === "cable" && k.desde.cable === id) || (k.hasta.tipo === "cable" && k.hasta.cable === id)).map((k) => k.id);
    for (const w of hoja.cables) {
      const puntos = recorridoCable(indice, w)!;
      // Como al tenderlo con W: sin él y sin los que se apoyan en él con una T.
      const quitar = new Set([w.id, ...apoyados(w.id)]);
      expect(problemasTrazado({ id: w.id, desde: w.desde, hasta: w.hasta, puntos }, consultaSuperpuesta(base, { quitar })), w.id).toEqual([]);
    }
  });

  it("no tiene avisos (R1 a R11) y R4 no avisa: etiquetas sin repetir", () => {
    expect(validar(hoja)).toEqual([]);
  });

  it(`la netlist da ${REDES} redes; L1, L2 y L3 de las 95 trifásicas son una red cada una, con las Fase «L1» del mando`, () => {
    const n = armarNetlist(hoja);
    expect(n.redes).toHaveLength(REDES);
    expect(n.enCorto).toEqual([]);
    const red = (comp: string, borne: string) => n.redDeBorne.get(comp)!.get(borne)!;
    const trifasicas = hoja.componentes.filter((c) => c.tipo === "fuente.trifasica");
    const fases = hoja.componentes.filter((c) => c.tipo === "fuente.fase");
    for (const l of ["L1", "L2", "L3"]) expect(new Set(trifasicas.map((c) => red(c.id, l))).size, l).toBe(1);
    const [l1, l2, l3] = ["L1", "L2", "L3"].map((l) => red(trifasicas[0]!.id, l));
    expect(new Set([l1, l2, l3]).size).toBe(3);
    expect(new Set(fases.map((c) => red(c.id, "L")))).toEqual(new Set([l1]));
    const neutros = hoja.componentes.filter((c) => c.tipo === "fuente.neutro");
    expect(new Set(neutros.map((c) => red(c.id, "N"))).size).toBe(1);
  });

  it("entra en reposo: sin bobinas con tensión, sin detenerse ni avisos, motores sin tensión", () => {
    const s = entrar();
    expect(s.detenida).toBeNull();
    expect(s.avisos).toEqual([]);
    expect(s.tension.filter(Boolean)).toHaveLength(0);
    expect(s.encendidas.filter(Boolean)).toHaveLength(0);
    for (const m of [banco.inversiones[0]!, banco.inversiones[94]!]) expect(uvw(s, m.m1)).toEqual([null, null, null]);
  });

  it("la 1.ª y la última inversión: S1 da U V W = L1 L2 L3, S2 L3 L2 L1; S0 para", () => {
    for (const m of [banco.inversiones[0]!, banco.inversiones[94]!]) {
      let s = soltar(pulsar(entrar(), m.s1), m.s1);
      expect([tension(s, m.k1), tension(s, m.k2)]).toEqual([true, false]);
      expect(uvw(s, m.m1)).toEqual(["L1", "L2", "L3"]);
      s = soltar(pulsar(s, m.s0), m.s0);
      s = soltar(pulsar(s, m.s2), m.s2);
      expect([tension(s, m.k1), tension(s, m.k2)]).toEqual([false, true]);
      expect(uvw(s, m.m1)).toEqual(["L3", "L2", "L1"]);
      expect(s.detenida).toBeNull();
      expect(s.avisos).toEqual([]);
    }
  });

  it("la celda de 5: el pulsador enciende la lámpara, sin corto", () => {
    let s = pulsar(entrar(), banco.lampara.pulsador);
    const i = s.netlist.cargas.findIndex((k) => k.comp === banco.lampara.lampara);
    expect(s.encendidas[i]).toBe(true);
    expect(s.encendidas.filter(Boolean)).toHaveLength(1);
    expect(s.detenida).toBeNull();
    s = soltar(s, banco.lampara.pulsador);
    expect(s.encendidas.filter(Boolean)).toHaveLength(0);
  });

  it("simular no cambia el documento", () => {
    const antes = serializar(banco.doc);
    const m = banco.inversiones[3]!;
    soltar(pulsar(entrar(), m.s1), m.s1);
    expect(serializar(banco.doc)).toBe(antes);
  });
});
